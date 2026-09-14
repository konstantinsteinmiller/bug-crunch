/**
 * ─── Things won during the campaign ─────────────────────────────────────────
 *
 * A player can WIN six different kinds of thing in Bug Crunch, and until this
 * module existed five of them were a line of text on the result screen that
 * scrolled past under a star animation. This is the catalogue of them and the
 * pure function that works out which ones a finished level just earned, so
 * `RewardRevealModal.vue` can hand each one over as a gift instead.
 *
 * ── Pure on purpose ──
 *
 * No Vue, no save layer, no i18n. The "what did I just win" question is the
 * one piece of this feature that is worth pinning in a test — the reveal is a
 * picture and a ribbon, but the QUEUE is arithmetic over a result — and a
 * module that reaches into `useBugCrunchState` cannot be asked what a player with
 * 33 stars wins for a two-star clear.
 *
 * The two impure halves live where they belong: the caller reads
 * `SEEN_BUGS_KEY` out of the blob and passes it in, and writes back whatever
 * `nextSeenBugs` returns. See the mounting notes in `RewardRevealModal.vue`.
 */

import type { BugId } from '@/game/bugs'
import type { ShoeId } from '@/game/shoes'
import type { WorldId } from '@/game/stages'
import { WORLD_COUNT } from '@/game/stages'
import type { RunTally } from '@/game/stars'
import { SHOES } from '@/game/shoes'

/**
 * One thing won, and everything the reveal needs to draw it.
 *
 * A discriminated union rather than a bag of optional fields: the modal
 * switches on `kind` to pick a picture, and a `{ kind: 'shoe' }` with no shoe
 * on it is a blank card at the exact moment the player is being handed a
 * present. The compiler refuses it here instead.
 */
export type CampaignReward =
  /** A star gate opened and a whole new world is playable. The biggest one. */
  | { kind: 'world'; world: WorldId }
  /** A pair of shoes is now in the player's Locker. Pushed by the Locker when
   *  a shoe is bought or granted — never inferred from a level result, because
   *  buying a shoe is something the player DID, not something they won. */
  | { kind: 'shoe'; shoe: ShoeId }
  /** The star total crossed one of `STAR_MILESTONES`. */
  | { kind: 'stars'; stars: number }
  /** A new personal-best single-level score. `previous` is what it beat. */
  | { kind: 'record'; score: number; previous: number }
  /** The idle chest paid out. `gold` marks the ten-minute prize — only that
   *  one is worth a gift screen; see `TreasureChest.vue`. */
  | { kind: 'chest'; coins: number; gold: boolean }
  /** A bug species met for the very first time. */
  | { kind: 'foe'; bug: BugId }

/** Narrow a reward to its kind, for the modal's per-kind picture. */
export type CampaignRewardKind = CampaignReward['kind']

/**
 * Star totals worth stopping the game for.
 *
 * Not round numbers, and not every gate. The first five are exactly the five
 * shoe star gates (`SHOES[*].starGate` — 9, 15, 24, 36, 48): each one is the
 * moment a new pair APPEARS ON THE SHELF, which is the only thing a star total
 * does for a player besides opening worlds, and worlds already have a card of
 * their own. Celebrating an arbitrary "20 stars!" teaches nothing; celebrating
 * the number that just made the Roller Skate buyable points at the Locker.
 *
 * The last three cover the tail, where the shoes have run out and the only
 * thing left to collect is the collection: 72 and 96 on the way to a perfect
 * 120 (forty levels × three stars).
 *
 * Derived from `SHOES` rather than typed out, so re-pricing a shoe's gate
 * cannot leave a milestone pointing at nothing.
 */
export const STAR_MILESTONES: readonly number[] = [
  ...SHOES.map((s) => s.starGate).filter((g) => g > 0),
  72, 96, 120
].sort((a, b) => a - b).filter((v, i, a) => a[i - 1] !== v)

/** The most stars a player can ever hold: forty levels at three each. */
export const MAX_STARS = 120

/**
 * A hard ceiling on how many gift screens one level result may produce.
 *
 * In normal play a level yields at most two (a boss clear that opens a world
 * and lands a milestone). The cap is for the abnormal one — a restored cloud
 * save, a wiped `bc_bugs_seen`, a cheat — where an unbounded queue would put a
 * six-year-old through a ten-screen parade of tap-to-continue before letting
 * them play again. The high-value cards are kept: the queue is trimmed from the
 * FRONT, and the front is the least significant end (see `rewardsForResult`).
 */
export const MAX_REVEALS = 4

/**
 * Everything a finished level needs to be turned into a list of reveals.
 *
 * Its own shape rather than `LevelResult` from `useSplatProgress`, because two
 * of these fields are BEFORE/AFTER pairs that `bankLevel` has already collapsed
 * by the time it returns — and because a game module must not depend on a
 * composable even for a type.
 */
export interface LevelOutcome {
  /** The run's tally. `byKind` is where a new species is found. */
  tally: RunTally
  /**
   * A world this clear opened, or null. Straight from `LevelResult.unlockedWorld`,
   * which is typed `number | null` — so it is taken as a number and RANGE-CHECKED
   * here rather than asking the caller to cast. A junk world id would otherwise
   * reach `WORLDS[id].theme` in the modal and throw on the one screen a player
   * cannot skip.
   */
  unlockedWorld: number | null
  /** The player's star total BEFORE this level was banked… */
  starsBefore: number
  /** …and after. A replay that improves a level raises both. */
  starsAfter: number
  /** This run's score beat the stored best. `LevelResult.isRecord`. */
  isRecord: boolean
  /** The best score as it stood BEFORE this run. 0 for a first-ever score. */
  previousBest: number
  /** Species the player had already met. Out of `SEEN_BUGS_KEY`. */
  seenBugs: readonly BugId[]
}

/** Species squished in this run that the player had never met before, in the
 *  order the campaign introduces them. */
export const newFoes = (
  tally: RunTally, seen: readonly BugId[]
): BugId[] => {
  const known = new Set<BugId>(seen)
  const fresh: BugId[] = []
  for (const [id, n] of Object.entries(tally.byKind) as [BugId, number | undefined][]) {
    if ((n ?? 0) > 0 && !known.has(id)) fresh.push(id)
  }
  // Stable order, so two players who meet the same two species in the same
  // level are shown them in the same order and a test can assert a list.
  return fresh.sort()
}

/**
 * The bestiary after this run. Feed the result back into `SEEN_BUGS_KEY`.
 *
 * Returns the SAME array when nothing changed, so a caller can skip the write
 * — which is most levels, and the write is a cloud push on a portal build.
 */
export const nextSeenBugs = (
  seen: readonly BugId[], tally: RunTally
): readonly BugId[] => {
  const fresh = newFoes(tally, seen)
  return fresh.length === 0 ? seen : [...seen, ...fresh]
}

/**
 * The reveals a finished level earned, in the order they should be shown.
 *
 * ── The order is a crescendo of SCOPE ──
 *
 * A new bug (one creature) → a new personal best (your own history) → a star
 * milestone (your whole collection) → a new world (the whole game). Each card
 * is about something larger than the one before it, so the sequence builds
 * instead of deflating, and the last thing a player sees before the result
 * screen is the biggest thing that happened.
 *
 * That ordering is also what makes `MAX_REVEALS` safe to trim from the front.
 *
 * A losing run can still earn a reveal: a new species met on a level that was
 * then failed is still a new species, and a record score can be posted on a
 * run that ran out of clock. Only the world unlock needs a clear, and
 * `unlockedWorld` already carries that.
 */
export const rewardsForResult = (outcome: LevelOutcome): CampaignReward[] => {
  const out: CampaignReward[] = []

  for (const bug of newFoes(outcome.tally, outcome.seenBugs)) {
    out.push({ kind: 'foe', bug })
  }

  // A FIRST score is not a "new best" — there was nothing to beat, and a gift
  // screen congratulating a six-year-old for having played the game once reads
  // as the game being surprised they managed it. `bankLevel` reports
  // `isRecord` for any score above zero-stored-best, which is every first run.
  if (outcome.isRecord && outcome.previousBest > 0 && outcome.tally.score > outcome.previousBest) {
    out.push({ kind: 'record', score: outcome.tally.score, previous: outcome.previousBest })
  }

  // At most one milestone can be crossed by one level (three stars is the most
  // a level can pay and the smallest gap in the ladder is six), but the highest
  // is taken rather than the lowest in case a restored save jumps several.
  const crossed = STAR_MILESTONES.filter(
    (m) => outcome.starsBefore < m && outcome.starsAfter >= m
  )
  const highest = crossed[crossed.length - 1]
  if (highest !== undefined) out.push({ kind: 'stars', stars: highest })

  const world = outcome.unlockedWorld
  if (world !== null && Number.isInteger(world) && world >= 1 && world <= WORLD_COUNT) {
    out.push({ kind: 'world', world: world as WorldId })
  }

  return out.length > MAX_REVEALS ? out.slice(out.length - MAX_REVEALS) : out
}
