// ─── The band ───────────────────────────────────────────────────────────────
//
// Every instrument is a function `(note, rand) -> Float32Array` (mono) or
// `-> [L, R]` (the two that are born stereo). `note` carries `midi`, `vel`
// (0..1), `len` (held seconds) and the articulation flags the score parser
// sets. Nothing here knows about bars or the mix — the renderer places, pans
// and sends.
//
// Two rules shape every voice, both from the game rather than from taste:
//
// * The squish SFX sit at 400 Hz-5 kHz and fire several times a second. So the
//   pitched voices are short and percussive (mallets, plucks, chops) wherever
//   they can be, the one sustained voice (the kazoo) is band-limited, and
//   nothing parks a bright pad on top of the board.
// * The game pitches the whole file up to x1.16 with the chain. Anything that
//   would alias at x1 still aliases at x1.16, just somewhere else — hence the
//   band-limited oscillators and the low-passes on every noise source.

import { SR, TAU, Osc, SVF, karplus, mtof, fadeTail, gateEnv, attackEnv, clamp } from './dsp.mjs'

const alloc = (seconds) => new Float32Array(Math.max(1, Math.ceil(seconds * SR)))
const softClip = (x, drive) => Math.tanh(drive * x) / Math.tanh(drive)

// ═══ Drums ══════════════════════════════════════════════════════════════════

/** Kick: a sine with a fast pitch drop, a 3 ms click, and tanh drive. The drive
 *  is what a phone speaker actually plays — the 50 Hz body is gone below its
 *  roll-off, the harmonics the saturation adds at 150-250 Hz are not. */
export const kick = ({ vel }, rand) => {
  const out = alloc(0.6)
  const click = new SVF()
  let ph = 0
  for (let i = 0; i < out.length; i++) {
    const t = i / SR
    const f = 47 + 115 * Math.exp(-t / 0.03) + 60 * Math.exp(-t / 0.005)
    ph += (TAU * f) / SR
    const body = Math.sin(ph) * attackEnv(t, 0.001) * Math.exp(-t / 0.15)
    const c = click.process(rand() * 2 - 1, 4500, 0.7) * Math.exp(-t / 0.003) * 0.3
    out[i] = softClip(body + c, 1.9) * vel
  }
  return fadeTail(out, 30)
}

/** Snare: two damped tones (the shell) plus band-limited noise (the wires). The
 *  noise is low-passed at 7 k — a crisp snare, not a bright one. */
export const snare = ({ vel }, rand) => {
  const out = alloc(0.42)
  const hp = new SVF()
  const lp = new SVF()
  let p1 = 0
  let p2 = 0
  for (let i = 0; i < out.length; i++) {
    const t = i / SR
    p1 += (TAU * 185 * (1 + 0.25 * Math.exp(-t / 0.012))) / SR
    p2 += (TAU * 332) / SR
    const tone = Math.sin(p1) * Math.exp(-t / 0.05) * 0.55 + Math.sin(p2) * Math.exp(-t / 0.03) * 0.22
    hp.process(rand() * 2 - 1, 950, 0.7)
    const n = lp.process(hp.hp, 7000, 0.7)
    const wires = n * (Math.exp(-t / 0.1) * 0.75 + Math.exp(-t / 0.01) * 0.6)
    out[i] = (tone + wires) * attackEnv(t, 0.0008) * vel
  }
  return fadeTail(out, 30)
}

/** Clap: four hands a few ms apart and then the room. The micro-bursts are what
 *  make it a clap instead of a snare; their spacing is jittered per hit so a
 *  bar of claps is a crowd rather than a sample. */
export const clap = ({ vel }, rand) => {
  const out = alloc(0.55)
  const bp1 = new SVF()
  const bp2 = new SVF()
  const offs = [0, 0.010 + rand() * 0.003, 0.021 + rand() * 0.003, 0.032 + rand() * 0.004]
  const amps = [0.75, 0.9, 0.8, 1]
  const tailAt = offs[3]
  for (let i = 0; i < out.length; i++) {
    const t = i / SR
    let env = 0
    for (let b = 0; b < 4; b++) if (t >= offs[b]) env += amps[b] * Math.exp(-(t - offs[b]) / 0.0055)
    if (t >= tailAt) env += 0.55 * Math.exp(-(t - tailAt) / 0.12)
    const w = rand() * 2 - 1
    bp1.process(w, 1150, 1.1)
    bp2.process(w, 2300, 1.6)
    out[i] = (bp1.bpn + 0.35 * bp2.bpn) * env * vel * 0.9
  }
  return fadeTail(out, 30)
}

/** Finger snap for the sneaky intro — a clap's little brother. */
export const snap = ({ vel }, rand) => {
  const out = alloc(0.14)
  const bp = new SVF()
  let ph = 0
  for (let i = 0; i < out.length; i++) {
    const t = i / SR
    const env = Math.exp(-t / 0.004) + (t > 0.006 ? 0.8 * Math.exp(-(t - 0.006) / 0.004) : 0) + 0.3 * Math.exp(-t / 0.028)
    ph += (TAU * 1750) / SR
    bp.process(rand() * 2 - 1, 2600, 2.2)
    out[i] = (bp.bpn * env + Math.sin(ph) * Math.exp(-t / 0.01) * 0.15) * vel
  }
  return fadeTail(out, 10)
}

// The 808's six square-wave "metal" frequencies. Summed and high-passed they
// read as a hat; the noise on top keeps them from sounding like a ring mod.
const METAL = [205.3, 304.4, 369.6, 522.7, 540, 800]

const hat = ({ vel }, rand, decay, seconds) => {
  const out = alloc(seconds)
  const oscs = METAL.map(() => new Osc(rand()))
  const hp = new SVF()
  const lp = new SVF()
  for (let i = 0; i < out.length; i++) {
    const t = i / SR
    let m = 0
    for (let k = 0; k < METAL.length; k++) m += oscs[k].pulse(METAL[k] * 1.9, 0.5)
    const src = m / 6 * 0.6 + (rand() * 2 - 1) * 0.55
    hp.process(src, 6800, 0.9)
    // Low-passed at 11 k: the brief is "no harsh build-up above 6 kHz", and a
    // hat is the one voice that lives there by definition.
    const x = lp.process(hp.hp, 11000, 0.7)
    out[i] = x * attackEnv(t, 0.0006) * Math.exp(-t / decay) * vel
  }
  return fadeTail(out, 8)
}

export const hatClosed = (n, rand) => hat(n, rand, 0.026, 0.12)
export const hatOpen = (n, rand) => hat(n, rand, 0.2, 0.75)

/** Shaker: a swelling, not a strike — the attack is 12 ms on purpose. */
export const shaker = ({ vel }, rand) => {
  const out = alloc(0.13)
  const bp = new SVF()
  const lp = new SVF()
  for (let i = 0; i < out.length; i++) {
    const t = i / SR
    const env = t < 0.012 ? (t / 0.012) ** 2 : Math.exp(-(t - 0.012) / 0.03)
    bp.process(rand() * 2 - 1, 5200, 0.9)
    out[i] = lp.process(bp.bpn, 8500, 0.7) * env * vel
  }
  return fadeTail(out, 10)
}

/** Woodblock: two modes of a struck block and a click. `hi` picks tick or tock. */
export const woodblock = ({ vel, hi }, rand) => {
  const f = hi ? 1060 : 760
  const out = alloc(0.2)
  const click = new SVF()
  let p1 = 0
  let p2 = 0
  for (let i = 0; i < out.length; i++) {
    const t = i / SR
    p1 += (TAU * f) / SR
    p2 += (TAU * f * 2.61) / SR
    const body = Math.sin(p1) * Math.exp(-t / 0.042) + 0.3 * Math.sin(p2) * Math.exp(-t / 0.016)
    const c = click.process(rand() * 2 - 1, 5000, 0.7) * Math.exp(-t / 0.0015) * 0.35
    out[i] = (body + c) * attackEnv(t, 0.0005) * vel
  }
  return fadeTail(out, 10)
}

/** Cowbell, 808-style: two detuned squares through a band-pass, a sharp strike
 *  and a short ring. Darker than the original — it only ever plays an answer. */
export const cowbell = ({ vel }, rand) => {
  const out = alloc(0.5)
  const a = new Osc(rand())
  const b = new Osc(rand())
  const bp = new SVF()
  for (let i = 0; i < out.length; i++) {
    const t = i / SR
    const x = a.pulse(562, 0.5) + b.pulse(845, 0.5)
    bp.process(x, 1500, 1.4)
    const env = 0.65 * Math.exp(-t / 0.018) + 0.35 * Math.exp(-t / 0.15)
    out[i] = bp.bpn * 0.5 * env * attackEnv(t, 0.0008) * vel
  }
  return fadeTail(out, 15)
}

/** Tom: a sine that drops a little into its pitch, with a touch of stick. */
export const tom = ({ vel, hz }, rand) => {
  const out = alloc(0.6)
  const click = new SVF()
  let ph = 0
  for (let i = 0; i < out.length; i++) {
    const t = i / SR
    ph += (TAU * hz * (1 + 0.45 * Math.exp(-t / 0.028))) / SR
    const body = Math.sin(ph) * Math.exp(-t / 0.17)
    const c = click.process(rand() * 2 - 1, 1600, 0.8) * Math.exp(-t / 0.008) * 0.25
    out[i] = softClip((body + c) * attackEnv(t, 0.001), 1.4) * vel
  }
  return fadeTail(out, 25)
}

/** Crash, born stereo (independent noise per side). Dark and short for a crash
 *  — it marks section starts, it does not wash over them. */
export const crash = ({ vel }, rand) => {
  const seconds = 2.2
  const sides = [0, 1].map(() => {
    const out = alloc(seconds)
    const oscs = [312, 437, 563, 797, 1031, 1463].map(() => new Osc(rand()))
    const fr = [312, 437, 563, 797, 1031, 1463]
    const hp = new SVF()
    const lp = new SVF()
    for (let i = 0; i < out.length; i++) {
      const t = i / SR
      let m = 0
      for (let k = 0; k < 6; k++) m += oscs[k].pulse(fr[k] * 2.3, 0.5)
      hp.process((rand() * 2 - 1) * 0.8 + (m / 6) * 0.35, 3200, 0.7)
      const x = lp.process(hp.hp, 8200, 0.6)
      const env = 0.75 * Math.exp(-t / 0.55) + 0.35 * Math.exp(-t / 0.05)
      out[i] = x * env * attackEnv(t, 0.002) * vel
    }
    return fadeTail(out, 200)
  })
  return sides
}

// ═══ Cartoon accents ════════════════════════════════════════════════════════

/** Slide whistle: a breathy sine gliding `midi -> toMidi` with a vibrato that
 *  opens up as it goes — the cartoon "whoop". */
export const slideWhistle = ({ vel, midi, toMidi, len }, rand) => {
  const out = alloc(len + 0.08)
  const breath = new SVF()
  const lp = new SVF()
  const osc = new Osc()
  let vph = 0
  for (let i = 0; i < out.length; i++) {
    const t = i / SR
    const u = clamp(t / len, 0, 1)
    const ease = 0.5 - 0.5 * Math.cos(Math.PI * u)
    vph += (TAU * 6.2) / SR
    const vib = Math.sin(vph) * (0.1 + 0.35 * u)
    const f = mtof(midi + (toMidi - midi) * ease + vib)
    const tone = osc.sine(f)
    const air = breath.process(rand() * 2 - 1, f, 6) * 0.25
    const env = attackEnv(t, 0.03) * gateEnv(t, len, 0.03) * (0.8 + 0.2 * Math.sin(Math.PI * u))
    out[i] = lp.process(tone + air + 0.05 * Math.sin(2 * TAU * osc.phase), 5000, 0.7) * env * vel
  }
  return fadeTail(out, 15)
}

/** Boing: a spring — pitch wobbling fast around a slowly rising centre, with a
 *  bit of twang from soft clipping. Played once, at the breakdown's landing. */
export const boing = ({ vel }) => {
  const out = alloc(0.75)
  const osc = new Osc()
  for (let i = 0; i < out.length; i++) {
    const t = i / SR
    const wobble = 0.45 * Math.exp(-t / 0.22) * Math.sin(TAU * 12 * t)
    const f = 185 * Math.pow(2, wobble + 0.25 * (t / 0.75))
    const x = osc.sine(f)
    out[i] = softClip(x * 1.2, 2) * Math.exp(-t / 0.22) * attackEnv(t, 0.002) * vel
  }
  return fadeTail(out, 20)
}

// ═══ Bass ═══════════════════════════════════════════════════════════════════

/**
 * Slap/pluck bass. Saw + pulse through a resonant low-pass whose cutoff is
 * plucked open and falls back — the "thumb". Popped notes (the octaves) open
 * further and faster; ghosts barely open at all and are cut short, which is
 * what makes a funk line breathe.
 *
 * The drive at the end is not decoration: it puts harmonics at 2-5x the
 * fundamental, and those are the only part of an 87 Hz F a phone can play.
 */
export const slapBass = ({ midi, vel, len, accent, ghost, pop: popFlag }, rand) => {
  const f = mtof(midi)
  const pop = popFlag ?? midi >= 49
  const gate = ghost ? Math.min(len, 0.05) : Math.max(0.06, len * 0.85)
  const out = alloc(gate + 0.14)
  const o1 = new Osc(rand())
  const o2 = new Osc(rand())
  const sub = new Osc()
  const flt = new SVF()
  const hiss = new SVF()
  const grit = new SVF()
  const gritLp = new SVF()
  // The floor the pluck settles to sits at 5-6x the fundamental, and the sub
  // sine is kept modest: a phone plays 250-800 Hz of a bass line and nothing
  // under it, so that band is where this voice has to live.
  const base = 420 + f * 1.6
  const peak = ghost ? 700 : pop ? 3600 : accent ? 2600 : 1900
  const fall = pop ? 0.045 : 0.085
  for (let i = 0; i < out.length; i++) {
    const t = i / SR
    const cutoff = base + (peak - base) * Math.exp(-t / fall)
    const src = o1.saw(f) * 0.7 + o2.pulse(f * 1.003, 0.42) * 0.3
    const filtered = flt.process(src, cutoff, 1.15)
    // Parallel grit: a hard-driven copy with everything under 230 Hz removed.
    // It adds the 3rd-7th harmonics a phone can play (200-1800 Hz) without
    // thickening the low end the kick shares or fizzing on top.
    grit.process(Math.tanh(4 * filtered), 200, 0.7)
    const edge = gritLp.process(grit.hp, 1800, 0.7)
    const body = filtered + edge * 1.1 + sub.sine(f) * 0.35
    const slap = pop ? hiss.process(rand() * 2 - 1, 3000, 0.7) * Math.exp(-t / 0.004) * 0.25 : 0
    const env = attackEnv(t, 0.002) * gateEnv(t, gate, 0.025) * Math.exp(-t / 0.9)
    out[i] = softClip((body + slap) * env * 0.9, 2.2) * vel
  }
  return fadeTail(out, 15)
}

/** Upright tiptoe bass: a tuned Karplus-Strong pluck with a sine underneath for
 *  weight, damped after the written length — staccato, sneaking. */
export const pizzBass = ({ midi, vel, len }, rand) => {
  const f = mtof(midi)
  const hold = Math.max(0.12, len * 0.8)
  const seconds = hold + 0.25
  const str = karplus(f, seconds, { t60: 1.1, exciteHz: 1500, pick: 0.22, rand })
  const out = alloc(seconds)
  const sub = new Osc()
  const lp = new SVF()
  for (let i = 0; i < out.length; i++) {
    const t = i / SR
    const x = str[i] * 0.8 + sub.sine(f) * 0.45 * Math.exp(-t / 0.3)
    out[i] = softClip(lp.process(x, 2400, 0.7) * gateEnv(t, hold, 0.045), 1.4) * vel
  }
  return fadeTail(out, 15)
}

// ═══ Mallets and plucks ═════════════════════════════════════════════════════

/**
 * Modal mallet. A struck bar is a handful of decaying sines at fixed partial
 * ratios; marimba and xylophone differ mostly in those ratios (marimba bars are
 * tuned so the 2nd partial is ~4x, xylophone ~3x) and in how fast they die.
 * Short by nature, which is the whole reason the hook lives on one: it can play
 * straight through a storm of squishes without holding a note on top of them.
 */
const mallet = ({ midi, vel, len, damp }, rand, { ratios, amps, decays, click, clickHz, maxSec }) => {
  const f = mtof(midi)
  const t1 = decays[0](f)
  const seconds = Math.min(maxSec, t1 * 6)
  const out = alloc(seconds)
  const ph = ratios.map(() => rand() * 0.2)
  const nz = new SVF()
  const bright = 0.6 + 0.4 * vel
  for (let i = 0; i < out.length; i++) {
    const t = i / SR
    let x = 0
    for (let k = 0; k < ratios.length; k++) {
      const fk = f * ratios[k]
      if (fk > 16000) continue
      const tk = k === 0 ? t1 : decays[k]
      const a = amps[k] * (k === 0 ? 1 : bright)
      x += a * Math.sin(TAU * (fk * t + ph[k])) * Math.exp(-t / tk)
    }
    const c = nz.process(rand() * 2 - 1, clickHz, 1) * Math.exp(-t / 0.0018) * click
    out[i] = (x + c) * attackEnv(t, 0.0012) * vel
    // `_` in the score: a hand stops the bar at the end of the written length.
    // Branch rather than multiply-by-one, so undamped notes (every note in the
    // parade) take exactly the arithmetic they always did.
    if (damp) out[i] *= gateEnv(t, len, 0.04)
  }
  return fadeTail(out, 20)
}

export const marimba = (n, rand) =>
  mallet(n, rand, {
    ratios: [1, 3.93, 9.24],
    amps: [1, 0.3, 0.06],
    decays: [(f) => clamp(0.6 * Math.pow(261 / f, 0.45), 0.14, 0.85), 0.065, 0.02],
    click: 0.08,
    clickHz: 2800,
    maxSec: 1.6
  })

export const xylophone = (n, rand) =>
  mallet(n, rand, {
    ratios: [1, 3.0, 6.2],
    amps: [1, 0.28, 0.07],
    decays: [(f) => clamp(0.3 * Math.pow(523 / f, 0.4), 0.08, 0.5), 0.045, 0.014],
    click: 0.1,
    clickHz: 4200,
    maxSec: 0.9
  })

/** Pizzicato strings for the counter-line: two tuned plucks a few cents apart
 *  (a section, not a soloist), damped after the note. */
export const pizz = ({ midi, vel, len }, rand) => {
  const hold = Math.max(0.1, len * 0.9)
  const seconds = hold + 0.2
  const a = karplus(mtof(midi + 0.05), seconds, { t60: 0.55, exciteHz: 4200, pick: 0.14, rand })
  const b = karplus(mtof(midi - 0.05), seconds, { t60: 0.5, exciteHz: 3800, pick: 0.2, rand })
  const out = alloc(seconds)
  const body = new SVF()
  const lp = new SVF()
  for (let i = 0; i < out.length; i++) {
    const t = i / SR
    const x = (a[i] + b[i]) * 0.5
    body.process(x, 420, 1.2)
    const y = lp.process(x + body.bpn * 0.4, 4800, 0.7)
    out[i] = y * gateEnv(t, hold, 0.05) * attackEnv(t, 0.002) * vel
  }
  return fadeTail(out, 15)
}

// ═══ Kazoo ══════════════════════════════════════════════════════════════════

/**
 * Kazoo: a buzzing reed through three vocal formants. The buzz is a saw/pulse
 * pushed into a tanh (a membrane rattling), the formants are unity-gain
 * band-passes at a hummed "oo-uh", and the pitch does what a person humming
 * into a kazoo does — scoops into accented notes, glides between close ones,
 * and wobbles once it has settled.
 *
 * The only sustained voice in the band, so it is the most careful one: low-
 * passed at 4.2 k, formants pinned below 2.6 k, and parked mostly in F4-C5,
 * under the squish's centre rather than on it.
 */
export const kazoo = ({ midi, vel, len, accent, glideFrom, bend }, rand) => {
  const gate = Math.max(0.07, len * 0.9)
  const seconds = gate + 0.12
  const out = alloc(seconds)
  const a = new Osc(rand())
  const b = new Osc(rand())
  const f1 = new SVF()
  const f2 = new SVF()
  const f3 = new SVF()
  const body = new SVF()
  const lp = new SVF()
  const rattle = new SVF()
  const scoop = glideFrom != null ? glideFrom - midi : accent ? -1.2 : -0.4
  const scoopTau = glideFrom != null ? 0.03 : accent ? 0.028 : 0.02
  let vph = rand() * TAU
  for (let i = 0; i < out.length; i++) {
    const t = i / SR
    vph += (TAU * 5.6) / SR
    const vibDepth = t < 0.13 ? 0 : Math.min(0.2, (t - 0.13) * 0.9)
    let m = midi + scoop * Math.exp(-t / scoopTau) + Math.sin(vph) * vibDepth
    if (bend && t > gate * 0.45) m += bend * (0.5 - 0.5 * Math.cos(Math.PI * clamp((t - gate * 0.45) / (gate * 0.5), 0, 1)))
    const f = mtof(m)
    const src = a.saw(f) * 0.7 + b.pulse(f * 1.002, 0.35) * 0.3
    const buzz = Math.tanh(2.4 * src) + rattle.process((rand() * 2 - 1) * Math.abs(src), 3000, 0.7) * 0.18
    f1.process(buzz, 620, 3.2)
    f2.process(buzz, 1180, 4.5)
    f3.process(buzz, 2550, 6)
    body.process(buzz, 850, 0.7)
    const voiced = f1.bpn + f2.bpn * 0.55 + f3.bpn * 0.2 + body.lp * 0.45
    const env = attackEnv(t, accent ? 0.008 : 0.016) * gateEnv(t, gate, 0.035)
    out[i] = lp.process(voiced, 4200, 0.7) * env * vel * 0.8
  }
  return fadeTail(out, 15)
}

// ═══ Chord voices ═══════════════════════════════════════════════════════════

/** Clav chop — a dry, pinched pulse through a snapping low-pass. The offbeat
 *  "chk" that makes the groove funk; ~100 ms, so it never becomes a bed. */
export const clav = ({ midi, vel, len }, rand) => {
  const gate = Math.min(0.11, Math.max(0.05, len * 0.6))
  const out = alloc(gate + 0.06)
  const o = new Osc(rand())
  const flt = new SVF()
  const f = mtof(midi)
  for (let i = 0; i < out.length; i++) {
    const t = i / SR
    const cutoff = 650 + 3300 * Math.exp(-t / 0.03)
    const x = flt.process(o.pulse(f, 0.27), cutoff, 1.8)
    out[i] = x * attackEnv(t, 0.001) * Math.exp(-t / 0.09) * gateEnv(t, gate, 0.012) * vel
  }
  return fadeTail(out, 8)
}

/** Brass stab — two detuned saws, a scooped attack and a swelling low-pass.
 *  `fall` drops the pitch at the end of the note: the cartoon "wah-waaah". */
export const brass = ({ midi, vel, len, fall }, rand) => {
  const gate = Math.max(0.09, len * 0.8)
  const fallSec = fall ? 0.35 : 0
  const out = alloc(gate + fallSec + 0.1)
  const a = new Osc(rand())
  const b = new Osc(rand())
  const flt = new SVF()
  for (let i = 0; i < out.length; i++) {
    const t = i / SR
    let m = midi - 0.6 * Math.exp(-t / 0.03)
    if (fall && t > gate) m -= 5 * clamp((t - gate) / fallSec, 0, 1) ** 1.6
    const f = mtof(m)
    const x = a.saw(f * 1.0046) * 0.5 + b.saw(f * 0.9954) * 0.5
    const open = (1 - Math.exp(-t / 0.01)) * Math.exp(-t / 0.18)
    const cutoff = 700 + 2200 * open + f * 0.8
    const env = attackEnv(t, 0.009) * gateEnv(t, gate + fallSec, 0.045) * (0.75 + 0.25 * Math.exp(-t / 0.08))
    out[i] = flt.process(x, cutoff, 0.8) * env * vel
  }
  return fadeTail(out, 15)
}

// ═══ Added for the other four pieces ════════════════════════════════════════
//
// The attic, the boss, the fever stinger and the result sting share the band
// above and add these. Same two rules: short where it can be, band-limited
// where it cannot, and nothing that parks a bright sustained tone on top of the
// board. None of the voices above were touched — the parade renders bit for bit.

/**
 * Chiptune pulse — the fever stinger's lead and arpeggios. A NES-style square
 * at a chosen duty (`duty`: 0.125 thin, 0.25 the classic lead, 0.5 hollow),
 * PolyBLEP band-limited like every oscillator here. An accented note starts a
 * semitone sharp and drops in 18 ms — the "blip" of an 8-bit power-up — and a
 * held one grows a vibrato. Low-passed at 6 k: bright enough to read as chip,
 * not so bright that it fizzes over the squish.
 */
export const chip = ({ midi, vel, len, accent, duty = 0.25 }, rand) => {
  const gate = Math.max(0.045, len * 0.82)
  const out = alloc(gate + 0.06)
  const o = new Osc(rand())
  const hp = new SVF()
  const lp = new SVF()
  for (let i = 0; i < out.length; i++) {
    const t = i / SR
    const vib = t > 0.12 ? Math.sin(TAU * 5.8 * (t - 0.12)) * Math.min(0.14, (t - 0.12) * 0.7) : 0
    const m = midi + (accent ? Math.exp(-t / 0.018) : 0) + vib
    const x = o.pulse(mtof(m), duty)
    hp.process(x, 160, 0.7)
    const y = lp.process(hp.hp, 6000, 0.7)
    const env = attackEnv(t, 0.002) * (0.72 + 0.28 * Math.exp(-t / 0.06)) * gateEnv(t, gate, 0.02)
    out[i] = y * env * vel * 0.55
  }
  return fadeTail(out, 10)
}

/**
 * Timpani: a struck membrane is a handful of inharmonic modes (air-loaded, so
 * they land near 1 : 1.5 : 2 : 2.44 : 2.94 of the principal), a dull thud under
 * them, and a felt mallet. Pitched per note, so the boss can walk a bass line
 * on it. The drive at the end is for the phone: an F2 principal is 87 Hz, and
 * what a small speaker plays is the 2nd-4th harmonics the saturation adds.
 */
export const timpani = ({ midi, vel, len, damp }, rand) => {
  const f = mtof(midi)
  const t1 = clamp(1.3 * Math.pow(110 / f, 0.3), 0.6, 1.8)
  const seconds = Math.min(2.4, Math.max(len + 0.3, t1 * 1.6))
  const out = alloc(seconds)
  const ratios = [1, 1.504, 1.742, 2.0, 2.245, 2.494]
  const amps = [1, 0.5, 0.18, 0.34, 0.12, 0.16]
  const taus = [t1, 0.55, 0.3, 0.42, 0.25, 0.3]
  const ph = ratios.map(() => rand())
  const mallet = new SVF()
  let thud = 0
  for (let i = 0; i < out.length; i++) {
    const t = i / SR
    const glide = 1 + 0.015 * Math.exp(-t / 0.06)
    let x = 0
    for (let k = 0; k < ratios.length; k++) {
      x += amps[k] * Math.sin(TAU * (f * ratios[k] * glide * t + ph[k])) * Math.exp(-t / taus[k])
    }
    thud += (TAU * f * 0.62) / SR
    x += 0.55 * Math.sin(thud) * Math.exp(-t / 0.07)
    const c = mallet.process(rand() * 2 - 1, 1100, 0.7) * Math.exp(-t / 0.006) * 0.5
    out[i] = softClip((x * 0.6 + c) * attackEnv(t, 0.0015), 1.5) * vel
    // `_`: the timpanist's hand on the head at the end of the written length.
    if (damp) out[i] *= gateEnv(t, len, 0.07)
  }
  return fadeTail(out, 40)
}

/**
 * Tuba: two saws a hair apart and a quiet square an octave down, through a
 * low-pass that blats open on the attack and settles — the "oom" of an oom-pah
 * and the lumbering villain's footsteps. The lips scoop into every note. Soft-
 * clipped for the buzz, which is also what carries a 55 Hz F1 on a phone.
 */
export const tuba = ({ midi, vel, len, accent, fall }, rand) => {
  const gate = Math.max(0.1, len * 0.85)
  const fallSec = fall ? 0.3 : 0
  const out = alloc(gate + fallSec + 0.12)
  const a = new Osc(rand())
  const b = new Osc(rand())
  const s = new Osc(rand())
  const flt = new SVF()
  const bell = new SVF()
  for (let i = 0; i < out.length; i++) {
    const t = i / SR
    let m = midi - 0.5 * Math.exp(-t / 0.035)
    if (fall && t > gate) m -= 7 * clamp((t - gate) / fallSec, 0, 1) ** 1.5
    const f = mtof(m)
    const x = a.saw(f * 1.003) * 0.45 + b.saw(f * 0.997) * 0.45 + s.pulse(f * 0.5, 0.5) * 0.18
    const open = (1 - Math.exp(-t / 0.012)) * (0.45 + 0.55 * Math.exp(-t / 0.15))
    const cutoff = 180 + f * 2.5 + (accent ? 1300 : 850) * open
    const y = flt.process(x, cutoff, 0.9)
    bell.process(y, 520, 1.6)
    const env = attackEnv(t, 0.014) * gateEnv(t, gate + fallSec, 0.06)
    out[i] = softClip((y + bell.bpn * 0.35) * env, 1.6) * vel * 0.8
  }
  return fadeTail(out, 20)
}

/**
 * Music box: a plucked steel tine. A clamped-free bar rings at 1 : 6.27 : 17.55,
 * so it is nearly a pure sine with a glassy ping that dies in milliseconds —
 * which is exactly why it can play a melody in the attic without ever holding a
 * bright note over the board. A breath of 2nd and 3rd harmonic from the comb
 * and the soundboard keeps it from sounding like a test tone.
 */
export const musicBox = ({ midi, vel }, rand) => {
  const f = mtof(midi)
  const t1 = clamp(1.5 * Math.pow(523 / f, 0.6), 0.35, 2.2)
  const out = alloc(Math.min(2.6, t1 * 4))
  const ratios = [1, 2, 3, 6.27, 17.55]
  const amps = [1, 0.08, 0.03, 0.22, 0.05]
  const taus = [t1, t1 * 0.4, t1 * 0.25, 0.05, 0.012]
  const ph = ratios.map(() => rand() * 0.25)
  const nz = new SVF()
  for (let i = 0; i < out.length; i++) {
    const t = i / SR
    let x = 0
    for (let k = 0; k < ratios.length; k++) {
      const fk = f * ratios[k]
      if (fk > 16000) continue
      x += amps[k] * Math.sin(TAU * (fk * t + ph[k])) * Math.exp(-t / taus[k])
    }
    const c = nz.process(rand() * 2 - 1, 5200, 1.2) * Math.exp(-t / 0.0012) * 0.12
    out[i] = (x + c) * attackEnv(t, 0.0007) * vel
  }
  return fadeTail(out, 30)
}

/**
 * Theremin: the cartoon ghost. A sine with a little waveshaped warmth, a slow
 * attack, a wide vibrato that blooms, and portamento — it swoops up into a note
 * from below ("ooOOoo") unless it is gliding from the previous one. `fall`
 * sinks it a fifth on release (the ghost going back into the wardrobe).
 * Spooky the way a Saturday-morning cartoon is spooky: silly first.
 */
export const theremin = ({ midi, vel, len, glideFrom, fall }, rand) => {
  const gate = Math.max(0.15, len * 0.95)
  const rel = fall ? 0.45 : 0.16
  const out = alloc(gate + rel + 0.05)
  const lp = new SVF()
  let ph = rand()
  const vph0 = rand() * TAU
  const from = glideFrom != null ? glideFrom - midi : -2.5
  const tau = glideFrom != null ? 0.07 : 0.11
  for (let i = 0; i < out.length; i++) {
    const t = i / SR
    const depth = Math.min(0.42, Math.max(0, t - 0.08) * 1.1)
    let m = midi + from * Math.exp(-t / tau) + Math.sin(vph0 + TAU * 6.1 * t) * depth
    if (fall && t > gate) m -= 7 * clamp((t - gate) / rel, 0, 1) ** 1.3
    ph += mtof(m) / SR
    const s = Math.sin(TAU * ph)
    const x = (Math.tanh(1.6 * s) / Math.tanh(1.6)) * 0.85 + 0.15 * s
    const env = attackEnv(t, 0.07) * gateEnv(t, gate, rel * 0.45)
    out[i] = lp.process(x, 3000, 0.7) * env * vel * 0.7
  }
  return fadeTail(out, 25)
}

/**
 * Bassoon: the grandfather of every cartoon tiptoe. A narrow pulse and a saw
 * pushed into a soft clip (the reed), through two fixed formants at a hollow
 * "aw" (480 Hz and 1.15 kHz) — a double reed's formants do not follow the
 * note, which is what makes the low notes sound comic. Staccato by nature.
 */
export const bassoon = ({ midi, vel, len, accent }, rand) => {
  const gate = Math.max(0.06, len * 0.72)
  const out = alloc(gate + 0.1)
  const a = new Osc(rand())
  const b = new Osc(rand())
  const f1 = new SVF()
  const f2 = new SVF()
  const f3 = new SVF()
  const body = new SVF()
  const lp = new SVF()
  const vph = rand() * TAU
  for (let i = 0; i < out.length; i++) {
    const t = i / SR
    const vib = t > 0.2 ? Math.sin(vph + TAU * 5 * t) * Math.min(0.12, (t - 0.2) * 0.5) : 0
    const f = mtof(midi - (accent ? 0.45 : 0.25) * Math.exp(-t / 0.025) + vib)
    const reed = Math.tanh(2 * (a.pulse(f, 0.28) * 0.6 + b.saw(f) * 0.4))
    f1.process(reed, 480, 2.8)
    f2.process(reed, 1150, 4)
    f3.process(reed, 2600, 5)
    body.process(reed, 700, 0.7)
    const voiced = f1.bpn + f2.bpn * 0.5 + f3.bpn * 0.12 + body.lp * 0.5
    const env = attackEnv(t, accent ? 0.012 : 0.022) * gateEnv(t, gate, 0.03)
    out[i] = lp.process(voiced, 3600, 0.7) * env * vel * 0.85
  }
  return fadeTail(out, 12)
}

/**
 * Toy organ: a little combo organ — drawbars at the octave, twelfth and
 * fifteenth over the fundamental with a pinch of the nineteenth, a key click,
 * and a tremolo wobbling the volume. The haunted fairground, not the
 * cathedral. Only ever short stabs (a chord voice on the off-beats), parked in
 * A3-G4 like every stab in the band.
 */
export const toyOrgan = ({ midi, vel, len }, rand) => {
  const gate = Math.max(0.08, len * 0.7)
  const out = alloc(gate + 0.09)
  const f = mtof(midi)
  const ratios = [1, 2, 3, 4, 6]
  const amps = [1, 0.55, 0.35, 0.22, 0.08]
  const ph = ratios.map(() => rand())
  const click = new SVF()
  const lp = new SVF()
  const trem = rand() * TAU
  for (let i = 0; i < out.length; i++) {
    const t = i / SR
    let x = 0
    for (let k = 0; k < ratios.length; k++) x += amps[k] * Math.sin(TAU * (f * ratios[k] * t + ph[k]))
    const c = click.process(rand() * 2 - 1, 2500, 0.8) * Math.exp(-t / 0.002) * 0.3
    const tr = 1 - 0.22 * (0.5 + 0.5 * Math.sin(trem + TAU * 6.4 * t))
    const env = attackEnv(t, 0.005) * gateEnv(t, gate, 0.035) * tr
    out[i] = lp.process((x * 0.4 + c) * env, 4200, 0.7) * vel
  }
  return fadeTail(out, 10)
}

/**
 * Riser: band-passed noise whose centre climbs from `midi` to `toMidi` over the
 * note and swells as it goes — the whoosh into a downbeat. Stops dead at the
 * end (the downbeat it leads to covers the cut).
 */
export const riser = ({ midi = 60, toMidi = 96, vel, len }, rand) => {
  const out = alloc(len + 0.02)
  const bp = new SVF()
  for (let i = 0; i < out.length; i++) {
    const t = i / SR
    const u = clamp(t / len, 0, 1)
    const fc = mtof(midi + (toMidi - midi) * u * u)
    bp.process(rand() * 2 - 1, fc, 2.2)
    const env = u * u * attackEnv(t, 0.01) * gateEnv(t, len, 0.006)
    out[i] = bp.bpn * env * vel
  }
  return fadeTail(out, 8)
}
