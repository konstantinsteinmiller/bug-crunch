import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'main', component: () => import('@/views/GameScene.vue') },
  // Design bench for the monster art direction. Lazy, so it costs a player who
  // never visits it nothing.
  { path: '/monsters', name: 'monsters', component: () => import('@/views/MonsterLab.vue') },
  // The art pipeline's two screens. DEV ONLY — the bench exists to get the
  // procedural cast out to be painted and writes into the repo through a
  // serve-only endpoint; the playground exists to check what came back against
  // the drawing it replaces. Neither belongs in a portal build, and the
  // `import.meta.env.DEV` guard lets Rollup drop both chunks entirely.
  ...(import.meta.env.DEV
    ? [
      { path: '/art-sheets', name: 'art-sheets', component: () => import('@/views/ArtSheets.vue') },
      { path: '/playground', name: 'playground', component: () => import('@/views/Playground.vue') }
    ]
    : []),
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes
})

export default router
