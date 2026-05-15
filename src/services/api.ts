import type { Inspection, Photo } from '@/types'

const API_KEY = import.meta.env.VITE_INSPECTION_API_KEY as string | undefined
const ENDPOINT = '/api/inspections'

interface SubmissionPayload {
  inspection_id: string
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
}

export interface SubmitResponse {
  ok: boolean
  monday_item_id?: string
  photo_count?: number
  error?: string
}

export function inspectionApiConfigured(): boolean {
  return Boolean(API_KEY)
}

export async function submitInspectionToApi(
  inspection: Inspection,
  photos: Photo[],
): Promise<SubmitResponse> {
  if (!API_KEY) {
    throw new Error('VITE_INSPECTION_API_KEY is not set.')
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
