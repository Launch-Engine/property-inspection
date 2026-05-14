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
  blob?: Blob
  cloudinary_url?: string
  upload_status: PhotoUploadStatus
  captured_at: string
}

export interface Inspection {
  id: string
  inspector_name: string
  property_address: string
  inspection_date: string
  status: InspectionStatus
  photos_by_section: Record<SectionKey, string[]>
  created_at: string
  updated_at: string
}
