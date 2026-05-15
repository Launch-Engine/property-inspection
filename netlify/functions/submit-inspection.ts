import type { Context } from '@netlify/functions'
import { generateInspectionPdf } from '../lib/pdf-generator'
import { attachFileToItem, createInspectionItem, findItemByInspectionId } from '../lib/monday-client'
import type { InspectionSubmission } from '../lib/types'

const REQUIRED_ENV = [
  'MONDAY_API_TOKEN',
  'MONDAY_BOARD_ID',
  'INSPECTION_API_KEY',
] as const

// Column IDs are now env-driven so swapping between Monday accounts (CFL,
// LaunchEngine, future clients) doesn't require a code change. Defaults
// preserve the original LaunchEngine board so the function still works if
// the per-column env vars aren't set.
const COLUMN_IDS = {
  inspector: process.env.MONDAY_COL_INSPECTOR || 'text_mm3btzdy',
  inspection_date: process.env.MONDAY_COL_INSPECTION_DATE || 'date_mm3bd4tq',
  status: process.env.MONDAY_COL_STATUS || 'color_mm3bw9q4',
  pdf_report: process.env.MONDAY_COL_PDF_REPORT || 'file_mm3bqsfr',
  photo_count: process.env.MONDAY_COL_PHOTO_COUNT || 'numeric_mm3by75s',
  submitted_at: process.env.MONDAY_COL_SUBMITTED_AT || 'date_mm3btshw',
  inspection_id: process.env.MONDAY_COL_INSPECTION_ID || 'text_mm3bjzx9',
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
  })
}

function missingEnv(): string[] {
  return REQUIRED_ENV.filter((key) => !process.env[key])
}

function validatePayload(payload: unknown): payload is InspectionSubmission {
  if (!payload || typeof payload !== 'object') return false
  const p = payload as Partial<InspectionSubmission>
  if (typeof p.inspection_id !== 'string' || p.inspection_id.length === 0) return false
  if (typeof p.inspector_name !== 'string') return false
  if (typeof p.property_address !== 'string') return false
  if (typeof p.inspection_date !== 'string') return false
  if (!Array.isArray(p.photos)) return false
  if (p.comments_by_section !== undefined) {
    if (typeof p.comments_by_section !== 'object' || p.comments_by_section === null) return false
    for (const value of Object.values(p.comments_by_section)) {
      if (typeof value !== 'string') return false
    }
  }
  return p.photos.every(
    (photo) =>
      photo &&
      typeof photo === 'object' &&
      typeof photo.id === 'string' &&
      typeof photo.section_key === 'string' &&
      typeof photo.cloudinary_url === 'string',
  )
}

export default async (request: Request, _context: Context): Promise<Response> => {
  if (request.method === 'OPTIONS') {
    return jsonResponse(204, {})
  }

  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' })
  }

  const missing = missingEnv()
  if (missing.length > 0) {
    console.error('Missing environment variables:', missing.join(', '))
    return jsonResponse(500, { error: 'Server is not configured. Missing env vars.' })
  }

  const apiKey = request.headers.get('x-api-key')
  if (apiKey !== process.env.INSPECTION_API_KEY) {
    return jsonResponse(401, { error: 'Invalid or missing API key' })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return jsonResponse(400, { error: 'Body is not valid JSON' })
  }

  if (!validatePayload(payload)) {
    return jsonResponse(400, { error: 'Payload failed validation' })
  }

  const submission = payload

  try {
    // Idempotency: if a Monday item already exists for this inspection_id,
    // return it instead of creating a duplicate. Catches double-taps, network
    // retries, and any other path that fires the function twice for the same
    // inspection.
    const existing = await findItemByInspectionId({
      token: process.env.MONDAY_API_TOKEN!,
      board_id: process.env.MONDAY_BOARD_ID!,
      inspection_id_column: COLUMN_IDS.inspection_id,
      inspection_id: submission.inspection_id,
    })

    if (existing) {
      return jsonResponse(200, {
        ok: true,
        monday_item_id: existing.item_id,
        photo_count: submission.photos.length,
        deduplicated: true,
      })
    }

    const pdfBytes = await generateInspectionPdf(submission)

    const itemName =
      submission.property_address.trim() || `Inspection ${submission.inspection_id.slice(0, 8)}`

    const { item_id } = await createInspectionItem({
      token: process.env.MONDAY_API_TOKEN!,
      board_id: process.env.MONDAY_BOARD_ID!,
      item_name: itemName,
      column_ids: COLUMN_IDS,
      columns: {
        inspector: submission.inspector_name || undefined,
        inspection_date: submission.inspection_date || undefined,
        status_label: 'New',
        photo_count: submission.photos.length,
        submitted_at_iso: new Date().toISOString(),
        inspection_id: submission.inspection_id,
      },
    })

    await attachFileToItem({
      token: process.env.MONDAY_API_TOKEN!,
      item_id,
      column_id: COLUMN_IDS.pdf_report,
      file: pdfBytes,
      file_name: `inspection-${submission.inspection_id.slice(0, 8)}.pdf`,
      mime_type: 'application/pdf',
    })

    return jsonResponse(200, {
      ok: true,
      monday_item_id: item_id,
      photo_count: submission.photos.length,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('submit-inspection failed:', message, err)
    return jsonResponse(500, { error: message })
  }
}
