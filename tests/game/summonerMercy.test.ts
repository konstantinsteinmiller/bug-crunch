/**
 * ─── A decided fight has to be allowed to end ───────────────────────────────
 *
 * Reported from a live run: a summoner cut a squad down to one survivor, spent
 * the last of its wave budget, and then stood there. One unit's damage against a
 * boss bar is minutes of holding the trigger — and with the wall over, there was
 * nothing left on the road to lose to either. The player ground the fight out
 * for twelve minutes.
 *
 * Nothing was broken. `SUMMON_WAVES_MAX` is the floor that makes the summoner
 * beatable by a squad that cannot out-damage its spawn rate, and it did exactly
 * what it says. What was missing is the other end: a fight the player has
 * already lost in every way except the arithmetic must reach an ENDING, so they
 * can restart instead of grinding.
 *
 * The answer is the mercy trickle — single bodies clawing up at the summoner's
 * own flanks, once the wall is spent and the crowd is down to a handful. These
 * specs pin the two properties that make it safe, because each one alone is a
 * bug:
 *
 *   • it RESOLVES the fight (or it is just a slower grind);
 *   • and it never touches a fight the player might still win (or it is the
 *     unbounded spawn rate the wave cap exists to prevent, wearing a hat).
 */

import { beforeEach, describe, expect, it } from 'vitest'
import {
  SUMMON_MERCY_FLANK, SUMMON_MERCY_SQUAD, SUMMON_WAVES_MAX,
  THREAT_POOL_FROM_STAGE, bossKindFor, type BossKind
} from '@/game/threats'
import { drainFx } from '@/use/useVfx'

const importGame = () => import('@/use/useSurvivalGame')

const STEP_MS = 16

beforeEach(async () => {
  localStorage.clear()
  const { __resetTowerState } = await import('@/use/useTowerState')
  __resetTowerState()
})

const stageOf = (kind: BossKind): number => {
  for (let s = THREAT_POOL_FROM_STAGE; s < THREAT_POOL_FROM_STAGE + 40; s++) {
    if (bossKindFor(s) === kind) return s
  }
  throw new Error(`no stage fields ${kind}`)
}
const SUMMONER_STAGE = stageOf('summoner')

/** Guard gates already spent — a held-open boss must have its phases held open
 *  too, or it sits in a wind-up that never resolves. */
const SPENT = 99

/**
 * Reach the summoner's arena with `squad` survivors.
 *
 * `wallSpent` reproduces the reported state directly rather than waiting for the
 * budget to run out naturally: the wall is over, the road is empty, and what is
 * left is the fight this whole mechanism is about.
 */
const openFight = async (squad: number, wallSpent: boolean) => {
  const game = await importGame()
  game.startStage(SUMMONER_STAGE)
  game.debugSkipToArena()
  game.debugAddUnits(squad)
  for (let i = 0; i < 400 && game.phase.value !== 'boss'; i++) game.step(STEP_MS)
  expect(game.phase.value, 'never reached the arena').toBe('boss')
  const b = game.getBoss()
  expect(b, 'no boss in the arena').not.toBeNull()
  if (wallSpent) b!.attacks = SUMMON_WAVES_MAX
  b!.guarded = SPENT
  b!.guard = 0
  drainFx()
  return { game, boss: b! }
}

describe('a summoner whose wall is spent ends the fight it has already won', () => {
  it('keeps calling bodies up until a squad that cannot win is finished', async () => {
    // The reported run, reproduced: one survivor, the budget gone, and a boss
    // held at full health because a single unit's damage may as well be zero.
    // Before the trickle this loop ran to its limit with the road empty and the
    // player alive — which is what twelve minutes of grinding looks like from
    // inside the simulation.
    const { game } = await openFight(1, true)

    /** 90 s. Generous: long enough that a slow answer still counts, short
     *  enough that "it resolves eventually" is not a passing grade. */
    const MAX_TICKS = Math.ceil((90 * 1000) / STEP_MS)
    let flanks = 0
    let ticks = 0
    while (ticks < MAX_TICKS && game.phase.value === 'boss') {
      const b = game.getBoss()
      if (b) { b.hp = b.maxHp; b.guarded = SPENT; b.guard = 0 }
      game.steerTo(0)
      game.step(STEP_MS)
      flanks += drainFx().filter((e) => e.kind === 'summonFlank').length
      ticks++
    }
    const seconds = (ticks * STEP_MS) / 1000

    expect(flanks, 'nothing was ever called up — the road stayed empty')
      .toBeGreaterThan(0)
    expect(game.phase.value, `the fight was still running after ${seconds.toFixed(0)} s`)
      .not.toBe('boss')
    expect(game.squadCount.value, 'the run ended with survivors left').toBe(0)
  })

  it('is self-limiting — it never stacks the road up', async () => {
    // One body at a time, a gap that bottoms out at 1.2 s, and about 2.2 s to
    // cross from the boss's flank to the crowd it then trades itself against:
    // the road holds two of these, and it holds two forever.
    //
    // That is emergent rather than enforced. A ceiling was written first and
    // instrumented, and it never bound in any fight — fought or kited — so it
    // was removed rather than shipped as a branch nothing reaches. This spec is
    // what replaces it, and the bound is generous on purpose: it is here to
    // catch a future ramp that floods the road, not to pin today's number.
    const { game } = await openFight(1, true)

    let peak = 0
    for (let i = 0; i < 3000 && game.phase.value === 'boss'; i++) {
      const b = game.getBoss()
      if (b) { b.hp = b.maxHp; b.guarded = SPENT; b.guard = 0 }
      // Kept alive on purpose: a wiped squad ends the fight, and this spec is
      // about the fight that keeps going.
      if (game.squadCount.value < 1) game.debugAddUnits(1)
      // Running for one rail and then the other — what kiting looks like from
      // in here, and the shape most likely to leave bodies in transit.
      game.steerTo(i % 240 < 120 ? -3 : 3)
      game.step(STEP_MS)
      const alive = game.getFoes().filter((f) => f.design === 'marrowknight' && !f.dead).length
      if (alive > peak) peak = alive
    }
    expect(peak, 'nothing was called up, so there is nothing to bound')
      .toBeGreaterThan(0)
    expect(peak, `${peak} bodies were walking at once over 48 s of kiting`)
      .toBeLessThanOrEqual(6)
  })

  it('calls them up beside the BOSS, not in front of the crowd', async () => {
    // Where they arrive is what makes the trickle safe. A wave rises ahead of
    // the crowd and is on it in about two seconds; these come up at the boss's
    // flanks and walk the arena, so a squad with anything left simply shoots
    // them. Measured against the boss's live position at the moment each one
    // lands, which is the only reading that cannot drift with the boss's walk.
    const { game } = await openFight(1, true)

    let checked = 0
    for (let i = 0; i < 2000 && game.phase.value === 'boss' && checked < 3; i++) {
      const b = game.getBoss()
      if (b) { b.hp = b.maxHp; b.guarded = SPENT; b.guard = 0 }
      game.steerTo(0)
      game.step(STEP_MS)
      const here = game.getBoss()
      for (const e of drainFx()) {
        if (e.kind !== 'summonFlank' || !here) continue
        expect(Math.abs(e.x - here.x), 'a body came up somewhere other than the boss’s flank')
          .toBeLessThanOrEqual(SUMMON_MERCY_FLANK + 0.01)
        expect(Math.abs(e.y - here.y), 'a body came up off the boss’s line')
          .toBeLessThan(0.01)
        checked++
      }
    }
    expect(checked, 'no flank body arrived to measure').toBeGreaterThan(0)
  })
})

describe('…and never touches a fight the player might still win', () => {
  it('calls up nothing at all while the crowd is still a crowd', async () => {
    // The same shape as the wall's own "the second half has no waves in it"
    // spec, and the same guarantee: a fight held open for eighty seconds with
    // the budget spent and a real squad on the road sees no trickle whatsoever.
    // Without this the mechanism is just the unbounded spawn rate the wave cap
    // was built to remove.
    const { game } = await openFight(200, true)

    const TICKS = 5000
    let flanks = 0
    for (let i = 0; i < TICKS && game.phase.value === 'boss'; i++) {
      const b = game.getBoss()
      if (b) { b.hp = b.maxHp * 0.5; b.guarded = SPENT; b.guard = 0 }
      if (game.squadCount.value < 60) game.debugAddUnits(200 - game.squadCount.value)
      game.steerTo(0)
      game.step(STEP_MS)
      flanks += drainFx().filter((e) => e.kind === 'summonFlank').length
    }
    expect(flanks, `a healthy crowd was handed ${flanks} flank bodies`).toBe(0)
  })

  it('stands down again the moment the crowd recovers', async () => {
    // A rescued fight must not inherit an escalating trickle. The gate is
    // re-read every tick, so a crowd that comes back turns the whole mechanism
    // off — and resets its ramp, or the next lull would resume at the cadence
    // the last one had climbed to.
    const { game } = await openFight(1, true)

    let ticks = 0
    let flanks = 0
    while (ticks < 2000 && flanks < 2 && game.phase.value === 'boss') {
      const b = game.getBoss()
      if (b) { b.hp = b.maxHp; b.guarded = SPENT; b.guard = 0 }
      game.steerTo(0)
      game.step(STEP_MS)
      flanks += drainFx().filter((e) => e.kind === 'summonFlank').length
      ticks++
    }
    expect(flanks, 'the trickle never started, so there is nothing to stand down from')
      .toBeGreaterThanOrEqual(1)

    // The cavalry arrives.
    game.debugAddUnits(SUMMON_MERCY_SQUAD + 40)
    drainFx()
    let after = 0
    for (let i = 0; i < 900 && game.phase.value === 'boss'; i++) {
      const b = game.getBoss()
      if (b) { b.hp = b.maxHp; b.guarded = SPENT; b.guard = 0 }
      if (game.squadCount.value <= SUMMON_MERCY_SQUAD) {
        game.debugAddUnits(SUMMON_MERCY_SQUAD + 40 - game.squadCount.value)
      }
      game.steerTo(0)
      game.step(STEP_MS)
      after += drainFx().filter((e) => e.kind === 'summonFlank').length
    }
    expect(after, `${after} bodies were still called up for a recovered crowd`).toBe(0)
    expect(game.getBoss()?.mercySpawns, 'the ramp was not reset').toBe(0)
  })
})
