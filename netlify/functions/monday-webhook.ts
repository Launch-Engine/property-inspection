import type { Context } from '@netlify/functions'
import { setLinkColumnValue } from '../lib/monday-client'

const REQUIRED_ENV = [
  'MONDAY_API_TOKEN',
  'MONDAY_BOARD_ID',
  'INSPECTION_API_KEY',
  'MONDAY_COL_INSPECTION_LINK',
] as const

const PWA_URL_BASE = process.env.PUBLIC_PWA_URL || 'https://cfpm-inspection.netlify.app'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function missingEnv(): string[] {
  return REQUIRED_ENV.filter((key) => !process.env[key])
}

interface ChallengePayload {
  challenge?: string
}

interface EventPayload {
  event?: {
    pulseId?: number | string
    boardId?: number | string
    type?: string
  }
}

type WebhookPayload = ChallengePayload & EventPayload

export default async (request: Request, _context: Context): Promise<Response> => {
  // Monday verifies webhook URLs by POSTing a one-time `{ "challenge": "..." }`
  // and expecting that exact challenge back. Handle this before anything else
  // so the verification round-trip works even if env vars aren't fully set.
  let body: WebhookPayload
  try {
    body = (await request.json()) as WebhookPayload
  } catch {
    return jsonResponse(400, { error: 'Body is not valid JSON' })
  }

  if (body.challenge) {
    return jsonResponse(200, { challenge: body.challenge })
  }

  // Past the challenge: this is a real event. Auth via ?token= query param.
  // Monday webhooks don't support custom headers, so we authenticate via the
  // URL itself. The token reuses INSPECTION_API_KEY (already in Netlify env).
  const url = new URL(request.url)
  const token = url.searchParams.get('token')
  if (!process.env.INSPECTION_API_KEY || token !== process.env.INSPECTION_API_KEY) {
    return jsonResponse(401, { error: 'Invalid or missing token query param' })
  }

  const missing = missingEnv()
  if (missing.length > 0) {
    console.error('Missing environment variables:', missing.join(', '))
    return jsonResponse(500, { error: 'Server is not configured.' })
  }

  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'POST only' })
  }

  const event = body.event
  if (!event || !event.pulseId) {
    // Not an event we care about — return 200 so Monday doesn't retry forever.
    return jsonResponse(200, { ok: true, ignored: true, reason: 'No event.pulseId in payload.' })
  }

  // Only care about new items. Updates and other event types are ignored so
  // we don't overwrite a link the inspector or PM has already touched.
  if (event.type && event.type !== 'create_pulse') {
    return jsonResponse(200, { ok: true, ignored: true, reason: `Event type ${event.type} is not create_pulse.` })
  }

  const pulseId = String(event.pulseId)
  const inspectionLink = `${PWA_URL_BASE}/inspect?item=${pulseId}`

  try {
    await setLinkColumnValue({
      token: process.env.MONDAY_API_TOKEN!,
      board_id: process.env.MONDAY_BOARD_ID!,
      item_id: pulseId,
      column_id: process.env.MONDAY_COL_INSPECTION_LINK!,
      url: inspectionLink,
      text: 'Open inspection',
    })
    return jsonResponse(200, { ok: true, pulseId, inspection_link: inspectionLink })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('monday-webhook failed:', message, err)
    return jsonResponse(500, { error: message })
  }
}
