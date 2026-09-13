import { beforeEach, describe, expect, it, vi } from 'vitest'

// ─── flushSaveNow — immediate checkpoint flush (the CG "stage lost on reload"
// regression) ──────────────────────────────────────────────────────────────
//
// On the CrazyGames cloud-only build, a cleared level writes the new best level into
// `splatix_state`, but the push to `sdk.data` only fires after the persist (~200ms)
// + strategy-flush (~250ms) debounces, and the async cloud write then takes
// time to land. A player who clears a level and reloads a moment later beat that
// pipeline, and the reload restored the OLD level.
//
// `flushSaveNow()` (called at every hard checkpoint) forces the whole pipeline to
// drain synchronously-as-possible: write `splatix_state` now → SaveManager proxy →
// strategy dirty → `manager.flush()` → backend. This test proves a checkpoint write
// reaches the (fake) backend right after `flushSaveNow()` WITHOUT advancing any
// timers — i.e. it does not wait for either debounce.

const STATE_KEY = 'splatix_state'

const makeFakeData = (seed: Record<string, string> = {}) => {
  const store = new Map<string, string>(Object.entries(seed))
  return {
    store,
    getItem: vi.fn(async (key: string) => store.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => { store.set(key, value) }),
    removeItem: vi.fn(async (key: string) => { store.delete(key) })
  }
}

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
  return manager
}

beforeEach(() => {
  localStorage.clear()
  vi.resetModules()
})

describe('flushSaveNow — immediate flush on a hard checkpoint', () => {
  it('pushes a pending level write to the backend without waiting for the debounce', async () => {
    const data = makeFakeData()
    await bootCloudOnly(data)

    const { setState } = await import('@/use/useSplatixState')
    const { flushSaveNow } = await import('@/use/useSaveStatus')

    // A cleared level writes the new best into splatix_state (still sitting on the
    // debounce timers — nothing has reached the cloud yet).
    setState('sx_best_level', 2)
    expect(data.store.get(STATE_KEY)).toBeUndefined()

    // The checkpoint flush drains everything immediately — no fake timers.
    await flushSaveNow()

    const cloudBlob = JSON.parse(data.store.get(STATE_KEY) || '{}')
    expect(cloudBlob.sx_best_level).toBe(2)
  })

  it('also carries coexisting progress (coins) written in the same checkpoint', async () => {
    const data = makeFakeData()
    await bootCloudOnly(data)

    const { setState } = await import('@/use/useSplatixState')
    const { flushSaveNow } = await import('@/use/useSaveStatus')

    setState('sx_coins', 250)
    setState('sx_best_level', 3)
    await flushSaveNow()

    const cloudBlob = JSON.parse(data.store.get(STATE_KEY) || '{}')
    expect(cloudBlob.sx_best_level).toBe(3)
    expect(cloudBlob.sx_coins).toBe(250)
  })
})

// A short tick that lets a fire-and-forget `void flushSaveNow()` async chain
// settle WITHOUT advancing far enough to trip the 200ms persist debounce — so
// anything in the cloud after it got there via the immediate checkpoint flush,
// not the throttle.
const settle = () => new Promise((r) => setTimeout(r, 0))

describe('discrete progression events flush to the backend immediately', () => {
  it('buying a shoe flushes without waiting for the debounce', async () => {
    const data = makeFakeData()
    await bootCloudOnly(data)
    const progress = await import('@/use/useSplatProgress')
    const locker = await import('@/use/useLocker')

    // Enough coins AND enough stars: the Locker's two gates are independent, and
    // a purchase test that only funds one of them proves nothing.
    progress.addCoins(10_000)
    progress.bankLevel(1, 3, { ...(await import('@/game/stars')).emptyTally(), cleared: true })
    progress.bankLevel(2, 3, { ...(await import('@/game/stars')).emptyTally(), cleared: true })
    progress.bankLevel(3, 3, { ...(await import('@/game/stars')).emptyTally(), cleared: true })

    expect(locker.buy('steelBoot')).toBe(true)
    await settle()

    const blob = JSON.parse(data.store.get(STATE_KEY) || '{}')
    expect(blob.sx_shoes_owned).toContain('steelBoot')
    expect(blob.sx_shoe).toBe('steelBoot')
  })

  it('finishing a level flushes the new best level immediately', async () => {
    const data = makeFakeData()
    await bootCloudOnly(data)
    const progress = await import('@/use/useSplatProgress')
    const { emptyTally } = await import('@/game/stars')

    // Through the real banking path (rather than poking the state blob), so the
    // test proves the checkpoint fires from the code a player actually takes.
    progress.setLevel(3)
    progress.bankLevel(3, 2, { ...emptyTally(), cleared: true, squishes: 20, score: 4000 })
    await settle()

    const blob = JSON.parse(data.store.get(STATE_KEY) || '{}')
    expect(blob.sx_best_level).toBe(3)
    // And the NEXT level is banked, so a reload resumes at 4 rather than 3.
    expect(blob.sx_level).toBe(4)
  })
})
