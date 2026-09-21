import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import * as sim from '@/use/useBugCrunchGame'
import * as art from '@/use/useBugCrunchArt'
import type { GameEvent } from '@/use/useBugCrunchGame'
import { clearParticles, particleCount } from '@/use/useVfx'
import { JUICE_STYLE } from '@/game/juiceStyle'
import { BOSS_FIGHTS } from '@/game/stages'

/**
 * ─── The squish, and what a player actually sees of it ───────────────────────
 *
 * Three things were wrong with the loudest moment this game has, and all three
 * were invisible to a green suite because none of them had a test at all.
 *
 *   1. THE WORD WAS UNDER THE PLAYER'S HAND. It was stamped on the kill, and on
 *      touch the shoe rides `TOUCH_LIFT_U` above the fingertip — so the word
 *      landed in the space a thumb occupies. It also needed ×3 to appear, so the
 *      first rung of the ladder (SQUISH!) was never shown to anybody who was not
 *      already chaining.
 *   2. THE BOSS DIED ON A STILL FRAME. `finish` stops the step, the afterglow was
 *      only ever claimed by the tap finisher, and the boss's 1.2 s death
 *      animation runs off a clock inside `stepBoss` — so it never advanced.
 *   3. NOTHING WAS LIQUID. A burst was round coloured dots, which is what dust
 *      is, and a boss going down never reached the burst at all.
 *
 * The renderer is driven directly here, which it can be: `applyEvents` and
 * `stepFx` touch no canvas (the decal layer asks jsdom for a 2D context, does
 * not get one, and returns), so its pools are observable without one.
 */

const BOARD = { w: 100, h: 180, x0: 5, y0: 10, x1: 95, y1: 170 }
const FRAME = 1000 / 60

/**
 * The first boss fight in the campaign, read from the data rather than guessed —
 * the half-strength Queen, which is the only one a headless fight can finish
 * inside its own level clock.
 */
const BOSS_LEVEL = Number(Object.keys(BOSS_FIGHTS)[0])

const start = (level = 1, touch = false): void => {
  sim.setBoard(BOARD)
  sim.setTouch(touch)
  sim.startLevel({
    level, shoe: 'sneaker', juiceStyle: 'ooze', singleTap: false,
    difficulty: 1, relief: 1, seed: 1234
  })
  sim.resetVial()
  sim.drainEvents()
  art.resetArt()
  clearParticles()
}

const run = (ms: number): void => {
  for (let t = 0; t < ms; t += FRAME) {
    vi.advanceTimersByTime(FRAME)
    sim.step(FRAME)
  }
}

/** Put the foot on a point immediately — no spring, no travel time. */
const footAt = (x: number, y: number): void => {
  const f = sim.getFoot()
  sim.aim(x, y)
  f.x = x
  f.y = y
  f.state = 'hover'
  f.timer = 0
  f.charge = 0
  f.z = 0.3
}

/** A complete quick stomp at (x, y): press, land, resolve. */
/**
 * A complete quick stomp at (x, y): press, release, land, resolve.
 *
 * The RELEASE fires the blow — a press no longer opens with one, so a charge is
 * always possible from anywhere, including on top of a body (see `press`). The
 * press and release are back to back and the frames run afterwards, which keeps
 * a tap's total elapsed time exactly what it was before the control changed.
 */
const tapAt = (x: number, y: number): GameEvent[] => {
  footAt(x, y)
  sim.drainEvents()
  sim.press(x, y, performance.now())
  sim.release()
  run(140)
  return sim.drainEvents()
}

/**
 * Advance the renderer's own clocks, a frame at a time.
 *
 * In slices, and that matters: a boss death sets `slowMo(640)`, so the first
 * 640 ms of WALL time buys only 190 ms of effect time. One big `stepFx(600)`
 * would fire the first staged beat and none of the others.
 */
const runFx = (ms: number): void => {
  for (let t = 0; t < ms; t += FRAME) art.stepFx(FRAME)
}

/**
 * Take the boss down.
 *
 * Through `__bossDown`, which runs the real `advanceBossPhase` kill branch — the
 * afterglow, the `bossDown` event, the win. What it skips is the fighting, and it
 * has to: every fight's last phase is armoured and open only on a counter
 * window, so a headless suite cannot reach the ending inside the level's own
 * clock, and a suite that tried would be testing the counter.
 */
const killBoss = (): void => {
  sim.__bossDown()
  expect(sim.phase.value).toBe('won')
  expect(sim.getBoss()!.alive).toBe(false)
}

/** The most particles alive at any point over `ms` of effect time. Particles die
 *  of old age, so a count taken at the end of a boss death is a count of nothing. */
const peakParticles = (ms: number): number => {
  let peak = particleCount()
  for (let t = 0; t < ms; t += FRAME) {
    art.stepFx(FRAME)
    peak = Math.max(peak, particleCount())
  }
  return peak
}

/** One squish event, with every field the renderer reads. */
const squish = (over: Partial<Extract<GameEvent, { k: 'squish' }>> = {}) => ({
  k: 'squish' as const,
  x: 50, y: 90, bug: 'ant' as const, heavy: false,
  word: 'squish' as const, mult: 1, stretch: 1, angle: 0, face: 0,
  ...over
})

beforeAll(() => { vi.useFakeTimers({ toFake: ['performance'] }) })
afterAll(() => { vi.useRealTimers() })

beforeEach(() => {
  // Forwards, never back: the input code compares against this same clock.
  vi.advanceTimersByTime(60_000)
  start()
})

// ─── 1 · the comic word ─────────────────────────────────────────────────────

describe('the comic word a kill shouts', () => {
  it('is shouted on EVERY kill, not only from ×3 up', () => {
    art.applyEvents([squish({ mult: 1, word: 'squish' })])
    expect(art.__artStats().words).toBe(1)
    expect(art.__words()[0]!.tone).toBe('squish')
  })

  it('lands ABOVE the kill, and further above it on touch than on a mouse', () => {
    start(1, false)
    art.applyEvents([squish({ y: 90 })])
    const mouse = art.__words()[0]!.y

    vi.advanceTimersByTime(400)
    start(1, true)
    art.applyEvents([squish({ y: 90 })])
    const finger = art.__words()[0]!.y

    // Screen y grows downward, so "above" is a smaller y.
    expect(mouse).toBeLessThan(90)
    expect(finger).toBeLessThan(mouse)
  })

  it('is clamped onto the board, so the lift can never carry it off the top', () => {
    start(1, true)
    // A kill right against the top edge: the touch lift alone is 13 u.
    art.applyEvents([squish({ y: BOARD.y0 + 1 })])
    const w = art.__words()[0]!
    expect(w.y).toBeGreaterThanOrEqual(BOARD.y0)
    expect(w.x).toBeGreaterThanOrEqual(BOARD.x0)
    expect(w.x).toBeLessThanOrEqual(BOARD.x1)
  })

  it('merges a slam that kills five bodies into ONE word, not five', () => {
    art.applyEvents([
      squish({ x: 40 }), squish({ x: 44 }), squish({ x: 48 }),
      squish({ x: 52 }), squish({ x: 56 })
    ])
    expect(art.__artStats().words).toBe(1)
  })

  it('…and shouts again once the gap has passed', () => {
    art.applyEvents([squish()])
    expect(art.__artStats().words).toBe(1)
    vi.advanceTimersByTime(400)
    art.applyEvents([squish()])
    expect(art.__artStats().words).toBe(2)
  })
})

// ─── 2 · the liquid ─────────────────────────────────────────────────────────

describe('the goo a body bursts into', () => {
  it('throws velocity-aligned droplets alongside the round burst', () => {
    clearParticles()
    art.applyEvents([squish()])
    // Both halves of the burst, so a kill is never dots alone.
    expect(particleCount()).toBeGreaterThan(JUICE_STYLE.ooze.burst)
  })

  it('throws none in the confetti style, which promises nothing bursts wetly', () => {
    expect(JUICE_STYLE.confetti.drops).toBe(0)
    expect(JUICE_STYLE.ooze.drops).toBeGreaterThan(0)
  })

  it('leaves a flattened ghost of the body behind for a beat', () => {
    art.applyEvents([squish()])
    expect(art.__artStats().squashes).toBe(1)
    // …and it is gone again well inside a second, so a corpse is never sitting
    // under the next stomp.
    runFx(400)
    expect(art.__artStats().squashes).toBe(0)
  })
})

// ─── 3 · the boss goes down ─────────────────────────────────────────────────

describe('a boss going down', () => {
  it('is a SEQUENCE: the shout arrives after the hit, not on the same frame', () => {
    art.applyEvents([{ k: 'bossDown', x: 50, y: 90 }])
    // Beat one is the hit. Nothing has been said yet.
    expect(art.__artStats().words).toBe(0)
    expect(art.__artStats().beats).toBeGreaterThan(0)
    // Enough EFFECT time for every beat, and then the word is up.
    runFx(2200)
    expect(art.__artStats().words).toBe(1)
    expect(art.__words()[0]!.tone).toBe('ultra')
    expect(art.__artStats().beats).toBe(0)
  })

  it('throws far more goo than an ordinary kill', () => {
    clearParticles()
    art.applyEvents([squish()])
    const oneBug = peakParticles(0)
    clearParticles()
    art.applyEvents([{ k: 'bossDown', x: 50, y: 90 }])
    expect(peakParticles(2200)).toBeGreaterThan(oneBug * 2)
  })

  it('drops its queued beats when the next level starts', () => {
    art.applyEvents([{ k: 'bossDown', x: 50, y: 90 }])
    expect(art.__artStats().beats).toBeGreaterThan(0)
    art.resetArt()
    expect(art.__artStats().beats).toBe(0)
    runFx(2200)
    expect(art.__artStats().words).toBe(0)
  })
})

// ─── 4 · …and the board keeps living while it does ──────────────────────────

describe('the sim during a boss death', () => {
  it('claims an afterglow, so the death animation has a clock to run on', () => {
    start(BOSS_LEVEL)
    expect(sim.getBoss()).not.toBeNull()
    killBoss()
    expect(sim.getBoss()!.alive).toBe(false)

    // `step` used to return 0 from here forever: `finish` had stopped it and no
    // afterglow had been claimed, so the boss froze mid-stride at full opacity
    // while a ring expanded past her.
    const before = sim.getBoss()!.dying
    run(300)
    expect(sim.getBoss()!.dying).toBeGreaterThan(before + 200)
  })

  it('runs the whole 1.2 s of it inside the celebration hold', () => {
    start(BOSS_LEVEL)
    killBoss()
    run(sim.BOSS_AFTERGLOW_MS)
    // Fully faded: the renderer clamps at 1200 ms of `dying`.
    expect(sim.getBoss()!.dying).toBeGreaterThanOrEqual(1200)
  })
})

// ─── 5 · the squish event carries what the ghost needs ──────────────────────

describe('the squish event', () => {
  it("carries the BODY's heading as well as the blow's", () => {
    start(1)
    for (const b of sim.getBugs()) b.alive = false
    const b = sim.spawnBug('ant', 50, 90)
    expect(b).not.toBeNull()
    b!.heading = 1.25
    const kill = tapAt(50, 90).find((e) => e.k === 'squish')
    expect(kill).toBeDefined()
    if (kill?.k === 'squish') {
      expect(kill.face).toBeCloseTo(1.25, 5)
      // …and the blow's own line, which is what the ghost is squashed along.
      expect(typeof kill.angle).toBe('number')
    }
  })
})
