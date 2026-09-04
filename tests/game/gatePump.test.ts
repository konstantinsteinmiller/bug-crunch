// ─── A gate is only a decision if the player's fire changes the answer ──────
//
// The banks were `+7 | +8` — arithmetic with one right answer, readable off the
// doors without knowing anything about the run. Two changes make them questions:
// the scale ops pump like the additive ones already did, and a multiplier OPENS
// below its headline so that at rest it is usually the worse deal.
//
// Together those mean a `x2` door is an investment. Take it cold and it is a
// `x1.6`; spend the approach shooting it and it is worth twice that. The crowd
// has one stream of fire, so whatever it is pointed at is the door being paid
// for — and the door it is not pointed at stays where it is.

import { describe, expect, it } from 'vitest'
import {
  GATE_DIV_MAX, GATE_MUL_MAX, GATE_SCALE_STEP, GATE_TICK_MS, gateMulOpen, gateValueLabel
} from '@/game/survival'

describe('what a multiplier is worth', () => {
  it('opens below its headline, so taking it cold is a real cost', () => {
    expect(gateMulOpen(2)).toBe(1.6)
    expect(gateMulOpen(3)).toBe(2.4)
    // The headline still ranks the doors — a x3 is visibly the bigger one.
    expect(gateMulOpen(3)).toBeGreaterThan(gateMulOpen(2))
  })

  it('is usually the WORSE door until it has been shot', () => {
    // A `x1.6` pays `crowd x 0.6`. Against the `+9` it is authored beside on
    // stage 1, that does not break even until fifteen survivors — so for most of
    // the stage the flat number is correct, and the multiplier only wins for a
    // player who committed their fire to it.
    const add = 9
    const cold = (crowd: number) => crowd * (gateMulOpen(2) - 1)
    expect(cold(10)).toBeLessThan(add)
    expect(cold(15)).toBeGreaterThanOrEqual(add)

    // Pumped to the cap it breaks even at five, which is every crowd that
    // reaches it. That swing IS the decision.
    const hot = (crowd: number) => crowd * (GATE_MUL_MAX - 1)
    expect(hot(5)).toBeGreaterThanOrEqual(add)
  })
})

describe('the scale doors pump', () => {
  it('moves in tenths, where the additive doors move in whole survivors', () => {
    expect(GATE_SCALE_STEP).toBe(0.1)
    // A full approach is a handful of ticks, so the swing is meaningful without
    // a multiplier ever becoming a `+N` in disguise.
    const ticksIn3s = 3000 / GATE_TICK_MS
    expect(gateMulOpen(2) + ticksIn3s * GATE_SCALE_STEP).toBeLessThanOrEqual(GATE_MUL_MAX)
  })

  it('pumps the trap in the direction that hurts', () => {
    // The whole point of the trap pumping: shooting one makes it worse, which is
    // what finally puts a price on not choosing a door.
    expect(GATE_DIV_MAX).toBeGreaterThan(2)
  })

  it('prints a tenth only when it has one', () => {
    // `x2.0` on an untouched door would read as a bug.
    expect(gateValueLabel(2)).toBe('2')
    expect(gateValueLabel(1.6)).toBe('1.6')
    expect(gateValueLabel(2.4)).toBe('2.4')
  })
})

describe('the crowd pays for what it aims at', () => {
  // THIS TEST SHIPPED THE BUG IT WAS WRITTEN TO CATCH, and the way it did is
  // worth keeping in front of whoever edits it next.
  //
  // It used to `return` the moment it saw a door grow, and its only assertion
  // outside that branch was "a multiplier bank streamed in". So when multipliers
  // could not be pumped at all — the bullet that flags a gate as being shot at
  // named `add` and `sub` explicitly and silently ignored `mul` and `div` — the
  // test still passed, because a bank had indeed streamed in. A vacuous green.
  //
  // Every path through the checks below now ends in an assertion about the
  // VALUE. Growing is the claim; arriving is not.

  /** Run stage `stage` holding the given op's leaf, and report what it did. */
  const rideLeaf = async (
    stage: number, op: 'mul' | 'div' | 'add'
  ): Promise<{ open: number; peak: number } | null> => {
    const game = await import('@/use/useSurvivalGame')
    const { __resetTowerState } = await import('@/use/useTowerState')
    localStorage.clear()
    __resetTowerState()

    game.startStage(stage)
    game.debugAddUnits(40)

    let open: number | null = null
    let peak = 0
    for (let i = 0; i < 6000; i++) {
      const g = game.getGates().find((x) => x.op === op && !x.used)
      if (g) {
        if (open === null) open = g.value
        peak = Math.max(peak, g.value)
        game.steerTo(g.x)
      }
      game.step(16)
      if (game.phase.value !== 'run' && game.phase.value !== 'boss') break
    }
    return open === null ? null : { open, peak }
  }

  it('pumps a MULTIPLIER the squad is shooting', async () => {
    const seen = await rideLeaf(1, 'mul')
    expect(seen, 'stage 1 never streamed a multiplier bank').not.toBeNull()
    expect(seen!.open).toBe(gateMulOpen(2))
    expect(seen!.peak, 'the x2 door could not be pumped').toBeGreaterThan(seen!.open)
    expect(seen!.peak).toBeLessThanOrEqual(GATE_MUL_MAX)
  })

  it('pumps a TRAP the squad is shooting, in the direction that hurts', async () => {
    // The other half of the same rule, and the reason it matters: hosing a trap
    // has to cost something, or straddling the pillar is free.
    const seen = await rideLeaf(2, 'div')
    expect(seen, 'stage 2 never streamed a trap bank').not.toBeNull()
    expect(seen!.peak, 'the ÷N door could not be pumped').toBeGreaterThan(seen!.open)
    expect(seen!.peak).toBeLessThanOrEqual(GATE_DIV_MAX)
  })

  it('still pumps the additive doors it always did', async () => {
    const seen = await rideLeaf(1, 'add')
    expect(seen, 'stage 1 never streamed an additive bank').not.toBeNull()
    expect(seen!.peak, 'the +N door stopped pumping').toBeGreaterThan(seen!.open)
  })
})
