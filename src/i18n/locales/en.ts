// English source bundle. Single source of truth for translation keys — every
// new player-facing string gets a key here first; the per-language files in
// this folder mirror the shape. Vite ships each non-English locale as its own
// lazy chunk (see `src/i18n/index.ts`).
export default {
  'gameName': 'Survivalist',
  'cancel': 'Cancel',
  'close': 'Close',
  'ok': 'Ok',
  'continue': 'Continue',
  'tapToContinue': 'Tap to continue',
  'clickToContinue': 'Click to continue',
  'rewards': 'REWARDS',
  'tip': 'Tip',
  'crazyGamesOnly': 'This game is only available on',

  // ─── Shared UI labels ─────────────────────────────────────────────────────
  //
  // NOT DEAD KEYS. The icon pass replaced button captions with glyphs
  // (skip-forward, replay, the shop cart), and a glyph has no accessible name
  // of its own — so these survive as the `aria-label` on icon-only controls.
  // They are read aloud, not seen, which is exactly why nothing on screen will
  // tell you when one goes missing.
  //
  // Only the generic names with no existing home live here. A control whose
  // action the game already names uses THAT key instead — the settings cog is
  // `options.title`, the cart is `upgrades.title`, the trophy is
  // `leaderboard.title` — so no word is translated twice. See the fallback map
  // in `FHudButton.vue`.
  'ui': {
    'next': 'Next',
    'replay': 'Replay',
    'back': 'Back',
    'play': 'Play',
    'pause': 'Pause',
    'menu': 'Menu',
    'home': 'Home',
    'info': 'Info'
  },

  // ─── HUD ──────────────────────────────────────────────────────────────────
  'hud': {
    'stage': 'Stage {n}',
    'best': 'Best {n}',
    'boss': 'Boss',
    'miniboss': 'Miniboss',
    // Live fire-rate chip. It sits in a HUD pill next to a number, so every
    // locale keeps this to ~6 characters.
    'fireRate': 'Rate',
    'incoming': 'Incoming attack!',
    'dodge': 'Dodge',
    // ─── The weapon tag ─────────────────────────────────────────────────────
    // Both are `aria-label`s on a badge that is otherwise a glyph and two dots,
    // so they are READ ALOUD and never seen. Translate for clarity, not for
    // brevity — nothing on screen depends on their length.
    // `{n}` / `{total}` are the levers pulled and the levers there are.
    'weaponActive': '{name} ready',
    'weaponLocked': '{name} locked — {n} of {total} levers shot'
  },

  // ─── The per-stage weapons ────────────────────────────────────────────────
  // Shown on a HUD badge roughly 8 characters wide before it ellipsises, so
  // prefer the SHORT name a player would say out loud ("Gatling", "Rockets")
  // over the full mechanical one. The glyph beside it already says what it is.
  'weapons': {
    'rocket': 'Rocket Launcher',
    'gatling': 'Gatling Gun'
  },

  // ─── Control hints ────────────────────────────────────────────────────────
  // Each has a touch and a pointer phrasing — a wrong verb reads as a bug.
  // These render in a single pill at the top of a phone screen: keep every
  // translation short and punchy rather than literal.
  // ─── First-run controls lightbox ──────────────────────────────────────────
  // Shown ONCE, over a frozen road, under an animated swipe/pointer glyph. It
  // is the only instruction in the game a player cannot dismiss without doing,
  // so it has to fit on one line of a 320 px phone: an instruction, not a
  // sentence. Translate for brevity over literalness.
  'tutorial': {
    'touch': 'Swipe to move your squad',
    'desktop': 'Move the mouse to steer your squad'
  },
  'hints': {
    'move': {
      'touch': 'Tap to move',
      'desktop': 'Click to move'
    },
    'gate': {
      'touch': 'Keep shooting a gate — it grows +1 every half second',
      'desktop': 'Keep shooting a gate — it grows +1 every half second'
    },
    'trap': {
      'touch': 'Red gates SHRINK your squad — take the other side!',
      'desktop': 'Red gates SHRINK your squad — take the other side!'
    },
    'divider': {
      'touch': 'Never touch the pillar between gates',
      'desktop': 'Never touch the pillar between gates'
    },
    // Two crate flavours now, so the hint has to name the colour.
    'crate': {
      'touch': 'Green crates make everyone hit harder',
      'desktop': 'Green crates make everyone hit harder'
    },
    'rate': {
      'touch': 'Blue crates make everyone shoot faster',
      'desktop': 'Blue crates make everyone shoot faster'
    },
    'boss': {
      'touch': 'Stay out of the red ring!',
      'desktop': 'Stay out of the red ring!'
    },
    // The weapon puzzle, shown once ever, while an unshot lever is on screen.
    // The two things it must carry are BOTH and WHERE: a player who shoots one
    // post and stops has done nothing, and a player looking down the middle of
    // the road will never find either. Keep it to one line on a 320 px phone.
    'lever': {
      'touch': 'Shoot BOTH levers at the road edges — they open the weapon box',
      'desktop': 'Shoot BOTH levers at the road edges — they open the weapon box'
    },
    // Fires the first time the boss shields. Without it the phase reads as a
    // broken hitbox — the player IS still shooting, and it IS doing nothing.
    'guard': {
      'touch': 'Shield up — your fire does nothing. MOVE!',
      'desktop': 'Shield up — your fire does nothing. MOVE!'
    }
  },

  // ─── Result / stage summary ───────────────────────────────────────────────
  'flow': {
    'unlocked': 'Unlocked!'
  },
  'result': {
    'stageClear': 'Stage Clear!',
    'wipedOut': 'Squad Wiped Out',
    'reachedStage': 'Stage {n}',
    'newRecord': 'New record!',
    // Badge for a retried stage whose enemies came back weakened.
    'rallied': 'Second wind',
    'peakSquad': 'Biggest squad',
    'kills': 'Kills',
    // ─── The ×3, the game's primary income ──────────────────────────────────
    // The label renders as `[film] 3× [coin] (+123)` — two strings with a coin
    // ICON between them, so the currency never has to be named in 21 languages
    // and the button stays short enough for a 320 px screen.
    //
    // Split in two because the multiplier's ORDER is locale-dependent (`3×` in
    // most, `×3` in ru/uk/kk/ar) while the bonus is the same shape everywhere.
    // `tripleBonus` takes {n} = the BONUS the video adds, not the new total.
    'tripleCoins': '3×',
    'tripleBonus': '(+{n})',
    'tripleClaimed': 'Coins tripled!',
    'nextStage': 'Next stage',
    'tryAgain': 'Try again',
    'upgrade': 'Upgrade',
    'upgradeHint': 'Upgrade your squad!',
    'rankOf': 'of {n}',
    'upNext': 'Up next: Stage {n}'
  },

  // ─── Leaderboard ──────────────────────────────────────────────────────────
  // A four-column table on a 320 px phone, so every column header has to be one
  // short word — translate for brevity over literalness, and reuse whatever
  // this locale already calls a stage and a squad elsewhere in this file.
  //
  // `{n}` in `yourRank` is NOT always a number: it is `100+` once the player is
  // past the last published row, so no locale may wrap it in a grammatical case
  // or a counter that only works for digits.
  'leaderboard': {
    'title': 'Leaderboard',
    'rank': '#',
    'player': 'Player',
    'stage': 'Stage',
    'squad': 'Squad',
    'empty': 'No runs posted yet. Be the first.',
    'failed': "Couldn't reach the leaderboard.",
    'loading': 'Loading…',
    'you': 'You',
    'yourRank': 'You are #{n}',
    'of': 'of {n} players'
  },

  // ─── Upgrades ─────────────────────────────────────────────────────────────
  // ─── The idle treasure chest ──────────────────────────────────
  //
  // The chest is a drawing with a number under it and no words of its own, so
  // these are what a screen reader has to work with. One line per STATE:
  // announcing "treasure chest" for a chest that cannot be opened for another
  // four minutes tells the player nothing they can act on. `label` is the
  // floor under the glyph itself — see `iconLabels.ts`.
  'chest': {
    'label': 'Treasure chest',
    'ready': 'Open the treasure chest for {n} coins',
    'filling': 'Treasure chest — filling up',
    'spent': 'Treasure chest — empty until tomorrow'
  },

  'skills': {
    'grenade': 'Grenade',
    'shield': 'Shield'
  },
  'upgrades': {
    'title': 'Upgrades',
    'spotlight': 'Spend!',
    'level': 'Lv {n}',
    'maxed': 'Maxed',
    'names': {
      'squad': 'Squad',
      'power': 'Firepower',
      'rate': 'Fire Rate',
      'range': 'Reach',
      'scavenge': 'Scavenging',
      'grenade': 'Grenade',
      'shield': 'Shield',
      // The two weapon tracks. Named for the WEAPON rather than for the stat,
      // because the player's question in the shop is "which of the two things I
      // keep finding do I want to be better", not "what does this percentage do".
      'rocket': 'Rocket Power',
      'gatling': 'Gatling Power'
    },
    'descriptions': {
      'squad': 'Start every stage with more survivors.',
      'power': 'Every survivor deals more damage per shot.',
      'rate': 'Every survivor shoots faster.',
      'range': 'Your squad opens fire further up the road.',
      'scavenge': 'Earn more coins from every run.',
      'grenade': 'Throw a grenade for a burst of heavy damage.',
      'shield': 'Halve the damage your squad takes for a few seconds.',
      'rocket': 'Rocket launchers you unlock on a stage deal more damage.',
      'gatling': 'Gatling guns you unlock on a stage deal more damage.'
    }
  },

  // ─── Options ──────────────────────────────────────────────────────────────
  'options': {
    'title': 'Options',
    'general': 'General',
    'audio': 'Audio',
    'language': 'Language',
    'difficulty': 'Difficulty',
    'soundEffects': 'Sound Effects',
    'music': 'Music',
    'musicTrack': 'Music Track',
    'musicTracks': {
      'cozy': 'Cozy Harmony',
      'trance': 'Trance Tunnel'
    },
    'close': 'Save & Close',
    'difficulties': {
      'easy': 'Easy',
      'medium': 'Medium',
      'hard': 'Hard'
    },
    'difficultyHints': {
      'easy': 'Softer enemies and thinner barricades.',
      'medium': 'The standard run.',
      'hard': 'Tougher enemies and heavier barricades.'
    }
  },

  // ─── System ───────────────────────────────────────────────────────────────
  'adsBlocked': {
    'title': "Couldn't show ad",
    'body': 'We tried to show you a video so you could earn your reward, but something on your browser is blocking ads.',
    'allowPrefix': 'Please allow ads on',
    'allowSuffix': '(or pause your ad-blocker for this game) and try again.',
    'gotIt': 'Got it'
  },
  'saveStatus': {
    'restoredTitle': 'Cloud save restored',
    'restoredBody': '+{n} bonus coins for the recovery',
    'tap': 'tap',
    'pausedTitle': 'Cloud sync paused',
    'pausedBody': 'Playing offline. Your progress is saved here.',
    'retry': 'Retry',
    'dismiss': 'dismiss'
  },
  'loading': {
    'tooLong': 'Loading taking too long? Try disabling your ad blocker and refresh.',
    // The splash mascot's two-beat gag: the little ghost pops out with the
    // first line, then drops the act and giggles. Both are onomatopoeia, so
    // every locale wants its OWN startle noise and laugh, not a translation
    // of the English letters.
    'boo': 'Boo!',
    'laugh': 'Hahaha!'
  },
  'license': {
    'denied': 'Access Denied: Please purchase a license.'
  }
}
