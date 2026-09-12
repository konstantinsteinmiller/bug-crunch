// ─── A survivor going down ──────────────────────────────────────────────────
//
// The bug these were written for is not a crash: it is that a dead survivor
// used to spin about its feet and fade out from the first frame, which at crowd
// size reads as a body being deleted rather than one being killed. The owner's
// words: "they just quickly disappear".
//
// What replaced it is a fall with three beats and two drawn poses, and the
// things that make it read as a fall are all numeric — the blow rocks it back
// before it goes over, the rotation never reverses across a change of picture,
// it is fully opaque while it is going down, and it has actually LANDED and lain
// still before anything fades. Each of those is one line here, because each of
// them is invisible in a diff and obvious on screen.

import { describe, expect, it, beforeEach, vi } from 'vitest'
import {
  DOWN_FALL_SIDE, DOWN_K, DOWN_POSES, OUTFITS, SURVIVOR_FALL_MS,
  bakeSurvivorSlice, downPanelIndex, primeSurvivors, survivorDownFrame,
  survivorFallStep, survivorFrame, survivorsReady
} from '@/game/heroSprites'
import { FALL_COLS, FALL_FRAMES, FALL_ROWS, SURVIVOR_FALLS } from '@/game/artSheet'
import { CRASH_CAUSES, type DeathCause } from '@/game/survival'

/** The fall sampled every 1 %, which is finer than any frame the game draws. */
const walk = (rnd = 0.5): ReturnType<typeof survivorFallStep>[] => {
  const out = []
  for (let i = 0; i <= 100; i++) {
    const s = survivorFallStep(i / 100, rnd)
    // The step hands back a SHARED record — see the allocation test below — so
    // a walk of it has to copy.
    out.push({ ...s })
  }
  return out
}

describe('the fall has the shape of a fall', () => {
  it('starts on its feet and ends as a body on the ground', () => {
    const steps = walk()
    expect(steps[0]!.pose).toBe('run')
    // Plainly +0: the step normalises the jolt's signed zero at the source,
    // because the tilt it hands back is an unsigned magnitude.
    expect(steps[0]!.tilt).toBe(0)
    expect(steps.at(-1)!.pose).toBe('fallen')
    expect(steps.at(-1)!.tilt).toBe(0)
  })

  it('goes run → crash → fallen and never back', () => {
    const order = ['run', 'crash', 'fallen']
    let at = 0
    for (const s of walk()) {
      const i = order.indexOf(s.pose)
      expect(i, `${s.pose} after ${order[at]}`).toBeGreaterThanOrEqual(at)
      at = i
    }
    // All three actually happen: a fall that skipped the impact would pass the
    // check above and still be the thing this replaced.
    expect(new Set(walk().map((s) => s.pose)).size).toBe(3)
  })

  it('is rocked back INTO the blow before it goes over', () => {
    // The one beat that says the body was STOPPED by something rather than
    // simply toppling — and the whole of "crashes into the barricade rather
    // than through it", since the renderer signs this by the blow's direction.
    const jolt = walk().filter((s) => s.tilt < 0)
    expect(jolt.length).toBeGreaterThan(0)
    for (const s of jolt) {
      expect(s.pose).toBe('run')
      // …and it is compressed while it happens, not stretched.
      expect(s.squash).toBeLessThan(1)
      expect(s.stretch).toBeGreaterThan(1)
    }
    // A rock, not a fall: it is over inside a tenth of the window.
    expect(walk().findIndex((s) => s.tilt >= 0 && s.pose === 'run')).toBeLessThan(12)
  })

  it('never rotates back toward upright while the picture changes', () => {
    // The cut from the run frame to the crumple is the one place where a
    // "decay the residual to zero" rule would snap the body upright by half a
    // radian in one frame, which reads as a glitch rather than as a fall. The
    // crash pose is drawn barely leaning, so the renderer's rotation has to
    // pick up exactly where the run frame left it.
    const steps = walk()
    const lastRun = steps.filter((s) => s.pose === 'run').at(-1)!
    const firstCrash = steps.find((s) => s.pose === 'crash')!
    expect(firstCrash.tilt).toBeGreaterThanOrEqual(lastRun.tilt - 1e-9)
    // And through the crumple it keeps going over.
    const crash = steps.filter((s) => s.pose === 'crash')
    for (let i = 1; i < crash.length; i++) {
      expect(crash[i]!.tilt).toBeGreaterThanOrEqual(crash[i - 1]!.tilt - 1e-9)
    }
    // The body then settles: the last of the roll runs out and stays out.
    const fallen = steps.filter((s) => s.pose === 'fallen')
    for (let i = 1; i < fallen.length; i++) {
      expect(fallen[i]!.tilt).toBeLessThanOrEqual(fallen[i - 1]!.tilt + 1e-9)
    }
    expect(fallen.at(-1)!.tilt).toBe(0)
  })

  it('stays solid while it goes down, and lies still before it fades', () => {
    const steps = walk()
    // NOT the old behaviour: opaque for the whole of the topple and the
    // landing, so the player sees a body go down rather than one dissolving.
    for (const s of steps) {
      if (s.pose !== 'fallen') expect(s.alpha).toBe(1)
    }
    const fading = steps.filter((s) => s.alpha < 1)
    expect(fading.length).toBeGreaterThan(0)
    // …and by then it has been lying still for a real beat, not a frame.
    const still = steps.filter((s) => s.pose === 'fallen' && s.tilt === 0 && s.alpha === 1)
    expect(still.length / steps.length * SURVIVOR_FALL_MS).toBeGreaterThan(60)
    // The fade runs all the way out: a body left at half alpha pops.
    expect(steps.at(-1)!.alpha).toBe(0)
    for (let i = 1; i < fading.length; i++) {
      expect(fading[i]!.alpha).toBeLessThanOrEqual(fading[i - 1]!.alpha)
    }
    // It sinks as it goes, and only then.
    for (const s of steps) expect(s.sink > 0).toBe(s.alpha < 1)
  })

  it('gives every body its own fall without changing the beats', () => {
    const a = walk(0)
    const b = walk(1)
    for (let i = 0; i < a.length; i++) {
      expect(a[i]!.pose).toBe(b[i]!.pose)
      expect(a[i]!.alpha).toBe(b[i]!.alpha)
    }
    // Same beats, different bodies: a crowd that falls in lockstep is one
    // animation played 190 times.
    expect(a.some((s, i) => Math.abs(s.tilt - b[i]!.tilt) > 1e-6)).toBe(true)
  })

  it('clamps outside its window and allocates nothing', () => {
    expect(survivorFallStep(-5).pose).toBe('run')
    expect(survivorFallStep(-5).tilt).toBe(0)
    expect(survivorFallStep(9).pose).toBe('fallen')
    expect(survivorFallStep(9).alpha).toBe(0)
    // One shared record, refilled. The crowd loop calls this up to 190 times a
    // frame and a fresh object each time is 190 allocations a frame.
    expect(survivorFallStep(0.1)).toBe(survivorFallStep(0.9))
  })
})

describe('a body stopped by a THING stays against it', () => {
  // The other half of the ask — "they should fall down OR crash against the
  // obstacle". Both deaths are the same for the first third: the difference is
  // what the body ends up as, which is exactly why the sheet has two poses.
  const crashed = (cause: DeathCause, rnd = 0.5) => {
    const out = []
    for (let i = 0; i <= 100; i++) out.push({ ...survivorFallStep(i / 100, rnd, cause) })
    return out
  }

  it('never reaches the prone pose for anything the crowd ran into', () => {
    for (const cause of CRASH_CAUSES) {
      const steps = crashed(cause)
      expect(steps.some((s) => s.pose === 'fallen'), cause).toBe(false)
      expect(steps.at(-1)!.pose, cause).toBe('crash')
      // It still goes down as a fall for the first third: the beats the player
      // reads as being hit are the same whatever did it.
      expect(steps[0]!.pose).toBe('run')
      expect(steps.some((s) => s.tilt < 0)).toBe(true)
    }
  })

  it('arrives against it and settles back, instead of turning on over', () => {
    const wall = crashed('barricade')
    const open = walk()
    const held = wall.filter((s) => s.pose === 'crash')
    const over = open.filter((s) => s.pose === 'crash')
    // Short of the angle a body in the open turns through — past that lean the
    // crumple reads as a body on its way to the ground, which this one is not.
    expect(Math.max(...held.map((s) => s.tilt)))
      .toBeLessThan(Math.max(...over.map((s) => s.tilt)))
    // It arrives, then leans a little further into the thing and holds.
    const arrive = Math.max(...held.map((s) => s.tilt))
    expect(held.at(-1)!.tilt).toBeLessThan(arrive)
    expect(held.at(-1)!.tilt).toBeGreaterThan(0.4)
    const late = held.slice(-8).map((s) => s.tilt)
    for (const t of late) expect(t).toBeCloseTo(late[0]!, 2)
  })

  it('is cleared away on the same clock as every other body', () => {
    const steps = crashed('crate')
    for (const s of steps.slice(0, 80)) expect(s.alpha).toBe(1)
    expect(steps.at(-1)!.alpha).toBe(0)
    expect(steps.at(-1)!.sink).toBeGreaterThan(0)
  })

  it('leaves a death in the OPEN exactly as it was', () => {
    // Every cause the sim can bill that is not a thing in the road — and the
    // default, for any caller that does not know about causes at all.
    for (const cause of ['foe', 'elite', 'trap', 'slam'] as DeathCause[]) {
      const a = crashed(cause)
      const b = walk()
      expect(CRASH_CAUSES.has(cause)).toBe(false)
      for (let i = 0; i < a.length; i++) expect(a[i], `${cause} at ${i}`).toEqual(b[i])
    }
  })
})

describe('the fall is timed by the simulation, not beside it', () => {
  it('runs for exactly the window `killUnit` gives a body', async () => {
    // A drift here is silent: the fall would simply play at the wrong speed or
    // be cut off mid-topple, and look like a tuning problem rather than two
    // constants that stopped agreeing.
    const state = await import('@/use/useTowerState')
    state.__resetTowerState()
    const game = await import('@/use/useSurvivalGame')
    game.startStage(2)
    game.step(1000 / 60)
    const unit = game.getUnits()[0]
    expect(unit, 'the sim starts with a crowd').toBeDefined()
    game.__killUnitForTest(unit!)
    expect(unit!.dying).toBe(SURVIVOR_FALL_MS)
  })
})

describe('the pictures a fall is held on', () => {
  beforeEach(() => {
    primeSurvivors({ fetch: false })
    bakeSurvivorSlice(5000)
  })

  it('bakes both poses for every outfit, with the stride', () => {
    expect(survivorsReady()).toBe(true)
    for (let i = 0; i < OUTFITS.length; i++) {
      const run = survivorFrame(i, 0.25)
      expect(run).toBeTruthy()
      for (const pose of DOWN_POSES) {
        const down = survivorDownFrame(i, pose)
        expect(down, `${OUTFITS[i]!.id}/${pose}`).toBeTruthy()
        // Never the run frame handed back rolled over — that shortcut is what
        // the boss deaths were rejected for.
        expect(down).not.toBe(run)
      }
      expect(survivorDownFrame(i, 'crash')).not.toBe(survivorDownFrame(i, 'fallen'))
    }
  })

  it('keeps the fall in the same box as the stride, so a body lands where it stood', () => {
    for (let i = 0; i < OUTFITS.length; i++) {
      const run = survivorFrame(i, 0.25)!
      for (const pose of DOWN_POSES) {
        const down = survivorDownFrame(i, pose)!
        expect(down.width).toBe(run.width)
        expect(down.height).toBe(run.height)
      }
    }
  })

  it('reads one panel per outfit and pose, in the order the sheet is cut', () => {
    const seen = new Set<number>()
    for (const pose of DOWN_POSES) {
      for (let i = 0; i < OUTFITS.length; i++) {
        const at = downPanelIndex(i, pose)
        expect(at).toBeGreaterThanOrEqual(0)
        expect(at).toBeLessThan(FALL_FRAMES)
        seen.add(at)
      }
    }
    expect(seen.size).toBe(FALL_FRAMES)
    // Outfits across, poses down — and the manifest lays the sheet out that way
    // round, or the renderer would read a crumple where a body should be.
    expect(FALL_COLS).toBe(OUTFITS.length)
    expect(FALL_ROWS).toBe(DOWN_POSES.length)
    expect(downPanelIndex(0, DOWN_POSES[1]!)).toBe(FALL_COLS)
  })

  it('takes a strange outfit index without throwing', () => {
    for (const i of [-7, 0, 99]) {
      for (const pose of DOWN_POSES) expect(survivorDownFrame(i, pose)).toBeTruthy()
    }
  })

  it('holds the poses at moments of one death, in order', () => {
    // They are two samples of `monsterKit`'s own death timeline, which is what
    // makes the survivor's fall the boss's fall one size down rather than a
    // second, private idea about how a body goes over.
    expect(DOWN_K.crash).toBeGreaterThan(0)
    expect(DOWN_K.crash).toBeLessThan(DOWN_K.fallen)
    expect(DOWN_K.fallen).toBe(1)
    expect(DOWN_POSES).toEqual(['crash', 'fallen'])
    // One side for the whole cast, so the sheet is never mirrored by accident.
    expect(Math.abs(DOWN_FALL_SIDE)).toBe(1)
  })
})

describe('the painted fall drops in over the drawn one', () => {
  it('prefers the sheet when it is there, silently keeps drawing when it is not', async () => {
    vi.resetModules()
    const panels = Array.from({ length: FALL_FRAMES }, () => document.createElement('canvas'))
    let painted: HTMLCanvasElement[] | null = null
    vi.doMock('@/game/spriteStrip', () => ({
      stripFrame: () => null,
      stripFrames: () => painted,
      stripCacheSize: () => 0
    }))
    const hero = await import('@/game/heroSprites')
    const art = await import('@/game/art')
    hero.primeSurvivors({ fetch: false })
    hero.bakeSurvivorSlice(5000)

    // Missing art is not an error: the drawn fall is what the game plays.
    const drawn = hero.survivorDownFrame(0, 'fallen')
    expect(drawn).toBeTruthy()
    expect(panels).not.toContain(drawn)

    // …and when the painting lands, the renderer picks up the right PANEL of
    // it — a sheet read off by one is three survivors wearing each other's
    // deaths.
    painted = panels
    art.refreshArtOverrides()
    for (const pose of hero.DOWN_POSES) {
      for (let i = 0; i < hero.OUTFITS.length; i++) {
        expect(hero.survivorDownFrame(i, pose)).toBe(panels[hero.downPanelIndex(i, pose)])
      }
    }
    vi.doUnmock('@/game/spriteStrip')
    vi.resetModules()
  })

  it('probes the path the manifest paints to', () => {
    const sheet = SURVIVOR_FALLS[0]!
    expect(sheet.target).toBe(`images/heroes/${sheet.id}.webp`)
    expect(sheet.frames).toBe(FALL_FRAMES)
  })
})
