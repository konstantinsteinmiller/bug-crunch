// ─── "Stomped It!" — the result-screen sting ────────────────────────────────
//
// Three seconds for the cleared result screen: the hook's last gesture, played
// as a victory. Two bars at 160 BPM = exactly 3.000 s.
//
//   bar 1  the tail of the sneak run (B–C–C# on marimba) into
//          CRUNCH! CRUNCH! CRUNCH! on beats 2-3-4 — D, D, G, the parade's three
//          stomps a tone up, with the whole band in unison
//   bar 2  TA-DAA: a G6/9 chord (brass, bass, crash), a marimba roll, a
//          xylophone run to the top and a slide-whistle "whee" — rung out
//
// ── Why G major ──
//
// The screen it plays on is not quiet. Each star lands with the `star` cue
// (`happy`, a stock sample in G major: E–F#–G over G), up to three of them
// 340 ms apart, and they land in the first second of this sting. In G they are
// part of the chord; in the theme's F they would be a semitone off it. It is
// also the fever stinger's key, so "you won" and "you were unstoppable" are the
// same place.
//
// It does NOT share the screen with `celebration-1` (the level-clear sample,
// in B major, 1.34 s) — `resultStingDelayMs` in `src/game/musicRouting.ts`
// holds it until that has rung out. Two stings in two keys at once is the one
// thing this is not allowed to be.

import { HOOK_LINES } from '../score.mjs'
import { transpose } from '../lib/notation.mjs'

export const TITLE = 'Stomped It! (Result Sting)'
export const TEMPO = 160
export const SWING = 0
export const SEED = 'result-sting/1'

export const CHORDS = {
  G: { root: 7, tones: [0, 4, 7], tensions: [2, 9], voicing: [4, 7, 12] },
  G69: { root: 7, tones: [0, 4, 7, 9], tensions: [2], voicing: [4, 9, 14] }
}

export const SECTIONS = [{ name: 'sting', chords: ['G', 'G69'] }]

const _ = null

// The parade's CRUNCH bar a tone up is `D5! D5! G5!` on beats 1-2-3. Here the
// stomps sit on beats 2-3-4, with the run's chromatic tail as the pickup.
const CRUNCH = transpose(HOOK_LINES.CRUNCH_F, 2)
if (!CRUNCH.startsWith('D5!:2 . . D5!:2 . . G5!:2')) throw new Error(`result sting: the hook moved (${CRUNCH})`)
const STOMPS = '. B4 C5 C#5 D5!:2 . . D5!:2 . . G5!:2 . .'

export const PARTS = {
  marimba: {
    voice: 'marimba',
    kind: 'notes',
    humanize: { ms: 2, vel: 0.05 },
    bars: {
      // Bar 2: a tremolo on the 5th, dying away — a marimba player's "ta-daa".
      // Every stroke is damped (`_`): the mallet model rings each stroke
      // separately, and nine undamped D5s would still be humming at 3.000 s.
      sting: [STOMPS, 'D5!_ D5_ D5_ D5_ D5_ D5?_ D5?_ D5?_ D5?_:2 . . . . . .']
    }
  },

  xylo: {
    voice: 'xylophone',
    kind: 'notes',
    humanize: { ms: 2, vel: 0.05 },
    bars: {
      sting: [transpose(STOMPS, 12).replace(/^\. B5 C6 C#6/, '. . . .'), 'G5 A5 B5 D6 E6 G6!:4 . . . . . . .']
    }
  },

  bass: {
    voice: 'slapBass',
    kind: 'notes',
    humanize: { ms: 2, vel: 0.04 },
    bars: {
      sting: ['. . . . 1!:2 . . 1!:2 . . 8!:2 . .', '1!:6 . . . . . . . . . .']
    }
  },

  brass: {
    voice: 'brass',
    kind: 'notes',
    humanize: { ms: 2, vel: 0.04 },
    bars: {
      sting: ['. . . . H!:2 . . H!:2 . . H!:2 . .', 'H!:8 . . . . . . . .']
    }
  },

  timpani: {
    voice: 'timpani',
    kind: 'notes',
    humanize: { ms: 1, vel: 0.04 },
    bars: {
      // Every stroke damped (`_`) at its written length: a timpani left to ring
      // outlasts the file by a second.
      sting: ['. . . . D3!_:4 D3!_:4 G2!_:4', 'G2!_:8 . . . . . . . .']
    }
  },

  kick: {
    voice: 'kick',
    kind: 'grid',
    humanize: { ms: 1, vel: 0.03 },
    harmonic: false,
    bars: { sting: ['....X...X...X...', 'X...............'] }
  },

  snare: {
    voice: 'snare',
    kind: 'grid',
    humanize: { ms: 1, vel: 0.04 },
    harmonic: false,
    // A four-stroke ruff into the first stomp.
    bars: { sting: [',,-o............', '................'] }
  },

  clap: {
    voice: 'clap',
    kind: 'grid',
    humanize: { ms: 1, vel: 0.04 },
    harmonic: false,
    bars: { sting: ['....x...x...X...', 'X...............'] }
  },

  // A splash rather than the parade's crash: the cymbal has to be gone by
  // 3.000 s, and the open hat's decay is a third of the crash's.
  hatO: {
    voice: 'hatOpen',
    kind: 'grid',
    humanize: { ms: 1, vel: 0.04 },
    harmonic: false,
    bars: { sting: [_, 'X...............'] }
  },

  fx: {
    kind: 'events',
    harmonic: false,
    events: [
      // "Wheee!" up out of the chord.
      { bar: 2, step: 6, voice: 'slideWhistle', midi: 67, toMidi: 91, steps: 4, vel: 0.5 }
    ]
  }
}

export const MIX = {
  kick: { gain: 0.9, pan: 0, bus: 'drums' },
  snare: { gain: 0.36, pan: 0.04, rev: 0.1, bus: 'drums' },
  clap: { gain: 0.38, pan: -0.06, rev: 0.16, bus: 'drums' },
  hatO: { gain: 0.1, pan: 0.2, rev: 0.05, bus: 'drums' },
  timpani: { gain: 0.5, pan: -0.15, rev: 0.12, bus: 'drums' },
  bass: { gain: 0.5, pan: 0, bus: 'bass' },
  marimba: { gain: 0.37, pan: -0.08, rev: 0.12, bus: 'lead' },
  xylo: { gain: 0.14, pan: 0.26, rev: 0.14, bus: 'lead' },
  brass: { gain: 0.26, pan: 0, spread: 0.35, rev: 0.12, bus: 'comp' },
  fx: { gain: 0.28, pan: 0.15, rev: 0.18, bus: 'fx' }
}

export const RENDER = {
  file: 'result-sting',
  loop: { lengthSec: 3 },
  // A hair over the parade's loudest 3 s (-25.8): it plays on a screen with no
  // bed under it, and three star chimes on top of it.
  lufs: -26,
  buses: { drums: 'dry', bass: 'bass', lead: 'bed', comp: 'bed', fx: 'dry' },
  reverb: { room: 0.45, ret: 2.6 },
  delay: { steps: 3, feedback: 0.2, ret: 0.8 }
}
