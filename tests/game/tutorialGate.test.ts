// ─── The opening tutorial's hold ────────────────────────────────────────────
//
// Reported from Poki playtesting: the game started, and finished teaching
// itself, while the player was still reading the recording-consent dialog.
//
// The dialog lives outside the game's iframe, so the game receives no input at
// all while it is up. The tutorial's twelve-second bail-out spent itself against
// that, dismissed the tutorial, and started the road — so the player's first
// sight of the game was one already in progress that they had been taught
// nothing about.
//
// The rule that fixes it, and the one this file exists to keep:
//
//   THE BAIL-OUT MEASURES THE PLAYER'S PRESENCE, NOT THE WALL CLOCK.

import { describe, expect, it } from 'vitest'
import {
  newTutorialClock, tickTutorial, TUTORIAL_BAILOUT_MS, TUTORIAL_MOVE_EPS, TUTORIAL_MOVE_MS
} from '@/use/useTutorialGate'

const FRAME = 16

/** Run `ms` of frames, reporting the first outcome the clock produced. */
const run = (
  ms: number, sawInput: boolean, moveEachFrame: number, startX = 0
): { outcome: string | null; elapsed: number; progress: number } => {
  const clock = newTutorialClock(startX)
  let x = startX
  let progress = 0
  for (let t = 0; t < ms; t += FRAME) {
    x += moveEachFrame
    const tick = tickTutorial(clock, FRAME, sawInput, x)
    progress = tick.progress
    if (tick.outcome !== null) return { outcome: tick.outcome, elapsed: t + FRAME, progress }
  }
  return { outcome: null, elapsed: ms, progress }
}

describe('the tutorial waits for the player, not for the clock', () => {
  it('never releases on its own while the player has not arrived', () => {
    // Five minutes — twenty-five bail-outs' worth — of a game nobody has
    // touched. This is the consent dialog, the interstitial, the background tab.
    const r = run(5 * 60_000, false, 0.5)
    expect(r.outcome, 'the tutorial dismissed itself at an empty screen').toBeNull()
    // And it does not quietly bank progress it will spend the moment they look.
    expect(r.progress).toBe(0)
  })

  it('starts the road once the player has actually steered', () => {
    const r = run(30_000, true, 0.5)
    expect(r.outcome).toBe('moved')
    // A second of moving time, and not appreciably more.
    expect(r.elapsed).toBeGreaterThanOrEqual(TUTORIAL_MOVE_MS)
    expect(r.elapsed).toBeLessThan(TUTORIAL_MOVE_MS + 200)
  })

  it('still bails out for a player who is present but cannot steer', () => {
    // The safety valve the whole hold depends on: somebody IS here — they
    // tapped — but the squad never moves. A dead trackpad, a tap with no drag.
    // They must not be stranded at a frozen road.
    const r = run(30_000, true, 0)
    expect(r.outcome).toBe('bailout')
    expect(r.elapsed).toBeGreaterThanOrEqual(TUTORIAL_BAILOUT_MS)
    expect(r.elapsed).toBeLessThan(TUTORIAL_BAILOUT_MS + 200)
  })

  it('arms the bail-out from the first input, not from the first frame', () => {
    // The precise shape of the bug: time spent before the player arrived must
    // not be deducted from the patience they are owed after.
    const clock = newTutorialClock(0)
    for (let t = 0; t < 60_000; t += FRAME) tickTutorial(clock, FRAME, false, 0)
    expect(clock.waitedMs, 'the wait ran while nobody was there').toBe(0)

    // Now they arrive, and tap without steering. They get the FULL bail-out.
    let outcome: string | null = null
    let elapsed = 0
    for (let t = 0; t < 30_000 && outcome === null; t += FRAME) {
      outcome = tickTutorial(clock, FRAME, true, 0).outcome
      elapsed = t + FRAME
    }
    expect(outcome).toBe('bailout')
    expect(elapsed).toBeGreaterThanOrEqual(TUTORIAL_BAILOUT_MS)
  })

  it('credits the crowd moving, not the finger being down', () => {
    // Sub-threshold drift — a resting hand, a spring settling — is not a lesson.
    const r = run(30_000, true, TUTORIAL_MOVE_EPS / 2)
    expect(r.outcome, 'noise counted as steering').toBe('bailout')
  })

  it('does not bank the drift that happened before the player arrived', () => {
    // The formation settles on its own for a while, then the player shows up.
    // That settling is not theirs, and must not shorten their lesson.
    const clock = newTutorialClock(0)
    let x = 0
    for (let t = 0; t < 5000; t += FRAME) { x += 0.5; tickTutorial(clock, FRAME, false, x) }
    expect(clock.movedMs).toBe(0)
    // The very first credited frame is measured against where the crowd is NOW.
    const first = tickTutorial(clock, FRAME, true, x)
    expect(first.progress).toBe(0)
  })
})
