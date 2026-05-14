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
  return url.replace('/upload/', '/upload/f_jpg,q_80,w_1400/')
}

async function fetchAsJpegBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(transformedCloudinaryUrl(url))
  if (!response.ok) {
    throw new Error(`Failed to fetch photo (${response.status}): ${url}`)
  }
  const buffer = await response.arrayBuffer()
  return new Uint8Array(buffer)
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

async function drawSectionPhotos(
  ctx: DrawContext,
  photoUrls: string[],
): Promise<void> {
  const photosPerRow = 2
  const usableWidth = PAGE_WIDTH - MARGIN * 2
  const cellWidth = (usableWidth - PHOTO_GAP * (photosPerRow - 1)) / photosPerRow
  const cellHeight = cellWidth * 0.75

  for (let i = 0; i < photoUrls.length; i += photosPerRow) {
    if (ctx.cursorY - cellHeight < MARGIN) {
      ctx.page = newPage(ctx.doc)
      ctx.cursorY = PAGE_HEIGHT - MARGIN
    }

    const row = photoUrls.slice(i, i + photosPerRow)
    const images = await Promise.all(
      row.map(async (url) => {
        const bytes = await fetchAsJpegBytes(url)
        return ctx.doc.embedJpg(bytes)
      }),
    )

    images.forEach((image, columnIndex) => {
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

  const grouped = new Map<string, string[]>()
  for (const photo of submission.photos) {
    const existing = grouped.get(photo.section_key) ?? []
    existing.push(photo.cloudinary_url)
    grouped.set(photo.section_key, existing)
  }

  for (const sectionKey of sectionOrder) {
    const photos = grouped.get(sectionKey)
    if (!photos || photos.length === 0) continue
    const label = sectionLabels[sectionKey] ?? sectionKey
    drawSectionHeading(ctx, label, photos.length)
    await drawSectionPhotos(ctx, photos)
    ctx.cursorY -= HEADER_HEIGHT / 8
  }

  return doc.save()
}
