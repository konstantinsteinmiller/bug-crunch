// ─── playgamaPlugin no-op stub (non-Playgama builds only) ───────────────────
//
// Replaces `@/utils/playgamaPlugin` on non-Playgama builds via `resolve.alias`
// in `vite.config.ts`. The real module hardcodes the Playgama bridge URL
// (`https://bridge.playgama.com/...`), and a foreign portal's SDK host inside
// the artifact is a rejection on the portals that grep the bundle — Poki's
// "no unnecessary external resources", Yandex's "Service storage URL detected".
//
// WHY THE PROVIDER STUB WAS NOT ENOUGH. `PlaygamaProvider` was already aliased
// away, which kept the URL out of the ENTRY chunk — and it still shipped, as
// its own lazily-loaded `playgamaPlugin-*.js`. Four call sites reach the module
// through a dynamic `import()` that no env-literal guard can remove:
// `FLogoProgress.vue`, `main.ts`, `useGameplayLifecycle.ts` and
// `resolveSaveStrategy.ts`. A dynamic import is a chunk boundary, so Rollup
// emits the chunk whether or not the branch around it can ever run. Only
// swapping the MODULE keeps the host out.
//
// `pnpm deploy:poki --gates-only` is what caught it, as an unapproved external
// host in the packed archive.
//
// Stub matches the real module's FULL export surface — every name imported
// anywhere, including the `platforms/playgama` barrel's re-exports. No SDK-URL
// literal anywhere in this file.

import { ref } from 'vue'
import type { Ref } from 'vue'
import type { SaveStrategy } from '@/utils/save/types'

export const isPlaygamaSdkActive: Ref<boolean> = ref(false)
export const isPlaygamaAdsBlocked: Ref<boolean> = ref(false)
export const playgamaLocale: Ref<string | null> = ref(null)
export const playgamaDetectedId: Ref<string | null> = ref(null)

export const getPlaygamaBridge = (): unknown => null

export const playgamaPlugin = (): Promise<void> => Promise.resolve()

export const playgamaLoadingStart = (): void => {}
export const playgamaGameLoadingStop = (): void => {}
export const playgamaGameplayStart = (): void => {}
export const playgamaGameplayStop = (): void => {}

export const showInterstitialPG = async (_onImpression?: () => void): Promise<void> => {}
export const showRewardedPG = async (_onImpression?: () => void): Promise<boolean> => false

// Never called on a build where this stub is active — `resolveSaveStrategy`
// only reaches for it behind the Playgama env flag — but it has to RESOLVE,
// because the dynamic import that pulls it in is what creates the chunk.
export const createPlaygamaSaveStrategy = async (): Promise<SaveStrategy | null> => null
