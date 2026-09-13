// ─── Game-state field catalogue ─────────────────────────────────────────────
//
// Field names INSIDE the single `splatix_state` blob (see `useSplatixState.ts`).
// These are NOT separate localStorage keys — they are properties of the one
// persisted object — but they are still a contract with the player base:
// renaming any of them strands existing players' progress on the old field.
// Treat them as load-bearing constants.
//
// Everything is `sx_`-prefixed so `SaveMergePolicy.isPayloadKey` can allowlist
// the whole surface with a single prefix.

// ─── Meta progression ───────────────────────────────────────────────────────

/** Meta currency, banked at the end of every level and spent in the Locker. */
export const COINS_KEY = 'sx_coins'
/** Lifetime coins earned — never decremented by spending. */
export const TOTAL_COINS_KEY = 'sx_total_coins'

/**
 * Stars earned per level, as `{ [levelId]: 0..3 }`.
 *
 * The star is the unit of progress in this game: it gates the worlds, it prices
 * the shoes, and it is the only reason to replay a level that has already been
 * cleared. Stored per level rather than as a running total so a replay that does
 * better can RAISE a level's score without double-paying, and so the level-select
 * strip can draw the three pips it actually earned.
 */
export const LEVEL_STARS_KEY = 'sx_level_stars'

/**
 * The deepest level ever cleared, 1-based across all four worlds (1..40).
 *
 * The headline progress number, and what the world-unlock ladder reads.
 */
export const BEST_LEVEL_KEY = 'sx_best_level'

/**
 * The level the player is on right now, 1-based across all four worlds.
 *
 * A level is short (60-180 s) and its layout is regenerated deterministically
 * from this number alone, so there is nothing else to store: a reload — or
 * opening the game on another device after a cloud sync — drops the player at
 * the START of the level they were playing, never back at 1-1.
 */
export const LEVEL_KEY = 'sx_level'

/** Highest single-level score ever posted — what the leaderboard carries. */
export const BEST_SCORE_KEY = 'sx_best_score'
/** Longest Splat Chain ever held. */
export const BEST_COMBO_KEY = 'sx_best_combo'
/** Lifetime levels started. */
export const RUNS_KEY = 'sx_runs'
/** Lifetime bugs squished. */
export const TOTAL_SQUISHES_KEY = 'sx_total_squishes'

// ─── The Locker ─────────────────────────────────────────────────────────────

/** Shoe ids the player owns, as a string array. The starter sneaker is implied
 *  and re-seeded on read, so a corrupt or missing value can never leave a player
 *  barefoot. */
export const SHOES_OWNED_KEY = 'sx_shoes_owned'
/** The equipped shoe id. Falls back to the starter when it names something the
 *  player does not own (a save from a build where that shoe existed). */
export const SHOE_KEY = 'sx_shoe'

// ─── Levels the player has struggled with ───────────────────────────────────

/**
 * Levels the player has already failed, as `{ [levelId]: failCount }`.
 *
 * Drives the one-shot difficulty relief: every bug on a level you have failed
 * before moves ~12 % slower and the timer is ~10 % longer, capped at two rungs.
 * Deliberately persisted rather than session-only — being stuck is a
 * cross-session problem, and a child who closes the tab in frustration is
 * exactly the player the relief exists for.
 */
export const FAILED_LEVELS_KEY = 'sx_failed_levels'

// ─── Onboarding / one-shot UI nudges ────────────────────────────────────────

/**
 * The very first thing a new player ever sees: the wordless controls lesson,
 * held over level 1-1 until they have actually moved, stomped and slammed.
 *
 * Its own key rather than a reuse of `ONBOARDED_KEY`, and the reason is what
 * each one means. `ONBOARDED_KEY` retires the running control PRIMERS after a
 * cleared level; this retires a one-time lesson that ran before the game did.
 * Folding them together would replay the lesson for every existing player whose
 * save predates it — a tutorial in front of 1-1 for someone on world 3.
 */
export const TUTORIAL_KEY = 'sx_tutorial_seen'

/** First-run onboarding consumed flag — retires the running control hints. */
export const ONBOARDED_KEY = 'sx_onboarded'

/**
 * Which one-shot hints have already been shown, as `{ [hintId]: true }`.
 *
 * One map rather than a flag per hint, because the hints arrive across the whole
 * campaign — the beetle's shell on 1-4, the spikes on 2-2, the cobwebs on 3-1,
 * the conveyor on 4-1 — and by the time the late ones fire every player is
 * `onboarded`. Without this the mechanics most likely to read as bugs are
 * exactly the ones nobody is ever told about.
 */
export const HINTS_SEEN_KEY = 'sx_hints_seen'

/**
 * How many result screens the player has seen — win and lose alike.
 *
 * Drives the one-off pointer at the Locker button: a player who never notices
 * the shoes is playing the same level with the same tool over and over. Shown on
 * the first few screens only — after that it is nagging.
 */
export const RESULTS_SEEN_KEY = 'sx_results_seen'

/** One-time "you can afford a new shoe" spotlight on the Locker button. */
export const LOCKER_SPOTLIGHT_KEY = 'sx_locker_spotlight'

// ─── Accessibility / tone settings ──────────────────────────────────────────

/**
 * Juice Style: `ooze` (default cartoon slime), `confetti` (piñata) or `bubble`
 * (soap bubbles). GDD §2.2 — the toggle that lets a squeamish or very young
 * player keep the game. It is a palette and a particle shape, never a rule.
 */
export const JUICE_STYLE_KEY = 'sx_juice_style'

/** High-visibility stomp ring — a thicker, brighter shadow indicator. */
export const HIGH_VIS_KEY = 'sx_high_vis'

/** Single-Tap Mode — a tap anywhere flies the foot to the nearest bug. */
export const SINGLE_TAP_KEY = 'sx_single_tap'

// ─── User settings ──────────────────────────────────────────────────────────

/** SFX volume, 0..1. */
export const SOUND_KEY = 'sx_user_sound'
/** Music volume, 0..1. */
export const MUSIC_KEY = 'sx_user_music'
/** UI locale — one of `LANGUAGES`. Absent means "never chosen on any device",
 *  which is what lets the portal locale seed a first-time player. */
export const LANGUAGE_KEY = 'sx_user_language'
/** `easy` | `medium` | `hard` — scales bug speed, spawn budget and timers. */
export const DIFFICULTY_KEY = 'sx_user_difficulty'
/** Background music track id. */
export const MUSIC_TRACK_KEY = 'sx_music_track'
/** Haptics on/off. */
export const HAPTICS_KEY = 'sx_haptics'

// ─── Leaderboard identity ───────────────────────────────────────────────────

/** Anonymous stable player id used by the leaderboard. */
export const PLAYER_ID_KEY = 'sx_player_id'
/** The player's chosen board name. */
export const PLAYER_NAME_KEY = 'sx_player_name'
/** Per-device cache of the last board fetch — the middle rung of the offline
 *  ladder (live fetch → this → build-time snapshot). */
export const BOARD_CACHE_KEY = 'sx_board_cache'
/** The rank estimated from the histogram curve, pinned for the session so the
 *  number on the result screen never jitters between two runs. */
export const RANK_PIN_KEY = 'sx_rank_pin'

// ─── Ad bookkeeping ─────────────────────────────────────────────────────────

/** Rolling window of recent rewarded grants, for the portal rate limits. */
export const REWARD_WINDOW_KEY = 'sx_reward_window'
/** When the first-load interstitial was last shown. */
export const FIRST_LOAD_AD_KEY = 'sx_first_load_ad'

/** The board name last posted, so a rename can be detected and re-posted. */
export const POSTED_NAME_KEY = 'sx_posted_name'
/** The highest score already submitted — the write gate that keeps the board
 *  free of duplicate rows for the same run. */
export const SUBMITTED_SCORE_KEY = 'sx_submitted_score'
/** A generated anonymous name ("Stomper 4821"), held so it never re-rolls. */
export const ANON_NAME_KEY = 'sx_anon_name'
/** The name the platform SDK reported for the signed-in player, if any. */
export const SDK_NAME_KEY = 'sx_sdk_name'

/** Mobile hard-mute — the player silenced the game to play their own audio. */
export const MOBILE_MUTE_KEY = 'sx_mobile_mute'
