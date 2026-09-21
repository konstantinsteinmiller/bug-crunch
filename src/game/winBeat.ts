// ─── The win beat ───────────────────────────────────────────────────────────
//
// The moment a level is won, and how long the game holds on it before the
// result screen slides up.
//
// ── What was wrong ──
//
// The quota was met and the result screen opened 900 ms later, which sounds
// like a pause and is not one: 900 ms is roughly the length of the Big Finish's
// own confetti, so the screen arrived ON the celebration rather than after it.
// A player who had not been counting — which is every player who is actually
// playing rather than reading the rail — got no frame that said "that one did
// it". The level simply stopped and a scoreboard appeared.
//
// ── What it is now ──
//
// Three beats, in the order a win actually reads:
//
//   THE BLOW      the camera pushes in on the squash that met the condition, so
//                 the last thing the player did is the thing they are looking
//                 at. `useBugCrunchArt.focusOn` — an anchored zoom, not the
//                 centre punch, because the winning body is almost never in the
//                 middle of the board.
//   THE REASON    the condition itself comes up in the centre of the screen —
//                 the glyph, the number that was asked for, and a tick. This is
//                 the one screen in the game that answers "why did that end?"
//                 and it has to be readable in a glance, which is why it is a
//                 mark and a number rather than a sentence.
//   THE HOLD      two seconds of nothing. The sim is already stopped by then;
//                 this is the beat that turns a cut into an ending.
//
// ── Why the rules are HERE ──
//
// Same argument as `resultFlow.ts`: how long a screen holds a player who has
// not touched it is a design contract, and a contract that can only be asserted
// by mounting a canvas is one nobody asserts. Every number below is pure and
// pinned in `tests/game/winBeat.test.ts`.

import type { BossId } from '@/game/bosses'

/**
 * How long the camera takes to push in on the winning squash, ms.
 *
 * Short on purpose. A slow push is a cutscene, and this happens at the end of
 * every level in the game — roughly 24 times through the campaign, and far more
 * for anyone replaying for stars. It has to read as emphasis, not as a film.
 */
export const WIN_ZOOM_IN_MS = 420

/**
 * …and how long it takes to let go again, ms.
 *
 * Faster than the push, and deliberately: the way out of this beat is the
 * result screen sliding up, and a camera still travelling under a panel the
 * player is reading is motion nobody asked for.
 */
export const WIN_ZOOM_OUT_MS = 260

/** How far in the camera pushes — a scale of 1 + this. */
export const WIN_ZOOM_AMOUNT = 0.5

/**
 * When the condition card appears, ms after the level ends.
 *
 * AFTER the camera has started moving, not with it. Both arriving on the same
 * frame reads as a screen change — the thing we are trying to stop being — and
 * a card that lands while the push is already underway reads as a consequence
 * of the squash, which is what it is.
 */
export const WIN_CARD_AT_MS = 200

/** The freeze the owner asked for, ms: the card up, the camera in, nothing moving. */
export const WIN_FREEZE_MS = 2000

/**
 * A boss level's head start, ms.
 *
 * A boss death is a four-beat sequence in slow motion (`bossDeath`), and the
 * whole point of it is the body coming apart. Pushing the camera in and
 * dropping a card on top of that would cover the most expensive animation in
 * the game with a readout of a number. So the beat waits for the rupture and
 * the shout to land, and starts on the rain.
 *
 * It does NOT wait for the full afterglow. The body is still settling when the
 * card comes up, which is the right picture: the thing that killed it is what
 * the camera is holding on.
 */
export const WIN_BOSS_LEAD_MS = 900

/** The shape of one win beat, in ms from the frame the level was won. */
export interface WinBeatPlan {
  /** Nothing happens before this — the celebration already on screen owns it. */
  leadMs: number
  /** When the camera starts pushing in, and how long it takes. */
  zoomAtMs: number
  zoomMs: number
  /** How far it pushes. 0 on a reduced-motion build. */
  zoomAmount: number
  /** When the condition card comes up. */
  cardAtMs: number
  /** The total hold before anything is allowed to cover the board. */
  holdMs: number
}

export interface WinBeatInputs {
  /** A boss level — the death sequence gets its beats first. */
  boss: boolean
  /** Reduced motion: the push is dropped, the card and the hold are not. */
  calm: boolean
  /**
   * What the old code held for — `CELEBRATE_MS`, or a boss's afterglow.
   *
   * Passed in rather than re-derived because it is the renderer's number, and
   * because the hold may never come out SHORTER than it used to be: whatever
   * else this beat does, the confetti it was cutting off still has to finish.
   */
  celebrateMs: number
}

/**
 * The beat, as a timeline.
 *
 * Note that `calm` changes exactly one thing. Reduced motion is a request to
 * stop the screen moving, not a request to be told less: a player who cannot
 * take a camera push still deserves to know which condition ended their level,
 * and still deserves the two seconds to read it.
 */
export const winBeatPlan = (i: WinBeatInputs): WinBeatPlan => {
  const leadMs = i.boss ? WIN_BOSS_LEAD_MS : 0
  return {
    leadMs,
    zoomAtMs: leadMs,
    zoomMs: WIN_ZOOM_IN_MS,
    zoomAmount: i.calm ? 0 : WIN_ZOOM_AMOUNT,
    cardAtMs: leadMs + WIN_CARD_AT_MS,
    holdMs: Math.max(i.celebrateMs, leadMs + WIN_ZOOM_IN_MS + WIN_FREEZE_MS)
  }
}

// ─── What the card says ─────────────────────────────────────────────────────
//
// The condition that ended the level, which is NOT the same thing as the level's
// first star. `objectives[0]` is always `clear` — "Clear the level" — which is
// the one caption on the result screen that tells a player nothing they did not
// already know. What ended the level is one of exactly three things, and each
// one has a number worth showing:
//
//   the QUOTA   n bodies, and the card shows n of n;
//   the BOSS    one creature, and the card shows which;
//   the PARTY   the clock, and a party cannot be lost, so the clock IS the win.

export type WinCondition =
  | { kind: 'quota'; n: number }
  | { kind: 'boss'; id: BossId }
  | { kind: 'party' }

export interface WinConditionInputs {
  quota: number
  boss?: BossId | null
  party?: boolean
}

/**
 * Which condition the player just met.
 *
 * Order matters and is not arbitrary: a boss level carries a quota in its spec
 * that it never grades (the fight is the level), and a party carries the
 * timeout that is its only ending. Reading the quota first would put "40 of 40"
 * on the card at the exact moment a queen ant burst.
 */
export const winConditionOf = (i: WinConditionInputs): WinCondition | null => {
  if (i.party === true) return { kind: 'party' }
  if (i.boss) return { kind: 'boss', id: i.boss }
  if (i.quota > 0) return { kind: 'quota', n: i.quota }
  return null
}

/**
 * The glyph each condition wears.
 *
 * The same marks the objective strip uses, so a player reads this card with
 * something they already learned in world 1 — `bug` is the squish counter
 * everywhere in this game, and `clock` is the level timer everywhere in it.
 * `skull` is the one that is not already an objective glyph, and it is the
 * game's existing mark for a thing that has been killed (the lifetime-squish
 * chip on the result screen wears it).
 */
export const winConditionIcon = (c: WinCondition): 'bug' | 'skull' | 'clock' =>
  c.kind === 'quota' ? 'bug' : c.kind === 'boss' ? 'skull' : 'clock'

/**
 * The creature drawn on the card, if the condition has one.
 *
 * Only a boss does, and only because `ObjectiveList` already proved the point:
 * a tester cleared a level having never knowingly seen the creature the caption
 * named, because the only thing that said WHICH creature was a word. The name is
 * for the reader; the picture is for everybody else — and for a boss the
 * picture is the whole reward, because recognising the thing you have spent two
 * minutes hitting IS the drama (see `paintBoss`).
 */
export const winConditionBoss = (c: WinCondition): BossId | null =>
  c.kind === 'boss' ? c.id : null
