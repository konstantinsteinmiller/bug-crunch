import { computed, ref, shallowRef } from 'vue'
import {
  blowDamage, bugSpec, resolveStomp, type BugId, type BugSpec, type StompVerdict
} from '@/game/bugs'
import { blowPierce, shoeSpec, STARTER_SHOE, type ShoeId, type ShoeSpec } from '@/game/shoes'
import {
  CONVEYOR_SPEED, COBWEB_HOLD_MS, HAZE_FOOT_AGILITY, HAZE_MS, HAZE_R,
  MAGNET_ARMED_MS, MAGNET_PULL, MAGNET_REACH, SALT_BURST_R, SALT_PANIC_MS,
  SALT_PANIC_SPEED, SPIKE_STUN_MS, SWEEPER_CROSS_MS, SWEEPER_REST_MS,
  hazardSpec, type HazardId
} from '@/game/hazards'
import {
  chainBreak, chainHit, chainStep, comboMultiplier, newChain, splatWord,
  squishScore, startFever, stepFever, juiceGain, COMBO_WINDOW_MS, FEVER,
  type ChainState, type FeverState, type SplatWord
} from '@/game/combo'
import {
  BEAM_HALF, BEAM_SWEEP_MS, BEAM_TELL_MS, CHARGE_COUNTER_HITS, CHARGE_RUN_MS,
  CHARGE_SPENT_MS, CHARGE_TELL_MS, CHARGE_WINDUP_MS, POD_HATCH_MS, POD_PER_BEAT,
  POD_QUOTA, POD_SIZE, bossSpec, type BossSpec
} from '@/game/bosses'
import { levelSpec, worldOf, type LevelSpec } from '@/game/stages'
import { emptyTally, type RunTally } from '@/game/stars'
import { DEFAULT_JUICE_STYLE, type JuiceStyleId } from '@/game/juiceStyle'

/**
 * ─── The simulation ─────────────────────────────────────────────────────────
 *
 * One module owns the whole world: the foot, every body on the floor, the
 * hazards, the boss script, the chain, the vial and the clock. The renderer
 * (`useSplatixArt`) reads this and draws it; `GameScene.vue` feeds it input and
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

/** The heel pivot's reach, as a multiple of the shoe's stomp radius, and what
 *  it costs. It is a panic button: wide, weak, and on a cooldown. */
const PIVOT_SCALE = 2.1
const PIVOT_COOLDOWN_MS = 2600

/** How far above the finger the foot rides on touch, u.
 *
 *  The single most important number for the mobile feel. Without it the thumb
 *  covers the exact spot the player is aiming at, which on a 320 px phone is
 *  most of the target. Zero on a mouse, where the cursor is a point. */
export const TOUCH_LIFT_U = 11

/** Single-Tap Mode: how far a tap may reach for the nearest body, u. */
const AUTO_AIM_U = 26

/** A dodger notices the shadow inside this many multiples of its own size, and
 *  leaps this far after this long. */
const DODGE_SENSE = 5.2
const DODGE_TELL_MS = 250
const DODGE_LEAP_U = 17
const DODGE_LEAP_MS = 300

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
  /** Dodger: how long the shadow has been on it. */
  sense: number
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
}

export interface Pod {
  alive: boolean
  x: number
  y: number
  /** ms until it hatches. */
  t: number
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
}

export interface Haze {
  alive: boolean
  x: number
  y: number
  t: number
}

/** One thing that happened this step, for the renderer and the audio to read. */
export type GameEvent =
  | { k: 'squish'; x: number; y: number; bug: BugId; heavy: boolean; word: SplatWord; mult: number; stretch: number; angle: number }
  | { k: 'hurt'; x: number; y: number; bug: BugId }
  | { k: 'clang'; x: number; y: number }
  | { k: 'spike'; x: number; y: number }
  | { k: 'stomp'; x: number; y: number; r: number; heavy: boolean; hit: boolean }
  | { k: 'miss'; x: number; y: number }
  | { k: 'pivot'; x: number; y: number; r: number }
  | { k: 'fever'; x: number; y: number }
  | { k: 'feverEnd' }
  | { k: 'coin'; x: number; y: number; n: number }
  | { k: 'chain'; n: number; mult: number; step: boolean }
  | { k: 'chainLost' }
  | { k: 'salt'; x: number; y: number }
  | { k: 'magnet'; x: number; y: number }
  | { k: 'sweep'; x: number; y: number }
  | { k: 'bossHit'; x: number; y: number; counter: boolean }
  | { k: 'bossPhase'; n: number }
  | { k: 'bossDown'; x: number; y: number }
  | { k: 'podPop'; x: number; y: number }
  | { k: 'podHatch'; x: number; y: number }
  | { k: 'chain-arc'; x0: number; y0: number; x1: number; y1: number }
  | { k: 'end'; won: boolean }

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
  sense: 0, stun: 0, held: 0, panic: 0, dip: 0, lastSlide: -1e9,
  segs: 0, trail: null, trailN: 0, phase: 0, fromBoss: false
})

const bugs: Bug[] = Array.from({ length: MAX_BUGS }, makeBug)
const pods: Pod[] = Array.from({ length: MAX_PODS }, () => ({ alive: false, x: 0, y: 0, t: 0 }))
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
/** 0..1 of the chain window left. Published as a ref rather than recomputed by
 *  the HUD, because only the sim knows the window and the ring that draws it has
 *  to be right on the frame the chain lapses. */
export const chainLeft = ref(0)
/** Heavy slams landed this level. The tutorial's third beat reads it, and so
 *  does nothing else — it is a counter, not a mechanic. */
export const slams = ref(0)
export const juice = ref(0)
export const feverMs = ref(0)
export const timeLeft = ref(0)
export const squished = ref(0)
export const quota = ref(0)
export const phase = ref<Phase>('intro')
export const bossHp = ref(1)
export const bossPhaseIndex = ref(0)
export const bossTell = ref<string | null>(null)
export const pivotReady = ref(true)

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
   */
  relief: number
  /** Deterministic seed. The recorder pins it; play passes the level id. */
  seed?: number
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
  level = levelSpec(o.level)
  shoe = shoeSpec(o.shoe)
  juiceStyle = o.juiceStyle
  singleTap = o.singleTap
  difficulty = o.difficulty
  relief = o.relief
  rngState = (o.seed ?? level.id * 7919 + 13) >>> 0

  for (let i = 0; i < bugs.length; i++) bugs[i]!.alive = false
  for (const p of pods) p.alive = false
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
  fever = { juice: fever.juice, remainMs: 0 }
  elapsed = 0
  spawnAcc = 0
  pivotCd = 0
  slideId = 0
  boss = null

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

  layoutHazards()
  if (level.boss) spawnBoss(level.boss)
  else seedBoard()

  score.value = 0
  chainCount.value = 0
  chainMult.value = 1
  chainLeft.value = 0
  slams.value = 0
  juice.value = fever.juice
  feverMs.value = 0
  squished.value = 0
  quota.value = level.quota
  timeLeft.value = Math.round(level.time * relief)
  bossHp.value = 1
  bossPhaseIndex.value = 0
  bossTell.value = (boss as Boss | null)?.spec.phases[0]?.tell ?? null
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
  b.stun = 0
  b.held = 0
  b.panic = 0
  b.dip = 0
  b.lastSlide = -1e9
  b.segs = 0
  b.trailN = 0
  b.phase = rnd() * Math.PI * 2
  b.fromBoss = false
  return b
}

/** Remove body `i` by swapping the last live one into its slot. */
const killSlot = (i: number): void => {
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
  const sp = b.spec.speed * level.speed * difficulty * relief
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
  const n = Math.max(1, Math.round(level.maxAlive * 0.45))
  const margin = 10
  const safe = stompRadius(true) * 1.4
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
  if (bugCount >= level.maxAlive) return
  const k = level.time > 0 ? Math.min(1, elapsed / (level.time * 1000)) : 0
  const interval = level.spawnMs[0] + (level.spawnMs[1] - level.spawnMs[0]) * k
  spawnAcc += dt
  const gap = interval / Math.max(0.5, difficulty)
  while (spawnAcc >= gap && bugCount < level.maxAlive) {
    spawnAcc -= gap
    spawnBug(pickBug())
  }
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
  if (foot.state === 'stun') return

  aim(x, y)

  const isDouble = now - lastPressAt < DOUBLE_TAP_MS
    && dist2(x, y, lastPressX, lastPressY) < DOUBLE_TAP_U * DOUBLE_TAP_U
  lastPressAt = now
  lastPressX = x
  lastPressY = y

  if (isDouble && pivotCd <= 0) {
    heelPivot()
    return
  }

  if (singleTap) {
    const near = nearestBug(x, y, AUTO_AIM_U)
    if (near) { foot.tx = near.x; foot.ty = near.y; foot.x = near.x; foot.y = near.y }
  }

  pressHeld = true
  pressAt = now
  if (foot.state === 'hover' || foot.state === 'recover') quickStomp()
}

/** The press ended. A charge past the threshold lands as a slam. */
export const release = (): void => {
  pressHeld = false
  if (!running || phase.value !== 'play') { foot.charge = 0; return }
  if (foot.state === 'charge') {
    if (foot.charge >= MIN_SLAM_CHARGE) {
      // `slam()` deliberately LEAVES the charge on the foot: `land()` reads it
      // to decide the blow is heavy and how far it reaches, and `impact` clears
      // it afterwards. The first pass fell through to the `foot.charge = 0`
      // below, one line later, which turned every held slam into an ordinary
      // tap — so no shell could be opened by hand and the whole hold-to-slam
      // mechanic was dead. Pinned by `tests/game/sim.test.ts`.
      slam(foot.charge)
      return
    }
    foot.state = 'recover'
    foot.timer = 120
  }
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

/** The stomp radius right now — the shoe's, grown by Fever. */
export const stompRadius = (heavy = false): number => {
  const base = shoe.radius * (heavy ? shoe.slamScale : 1)
  return fever.remainMs > 0 ? base * FEVER.radiusScale : base
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

const heelPivot = (): void => {
  const r = stompRadius() * PIVOT_SCALE
  pivotCd = PIVOT_COOLDOWN_MS
  pivotReady.value = false
  foot.state = 'pivot'
  foot.timer = 420
  emit({ k: 'pivot', x: foot.x, y: foot.y, r })
  // A sweep, not a stomp: it kills only the unarmoured, and it does not miss —
  // it is the panic button, and a panic button that can break the chain is one
  // nobody presses twice.
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

  // Height and squash, per state.
  const hover = shoe.hover
  switch (foot.state) {
    case 'hover':
      foot.z += (hover - foot.z) * (1 - Math.exp(-10 * s))
      foot.squash += (1 - foot.squash) * (1 - Math.exp(-14 * s))
      if (pressHeld && performance.now() - pressAt > TAP_MS) {
        foot.state = 'charge'
        foot.charge = 0
      }
      break
    case 'charge': {
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
  const hitBugs = resolveArea(foot.x, foot.y, r, heavy, false)
  const hitBoss = boss ? bossStomp(foot.x, foot.y, r, heavy) : false
  const hit = hitBugs || hitBoss
  if (heavy) slams.value++
  emit({ k: 'stomp', x: foot.x, y: foot.y, r, heavy, hit })

  if (heavy) armMagnets()
  stompHazards(foot.x, foot.y, r)

  if (!hit) {
    // A MISS: bare floor. The chain is over.
    emit({ k: 'miss', x: foot.x, y: foot.y })
    const t = tally.value
    tally.value = { ...t, misses: t.misses + 1 }
    if (chain.count > 0) emit({ k: 'chainLost' })
    chain = chainBreak(chain)
    syncChain()
  }

  // A slide can only start out of a landing, and only in a shoe that has one.
  if ((shoe.slide || onSlickFloor()) && pressHeld && foot.speed > 12) {
    foot.state = 'slide'
    foot.timer = 900
    slideId++
  }
}

const onSlickFloor = (): boolean => {
  for (const h of hazards) {
    if (h.id !== 'honey') continue
    if (dist2(foot.x, foot.y, h.x, h.y) < h.r * h.r) return true
  }
  return false
}

/** While sliding, everything the sole crosses is crushed. */
const slideDamage = (): void => {
  const r = stompRadius() * 0.9
  const now = performance.now()
  for (let i = bugCount - 1; i >= 0; i--) {
    const b = bugs[i]!
    if (now - b.lastSlide < SLIDE_REHIT_MS) continue
    if (dist2(foot.x, foot.y, b.x, b.y) > (r + b.spec.size) * (r + b.spec.size)) continue
    b.lastSlide = now
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
    const b = bugs[i]!
    const reach = r + b.spec.size
    if (dist2(x, y, b.x, b.y) > reach * reach) continue
    if (b.spec.airborne && b.dip < 0.55 && !sweep) continue
    if (sweep && (b.spec.armor > 0 || b.spec.spiky)) continue
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
  const b = bugs[i]!
  const spec = b.spec

  // A centipede's HEAD is the front of its body circle; a blow that lands on the
  // back half is a segment cut, and a blow on the head is the instant kill.
  const headshot = spec.segments > 0 && !fromSlide
    && dist2(foot.x, foot.y, b.x, b.y) < (spec.size * 0.9) * (spec.size * 0.9)

  const verdict: StompVerdict = resolveStomp({
    bug: spec, damage: b.dmg, pierce, spikeProof: shoe.spikeProof,
    fever: fever.remainMs > 0, heavy, headshot
  })

  const t = tally.value
  if (verdict === 'spike') {
    emit({ k: 'spike', x: b.x, y: b.y })
    foot.state = 'stun'
    foot.timer = SPIKE_STUN_MS
    tally.value = { ...t, spikes: t.spikes + 1, hits: t.hits + 1 }
    if (chain.count > 0) emit({ k: 'chainLost' })
    chain = chainBreak(chain)
    syncChain()
    return
  }

  tally.value = { ...t, hits: t.hits + 1 }

  if (verdict === 'ricochet') {
    emit({ k: 'clang', x: b.x, y: b.y })
    b.stun = Math.max(b.stun, 180)
    return
  }

  if (verdict === 'hurt') {
    b.dmg += blowDamage(heavy)
    emit({ k: 'hurt', x: b.x, y: b.y, bug: b.id })
    b.stun = Math.max(b.stun, 220)
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
  if (fever.remainMs <= 0) juice.value = fever.juice
  if (fever.remainMs > 0) feverKills++

  squished.value++
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

  const stretch = fromSlide ? clamp(1 + foot.speed / 40, 1, 2.6) : clamp(1 + foot.speed / 90, 1, 1.5)
  emit({
    k: 'squish', x: b.x, y: b.y, bug: b.id, heavy,
    word: splatWord(multiplier), mult: multiplier, stretch, angle: foot.heading
  })

  if (spec.coins > 0) emit({ k: 'coin', x: b.x, y: b.y, n: spec.coins })
  if (spec.stinks) spawnHaze(b.x, b.y)

  // A centipede does not die — it SPLITS, unless the head went.
  if (spec.segments > 0 && b.segs > 1 && !headshot) {
    b.segs = Math.max(1, Math.floor(b.segs / 2))
    const half = spawnBug('centipede', b.x, b.y)
    if (half) {
      half.segs = b.segs
      half.heading = b.heading + Math.PI
      const sp = half.spec.speed * level.speed * difficulty * relief
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

  killSlot(i)
}

/** The Electric Sock's arcs: `n` nearest bodies, each taking one un-chained
 *  blow with the shoe's own pierce. */
const arcLightning = (x: number, y: number, _from: BugId, n: number): void => {
  let left = n
  const reach = 22
  for (let i = bugCount - 1; i >= 0 && left > 0; i--) {
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
  chainLeft.value = chain.count > 0 ? Math.max(0, chain.windowMs / COMBO_WINDOW_MS) : 0
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

/** A stomp that lands on a shaker tips it. */
const stompHazards = (x: number, y: number, r: number): void => {
  for (const h of hazards) {
    if (!hazardSpec(h.id).stompable || h.charge < 0) continue
    if (h.id !== 'salt') continue
    const reach = r + h.r
    if (dist2(x, y, h.x, h.y) > reach * reach) continue
    h.charge = -1
    h.travel = 0
    emit({ k: 'salt', x: h.x, y: h.y })
    for (let i = 0; i < bugCount; i++) {
      const b = bugs[i]!
      if (dist2(h.x, h.y, b.x, b.y) < SALT_BURST_R * SALT_BURST_R) b.panic = SALT_PANIC_MS
    }
  }
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
      word: 'crunch', mult: 1, stretch: 1.8, angle: 0
    })
    squished.value++
    const byKind = { ...tally.value.byKind }
    byKind[b.id] = (byKind[b.id] ?? 0) + 1
    tally.value = { ...tally.value, squishes: tally.value.squishes + 1, byKind }
    killSlot(i)
  }
}

/** What the floor at (x, y) does to a body. Returns a speed multiplier and
 *  writes any positional effects straight onto the body. */
const applyTerrain = (b: Bug, dt: number): number => {
  let k = 1
  for (const h of hazards) {
    const spec = hazardSpec(h.id)
    if (h.id === 'sweeper') continue
    if (h.id === 'conveyor') {
      // A belt is a rectangle, not a circle: half its length along `angle` and
      // a fixed half-width across it.
      const dx = b.x - h.x
      const dy = b.y - h.y
      const along = dx * Math.cos(h.angle) + dy * Math.sin(h.angle)
      const across = -dx * Math.sin(h.angle) + dy * Math.cos(h.angle)
      if (Math.abs(along) < h.r && Math.abs(across) < spec.size * 0.5) {
        b.x += Math.cos(h.angle) * CONVEYOR_SPEED * (dt / 1000)
        b.y += Math.sin(h.angle) * CONVEYOR_SPEED * (dt / 1000)
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
      if (b.id === 'ant') {
        const a = Math.atan2(h.y - b.y, h.x - b.x)
        b.heading += Math.sin(a - b.heading) * 0.06
      }
    }
  }
  return k
}

// ─── Bug behaviour ──────────────────────────────────────────────────────────

const stepBugs = (dt: number): void => {
  const s = dt / 1000
  const shadowR = stompRadius(foot.state === 'charge')
  for (let i = bugCount - 1; i >= 0; i--) {
    const b = bugs[i]!
    const spec = b.spec
    b.t += dt

    if (b.stun > 0) { b.stun -= dt; b.cycle += s * 0.4 }
    if (b.held > 0) b.held -= dt
    if (b.panic > 0) b.panic -= dt

    let speed = spec.speed * level.speed * difficulty * relief
    if (b.panic > 0) speed *= SALT_PANIC_SPEED
    speed *= applyTerrain(b, dt)
    if (b.stun > 0 || b.held > 0) speed = 0

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
    switch (spec.motion) {
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

    bounce(b)
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

const spawnBoss = (id: LevelSpec['boss']): void => {
  if (!id) return
  const spec = bossSpec(id)
  boss = {
    spec,
    x: (board.x0 + board.x1) / 2,
    y: board.y0 + (board.y1 - board.y0) * 0.3,
    vx: 0, vy: 0,
    size: Math.min(spec.size, Math.min(board.x1 - board.x0, board.y1 - board.y0) * 0.22),
    phase: 0, hits: 0, beat: 0, sub: 'idle', subT: 0, aim: 0,
    iframe: 0, podsDown: 0, alive: true, dying: 0
  }
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
  if (bs.iframe > 0) bs.iframe -= dt

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
          if (id) spawnBug(id, bs.x + rndRange(-6, 6), bs.y + rndRange(-6, 6), true)
        }
      }
      break
    }
    case 'pods': {
      bs.x += Math.cos(bs.beat / 900) * sp * s
      bs.y = clamp(bs.y, board.y0 + 12, board.y0 + (board.y1 - board.y0) * 0.4)
      if (bs.beat > p.beatMs) {
        bs.beat = 0
        for (let i = 0; i < POD_PER_BEAT; i++) dropPod()
      }
      break
    }
    case 'charge': {
      bs.subT += dt
      if (bs.sub === 'idle') { bs.sub = 'tell'; bs.subT = 0; bs.aim = Math.atan2(foot.y - bs.y, foot.x - bs.x) }
      else if (bs.sub === 'tell' && bs.subT > CHARGE_TELL_MS) { bs.sub = 'windup'; bs.subT = 0 }
      else if (bs.sub === 'windup' && bs.subT > CHARGE_WINDUP_MS) { bs.sub = 'run'; bs.subT = 0 }
      else if (bs.sub === 'run') {
        bs.x += Math.cos(bs.aim) * p.speed * s
        bs.y += Math.sin(bs.aim) * p.speed * s
        // A charge that leaves the board turns around rather than vanishing.
        if (bs.x < board.x0 || bs.x > board.x1 || bs.y < board.y0 || bs.y > board.y1) {
          bs.x = clamp(bs.x, board.x0, board.x1)
          bs.y = clamp(bs.y, board.y0, board.y1)
          bs.sub = 'spent'
          bs.subT = 0
        }
        if (bs.subT > CHARGE_RUN_MS) { bs.sub = 'spent'; bs.subT = 0 }
      } else if (bs.sub === 'spent' && bs.subT > CHARGE_SPENT_MS) { bs.sub = 'idle'; bs.subT = 0 }
      if (bs.beat > p.beatMs && p.adds.length > 0) {
        bs.beat = 0
        const id = p.adds[0]
        if (id) spawnBug(id, bs.x + rndRange(-8, 8), bs.y + rndRange(-8, 8), true)
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
          if (id) spawnBug(id, bs.x + rndRange(-10, 10), bs.y + rndRange(-4, 10), true)
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

  // Pods hatch on their own clock.
  for (const pod of pods) {
    if (!pod.alive) continue
    pod.t -= dt
    if (pod.t <= 0) {
      pod.alive = false
      emit({ k: 'podHatch', x: pod.x, y: pod.y })
      const id = p.adds[0]
      if (id) spawnBug(id, pod.x, pod.y, true)
    }
  }
}

const dropPod = (): void => {
  for (const pod of pods) {
    if (pod.alive) continue
    pod.alive = true
    pod.x = board.x0 + rndRange(0.15, 0.85) * (board.x1 - board.x0)
    pod.y = board.y0 + rndRange(0.35, 0.9) * (board.y1 - board.y0)
    pod.t = POD_HATCH_MS
    return
  }
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
    emit({ k: 'squish', x: b.x, y: b.y, bug: b.id, heavy: true, word: 'crunch', mult: 1, stretch: 1.4, angle: bs.aim })
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
  const counter = p.script === 'charge' && bs.sub === 'windup' && heavy
  const open = p.vulnerable && (p.script !== 'charge' || bs.sub === 'windup' || bs.sub === 'spent')
  if (!open) { emit({ k: 'clang', x: bs.x, y: bs.y }); return true }
  if (blowPierce(shoe, heavy) < p.armor) { emit({ k: 'clang', x: bs.x, y: bs.y }); return true }

  bs.hits += counter ? CHARGE_COUNTER_HITS : 1
  bs.iframe = 260
  if (counter) { bs.sub = 'spent'; bs.subT = 0 }
  emit({ k: 'bossHit', x: bs.x, y: bs.y, counter })
  score.value += 120
  fever = { ...fever, juice: Math.min(1, fever.juice + 0.05) }
  if (fever.remainMs <= 0) juice.value = fever.juice
  syncBossHp()

  if (bs.hits >= p.hits) advanceBossPhase()
  return true
}

/** A stomp that lands on a pod. */
const stompPods = (x: number, y: number, r: number): void => {
  const bs = boss
  if (!bs) return
  for (const pod of pods) {
    if (!pod.alive) continue
    const reach = r + POD_SIZE
    if (dist2(x, y, pod.x, pod.y) > reach * reach) continue
    pod.alive = false
    bs.podsDown++
    score.value += 80
    emit({ k: 'podPop', x: pod.x, y: pod.y })
    if (bs.podsDown >= POD_QUOTA) advanceBossPhase()
  }
}

const advanceBossPhase = (): void => {
  const bs = boss
  if (!bs) return
  if (bs.phase >= bs.spec.phases.length - 1) {
    bs.alive = false
    bs.dying = 0
    score.value += bs.spec.score
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
  for (const pod of pods) pod.alive = false
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

// ─── The clock and the end ──────────────────────────────────────────────────

const finish = (won: boolean): void => {
  if (phase.value !== 'play') return
  running = false
  phase.value = won ? 'won' : 'lost'
  tally.value = {
    ...tally.value,
    cleared: won,
    timeLeft: Math.max(0, Math.round(timeLeft.value)),
    score: score.value
  }
  emit({ k: 'end', won })
}

/** Force the level to end — the pause menu's "give up", and the recorder's. */
export const endLevel = (won: boolean): void => finish(won)

// ─── The step ───────────────────────────────────────────────────────────────

let acc = 0

/**
 * Advance the world by `frameMs` of wall time.
 *
 * Returns the number of sub-steps run, which the perf probe reads as
 * work-per-frame.
 */
export const step = (frameMs: number): number => {
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

  stepFoot(dt)
  stepBugs(dt)
  stepHazards(dt)
  stepSpawns(dt)
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
  chain = chainStep(chain, dt)
  if (before > 0 && chain.count === 0) { emit({ k: 'chainLost' }); syncChain() }
  else if (chain.count > 0) chainLeft.value = Math.max(0, chain.windowMs / COMBO_WINDOW_MS)

  const wasFever = fever.remainMs > 0
  fever = stepFever(fever, dt)
  feverMs.value = fever.remainMs
  if (fever.remainMs <= 0) juice.value = fever.juice
  if (wasFever && fever.remainMs <= 0) { emit({ k: 'feverEnd' }); feverKills = 0 }

  // The clock. A boss level has one too — it is generous, and it exists so a
  // player who cannot beat the boss is not stuck in it forever.
  timeLeft.value = Math.max(0, timeLeft.value - dt / 1000)
  if (timeLeft.value <= 0) finish(false)
  else if (!boss && level.quota > 0 && squished.value >= level.quota) finish(true)
}

/** 0..1 through the level's own objective — the HUD's progress rail. */
export const progress01 = computed(() => {
  if (level.boss) return 1 - bossHp.value
  return level.quota > 0 ? Math.min(1, squished.value / level.quota) : 0
})

// ─── Test / recorder seams ──────────────────────────────────────────────────

/** Everything a headless harness needs to drive a level. Dev-only callers. */
export const __sim = {
  bugs, pods, hazards: () => hazards, foot, boss: () => boss,
  spawnBug, step, startLevel, setBoard, press, release, slamNow, tryFever, resetVial,
  aim, endLevel, drainEvents,
  state: () => ({
    score: score.value, chain: chain.count, mult: comboMultiplier(chain.count),
    juice: fever.juice, fever: fever.remainMs, squished: squished.value,
    timeLeft: timeLeft.value, phase: phase.value, bugs: bugCount
  })
}
