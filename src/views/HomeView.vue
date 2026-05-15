<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

function startInspection() {
  router.push({ name: 'inspection-new' })
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

      <section class="home__actions">
        <button class="home__cta" type="button" @click="startInspection">
          Start New Inspection
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
  max-width: 360px;
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
