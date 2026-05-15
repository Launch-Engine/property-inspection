import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { sectionLabels, sectionOrder } from './sections'
import { formatUsDate, formatUsDateTime } from './format'
import type { InspectionSubmission } from './types'

// Netlify deploys the bundled function under /var/task and preserves the
// included_files directory structure, so the logo ends up at
// /var/task/netlify/lib/cfl-logo.png at runtime regardless of where esbuild
// inlines this file's source. Resolve via process.cwd() so we don't depend on
// __dirname (which the bundler rewrites to the function's location).
const LOGO_PATH = join(process.cwd(), 'netlify', 'lib', 'cfl-logo.png')

const PAGE_WIDTH = 612 // US Letter, 8.5"
const PAGE_HEIGHT = 792 // US Letter, 11"
const MARGIN = 48
const PHOTO_GAP = 12

// CFL Property Management brand palette.
const BRAND_BLUE = rgb(66 / 255, 147 / 255, 201 / 255)        // #4293c9
const BRAND_BLUE_DEEP = rgb(31 / 255, 79 / 255, 115 / 255)    // #1f4f73
const BRAND_GREEN = rgb(101 / 255, 188 / 255, 123 / 255)      // #65bc7b
const TEXT_DARK = rgb(0.10, 0.17, 0.24)
const TEXT_MUTED = rgb(0.35, 0.42, 0.49)
const DIVIDER = rgb(0.85, 0.89, 0.93)

// Loaded once at module load.
const logoBytes = readFileSync(LOGO_PATH)

// Cloudinary delivers transformed JPEGs when we ask for f_jpg in the URL — we
// rewrite each photo's URL on the fly so pdf-lib never has to decode HEIC, PNG,
// or oversized originals.
function transformedCloudinaryUrl(url: string): string {
  if (!url.includes('/upload/')) return url
  // Smaller width keeps PDF size sane and fits fetch time under Netlify's 10s
  // function ceiling even at 100-photo inspections.
  return url.replace('/upload/', '/upload/f_jpg,q_78,w_1000/')
}

async function fetchAsJpegBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(transformedCloudinaryUrl(url))
  if (!response.ok) {
    throw new Error(`Failed to fetch photo (${response.status}): ${url}`)
  }
  const buffer = await response.arrayBuffer()
  return new Uint8Array(buffer)
}

const FETCH_CONCURRENCY = 30

async function fetchAllInParallel(urls: string[]): Promise<Uint8Array[]> {
  const results = new Array<Uint8Array>(urls.length)
  let cursor = 0
  const worker = async () => {
    while (true) {
      const index = cursor
      cursor += 1
      if (index >= urls.length) return
      results[index] = await fetchAsJpegBytes(urls[index])
    }
  }
  const workerCount = Math.min(FETCH_CONCURRENCY, urls.length)
  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  return results
}

interface DrawContext {
  doc: PDFDocument
  page: PDFPage
  font: PDFFont
  bold: PDFFont
  cursorY: number
}

function drawText(
  page: PDFPage,
  text: string,
  options: { x: number; y: number; size: number; font: PDFFont; color?: ReturnType<typeof rgb> },
) {
  page.drawText(text, {
    x: options.x,
    y: options.y,
    size: options.size,
    font: options.font,
    color: options.color ?? TEXT_DARK,
  })
}

function newPage(doc: PDFDocument): PDFPage {
  return doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
}

function drawHeader(ctx: DrawContext, submission: InspectionSubmission, logo: PDFImage) {
  // Brand band along the top of the page anchors every report in CFL blue.
  const bandHeight = 76
  ctx.page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - bandHeight,
    width: PAGE_WIDTH,
    height: bandHeight,
    color: BRAND_BLUE,
  })
  ctx.page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - bandHeight - 3,
    width: PAGE_WIDTH,
    height: 3,
    color: BRAND_GREEN,
  })

  // Logo on a white pill so the colored CFL mark stays readable on blue.
  const logoMaxHeight = 44
  const logoScale = logoMaxHeight / logo.height
  const logoWidth = logo.width * logoScale
  const logoHeight = logo.height * logoScale
  const pillPadX = 12
  const pillPadY = 8
  ctx.page.drawRectangle({
    x: MARGIN - pillPadX,
    y: PAGE_HEIGHT - bandHeight + (bandHeight - logoHeight) / 2 - pillPadY,
    width: logoWidth + pillPadX * 2,
    height: logoHeight + pillPadY * 2,
    color: rgb(1, 1, 1),
    opacity: 0.95,
  })
  ctx.page.drawImage(logo, {
    x: MARGIN,
    y: PAGE_HEIGHT - bandHeight + (bandHeight - logoHeight) / 2,
    width: logoWidth,
    height: logoHeight,
  })

  // "Property Inspection Report" label, right-aligned inside the band.
  const reportLabel = 'PROPERTY INSPECTION REPORT'
  const labelSize = 10
  const labelWidth = ctx.bold.widthOfTextAtSize(reportLabel, labelSize)
  drawText(ctx.page, reportLabel, {
    x: PAGE_WIDTH - MARGIN - labelWidth,
    y: PAGE_HEIGHT - bandHeight / 2 - 4,
    size: labelSize,
    font: ctx.bold,
    color: rgb(1, 1, 1),
  })

  // Metadata block below the band.
  const lineHeight = 18
  let y = PAGE_HEIGHT - bandHeight - 32
  const fields: Array<[string, string]> = [
    ['Property', submission.property_address || '—'],
    ['Inspector', submission.inspector_name || '—'],
    ['Inspection Date', formatUsDate(submission.inspection_date)],
    ['Submitted', formatUsDateTime(new Date().toISOString())],
  ]

  for (const [label, value] of fields) {
    drawText(ctx.page, label.toUpperCase(), {
      x: MARGIN,
      y,
      size: 8,
      font: ctx.bold,
      color: TEXT_MUTED,
    })
    drawText(ctx.page, value, { x: MARGIN + 110, y, size: 11, font: ctx.font })
    y -= lineHeight
  }

  // Separator under the metadata.
  ctx.page.drawLine({
    start: { x: MARGIN, y: y + 4 },
    end: { x: PAGE_WIDTH - MARGIN, y: y + 4 },
    thickness: 0.75,
    color: DIVIDER,
  })

  ctx.cursorY = y - 14
}

function drawSectionHeading(ctx: DrawContext, label: string, photoCount: number) {
  if (ctx.cursorY < MARGIN + 100) {
    ctx.page = newPage(ctx.doc)
    ctx.cursorY = PAGE_HEIGHT - MARGIN
  }

  // CFL blue accent bar to the left of the section title.
  const titleSize = 14
  ctx.page.drawRectangle({
    x: MARGIN,
    y: ctx.cursorY - 2,
    width: 3,
    height: titleSize + 2,
    color: BRAND_BLUE,
  })

  drawText(ctx.page, label, {
    x: MARGIN + 12,
    y: ctx.cursorY,
    size: titleSize,
    font: ctx.bold,
    color: BRAND_BLUE_DEEP,
  })

  const countText = `${photoCount} photo${photoCount === 1 ? '' : 's'}`
  const countWidth = ctx.font.widthOfTextAtSize(countText, 10)
  drawText(ctx.page, countText, {
    x: PAGE_WIDTH - MARGIN - countWidth,
    y: ctx.cursorY,
    size: 10,
    font: ctx.font,
    color: TEXT_MUTED,
  })

  ctx.cursorY -= 8
  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.cursorY },
    end: { x: PAGE_WIDTH - MARGIN, y: ctx.cursorY },
    thickness: 0.5,
    color: DIVIDER,
  })
  ctx.cursorY -= 16
}

function fitImageBox(image: PDFImage, maxWidth: number, maxHeight: number) {
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1)
  return { width: image.width * scale, height: image.height * scale }
}

const COMMENT_FONT_SIZE = 10
const COMMENT_LINE_HEIGHT = 13

function wrapLines(text: string, font: PDFFont, maxWidth: number): string[] {
  const lines: string[] = []
  for (const rawLine of text.split(/\r?\n/)) {
    const words = rawLine.split(/\s+/).filter(Boolean)
    if (words.length === 0) {
      lines.push('')
      continue
    }
    let current = ''
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word
      if (font.widthOfTextAtSize(candidate, COMMENT_FONT_SIZE) > maxWidth && current) {
        lines.push(current)
        current = word
      } else {
        current = candidate
      }
    }
    if (current) lines.push(current)
  }
  return lines
}

function drawSectionComment(ctx: DrawContext, comment: string) {
  const trimmed = comment.trim()
  if (!trimmed) return

  const indent = 16
  const usableWidth = PAGE_WIDTH - MARGIN * 2 - indent
  const lines = wrapLines(trimmed, ctx.font, usableWidth)

  // Subtle "NOTES" label so the comment block reads as a deliberate annotation.
  drawText(ctx.page, 'NOTES', {
    x: MARGIN,
    y: ctx.cursorY - COMMENT_FONT_SIZE,
    size: 7,
    font: ctx.bold,
    color: BRAND_BLUE,
  })

  for (const line of lines) {
    if (ctx.cursorY - COMMENT_LINE_HEIGHT < MARGIN) {
      ctx.page = newPage(ctx.doc)
      ctx.cursorY = PAGE_HEIGHT - MARGIN
    }
    drawText(ctx.page, line, {
      x: MARGIN + indent,
      y: ctx.cursorY - COMMENT_FONT_SIZE,
      size: COMMENT_FONT_SIZE,
      font: ctx.font,
      color: TEXT_DARK,
    })
    ctx.cursorY -= COMMENT_LINE_HEIGHT
  }
  ctx.cursorY -= 10
}

async function drawSectionPhotos(
  ctx: DrawContext,
  photoImages: PDFImage[],
): Promise<void> {
  const photosPerRow = 2
  const usableWidth = PAGE_WIDTH - MARGIN * 2
  const cellWidth = (usableWidth - PHOTO_GAP * (photosPerRow - 1)) / photosPerRow
  const cellHeight = cellWidth * 0.75

  for (let i = 0; i < photoImages.length; i += photosPerRow) {
    if (ctx.cursorY - cellHeight < MARGIN) {
      ctx.page = newPage(ctx.doc)
      ctx.cursorY = PAGE_HEIGHT - MARGIN
    }

    const row = photoImages.slice(i, i + photosPerRow)
    row.forEach((image, columnIndex) => {
      const cellX = MARGIN + columnIndex * (cellWidth + PHOTO_GAP)
      const { width, height } = fitImageBox(image, cellWidth, cellHeight)
      const offsetX = cellX + (cellWidth - width) / 2
      const offsetY = ctx.cursorY - cellHeight + (cellHeight - height) / 2
      ctx.page.drawImage(image, { x: offsetX, y: offsetY, width, height })
    })

    ctx.cursorY -= cellHeight + PHOTO_GAP
  }
}

export async function generateInspectionPdf(submission: InspectionSubmission): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.setTitle(`Inspection — ${submission.property_address || submission.inspection_id}`)
  doc.setAuthor(submission.inspector_name || 'Property Inspection App')
  doc.setProducer('cfpm-inspection')
  doc.setCreationDate(new Date())

  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const logo = await doc.embedPng(logoBytes)
  const page = newPage(doc)

  const ctx: DrawContext = {
    doc,
    page,
    font,
    bold,
    cursorY: PAGE_HEIGHT - MARGIN,
  }

  drawHeader(ctx, submission, logo)

  // Pre-fetch and embed every photo in parallel before any layout work. With
  // 100 photos and sequential fetches at ~500ms each, generation alone would
  // exceed Netlify's function timeout. Parallel fetch (capped at
  // FETCH_CONCURRENCY) keeps total wall-clock under ~3s on typical broadband.
  const grouped = new Map<string, string[]>()
  for (const photo of submission.photos) {
    const existing = grouped.get(photo.section_key) ?? []
    existing.push(photo.cloudinary_url)
    grouped.set(photo.section_key, existing)
  }

  const orderedUrls: string[] = []
  for (const sectionKey of sectionOrder) {
    const urls = grouped.get(sectionKey)
    if (urls) orderedUrls.push(...urls)
  }

  const allBytes = await fetchAllInParallel(orderedUrls)
  const embeddedByUrl = new Map<string, PDFImage>()
  let cursor = 0
  for (const sectionKey of sectionOrder) {
    const urls = grouped.get(sectionKey)
    if (!urls) continue
    for (const url of urls) {
      embeddedByUrl.set(url, await doc.embedJpg(allBytes[cursor]))
      cursor += 1
    }
  }

  // Sections appear in the PDF when they have photos OR a comment. A
  // commented-but-photoless section is still useful (e.g., "Bedroom 4 — N/A,
  // unit is a 3-bed").
  const comments = submission.comments_by_section ?? {}
  const sectionKeys = new Set<string>([...grouped.keys()])
  for (const key of Object.keys(comments)) {
    if (comments[key]?.trim()) sectionKeys.add(key)
  }

  for (const sectionKey of sectionOrder) {
    if (!sectionKeys.has(sectionKey)) continue
    const urls = grouped.get(sectionKey) ?? []
    const label = sectionLabels[sectionKey] ?? sectionKey
    drawSectionHeading(ctx, label, urls.length)
    drawSectionComment(ctx, comments[sectionKey] ?? '')
    if (urls.length > 0) {
      const images = urls
        .map((url) => embeddedByUrl.get(url))
        .filter((img): img is PDFImage => !!img)
      await drawSectionPhotos(ctx, images)
    }
    ctx.cursorY -= 14
  }

  // Branded page footer on every page: thin CFL-blue rule, small page numbers
  // + "CFL Property Management" wordmark.
  const pages = doc.getPages()
  pages.forEach((p, index) => {
    p.drawLine({
      start: { x: MARGIN, y: MARGIN - 16 },
      end: { x: PAGE_WIDTH - MARGIN, y: MARGIN - 16 },
      thickness: 0.5,
      color: BRAND_BLUE,
      opacity: 0.6,
    })
    drawText(p, 'Central Florida Property Management', {
      x: MARGIN,
      y: MARGIN - 30,
      size: 8,
      font: bold,
      color: BRAND_BLUE_DEEP,
    })
    const pageLabel = `Page ${index + 1} of ${pages.length}`
    const pageLabelWidth = font.widthOfTextAtSize(pageLabel, 8)
    drawText(p, pageLabel, {
      x: PAGE_WIDTH - MARGIN - pageLabelWidth,
      y: MARGIN - 30,
      size: 8,
      font,
      color: TEXT_MUTED,
    })
  })

  return doc.save()
}
