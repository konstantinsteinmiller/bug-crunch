// ─── Score notation → timed events ─────────────────────────────────────────
//
// The score is written the way a tracker or a drum machine shows it: one string
// per bar, sixteen 16th-note steps. Three dialects, one per kind of part:
//
//   notes   "C5 . C5 D5 Eb5:2 D5 C5 A4:2 F4 G4 A4:2 Bb4 B4"
//           a note takes 1 step unless `:n`; `.` is a 1-step rest.
//           flags: `!` accent, `?` ghost, `^` bend up a tone at the end,
//                  `v` fall off (brass).
//   degrees "1!:2 . 1? . . 8! 1? 5:2 . b7 8! . 1 ap?"
//           the same, but relative to the bar's chord (bass): 1 3 b3 5 b7 7 8,
//           and `ap` = a semitone under the NEXT bar's root (the funk pickup).
//   hits    "H!:2 . . H!:2 . ."  — a chord stab on the bar's voicing.
//   grid    "X.....o...x....."  — drums, one character per step:
//           X 1.0  x 0.8  o 0.55  - 0.35  , 0.2  . silent
//
// Every bar is validated to be exactly 16 steps; a miscounted bar is a thrown
// error naming the part and the bar, never a silently shifted groove.

import { hashSeed, rng } from './dsp.mjs'

export const STEPS = 16

const NOTE_RE = /^([A-G])(#|b)?(-?\d)([!?^v]*)(?::(\d+))?([!?^v]*)$/
const DEGREE_RE = /^(1|b3|3|5|b7|7|8|ap)([!?^v]*)(?::(\d+))?([!?^v]*)$/
const HIT_RE = /^H([!?^v]*)(?::(\d+))?([!?^v]*)$/
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
const DEGREE = { 1: 0, b3: 3, 3: 4, 5: 7, b7: 10, 7: 11, 8: 12 }
const GRID_VEL = { X: 1, x: 0.8, o: 0.55, '-': 0.35, ',': 0.2 }
const FLAG_VEL = (flags) => (flags.includes('!') ? 1 : flags.includes('?') ? 0.45 : 0.8)

export const noteToMidi = (name) => {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name)
  if (!m) throw new Error(`bad note name ${name}`)
  return 12 * (Number(m[3]) + 1) + PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0)
}

const flagsOf = (s) => ({
  accent: s.includes('!'),
  ghost: s.includes('?'),
  bend: s.includes('^') ? 2 : 0,
  fall: s.includes('v')
})

/** Parse one bar of a tokenised dialect into `{ step, lenSteps, ... }` items. */
const parseTokens = (line, where) => {
  const out = []
  let step = 0
  for (const tok of line.trim().split(/\s+/)) {
    if (tok === '.') {
      step++
      continue
    }
    let m
    if ((m = NOTE_RE.exec(tok))) {
      const flags = m[4] + m[6]
      const len = m[5] ? Number(m[5]) : 1
      out.push({ step, lenSteps: len, midi: noteToMidi(m[1] + (m[2] ?? '') + m[3]), vel: FLAG_VEL(flags), ...flagsOf(flags) })
      step += len
    } else if ((m = DEGREE_RE.exec(tok))) {
      const flags = m[2] + m[4]
      const len = m[3] ? Number(m[3]) : 1
      out.push({ step, lenSteps: len, degree: m[1], vel: FLAG_VEL(flags), ...flagsOf(flags) })
      step += len
    } else if ((m = HIT_RE.exec(tok))) {
      const flags = m[1] + m[3]
      const len = m[2] ? Number(m[2]) : 1
      out.push({ step, lenSteps: len, hit: true, vel: FLAG_VEL(flags), ...flagsOf(flags) })
      step += len
    } else {
      throw new Error(`${where}: cannot read token "${tok}"`)
    }
  }
  if (step !== STEPS) throw new Error(`${where}: bar is ${step} steps, not ${STEPS} — "${line}"`)
  return out
}

const parseGrid = (line, where) => {
  if (line.length !== STEPS) throw new Error(`${where}: grid is ${line.length} chars, not ${STEPS} — "${line}"`)
  const out = []
  for (let s = 0; s < STEPS; s++) {
    const ch = line[s]
    if (ch === '.') continue
    const vel = GRID_VEL[ch]
    if (vel === undefined) throw new Error(`${where}: unknown grid char "${ch}"`)
    out.push({ step: s, lenSteps: 1, vel })
  }
  return out
}

// ─── Arrangement geometry ───────────────────────────────────────────────────

/** Flatten the section list into one chord name per bar (bar 1 = index 0) and
 *  a lookup of where each section starts. */
export const layout = (sections) => {
  const bars = []
  const starts = {}
  for (const s of sections) {
    starts[s.name] = bars.length
    for (const c of s.chords) bars.push({ chord: c, section: s.name })
  }
  return { bars, starts }
}

/** Where a chord's voicing sits: its lowest note lands in A3..G#4 — under the
 *  hook, over the bass, and below the squish's centre. */
export const voiceChord = (chord) => {
  const first = (chord.root + chord.voicing[0]) % 12
  let base = 57
  while (base % 12 !== first) base++
  return chord.voicing.map((v) => base + (v - chord.voicing[0]))
}

/** The bass octave for a root: A1..G#2. Low enough to be a bass, high enough
 *  that its 2nd-4th harmonics reach a phone speaker. */
const bassRoot = (pc) => {
  let m = 33
  while (m % 12 !== pc) m++
  return m
}

// ─── Expansion ──────────────────────────────────────────────────────────────

/**
 * Turn the score into a flat, time-sorted event list. Swing and humanisation
 * are applied here, from a seed per event (part + bar + step + index), so the
 * same score always renders the same performance and every loop copy of an
 * event is identical.
 */
export const expand = (score) => {
  const { TEMPO, SWING, SEED, SECTIONS, CHORDS, PARTS } = score
  const stepSec = 60 / TEMPO / 4
  const { bars, starts } = layout(SECTIONS)
  const totalBars = bars.length
  const events = []

  const chordAt = (barIdx) => CHORDS[bars[((barIdx % totalBars) + totalBars) % totalBars].chord]

  for (const [partName, part] of Object.entries(PARTS)) {
    if (part.kind === 'events') {
      // Hand-placed gestures (whistles, the boing): no grid, no humanising.
      part.events.forEach((e, idx) => {
        const swing = e.step % 2 === 1 ? SWING * stepSec : 0
        events.push({
          ...e,
          part: partName,
          lenSteps: e.steps ?? 1,
          time: ((e.bar - 1) * STEPS + e.step) * stepSec + swing,
          len: (e.steps ?? 1) * stepSec,
          seed: hashSeed(SEED, partName, idx)
        })
      })
      continue
    }

    const perBar = []
    for (const [section, lines] of Object.entries(part.bars)) {
      if (!(section in starts)) throw new Error(`${partName}: unknown section "${section}"`)
      const sec = SECTIONS.find((s) => s.name === section)
      if (lines.length !== sec.chords.length) {
        throw new Error(`${partName}.${section}: ${lines.length} bars written, section has ${sec.chords.length}`)
      }
      lines.forEach((line, i) => {
        if (line) perBar[starts[section] + i] = line
      })
    }

    let prev = null
    for (let b = 0; b < totalBars; b++) {
      const line = perBar[b]
      if (!line) continue
      const where = `${partName} bar ${b + 1}`
      const items = part.kind === 'grid' ? parseGrid(line, where) : parseTokens(line, where)
      const chord = chordAt(b)

      items.forEach((it, idx) => {
        const r = rng(hashSeed(SEED, partName, b, it.step, idx))
        const swing = it.step % 2 === 1 ? SWING * stepSec : 0
        const h = part.humanize ?? { ms: 0, vel: 0 }
        const jitter = ((r() + r() - 1) * h.ms) / 1000
        const velJ = 1 + (r() * 2 - 1) * h.vel
        const base = {
          part: partName,
          voice: part.voice,
          bar: b + 1,
          step: it.step,
          lenSteps: it.lenSteps,
          time: (b * STEPS + it.step) * stepSec + swing + jitter,
          len: it.lenSteps * stepSec,
          vel: Math.min(1, it.vel * velJ),
          accent: it.accent,
          ghost: it.ghost,
          bend: it.bend,
          fall: it.fall,
          seed: hashSeed(SEED, partName, b, it.step, idx, 'voice'),
          ...(part.extra ?? {})
        }

        if (it.hit) {
          // A chord stab: one event per voice of the voicing, spread a hair in
          // time (a strum, not a quantised block).
          voiceChord(chord).forEach((midi, k) => {
            events.push({ ...base, midi, time: base.time + k * 0.004, seed: hashSeed(base.seed, k), chordVoice: k })
          })
          return
        }

        if (part.kind === 'grid') {
          events.push({ ...base, len: part.lenSteps ? part.lenSteps * stepSec : base.len })
          return
        }

        let midi = it.midi
        // A bass octave is a POPPED note (index finger under the string) — the
        // brighter, snappier half of the slap sound. Absolute bass lines decide
        // by register in the voice instead.
        if (it.degree) base.pop = it.degree === '8'
        if (it.degree) {
          const root = bassRoot(chord.bass ?? chord.root)
          if (it.degree === 'ap') {
            const next = chordAt(b + 1)
            midi = bassRoot(next.bass ?? next.root) - 1
          } else {
            midi = root + DEGREE[it.degree]
          }
        }

        const ev = { ...base, midi }
        // Legato parts (the kazoo) glide from the previous note when it ended
        // at most a 16th ago and is within a fourth — a hummed line, not a
        // keyboard.
        if (part.legato && prev) {
          const gap = base.time - (prev.time + prev.len)
          if (gap <= stepSec * 1.05 && Math.abs(prev.midi - midi) <= 5 && prev.midi !== midi) ev.glideFrom = prev.midi
        }
        prev = ev
        events.push(ev)
      })
    }
  }

  events.sort((a, b) => a.time - b.time)
  return { events, stepSec, totalBars, loopSec: totalBars * STEPS * stepSec, bars }
}
