import { defineStore } from 'pinia'
import { computed, ref, toRaw } from 'vue'
import { db } from '@/db'
import { sections } from '@/config/sections'
import { newUuid } from '@/utils/uuid'
import { resizePhoto } from '@/utils/photo'
import { inspectionSync, type SyncProgress } from '@/services/sync'
import { submitInspectionToApi, inspectionApiConfigured } from '@/services/api'
import { cloudinaryConfigured } from '@/utils/cloudinary'
import type { Inspection, Photo, SectionKey } from '@/types'

const emptyPhotosBySection = () =>
  Object.fromEntries(sections.map((s) => [s.key, [] as string[]])) as Record<SectionKey, string[]>

const todayIsoDate = () => new Date().toISOString().slice(0, 10)
const nowIso = () => new Date().toISOString()

// iOS Safari rejects Vue reactive proxies when IndexedDB tries to structured-
// clone them ("DataCloneError: the object can not be cloned"). The Inspection
// shape has no binary data, so a JSON round-trip is the cheapest way to drop
// every layer of reactivity before persisting.
const plainInspection = (record: Inspection): Inspection =>
  JSON.parse(JSON.stringify(toRaw(record))) as Inspection

export const useInspectionStore = defineStore('inspection', () => {
  const inspection = ref<Inspection | null>(null)
  const photos = ref<Photo[]>([])
  const isLoading = ref(false)
  const syncProgress = ref<SyncProgress | null>(null)
  const submitError = ref<string | null>(null)

  const photosBySection = computed<Record<SectionKey, Photo[]>>(() => {
    const grouped = Object.fromEntries(
      sections.map((s) => [s.key, [] as Photo[]]),
    ) as Record<SectionKey, Photo[]>

    for (const photo of photos.value) {
      grouped[photo.section_key]?.push(photo)
    }
    return grouped
  })

  async function startNewInspection() {
    isLoading.value = true
    try {
      const id = newUuid()
      const now = nowIso()
      const draft: Inspection = {
        id,
        inspector_name: '',
        property_address: '',
        inspection_date: todayIsoDate(),
        status: 'draft',
        photos_by_section: emptyPhotosBySection(),
        created_at: now,
        updated_at: now,
      }
      await db.inspections.put(plainInspection(draft))
      inspection.value = draft
      photos.value = []
    } finally {
      isLoading.value = false
    }
  }

  async function loadInspection(id: string) {
    isLoading.value = true
    try {
      const record = await db.inspections.get(id)
      if (!record) {
        inspection.value = null
        photos.value = []
        return
      }
      inspection.value = record
      photos.value = await db.photos.where('inspection_id').equals(id).toArray()
    } finally {
      isLoading.value = false
    }
  }

  async function loadOrStartDraft() {
    const existingDraft = await db.inspections
      .where('status')
      .equals('draft')
      .reverse()
      .sortBy('updated_at')
      .then((rows) => rows[0])

    if (existingDraft) {
      await loadInspection(existingDraft.id)
    } else {
      await startNewInspection()
    }
  }

  async function updateMetadata(patch: Partial<Pick<Inspection, 'inspector_name' | 'property_address' | 'inspection_date'>>) {
    if (!inspection.value) return
    const updated: Inspection = {
      ...inspection.value,
      ...patch,
      updated_at: nowIso(),
    }
    inspection.value = updated
    await db.inspections.put(plainInspection(updated))
  }

  async function addPhotoFromFile(sectionKey: SectionKey, file: File): Promise<void> {
    if (!inspection.value) {
      throw new Error('Cannot add a photo before an inspection is loaded.')
    }
    const { data, mime_type } = await resizePhoto(file)

    const photo: Photo = {
      id: newUuid(),
      inspection_id: inspection.value.id,
      section_key: sectionKey,
      data,
      mime_type,
      upload_status: 'pending',
      captured_at: nowIso(),
    }

    await db.photos.put(photo)
    photos.value = [...photos.value, photo]

    inspection.value.photos_by_section[sectionKey] = [
      ...inspection.value.photos_by_section[sectionKey],
      photo.id,
    ]
    inspection.value.updated_at = nowIso()
    await db.inspections.put(plainInspection(inspection.value))
  }

  async function removePhoto(photoId: string) {
    if (!inspection.value) return
    const photo = photos.value.find((p) => p.id === photoId)
    if (!photo) return

    await db.photos.delete(photoId)
    photos.value = photos.value.filter((p) => p.id !== photoId)

    const sectionKey = photo.section_key
    inspection.value.photos_by_section[sectionKey] = inspection.value.photos_by_section[
      sectionKey
    ].filter((id) => id !== photoId)
    inspection.value.updated_at = nowIso()
    await db.inspections.put(plainInspection(inspection.value))
  }

  async function submitInspection(): Promise<boolean> {
    if (!inspection.value) return false
    submitError.value = null

    if (!cloudinaryConfigured()) {
      submitError.value = 'Photo storage is not configured yet. Add Cloudinary credentials.'
      return false
    }

    const inspection_record = inspection.value
    await setStatus('syncing')

    const unsubscribe = inspectionSync.on((event) => {
      if (event.type === 'progress') {
        syncProgress.value = { ...event.progress }
      }
      if (event.type === 'photo_uploaded' || event.type === 'photo_failed') {
        const index = photos.value.findIndex((p) => p.id === event.photo_id)
        if (index !== -1) {
          const next: Photo = { ...photos.value[index] }
          if (event.type === 'photo_uploaded') {
            next.upload_status = 'uploaded'
            next.cloudinary_url = event.secure_url
          } else {
            next.upload_status = 'failed'
          }
          photos.value = [
            ...photos.value.slice(0, index),
            next,
            ...photos.value.slice(index + 1),
          ]
        }
      }
    })

    try {
      const { failed } = await inspectionSync.uploadPendingPhotos(inspection_record)
      if (failed > 0) {
        submitError.value = `${failed} photo${failed === 1 ? '' : 's'} failed to upload. Tap submit again to retry.`
        await setStatus('failed')
        return false
      }

      if (inspectionApiConfigured()) {
        const uploadedPhotos = await db.photos
          .where('inspection_id')
          .equals(inspection_record.id)
          .toArray()
        await submitInspectionToApi(inspection_record, uploadedPhotos)
      }

      await setStatus('synced')
      return true
    } catch (err) {
      submitError.value = err instanceof Error ? err.message : 'Sync failed.'
      await setStatus('failed')
      return false
    } finally {
      unsubscribe()
    }
  }

  async function setStatus(status: Inspection['status']) {
    if (!inspection.value) return
    const updated: Inspection = {
      ...inspection.value,
      status,
      updated_at: nowIso(),
    }
    inspection.value = updated
    await db.inspections.put(plainInspection(updated))
  }

  return {
    inspection,
    photos,
    photosBySection,
    isLoading,
    syncProgress,
    submitError,
    startNewInspection,
    loadInspection,
    loadOrStartDraft,
    updateMetadata,
    addPhotoFromFile,
    removePhoto,
    submitInspection,
  }
})
