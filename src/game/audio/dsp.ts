/**
 * ─── Offline DSP for the crush bank ─────────────────────────────────────────
 *
 * The handful of voices every crush in the game is built from, written as plain
 * loops over a `Float32Array` rather than as Web Audio nodes. That one decision
 * is what makes the whole bank possible:
 *
 *   • it runs under Node, so `pnpm audio:render` can write every crush to a WAV
 *     and a spectrogram without a browser, and vitest can measure them;
 *   • it is DETERMINISTIC — every random draw comes from the seeded `rnd` on the
 *     bus, so a variant is the same sound on every machine and every run;
 *   • it costs the frame nothing: the game renders these on an idle slot and a
 *     kill is then one buffer source instead of a dozen oscillator graphs;
 *   • it is RESUMABLE — a bus with a `jobs` list records each voice's sample
 *     loop instead of running it, so the game can spread one crush over as
 *     many 3 ms slices as it takes (see `startCrush`). Every voice takes exactly
 *     one draw from the bus's generator when it is CALLED and seeds its own
 *     from it, so running the loops now or later gives identical samples.
 *
 * Nothing here knows what a bug is. `crushSynth.ts` composes these into bodies.
 *
 * ── Conventions ──
 *
 *   `at`     seconds from the start of the sound (a fixed pre-roll is added so
 *            no voice can start on sample 0 — a click there is a click in the
 *            game).
 *   `amp`    roughly the peak of the voice before the final loudness pass. A
 *            noise voice is normalised by its own bandwidth so `amp: 0.5` on a
 *            narrow band and on a wide one are about equally loud — otherwise
 *            every layer's gain would be a guess that changes with its filter.
 *   `decay`  an exponential time constant, seconds (to −8.7 dB), not a length.
 */

export type Rng = () => number

/** mulberry32 — tiny, fast, and good enough that grain clouds do not pattern. */
export const rngFrom = (seed: number): Rng => {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** FNV-1a — turns a voice's name into its seed. */
export const hashString = (s: string): number => {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export interface Bus {
  out: Float32Array
  sr: number
  rnd: Rng
  /** When present, voices queue their sample loops here instead of running
   *  them — the recording mode `startCrush` uses to render in slices. */
  jobs?: Array<() => void>
}

/** Run a voice's sample loop now, or queue it when the bus is recording. */
const schedule = (b: Bus, work: () => void): void => {
  if (b.jobs) b.jobs.push(work)
  else work()
}

/** A voice's own random stream, seeded by ONE draw from the bus's — which is
 *  what keeps the bus's sequence the same whether loops run now or later. */
const voiceRng = (b: Bus): Rng => rngFrom(Math.floor(b.rnd() * 4294967296))

/** Every voice starts at least this late, so sample 0 is always silence. */
export const PRE_ROLL = 0.002

const TAU = Math.PI * 2

export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v))
export const range = (b: Bus, lo: number, hi: number): number => lo + (hi - lo) * b.rnd()
/** Log-uniform — pitches are heard in ratios, so a flat draw clumps at the top. */
export const logRange = (b: Bus, lo: number, hi: number): number => lo * Math.pow(hi / lo, b.rnd())
/** `x` nudged by up to ±`pct`. */
export const jit = (b: Bus, x: number, pct: number): number => x * (1 + pct * (b.rnd() * 2 - 1))

const startOf = (b: Bus, at: number): number => Math.max(0, Math.round((at + PRE_ROLL) * b.sr))

// ─── Tone ───────────────────────────────────────────────────────────────────

export interface ToneSpec {
  at: number
  amp: number
  /** Start frequency, Hz. */
  f: number
  /** Exponential glide target, Hz, reached after `glide` seconds. */
  to?: number
  glide?: number
  /**
   * BUBBLE CHIRP: the pitch climbs by `rise` (0.5 = +50 %) with time constant
   * `riseT`, then plateaus. A resonating bubble's pitch rises as it forms and
   * nears the surface (Minnaert, and van den Doel's liquid model) — that upward
   * flick is the single cue the ear files under "liquid", and a falling blip
   * next to it reads as a laser.
   */
  rise?: number
  riseT?: number
  /** Decaying vibrato — a spring's wobble. Depth is a ratio, decay in seconds. */
  vibRate?: number
  vibDepth?: number
  vibDecay?: number
  /** Seconds to the peak (raised cosine). */
  attack?: number
  /** Seconds held at the peak before the decay starts. */
  hold?: number
  decay: number
  /** Extra partials riding the same pitch and envelope: [ratio, gain]. */
  harm?: ReadonlyArray<readonly [number, number]>
}

/** One enveloped oscillator with a pitch trajectory. Partials above ~0.45·sr
 *  are dropped rather than aliased back down into the mix. */
export const tone = (b: Bus, o: ToneSpec): void => {
  const { out, sr } = b
  const n0 = startOf(b, o.at)
  const attack = Math.max(0.0002, o.attack ?? 0.001)
  const hold = o.hold ?? 0
  // Seven time constants is −61 dB — well under the −42 dB the master pass
  // trims at, and every sample past it is idle time spent on silence.
  const life = attack + hold + o.decay * 7
  const n1 = Math.min(out.length, n0 + Math.ceil(life * sr))
  if (n1 <= n0) return
  const ratio = o.to !== undefined ? o.to / o.f : 1
  const glide = Math.max(1e-4, o.glide ?? o.decay * 3)
  const riseT = o.riseT ?? o.decay
  const nyq = sr * 0.45
  const harm = o.harm ?? []
  const decayMul = Math.exp(-1 / (o.decay * sr))
  schedule(b, () => {
    let env = 1
    let phase = 0
    let f = o.f
    for (let n = n0, i = 0; n < n1; n++, i++) {
      const t = i / sr
      // The pitch trajectory is smooth, so it is evaluated every 16 samples
      // (well under a millisecond) rather than every one — the pow/exp/sin
      // here were most of a render's cost. The phase still advances per sample.
      if ((i & 15) === 0) {
        f = o.f
        if (ratio !== 1) f *= Math.pow(ratio, Math.min(1, t / glide))
        if (o.rise) f *= 1 + o.rise * (1 - Math.exp(-t / riseT))
        if (o.vibDepth) {
          f *= 1 + o.vibDepth * Math.exp(-t / (o.vibDecay ?? 1)) * Math.sin(TAU * (o.vibRate ?? 6) * t)
        }
      }
      phase += TAU * f / sr
      let a: number
      if (t < attack) a = 0.5 - 0.5 * Math.cos(Math.PI * t / attack)
      else if (t < attack + hold) a = 1
      else { a = env; env *= decayMul }
      let v = f < nyq ? Math.sin(phase) : 0
      for (let h = 0; h < harm.length; h++) {
        const p = harm[h]!
        if (f * p[0] < nyq) v += p[1] * Math.sin(phase * p[0])
      }
      out[n]! += o.amp * a * v
    }
  })
}

// ─── Filtered noise ─────────────────────────────────────────────────────────

export type FilterMode = 'lp' | 'bp' | 'hp'

/**
 * Gain that brings white noise through a filter back to roughly unit level.
 * A 2-pole band's equivalent noise bandwidth is ~π/2 of its −3 dB width.
 */
const noiseNorm = (mode: FilterMode, fc: number, q: number, sr: number): number => {
  const nyq = sr / 2
  const bw = mode === 'bp' ? (Math.PI / 2) * (fc / q) : mode === 'lp' ? (Math.PI / 2) * fc : nyq - fc
  return Math.min(16, 1 / Math.sqrt(clamp(bw / nyq, 0.004, 1)))
}

export interface NoiseSpec {
  at: number
  amp: number
  attack?: number
  hold?: number
  decay: number
  mode: FilterMode
  /** Cutoff / centre, Hz, gliding exponentially to `to` over `glide` seconds. */
  f: number
  to?: number
  glide?: number
  q?: number
  /**
   * Amplitude flutter: a raised-cosine gate at `amRate` Hz (gliding to `amTo`),
   * `amDepth` 0..1, each cycle's rate re-rolled by ±`amJitter`. `amSharp` > 1
   * narrows the open part of each cycle — a wing beat, a slosh, a splutter.
   */
  amRate?: number
  amTo?: number
  amDepth?: number
  amJitter?: number
  amSharp?: number
}

/**
 * Noise through a sweeping state-variable filter (Simper's TPT form, which stays
 * stable while its cutoff moves every few samples — a biquad re-designed at
 * audio rate does not).
 */
export const noise = (b: Bus, o: NoiseSpec): void => {
  const { out, sr } = b
  const rnd = voiceRng(b)
  const n0 = startOf(b, o.at)
  const attack = Math.max(0.0001, o.attack ?? 0.001)
  const hold = o.hold ?? 0
  const life = attack + hold + o.decay * 7
  const n1 = Math.min(out.length, n0 + Math.ceil(life * sr))
  if (n1 <= n0) return
  const q = o.q ?? 0.707
  const k = 1 / q
  const ratio = o.to !== undefined ? o.to / o.f : 1
  const glide = Math.max(1e-4, o.glide ?? life)
  const decayMul = Math.exp(-1 / (o.decay * sr))
  const amDepth = o.amDepth ?? 0
  const amRate0 = o.amRate ?? 0
  const amRatio = o.amTo !== undefined && amRate0 > 0 ? o.amTo / amRate0 : 1
  const amJitter = o.amJitter ?? 0
  const amSharp = o.amSharp ?? 1
  schedule(b, () => {
    let ic1 = 0
    let ic2 = 0
    let a1 = 0
    let a2 = 0
    let a3 = 0
    let norm = 1
    let env = 1
    let amPhase = 0
    let cycleRate = amRate0
    for (let n = n0, i = 0; n < n1; n++, i++) {
      const t = i / sr
      if ((i & 7) === 0) {
        let fc = o.f
        if (ratio !== 1) fc *= Math.pow(ratio, Math.min(1, t / glide))
        fc = clamp(fc, 20, sr * 0.45)
        const g = Math.tan(Math.PI * fc / sr)
        a1 = 1 / (1 + g * (g + k))
        a2 = g * a1
        a3 = g * a2
        norm = noiseNorm(o.mode, fc, q, sr)
      }
      const v0 = rnd() * 2 - 1
      const v3 = v0 - ic2
      const v1 = a1 * ic1 + a2 * v3
      const v2 = ic2 + a2 * ic1 + a3 * v3
      ic1 = 2 * v1 - ic1
      ic2 = 2 * v2 - ic2
      const y = o.mode === 'lp' ? v2 : o.mode === 'bp' ? k * v1 : v0 - k * v1 - v2

      let a: number
      if (t < attack) a = 0.5 - 0.5 * Math.cos(Math.PI * t / attack)
      else if (t < attack + hold) a = 1
      else { a = env; env *= decayMul }

      let m = 1
      if (amDepth > 0 && amRate0 > 0) {
        amPhase += cycleRate / sr
        if (amPhase >= 1) {
          amPhase -= 1
          const base = amRate0 * Math.pow(amRatio, Math.min(1, t / life))
          cycleRate = base * (1 + amJitter * (rnd() * 2 - 1))
        }
        const s = 0.5 - 0.5 * Math.cos(TAU * amPhase)
        m = 1 - amDepth + amDepth * (amSharp === 1 ? s : Math.pow(s, amSharp))
      }
      out[n]! += o.amp * norm * a * m * y
    }
  })
}

// ─── Grains ─────────────────────────────────────────────────────────────────

/** One decaying sine grain — a chip of shell, a candy, a tin crease. */
export const grainSine = (b: Bus, at: number, f: number, tau: number, amp: number): void => {
  const { out, sr } = b
  const n0 = startOf(b, at)
  const n1 = Math.min(out.length, n0 + Math.ceil(tau * 7 * sr))
  const w = TAU * f / sr
  const mul = Math.exp(-1 / (tau * sr))
  // A 0.3 ms ramp: the grain should be crisp, not a full-band click.
  const ramp = Math.max(1, Math.round(0.0003 * sr))
  schedule(b, () => {
    let env = 1
    for (let n = n0, i = 0; n < n1; n++, i++) {
      const r = i < ramp ? i / ramp : 1
      out[n]! += amp * env * r * Math.sin(w * i)
      env *= mul
    }
  })
}

/** One decaying burst of band-passed noise — the grit in a crackle. */
export const grainNoise = (b: Bus, at: number, f: number, q: number, tau: number, amp: number): void => {
  const { out, sr } = b
  const rnd = voiceRng(b)
  const n0 = startOf(b, at)
  const fc = clamp(f, 40, sr * 0.45)
  const n1 = Math.min(out.length, n0 + Math.ceil((tau * 7 + q / (Math.PI * fc)) * sr))
  const k = 1 / q
  const g = Math.tan(Math.PI * fc / sr)
  const a1 = 1 / (1 + g * (g + k))
  const a2 = g * a1
  const a3 = g * a2
  const norm = noiseNorm('bp', fc, q, sr)
  const mul = Math.exp(-1 / (tau * sr))
  schedule(b, () => {
    let env = 1
    let ic1 = 0
    let ic2 = 0
    for (let n = n0; n < n1; n++) {
      const v0 = (rnd() * 2 - 1) * env
      env *= mul
      const v3 = v0 - ic2
      const v1 = a1 * ic1 + a2 * v3
      const v2 = ic2 + a2 * ic1 + a3 * v3
      ic1 = 2 * v1 - ic1
      ic2 = 2 * v2 - ic2
      out[n]! += amp * norm * k * v1
    }
  })
}

export interface GrainSpec {
  at: number
  dur: number
  amp: number
  /** Grains per second at the start and at the end (exponential in between). */
  rate: number
  rateEnd: number
  /** Band the grain pitches are drawn from (log-uniform), Hz. */
  lo: number
  hi: number
  /** Per-grain decay constant range, seconds. */
  tauLo: number
  tauHi: number
  /** 0..1 share of grains that are pitched sines rather than noise. */
  pitched: number
  q?: number
  /** Amplitude swells in and out instead of decaying from the first grain. */
  swell?: boolean
  /** Pareto exponent of the grain sizes: lower = a few loud snaps among dust. */
  alpha?: number
}

/**
 * A crackle: a Poisson cloud of grains whose DENSITY decays and whose sizes are
 * heavy-tailed. Real fracture noise is exactly that shape — a few big snaps and
 * a lot of small ones, thinning out as the pieces settle — and a crackle with
 * evenly sized, evenly spaced grains is heard as a rhythm or a buzz instead.
 */
export const grains = (b: Bus, o: GrainSpec): void => {
  const ratio = o.rateEnd / o.rate
  const alpha = o.alpha ?? 1.6
  const q = o.q ?? 1.6
  let t = 0
  for (let guard = 0; guard < 4000; guard++) {
    const rate = o.rate * Math.pow(ratio, Math.min(1, t / o.dur))
    t += -Math.log(1 - b.rnd() * 0.9999) / rate
    if (t >= o.dur) break
    const u = t / o.dur
    const env = o.swell ? Math.pow(Math.sin(Math.PI * u), 0.8) : Math.exp(-2.6 * u)
    const size = Math.min(1, 0.18 * Math.pow(1 - b.rnd() * 0.999, -1 / alpha))
    const sign = b.rnd() < 0.5 ? -1 : 1
    const f = logRange(b, o.lo, o.hi)
    const tau = range(b, o.tauLo, o.tauHi)
    const a = o.amp * env * size * sign
    if (b.rnd() < o.pitched) grainSine(b, o.at + t, f, tau, a)
    else grainNoise(b, o.at + t, f, q, tau, a * 1.4)
  }
}

// ─── Resonant bodies ────────────────────────────────────────────────────────

export interface ModalSpec {
  at: number
  amp: number
  /** Fundamental, Hz. */
  f: number
  decay: number
  /** [ratio, gain, decay multiplier] per mode. */
  modes: ReadonlyArray<readonly [number, number, number]>
  /** Pitch sag over the ring, as a ratio (−0.05 = 5 % flat by the end). A
   *  struck bell holds its pitch; a shell giving way or a plate bending does
   *  not, and that sag is most of what says "broken" rather than "rung". */
  bend?: number
  attack?: number
}

/** A struck body: a bank of damped modes. Inharmonic ratios are what make it a
 *  shell, a plate or a candy rather than a note. */
export const modal = (b: Bus, o: ModalSpec): void => {
  for (const [r, g, tm] of o.modes) {
    const f = o.f * r
    tone(b, {
      at: o.at, amp: o.amp * g, f,
      to: o.bend ? f * (1 + o.bend) : undefined, glide: o.decay * tm * 3,
      attack: o.attack ?? 0.0004, decay: o.decay * tm
    })
  }
}

// ─── Buzz ───────────────────────────────────────────────────────────────────

export interface BuzzSpec {
  at: number
  dur: number
  amp: number
  /** Pulse rate, Hz, gliding to `rateTo`; each period re-rolled by ±`jitter`. */
  rate: number
  rateTo: number
  jitter: number
  /** Resonator centre, Hz, gliding to `fTo`. */
  f: number
  fTo: number
  q: number
  attack: number
  release: number
  /** 0..1 of breath noise fed into the same resonator alongside the pulses. */
  breath: number
  /** Width of each pulse, ms. An impulse only rings the resonator for a
   *  couple of milliseconds out of every twenty — a few ms of raised-cosine
   *  pulse is a lip actually opening, and carries the low-mid body a phone
   *  plays. Default: an impulse. */
  pulseMs?: number
  /** Optional second formant, run in parallel on the same pulses: [Hz, Q, gain].
   *  One resonance is a kazoo; two is a mouth. */
  formant2?: readonly [number, number, number]
}

/**
 * A pulse train rung through one resonance: lips, a party blower's reed, a
 * whoopee cushion. Irregular pulses (the jitter) are the difference between a
 * comic raspberry and an engine.
 */
export const buzz = (b: Bus, o: BuzzSpec): void => {
  const { out, sr } = b
  const rnd = voiceRng(b)
  const n0 = startOf(b, o.at)
  const n1 = Math.min(out.length, n0 + Math.ceil((o.dur + 0.02) * sr))
  const k = 1 / o.q
  const fRatio = o.fTo / o.f
  const rRatio = o.rateTo / o.rate
  schedule(b, () => {
    let ic1 = 0
    let ic2 = 0
    let a1 = 0
    let a2 = 0
    let a3 = 0
    let jc1 = 0
    let jc2 = 0
    let b1 = 0
    let b2 = 0
    let b3 = 0
    const f2 = o.formant2
    const k2 = f2 ? 1 / f2[1] : 1
    let pulseGain = 1
    let pulseAmp = 0
    let phase = 1
    let period = o.rate
    const width = Math.max(1, Math.round(((o.pulseMs ?? 0) / 1000) * sr))
    let pulseAt = width
    for (let n = n0, i = 0; n < n1; n++, i++) {
      const t = i / sr
      const u = Math.min(1, t / o.dur)
      if ((i & 7) === 0) {
        const fc = clamp(o.f * Math.pow(fRatio, u), 40, sr * 0.45)
        const g = Math.tan(Math.PI * fc / sr)
        a1 = 1 / (1 + g * (g + k))
        a2 = g * a1
        a3 = g * a2
        if (f2) {
          const g2 = Math.tan(Math.PI * clamp(f2[0] * (fc / o.f), 40, sr * 0.45) / sr)
          b1 = 1 / (1 + g2 * (g2 + k2))
          b2 = g2 * b1
          b3 = g2 * b2
        }
        // An impulse through a normalised band-pass rings at ~2πf/(Q·sr); undo
        // that so `amp` is the ring's own height.
        pulseGain = (o.q * sr) / (TAU * fc)
      }
      let x = 0
      phase += period / sr
      if (phase >= 1) {
        phase -= 1
        period = o.rate * Math.pow(rRatio, u) * (1 + o.jitter * (rnd() * 2 - 1))
        pulseAmp = pulseGain * (0.7 + 0.3 * rnd())
        pulseAt = 0
      }
      if (pulseAt < width) {
        // Raised cosine summing to ~1 over its width, so a wide pulse carries
        // the same total push into the resonator as the impulse it replaces.
        x = pulseAmp * (2 / width) * (0.5 - 0.5 * Math.cos((TAU * (pulseAt + 0.5)) / width))
        pulseAt++
      }
      x += o.breath * (rnd() * 2 - 1) * pulseGain * 0.02
      let env: number
      if (t < o.attack) env = t / o.attack
      else if (t > o.dur - o.release) env = Math.max(0, (o.dur - t) / o.release)
      else env = 1
      const v3 = x - ic2
      const v1 = a1 * ic1 + a2 * v3
      const v2 = ic2 + a2 * ic1 + a3 * v3
      ic1 = 2 * v1 - ic1
      ic2 = 2 * v2 - ic2
      let y = k * v1
      if (f2) {
        const w3 = x - jc2
        const w1 = b1 * jc1 + b2 * w3
        const w2 = jc2 + b2 * jc1 + b3 * w3
        jc1 = 2 * w1 - jc1
        jc2 = 2 * w2 - jc2
        y += f2[2] * k2 * w1 * (f2[1] / o.q) * (o.f / f2[0])
      }
      out[n]! += o.amp * env * y
    }
  })
}

// ─── The master pass ────────────────────────────────────────────────────────

/** One-pole-pair SVF high-pass, in place on a copy. */
const highpass = (x: Float32Array, sr: number, fc: number): Float32Array => {
  const y = new Float32Array(x.length)
  const k = Math.SQRT2
  const g = Math.tan(Math.PI * fc / sr)
  const a1 = 1 / (1 + g * (g + k))
  const a2 = g * a1
  const a3 = g * a2
  let ic1 = 0
  let ic2 = 0
  for (let n = 0; n < x.length; n++) {
    const v0 = x[n]!
    const v3 = v0 - ic2
    const v1 = a1 * ic1 + a2 * v3
    const v2 = ic2 + a2 * ic1 + a3 * v3
    ic1 = 2 * v1 - ic1
    ic2 = 2 * v2 - ic2
    y[n] = v0 - k * v1 - v2
  }
  return y
}

/**
 * How loud a crush is ON A PHONE: the loudest 50 ms, in dBFS RMS, after
 * removing what a phone speaker cannot play (< 150 Hz) and lifting what the ear
 * is most sensitive to (+4 dB above ~1.7 kHz, the K-weighting shelf).
 *
 * 50 ms and a MAXIMUM rather than an average over the whole sound, because a
 * crush is judged by its burst: a flea tick and a stinkbug's quarter-second
 * raspberry averaged over their lengths would be balanced wildly wrong.
 */
export const phoneLoudnessDb = (x: Float32Array, sr: number): number => {
  const body = highpass(x, sr, 150)
  const presence = highpass(body, sr, 1700)
  const win = Math.max(1, Math.min(body.length, Math.round(0.05 * sr)))
  // Running sum of squares — O(n), because this runs inside the game's idle
  // slices and a nested window loop was most of a buffer's render time.
  let sum = 0
  let best = 0
  for (let n = 0; n < body.length; n++) {
    const w = body[n]! + 0.585 * presence[n]!
    sum += w * w
    if (n >= win) {
      const o = body[n - win]! + 0.585 * presence[n - win]!
      sum -= o * o
    }
    if (n >= win - 1) best = Math.max(best, sum / win)
  }
  return best > 1e-12 ? 10 * Math.log10(best) : -120
}

/**
 * Finish a raw render: remove DC, set its loudness, limit its peaks, trim its
 * tail and fade both edges.
 *
 * The limiter is a look-ahead one (a sliding minimum of the gain it needs, then
 * a box average over the same span) rather than a clipper, because a clipped
 * crack transient is exactly the harsh, "bone-crunchy" edge this whole bank
 * exists to avoid. The construction guarantees the smoothed gain never exceeds
 * what any sample under it needed, so the ceiling holds without distortion.
 */
export const finish = (rawFull: Float32Array, sr: number, targetDb: number, ceiling = 0.92): Float32Array => {
  // A render is allocated for its longest possible tail; most end well short.
  // Everything past −80 dB of the raw peak (plus 30 ms for the filters to ring
  // out) is dropped BEFORE the heavy passes, so their cost follows the sound
  // rather than the allocation — a boss crush was paying for 700 ms of zeros.
  let rawPeak = 0
  for (let n = 0; n < rawFull.length; n++) rawPeak = Math.max(rawPeak, Math.abs(rawFull[n]!))
  let rawEnd = 0
  const rawFloor = rawPeak * 1e-4
  for (let n = rawFull.length - 1; n >= 0; n--) {
    if (Math.abs(rawFull[n]!) > rawFloor) { rawEnd = n; break }
  }
  const raw = rawFull.subarray(0, Math.min(rawFull.length, rawEnd + Math.round(0.03 * sr)))
  const len = raw.length
  // DC blocker at ~20 Hz: a squelch built from filtered noise can carry an
  // offset, and an offset at the end of a buffer is a click when it stops.
  const x = new Float32Array(len)
  const R = Math.exp(-TAU * 20 / sr)
  let x1 = 0
  let y1 = 0
  for (let n = 0; n < len; n++) {
    const y = raw[n]! - x1 + R * y1
    x1 = raw[n]!
    y1 = y
    x[n] = y
  }

  // Master low-pass at ~8.5 kHz. Nothing in the bank needs more — a phone
  // speaker plays none of it, and above there a crackle stops being bright and
  // starts being a fizz. It also catches the air a wide noise band leaks.
  {
    const k = Math.SQRT2
    const g = Math.tan(Math.PI * Math.min(8500, sr * 0.45) / sr)
    const a1 = 1 / (1 + g * (g + k))
    const a2 = g * a1
    const a3 = g * a2
    let ic1 = 0
    let ic2 = 0
    for (let n = 0; n < len; n++) {
      const v3 = x[n]! - ic2
      const v1 = a1 * ic1 + a2 * v3
      const v2 = ic2 + a2 * ic1 + a3 * v3
      ic1 = 2 * v1 - ic1
      ic2 = 2 * v2 - ic2
      x[n] = v2
    }
  }

  const loud = phoneLoudnessDb(x, sr)
  if (loud > -110) {
    const g = Math.pow(10, (targetDb - loud) / 20)
    for (let n = 0; n < len; n++) x[n]! *= g
  }

  // ── Look-ahead limiter, with one makeup pass ──
  //
  // Limiting a slam's transient costs it loudness — measured, about a decibel
  // on the heaviest crushes — which would quietly undo the level table: the
  // beetle slam is meant to sit 3 dB over the tap-kill, not 2. So the loudness
  // is measured again after limiting and the shortfall made up once (capped at
  // +3 dB), then limited again.
  const limit = (): void => {
    const L = Math.max(1, Math.round(0.0015 * sr))
    const need = new Float32Array(len)
    let over = false
    for (let n = 0; n < len; n++) {
      const a = Math.abs(x[n]!)
      need[n] = a > ceiling ? ceiling / a : 1
      if (a > ceiling) over = true
    }
    if (over) {
      // Sliding minimum over [n−L, n+L] with a monotonic deque, then a running
      // box average over the same span — both O(n).
      const h = new Float32Array(len)
      const dq = new Int32Array(len)
      let head = 0
      let tail = 0
      let next = 0
      for (let n = 0; n < len; n++) {
        const hi = Math.min(len - 1, n + L)
        while (next <= hi) {
          while (tail > head && need[dq[tail - 1]!]! >= need[next]!) tail--
          dq[tail++] = next++
        }
        while (dq[head]! < n - L) head++
        h[n] = need[dq[head]!]!
      }
      const release = Math.exp(-1 / (0.015 * sr))
      let prev = 1
      let sum = 0
      let lo = 0
      let hiIdx = -1
      for (let n = 0; n < len; n++) {
        const want = Math.min(len - 1, n + L)
        while (hiIdx < want) sum += h[++hiIdx]!
        while (lo < n - L) sum -= h[lo++]!
        const s = sum / (hiIdx - lo + 1)
        const g = s < prev ? s : s - (s - prev) * release
        prev = g
        x[n]! *= g
      }
    }
  }
  limit()
  if (loud > -110) {
    const short = targetDb - phoneLoudnessDb(x, sr)
    if (short > 0.25) {
      const g = Math.pow(10, Math.min(3, short) / 20)
      for (let n = 0; n < len; n++) x[n]! *= g
      limit()
    }
  }

  // ── Trim the tail at −42 dB under the peak, and fade the edges ──
  //
  // −42 and not deeper: the bank plays these a good 12 dB under full scale in a
  // busy mix, where a tail 42 dB down is gone — and every millisecond kept is
  // memory and idle-time rendering spent on nothing.
  let peak = 0
  for (let n = 0; n < len; n++) peak = Math.max(peak, Math.abs(x[n]!))
  const floor = peak * 0.008
  let last = 0
  for (let n = len - 1; n >= 0; n--) {
    if (Math.abs(x[n]!) > floor) { last = n; break }
  }
  const end = Math.min(len, last + Math.round(0.01 * sr))
  const y = x.slice(0, Math.max(end, Math.round(0.02 * sr)))
  const fadeIn = Math.max(1, Math.round(0.001 * sr))
  for (let n = 0; n < fadeIn && n < y.length; n++) y[n]! *= 0.5 - 0.5 * Math.cos(Math.PI * n / fadeIn)
  const fadeOut = Math.max(1, Math.min(Math.round(0.012 * sr), Math.floor(y.length * 0.25)))
  for (let i = 0; i < fadeOut; i++) {
    const n = y.length - 1 - i
    y[n]! *= 0.5 - 0.5 * Math.cos(Math.PI * i / fadeOut)
  }
  for (let n = 0; n < y.length; n++) y[n] = clamp(y[n]!, -0.97, 0.97)
  return y
}
