// ─── An elite slows the road; it does not switch it off ─────────────────────
//
// Reported by players as "you can't get past the mini-boss". It was never a
// soft-lock — the leash breaks the hold — but on the runs that struggle the
// crowd was pinned for three to seven seconds while being chewed, and in a genre
// whose entire promise is forward motion a runner that stops moving does not
// read as a fight. It reads as a hung game, and the player spends those seconds
// steering to no effect, which is the one input that normally does something.

import { describe, expect, it } from 'vitest'
import {
  ELITE_BLOCK_AHEAD, ELITE_DRAG_LEAD, ELITE_DRAG_MIN, eliteDragFor
} from '@/game/survival'

const STEP_MS = 16

describe('the drag curve', () => {
  it('is full speed well clear, and a crawl at the body', () => {
    expect(eliteDragFor(ELITE_DRAG_LEAD + 5)).toBe(1)
    expect(eliteDragFor(ELITE_DRAG_LEAD)).toBe(1)
    expect(eliteDragFor(ELITE_BLOCK_AHEAD)).toBe(ELITE_DRAG_MIN)
    expect(eliteDragFor(0)).toBe(ELITE_DRAG_MIN)
  })

  it('never reaches zero — that is the whole point', () => {
    for (let gap = -2; gap <= ELITE_DRAG_LEAD + 2; gap += 0.25) {
      expect(eliteDragFor(gap), `gap ${gap} stopped the road`).toBeGreaterThan(0)
    }
  })

  it('winds down monotonically, gently first and firmly at the end', () => {
    let last = eliteDragFor(ELITE_DRAG_LEAD)
    for (let gap = ELITE_DRAG_LEAD; gap >= ELITE_BLOCK_AHEAD; gap -= 0.25) {
      const now = eliteDragFor(gap)
      expect(now).toBeLessThanOrEqual(last + 1e-9)
      last = now
    }
    // Squared, so the first half of the approach keeps most of its speed: a
    // linear ramp reads as the game getting sluggish rather than as arriving at
    // something.
    const mid = ELITE_BLOCK_AHEAD + (ELITE_DRAG_LEAD - ELITE_BLOCK_AHEAD) / 2
    expect(eliteDragFor(mid)).toBeLessThan(0.5)
  })
})

describe('the crowd keeps moving through an elite fight', () => {
  it('never stalls, on any stage, for any squad', async () => {
    const game = await import('@/use/useSurvivalGame')
    const { __resetTowerState } = await import('@/use/useTowerState')

    let engagedFrames = 0
    let longestStall = 0

    // Several stages and several squad sizes, because a single run is a poor
    // sample: a big crowd deletes the elite in a few frames and a small one dies
    // on the way, and neither spends long enough beside it to prove anything.
    for (const [stage, extra] of [[3, 0], [5, 40], [8, 90], [10, 60]] as const) {
      localStorage.clear()
      __resetTowerState()
      game.startStage(stage)
      if (extra > 0) game.debugAddUnits(extra)

      let run = 0
      let prevY = game.anchor().y
      for (let i = 0; i < 6000; i++) {
        game.step(STEP_MS)
        const y = game.anchor().y
        const elite = game.getFoes().find((f) => f.elite && !f.dead && f.hold > 0)
        const near = elite !== undefined && elite.y >= y && elite.y - y <= ELITE_DRAG_LEAD
        if (near) {
          engagedFrames++
          // "Stalled" means the road genuinely did not advance this frame.
          if (y - prevY <= 1e-6) { run++; longestStall = Math.max(longestStall, run) }
          else run = 0
        } else {
          run = 0
        }
        prevY = y
        if (game.phase.value !== 'run' && game.phase.value !== 'boss') break
      }
    }

    expect(engagedFrames, 'no run ever met a holding elite').toBeGreaterThan(60)
    // A few frames can legitimately stall against the body backstop; SECONDS of
    // it is the bug players reported as "you can't get past the mini-boss".
    const longestStallMs = longestStall * STEP_MS
    expect(longestStallMs, `the crowd stood still for ${longestStallMs}ms`)
      .toBeLessThan(700)
  })
})
