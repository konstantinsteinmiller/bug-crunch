// ─── The face-down door ─────────────────────────────────────────────────────
//
// Every bank in this game is arithmetic: two numbers, take the bigger. A player
// who has learned the arithmetic is executing it rather than deciding anything.
// One leaf drawn as a `?` cannot be executed — so the bank becomes a gamble the
// player takes or refuses, and the refusal is as real a decision as the
// acceptance, because the readable leaf beside it is always still there.
//
// The rules are what keep that fair rather than arbitrary, and each one has a
// failure mode: a bank of two unknowns is a coin flip, a hidden leaf on a
// dilemma turns a hard choice into an unfair one, and a door nobody can read
// must not absorb fire it cannot visibly repay.

import { describe, expect, it, vi } from 'vitest'
import { MYSTERY_STAGE, buildTrack, maxMysteries, mysteryChance } from '@/game/track'
import type { GateLeaf, TrackEvent } from '@/game/track'
import { STATE_KEY } from '@/use/useTowerState'

type Bank = Extract<TrackEvent, { kind: 'gates' }>

const banksOf = (stage: number): Bank[] =>
  buildTrack(stage).events.filter((e): e is Bank => e.kind === 'gates')

const hidden = (bank: Bank): GateLeaf[] => bank.leaves.filter((l) => l.mystery === true)

/** Both doors take something — the one shape a mystery may never land on. */
const isDilemma = (bank: Bank): boolean =>
  bank.leaves.length > 1 && bank.leaves.every((l) => l.op === 'div' || l.op === 'sub')

describe('where a face-down door may appear', () => {
  it('never before the arithmetic has been learned', () => {
    // A `?` is only interesting to somebody who knows what a readable door is
    // worth, and `÷` and `×` both have to have been met first.
    for (let stage = 1; stage < MYSTERY_STAGE; stage++) {
      expect(mysteryChance(stage)).toBe(0)
      expect(maxMysteries(stage)).toBe(0)
      expect(banksOf(stage).flatMap(hidden)).toHaveLength(0)
    }
  })

  it('is at most one bank on any road, ever', () => {
    // Two is a theme; the road's theme is arithmetic.
    for (let stage = MYSTERY_STAGE; stage <= 60; stage++) {
      const banks = banksOf(stage)
      expect(banks.filter((b) => hidden(b).length > 0).length).toBeLessThanOrEqual(1)
    }
  })

  it('hides at most ONE leaf of the bank it lands on', () => {
    // A bank of two unknowns is a coin flip with no decision in it, which is
    // the opposite of the point.
    for (let stage = MYSTERY_STAGE; stage <= 60; stage++) {
      for (const bank of banksOf(stage)) {
        expect(hidden(bank).length).toBeLessThanOrEqual(1)
        if (hidden(bank).length === 1) expect(bank.leaves.length).toBeGreaterThan(1)
      }
    }
  })

  it('never lands on a bank where both doors already take something', () => {
    for (let stage = MYSTERY_STAGE; stage <= 60; stage++) {
      for (const bank of banksOf(stage)) {
        if (hidden(bank).length > 0) expect(isDilemma(bank)).toBe(false)
      }
    }
  })

  it('turns up often enough to be a thing the road does, rarely enough to be an event', () => {
    // Calibration, not decoration: the number that matters is how many STAGES
    // carry one, because a player meets the feature once a road or not at all.
    let withOne = 0
    for (let stage = MYSTERY_STAGE; stage <= 60; stage++) {
      if (banksOf(stage).some((b) => hidden(b).length > 0)) withOne++
    }
    const share = withOne / (60 - MYSTERY_STAGE + 1)
    expect(share).toBeGreaterThan(0.2)
    expect(share).toBeLessThan(0.8)
  })

  it('is the same road twice, so a reload cannot re-roll the gamble', () => {
    // Its own stream, seeded off the stage like everything else the generator
    // rolls. A `?` that moved on a retry would be a slot machine.
    const a = banksOf(21).map((b) => b.leaves.map((l) => l.mystery === true))
    const b = banksOf(21).map((x) => x.leaves.map((l) => l.mystery === true))
    expect(a).toEqual(b)
  })
})

describe('the door in the world', () => {
  const STEP_MS = 16

  const boot = async (stage: number) => {
    localStorage.setItem(STATE_KEY, JSON.stringify({ ts_stage: stage }))
    vi.resetModules()
    const game = await import('@/use/useSurvivalGame')
    game.startStage(stage)
    return game
  }

  /** The first stage from `MYSTERY_STAGE` up whose road actually prints one. */
  const stageWithMystery = (): number => {
    for (let stage = MYSTERY_STAGE; stage <= 60; stage++) {
      if (banksOf(stage).some((b) => hidden(b).length > 0)) return stage
    }
    throw new Error('no stage in 9..60 rolls a mystery — the odds regressed')
  }

  it('reaches the run with its flag intact, and its real value underneath', async () => {
    const stage = stageWithMystery()
    const game = await boot(stage)
    // Walk far enough that the whole road has streamed in.
    for (let i = 0; i < 4000; i++) {
      if (game.phase.value !== 'run') break
      game.steerTo(0)
      game.step(STEP_MS)
      if (game.getGates().some((g) => g.mystery)) break
    }
    const faceDown = game.getGates().find((g) => g.mystery)
    expect(faceDown).toBeDefined()
    // The op and value under it are perfectly ordinary — a mystery is a way of
    // PRESENTING a rolled door, not a fifth kind of door.
    expect(['add', 'sub', 'mul', 'div']).toContain(faceDown!.op)
    expect(Number.isFinite(faceDown!.value)).toBe(true)
  })

  it('cannot be pumped, so no fire is spent on a promise', async () => {
    const stage = stageWithMystery()
    const game = await boot(stage)
    for (let i = 0; i < 4000; i++) {
      if (game.phase.value !== 'run') break
      game.steerTo(0)
      game.step(STEP_MS)
      if (game.getGates().some((g) => g.mystery)) break
    }
    const faceDown = game.getGates().find((g) => g.mystery)
    expect(faceDown).toBeDefined()

    // Hold it hot for well over a tick's worth of charge. A readable door would
    // have climbed several times over by now.
    const before = faceDown!.value
    for (let i = 0; i < 120; i++) {
      faceDown!.hotFor = 0
      game.step(STEP_MS)
      if (faceDown!.used) break
    }
    expect(faceDown!.value).toBe(before)
    expect(faceDown!.charge).toBe(0)
  })

  it('shows every leaf of the bank the moment the crowd commits', async () => {
    // Both halves matter. Turning over only the taken door would leave the
    // player unable to tell whether they gambled well; "what was the other one"
    // is most of what makes the next `?` worth taking.
    const stage = stageWithMystery()
    const game = await boot(stage)
    let bankId = -1
    for (let i = 0; i < 4000; i++) {
      if (game.phase.value !== 'run') break
      const faceDown = game.getGates().find((g) => g.mystery && !g.used)
      if (faceDown) {
        bankId = faceDown.bankId
        game.steerTo(faceDown.x)
      } else if (bankId >= 0) {
        break
      } else {
        game.steerTo(0)
      }
      game.step(STEP_MS)
    }
    expect(bankId).toBeGreaterThanOrEqual(0)
    // Every leaf of that bank is face-up now, taken and dismissed alike.
    const bank = game.getGates().filter((g) => g.bankId === bankId)
    expect(bank.length).toBeGreaterThan(0)
    expect(bank.every((g) => g.mystery === false)).toBe(true)
  })
})
