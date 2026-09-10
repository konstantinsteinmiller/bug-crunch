import { describe, expect, it } from 'vitest'
import {
  FIRST_MILESTONE, crossedMilestone, milestoneAtOrBelow, milestoneRung
} from '@/components/game/squadMilestones'

/**
 * ─── The round-number ladder ────────────────────────────────────────────────
 *
 * The feature is one line of feedback and three ways to get it wrong, and all
 * three are silent in a playthrough: it fires too often (a squad hovering on a
 * rung), it fires for ground already covered (a rally), or it stops firing
 * exactly when the run gets interesting (a fixed ceiling). Every case below is
 * one of those, written as the run that produces it.
 */

describe('the ladder doubles, and it does not stop', () => {
  it('starts at 25 and doubles', () => {
    expect(FIRST_MILESTONE).toBe(25)
    expect([25, 50, 100, 200, 400, 800].map(milestoneAtOrBelow)).toEqual([25, 50, 100, 200, 400, 800])
  })

  it('says nothing at all below the first rung', () => {
    for (const squad of [0, 1, 12, 24]) expect(milestoneAtOrBelow(squad)).toBe(0)
  })

  it('reports the rung BELOW an in-between number, never the one above', () => {
    expect(milestoneAtOrBelow(26)).toBe(25)
    expect(milestoneAtOrBelow(199)).toBe(100)
    expect(milestoneAtOrBelow(201)).toBe(200)
    expect(milestoneAtOrBelow(1500)).toBe(800)
  })

  it('keeps going into four figures — the band the whole extension exists for', () => {
    expect(milestoneAtOrBelow(1600)).toBe(1600)
    expect(milestoneAtOrBelow(3200)).toBe(3200)
    expect(milestoneAtOrBelow(9999)).toBe(6400)
  })

  it('survives the numbers a broken prop can hand a HUD', () => {
    for (const bad of [NaN, Infinity, -Infinity, -5]) expect(milestoneAtOrBelow(bad)).toBe(0)
  })

  it('numbers the rungs from zero so the fanfare can climb with them', () => {
    expect([25, 50, 100, 200, 400, 800, 1600].map(milestoneRung)).toEqual([0, 1, 2, 3, 4, 5, 6])
    // Anything under the first rung is rung zero rather than a negative index —
    // the mixer floors it anyway, but a negative here would read as a bug.
    expect(milestoneRung(0)).toBe(0)
    expect(milestoneRung(NaN)).toBe(0)
  })
})

describe('a milestone is announced once per run, on the way UP', () => {
  it('announces the rung the squad just reached', () => {
    expect(crossedMilestone(0, 25)).toBe(25)
    expect(crossedMilestone(25, 50)).toBe(50)
  })

  it('stays silent for a squad oscillating on a rung', () => {
    // 100 → 96 (a `-N` leaf) → 100 again. The player did not do it twice.
    let highest = 100
    for (const squad of [96, 100, 88, 101, 100]) {
      const m = crossedMilestone(highest, squad)
      expect(m).toBe(0)
      if (m > 0) highest = m
    }
  })

  it('does not replay the ladder after a wipe and a rally', () => {
    // The crowd was at 140 (100 announced), got wiped to 3, and the rally
    // handed it back — then a `+` bank took it to 300.
    let highest = 100
    const announced: number[] = []
    for (const squad of [3, 12, 40, 90, 160, 300]) {
      const m = crossedMilestone(highest, squad)
      if (m > 0) { announced.push(m); highest = m }
    }
    expect(announced).toEqual([200])
  })

  it('announces the BIGGEST rung a single door crossed, not every one under it', () => {
    // A `×3` on a 300-strong crowd. Five rungs go by in one frame; the player
    // did one thing, so they hear one thing — and the loudest one.
    expect(crossedMilestone(200, 900)).toBe(800)
  })

  it('walks the ladder rung by rung when the squad grows gradually', () => {
    let highest = 0
    const announced: number[] = []
    for (let squad = 0; squad <= 420; squad += 7) {
      const m = crossedMilestone(highest, squad)
      if (m > 0) { announced.push(m); highest = m }
    }
    expect(announced).toEqual([25, 50, 100, 200, 400])
  })

  it('is armed again by a fresh run, which is what resetting `highest` to 0 means', () => {
    expect(crossedMilestone(400, 25)).toBe(0)
    expect(crossedMilestone(0, 25)).toBe(25)
  })
})
