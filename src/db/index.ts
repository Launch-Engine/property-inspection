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

    // v2: switched photo storage from Blob to ArrayBuffer + mime_type so images
    // survive iOS PWA close/reopen. Existing photo records use the old shape
    // and can't be displayed, so clear them on upgrade.
    this.version(2)
      .stores({
        inspections: 'id, status, updated_at',
        photos: 'id, inspection_id, section_key, upload_status, captured_at',
      })
      .upgrade((tx) => tx.table('photos').clear())
  }
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) {
    return false
  }
  try {
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

export const db = new InspectionDatabase()
