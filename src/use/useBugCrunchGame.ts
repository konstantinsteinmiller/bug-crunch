import { computed, ref, shallowRef } from 'vue'
import { perfFlag } from '@/use/perfVariants'
import {
  blowDamage, bugSpec, resolveStomp, FLIP_MS, KICK_SPEED, MAX_PUCKS, PINBALL_BOUNCES,
  PUCK_BOUNCES, PUCK_FRICTION, PUCK_PIERCE, PUCK_SPEED, PUCK_STOP_SPEED,
  type BugId, type BugSpec, type StompVerdict
} from '@/game/bugs'
import { SHOES, blowPierce, shoeSpec, STARTER_SHOE, type ShoeId, type ShoeSpec } from '@/game/shoes'
import {
  CONVEYOR_SPEED, COBWEB_HOLD_MS, HAZE_FOOT_AGILITY, HAZE_MS, HAZE_R,
  MAGNET_ARMED_MS, MAGNET_PULL, MAGNET_REACH, SALT_BURST_R, SALT_PANIC_MS,
  SALT_PANIC_SPEED, SPIKE_STUN_MS, SWEEPER_CROSS_MS, SWEEPER_REST_MS,
  hazardSpec, type HazardId
} from '@/game/hazards'
import {
  chainBreak, chainHit, chainScale, chainStep, comboMultiplier, feverReady, newChain, splatWord,
  squishScore, startFever, stepFever, juiceGain, COMBO_WINDOW_MS, FEVER, MAX_RADIUS_SCALE,
  type ChainState, type FeverState, type SplatWord
} from '@/game/combo'
import {
  ECHO_MS, QUAKE_CHARGE, QUAKE_REACH, QUAKE_SPEED, QUAKE_STUN_MS, SPIN_COOLDOWN_MS,
  SPIN_SCALE, type MoveId
} from '@/game/moves'
import {
  DRAFT_PUSH, SPRINKLER_PULL, SURGE_SPEED, TWIST_AT, twistSpec, type TwistId
} from '@/game/twists'
import {
  BEAM_HALF, BEAM_SWEEP_MS, BEAM_TELL_MS, CARRIER_WALK_MS, CHARGE_COUNTER_HITS, CHARGE_RUN_MS,
  CHARGE_TELL_MS, EGG_JUICE, EGG_LAND_U, EGG_LAY_MS, EGG_SCORE, HATCH_SCURRY_MS,
  POD_PER_BEAT, POD_SIZE, bossSpec, type BossPhase, type BossSpec
} from '@/game/bosses'
import {
  levelSpec, partySpec, worldOf, type LevelSpec, type RushShape, type RushSpec
} from '@/game/stages'
import { emptyTally, type RunTally } from '@/game/stars'
import { DEFAULT_JUICE_STYLE, type JuiceStyleId } from '@/game/juiceStyle'

/**
 * ─── The simulation ─────────────────────────────────────────────────────────
 *
 * One module owns the whole world: the foot, every body on the floor, the
 * hazards, the boss script, the chain, the vial and the clock. The renderer
 * (`useBugCrunchArt`) reads this and draws it; `GameScene.vue` feeds it input and
 * shows the HUD. Nothing here touches a canvas or the DOM.
 *
 * ── Units ──
 *
 * Everything is in **u**, the field unit: `u = min(viewportW, viewportH) / 100`.
 * The board is therefore 100 u on its short edge on every device, and an ant is
 * 2.2 u tall on a 320 px phone and on a 4K monitor alike. The scene hands us the
 * board's size in u and the rect inside it that the HUD does not cover; nothing
 * in this file knows what a pixel is.
 *
 * ── The step ──
 *
 * Fixed 60 Hz, accumulated, capped at three sub-steps per frame. Fixed because
 * the flea's leap, the charge counter-window and the chain's 1.5 s are all
 * timing the player is judged on, and a variable step makes a slow device a
 * different game. Capped because a tab that was backgrounded for a minute must
 * not run a minute of simulation the moment it returns.
 *
 * ── Allocation ──
 *
 * Bodies, pods and floating events are POOLED. The hot loop allocates nothing:
 * no closures, no temporaries, no array literals. A dense late board is ~28
 * bodies plus a boss plus a hundred particles, sixty times a second.
 */

// ─── Tuning ─────────────────────────────────────────────────────────────────

/** Fixed simulation step, ms. */
export const STEP_MS = 1000 / 60
const MAX_SUBSTEPS = 3

/** Bodies the pool can hold. The GDD's entity budget is 150; the director's own
 *  `maxAlive` never approaches it, but a boss phase that spawns on a beat while
 *  the board is already full must never fail to spawn. */
const MAX_BUGS = 160
const MAX_PODS = 12

/** How long a press must be held before it starts charging a slam, ms. A tap is
 *  already a stomp by then — see `press()`. */
export const TAP_MS = 150

/** A second press this soon after the first, and this close to it, is a heel
 *  pivot rather than a second stomp. */
export const DOUBLE_TAP_MS = 260
export const DOUBLE_TAP_U = 9

/** A partial charge below this does nothing extra on release. */
const MIN_SLAM_CHARGE = 0.34

/* The heel pivot's reach and cooldown are the Heel Spin's now — `SPIN_SCALE`
 * and `SPIN_COOLDOWN_MS` in `game/moves.ts` — because it is a trophy, not a
 * panic button every double tap used to set off. */

/** How far above the finger the foot rides on touch, u.
 *
 *  The single most important number for the mobile feel. Without it the thumb
 *  covers the exact spot the player is aiming at, which on a 320 px phone is
 *  most of the target. Zero on a mouse, where the cursor is a point. */
export const TOUCH_LIFT_U = 11

/** Single-Tap Mode: how far a tap may reach for the nearest body, u. */
const AUTO_AIM_U = 26

/**
 * How far a TOUCH tap reaches for the body it nearly hit, u.
 *
 * ── Why a finger needs this and a mouse does not ──
 *
 * The lift above puts the foot 11 u over the fingertip, which is right for a
 * player who DRAGS the shoe and wrong for the one the game actually gets: five
 * blind testers all TAPPED, at the bug, the way anyone taps a mole. Measured
 * against this build, the zone of taps that kill an ant then sits 43 px BELOW
 * the ant on a 390 px phone — 10 px of room above it, 84 below — so a tap that
 * reads as dead centre misses by two units, and a miss looks exactly like a hit.
 *
 * Fourteen units is a fingertip at phone scale (≈ 55 px) and half a lift plus a
 * body. It is deliberately SHORTER than Single-Tap Mode's reach: this one rescues
 * a tap that was already aimed at a bug, where that one plays the aiming.
 */
const TOUCH_SNAP_U = 14

/** Each press during a spike stun knocks this much off it, ms. */
const STUN_SHAKE_MS = 260

/** A dodger notices the shadow inside this many multiples of its own size, and
 *  leaps this far after this long. */
const DODGE_SENSE = 5.2
const DODGE_TELL_MS = 250
const DODGE_LEAP_U = 17
const DODGE_LEAP_MS = 300

// ─── The sprinter's bolt ────────────────────────────────────────────────────
//
// The flea's dodge and the sprinter's bolt share the `sense` clock — which is
// what makes them share the "!" the renderer already pops over a body that is
// about to move — and nothing else. See `BugSpec.sprints` for the design split.
// Every number below is chosen against the flea's so the two read as different
// creatures rather than as one creature with two speeds.

/** How far a sprinter notices a shoe, in multiples of its own size, on top of
 *  the shoe's shadow radius. 6.0 × 3.0 u + a sneaker's 9 u ≈ 27 u, against the
 *  flea's ≈ 24: it gives ground EARLY, where the flea waits. */
const SPRINT_SENSE = 6.0

/**
 * …but only while the shoe is actually COMING FOR IT.
 *
 * This is the whole counter-play and the reason the bug is fair. A shoe parked
 * next to a sprinter never spooks it; a shoe travelling toward it at more than
 * `SPRINT_APPROACH_U_S`, within `SPRINT_APPROACH_DOT` of straight at it, does.
 * So the answer a player learns is "stop moving, then tap" — which is a skill a
 * six-year-old can execute, unlike out-reacting a flea.
 */
const SPRINT_APPROACH_U_S = 9
const SPRINT_APPROACH_DOT = 0.3

/**
 * The tell, ms. Longer than the flea's 250 on purpose.
 *
 * The renderer pops its alert at `sense > 60`, so this is ~260 ms of visible
 * warning against the flea's ~190. At 250 the first pass read as "the ant
 * teleported"; at 320 a child watching the board sees the mark, and the bug
 * becomes a thing you can learn instead of a thing that happens to you.
 */
const SPRINT_TELL_MS = 320

/**
 * The run: this far, over this long — 24 u in 500 ms, so 48 u/s.
 *
 * Against the flea's 17 u in 300 ms (57 u/s): the sprinter is SLOWER and goes
 * 40 % further over 65 % more time. That difference is the whole read. A leap
 * is a thing that has already happened by the time you notice; a run is a thing
 * you watch, and watching it is what lets a player aim at where it will stop.
 *
 * And it is dead straight away from the foot — the flea's leap adds ±0.6 rad of
 * randomness and this adds none, because a hook the player cannot predict is
 * not a hook, it is noise.
 */
const SPRINT_RUN_U = 24
const SPRINT_RUN_MS = 500

/**
 * …and then it stops DEAD, winded, for this long.
 *
 * Carried on `stun`, which already means "cannot move, and the renderer wobbles
 * it" — so the pause costs no new state and already looks like what it is. This
 * pause IS the kill: it is nearly half a second of a stationary, unarmoured,
 * one-hit body, which is why a sprinter is CHEAPER than an ant to a player who
 * has understood it and more expensive to one who chases.
 */
const SPRINT_WINDED_MS = 450

/** Lockout after a bolt ends, ms. For these two-and-a-bit seconds it is just an
 *  ant, which is what stops a panicking child from herding one across the whole
 *  board with a spray of taps. */
const SPRINT_COOLDOWN_MS = 2400

/**
 * A stomp that lands this far from a sprinter — as a multiple of the blow's own
 * radius — scares it into a bolt.
 *
 * This is the TOUCH rule the whole design is built around: a finger has no
 * hover, so on a phone there is no "the shoe is coming for it" to sense. What
 * there is, is a tap that landed beside it rather than on it, and that is
 * exactly the moment a real ant bolts. The band runs from the edge of the kill
 * circle out to 2.2 × the radius — about three body-widths of "nearly".
 *
 * It fires on a mouse too. A stomp is loud on any device, and one bug with one
 * behaviour is worth more than a bug that is two different bugs per platform.
 */
const SPRINT_SCARE_SCALE = 2.2

/**
 * …and the tell a scared sprinter still gets before it goes, ms.
 *
 * Short, because the player has already been given a warning — their own tap,
 * landing next to the thing. But not zero: a body that moves on the same frame
 * as the stomp reads as a bug in the game rather than a bug on the floor, and
 * this is the only window a touch player ever gets to see the "!" that a
 * pointer player sees for 320 ms.
 */
const SPRINT_SCARE_TELL_MS = 140

/** How long a body is stunned by a steel boot's slam. */
const STUN_FADE_MS = 140

/** Centipede tail spacing, u, and how many path samples the head keeps. */
const SEG_GAP = 2.4
const TRAIL_LEN = 96

/** A slide damages everything it crosses; this is how often it may register a
 *  new hit on the SAME body, ms. Without it a slide over one flea is forty
 *  hits. */
const SLIDE_REHIT_MS = 220

/** How much of the board's short edge a spawn starts outside it, u. */
const SPAWN_MARGIN = 6

// ─── Rush Lines ─────────────────────────────────────────────────────────────

/** The snare roll: the trail draws itself and the board holds its breath, ms. */
export const RUSH_TELL_MS = 1100
/** The breather after a rush lands, while the director stays quiet, ms. */
const RUSH_LULL_MS = 1400
/**
 * Nose-to-tail spacing down the lane, centre to centre, in body RADII (`size`).
 * 2.2 is a hair's gap between two ants — tight enough that a sneaker stomp in
 * the middle of the line (9 u plus each ant's own 3.2) reaches three or four of
 * them, loose enough that the line still reads as bodies rather than a rope.
 */
const RUSH_GAP = 2.2
/** A rush never fires in the first seconds of a level: the banner is still up
 *  and the player has not found the shoe yet. */
const RUSH_EARLIEST_MS = 2000
/** How far the lane keeps from the foot's own row, u — a conga that walks
 *  straight into a parked shoe is a free kill, not a set piece. */
const RUSH_CLEAR_U = 20
/** The ring formation: its radius round the shoe, u, and how fast it closes. */
const RUSH_RING_R = 34
const RUSH_RING_SPEED = 0.6

// ─── Big Finish ─────────────────────────────────────────────────────────────

/** How long the board keeps moving after the whole level is won, ms — the tap
 *  finisher's scatter, and the frame the celebration is drawn over. */
const AFTERGLOW_MS = 900
/**
 * …and the longer one a BOSS gets, ms.
 *
 * The boss's own death animation is 1.2 s of squash, roll and fade (`dying`, in
 * `useBugCrunchArt`'s section 5), and the four beats the renderer stages over it
 * run to ~430 ms of EFFECT time — which, inside the death's own slow motion, is
 * the better part of a second and a half of wall clock. An afterglow shorter
 * than the animation it exists to run would freeze the queen halfway through
 * falling over, which is the bug this replaced.
 *
 * `GameScene`'s `CELEBRATE_MS` is held to the same number, so nothing covers the
 * ending before it has finished happening.
 */
export const BOSS_AFTERGLOW_MS = 1700
/** From world 3 the gilded last body runs from a shoe inside this, u. */
const FINALE_FLEE_U = 30
/** Coins a slam finisher pays: one per this many bodies, up to the cap. */
const FINISH_COIN_PER = 3
const FINISH_COIN_CAP = 10

// ─── Growth Spurt ───────────────────────────────────────────────────────────

/** The shoe chases its chain's size — up in ~120 ms (a boing), down in ~260 ms
 *  (a deflate the eye can follow). Time constants, ms. */
const GROW_UP_MS = 120
const GROW_DOWN_MS = 260

// ─── Shoebox Trials ─────────────────────────────────────────────────────────

/** How long the foot wears the shoe in the box, ms. */
export const TRIAL_MS = 12_000
/** A box for a player who owns every shoe holds gilded laces: a Fever this
 *  long, and the vial untouched. */
const LACES_MS = 6000
/** A dropped box keeps this far from the foot, u. */
const BOX_CLEAR_U = 18

// ─── Types ──────────────────────────────────────────────────────────────────

export type FootState =
  | 'hover' | 'charge' | 'drop' | 'impact' | 'recover' | 'slide' | 'stun' | 'pivot'

export interface Foot {
  /** Where the shoe is, u. */
  x: number
  y: number
  /** Where the player is pointing, u — the spring's target. */
  tx: number
  ty: number
  /** Height, 0 (sole on the floor) .. 1 (fully raised). */
  z: number
  /** Travel direction, radians, used to turn the shoe and smear a slide splat. */
  heading: number
  /** Speed, u/s — drives the splat's stretch. */
  speed: number
  state: FootState
  /** ms left in the current state, where the state has a clock. */
  timer: number
  /** 0..1 slam charge. */
  charge: number
  /** Impact squash, 1 at rest. */
  squash: number
}

export interface Bug {
  alive: boolean
  id: BugId
  spec: BugSpec
  x: number
  y: number
  vx: number
  vy: number
  /** Damage taken. */
  dmg: number
  /** Walk-cycle position, 0..1. */
  cycle: number
  /** Facing, radians. */
  heading: number
  /** Behaviour clock, ms. */
  t: number
  /**
   * How long this body has been about to move.
   *
   * Shared by the flea and the sprinter, and read by the renderer, which pops
   * the "!" once it is over 60 ms. Negative means a flea is mid-leap and its
   * launch velocity owns it; the renderer's `> 60` guard skips that.
   */
  sense: number
  /** Sprinter: ms of bolt still running. */
  bolt: number
  /** Sprinter: ms before it may bolt again. Ticks through the run and the
   *  winded pause, so the lockout is measured from the END of the last one. */
  boltCd: number
  /** ms of stun left. */
  stun: number
  /** ms of hold (cobweb) left. */
  held: number
  /** ms of salt panic left. */
  panic: number
  /** Airborne bodies are only stompable while `dip` is high. */
  dip: number
  /** When this body was last hit by the current slide. */
  lastSlide: number
  /** Centipede: how many segments trail it, and the head's path history. */
  segs: number
  trail: Float32Array | null
  trailN: number
  /** Piñata fly: a per-body phase so two of them do not zig together. */
  phase: number
  /** Boss add bookkeeping: spawned by the boss, so a phase can count them. */
  fromBoss: boolean
  /** A CARRIER: an ant walking a boss egg onto the board over its head. It sets
   *  it down after `CARRIER_WALK_MS`, and a stomp on the way pops the egg too. */
  carry: boolean
  /** Came out of an egg — what `hatchlingCap` counts. */
  hatched: boolean
  /**
   * ms left marching down a Rush Line. While it runs the body keeps the lane's
   * heading (no wandering off the conga) and is allowed to walk in from past the
   * board's edge. When it runs out — or the body leaves the far side and turns
   * back — it is an ordinary body again.
   */
  rush: number
  /** Its speed while it marches, as a multiple of its own: a V walks at its
   *  point's pace, or the ants behind a beetle would overtake it. */
  rushK: number
  /** Which rush it came in with, 0 for none — so a sprinter line bolts as ONE. */
  rushId: number
  /** Carrying a crumb of the sandwich over its head. The intro's raid, still
   *  going: the renderer draws it, nothing else reads it. */
  crumb: boolean
  /** ms on its back, legs waving — Beetle Bowling. A tap kills it outright. */
  flipped: number
  /** Kicked, and rolling across the floor as a bowling ball. */
  puck: boolean
  /** Edge rebounds a puck has used. */
  bounces: number
  /** When a puck last hit this body, sim ms — so one roll is one blow. */
  lastPuck: number
  /** Frozen by a twist's payoff (the blackout's lights coming back), ms. */
  frozen: number
}

/**
 * A boss egg on the floor — every boss fight's, not only a `pods` phase's. See
 * "The brood" in `bosses.ts`.
 *
 * Still called a pod, because the scene, the tutorial and the recorder's
 * autopilot all read `getPods()` and `alive / x / y / t` off it; the fields
 * below are additions, never changes.
 */
export interface Pod {
  alive: boolean
  /** Where it lands and lies, u — the stomp is resolved here. */
  x: number
  y: number
  /** ms until it hatches. Frozen at 0 while the board has no room for its ants. */
  t: number
  /** The clock it started on, ms — the scaled boss's, so the renderer's crack
   *  stage reads the same 0..1 on 1-4 as on 1-10. */
  hatchMs: number
  /** ms left of the hop from where it was laid. While it flies it can be
   *  neither stomped nor hatched, and the renderer draws it along the arc. */
  fly: number
  /** The hop's length, ms, and where it started. */
  flyMs: number
  fromX: number
  fromY: number
  /** 0..1, stable for the egg's life — its wobble phase and its shell's angle. */
  seed: number
}

export interface Hazard {
  id: HazardId
  x: number
  y: number
  /** Size in u — `hazardSpec(id).size` unless the level scaled it. */
  r: number
  /** Radians, for the directional ones. */
  angle: number
  /** Animation phase, 0..1. */
  phase: number
  /** Magnet: ms of arming left. Salt: 0 unspent, >0 bursting, -1 spent. */
  charge: number
  /** Sweeper: 0..1 along its run, and which way it is going. */
  travel: number
  dir: 1 | -1
  /** A stable per-instance seed, so its wobble never changes. */
  seed: number
  /** The shoebox: the shoe inside it. */
  shoe?: ShoeId
  /** The slick lane: half its length over its half-width (see `PropState`). */
  stretch?: number
}

export interface Haze {
  alive: boolean
  x: number
  y: number
  t: number
}

/** One thing that happened this step, for the renderer and the audio to read. */
export type GameEvent =
  | { k: 'squish'; x: number; y: number; bug: BugId; heavy: boolean; word: SplatWord; mult: number; stretch: number; angle: number; face: number }
  // `heavy` on the two wound cues is for the crush bank: a slam that cracks a
  // shell cracks it further, and sounds it. A clang with no `bug` rang off the
  // boss's own body — the scene knows which boss is on the board.
  | { k: 'hurt'; x: number; y: number; bug: BugId; heavy: boolean }
  | { k: 'clang'; x: number; y: number; bug?: BugId; heavy?: boolean }
  | { k: 'spike'; x: number; y: number }
  | { k: 'stomp'; x: number; y: number; r: number; heavy: boolean; hit: boolean }
  | { k: 'miss'; x: number; y: number }
  | { k: 'pivot'; x: number; y: number; r: number }
  | { k: 'fever'; x: number; y: number }
  | { k: 'feverEnd' }
  | { k: 'coin'; x: number; y: number; n: number }
  | { k: 'chain'; n: number; mult: number; step: boolean }
  // `mult` is the rung that was lost — Growth Spurt only deflates audibly from ×3.
  | { k: 'chainLost'; mult?: number }
  // One stomp squished `n` ≥ 2 bodies.
  | { k: 'multi'; x: number; y: number; n: number }
  // ── Rush Lines ──
  | { k: 'rushTell'; x0: number; y0: number; x1: number; y1: number; shape: RushShape; practice?: MoveId }
  | { k: 'rushGo'; x: number; y: number }
  // ── Big Finish ──
  | { k: 'finishReady' }
  | { k: 'finisher'; x: number; y: number; n: number; heavy: boolean }
  // ── Beetle Bowling ──
  | { k: 'flip'; x: number; y: number; bug: BugId }
  | { k: 'kick'; x: number; y: number }
  | { k: 'pins'; x: number; y: number; n: number }
  // ── Shoebox Trials ──
  | { k: 'boxDrop'; x: number; y: number }
  | { k: 'boxHit'; x: number; y: number; left: number }
  | { k: 'boxPoof'; x: number; y: number }
  | { k: 'trial'; shoe: ShoeId | null; x: number; y: number }
  | { k: 'trialEnd'; shoe: ShoeId | null }
  // ── Boss Trophies ──
  | { k: 'quake'; x: number; y: number }
  | { k: 'echo'; x: number; y: number; r: number }
  // ── Uh-oh! Twists ──
  | { k: 'twistTell'; id: TwistId }
  | { k: 'twistStart'; id: TwistId }
  | { k: 'twistEnd'; id: TwistId }
  | { k: 'salt'; x: number; y: number }
  | { k: 'magnet'; x: number; y: number }
  | { k: 'sweep'; x: number; y: number }
  | { k: 'bossHit'; x: number; y: number; counter: boolean }
  | { k: 'bossPhase'; n: number }
  | { k: 'bossDown'; x: number; y: number }
  // An egg popped is paid like a kill, so it carries the kill's word and rung.
  | { k: 'podPop'; x: number; y: number; mult: number; word: SplatWord }
  // `n` ants came out of it.
  | { k: 'podHatch'; x: number; y: number; n: number }
  // A laid egg's hop has touched down.
  | { k: 'podLand'; x: number; y: number }
  | { k: 'chain-arc'; x0: number; y0: number; x1: number; y1: number }
  // `x`/`y` is the blow that ended it — the squash that met the quota, the
  // finisher's own footfall, or the boss's body. The win beat's camera pushes
  // in on it; see `game/winBeat.ts`.
  | { k: 'end'; won: boolean; x: number; y: number }

export interface Boss {
  spec: BossSpec
  x: number
  y: number
  vx: number
  vy: number
  size: number
  /** Which phase, 0-based. */
  phase: number
  /** Hits taken in the current phase. */
  hits: number
  /** The script's beat clock, ms. */
  beat: number
  /** Sub-state for the scripts that have one. */
  sub: 'idle' | 'tell' | 'windup' | 'run' | 'spent' | 'spin' | 'beam'
  subT: number
  /** Where a charge or a beam is aimed, radians. */
  aim: number
  /** ms of invulnerability left after a hit, so one slam is one hit. */
  iframe: number
  /** Pods cleared this phase. */
  podsDown: number
  /** ms since the last clutch of the brood. */
  eggClock: number
  /** ms left of the squat a laying boss makes as an egg leaves it — the
   *  renderer's, nothing reads it in the sim. */
  laying: number
  /** Alive, or playing its death. */
  alive: boolean
  /** Death animation clock, ms. */
  dying: number
}

export interface Board {
  /** The whole canvas, in u. */
  w: number
  h: number
  /** The rect the HUD does not cover — where bodies live and the foot can go. */
  x0: number
  y0: number
  x1: number
  y1: number
}

export type Phase = 'intro' | 'play' | 'won' | 'lost'

// ─── Pools ──────────────────────────────────────────────────────────────────

const makeBug = (): Bug => ({
  alive: false, id: 'ant', spec: bugSpec('ant'),
  x: 0, y: 0, vx: 0, vy: 0, dmg: 0, cycle: 0, heading: 0, t: 0,
  sense: 0, bolt: 0, boltCd: 0, stun: 0, held: 0, panic: 0, dip: 0, lastSlide: -1e9,
  segs: 0, trail: null, trailN: 0, phase: 0, fromBoss: false, carry: false, hatched: false,
  rush: 0, rushK: 1, rushId: 0, crumb: false, flipped: 0, puck: false, bounces: 0, lastPuck: -1e9, frozen: 0
})

const bugs: Bug[] = Array.from({ length: MAX_BUGS }, makeBug)
const pods: Pod[] = Array.from({ length: MAX_PODS }, () => ({
  alive: false, x: 0, y: 0, t: 0, hatchMs: 1, fly: 0, flyMs: 1, fromX: 0, fromY: 0, seed: 0
}))
const hazes: Haze[] = Array.from({ length: 8 }, () => ({ alive: false, x: 0, y: 0, t: 0 }))
let hazards: Hazard[] = []

/** Live bodies, compacted at the top of the pool so the draw loop can stop at
 *  `bugCount` instead of scanning 160 slots. */
let bugCount = 0

const events: GameEvent[] = []

// ─── Reactive HUD surface ───────────────────────────────────────────────────
//
// Deliberately small. Every one of these is read by a Vue template sixty times
// a second in the worst case, so the set is exactly what the HUD shows and
// nothing else — the bodies, the foot and the hazards are plain objects the
// renderer reads directly, never refs.

export const score = ref(0)
export const chainCount = ref(0)
export const chainMult = ref(1)
/**
 * 0..1 of the chain window left. Published as a ref rather than recomputed by
 * the HUD, because only the sim knows the window and the ring that draws it has
 * to be right on the frame the chain lapses.
 *
 * QUANTISED to 1/24ths for the same reason `timeLeft` prints whole seconds: it
 * is a thin ring on a HUD chip, and a fresh float every frame re-rendered the
 * whole HUD sixty times a second for the whole of a chain — which is most of
 * the time a good player spends in a level. A 1.5 s window drains in 24 steps
 * of 4 %, and the frame the chain lapses is still exact, because a lapse goes
 * through `syncChain` and writes 0.
 */
export const chainLeft = ref(0)
/** Steps the chain ring is drawn in. See `chainLeft`. */
const CHAIN_RING_STEPS = 24

/**
 * The A/B seam for both HUD quantisations — `PERF-LEDGER.md`, and read at
 * module scope exactly as `perfVariants` requires. The flag names the OLD arm,
 * so the shipping path is the quantised one.
 *
 * With it set, every frame writes a fresh float into both refs, which is what
 * the build before this change did.
 */
const HUD_LEGACY_PER_FRAME = perfFlag('hud-per-frame-legacy')

/** Write the chain ring, quantised — see `chainLeft`. */
const setChainRing = (raw: number): void => {
  const v = Math.max(0, raw)
  if (HUD_LEGACY_PER_FRAME) { chainLeft.value = v; return }
  const stepped = Math.round(v * CHAIN_RING_STEPS) / CHAIN_RING_STEPS
  if (stepped !== chainLeft.value) chainLeft.value = stepped
}
/** Heavy slams landed this level. The tutorial's third beat reads it, and so
 *  does nothing else — it is a counter, not a mechanic. */
export const slams = ref(0)
export const juice = ref(0)
export const feverMs = ref(0)
/**
 * Seconds left, as a WHOLE number — what the clock chip prints.
 *
 * The sim's own clock is `clockMs` below, a float in milliseconds. This ref is
 * only written when the printed second changes, roughly once a second instead
 * of sixty times, because every write re-renders the whole HUD: `SplatHud`, the
 * quest badges, the vial and the chest all sit under one component that reads
 * it, and a 20 s profile of a 6×-throttled phone spent ~3.2 s in Vue re-renders
 * against ~2.2 s in the renderer that draws the actual game.
 *
 * Consumers that need the real clock (the tally the stars are scored from) read
 * `clockMs`, so nothing rounds twice and no star moved when this changed.
 */
export const timeLeft = ref(0)
/** The clock the level actually runs on: milliseconds, float, never a ref. */
let clockMs = 0
export const squished = ref(0)
export const quota = ref(0)
export const phase = ref<Phase>('intro')
export const bossHp = ref(1)
export const bossPhaseIndex = ref(0)
export const bossTell = ref<string | null>(null)
/** Boss egg pods stomped this level. Like `slams`, a counter for the tutorial —
 *  the pods lesson retires on the first one — and nothing else. */
export const podsPopped = ref(0)
export const pivotReady = ref(true)
/**
 * The one-to-go hold of a Big Finish: every body on the board is gilded and the
 * next squish ends the level. Read by the renderer (the gold rims) and by the
 * scene (the heartbeat, the lessons). A ref because it flips twice a level.
 */
export const finale = ref(false)
/** The shoe the player is trialling out of a Shoebox, or null. `laces` is the
 *  gilded-laces box for a player who owns every shoe. */
export const trialShoe = ref<ShoeId | 'laces' | null>(null)

/** The live tally the objective strip reads and the result screen grades. */
export const tally = shallowRef<RunTally>(emptyTally())

export const feverRunning = computed(() => feverMs.value > 0)
export const feverCharged = computed(() => feverMs.value <= 0 && juice.value >= 1)

// ─── Module state ───────────────────────────────────────────────────────────

let board: Board = { w: 100, h: 100, x0: 0, y0: 0, x1: 100, y1: 100 }
let level: LevelSpec = levelSpec(1)
let shoe: ShoeSpec = shoeSpec(STARTER_SHOE)
let juiceStyle: JuiceStyleId = DEFAULT_JUICE_STYLE
let singleTap = false
let boss: Boss | null = null
let chain: ChainState = newChain()
let fever: FeverState = { juice: 0, remainMs: 0 }
let elapsed = 0
let spawnAcc = 0
let pivotCd = 0
let slideId = 0
let touch = false
let difficulty = 1
let relief = 1
let running = false

// ── Growth Spurt ──
/** The shoe's size right now, as a multiple of its own radius: eased toward
 *  `chainScale` of the live chain. 1 with no chain. */
let growth = 1

// ── Rush Lines ──
let rushIdx = 0
let rushPhase: 'idle' | 'tell' | 'lull' = 'idle'
let rushT = 0
let rushSerial = 0
let rushCur: RushSpec | null = null
const rushLane = { x0: 0, y0: 0, x1: 0, y1: 0, heading: 0 }
/** ms the sugar trail stays on the floor after it is drawn — the renderer's. */
let rushTrailMs = 0

// ── Big Finish ──
let finisherHeavy = false
let finisherX = 0
let finisherY = 0
/**
 * Where the last body died — the shot the win beat pushes the camera in on.
 *
 * `finisherX/Y` is not this and cannot be: it is only written on a level with a
 * Big Finish (`hasFinish` — no boss, no party, quota > 1), so a quota-of-one
 * level, a party and every boss fight would hand the camera the middle of the
 * board. This is written by every squish that counts, so `finish` always has a
 * point to look at. Seeded to the board's centre for the one frame before the
 * first kill of a level.
 */
let lastKillX = 50
let lastKillY = 50
/** ms of board still moving after a won level. See `AFTERGLOW_MS`. */
let afterglow = 0

// ── Shoebox Trials ──
let trialDropped = false
let trialMs = 0
let baseShoe: ShoeSpec = shoeSpec(STARTER_SHOE)
/** A shoe swap waiting for the foot to be free — see `applyPendingShoe`. */
let pendingShoe: ShoeSpec | null = null
let ownedShoes: readonly ShoeId[] = [STARTER_SHOE]
/** A vial held aside while a Fever that was not bought with it runs — a party's
 *  or the gilded laces'. Put back the moment that Fever ends. */
let heldJuice: number | null = null
/**
 * A full vial waiting to be spent.
 *
 * Fever fires ITSELF now, so the flag is what keeps that from happening in the
 * one place where it would be wasted: a vial handed over full (So Close!, or
 * carried in from the level before) at the instant a level opens, with nothing
 * on the floor to stomp. It arms at the fill and spends on the first frame that
 * has a body or a boss to spend it on.
 */
let feverArmed = false

// ── Boss Trophies ──
let moves: readonly MoveId[] = []
const hasMove = (m: MoveId): boolean => moves.includes(m)
const quake = { active: false, x: 0, y: 0, r: 0 }
const echo = { at: -1, x: 0, y: 0, r: 0 }

// ── Uh-oh! Twists ──
let twistPhase: 'idle' | 'tell' | 'active' | 'after' | 'done' = 'idle'
let twistT = 0
/** The sprinkler's wet stripe and the draught's direction, per level. */
let twistStripeY = 0
let twistDrift = 0
/** The conveyor's speed multiplier — 1, or the surge's reverse, or 0 stopped. */
let conveyorK = 1

// ── Bug Party ──
const partyAt = { x: 50, y: 20 }

/** Kills landed by the stomp being resolved right now — see `land`. */
let stompKills = 0
let inStomp = false
/** Force the next blows to kill whatever they land on — the slam finisher. */
let forceKill = false
/** The blows being resolved cannot spike the player — a rolling puck's. */
let spikeSafe = false
/** Sim ms since the last squish: the vial only bleeds after a grace. */
let sinceSquish = 0

const foot: Foot = {
  x: 50, y: 50, tx: 50, ty: 50, z: 0.36, heading: -Math.PI / 2,
  speed: 0, state: 'hover', timer: 0, charge: 0, squash: 1
}

// A deterministic PRNG, so a recorded run and a replayed one draw the same
// spawns. Seeded per level; `Math.random` is never called in the step.
let rngState = 1
const rnd = (): number => {
  rngState = (rngState * 1664525 + 1013904223) >>> 0
  return rngState / 4294967296
}
const rndRange = (a: number, b: number): number => a + (b - a) * rnd()

// ─── Readers for the renderer ───────────────────────────────────────────────

export const getFoot = (): Foot => foot
export const getBugs = (): Bug[] => bugs
export const getBugCount = (): number => bugCount
export const getPods = (): Pod[] => pods
export const getHazards = (): Hazard[] => hazards
export const getHazes = (): Haze[] => hazes
export const getBoss = (): Boss | null => boss
export const getBoard = (): Board => board
export const getLevel = (): LevelSpec => level
export const getShoe = (): ShoeSpec => shoe
export const getJuiceStyle = (): JuiceStyleId => juiceStyle
export const isFever = (): boolean => fever.remainMs > 0
export const isTouchInput = (): boolean => touch

/** The Rush Line the renderer draws: the lane, where in its life it is (0..1
 *  of the trail's fade), and whether it is still being told. */
export interface RushView {
  x0: number; y0: number; x1: number; y1: number
  shape: RushShape
  /** 0..1 through the tell — the trail drawing itself. 1 once it has landed. */
  tell: number
  /** 1 while fresh, falling to 0 as the trail fades. */
  life: number
}
const rushView: RushView = { x0: 0, y0: 0, x1: 0, y1: 0, shape: 'line', tell: 0, life: 0 }
export const getRush = (): RushView | null => {
  if (!rushCur || (rushPhase === 'idle' && rushTrailMs <= 0)) return null
  rushView.x0 = rushLane.x0
  rushView.y0 = rushLane.y0
  rushView.x1 = rushLane.x1
  rushView.y1 = rushLane.y1
  rushView.shape = rushCur.shape
  rushView.tell = rushPhase === 'tell' ? Math.min(1, rushT / RUSH_TELL_MS) : 1
  rushView.life = rushPhase === 'tell' ? 1 : Math.max(0, Math.min(1, rushTrailMs / 4000))
  return rushView
}

/** The Shoebox Trial's clock, 0..1 left, or 0 when none is running. */
export const trialLeft = (): number => (trialShoe.value ? Math.max(0, trialMs / TRIAL_MS) : 0)

/** The Quake Slam's ring, while it travels. */
export const getQuake = (): { x: number; y: number; r: number } | null => (quake.active ? quake : null)

/** Which twist is on, and where in its life: the renderer's grade and pictogram. */
export interface TwistView {
  id: TwistId
  phase: 'tell' | 'active' | 'after'
  /** 0..1 through the current phase. */
  k: number
  stripeY: number
  drift: number
}
const twistView: TwistView = { id: 'spill', phase: 'tell', k: 0, stripeY: 0, drift: 0 }
export const getTwist = (): TwistView | null => {
  const id = level.twist
  if (!id || twistPhase === 'idle' || twistPhase === 'done') return null
  const t = twistSpec(id)
  twistView.id = id
  twistView.phase = twistPhase
  const span = twistPhase === 'tell' ? t.tellMs : twistPhase === 'active' ? t.activeMs : Math.max(1, t.afterMs)
  twistView.k = Math.max(0, Math.min(1, twistT / span))
  twistView.stripeY = twistStripeY
  twistView.drift = twistDrift
  return twistView
}

/** Where a Bug Party pours out of — the stolen sandwich. */
export const getPartyAt = (): { x: number; y: number } | null => (level.party ? partyAt : null)

/** The shoe's size multiplier from the chain right now — Growth Spurt. */
export const getGrowth = (): number => growth

/** Drain the step's events. The caller owns them for exactly one frame. */
export const drainEvents = (): GameEvent[] => {
  if (events.length === 0) return events
  const out = events.slice()
  events.length = 0
  return out
}

const emit = (e: GameEvent): void => { events.push(e) }

// ─── Setup ──────────────────────────────────────────────────────────────────

export interface StartOptions {
  level: number
  shoe: ShoeId
  juiceStyle: JuiceStyleId
  singleTap: boolean
  /** Difficulty multiplier from the options screen: 0.8 / 1 / 1.25. */
  difficulty: number
  /**
   * One-shot relief for a level the player has already failed.
   *
   * Applied to bug SPEED and to the clock, never to the quota: slowing the board
   * down helps the player who could not keep up, while shrinking the quota would
   * hand them the level and quietly delete the objective they were failing.
   *
   * It is a number ABOVE one, so the clock MULTIPLIES by it and bug speed
   * DIVIDES by it. Multiplying both once made every retry's bugs faster.
   */
  relief: number
  /** Deterministic seed. The recorder pins it; play passes the level id. */
  seed?: number
  /** Boss Trophies the player owns. Absent is none — the double-tap is then just
   *  two stomps, which is what it is until the Queen on 1-4 is beaten. */
  moves?: readonly MoveId[]
  /** Shoes the player owns, so a Shoebox never offers one they already have. */
  owned?: readonly ShoeId[]
  /** So Close!: the retry of a near miss opens with the vial full. */
  secondWind?: boolean
  /** A Bug Party rather than a level — `partySpec(level)`, the party after it. */
  party?: boolean
}

/** Tell the sim how big the board is, in u, and which part the HUD leaves free. */
export const setBoard = (b: Board): void => {
  board = b
  // Keep the foot inside a board that just got smaller (a rotation, a resize).
  foot.x = clamp(foot.x, b.x0, b.x1)
  foot.y = clamp(foot.y, b.y0, b.y1)
  foot.tx = clamp(foot.tx, b.x0, b.x1)
  foot.ty = clamp(foot.ty, b.y0, b.y1)
}

export const setTouch = (v: boolean): void => { touch = v }

export const startLevel = (o: StartOptions): void => {
  level = o.party ? partySpec(o.level) : levelSpec(o.level)
  shoe = shoeSpec(o.shoe)
  baseShoe = shoe
  pendingShoe = null
  moves = o.moves ?? []
  ownedShoes = o.owned ?? [STARTER_SHOE]
  juiceStyle = o.juiceStyle
  singleTap = o.singleTap
  difficulty = o.difficulty
  // A party cannot be lost, so it has nothing to be relieved of — and a longer
  // clock would only be a longer Fever.
  relief = o.party ? 1 : o.relief
  rngState = (o.seed ?? level.id * 7919 + 13 + (o.party ? 101 : 0)) >>> 0

  for (let i = 0; i < bugs.length; i++) bugs[i]!.alive = false
  for (const p of pods) { p.alive = false; p.fly = 0 }
  for (const h of hazes) h.alive = false
  bugCount = 0
  events.length = 0

  chain = newChain()
  // ── The vial CARRIES between levels ──
  //
  // It used to reset, and that quietly threw away the best moment the meter has:
  // the last kill of a level is very often the one that fills it, and a player
  // who earned a Fever and watched the result screen eat it learns that filling
  // the vial near the end is worthless. Carrying it means the reward always
  // arrives — sometimes as the opening of the next level, which is a better
  // place for it anyway. Only the RUNNING fever is cleared; a level never
  // inherits somebody else's ten seconds.
  fever = { juice: heldJuice ?? fever.juice, remainMs: 0 }
  heldJuice = null
  // ── So Close! ── A near miss's retry opens with the vial full: the push the
  // last run was one push short of. Only ever FILLS it — a player who carried a
  // full vial in already has one.
  if (o.secondWind) fever = { juice: 1, remainMs: 0 }
  // ── Bug Party ── The gilded boot for the whole fifteen seconds, and the
  // player's own vial set aside and handed back afterwards: the party is a gift,
  // never a thing that spent something of theirs.
  if (level.party) {
    heldJuice = fever.juice
    fever = { juice: 0, remainMs: level.time * 1000 }
  }
  // A vial that arrives full — carried in, or handed over by So Close! — is
  // already armed, and spends itself on the first frame with a body on the floor.
  feverArmed = feverReady(fever) && fever.remainMs <= 0
  elapsed = 0
  spawnAcc = 0
  pivotCd = 0
  slideId = 0
  boss = null
  growth = 1
  rushIdx = 0
  rushPhase = 'idle'
  rushT = 0
  rushCur = null
  rushTrailMs = 0
  finisherHeavy = false
  afterglow = 0
  // Back to the middle of the board: a level that ends before anything dies —
  // a timeout, a party — must not aim the win beat at the last level's corner.
  lastKillX = (board.x0 + board.x1) / 2
  lastKillY = (board.y0 + board.y1) / 2
  trialDropped = false
  trialMs = 0
  quake.active = false
  echo.at = -1
  twistPhase = 'idle'
  twistT = 0
  twistDrift = 0
  conveyorK = 1
  stompKills = 0
  inStomp = false
  forceKill = false
  sinceSquish = 0
  partyAt.x = (board.x0 + board.x1) / 2
  partyAt.y = board.y0 + 8

  foot.x = (board.x0 + board.x1) / 2
  foot.y = (board.y0 + board.y1) / 2
  foot.tx = foot.x
  foot.ty = foot.y
  foot.z = shoe.hover
  foot.state = 'hover'
  foot.timer = 0
  foot.charge = 0
  foot.squash = 1
  foot.speed = 0
  // A press still held when the last level ended belongs to that level. Left
  // set, the new foot went straight into a charge it could never leave until a
  // release that — with the finger already lifted over the result screen — was
  // never coming. The scout found it; a player would have met it as a dead shoe.
  pressHeld = false

  layoutHazards()
  if (level.boss) spawnBoss(level.boss, level.bossScale)
  else seedBoard()

  score.value = 0
  chainCount.value = 0
  chainMult.value = 1
  chainLeft.value = 0
  slams.value = 0
  juice.value = fever.remainMs > 0 ? 0 : fever.juice
  feverMs.value = fever.remainMs
  finale.value = false
  trialShoe.value = null
  squished.value = 0
  quota.value = level.quota
  clockMs = Math.round(level.time * relief) * 1000
  timeLeft.value = Math.round(clockMs / 1000)
  bossHp.value = 1
  bossPhaseIndex.value = 0
  bossTell.value = (boss as Boss | null)?.spec.phases[0]?.tell ?? null
  podsPopped.value = 0
  pivotReady.value = true
  tally.value = emptyTally()
  phase.value = 'play'
  running = true
}

export const stopLevel = (): void => { running = false }

// ─── Hazard layout ──────────────────────────────────────────────────────────

/**
 * Place the level's hazards.
 *
 * Deterministic from the level seed, and laid out on a coarse grid with a
 * minimum separation so two puddles never overlap into one unreadable smear.
 * The sweeper and the conveyor are placed differently from the rest: they are
 * BARS, and a bar has to cross the board rather than sit in it.
 */
const layoutHazards = (): void => {
  hazards = []
  const pw = board.x1 - board.x0
  const ph = board.y1 - board.y0
  for (const id of level.hazards) {
    const spec = hazardSpec(id)
    if (id === 'sweeper') {
      hazards.push({
        id, x: board.x0 - 10, y: board.y0 + ph * 0.5, r: spec.size,
        angle: Math.PI / 2, phase: 0, charge: 0, travel: 0, dir: 1, seed: 11
      })
      continue
    }
    if (id === 'conveyor') {
      // A belt across the middle third, running along the board's LONG axis so
      // it is always a meaningful distance to be carried.
      const horizontal = pw >= ph
      hazards.push({
        id,
        x: board.x0 + pw * 0.5,
        y: board.y0 + ph * (horizontal ? 0.5 : 0.5),
        r: Math.max(pw, ph) * 0.5,
        angle: horizontal ? 0 : Math.PI / 2,
        phase: 0, charge: 0, travel: 0, dir: 1, seed: 13
      })
      continue
    }
    // Two of the scattered kinds, placed on opposite thirds so the board reads
    // as having somewhere to play rather than a cluster in one corner.
    const n = id === 'crumbs' ? 2 : 2
    for (let i = 0; i < n; i++) {
      const gx = board.x0 + pw * rndRange(0.18, 0.82)
      const gy = board.y0 + ph * (i === 0 ? rndRange(0.16, 0.44) : rndRange(0.56, 0.84))
      hazards.push({
        id, x: gx, y: gy, r: spec.size, angle: rnd() * Math.PI * 2,
        phase: rnd(), charge: 0, travel: 0, dir: 1, seed: (i * 37 + id.length * 11) | 0
      })
    }
  }
}

// ─── Spawning ───────────────────────────────────────────────────────────────

const pickBug = (): BugId => {
  let total = 0
  for (const r of level.roster) total += r.weight
  let roll = rnd() * total
  for (const r of level.roster) {
    roll -= r.weight
    if (roll <= 0) return r.id
  }
  return level.roster[0]?.id ?? 'ant'
}

const takeBug = (): Bug | null => {
  if (bugCount >= MAX_BUGS) return null
  const b = bugs[bugCount++]!
  b.alive = true
  b.dmg = 0
  b.cycle = rnd()
  b.t = 0
  b.sense = 0
  b.bolt = 0
  b.boltCd = 0
  b.stun = 0
  b.held = 0
  b.panic = 0
  b.dip = 0
  b.lastSlide = -1e9
  b.segs = 0
  b.trailN = 0
  b.phase = rnd() * Math.PI * 2
  b.fromBoss = false
  b.carry = false
  b.hatched = false
  b.rush = 0
  b.rushK = 1
  b.rushId = 0
  b.crumb = false
  b.flipped = 0
  b.puck = false
  b.bounces = 0
  b.lastPuck = -1e9
  b.frozen = 0
  return b
}

/** Point a body along `a` at its own walking speed. */
const setHeading = (b: Bug, a: number, k = 1): void => {
  b.heading = a
  const sp = b.spec.speed * level.speed * difficulty / relief * k
  b.vx = Math.cos(a) * sp
  b.vy = Math.sin(a) * sp
}

/**
 * Remove body `i` by swapping the last live one into its slot.
 *
 * Guarded, because a kill can happen INSIDE a loop over the pool — the Electric
 * Sock's arcs from inside a stomp, a puck's pins, the slam finisher — and a
 * loop still holding an index past the end of the live range would otherwise
 * "kill" a slot that is already dead, drop the count a second time, and walk it
 * below zero: the scout's world-2 runs in a trialled sock crashed exactly so.
 */
const killSlot = (i: number): void => {
  if (i < 0 || i >= bugCount) return
  const last = bugCount - 1
  if (i !== last) {
    const tmp = bugs[i]!
    bugs[i] = bugs[last]!
    bugs[last] = tmp
  }
  bugs[bugCount - 1]!.alive = false
  bugCount--
}

/** A point just outside the play rect, and a heading that walks it in. */
const edgeSpawn = (b: Bug): void => {
  const side = Math.floor(rnd() * 4)
  const pw = board.x1 - board.x0
  const ph = board.y1 - board.y0
  if (side === 0) { b.x = board.x0 + rnd() * pw; b.y = board.y0 - SPAWN_MARGIN; b.heading = Math.PI / 2 }
  else if (side === 1) { b.x = board.x1 + SPAWN_MARGIN; b.y = board.y0 + rnd() * ph; b.heading = Math.PI }
  else if (side === 2) { b.x = board.x0 + rnd() * pw; b.y = board.y1 + SPAWN_MARGIN; b.heading = -Math.PI / 2 }
  else { b.x = board.x0 - SPAWN_MARGIN; b.y = board.y0 + rnd() * ph; b.heading = 0 }
  // Aim a little off straight so a wave does not arrive as a rank.
  b.heading += rndRange(-0.5, 0.5)
}

export const spawnBug = (id: BugId, x?: number, y?: number, fromBoss = false): Bug | null => {
  const b = takeBug()
  if (!b) return null
  b.id = id
  b.spec = bugSpec(id)
  b.fromBoss = fromBoss
  if (x === undefined || y === undefined) edgeSpawn(b)
  else { b.x = x; b.y = y; b.heading = rnd() * Math.PI * 2 }
  const sp = b.spec.speed * level.speed * difficulty / relief
  b.vx = Math.cos(b.heading) * sp
  b.vy = Math.sin(b.heading) * sp
  if (b.spec.segments > 0) {
    b.segs = b.spec.segments
    if (!b.trail) b.trail = new Float32Array(TRAIL_LEN * 2)
    b.trailN = 0
    for (let i = 0; i < TRAIL_LEN; i++) { b.trail[i * 2] = b.x; b.trail[i * 2 + 1] = b.y }
  }
  return b
}

/**
 * Put bodies on the board before the first frame.
 *
 * A level used to open EMPTY and fill at one bug per spawn interval, so the
 * first two or three seconds of every level were a player looking at a floor —
 * on level 2-4 the board did not reach half its cap until nine seconds in. In a
 * game whose whole pitch is "it starts right into the scene", the opening frame
 * has to be the game.
 *
 * Just under half the cap, scattered across the playable board rather than
 * walked in from the edges: these bodies are the level's premise, not its first
 * wave, and a row of bugs marching in from one side reads as a spawn rather than
 * as an infestation. The director takes over from here and fills the rest.
 */
const seedBoard = (): void => {
  // A party opens on the sandwich already crawling: a knot of guests right at
  // the spot the rest will pour out of, so the first frame says where to go.
  if (level.party) {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2
      const b = spawnBug(pickBug(), partyAt.x + Math.cos(a) * 5, partyAt.y + Math.sin(a) * 3 + 4)
      if (b) setHeading(b, Math.PI / 2 + rndRange(-1.1, 1.1))
    }
    return
  }
  const n = Math.max(1, Math.round(level.maxAlive * 0.45))
  const margin = 10
  // The UN-grown slam circle: the safe zone is about where the foot starts, and
  // a chain from the last level must not push the opening board further out.
  const safe = shoe.radius * shoe.slamScale * 1.4
  for (let i = 0; i < n; i++) {
    let x = 0
    let y = 0
    // Kept off the foot's own starting spot: a body flattened by the first frame
    // of the level is a squish the player did not make. Bounded retries rather
    // than a loop — on a very small board every point is near the foot, and a
    // level that cannot be laid out must still start.
    for (let attempt = 0; attempt < 8; attempt++) {
      x = board.x0 + margin + rnd() * Math.max(1, board.x1 - board.x0 - margin * 2)
      y = board.y0 + margin + rnd() * Math.max(1, board.y1 - board.y0 - margin * 2)
      if (dist2(x, y, foot.x, foot.y) >= safe * safe) break
    }
    spawnBug(pickBug(), x, y)
  }
}

/**
 * The spawn director.
 *
 * Interval lerps from the level's opening rate to its closing one across the
 * level's own clock, so a level accelerates inside itself; `maxAlive` is a hard
 * ceiling so the acceleration can never turn into an unreadable board.
 */
const stepSpawns = (dt: number): void => {
  if (boss) return
  // A rush owns the board while it is told and for a breath after it lands:
  // the snare roll is a promise that something is coming, and a trickle of
  // strays walking in over it would break the promise.
  if (rushPhase !== 'idle') { spawnAcc = 0; return }
  // Bodies that came in on a rush ride ON TOP of the trickle and never count
  // against its ceiling. Counted, a conga the player did not catch — walking
  // the far edge of a portrait board, well out of a small child's reach — held
  // the board at its cap and stopped the director dead: the scout's weak player
  // lost 1-1, the level built to be unlosable, 17 runs in 40 exactly that way.
  let marchers = 0
  for (let i = 0; i < bugCount; i++) if (bugs[i]!.rushId > 0) marchers++
  const cap = level.maxAlive + marchers
  if (bugCount >= cap) return
  const k = level.time > 0 ? Math.min(1, elapsed / (level.time * 1000)) : 0
  const interval = level.spawnMs[0] + (level.spawnMs[1] - level.spawnMs[0]) * k
  spawnAcc += dt
  const gap = interval / Math.max(0.5, difficulty)
  while (spawnAcc >= gap && bugCount < cap) {
    spawnAcc -= gap
    if (level.party) {
      // Out of the sandwich, fanned downward across the board.
      const b = spawnBug(pickBug(), partyAt.x + rndRange(-4, 4), partyAt.y + rndRange(0, 3))
      if (b) setHeading(b, Math.PI / 2 + rndRange(-1.25, 1.25))
    } else {
      spawnBug(pickBug())
    }
  }
}

// ─── Rush Lines ─────────────────────────────────────────────────────────────

/**
 * Lay a lane across the board's SHORT axis — so a conga is never 170 u long on
 * a portrait phone — clear of the foot's own row, and past the body or crumb
 * pile the rush wants to pass when there is one.
 */
const layRushLane = (r: RushSpec): void => {
  const pw = board.x1 - board.x0
  const ph = board.y1 - board.y0
  const across = pw <= ph // true: the lane runs left/right
  const lo = across ? board.y0 + 14 : board.x0 + 14
  const hi = across ? board.y1 - 14 : board.x1 - 14
  const footAt = across ? foot.y : foot.x
  const valid = (v: number): boolean => v >= lo && v <= hi && Math.abs(v - footAt) >= RUSH_CLEAR_U

  // Preferred: past a live body of the named kind, just off it (stomp the line,
  // not the spikes); then through a crumb pile (the knot 1-6 is about).
  let at = NaN
  if (r.past) {
    for (let i = 0; i < bugCount; i++) {
      const b = bugs[i]!
      if (b.id !== r.past || b.rush > 0) continue
      const v = (across ? b.y : b.x) + (rnd() < 0.5 ? -7 : 7)
      if (valid(v)) { at = v; break }
    }
  }
  if (Number.isNaN(at)) {
    for (const h of hazards) {
      if (h.id !== 'crumbs') continue
      const v = across ? h.y : h.x
      if (valid(v)) { at = v; break }
    }
  }
  if (Number.isNaN(at)) {
    for (let attempt = 0; attempt < 10; attempt++) {
      const v = lo + rnd() * Math.max(1, hi - lo)
      if (valid(v)) { at = v; break }
    }
  }
  // A board too small to keep clear of the foot: the far half of it.
  if (Number.isNaN(at)) at = footAt < (lo + hi) / 2 ? hi - 4 : lo + 4

  const forward = rnd() < 0.5
  if (across) {
    rushLane.x0 = forward ? board.x0 : board.x1
    rushLane.x1 = forward ? board.x1 : board.x0
    rushLane.y0 = at
    rushLane.y1 = at
  } else {
    rushLane.y0 = forward ? board.y0 : board.y1
    rushLane.y1 = forward ? board.y1 : board.y0
    rushLane.x0 = at
    rushLane.x1 = at
  }
  rushLane.heading = Math.atan2(rushLane.y1 - rushLane.y0, rushLane.x1 - rushLane.x0)
}

/** Put a ring's lane where the ring will be — the renderer draws its tell. */
const layRushRing = (): void => {
  rushLane.x0 = foot.x
  rushLane.y0 = foot.y
  rushLane.x1 = foot.x + RUSH_RING_R
  rushLane.y1 = foot.y
  rushLane.heading = 0
}

/** Is the next rush due? Checked once a step; cheap. */
const stepRush = (dt: number): void => {
  if (level.party || boss) return
  if (rushTrailMs > 0) rushTrailMs -= dt

  if (rushPhase === 'tell') {
    rushT += dt
    if (rushT >= RUSH_TELL_MS) launchRush()
    return
  }
  if (rushPhase === 'lull') {
    rushT += dt
    if (rushT >= RUSH_LULL_MS) { rushPhase = 'idle'; rushT = 0 }
    return
  }

  const r = level.rushes[rushIdx]
  if (!r || level.quota <= 0) return
  if (elapsed < RUSH_EARLIEST_MS) return
  // A practice formation OPENS its level: it comes on the clock, not on kills —
  // it is the move's lesson, and a lesson that waited for two squishes would
  // arrive in the middle of a board the player is already busy with.
  if (!r.practice && squished.value < level.quota * r.at) return
  // Never on top of a twist's tell: two warnings at once is no warning.
  if (twistPhase === 'tell') return
  rushIdx++
  // A practice formation is the lesson of a move the player owns; without the
  // move it is just a board with a ring of ants on it, so it is skipped.
  if (r.practice && !hasMove(r.practice)) return
  rushCur = r
  rushSerial++
  if (r.shape === 'ring') layRushRing()
  else layRushLane(r)
  rushPhase = 'tell'
  rushT = 0
  rushTrailMs = 0
  emit({
    k: 'rushTell', x0: rushLane.x0, y0: rushLane.y0, x1: rushLane.x1, y1: rushLane.y1,
    shape: r.shape, ...(r.practice ? { practice: r.practice } : {})
  })
}

/**
 * The tell is over: put the formation down.
 *
 * Every body is placed where the camera cannot see it arrive — behind the lane's
 * start, past the board's edge, for a line or a V — so a conga WALKS IN rather
 * than popping into existence (the cutscenes' own no-pop rule, and the same
 * mistake: `cutscenes.md`'s "1 ant turns into a line of ants"). A ring is the
 * one exception: it is born round the shoe, which is the point of it, and its
 * tell has been drawing the circle it appears on for a second.
 */
const launchRush = (): void => {
  const r = rushCur
  if (!r) return
  rushPhase = 'lull'
  rushT = 0
  rushTrailMs = 4000
  const crumbs = level.world === 1 && !r.practice
  if (r.shape === 'ring') {
    for (let i = 0; i < r.count; i++) {
      const a = (i / r.count) * Math.PI * 2 + rnd() * 0.2
      const b = spawnBug(r.bug, foot.x + Math.cos(a) * RUSH_RING_R, foot.y + Math.sin(a) * RUSH_RING_R)
      if (!b) break
      setHeading(b, a + Math.PI, RUSH_RING_SPEED)
      b.rush = (RUSH_RING_R / Math.max(1, Math.hypot(b.vx, b.vy))) * 1000
      b.rushK = RUSH_RING_SPEED
      b.rushId = rushSerial
      b.crumb = crumbs && b.spec.armor === 0
    }
    emit({ k: 'rushGo', x: foot.x, y: foot.y })
    return
  }

  const h = rushLane.heading
  const back = h + Math.PI
  const side = h + Math.PI / 2
  const bodies = r.shape === 'vee' && r.lead ? r.count + 1 : r.count
  const gap = bugSpec(r.bug).size * RUSH_GAP
  // The lane's length, and the time the slowest marcher needs to walk it and a
  // bit — past that it is simply a body on the board.
  const len = Math.hypot(rushLane.x1 - rushLane.x0, rushLane.y1 - rushLane.y0)
  for (let i = 0; i < bodies; i++) {
    const lead = r.shape === 'vee' && r.lead && i === 0
    const id: BugId = lead ? r.lead! : r.bug
    // Line: nose to tail. V: the point first, then pairs fanning back behind it.
    let along = SPAWN_MARGIN + 2 + i * gap
    let off = 0
    if (r.shape === 'vee') {
      const k = lead ? 0 : Math.ceil(i / 2)
      along = SPAWN_MARGIN + 2 + k * gap * 0.9 + (lead ? 0 : bugSpec(r.lead ?? r.bug).size)
      off = lead ? 0 : (i % 2 === 1 ? 1 : -1) * k * gap * 0.75
    }
    const x = rushLane.x0 + Math.cos(back) * along + Math.cos(side) * off
    const y = rushLane.y0 + Math.sin(back) * along + Math.sin(side) * off
    const b = spawnBug(id, x, y)
    if (!b) break
    // The whole formation walks at its point's pace.
    b.rushK = Math.min(1, bugSpec(lead || !r.lead ? id : r.lead).speed / b.spec.speed)
    setHeading(b, h, b.rushK)
    const sp = Math.max(1, Math.hypot(b.vx, b.vy))
    b.rush = ((len + along + SPAWN_MARGIN * 2) / sp) * 1000
    b.rushId = rushSerial
    b.crumb = crumbs && b.spec.armor === 0 && !b.spec.spiky
  }
  emit({ k: 'rushGo', x: rushLane.x0, y: rushLane.y0 })
}

/** Is `b` still walking IN from past the edge it entered by? Such a body is
 *  exempt from `bounce`, which would otherwise turn it round before it arrives. */
const entering = (b: Bug): boolean => {
  if (b.rush <= 0) return false
  const outside = b.x < board.x0 || b.x > board.x1 || b.y < board.y0 || b.y > board.y1
  if (!outside) return false
  const cx = (board.x0 + board.x1) / 2 - b.x
  const cy = (board.y0 + board.y1) / 2 - b.y
  return cx * Math.cos(b.heading) + cy * Math.sin(b.heading) > 0
}

// ─── Maths helpers ──────────────────────────────────────────────────────────

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v)
const dist2 = (ax: number, ay: number, bx: number, by: number): number => {
  const dx = ax - bx
  const dy = ay - by
  return dx * dx + dy * dy
}

// ─── Input ──────────────────────────────────────────────────────────────────

let lastPressAt = -1e9
let lastPressX = 0
let lastPressY = 0
let pressHeld = false
let pressAt = 0

/**
 * Move the aim point. `lift` is applied by the caller (the scene knows whether
 * the event came from a finger), so this stays a pure "point at (x, y)".
 */
export const aim = (x: number, y: number): void => {
  foot.tx = clamp(x, board.x0, board.x1)
  foot.ty = clamp(y, board.y0, board.y1)
}

/**
 * A press began.
 *
 * The quick stomp fires HERE, on the way down, not on release. That is a
 * deliberate 100-150 ms of responsiveness bought at the cost of one oddity: a
 * held press always opens with a tap. It is the right trade for this game and
 * this audience — a six-year-old taps, and a tap that waits for the release
 * feels broken — and the oddity is harmless, because a slam that begins with a
 * stomp is never worse than one that does not.
 *
 * Two exceptions run before it:
 *   · a second press inside `DOUBLE_TAP_MS` and `DOUBLE_TAP_U` is a heel pivot;
 *   · Single-Tap Mode first flies the foot to the nearest body.
 */
export const press = (x: number, y: number, now: number): void => {
  if (!running || phase.value !== 'play') return
  if (foot.state === 'stun') {
    // A stun that silently eats every tap for 0.9 s reads as a broken game, and
    // it lands on a player who has JUST been punished. Mashing shortens it —
    // the oldest answer in the arcade, and one a six-year-old already knows.
    foot.timer = Math.max(0, foot.timer - STUN_SHAKE_MS)
    return
  }

  // ── The touch snap ──
  //
  // `x, y` arrived with the lift already taken off (the scene applies it), so
  // the FINGERTIP is `y + TOUCH_LIFT_U`. A body within a fingertip of that is
  // the body the player meant, and the foot is put on it outright rather than
  // sprung at it: the spring has one drop's worth of travel to cover, which is
  // not enough from across the board, and a tap that half-arrives is the miss
  // this exists to remove. Never a spiky one — the game spends a whole lesson
  // teaching a child to leave those alone, and aim that overrules the player
  // into damage is worse than no aim at all.
  const snap = touch && !singleTap ? snapBug(x, y + TOUCH_LIFT_U, TOUCH_SNAP_U) : null
  if (snap) {
    aim(snap.x, snap.y)
    foot.x = snap.x
    foot.y = snap.y
  } else {
    aim(x, y)
  }

  const isDouble = now - lastPressAt < DOUBLE_TAP_MS
    && dist2(x, y, lastPressX, lastPressY) < DOUBLE_TAP_U * DOUBLE_TAP_U
  lastPressAt = now
  lastPressX = x
  lastPressY = y

  // The Heel Spin is the Queen's trophy (1-4). Before it is won, a double tap is
  // simply two stomps — which also retires the accidental weak pivots a child
  // mashing the screen used to set off on 1-1 without anything teaching them.
  if (isDouble && hasMove('spin') && pivotCd <= 0) {
    heelPivot()
    return
  }

  if (singleTap) {
    const near = nearestBug(x, y, AUTO_AIM_U)
    if (near) { foot.tx = near.x; foot.ty = near.y; foot.x = near.x; foot.y = near.y }
  }

  pressHeld = true
  pressAt = now
  // ── THE TAP WAITS FOR THE RELEASE, always ──
  //
  // A press used to open with a quick stomp, and the charge could only begin
  // once that stomp had landed and recovered. That made a charge IMPOSSIBLE
  // over anything worth charging at: press on a beetle to wind up a slam and
  // the opening tap hit it first — bouncing off its shell, alerting it, or on
  // a soft body killing the thing you were winding up for. The only way to
  // charge was to hold over bare floor and then walk the foot across, which is
  // not a control anybody discovers and is a large part of why the slam went
  // untaught in practice.
  //
  // It was already fixed HERE, for one moment: on the gilded last body of a Big
  // Finish, where the same collision was fatal to the finisher. The note that
  // used to sit on that special case argued it exactly right — "a short press
  // is still a tap, a long one is the slam", and "a tenth of a second of
  // latency is worth a choice". That reasoning was never specific to the
  // finale; it is the reason the control works at all, so it is now the whole
  // game's rule and the special case is gone.
  //
  // What a player pays for it: a stomp resolves when the finger LIFTS rather
  // than when it lands, so a deliberate tap costs its own duration in latency
  // (tens of ms). What they get: every press can become a charge, and nothing
  // is ever destroyed by an opening blow they did not ask for.
  //
  // `TAP_MS` still decides when the wind-up visibly begins (see `stepFoot`), so
  // an ordinary tap never flashes a charge ring on its way past.
}

/** The press ended. A charge past the threshold lands as a slam. */
export const release = (): void => {
  pressHeld = false
  if (!running || phase.value !== 'play') { foot.charge = 0; return }
  // A wind-up past the threshold is a slam.
  //
  // `slam()` deliberately LEAVES the charge on the foot: `land()` reads it to
  // decide the blow is heavy and how far it reaches, and `impact` clears it
  // afterwards. An early version cleared it one line later, which turned every
  // held slam into an ordinary tap — no shell could be opened by hand and the
  // whole mechanic was dead. Pinned by `tests/game/sim.test.ts`.
  if (foot.state === 'charge' && foot.charge >= MIN_SLAM_CHARGE) {
    slam(foot.charge)
    return
  }
  // Anything shorter is the tap the press owed — including a wind-up that was
  // let go early. A partial charge that produced NOTHING would be the cruellest
  // input in the game: the player held, saw the foot rise, let go a moment too
  // soon and the turn silently did not happen.
  if (foot.state === 'hover' || foot.state === 'recover' || foot.state === 'charge') {
    quickStomp()
    return
  }
  // Pressed and released inside a blow that was already happening (drop,
  // impact, stun, slide, pivot). Nothing is owed — the foot is busy.
  foot.charge = 0
}

/** Desktop's direct right-click slam — no charge, full power, on the button. */
export const slamNow = (): void => {
  if (!running || phase.value !== 'play') return
  if (foot.state === 'stun' || foot.state === 'drop' || foot.state === 'impact') return
  slam(1)
}

/**
 * Empty the vial.
 *
 * The vial deliberately SURVIVES `startLevel` (see the note there), which is
 * right for a player and wrong for anything that has to begin from a known
 * state: a test, or the preview recorder shooting a scripted clip. This is the
 * one way to put it back to zero, and it is never called from play.
 */
export const resetVial = (): void => {
  fever = { juice: 0, remainMs: 0 }
  heldJuice = null
  feverArmed = false
  juice.value = 0
  feverMs.value = 0
}

export const tryFever = (): boolean => {
  if (!running || phase.value !== 'play') return false
  const next = startFever(fever)
  if (next === fever) return false
  fever = next
  feverMs.value = fever.remainMs
  juice.value = 0
  const t = tally.value
  tally.value = { ...t, fevers: t.fevers + 1 }
  feverKills = 0
  emit({ k: 'fever', x: foot.x, y: foot.y })
  return true
}

/**
 * The body a touch tap meant, or null.
 *
 * `nearestBug`'s stricter sibling: it refuses anything the player is being
 * taught NOT to stomp (a spike, unless the boot is proof against it) and
 * anything that is not a target at all (a puck is the player's own ball).
 */
const snapBug = (x: number, y: number, reach: number): Bug | null => {
  let best: Bug | null = null
  let bestD = reach * reach
  for (let i = 0; i < bugCount; i++) {
    const b = bugs[i]!
    if (b.puck) continue
    if (b.spec.spiky && !shoe.spikeProof && fever.remainMs <= 0) continue
    if (b.spec.airborne && b.dip < 0.5) continue
    const d = dist2(x, y, b.x, b.y)
    if (d < bestD) { bestD = d; best = b }
  }
  return best
}

/** Is there anything on the floor worth spending a Fever on? */
const somethingToStomp = (): boolean => {
  if (boss !== null) return true
  for (let i = 0; i < bugCount; i++) if (bugs[i]!.alive) return true
  return false
}

const nearestBug = (x: number, y: number, reach: number): Bug | null => {
  let best: Bug | null = null
  let bestD = reach * reach
  for (let i = 0; i < bugCount; i++) {
    const b = bugs[i]!
    if (b.spec.airborne && b.dip < 0.5) continue
    const d = dist2(x, y, b.x, b.y)
    if (d < bestD) { bestD = d; best = b }
  }
  return best
}

// ─── The foot ───────────────────────────────────────────────────────────────

/**
 * The stomp radius right now — the shoe's, grown by the chain (Growth Spurt)
 * and by Fever, under one cap so the gilded boot stays the biggest thing in the
 * game without a chain on top of it swallowing the board.
 */
export const stompRadius = (heavy = false): number => {
  const base = shoe.radius * (heavy ? shoe.slamScale : 1)
  const grown = base * growth
  return fever.remainMs > 0
    ? Math.min(grown * FEVER.radiusScale, base * MAX_RADIUS_SCALE)
    : grown
}

const quickStomp = (): void => {
  foot.state = 'drop'
  foot.timer = 70
  foot.charge = 0
}

const slam = (charge: number): void => {
  foot.state = 'drop'
  // A partial charge drops from a lower height and lands sooner.
  foot.timer = 60 + 60 * charge
  foot.charge = charge
}

/**
 * The Heel Spin — the half-strength Queen's trophy.
 *
 * Wider and quicker than the weak panic pivot it replaces (`SPIN_SCALE` 2.4
 * against 2.1, a 1.8 s cooldown against 2.6), because it is a move the player
 * EARNED now rather than one they tripped over, and it FLIPS the shells it
 * sweeps — the ring rush it answers on 1-5 and every beetle knot after it.
 */
const heelPivot = (): void => {
  const r = stompRadius() * SPIN_SCALE
  pivotCd = SPIN_COOLDOWN_MS
  pivotReady.value = false
  foot.state = 'pivot'
  foot.timer = 420
  emit({ k: 'pivot', x: foot.x, y: foot.y, r })
  // A sweep, not a stomp: it kills only the unarmoured, and it does not miss —
  // a move that can break the chain is one nobody uses twice.
  resolveArea(foot.x, foot.y, r, false, true)
}

/**
 * Spring the foot toward the aim point.
 *
 * A spring, not a cap: a hard max speed makes a slow shoe feel broken on a big
 * screen (the finger arrives, the foot is still crossing the board), while a
 * spring makes it feel HEAVY, which is what a steel boot is supposed to feel
 * like. Agility is the stiffness, modified by whatever the foot is standing in.
 */
const stepFoot = (dt: number): void => {
  const s = dt / 1000
  let agility = shoe.agility
  if (fever.remainMs > 0) agility *= FEVER.agilityScale
  agility *= footTerrainAgility()
  if (foot.state === 'charge') agility *= 0.65
  if (foot.state === 'stun') agility = 0

  const px = foot.x
  const py = foot.y
  const k = 1 - Math.exp(-agility * s)
  foot.x += (foot.tx - foot.x) * k
  foot.y += (foot.ty - foot.y) * k

  const dx = foot.x - px
  const dy = foot.y - py
  const moved = Math.hypot(dx, dy)
  foot.speed = s > 0 ? moved / s : 0
  if (moved > 0.02) foot.heading = Math.atan2(dy, dx)

  // The draught leans on the shoe too — gently: the bodies are what it blows
  // about, and a foot that drifted off its own aim would be a control bug.
  if (twistPhase === 'active' && level.twist === 'draft') {
    foot.x = clamp(foot.x + twistDrift * s * 0.6, board.x0, board.x1)
  }

  // ── The Shoebox Trial's clock ──
  if (trialShoe.value !== null && trialShoe.value !== 'laces') {
    trialMs -= dt
    if (trialMs <= 0) endTrial()
  }
  // A shoe swap lands only between blows, never under one — every rule in the
  // game reads the one `shoe`, and changing it mid-drop would land a blow that
  // was pressed in one shoe with the reach of another.
  if (pendingShoe && (foot.state === 'hover' || foot.state === 'recover')) {
    shoe = pendingShoe
    pendingShoe = null
  }

  // ── Beetle Bowling: the kick ──
  //
  // No press at all: a shoe travelling FAST across a body on its back sends it
  // spinning along the shoe's own heading. A finger flick on touch, a cursor
  // flick on a mouse — the drag the player has been doing since 1-1, given a
  // direction and a purpose. Slow travel never kicks, so easing the foot into
  // position beside a flipped beetle to tap it does exactly that.
  if ((foot.state === 'hover' || foot.state === 'recover') && foot.speed > KICK_SPEED) {
    const reach = stompRadius() * 0.8
    for (let i = bugCount - 1; i >= 0; i--) {
      const b = bugs[i]!
      if (b.flipped <= 0 || b.puck) continue
      const r = reach + b.spec.size
      if (dist2(foot.x, foot.y, b.x, b.y) > r * r) continue
      kick(b)
    }
  }

  // Height and squash, per state.
  const hover = shoe.hover
  switch (foot.state) {
    case 'hover':
      foot.z += (hover - foot.z) * (1 - Math.exp(-10 * s))
      foot.squash += (1 - foot.squash) * (1 - Math.exp(-14 * s))
      // A finger dragged fast enough skates, before it is asked to wind up:
      // the Skid is a movement, and a player throwing the foot across the board
      // is not asking for a slam. See `trySlide`.
      if (trySlide()) break
      if (pressHeld && performance.now() - pressAt > TAP_MS) {
        foot.state = 'charge'
        foot.charge = 0
      }
      break
    case 'charge': {
      // …and out of a wind-up too, so a charge that starts moving becomes the
      // skid it looks like rather than a slam dragged sideways.
      if (trySlide()) { foot.charge = 0; break }
      foot.charge = Math.min(1, foot.charge + dt / shoe.chargeMs)
      const target = hover + (1 - hover) * foot.charge
      foot.z += (target - foot.z) * (1 - Math.exp(-12 * s))
      break
    }
    case 'drop':
      foot.timer -= dt
      foot.z = Math.max(0, foot.z - (foot.z / Math.max(1, foot.timer)) * dt * 1.6)
      if (foot.timer <= 0) {
        foot.z = 0
        land()
      }
      break
    case 'impact':
      foot.timer -= dt
      foot.squash += (0.66 - foot.squash) * (1 - Math.exp(-26 * s))
      if (foot.timer <= 0) {
        foot.state = 'recover'
        foot.timer = foot.charge > 0
          ? shoe.recoverMs * (0.5 + 0.5 * foot.charge)
          : shoe.cooldown
        foot.charge = 0
      }
      break
    case 'recover':
      foot.timer -= dt
      foot.z += (hover - foot.z) * (1 - Math.exp(-9 * s))
      foot.squash += (1 - foot.squash) * (1 - Math.exp(-12 * s))
      if (foot.timer <= 0) {
        foot.state = pressHeld ? 'charge' : 'hover'
        if (foot.state === 'charge') foot.charge = 0
      }
      break
    case 'slide':
      foot.timer -= dt
      foot.z = 0
      foot.squash += (0.78 - foot.squash) * (1 - Math.exp(-18 * s))
      slideDamage()
      if (foot.timer <= 0 || !pressHeld) { foot.state = 'recover'; foot.timer = shoe.cooldown }
      break
    case 'stun':
      foot.timer -= dt
      foot.z += (hover * 0.7 - foot.z) * (1 - Math.exp(-6 * s))
      if (foot.timer <= 0) { foot.state = 'hover'; foot.squash = 1 }
      break
    case 'pivot':
      foot.timer -= dt
      foot.z = hover * 0.25
      if (foot.timer <= 0) { foot.state = 'recover'; foot.timer = shoe.cooldown }
      break
  }

  if (pivotCd > 0) {
    pivotCd -= dt
    if (pivotCd <= 0) pivotReady.value = true
  }
}

// ─── Beetle Bowling ─────────────────────────────────────────────────────────

/** Pucks rolling right now. A kick past the cap just finishes the body — the
 *  fourth ball on a lane is a bowling alley nobody can read. */
const puckCount = (): number => {
  let n = 0
  for (let i = 0; i < bugCount; i++) if (bugs[i]!.puck) n++
  return n
}

/** Send a flipped body spinning along the foot's heading. */
const kick = (b: Bug): void => {
  if (puckCount() >= MAX_PUCKS) return
  b.puck = true
  b.flipped = 0
  b.stun = 0
  b.bounces = 0
  b.rush = 0
  b.heading = foot.heading
  b.vx = Math.cos(foot.heading) * PUCK_SPEED
  b.vy = Math.sin(foot.heading) * PUCK_SPEED
  emit({ k: 'kick', x: b.x, y: b.y })
}

/**
 * Put a body on its back — the slam that did not kill it, a Heel Spin that
 * swept it, a Quake ring that crossed it. Soft side up for `FLIP_MS`.
 */
const flipBody = (b: Bug): void => {
  if (!b.spec.flips || b.puck || b.flipped > 0) return
  b.flipped = FLIP_MS
  b.stun = Math.max(b.stun, FLIP_MS)
  b.rush = 0
  emit({ k: 'flip', x: b.x, y: b.y, bug: b.id })
}

/** The index of `b` in the live pool, or -1. Pucks are handled by reference,
 *  because a kill swaps bodies about under a loop that holds indices. */
const indexOfBug = (b: Bug): number => {
  for (let i = 0; i < bugCount; i++) if (bugs[i] === b) return i
  return -1
}

const pucks: Bug[] = []

/**
 * Roll every puck: friction, the board's edges as bumpers, and everything it
 * rolls over takes a blow (pierce 2 — a shell cracks a beetle, never a robobug —
 * on the chain, because the player aimed it). A puck that runs out of speed or
 * of bounces splats itself: it was always going to die, and a ball that sat on
 * the floor after the pins went down would be one more beetle to tap.
 *
 * A separate pass from `stepBugs`, and by REFERENCE: the blows it lands remove
 * bodies from the pool, which swaps the last live one into the hole, and a loop
 * holding indices would lose track of the puck it is moving.
 */
const stepPucks = (dt: number): void => {
  pucks.length = 0
  for (let i = 0; i < bugCount; i++) if (bugs[i]!.puck) pucks.push(bugs[i]!)
  if (pucks.length === 0) return
  const s = dt / 1000
  for (const p of pucks) {
    if (!p.alive) continue
    const f = Math.exp(-PUCK_FRICTION * s)
    p.vx *= f
    p.vy *= f
    p.x += p.vx * s
    p.y += p.vy * s
    p.cycle = (p.cycle + s * 6) % 1
    // The edges are bumpers: reflect, and count it.
    if (p.x < board.x0 || p.x > board.x1) {
      p.x = clamp(p.x, board.x0, board.x1)
      p.vx = -p.vx
      p.bounces++
    }
    if (p.y < board.y0 || p.y > board.y1) {
      p.y = clamp(p.y, board.y0, board.y1)
      p.vy = -p.vy
      p.bounces++
    }
    p.heading = Math.atan2(p.vy, p.vx)
    // The pins.
    let pins = 0
    for (let j = bugCount - 1; j >= 0; j--) {
      if (j >= bugCount) continue
      const o = bugs[j]!
      if (o === p || o.puck) continue
      if (elapsed - o.lastPuck < 250) continue
      const reach = p.spec.size + o.spec.size
      if (dist2(p.x, p.y, o.x, o.y) > reach * reach) continue
      o.lastPuck = elapsed
      const before = squished.value
      // A rolling shell does not care about spikes — it is the second answer to
      // the caterpillar, and the player's foot is nowhere near it.
      spikeSafe = true
      hitBug(j, PUCK_PIERCE, false, true, true)
      spikeSafe = false
      if (squished.value > before) pins++
    }
    if (pins >= 3) emit({ k: 'pins', x: p.x, y: p.y, n: pins })
    const limit = p.spec.flips === 'pinball' ? PINBALL_BOUNCES : PUCK_BOUNCES
    if (Math.hypot(p.vx, p.vy) < PUCK_STOP_SPEED || p.bounces > limit) {
      const i = indexOfBug(p)
      if (i >= 0) {
        forceKill = true
        hitBug(i, 99, true, true, true)
        forceKill = false
      }
    }
  }
}

/** What the floor under the foot does to its agility. */
const footTerrainAgility = (): number => {
  let k = 1
  for (const h of hazards) {
    if (h.id !== 'cobweb' && h.id !== 'honey') continue
    if (dist2(foot.x, foot.y, h.x, h.y) < h.r * h.r) k *= hazardSpec(h.id).footAgility
  }
  for (const z of hazes) {
    if (!z.alive) continue
    if (dist2(foot.x, foot.y, z.x, z.y) < HAZE_R * HAZE_R) k *= HAZE_FOOT_AGILITY
  }
  return k
}

/** The foot has reached the floor. */
const land = (): void => {
  const heavy = foot.charge >= MIN_SLAM_CHARGE
  const r = stompRadius(heavy) * (heavy ? 0.7 + 0.3 * foot.charge : 1)
  foot.state = 'impact'
  foot.timer = heavy ? 110 : 70
  foot.squash = 0.66

  // The boss is resolved BEFORE the stomp event, because a blow that landed on
  // it is a hit — see `bossStomp` — and the event carries `hit` to the renderer.
  //
  // Kills inside this one blow are counted: two or more is a MULTI, the thing
  // the Rush Lines and Growth Spurt exist to make happen, and the rush lesson
  // retires on the first one.
  stompKills = 0
  inStomp = true
  const hitBugs = resolveArea(foot.x, foot.y, r, heavy, false)
  inStomp = false
  if (stompKills >= 2) {
    const t = tally.value
    tally.value = { ...t, multiKills: t.multiKills + 1 }
    emit({ k: 'multi', x: foot.x, y: foot.y, n: stompKills })
  }
  // After the blow has been resolved, so nothing it killed is scared by it.
  scareSprinters(foot.x, foot.y, r)
  const hitBoss = boss ? bossStomp(foot.x, foot.y, r, heavy) : false
  // An egg under the sole is a hit too. The pods themselves are popped a step
  // later, in `substep` (they are resolved against the whole impact, not just
  // its first frame), so this only ASKS — and without it a stomp that took an
  // egg and nothing else read as bare floor: a miss on the tally and a broken
  // chain for doing exactly what the phase asks. The same bug `bossStomp`'s
  // note describes for the body, one phase later; it cost nothing while the egg
  // phase was 1-10's, and would have been a six-year-old's first boss fight.
  const hitPod = boss ? podUnder(foot.x, foot.y, stompRadius(heavy)) : false
  // A shoebox under the sole is a hit too — the player aimed at the present.
  const hitBox = boxUnder(foot.x, foot.y, r)
  const hit = hitBugs || hitBoss || hitPod || hitBox
  if (heavy) slams.value++
  emit({ k: 'stomp', x: foot.x, y: foot.y, r, heavy, hit })

  if (heavy) armMagnets()
  stompHazards(foot.x, foot.y, r, heavy)

  // ── The trophies that ride on a slam ──
  if (heavy && hasMove('quake') && foot.charge >= QUAKE_CHARGE) {
    // A FULL charge sends a ring out along the floor: everything it crosses is
    // stunned, and every shell it crosses goes over on its back.
    quake.active = true
    quake.x = foot.x
    quake.y = foot.y
    quake.r = r * 0.6
    emit({ k: 'quake', x: foot.x, y: foot.y })
  }
  if (heavy && hasMove('echo')) {
    // The same spot again, 400 ms later — the flea that leapt the first one is
    // landing, the moth is dipping.
    echo.at = elapsed + ECHO_MS
    echo.x = foot.x
    echo.y = foot.y
    echo.r = r
  }

  if (!hit) {
    // A MISS: bare floor. The chain is over.
    emit({ k: 'miss', x: foot.x, y: foot.y })
    const t = tally.value
    tally.value = { ...t, misses: t.misses + 1 }
    breakChain()
  }

  trySlide()
}

/**
 * Start a skid, if this foot may have one and is moving fast enough under a
 * held finger: in a shoe that has one, on a slick floor, or — once the Queen's
 * Skid is won on 1-10 — anywhere at all.
 *
 * ── Why this is no longer only reachable out of a landing ──
 *
 * It used to live at the end of `land()`, and the note above it said a slide
 * can only start out of a landing. That was never a design rule — it was a
 * consequence of the OLD control, where a press opened with a stomp and so
 * every drag began with a landing whether the player wanted one or not. With
 * the blow moved to the release (see `press`) a dragged finger never lands
 * anything, and the Skid silently stopped existing: `retentionSim`'s "a press
 * dragged on bare floor slides" is what caught it.
 *
 * So the condition is unchanged and the reachability is widened — a landing
 * still starts one (a slam dragged out of its own impact keeps skating), and
 * now so does the drag itself.
 */
const trySlide = (): boolean => {
  if (foot.state === 'slide') return false
  if (!(shoe.slide || onSlickFloor() || hasMove('skid'))) return false
  if (!pressHeld || foot.speed <= 12) return false
  foot.state = 'slide'
  foot.timer = 900
  slideId++
  return true
}

/** Break the chain, and say which rung was lost — the shoe deflates from it. */
const breakChain = (): void => {
  if (chain.count > 0) emit({ k: 'chainLost', mult: comboMultiplier(chain.count) })
  chain = chainBreak(chain)
  syncChain()
}

/** Is the foot on something slippery — honey's rim, or the spill's lane? */
const onSlickFloor = (): boolean => {
  for (const h of hazards) {
    if (h.id === 'honey') {
      if (dist2(foot.x, foot.y, h.x, h.y) < h.r * h.r) return true
    } else if (h.id === 'slick') {
      if (inLane(h, foot.x, foot.y)) return true
    }
  }
  return false
}

/** Is (x, y) inside a lane-shaped hazard — the conveyor, the spill? */
const inLane = (h: Hazard, x: number, y: number): boolean => {
  const dx = x - h.x
  const dy = y - h.y
  const along = dx * Math.cos(h.angle) + dy * Math.sin(h.angle)
  const across = -dx * Math.sin(h.angle) + dy * Math.cos(h.angle)
  return Math.abs(along) < h.r && Math.abs(across) < hazardSpec(h.id).size * (h.id === 'slick' ? 1 : 0.5)
}

/**
 * While sliding, everything the sole crosses is crushed.
 *
 * The re-hit guard is on the SIM's clock. It read `performance.now()` — wall
 * time inside a fixed-step simulation — which on a slow phone running three
 * sub-steps a frame let one flea be hit three times per 220 "ms", and in a
 * headless run (no wall time passing at all) let nothing be hit twice ever.
 */
const slideDamage = (): void => {
  const r = stompRadius() * 0.9
  for (let i = bugCount - 1; i >= 0; i--) {
    if (i >= bugCount) continue
    const b = bugs[i]!
    if (elapsed - b.lastSlide < SLIDE_REHIT_MS) continue
    if (dist2(foot.x, foot.y, b.x, b.y) > (r + b.spec.size) * (r + b.spec.size)) continue
    b.lastSlide = elapsed
    hitBug(i, blowPierce(shoe, false), false, true)
  }
}

// ─── Resolving a blow ───────────────────────────────────────────────────────

let feverKills = 0

/**
 * Everything inside a circle takes one blow. Returns whether ANYTHING was hit —
 * a kill, a wound, or a ricochet — which is what decides a miss.
 *
 * Iterated backwards because `killSlot` swaps the last live body into the hole.
 */
const resolveArea = (x: number, y: number, r: number, heavy: boolean, sweep: boolean): boolean => {
  let hit = false
  const pierce = sweep ? 0 : blowPierce(shoe, heavy)
  for (let i = bugCount - 1; i >= 0; i--) {
    // An arc from an earlier kill in this same loop can empty the end of the
    // pool under it — see `killSlot`.
    if (i >= bugCount) continue
    const b = bugs[i]!
    const reach = r + b.spec.size
    if (dist2(x, y, b.x, b.y) > reach * reach) continue
    if (b.spec.airborne && b.dip < 0.55 && !sweep) continue
    // A rolling puck is the player's ball, not a target.
    if (b.puck) continue
    if (sweep && (b.spec.armor > 0 || b.spec.spiky) && b.flipped <= 0) {
      // The Heel Spin sweeps a shell OVER rather than past it — the ring it
      // answers is how a child meets that on 1-5, and a beetle knot after it.
      if (b.spec.flips && !b.spec.spiky) { flipBody(b); hit = true }
      continue
    }
    hit = true
    hitBug(i, pierce, heavy, false)
  }

  // The steel boot's slam stuns everything in a wider ring than it kills in.
  if (heavy && shoe.stunMs > 0) {
    const stunR = r * 1.6
    for (let i = 0; i < bugCount; i++) {
      const b = bugs[i]!
      if (dist2(x, y, b.x, b.y) < stunR * stunR) b.stun = Math.max(b.stun, shoe.stunMs)
    }
  }
  return hit
}

/**
 * One blow against one body, by pool index.
 *
 * `chainOk` is false for the arcs a chain-lightning shoe throws: they kill, they
 * score, and they do NOT extend the chain — otherwise one stomp with the
 * Electric Sock would be worth four rungs and the whole ladder would collapse.
 */
const hitBug = (i: number, pierce: number, heavy: boolean, fromSlide: boolean, chainOk = true): void => {
  // An index a loop was holding when something else in the same step emptied
  // the end of the pool — see `killSlot`.
  if (i < 0 || i >= bugCount) return
  const b = bugs[i]!
  const spec = b.spec

  // A centipede's HEAD is the front of its body circle; a blow that lands on the
  // back half is a segment cut, and a blow on the head is the instant kill.
  const headshot = spec.segments > 0 && !fromSlide
    && dist2(foot.x, foot.y, b.x, b.y) < (spec.size * 0.9) * (spec.size * 0.9)

  // A body on its back is soft side up: anything kills it. The glitch twist
  // drops every robobug's plate for its three seconds.
  const soft = b.flipped > 0 || (glitchOn() && b.id === 'robobug')
  const verdict: StompVerdict = forceKill || (soft && !spec.spiky)
    ? 'splat'
    : resolveStomp({
      bug: spec, damage: b.dmg, pierce, spikeProof: shoe.spikeProof || spikeSafe,
      fever: fever.remainMs > 0, heavy, headshot
    })

  const t = tally.value
  if (verdict === 'spike') {
    emit({ k: 'spike', x: b.x, y: b.y })
    foot.state = 'stun'
    foot.timer = SPIKE_STUN_MS
    tally.value = { ...t, spikes: t.spikes + 1, hits: t.hits + 1 }
    breakChain()
    return
  }

  tally.value = { ...t, hits: t.hits + 1 }

  if (verdict === 'ricochet') {
    emit({ k: 'clang', x: b.x, y: b.y, bug: b.id, heavy })
    tally.value = { ...tally.value, ricochets: tally.value.ricochets + 1 }
    b.stun = Math.max(b.stun, 180)
    return
  }

  if (verdict === 'hurt') {
    b.dmg += blowDamage(heavy)
    emit({ k: 'hurt', x: b.x, y: b.y, bug: b.id, heavy })
    b.stun = Math.max(b.stun, 220)
    // ── Beetle Bowling ── A slam that cracks a shell without killing it turns
    // the body over. One more tap finishes it; a flick sends it bowling.
    if (heavy) flipBody(b)
    return
  }

  // ── A kill ──
  const { next, multiplier } = chainOk ? chainHit(chain) : { next: chain, multiplier: comboMultiplier(chain.count) }
  if (chainOk) {
    chain = next
    syncChain()
    emit({ k: 'chain', n: chain.count, mult: multiplier, step: comboMultiplier(chain.count) > comboMultiplier(chain.count - 1) })
  }

  const feverBonus = fever.remainMs > 0 ? FEVER.scoreScale : 1
  const gained = Math.round(squishScore(spec.score, multiplier) * feverBonus)
  score.value += gained

  // The vial is paid in mass, with a CHAIN BONUS on top — `juiceGain` owns both
  // numbers, so the balance lives in one file with the ladder it depends on.
  fever = { ...fever, juice: Math.min(1, fever.juice + juiceGain(spec.juice, multiplier)) }
  // A full vial ARMS Fever; `stepFever` spends it on the next frame with a body
  // still on the floor. Four of five blind testers never worked out that the
  // vial was a button, and the one who read the hint reported it "pointed at
  // nothing obvious" — so the game's best moment is no longer something a
  // player has to know about to ever see.
  if (feverReady(fever)) feverArmed = true
  if (fever.remainMs <= 0) juice.value = fever.juice
  if (fever.remainMs > 0) feverKills++

  squished.value++
  sinceSquish = 0
  if (inStomp) stompKills++
  const byKind = { ...tally.value.byKind }
  byKind[b.id] = (byKind[b.id] ?? 0) + 1
  tally.value = {
    ...tally.value,
    squishes: tally.value.squishes + 1,
    byKind,
    bestCombo: Math.max(tally.value.bestCombo, multiplier),
    bestFeverKills: Math.max(tally.value.bestFeverKills, feverKills),
    score: score.value
  }
  noteQuotaStep(b.x, b.y, heavy)

  const stretch = fromSlide ? clamp(1 + foot.speed / 40, 1, 2.6) : clamp(1 + foot.speed / 90, 1, 1.5)
  emit({
    k: 'squish', x: b.x, y: b.y, bug: b.id, heavy,
    word: splatWord(multiplier), mult: multiplier, stretch,
    // `angle` is the BLOW's line and `face` is the BODY's — the renderer squashes
    // the one along the other, so a ghost of what was just flattened is drawn
    // facing the way the creature was actually facing.
    angle: foot.heading, face: b.heading
  })

  if (spec.coins > 0) emit({ k: 'coin', x: b.x, y: b.y, n: spec.coins })
  if (spec.stinks) spawnHaze(b.x, b.y)
  // A carrier takes its egg down with it, paid as a rung of its own — two for
  // one is the reward for catching the ant before it sets the egg down.
  if (b.carry) { b.carry = false; popEgg(b.x, b.y, chainOk) }

  // A centipede does not die — it SPLITS, unless the head went (or the blow is
  // one that kills outright: a slam finisher, a spent puck).
  if (spec.segments > 0 && b.segs > 1 && !headshot && !forceKill) {
    b.segs = Math.max(1, Math.floor(b.segs / 2))
    const half = spawnBug('centipede', b.x, b.y)
    if (half) {
      half.segs = b.segs
      half.heading = b.heading + Math.PI
      const sp = half.spec.speed * level.speed * difficulty / relief
      half.vx = Math.cos(half.heading) * sp
      half.vy = Math.sin(half.heading) * sp
    }
    b.dmg = 0
    b.stun = 260
    return
  }

  // Chain lightning: the Electric Sock's arcs, before the body is removed so
  // the arc has somewhere to come FROM.
  if (shoe.chain > 0 && chainOk) arcLightning(b.x, b.y, b.id, shoe.chain)

  // The arcs may have killed bodies and swapped this one into another slot, so
  // it is removed by IDENTITY rather than by the index it was hit at.
  killSlot(bugs[i] === b ? i : indexOfBug(b))
}

// ─── Big Finish ─────────────────────────────────────────────────────────────
//
// The last body of a level glows gold and the world holds its breath. Stomp it
// for a board-clear; once you can slam, let the board fill first and SLAM the
// last one for the jackpot — every body on the floor goes in one shockwave. A
// level used to end on whichever ordinary squish met the quota, and the loudest
// frame of every level was the modal after it.

/** Is this level one a Big Finish plays on? Boss levels have their crown
 *  finish instead (the boss dying IS the finale), and a party has no quota. */
const hasFinish = (): boolean => !boss && !level.party && level.quota > 1

/** A squish landed: is it the one that leaves one to go — or the last one? */
const noteQuotaStep = (x: number, y: number, heavy: boolean): void => {
  // Before the early return, and deliberately: the win beat's camera needs a
  // point on EVERY level, including the ones with no Big Finish to remember one
  // for it. See `lastKillX`.
  lastKillX = x
  lastKillY = y
  if (!hasFinish()) return
  const n = squished.value
  if (n === level.quota - 1 && !finale.value) {
    finale.value = true
    emit({ k: 'finishReady' })
  }
  // The blow that meets the quota is remembered: it decides tap or slam, and
  // where the shockwave rolls out from.
  if (n === level.quota) {
    finisherHeavy = heavy
    finisherX = x
    finisherY = y
  }
}

/**
 * The quota fell: play the finisher, BEFORE the level is declared won, so its
 * score reaches the tally and the leaderboard.
 *
 *   slam   every live body on the floor dies in one shockwave, on the chain,
 *          paid a coin per three (capped) — the push-your-luck payout;
 *   tap    the rest of the board panics and scatters, and the afterglow keeps
 *          it running for the second the celebration is drawn over.
 */
const resolveFinisher = (): void => {
  if (!hasFinish()) return
  finale.value = false
  let n = 0
  if (finisherHeavy) {
    forceKill = true
    for (let i = bugCount - 1; i >= 0; i--) {
      if (i >= bugCount) continue
      const b = bugs[i]!
      if (b.spec.airborne && b.dip < 0.55) b.dip = 1
      const before = squished.value
      hitBug(i, 99, true, false, true)
      if (squished.value > before) n++
    }
    forceKill = false
    const coins = Math.min(FINISH_COIN_CAP, Math.floor(n / FINISH_COIN_PER))
    if (coins > 0) emit({ k: 'coin', x: finisherX, y: finisherY, n: coins })
  } else {
    for (let i = 0; i < bugCount; i++) {
      const b = bugs[i]!
      b.panic = SALT_PANIC_MS
      b.rush = 0
      b.heading = Math.atan2(b.y - finisherY, b.x - finisherX)
    }
  }
  afterglow = AFTERGLOW_MS
  // The BLOW, not whichever body the sweep happened to reach last. A heavy
  // finisher kills the whole floor in one shockwave, so every one of those
  // kills wrote itself to `lastKill` on the way past and the last writer is
  // arbitrary — the shot the player wants is where their foot landed.
  if (finisherHeavy) { lastKillX = finisherX; lastKillY = finisherY }
  emit({ k: 'finisher', x: finisherX, y: finisherY, n, heavy: finisherHeavy })
}

/** The Electric Sock's arcs: `n` nearest bodies, each taking one un-chained
 *  blow with the shoe's own pierce. */
const arcLightning = (x: number, y: number, _from: BugId, n: number): void => {
  let left = n
  const reach = 22
  for (let i = bugCount - 1; i >= 0 && left > 0; i--) {
    if (i >= bugCount) continue
    const b = bugs[i]!
    if (b.x === x && b.y === y) continue
    if (dist2(x, y, b.x, b.y) > reach * reach) continue
    emit({ k: 'chain-arc', x0: x, y0: y, x1: b.x, y1: b.y })
    left--
    hitBug(i, shoe.pierce, false, false, false)
  }
}

const syncChain = (): void => {
  chainCount.value = chain.count
  chainMult.value = comboMultiplier(chain.count)
  if (chain.count > 0) setChainRing(chain.windowMs / COMBO_WINDOW_MS)
  else chainLeft.value = 0
}

const spawnHaze = (x: number, y: number): void => {
  for (const z of hazes) {
    if (z.alive) continue
    z.alive = true
    z.x = x
    z.y = y
    z.t = HAZE_MS
    return
  }
}

// ─── Hazards ────────────────────────────────────────────────────────────────

const armMagnets = (): void => {
  for (const h of hazards) {
    if (h.id !== 'magnet') continue
    h.charge = MAGNET_ARMED_MS
    emit({ k: 'magnet', x: h.x, y: h.y })
  }
}

/** A stomp that lands on a shaker tips it; one on a shoebox knocks it open. */
const stompHazards = (x: number, y: number, r: number, heavy = false): void => {
  for (const h of hazards) {
    if (!hazardSpec(h.id).stompable || h.charge < 0) continue
    const reach = r + h.r
    if (dist2(x, y, h.x, h.y) > reach * reach) continue
    if (h.id === 'shoebox') { hitBox(h, heavy); return }
    if (h.id !== 'salt') continue
    h.charge = -1
    h.travel = 0
    emit({ k: 'salt', x: h.x, y: h.y })
    for (let i = 0; i < bugCount; i++) {
      const b = bugs[i]!
      if (dist2(h.x, h.y, b.x, b.y) < SALT_BURST_R * SALT_BURST_R) b.panic = SALT_PANIC_MS
    }
  }
}

// ─── Shoebox Trials ─────────────────────────────────────────────────────────
//
// A present drops onto the floor. Three taps (a slam counts two) and the foot
// wears the shoe inside it for `TRIAL_MS` — the steel boot on the caterpillar
// level, the roller skate on the flea level — and then the sneaker is back and
// the Locker button glows with the shoe's picture. Twelve seconds of OWNING a
// thing is what makes buying it mean something; a stat sheet never did.

/** Is a shoebox under a stomp of radius `r` at (x, y)? Read-only. */
const boxUnder = (x: number, y: number, r: number): boolean => {
  for (const h of hazards) {
    if (h.id !== 'shoebox' || h.charge <= 0) continue
    const reach = r + h.r
    if (dist2(x, y, h.x, h.y) <= reach * reach) return true
  }
  return false
}

/**
 * The shoe a box should hold for THIS player: the authored one, unless they
 * already own it (or have it on), in which case the next shoe they do not own —
 * and if they own the lot, gilded laces. A box is never a shrug.
 */
const trialFor = (authored: ShoeId, taken: ReadonlySet<ShoeId>): ShoeId | 'laces' => {
  const free = (id: ShoeId): boolean =>
    id !== STARTER_SHOE && !ownedShoes.includes(id) && id !== baseShoe.id && !taken.has(id)
  if (free(authored)) return authored
  for (const s of SHOES) if (free(s.id)) return s.id
  return 'laces'
}

/** Drop the level's box (or pair) onto open floor, clear of the foot. */
const dropTrial = (): void => {
  const t = level.trial
  if (!t) return
  trialDropped = true
  const spec = hazardSpec('shoebox')
  const authored: readonly ShoeId[] = Array.isArray(t) ? t : [t as ShoeId]
  const pw = board.x1 - board.x0
  const ph = board.y1 - board.y0
  const taken = new Set<ShoeId>()
  for (let i = 0; i < authored.length; i++) {
    const inside = trialFor(authored[i]!, taken)
    if (inside !== 'laces') taken.add(inside)
    let x = 0
    let y = 0
    for (let attempt = 0; attempt < 10; attempt++) {
      // A pair sits on opposite sides; a single box anywhere open.
      const fx = authored.length === 2 ? (i === 0 ? rndRange(0.15, 0.4) : rndRange(0.6, 0.85)) : rndRange(0.2, 0.8)
      x = board.x0 + pw * fx
      y = board.y0 + ph * rndRange(0.25, 0.75)
      if (dist2(x, y, foot.x, foot.y) >= BOX_CLEAR_U * BOX_CLEAR_U) break
    }
    hazards.push({
      id: 'shoebox', x, y, r: spec.size, angle: 0, phase: rnd(),
      charge: spec.hp ?? 3, travel: 0, dir: 1, seed: 41 + i * 13,
      shoe: inside === 'laces' ? undefined : inside
    })
    emit({ k: 'boxDrop', x, y })
  }
}

/** A blow on a box: count it down, and open it at zero. */
const hitBox = (h: Hazard, heavy: boolean): void => {
  h.charge -= heavy ? 2 : 1
  if (h.charge > 0) {
    emit({ k: 'boxHit', x: h.x, y: h.y, left: h.charge })
    return
  }
  // Open. Its twin, if it had one, goes *poof* — a pair is a CHOICE.
  const inside = h.shoe ?? null
  for (const o of hazards) {
    if (o.id === 'shoebox' && o !== h && o.charge > 0) emit({ k: 'boxPoof', x: o.x, y: o.y })
  }
  hazards = hazards.filter((o) => o.id !== 'shoebox')
  startTrial(inside, h.x, h.y)
}

/** Put the foot in the box's shoe — or, with no shoe inside, gilded laces. */
const startTrial = (id: ShoeId | null, x: number, y: number): void => {
  emit({ k: 'trial', shoe: id, x, y })
  if (id === null) {
    // Gilded laces: a short Fever that costs the vial nothing.
    trialShoe.value = 'laces'
    if (fever.remainMs <= 0) {
      heldJuice = fever.juice
      fever = { juice: 0, remainMs: LACES_MS }
      feverMs.value = fever.remainMs
      juice.value = 0
      emit({ k: 'fever', x, y })
    }
    return
  }
  trialShoe.value = id
  trialMs = TRIAL_MS
  pendingShoe = shoeSpec(id)
}

/** The twelve seconds are up: back into the shoe the player came in. */
const endTrial = (): void => {
  const was = trialShoe.value
  trialShoe.value = null
  trialMs = 0
  pendingShoe = baseShoe
  emit({ k: 'trialEnd', shoe: was === 'laces' ? null : was })
}

const stepHazards = (dt: number): void => {
  for (const h of hazards) {
    h.phase = (h.phase + dt / 2400) % 1
    if (h.id === 'magnet' && h.charge > 0) h.charge = Math.max(0, h.charge - dt)
    if (h.id === 'salt' && h.charge < 0) {
      // `travel` doubles as the burst's 0..1 life once the shaker is spent.
      h.travel = Math.min(1, h.travel + dt / 600)
    }
    if (h.id === 'sweeper') {
      const span = SWEEPER_CROSS_MS + SWEEPER_REST_MS
      h.travel = (h.travel + dt / span) % 1
      const active = h.travel * span < SWEEPER_CROSS_MS
      const k = active ? (h.travel * span) / SWEEPER_CROSS_MS : (h.dir > 0 ? 1 : 0)
      if (!active && h.travel * span > SWEEPER_CROSS_MS + SWEEPER_REST_MS * 0.98) {
        h.dir = h.dir > 0 ? -1 : 1
      }
      const from = h.dir > 0 ? board.x0 - 12 : board.x1 + 12
      const to = h.dir > 0 ? board.x1 + 12 : board.x0 - 12
      h.x = from + (to - from) * k
      if (active) sweepKill(h)
    }
  }
  for (const z of hazes) {
    if (!z.alive) continue
    z.t -= dt
    if (z.t <= 0) z.alive = false
  }
}

const sweepKill = (h: Hazard): void => {
  for (let i = bugCount - 1; i >= 0; i--) {
    const b = bugs[i]!
    if (Math.abs(b.x - h.x) > h.r * 0.5 + b.spec.size) continue
    emit({ k: 'sweep', x: b.x, y: b.y })
    emit({
      k: 'squish', x: b.x, y: b.y, bug: b.id, heavy: true,
      word: 'crunch', mult: 1, stretch: 1.8, angle: 0, face: b.heading
    })
    squished.value++
    const byKind = { ...tally.value.byKind }
    byKind[b.id] = (byKind[b.id] ?? 0) + 1
    tally.value = { ...tally.value, squishes: tally.value.squishes + 1, byKind }
    noteQuotaStep(b.x, b.y, false)
    killSlot(i)
  }
}

/** What the floor at (x, y) does to a body. Returns a speed multiplier and
 *  writes any positional effects straight onto the body. */
const applyTerrain = (b: Bug, dt: number): number => {
  let k = 1
  for (const h of hazards) {
    const spec = hazardSpec(h.id)
    if (h.id === 'sweeper' || h.id === 'shoebox') continue
    if (h.id === 'conveyor') {
      // A belt is a rectangle, not a circle: half its length along `angle` and
      // a fixed half-width across it. `conveyorK` is the Surge twist — the belt
      // thrown into reverse at double speed, then stopped dead.
      if (inLane(h, b.x, b.y)) {
        b.x += Math.cos(h.angle) * CONVEYOR_SPEED * conveyorK * (dt / 1000)
        b.y += Math.sin(h.angle) * CONVEYOR_SPEED * conveyorK * (dt / 1000)
      }
      continue
    }
    if (h.id === 'slick') {
      // The spill: a lane, not a disc. Bodies in it wade and cannot leap.
      if (inLane(h, b.x, b.y)) {
        k *= spec.bugSpeed
        b.sense = Math.min(b.sense, 0)
      }
      continue
    }
    const inside = dist2(b.x, b.y, h.x, h.y) < h.r * h.r
    if (!inside) {
      if (h.id === 'magnet' && h.charge > 0 && b.spec.armor > 0) {
        const reach = h.r * MAGNET_REACH
        if (dist2(b.x, b.y, h.x, h.y) < reach * reach) {
          const a = Math.atan2(h.y - b.y, h.x - b.x)
          b.x += Math.cos(a) * MAGNET_PULL * (dt / 1000)
          b.y += Math.sin(a) * MAGNET_PULL * (dt / 1000)
        }
      }
      continue
    }
    k *= spec.bugSpeed
    if (spec.grounds) {
      b.sense = 0
      if (h.id === 'cobweb' && b.held <= 0 && b.t > 400) b.held = COBWEB_HOLD_MS
    }
    if (h.id === 'crumbs') {
      // Crumbs PULL: ants path toward them, which is how a level makes a swarm
      // walk into one place the player can slam.
      //
      // Sprinters too, and that is the whole of 1-6. A crumb pile is BAIT: a
      // sprinter walking toward a pile is a sprinter walking toward a spot the
      // player already knows, and standing still beside that spot is exactly
      // the thing that does not set it off. The answer to the level before it,
      // handed over one level later.
      if (b.id === 'ant' || b.id === 'sprinter') {
        const a = Math.atan2(h.y - b.y, h.x - b.x)
        b.heading += Math.sin(a - b.heading) * 0.06
      }
    }
  }
  return k
}

// ─── Bug behaviour ──────────────────────────────────────────────────────────

/**
 * Is the shoe COMING FOR this body?
 *
 * Near is not enough and this is the point. The sprinter's whole counter-play
 * is "stop moving, then tap", so the test is on the foot's travel: it has to be
 * inside the sense ring, moving faster than `SPRINT_APPROACH_U_S`, and heading
 * within `SPRINT_APPROACH_DOT` of straight at the body.
 *
 * Deliberately NOT the flea's test. The flea reads the SHADOW — it leaps when
 * something is over it, however that something got there — so a player beats a
 * flea by being quick and beats a sprinter by being still. Two bugs, two verbs.
 */
const footClosingOn = (b: Bug, shadowR: number): boolean => {
  if (foot.speed < SPRINT_APPROACH_U_S) return false
  const sense = shadowR + b.spec.size * SPRINT_SENSE
  const dx = b.x - foot.x
  const dy = b.y - foot.y
  const d2 = dx * dx + dy * dy
  if (d2 > sense * sense) return false
  const d = Math.sqrt(d2)
  // Standing exactly on it counts; there is no direction to test.
  if (d < 1e-3) return true
  return (Math.cos(foot.heading) * dx + Math.sin(foot.heading) * dy) / d > SPRINT_APPROACH_DOT
}

/** Commit a sprinter to its run: straight away from the foot, no randomness. */
const startBolt = (b: Bug): void => {
  const a = Math.atan2(b.y - foot.y, b.x - foot.x)
  const sp = SPRINT_RUN_U / (SPRINT_RUN_MS / 1000)
  b.heading = a
  b.vx = Math.cos(a) * sp
  b.vy = Math.sin(a) * sp
  b.bolt = SPRINT_RUN_MS
  // Measured from the END of the winded pause, so the lockout is two and a bit
  // seconds of plain ant rather than two and a bit seconds that are mostly the
  // bolt the player just watched.
  b.boltCd = SPRINT_RUN_MS + SPRINT_WINDED_MS + SPRINT_COOLDOWN_MS
  b.sense = 0
}

/**
 * A stomp landed at (x, y) with radius `r`. Anything sprint-capable that it
 * NEARLY hit bolts.
 *
 * The touch half of the design — a finger has no hover, so the near miss is the
 * only thing a phone can offer as "the shoe came for it" — and it runs on a
 * mouse too, because a stomp is loud whatever pushed it.
 *
 * Called from `land()` AFTER `resolveArea`, so anything the blow actually
 * killed is already out of the pool and cannot be scared posthumously.
 */
const scareSprinters = (x: number, y: number, r: number): void => {
  for (let i = 0; i < bugCount; i++) {
    const b = bugs[i]!
    if (!b.spec.sprints) continue
    if (b.bolt > 0 || b.boltCd > 0 || b.stun > 0 || b.held > 0) continue
    const d2 = dist2(x, y, b.x, b.y)
    // Outside the kill circle — a blow that reached it was not a near miss,
    // it was a hit that failed some other test — and inside the scare band.
    const near = r * SPRINT_SCARE_SCALE + b.spec.size
    if (d2 <= (r + b.spec.size) * (r + b.spec.size) || d2 > near * near) continue
    if (groundedAt(b)) continue
    // Arm the SHARED tell rather than bolting on the spot: one code path, and
    // the "!" gets its moment on a phone too.
    b.sense = Math.max(b.sense, SPRINT_TELL_MS - SPRINT_SCARE_TELL_MS)
    // A sprinter LINE bolts as one: the near miss on any of them sends the
    // whole conga off, each straight away from the shoe, and they stop winded
    // in a fan — which is the shot to take.
    if (b.rushId > 0) {
      for (let j = 0; j < bugCount; j++) {
        const o = bugs[j]!
        if (o === b || o.rushId !== b.rushId || !o.spec.sprints) continue
        if (o.bolt > 0 || o.boltCd > 0 || o.stun > 0 || o.held > 0) continue
        o.sense = Math.max(o.sense, SPRINT_TELL_MS - SPRINT_SCARE_TELL_MS)
        o.rush = 0
      }
      b.rush = 0
    }
  }
}

/**
 * Is this body standing in something that pins it (honey, cobweb)?
 *
 * `applyTerrain` already zeroes `sense` every step for a grounded body, so a
 * tell armed inside a puddle can never finish — which makes this check
 * redundant TODAY, and only today. It is the order of `stepFoot` before
 * `stepBugs` that makes it redundant, and the rule it is protecting (honey is
 * the answer to the sprinter, taught on 1-9) is worth more than one loop over
 * at most four hazards on the frames a stomp lands. Stated at the site so that
 * reordering the step cannot silently delete a lesson.
 */
const groundedAt = (b: Bug): boolean => {
  for (const h of hazards) {
    if (!hazardSpec(h.id).grounds) continue
    if (h.id === 'slick') { if (inLane(h, b.x, b.y)) return true; continue }
    if (dist2(b.x, b.y, h.x, h.y) < h.r * h.r) return true
  }
  return false
}

const stepBugs = (dt: number): void => {
  const s = dt / 1000
  const shadowR = stompRadius(foot.state === 'charge')
  const tw = twistPhase
  const twistId = level.twist
  // The tell of a twist and of a rush both take the board's breath away: every
  // body slows while the warning is up, so the warning can be READ.
  const tellK = tw === 'tell' && twistId ? twistSpec(twistId).tellSpeed : 1
  const sprinkling = tw === 'active' && twistId === 'sprinkler'
  const drafting = tw === 'active' && twistId === 'draft'
  // From world 3 the gilded last body runs from the shoe — greed with teeth.
  const fleeing = finale.value && level.world >= 3
  for (let i = bugCount - 1; i >= 0; i--) {
    const b = bugs[i]!
    const spec = b.spec
    b.t += dt

    // A puck is the player's ball and rolls in its own pass (`stepPucks`).
    if (b.puck) continue

    if (b.stun > 0) { b.stun -= dt; b.cycle += s * 0.4 }
    if (b.held > 0) b.held -= dt
    if (b.panic > 0) b.panic -= dt
    if (b.boltCd > 0) b.boltCd -= dt
    if (b.rush > 0) b.rush -= dt
    if (b.flipped > 0) {
      // On its back: legs going like mad, going nowhere.
      b.flipped -= dt
      b.cycle = (b.cycle + s * 4) % 1
      continue
    }
    if (b.frozen > 0) { b.frozen -= dt; continue }
    // The draught pushes everything that is not pinned down.
    if (drafting && b.held <= 0) b.x += twistDrift * s
    // The sprinkler herds everything near its wet stripe onto it, into a line.
    if (sprinkling && Math.abs(b.y - twistStripeY) < 34) {
      b.y += (twistStripeY - b.y) * Math.min(1, SPRINKLER_PULL * s)
      if (b.bolt <= 0 && b.sense >= 0) b.heading = Math.cos(b.heading) >= 0 ? 0 : Math.PI
    }
    // A carrier puts its egg down once it has walked far enough to be seen, and
    // only on open floor — an egg set down in the HUD gutter is out of reach.
    if (b.carry && b.t >= CARRIER_WALK_MS && inEggZone(b.x, b.y)) setEggDown(b)

    let speed = spec.speed * level.speed * difficulty / relief * tellK
    if (b.panic > 0) speed *= SALT_PANIC_SPEED
    // A marcher keeps its formation's pace — see `rushK`.
    if (b.rush > 0) speed *= b.rushK
    // Kept, rather than folded straight into `speed`, because a bolt is not
    // driven by `speed` and still has to be slowed by the floor it crosses.
    const terrain = applyTerrain(b, dt)
    speed *= terrain
    if (b.stun > 0 || b.held > 0) speed = 0
    if (fleeing && b.bolt <= 0 && b.sense >= 0) {
      const d2 = dist2(b.x, b.y, foot.x, foot.y)
      if (d2 < FINALE_FLEE_U * FINALE_FLEE_U) {
        b.heading = Math.atan2(b.y - foot.y, b.x - foot.x)
        speed *= 1.4
      }
    }

    // ── The sprinter's bolt ──
    //
    // Two ways in, one way out. A pointer player is felt coming while the shoe
    // is still travelling; a touch player has no hover to be felt, so what
    // scares this one is a tap that landed beside it (`scareSprinters`, off the
    // back of `land()`). Both arm the SAME tell clock, so the "!" the renderer
    // already draws over a flea is the same warning here, and the move that
    // follows it is the same move either way.
    //
    // A silent shoe hides the approach exactly as it hides it from a flea. It
    // does not hide a stomp, because a stomp is a stomp.
    //
    // Note what is NOT here: nothing cancels an armed tell. Honey and cobweb
    // zero `sense` every step from inside `applyTerrain` above, so a grounded
    // sprinter can never finish one — but a player who merely changed their
    // mind cannot un-frighten it. A tell that can be taken back teaches
    // nothing, and this creature exists to be learned.
    // A stunned or held body cannot start a tell and cannot finish one it had
    // going: the clock FREEZES rather than resetting, so a steel boot's slam
    // buys the player the pause and not a fresh start on the same warning.
    if (spec.sprints && b.bolt <= 0 && b.stun <= 0 && b.held <= 0) {
      const armed = b.sense > 0
      const stalked = !touch && !shoe.silent
        && b.boltCd <= 0 && footClosingOn(b, shadowR)
      if (armed || stalked) {
        b.sense += dt
        if (b.sense >= SPRINT_TELL_MS) startBolt(b)
      }
    }

    if (b.bolt > 0) {
      // Mid-run: the launch velocity owns it. No steering, no crumb pull, no
      // wander — it is running in a straight line away from a shoe, and the
      // player has to be able to say exactly where it will stop.
      b.bolt -= dt
      const k = b.held > 0 ? 0 : terrain
      b.x += b.vx * s * k
      b.y += b.vy * s * k
      // Legs at a blur: far faster than the walk cycle would ever drive them.
      b.cycle = (b.cycle + s * 3.4) % 1
      const bx = b.x
      const by = b.y
      bounce(b)
      // A bolt that reaches the edge of the board ENDS there rather than
      // grinding along it. A cornered sprinter is a stationary sprinter, and
      // that is the reward for herding one instead of chasing it.
      if (b.x !== bx || b.y !== by) b.bolt = 0
      if (b.bolt <= 0) {
        b.bolt = 0
        b.vx = 0
        b.vy = 0
        b.stun = Math.max(b.stun, SPRINT_WINDED_MS)
      }
      continue
    }

    // ── The dodge ──
    // A silent shoe never triggers it, which is the Bunny Slipper's whole perk.
    if (spec.dodges && !shoe.silent && b.held <= 0) {
      const sense = shadowR + spec.size * DODGE_SENSE
      if (dist2(foot.x, foot.y, b.x, b.y) < sense * sense && foot.z > 0.05) {
        b.sense += dt
        if (b.sense >= DODGE_TELL_MS) {
          const a = Math.atan2(b.y - foot.y, b.x - foot.x) + rndRange(-0.6, 0.6)
          b.heading = a
          b.vx = Math.cos(a) * (DODGE_LEAP_U / (DODGE_LEAP_MS / 1000))
          b.vy = Math.sin(a) * (DODGE_LEAP_U / (DODGE_LEAP_MS / 1000))
          b.sense = -DODGE_LEAP_MS
        }
      } else if (b.sense > 0) {
        b.sense = Math.max(0, b.sense - dt * 2)
      }
    }
    if (b.sense < 0) {
      // Mid-leap: keep the launch velocity and ignore the steering below.
      b.sense += dt
      b.x += b.vx * s
      b.y += b.vy * s
      b.cycle = (b.cycle + s * 2.2) % 1
      bounce(b)
      continue
    }

    // ── Steering, per motion kind ──
    //
    // A marcher on a Rush Line does not steer: it is walking the lane. (Crumbs
    // still bend it — `applyTerrain` — which is how 1-6's conga knots up on the
    // pile, ready for a bowled beetle.)
    if (b.rush <= 0) switch (spec.motion) {
      case 'march':
        // Straight until the edge. Crumbs bend the heading (see `applyTerrain`).
        break
      case 'crawl':
        b.heading += Math.sin(b.t / 900 + b.phase) * 0.012
        break
      case 'wander':
        b.heading += Math.sin(b.t / 420 + b.phase) * 0.05
        break
      case 'zigzag':
        b.heading += Math.sin(b.t / 130 + b.phase) * 0.28
        break
      case 'serpentine':
        b.heading += Math.sin(b.t / 210 + b.phase) * 0.16
        break
      case 'scurry': {
        // Bursts and pauses. The pause is what makes it stompable at all.
        const cycleT = (b.t + b.phase * 400) % 1100
        if (cycleT < 700) speed *= 1.55
        else speed *= 0.1
        if (cycleT < 20) b.heading = rnd() * Math.PI * 2
        break
      }
      case 'hop': {
        const cycleT = (b.t + b.phase * 300) % 1400
        speed *= cycleT < 400 ? 2.4 : 0.12
        if (cycleT < 16) b.heading += rndRange(-1.1, 1.1)
        break
      }
      case 'drift': {
        // Airborne: a slow circle with a periodic DIP to the floor. Only while
        // dipped can the foot reach it, which is the moth's whole lesson.
        b.heading += 0.012
        const dipT = (b.t + b.phase * 500) % 2600
        b.dip = dipT < 900 ? Math.sin((dipT / 900) * Math.PI) : 0
        break
      }
    }

    if (b.panic > 0) speed *= 1
    b.vx = Math.cos(b.heading) * speed
    b.vy = Math.sin(b.heading) * speed
    b.x += b.vx * s
    b.y += b.vy * s
    b.cycle = (b.cycle + s * (0.5 + speed / 18)) % 1

    if (spec.segments > 0 && b.trail) pushTrail(b)

    // A marcher still walking in from past the edge is not turned back by it.
    if (!entering(b)) bounce(b)
  }
}

/** Keep a body on the board, turning it rather than clamping it — a body that
 *  slides along an edge reads as stuck. */
const bounce = (b: Bug): void => {
  const m = b.spec.size
  const x0 = board.x0 - SPAWN_MARGIN * 1.4
  const x1 = board.x1 + SPAWN_MARGIN * 1.4
  const y0 = board.y0 - SPAWN_MARGIN * 1.4
  const y1 = board.y1 + SPAWN_MARGIN * 1.4
  // Outside the generous margin, it has genuinely left: turn it back in hard.
  if (b.x < x0) { b.x = x0; b.heading = Math.abs(Math.cos(b.heading)) > 0.01 ? Math.PI - b.heading : b.heading }
  else if (b.x > x1) { b.x = x1; b.heading = Math.PI - b.heading }
  if (b.y < y0) { b.y = y0; b.heading = -b.heading }
  else if (b.y > y1) { b.y = y1; b.heading = -b.heading }
  // Inside the play rect, keep the body a body-width clear of the HUD gutters.
  b.x = clamp(b.x, x0 - m, x1 + m)
  b.y = clamp(b.y, y0 - m, y1 + m)
}

const pushTrail = (b: Bug): void => {
  const tr = b.trail!
  b.trailN = (b.trailN + 1) % TRAIL_LEN
  tr[b.trailN * 2] = b.x
  tr[b.trailN * 2 + 1] = b.y
}

/**
 * Where segment `k` of a centipede is, written into `out`.
 *
 * Sampled from the head's own path history rather than simulated, which is both
 * far cheaper and the only way a tail reads as ONE creature: every segment goes
 * exactly where the head went, `SEG_GAP` behind the one in front of it.
 */
export const segmentAt = (b: Bug, k: number, out: { x: number; y: number; a: number }): void => {
  const tr = b.trail
  if (!tr) { out.x = b.x; out.y = b.y; out.a = b.heading; return }
  // The trail is sampled once per step, so a fixed number of samples back is a
  // fixed DISTANCE back only at a fixed speed. Walk it instead.
  let want = SEG_GAP * k
  let idx = b.trailN
  let px = tr[idx * 2]!
  let py = tr[idx * 2 + 1]!
  for (let n = 0; n < TRAIL_LEN - 1; n++) {
    const prev = (idx - 1 + TRAIL_LEN) % TRAIL_LEN
    const qx = tr[prev * 2]!
    const qy = tr[prev * 2 + 1]!
    const d = Math.hypot(qx - px, qy - py)
    if (d >= want) {
      const t = d > 0 ? want / d : 0
      out.x = px + (qx - px) * t
      out.y = py + (qy - py) * t
      out.a = Math.atan2(py - qy, px - qx)
      return
    }
    want -= d
    idx = prev
    px = qx
    py = qy
  }
  out.x = px
  out.y = py
  out.a = b.heading
}

// ─── The boss ───────────────────────────────────────────────────────────────

/**
 * Put the level's boss on the floor, at the level's strength.
 *
 * `spec` is the SCALED spec from here on, and everything downstream reads it
 * off the boss rather than off the table — hits per phase, adds per beat, the
 * pod quota and hatch clock, the wind-up — so a half-strength Queen cannot be
 * half-strength in the bar and full-strength in the fight.
 */
const spawnBoss = (id: LevelSpec['boss'], scale: number): void => {
  if (!id) return
  const spec = bossSpec(id, scale)
  boss = {
    spec,
    x: (board.x0 + board.x1) / 2,
    y: board.y0 + (board.y1 - board.y0) * 0.3,
    vx: 0, vy: 0,
    size: Math.min(spec.size, Math.min(board.x1 - board.x0, board.y1 - board.y0) * 0.22),
    phase: 0, hits: 0, beat: 0, sub: 'idle', subT: 0, aim: 0,
    iframe: 0, podsDown: 0, eggClock: 0, laying: 0, alive: true, dying: 0
  }
}

/**
 * One of the boss's own adds, if the board has room for it.
 *
 * Summons used to ignore `maxAlive` — harmless while every policy hit the boss
 * straight away, and a flood the moment anybody did not: a player lingering in
 * the Queen's first phase on 1-10 (scouted, hunting the chain star) had thirty
 * ants on a phone-sized board, twice the level's own ceiling. The boss level's
 * cap is the one every other body already minds, eggs' hatchlings included.
 */
const summonAdd = (id: BugId, x: number, y: number): void => {
  if (bugCount >= level.maxAlive) return
  spawnBug(id, x, y, true)
}

const stepBoss = (dt: number): void => {
  const bs = boss
  if (!bs) return
  if (!bs.alive) {
    bs.dying += dt
    return
  }
  const p = bs.spec.phases[bs.phase]!
  const s = dt / 1000
  bs.beat += dt
  bs.eggClock += dt
  if (bs.iframe > 0) bs.iframe -= dt
  if (bs.laying > 0) bs.laying -= dt

  const sp = p.speed * difficulty

  switch (p.script) {
    case 'patrol':
    case 'summon': {
      // A wide figure-of-eight across the top half — always reachable, never
      // sitting still, and never in the bottom third where the HUD lives.
      const t = bs.beat / 2600
      const cx = (board.x0 + board.x1) / 2
      const cy = board.y0 + (board.y1 - board.y0) * 0.34
      const rx = (board.x1 - board.x0) * 0.3
      const ry = (board.y1 - board.y0) * 0.16
      const nx = cx + Math.sin(t) * rx
      const ny = cy + Math.sin(t * 2) * ry
      bs.aim = Math.atan2(ny - bs.y, nx - bs.x)
      bs.x += (nx - bs.x) * Math.min(1, sp * s * 0.35)
      bs.y += (ny - bs.y) * Math.min(1, sp * s * 0.35)
      if (p.script === 'summon' && bs.beat > p.beatMs) {
        bs.beat = 0
        for (let i = 0; i < p.addCount; i++) {
          const id = p.adds[i % p.adds.length]
          if (id) summonAdd(id, bs.x + rndRange(-6, 6), bs.y + rndRange(-6, 6))
        }
      }
      break
    }
    case 'pods': {
      bs.x += Math.cos(bs.beat / 900) * sp * s
      bs.y = clamp(bs.y, board.y0 + 12, board.y0 + (board.y1 - board.y0) * 0.4)
      if (bs.beat > p.beatMs) {
        bs.beat = 0
        // The beat IS the clutch here, and `deliverEgg` still minds the cap: a
        // player who has let four eggs pile up is not handed a fifth and sixth.
        for (let i = 0; i < POD_PER_BEAT; i++) deliverEgg(bs)
      }
      break
    }
    case 'charge': {
      bs.subT += dt
      if (bs.sub === 'idle') { bs.sub = 'tell'; bs.subT = 0; bs.aim = Math.atan2(foot.y - bs.y, foot.x - bs.x) }
      else if (bs.sub === 'tell' && bs.subT > CHARGE_TELL_MS) { bs.sub = 'windup'; bs.subT = 0 }
      else if (bs.sub === 'windup' && bs.subT > bs.spec.windupMs) { bs.sub = 'run'; bs.subT = 0 }
      else if (bs.sub === 'run') {
        bs.x += Math.cos(bs.aim) * p.speed * s
        bs.y += Math.sin(bs.aim) * p.speed * s
        // A charge that leaves the board turns around rather than vanishing.
        if (bs.x < board.x0 || bs.x > board.x1 || bs.y < board.y0 || bs.y > board.y1) {
          bs.x = clamp(bs.x, board.x0, board.x1)
          bs.y = clamp(bs.y, board.y0, board.y1)
          bs.sub = 'spent'
          bs.subT = 0
          layOnSpent(bs, p)
        }
        if (bs.sub === 'run' && bs.subT > CHARGE_RUN_MS) { bs.sub = 'spent'; bs.subT = 0; layOnSpent(bs, p) }
      } else if (bs.sub === 'spent' && bs.subT > bs.spec.spentMs) { bs.sub = 'idle'; bs.subT = 0 }
      if (bs.beat > p.beatMs && p.adds.length > 0) {
        bs.beat = 0
        const id = p.adds[0]
        if (id) summonAdd(id, bs.x + rndRange(-8, 8), bs.y + rndRange(-8, 8))
      }
      break
    }
    case 'spin': {
      bs.subT += dt
      bs.aim += s * 4
      const t = bs.beat / 1800
      bs.x = (board.x0 + board.x1) / 2 + Math.sin(t) * (board.x1 - board.x0) * 0.22
      bs.y = board.y0 + (board.y1 - board.y0) * 0.34 + Math.cos(t * 1.3) * (board.y1 - board.y0) * 0.1
      break
    }
    case 'shield': {
      const t = bs.beat / 2200
      bs.x = (board.x0 + board.x1) / 2 + Math.sin(t) * (board.x1 - board.x0) * 0.26
      bs.y = board.y0 + (board.y1 - board.y0) * 0.3
      if (bs.beat > p.beatMs) {
        bs.beat = 0
        for (let i = 0; i < p.addCount; i++) {
          const id = p.adds[i % p.adds.length]
          if (id) summonAdd(id, bs.x + rndRange(-10, 10), bs.y + rndRange(-4, 10))
        }
      }
      break
    }
    case 'beam': {
      bs.subT += dt
      if (bs.sub !== 'beam') { bs.sub = 'beam'; bs.subT = 0; bs.aim = -Math.PI / 2 }
      if (bs.subT < BEAM_TELL_MS) {
        bs.aim = Math.atan2(foot.y - bs.y, foot.x - bs.x)
      } else if (bs.subT < BEAM_TELL_MS + BEAM_SWEEP_MS) {
        bs.aim += s * 1.2
        beamKill(bs)
      } else {
        bs.subT = 0
      }
      bs.x = (board.x0 + board.x1) / 2
      bs.y = board.y0 + (board.y1 - board.y0) * 0.26
      break
    }
  }

  bs.x = clamp(bs.x, board.x0 + bs.size * 0.5, board.x1 - bs.size * 0.5)
  bs.y = clamp(bs.y, board.y0 + bs.size * 0.5, board.y1 - bs.size * 0.5)

  // The brood's clutch clock, for every phase that has one and is not already
  // laying on a rhythm of its own: a `pods` phase lays on its beat, and a boss
  // that LAYS while charging lays when a charge is spent (`layOnSpent`). A
  // clutch refused by the cap keeps its clock, so the next one comes the
  // moment the floor has room for it.
  if (p.eggMs > 0 && p.script !== 'pods' && !(p.script === 'charge' && bs.spec.delivery === 'lay')
    && bs.eggClock >= p.eggMs && deliverEgg(bs)) bs.eggClock = 0

  // Every egg's own clock. A laid egg ticks from the moment it lands.
  for (const pod of pods) {
    if (!pod.alive) continue
    if (pod.fly > 0) {
      pod.fly -= dt
      if (pod.fly <= 0) { pod.fly = 0; emit({ k: 'podLand', x: pod.x, y: pod.y }) }
      continue
    }
    pod.t -= dt
    if (pod.t <= 0) hatchEgg(bs, pod)
  }
}

// ─── The brood ──────────────────────────────────────────────────────────────
//
// See "The brood" in `bosses.ts` for the design and its numbers. Everything here
// is a scan over two fixed pools — twelve egg slots, the live bodies — with no
// allocation, and runs only on the frames an egg is laid, set down, hatched or
// popped.

/** Eggs in play: on the floor, in the air, or over a carrier's head. */
const liveEggs = (): number => {
  let n = 0
  for (const pod of pods) if (pod.alive) n++
  for (let i = 0; i < bugCount; i++) if (bugs[i]!.carry) n++
  return n
}

const liveHatchlings = (): number => {
  let n = 0
  for (let i = 0; i < bugCount; i++) if (bugs[i]!.hatched) n++
  return n
}

/** Open floor an egg may lie on: clear of the board's edges, where the HUD's
 *  gutters are and a foot has to fight the clamp to reach. */
const EGG_EDGE_U = 9
const inEggZone = (x: number, y: number): boolean =>
  x >= board.x0 + EGG_EDGE_U && x <= board.x1 - EGG_EDGE_U
  && y >= board.y0 + EGG_EDGE_U && y <= board.y1 - EGG_EDGE_U

/** Put an egg on the floor at (x, y), hopping in from (fromX, fromY) over
 *  `flyMs` — 0 for none. False when the pool is full. */
const placeEgg = (x: number, y: number, fromX: number, fromY: number, flyMs: number): boolean => {
  const bs = boss
  if (!bs) return false
  for (const pod of pods) {
    if (pod.alive) continue
    pod.alive = true
    pod.x = clamp(x, board.x0 + EGG_EDGE_U, board.x1 - EGG_EDGE_U)
    pod.y = clamp(y, board.y0 + EGG_EDGE_U, board.y1 - EGG_EDGE_U)
    pod.fromX = fromX
    pod.fromY = fromY
    pod.fly = flyMs
    pod.flyMs = Math.max(1, flyMs)
    pod.t = bs.spec.podHatchMs
    pod.hatchMs = bs.spec.podHatchMs
    pod.seed = rnd()
    return true
  }
  return false
}

/** One egg, the way THIS boss brings them. False when the cap, the pool or the
 *  board refused it. */
const deliverEgg = (bs: Boss): boolean => {
  if (liveEggs() >= bs.spec.eggCap) return false
  return bs.spec.delivery === 'haul' ? sendCarrier() : layEgg(bs)
}

/**
 * The boss lays: out of its back end, in a hop, onto the floor beside it.
 *
 * "Behind" is behind a charge (the Queen lands her egg in the lane she just ran
 * down, which is where the player has just dodged to), and down the board for
 * everything else — a boss lives in the top third, so down is towards the
 * player and never into the top edge.
 */
const layEgg = (bs: Boss): boolean => {
  const p = bs.spec.phases[bs.phase]!
  const back = p.script === 'charge' ? bs.aim + Math.PI : Math.PI / 2
  const a = back + rndRange(-1, 1)
  const d = bs.size + rndRange(EGG_LAND_U[0], EGG_LAND_U[1])
  const fx = bs.x + Math.cos(back) * bs.size * 0.55
  const fy = bs.y + Math.sin(back) * bs.size * 0.55
  if (!placeEgg(bs.x + Math.cos(a) * d, bs.y + Math.sin(a) * d, fx, fy, EGG_LAY_MS)) return false
  bs.laying = EGG_LAY_MS
  return true
}

/** A carrier ant walks in from an edge with the egg. It is a body like any
 *  other, so it minds the level's `maxAlive` as every body does. */
const sendCarrier = (): boolean => {
  if (bugCount >= level.maxAlive) return false
  const b = spawnBug('ant', undefined, undefined, true)
  if (!b) return false
  b.carry = true
  return true
}

/** The carrier sets its egg down in front of itself and turns back the way it
 *  came, so it walks away from the egg rather than over it. */
const setEggDown = (b: Bug): void => {
  const hx = b.x + Math.cos(b.heading) * b.spec.size
  const hy = b.y + Math.sin(b.heading) * b.spec.size
  const ahead = b.spec.size * 2.2
  if (!placeEgg(b.x + Math.cos(b.heading) * ahead, b.y + Math.sin(b.heading) * ahead, hx, hy, 180)) return
  b.carry = false
  b.heading += Math.PI
  const sp = b.spec.speed * level.speed * difficulty / relief
  b.vx = Math.cos(b.heading) * sp
  b.vy = Math.sin(b.heading) * sp
}

/**
 * A laying boss's charge is spent: lay, and HOLD STILL while doing it.
 *
 * The hold is a negative `subT`, so the spent window the counter-slam already
 * reads (`bossStomp`'s `open`) simply runs `layHoldMs` longer — no new state
 * for the sim, the renderer or the lesson to learn. `eggMs` is the shortest gap
 * between two lays, so a counter-slam that spends a charge early does not buy
 * a second egg a beat later.
 */
const layOnSpent = (bs: Boss, p: BossPhase): void => {
  if (bs.spec.delivery !== 'lay' || p.eggMs <= 0 || bs.eggClock < p.eggMs) return
  if (!deliverEgg(bs)) return
  bs.eggClock = 0
  bs.subT = -bs.spec.layHoldMs
}

/**
 * The clock ran out: the egg splits and the ants scurry out.
 *
 * Only as many as there is ROOM for under both caps. With no room at all the egg
 * does not hatch — it waits on its last crack, wobbling, at `t = 0` — because an
 * egg that pops with nothing in it, or silently vanishes, teaches that watching
 * the cracks was pointless.
 */
const hatchEgg = (bs: Boss, pod: Pod): void => {
  const room = Math.min(
    bs.spec.broodAnts,
    bs.spec.hatchlingCap - liveHatchlings(),
    level.maxAlive - bugCount
  )
  if (room <= 0) { pod.t = 0; return }
  pod.alive = false
  emit({ k: 'podHatch', x: pod.x, y: pod.y, n: room })
  for (let i = 0; i < room; i++) {
    // Evenly spread OUT of the shell, each at salt-panic speed for a moment — a
    // scurry, not three ants standing on a spot.
    const a = pod.seed * Math.PI * 2 + (i / room) * Math.PI * 2 + rndRange(-0.3, 0.3)
    const b = spawnBug('ant', pod.x + Math.cos(a) * 1.5, pod.y + Math.sin(a) * 1.5, true)
    if (!b) break
    b.hatched = true
    b.heading = a
    b.panic = HATCH_SCURRY_MS
    const sp = b.spec.speed * level.speed * difficulty / relief
    b.vx = Math.cos(a) * sp
    b.vy = Math.sin(a) * sp
  }
}

/**
 * An egg was popped — under a foot, or in a carrier's arms. Paid exactly as a
 * kill is paid: a rung on the chain (unless an Electric Sock arc did it — see
 * `hitBug`'s `chainOk`), points on the multiplier, juice with the chain bonus,
 * a hit on the tally. Never a squish: the level's quota and the kind objectives
 * count creatures, and an egg is not one.
 *
 * In a `pods` phase it is also the phase's progress.
 */
const popEgg = (x: number, y: number, chainOk: boolean): void => {
  podsPopped.value++
  let multiplier = comboMultiplier(chain.count)
  if (chainOk) {
    const r = chainHit(chain)
    chain = r.next
    multiplier = r.multiplier
    syncChain()
    emit({ k: 'chain', n: chain.count, mult: multiplier, step: comboMultiplier(chain.count) > comboMultiplier(chain.count - 1) })
  }
  const feverBonus = fever.remainMs > 0 ? FEVER.scoreScale : 1
  score.value += Math.round(squishScore(EGG_SCORE, multiplier) * feverBonus)
  fever = { ...fever, juice: Math.min(1, fever.juice + juiceGain(EGG_JUICE, multiplier)) }
  if (fever.remainMs <= 0) juice.value = fever.juice
  const t = tally.value
  tally.value = {
    ...t, hits: t.hits + 1, bestCombo: Math.max(t.bestCombo, multiplier), score: score.value
  }
  emit({ k: 'podPop', x, y, mult: multiplier, word: splatWord(multiplier) })

  const bs = boss
  if (!bs || !bs.alive) return
  if (bs.spec.phases[bs.phase]!.script !== 'pods') return
  bs.podsDown++
  if (bs.podsDown >= bs.spec.podQuota) advanceBossPhase()
}

const beamKill = (bs: Boss): void => {
  for (let i = bugCount - 1; i >= 0; i--) {
    const b = bugs[i]!
    const dx = b.x - bs.x
    const dy = b.y - bs.y
    const along = dx * Math.cos(bs.aim) + dy * Math.sin(bs.aim)
    const across = -dx * Math.sin(bs.aim) + dy * Math.cos(bs.aim)
    if (along < 0 || Math.abs(across) > BEAM_HALF) continue
    // The beam is the boss's own weapon and it kills its own adds — which is the
    // whole reason a player learns to stand behind them.
    emit({
      k: 'squish', x: b.x, y: b.y, bug: b.id, heavy: true,
      word: 'crunch', mult: 1, stretch: 1.4, angle: bs.aim, face: b.heading
    })
    killSlot(i)
  }
}

/**
 * A stomp against the boss.
 *
 * Returns whether the blow LANDED ON THE BODY — damage, ricochet, or a hit
 * inside the boss's own invulnerability window alike. The caller folds that
 * into the same `hit` that decides whether a stomp was a miss.
 *
 * That is not bookkeeping, it is the boss fight working at all: `resolveArea`
 * only counts bugs, so a clean blow on a boss with no add in the circle used to
 * read as a stomp on bare floor. It broke the chain, added a miss to the tally
 * and made the accuracy objective unreachable on every boss level — a fight
 * could not be fought without wrecking the run it was part of.
 */
const bossStomp = (x: number, y: number, r: number, heavy: boolean): boolean => {
  const bs = boss
  if (!bs || !bs.alive) return false
  const reach = r + bs.size
  if (dist2(x, y, bs.x, bs.y) > reach * reach) return false
  // On the body, but inside the window after the last blow: it still LANDED.
  if (bs.iframe > 0) return true
  const p = bs.spec.phases[bs.phase]!

  // A `pods` phase is armoured until its pods are cleared, and a charging boss
  // can only be hurt during the wind-up — the counter window.
  //
  // A `shield` opens to a SLAM and to nothing else — which is the whole of what
  // `PhaseScript` says it is. It used to read `vulnerable` alone, and a shield
  // phase is `vulnerable: false` by definition, so no blow ever landed: scouted
  // on 4-10, the `good` player slammed Roach Prime fifty-five times in the steel
  // boot and ran the clock out on a full bar, every seed. The final boss of the
  // game could not be beaten.
  const counter = p.script === 'charge' && bs.sub === 'windup' && heavy
  const open = p.script === 'shield'
    ? heavy
    : p.vulnerable && (p.script !== 'charge' || bs.sub === 'windup' || bs.sub === 'spent')
  if (!open) { emit({ k: 'clang', x: bs.x, y: bs.y }); return true }
  if (blowPierce(shoe, heavy) < p.armor) { emit({ k: 'clang', x: bs.x, y: bs.y }); return true }

  bs.hits += counter ? CHARGE_COUNTER_HITS : 1
  bs.iframe = 260
  if (counter) { bs.sub = 'spent'; bs.subT = 0; layOnSpent(bs, p) }
  emit({ k: 'bossHit', x: bs.x, y: bs.y, counter })
  score.value += 120
  fever = { ...fever, juice: Math.min(1, fever.juice + 0.05) }
  if (fever.remainMs <= 0) juice.value = fever.juice
  syncBossHp()

  if (bs.hits >= p.hits) advanceBossPhase()
  return true
}

/** Is a live pod inside a stomp of radius `r` at (x, y)? Read-only — the same
 *  reach `stompPods` pops with. An egg still in its hop is not on the floor. */
const podUnder = (x: number, y: number, r: number): boolean => {
  const reach = r + POD_SIZE
  for (const pod of pods) {
    if (pod.alive && pod.fly <= 0 && dist2(x, y, pod.x, pod.y) <= reach * reach) return true
  }
  return false
}

/** A stomp that lands on a pod. Paid, and counted, by `popEgg`. */
const stompPods = (x: number, y: number, r: number): void => {
  if (!boss) return
  for (const pod of pods) {
    if (!pod.alive || pod.fly > 0) continue
    const reach = r + POD_SIZE
    if (dist2(x, y, pod.x, pod.y) > reach * reach) continue
    pod.alive = false
    popEgg(pod.x, pod.y, true)
  }
}

const advanceBossPhase = (): void => {
  const bs = boss
  if (!bs) return
  if (bs.phase >= bs.spec.phases.length - 1) {
    bs.alive = false
    bs.dying = 0
    score.value += bs.spec.score
    // ── The board keeps living while the boss dies ──
    //
    // `finish` stops the step dead, and the only thing that ever re-opened it
    // was `resolveFinisher`'s afterglow — which a boss level never reaches,
    // because the boss dying IS the finish. So the death animation the renderer
    // has always had (a 1.2 s squash-roll-and-fade, keyed off `dying`) never
    // advanced a millisecond: the queen froze mid-stride at full opacity while a
    // ring expanded past her. Two minutes of fight ended on a still frame.
    //
    // The afterglow is what that animation runs on, so a boss kill claims one
    // the same way a tap finisher does, and `step` advances the boss through it.
    afterglow = BOSS_AFTERGLOW_MS
    // The body IS the win condition on this level, so it is what the win beat
    // holds on — not the last ant her beam happened to catch.
    lastKillX = bs.x
    lastKillY = bs.y
    emit({ k: 'bossDown', x: bs.x, y: bs.y })
    bossHp.value = 0
    finish(true)
    return
  }
  bs.phase++
  bs.hits = 0
  bs.beat = 0
  bs.sub = 'idle'
  bs.subT = 0
  bs.podsDown = 0
  // Clearing an egg phase BURSTS the rest of its clutch, paid pop by pop — the
  // eggs used to be wiped silently with the phase, which was harmless while an
  // egg was a chore and would now be a reward vanishing from under the foot.
  // Not left to hatch either: scouted on 1-4, a pair of leftover eggs hatching
  // into the charge phase was the difference between a weak player slamming
  // the Queen and chasing ants for forty seconds (13 of 15 wins → 12). The
  // phase that asks for the slam starts on a clean floor; its own eggs come
  // one at a time, as the tell for her open window (`layOnSpent`).
  if (bs.spec.phases[bs.phase - 1]!.script === 'pods') {
    for (const pod of pods) {
      if (!pod.alive) continue
      pod.alive = false
      popEgg(pod.x, pod.y, true)
    }
  }
  bossPhaseIndex.value = bs.phase
  bossTell.value = bs.spec.phases[bs.phase]!.tell
  emit({ k: 'bossPhase', n: bs.phase })
  syncBossHp()
}

const syncBossHp = (): void => {
  const bs = boss
  if (!bs) { bossHp.value = 1; return }
  let done = bs.hits
  for (let i = 0; i < bs.phase; i++) done += bs.spec.phases[i]!.hits
  let total = 0
  for (const p of bs.spec.phases) total += p.hits
  bossHp.value = clamp(1 - done / total, 0, 1)
}

// ─── Uh-oh! Twists ──────────────────────────────────────────────────────────
//
// See `game/twists.ts` for what each one is and the rules they keep. The
// director here is a four-state clock — told, running, its payoff, done — that
// fires once a level at `TWIST_AT` of the quota. A level keeps its twist on
// replay: it is part of the board.

/** The glitch twist is on: every robobug's plate is down. */
const glitchOn = (): boolean => twistPhase === 'active' && level.twist === 'glitch'

/** Lay the spill's lane across the board's short axis, clear of the foot. */
const laySpill = (): void => {
  const pw = board.x1 - board.x0
  const ph = board.y1 - board.y0
  const across = pw <= ph
  const half = hazardSpec('slick').size
  const lo = (across ? board.y0 : board.x0) + 16
  const hi = (across ? board.y1 : board.x1) - 16
  const footAt = across ? foot.y : foot.x
  let at = lo + rnd() * Math.max(1, hi - lo)
  for (let attempt = 0; attempt < 8 && Math.abs(at - footAt) < 22; attempt++) {
    at = lo + rnd() * Math.max(1, hi - lo)
  }
  const len = (across ? pw : ph) / 2 + 6
  hazards.push({
    id: 'slick',
    x: across ? board.x0 + pw / 2 : at,
    y: across ? at : board.y0 + ph / 2,
    r: len, angle: across ? 0 : Math.PI / 2,
    phase: 0, charge: 0, travel: 0, dir: 1, seed: 29,
    stretch: len / half
  })
}

const startTwist = (id: TwistId): void => {
  twistPhase = 'active'
  twistT = 0
  switch (id) {
    case 'spill':
      laySpill()
      break
    case 'sprinkler': {
      // The wet stripe runs across the board at a row clear of the shoe.
      const ph = board.y1 - board.y0
      twistStripeY = board.y0 + ph * (foot.y > board.y0 + ph / 2 ? 0.3 : 0.7)
      break
    }
    case 'draft':
      twistDrift = (rnd() < 0.5 ? -1 : 1) * DRAFT_PUSH
      break
    case 'surge':
      conveyorK = SURGE_SPEED
      break
    case 'glitch':
      // Every robobug stutters in place for the whole glitch.
      for (let i = 0; i < bugCount; i++) {
        const b = bugs[i]!
        if (b.id === 'robobug') b.stun = Math.max(b.stun, twistSpec('glitch').activeMs)
      }
      break
    case 'blackout':
      break
  }
  emit({ k: 'twistStart', id })
}

const endTwist = (id: TwistId): void => {
  const spec = twistSpec(id)
  switch (id) {
    case 'spill':
      hazards = hazards.filter((h) => h.id !== 'slick')
      break
    case 'blackout':
      // The lights come back and nobody is ready: a second of frozen, blinking
      // bodies — the free chain the dark was paying for.
      for (let i = 0; i < bugCount; i++) bugs[i]!.frozen = spec.afterMs
      break
    case 'draft':
      twistDrift = 0
      break
    case 'surge':
      // Stopped dead — everything that was riding it piles up.
      conveyorK = 0
      break
    default:
      break
  }
  emit({ k: 'twistEnd', id })
  if (spec.afterMs > 0) { twistPhase = 'after'; twistT = 0 } else twistPhase = 'done'
}

const stepTwist = (dt: number): void => {
  const id = level.twist
  if (!id || twistPhase === 'done' || boss || level.party) return
  const spec = twistSpec(id)
  if (twistPhase === 'idle') {
    if (level.quota <= 0 || squished.value < level.quota * TWIST_AT) return
    // Not over a rush's tell, and never in the last body of the level.
    if (rushPhase === 'tell' || finale.value) return
    twistPhase = 'tell'
    twistT = 0
    emit({ k: 'twistTell', id })
    return
  }
  twistT += dt
  if (twistPhase === 'tell' && twistT >= spec.tellMs) startTwist(id)
  else if (twistPhase === 'active' && twistT >= spec.activeMs) endTwist(id)
  else if (twistPhase === 'after' && twistT >= spec.afterMs) {
    twistPhase = 'done'
    conveyorK = 1
  }
}

// ─── Boss Trophies that run on the clock ────────────────────────────────────

/** The Quake Slam's ring rolls out along the floor, stunning and flipping. */
const stepQuake = (dt: number): void => {
  if (!quake.active) return
  const r0 = quake.r
  quake.r += QUAKE_SPEED * (dt / 1000)
  for (let i = 0; i < bugCount; i++) {
    const b = bugs[i]!
    if (b.puck) continue
    const d = Math.sqrt(dist2(quake.x, quake.y, b.x, b.y))
    if (d < r0 - b.spec.size || d > quake.r + b.spec.size) continue
    b.stun = Math.max(b.stun, QUAKE_STUN_MS)
    flipBody(b)
  }
  if (quake.r >= QUAKE_REACH) quake.active = false
}

/** The Echo Stomp's second blow, on the same spot. Never a miss: an echo that
 *  lands on bare floor is the floor ringing, not the player being wrong. */
const stepEcho = (): void => {
  if (echo.at < 0 || elapsed < echo.at) return
  echo.at = -1
  emit({ k: 'echo', x: echo.x, y: echo.y, r: echo.r })
  stompKills = 0
  inStomp = true
  resolveArea(echo.x, echo.y, echo.r, true, false)
  inStomp = false
  if (boss) bossStomp(echo.x, echo.y, echo.r, true)
  stompHazards(echo.x, echo.y, echo.r, true)
}

// ─── The clock and the end ──────────────────────────────────────────────────

const finish = (won: boolean): void => {
  if (phase.value !== 'play') return
  running = false
  phase.value = won ? 'won' : 'lost'
  finale.value = false
  // A party's gilded boot, or a pair of gilded laces, was never bought with the
  // player's vial — hand it back now, so the next level opens with what they
  // walked in with.
  if (heldJuice !== null) {
    fever = { juice: heldJuice, remainMs: 0 }
    heldJuice = null
    feverMs.value = 0
    juice.value = fever.juice
  }
  tally.value = {
    ...tally.value,
    cleared: won,
    // From the float clock, not the printed second: the stars are scored off
    // this, and rounding a number that was already rounded for a HUD chip would
    // hand out a "finish with N seconds left" star half a second early.
    timeLeft: Math.max(0, Math.round(clockMs / 1000)),
    score: score.value
  }
  emit({ k: 'end', won, x: lastKillX, y: lastKillY })
}

/** Force the level to end — the pause menu's "give up", and the recorder's. */
export const endLevel = (won: boolean): void => finish(won)

/**
 * Take the boss down from wherever the fight has got to, through the real last
 * blow — the same `advanceBossPhase` branch that claims the afterglow, emits
 * `bossDown` and wins the level.
 *
 * A seam, and it exists because the DEATH cannot otherwise be reached in a
 * headless test: every fight's last phase is armoured and open only on a counter
 * window, so a suite that fought its way there would be testing the counter and
 * the level clock instead of the ending, and would not finish inside either. The
 * only thing this skips is the fighting.
 */
export const __bossDown = (): void => {
  const bs = boss
  if (!bs || !bs.alive || phase.value !== 'play') return
  bs.phase = bs.spec.phases.length - 1
  advanceBossPhase()
}

// ─── The step ───────────────────────────────────────────────────────────────

let acc = 0

/**
 * Advance the world by `frameMs` of wall time.
 *
 * Returns the number of sub-steps run, which the perf probe reads as
 * work-per-frame.
 */
export const step = (frameMs: number): number => {
  // The afterglow of a won level: the board keeps moving (the tap finisher's
  // scatter, and a beaten boss falling over) for the second the celebration is
  // drawn over. Nothing is scored.
  if (!running && phase.value === 'won' && afterglow > 0) {
    const dt = Math.min(frameMs, STEP_MS * MAX_SUBSTEPS)
    afterglow -= dt
    stepBugs(dt)
    // `stepBoss` on a dead boss does exactly one thing — advance `dying`, which
    // is the clock its whole death animation is drawn off. Without it the body
    // is frozen at full opacity for the entire celebration.
    if (boss) stepBoss(dt)
    return 1
  }
  if (!running || phase.value !== 'play') return 0
  acc += Math.min(frameMs, STEP_MS * MAX_SUBSTEPS * 2)
  let n = 0
  while (acc >= STEP_MS && n < MAX_SUBSTEPS) {
    acc -= STEP_MS
    substep(STEP_MS)
    n++
    if (phase.value !== 'play') break
  }
  return n
}

const substep = (dt: number): void => {
  elapsed += dt
  sinceSquish += dt

  stepFoot(dt)
  stepBugs(dt)
  stepPucks(dt)
  stepHazards(dt)
  stepRush(dt)
  stepSpawns(dt)
  stepTwist(dt)
  stepQuake(dt)
  stepEcho()
  if (!trialDropped && level.trial && level.quota > 0 && squished.value >= level.quota * (level.trialAt ?? 0.35)) {
    dropTrial()
  }
  if (boss) {
    stepBoss(dt)
    // Pods are stomped by the foot's own landing; the check lives here so it
    // runs after the pods have moved and before the phase can advance.
    if (foot.state === 'impact' && foot.timer > 0) {
      stompPods(foot.x, foot.y, stompRadius(foot.charge >= MIN_SLAM_CHARGE))
    }
  }

  // The chain's window, and the vial's decay.
  const before = chain.count
  const lostMult = comboMultiplier(before)
  chain = chainStep(chain, dt)
  if (before > 0 && chain.count === 0) { emit({ k: 'chainLost', mult: lostMult }); syncChain() }
  else if (chain.count > 0) setChainRing(chain.windowMs / COMBO_WINDOW_MS)

  // ── Growth Spurt ── The shoe chases its chain's size: quick up (a boing),
  // slower down (a deflate the eye can follow). `stompRadius` reads it, and so
  // does the renderer — the shoe is drawn from the radius, so it grows for free.
  const target = chainScale(comboMultiplier(chain.count))
  const tau = target > growth ? GROW_UP_MS : GROW_DOWN_MS
  growth += (target - growth) * (1 - Math.exp(-dt / tau))

  const wasFever = fever.remainMs > 0
  fever = stepFever(fever, dt, sinceSquish)
  feverMs.value = fever.remainMs
  if (fever.remainMs <= 0) juice.value = fever.juice

  // ── Fever spends itself ──
  //
  // The vial fills, the boot comes down. No button, no caption, no knowing what
  // the flame was for. It waits for a body on the floor so the gift is never
  // spent on an empty board, and never fires during a Fever that is already
  // running (a party's, or the gilded laces') — that vial is held aside and
  // handed back, and this would spend it the frame it came home.
  if (feverArmed && fever.remainMs <= 0 && somethingToStomp()) {
    if (tryFever()) feverArmed = false
  }
  if (wasFever && fever.remainMs <= 0) {
    emit({ k: 'feverEnd' })
    feverKills = 0
    // A Fever that was a gift (the gilded laces) hands the vial back as it ends.
    if (heldJuice !== null && !level.party) {
      fever = { juice: heldJuice, remainMs: 0 }
      heldJuice = null
      juice.value = fever.juice
      // A vial that comes home FULL is armed again: the gift ran on its own
      // fuel, so the player's own Fever is still owed to them.
      if (feverReady(fever)) feverArmed = true
    }
    if (trialShoe.value === 'laces') {
      trialShoe.value = null
      emit({ k: 'trialEnd', shoe: null })
    }
  }

  // The clock. A boss level has one too — it is generous, and it exists so a
  // player who cannot beat the boss is not stuck in it forever.
  //
  // `clockMs` is the clock; `timeLeft` is the chip. Writing the chip only when
  // its printed second changes is what keeps a per-frame Vue re-render of the
  // whole HUD out of the frame budget — see the ref's own note.
  clockMs = Math.max(0, clockMs - dt)
  if (HUD_LEGACY_PER_FRAME) timeLeft.value = clockMs / 1000
  else {
    // CEIL, because the chip already printed `Math.ceil(props.time)`: a clock
    // that shows 1 while 0.4 s remain is the clock this game has always had.
    const shown = Math.ceil(clockMs / 1000)
    if (shown !== timeLeft.value) timeLeft.value = shown
  }
  // A party's clock running out is the END of the party, and a party cannot be
  // lost — it is a win on the timeout.
  if (clockMs <= 0) finish(level.party === true)
  else if (!boss && level.quota > 0 && squished.value >= level.quota) {
    resolveFinisher()
    finish(true)
  }
}

/** 0..1 through the level's own objective — the HUD's progress rail. */
export const progress01 = computed(() => {
  if (level.boss) return 1 - bossHp.value
  return level.quota > 0 ? Math.min(1, squished.value / level.quota) : 0
})

// ─── Test / recorder seams ──────────────────────────────────────────────────

/** Everything a headless harness needs to drive a level. Dev-only callers. */
export const __sim = {
  /** Empty the floor outright — a test that places its own bodies. */
  clearBugs: (): void => {
    for (let i = 0; i < bugCount; i++) bugs[i]!.alive = false
    bugCount = 0
  },
  bugs, pods, hazards: () => hazards, foot, boss: () => boss,
  spawnBug, step, startLevel, setBoard, press, release, slamNow, tryFever, resetVial,
  aim, endLevel, drainEvents, getRush, getTwist, trialLeft, getGrowth,
  state: () => ({
    score: score.value, chain: chain.count, mult: comboMultiplier(chain.count),
    juice: fever.juice, fever: fever.remainMs, squished: squished.value,
    timeLeft: timeLeft.value, phase: phase.value, bugs: bugCount
  })
}
