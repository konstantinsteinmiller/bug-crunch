import { describe, expect, it, beforeEach } from 'vitest'
import {
  ALL_CUTSCENES, FINALE, INSIDE, INTRO, MECHA, TRAIL, beatStarts, bossStinger,
  cutsceneCamera, cutsceneForLevel, cutsceneFrame, cutsceneLength,
  type CutsceneSpec
} from '@/game/cutscene'
import {
  __resetCutscenes, cutsceneActive, cutsceneSeen, skipCutscene,
  startCutscene, stepCutscene, cutsceneEndFrame
} from '@/use/useCutscene'

/**
 * ─── The intro cutscene ─────────────────────────────────────────────────────
 *
 * Two things are pinned here, and the first is the one the player notices.
 *
 * 1. ONCE, EVER. The flag is written when the scene STARTS, not when it ends, so
 *    losing stage 1-1 and retrying does not replay it — and neither does a
 *    reload, a closed tab, or a portal interstitial landing mid-scene. A
 *    cutscene is a thing that happened to the player, not a reward for clearing
 *    the level behind it.
 *
 * 2. THE HAND-OFF. The last frame of the scene is the first frame of the level:
 *    the camera has arrived at gameplay framing and the shoe is already down.
 *    A skip lands on that same frame rather than cutting to black, so the player
 *    who skips and the player who watches start from the same picture.
 */

beforeEach(() => { __resetCutscenes() })

describe('once, ever', () => {
  it('plays the first time and never again', () => {
    expect(cutsceneSeen('intro')).toBe(false)
    expect(startCutscene(INTRO)).toBe(true)
    expect(cutsceneActive.value).toBe(true)

    skipCutscene()
    expect(cutsceneActive.value).toBe(false)
    // The second attempt is the retry after losing 1-1.
    expect(startCutscene(INTRO)).toBe(false)
    expect(cutsceneActive.value).toBe(false)
  })

  it('is marked seen the moment it STARTS, not when it finishes', () => {
    // The case this protects: a player reloads, or a portal drops an
    // interstitial, four seconds into a nine-second scene. Marking on completion
    // would put them back at the beginning of a cutscene they were already
    // trying to get past.
    startCutscene(INTRO)
    expect(cutsceneSeen('intro'), 'seen before a single frame has been stepped')
      .toBe(true)
  })

  it('does not replay after the scene runs to its natural end', () => {
    startCutscene(INTRO)
    let guard = 0
    while (cutsceneActive.value && guard++ < 10_000) stepCutscene(100)
    expect(cutsceneActive.value).toBe(false)
    expect(startCutscene(INTRO)).toBe(false)
  })

  it('keeps the record per scene id, so 02 is not blocked by 01', () => {
    startCutscene(INTRO)
    expect(cutsceneSeen('intro')).toBe(true)
    expect(cutsceneSeen('trail')).toBe(false)
  })
})

describe('the hand-off', () => {
  it('ends at gameplay framing with the shoe down', () => {
    const end = cutsceneEndFrame(INTRO)
    expect(end.camera.zoom).toBeCloseTo(1, 2)
    expect(end.camera.x).toBeCloseTo(50, 1)
    expect(end.camera.y).toBeCloseTo(50, 1)
    expect(end.shoe).toBe(1)
  })

  it('a skip lands on the same frame the scene would have ended on', () => {
    startCutscene(INTRO)
    stepCutscene(1200)
    skipCutscene()
    const end = cutsceneEndFrame(INTRO)
    // Not a cut to black: the skipped player inherits the poised shoe too.
    expect(end.shoe).toBe(1)
    expect(end.camera.zoom).toBeCloseTo(1, 2)
  })

  it('opens wide, so the push-in has somewhere to come from', () => {
    const first = cutsceneFrame(INTRO, 0)
    expect(first.camera.zoom).toBeLessThan(0.8)
    expect(first.shoe).toBe(0)
  })
})

describe('the camera flight', () => {
  it('is 9.5 seconds across seven beats', () => {
    expect(INTRO.beats).toHaveLength(7)
    expect(cutsceneLength(INTRO)).toBe(9500)
  })

  it('moves between beats when motion is allowed', () => {
    // Mid-way through the push-in, the camera is between the two keyframes
    // rather than snapped to either.
    const { camera } = cutsceneCamera(INTRO, 2300)
    expect(camera.zoom).toBeGreaterThan(INTRO.beats[0]!.camera.zoom)
    expect(camera.zoom).toBeLessThan(INTRO.beats[1]!.camera.zoom)
  })

  it('CUTS instead of moving under prefers-reduced-motion', () => {
    // Same instant, `calm` on: the camera is already at the beat's own keyframe,
    // so the scene plays as held frames. The story survives, the movement does
    // not, which is the whole point of the setting.
    const { camera } = cutsceneCamera(INTRO, 2300, true)
    expect(camera.zoom).toBeCloseTo(INTRO.beats[1]!.camera.zoom, 5)
  })

  it('is pure — the same time gives the same picture', () => {
    const a = cutsceneFrame(INTRO, 4200)
    const b = cutsceneFrame(INTRO, 4200)
    expect(a.camera).toEqual(b.camera)
    expect(a.actors.length).toBe(b.actors.length)
  })
})

describe('the story beats actually happen', () => {
  it('has nobody on screen before the greeter arrives', () => {
    expect(cutsceneFrame(INTRO, 200).actors).toHaveLength(1)
  })

  it('shows the greeter waving at the camera on beat 3', () => {
    const f = cutsceneFrame(INTRO, 4000)
    expect(f.actors.some((a) => a.waving)).toBe(true)
  })

  it('turns one ant into a column, and a column into a raid', () => {
    const alone = cutsceneFrame(INTRO, 3200).actors.length
    const column = cutsceneFrame(INTRO, 5200).actors.length
    const raid = cutsceneFrame(INTRO, 7200).actors.length
    expect(column).toBeGreaterThan(alone)
    expect(raid).toBeGreaterThan(column)
  })

  it('carries the sandwich off before the shoe arrives', () => {
    expect(cutsceneFrame(INTRO, 500).sandwich).toBe(1)
    expect(cutsceneFrame(INTRO, 8000).sandwich).toBeLessThan(0.4)
  })

  it('freezes every ant when the shadow lands', () => {
    // Beat 6 is built on things stopping: the thing that sells a shadow is what
    // stops moving under it.
    const a = cutsceneFrame(INTRO, 7800).actors
    const b = cutsceneFrame(INTRO, 8400).actors
    expect(a.map((x) => [x.x, x.y])).toEqual(b.map((x) => [x.x, x.y]))
  })
})

/**
 * ─── Scenes 02-05, and the stingers ─────────────────────────────────────────
 *
 * The intro's tests above pin the machinery. These pin the STORIES: that the
 * trail is a route, that the attic is dark before it is lit, that the cabinet is
 * a cabinet before it is an arcade, and that the last thing that happens in Bug
 * Crunch is one ant taking one crumb.
 *
 * Each of them also re-pins the three contracts every scene inherits — once
 * ever, the hand-off frame, and the reduced-motion cut — because those are the
 * three that would break silently.
 */

/** Every scene that opens a level hands over on the gameplay camera. */
const OPENERS: readonly (readonly [string, CutsceneSpec])[] = [
  ['01 The Crumb', INTRO], ['02 The Trail', TRAIL],
  ['03 Inside', INSIDE], ['04 Mecha', MECHA]
]

describe('every scene keeps the contracts', () => {
  it('has a unique id, so the once-ever record can key on it', () => {
    const ids = ALL_CUTSCENES.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('records each id separately — watching one never consumes another', () => {
    for (const s of ALL_CUTSCENES) {
      expect(startCutscene(s), `${s.id} plays`).toBe(true)
      skipCutscene()
    }
    for (const s of ALL_CUTSCENES) {
      expect(cutsceneSeen(s.id), `${s.id} is recorded`).toBe(true)
      expect(startCutscene(s), `${s.id} never plays twice`).toBe(false)
    }
  })

  it.each(OPENERS)('%s hands over on the gameplay camera with the shoe down', (_n, spec) => {
    const end = cutsceneFrame(spec, cutsceneLength(spec))
    expect(end.camera.x).toBeCloseTo(50, 1)
    expect(end.camera.y).toBeCloseTo(50, 1)
    expect(end.camera.zoom).toBeCloseTo(1, 2)
    expect(end.shoe).toBe(1)
    // …and the last frame is LIT: a level that opens under a torch, or under a
    // darkness the scene forgot to lift, is a level the player cannot see.
    expect(end.dark).toBeLessThan(0.45)
  })

  it.each(ALL_CUTSCENES.map((s) => [s.id, s] as const))(
    '%s CUTS instead of moving under prefers-reduced-motion', (_id, spec) => {
      const at = beatStarts(spec)
      for (let i = 1; i < spec.beats.length; i++) {
        const mid = at[i]! + spec.beats[i]!.ms / 2
        const { camera } = cutsceneCamera(spec, mid, true)
        const want = spec.beats[i]!.camera
        // Per field rather than `toEqual`: the tween still runs, it just runs to
        // e = 1, and `a + (b - a) * 1` is not bit-identical to `b`.
        expect(camera.x, `beat ${i} x`).toBeCloseTo(want.x, 6)
        expect(camera.y, `beat ${i} y`).toBeCloseTo(want.y, 6)
        expect(camera.zoom, `beat ${i} zoom`).toBeCloseTo(want.zoom, 6)
      }
    })

  it.each(ALL_CUTSCENES.map((s) => [s.id, s] as const))(
    '%s is pure — the same time gives the same picture', (_id, spec) => {
      const t = cutsceneLength(spec) * 0.6
      const a = cutsceneFrame(spec, t)
      const b = cutsceneFrame(spec, t)
      expect(a.camera).toEqual(b.camera)
      expect(a.actors).toEqual(b.actors)
      expect([a.dark, a.torch, a.glow, a.shoe]).toEqual([b.dark, b.torch, b.glow, b.shoe])
    })

  it('runs 02-04 for five seconds and the finale for seven', () => {
    expect(cutsceneLength(TRAIL)).toBe(5000)
    expect(cutsceneLength(INSIDE)).toBe(5000)
    expect(cutsceneLength(MECHA)).toBe(5000)
    expect(cutsceneLength(FINALE)).toBe(7000)
  })
})

describe('which scene opens which level', () => {
  it('puts one on the first level of each world and nowhere else', () => {
    expect(cutsceneForLevel(1)).toBe(INTRO)
    expect(cutsceneForLevel(11)).toBe(TRAIL)
    expect(cutsceneForLevel(21)).toBe(INSIDE)
    expect(cutsceneForLevel(31)).toBe(MECHA)
    for (const n of [2, 5, 10, 12, 20, 22, 30, 32, 39, 40]) {
      expect(cutsceneForLevel(n), `level ${n}`).toBeNull()
    }
  })

  it('never offers the finale as a way INTO a level', () => {
    for (let n = 1; n <= 40; n++) expect(cutsceneForLevel(n)?.id).not.toBe('finale')
  })
})

describe('02 — the trail is a ROUTE', () => {
  it('opens on an empty plate with crumbs left on it', () => {
    const f = cutsceneFrame(TRAIL, 200)
    expect(f.sandwich).toBe(0)
    expect(f.crumb).toBeGreaterThan(0.5)
  })

  it('is on world 2 from the first frame to the last', () => {
    for (const t of [0, 1500, 3000, 5000]) {
      expect(cutsceneFrame(TRAIL, t).world).toBe(2)
    }
    // …and the blanket is drawn ON it as a patch, which is what lets the camera
    // cross the hem in one move instead of cutting to a different place.
    expect(cutsceneFrame(TRAIL, 0).set).toBe('yard')
  })

  it('has a column marching before the camera ever finds it', () => {
    // The joke is that the route was always there. Nothing arms, nothing
    // arrives: the line is walking at t=0 and still walking at the hand-off.
    expect(cutsceneFrame(TRAIL, 0).actors.length).toBeGreaterThan(6)
    expect(cutsceneFrame(TRAIL, 5000).actors.length).toBeGreaterThan(6)
  })

  it('joins a second line to the first on the pull-back', () => {
    const one = cutsceneFrame(TRAIL, 1200).actors.length
    const two = cutsceneFrame(TRAIL, 3600).actors.length
    expect(two).toBeGreaterThan(one)
  })

  it('stands a foreman over it, bigger than anything marching past', () => {
    const late = cutsceneFrame(TRAIL, 3600).actors
    const foreman = late.find((a) => a.bug === 'beetle' && a.cycle === 0)
    expect(foreman, 'a beetle standing still').toBeDefined()
    const marchers = late.filter((a) => a !== foreman)
    expect(foreman!.size).toBeGreaterThan(Math.max(...marchers.map((a) => a.size)))
  })

  it('leaves the picnic OFF the board, so 2-1 opens on bare grass', () => {
    // The blanket is parked east of the board. At the hand-off framing the
    // camera sees 0..100 and every picnic prop is past 100.
    const end = cutsceneFrame(TRAIL, 5000)
    expect(end.camera.x).toBeCloseTo(50, 1)
    expect(end.crumbAt.x).toBeGreaterThan(100)
  })
})

describe('03 — inside, and it is dark in here', () => {
  it('opens under a door and ends in the attic', () => {
    expect(cutsceneFrame(INSIDE, 200).set).toBe('door')
    expect(cutsceneFrame(INSIDE, 5000).set).toBe('attic')
  })

  it('goes properly dark in the middle and comes back out of it', () => {
    const at = beatStarts(INSIDE)
    expect(cutsceneFrame(INSIDE, at[1]! + 880).dark).toBeGreaterThan(0.85)
    expect(cutsceneFrame(INSIDE, 5000).dark).toBeLessThan(0.5)
  })

  it('narrows the torch to the stomp ring on the hand-off frame', () => {
    expect(cutsceneFrame(INSIDE, 0).torch).toBe(0)
    expect(cutsceneFrame(INSIDE, 5000).torch).toBe(1)
  })

  it('swaps the column for a floor that is MOVING', () => {
    // Early: one line, all heading the same way. Late: a crowd, heading
    // everywhere — which is the difference between "they came in here" and
    // "they live here".
    const early = cutsceneFrame(INSIDE, 600).actors
    const late = cutsceneFrame(INSIDE, 3800).actors
    expect(new Set(early.map((a) => a.heading.toFixed(3))).size).toBe(1)
    expect(new Set(late.map((a) => a.heading.toFixed(3))).size).toBeGreaterThan(6)
    expect(late.length).toBeGreaterThan(early.length)
  })
})

describe('04 — through the screen', () => {
  it('is a cabinet before it is an arcade', () => {
    expect(cutsceneFrame(MECHA, 200).set).toBe('cabinet')
    expect(cutsceneFrame(MECHA, 4000).set).toBe('arcade')
  })

  it('walks a plated roach across the marquee while the marquee is in shot', () => {
    // The beat this is FOR is beat 2, which frames x 24..76. A roach that has
    // already left by then is a roach nobody saw — which is exactly what the
    // first cut shipped.
    const at = beatStarts(MECHA)
    for (const t of [at[1]! + 100, at[1]! + 500, at[1]! + 900]) {
      const roach = cutsceneFrame(MECHA, t).actors.find((a) => a.bug === 'robobug')
      expect(roach, `on screen at ${t}`).toBeDefined()
      expect(roach!.x).toBeGreaterThan(24)
      expect(roach!.x).toBeLessThan(76)
    }
  })

  it('finally draws a painted boss, and takes it away before the hand-off', () => {
    const floor = cutsceneFrame(MECHA, 3600).actors
    expect(floor.some((a) => a.boss === 'roachPrime')).toBe(true)
    // 4-1 has no boss in it, so neither does the frame the level inherits.
    expect(cutsceneFrame(MECHA, 5000).actors.some((a) => a.boss)).toBe(false)
  })

  it('keeps the neon on', () => {
    expect(cutsceneFrame(MECHA, 500).glow).toBeGreaterThan(0.5)
    expect(cutsceneFrame(MECHA, 5000).glow).toBeGreaterThan(0.1)
  })
})

describe('05 — one crumb', () => {
  it('retreats through all four worlds, in reverse order', () => {
    const seen: number[] = []
    for (let t = 0; t <= 7000; t += 50) {
      const w = cutsceneFrame(FINALE, t).world
      if (seen[seen.length - 1] !== w) seen.push(w)
    }
    expect(seen).toEqual([4, 3, 2, 1])
  })

  it('lands on the opening wide shot, with the sandwich back and no shoe', () => {
    const home = cutsceneFrame(FINALE, 3400)
    expect(home.world).toBe(1)
    expect(home.set).toBe('picnic')
    expect(home.sandwich).toBe(1)
    expect(home.camera.zoom).toBeLessThan(0.8)
    // The shoe is OFF. That is the whole ending.
    for (const t of [0, 2000, 4000, 5500, 7000]) {
      expect(cutsceneFrame(FINALE, t).shoe, `t=${t}`).toBe(0)
    }
  })

  it('leaves the arcade, the attic and the backyard empty', () => {
    for (const t of [200, 1200, 2000, 3000]) {
      expect(cutsceneFrame(FINALE, t).actors, `t=${t}`).toHaveLength(0)
    }
  })

  it('sends in exactly ONE ant', () => {
    expect(cutsceneFrame(FINALE, 4600).actors).toHaveLength(1)
    expect(cutsceneFrame(FINALE, 4600).actors[0]!.bug).toBe('ant')
  })

  it('takes the crumb off the blanket and carries it away', () => {
    const before = cutsceneFrame(FINALE, 4600)
    expect(before.crumb).toBeGreaterThan(0.5)
    expect(before.actors[0]!.carry, 'empty-handed on the way in').toBe(false)

    const after = cutsceneFrame(FINALE, 5500)
    expect(after.crumb, 'gone from the blanket').toBeLessThan(0.5)
    expect(after.actors[0]!.carry, 'and in its jaws').toBe(true)
  })

  it('stops, looks at the camera, and nothing happens', () => {
    const at = beatStarts(FINALE)
    const look = cutsceneFrame(FINALE, at[5]! + 400).actors[0]!
    expect(look.waving, 'turned to the camera').toBe(true)
    // Beat. It does not move for the whole beat — the joke is that nothing
    // happens, and a creature drifting through it is something happening.
    const a = cutsceneFrame(FINALE, at[5]! + 200).actors[0]!
    const b = cutsceneFrame(FINALE, at[5]! + 800).actors[0]!
    expect([a.x, a.y]).toEqual([b.x, b.y])
    expect(FINALE.beats[5]!.sfx, 'silence').toBeUndefined()
  })

  it('walks away with it', () => {
    const still = cutsceneFrame(FINALE, 5800).actors[0]!
    const gone = cutsceneFrame(FINALE, 7000).actors[0]!
    expect(Math.hypot(gone.x - still.x, gone.y - still.y)).toBeGreaterThan(20)
    expect(gone.carry).toBe(true)
  })
})

describe('the boss stingers', () => {
  it('is two seconds, once per boss, and is the boss', () => {
    for (const boss of ['queenAnt', 'beetleKing', 'matriarch', 'roachPrime'] as const) {
      const s = bossStinger(boss)
      expect(s.id).toBe(`stinger-${boss}`)
      expect(cutsceneLength(s)).toBe(2000)
      expect(cutsceneFrame(s, 300).actors.some((a) => a.boss === boss)).toBe(true)
      // …and hands over on gameplay framing like everything else.
      const end = cutsceneFrame(s, 2000)
      expect(end.camera.zoom).toBeCloseTo(1, 2)
      expect(end.shoe).toBe(1)
    }
  })

  it('scatters its escort outwards as the boss arrives', () => {
    const s = bossStinger('matriarch')
    const spread = (as: { x: number; y: number }[]): number =>
      Math.max(...as.map((a) => Math.hypot(a.x - 50, a.y - 40)))
    const near = cutsceneFrame(s, 100).actors.filter((a) => !a.boss)
    const far = cutsceneFrame(s, 1400).actors.filter((a) => !a.boss)
    expect(spread(far)).toBeGreaterThan(spread(near))
  })
})

describe('the quality tier thins the crowd, never the cast', () => {
  it('draws fewer extras on a device that cannot afford them', () => {
    const high = cutsceneFrame(INSIDE, 3800, false, 1).actors.length
    const low = cutsceneFrame(INSIDE, 3800, false, 0.38).actors.length
    expect(low).toBeLessThan(high)
    expect(low).toBeGreaterThan(0)
  })

  it('never thins away a named actor, however low the tier goes', () => {
    // The last ant in the game is not an effect.
    expect(cutsceneFrame(FINALE, 5500, false, 0.1).actors).toHaveLength(1)
    // Nor is the foreman, nor the boss on 04's factory floor.
    expect(cutsceneFrame(TRAIL, 3600, false, 0.1).actors
      .some((a) => a.bug === 'beetle' && a.cycle === 0)).toBe(true)
    expect(cutsceneFrame(MECHA, 3600, false, 0.1).actors
      .some((a) => a.boss === 'roachPrime')).toBe(true)
  })
})
