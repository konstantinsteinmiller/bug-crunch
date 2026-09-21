// ─── "Attic Tiptoe" — world 3's bed ─────────────────────────────────────────
//
// The one world where the picnic-blanket `cozy` reads wrong. Sparse and a
// little spooky — cartoon-spooky, the Saturday-morning kind where the ghost is
// a sheet with two holes in it — and still, underneath, Crunch Parade:
//
//   * the key is D minor (dorian: the B-natural is the sly smile), the theme's
//     RELATIVE minor, so F is still home ground;
//   * the parade opens on a pizzicato tiptoe bass; here that tiptoe is the
//     whole bed;
//   * the hook's sneak run is played by a bassoon (the grandfather of every
//     cartoon tiptoe), and its three stomps become three tiptoes — plink, plink,
//     PLONK on pizzicato strings — with a theremin "oooOOoo" in the hole where
//     the parade's woodblocks answer;
//   * and in the middle somebody finds a music box in a trunk, and it plays the
//     parade's hook, note for note, in the parade's own F, before the attic
//     pulls it back into minor.
//
// 92 BPM with a lazy swing, 28 bars = 73.04 s, written to loop.
//
//   bar  time    section  what happens
//   1    0:00.0  intro    the clock ticks, the tiptoe bass, a music box winding
//                         down, and the ghost clears its throat
//   5    0:10.4  sneak    the hook in D minor: bassoon runs, pizzicato tiptoes,
//                         finger snaps, the theremin falling in the holes
//   13   0:31.3  box      the music box: Crunch Parade's hook, verbatim, over
//                         the parade's own chords, the ghost answering
//   21   0:52.2  sneak 2  the hook again with a toy-organ off-beat (the haunted
//                         fairground) and a marimba doubling the bassoon
//   27   1:07.8  tag      tip, tip... BOO — and the ghost swoops back to bar 1
//
// No kick and no crash anywhere. The squish owns 400 Hz-5 kHz; the attic
// leaves it the whole room.

import { HOOK_LINES } from '../score.mjs'
import { transpose } from '../lib/notation.mjs'

export const TITLE = 'Attic Tiptoe (World 3)'
export const TEMPO = 92
/** A lazy swing — tiptoeing, not marching. */
export const SWING = 0.2
export const SEED = 'attic-tiptoe/1'

const dom7 = (root) => ({ root, tones: [0, 4, 7, 10], tensions: [2, 9], voicing: [4, 10, 14] })

export const CHORDS = {
  // Dorian: the 6th (B natural) is a tension, the colour of a sly grin.
  Dm: { root: 2, tones: [0, 3, 7, 10], tensions: [2, 5, 9], voicing: [3, 7, 12] },
  G7: dom7(7),
  // A7 flat-nine: the diminished shiver of every cartoon haunted house.
  A7: { root: 9, tones: [0, 4, 7, 10], tensions: [1, 8], voicing: [4, 10, 13] },
  Bb: { root: 10, tones: [0, 4, 7], tensions: [2, 9], voicing: [4, 7, 12] },
  // The music box's chords are the parade's own.
  F7: dom7(5),
  Bb7: dom7(10),
  C7: dom7(0)
}

export const SECTIONS = [
  { name: 'intro', chords: ['Dm', 'Dm', 'Dm', 'A7'] },
  { name: 'sneak', chords: ['Dm', 'Dm', 'G7', 'Dm', 'Dm', 'Dm', 'A7', 'Dm'] },
  { name: 'box', chords: ['F7', 'F7', 'Bb7', 'F7', 'F7', 'F7', 'C7', 'A7'] },
  { name: 'sneak2', chords: ['Dm', 'Dm', 'G7', 'Dm', 'A7', 'Dm'] },
  { name: 'tag', chords: ['Bb', 'A7'] }
]

// ─── Melodic material ───────────────────────────────────────────────────────

const _ = null
const { SNEAK_F, CRUNCH_F, SNEAK_BB, CRUNCH_RISE, SNEAK_C, CRUNCH_OPEN } = HOOK_LINES

// The hook a minor third down, re-moded to D minor: the parade's major thirds
// (A over F, E over C) become the minor key's F and F-natural, the rest is the
// same run with the same chromatic creep into the fifth (G–G#–A).
const SNEAK_DM = 'A4 . A4 B4 C5:2 B4 A4 F4:2 D4 E4 F4:2 G4 G#4'
const CRUNCH_DM = 'A4:2 . . A4:2 . . D5:2 . . . . . .' // tip, tip, TOE — no accents
const SNEAK_G7 = transpose(SNEAK_BB, -3) // B4 . B4 C5 D5:2 C5 B4 G4:2 D4 E4 F4:2 A4 G4
const CRUNCH_RISE_DM = 'F4:2 . . A4:2 . . D5:2 . . . . . .'
const SNEAK_A7 = 'C#5 . C#5 D5 E5:2 D5 C#5 A4:2 E4 F4 G4:2 . .'
const CRUNCH_OPEN_DM = 'F4:2 . . A4:2 . . C5:2 . . . . . .'

const down = (line) => transpose(line, -12)

// The ghost in the holes: 10 steps of silence, then a 6-step "oooOOoo".
const hole = (note) => `. . . . . . . . . . ${note}:6`

// Tiptoe bass: the parade's intro, re-harmonised per chord.
const TIP = {
  Dm: 'D2:2 . . F2:2 . . A2:2 . . C3 . B2 .',
  Dm2: 'A2:2 . . F2:2 . . D2:2 . . E2 . F2 .',
  G7: 'G2:2 . . B2:2 . . D3:2 . . F3 . E3 .',
  A7: 'A2:2 . . C#3:2 . . E3:2 . . G3 . F3 .',
  STOMP: 'D2:2 . . D2:2 . . D2:2 . . . . . .'
}

export const PARTS = {
  // ═══ The hook ═══════════════════════════════════════════════════════════
  bassoon: {
    voice: 'bassoon',
    kind: 'notes',
    humanize: { ms: 6, vel: 0.07 },
    bars: {
      sneak: [down(SNEAK_DM), _, down(SNEAK_G7), _, down(SNEAK_DM), _, down(SNEAK_A7), _],
      sneak2: [down(SNEAK_DM), _, down(SNEAK_G7), _, down(SNEAK_A7), _]
    }
  },

  // In the second sneak the marimba shadows the bassoon two octaves up —
  // quietly: a second tiptoer.
  marimba: {
    voice: 'marimba',
    kind: 'notes',
    humanize: { ms: 4, vel: 0.07 },
    bars: { sneak2: [SNEAK_DM, _, SNEAK_G7, _, SNEAK_A7, _] }
  },

  // The three stomps, tiptoed.
  pizz: {
    voice: 'pizz',
    kind: 'notes',
    humanize: { ms: 6, vel: 0.08 },
    bars: {
      sneak: [_, CRUNCH_DM, _, CRUNCH_RISE_DM, _, CRUNCH_DM, _, CRUNCH_OPEN_DM],
      sneak2: [_, CRUNCH_DM, _, CRUNCH_RISE_DM, _, CRUNCH_DM],
      tag: ['F4:2 . . F4:2 . . D5:2 . . . . . .', _]
    }
  },

  // The music box found in the trunk: Crunch Parade's hook, verbatim, an
  // octave up where a music box lives — and then the attic takes it back.
  musicBox: {
    voice: 'musicBox',
    kind: 'notes',
    humanize: { ms: 5, vel: 0.06 },
    bars: {
      intro: [
        '. . . . . . . . D6:8',
        '. . . . . . . . A5:4 D6:4',
        '. . . . F5 . E5 . D5:4 . . . .',
        _
      ],
      box: [
        transpose(SNEAK_F, 12), transpose(CRUNCH_F, 12), transpose(SNEAK_BB, 12, 'flat'), transpose(CRUNCH_RISE, 12),
        transpose(SNEAK_F, 12), transpose(CRUNCH_F, 12), transpose(SNEAK_C, 12, 'flat'),
        // ...and the last stomps land on A7 instead of F: back to minor.
        'A5:2 . . C#6:2 . . E6:2 . . . . . .'
      ]
    }
  },
  // (`CRUNCH_OPEN` is the parade's bar 12, which leads on to more parade. The
  // box never plays it: it is interrupted.)

  theremin: {
    voice: 'theremin',
    kind: 'notes',
    legato: true,
    humanize: { ms: 8, vel: 0.05 },
    bars: {
      intro: [_, _, '. . . . . . . . A4:8', 'G4:8 E4v:8'],
      // A slow ghostly fall across the four holes: F, E, D, C.
      sneak: [_, hole('F5'), _, hole('E5'), _, hole('D5'), _, hole('C5')],
      box: [_, hole('A4'), _, hole('C5'), _, hole('Eb5'), _, '. . . . . . . . E5:4 C#5v:4'],
      sneak2: [_, hole('F5'), _, hole('E5'), _, hole('A4')],
      tag: [_, 'C#5:4 E5:4 A5v:8']
    }
  },

  // ═══ Bass ═══════════════════════════════════════════════════════════════
  pizzBass: {
    voice: 'pizzBass',
    kind: 'notes',
    humanize: { ms: 6, vel: 0.06 },
    bars: {
      intro: [TIP.Dm, TIP.Dm2, TIP.Dm, TIP.A7],
      sneak: [TIP.Dm, TIP.STOMP, TIP.G7, TIP.STOMP, TIP.Dm, TIP.STOMP, TIP.A7, TIP.STOMP],
      // Under the music box: slow roots and fifths, a clockwork's two-step.
      box: ['1:8 5:8', '1:8 5:8', '1:8 5:8', '1:8 5:8', '1:8 5:8', '1:8 5:8', '1:8 5:8', '1:8 5:8'],
      sneak2: [TIP.Dm, TIP.STOMP, TIP.G7, TIP.STOMP, TIP.A7, TIP.STOMP],
      // The last bar climbs out through the leading tone into bar 1's D.
      tag: ['1:2 . . 1:2 . . 5:2 . . . . . .', 'A2:2 . . . . . . . . . . E2 . C#2 .']
    }
  },

  // ═══ Chords ═════════════════════════════════════════════════════════════
  toyOrgan: {
    voice: 'toyOrgan',
    kind: 'notes',
    humanize: { ms: 4, vel: 0.08 },
    bars: (() => {
      const OFF = '. . H . . . H . . . H . . . H .'
      const TWO_FOUR = '. . . . H . . . . . . . H . . .'
      return {
        box: Array(8).fill(TWO_FOUR),
        sneak2: Array(6).fill(OFF),
        // BOO!
        tag: ['. . . . . . . . . . . . H!:2 . .', _]
      }
    })()
  },

  // ═══ Percussion — no kick, no crash ═════════════════════════════════════
  snap: {
    voice: 'snap',
    kind: 'grid',
    humanize: { ms: 5, vel: 0.1 },
    harmonic: false,
    bars: (() => {
      const BACK = '....x.......x...'
      const TIPTOE = 'x...x...x.......'
      return {
        intro: [_, _, BACK, BACK],
        sneak: [BACK, TIPTOE, BACK, TIPTOE, BACK, TIPTOE, BACK, TIPTOE],
        sneak2: [BACK, TIPTOE, BACK, TIPTOE, BACK, TIPTOE],
        tag: [TIPTOE, _]
      }
    })()
  },

  // Brushes: the snare played with a whisper.
  brush: {
    voice: 'snare',
    kind: 'grid',
    humanize: { ms: 5, vel: 0.12 },
    harmonic: false,
    bars: (() => {
      const SWISH = '..,.-..,..,.-..,'
      return {
        sneak: Array(8).fill(SWISH),
        sneak2: Array(6).fill(SWISH)
      }
    })()
  },

  // The attic clock: tick on 1 and 3, tock on 2 and 4.
  woodHi: {
    voice: 'woodblock',
    kind: 'grid',
    extra: { hi: true },
    humanize: { ms: 3, vel: 0.06 },
    harmonic: false,
    bars: {
      intro: Array(4).fill('o.......o.......'),
      box: Array(8).fill('o.......o.......')
    }
  },

  woodLo: {
    voice: 'woodblock',
    kind: 'grid',
    extra: { hi: false },
    humanize: { ms: 3, vel: 0.06 },
    harmonic: false,
    bars: {
      intro: Array(4).fill('....o.......o...'),
      box: Array(8).fill('....o.......o...')
    }
  },

  shaker: {
    voice: 'shaker',
    kind: 'grid',
    humanize: { ms: 4, vel: 0.12 },
    harmonic: false,
    bars: (() => {
      const SOFT = ',.-.,.-.,.-.,.-.'
      return {
        intro: [_, _, SOFT, SOFT],
        box: Array(8).fill(SOFT)
      }
    })()
  },

  fx: {
    kind: 'events',
    harmonic: false,
    events: [
      // Somebody opens the trunk: a slide whistle up into the music box...
      { bar: 12, step: 10, voice: 'slideWhistle', midi: 62, toMidi: 86, steps: 6, vel: 0.4 },
      // ...and the lid bangs shut on a spring as the attic takes it back.
      { bar: 21, step: 0, voice: 'boing', vel: 0.5 }
    ]
  }
}

// ─── Mix ────────────────────────────────────────────────────────────────────
//
// A bigger, darker room than the parade (it is an attic), a dotted-8th echo on
// the music box and the ghost, and everything else close and dry. With no kick
// there is no side-chain: the tiptoe is never pumped.

export const MIX = {
  snap: { gain: 0.5, pan: -0.3, rev: 0.22, bus: 'drums' },
  brush: { gain: 0.5, pan: 0.2, rev: 0.12, bus: 'drums' },
  woodHi: { gain: 0.4, pan: -0.38, rev: 0.14, dly: 0.1, bus: 'drums' },
  woodLo: { gain: 0.4, pan: 0.38, rev: 0.14, bus: 'drums' },
  shaker: { gain: 0.2, pan: -0.42, bus: 'drums' },
  pizzBass: { gain: 0.66, pan: 0, rev: 0.08, bus: 'bass' },
  bassoon: { gain: 0.42, pan: 0.12, rev: 0.16, bus: 'lead' },
  marimba: { gain: 0.16, pan: -0.2, rev: 0.16, dly: 0.08, bus: 'lead' },
  musicBox: { gain: 0.15, pan: -0.14, rev: 0.22, dly: 0.14, bus: 'box' },
  theremin: { gain: 0.19, pan: 0.3, rev: 0.28, dly: 0.16, bus: 'ghost' },
  pizz: { gain: 1.3, pan: -0.28, rev: 0.16, bus: 'comp' },
  toyOrgan: { gain: 0.2, pan: 0, spread: 0.4, rev: 0.14, bus: 'comp' },
  fx: { gain: 0.24, pan: 0.15, rev: 0.2, dly: 0.1, bus: 'fx' }
}

export const RENDER = {
  file: 'attic-tiptoe',
  loop: true,
  // Sparse, so a unit under the parade — the band the SFX were balanced
  // against runs from bg-cozy's -33 to trance's -27.
  lufs: -29,
  buses: { drums: 'dry', bass: 'bass', lead: 'bed', box: 'bed', ghost: 'bed', comp: 'bed', fx: 'dry' },
  reverb: { room: 0.74, damp: 0.38, predelayMs: 24, ret: 3.4 },
  delay: { steps: 3, feedback: 0.36, ret: 1.6 }
}
