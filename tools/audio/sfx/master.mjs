/**
 * ─── The mastering pass every shipped cue goes through ──────────────────────
 *
 *   1. DC blocker (a slow offset out of filtered noise is a click at the end).
 *   2. Sub cut — 4th-order high-pass at `hp` (60 Hz by default, 45 for the
 *      heavy hitters). A phone speaker plays nothing under ~150 Hz; energy down
 *      there only eats the headroom the audible part needs. Anything that must
 *      read as "weight" is carried by harmonics a speaker can play instead
 *      (see `saturate` in `dsp.mjs`).
 *   3. Presence — an optional peaking lift around 2.5 kHz, where a phone's
 *      speaker is most efficient and the ear most sensitive.
 *   4. Top cut — 4th-order low-pass at `lp` (10 kHz by default): the files ship
 *      at 22.05 kHz, and anything the decimator would fold back is removed here
 *      rather than trusted to it.
 *   5. Edges: trimmed to the first sample of attack (1 ms raised-cosine in),
 *      tail trimmed at −50 dB under the peak, faded out.
 *
 * Loudness and the true-peak limiter (`limitHard`, below) run per CUE, not per
 * slot, in `build-sfx.mjs` — so a cue's takes come out loudness-matched to each
 * other and share one runtime gain.
 *
 * Loops take `masterLoop` instead: every filter runs CIRCULARLY (three copies
 * through, the middle one kept), so the sample after the last one is exactly
 * the sample the filters would have produced from the first — the seam stays
 * seamless through the mastering, not just through the render.
 */
import { butter4, svf } from './dsp.mjs'
import { truePeak, upsample4 } from './loudness.mjs'

const TAU = Math.PI * 2

const dcBlock = (x, sr, fc = 12) => {
  const R = Math.exp(-TAU * fc / sr)
  let x1 = 0, y1 = 0
  for (let n = 0; n < x.length; n++) {
    const y = x[n] - x1 + R * y1
    x1 = x[n]
    y1 = y
    x[n] = y
  }
  return x
}

const filters = (x, sr, o) => {
  dcBlock(x, sr)
  butter4(x, sr, 'hp', o.hp ?? 60)
  if (o.presence) svf(x, sr, 'peak', o.presence.f ?? 2500, o.presence.q ?? 0.8, { gain: o.presence.gain ?? 1.5 })
  if (o.eq) for (const [f, gain, q] of o.eq) svf(x, sr, 'peak', f, q ?? 1, { gain })
  butter4(x, sr, 'lp', o.lp ?? 10000)
  return x
}

/** Filters + edges for a one-shot. */
export const master = (raw, sr, o = {}) => {
  const x = filters(Float32Array.from(raw), sr, o)
  let peak = 0
  for (let i = 0; i < x.length; i++) peak = Math.max(peak, Math.abs(x[i]))
  if (peak === 0) return x
  // First sample of attack: the first above −50 dB of the peak, less 1 ms.
  const onset = peak * Math.pow(10, -50 / 20)
  let first = 0
  if (o.trimStart !== false) {
    while (first < x.length && Math.abs(x[first]) < onset) first++
    first = Math.max(0, first - Math.round(0.001 * sr))
  }
  // Tail: last sample above −50 dB of the peak (plus 15 ms) — these play 25 dB
  // and more under full scale in a busy mix, where a tail 50 dB down is gone.
  const floor = peak * Math.pow(10, -(o.tailDb ?? 50) / 20)
  let last = x.length - 1
  while (last > first && Math.abs(x[last]) < floor) last--
  const end = Math.min(x.length, last + Math.round(0.015 * sr))
  const maxLen = o.maxDur ? Math.round(o.maxDur * sr) : Infinity
  const y = x.slice(first, Math.min(end, first + maxLen))
  const fin = Math.max(1, Math.round((o.fadeInMs ?? 1) * sr / 1000))
  for (let i = 0; i < fin && i < y.length; i++) y[i] *= 0.5 - 0.5 * Math.cos(Math.PI * i / fin)
  const fout = Math.max(1, Math.min(Math.round((o.fadeOutMs ?? 20) * sr / 1000), Math.floor(y.length * 0.3)))
  for (let i = 0; i < fout; i++) y[y.length - 1 - i] *= 0.5 - 0.5 * Math.cos(Math.PI * i / fout)
  return y
}

/** Filters for a loop, run circularly. `x` is exactly one period. */
export const masterLoop = (raw, sr, o = {}) => {
  const L = raw.length
  const triple = new Float32Array(L * 3)
  triple.set(raw, 0); triple.set(raw, L); triple.set(raw, 2 * L)
  // A fourth, leading copy lets even the 12 Hz DC blocker settle.
  const quad = new Float32Array(L * 4)
  quad.set(raw, 0); quad.set(triple, L)
  filters(quad, sr, o)
  return quad.slice(2 * L, 3 * L)
}

/**
 * True-peak limiter: look-ahead, gain computed from the 4× oversampled signal,
 * smoothed so it never distorts. With `circular`, the gain curve wraps (loops).
 * Returns the limited copy.
 */
export const limit = (x, sr, ceiling, { circular = false, releaseMs = 40 } = {}) => {
  const len = x.length
  const src = circular ? Float32Array.from({ length: len * 3 }, (_, i) => x[i % len]) : x
  const up = upsample4(src)
  const need = new Float32Array(src.length)
  let over = false
  for (let n = 0; n < src.length; n++) {
    let m = Math.abs(src[n])
    for (let p = 0; p < 4; p++) m = Math.max(m, Math.abs(up[n * 4 + p]))
    need[n] = m > ceiling ? ceiling / m : 1
    if (m > ceiling) over = true
  }
  if (!over) return Float32Array.from(x)
  const L = Math.max(1, Math.round(0.002 * sr))
  const N = src.length
  // Sliding minimum over [n−L, n+L].
  const h = new Float32Array(N)
  for (let n = 0; n < N; n++) {
    let m = 1
    for (let k = Math.max(0, n - L); k <= Math.min(N - 1, n + L); k++) if (need[k] < m) m = need[k]
    h[n] = m
  }
  // Box average over the same span (never above the minimum it came from),
  // then a release so recovery is smooth.
  const rel = Math.exp(-1 / (releaseMs / 1000 * sr))
  const g = new Float32Array(N)
  let sum = 0, lo = 0, hi = -1, prev = 1
  for (let n = 0; n < N; n++) {
    const want = Math.min(N - 1, n + L)
    while (hi < want) sum += h[++hi]
    while (lo < n - L) sum -= h[lo++]
    const s = sum / (hi - lo + 1)
    // Every h[k] in the window is a minimum over a span that contains n, so the
    // average is never above what sample n needs; the release only ever moves
    // the gain UP towards it.
    const v = s < prev ? s : s - (s - prev) * rel
    g[n] = v
    prev = v
  }
  const out = new Float32Array(len)
  const off = circular ? len : 0
  for (let n = 0; n < len; n++) out[n] = src[n + off] * g[n + off]
  return out
}

/** Limit, then re-check the true peak and nudge until it holds (≤ 3 passes). */
export const limitHard = (x, sr, ceiling, opts) => {
  let y = limit(x, sr, ceiling, opts)
  for (let i = 0; i < 3 && truePeak(y) > ceiling * 1.0005; i++) y = limit(y, sr, ceiling * (1 - 0.01 * (i + 1)), opts)
  return y
}
