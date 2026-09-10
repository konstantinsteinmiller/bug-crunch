import { computed, ref, watch } from 'vue'
import {
  BARRICADE_COIN_MAX, BARRICADE_COIN_MIN,
  BARRICADE_H, BASE_FIRE_RATE, ROCK_H, BOSS_BASE_HP, bossGuardGates, dividerCrushFor,
  GATE_SCALE_STEP, gatePumpCap, gatePumpStep, gateTickMs, isScaleOp,
  earlyBigHitMul,
  BULLET_LIFE_MS, BULLET_R, BULLET_SPEED, effectiveBulletRange,
  CHALLENGE_MAX, CHALLENGE_STEP,
  COIN_MAGNET_BASE, COIN_PULL_LEAD, CRATE_DAMAGE_GAIN,
  FOE_COIN_DROP_ELITE, FOE_COIN_DROP_PER_BOUNTY,
  BULWARK_FLOOR, BULWARK_R, BULWARK_SHARE, CAGE_R,
  CRATE_R, CRATE_RATE_GAIN, CROWD_MAX_R, CROWD_SQUASH, DIVIDER_H, DIVIDER_HALF_W,
  FOE_BODY_HALF_H, FOE_BODY_HALF_W, FOE_COLLIDE_CD, FOE_COLLIDE_CORE, FOE_COLLIDE_IFRAMES_MS, FOE_COLLIDE_KILL_EVERY,
  ELITE_DRAG_LEAD, ELITE_HOLD_MAX, ELITE_LUNGE, ELITE_SWEEP_CD, eliteDragFor,
  ELITE_SWEEP_FRACTION, ELITE_SWEEP_REACH, ELITE_TELEGRAPH, FOE_REACH, FUNNEL_LEAD,
  PASSAGE_FIT_MARGIN,
  BOSS_MIN_KILL, bossMinKill, SLAM_FRACTION_MAX, SLAM_MAX_FRACTION, SWEEP_FRACTION_MAX, endlessPressure,
  GATE_DEPTH, GATE_MAX_VALUE, GATE_SUB_MAX, LANE_HALF, MAX_FIRE_RATE, MAX_SQUAD,
  SLAM_CD_BASE, SLAM_CD_DECAY, SLAM_CD_MIN, SLAM_RADIUS,
  SLAM_RADIUS_GROWTH, SLAM_RADIUS_MAX, STEER_SPRING,
  TUTORIAL_SLAM_FRACTION, TUTORIAL_SLAM_MIN_KILL, UNIT_R,
  CHARGED_EVERY, CHARGED_LEAD, CHARGED_WINDUP_MUL, slamRadiusFor,
  DECLINE_MAX, biteShareFor, challengeBiteFactor, challengeFactor, challengePackFactor,
  rewardDeclineFactor,
  contactReliefFor,
  BARREL_R, BARREL_FUSE_MS, BARREL_BLAST_R, BARREL_BLAST_BOSS_FRACTION, barrelHp,
  funnelRadius, reliefFor, slamReliefFor,
  retrySquadScaleFor, startBonusFor, stageReward, stageSpeed, wipeReward,
  type Barrel, type Barricade, type Boss, type Bulwark, type Bullet, type Cage, type Crate,
  type Divider, type Foe,
  type Gate, type Pickup, type Rock, type Unit
} from '@/game/survival'
import { arenaKit, bossDesign, bossHpScale, foeDef, foeHpScale } from '@/game/foes'
import {
  GUARD_H, LEVER_R, ROCKET_SPLASH_SHARE, STONE_H, WEAPONS, WEAPON_BOX_R, WEAPON_PICK_STAGE,
  WEAPON_REVEAL_S, isWeaponId, weaponStreams,
  type Guard, type Lever, type Stone, type WeaponBox, type WeaponId
} from '@/game/weapons'
import { WEAPON_PICK_KEY } from '@/keys'
import { buildTrack, perfectSquadFor, type Track } from '@/game/track'
import {
  adaptiveBigHitMul, adaptiveBossHp, adaptiveBossSeconds, adaptiveBossStage,
  clampAdaptiveSeconds, meltFloorStage, BOSS_MIN_FIRE_SECONDS, BOSS_FLOOR_GRENADE_MULT,
  type AdaptiveFight
} from '@/game/adaptive'
import {
  BOLT_BLAST_R,
  BOLT_FLIGHT_S,
  BOLT_HIT_R,
  BOLT_LEAD,
  BOLT_LIFE,
  BOLT_R,
  BOLT_SHARE_MUL,
  BOLT_SPEED,
  BOLT_TRAIL,
  BOMBER_BLAST_R,
  BOMBER_FRACTION,
  BOMBER_FUSE,
  BOMBER_PLANT_GAP,
  BOMBER_SPEED,
  BOMBER_TRACK,
  BOSS_BOLT_LIFE,
  CHARGE_DASH_S,
  CHARGE_EVERY,
  CHARGE_OVERRUN,
  CHARGE_TELEGRAPH_MIN,
  CLAW_HALF_DEPTH,
  CLAW_LEAD,
  GUNNER_FRACTION,
  GUNNER_RELOAD,
  GUNNER_STANDOFF,
  GUNNER_TELEGRAPH,
  HEALER_CAST_CD,
  HEALER_TELEGRAPH,
  HEAL_EVERY,
  HEAL_FRACTION,
  HEAL_MAX_CASTS,
  HEAL_MIN_GAP_S,
  ROLLER_CORE_FRACTION,
  ROLLER_FRACTION,
  ROLLER_R,
  ROLLER_SPEED,
  ROLLER_WARN_AHEAD,
  SUMMON_AHEAD,
  SUMMON_BITE_MUL,
  SUMMON_CD,
  SUMMON_DESIGN,
  SUMMON_HP_SHARE,
  SUMMON_MERCY_CD,
  SUMMON_MERCY_CD_MIN,
  SUMMON_MERCY_FLANK,
  SUMMON_MERCY_GRACE,
  SUMMON_MERCY_RAMP,
  SUMMON_MERCY_SQUAD,
  SUMMON_OPENING_CD,
  SUMMON_PER_WAVE,
  SUMMON_SPREAD,
  SUMMON_TELEGRAPH,
  SUMMON_TYPE,
  SUMMON_WAVES_MAX,
  bossCharges,
  bossEnragesAt,
  bossGuardPayoff,
  bossHpMulFor,
  bossKindFor,
  chargeHalfW,
  chargeWindup,
  clawCoreHalfW,
  clawFurrowHalfW,
  clawLaneXs,
  inClawFurrow,
  minibossDesignFor,
  minibossKindFor,
  rollerCoreR,
  rollerLaneFor,
  rollerLaneX,
  enragedSpan,
  summonWaveSize,
  type BossBolt,
  type BossKind
} from '@/game/threats'
import { pushFx } from '@/use/useVfx'
import { difficultyFactor } from '@/use/useUser'
import {
  __setUpgradeLevel,
  coinMagnetBonus, coinMultiplier, fireRate as metaFireRate, gatePayoutBonus, rangeBonus,
  startSquad, unitDamage, weaponPowerMul
} from '@/use/useUpgrades'
import { getState, setStates } from '@/use/useTowerState'
import {
  EXPEDITION_PAYOUT, EXPEDITION_STAGE, expeditionDay, markExpeditionTaken
} from '@/use/useDailyExpedition'
import { flushSaveNow } from '@/use/useSaveStatus'
import {
  BEST_SQUAD_KEY, BEST_STAGE_KEY, CHALLENGE_KEY, FAILED_STAGES_KEY,
  REWARD_DECLINE_KEY, RUNS_KEY,
  STAGE_KEY, TOTAL_KILLS_KEY
} from '@/keys'

/**
 * ─── Survivalist — the simulation ───────────────────────────────────────────
 *
 * A module singleton, deliberately. There is exactly ONE run in flight at a
 * time, the renderer and the HUD both need to read it every frame, and passing
 * a store through props would mean the hot path goes through Vue's reactivity
 * for a hundred and ninety moving bodies. So: reactive refs for the handful of
 * values the HUD actually renders, plain arrays for everything the CANVAS
 * renders, and one `step(dtMs)` that owns the clock.
 *
 * Nothing here draws, measures, or touches the DOM — which is what keeps the
 * whole thing testable in jsdom, and what lets `tests/game/*` and the balance
 * harness walk a stage and assert its shape without a canvas.
 *
 * ─── The four rules that make it a game ─────────────────────────────────────
 *
 *   1. SOLID THINGS KILL. Every obstacle that has not been destroyed — crates,
 *      barricades, gate dividers — kills whoever runs into it. The gates
 *      themselves are the sole exception; they are doorways, not walls.
 *   2. GATES ARE A COMMITMENT. A bank is two leaves with a lethal pillar
 *      between them, and the crowd is narrower than one leaf but wider than the
 *      gap to the pillar. Choose a side and aim, or pay for the indecision.
 *   3. FIRE RATE IS EARNED IN THE RUN. It starts crawling and only rises from
 *      rate crates, which are always off the straight line.
 *   4. LOSING TEACHES. Die on a stage and every enemy on it loses 20 % health,
 *      once, permanently — a floor under frustration that never becomes a
 *      slide into triviality.
 *
 * ─── The loop, in order ─────────────────────────────────────────────────────
 *
 *   steer → advance → stream the track → shoot → move bullets → resolve hits →
 *   gates → dividers → foes → barricades → crates → pickups → boss → win/lose
 *
 * The order matters in one place: gates resolve AFTER movement so a gate can
 * never be "passed" on the same frame its number ticked up — the player always
 * sees the number they collected.
 */

// ─── Reactive surface (the HUD reads these, nothing else) ───────────────────

export type RunPhase = 'run' | 'boss' | 'clear' | 'wipe'

export const stage = ref(1)
export const phase = ref<RunPhase>('run')
/** Survivors alive right now. The single most important number on screen. */
export const squadCount = ref(0)
/** Damage per survivor per shot, this run (meta level + damage crates). */
export const damage = ref(1)
/** Shots per second per shooter, this run (meta level + rate crates). Starts
 *  crawling; every rate crate is a visible, audible step up. */
export const runFireRate = ref(1.5)
/** Coins picked up this run, before the stage bonus. */
export const runCoins = ref(0)
/** 0..1 along the stage — drives the HUD's progress rail. */
export const progress01 = ref(0)
/** 0..1 boss health, or 0 when there is no boss on screen. */
export const bossHp01 = ref(0)
/** True while a miniboss is alive — drives its HUD banner and off-screen marker. */
/**
 * ─── The stage's weapon ─────────────────────────────────────────────────────
 *
 * `null` until a weapon box is broken, and back to `null` the moment the next
 * stage starts (`startStage` clears it). It is a PER-STAGE reward — see
 * `game/weapons.ts` — so nothing here ever writes it to the save.
 *
 * Read by `stepShooting` for the multipliers and by the HUD for the badge, and
 * stamped onto every round it fires so a projectile already in the air keeps
 * behaving like the weapon that launched it.
 */
export const activeWeapon = ref<WeaponId | null>(null)

/**
 * The puzzle the player can currently do something about, for the HUD.
 *
 * These exist because the beat is otherwise invisible until it works: a player
 * who shoots one lever and then loses the road has no way to know they were one
 * shot away from a weapon, and "I did something and nothing happened" is how a
 * mechanic gets written off as scenery. Two pips and a dimmed glyph is the
 * whole affordance.
 *
 * `puzzleWeapon` is null whenever there is nothing on screen to solve — before
 * the levers stream in, and again once the box is taken or left behind.
 */
export const puzzleWeapon = ref<WeaponId | null>(null)
export const puzzlePulled = ref(0)
export const puzzleTotal = ref(0)
/**
 * …and whether the box on the road is the FREE one (stage 2's gift).
 *
 * A separate flag rather than `puzzleTotal === 0`, because the two say different
 * things and only one of them is safe to infer. Zero levers is how a gift
 * happens to be authored; "this box costs nothing" is what the badge has to
 * say, and a puzzle that ever ships with its levers stripped for a tuning pass
 * would silently start advertising itself as free. Cheap to carry, impossible
 * to get wrong.
 *
 * Without it the badge read `weaponLocked` with `0 of 0 levers shot` over the
 * one box in the game that has no lock at all — the HUD contradicting the road.
 */
export const puzzleGift = ref(false)

export const eliteAlive = ref(false)
/** 0..1 health of the miniboss the player is currently fighting. */
export const eliteHp01 = ref(0)
/** Biggest the squad ever got this run — the result screen's headline. */
export const peakSquad = ref(0)
export const kills = ref(0)
/** True when this stage is being replayed after a loss and every enemy is
 *  therefore softer. Surfaced on the result screen, never mid-run. */
export const reliefActive = ref(false)
/**
 * The autobalancer's streak: stages cleared in a row.
 *
 * Every point makes the next stage `CHALLENGE_STEP` harder; a single loss wipes
 * it. Exposed so the HUD can show the player they are being pushed — a handicap
 * nobody can see is indistinguishable from the game being inconsistent.
 */
export const challenge = ref(0)
/** Consecutive stage wins finished without claiming the `×3`. Surfaced so the
 *  result screen can say WHY the road is leaning, rather than leaving the
 *  player to feel a difficulty change they were never told about. */
export const declines = ref(0)
/** Bumped whenever the world's contents change enough that a cache should be
 *  dropped (new stage). The renderer watches it instead of diffing arrays. */
export const worldVersion = ref(0)

export const bestStage = ref(Number(getState(BEST_STAGE_KEY, 0)) || 0)
export const bestSquad = ref(Number(getState(BEST_SQUAD_KEY, 0)) || 0)

// ─── World state (plain, non-reactive — the canvas owns these) ──────────────

let track: Track = buildTrack(1)
let units: Unit[] = []
let bullets: Bullet[] = []
let gates: Gate[] = []
let dividers: Divider[] = []
let crates: Crate[] = []
let cages: Cage[] = []
let bulwarks: Bulwark[] = []
let barricades: Barricade[] = []
let rocks: Rock[] = []
let barrels: Barrel[] = []
let levers: Lever[] = []
let stones: Stone[] = []
let guards: Guard[] = []
let weaponBoxes: WeaponBox[] = []
let foes: Foe[] = []
let pickups: Pickup[] = []
let boss: Boss | null = null
/** The healer's projectiles. Empty for every other boss kind and for the whole
 *  road — nothing but a `healer` ever puts one in here. */
let bossBolts: BossBolt[] = []

/**
 * ─── Phase two, as module state ─────────────────────────────────────────────
 *
 * There is exactly one boss in flight at a time, so this lives beside the boss
 * itself rather than on the `Boss` record — the same decision `bossFloored` and
 * `bossSwingMul` made, for the same reason: they are facts about the fight
 * standing in the arena, not fields every spawn site has to remember to seed.
 * Declared HERE, with `boss`, rather than beside `stepBoss` where the rest of
 * the fight is explained, because `resetWorld` writes them and a `let` declared
 * further down the file than its first writer is a temporal-dead-zone bug
 * waiting for somebody to call that writer one line earlier.
 *
 * `bossEnraged` is a LATCH and the latching is the whole safety of the feature.
 * It is set in exactly one place — the guard gate in `damageBoss` — and never
 * cleared until the next boss spawns, so the healing archetype putting its bar
 * back above the gate it crossed cannot re-fire the turn, cannot un-fire it, and
 * cannot make the fight flicker between two tempos while the player is reading
 * it. See `BOSS_ENRAGE_AT` for why the trigger is a gate and not a health check.
 *
 * `bossCharging` is the charge's half of `Boss.charging`: "is the cycle being
 * wound up right now a lane charge". Kept out of `charging` rather than folded
 * into it because the two are genuinely different swings that the telegraph, the
 * lead and the kill all read separately — and because a meteor can have a
 * charged swing pending while phase two turns, which is precisely the tie
 * `CHARGE_EVERY`'s offset exists to avoid ever having to break.
 */
let bossEnraged = false
let bossCharging = false
/** The column a charge is committed to, locked at the start of the wind-up. The
 *  band the player reads and the bodies the charge bills are the same numbers. */
let bossChargeLane = 0
let bossChargeHalfW = 0
/** Where the dash starts and where it ends up. Written once, at the lock, so the
 *  body's travel is a pure function of the cooldown and can never arrive on a
 *  different beat than the one the cast promised. */
let bossChargeFromY = 0
let bossChargeToY = 0

/**
 * ─── A gunner's round in flight ─────────────────────────────────────────────
 *
 * The only enemy projectile in the game, and it is deliberately not a `Bullet`:
 * the player's rounds are cheap, numerous and resolved against entity lists,
 * while this one is a single fat object resolved against the CROWD, and giving
 * it the same struct would mean every bullet loop in the file had to learn to
 * ask whose side it was on.
 *
 * It lives here, next to the world it belongs to, rather than in `survival.ts`,
 * because it is the private state of one elite's branch — see the note on
 * `Foe`'s per-kind fields.
 */
export interface Bolt {
  id: number
  x: number
  y: number
  /** Unit direction, fixed at the moment it was fired. It NEVER re-aims: a
   *  homing round would make the dodge a lie. */
  dx: number
  dy: number
  /**
   * How many survivors this round may still take.
   *
   * Carried on the round rather than recomputed per tick, so a bolt costs the
   * same whether it crosses the crowd in three frames on a fast phone or in six
   * on a slow one. See `GUNNER_FRACTION`.
   */
  budget: number
  /** Seconds left before it gives up — see `BOLT_LIFE`. */
  life: number
  dead: boolean
}

let bolts: Bolt[] = []

/** Index of the next track event that has not been streamed in yet. */
let nextEvent = 0
let entityId = 1
/** How many elites this run has spawned — picks each one's kind. */
let elitesSpawned = 0

/** Where the crowd's centre is, and where the player wants it. */
let anchorX = 0
let anchorY = 0
let targetX = 0

let clock = 0
let fireAccum = 0
/** Slow-motion factor, driven by the moments worth savouring (a gate pass, the
 *  boss dying). Eases back to 1 on its own. */
let timeScale = 1
let timeScaleTarget = 1
/**
 * A slow-motion beat that outlives the frame that asked for it.
 *
 * `timeScaleTarget` is re-armed every tick, so a one-frame write is a dip the
 * player barely registers. That is right for a gate pass, which is a reward
 * landing on a moment they already chose. It is wrong for the boss's phase
 * turn, which has to read as the fight changing under them — so that one holds.
 */
let slowHoldMs = 0
/** Set while the crowd is inside a gate's charge band, so the HUD can prompt. */
let firingAtGate = false
/** Health multiplier for every enemy this stage — 1, or `RETRY_HP_RELIEF`. */
let hpRelief = 1
/** Slam-share multiplier for this stage — the second half of the relief. */
let slamRelief = 1
/** Obstacle-contact and trap multiplier for this stage — the third half. */
let contactRelief = 1
/**
 * The crowd a flawless run of this stage could have assembled.
 *
 * Latched at `startStage`, because it depends on what the shop was worth when
 * the stage opened and a purchase made mid-run must not move the yardstick the
 * run is about to be measured against. See `game/adaptive.ts`.
 */
let perfectSquad = 0
/**
 * What one of the boss's swings is worth this fight, as a multiplier on the
 * stage's authored share.
 *
 * `earlyBigHitMul` outside the adaptive band; inside it, the run's own reading —
 * the beginner's discount for a crowd that worked the road, and up to
 * `HOPELESS_SLAM_MUL` for one that did not.
 *
 * Latched when the arena opens, not read live, and the difference matters. Live,
 * it would rise as the crowd it is measuring shrank: one bad slam would make the
 * next one 2.4× heavier, and a mid-table player who mistimed a single dodge
 * would fall down the ladder inside the fight they were already losing. The bar
 * is decided by the road; so is the swing that is aimed at it.
 */
let bossSwingMul = 1

/**
 * ─── Object pools: monsters and rounds ──────────────────────────────────────
 *
 * The two entity classes whose population is unbounded in the thing the player
 * controls. A stage-90 road fields packs of forty at a time and the summoner
 * adds waves on top; a gatling at the fire-rate ceiling emits on the order of
 * two hundred rounds a second. Both are born, live under a second, and die —
 * which is the exact shape that fills a nursery and buys a GC pause in the
 * middle of a fight.
 *
 * Two changes, and they are separate wins:
 *
 *   ALLOCATION — a dead body's struct is kept and handed to the next spawn with
 *     every field overwritten from `FOE_BLANK`. `Object.assign` from a template
 *     rather than a hand-written reset, because a hand-written one silently
 *     rots: add a field to `Foe` and the template stops compiling, while a
 *     forgotten line in a reset function leaves a rolling ball's lane on an
 *     ordinary creep and nobody finds out for a month.
 *   REMOVAL — swap-and-pop instead of `splice`. Order in these two arrays is
 *     not meaningful (the renderer sorts nothing off it and the collision scans
 *     are order-independent), and `splice` on a four-hundred-entry array is a
 *     memmove per removal against dozens of removals a frame.
 *
 * Both loops that remove run BACKWARD, which is what makes swap-and-pop safe:
 * the element moved down into the hole came from the tail, which the loop has
 * already visited.
 *
 * The pools survive `resetWorld`, which is the point — the next stage starts
 * with its bodies already allocated.
 */
const FOE_POOL_MAX = 600
const BULLET_POOL_MAX = 512

const foePool: Foe[] = []
const bulletPool: Bullet[] = []

/**
 * Every field a recycled body must forget.
 *
 * Typed as `Foe`, so adding a field to the struct without adding it here is a
 * compile error rather than a haunting. Exported for `pooling.test.ts`, which
 * checks the hand-written reset below against it key by key — see `resetFoe`.
 */
export const FOE_BLANK: Readonly<Foe> = {
  id: 0, typeId: '', design: '', x: 0, y: 0, hp: 1, maxHp: 1, speed: 0,
  bite: 0, biteShare: 0, biteCd: 0, scale: 1, flash: 0, phase: 0, dead: false,
  flying: false, hold: 0, hitCd: 0, sweepCd: 0, sweepSpan: 0, sweepDir: 1,
  sweepTold: false, kind: 'scythe', lane: 1, fuse: 0, reload: 0, kindTicks: 0,
  swayPhase: 0, elite: false
}

export const BULLET_BLANK: Readonly<Bullet> = {
  x: 0, y: 0, vx: 0, vy: 0, damage: 0, life: 0, pierced: -1, weapon: null
}

/**
 * Wipe a recycled body, field by field.
 *
 * `Object.assign(f, FOE_BLANK)` is the obvious way to write this and it was the
 * first way it was written. It is also the reason the first measurement said
 * pooling was **6.3 % SLOWER** than allocating fresh: `Object.assign` walks the
 * source's own enumerable keys through a generic path, and against a
 * twenty-nine-field template that costs more than V8 spends building a literal
 * with a known shape. The pool was paying for its own saving twice over.
 *
 * Written out, the reset is a straight-line store to a monomorphic shape, and
 * `pooling.test.ts` compares its output against `FOE_BLANK` key by key — so a
 * field added to the interface and the template but forgotten here fails a test
 * rather than leaking a rolling ball's lane onto an ordinary creep.
 */
const resetFoe = (f: Foe): Foe => {
  f.id = 0; f.typeId = ''; f.design = ''
  f.x = 0; f.y = 0
  f.hp = 1; f.maxHp = 1
  f.speed = 0; f.bite = 0; f.biteShare = 0; f.biteCd = 0
  f.scale = 1; f.flash = 0; f.phase = 0
  f.dead = false; f.flying = false
  f.hold = 0; f.hitCd = 0
  f.sweepCd = 0; f.sweepSpan = 0; f.sweepDir = 1; f.sweepTold = false
  f.kind = 'scythe'; f.lane = 1; f.fuse = 0; f.reload = 0; f.kindTicks = 0
  f.swayPhase = 0; f.elite = false
  return f
}

const resetBullet = (b: Bullet): Bullet => {
  b.x = 0; b.y = 0; b.vx = 0; b.vy = 0
  b.damage = 0; b.life = 0; b.pierced = -1; b.weapon = null
  return b
}

const takeFoe = (): Foe => {
  const f = foePool.pop()
  return f ? resetFoe(f) : { ...FOE_BLANK }
}

const takeBullet = (): Bullet => {
  const b = bulletPool.pop()
  return b ? resetBullet(b) : { ...BULLET_BLANK }
}

/** Test seam: prove `resetFoe` and `resetBullet` really do return the blank. */
export const __resetForPoolTest = (f: Foe): Foe => resetFoe(f)
export const __resetBulletForPoolTest = (b: Bullet): Bullet => resetBullet(b)

/** Drop the entry at `i` and keep its struct. Safe ONLY from a backward loop —
 *  see the header. */
const releaseFoe = (i: number): void => {
  const f = foes[i]!
  const last = foes.pop()!
  if (i < foes.length) foes[i] = last
  if (foePool.length < FOE_POOL_MAX) foePool.push(f)
}

const releaseBullet = (i: number): void => {
  const b = bullets[i]!
  const last = bullets.pop()!
  if (i < bullets.length) bullets[i] = last
  if (bulletPool.length < BULLET_POOL_MAX) bulletPool.push(b)
}

/** Hand a whole array back at a stage boundary. The pools outlive the run. */
const drain = <T>(live: T[], pool: T[], cap: number): void => {
  for (const item of live) {
    if (pool.length >= cap) break
    pool.push(item)
  }
}

export const getUnits = (): Unit[] => units
export const getBullets = (): Bullet[] => bullets
export const getGates = (): Gate[] => gates
export const getDividers = (): Divider[] => dividers
export const getCrates = (): Crate[] => crates
export const getCages = (): Cage[] => cages
export const getBulwarks = (): Bulwark[] => bulwarks
export const getBarricades = (): Barricade[] => barricades
export const getBarrels = (): Barrel[] => barrels
export const getLevers = (): Lever[] => levers
/** The destructible boulders covering the levers. See `Stone`. */
export const getStones = (): Stone[] => stones
export const getGuards = (): Guard[] => guards
export const getWeaponBoxes = (): WeaponBox[] => weaponBoxes

/**
 * The weapon the player chose for `WEAPON_PICK_STAGE`, off the save — or
 * `null` when they have not chosen yet, which is what tells the scene to ask.
 * Read at `startStage` so the loaner survives a reload and every retry.
 */
export const readWeaponPick = (): WeaponId | null => {
  const v = getState<unknown>(WEAPON_PICK_KEY, null)
  return isWeaponId(v) ? v : null
}

/**
 * The beats worth marking on the progress rail, as fractions of the road.
 *
 * Only the two a player would steer differently for if they knew they were
 * coming: the weapon box (a detour worth taking) and the elites (a fight). The
 * boss is the skull the rail already ends in. Read from the track rather than
 * the live world, so the marks are there from the first frame of the stage
 * and never move.
 */
export interface StageBeat {
  /** 0..1 along the road. */
  at: number
  kind: 'weapon' | 'elite'
  weapon?: WeaponId
}

export const stageBeats = (): StageBeat[] => {
  const out: StageBeat[] = []
  const road = Math.max(1, track.arenaY)
  for (const e of track.events) {
    if (e.kind === 'weapon') {
      out.push({ at: Math.min(1, e.box.y / road), kind: 'weapon', weapon: e.weapon })
    } else if (e.kind === 'miniboss') {
      out.push({ at: Math.min(1, e.y / road), kind: 'elite' })
    }
  }
  return out
}
export const getRocks = (): Rock[] => rocks
export const getFoes = (): Foe[] => foes
/** Gunner rounds in flight. The renderer draws them; the balance harness can
 *  count them. */
export const getBolts = (): ReadonlyArray<Bolt> => bolts
export const getPickups = (): Pickup[] => pickups
export const getBoss = (): Boss | null => boss
/** The healer's bossBolts in flight, for the renderer. Always empty unless the
 *  stage's boss is a `healer`. */
export const getBossBolts = (): BossBolt[] => bossBolts
export const getTrack = (): Track => track
export const anchor = (): { x: number; y: number } => ({ x: anchorX, y: anchorY })
export const nowMs = (): number => clock
export const isChargingGate = (): boolean => firingAtGate

/** Total squad DPS — the HUD's firepower readout, and the number the balance
 *  harness tunes against. */
export const squadDps = computed(() => squadCount.value * damage.value * runFireRate.value)

// ─── Formation ──────────────────────────────────────────────────────────────

/**
 * Where survivor `i` of `n` stands, relative to the crowd's anchor.
 *
 * Sunflower (Vogel) packing: `r ∝ √i`, angle stepped by the golden angle. It
 * distributes bodies evenly with no clumps and no rings, it is O(1) per unit
 * with no neighbour queries at all, and — the reason it is here rather than a
 * boids flock — adding one survivor never moves the other hundred and eighty.
 *
 * The radius is CAPPED at `CROWD_MAX_R`, and that cap is load-bearing: it is
 * what lets a properly-aimed crowd fit through one gate leaf. A crowd that
 * grew without bound would make the gate choice impossible to execute, and the
 * whole commitment mechanic with it.
 */
const slotPos = (i: number, n: number, maxR: number): { x: number; y: number } => {
  const packR = Math.min(maxR, 0.33 * Math.sqrt(Math.max(1, n)))
  const r = packR * Math.sqrt((i + 0.5) / Math.max(1, n))
  const a = i * 2.399963229728653
  return { x: Math.cos(a) * r, y: Math.sin(a) * r * CROWD_SQUASH }
}

/**
 * ─── The funnel ─────────────────────────────────────────────────────────────
 *
 * The crowd squeezes to fit the door it is aimed at, and springs back after.
 *
 * This is what makes leaf COUNT a design choice instead of a geometry problem.
 * A three-leaf bank has 1.33-wide doors; a full-size crowd is 1.65 across the
 * radius and simply cannot fit one, so without this the generator could never
 * offer three options without taxing every large crowd that met them.
 *
 * It is also just what a crowd does. Two hundred people funnelling through a
 * doorway compress on the way in and spill out the far side, and getting that
 * for free out of a rule we needed anyway is the good kind of luck.
 */
let funnelR = CROWD_MAX_R

/**
 * Which corridor of the rib the crowd is committed to: -1 left, 1 right, 0 for
 * "no rib engaged".
 *
 * A latch, and a load-bearing one in both directions.
 *
 * It is what makes the cut happen ONCE. After it, every survivor left alive is
 * in one corridor but the anchor may still be in the other, so the spring
 * immediately starts walking them back into the stone; re-cutting on the next
 * frame would find a minority of one, take it, find another, and grind the
 * crowd away a body at a time — precisely the "the rib ate everybody" failure
 * the cut replaced.
 *
 * It is also what makes the rib a WALL rather than a shove — see
 * `holdCorridor`. It clears the moment no rib is near the crowd any more, so
 * the next passage is a fresh decision.
 */
let passageSide: -1 | 1 | 0 = 0

/**
 * ─── …and the same squeeze, for a passage ───────────────────────────────────
 *
 * A corridor is a door made of stone, so it gets the door's treatment: the
 * crowd narrows to fit the one it is aimed at and spills back out the far side.
 *
 * It is not decoration. The rib is exactly as wide as the pillar it grows out
 * of, so it takes nothing off the safe aiming band a two-leaf bank already
 * had — but the pillar GRINDS and the rib CUTS, and a band 0.35 wide is one a
 * player cannot hold when the price of missing it is half the crowd (measured
 * when walls first became lethal: 0.36 of slack put the benchmark player out on
 * stage 4). Squeezing to fit the corridor turns that back into a ±0.4 window,
 * without touching the road's geometry or the bank's own numbers.
 *
 * Only PASSAGE rocks, never scattered ones. Funnelling for every boulder in the
 * game was tried and measured worse — a crowd that is permanently narrow is a
 * crowd that has stopped being a crowd, and a boulder field is supposed to be
 * threaded at full width or not at all.
 */
const passageFit = (): number => {
  let nearest = Number.POSITIVE_INFINITY
  for (const r of rocks) {
    if (!r.passage) continue
    const ahead = r.y - anchorY
    // Behind the crowd's own centre is too late to squeeze for; past the lead
    // reads as the crowd shrinking at nothing.
    if (ahead < -1.2 || ahead > FUNNEL_LEAD) continue
    if (ahead < nearest) nearest = ahead
  }
  if (!Number.isFinite(nearest)) return CROWD_MAX_R

  // The rib is one line of stone on the centre, so the corridor is simply the
  // side of it the player is steering at. Read from the rocks rather than
  // assumed, so a future passage shape that is not centred still works.
  let ribLo = Number.POSITIVE_INFINITY
  let ribHi = Number.NEGATIVE_INFINITY
  for (const r of rocks) {
    if (!r.passage || Math.abs(r.y - anchorY - nearest) > 1.6) continue
    ribLo = Math.min(ribLo, r.x - r.w / 2 - UNIT_R)
    ribHi = Math.max(ribHi, r.x + r.w / 2 + UNIT_R)
  }
  if (!Number.isFinite(ribLo)) return CROWD_MAX_R

  const half = targetX >= (ribLo + ribHi) / 2
    ? (EDGE_X - ribHi) / 2
    : (ribLo + EDGE_X) / 2
  // Same shape as `funnelRadius`, plus the room to steer inside it — fitting
  // the corridor exactly is not fitting it. See `PASSAGE_FIT_MARGIN`.
  return Math.max(0.45, Math.min(CROWD_MAX_R, half - PASSAGE_FIT_MARGIN))
}

const updateFunnel = (dt: number): void => {
  let target = Math.min(CROWD_MAX_R, passageFit())
  let nearest = Number.POSITIVE_INFINITY

  for (const g of gates) {
    if (g.used || g.dismissed) continue
    const ahead = g.y - anchorY
    // Only doors still in front of the crowd, and only once they are close
    // enough that squeezing reads as anticipation rather than as a shrink.
    if (ahead < -0.6 || ahead > FUNNEL_LEAD || ahead > nearest) continue
    // The door the player is actually steering at — not the nearest one, which
    // on a three-leaf bank is whichever happens to be closest to the centre.
    const aimed = Math.abs(g.x - targetX) <= g.halfW + 0.6
    if (!aimed && ahead >= nearest) continue
    nearest = ahead
    if (aimed) target = Math.min(target, funnelRadius(g.halfW))
  }

  // Ease in faster than out: arriving already narrow is the point, and spilling
  // back out slowly is what makes the far side of a gate feel like relief.
  const k = 1 - Math.exp(-(target < funnelR ? 6 : 3.2) * dt)
  funnelR += (target - funnelR) * k
}

/** The furthest from the centre line a survivor may ever stand: the rail, minus
 *  their own body. Nobody is ever drawn hanging over the edge of the road. */
const EDGE_X = LANE_HALF - UNIT_R

/** Rough half-width of the crowd RIGHT NOW, funnel included — what the camera,
 *  the coin magnet and the renderer should all be reading. */
export const crowdRadius = (): number =>
  Math.min(funnelR, 0.33 * Math.sqrt(Math.max(1, squadCount.value)))

/**
 * The crowd's LIVE half-width, funnel included.
 *
 * Identical to `crowdRadius()` and exported under a second name on purpose: the
 * renderer needs to reason about the formation the player can actually see, and
 * "crowd radius" reads like a constant while this one is obviously a
 * measurement. Both are the number every collision test in here uses.
 */
export const formationRadius = (): number => crowdRadius()

/** 0..1 — how hard the crowd is currently squeezing. The renderer uses it to
 *  sell the funnel (dust, lean, tighter shadows) rather than letting the crowd
 *  silently shrink. */
export const funnelTightness = (): number =>
  Math.max(0, Math.min(1, 1 - (funnelR - 0.45) / Math.max(0.01, CROWD_MAX_R - 0.45)))

// ─── Difficulty relief ──────────────────────────────────────────────────────

type FailMap = Record<string, number>

const readFails = (): FailMap => {
  const raw = getState<FailMap>(FAILED_STAGES_KEY, {})
  return raw && typeof raw === 'object' ? raw : {}
}

/** How many times the player has lost this stage. Drives the escalating
 *  relief — the more a stage beats somebody, the more it gives back. */
export const failureCount = (n: number): number => readFails()[String(n)] ?? 0

/** Has the player already lost on this stage? */
export const hasFailedStage = (n: number): boolean => failureCount(n) > 0

const recordFailure = (n: number): void => {
  const fails = { ...readFails() }
  fails[String(n)] = (fails[String(n)] ?? 0) + 1
  setStates({ [FAILED_STAGES_KEY]: fails })
}

/**
 * Clearing a stage wipes what it owed you.
 *
 * Every concession — the retry crowd multiplier, the flat body bonus, the HP,
 * slam and contact relief — reads this one counter, so zeroing it here is what
 * makes "winning a level clears the effect" true in one place rather than five.
 * Without it the count persists per stage forever, and a player who comes back
 * to a stage they once struggled with would replay it permanently buffed.
 */
const clearFailures = (n: number): void => {
  const fails = readFails()
  if (!fails[String(n)]) return
  const next = { ...fails }
  delete next[String(n)]
  setStates({ [FAILED_STAGES_KEY]: next })
}

// ─── Lifecycle ──────────────────────────────────────────────────────────────

const resetWorld = (): void => {
  // Reclaimed BEFORE the arrays are dropped: a stage change is the one moment
  // the whole live set becomes garbage at once, and it is exactly the set the
  // next stage is about to ask for.
  drain(foes, foePool, FOE_POOL_MAX)
  drain(bullets, bulletPool, BULLET_POOL_MAX)
  units = []
  bullets = []
  gates = []
  dividers = []
  crates = []
  cages = []
  bulwarks = []
  barricades = []
  barrels = []
  levers = []
  stones = []
  guards = []
  weaponBoxes = []
  grenades = []
  rocks = []
  foes = []
  bolts = []
  pickups = []
  boss = null
  bossBolts = []
  bossEnraged = false
  bossCharging = false
  nextEvent = 0
  fireAccum = 0
  timeScale = 1
  timeScaleTarget = 1
  slowHoldMs = 0
  firingAtGate = false
  passageSide = 0
  crushDebt.clear()
  // The bulwark is a PER-STAGE pickup, exactly like `activeWeapon`: it is bought
  // off this road, it is spent on this road's fight, and a stage that opens with
  // one already armed would be a stage whose hardest moment was paid for
  // somewhere the player cannot see. Disarmed here rather than in `startStage`
  // so a retry, an expedition and a fresh career all get the same answer.
  bulwarkArmed = false
  elitesSpawned = 0
  // The run's own clock and id space. `clock` drives the crowd's idle wobble
  // and the flyers' sway, so carrying it across stages made the same seed
  // replay a stage differently depending on how long the previous run lasted.
  clock = 0
  entityId = 1
  eliteAlive.value = false
  eliteHp01.value = 0
  puzzleWeapon.value = null
  puzzlePulled.value = 0
  puzzleTotal.value = 0
  puzzleGift.value = false
}

/**
 * A body's `seed`, without spending a `Math.random()` draw.
 *
 * It has to be a hash rather than a roll: several sim tests pin `Math.random`
 * to a fixed sequence and read the crowd's behaviour off it, so one extra draw
 * per survivor would silently re-roll every obstacle, foe and gate after it.
 * An avalanche hash of the spawn counter is uniform in [0, 1) and — the part
 * that matters for what reads it — uncorrelated with the slot index that
 * decides where in the sunflower the body stands.
 */
let unitSeedTick = 0
const nextUnitSeed = (): number => {
  let h = Math.imul(unitSeedTick++ ^ 0x9e3779b9, 2246822519) >>> 0
  h ^= h >>> 13
  h = Math.imul(h, 3266489917) >>> 0
  return (h >>> 8) / 16777216
}

const spawnUnit = (x: number, y: number): void => {
  if (squadCount.value >= MAX_SQUAD) return
  units.push({
    i: units.length,
    seed: nextUnitSeed(),
    x,
    y,
    vx: 0,
    vy: 0,
    phase: Math.random(),
    flash: 0,
    dying: 0,
    inv: 0
  })
  squadCount.value++
  if (squadCount.value > peakSquad.value) peakSquad.value = squadCount.value
}

/**
 * ─── Is the run in flight today's expedition? ───────────────────────────────
 *
 * A ref rather than an argument threaded through the sim, because six different
 * places have to know and none of them are called by `startStage`: the payout
 * in `finishRun`, the bookkeeping it must NOT write, the HUD's label, the
 * result screen's forward action, and the chip itself.
 *
 * Deliberately NOT persisted. A reload during an expedition drops the player
 * back into the campaign, and the day is already spent — see `EXPEDITION_KEY`.
 * The alternative (resume it) is the same hole as marking the day on
 * completion: reload the moment the road turns against you, keep the knowledge,
 * take it again.
 */
export const isExpedition = ref(false)

/**
 * Begin a stage.
 *
 * `startStage()` with no argument resumes whatever stage the save says the
 * player is on — the resume path a reload or a cross-device cloud hydrate
 * takes. The layout is rebuilt from the stage number alone, which is why there
 * is no mid-stage snapshot to get wrong.
 *
 * `seed` is the daily expedition's one hook: the road is built at `target`'s
 * difficulty from a DIFFERENT number. Every other caller leaves it alone and
 * gets the stage's own learnable layout. Passing it also flips this run out of
 * the campaign's bookkeeping — see `isExpedition`.
 */
export const startStage = (n?: number, seed?: number): void => {
  const target = Math.max(1, Math.floor(n ?? (Number(getState(STAGE_KEY, 1)) || 1)))
  const expedition = seed !== undefined
  isExpedition.value = expedition
  stage.value = target
  track = buildTrack(target, seed)

  resetWorld()
  squadCount.value = 0
  damage.value = unitDamage.value
  setFireRate(metaFireRate.value)
  // What the shop was worth at the moment this stage opened. Everything the
  // RUN adds on top — crates, gates — is measured against these, so a purchase
  // made mid-stage can be folded in without eating what the road paid out.
  // See `syncMetaToRun`.
  metaDamage = unitDamage.value
  metaRate = metaFireRate.value
  metaSquad = startSquad.value
  runCoins.value = 0
  kills.value = 0
  // The weapon does not survive the stage that gave it. See `game/weapons.ts`:
  // the prize is for reading THIS road, and a launcher carried into stage 12
  // because the player solved stage 11 would quietly re-balance every stage
  // after it.
  activeWeapon.value = target === WEAPON_PICK_STAGE ? readWeaponPick() : null
  // Per run, like everything else here: the scene only ever reacts to it going
  // UP, so the reset announces nothing.
  rallies.value = 0
  peakSquad.value = 0
  progress01.value = 0
  bossHp01.value = 0
  phase.value = 'run'

  deaths = emptyDeaths()

  // ── The autobalancer, resolved once ──
  //
  // Two forces, opposite directions, settled here so nothing can move under the
  // player mid-run: a streak of clears winds the stage UP, and a history of
  // losing this particular stage winds it DOWN — further each time it beats
  // them. Read once, exposed to the HUD only on the result screen.
  //
  // …and NONE of it on an expedition. "The same road for everyone" is a claim
  // about the fight, not only about where the boulders are: a player who has
  // died to stage 16 four times would meet an expedition 38 % softer than the
  // one their friend is running on the same seed on the same day, and neither
  // of them could tell. It also reads the failure ledger of a REAL campaign
  // stage — `EXPEDITION_STAGE` is a stage the player will one day play for
  // themselves — so leaving it in would let a side door spend the relief that
  // the campaign stage of the same number is holding for them.
  const failures = expedition ? 0 : failureCount(target)
  reliefActive.value = failures > 0
  challenge.value = Math.max(0, Math.min(CHALLENGE_MAX, Number(getState(CHALLENGE_KEY, 0)) || 0))
  // Three forces, one number: the streak winds it up, the decline lean winds it
  // up further, and a history of losing THIS stage winds it back down.
  declines.value = Math.max(0, Math.min(DECLINE_MAX, Number(getState(REWARD_DECLINE_KEY, 0)) || 0))
  hpRelief = expedition
    ? 1
    : reliefFor(failures)
      * challengeFactor(challenge.value)
      * rewardDeclineFactor(declines.value)
  slamRelief = slamReliefFor(failures)
  contactRelief = contactReliefFor(failures)

  // The yardstick the opening stages' boss is priced against — read here, once,
  // from the shop's value at this moment. `syncMetaToRun` can grow the crowd
  // mid-stage; it must not also grow the crowd the run is being compared to, or
  // buying Squad halfway down the road would retroactively demote the run.
  perfectSquad = perfectSquadFor(target, startSquad.value, gatePayoutBonus.value)
  // Re-read at `spawnBoss` from the crowd that actually arrives; until then the
  // stage's authored value, so nothing can read a stale fight's number.
  bossSwingMul = earlyBigHitMul(target)

  anchorX = 0
  anchorY = 0
  targetX = 0
  steerMoves = 0

  funnelR = CROWD_MAX_R
  // A stuck player is handed people, not just weaker enemies: it is the only
  // concession a run dying two-thirds down the road can actually spend.
  //
  // Two shapes, deliberately. The flat bonus is a foothold (capped at four
  // bodies); the multiplier scales with whatever the player starts with, so the
  // help stays proportional at depth instead of vanishing into a squad of forty.
  // Both read the same per-stage failure count, which the clear resets — so
  // winning the stage clears the whole effect.
  const start = Math.max(1, Math.round(
    (startSquad.value + startBonusFor(failures, target))
    * retrySquadScaleFor(failures, target)
  ))
  for (let i = 0; i < start; i++) {
    const p = slotPos(i, start, CROWD_MAX_R)
    spawnUnit(p.x, p.y)
  }

  worldVersion.value++
  // `STAGE_KEY` is the campaign's resume point and an expedition must not move
  // it by one: the side door has to put the player back exactly where they left
  // the campaign, including after a reload from inside the expedition itself.
  // `RUNS_KEY` still counts, because a run genuinely happened — it is a lifetime
  // stat and the merge policy's weakest tie-break, not a position on the road.
  const patch: Record<string, unknown> = {
    [RUNS_KEY]: Number(getState(RUNS_KEY, 0) || 0) + 1
  }
  if (!expedition) patch[STAGE_KEY] = target
  setStates(patch)
}

/**
 * Take today's expedition.
 *
 * The day is spent HERE, before the first frame, and flushed immediately: the
 * whole reason the flag records the day a run STARTED is that a player losing a
 * road they cannot re-roll would otherwise only have to reload the tab, and the
 * debounced blob write is exactly the window that would let them.
 *
 * `now` is injected so the day boundary is testable — nothing in this feature
 * reads a clock a test cannot move.
 */
export const startExpedition = (now: number = Date.now()): void => {
  markExpeditionTaken(now)
  void flushSaveNow()
  startStage(EXPEDITION_STAGE, expeditionDay(now))
}

/**
 * ─── A purchase reaches the run the player is already in ────────────────────
 *
 * The shop is reachable from the HUD **during a run**, and three of its tracks
 * used to be latched at `startStage` and nowhere else: `damage.value`,
 * `runFireRate` and the crowd itself are snapshots of `unitDamage`,
 * `fireRate` and `startSquad` taken as the stage opened. Buy Squad,
 * Firepower or Fire Rate mid-stage and the coins went, the level went up, and
 * the run did not change by one survivor, one point of damage or one shot a
 * second — measured: six levels of each bought at stage 7 moved squad 11 -> 11,
 * damage 1 -> 1, rate 1.90 -> 1.90.
 *
 * Squad is the one players report, and that is not a coincidence: the HUD shows
 * the live crowd, so it is the only one of the three where you can WATCH the
 * number refuse to move. The other two were just as broken and quieter.
 *
 * (The rest of the shop was always live — reach, magnet, coin multiplier, gate
 * payout, grenade, shield and the two weapon multipliers are read from their
 * computed at the moment they are used, so they were never latched.)
 *
 * ── How it folds in ──
 *
 * The DELTA against the baseline the stage opened with, never the absolute
 * value: `damage.value` is `unitDamage` plus every green crate broken so far,
 * and overwriting it would refund the shop by confiscating the road's payout.
 *
 * ── Why increases only ──
 *
 * A level cannot legitimately fall, but the number CAN: a cloud save landing
 * mid-run re-reads the levels (`useUpgrades` watches `saveDataVersion`), and a
 * stale blob would briefly report less than the player has. Deleting live
 * survivors on the strength of that is far worse than doing nothing, and the
 * next `startStage` reconciles it either way.
 */
let metaSquad = 0
let metaDamage = 0
let metaRate = 0

const syncMetaToRun = (): void => {
  // Between stages there is nothing to fold into — `startStage` reads the
  // current values directly and sets the baseline from them.
  if (phase.value !== 'run' && phase.value !== 'boss') return

  const dmg = unitDamage.value
  if (dmg > metaDamage) {
    damage.value += dmg - metaDamage
    metaDamage = dmg
  }

  const rate = metaFireRate.value
  if (rate > metaRate) {
    // Through `setFireRate` so the purchase is clamped into the legal band like
    // every other writer — a shop level may not push the run past MAX_FIRE_RATE.
    setFireRate(runFireRate.value + (rate - metaRate))
    metaRate = rate
  }

  const squad = startSquad.value
  if (squad > metaSquad) {
    const arriving = Math.round(squad - metaSquad)
    metaSquad = squad
    for (let i = 0; i < arriving; i++) {
      // Into the body of the crowd rather than at a gate: these did not come
      // through a door, and dropping them at the anchor lets the formation
      // spring pack them in the way it does after any other change in size.
      spawnUnit(
        anchorX + (Math.random() - 0.5) * CROWD_MAX_R,
        anchorY + (Math.random() - 0.5) * CROWD_MAX_R * CROWD_SQUASH
      )
    }
    // The same full-squad flash a supply crate fires. The shop modal is over
    // the canvas when this lands and the loop is paused behind it, so the flash
    // is still on the bodies when the player closes it — which is the frame
    // they are looking for the change in.
    if (arriving > 0) for (const u of units) u.flash = 220
  }
}

/**
 * Watched rather than pushed from the shop.
 *
 * `useUpgrades` has no business knowing a run exists, and a purchase is not the
 * only way a level moves — a cloud hydrate re-reads them too. Watching the
 * three derived values covers every writer there will ever be, including the
 * next one somebody adds.
 */
watch([unitDamage, metaFireRate, startSquad], syncMetaToRun)

/**
 * Advance to the next stage and start it.
 *
 * After an expedition it advances nothing: `stage.value` is
 * `EXPEDITION_STAGE`, which is a rung on the difficulty curve rather than a
 * position in the campaign, and `stage.value + 1` would hand the player the
 * stage after a road they were never on. `startStage()` with no argument goes
 * back to the save's own resume point — which the expedition never touched.
 *
 * The guard lives HERE, not at the call site, because there are two call sites
 * today (the result screen's two buttons) and the cost of a third one forgetting
 * is a campaign jumped forward by four stages that no player can undo.
 */
export const advanceStage = (): void => {
  if (isExpedition.value) startStage()
  else startStage(stage.value + 1)
}

/** Restart the current stage after a wipe — or, out of an expedition, go back
 *  to the campaign. An expedition is one attempt a day; there is no retry. */
export const retryStage = (): void => {
  if (isExpedition.value) startStage()
  else startStage(stage.value)
}

export interface RunSummary {
  stage: number
  cleared: boolean
  squad: number
  peakSquad: number
  kills: number
  /** What was actually banked — already multiplied on an expedition. */
  coins: number
  /**
   * What the same run would have paid in the campaign.
   *
   * Exists so the rewarded video's own ×3 can be priced off the ordinary
   * payout: the ad multiplier is the game's primary income and the difficulty
   * curve is priced against it (see `REWARD_MULTIPLIER`), so letting the
   * expedition's triple compound with it into a 9× would re-price the whole
   * upgrade ladder off one button on one screen a day. Identical to `coins` on
   * every campaign run, which is why nothing else had to change.
   */
  baseCoins: number
  isRecord: boolean
  /** The run was played with the retry relief active. */
  relieved: boolean
  /** This was the daily expedition, not a campaign stage. The result screen
   *  reads it to name the run and to send both buttons back to the campaign. */
  expedition: boolean
}

let summary: RunSummary = {
  stage: 1, cleared: false, squad: 0, peakSquad: 0, kills: 0, coins: 0,
  baseCoins: 0, isRecord: false, relieved: false, expedition: false
}

export const runSummary = (): RunSummary => summary

/**
 * Close out the stage.
 *
 * Coins are computed HERE rather than on the result screen so the number the
 * player sees is the number that was banked, even if an interstitial plays in
 * between (which it does — see the scene's ad ordering).
 */
const finishRun = (cleared: boolean): void => {
  // Idempotent: the boss step and the squad-wiped check can both fire inside a
  // single tick, and a second payout would double the coins.
  if (phase.value === 'clear' || phase.value === 'wipe') return

  const scav = coinMultiplier.value
  const bonus = cleared
    ? stageReward(stage.value, peakSquad.value)
    : wipeReward(stage.value, peakSquad.value, progress01.value)
  const baseCoins = Math.max(1, Math.round((runCoins.value + bonus) * scav))
  // ── The expedition's triple, and the ONLY place it is applied ──
  //
  // On the run's own total, at the very end, after the scavenge multiplier and
  // after the road's own pickups — so it multiplies what this run earned and
  // touches no formula any other run reads. `stageReward`, `wipeReward` and
  // `coinMultiplier` are all left exactly as the campaign sees them, which is
  // what stops a "daily bonus" from quietly becoming a balance change.
  const expedition = isExpedition.value
  const coins = expedition ? baseCoins * EXPEDITION_PAYOUT : baseCoins

  // An expedition is never a record. `bestStage` is the leaderboard's score and
  // the merge policy's headline number, and the expedition's stage is a rung on
  // the difficulty curve rather than a stage the player has reached — banking it
  // would post a career best for a road that is not part of the career.
  const record = !expedition && cleared && stage.value >= bestStage.value
  summary = {
    stage: stage.value,
    cleared,
    squad: squadCount.value,
    peakSquad: peakSquad.value,
    kills: kills.value,
    coins,
    baseCoins,
    isRecord: record,
    relieved: reliefActive.value,
    expedition
  }

  const patch: Record<string, unknown> = {
    [TOTAL_KILLS_KEY]: Number(getState(TOTAL_KILLS_KEY, 0) || 0) + kills.value
  }
  if (peakSquad.value > bestSquad.value) {
    bestSquad.value = peakSquad.value
    patch[BEST_SQUAD_KEY] = peakSquad.value
  }
  // ── Everything below this line is the CAMPAIGN's bookkeeping ──
  //
  // The expedition is a side door and writes none of it. Enumerated rather than
  // filtered, because each one is a separate way the side door could corrupt the
  // career if it were left in:
  //
  //   CHALLENGE  — the clear streak is the campaign's autobalancer. Winning a
  //                road built at stage 16 would wind the player's own next
  //                stage up; losing it would wipe a streak they earned.
  //   BEST_STAGE — the leaderboard's score AND the merge policy's headline
  //                number. See `record` above.
  //   STAGE      — the resume point. Bumping it is the campaign jumping four
  //                stages forward for a road that was never part of it.
  //   FAILURES   — keyed by stage NUMBER, and `EXPEDITION_STAGE` is a real
  //                campaign stage the player will meet later. A failure here
  //                would hand them relief on a stage they have never attempted;
  //                a clear would erase relief they had already earned on it.
  //
  // `TOTAL_KILLS` and `BEST_SQUAD` above ARE written: they are lifetime tallies
  // of things that genuinely happened, and neither is read by the merge policy
  // or the board.
  if (!expedition) {
    // A clear winds the streak up one; a loss wipes it to zero. Both are written
    // in the same batch as the rest of the run's bookkeeping, so a player who
    // closes the tab on the result screen keeps the difficulty they earned.
    const nextChallenge = cleared ? Math.min(CHALLENGE_MAX, challenge.value + 1) : 0
    challenge.value = nextChallenge
    patch[CHALLENGE_KEY] = nextChallenge

    if (cleared) {
      if (stage.value > bestStage.value) {
        bestStage.value = stage.value
        patch[BEST_STAGE_KEY] = stage.value
      }
      // Bank the NEXT stage immediately: a player who closes the tab on the
      // victory screen has earned the stage they just cleared.
      patch[STAGE_KEY] = stage.value + 1
    }
  }
  setStates(patch)

  // Losing is recorded BEFORE the flush, so the relief is already in the save
  // by the time the player taps "try again" — but ONLY if somebody was playing.
  // A run that never steered is not a stuck player to be helped; it is an idle
  // tab, and paying it relief is how a difficulty curve quietly turns into an
  // idle game.
  if (!expedition) {
    if (!cleared && wasPlayed()) recordFailure(stage.value)
    else if (cleared) clearFailures(stage.value)
  }

  // Hard checkpoint → drain the whole save pipeline NOW rather than waiting out
  // the 200 ms state debounce plus the strategy's own flush debounce. A player
  // who clears a stage and immediately closes the tab (or reloads on a portal
  // that kills the process) would otherwise beat the pipeline and come back to
  // the previous stage — the exact regression this call exists to prevent.
  void flushSaveNow()

  phase.value = cleared ? 'clear' : 'wipe'
  pushFx({ kind: cleared ? 'stageClear' : 'wipe', x: anchorX, y: anchorY })
}

// ─── Input ──────────────────────────────────────────────────────────────────

/**
 * Did the player actually play this run?
 *
 * Counts steers that MOVED the crowd somewhere it was not already going. It
 * exists for one reason: the escalating relief is a concession to a frustrated
 * player, and a frustrated player is not the same thing as an idle tab. Without
 * this the two are indistinguishable to the save file — and the simulation
 * proved it, by walking a run that never touched the screen through stage 1 on
 * its fifth attempt purely on accumulated relief. A game that plays itself
 * after four losses is not a game with a difficulty curve.
 *
 * Three deliberate moves is the bar. It is low on purpose: this is meant to
 * exclude nobody who is trying.
 */
const MEANINGFUL_STEER = 0.5
const PLAYED_THRESHOLD = 3
let steerMoves = 0

/** True when this run shows evidence of a player at the controls. */
export const wasPlayed = (): boolean => steerMoves >= PLAYED_THRESHOLD

/** Absolute steer — a tap puts the crowd's target under the finger. */
export const steerTo = (worldX: number): void => {
  const next = Math.max(-LANE_HALF + 0.4, Math.min(LANE_HALF - 0.4, worldX))
  if (Math.abs(next - targetX) >= MEANINGFUL_STEER) steerMoves++
  targetX = next
}

/** Relative steer — a drag moves the target by a world-space delta. */
export const steerBy = (dxWorld: number): void => steerTo(targetX + dxWorld)

export const steerTarget = (): number => targetX

// ─── Track streaming ────────────────────────────────────────────────────────

/**
 * Materialise every track event within `LOOKAHEAD` of the crowd.
 *
 * The track is a static score, but the world is not: spawning all of stage 14's
 * two hundred entities up front would cost a frame and keep four hundred dead
 * objects in the collision loops. Streaming keeps the live set at roughly what
 * is on screen.
 */
const LOOKAHEAD = 30

const streamTrack = (): void => {
  const diff = difficultyFactor()
  while (nextEvent < track.events.length) {
    const e = track.events[nextEvent]
    if (!e || e.y > anchorY + LOOKAHEAD) break
    nextEvent++

    switch (e.kind) {
      case 'gates': {
        // One id for the whole bank: it is what lets a claimed door destroy the
        // offers beside it, and the pillars between them, in one stroke.
        const bankId = entityId++
        for (const leaf of e.leaves) {
          gates.push({
            id: entityId++, bankId, x: leaf.x, halfW: leaf.halfW, y: e.y,
            op: leaf.op, value: leaf.value, charge: 0, hotFor: 999,
            used: false, dismissed: false, pop: 0,
            // Authored on the leaf, 1 everywhere the road rolls its own doors.
            pumpMul: leaf.pumpMul ?? 1,
            ...(leaf.pumpCap !== undefined ? { pumpCap: leaf.pumpCap } : {})
          })
        }
        // The pillars are what turn a row of doorways into a decision.
        for (const x of e.dividers) {
          dividers.push({
            id: entityId++, bankId, x, y: e.y, halfW: DIVIDER_HALF_W, dismissed: false
          })
        }
        break
      }

      case 'crates':
        for (const c of e.crates) {
          // Scaled by the same difficulty and relief the walls get. A crate is
          // an obstacle with a reward inside it, and it was the one thing on
          // the road that ignored both — so a stuck player got a softer stage
          // in every respect except the boxes that would have got them unstuck.
          const hp = Math.max(1, Math.round(c.hp * diff * hpRelief))
          crates.push({
            id: entityId++, kind: c.kind, x: c.x, y: e.y, hp, maxHp: hp,
            spin: (Math.random() - 0.5) * 0.4, dead: false,
            // Unscaled by difficulty on purpose: relief makes a box easier to
            // break, it does not make it pay more.
            ...(c.gain !== undefined ? { gain: c.gain } : {})
          })
        }
        break

      case 'cages':
        for (const c of e.cages) {
          // Same difficulty and relief as a crate, and for the same reason: a
          // cage is an obstacle with a reward inside it, and a stuck player who
          // gets softer walls and softer boxes must not be handed the one prop
          // on the road that stayed at full price.
          //
          // `hold` is NOT scaled. Relief makes a prize cheaper to open; it does
          // not make it pay more, which is the rule the crate's `gain` already
          // states and the reason a struggling player cannot farm relief.
          const hp = Math.max(1, Math.round(c.hp * diff * hpRelief))
          cages.push({
            id: entityId++, x: c.x, y: e.y, hp, maxHp: hp,
            hold: c.hold, flash: 0, dead: false
          })
        }
        break

      case 'bulwarks':
        for (const w of e.bulwarks) {
          const hp = Math.max(1, Math.round(w.hp * diff * hpRelief))
          bulwarks.push({
            id: entityId++, x: w.x, y: e.y, hp, maxHp: hp,
            spin: Math.random() * Math.PI * 2, dead: false
          })
        }
        break

      case 'rocks':
        for (const r of e.blocks) {
          rocks.push({
            id: entityId++, x: r.x, y: e.y, w: r.w,
            passage: e.passage === true,
            spin: (Math.random() - 0.5) * 0.5,
            seed: Math.floor(Math.random() * 1000)
          })
        }
        break

      case 'barricade':
        for (const b of e.blocks) {
          const hp = Math.round(b.hp * diff * hpRelief)
          barricades.push({
            id: entityId++, x: b.x, y: e.y, w: b.w, hp, maxHp: hp, flash: 0, dead: false
          })
        }
        break

      case 'foes': {
        const def = foeDef(e.typeId)
        const hp = Math.max(1, Math.round(def.hp * foeHpScale(stage.value) * diff * hpRelief))
        // A streak sends more of them, and each one takes a bigger mouthful.
        const count = Math.round(e.count * challengePackFactor(challenge.value))
        for (let i = 0; i < count; i++) {
          const spread = (i / Math.max(1, count - 1) - 0.5) * 2 * e.spread
          const design = def.designs[i % def.designs.length] ?? def.designs[0]!
          // Fields, not a literal: `takeFoe` hands back a recycled body with
          // every field already reset from `FOE_BLANK`, so only what this
          // archetype actually decides is written here. Anything omitted is the
          // blank's value, which is why the reset is a typed template.
          const f = takeFoe()
          f.id = entityId++
          f.typeId = def.id
          f.design = design
          f.x = Math.max(-LANE_HALF + 0.5, Math.min(LANE_HALF - 0.5, spread + (Math.random() - 0.5) * 0.6))
          f.y = e.y + (Math.random() - 0.5) * 1.4
          f.hp = hp
          f.maxHp = hp
          f.speed = def.speed
          f.bite = Math.max(1, Math.round(def.bite * challengeBiteFactor(challenge.value)))
          f.biteShare = biteShareFor(def.id) * challengeBiteFactor(challenge.value)
          f.scale = def.scale
          f.phase = Math.random()
          f.flying = def.flying
          f.swayPhase = Math.random() * Math.PI * 2
          foes.push(f)
        }
        break
      }

      case 'miniboss': {
        const def = foeDef(e.typeId)
        const hp = Math.max(
          20,
          Math.round(def.hp * foeHpScale(stage.value) * e.hpScale * diff * hpRelief)
        )
        // STAGE 1's elite is a lesson, not a wall — it stands in for the boss
        // the opening no longer has, and the player has not met an upgrade yet.
        //
        // Cutting its HP alone was not enough and measurably made things WORSE:
        // an elite plants and blocks the road, and every miniboss bites at twice
        // its archetype's rate, so a 40 %-health one still ate a careless crowd
        // at 88 % of the road — the sim went from "reaches the arena on every
        // seed" to "reaches it on none". The teeth are the part that has to
        // come off, so on stage 1 it bites like a normal foe of its type.
        const tutorial = stage.value <= 1
        const biteMul = tutorial ? 1 : 2
        const el = takeFoe()
        el.id = entityId++
        el.typeId = def.id
        // Which fight this one is. Below stage 4 it is always the scythe the
        // tutorial taught; from there it comes out of the pool. Resolved HERE,
        // before the body, because the body is now derived from it.
        el.kind = minibossKindFor(stage.value, elitesSpawned)
        // THE MODEL IS THE TELL — see `MINIBOSS_DESIGN`. The archetype still
        // sets the stats (a brute is a wall, a hound is a sprint), but it no
        // longer picks the body: Snaggletusk always cleaves, Thornwick always
        // fires, Cinderhound always plants a bomb. A player who has met one
        // before can start moving on the silhouette instead of on the wind-up.
        el.design = minibossDesignFor(el.kind)
        el.y = e.y
        el.hp = hp
        el.maxHp = hp
        // Slower than its archetype on the walk in — but the walk in is not
        // the fight. See `ELITE_HOLD_AHEAD`: it plants when it arrives.
        el.speed = def.speed * 0.7
        el.bite = def.bite * biteMul
        el.biteShare = biteShareFor(def.id) * biteMul
        el.scale = def.scale * 1.9
        el.phase = Math.random()
        el.hold = ELITE_HOLD_MAX
        // First sweep on a full cycle, so the walk in is not also a wind-up:
        // the player gets the whole approach before anything is thrown.
        el.sweepCd = ELITE_SWEEP_CD
        el.sweepSpan = ELITE_SWEEP_CD
        el.sweepDir = Math.random() < 0.5 ? -1 : 1
        // DERIVED, not rolled. Which half of the road a `roller` owns is the
        // entire content of that fight, and `Math.random()` in this game is
        // for cosmetic jitter only — a stage has to be learnable, and a coin
        // flip on which side is lethal is the one thing that cannot be
        // learned. See `rollerLaneFor`.
        el.lane = rollerLaneFor(stage.value, elitesSpawned)
        el.elite = true
        foes.push(el)
        elitesSpawned++
        pushFx({ kind: 'eliteSpawn', x: 0, y: e.y })
        break
      }

      case 'weapon': {
        // ONE id for the whole beat, exactly like a gate bank's: it is what lets
        // the last lever delete the armour over the box without either of them
        // holding a reference to the other.
        const puzzleId = entityId++
        for (const lv of e.levers) {
          levers.push({
            id: entityId++, puzzleId, x: lv.x, y: lv.y,
            // NOT scaled by `diff` or `hpRelief`. A lever charges attention, and
            // the run that most needs a free weapon is exactly the run that
            // cannot also afford to pay for one in DPS.
            hp: lv.hp, maxHp: lv.hp,
            pulled: false, flash: 0, pulledFor: 0
          })
        }
        // The cover over each post. Scaled by difficulty and relief exactly as
        // the walls are — the stone is an obstacle, and a stuck player who gets
        // a softer road should not meet the one wall that ignored the softening
        // standing in front of the beat that would unstick them.
        for (const st of e.stones) {
          const stoneHp = Math.max(1, Math.round(st.hp * diff * hpRelief))
          stones.push({
            id: entityId++, puzzleId, x: st.x, y: st.y, w: st.w,
            hp: stoneHp, maxHp: stoneHp, flash: 0, dead: false,
            spin: (Math.random() - 0.5) * 0.5,
            seed: Math.floor(Math.random() * 1000)
          })
        }
        const boxHp = Math.max(1, Math.round(e.box.hp * diff * hpRelief))
        const isGift = e.gift ?? false
        weaponBoxes.push({
          id: entityId++, puzzleId, weapon: e.weapon,
          x: e.box.x, y: e.box.y, r: e.boxR ?? WEAPON_BOX_R, gift: isGift,
          hp: boxHp, maxHp: boxHp,
          // A gift has no armour, so it has nothing to be locked BY: it spawns
          // open and stays open, which is the whole of the "open box" read on
          // the road. The full argument, and the measured cost of the old
          // closed one, is on `WeaponBox.locked`.
          locked: !isGift,
          // …and past the reveal ring, deliberately. The ring means "the thing
          // you shot did THIS"; a box that was never shut has no such moment,
          // and firing it here would play it 30 units up the road, off the top
          // of the camera, at the instant `streamTrack` created the object.
          openFor: isGift ? WEAPON_REVEAL_S : 0,
          dead: false,
          leversTotal: e.levers.length, leversPulled: 0,
          spin: (Math.random() - 0.5) * 0.25
        })
        for (const g of e.guards) {
          const hp = Math.round(g.hp * diff * hpRelief)
          guards.push({
            id: entityId++, puzzleId, x: g.x, y: e.guardY,
            w: g.w, hp, maxHp: hp, flash: 0, dead: false
          })
        }
        puzzleWeapon.value = e.weapon
        puzzlePulled.value = 0
        puzzleTotal.value = e.levers.length
        puzzleGift.value = isGift
        break
      }

      case 'coins':
        for (let i = 0; i < e.xs.length; i++) {
          pickups.push({
            id: entityId++,
            x: e.xs[i] ?? 0,
            y: e.ys[i] ?? e.y,
            value: 1,
            taken: false,
            phase: Math.random() * Math.PI * 2
          })
        }
        break
    }
  }
}

// ─── The tick ───────────────────────────────────────────────────────────────

/**
 * Advance the world by `dtMs` of wall time.
 *
 * The caller (the scene's RAF loop) is responsible for NOT calling this while
 * the game is paused — an ad, a hidden tab, an open modal. That gate lives in
 * one place, `useGamePause`, so the simulation never has to know why it stopped.
 */
export const step = (dtMs: number): void => {
  if (phase.value === 'clear' || phase.value === 'wipe') return

  // Ease the slow-motion factor back toward 1. Frame-rate independent, so a
  // 30 fps phone gets the same amount of drama as a 120 Hz tablet.
  timeScale += (timeScaleTarget - timeScale) * Math.min(1, dtMs / 120)
  if (Math.abs(timeScaleTarget - timeScale) < 0.01) timeScale = timeScaleTarget
  timeScaleTarget = 1
  if (slowHoldMs > 0) {
    slowHoldMs -= dtMs
    timeScaleTarget = 0.45
  }

  // Cap the step: a backgrounded tab that returns with a 4-second delta must
  // not teleport the crowd through a barricade.
  const dt = Math.min(dtMs, 60) * timeScale / 1000
  clock += dtMs * timeScale

  // ── The onboarding hold ──
  //
  // The crowd answers the thumb, the guns fire, and the road does not move. It
  // is deliberately a hold on the SIMULATION rather than a pause, because the
  // one thing the tutorial has to teach is that moving your finger moves the
  // squad — and a paused game cannot demonstrate that.
  //
  // The road IS streamed and the guns DO run during the hold, and that is a
  // reversal: it used to skip `streamTrack` so nothing of stage 1 sat behind
  // the lightbox. What that bought was a black, empty lane and three people
  // behind the first instruction a stranger ever reads. Stage 1's opening
  // doorway now stands inside the first screen (`OPENING_GATE_Y`) and races
  // under the crowd's fire while the player learns the one control — so the
  // first thing they see is the one thing this game does that nothing else
  // does. Nothing that could hurt them runs: no foes, no obstacles, no clock.
  streamTrack()
  stepAnchor(dt)
  stepUnits(dt)
  stepShooting(dt)
  stepBullets(dt)
  stepGates(dt)
  if (steerOnly.value) return
  stepDividers(dt)
  stepFoes(dt)
  stepBarricades(dt)
  stepRocks(dt)
  stepCrates(dt)
  stepCages(dt)
  stepBulwarks(dt)
  stepLevers(dt)
  stepStones(dt)
  stepGuards(dt)
  stepWeaponBoxes(dt)
  stepBarrels(dt)
  stepGrenades(dt)
  stepPickups(dt)
  stepBoss(dt)

  progress01.value = Math.max(0, Math.min(1, anchorY / Math.max(1, track.arenaY)))

  // `finishRun` is idempotent, so this needs no phase check of its own — the
  // boss step may already have ended the run earlier in this same tick.
  //
  // …unless the scene's rally policy hands the crowd a second wind first. See
  // `setRallyPolicy`: the sim asks, the scene decides, and a run that is
  // rallied simply never ended.
  if (squadCount.value <= 0 && !tryRally()) finishRun(false)
}

// ─── The rally ──────────────────────────────────────────────────────────────
//
// A wipe that is not one. When the last survivor falls, the sim asks a policy
// the scene installed how many bodies to hand back; a positive answer respawns
// them at the crowd's own position and the run carries on — same phase, same
// boss, same road — as if the crowd had never quite reached zero.
//
// The POLICY lives outside the sim on purpose. Whether a player deserves a
// second wind is a question about the funnel (is this their first session? is
// this an early stage? has this stage already rallied once?), and the sim
// knows nothing about sessions. It only knows how to put survivors back.
//
// It exists because the earliest exit in the game was measured: a run that
// never steers clears stage 1 and dies at 64 % of stage 2 — a "Squad Wiped
// Out" screen forty-five seconds into a stranger's first session. Retry relief
// already softens the retry, but relief needs a retry, and that screen is where
// the retry did not happen.

export interface RallyAsk {
  stage: number
  /** 0..1 along the road when the last survivor fell. */
  progress01: number
  peakSquad: number
  phase: RunPhase
}

/** How many survivors to hand back, or 0 (or less) to let the wipe stand. */
export type RallyPolicy = (ask: RallyAsk) => number

let rallyPolicy: RallyPolicy | null = null

/** Install (or with `null`, remove) the rally policy. */
export const setRallyPolicy = (policy: RallyPolicy | null): void => { rallyPolicy = policy }

/** Rallies this run has been handed. Bumped so the HUD can announce one. */
export const rallies = ref(0)

const tryRally = (): boolean => {
  if (!rallyPolicy) return false
  if (phase.value !== 'run' && phase.value !== 'boss') return false
  const n = Math.floor(rallyPolicy({
    stage: stage.value, progress01: progress01.value,
    peakSquad: peakSquad.value, phase: phase.value
  }))
  if (!Number.isFinite(n) || n <= 0) return false
  for (let i = 0; i < n; i++) {
    const p = slotPos(i, n, CROWD_MAX_R)
    spawnUnit(anchorX + p.x, anchorY + p.y)
  }
  // A moment in which nothing can touch them. The rally lands at the exact
  // spot the crowd just died, which is by definition inside whatever killed
  // it; without the grace the second wind is a second wipe on the same frame.
  for (const u of units) u.inv = Math.max(u.inv, RALLY_GRACE_MS)
  // The miracle, made visible. Bodies reappearing with nothing around them is
  // indistinguishable from a bug — the HUD says WHO saved the player, this says
  // WHERE it happened and HOW MANY it handed back.
  pushFx({ kind: 'rally', x: anchorX, y: anchorY, count: n })
  rallies.value++
  return true
}

/** Collision immunity handed to a rallied crowd, ms. Long enough to walk out
 *  of the pack that ate the last one; short enough that it is a reprieve
 *  rather than a shield. */
export const RALLY_GRACE_MS = 1500

/**
 * Hold the road still while the crowd stays steerable.
 *
 * Set by the onboarding lightbox and by nothing else. It is NOT a pause: `step`
 * still runs the anchor and the formation, so the squad follows the finger,
 * which is the entire lesson. See the hold in `step`.
 */
export const steerOnly = ref(false)

/** The crowd's centre: forward at the stage's pace, sideways after the thumb. */
const stepAnchor = (dt: number): void => {
  const forward = phase.value === 'run' && !steerOnly.value ? stageSpeed(stage.value) : 0
  // A holding elite DRAGS the road down to a crawl. It does not stop it.
  //
  // It defends the ground it was placed on — an elite that merely tracked the
  // crowd would be pulled back through every gate bank behind it, eating the
  // rounds meant for the doors — but it defends it by making the last few units
  // of road take a long time, not by switching the run off. See
  // `eliteDragFor`: the whole point is that the player can always see they are
  // still moving, because a stopped runner reads as a hung game rather than as
  // a fight, and the players it happened to were losing three to seven seconds
  // of that.
  //
  // The nearest holding elite wins; a second one further up cannot compound the
  // slow.
  let drag = 1
  if (phase.value === 'run') {
    for (const f of foes) {
      if (!f.elite || f.dead || f.hold <= 0) continue
      if (f.y < anchorY) continue
      drag = Math.min(drag, eliteDragFor(f.y - anchorY))
    }
  }

  anchorY += forward * drag * dt

  // There is NO hard floor any more, and that is deliberate.
  //
  // A backstop at the elite's body looks harmless — the leash should expire long
  // before a crawling crowd covers the distance — but it is not, because the
  // elite CLOSES. It walks down the lane while the crowd creeps up it, so the
  // gap shuts from both ends and the block line always arrives. Measured with a
  // backstop still in place, the crowd stood still for 1.9 seconds.
  //
  // So the drag is the whole mechanic: at `ELITE_DRAG_MIN` the road never stops,
  // the elite is in the firing line for as long as the leash allows, and a squad
  // that cannot kill it inches past paying in bodies. Contact is handled where
  // every other foe's is — the elite displaces and bites the crowd it is
  // standing in, which is a cost the player can see and steer against, rather
  // than a number that stops going up.

  // Critically-damped-ish approach. Snappy enough to feel direct, soft enough
  // that the crowd has mass.
  const k = 1 - Math.exp(-STEER_SPRING * dt)
  anchorX += (targetX - anchorX) * k

  if (phase.value === 'run' && anchorY >= track.arenaY) {
    phase.value = 'boss'
    spawnBoss()
  }
}

/**
 * ─── The adaptive bar, resolved ─────────────────────────────────────────────
 *
 * Everything that decides how big the opening stages' boss is, in one place and
 * read exactly once — at the instant the arena opens. See `game/adaptive.ts`
 * for why the stages 1–5 boss is priced against the run instead of the stage.
 *
 * The three inputs, and why each is read the way it is:
 *
 * FIREPOWER  `squad × damage × fire rate`, with the weapon's multiplier folded
 *            in exactly as `stepShooting` folds it in. A launcher divides the
 *            damage and multiplies the cadence so the streams cancel, but
 *            `damageMul` does NOT cancel — a run that solved the puzzle really
 *            is hitting harder, and a bar that ignored it would hand the best
 *            reward on the road a boss that melts.
 * TARGET     from the crowd alone, against the ceiling latched at
 *            `startStage`.
 * THE DIALS  the difficulty setting and the autobalancer multiply the CLOCK,
 *            not the bar. That is the same intent expressed in the unit the
 *            fight is now denominated in: Hard means a longer climax, a player
 *            who keeps dying here gets a shorter one, and a clear streak winds
 *            it back up. Clamped, because `challengeFactor` alone reaches ×12.7.
 */
/**
 * The fight, as the model sees it: this run's firepower and what the boss will
 * do to the crowd producing it.
 *
 * Shared by the ladder (stages 1-5) and the melt floor (6+) so the two can
 * never disagree about what a second of this run's fire is worth — the floor's
 * whole promise is denominated in that number.
 */
const fightModel = (openingCd: number): AdaptiveFight => {
  const weapon = activeWeapon.value
  const def = weapon ? WEAPONS[weapon] : null
  const damageMul = def ? def.damageMul * weaponPowerMul(weapon!) : 1
  // The bar is priced on the SOFT swing — see the note in `adaptiveHp`.
  const soft = earlyBigHitMul(stage.value)
  return {
    squad: squadCount.value,
    perSurvivorDps: damage.value * runFireRate.value * damageMul,
    slamShare: bossHitShare(1, soft),
    // The FLOOR, not the budget: the model re-applies `max(floor, squad x
    // share)` at every step as the crowd shrinks, which is what the fight does.
    // Handing it the budget at full strength would charge a crowd of twenty the
    // bite a crowd of four hundred pays.
    slamMinKill: bossHitFloor(soft),
    guardPhases: bossGuardGates(stage.value).length,
    openingCd,
    slamCd: SLAM_CD_BASE,
    slamCdDecay: SLAM_CD_DECAY,
    slamCdMin: SLAM_CD_MIN
  }
}

/**
 * The smallest bar this run may be handed on a stage the ladder does not cover.
 *
 * `BOSS_MIN_FIRE_SECONDS` of this crowd's own fire, integrated the same way the
 * ladder integrates — so it shrinks as the boss kills survivors, exactly like a
 * real fight.
 *
 * ⚠ THE DIALS MULTIPLY THE BAR HERE, not the clock — the opposite of
 * `adaptiveHp` one function up, and the difference is load-bearing.
 *
 * This number does not replace the authored bar, it sits under it in a
 * `Math.max`. For the difficulty setting and the autobalancer to keep working at
 * all, that max has to COMMUTE with them: `max(a, f) * k` is only the same thing
 * as `max(a * k, f * k)` when both terms scale the same way, and the authored
 * bar scales by the bar.
 *
 * Scaling the clock instead does not, because `adaptiveBossHp` integrates crowd
 * decay and is therefore sub-linear in seconds — 1.78x the clock buys well under
 * 1.78x the health. Both wrong versions were measured:
 *
 *   dials ignored      the floor became the binding number for every stage-6+
 *                      boss and silently switched the autobalancer off. A player
 *                      failing stage 10 three times had the bar go 91 751 ->
 *                      101 424 -> 109 223 instead of being given relief, and a
 *                      clear streak moved it 0.87x where it promises 1.78x.
 *   dials on the clock relief worked again, but the streak still only reached
 *                      1.39x of the 1.78x it advertises.
 *
 * So "three seconds" means three seconds at neutral dials — the same contract
 * stages 1-5 already have. Hard buys a longer climax; a player the balancer has
 * decided to help gets a shorter one, which is the whole point of the balancer
 * and is never the player melting bosses at stage 45.
 */
const meltFloorHp = (kind: BossKind, openingCd: number): number =>
  adaptiveBossHp(fightModel(openingCd), BOSS_MIN_FIRE_SECONDS * bossHpMulFor(kind))
    * difficultyFactor() * hpRelief

const adaptiveHp = (kind: BossKind, openingCd: number): number => {
  const seconds = clampAdaptiveSeconds(
    adaptiveBossSeconds(squadCount.value, perfectSquad) * difficultyFactor() * hpRelief
  )
  // ── The bar is priced on the SOFT swing, and the fight may throw a hard one ──
  //
  // `bossHitShare` returns what this boss will actually hit for, and that is
  // deliberately NOT what the bar is priced against. Feeding the punitive swing
  // into the model would have the model pay for it: a crowd charged double per
  // slam decays twice as fast, the integration sees it, and the bar comes down
  // to match — so `adaptiveBigHitMul` would cancel itself out exactly, which is
  // what it did on the first attempt (a run that never touched the screen still
  // cleared stage 3 on two seeds in three).
  //
  // So the two are decoupled on purpose, and the decoupling IS the floor:
  //
  //   the BAR is always priced for a player who takes the beginner's discount,
  //   so the "beatable in N seconds" promise is generous and never a trap;
  //   the SWING is the one this run earned, so a crowd that arrived with
  //   nothing burns down faster than the bar it was handed was priced for.
  //
  // Dodge and you finish inside the promise. Stand still with a crowd you never
  // built, and you run out of survivors first — which is the whole of "can't be
  // helped and should be smacked by the boss attacks".
  // `bossHpMulFor` survives the switch and has to: it corrects for health that
  // never appears on the bar (a healer's give-back, a summoner's bodies), and
  // that correction is about the KIND rather than about the curve the bar came
  // from. Without it the same target would buy four different fight lengths.
  return adaptiveBossHp(fightModel(openingCd), seconds * bossHpMulFor(kind))
}

/**
 * True while the boss standing in the arena was priced by the melt floor rather
 * than by the authored curve — i.e. this run is strong enough that the curve
 * had nothing left to offer it. Read by `detonateGrenade`; see
 * `BOSS_FLOOR_GRENADE_MULT`.
 */
let bossFloored = false

const spawnBoss = (): void => {
  // Two prices, and which one applies is the whole of `game/adaptive.ts`.
  //
  // Stages 1-5 are sized against the run that turned up: the firepower in the
  // arena times the seconds this player has earned the fight to last. Stage 1
  // used to be priced separately and far lower (a flat `tutorialBossHp`) so a
  // first-timer could not lose their first climax, and it no longer needs to
  // be — a first-timer arrives with a small crowd and is handed the bottom of
  // the ladder automatically, while the returning player who used to delete
  // that same boss in half a second now gets three seconds of real fight.
  //
  // From stage 6 the authored curve takes over — with a FLOOR under it, and
  // nothing else. The curve is still the bar for every run it was authored for;
  // the floor only bites when that bar would not survive three seconds of this
  // run's fire, which is a thing that only happens to a run that read the whole
  // road. Mid and low crowds never reach it and are untouched. See
  // `game/adaptive.ts` § "The melt floor".
  //
  // The KIND prices both of them. A healer gives 60 % of its bar back and a
  // summoner spends a quarter of it on bodies, so charging all four the same
  // printed number would make the same stage four different lengths. See
  // `bossHpMulFor`.
  const kind = bossKindFor(stage.value)
  const adaptive = adaptiveBossStage(stage.value)
  // The healer runs its own clock (`HEALER_CAST_CD`), and its first cycle has to
  // be the one it will actually throw: `charging` marks the every-third heal for
  // a healer exactly as it marks the charged swing for a meteor — decided when
  // the cycle BEGINS, so the telegraph and the effect can never disagree about
  // which cast is being wound up.
  const openCd = kind === 'healer' ? HEALER_CAST_CD : 2.6
  // Resolved BEFORE the bar, and read by it: the model has to know what the
  // fight is going to do to this crowd. See `bossSwingMul`.
  bossSwingMul = adaptive
    ? adaptiveBigHitMul(earlyBigHitMul(stage.value), squadCount.value, perfectSquad)
    : earlyBigHitMul(stage.value)
  const authored = Math.max(60, Math.round(
    BOSS_BASE_HP * bossHpScale(stage.value) * bossHpMulFor(kind)
      * difficultyFactor() * hpRelief
  ))
  // `bossFloored` is read by the grenade at detonation, so it has to be decided
  // here and it has to mean "the authored bar LOST to the floor" rather than
  // "this stage has a floor". A stage where the curve is already the bigger
  // number is an ordinary fight and the bomb stays the crowd's answer to it.
  const floor = adaptive || !meltFloorStage(stage.value) ? 0 : meltFloorHp(kind, openCd)
  bossFloored = floor > authored
  // Phase two belongs to the boss standing in the arena, so it is cleared where
  // that boss is made rather than only where a run is. A rally hands a wiped
  // crowd back mid-run without respawning the boss, and a retry re-enters
  // through `startStage` — one reset each side keeps both honest.
  bossEnraged = false
  bossCharging = false
  const hp = adaptive ? adaptiveHp(kind, openCd) : Math.max(authored, floor)
  boss = {
    kind,
    attacks: 0,
    summonCd: SUMMON_OPENING_CD,
    // The mercy trickle's clock, armed at its full grace. It only ever runs
    // once the wave budget is spent AND the crowd is a handful — see
    // `stepSummonerMercy`.
    mercyCd: SUMMON_MERCY_GRACE,
    mercySpawns: 0,
    // Zero, not `HEAL_MIN_GAP_S`: the gap is a floor BETWEEN heals, and opening
    // the fight on cooldown would delay the first one by ten seconds on top of
    // the three casts it already waits.
    healCd: 0,
    design: bossDesign(stage.value),
    x: 0,
    y: track.bossY,
    hp,
    maxHp: hp,
    speed: 0.85,
    flash: 0,
    phase: 0,
    scale: 2.5,
    slamCd: openCd,
    slamSpan: openCd,
    slams: 0,
    aimed: false,
    guarded: 0,
    guard: 0,
    slamX: 0,
    slamY: 0,
    charging: kind === 'healer' ? healCastDue(1, 0, HEALER_CAST_CD) : false,
    dead: false,
    dying: 0
  }
  bossHp01.value = 1

  // ── Furnish the arena ──
  //
  // Authored per stage (`arenaKit`), so a boss fight is not the same fight
  // fifteen times. Both props are spawned HERE rather than as track events: the
  // arena sits past `arenaY`, beyond the authored road, and they only make sense
  // once there is a boss to use them against.
  const kit = arenaKit(stage.value)

  // Barrels stand on the shoulders, clear of the boss's hold position and of the
  // lane the crowd runs up — the player has to choose to go and get them.
  const bossDiff = difficultyFactor()
  const bHp = Math.round(barrelHp(stage.value) * bossDiff)
  for (let i = 0; i < kit.barrels; i++) {
    // Alternating shoulders, walking outward: 1 -> right, 2 -> both, 3+ -> a
    // spread the crowd cannot cover from one position.
    const side = i % 2 === 0 ? 1 : -1
    const rank = Math.floor(i / 2)
    barrels.push({
      id: entityId++,
      x: side * (2.4 + rank * 1.5),
      y: track.bossY - 3.5 - rank * 2.2,
      hp: bHp,
      maxHp: bHp,
      fuse: -1,
      dead: false
    })
  }

  if (kit.escort) {
    const def = foeDef(kit.escort.typeId)
    const ehp = Math.max(
      8,
      Math.round(def.hp * foeHpScale(stage.value) * bossDiff * hpRelief)
    )
    for (let i = 0; i < kit.escort.count; i++) {
      const spread = (i - (kit.escort.count - 1) / 2) * 1.7
      const f = takeFoe()
      f.id = entityId++
      f.typeId = def.id
      f.design = def.designs[0] ?? 'grumpling'
      f.x = spread
      f.y = track.bossY - 6 - (i % 2) * 1.4
      f.hp = ehp
      f.maxHp = ehp
      f.speed = def.speed
      f.bite = def.bite
      f.biteShare = biteShareFor(def.id)
      f.scale = def.scale
      f.phase = Math.random()
      f.flying = def.flying
      f.swayPhase = Math.random() * 6.28
      foes.push(f)
    }
  }
}

/**
 * ─── Solid strips the formation may not aim into ────────────────────────────
 *
 * Rebuilt once a frame and read by every survivor, because the alternative is
 * four entity scans per unit and the squad cap is four thousand.
 *
 * This exists because of what contact does now. Killing whoever touches a solid
 * thing is the rule; DRAGGING somebody into one who never touched it is not,
 * and the formation does exactly that if left alone. Slots are re-packed the
 * moment anybody dies — that is what closes ranks — so the survivors of a stone
 * are re-slotted across the gap the dead ones left, walked into the same stone,
 * and killed by it in turn. Measured on one boulder rank: geometry says 60 of
 * an 85-strong crowd stand in the column and die, and the sim killed all 85.
 * The extra 25 are the bookkeeping, not the boulder.
 *
 * So a target is not allowed to land inside a solid — with one deliberate
 * exception that is the whole difference between this and the shove it
 * replaced: a survivor ALREADY inside the strip is left exactly where it is.
 * It is touching the stone, so it dies this frame, and it must not be quietly
 * routed around the thing that is killing it. Only survivors standing OUTSIDE
 * are held outside, on the side they are already on.
 *
 * The result is the shape a crowd hitting a rock actually makes: the column
 * that ran into it is deleted, and the two lobes either side of it stream past
 * and close up behind. Nobody slides along the rock face.
 */
interface Solid {
  x: number
  y: number
  /** Contact half-extents — the same `+ UNIT_R` the kill test uses. */
  halfW: number
  halfH: number
}

const solids: Solid[] = []

const collectSolids = (): void => {
  solids.length = 0
  // Only what the crowd could reach this frame. `stepUnits` runs before the
  // obstacle passes, so these are last frame's positions — a sub-centimetre
  // stale at 60 fps, and the kill test that follows uses the live ones.
  for (const b of barricades) {
    if (b.dead || Math.abs(b.y - anchorY) > 6) continue
    solids.push({ x: b.x, y: b.y, halfW: b.w / 2 + UNIT_R, halfH: BARRICADE_H / 2 + UNIT_R })
  }
  for (const r of rocks) {
    if (Math.abs(r.y - anchorY) > 6) continue
    solids.push({ x: r.x, y: r.y, halfW: r.w / 2 + UNIT_R, halfH: ROCK_H / 2 + UNIT_R })
  }
  // Armour plates. Solid to the formation like everything else here — the crowd
  // flows around them rather than through them — but harmless on contact, which
  // is the one rule they do not share with a wall. See `Guard`.
  for (const g of guards) {
    if (g.dead || Math.abs(g.y - anchorY) > 6) continue
    solids.push({ x: g.x, y: g.y, halfW: g.w / 2 + UNIT_R, halfH: GUARD_H / 2 + UNIT_R })
  }
  // The lever stones, on the same terms as the armour: the formation flows
  // around one, and a survivor who brushes it walks away. See `Stone`.
  for (const s of stones) {
    if (s.dead || Math.abs(s.y - anchorY) > 6) continue
    solids.push({ x: s.x, y: s.y, halfW: s.w / 2 + UNIT_R, halfH: STONE_H / 2 + UNIT_R })
  }
  for (const c of crates) {
    if (c.dead || Math.abs(c.y - anchorY) > 6) continue
    solids.push({ x: c.x, y: c.y, halfW: CRATE_R + UNIT_R, halfH: CRATE_R + UNIT_R })
  }
  // The two roadside prizes are crates as far as the formation is concerned:
  // solid until they break, and flowed around rather than walked through. See
  // `stepCages` for the contact rule they share with one.
  for (const c of cages) {
    if (c.dead || Math.abs(c.y - anchorY) > 6) continue
    solids.push({ x: c.x, y: c.y, halfW: CAGE_R + UNIT_R, halfH: CAGE_R + UNIT_R })
  }
  for (const w of bulwarks) {
    if (w.dead || Math.abs(w.y - anchorY) > 6) continue
    solids.push({ x: w.x, y: w.y, halfW: BULWARK_R + UNIT_R, halfH: BULWARK_R + UNIT_R })
  }
  // Barrels are solid too. Walking the crowd into one is how a player who wants
  // the blast gets it in the wrong place — the prop has to be shot, not nudged.
  for (const bl of barrels) {
    if (bl.dead || Math.abs(bl.y - anchorY) > 6) continue
    solids.push({ x: bl.x, y: bl.y, halfW: BARREL_R + UNIT_R, halfH: BARREL_R + UNIT_R })
  }
  for (const f of foes) {
    if (f.dead || Math.abs(f.y - anchorY) > 6) continue
    solids.push({
      x: f.x, y: f.y,
      halfW: f.scale * FOE_BODY_HALF_W + UNIT_R,
      halfH: f.scale * FOE_BODY_HALF_H + UNIT_R
    })
  }
  for (const d of dividers) {
    // A claimed bank's pillars are scenery: `stepDividers` stops billing them,
    // so routing around one would be a swerve for nothing.
    if (d.dismissed || Math.abs(d.y - anchorY) > 6) continue
    solids.push({ x: d.x, y: d.y, halfW: d.halfW + UNIT_R, halfH: DIVIDER_H / 2 + UNIT_R })
  }
}

/**
 * Keep a formation target out of any solid the survivor is not already inside.
 *
 * @param ux the survivor's CURRENT x — the side it is on decides which way out.
 */
const clearOfSolids = (tx: number, ty: number, ux: number): number => {
  for (const s of solids) {
    if (Math.abs(ty - s.y) > s.halfH) continue
    if (Math.abs(tx - s.x) >= s.halfW) continue
    const side = ux - s.x
    // Already touching it — this survivor is dying to it this frame. Leave the
    // target alone rather than teaching the corpse to dodge.
    if (Math.abs(side) < s.halfW) continue
    tx = s.x + Math.sign(side) * (s.halfW + 1e-3)
  }
  return tx
}

/**
 * Move every survivor toward its formation slot.
 *
 * Springs, not steering behaviours: the target is authoritative and the spring
 * only decides how the body gets there, so a crowd of a hundred and ninety can
 * never tangle, oscillate or drift out of the lane. The per-unit noise is what
 * stops it looking like a rigid lattice being dragged around.
 */
const stepUnits = (dt: number): void => {
  updateFunnel(dt)
  collectSolids()
  let reach2 = 0
  const n = squadCount.value
  const maxR = funnelR
  let slot = 0
  const t = clock / 1000

  for (let i = units.length - 1; i >= 0; i--) {
    const u = units[i]!
    if (u.flash > 0) u.flash = Math.max(0, u.flash - dt * 1000)
    if (u.inv > 0) u.inv = Math.max(0, u.inv - dt * 1000)

    if (u.dying > 0) {
      u.dying -= dt * 1000
      if (u.dying <= 0) {
        units.splice(i, 1)
        continue
      }
      // Tumble out of the crowd rather than blinking away — a survivor that
      // vanishes reads as a rendering bug, one that falls over reads as a loss.
      u.x += u.vx * dt
      u.y += u.vy * dt
      u.vy -= 5 * dt
      continue
    }
    // Alive units take slots in array order, so a death in the middle of the
    // crowd makes everyone behind it close ranks.
    u.i = slot
    const p = slotPos(slot, n, maxR)
    slot++

    // Idle jitter, unique per unit, so nobody stands perfectly still.
    const wob = Math.sin(t * 3.1 + u.i * 1.7) * 0.045
    let tx = anchorX + p.x + wob
    let ty = anchorY + p.y + Math.cos(t * 2.7 + u.i * 2.3) * 0.03

    // ── The crowd never walks off the road ──
    //
    // The formation is a disc around the anchor, and the anchor can sit close
    // enough to a rail that half the disc hangs over the edge — survivors
    // strolling through the barrier and out over the drop, which is the single
    // most immersion-breaking thing the crowd can do.
    //
    // Clamping alone would stack everybody in a hard vertical line ON the rail,
    // which looks just as wrong. So the overflow is REDISTRIBUTED along the
    // lane instead: whoever cannot fit sideways is pushed forward or back
    // (alternating, by index, so it is stable frame to frame) in proportion to
    // how far outside they were. The crowd squashes against the rail and
    // lengthens down the road — which is exactly what a real crowd funnelling
    // along a wall does.
    if (tx < -EDGE_X || tx > EDGE_X) {
      const over = Math.abs(tx) - EDGE_X
      tx = Math.sign(tx) * EDGE_X
      ty += (u.i % 2 === 0 ? 1 : -1) * Math.min(1.3, over * 0.9)
    }

    // AFTER the rail clamp, so a solid standing against a barrier cannot push a
    // target back over the edge, and BEFORE the spring, because the target is
    // the only thing this function is allowed to be authoritative about.
    tx = Math.max(-EDGE_X, Math.min(EDGE_X, clearOfSolids(tx, ty, u.x)))

    const k = 1 - Math.exp(-14 * dt)
    u.x += (tx - u.x) * k
    u.y += (ty - u.y) * k
    // Hard backstop for anything that moved a survivor outside the road behind
    // the formation's back — an obstacle shove, a gate spawn near the rail.
    if (u.x < -EDGE_X) u.x = -EDGE_X
    else if (u.x > EDGE_X) u.x = EDGE_X
    // Gait phase advances with actual speed, so a halted crowd stops running on
    // the spot during the boss fight.
    u.phase += dt * (phase.value === 'run' ? 1.7 : 0.55)

    // Free, because this loop is already here: the real bound every contact
    // pass this frame will test against.
    const rx = u.x - anchorX
    const ry = u.y - anchorY
    const d2 = rx * rx + ry * ry
    if (d2 > reach2) reach2 = d2
  }
  crowdReach = Math.sqrt(reach2)
}

/**
 * Where the squad's losses came from, this run.
 *
 * Kept because "why did they stop?" is unanswerable without it: a stage that
 * bleeds survivors to dividers is badly TAUGHT, one that bleeds them to foes is
 * badly TUNED, and one that bleeds them to traps is working exactly as intended.
 * The balance harness reads it, and it is the shape the analytics events in the
 * retention roadmap will carry.
 */
export type DeathCause = 'foe' | 'elite' | 'barricade' | 'crate' | 'divider' | 'trap' | 'slam'

const emptyDeaths = (): Record<DeathCause, number> =>
  ({ foe: 0, elite: 0, barricade: 0, crate: 0, divider: 0, trap: 0, slam: 0 })

let deaths = emptyDeaths()

export const deathBreakdown = (): Record<DeathCause, number> => ({ ...deaths })

/**
 * ─── Solid-body contact ─────────────────────────────────────────────────────
 *
 * Everything that is not a gate is SOLID, and solid means exactly one thing:
 * **whoever touches it dies, and everybody else runs on.** No quota, no rate,
 * no grace period — the survivors on the line that hit the stone are gone, the
 * rest of the swarm flows past on both sides of it.
 *
 * This replaced a rate-plus-shove model, and the reason is what a player saw:
 * the shove meant a crowd driven into a boulder WRAPPED AROUND it and kept
 * going, bodies sliding along the rock and closing up behind it while a trickle
 * of them died to a per-second budget. Two survivors' worth of consequence for
 * an obstacle the whole game calls lethal. "Solid" has to mean solid the first
 * time it is touched, or the road stops teaching anything.
 *
 * Three things follow from the change, and all three are improvements:
 *
 *   • THE COST IS THE LINE YOU RAN, not the seconds you spent. Clip the edge of
 *     a block with a handful of bodies and lose that handful; drive the middle
 *     of the crowd through it and lose the whole column. The old rate charged
 *     nearly the full percentage for a graze, which is precisely backwards.
 *   • THE COST SCALES BY ITSELF. A percentage had to be hand-tuned per obstacle
 *     so it stayed meaningful from a four-strong squad to a four-thousand-strong
 *     one; a column through the crowd is inherently proportional to the crowd,
 *     because it is measured in the crowd's own bodies.
 *   • NOTHING IS CARRIED BETWEEN FRAMES. The old budget banked fractional kills
 *     per obstacle id, which took two bug-fixes to stop it punishing a player
 *     who corrected late four times harder than one who never corrected at all.
 *     A rule with no accumulator cannot have that class of bug.
 *
 * The thing this gives up is the old model's cushion for a stuck player:
 * `contactRelief` scaled the rate, and there is no rate left to scale. Relief
 * now reaches obstacle deaths only through the retry discounts that make the
 * obstacles themselves weaker (`hpRelief`) and the squad bigger.
 *
 * Elites are the one solid thing that does NOT kill on contact — they own their
 * damage through the bite loop, and displace instead (`partAround`).
 */
interface Crush {
  x: number
  halfW: number
  y: number
  halfH: number
  cause: DeathCause
}

/**
 * The furthest any living survivor actually stands from the anchor, measured
 * once a frame in `stepUnits`.
 *
 * `crowdRadius()` is the formation's NOMINAL radius, and real bodies routinely
 * sit outside it: the rail redistribution moves a target up to 1.3 down the
 * lane, an obstacle shove moves one sideways, and the spring lags whenever the
 * funnel narrows. Using the nominal number in `nearCrowd` therefore made every
 * contact pass blind to exactly the survivors most likely to be in trouble —
 * measured, a survivor stood INSIDE a monster for 18 consecutive frames (a
 * third of a second, plainly visible) because both it and the foe sat outside a
 * disc drawn around the crowd's average.
 */
let crowdReach = 0

/**
 * Is anything of the crowd near enough to `(x, y)` to be worth a full scan?
 *
 * The hot loops in here — obstacle contact, monster bodies, foe bites — are
 * O(units) and the squad cap is 4 000. Almost all of them are looking at
 * something the crowd is nowhere near, so one cheap test against the crowd's
 * bounding disc turns "scan four thousand bodies" into two subtractions and a
 * compare. It is the difference between the cap being a design choice and a
 * frame cost.
 */
const nearCrowd = (x: number, y: number, pad: number): boolean => {
  const r = Math.max(crowdRadius(), crowdReach) + pad
  const dx = x - anchorX
  const dy = y - anchorY
  return dx * dx + dy * dy <= r * r
}

/**
 * ─── …and the two solids that grind instead of killing ──────────────────────
 *
 * A gate pillar and an unbroken crate keep the older model: contact costs
 * `squad × fraction` survivors per second and shoves the rest clear. They are
 * deliberately the exception, because neither is a thing the player was told to
 * go around:
 *
 *   • a PILLAR is a blade standing between two doors the player is aiming at.
 *     The safe band beside it is half a unit wide, so a lethal pillar makes the
 *     whole game a precision test — measured, it deletes a zero-input run at
 *     67 % of stage 1, on the first bank, which is the documented onboarding
 *     floor ("a player who never touches the screen still reaches the boss").
 *   • a CRATE is a REWARD the player was invited to chase. Punishing the
 *     attempt as hard as a wall teaches them to stop chasing rewards.
 *
 * `crushDebt` carries the fractional part of a kill between frames so a 60 fps
 * device and a 30 fps one cost the player the same. Two rules keep it honest,
 * and both were bugs first: budget accrues only while something is ACTUALLY
 * touching (it used to bank ~2 s of kills on approach and spend the lot on the
 * first frame of contact), and the carry is capped at one kill.
 */
/**
 * How far out along an obstacle counts as its EDGE rather than its face.
 *
 * Measured as a fraction of the half-width the contact test actually uses, so it
 * means the same thing on every shape in the game — and that is the whole reason
 * it is expressed this way. The first two attempts were absolute:
 *
 *   "the shallower overlap axis is X" — correct for a crate or a boulder, and
 *     catastrophic for a gate pillar, which is narrow and deep, so EVERY contact
 *     with one resolved as sideways and the pillar stopped costing anything.
 *   "within one survivor's width of the edge" — same failure, for the same
 *     reason: a pillar is barely wider than that, so all of it was edge.
 *
 * A pillar is the one obstacle the game explicitly tells the player to avoid,
 * and a bank is only a commitment because running the middle costs. Asking how
 * far along the obstacle the survivor is keeps that: dead centre is the face, the
 * outer quarter is the edge, whatever the thing's absolute size.
 */
const GLANCE_EDGE = 0.72

const crushDebt = new Map<number, number>()

/** @returns true when at least one survivor died on this grinder this frame. */
const grindAgainst = (
  id: number, c: Crush, fraction: number, dt: number, floor = 1, bite = 1
): boolean => {
  if (!nearCrowd(c.x, c.y, Math.max(c.halfW, c.halfH) + UNIT_R + 0.2)) {
    // Forget the DEBT, remember the ENCOUNTER.
    //
    // This used to delete the entry, which meant the next frame the crowd
    // touched the same object it counted as a brand-new contact and paid the
    // opening `bite` all over again. A crowd does not approach a gate pillar
    // once — it is a wide, soft thing that brushes, separates and brushes again
    // as the player drifts — so a single pillar was charging its entry fee three
    // or four times, and the whole of a careless run's losses turned out to be
    // that, not the grind. Keeping a zero says "this one has already been paid
    // for". Cleared wholesale in `resetWorld`.
    if (crushDebt.has(id)) crushDebt.set(id, 0)
    return false
  }
  let budget = -1
  let killed = false

  for (const u of units) {
    if (u.dying > 0) continue
    const dx = u.x - c.x
    const dy = u.y - c.y
    const overlapX = c.halfW + UNIT_R - Math.abs(dx)
    const overlapY = c.halfH + UNIT_R - Math.abs(dy)
    if (overlapX <= 0 || overlapY <= 0) continue

    // ── A CLIP IS NOT A CRASH ──
    //
    // Which axis is shallower says how the survivor got here, and the two are
    // completely different mistakes.
    //
    //   overlapY smaller → they are deep inside the thing's WIDTH and only just
    //     inside its depth: they drove into its face. That is running into a
    //     wall, and it costs.
    //   overlapX smaller → they are level with it and only just inside its
    //     edge: they swept sideways into it. That is clipping a corner while
    //     steering, and it should cost NOTHING.
    //
    // Both used to bill identically, which made a side sweep across a crate or
    // a barricade delete a whole squad — a run ended by a thumb travelling a
    // few pixels too far, with no way to read that it was about to happen. The
    // survivor slides around the edge and carries on instead, which is what the
    // shove below already did for everyone the kill budget could not reach.
    //
    // It cannot be exploited into free passage: going AROUND an obstacle is the
    // legitimate answer to one, and anybody trying to go THROUGH is resolving on
    // the other axis and paying for it.
    // WHERE ALONG the obstacle they are, which is the same thing as asking how
    // they got here. Out at the edge is a survivor who swept sideways into it
    // while steering; near the middle is one who drove at its face.
    //
    // Both used to bill identically, which made a side sweep across a crate or a
    // barricade delete a whole squad — a run ended by a thumb travelling a few
    // pixels too far, with no way to read that it was about to happen. The
    // survivor slides around and carries on instead, which is what the shove
    // below already did for everyone the kill budget could not reach.
    //
    // It cannot be exploited into free passage: going AROUND an obstacle is the
    // legitimate answer to one, and anybody aiming THROUGH it is by definition
    // near its middle and paying for it.
    if (Math.abs(dx) > (c.halfW + UNIT_R) * GLANCE_EDGE) {
      const slide = Math.sign(dx) || 1
      u.x = Math.max(-EDGE_X, Math.min(EDGE_X, u.x + slide * overlapX))
      continue
    }

    // A new contact opens at `bite` kills — touching something solid costs a
    // survivor outright — and a continuing one accrues at the crowd-proportional
    // rate, so ploughing through costs many.
    //
    // `bite` and `floor` are separate parameters because they are separate
    // rules: the bite is what a touch costs, the floor is what SITTING on the
    // thing costs per second. They used to be the same literal 1, which meant an
    // obstacle could not be made forgiving without also making it free — lower
    // the rate and the floor still bills a body a second. The opening stages'
    // gate pillars keep the full bite and ramp the floor (`dividerCrushFor`);
    // every other caller takes the defaults and behaves exactly as before.
    if (budget < 0) {
      const carried = crushDebt.get(id)
      budget = (carried === undefined ? bite : carried)
        + Math.max(floor, squadCount.value * fraction * contactRelief) * dt
    }
    if (budget >= 1) {
      budget -= 1
      killUnit(u, Math.sign(dx) || 1, c.cause)
      killed = true
      continue
    }
    // Out of kills this frame: shove the survivor clear. Pushing the UNIT and
    // never the anchor keeps the player's steering authoritative, and the shove
    // is clamped to the road so a pillar near a rail squeezes the crowd along
    // the barrier rather than pushing survivors over it.
    //
    // This is the HEAD-ON overflow — a glancing contact never reaches here, it
    // returned above.
    const dir = Math.sign(dx) || 1
    u.x = Math.max(-EDGE_X, Math.min(EDGE_X, u.x + dir * overlapX))
  }

  if (budget >= 0) crushDebt.set(id, Math.min(budget, 1))
  return killed
}

/** @returns true when at least one survivor died on this obstacle this frame. */
const crushAgainst = (c: Crush): boolean => {
  // Nothing of the crowd is in reach — do not touch the unit array at all.
  if (!nearCrowd(c.x, c.y, Math.max(c.halfW, c.halfH) + UNIT_R + 0.2)) return false

  // ── The one contact rule the bulwark answers ──
  //
  // A wall takes EVERYONE it touches with no budget at all, so a column driven
  // into one is the largest single-stroke loss on the road outside a boss
  // arena — and it is a blow by any reading: one impact, one instant, one
  // decision that caused it. Measured against the same shape the kill loop
  // below uses, so the number offered to the pickup is exactly the number the
  // wall was about to take and never an estimate.
  //
  // Its sibling `grindAgainst` is deliberately NOT wired up: that one is a
  // per-second rate and the case the pickup was specified against. See
  // `bulwarkAbsorb`.
  if (absorbedBlow(
    Number.POSITIVE_INFINITY, c.x, c.y,
    (u) => Math.abs(u.x - c.x) <= c.halfW + UNIT_R && Math.abs(u.y - c.y) <= c.halfH + UNIT_R
  )) return false

  let killed = false
  for (const u of units) {
    if (u.dying > 0) continue
    const dx = u.x - c.x
    if (Math.abs(dx) > c.halfW + UNIT_R) continue
    if (Math.abs(u.y - c.y) > c.halfH + UNIT_R) continue

    // Touched it. That is the whole rule — the body is flung away from the side
    // it hit so the loss reads as an impact rather than a disappearance.
    killUnit(u, Math.sign(dx) || 1, c.cause)
    killed = true
  }
  return killed
}

/**
 * ─── A monster's body: half of what hits it dies, the rest bounce off ───────
 *
 * The third contact rule in the game, and it sits deliberately between the
 * other two:
 *
 *   • a WALL takes everyone who touches it (`crushAgainst`) — it stands still,
 *     so the whole cost is the line the player chose;
 *   • a PILLAR grinds at a per-second rate (`grindAgainst`) — the player is
 *     aiming at the doors either side of it;
 *   • a MONSTER takes HALF of what touches it, and the survivors of that get
 *     ten frames where nothing else can hit them.
 *
 * A monster homes on the crowd, so unlike a wall it cannot be steered away
 * from — all-or-nothing contact would be an undodgeable half of the squad, and
 * the balance suite says so out loud (benchmark player dead at 10 % of stage 5,
 * eight invariants broken). Halving keeps the collision a real, visible cost
 * that a run absorbs rather than a verdict it cannot argue with.
 *
 * The i-frames are what make it a COLLISION rather than a rate. Without them a
 * survivor inside a monster is offered to the halving on every one of the sixty
 * frames a second and lasts about three of them; with them, one contact costs
 * one halving and the crowd is untouchable long enough to be pushed clear and
 * steered off. Crucially they are per-SURVIVOR and not per-monster, so walking
 * a crowd through a pack of six costs six collisions rather than the product of
 * them: two monsters standing shoulder to shoulder cannot bill the same body
 * twice in the same instant.
 *
 * The BITE is untouched and does not respect the immunity, because it is not a
 * collision — it is the monster's attack, metered by `biteCd` and capped at
 * `want` survivors, and it reaches further than the body does. The mouth takes
 * what comes near; the body takes half of what runs into it.
 *
 * Three invariants shared with the obstacle push:
 *
 *   • the UNIT moves and the anchor never does, so the player's steering stays
 *     authoritative — a monster shoves the crowd, it does not shove the thumb;
 *   • the shove is clamped to the road, so a body near a rail squeezes the
 *     crowd along the barrier rather than pushing survivors over it;
 *   • a survivor dead-centre breaks its tie on index parity, so a body sitting
 *     on the crowd's centre line parts it into two lobes instead of sweeping
 *     everybody one way.
 */
const collideFoe = (f: Foe, dt: number): void => {
  if (f.hitCd > 0) f.hitCd = Math.max(0, f.hitCd - dt)
  const halfW = f.scale * FOE_BODY_HALF_W
  const halfH = f.scale * FOE_BODY_HALF_H
  // Same bounding-disc guard as every other O(units) pass — a monster that is
  // still walking in never touches the unit array.
  if (!nearCrowd(f.x, f.y, Math.max(halfW, halfH) + UNIT_R + 0.2)) return

  // ── A body-check, measured before it is thrown ──
  //
  // The halving below takes every `FOE_COLLIDE_KILL_EVERY`-th body that goes
  // squarely into the core, which is `ceil(struck / every)` — countable exactly,
  // because the rule is positional and not random.
  //
  // It almost never clears the threshold, and that is the correct outcome
  // rather than dead code: a monster's footprint bounds how much of a crowd can
  // be inside it at once, so on any squad worth protecting this is a fraction of
  // a percent. It is wired up anyway because the alternative is a pickup that
  // answers "a hit that would kill more than 5 % of your squad" for six sources
  // and not the seventh, and a player cannot see which is which.
  //
  // Nothing needs to be skipped when it is eaten: `bulwarkAbsorb` hands every
  // survivor the same collision grace a shielded body gets, and the strike test
  // below already refuses immune bodies — so the loop runs, shoves the crowd
  // clear exactly as it would have, and bills nobody.
  //
  // Counted here rather than through `absorbedBlow` because the answer is not
  // the size of the victim SET: only every other body in it dies.
  //
  // The cost is one extra pass of a loop this function already runs — so it
  // doubles an O(units) pass, for the few seconds per stage a pickup is armed,
  // and only for foes that already cleared the bounding-disc guard above. It is
  // not a new order of work; `bulwarkArmed` is what keeps it off every other
  // frame in the game.
  if (bulwarkArmed && f.hitCd <= 0) {
    let touched = 0
    for (const u of units) {
      if (u.dying > 0 || u.inv > 0) continue
      if (Math.abs(u.x - f.x) > halfW * FOE_COLLIDE_CORE + UNIT_R) continue
      if (Math.abs(u.y - f.y) > halfH + UNIT_R) continue
      touched++
    }
    bulwarkAbsorb(Math.ceil(touched / FOE_COLLIDE_KILL_EVERY), f.x, f.y)
  }

  const cause: DeathCause = f.elite ? 'elite' : 'foe'
  let hit = 0
  let struck = false

  for (const u of units) {
    // The dying tumble out of the crowd on their own arc; shoving a corpse
    // sideways mid-fall reads as a body being kicked.
    if (u.dying > 0) continue
    const dx = u.x - f.x
    const overlapX = halfW + UNIT_R - Math.abs(dx)
    if (overlapX <= 0) continue
    if (Math.abs(u.y - f.y) > halfH + UNIT_R) continue

    // Immune survivors are still SOLID against the body — they are pushed clear
    // like everyone else, they simply cannot be billed for it a second time.
    // Squarely into it, not a clipped flank — see `FOE_COLLIDE_CORE`.
    if (f.hitCd <= 0 && u.inv <= 0 && Math.abs(dx) <= halfW * FOE_COLLIDE_CORE + UNIT_R) {
      struck = true
      // Counted across the whole contact, so "every other one" means every
      // other BODY that touched rather than every other body in the array.
      if (hit % FOE_COLLIDE_KILL_EVERY === 0) {
        hit++
        killUnit(u, Math.sign(dx) || 1, cause)
        continue
      }
      hit++
      u.inv = FOE_COLLIDE_IFRAMES_MS
    }

    const dir = Math.sign(dx) || (u.i % 2 === 0 ? 1 : -1)
    u.x = Math.max(-EDGE_X, Math.min(EDGE_X, u.x + dir * overlapX))
  }

  // One knock-down per monster, then a beat — see `FOE_COLLIDE_CD`.
  if (struck) f.hitCd = FOE_COLLIDE_CD
}

/** Kill a survivor: mark it dying, fling it, and tell the world. */
/**
 * How many losses the shield has eaten. Counted rather than rolled: "half the
 * damage" as a coin flip is the same expected value and a much worse feeling —
 * a player who loses four in a row while a shield is up concludes it does
 * nothing. Every second death is stopped, exactly, for as long as it holds.
 */
let shieldEaten = 0
/** Wall-clock ms until the shield expires. */
let shieldUntilMs = 0

/**
 * ─── The bulwark: one absorb, waiting ───────────────────────────────────────
 *
 * A boolean, and the fact that it is a boolean is the design. The skill above
 * is a CLOCK — it is state that decays and has to be watched — and this is a
 * LATCH: taken, held for as long as it takes, spent once. See `Bulwark`.
 */
let bulwarkArmed = false

/** Is the pickup's absorb waiting? Read by the HUD, the renderer's dome and the
 *  specs; nothing else may write `bulwarkArmed`. */
export const bulwarkReady = (): boolean => bulwarkArmed

/**
 * Would a blow of `n` bodies be big enough to spend the bulwark on?
 *
 * Pure, and exported for the specs, because this predicate IS the feature: the
 * pickup is otherwise indistinguishable from the timed shield, and a threshold
 * that is right in five call sites and wrong in the sixth is a pickup that
 * behaves differently depending on what is killing you.
 *
 * `squad` is passed rather than read so a test can pin the arithmetic without
 * standing up a run, and so the answer is always taken against the crowd as it
 * was BEFORE the blow — asking after the first body has fallen would measure a
 * different squad and could flip the answer mid-blow.
 */
export const isBigBlow = (n: number, squad: number): boolean =>
  n >= BULWARK_FLOOR && n > squad * BULWARK_SHARE

/**
 * Ask the bulwark to eat a blow of `n` bodies, and spend it if it does.
 *
 * ── The contract every call site relies on ──
 *
 * `n` is the number of survivors the blow is ABOUT TO take, counted before any
 * of them is billed, and a `true` answer means the caller must take NOBODY —
 * not fewer, not the overflow, nobody. That is what makes the absorb atomic and
 * it is why this cannot live inside `killUnit`: by the time a body reaches the
 * loss funnel the blow has already been decomposed into one death at a time,
 * and a shield hooked there can only ever refund losses that already happened
 * (which is what the timed skill does, deliberately, one in two).
 *
 * ── What deliberately never reaches here ──
 *
 *   • `grindAgainst` — an obstacle scrape. It is a RATE, not a blow: it bills
 *     `max(floor, squad × fraction) × dt` per frame, so its "blow" is one body,
 *     or two on a very large crowd, and it recurs for as long as contact lasts.
 *     Handing a rate to a one-shot absorb would spend the pickup on the first
 *     frame of a contact and then let the other fifty frames through — the
 *     player would see the shield flash and their squad grind away anyway.
 *     This is also the case the pickup was specified AGAINST ("not if 1 unit is
 *     lost running against an obstacle"), and it is excluded twice over: by
 *     `BULWARK_FLOOR`, and by never being asked.
 *   • A hostile GATE (`÷N`, `-N`). It takes a share of the crowd and it is
 *     unquestionably big, but it is not a blow — it is a door the player aimed
 *     at and drove through. An absorb that ate the trap the player chose would
 *     make the bank's whole decision optional, which is the one mechanic this
 *     game cannot make optional.
 *
 * Everything else that takes survivors in a stroke is routed through here; the
 * one source that could not be pre-counted honestly is the gunner's round, and
 * what it does instead is written down at its own call site in `stepBolts`.
 */
const bulwarkAbsorb = (n: number, x: number, y: number): boolean => {
  if (!bulwarkArmed) return false
  if (!isBigBlow(n, squadCount.value)) return false
  bulwarkArmed = false
  // The whole pickup is being spent on this one moment, so the event carries
  // what it cost: the renderer sizes the burst on `count`, because "it ate a
  // slam" and "it ate a graze" must not look the same when only one of them was
  // worth a pickup.
  pushFx({ kind: 'bulwarkSave', x, y, count: n })
  // Every survivor gets the same collision grace a shielded body gets. It is
  // narrow on purpose — `u.inv` is read by ONE rule, a monster's body
  // (`collideFoe`), and by nothing else — so this is not a tenth of a second of
  // invulnerability, it is the guarantee that a crowd standing inside a body
  // when a blow is absorbed is not billed for that body on the very next frame.
  // Bites, slams and walls all go on working immediately, which is what keeps
  // an absorb one blow rather than a free moment.
  for (const u of units) u.inv = Math.max(u.inv, FOE_COLLIDE_IFRAMES_MS)
  return true
}

/**
 * Measure a blow and offer it to the bulwark, in one call.
 *
 * `budget` is what the attack INTENDS to take and `hits` is its shape, so the
 * answer is `min(intent, reality)` — the same arithmetic every big attack in
 * this file already performs when it walks its victims with a decrementing
 * budget. Attacks with no budget (a wall, a rib, a rake's core) pass
 * `Number.POSITIVE_INFINITY` and are measured purely by their shape.
 *
 * ── Why every call site is a closure and that is fine ──
 *
 * The first line is the whole performance story: with no pickup armed this
 * returns on a boolean and the closure is never called, so the hot paths that
 * carry it (a monster's body, a wall, a bite) are unchanged for the ninety-odd
 * percent of a run in which nothing is armed. When one IS armed, the extra pass
 * is O(units) with an early break at `budget` — the same order as the kill loop
 * that follows it, once.
 *
 * @returns true when the bulwark ate it and the caller must take NOBODY.
 */
const absorbedBlow = (
  budget: number, x: number, y: number, hits: (u: Unit) => boolean
): boolean => {
  if (!bulwarkArmed) return false
  let n = 0
  for (const u of units) {
    if (n >= budget) break
    if (u.dying > 0) continue
    if (hits(u)) n++
  }
  return bulwarkAbsorb(n, x, y)
}

/** Is the shield holding right now? Read by the HUD and the loss funnel. */
/**
 * Is something big about to land on the crowd?
 *
 * True from the moment an attack has picked its ground until it lands: the boss
 * once it has aimed, and any elite inside its own wind-up. Drives the corner
 * warning badge, and lives HERE rather than in the scene because it is a
 * question about the world, and because a predicate the HUD owns privately is a
 * predicate nothing can test.
 *
 * Deliberately covers both attackers. Their in-world tells differ — a falling
 * rock, a winding blade — but "am I about to be hit" is one question, and
 * answering it in two different places would defeat the point of having one
 * fixed place to look.
 */
export const attackIncoming = (): boolean => {
  const t = incomingThreat()
  // A HEAL is the one wind-up the badge stays down for, and the reason is the
  // word printed under it. The badge says DODGE; a heal cannot be dodged, it can
  // only be out-damaged. A warning that instructs the player to do something
  // impossible is worse than no warning, because it is the same badge they are
  // supposed to trust on the swing that follows.
  //
  // A SUMMON WAVE never reaches this at all: `incomingThreat` returns nothing
  // for a summoner, because three skeletons walking down the road are already
  // the most legible warning in the game and a corner badge would only compete
  // with them.
  return t !== null && t.kind !== 'heal'
}

/**
 * ─── …and what it is, for a badge that wants to say more than DODGE ─────────
 *
 * `attackIncoming` answers the yes/no the current badge is wired to. This is the
 * whole answer, and it exists because the badge's single word is a half-truth
 * the moment the pools open: a healer's third cast raises a wind-up nobody can
 * step out of, and an elite's sweep spans the whole road.
 *
 * ── What a component needs to vary the label ──
 *
 * `IncomingWarning.vue` today takes `show: boolean` and prints `t('hud.dodge')`.
 * To carry the healer it needs one more prop — the `kind`, or just `dodgeable` —
 * and one more i18n key beside `hud.dodge` chosen from it. Nothing else changes:
 * the badge's position, animation and `hud.incoming` aria-label are correct for
 * every kind. The wiring is deliberately not done here; the state is exported so
 * it can be.
 *
 * `ttl` is seconds until the thing lands, so a badge that wanted a countdown
 * could have one — though the ring on the ground already says how long, and two
 * clocks disagreeing is worse than one.
 */
export type IncomingKind =
  | 'slam' | 'rake' | 'bolt' | 'heal' | 'charge'
  | 'sweep' | 'bomb' | 'shot' | 'roll'

export interface Incoming {
  kind: IncomingKind
  /**
   * Can the player actually step out of this one?
   *
   * The elite's sweep is `false` and has always been: it spans the whole road,
   * and the answer to it is damage, not position. That is a pre-existing
   * half-truth in the badge's wording rather than one the pools introduced —
   * recorded here so a component that varies its label fixes both at once.
   */
  dodgeable: boolean
  /** Seconds until it lands. */
  ttl: number
}

export const incomingThreat = (): Incoming | null => {
  const b = boss
  if (b && !b.dead && b.aimed && b.slamCd > 0) {
    // Asked before the kind, because a charge is the same attack whichever
    // fight it is bolted onto — and because "get out of the lane" is a
    // different instruction from "get off that spot", which is the whole reason
    // a badge would want to know the kind at all.
    if (bossCharging) return { kind: 'charge', dodgeable: true, ttl: b.slamCd }
    if (b.kind === 'healer') {
      return { kind: b.charging ? 'heal' : 'bolt', dodgeable: !b.charging, ttl: b.slamCd }
    }
    return { kind: b.kind === 'claw' ? 'rake' : 'slam', dodgeable: true, ttl: b.slamCd }
  }

  // The elite pool. Ordered by how close the thing is to landing rather than by
  // kind, so a road carrying two elites reports the one about to hurt.
  for (const f of foes) {
    if (!f.elite || f.dead) continue
    switch (f.kind) {
      case 'bomber':
        // Armed. The fuse IS the wind-up — there is nothing else it can be doing
        // while `fuse` runs.
        if (f.fuse > 0) return { kind: 'bomb', dodgeable: true, ttl: f.fuse }
        break
      case 'gunner':
        // `kindTicks` is the aim latch, `reload` the countdown to the shot.
        if (f.kindTicks > 0) return { kind: 'shot', dodgeable: true, ttl: Math.max(0, f.reload) }
        break
      case 'roller': {
        // The ball has no wind-up because it does not need one — the roll IS the
        // wind-up, and it is a second and a half long. The badge goes up as the
        // ball comes over the top edge of the screen rather than at some later
        // moment, because the badge's whole job is to move the player's eye to
        // the road BEFORE there is something to see there.
        const gap = f.y - anchorY
        if (gap > -ROLLER_R && gap <= ROLLER_WARN_AHEAD) {
          return {
            kind: 'roll',
            dodgeable: true,
            ttl: Math.max(0, gap) / (ROLLER_SPEED + stageSpeed(stage.value))
          }
        }
        break
      }
      default:
        if (f.sweepCd > 0 && f.sweepCd <= ELITE_TELEGRAPH) {
          return { kind: 'sweep', dodgeable: false, ttl: f.sweepCd }
        }
    }
  }

  // A round already in the air is the most incoming thing on the road, and it
  // outlives the gunner that fired it.
  const inAir = bolts.find((x) => !x.dead && x.y > anchorY - CROWD_MAX_R)
  return inAir ? { kind: 'shot', dodgeable: true, ttl: 0 } : null
}

export const shieldActive = (): boolean => shieldUntilMs > Date.now()
/** Ms of protection left, for the ring on the button. */
export const shieldLeftMs = (): number => Math.max(0, shieldUntilMs - Date.now())

/** Raise the shield for `seconds`. */
export const raiseShield = (seconds: number): void => {
  if (seconds <= 0) return
  shieldUntilMs = Date.now() + seconds * 1000
  shieldEaten = 0
  pushFx({ kind: 'shieldUp', x: anchorX, y: anchorY })
}

const killUnit = (u: Unit, dirX = 0, cause: DeathCause = 'foe'): void => {
  if (u.dying > 0) return

  // The shield takes every second body that would have been lost, whatever took
  // it — a bite, a slam, a pillar, a trap. Hooked HERE because this is the one
  // funnel all of them pass through, so the skill cannot be right about some
  // causes and wrong about others.
  //
  // The BULWARK pickup is deliberately not hooked here, and the two coexist by
  // being asked at different levels rather than by a priority rule: the bulwark
  // answers a BLOW, before it lands (`bulwarkAbsorb`), and the skill answers a
  // BODY, as it falls. Anything the bulwark ate never arrives in this function
  // at all, so a big blow while both are up costs the pickup and not one second
  // of the skill; anything under the bulwark's threshold arrives here exactly as
  // it did before the pickup existed.
  if (shieldActive()) {
    shieldEaten++
    if (shieldEaten % 2 === 1) {
      u.inv = Math.max(u.inv, FOE_COLLIDE_IFRAMES_MS)
      pushFx({ kind: 'shieldSave', x: u.x, y: u.y })
      return
    }
  }
  u.dying = 420
  u.vx = dirX * 2.4 + (Math.random() - 0.5) * 1.6
  u.vy = 1.8 + Math.random() * 1.4
  squadCount.value = Math.max(0, squadCount.value - 1)
  deaths[cause]++
  pushFx({ kind: 'unitLost', x: u.x, y: u.y, outfit: u.i })
}

/** Test seam: bill a survivor through the real loss funnel, so a spec can
 *  measure what the shield actually stops. */
export const __killUnitForTest = (u: Unit): void => killUnit(u, 0, 'foe')

/**
 * ─── The grenade ────────────────────────────────────────────────────────────
 *
 * The player's one offensive button, on a thirty-second clock.
 *
 * WHERE IT LANDS is chosen rather than aimed, because the game has exactly one
 * input and adding a second (aim, then throw) would undo the thing that makes
 * it playable one-handed. The rule reads the way a player would: the boss if
 * there is one, otherwise the elite holding the road, otherwise the middle of
 * the biggest knot of bodies ahead. That covers all three cases the skill is
 * for without ever asking the player to place it.
 *
 * WHAT IT DOES is `mult` seconds of the whole crowd's fire, delivered at once —
 * so it scales with the run rather than going stale, and reads as "three
 * seconds of everything, now". Against a boss it is a real chunk; against a
 * horde it clears the front ranks; against nothing it is wasted, which is what
 * makes the timing a decision.
 */
export const GRENADE_BLAST_R = 4.6

/** Where the grenade should go, or `null` when there is nothing worth hitting. */
const grenadeTarget = (): { x: number; y: number } | null => {
  if (boss && !boss.dead && boss.y - anchorY < 30) return { x: boss.x, y: boss.y }

  const live = foes.filter((f) => !f.dead && f.y > anchorY - 2 && f.y < anchorY + 26)
  if (live.length === 0) return null

  const elite = live.find((f) => f.elite)
  if (elite) return { x: elite.x, y: elite.y }

  // The densest knot: score each body by how many others sit inside a blast of
  // it, so the throw lands where it is worth the most rather than on whoever
  // happens to be nearest.
  let best = live[0]!
  let bestScore = -1
  for (const f of live) {
    let score = 0
    for (const g of live) {
      if (Math.hypot(g.x - f.x, g.y - f.y) <= GRENADE_BLAST_R) score++
    }
    if (score > bestScore) { bestScore = score; best = f }
  }
  return { x: best.x, y: best.y }
}

/**
 * A grenade in the air.
 *
 * It exists as an OBJECT with a flight time rather than as an instant effect,
 * and that is the whole difference between a skill the player can read and a
 * number that silently changes. The first version applied its damage on the
 * frame the button was pressed and drew particles at the target: things died,
 * and nothing had visibly happened. A thrown object arcs, lands, and explodes —
 * three beats the eye can follow, in the place it is looking.
 */
export interface Grenade {
  x: number
  y: number
  /** Where it was thrown from, so the arc can be interpolated. */
  fromX: number
  fromY: number
  tx: number
  ty: number
  /** 0..1 along the flight. */
  t: number
  power: number
  /** The crowd's DPS and the skill's multiplier at the moment it was thrown,
   *  kept apart so the boss can be charged a capped multiplier without
   *  re-deriving either. See `BOSS_FLOOR_GRENADE_MULT`. */
  dps: number
  mult: number
}

let grenades: Grenade[] = []
export const getGrenades = (): Grenade[] => grenades

/** Flight time. Long enough to read as a throw, short enough not to feel laggy. */
const GRENADE_FLIGHT_MS = 420

/**
 * Throw it. Returns false when there was nothing worth hitting, so the caller
 * can decline to spend the cooldown — a skill that eats its own clock on an
 * empty road is a skill players learn not to press.
 *
 * The damage lands when it LANDS, in `stepGrenades`.
 */
export const throwGrenade = (mult: number): boolean => {
  if (phase.value !== 'run' && phase.value !== 'boss') return false
  const at = grenadeTarget()
  if (!at) return false

  grenades.push({
    x: anchorX, y: anchorY,
    fromX: anchorX, fromY: anchorY,
    tx: at.x, ty: at.y,
    t: 0,
    power: Math.max(1, squadDps.value * mult),
    dps: squadDps.value,
    mult
  })
  pushFx({ kind: 'grenadeThrow', x: anchorX, y: anchorY })
  return true
}

/** Everything a landed grenade does. */
const detonateGrenade = (g: Grenade): void => {
  pushFx({ kind: 'grenade', x: g.tx, y: g.ty })

  for (const f of foes) {
    if (f.dead) continue
    if (Math.hypot(f.x - g.tx, f.y - g.ty) > GRENADE_BLAST_R) continue
    damageFoe(f, g.power)
  }
  if (boss && !boss.dead && Math.hypot(boss.x - g.tx, boss.y - g.ty) <= GRENADE_BLAST_R + boss.scale) {
    // Through the shield, like a barrel: the grenade is the other answer to a
    // phase the player was told they could do nothing about.
    //
    // Against a FLOORED boss the multiplier is capped, and only there. The floor
    // prices the bar at `BOSS_MIN_FIRE_SECONDS` of `squadDps`, and the grenade
    // deals `squadDps × mult` in one hit — so at the base multiplier of 3 the
    // bomb is worth exactly the whole guarantee. Everything else on the road,
    // and every boss the authored curve still prices, takes the full hit.
    const mult = bossFloored ? Math.min(g.mult, BOSS_FLOOR_GRENADE_MULT) : g.mult
    damageBoss(boss, Math.max(1, g.dps * mult), true)
  }
  for (const bl of barrels) {
    if (bl.dead || bl.fuse >= 0) continue
    if (Math.hypot(bl.x - g.tx, bl.y - g.ty) > GRENADE_BLAST_R) continue
    bl.fuse = 0
    pushFx({ kind: 'barrelLit', x: bl.x, y: bl.y })
  }
}

const stepGrenades = (dt: number): void => {
  for (let i = grenades.length - 1; i >= 0; i--) {
    const g = grenades[i]!
    g.t += (dt * 1000) / GRENADE_FLIGHT_MS
    if (g.t >= 1) {
      g.t = 1
      detonateGrenade(g)
      grenades.splice(i, 1)
      continue
    }
    // Straight line in world space; the renderer adds the arc as screen height,
    // so the throw reads as a lob without the sim needing a third axis.
    g.x = g.fromX + (g.tx - g.fromX) * g.t
    g.y = g.fromY + (g.ty - g.fromY) * g.t
  }
}

/**
 * What a homing round should fly at, or `null` for "nothing worth turning for".
 *
 * The NEAREST live body ahead of the muzzle and inside the gun's reach, boss
 * included. Nearest rather than biggest, or weakest, or most numerous: the
 * player has to be able to predict where the next rocket goes without doing
 * arithmetic, and "the closest thing in front of you" is the only rule that
 * reads at a glance.
 *
 * Three refusals, and each is a rule about what the launcher is FOR:
 *
 *   • nothing behind the muzzle. A round that turns around is a round that
 *     lands in the crowd, and the blast does not ask who is standing in it.
 *   • nothing outside `range`. The gun's reach is a promise about the screen
 *     (see `BULLET_RANGE`) and an auto-aimer that quietly outranged it would
 *     make the Reach track meaningless for half the campaign.
 *   • nothing but monsters and the boss. Crates, barrels and the puzzle's own
 *     levers are targets the player CHOOSES, and a weapon that stole that
 *     choice would spend the stage's whole supply of rockets on scenery.
 *
 * Scanned per round fired rather than cached, which is affordable precisely
 * because the launcher is slow: one pass over the live monsters a couple of
 * times a second, against the gatling's two hundred rounds in the same second.
 */
const aimTarget = (
  fromX: number, fromY: number, range: number, taken: Array<Foe | Boss> | null = null
): Foe | Boss | null => {
  let best: Foe | Boss | null = null
  let bestD = Number.POSITIVE_INFINITY
  // Fallback for a salvo that has already claimed everything in reach: better
  // to double up on the nearest body than to fire the last two rounds of a
  // volley straight up an empty road.
  let anyBest: Foe | Boss | null = null
  let anyBestD = Number.POSITIVE_INFINITY
  const top = anchorY + range

  for (const f of foes) {
    if (f.dead || f.y <= fromY + 0.6 || f.y > top) continue
    const dx = f.x - fromX
    const dy = f.y - fromY
    const d = dx * dx + dy * dy
    if (d < anyBestD) {
      anyBestD = d
      anyBest = f
    }
    if (d >= bestD) continue
    // ── One rocket per body, while there are bodies ──
    //
    // Without this a salvo is five rounds into the SAME nearest monster: the
    // muzzles are a couple of units apart and "nearest" almost always agrees
    // across them. That is four rounds of overkill on a body the first one
    // already killed, and on screen it is one explosion rather than a fan of
    // five — the exact thing the volley exists to show.
    if (taken && taken.includes(f)) continue
    bestD = d
    best = f
  }
  // The boss is a target like any other — it is the thing a stage's launcher
  // most wants to be pointed at, and while it is guarded the round is eaten
  // exactly as a forward one would be. Nothing here needs to know about the
  // shield; `resolveBullet` already owns that rule.
  if (boss && !boss.dead && boss.y > fromY + 0.6 && boss.y <= top) {
    const dx = boss.x - fromX
    const dy = boss.y - fromY
    const d = dx * dx + dy * dy
    if (d < anyBestD) {
      anyBestD = d
      anyBest = boss
    }
    // The boss is the one target a salvo is ALLOWED to stack on. It is the
    // thing in the game with a health bar long enough to eat five rounds, and
    // spreading a volley off it onto the escort would be a downgrade dressed
    // as variety.
    if (d < bestD) best = boss
  }
  return best ?? anyBest
}

/**
 * Emit bullets.
 *
 * Only a handful of streams are ever visible — `SHOOTERS` for the squad's own
 * gun, and whatever `weaponStreams` decides for a weapon — but the DPS is the
 * whole squad's: each round carries `squad × damage / shooters`. A hundred
 * survivors therefore hit a hundred times harder without costing a hundred
 * times the draw calls, and the damage numbers still add up to exactly
 * `squad × damage × fireRate`.
 *
 * That identity is why the stream count is a pure FEEL dial: it divides the
 * damage and multiplies the cadence by the same factor, so it decides how many
 * rounds the player sees and never how much they are worth.
 */

/**
 * Bodies a volley has already claimed, so the launcher's five rounds land on
 * five different monsters rather than five times on the nearest one.
 *
 * Module-level and cleared per trigger rather than allocated: the launcher
 * fires a few times a second for the length of a run, and this is the hot path.
 * It holds at most `streamsMax` entries, which is why a linear `includes` in
 * `aimTarget` is the right lookup.
 */
const salvoTargets: Array<Foe | Boss> = []

const stepShooting = (dt: number): void => {
  if (phase.value !== 'run' && phase.value !== 'boss') return
  const alive = squadCount.value
  if (alive <= 0) return

  // ── The weapon, resolved ONCE per tick ──
  //
  // Three numbers come out of it and none of them may be read per bullet: the
  // shop multiplier behind `weaponPowerMul` is a Vue computed, and a gatling at
  // depth emits a couple of hundred rounds a second.
  //
  // `streams` is a pure feel dial — see `game/weapons.ts`. It divides the
  // damage and multiplies the cadence, so it cancels out of the DPS product
  // exactly; what it changes is whether the player sees fourteen thin tracers
  // or one fat rocket.
  const weapon = activeWeapon.value
  const def = weapon ? WEAPONS[weapon] : null
  // Grows with the crowd for the launcher — see `weaponStreams`. It cancels out
  // of the DPS product, so this decides how MANY rockets the player sees and
  // nothing else.
  const streams = weaponStreams(weapon, alive)
  const damageMul = def ? def.damageMul * weaponPowerMul(weapon!) : 1

  const shooters = Math.min(alive, streams)
  const perBullet = ((alive * damage.value) / shooters) * damageMul
  // Read once per tick for the same reason `stepBullets` does: `rangeBonus` is
  // a Vue computed, and only the homing branch below actually needs it.
  const gunRange = def?.homing ? effectiveBulletRange(rangeBonus.value) : 0

  // ── One trigger pull, `salvo` rounds ──
  //
  // The launcher fires all of its muzzles together (`WeaponDef.volley`); every
  // other weapon fires them one at a time down the cadence. The cadence is
  // divided by exactly the number of rounds a trigger produces, so the shot
  // budget over any stretch of road is identical either way — this decides
  // whether the player sees a salvo or a trickle, and nothing else.
  const salvo = def?.volley ? shooters : 1
  fireAccum += dt * (shooters / salvo) * runFireRate.value * (def?.rateMul ?? 1)
  // Hard cap the burst a single frame can produce, so a long frame (a tab
  // regaining focus) cannot dump sixty bullets into one 16 ms slice. Counted in
  // TRIGGERS, so a five-round volley costs one — a gatling frame and a launcher
  // frame stay the same size in rounds.
  let budget = Math.max(1, Math.floor(8 / salvo))
  while (fireAccum >= 1 && budget-- > 0) {
    fireAccum -= 1
    // Each volley spreads across as many different bodies as it can find (see
    // `aimTarget`). Cleared per TRIGGER, not per tick: the next volley is free
    // to re-pick the same pack, and the list is a module-level scratch buffer
    // so a run's worth of frames allocates nothing.
    salvoTargets.length = 0

    for (let shot = 0; shot < salvo; shot++) {
      // Fire from a random survivor in the FRONT half of the crowd. Random beats
      // "the first N in the array" here: the muzzle flashes scatter across the
      // front rank instead of stuttering out of the same three bodies — and for
      // a volley it is also what fans the salvo out across the rank rather than
      // launching five rockets from one pair of shoulders.
      let from: Unit | null = null
      for (let tries = 0; tries < 6 && !from; tries++) {
        const u = units[Math.floor(Math.random() * units.length)]
        if (u && u.dying <= 0 && u.y >= anchorY - 0.4) from = u
      }
      if (!from) from = units.find((u) => u.dying <= 0) ?? null
      if (!from) {
        budget = 0
        break
      }

      from.flash = 70
      const b = takeBullet()
      b.x = from.x
      b.y = from.y + 0.35
      b.damage = perBullet
      b.life = BULLET_LIFE_MS
      b.weapon = weapon

      // ── Where it goes ──
      //
      // Everything but the launcher goes straight up the road with a touch of
      // scatter, which is what makes the muzzle flashes read as a crowd rather
      // than as one gun. A homing round takes the whole speed budget along the
      // vector to its target instead — same speed, different direction — and
      // keeps NO scatter, because a weapon that aims itself and then misses by
      // half a unit is worse than one that never aimed.
      const target = def?.homing
        ? aimTarget(b.x, b.y, gunRange, salvo > 1 ? salvoTargets : null)
        : null
      if (target) {
        if (salvo > 1) salvoTargets.push(target)
        const dx = target.x - b.x
        const dy = target.y - b.y
        const len = Math.hypot(dx, dy) || 1
        b.vx = (dx / len) * BULLET_SPEED
        b.vy = (dy / len) * BULLET_SPEED
      } else {
        b.vx = (Math.random() - 0.5) * 0.5
        b.vy = BULLET_SPEED
      }
      bullets.push(b)
      // The weapon rides along: a launch is not a rifle shot, and the mixer needs
      // to know which of the two it is drawing and playing.
      pushFx({ kind: 'shoot', x: from.x, y: from.y + 0.35, weapon })
    }
  }
  if (fireAccum > 4) fireAccum = 4
}

/**
 * Move rounds and resolve the first thing each one touches.
 *
 * Deliberately a linear scan rather than a spatial hash: the live set inside a
 * bullet's window is a handful of objects, and a hash would cost more to
 * maintain than it saves. The `dy` early-out is what keeps it honest — a bullet
 * never looks at anything it cannot reach this frame.
 */
const stepBullets = (dt: number): void => {
  // Read ONCE per frame, not per bullet: `rangeBonus` is a Vue computed and a
  // thousand rounds in flight is a thousand dependency reads for a number that
  // cannot change mid-tick.
  const gunRange = effectiveBulletRange(rangeBonus.value)
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i]!
    b.life -= dt * 1000
    b.x += b.vx * dt
    b.y += b.vy * dt

    // Out of range is measured from the CROWD, not from where the round was
    // fired: the range is a fact about the screen, and the screen travels with
    // the squad. A round fired a moment before the crowd sped up therefore
    // reaches slightly further in world terms, which is correct — it is still
    // on screen, and still short of the top.
    if (b.life <= 0 || b.y > anchorY + gunRange || Math.abs(b.x) > LANE_HALF + 1) {
      releaseBullet(i)
      continue
    }
    if (resolveBullet(b)) releaseBullet(i)
  }
}

/** @returns true when the round was consumed. */
const resolveBullet = (b: Bullet): boolean => {
  // Foes first: something standing in front of a gate should absorb the fire
  // aimed at it, which is what makes escorts and packs a real obstacle.
  for (const f of foes) {
    if (f.dead) continue
    const dy = f.y - b.y
    if (dy < -0.6 || dy > 1.1) continue
    if (Math.abs(f.x - b.x) > 0.44 * f.scale + BULLET_R) continue
    damageFoe(f, b.damage)
    pushFx({ kind: 'hit', x: b.x, y: b.y, on: 'foe' })
    // The blast is charged to everything AROUND the body that stopped the
    // round; the body itself already took the round in full. See `detonateRound`.
    if (b.weapon) detonateRound(b, f)
    return true
  }

  // ── The stone over a lever, before the lever ──
  //
  // The two never share a y band — the stone is `LEVER_STONE_LEAD` in front —
  // so this is an ordering statement rather than a tie-break: the round meets
  // the cover first because the cover is first, and that is the whole cost the
  // stone adds to the beat.
  for (const s of stones) {
    if (s.dead) continue
    const dy = s.y - b.y
    if (dy < -STONE_H / 2 || dy > STONE_H / 2 + 0.4) continue
    if (Math.abs(s.x - b.x) > s.w / 2 + BULLET_R) continue
    s.hp -= b.damage
    s.flash = 1
    // Sparks like the boulder it looks like, not like a wall: the picture the
    // player already has for "that is stone" should not change just because
    // this one answers to fire.
    pushFx({ kind: 'hit', x: b.x, y: b.y, on: 'rock' })
    if (s.hp <= 0) {
      s.dead = true
      pushFx({ kind: 'barricadeBreak', x: s.x, y: s.y })
    }
    if (b.weapon) detonateRound(b)
    return true
  }

  // ── Levers, before the boxes ──
  //
  // A lever lives at |x| = 3.4, further out than anything else on the road, so
  // in practice nothing contends for the same round. The order is stated
  // anyway: a lever is the one target in the game whose value is not in the
  // damage it takes, and a crate that happened to drift into the same column
  // must not be allowed to eat the shot that solves the stage.
  for (const lv of levers) {
    if (lv.pulled) continue
    const dy = lv.y - b.y
    if (dy < -LEVER_R || dy > LEVER_R + 0.4) continue
    if (Math.abs(lv.x - b.x) > LEVER_R + BULLET_R) continue
    lv.hp -= b.damage
    lv.flash = 1
    pushFx({ kind: 'hit', x: b.x, y: b.y, on: 'barricade' })
    if (lv.hp <= 0) pullLever(lv)
    if (b.weapon) detonateRound(b)
    return true
  }

  // The armour, before the box it is covering. It eats rounds like a wall and
  // takes real damage — a crowd that would rather shoot through the lid than
  // find the levers is allowed to try, and `stepWeaponBoxes` opens the box when
  // nothing is covering it any more, however that came about.
  for (const g of guards) {
    if (g.dead) continue
    const dy = g.y - b.y
    if (dy < -GUARD_H / 2 || dy > GUARD_H / 2 + 0.4) continue
    if (Math.abs(g.x - b.x) > g.w / 2 + BULLET_R) continue
    g.hp -= b.damage
    g.flash = 1
    pushFx({ kind: 'hit', x: b.x, y: b.y, on: 'barricade' })
    if (g.hp <= 0) {
      g.dead = true
      pushFx({ kind: 'barricadeBreak', x: g.x, y: g.y })
    }
    if (b.weapon) detonateRound(b)
    return true
  }

  // ── The prize ──
  //
  // A LOCKED box is skipped entirely rather than eating the round: while the
  // armour is up the box is not a target, and a round that squeaked past the
  // plates' edge must not quietly chip away at a puzzle the player has not
  // solved. It flies on and dies at range like any other miss.
  for (const wb of weaponBoxes) {
    if (wb.dead || wb.locked) continue
    const dy = wb.y - b.y
    if (dy < -wb.r || dy > wb.r + 0.4) continue
    if (Math.abs(wb.x - b.x) > wb.r + BULLET_R) continue
    wb.hp -= b.damage
    pushFx({ kind: 'hit', x: b.x, y: b.y, on: 'crate' })
    if (wb.hp <= 0) takeWeaponBox(wb)
    if (b.weapon) detonateRound(b)
    return true
  }

  for (const c of crates) {
    if (c.dead) continue
    const dy = c.y - b.y
    if (dy < -CRATE_R || dy > CRATE_R + 0.4) continue
    if (Math.abs(c.x - b.x) > CRATE_R + BULLET_R) continue
    c.hp -= b.damage
    pushFx({ kind: 'hit', x: b.x, y: b.y, on: 'crate' })
    if (c.hp <= 0) breakCrate(c)
    if (b.weapon) detonateRound(b)
    return true
  }

  // The two roadside prizes, after the supply crates and before the barrels.
  // The order is only a statement — the generator keeps all three well apart —
  // but it is the honest one: a supply crate is the road's staple and a prize is
  // its exception, so a round can never be stolen from the thing the player has
  // been shooting since stage 1 by the thing they met last week.
  for (const c of cages) {
    if (c.dead) continue
    const dy = c.y - b.y
    if (dy < -CAGE_R || dy > CAGE_R + 0.4) continue
    if (Math.abs(c.x - b.x) > CAGE_R + BULLET_R) continue
    c.hp -= b.damage
    // The bars RATTLE rather than crack. Same feedback channel a barricade uses
    // (`flash`), a completely different picture — see `drawCages`.
    c.flash = 1
    pushFx({ kind: 'hit', x: b.x, y: b.y, on: 'crate' })
    if (c.hp <= 0) breakCage(c)
    if (b.weapon) detonateRound(b)
    return true
  }

  for (const w of bulwarks) {
    if (w.dead) continue
    const dy = w.y - b.y
    if (dy < -BULWARK_R || dy > BULWARK_R + 0.4) continue
    if (Math.abs(w.x - b.x) > BULWARK_R + BULLET_R) continue
    w.hp -= b.damage
    pushFx({ kind: 'hit', x: b.x, y: b.y, on: 'crate' })
    if (w.hp <= 0) takeBulwark(w)
    if (b.weapon) detonateRound(b)
    return true
  }

  // Barrels eat rounds like a crate and are worth spending them on: see
  // `detonate`. Checked before barricades so a barrel standing against a wall is
  // still the thing the crowd is shooting at.
  for (const bl of barrels) {
    if (bl.dead || bl.fuse >= 0) continue
    const dy = bl.y - b.y
    if (dy < -BARREL_R || dy > BARREL_R + 0.4) continue
    if (Math.abs(bl.x - b.x) > BARREL_R + BULLET_R) continue
    bl.hp -= b.damage
    pushFx({ kind: 'hit', x: b.x, y: b.y, on: 'crate' })
    if (bl.hp <= 0) {
      // Lit, not gone: the fuse is what lets the player read the blast coming
      // and gives the moment a beat of its own.
      bl.fuse = 0
      pushFx({ kind: 'barrelLit', x: bl.x, y: bl.y })
    }
    if (b.weapon) detonateRound(b)
    return true
  }

  for (const bar of barricades) {
    if (bar.dead) continue
    const dy = bar.y - b.y
    if (dy < -BARRICADE_H / 2 || dy > BARRICADE_H / 2 + 0.4) continue
    if (Math.abs(bar.x - b.x) > bar.w / 2 + BULLET_R) continue
    bar.hp -= b.damage
    bar.flash = 1
    pushFx({ kind: 'hit', x: b.x, y: b.y, on: 'barricade' })
    if (bar.hp <= 0) {
      bar.dead = true
      pushFx({ kind: 'barricadeBreak', x: bar.x, y: bar.y })
      spillCoins(bar.x, bar.y, BARRICADE_COIN_MIN, BARRICADE_COIN_MAX)
    }
    if (b.weapon) detonateRound(b)
    return true
  }

  // ─── A boulder eats the round and shrugs ──────────────────────────────────
  //
  // No damage branch, on purpose. This is the one solid thing in the game that
  // fire cannot answer, and the round has to be VISIBLY consumed — a bullet
  // that passed through would read as a hitbox bug, and a bullet that vanished
  // silently would read as the gun jamming. It sparks like a wall and dies.
  for (const r of rocks) {
    const dy = r.y - b.y
    if (dy < -ROCK_H / 2 || dy > ROCK_H / 2 + 0.4) continue
    if (Math.abs(r.x - b.x) > r.w / 2 + BULLET_R) continue
    pushFx({ kind: 'hit', x: b.x, y: b.y, on: 'rock' })
    // A rocket that ran into a boulder still goes off. It is the one place the
    // stone is worth aiming AT: the blast reaches past it and the crowd behind
    // has no other answer to a body sheltering there.
    if (b.weapon) detonateRound(b)
    return true
  }

  // Gate dividers eat rounds. Sitting in the middle of the lane therefore
  // charges NOTHING — indecision costs the player the pump as well as the
  // survivors it will cost them a second later.
  for (const f of foes) {
    if (f.dead || Math.abs(f.y - anchorY) > 6) continue
    solids.push({
      x: f.x, y: f.y,
      halfW: f.scale * FOE_BODY_HALF_W + UNIT_R,
      halfH: f.scale * FOE_BODY_HALF_H + UNIT_R
    })
  }
  for (const d of dividers) {
    if (d.dismissed) continue
    const dy = d.y - b.y
    if (dy < -DIVIDER_H / 2 || dy > DIVIDER_H / 2 + 0.4) continue
    if (Math.abs(d.x - b.x) > d.halfW + BULLET_R) continue
    pushFx({ kind: 'hit', x: b.x, y: b.y, on: 'barricade' })
    return true
  }

  // ─── Gates do NOT stop rounds ─────────────────────────────────────────────
  //
  // Everything above is solid and eats the bullet. A gate is not: it is an open
  // doorway with a curtain hanging in it, and the round goes through.
  //
  // This started as a placement complaint and turned out to be a rule problem.
  // Minibosses arrive shortly after a bank, and while a gate ate every round
  // the player could not begin the fight until they were through the door — by
  // which time the elite was already on top of them, closing at the sum of both
  // speeds. The elite was not a fight, it was a wall with a health bar. Nudging
  // it further up the road only trades one bad beat for a longer empty one; the
  // honest fix is to stop pretending a doorway is armour.
  //
  // What it does NOT change is the pump. Charge is time-based, so shooting a
  // gate still costs the player the SECONDS they spend aimed at it — which is
  // the only currency the gate ever charged. What they get back is the right to
  // start shooting what is behind it, which is what the moment always looked
  // like it should do.
  for (const g of gates) {
    if (g.used) continue
    const dy = g.y - b.y
    if (dy < -GATE_DEPTH || dy > GATE_DEPTH + 0.5) continue
    if (Math.abs(g.x - b.x) > g.halfW) continue
    // EVERY op, not just the additive ones. This test used to name `add` and
    // `sub` explicitly, which is why multipliers and traps shipped unpumpable:
    // `stepGates` was willing to grow them and nothing ever told it they were
    // being shot at. `gatePumpCap` is now the single answer to "can this door
    // still grow", so the two halves cannot drift apart again.
    if (g.value < Math.min(gatePumpCap(g.op), g.pumpCap ?? Number.POSITIVE_INFINITY)) {
      // One tick per half second of sustained fire, exactly as promised on the
      // tin. That keeps a gate worth the same to a squad of five and a squad of
      // fifty — it is a decision about time, not a DPS check. A `-N` or `/N`
      // leaf is the same clock running the other way.
      //
      // A round from a weapon with a `gateHoldS` starts the clock BELOW zero:
      // the launcher's salvo reloads for longer than the door's hot window, and
      // without the hold a rocket-armed crowd could not pump a door at all.
      g.hotFor = -(b.weapon ? WEAPONS[b.weapon].gateHoldS : 0)
    }
    // The curtain sparks once per round rather than once per frame: a doorway
    // is ~0.9 units deep and a round crosses it over several frames, so without
    // this the FX budget for one gate is an order of magnitude out.
    if (b.pierced !== g.id) {
      b.pierced = g.id
      pushFx({ kind: 'hit', x: b.x, y: b.y, on: 'gate' })
    }
    break
  }

  if (boss && !boss.dead) {
    const dy = boss.y - b.y
    if (dy > -1.2 && dy < 1.6 && Math.abs(boss.x - b.x) < 1.1 * boss.scale) {
      // A guarded boss still EATS the bullet — it flashes, it sparks, the
      // player's fire is visibly landing and visibly doing nothing. Letting the
      // round pass through would read as a hitbox bug rather than as a phase.
      if (boss.guard > 0) {
        boss.flash = 1
        pushFx({ kind: 'bossGuard', x: b.x, y: b.y })
        // No blast either: the shield is the phase where the player's fire is
        // supposed to do nothing, and a rocket splashing damage onto a guarded
        // boss would quietly repeal the one beat that asks them to move.
        return true
      }
      damageBoss(boss, b.damage)
      pushFx({ kind: 'bossHit', x: b.x, y: b.y })
      if (b.weapon) detonateRound(b, null, true)
      return true
    }
  }
  return false
}

/**
 * ─── A rocket goes off ──────────────────────────────────────────────────────
 *
 * Called from every branch of `resolveBullet` that consumes a round, and a
 * no-op for every weapon whose `splashR` is 0 — which is why the call sites can
 * be a flat `if (b.weapon) detonateRound(b)` rather than a second thing to remember.
 *
 * `direct` is the body that stopped the round: it has already taken the damage
 * in full and must not be charged twice. Everything else inside the radius takes
 * `ROCKET_SPLASH_SHARE` of it, which is what keeps the launcher an answer to a
 * CLUMP rather than a straight multiplier — twelve bodies is worth about four
 * rounds, one body is worth exactly one.
 *
 * Deliberately does NOT touch levers. Splash solving a puzzle would mean the
 * only way to fail the beat is to not own a weapon already, which makes the
 * reward its own prerequisite.
 */
const detonateRound = (b: Bullet, direct: Foe | null = null, hitBoss = false): void => {
  const r = b.weapon ? WEAPONS[b.weapon].splashR : 0
  if (r <= 0) return
  const share = b.damage * ROCKET_SPLASH_SHARE
  const rr = r * r

  for (const f of foes) {
    if (f.dead || f === direct) continue
    const dx = f.x - b.x
    const dy = f.y - b.y
    if (dx * dx + dy * dy > rr) continue
    damageFoe(f, share)
  }
  for (const c of crates) {
    if (c.dead) continue
    const dx = c.x - b.x
    const dy = c.y - b.y
    if (dx * dx + dy * dy > rr) continue
    c.hp -= share
    if (c.hp <= 0) breakCrate(c)
  }
  // Splash opens the prizes too. A rocket that could crack every box on the road
  // except the two worth crossing it for would be teaching the player that the
  // weapon they earned does not work on the things they earned it for.
  for (const c of cages) {
    if (c.dead) continue
    const dx = c.x - b.x
    const dy = c.y - b.y
    if (dx * dx + dy * dy > rr) continue
    c.hp -= share
    c.flash = 1
    if (c.hp <= 0) breakCage(c)
  }
  for (const w of bulwarks) {
    if (w.dead) continue
    const dx = w.x - b.x
    const dy = w.y - b.y
    if (dx * dx + dy * dy > rr) continue
    w.hp -= share
    if (w.hp <= 0) takeBulwark(w)
  }
  for (const bar of barricades) {
    if (bar.dead) continue
    const dx = bar.x - b.x
    const dy = bar.y - b.y
    if (dx * dx + dy * dy > rr) continue
    bar.hp -= share
    bar.flash = 1
    if (bar.hp <= 0) {
      bar.dead = true
      pushFx({ kind: 'barricadeBreak', x: bar.x, y: bar.y })
      spillCoins(bar.x, bar.y, BARRICADE_COIN_MIN, BARRICADE_COIN_MAX)
    }
  }
  for (const bl of barrels) {
    if (bl.dead || bl.fuse >= 0) continue
    const dx = bl.x - b.x
    const dy = bl.y - b.y
    if (dx * dx + dy * dy > rr) continue
    bl.fuse = 0
    pushFx({ kind: 'barrelLit', x: bl.x, y: bl.y })
  }
  for (const g of guards) {
    if (g.dead) continue
    const dx = g.x - b.x
    const dy = g.y - b.y
    if (dx * dx + dy * dy > rr) continue
    g.hp -= share
    g.flash = 1
    if (g.hp <= 0) {
      g.dead = true
      pushFx({ kind: 'barricadeBreak', x: g.x, y: g.y })
    }
  }
  // …and the lever stones, so a launcher is not simply worse at the beat: its
  // rounds are few, and one that goes off beside a stone should crack it rather
  // than being wasted on the geometry.
  //
  // The LEVER itself is deliberately absent from this list, as it is from every
  // other blast in the game. A rocket that pulled levers with splash would hand
  // the puzzle to whoever happened to be holding a launcher, and the beat is
  // supposed to ask the same question on both halves of the campaign.
  for (const s of stones) {
    if (s.dead) continue
    const dx = s.x - b.x
    const dy = s.y - b.y
    if (dx * dx + dy * dy > rr) continue
    s.hp -= share
    s.flash = 1
    if (s.hp <= 0) {
      s.dead = true
      pushFx({ kind: 'barricadeBreak', x: s.x, y: s.y })
    }
  }
  // `hitBoss` is the direct-hit case, already paid. A guarded boss is untouched
  // by a blast for the same reason it is untouched by a round.
  if (!hitBoss && boss && !boss.dead && boss.guard <= 0) {
    const dx = boss.x - b.x
    const dy = boss.y - b.y
    if (dx * dx + dy * dy <= rr) damageBoss(boss, share)
  }

  pushFx({ kind: 'rocketBlast', x: b.x, y: b.y, radius: r })
}

/**
 * A lever goes over.
 *
 * The count is the feedback: one pip on a two-pip badge is the difference
 * between "that did nothing" and "one more". When the last one lands, the
 * armour is not damaged — it is REMOVED, all of it, in the same frame, because
 * the promise the beat makes is that solving it opens the box, not that it
 * starts a second fight the player has no road left to win.
 */
const pullLever = (lv: Lever): void => {
  if (lv.pulled) return
  lv.pulled = true
  lv.hp = 0
  const box = weaponBoxes.find((w) => w.puzzleId === lv.puzzleId && !w.dead)
  if (!box) return
  box.leversPulled++
  puzzlePulled.value = box.leversPulled
  pushFx({
    kind: 'leverPull', x: lv.x, y: lv.y,
    pulled: box.leversPulled, total: box.leversTotal
  })
  if (box.leversPulled < box.leversTotal) return
  unlockPuzzle(box)
}

/** Strip the armour and light the prize up. */
const unlockPuzzle = (box: WeaponBox): void => {
  // Idempotent: both the levers and `stepWeaponBoxes` can reach this, and the
  // second caller must not fire the cascade a second time.
  if (!box.locked || box.dead) return
  box.locked = false
  box.openFor = 0
  for (const g of guards) {
    if (g.puzzleId !== box.puzzleId || g.dead) continue
    g.dead = true
    pushFx({ kind: 'barricadeBreak', x: g.x, y: g.y })
  }
  pushFx({ kind: 'weaponOpen', x: box.x, y: box.y, weapon: box.weapon })
}

/** The box breaks and the stage's weapon comes out of it. */
const takeWeaponBox = (box: WeaponBox): void => {
  if (box.dead) return
  box.dead = true
  activeWeapon.value = box.weapon
  puzzleWeapon.value = null
  puzzleGift.value = false
  // A weapon is a bigger moment than a crate, and the crowd should show it —
  // the same full-squad flash a supply crate fires, which is the game's
  // established "everyone just got better" beat.
  for (const u of units) u.flash = 260
  pushFx({ kind: 'weaponTake', x: box.x, y: box.y, weapon: box.weapon })
}

/**
 * Levers: a hit flash, a throw animation, and a despawn.
 *
 * No contact rule at all — see `Lever`. A post the crowd ran through is a beat
 * the player missed, and the miss is the entire punishment.
 */
const stepLevers = (dt: number): void => {
  for (let i = levers.length - 1; i >= 0; i--) {
    const lv = levers[i]!
    if (lv.flash > 0) lv.flash = Math.max(0, lv.flash - dt * 4)
    if (lv.pulled) lv.pulledFor += dt
    if (lv.y < anchorY - 6) levers.splice(i, 1)
  }
}

/**
 * Armour plates.
 *
 * ─── The only solid in the game that costs NOTHING to touch ─────────────────
 *
 * No contact rule at all — not a wall's `crushAgainst`, not even a crate's
 * gentle `grindAgainst`. The plates are still solid to rounds and still in
 * `collectSolids`, so the formation flows around them exactly the way it flows
 * around a crate; what a survivor brushing one does not do is die.
 *
 * The reasoning is the one in `Guard`, taken to its conclusion. Every other
 * obstacle on the road is part of a stage's difficulty budget: the generator
 * places it, `earlyObstacleKeep` thins it, the balance harness counts it. These
 * two are not. They are furniture bolted to an optional bonus, on every stage
 * from 4, and a player steering an ordinary line has not opted into them.
 *
 * A crate's trickle was tried first and measured: a crowd sweeping the full
 * width of the road paid three tolls in a row — two plates and the box — for
 * about a third of itself, and a stage-4 run that had done nothing wrong died
 * before it reached its miniboss. A bonus that bills a player who never engaged
 * with it is a tax, whatever the rate.
 *
 * The BOX keeps the crate toll. That one is a reward the player chose to drive
 * at, which is exactly the case the crate rule was written for.
 */
const stepGuards = (dt: number): void => {
  for (let i = guards.length - 1; i >= 0; i--) {
    const g = guards[i]!
    if (g.flash > 0) g.flash = Math.max(0, g.flash - dt * 5)
    if (g.dead || g.y < anchorY - 6) guards.splice(i, 1)
  }
}

/**
 * The stones over the levers.
 *
 * Same rules as the armour above, for the same reason: they are furniture on an
 * optional beat, so they are solid to rounds and to the formation and harmless
 * to touch. Nothing here reaches the lever behind — a stone that broke is just
 * gone, and whether the post is then shot is the player's business.
 */
const stepStones = (dt: number): void => {
  for (let i = stones.length - 1; i >= 0; i--) {
    const s = stones[i]!
    if (s.flash > 0) s.flash = Math.max(0, s.flash - dt * 5)
    if (s.dead || s.y < anchorY - 6) stones.splice(i, 1)
  }
}

/**
 * The prize box.
 *
 * Grinds like a supply crate rather than killing like a wall: the player is
 * being invited onto this shoulder, and a reward that punishes the approach as
 * hard as a barricade would teach them to stop approaching rewards. The armour
 * in front of it is the part that kills, and by the time the box is reachable
 * the armour is gone.
 */
const stepWeaponBoxes = (dt: number): void => {
  for (let i = weaponBoxes.length - 1; i >= 0; i--) {
    const wb = weaponBoxes[i]!
    if (!wb.locked) wb.openFor += dt
    if (wb.dead || wb.y < anchorY - 6) {
      weaponBoxes.splice(i, 1)
      // Nothing left to solve: clear the badge so it does not sit on the HUD
      // for the rest of the stage advertising a box that is behind the crowd.
      if (!weaponBoxes.some((o) => !o.dead)) {
        puzzleWeapon.value = null
        puzzleGift.value = false
      }
      continue
    }
    if (wb.y > anchorY + 6) continue

    // ── The armour is gone, however it went ──
    //
    // Normally the last lever removes it. But the plates are ordinary walls with
    // ordinary health, and a crowd big enough to chew through six barricades in
    // the two seconds they are in range is entitled to the box it just paid for.
    // Keying the unlock on "is anything still covering this" rather than on "did
    // the levers do it" means the two paths cannot disagree — and a box sitting
    // untouchable behind a hole the player made would read as a broken hitbox.
    //
    // Only while the box is still AHEAD of the crowd: `stepBarricades` culls the
    // plates at `anchorY - 6` and the box survives a little longer than that, so
    // without the test every missed puzzle would play its unlock cascade into
    // the back of the camera.
    if (wb.locked) {
      if (wb.y <= anchorY) continue
      if (guards.some((g) => g.puzzleId === wb.puzzleId && !g.dead)) continue
      unlockPuzzle(wb)
      continue
    }

    // A GIFT is opened by gunfire alone. The grind below is the earned box's
    // entry fee — "stand on it and shoot" — and it is priced for a late crowd
    // against a normal-sized box; charged to a stage-2 squad standing inside one
    // twice as wide it is simply a wipe. See `WeaponBox.gift`.
    if (wb.gift) continue

    grindAgainst(wb.id, {
      x: wb.x, halfW: wb.r, y: wb.y, halfH: wb.r,
      cause: 'crate'
    }, 0.12, dt)
  }
}

/**
 * The ONLY writer of `runFireRate`.
 *
 * Every value is clamped into the legal band and any non-finite input falls
 * back to the base rate. A `NaN` here does not stay here: it multiplies into
 * the shot budget, so the squad silently stops firing, and it renders straight
 * into the HUD pill as the word "NaN" — a bug the player sees before anyone
 * else does. One choke point makes that unrepresentable.
 */
const setFireRate = (v: number): void => {
  // `NaN` is the only genuinely meaningless input — it has no ordering, so it
  // cannot be clamped, and it has to fall back. An infinity is just a very
  // large number and clamps like any other.
  if (Number.isNaN(v)) {
    runFireRate.value = BASE_FIRE_RATE
    return
  }
  runFireRate.value = Math.max(0.1, Math.min(MAX_FIRE_RATE, v))
}

const breakCrate = (c: Crate): void => {
  c.dead = true
  if (c.kind === 'rate') {
    // The only way fire rate rises during a run. Capped so a crate-rich stage
    // cannot outrun the bullet budget.
    setFireRate(runFireRate.value + (c.gain ?? CRATE_RATE_GAIN))
    pushFx({
      kind: 'crateBreak', x: c.x, y: c.y, crate: 'rate',
      value: Math.round(runFireRate.value * 10) / 10
    })
  } else {
    damage.value += c.gain ?? CRATE_DAMAGE_GAIN
    pushFx({ kind: 'crateBreak', x: c.x, y: c.y, crate: 'damage', value: damage.value })
  }
  for (const u of units) u.flash = 220
}

/**
 * A cage comes apart and the people inside it join the run.
 *
 * Mirrors `breakCrate` exactly except for what it pays, which is the whole
 * entity: a crate writes a stat, this writes bodies. It pays through `spawnUnit`
 * — the same function a gate's payout uses — so a cage cannot smuggle survivors
 * past `MAX_SQUAD`, past `peakSquad`, or past the honesty rule the cap exists
 * for (see `MAX_SQUAD`): if there is no room, the crowd is at the ceiling and
 * the number was never real.
 *
 * The freed survivors appear AT THE CAGE and are pulled into formation by the
 * ordinary spring, exactly as gate arrivals appear at their door. That is not
 * decoration: the payout has a POSITION, so the player sees the crowd swell out
 * of the shoulder they steered to rather than out of themselves, which is the
 * only thing on screen that says the detour was what paid.
 */
const breakCage = (c: Cage): void => {
  c.dead = true
  const room = MAX_SQUAD - squadCount.value
  const freed = Math.max(0, Math.min(c.hold, room))
  for (let i = 0; i < freed; i++) {
    spawnUnit(
      c.x + (Math.random() - 0.5) * CAGE_R * 2.2,
      c.y - 0.2 - Math.random() * 0.7
    )
  }
  // `count` is what actually got out, not what was in there: a cage opened at
  // the squad cap must not print a number the crowd did not gain.
  pushFx({ kind: 'cageBreak', x: c.x, y: c.y, count: freed })
  for (const u of units) u.flash = 220
}

/**
 * The auto-shield box opens and the absorb arms.
 *
 * Idempotent in the way that matters: taking a second box while one is already
 * armed does NOT stack, because the pickup is a latch and two latches is a
 * different mechanic — an absorb the player has to count is an absorb they
 * cannot plan around. A stage places at most one box (`placeRescues`), so in
 * practice this only fires with `bulwarkArmed` already true when a rocket's
 * splash reaches a box the same frame a round does, which is exactly the case
 * that must not pay twice.
 */
const takeBulwark = (w: Bulwark): void => {
  w.dead = true
  const fresh = !bulwarkArmed
  bulwarkArmed = true
  pushFx({ kind: 'bulwarkTake', x: w.x, y: w.y, fresh })
  for (const u of units) u.flash = 220
}

const damageFoe = (f: Foe, amount: number): void => {
  f.hp -= amount
  f.flash = 1
  if (f.elite) eliteHp01.value = Math.max(0, f.hp / f.maxHp)
  if (f.hp > 0) return
  f.dead = true
  kills.value++
  const def = foeDef(f.typeId)
  const coins = f.elite ? def.coins * 8 : def.coins
  runCoins.value += coins
  if (f.elite) pushFx({ kind: 'eliteDie', x: f.x, y: f.y })
  else pushFx({ kind: 'foeDie', x: f.x, y: f.y, big: def.scale > 1.1 })
  pushFx({ kind: 'coin', x: f.x, y: f.y, value: coins })

  // ─── …and a body DROPS something ──────────────────────────────────────────
  //
  // The bounty above is real but invisible: it lands in a counter behind the
  // HUD, so shooting a pack read as pure cost — spend the rounds, take the
  // bites, get nothing you can see. A corpse now scatters loose coins on the
  // road as well, which turns the same kill into a reason to be somewhere.
  //
  // Deliberately DROPPED rather than granted. Loose coins have to be driven
  // over (see `COIN_MAGNET_BASE`), so killing the pack in front of you pays and
  // killing the pack you are steering away from pays less — and Scavenging,
  // which was worth nothing to a player who fights, is now worth something to
  // exactly that player. The scatter is sized by the archetype, so a brute is
  // visibly worth more than a creep without a second number to tune.
  const drop = f.elite
    ? FOE_COIN_DROP_ELITE
    : Math.max(1, Math.round(def.coins * FOE_COIN_DROP_PER_BOUNTY))
  spillCoins(f.x, f.y, drop, drop + 1)
}

/**
 * Gate charge, gate crossing, gate payoff.
 *
 * Two independent things happen here and they are kept apart on purpose:
 *
 *   CHARGING  — a gate that took fire this frame accumulates time. Every
 *               `gateTickMs` of it, the number goes up by `gatePumpStep` and
 *               the world
 *               gets a `gateTick` event (a sound, a burst, a punch on the
 *               number). Stop shooting for 400 ms and the part-charge is lost,
 *               so "sustained" means sustained. Only `add` leaves pump.
 *
 *   CROSSING  — when the crowd's centre passes the gate's line, every leaf is
 *               scored by the survivors INSIDE ITS OWN WIDTH. There is a lethal
 *               pillar between the leaves, so taking two at once is not a
 *               strategy — it is a funeral. `div` leaves KILL the fraction of
 *               the crowd that walked into them, which is what makes a bank a
 *               decision instead of a formality.
 */
const stepGates = (dt: number): void => {
  firingAtGate = false

  // Hoisted: both are pure functions of the stage, which cannot change inside a
  // frame, and the loop below runs over every live leaf every tick.
  const addTickMs = gateTickMs('add', stage.value)
  const scaleTickMs = gateTickMs('mul', stage.value)
  const addStep = gatePumpStep(stage.value)
  // The weapon in the crowd's hands winds every door it is pointed at faster
  // (the gatling) or exactly as fast (everything else) — see `WeaponDef.pumpMul`.
  const weaponPump = activeWeapon.value ? WEAPONS[activeWeapon.value].pumpMul : 1

  for (let i = gates.length - 1; i >= 0; i--) {
    const g = gates[i]!

    // Cull gates the crowd has left well behind.
    if (g.y < anchorY - 6) {
      gates.splice(i, 1)
      continue
    }
    if (g.pop > 0) g.pop = Math.max(0, g.pop - dt * 3.6)
    g.hotFor += dt

    if (g.used) continue

    // `sub` pumps on exactly the same clock as `add`, and that is the whole
    // idea: the crowd fires forward whether the player wants it to or not, so
    // sitting in front of a `-N` is a cost the player pays for not having aimed
    // somewhere else. `firingAtGate` is NOT set for it — that flag drives the
    // "you are pumping something" feedback, and a player making a mistake
    // should not be told they are earning.
    // Every op pumps now, and the two families pump differently: `+/-` in whole
    // survivors, `x//` in tenths (see `GATE_SCALE_STEP`). What they share is the
    // rule that makes a bank a decision — the crowd has ONE stream of fire, so
    // whatever it is pointed at is the door being invested in, and the doors it
    // is not pointed at stay where they are.
    const scale = isScaleOp(g.op)
    // The op's own ceiling, or this door's lower one (stage 1's opener).
    const pumpCap = Math.min(gatePumpCap(g.op), g.pumpCap ?? Number.POSITIVE_INFINITY)
    if (g.hotFor < 0.4) {
      // `firingAtGate` drives the "you are pumping something" feedback, so it is
      // set only for the doors that pay: a player making the mistake of hosing a
      // trap should not be told they are earning.
      if (g.op === 'add' || g.op === 'mul') firingAtGate = true
      // Two multipliers on the clock, both 1 on an ordinary door with the
      // squad's own gun: the weapon's (`pumpMul` on the def) and the door's
      // (`pumpMul` on the leaf, stage 1's racing opener).
      g.charge += dt * 1000 * weaponPump * g.pumpMul
      // Both the interval and the additive step scale with the stage — see
      // `gatePumpStep`. The scale ops keep their tenth and get the shorter
      // clock instead.
      const tickMs = scale ? scaleTickMs : addTickMs
      while (g.charge >= tickMs && g.value < pumpCap) {
        g.charge -= tickMs
        // Rounded to a tenth every step: floating point would otherwise print
        // `x2.4000000000000004` on the door. The additive step is clamped for
        // the same reason the loop condition is not enough on its own: a step
        // bigger than one can overshoot the cap from below it.
        g.value = scale
          ? Math.min(pumpCap, Math.round((g.value + GATE_SCALE_STEP) * 10) / 10)
          : Math.min(pumpCap, g.value + addStep)
        g.pop = 1
        pushFx({
          kind: 'gateTick', x: g.x, y: g.y, value: g.value,
          hostile: g.op === 'sub' || g.op === 'div'
        })
      }
    } else {
      g.charge = 0
    }

    if (anchorY < g.y) continue

    // ── Crossing ──
    // The whole BANK resolves at once — see `claimBank`. Leaves are marked
    // `used` there, so reaching this line means this leaf's bank has not been
    // resolved yet.
    claimBank(g.bankId)
    continue
  }
}

/**
 * Resolve one bank: the crowd goes through exactly ONE door.
 *
 * "The player can still only pass through 1 gate at a time" is the rule, and it
 * is what makes a bank a decision instead of a shopping list. The leaf holding
 * the most survivors wins the bank outright and pays in full; every other leaf
 * is destroyed on the spot, along with the pillars between them.
 *
 * Deciding by HEAD COUNT rather than by the anchor matters at the edges: a
 * player who is still sliding when the line arrives gets the door most of their
 * crowd is actually in, which is what they can see, rather than the one the
 * invisible centre point happened to be over.
 */
/**
 * Destroy every offer the player did not take.
 *
 * Called AFTER the payout event is queued, and that ordering is load-bearing:
 * `distance` is unsigned, so the renderer locates the blast origin from the
 * `gatePass` in the same drained batch. A dismissal that arrived first would
 * have nothing to travel away from.
 */
const dismissLosers = (leaves: Gate[], winner: Gate): void => {
  for (const leaf of leaves) {
    if (leaf === winner) continue
    leaf.dismissed = true
    pushFx({
      kind: 'gateDismiss',
      x: leaf.x,
      y: leaf.y,
      halfW: leaf.halfW,
      op: leaf.op,
      value: leaf.value,
      // How far the shockwave has to travel from the door that was taken —
      // what turns a three-leaf bank into a left-to-right cascade.
      distance: Math.abs(leaf.x - winner.x)
    })
  }
}

const claimBank = (bankId: number): void => {
  const leaves = gates.filter((g) => g.bankId === bankId && !g.used)
  if (leaves.length === 0) return

  let winner: Gate | null = null
  let best = -1

  const counts = new Map<number, Unit[]>()
  for (const leaf of leaves) {
    const inside: Unit[] = []
    for (const u of units) {
      if (u.dying > 0) continue
      if (Math.abs(u.x - leaf.x) <= leaf.halfW) inside.push(u)
    }
    counts.set(leaf.id, inside)
    // Ties break toward the leaf the crowd's centre is nearest to, so a dead
    // heat still resolves the way the player was steering.
    const score = inside.length - Math.abs(anchorX - leaf.x) * 0.001
    if (score > best) { best = score; winner = leaf }
  }

  for (const leaf of leaves) leaf.used = true
  // The pillars belong to the bank and go with it — but they are MARKED rather
  // than deleted, so the renderer can topple them as part of the cascade. From
  // this instant they are scenery: `stepDividers` stops billing anyone who
  // touches one, because the decision they were enforcing has been made.
  for (const f of foes) {
    if (f.dead || Math.abs(f.y - anchorY) > 6) continue
    solids.push({
      x: f.x, y: f.y,
      halfW: f.scale * FOE_BODY_HALF_W + UNIT_R,
      halfH: f.scale * FOE_BODY_HALF_H + UNIT_R
    })
  }
  for (const d of dividers) {
    if (d.bankId === bankId) d.dismissed = true
  }

  if (!winner) return
  const inside = counts.get(winner.id) ?? []

  // Nobody made it through ANY door — the crowd was on a pillar, or dead. Then
  // there is no winner to speak of and every leaf blows up, rather than one of
  // them silently popping out of existence with no payout and no explanation.
  if (inside.length === 0) {
    for (const leaf of leaves) {
      leaf.dismissed = true
      pushFx({
        kind: 'gateDismiss',
        x: leaf.x, y: leaf.y, halfW: leaf.halfW,
        op: leaf.op, value: leaf.value,
        distance: Math.abs(leaf.x - anchorX)
      })
    }
    return
  }

  if (winner.op === 'div' || winner.op === 'sub') {
    // The two hostile doors, resolved together because they differ only in how
    // the bill is worked out: `÷N` keeps a FRACTION of whoever came through,
    // `-N` takes a COUNT off the top. That difference is the entire decision
    // when they are offered side by side — a division is cheap for a small
    // crowd and ruinous for a big one, and a subtraction is exactly the other
    // way round.
    const keep = winner.op === 'div'
      ? Math.max(0, Math.floor(inside.length / Math.max(2, winner.value)))
      : Math.max(0, inside.length - Math.max(1, Math.round(winner.value)))
    // The bite is a contact channel too — a stuck player keeps more of the
    // crowd they walked in with.
    const toKill = Math.round((inside.length - keep) * contactRelief)
    for (let k = 0; k < toKill; k++) killUnit(inside[k]!, Math.sign(inside[k]!.x - winner.x), 'trap')
    timeScaleTarget = Math.min(timeScaleTarget, 0.5)
    pushFx({
      kind: 'gatePass', x: winner.x, y: winner.y, op: winner.op, value: winner.value, gain: -toKill
    })
    dismissLosers(leaves, winner)
    return
  }

  // The winning door pays IN FULL. There is no share to split any more: one
  // bank, one door, one payout — and the pillars have already billed anyone who
  // tried to hedge.
  // The Squad track buys a share of what every door pays — the only currency
  // that holds its value once the crowd is built on the road rather than in the
  // shop. Multipliers are left alone: they already scale with the crowd.
  const gain = winner.op === 'add'
    ? Math.round(winner.value * gatePayoutBonus.value)
    : Math.round(inside.length * (winner.value - 1))
  if (gain <= 0) {
    dismissLosers(leaves, winner)
    return
  }

  // Slow the world down for a beat. It is a cheap trick and it works every
  // time: the crowd doubling is the payoff of the last four seconds, and at
  // full speed it is over before the eye can register it.
  timeScaleTarget = Math.min(timeScaleTarget, 0.45)

  const room = MAX_SQUAD - squadCount.value
  const spawned = Math.max(0, Math.min(gain, room))
  for (let k = 0; k < spawned; k++) {
    // New arrivals appear AT the winning leaf and are pulled into formation by
    // the normal spring, so the crowd visibly swells from the gate outwards.
    spawnUnit(
      winner.x + (Math.random() - 0.5) * winner.halfW * 1.4,
      winner.y + 0.3 + Math.random() * 0.8
    )
  }
  pushFx({
    kind: 'gatePass', x: winner.x, y: winner.y, op: winner.op, value: winner.value, gain: spawned
  })
  dismissLosers(leaves, winner)
}

/**
 * The pillars between gate leaves.
 *
 * Pure geometry and absolutely lethal: anything that touches one dies. This is
 * the enforcement mechanism for "choose a side" — without it the optimal play
 * is always to straddle the middle and collect both leaves, and the bank stops
 * being a decision.
 */
const stepDividers = (dt: number): void => {
  for (let i = dividers.length - 1; i >= 0; i--) {
    const d = dividers[i]!
    if (d.y < anchorY - 6) {
      dividers.splice(i, 1)
      continue
    }
    if (d.y > anchorY + 6) continue
    // Claimed banks leave inert pillars behind for the length of their
    // teardown. They are on screen; they are not lethal.
    if (d.dismissed) continue

    // The steepest grind in the game once the player knows what a pillar is — a
    // narrow thing they were told to avoid, so hitting one dead-centre should
    // cost more than a wall they could not have gone around.
    //
    // Ramped over the opening stages, because the crowd's resting position is
    // x = 0 and so is the pillar: see `dividerGrindFor`.
    const crush = dividerCrushFor(stage.value)
    const hit = grindAgainst(d.id, {
      x: d.x, halfW: d.halfW, y: d.y, halfH: DIVIDER_H / 2,
      cause: 'divider'
    }, crush.rate, dt, crush.floor, crush.bite)
    if (hit) pushFx({ kind: 'divider', x: d.x, y: d.y })
  }
}

/** Foes walk down the lane, drift toward the crowd, and bite what they reach. */
/**
 * ─── The pool minibosses ────────────────────────────────────────────────────
 *
 * `MinibossKind` has four members and only one of them — `scythe` — is the
 * plant-and-sweep fight the rest of `stepFoes` is written around. The other
 * three own their own movement, their own attack, their own contact rules and
 * their own tell, so they are lifted out whole rather than threaded through the
 * scythe's code with three `if (kind === …)` guards per beat.
 *
 * Each is one question the others do not ask:
 *
 *   roller  WHICH SIDE ARE YOU ON.  Half the road, one straight line, no
 *           tracking. The dodge is total and so is the failure to dodge.
 *   bomber  WHERE DID YOU LEAD IT.  It comes to where you are, so where you are
 *           is the decision. Lure, then cross.
 *   gunner  ARE YOU STILL THERE.    One fat round down one column, slowly.
 *
 * @returns whether the SHARED tail still applies to this body — the solid-body
 *          contact in `collideFoe` and the bite loop. Two of the three answer
 *          no, and both times it matters: a rolling ball that also billed
 *          `collideFoe` would charge twice for one roll, and an armed bomber
 *          that stayed solid was measured taking 96 of 150 survivors against
 *          the 75 its blast is actually priced at.
 */
const stepPoolElite = (f: Foe, dt: number): boolean => {
  switch (f.kind) {
    case 'roller':
      stepRoller(f, dt)
      return false
    case 'bomber':
      return stepBomber(f, dt)
    case 'gunner':
      stepGunner(f, dt)
      return true
    default:
      return true
  }
}

/**
 * The ball.
 *
 * Two guarantees live in this function and both are written as ASSIGNMENTS
 * rather than as omissions, because an omission is a line somebody deletes by
 * accident and an assignment is a line whose removal a test can see.
 */
const stepRoller = (f: Foe, dt: number): void => {
  // ── It cannot track, because its x is not its own ──
  //
  // Rewritten from the lane every tick rather than merely left un-homed. The
  // difference is the difference between "we did not add tracking" and "tracking
  // is impossible", and only the second survives the next person editing the
  // homing line twenty lines above this one.
  f.x = rollerLaneX(f.lane)

  // ── It cannot wall the road ──
  //
  // `hold` is the only thing that makes `stepAnchor` drag the crowd toward a
  // crawl. A hazard the width of half the road that ALSO stops the run is not a
  // dodge question, it is a toll booth: the player would be held in place beside
  // the one thing they were supposed to steer away from. So the ball never
  // holds, and the run never slows for it.
  f.hold = 0
  f.y -= ROLLER_SPEED * dt

  // ── One roll, one bill, taken at the crossing ──
  //
  // `kindTicks` is the latch: 0 until the ball has passed the crowd's own line,
  // 1 for ever after. A ball gets exactly one chance at a squad.
  //
  // The moment is the CROSSING (`f.y <= anchorY`), not first contact, and the
  // difference is the whole hit. Billing on first contact measured FOUR
  // survivors out of a hundred and sixty: the ball touches the crowd's leading
  // edge two and a half units before it reaches anybody's middle, so the set of
  // bodies "inside the ball" on that frame is a handful of front-liners and the
  // share had nothing to collect from. At the crossing the footprint is centred
  // on the crowd's own centre, which is both the maximum overlap and the honest
  // reading of "it rolled over you".
  //
  // Deliberately a single frame rather than a running total across the roll: a
  // per-frame toll is a rate, and a rate charges a crowd for how long it spent
  // near a thing rather than for the line it ran — the exact model
  // `crushAgainst` was rewritten to get rid of.
  if (f.kindTicks > 0 || phase.value !== 'run' || f.y > anchorY) return
  f.kindTicks = 1

  const hitR = ROLLER_R + UNIT_R
  if (!nearCrowd(f.x, f.y, hitR)) return
  const caught: Unit[] = []
  const hit2 = hitR * hitR
  for (const u of units) {
    if (u.dying > 0) continue
    const dx = u.x - f.x
    const dy = u.y - f.y
    if (dx * dx + dy * dy > hit2) continue
    caught.push(u)
  }
  // Nobody in the lane: the player committed to the free half, and a total dodge
  // costs a total nothing. The latch is set anyway — the ball has had its go.
  if (caught.length === 0) return

  // ── Under the stone: everyone, with no budget ──
  //
  // The boulder rule (`crushAgainst`), applied to the boulder that moves. A
  // stationary one takes everyone it touches at every stage, onboarding relief
  // included, because it stands still and the whole cost is the line the player
  // chose — and this one is MORE avoidable than that, not less: one lane, one
  // straight line, no tracking, announced from `ROLLER_WARN_AHEAD` off.
  //
  // Run before the share below so a graze can never spend the budget on bodies
  // the core was taking anyway; `killUnit` sets `dying`, so the loop after this
  // skips them and bills only what the edge of the ball actually cost.
  const coreR = rollerCoreR()
  const core2 = coreR * coreR
  const dirOf = (u: Unit): number => Math.sign(u.x - f.x) || (f.lane < 0 ? -1 : 1)

  // ── Clipped by the edge: a share, as before ──
  //
  // The band between the stone and `ROLLER_R + UNIT_R` is a survivor whose own
  // radius caught the ball, not one it rolled over, so it keeps the bounded
  // pricing every other percentage hit uses. The ceiling is the elite one
  // (`SWEEP_FRACTION_MAX`) rather than the boss's, because a miniboss's
  // percentage attacks all answer to the same bound; the floor and the
  // onboarding cut are the ones every big hit in the game carries.
  //
  // Hoisted above the core pass, and expressed as a function of the squad, for
  // ONE reason: the bulwark has to price the whole roll — core plus edge — in a
  // single number before either half lands, and the edge's budget is read off
  // the crowd that survives the core. A second copy of this arithmetic beside
  // the pickup would be a copy that drifts. `cut` and `share` are pure in the
  // stage, so moving them changes nothing; the only squad-dependent term is the
  // argument, and the live call below still passes the same value it always did.
  const cut = earlyBigHitMul(stage.value)
  const share = Math.min(SWEEP_FRACTION_MAX, ROLLER_FRACTION * endlessPressure(stage.value))
  const rollerBudget = (squad: number): number => Math.max(
    Math.max(1, Math.round(BOSS_MIN_KILL * cut)),
    Math.ceil(Math.max(0, squad) * share * slamRelief * cut)
  )

  if (bulwarkArmed) {
    let core = 0
    for (const u of caught) {
      if ((u.x - f.x) ** 2 + (u.y - f.y) ** 2 <= core2) core++
    }
    const edge = Math.min(rollerBudget(squadCount.value - core), caught.length - core)
    // The whole roll, vetoed together. A ball that flattened the core and then
    // had its edge absorbed would be the worst of both readings — the player
    // watches the crowd die and is also told the shield worked.
    if (bulwarkAbsorb(core + edge, f.x, f.y)) {
      // The ball still visibly rolls through — the latch above has already been
      // set, so this roll has had its go and cannot come back for a second.
      pushFx({ kind: 'rollerHit', x: f.x, y: f.y, dir: f.lane < 0 ? -1 : 1 })
      return
    }
  }

  for (const u of caught) {
    if (u.dying > 0) continue
    if ((u.x - f.x) ** 2 + (u.y - f.y) ** 2 > core2) continue
    killUnit(u, dirOf(u), 'elite')
  }

  let budget = rollerBudget(squadCount.value)
  // Nearest the ball's centre first. The crowd is eaten from the side the thing
  // eating it came from, which is what makes the loss legible — a crowd hollowed
  // out at random reads as a bug.
  const d2 = (u: Unit): number => (u.x - f.x) ** 2 + (u.y - f.y) ** 2
  caught.sort((a, b) => d2(a) - d2(b))
  for (const u of caught) {
    if (budget <= 0) break
    // Already taken by the core above.
    if (u.dying > 0) continue
    killUnit(u, dirOf(u), 'elite')
    budget--
  }
  // The impact's direction is the ball's own lane — the side it came from — and
  // not any one body's, which is what the per-unit `dirOf` above is for.
  pushFx({ kind: 'rollerHit', x: f.x, y: f.y, dir: f.lane < 0 ? -1 : 1 })
}

/**
 * The bomber: sprint, plant, burn, go off.
 *
 * @returns whether the shared solid-body and bite passes still apply. They do
 *          while it is running at you (it is a body, and a body is solid) and
 *          they do NOT once it has planted — an armed bomber is a fuse, and
 *          charging for the fuse as well as the blast bills one mistake twice.
 */
const stepBomber = (f: Foe, dt: number): boolean => {
  if (f.fuse > 0) {
    // ── Armed ──
    //
    // Absolutely still: no walk, no tracking, no lunge. The whole read is that
    // the thing has committed to a spot and the spot is the only fact left.
    //
    // It holds the road while it burns, and that is not decoration. The crowd
    // covers ~5.4 units a second, which is more than the blast is wide, so a
    // bomber that let the road run would be dodged by the squad's own forward
    // motion — the player would learn that bombers do nothing. Holding for the
    // one second of the fuse keeps the geometry where the player saw it and
    // makes the answer unambiguously sideways.
    f.hold = f.fuse
    f.fuse -= dt
    if (f.fuse > 0) return false
    detonate(f)
    return false
  }

  // ── The sprint ──
  //
  // It never holds while it is running: the approach is the shooting window, and
  // a crowd dragged to a crawl in front of an unarmed bomber would be paying for
  // an attack that has not happened yet.
  f.hold = 0
  f.y -= BOMBER_SPEED * dt
  const slide = BOMBER_TRACK * dt
  f.x += Math.max(-slide, Math.min(slide, anchorX - f.x))
  f.x = Math.max(-LANE_HALF + 0.3, Math.min(LANE_HALF - 0.3, f.x))

  // Arming is gated on the run, like every other elite attack: nothing should be
  // detonating inside the arena, where the boss owns the fight.
  if (phase.value !== 'run' || f.y - anchorY > BOMBER_PLANT_GAP) return true
  f.fuse = BOMBER_FUSE
  f.hold = BOMBER_FUSE
  // Announced at the START of the fuse carrying the exact seconds to the blast,
  // so the ring the player is shown closes on the beat it goes off.
  pushFx({ kind: 'bombCast', x: f.x, y: f.y, radius: BOMBER_BLAST_R, ttl: BOMBER_FUSE })
  return false
}

/** The blast: half of everyone still standing in it, and then the bomber is
 *  gone. */
const detonate = (f: Foe): void => {
  f.fuse = 0
  f.hold = 0

  const inside: Unit[] = []
  const r2 = BOMBER_BLAST_R * BOMBER_BLAST_R
  for (const u of units) {
    if (u.dying > 0) continue
    const dx = u.x - f.x
    const dy = u.y - f.y
    if (dx * dx + dy * dy > r2) continue
    inside.push(u)
  }

  // `BOMBER_FRACTION` is deliberately not scaled by `endlessPressure` — it opens
  // at `SLAM_FRACTION_MAX`, the ceiling, and there is nowhere for that dial to
  // push it. The onboarding cut and the stuck-player relief DO apply; the long
  // note on the constant records the argument and the argument against.
  const cut = earlyBigHitMul(stage.value)
  let budget = Math.max(
    Math.max(1, Math.round(BOSS_MIN_KILL * cut)),
    Math.ceil(squadCount.value * BOMBER_FRACTION * slamRelief * cut)
  )
  // Capped by reality, exactly as `BOSS_MIN_KILL` is: the budget is what the
  // blast INTENDS to take, and it may only collect from bodies that were
  // actually inside the ring. A crowd that got clear pays nothing at all, which
  // is the entire point of the lure.
  const d2 = (u: Unit): number => (u.x - f.x) ** 2 + (u.y - f.y) ** 2
  inside.sort((a, b) => d2(a) - d2(b))
  // The bomb still goes off — same ring, same corpse, same beat. It simply
  // takes nobody. `min(budget, inside.length)` is exactly what the loop below
  // would have collected, because the loop stops on whichever runs out first.
  if (!bulwarkAbsorb(Math.min(budget, inside.length), f.x, f.y)) {
    for (const u of inside) {
      if (budget <= 0) break
      killUnit(u, Math.sign(u.x - f.x) || 1, 'elite')
      budget--
    }
  }

  pushFx({ kind: 'bombBlast', x: f.x, y: f.y, radius: BOMBER_BLAST_R })
  // Gone, and it pays NO bounty: it was not killed, it finished. Marking it dead
  // here rather than routing through `damageFoe` is what keeps that honest — a
  // player who failed to dodge should not also be paid for the corpse. Shooting
  // it down before it plants still pays, and that is the reward for the other
  // answer.
  f.dead = true
}

/**
 * The gunner: hold at range, level the gun, fire one fat round straight down its
 * own column.
 *
 * ── Why it fires down its own column and does not lead ──
 *
 * The aim has to be LOCKED at the start of the wind-up or the line the player is
 * shown is not the line the round takes — the same lesson the boss's `aimed`
 * flag records. The cheapest possible lock is no stored aim at all: the gunner
 * stops sliding sideways the moment it levels the gun, and the round leaves
 * straight down the lane from wherever it was standing. The telegraph is then
 * simply "the column under the gunner", which needs no state to be true, cannot
 * drift out of sync with the shot, and reduces the dodge to one clean question.
 */
const stepGunner = (f: Foe, dt: number): void => {
  // Same engagement window the scythe uses, so the drag, the leash and the
  // "nothing chases you into the arena" rule all behave identically.
  const engaged = f.hold > 0 && phase.value === 'run'
    && f.y - anchorY <= ELITE_DRAG_LEAD && f.y >= anchorY

  if (!engaged) {
    // Walking in, or the leash has expired and it is walking through the crowd
    // like any other body. It does not shoot from either state: a round thrown
    // from off-screen has no author, and one thrown point-blank has no dodge.
    f.kindTicks = 0
    f.y -= f.speed * dt
    const homing = 0.9
    f.x += Math.max(-homing * dt, Math.min(homing * dt, (anchorX - f.x) * dt * 0.9))
    f.x = Math.max(-LANE_HALF + 0.3, Math.min(LANE_HALF - 0.3, f.x))
    return
  }

  f.hold -= dt

  // Keep the distance. It backs off as the crowd closes rather than letting the
  // gap shut, because the gap IS the dodge window — see `GUNNER_STANDOFF`.
  const want = anchorY + GUNNER_STANDOFF
  if (f.y > want) f.y = Math.max(want, f.y - f.speed * dt)
  else f.y += (want - f.y) * Math.min(1, dt * 2.5)

  // It slides toward the crowd's column only while it is NOT aiming. Freezing x
  // at the lock is what makes the telegraph honest.
  if (f.kindTicks === 0) {
    const homing = 0.9
    f.x += Math.max(-homing * dt, Math.min(homing * dt, (anchorX - f.x) * dt * 0.9))
    f.x = Math.max(-LANE_HALF + 0.3, Math.min(LANE_HALF - 0.3, f.x))
  }

  // The first arrival levels the gun immediately; every shot after that waits a
  // full reload. `reload` is spawned at 0, which is what makes that sentence one
  // line instead of a flag.
  if (f.reload <= 0) f.reload = GUNNER_TELEGRAPH
  f.reload -= dt

  if (f.kindTicks === 0 && f.reload <= GUNNER_TELEGRAPH) {
    // Only start a wind-up there is time to finish. A tell whose shot never
    // arrives because the leash ran out is a false alarm, and a badge that cries
    // wolf is a badge players stop checking.
    if (f.hold <= GUNNER_TELEGRAPH) return
    f.kindTicks = 1
    // Never a shot with less than a full tell — the same extension the scythe's
    // wind-up gets, for the same reason.
    f.reload = Math.max(f.reload, GUNNER_TELEGRAPH)
    pushFx({
      kind: 'boltCast',
      x: f.x, y: f.y,
      tx: f.x, ty: anchorY - CROWD_MAX_R,
      ttl: f.reload
    })
    return
  }

  if (f.reload > 0) return

  // ── Fire ──
  //
  // The budget is fixed HERE, on the round, rather than recomputed per frame as
  // it crosses the crowd: a bolt has to cost the same whether it takes three
  // frames to pass through on a 30 fps phone or six on a 60 fps one.
  const cut = earlyBigHitMul(stage.value)
  const share = Math.min(SWEEP_FRACTION_MAX, GUNNER_FRACTION * endlessPressure(stage.value))
  bolts.push({
    id: entityId++,
    x: f.x,
    y: f.y,
    dx: 0,
    dy: -1,
    budget: Math.max(
      Math.max(1, Math.round(BOSS_MIN_KILL * cut)),
      Math.ceil(squadCount.value * share * slamRelief * cut)
    ),
    life: BOLT_LIFE,
    dead: false
  })
  pushFx({ kind: 'boltFire', x: f.x, y: f.y, dirX: 0, dirY: -1 })
  f.reload = GUNNER_RELOAD
  f.kindTicks = 0
}

/**
 * ─── The bolt, SWEPT rather than sampled ────────────────────────────────────
 *
 * A round moving at `BOLT_SPEED` covers 0.12 world units in a 60 fps frame and
 * 0.23 in a 30 fps one, against a kill radius of `BOLT_R + UNIT_R` = 0.85. Ask
 * "who is inside the circle right now" once a frame and the answer depends on
 * where the frames happened to fall — a 30 fps phone samples the crowd half as
 * often on the way through and bills a visibly different number of survivors for
 * the same shot. That is the one class of bug a deterministic simulation may not
 * have, because it makes the game a different game on a slower device.
 *
 * So the test is against the SEGMENT the round travelled this frame, capsule
 * against point. Every survivor the round actually passed through is billed
 * exactly once, at any frame rate.
 */
const stepBolts = (dt: number): void => {
  if (bolts.length === 0) return
  const hitR = BOLT_R + UNIT_R
  const hit2 = hitR * hitR

  for (let i = bolts.length - 1; i >= 0; i--) {
    const b = bolts[i]!
    if (b.dead) {
      bolts.splice(i, 1)
      continue
    }
    b.life -= dt
    const x0 = b.x
    const y0 = b.y
    const sx = b.dx * BOLT_SPEED * dt
    const sy = b.dy * BOLT_SPEED * dt
    b.x = x0 + sx
    b.y = y0 + sy

    // The same bounding-disc guard every other O(units) pass uses: a round still
    // crossing empty road never looks at a single survivor.
    const len2 = sx * sx + sy * sy
    if (nearCrowd(x0 + sx * 0.5, y0 + sy * 0.5, hitR + Math.sqrt(len2))) {
      // ── The one blow that cannot be counted from its victims ──
      //
      // A gunner's round is a MOVING blow. It bills whoever its segment sweeps
      // over, this frame, and then flies on and bills more next frame, until
      // `b.budget` runs out or it leaves the crowd — so at no single instant
      // does a victim set exist that describes the whole hit. The two obvious
      // readings are both wrong and wrong in opposite directions: counting the
      // bodies under the segment measures one frame of a hit that spans six and
      // would let a round through under the threshold six times over, while
      // waiting to total the round up refunds losses that already happened,
      // which is the exact failure a blow-level absorb exists to avoid.
      //
      // So this one is measured by INTENT rather than by outcome: `b.budget` is
      // the size of the round, fixed at the moment the gunner fired it (see
      // `Bolt.budget`), and it is asked once — on the first frame the round is
      // in among the crowd at all. Eaten, the round bursts on the dome and is
      // gone; not eaten, it behaves exactly as it always did and is never asked
      // again, because the bulwark is spent or the round is already past.
      //
      // The cost of the choice is stated plainly: a round whose budget is large
      // but which then clips only one survivor will still spend a bulwark. That
      // is the honest side of the trade — it is the round's OWN declaration of
      // how big it was, and the alternative lets the biggest single projectile
      // in the game through on a technicality.
      if (bulwarkArmed) {
        let touched = false
        for (const u of units) {
          if (u.dying > 0) continue
          let t = 0
          if (len2 > 1e-9) {
            t = ((u.x - x0) * sx + (u.y - y0) * sy) / len2
            t = t < 0 ? 0 : t > 1 ? 1 : t
          }
          const dx = u.x - (x0 + sx * t)
          const dy = u.y - (y0 + sy * t)
          if (dx * dx + dy * dy <= hit2) { touched = true; break }
        }
        if (touched && bulwarkAbsorb(b.budget, b.x, b.y)) {
          b.dead = true
          pushFx({ kind: 'boltEnd', x: b.x, y: b.y, spent: true })
          continue
        }
      }
      for (const u of units) {
        if (b.budget <= 0) break
        if (u.dying > 0) continue
        // Closest point on this frame's segment, clamped to its ends.
        let t = 0
        if (len2 > 1e-9) {
          t = ((u.x - x0) * sx + (u.y - y0) * sy) / len2
          t = t < 0 ? 0 : t > 1 ? 1 : t
        }
        const dx = u.x - (x0 + sx * t)
        const dy = u.y - (y0 + sy * t)
        if (dx * dx + dy * dy > hit2) continue
        killUnit(u, Math.sign(dx) || 1, 'elite')
        b.budget--
      }
    }

    const spent = b.budget <= 0
    if (!spent && b.life > 0 && b.y > anchorY - BOLT_TRAIL) continue
    // A round that has taken everyone it is allowed to STOPS there — it buried
    // itself in the crowd. Letting it fly on through the rest of the squad
    // untouched would paint a lie: bodies visibly inside a live round, unharmed.
    b.dead = true
    pushFx({ kind: 'boltEnd', x: b.x, y: b.y, spent })
  }
}

const stepFoes = (dt: number): void => {
  let anyElite = false
  for (let i = foes.length - 1; i >= 0; i--) {
    const f = foes[i]!
    if (f.flash > 0) f.flash = Math.max(0, f.flash - dt * 4)

    if (f.dead || f.y < anchorY - 8) {
      releaseFoe(i)
      continue
    }
    if (f.elite) {
      anyElite = true
      eliteHp01.value = Math.max(0, f.hp / f.maxHp)
    }
    if (f.y > anchorY + LOOKAHEAD + 6) continue

    f.phase += dt

    // ─── The pool minibosses take their own branch ────────────────────────
    //
    // Three of the four `MinibossKind`s are not this fight. They own their
    // movement, their attack and their tell, so the hold, the homing and the
    // sweep below belong to the scythe and to ordinary foes only. The BITE and
    // the solid body are still shared where they apply, because a gunner that
    // has broken off and is walking through the crowd is a monster like any
    // other — see `stepPoolElite` for which kinds opt out and why.
    const pool = f.elite && f.kind !== 'scythe'
    let shared = true
    if (pool) {
      shared = stepPoolElite(f, dt)
      if (f.dead) continue
    }

    // An elite that has arrived PLANTS and tracks the crowd instead of walking
    // through it — see `ELITE_HOLD_AHEAD`. Everything else walks down the lane.
    // The hold is spent only while it is actually holding, so a long walk in
    // never eats the fight, and it ends the moment the arena does: nothing
    // should be chasing the player into the boss.
    // The hold starts when the crowd arrives, not when the elite spawns: the
    // walk in is not the fight, and spending the leash on an empty road is how
    // an elite would break off before the player ever reached it.
    // Engaged from `ELITE_DRAG_LEAD`, which is where the road starts winding
    // down — NOT from the old block line 2.4 units out.
    //
    // That distinction is load-bearing now the elite drags rather than blocks: a
    // crawling crowd may never cover the last two units at all, so a leash that
    // only started there would never start, and the "it is never a soft-lock"
    // guarantee would quietly become false. Starting it where the slow starts
    // means the leash bounds exactly the window the player is being slowed for.
    //
    // Everything from here to the sweep is the SCYTHE's fight and every ordinary
    // foe's walk. A pool kind has already moved itself.
    if (!pool) {
      const engaged = f.elite && f.hold > 0 && phase.value === 'run'
        && f.y - anchorY <= ELITE_DRAG_LEAD && f.y >= anchorY
      if (engaged) {
        f.hold -= dt
        // It gives no ground and takes none. `stepAnchor` stops the crowd at
        // `ELITE_HOLD_AHEAD` in front of it, so this pins the fight's geometry:
        // the elite is always exactly in the firing line, and always in reach of
        // the crowd's leading edge and nothing deeper.
      } else {
        f.y -= f.speed * dt
      }
      // Home in on the crowd, but lazily — a foe that tracks perfectly is
      // unavoidable, and unavoidable is not the same as difficult.
      const homing = f.flying ? 1.5 : 0.9
      f.x += Math.max(-homing * dt, Math.min(homing * dt, (anchorX - f.x) * dt * 0.9))
      if (f.flying) f.x += Math.sin(clock / 700 + f.swayPhase) * dt * 1.1
      f.x = Math.max(-LANE_HALF + 0.3, Math.min(LANE_HALF - 0.3, f.x))
    }

    // ─── The sweep ────────────────────────────────────────────────────────
    //
    // An elite that has closed on the crowd winds up for a third of a second
    // and then swings an arc across the whole road, taking a FIFTH of the squad
    // with it. This is the reason the block is worth having: the player is
    // pinned in front of something that is costing them a fifth of everything
    // they own every second and a half, and the only answer is to kill it.
    //
    // Deliberately NOT the boss's move. The boss aims at a patch of ground and
    // is beaten by moving; this crosses the lane and is beaten by damage. The
    // two are the game's two questions — "where are you standing" and "how hard
    // do you hit" — and the elite is where the second one gets asked.
    //
    // Range-gated on the elite being in the fight, because a lane-wide,
    // undodgeable hit thrown from off-screen would be a tax with no author. It
    // reaches `ELITE_SWEEP_REACH` down the road from its own feet, which is the
    // distance it is drawn at.
    const sweepGap = f.y - anchorY
    if (!pool && f.elite && !f.dead && phase.value === 'run' && sweepGap < ELITE_SWEEP_REACH && sweepGap > -1.5) {
      // The arc's direction is chosen when the WIND-UP starts, not when it
      // lands, so the telegraph can show which way it is coming from. A tell
      // that only becomes true on impact is not a tell.
      f.sweepCd -= dt
      // Announce the swing once, and never let one through unannounced.
      //
      // Asked as "has this swing been told yet", NOT as "did the cooldown cross
      // the telegraph this frame". The cooldown only ticks while the elite is in
      // range, so one that arrived already inside its own telegraph crossed
      // nothing and swung out of nowhere — which is the attack players reported
      // not being able to see. The window is also EXTENDED to a full telegraph
      // when it is short, because a tell the player has no time to answer buys
      // nothing.
      if (!f.sweepTold && f.sweepCd <= ELITE_TELEGRAPH) {
        f.sweepTold = true
        f.sweepDir = -f.sweepDir
        f.sweepCd = Math.max(f.sweepCd, ELITE_TELEGRAPH)
        // The blade is drawn winding up across the ground it is about to cut,
        // for the same reason the boss drops a rock: an arc that only exists on
        // the frame it lands is not a tell, it is an explanation afterwards.
        pushFx({
          kind: 'sliceCast', x: f.x, y: f.y,
          reach: ELITE_SWEEP_REACH, dir: f.sweepDir,
          ttl: f.sweepCd
        })
      }
      if (f.sweepCd <= 0) {
        f.sweepSpan = ELITE_SWEEP_CD
        f.sweepCd = f.sweepSpan
        // The next swing owes its own tell.
        f.sweepTold = false
        // A light body throws itself along the arc; a heavy one plants and
        // turns. Same event, and the sim owns it, so the lunge and the hit can
        // never disagree.
        //
        // SIDEWAYS ONLY. A lunge that also closed the gap would drag the elite
        // inside its own hold distance, and `stepAnchor` clamps the crowd to
        // that distance — so the crowd would be shoved backwards down the road
        // by an attack, which is both bad feel and a way to lose ground the
        // player already paid for.
        if (f.speed > 1.6) f.x += (anchorX - f.x) * ELITE_LUNGE
        pushFx({
          kind: 'eliteSweep', x: f.x, y: f.y, reach: ELITE_SWEEP_REACH,
          dir: f.sweepDir, heavy: f.speed <= 1.6
        })
        // The same relief that softens the boss's slam softens this, and for
        // the same reason: it is the same kind of loss — an announced hit that
        // a stuck player is failing to answer.
        //
        // A fifth of the CURRENT squad, counted off the front rank inward. No
        // radius test: the arc spans the road, and a survivor's x has nothing
        // to say about whether it reached them. Sorting by depth is what makes
        // the loss legible — the crowd is eaten from the end nearest the thing
        // eating it, not hollowed out at random.
        // Percentage damage is the endless road's difficulty dial — see
        // `endlessPressure`. A bigger crowd cannot out-scale a share of itself,
        // which is exactly why this is the term that keeps biting at depth.
        const sweepShare = Math.min(
          SWEEP_FRACTION_MAX,
          ELITE_SWEEP_FRACTION * endlessPressure(stage.value)
        )
        // …with `BOSS_MIN_KILL` under it, so a sweep still reads as a sweep
        // against the small crowd a share of which rounds to one body.
        // Same cut as the boss's slam, and for the same reason: an elite is the
        // first big thing a beginner meets, and it is the one they are most
        // likely to meet without having understood the wind-up yet.
        const sweepCut = earlyBigHitMul(stage.value)
        let budget = Math.max(
          Math.max(1, Math.round(BOSS_MIN_KILL * sweepCut)),
          Math.ceil(squadCount.value * sweepShare * slamRelief * sweepCut)
        )
        const reachable: Unit[] = []
        for (const u of units) {
          if (u.dying > 0) continue
          if (f.y - u.y > ELITE_SWEEP_REACH) continue
          reachable.push(u)
        }
        reachable.sort((a, b) => b.y - a.y)
        // The arc spans the whole road and its budget is a fifth of the crowd,
        // so this clears the bulwark's threshold whenever it connects at all —
        // which is the point: an elite's sweep is `dodgeable: false`, the one
        // big hit in the game with no positional answer, and it is therefore
        // the hit a player would most want a one-shot absorb for.
        if (!bulwarkAbsorb(Math.min(budget, reachable.length), f.x, f.y)) {
          for (const u of reachable) {
            if (budget <= 0) break
            killUnit(u, f.sweepDir, 'elite')
            budget--
          }
        }
      }
    }

    // ─── A monster is solid ───────────────────────────────────────────────
    //
    // ABOVE the bite cooldown on purpose: being a body is not an attack, so it
    // applies on every frame the monster is alive — including the frames
    // between bites, and including the walk back down the road after
    // `ELITE_HOLD_MAX` breaks an elite's hold, where a crowd that failed to
    // kill it used to pass straight through the sprite.
    // `shared` is false for the two pool kinds that own their contact outright:
    // a rolling ball bills the roll, and an armed bomber bills the blast. Either
    // one also billing `collideFoe` charges a single mistake twice — measured at
    // 96 of 150 survivors taken against the 75 the blast is priced at.
    if (!f.dead && shared) collideFoe(f, dt)

    f.biteCd -= dt
    if (!shared || f.biteCd > 0) continue
    // Same guard as the obstacles: a foe that is not within biting distance of
    // the crowd's own disc never looks at a single survivor.
    if (!nearCrowd(f.x, f.y, FOE_REACH + UNIT_R + (f.elite ? 0.9 : 0))) continue

    // Bite whatever survivors are in reach. A miniboss reaches further, because
    // its body is bigger — a foe you can walk past is not a wall.
    const reach = FOE_REACH + UNIT_R + (f.elite ? 0.9 : 0)
    const reach2 = reach * reach
    // The flat cost, or a share of the crowd, whichever hurts more. See
    // `biteShareFor`: the flat number owns the early game where it was
    // authored, and the share is what stops a thousand-strong squad from
    // walking through the same monster unharmed. Only the SHARE eases for a
    // player who is stuck — the archetype's own bite is the game's identity and
    // does not get quietly turned down.
    // A miniboss carries `BOSS_MIN_KILL` under both of them: the archetypes it
    // is grown from bite one or two, and a thing with a health bar and a name
    // must not take less than a husk-and-a-half. Ordinary foes keep their own
    // number — see the note on the constant.
    const want = Math.max(
      f.elite ? BOSS_MIN_KILL : 0,
      f.bite,
      Math.ceil(squadCount.value * f.biteShare * contactRelief)
    )
    // A mouthful is a blow: it is one attack, metered by its own cooldown, and
    // it takes `want` bodies at once. On the small crowds the flat number owns
    // it is one or two and never clears `BULWARK_FLOOR` — which is the correct
    // answer, and the one the pickup was specified to give. On the large crowds
    // the SHARE owns, a brute's 1.8 % is still a third of the threshold, so what
    // actually gets absorbed here is a miniboss's mouthful of a thinned squad:
    // the moment a fight is being lost, which is when insurance should pay.
    //
    // The cooldown is set either way. The monster BIT; whether anything died is
    // the shield's business, and a foe that could re-bite on the next frame
    // because its last one was absorbed would be a foe the pickup made angrier.
    const inReach = (u: Unit): boolean => {
      const dx = u.x - f.x
      const dy = u.y - f.y
      return dx * dx + dy * dy <= reach2
    }
    if (absorbedBlow(want, f.x, f.y, inReach)) {
      f.biteCd = foeDef(f.typeId).biteCd
      continue
    }
    let eaten = 0
    let bit = false
    for (const u of units) {
      if (eaten >= want) break
      if (u.dying > 0) continue
      if (!inReach(u)) continue
      killUnit(u, Math.sign(u.x - f.x), f.elite ? 'elite' : 'foe')
      eaten++
      bit = true
    }
    if (bit) f.biteCd = foeDef(f.typeId).biteCd
  }
  eliteAlive.value = anyElite
  if (!anyElite) eliteHp01.value = 0
  // Stepped here rather than from `step` because a bolt is one elite's fight
  // carried on after it — a gunner that dies mid-flight leaves its round in the
  // air, and the round is the only enemy projectile in the game.
  stepBolts(dt)
}

/**
 * Barricades are pure geometry: they do not act, they are simply THERE.
 *
 * Anything that walks into a live one dies — no quota, no grace. There is
 * always a gap in the row (the generator guarantees it), so a barricade is a
 * routing problem that can *optionally* be solved with bullets, and driving
 * straight into one is a decision the player made.
 */
const stepBarricades = (dt: number): void => {
  for (let i = barricades.length - 1; i >= 0; i--) {
    const bar = barricades[i]!
    if (bar.flash > 0) bar.flash = Math.max(0, bar.flash - dt * 5)
    if (bar.dead || bar.y < anchorY - 6) {
      barricades.splice(i, 1)
      continue
    }
    if (bar.y > anchorY + 6) continue

    crushAgainst({
      x: bar.x, halfW: bar.w / 2, y: bar.y, halfH: BARRICADE_H / 2,
      cause: 'barricade'
    })
  }
}

/**
 * Boulders: solid, lethal, and permanent.
 *
 * The same contact channel as every other solid thing — one `crushAgainst`, so
 * a boulder bills exactly the way a wall does and the player never has to learn
 * a second rule. What it does NOT have is a branch that can delete it. It rolls
 * off the bottom of the road when the crowd is past it and that is the only way
 * it ever leaves.
 *
 * ─── …except a passage rib, which DIVIDES the crowd ─────────────────────────
 *
 * A passage (see `passage()` in the track) is a rib of stone running back down
 * the road from a bank's pillar, splitting the approach into one corridor per
 * door. In the world it is a dozen separate boulders, and billing them one at a
 * time — each of them a wall that kills everything it touches — made the rib a
 * MINCER rather than a divider: measured on stage 8, a crowd that entered the
 * mouth on the centre line went 203 → 0 in a quarter of a second, because every
 * survivor the spring dragged back toward the anchor met the next stone in the
 * line. "Choose a corridor" is a fair thing to ask; "choose a corridor or the
 * run is over, with no frame in which you could see it coming" is not.
 *
 * So the rib is resolved as ONE object, once, and it does what its shape says:
 *
 *   **the crowd is cut on the stone, the side carrying more survivors runs on
 *   down its corridor, and the side carrying fewer is erased.**
 *
 * Three things follow, and all three are why this is the right shape:
 *
 *   • THE WORST CASE IS HALF. Dead-centre is the most a rib can ever take, and
 *     it is exactly the case the old rule took everything for. Clip the mouth
 *     with a tenth of the crowd and lose a tenth — the cost is the line that was
 *     run, which is what every other solid on the road already charges for.
 *   • THE RUN CONTINUES. Whatever the player was steering at, they come out of
 *     the mouth with a crowd inside a corridor, pointed at a door. A passage is
 *     supposed to move the commitment upstream, not end the stage.
 *   • IT SCALES BY ITSELF, being measured in the crowd's own bodies — nothing to
 *     re-tune from a four-strong squad to a four-thousand-strong one.
 *
 * Scattered boulders are untouched. A field is threaded at full width or not at
 * all, and a rock the player was told to go around should keep killing whoever
 * runs into it.
 */
const stepRocks = (dt: number): void => {
  // The rib is measured on the way past and resolved after the loop. It has to
  // be ONE object in both of its jobs — the cut is one decision, and the wall is
  // one unbroken barrier — and neither can be done stone by stone.
  let lo = Number.POSITIVE_INFINITY
  let hi = Number.NEGATIVE_INFINITY
  let wallLo = Number.POSITIVE_INFINITY
  let wallHi = Number.NEGATIVE_INFINITY
  let nearestY = 0
  let ribs = 0

  for (let i = rocks.length - 1; i >= 0; i--) {
    const r = rocks[i]!
    if (r.y < anchorY - 6) {
      rocks.splice(i, 1)
      continue
    }
    if (r.y > anchorY + 6) continue

    if (!r.passage) {
      crushAgainst({
        x: r.x, halfW: r.w / 2, y: r.y, halfH: ROCK_H / 2,
        cause: 'barricade'
      })
      continue
    }

    // The rib's OUTER faces and the length of road it spans, in one pass. Read
    // from the stones rather than assumed, exactly as `passageFit` reads the
    // corridor it funnels the crowd into — so the wall and the funnel can never
    // disagree about where the corridor is.
    wallLo = Math.min(wallLo, r.x - r.w / 2 - UNIT_R)
    wallHi = Math.max(wallHi, r.x + r.w / 2 + UNIT_R)
    lo = Math.min(lo, r.y - ROCK_H / 2 - UNIT_R)
    hi = Math.max(hi, r.y + ROCK_H / 2 + UNIT_R)
    // Where the cut reads from: the stone the crowd is standing at, not the
    // middle of a rib that runs off the top of the screen.
    if (ribs === 0 || Math.abs(r.y - anchorY) < Math.abs(nearestY - anchorY)) nearestY = r.y
    ribs++
  }

  // Clear of the rib entirely: the next passage is a fresh decision.
  if (ribs === 0) {
    passageSide = 0
    return
  }

  const ribX = (wallLo + wallHi) / 2
  // Has the crowd actually reached the stone? The rib is laid along the road, so
  // the question is whether anybody's DEPTH is inside its span — a crowd still
  // walking up to the mouth is choosing, and must not be committed early.
  let reached = false
  for (const u of units) {
    if (u.dying > 0) continue
    if (u.y >= lo && u.y <= hi) { reached = true; break }
  }
  if (!reached) return

  if (passageSide === 0) passageSide = enterPassage(ribX, nearestY)
  holdCorridor(passageSide, wallLo, wallHi, lo, hi)
}

/**
 * The crowd has just reached a rib. Decide which corridor it is in — cutting it
 * on the stone if it is in both — and return the side it now owns.
 *
 * The sides are counted over the WHOLE crowd rather than over the bodies in
 * contact with a stone: a crowd is at most `CROWD_MAX_R` across however many
 * thousand are in it, so "which corridor is the crowd in" is a fair question to
 * ask of all of them, and asking it of the handful currently touching stone
 * would make the answer a coin toss decided by the spring's jitter.
 *
 * @returns -1 for the left corridor, 1 for the right. Never 0.
 */
const enterPassage = (ribX: number, ribY: number): -1 | 1 => {
  let left = 0
  let right = 0
  for (const u of units) {
    if (u.dying > 0) continue
    if (u.x < ribX) left++
    else right++
  }

  // Ties break toward the corridor the thumb is pointing at — the same one
  // `passageFit` has already been squeezing the formation into.
  const keepLeft = left === right ? targetX < ribX : left > right

  // Came in down ONE corridor: nothing to cut, and committing early is free.
  // That is the entire reward the passage is teaching.
  if (left === 0 || right === 0) return keepLeft ? -1 : 1

  // ── The rib's cut is a blow, and the biggest one the road can throw ──
  //
  // It takes the whole of the smaller column in one stroke, with no budget and
  // no cap — a crowd split down the middle loses half of itself at a stone it
  // arrived at straddling. It is also exactly countable before it happens: the
  // side to keep has already been decided above, so the victim set is the other
  // side, and its size is the count that was taken to decide it.
  //
  // Absorbed, the crowd is not cut at all; `holdInPassage` then squeezes the
  // survivors on the wrong side into the corridor the run committed to, which is
  // the same thing it does for everybody else. No `divider` flash either — the
  // pickup's own burst is the story of the frame, and two "a solid thing just
  // hurt you" cues firing at once when nothing was hurt is a lie.
  if (bulwarkAbsorb(keepLeft ? right : left, ribX, ribY)) return keepLeft ? -1 : 1

  for (const u of units) {
    if (u.dying > 0) continue
    const onLeft = u.x < ribX
    if (onLeft === keepLeft) continue
    // Flung AWAY from the stone, so the loss reads as the crowd being split on
    // it rather than as a column quietly going missing.
    killUnit(u, onLeft ? -1 : 1, 'barricade')
  }
  // Borrowed from the gate pillar, which is the same event with a different
  // shape: a solid, non-enemy thing just took survivors, and the player has one
  // frame to understand that.
  pushFx({ kind: 'divider', x: ribX, y: ribY })
  return keepLeft ? -1 : 1
}

/**
 * Hold every survivor inside the corridor the crowd committed to.
 *
 * A HARD CLAMP against the rib's outer face, for the whole length of road the
 * rib spans, and it has to be a clamp rather than the impulse every other solid
 * in the game uses. The impulse pushes a body out of the stone it is inside, to
 * the side of that stone it is currently on — which is a barrier only while
 * nothing moves far enough in one frame to appear on the far side. A hard swipe
 * moves the anchor ~0.7 of a unit per frame against a rib 1.2 wide, so a body
 * routinely crossed the centre line between two frames and was then helpfully
 * ejected into the corridor it had just been cut out of: measured, twenty-five
 * survivors changed sides four frames after a swerve. The stone stopped being a
 * commitment and the whole passage stopped limiting anything.
 *
 * The clamp cannot be tunnelled because it never asks where the body came from.
 * The side is decided ONCE, when the crowd reaches the rib (`enterPassage`), and
 * every survivor inside the rib's span is held on it until the rib is past.
 *
 * The UNIT moves and the anchor never does, so the player's steering stays
 * authoritative — steer into the far corridor and the crowd squeezes along the
 * wall for as long as the wall lasts, which is precisely the decision window the
 * passage exists to charge for.
 */
const holdCorridor = (
  side: -1 | 1 | 0, wallLo: number, wallHi: number, lo: number, hi: number
): void => {
  if (side === 0) return
  const face = side < 0 ? wallLo : wallHi
  for (const u of units) {
    // The dying tumble out of the crowd on their own arc; a corpse held against
    // a wall reads as a body stuck in the scenery.
    if (u.dying > 0) continue
    if (u.y < lo || u.y > hi) continue
    if (side < 0 ? u.x <= face : u.x >= face) continue
    // Clamped to the road as well, so a rib near a rail squeezes the crowd along
    // the barrier rather than pushing survivors over it.
    u.x = Math.max(-EDGE_X, Math.min(EDGE_X, face))
  }
}

/**
 * Burn the fuses and blow what is ready.
 *
 * The blast is the point of the whole prop: a flat fraction of the boss's MAX
 * health, so it stays meaningful at every depth, and it lands THROUGH the
 * shield. It also clears the arena's escort — a barrel that killed the boss's
 * bodyguards but not the boss reads exactly right, and it gives a player who
 * cannot out-damage the boss a way to at least clear the room.
 */
const stepBarrels = (dt: number): void => {
  for (let i = barrels.length - 1; i >= 0; i--) {
    const bl = barrels[i]!
    if (bl.dead) { barrels.splice(i, 1); continue }
    if (bl.fuse < 0) continue

    bl.fuse += dt * 1000
    if (bl.fuse < BARREL_FUSE_MS) continue

    bl.dead = true
    pushFx({ kind: 'barrelBlast', x: bl.x, y: bl.y })

    if (boss && !boss.dead) {
      const dx = boss.x - bl.x
      const dy = boss.y - bl.y
      if (Math.hypot(dx, dy) <= BARREL_BLAST_R + boss.scale) {
        damageBoss(boss, boss.maxHp * BARREL_BLAST_BOSS_FRACTION, true)
      }
    }
    for (const f of foes) {
      if (f.dead) continue
      if (Math.hypot(f.x - bl.x, f.y - bl.y) > BARREL_BLAST_R) continue
      // Whatever is standing in the blast dies outright. An escort that survived
      // a stick of TNT would make the prop feel like a firework.
      damageFoe(f, f.maxHp)
    }
    // Chain reaction: a barrel inside the blast lights rather than detonating,
    // so a row goes off as a rolling sequence the player can watch instead of
    // one frame of everything.
    for (const other of barrels) {
      if (other === bl || other.dead || other.fuse >= 0) continue
      if (Math.hypot(other.x - bl.x, other.y - bl.y) > BARREL_BLAST_R) continue
      other.fuse = 0
      pushFx({ kind: 'barrelLit', x: other.x, y: other.y })
    }
  }
}

/**
 * Crates are obstacles too.
 *
 * An unbroken crate kills whoever runs into it, which turns "should I detour
 * for the rate crate?" into a real question: you either shoot it down in time
 * or you go around it. Previously they were scenery you could walk through,
 * and a free stat nobody had to earn.
 */
const stepCrates = (dt: number): void => {
  for (let i = crates.length - 1; i >= 0; i--) {
    const c = crates[i]!
    c.spin += dt * 0.4
    if (c.dead || c.y < anchorY - 6) {
      crates.splice(i, 1)
      continue
    }
    if (c.y > anchorY + 6) continue

    // The gentlest of the three: a crate is a REWARD the player was invited to
    // chase, and one that punished the attempt as hard as a wall would simply
    // teach them to stop chasing rewards.
    grindAgainst(c.id, {
      x: c.x, halfW: CRATE_R, y: c.y, halfH: CRATE_R,
      cause: 'crate'
    }, 0.12, dt)
  }
}

/**
 * Rescue cages.
 *
 * Identical to `stepCrates` in every rule it applies, and that is deliberate
 * rather than lazy: the two props are the same PROMISE to the player — a thing
 * on the shoulder that pays if you can shoot it and costs a little if you drive
 * into it — and the moment one of them punished contact harder than the other,
 * the player would have to learn which box was which before deciding whether a
 * detour was safe. They do not have a quarter of a second for that.
 *
 * `cause: 'crate'` for the same reason. `DeathCause` is a vocabulary the result
 * screen and the balance harness both read, and "I died on a pickup I was
 * driving at" is one idea; a new cause here would make every historical reading
 * of `deaths.crate` mean something slightly different from the next one.
 */
const stepCages = (dt: number): void => {
  for (let i = cages.length - 1; i >= 0; i--) {
    const c = cages[i]!
    // Decayed at the barricade's rate, not the crate's: a cage does not tumble,
    // it RINGS — the shake has to settle between rounds or a cage under
    // sustained fire is a permanent blur instead of a thing being hit.
    if (c.flash > 0) c.flash = Math.max(0, c.flash - dt * 5)
    if (c.dead || c.y < anchorY - 6) {
      cages.splice(i, 1)
      continue
    }
    if (c.y > anchorY + 6) continue

    grindAgainst(c.id, {
      x: c.x, halfW: CAGE_R, y: c.y, halfH: CAGE_R,
      cause: 'crate'
    }, 0.12, dt)
  }
}

/** The auto-shield box. Same contact terms as a crate; see `stepCages`. */
const stepBulwarks = (dt: number): void => {
  for (let i = bulwarks.length - 1; i >= 0; i--) {
    const w = bulwarks[i]!
    // A slow idle turn on the plate inside the housing. It exists because an
    // armed pickup standing alone on a shoulder with nothing else near it reads
    // as scenery, and scenery does not get driven at.
    w.spin += dt * 1.1
    if (w.dead || w.y < anchorY - 6) {
      bulwarks.splice(i, 1)
      continue
    }
    if (w.y > anchorY + 6) continue

    grindAgainst(w.id, {
      x: w.x, halfW: BULWARK_R, y: w.y, halfH: BULWARK_R,
      cause: 'crate'
    }, 0.12, dt)
  }
}

/**
 * Scatter loose coins where something broke.
 *
 * They land as real pickups rather than being credited directly, so the drop
 * has to be *collected* — which is the whole point now that the magnet is short
 * (see `COIN_MAGNET_BASE`). Shooting a wall down and then driving around the
 * debris should leave money on the road.
 */
const spillCoins = (x: number, y: number, min: number, max: number): void => {
  const n = min + Math.floor(Math.random() * (max - min + 1))
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.6
    pickups.push({
      id: entityId++,
      // Spread just wide enough to read as a scatter and stay inside the lane.
      x: Math.max(-LANE_HALF + 0.4, Math.min(LANE_HALF - 0.4, x + Math.cos(a) * (0.4 + Math.random() * 0.5))),
      y: y + Math.sin(a) * (0.3 + Math.random() * 0.4),
      value: 1,
      taken: false,
      phase: Math.random() * Math.PI * 2
    })
  }
}

/**
 * Coins.
 *
 * The magnet is bought, not given. It used to reach `crowdRadius + 3.6`, which
 * on a nine-unit lane is most of the road: every coin on the stage arrived no
 * matter where the crowd stood, and the curved trails the generator lays down
 * were scenery. Now the base reach sits just outside the crowd's own body — the
 * player drives the trail — and `coinMagnetBonus` is what the Scavenging track
 * actually sells. See its note in `useUpgrades`.
 */
const stepPickups = (dt: number): void => {
  const magnet = crowdRadius() + COIN_MAGNET_BASE + coinMagnetBonus.value
  // The pull field extends past the collection radius so a coin that is going
  // to be taken visibly leaps at the crowd first. Scaled with the magnet, so an
  // upgraded player sees their reach as well as banking it.
  const reach = magnet + COIN_PULL_LEAD + coinMagnetBonus.value * 0.5
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i]!
    p.phase += dt * 4
    if (p.taken || p.y < anchorY - 5) {
      pickups.splice(i, 1)
      continue
    }
    const dx = anchorX - p.x
    const dy = anchorY - p.y
    const d = Math.hypot(dx, dy)
    if (d > reach) continue
    // Coins are pulled in rather than collided with. A near-miss that snaps
    // into the crowd feels generous; a near-miss that does nothing feels like
    // the game cheated you.
    const pull = Math.min(1, (reach - d) / Math.max(0.5, reach - magnet)) * 9 * dt
    p.x += dx * pull * 0.4
    p.y += dy * pull * 0.4
    if (d < magnet) {
      p.taken = true
      runCoins.value += p.value
      pushFx({ kind: 'coin', x: p.x, y: p.y, value: p.value })
    }
  }
}

/**
 * The boss.
 *
 * One body, one telegraph, one punish. It walks in, holds just ahead of the
 * crowd, and every couple of seconds it commits to something — but it commits
 * where the CROWD IS, not where it is standing. The target is locked when the
 * telegraph starts (`SLAM_TELEGRAPH` seconds before impact, or the kind's own
 * window) and painted on the ground, so the fight is a dodge with a fair warning
 * rather than a coin toss.
 *
 * The first version slammed under its own feet, four units ahead of a crowd
 * whose radius is under two — so the attack literally could not reach anybody
 * and the boss fight was a damage race with no failure state.
 *
 * What it commits TO is the kind (`BossKind`): a meteor drops a ring, a claw
 * rakes three furrows, a healer throws a bolt or puts its own bar back up, and a
 * summoner does not attack at all. Below, `meteor` is the path that must not
 * change — every other kind branches away from it and back.
 */
/**
 * How long the slam is telegraphed before it lands.
 *
 * 1.0 s, not the 0.62 first shipped, and the reason is a measurement rather
 * than a feeling. Holding routing and aim constant and moving ONLY the player's
 * reaction latency, stage 2 clear rate went 100 % at 150 ms and 0 % at 250 ms —
 * and median human simple visual reaction time is ~250 ms. The telegraph was
 * tuned to just past the point a human can use it, so the boss was not a skill
 * test, it was a reflex threshold.
 *
 * The dodge is a 3.4-unit move (`SLAM_RADIUS` + `CROWD_MAX_R`). At 0.62 s a
 * 250 ms player had 0.37 s to make it; at 1.0 s they have 0.75 s — the margin a
 * 150 ms player used to have to themselves.
 */
export const SLAM_TELEGRAPH = 1.0
/**
 * Slam footprint.
 *
 * MUST stay well under the crowd's own radius (1.9). At 2.9 the ring covered
 * the entire squad, so every slam that connected was a total wipe and the boss
 * fight had exactly two outcomes: kill it before it swings twice, or lose
 * everything. Measured across stages 1–5 with a non-dodging player: 21–51
 * survivors lost to a single slam, every run, on every stage.
 *
 * It lives in `survival.ts` with the rest of the slam numbers because the
 * telegraph ring has to be drawn from the same value the kill is measured
 * against — see `SLAM_RADIUS_GROWTH`.
 */
/** How far ahead of the crowd the boss plants itself. Close enough that its
 *  slam reaches, far enough that its body never covers the crowd. */
const BOSS_HOLD_AHEAD = 3.8

// Phase two's own state is declared with `boss` at the top of the file — see the
// block there for what a latch on a guard gate buys and why it is not a field on
// `Boss`. These two are its public face, and they are the whole of it: nothing
// outside this module writes phase two, and nothing outside it needs more than
// "is the fight turned over" and "is a charge on the road right now".

/** Is the boss in phase two? For the renderer's colour shift. */
export const bossIsEnraged = (): boolean => bossEnraged && boss !== null && !boss.dead
/** …and is it winding up or running a lane charge right now? Read by the
 *  renderer to hold back the meteor's slam ring, which describes a disc and
 *  would point at the middle of the one column the player must leave. */
export const bossIsCharging = (): boolean => bossCharging && boss !== null && !boss.dead

/**
 * ─── One boss, four fights ──────────────────────────────────────────────────
 *
 * Every kind shares the same skeleton — walk in, hold ahead of the crowd, wind
 * up, resolve — and owns exactly one branch of the wind-up and one of the
 * resolve. Nothing below reaches into another kind's scratch: `slams` and
 * `charging` belong to the meteor and the claw, `attacks` to the healer and the
 * summoner, `summonCd` to the summoner alone.
 *
 * The split is by KIND rather than by a parameterised "attack", because the four
 * differ in shape and not in degree: a ring, three strips, a projectile and a
 * spawn have no common footprint to parameterise. Branching on the kind also
 * keeps the meteor's path a straight read of what it always was, which is what
 * a 24-run before/after fingerprint over stages 1-3 and 5 confirms it still is.
 */
const stepBoss = (dt: number): void => {
  const b = boss
  if (!b) return
  if (b.flash > 0) b.flash = Math.max(0, b.flash - dt * 4)
  b.phase += dt

  // Stepped BEFORE the death check, so a bolt already in the air when the healer
  // falls over still lands or leaves: a hit that vanished mid-flight would be
  // the game taking back a threat it had already shown, which teaches the player
  // to stop reading them. It stops at the end of the RUN rather than at the end
  // of the boss — see the guard in `stepBossBolts`.
  if (bossBolts.length > 0) stepBossBolts(dt)

  if (b.dead) {
    b.dying += dt * 1000
    if (b.dying > 900 && phase.value === 'boss') finishRun(true)
    return
  }

  // A charge owns the body for the whole of its wind-up, guarded or not — the
  // gate that turns the fight arms the first one, so the boss is still immune
  // while it runs. It replaces the walk-in rather than sitting inside it: the
  // walk-in is what pulls the boss back to its hold position, and a charge
  // fighting the hold every frame would never leave the line it started on.
  //
  // Asked as `aimed` and not merely `bossCharging`, because the charge's
  // geometry is written by `aimBoss` further down and does not exist until it
  // has run — acting on the frame between arming and locking would drive the
  // body down the PREVIOUS charge's column.
  if (bossCharging && b.aimed) stepBossCharge(b)
  // Walk into the arena, then hold the line just ahead of the crowd. A guarded
  // boss is planted — it has stopped chasing and is committing to the swing.
  else if (b.guard <= 0) {
    const holdY = anchorY + BOSS_HOLD_AHEAD
    if (b.y > holdY) b.y = Math.max(holdY, b.y - b.speed * dt)
    else b.y += (holdY - b.y) * Math.min(1, dt * 1.4)

    // Track the crowd slowly — slowly enough that a player who keeps moving is
    // never cornered, which is the skill the fight tests.
    b.x += Math.max(-1.1 * dt, Math.min(1.1 * dt, (anchorX - b.x) * dt * 1.6))
    b.x = Math.max(-LANE_HALF + 1, Math.min(LANE_HALF - 1, b.x))
  }

  // The summoner has no attack, so it never touches the wind-up clock at all —
  // not even to leave it running. Its whole behaviour is a budget and a timer.
  if (b.kind === 'summoner') {
    stepSummoner(b, dt)
    return
  }

  b.slamCd -= dt
  // Runs on the same clock as the wind-up and for every kind, so it is never
  // stale when a healer reads it. Only the healer ever does.
  if (b.healCd > 0) b.healCd = Math.max(0, b.healCd - dt)

  // ── The heal's gap, as an INVARIANT rather than a prediction ──
  //
  // `healCastDue` decides one cycle ahead, and a decision about the future is
  // only as good as the clock it was made against: a guard phase re-arms the
  // cycle at `bossTelegraph` (0.7 s) instead of a cast (1.7 s), and the heal
  // armed against the longer fuse landed a second early — measured at 9.71 s
  // against a 10 s floor.
  //
  // Patching each site that re-times a cycle is the version of this fix that
  // rots: it is correct until the next one is added, and the failure it produces
  // is a rare, run-dependent broken promise rather than anything that shows up
  // in a diff. So the question is asked continuously instead, in the one place
  // that owns the clock. `healCd` and `slamCd` drain at the same rate, so the
  // comparison is invariant under time passing and can only trip when something
  // has moved one without the other — exactly the bug class, and nothing else.
  //
  // Revoking here rather than at the moment the cast fires is what keeps the
  // telegraph honest: the wind-up is still being drawn, so the player sees the
  // tell change to a bolt and gets the bolt.
  // `slamCd` is compared through a floor of zero, and `healCd` has to be over it
  // rather than merely equal: the cast resolves on the tick `slamCd` goes
  // NEGATIVE, and a bare `healCd > slamCd` is therefore true for a paid-off gap
  // (0 > -0.004) on exactly that tick — which revoked every heal in the game.
  if (b.kind === 'healer' && b.charging && b.healCd > Math.max(0, b.slamCd)) b.charging = false

  // Lock the target at the START of the telegraph, on the crowd's own position
  // plus a small lead. Locking early is what makes it dodgeable; aiming at the
  // crowd rather than at the boss's feet is what makes it hit.
  //
  // Asked as "have I aimed for this swing yet", NOT as "did the cooldown just
  // cross the telegraph" — see `Boss.aimed`. The crossing stops happening once
  // rage pulls the cadence below the window, and the boss then spends the rest
  // of the fight slamming the last place it aimed at.
  //
  // A CHARGE is aimed the instant its cycle opens, whatever the window says.
  // That is not an exception to the rule above, it is the rule stated for an
  // attack whose wind-up IS the telegraph: the band goes on the road at the
  // start and the body arrives at the end of it, and a charge announced a second
  // in would give the player a fraction of the lateral move it asks for.
  if (!b.aimed && (bossCharging || b.slamCd <= bossTelegraph(b.kind))) {
    b.aimed = true
    aimBoss(b)
  }

  if (b.slamCd > 0) return

  throwBossAttack(b)
}

/**
 * The charge's body, driven off the COOLDOWN rather than off a speed.
 *
 * The contract every cast in this game signs is that the tell carries the exact
 * seconds to impact. A charge is the one attack whose second half is the
 * attacker itself moving, so the body has to be a pure function of the same
 * clock the cast was handed — integrate a speed instead and the boss arrives on
 * a beat that drifts by whatever the frame times did, on the one attack where
 * "it landed before the band said it would" is unanswerable.
 *
 * So position is read backwards out of `slamCd`: at `CHARGE_DASH_S` left it is
 * still at the line it started on, at zero it is exactly where it promised to
 * be, and every frame in between is on the curve. Squared rather than linear
 * because a charge that starts at full speed reads as a teleport — the coil is
 * what makes the last third of a second legible as a thing running at you.
 *
 * This runs before the frame's cooldown drain, so the body is one frame behind
 * the clock for the whole dash — 16 ms at a stride of six units, which is not
 * visible. The ARRIVAL is not left to it: `throwBossCharge` writes the final
 * position itself, so the frame the damage is billed on is the frame the body is
 * exactly where the band said it would be.
 */
const stepBossCharge = (b: Boss): void => {
  // Locked, and this is load-bearing rather than tidy: the boss otherwise keeps
  // drifting toward the crowd every frame (see the tracker in `stepBoss`), which
  // walks its body out of the band the player is reading and turns the one
  // telegraph in the game that cannot be re-read into a lie.
  b.x = bossChargeLane
  const left = Math.max(0, b.slamCd)
  if (left >= CHARGE_DASH_S) {
    b.y = bossChargeFromY
    return
  }
  const k = 1 - left / CHARGE_DASH_S
  b.y = bossChargeFromY + (bossChargeToY - bossChargeFromY) * k * k
}

/**
 * How long this kind's wind-up is.
 *
 * The healer's is shorter because its cadence is. A full second of wind-up on a
 * loop only a little longer than that leaves no frame with nothing incoming,
 * which reads as no tell at all.
 */
const bossTelegraph = (kind: BossKind): number =>
  kind === 'healer' ? HEALER_TELEGRAPH : SLAM_TELEGRAPH

/**
 * The cycle this boss runs next, phase two included.
 *
 * ONE definition, because "faster slams" is the half of phase two that is a
 * number rather than a shape, and a second copy of it is how a fight ends up
 * enraged on one path and not on another. The floor handed to `enragedSpan` is
 * the rage curve's own — phase two moves the boss down the curve it was already
 * on and is not allowed off the end of it. See `ENRAGED_CD_MUL`.
 */
const bossSpan = (b: Boss): number => {
  const raw = Math.max(SLAM_CD_MIN, SLAM_CD_BASE - b.slams * SLAM_CD_DECAY)
  return bossEnraged ? enragedSpan(raw, endlessPressure(stage.value), SLAM_CD_MIN) : raw
}

/**
 * Arm the cycle that follows a swing, and decide what shape it is.
 *
 * Every path that resolves a swing ends here — the ring, the rake and the charge
 * alike — so there is exactly one place that can be wrong about how long the
 * next wind-up is or what it is winding up. The three of them used to end with
 * their own `b.slamCd = …` line, and the charge is precisely the kind of
 * addition that leaves one of those behind.
 *
 * `!b.charging` is the tie-break and it should never fire: `CHARGE_EVERY` is
 * deliberately out of phase with `CHARGED_EVERY` (see it). It stays because the
 * consequence of the tie is not a wrong cadence, it is a charged swing whose
 * doubled ring was announced and a charge that arrives instead.
 */
const armBossCycle = (b: Boss): void => {
  bossCharging = bossEnraged &&
    bossCharges(b.kind) &&
    !b.charging &&
    (b.slams + 2) % CHARGE_EVERY === 0
  b.slamCd = bossCharging
    ? chargeWindup(b.slamSpan)
    : b.slamSpan * (b.charging ? CHARGED_WINDUP_MUL : 1)
}

/**
 * Pick the ground this cycle is aimed at, and announce it.
 *
 * The cast is pushed HERE and nowhere else on this path, so there is exactly one
 * place that can be wrong about where an attack is going: the mark, the sound
 * and the kill all read `slamX` / `slamY`, which were written on the line above.
 */
const aimBoss = (b: Boss, leadMul = 1): void => {
  if (bossCharging) {
    // ── The one attack in the game with NO lead, deliberately ──
    //
    // Every other wind-up aims a little ahead of the crowd's drift, and the
    // charged swing aims at where the crowd will BE. A charge may not, and the
    // reason is what the player has to do about it: a ring is a place to not be
    // standing and a lead punishes drifting into it, but a column is a place to
    // GET OUT OF, and leading it would move the answer while they were on their
    // way to it. `leadMul` is accepted and ignored so the guard-gate path can
    // keep calling one function for every kind.
    bossChargeLane = Math.max(-LANE_HALF + 1, Math.min(LANE_HALF - 1, b.x))
    bossChargeHalfW = chargeHalfW(b.slams)
    bossChargeFromY = b.y
    // Past the crowd's own depth, so the charge goes THROUGH the formation
    // rather than stopping in it — see `CHARGE_OVERRUN`.
    bossChargeToY = anchorY - CHARGE_OVERRUN
    // The slam pair still describes this cycle, because everything that asks the
    // boss "what are you aiming at" reads them — the HUD's incoming badge, the
    // sim tests, the renderer's own sanity checks.
    b.slamX = bossChargeLane
    b.slamY = anchorY
    pushFx({
      kind: 'chargeCast',
      x: bossChargeLane,
      y: bossChargeFromY,
      halfW: bossChargeHalfW,
      toY: bossChargeToY,
      ttl: Math.max(0.15, b.slamCd)
    })
    return
  }

  if (b.kind === 'healer') {
    // A heal is aimed at the healer itself; there is nothing on the road to
    // point at. A bolt is aimed at the crowd and then flies — the lead is small
    // because the projectile's own travel time is the real difficulty.
    b.slamX = b.charging
      ? b.x
      : Math.max(
        -LANE_HALF + 1,
        Math.min(LANE_HALF - 1, anchorX + (targetX - anchorX) * BOLT_LEAD * leadMul)
      )
    b.slamY = b.charging ? b.y : anchorY
    pushFx(
      b.charging
        ? { kind: 'healCast', x: b.x, y: b.y, ttl: Math.max(0.15, b.slamCd) }
        : { kind: 'bossBoltCast', x: b.x, y: b.y, ttl: Math.max(0.15, b.slamCd) }
    )
    return
  }

  // A charged swing aims where the crowd is GOING, not where it was — see
  // `CHARGED_LEAD`. That, and the doubled arc, is what makes it the swing a
  // player has to answer rather than drift out of. A rake never charges (see
  // `throwBossAttack`), so it always uses the ordinary lead.
  const lead = (b.kind === 'claw' ? CLAW_LEAD : b.charging ? CHARGED_LEAD : 0.35) * leadMul
  b.slamX = Math.max(-LANE_HALF + 1, Math.min(LANE_HALF - 1, anchorX + (targetX - anchorX) * lead))
  b.slamY = anchorY

  if (b.kind === 'claw') {
    // Sized from the rake that is actually coming — `b.slams` is the count
    // ALREADY thrown, so the one being wound up is the next one. Getting this
    // off by one would paint a narrower furrow than the one that kills.
    pushFx({
      kind: 'rakeCast',
      x: b.slamX,
      y: b.slamY,
      lanes: clawLaneXs(b.slamX),
      halfW: clawFurrowHalfW(b.slams + 1),
      depth: CLAW_HALF_DEPTH,
      ttl: Math.max(0.15, b.slamCd)
    })
    return
  }

  // Something falls out of the sky onto the marked ground, and it takes exactly
  // as long to get there as the swing does. The ring alone was not being seen —
  // the player is watching the boss or their own thumb, never the patch of road
  // they are about to be standing on.
  pushFx({
    kind: 'meteorCast',
    x: b.slamX,
    y: b.slamY,
    radius: slamRadiusFor(b.slams, b.charging),
    ttl: Math.max(0.15, b.slamCd),
    charged: b.charging
  })
}

/**
 * The share of the crowd one big boss attack takes.
 *
 * ONE definition for every kind, because they are all the same promise — "a hit
 * you did not dodge costs about a third of your crowd" — and a second copy of it
 * is how one archetype quietly ends up three times the others. The per-kind
 * difference is `mul`, and a `mul` is only allowed to exist where a kind's
 * CADENCE differs from the meteor's — the arithmetic and the deliberate discount
 * on top of it are both written down at `BOLT_SHARE_MUL`.
 */
const bossHitShare = (mul = 1, discount = bossSwingMul): number => (stage.value <= 1
  // The tutorial's swing is a token and stays one — the discount can make it a
  // token that lands, never one that hurts.
  ? TUTORIAL_SLAM_FRACTION * discount * mul
  : Math.min(
    // Clamped AFTER the run has been read, not before: `bossSwingMul` may push
    // above 1 for a crowd that arrived with nothing (see `HOPELESS_SLAM_MUL`),
    // and `SLAM_FRACTION_MAX` is the ceiling the design already set on what one
    // swing may take. Reading the run may not raise that ceiling.
    SLAM_FRACTION_MAX,
    SLAM_MAX_FRACTION * endlessPressure(stage.value) * slamRelief * discount
  ) * mul)

/**
 * …and the floor under it. `BOSS_MIN_KILL` intends a real hit on a thinned-out
 * crowd; it is still bounded by the shape, so nothing outside the attack is ever
 * billed for the crowd being small.
 */
const bossHitFloor = (discount = bossSwingMul): number => Math.max(1, Math.round(
  (stage.value <= 1 ? TUTORIAL_SLAM_MIN_KILL : bossMinKill(stage.value)) * discount
))

/**
 * `squad` defaults to the live crowd, which is what every real swing passes.
 *
 * It is a parameter at all for one caller: the rake, whose budgeted pass runs
 * AFTER its unbudgeted core has already thinned the squad, so pricing the whole
 * attack ahead of time (for the bulwark) has to ask what the budget WILL be
 * rather than what it is. Threading the number keeps that question answered by
 * this function instead of by a second copy of the same arithmetic.
 */
const bossHitBudget = (share: number, squad = squadCount.value): number =>
  Math.max(bossHitFloor(), Math.ceil(Math.max(0, squad) * share))

/** Resolve the cycle that just ran out. */
const throwBossAttack = (b: Boss): void => {
  b.attacks++
  b.guard = 0
  // This cycle is spent; the next one has to pick its own target. When rage has
  // pulled the cadence under the telegraph window this re-aims on the very next
  // frame, which is correct — a boss swinging faster than it can wind up is
  // simply always winding up.
  b.aimed = false

  // Checked before the kinds, because a charge is a phase-two verb bolted onto
  // whichever fight this is rather than a fifth archetype — it resolves the same
  // way, on the same clock, for every kind `bossCharges` gives it to.
  if (bossCharging) {
    throwBossCharge(b)
    return
  }

  if (b.kind === 'healer') {
    throwHealerCast(b)
    return
  }

  // Rage: every swing thrown brings the next one closer and widens it, down to
  // `SLAM_CD_MIN`. A squad that arrived big enough kills the boss in three or
  // four swings and never meets this; a squad that arrived too small is now in
  // a fight that is actively getting worse, which is the difference between
  // "slow" and "losing". The guard swing itself is free — the boss does not get
  // to rage on a phase it was handed.
  // The swing going out is the one that was wound up, so its size is read from
  // the flag set when THAT cycle began — never recomputed here, where an
  // off-by-one would make the boss throw a hit it never telegraphed.
  const charged = b.charging
  b.slams++
  b.slamSpan = bossSpan(b)

  if (b.kind === 'claw') {
    // ── Why a rake never charges ──
    //
    // `CHARGED_RADIUS_MUL` doubles a ring, and the ring is the whole attack, so
    // doubling it is fair. The equivalent for a rake is doubling the furrows,
    // which does not widen the attack — it CLOSES THE POCKETS, from 3.6 units to
    // 2.7 against a crowd 3.3 across. That converts the one attack in the game
    // whose answer is a position into one with no answer at all, every third
    // swing, for the players least able to afford it.
    //
    // The claw's escalation is `CLAW_FURROW_GROWTH` instead: the furrows fatten
    // as the fight drags, which tightens the window to reach a pocket without
    // ever removing the pocket. `CLAW_SPACING` is derived from the fattest
    // furrow precisely so that stays true.
    b.charging = false
    armBossCycle(b)
    throwRake(b)
    return
  }

  // Every third swing, and the wind-up stretches to pay for the size of it.
  b.charging = (b.slams + 1) % CHARGED_EVERY === 0
  armBossCycle(b)
  const radius = slamRadiusFor(b.slams, charged)

  pushFx({ kind: 'bossSlam', x: b.slamX, y: b.slamY, radius, charged })
  // The retry relief scales the SLAM as well as enemy health. Health alone did
  // nothing measurable — 14 of 15 simulated retries moved the clear rate by
  // exactly zero — because 68–80 % of a failing run's losses are slams, which
  // no amount of enemy HP relief ever touches.
  let budget = bossHitBudget(bossHitShare())
  // The ring is drawn either way — the boss swung, and a swing the player did
  // not dodge should look like a swing they did not dodge. What changes is that
  // it lands on the dome. The share a slam takes is 20–50 % of the crowd, so any
  // slam that connects at all is comfortably over the threshold: this is the
  // blow the pickup is bought for, and the reason its box is authored in the
  // last quarter of the road.
  if (absorbedBlow(budget, b.slamX, b.slamY, (u) => {
    const dx = u.x - b.slamX
    const dy = u.y - b.slamY
    return dx * dx + dy * dy <= radius * radius
  })) return
  for (const u of units) {
    if (budget <= 0) break
    if (u.dying > 0) continue
    const dx = u.x - b.slamX
    const dy = u.y - b.slamY
    if (dx * dx + dy * dy > radius * radius) continue
    killUnit(u, Math.sign(dx), 'slam')
    budget--
  }
}

/**
 * The lane charge: phase two's verb.
 *
 * A column, not a disc, and that is the whole design. The ring asks "are you
 * near this point" and a crowd answers it by scattering; the rake asks "which
 * pocket" and a crowd answers it by committing to a side. Both of those are
 * questions about the road AHEAD of the boss. This one is the boss coming down
 * the road THROUGH where the crowd is standing, and the only answer is to have
 * already left the column — which is why it is the move the fight had no version
 * of, and why it is what phase two is for.
 *
 * ── The kill is the column, in x only ──
 *
 * Not the swept rectangle, and the difference is the third of the crowd that
 * lives behind the formation's centre. `CHARGE_OVERRUN` puts the body's stop
 * past the crowd's own depth so the sweep does cover them, but tying the kill to
 * the body's stopping point makes a positioning number quietly into a damage
 * number — nudge the overrun for how the recovery reads and a slice of the crowd
 * silently stops being billed. The attack is a lane, so the test is the lane, and
 * the stopping point is free to be about the animation.
 *
 * The upper bound is the boss's own start line: nothing ahead of where the
 * charge began was ever in front of it. In practice the crowd is never up there
 * — it is the guarantee that matters, not the case.
 *
 * ── …and it is priced at exactly one slam ──
 *
 * Same `bossHitShare`, no multiplier, no unbudgeted core (the rake has one; a
 * rake is three thin strips and needs a middle that means it). Phase two is a
 * change of SHAPE and TEMPO, not a second damage number — a charge replaces the
 * cycle it arrives on rather than adding to it, so the fight gets a new question
 * without the budget quietly gaining an attack.
 */
const throwBossCharge = (b: Boss): void => {
  bossCharging = false
  // It counts as a swing, because it is one: the rage curve, the ring's growth
  // and the charged swing's every-third are all keyed to `slams`, and a charge
  // that did not increment it would let an enraged boss stand still on the curve
  // for as long as it kept charging.
  b.slams++
  // Hand the charged swing's schedule back, exactly as the meteor's own path
  // would have.
  //
  // This line was a bare `b.charging = false` first, and it silently deleted the
  // charged swing from the second half of every meteor fight. The charge resolves
  // on the cycles `slams ≡ 2 (mod 3)` — which are precisely the cycles that
  // decide whether the NEXT one is charged — so with nothing re-arming it here
  // the decision was never taken again, and an enraged meteor threw charges and
  // ordinary slams and nothing else. Measured at zero charged swings across a
  // held-open fight; `CHARGE_EVERY`'s offset was doing its job and this was
  // undoing it one line later.
  //
  // The claw still never charges. That is the kind's rule, so it is read off the
  // kind rather than inherited from whichever branch happened to arrive here.
  b.charging = b.kind === 'meteor' && (b.slams + 1) % CHARGED_EVERY === 0
  b.slamSpan = bossSpan(b)
  armBossCycle(b)
  // The body ends where it promised to end, whatever the frame times did on the
  // way — `stepBossCharge` drives it off the same clock, and this is the frame
  // that clock ran out on.
  b.x = bossChargeLane
  b.y = bossChargeToY

  pushFx({
    kind: 'bossCharge',
    x: bossChargeLane,
    y: bossChargeToY,
    halfW: bossChargeHalfW,
    fromY: bossChargeFromY
  })

  let budget = bossHitBudget(bossHitShare())
  // Same lane test the kill loop uses, not the swept rectangle — see the note
  // above on why the kill is the column. The pickup has to price the attack the
  // sim actually resolves, or it would veto a charge on bodies the charge was
  // never going to bill.
  if (absorbedBlow(
    budget, bossChargeLane, bossChargeToY,
    (u) => u.y <= bossChargeFromY && Math.abs(u.x - bossChargeLane) <= bossChargeHalfW
  )) return
  for (const u of units) {
    if (budget <= 0) break
    if (u.dying > 0) continue
    if (u.y > bossChargeFromY) continue
    if (Math.abs(u.x - bossChargeLane) > bossChargeHalfW) continue
    // Flung out of the lane rather than away from a point: the charge came down
    // the column, so the bodies it took leave sideways. `|| 1` keeps a survivor
    // standing exactly on the centre line from a zero-length fling, which reads
    // as a body that died of nothing.
    killUnit(u, Math.sign(u.x - bossChargeLane) || 1, 'slam')
    budget--
  }
}

/**
 * The claw's rake: three lethal gouges with two pockets between them.
 *
 * Billed under `slam`, deliberately. `DeathCause` is a vocabulary the result
 * screen and the balance harness both read, and "the boss's big attack" is one
 * idea whichever shape it arrives in — splitting it would make `slamsConnected`
 * mean "connected, on the stages that field a meteor", which is a metric that
 * silently measures less the more kinds there are.
 */
const throwRake = (b: Boss): void => {
  const halfW = clawFurrowHalfW(b.slams)
  const lanes = clawLaneXs(b.slamX)
  pushFx({ kind: 'bossRake', x: b.slamX, y: b.slamY, lanes, halfW, depth: CLAW_HALF_DEPTH })

  // Priced at exactly a slam's share, and the arithmetic works out because the
  // SHAPES are the same size: a slam's ring (1.75, growing) swallows a crowd of
  // radius 1.65 whole, so it can spend its whole budget; a rake's middle furrow
  // covers about 30 % of that same disc, so it spends about 30 % of the crowd.
  // Both come to "roughly a third of everyone" on a crowd that did not move,
  // and to nothing at all on one that did.
  // ── The core, first and without a budget ──
  //
  // Down the middle quarter of each gouge the claw is THROUGH the crowd, not
  // across it, and everything there dies (see `CLAW_CORE_FRACTION`). Run before
  // the budgeted pass so a graze can never spend the allowance on units the
  // core was going to take anyway — `killUnit` sets `dying`, so the pass below
  // skips them and bills only what the outer strip actually cost.
  const coreHalfW = clawCoreHalfW(halfW)

  // ── Both furrows, priced as ONE blow ──
  //
  // A rake is two passes with different rules — an unbudgeted core and a
  // budgeted outer strip — but it is one swing, and the player who eats it eats
  // all of it. Absorbing only the half that happened to be measured would be the
  // worst possible reading of a pickup that promises to stop the next big hit.
  //
  // The outer budget is asked against the crowd the core WOULD have left, which
  // is what the live pass reads a moment later — `killUnit` has run by then.
  if (bulwarkArmed) {
    let core = 0
    let wide = 0
    for (const u of units) {
      if (u.dying > 0) continue
      if (Math.abs(u.y - b.slamY) > CLAW_HALF_DEPTH) continue
      if (!inClawFurrow(u.x, lanes, halfW)) continue
      wide++
      if (inClawFurrow(u.x, lanes, coreHalfW)) core++
    }
    const outer = Math.min(
      bossHitBudget(bossHitShare(), squadCount.value - core),
      wide - core
    )
    if (bulwarkAbsorb(core + outer, b.slamX, b.slamY)) return
  }

  for (const u of units) {
    if (u.dying > 0) continue
    if (Math.abs(u.y - b.slamY) > CLAW_HALF_DEPTH) continue
    if (!inClawFurrow(u.x, lanes, coreHalfW)) continue
    killUnit(u, Math.sign(u.x - b.slamX) || 1, 'slam')
  }

  let budget = bossHitBudget(bossHitShare())
  for (const u of units) {
    if (budget <= 0) break
    if (u.dying > 0) continue
    if (Math.abs(u.y - b.slamY) > CLAW_HALF_DEPTH) continue
    if (!inClawFurrow(u.x, lanes, halfW)) continue
    killUnit(u, Math.sign(u.x - b.slamX) || 1, 'slam')
    budget--
  }
}

/**
 * Is the `n`-th cast of a healer's fight the heal?
 *
 * Three conditions, and the last two are the whole safety of the archetype: past
 * `HEAL_MAX_CASTS` the cycle falls through to a bolt, so a fight that goes long
 * stops regenerating instead of never ending. See `HEAL_MAX_CASTS`.
 *
 * `healCd` is the gap still owed since the last heal, and it is compared against
 * `leadS` — the time until the cast being armed actually LANDS — rather than
 * against zero, because of WHEN this is asked: the answer arms a cast in the
 * future, so the question is "will the gap be paid off by the time it arrives",
 * not "is it paid off yet". Asked against zero, every heal would land a full
 * cycle late.
 *
 * The lead is a PARAMETER and not `HEALER_CAST_CD`, because it is not always a
 * cast: a guard phase re-arms the cycle at `bossTelegraph` (0.7 s against a
 * cast's 1.7 s) and the heal armed against the longer fuse then landed a second
 * early — measured at 9.71 s against a 10 s floor. Whoever shortens the clock
 * has to re-ask this question with the clock they actually set.
 */
const healCastDue = (n: number, healCd: number, leadS: number): boolean =>
  n % HEAL_EVERY === 0 &&
  Math.floor(n / HEAL_EVERY) <= HEAL_MAX_CASTS &&
  healCd <= leadS

const throwHealerCast = (b: Boss): void => {
  const healing = b.charging
  // ── The healer's cadence is NOT phase two's to touch ──
  //
  // It was, for one revision, and the archetype came apart. `enragedSpan` pulled
  // this loop from 1.7 s to 1.19, and the measured result was a fight where BOTH
  // answers lost almost everything: over five runs of the spec that pins the
  // bolt as answerable, a crowd that steered off the line lost 82–100 % against
  // a stationary crowd's 38–100 %, flipping which one "won" from run to run. The
  // dodge had not got worse — the fight's total lethality had risen until the
  // dodge was worth less than the seed.
  //
  // Both halves of why are written down two files away, in the constants that
  // read this one as an INPUT:
  //
  //   • `BOLT_SHARE_MUL` is 0.6 because "a bolt on two casts in every three of a
  //     1.7 s loop — one every 2.55 s". It is a per-second price with the cadence
  //     substituted in. Shortening the loop by 30 % re-prices the bolt by 43 %
  //     without anybody editing the number that prices it, and its own note names
  //     the consequence: the fight gets longer, so more bolts land, so the crowd
  //     shrinks, so the fight gets longer.
  //   • `HEAL_MIN_GAP_S` exists because "anything that shortens the cadence
  //     shortens the gap with it" — it was added to undo a guard gate doing
  //     exactly what phase two was doing here.
  //
  // So the rule this leaves behind, and the one `enragedSpan`'s callers are
  // chosen by: a cycle may be tightened only where its COST is not derived from
  // its own length. A slam's is not — `bossHitShare` is a share per hit, and the
  // rage curve already varies the cadence across a fight inside an explicit
  // envelope. A bolt's is. The healer's phase two is the colour and the sound,
  // and that is not a smaller feature, it is the one that does not quietly
  // re-tune the archetype whose whole promise is that the bolt is answerable.
  b.slamSpan = HEALER_CAST_CD
  b.slamCd = HEALER_CAST_CD
  // Decide the NEXT cycle now, while it is beginning, for the same reason the
  // meteor decides its charged swing here: the telegraph is drawn from this flag
  // and it must never describe a different cast than the one that arrives.
  //
  // A heal going out THIS cast starts its gap below, after this line — so the
  // cooldown handed to the decision is the one that cast is about to set, not
  // the one still on the boss. Read off `b.healCd` instead and a healer would
  // wave its own next heal through on a gap it had not started yet.
  b.charging = healCastDue(b.attacks + 1, healing ? HEAL_MIN_GAP_S : b.healCd, HEALER_CAST_CD)

  if (healing) {
    const before = b.hp
    b.hp = Math.min(b.maxHp, b.hp + b.maxHp * HEAL_FRACTION)
    bossHp01.value = Math.max(0, b.hp / b.maxHp)
    // The gap is counted from the heal LANDING, which is here — not from the
    // cast being armed, which is a cycle earlier and would shorten every gap by
    // `HEALER_CAST_CD`.
    b.healCd = HEAL_MIN_GAP_S
    pushFx({ kind: 'bossHeal', x: b.x, y: b.y, amount: b.hp - before, hp01: bossHp01.value })
    return
  }

  // A bolt is launched at the ground the wind-up marked and then flies straight.
  // No homing: the crowd is stationary during the boss phase, so a bolt that
  // corrected would be undodgeable, and undodgeable is not the same as slow.
  //
  // Its velocity is a TIME rather than a speed (`BOLT_FLIGHT_S`): the boss is
  // anywhere between twelve and six units out depending on how far it has walked
  // in, and a fixed speed made the dodge window vary threefold on a variable the
  // player cannot see. See the note on `BOLT_FLIGHT_S`.
  const dx = b.slamX - b.x
  const dy = b.slamY - b.y
  bossBolts.push({
    id: entityId++,
    x: b.x,
    y: b.y,
    vx: dx / BOLT_FLIGHT_S,
    vy: dy / BOLT_FLIGHT_S,
    life: BOSS_BOLT_LIFE,
    radius: BOLT_BLAST_R
  })
}

/**
 * Move the healer's bossBolts and let them go off on whoever they reach.
 *
 * A bolt that reaches nothing costs nothing — it leaves the bottom of the arena
 * and is dropped. That is what makes it a dodge rather than a delayed tax.
 */
const stepBossBolts = (dt: number): void => {
  // The run is over: drop whatever is still in the air rather than letting it
  // land. `stepBoss` keeps ticking through the boss's death animation, and a
  // bolt that went off after the stage was won would take survivors off a result
  // screen the player is already reading.
  if (phase.value !== 'boss') {
    bossBolts.length = 0
    return
  }
  for (let i = bossBolts.length - 1; i >= 0; i--) {
    const p = bossBolts[i]!
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.life -= dt
    if (p.life <= 0 || p.y < anchorY - 2.5 || Math.abs(p.x) > LANE_HALF + 1.5) {
      bossBolts.splice(i, 1)
      continue
    }
    // One distance test against the crowd's own disc before scanning bodies —
    // the squad cap is four thousand and a bolt spends most of its flight
    // nowhere near any of them.
    if (Math.abs(p.y - anchorY) > CROWD_MAX_R + BOLT_HIT_R + 1.4) continue

    let struck = false
    for (const u of units) {
      if (u.dying > 0) continue
      const dx = u.x - p.x
      const dy = u.y - p.y
      if (dx * dx + dy * dy <= BOLT_HIT_R * BOLT_HIT_R) { struck = true; break }
    }
    if (!struck) continue

    pushFx({ kind: 'bossBoltHit', x: p.x, y: p.y, radius: p.radius })
    let budget = bossHitBudget(bossHitShare(BOLT_SHARE_MUL))
    // A meteor bursts where it lands, once, on a set of bodies that exists at
    // that instant — unlike the gunner's round, which bills as it travels. So
    // this one is measured from its victims like every other burst in the file,
    // and the round is still consumed: it went off, it simply took nobody.
    const eaten = absorbedBlow(budget, p.x, p.y, (u) => {
      const dx = u.x - p.x
      const dy = u.y - p.y
      return dx * dx + dy * dy <= p.radius * p.radius
    })
    if (!eaten) {
      for (const u of units) {
        if (budget <= 0) break
        if (u.dying > 0) continue
        const dx = u.x - p.x
        const dy = u.y - p.y
        if (dx * dx + dy * dy > p.radius * p.radius) continue
        killUnit(u, Math.sign(dx), 'slam')
        budget--
      }
    }
    bossBolts.splice(i, 1)
  }
}

/**
 * The summoner: a wave budget and a timer, and nothing else.
 *
 * `attacks` counts waves spent. When it reaches `SUMMON_WAVES_MAX` the boss is
 * finished contributing and simply stands there — which is the point, and the
 * only reason the fight has a floor under it. See the note on `SUMMON_WAVES_MAX`.
 */
/**
 * One summoned body, placed.
 *
 * Shared by the wave and by the flank trickle below so the two can never drift
 * apart on health, bite, design or clamping — the only thing that differs
 * between them is WHERE they come up, and that difference is the whole point.
 */
const placeSummon = (b: Boss, x: number, y: number): void => {
  const def = foeDef(SUMMON_TYPE)
  // Priced off the BOSS's bar, not the stage's husk — see `SUMMON_HP_SHARE`.
  // `b.maxHp` already carries everything that sized the boss — the stage curve
  // or, on stages 1-5, the run's own firepower, and the difficulty factor and
  // retry relief either way — so the wall softens for a stuck player exactly as
  // the boss does and there is no second place for those to be applied.
  const hp = Math.max(1, Math.round(b.maxHp * SUMMON_HP_SHARE))
  const f = takeFoe()
  f.id = entityId++
  f.typeId = def.id
  f.design = SUMMON_DESIGN
  f.x = Math.max(-LANE_HALF + 0.5, Math.min(LANE_HALF - 0.5, x))
  f.y = y
  f.hp = hp
  f.maxHp = hp
  f.speed = def.speed
  f.bite = Math.max(1, Math.round(def.bite * challengeBiteFactor(challenge.value) * SUMMON_BITE_MUL))
  f.biteShare = biteShareFor(def.id) * challengeBiteFactor(challenge.value) * SUMMON_BITE_MUL
  f.scale = def.scale
  f.phase = Math.random()
  f.swayPhase = Math.random() * 6.28
  foes.push(f)
}

/**
 * The mercy trickle: what a summoner does once its wall is spent and the crowd
 * it spent the wall on is down to a handful.
 *
 * This exists because of a reported run in which the wave cap worked perfectly
 * and produced a fight with no exit — one survivor, an empty road, and twelve
 * minutes of holding the trigger against a bar that would eventually have
 * fallen. See the note above `SUMMON_MERCY_SQUAD` in `threats.ts`.
 *
 * Two properties it must have, and both are load-bearing:
 *
 *   • it can NEVER touch a fight the player might still win. The gate is the
 *     squad size, re-read every tick, so a crowd that is still a crowd resets
 *     the clock and nothing is ever called up;
 *   • and once it starts it must FINISH the fight, so the gap shortens with
 *     every body. A fixed trickle a stubborn squad survives would trade a long
 *     grind for a longer one.
 */
const stepSummonerMercy = (b: Boss, dt: number): void => {
  if (squadCount.value > SUMMON_MERCY_SQUAD) {
    // Still a fight. Re-arm the grace so a crowd cut down later gets the full
    // beat rather than whatever was left of an older one.
    b.mercyCd = SUMMON_MERCY_GRACE
    b.mercySpawns = 0
    return
  }
  b.mercyCd -= dt
  if (b.mercyCd > 0) return
  b.mercyCd = Math.max(
    SUMMON_MERCY_CD_MIN,
    SUMMON_MERCY_CD * Math.pow(SUMMON_MERCY_RAMP, b.mercySpawns)
  )
  // Alternating flanks: one body at a time, beside the boss, so it walks the
  // arena in full view instead of rising in the crowd's face the way a wave
  // does. A squad with anything left shoots it on the way down.
  const side = b.mercySpawns % 2 === 0 ? 1 : -1
  b.mercySpawns++
  const x = b.x + side * SUMMON_MERCY_FLANK
  placeSummon(b, x, b.y)
  pushFx({ kind: 'summonFlank', x, y: b.y })
}

/**
 * The summoner's cycle, and phase two is NOT part of it.
 *
 * This shipped as `enragedSpan(SUMMON_CD, …)` on the argument that the wall
 * arriving faster is still the same wall — `SUMMON_WAVES_MAX` bounds the total,
 * so the turn buys pressure and not volume. The argument is true about the total
 * and wrong about the fight, and the A/B says so plainly. Stage's summoner, a
 * stationary crowd, tightened cadence against flat:
 *
 *     squad  80 →  87 % lost over 3010 ticks, against 60 % over 1577
 *     squad 100 →  47 % over 1076, against 29 % over  965
 *     squad 120 →  35 % over  812, against 24 % over  810
 *     squad 150 →   6 % over  625, against  4 % over  591
 *
 * A strong build does not notice; a marginal one loses another 27 points of its
 * crowd AND fights for twice as long. That is not an escalation, it is the exact
 * compounding this archetype's own header was written about — spawn pressure is
 * a rate subtracted from the player's damage, so bodies arriving faster than
 * they are cleared make the fight longer, which lets more of them arrive. The
 * budget still ends it, so it is survivable; it is simply the whole cost landing
 * on the players least able to afford it, which is the reason a rake never
 * charges either.
 *
 * So the summoner's phase two is the colour and the sound, and the wall keeps
 * the cadence it was measured at. See the note in `throwHealerCast` for the
 * general rule this and the healer arrived at from opposite directions.
 */
const summonSpan = (): number => SUMMON_CD

const stepSummoner = (b: Boss, dt: number): void => {
  // Runs on its own clock, and only once the wall is spent — the budget is
  // still the fight's floor, and this is only ever what happens after it.
  if (b.attacks >= SUMMON_WAVES_MAX) stepSummonerMercy(b, dt)
  b.summonCd -= dt
  if (b.summonCd > 0) return
  // A guard phase is paid off with a WAVE rather than a swing — see
  // `bossGuardPayoff`. Releasing the shield here and nowhere else is what keeps
  // "the phase is over when the boss has paid for it" true for this kind too.
  b.guard = 0
  if (b.attacks >= SUMMON_WAVES_MAX) {
    // Budget spent. The timer keeps running so a later guard phase still has
    // something to release, but nothing is spawned: the road stops filling and
    // the fight becomes an ordinary one. See `SUMMON_WAVES_MAX`.
    b.summonCd = summonSpan()
    return
  }
  b.attacks++
  b.summonCd = summonSpan()

  // They come up out of the road in front of the CROWD, not out of the boss —
  // see `SUMMON_AHEAD`. Sited off `anchorX`/`anchorY` for the same reason the
  // slam is: the boss spends a whole fight walking in, so anything placed
  // relative to its body arrives after the fight is over.
  const waveY = anchorY + SUMMON_AHEAD
  // Sized off the RAMP, not the flat budget — see `SUMMON_WAVE_RAMP`. The spread
  // divides by this wave's own count for the same reason: keyed to the flat size
  // instead, a two-body wave would arrive squeezed into the left third of the
  // road rather than spanning it, and "wider than the crowd" is the whole reason
  // a wave cannot simply be stood beside.
  const size = summonWaveSize(b.attacks)
  for (let i = 0; i < size; i++) {
    // Constant SPACING, centred — not a constant span. Spanning
    // `SUMMON_SPREAD` whatever the count put a two-body wave's pair on the
    // two RAILS instead of in front of the crowd, where forward fire does
    // not reach them and they walk in from the flanks: measured, the smaller
    // opening wave made the marginal fight LONGER (23 s to 57 s) and cost
    // more of the crowd than the bigger wave it replaced. At the full size
    // this is arithmetically identical to what it replaced.
    const step = (2 * SUMMON_SPREAD) / Math.max(1, SUMMON_PER_WAVE - 1)
    const spread = (i - (size - 1) / 2) * step
    placeSummon(b, anchorX + spread, waveY + (i % 2) * 0.7)
  }
  pushFx({ kind: 'summonWave', x: anchorX, y: waveY, count: size, wave: b.attacks })
}

/**
 * The only way the boss loses health — and therefore the only place the guard
 * gates can be enforced.
 *
 * They live HERE rather than in `stepBoss` because a squad of a thousand with
 * upgraded firepower can put more damage into one frame than a whole phase is
 * worth. Checked after the fact, that frame would carry the boss straight past
 * a gate and the phase would never happen; checked here, the damage is CLAMPED
 * at the threshold, the boss plants, and the swing it owes the player is always
 * paid. Overkill is forfeited, which is the point — the gate is a floor on how
 * long the climax lasts, not a tax on damage.
 */
const damageBoss = (b: Boss, amount: number, throughGuard = false): void => {
  if (b.dead) return
  // A guarded boss is immune to GUNFIRE — that is the phase, and the primer the
  // player is shown says so. A barrel blast is the exception the phase exists to
  // create: it is the one offence available while the shield is up, which turns
  // "MOVE and wait" into "MOVE and go get that". The gate floor below still
  // applies, so a blast can carry the boss TO its next phase but never past it —
  // the boss still plants and swings at every gate it owes the player.
  if (b.guard > 0 && !throughGuard) return
  const gate = bossGuardGates(stage.value)[b.guarded]
  const floor = gate === undefined ? 0 : gate * b.maxHp
  b.hp -= amount
  b.flash = 1

  if (gate !== undefined && b.hp <= floor) {
    b.hp = floor
    b.guarded++
    b.guard = 1

    // ── Phase two turns HERE, and only here ──
    //
    // One site, one latch, at the one moment in the fight the simulation
    // guarantees is reached exactly once (the damage above is CLAMPED to the
    // gate, so a squad of a thousand cannot carry the boss past it and a healer
    // pushing the bar back up cannot bring it round again — `guarded` has
    // already moved). Everything phase two is made of hangs off this line: the
    // tempo `bossSpan` hands out, the charge `armBossCycle` schedules, the
    // colour the renderer shifts to and the sound that says so.
    //
    // See `BOSS_ENRAGE_AT` for why this is a gate rather than a health check,
    // and `bossCharges` for why the swing below becomes a charge for two of the
    // four kinds and stays what it was for the other two.
    const turning = !bossEnraged && bossEnragesAt(stage.value, gate)
    if (turning) {
      bossEnraged = true
      // The first charge IS the swing this gate owes the player. That is not a
      // saving, it is the point: the beat where the boss plants, roars and goes
      // untouchable is the loudest thing in the fight and it is already the beat
      // the player is watching, so it is where the new move belongs. Arriving a
      // cycle later it would be one more attack in a fight full of them.
      bossCharging = bossCharges(b.kind)
    }

    if (bossGuardPayoff(b.kind) === 'wave') {
      // A summoner has no swing to owe, so the phase is paid off with a wave and
      // its own clock is what releases the shield — see `bossGuardPayoff` and
      // `stepSummoner`. Nothing here touches the slam machinery, because the
      // summoner never uses it.
      b.summonCd = SUMMON_TELEGRAPH
    } else {
      // Start the wind-up now rather than on the old clock: the phase turn IS
      // the telegraph, so the player gets the full window from the moment they
      // see it. The window is the KIND's, not the meteor's — a healer given a
      // full second here would spend the phase turn on a longer wind-up than any
      // of its own.
      //
      // A charge gets `CHARGE_TELEGRAPH_MIN` flat rather than `chargeWindup`'s
      // multiple of the cycle, and that is the guard phase's constraint rather
      // than the charge's: the wind-up here IS how long the boss is immune, and
      // multiplying a fresh 2.4 s cycle by 1.7 would hand the player four
      // seconds of shooting a shield in payment for one attack. The floor is the
      // part of `chargeWindup` that was measured against a human anyway.
      const tell = bossCharging ? CHARGE_TELEGRAPH_MIN : bossTelegraph(b.kind)
      b.slamCd = tell
      b.slamSpan = tell
      // This path shortens a healer's fuse from a cast to a telegraph, which can
      // pull an armed heal inside its gap. Nothing is done about it here: the
      // invariant in `stepBoss` catches it on the next tick, before the
      // telegraph this path announces has finished drawing. See it for why the
      // correction lives there rather than at each site that re-times a cycle.
      // The guard picks its own target, here, at the moment the phase turns —
      // so `stepBoss` must not re-aim it a frame later on stale input.
      b.aimed = true
      // …and it announces itself, exactly as the ordinary swing does.
      //
      // This is a SECOND path that arms an attack, and it used to arm one
      // silently: `stepBoss` only casts when it is the thing doing the aiming,
      // so the swing a guard phase turns into landed with nothing falling out of
      // the sky. It is also the swing the player is least ready for, arriving on
      // the beat their fire stopped working.
      //
      // Routed through `aimBoss` rather than repeating a `meteorCast` here, so a
      // kind can never end up with a guard phase that announces somebody else's
      // attack — which is exactly what a hard-coded meteor cast did to the claw
      // and the healer the first time round.
      //
      // With NO lead, which is what the hand-written version did and is the
      // right behaviour anyway: the phase turn is not a read on where the crowd
      // is drifting, it is a swing owed at the ground they are standing on.
      aimBoss(b, 0)
    }
    slowHoldMs = 320
    pushFx({ kind: 'bossRage', x: b.x, y: b.y, stage: b.guarded })
    // Pushed AFTER the gate's own cue and in the same frame, so the renderer
    // sees them in order and the turn's louder flash and longer hold are what
    // the frame ends on. Two events, one beat — see `bossEnrage` in `useVfx`.
    if (turning) pushFx({ kind: 'bossEnrage', x: b.x, y: b.y })
  }

  bossHp01.value = Math.max(0, b.hp / b.maxHp)
  if (b.hp <= 0) killBoss()
}

const killBoss = (): void => {
  if (!boss || boss.dead) return
  boss.dead = true
  boss.dying = 0
  bossHp01.value = 0
  kills.value++
  timeScaleTarget = 0.35
  pushFx({ kind: 'bossDie', x: boss.x, y: boss.y })
}

// ─── Dev handles ────────────────────────────────────────────────────────────
//
// Reached only through `useCheats` (which self-gates on `localStorage.cheat`),
// through the console handle it publishes, and by the balance harness in
// `tests/sim`. Kept here rather than in the cheat module so they go through the
// same spawn path the game does.

export const debugAddUnits = (n: number): void => {
  for (let i = 0; i < n; i++) {
    spawnUnit(anchorX + (Math.random() - 0.5) * 2, anchorY + (Math.random() - 0.5) * 2)
  }
}

export const debugAddDamage = (n: number): void => { damage.value += n }

/**
 * Arm the auto-shield absorb without a box on the road.
 *
 * For specs about what the absorb DOES. Reaching it the honest way means
 * walking a stage until its one shield box streams in, steering onto the right
 * shoulder and shooting it down — which makes a test about a threshold depend
 * on every routing rule the road has, and would break the day the generator
 * moved a prop. `takeBulwark` is the only other writer, so what this sets is
 * exactly what a real pickup sets: one latch, no timer, no stacking.
 */
export const debugArmBulwark = (): void => { bulwarkArmed = true }

/**
 * Put the crowd at the arena mouth with the road behind it cleared.
 *
 * For tests about the BOSS. Walking the whole stage to reach it made those
 * tests depend on every rule the road has — they broke the day passages
 * landed, because a crowd that never steers now drives into a stone rib and
 * dies at the third bank, which says nothing at all about guard phases.
 *
 * Everything still in flight is dropped rather than left behind the crowd: a
 * live foe eight units back would walk into the boss fight and take survivors
 * the test is counting.
 */
export const debugSkipToArena = (): void => {
  anchorY = track.arenaY - 0.01
  nextEvent = track.events.length
  gates.length = 0
  dividers.length = 0
  crates.length = 0
  cages.length = 0
  bulwarks.length = 0
  barricades.length = 0
  rocks.length = 0
  foes.length = 0
  levers.length = 0
  stones.length = 0
  guards.length = 0
  weaponBoxes.length = 0
  bolts.length = 0
  pickups.length = 0
  for (const u of units) u.y = anchorY
}
/**
 * Test/dev seam: set the Reach upgrade level directly.
 *
 * Goes through the shop's own state rather than poking a private so the range
 * the sim fires at is the one a real save would produce — a seam that bypassed
 * `rangeBonus` would happily pass while the shipping path was broken.
 */
export const debugSetRangeLevel = (level: number): void => {
  __setUpgradeLevel('range', level)
}
export const debugAddFireRate = (n: number): void => setFireRate(runFireRate.value + n)

/**
 * Test/dev seam: hand the run a weapon without making it solve the puzzle.
 *
 * Writes the same ref the box does, so everything downstream — the shot budget,
 * the splash, the HUD badge, the tracer colour — is on the shipping path. A seam
 * that set its own private flag would pass while the real pickup was broken.
 */
export const debugGiveWeapon = (id: WeaponId | null): void => { activeWeapon.value = id }

/** Test-only: wipe both the world and the persisted failure record. */
export const __resetForTest = (): void => {
  resetWorld()
  squadCount.value = 0
  phase.value = 'run'
}

export default {
  stage, phase, squadCount, damage, runFireRate, runCoins, progress01, bossHp01,
  peakSquad, kills, bestStage, bestSquad, eliteAlive, eliteHp01, reliefActive,
  startStage, advanceStage, retryStage, step, steerTo, steerBy, runSummary
}
