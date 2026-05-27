import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
    },
    {
      // Canonical entry point for board-initiated inspections. Make.com builds
      // links of the form /inspect?item={pulse_id} when the PM creates a row.
      path: '/inspect',
      name: 'inspect',
      component: () => import('@/views/InspectionView.vue'),
    },
    {
      // Legacy alias — keep so any saved drafts or shared links from the
      // inspector-initiated era still resolve. Behavior is identical.
      path: '/inspection/new',
      redirect: '/inspect',
    },
  ],
})

export default router
