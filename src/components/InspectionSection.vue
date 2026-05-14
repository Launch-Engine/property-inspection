<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { Photo, SectionConfig } from '@/types'

interface Props {
  section: SectionConfig
  photos: Photo[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'add-photo': [file: File]
  'remove-photo': [photoId: string]
}>()

const fileInput = ref<HTMLInputElement | null>(null)
const isProcessing = ref(false)
const errorMessage = ref<string | null>(null)

const photoCount = computed(() => props.photos.length)
const isComplete = computed(() => photoCount.value >= props.section.minPhotos)
const isFull = computed(() => photoCount.value >= props.section.maxPhotos)
const status = computed(() => {
  if (isComplete.value) return 'complete'
  if (photoCount.value > 0) return 'partial'
  return 'empty'
})

// Per-photo object URL cache so the same blob doesn't get re-created on every render.
const objectUrls = new Map<string, string>()

interface PhotoTile {
  id: string
  url: string
  status: Photo['upload_status']
}

const photoUrls = computed<PhotoTile[]>(() => {
  return props.photos
    .map((photo): PhotoTile | null => {
      if (photo.cloudinary_url) {
        return { id: photo.id, url: photo.cloudinary_url, status: photo.upload_status }
      }
      if (!photo.data) return null
      let url = objectUrls.get(photo.id)
      if (!url) {
        const blob = new Blob([photo.data], { type: photo.mime_type || 'image/jpeg' })
        url = URL.createObjectURL(blob)
        objectUrls.set(photo.id, url)
      }
      return { id: photo.id, url, status: photo.upload_status }
    })
    .filter((p): p is PhotoTile => p !== null)
})

watch(
  () => props.photos.map((p) => p.id).join(','),
  (next) => {
    const currentIds = new Set(next.split(',').filter(Boolean))
    for (const [id, url] of objectUrls) {
      if (!currentIds.has(id)) {
        URL.revokeObjectURL(url)
        objectUrls.delete(id)
      }
    }
  },
)

onBeforeUnmount(() => {
  for (const url of objectUrls.values()) {
    URL.revokeObjectURL(url)
  }
  objectUrls.clear()
})

function openCamera() {
  fileInput.value?.click()
}

async function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  isProcessing.value = true
  errorMessage.value = null
  try {
    emit('add-photo', file)
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not save photo.'
  } finally {
    isProcessing.value = false
    target.value = ''
  }
}

function handleRemove(photoId: string) {
  emit('remove-photo', photoId)
}
</script>

<template>
  <article class="section" :class="`section--${status}`">
    <header class="section__header">
      <h2 class="section__title">
        {{ section.label }}
        <span v-if="section.required" class="section__required" aria-label="required">*</span>
      </h2>
      <p class="section__description">{{ section.description }}</p>
      <p class="section__limits">
        {{ photoCount }} / {{ section.maxPhotos }} photos
        <span v-if="section.minPhotos > 0" class="section__min">
          (minimum {{ section.minPhotos }})
        </span>
      </p>
    </header>

    <ul v-if="photoUrls.length > 0" class="section__gallery" aria-label="Captured photos">
      <li v-for="photo in photoUrls" :key="photo.id" class="section__thumb">
        <img :src="photo.url" alt="" class="section__thumb-img" />
        <span
          v-if="photo.status === 'uploading'"
          class="section__badge section__badge--uploading"
          aria-label="Uploading"
        >…</span>
        <span
          v-else-if="photo.status === 'uploaded'"
          class="section__badge section__badge--uploaded"
          aria-label="Uploaded"
        >✓</span>
        <span
          v-else-if="photo.status === 'failed'"
          class="section__badge section__badge--failed"
          aria-label="Upload failed"
        >!</span>
        <button
          v-if="photo.status !== 'uploading'"
          class="section__remove"
          type="button"
          aria-label="Remove photo"
          @click="handleRemove(photo.id)"
        >
          ×
        </button>
      </li>
    </ul>
    <p v-else class="section__empty">No photos yet.</p>

    <p v-if="errorMessage" class="section__error" role="alert">{{ errorMessage }}</p>

    <input
      ref="fileInput"
      class="section__file-input"
      type="file"
      accept="image/*"
      capture="environment"
      @change="handleFileChange"
    />

    <button
      class="section__capture"
      type="button"
      :disabled="isFull || isProcessing"
      @click="openCamera"
    >
      <span v-if="isProcessing">Saving photo…</span>
      <span v-else-if="isFull">Maximum photos reached</span>
      <span v-else-if="photoCount === 0">Take Photo</span>
      <span v-else>Add Another Photo</span>
    </button>
  </article>
</template>

<style scoped>
.section {
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  margin-bottom: var(--space-3);
}

.section--complete {
  border-color: var(--color-success);
}

.section__header {
  margin-bottom: var(--space-3);
}

.section__title {
  font-size: 1.0625rem;
  font-weight: 600;
  margin: 0 0 var(--space-1);
  color: var(--color-text);
}

.section__required {
  color: var(--color-danger);
  margin-left: 2px;
}

.section__description {
  margin: 0 0 var(--space-2);
  color: var(--color-text-muted);
  font-size: 0.9375rem;
}

.section__limits {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.section__min {
  opacity: 0.75;
}

.section__gallery {
  list-style: none;
  padding: 0;
  margin: 0 0 var(--space-3);
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: var(--space-2);
}

.section__thumb {
  position: relative;
  aspect-ratio: 1 / 1;
  border-radius: var(--radius-md);
  overflow: hidden;
  background-color: var(--color-bg);
}

.section__thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.section__remove {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: none;
  background-color: rgba(0, 0, 0, 0.65);
  color: white;
  font-size: 16px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.section__badge {
  position: absolute;
  bottom: 4px;
  left: 4px;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: white;
}

.section__badge--uploading {
  background-color: rgba(37, 99, 235, 0.9);
}

.section__badge--uploaded {
  background-color: rgba(22, 163, 74, 0.9);
}

.section__badge--failed {
  background-color: rgba(220, 38, 38, 0.95);
}

.section__empty {
  margin: 0 0 var(--space-3);
  font-size: 0.875rem;
  color: var(--color-text-muted);
  font-style: italic;
}

.section__error {
  margin: 0 0 var(--space-3);
  font-size: 0.875rem;
  color: var(--color-danger);
}

.section__file-input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.section__capture {
  width: 100%;
  background-color: var(--color-accent);
  color: white;
  border: none;
  padding: var(--space-3) var(--space-4);
  font-size: 0.9375rem;
  font-weight: 600;
  border-radius: var(--radius-md);
  transition: opacity 0.15s ease;
}

.section__capture:disabled {
  background-color: var(--color-border);
  color: var(--color-text-muted);
  cursor: not-allowed;
}

.section__capture:not(:disabled):hover,
.section__capture:not(:disabled):focus-visible {
  opacity: 0.92;
}
</style>
