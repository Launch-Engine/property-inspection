export interface SubmittedPhoto {
  id: string
  section_key: string
  cloudinary_url: string
  captured_at: string
}

export interface InspectionSubmission {
  inspection_id: string
  inspector_name: string
  property_address: string
  inspection_date: string
  photos: SubmittedPhoto[]
}

export interface SectionLabelMap {
  [section_key: string]: string
}
