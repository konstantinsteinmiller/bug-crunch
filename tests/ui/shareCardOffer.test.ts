import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { stubCanvases } from './shareCardStub'

/**
 * ─── When the button may exist, and what happens when it is pressed ─────────
 *
 * The whole risk in this feature is a button that does nothing. Web Share is
 * permissions-policy-gated, every portal runs the game in a cross-origin
 * iframe, and `navigator.share` exists in that iframe whether or not the parent
 * delegated the feature — so the API being present proves nothing at all. These
 * specs pin the three gates that stand between a portal build and a dead
 * control: the file-share feature test, the permissions policy, and the
 * one-strike demotion after a refusal.
 */

const read = (rel: string): string =>
  readFileSync(resolve(__dirname, '../..', rel), 'utf8')

// ─── Environment scaffolding ────────────────────────────────────────────────

const PLATFORM_ENVS = [
  'VITE_APP_CRAZY_WEB', 'VITE_APP_WAVEDASH', 'VITE_APP_ITCH', 'VITE_APP_GLITCH',
  'VITE_APP_GAME_DISTRIBUTION', 'VITE_APP_PLAYGAMA', 'VITE_APP_GAMEPIX',
  'VITE_APP_GAME_MONETIZE', 'VITE_APP_YANDEX', 'VITE_APP_POKI'
] as const

const clearPlatformEnv = (): void => {
  for (const k of PLATFORM_ENVS) vi.stubEnv(k, '')
}

/** Re-import so the freshly stubbed env is read at module scope, the way a
 *  build reads its own folded literals. */
const loadModule = async (): Promise<typeof import('@/use/useShareCard')> => {
  vi.resetModules()
  return import('@/use/useShareCard')
}

const define = (obj: object, prop: string, value: unknown): void => {
  Object.defineProperty(obj, prop, { value, configurable: true, writable: true })
}

const removed: (() => void)[] = []

/** Put a Web Share implementation on `navigator` for the length of one spec. */
const withWebShare = (
  share: (d: ShareData) => Promise<void>, canShare: (d: ShareData) => boolean
): void => {
  const hadShare = 'share' in navigator
  const hadCan = 'canShare' in navigator
  define(navigator, 'share', share)
  define(navigator, 'canShare', canShare)
  removed.push(() => {
    if (!hadShare) Reflect.deleteProperty(navigator, 'share')
    if (!hadCan) Reflect.deleteProperty(navigator, 'canShare')
  })
}

/** What a portal iframe with no `allow="web-share"` looks like to the game. */
const withPolicy = (allowed: boolean): void => {
  define(document, 'permissionsPolicy', { allowsFeature: (f: string) => f !== 'web-share' || allowed })
  removed.push(() => Reflect.deleteProperty(document, 'permissionsPolicy'))
}

// Installed for the WHOLE file, and deliberately never lifted between specs.
//
// `vi.resetModules()` gives each spec a fresh `heroSprites`, and a fresh one
// schedules its strip bake on a timer that fires whenever it likes — usually in
// the middle of the next spec's `await`. With the stub lifted in between, that
// bake lands on jsdom's real canvas and floods the run with "not implemented".
//
// It is deliberately never restored either. Vitest isolates each test file, so
// the recorder dies with this file's environment anyway — and handing a late
// bake timer jsdom's own canvas back is exactly the "not implemented" flood
// this stub exists to avoid.
beforeAll(() => { stubCanvases() })

beforeEach(() => {
  clearPlatformEnv()
  // jsdom has no object URLs; the download arm asks for the constructor before
  // it offers itself, so the plain-web build needs one to be offerable at all.
  if (typeof URL.createObjectURL !== 'function') {
    define(URL, 'createObjectURL', () => 'blob:test')
    define(URL, 'revokeObjectURL', () => {})
    removed.push(() => {
      Reflect.deleteProperty(URL, 'createObjectURL')
      Reflect.deleteProperty(URL, 'revokeObjectURL')
    })
  }
})

afterEach(() => {
  while (removed.length > 0) removed.pop()!()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

const RUN = {
  stage: 24,
  peakSquad: 186,
  title: 'splatix',
  recordLabel: 'New record!',
  stageWord: 'Stage',
  squadWord: 'Squad',
  rankValue: '#1130',
  rankOf: 'of 2345',
  text: 'I reached stage 24 in splatix. Think you can go deeper?'
}

// ─── The three gates ────────────────────────────────────────────────────────

describe('what the device and the frame allow', () => {
  it('shares files when the browser can share files', async () => {
    withWebShare(async () => {}, () => true)
    const m = await loadModule()
    expect(m.shareAffordance()).toBe('share')
    expect(m.shareCardOffered.value).toBe(true)
  })

  it('does NOT count a Web Share that cannot carry a file', async () => {
    // Web Share level 1: `share` exists, `canShare` refuses files. The card is
    // a picture; a share that can only carry a URL is not this feature.
    withWebShare(async () => {}, (d) => !('files' in d))
    const m = await loadModule()
    expect(m.shareAffordance()).not.toBe('share')
  })

  it('believes the permissions policy over the presence of the API', async () => {
    // The portal iframe case exactly: a complete, willing-looking Web Share
    // implementation that the containing document never delegated.
    withWebShare(async () => {}, () => true)
    withPolicy(false)
    const m = await loadModule()
    expect(m.shareAffordance()).not.toBe('share')
  })

  it('treats a browser with no opinion as a yes, and lets the runtime settle it', async () => {
    withWebShare(async () => {}, () => true)
    // No `permissionsPolicy` on the document at all — most engines.
    const m = await loadModule()
    expect(m.shareAffordance()).toBe('share')
  })
})

describe('the download fallback', () => {
  it('is offered on a plain web build with no Web Share', async () => {
    const m = await loadModule()
    expect(m.shareAffordance()).toBe('download')
  })

  it('is NEVER offered on a portal build — the button disappears instead', async () => {
    for (const flag of PLATFORM_ENVS) {
      clearPlatformEnv()
      vi.stubEnv(flag, 'true')
      const m = await loadModule()
      expect(m.shareAffordance(), flag).toBe('none')
      expect(m.shareCardOffered.value, flag).toBe(false)
    }
  })

  it('is not offered inside somebody else\'s frame, even on a plain build', async () => {
    define(window, 'top', {})
    removed.push(() => define(window, 'top', window))
    const m = await loadModule()
    expect(m.shareAffordance()).toBe('none')
  })

  it('still lets a portal build SHARE — only the file save is forbidden', async () => {
    vi.stubEnv('VITE_APP_POKI', 'true')
    withWebShare(async () => {}, () => true)
    const m = await loadModule()
    expect(m.shareAffordance()).toBe('share')
  })
})

// ─── Pressing it ────────────────────────────────────────────────────────────

describe('sharing a card', () => {
  it('hands the platform one JPEG named after the run, with the run\'s message', async () => {
    const calls: ShareData[] = []
    withWebShare(async (d) => { calls.push(d) }, () => true)
    const m = await loadModule()

    await expect(m.shareRunCard(RUN)).resolves.toBe(true)
    expect(calls.length).toBe(1)
    const files = calls[0]!.files!
    expect(files.length).toBe(1)
    expect(files[0]!.name).toBe('splatix-stage-24.jpg')
    expect(files[0]!.type).toBe('image/jpeg')
    expect(calls[0]!.title).toBe('splatix')
    expect(calls[0]!.text).toContain('24')
  })

  it('survives the player closing the share sheet, and keeps the button', async () => {
    withWebShare(async () => {
      throw Object.assign(new Error('cancelled'), { name: 'AbortError' })
    }, () => true)
    const m = await loadModule()

    await expect(m.shareRunCard(RUN)).resolves.toBe(false)
    // Cancelling is the most common outcome of a share. It is not a failure and
    // it may not cost the player the button.
    expect(m.shareCardOffered.value).toBe(true)
  })

  it('retires the button for the session the first time the frame refuses', async () => {
    withWebShare(async () => {
      throw Object.assign(new Error('blocked'), { name: 'NotAllowedError' })
    }, () => true)
    const m = await loadModule()

    await expect(m.shareRunCard(RUN)).resolves.toBe(false)
    expect(m.shareCardOffered.value).toBe(false)
    // …and a second press cannot even reach the platform.
    await expect(m.shareRunCard(RUN)).resolves.toBe(false)
  })

  it('retires the button when the card itself cannot be drawn', async () => {
    withWebShare(async () => {}, () => true)
    const m = await loadModule()
    // A canvas with no 2D context — a browser that refused the allocation.
    const stubbed = document.createElement.bind(document)
    document.createElement = ((tag: string) => {
      if (String(tag).toLowerCase() !== 'canvas') return stubbed(tag)
      return { width: 0, height: 0, getContext: () => null } as unknown as HTMLElement
    }) as typeof document.createElement
    try {
      await expect(m.shareRunCard(RUN)).resolves.toBe(false)
      expect(m.shareCardOffered.value).toBe(false)
    } finally {
      document.createElement = stubbed
    }
  })

  it('saves a file instead where that is the affordance, and revokes the URL', async () => {
    const m = await loadModule()
    expect(m.shareAffordance()).toBe('download')
    const clicked: string[] = []
    const stubbed = document.createElement.bind(document)
    document.createElement = ((tag: string) => {
      const el = stubbed(tag) as HTMLElement
      if (String(tag).toLowerCase() === 'a') {
        el.click = () => { clicked.push((el as HTMLAnchorElement).download) }
      }
      return el
    }) as typeof document.createElement
    try {
      await expect(m.shareRunCard(RUN)).resolves.toBe(true)
      expect(clicked).toEqual(['splatix-stage-24.jpg'])
    } finally {
      document.createElement = stubbed
    }
  })

  it('does nothing at all when nothing is offered', async () => {
    vi.stubEnv('VITE_APP_CRAZY_WEB', 'true')
    const m = await loadModule()
    expect(m.shareAffordance()).toBe('none')
    await expect(m.shareRunCard(RUN)).resolves.toBe(false)
  })
})

// ─── Where it lives ─────────────────────────────────────────────────────────

describe('the module stays off the boot path', () => {
  it('reaches the renderer only through a dynamic import', () => {
    const src = read('src/use/useShareCard.ts')
    expect(src).toContain("await import('@/game/shareCardArt')")
    // A value import would pull the whole ink-art vocabulary, the hero strips
    // and the scene renderer into every chunk that so much as asks whether the
    // button should exist. Only the TYPE may be imported statically.
    expect(src).toContain("import type { ShareCardSpec } from '@/game/shareCardArt'")
    expect(/^import \{[^}]*\} from '@\/game\/shareCardArt'/m.test(src)).toBe(false)
  })

  it('is gated on a record the leaderboard actually placed', () => {
    const scene = read('src/views/GameScene.vue')
    // Both halves of the roadmap's bar, and neither is a second opinion: the
    // record flag is the one the screen already prints, and the rank string is
    // the one the rank chip already shows.
    expect(scene).toContain('summary.value.isRecord')
    expect(/showShareCard = computed\([\s\S]{0,400}resultRank\.value !== ''/.test(scene)).toBe(true)
    expect(/showShareCard = computed\([\s\S]{0,400}shareCardOffered\.value/.test(scene)).toBe(true)
    // The button exists only under that computed.
    expect(scene).toContain('v-if="showShareCard"')
  })

  it('costs the leaderboard nothing — no read of its own', () => {
    const scene = read('src/views/GameScene.vue')
    const src = read('src/use/useShareCard.ts')
    const art = read('src/game/shareCardArt.ts')
    // The result screen's existing `reportRun` is the only board traffic there
    // has ever been on this screen, and the card must not add a second read.
    expect(src).not.toContain('ensureBoard')
    expect(art).not.toContain('useLeaderboard')
    expect(src).not.toContain('fetch(')
    expect(art).not.toContain('fetch(')
    expect(scene.match(/ensureBoard/g)).toBeNull()
  })
})
