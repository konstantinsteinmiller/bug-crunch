// ─── "Crunch Parade" — the Bug Crunch theme ─────────────────────────────────
//
// A sneaky bug parade that breaks into a stomping party. Cartoon funk in F
// mixolydian (the Eb is the cheek), 116 BPM with a 16th swing, 44 bars = 91.03 s,
// written to loop: the last bar hands straight back to the tiptoe of bar 1.
//
// The hook is two bars and it is built for THIS game. Bar one sneaks up (a
// 16th-note run on marimba, "da da-da DUM da-da DUM"); bar two is three
// unison hits on beats 1-2-3 — melody, bass, kick and clap together — and a
// hole on beat 4. That is a stomp you can play along with: CRUNCH, CRUNCH,
// CRUNCH, (look for the next bug). A child hums it after one loop.
//
//   bar  time    section     what happens
//   1    0:00.0  intro       tiptoe: pizzicato bass, woodblock tick-tock, marimba peeks in
//   5    0:08.3  A           the hook x4 on marimba, slap bass, full swung kit
//   13   0:24.8  B           the answer: kazoo calls, marimba tumbles back; builds, fake-out
//   21   0:41.4  breakdown   boing — kit down to kick/clap/shaker, kazoo "huh?" calls
//   29   0:57.9  A'          hook again + pizz counter-line, brass stabs, cowbell
//   37   1:14.5  A' shout    kazoo joins the hook, open hats, STOMP x4
//   41   1:22.8  turnaround  stop-time hits down F7-Eb7-Db7-C7, whistle sneaks off → bar 1
//
// No section is the same texture for more than eight bars, and the energy goes
// low → mid-high → mid → low → high → high → low, so a player on their fourth
// loop of a 90-second level is not hearing one wall of sound four times.
//
// Everything here is data; `lib/notation.mjs` documents the notation and
// `lib/harmony.mjs` checks every note against the chord before a render.

export const TITLE = 'Crunch Parade'
export const TEMPO = 116
/** Off-beat 16ths land this fraction of a 16th late (~58 % swing). */
export const SWING = 0.16
/** Humanisation, noise and plucks all derive from this. Change it and you get a
 *  different take of the same song. */
export const SEED = 'crunch-parade/1'

// ─── Harmony ────────────────────────────────────────────────────────────────
//
// `root`/`bass` are pitch classes (C = 0). `tones` and `tensions` are intervals
// from the root. `voicing` is what the clav and brass play: 3rd, 7th and 9th —
// no root (the bass has it) and nothing below A3 (so it never muddies the bass).

const dom7 = (root) => ({ root, tones: [0, 4, 7, 10], tensions: [2, 9], voicing: [4, 10, 14] })

export const CHORDS = {
  F7: dom7(5),
  Bb7: dom7(10),
  C7: dom7(0),
  Eb7: dom7(3),
  Db7: dom7(1),
  Gm7: { root: 7, tones: [0, 3, 7, 10], tensions: [2, 5], voicing: [3, 10, 14] },
  // bVII over a tonic pedal — the mixolydian "cool" chord of the breakdown.
  'Eb/F': { root: 3, bass: 5, tones: [0, 4, 7], tensions: [9], voicing: [0, 4, 7] }
}

export const SECTIONS = [
  { name: 'intro', chords: ['F7', 'F7', 'F7', 'C7'] },
  { name: 'A', chords: ['F7', 'F7', 'Bb7', 'F7', 'F7', 'F7', 'C7', 'F7'] },
  { name: 'B', chords: ['Bb7', 'Bb7', 'F7', 'F7', 'Gm7', 'C7', 'Bb7', 'C7'] },
  { name: 'breakdown', chords: ['F7', 'Eb/F', 'F7', 'Eb/F', 'F7', 'Eb/F', 'Gm7', 'C7'] },
  { name: 'A2', chords: ['F7', 'F7', 'Bb7', 'F7', 'F7', 'F7', 'C7', 'F7', 'Bb7', 'F7', 'Gm7', 'C7'] },
  // Chromatic dominants falling a whole step, then a half: the oldest cartoon
  // turnaround there is, and it pulls into F7 at bar 1 like a rubber band.
  { name: 'turn', chords: ['F7', 'Eb7', 'Db7', 'C7'] }
]

// ─── Melodic material ───────────────────────────────────────────────────────

const _ = null

// The hook. SNEAK bars are the run-up, CRUNCH bars the three stomps.
const SNEAK_F = 'C5 . C5 D5 Eb5:2 D5 C5 A4:2 F4 G4 A4:2 Bb4 B4'
const CRUNCH_F = 'C5!:2 . . C5!:2 . . F5!:2 . . . . . .'
const SNEAK_BB = 'D5 . D5 Eb5 F5:2 Eb5 D5 Bb4:2 F4 G4 Ab4:2 C5 Bb4'
const CRUNCH_RISE = 'A4!:2 . . C5!:2 . . F5!:2 . . . . . .'
const SNEAK_C = 'E5 . E5 F5 G5:2 F5 E5 C5:2 G4 A4 Bb4:2 . .'
const CRUNCH_OPEN = 'A4!:2 . . C5!:2 . . Eb5!:2 . . . . . .' // ends on the 7th: leads on
const HOOK = [SNEAK_F, CRUNCH_F, SNEAK_BB, CRUNCH_RISE, SNEAK_F, CRUNCH_F, SNEAK_C, CRUNCH_OPEN]

/**
 * The hook, for the rest of the score. The attic's music box plays it verbatim,
 * the fever stinger and the result sting transpose it up a tone (`transpose` in
 * `lib/notation.mjs`), and the boss and the attic re-mode it into minor. One
 * source, so a child hears one song in five places.
 */
export const HOOK_LINES = { SNEAK_F, CRUNCH_F, SNEAK_BB, CRUNCH_RISE, SNEAK_C, CRUNCH_OPEN }

// A' bars 37-40: the shout chorus — the hook's shape over new chords, ending on
// four stomps instead of three.
const SHOUT = [
  'D5 . D5 Eb5 F5:2 Eb5 D5 Bb4:2 F4 G4 Ab4:2 Bb4 B4',
  'C5!:2 . . C5!:2 . . F5!:2 . . Eb5 . C5 .',
  'Bb4 . Bb4 C5 D5:2 C5 Bb4 G4:2 D4 E4 F4:2 G4 A4',
  'Bb4!:4 C5!:4 E5!:4 G5!:4'
]

// B: the kazoo calls (odd bars), the marimba answers by tumbling down the
// chord (even bars). The three answers are one shape in sequence, so the
// section is new material that still sounds like it belongs.
const KAZOO_CALLS = [
  'D5:2 . C5 Bb4:2 . . F4:2 . . Ab4:4',
  'A4:2 . G4 F4:2 . . C5:2 . . Eb5:4',
  'Bb4:2 . A4 G4:2 . . D5:2 . . F5:4'
]
const TUMBLES = [
  '. . F5 . D5 . Bb4 . Ab4 . F4 . D4:2 . .',
  '. . Eb5 . C5 . A4 . F4 . Eb4 . C4:2 . .',
  '. . G5 . E5 . C5 . Bb4 . G4 . E4:2 . .'
]
const BUILD_HITS = 'Bb4!:2 . . D5!:2 . . F5!:2 . . Ab4 . Bb4 .'
// Bar 20 climbs two octaves into one hit — then everything stops (the fake-out).
const BUILD_RUN = 'C4 E4 G4 Bb4 C5 E5 G5 Bb5 C6!:2 . . . . . .'

export const PARTS = {
  // ═══ Pitched ════════════════════════════════════════════════════════════
  marimba: {
    voice: 'marimba',
    kind: 'notes',
    humanize: { ms: 4, vel: 0.07 },
    bars: {
      intro: [_, '. . . . . . . . A4 . C5 . Eb5 D5 . .', '. . . . . . . . C5 . Eb5 . F5 Eb5 . .', '. . . . . . . . E5 . G5 . Bb5 . . .'],
      A: HOOK,
      B: [_, TUMBLES[0], _, TUMBLES[1], _, TUMBLES[2], BUILD_HITS, BUILD_RUN],
      breakdown: [
        _, '. . . . Bb4 . G4 . Eb4:2 . . . . . .',
        _, '. . . . G5 . Eb5 . Bb4:2 . . . . . .',
        _, 'Bb4 Bb4 . Bb4 G4:2 . Bb4 Eb5:2 . . G4 . Eb4 .',
        'D5 . D5 . F5 . D5 . Bb4 . D5 . F5 . G5 .',
        'E5!:3 E5!:3 G5!:3 G5!:3 Bb5!:4' // 3-3-3-3-4: the wind-up into A'
      ],
      A2: [...HOOK, ...SHOUT],
      turn: ['F5!:3 F5!:3 Eb5!:2 . . . . . . . .', 'Eb5!:3 Eb5!:3 Db5!:2 . . . . . . . .', 'Db5!:3 Db5!:3 B4!:2 . . . . . . . .', 'C5!:2 . . . . . . . . . . . . . .']
    }
  },

  // Sparkle an octave over the marimba — only on hits and answers, never on
  // the run, and quiet: it is colour, and it sits right in the squish band.
  xylo: {
    voice: 'xylophone',
    kind: 'notes',
    humanize: { ms: 3, vel: 0.06 },
    bars: {
      B: [_, _, _, _, _, '. . G6 . E6 . C6 . Bb5 . G5 . E5:2 . .', _, '. . . . . . . . C6!:2 . . . . . .'],
      breakdown: [
        _, '. . . . Bb5 . G5 . Eb5:2 . . . . . .',
        _, '. . . . G6 . Eb6 . Bb5:2 . . . . . .',
        _, 'Bb5 Bb5 . Bb5 G5:2 . Bb5 Eb6:2 . . G5 . Eb5 .',
        _, _
      ],
      A2: [
        _, 'C6!:2 . . C6!:2 . . F6!:2 . . . . . .',
        _, 'A5!:2 . . C6!:2 . . F6!:2 . . . . . .',
        _, 'C6!:2 . . C6!:2 . . F6!:2 . . . . . .',
        _, 'A5!:2 . . C6!:2 . . Eb6!:2 . . . . . .',
        _, 'C6!:2 . . C6!:2 . . F6!:2 . . Eb6 . C6 .',
        _, 'Bb5!:4 C6!:4 E6!:4 G6!:4'
      ],
      // Bar 42: a bug scurrying down the Eb7 while the toms fill.
      turn: [_, '. . . . . . . . Db6 Bb5 G5 Eb5 Db5 Bb4 G4 Eb4', _, _]
    }
  },

  kazoo: {
    voice: 'kazoo',
    kind: 'notes',
    legato: true,
    humanize: { ms: 6, vel: 0.06 },
    bars: {
      B: [KAZOO_CALLS[0], _, KAZOO_CALLS[1], _, KAZOO_CALLS[2], _, BUILD_HITS, '. . . . . . . . C5!:2 . . . . . .'],
      // The breakdown game: a question (the `^` bends the last note up — "huh?"),
      // an answer from the mallets, and a third call that gets chatty.
      breakdown: [
        '. . . . F4 . A4 . C5:2 . Eb5^:3 . .', _,
        '. . . . A4 . C5 . Eb5:2 . F5^:3 . .', _,
        'C5 C5 . C5 Eb5:2 . C5 F5:2 . . Eb5 . C5 .', _,
        _, 'E4!:3 E4!:3 G4!:3 G4!:3 Bb4!:4'
      ],
      A2: [_, _, _, _, _, _, _, _, ...SHOUT],
      turn: ['F4!:3 F4!:3 Eb4!:2 . . . . . . . .', 'Eb4!:3 Eb4!:3 Db4!:2 . . . . . . . .', 'Db4!:3 Db4!:3 B3!:2 . . . . . . . .', 'C4!:2 . . . . . . . . . . . . . .']
    }
  },

  // A' counter-line: pizzicato on the off-beat 8ths climbing through the chord
  // under the run-up, and a four-note tumble in the hole the stomps leave.
  pizz: {
    voice: 'pizz',
    kind: 'notes',
    humanize: { ms: 5, vel: 0.08 },
    bars: {
      A2: [
        '. . A3 . . . C4 . . . Eb4 . . . F4 .',
        '. . . . . . . . . . . . A4 G4 F4 Eb4',
        '. . D4 . . . F4 . . . Ab4 . . . Bb4 .',
        '. . . . . . . . . . . . C5 Bb4 A4 G4',
        '. . A3 . . . C4 . . . Eb4 . . . F4 .',
        '. . . . . . . . . . . . A4 G4 F4 Eb4',
        '. . E4 . . . G4 . . . Bb4 . . . C5 .',
        '. . . . . . . . . . . . Eb5 D5 C5 Bb4',
        '. . D4 . . . F4 . . . Ab4 . . . Bb4 .',
        _,
        '. . Bb3 . . . D4 . . . F4 . . . G4 .',
        _
      ]
    }
  },

  // ═══ Bass ═══════════════════════════════════════════════════════════════
  bass: {
    voice: 'slapBass',
    kind: 'notes',
    humanize: { ms: 3, vel: 0.05 },
    bars: (() => {
      // Degrees of the bar's chord; `8` is the popped octave, `ap` the chromatic
      // pickup into the next bar's root.
      const SNEAK = '1!:2 . 1? . . 8! 1? 5:2 . b7 8! . 1 ap?'
      const CRUNCH = '1!:2 . . 1!:2 . . 8!:2 . 5? b7 . 1 ap?'
      const GROOVE_B = '1!:3 1? . . 8! . 5:2 1 . b7:2 8! ap?'
      const A = [SNEAK, CRUNCH, SNEAK, CRUNCH, SNEAK, CRUNCH, SNEAK, CRUNCH]
      return {
        A,
        B: [GROOVE_B, GROOVE_B, GROOVE_B, GROOVE_B, GROOVE_B, GROOVE_B, '1!:2 . . 1!:2 . . 8!:2 . . 5 . 8 .', '1 . 1 . 1 . 1 . 8!:2 . . . . . .'],
        breakdown: [_, _, _, _, _, _, SNEAK, '1!:3 1!:3 1!:3 8!:3 8!:4'],
        A2: [...A, SNEAK, CRUNCH, SNEAK, '1!:4 1!:4 1!:4 8!:3 ap'],
        turn: ['F2!:3 F2!:3 Eb2!:2 . . . . F3 . F2 .', 'Eb2!:3 Eb2!:3 Db2!:2 . . . . Eb3 . Eb2 .', 'Db2!:3 Db2!:3 B1!:2 . . . . Db3 . Db2 .', 'C2!:2 . . . . . . . . . . . . . .']
      }
    })()
  },

  // The tiptoe: the intro, the breakdown pedal, and the last-bar pickup that
  // walks G-E into the F of bar 1.
  uprightBass: {
    voice: 'pizzBass',
    kind: 'notes',
    humanize: { ms: 5, vel: 0.06 },
    bars: {
      intro: ['F2:2 . . A2:2 . . C3:2 . . Eb3 . D3 .', 'C3:2 . . A2:2 . . F2:2 . . G2 . Ab2 .', 'F2:2 . . A2:2 . . C3:2 . . Eb3 . D3 .', 'C3:2 . . Bb2:2 . . G2:2 . . C2 . E2 .'],
      breakdown: [
        'F2:2 . . F2:2 . . F2:2 . . C3 . Eb3 .', 'F2:2 . . F2:2 . . F2:2 . . Bb2 . G2 .',
        'F2:2 . . F2:2 . . F2:2 . . C3 . Eb3 .', 'F2:2 . . F2:2 . . F2:2 . . Bb2 . G2 .',
        'F2:2 . . F2:2 . . F2:2 . . C3 . Eb3 .', 'F2:2 . . F2:2 . . F2:2 . . Bb2 . G2 .',
        _, _
      ],
      turn: [_, _, _, '. . . . . . . . . . . . G2 . E2 .']
    }
  },

  // ═══ Chord stabs ════════════════════════════════════════════════════════
  clav: {
    voice: 'clav',
    kind: 'notes',
    humanize: { ms: 3, vel: 0.08 },
    bars: (() => {
      const LIGHT = '. . . . . . H . . . . . . . H .' // "and" of 2 and 4
      const HITS = 'H!:2 . . H!:2 . . H!:2 . . . . . .'
      const SKANK = '. . H . . . H . . . H . . . H .' // every off-beat 8th
      return {
        A: [LIGHT, HITS, LIGHT, HITS, LIGHT, HITS, LIGHT, HITS],
        B: [SKANK, SKANK, SKANK, SKANK, SKANK, SKANK, 'H!:2 . . H!:2 . . H!:2 . . H . H .', '. . . . . . . . H!:2 . . . . . .'],
        breakdown: [_, _, _, _, _, _, SKANK, _],
        A2: [SKANK, _, SKANK, _, SKANK, _, SKANK, _, SKANK, SKANK, SKANK, _]
      }
    })()
  },

  brass: {
    voice: 'brass',
    kind: 'notes',
    humanize: { ms: 3, vel: 0.05 },
    bars: (() => {
      const HITS = 'H!:2 . . H!:2 . . H!:2 . . . . . .'
      const STOP = 'H!:2 . H!:2 . H!:2 . . . . . . . .'
      return {
        B: [_, _, _, _, _, _, _, '. . . . . . . . H!:2 . . . . . .'],
        breakdown: [_, _, _, _, _, _, _, 'H!:2 . H!:2 . H!:2 . H!:2 . H!:4'],
        A2: [_, HITS, _, HITS, _, HITS, _, HITS, _, _, _, 'H!:3 . H!:3 . H!:3 . H!:4'],
        // The last stab falls off (`v`) — the band shrugging as the bug sneaks off.
        turn: [STOP, STOP, STOP, 'H!v:4 . . . . . . . . . . . .']
      }
    })()
  },

  // ═══ Drums ══════════════════════════════════════════════════════════════
  kick: {
    voice: 'kick',
    kind: 'grid',
    humanize: { ms: 1.5, vel: 0.04 },
    harmonic: false,
    bars: (() => {
      const SNEAK = 'X.....o...x.....'
      const CRUNCH = 'X...X...X.......'
      const A = [SNEAK, CRUNCH, SNEAK, CRUNCH, SNEAK, CRUNCH, SNEAK, CRUNCH]
      return {
        intro: ['o.......-.......', 'o.......-.......', 'o.......-.......', 'o.......-.......'],
        A,
        B: ['X.........x.....', 'X.....o...x...o.', 'X.........x.....', 'X.....o...x...o.', 'X.........x.....', 'X.....o...x...o.', 'X...X...X...X...', 'X.......X.......'],
        breakdown: ['X...............', 'X...............', 'X...............', 'X...............', 'X.......x.......', 'X.......x.......', SNEAK, 'X..X..X..X..X...'],
        A2: [...A, SNEAK, CRUNCH, 'X.....o...x...o.', 'X...X...X...X...'],
        turn: ['X..X..X.........', 'X..X..X.........', 'X..X..X.........', 'X...............']
      }
    })()
  },

  snare: {
    voice: 'snare',
    kind: 'grid',
    humanize: { ms: 2, vel: 0.06 },
    harmonic: false,
    bars: (() => {
      const SNEAK = '....X..,.,..X..,'
      const CRUNCH = '........x...X...'
      const A = [SNEAK, CRUNCH, SNEAK, CRUNCH, SNEAK, CRUNCH, SNEAK, CRUNCH]
      return {
        intro: [_, _, _, '............,,-o'],
        A,
        B: ['....X.......X...', '....X..,....X..,', '....X.......X...', '....X..,....X..,', '....X.......X...', '....X..,....X..,', '........,,--ooxx', 'oooxxxxX........'],
        breakdown: [_, _, _, _, _, _, '....x.......x..,', ',,,,----ooooxxxx'],
        A2: [...A, SNEAK, CRUNCH, SNEAK, '....x.......x...'],
        turn: ['........-oooxxxx', '..............xX', '........,,--ooxx', _]
      }
    })()
  },

  clap: {
    voice: 'clap',
    kind: 'grid',
    humanize: { ms: 2, vel: 0.05 },
    harmonic: false,
    bars: (() => {
      const BACK = '....x.......x...'
      const CRUNCH = 'x...x...x.......'
      const A = [BACK, CRUNCH, BACK, CRUNCH, BACK, CRUNCH, BACK, CRUNCH]
      const FOUR = '............x...'
      return {
        A,
        B: [FOUR, FOUR, FOUR, FOUR, FOUR, FOUR, CRUNCH, '........X.......'],
        breakdown: [FOUR, FOUR, FOUR, FOUR, FOUR, FOUR, BACK, 'X..X..X..X..X...'],
        A2: [...A, BACK, CRUNCH, BACK, 'X...X...X...X...'],
        turn: ['X..X..X.........', 'X..X..X.........', 'X..X..X.........', _]
      }
    })()
  },

  snap: {
    voice: 'snap',
    kind: 'grid',
    humanize: { ms: 4, vel: 0.08 },
    harmonic: false,
    bars: { intro: [_, _, '....x.......x...', '....x.......x...'] }
  },

  hatC: {
    voice: 'hatClosed',
    kind: 'grid',
    humanize: { ms: 2, vel: 0.1 },
    harmonic: false,
    bars: (() => {
      const SIXTEENS = 'x,-,x,-,x,-,x,..'
      const EIGHTS = 'x.-.x.-.x.-.x.-.'
      const A = [SIXTEENS, EIGHTS, SIXTEENS, EIGHTS, SIXTEENS, EIGHTS, SIXTEENS, EIGHTS]
      return {
        intro: [_, _, _, '-.,.-.,.-.,.-.,.'],
        A,
        B: [EIGHTS, EIGHTS, EIGHTS, EIGHTS, EIGHTS, EIGHTS, 'x.x.x.x.........', _],
        breakdown: [_, _, _, _, _, _, EIGHTS, _],
        A2: [...A, 'x...x...x...x...', 'x...x...x...x...', 'x...x...x...x...', _]
      }
    })()
  },

  hatO: {
    voice: 'hatOpen',
    kind: 'grid',
    humanize: { ms: 2, vel: 0.08 },
    harmonic: false,
    chokedBy: 'hatC',
    bars: (() => {
      const LIFT = '..............o.'
      return {
        A: [LIFT, _, LIFT, _, LIFT, _, LIFT, _],
        B: [_, _, _, _, LIFT, LIFT, _, _],
        // Bars 37-39: disco off-beat open hats under the shout chorus.
        A2: [LIFT, _, LIFT, _, LIFT, _, LIFT, _, '..o...o...o...o.', '..o...o...o...o.', '..o...o...o...o.', _]
      }
    })()
  },

  shaker: {
    voice: 'shaker',
    kind: 'grid',
    humanize: { ms: 3, vel: 0.1 },
    harmonic: false,
    bars: (() => {
      const SOFT = ',.-.,.-.,.-.,.-.'
      const SIXTEENS = ',,-,,,-,,,-,,,-,'
      const EIGHTS = 'o.-.o.-.o.-.o.-.'
      const DRIVE = 'o,-,o,-,o,-,o,-,'
      return {
        intro: [SOFT, SOFT, SIXTEENS, SIXTEENS],
        B: [SIXTEENS, SIXTEENS, SIXTEENS, SIXTEENS, SIXTEENS, SIXTEENS, SIXTEENS, _],
        breakdown: [EIGHTS, EIGHTS, EIGHTS, EIGHTS, EIGHTS, EIGHTS, DRIVE, DRIVE],
        A2: Array(12).fill('-,,,-,,,-,,,-,,,')
      }
    })()
  },

  // Tick-tock. In the intro it is the clock of the sneak; in A it answers the
  // stomps in the hole on beat 4.
  woodHi: {
    voice: 'woodblock',
    kind: 'grid',
    extra: { hi: true },
    humanize: { ms: 3, vel: 0.06 },
    harmonic: false,
    bars: {
      intro: ['....o...........', '....o...........', _, _],
      A: [_, '.............o..', _, '.............o..', _, '.............o..', _, '.............o..'],
      breakdown: [_, '............o...', _, '............o...', _, _, _, _],
      turn: [_, _, _, '............o...']
    }
  },

  woodLo: {
    voice: 'woodblock',
    kind: 'grid',
    extra: { hi: false },
    humanize: { ms: 3, vel: 0.06 },
    harmonic: false,
    bars: {
      intro: ['............o...', '............o...', _, _],
      A: [_, '..............o.', _, '..............o.', _, '..............o.', _, '..............o.'],
      breakdown: [_, '..............o.', _, '..............o.', _, _, _, _],
      turn: [_, _, _, '..............o.']
    }
  },

  cowbell: {
    voice: 'cowbell',
    kind: 'grid',
    humanize: { ms: 3, vel: 0.06 },
    harmonic: false,
    bars: (() => {
      const OFF = '......-.......-.'
      const ANSWER = '..............x.'
      return {
        breakdown: [_, _, _, _, _, '..............x.', _, _],
        A2: [OFF, ANSWER, OFF, ANSWER, OFF, ANSWER, OFF, ANSWER, OFF, OFF, OFF, _]
      }
    })()
  },

  crash: {
    voice: 'crash',
    kind: 'grid',
    humanize: { ms: 1, vel: 0.03 },
    harmonic: false,
    bars: {
      A: ['x...............', _, _, _, _, _, _, _],
      B: ['o...............', _, _, _, _, _, _, '........x.......'],
      A2: ['X...............', _, _, _, _, _, _, _, 'x...............', _, _, _],
      turn: ['x...............', _, _, 'x...............']
    }
  },

  tomHi: {
    voice: 'tom',
    kind: 'grid',
    extra: { hz: 196 },
    humanize: { ms: 2, vel: 0.05 },
    harmonic: false,
    bars: { turn: [_, '........xx......', _, _] }
  },

  tomMid: {
    voice: 'tom',
    kind: 'grid',
    extra: { hz: 147 },
    humanize: { ms: 2, vel: 0.05 },
    harmonic: false,
    bars: { turn: [_, '..........xx....', '..........x...x.', _] }
  },

  tomLow: {
    voice: 'tom',
    kind: 'grid',
    extra: { hz: 110 },
    humanize: { ms: 2, vel: 0.05 },
    harmonic: false,
    bars: { turn: [_, '............xx..', '........x...x...', _] }
  },

  // ═══ Cartoon accents ════════════════════════════════════════════════════
  // Placed by hand rather than on a grid: each is a single gesture with a
  // start, a length and (for the whistle) a pitch path.
  fx: {
    kind: 'events',
    harmonic: false,
    events: [
      // Whoop up into the first hook.
      { bar: 4, step: 13, voice: 'slideWhistle', midi: 67, toMidi: 79, steps: 3, vel: 0.7 },
      // The fake-out at the end of B: the band hits, the whistle falls...
      { bar: 20, step: 10, voice: 'slideWhistle', midi: 84, toMidi: 60, steps: 6, vel: 0.65 },
      // ...and lands on a spring. Breakdown.
      { bar: 21, step: 0, voice: 'boing', vel: 0.8 },
      // Winding back up across the 3-3-3-3-4 into A'.
      { bar: 28, step: 4, voice: 'slideWhistle', midi: 60, toMidi: 84, steps: 12, vel: 0.55 },
      // Sneaking away after the last stab — back to the tiptoe of bar 1.
      { bar: 44, step: 3, voice: 'slideWhistle', midi: 84, toMidi: 62, steps: 8, vel: 0.55 }
    ]
  }
}

// ─── Mix ────────────────────────────────────────────────────────────────────
//
// gain · pan (-1..1) · reverb send · delay send · bus. Buses matter because the
// bed (bass, chords, mallets, returns) is ducked a few dB on every kick and the
// drums and cartoon accents are not.
//
// Levels were set against the per-stem loudness report `render.mjs` prints, to
// this ladder (LU relative to the drum bus): bass -2, mallets -4, kazoo -6,
// counter-line -9, chord stabs -9, accents -8, returns well under. The hook is
// deliberately NOT the loudest thing in the mix: it is the thing a child hums,
// but the squish is the thing they need to hear.

export const MIX = {
  kick: { gain: 0.95, pan: 0, bus: 'drums' },
  snare: { gain: 0.42, pan: 0.04, rev: 0.1, bus: 'drums' },
  clap: { gain: 0.4, pan: -0.06, rev: 0.2, bus: 'drums' },
  snap: { gain: 0.34, pan: -0.3, rev: 0.22, bus: 'drums' },
  hatC: { gain: 0.13, pan: 0.32, bus: 'drums' },
  hatO: { gain: 0.09, pan: 0.32, rev: 0.04, bus: 'drums' },
  shaker: { gain: 0.1, pan: -0.42, bus: 'drums' },
  woodHi: { gain: 0.22, pan: -0.38, rev: 0.1, dly: 0.12, bus: 'drums' },
  woodLo: { gain: 0.22, pan: 0.38, rev: 0.1, bus: 'drums' },
  cowbell: { gain: 0.2, pan: 0.26, rev: 0.08, bus: 'drums' },
  crash: { gain: 0.16, pan: 0, bus: 'drums' },
  tomHi: { gain: 0.46, pan: -0.3, rev: 0.12, bus: 'drums' },
  tomMid: { gain: 0.46, pan: 0, rev: 0.12, bus: 'drums' },
  tomLow: { gain: 0.46, pan: 0.3, rev: 0.12, bus: 'drums' },
  bass: { gain: 0.46, pan: 0, bus: 'bass' },
  uprightBass: { gain: 0.62, pan: 0, rev: 0.05, bus: 'bass' },
  marimba: { gain: 0.3, pan: -0.06, rev: 0.12, dly: 0.07, bus: 'lead' },
  xylo: { gain: 0.11, pan: 0.28, rev: 0.14, dly: 0.1, bus: 'lead' },
  kazoo: { gain: 0.41, pan: 0.18, rev: 0.14, dly: 0.09, bus: 'kazoo' },
  pizz: { gain: 0.95, pan: -0.34, rev: 0.12, bus: 'counter' },
  clav: { gain: 0.16, pan: 0, spread: 0.45, rev: 0.05, bus: 'comp' },
  brass: { gain: 0.19, pan: 0, spread: 0.35, rev: 0.12, bus: 'comp' },
  fx: { gain: 0.27, pan: 0.15, rev: 0.18, dly: 0.12, bus: 'fx' }
}
