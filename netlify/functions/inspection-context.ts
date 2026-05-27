import type { Context } from '@netlify/functions'
import { getItemContext } from '../lib/monday-client'

const REQUIRED_ENV = ['MONDAY_API_TOKEN', 'INSPECTION_API_KEY'] as const

const COLUMN_IDS = {
  inspector: process.env.MONDAY_COL_INSPECTOR || '',
  inspection_date: process.env.MONDAY_COL_INSPECTION_DATE || '',
  status: process.env.MONDAY_COL_STATUS || '',
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
  if (request.method !== 'GET') {
    return jsonResponse(405, { error: 'GET only' })
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

  const url = new URL(request.url)
  const itemId = url.searchParams.get('item_id') || url.searchParams.get('item')
  if (!itemId || !/^\d+$/.test(itemId)) {
    return jsonResponse(400, { error: 'item_id is required and must be numeric.' })
  }

  try {
    const wantedCols = [COLUMN_IDS.inspector, COLUMN_IDS.inspection_date, COLUMN_IDS.status].filter(Boolean)
    const result = await getItemContext({
      token: process.env.MONDAY_API_TOKEN!,
      item_id: itemId,
      column_ids: wantedCols,
    })

    if (!result) {
      return jsonResponse(404, { error: 'No Monday item found for that ID.' })
    }

    const inspector = COLUMN_IDS.inspector ? result.columns[COLUMN_IDS.inspector] : ''
    const inspectionDate = COLUMN_IDS.inspection_date ? result.columns[COLUMN_IDS.inspection_date] : ''
    const status = COLUMN_IDS.status ? result.columns[COLUMN_IDS.status] : ''
    const alreadySubmitted = status.toLowerCase() === 'submitted'

    return jsonResponse(200, {
      ok: true,
      monday_item_id: itemId,
      property_address: result.item_name,
      inspector_name: inspector || null,
      inspection_date: inspectionDate || null,
      already_submitted: alreadySubmitted,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('inspection-context failed:', message, err)
    return jsonResponse(500, { error: message })
  }
}
