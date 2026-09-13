/**
 * ─── The campaign ───────────────────────────────────────────────────────────
 *
 * Four worlds, ten levels each, forty levels. Every tenth is a boss.
 *
 * ── Generated, not typed out ──
 *
 * A hand-written table of forty levels is forty chances to make a level that is
 * flatter than the one before it, and no way to see the curve. So the curve is
 * stated ONCE per world — a start and an end for each dial — and each level is
 * interpolated along it. Levels that need to be special (the tutorial, the
 * first appearance of each tier, the bosses) then override exactly the fields
 * they care about, which is the only place a reader has to look to find an
 * exception.
 *
 * ── The curve's shape ──
 *
 * `ease` is not linear. Early levels in a world move slowly (a new world is
 * already a change of scenery, of fauna and of hazard — adding a difficulty
 * jump on top is three new things at once), and the last three tighten
 * sharply into the boss. `t^1.35` is that shape.
 *
 * Everything is deterministic: `levelSpec(n)` is a pure function of `n`, so the
 * board a player sees on 3-7 is the board anybody else sees on 3-7, no seed
 * required, and a save only ever has to store the level NUMBER.
 */

import type { BugId } from '@/game/bugs'
import { rosterForLevel } from '@/game/bugs'
import type { HazardId } from '@/game/hazards'
import type { Objective, ObjectiveTriple } from '@/game/stars'
import type { BossId } from '@/game/bosses'

export const LEVELS_PER_WORLD = 10
export const WORLD_COUNT = 4
export const TOTAL_LEVELS = LEVELS_PER_WORLD * WORLD_COUNT

export type WorldId = 1 | 2 | 3 | 4

export interface RosterEntry { id: BugId; weight: number }

export interface WorldSpec {
  id: WorldId
  /** i18n key suffix — `worlds.<theme>`. */
  theme: 'picnic' | 'backyard' | 'attic' | 'arcade'
  /** Stars that must be banked before the world opens. World 1 is always open. */
  starGate: number
  /** The fauna of this place. Debut gates inside `bugs.ts` open them in turn. */
  roster: readonly RosterEntry[]
  /** Objects scattered on the floor, chosen per level from this pool. */
  hazards: readonly HazardId[]
  /** The boss at level 10. */
  boss: BossId
  /** Floor palette, read by `floorArt.ts`. */
  floor: {
    base: string
    alt: string
    line: string
    shade: string
    /** Ambient tint laid over the whole board, RGBA. The attic is dim, the
     *  arcade is lit from below. */
    ambient: string
  }
  // ── The curve. `[first level, last level]`. ──
  /** Bugs the player must squish to clear. */
  quota: readonly [number, number]
  /** Seconds on the clock. */
  time: readonly [number, number]
  /** Bugs alive at once, cap. */
  maxAlive: readonly [number, number]
  /** ms between spawns at the START of a level, and at the END of one. The
   *  second number is smaller: a level accelerates inside itself too. */
  spawnMs: readonly [number, number]
  /** How much faster the last level's bugs move than the first's. */
  speed: readonly [number, number]
}

export const WORLDS: Record<WorldId, WorldSpec> = {
  1: {
    id: 1, theme: 'picnic', starGate: 0, boss: 'queenAnt',
    roster: [
      { id: 'ant', weight: 62 },
      { id: 'pinatafly', weight: 10 },
      { id: 'beetle', weight: 18 },
      { id: 'flea', weight: 16 }
    ],
    hazards: ['crumbs', 'honey', 'salt'],
    floor: {
      base: '#e8534f', alt: '#fdf4ea', line: '#ffffff',
      shade: '#b53a37', ambient: 'rgba(255,238,206,0.10)'
    },
    quota: [10, 44], time: [48, 66], maxAlive: [6, 15],
    spawnMs: [1100, 420], speed: [0.80, 1.02]
  },
  2: {
    id: 2, theme: 'backyard', starGate: 12, boss: 'beetleKing',
    roster: [
      { id: 'ant', weight: 34 },
      { id: 'beetle', weight: 26 },
      { id: 'caterpillar', weight: 22 },
      { id: 'stinkbug', weight: 18 },
      { id: 'flea', weight: 16 },
      { id: 'pinatafly', weight: 8 }
    ],
    hazards: ['honey', 'sweeper', 'crumbs', 'magnet'],
    floor: {
      base: '#4b8f3a', alt: '#3c7530', line: '#6fb857',
      shade: '#2b5622', ambient: 'rgba(190,255,170,0.08)'
    },
    quota: [34, 66], time: [58, 76], maxAlive: [12, 20],
    spawnMs: [760, 330], speed: [0.96, 1.16]
  },
  3: {
    id: 3, theme: 'attic', starGate: 34, boss: 'matriarch',
    roster: [
      { id: 'centipede', weight: 24 },
      { id: 'moth', weight: 22 },
      { id: 'ant', weight: 22 },
      { id: 'beetle', weight: 18 },
      { id: 'flea', weight: 16 },
      { id: 'stinkbug', weight: 14 },
      { id: 'caterpillar', weight: 12 },
      { id: 'pinatafly', weight: 8 }
    ],
    hazards: ['cobweb', 'sweeper', 'honey', 'magnet'],
    floor: {
      base: '#7a5a3c', alt: '#63472e', line: '#95704b',
      shade: '#3f2c1c', ambient: 'rgba(24,18,48,0.30)'
    },
    quota: [56, 92], time: [66, 86], maxAlive: [16, 26],
    spawnMs: [660, 280], speed: [1.06, 1.28]
  },
  4: {
    id: 4, theme: 'arcade', starGate: 64, boss: 'roachPrime',
    roster: [
      { id: 'robobug', weight: 26 },
      { id: 'flea', weight: 20 },
      { id: 'centipede', weight: 18 },
      { id: 'beetle', weight: 18 },
      { id: 'ant', weight: 16 },
      { id: 'stinkbug', weight: 14 },
      { id: 'moth', weight: 14 },
      { id: 'caterpillar', weight: 12 },
      { id: 'pinatafly', weight: 8 }
    ],
    hazards: ['conveyor', 'sweeper', 'magnet', 'honey'],
    floor: {
      base: '#171a33', alt: '#101226', line: '#3de0ff',
      shade: '#080a18', ambient: 'rgba(90,60,255,0.18)'
    },
    quota: [78, 122], time: [74, 96], maxAlive: [20, 32],
    spawnMs: [560, 240], speed: [1.18, 1.44]
  }
}

export interface LevelSpec {
  /** 1..40, the number the save stores. */
  id: number
  world: WorldId
  /** 1..10 within its world — what the HUD prints as "2-7". */
  index: number
  /** The boss id when this is a boss level, else null. */
  boss: BossId | null
  /**
   * Seconds on the clock, and (below) bugs to squish.
   *
   * ── How these two numbers were set ──
   *
   * By MEASUREMENT, with `tools/preview-video`'s scout: it plays a whole level
   * unrendered with a scripted player and reports when the quota was met. The
   * first pass was authored by feel, and a mediocre bot cleared level 2-7 in
   * thirty seconds of a hundred-and-one-second clock — the timer was never a
   * threat, the "finish with N seconds left" objective was free, and the fail
   * state effectively did not exist outside the boss levels.
   *
   * The rule now: a COMPETENT run finishes at roughly 55-70 % of the clock.
   * That leaves a careful player comfortable, a distracted one in real trouble
   * for the last ten seconds, and a level 45-70 seconds long rather than two
   * minutes — which is also the right size for a session that has to survive
   * a bus stop.
   */
  time: number
  /** Bugs to squish to clear. On a boss level this is 0 — the boss IS the
   *  quota, and a bug counter next to a boss bar is two progress readouts
   *  competing for the same glance. */
  quota: number
  roster: readonly RosterEntry[]
  /**
   * The hard ceiling on bodies alive at once.
   *
   * Also, with `spawnMs`, the answer to DEAD AIR. The first pass let a skilled
   * player empty the board and then stand on an empty floor waiting for the next
   * spawn — a third of the frames of a scouted run had nothing to aim at. The
   * board has to refill faster than a good player can clear it, or the game's
   * best players get the worst version of it.
   */
  maxAlive: number
  /** [at level start, at level end] — the director lerps between them. */
  spawnMs: readonly [number, number]
  /** Multiplier on every bug's base speed. */
  speed: number
  hazards: readonly HazardId[]
  objectives: ObjectiveTriple
}

/** 0..1 along a world, eased so the last three levels do most of the work. */
const ease = (index: number): number => {
  const t = LEVELS_PER_WORLD > 1 ? (index - 1) / (LEVELS_PER_WORLD - 1) : 0
  return Math.pow(Math.max(0, Math.min(1, t)), 1.35)
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

/**
 * The two optional objectives for a level.
 *
 * Rotating rather than random, and the rotation is keyed on the level's index
 * inside its world — so every world teaches the same lessons in the same order
 * and a player who three-starred 1-4 knows what 2-4 is going to ask of them.
 * The numbers scale with the world, which is what stops world 4's "reach ×8"
 * from being free.
 */
const optionals = (world: WorldId, index: number, quota: number): [Objective, Objective] => {
  const w = world - 1
  const combo = [4, 6, 8, 12][w]!
  const bigCombo = [8, 12, 20, 30][w]!
  const acc = [55, 62, 68, 72][w]!
  switch (index % 5) {
    case 1: return [{ kind: 'combo', n: combo }, { kind: 'noSpike' }]
    case 2: return [{ kind: 'accuracy', n: acc }, { kind: 'combo', n: bigCombo }]
    case 3: return [{ kind: 'combo', n: combo }, { kind: 'time', n: Math.round(12 + w * 4) }]
    case 4: return [{ kind: 'fever', n: 1 }, { kind: 'noMiss', n: Math.max(3, 10 - w * 2) }]
    default: return [
      { kind: 'combo', n: bigCombo },
      { kind: 'score', n: Math.round(quota * 26 * (1 + w * 0.55)) }
    ]
  }
}

/**
 * Hand-authored exceptions.
 *
 * Everything NOT listed here comes off the curve. Keyed by level id so a reader
 * looking for "why is 1-1 like that" finds one entry rather than a branch
 * buried in the generator.
 */
const OVERRIDES: Record<number, Partial<LevelSpec>> = {
  // ── 1-1: the lesson ──
  // A guaranteed win, on purpose. The whole level is eight ants walking in
  // straight lines with a generous clock and nothing that can punish a wrong
  // tap. The three-beat tutorial runs over it, and the first thing a new player
  // does in this game is succeed at it — which is the single highest-leverage
  // decision in the whole retention funnel.
  1: {
    quota: 8, time: 55, maxAlive: 4, spawnMs: [1500, 1050], speed: 0.72,
    hazards: [],
    objectives: [{ kind: 'clear' }, { kind: 'combo', n: 3 }, { kind: 'noMiss', n: 12 }]
  },
  // 1-2 introduces the crumb pile, which is the first thing on the floor that
  // is not a bug — and it PULLS ants, so the first lesson about the floor is
  // that the floor helps.
  2: { quota: 12, time: 58, maxAlive: 5, spawnMs: [1350, 900], speed: 0.80, hazards: ['crumbs'] },
  // 1-3: the piñata fly's debut. One target worth chasing.
  3: {
    objectives: [{ kind: 'clear' }, { kind: 'kind', id: 'pinatafly', n: 1 }, { kind: 'combo', n: 4 }]
  },
  // 1-4: the beetle. The shell is the first "a tap is not enough".
  4: {
    hazards: ['crumbs'],
    objectives: [{ kind: 'clear' }, { kind: 'kind', id: 'beetle', n: 3 }, { kind: 'noSpike' }]
  },
  // 1-6: the flea. The first target that moves when you aim at it.
  6: {
    objectives: [{ kind: 'clear' }, { kind: 'kind', id: 'flea', n: 4 }, { kind: 'combo', n: 6 }]
  },
  // 1-8: honey. The answer to the flea, handed over two levels after the
  // problem — long enough to have felt it, soon enough to still care.
  8: { hazards: ['honey', 'crumbs'] },

  // ── World 2 ──
  // 2-2: the caterpillar. The first time stomping is a mistake.
  12: {
    hazards: ['honey'],
    objectives: [{ kind: 'clear' }, { kind: 'noSpike' }, { kind: 'combo', n: 8 }]
  },
  // 2-4: the stink bug.
  14: {
    objectives: [{ kind: 'clear' }, { kind: 'kind', id: 'stinkbug', n: 4 }, { kind: 'accuracy', n: 60 }]
  },
  // 2-5: the mower. Free kills for anyone who can herd.
  15: { hazards: ['sweeper', 'honey'] },
  // 2-7: the magnet, and with it the beetle multi-squish.
  17: { hazards: ['magnet', 'sweeper'] },

  // ── World 3 ──
  // 3-1: the cobweb and the centipede, together, because the web is what makes
  // a centipede stand still long enough to read.
  21: {
    hazards: ['cobweb'],
    objectives: [{ kind: 'clear' }, { kind: 'kind', id: 'centipede', n: 2 }, { kind: 'combo', n: 8 }]
  },
  // 3-3: the moth. The first thing the foot cannot reach at will.
  23: {
    objectives: [{ kind: 'clear' }, { kind: 'kind', id: 'moth', n: 5 }, { kind: 'combo', n: 12 }]
  },
  // 3-6: everything at once, in the dark.
  26: { hazards: ['cobweb', 'sweeper', 'magnet'] },

  // ── World 4 ──
  // 4-1: the conveyor and the robo-bug.
  31: {
    hazards: ['conveyor'],
    objectives: [{ kind: 'clear' }, { kind: 'kind', id: 'robobug', n: 5 }, { kind: 'combo', n: 12 }]
  },
  // 4-5: the arcade at full tilt.
  35: { hazards: ['conveyor', 'sweeper', 'magnet'] },
  // 4-9: the last level before the last boss. The hardest board in the game
  // that is not a boss, and it is allowed to be.
  39: {
    maxAlive: 30, spawnMs: [420, 300], speed: 1.5,
    hazards: ['conveyor', 'sweeper', 'magnet', 'honey'],
    objectives: [{ kind: 'clear' }, { kind: 'combo', n: 30 }, { kind: 'feverKills', n: 14 }]
  }
}

/**
 * Boss levels.
 *
 * A boss level has no quota and no roster ramp of its own — the boss script
 * spawns its own adds — so the curve fields are set to the values the fight
 * actually wants rather than interpolated.
 */
const BOSS_LEVEL: Partial<LevelSpec> = {
  quota: 0, maxAlive: 16, spawnMs: [1400, 900]
}

const bossObjectives = (world: WorldId): ObjectiveTriple => {
  const combo = [6, 10, 16, 24][world - 1]!
  return [{ kind: 'clear' }, { kind: 'noSpike' }, { kind: 'combo', n: combo }]
}

/** Clamp any incoming level number onto the campaign. */
export const clampLevel = (n: number): number => {
  if (!Number.isFinite(n)) return 1
  return Math.max(1, Math.min(TOTAL_LEVELS, Math.floor(n)))
}

export const worldOf = (level: number): WorldId =>
  (Math.floor((clampLevel(level) - 1) / LEVELS_PER_WORLD) + 1) as WorldId

export const indexOf = (level: number): number =>
  ((clampLevel(level) - 1) % LEVELS_PER_WORLD) + 1

/** "3-7" — the label the HUD and the banner print. */
export const levelLabel = (level: number): string =>
  `${worldOf(level)}-${indexOf(level)}`

export const isBossLevel = (level: number): boolean =>
  indexOf(level) === LEVELS_PER_WORLD

/**
 * Build one level. Pure and total: any number in, a valid level out.
 *
 * Memoised because the result is immutable and the HUD, the director, the
 * result screen and the art preloader all ask for the same one repeatedly
 * inside a single frame.
 */
const cache = new Map<number, LevelSpec>()

export const levelSpec = (levelRaw: number): LevelSpec => {
  const id = clampLevel(levelRaw)
  const hit = cache.get(id)
  if (hit) return hit

  const world = worldOf(id)
  const index = indexOf(id)
  const w = WORLDS[world]
  const t = ease(index)
  const boss = isBossLevel(id)

  const quota = Math.round(lerp(w.quota[0], w.quota[1], t))
  const base: LevelSpec = {
    id,
    world,
    index,
    boss: boss ? w.boss : null,
    time: Math.round(lerp(w.time[0], w.time[1], t)),
    quota,
    roster: rosterForLevel(w.roster, id),
    maxAlive: Math.round(lerp(w.maxAlive[0], w.maxAlive[1], t)),
    spawnMs: [
      Math.round(lerp(w.spawnMs[0], w.spawnMs[1], t)),
      Math.round(lerp(w.spawnMs[0], w.spawnMs[1], t) * 0.72)
    ],
    speed: Number(lerp(w.speed[0], w.speed[1], t).toFixed(3)),
    // One hazard early in a world, two by the middle, three at the end — drawn
    // in the world's own order so the first one a player meets is always the
    // same one.
    hazards: w.hazards.slice(0, Math.min(w.hazards.length, 1 + Math.floor(index / 4))),
    objectives: [{ kind: 'clear' }, ...optionals(world, index, quota)] as unknown as ObjectiveTriple
  }

  const spec: LevelSpec = {
    ...base,
    ...(boss ? { ...BOSS_LEVEL, objectives: bossObjectives(world) } : {}),
    ...(OVERRIDES[id] ?? {})
  }

  // A roster override may name a bug before its debut; re-filter so the debut
  // gate is the single authority and an override cannot accidentally leak the
  // robo-bug into world 1.
  const final: LevelSpec = { ...spec, roster: rosterForLevel(spec.roster, id) }
  cache.set(id, final)
  return final
}

/** Every level, in order. Used by the balance tests and the art preloader. */
export const allLevels = (): LevelSpec[] =>
  Array.from({ length: TOTAL_LEVELS }, (_, i) => levelSpec(i + 1))

/**
 * Which bug designs a level can put on screen — what the art preloader needs
 * so the splash waits for THIS level's cast and not the whole bestiary.
 */
export const levelCast = (level: number): BugId[] => {
  const spec = levelSpec(level)
  return spec.roster.map((r) => r.id)
}

/**
 * Is `level` reachable with `stars` banked?
 *
 * Only WORLDS are gated, never individual levels: being stuck one level from
 * the end of a world and being told to go back and re-star old levels is the
 * single most reliable way to lose a child player. The gate sits at the world
 * boundary, where the game has just given them a boss clear and a payout, and
 * where going back is a victory lap rather than a punishment.
 */
export const isLevelUnlocked = (level: number, stars: number): boolean =>
  stars >= WORLDS[worldOf(level)].starGate

/** The first level of the deepest world the player has opened. */
export const worldOpenLevel = (world: WorldId): number =>
  (world - 1) * LEVELS_PER_WORLD + 1

/** Stars still needed to open the next world, or 0 when nothing is locked. */
export const starsToNextWorld = (level: number, stars: number): number => {
  const next = worldOf(level) + 1
  if (next > WORLD_COUNT) return 0
  return Math.max(0, WORLDS[next as WorldId].starGate - stars)
}

/**
 * Coins a cleared level pays.
 *
 * Priced off the WORLD rather than off the score, so the payout is something a
 * player can plan around ("two more levels and I can afford the boot") instead
 * of a number that swings with how well a particular run went. The score has
 * the leaderboard to be interesting on.
 */
export const levelPayout = (level: number, stars: number): number => {
  const world = worldOf(level)
  const base = 20 + world * 14
  const bossBonus = isBossLevel(level) ? 90 + world * 30 : 0
  return Math.round(base + stars * (8 + world * 4) + bossBonus)
}
