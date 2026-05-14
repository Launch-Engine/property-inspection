import Dexie, { type Table } from 'dexie'
import type { Inspection, Photo } from '@/types'

class InspectionDatabase extends Dexie {
  inspections!: Table<Inspection, string>
  photos!: Table<Photo, string>

  constructor() {
    super('property_inspection')

    this.version(1).stores({
      inspections: 'id, status, updated_at',
      photos: 'id, inspection_id, section_key, upload_status, captured_at',
    })
  }
}

export const db = new InspectionDatabase()
