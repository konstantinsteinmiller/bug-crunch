/**
 * ─── Instruments: the voices the cue recipes are built from ─────────────────
 *
 * Each is a small physical or modal model with its own parameters, written so a
 * recipe reads like a cue sheet ("a floorboard knock, a kick-drum body, a room")
 * rather than like DSP. Everything here writes into a `Bus` and draws its
 * randomness from it.
 */
import {
  BAR, MARIMBA, MEMBRANE, adEnv, clamp, envAt, fm, jit, layer, logRange, mix, noise, osc, partials,
  range, reed, roomIR, saturate, scatter, strike, svf, tick
} from './dsp.mjs'

const lerp = (a, b, u) => a + (b - a) * u

// ─── Rooms ──────────────────────────────────────────────────────────────────
//
// Built once per rate. `floor` is the kitchen-floor board the game is played
// on (short, dark); `hall` is for the fanfares; `alley` is a bowling alley.

const ROOM_CACHE = new Map()
export const room = (sr, kind) => {
  const key = `${kind}@${sr}`
  if (!ROOM_CACHE.has(key)) {
    const spec = {
      floor: { t60: 0.38, predelay: 0.004, early: 7, earlySpan: 0.02, earlyGain: 0.5, highMul: 0.45, airMul: 0.25 },
      plate: { t60: 0.7, predelay: 0.002, early: 3, earlyGain: 0.2, highMul: 0.8, airMul: 0.6, lowMul: 0.6 },
      hall: { t60: 1.2, predelay: 0.014, early: 10, earlySpan: 0.05, earlyGain: 0.45, highMul: 0.55, airMul: 0.3 },
      alley: { t60: 1.4, predelay: 0.02, early: 12, earlySpan: 0.07, earlyGain: 0.55, highMul: 0.5, airMul: 0.25 }
    }[kind]
    ROOM_CACHE.set(key, roomIR(sr, spec, kind.length * 7919))
  }
  return ROOM_CACHE.get(key)
}

// ─── Percussion bodies ──────────────────────────────────────────────────────

/**
 * A kick-drum style body: a sine whose pitch falls exponentially from `f0` to
 * `f1`, SATURATED on its own layer so the 60–120 Hz a phone cannot play grows
 * 2nd/3rd/4th harmonics it can. Weight a phone can actually reproduce.
 */
export const thump = (b, { at, f0, f1, glide = 0.04, t60 = 0.3, amp = 1, drive = 2, attack = 0.0008 }) => {
  const L = layer(b)
  osc(L, {
    at, dur: t60 * 1.05 + attack, phase: 0,
    pitch: (t) => f1 + (f0 - f1) * Math.exp(-t / glide),
    amp: 1, env: (t) => adEnv(t, attack, 0.004, t60)
  })
  saturate(L.out, b.sr, drive)
  mix(b, L.out, 0, amp)
}

/** Floorboards: a heavy, rough, soft-contact strike of a wooden floor's modes. */
export const floorboards = (b, { at, amp = 1, scale = 1, contact = 0.004, t = 1 }) => {
  strike(b, {
    at, amp, contact, rough: 0.25,
    modes: [
      [118 * scale, 1, 0.18 * t], [205 * scale, 0.8, 0.15 * t], [347 * scale, 0.62, 0.12 * t],
      [590 * scale, 0.45, 0.085 * t], [980 * scale, 0.3, 0.06 * t], [1630 * scale, 0.18, 0.04 * t]
    ]
  })
}

/** A struck mallet bar. `kind`: glock | celesta | marimba | vibe. */
export const mallet = (b, { at, f, amp = 1, hard = 0.6, kind = 'glock', t60 = 1 }) => {
  const table = {
    glock: [[1, 1, 1], [BAR[1], 0.3, 0.33], [BAR[2], 0.12, 0.15], [BAR[3], 0.05, 0.07]],
    celesta: [[1, 1, 1], [2, 0.2, 0.45], [3, 0.05, 0.3], [BAR[1], 0.08, 0.2]],
    marimba: [[1, 1, 1], [MARIMBA[1], 0.22, 0.2], [MARIMBA[2], 0.05, 0.07]],
    vibe: [[1, 1, 1], [4, 0.18, 0.3], [10, 0.03, 0.1]]
  }[kind]
  strike(b, {
    at, amp, contact: lerp(0.004, 0.0005, hard),
    modes: table.map(([r, g, tm]) => [f * r, g, t60 * tm])
  })
  // The mallet's own click, in the band the ear reads as "hit".
  tick(b, at, clamp(f * 5, 1800, 7500), 1.5, 0.003, amp * 0.07 * hard)
}

/**
 * A hollow wood block — a clock's tick, a cartoon "tok". Modes of a slotted
 * block (roughly 1 : 1.47 : 2.09 : 2.56), short and dry.
 */
export const woodblock = (b, { at, f, amp = 1, t60 = 0.07, hard = 0.8 }) => {
  strike(b, {
    at, amp, contact: lerp(0.0015, 0.0004, hard),
    modes: [[f, 1, t60], [f * 1.47, 0.5, t60 * 0.7], [f * 2.09, 0.28, t60 * 0.5], [f * 2.56, 0.15, t60 * 0.35]]
  })
}

/** A chitin shell's hollow knock (beetle bowling). */
export const shellKnock = (b, { at, f = 720, amp = 1, t60 = 0.09, hard = 0.7 }) => {
  strike(b, {
    at, amp, contact: lerp(0.002, 0.0005, hard), rough: 0.1,
    modes: [[f, 1, t60], [f * 1.63, 0.6, t60 * 0.8], [f * 2.41, 0.45, t60 * 0.6], [f * 3.37, 0.25, t60 * 0.45], [f * 4.9, 0.12, t60 * 0.3]]
  })
}

/**
 * Cardboard: a box's air cavity (the low "bump" that gives it a pitch), its
 * panels (heavily damped), and a papery rustle. Soft contact — a shoe on a box.
 */
export const cardboard = (b, { at, f = 180, amp = 1, contact = 0.003 }) => {
  strike(b, {
    at, amp, contact, rough: 0.3,
    modes: [[f, 1, 0.09], [f * 1.9, 0.6, 0.05], [f * 2.7, 0.55, 0.045], [f * 4.3, 0.4, 0.035], [f * 6.2, 0.25, 0.025]]
  })
  noise(b, { at, dur: 0.07, amp: amp * 0.22, mode: 'bp', f: range(b, 1800, 2600), q: 0.9, env: (t) => adEnv(t, 0.001, 0, 0.03) })
}

/**
 * A maple bowling pin. Hard contact (the plastic coat), a bending mode around
 * 500 Hz, the hollow body's rings up to ~4 kHz. `f` is the pin's own tuning —
 * no two pins are quite the same, which is what makes ten of them a clatter
 * instead of a chord.
 */
export const pin = (b, { at, f = 1, amp = 1, hard = 0.9, floor = false }) => {
  strike(b, {
    at, amp, contact: lerp(0.0014, 0.0003, hard), rough: 0.05,
    modes: [
      [505 * f, 0.55, 0.14], [1160 * f, 0.9, 0.09], [1880 * f, 1, 0.075],
      [2790 * f, 0.6, 0.05], [4060 * f, 0.3, 0.035], [5300 * f, 0.12, 0.02]
    ]
  })
  if (floor) {
    // The lane under it: a wooden floor knock.
    strike(b, { at, amp: amp * 0.5, contact: 0.003, modes: [[190 * f, 1, 0.07], [420 * f, 0.6, 0.05], [760 * f, 0.4, 0.035]] })
  }
}

/** A small metal disc (a coin, a bell of a cash register). */
export const coin = (b, { at, f = 2800, amp = 1, t60 = 0.35 }) => {
  strike(b, {
    at, amp, contact: 0.0003,
    modes: [[f, 1, t60], [f * 1.504, 0.7, t60 * 0.8], [f * 2.16, 0.45, t60 * 0.6], [f * 2.66, 0.3, t60 * 0.5], [f * 3.4, 0.15, t60 * 0.3]]
  })
}

/**
 * A crash, kept friendly: a cluster of inharmonic plate modes (log-spread,
 * each its own decay) under a shaped wash of high noise, low-passed so it
 * shimmers instead of hisses.
 */
export const crash = (b, { at, amp = 1, t60 = 1.1, lo = 380, hi = 7000, count = 36 }) => {
  const modes = []
  for (let i = 0; i < count; i++) modes.push([logRange(b, lo, hi), range(b, 0.3, 1), t60 * range(b, 0.35, 1)])
  strike(b, { at, amp: amp * 0.35, contact: 0.0006, modes })
  noise(b, { at, dur: t60 * 1.2, amp: amp * 0.5, mode: 'bp', f: [[0, 6000], [t60, 3500]], q: 0.5, env: (t) => adEnv(t, 0.002, 0.01, t60 * 0.8) })
}

/**
 * A snare stroke: the membrane (Bessel modes, short — a tight snare's body is
 * gone in ~80 ms), the WIRES (two bands of noise that buzz longer after a
 * harder stroke — the sizzle IS the snare), and the stick's crack on the head.
 * `vel` 0..1 moves brightness as well as level, the way a real stroke does.
 */
export const snare = (b, { at, vel = 1, tune = 1 }) => {
  const f0 = 215 * tune
  const g = [1, 0.75, 0.55, 0.45, 0.38, 0.3, 0.26]
  strike(b, {
    at, amp: 0.32 * vel, contact: lerp(0.002, 0.0007, vel), bend: -0.03 * vel, bendT: 0.02,
    modes: MEMBRANE.slice(0, 7).map((r, i) => [f0 * r, g[i], 0.1 - i * 0.008])
  })
  noise(b, { at: at + 0.0008, dur: 0.3, amp: 0.95 * vel, mode: 'bp', f: 4600 * tune, q: 0.6, env: (t) => adEnv(t, 0.001, 0.004, 0.09 + 0.12 * vel) })
  noise(b, { at: at + 0.0008, dur: 0.16, amp: 0.45 * vel, mode: 'bp', f: 2300 * tune, q: 0.9, env: (t) => adEnv(t, 0.0008, 0.002, 0.05 + 0.05 * vel) })
  noise(b, { at, dur: 0.012, amp: 0.45 * vel * (0.5 + 0.5 * vel), mode: 'bp', f: 3200, q: 0.8, env: (t) => adEnv(t, 0.0002, 0, 0.004) })
}

/** One hand clap: three or four bursts a few ms apart, then a short tail. */
export const clap = (b, { at, amp = 1, f = 1300 }) => {
  const n = 3 + (b.rnd() < 0.5 ? 1 : 0)
  let t = at
  for (let i = 0; i < n; i++) {
    noise(b, { at: t, dur: 0.012, amp: amp * (i === n - 1 ? 1 : 0.6), mode: 'bp', f: jit(b, f, 0.15), q: 1.1, env: (u) => adEnv(u, 0.0004, 0, 0.005) })
    t += range(b, 0.006, 0.011)
  }
  noise(b, { at: t, dur: 0.1, amp: amp * 0.5, mode: 'bp', f: jit(b, f, 0.1), q: 0.8, env: (u) => adEnv(u, 0.0006, 0, 0.045) })
}

/** Applause: a Poisson crowd of claps swelling in and thinning out. */
export const applause = (b, { from, to, amp = 1, peakRate = 90 }) => {
  scatter(b, from, to, (u) => peakRate * Math.sin(Math.PI * Math.min(1, u * 1.4)) + 6, (t, u) => {
    clap(b, { at: t, amp: amp * range(b, 0.35, 1) * (1 - 0.6 * u), f: logRange(b, 900, 2200) })
  })
}

/** A referee's pea whistle: a pure tone the pea rattles (FM + AM trill). */
export const whistle = (b, { at, f = 2900, dur = 0.3, amp = 1, trill = 34, scoop = 0.08 }) => {
  const L = layer(b)
  const tr = trill
  osc(L, {
    at, dur,
    pitch: (t) => f * (1 - scoop * Math.exp(-t / 0.02)) * (1 + 0.025 * Math.sin(2 * Math.PI * tr * t)),
    amp: 1,
    env: (t) => (t < 0.012 ? t / 0.012 : 1) * (t > dur - 0.03 ? Math.max(0, (dur - t) / 0.03) : 1) * (0.72 + 0.28 * Math.sin(2 * Math.PI * tr * t + 1))
  })
  partials(L, { at, dur, pitch: (t) => f * (1 + 0.025 * Math.sin(2 * Math.PI * tr * t)), parts: [[2, 0.08], [3, 0.03]], amp: 1, env: (t) => (t < 0.012 ? t / 0.012 : 1) * (t > dur - 0.03 ? Math.max(0, (dur - t) / 0.03) : 1) })
  // Breath and the chiff of the attack.
  noise(L, { at, dur, amp: 0.12, mode: 'bp', f, q: 2, env: (t) => (t < 0.01 ? t / 0.01 : 1) * (t > dur - 0.03 ? Math.max(0, (dur - t) / 0.03) : 1) })
  noise(L, { at, dur: 0.03, amp: 0.25, mode: 'hp', f: 3000, env: (t) => adEnv(t, 0.002, 0, 0.012) })
  mix(b, L.out, 0, amp)
}

/**
 * A cartoon brass stab: three slightly detuned band-limited saws through a
 * low-pass whose cutoff flares open on the attack and settles (that flare IS
 * the "brass" — a static filter is an organ), with a small pitch scoop.
 */
export const brass = (b, { at, f, dur, amp = 1, bright = 1, scoop = 0.02, release = 0.08 }) => {
  const L = layer(b, at + dur + release + 0.05)
  const envF = (t) => {
    if (t < 0.012) return t / 0.012
    if (t < dur) return 0.85 + 0.15 * Math.exp(-(t - 0.012) / 0.08)
    return 0.85 * Math.max(0, 1 - (t - dur) / release)
  }
  for (const [cents, g] of [[0, 1], [7, 0.7], [-6, 0.7]]) {
    osc(L, {
      at, dur: dur + release, wave: 'saw', drift: 0.0015,
      pitch: (t) => f * Math.pow(2, cents / 1200) * (1 - scoop * Math.exp(-t / 0.025)),
      amp: g * 0.4, env: envF
    })
  }
  svf(L.out, b.sr, 'lp', [[at, f * 1.5], [at + 0.02, f * (4 + 5 * bright)], [at + 0.12, f * (2.5 + 2 * bright)], [at + dur + release, f * 1.6]], 0.9)
  mix(b, L.out, 0, amp)
}

/** A sparkle: glints of high bells and tiny ticks, as a texture over a window. */
export const sparkle = (b, { from, to, rate = 40, lo = 2600, hi = 6500, amp = 1, pitched = 0.7 }) => {
  scatter(b, from, to, (u) => rate * (1 - 0.7 * u), (t, u) => {
    const f = logRange(b, lo, hi)
    const a = amp * range(b, 0.25, 1) * (1 - 0.5 * u)
    if (b.rnd() < pitched) strike(b, { at: t, amp: a * 0.5, contact: 0.0003, modes: [[f, 1, range(b, 0.08, 0.25)], [f * 2.76, 0.25, 0.05]] })
    else tick(b, t, f, 2.5, range(b, 0.003, 0.008), a * 0.6)
  })
}

/** A whoosh: a noise band that sweeps, with a swell. */
export const whoosh = (b, { at, dur, from, to, amp = 1, q = 1.2, peak = 0.5 }) => {
  noise(b, {
    at, dur, amp, mode: 'bp', f: [[0, from], [dur, to]], q,
    env: (t) => { const u = t / dur; return u < peak ? Math.sin((Math.PI / 2) * u / peak) : Math.cos((Math.PI / 2) * (u - peak) / (1 - peak)) }
  })
}

/** A soft air puff — a shoe's sole, a balloon's last breath, a magic poof. */
export const puff = (b, { at, dur = 0.12, f = 1400, amp = 1, fTo }) => {
  noise(b, { at, dur, amp, mode: 'lp', f: fTo ? [[0, f], [dur, fTo]] : f, q: 0.6, color: 'pink', env: (t) => adEnv(t, 0.004, 0.005, dur * 0.55) })
}

/**
 * A party popper: the crack of the string charge (a very short bright burst
 * with a low "pok" body) and the streamers' paper rustle after it.
 */
export const popper = (b, { at, amp = 1 }) => {
  noise(b, { at, dur: 0.02, amp, mode: 'bp', f: range(b, 2400, 3400), q: 0.7, env: (t) => adEnv(t, 0.0002, 0.001, 0.007) })
  strike(b, { at, amp: amp * 0.5, contact: 0.0008, modes: [[range(b, 380, 520), 1, 0.04], [range(b, 900, 1200), 0.6, 0.03]] })
  scatter(b, at + 0.01, at + 0.35, (u) => 160 * (1 - u) + 20, (t) => {
    tick(b, t, logRange(b, 2500, 6500), 1.2, range(b, 0.002, 0.006), amp * range(b, 0.05, 0.16))
  })
}

/** A party blower: a reed buzz through the paper tube, pitch rising as it unrolls. */
export const blower = (b, { at, dur = 0.38, f0 = 210, f1 = 290, amp = 1 }) => {
  reed(b, {
    at, dur, pitch: [[0, f0], [dur * 0.7, f1], [dur, f1 * 1.02]], jitter: 0.035, shimmer: 0.15, pulseMs: 0.9, breath: 0.5,
    formants: [[1100, 3, 1], [2300, 4, 0.55], [600, 2, 0.4]],
    env: [[0, 0], [0.02, 1], [dur - 0.05, 0.9], [dur, 0]], amp
  })
}

/** Shake a set of small things (cups, cutlery, crumbs) — a rattle over a window. */
export const rattle = (b, { from, to, amp = 1, lo = 900, hi = 4200, rate = 70 }) => {
  scatter(b, from, to, (u) => rate * (1 - u) + 8, (t, u) => {
    const f = logRange(b, lo, hi)
    strike(b, { at: t, amp: amp * range(b, 0.2, 1) * (1 - 0.6 * u), contact: 0.0005, rough: 0.3, modes: [[f, 1, range(b, 0.02, 0.06)], [f * range(b, 1.4, 1.9), 0.5, 0.03], [f * range(b, 2.3, 3.1), 0.3, 0.02]] })
  })
}

export { lerp, envAt }
