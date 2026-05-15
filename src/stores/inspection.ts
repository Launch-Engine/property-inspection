import { defineStore } from 'pinia'
import { computed, ref, toRaw } from 'vue'
import { db } from '@/db'
import { sections } from '@/config/sections'
import { newUuid } from '@/utils/uuid'
import { resizePhoto } from '@/utils/photo'
import { validateVideo, type VideoValidationResult } from '@/utils/video'
import { inspectionSync, type SyncProgress, type WalkthroughProgress } from '@/services/sync'
import { submitInspectionToApi, inspectionApiConfigured } from '@/services/api'
import { cloudinaryConfigured } from '@/utils/cloudinary'
import type { Inspection, Photo, SectionKey, Walkthrough } from '@/types'

const emptyPhotosBySection = () =>
  Object.fromEntries(sections.map((s) => [s.key, [] as string[]])) as Record<SectionKey, string[]>

const emptyCommentsBySection = () =>
  Object.fromEntries(sections.map((s) => [s.key, ''])) as Record<SectionKey, string>

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
  const walkthrough = ref<Walkthrough | null>(null)
  const isLoading = ref(false)
  const syncProgress = ref<SyncProgress | null>(null)
  const walkthroughProgress = ref<WalkthroughProgress | null>(null)
  const submitError = ref<string | null>(null)
  // Tracks the entire submitInspection() lifetime — covers the gap between
  // Cloudinary upload finishing (syncProgress.in_progress flips false) and the
  // /api/inspections call returning, which is where a double-tap previously
  // created duplicate Monday items.
  const isSubmitting = ref(false)

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
        comments_by_section: emptyCommentsBySection(),
        has_walkthrough: false,
        created_at: now,
        updated_at: now,
      }
      await db.inspections.put(plainInspection(draft))
      inspection.value = draft
      photos.value = []
      walkthrough.value = null
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
      // Back-fill comments_by_section for drafts saved before the field
      // existed so the form always has a writable string per section.
      if (!record.comments_by_section) {
        record.comments_by_section = emptyCommentsBySection()
      }
      // Back-fill has_walkthrough for drafts saved before the v3 schema bump.
      if (typeof record.has_walkthrough !== 'boolean') {
        record.has_walkthrough = false
      }
      inspection.value = record
      photos.value = await db.photos.where('inspection_id').equals(id).toArray()
      walkthrough.value = (await db.walkthroughs.get(id)) ?? null
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

  async function updateSectionComment(sectionKey: SectionKey, comment: string) {
    if (!inspection.value) return
    inspection.value.comments_by_section[sectionKey] = comment
    inspection.value.updated_at = nowIso()
    await db.inspections.put(plainInspection(inspection.value))
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

  async function seedTestPhotos(count: number): Promise<number> {
    if (!inspection.value) {
      throw new Error('No active inspection to seed.')
    }
    const sourcePhoto = photos.value.find((p) => p.data)
    if (!sourcePhoto || !sourcePhoto.data) {
      throw new Error('Take at least one real photo first — seeding clones its bytes.')
    }

    const sectionKeys = sections.map((s) => s.key)
    const created: Photo[] = []
    for (let i = 0; i < count; i += 1) {
      const sectionKey = sectionKeys[i % sectionKeys.length]
      const clonedData = sourcePhoto.data.slice(0)
      created.push({
        id: newUuid(),
        inspection_id: inspection.value.id,
        section_key: sectionKey,
        data: clonedData,
        mime_type: sourcePhoto.mime_type,
        upload_status: 'pending',
        captured_at: nowIso(),
      })
    }

    await db.photos.bulkPut(created)
    photos.value = [...photos.value, ...created]

    for (const photo of created) {
      inspection.value.photos_by_section[photo.section_key] = [
        ...inspection.value.photos_by_section[photo.section_key],
        photo.id,
      ]
    }
    inspection.value.updated_at = nowIso()
    await db.inspections.put(plainInspection(inspection.value))
    return created.length
  }

  async function setWalkthroughFromFile(file: File): Promise<VideoValidationResult> {
    if (!inspection.value) {
      throw new Error('Cannot record a walkthrough before an inspection is loaded.')
    }
    const validation = await validateVideo(file)
    if (!validation.ok) return validation

    const buffer = await file.arrayBuffer()
    const record: Walkthrough = {
      inspection_id: inspection.value.id,
      data: buffer,
      mime_type: file.type || 'video/mp4',
      duration_seconds: validation.duration,
      upload_status: 'pending',
      captured_at: nowIso(),
    }

    await db.walkthroughs.put(record)
    walkthrough.value = record

    inspection.value.has_walkthrough = true
    inspection.value.updated_at = nowIso()
    await db.inspections.put(plainInspection(inspection.value))

    return validation
  }

  async function removeWalkthrough() {
    if (!inspection.value) return
    await db.walkthroughs.delete(inspection.value.id)
    walkthrough.value = null
    walkthroughProgress.value = null
    inspection.value.has_walkthrough = false
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
    if (isSubmitting.value) return false
    isSubmitting.value = true
    submitError.value = null

    if (!cloudinaryConfigured()) {
      submitError.value = 'Photo storage is not configured yet. Add Cloudinary credentials.'
      isSubmitting.value = false
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
      if (event.type === 'walkthrough_progress') {
        walkthroughProgress.value = { ...event.progress }
      }
      if (event.type === 'walkthrough_uploaded' && walkthrough.value) {
        walkthrough.value = {
          ...walkthrough.value,
          upload_status: 'uploaded',
          cloudinary_url: event.secure_url,
          cloudinary_public_id: event.public_id,
        }
      }
      if (event.type === 'walkthrough_failed' && walkthrough.value) {
        walkthrough.value = { ...walkthrough.value, upload_status: 'failed' }
      }
    })

    try {
      const { failed } = await inspectionSync.uploadPendingPhotos(inspection_record)
      if (failed > 0) {
        submitError.value = `${failed} photo${failed === 1 ? '' : 's'} failed to upload. Tap submit again to retry.`
        await setStatus('failed')
        return false
      }

      // Walkthrough video runs after photos so the inspector sees the photo
      // progress bar finish before the (typically slower) video upload starts.
      if (inspection_record.has_walkthrough) {
        const walkthroughResult = await inspectionSync.uploadWalkthrough(inspection_record)
        if (!walkthroughResult.uploaded) {
          submitError.value = walkthroughResult.error || 'Walkthrough video failed to upload. Tap submit again to retry.'
          await setStatus('failed')
          return false
        }
      }

      if (inspectionApiConfigured()) {
        const uploadedPhotos = await db.photos
          .where('inspection_id')
          .equals(inspection_record.id)
          .toArray()
        const uploadedWalkthrough = inspection_record.has_walkthrough
          ? await db.walkthroughs.get(inspection_record.id)
          : null
        await submitInspectionToApi(inspection_record, uploadedPhotos, uploadedWalkthrough ?? null)
      }

      await setStatus('synced')
      return true
    } catch (err) {
      submitError.value = err instanceof Error ? err.message : 'Sync failed.'
      await setStatus('failed')
      return false
    } finally {
      unsubscribe()
      isSubmitting.value = false
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
    walkthrough,
    isLoading,
    isSubmitting,
    syncProgress,
    walkthroughProgress,
    submitError,
    startNewInspection,
    loadInspection,
    loadOrStartDraft,
    updateMetadata,
    updateSectionComment,
    addPhotoFromFile,
    setWalkthroughFromFile,
    removeWalkthrough,
    seedTestPhotos,
    removePhoto,
    submitInspection,
  }
})
