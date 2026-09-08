// What counts as LIVE GAMEPLAY — the predicate behind every portal's
// gameplayStart / gameplayStop bracket.
//
// This is a portal contract, not a view detail. CrazyGames counts the session
// between the two events; Poki measures conversion-to-play on the first
// `gameplayStart()` and takes a screen wake lock for the duration of the
// bracket. So every reason the game is not being played has to close it, and a
// missing one is invisible until a reviewer reads the SDK event log.
//
// The tab-away and portal-pause arms are here because they were MISSING: both
// already halted the simulation via `isGamePaused`, so the game looked correct
// while the portal was never told, and a player who switched tabs mid-run left
// an open bracket behind them.

import { describe, expect, it } from 'vitest'
import { isGameplayLive, type GameplayLiveInputs } from '@/use/useGameplayLifecycle'

/** A player mid-run with nothing in the way. Each test negates one thing. */
const playing: GameplayLiveInputs = {
  phase: 'run',
  showResult: false,
  anyModalOpen: false,
  adShowing: false,
  visibilityHidden: false,
  platformPaused: false,
  tutorialActive: false
}

describe('isGameplayLive', () => {
  it('is live while a run or a boss fight is in progress', () => {
    expect(isGameplayLive(playing)).toBe(true)
    expect(isGameplayLive({ ...playing, phase: 'boss' })).toBe(true)
  })

  it('is not live in the terminal phases — the run is over either way', () => {
    expect(isGameplayLive({ ...playing, phase: 'clear' })).toBe(false)
    expect(isGameplayLive({ ...playing, phase: 'wipe' })).toBe(false)
  })

  // ─── The two that were missing ───────────────────────────────────────────

  it('STOPS on tab away', () => {
    expect(isGameplayLive({ ...playing, visibilityHidden: true })).toBe(false)
  })

  it('STOPS when the portal SDK asks the game to pause', () => {
    expect(isGameplayLive({ ...playing, platformPaused: true })).toBe(false)
  })

  it('comes back live when the player returns to the tab', () => {
    // The bracket must REOPEN, not stay closed — a stop with no matching start
    // costs the rest of the session's playtime on every portal that measures it.
    const away = { ...playing, visibilityHidden: true }
    expect(isGameplayLive(away)).toBe(false)
    expect(isGameplayLive({ ...away, visibilityHidden: false })).toBe(true)
  })

  // ─── The ones that were already right ────────────────────────────────────

  it('STOPS on menu entry', () => {
    expect(isGameplayLive({ ...playing, anyModalOpen: true })).toBe(false)
  })

  it('STOPS while an ad is on screen', () => {
    expect(isGameplayLive({ ...playing, adShowing: true })).toBe(false)
  })

  it('STOPS while the result screen is up', () => {
    expect(isGameplayLive({ ...playing, showResult: true })).toBe(false)
  })

  it('is not live during the onboarding hold', () => {
    // The road is frozen and no stage is running. A `gameplayStart` here opens a
    // session the player has not begun — and on Poki inflates the very C2P
    // number the web fit test grades.
    expect(isGameplayLive({ ...playing, tutorialActive: true })).toBe(false)
  })

  it('needs EVERY reason to clear before it reports live again', () => {
    // Overlapping stops are the normal case: a modal opened while the tab was
    // hidden, an ad that opened during a portal pause. Dropping one must not
    // reopen the bracket.
    const stopped = { ...playing, visibilityHidden: true, anyModalOpen: true }
    expect(isGameplayLive({ ...stopped, visibilityHidden: false })).toBe(false)
    expect(isGameplayLive({ ...stopped, anyModalOpen: false })).toBe(false)
    expect(isGameplayLive({ ...stopped, visibilityHidden: false, anyModalOpen: false }))
      .toBe(true)
  })
})
