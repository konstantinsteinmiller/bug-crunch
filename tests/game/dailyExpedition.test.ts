import { beforeEach, describe, expect, it, vi } from 'vitest'

// ─── The daily expedition ───────────────────────────────────────────────────
//
// One road a day, the same road for everybody, worth triple coins, taken once.
// Three of its properties are invisible in a screenshot and each of them is one
// careless edit away from being silently untrue:
//
//   • THE CLOCK. The seed is the calendar day, so a local-time day key would
//     make "the same road for everyone" false — and would hand a second
//     expedition to anyone whose device clock crosses their own midnight twice
//     (a flight east, a manual clock change). It is UTC, and the boundary is
//     asserted rather than assumed.
//   • THE SIDE DOOR. An expedition may not move the campaign by one field. The
//     resume point, the career best, the clear streak and the per-stage failure
//     ledger are all written by the same `finishRun` an expedition runs
//     through, and every one of them is a way for a bonus road to corrupt a
//     career the player cannot repair from the client.
//   • THE PAYOUT. The ×3 belongs to the expedition's own coins and nowhere
//     else — not to `stageReward`, not compounded into the rewarded video's
//     own ×3 (which the difficulty curve is priced against).
//
// The road itself is covered by the fourth block: a seed argument that changed
// what an ordinary `buildTrack(stage)` prints would re-roll every stage in the
// game, hand-authored ones included.

const STATE_KEY = 'tower_state'
const DAY_MS = 86_400_000

/** Seed the one persisted blob and re-import the layers behind it. Everything
 *  in this game is a module singleton, so the reset is what makes a test about
 *  "a save that says X" mean anything. */
const withState = async (blob: Record<string, unknown>) => {
  localStorage.setItem(STATE_KEY, JSON.stringify(blob))
  vi.resetModules()
  return await import('@/use/useDailyExpedition')
}

beforeEach(() => {
  localStorage.clear()
  vi.resetModules()
})

describe('the day key is UTC, and the boundary is where it says it is', () => {
  it('reads the UTC calendar date and never the local one', async () => {
    const m = await withState({})
    // Instants chosen to straddle a local midnight almost everywhere: 23:30 UTC
    // is already tomorrow east of Greenwich and still yesterday afternoon in
    // Los Angeles. The only clock that agrees with `toISOString` is UTC.
    for (const iso of [
      '2026-09-10T23:30:00.000Z',
      '2026-09-11T00:30:00.000Z',
      '2026-01-01T00:00:00.000Z',
      '2026-12-31T23:59:59.999Z'
    ]) {
      const t = Date.parse(iso)
      const expected = Number(iso.slice(0, 10).replace(/-/g, ''))
      expect(m.expeditionDay(t), iso).toBe(expected)
    }
  })

  it('flips at UTC midnight and nowhere else', async () => {
    const m = await withState({})
    const midnight = Date.parse('2026-09-11T00:00:00.000Z')
    expect(m.expeditionDay(midnight - 1)).toBe(20260910)
    expect(m.expeditionDay(midnight)).toBe(20260911)
    expect(m.expeditionDay(midnight + DAY_MS - 1)).toBe(20260911)
    expect(m.expeditionDay(midnight + DAY_MS)).toBe(20260912)
  })

  it('counts down to the moment the day actually changes', async () => {
    // A countdown that points at a moment when nothing happens is the bug the
    // treasure chest's dead `00:00` was, and it is the same class of bug: the
    // clock the timer uses has to be the clock the state machine uses.
    const m = await withState({})
    const now = Date.parse('2026-09-10T17:23:45.000Z')
    const left = m.msUntilExpeditionReset(now)
    expect(m.expeditionDay(now + left - 1)).toBe(m.expeditionDay(now))
    expect(m.expeditionDay(now + left)).toBe(m.expeditionDay(now) + 1)
  })

  it('is a pure function of the injected clock — nothing reads a hidden Date', async () => {
    const m = await withState({})
    const t = Date.parse('2026-03-04T12:00:00.000Z')
    expect(m.expeditionDay(t)).toBe(m.expeditionDay(t))
    expect(m.expeditionDay(t)).toBe(20260304)
  })
})

describe('once a day, and the flag says which day', () => {
  const TODAY = Date.parse('2026-09-10T12:00:00.000Z')

  it('a fresh save has today waiting', async () => {
    const m = await withState({})
    expect(m.lastExpeditionDay()).toBe(0)
    expect(m.expeditionSpent(TODAY)).toBe(false)
  })

  it('writes the day the run STARTED, and reads it back as spent', async () => {
    const m = await withState({})
    m.markExpeditionTaken(TODAY)
    expect(m.lastExpeditionDay()).toBe(20260910)
    expect(m.expeditionSpent(TODAY)).toBe(true)
    // …and the field is really in the one persisted blob, which is what makes
    // it ride the cloud save with the rest of the player's progress. Flushed
    // by hand because the blob write is debounced — which is exactly why
    // `startExpedition` calls `flushSaveNow` before the first frame.
    const { flushPersist } = await import('@/use/useTowerState')
    flushPersist()
    const blob = JSON.parse(localStorage.getItem(STATE_KEY) ?? '{}')
    expect(blob.ts_expedition_day).toBe(20260910)
  })

  it('yesterday reads as available again', async () => {
    const m = await withState({ ts_expedition_day: 20260909 })
    expect(m.expeditionSpent(TODAY)).toBe(false)
    expect(m.expeditionSpent(Date.parse('2026-09-09T12:00:00.000Z'))).toBe(true)
  })

  it('a garbage value fails OPEN, never into a lockout nobody can explain', async () => {
    // A cloud restore can hand back whatever the SDK had. The safe direction
    // for a value we cannot parse is "you may go" — a player wrongly locked out
    // of a daily has no way to tell why and no way to fix it.
    for (const junk of [null, undefined, 'tomorrow', {}, -5, Number.NaN]) {
      const m = await withState({ ts_expedition_day: junk })
      expect(m.lastExpeditionDay(), String(junk)).toBe(0)
      expect(m.expeditionSpent(TODAY), String(junk)).toBe(false)
    }
  })

  it('a save from a cloud device that already ran today stays spent', async () => {
    // The merge is whole-blob (see `SaveMergePolicy`), so a restore that wins
    // brings this field with it — which is the ONLY thing standing between a
    // player with two devices and two expeditions a day.
    const m = await withState({ ts_expedition_day: 20260910, ts_best_stage: 20 })
    expect(m.expeditionSpent(TODAY)).toBe(true)
  })
})

describe('the chip does not exist until the road is attemptable', () => {
  it('opens only once the player has cleared deep enough', async () => {
    const m = await withState({})
    expect(m.expeditionUnlocked()).toBe(false)

    const below = await withState({ ts_best_stage: m.EXPEDITION_UNLOCK_BEST - 1 })
    expect(below.expeditionUnlocked()).toBe(false)

    const at = await withState({ ts_best_stage: m.EXPEDITION_UNLOCK_BEST })
    expect(at.expeditionUnlocked()).toBe(true)
  })

  it('is priced below the road it offers, and above the authored campaign', async () => {
    const m = await withState({})
    // Past the hand-authored block, so the seed shapes the whole road…
    expect(m.EXPEDITION_STAGE).toBeGreaterThan(15)
    // …and within reach of the player who is allowed to see it.
    expect(m.EXPEDITION_UNLOCK_BEST).toBeLessThan(m.EXPEDITION_STAGE)
    expect(m.EXPEDITION_STAGE - m.EXPEDITION_UNLOCK_BEST).toBeLessThanOrEqual(6)
  })
})

describe('the road is the day, and the campaign is untouched by the seam', () => {
  it('prints one road per day, and a different one tomorrow', async () => {
    const { buildTrack } = await import('@/game/track')
    const { EXPEDITION_STAGE } = await import('@/use/useDailyExpedition')
    const today = buildTrack(EXPEDITION_STAGE, 20260910)
    expect(JSON.stringify(buildTrack(EXPEDITION_STAGE, 20260910)))
      .toBe(JSON.stringify(today))
    expect(JSON.stringify(buildTrack(EXPEDITION_STAGE, 20260911)))
      .not.toBe(JSON.stringify(today))
  })

  it('keeps the difficulty of the rung it names, whatever the seed', async () => {
    const { buildTrack } = await import('@/game/track')
    const { EXPEDITION_STAGE } = await import('@/use/useDailyExpedition')
    // The knobs read `stage`, never `seed` — so the length, the arena and the
    // boss sit exactly where stage 16 puts them on every day of the year.
    const plain = buildTrack(EXPEDITION_STAGE)
    for (const seed of [20260101, 20260910, 20261231]) {
      const t = buildTrack(EXPEDITION_STAGE, seed)
      expect(t.stage, `seed ${seed}`).toBe(EXPEDITION_STAGE)
      expect(t.length, `seed ${seed}`).toBe(plain.length)
      expect(t.arenaY, `seed ${seed}`).toBe(plain.arenaY)
      expect(t.bossY, `seed ${seed}`).toBe(plain.bossY)
    }
  })

  it('changes nothing about a campaign stage — authored or generated', async () => {
    const { buildTrack } = await import('@/game/track')
    // The seed DEFAULTS to the stage, so every existing call site builds the
    // byte-identical road it built before the parameter existed. Stages 1-15
    // are hand-authored on purpose and a player learns them; 16-25 are the
    // generator's, and a re-roll there would move every mark on the rail.
    for (let stage = 1; stage <= 25; stage++) {
      expect(JSON.stringify(buildTrack(stage)), `stage ${stage}`)
        .toBe(JSON.stringify(buildTrack(stage, stage)))
    }
  })
})

// ─── The run itself ─────────────────────────────────────────────────────────
//
// Driven against the real simulation, because every claim below is about what
// `startStage` and `finishRun` write — and both are two hundred lines of
// bookkeeping that a unit test of a pure helper cannot reach.

describe('an expedition is a side door, not a stage counter bump', () => {
  const NOW = Date.parse('2026-09-10T12:00:00.000Z')
  const STEP_MS = 16
  /** Long enough for the whole of a stage-16 road at run speed, with room to
   *  spare for a crowd that keeps clearing banks. */
  const MAX_STEPS = 12_000

  /** A save deep enough to have the chip, sitting on a campaign stage well
   *  short of the expedition's own rung. */
  const CAMPAIGN = {
    ts_stage: 13,
    ts_best_stage: 14,
    ts_challenge: 4,
    ts_coins: 500,
    ts_failed_stages: { 16: 2 }
  }

  const boot = async () => {
    localStorage.setItem(STATE_KEY, JSON.stringify(CAMPAIGN))
    vi.resetModules()
    return {
      game: await import('@/use/useSurvivalGame'),
      state: await import('@/use/useTowerState'),
      exped: await import('@/use/useDailyExpedition')
    }
  }

  /** Play it out, steering enough that `wasPlayed()` is true — an idle tab is
   *  deliberately not treated as a stuck player, and this test is about what a
   *  REAL run writes. */
  const playToEnd = (game: Awaited<ReturnType<typeof boot>>['game']): void => {
    for (let i = 0; i < MAX_STEPS; i++) {
      if (game.phase.value === 'clear' || game.phase.value === 'wipe') return
      game.steerTo(i % 40 < 20 ? 1.2 : -1.2)
      game.step(STEP_MS)
    }
  }

  it('spends the day up front, so a reload cannot re-roll a losing road', async () => {
    const { game, state, exped } = await boot()
    expect(exped.expeditionSpent(NOW)).toBe(false)
    game.startExpedition(NOW)
    expect(exped.expeditionSpent(NOW)).toBe(true)
    // Before a single frame has been stepped.
    expect(state.getState('ts_expedition_day')).toBe(20260910)
    expect(game.isExpedition.value).toBe(true)
  })

  it('never writes the campaign resume point', async () => {
    const { game, state } = await boot()
    game.startExpedition(NOW)
    expect(game.stage.value).toBe((await import('@/use/useDailyExpedition')).EXPEDITION_STAGE)
    // `startStage` writes `ts_stage` on every campaign run; this is the one
    // caller that must not.
    expect(state.getState('ts_stage')).toBe(13)
    playToEnd(game)
    expect(state.getState('ts_stage')).toBe(13)
  })

  it('leaves the whole career ledger exactly as it found it', async () => {
    const { game, state } = await boot()
    game.startExpedition(NOW)
    playToEnd(game)
    const summary = game.runSummary()
    expect(summary.expedition).toBe(true)
    // Whatever happened out there:
    expect(state.getState('ts_stage')).toBe(13)
    expect(state.getState('ts_best_stage')).toBe(14)
    expect(state.getState('ts_challenge')).toBe(4)
    // The failure ledger is keyed by stage NUMBER, and stage 16 is a real
    // campaign stage this player has already lost twice. A wipe out here must
    // not spend that relief, and a clear must not erase it.
    expect(state.getState('ts_failed_stages')).toEqual({ 16: 2 })
    // …and it can never be a personal record, whichever way it ended.
    expect(summary.isRecord).toBe(false)
  })

  it('pays exactly triple, and leaves the video ×3 priced off the ordinary run', async () => {
    const { game } = await boot()
    const { EXPEDITION_PAYOUT } = await import('@/use/useDailyExpedition')
    game.startExpedition(NOW)
    playToEnd(game)
    const s = game.runSummary()
    expect(s.baseCoins).toBeGreaterThan(0)
    expect(s.coins).toBe(s.baseCoins * EXPEDITION_PAYOUT)
  })

  it('carries no autobalancer, so the same seed is the same fight for everyone', async () => {
    // This save has lost stage 16 twice AND holds a four-stage clear streak.
    // Both would move the road under the player on a campaign run; neither may
    // touch a road that is supposed to be one shared object.
    const { game } = await boot()
    game.startExpedition(NOW)
    expect(game.runSummary().relieved).toBe(false)
    playToEnd(game)
    expect(game.runSummary().relieved).toBe(false)
  })

  it('hands the campaign back untouched, whichever button ends the screen', async () => {
    for (const exit of ['next', 'retry'] as const) {
      const { game, state } = await boot()
      game.startExpedition(NOW)
      playToEnd(game)
      if (exit === 'next') game.advanceStage()
      else game.retryStage()
      // Not stage 17, not stage 16 — stage 13, where the campaign was left.
      expect(game.stage.value, exit).toBe(13)
      expect(game.isExpedition.value, exit).toBe(false)
      expect(state.getState('ts_stage'), exit).toBe(13)
    }
  })

  it('an ordinary run still writes everything it always did', async () => {
    // The negative control. Every assertion above is about a flag being set;
    // this is the one that would fail if the flag were stuck on.
    const { game, state } = await boot()
    game.startStage(13)
    expect(game.isExpedition.value).toBe(false)
    expect(state.getState('ts_stage')).toBe(13)
    playToEnd(game)
    const s = game.runSummary()
    expect(s.expedition).toBe(false)
    expect(s.coins).toBe(s.baseCoins)
    // The streak moved one way or the other — which is exactly what an
    // expedition is forbidden from doing.
    expect(state.getState('ts_challenge')).not.toBe(4)
  })
})
