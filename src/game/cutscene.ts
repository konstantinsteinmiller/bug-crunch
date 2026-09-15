/**
 * ─── Cutscenes, as a timeline ───────────────────────────────────────────────
 *
 * The design lives in `cutscenes.md`; this is the part of it the game runs.
 *
 * A scene is a list of BEATS. Each beat holds for its own duration and carries
 * the camera it wants; the camera is tweened from the previous beat's, so the
 * whole "camera flight" is four numbers per beat and no keyframe editor.
 *
 * ── What the second scene taught this file ──
 *
 * The first cut of this had the beats as DATA and the intro's cast as a SCRIPT,
 * with a note saying that when the second scene landed, the parts the two had in
 * common were the parts worth lifting into data. Scenes 02-05 landed. Three
 * things turned out to repeat, and they are now data:
 *
 *   THE FLOOR, per beat. 05 retreats through four worlds in seven seconds, and
 *   02 and 04 change what is underfoot mid-scene. A `world` on the beat is the
 *   whole of that.
 *
 *   THE DIALS. Every scene wants a handful of scalars that tween exactly the way
 *   the camera does — how far down the shoe is, how dark it is, how tight the
 *   torch is, how much sandwich is left, how hot the neon is, whether the crumb
 *   is still on the blanket. They were `span(t, a, b)` calls hard-coded against
 *   the intro's beat table; they are now keyframes on the beats, resolved the
 *   same way the camera is.
 *
 *   THE CAST. Five shapes cover every creature in all five scenes, and each is
 *   used by at least two of them: a WALKER on a keyframed path, a COLUMN
 *   marching down a line, a RING converging on a point, a SWARM crawling inside
 *   a box, and a STILL that just stands there. `introActors` is now four track
 *   declarations, and it draws the same picture it drew before.
 *
 * What stayed bespoke — deliberately — is the SET. The plate, the blanket's hem,
 * the attic's boxes, the cabinet's attract screen: those are drawings, one per
 * place, and a generic prop system would be a worse version of a canvas
 * function. `cutsceneArt.ts` owns them, keyed by the `set` on the beat.
 *
 * ── The one hard rule ──
 *
 * Everything here is PURE: given a time in milliseconds it returns what the
 * screen should look like. No state, no clock of its own, no side effects. That
 * is what lets the same code drive the live scene, a skip that jumps to the last
 * frame, and a test that asserts the shoe is where it should be at t=9000.
 */

import type { WorldId } from '@/game/stages'
import type { BugId } from '@/game/bugs'
import type { BossId } from '@/game/bosses'

// ─── The shapes ─────────────────────────────────────────────────────────────

/** Where the camera is, in the same 100x100 world units the board uses.
 *  `zoom` 1 fits the board's short edge exactly, as gameplay does. */
export interface CutsceneCamera {
  x: number
  y: number
  zoom: number
}

export type CutsceneEase = 'linear' | 'in' | 'out' | 'inOut' | 'cut'

/**
 * Which bespoke set dressing is painted under a beat.
 *
 * A place, not a prop list. `cutsceneArt.ts` has one painter per name and each
 * one knows its own scene — that is the half of a cutscene that does not
 * generalise, and pretending otherwise would buy a prop table nobody can read.
 */
export type CutsceneSet =
  | 'none'
  /** World 1's blanket, laid out: plate, glass, paperback, sandwich, crumb. */
  | 'picnic'
  /** World 2. The blanket seen from OUTSIDE, as a finite patch on the grass,
   *  with its hem — the thing 02 is entirely about crossing. */
  | 'yard'
  /** World 2 without the blanket: open grass with its props. */
  | 'backyard'
  /** World 3. Boxes, cobwebs, bare board. */
  | 'attic'
  /** World 3 from the wrong side of a door: the attic plus the door itself,
   *  with the strip of daylight the trail is walking into. Its own name rather
   *  than a branch inside `attic`, because 05 comes back THROUGH the attic and
   *  must not find a door standing in the middle of it. */
  | 'door'
  /** World 4, seen from IN FRONT of the glass: a cabinet's attract screen. */
  | 'cabinet'
  /** World 4, seen from inside: the factory floor. */
  | 'arcade'

/**
 * Scalar channels, keyframed on the beats and tweened like the camera.
 *
 * Every one of these is a thing at least two scenes need, which is the bar for
 * being here at all. A value left unset on a beat inherits the last beat that
 * did set it, so a dial is stated once and then forgotten about.
 */
export interface CutsceneDials {
  /** 0 = no shoe, 1 = fully landed. Drives the shoe and its shadow. */
  shoe?: number
  /** 0..1 ink laid over the whole frame. 03 climbs a dark staircase on it and
   *  05 wipes between four worlds with it. */
  dark?: number
  /** 0..1 torch. 0 is no beam at all; 1 is the beam narrowed to the stomp ring,
   *  which is where 03 hands over. */
  torch?: number
  /** 1 = a whole sandwich on the plate, 0 = gone. 01 loses it, 05 gives it back. */
  sandwich?: number
  /** 0..1 neon. The arcade's own light, and the cabinet's screen glow. */
  glow?: number
  /** > 0.5 = there is a loose crumb on the blanket. The title object. */
  crumb?: number
  /**
   * How the dials get to their values, when that is not how the CAMERA gets to
   * its own. A camera can snap between worlds on the same beat a darkness ramps
   * smoothly across, and 05 does exactly that.
   */
  ease?: CutsceneEase
}

export interface CutsceneBeat {
  /** How long this beat holds, ms. */
  ms: number
  /** Where the camera has arrived BY THE END of this beat. */
  camera: CutsceneCamera
  /**
   * How it gets there from the previous beat's camera.
   *
   * `cut` is not an easing — it means "do not move at all, just be there", and
   * it is what every beat becomes under `prefers-reduced-motion`.
   */
  ease?: CutsceneEase
  /** A one-shot cue fired as the beat opens. Names are `FxSound` ids. */
  sfx?: string
  /** The floor under this beat. Inherited from the beat before it, then from
   *  the scene. */
  world?: WorldId
  /** The set dressing under this beat. Inherited the same way. */
  set?: CutsceneSet
  /** Dial keyframes. See `CutsceneDials`. */
  dials?: CutsceneDials
  /**
   * Actor time STOPS when this beat opens, and stays stopped.
   *
   * 01's beat 6 is built on it: the thing that sells a shadow is what stops
   * moving under it. The camera keeps going; the cast does not.
   */
  hold?: boolean
  /** For the log, the tests and whoever reads this next. Never rendered. */
  note: string
}

// ─── The cast, as data ──────────────────────────────────────────────────────

/** A point in the same 100x100 world units. */
export interface CutscenePt { x: number; y: number }

/** One keyframe on a walker's path, at an ABSOLUTE scene time. */
export interface CutsceneKey extends CutscenePt { t: number }

interface TrackBase {
  /** Exists only inside this window of scene time. Omitted = the whole scene. */
  when?: readonly [number, number]
  /** Body radius in world units. */
  size?: number
  /** ms for one walk cycle. */
  step?: number
}

/**
 * ONE creature on a keyframed path.
 *
 * The greeter in 01, the marquee roach in 04, the last ant in 05. Position is
 * piecewise between the keys with a smoothstep inside each leg, so a walker that
 * stops at a key decelerates into it instead of hitting a wall — and heading
 * comes off the direction of travel rather than being authored, which is how a
 * path stays editable.
 */
export interface WalkerTrack extends TrackBase {
  kind: 'walker'
  bug: BugId
  path: readonly CutsceneKey[]
  /**
   * Turned to face the CAMERA between these scene times — the renderer swaps in
   * the mascot bitmap, which is the painting the loading screen waves with.
   *
   * 01 uses it for the wave. 05 uses it for the look, which is the same gesture
   * with the joke landed rather than set up.
   */
  wave?: readonly [number, number]
  /** This walker is the loading screen's greeter — see `CutsceneActor.greeter`. */
  greeter?: boolean
  /** Carrying a crumb from this scene time on. */
  carryFrom?: number
  /** Fixed heading, for a walker whose whole path is a single stop. */
  face?: number
}

/**
 * A COLUMN: bugs evenly phased along one line, looping.
 *
 * 01's trail, 02's supply line and its branch, 04's conveyor. The column is what
 * says "this is a route", and a route is the whole of 02.
 */
export interface ColumnTrack extends TrackBase {
  kind: 'column'
  /** Cycled across the column, so a line is not one creature repeated. */
  bugs: readonly BugId[]
  from: CutscenePt
  to: CutscenePt
  count: number
  /** ms for one bug to walk the whole line. */
  period: number
  carry?: boolean
  /** Phase offset, 0..1 — two columns on the same period do not lockstep. */
  phase?: number
}

/** A RING closing on a point: 01's raid, 04's factory floor converging on the
 *  conveyor. `r0` -> `r1` over `ms`, starting at the track's window. */
export interface RingTrack extends TrackBase {
  kind: 'ring'
  bugs: readonly BugId[]
  at: CutscenePt
  r0: number
  r1: number
  count: number
  ms: number
  /** Vertical squash, so the ring reads as a floor and not as a hoop. */
  squash?: number
}

/** A SWARM crawling inside a box. 03's moving floor, 04's arcade. Deterministic
 *  from the index, so the same `t` is the same picture. */
export interface SwarmTrack extends TrackBase {
  kind: 'swarm'
  bugs: readonly BugId[]
  at: CutscenePt
  w: number
  h: number
  count: number
  /** World units per second, roughly. */
  speed?: number
  seed?: number
}

/** Something that just STANDS there: 02's foreman, 04's boss. */
export interface StillTrack extends TrackBase {
  kind: 'still'
  bug?: BugId
  /** Drawn from `images/bosses/<id>.webp` when the painting is there. */
  boss?: BossId
  at: CutscenePt
  face?: number
  carry?: boolean
}

export type ActorTrack =
  WalkerTrack | ColumnTrack | RingTrack | SwarmTrack | StillTrack

export interface CutsceneSpec {
  id: string
  beats: readonly CutsceneBeat[]
  /** The floor a beat that does not name one gets. */
  world: WorldId
  /** The set a beat that does not name one gets. */
  set?: CutsceneSet
  /** Where the loose crumb sits, for the scenes that have one. */
  crumbAt?: CutscenePt
  actors?: readonly ActorTrack[]
}

/** One drawable creature in a scene — what the renderer is handed. */
export interface CutsceneActor {
  bug: BugId
  /** Set instead of `bug` for a boss still. */
  boss?: BossId
  x: number
  y: number
  /** Radians. The renderer turns the painted frame by this. */
  heading: number
  /** 0..1 through its own walk cycle. */
  cycle: number
  /** Body radius in world units. */
  size: number
  /** Carrying a crumb — drawn as a speck held ahead of the head. */
  carry: boolean
  /** Turned to the camera. The renderer draws the rear-up gesture for this. */
  waving: boolean
  /**
   * This one IS the loading screen's greeter, so a turn to camera should show
   * the actual painting rather than the drawn gesture.
   *
   * Only 01's first ant sets it. 05's last ant deliberately does not: the
   * finale's joke is that it could be any of them, and the whole colony has
   * been interchangeable from the start.
   */
  greeter?: boolean
}

/** Everything the renderer needs for one frame. */
export interface CutsceneFrame {
  camera: CutsceneCamera
  actors: CutsceneActor[]
  world: WorldId
  set: CutsceneSet
  /** The dials, resolved. See `CutsceneDials` for what each one means. */
  shoe: number
  dark: number
  torch: number
  sandwich: number
  glow: number
  crumb: number
  crumbAt: CutscenePt
  /** Index of the beat this frame belongs to, and how far through it we are. */
  beat: number
  beat01: number
}

// ─── Sampling ───────────────────────────────────────────────────────────────

const EASE: Record<string, (t: number) => number> = {
  linear: (t) => t,
  in: (t) => t * t,
  out: (t) => 1 - (1 - t) * (1 - t),
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t)),
  // Not an easing: "be there for the whole beat". See `CutsceneBeat.ease`.
  cut: () => 1
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t
const clamp01 = (t: number): number => Math.max(0, Math.min(1, t))
/** Smooth inside a leg, so a walker that stops at a key settles into it. */
const smooth = (t: number): number => t * t * (3 - 2 * t)

/** Total run time of a scene, ms. */
export const cutsceneLength = (s: CutsceneSpec): number =>
  s.beats.reduce((n, b) => n + b.ms, 0)

/** Absolute time each beat opens at. */
export const beatStarts = (s: CutsceneSpec): number[] => {
  const out: number[] = []
  let n = 0
  for (const b of s.beats) { out.push(n); n += b.ms }
  return out
}

/** Which beat `t` lands in, and how far through it. */
const locate = (s: CutsceneSpec, t: number): { i: number; k: number; from: number } => {
  let from = 0
  for (let i = 0; i < s.beats.length; i++) {
    const b = s.beats[i]!
    if (t < from + b.ms || i === s.beats.length - 1) {
      return { i, k: clamp01((t - from) / b.ms), from }
    }
    from += b.ms
  }
  return { i: 0, k: 0, from: 0 }
}

/**
 * The camera at `t`.
 *
 * `calm` is `prefers-reduced-motion`: every beat becomes a cut, so the scene
 * plays as a series of held frames. The story survives; the movement does not,
 * which is the whole point of the setting.
 */
export const cutsceneCamera = (
  s: CutsceneSpec, t: number, calm = false
): { camera: CutsceneCamera; beat: number; beat01: number } => {
  const { i, k } = locate(s, t)
  const b = s.beats[i]!
  const prev = i === 0 ? b.camera : s.beats[i - 1]!.camera
  const e = calm || b.ease === 'cut' ? 1 : EASE[b.ease ?? 'inOut']!(k)
  return {
    camera: {
      x: lerp(prev.x, b.camera.x, e),
      y: lerp(prev.y, b.camera.y, e),
      zoom: lerp(prev.zoom, b.camera.zoom, e)
    },
    beat: i,
    beat01: k
  }
}

// ─── The dials ──────────────────────────────────────────────────────────────

const DIAL_KEYS = ['shoe', 'dark', 'torch', 'sandwich', 'glow', 'crumb'] as const
type DialKey = typeof DIAL_KEYS[number]

/** Where a dial sits when no beat in the scene has ever mentioned it. */
const DIAL_REST: Record<DialKey, number> = {
  shoe: 0, dark: 0, torch: 0, sandwich: 1, glow: 0, crumb: 0
}

/** The value a channel has ARRIVED at by the end of beat `i`, searching back
 *  through the beats that did state it. */
const dialAt = (s: CutsceneSpec, i: number, key: DialKey): number => {
  for (let j = i; j >= 0; j--) {
    const v = s.beats[j]!.dials?.[key]
    if (typeof v === 'number') return v
  }
  return DIAL_REST[key]
}

/** Likewise for the two channels that are enums rather than numbers. */
const beatWorld = (s: CutsceneSpec, i: number): WorldId => {
  for (let j = i; j >= 0; j--) {
    const w = s.beats[j]!.world
    if (w) return w
  }
  return s.world
}

const beatSet = (s: CutsceneSpec, i: number): CutsceneSet => {
  for (let j = i; j >= 0; j--) {
    const v = s.beats[j]!.set
    if (v) return v
  }
  return s.set ?? 'none'
}

// ─── The cast ───────────────────────────────────────────────────────────────

/** Head-up sprites: a creature travelling along (dx, dy) is turned by this. */
const headingOf = (dx: number, dy: number): number =>
  Math.atan2(dy, dx) + Math.PI / 2

/** Deterministic 0..1 from an integer. A swarm has to be the same picture at the
 *  same `t` every time it is sampled, or a skip would not land where the scene
 *  was. */
const hash1 = (n: number): number => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

/** How many of a crowd to draw. The renderer thins its own passes by tier and so
 *  does this; a scene at `min` is the same scene with fewer extras in it. */
const many = (n: number, crowd: number): number =>
  Math.max(1, Math.round(n * clamp01(crowd)))

/** Where a walker is on its path at `t`, and which way it is facing. */
const walkPath = (
  path: readonly CutsceneKey[], t: number
): { x: number; y: number; heading: number } => {
  const first = path[0]!
  const last = path[path.length - 1]!
  if (path.length === 1 || t <= first.t) {
    return { x: first.x, y: first.y, heading: pathHeading(path, 0) }
  }
  if (t >= last.t) {
    return { x: last.x, y: last.y, heading: pathHeading(path, path.length - 2) }
  }
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!
    const b = path[i + 1]!
    if (t < b.t) {
      const k = b.t === a.t ? 1 : smooth(clamp01((t - a.t) / (b.t - a.t)))
      return {
        x: lerp(a.x, b.x, k),
        y: lerp(a.y, b.y, k),
        heading: pathHeading(path, i)
      }
    }
  }
  return { x: last.x, y: last.y, heading: pathHeading(path, path.length - 2) }
}

/**
 * The heading of leg `i`, falling back to the nearest leg that actually moves.
 *
 * A walker that stops keeps facing the way it was going. Without the fallback a
 * zero-length leg would snap it to due north for as long as it stood there,
 * which is exactly the beat 05 holds for a full second.
 */
const pathHeading = (path: readonly CutsceneKey[], i: number): number => {
  // BACKWARDS from the current leg for the last real direction, then forwards
  // for the next one — a path that opens on a stop still faces the right way.
  for (let j = Math.min(i, path.length - 2); j >= 0; j--) {
    const dx = path[j + 1]!.x - path[j]!.x
    const dy = path[j + 1]!.y - path[j]!.y
    if (Math.abs(dx) + Math.abs(dy) > 0.001) return headingOf(dx, dy)
  }
  for (let j = Math.max(0, i); j < path.length - 1; j++) {
    const dx = path[j + 1]!.x - path[j]!.x
    const dy = path[j + 1]!.y - path[j]!.y
    if (Math.abs(dx) + Math.abs(dy) > 0.001) return headingOf(dx, dy)
  }
  return 0
}

const inWindow = (tr: ActorTrack, t: number): boolean =>
  !tr.when || (t >= tr.when[0] && t <= tr.when[1])

const sampleTrack = (
  tr: ActorTrack, t: number, crowd: number, out: CutsceneActor[]
): void => {
  if (!inWindow(tr, t)) return
  const step = tr.step ?? 420
  const size = tr.size ?? 3

  switch (tr.kind) {
    case 'walker': {
      const p = walkPath(tr.path, t)
      out.push({
        bug: tr.bug,
        x: p.x,
        y: p.y,
        heading: tr.face ?? p.heading,
        cycle: (t / step) % 1,
        size,
        carry: tr.carryFrom !== undefined && t >= tr.carryFrom,
        waving: !!tr.wave && t >= tr.wave[0] && t < tr.wave[1],
        greeter: tr.greeter === true
      })
      return
    }

    case 'column': {
      const dx = tr.to.x - tr.from.x
      const dy = tr.to.y - tr.from.y
      const heading = headingOf(dx, dy)
      const n = many(tr.count, crowd)
      const t0 = tr.when?.[0] ?? 0
      for (let i = 0; i < n; i++) {
        const phase = (((t - t0) / tr.period + (tr.phase ?? 0) + i / n) % 1 + 1) % 1
        out.push({
          bug: tr.bugs[i % tr.bugs.length]!,
          x: tr.from.x + dx * phase,
          y: tr.from.y + dy * phase,
          heading,
          cycle: (t / step + i * 0.37) % 1,
          size,
          carry: !!tr.carry,
          waving: false
        })
      }
      return
    }

    case 'ring': {
      const n = many(tr.count, crowd)
      const t0 = tr.when?.[0] ?? 0
      const close = clamp01((t - t0) / tr.ms)
      const squash = tr.squash ?? 0.86
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + 0.4
        // Each one at its own pace, so the ring arrives as a crowd rather than
        // as a closing iris.
        const r = lerp(tr.r0, tr.r1, close * (0.7 + ((i * 7) % 5) / 12))
        out.push({
          bug: tr.bugs[i % tr.bugs.length]!,
          x: tr.at.x + Math.cos(a) * r,
          y: tr.at.y + Math.sin(a) * r * squash,
          heading: a + Math.PI + Math.PI / 2,
          cycle: (t / step + i * 0.21) % 1,
          size,
          carry: false,
          waving: false
        })
      }
      return
    }

    case 'swarm': {
      const n = many(tr.count, crowd)
      const seed = tr.seed ?? 7
      const speed = tr.speed ?? 6
      for (let i = 0; i < n; i++) {
        // A lissajous per body: two frequencies that never quite repeat, so
        // sixteen creatures read as traffic rather than as a pattern.
        const ax = 0.6 + hash1(seed + i * 3.1) * 0.9
        const ay = 0.5 + hash1(seed + i * 5.7) * 1.1
        const px = hash1(seed + i * 2.3) * Math.PI * 2
        const py = hash1(seed + i * 9.1) * Math.PI * 2
        const u = (t / 1000) * (speed / 40)
        const x = tr.at.x + Math.sin(u * ax + px) * (tr.w / 2)
        const y = tr.at.y + Math.sin(u * ay + py) * (tr.h / 2)
        // Heading from the analytic derivative — no second sample, no drift.
        const vx = Math.cos(u * ax + px) * ax * (tr.w / 2)
        const vy = Math.cos(u * ay + py) * ay * (tr.h / 2)
        out.push({
          bug: tr.bugs[i % tr.bugs.length]!,
          x,
          y,
          heading: headingOf(vx, vy),
          cycle: (t / step + hash1(seed + i)) % 1,
          size: size * (0.82 + hash1(seed + i * 13.3) * 0.36),
          carry: false,
          waving: false
        })
      }
      return
    }

    case 'still': {
      out.push({
        bug: tr.bug ?? 'ant',
        ...(tr.boss ? { boss: tr.boss } : {}),
        x: tr.at.x,
        y: tr.at.y,
        heading: tr.face ?? 0,
        cycle: 0,
        size,
        carry: !!tr.carry,
        waving: false
      })
    }
  }
}

/**
 * Actor time, which is not always scene time.
 *
 * A beat marked `hold` stops the cast where it stands and leaves it there. The
 * camera does not stop — 01's beat 6 slides a shadow across a blanket full of
 * ants who have all frozen under it, and both halves of that are the shot.
 */
const actorTime = (s: CutsceneSpec, t: number): number => {
  let from = 0
  for (const b of s.beats) {
    if (b.hold && t >= from) return from
    from += b.ms
  }
  return t
}

/**
 * The whole scene at `t`. Pure: same `t`, same picture.
 *
 * `crowd` thins the generated crowds for a device that cannot afford them — the
 * caller passes it from `qualityTier()`, exactly as the board renderer does for
 * its own passes. It never changes the story: the named cast (walkers, stills)
 * is never thinned, only the extras.
 */
export const cutsceneFrame = (
  s: CutsceneSpec, t: number, calm = false, crowd = 1
): CutsceneFrame => {
  const { camera, beat, beat01 } = cutsceneCamera(s, t, calm)
  const b = s.beats[beat]!
  const de = calm ? 1 : EASE[b.dials?.ease ?? b.ease ?? 'inOut']!(beat01)

  const dial = (key: DialKey): number => {
    const to = dialAt(s, beat, key)
    const from = beat === 0 ? to : dialAt(s, beat - 1, key)
    return lerp(from, to, de)
  }

  const ta = actorTime(s, t)
  const actors: CutsceneActor[] = []
  for (const tr of s.actors ?? []) sampleTrack(tr, ta, crowd, actors)

  return {
    camera,
    actors,
    world: beatWorld(s, beat),
    set: beatSet(s, beat),
    shoe: dial('shoe'),
    dark: dial('dark'),
    torch: dial('torch'),
    sandwich: dial('sandwich'),
    glow: dial('glow'),
    crumb: dial('crumb'),
    crumbAt: s.crumbAt ?? { x: 57.4, y: 46.6 },
    beat,
    beat01
  }
}

// ═══ 01 — "The Crumb" ═══════════════════════════════════════════════════════

/**
 * The beat sheet in `cutscenes.md`, as numbers.
 *
 * The camera starts wide over the whole picnic and ends exactly where the
 * gameplay camera sits, so the hand-off to level 1-1 has no cut in it: the last
 * frame of the scene and the first frame of the level are the same framing.
 */
export const INTRO: CutsceneSpec = {
  id: 'intro',
  world: 1,
  set: 'picnic',
  crumbAt: { x: 57.4, y: 46.6 },
  beats: [
    { ms: 1600, ease: 'cut', camera: { x: 50, y: 50, zoom: 0.62 },
      note: 'Wide and still. The plate, the glass, the book, the sandwich.' },
    // Beats 2 and 3 go in CLOSE. The crumb is one world unit across and the
    // wave is the scene's whole emotional hook; at the 1.45/1.7 this first ran
    // at, both played out at about fifteen pixels and read as nothing.
    { ms: 1400, ease: 'inOut', camera: { x: 55.5, y: 45, zoom: 2.3 },
      sfx: 'tick', dials: { crumb: 1 },
      note: 'Push in on the sandwich. A crumb tips off the plate.' },
    { ms: 1400, ease: 'out', camera: { x: 57, y: 45.6, zoom: 2.9 },
      sfx: 'coin',
      // Linear, so the crumb goes at the half-beat the greeter reaches it,
      // rather than at the instant the beat opens.
      dials: { crumb: 0, ease: 'linear' },
      note: 'The greeter walks in, waves at the camera, takes the crumb.' },
    { ms: 1600, ease: 'inOut', camera: { x: 44, y: 54, zoom: 1.0 },
      note: 'Track with it, pulling back. It has joined a LINE of them.' },
    { ms: 1400, ease: 'inOut', camera: { x: 50, y: 50, zoom: 0.58 },
      dials: { sandwich: 0.55 },
      note: 'Wide: ants converging from every edge. The sandwich is moving.' },
    { ms: 1200, ease: 'out', camera: { x: 50, y: 50, zoom: 0.66 },
      sfx: 'feverReady', hold: true, dials: { sandwich: 0.15 },
      note: 'The shadow slides across the blanket. Every ant stops.' },
    { ms: 900, ease: 'in', camera: { x: 50, y: 50, zoom: 1 },
      sfx: 'charge',
      // The shoe settles rather than accelerating: it is down and POISED before
      // the last frame, and the last frame is the one 1-1 inherits.
      dials: { shoe: 1, ease: 'out' },
      note: 'Snap to gameplay framing. The shoe descends and holds.' }
  ],
  actors: [
    // ── The greeter ──
    // In at 3.0 s, stopped at the crumb by 3.6, waving to 4.4, then away down
    // the trail the others are on.
    { kind: 'walker', bug: 'ant', size: 3.2,
      path: [
        { t: 0, x: 74, y: 40 },
        { t: 3000, x: 74, y: 40 },
        { t: 3600, x: 57, y: 45 },
        { t: 4400, x: 57, y: 45 },
        { t: 5800, x: 30, y: 66 }
      ],
      wave: [3600, 4400], greeter: true, carryFrom: 4400 },
    // ── The trail ──
    // Eight on the diagonal the greeter leaves along, spaced so the column
    // reads as continuous rather than as eight separate creatures.
    { kind: 'column', bugs: ['ant', 'ant', 'ant', 'sprinter'], size: 2.9,
      from: { x: 62, y: 38 }, to: { x: 12, y: 82 },
      count: 8, period: 5200, carry: true, when: [4400, 9500] },
    // ── The convergence ──
    // In from the rim on beat 5, aimed at the plate. Twelve is enough to read as
    // "everywhere" at the wide framing and cheap enough to draw.
    { kind: 'ring', bugs: ['ant', 'ant', 'beetle', 'ant', 'ant'], size: 3,
      at: { x: 50, y: 46 }, r0: 62, r1: 16, count: 12, ms: 1200,
      when: [6000, 9500] }
  ]
}

// ═══ 02 — "The Trail" ═══════════════════════════════════════════════════════

/**
 * Before 2-1. Five seconds, and the whole scene is one move: OFF the blanket.
 *
 * ── Why the floor is grass for all five seconds ──
 *
 * The obvious build is to start on the picnic tile and change world half way. It
 * is wrong: the shot the scene exists for is the camera CROSSING THE HEM, and a
 * floor that changes at a beat boundary cannot show an edge — it can only cut to
 * a different place. So the world is 2 throughout and the blanket is a finite
 * PATCH painted on top of the grass, with its own hem. The camera then walks off
 * the edge of it, in one continuous move, which is the sentence the scene is.
 *
 * ── Why the picnic is parked at x ≈ 140 ──
 *
 * The hand-off rule says the last frame of a cutscene is the first frame of the
 * level, and 2-1's board is grass with nothing on it. So the blanket has to be
 * OFF THE BOARD by the time the camera arrives at gameplay framing — not faded
 * out, not switched off at a beat boundary, simply somewhere else. Parking it
 * east of the board (x 110..170, against a board of 0..100) makes the last move
 * a real move: the camera leaves the picnic behind, and world 2 starts on a
 * frame with no picnic in it because the picnic is a hundred units that way.
 */
export const TRAIL: CutsceneSpec = {
  id: 'trail',
  world: 2,
  set: 'yard',
  crumbAt: { x: 151.5, y: 37.5 },
  beats: [
    { ms: 1100, ease: 'cut', camera: { x: 146, y: 36, zoom: 2.0 },
      dials: { sandwich: 0, crumb: 1 },
      note: 'The plate. Empty. A few crumbs and a line leaving it.' },
    { ms: 1100, ease: 'inOut', camera: { x: 132, y: 52, zoom: 1.7 },
      sfx: 'chainStep',
      note: 'Follow the line off the plate, down towards the hem.' },
    { ms: 1000, ease: 'inOut', camera: { x: 112, y: 68, zoom: 1.4 },
      sfx: 'tick',
      note: 'Over the hem, onto the grass. The grass is not empty either.' },
    { ms: 1000, ease: 'out', camera: { x: 84, y: 80, zoom: 0.56 },
      sfx: 'feverReady',
      note: 'Pull back: a column, a supply line joining it, a beetle foreman.' },
    { ms: 800, ease: 'in', camera: { x: 50, y: 50, zoom: 1 },
      sfx: 'charge', dials: { shoe: 1, ease: 'out' },
      note: 'Snap to gameplay framing. The shoe steps onto the grass.' }
  ],
  actors: [
    // The route, and it runs the whole scene: it was there before the camera
    // arrived and it does not care that the camera found it. Nothing freezes in
    // this one — the joke is that they are unbothered. It ends ON the board,
    // heading into the level the player is about to be handed.
    { kind: 'column', bugs: ['ant', 'ant', 'sprinter', 'ant', 'beetle'], size: 3.1,
      from: { x: 146, y: 34 }, to: { x: 54, y: 100 },
      count: 12, period: 7000, carry: true },
    // The supply line, joining from the left. Two lines that MEET is what turns
    // a queue into a logistics operation.
    { kind: 'column', bugs: ['ant', 'caterpillar', 'ant', 'stinkbug'], size: 2.9,
      from: { x: 36, y: 134 }, to: { x: 112, y: 72 },
      count: 10, period: 6200, carry: true, phase: 0.31, when: [1900, 5000] },
    // The foreman. Bigger than everything marching past it and doing nothing at
    // all, which is the entire characterisation. Off the board, so it is not
    // standing on 2-1 when the level starts.
    { kind: 'still', bug: 'beetle', size: 7, at: { x: 116, y: 100 },
      face: Math.PI * 0.62, when: [2200, 5000] }
  ]
}

// ═══ 03 — "Inside" ══════════════════════════════════════════════════════════

/**
 * Before 3-1. The trail goes under a door and the game goes indoors.
 *
 * The climb is played on the `dark` dial rather than on a camera move, because a
 * top-down camera cannot pan upwards through a house. Dark, then less dark, then
 * a torch: the audience reads the height, and the scene never has to draw a
 * staircase it does not have art for.
 */
export const INSIDE: CutsceneSpec = {
  id: 'inside',
  world: 3,
  set: 'attic',
  beats: [
    { ms: 1000, ease: 'cut', camera: { x: 50, y: 72, zoom: 2.0 },
      set: 'door', dials: { dark: 0.22 },
      note: 'The foot of a door. A bright gap under it, and the trail going in.' },
    { ms: 900, ease: 'in', camera: { x: 50, y: 64, zoom: 3.0 },
      sfx: 'slide', dials: { dark: 0.88, ease: 'linear' },
      note: 'Into the gap. Everything goes dark.' },
    { ms: 1100, ease: 'out', camera: { x: 50, y: 40, zoom: 1.3 },
      set: 'attic',
      sfx: 'land', dials: { dark: 0.74, torch: 0.42, ease: 'out' },
      note: 'Out in the attic. A torch finds cobwebs and boxes.' },
    { ms: 1200, ease: 'inOut', camera: { x: 50, y: 47, zoom: 0.78 },
      sfx: 'feverReady', dials: { dark: 0.62, torch: 0.6 },
      note: 'The beam widens. The floor is MOVING.' },
    { ms: 800, ease: 'in', camera: { x: 50, y: 50, zoom: 1 },
      sfx: 'charge', dials: { dark: 0.42, torch: 1, shoe: 1, ease: 'out' },
      note: 'The beam narrows to the stomp ring. The shoe is in it.' }
  ],
  actors: [
    // Under the door and away: the line the camera followed here.
    { kind: 'column', bugs: ['ant', 'ant', 'centipede', 'ant'], size: 2.8,
      // Ends ABOVE the door's edge, so the head of the column is already under
      // it — `overDoor` paints the door on top of them and they walk out of the
      // world rather than stopping at a line.
      from: { x: 16, y: 102 }, to: { x: 58, y: 52 },
      count: 9, period: 4200, carry: true, when: [0, 2100] },
    // The floor. Sixteen bodies at the wide framing is what "moving" means; the
    // tier multiplier thins it on a device that cannot draw sixteen.
    { kind: 'swarm', bugs: ['centipede', 'moth', 'beetle', 'flea', 'stinkbug', 'ant'],
      at: { x: 50, y: 48 }, w: 82, h: 66, count: 16, size: 3.1, speed: 7,
      seed: 21, when: [2000, 5000] },
    // One straggler crossing the beam close to the camera, so the swarm has a
    // foreground and the shot has a depth to it.
    { kind: 'walker', bug: 'moth', size: 4.4,
      path: [
        { t: 2000, x: 16, y: 30 },
        { t: 5000, x: 76, y: 58 }
      ],
      when: [2000, 5000] }
  ]
}

// ═══ 04 — "Mecha" ═══════════════════════════════════════════════════════════

/**
 * Before 4-1. Neon, a cabinet, and a roach with plating.
 *
 * The camera does not travel anywhere in the first half: it is pointed at a
 * SCREEN, and the push-through is the zoom carrying on past the glass while the
 * screen blows out. Everything in front of the glass is the `cabinet` set;
 * everything behind it is the `arcade` set. The cut between them is the joke —
 * the attract screen was not a picture OF the arcade, it was the arcade.
 */
export const MECHA: CutsceneSpec = {
  id: 'mecha',
  world: 4,
  set: 'cabinet',
  beats: [
    { ms: 1000, ease: 'cut', camera: { x: 50, y: 50, zoom: 0.86 },
      sfx: 'arc', dials: { glow: 0.85, dark: 0.5 },
      note: 'A whole cabinet in attract mode: bezel, marquee, screen.' },
    { ms: 1000, ease: 'inOut', camera: { x: 50, y: 20, zoom: 1.9 },
      sfx: 'clang', dials: { glow: 1 },
      note: 'In on the marquee. A roach walks across it. It has PLATING.' },
    { ms: 900, ease: 'in', camera: { x: 50, y: 60, zoom: 3.4 },
      sfx: 'bossBeam', dials: { glow: 1, dark: 0.2 },
      note: 'Push THROUGH the glass. The screen blows out.' },
    { ms: 1300, ease: 'out', camera: { x: 50, y: 50, zoom: 0.58 },
      set: 'arcade', sfx: 'feverReady', dials: { glow: 0.42, dark: 0, ease: 'out' },
      note: 'Through: the factory floor. The bugs have gone industrial.' },
    { ms: 800, ease: 'in', camera: { x: 50, y: 50, zoom: 1 },
      sfx: 'charge', dials: { shoe: 1, glow: 0.3, ease: 'out' },
      note: 'Snap to gameplay framing. The shoe comes down on an arcade.' }
  ],
  actors: [
    // On the marquee, in front of the glass. Slow and level, because a marquee
    // sprite that bobs reads as a bug and the point is that it reads as a LOGO.
    // Paced against the CAMERA, not against the marquee: at beat 1's wide framing
    // it is a silhouette crossing an attract screen, and it has to still be
    // inside the close framing of beat 2 — which sees only x 24..76 — for the
    // whole second that beat is about it having plating. The first cut walked
    // the full width in beat 1 and left an empty marquee for the beat that
    // mattered.
    { kind: 'walker', bug: 'robobug', size: 4.6, step: 620,
      path: [
        { t: 0, x: 14, y: 20 },
        { t: 1000, x: 44, y: 20 },
        { t: 2000, x: 74, y: 20 }
      ],
      when: [0, 2050] },
    // Behind the glass. A line down the conveyor, carrying.
    { kind: 'column', bugs: ['robobug', 'robobug', 'beetle', 'centipede'], size: 3.2,
      from: { x: -6, y: 36 }, to: { x: 106, y: 36 },
      count: 12, period: 3400, carry: true, when: [2900, 5000] },
    // …and the rest of the floor, working.
    { kind: 'swarm', bugs: ['robobug', 'flea', 'centipede', 'beetle', 'moth'],
      at: { x: 50, y: 62 }, w: 84, h: 44, count: 14, size: 3.2, speed: 9,
      seed: 44, when: [2900, 5000] },
    // The line manager. `images/bosses/roachPrime.webp` is preloaded on every
    // world-4 level and until now was never once drawn; this is where it earns
    // its bytes. Gone before the hand-off, because 4-1 has no boss in it.
    { kind: 'still', boss: 'roachPrime', bug: 'robobug', size: 11,
      at: { x: 50, y: 18 }, when: [3000, 4300] }
  ]
}

// ═══ 05 — "One Crumb" ═══════════════════════════════════════════════════════

/**
 * After the final boss. Seven seconds, and the button on the whole joke.
 *
 * The retreat is four held frames — arcade, attic, backyard, blanket — each a
 * different `world` on its own beat, wiped through `dark`. Trying to fly a
 * camera between four places that do not adjoin would take longer than the whole
 * scene has and would answer a question nobody asked; four cuts read as
 * "back the way we came" for free.
 *
 * It ends where the game opened: the same wide shot as 01's first beat, the
 * sandwich back on the plate, and no shoe anywhere. Then one ant takes one
 * crumb.
 */
export const FINALE: CutsceneSpec = {
  id: 'finale',
  world: 1,
  set: 'picnic',
  crumbAt: { x: 66.5, y: 50.5 },
  beats: [
    { ms: 900, ease: 'cut', camera: { x: 50, y: 50, zoom: 0.72 },
      world: 4, set: 'arcade', dials: { dark: 0.34, glow: 0.4, sandwich: 1 },
      note: 'The arcade goes quiet. Nobody is working.' },
    { ms: 800, ease: 'cut', camera: { x: 50, y: 50, zoom: 0.66 },
      world: 3, set: 'attic', dials: { dark: 0.55, glow: 0, ease: 'linear' },
      note: 'Back down through the attic.' },
    { ms: 800, ease: 'cut', camera: { x: 50, y: 50, zoom: 0.62 },
      world: 2, set: 'backyard', dials: { dark: 0.2, ease: 'linear' },
      note: 'Out across the backyard.' },
    { ms: 1000, ease: 'cut', camera: { x: 50, y: 48, zoom: 0.58 },
      world: 1, set: 'picnic', sfx: 'star',
      dials: { dark: 0, crumb: 1, ease: 'linear' },
      note: 'The blanket. The opening shot. The sandwich is back.' },
    { ms: 1500, ease: 'inOut', camera: { x: 59, y: 47, zoom: 2.0 },
      sfx: 'tick',
      note: 'Push in. One ant walks in and takes one crumb.' },
    // Framed so the WHOLE SANDWICH and the one crumb are both in shot. The joke
    // is the ratio between them, and a close-up of the ant alone throws it away.
    { ms: 1000, ease: 'out', camera: { x: 60, y: 48, zoom: 2.6 },
      // No cue. The joke is the silence.
      dials: { crumb: 0, ease: 'cut' },
      note: 'It looks up at the camera. Beat. Nothing happens.' },
    { ms: 1000, ease: 'inOut', camera: { x: 50, y: 48, zoom: 0.58 },
      note: 'It walks away with it.' }
  ],
  actors: [
    // Arrives on the crumb at exactly 5000 ms, which is the instant beat 6 opens
    // and the crumb leaves the blanket. Stands for the whole of that beat, then
    // goes. The mascot bitmap is the look — the same painting that waves on the
    // loading screen and robbed the player in 01.
    { kind: 'walker', bug: 'ant', size: 3.2,
      path: [
        { t: 3400, x: 104, y: 33 },
        { t: 5000, x: 69.5, y: 51.5 },
        { t: 6000, x: 69.5, y: 51.5 },
        { t: 7000, x: 40, y: 74 }
      ],
      // It does not exist for the retreat: the arcade, the attic and the
      // backyard are empty and that is the point of them. It enters from off
      // the board's east edge, so the moment it appears is a moment it WALKED
      // in rather than one it was switched on in.
      when: [3400, 7000], wave: [5050, 6000], carryFrom: 5000 }
  ]
}

// ═══ The boss stingers ══════════════════════════════════════════════════════

/**
 * Two seconds before each boss level. Not cutscenes — STINGERS.
 *
 * The camera finds the boss, it fills the frame, it notices you. No story beat,
 * no camera flight worth the name, and the art is the boss still that world's
 * preload has already paid for. Generated rather than typed out four times: the
 * only things that differ between them are the world, the boss and the cast it
 * keeps.
 */
export interface StingerSpec {
  world: WorldId
  boss: BossId
  set: CutsceneSet
  /** The bugs that scatter out of frame as the boss arrives. */
  extras: readonly BugId[]
}

const STINGERS: Record<BossId, StingerSpec> = {
  // World 1 gets bare gingham, not the picnic: the plate sits at (50,42) and the
  // boss at (50,26), so the set dressing puts an empty dinner plate directly
  // under the queen and she reads as standing on a plinth. A stinger is one
  // creature and nothing else.
  queenAnt: { world: 1, boss: 'queenAnt', set: 'none', extras: ['ant', 'sprinter'] },
  beetleKing: { world: 2, boss: 'beetleKing', set: 'backyard', extras: ['ant', 'caterpillar'] },
  matriarch: { world: 3, boss: 'matriarch', set: 'attic', extras: ['moth', 'flea'] },
  roachPrime: { world: 4, boss: 'roachPrime', set: 'arcade', extras: ['robobug', 'flea'] }
}

/** The stinger for a boss. `bossStinger('queenAnt').id === 'stinger-queenAnt'`,
 *  which is the key the once-ever record uses. */
export const bossStinger = (boss: BossId): CutsceneSpec => {
  const s = STINGERS[boss]
  return {
    id: `stinger-${boss}`,
    world: s.world,
    set: s.set,
    beats: [
      { ms: 900, ease: 'cut', camera: { x: 50, y: 30, zoom: 0.7 },
        sfx: 'bossPhase', dials: { dark: 0.3, sandwich: 0, glow: s.world === 4 ? 0.4 : 0 },
        note: 'The camera finds it. It is much too big.' },
      { ms: 700, ease: 'in', camera: { x: 50, y: 30, zoom: 1.5 },
        sfx: 'bossCharge', dials: { dark: 0.12 },
        note: 'It fills the frame.' },
      { ms: 400, ease: 'out', camera: { x: 50, y: 48, zoom: 1 },
        sfx: 'charge', dials: { dark: 0, shoe: 1, ease: 'out' },
        note: 'It notices you. Hand over.' }
    ],
    actors: [
      { kind: 'still', boss, bug: s.extras[0]!, size: 13, at: { x: 50, y: 26 } },
      // The escort, running the other way. A boss reads as big because of what
      // is beside it, not because of how many pixels it is.
      { kind: 'ring', bugs: s.extras, size: 3, at: { x: 50, y: 40 },
        r0: 14, r1: 46, count: 6, ms: 1400, when: [0, 2000] }
    ]
  }
}

/** Every scene the game can play, by id — for the tests and the save audit. */
export const ALL_CUTSCENES: readonly CutsceneSpec[] = [
  INTRO, TRAIL, INSIDE, MECHA, FINALE,
  bossStinger('queenAnt'), bossStinger('beetleKing'),
  bossStinger('matriarch'), bossStinger('roachPrime')
]

/**
 * The scene that plays on the way INTO level `n`, if any.
 *
 * One table rather than four conditions at the call site: 01 opens the game, and
 * 02-04 open their world on its first level. The finale is not here — it is not
 * a way into a level, it is what happens after the last one comes out.
 */
export const cutsceneForLevel = (n: number): CutsceneSpec | null => {
  if (n === 1) return INTRO
  if (n === 11) return TRAIL
  if (n === 21) return INSIDE
  if (n === 31) return MECHA
  return null
}
