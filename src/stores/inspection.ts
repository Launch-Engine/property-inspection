import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { db } from '@/db'
import { sections } from '@/config/sections'
import { newUuid } from '@/utils/uuid'
import { resizePhoto } from '@/utils/photo'
import type { Inspection, Photo, SectionKey } from '@/types'

const emptyPhotosBySection = () =>
  Object.fromEntries(sections.map((s) => [s.key, [] as string[]])) as Record<SectionKey, string[]>

const todayIsoDate = () => new Date().toISOString().slice(0, 10)
const nowIso = () => new Date().toISOString()

export const useInspectionStore = defineStore('inspection', () => {
  const inspection = ref<Inspection | null>(null)
  const photos = ref<Photo[]>([])
  const isLoading = ref(false)

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
      await db.inspections.put(draft)
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
    await db.inspections.put(updated)
  }

  async function addPhotoFromFile(sectionKey: SectionKey, file: File): Promise<void> {
    if (!inspection.value) {
      throw new Error('Cannot add a photo before an inspection is loaded.')
    }
    const { blob } = await resizePhoto(file)

    const photo: Photo = {
      id: newUuid(),
      inspection_id: inspection.value.id,
      section_key: sectionKey,
      blob,
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
    await db.inspections.put(inspection.value)
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
    await db.inspections.put(inspection.value)
  }

  return {
    inspection,
    photos,
    photosBySection,
    isLoading,
    startNewInspection,
    loadInspection,
    loadOrStartDraft,
    updateMetadata,
    addPhotoFromFile,
    removePhoto,
  }
})
