<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { sections } from '@/config/sections'
import type { SectionKey } from '@/types'
import { useInspectionStore } from '@/stores/inspection'
import InspectionSection from '@/components/InspectionSection.vue'

const router = useRouter()
const store = useInspectionStore()
const { inspection, photosBySection, isLoading, syncProgress, submitError } = storeToRefs(store)

// Test mode bypasses all required-field validation so we can exercise the
// submit/sync flow without filling out the whole form. Flip the Netlify env
// var (or use ?test=1 in the URL) to disable validation; remove it later.
const bypassRequired =
  import.meta.env.VITE_BYPASS_REQUIRED === 'true' ||
  new URLSearchParams(window.location.search).get('test') === '1'

onMounted(async () => {
  await store.loadOrStartDraft()
})

const requiredSectionsMissing = computed(() => {
  if (bypassRequired) return []
  return sections.filter(
    (s) => s.required && (photosBySection.value[s.key]?.length ?? 0) < s.minPhotos,
  )
})

const canSubmit = computed(() => {
  const data = inspection.value
  if (!data) return false
  if (bypassRequired) return true
  return (
    data.inspector_name.trim() !== '' &&
    data.property_address.trim() !== '' &&
    data.inspection_date !== '' &&
    requiredSectionsMissing.value.length === 0
  )
})

function updateField(field: 'inspector_name' | 'property_address' | 'inspection_date', value: string) {
  store.updateMetadata({ [field]: value })
}

async function handleAddPhoto(key: SectionKey, file: File) {
  try {
    await store.addPhotoFromFile(key, file)
  } catch (err) {
    console.error('Failed to add photo:', err)
  }
}

function handleRemovePhoto(photoId: string) {
  store.removePhoto(photoId)
}

const isSubmitting = computed(() => syncProgress.value?.in_progress === true)
const isSynced = computed(() => inspection.value?.status === 'synced')
const buildVersion = __BUILD_VERSION__

async function handleSubmit() {
  try {
    await store.submitInspection()
  } catch (err) {
    console.error('Submit failed:', err)
  }
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
      <p v-if="bypassRequired" class="inspection__test-mode" role="status">
        TEST MODE — all fields and photos are optional
      </p>
      <p class="inspection__build">Build: {{ buildVersion }}</p>
    </header>

    <p v-if="isLoading && !inspection" class="inspection__loading">Loading…</p>

    <template v-else-if="inspection">
      <section class="inspection__metadata">
        <label class="field">
          <span class="field__label">
            Your Name <span class="field__required">*</span>
          </span>
          <input
            :value="inspection.inspector_name"
            class="field__input"
            type="text"
            autocomplete="name"
            required
            @input="updateField('inspector_name', ($event.target as HTMLInputElement).value)"
          />
        </label>

        <label class="field">
          <span class="field__label">
            Property Address <span class="field__required">*</span>
          </span>
          <input
            :value="inspection.property_address"
            class="field__input"
            type="text"
            autocomplete="street-address"
            required
            @input="updateField('property_address', ($event.target as HTMLInputElement).value)"
          />
        </label>

        <label class="field">
          <span class="field__label">
            Date <span class="field__required">*</span>
          </span>
          <input
            :value="inspection.inspection_date"
            class="field__input"
            type="date"
            required
            @input="updateField('inspection_date', ($event.target as HTMLInputElement).value)"
          />
        </label>
      </section>

      <section class="inspection__sections">
        <InspectionSection
          v-for="section in sections"
          :key="section.key"
          :section="section"
          :photos="photosBySection[section.key] ?? []"
          @add-photo="(file) => handleAddPhoto(section.key, file)"
          @remove-photo="handleRemovePhoto"
        />
      </section>

      <footer class="inspection__footer">
        <p v-if="requiredSectionsMissing.length > 0" class="inspection__missing">
          {{ requiredSectionsMissing.length }} required section{{
            requiredSectionsMissing.length === 1 ? '' : 's'
          }}
          still need photos.
        </p>

        <div v-if="syncProgress" class="inspection__sync">
          <div class="inspection__sync-row">
            <span>
              Uploading photos… {{ syncProgress.uploaded }} of {{ syncProgress.total }}
              <span v-if="syncProgress.failed > 0" class="inspection__sync-failed">
                · {{ syncProgress.failed }} failed
              </span>
            </span>
          </div>
          <div class="inspection__sync-bar" aria-hidden="true">
            <div
              class="inspection__sync-bar-fill"
              :style="{
                width: `${
                  syncProgress.total === 0
                    ? 0
                    : ((syncProgress.uploaded + syncProgress.failed) / syncProgress.total) * 100
                }%`,
              }"
            />
          </div>
        </div>

        <p v-if="submitError" class="inspection__submit-error" role="alert">{{ submitError }}</p>

        <p v-if="isSynced" class="inspection__synced" role="status">
          Inspection submitted. All photos uploaded.
        </p>

        <button
          class="inspection__submit"
          type="button"
          :disabled="!canSubmit || isSubmitting"
          @click="handleSubmit"
        >
          <span v-if="isSubmitting">Submitting…</span>
          <span v-else-if="isSynced">Submitted ✓</span>
          <span v-else-if="submitError">Retry Submit</span>
          <span v-else>Submit Inspection</span>
        </button>
      </footer>
    </template>
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

.inspection__test-mode {
  margin: var(--space-3) 0 0;
  padding: var(--space-2) var(--space-3);
  background-color: #fde68a;
  color: #78350f;
  border-radius: var(--radius-md);
  font-size: 0.8125rem;
  font-weight: 600;
  text-align: center;
  letter-spacing: 0.04em;
}

.inspection__loading {
  text-align: center;
  color: var(--color-text-muted);
  padding: var(--space-6) 0;
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

.inspection__sync {
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-3);
}

.inspection__sync-row {
  font-size: 0.875rem;
  color: var(--color-text);
  margin-bottom: var(--space-2);
}

.inspection__sync-failed {
  color: var(--color-danger);
}

.inspection__sync-bar {
  width: 100%;
  height: 6px;
  background-color: var(--color-border);
  border-radius: 999px;
  overflow: hidden;
}

.inspection__sync-bar-fill {
  height: 100%;
  background-color: var(--color-accent);
  transition: width 0.2s ease;
}

.inspection__submit-error {
  margin: 0;
  padding: var(--space-3);
  background-color: #fee2e2;
  color: #991b1b;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
}

.inspection__synced {
  margin: 0;
  padding: var(--space-3);
  background-color: #dcfce7;
  color: #166534;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  text-align: center;
}

.inspection__build {
  margin: var(--space-2) 0 0;
  font-size: 0.6875rem;
  color: var(--color-text-muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
</style>
