// ─── "Big Bug Stomp" — the boss loop ────────────────────────────────────────
//
// One loop for all four bosses (they are told apart by their tells, not their
// music). Crunch Parade turned villain: the same hook in the theme's PARALLEL
// minor — F minor instead of F mixolydian, so it is still "in F", the tune a
// child knows, just with the lights off — as a cartoon villain's march. 132 BPM
// straight eighths (the parade swings; a march does not), 40 bars = 72.73 s,
// written to loop.
//
// The story in the arrangement is the fight:
//
//   bar  time    section   what happens
//   1    0:00.0  arrival   timpani rolls, the tuba's low F — and on bar 4 the
//                          BOSS does the three stomps (the player's own motif,
//                          stolen: BOOM BOOM BOOM)
//   5    0:07.3  march     the hook in F minor: marimba + low brass, tuba
//                          oom-pah, pizzicato ostinato, snare march
//   13   0:21.8  hero      the player fights back — the stomp motif in A-flat
//                          MAJOR as a fanfare on the parade's own mallets,
//                          four-on-the-floor, and the 3-3-3-3-4 wind-up
//   21   0:36.4  taunt     the villain's "nyah-nyah" on the kazoo (the parade's
//                          silliest voice, now mocking you), the tuba laughing
//                          back on the Neapolitan G-flat: sparse, a breather
//   29   0:50.9  march 2   the hook again, fuller: xylophone on top, brass on
//                          the stomps, cowbell, open hats
//   37   1:05.5  turn      stop-time falling dominants (the parade's own
//                          turnaround, in minor), a snare roll back into bar 1
//
// Kid-friendly menace: the villain is a cartoon — low brass and timpani for
// weight, a kazoo for the sneer, nothing sustained and nothing shrill. The
// energy goes mid → mid-high → high → low → high → mid across the loop, so the
// fourth pass of a long fight is not one wall of sound four times.

import { HOOK_LINES } from '../score.mjs'
import { transpose } from '../lib/notation.mjs'

export const TITLE = 'Big Bug Stomp (Boss)'
export const TEMPO = 132
export const SWING = 0
export const SEED = 'boss-stomp/1'

// ─── Harmony ────────────────────────────────────────────────────────────────

// Stab voicings are plain triads in first inversion (3rd, 5th, root): a march
// hits hard and square. The parade's 9ths and 7ths would put a major seventh
// between the stab and the hook on every stomp.
export const CHORDS = {
  Fm: { root: 5, tones: [0, 3, 7, 10], tensions: [2, 5], voicing: [3, 7, 12] },
  Bbm: { root: 10, tones: [0, 3, 7, 10], tensions: [2, 5], voicing: [3, 7, 12] },
  // The villain's dominant: C7 with a flat nine (Db) — the diminished-seventh
  // shudder of every silent-film villain. Kept for the villain's bars only.
  C7: { root: 0, tones: [0, 4, 7, 10], tensions: [1, 8], voicing: [4, 10, 13] },
  // The hero's dominant: the same C7 with a natural 9th, for the wind-up out of
  // the hero section — the player's side of the fight does not shudder.
  C9: { root: 0, tones: [0, 4, 7, 10], tensions: [2, 9], voicing: [4, 10, 14] },
  Db: { root: 1, tones: [0, 4, 7, 11], tensions: [2, 9], voicing: [4, 7, 12] },
  Ab: { root: 8, tones: [0, 4, 7, 11], tensions: [2, 9], voicing: [4, 7, 12] },
  Eb: { root: 3, tones: [0, 4, 7, 10], tensions: [2, 9], voicing: [4, 10, 14] },
  // bII: the Neapolitan — a semitone over the tonic, the sound of a sneer.
  Gb: { root: 6, tones: [0, 4, 7], tensions: [11], voicing: [4, 7, 12] },
  Db7: { root: 1, tones: [0, 4, 7, 10], tensions: [2, 9], voicing: [4, 10, 14] }
}

export const SECTIONS = [
  // A tonic pedal: the boss's three stomps (C, C, F) land on F minor.
  { name: 'arrival', chords: ['Fm', 'Fm', 'Fm', 'Fm'] },
  { name: 'march', chords: ['Fm', 'Fm', 'Bbm', 'Fm', 'Fm', 'Fm', 'C7', 'Fm'] },
  { name: 'hero', chords: ['Ab', 'Eb', 'Fm', 'Db', 'Ab', 'Eb', 'Db', 'C9'] },
  { name: 'taunt', chords: ['Fm', 'Gb', 'Fm', 'Gb', 'Fm', 'Gb', 'Db', 'C7'] },
  { name: 'march2', chords: ['Fm', 'Fm', 'Bbm', 'Fm', 'Fm', 'Fm', 'C7', 'Fm'] },
  // The parade's turnaround (F7-Eb7-Db7-C7), in minor.
  { name: 'turn', chords: ['Fm', 'Eb', 'Db7', 'C7'] }
]

// ─── Melodic material ───────────────────────────────────────────────────────

const _ = null

// The hook in F MINOR. The parade's A-naturals become A-flats, its D-naturals
// D-flats; rhythm, contour and the chromatic run-up (Bb–B–C) are untouched.
// CRUNCH is identical — C, C, F sits in both modes — and that is the point:
// the stomp does not change sides.
const SNEAK_FM = 'C5 . C5 Db5 Eb5:2 Db5 C5 Ab4:2 F4 G4 Ab4:2 Bb4 B4'
const CRUNCH_FM = HOOK_LINES.CRUNCH_F // C5! C5! F5!
const SNEAK_BBM = 'Db5 . Db5 Eb5 F5:2 Eb5 Db5 Bb4:2 F4 Gb4 Ab4:2 C5 Bb4'
const CRUNCH_RISE_M = 'Ab4!:2 . . C5!:2 . . F5!:2 . . . . . .'
const SNEAK_C7 = 'E5 . E5 F5 G5:2 F5 E5 C5:2 G4 Ab4 Bb4:2 . .'
const CRUNCH_OPEN_M = 'Ab4!:2 . . C5!:2 . . Eb5!:2 . . . . . .'
const HOOK_M = [SNEAK_FM, CRUNCH_FM, SNEAK_BBM, CRUNCH_RISE_M, SNEAK_FM, CRUNCH_FM, SNEAK_C7, CRUNCH_OPEN_M]

// The hero's answer, in A-flat major: the stomp motif as a fanfare.
const HERO = [
  'Eb5!:2 . . Eb5!:2 . . Ab5!:2 . . G5 . Ab5 .',
  'Bb5:4 G5 . Eb5 . F5:2 . . G5 . Bb4 .',
  'C5!:2 . . C5!:2 . . F5!:2 . . Eb5 . C5 .',
  'Db5:4 F5 . Ab5 . Db6:2 . . Bb5 . Ab5 .',
  'Eb5!:2 . . Eb5!:2 . . Ab5!:2 . . G5 . Ab5 .',
  'Bb5:4 G5 . Eb5 . F5:2 . . G5 . Bb4 .',
  'F5!:2 . . F5!:2 . . Ab5!:2 . . . . . .',
  'G5!:3 G5!:3 E5!:3 E5!:3 C5!:4' // 3-3-3-3-4: the parade's wind-up
]

// The villain's sneer: "nyah-nyah", with the kazoo's `^` bend on the end.
const TAUNT_A = 'C5!:2 Ab4 . C5!:2 Ab4 . Bb4 C5 Bb4 Ab4 F4^:4'
const TAUNT_B = 'Eb5!:2 C5 . Eb5!:2 C5 . F5 Eb5 C5 Bb4 Ab4^:4'

export const PARTS = {
  // ═══ The hook ═══════════════════════════════════════════════════════════
  marimba: {
    voice: 'marimba',
    kind: 'notes',
    humanize: { ms: 3, vel: 0.06 },
    bars: {
      march: HOOK_M,
      hero: HERO,
      march2: HOOK_M,
      turn: ['F5!:3 F5!:3 Eb5!:2 . . . . . . . .', 'Eb5!:3 Eb5!:3 Db5!:2 . . . . . . . .', 'Db5!:3 Db5!:3 Cb5!:2 . . . . . . . .', 'C5!:2 . . . . . . . . . . . . . .']
    }
  },

  // Low brass doubling the hook an octave down: the villain's voice.
  brassLow: {
    voice: 'brass',
    kind: 'notes',
    humanize: { ms: 3, vel: 0.05 },
    bars: {
      march: HOOK_M.map((l) => transpose(l, -12, 'flat')),
      march2: HOOK_M.map((l) => transpose(l, -12, 'flat')),
      turn: ['F4!:3 F4!:3 Eb4!:2 . . . . . . . .', 'Eb4!:3 Eb4!:3 Db4!:2 . . . . . . . .', 'Db4!:3 Db4!:3 Cb4!:2 . . . . . . . .', 'C4!v:4 . . . . . . . . . . . .']
    }
  },

  xylo: {
    voice: 'xylophone',
    kind: 'notes',
    humanize: { ms: 2, vel: 0.05 },
    bars: {
      hero: [
        transpose(HERO[0], 12, 'flat'), _, transpose(HERO[2], 12, 'flat'), _,
        transpose(HERO[4], 12, 'flat'), _, transpose(HERO[6], 12, 'flat'), _
      ],
      march2: [_, 'C6!:2 . . C6!:2 . . F6!:2 . . . . . .', _, 'Ab5!:2 . . C6!:2 . . F6!:2 . . . . . .', _, 'C6!:2 . . C6!:2 . . F6!:2 . . Eb6 . C6 .', _, 'Ab5!:2 . . C6!:2 . . Eb6!:2 . . . . . .']
    }
  },

  kazoo: {
    voice: 'kazoo',
    kind: 'notes',
    legato: true,
    humanize: { ms: 5, vel: 0.06 },
    bars: {
      taunt: [TAUNT_A, _, TAUNT_B, _, TAUNT_A, _, 'F4!:2 . . F4!:2 . . Ab4!:2 . . . . . .', 'G4!:3 G4!:3 Bb4!:3 Bb4!:3 Db5!:4']
    }
  },

  // The march's ostinato: pizzicato eighths walking the chord, the engine
  // under the hook. Silent on the stomps, so every CRUNCH lands in a hole.
  pizz: {
    voice: 'pizz',
    kind: 'notes',
    humanize: { ms: 4, vel: 0.08 },
    bars: (() => {
      const FM = 'F3 . C4 . Ab3 . C4 . F3 . C4 . Ab3 . C4 .'
      const BBM = 'Bb3 . F4 . Db4 . F4 . Bb3 . F4 . Db4 . F4 .'
      const C7 = 'C4 . G4 . E4 . G4 . Bb3 . G4 . E4 . G4 .'
      const LIFT = '. . . . . . . . . . . . Ab3 C4 Eb4 F4'
      return {
        arrival: [FM, FM, FM, LIFT],
        march: [FM, LIFT, BBM, LIFT, FM, LIFT, C7, _],
        march2: [FM, LIFT, BBM, LIFT, FM, LIFT, C7, _]
      }
    })()
  },

  // ═══ Bass ═══════════════════════════════════════════════════════════════
  tuba: {
    voice: 'tuba',
    kind: 'notes',
    humanize: { ms: 3, vel: 0.05 },
    bars: (() => {
      // Oom (root) and pah (fifth) on the quarters: a march.
      const MARCH = '1!:3 . 5:3 . 1!:3 . 5:3 .'
      const CRUNCH = '1!:2 . . 1!:2 . . 8!:3 . . . . .'
      const HERO_B = '1!:2 . 8 5:2 . 1 1!:2 . 8 5:2 . 1'
      // The villain laughing back: "ho, ho, HO" on the Neapolitan, falling a
      // semitone onto the tonic's fifth... of G-flat, which is F: a sneer.
      const HOHO = 'Gb2!:2 . . Gb2!:2 . . F2!:4 . . . .'
      return {
        arrival: ['F1!:16', 'F1!:8 . . . . C2:4', 'F1!:8 . . . . Ab1:4', 'C2!:2 . . C2!:2 . . F1!:4 . . . .'],
        march: [MARCH, CRUNCH, MARCH, CRUNCH, MARCH, CRUNCH, MARCH, CRUNCH],
        hero: [HERO_B, HERO_B, HERO_B, HERO_B, HERO_B, HERO_B, HERO_B, '1!:3 1!:3 5!:3 5!:3 1!:4'],
        taunt: ['1!:4 . . . . . . . . . . . .', HOHO, '1!:4 . . . . . . . . . . . .', HOHO, '1!:4 . . . . . . . . . . . .', HOHO, '1!:2 . . 1!:2 . . 5!:2 . . . . . .', '1!:3 1!:3 1!:3 1!:3 8!:4'],
        march2: [MARCH, CRUNCH, MARCH, CRUNCH, MARCH, CRUNCH, MARCH, CRUNCH],
        turn: ['F2!:3 F2!:3 Eb2!:2 . . . . . . . .', 'Eb2!:3 Eb2!:3 Db2!:2 . . . . . . . .', 'Db2!:3 Db2!:3 B1!:2 . . . . . . . .', 'C2!:2 . . . . . . . . . . C2 D2 E2 .']
      }
    })()
  },

  // ═══ Stabs ══════════════════════════════════════════════════════════════
  brassHits: {
    voice: 'brass',
    kind: 'notes',
    humanize: { ms: 2, vel: 0.05 },
    bars: (() => {
      const HITS = 'H!:2 . . H!:2 . . H!:2 . . . . . .'
      const OFF = '. . H . . . H . . . H . . . H .'
      return {
        arrival: [_, _, _, HITS],
        march: [_, HITS, _, HITS, _, HITS, _, HITS],
        hero: [OFF, OFF, HITS, OFF, OFF, OFF, HITS, 'H!:3 H!:3 H!:3 H!:3 H!:4'],
        march2: [_, HITS, _, HITS, _, HITS, _, HITS],
        turn: ['H!:3 H!:3 H!:2 . . . . . . . .', 'H!:3 H!:3 H!:2 . . . . . . . .', 'H!:3 H!:3 H!:2 . . . . . . . .', 'H!v:4 . . . . . . . . . . . .']
      }
    })()
  },

  // ═══ Drums ══════════════════════════════════════════════════════════════
  timpani: {
    voice: 'timpani',
    kind: 'notes',
    humanize: { ms: 2, vel: 0.05 },
    bars: (() => {
      const STOMP = 'C3!:2 . . C3!:2 . . F2!:4 . . . .'
      return {
        // A roll that swells, then the boss's own three stomps.
        arrival: [
          'F2? . F2? . F2? . F2? . F2 . F2 . F2 . F2 .',
          'F2 F2 F2 F2 F2 F2 F2 F2 F2! F2 F2 F2 F2! F2 F2 F2',
          'C3? . C3? . C3 . C3 . C3 C3 C3 C3 C3! C3 C3 C3',
          'C3!:4 C3!:4 F2!:8'
        ],
        march: [_, STOMP, _, STOMP, _, STOMP, _, STOMP],
        hero: [_, _, STOMP, _, _, _, _, 'C3!:3 C3!:3 C3!:3 C3!:3 C3!:4'],
        // Under the tuba's "ho, ho, HO": the G-flat chord's fifth, then its major
        // seventh (F) — the semitone sneer, never the tritone.
        taunt: [_, 'Db3!:2 . . Db3!:2 . . F2!:4 . . . .', _, 'Db3!:2 . . Db3!:2 . . F2!:4 . . . .', _, 'Db3!:2 . . Db3!:2 . . F2!:4 . . . .', _, _],
        march2: [_, STOMP, _, STOMP, _, STOMP, _, STOMP],
        turn: ['F2!:3 F2!:3 . . . . . . . . . .', _, _, '. . . . . . . . C3? C3? C3 C3 C3 C3 C3! C3!']
      }
    })()
  },

  kick: {
    voice: 'kick',
    kind: 'grid',
    humanize: { ms: 1.5, vel: 0.04 },
    harmonic: false,
    bars: (() => {
      const MARCH = 'X.......X.......'
      const CRUNCH = 'X...X...X.......'
      const FOUR = 'X...X...X...X...'
      return {
        arrival: [_, _, _, 'X...X...X.......'],
        march: [MARCH, CRUNCH, MARCH, CRUNCH, MARCH, CRUNCH, MARCH, CRUNCH],
        hero: [FOUR, FOUR, CRUNCH, FOUR, FOUR, FOUR, CRUNCH, 'X..X..X..X..X...'],
        taunt: ['X...............', '................', 'X...............', '................', 'X...............', '................', CRUNCH, 'X..X..X..X..X...'],
        march2: [MARCH, CRUNCH, MARCH, CRUNCH, MARCH, CRUNCH, MARCH, CRUNCH],
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
      // A march: backbeat plus the drag (the two ghosts before the beat).
      const MARCH = '....X..,.,..X.,,'
      const CRUNCH = '........x...X...'
      return {
        arrival: [_, _, ',.,.,.-.-.-.o.o.', '-,-,o-o-xoxoXxXx'],
        march: [MARCH, CRUNCH, MARCH, CRUNCH, MARCH, CRUNCH, MARCH, '....x.......,,-o'],
        hero: ['....X.......X...', '....X.......X..,', CRUNCH, '....X.......X...', '....X.......X...', '....X.......X..,', CRUNCH, ',,--ooxxXXXXXXXX'.replace(/X{8}$/, 'X..X..X.')],
        taunt: [_, _, _, _, _, _, '........x...X...', ',,,,----ooooxxxx'],
        march2: [MARCH, CRUNCH, MARCH, CRUNCH, MARCH, CRUNCH, MARCH, '....x.......,,-o'],
        turn: ['..........x.....', '..........x.....', '..........x...xX', '....,,,,--oooxxX']
      }
    })()
  },

  clap: {
    voice: 'clap',
    kind: 'grid',
    humanize: { ms: 2, vel: 0.05 },
    harmonic: false,
    bars: (() => {
      const CRUNCH = 'x...x...x.......'
      return {
        march: [_, CRUNCH, _, CRUNCH, _, CRUNCH, _, CRUNCH],
        hero: [_, _, CRUNCH, _, _, _, CRUNCH, 'X..X..X..X..X...'],
        taunt: ['............x...', '............x...', '............x...', '............x...', '............x...', '............x...', CRUNCH, _],
        march2: [_, CRUNCH, _, CRUNCH, _, CRUNCH, _, CRUNCH],
        turn: ['X..X..X.........', 'X..X..X.........', 'X..X..X.........', _]
      }
    })()
  },

  hatC: {
    voice: 'hatClosed',
    kind: 'grid',
    humanize: { ms: 2, vel: 0.1 },
    harmonic: false,
    bars: (() => {
      const EIGHTS = 'x.-.x.-.x.-.x.-.'
      const SIXTEENS = 'x,-,x,-,x,-,x,-,'
      return {
        arrival: [_, _, _, _],
        march: Array(8).fill(EIGHTS),
        hero: [SIXTEENS, SIXTEENS, EIGHTS, SIXTEENS, SIXTEENS, SIXTEENS, EIGHTS, _],
        march2: Array(8).fill(SIXTEENS)
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
      const DISCO = '..o...o...o...o.'
      return {
        hero: [DISCO, DISCO, _, DISCO, DISCO, DISCO, _, _],
        march2: [DISCO, _, DISCO, _, DISCO, _, DISCO, _]
      }
    })()
  },

  cowbell: {
    voice: 'cowbell',
    kind: 'grid',
    humanize: { ms: 3, vel: 0.06 },
    harmonic: false,
    bars: { march2: [_, '..............x.', _, '..............x.', _, '..............x.', _, '..............x.'] }
  },

  woodHi: {
    voice: 'woodblock',
    kind: 'grid',
    extra: { hi: true },
    humanize: { ms: 3, vel: 0.06 },
    harmonic: false,
    // The taunt's clock: the villain tapping its foot.
    bars: { taunt: ['....o.......o...', _, '....o.......o...', _, '....o.......o...', _, _, _] }
  },

  crash: {
    voice: 'crash',
    kind: 'grid',
    humanize: { ms: 1, vel: 0.03 },
    harmonic: false,
    bars: {
      arrival: [_, _, _, '........X.......'],
      march: ['x...............', _, _, _, _, _, _, _],
      hero: ['X...............', _, _, _, 'x...............', _, _, _],
      march2: ['X...............', _, _, _, 'x...............', _, _, _],
      turn: ['x...............', _, _, _]
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

  tomLow: {
    voice: 'tom',
    kind: 'grid',
    extra: { hz: 110 },
    humanize: { ms: 2, vel: 0.05 },
    harmonic: false,
    bars: { turn: [_, '..........xx....', '........x...x...', _] }
  },

  fx: {
    kind: 'events',
    harmonic: false,
    events: [
      // Winding up into the hero section, and down out of it.
      { bar: 12, step: 8, voice: 'slideWhistle', midi: 60, toMidi: 84, steps: 8, vel: 0.5 },
      { bar: 20, step: 12, voice: 'slideWhistle', midi: 84, toMidi: 62, steps: 4, vel: 0.45 },
      // The taunt lands on a spring.
      { bar: 21, step: 0, voice: 'boing', vel: 0.7 },
      // Noise up the snare roll into the top of the loop.
      { bar: 40, step: 0, voice: 'riser', midi: 60, toMidi: 96, steps: 16, vel: 0.4 }
    ]
  }
}

// ─── Mix ────────────────────────────────────────────────────────────────────
//
// The parade's ladder against the drums (bass -2, the hook -4, kazoo -6,
// counter-line -9, stabs -9), with the tuba as the bass and the timpani in the
// drum bus (it is struck, and it must not be ducked by its own kick).

export const MIX = {
  kick: { gain: 0.9, pan: 0, bus: 'drums' },
  snare: { gain: 0.4, pan: 0.04, rev: 0.12, bus: 'drums' },
  clap: { gain: 0.36, pan: -0.06, rev: 0.2, bus: 'drums' },
  hatC: { gain: 0.11, pan: 0.32, bus: 'drums' },
  hatO: { gain: 0.08, pan: 0.32, rev: 0.04, bus: 'drums' },
  cowbell: { gain: 0.18, pan: 0.26, rev: 0.08, bus: 'drums' },
  woodHi: { gain: 0.2, pan: -0.38, rev: 0.1, dly: 0.12, bus: 'drums' },
  crash: { gain: 0.15, pan: 0, bus: 'drums' },
  tomHi: { gain: 0.44, pan: -0.3, rev: 0.12, bus: 'drums' },
  tomLow: { gain: 0.44, pan: 0.3, rev: 0.12, bus: 'drums' },
  timpani: { gain: 0.4, pan: -0.12, rev: 0.16, bus: 'drums' },
  tuba: { gain: 0.87, pan: 0, rev: 0.05, bus: 'bass' },
  marimba: { gain: 0.37, pan: -0.08, rev: 0.12, dly: 0.06, bus: 'lead' },
  brassLow: { gain: 0.18, pan: 0.1, rev: 0.12, bus: 'lead' },
  xylo: { gain: 0.13, pan: 0.28, rev: 0.14, dly: 0.1, bus: 'lead' },
  kazoo: { gain: 0.69, pan: 0.18, rev: 0.14, dly: 0.09, bus: 'kazoo' },
  pizz: { gain: 1.12, pan: -0.34, rev: 0.12, bus: 'counter' },
  brassHits: { gain: 0.31, pan: 0, spread: 0.35, rev: 0.12, bus: 'comp' },
  fx: { gain: 0.27, pan: 0.15, rev: 0.18, dly: 0.12, bus: 'fx' }
}

export const RENDER = {
  file: 'boss-stomp',
  loop: true,
  // A fight, so half a unit over the parade — still inside the band the SFX
  // were balanced against (-33 … -27).
  lufs: -27.5,
  buses: { drums: 'dry', bass: 'bass', lead: 'bed', kazoo: 'bed', counter: 'bed', comp: 'bed', fx: 'dry' }
}
