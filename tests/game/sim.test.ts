import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import * as sim from '@/use/useBugCrunchGame'
import type { Bug, GameEvent } from '@/use/useBugCrunchGame'
import { COMBO_WINDOW_MS } from '@/game/combo'
import { levelSpec } from '@/game/stages'

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

/** A complete quick stomp at (x, y): press, land, resolve. */
const tapAt = (x: number, y: number): GameEvent[] => {
  footAt(x, y)
  sim.drainEvents()
  sim.press(x, y, performance.now())
  run(140)
  sim.release()
  return sim.drainEvents()
}

/**
 * A complete heavy slam at (x, y), through the real charge path.
 *
 * A press ALWAYS opens with a quick stomp (see `press`), so the charge only
 * begins once that tap has landed and recovered. The wait is therefore the
 * whole of drop + impact + cooldown + charge, and the opening tap's events are
 * drained away before the release so the caller sees the SLAM and nothing else.
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
 * Every case here runs on LEVEL 2 — the sprinter's own level. It has no
 * hazards to ground anything, a quota of 12 so a handful of test taps cannot
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
      start(2)
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
      start(2)
      const b = oneSprinter()
      footAt(b.x, b.y + 14)
      expect(watchBolt(b, 1500)).toBe(false)
      expect(b.sense).toBe(0)
    })

    it('stops DEAD when the run ends, which is the whole kill window', () => {
      start(2)
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
      start(2)
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
      start(2)
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
      start(2, { shoe: 'bunnySlipper' })
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
      start(2)
      sim.setTouch(true)
      const b = oneSprinter()
      rushAt(b)
      expect(watchBolt(b, 1500)).toBe(false)
      expect(b.sense).toBe(0)
    })

    it('bolts once when a stomp lands NEAR it instead of on it', () => {
      start(2)
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
      start(2)
      sim.setTouch(true)
      const b = oneSprinter()
      tapAt(b.x, b.y + sim.stompRadius() * 4)
      expect(watchBolt(b, 900)).toBe(false)
    })

    it('is still scared by a near miss in a silent shoe — a stomp is a stomp', () => {
      start(2, { shoe: 'bunnySlipper' })
      sim.setTouch(true)
      const b = oneSprinter()
      const gap = sim.stompRadius() + b.spec.size + 3
      tapAt(b.x, b.y + gap)
      expect(b.alive).toBe(true)
      expect(watchBolt(b, 900)).toBe(true)
    })
  })

  // 1-7's lesson, pinned. Honey grounds a sprinter exactly as it grounds a
  // flea — without it the answer world 1 hands over would quietly not work.
  //
  // Each case carries its own CONTROL on the same board: the identical rush
  // against a body standing on bare floor a few metres away. Without that, a
  // "did not bolt" assertion passes just as happily when the sprinter is broken
  // as when the honey is working.
  describe('in honey', () => {
    /** Level 7 is the honey level. Its first puddle is the one used here. */
    const puddle = (): { x: number; y: number } => {
      const h = sim.getHazards().find((p) => p.id === 'honey')
      expect(h).toBeDefined()
      return { x: h!.x, y: h!.y }
    }

    /** A patch of level 7's floor with nothing on it. */
    const BARE = { x: 80, y: 60 }

    const at = (x: number, y: number): Bug => {
      clearFloor()
      footAt(20, 20)
      const b = sim.spawnBug('sprinter', x, y)!
      b.heading = -Math.PI / 2
      return b
    }

    it('cannot bolt away from an approaching shoe, where bare floor could', () => {
      start(7)
      const control = at(BARE.x, BARE.y)
      rushAt(control)
      expect(watchBolt(control, 1100)).toBe(true)

      const p = puddle()
      const stuck = at(p.x, p.y)
      rushAt(stuck)
      expect(watchBolt(stuck, 1500)).toBe(false)
    })

    it('cannot bolt away from a near miss either', () => {
      start(7)
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
    // Fill it the honest way: squish until the vial reads full.
    for (let i = 0; i < 400 && sim.juice.value < 1; i++) {
      clearFloor()
      sim.spawnBug('pinatafly', 50, 90)
      tapAt(50, 90)
    }
    expect(sim.juice.value).toBe(1)
    expect(sim.feverCharged.value).toBe(true)

    expect(sim.tryFever()).toBe(true)
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
