import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'main', component: () => import('@/views/GameScene.vue') },
  // The art pipeline's three dev screens. DEV ONLY — the bench exists to get the
  // procedural cast out to be painted and writes into the repo through a
  // serve-only endpoint; the playground exists to check what came back against the
  // drawing it replaces; the bug lab is the design bench for the bestiary. None
  // belongs in a portal build, and the `import.meta.env.DEV` guard lets Rollup
  // drop all three chunks entirely.
  ...(import.meta.env.DEV
    ? [
      { path: '/art-sheets', name: 'art-sheets', component: () => import('@/views/ArtSheets.vue') },
      { path: '/playground', name: 'playground', component: () => import('@/views/Playground.vue') },
      { path: '/bug-lab', name: 'bug-lab', component: () => import('@/views/BugLab.vue') }
    ]
    : []),
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes
})

export default router
