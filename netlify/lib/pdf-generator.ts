import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib'
import { sectionLabels, sectionOrder } from './sections'
import type { InspectionSubmission } from './types'

const PAGE_WIDTH = 612 // US Letter, 8.5"
const PAGE_HEIGHT = 792 // US Letter, 11"
const MARGIN = 48
const PHOTO_GAP = 12
const HEADER_HEIGHT = 110

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
    color: options.color ?? rgb(0.06, 0.09, 0.16),
  })
}

function newPage(doc: PDFDocument): PDFPage {
  return doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
}

function drawHeader(ctx: DrawContext, submission: InspectionSubmission) {
  const top = PAGE_HEIGHT - MARGIN

  drawText(ctx.page, 'Property Inspection', {
    x: MARGIN,
    y: top,
    size: 22,
    font: ctx.bold,
  })

  const lineHeight = 16
  let y = top - 32
  const fields: Array<[string, string]> = [
    ['Property', submission.property_address || '—'],
    ['Inspector', submission.inspector_name || '—'],
    ['Inspection Date', submission.inspection_date || '—'],
    ['Submitted', new Date().toISOString().slice(0, 16).replace('T', ' ')],
  ]

  for (const [label, value] of fields) {
    drawText(ctx.page, `${label}:`, { x: MARGIN, y, size: 10, font: ctx.bold })
    drawText(ctx.page, value, { x: MARGIN + 90, y, size: 10, font: ctx.font })
    y -= lineHeight
  }

  ctx.cursorY = y - 16
}

function drawSectionHeading(ctx: DrawContext, label: string, photoCount: number) {
  if (ctx.cursorY < MARGIN + 80) {
    ctx.page = newPage(ctx.doc)
    ctx.cursorY = PAGE_HEIGHT - MARGIN
  }

  drawText(ctx.page, label, {
    x: MARGIN,
    y: ctx.cursorY,
    size: 14,
    font: ctx.bold,
  })

  drawText(ctx.page, `${photoCount} photo${photoCount === 1 ? '' : 's'}`, {
    x: PAGE_WIDTH - MARGIN - 80,
    y: ctx.cursorY,
    size: 10,
    font: ctx.font,
    color: rgb(0.39, 0.45, 0.55),
  })

  ctx.cursorY -= 8
  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.cursorY },
    end: { x: PAGE_WIDTH - MARGIN, y: ctx.cursorY },
    thickness: 0.5,
    color: rgb(0.85, 0.87, 0.91),
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

  const usableWidth = PAGE_WIDTH - MARGIN * 2
  const lines = wrapLines(trimmed, ctx.font, usableWidth)

  for (const line of lines) {
    if (ctx.cursorY - COMMENT_LINE_HEIGHT < MARGIN) {
      ctx.page = newPage(ctx.doc)
      ctx.cursorY = PAGE_HEIGHT - MARGIN
    }
    drawText(ctx.page, line, {
      x: MARGIN,
      y: ctx.cursorY - COMMENT_FONT_SIZE,
      size: COMMENT_FONT_SIZE,
      font: ctx.font,
      color: rgb(0.32, 0.39, 0.49),
    })
    ctx.cursorY -= COMMENT_LINE_HEIGHT
  }
  ctx.cursorY -= 6
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
  const page = newPage(doc)

  const ctx: DrawContext = {
    doc,
    page,
    font,
    bold,
    cursorY: PAGE_HEIGHT - MARGIN,
  }

  drawHeader(ctx, submission)

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
    ctx.cursorY -= HEADER_HEIGHT / 8
  }

  return doc.save()
}
