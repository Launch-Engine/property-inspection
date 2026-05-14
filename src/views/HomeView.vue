<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

function startInspection() {
  router.push({ name: 'inspection-new' })
}
</script>

<template>
  <main class="home">
    <header class="home__header">
      <h1 class="home__title">Property Inspection</h1>
      <p class="home__subtitle">Mobile inspection walkthrough</p>
    </header>

    <section class="home__actions">
      <button class="home__cta" type="button" @click="startInspection">
        Start New Inspection
      </button>
    </section>
  </main>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-6) var(--space-4);
  min-height: 100dvh;
  text-align: center;
}

.home__header {
  margin-bottom: var(--space-6);
}

.home__title {
  font-size: 1.75rem;
  font-weight: 700;
  margin: 0 0 var(--space-2);
  color: var(--color-text);
}

.home__subtitle {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 1rem;
}

.home__actions {
  width: 100%;
  max-width: 360px;
}

.home__cta {
  width: 100%;
  background-color: var(--color-primary);
  color: white;
  border: none;
  padding: var(--space-4) var(--space-5);
  font-size: 1rem;
  font-weight: 600;
  border-radius: var(--radius-md);
  transition: background-color 0.15s ease;
}

.home__cta:hover,
.home__cta:focus-visible {
  background-color: var(--color-primary-hover);
}
</style>
