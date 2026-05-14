<script setup lang="ts">
import { computed } from 'vue'
import type { SectionConfig } from '@/types'

interface Props {
  section: SectionConfig
  photoCount: number
}

const props = defineProps<Props>()

const isComplete = computed(() => props.photoCount >= props.section.minPhotos)
const isFull = computed(() => props.photoCount >= props.section.maxPhotos)

const status = computed(() => {
  if (isComplete.value) return 'complete'
  if (props.photoCount > 0) return 'partial'
  return 'empty'
})

defineEmits<{
  'add-photo': []
}>()
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

    <div class="section__photos" aria-live="polite">
      <p v-if="photoCount === 0" class="section__empty">No photos yet.</p>
      <!-- Photo thumbnails will be rendered here once capture is wired up -->
    </div>

    <button
      class="section__capture"
      type="button"
      :disabled="isFull"
      @click="$emit('add-photo')"
    >
      <span v-if="isFull">Maximum photos reached</span>
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

.section__photos {
  min-height: 24px;
  margin-bottom: var(--space-3);
}

.section__empty {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-text-muted);
  font-style: italic;
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
