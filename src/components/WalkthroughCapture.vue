<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { Walkthrough } from '@/types'
import type { WalkthroughProgress } from '@/services/sync'
import { extractFirstFrameJpeg, formatDuration, MAX_WALKTHROUGH_SECONDS } from '@/utils/video'

interface Props {
  walkthrough: Walkthrough | null
  progress: WalkthroughProgress | null
  disabled?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  pick: [file: File]
  remove: []
}>()

const fileInput = ref<HTMLInputElement | null>(null)
const thumbnailUrl = ref<string | null>(null)
const errorMessage = ref<string | null>(null)
const busy = ref(false)

const hasWalkthrough = computed(() => Boolean(props.walkthrough?.data || props.walkthrough?.cloudinary_url))
const durationLabel = computed(() => (props.walkthrough ? formatDuration(props.walkthrough.duration_seconds) : ''))

const uploadStatus = computed(() => props.walkthrough?.upload_status ?? 'pending')

const progressPercent = computed(() => {
  const p = props.progress
  if (!p || p.total_bytes === 0) return 0
  return Math.min(100, Math.round((p.uploaded_bytes / p.total_bytes) * 100))
})

function openRecorder() {
  errorMessage.value = null
  fileInput.value?.click()
}

async function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  target.value = ''
  if (!file) return

  busy.value = true
  errorMessage.value = null
  try {
    emit('pick', file)
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not save the walkthrough.'
  } finally {
    busy.value = false
  }
}

function handleRemove() {
  errorMessage.value = null
  emit('remove')
}

// Regenerate the thumbnail any time the underlying bytes change. We don't
// store the thumbnail in IndexedDB; it's cheap to extract on demand and keeps
// the storage footprint small.
watch(
  () => props.walkthrough?.captured_at ?? null,
  async () => {
    if (thumbnailUrl.value) {
      URL.revokeObjectURL(thumbnailUrl.value)
      thumbnailUrl.value = null
    }
    if (!props.walkthrough?.data) return
    const jpeg = await extractFirstFrameJpeg(
      new Blob([props.walkthrough.data], { type: props.walkthrough.mime_type || 'video/mp4' }),
    )
    if (jpeg) thumbnailUrl.value = URL.createObjectURL(jpeg)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (thumbnailUrl.value) URL.revokeObjectURL(thumbnailUrl.value)
})

defineExpose({ openRecorder })
</script>

<template>
  <article class="walkthrough">
    <header class="walkthrough__header">
      <h2 class="walkthrough__title">Walkthrough Video</h2>
      <p class="walkthrough__hint">
        Optional. One walkthrough video, 5 minutes or less.
      </p>
    </header>

    <div v-if="!hasWalkthrough" class="walkthrough__empty">
      <p class="walkthrough__empty-text">No walkthrough recorded yet.</p>
    </div>

    <div v-else class="walkthrough__preview">
      <div class="walkthrough__thumb-wrap">
        <img
          v-if="thumbnailUrl"
          :src="thumbnailUrl"
          alt=""
          class="walkthrough__thumb"
        />
        <div v-else class="walkthrough__thumb walkthrough__thumb--placeholder">
          ▶
        </div>
        <span class="walkthrough__duration">{{ durationLabel }}</span>
        <span
          v-if="uploadStatus === 'uploaded'"
          class="walkthrough__badge walkthrough__badge--uploaded"
          aria-label="Uploaded"
        >✓</span>
        <span
          v-else-if="uploadStatus === 'uploading'"
          class="walkthrough__badge walkthrough__badge--uploading"
          aria-label="Uploading"
        >…</span>
        <span
          v-else-if="uploadStatus === 'failed'"
          class="walkthrough__badge walkthrough__badge--failed"
          aria-label="Upload failed"
        >!</span>
      </div>

      <div v-if="progress && progress.total_bytes > 0" class="walkthrough__progress">
        <div class="walkthrough__progress-bar" aria-hidden="true">
          <div
            class="walkthrough__progress-fill"
            :style="{ width: `${progressPercent}%` }"
          />
        </div>
        <p class="walkthrough__progress-label">
          {{
            progress.in_progress
              ? `Uploading walkthrough… ${progressPercent}%`
              : uploadStatus === 'uploaded'
                ? 'Walkthrough uploaded.'
                : 'Walkthrough upload finished.'
          }}
        </p>
      </div>
    </div>

    <p v-if="errorMessage" class="walkthrough__error" role="alert">{{ errorMessage }}</p>

    <input
      ref="fileInput"
      class="walkthrough__file-input"
      type="file"
      accept="video/*"
      capture="environment"
      @change="handleFileChange"
    />

    <div class="walkthrough__actions">
      <button
        class="walkthrough__primary"
        type="button"
        :disabled="busy || disabled"
        @click="openRecorder"
      >
        <span v-if="busy">Saving…</span>
        <span v-else-if="hasWalkthrough">Replace Walkthrough</span>
        <span v-else>Record Walkthrough</span>
      </button>

      <button
        v-if="hasWalkthrough"
        class="walkthrough__secondary"
        type="button"
        :disabled="busy || disabled"
        @click="handleRemove"
      >
        Remove
      </button>
    </div>

    <p class="walkthrough__legal">
      Limit: {{ Math.floor(MAX_WALKTHROUGH_SECONDS / 60) }} min. Files longer than that will be rejected before upload.
    </p>
  </article>
</template>

<style scoped>
.walkthrough {
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  margin-bottom: var(--space-3);
}

.walkthrough__header {
  margin-bottom: var(--space-3);
}

.walkthrough__title {
  margin: 0 0 var(--space-1);
  font-size: 1.0625rem;
  font-weight: 600;
  color: var(--color-text);
}

.walkthrough__hint {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.walkthrough__empty {
  padding: var(--space-3) 0;
}

.walkthrough__empty-text {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-text-muted);
  font-style: italic;
}

.walkthrough__preview {
  margin-bottom: var(--space-3);
}

.walkthrough__thumb-wrap {
  position: relative;
  aspect-ratio: 16 / 9;
  width: 100%;
  max-width: 320px;
  border-radius: var(--radius-md);
  overflow: hidden;
  background-color: var(--color-bg);
}

.walkthrough__thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.walkthrough__thumb--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  color: var(--color-text-muted);
}

.walkthrough__duration {
  position: absolute;
  bottom: 6px;
  right: 6px;
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
}

.walkthrough__badge {
  position: absolute;
  top: 6px;
  left: 6px;
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

.walkthrough__badge--uploading {
  background-color: rgba(37, 99, 235, 0.9);
}

.walkthrough__badge--uploaded {
  background-color: rgba(22, 163, 74, 0.9);
}

.walkthrough__badge--failed {
  background-color: rgba(220, 38, 38, 0.95);
}

.walkthrough__progress {
  margin-top: var(--space-3);
}

.walkthrough__progress-bar {
  width: 100%;
  height: 6px;
  background-color: var(--color-border);
  border-radius: 999px;
  overflow: hidden;
}

.walkthrough__progress-fill {
  height: 100%;
  background-color: var(--color-brand);
  transition: width 0.2s ease;
}

.walkthrough__progress-label {
  margin: var(--space-1) 0 0;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.walkthrough__error {
  margin: 0 0 var(--space-3);
  font-size: 0.875rem;
  color: var(--color-danger);
}

.walkthrough__file-input {
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

.walkthrough__actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.walkthrough__primary {
  width: 100%;
  background-color: var(--color-brand);
  color: white;
  border: none;
  padding: var(--space-3) var(--space-4);
  font-size: 0.9375rem;
  font-weight: 600;
  border-radius: var(--radius-md);
  transition: background-color 0.15s ease, transform 0.1s ease;
}

.walkthrough__primary:disabled {
  background-color: var(--color-border);
  color: var(--color-text-muted);
  cursor: not-allowed;
}

.walkthrough__primary:not(:disabled):hover {
  background-color: var(--color-brand-dark);
}

.walkthrough__primary:not(:disabled):active {
  transform: translateY(1px);
}

.walkthrough__secondary {
  width: 100%;
  background: none;
  color: var(--color-danger);
  border: 1px solid var(--color-border);
  padding: var(--space-2) var(--space-4);
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: var(--radius-md);
}

.walkthrough__secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.walkthrough__legal {
  margin: 0;
  font-size: 0.75rem;
  color: var(--color-text-muted);
}
</style>
