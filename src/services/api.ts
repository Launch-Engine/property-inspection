import type { Inspection, Photo, Walkthrough } from '@/types'

const API_KEY = import.meta.env.VITE_INSPECTION_API_KEY as string | undefined
const ENDPOINT = '/api/inspections'
const CONTEXT_ENDPOINT = '/api/inspections/context'
const SAVE_ENDPOINT = '/api/inspections/save'

interface SubmissionPayload {
  inspection_id: string
  monday_item_id: string
  inspector_name: string
  property_address: string
  inspection_date: string
  comments_by_section: Record<string, string>
  photos: Array<{
    id: string
    section_key: string
    cloudinary_url: string
    captured_at: string
  }>
  walkthrough?: {
    cloudinary_url: string
    cloudinary_public_id?: string
    duration_seconds: number
  }
}

export interface SubmitResponse {
  ok: boolean
  monday_item_id?: string
  photo_count?: number
  error?: string
}

export interface InspectionContext {
  ok: boolean
  monday_item_id: string
  property_address: string
  inspector_name: string | null
  inspection_date: string | null
  already_submitted: boolean
  error?: string
}

export function inspectionApiConfigured(): boolean {
  return Boolean(API_KEY)
}

export async function loadInspectionContext(itemId: string): Promise<InspectionContext> {
  if (!API_KEY) {
    throw new Error('VITE_INSPECTION_API_KEY is not set.')
  }
  const response = await fetch(`${CONTEXT_ENDPOINT}?item_id=${encodeURIComponent(itemId)}`, {
    headers: { 'X-API-Key': API_KEY },
  })
  const json = (await response.json().catch(() => ({}))) as InspectionContext
  if (!response.ok || !json.ok) {
    throw new Error(json.error || `Context lookup failed (${response.status})`)
  }
  return json
}

export async function saveInspectionForLater(inspection: Inspection): Promise<{ ok: boolean; monday_item_id?: string; error?: string }> {
  if (!API_KEY) {
    throw new Error('VITE_INSPECTION_API_KEY is not set.')
  }
  if (!inspection.monday_item_id) {
    throw new Error('This inspection has no Monday item ID. Open the link from your inspection email to start.')
  }

  const response = await fetch(SAVE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    },
    body: JSON.stringify({
      inspection_id: inspection.id,
      monday_item_id: inspection.monday_item_id,
      inspector_name: inspection.inspector_name || undefined,
      inspection_date: inspection.inspection_date || undefined,
    }),
  })

  const json = (await response.json().catch(() => ({}))) as { ok: boolean; monday_item_id?: string; error?: string }
  if (!response.ok || !json.ok) {
    throw new Error(json.error || `Save failed (${response.status})`)
  }
  return json
}

export async function submitInspectionToApi(
  inspection: Inspection,
  photos: Photo[],
  walkthrough: Walkthrough | null = null,
): Promise<SubmitResponse> {
  if (!API_KEY) {
    throw new Error('VITE_INSPECTION_API_KEY is not set.')
  }
  if (!inspection.monday_item_id) {
    throw new Error('This inspection has no Monday item ID. Open the link from your inspection email to start.')
  }

  // Only send comments that aren't empty/whitespace — keeps the payload small
  // and means the PDF won't render empty "Notes:" blocks under bare sections.
  const trimmedComments = Object.fromEntries(
    Object.entries(inspection.comments_by_section ?? {})
      .map(([k, v]) => [k, (v ?? '').trim()])
      .filter(([, v]) => v.length > 0),
  )

  const payload: SubmissionPayload = {
    inspection_id: inspection.id,
    monday_item_id: inspection.monday_item_id,
    inspector_name: inspection.inspector_name,
    property_address: inspection.property_address,
    inspection_date: inspection.inspection_date,
    comments_by_section: trimmedComments,
    photos: photos
      .filter((p) => p.cloudinary_url)
      .map((p) => ({
        id: p.id,
        section_key: p.section_key,
        cloudinary_url: p.cloudinary_url!,
        captured_at: p.captured_at,
      })),
  }

  if (walkthrough?.cloudinary_url) {
    payload.walkthrough = {
      cloudinary_url: walkthrough.cloudinary_url,
      cloudinary_public_id: walkthrough.cloudinary_public_id,
      duration_seconds: walkthrough.duration_seconds,
    }
  }

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    },
    body: JSON.stringify(payload),
  })

  const json = (await response.json().catch(() => ({}))) as SubmitResponse
  if (!response.ok || !json.ok) {
    throw new Error(json.error || `Submit failed (${response.status})`)
  }
  return json
}
