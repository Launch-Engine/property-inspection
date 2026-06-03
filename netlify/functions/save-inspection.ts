import type { Context } from '@netlify/functions'
import { updateInspectionItem } from '../lib/monday-client'

const REQUIRED_ENV = ['MONDAY_API_TOKEN', 'MONDAY_BOARD_ID', 'INSPECTION_API_KEY'] as const

const COLUMN_IDS = {
  inspector: process.env.MONDAY_COL_INSPECTOR || 'text_mm3btzdy',
  inspection_date: process.env.MONDAY_COL_INSPECTION_DATE || 'date_mm3bd4tq',
  status: process.env.MONDAY_COL_STATUS || 'color_mm3bw9q4',
  pdf_report: process.env.MONDAY_COL_PDF_REPORT || 'file_mm3bqsfr',
  photo_count: process.env.MONDAY_COL_PHOTO_COUNT || 'numeric_mm3by75s',
  submitted_at: process.env.MONDAY_COL_SUBMITTED_AT || 'date_mm3btshw',
  inspection_id: process.env.MONDAY_COL_INSPECTION_ID || 'text_mm3bjzx9',
  walkthrough_video: process.env.MONDAY_COL_WALKTHROUGH_VIDEO || '',
}

interface SaveRequest {
  inspection_id?: unknown
  monday_item_id?: unknown
  inspector_name?: unknown
  inspection_date?: unknown
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

export default async (request: Request, _context: Context): Promise<Response> => {
  if (request.method === 'OPTIONS') {
    return jsonResponse(204, {})
  }
  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'POST only' })
  }

  const missing = missingEnv()
  if (missing.length > 0) {
    console.error('Missing environment variables:', missing.join(', '))
    return jsonResponse(500, { error: 'Server is not configured.' })
  }

  const apiKey = request.headers.get('x-api-key')
  if (apiKey !== process.env.INSPECTION_API_KEY) {
    return jsonResponse(401, { error: 'Invalid or missing API key' })
  }

  let body: SaveRequest
  try {
    body = (await request.json()) as SaveRequest
  } catch {
    return jsonResponse(400, { error: 'Body is not valid JSON' })
  }

  const inspectionId = typeof body.inspection_id === 'string' ? body.inspection_id : null
  const mondayItemId = typeof body.monday_item_id === 'string' && /^\d+$/.test(body.monday_item_id) ? body.monday_item_id : null
  const inspectorName = typeof body.inspector_name === 'string' && body.inspector_name.trim() ? body.inspector_name.trim() : undefined
  const inspectionDate = typeof body.inspection_date === 'string' && body.inspection_date ? body.inspection_date : undefined

  if (!inspectionId || !mondayItemId) {
    return jsonResponse(400, { error: 'inspection_id and monday_item_id are required.' })
  }

  try {
    // Partial update — only the fields that signal "work in progress." No PDF,
    // no photo count, no walkthrough URL (those land on the final Submit).
    // create_labels_if_missing inside updateInspectionItem ensures the new
    // "In Progress" status label is created the first time it's used.
    await updateInspectionItem({
      token: process.env.MONDAY_API_TOKEN!,
      board_id: process.env.MONDAY_BOARD_ID!,
      item_id: mondayItemId,
      column_ids: {
        ...COLUMN_IDS,
        walkthrough_video: COLUMN_IDS.walkthrough_video || undefined,
      },
      columns: {
        inspector: inspectorName,
        inspection_date: inspectionDate,
        status_label: 'In Progress',
        inspection_id: inspectionId,
      },
    })

    return jsonResponse(200, {
      ok: true,
      monday_item_id: mondayItemId,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('save-inspection failed:', message, err)
    return jsonResponse(500, { error: message })
  }
}
