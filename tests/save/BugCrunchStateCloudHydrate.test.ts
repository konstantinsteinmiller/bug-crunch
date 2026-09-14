import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

// ─── Cloud → composable hydrate (the "fresh user" regression) ───────────────
//
// THE BUG THIS FILE EXISTS TO PREVENT:
//   A returning player reloads. The platform SDK's cloud read is async. The Vue
//   module graph evaluates first, every composable reads an empty blob and
//   initialises to defaults, and the player is rendered as a brand-new install:
//   level 1-1, no coins, no stars, back in the starter sneaker. The next write
//   then commits those defaults over the real cloud save and the loss becomes
//   permanent.
//
// The whole game state lives in ONE `bugcrunch_state` blob (an allowlisted payload
// key), so the strategy mirrors it verbatim. `reloadBugCrunchState()` is wired into
// the `saveDataVersion` bump inside `useSaveStatus` — and the ORDER matters: the
// blob must be re-read BEFORE the bump, or every `watch(saveDataVersion)`
// consumer re-reads the stale pre-hydrate snapshot and the bug survives.

const MANIFEST_KEY = '__save_internal__crazy_keys'
const STATE_KEY = 'bugcrunch_state'

const makeFakeData = (seed: Record<string, string> = {}) => {
  const store = new Map<string, string>(Object.entries(seed))
  return {
    store,
    getItem: vi.fn(async (key: string) => store.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => { store.set(key, value) }),
    removeItem: vi.fn(async (key: string) => { store.delete(key) })
  }
}

const flush = async (): Promise<void> => { await nextTick(); await nextTick() }

beforeEach(() => {
  localStorage.clear()
  vi.resetModules()
})

/** A cloud snapshot for a player who is deep into the campaign, plus the meta
 *  blob the merge resolver needs in order to pick remote over an empty local. */
const seededCloud = async () => {
  const { META_KEY } = await import('@/utils/save/SaveMergePolicy')
  const cloudBlob = {
    bc_coins: 1250,
    bc_total_coins: 4300,
    bc_best_level: 14,
    bc_best_score: 88_400,
    bc_best_combo: 20,
    bc_runs: 19,
    bc_total_squishes: 4200,
    // Three levels three-starred, two of them at two. Seven stars — past the
    // steel boot's gate (9? no: 7 is short of it) and well past world 2's.
    bc_level_stars: { '1': 3, '2': 3, '3': 3, '4': 2, '5': 2 },
    bc_shoes_owned: ['sneaker', 'steelBoot'],
    bc_shoe: 'steelBoot',
    bc_user_sound: 0.4,
    bc_user_language: 'es',
    bc_juice_style: 'confetti',
    // The level the player was on when they closed the tab. A level's layout is
    // regenerated from this number alone, so this single field IS the resume.
    bc_level: 14
  }
  const meta = {
    savedAt: '2026-05-19T00:00:00.000Z',
    // bestLevel 14 × 500 + 13 stars × 150 + 19 runs × 10
    progressScore: 14 * 500 + 13 * 150 + 19 * 10,
    schemaVersion: 1,
    maxStage: 14
  }
  return makeFakeData({
    [MANIFEST_KEY]: JSON.stringify([STATE_KEY, META_KEY]),
    [STATE_KEY]: JSON.stringify(cloudBlob),
    [META_KEY]: JSON.stringify(meta)
  })
}

/** Boot the CrazyGames cloud-only configuration: gameplay state lives in memory
 *  only and `sdk.data` is the sole persistence backend. */
const bootCloudOnly = async (data: ReturnType<typeof makeFakeData>) => {
  const { SaveManager } = await import('@/utils/save/SaveManager')
  const { CrazyGamesStrategy } = await import('@/utils/save/CrazyGamesStrategy')
  const { installSaveStatus } = await import('@/use/useSaveStatus')
  const manager = new SaveManager(
    new CrazyGamesStrategy(() => data),
    window.localStorage,
    { blob: { persistToRaw: false } }
  )
  installSaveStatus(manager)
  await manager.init()
  await flush()
  return manager
}

describe('bugcrunch_state cloud hydrate → composable refresh', () => {
  it('hydrates the blob into localStorage before the app graph reads it', async () => {
    const data = await seededCloud()
    await bootCloudOnly(data)

    const blob = JSON.parse(window.localStorage.getItem(STATE_KEY) || '{}')
    expect(blob.bc_best_level).toBe(14)
    expect(blob.bc_coins).toBe(1250)
  })

  it('refreshes the progress composable — the player is NOT a fresh user', async () => {
    const data = await seededCloud()
    await bootCloudOnly(data)

    const progress = await import('@/use/useSplatProgress')
    expect(progress.coins.value).toBe(1250)
    expect(progress.bestLevel.value).toBe(14)
    expect(progress.bestScore.value).toBe(88_400)
    expect(progress.totalStars.value).toBe(13)
  })

  it('refreshes the Locker — the player keeps the shoe they paid for', async () => {
    const data = await seededCloud()
    await bootCloudOnly(data)

    const locker = await import('@/use/useLocker')
    expect(locker.ownedShoes.value).toContain('steelBoot')
    expect(locker.equippedShoe.value).toBe('steelBoot')
    // And the derived stats follow: a hydrate that restored the id but left the
    // spec on the starter would silently take the perk away every reload.
    expect(locker.equippedSpec.value.spikeProof).toBe(true)
  })

  it('refreshes user settings so the player keeps their language, volume and tone', async () => {
    const data = await seededCloud()
    await bootCloudOnly(data)

    const { default: useUser } = await import('@/use/useUser')
    const u = useUser()
    expect(u.userLanguage.value).toBe('es')
    expect(u.userSoundVolume.value).toBe(0.4)
    expect(u.userJuiceStyle.value).toBe('confetti')
  })

  it('resumes the saved level rather than dropping the player back to 1-1', async () => {
    const data = await seededCloud()
    await bootCloudOnly(data)

    const progress = await import('@/use/useSplatProgress')
    expect(progress.currentLevel.value).toBe(14)

    const { levelLabel } = await import('@/game/stages')
    expect(levelLabel(progress.currentLevel.value)).toBe('2-4')

    // Drain this module instance's pending persist timer. `vi.resetModules()`
    // gives the NEXT test fresh modules but cannot cancel a timer already
    // scheduled by this one — and when it fired it would write this test's blob
    // into the next test's store, which reads as a phantom hydrate.
    const { flushPersist } = await import('@/use/useBugCrunchState')
    flushPersist()
  })

  it('keeps nothing but the two blobs in raw localStorage on a cloud-only build', async () => {
    const data = await seededCloud()
    await bootCloudOnly(data)

    // Cloud-only mode: gameplay state is in-memory; the proxy serves reads.
    // Nothing must leak into the raw store.
    const raw: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k) raw.push(k)
    }
    expect(raw.filter((k) => k.startsWith('bc_'))).toEqual([])
  })
})

describe('hydrate failure modes', () => {
  it('does NOT overwrite a real cloud save when the local snapshot is empty', async () => {
    const data = await seededCloud()
    const manager = await bootCloudOnly(data)

    // A trivial post-boot write must not clobber the hydrated fields.
    const { setState } = await import('@/use/useBugCrunchState')
    const { flushSaveNow } = await import('@/use/useSaveStatus')
    setState('bc_onboarded', true)
    await flushSaveNow()
    await manager.flush()

    const cloudBlob = JSON.parse(data.store.get(STATE_KEY) || '{}')
    expect(cloudBlob.bc_best_level).toBe(14)
    expect(cloudBlob.bc_coins).toBe(1250)
    expect(cloudBlob.bc_onboarded).toBe(true)
  })

  it('retries a transient SDK failure before letting a returning player boot fresh', async () => {
    vi.useFakeTimers()
    try {
      const data = await seededCloud()
      const snapshot = new Map(data.store)
      let calls = 0
      data.getItem.mockImplementation(async (key: string) => {
        calls++
        // Fail the very first manifest read — the transient-blip failure mode.
        if (key === MANIFEST_KEY && calls === 1) throw new Error('transient SDK error')
        return snapshot.get(key) ?? null
      })

      const { SaveManager } = await import('@/utils/save/SaveManager')
      const { CrazyGamesStrategy } = await import('@/utils/save/CrazyGamesStrategy')
      const manager = new SaveManager(
        new CrazyGamesStrategy(() => data),
        window.localStorage,
        { blob: { persistToRaw: false } }
      )
      const init = manager.init()
      await vi.advanceTimersByTimeAsync(1_500)
      await init

      expect(manager.hydrateState).toBe('success-with-data')
      const blob = JSON.parse(window.localStorage.getItem(STATE_KEY) || '{}')
      expect(blob.bc_best_level).toBe(14)
    } finally {
      vi.clearAllTimers()
      vi.useRealTimers()
    }
  })

  it('treats a genuinely empty cloud as a real fresh install', async () => {
    const data = makeFakeData()
    await bootCloudOnly(data)

    const progress = await import('@/use/useSplatProgress')
    const locker = await import('@/use/useLocker')
    expect(progress.coins.value).toBe(0)
    expect(progress.currentLevel.value).toBe(1)
    expect(progress.totalStars.value).toBe(0)
    expect(locker.equippedShoe.value).toBe('sneaker')
  })

  it('survives a corrupt cloud blob without wiping the player', async () => {
    const { META_KEY } = await import('@/utils/save/SaveMergePolicy')
    const data = makeFakeData({
      [MANIFEST_KEY]: JSON.stringify([STATE_KEY, META_KEY]),
      [STATE_KEY]: '{not json at all',
      [META_KEY]: JSON.stringify({
        savedAt: '2026-05-19T00:00:00.000Z',
        progressScore: 5000, schemaVersion: 1, maxStage: 10
      })
    })
    // A corrupt blob must degrade to defaults, not throw during boot.
    await expect(bootCloudOnly(data)).resolves.toBeDefined()
    const progress = await import('@/use/useSplatProgress')
    expect(progress.coins.value).toBe(0)
  })

  it('never leaves a player barefoot when the save names a shoe they do not own', async () => {
    const { META_KEY } = await import('@/utils/save/SaveMergePolicy')
    const data = makeFakeData({
      [MANIFEST_KEY]: JSON.stringify([STATE_KEY, META_KEY]),
      // A save written by a build where `jetBoot` existed and this one does not.
      [STATE_KEY]: JSON.stringify({ bc_shoe: 'jetBoot', bc_shoes_owned: ['jetBoot'] }),
      [META_KEY]: JSON.stringify({
        savedAt: '2026-05-19T00:00:00.000Z',
        progressScore: 500, schemaVersion: 1, maxStage: 1
      })
    })
    await bootCloudOnly(data)
    const locker = await import('@/use/useLocker')
    expect(locker.equippedShoe.value).toBe('sneaker')
    expect(locker.ownedShoes.value).toContain('sneaker')
  })
})

describe('reload round-trip', () => {
  it('a level cleared before the reload is still there after it', async () => {
    // ── Session 1: clear level 5, then flush at the checkpoint. ──
    const data = makeFakeData()
    const m1 = await bootCloudOnly(data)
    const progress = await import('@/use/useSplatProgress')
    const { emptyTally } = await import('@/game/stars')

    progress.setLevel(5)
    progress.addCoins(640)
    progress.bankLevel(5, 3, {
      ...emptyTally(), cleared: true, squishes: 40, bestCombo: 12, score: 12_000, timeLeft: 20
    })
    await m1.flush()

    // ── Session 2: a cold boot against the same cloud store. ──
    // Drain session 1's pending persist timer first — a late fire would write
    // session 1's blob into session 2 and read as a phantom hydrate.
    const { flushPersist } = await import('@/use/useBugCrunchState')
    flushPersist()
    vi.resetModules()
    localStorage.clear()
    const data2 = makeFakeData(Object.fromEntries(data.store))
    await bootCloudOnly(data2)

    const progress2 = await import('@/use/useSplatProgress')
    expect(progress2.coins.value).toBeGreaterThanOrEqual(640)
    // Level 5 was cleared, so the resumed level is the NEXT one.
    expect(progress2.currentLevel.value).toBe(6)
    expect(progress2.starsFor(5)).toBe(3)
    expect(progress2.bestLevel.value).toBe(5)
  })
})
