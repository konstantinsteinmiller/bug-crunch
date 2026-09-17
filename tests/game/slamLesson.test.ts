import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import * as sim from '@/use/useBugCrunchGame'
import * as tutor from '@/use/useTutorial'
import { SLAM_GRACE_MS, lessonSpec, slamTeaches } from '@/game/tutorial'
import { bossSpec } from '@/game/bosses'
import { SLAM_PIERCE_BONUS, blowPierce, shoeSpec } from '@/game/shoes'
import { bugSpec } from '@/game/bugs'
import { allLevels, levelSpec } from '@/game/stages'

/**
 * ─── The big stomp's lesson ─────────────────────────────────────────────────
 *
 * The slam is the only mechanic in this game the player cannot stumble into.
 * Everything else is discoverable by pressing things — you move by dragging,
 * you squish by tapping, you chain by tapping again quickly — but a press held
 * past a threshold is not a thing anybody tries by accident, and a beetle that
 * bounces just looks broken.
 *
 * So its lesson is load-bearing, and it is ALSO one-shot: `bc_taught.slam` is
 * written once and the game never mentions the charged stomp again. That
 * combination is what makes the arming moment worth a file of its own.
 *
 * The regression this suite exists for, measured in a browser on the beetle's
 * level (1-4 then; the beetle has since moved to 1-3, see `stages.ts`): the
 * lesson was armed by the SIGHT of an armoured body, spent its fifteen-second
 * bail-out while the player was across the board squishing ants, and wrote
 * itself `taught` at t ≈ 14 s — before the player had touched a beetle even
 * once. Every case below is one half of the chain that replaced it.
 */

const BOARD = { w: 100, h: 180, x0: 5, y0: 10, x1: 95, y1: 170 }
const FRAME = 1000 / 60

/** 1-3: the beetle's level, and so the slam's. */
const BEETLE_LEVEL = 3

const start = (level = BEETLE_LEVEL, over: Partial<sim.StartOptions> = {}): void => {
  sim.setBoard(BOARD)
  sim.setTouch(false)
  sim.startLevel({
    level,
    shoe: 'sneaker',
    juiceStyle: 'ooze',
    singleTap: false,
    difficulty: 1,
    relief: 1,
    seed: 4321,
    ...over
  })
  sim.resetVial()
  sim.drainEvents()
}

/** Advance the world — and the wall clock with it — one frame at a time. */
const run = (ms: number): void => {
  for (let t = 0; t < ms; t += FRAME) {
    vi.advanceTimersByTime(FRAME)
    sim.step(FRAME)
  }
}

const clearFloor = (): void => {
  for (const b of sim.getBugs()) b.alive = false
}

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

/**
 * Hold a press until the foot's charge reaches `want`, then let go.
 *
 * A press ALWAYS opens with a quick stomp (see `press`), so the charge only
 * begins once that tap has landed and recovered — and the opening tap's events
 * are drained away before the release, so a caller that inspects the drain sees
 * the RELEASE and nothing else. Without that, the light stomp's own `clang` off
 * the same beetle turns up in the slam's events.
 */
const chargeTo = (x: number, y: number, want: number): void => {
  footAt(x, y)
  sim.press(x, y, performance.now())
  for (let i = 0; i < 400; i++) {
    if (sim.getFoot().state === 'charge' && sim.getFoot().charge >= want) break
    run(FRAME)
  }
  sim.drainEvents()
  sim.release()
  run(400)
}

beforeAll(() => { vi.useFakeTimers({ toFake: ['performance'] }) })
afterAll(() => { vi.useRealTimers() })

beforeEach(() => {
  // Forwards, never back: `lastPressAt` survives `startLevel`.
  vi.advanceTimersByTime(60_000)
  tutor.__resetTutorial()
  start(BEETLE_LEVEL)
})

describe('when the lesson is worth teaching at all', () => {
  const sneaker = shoeSpec('sneaker')
  const steel = shoeSpec('steelBoot')
  const bunny = shoeSpec('bunnySlipper')
  const light = (s: typeof sneaker) => blowPierce(s, false)
  const heavy = (s: typeof sneaker) => blowPierce(s, true)

  it('teaches the starter sneaker about the beetle — the whole point of 1-3', () => {
    const beetle = bugSpec('beetle')
    expect(slamTeaches(light(sneaker), heavy(sneaker), beetle.armor)).toBe(true)
  })

  it('says nothing to a shoe that taps straight through', () => {
    // The steel boot pierces 4 and the beetle's shell is 2. Teaching its owner
    // to charge would be teaching a slower way to do what they already do.
    const beetle = bugSpec('beetle')
    expect(light(steel)).toBeGreaterThanOrEqual(beetle.armor)
    expect(slamTeaches(light(steel), heavy(steel), beetle.armor)).toBe(false)
  })

  it('says nothing when a slam would bounce too — the shipped rule did not', () => {
    // The bunny slipper pierces 0; a slam carries +2; a robobug's shell is 3.
    // The old condition was `light < armor` alone, which is true here, and the
    // game would have spent its ONE teaching slot on a gesture that does not
    // work. A lesson has to be answerable.
    const robobug = bugSpec('robobug')
    expect(light(bunny)).toBeLessThan(robobug.armor)
    expect(heavy(bunny)).toBeLessThan(robobug.armor)
    expect(slamTeaches(light(bunny), heavy(bunny), robobug.armor)).toBe(false)
    // …and it is exactly the +2 that decides it.
    expect(heavy(bunny) - light(bunny)).toBe(SLAM_PIERCE_BONUS)
  })

  it('says nothing about a body with no shell at all', () => {
    for (const id of ['ant', 'sprinter'] as const) {
      expect(slamTeaches(light(sneaker), heavy(sneaker), bugSpec(id).armor)).toBe(false)
    }
  })

  it('is reachable on the level the game introduces the shell on', () => {
    // If 1-3's roster ever stops carrying the beetle, the lesson has no moment.
    expect(levelSpec(BEETLE_LEVEL).roster.map((r) => r.id)).toContain('beetle')
    expect(bugSpec('beetle').debut).toBeLessThanOrEqual(BEETLE_LEVEL)
  })

  // The first boss asks for the slam the level after the beetle taught it, and
  // her third phase is the same question: a shell a tap bounces off and a slam
  // opens. If a rebalance ever let the half-strength Queen be TAPPED through, the
  // scene would stop counting her as a shell and 1-4 would stop being the slam's
  // second chance — and if it made her unslammable, the lesson would point at a
  // gesture that does not work.
  it('counts the first boss\'s charge phase as a shell the lesson can answer', () => {
    const sneaker = shoeSpec('sneaker')
    const first = allLevels().find((l) => l.boss !== null)!
    expect(first.id).toBeGreaterThan(BEETLE_LEVEL)
    const charge = bossSpec(first.boss!, first.bossScale).phases.find((p) => p.script === 'charge')!
    expect(slamTeaches(blowPierce(sneaker, false), blowPierce(sneaker, true), charge.armor)).toBe(true)
  })
})

describe('when the lesson goes up', () => {
  const answerable = true

  it('does not arm on the mere SIGHT of a shell', () => {
    // Fourteen seconds of a beetle walking about while the player is busy
    // elsewhere. This is the frame the old build armed on, and the frame it
    // then burned its whole bail-out from.
    tutor.armSlam(3_000, answerable)
    expect(tutor.activeLesson.value).toBeNull()
  })

  it('arms the instant a blow rings off the shell', () => {
    tutor.armSlam(1_000, answerable)
    expect(tutor.activeLesson.value).toBeNull()
    tutor.noteRicochet()
    tutor.armSlam(FRAME, answerable)
    expect(tutor.activeLesson.value).toBe('slam')
  })

  it('arms anyway for the player who never tries, once the grace is spent', () => {
    tutor.armSlam(SLAM_GRACE_MS - 100, answerable)
    expect(tutor.activeLesson.value).toBeNull()
    tutor.armSlam(200, answerable)
    expect(tutor.activeLesson.value).toBe('slam')
  })

  it('leaves the ricochet room to get there first', () => {
    // The two numbers only work read together. The lesson is armed for
    // `bailoutMs` of present time and then writes itself taught FOREVER, so a
    // grace shorter than the bail-out simply moves the measured failure later:
    // put up at t ≈ grace, gone at t ≈ grace + bailout, still without the player
    // having touched a shell. The grace has to outlast the window it opens.
    expect(SLAM_GRACE_MS).toBeGreaterThan(lessonSpec('slam').bailoutMs)
  })

  it('does not spend the grace while no shell it can answer is on the board', () => {
    // A board of ants must not age the beetle's lesson out from under it.
    tutor.armSlam(SLAM_GRACE_MS * 3, false)
    expect(tutor.activeLesson.value).toBeNull()
    tutor.armSlam(SLAM_GRACE_MS - 100, answerable)
    expect(tutor.activeLesson.value).toBeNull()
  })

  it('never arms a lesson the player has already been through', () => {
    tutor.complete('slam')
    tutor.noteRicochet()
    tutor.armSlam(FRAME, answerable)
    expect(tutor.activeLesson.value).toBeNull()
  })
})

describe('when the lesson comes down', () => {
  it('retires the moment a slam is landed', () => {
    tutor.noteRicochet()
    tutor.armSlam(FRAME, true)
    expect(tutor.activeLesson.value).toBe('slam')
    // What the scene's `slams` watcher does.
    tutor.complete('slam')
    expect(tutor.activeLesson.value).toBeNull()
    expect(tutor.isTaught('slam')).toBe(true)
  })

  it('bails out in PRESENT time, never wall time', () => {
    const spec = lessonSpec('slam')
    tutor.noteRicochet()
    tutor.armSlam(FRAME, true)
    expect(tutor.activeLesson.value).toBe('slam')

    // Three whole bail-outs of wall clock with nobody present — an interstitial,
    // a consent dialog, a backgrounded tab. `step` is simply not called, and the
    // lesson is still waiting when the player comes back.
    vi.advanceTimersByTime(spec.bailoutMs * 3)
    expect(tutor.activeLesson.value).toBe('slam')

    // And present time does retire it, because a lesson that never ends is a
    // lesson the player is stuck being told.
    tutor.step(spec.bailoutMs - 100)
    expect(tutor.activeLesson.value).toBe('slam')
    tutor.step(200)
    expect(tutor.activeLesson.value).toBeNull()
    expect(tutor.isTaught('slam')).toBe(true)
  })
})

describe('the lesson matches the mechanic it is about', () => {
  it('does not black out a board that is already being played', () => {
    // `hole` is the OPENING scrim — see `Scrim` in `game/tutorial.ts`. The slam
    // is the first board lesson that arrives mid-level, and it shipped dimming
    // two thirds of a live beetle floor for up to fifteen seconds while an
    // armoured beetle walked into the foot.
    expect(lessonSpec('slam').scrim).toBe('soft')
  })

  it('asks for the gesture the mechanic actually uses', () => {
    expect(lessonSpec('slam').gesture).toBe('hold')
    // No `holdMs`: it is retired by an event (a slam landing), not by being
    // looked at — which is also why its progress ring has nothing to fill.
    expect(lessonSpec('slam').holdMs).toBeUndefined()
  })

  it('a press released too early is NOT the thing being taught', () => {
    clearFloor()
    sim.spawnBug('beetle', 50, 90)
    const before = sim.slams.value
    chargeTo(50, 90, 0.2)
    expect(sim.slams.value).toBe(before)
  })

  it('a press held past the threshold IS', () => {
    clearFloor()
    sim.spawnBug('beetle', 50, 90)
    const before = sim.slams.value
    chargeTo(50, 90, 0.5)
    expect(sim.slams.value).toBe(before + 1)
  })

  it('and so is the desktop right-click, which has no hold in it at all', () => {
    // `slamNow()` skips the charge entirely. It has to raise the same counter,
    // or a mouse player who uses the shortcut the game gave them is told to
    // hold something down for the rest of the level.
    clearFloor()
    sim.spawnBug('beetle', 50, 90)
    footAt(50, 90)
    const before = sim.slams.value
    sim.slamNow()
    run(400)
    expect(sim.slams.value).toBe(before + 1)
  })

  it('opens the shell a tap bounces off — which is the claim the lesson makes', () => {
    clearFloor()
    sim.spawnBug('beetle', 50, 90)
    footAt(50, 90)
    sim.drainEvents()
    sim.press(50, 90, performance.now())
    run(140)
    sim.release()
    run(200)
    expect(sim.drainEvents().map((e) => e.k)).toContain('clang')

    clearFloor()
    sim.spawnBug('beetle', 50, 90)
    sim.drainEvents()
    chargeTo(50, 90, 0.5)
    expect(sim.drainEvents().map((e) => e.k)).not.toContain('clang')
  })
})
