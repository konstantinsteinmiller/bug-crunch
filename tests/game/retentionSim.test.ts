import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import * as sim from '@/use/useBugCrunchGame'
import type { GameEvent } from '@/use/useBugCrunchGame'
import { levelSpec, partySpec, PARTY_SECONDS, RUSH_MAX_SHARE } from '@/game/stages'
import { FLIP_MS, bugSpec } from '@/game/bugs'
import { chainScale, JUICE_DECAY_GRACE_MS } from '@/game/combo'
import { ECHO_MS, SPIN_SCALE } from '@/game/moves'
import { twistSpec } from '@/game/twists'
import type { MoveId } from '@/game/moves'

/**
 * ─── The retention set pieces, driven headlessly ────────────────────────────
 *
 * `RETENTION-FEATURES.md` #1-10, end to end through the real simulation: Rush
 * Lines, Big Finish, Growth Spurt, So Close!'s Second Wind, Shoebox Trials, Bug
 * Party, Beetle Bowling, the Boss Trophy moves and the Uh-oh! Twists. The same
 * harness as `sim.test.ts` — a faked `performance` clock advanced in lockstep
 * with the stepped frames, so a held press really becomes a charge.
 */

const BOARD = { w: 100, h: 180, x0: 5, y0: 10, x1: 95, y1: 170 }
const FRAME = 1000 / 60

const start = (level = 1, over: Partial<sim.StartOptions> = {}): void => {
  sim.setBoard(BOARD)
  sim.setTouch(false)
  sim.startLevel({
    level, shoe: 'sneaker', juiceStyle: 'ooze', singleTap: false,
    difficulty: 1, relief: 1, seed: 1234, ...over
  })
  if (!over.secondWind && !over.party) sim.resetVial()
  sim.drainEvents()
}

const run = (ms: number): GameEvent[] => {
  const out: GameEvent[] = []
  for (let t = 0; t < ms; t += FRAME) {
    vi.advanceTimersByTime(FRAME)
    sim.step(FRAME)
    out.push(...sim.drainEvents())
  }
  return out
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
  f.speed = 0
}

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
  return run(140).concat(sim.drainEvents())
}

const slamAt = (x: number, y: number): GameEvent[] => {
  const shoe = sim.getShoe()
  footAt(x, y)
  sim.drainEvents()
  sim.press(x, y, performance.now())
  run(300 + shoe.cooldown + shoe.chargeMs + 200)
  sim.release()
  return run(400)
}

/** Empty the floor, so a case knows exactly what is in reach. */
const emptyBoard = (): void => sim.__sim.clearBugs()

const kinds = (events: GameEvent[]): string[] => events.map((e) => e.k)
const live = () => sim.getBugs().slice(0, sim.getBugCount()).filter((b) => b.alive)

beforeAll(() => { vi.useFakeTimers({ toFake: ['performance'] }) })
afterAll(() => { vi.useRealTimers() })
beforeEach(() => {
  vi.advanceTimersByTime(60_000)
  start(1)
})

// ─── #3 Growth Spurt ────────────────────────────────────────────────────────

describe('Growth Spurt — the chain makes the shoe bigger', () => {
  it('grows the stomp circle with the chain, and lets it go when the chain lapses', () => {
    emptyBoard()
    const base = sim.stompRadius()
    // Five quick kills: ×3 on the ladder.
    for (let i = 0; i < 5; i++) {
      sim.spawnBug('ant', 50, 60 + i * 20)
      tapAt(50, 60 + i * 20)
    }
    run(200)
    expect(sim.chainMult.value).toBeGreaterThanOrEqual(3)
    expect(sim.stompRadius()).toBeGreaterThan(base * 1.08)
    expect(sim.stompRadius()).toBeLessThanOrEqual(base * chainScale(sim.chainMult.value) + 1e-6)
    // Let the chain lapse: it deflates back to the shoe's own size.
    run(3_000)
    expect(sim.chainCount.value).toBe(0)
    expect(sim.stompRadius()).toBeCloseTo(base, 1)
  })
})

// ─── #1 Rush Lines ──────────────────────────────────────────────────────────

describe('Rush Lines — the conga', () => {
  it('gives every non-boss level at least one rush, none bigger than its share of the quota', () => {
    for (let n = 1; n <= 40; n++) {
      const s = levelSpec(n)
      if (s.boss) { expect(s.rushes).toHaveLength(0); continue }
      expect(s.rushes.filter((r) => !r.practice).length, `level ${n}`).toBeGreaterThan(0)
      for (const r of s.rushes) {
        // Rounded UP: 1-1's five in a quota of eleven is the level's whole shape
        // (three ants, a conga, three ants) and is the one authored at the line.
        expect(r.count, `level ${n}`).toBeLessThanOrEqual(Math.max(3, Math.ceil(s.quota * RUSH_MAX_SHARE)))
        // A practice formation is exempt: 3-1's is a knot of beetles ON PURPOSE,
        // because the Quake Slam it teaches is the answer to exactly that.
        if (!r.practice) expect(bugSpec(r.bug).armor, `level ${n}: a conga of shells is a wall`).toBe(0)
      }
    }
  })

  it('tells, then walks exactly its count in — and holds the director off while it does', () => {
    const spec = levelSpec(1)
    const rush = spec.rushes[0]!
    sim.squished.value = Math.ceil(spec.quota * rush.at)
    const before = sim.getBugCount()
    const told = run(2_100)
    expect(kinds(told)).toContain('rushTell')
    const at = kinds(told).indexOf('rushTell')
    // Nothing spawns during the tell: the only new bodies are the rush's.
    const go = run(sim.RUSH_TELL_MS + 100)
    expect(kinds(go)).toContain('rushGo')
    const marchers = live().filter((b) => b.rush > 0)
    expect(marchers).toHaveLength(rush.count)
    expect(sim.getBugCount()).toBeGreaterThanOrEqual(before + rush.count - 1)
    // Every one of them came in from past the edge, and carries its crumb.
    for (const b of marchers) expect(b.crumb).toBe(true)
    void at
  })

  it('may take the board past its own ceiling — a rush is on top of the trickle', () => {
    const spec = levelSpec(1)
    run(8_000)
    sim.squished.value = Math.ceil(spec.quota * spec.rushes[0]!.at)
    run(2_100 + sim.RUSH_TELL_MS + 100)
    expect(sim.getBugCount()).toBeGreaterThan(spec.maxAlive)
  })

  it('opens 1-5 on a ring for the Heel Spin — but only for a player who owns it', () => {
    start(5)
    let ev = run(3_000)
    expect(ev.some((e) => e.k === 'rushTell' && e.practice === 'spin')).toBe(false)
    start(5, { moves: ['spin'] as MoveId[] })
    ev = run(3_000)
    const tell = ev.find((e) => e.k === 'rushTell')
    expect(tell && tell.k === 'rushTell' && tell.shape).toBe('ring')
  })

  it('counts a stomp that takes two or more as a MULTI', () => {
    emptyBoard()
    sim.spawnBug('ant', 50, 90)
    sim.spawnBug('ant', 52, 92)
    sim.spawnBug('ant', 48, 88)
    const ev = tapAt(50, 90)
    const multi = ev.find((e) => e.k === 'multi')
    expect(multi && multi.k === 'multi' && multi.n).toBe(3)
    expect(sim.tally.value.multiKills).toBe(1)
  })
})

// ─── #2 Big Finish ──────────────────────────────────────────────────────────

describe('Big Finish — the last body is gold', () => {
  it('announces one to go, and gilds the board', () => {
    const spec = levelSpec(3)
    start(3)
    emptyBoard()
    sim.squished.value = spec.quota - 2
    sim.spawnBug('ant', 50, 90)
    const ev = tapAt(50, 90)
    expect(kinds(ev)).toContain('finishReady')
    expect(sim.finale.value).toBe(true)
  })

  it('a SLAM on the last one clears the whole board, and scores it before the end', () => {
    const spec = levelSpec(3)
    start(3)
    emptyBoard()
    // Reach one-to-go by a real squish, so the finale is announced.
    sim.squished.value = spec.quota - 2
    sim.spawnBug('ant', 20, 40)
    tapAt(20, 40)
    expect(sim.finale.value).toBe(true)
    sim.spawnBug('ant', 50, 90)
    // A crowd far from the foot the finisher has to reach anyway.
    for (let i = 0; i < 6; i++) sim.spawnBug('ant', 15 + i * 12, 150)
    sim.spawnBug('beetle', 80, 40)
    const ev = slamAt(50, 90)
    const fin = ev.find((e) => e.k === 'finisher')
    expect(fin && fin.k === 'finisher' && fin.heavy).toBe(true)
    expect(fin && fin.k === 'finisher' && fin.n).toBeGreaterThanOrEqual(7)
    expect(kinds(ev).indexOf('finisher')).toBeLessThan(kinds(ev).indexOf('end'))
    expect(sim.phase.value).toBe('won')
    expect(sim.tally.value.score).toBe(sim.score.value)
    expect(live().length).toBe(0)
  })

  it('a SHORT press on the last one is still a tap — the one-to-go press lands on release', () => {
    const spec = levelSpec(3)
    start(3)
    emptyBoard()
    sim.squished.value = spec.quota - 2
    sim.spawnBug('ant', 20, 40)
    tapAt(20, 40)
    sim.spawnBug('ant', 50, 90)
    footAt(50, 90)
    sim.press(50, 90, performance.now())
    // Nothing lands on the press itself…
    expect(kinds(run(60))).not.toContain('stomp')
    sim.release()
    // …and the release is the tap.
    const ev = run(300)
    const fin = ev.find((e) => e.k === 'finisher')
    expect(fin && fin.k === 'finisher' && fin.heavy).toBe(false)
  })

  it('a TAP on the last one ends the level and scatters the rest', () => {
    const spec = levelSpec(3)
    start(3)
    emptyBoard()
    sim.squished.value = spec.quota - 1
    sim.spawnBug('ant', 50, 90)
    const stay = sim.spawnBug('ant', 50, 150)!
    const x0 = stay.x
    const y0 = stay.y
    const ev = tapAt(50, 90)
    const fin = ev.find((e) => e.k === 'finisher')
    expect(fin && fin.k === 'finisher' && fin.heavy).toBe(false)
    expect(sim.phase.value).toBe('won')
    // The afterglow keeps the survivor running for a moment after the win.
    run(400)
    expect(Math.hypot(stay.x - x0, stay.y - y0)).toBeGreaterThan(1)
  })
})

// ─── #4 So Close! ───────────────────────────────────────────────────────────

describe('So Close! — the Second Wind', () => {
  it('opens a retry with the vial full', () => {
    start(3, { secondWind: true })
    expect(sim.juice.value).toBe(1)
    expect(sim.feverCharged.value).toBe(true)
  })

  it('counts the ricochets a failed run can learn from', () => {
    start(3)
    emptyBoard()
    sim.spawnBug('beetle', 50, 90)
    tapAt(50, 90)
    expect(sim.tally.value.ricochets).toBe(1)
  })
})

// ─── The vial's grace ───────────────────────────────────────────────────────

describe('the vial only bleeds after a pause in the squishing', () => {
  it('holds its level through the grace after a squish', () => {
    emptyBoard()
    sim.spawnBug('ant', 50, 90)
    tapAt(50, 90)
    const after = sim.juice.value
    expect(after).toBeGreaterThan(0)
    run(JUICE_DECAY_GRACE_MS - 400)
    expect(sim.juice.value).toBe(after)
    run(3_000)
    expect(sim.juice.value).toBeLessThan(after)
  })
})

// ─── #8 Beetle Bowling ──────────────────────────────────────────────────────

describe('Beetle Bowling — slam it over, flick it through the crowd', () => {
  it('a slam that cracks a beetle flips it onto its back', () => {
    start(3)
    emptyBoard()
    const b = sim.spawnBug('beetle', 50, 90)!
    const ev = slamAt(50, 90)
    expect(kinds(ev)).toContain('flip')
    expect(b.alive).toBe(true)
    expect(b.flipped).toBeGreaterThan(0)
    expect(b.flipped).toBeLessThanOrEqual(FLIP_MS)
  })

  it('a tap finishes a beetle on its back', () => {
    start(3)
    emptyBoard()
    const b = sim.spawnBug('beetle', 50, 90)!
    slamAt(50, 90)
    const ev = tapAt(b.x, b.y)
    expect(kinds(ev)).toContain('squish')
  })

  it('a fast pass of the shoe kicks it, and the puck bowls over what it rolls into', () => {
    start(6)
    emptyBoard()
    const b = sim.spawnBug('beetle', 30, 90)!
    slamAt(30, 90)
    expect(b.flipped).toBeGreaterThan(0)
    // Pins down the lane to the right.
    for (let i = 0; i < 3; i++) sim.spawnBug('ant', 55 + i * 7, b.y)
    // Park the foot just left of the beetle, then sweep it right, fast.
    footAt(b.x - 6, b.y)
    sim.aim(b.x + 40, b.y)
    const ev = run(700)
    expect(kinds(ev)).toContain('kick')
    expect(ev.filter((e) => e.k === 'squish').length).toBeGreaterThanOrEqual(2)
  })
})

// ─── #6 Shoebox Trials ──────────────────────────────────────────────────────

describe('Shoebox Trials — wear the shoe before you can buy it', () => {
  it('drops a box on 1-2 and puts the foot in a Steel Boot when it is knocked open', () => {
    const spec = levelSpec(2)
    start(2)
    sim.squished.value = Math.ceil(spec.quota * (spec.trialAt ?? 0.35))
    const ev = run(100)
    expect(kinds(ev)).toContain('boxDrop')
    const box = sim.getHazards().find((h) => h.id === 'shoebox')!
    expect(box).toBeDefined()
    // Three taps, and not a miss among them.
    const misses = sim.tally.value.misses
    let opened: GameEvent[] = []
    for (let i = 0; i < 3; i++) opened = opened.concat(tapAt(box.x, box.y))
    expect(sim.tally.value.misses).toBe(misses)
    const trial = opened.find((e) => e.k === 'trial')
    expect(trial && trial.k === 'trial' && trial.shoe).toBe('steelBoot')
    run(400)
    expect(sim.getShoe().id).toBe('steelBoot')
    expect(sim.trialShoe.value).toBe('steelBoot')
    run(sim.TRIAL_MS + 500)
    expect(sim.getShoe().id).toBe('sneaker')
    expect(sim.trialShoe.value).toBeNull()
  })

  it('never offers a shoe the player already owns — it picks one they do not', () => {
    const spec = levelSpec(2)
    start(2, { owned: ['sneaker', 'steelBoot'] })
    sim.squished.value = Math.ceil(spec.quota * (spec.trialAt ?? 0.35))
    run(100)
    const box = sim.getHazards().find((h) => h.id === 'shoebox')!
    expect(box.shoe).toBeDefined()
    expect(box.shoe).not.toBe('steelBoot')
  })

  it('holds gilded laces — a free Fever that costs the vial nothing — for a player who owns them all', () => {
    const spec = levelSpec(2)
    start(2, { owned: ['sneaker', 'steelBoot', 'bunnySlipper', 'rollerSkate', 'cleatBoot', 'electricSock'] })
    sim.squished.value = Math.ceil(spec.quota * (spec.trialAt ?? 0.35))
    run(100)
    const box = sim.getHazards().find((h) => h.id === 'shoebox')!
    for (let i = 0; i < 3; i++) tapAt(box.x, box.y)
    expect(sim.trialShoe.value).toBe('laces')
    expect(sim.isFever()).toBe(true)
  })
})

describe('the body pool survives kills inside kills', () => {
  // The Electric Sock's arcs kill bodies from INSIDE the loop resolving a stomp.
  // Before the guards, the loop went on holding indices past the end of the live
  // range, "killed" dead slots, and walked the live count below zero — a crash
  // the scout found the first time a Shoebox handed the sock out on world 2.
  it('keeps the live count equal to the live bodies through a sock slam into a crowd', () => {
    start(17, { shoe: 'electricSock' })
    emptyBoard()
    for (let i = 0; i < 24; i++) sim.spawnBug('ant', 40 + (i % 6) * 4, 80 + Math.floor(i / 6) * 4)
    for (let k = 0; k < 4; k++) { slamAt(50, 86); tapAt(50, 86) }
    const n = sim.getBugCount()
    expect(n).toBeGreaterThanOrEqual(0)
    const alive = sim.getBugs().slice(0, n).filter((b) => b.alive).length
    expect(alive).toBe(n)
    // And the pool still spawns — a corrupted count broke `takeBug` outright.
    expect(sim.spawnBug('ant', 50, 50)).not.toBeNull()
  })
})

// ─── #7 Bug Party ───────────────────────────────────────────────────────────

describe('Bug Party — a chaos round you cannot lose', () => {
  it('runs the gilded boot the whole time, pours out of the sandwich, and wins on the timeout', () => {
    // The player walks in with a half-full vial; the party must not eat it.
    start(3)
    sim.getLevel()
    sim.startLevel({
      level: 3, shoe: 'sneaker', juiceStyle: 'ooze', singleTap: false,
      difficulty: 1, relief: 1.18, seed: 1, party: true
    })
    expect(sim.getLevel().party).toBe(true)
    expect(sim.isFever()).toBe(true)
    expect(sim.getLevel().time).toBe(PARTY_SECONDS)
    // Relief never lengthens a party.
    expect(sim.timeLeft.value).toBe(PARTY_SECONDS)
    const ev = run(PARTY_SECONDS * 1000 + 200)
    const end = ev.find((e) => e.k === 'end')
    expect(end && end.k === 'end' && end.won).toBe(true)
    expect(partySpec(3).quota).toBe(0)
  })

  it('hands the vial back afterwards', () => {
    start(3)
    sim.resetVial()
    // Fill it halfway by squishing.
    emptyBoard()
    for (let i = 0; i < 3; i++) { sim.spawnBug('beetle', 50, 60 + i * 30); slamAt(50, 60 + i * 30); tapAt(50, 60 + i * 30) }
    const carried = sim.juice.value
    sim.startLevel({
      level: 3, shoe: 'sneaker', juiceStyle: 'ooze', singleTap: false,
      difficulty: 1, relief: 1, seed: 1, party: true
    })
    run(PARTY_SECONDS * 1000 + 200)
    expect(sim.juice.value).toBeCloseTo(carried, 5)
  })
})

// ─── #9 Boss Trophies ───────────────────────────────────────────────────────

describe('Boss Trophies — the moves a boss drops', () => {
  const doubleTap = (x: number, y: number): GameEvent[] => {
    footAt(x, y)
    const now = performance.now()
    sim.press(x, y, now)
    sim.release()
    run(60)
    sim.press(x, y, performance.now())
    sim.release()
    return run(200)
  }

  it('a double tap is just two stomps until the Queen\'s Heel Spin is won', () => {
    emptyBoard()
    expect(kinds(doubleTap(50, 90))).not.toContain('pivot')
  })

  it('with the Heel Spin, a double tap spins — wide, and it flips a shell instead of bouncing off it', () => {
    start(3, { moves: ['spin'] })
    emptyBoard()
    const beetle = sim.spawnBug('beetle', 50 + sim.stompRadius() * 1.8, 90)!
    const ev = doubleTap(50, 90)
    const pivot = ev.find((e) => e.k === 'pivot')
    expect(pivot && pivot.k === 'pivot' && pivot.r).toBeCloseTo(sim.stompRadius() * SPIN_SCALE, 0)
    expect(beetle.flipped).toBeGreaterThan(0)
  })

  const dragSlides = (moves: MoveId[]): boolean => {
    start(11, { moves })
    emptyBoard()
    footAt(30, 90)
    sim.press(30, 90, performance.now())
    // The finger keeps dragging after the press — every pointermove re-aims.
    let slid = false
    for (let i = 0; i < 20; i++) {
      sim.aim(90, 90)
      run(FRAME)
      if (sim.getFoot().state === 'slide') slid = true
    }
    sim.release()
    return slid
  }

  it('without the Skid, a press dragged on bare floor is just a stomp', () => {
    expect(dragSlides([])).toBe(false)
  })

  it('with the Skid, a press dragged on bare floor slides', () => {
    expect(dragSlides(['skid'])).toBe(true)
  })

  it('with the Quake Slam, a full charge sends a ring that flips every shell it crosses', () => {
    start(21, { moves: ['quake'] })
    emptyBoard()
    const b = sim.spawnBug('beetle', 50 + 30, 90)!
    const ev = slamAt(50, 90)
    expect(kinds(ev)).toContain('quake')
    expect(b.flipped).toBeGreaterThan(0)
  })

  it('with the Echo Stomp, a slam lands again on the same spot', () => {
    start(31, { moves: ['echo'] })
    emptyBoard()
    const shoe = sim.getShoe()
    footAt(50, 90)
    sim.press(50, 90, performance.now())
    run(300 + shoe.cooldown + shoe.chargeMs + 200)
    sim.release()
    run(160)
    // A body arrives on the spot after the first blow…
    sim.spawnBug('ant', 50, 90)
    const ev = run(ECHO_MS + 200)
    expect(kinds(ev)).toContain('echo')
    expect(kinds(ev)).toContain('squish')
  })
})

// ─── #10 Uh-oh! Twists ──────────────────────────────────────────────────────

describe('Uh-oh! Twists — one surprise in the middle of a level', () => {
  it('1-7 tips the lemonade: tells, lays a slick lane, and takes it up again', () => {
    const spec = levelSpec(7)
    expect(spec.twist).toBe('spill')
    start(7)
    sim.squished.value = Math.ceil(spec.quota * 0.5)
    const t = twistSpec('spill')
    const told = run(200)
    expect(kinds(told)).toContain('twistTell')
    const started = run(t.tellMs + 100)
    expect(kinds(started)).toContain('twistStart')
    expect(sim.getHazards().some((h) => h.id === 'slick')).toBe(true)
    const ended = run(t.activeMs + 100)
    expect(kinds(ended)).toContain('twistEnd')
    expect(sim.getHazards().some((h) => h.id === 'slick')).toBe(false)
  })

  it('3-4\'s blackout freezes every body for a second when the lights come back', () => {
    const spec = levelSpec(24)
    expect(spec.twist).toBe('blackout')
    start(24)
    sim.squished.value = Math.ceil(spec.quota * 0.5)
    const t = twistSpec('blackout')
    run(200 + t.tellMs + t.activeMs + 100)
    const frozen = live().filter((b) => b.frozen > 0)
    expect(frozen.length).toBeGreaterThan(0)
  })

  it('4-6\'s glitch drops every robobug\'s plate: a tap kills one', () => {
    const spec = levelSpec(36)
    expect(spec.twist).toBe('glitch')
    start(36)
    sim.squished.value = Math.ceil(spec.quota * 0.5)
    run(200 + twistSpec('glitch').tellMs + 100)
    emptyBoard()
    sim.spawnBug('robobug', 50, 90)
    const ev = tapAt(50, 90)
    expect(kinds(ev)).toContain('squish')
  })
})
