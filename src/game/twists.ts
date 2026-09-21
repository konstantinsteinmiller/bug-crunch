/**
 * ─── Uh-oh! Twists: one set-piece surprise in the middle of a level ─────────
 *
 * Halfway through, something happens TO the board: the lemonade tips, the lights
 * go out, the sprinkler comes on, the arcade surges. It is the "turn" beat of a
 * level with a shape (open → build → TURN → close), and it is the picnic's
 * running joke played rather than watched — things keep going wrong for the
 * human, and the ants are delighted.
 *
 * ── The three rules every twist keeps ──
 *
 *   1. IT BENDS A SYSTEM THE PLAYER ALREADY KNOWS. Honey's slow, salt's panic,
 *      the conveyor's drift, the cutscenes' torch. Nothing new to memorise.
 *   2. IT CARRIES A PAYOFF. `hazards.ts` says it about the floor — opportunities
 *      before obstacles — and it holds here: the spill grounds fleas and lets the
 *      shoe skid, the lights coming back FREEZE everything for a free chain.
 *   3. IT TELLS FIRST. 1.2 s of warning, every time: bodies slow to 0.6×, a round
 *      pictogram pulses top-centre, a sting plays. Wordless, like everything else.
 *
 * Keyed by level in `stages.ts` (`LevelSpec.twist`), so 3-4 is always the
 * blackout — the board is deterministic and a twist is part of the board.
 */

export type TwistId =
  /** The lemonade glass tips: a slick lane across the board. Bodies wade in it
   *  and cannot leap; a foot that lands in it and DRAGS skids. */
  | 'spill'
  /** A sprinkler sweeps the lawn: the water HERDS bodies into a line along the
   *  wet stripe it leaves — a free conga, if you are quick. */
  | 'sprinkler'
  /** The attic bulb pops: dark but for a torch round the shoe. Lights back on,
   *  and every body is frozen, blinking, for a second. */
  | 'blackout'
  /** A draught through the attic: bodies AND the shoe's landing drift sideways. */
  | 'draft'
  /** The belts reverse at double speed — then stop dead for two seconds, and
   *  everything that was riding them piles up. */
  | 'surge'
  /** The arcade glitches: robobugs freeze in a pixel stutter and drop their
   *  plates. For three seconds armour means nothing. */
  | 'glitch'

export interface TwistSpec {
  id: TwistId
  /** The warning: ms of slowed board and pulsing pictogram before it lands. */
  tellMs: number
  /** How long the twist itself runs, ms. */
  activeMs: number
  /** Body speed during the tell. */
  tellSpeed: number
  /** The payoff after it ends, ms — a freeze or a pile-up the player cashes in. */
  afterMs: number
}

const twist = (t: TwistSpec): TwistSpec => t

export const TWISTS: Readonly<Record<TwistId, TwistSpec>> = {
  spill: twist({ id: 'spill', tellMs: 1200, activeMs: 9000, tellSpeed: 0.6, afterMs: 0 }),
  sprinkler: twist({ id: 'sprinkler', tellMs: 1200, activeMs: 7000, tellSpeed: 0.6, afterMs: 0 }),
  // The dark is 8 s at most — long enough to be an event, short enough that a
  // child who does not like it is never in it for long.
  blackout: twist({ id: 'blackout', tellMs: 1200, activeMs: 8000, tellSpeed: 0.6, afterMs: 1000 }),
  draft: twist({ id: 'draft', tellMs: 1200, activeMs: 7000, tellSpeed: 0.6, afterMs: 0 }),
  surge: twist({ id: 'surge', tellMs: 1200, activeMs: 5000, tellSpeed: 0.6, afterMs: 2000 }),
  glitch: twist({ id: 'glitch', tellMs: 1200, activeMs: 3000, tellSpeed: 0.6, afterMs: 0 })
}

export const TWIST_IDS: readonly TwistId[] = Object.keys(TWISTS) as TwistId[]

export const twistSpec = (id: TwistId): TwistSpec => TWISTS[id]

/** Where in a level a twist lands, as a share of the quota. The turn. */
export const TWIST_AT = 0.5

/** How far the draught pushes, u/s — bodies, and the shoe's aim. */
export const DRAFT_PUSH = 11
/** How hard the sprinkler's stripe pulls a body onto it, per second. */
export const SPRINKLER_PULL = 2.4
/** The blackout's torch round the shoe, u. */
export const TORCH_R = 30
/** The surge: belt speed while it runs, as a multiple of `CONVEYOR_SPEED`. */
export const SURGE_SPEED = -2
