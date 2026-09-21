import { describe, expect, it } from 'vitest'
import {
  winBeatPlan, winConditionIcon, winConditionOf, winConditionBoss,
  WIN_BOSS_LEAD_MS, WIN_CARD_AT_MS, WIN_FREEZE_MS, WIN_ZOOM_AMOUNT, WIN_ZOOM_IN_MS
} from '@/game/winBeat'

/**
 * ─── The win beat, asserted without a canvas ────────────────────────────────
 *
 * The beat exists because the result screen used to arrive 900 ms after the
 * last squish, which is a cut rather than a pause. Every property below is one
 * that, if it broke, would put the game back where it was — and none of them
 * can be seen by looking at the code, because the numbers are spread across a
 * plan, a renderer and a component.
 */

const QUOTA = { quota: 20, boss: null, party: false }

describe('the beat\'s timeline', () => {
  it('holds for the freeze the owner asked for, after the camera has arrived', () => {
    const p = winBeatPlan({ boss: false, calm: false, celebrateMs: 900 })
    // The whole point: the hold is the push PLUS two seconds of nothing, not
    // two seconds that the push spends half of.
    expect(p.holdMs).toBe(WIN_ZOOM_IN_MS + WIN_FREEZE_MS)
    expect(p.holdMs - p.zoomAtMs - p.zoomMs).toBe(WIN_FREEZE_MS)
  })

  it('never holds for LESS than the celebration it replaced', () => {
    // A boss's afterglow is 1.7 s and the old code held exactly that. Whatever
    // else this beat does, the confetti it used to cut off still has to finish:
    // a plan that came out shorter than its input would be a regression wearing
    // a feature's name.
    for (const celebrateMs of [900, 1700, 4000, 10_000]) {
      for (const boss of [false, true]) {
        expect(winBeatPlan({ boss, calm: false, celebrateMs }).holdMs)
          .toBeGreaterThanOrEqual(celebrateMs)
      }
    }
  })

  it('starts the card AFTER the camera, not with it', () => {
    // Both on the same frame reads as a screen change, which is the thing this
    // beat exists to stop being. The card has to land on a push already under
    // way, so that it reads as a consequence of the squash.
    const p = winBeatPlan({ boss: false, calm: false, celebrateMs: 900 })
    expect(p.cardAtMs).toBeGreaterThan(p.zoomAtMs)
    expect(p.cardAtMs).toBe(WIN_CARD_AT_MS)
    // …and while the push is still travelling, not after it has parked.
    expect(p.cardAtMs).toBeLessThan(p.zoomAtMs + p.zoomMs)
  })

  it('lets a boss death play its own beats first', () => {
    const p = winBeatPlan({ boss: true, calm: false, celebrateMs: 1700 })
    expect(p.leadMs).toBe(WIN_BOSS_LEAD_MS)
    expect(p.zoomAtMs).toBe(WIN_BOSS_LEAD_MS)
    expect(p.cardAtMs).toBe(WIN_BOSS_LEAD_MS + WIN_CARD_AT_MS)
    // The rupture and the shout land at ~90 ms and ~230 ms (`bossDeath`). The
    // card may not cover either — it would be a readout of a number over the
    // most expensive animation in the game.
    expect(p.cardAtMs).toBeGreaterThan(430)
  })
})

describe('reduced motion', () => {
  it('drops the camera push and NOTHING else', () => {
    const loud = winBeatPlan({ boss: false, calm: false, celebrateMs: 900 })
    const quiet = winBeatPlan({ boss: false, calm: true, celebrateMs: 900 })
    expect(loud.zoomAmount).toBe(WIN_ZOOM_AMOUNT)
    expect(quiet.zoomAmount).toBe(0)
    // A player who cannot take a moving screen still deserves to be told which
    // condition ended their level, and still deserves the time to read it.
    expect(quiet.cardAtMs).toBe(loud.cardAtMs)
    expect(quiet.holdMs).toBe(loud.holdMs)
  })
})

describe('which condition ended the level', () => {
  it('reads the quota on an ordinary level', () => {
    expect(winConditionOf(QUOTA)).toEqual({ kind: 'quota', n: 20 })
    expect(winConditionIcon({ kind: 'quota', n: 20 })).toBe('bug')
    expect(winConditionBoss({ kind: 'quota', n: 20 })).toBeNull()
  })

  it('prefers the BOSS over the quota its spec still carries', () => {
    // A boss level's spec has a quota it never grades — the fight is the level.
    // Reading the quota first would put "40 of 40" on the card at the exact
    // moment a queen ant burst.
    const c = winConditionOf({ quota: 40, boss: 'queenAnt', party: false })
    expect(c).toEqual({ kind: 'boss', id: 'queenAnt' })
    expect(winConditionBoss(c!)).toBe('queenAnt')
    expect(winConditionIcon(c!)).toBe('skull')
  })

  it('prefers the PARTY over everything, because its clock is its only ending', () => {
    expect(winConditionOf({ quota: 40, boss: 'queenAnt', party: true }))
      .toEqual({ kind: 'party' })
    expect(winConditionIcon({ kind: 'party' })).toBe('clock')
  })

  it('has nothing to say about a level with no condition at all', () => {
    // Not reachable in the campaign; the card simply does not come up, which is
    // better than a card asserting `0 / 0`.
    expect(winConditionOf({ quota: 0, boss: null, party: false })).toBeNull()
  })
})
