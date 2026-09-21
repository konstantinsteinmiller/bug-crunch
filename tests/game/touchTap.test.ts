import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import * as sim from '@/use/useBugCrunchGame'

/**
 * ─── The tap a PLAYER makes ─────────────────────────────────────────────────
 *
 * The suite next door drives the game through a `tapAt` helper that teleports
 * the foot onto the target before it presses. Every case there therefore taps
 * with the foot already on the bug — which is the one situation a real player
 * is never in, and it is why a blind test found long miss streaks that a green
 * suite had never seen.
 *
 * So these cases press where the FINGER goes and leave the foot where the game
 * left it. They pin the three rules that came out of that test:
 *
 *   · a tap aimed at a body hits it, from wherever the foot happens to be;
 *   · a tap that hits nothing says so — `hit: false` and a `miss` event;
 *   · the reach never takes a spike, because the game spends a whole lesson
 *     teaching a child to leave those alone.
 *
 * Plus the two input rules that stopped a phone dead: a spike stun that ate
 * every tap, and a Fever nobody could work out how to spend.
 */

const BOARD = { w: 100, h: 180, x0: 5, y0: 10, x1: 95, y1: 170 }
const FRAME = 1000 / 60

const run = (ms: number): void => {
  for (let t = 0; t < ms; t += FRAME) { vi.advanceTimersByTime(FRAME); sim.step(FRAME) }
}

const start = (over: Partial<sim.StartOptions> = {}, touch = true, emptyVial = true): void => {
  sim.setBoard(BOARD)
  sim.setTouch(touch)
  if (emptyVial) sim.resetVial()
  sim.startLevel({
    level: 1, shoe: 'sneaker', juiceStyle: 'ooze', singleTap: false,
    difficulty: 1, relief: 1, seed: 1234, ...over
  })
  sim.drainEvents()
}

/** Bare floor, and the foot parked well away from where the case will tap. */
const clearFloor = (x = 30, y = 90): void => {
  for (const b of sim.getBugs()) b.alive = false
  const f = sim.getFoot()
  f.x = x; f.y = y; f.state = 'hover'; f.timer = 0; f.charge = 0; f.z = 0.3
  sim.aim(x, y)
  sim.drainEvents()
}

/**
 * A finger coming down at (x, y) and lifting again. The scene takes the lift
 * off before the game ever sees it, so the test does exactly what the scene
 * does.
 *
 * The HOLD is 40 ms and the frames that resolve the blow come after the lift.
 * Both halves of that matter now that a stomp fires on the release rather than
 * on the press (see `press`): 40 ms is what a real tap lasts and keeps this
 * under `TAP_MS`, so the case stays a TAP and never becomes a half-charged
 * wind-up, and the blow needs its drop and landing after the finger is gone.
 * The old shape — hold 200 ms, resolve in 60 — was both a hold and too short.
 */
const fingerTap = (x: number, y: number, touch = true): sim.GameEvent[] => {
  sim.press(x, y - (touch ? sim.TOUCH_LIFT_U : 0), performance.now())
  run(40)
  sim.release()
  run(220)
  return sim.drainEvents()
}

beforeAll(() => { vi.useFakeTimers({ now: 1_000_000 }) })
afterAll(() => { vi.useRealTimers() })
beforeEach(() => { start() })

describe('a touch tap aimed at a body', () => {
  it('kills it from across the board', () => {
    clearFloor()
    const ant = sim.spawnBug('ant', 70, 120)!
    ant.speed = 0
    fingerTap(ant.x, ant.y)
    expect(ant.alive).toBe(false)
  })

  it('kills it when the finger lands a body-width high — the old dead zone', () => {
    clearFloor()
    const ant = sim.spawnBug('ant', 60, 90)!
    ant.speed = 0
    // Measured before the snap: a finger even slightly above a bug put the kill
    // circle over its head, and this was a miss every time.
    fingerTap(ant.x, ant.y - 4)
    expect(ant.alive).toBe(false)
  })

  it('still misses bare floor, and says so', () => {
    clearFloor()
    const ant = sim.spawnBug('ant', 85, 150)!
    ant.speed = 0
    // Mid-board on purpose: the level's own director keeps spawning at the
    // EDGES while this runs, and a tap near one is a tap that can hit a
    // stranger. Nothing the director sends can cross the floor in 200 ms.
    const events = fingerTap(50, 95)
    const stomp = events.find((e) => e.k === 'stomp')
    expect(stomp).toBeDefined()
    expect(stomp && stomp.k === 'stomp' && stomp.hit).toBe(false)
    expect(events.some((e) => e.k === 'miss')).toBe(true)
    expect(ant.alive).toBe(true)
  })

  it('never reaches for a spike', () => {
    // The foot parks on the FAR side of the caterpillar, so the blow cannot
    // reach it in flight and the only way it could die is the snap taking it.
    clearFloor(85, 90)
    const spike = sim.spawnBug('caterpillar', 60, 90)!
    spike.speed = 0
    const events = fingerTap(72, 90)          // 12 u from the spike: inside the snap
    expect(spike.alive).toBe(true)
    expect(events.some((e) => e.k === 'spike')).toBe(false)
    expect(sim.getFoot().state).not.toBe('stun')
  })

  it('leaves a mouse alone — no lift, no snap', () => {
    start({}, false)
    clearFloor()
    const ant = sim.spawnBug('ant', 60, 90)!
    ant.speed = 0
    // A mouse aims where it clicks: the foot's target is the raw point, never
    // the body beside it. (Whether the blow reaches the ant in flight is the
    // spring's business — what matters here is that nothing moved the aim.)
    sim.press(ant.x + 12, ant.y, performance.now())
    expect(sim.getFoot().tx).toBeCloseTo(ant.x + 12, 5)
    expect(sim.getFoot().ty).toBeCloseTo(ant.y, 5)
    sim.release()
  })
})

describe('a spike stun', () => {
  it('is shortened by mashing instead of eating every tap', () => {
    clearFloor()
    const foot = sim.getFoot()
    foot.state = 'stun'
    foot.timer = 900
    sim.press(50, 90, performance.now())
    sim.press(50, 90, performance.now())
    expect(foot.timer).toBeLessThan(900)
    expect(foot.timer).toBeLessThanOrEqual(900 - 2 * 200)
  })
})

describe('Splat Fever', () => {
  it('spends itself the moment the vial is full', () => {
    // So Close! hands the retry a full vial: the player never presses anything.
    start({ secondWind: true }, true, false)
    clearFloor()
    sim.spawnBug('ant', 60, 90)
    run(FRAME * 3)
    expect(sim.feverMs.value).toBeGreaterThan(0)
  })

  it('waits for something to stomp before it spends', () => {
    start({ secondWind: true }, true, false)
    clearFloor()
    run(FRAME * 3)
    expect(sim.feverMs.value).toBe(0)
    sim.spawnBug('ant', 60, 90)
    run(FRAME * 3)
    expect(sim.feverMs.value).toBeGreaterThan(0)
  })
})
