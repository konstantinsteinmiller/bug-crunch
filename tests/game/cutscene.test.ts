import { describe, expect, it, beforeEach } from 'vitest'
import {
  ALL_CUTSCENES, FINALE, INSIDE, INTRO, LAIR_NEST, MECHA, REMATCH, TRAIL, actorCovered, actorInView,
  actorReach, beatStarts, bossStinger, cutsceneArtWants, cutsceneCamera, cutsceneForLevel,
  cutsceneFrame, cutsceneLength, cutsceneStageFrom, cutsceneView, openingCutscene, setCovers,
  type CutsceneActor, type CutsceneFrame, type CutsceneSpec, type CutsceneStage
} from '@/game/cutscene'
import {
  __resetCutscenes, cutsceneActive, cutsceneSeen, skipCutscene,
  startCutscene, stepCutscene, cutsceneEndFrame, cutsceneFrameNow
} from '@/use/useCutscene'
import { qualityTier, sampleFrame } from '@/use/useVfx'

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
    // Nobody at all: the wide shot's whole note is that nothing moves.
    expect(cutsceneFrame(INTRO, 200).actors).toHaveLength(0)
    expect(cutsceneFrame(INTRO, 3000).actors).toHaveLength(1)
  })

  it('shows the greeter waving at the camera on beat 3', () => {
    const f = cutsceneFrame(INTRO, 4000)
    expect(f.actors.some((a) => a.waving)).toBe(true)
  })

  it('turns one ant into a raid that keeps on coming', () => {
    const alone = cutsceneFrame(INTRO, 3200).actors.length
    const first = cutsceneFrame(INTRO, 5200).actors.length
    const raid = cutsceneFrame(INTRO, 7200).actors.length
    expect(alone).toBe(1)
    expect(first).toBeGreaterThan(alone)
    expect(raid).toBeGreaterThan(first)
  })

  it('rushes in from every side of the plate, not down one line', () => {
    // Where each raider is on the frame it first exists in, by quadrant round
    // the plate. The shipped trail came from one direction; a raid comes from
    // all four.
    const quadrants = new Set<string>()
    const seen = new Set<number>()
    for (let t = 0; t <= 7400; t += 16) {
      for (const a of cutsceneFrame(INTRO, t).actors) {
        if (a.greeter || seen.has(a.id)) continue
        seen.add(a.id)
        quadrants.add(`${a.x < 50 ? 'W' : 'E'}${a.y < 42 ? 'N' : 'S'}`)
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(20)
    expect([...quadrants].sort()).toEqual(['EN', 'ES', 'WN', 'WS'])
  })

  it('makes the greeter one of the stream hauling the sandwich home', () => {
    // Not a lone ant with a crumb and not a duplicate: the same creature, still
    // carrying, walking the same way as the raiders who have turned for home.
    const f = cutsceneFrame(INTRO, 7400)
    const greeters = f.actors.filter((a) => a.greeter)
    expect(greeters).toHaveLength(1)
    const g = greeters[0]!
    expect(g.carry).toBe(true)
    const along = f.actors.filter((a) => !a.greeter && a.carry
      && Math.abs(Math.atan2(Math.sin(a.heading - g.heading), Math.cos(a.heading - g.heading))) < Math.PI / 3)
    expect(along.length).toBeGreaterThanOrEqual(4)
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
  ['03 Inside', INSIDE], ['04 Mecha', MECHA], ['1-10 Seconds', REMATCH]
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
  it("puts one on the first level of each world, on the Queen's rematch, and nowhere else", () => {
    expect(cutsceneForLevel(1)).toBe(INTRO)
    expect(cutsceneForLevel(10)).toBe(REMATCH)
    expect(cutsceneForLevel(11)).toBe(TRAIL)
    expect(cutsceneForLevel(21)).toBe(INSIDE)
    expect(cutsceneForLevel(31)).toBe(MECHA)
    for (const n of [2, 4, 5, 12, 20, 22, 30, 32, 39, 40]) {
      expect(cutsceneForLevel(n), `level ${n}`).toBeNull()
    }
  })

  it("opens 1-4 on the Queen's stinger and 1-10 on her rematch, never on the stinger", () => {
    // The stinger is once-ever and keyed by boss, so by 1-10 it has been spent
    // on 1-4. The rematch was the one boss level that opened on nothing.
    expect(openingCutscene(4, 'queenAnt')?.id).toBe('stinger-queenAnt')
    expect(openingCutscene(10, 'queenAnt')).toBe(REMATCH)
    expect(openingCutscene(20, 'beetleKing')?.id).toBe('stinger-beetleKing')
    expect(openingCutscene(7, null)).toBeNull()
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
    // Both lines exist the whole scene now — switching the second one on was a
    // pop — so this is about what is IN SHOT: on the plate close-up everything
    // marches one way; on the pull-back a second heading has come into frame.
    const headingsInShot = (t: number): Set<string> => {
      const f = cutsceneFrame(TRAIL, t)
      const v = cutsceneView(f.camera, 1280, 720)
      return new Set(f.actors
        .filter((a) => actorInView(a, v) && a.cycle !== 0)
        .map((a) => a.heading.toFixed(2)))
    }
    expect(headingsInShot(300).size).toBe(1)
    expect(headingsInShot(3600).size).toBeGreaterThan(1)
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

  it('finally draws a painted boss, and frames it out before the hand-off', () => {
    // The top of the pull-back, where the whole floor is in shot.
    const floor = cutsceneFrame(MECHA, 4150)
    const boss = floor.actors.find((a) => a.boss === 'roachPrime')
    expect(boss).toBeDefined()
    // 4-1 has no boss in it, so neither does the frame the level inherits — on
    // any screen. It is not switched off to get there (that was a pop in the
    // middle of the wide shot); the snap to gameplay framing leaves it behind.
    const end = cutsceneFrame(MECHA, 5000)
    for (const [w, h] of [[390, 844], [844, 390], [1280, 720], [2560, 1080]] as const) {
      expect(actorInView(boss!, cutsceneView(floor.camera, w, h)), `wide shot, ${w}x${h}`).toBe(true)
      for (const a of end.actors.filter((x) => x.boss)) {
        expect(actorInView(a, cutsceneView(end.camera, w, h)), `hand-off, ${w}x${h}`).toBe(false)
      }
    }
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

/**
 * ─── 1-10 — "Seconds" ───────────────────────────────────────────────────────
 *
 * The Queen's rematch. Three things are pinned here, and the last is the one
 * that would break silently: the story (eggs, lunch, growth, a huff, a charge),
 * that the nursery is in a corner NO screen can see at the hand-off, and that
 * she lands exactly where the level has already spawned her — which depends on
 * the screen's shape and the HUD's height, so it is asserted per screen through
 * a stage built the way `GameScene` builds it.
 */

/** A board the way `GameScene.syncBoard` measures one — a top bar, a bottom
 *  bar and the vial's rail carved out, in board units. */
const boardFor = (w: number, h: number): { x0: number; y0: number; x1: number; y1: number } => {
  const u = Math.min(w, h) / 100
  return { x0: Math.min(w * 0.2, 58) / u, y0: 68 / u, x1: (w - 6) / u, y1: (h - 92) / u }
}

/** …and the stage the sim puts on it: the boss where `spawnBoss` spawns her,
 *  and four props at fixed fractions. */
const stageFor = (w: number, h: number): CutsceneStage => {
  const b = boardFor(w, h)
  const boss = {
    x: (b.x0 + b.x1) / 2,
    y: b.y0 + (b.y1 - b.y0) * 0.3,
    size: Math.min(15, Math.min(b.x1 - b.x0, b.y1 - b.y0) * 0.22)
  }
  const prop = (id: 'crumbs' | 'honey', fx: number, fy: number) =>
    ({ id, x: b.x0 + (b.x1 - b.x0) * fx, y: b.y0 + (b.y1 - b.y0) * fy, r: 6, angle: 0.4, phase: 0.2, seed: 3 })
  return cutsceneStageFrom(w, h, Math.min(w, h) / 100, boss, [
    prop('crumbs', 0.3, 0.3), prop('crumbs', 0.7, 0.72), prop('honey', 0.62, 0.22), prop('honey', 0.24, 0.76)
  ])
}

/** Every screen the rematch has to hand over on — the pop-in test's three, and
 *  the two shapes furthest from them. */
const HANDOFF_SCREENS: readonly (readonly [string, number, number])[] = [
  ['portrait phone', 390, 844], ['landscape phone', 844, 390], ['landscape desktop', 1280, 720],
  ['tablet portrait', 768, 1024], ['ultrawide', 2560, 1080]
]

const queenOf = (f: CutsceneFrame): CutsceneActor => f.actors.find((a) => a.boss === 'queenAnt')!

describe('1-10 — "Seconds": she is back, and bigger', () => {
  it('is once-ever and short, like everything else', () => {
    expect(REMATCH.id).toBe('rematch')
    expect(cutsceneLength(REMATCH)).toBeGreaterThanOrEqual(5000)
    expect(cutsceneLength(REMATCH)).toBeLessThanOrEqual(7000)
    expect(startCutscene(REMATCH)).toBe(true)
    skipCutscene()
    expect(startCutscene(REMATCH)).toBe(false)
  })

  it('opens on the eggs, with the Queen just out of shot on every screen', () => {
    const f = cutsceneFrame(REMATCH, 0)
    expect(f.set).toBe('lair')
    const q = queenOf(f)
    for (const [screen, w, h] of HANDOFF_SCREENS.slice(0, 3)) {
      const v = cutsceneView(f.camera, w, h)
      const inView = (x: number, y: number): boolean => x > v.x0 && x < v.x1 && y > v.y0 && y < v.y1
      expect(inView(LAIR_NEST.x, LAIR_NEST.y), `${screen}: the nest`).toBe(true)
      expect(inView(q.x, q.y), `${screen}: the Queen's middle`).toBe(false)
    }
    // …and the eggs are being brought in, not just lying there.
    expect(f.actors.filter((a) => a.carry && a.load === 'egg')).toHaveLength(2)
  })

  it('brings her the sandwich, and she eats all of it before she looks up', () => {
    const at = beatStarts(REMATCH)
    const served = cutsceneFrame(REMATCH, at[2]! - 50)
    expect(served.sandwich).toBe(1)
    const crew = served.actors.find((a) => a.crew)!
    expect(crew.carry && crew.load === 'sandwich').toBe(true)
    // Held under her chin: below her middle, and within a body's length of it.
    const q = queenOf(served)
    expect(crew.y).toBeGreaterThan(q.y)
    expect(Math.hypot(crew.x - q.x, crew.y - q.y)).toBeLessThan(q.size * 2)
    // Two bites, two beats: half, then none.
    expect(cutsceneFrame(REMATCH, at[3]!).sandwich).toBeCloseTo(0.5, 5)
    expect(cutsceneFrame(REMATCH, at[4]!).sandwich).toBe(0)
  })

  it("grows with each bite, from smaller than the fight's Queen to exactly her", () => {
    const at = beatStarts(REMATCH)
    const before = queenOf(cutsceneFrame(REMATCH, at[2]! - 50)).size
    const bite = queenOf(cutsceneFrame(REMATCH, at[3]!)).size
    const after = queenOf(cutsceneFrame(REMATCH, at[4]!)).size
    const end = queenOf(cutsceneFrame(REMATCH, cutsceneLength(REMATCH))).size
    expect(bite).toBeGreaterThan(before)
    expect(after).toBeGreaterThan(bite)
    expect(before).toBeLessThan(end * 0.75)
    expect(end).toBe(15)
  })

  it('rears up at the player and huffs, and the crew bolts, before she charges', () => {
    const at = beatStarts(REMATCH)
    const q = queenOf(cutsceneFrame(REMATCH, at[4]! + 500))
    expect(q.waving, 'turned to the camera').toBe(true)
    expect(q.huff, 'huffing').toBeDefined()
    // She does not go anywhere while she does it.
    const later = queenOf(cutsceneFrame(REMATCH, at[4]! + 900))
    expect([later.x, later.y]).toEqual([q.x, q.y])
    // The crew is running away from her, up past the nest.
    const crewA = cutsceneFrame(REMATCH, at[4]! + 200).actors.find((a) => a.crew)!
    const crewB = cutsceneFrame(REMATCH, at[4]! + 900).actors.find((a) => a.crew)!
    expect(crewB.x).toBeLessThan(crewA.x - 10)
    // Then the charge: moving, no longer rearing, turned towards the board.
    const run = queenOf(cutsceneFrame(REMATCH, at[5]! + 600))
    expect(run.waving).toBe(false)
    expect(run.x).toBeGreaterThan(q.x + 10)
    expect(Math.cos(run.heading - Math.PI)).toBeLessThan(0.9)
  })

  it.each(HANDOFF_SCREENS)(
    'lands the Queen exactly where the level spawned her, facing down, on a %s', (_n, w, h) => {
      const stage = stageFor(w, h)
      const end = cutsceneFrame(REMATCH, cutsceneLength(REMATCH), false, 1, stage)
      const q = queenOf(end)
      expect(q.x).toBeCloseTo(stage.boss!.x, 6)
      expect(q.y).toBeCloseTo(stage.boss!.y, 6)
      expect(q.size).toBeCloseTo(stage.boss!.size, 6)
      // Facing down the screen — the way the sim turns her on the fight's first
      // frame — and not mid-gesture.
      expect(Math.cos(q.heading - Math.PI)).toBeCloseTo(1, 6)
      expect(q.waving).toBe(false)
      expect(q.huff).toBeUndefined()
      // And on the PIXEL the fight draws her on: the scene's camera puts her
      // where the board's own `toX`/`toY` would.
      const v = cutsceneView(end.camera, w, h)
      const u = Math.min(w, h) / 100
      const b = boardFor(w, h)
      expect((q.x - v.x0) * u).toBeCloseTo(((b.x0 + b.x1) / 2) * u, 6)
      expect((q.y - v.y0) * u).toBeCloseTo((b.y0 + (b.y1 - b.y0) * 0.3) * u, 6)
    })

  it.each(HANDOFF_SCREENS)(
    'leaves nothing but the Queen in the hand-off frame, calm or not, on a %s', (_n, w, h) => {
      const stage = stageFor(w, h)
      for (const calm of [false, true]) {
        const end = cutsceneFrame(REMATCH, cutsceneLength(REMATCH), calm, 1, stage)
        const v = cutsceneView(end.camera, w, h)
        const extras = end.actors.filter((a) => !a.boss && actorInView(a, v))
        expect(extras.map((a) => `#${a.id} ${a.bug} at (${a.x.toFixed(0)}, ${a.y.toFixed(0)})`)).toEqual([])
        // The nursery itself, eggs and all, is past the corner.
        const nestOff = LAIR_NEST.x + LAIR_NEST.hw < v.x0 || LAIR_NEST.y + LAIR_NEST.hh < v.y0
        expect(nestOff, 'the nest is off-frame').toBe(true)
      }
    })

  it("draws the level's own props, handed to it on the stage", () => {
    const stage = stageFor(1280, 720)
    expect(cutsceneFrame(REMATCH, 3000, false, 1, stage).stage).toBe(stage)
    expect(cutsceneFrame(REMATCH, 3000).stage).toBeNull()
  })

  it('thins its nurses on a slow device, never the Queen, her lunch or the egg-bearers', () => {
    const full = cutsceneFrame(REMATCH, 3000, false, 1).actors
    const thin = cutsceneFrame(REMATCH, 3000, false, 0.1).actors
    expect(thin.length).toBeLessThan(full.length)
    const named = [
      (a: CutsceneActor) => a.boss === 'queenAnt',
      (a: CutsceneActor) => !!a.crew,
      (a: CutsceneActor) => a.load === 'egg'
    ]
    for (const is of named) expect(thin.filter(is).length).toBe(full.filter(is).length)
  })

  it('asks for every painting it draws before it plays', () => {
    const keys = cutsceneArtWants(REMATCH).map(([k, id]) => `${k}/${id}`)
    for (const want of ['boss/queenAnt', 'prop/pod', 'scene/nest', 'scene/sandwich', 'scene/puff', 'bug/ant', 'bg/floor-1']) {
      expect(keys, want).toContain(want)
    }
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('the stage', () => {
  it('is the board, moved to where the hand-off camera shows it', () => {
    // The board draws with its origin at the screen's top-left; the hand-off
    // camera puts (50, 50) at the screen's centre at the same scale. The board's
    // corners must land on the hand-off view's corners, on every screen shape.
    for (const [screen, w, h] of HANDOFF_SCREENS) {
      const u = Math.min(w, h) / 100
      const s = cutsceneStageFrom(w, h, u, { x: 0, y: 0, size: 1 }, [
        { id: 'honey', x: w / u, y: h / u, r: 1, angle: 0, phase: 0, seed: 0 }
      ], { x: w / u / 2, y: h / u / 2, r: 9, z: 0.3, highVis: false })
      const v = cutsceneView({ x: 50, y: 50, zoom: 1 }, w, h)
      expect(s.boss!.x, `${screen} x0`).toBeCloseTo(v.x0, 6)
      expect(s.boss!.y, `${screen} y0`).toBeCloseTo(v.y0, 6)
      expect(s.props![0]!.x, `${screen} x1`).toBeCloseTo(v.x1, 6)
      expect(s.props![0]!.y, `${screen} y1`).toBeCloseTo(v.y1, 6)
      // …and a foot in the middle of the SCREEN is on the hand-off camera's
      // centre, keeping its own size and height.
      expect(s.foot!.x, `${screen} foot x`).toBeCloseTo(50, 6)
      expect(s.foot!.y, `${screen} foot y`).toBeCloseTo(50, 6)
      expect([s.foot!.r, s.foot!.z]).toEqual([9, 0.3])
    }
  })

  it('reaches a boss by its drawing, so a rearing, huffing Queen is culled late', () => {
    const base: CutsceneActor = {
      id: 0, bug: 'ant', boss: 'queenAnt', x: 0, y: 0, heading: 0, cycle: 0, size: 15, carry: false, waving: false
    }
    expect(actorReach({ ...base, waving: true })).toBeGreaterThan(actorReach(base))
    expect(actorReach({ ...base, waving: true, huff: 0.5 })).toBeGreaterThan(actorReach({ ...base, waving: true }))
  })
})

/**
 * ─── Nothing pops ───────────────────────────────────────────────────────────
 *
 * The owner's words for the bug this pins: "1 ant turns into a line of ants from
 * one moment to another". The intro switched a column on at 4.4 s and eight ants
 * appeared round the greeter in one frame, and a player reads that as the game
 * glitching rather than as a colony arriving.
 *
 * So every scene is sampled every 16 ms — a 60 Hz frame — and each creature is
 * followed by its `id`. Between two consecutive frames a creature may only be
 * BORN, DIE or JUMP where nobody can see it happen: outside the frame, under
 * something the set paints over the cast, or on a real cut (a beat that changes
 * the set or the world, where the whole picture changes at once).
 *
 * "The frame" is checked at three screens, because the renderer fits the SHORT
 * edge and a point off the top of a landscape frame is in the middle of a
 * portrait one. Calm (reduced motion) is its own run, because its camera cuts
 * to each beat's framing instead of easing there — it is wider sooner. And each
 * tier's thinning is its own run, because a thinned column is spaced
 * differently and its loop points land somewhere else.
 */
const SCREENS = [
  ['portrait phone', 390, 844],
  ['landscape phone', 844, 390],
  ['landscape desktop', 1280, 720]
] as const

const unseen = (a: CutsceneActor, f: CutsceneFrame, w: number, h: number): boolean =>
  !actorInView(a, cutsceneView(f.camera, w, h)) || actorCovered(a, setCovers(f.set))

/**
 * Every pop in one run of a scene, described. Empty is the pass.
 *
 * With `stages`, each screen is run on its OWN stage — the boss a scene pins
 * lands somewhere different on every screen shape, so its path is a different
 * path per screen and has to be followed separately.
 */
const popsIn = (
  spec: CutsceneSpec, calm: boolean, crowd: number,
  stages?: (w: number, h: number) => CutsceneStage
): string[] => stages
  ? SCREENS.flatMap((sc) => popsOn(spec, calm, crowd, [sc], stages(sc[1], sc[2])))
  : popsOn(spec, calm, crowd, SCREENS, null)

const popsOn = (
  spec: CutsceneSpec, calm: boolean, crowd: number,
  screens: readonly (readonly [string, number, number])[], stage: CutsceneStage | null
): string[] => {
  const found: string[] = []
  const len = cutsceneLength(spec)
  let prev = cutsceneFrame(spec, 0, calm, crowd, stage)
  for (let t = 16; ; t += 16) {
    const at = Math.min(t, len)
    const cur = cutsceneFrame(spec, at, calm, crowd, stage)
    const cut = cur.set !== prev.set || cur.world !== prev.world
    if (!cut) {
      const before = new Map(prev.actors.map((a) => [a.id, a]))
      const after = new Set(cur.actors.map((a) => a.id))
      for (const [screen, w, h] of screens) {
        const tag = (what: string, a: CutsceneActor): string =>
          `${spec.id} t=${at}${calm ? ' calm' : ''} crowd=${crowd} ${screen}: #${a.id} ${a.bug} ` +
          `${what} at (${a.x.toFixed(1)}, ${a.y.toFixed(1)})`
        // A jump is a move bigger than any creature makes in a frame at the
        // speed it is drawn at: 8 % of the frame's long half-width.
        const v = cutsceneView(cur.camera, w, h)
        const jump = 2 + 0.08 * Math.max(v.x1 - v.x0, v.y1 - v.y0) / 2
        for (const a of cur.actors) {
          const was = before.get(a.id)
          if (!was) {
            if (!unseen(a, cur, w, h)) found.push(tag('born in shot', a))
          } else if (Math.hypot(a.x - was.x, a.y - was.y) > jump
            && !(unseen(was, prev, w, h) && unseen(a, cur, w, h))) {
            found.push(tag(`jumped ${Math.hypot(a.x - was.x, a.y - was.y).toFixed(1)} in shot`, a))
          }
        }
        for (const a of prev.actors) {
          if (!after.has(a.id) && !(unseen(a, prev, w, h) && unseen(a, cur, w, h))) {
            found.push(tag('died in shot', a))
          }
        }
      }
    }
    prev = cur
    if (at === len) break
  }
  return found
}

describe('nothing pops into or out of the frame', () => {
  const runs = ALL_CUTSCENES.flatMap((s) =>
    [false, true].flatMap((calm) => [1, 0.8, 0.55, 0.38].map((crowd) =>
      [`${s.id}${calm ? ' (calm)' : ''} at crowd ${crowd}`, s, calm, crowd] as const)))

  it.each(runs)('%s', (_name, spec, calm, crowd) => {
    // The first handful is plenty to diagnose from and keeps a failure readable.
    expect(popsIn(spec, calm, crowd).slice(0, 6)).toEqual([])
  })

  // The rematch again, on the stage each screen would really hand it: its Queen
  // is pinned to a spawn that moves with the screen's shape, so her charge is a
  // different line on every screen.
  it.each([false, true].flatMap((calm) => [1, 0.8, 0.55, 0.38].map((crowd) =>
    [`rematch on each screen's own stage${calm ? ' (calm)' : ''} at crowd ${crowd}`, calm, crowd] as const)))(
    '%s', (_name, calm, crowd) => {
      expect(popsIn(REMATCH, calm, crowd, stageFor).slice(0, 6)).toEqual([])
    })

  it('would catch the pop-in that shipped', () => {
    // The checker proving it is not vacuous: the first cut's trail, switched on
    // round the greeter at 4.4 s, fails it.
    const shipped: CutsceneSpec = {
      ...INTRO,
      actors: [
        ...INTRO.actors!.slice(0, 1),
        { kind: 'column', bugs: ['ant'], size: 2.9, from: { x: 62, y: 38 }, to: { x: 12, y: 82 },
          count: 8, period: 5200, carry: true, when: [4400, 9500] }
      ]
    }
    expect(popsIn(shipped, false, 1).some((p) => p.includes('born in shot'))).toBe(true)
  })

  it('brings the greeter on from off-frame, not from nowhere', () => {
    // It used to stand beside the plate from the first frame, in the wide shot
    // whose whole note is that nothing moves.
    for (const [, w, h] of SCREENS) {
      const f = cutsceneFrame(INTRO, 2600)
      const greeter = f.actors.find((a) => a.greeter)!
      expect(actorInView(greeter, cutsceneView(f.camera, w, h))).toBe(false)
    }
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

  // LAST in the file: it drives the real tier ladder down, and nothing resets it.
  it('does not thin a scene that is already playing when the tier drops', () => {
    // The ladder calibrates over the first seconds of rendering — for a new
    // player, the intro's seconds. Read live, a downgrade mid-raid would delete
    // half the raid in shot in one frame. The crowd is read when the scene starts.
    expect(qualityTier()).toBe('high')
    startCutscene(INTRO)
    stepCutscene(7000)
    const before = cutsceneFrameNow()!.actors.map((a) => a.id)
    for (let i = 0; i < 48; i++) sampleFrame(60)
    expect(qualityTier(), 'the ladder really did step down').not.toBe('high')
    expect(cutsceneFrameNow()!.actors.map((a) => a.id)).toEqual(before)
  })
})
