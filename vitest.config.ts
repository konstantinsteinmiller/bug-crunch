import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import path from 'path'

// Stub for the `virtual:campaign-overrides` module that the production
// build provides via the `mawCampaignOverridesPlugin` in vite.config.ts.
// Tests don't run through that plugin, so any module that statically
// imports the virtual id (e.g. `useCustomStages.ts`) blows up at resolve
// time. This minimal plugin returns an empty overrides object — tests
// don't need real editor overrides.
const stubCampaignOverridesPlugin = () => ({
  name: 'stub-campaign-overrides',
  resolveId(id: string) {
    if (id === 'virtual:campaign-overrides') return '\0virtual:campaign-overrides'
    return null
  },
  load(id: string) {
    if (id === '\0virtual:campaign-overrides') return 'export default {}'
    return null
  }
})

// Same story for `virtual:leaderboard-snapshot`, which `leaderboardSnapshot.ts`
// imports statically.
//
// It stubs to `null` — a build with a LIVE endpoint — on purpose, so the
// existing leaderboard suite keeps asserting the real "no endpoint, no
// leaderboard" contract. The static-board specs mock `@/use/leaderboardSnapshot`
// itself to supply a board, which is why that module exists as a thin
// re-export rather than the virtual id being imported all over the app.
const stubLeaderboardSnapshotPlugin = () => ({
  name: 'stub-leaderboard-snapshot',
  resolveId(id: string) {
    if (id === 'virtual:leaderboard-snapshot') return '\0virtual:leaderboard-snapshot'
    return null
  },
  load(id: string) {
    if (id === '\0virtual:leaderboard-snapshot') return 'export default null'
    return null
  }
})

export default defineConfig({
  plugins: [vue(), stubCampaignOverridesPlugin(), stubLeaderboardSnapshotPlugin()],
  // Vite's production config (`vite.config.ts`) injects `APP_VERSION` at
  // build time via `define`. Vitest doesn't run that plugin, so any
  // module that reads `APP_VERSION` at import time (e.g. `useUser.ts`)
  // throws ReferenceError under tests. Mirror the define here so test
  // imports of those modules don't trip on a missing global.
  define: {
    APP_VERSION: JSON.stringify('test')
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    },
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.vue']
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/save/setup.ts'],
    // The suite's slowest tests are the ones that dynamically `import()` the
    // whole game model on their first assertion; with every file transforming
    // in parallel on a cold cache that import alone can exceed the 5 s default
    // and fail a test that is not actually slow. The work is transform time,
    // not test time, so the ceiling is raised rather than the tests split up.
    testTimeout: 30_000,
    // tests/e2e runs under Playwright + a real Vite dev server (Node env,
    // not jsdom). Excluded from the default suite so `pnpm test` stays
    // fast; run them with `pnpm test:e2e`.
    // `.claude/**` holds git WORKTREES, which are full checkouts of this same
    // repository sitting inside it. Without this, a worktree's `tests/` is
    // discovered as if it were ours: a run on `main` picked up an agent
    // branch's specs, failed on constants that exist only there, and reported
    // a green tree as broken. Test discovery must never wander into a checkout
    // that is not this one.
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/e2e/**', '**/.claude/**']
  }
})