import { beforeEach, describe, expect, it, vi } from 'vitest'

// ─── The idle chest's arithmetic ────────────────────────────────────────────
//
// The chest is a COIN FAUCET that runs while nobody is playing, which makes
// every number in `useTreasureChest.ts` a balance decision rather than a
// cosmetic one. Two of them can break the game outright:
//
//   • the daily cap — uncapped at 8 coins a minute an idle tab pays 11,520 a
//     day and buys the entire Locker before dinner, and the fastest route to a
//     new pair of shoes becomes not playing;
//   • the day boundary — measured in UTC it rolls over at 02:00 in Berlin and
//     at 17:00 the previous afternoon in Los Angeles, so a player's allowance
//     resets in the middle of a session and the countdown points at a moment
//     when nothing happens.
//
// The third is the one that looks like a bug rather than a limit: a spent
// chest whose timer sat at a dead 00:00 next to a button that did nothing.
//
// The fill LADDER (3 min / 10 min) was ported unchanged from the game this
// came from; every COIN figure was re-derived against `levelPayout` — see the
// long comment over `SMALL_REWARD`, and the economy block at the bottom of
// this file, which pins the relationship rather than the constants alone.

const STATE_KEY = 'bugcrunch_state'

/** Seed the one persisted blob and re-import the state layer behind it. */
const withState = async (blob: Record<string, unknown>) => {
  localStorage.setItem(STATE_KEY, JSON.stringify(blob))
  vi.resetModules()
  return await import('@/use/useTreasureChest')
}

beforeEach(() => {
  localStorage.clear()
  vi.resetModules()
  vi.useRealTimers()
})

describe('the fill ladder', () => {
  it('pays nothing for the first three minutes, silver to ten, gold after', async () => {
    const m = await withState({})
    expect(m.phaseFor(0)).toBe('cooldown')
    expect(m.phaseFor(m.SMALL_READY_AT_MS - 1)).toBe('cooldown')
    expect(m.phaseFor(m.SMALL_READY_AT_MS)).toBe('small')
    expect(m.phaseFor(m.BIG_READY_AT_MS - 1)).toBe('small')
    expect(m.phaseFor(m.BIG_READY_AT_MS)).toBe('big')
  })

  it('hands a player who has never claimed a chest that is already open', async () => {
    // The chest is the one thing on the HUD that has to be TAUGHT, and a
    // first-time player shown a countdown learns nothing — which matters more
    // in a game whose audience starts at six. A save with no chest field reads
    // as "collected exactly SMALL_READY_AT_MS ago".
    const m = await withState({})
    const now = 1_700_000_000_000
    expect(m.phaseFor(now - m.readCollectedAt(now))).toBe('small')
  })

  it('never writes that seed, so a late cloud blob cannot lose the race', async () => {
    const m = await withState({})
    m.readCollectedAt(Date.now())
    const blob = JSON.parse(localStorage.getItem(STATE_KEY) ?? '{}')
    expect(blob.bc_chest_at).toBeUndefined()
  })

  it('reads a real timestamp back out of the blob', async () => {
    const now = 1_700_000_000_000
    const m = await withState({ bc_chest_at: now - 60_000 })
    expect(m.readCollectedAt(now)).toBe(now - 60_000)
    expect(m.phaseFor(now - m.readCollectedAt(now))).toBe('cooldown')
  })

  it('treats a junk timestamp as "never claimed" rather than as time travel', async () => {
    const now = 1_700_000_000_000
    for (const junk of ['', 'null', {}, -5, 0, Number.NaN]) {
      const m = await withState({ bc_chest_at: junk })
      expect(m.readCollectedAt(now), String(junk)).toBe(now - m.SMALL_READY_AT_MS)
    }
  })
})

describe('the daily cap', () => {
  it('is 240 — three gold claims, and less than the cheapest shoe', async () => {
    const m = await withState({})
    expect(m.DAILY_CAP).toBe(240)
    expect(m.SMALL_REWARD).toBe(20)
    expect(m.BIG_REWARD).toBe(80)
    expect(m.DAILY_CAP).toBe(m.BIG_REWARD * 3)
  })

  it("counts only TODAY, so yesterday's ledger reads as an untouched allowance", async () => {
    const now = Date.now()
    const m = await withState({ bc_chest_day: { day: '2001-01-01', coins: 240 } })
    expect(m.readLedger(now).coins).toBe(0)
    expect(m.readLedger(now).day).toBe(m.todayKey(now))
  })

  it("reads today's ledger back", async () => {
    const now = Date.now()
    const mod = await import('@/use/useTreasureChest')
    const today = mod.todayKey(now)
    const m = await withState({ bc_chest_day: { day: today, coins: 125 } })
    expect(m.readLedger(now).coins).toBe(125)
  })

  it('floors a negative or malformed total at zero', async () => {
    const now = Date.now()
    const mod = await import('@/use/useTreasureChest')
    const today = mod.todayKey(now)
    for (const coins of [-40, 'x', null, undefined]) {
      const m = await withState({ bc_chest_day: { day: today, coins } })
      expect(m.readLedger(now).coins, String(coins)).toBe(0)
    }
  })
})

describe("the day boundary is the PLAYER's, not UTC's", () => {
  it('names the local calendar day', async () => {
    const m = await withState({})
    const now = Date.now()
    const d = new Date(now)
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    expect(m.todayKey(now)).toBe(`${d.getFullYear()}-${mm}-${dd}`)
  })

  it('counts down to the exact moment the day name changes', async () => {
    // The two have to agree, or the chest's countdown points at a moment when
    // nothing happens — the failure that is invisible in a UTC timezone and
    // obvious everywhere else.
    const m = await withState({})
    const now = Date.now()
    const reset = now + m.msUntilReset(now)
    expect(m.todayKey(reset - 1)).toBe(m.todayKey(now))
    expect(m.todayKey(reset)).not.toBe(m.todayKey(now))
  })

  it('is never negative and never more than a day away', async () => {
    const m = await withState({})
    for (const now of [Date.now(), Date.parse('2026-03-29T01:30:00Z'), 0]) {
      expect(m.msUntilReset(now)).toBeGreaterThanOrEqual(0)
      expect(m.msUntilReset(now)).toBeLessThanOrEqual(25 * 3600 * 1000)
    }
  })
})

// ─── The ticking chest ──────────────────────────────────────────────────────

/** Run a composable inside a real component so its `onUnmounted` has a host,
 *  and hand back both the composable's result and a teardown. */
const runInComponent = async <T>(fn: () => T): Promise<{ value: T; stop: () => void }> => {
  const { createApp, h } = await import('vue')
  let value!: T
  const app = createApp({
    setup() {
      value = fn()
      return () => h('div')
    }
  })
  app.mount(document.createElement('div'))
  return { value, stop: () => app.unmount() }
}

describe('claiming', () => {
  it("pays the phase's reward, banks it in the day ledger and restarts the fill", async () => {
    const now = 1_700_000_000_000
    vi.useFakeTimers()
    vi.setSystemTime(now)
    const { BIG_READY_AT_MS } = await import('@/use/useTreasureChest')
    const m = await withState({ bc_chest_at: now - BIG_READY_AT_MS })
    const { value: chest, stop } = await runInComponent(() => m.useTreasureChest())

    expect(chest.phase.value).toBe('big')
    expect(chest.isReady.value).toBe(true)
    expect(chest.reward.value).toBe(m.BIG_REWARD)

    expect(chest.collect()).toBe(m.BIG_REWARD)
    // The chest is shut again and the ledger carries the payout.
    expect(chest.phase.value).toBe('cooldown')
    expect(chest.isReady.value).toBe(false)
    // A second tap in the same breath pays nothing — the guard that stops a
    // double-click paying twice.
    expect(chest.collect()).toBe(0)

    const { getState } = await import('@/use/useBugCrunchState')
    expect(getState('bc_chest_at')).toBe(now)
    expect(getState<{ coins: number }>('bc_chest_day')?.coins).toBe(m.BIG_REWARD)
    stop()
  })

  it('refuses while it is still filling', async () => {
    const now = 1_700_000_000_000
    vi.useFakeTimers()
    vi.setSystemTime(now)
    const m = await withState({ bc_chest_at: now - 1000 })
    const { value: chest, stop } = await runInComponent(() => m.useTreasureChest())
    expect(chest.isReady.value).toBe(false)
    expect(chest.collect()).toBe(0)
    expect(chest.shutterPct.value).toBeGreaterThan(0.9)
    stop()
  })

  it('winds the payout down to what the day has left instead of paying nothing', async () => {
    const now = 1_700_000_000_000
    vi.useFakeTimers()
    vi.setSystemTime(now)
    const mod = await import('@/use/useTreasureChest')
    const m = await withState({
      bc_chest_at: now - mod.BIG_READY_AT_MS,
      bc_chest_day: { day: mod.todayKey(now), coins: 210 }
    })
    const { value: chest, stop } = await runInComponent(() => m.useTreasureChest())
    expect(chest.reward.value).toBe(30)
    expect(chest.isReady.value).toBe(true)
    expect(chest.collect()).toBe(30)
    stop()
  })

  it('shows a spent chest as shut, counting down to midnight — never a dead 00:00', async () => {
    const now = 1_700_000_000_000
    vi.useFakeTimers()
    vi.setSystemTime(now)
    const mod = await import('@/use/useTreasureChest')
    const m = await withState({
      bc_chest_at: now - mod.BIG_READY_AT_MS,
      bc_chest_day: { day: mod.todayKey(now), coins: mod.DAILY_CAP }
    })
    const { value: chest, stop } = await runInComponent(() => m.useTreasureChest())
    expect(chest.isSpent.value).toBe(true)
    expect(chest.isReady.value).toBe(false)
    expect(chest.reward.value).toBe(0)
    // Shut, and counting down to the rollover rather than to a fill it cannot
    // pay for.
    expect(chest.shutterPct.value).toBe(1)
    expect(chest.remainingMs.value).toBe(m.msUntilReset(now))
    expect(chest.timeDisplay.value).not.toBe('00:00')
    stop()
  })

  it('re-reads the blob when a cloud save lands, so a second device gets ONE allowance', async () => {
    const now = 1_700_000_000_000
    vi.useFakeTimers()
    vi.setSystemTime(now)
    const m = await withState({})
    const { value: chest, stop } = await runInComponent(() => m.useTreasureChest())
    expect(chest.isReady.value).toBe(true)

    // The cloud arrives carrying "claimed ten seconds ago".
    const { setStates } = await import('@/use/useBugCrunchState')
    setStates({ bc_chest_at: now - 10_000 })
    await (await import('vue')).nextTick()
    expect(chest.isReady.value).toBe(false)
    stop()
  })
})

// ─── The chest against Bug Crunch's own economy ────────────────────────────────
//
// The constants above are only meaningful next to what PLAYING pays. These pin
// the relationship rather than the numbers, so a re-tune of `levelPayout` or of
// the shoe prices fails here instead of quietly turning the chest into the best
// way to earn coins.

describe('the chest must never out-earn playing', () => {
  it('pays a small fraction of a level, per minute', async () => {
    const m = await withState({})
    const { levelPayout } = await import('@/game/stages')

    // A level CYCLE — card, play, result, the odd retry — is about two minutes
    // of wall clock (`WORLDS[*].time` is 48-90 s).
    const LEVEL_CYCLE_MIN = 2
    const worldOnePerMin = levelPayout(1, 3) / LEVEL_CYCLE_MIN
    const worldFourPerMin = levelPayout(39, 3) / LEVEL_CYCLE_MIN
    const chestPerMin = m.BIG_REWARD / (m.BIG_READY_AT_MS / 60_000)

    expect(chestPerMin).toBe(8)
    // A quarter of the WEAKEST rate playing pays, and an eighth of the best.
    expect(chestPerMin).toBeLessThan(worldOnePerMin * 0.3)
    expect(chestPerMin).toBeLessThan(worldFourPerMin * 0.2)
  })

  it('rewards patience: the gold prize is a better rate than the silver one', async () => {
    const m = await withState({})
    const smallRate = m.SMALL_REWARD / m.SMALL_READY_AT_MS
    const bigRate = m.BIG_REWARD / m.BIG_READY_AT_MS
    expect(bigRate).toBeGreaterThan(smallRate)
  })

  it('cannot buy even the cheapest shoe in a whole day', async () => {
    const m = await withState({})
    const { SHOES } = await import('@/game/shoes')
    const cheapest = Math.min(...SHOES.map((s) => s.cost).filter((c) => c > 0))
    expect(cheapest).toBe(300)
    // Every pair of shoes in this game is bought by PLAYING. The chest only
    // ever shortens the wait.
    expect(m.DAILY_CAP).toBeLessThan(cheapest)
  })

  it("is worth about five minutes of play, not an afternoon's", async () => {
    const m = await withState({})
    const { levelPayout } = await import('@/game/stages')
    // Roughly two and a half three-star world-2 clears.
    const worldTwoClear = levelPayout(11, 3)
    expect(m.DAILY_CAP / worldTwoClear).toBeGreaterThan(2)
    expect(m.DAILY_CAP / worldTwoClear).toBeLessThan(3)
  })
})
