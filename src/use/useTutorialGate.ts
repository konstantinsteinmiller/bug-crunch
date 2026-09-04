/**
 * ─── The opening tutorial's clock ───────────────────────────────────────────
 *
 * Stage 1 is held with the road frozen and the crowd still answering the thumb
 * (`steerOnly`), because the one thing the tutorial has to teach is that moving
 * your finger moves the squad — and a paused game cannot demonstrate that. This
 * module owns the question of when that hold ends.
 *
 * It is a pure function over a small clock rather than a few counters inside the
 * scene, because the rule it encodes is easy to state, easy to get wrong, and
 * was in fact wrong in a way nothing could catch:
 *
 *   THE BAIL-OUT MEASURES THE PLAYER'S PRESENCE, NOT THE WALL CLOCK.
 *
 * The bail-out exists so that a player who cannot produce the gesture — a dead
 * trackpad, an iframe that never got pointer events, a child poking the screen
 * with no drag — is not held at a frozen road forever. That is a fair rule for
 * somebody who is trying and failing. It is the wrong rule for somebody who has
 * not been asked yet.
 *
 * Poki's playtest recording consent is the case that found it: a yes/no dialog
 * over the game at load, living outside the iframe, so the game receives no
 * input at all while the player reads it. The twelve seconds ran out before the
 * player had reached the game, the tutorial dismissed itself, and their first
 * sight of the game was one already in progress that they had been taught
 * nothing about. Nothing there is specific to Poki — an interstitial, a
 * permissions prompt, a portal's own chrome, or a tab opened in the background
 * all produce exactly the same thing on any platform.
 */

/** Moving time the player owes before the road starts. */
export const TUTORIAL_MOVE_MS = 1000

/**
 * …and the longest we will wait for it, once the player is actually here.
 *
 * Counted only from the first input. See the module note: before that, waiting
 * is not something the player is doing.
 */
export const TUTORIAL_BAILOUT_MS = 12_000

/** Movement below this per frame is noise — a resting hand, a spring settling. */
export const TUTORIAL_MOVE_EPS = 0.004

export interface TutorialClock {
  /** Time the SQUAD has actually been moving. */
  movedMs: number
  /** Time spent waiting for that, since the player's first input. */
  waitedMs: number
  /** Where the crowd was last frame, to measure movement against. */
  lastX: number
}

export const newTutorialClock = (startX: number): TutorialClock =>
  ({ movedMs: 0, waitedMs: 0, lastX: startX })

/** How the hold ended, or `null` while it is still running. */
export type TutorialOutcome = 'moved' | 'bailout' | null

export interface TutorialTick {
  /** 0..1, for the overlay's progress ring. */
  progress: number
  outcome: TutorialOutcome
}

/**
 * Advance the clock one frame.
 *
 * @param sawInput has the player touched the game even once? Until they have,
 *   NOTHING accrues — neither the lesson nor the patience for it.
 * @param crowdX where the crowd is now; movement is credited from its change,
 *   not from whether a finger is down. The lesson is "the crowd follows you",
 *   so the crowd has to have followed — a player who taps once and holds still
 *   has not learned it.
 */
export const tickTutorial = (
  clock: TutorialClock, dtMs: number, sawInput: boolean, crowdX: number
): TutorialTick => {
  if (!sawInput) {
    // Track the crowd anyway, so the frame the player does arrive is not
    // credited with every pixel the formation drifted while they were away.
    clock.lastX = crowdX
    return { progress: 0, outcome: null }
  }

  clock.waitedMs += dtMs
  if (Math.abs(crowdX - clock.lastX) > TUTORIAL_MOVE_EPS) clock.movedMs += dtMs
  clock.lastX = crowdX

  const progress = Math.min(1, clock.movedMs / TUTORIAL_MOVE_MS)
  if (clock.movedMs >= TUTORIAL_MOVE_MS) return { progress, outcome: 'moved' }
  if (clock.waitedMs >= TUTORIAL_BAILOUT_MS) return { progress, outcome: 'bailout' }
  return { progress, outcome: null }
}
