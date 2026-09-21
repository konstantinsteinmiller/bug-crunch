/**
 * ─── Boss Trophies: every boss drops a move you keep ────────────────────────
 *
 * Beat a boss and it hands over one of ITS tricks, for the rest of the game.
 * Not a skin and not a number: each move is a new verb on the input grammar the
 * player already owns — a double-tap, a press-and-drag, a full hold, a hold's
 * timing — and each one changes how every later level can be played, which is
 * what sends a player back to an old level for the star they could not reach.
 *
 * Pure data. The sim reads `StartOptions.moves`; the save holds `bc_moves`; the
 * gift screen shows the trophy as a `{ kind: 'move' }` reward.
 *
 * ── Four, and then it stops ──
 *
 * One per world's boss, taught one level after it is won by a practice
 * formation the move answers (`LevelSpec.practice`). The last boss drops
 * nothing: the finale is the reward, and a fifth verb nobody has a level left to
 * use is a trophy for the shelf.
 */

import type { BossId } from '@/game/bosses'

export type MoveId =
  /** Double-tap: the shoe spins on its heel. Wide, flips shells, 1.8 s cooldown. */
  | 'spin'
  /** Press and drag: the shoe skids along any floor, crushing what it crosses. */
  | 'skid'
  /** A FULL charge: the slam sends out a travelling ring that stuns and flips. */
  | 'quake'
  /** Every slam stomps again on the same spot 400 ms later. */
  | 'echo'

export interface MoveSpec {
  id: MoveId
  /** The fight that drops it — a level id, because the Queen is fought twice. */
  level: number
  boss: BossId
  /** The glyph on its trophy card — one the shared icon set already owns, so a
   *  trophy never needs a new painting before it can be handed over. */
  icon: 'wheel' | 'skip-forward' | 'splat' | 'replay'
}

export const MOVES: readonly MoveSpec[] = [
  // The half-strength Queen on 1-4: the first boss a child beats, and the move
  // that answers the RING formation 1-5 opens on. Her own trick — she spins.
  { id: 'spin', level: 4, boss: 'queenAnt', icon: 'wheel' },
  // The full Queen on 1-10. The drag a player has already met in the Spill twist
  // (1-7) and the Roller Skate trial (1-8) — this makes it theirs, on any floor.
  { id: 'skid', level: 10, boss: 'queenAnt', icon: 'skip-forward' },
  { id: 'quake', level: 20, boss: 'beetleKing', icon: 'splat' },
  { id: 'echo', level: 30, boss: 'matriarch', icon: 'replay' }
] as const

export const MOVE_IDS: readonly MoveId[] = MOVES.map((m) => m.id)

export const isMoveId = (v: unknown): v is MoveId =>
  typeof v === 'string' && (MOVE_IDS as readonly string[]).includes(v)

export const moveSpec = (id: MoveId): MoveSpec => MOVES.find((m) => m.id === id)!

/** The move a boss level drops, or null. */
export const moveForLevel = (level: number): MoveId | null =>
  MOVES.find((m) => m.level === level)?.id ?? null

/**
 * Every move a player who has cleared `bestLevel` owns.
 *
 * Derived rather than only stored, so a save from before trophies existed — a
 * player already on world 3 — owns exactly what they would have won, the first
 * time this build reads it.
 */
export const movesForBest = (bestLevel: number): MoveId[] =>
  MOVES.filter((m) => bestLevel >= m.level).map((m) => m.id)

// ─── The numbers ────────────────────────────────────────────────────────────

/** Heel Spin: reach as a multiple of the stomp radius, and its cooldown. */
export const SPIN_SCALE = 2.4
export const SPIN_COOLDOWN_MS = 1800

/** Quake Slam: the charge that sets it off, and the ring it sends. */
export const QUAKE_CHARGE = 0.95
export const QUAKE_SPEED = 60
export const QUAKE_REACH = 40
export const QUAKE_STUN_MS = 1400

/** Echo Stomp: how long after the slam the second stomp lands. */
export const ECHO_MS = 400
