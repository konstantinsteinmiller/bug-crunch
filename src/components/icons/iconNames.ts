/**
 * ─── The glyph vocabulary ───────────────────────────────────────────────────
 *
 * One flat, closed list of every icon the UI can draw. It lives in its own
 * module rather than inside `GameIcon.vue` so a component can import the *type*
 * (`GameIconName`) for a prop without pulling the SFC — and, more importantly,
 * so a typo in a call site is a compile error instead of a silently blank
 * button.
 *
 * The redesign replaced most button captions with glyphs, which makes this list
 * load-bearing: `next` is no longer the word "Next", it is `skip-forward`.
 */
export const GAME_ICON_NAMES = [
  // Transport / run control
  'play', 'pause', 'replay', 'skip-forward', 'skip-back', 'stop',
  // Navigation
  'menu', 'home', 'back', 'forward', 'close', 'check',
  // Meta screens
  // `anvil` is the upgrade shop's mark — a rising chevron over an anvil, on
  // the HUD button and the result screen's button alike, so the thing tapped
  // during a run and the thing tapped after it are one object — and
  // `chest` is now the IDLE chest on the HUD, which pays coins for waiting.
  // They were one glyph until the chest became a thing of its own; two
  // buttons that do different things may not wear the same drawing.
  // `video` is a CAMCORDER — "this records" — and it marks the result screen's
  // ×3. `movie` is a FILM STRIP — "this plays" — and it marks the offer to
  // WATCH one: the Locker's ad-unlock button. Two glyphs rather than one
  // because they sit on opposite sides of the same transaction, and a child
  // who has learnt that the camcorder means "claim my bonus" must not read the
  // Locker's button as the same promise.
  'settings', 'shop', 'chest', 'anvil', 'video', 'movie', 'ads', 'book', 'info', 'help',
  // Audio
  'music', 'music-off', 'sound', 'sound-off',
  // Progression
  'lock', 'unlock', 'star', 'star-empty', 'trophy', 'chart', 'leaderboard',
  // Steppers / arrows
  'plus', 'minus', 'left', 'right', 'up', 'down',
  // Game nouns
  'coin', 'gem', 'heart', 'flask', 'wheel', 'gift', 'fullscreen', 'share',
  // ── Bug Crunch's own nouns ─────────────────────────────────────────────────
  // The five things this game is about, in the shared set because every one of
  // them appears on at least two surfaces: a HUD chip AND a result chip, or a
  // Locker row AND the button that opens it. A glyph re-traced per component is
  // the exact duplication this module exists to end.
  //
  //   bug     the squish counter, and the objective strip's "squish N of these"
  //   boot    the Locker, on its HUD button and on every row inside it
  //   splat   the Splat Chain — a burst, not a number
  //   target  accuracy, on the objective strip
  //   clock   the level timer, and the "finish with N seconds left" objective
  //   bolt    the Electric Sock's perk, in the Locker
  //   flame   Splat Fever, on the vial's button and on the objective strip
  //   skull   lifetime squishes, on the result screen
  //   shield  the "take no spike damage" objective, and the Steel Boot's perk
  'bug', 'boot', 'splat', 'target', 'clock', 'bolt', 'flame', 'skull', 'shield',
  // The incoming-hazard alarm. It lives in the shared set rather than inline
  // because the sweeper badge asks `ArtIcon` for its mark, and `ArtIcon`'s floor
  // is a glyph from this list — see `game/uiArt.ts`, which draws the same sign
  // on a canvas for the reference sheet.
  'warning'
] as const

export type GameIconName = (typeof GAME_ICON_NAMES)[number]

/** Runtime guard for the places a name arrives as a plain string (a legacy
 *  `FIconButton` call site, a config blob) and must be proven before use. */
export const isGameIconName = (v: unknown): v is GameIconName =>
  typeof v === 'string' && (GAME_ICON_NAMES as readonly string[]).includes(v)
