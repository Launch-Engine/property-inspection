export type SectionKey =
  | 'living_room'
  | 'kitchen'
  | 'appliances'
  | 'under_kitchen_sink'
  | 'primary_bedroom'
  | 'bedroom_2'
  | 'bedroom_3'
  | 'bedroom_4'
  | 'primary_bathroom'
  | 'second_bathroom'
  | 'third_bathroom'
  | 'under_bathroom_sinks'
  | 'utility_room'
  | 'hvac_filter'
  | 'exterior_front'
  | 'exterior_rear'
  | 'exterior_left'
  | 'exterior_right'
  | 'porch_garage_misc'

export interface SectionConfig {
  key: SectionKey
  label: string
  description: string
  minPhotos: number
  maxPhotos: number
  required: boolean
}

export type InspectionStatus = 'draft' | 'ready' | 'syncing' | 'synced' | 'failed'
export type PhotoUploadStatus = 'pending' | 'uploading' | 'uploaded' | 'failed'

export interface Photo {
  id: string
  inspection_id: string
  section_key: SectionKey
  data?: ArrayBuffer
  mime_type?: string
  cloudinary_url?: string
  upload_status: PhotoUploadStatus
  captured_at: string
}

export interface Walkthrough {
  inspection_id: string
  data?: ArrayBuffer
  mime_type?: string
  duration_seconds: number
  cloudinary_url?: string
  cloudinary_public_id?: string
  upload_status: PhotoUploadStatus
  captured_at: string
}

export interface Inspection {
  id: string
  monday_item_id: string | null
  inspector_name: string
  property_address: string
  inspection_date: string
  status: InspectionStatus
  photos_by_section: Record<SectionKey, string[]>
  comments_by_section: Record<SectionKey, string>
  has_walkthrough: boolean
  // Tenant context lives on the URL (carried by SendGrid/Make.com) and is
  // displayed to the inspector. Read-only with respect to Monday — we never
  // write these back to the Monday item. Null when the URL didn't carry
  // either param (e.g., periodic inspections where tenant context isn't
  // relevant).
  tenant_name: string | null
  tenant_email: string | null
  // Timestamp of the most recent server-side checkpoint (Save for Later).
  // Local autosaves into IndexedDB happen on every change and are not
  // reflected here — this only tracks when we last told Monday "in progress."
  saved_for_later_at: string | null
  created_at: string
  updated_at: string
}
