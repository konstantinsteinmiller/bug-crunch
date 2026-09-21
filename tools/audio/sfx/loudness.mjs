/**
 * ─── Measuring a cue the way a player's ears (and a phone) will ─────────────
 *
 * Pure, dependency-free meters for the SFX build (`tools/audio/build-sfx.mjs`)
 * and its tests. Four numbers per sound, because no single one is right for a
 * game's effects:
 *
 *   integrated   ITU-R BS.1770-4 / EBU R128: K-weighted, 400 ms blocks with
 *                75 % overlap, absolute (−70 LUFS) and relative (−10 LU) gates.
 *                The broadcast number — but a 90 ms stomp is mostly silence
 *                inside its first block, so for short cues read the next two.
 *   momentary    the loudest 400 ms K-weighted block (EBU "M max").
 *   phoneDb      the project's own phone-weighted loudness (`phoneLoudnessDb` in
 *                `src/game/audio/dsp.ts`): loudest 50 ms, < 150 Hz removed,
 *                +4 dB shelf over 1.7 kHz. What the crush bank is balanced on,
 *                so every new cue is balanced on it too.
 *   phone400     the same phone weighting over 400 ms — the long cues (a
 *                finisher, a fever) are judged by their body, not their click.
 *   truePeak     4× oversampled (BS.1770 Annex 2), dBTP.
 *
 * All pure JS on Float32Arrays, so vitest can pin them against known signals.
 */

import { phoneLoudnessDb } from '../../../src/game/audio/dsp.ts'

export { phoneLoudnessDb }

const TAU = Math.PI * 2

/** Apply a biquad (b0 b1 b2 a1 a2, a0 normalised) to a copy. */
export const biquadApply = (x, c) => {
  const [b0, b1, b2, a1, a2] = c
  const y = new Float32Array(x.length)
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0
  for (let n = 0; n < x.length; n++) {
    const v = x[n]
    const o = b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
    x2 = x1; x1 = v; y2 = y1; y1 = o
    y[n] = o
  }
  return y
}

/**
 * The K-weighting pre-filters at any sample rate: the two stages of BS.1770 (a
 * +4 dB high shelf near 1.68 kHz, and the RLB high-pass near 38 Hz), derived
 * from their analogue prototypes the way libebur128 does, so 44.1 kHz reads the
 * same as the 48 kHz coefficients printed in the recommendation.
 */
export const kWeightingCoefs = (sr) => {
  const shelf = (() => {
    const f0 = 1681.974450955533
    const G = 3.999843853973347
    const Q = 0.7071752369554196
    const K = Math.tan(Math.PI * f0 / sr)
    const Vh = Math.pow(10, G / 20)
    const Vb = Math.pow(Vh, 0.4996667741545416)
    const a0 = 1 + K / Q + K * K
    return [(Vh + Vb * K / Q + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0]
  })()
  const hp = (() => {
    const f0 = 38.13547087602444
    const Q = 0.5003270373238773
    const K = Math.tan(Math.PI * f0 / sr)
    const a0 = 1 + K / Q + K * K
    return [1, -2, 1, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0]
  })()
  return { shelf, hp }
}

export const kWeight = (x, sr) => {
  const { shelf, hp } = kWeightingCoefs(sr)
  return biquadApply(biquadApply(x, shelf), hp)
}

/** Mean-square per 400 ms block, 100 ms hop. A sound shorter than one block is
 *  measured in one zero-padded block — which is what a meter shows for it. */
const blocks = (y, sr, blockS = 0.4, hopS = 0.1) => {
  const B = Math.round(blockS * sr)
  const H = Math.round(hopS * sr)
  const out = []
  // Running sum of squares.
  const sq = new Float64Array(y.length + 1)
  for (let n = 0; n < y.length; n++) sq[n + 1] = sq[n] + y[n] * y[n]
  const last = Math.max(0, y.length - B)
  for (let s = 0; s <= last; s += H) out.push((sq[Math.min(y.length, s + B)] - sq[s]) / B)
  if (out.length === 0) out.push(sq[y.length] / B)
  return out
}

const lufsOf = (z) => (z > 0 ? -0.691 + 10 * Math.log10(z) : -Infinity)

/** BS.1770-4 integrated loudness (mono), LUFS. */
export const integratedLufs = (x, sr) => {
  const z = blocks(kWeight(x, sr), sr)
  const abs = z.filter((v) => lufsOf(v) > -70)
  if (abs.length === 0) return -Infinity
  const meanAbs = abs.reduce((a, b) => a + b, 0) / abs.length
  const rel = lufsOf(meanAbs) - 10
  const gated = abs.filter((v) => lufsOf(v) > rel)
  if (gated.length === 0) return -Infinity
  return lufsOf(gated.reduce((a, b) => a + b, 0) / gated.length)
}

/** Loudest 400 ms block, LUFS (EBU "momentary max"). */
export const momentaryMaxLufs = (x, sr) => lufsOf(Math.max(...blocks(kWeight(x, sr), sr)))

/** The phone weighting of `phoneLoudnessDb`, over 400 ms blocks instead of 50 ms. */
export const phone400Db = (x, sr) => {
  const hp = (sig, fc) => {
    // Same SVF high-pass `dsp.ts` uses, so the two phone numbers agree on 50 ms.
    const y = new Float32Array(sig.length)
    const k = Math.SQRT2
    const g = Math.tan(Math.PI * fc / sr)
    const a1 = 1 / (1 + g * (g + k))
    const a2 = g * a1
    const a3 = g * a2
    let ic1 = 0, ic2 = 0
    for (let n = 0; n < sig.length; n++) {
      const v0 = sig[n]
      const v3 = v0 - ic2
      const v1 = a1 * ic1 + a2 * v3
      const v2 = ic2 + a2 * ic1 + a3 * v3
      ic1 = 2 * v1 - ic1
      ic2 = 2 * v2 - ic2
      y[n] = v0 - k * v1 - v2
    }
    return y
  }
  const body = hp(x, 150)
  const presence = hp(body, 1700)
  const w = new Float32Array(x.length)
  for (let n = 0; n < x.length; n++) w[n] = body[n] + 0.585 * presence[n]
  const best = Math.max(...blocks(w, sr))
  return best > 1e-12 ? 10 * Math.log10(best) : -120
}

// ─── True peak ──────────────────────────────────────────────────────────────

/** Windowed-sinc polyphase interpolator, `factor` phases × `taps` each. */
const polyphase = (factor, taps) => {
  const half = taps / 2
  const phases = []
  for (let p = 0; p < factor; p++) {
    const h = new Float64Array(taps)
    const frac = p / factor
    let sum = 0
    for (let k = 0; k < taps; k++) {
      const t = k - half + 1 - frac
      const sinc = t === 0 ? 1 : Math.sin(Math.PI * t) / (Math.PI * t)
      // Blackman-Harris window over the whole kernel.
      const u = (k + 1 - frac) / (taps + 1)
      const w = 0.35875 - 0.48829 * Math.cos(TAU * u) + 0.14128 * Math.cos(2 * TAU * u) - 0.01168 * Math.cos(3 * TAU * u)
      h[k] = sinc * w
      sum += h[k]
    }
    for (let k = 0; k < taps; k++) h[k] /= sum
    phases.push(h)
  }
  return phases
}

const PHASES4 = polyphase(4, 48)

/** Upsample ×4 (for true-peak metering and oversampled nonlinearities). */
export const upsample4 = (x) => {
  const taps = PHASES4[0].length
  const half = taps / 2
  const y = new Float32Array(x.length * 4)
  for (let n = 0; n < x.length; n++) {
    for (let p = 0; p < 4; p++) {
      const h = PHASES4[p]
      let acc = 0
      for (let k = 0; k < taps; k++) {
        const i = n + k - half + 1
        if (i >= 0 && i < x.length) acc += h[k] * x[i]
      }
      y[n * 4 + p] = acc
    }
  }
  return y
}

/** Largest absolute value of the 4× oversampled signal, linear. */
export const truePeak = (x) => {
  let m = 0
  const y = upsample4(x)
  for (let i = 0; i < y.length; i++) m = Math.max(m, Math.abs(y[i]))
  for (let i = 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i]))
  return m
}

export const db = (v) => (v > 0 ? 20 * Math.log10(v) : -Infinity)

/** Everything the report prints for one sound. */
export const measure = (x, sr) => {
  let peak = 0
  let sum = 0
  for (let i = 0; i < x.length; i++) { peak = Math.max(peak, Math.abs(x[i])); sum += x[i] }
  return {
    durationMs: (x.length / sr) * 1000,
    samplePeakDb: db(peak),
    truePeakDb: db(truePeak(x)),
    integrated: integratedLufs(x, sr),
    momentary: momentaryMaxLufs(x, sr),
    phoneDb: phoneLoudnessDb(x, sr),
    phone400: phone400Db(x, sr),
    dc: sum / Math.max(1, x.length)
  }
}
