import { db } from '@/db'
import { uploadToCloudinary, uploadVideoToCloudinary } from '@/utils/cloudinary'
import type { Inspection, Photo, Walkthrough } from '@/types'

const MAX_ATTEMPTS = 3
const BACKOFF_MS = [0, 1500, 4000]
const UPLOAD_CONCURRENCY = 5
const WALKTHROUGH_MAX_ATTEMPTS = 2

export interface SyncProgress {
  total: number
  uploaded: number
  failed: number
  in_progress: boolean
}

export interface WalkthroughProgress {
  uploaded_bytes: number
  total_bytes: number
  in_progress: boolean
}

export type SyncEvent =
  | { type: 'progress'; progress: SyncProgress }
  | { type: 'photo_uploaded'; photo_id: string; secure_url: string }
  | { type: 'photo_failed'; photo_id: string; error: string }
  | { type: 'complete'; uploaded: number; failed: number }
  | { type: 'walkthrough_progress'; progress: WalkthroughProgress }
  | { type: 'walkthrough_uploaded'; secure_url: string; public_id: string }
  | { type: 'walkthrough_failed'; error: string }

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

      // Upload with bounded concurrency so 100-photo inspections don't take
      // 100× single-photo latency. Cloudinary's free tier handles ~5 parallel
      // uploads from one client comfortably; higher tends to throttle.
      let cursor = 0
      const worker = async () => {
        while (true) {
          const index = cursor
          cursor += 1
          if (index >= pending.length) return
          const ok = await this.uploadOne(pending[index], inspection)
          if (ok) progress.uploaded += 1
          else progress.failed += 1
          this.emit({ type: 'progress', progress: { ...progress } })
        }
      }
      const workerCount = Math.min(UPLOAD_CONCURRENCY, pending.length)
      await Promise.all(Array.from({ length: workerCount }, () => worker()))

      progress.in_progress = false
      // Emit one final progress event so listeners can drop the spinner. Without
      // this, syncProgress.in_progress stays true and the Submit button is
      // stuck on "Submitting…" even though the inspection is already synced.
      this.emit({ type: 'progress', progress: { ...progress } })
      this.emit({ type: 'complete', uploaded: progress.uploaded, failed: progress.failed })
      return { uploaded: progress.uploaded, failed: progress.failed }
    } finally {
      this.isRunning = false
    }
  }

  async uploadWalkthrough(
    inspection: Inspection,
  ): Promise<{ uploaded: boolean; error?: string }> {
    const record = await db.walkthroughs.get(inspection.id)
    if (!record) {
      return { uploaded: false, error: 'No walkthrough video found for this inspection.' }
    }
    if (record.upload_status === 'uploaded' && record.cloudinary_url) {
      // Already uploaded — idempotent retry shortcut.
      this.emit({
        type: 'walkthrough_uploaded',
        secure_url: record.cloudinary_url,
        public_id: record.cloudinary_public_id || '',
      })
      return { uploaded: true }
    }
    if (!record.data) {
      await db.walkthroughs.update(inspection.id, { upload_status: 'failed' })
      this.emit({ type: 'walkthrough_failed', error: 'Walkthrough video bytes are missing.' })
      return { uploaded: false, error: 'Walkthrough video bytes are missing.' }
    }

    await db.walkthroughs.update(inspection.id, { upload_status: 'uploading' })
    const total = record.data.byteLength
    this.emit({
      type: 'walkthrough_progress',
      progress: { uploaded_bytes: 0, total_bytes: total, in_progress: true },
    })

    let lastError = 'Unknown walkthrough upload error.'
    for (let attempt = 0; attempt < WALKTHROUGH_MAX_ATTEMPTS; attempt += 1) {
      if (attempt > 0) await sleep(BACKOFF_MS[attempt] ?? 4000)
      try {
        const result = await uploadVideoToCloudinary({
          data: record.data,
          mime_type: record.mime_type || 'video/mp4',
          folder: `property-inspection/${inspection.id}`,
          context: {
            kind: 'walkthrough',
            inspection_id: inspection.id,
            captured_at: record.captured_at,
          },
          onProgress: (uploaded, total) => {
            this.emit({
              type: 'walkthrough_progress',
              progress: { uploaded_bytes: uploaded, total_bytes: total, in_progress: true },
            })
          },
        })
        await db.walkthroughs.update(inspection.id, {
          upload_status: 'uploaded',
          cloudinary_url: result.secure_url,
          cloudinary_public_id: result.public_id,
        })
        this.emit({
          type: 'walkthrough_progress',
          progress: { uploaded_bytes: total, total_bytes: total, in_progress: false },
        })
        this.emit({
          type: 'walkthrough_uploaded',
          secure_url: result.secure_url,
          public_id: result.public_id,
        })
        return { uploaded: true }
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err)
      }
    }

    await db.walkthroughs.update(inspection.id, { upload_status: 'failed' })
    this.emit({
      type: 'walkthrough_progress',
      progress: { uploaded_bytes: 0, total_bytes: total, in_progress: false },
    })
    this.emit({ type: 'walkthrough_failed', error: lastError })
    return { uploaded: false, error: lastError }
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
