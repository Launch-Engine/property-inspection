import { db } from '@/db'
import { uploadToCloudinary } from '@/utils/cloudinary'
import type { Inspection, Photo } from '@/types'

const MAX_ATTEMPTS = 3
const BACKOFF_MS = [0, 1500, 4000]

export interface SyncProgress {
  total: number
  uploaded: number
  failed: number
  in_progress: boolean
}

export type SyncEvent =
  | { type: 'progress'; progress: SyncProgress }
  | { type: 'photo_uploaded'; photo_id: string; secure_url: string }
  | { type: 'photo_failed'; photo_id: string; error: string }
  | { type: 'complete'; uploaded: number; failed: number }

type Listener = (event: SyncEvent) => void

class InspectionSyncService {
  private isRunning = false
  private listeners = new Set<Listener>()

  on(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(event: SyncEvent) {
    for (const listener of this.listeners) listener(event)
  }

  async uploadPendingPhotos(inspection: Inspection): Promise<{ uploaded: number; failed: number }> {
    if (this.isRunning) {
      throw new Error('A sync is already in progress.')
    }
    this.isRunning = true

    try {
      const pending = await db.photos
        .where('inspection_id')
        .equals(inspection.id)
        .filter((p) => p.upload_status !== 'uploaded')
        .toArray()

      const progress: SyncProgress = {
        total: pending.length,
        uploaded: 0,
        failed: 0,
        in_progress: true,
      }
      this.emit({ type: 'progress', progress: { ...progress } })

      for (const photo of pending) {
        const ok = await this.uploadOne(photo, inspection)
        if (ok) progress.uploaded += 1
        else progress.failed += 1
        this.emit({ type: 'progress', progress: { ...progress } })
      }

      progress.in_progress = false
      this.emit({ type: 'complete', uploaded: progress.uploaded, failed: progress.failed })
      return { uploaded: progress.uploaded, failed: progress.failed }
    } finally {
      this.isRunning = false
    }
  }

  private async uploadOne(photo: Photo, inspection: Inspection): Promise<boolean> {
    if (!photo.data) {
      await db.photos.update(photo.id, { upload_status: 'failed' })
      this.emit({ type: 'photo_failed', photo_id: photo.id, error: 'Missing photo bytes.' })
      return false
    }

    await db.photos.update(photo.id, { upload_status: 'uploading' })

    let lastError = 'Unknown upload error.'
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      if (attempt > 0) await sleep(BACKOFF_MS[attempt] ?? 4000)
      try {
        const result = await uploadToCloudinary({
          data: photo.data,
          mime_type: photo.mime_type || 'image/jpeg',
          folder: `property-inspection/${inspection.id}`,
          context: {
            section: photo.section_key,
            inspection_id: inspection.id,
            captured_at: photo.captured_at,
          },
        })
        await db.photos.update(photo.id, {
          upload_status: 'uploaded',
          cloudinary_url: result.secure_url,
        })
        this.emit({ type: 'photo_uploaded', photo_id: photo.id, secure_url: result.secure_url })
        return true
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err)
      }
    }

    await db.photos.update(photo.id, { upload_status: 'failed' })
    this.emit({ type: 'photo_failed', photo_id: photo.id, error: lastError })
    return false
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const inspectionSync = new InspectionSyncService()
