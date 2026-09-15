// English source bundle. Single source of truth for translation keys — every
// new player-facing string gets a key here first; the per-language files in
// this folder mirror the shape. Vite ships each non-English locale as its own
// lazy chunk (see `src/i18n/index.ts`).
export default {
  'gameName': 'Bug Crunch',
  'cancel': 'Cancel',
  'close': 'Close',
  'ok': 'Ok',
  'continue': 'Continue',
  'tapToContinue': 'Tap to continue',
  'clickToContinue': 'Click to continue',
  'cutscene': {
    // The skip control on a cutscene. A cutscene never replays, so the
    // control is irreversible and gets a word rather than a bare glyph.
    'skip': 'Skip'
  },
  'rewards': 'REWARDS',
  'tip': 'Tip',
  'crazyGamesOnly': 'This game is only available on',

  // ─── Shared UI labels ─────────────────────────────────────────────────────
  //
  // NOT DEAD KEYS. Most button captions in this game are glyphs, and a glyph has
  // no accessible name of its own — so these survive as the `aria-label` on
  // icon-only controls. They are read aloud, not seen, which is exactly why
  // nothing on screen will tell you when one goes missing.
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
  // Every one of these sits in a pill beside a number on a 320 px phone, so
  // keep translations to ONE SHORT WORD wherever the English is one.
  'hud': {
    'score': 'Score',
    'time': 'Time',
    'chain': 'Splat Chain: {n}',
    'level': 'Level {n}'
  },

  // ─── The four worlds ──────────────────────────────────────────────────────
  // Shown on the level card, above the level number, in caps. Two short words
  // at most — a third wraps on a landscape phone.
  'worlds': {
    'picnic': 'Picnic Blanket',
    'backyard': 'Overgrown Backyard',
    'attic': 'Dusty Attic',
    'arcade': 'Neon Arcade'
  },

  // ─── The bestiary ─────────────────────────────────────────────────────────
  // Used inside objective captions ("Squish 4 Fleas") and read aloud on the
  // result screen. Keep them PLURAL-FRIENDLY and short: they are interpolated
  // into a sentence that already carries a number.
  'bugs': {
    'ant': 'Ants',
    'sprinter': 'Sprinter Ants',
    'beetle': 'Beetles',
    'flea': 'Fleas',
    'caterpillar': 'Caterpillars',
    'stinkbug': 'Stink Bugs',
    'centipede': 'Centipedes',
    'pinatafly': 'Piñata Flies',
    'moth': 'Moths',
    'robobug': 'Robo-Bugs'
  },

  // ─── The bosses ───────────────────────────────────────────────────────────
  'bosses': {
    'queenAnt': 'Goliath Queen Ant',
    'beetleKing': 'Thornback Beetle King',
    'matriarch': 'Centipede Matriarch',
    'roachPrime': 'Mecha Roach Prime'
  },

  // ─── Boss phase tells ─────────────────────────────────────────────────────
  // ONE SHORT INSTRUCTION each. This is the only text in the game that appears
  // while something is actively trying to beat the player, so it must be read
  // in a glance: an imperative verb and a noun, never a sentence.
  'boss': {
    'tell': {
      'stomp': 'Stomp the boss!',
      'summon': 'Clear the swarm!',
      'pods': 'Squish the eggs!',
      'charge': 'Hold to slam the charge!',
      'spin': 'Stay out of the ring!',
      'shield': 'Slam to break the shield!',
      'beam': 'Dodge the beam!'
    }
  },

  // ─── The six shoes ────────────────────────────────────────────────────────
  // `name` sits on a Locker card roughly 9 characters wide before it wraps to a
  // second line, which is fine — two lines is the design. `perk` is what it
  // gives you and `trade` is what it costs you; the Locker always shows both,
  // because a shop that only lists upsides is a shop that lies.
  'shoes': {
    'stats': {
      'speed': 'Speed',
      'radius': 'Stomp size',
      'pierce': 'Armour piercing'
    },
    'sneaker': {
      'name': 'Classic Sneaker',
      'perk': 'Balanced and quick to recover.',
      'trade': 'Master of nothing in particular.'
    },
    'steelBoot': {
      'name': 'Steel-Toed Boot',
      'perk': 'Spikes cannot hurt you. Slams stun everything nearby.',
      'trade': 'Heavy and slow to lift.'
    },
    'bunnySlipper': {
      'name': 'Bunny Slipper',
      'perk': 'Silent tread — jumpy bugs never see you coming.',
      'trade': 'Cannot crack a shell at all.'
    },
    'rollerSkate': {
      'name': 'Roller Skate',
      'perk': 'Stomp and keep dragging to plough a whole line.',
      'trade': 'A very narrow stomp.'
    },
    'cleatBoot': {
      'name': 'Cleat Boot',
      'perk': 'Studs punch straight through shells and stink sacs.',
      'trade': 'The smallest stomp in the Locker.'
    },
    'electricSock': {
      'name': 'Electric Sock',
      'perk': 'Every stomp arcs lightning to three more bugs.',
      'trade': 'The arcs only finish off weak ones.'
    }
  },

  // ─── The Locker ───────────────────────────────────────────────────────────
  'locker': {
    'title': 'Locker',
    'buy': 'Buy {n}',
    'wear': 'Wear',
    'worn': 'Worn',
    'needStars': '{n} more stars',
    'needCoins': '{n} more coins',
    // Screen-reader only: the collapsed card shows the NUMBER beside a coin or
    // a star, which needs no words for a player who can see it and needs all of
    // them for a player who cannot.
    'price': 'Price: {n} coins',
    'starGate': 'Unlocks at {n} stars',
    'adUnlock': 'Watch a video to unlock'
  },

  // ─── The treasure chest ───────────────────────────────────────────────────
  // Screen-reader text for the HUD chest. The chest itself says everything it
  // has to say with a picture, a payout chip and a countdown.
  'chest': {
    'label': 'Treasure chest',
    'ready': 'Open the treasure chest for {n} coins',
    'filling': 'Treasure chest — filling up',
    'spent': 'Treasure chest — empty until tomorrow'
  },

  // ─── The gift screen ──────────────────────────────────────────────────────
  //
  // Headlines on the ribbon (rendered uppercase, so two or three words), and
  // captions under the picture. The prize's own NAME is never here: a world is
  // `worlds.<theme>`, a shoe is `shoes.<id>.name`, a bug is `bugs.<id>`. A gift
  // screen that invented a second name for something the player has already met
  // would be introducing a stranger.
  'reveal': {
    'world': 'New place to stomp!',
    'shoe': 'New shoes!',
    'stars': 'Star milestone!',
    'record': 'New best score!',
    'chest': 'Treasure!',
    'foe': 'A new bug!',
    'starsTotal': '{n} stars',
    'recordScore': '{n} points',
    'recordBeat': 'Old best: {n}',
    'chestCoins': '+{n} coins'
  },

  // ─── Splat Fever ──────────────────────────────────────────────────────────
  // Screen-reader text for the vial button. Never seen.
  'fever': {
    'filling': 'Splat Fever: {n}% full',
    'ready': 'Splat Fever ready — tap to start',
    'running': 'Splat Fever running'
  },

  // ─── Objectives ───────────────────────────────────────────────────────────
  // Each of these is one row on a strip roughly 24 characters wide before it
  // wraps to a second line. Two lines is fine; three pushes the level card off
  // a landscape phone, so translate for BREVITY over literalness.
  'objectives': {
    'clear': 'Clear the level',
    'combo': 'Reach a ×{n} chain',
    'noSpike': 'Take no spike damage',
    'time': 'Finish with {n}s left',
    'accuracy': 'Hit {n}% of your stomps',
    'fever': 'Trigger Splat Fever {n}×',
    'kind': 'Squish {n} {bug}',
    'feverKills': 'Squish {n} in one Fever',
    'noMiss': 'Miss no more than {n} stomps',
    'score': 'Score {n} points'
  },

  // ─── Quest badges ─────────────────────────────────────────────────────────
  //
  // Screen-reader only, and the WHOLE accessible name of the two little discs
  // under the treasure chest during play: they are a glyph and a ring, with no
  // words and no numbers drawn on them at all.
  //
  // `{objective}` is one of the `objectives.*` strings above, already
  // translated and dropped in whole — translate only the tail, and move the
  // placeholder to wherever your language needs it.
  //
  // `title` names the PAIR. A sighted player is told what the two discs are by
  // the star each one is drawn on; this is the same sentence for somebody who
  // cannot see the star. Two or three words — it is read out before every one
  // of the badges below it.
  'quests': {
    'title': 'Star goals',
    'onTrack': '{objective} — on track',
    'progress': '{objective} — {n}% there',
    'missed': '{objective} — missed'
  },

  // ─── Control hints ────────────────────────────────────────────────────────
  //
  // Each has a touch and a pointer phrasing — a wrong verb reads as a bug.
  // These render in a single pill near the bottom of a phone screen: keep every
  // translation SHORT and punchy rather than literal.
  'hints': {
    'move': {
      'touch': 'Tap to move',
      'desktop': 'Click to move'
    },
    'slam': {
      'touch': 'Hold, then let go for a big slam',
      'desktop': 'Hold the button for a big slam'
    },
    'sprinter': {
      'touch': 'Sprinters run off — stomp where they stop',
      'desktop': 'Sprinters run from your shoe — hold still, then tap'
    },
    'beetle': {
      'touch': 'Beetles have shells — hold to slam them',
      'desktop': 'Beetles have shells — hold to slam them'
    },
    'flea': {
      'touch': 'Fleas jump away — hit where they land',
      'desktop': 'Fleas jump away — hit where they land'
    },
    'spike': {
      'touch': 'Do not stomp the spiky ones!',
      'desktop': 'Do not stomp the spiky ones!'
    },
    'stink': {
      'touch': 'Stink bugs blur the screen when squished',
      'desktop': 'Stink bugs blur the screen when squished'
    },
    'fever': {
      'touch': 'The vial is full — tap the flame!',
      'desktop': 'The vial is full — click the flame!'
    },
    'honey': {
      'touch': 'Honey holds jumpy bugs still',
      'desktop': 'Honey holds jumpy bugs still'
    },
    'web': {
      'touch': 'Cobwebs slow your foot down',
      'desktop': 'Cobwebs slow your foot down'
    },
    'belt': {
      'touch': 'The belt carries bugs along',
      'desktop': 'The belt carries bugs along'
    },
    'sweeper': {
      'touch': 'The sweeper squishes bugs for free',
      'desktop': 'The sweeper squishes bugs for free'
    },
    'boss': {
      'touch': 'Hold to slam when the boss winds up',
      'desktop': 'Hold to slam when the boss winds up'
    },
    'pods': {
      'touch': 'Squish the eggs before they hatch!',
      'desktop': 'Squish the eggs before they hatch!'
    }
  },

  // ─── Result screen ────────────────────────────────────────────────────────
  'result': {
    'cleared': 'Level Clear!',
    'timeUp': "Time's Up!",
    'upNext': 'Up next: {n}',
    'retryLevel': 'Try again?',
    'campaignDone': 'All levels cleared!',
    'newRecord': 'New record!',
    'nextLevel': 'Next level',
    'tryAgain': 'Try again',
    'squishes': 'Bugs squished',
    'starsEarned': '{n} of 3 stars',
    'rankOf': 'of {n}',
    'worldUnlocked': '{n} unlocked!'
  },

  // ─── Leaderboard ──────────────────────────────────────────────────────────
  'leaderboard': {
    'title': 'Leaderboard',
    'rank': 'Rank',
    'player': 'Player',
    'score': 'Score',
    'level': 'Level',
    'you': 'You',
    'yourRank': 'You are #{n} of {total}',
    'of': 'of {n}',
    'unranked': 'Clear a level to get on the board',
    'loading': 'Loading the board…',
    'empty': 'Nobody has posted a score yet',
    'failed': "Couldn't reach the leaderboard"
  },

  // ─── Options ──────────────────────────────────────────────────────────────
  'options': {
    'title': 'Settings',
    'general': 'General',
    'play': 'Play',
    'audio': 'Audio',
    'close': 'Save & close',
    'language': 'Language',
    'difficulty': 'Difficulty',
    'soundEffects': 'Sound effects',
    'music': 'Music',
    'musicTrack': 'Music track',
    'haptics': 'Vibration',
    'on': 'On',
    'off': 'Off',
    'difficulties': {
      'easy': 'Easy',
      'medium': 'Normal',
      'hard': 'Hard'
    },
    'difficultyHints': {
      'easy': 'Slower bugs and a longer clock.',
      'medium': 'The game as it was designed.',
      'hard': 'Faster bugs and a busier board.'
    },
    'musicTracks': {
      'trance': 'Bug Groove',
      'cozy': 'Cozy Picnic'
    },
    // ── Tone and accessibility ──
    // The hint under the picker says that the setting changes the LOOK and not
    // the difficulty. That sentence is load-bearing: a parent needs to know the
    // game is unchanged, and a child needs to know they have not made it easier.
    'juiceStyle': 'Splat style',
    'juiceStyles': {
      'ooze': 'Cartoon Ooze',
      'confetti': 'Confetti Piñata',
      'bubble': 'Bubble Pop'
    },
    'juiceStyleHints': {
      'ooze': 'Bright cartoon slime. Same game either way.',
      'confetti': 'Bugs burst into paper confetti. Same game either way.',
      'bubble': 'Bugs pop into soap bubbles. Same game either way.'
    },
    'highVis': 'Big stomp ring',
    'highVisHint': 'A thicker, brighter ring around where your foot will land.',
    'singleTap': 'Easy aim',
    'singleTapHint': 'Tap anywhere and your foot flies to the nearest bug.'
  },

  // ─── The loading screen ───────────────────────────────────────────────────
  // Two one-word speech bubbles from the bug on the splash, and one line for a
  // load that has taken far too long. Keep the bubbles to a SINGLE short word —
  // they sit inside a drawn speech balloon that does not resize.
  'loading': {
    'boo': 'Boo!',
    'laugh': 'Hee hee!',
    'tooLong': 'Still loading… check your connection?'
  },

  // ─── Save status ──────────────────────────────────────────────────────────
  // A banner over the top of the game. `restoredBody` interpolates the make-good
  // coins a cloud merge paid out; `pausedBody` is shown when the backend has
  // stopped answering and the game is holding writes.
  'saveStatus': {
    'restoredTitle': 'Progress restored',
    'restoredBody': 'We put your save back and added {n} coins.',
    'pausedTitle': 'Saving paused',
    'pausedBody': "We can't reach the save service. Your progress is safe on this device.",
    'retry': 'Retry',
    'dismiss': 'Dismiss',
    'tap': 'Tap to dismiss'
  },

  // ─── Ad blocker ───────────────────────────────────────────────────────────
  // `allowPrefix` and `allowSuffix` wrap the page's own domain, which the
  // component inserts between them — so the two halves must read as one
  // sentence with a domain in the middle.
  'adsBlocked': {
    'title': 'Ad blocker detected',
    'body': 'Bug Crunch is free because of ads. Please turn your ad blocker off and reload.',
    'allowPrefix': 'Allow ads on',
    'allowSuffix': 'and reload the page.',
    'gotIt': 'Got it'
  },

  'license': {
    'denied': 'This copy could not be verified'
  }
}
