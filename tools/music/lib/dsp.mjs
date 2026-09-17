// ─── DSP primitives for the offline music renderer ──────────────────────────
//
// Pure JS, no dependencies, no Web Audio: everything here runs in Node and is
// deterministic to the sample. That matters more than it sounds — the track is
// rendered from a seed, and a re-render that differed by one noise sample would
// make every "is the loop seam clean?" check a check of THAT render only.
//
// Conventions: mono voices are Float32Array at `SR`; time in seconds; pitch in
// MIDI note numbers (fractional allowed, so a glide is just a moving number).

export const SR = 44100
export const TAU = Math.PI * 2

export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12)
export const dbToGain = (db) => Math.pow(10, db / 20)
export const gainToDb = (g) => 20 * Math.log10(Math.max(1e-12, g))
export const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x)

// ─── Seeded randomness ──────────────────────────────────────────────────────
//
// mulberry32: tiny, fast, good enough for noise and humanisation. Every voice
// gets its OWN generator seeded from a hash of what it is and where it sits in
// the score, never a shared running stream — so the three copies of an event
// the loop renderer mixes (previous cycle, this cycle, next cycle) are
// bit-identical, and editing bar 30 cannot change the noise in bar 3.

export const rng = (seed) => {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** FNV-1a over the joined parts — a stable 32-bit seed from a label. */
export const hashSeed = (...parts) => {
  const s = parts.join('|')
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

// ─── Oscillators ────────────────────────────────────────────────────────────
//
// PolyBLEP saw and pulse. A naive saw at a kazoo's 700 Hz aliases a forest of
// inharmonic junk straight into the 2-5 kHz band the squish lives in, and the
// game then pitches the whole track up 16 %, which moves the junk but does not
// remove it. Band-limiting at the source is the only place it can be fixed.

const polyBlep = (t, dt) => {
  if (t < dt) {
    t /= dt
    return t + t - t * t - 1
  }
  if (t > 1 - dt) {
    t = (t - 1) / dt
    return t * t + t + t + 1
  }
  return 0
}

export class Osc {
  constructor(phase = 0) {
    this.phase = phase
  }

  _advance(dt) {
    this.phase += dt
    if (this.phase >= 1) this.phase -= Math.floor(this.phase)
  }

  saw(freq) {
    const dt = freq / SR
    const t = this.phase
    const v = 2 * t - 1 - polyBlep(t, dt)
    this._advance(dt)
    return v
  }

  pulse(freq, duty = 0.5) {
    const dt = freq / SR
    const t = this.phase
    let v = t < duty ? 1 : -1
    v += polyBlep(t, dt)
    let t2 = t - duty
    if (t2 < 0) t2 += 1
    v -= polyBlep(t2, dt)
    this._advance(dt)
    return v
  }

  sine(freq) {
    const v = Math.sin(TAU * this.phase)
    this._advance(freq / SR)
    return v
  }
}

// ─── Filters ────────────────────────────────────────────────────────────────

/**
 * Topology-preserving-transform state-variable filter (Zavalishin / Cytomic).
 * Chosen over a biquad for every MOVING filter in the renderer: its cutoff can
 * be swept per sample (bass plucks, brass swells) without the zipper noise or
 * blow-ups a biquad gets from recomputed coefficients. After `process`, read
 * `lp`, `hp`, and `bpn` — the band-pass normalised to unity gain at centre.
 */
export class SVF {
  constructor() {
    this.ic1 = 0
    this.ic2 = 0
    this.lp = 0
    this.bp = 0
    this.bpn = 0
    this.hp = 0
  }

  process(x, cutoff, q = 0.7071) {
    const fc = clamp(cutoff, 10, SR * 0.49)
    const g = Math.tan((Math.PI * fc) / SR)
    const k = 1 / q
    const a1 = 1 / (1 + g * (g + k))
    const a2 = g * a1
    const a3 = g * a2
    const v3 = x - this.ic2
    const v1 = a1 * this.ic1 + a2 * v3
    const v2 = this.ic2 + a2 * this.ic1 + a3 * v3
    this.ic1 = 2 * v1 - this.ic1
    this.ic2 = 2 * v2 - this.ic2
    this.lp = v2
    this.bp = v1
    this.bpn = k * v1
    this.hp = x - k * v1 - v2
    return v2
  }
}

/** RBJ-cookbook biquad for the static EQs on the buses. Direct form I. */
export class Biquad {
  constructor(type, freq, q = 0.7071, gainDb = 0) {
    const w0 = (TAU * freq) / SR
    const cw = Math.cos(w0)
    const sw = Math.sin(w0)
    const alpha = sw / (2 * q)
    const A = Math.pow(10, gainDb / 40)
    let b0, b1, b2, a0, a1, a2
    switch (type) {
      case 'lowpass':
        b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = (1 - cw) / 2
        a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha
        break
      case 'highpass':
        b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = (1 + cw) / 2
        a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha
        break
      case 'peak':
        b0 = 1 + alpha * A; b1 = -2 * cw; b2 = 1 - alpha * A
        a0 = 1 + alpha / A; a1 = -2 * cw; a2 = 1 - alpha / A
        break
      case 'highshelf': {
        const sq = 2 * Math.sqrt(A) * alpha
        b0 = A * ((A + 1) + (A - 1) * cw + sq)
        b1 = -2 * A * ((A - 1) + (A + 1) * cw)
        b2 = A * ((A + 1) + (A - 1) * cw - sq)
        a0 = (A + 1) - (A - 1) * cw + sq
        a1 = 2 * ((A - 1) - (A + 1) * cw)
        a2 = (A + 1) - (A - 1) * cw - sq
        break
      }
      default:
        throw new Error(`unknown biquad type ${type}`)
    }
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0
    this.a1 = a1 / a0; this.a2 = a2 / a0
    this.x1 = 0; this.x2 = 0; this.y1 = 0; this.y2 = 0
  }

  process(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2
    this.x2 = this.x1; this.x1 = x
    this.y2 = this.y1; this.y1 = y
    return y
  }

  /** Run in place over a whole channel. */
  run(buf) {
    for (let i = 0; i < buf.length; i++) buf[i] = this.process(buf[i])
    return buf
  }
}

// ─── Voice helpers ──────────────────────────────────────────────────────────

/** Fade the last `ms` of a voice to zero. Every voice ends through this, so no
 *  buffer can stop on a non-zero sample and click when it is summed. */
export const fadeTail = (buf, ms = 12) => {
  const n = Math.min(buf.length, Math.round((ms / 1000) * SR))
  for (let i = 0; i < n; i++) {
    const g = 0.5 - 0.5 * Math.cos((Math.PI * i) / n)
    buf[buf.length - 1 - i] *= g
  }
  return buf
}

/** Gate + exponential release: 1 while held, then e^(-(t-gate)/tau). */
export const gateEnv = (t, gate, tau) => (t < gate ? 1 : Math.exp(-(t - gate) / tau))

/** Raised-cosine attack, so no voice starts on a step either. */
export const attackEnv = (t, a) => (t >= a ? 1 : 0.5 - 0.5 * Math.cos((Math.PI * t) / a))

// ─── Karplus-Strong plucked string ──────────────────────────────────────────
//
// The pizzicato counter-line and the tiptoe upright bass. Tuned properly —
// loop delay = integer delay + ½ sample (the averaging filter) + a first-order
// allpass for the fraction — because the naive integer-delay version is up to
// 30 cents flat on a high note, and a pizz line that is flat against the
// marimba reads as "wrong" to a child before it reads as anything else.

export const karplus = (freq, seconds, { t60 = 1, exciteHz = 3000, pick = 0.18, rand }) => {
  const n = Math.ceil(seconds * SR)
  const out = new Float32Array(n)
  const P = SR / freq
  const D = P - 0.5
  let N = Math.floor(D - 0.1)
  if (N < 2) N = 2
  const d = D - N
  const c = (1 - d) / (1 + d)
  // Per-period loop gain that reaches -60 dB after t60 seconds.
  const g = Math.pow(10, -3 / (t60 * freq))
  const buf = new Float32Array(N)

  // Excitation: one period of low-passed noise, pick-position combed (a pluck
  // near the bridge is brighter), mean removed so the string holds no DC.
  const lp = new SVF()
  const raw = new Float32Array(N)
  for (let i = 0; i < N; i++) raw[i] = lp.process(rand() * 2 - 1, exciteHz, 0.6)
  const pickAt = Math.max(1, Math.round(pick * N))
  let mean = 0
  for (let i = 0; i < N; i++) {
    buf[i] = raw[i] - (i >= pickAt ? raw[i - pickAt] : 0)
    mean += buf[i]
  }
  mean /= N
  let peak = 1e-9
  for (let i = 0; i < N; i++) {
    buf[i] -= mean
    peak = Math.max(peak, Math.abs(buf[i]))
  }
  for (let i = 0; i < N; i++) buf[i] /= peak

  let idx = 0
  let prev = 0
  let apX1 = 0
  let apY1 = 0
  for (let i = 0; i < n; i++) {
    const s = buf[idx]
    const avg = 0.5 * (s + prev)
    prev = s
    const ap = c * avg + apX1 - c * apY1
    apX1 = avg
    apY1 = ap
    buf[idx] = ap * g
    out[i] = s
    idx++
    if (idx >= N) idx = 0
  }
  return out
}

// ─── Freeverb ───────────────────────────────────────────────────────────────
//
// Jezar's public-domain Freeverb, stereo: eight damped combs and four allpasses
// per side, the right side offset by 23 samples. Its tunings are specified for
// 44.1 kHz, which is exactly the rate this renders at, so they are used as-is.

const COMB_TUNING = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617]
const ALLPASS_TUNING = [556, 441, 341, 225]
const STEREO_SPREAD = 23

class Comb {
  constructor(n) {
    this.buf = new Float32Array(n)
    this.idx = 0
    this.store = 0
  }

  process(x, feedback, damp) {
    const out = this.buf[this.idx]
    this.store = out * (1 - damp) + this.store * damp
    this.buf[this.idx] = x + this.store * feedback
    if (++this.idx >= this.buf.length) this.idx = 0
    return out
  }
}

class Allpass {
  constructor(n) {
    this.buf = new Float32Array(n)
    this.idx = 0
  }

  process(x) {
    const b = this.buf[this.idx]
    this.buf[this.idx] = x + b * 0.5
    if (++this.idx >= this.buf.length) this.idx = 0
    return b - x
  }
}

/**
 * Reverberate a mono send into a new stereo pair.
 * `room` 0..1 (tail length), `damp` 0..1 (darkness of the tail).
 */
export const freeverb = (input, { room = 0.6, damp = 0.5, predelayMs = 12 }) => {
  const n = input.length
  const L = new Float32Array(n)
  const R = new Float32Array(n)
  const feedback = room * 0.28 + 0.7
  const combsL = COMB_TUNING.map((t) => new Comb(t))
  const combsR = COMB_TUNING.map((t) => new Comb(t + STEREO_SPREAD))
  const apsL = ALLPASS_TUNING.map((t) => new Allpass(t))
  const apsR = ALLPASS_TUNING.map((t) => new Allpass(t + STEREO_SPREAD))
  const pre = Math.round((predelayMs / 1000) * SR)
  for (let i = 0; i < n; i++) {
    const x = (i >= pre ? input[i - pre] : 0) * 0.015
    let l = 0
    let r = 0
    for (let c = 0; c < 8; c++) {
      l += combsL[c].process(x, feedback, damp)
      r += combsR[c].process(x, feedback, damp)
    }
    for (let a = 0; a < 4; a++) {
      l = apsL[a].process(l)
      r = apsR[a].process(r)
    }
    L[i] = l
    R[i] = r
  }
  return [L, R]
}

// ─── Ping-pong delay ────────────────────────────────────────────────────────

/** Mono send in, stereo echoes out: first repeat left, then bouncing right.
 *  The feedback path is band-limited so each repeat is duller than the last —
 *  a bright repeat would stack up exactly where the SFX need the room. */
export const pingPong = (input, { delaySec, feedback = 0.35, hp = 350, lp = 3200 }) => {
  const n = input.length
  const L = new Float32Array(n)
  const R = new Float32Array(n)
  const D = Math.round(delaySec * SR)
  const bufL = new Float32Array(D)
  const bufR = new Float32Array(D)
  const hpL = new Biquad('highpass', hp, 0.7071)
  const lpL = new Biquad('lowpass', lp, 0.7071)
  const hpR = new Biquad('highpass', hp, 0.7071)
  const lpR = new Biquad('lowpass', lp, 0.7071)
  let idx = 0
  for (let i = 0; i < n; i++) {
    const outL = bufL[idx]
    const outR = bufR[idx]
    // Input enters the LEFT line; left's output feeds the right line, and the
    // right's output feeds back into the left — the bounce.
    bufL[idx] = lpL.process(hpL.process(input[i] + outR * feedback))
    bufR[idx] = lpR.process(hpR.process(outL))
    L[i] = outL
    R[i] = outR
    if (++idx >= D) idx = 0
  }
  return [L, R]
}

// ─── Dynamics ───────────────────────────────────────────────────────────────

/**
 * Stereo-linked feed-forward bus compressor, soft knee, RMS detector.
 * Gentle by design (2:1 around the loud sections): it exists to glue the drums
 * to the band, not to win a loudness war the game's volume slider would undo.
 */
export const compress = (L, R, { thresholdDb = -20, ratio = 2, kneeDb = 8, attackMs = 12, releaseMs = 160, rmsMs = 8 }) => {
  const n = L.length
  const aAtt = Math.exp(-1 / ((attackMs / 1000) * SR))
  const aRel = Math.exp(-1 / ((releaseMs / 1000) * SR))
  const aRms = Math.exp(-1 / ((rmsMs / 1000) * SR))
  let ms = 0
  let grDb = 0
  let maxGr = 0
  let sumGr = 0
  for (let i = 0; i < n; i++) {
    const p = 0.5 * (L[i] * L[i] + R[i] * R[i])
    ms = aRms * ms + (1 - aRms) * p
    const lvl = 10 * Math.log10(ms + 1e-20)
    const over = lvl - thresholdDb
    let target = 0
    if (over > kneeDb / 2) target = over * (1 - 1 / ratio)
    else if (over > -kneeDb / 2) target = ((1 - 1 / ratio) * (over + kneeDb / 2) ** 2) / (2 * kneeDb)
    grDb = target > grDb ? aAtt * grDb + (1 - aAtt) * target : aRel * grDb + (1 - aRel) * target
    const g = Math.pow(10, -grDb / 20)
    L[i] *= g
    R[i] *= g
    if (grDb > maxGr) maxGr = grDb
    sumGr += grDb
  }
  return { maxGrDb: maxGr, meanGrDb: sumGr / n }
}

// ─── True peak ──────────────────────────────────────────────────────────────
//
// 4x oversampling with a windowed-sinc interpolator, the same idea BS.1770's
// true-peak meter uses. Inter-sample peaks are what clip on a phone's DAC after
// the browser resamples 44.1 k to 48 k, and they are invisible to a sample-peak
// meter.

const OS = 4
const TAPS = 12 // per side, in input samples
const SINC = (() => {
  const table = []
  for (let p = 1; p < OS; p++) {
    const frac = p / OS
    const row = new Float32Array(2 * TAPS)
    for (let k = -TAPS + 1; k <= TAPS; k++) {
      const x = k - frac
      const sinc = Math.abs(x) < 1e-9 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x)
      const w = 0.5 + 0.5 * Math.cos((Math.PI * x) / (TAPS + 1))
      row[k + TAPS - 1] = sinc * w
    }
    table.push(row)
  }
  return table
})()

/** Oversampled |peak| around index i of `buf` (the sample plus 3 intersamples). */
const truePeakAt = (buf, i) => {
  let m = Math.abs(buf[i])
  for (let p = 0; p < OS - 1; p++) {
    const row = SINC[p]
    let acc = 0
    for (let k = -TAPS + 1; k <= TAPS; k++) {
      const j = i + k
      if (j >= 0 && j < buf.length) acc += buf[j] * row[k + TAPS - 1]
    }
    m = Math.max(m, Math.abs(acc))
  }
  return m
}

export const truePeakDb = (L, R) => {
  let m = 0
  for (let i = 0; i < L.length; i++) {
    // Only bother interpolating around samples that are already near the top.
    const s = Math.max(Math.abs(L[i]), Math.abs(R[i]))
    if (s * 1.5 < m) continue
    m = Math.max(m, truePeakAt(L, i), truePeakAt(R, i))
  }
  return gainToDb(m)
}

/**
 * Look-ahead true-peak limiter. The detector is the oversampled peak. The gain
 * curve is a sliding MINIMUM of the required reduction over the next `la`
 * samples, then a moving AVERAGE over the previous `la`: at any peak p every
 * sample in the averaging window is a minimum over a range that contains p, so
 * the average is guaranteed to be at or below what p needs — the attack is a
 * smooth ramp that still never lets a peak through. Release is exponential and
 * only ever slows the gain coming back UP, so it cannot break that guarantee.
 */
export const limit = (L, R, { ceilingDb = -1, lookaheadMs = 5, releaseMs = 80 }) => {
  const n = L.length
  const ceiling = dbToGain(ceilingDb)
  const la = Math.max(1, Math.round((lookaheadMs / 1000) * SR))
  const need = new Float32Array(n)
  let touched = 0
  for (let i = 0; i < n; i++) {
    const s = Math.max(Math.abs(L[i]), Math.abs(R[i]))
    let pk = s
    if (s > ceiling * 0.7) pk = Math.max(truePeakAt(L, i), truePeakAt(R, i))
    need[i] = pk > ceiling ? ceiling / pk : 1
    if (need[i] < 1) touched++
  }
  if (touched === 0) return { samplesOver: 0, maxGrDb: 0 }

  const gmin = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    let m = 1
    const end = Math.min(n - 1, i + la)
    for (let j = i; j <= end; j++) if (need[j] < m) m = need[j]
    gmin[i] = m
  }
  const aRel = Math.exp(-1 / ((releaseMs / 1000) * SR))
  let acc = 0
  let g = 1
  let minG = 1
  for (let i = 0; i < n; i++) {
    acc += gmin[i] - (i >= la ? gmin[i - la] : 1)
    const avg = (acc + la) / la // the window starts "full of 1s"
    g = avg < g ? avg : aRel * g + (1 - aRel) * avg
    L[i] *= g
    R[i] *= g
    if (g < minG) minG = g
  }
  return { samplesOver: touched, maxGrDb: -gainToDb(minG) }
}

// ─── Loudness (ITU-R BS.1770-4 / EBU R128 integrated) ───────────────────────
//
// K-weighting coefficients derived at 44.1 kHz with the same analogue prototype
// pyloudnorm uses. Used for gain staging inside the render and for per-stem
// balance reports; the final number is re-measured by ffmpeg's ebur128, which
// is the one quoted anywhere outside this file.

const kWeight = (buf) => {
  const shelf = new Biquad('highshelf', 1681.974450955533, 0.7071752369554196, 3.999843853973347)
  const hp = new Biquad('highpass', 38.13547087602444, 0.5003270373238773)
  const out = new Float32Array(buf.length)
  for (let i = 0; i < buf.length; i++) out[i] = hp.process(shelf.process(buf[i]))
  return out
}

export const integratedLufs = (L, R) => {
  const kL = kWeight(L)
  const kR = kWeight(R)
  const block = Math.round(0.4 * SR)
  const hop = Math.round(0.1 * SR)
  const powers = []
  for (let s = 0; s + block <= kL.length; s += hop) {
    let acc = 0
    for (let i = s; i < s + block; i++) acc += kL[i] * kL[i] + kR[i] * kR[i]
    powers.push(acc / block)
  }
  const lk = (p) => -0.691 + 10 * Math.log10(p + 1e-20)
  const abs = powers.filter((p) => lk(p) > -70)
  if (!abs.length) return -Infinity
  const absMean = abs.reduce((a, b) => a + b, 0) / abs.length
  const rel = abs.filter((p) => lk(p) > lk(absMean) - 10)
  return lk(rel.reduce((a, b) => a + b, 0) / rel.length)
}

// ─── WAV ────────────────────────────────────────────────────────────────────

/** 32-bit float stereo WAV. Float, so the encoder sees the master unquantised
 *  and no dither decision has to be made twice. */
export const wavFloat32 = (L, R) => {
  const n = L.length
  const dataBytes = n * 2 * 4
  const buf = Buffer.alloc(44 + dataBytes)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + dataBytes, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(3, 20) // IEEE float
  buf.writeUInt16LE(2, 22)
  buf.writeUInt32LE(SR, 24)
  buf.writeUInt32LE(SR * 2 * 4, 28)
  buf.writeUInt16LE(8, 32)
  buf.writeUInt16LE(32, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(dataBytes, 40)
  let o = 44
  for (let i = 0; i < n; i++) {
    buf.writeFloatLE(L[i], o)
    buf.writeFloatLE(R[i], o + 4)
    o += 8
  }
  return buf
}
