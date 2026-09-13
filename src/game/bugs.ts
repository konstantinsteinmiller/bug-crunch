/**
 * ─── The bestiary ───────────────────────────────────────────────────────────
 *
 * Pure data. No canvas, no Vue, no DOM — `bugArt.ts` knows how to DRAW these
 * and `useSplatixGame.ts` knows how to RUN them; this file is the single place
 * that says what each one IS. It loads under plain Node, which is what lets the
 * art bench (`pnpm art:prompts`) and the unit tests read it directly.
 *
 * ── The unit ──
 *
 * Every length here is in **u**, the field unit: `u = min(fieldW, fieldH) / 100`.
 * Nothing in this game is ever sized in pixels, because the same board has to
 * read on a 320 x 568 phone held upright and on a 4K desktop — a 14 px ant is
 * a speck on one and a boulder on the other. In u, an ant is 3.2 across on both.
 *
 * The floor under those numbers is the THUMB. An ant at 3.2 u is ~25 px wide on
 * a 390 px phone, which is the smallest thing a six-year-old can reliably put a
 * finger on; the first pass drew them at 2.2 and they read as specks.
 *
 * ── The design rule every entry obeys ──
 *
 * A bug is a QUESTION the player answers with a choice of stomp. If the answer
 * is always "tap it", the bug is decoration. So each one breaks exactly one
 * assumption the previous tier taught:
 *
 *   ant          nothing — it is the assumption
 *   beetle       a tap is not always enough        → slam, or a piercing shoe
 *   flea         the target does not wait          → feint, or silent tread
 *   caterpillar  stomping is not always free       → steel, or leave it
 *   stinkbug     killing is not always the point   → puncture, or bait it
 *   centipede    one body is not one kill          → head first, or farm it
 *   pinatafly    some targets are worth chasing    → burst taps
 *   moth         the floor is not the only plane   → wait for the dip
 *   robobug      armour can come back              → break the plate first
 */

export type BugId =
  | 'ant' | 'beetle' | 'flea' | 'centipede' | 'caterpillar'
  | 'stinkbug' | 'pinatafly' | 'moth' | 'robobug'

/** How a body moves across the floor. Read by the simulation's steering step. */
export type BugMotion =
  /** A straight line along a sugar trail, turning only at the board edge. */
  | 'march'
  /** A slow drunkard's walk with a heading that drifts. */
  | 'wander'
  /** Short bursts with a rest between them — a flea between leaps. */
  | 'hop'
  /** Fast lateral sine on top of a forward run. */
  | 'zigzag'
  /** Very slow, very straight, and utterly unbothered. */
  | 'crawl'
  /** A head that steers and a tail of segments that follow its path. */
  | 'serpentine'
  /** Airborne: circles the board and dips to the floor periodically. */
  | 'drift'
  /** Bursts of speed in random directions, pausing between. */
  | 'scurry'

export interface BugSpec {
  id: BugId
  /** i18n key suffix — `bugs.<id>`. Never a literal shown to a player. */
  name: BugId
  /** Hits to kill, at pierce >= `armor`. Centipedes spend one per segment. */
  hp: number
  /** Body radius, in field units (u). The stomp test is circle-vs-circle. */
  size: number
  /** Ground speed in u/s at difficulty 1. */
  speed: number
  motion: BugMotion
  /** Points for one squish, BEFORE the chain multiplier. */
  score: number
  /**
   * Share of the whole Juice vial one squish contributes, 0..1.
   *
   * Priced by mass, not by difficulty: the vial is a reward for VOLUME, and a
   * fever earned by clearing a swarm is the one the game wants to hand out.
   */
  juice: number
  /**
   * Armour class. A stomp whose shoe `pierce` is below this RICOCHETS: no
   * damage, a metal CLANG, and — critically — it does NOT break the chain,
   * because the player did hit something. Slams add +2 pierce.
   */
  armor: number
  /** Senses the foot shadow and leaps clear after a short tell. */
  dodges: boolean
  /** Spikes. A stomp from a shoe without `spikeProof` hurts the player. */
  spiky: boolean
  /** Bursts a haze cloud on a direct squish (blurs + slows the foot). */
  stinks: boolean
  /** Body segments. 0 = a single body; 6 = a centipede. */
  segments: number
  /** Flies. Only stompable while dipped (see `drift`). */
  airborne: boolean
  /** Splat colour, RGB 0-255 — the decal, the droplets, the goo ring. */
  goo: readonly [number, number, number]
  /** Chassis colours for the procedural drawing. */
  body: string
  shade: string
  accent: string
  /** Coins dropped. Most bugs drop none; the piñata is the payday. */
  coins: number
  /**
   * What one of these costs the spawn director out of a wave's budget.
   *
   * Not the same number as `score`: the budget prices PRESSURE (how much of the
   * player's attention the thing takes) and the score prices SATISFACTION.
   * A caterpillar is trivially killable and expensive here, because the thing
   * it costs the player is a decision, not a stomp.
   */
  cost: number
  /**
   * The first level this may appear on, 1..40. The spawn director never rolls a
   * bug before its debut even if a roster names it — which is what lets world
   * rosters be written broadly and still open gently.
   */
  debut: number
}

const bug = (s: BugSpec): BugSpec => s

export const BUGS: readonly BugSpec[] = [
  bug({
    id: 'ant', name: 'ant',
    hp: 1, size: 3.2, speed: 13, motion: 'march',
    score: 10, juice: 0.060, armor: 0,
    dodges: false, spiky: false, stinks: false, segments: 0, airborne: false,
    goo: [255, 74, 158], body: '#8c3a24', shade: '#5e2415', accent: '#ffd9a8',
    coins: 0, cost: 1, debut: 1
  }),
  bug({
    id: 'beetle', name: 'beetle',
    hp: 3, size: 4.8, speed: 7, motion: 'crawl',
    score: 45, juice: 0.150, armor: 2,
    dodges: false, spiky: false, stinks: false, segments: 0, airborne: false,
    goo: [66, 225, 122], body: '#2f7a45', shade: '#17442a', accent: '#b8f2c6',
    coins: 0, cost: 4, debut: 4
  }),
  bug({
    id: 'flea', name: 'flea',
    hp: 1, size: 2.8, speed: 20, motion: 'hop',
    score: 30, juice: 0.070, armor: 0,
    dodges: true, spiky: false, stinks: false, segments: 0, airborne: false,
    goo: [120, 200, 255], body: '#4a4358', shade: '#262030', accent: '#cdb8ff',
    coins: 0, cost: 3, debut: 6
  }),
  bug({
    id: 'caterpillar', name: 'caterpillar',
    hp: 1, size: 4.3, speed: 5, motion: 'crawl',
    score: 35, juice: 0.100, armor: 0,
    dodges: false, spiky: true, stinks: false, segments: 0, airborne: false,
    goo: [180, 255, 90], body: '#93c33a', shade: '#5b7f18', accent: '#fff3a8',
    coins: 0, cost: 5, debut: 11
  }),
  bug({
    id: 'stinkbug', name: 'stinkbug',
    hp: 1, size: 4.0, speed: 6, motion: 'wander',
    score: 40, juice: 0.090, armor: 0,
    dodges: false, spiky: false, stinks: true, segments: 0, airborne: false,
    goo: [186, 120, 255], body: '#5b4a7a', shade: '#312545', accent: '#d9c4ff',
    coins: 0, cost: 5, debut: 14
  }),
  bug({
    id: 'centipede', name: 'centipede',
    hp: 1, size: 3.3, speed: 17, motion: 'serpentine',
    score: 25, juice: 0.060, armor: 0,
    dodges: false, spiky: false, stinks: false, segments: 6, airborne: false,
    goo: [255, 160, 60], body: '#b5622b', shade: '#6e3412', accent: '#ffd28a',
    coins: 0, cost: 6, debut: 21
  }),
  bug({
    id: 'pinatafly', name: 'pinatafly',
    hp: 5, size: 3.8, speed: 26, motion: 'zigzag',
    score: 120, juice: 0.180, armor: 0,
    dodges: false, spiky: false, stinks: false, segments: 0, airborne: false,
    goo: [255, 214, 64], body: '#f5c42b', shade: '#c58a00', accent: '#fff6d0',
    coins: 6, cost: 4, debut: 3
  }),
  bug({
    id: 'moth', name: 'moth',
    hp: 2, size: 4.6, speed: 11, motion: 'drift',
    score: 60, juice: 0.110, armor: 0,
    dodges: false, spiky: false, stinks: false, segments: 0, airborne: true,
    goo: [214, 226, 255], body: '#9c93b5', shade: '#5d5570', accent: '#fdf6d8',
    coins: 0, cost: 5, debut: 21
  }),
  bug({
    id: 'robobug', name: 'robobug',
    hp: 2, size: 4.4, speed: 15, motion: 'scurry',
    score: 80, juice: 0.130, armor: 3,
    dodges: false, spiky: false, stinks: false, segments: 0, airborne: false,
    goo: [90, 240, 255], body: '#48566e', shade: '#232c3d', accent: '#6ef0ff',
    coins: 1, cost: 7, debut: 31
  })
] as const

const BY_ID: Record<BugId, BugSpec> = Object.fromEntries(
  BUGS.map((b) => [b.id, b])
) as Record<BugId, BugSpec>

/** Look one up. Throws on an unknown id — a typo in a roster is a bug in the
 *  data, not something to paper over with a silent fallback. */
export const bugSpec = (id: BugId): BugSpec => {
  const spec = BY_ID[id]
  if (!spec) throw new Error(`[bugs] unknown bug id: ${id}`)
  return spec
}

export const BUG_IDS: readonly BugId[] = BUGS.map((b) => b.id)

export const isBugId = (v: unknown): v is BugId =>
  typeof v === 'string' && v in BY_ID

// ─── Damage resolution ──────────────────────────────────────────────────────

/** What one stomp did to one body. Pure — the sim turns this into effects. */
export type StompVerdict =
  /** Dead. */
  | 'splat'
  /** Damaged but alive — a beetle's shell cracking. */
  | 'hurt'
  /** The shoe was not hard enough: a CLANG, no damage, chain PRESERVED. */
  | 'ricochet'
  /** The player got spiked. Chain broken, foot knocked back. */
  | 'spike'

export interface StompInput {
  /** The body being stomped. */
  bug: BugSpec
  /** Damage already taken (0-based). */
  damage: number
  /** The shoe's armour pierce, plus +2 for a heavy slam. */
  pierce: number
  /** The blow was a charged slam rather than a tap. Worth `blowDamage()`. */
  heavy: boolean
  /** The shoe ignores spikes (steel toe). */
  spikeProof: boolean
  /** Splat Fever is running — everything dies to everything. */
  fever: boolean
  /** The blow landed on a centipede's HEAD (instant kill). */
  headshot?: boolean
}

/**
 * How much damage one blow carries.
 *
 * A slam is worth TWO, and that is not a bonus — it is what makes the move
 * exist. A slam takes `shoe.chargeMs` to wind up plus a long recovery, roughly
 * the time of three taps; one that did a tap's damage was a strictly worse move
 * than tapping, and the only reason to ever charge would have been armour. With
 * two, a shell is opened in half the blows and the gesture feels like what the
 * GDD calls it: devastating.
 */
export const blowDamage = (heavy: boolean): number => (heavy ? 2 : 1)

/**
 * Resolve one stomp against one body.
 *
 * Order matters and is load-bearing:
 *
 *   1. FEVER first. The gilded boot is the game's one "nothing stops you"
 *      moment, and a spike that could still hurt through it would make the
 *      reward feel like a lie.
 *   2. SPIKES before armour. The caterpillar has no armour to speak of — the
 *      point is that hitting it is a mistake, and the mistake has to be
 *      reported even when the shoe would have killed it.
 *   3. ARMOUR before damage. A ricochet is not a miss: the player aimed
 *      correctly with the wrong tool, and the chain survives.
 */
export const resolveStomp = (i: StompInput): StompVerdict => {
  if (i.fever) return 'splat'
  if (i.bug.spiky && !i.spikeProof) return 'spike'
  if (i.pierce < i.bug.armor) return 'ricochet'
  if (i.headshot) return 'splat'
  return i.damage + blowDamage(i.heavy) >= i.bug.hp ? 'splat' : 'hurt'
}

/**
 * Bugs that may appear on a level, filtered by debut.
 *
 * The roster is authored per WORLD — broad, so a world reads as a place with
 * its own fauna — and the debut gate is what makes the first levels of that
 * world open gently instead of throwing the whole set at level one.
 */
export const rosterForLevel = (
  roster: ReadonlyArray<{ id: BugId; weight: number }>,
  level: number
): Array<{ id: BugId; weight: number }> =>
  roster.filter((r) => bugSpec(r.id).debut <= level)
