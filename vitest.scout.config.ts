import { defineConfig, mergeConfig } from 'vitest/config'
import base from './vitest.config'

// The headless balance scout (`tools/scout/`). Its own config so the ordinary
// suite never pays for hundreds of seeded level runs: `pnpm scout`.
export default mergeConfig(base, defineConfig({
  test: {
    include: ['tools/scout/**/*.scout.ts'],
    testTimeout: 600_000
  }
}))
