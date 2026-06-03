<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { sections } from '@/config/sections'
import type { SectionKey } from '@/types'
import { useInspectionStore } from '@/stores/inspection'
import { loadInspectionContext } from '@/services/api'
import InspectionSection from '@/components/InspectionSection.vue'
import WalkthroughCapture from '@/components/WalkthroughCapture.vue'

const router = useRouter()
const route = useRoute()
const store = useInspectionStore()
const {
  inspection,
  photosBySection,
  walkthrough,
  isLoading,
  isSubmitting,
  isSavingForLater,
  syncProgress,
  walkthroughProgress,
  submitError,
  saveError,
} = storeToRefs(store)

// Test mode bypasses both required-field validation AND the requirement that
// the inspection arrive with a Monday item ID. Flip via Netlify env var or
// add ?test=1 to the URL.
const bypassRequired =
  import.meta.env.VITE_BYPASS_REQUIRED === 'true' ||
  (typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('test') === '1')

const contextError = ref<string | null>(null)
const alreadySubmitted = ref(false)
const mondayItemId = computed(() => {
  const raw = route.query.item
  if (typeof raw === 'string' && /^\d+$/.test(raw)) return raw
  if (Array.isArray(raw)) {
    const first = raw[0]
    if (typeof first === 'string' && /^\d+$/.test(first)) return first
  }
  return null
})

onMounted(async () => {
  const itemId = mondayItemId.value
  if (itemId) {
    try {
      const context = await loadInspectionContext(itemId)
      if (context.already_submitted) {
        alreadySubmitted.value = true
      }
      await store.loadOrStartForMondayItem(itemId, {
        property_address: context.property_address,
        inspector_name: context.inspector_name ?? undefined,
        inspection_date: context.inspection_date ?? undefined,
      })
      return
    } catch (err) {
      contextError.value =
        err instanceof Error
          ? err.message
          : 'Could not load this inspection from the property management board.'
      return
    }
  }

  if (bypassRequired) {
    // Internal test path: start an ad-hoc draft with no Monday item.
    await store.loadOrStartDraft()
    return
  }

  contextError.value =
    'This inspection link is missing an item ID. Please open the link your office sent you.'
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

function handleUpdateComment(key: SectionKey, value: string) {
  store.updateSectionComment(key, value)
}

const walkthroughError = ref<string | null>(null)

async function handleWalkthroughPick(file: File) {
  walkthroughError.value = null
  try {
    const result = await store.setWalkthroughFromFile(file)
    if (!result.ok) {
      walkthroughError.value = result.reason
    }
  } catch (err) {
    walkthroughError.value = err instanceof Error ? err.message : 'Could not save the walkthrough.'
  }
}

async function handleWalkthroughRemove() {
  walkthroughError.value = null
  await store.removeWalkthrough()
}

const isSynced = computed(() => inspection.value?.status === 'synced')
const buildVersion = __BUILD_VERSION__

async function handleSubmit() {
  try {
    await store.submitInspection()
  } catch (err) {
    console.error('Submit failed:', err)
  }
}

async function handleStartAnother() {
  await store.startNewInspection()
}

const propertyLocked = computed(() => Boolean(inspection.value?.monday_item_id))

// Set true after a successful Save for Later. Inspector sees the Saved card
// until they tap Continue (back to form) or Back to Home.
const wasSavedForLater = ref(false)
// Save button only makes sense when the inspection is tied to a Monday item.
// In TEST MODE without an item we hide it — there's nothing to save against.
const canSaveForLater = computed(() => Boolean(inspection.value?.monday_item_id))

async function handleSaveForLater() {
  const ok = await store.saveForLater()
  if (ok) {
    wasSavedForLater.value = true
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

function handleContinueAfterSave() {
  wasSavedForLater.value = false
}

const seedBusy = ref(false)
const seedMessage = ref<string | null>(null)

async function handleSeed100() {
  seedBusy.value = true
  seedMessage.value = null
  try {
    const added = await store.seedTestPhotos(100)
    seedMessage.value = `Seeded ${added} test photos.`
  } catch (err) {
    seedMessage.value = err instanceof Error ? err.message : 'Seeding failed.'
  } finally {
    seedBusy.value = false
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
      <img
        src="/cfl-logo.png"
        alt="Central Florida Property Management"
        class="inspection__logo"
      />
      <h1 class="inspection__title">Property Inspection</h1>
      <p class="inspection__intro">
        Capture 2-3 photos for each section. The walkthrough takes about 10-15 minutes.
      </p>
      <p v-if="bypassRequired" class="inspection__test-mode" role="status">
        TEST MODE — all fields and photos are optional
      </p>
      <p class="inspection__build">Build: {{ buildVersion }}</p>
    </header>

    <p v-if="isLoading && !inspection" class="inspection__loading">Loading…</p>

    <section v-else-if="contextError" class="inspection__notice" role="alert">
      <h2 class="inspection__notice-title">Inspection link required</h2>
      <p class="inspection__notice-body">{{ contextError }}</p>
      <button class="inspection__back" type="button" @click="handleCancel">
        Back to Home
      </button>
    </section>

    <section v-else-if="alreadySubmitted && !isSynced" class="inspection__notice" role="status">
      <h2 class="inspection__notice-title">Already submitted</h2>
      <p class="inspection__notice-body">
        This inspection has already been submitted. Contact your office if you need to make changes.
      </p>
      <button class="inspection__back" type="button" @click="handleCancel">
        Back to Home
      </button>
    </section>

    <section v-else-if="wasSavedForLater" class="inspection__success" role="status">
      <div class="inspection__success-check" aria-hidden="true">✓</div>
      <h2 class="inspection__success-title">Saved for Later</h2>
      <p class="inspection__success-body">
        Your inspection for {{ inspection?.property_address || 'this property' }} is saved.
        Open the link from your email again to pick up where you left off.
      </p>
      <div class="inspection__success-actions">
        <button class="inspection__submit" type="button" @click="handleContinueAfterSave">
          Continue Inspection
        </button>
        <button class="inspection__back" type="button" @click="handleCancel">
          Back to Home
        </button>
      </div>
    </section>

    <section v-else-if="isSynced" class="inspection__success" role="status">
      <div class="inspection__success-check" aria-hidden="true">✓</div>
      <h2 class="inspection__success-title">Inspection Submitted</h2>
      <p class="inspection__success-body">
        All photos uploaded. The report is being prepared for {{ inspection?.property_address || 'the property' }}.
      </p>
      <div class="inspection__success-actions">
        <button
          v-if="bypassRequired"
          class="inspection__submit"
          type="button"
          @click="handleStartAnother"
        >
          Start Another Test Inspection
        </button>
        <button class="inspection__back" type="button" @click="handleCancel">
          Back to Home
        </button>
      </div>
    </section>

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
            <span v-if="propertyLocked" class="field__locked-tag">from your assignment</span>
          </span>
          <input
            :value="inspection.property_address"
            class="field__input"
            :class="{ 'field__input--locked': propertyLocked }"
            type="text"
            autocomplete="street-address"
            required
            :readonly="propertyLocked"
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

      <WalkthroughCapture
        :walkthrough="walkthrough"
        :progress="walkthroughProgress"
        :disabled="isSubmitting"
        @pick="handleWalkthroughPick"
        @remove="handleWalkthroughRemove"
      />

      <p v-if="walkthroughError" class="inspection__walkthrough-error" role="alert">
        {{ walkthroughError }}
      </p>

      <section v-if="bypassRequired" class="inspection__seed">
        <button
          class="inspection__seed-button"
          type="button"
          :disabled="seedBusy"
          @click="handleSeed100"
        >
          {{ seedBusy ? 'Seeding…' : 'Seed 100 Test Photos (clones the first photo)' }}
        </button>
        <p v-if="seedMessage" class="inspection__seed-message">{{ seedMessage }}</p>
      </section>

      <section class="inspection__sections">
        <InspectionSection
          v-for="section in sections"
          :key="section.key"
          :section="section"
          :photos="photosBySection[section.key] ?? []"
          :comment="inspection.comments_by_section?.[section.key] ?? ''"
          @add-photo="(file) => handleAddPhoto(section.key, file)"
          @remove-photo="handleRemovePhoto"
          @update-comment="(value) => handleUpdateComment(section.key, value)"
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
        <p v-if="saveError" class="inspection__submit-error" role="alert">{{ saveError }}</p>

        <button
          v-if="canSaveForLater"
          class="inspection__save-later"
          type="button"
          :disabled="isSubmitting || isSavingForLater"
          @click="handleSaveForLater"
        >
          <span v-if="isSavingForLater">Saving…</span>
          <span v-else>Save for Later</span>
        </button>

        <button
          class="inspection__submit"
          type="button"
          :disabled="!canSubmit || isSubmitting || isSavingForLater"
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
  padding-top: calc(var(--space-4) + env(safe-area-inset-top));
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
  color: var(--color-brand);
  font-size: 0.9375rem;
  font-weight: 600;
  padding: var(--space-2) var(--space-2) var(--space-2) 0;
  margin: 0 0 var(--space-3) calc(var(--space-2) * -1);
  min-height: 40px;
  display: inline-flex;
  align-items: center;
}

.inspection__logo {
  max-width: 220px;
  width: 100%;
  height: auto;
  display: block;
  margin: 0 auto var(--space-3);
}

.inspection__title {
  font-size: 1.375rem;
  font-weight: 700;
  margin: 0 0 var(--space-2);
  color: var(--color-text);
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

.field__input--locked {
  background-color: var(--color-bg);
  color: var(--color-text-muted);
  cursor: not-allowed;
}

.field__locked-tag {
  display: inline-block;
  margin-left: var(--space-2);
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-brand);
}

.inspection__notice {
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-5) var(--space-4);
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  margin-top: var(--space-3);
}

.inspection__notice-title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--color-text);
}

.inspection__notice-body {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.9375rem;
  max-width: 360px;
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
  background-color: var(--color-brand);
  color: white;
  border: none;
  padding: var(--space-4);
  font-size: 1rem;
  font-weight: 600;
  border-radius: var(--radius-md);
  box-shadow: 0 4px 12px rgba(66, 147, 201, 0.25);
  transition: background-color 0.15s ease, transform 0.1s ease;
}

.inspection__submit:disabled {
  background-color: var(--color-border);
  color: var(--color-text-muted);
  cursor: not-allowed;
  box-shadow: none;
}

.inspection__submit:not(:disabled):hover {
  background-color: var(--color-brand-dark);
}

.inspection__submit:not(:disabled):active {
  transform: translateY(1px);
}

.inspection__save-later {
  width: 100%;
  background-color: transparent;
  color: var(--color-brand);
  border: 1.5px solid var(--color-brand);
  padding: var(--space-3) var(--space-4);
  font-size: 0.9375rem;
  font-weight: 600;
  border-radius: var(--radius-md);
  transition: background-color 0.15s ease, color 0.15s ease;
}

.inspection__save-later:disabled {
  border-color: var(--color-border);
  color: var(--color-text-muted);
  cursor: not-allowed;
}

.inspection__save-later:not(:disabled):hover {
  background-color: var(--color-brand);
  color: white;
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

.inspection__success {
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-6) var(--space-4);
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  margin-top: var(--space-4);
}

.inspection__success-check {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background-color: var(--color-success);
  color: white;
  font-size: 36px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.inspection__success-title {
  margin: 0;
  font-size: 1.375rem;
  font-weight: 700;
  color: var(--color-text);
}

.inspection__success-body {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.9375rem;
  max-width: 360px;
}

.inspection__success-actions {
  width: 100%;
  max-width: 360px;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-top: var(--space-3);
}

.inspection__build {
  margin: var(--space-2) 0 0;
  font-size: 0.6875rem;
  color: var(--color-text-muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.inspection__walkthrough-error {
  margin: 0 0 var(--space-3);
  padding: var(--space-2) var(--space-3);
  background-color: #fee2e2;
  color: #991b1b;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
}

.inspection__seed {
  margin-bottom: var(--space-4);
}

.inspection__seed-button {
  width: 100%;
  background-color: #fbbf24;
  color: #78350f;
  border: 1px dashed #92400e;
  padding: var(--space-3);
  font-size: 0.875rem;
  font-weight: 600;
  border-radius: var(--radius-md);
}

.inspection__seed-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.inspection__seed-message {
  margin: var(--space-2) 0 0;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  text-align: center;
}
</style>
