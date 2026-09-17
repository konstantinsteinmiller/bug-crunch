/**
 * The OLD live-synthesised cues, rendered offline — the loudness reference.
 *
 * `useGameAudio.ts` still plays these as its fallback while the crush bank is
 * rendering, and `stompHeavy` is the slam every crush has to sit UNDER. To say
 * "the new beetle is about as loud as the old squish and quieter than the slam"
 * with a number rather than a guess, the bench needs the old graphs as samples.
 * This is a straight port of the old primitives (`tone`, `noiseBurst`,
 * `crackle`) using the Web Audio spec's own definitions: exponential ramps as
 * `V0·(V1/V0)^u`, and BiquadFilterNode's cookbook filters with lowpass/highpass
 * Q in dB and bandpass Q linear. Waveforms are naive (it is a loudness
 * reference, not a listening copy), and `Math.random` is seeded.
 *
 * Gains are the cue's own `vol()` arguments WITHOUT the player's 0.7 slider, so
 * they compare directly against a crush buffer × `CRUSH_MIX`.
 */

const mulberry = (seed) => () => {
  seed = (seed + 0x6d2b79f5) >>> 0
  let t = seed
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const expRamp = (v0, v1, u) => v0 * Math.pow(v1 / v0, Math.max(0, Math.min(1, u)))

const biquad = (type, f, q, sr) => {
  const w0 = (2 * Math.PI * Math.min(f, sr * 0.49)) / sr
  const cos = Math.cos(w0)
  const sin = Math.sin(w0)
  let b0, b1, b2, a0, a1, a2
  if (type === 'bandpass') {
    const alpha = sin / (2 * q)
    b0 = alpha; b1 = 0; b2 = -alpha; a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha
  } else {
    const alpha = sin / (2 * Math.pow(10, q / 20))
    if (type === 'lowpass') { b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = b0 }
    else { b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = b0 }
    a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha
  }
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0]
}

export const makeLegacy = (sr, seconds = 1, seed = 7) => {
  const out = new Float32Array(Math.ceil(sr * seconds))
  const rnd = mulberry(seed)

  const noiseBurst = (o) => {
    const n0 = Math.round((o.delay ?? 0) * sr)
    const n1 = Math.min(out.length, n0 + Math.round((o.duration + 0.02) * sr))
    const type = o.type ?? 'lowpass'
    const q = o.q ?? 1
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0, c = biquad(type, o.filterFrom, q, sr)
    for (let n = n0, i = 0; n < n1; n++, i++) {
      const u = i / sr / o.duration
      if ((i & 15) === 0) c = biquad(type, expRamp(o.filterFrom, Math.max(40, o.filterTo), u), q, sr)
      const x = rnd() * 2 - 1
      const y = c[0] * x + c[1] * x1 + c[2] * x2 - c[3] * y1 - c[4] * y2
      x2 = x1; x1 = x; y2 = y1; y1 = y
      const g = u <= 1 ? expRamp(o.gain, 0.0001, u) : 0.0001
      out[n] += g * y
    }
  }

  const osc = (type, phase) => {
    const p = phase - Math.floor(phase)
    if (type === 'sine') return Math.sin(2 * Math.PI * p)
    if (type === 'square') return p < 0.5 ? 1 : -1
    if (type === 'sawtooth') return 2 * p - 1
    return 1 - 4 * Math.abs(p - 0.5)
  }

  const tone = (o) => {
    const n0 = Math.round((o.delay ?? 0) * sr)
    const n1 = Math.min(out.length, n0 + Math.round((o.duration + 0.02) * sr))
    const attack = o.attack ?? 0.004
    let phase = 0
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0
    const c = o.filter ? biquad('lowpass', o.filter, 1, sr) : null
    for (let n = n0, i = 0; n < n1; n++, i++) {
      const t = i / sr
      const f = o.toFreq && o.toFreq !== o.freq ? expRamp(o.freq, Math.max(20, o.toFreq), t / o.duration) : o.freq
      phase += f / sr
      let v = osc(o.type ?? 'sine', phase)
      if (c) {
        const y = c[0] * v + c[1] * x1 + c[2] * x2 - c[3] * y1 - c[4] * y2
        x2 = x1; x1 = v; y2 = y1; y1 = y
        v = y
      }
      const peak = Math.max(0.0002, o.gain)
      const g = t < attack ? expRamp(0.0001, peak, t / attack) : t <= o.duration ? expRamp(peak, 0.0001, (t - attack) / (o.duration - attack)) : 0.0001
      out[n] += g * v
    }
  }

  const crackle = (o) => {
    for (let i = 0; i < o.count; i++) {
      const f = o.lo + rnd() * (o.hi - o.lo)
      noiseBurst({
        duration: 0.012 + rnd() * 0.024, gain: o.gain * (0.45 + rnd() * 0.55),
        filterFrom: f, filterTo: f * 0.7, type: 'bandpass', q: 1.6 + rnd() * 2,
        delay: o.from + rnd() * (o.to - o.from)
      })
    }
  }

  return { out, tone, noiseBurst, crackle, rnd }
}

/** The old three-layer squish, Juice Style `ooze`, for a body of `size` u. */
export const legacySquish = (sr, { size = 3.2, weight = 0.5, heavy = false, debris = false } = {}) => {
  const L = makeLegacy(sr, 0.5)
  const { tone, noiseBurst, crackle } = L
  const mass = Math.min(1, Math.max(0, (size - 1.8) / 2.2))
  const h = heavy ? 1.35 : 1
  const thud = 120 - weight * 62
  tone({ freq: thud, toFreq: thud * 0.45, duration: 0.09 + weight * 0.08, gain: 0.16 * h, type: 'sine' })
  noiseBurst({ duration: 0.035, gain: 0.06 * h, filterFrom: 2600 - weight * 900, filterTo: 400 })
  const base = 780 - mass * 430
  noiseBurst({ duration: 0.11 + mass * 0.1, gain: 0.2, filterFrom: base * 2.2, filterTo: base * 0.55, type: 'bandpass', q: 5.5, delay: 0.012 })
  tone({ freq: base * 1.1, toFreq: base * 0.42, duration: 0.1 + mass * 0.08, gain: 0.07, type: 'triangle', filter: 2400, delay: 0.012 })
  if (debris) crackle({ count: 4, from: 0.03, to: 0.18, gain: 0.055, lo: 1400, hi: 4600 })
  return L.out
}

export const legacyStompHeavy = (sr) => {
  const L = makeLegacy(sr, 0.6)
  const { tone, noiseBurst, crackle } = L
  noiseBurst({ duration: 0.025, gain: 0.2, filterFrom: 7000, filterTo: 2200 })
  tone({ freq: 62, toFreq: 26, duration: 0.34, gain: 0.46, type: 'sine' })
  tone({ freq: 150, toFreq: 58, duration: 0.14, gain: 0.16, type: 'triangle', filter: 1100 })
  noiseBurst({ duration: 0.3, gain: 0.17, filterFrom: 3800, filterTo: 130 })
  crackle({ count: 7, from: 0.03, to: 0.24, gain: 0.06, lo: 800, hi: 3600 })
  return L.out
}

export const legacyHurt = (sr) => {
  const L = makeLegacy(sr, 0.3)
  L.tone({ freq: 190, toFreq: 120, duration: 0.07, gain: 0.1, type: 'triangle', filter: 1800 })
  L.crackle({ count: 3, from: 0, to: 0.08, gain: 0.05, lo: 1800, hi: 4200 })
  return L.out
}

export const legacyClang = (sr) => {
  const L = makeLegacy(sr, 0.3)
  L.tone({ freq: 1590, toFreq: 1300, duration: 0.14, gain: 0.1, type: 'square', filter: 5200 })
  L.tone({ freq: 2460, duration: 0.09, gain: 0.05, type: 'sine' })
  L.noiseBurst({ duration: 0.05, gain: 0.06, filterFrom: 7000, filterTo: 3000, type: 'highpass' })
  return L.out
}

export const legacyPodPop = (sr) => {
  const L = makeLegacy(sr, 0.3)
  L.noiseBurst({ duration: 0.16, gain: 0.11, filterFrom: 3600, filterTo: 900 })
  L.tone({ freq: 420, toFreq: 180, duration: 0.14, gain: 0.08, type: 'triangle' })
  L.crackle({ count: 4, from: 0.01, to: 0.14, gain: 0.05, lo: 1800, hi: 5200 })
  return L.out
}

export const legacyBossHit = (sr) => {
  const L = makeLegacy(sr, 0.4)
  L.tone({ freq: 96, toFreq: 54, duration: 0.2, gain: 0.18, type: 'sine' })
  L.noiseBurst({ duration: 0.16, gain: 0.1, filterFrom: 2600, filterTo: 300 })
  return L.out
}
