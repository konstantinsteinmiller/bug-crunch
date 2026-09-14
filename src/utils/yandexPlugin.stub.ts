// ─── yandexPlugin no-op stub (non-Yandex builds only) ───────────────────────
//
// Replaces `@/utils/yandexPlugin` on non-Yandex builds via `resolve.alias` in
// `vite.config.ts`. The real module hardcodes Yandex's ad-system host
// (`an.yandex.ru/system/context.js`), and a foreign portal's ad host inside the
// artifact is a rejection on Poki — "no unnecessary external resources".
//
// WHY THE PROVIDER STUB WAS NOT ENOUGH. `YandexProvider` was already aliased
// away, and its comment records that this kept the hosts out of the Poki ENTRY
// chunk. It did — and the module still shipped as its own lazily-loaded
// `yandexPlugin-*.js`, because `FLogoProgress.vue` and `main.ts` reach it
// through a dynamic `import()`. A dynamic import is a chunk boundary, so Rollup
// emits the chunk whether or not the branch around it can ever run. Only
// swapping the MODULE keeps the host out.
//
// `pnpm deploy:poki --gates-only` is what caught it, as an unapproved external
// host in the packed archive.
//
// Stub matches the real module's FULL export surface — every name imported
// anywhere, including the `platforms/yandex` barrel's re-exports and the two
// interfaces `YandexStrategy` types against. No ad-host literal in this file.

import { ref } from 'vue'
import type { Ref } from 'vue'

export interface YandexPlayer {
  setData(data: object, flush?: boolean): Promise<void>
  getData(keys?: string[]): Promise<Record<string, unknown>>
  getUniqueID(): string
  getName(): string | undefined
  isAuthorized(): boolean
}

export interface YandexSdk {
  adv: {
    showFullscreenAdv(args: { callbacks?: Record<string, unknown> }): void
    showRewardedVideo(args: { callbacks?: Record<string, unknown> }): void
  }
  features?: {
    LoadingAPI?: { ready: () => void }
    GameplayAPI?: { start: () => void; stop: () => void }
  }
  environment?: {
    i18n?: { lang?: string; tld?: string }
    app?: { id?: string }
    payload?: string
  }
  getPlayer(options?: { signed?: boolean }): Promise<YandexPlayer>
  on(event: string, cb: () => void): void
  off(event: string, cb: () => void): void
}

export const isYandexSdkActive: Ref<boolean> = ref(false)
export const isYandexAdsBlocked: Ref<boolean> = ref(false)
export const yandexLocale: Ref<string | null> = ref(null)

export const yandexPlugin = (): Promise<void> => Promise.resolve()

export const getYandexPlayer = (): YandexPlayer | null => null
export const getYandexSdk = (): YandexSdk | null => null

export const yandexLoadingReady = (): void => {}
export const yandexGameplayStart = (): void => {}
export const yandexGameplayStop = (): void => {}

export const showRewardedAdYA = (): Promise<boolean> => Promise.resolve(false)
export const showMidgameAdYA = async (_onImpression?: () => void): Promise<void> => {}

const useYandex = (): void => {}
export default useYandex
