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
      path: '/inspection/new',
      name: 'inspection-new',
      component: () => import('@/views/InspectionView.vue'),
    },
  ],
})

export default router
