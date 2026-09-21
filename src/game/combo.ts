/**
 * ─── The Splat Chain, the Juice vial, and Fever ─────────────────────────────
 *
 * All three of the game's feedback loops, as pure functions over plain numbers.
 * Nothing here touches a canvas, a ref or a clock: the simulation owns the
 * clock and calls in. That is what makes the tuning testable — every number
 * below is pinned by `tests/game/combo.test.ts`.
 *
 * ── Why the chain is a LADDER, not a counter ──
 *
 * `×n after n squishes` reads as arithmetic. A ladder reads as a rank: the
 * player is not at 7, they are at **×8** and one more squish makes them
 * **×12**. The rungs are far apart on purpose — the gap is the tension, and the
 * jump is the payoff. The top rung is ×50, exactly as the GDD says, and it
 * takes a genuinely excellent run to touch it.
 *
 * ── Why a ricochet does not break the chain ──
 *
 * The chain breaks on a MISS — a stomp that hit bare floor — and on a spike.
 * Both are the player being wrong. A ricochet is the player being RIGHT with
 * the wrong tool: they found the beetle, they just could not open it. Breaking
 * the chain there would teach "do not stomp beetles", which is the opposite of
 * the lesson.
 */

// ─── The chain ──────────────────────────────────────────────────────────────

/** How long a chain survives without a squish, ms. GDD §6.1. */
export const COMBO_WINDOW_MS = 1500

/**
 * The multiplier ladder. Index = how many squishes are on the chain (clamped),
 * value = the multiplier. Index 0 and 1 are ×1: the first squish of a chain is
 * never bonused, or every chain would open on a freebie.
 */
export const COMBO_LADDER: readonly number[] = [
  1, 1, 2, 2, 3, 3, 3, 5, 5, 5, 5,
  8, 8, 8, 8, 8,
  12, 12, 12, 12, 12,
  20, 20, 20, 20, 20, 20, 20, 20, 20,
  30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
  40, 40, 40, 40, 40, 40, 40, 40, 40, 40,
  50
] as const

export const MAX_COMBO_MULTIPLIER = 50

/** The multiplier for a chain of `n` squishes. Saturates at ×50. */
export const comboMultiplier = (n: number): number => {
  if (!Number.isFinite(n) || n <= 0) return 1
  const i = Math.floor(n)
  return i >= COMBO_LADDER.length ? MAX_COMBO_MULTIPLIER : COMBO_LADDER[i]!
}

/** True when squish `n` crossed onto a NEW rung — the moment worth announcing
 *  with a bigger pop, a harder shake and a rising chime. */
export const isComboStepUp = (n: number): boolean =>
  n > 1 && comboMultiplier(n) > comboMultiplier(n - 1)

// ─── Growth Spurt: the chain made physical ──────────────────────────────────
//
// The chain was a number in a corner, "the whole of this game's skill
// expression" and invisible in the fiction (`tutorial.ts` says so). So every
// rung now INFLATES THE SHOE: the stomp circle grows with the multiplier, which
// makes a chain feed itself — a bigger shoe takes two ants where it took one —
// and a broken chain is felt as the shoe going *pfffft* back to size.
//
// Indexed by RUNG, not by squish count: the ladder has ten distinct rungs
// (×1 ×2 ×3 ×5 ×8 ×12 ×20 ×30 ×40 ×50), and a growth per squish would make the
// shoe creep instead of boing. Front-loaded, because the rungs a child actually
// reaches are the first four; saturating at +40 %, because past that the ring
// stops agreeing with the painted shoe and an ace's chain plays the level for
// them. Pinned monotone and capped in `combo.test.ts`.

/** Radius bonus per rung, as a fraction of the shoe's own radius. */
export const GROWTH: readonly number[] = [0, 0.06, 0.12, 0.18, 0.24, 0.30, 0.34, 0.37, 0.39, 0.40] as const

/** The distinct multipliers, in order — the rungs `GROWTH` is indexed by. */
export const COMBO_RUNGS: readonly number[] = [1, 2, 3, 5, 8, 12, 20, 30, 40, 50] as const

/** Which rung a multiplier stands on, 0-based. */
export const chainRung = (multiplier: number): number => {
  let rung = 0
  for (let i = 0; i < COMBO_RUNGS.length; i++) if (multiplier >= COMBO_RUNGS[i]!) rung = i
  return rung
}

/** How big the shoe is for a multiplier: 1 at no chain, 1.40 at ×50. */
export const chainScale = (multiplier: number): number => 1 + (GROWTH[chainRung(multiplier)] ?? 0)

/**
 * The largest the stomp radius may ever be, as a multiple of the shoe's own
 * radius — Fever and Growth Spurt stacked. The gilded boot stays the biggest
 * thing in the game (2.35 alone), and a chain on top of it may push it a little
 * further, never to "the whole board".
 */
export const MAX_RADIUS_SCALE = 2.6

/**
 * Which comic word a chain earns. Four tiers, and they are the four words on the
 * reference sheet — the vocabulary is part of the game's identity, so the
 * mapping lives here rather than being improvised at the call site.
 */
export type SplatWord = 'squish' | 'crunch' | 'splat' | 'ultra'

export const splatWord = (multiplier: number): SplatWord => {
  if (multiplier >= 20) return 'ultra'
  if (multiplier >= 8) return 'splat'
  if (multiplier >= 3) return 'crunch'
  return 'squish'
}

/** Points for one squish. Integer, so the HUD never shows a fraction. */
export const squishScore = (base: number, multiplier: number): number =>
  Math.round(Math.max(0, base) * Math.max(1, multiplier))

// ─── Screen feel ────────────────────────────────────────────────────────────

/**
 * How hard the camera kicks for a chain, 0..1.
 *
 * Capped well below 1 for the ordinary case: a screen that is permanently
 * shaking is a screen nobody can aim on, and this game asks for precision at
 * exactly the moments the chain is highest. The curve is `sqrt`, so the first
 * few rungs are felt and the top ones only lean.
 */
export const comboShake = (multiplier: number): number =>
  Math.min(0.62, 0.16 + 0.46 * Math.sqrt(Math.min(1, (multiplier - 1) / 49)))

/**
 * Background-music playback rate for a chain — GDD §8.2, "the track speeds up
 * as the multiplier rises".
 *
 * Shallow and saturating, for the reason the crowd-runner's version was: +16 %
 * is a tone and a half on a loop, which reads as the run tightening. More is
 * heard as a broken tape.
 */
export const MUSIC_RATE_RANGE = 0.16

export const comboMusicRate = (multiplier: number): number =>
  1 + MUSIC_RATE_RANGE * Math.min(1, (multiplier - 1) / 19)

// ─── The Juice vial ─────────────────────────────────────────────────────────

/**
 * Juice bleeds away while nothing is being squished, per second.
 *
 * Small — a vial that drained fast would punish a player for reading the board,
 * which is exactly what the dodgers and the armoured tiers are asking them to
 * do. It exists only so a vial cannot be filled across three separate minutes
 * of idling and cashed in at a moment that had nothing to do with earning it.
 */
export const JUICE_DECAY_PER_S = 0.012

/**
 * …and it only bleeds once nothing has been squished for this long, ms.
 *
 * The header above always SAID "while nothing is being squished", and the code
 * decayed on every step — so a 30-second 1-1 lost a third of a vial, most of it
 * during lesson pauses the player was being told to watch. Measured in
 * `RETENTION-FEATURES.md` §1: with this grace the first Fever lands around two
 * minutes in for a median child instead of never.
 */
export const JUICE_DECAY_GRACE_MS = 2000

/**
 * How much the chain multiplies juice gain.
 *
 * This is the whole reason the two systems are one system: a chain does not
 * just score more, it FILLS FASTER, so a good run snowballs into a fever and a
 * fever rebuilds the chain. Capped at ×2.5 so a top-rung chain cannot fill the
 * vial in three squishes.
 */
export const juiceComboBoost = (multiplier: number): number =>
  Math.min(2.5, 1 + 0.1 * (multiplier - 1))

export const juiceGain = (bugJuice: number, multiplier: number): number =>
  Math.max(0, bugJuice) * juiceComboBoost(multiplier)

/**
 * Apply `dtMs` of decay to a vial level.
 *
 * A FULL vial never decays. That is not a rounding nicety, it is the whole
 * feature working at all: the gain is clamped to exactly 1 and the very next
 * simulation step used to take it back below the line, so `feverReady` was true
 * for at most one frame and the FEVER button — which reads the ref, one frame
 * later — never lit up. A vial the player has filled is theirs until they spend
 * it; the bleed exists to stop a vial being assembled out of three separate
 * idle minutes, and a vial that is already full is not being assembled.
 */
export const decayJuice = (juice: number, dtMs: number): number =>
  juice >= 1 ? 1 : Math.max(0, juice - JUICE_DECAY_PER_S * (dtMs / 1000))

// ─── Splat Fever ────────────────────────────────────────────────────────────

/** Frenzy duration, ms. GDD §6.2. */
export const FEVER_MS = 10_000

/**
 * What the gilded boot is worth while it runs. Read by the sim and by the art.
 *
 * `radius` is the headline: the boot is visibly colossal, and a stomp that
 * looks that big has to clear that much. `score` is deliberately only ×1.5 —
 * fever's payoff is the CHAIN it builds (everything dies, so nothing breaks the
 * chain), not a raw multiplier stacked on top of one.
 */
export const FEVER = {
  radiusScale: 2.35,
  scoreScale: 1.5,
  /** Shockwave radius as a multiple of the already-scaled stomp radius. */
  shockScale: 2.6,
  /** Foot agility multiplier — the boot is huge but not slower. */
  agilityScale: 1.15
} as const

export interface FeverState {
  /** 0..1 — the vial. */
  juice: number
  /** ms remaining, 0 when not running. */
  remainMs: number
}

export const feverActive = (s: FeverState): boolean => s.remainMs > 0

/** True when the vial is full and the button should light up. */
export const feverReady = (s: FeverState): boolean =>
  s.remainMs <= 0 && s.juice >= 1

/** Spend the vial and start the frenzy. Returns the next state; a no-op when
 *  the vial is not full or a frenzy is already running. */
export const startFever = (s: FeverState): FeverState =>
  feverReady(s) ? { juice: 0, remainMs: FEVER_MS } : s

/**
 * Advance the frenzy clock and the vial's decay by `dtMs`.
 *
 * `idleMs` is how long it has been since the last squish; the vial only bleeds
 * once that passes `JUICE_DECAY_GRACE_MS`. Omitted, it decays as it always did
 * — the pure tests of the decay itself do not have to invent a kill clock.
 */
export const stepFever = (s: FeverState, dtMs: number, idleMs = Infinity): FeverState => {
  if (s.remainMs > 0) {
    return { juice: 0, remainMs: Math.max(0, s.remainMs - dtMs) }
  }
  if (idleMs < JUICE_DECAY_GRACE_MS) return s
  return { juice: decayJuice(s.juice, dtMs), remainMs: 0 }
}

// ─── The chain, as a state machine ──────────────────────────────────────────

export interface ChainState {
  /** Squishes on the current chain. */
  count: number
  /** ms left in the window before it lapses. */
  windowMs: number
  /** The best chain this level. */
  best: number
}

export const newChain = (): ChainState => ({ count: 0, windowMs: 0, best: 0 })

/** Register a squish. Returns the next state and the multiplier it earned. */
export const chainHit = (c: ChainState): { next: ChainState; multiplier: number } => {
  const count = c.count + 1
  return {
    next: { count, windowMs: COMBO_WINDOW_MS, best: Math.max(c.best, count) },
    multiplier: comboMultiplier(count)
  }
}

/** Register a miss or a spike — the chain is over. `best` survives. */
export const chainBreak = (c: ChainState): ChainState =>
  ({ count: 0, windowMs: 0, best: c.best })

/** Advance the window. Lapsing is the same thing as breaking. */
export const chainStep = (c: ChainState, dtMs: number): ChainState => {
  if (c.count === 0) return c
  const windowMs = c.windowMs - dtMs
  return windowMs <= 0 ? chainBreak(c) : { ...c, windowMs }
}

/** 0..1 — how much of the chain window is left. Drives the HUD's draining ring
 *  and, at the top of it, the urgency of the sound. */
export const chainUrgency = (c: ChainState): number =>
  c.count === 0 ? 0 : Math.max(0, Math.min(1, c.windowMs / COMBO_WINDOW_MS))
