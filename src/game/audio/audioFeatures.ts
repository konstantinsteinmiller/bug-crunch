/**
 * ─── Measuring a crush without listening to it ─────────────────────────────
 *
 * The numbers the tests and `pnpm audio:render` use to say two crushes are
 * different sounds, and that a crush is clean. Pure, and never shipped to a
 * player (only the bench and the tests import it).
 *
 *   centroidHz   where the spectrum's weight sits — bright vs dark
 *   hiShare      energy share above 3 kHz — how much crackle/sparkle
 *   loShare      energy share below 600 Hz — how much body
 *   zcr          zero crossings per second — noisy/bright vs tonal/dark
 *   transients   sharp onsets per 100 ms — a crackle is dozens, a pop is one
 *   envCentroid  where the loudness sits in time, ms — a snap vs a gush
 *   crest        peak over RMS, dB — spiky vs sustained
 */

import { phoneLoudnessDb } from '@/game/audio/dsp'

export interface AudioFeatures {
  durationMs: number
  peak: number
  rmsDb: number
  crestDb: number
  dc: number
  centroidHz: number
  hiShare: number
  loShare: number
  zcr: number
  transients: number
  envCentroidMs: number
  phoneDb: number
}

/** In-place iterative radix-2 FFT on (re, im). */
const fft = (re: Float64Array, im: Float64Array): void => {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      const tr = re[i]!; re[i] = re[j]!; re[j] = tr
      const ti = im[i]!; im[i] = im[j]!; im[j] = ti
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len
    const wr = Math.cos(ang)
    const wi = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let cr = 1
      let ci = 0
      for (let k = 0; k < len / 2; k++) {
        const a = i + k
        const b = a + len / 2
        const xr = re[b]! * cr - im[b]! * ci
        const xi = re[b]! * ci + im[b]! * cr
        re[b] = re[a]! - xr
        im[b] = im[a]! - xi
        re[a]! += xr
        im[a]! += xi
        const nr = cr * wr - ci * wi
        ci = cr * wi + ci * wr
        cr = nr
      }
    }
  }
}

/** Energy-weighted average power spectrum over Hann frames. */
export const powerSpectrum = (x: Float32Array, size = 1024): Float64Array => {
  const hop = size / 2
  const acc = new Float64Array(size / 2)
  const re = new Float64Array(size)
  const im = new Float64Array(size)
  for (let s = 0; s + size <= Math.max(size, x.length); s += hop) {
    for (let i = 0; i < size; i++) {
      const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1))
      re[i] = (x[s + i] ?? 0) * w
      im[i] = 0
    }
    fft(re, im)
    for (let k = 0; k < size / 2; k++) acc[k]! += re[k]! * re[k]! + im[k]! * im[k]!
    if (s + size >= x.length) break
  }
  return acc
}

export const audioFeatures = (x: Float32Array, sr: number): AudioFeatures => {
  const n = x.length
  let peak = 0
  let sum = 0
  let sq = 0
  let zc = 0
  let envW = 0
  let envT = 0
  for (let i = 0; i < n; i++) {
    const v = x[i]!
    peak = Math.max(peak, Math.abs(v))
    sum += v
    sq += v * v
    if (i > 0 && (v >= 0) !== (x[i - 1]! >= 0)) zc++
    envW += v * v
    envT += v * v * i
  }
  const rms = Math.sqrt(sq / Math.max(1, n))

  const spec = powerSpectrum(x)
  const binHz = sr / (spec.length * 2)
  let total = 0
  let weighted = 0
  let hi = 0
  let lo = 0
  for (let k = 1; k < spec.length; k++) {
    const p = spec[k]!
    const f = k * binHz
    total += p
    weighted += p * f
    if (f >= 3000) hi += p
    if (f < 600) lo += p
  }

  // Transients: a 1 ms high-passed energy that jumps 4× above the running 10 ms
  // level, with a 3 ms refractory period so one grain is counted once.
  let transients = 0
  const fast = Math.exp(-1 / (0.001 * sr))
  const slow = Math.exp(-1 / (0.01 * sr))
  let ef = 0
  let es = 0
  let prev = 0
  let refractory = 0
  const gate = peak * peak * 1e-3
  for (let i = 0; i < n; i++) {
    const d = x[i]! - prev
    prev = x[i]!
    const e = d * d
    ef = fast * ef + (1 - fast) * e
    const lastSlow = es
    es = slow * es + (1 - slow) * e
    if (refractory > 0) { refractory--; continue }
    if (ef > 4 * lastSlow && ef > gate) {
      transients++
      refractory = Math.round(0.003 * sr)
    }
  }

  return {
    durationMs: (n / sr) * 1000,
    peak,
    rmsDb: rms > 0 ? 20 * Math.log10(rms) : -120,
    crestDb: rms > 0 ? 20 * Math.log10(peak / rms) : 0,
    dc: sum / Math.max(1, n),
    centroidHz: total > 0 ? weighted / total : 0,
    hiShare: total > 0 ? hi / total : 0,
    loShare: total > 0 ? lo / total : 0,
    zcr: zc / (n / sr),
    transients: transients / Math.max(0.1, n / sr / 0.1),
    envCentroidMs: envW > 0 ? (envT / envW / sr) * 1000 : 0,
    phoneDb: phoneLoudnessDb(x, sr)
  }
}

/**
 * A scale-free distance between two sounds' feature vectors, for "are these
 * actually different" checks: log-ratio on the positive features, difference
 * on the shares. 0 means indistinguishable on every axis.
 */
export const featureDistance = (a: AudioFeatures, b: AudioFeatures): number => {
  const lr = (p: number, q: number): number => Math.abs(Math.log((p + 1e-6) / (q + 1e-6)))
  return (
    lr(a.centroidHz, b.centroidHz) * 2 +
    lr(a.zcr, b.zcr) +
    lr(a.durationMs, b.durationMs) +
    lr(a.envCentroidMs, b.envCentroidMs) +
    lr(a.transients + 1, b.transients + 1) +
    Math.abs(a.hiShare - b.hiShare) * 3 +
    Math.abs(a.loShare - b.loShare) * 3 +
    Math.abs(a.crestDb - b.crestDb) / 6
  )
}
