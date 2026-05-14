<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { sections } from '@/config/sections'
import type { SectionKey } from '@/types'
import InspectionSection from '@/components/InspectionSection.vue'

const router = useRouter()

const inspector_name = ref('')
const property_address = ref('')
const inspection_date = ref(new Date().toISOString().slice(0, 10))

// Placeholder for photo counts until photo capture + IndexedDB are wired up.
const photo_counts = reactive(
  Object.fromEntries(sections.map((s) => [s.key, 0])) as Record<SectionKey, number>,
)

const required_sections_missing = computed(() =>
  sections.filter((s) => s.required && photo_counts[s.key] < s.minPhotos),
)

const can_submit = computed(
  () =>
    inspector_name.value.trim() !== '' &&
    property_address.value.trim() !== '' &&
    inspection_date.value !== '' &&
    required_sections_missing.value.length === 0,
)

function handleAddPhoto(key: SectionKey) {
  // TODO(day 2): Open native camera via <input capture> and store blob in IndexedDB.
  photo_counts[key] += 1
}

function handleSubmit() {
  // TODO(day 3-4): Resize, upload to Cloudinary, POST to /inspections.
  alert('Submit flow not yet wired up.')
}

function handleCancel() {
  router.push({ name: 'home' })
}
</script>

<template>
  <main class="inspection">
    <header class="inspection__header">
      <button class="inspection__back" type="button" @click="handleCancel">
        ← Back
      </button>
      <h1 class="inspection__title">Property Inspection – Photo Walkthrough</h1>
      <p class="inspection__intro">
        For each section, take 2-3 photos using your phone camera. Should take about 10-15 minutes.
      </p>
    </header>

    <section class="inspection__metadata">
      <label class="field">
        <span class="field__label">
          Your Name <span class="field__required">*</span>
        </span>
        <input
          v-model="inspector_name"
          class="field__input"
          type="text"
          autocomplete="name"
          required
        />
      </label>

      <label class="field">
        <span class="field__label">
          Property Address <span class="field__required">*</span>
        </span>
        <input
          v-model="property_address"
          class="field__input"
          type="text"
          autocomplete="street-address"
          required
        />
      </label>

      <label class="field">
        <span class="field__label">
          Date <span class="field__required">*</span>
        </span>
        <input
          v-model="inspection_date"
          class="field__input"
          type="date"
          required
        />
      </label>
    </section>

    <section class="inspection__sections">
      <InspectionSection
        v-for="section in sections"
        :key="section.key"
        :section="section"
        :photo-count="photo_counts[section.key]"
        @add-photo="handleAddPhoto(section.key)"
      />
    </section>

    <footer class="inspection__footer">
      <p v-if="required_sections_missing.length > 0" class="inspection__missing">
        {{ required_sections_missing.length }} required section{{
          required_sections_missing.length === 1 ? '' : 's'
        }}
        still need photos.
      </p>

      <button
        class="inspection__submit"
        type="button"
        :disabled="!can_submit"
        @click="handleSubmit"
      >
        Submit Inspection
      </button>
    </footer>
  </main>
</template>

<style scoped>
.inspection {
  padding: var(--space-4);
  padding-bottom: calc(var(--space-6) + env(safe-area-inset-bottom));
  max-width: 720px;
  margin: 0 auto;
}

.inspection__header {
  margin-bottom: var(--space-5);
}

.inspection__back {
  background: none;
  border: none;
  color: var(--color-accent);
  font-size: 0.9375rem;
  padding: 0;
  margin-bottom: var(--space-3);
}

.inspection__title {
  font-size: 1.375rem;
  font-weight: 700;
  margin: 0 0 var(--space-2);
}

.inspection__intro {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.9375rem;
}

.inspection__metadata {
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  margin-bottom: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.field__label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text);
}

.field__required {
  color: var(--color-danger);
}

.field__input {
  width: 100%;
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background-color: var(--color-surface);
  color: var(--color-text);
  outline: none;
  transition: border-color 0.15s ease;
}

.field__input:focus {
  border-color: var(--color-accent);
}

.inspection__sections {
  margin-bottom: var(--space-5);
}

.inspection__footer {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.inspection__missing {
  margin: 0;
  padding: var(--space-3);
  background-color: #fef3c7;
  color: #92400e;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  text-align: center;
}

.inspection__submit {
  width: 100%;
  background-color: var(--color-primary);
  color: white;
  border: none;
  padding: var(--space-4);
  font-size: 1rem;
  font-weight: 600;
  border-radius: var(--radius-md);
  transition: background-color 0.15s ease;
}

.inspection__submit:disabled {
  background-color: var(--color-border);
  color: var(--color-text-muted);
  cursor: not-allowed;
}

.inspection__submit:not(:disabled):hover {
  background-color: var(--color-primary-hover);
}
</style>
