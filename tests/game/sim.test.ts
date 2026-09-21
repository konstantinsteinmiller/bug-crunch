import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import * as sim from '@/use/useBugCrunchGame'
import type { Bug, GameEvent } from '@/use/useBugCrunchGame'
import { COMBO_WINDOW_MS } from '@/game/combo'
import { levelSpec } from '@/game/stages'
import { EGG_LAY_MS, EGG_SCORE } from '@/game/bosses'

/**
 * ─── The simulation, driven headlessly ──────────────────────────────────────
 *
 * This is the end-to-end test of the GAME, as opposed to the pure-function
 * suites beside it: a real level is started, real frames are stepped, real
 * pointer input goes in, and the score, the chain, the vial, the tally and the
 * end-of-level verdict come out. Nothing is mocked, because nothing here needs
 * to be — `useBugCrunchGame` touches no canvas, no audio context and no DOM.
 *
 * Three details make it deterministic enough to assert on:
 *
 *   • the level's own director keeps spawning bugs while the clock runs, so
 *     every assertion is on a DELTA or on an EVENT, never on an absolute count
 *     of what is on the floor;
 *   • `performance.now()` is FAKED and advanced in lockstep with the stepped
 *     frames, so the two clocks the input code reads — the frame clock and the
 *     wall clock the tap/hold threshold uses — agree. Without that a held press
 *     never becomes a charge, because no wall time passes between frames;
 *   • the fake clock is installed ONCE and only ever moves forwards. It is the
 *     same clock the double-tap detector compares against, and a clock that
 *     restarts at zero between cases makes the first press of every case look
 *     like the second half of a double tap.
 */

const BOARD = { w: 100, h: 180, x0: 5, y0: 10, x1: 95, y1: 170 }
const FRAME = 1000 / 60

const start = (level = 1, over: Partial<sim.StartOptions> = {}): void => {
  sim.setBoard(BOARD)
  sim.setTouch(false)
  sim.startLevel({
    level,
    shoe: 'sneaker',
    juiceStyle: 'ooze',
    singleTap: false,
    difficulty: 1,
    relief: 1,
    seed: 1234,
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

/** Clear the floor of everything the director spawned, so a case can place its
 *  own bodies and know exactly what is in reach. */
const clearFloor = (): void => {
  for (const b of sim.getBugs()) b.alive = false
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

/**
 * A complete quick stomp at (x, y): press, release, land, resolve.
 *
 * The RELEASE is what fires the blow — a press no longer opens with one, so
 * that a charge is always possible from anywhere including on top of a body
 * (see `press`). The press and release are therefore back to back and the
 * frames are run afterwards, which keeps a tap's total elapsed time exactly
 * what it was before the control changed: the chain windows, the fever clock
 * and every "two taps in quick succession" case are measured against it.
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
 * A complete heavy slam at (x, y), through the real charge path.
 *
 * The wind-up now begins on the press itself — `TAP_MS` after it, with no
 * opening stomp in front of it any more — so this waits only for the charge to
 * saturate. The generous margin is kept deliberately: it used to cover an
 * opening tap's drop, impact and cooldown, and leaving it in means this helper
 * is not re-tuned every time a shoe's timings move. `drainEvents` before the
 * release still costs nothing and guarantees the caller sees the SLAM alone.
 */
const slamAt = (x: number, y: number): GameEvent[] => {
  const shoe = sim.getShoe()
  footAt(x, y)
  sim.drainEvents()
  sim.press(x, y, performance.now())
  run(300 + shoe.cooldown + shoe.chargeMs + 200)
  sim.drainEvents()
  expect(sim.getFoot().charge).toBeGreaterThan(0.34)
  sim.release()
  run(400)
  return sim.drainEvents()
}

const kinds = (events: GameEvent[]): string[] => events.map((e) => e.k)

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['performance'] })
})

afterAll(() => {
  vi.useRealTimers()
})

beforeEach(() => {
  // Forwards, never back: `lastPressAt` survives `startLevel`, and a clock that
  // rewound between cases would read the next press as a heel pivot.
  vi.advanceTimersByTime(60_000)
  start(1)
})

describe('starting a level', () => {
  it('resets the run and hands over the level brief', () => {
    const spec = levelSpec(1)
    expect(sim.phase.value).toBe('play')
    expect(sim.score.value).toBe(0)
    expect(sim.squished.value).toBe(0)
    expect(sim.chainCount.value).toBe(0)
    expect(sim.chainMult.value).toBe(1)
    expect(sim.quota.value).toBe(spec.quota)
    expect(sim.timeLeft.value).toBe(spec.time)
    expect(sim.getLevel().id).toBe(1)
  })

  it('parks the foot in the middle of the board it was given', () => {
    const f = sim.getFoot()
    expect(f.x).toBeCloseTo((BOARD.x0 + BOARD.x1) / 2, 6)
    expect(f.y).toBeCloseTo((BOARD.y0 + BOARD.y1) / 2, 6)
    expect(f.state).toBe('hover')
  })

  it('keeps the foot inside a board that shrinks under it', () => {
    sim.aim(999, 999)
    sim.setBoard({ ...BOARD, x1: 40, y1: 40 })
    const f = sim.getFoot()
    expect(f.x).toBeLessThanOrEqual(40)
    expect(f.y).toBeLessThanOrEqual(40)
    sim.setBoard(BOARD)
  })

  it('runs the clock down while it is playing, and stops when it is not', () => {
    const before = sim.timeLeft.value
    run(2_000)
    expect(sim.timeLeft.value).toBeLessThan(before)
    sim.endLevel(false)
    const stopped = sim.timeLeft.value
    run(2_000)
    expect(sim.timeLeft.value).toBe(stopped)
  })

  it('spawns its own bodies as the level runs', () => {
    clearFloor()
    run(4_000)
    expect(sim.getBugs().filter((b) => b.alive).length).toBeGreaterThan(0)
  })

  // Relief is a number ABOVE one (see `reliefFor`), and it used to multiply bug
  // speed as well as the clock — so a level that had beaten a child got FASTER
  // bugs on the retry, which is the exact opposite of what it is for.
  it('relief after a failure lengthens the clock AND slows the bugs down', () => {
    const spec = levelSpec(1)
    const antSpeed = (relief: number): number => {
      start(1, { relief })
      clearFloor()
      const b = sim.spawnBug('ant', 50, 90)!
      return Math.hypot(b.vx, b.vy)
    }
    const plain = antSpeed(1)
    const relieved = antSpeed(1.18)
    expect(sim.timeLeft.value).toBeGreaterThan(spec.time)
    expect(relieved).toBeLessThan(plain)
    start(1)
  })
})

describe('aiming', () => {
  it('clamps the aim point to the board', () => {
    sim.aim(-50, -50)
    const f = sim.getFoot()
    expect(f.tx).toBe(BOARD.x0)
    expect(f.ty).toBe(BOARD.y0)
    sim.aim(9_999, 9_999)
    expect(f.tx).toBe(BOARD.x1)
    expect(f.ty).toBe(BOARD.y1)
  })

  it('springs the foot towards the aim point rather than teleporting it', () => {
    footAt(20, 20)
    sim.aim(80, 120)
    sim.step(FRAME)
    const f = sim.getFoot()
    expect(f.x).toBeGreaterThan(20)
    expect(f.x).toBeLessThan(80)
    run(2_000)
    expect(sim.getFoot().x).toBeCloseTo(80, 0)
    expect(sim.getFoot().y).toBeCloseTo(120, 0)
  })
})

describe('one stomp', () => {
  it('kills a body under the foot and pays for it', () => {
    clearFloor()
    const bug = sim.spawnBug('ant', 50, 90)
    expect(bug).not.toBeNull()
    const events = tapAt(50, 90)
    expect(kinds(events)).toContain('squish')
    expect(bug!.alive).toBe(false)
    expect(sim.squished.value).toBe(1)
    expect(sim.score.value).toBeGreaterThan(0)
    expect(sim.chainCount.value).toBe(1)
  })

  it('reports a miss on bare floor and breaks the chain', () => {
    clearFloor()
    sim.spawnBug('ant', 20, 30)
    tapAt(20, 30)
    expect(sim.chainCount.value).toBe(1)
    clearFloor()
    const events = tapAt(85, 160)
    expect(kinds(events)).toContain('miss')
    expect(sim.chainCount.value).toBe(0)
    expect(sim.tally.value.misses).toBeGreaterThan(0)
  })

  it('counts a landed stomp as a hit for the accuracy objective', () => {
    clearFloor()
    sim.spawnBug('ant', 50, 90)
    const before = sim.tally.value.hits
    tapAt(50, 90)
    expect(sim.tally.value.hits).toBe(before + 1)
  })

  it('takes everything inside the circle, and nothing outside it', () => {
    clearFloor()
    const r = sim.stompRadius()
    const inside = sim.spawnBug('ant', 50, 90)!
    const alsoInside = sim.spawnBug('ant', 50 + r * 0.5, 90)!
    const outside = sim.spawnBug('ant', 50 + r * 3, 90)!
    tapAt(50, 90)
    expect(inside.alive).toBe(false)
    expect(alsoInside.alive).toBe(false)
    expect(outside.alive).toBe(true)
  })
})

describe('armour and spikes', () => {
  it('a tap RICOCHETS off a beetle and the chain survives', () => {
    clearFloor()
    sim.spawnBug('ant', 30, 60)
    tapAt(30, 60)
    expect(sim.chainCount.value).toBe(1)

    clearFloor()
    const beetle = sim.spawnBug('beetle', 50, 90)!
    const events = tapAt(50, 90)
    expect(kinds(events)).toContain('clang')
    expect(beetle.alive).toBe(true)
    // The player found the beetle; they just could not open it.
    expect(sim.chainCount.value).toBe(1)
  })

  it('a SLAM opens the same beetle', () => {
    clearFloor()
    const beetle = sim.spawnBug('beetle', 50, 90)!
    const events = slamAt(50, 90)
    expect(kinds(events)).not.toContain('clang')
    expect(events.some((e) => e.k === 'squish' || e.k === 'hurt')).toBe(true)
    expect(beetle.dmg + (beetle.alive ? 0 : beetle.spec.hp)).toBeGreaterThan(0)
  })

  it('a caterpillar spikes the player, breaks the chain and stuns the foot', () => {
    clearFloor()
    sim.spawnBug('ant', 30, 60)
    tapAt(30, 60)
    expect(sim.chainCount.value).toBe(1)

    clearFloor()
    sim.spawnBug('caterpillar', 50, 90)
    const events = tapAt(50, 90)
    expect(kinds(events)).toContain('spike')
    expect(sim.chainCount.value).toBe(0)
    expect(sim.tally.value.spikes).toBeGreaterThan(0)
    expect(sim.getFoot().state).toBe('stun')
  })

  it('a steel boot walks over the same caterpillar', () => {
    start(1, { shoe: 'steelBoot' })
    clearFloor()
    sim.spawnBug('caterpillar', 50, 90)
    const events = tapAt(50, 90)
    expect(kinds(events)).not.toContain('spike')
    expect(sim.tally.value.spikes).toBe(0)
  })
})

/**
 * ─── The sprinter ant ───────────────────────────────────────────────────────
 *
 * The one bug in the cast whose behaviour is different on a phone from what it
 * is on a desktop, which is exactly why it is worth driving headlessly: the
 * touch half cannot be seen by looking at the pointer half, and neither half is
 * visible from a pure-function test of `bugs.ts`.
 *
 * Every case here runs on LEVEL 5 — the sprinter's own level (1-5). It has no
 * hazards to ground anything, a quota of 21 so a handful of test taps cannot
 * accidentally finish the level out from under a case, and it is the board a
 * real player meets this creature on.
 */
describe('the sprinter ant', () => {
  /** A body at (x, y) walking AWAY from where the cases park the shoe. */
  const oneSprinter = (x = 50, y = 60): Bug => {
    clearFloor()
    footAt(20, 20)
    const b = sim.spawnBug('sprinter', x, y)!
    b.heading = -Math.PI / 2
    return b
  }

  /** Drive the shoe at a body from 70 u away, stopping 20 u short of it — an
   *  approach, which is the thing a pointer sprinter reacts to. */
  const rushAt = (b: Bug): void => {
    footAt(b.x, b.y + 70)
    sim.aim(b.x, b.y + 20)
  }

  /** Step frames, reporting whether the body was ever mid-bolt. */
  const watchBolt = (b: Bug, ms: number): boolean => {
    let bolted = false
    for (let t = 0; t < ms; t += FRAME) {
      vi.advanceTimersByTime(FRAME)
      sim.step(FRAME)
      if (b.bolt > 0) bolted = true
    }
    return bolted
  }

  describe('on a pointer', () => {
    it('bolts when the shoe comes for it', () => {
      start(5)
      const b = oneSprinter()
      const y0 = b.y
      rushAt(b)
      expect(watchBolt(b, 1100)).toBe(true)
      // Straight away from the foot, which was below it — and a long way.
      expect(y0 - b.y).toBeGreaterThan(20)
    })

    // The whole counter-play, and the thing that makes it a different creature
    // from the flea: a flea leaps at whatever is over it, a sprinter runs from
    // whatever is COMING. Stop moving and it never goes.
    it('ignores a shoe that is merely sitting next to it', () => {
      start(5)
      const b = oneSprinter()
      footAt(b.x, b.y + 14)
      expect(watchBolt(b, 1500)).toBe(false)
      expect(b.sense).toBe(0)
    })

    it('stops DEAD when the run ends, which is the whole kill window', () => {
      start(5)
      const b = oneSprinter()
      rushAt(b)
      expect(watchBolt(b, 1100)).toBe(true)
      expect(b.bolt).toBe(0)
      expect(b.stun).toBeGreaterThan(0)
      const x = b.x
      const y = b.y
      run(200)
      expect(b.x).toBe(x)
      expect(b.y).toBe(y)
      // …and a stationary one-hit body is a free squish.
      expect(kinds(tapAt(b.x, b.y))).toContain('squish')
      expect(b.alive).toBe(false)
    })

    it('will not bolt twice in a row — after one it is just an ant', () => {
      start(5)
      const b = oneSprinter()
      rushAt(b)
      expect(watchBolt(b, 1100)).toBe(true)
      // Immediately again, well inside the lockout.
      b.x = 50
      b.y = 60
      b.heading = -Math.PI / 2
      rushAt(b)
      expect(watchBolt(b, 1000)).toBe(false)
    })

    it('…but it IS a lockout and not a one-shot: it bolts again later', () => {
      start(5)
      const b = oneSprinter()
      rushAt(b)
      expect(watchBolt(b, 1100)).toBe(true)
      footAt(20, 20)
      run(4000)
      b.x = 50
      b.y = 60
      b.heading = -Math.PI / 2
      rushAt(b)
      expect(watchBolt(b, 1100)).toBe(true)
    })

    // Same perk, same reason as the flea: the Bunny Slipper is quiet. It does
    // NOT hide a stomp, because a stomp is loud in any shoe — see below.
    it('never hears a silent shoe coming', () => {
      start(5, { shoe: 'bunnySlipper' })
      const b = oneSprinter()
      rushAt(b)
      expect(watchBolt(b, 1500)).toBe(false)
    })
  })

  describe('on touch', () => {
    // A finger has no hover, so there is nothing for a phone player's approach
    // to be sensed by — and a sprinter that fled from a finger on its way down
    // would be a bug nobody on a phone could ever catch.
    it('does not flee from an approaching finger, because there is none', () => {
      start(5)
      sim.setTouch(true)
      const b = oneSprinter()
      rushAt(b)
      expect(watchBolt(b, 1500)).toBe(false)
      expect(b.sense).toBe(0)
    })

    it('bolts once when a stomp lands NEAR it instead of on it', () => {
      start(5)
      sim.setTouch(true)
      const b = oneSprinter()
      const r = sim.stompRadius()
      // Outside the kill circle (r + its own size), inside the scare band.
      const gap = r + b.spec.size + 4
      const y0 = b.y
      tapAt(b.x, b.y + gap)
      expect(b.alive).toBe(true)
      expect(watchBolt(b, 900)).toBe(true)
      expect(y0 - b.y).toBeGreaterThan(20)
    })

    it('is not scared by a stomp on the far side of the board', () => {
      start(5)
      sim.setTouch(true)
      const b = oneSprinter()
      tapAt(b.x, b.y + sim.stompRadius() * 4)
      expect(watchBolt(b, 900)).toBe(false)
    })

    it('is still scared by a near miss in a silent shoe — a stomp is a stomp', () => {
      start(5, { shoe: 'bunnySlipper' })
      sim.setTouch(true)
      const b = oneSprinter()
      const gap = sim.stompRadius() + b.spec.size + 3
      tapAt(b.x, b.y + gap)
      expect(b.alive).toBe(true)
      expect(watchBolt(b, 900)).toBe(true)
    })
  })

  // 1-9's lesson, pinned. Honey grounds a sprinter exactly as it grounds a
  // flea — without it the answer world 1 hands over would quietly not work.
  //
  // Each case carries its own CONTROL on the same board: the identical rush
  // against a body standing on bare floor a few metres away. Without that, a
  // "did not bolt" assertion passes just as happily when the sprinter is broken
  // as when the honey is working.
  describe('in honey', () => {
    /** Level 9 is the honey level. Its first puddle is the one used here. */
    const puddle = (): { x: number; y: number } => {
      const h = sim.getHazards().find((p) => p.id === 'honey')
      expect(h).toBeDefined()
      return { x: h!.x, y: h!.y }
    }

    /** A patch of level 9's floor with nothing on it. */
    const BARE = { x: 80, y: 60 }

    const at = (x: number, y: number): Bug => {
      clearFloor()
      footAt(20, 20)
      const b = sim.spawnBug('sprinter', x, y)!
      b.heading = -Math.PI / 2
      return b
    }

    it('cannot bolt away from an approaching shoe, where bare floor could', () => {
      start(9)
      const control = at(BARE.x, BARE.y)
      rushAt(control)
      expect(watchBolt(control, 1100)).toBe(true)

      const p = puddle()
      const stuck = at(p.x, p.y)
      rushAt(stuck)
      expect(watchBolt(stuck, 1500)).toBe(false)
    })

    it('cannot bolt away from a near miss either', () => {
      start(9)
      sim.setTouch(true)
      // Outside the kill circle, inside the scare band.
      const gap = sim.stompRadius() + 3.0 + 4
      const control = at(BARE.x, BARE.y)
      tapAt(control.x, control.y + gap)
      expect(watchBolt(control, 900)).toBe(true)

      const p = puddle()
      const stuck = at(p.x, p.y)
      tapAt(stuck.x, stuck.y + gap)
      expect(watchBolt(stuck, 900)).toBe(false)
    })
  })
})

/**
 * ─── What the HUD is allowed to be told ─────────────────────────────────────
 *
 * Every write to one of these refs re-renders the whole HUD — `SplatHud`, the
 * quest badges, the vial, the chest — and a 20-second profile of a 6×-throttled
 * phone spent more main-thread time in Vue re-renders than in the renderer that
 * draws the game. Both of these used to take a fresh float sixty times a second.
 *
 * Pinned as COUNTS rather than as timings, so the rule holds on any machine:
 * the frame-time win is a phone measurement (`PERF-LEDGER.md`), but "the HUD is
 * not told sixty times a second" is arithmetic, and this is where it stays true.
 */
describe('the HUD is only told when what it prints changes', () => {
  /** How many times `ref` takes a new value over `ms` of stepped frames. */
  const writesOver = (ref: { value: number }, ms: number): number => {
    let writes = 0
    let last = ref.value
    for (let t = 0; t < ms; t += FRAME) {
      vi.advanceTimersByTime(FRAME)
      sim.step(FRAME)
      if (ref.value !== last) { writes++; last = ref.value }
    }
    return writes
  }

  it('moves the clock chip about once a second, not once a frame', () => {
    start(1)
    clearFloor()
    const writes = writesOver(sim.timeLeft, 5_000)
    // Five seconds of frames is ~300 of them; the chip prints whole seconds.
    expect(writes).toBeLessThanOrEqual(6)
    expect(writes).toBeGreaterThanOrEqual(4)
  })

  it('still counts the clock down in real time underneath it', () => {
    start(1)
    const before = sim.timeLeft.value
    run(3_000)
    expect(before - sim.timeLeft.value).toBe(3)
  })

  it('draws the chain ring in steps, and lands exactly on zero when it lapses', () => {
    start(1)
    clearFloor()
    sim.spawnBug('ant', 50, 90)
    tapAt(50, 90)
    expect(sim.chainLeft.value).toBeGreaterThan(0)
    // The whole window, plus enough to lapse it.
    const writes = writesOver(sim.chainLeft, COMBO_WINDOW_MS + 200)
    // 24 steps down the ring, plus the write that zeroes it.
    expect(writes).toBeLessThanOrEqual(26)
    expect(sim.chainLeft.value).toBe(0)
    expect(sim.chainCount.value).toBe(0)
  })
})

describe('the Splat Chain', () => {
  it('climbs the ladder across quick kills', () => {
    clearFloor()
    for (let i = 0; i < 4; i++) {
      clearFloor()
      sim.spawnBug('ant', 50, 90)
      tapAt(50, 90)
    }
    expect(sim.chainCount.value).toBe(4)
    expect(sim.chainMult.value).toBeGreaterThan(1)
    // `bestCombo` records the MULTIPLIER the chain reached, which is what the
    // objective ("reach a xN chain") and the result screen both read.
    expect(sim.tally.value.bestCombo).toBe(sim.chainMult.value)
  })

  it('pays the multiplier into the score', () => {
    clearFloor()
    sim.spawnBug('ant', 50, 90)
    tapAt(50, 90)
    const first = sim.score.value
    for (let i = 0; i < 5; i++) {
      clearFloor()
      sim.spawnBug('ant', 50, 90)
      tapAt(50, 90)
    }
    const perKill = (sim.score.value - first) / 5
    expect(perKill).toBeGreaterThan(first)
  })

  it('lapses when the window runs out, and keeps the best', () => {
    clearFloor()
    sim.spawnBug('ant', 50, 90)
    tapAt(50, 90)
    expect(sim.chainCount.value).toBe(1)
    clearFloor()
    run(COMBO_WINDOW_MS + 200)
    expect(sim.chainCount.value).toBe(0)
    expect(sim.tally.value.bestCombo).toBeGreaterThanOrEqual(1)
  })

  it('announces every step up the ladder', () => {
    clearFloor()
    let stepped = 0
    for (let i = 0; i < 8; i++) {
      clearFloor()
      sim.spawnBug('ant', 50, 90)
      const events = tapAt(50, 90)
      for (const e of events) if (e.k === 'chain' && e.step) stepped++
    }
    expect(stepped).toBeGreaterThan(0)
  })
})

describe('the Juice vial and Splat Fever', () => {
  it('fills as bugs are squished', () => {
    expect(sim.juice.value).toBe(0)
    clearFloor()
    for (let i = 0; i < 6; i++) {
      clearFloor()
      sim.spawnBug('ant', 50, 90)
      tapAt(50, 90)
    }
    expect(sim.juice.value).toBeGreaterThan(0)
  })

  it('refuses to start a frenzy on a part-full vial', () => {
    expect(sim.tryFever()).toBe(false)
    expect(sim.feverMs.value).toBe(0)
  })

  it('runs a frenzy once the vial is full, and grows the stomp while it lasts', () => {
    // A late level, because filling the vial costs more squishes than an early
    // level's whole quota — on level 1 the run would be WON before the frenzy
    // could be spent, and a finished level steps no frames.
    start(19)
    const calm = sim.stompRadius()
    clearFloor()
    // Fill it the honest way: squish until the game spends it.
    //
    // It used to fill, sit there, and wait for `tryFever()` — the button under
    // the vial. Four of five blind testers never worked out what that button
    // was, so a full vial now fires the frenzy itself on the next frame with a
    // body on the floor, and the loop below watches for the frenzy rather than
    // for the full glass (which is never observable any more: the fill and the
    // spend happen inside the same tap).
    for (let i = 0; i < 400 && sim.feverMs.value <= 0; i++) {
      clearFloor()
      sim.spawnBug('pinatafly', 50, 90)
      tapAt(50, 90)
    }
    expect(sim.feverMs.value).toBeGreaterThan(0)
    expect(sim.isFever()).toBe(true)
    expect(sim.juice.value).toBe(0)
    expect(sim.stompRadius()).toBeGreaterThan(calm)
    expect(sim.tally.value.fevers).toBe(1)

    // Nothing survives the gilded boot — not armour, not spikes.
    clearFloor()
    const beetle = sim.spawnBug('beetle', 50, 90)!
    const caterpillar = sim.spawnBug('caterpillar', 52, 92)!
    tapAt(50, 90)
    expect(beetle.alive).toBe(false)
    expect(caterpillar.alive).toBe(false)
    expect(sim.tally.value.spikes).toBe(0)

    // And it ends.
    run(12_000)
    expect(sim.isFever()).toBe(false)
    expect(sim.stompRadius()).toBeCloseTo(calm, 6)
  })
})

describe('finishing a level', () => {
  it('wins the moment the quota is met, and fills in the tally', () => {
    const quota = sim.quota.value
    for (let i = 0; i < quota + 4 && sim.phase.value === 'play'; i++) {
      clearFloor()
      sim.spawnBug('ant', 50, 90)
      tapAt(50, 90)
      // The last body's tap lands on RELEASE (the Big Finish holds the press so
      // it can become a slam), so give the owed stomp its frames to land.
      run(200)
    }
    expect(sim.phase.value).toBe('won')
    expect(sim.squished.value).toBeGreaterThanOrEqual(quota)
    const t = sim.tally.value
    expect(t.cleared).toBe(true)
    expect(t.score).toBe(sim.score.value)
    expect(t.timeLeft).toBeGreaterThan(0)
    expect(t.squishes).toBeGreaterThanOrEqual(quota)
    expect(t.byKind.ant).toBeGreaterThan(0)
  })

  it('loses when the clock runs out, with nothing left on it', () => {
    run((sim.timeLeft.value + 2) * 1000)
    expect(sim.phase.value).toBe('lost')
    expect(sim.tally.value.cleared).toBe(false)
    expect(sim.tally.value.timeLeft).toBe(0)
  })

  it('ignores input once the level is over', () => {
    sim.endLevel(true)
    const score = sim.score.value
    clearFloor()
    const bug = sim.spawnBug('ant', 50, 90)
    sim.press(50, 90, performance.now())
    run(300)
    sim.release()
    expect(sim.score.value).toBe(score)
    if (bug) expect(bug.alive).toBe(true)
  })

  it('emits exactly one end event', () => {
    sim.drainEvents()
    sim.endLevel(true)
    const ends = sim.drainEvents().filter((e) => e.k === 'end')
    expect(ends).toHaveLength(1)
    sim.endLevel(false)
    expect(sim.drainEvents().filter((e) => e.k === 'end')).toHaveLength(0)
  })

  // ── The shot the win beat pushes the camera in on ──
  //
  // `end` carries the blow that ended the level so the celebration can look at
  // it. The failure this pins is not a crash: a missing point silently becomes
  // the middle of the board, and a camera pushing in on bare floor while the
  // body that won the level sits in a corner is a bug nobody would report as
  // one — it just looks wrong.
  it('the end event points at the body that ended the level', () => {
    start(1)
    clearFloor()
    // One to go, and the last body deliberately in a CORNER of the board — the
    // whole assertion is that the point travels, and a body near the middle
    // would pass against a stub that returns the middle.
    sim.squished.value = sim.quota.value - 1
    sim.spawnBug('ant', 22, 150)
    const ev = tapAt(22, 150)
    const end = ev.find((e) => e.k === 'end')
    expect(end && end.k === 'end' && end.won).toBe(true)
    if (end && end.k === 'end') {
      expect(Math.hypot(end.x - 22, end.y - 150)).toBeLessThan(8)
    }
  })
})

describe('the boss levels', () => {
  it('opens with a boss on the floor, full health and its first tell', () => {
    start(10)
    expect(sim.getBoss()).not.toBeNull()
    expect(sim.bossHp.value).toBe(1)
    expect(sim.bossPhaseIndex.value).toBe(0)
    expect(sim.bossTell.value).not.toBeNull()
    expect(sim.quota.value).toBe(0)
  })

  // A blow on the body is a HIT, even though `resolveArea` only counts bugs.
  // Without this the chain broke on every clean boss hit, the accuracy
  // objective was unreachable on every boss level, and a fight could not be
  // fought without wrecking the run it was part of.
  it('a blow that lands on the boss is a hit, not a miss', () => {
    start(10)
    const boss = sim.getBoss()!
    clearFloor()
    sim.spawnBug('ant', boss.x, boss.y + boss.size + 14)
    tapAt(boss.x, boss.y + boss.size + 14)
    expect(sim.chainCount.value).toBe(1)
    const misses = sim.tally.value.misses

    clearFloor()
    const events = tapAt(boss.x, boss.y)
    expect(kinds(events)).not.toContain('miss')
    expect(sim.tally.value.misses).toBe(misses)
    expect(sim.chainCount.value).toBe(1)
    const stomp = events.find((e) => e.k === 'stomp')
    if (stomp && stomp.k === 'stomp') expect(stomp.hit).toBe(true)
  })

  it('takes damage from a slam and loses health for it', () => {
    start(10)
    const boss = sim.getBoss()!
    // Straight onto the body, with the phase's own armour in mind.
    for (let i = 0; i < 20 && sim.bossHp.value === 1; i++) {
      run(400)
      slamAt(boss.x, boss.y)
    }
    expect(sim.bossHp.value).toBeLessThan(1)
  })
})

/**
 * ─── The half-strength Queen, 1-4 ───────────────────────────────────────────
 *
 * The same boss as 1-10, fought off `bossSpec('queenAnt', 0.5)`. What these pin
 * is that the SIM reads the scaled spec everywhere a number comes from — a
 * half-strength bar over a full-strength fight is the failure, and it would
 * pass every pure-function test in `bosses.test.ts`.
 */
describe('the half-strength boss on 1-4', () => {
  /** Stomp the body until the phase changes, a tap at a time. */
  const tapUntilPhase = (phase: number): number => {
    let taps = 0
    for (; taps < 40 && sim.bossPhaseIndex.value < phase; taps++) {
      run(320)
      const b = sim.getBoss()!
      tapAt(b.x, b.y)
    }
    return taps
  }

  it('puts the scaled Queen on the floor, not the table entry', () => {
    start(4)
    const boss = sim.getBoss()!
    expect(boss.spec.id).toBe('queenAnt')
    expect(boss.spec.strength).toBe(0.5)
    expect(boss.spec.phases.map((p) => p.hits)).toEqual([3, 3, 2])
    expect(boss.spec.podQuota).toBe(3)
    // …and the full one is still the full one on 1-10.
    start(10)
    expect(sim.getBoss()!.spec.phases.map((p) => p.hits)).toEqual([5, 6, 4])
  })

  it('drains the bar by the SCALED total — an eighth per hit, not a fifteenth', () => {
    start(4)
    clearFloor()
    const before = sim.bossHp.value
    for (let i = 0; i < 20 && sim.bossHp.value === before; i++) {
      run(320)
      const b = sim.getBoss()!
      tapAt(b.x, b.y)
    }
    expect(before - sim.bossHp.value).toBeCloseTo(1 / 8, 6)
  })

  it('ends phase 1 on its third hit', () => {
    start(4)
    expect(tapUntilPhase(1)).toBeLessThanOrEqual(12)
    expect(sim.bossPhaseIndex.value).toBe(1)
    expect(sim.bossHp.value).toBeCloseTo(1 - 3 / 8, 6)
  })

  it('ends the egg phase at the scaled quota, and counts every egg for the lesson', () => {
    start(4)
    tapUntilPhase(1)
    expect(sim.bossTell.value).toBe('pods')
    const popped0 = sim.podsPopped.value
    for (let i = 0; i < 60 && sim.bossPhaseIndex.value === 1; i++) {
      run(320)
      const pod = sim.getPods().find((p) => p.alive)
      if (pod) tapAt(pod.x, pod.y)
    }
    expect(sim.bossPhaseIndex.value).toBe(2)
    const popped = sim.podsPopped.value - popped0
    expect(popped).toBeGreaterThanOrEqual(3)
    // One tap can take two eggs that landed together, but never the six a
    // full-strength phase asks for.
    expect(popped).toBeLessThan(6)
  })

  // The egg phase's own version of "a blow on the boss is a hit": the phase
  // ASKS for eggs to be stomped, so a stomp that takes one and nothing else must
  // not be a miss on the tally or break the chain.
  it('counts a stomp that only takes an egg as a hit, not a miss', () => {
    start(4)
    tapUntilPhase(1)
    let pod: ReturnType<typeof sim.getPods>[number] | undefined
    for (let i = 0; i < 30 && !pod; i++) {
      run(320)
      // Landed: an egg still in its hop from the Queen is not on the floor yet.
      pod = sim.getPods().find((p) => p.alive && p.fly <= 0)
    }
    expect(pod).toBeDefined()
    clearFloor()
    // Nothing else under the sole: the boss is parked in the far corner, or a
    // clang off her body is the hit and this case passes with the bug in.
    const boss = sim.getBoss()!
    boss.x = pod!.x < 50 ? BOARD.x1 - boss.size : BOARD.x0 + boss.size
    boss.y = BOARD.y0 + boss.size
    expect(Math.hypot(boss.x - pod!.x, boss.y - pod!.y)).toBeGreaterThan(sim.stompRadius() + boss.size + 10)
    const misses = sim.tally.value.misses
    const popped = sim.podsPopped.value
    const events = tapAt(pod!.x, pod!.y)
    expect(sim.podsPopped.value).toBeGreaterThan(popped)
    expect(kinds(events)).not.toContain('miss')
    expect(sim.tally.value.misses).toBe(misses)
    const stomp = events.find((e) => e.k === 'stomp')
    if (stomp && stomp.k === 'stomp') expect(stomp.hit).toBe(true)
  })

  it('hatches its eggs on the slower clock', () => {
    start(4)
    tapUntilPhase(1)
    const boss = sim.getBoss()!
    run(boss.spec.phases[1].beatMs + 100)
    const pod = sim.getPods().find((p) => p.alive)
    expect(pod).toBeDefined()
    expect(pod!.t).toBeGreaterThan(5200)
    expect(pod!.t).toBeLessThanOrEqual(boss.spec.podHatchMs)
  })

  it('resets the egg count for the next level', () => {
    start(4)
    tapUntilPhase(1)
    for (let i = 0; i < 30 && sim.podsPopped.value === 0; i++) {
      run(320)
      const pod = sim.getPods().find((p) => p.alive)
      if (pod) tapAt(pod.x, pod.y)
    }
    expect(sim.podsPopped.value).toBeGreaterThan(0)
    start(4)
    expect(sim.podsPopped.value).toBe(0)
  })
})

/**
 * ─── The brood ──────────────────────────────────────────────────────────────
 *
 * Every boss fight's eggs (see "The brood" in `bosses.ts`). What these pin is
 * the whole loop a six-year-old meets: an egg lands, it is either stomped — and
 * paid like a kill, never a miss — or it hatches on its clock into a scurry of
 * ants; and however long nobody touches the fight, the board never floods.
 *
 * `start()` is the fresh board every case uses on purpose: `clearFloor` above
 * flags bodies dead without taking them out of the pool's live count, and the
 * brood's caps count that pool.
 */
describe('the brood — eggs in every boss fight', () => {
  const live = (): Bug[] => sim.getBugs().slice(0, sim.getBugCount()).filter((b) => b.alive)
  const landed = () => sim.getPods().find((p) => p.alive && p.fly <= 0)
  const carrier = (): Bug | undefined => live().find((b) => b.carry)
  const hatchlings = (): number => live().filter((b) => b.hatched).length
  const eggsInPlay = (): number => sim.getPods().filter((p) => p.alive).length + live().filter((b) => b.carry).length

  /** Skip the fight straight to phase `n`, with its clocks at zero. */
  const toPhase = (n: number): void => {
    const bs = sim.getBoss()!
    bs.phase = n
    bs.hits = 0
    bs.beat = 0
    bs.sub = 'idle'
    bs.subT = 0
    bs.eggClock = 0
  }

  /** Step until `test` holds, for at most `ms`. */
  const until = (test: () => boolean, ms: number): boolean => {
    for (let t = 0; t < ms; t += FRAME) {
      if (test()) return true
      vi.advanceTimersByTime(FRAME)
      sim.step(FRAME)
    }
    return test()
  }

  /** Put the boss in the corner furthest from (x, y), so a stomp there cannot
   *  land on its body and pass for a hit on the egg. */
  const parkBossAwayFrom = (x: number, y: number): void => {
    const bs = sim.getBoss()!
    bs.x = x < 50 ? BOARD.x1 - bs.size : BOARD.x0 + bs.size
    bs.y = y < 90 ? BOARD.y1 - bs.size : BOARD.y0 + bs.size
  }

  it('puts eggs on the floor in every boss fight, in every phase that has a brood, the way its boss would', () => {
    for (const level of [4, 10, 20, 30, 40]) {
      start(level)
      const spec = sim.getBoss()!.spec
      let phases = 0
      spec.phases.forEach((p, i) => {
        if (p.eggMs === 0 && p.script !== 'pods') return
        start(level)
        toPhase(i)
        let sawCarrier = false
        const ok = until(() => {
          if (carrier()) sawCarrier = true
          return landed() !== undefined
        }, 12_000)
        expect(ok, `${level}: phase ${i + 1} (${p.script}) never put an egg down`).toBe(true)
        // A hauling boss's eggs arrive in a carrier's arms; a laying boss's hop
        // out of its own body.
        if (spec.delivery === 'haul') expect(sawCarrier, `${level}: no carrier`).toBe(true)
        else expect(sawCarrier, `${level}: a layer sent a carrier`).toBe(false)
        phases++
      })
      expect(phases, `level ${level} has no brood at all`).toBeGreaterThan(0)
    }
  })

  it('hatches an unstomped egg into its ants on its clock, and they scurry out of it', () => {
    for (const [level, ants] of [[10, 3], [4, 2]] as const) {
      start(level)
      toPhase(1)
      expect(until(() => landed() !== undefined, 8000)).toBe(true)
      const egg = landed()!
      const { x, y, t: due } = egg
      expect(due).toBeLessThanOrEqual(sim.getBoss()!.spec.podHatchMs)
      run(due - 120)
      expect(egg.alive && egg.x === x && egg.y === y, `${level}: hatched early`).toBe(true)
      sim.drainEvents()
      const before = hatchlings()
      run(240)
      const hatch = sim.drainEvents().find((e) => e.k === 'podHatch' && e.x === x && e.y === y)
      expect(hatch, `${level}: no hatch at its clock`).toBeDefined()
      if (hatch?.k === 'podHatch') expect(hatch.n).toBe(ants)
      expect(egg.alive && egg.x === x && egg.y === y).toBe(false)
      expect(hatchlings()).toBeGreaterThanOrEqual(before + ants)
      const fresh = live().filter((b) => b.hatched && Math.hypot(b.x - x, b.y - y) < 12)
      expect(fresh.length).toBeGreaterThanOrEqual(ants)
      for (const b of fresh) {
        expect(b.id).toBe('ant')
        expect(b.panic, 'a hatchling runs out of its shell').toBeGreaterThan(0)
      }
    }
  })

  it('pays a stomped egg like a kill — a rung on the chain, points, juice, a hit — and never a miss', () => {
    start(10)
    toPhase(1)
    expect(until(() => landed() !== undefined, 8000)).toBe(true)
    const egg = landed()!
    parkBossAwayFrom(egg.x, egg.y)
    // A chain already running, off an ant squished well clear of the egg.
    const ax = egg.x < 50 ? egg.x + 25 : egg.x - 25
    sim.spawnBug('ant', ax, egg.y)
    tapAt(ax, egg.y)
    expect(sim.chainCount.value).toBe(1)
    const score = sim.score.value
    const juice = sim.juice.value
    const { hits, misses } = sim.tally.value
    const popped = sim.podsPopped.value
    parkBossAwayFrom(egg.x, egg.y)
    const events = tapAt(egg.x, egg.y)
    expect(kinds(events)).toContain('podPop')
    expect(kinds(events)).not.toContain('miss')
    // A clutch lands close together, so one sole can take both — each is paid.
    const n = sim.podsPopped.value - popped
    expect(n).toBeGreaterThanOrEqual(1)
    expect(events.filter((e) => e.k === 'podPop')).toHaveLength(n)
    expect(sim.chainCount.value, 'each egg is a rung, and the chain survived').toBe(1 + n)
    expect(sim.score.value - score).toBeGreaterThanOrEqual(EGG_SCORE * n)
    expect(sim.juice.value).toBeGreaterThan(juice)
    expect(sim.tally.value.hits).toBe(hits + n)
    expect(sim.tally.value.misses).toBe(misses)
  })

  it('cannot stomp an egg still in the air — it lands first', () => {
    start(10)
    toPhase(1)
    const flying = () => sim.getPods().find((p) => p.alive && p.fly > EGG_LAY_MS * 0.6)
    expect(until(() => flying() !== undefined, 8000)).toBe(true)
    const egg = flying()!
    parkBossAwayFrom(egg.x, egg.y)
    const popped = sim.podsPopped.value
    tapAt(egg.x, egg.y)
    expect(sim.podsPopped.value).toBe(popped)
    expect(egg.alive).toBe(true)
  })

  it('lets a carrier be stomped before it sets its egg down: ant and egg, two rungs', () => {
    start(20)
    const inside = (b: Bug | undefined): boolean => !!b
      && b.x > BOARD.x0 + 4 && b.x < BOARD.x1 - 4 && b.y > BOARD.y0 + 4 && b.y < BOARD.y1 - 4
    expect(until(() => inside(carrier()), 6000)).toBe(true)
    const ant = carrier()!
    const chain = sim.chainCount.value
    const popped = sim.podsPopped.value
    const events = tapAt(ant.x, ant.y)
    expect(kinds(events)).toContain('squish')
    expect(kinds(events)).toContain('podPop')
    expect(sim.podsPopped.value).toBe(popped + 1)
    expect(sim.chainCount.value).toBe(chain + 2)
  })

  it('makes the laying Queen hold still, wide open, after a spent charge', () => {
    start(10)
    toPhase(2)
    const bs = sim.getBoss()!
    expect(until(() => bs.sub === 'spent' && bs.subT < 0, 15_000)).toBe(true)
    expect(sim.getPods().some((p) => p.alive), 'she laid as she stopped').toBe(true)
    let spent = 0
    while (bs.sub === 'spent' && spent < 6000) { run(FRAME); spent += FRAME }
    expect(spent).toBeGreaterThanOrEqual(bs.spec.spentMs + bs.spec.layHoldMs - 100)
  })

  it('bursts the rest of the clutch, paid, when the egg phase is cleared', () => {
    start(10)
    toPhase(1)
    const bs = sim.getBoss()!
    expect(until(() => sim.getPods().filter((p) => p.alive && p.fly <= 0).length >= 2, 12_000)).toBe(true)
    bs.podsDown = bs.spec.podQuota - 1
    const egg = landed()!
    parkBossAwayFrom(egg.x, egg.y)
    const eggs = sim.getPods().filter((p) => p.alive).length
    const events = tapAt(egg.x, egg.y)
    expect(bs.phase, 'the quota opened the boss').toBe(2)
    expect(sim.getPods().filter((p) => p.alive)).toHaveLength(0)
    expect(events.filter((e) => e.k === 'podPop')).toHaveLength(eggs)
  })

  it('never floods: eggs, hatchlings and bodies stay under their caps in a fight nobody touches', () => {
    for (const [level, phaseIndex] of [[10, 0], [10, 1], [4, 1], [30, 1], [20, 2], [40, 0]] as const) {
      start(level)
      toPhase(phaseIndex)
      const spec = sim.getBoss()!.spec
      const maxAlive = sim.getLevel().maxAlive
      let mostEggs = 0
      let mostHatchlings = 0
      for (let t = 0; t < 45_000; t += 250) {
        run(250)
        const at = `${level} phase ${phaseIndex + 1} @${t}ms`
        expect(eggsInPlay(), `${at}: eggs`).toBeLessThanOrEqual(spec.eggCap)
        expect(hatchlings(), `${at}: hatchlings`).toBeLessThanOrEqual(spec.hatchlingCap)
        expect(live().length, `${at}: bodies`).toBeLessThanOrEqual(maxAlive)
        mostEggs = Math.max(mostEggs, eggsInPlay())
        mostHatchlings = Math.max(mostHatchlings, hatchlings())
      }
      // Not vacuous: an egg phase left alone for 45 s really does press on both.
      if (spec.phases[phaseIndex]!.script === 'pods') {
        expect(mostEggs, `${level}: egg cap never reached`).toBe(spec.eggCap)
        expect(mostHatchlings, `${level}: hatchling cap never reached`).toBe(spec.hatchlingCap)
      }
    }
  })

  it('keeps an egg with no room on its last crack instead of hatching it into nothing', () => {
    start(4)
    toPhase(1)
    const spec = sim.getBoss()!.spec
    // Nobody stomps: two eggs a beat, two ants an egg, five hatchlings at most.
    expect(until(() => sim.getPods().some((p) => p.alive && p.fly <= 0 && p.t === 0), 60_000)).toBe(true)
    expect(hatchlings()).toBeGreaterThan(spec.hatchlingCap - spec.broodAnts)
    const waiting = sim.getPods().find((p) => p.alive && p.fly <= 0 && p.t === 0)!
    run(1000)
    expect(waiting.alive, 'it waits for room').toBe(true)
  })
})

describe('the event stream', () => {
  it('drains, so a frame never replays the frame before it', () => {
    clearFloor()
    sim.spawnBug('ant', 50, 90)
    const first = tapAt(50, 90)
    expect(first.length).toBeGreaterThan(0)
    expect(sim.drainEvents()).toHaveLength(0)
  })

  it('reports the stomp itself, hit or miss, so the renderer can always ring it', () => {
    clearFloor()
    const events = tapAt(60, 100)
    const stomp = events.find((e) => e.k === 'stomp')
    expect(stomp).toBeDefined()
    if (stomp && stomp.k === 'stomp') {
      expect(stomp.r).toBeCloseTo(sim.stompRadius(), 6)
      expect(stomp.hit).toBe(false)
    }
  })
})

/**
 * ─── The press does not stomp; the release does ─────────────────────────────
 *
 * The control this game is played with, and the reason it changed.
 *
 * A press used to open with a quick stomp and only then begin winding up, which
 * made a charge impossible over anything worth charging at: press on a beetle
 * to slam its shell and the opening tap bounced off it first, press on a soft
 * body and the opening tap killed the thing being wound up for. The only way to
 * reach a slam was to hold over bare floor and walk the foot across — a control
 * nobody discovers, and the reason the slam went untaught in practice.
 *
 * These four cases are the contract that replaced it. The first is the bug
 * report; the rest are the things that must not break while fixing it.
 */
describe('a press winds up, wherever it lands', () => {
  it('does NOT touch the body under it while the finger is still down', () => {
    start(1)
    clearFloor()
    const bug = sim.spawnBug('ant', 50, 90)!
    footAt(50, 90)
    sim.drainEvents()
    sim.press(50, 90, performance.now())
    // Well past TAP_MS, so the wind-up has begun — directly on top of a body.
    run(300)
    expect(bug.alive, 'the press killed the body it was winding up at').toBe(true)
    expect(sim.getFoot().charge, 'no charge accrued on top of a body').toBeGreaterThan(0)
    expect(kinds(sim.drainEvents())).not.toContain('squish')
    sim.release()
  })

  it('lands a HEAVY blow on a body it charged on top of', () => {
    // The whole point: the same gesture that was impossible now works, and it
    // arrives as a slam rather than as the tap the old opening blow produced.
    start(1)
    clearFloor()
    const bug = sim.spawnBug('ant', 50, 90)!
    const ev = slamAt(50, 90)
    const squish = ev.find((e) => e.k === 'squish')
    expect(squish, 'the charged release did not land').toBeDefined()
    expect(squish && squish.k === 'squish' && squish.heavy).toBe(true)
    expect(bug.alive).toBe(false)
  })

  it('still stomps on a quick tap — the blow is owed, not cancelled', () => {
    start(1)
    clearFloor()
    const bug = sim.spawnBug('ant', 50, 90)!
    const ev = tapAt(50, 90)
    expect(kinds(ev)).toContain('squish')
    expect(bug.alive).toBe(false)
  })

  it('still stomps when a wind-up is let go EARLY, below the slam threshold', () => {
    // The cruellest possible input would be a partial charge that produced
    // nothing: the player holds, sees the foot rise, lets go a moment too soon
    // and the turn silently did not happen. A short charge owes a tap.
    start(1)
    clearFloor()
    const bug = sim.spawnBug('ant', 50, 90)!
    footAt(50, 90)
    sim.drainEvents()
    sim.press(50, 90, performance.now())
    run(200)
    const charge = sim.getFoot().charge
    expect(charge, 'this case must release mid-charge to mean anything')
      .toBeLessThan(0.34)
    expect(charge).toBeGreaterThan(0)
    sim.release()
    run(200)
    const ev = sim.drainEvents()
    expect(kinds(ev)).toContain('squish')
    const squish = ev.find((e) => e.k === 'squish')
    expect(squish && squish.k === 'squish' && squish.heavy, 'a part charge is not a slam')
      .toBe(false)
    expect(bug.alive).toBe(false)
  })
})
