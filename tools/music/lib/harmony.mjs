// ─── Harmony check ──────────────────────────────────────────────────────────
//
// Nobody listened to this track while it was written — it was composed as data
// and verified with meters and pictures. So the one mistake a listener would
// catch in a second and a spectrogram never would, a wrong note, is checked
// here, mechanically, before anything renders:
//
//  1. CLASH — a pitched note on a strong beat (1, 2, 3, 4), or held for an 8th
//     or longer, that is neither a chord tone nor an allowed tension of the
//     bar's chord. `render.mjs` refuses to render while any exist.
//  2. PASSING — a short, off-beat non-chord tone. Fine (it is most of what
//     makes a line sound like a line), but it must move by step into or out of
//     its neighbour; a LEAP to or from one is reported as a warning.
//  3. RUB — two different parts sounding a semitone (or major 7th / minor 9th)
//     apart at the same moment, where at least one of them is on a strong beat
//     or held. Warnings: sometimes that is the blues, usually it is a typo.

import { STEPS } from './notation.mjs'

const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
export const midiName = (m) => `${NAMES[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`

export const checkHarmony = (score, expanded) => {
  const { CHORDS, PARTS } = score
  const { events, bars } = expanded
  const pitched = events.filter((e) => e.midi != null && PARTS[e.part].harmonic !== false)
  const clashes = []
  const leaps = []
  const rubs = []
  let passing = 0

  const classify = (e) => {
    const chord = CHORDS[bars[e.bar - 1].chord]
    const pc = ((e.midi % 12) + 12) % 12
    const rel = (pc - chord.root + 12) % 12
    const tone = chord.tones.includes(rel) || (chord.bass != null && pc === chord.bass)
    const tension = (chord.tensions ?? []).includes(rel)
    return { chord, tone, tension }
  }

  // Per part, in order, for the neighbour test.
  const byPart = new Map()
  for (const e of pitched) {
    if (!byPart.has(e.part)) byPart.set(e.part, [])
    byPart.get(e.part).push(e)
  }

  for (const [, list] of byPart) {
    list.forEach((e, i) => {
      if (e.chordVoice != null) return // voicings are built from the chord itself
      const { tone, tension } = classify(e)
      if (tone || tension) return
      const strong = e.step % 4 === 0
      const long = e.lenSteps >= 2
      const label = `${e.part} bar ${e.bar} step ${e.step}: ${midiName(e.midi)} over ${bars[e.bar - 1].chord}`
      if (strong || long) {
        clashes.push(label)
        return
      }
      passing++
      const prev = list[i - 1]
      const next = list[i + 1]
      const stepwise = (o) => o && Math.abs(o.midi - e.midi) <= 2
      if (!stepwise(prev) && !stepwise(next)) leaps.push(label)
    })
  }

  // Vertical rubs between parts, sampled on every step.
  const absStep = (e) => (e.bar - 1) * STEPS + e.step
  const sounding = new Map()
  for (const e of pitched) {
    for (let s = absStep(e); s < absStep(e) + e.lenSteps; s++) {
      if (!sounding.has(s)) sounding.set(s, [])
      sounding.get(s).push(e)
    }
  }
  const seen = new Set()
  for (const [s, list] of sounding) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]
        const b = list[j]
        if (a.part === b.part) continue
        const iv = Math.abs(a.midi - b.midi) % 12
        if (iv !== 1 && iv !== 11) continue
        const strong = s % 4 === 0
        const held = a.lenSteps >= 2 && b.lenSteps >= 2
        if (!strong && !held) continue
        const key = [a.part, a.bar, a.step, b.part, b.bar, b.step].join(':')
        if (seen.has(key)) continue
        seen.add(key)
        rubs.push(`bar ${Math.floor(s / STEPS) + 1} step ${s % STEPS}: ${a.part} ${midiName(a.midi)} vs ${b.part} ${midiName(b.midi)}`)
      }
    }
  }

  return { notes: pitched.length, clashes, leaps, rubs, passing }
}
