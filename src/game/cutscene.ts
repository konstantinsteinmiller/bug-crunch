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
 *   THE CAST. A handful of shapes cover every creature in all ten scenes: a
 *   WALKER on a keyframed path, a COLUMN marching down a line, a RING converging
 *   on a point, a SWARM crawling inside a box, a RAID rushing in from off-frame,
 *   and a STILL that just stands there.
 *
 * ── What the rematch taught it ──
 *
 *   THE STAGE. 1-10's scene hands over onto a boss, and a boss's spawn point is
 *   not a number a beat sheet can hold — the sim puts her a third of the way down
 *   a board whose height is the screen's minus the HUD's. So the caller passes
 *   what the level has ALREADY laid out (`CutsceneStage`: the boss, the props,
 *   the foot), a walker can be pinned to the boss, and every opener's shoe lands
 *   on the foot. Still pure: the stage is an input like `t`.
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
 *
 * ── The other hard rule: nothing pops ──
 *
 * A creature may only come into existence, stop existing, or jump, where the
 * camera cannot see it: outside the frame, under something the set paints over
 * the cast (`setCovers`), or on a real cut — a beat that changes the `set` or the
 * `world`, where the whole picture changes at once.
 *
 * The intro shipped breaking it. Its trail was a column switched on at 4.4 s, so
 * eight ants appeared in a line around the greeter in a single frame, right as
 * the camera pulled back to show them — and it read as a rendering bug, not as a
 * colony. The same fault was in four of the other eight scenes, in quieter
 * places: a column's loop point sitting on screen, a boss switched off in a wide
 * shot, a last ant "entering from off the board" into a camera that could see
 * forty units past the board.
 *
 * "Outside the frame" is not one rectangle. The renderer scales on the SHORT
 * edge, so a phone in portrait sees twice the height a desktop does at the same
 * zoom, and a point off the top of one is in the middle of the other. The only
 * place that is off-frame at EVERY aspect is past the short-edge half-width on
 * both axes at once — the corners — which is why every entrance below comes in
 * on a diagonal. `tests/game/cutscene.test.ts` samples every scene every 16 ms,
 * in portrait and landscape, calm and not, thinned and not, and holds each
 * creature to it.
 */

import type { WorldId } from '@/game/stages'
import type { BugId } from '@/game/bugs'
import type { BossId } from '@/game/bosses'
import type { HazardId } from '@/game/hazards'
import type { ArtWant } from '@/game/art'

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
  /** World 1 past the board's top-left corner: the Queen's nursery — a napkin
   *  nest and a clutch of eggs — plus the level's own props where the level put
   *  them (`CutsceneStage`), because 1-10's rematch runs from here onto the
   *  board the player is handed. */
  | 'lair'

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
  /**
   * Exists only while this set is up.
   *
   * The precise form of `when` for the tracks that belong to a PLACE: the column
   * walking under 03's door stops existing on the frame the door does, and the
   * roach on 04's marquee is gone the instant the glass is. A window typed as
   * numbers can only approximate a beat boundary, and the approximation is a
   * frame of creatures standing in the wrong room.
   */
  on?: CutsceneSet
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
  /**
   * What `carryFrom` carries, when it is not a crumb: an EGG held ahead of the
   * head, or the SANDWICH laid across the backs of a `crew`.
   */
  load?: CutsceneLoad
  /**
   * Carried by this many bugs at once rather than by one — drawn round the load,
   * with the load on top of them. 1-10's lunch arrives this way. One actor, not
   * four, because four walkers on four copies of one path is four chances for a
   * key to drift and the crew to come apart in the middle of a shot.
   */
  crew?: number
  /**
   * Drawn as this boss's painted still instead of as a bug: a boss that has to
   * MOVE. 1-10's Queen eats, grows, rears up and charges onto the board, and a
   * `still` can do none of that.
   */
  boss?: BossId
  /**
   * This walker IS the level's boss, so it lands where the level put it.
   *
   * With a `CutsceneStage`, the path's LAST key is replaced by the stage's boss
   * position and the `sizes` are scaled so the last one is the size the level
   * gave it. The beat sheet cannot know either: the sim spawns the boss a third
   * of the way down a board whose height is the screen's minus the HUD's, so a
   * portrait phone and a desktop put the same Queen forty pixels apart. Without a
   * stage — the tests' default, the bench — the authored key stands.
   */
  pin?: 'boss'
  /** Body radius keyframes, `[t, size]` at absolute scene times, smoothstepped
   *  between. A creature that eats a sandwich and gets bigger is two numbers. */
  sizes?: readonly (readonly [number, number])[]
  /**
   * Heading keyframes, `[t, radians]`, turned the short way and smoothstepped.
   *
   * Overrides both the path's heading and `face`. The path heading changes in a
   * single frame at every key, which on an ant is a twitch and on a boss forty
   * units across is the whole painting spinning — and a boss that charges
   * sideways and then turns to face the player cannot be expressed as "the way
   * it is walking" at all.
   */
  turns?: readonly (readonly [number, number])[]
  /** Huffing between these scene times: puffs of steam off both sides of the
   *  head, twice. The one thing on a painted still that can say ANGRY. */
  huff?: readonly [number, number]
}

/** What a carrying creature has hold of. */
export type CutsceneLoad = 'crumb' | 'egg' | 'sandwich'

/**
 * A COLUMN: bugs evenly phased along a line, looping.
 *
 * 02's route and its supply line, 03's trail under the door, 04's conveyor. The
 * column is what says "this is a route", and a route is the whole of 02.
 *
 * A column LOOPS, so it has two places a creature pops: `from`, where each one
 * is born, and `to`, where it is recycled. Both must be off-frame or under a
 * cover for every frame the column exists in — which in a wide shot means a
 * line a great deal longer than the part of it the shot is about.
 */
export interface ColumnTrack extends TrackBase {
  kind: 'column'
  /** Cycled across the column, so a line is not one creature repeated. */
  bugs: readonly BugId[]
  from: CutscenePt
  /** Corners between `from` and `to`, so a line can JOIN another one rather than
   *  end beside it. Each corner is rounded over a few units. */
  via?: readonly CutscenePt[]
  to: CutscenePt
  count: number
  /** ms for one bug to walk the whole line. */
  period: number
  carry?: boolean
  /** With `carry`: only from this fraction of the line on. Arriving empty and
   *  leaving loaded is the difference between a queue and a theft. */
  carryFrom?: number
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

/**
 * A RAID: bugs rushing in from off-frame at staggered times, each to its own
 * spot round a prize, and some of them hauling a piece back out.
 *
 * 01's theft. It exists because none of the other shapes can ENTER: a column
 * and a ring are all there at once from the first frame they exist in, so the
 * only way to bring one on is to switch it on — and a line of ants switched on
 * around the greeter is exactly the frame that read as a bug.
 *
 * Every raider has its own start time and its own entry point, and both are
 * generated from the index, so the same `t` is the same picture. The entry is
 * `clear` units from `at` on BOTH axes — a corner, which is the only place that
 * is off-frame in portrait and landscape at once (see the header). `clear` is a
 * pair, lerped across `go`, because the frame widens as the scene goes on: a
 * raider that sets off during the close-up can start near, and one that sets off
 * under the wide shot has to start a long way out.
 *
 * The run is an EXPONENTIAL approach — speed proportional to the distance still
 * to go. That is not a stylistic choice: at any zoom, a raider crossing the edge
 * of the frame is moving at the same number of screen pixels a second, because
 * the frame's half-width and its remaining distance scale together. The ones
 * that set off far away cover the off-screen part in a blur nobody sees, and
 * every one of them brakes into shot at the same readable scurry.
 */
export interface RaidTrack extends TrackBase {
  kind: 'raid'
  /** Cycled across the raiders. `RUSH` gives a sprinter and a beetle their own
   *  pace. */
  bugs: readonly BugId[]
  /** The prize. */
  at: CutscenePt
  /** How far round `at` the raiders end up — the plate's rim, not its centre. */
  reach: number
  count: number
  /** Scene time the first raider sets off, and the latest one can. */
  go: readonly [number, number]
  /** Distance from `at`, on both axes, of the entry point — for a raider setting
   *  off at `go[0]`, and at `go[1]`. */
  clear: readonly [number, number]
  /** The run's time constant, ms. Smaller is a harder dash and a sharper stop. */
  dash: number
  seed?: number
  /** Some of them leave again, carrying. */
  haul?: RaidHaul
}

export interface RaidHaul {
  /** 0..1 of the raiders that turn round with a piece. */
  share: number
  /** ms at the prize before they do, give or take. */
  after: number
  /** World units per second, loaded — a haul is a walk, not a dash. */
  speed: number
  /** Where the loot goes. A long way off-frame: nobody is ever seen to get there. */
  home: CutscenePt
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
  WalkerTrack | ColumnTrack | RingTrack | SwarmTrack | RaidTrack | StillTrack

/**
 * What the LEVEL has already put on the board, in the scene's world units.
 *
 * The level is started BEFORE a scene covers it (`GameScene.startLevel`), so by
 * the scene's first frame the sim has already laid out the hazards and spawned
 * the boss — at places that depend on the screen's shape and on how tall the
 * HUD is, and for the scattered hazards on a die roll. No beat sheet can know
 * any of that. A scene whose last frame has to BE the level's first frame reads
 * them from here instead: 1-10's Queen lands on the stage's boss, and its set
 * lays the stage's honey and crumbs on the blanket for the whole scene.
 *
 * Optional everywhere. With no stage the authored positions stand, which is
 * what the tests' default runs and the reference bench see.
 */
export interface CutsceneStage {
  boss?: { x: number; y: number; size: number }
  props?: readonly CutsceneStageProp[]
  /**
   * The player's foot as the board will first draw it: where, its stomp radius,
   * its height, and whether its ring is the high-visibility one. Every opener
   * lands its shoe here — the board starts the foot in the middle of the PLAY
   * rect, which is not the middle of the screen once the HUD's rail is carved
   * out of one side, and draws it smaller than a scene's generic shoe.
   */
  foot?: { x: number; y: number; r: number; z: number; highVis: boolean }
}

export interface CutsceneStageProp {
  id: HazardId
  x: number
  y: number
  /** Radius, world units — the sim's own. */
  r: number
  angle: number
  /** The prop's animation phase, frozen: a scene is a picture of the board. */
  t: number
  seed: number
}

/**
 * The stage, from the live sim.
 *
 * The board draws with its origin at the screen's TOP-LEFT and one unit =
 * `pxPerU` CSS px (the short edge over 100). A scene camera at the hand-off
 * framing — (50, 50) at zoom 1 — draws at the same scale with (50, 50) at the
 * screen's CENTRE. So the two are one translation apart, and this is it: a
 * point the sim holds at `x` is at `x + 50 − cssW / 2 / pxPerU` in the scene.
 */
export const cutsceneStageFrom = (
  cssW: number, cssH: number, pxPerU: number,
  boss: { x: number; y: number; size: number } | null,
  hazards: readonly {
    id: HazardId; x: number; y: number; r: number; angle: number; phase: number; seed: number
  }[],
  foot?: { x: number; y: number; r: number; z: number; highVis: boolean }
): CutsceneStage => {
  const ox = 50 - cssW / 2 / pxPerU
  const oy = 50 - cssH / 2 / pxPerU
  return {
    ...(boss ? { boss: { x: boss.x + ox, y: boss.y + oy, size: boss.size } } : {}),
    props: hazards.map((h) => ({
      id: h.id, x: h.x + ox, y: h.y + oy, r: h.r, angle: h.angle, t: h.phase, seed: h.seed
    })),
    ...(foot ? { foot: { ...foot, x: foot.x + ox, y: foot.y + oy } } : {})
  }
}

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
  /**
   * Stable for the life of the creature: its track's index and its own index in
   * the track. The renderer never reads it; it is what lets a test follow ONE
   * creature from frame to frame and notice it being born, dying or teleporting
   * in shot.
   */
  id: number
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
  /** What it carries, when that is not a crumb. See `WalkerTrack.load`. */
  load?: CutsceneLoad
  /** A crew of this many under one load. See `WalkerTrack.crew`. */
  crew?: number
  /** 0..1 through a huff, while it is huffing. */
  huff?: number
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
  /** Scene time, ms — for set dressing that moves on its own clock (1-10's eggs
   *  wobble in their nest). Not actor time: a `hold` does not stop an egg. */
  t: number
  /** What the level has put on the board, when the caller knows. */
  stage: CutsceneStage | null
}

// ─── What the camera can see ────────────────────────────────────────────────

/** A world-space rectangle: what a frame shows. */
export interface CutsceneView { x0: number; y0: number; x1: number; y1: number }

/**
 * The world rectangle a camera shows on a `cssW` x `cssH` screen.
 *
 * The same arithmetic `drawCutscene` scales by — zoom 1 fits the SHORT edge to
 * 100 units — so the long edge sees more, and how much more is the aspect. This
 * is the one definition of "on screen" the renderer culls with and the pop-in
 * test holds every scene to.
 */
export const cutsceneView = (
  camera: CutsceneCamera, cssW: number, cssH: number
): CutsceneView => {
  const s = (Math.min(cssW, cssH) / 100) * camera.zoom
  const hw = cssW / 2 / s
  const hh = cssH / 2 / s
  return { x0: camera.x - hw, y0: camera.y - hh, x1: camera.x + hw, y1: camera.y + hh }
}

/**
 * How far past its centre a creature's DRAWING reaches, in world units.
 *
 * Not the body radius: the painted frame is a box `size / 0.62` wide each way
 * with legs and antennae out to its edges, a creature turned to the camera is
 * drawn a third bigger and lifted, a carried crumb sits ahead of the head, and a
 * boss still is its own panel. A creature whose centre is off-frame by less than
 * this is still showing a leg.
 */
export const actorReach = (a: CutsceneActor): number => {
  // A boss rearing up is lifted and grown (`BOSS_LOOK`), and a huff throws its
  // puffs out past both sides of the head.
  if (a.boss) return a.size * (a.huff !== undefined ? 2.1 : a.waving ? 1.66 : 1.2) + 1
  // A crew is spread round its load, and the load is narrower than the crew.
  if (a.crew) return a.size * (Math.hypot(CREW_SPREAD.x, CREW_SPREAD.y) + 1.62) + 0.5
  if (a.carry && a.load === 'egg') return a.size * (EGG_HELD.reach + EGG_HELD.r) + 0.5
  return a.size * (a.waving ? 2.4 : 1.62) + (a.carry ? 1.5 : 0.5)
}

/** Where a crew stands round its load, in body radii from the crew's centre:
 *  across the line of travel, and along it. `cutsceneArt` draws them here. */
export const CREW_SPREAD = { x: 1.25, y: 1.0 } as const

/** The sandwich on a crew's backs, as a fraction of the plate-sized sandwich. */
export const CREW_LOAD = 0.62

/** A held egg, in body radii: how far ahead of the centre, and how big. */
export const EGG_HELD = { reach: 1.45, r: 0.6 } as const

/** A boss turned to the camera is lifted this far towards it and grown by this
 *  much, in body radii — the rear-up every creature does, sized for a boss. */
export const BOSS_LOOK = { lift: 0.3, grow: 1.08 } as const

/** Does any of `a`'s drawing land inside `v`? */
export const actorInView = (a: CutsceneActor, v: CutsceneView): boolean => {
  const r = actorReach(a)
  return a.x + r > v.x0 && a.x - r < v.x1 && a.y + r > v.y0 && a.y - r < v.y1
}

// ─── What the set paints over the cast ──────────────────────────────────────

/**
 * A (possibly turned) rectangle the set paints OVER the cast — somewhere a
 * creature can be, and be unseen, while the camera is looking straight at it.
 *
 * The geometry lives here rather than beside the painters because the staging
 * depends on it: 03's trail is recycled under the door, 04's conveyor starts and
 * ends inside a machine, and 05's last ant crawls out from under the paperback.
 * `cutsceneArt.ts` paints these same numbers.
 */
export interface CutsceneCover {
  x: number
  y: number
  hw: number
  hh: number
  /** Radians, the way the painter turns it. */
  a?: number
}

/** Where the door's bottom edge sits in 03. Everything above it is door. */
export const DOOR_EDGE = 60

/** The paperback on the picnic blanket, face down. */
export const PICNIC_BOOK: CutsceneCover = { x: 20, y: 70, hw: 8.5, hh: 11.5, a: -0.34 }

/** The two machines at either end of 04's conveyor: in at the left, out at the
 *  right. The lane runs y 29..44 between them. */
export const HOPPERS: readonly CutsceneCover[] = [
  { x: -9, y: 36.5, hw: 11, hh: 11.5 },
  { x: 109, y: 36.5, hw: 11, hh: 11.5 }
]

const COVERS: Partial<Record<CutsceneSet, readonly CutsceneCover[]>> = {
  // x -200..300 and y -200..DOOR_EDGE, the rectangle `overDoor` fills.
  door: [{ x: 50, y: (DOOR_EDGE - 200) / 2, hw: 250, hh: (DOOR_EDGE + 200) / 2 }],
  picnic: [PICNIC_BOOK],
  arcade: HOPPERS
}

/** What the set in shot paints over the cast. */
export const setCovers = (set: CutsceneSet): readonly CutsceneCover[] => COVERS[set] ?? []

/** Is ALL of `a`'s drawing under one of `covers`? */
export const actorCovered = (
  a: CutsceneActor, covers: readonly CutsceneCover[]
): boolean => {
  const r = actorReach(a)
  for (const c of covers) {
    const dx = a.x - c.x
    const dy = a.y - c.y
    const ca = Math.cos(-(c.a ?? 0))
    const sa = Math.sin(-(c.a ?? 0))
    const u = dx * ca - dy * sa
    const v = dx * sa + dy * ca
    if (Math.abs(u) <= c.hw - r && Math.abs(v) <= c.hh - r) return true
  }
  return false
}

// ─── 1-10's nursery ─────────────────────────────────────────────────────────

/**
 * Where the Queen keeps her eggs: a napkin nest past the board's top-left corner.
 *
 * The corner is the point, for the same reason every entrance in this file comes
 * in on a diagonal. 1-10 opens on a board with no nest and no eggs on it, so the
 * nursery must be out of the hand-off frame on EVERY screen — and the only place
 * that is off-frame in portrait and landscape at once is past the short-edge
 * half-width on both axes. Everything that lives here (the nest, its eggs, the
 * workers, the nursery crowd) keeps `x + reach < 0` and `y + reach < 0`, and the
 * snap to gameplay framing leaves the lot behind rather than switching it off.
 */
export const LAIR_NEST: CutsceneCover = { x: -40, y: -36, hw: 14, hh: 12 }

/** The clutch, as offsets from the nest's centre. Five, because five reads as
 *  "a lot of eggs" at a glance and six starts to read as a pattern. */
export const LAIR_EGGS: readonly (readonly [number, number])[] = [
  [0.4, -0.6], [-5.6, -2.8], [5.2, -3.2], [-2.8, 4.4], [4, 4.2]
]

/** Egg radius in the nest — a shade under the fight's `POD_SIZE`, because these
 *  were only just laid, and near enough that the fight's eggs are these eggs. */
export const LAIR_EGG_R = 3.4

// ─── Painted set dressing ───────────────────────────────────────────────────

/**
 * The box each piece of cutscene set dressing is painted into, in world units
 * about its own centre — `images/scenes/<id>.webp` is blitted into
 * `(−hw, −hh, 2hw, 2hh)` of whatever transform its painter has set up, and the
 * reference bench draws the procedural version into exactly the same rectangle.
 *
 * THE BOX IS THE CONTRACT (`artSheet.ts`), which is why the numbers live here —
 * a module the manifest can load under plain Node — rather than beside the
 * painters. Each is the drawing's own extent plus half its contour:
 *
 *   book       `PICNIC_BOOK`'s rectangle, turned by the painter, not the paint
 *   sandwich   measured off the two tilted halves (x −9.9..11.3, y −7.1..6.8),
 *              centred on the painter's origin rather than on the ink
 *   attic-box  the REFERENCE box (24 × 20); each box in the attic stretches the
 *              one painting to its own size, and none is far off that shape
 *   door       ONE TILE of the door's lower edge, 46 units wide — the pitch of
 *              its panels — and from 34 units above the sill to the bottom of
 *              the sill's own contour
 *   cabinet    the whole cabinet face, centred on (50, 50)
 *   puff       a unit puff; the huff scales it
 */
export const SCENE_ART_BOX: Readonly<Record<string, { hw: number; hh: number }>> = {
  book: { hw: PICNIC_BOOK.hw + 0.55, hh: PICNIC_BOOK.hh + 0.55 },
  glass: { hw: 8, hh: 8 },
  plate: { hw: 13.65, hh: 13.65 },
  sandwich: { hw: 11.4, hh: 7.2 },
  crumb: { hw: 1.45, hh: 1.45 },
  'attic-box': { hw: 12.6, hh: 10.6 },
  door: { hw: 23, hh: 17.4 },
  cabinet: { hw: 45.1, hh: 47.1 },
  hopper: { hw: 11.6, hh: 12.1 },
  nest: { hw: LAIR_NEST.hw, hh: LAIR_NEST.hh },
  puff: { hw: 1, hh: 1 }
}

/** The door's tile pitch, and where one tile's centre sits against the sill. */
export const DOOR_TILE = { pitch: 46, x0: 27, y: DOOR_EDGE - 16.6 } as const

/**
 * Which paintings each set draws — the set dressing, the hazard props it lays
 * out, and the floor it clips onto a patch.
 *
 * The CAST is not here: `cutsceneArtWants` reads that off the tracks, which
 * already say which bug, which boss, and what they carry.
 */
const SET_ART: Record<CutsceneSet, readonly ArtWant[]> = {
  none: [],
  picnic: [['scene', 'plate'], ['scene', 'sandwich'], ['scene', 'glass'], ['scene', 'book'], ['scene', 'crumb']],
  yard: [
    ['bg', 'floor-1'], ['scene', 'plate'], ['scene', 'sandwich'], ['scene', 'glass'],
    ['scene', 'book'], ['scene', 'crumb'], ['prop', 'honey'], ['prop', 'crumbs']
  ],
  backyard: [['prop', 'honey'], ['prop', 'crumbs']],
  attic: [['scene', 'attic-box'], ['prop', 'cobweb']],
  door: [['scene', 'attic-box'], ['prop', 'cobweb'], ['scene', 'door']],
  cabinet: [['scene', 'cabinet']],
  // The pods are drawn by `propArt.paintPod`, which reads the crack-stage sheet
  // (`prop/egg`) first and the old whole-egg still (`prop/pod`) only under it —
  // so both are wanted, or a scene opens on the still and swaps to the stage
  // sheet the moment it decodes.
  arcade: [['scene', 'hopper'], ['prop', 'magnet'], ['prop', 'conveyor'], ['prop', 'egg'], ['prop', 'pod']],
  lair: [['scene', 'nest'], ['prop', 'egg'], ['prop', 'pod']]
}

/**
 * Every painting a scene can put on screen, once each.
 *
 * What the art preloader asks for before a scene plays, so a scene waits for
 * its paintings the way a boss level waits for its boss: the floors under its
 * beats, the dressing of every set it visits, and every creature, boss and
 * carried thing on its tracks. A beetle in 01's raid is not on 1-1's roster, and
 * without this it would be drawn for the first second of the scene and painted
 * for the rest.
 */
export const cutsceneArtWants = (s: CutsceneSpec): ArtWant[] => {
  const seen = new Set<string>()
  const out: ArtWant[] = []
  const want = (w: ArtWant): void => {
    const key = `${w[0]}/${w[1]}`
    if (seen.has(key)) return
    seen.add(key)
    out.push(w)
  }
  want(['bg', `floor-${s.world}`])
  for (const w of SET_ART[s.set ?? 'none']) want(w)
  for (const b of s.beats) {
    if (b.world) want(['bg', `floor-${b.world}`])
    if (b.set) for (const w of SET_ART[b.set]) want(w)
  }
  for (const tr of s.actors ?? []) {
    const bugs = 'bugs' in tr ? tr.bugs : tr.bug ? [tr.bug] : []
    for (const id of bugs) want(['bug', id])
    if ('boss' in tr && tr.boss) want(['boss', tr.boss])
    const carries = tr.kind === 'column' ? !!tr.carry
      : tr.kind === 'still' ? !!tr.carry
      : tr.kind === 'walker' ? tr.carryFrom !== undefined
      : tr.kind === 'raid' ? !!tr.haul
      : false
    if (carries) {
      const load = tr.kind === 'walker' ? tr.load ?? 'crumb' : 'crumb'
      if (load === 'egg') { want(['prop', 'egg']); want(['prop', 'pod']) } else want(['scene', load])
    }
    if (tr.kind === 'walker' && tr.huff) want(['scene', 'puff'])
  }
  return out
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

/** Turn from heading `a` to heading `b` by `k`, the short way round. */
const turn = (a: number, b: number, k: number): number => {
  const d = ((b - a) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI
  return a + d * k
}

/** The golden ratio's fractional part. `i * GOLDEN % 1` spreads any PREFIX of
 *  the indices evenly over 0..1 — so a crowd thinned to its first `n` members
 *  is still spread across the whole raid, not bunched at its start. */
const GOLDEN = 0.6180339887

/**
 * The base-3 radical inverse: another sequence that spreads any prefix evenly,
 * and one that has nothing to do with the golden ratio.
 *
 * A raid needs TWO of those — one for when a raider sets off, one for where from
 * — and they must not be the same sequence. The first cut used the golden angle
 * for direction, which is the golden ratio again: the entry point swept steadily
 * round the clock as the raid went on, and every eighth raider (the bug list's
 * length) came in twenty degrees from the last, so all three beetles arrived
 * together out of one corner.
 */
const radical3 = (i: number): number => {
  let r = 0
  let f = 1 / 3
  for (let n = i; n > 0; n = Math.floor(n / 3)) {
    r += (n % 3) * f
    f /= 3
  }
  return r
}

/**
 * Per-creature pace in a raid. A sprinter is the one that is already on the
 * plate when the others arrive; a beetle is slow, big, and never comes for a
 * crumb — it comes for the big piece.
 */
const RUSH: Partial<Record<BugId, { pace: number; scale: number; hauls?: boolean }>> = {
  sprinter: { pace: 0.6, scale: 0.94 },
  beetle: { pace: 1.45, scale: 1.3, hauls: true }
}

/** A raid's run ends this far "past" its target, so an exponential approach
 *  actually ARRIVES — at `EPS / dash` units a ms rather than never. */
const EPS = 4

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

const inWindow = (tr: ActorTrack, t: number, set: CutsceneSet): boolean =>
  (!tr.when || (t >= tr.when[0] && t <= tr.when[1])) && (!tr.on || tr.on === set)

/** A column's line, measured: its points and how far along each one sits. */
const measureLine = (tr: ColumnTrack): { pts: CutscenePt[]; at: number[] } => {
  const pts = [tr.from, ...(tr.via ?? []), tr.to]
  const at = [0]
  for (let j = 1; j < pts.length; j++) {
    at.push(at[j - 1]! + Math.hypot(pts[j]!.x - pts[j - 1]!.x, pts[j]!.y - pts[j - 1]!.y))
  }
  return { pts, at }
}

/** Over how many units a column rounds a corner. A creature that snapped
 *  through a right angle in one frame would be a small pop of its own. */
const CORNER = 3

/** Where `phase` (0..1) of the way down a measured line is, and which way a
 *  creature there faces. */
const alongLine = (
  line: { pts: CutscenePt[]; at: number[] }, phase: number
): { x: number; y: number; heading: number } => {
  const { pts, at } = line
  const d = phase * at[at.length - 1]!
  let j = 0
  while (j < pts.length - 2 && d >= at[j + 1]!) j++
  const a = pts[j]!
  const b = pts[j + 1]!
  const len = at[j + 1]! - at[j]!
  const k = len > 0 ? clamp01((d - at[j]!) / len) : 0
  const legHeading = (m: number): number =>
    headingOf(pts[m + 1]!.x - pts[m]!.x, pts[m + 1]!.y - pts[m]!.y)
  let heading = legHeading(j)
  // Halfway round at the corner itself, from both sides, so the turn is
  // continuous whichever leg a sample lands on.
  if (j + 2 < pts.length && at[j + 1]! - d < CORNER) {
    heading = turn(heading, legHeading(j + 1), 0.5 * (1 - (at[j + 1]! - d) / CORNER))
  } else if (j > 0 && d - at[j]! < CORNER) {
    heading = turn(heading, legHeading(j - 1), 0.5 * (1 - (d - at[j]!) / CORNER))
  }
  return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), heading }
}

/** A value off `[t, v]` keys at `t`, smoothstepped between them and held past
 *  either end. `turned` goes round the short way, for headings. */
const keyed = (keys: readonly (readonly [number, number])[], t: number, turned = false): number => {
  const first = keys[0]!
  if (t <= first[0]) return first[1]
  for (let i = 1; i < keys.length; i++) {
    const b = keys[i]!
    if (t < b[0]) {
      const a = keys[i - 1]!
      const k = smooth(clamp01((t - a[0]) / Math.max(1, b[0] - a[0])))
      return turned ? turn(a[1], b[1], k) : lerp(a[1], b[1], k)
    }
  }
  return keys[keys.length - 1]![1]
}

/** A pinned walker's path: the authored one with its last key moved onto the
 *  stage. Only the LAST key — every earlier leg is choreography and stays put. */
const pinnedPath = (
  path: readonly CutsceneKey[], at: { x: number; y: number }
): readonly CutsceneKey[] => {
  const last = path[path.length - 1]!
  return [...path.slice(0, -1), { t: last.t, x: at.x, y: at.y }]
}

const sampleTrack = (
  tr: ActorTrack, track: number, t: number, set: CutsceneSet, crowd: number,
  stage: CutsceneStage | null, out: CutsceneActor[]
): void => {
  if (!inWindow(tr, t, set)) return
  const step = tr.step ?? 420
  const size = tr.size ?? 3
  // Ids are `track * 1000 + index`: stable for a creature's whole life.
  const id0 = track * 1000

  switch (tr.kind) {
    case 'walker': {
      const pin = tr.pin === 'boss' ? stage?.boss : undefined
      const p = walkPath(pin ? pinnedPath(tr.path, pin) : tr.path, t)
      // Sizes scale as a whole, so the story's ratio survives a small screen:
      // on a board too short for a size-15 Queen the sim spawns a smaller one,
      // and the Queen who grew into her has to grow into THAT one.
      const authored = tr.sizes ? tr.sizes[tr.sizes.length - 1]![1] : size
      const grown = (tr.sizes ? keyed(tr.sizes, t) : size) * (pin ? pin.size / authored : 1)
      const huffing = !!tr.huff && t >= tr.huff[0] && t < tr.huff[1]
      out.push({
        id: id0,
        bug: tr.bug,
        ...(tr.boss ? { boss: tr.boss } : {}),
        x: p.x,
        y: p.y,
        heading: tr.turns ? keyed(tr.turns, t, true) : tr.face ?? p.heading,
        cycle: (t / step) % 1,
        size: grown,
        carry: tr.carryFrom !== undefined && t >= tr.carryFrom,
        ...(tr.load && tr.load !== 'crumb' ? { load: tr.load } : {}),
        ...(tr.crew ? { crew: tr.crew } : {}),
        ...(huffing ? { huff: (t - tr.huff![0]) / (tr.huff![1] - tr.huff![0]) } : {}),
        waving: !!tr.wave && t >= tr.wave[0] && t < tr.wave[1],
        greeter: tr.greeter === true
      })
      return
    }

    case 'column': {
      const line = measureLine(tr)
      const n = many(tr.count, crowd)
      const t0 = tr.when?.[0] ?? 0
      for (let i = 0; i < n; i++) {
        const phase = (((t - t0) / tr.period + (tr.phase ?? 0) + i / n) % 1 + 1) % 1
        const p = alongLine(line, phase)
        out.push({
          id: id0 + i,
          bug: tr.bugs[i % tr.bugs.length]!,
          x: p.x,
          y: p.y,
          heading: p.heading,
          cycle: (t / step + i * 0.37) % 1,
          size,
          carry: !!tr.carry && phase >= (tr.carryFrom ?? 0),
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
          id: id0 + i,
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
          id: id0 + i,
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

    case 'raid': {
      sampleRaid(tr, id0, t, crowd, step, size, out)
      return
    }

    case 'still': {
      out.push({
        id: id0,
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

/** Wobble across the line of a dash, rad/ms — three scrabbles a second. */
const SCRABBLE = 0.0188
/** Tugging at the prize once there, rad/ms — a little under two a second. */
const TUG = 0.0101

/**
 * One raid, every raider in it. See `RaidTrack` for the shape of a raid; this is
 * each raider's own three acts — the dash, the tug, the haul — and every number
 * in them is a hash of its index, so nothing is remembered between frames.
 */
const sampleRaid = (
  tr: RaidTrack, id0: number, t: number, crowd: number, step: number, size: number,
  out: CutsceneActor[]
): void => {
  const n = many(tr.count, crowd)
  const seed = tr.seed ?? 5
  for (let i = 0; i < n; i++) {
    // Staggered on the golden ratio rather than in index order, so a raid
    // thinned to its first few members still sets off across the whole window.
    const u = (i * GOLDEN) % 1
    const go = lerp(tr.go[0], tr.go[1], u)
    if (t < go) continue

    const bug = tr.bugs[i % tr.bugs.length]!
    const rush = RUSH[bug]
    const pace = rush?.pace ?? 1

    // ── Where it comes from ──
    // A corner, `clear` out on both axes, and further out on the axis its angle
    // leans towards — so they arrive from every side, never square-on.
    const th = seed + radical3(i) * Math.PI * 2
    const cs = Math.cos(th)
    const sn = Math.sin(th)
    const c = lerp(tr.clear[0], tr.clear[1], u)
    const ex = tr.at.x + (cs < 0 ? -1 : 1) * c * (1 + 0.8 * cs * cs)
    const ey = tr.at.y + (sn < 0 ? -1 : 1) * c * (1 + 0.8 * sn * sn)

    // ── Where it is going ──
    // Its own spot on the rim, on the side it came in from, give or take.
    const aim = Math.atan2(ey - tr.at.y, ex - tr.at.x) + (hash1(seed + i * 4.3) - 0.5) * 0.9
    const rim = tr.reach * (0.55 + hash1(seed + i * 6.7) * 0.45)
    const tx = tr.at.x + Math.cos(aim) * rim
    const ty = tr.at.y + Math.sin(aim) * rim
    const run = Math.hypot(tx - ex, ty - ey)
    const ux = (tx - ex) / run
    const uy = (ty - ey) / run
    const face = headingOf(ux, uy)

    const tau = tr.dash * pace * (0.8 + hash1(seed + i * 8.9) * 0.4)
    const arrive = go + tau * Math.log((run + EPS) / EPS)
    const cycle = (t / (step * pace) + hash1(seed + i)) % 1
    const sz = size * (rush?.scale ?? 1)

    let x: number
    let y: number
    let heading = face
    let carry = false

    if (t < arrive) {
      // ── The dash ──
      // Distance still to go decays exponentially; see `RaidTrack` for why that
      // makes every raider cross the frame edge at the same on-screen speed.
      const el = t - go
      const left = (run + EPS) * Math.exp(-el / tau) - EPS
      // A scrabble across the line, gone by the time it arrives.
      const fade = clamp01(left / 14)
      const side = Math.sin(el * SCRABBLE + i) * 0.9 * fade
      x = tx - ux * left - uy * side
      y = ty - uy * left + ux * side
      const along = (left + EPS) / tau
      const lat = Math.cos(el * SCRABBLE + i) * SCRABBLE * 0.9 * fade
      heading = headingOf(ux * along - uy * lat, uy * along + ux * lat)
    } else {
      const haul = tr.haul
      const hauls = !!haul && (rush?.hauls === true || hash1(seed + i * 11.1) < haul.share)
      const leave = haul ? arrive + haul.after * (0.6 + hash1(seed + i * 12.7) * 0.8) : Infinity
      // ── The tug ──
      // Facing the prize and pulling, which is what turns a crowd round a plate
      // into a crowd TAKING a sandwich.
      const tug = Math.sin((Math.min(t, leave) - arrive) * TUG) * 0.55
      x = tx + ux * tug
      y = ty + uy * tug

      if (haul && hauls && t >= leave) {
        // ── The haul ──
        // Turn round, pick up speed, walk it home. Home is far enough off-frame
        // that the scene is over before anyone gets there.
        const hx = haul.home.x + (hash1(seed + i * 14.9) - 0.5) * 40
        const hy = haul.home.y + (hash1(seed + i * 15.3) - 0.5) * 40
        const far = Math.hypot(hx - x, hy - y)
        const wx = (hx - x) / far
        const wy = (hy - y) / far
        const v = (haul.speed / 1000) * (0.85 + hash1(seed + i * 16.1) * 0.3) / pace
        const el = t - leave
        // 200 ms to turn, then 400 ms of acceleration: a creature that sets off
        // at full speed from a standstill has been teleported one step.
        const moving = Math.max(0, el - 200)
        const d = Math.min(far, moving < 400 ? v * moving * moving / 800 : v * (moving - 200))
        x += wx * d
        y += wy * d
        heading = turn(face, headingOf(wx, wy), smooth(clamp01(el / 200)))
        carry = true
      }
    }

    out.push({
      id: id0 + i,
      bug,
      x,
      y,
      heading,
      cycle,
      size: sz,
      carry,
      waving: false
    })
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
 *
 * `stage` is what the level has already put on the board (`CutsceneStage`) —
 * still pure, because it is an input: the same `t` on the same stage is the
 * same picture.
 */
export const cutsceneFrame = (
  s: CutsceneSpec, t: number, calm = false, crowd = 1, stage: CutsceneStage | null = null
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
  const set = beatSet(s, beat)
  const actors: CutsceneActor[] = []
  const tracks = s.actors ?? []
  for (let k = 0; k < tracks.length; k++) sampleTrack(tracks[k]!, k, ta, set, crowd, stage, actors)

  return {
    camera,
    actors,
    world: beatWorld(s, beat),
    set,
    shoe: dial('shoe'),
    dark: dial('dark'),
    torch: dial('torch'),
    sandwich: dial('sandwich'),
    glow: dial('glow'),
    crumb: dial('crumb'),
    crumbAt: s.crumbAt ?? { x: 57.4, y: 46.6 },
    beat,
    beat01,
    t,
    stage
  }
}

// ═══ 01 — "The Crumb" ═══════════════════════════════════════════════════════

/**
 * Where 01's loot goes: off the blanket's lower-left, a long way out.
 *
 * Far enough that nobody is ever seen to arrive — the hold freezes the haulers
 * mid-route — and down-left because that is the way the camera tracks the
 * greeter, so the route home is the route the shot is already looking along.
 */
const NEST: CutscenePt = { x: -20, y: 160 }

/**
 * The beat sheet in `cutscenes.md`, as numbers.
 *
 * The camera starts wide over the whole picnic and ends exactly where the
 * gameplay camera sits, so the hand-off to level 1-1 has no cut in it: the last
 * frame of the scene and the first frame of the level are the same framing.
 *
 * ── Why the raid is two raids ──
 *
 * The first cut of this switched a column on at 4.4 s and eight ants were
 * suddenly standing in a line round the greeter. The raid that replaced it is a
 * RUSH: every creature after the greeter comes in from off-frame on its own
 * clock. How far off is set by the widest frame that could be on screen the
 * moment it sets off — and under `prefers-reduced-motion` the camera CUTS to the
 * 1.0 framing at 4.4 s rather than easing there, which pushes every entrance
 * after 4.4 s out past the corners of a hundred-unit frame.
 *
 * So the three that set off BEFORE 4.4 s are their own track. The camera is
 * still at 2.9 for them in both modes, so they can start forty units out and
 * arrive as the greeter lifts the crumb — the wave was a signal, and it was
 * answered. Everyone else sets off after, from further out the later they go.
 */
export const INTRO: CutsceneSpec = {
  id: 'intro',
  world: 1,
  set: 'picnic',
  crumbAt: { x: 57.4, y: 46.6 },
  beats: [
    { ms: 1600, ease: 'cut', camera: { x: 50, y: 50, zoom: 0.62 },
      note: 'Wide and still. The plate, the glass, the book, the sandwich. Nobody.' },
    // Beats 2 and 3 go in CLOSE. The crumb is one world unit across and the
    // wave is the scene's whole emotional hook; at the 1.45/1.7 this first ran
    // at, both played out at about fifteen pixels and read as nothing.
    { ms: 1400, ease: 'inOut', camera: { x: 55.5, y: 45, zoom: 2.3 },
      sfx: 'tick', dials: { crumb: 1 },
      note: 'Push in on the sandwich. A crumb tips off the plate. The greeter hurries in from the corner.' },
    { ms: 1400, ease: 'out', camera: { x: 57, y: 45.6, zoom: 2.9 },
      sfx: 'coin',
      // Linear, so the crumb goes at the half-beat the greeter reaches it,
      // rather than at the instant the beat opens.
      dials: { crumb: 0, ease: 'linear' },
      note: 'It stops at the crumb, waves at the camera, takes it. Three scouts dash in behind it.' },
    { ms: 1600, ease: 'inOut', camera: { x: 44, y: 54, zoom: 1.0 },
      note: 'Track with it, pulling back. Ants pour in from every corner; the scouts head home loaded, beside it.' },
    { ms: 1400, ease: 'inOut', camera: { x: 50, y: 50, zoom: 0.58 },
      dials: { sandwich: 0.55 },
      note: 'Wide: the plate is overrun, a stream is hauling it off, more still rushing in. The sandwich is moving.' },
    { ms: 1200, ease: 'out', camera: { x: 50, y: 50, zoom: 0.66 },
      sfx: 'feverReady', hold: true, dials: { sandwich: 0.15 },
      note: 'The shadow slides across the blanket. Every ant stops — the late ones mid-dash.' },
    { ms: 900, ease: 'in', camera: { x: 50, y: 50, zoom: 1 },
      sfx: 'charge',
      // The shoe settles rather than accelerating: it is down and POISED before
      // the last frame, and the last frame is the one 1-1 inherits.
      dials: { shoe: 1, ease: 'out' },
      note: 'Snap to gameplay framing. The shoe descends and holds.' }
  ],
  actors: [
    // ── The greeter ──
    // Does not exist until 2.6 s, and then exists in the top-right corner of a
    // frame that is already close — off-frame in portrait and landscape both,
    // and in the reduced-motion cut. The first cut stood it beside the plate from
    // t=0, marching on the spot through the "nothing moves" wide shot.
    //
    // Stopped at the crumb by 3.6, waving to 4.4, then away down-left towards the
    // NEST with the crumb — the way every hauler after it goes, so by the wide
    // shot it is simply the first of a stream. Its last key is past the end of
    // the scene on purpose: it is still WALKING when the hold freezes it, rather
    // than easing to a stop on its own a moment before.
    { kind: 'walker', bug: 'ant', size: 3.2,
      path: [
        { t: 2600, x: 89, y: 11 },
        { t: 3600, x: 57, y: 45 },
        { t: 4400, x: 57, y: 45 },
        { t: 10_400, x: NEST.x, y: NEST.y }
      ],
      when: [2600, 9500], wave: [3600, 4400], greeter: true, carryFrom: 4400 },
    // ── The scouts ──
    // Set off in the last quarter-second of the wave, from just outside the
    // close-up, and are on the plate as the greeter lifts the crumb. All three
    // haul, and they are the ones walking home beside it on the pull-back.
    { kind: 'raid', bugs: ['ant', 'sprinter', 'ant'], size: 3, step: 240,
      at: { x: 50, y: 42 }, reach: 12, count: 3,
      go: [4150, 4400], clear: [34, 40], dash: 360, seed: 3,
      haul: { share: 1, after: 650, speed: 30, home: NEST } },
    // ── The raid ──
    // Twenty-one more, from every corner, over the next two seconds. The late
    // ones start a long way out and the hold catches them mid-dash, which is
    // exactly the picture beat 6 wants: a colony frozen in the act.
    //
    // Twenty-one plus four is the twenty-odd the first cut drew at its widest,
    // and the tier thins it like any other crowd.
    { kind: 'raid', bugs: ['ant', 'ant', 'sprinter', 'ant', 'beetle', 'ant', 'ant'],
      size: 3, step: 240,
      at: { x: 50, y: 42 }, reach: 13, count: 21,
      go: [4400, 6600], clear: [72, 114], dash: 460, seed: 11,
      haul: { share: 0.45, after: 500, speed: 26, home: NEST } }
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
    //
    // It is three times the line the shot is about, and that is the fix, not
    // waste. The first cut ran it plate-centre to (54,100): every ant was BORN
    // on the plate, in the middle of the opening close-up, and recycled in the
    // middle of the wide shot. Now it comes over the far corner of the blanket
    // empty-handed, crosses the plate — `carryFrom` is just past it — and leaves
    // down past the corner of the 0.56 pull-back, and both ends are off-frame at
    // every framing the scene has. Same pace and a slightly looser spacing than
    // before; the renderer culls the two-thirds that are off screen.
    { kind: 'column', bugs: ['ant', 'ant', 'sprinter', 'ant', 'beetle'], size: 3.1,
      from: { x: 219.1, y: -18.5 }, to: { x: -63, y: 183.9 },
      count: 26, period: 21_440, carry: true, carryFrom: 0.3 },
    // The supply line, joining from the upper left. Two lines that MEET is what
    // turns a queue into a logistics operation — so it genuinely meets: across
    // the grass to the route just past the hem, then down it as a second file
    // beside the first, and out the same far corner. The first cut stopped it
    // dead thirteen units short of the route, where every ant in it vanished in
    // the middle of the shot, and switched all ten on at once at 1.9 s.
    { kind: 'column', bugs: ['ant', 'caterpillar', 'ant', 'stinkbug'], size: 2.9,
      from: { x: -20, y: -24 }, via: [{ x: 94.3, y: 67.4 }], to: { x: -64.8, y: 181.5 },
      count: 22, period: 21_660, carry: true, phase: 0.31 },
    // The foreman. Bigger than everything marching past it and doing nothing at
    // all, which is the entire characterisation — and it has been doing nothing
    // there since before the scene started. It used to be switched on at 2.2 s,
    // which a portrait phone saw happen. Off the board, so it is not standing on
    // 2-1 when the level starts.
    { kind: 'still', bug: 'beetle', size: 7, at: { x: 116, y: 100 },
      face: Math.PI * 0.62 }
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
      // it — `overDoor` paints the door on top of them and they are recycled
      // where nobody can see it (`setCovers('door')`).
      //
      // Starts off the bottom-left corner of beat 1's framing. The first cut
      // started at (16,102), which a landscape screen could see: an ant appeared
      // at the bottom of the shot every half-second.
      //
      // Exists exactly while the door does. It used to run on to 2.1 s, a fifth
      // of a second past the cut to the attic — nine ants standing in the torch
      // beam, then gone.
      from: { x: 10, y: 109 }, to: { x: 58, y: 52 },
      count: 10, period: 4790, carry: true, on: 'door' },
    // The floor. Sixteen bodies at the wide framing is what "moving" means; the
    // tier multiplier thins it on a device that cannot draw sixteen.
    //
    // It is on from the cut to the attic, the frame the door disappears and the
    // torch comes on, rather than a tenth of a second into the lit shot after it.
    { kind: 'swarm', bugs: ['centipede', 'moth', 'beetle', 'flea', 'stinkbug', 'ant'],
      at: { x: 50, y: 48 }, w: 82, h: 66, count: 16, size: 3.1, speed: 7,
      seed: 21, on: 'attic' },
    // One straggler crossing the beam close to the camera, so the swarm has a
    // foreground and the shot has a depth to it.
    { kind: 'walker', bug: 'moth', size: 4.4,
      path: [
        { t: 1900, x: 16, y: 30 },
        { t: 5000, x: 76, y: 58 }
      ],
      // From the cut, like the floor under it: under reduced motion the cut
      // lands on a 1.3 framing that already has (16,30) in it.
      on: 'attic' }
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
    //
    // …and then it keeps walking, off the marquee and out of the push-in, and
    // stops existing with the glass (`on: 'cabinet'`). The first cut switched it
    // off at 2.05 s while beat 3's framing was still looking straight at it.
    { kind: 'walker', bug: 'robobug', size: 4.6, step: 620,
      path: [
        { t: 0, x: 14, y: 20 },
        { t: 1000, x: 44, y: 20 },
        { t: 2000, x: 74, y: 20 },
        { t: 2900, x: 104, y: 20 }
      ],
      on: 'cabinet' },
    // Behind the glass. A line down the conveyor, carrying — out of one machine
    // and into the other.
    //
    // The machines are the fix. A looping line is recycled at its ends, and the
    // 0.58 pull-back sees a hundred and fifty units either side of the board: a
    // conveyor long enough to hide its own ends off-frame would be four times
    // the ants. So both ends are inside a `HOPPERS` box the set paints over the
    // cast, which is what a factory line looks like anyway. The first cut had
    // robobugs appearing out of the floor at x -6 and vanishing at x 106, in
    // the middle of the widest shot in the scene.
    { kind: 'column', bugs: ['robobug', 'robobug', 'beetle', 'centipede'], size: 3.2,
      from: { x: -9, y: 36 }, to: { x: 109, y: 36 },
      count: 12, period: 3580, carry: true, on: 'arcade' },
    // …and the rest of the floor, working.
    { kind: 'swarm', bugs: ['robobug', 'flea', 'centipede', 'beetle', 'moth'],
      at: { x: 50, y: 62 }, w: 84, h: 44, count: 14, size: 3.2, speed: 9,
      seed: 44, on: 'arcade' },
    // The line manager. `images/bosses/roachPrime.webp` is preloaded on every
    // world-4 level and until now was never once drawn; this is where it earns
    // its bytes.
    //
    // Standing over the output machine, up in the corner — and the corner is
    // the point. 4-1 has no boss in it, so it must not be in the hand-off frame;
    // the first cut switched it off at 4.3 s, in the middle of the 0.58 wide
    // shot. Up here, past the gameplay framing's short-edge half-width on BOTH
    // axes, the snap to 1.0 simply frames it out, on every screen shape.
    { kind: 'still', boss: 'roachPrime', bug: 'robobug', size: 11,
      at: { x: 118, y: -16 }, face: Math.PI * 1.2, on: 'arcade' }
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
        { t: 3100, x: PICNIC_BOOK.x, y: PICNIC_BOOK.y },
        { t: 5000, x: 69.5, y: 51.5 },
        { t: 6000, x: 69.5, y: 51.5 },
        { t: 7000, x: 40, y: 74 }
      ],
      // It does not exist for the retreat: the arcade, the attic and the
      // backyard are empty and that is the point of them.
      //
      // It crawls out from under the PAPERBACK. The first cut had it "enter
      // from off the board's east edge" at (104,33) — but beat 4's 0.58 framing
      // sees fifty units past that edge, so it was switched on in plain view. A
      // walk in from genuinely off-frame at that zoom is a hundred and twenty
      // units, which is a sprint, and the joke is a stroll. Under the book is
      // fifty units, it is somewhere an ant would actually be, and the book is
      // painted over the cast (`setCovers('picnic')`), so it is born unseen.
      when: [3100, 7000], wave: [5050, 6000], carryFrom: 5000 }
  ]
}

// ═══ 1-10 — "Seconds" ═══════════════════════════════════════════════════════

/**
 * Where the Queen lounges before she goes, and where her lunch is held up to
 * her: under her chin. She faces DOWN the screen the whole scene — towards the
 * player — because that is the way the sim will turn her on the first frame of
 * the fight, and a Queen who spins round at the hand-off is a jump cut.
 */
const QUEEN_AT: CutscenePt = { x: -4, y: -2 }
const LUNCH_AT: CutscenePt = { x: -4, y: 17 }

/**
 * Where the level spawns her, for a caller with no stage: the middle of the
 * board, a third of the way down a 16:9 one. A real run pins it (`pin`).
 */
const QUEEN_SPAWN: CutscenePt = { x: 50, y: 24 }

/** Which way she charges from `QUEEN_AT` to the authored spawn, as a heading. */
const CHARGE_HEADING = Math.atan2(QUEEN_SPAWN.y - QUEEN_AT.y, QUEEN_SPAWN.x - QUEEN_AT.x) + Math.PI / 2

/**
 * Before 1-10. The Goliath Queen was fought at HALF strength on 1-4 and comes
 * back at full strength here, and this is the six seconds that say so.
 *
 * ── The joke ──
 *
 * She eats your sandwich. The one the colony carried off the plate in 01, nine
 * levels ago, turns up again on the backs of four ants, and the Queen gets it
 * down in two bites and gets BIGGER with each — that is what "full strength"
 * looks like to a six-year-old, and it is funny rather than frightening because
 * the thing that made her dangerous is lunch. Then she looks straight at the
 * player and huffs. Then she charges.
 *
 * ── The eggs ──
 *
 * The fight's second phase is a clutch of eggs the player has to stomp before
 * they hatch, and this is the first time the player has seen one. So the scene
 * OPENS on them — a nest of them, two workers still bringing more — and the cue
 * over that first shot is `podHatch`, the sound the fight makes when an egg gets
 * away. Nobody is told anything; the eggs are simply hers, and they wobble.
 *
 * ── Why it happens in the corner ──
 *
 * 1-10's board has no nest, no eggs and no ants on it. Everything the nursery is
 * made of lives past the board's top-left corner (`LAIR_NEST`), where the snap
 * to gameplay framing leaves it behind on every screen shape. Only the Queen
 * crosses onto the board, and she lands where the level has ALREADY spawned her
 * (`pin: 'boss'`) — the last frame is the fight's first frame, crumbs and honey
 * included (`CutsceneStage`).
 */
export const REMATCH: CutsceneSpec = {
  id: 'rematch',
  world: 1,
  set: 'lair',
  beats: [
    // Close on the nest. The Queen is just out of shot to the lower right on
    // every screen shape — a leg at most — so the pull-back has something to
    // reveal. `podHatch` is the fight's own egg cue, heard first over eggs.
    { ms: 1200, ease: 'cut', camera: { x: -40, y: -36, zoom: 2.2 },
      sfx: 'podHatch',
      note: 'A nest of eggs, wobbling. Two workers are still bringing more.' },
    { ms: 1200, ease: 'inOut', camera: { x: -22, y: -11, zoom: 1.15 },
      sfx: 'slide',
      note: 'Pull back: the eggs are the QUEEN\'s. Four ants hurry the stolen sandwich up to her.' },
    // The two bites are two beats because the sandwich is a dial, and a dial
    // eases once per beat. Short, and pushed in on her face — the bite is the
    // shot.
    { ms: 450, ease: 'out', camera: { x: -4, y: 5, zoom: 1.5 },
      sfx: 'podPop', dials: { sandwich: 0.5, ease: 'linear' },
      note: 'CHOMP. Half of it gone — and she is bigger.' },
    // Back out a touch for the second bite: she is about to be half as big
    // again, and a growth that runs off the edge of the frame is not a growth.
    { ms: 550, ease: 'out', camera: { x: -4, y: 4, zoom: 1.35 },
      sfx: 'bossCharge', dials: { sandwich: 0, ease: 'linear' },
      note: 'CHOMP. All of it. Bigger again: full size.' },
    { ms: 1200, ease: 'inOut', camera: { x: -4, y: 5, zoom: 1.7 },
      sfx: 'bossPhase',
      note: 'She rears up at the camera — at YOU — and huffs. The crew bolts.' },
    // The shoe settles rather than accelerating, like every other hand-off. The
    // camera eases IN and the Queen does not, so she runs ahead of the whip-pan
    // onto the board and the camera catches up with her on her spot.
    { ms: 1200, ease: 'in', camera: { x: 50, y: 50, zoom: 1 },
      sfx: 'charge', dials: { shoe: 1, ease: 'out' },
      note: 'She charges onto the board and skids to her spot. The shoe comes down.' }
  ],
  actors: [
    // ── The Queen ──
    // A walker, because she moves; drawn from `images/bosses/queenAnt.webp`.
    //
    // SMALL to start — 10.5 against the fight's 15 — because the growth is the
    // scene. Each bite is a lunge down the screen at her lunch and a boing up a
    // size; the second overshoots and settles. Every size is scaled to the
    // stage, so on a board too short for a size-15 Queen she grows into the
    // smaller one the sim actually spawned.
    //
    // Facing down throughout (`turns`), and only turned for the charge itself:
    // the path would have pointed her at every key in a single frame, which on a
    // painting forty units across is the whole Queen spinning. She arrives facing
    // down again, which is how the sim turns her on the fight's first frame.
    { kind: 'walker', bug: 'ant', boss: 'queenAnt', pin: 'boss', step: 520,
      path: [
        { t: 0, x: QUEEN_AT.x, y: QUEEN_AT.y },
        { t: 2400, x: QUEEN_AT.x, y: QUEEN_AT.y },
        { t: 2520, x: QUEEN_AT.x, y: QUEEN_AT.y + 2.6 },
        { t: 2700, x: QUEEN_AT.x, y: QUEEN_AT.y },
        { t: 2950, x: QUEEN_AT.x, y: QUEEN_AT.y + 2.6 },
        { t: 3150, x: QUEEN_AT.x, y: QUEEN_AT.y },
        { t: 4600, x: QUEEN_AT.x, y: QUEEN_AT.y },
        // Pinned to where the level spawned her.
        { t: 5800, x: QUEEN_SPAWN.x, y: QUEEN_SPAWN.y }
      ],
      sizes: [[0, 10.5], [2420, 10.5], [2560, 13.2], [2700, 12.4], [2980, 15.9], [3160, 15]],
      turns: [[0, Math.PI], [4640, Math.PI], [4820, CHARGE_HEADING], [5500, CHARGE_HEADING], [5800, Math.PI]],
      // The rear-up — the same turn-to-camera every creature in these scenes
      // does — and a huff inside it, twice.
      wave: [3480, 4520], huff: [3600, 4480] },
    // ── The lunch ──
    // Four ants under one sandwich — the sandwich from 01, back from wherever
    // the colony took it. In from off the lower left, held under her chin for
    // both bites, and then back the way they came when she rears — fast.
    //
    // Back the way they came, and not up past the nest, which is the obvious
    // corner to hide them in: from under her chin that line runs straight across
    // her face, at the one moment the scene is about her face. Down-left clears
    // her in a body's length, and a hundred and twenty units out is past the
    // left edge of every screen's hand-off frame up to 21:9.
    { kind: 'walker', bug: 'ant', size: 2.8, step: 230, crew: 4, load: 'sandwich', carryFrom: 0,
      path: [
        { t: 0, x: -72, y: 48 },
        { t: 700, x: -72, y: 48 },
        { t: 2300, x: LUNCH_AT.x, y: LUNCH_AT.y },
        { t: 3480, x: LUNCH_AT.x, y: LUNCH_AT.y },
        { t: 4600, x: -124, y: 42 }
      ] },
    // ── The nursery ──
    // Two workers bringing the last eggs in, from past the corners of the
    // close-up, and staying at the rim once they are there — each still holding
    // its egg, which reads as setting it down.
    { kind: 'walker', bug: 'ant', size: 3, step: 260, load: 'egg', carryFrom: 0,
      path: [
        { t: 0, x: -86, y: -78 },
        { t: 1000, x: LAIR_NEST.x - 10, y: LAIR_NEST.y - 8 }
      ] },
    { kind: 'walker', bug: 'ant', size: 3, step: 260, load: 'egg', carryFrom: 0,
      path: [
        { t: 0, x: 0, y: -80 },
        { t: 1100, x: LAIR_NEST.x + 10, y: LAIR_NEST.y - 9 }
      ] },
    // …and the nurses, crawling over the clutch. The one crowd in the scene, so
    // the one thing the tier thins.
    { kind: 'swarm', bugs: ['ant'], at: { x: LAIR_NEST.x, y: LAIR_NEST.y }, w: 22, h: 16,
      count: 5, size: 2.4, speed: 5, seed: 31 }
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
  //
  // Her escort is ants and nothing else. The stinger now plays before 1-4, and
  // the sprinter does not debut until 1-5 — a player's first sight of it would
  // otherwise be one running away from a boss.
  queenAnt: { world: 1, boss: 'queenAnt', set: 'none', extras: ['ant'] },
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
  INTRO, TRAIL, INSIDE, MECHA, FINALE, REMATCH,
  bossStinger('queenAnt'), bossStinger('beetleKing'),
  bossStinger('matriarch'), bossStinger('roachPrime')
]

/**
 * The scene that plays on the way INTO level `n`, if any.
 *
 * One table rather than five conditions at the call site: 01 opens the game,
 * 02-04 open their world on its first level, and "Seconds" opens 1-10 — the
 * Queen's rematch, which her once-ever stinger has already been spent on by
 * 1-4. The finale is not here — it is not a way into a level, it is what
 * happens after the last one comes out.
 */
export const cutsceneForLevel = (n: number): CutsceneSpec | null => {
  if (n === 1) return INTRO
  if (n === 10) return REMATCH
  if (n === 11) return TRAIL
  if (n === 21) return INSIDE
  if (n === 31) return MECHA
  return null
}

/**
 * The scene a level opens on: its own, or — on a boss level with none — that
 * boss's stinger.
 *
 * One function because two callers have to agree on it: `GameScene` plays it,
 * and the art preloader warms its paintings before the level starts. A level
 * with a scene of its own never falls back to the stinger, even once that scene
 * has been watched: 1-10 replayed opens on the banner, not on a stinger 1-4
 * already played.
 */
export const openingCutscene = (n: number, boss: BossId | null): CutsceneSpec | null =>
  cutsceneForLevel(n) ?? (boss ? bossStinger(boss) : null)
