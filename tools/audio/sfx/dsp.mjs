/**
 * ─── The SFX build's synthesis toolkit ──────────────────────────────────────
 *
 * Offline, pure and deterministic: every voice writes into a `Bus`
 * (`{ out: Float32Array, sr, rnd }`, the same shape `src/game/audio/dsp.ts`
 * uses, so the crush bank's primitives can be mixed in freely) and every random
 * draw comes from the bus's seeded generator. The same recipe gives the same
 * samples on every machine, which is what lets the tests pin a cue and the
 * build ship the exact thing the audition folder played.
 *
 * This is the heavy end of the pipeline — physical and modal models, FFT
 * convolution, oversampled saturation — which is exactly why it runs HERE, at
 * build time, and ships as a few kilobytes of Vorbis, rather than in the game's
 * idle slices next to the crush bank (see PERF-LEDGER.md: the bank's pump is
 * already the audio's whole main-thread cost).
 *
 * Conventions: `at` and every time are seconds from the start of the bus; an
 * `amp` is the voice's peak before the master pass; `t60` is the time a mode or
 * tail takes to fall 60 dB.
 */

import { rngFrom, hashString } from '../../../src/game/audio/dsp.ts'
import { upsample4 } from './loudness.mjs'

export { rngFrom, hashString }

const TAU = Math.PI * 2
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
export const dbToGain = (d) => Math.pow(10, d / 20)
/** Semitones → frequency ratio. */
export const st = (s) => Math.pow(2, s / 12)
/** MIDI note → Hz. */
export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12)

export const makeBus = (seconds, sr, seed) => ({
  out: new Float32Array(Math.max(1, Math.ceil(seconds * sr))),
  sr,
  rnd: rngFrom(seed >>> 0)
})

/** A child bus for one layer, sharing rate and (a fork of) the random stream. */
export const layer = (b, seconds) => ({
  out: new Float32Array(Math.max(1, Math.ceil((seconds ?? b.out.length / b.sr) * b.sr))),
  sr: b.sr,
  rnd: rngFrom(Math.floor(b.rnd() * 4294967296))
})

export const range = (b, lo, hi) => lo + (hi - lo) * b.rnd()
export const logRange = (b, lo, hi) => lo * Math.pow(hi / lo, b.rnd())
export const jit = (b, x, pct) => x * (1 + pct * (b.rnd() * 2 - 1))
export const pick = (b, arr) => arr[Math.floor(b.rnd() * arr.length)]

/** Mix `src` into `b.out` starting at `at` seconds. */
export const mix = (b, src, at = 0, gain = 1) => {
  const n0 = Math.round(at * b.sr)
  const out = b.out
  for (let i = 0; i < src.length; i++) {
    const n = n0 + i
    if (n < 0) continue
    if (n >= out.length) break
    out[n] += src[i] * gain
  }
}

// ─── Envelopes ──────────────────────────────────────────────────────────────

/**
 * A breakpoint envelope: `[[t, v], …]`, t in seconds from the voice's start.
 * Segments are linear unless `curve` > 0, which bends them exponentially (a
 * decay that sounds like a decay). Before the first point the first value
 * holds; after the last, the last.
 */
export const envAt = (pts, t, curve = 0) => {
  if (t <= pts[0][0]) return pts[0][1]
  for (let i = 1; i < pts.length; i++) {
    const [t1, v1] = pts[i]
    if (t <= t1) {
      const [t0, v0] = pts[i - 1]
      const u = (t - t0) / Math.max(1e-9, t1 - t0)
      if (curve <= 0) return v0 + (v1 - v0) * u
      const k = (1 - Math.exp(-curve * u)) / (1 - Math.exp(-curve))
      return v0 + (v1 - v0) * k
    }
  }
  return pts[pts.length - 1][1]
}

/** Exponential (log-domain) breakpoint interpolation — for pitches. */
export const pitchAt = (pts, t) => {
  if (typeof pts === 'number') return pts
  if (typeof pts === 'function') return pts(t)
  if (t <= pts[0][0]) return pts[0][1]
  for (let i = 1; i < pts.length; i++) {
    const [t1, f1] = pts[i]
    if (t <= t1) {
      const [t0, f0] = pts[i - 1]
      const u = (t - t0) / Math.max(1e-9, t1 - t0)
      return f0 * Math.pow(f1 / f0, u)
    }
  }
  return pts[pts.length - 1][1]
}

/** Attack (raised cosine) → optional hold → exponential decay (t60). */
export const adEnv = (t, attack, hold, t60) => {
  if (t < 0) return 0
  if (t < attack) return 0.5 - 0.5 * Math.cos(Math.PI * t / attack)
  const d = t - attack - hold
  if (d <= 0) return 1
  return Math.exp(-6.908 * d / t60)
}

// ─── Oscillators ────────────────────────────────────────────────────────────

const polyBlep = (t, dt) => {
  if (t < dt) { t /= dt; return t + t - t * t - 1 }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1 }
  return 0
}

/**
 * One band-limited oscillator (PolyBLEP saw / square / pulse, integrated
 * triangle, sine) with a pitch trajectory, vibrato, drift and an amplitude
 * envelope. `pitch` is Hz, a breakpoint list `[[t, Hz], …]` (exponential), or a
 * function of t. `env` is a breakpoint list or a function of t.
 */
export const osc = (b, o) => {
  const { out, sr } = b
  const n0 = Math.round(o.at * sr)
  const len = Math.ceil(o.dur * sr)
  const wave = o.wave ?? 'sine'
  const pw = o.pw ?? 0.5
  const vibRate = o.vibRate ?? 0
  const vibDepth = o.vibDepth ?? 0
  const vibDelay = o.vibDelay ?? 0
  const drift = o.drift ?? 0
  const env = o.env
  let phase = o.phase ?? b.rnd()
  let tri = 0
  let driftV = 0
  const driftRnd = rngFrom(Math.floor(b.rnd() * 4294967296))
  for (let i = 0; i < len; i++) {
    const n = n0 + i
    if (n >= out.length) break
    const t = i / sr
    let f = pitchAt(o.pitch, t)
    if (vibDepth > 0 && t > vibDelay) {
      const ramp = Math.min(1, (t - vibDelay) / 0.12)
      f *= 1 + vibDepth * ramp * Math.sin(TAU * vibRate * t)
    }
    if (drift > 0) {
      if ((i & 63) === 0) driftV += ((driftRnd() * 2 - 1) * drift - driftV) * 0.2
      f *= 1 + driftV
    }
    const dt = Math.min(0.49, f / sr)
    phase += dt
    if (phase >= 1) phase -= 1
    let v
    switch (wave) {
      case 'saw': v = 2 * phase - 1 - polyBlep(phase, dt); break
      case 'square':
      case 'pulse': {
        v = phase < pw ? 1 : -1
        v += polyBlep(phase, dt)
        v -= polyBlep((phase + 1 - pw) % 1, dt)
        break
      }
      case 'tri': {
        let sq = phase < 0.5 ? 1 : -1
        sq += polyBlep(phase, dt)
        sq -= polyBlep((phase + 0.5) % 1, dt)
        tri = dt * sq + (1 - dt) * tri
        v = tri * 4
        break
      }
      default: v = Math.sin(TAU * phase)
    }
    const a = env === undefined ? 1 : typeof env === 'function' ? env(t) : envAt(env, t)
    if (n >= 0) out[n] += o.amp * a * v
  }
}

/** Additive partials that share a pitch trajectory: `[[ratio, gain, t60?], …]`. */
export const partials = (b, o) => {
  const { out, sr } = b
  const n0 = Math.round(o.at * sr)
  const len = Math.ceil(o.dur * sr)
  const phases = o.parts.map(() => b.rnd())
  const nyq = sr * 0.46
  const env = o.env
  for (let i = 0; i < len; i++) {
    const n = n0 + i
    if (n >= out.length) break
    const t = i / sr
    const f = pitchAt(o.pitch, t)
    const a = env === undefined ? 1 : typeof env === 'function' ? env(t) : envAt(env, t)
    let v = 0
    for (let k = 0; k < o.parts.length; k++) {
      const [r, g, t60] = o.parts[k]
      const fk = f * r
      phases[k] += fk / sr
      if (fk > nyq) continue
      const d = t60 ? Math.exp(-6.908 * t / t60) : 1
      v += g * d * Math.sin(TAU * phases[k])
    }
    if (n >= 0) out[n] += o.amp * a * v
  }
}

/**
 * Two-operator FM — bells, glass, the metallic shimmer of gold. The index
 * decays faster than the amplitude, which is what a struck metal body does:
 * bright and inharmonic at the strike, purer as it rings.
 */
export const fm = (b, o) => {
  const { out, sr } = b
  const n0 = Math.round(o.at * sr)
  const len = Math.ceil(o.dur * sr)
  let pc = 0
  let pm = 0
  const ratio = o.ratio ?? 1.4
  for (let i = 0; i < len; i++) {
    const n = n0 + i
    if (n >= out.length) break
    const t = i / sr
    const f = pitchAt(o.pitch, t)
    pm += (f * ratio) / sr
    const idx = o.index * Math.exp(-6.908 * t / (o.indexT60 ?? o.t60 * 0.4))
    pc += f / sr
    const a = adEnv(t, o.attack ?? 0.0015, o.hold ?? 0, o.t60)
    if (n >= 0) out[n] += o.amp * a * Math.sin(TAU * pc + idx * Math.sin(TAU * pm))
  }
}

// ─── Noise and filters ──────────────────────────────────────────────────────

/** A time-varying Simper/TPT state-variable filter over a buffer, in place. */
export const svf = (x, sr, mode, fc, q = 0.707, opts = {}) => {
  const k = 1 / q
  let ic1 = 0, ic2 = 0, a1 = 0, a2 = 0, a3 = 0
  const varying = typeof fc !== 'number'
  const setF = (f) => {
    const g = Math.tan(Math.PI * clamp(f, 10, sr * 0.47) / sr)
    a1 = 1 / (1 + g * (g + k)); a2 = g * a1; a3 = g * a2
  }
  if (!varying) setF(fc)
  const gainPeak = opts.gain !== undefined ? dbToGain(opts.gain) - 1 : 0
  for (let n = 0; n < x.length; n++) {
    if (varying && (n & 7) === 0) setF(pitchAt(fc, n / sr))
    const v0 = x[n]
    const v3 = v0 - ic2
    const v1 = a1 * ic1 + a2 * v3
    const v2 = ic2 + a2 * ic1 + a3 * v3
    ic1 = 2 * v1 - ic1
    ic2 = 2 * v2 - ic2
    switch (mode) {
      case 'lp': x[n] = v2; break
      case 'bp': x[n] = k * v1; break
      case 'hp': x[n] = v0 - k * v1 - v2; break
      case 'notch': x[n] = v0 - k * v1; break
      case 'peak': x[n] = v0 + gainPeak * k * v1; break
      default: x[n] = v2
    }
  }
  return x
}

/** A 4th-order Butterworth high/low-pass (two cascaded SVFs) — the master's
 *  sub cut and top cut, steep enough that a phone's missing octave costs no
 *  headroom and flat enough in the band that nothing audible moves. */
export const butter4 = (x, sr, mode, fc) => {
  svf(x, sr, mode, fc, 0.5412)
  svf(x, sr, mode, fc, 1.3066)
  return x
}

/**
 * Filtered white noise with an envelope — the backbone of every whoosh, scuff,
 * puff, shaker and snare wire. `f` may be a breakpoint list; `env` is a list or
 * a function; `am` adds a raised-cosine flutter.
 */
export const noise = (b, o) => {
  const sr = b.sr
  const len = Math.ceil(o.dur * sr)
  const r = rngFrom(Math.floor(b.rnd() * 4294967296))
  const x = new Float32Array(len)
  const color = o.color ?? 'white'
  let pink0 = 0, pink1 = 0, pink2 = 0, brown = 0
  // `periodic`: the white source repeats every `periodic` seconds, so once the
  // filters have settled the output is exactly periodic — a loop's noise with
  // no seam (render three periods, keep the middle one).
  const P = o.periodic ? Math.max(1, Math.round(o.periodic * sr)) : 0
  const base = P ? Float32Array.from({ length: P }, () => r() * 2 - 1) : null
  for (let i = 0; i < len; i++) {
    const w = base ? base[i % P] : r() * 2 - 1
    if (color === 'pink') {
      pink0 = 0.99765 * pink0 + w * 0.099046
      pink1 = 0.963 * pink1 + w * 0.2965164
      pink2 = 0.57 * pink2 + w * 1.0526913
      x[i] = (pink0 + pink1 + pink2 + w * 0.1848) * 0.25
    } else if (color === 'brown') {
      brown = (brown + w * 0.02) / 1.02
      x[i] = brown * 3.5
    } else x[i] = w
  }
  if (o.mode) {
    svf(x, sr, o.mode, o.f, o.q ?? 0.707)
    if (o.mode2) svf(x, sr, o.mode2, o.f2, o.q2 ?? 0.707)
    // Bring a narrow band back to about unit level, so `amp` means the same
    // thing whatever the filter is — otherwise every layer's gain is a guess.
    if (o.norm !== false && o.mode === 'bp') {
      const fc0 = pitchAt(o.f, 0)
      const bw = (Math.PI / 2) * (fc0 / (o.q ?? 0.707))
      x.forEach((v, i) => { x[i] = v * Math.min(12, 1 / Math.sqrt(clamp(bw / (sr / 2), 0.004, 1))) })
    }
  }
  const n0 = Math.round(o.at * sr)
  const env = o.env
  const amRate = o.amRate ?? 0
  const amDepth = o.amDepth ?? 0
  let amPhase = 0
  for (let i = 0; i < len; i++) {
    const n = n0 + i
    if (n >= b.out.length) break
    const t = i / sr
    let a = env === undefined ? 1 : typeof env === 'function' ? env(t) : envAt(env, t, o.curve ?? 0)
    if (amDepth > 0) {
      amPhase += pitchAt(amRate, t) / sr
      const s = 0.5 - 0.5 * Math.cos(TAU * amPhase)
      a *= 1 - amDepth + amDepth * Math.pow(s, o.amSharp ?? 1)
    }
    if (n >= 0) b.out[n] += o.amp * a * x[i]
  }
}

/** A single short, bright grain: band-passed noise with a fast decay. */
export const tick = (b, at, f, q, t60, amp) => {
  noise(b, { at, dur: t60 * 1.2 + 0.002, amp, mode: 'bp', f, q, env: (t) => adEnv(t, 0.0003, 0, t60) })
}

// ─── Physical models ────────────────────────────────────────────────────────

/**
 * MODAL STRIKE: a bank of two-pole resonators excited by a contact force.
 *
 * The excitation is a half-sine of the contact time (a hard mallet or a shoe
 * sole on wood is ~0.5 ms, a rubber sole or a soft mallet 3–6 ms), optionally
 * with a little noise in it for a rough surface. The contact's spectrum rolls
 * off above ~1/contact, so the SAME modes struck softer are darker — the
 * physics a sum of decaying sines cannot give. Each mode: [Hz, gain, t60 s].
 * `bend` sags every mode by that ratio over its ring (a plate denting, a drum
 * head settling after a hard hit).
 */
export const strike = (b, o) => {
  const { out, sr } = b
  const n0 = Math.round(o.at * sr)
  const contact = Math.max(1, Math.round((o.contact ?? 0.001) * sr))
  const roughness = o.rough ?? 0
  const r = rngFrom(Math.floor(b.rnd() * 4294967296))
  const exc = new Float32Array(contact)
  for (let i = 0; i < contact; i++) {
    exc[i] = Math.sin(Math.PI * (i + 0.5) / contact) * (1 - roughness + roughness * (r() * 2 - 1))
  }
  // The pulse's own area is ~2·contact/π samples; normalise so `amp` is the
  // resonator's height whatever the contact time (a soft hit is then darker,
  // not quieter — the gain is the recipe's decision).
  let area = 0
  for (let i = 0; i < contact; i++) area += exc[i]
  const bendT = o.bendT ?? 0.25
  for (const [f, g, t60] of o.modes) {
    if (f >= sr * 0.46 || g === 0) continue
    const len = Math.min(out.length - n0, Math.ceil((t60 * 1.05 + (o.contact ?? 0.001)) * sr))
    if (len <= 0) continue
    const rad = Math.pow(10, -3 / (t60 * sr))
    let w = TAU * f / sr
    let c1 = 2 * rad * Math.cos(w)
    const c2 = -rad * rad
    // |H| at resonance of y = x + c1 y1 + c2 y2 is ~1/((1-r)·2 sin w)… the
    // simpler, exact route: scale the input so an impulse rings at unit height.
    let inGain = Math.sin(w) / area
    let y1 = 0, y2 = 0
    for (let i = 0; i < len; i++) {
      if (o.bend && (i & 15) === 0) {
        const fb = f * (1 + o.bend * (1 - Math.exp(-i / sr / bendT)))
        w = TAU * fb / sr
        c1 = 2 * rad * Math.cos(w)
        inGain = Math.sin(w) / area
      }
      const x = i < contact ? exc[i] * inGain : 0
      const y = x + c1 * y1 + c2 * y2
      y2 = y1; y1 = y
      const n = n0 + i
      if (n >= 0 && n < out.length) out[n] += o.amp * g * y
    }
  }
}

/** Circular membrane mode ratios (Bessel zeros), for drums. */
export const MEMBRANE = [1, 1.594, 2.136, 2.296, 2.653, 2.918, 3.156, 3.501, 3.6, 4.06]
/** Free–free bar (glockenspiel, xylophone before tuning), for mallets. */
export const BAR = [1, 2.756, 5.404, 8.933, 13.34]
/** A tuned marimba bar: the maker carves the first overtones to 4× and 10×. */
export const MARIMBA = [1, 3.93, 9.54]

/**
 * KARPLUS–STRONG with the Jaffe–Smith extensions: a noise-burst pluck in a
 * tuned delay loop, a one-zero damping filter set by `bright`, a first-order
 * allpass for the fractional part of the period (so high notes stay in tune),
 * and a loss factor that gives the note a real t60 rather than one set by the
 * loop length. Twangs, plucks, spring boings and a rubber band's snap.
 */
export const pluck = (b, o) => {
  const { out, sr } = b
  const f = o.f
  const n0 = Math.round(o.at * sr)
  const len = Math.min(out.length - n0, Math.ceil(o.dur * sr))
  if (len <= 0) return
  const bright = clamp(o.bright ?? 0.5, 0.01, 0.99)
  // One-zero lowpass y = (1-s) x + s x1 has a group delay of s samples.
  const s = 0.5 * (1 - bright) + 0.02
  const period = sr / f - s
  const N = Math.max(2, Math.floor(period))
  const frac = period - N
  const ap = (1 - frac) / (1 + frac)
  const loss = Math.pow(10, -3 / ((o.t60 ?? 1) * f))
  const line = new Float32Array(N + 2)
  const r = rngFrom(Math.floor(b.rnd() * 4294967296))
  // The pluck: a noise burst, low-passed by the pick (softer pick = darker),
  // with a comb for the pluck position.
  let lp = 0
  for (let i = 0; i < N; i++) {
    lp += ((r() * 2 - 1) - lp) * (o.pick ?? 0.6)
    line[i] = lp
  }
  if (o.pos) {
    const d = Math.max(1, Math.round(N * o.pos))
    const copy = line.slice(0, N)
    for (let i = 0; i < N; i++) line[i] = copy[i] - copy[(i - d + N) % N]
  }
  let mean = 0
  for (let i = 0; i < N; i++) mean += line[i]
  mean /= N
  let peak = 1e-9
  for (let i = 0; i < N; i++) { line[i] -= mean; peak = Math.max(peak, Math.abs(line[i])) }
  for (let i = 0; i < N; i++) line[i] /= peak
  let idx = 0
  let x1 = 0
  let apX1 = 0
  let apY1 = 0
  for (let i = 0; i < len; i++) {
    const v = line[idx]
    // Damping, loss, fractional-delay allpass.
    const damped = ((1 - s) * v + s * x1) * loss
    x1 = v
    const apOut = ap * damped + apX1 - ap * apY1
    apX1 = damped
    apY1 = apOut
    line[idx] = apOut
    idx = (idx + 1) % N
    const t = i / sr
    const a = o.env ? (typeof o.env === 'function' ? o.env(t) : envAt(o.env, t)) : 1
    out[n0 + i] += o.amp * a * v
  }
}

/**
 * A pulse train through formant resonances — lips, a reed, a party blower, a
 * kazoo-free brass. Wide raised-cosine pulses (`pulseMs`) keep it mellow; the
 * jitter is what makes a raspberry comic instead of mechanical.
 */
export const reed = (b, o) => {
  const sr = b.sr
  const len = Math.ceil(o.dur * sr)
  const x = new Float32Array(len)
  const r = rngFrom(Math.floor(b.rnd() * 4294967296))
  let phase = 1
  let period = 1
  let at = 1e9
  const width = Math.max(2, Math.round(((o.pulseMs ?? 1.5) / 1000) * sr))
  let pulseAmp = 1
  for (let i = 0; i < len; i++) {
    const t = i / sr
    const f = pitchAt(o.pitch, t)
    phase += f / sr * period
    if (phase >= 1) {
      phase -= 1
      period = 1 + (o.jitter ?? 0) * (r() * 2 - 1)
      pulseAmp = 1 - (o.shimmer ?? 0) * r()
      at = 0
    }
    let v = 0
    if (at < width) { v = pulseAmp * (0.5 - 0.5 * Math.cos(TAU * (at + 0.5) / width)); at++ }
    v += (o.breath ?? 0) * (r() * 2 - 1) * 0.15
    x[i] = v
  }
  // DC off the pulse train before the formants ring.
  let mean = 0
  for (let i = 0; i < len; i++) mean += x[i]
  mean /= len
  const y = new Float32Array(len)
  for (const [ff, q, g] of o.formants) {
    const band = Float32Array.from(x, (v) => v - mean)
    svf(band, sr, 'bp', ff, q)
    for (let i = 0; i < len; i++) y[i] += band[i] * g
  }
  let peak = 1e-9
  for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(y[i]))
  const n0 = Math.round(o.at * sr)
  for (let i = 0; i < len; i++) {
    const n = n0 + i
    if (n >= b.out.length) break
    const t = i / sr
    const a = o.env ? (typeof o.env === 'function' ? o.env(t) : envAt(o.env, t)) : 1
    if (n >= 0) b.out[n] += o.amp * a * y[i] / peak
  }
}

// ─── Scheduling ─────────────────────────────────────────────────────────────

/**
 * Poisson events over [from, to): `rate(u)` events per second at u = 0..1 of
 * the window, `each(t, u, i)` called per event. Crackles, salt, applause,
 * coins — anything that should be a texture rather than a rhythm.
 */
export const scatter = (b, from, to, rate, each, max = 2000) => {
  let t = from
  for (let i = 0; i < max; i++) {
    const u = (t - from) / Math.max(1e-9, to - from)
    const rt = typeof rate === 'number' ? rate : rate(clamp(u, 0, 1))
    t += -Math.log(1 - b.rnd() * 0.9999) / Math.max(1e-3, rt)
    if (t >= to) break
    each(t, (t - from) / (to - from), i)
  }
}

// ─── Whole-buffer processing ────────────────────────────────────────────────

/**
 * Soft saturation, 4× oversampled so the harmonics it makes do not alias. This
 * is how a low body gets heard on a phone: a 70 Hz thump the speaker cannot
 * play grows 140/210/280 Hz partials it can, and the ear fills the fundamental
 * back in (the missing-fundamental effect) — weight without the headroom.
 */
export const saturate = (x, sr, drive = 2, mix = 1) => {
  if (drive <= 0) return x
  const up = upsample4(x)
  const norm = Math.tanh(drive)
  for (let i = 0; i < up.length; i++) up[i] = Math.tanh(up[i] * drive) / norm
  // Back down: an 8th-order low-pass under the original Nyquist, then decimate.
  butter4(butter4(up, sr * 4, 'lp', sr * 0.45), sr * 4, 'lp', sr * 0.45)
  for (let n = 0; n < x.length; n++) x[n] = x[n] * (1 - mix) + up[n * 4] * mix
  return x
}

/** In-place iterative radix-2 FFT. */
const fft = (re, im, inverse = false) => {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      let tr = re[i]; re[i] = re[j]; re[j] = tr
      tr = im[i]; im[i] = im[j]; im[j] = tr
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (inverse ? 2 : -2) * Math.PI / len
    const wr = Math.cos(ang), wi = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, c = a + len / 2
        const xr = re[c] * cr - im[c] * ci
        const xi = re[c] * ci + im[c] * cr
        re[c] = re[a] - xr; im[c] = im[a] - xi
        re[a] += xr; im[a] += xi
        const nr = cr * wr - ci * wi
        ci = cr * wi + ci * wr
        cr = nr
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n }
}

/** Linear convolution by FFT. Returns x.length + ir.length − 1 samples. */
export const convolve = (x, ir) => {
  const need = x.length + ir.length - 1
  let size = 1
  while (size < need) size <<= 1
  const ar = new Float64Array(size), ai = new Float64Array(size)
  const br = new Float64Array(size), bi = new Float64Array(size)
  ar.set(x); br.set(ir)
  fft(ar, ai); fft(br, bi)
  for (let k = 0; k < size; k++) {
    const r = ar[k] * br[k] - ai[k] * bi[k]
    const i = ar[k] * bi[k] + ai[k] * br[k]
    ar[k] = r; ai[k] = i
  }
  fft(ar, ai, true)
  return Float32Array.from(ar.subarray(0, need))
}

/**
 * A synthetic room impulse: a handful of early reflections (the walls, filtered
 * darker each bounce), then a diffuse tail built from four bands of noise that
 * decay at their own rates — highs die first, which is what makes a space sound
 * like wood and plaster rather than a tin can. Mono: the engine pans.
 */
export const roomIR = (sr, o, seed = 1) => {
  const r = rngFrom(seed)
  const len = Math.ceil((o.length ?? o.t60 * 1.1) * sr)
  const ir = new Float32Array(len)
  const pre = Math.round((o.predelay ?? 0.008) * sr)
  // Early reflections.
  const early = o.early ?? 8
  for (let k = 0; k < early; k++) {
    const at = pre + Math.round((0.002 + r() * (o.earlySpan ?? 0.035)) * sr)
    if (at < len) ir[at] += (r() < 0.5 ? -1 : 1) * (0.5 + 0.5 * r()) * Math.pow(0.8, k) * (o.earlyGain ?? 0.6)
  }
  // Diffuse tail: four bands, each its own t60.
  const bands = [
    ['lp', 300, o.t60 * (o.lowMul ?? 1.15)],
    ['bp', 1000, o.t60],
    ['bp', 3000, o.t60 * (o.highMul ?? 0.6)],
    ['hp', 6000, o.t60 * (o.airMul ?? 0.35)]
  ]
  const tail = new Float32Array(len)
  for (const [mode, fc, t60] of bands) {
    const nz = new Float32Array(len)
    for (let i = 0; i < len; i++) nz[i] = r() * 2 - 1
    svf(nz, sr, mode, fc, mode === 'bp' ? 0.9 : 0.707)
    const fadeIn = Math.round(0.012 * sr)
    for (let i = pre; i < len; i++) {
      const t = (i - pre) / sr
      const g = Math.exp(-6.908 * t / t60) * Math.min(1, (i - pre) / fadeIn)
      tail[i] += nz[i] * g
    }
  }
  // Unit energy for the tail: a steady input comes out of it at its own power,
  // so `wet` in `reverb()` reads directly as the room's level against the dry.
  let e = 0
  for (let i = 0; i < len; i++) e += tail[i] * tail[i]
  const norm = (o.tailGain ?? 1) / Math.sqrt(e + 1e-12)
  for (let i = 0; i < len; i++) ir[i] += tail[i] * norm
  // Fade the very end so a truncated tail never clicks.
  const fo = Math.min(len, Math.round(0.02 * sr))
  for (let i = 0; i < fo; i++) ir[len - 1 - i] *= i / fo
  return ir
}

/**
 * Add `wet` × (x convolved with ir) to x, keeping the tail. The SEND is
 * high-passed (150 Hz by default): a room should add space around a sound, not
 * a swamp of low end under it — and a phone plays none of that swamp anyway.
 */
export const reverb = (x, ir, wet, { sr = 44100, sendHp = 150, keepTail = true } = {}) => {
  const send = Float32Array.from(x)
  if (sendHp > 0) butter4(send, sr, 'hp', sendHp)
  const w = convolve(send, ir)
  const out = new Float32Array(keepTail ? w.length : x.length)
  for (let i = 0; i < out.length; i++) out[i] = (x[i] ?? 0) + wet * w[i]
  return out
}
