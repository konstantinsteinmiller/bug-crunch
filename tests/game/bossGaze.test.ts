/**
 * ─── The gaze: the one boss attack whose answer is to STOP ───────────────────
 *
 * Every other attack in this game is answered by moving. The gaze is answered by
 * not moving, which is exactly why it needs pinning from four sides at once:
 *
 *   IT IS ANSWERABLE   a crowd that holds still pays nothing, and one that does
 *                      not pays about one big hit. Measured as outcomes over the
 *                      real `step()` loop.
 *   IT IS FAIR         while the eye is open the boss's own clock is frozen, so
 *                      no other attack of its can land inside the window — the
 *                      one arrangement that would turn "hold still" into a choice
 *                      between two hits.
 *   IT IS ANNOUNCED    the eye opens before it watches, and the corner badge says
 *                      STILL for the whole of both.
 *   IT IS TAUGHT       once, early: on the stage-1 boss's guard phase, or on the
 *                      stage-2 boss's if the stage-1 boss never had the chance to
 *                      throw it — and then not again until stage 8.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import {
  BOSS_VARIANT_FROM_STAGE, GAZE_FROM_STAGE, GAZE_OPEN, GAZE_TEACH_LAST_STAGE, GAZE_WATCH,
  bossHasGaze, bossKindFor, bossVerbPool
} from '@/game/threats'
import { GAZE_TAUGHT_KEY } from '@/keys'
import { drainFx, type FxEvent } from '@/use/useVfx'

const importGame = () => import('@/use/useSurvivalGame')
type Game = Awaited<ReturnType<typeof importGame>>

const STEP_MS = 16

beforeEach(async () => {
  localStorage.clear()
  const { __resetTowerState } = await import('@/use/useTowerState')
  __resetTowerState()
})

/** The shallowest stage that fields `kind` with the gaze in its pool. */
const gazeStageOf = (kind: string): number => {
  for (let s = GAZE_FROM_STAGE; s < GAZE_FROM_STAGE + 20; s++) if (bossKindFor(s) === kind) return s
  throw new Error(`no gaze stage fields ${kind}`)
}

const METEOR_STAGE = gazeStageOf('meteor')

/** Walk into the arena on `stage` and hand back the live game. */
const arena = async (stage: number, squad: number): Promise<Game> => {
  const game = await importGame()
  game.startStage(stage)
  game.debugSkipToArena()
  game.debugAddUnits(squad)
  for (let i = 0; i < 400 && game.phase.value !== 'boss'; i++) game.step(STEP_MS)
  expect(game.phase.value, `stage ${stage} never reached the arena`).toBe('boss')
  drainFx()
  return game
}

interface Frame { tick: number; lost: number; fx: FxEvent[]; word: string | null }

/**
 * Fight with the boss held open, recording every frame's events, losses and the
 * badge's word. `steer` gets the tick and whether the eye is open right now.
 */
const hold = async (
  stage: number, steer: (game: Game, tick: number) => number, ticks = 1600, squad = 220
): Promise<Frame[]> => {
  const game = await arena(stage, squad)
  const out: Frame[] = []
  for (let i = 0; i < ticks && game.phase.value === 'boss'; i++) {
    const b = game.getBoss()
    if (b) { b.hp = b.maxHp; b.guarded = 99 }
    if (game.squadCount.value < squad) game.debugAddUnits(squad - game.squadCount.value)
    game.steerTo(steer(game, i))
    const before = game.squadCount.value
    game.step(STEP_MS)
    out.push({ tick: i, lost: before - game.squadCount.value, fx: drainFx(), word: game.incomingWord() })
  }
  return out
}

const all = (frames: readonly Frame[]): FxEvent[] => frames.flatMap((f) => f.fx)
const of = <K extends FxEvent['kind']>(fx: readonly FxEvent[], kind: K) =>
  fx.filter((e) => e.kind === kind) as Array<Extract<FxEvent, { kind: K }>>

// ─── The tier ───────────────────────────────────────────────────────────────

describe('the gaze joins every boss from the variant tier', () => {
  it('opens with the second verbs, not before', () => {
    expect(GAZE_FROM_STAGE).toBe(BOSS_VARIANT_FROM_STAGE)
    for (let s = 1; s < GAZE_FROM_STAGE; s++) expect(bossHasGaze(s)).toBe(false)
    expect(bossHasGaze(GAZE_FROM_STAGE)).toBe(true)
  })

  it('is in the pool of every kind from then on, and of none before', () => {
    for (const kind of ['meteor', 'claw', 'healer', 'summoner'] as const) {
      expect(bossVerbPool(kind, GAZE_FROM_STAGE - 1, false)).not.toContain('gaze')
      expect(bossVerbPool(kind, GAZE_FROM_STAGE, false), `${kind} never gazes`).toContain('gaze')
    }
  })
})

// ─── Answerable ─────────────────────────────────────────────────────────────

describe('holding still is a clean answer', () => {
  /** The crowd freezes the instant the eye starts opening, and otherwise sways
   *  across the road as a real fight would make it. */
  const freezes = (game: Game, tick: number): number =>
    game.incomingWord() === 'still' ? game.anchor().x : Math.sin(tick / 25) * 2.4
  /** …and this one never stops swaying at all. */
  const sways = (_game: Game, tick: number): number => Math.sin(tick / 25) * 2.4

  it('costs a crowd that holds still nothing, and one that keeps moving a hit each time', async () => {
    const still = await hold(METEOR_STAGE, freezes)
    const moving = await hold(METEOR_STAGE, sways)

    const watches = of(all(still), 'gazeWatch').length
    expect(watches, 'the boss never gazed').toBeGreaterThan(2)
    expect(of(all(still), 'gazeStrike').length, 'the eye fired on a crowd that held still')
      .toBe(0)

    const strikes = moving.filter((f) => f.fx.some((e) => e.kind === 'gazeStrike'))
    expect(strikes.length, 'a crowd that never stopped was never punished').toBeGreaterThan(2)
    // Every strike takes a real share — the budget of one big hit, not a nibble.
    for (const f of strikes) expect(f.lost, `a strike on tick ${f.tick} took ${f.lost}`).toBeGreaterThan(10)
    // …and the gaze closes every time, struck or held, so no eye stays open.
    expect(of(all(moving), 'gazeEnd').length).toBeGreaterThanOrEqual(strikes.length)
  })

  it('does not fire on a thumb resting on the glass', async () => {
    // A resting thumb is not a perfectly still one. A tremor well under the
    // tolerance has to read as holding still, or the attack is cheating.
    const tremor = (game: Game, tick: number): number =>
      game.incomingWord() === 'still' ? game.anchor().x + Math.sin(tick) * 0.01 : 0
    const r = await hold(METEOR_STAGE, tremor)
    expect(of(all(r), 'gazeWatch').length).toBeGreaterThan(1)
    expect(of(all(r), 'gazeStrike').length).toBe(0)
  })
})

// ─── Fair ───────────────────────────────────────────────────────────────────

describe('nothing else the boss does lands while the eye is open', () => {
  it('freezes the boss clock for the whole watch', async () => {
    const r = await hold(METEOR_STAGE, (game) => game.anchor().x, 2000)
    const LANDS = new Set<FxEvent['kind']>([
      'bossSlam', 'bossShock', 'bossRake', 'bossCharge', 'meteorCast', 'shockCast', 'rakeCast', 'chargeCast'
    ])
    let open = false
    let windows = 0
    for (const f of r) {
      for (const e of f.fx) {
        if (e.kind === 'gazeWatch') { open = true; windows++ }
        if (open && LANDS.has(e.kind)) {
          expect.fail(`a ${e.kind} arrived on tick ${f.tick}, inside the gaze's watch`)
        }
        if (e.kind === 'gazeEnd') open = false
      }
    }
    expect(windows, 'no watch was ever opened').toBeGreaterThan(2)
  })
})

// ─── Announced ──────────────────────────────────────────────────────────────

describe('the eye opens before it watches, and the badge says so', () => {
  it('announces every watch a full opening ahead, and holds the badge on STILL', async () => {
    const r = await hold(METEOR_STAGE, (game) => game.anchor().x, 1600)
    const casts = r.flatMap((f) => of(f.fx, 'gazeCast').map((e) => ({ tick: f.tick, e })))
    const watches = r.flatMap((f) => of(f.fx, 'gazeWatch').map((e) => ({ tick: f.tick, e })))
    expect(watches.length).toBeGreaterThan(1)
    for (const w of watches) {
      const cast = [...casts].reverse().find((c) => c.tick < w.tick)
      expect(cast, `the watch on tick ${w.tick} opened with no eye`).toBeDefined()
      // The opening lasted what the cast promised, to within a frame.
      const openedFor = ((w.tick - cast!.tick) * STEP_MS) / 1000
      expect(openedFor).toBeGreaterThan(cast!.e.ttl - 0.05)
      expect(w.e.ttl).toBeCloseTo(GAZE_WATCH, 6)
      // …and the badge said STILL on every frame in between.
      for (const f of r) {
        if (f.tick <= cast!.tick || f.tick >= w.tick) continue
        expect(f.word, `the badge said ${f.word} while the eye was opening`).toBe('still')
      }
    }
    expect(of(all(r), 'gazeCast').every((e) => e.ttl <= GAZE_OPEN + 1e-9)).toBe(true)
  })
})

// ─── Taught once, early ─────────────────────────────────────────────────────

describe('the gaze is taught once, on stage 1 or stage 2', () => {
  /** Fight a stage's boss with a crowd that holds still, and report whether the
   *  eye ever opened. */
  const opened = async (stage: number, squad = 40): Promise<boolean> => {
    const game = await arena(stage, squad)
    let saw = false
    for (let i = 0; i < 4000 && game.phase.value === 'boss' && !game.getBoss()?.dead; i++) {
      game.steerTo(game.incomingWord() === 'still' ? game.anchor().x : 0)
      game.step(STEP_MS)
      if (drainFx().some((e) => e.kind === 'gazeWatch')) saw = true
    }
    return saw
  }

  it('opens the eye on the stage-1 boss, and marks the lesson delivered', async () => {
    const { getState } = await import('@/use/useTowerState')
    expect(await opened(1), 'the stage-1 boss never showed the gaze').toBe(true)
    expect(getState(GAZE_TAUGHT_KEY, false)).toBe(true)
  })

  it('does not show it again on stage 2 once stage 1 has', async () => {
    expect(await opened(1)).toBe(true)
    expect(await opened(2), 'the stage-2 boss repeated a lesson already given').toBe(false)
  })

  it('shows it on stage 2 when the stage-1 boss never had the chance', async () => {
    // The stage-1 crowd is wiped in the arena before the boss reaches its guard
    // gate, so the eye never opens there — and the lesson falls to stage 2.
    const game = await arena(1, 5)
    for (const u of [...game.getUnits()]) game.__killUnitForTest(u)
    for (let i = 0; i < 200 && game.phase.value === 'boss'; i++) game.step(STEP_MS)
    const { getState } = await import('@/use/useTowerState')
    expect(getState(GAZE_TAUGHT_KEY, false), 'a wiped stage-1 fight marked the gaze taught').toBe(false)
    expect(await opened(2), 'stage 2 did not pick up the lesson stage 1 missed').toBe(true)
  })

  it('never opens it between the teaching stages and the tier', async () => {
    for (let s = GAZE_TEACH_LAST_STAGE + 1; s < GAZE_FROM_STAGE; s++) {
      expect(await opened(s, 120), `stage ${s} gazed before the tier`).toBe(false)
    }
  })
})
