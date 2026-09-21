// ─── "Gilded Boot" — the Splat Fever stinger ────────────────────────────────
//
// Ten seconds, exactly `FEVER_MS` (`src/game/combo.ts`), for the ten seconds the
// boot is gold. The GDD asks for a "shift into high-tempo chiptune/funk during
// Fever Mode"; this is Crunch Parade shifted up a gear AND up a tone: the same
// hook, the same three stomps, a whole step higher (F → G) and 116 → 144 BPM,
// sung by an 8-bit square lead over the parade's own funk band.
//
// Why G, and not the theme's F:
//   * the fever SFX (`feverStart` in useGameAudio) rings a G-major bell chord
//     for 1.1 s from the very same instant — the stinger's opening hit lands ON
//     that chord instead of under it;
//   * a whole step up is the oldest "power-up" in music: the tune a child
//     already knows, suddenly brighter.
//
//   bar  time    what happens
//   1    0:00.0  HIT: crash, kick, brass and bass on G — then an 8-bit arpeggio
//                climbs two octaves (the power-up)
//   2    0:01.7  the hook's sneak run on chip lead + marimba, disco octave bass
//   3    0:03.3  CRUNCH CRUNCH CRUNCH — and the chip fills the hole
//   4    0:05.0  the sneak over C7 (the parade's second phrase, a tone up)
//   5    0:06.7  the sneak over D7, snare roll and a riser: the build
//   6    0:08.3  the final CRUNCH CRUNCH CRUNCH on G6, then the hole
//
// ── Starting on any beat, ending clean ──
//
// The stinger starts the moment the player hits FEVER, wherever the bed is. So
// it has no pickup: sample 0 is the downbeat, and that hit (with the SFX's
// sweep) is what covers the bed getting out of the way. It ends the way the
// hook does — three stomps on beats 1-2-3 and a HOLE on beat 4 — and the hole
// is where the bed comes back in (`useSound` releases it there). The file is
// cut at exactly 441 000 samples and the render proves the last 100 ms were
// already near silence before its 60 ms insurance fade.

import { HOOK_LINES } from '../score.mjs'
import { transpose } from '../lib/notation.mjs'

export const TITLE = 'Gilded Boot (Fever Stinger)'
/** 6 bars at 144 BPM = 96 sixteenths × 104.17 ms = exactly 10.000 s. */
export const TEMPO = 144
export const SWING = 0.06
export const SEED = 'fever-stinger/1'

/** Must equal `FEVER_MS / 1000` — `tests/game/musicAssets.test.ts` holds the
 *  shipped file to it. */
const LENGTH_SEC = 10

const dom7 = (root) => ({ root, tones: [0, 4, 7, 10], tensions: [2, 9], voicing: [4, 10, 14] })

export const CHORDS = {
  G7: dom7(7),
  C7: dom7(0),
  D7: dom7(2),
  // The last chord is a major 6/9, not a dominant: the fever is WON.
  G6: { root: 7, tones: [0, 4, 7, 9], tensions: [2], voicing: [4, 9, 14] }
}

export const SECTIONS = [
  { name: 'hit', chords: ['G7'] },
  { name: 'hook', chords: ['G7', 'G7', 'C7', 'D7'] },
  { name: 'stomp', chords: ['G6'] }
]

const _ = null

// The parade's hook, a whole step up.
const SNEAK_G = transpose(HOOK_LINES.SNEAK_F, 2)        // D5 . D5 E5 F5:2 E5 D5 B4:2 G4 A4 B4:2 C5 C#5
const CRUNCH_G = transpose(HOOK_LINES.CRUNCH_F, 2)      // D5! D5! G5!
const SNEAK_C = transpose(HOOK_LINES.SNEAK_BB, 2, 'flat') // the second phrase, over C7
// The parade's third sneak ends in two rests (it hands to CRUNCH_OPEN); here
// it is the build, so the rests become a B–C# pickup into the final stomps.
const SNEAK_D = transpose(HOOK_LINES.SNEAK_C, 2).replace(/ \. \.$/, ' B4 C#5')
// The fever does not wait politely: the chip fills the hole with a run up.
const CRUNCH_G_FILL = CRUNCH_G.replace(/( \.){4}$/, ' G5 A5 B5 D6')
// The last stomps are damped (`_`): a marimba bar left to ring would still be
// sounding at 10.000 s, and the stinger has to be silent when the bed returns.
const CRUNCH_END = 'D5!_:2 . . D5!_:2 . . G5!_:4 . . . .'
const POWER_UP = '. . . . G4 B4 D5 G5 B4 D5 G5 B5 D5 G5 B5 D6!'

export const PARTS = {
  // ═══ Pitched ════════════════════════════════════════════════════════════
  chip: {
    voice: 'chip',
    kind: 'notes',
    extra: { duty: 0.25 },
    humanize: { ms: 2, vel: 0.05 },
    bars: {
      hit: [POWER_UP],
      hook: [SNEAK_G, CRUNCH_G_FILL, SNEAK_C, SNEAK_D],
      stomp: [CRUNCH_END]
    }
  },

  // The parade's hook instrument doubles the chip, so the tune is recognisably
  // the SAME tune and not a chiptune cover of it.
  marimba: {
    voice: 'marimba',
    kind: 'notes',
    humanize: { ms: 3, vel: 0.06 },
    bars: {
      hook: [SNEAK_G, CRUNCH_G, SNEAK_C, SNEAK_D],
      stomp: [CRUNCH_END]
    }
  },

  xylo: {
    voice: 'xylophone',
    kind: 'notes',
    humanize: { ms: 2, vel: 0.05 },
    bars: {
      hook: [_, transpose(CRUNCH_G, 12), _, _],
      stomp: ['. . . . . . . . G6!:2 . . . . . .']
    }
  },

  // 8-bit arpeggios in 8ths under the lead — thin duty, quiet, panned wide.
  chipArp: {
    voice: 'chip',
    kind: 'notes',
    extra: { duty: 0.125 },
    humanize: { ms: 1, vel: 0.04 },
    bars: {
      hook: [
        'B4 . D5 . F5 . G5 . B5 . G5 . F5 . D5 .',
        _,
        'C5 . E5 . G5 . Bb5 . C6 . Bb5 . G5 . E5 .',
        'D5 . F#5 . A5 . C6 . D6 . C6 . A5 . F#5 .'
      ]
    }
  },

  // ═══ Bass ═══════════════════════════════════════════════════════════════
  bass: {
    voice: 'slapBass',
    kind: 'notes',
    humanize: { ms: 2, vel: 0.05 },
    bars: (() => {
      // Disco octaves: the fever's drive. `ap` walks into the next root.
      const DISCO = '1! . 8 . 1 . 8 . 1! . 8 . b7 . 8 ap?'
      const CRUNCH = '1!:2 . . 1!:2 . . 8!:2 . 5? b7 . 1 ap?'
      const BUILD = '1! . 8 . 1 . 8 . 1! 8 1 8 1! 8 5 ap'
      return {
        hit: ['1!:2 . . 8! . 1? . 8! . 1? . 5 b7 8! ap?'],
        hook: [DISCO, CRUNCH, DISCO, BUILD],
        stomp: ['1!:2 . . 1!:2 . . 8!:3 . . . . .']
      }
    })()
  },

  // ═══ Chord stabs ════════════════════════════════════════════════════════
  clav: {
    voice: 'clav',
    kind: 'notes',
    humanize: { ms: 2, vel: 0.08 },
    bars: (() => {
      const SKANK = '. . H . . . H . . . H . . . H .'
      return { hook: [SKANK, _, SKANK, SKANK] }
    })()
  },

  brass: {
    voice: 'brass',
    kind: 'notes',
    humanize: { ms: 2, vel: 0.05 },
    bars: {
      hit: ['H!:4 . . . . . . . . . . . .'],
      hook: [_, 'H!:2 . . H!:2 . . H!:2 . . . . . .', _, '. . . . . . . . . . . . H!:2 H H'],
      stomp: ['H!:2 . . H!:2 . . H!:4 . . . .']
    }
  },

  // ═══ Drums ══════════════════════════════════════════════════════════════
  kick: {
    voice: 'kick',
    kind: 'grid',
    humanize: { ms: 1, vel: 0.03 },
    harmonic: false,
    bars: {
      hit: ['X...X...X...X...'],
      hook: ['X...X...X...X.x.', 'X...X...X.......', 'X...X...X...X.x.', 'X...X...X...X..x'],
      stomp: ['X...X...X.......']
    }
  },

  snare: {
    voice: 'snare',
    kind: 'grid',
    humanize: { ms: 1.5, vel: 0.05 },
    harmonic: false,
    bars: {
      hit: ['....X.......X.,,'],
      hook: ['....X.......X..,', '........x...X...', '....X..,....X..,', '....X...,,--ooxx']
    }
  },

  clap: {
    voice: 'clap',
    kind: 'grid',
    humanize: { ms: 1.5, vel: 0.05 },
    harmonic: false,
    bars: {
      hit: ['....x.......x...'],
      hook: ['....x.......x...', 'x...x...x.......', '....x.......x...', '....x.......x...'],
      stomp: ['X...X...X.......']
    }
  },

  hatC: {
    voice: 'hatClosed',
    kind: 'grid',
    humanize: { ms: 1.5, vel: 0.1 },
    harmonic: false,
    bars: {
      hit: ['....x,-,x,-,x,-,'],
      hook: ['x,-,x,-,x,-,x,-,', 'x.-.x.-.x.......', 'x,-,x,-,x,-,x,-,', 'x,-,x,-,x,-,x,-,']
    }
  },

  hatO: {
    voice: 'hatOpen',
    kind: 'grid',
    humanize: { ms: 1.5, vel: 0.08 },
    harmonic: false,
    chokedBy: 'hatC',
    bars: {
      hook: ['..o...o...o...o.', _, '..o...o...o...o.', '..o...o...o.....']
    }
  },

  shaker: {
    voice: 'shaker',
    kind: 'grid',
    humanize: { ms: 2, vel: 0.1 },
    harmonic: false,
    bars: { hook: Array(4).fill('-,,,-,,,-,,,-,,,') }
  },

  crash: {
    voice: 'crash',
    kind: 'grid',
    humanize: { ms: 0.5, vel: 0.03 },
    harmonic: false,
    bars: {
      hit: ['X...............'],
      // No crash on the last stomps: a cymbal rings for two seconds, and the
      // stinger has to be silent by 10.000 s.
      hook: ['x...............', _, 'o...............', _]
    }
  },

  // ═══ Accents ════════════════════════════════════════════════════════════
  fx: {
    kind: 'events',
    harmonic: false,
    events: [
      // The build: noise climbing into the last bar.
      { bar: 5, step: 0, voice: 'riser', midi: 64, toMidi: 100, steps: 16, vel: 0.55 }
    ]
  }
}

// ─── Mix ────────────────────────────────────────────────────────────────────
//
// The parade's ladder (bass -2, lead -4, stabs -9 LU against the drums), with
// the chip in the lead's seat and the marimba a step under it. Less reverb
// than the parade — ten seconds of fever wants punch, not a room.

export const MIX = {
  kick: { gain: 0.95, pan: 0, bus: 'drums' },
  snare: { gain: 0.4, pan: 0.04, rev: 0.08, bus: 'drums' },
  clap: { gain: 0.38, pan: -0.06, rev: 0.14, bus: 'drums' },
  hatC: { gain: 0.12, pan: 0.32, bus: 'drums' },
  hatO: { gain: 0.08, pan: 0.32, rev: 0.04, bus: 'drums' },
  shaker: { gain: 0.09, pan: -0.42, bus: 'drums' },
  crash: { gain: 0.13, pan: 0, bus: 'drums' },
  bass: { gain: 0.56, pan: 0, bus: 'bass' },
  chip: { gain: 0.5, pan: 0.08, rev: 0.07, dly: 0.06, bus: 'lead' },
  marimba: { gain: 0.24, pan: -0.12, rev: 0.1, bus: 'lead' },
  xylo: { gain: 0.1, pan: 0.28, rev: 0.12, bus: 'lead' },
  chipArp: { gain: 0.36, pan: 0.42, dly: 0.12, bus: 'arp' },
  clav: { gain: 0.17, pan: 0, spread: 0.45, rev: 0.04, bus: 'comp' },
  brass: { gain: 0.25, pan: 0, spread: 0.35, rev: 0.1, bus: 'comp' },
  fx: { gain: 0.5, pan: 0, rev: 0.1, bus: 'fx' }
}

export const RENDER = {
  file: 'fever-stinger',
  loop: { lengthSec: LENGTH_SEC },
  // Level with the loudest section of the parade (its 3 s short-term max is
  // -25.8 LUFS), 1.5 LU over the beds' average: the fever is the peak of a level.
  lufs: -26.5,
  buses: { drums: 'dry', bass: 'bass', lead: 'bed', arp: 'bed', comp: 'bed', fx: 'dry' },
  reverb: { room: 0.5, ret: 2.6 },
  delay: { steps: 3, feedback: 0.26, ret: 1.2 }
}
