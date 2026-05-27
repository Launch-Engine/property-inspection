<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

// TEST MODE escape hatch: when ?test=1 is present (or the global env var is set
// at build time) we still expose a way to start an inspection without a Monday
// item — useful for internal QA and one-off demos. Production traffic always
// arrives at /inspect?item={pulse_id} via the Make.com email link.
const bypassRequired = computed(
  () =>
    import.meta.env.VITE_BYPASS_REQUIRED === 'true' ||
    (typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('test') === '1'),
)

function startTestInspection() {
  router.push({ path: '/inspect', query: { test: '1' } })
}
</script>

<template>
  <main class="home">
    <div class="home__main">
      <header class="home__header">
        <img
          src="/cfl-logo.png"
          alt="Central Florida Property Management"
          class="home__logo"
        />
        <h1 class="home__title">Property Inspection</h1>
      </header>

      <section class="home__instructions">
        <p class="home__instructions-lead">
          Open the inspection link your office sent you to begin.
        </p>
        <p class="home__instructions-detail">
          Each inspection is tied to a specific property. Use the link from your
          email so the report goes back to the right assignment.
        </p>
      </section>

      <section v-if="bypassRequired" class="home__actions">
        <button class="home__cta" type="button" @click="startTestInspection">
          Start Test Inspection
        </button>
      </section>
    </div>

    <footer class="home__footer">
      <p class="home__footer-text">
        Central Florida Property Management ·
        <a class="home__footer-link" href="https://cflpropmanagement.com/" rel="noopener">
          cflpropmanagement.com
        </a>
      </p>
    </footer>
  </main>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-5) var(--space-4) calc(var(--space-5) + env(safe-area-inset-bottom));
  min-height: 100dvh;
  text-align: center;
  background: linear-gradient(180deg, #ffffff 0%, var(--color-bg) 100%);
}

.home__main {
  flex: 1;
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-5);
}

.home__header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
}

.home__logo {
  max-width: 280px;
  width: 100%;
  height: auto;
  display: block;
}

.home__title {
  font-size: 1.5rem;
  font-weight: 700;
  margin: var(--space-3) 0 0;
  color: var(--color-text);
  letter-spacing: -0.01em;
}

.home__instructions {
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: 100%;
}

.home__instructions-lead {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
}

.home__instructions-detail {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-text-muted);
  line-height: 1.45;
}

.home__actions {
  width: 100%;
  max-width: 360px;
}

.home__cta {
  width: 100%;
  background-color: var(--color-brand);
  color: white;
  border: none;
  padding: var(--space-4) var(--space-5);
  font-size: 1rem;
  font-weight: 600;
  border-radius: var(--radius-md);
  box-shadow: 0 4px 12px rgba(66, 147, 201, 0.25);
  transition: background-color 0.15s ease, transform 0.1s ease;
}

.home__cta:hover,
.home__cta:focus-visible {
  background-color: var(--color-brand-dark);
}

.home__cta:active {
  transform: translateY(1px);
}

.home__footer {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.home__footer-text {
  margin: 0;
}

.home__footer-link {
  color: var(--color-brand);
  text-decoration: none;
}

.home__footer-link:hover {
  text-decoration: underline;
}
</style>
