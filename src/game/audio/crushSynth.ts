/**
 * ─── The crush bank: what every body sounds like when it goes ───────────────
 *
 * Pure. No Web Audio, no Vue, no DOM — `renderCrush()` turns
 * `(subject, kind, style, variant, heavy, sampleRate, seed)` into a finished
 * mono `Float32Array`, and the same call gives the same samples every time. The
 * game renders these into AudioBuffers on the shared context during idle time
 * (`useGameAudio`), `pnpm audio:render` writes them to WAVs and spectrograms,
 * and the tests measure them. One source, three consumers.
 *
 * ── Why every bug has its own crush ──
 *
 * The squish is the busiest sound in the game and the one a player hears most
 * often without looking. A shared squelch pitched by size told the player
 * "something died"; a crush per body tells them WHAT died, which is the thing
 * they are actually tracking on a busy board — did the beetle finally crack, did
 * the robobug go, was that the flea. So each body is built from its MATERIAL,
 * not from one sound at another pitch:
 *
 *   ant          the classic: a tiny high plop, a juicy squelch, bubbles, a drip
 *   sprinter     the ant, brighter and quicker, with a zip — it was running
 *   flea         a crisp tick and a micro-pop; the smallest thing in the game
 *   caterpillar  a plush, muffled squash with a prickly bristle rustle on top
 *   stinkbug     a squelch and then a comic "pfffft" — it got the last word
 *   centipede    a rolling ripple of little segment pops, one per body part
 *   pinatafly    a piñata: papery crunch, a party pop and a rattle of candy
 *   moth         a dusty powder puff and wings fluttering to a stop
 *   beetle       CHITIN: a pitched shell crack, a dense bright crackle and a
 *                hollow "tok" — THEN the goo gushing out from under it
 *   robobug      METAL: a tin plate bending, a spring "boing", a spark fizz and
 *                a coolant splutter. Clearly a machine, clearly not a beetle.
 *   pod          an egg shell cracking with the goo underneath
 *   hatch        the same egg giving way from INSIDE — two pecks, a split, and
 *                a pitter-patter of tiny feet getting away. No goo: nothing
 *                burst, something got out
 *   bosses       the same materials at boss size, each with its own trick
 *
 * `hurt` is the same material WITHOUT the release: a beetle whose shell cracked
 * but held is the crack and no goo, so the player hears progress on the one bug
 * that asks for more than one blow. `clang` is the ricochet: short, material,
 * deliberately plain, because it is a negative cue a player can hear four
 * times a second.
 *
 * ── Juice Style swaps the MATERIAL, never the identity ──
 *
 *   ooze      the design above
 *   confetti  paper and party, per bug: an ant is a tiny popper, a beetle a
 *             cardboard crack, a robobug foil and a spring, a stinkbug a party
 *             blower — still one sound per body
 *   bubble    soap. Gentle pops per bug, no wetness and no crunch anywhere. The
 *             setting exists for the player who does not want either.
 *
 * ── Mix contract ──
 *
 * Every render is normalised to a PHONE loudness (`phoneLoudnessDb` in `dsp.ts`)
 * set per kind and per body in `levelDb()`, then look-ahead limited below 0.92.
 * So balance lives in one table here, and the runtime multiplies by one gain
 * per kind (`CRUSH_MIX`). The character of every crush sits in 300 Hz–5 kHz,
 * where a phone speaker actually plays; the sub under a slam is a bonus for
 * headphones, never the part that carries the hit.
 *
 * Kid-friendly is a hard constraint, not a flavour: nothing here is a bone
 * crunch, nothing is gory, crackle grains are band-limited below ~6.5 kHz so a
 * crack is bright without being a fizz, and every "gross" sound (the stinkbug)
 * is a cartoon.
 */

import { BUGS, type BugId } from '@/game/bugs'
import type { BossId } from '@/game/bosses'
import type { JuiceStyleId } from '@/game/juiceStyle'
import {
  type Bus, buzz, clamp, finish, grains, hashString, jit, logRange, modal, noise, range, rngFrom, tone
} from '@/game/audio/dsp'

export type CrushSubject = BugId | BossId | 'pod' | 'hatch'

/**
 * `crush`  the body died.
 * `hurt`   it took the blow and lived (a shell cracked, a piñata dented).
 * `clang`  the blow bounced off (armour the shoe could not pierce).
 */
export type CrushKind = 'crush' | 'hurt' | 'clang'

export const CRUSH_KINDS: readonly CrushKind[] = ['crush', 'hurt', 'clang']

/**
 * Render rate for the runtime bank. 24 kHz, not the context's 44.1/48: every
 * sound here is low-passed at 8.5 kHz on purpose (a phone speaker plays nothing
 * above, and a crackle past it is a fizz), 24 kHz carries that with room to
 * spare, and the AudioBuffer resamples on playback for free. Half the memory
 * and half the rendering of 48 kHz, for nothing a player can hear.
 */
export const CRUSH_RENDER_RATE = 24000

/** Decoded-memory ceiling for the whole bank, bytes. */
export const CRUSH_BUDGET_BYTES = 6 * 1024 * 1024

/**
 * Runtime gain per kind, before the player's SFX slider. Calibrated with
 * `pnpm audio:render`, which measures every crush on the phone-weighted scale
 * against the old live-synth cues it replaces (numbers are dBFS at the mix):
 *
 *   old squish  −31.7   →  light crush ≈ −27. Louder on purpose: the old
 *                          squish's juice sat around 500 Hz, which a phone
 *                          speaker barely plays.
 *   stompHeavy  −23.1   →  an armoured slam-kill ≈ −24, the loudest body in the
 *                          game and still UNDER the slam that caused it.
 *   old hurt    −36.9   →  ≈ −30: a cracked shell is progress, and progress
 *                          that cannot be heard is not feedback.
 *   old clang   −25.1   →  ≈ −31: the ricochet is a negative cue a player can
 *                          hear four times a second, and the old one was the
 *                          shrillest thing in the mix.
 */
export const CRUSH_MIX: Record<CrushKind, number> = {
  crush: 0.25,
  hurt: 0.25,
  clang: 0.32
}

/**
 * Playback-rate jitter per kind, ± ratio. Small, because rate moves pitch AND
 * length together and a 10 % faster beetle is a different beetle — the variants
 * carry the real variety, this only guarantees no two kills are sample-identical.
 */
export const CRUSH_JITTER: Record<CrushKind, number> = {
  crush: 0.045,
  hurt: 0.035,
  clang: 0.02
}

export const BOSS_SUBJECTS: readonly BossId[] = ['queenAnt', 'beetleKing', 'matriarch', 'roachPrime']

export const isBossSubject = (s: CrushSubject): s is BossId =>
  (BOSS_SUBJECTS as readonly string[]).includes(s)

/**
 * Which kinds a body can actually produce in play — what the runtime bank
 * renders. Read straight off the bestiary, so a rebalance cannot leave the
 * bank without a voice it needs: `hurt` needs hp > 1 on a body that does not
 * split (a centipede's blow is a squish), `clang` needs armour. Every subject
 * can still be RENDERED as any kind; this only decides what is worth memory.
 */
const HURTS: ReadonlySet<CrushSubject> = new Set<CrushSubject>(
  BUGS.filter((b) => b.hp > 1 && b.segments === 0).map((b) => b.id)
)
const ARMOURED: ReadonlySet<CrushSubject> = new Set<CrushSubject>(
  BUGS.filter((b) => b.armor > 0).map((b) => b.id)
)

export const crushKindsFor = (s: CrushSubject): readonly CrushKind[] => {
  if (isBossSubject(s)) return CRUSH_KINDS
  if (s === 'pod' || s === 'hatch') return ['crush']
  const kinds: CrushKind[] = ['crush']
  if (HURTS.has(s)) kinds.push('hurt')
  if (ARMOURED.has(s)) kinds.push('clang')
  return kinds
}

/**
 * The heavy flag a kind actually distinguishes. A boss only ever crushes under
 * a slam-sized event (the counter, the death) and is only ever hurt by one
 * size of blow; a pod has one crush; a ricochet sounds the same whatever bounced.
 * Collapsing these here keeps the bank from rendering two copies of one sound.
 */
export const canonicalHeavy = (s: CrushSubject, kind: CrushKind, heavy: boolean): boolean => {
  if (kind === 'clang') return false
  if (s === 'pod' || s === 'hatch') return false
  if (isBossSubject(s)) return kind === 'crush'
  return heavy
}

/** Variants per slot. Enough that a Fever of twelve kills never repeats one
 *  back to back, few enough that the whole bestiary fits the budget. */
export const crushVariants = (s: CrushSubject, kind: CrushKind, heavy: boolean): number => {
  const h = canonicalHeavy(s, kind, heavy)
  if (kind === 'clang') return 2
  if (isBossSubject(s)) return kind === 'crush' ? 2 : 3
  if (s === 'pod') return 3
  // Two: a hatch is a consequence cue, rarer than any pop — three eggs at once
  // is the most a fight produces, and the throttle spaces those out anyway.
  if (s === 'hatch') return 2
  if (kind === 'hurt') return h ? 2 : 3
  return h ? 3 : 4
}

/** Longest a render may run before trimming, seconds. */
const maxSeconds = (s: CrushSubject, kind: CrushKind): number =>
  isBossSubject(s) ? (kind === 'crush' ? 1.5 : 0.8) : kind === 'crush' ? 0.9 : 0.5

// ─── Loudness table ─────────────────────────────────────────────────────────

const KIND_DB: Record<CrushKind, number> = { crush: -15, hurt: -18, clang: -21 }

/** Per-body trims on top of the kind. The flea is small and quick and should
 *  stay small; the long ones (a raspberry, a flutter) read louder than their
 *  loudest 50 ms says; the piñata is a payday and gets a touch more. The two
 *  armoured bodies get their lift from the slam instead — see `levelDb`. */
const TRIM_DB: { readonly [K in CrushSubject]?: number } = {
  flea: -2.5,
  sprinter: -0.5,
  stinkbug: -1,
  moth: -1,
  caterpillar: -0.5,
  pinatafly: 0.5,
  // Under the pop it is the other half of. A hatch has to be HEARD across a busy
  // board — it is the only warning that ants just arrived — and must never be
  // louder than the stomp that would have prevented it.
  hatch: -3
}

export const levelDb = (s: CrushSubject, kind: CrushKind, heavy: boolean): number => {
  let db = KIND_DB[kind] + (TRIM_DB[s] ?? 0)
  if (heavy && kind !== 'clang') db += ARMOURED.has(s) ? 3 : 2
  if (isBossSubject(s)) db += 3
  return db
}

// ─── Size → pitch and time ──────────────────────────────────────────────────

/** Pitch factor for a body of `size` (an ant is 0.8): bigger bodies are lower,
 *  a little faster than linearly, which is how resonators scale. */
const kf = (size: number): number => Math.pow(0.8 / size, 1.1)
/** Time factor: bigger bodies are slower. */
const kt = (size: number): number => Math.pow(size / 0.8, 0.85)

// ─── Materials: liquid ──────────────────────────────────────────────────────

/**
 * One bubble: a sine blip with an upward chirp and a fast decay. Damping follows
 * the physical law for a bubble of that pitch (bigger = rings longer), stretched
 * by `cartoon` because a real 3 kHz bubble is gone in three milliseconds and a
 * game needs to hear it.
 */
const bubble = (b: Bus, at: number, f: number, amp: number, cartoon = 2.4): void => {
  const d = 0.043 * f + 0.0014 * Math.pow(f, 1.5)
  const tau = clamp(cartoon / d, 0.004, 0.045)
  tone(b, { at, amp, f, rise: range(b, 0.35, 0.9), riseT: tau * 1.3, attack: 0.0007, decay: tau })
}

interface WetOpts {
  /** The opening plop — the skin giving. 0 for none. */
  plop?: number
  bubbles?: number
  drips?: number
  /** 0..1 — the gurgle in the squelch. */
  slosh?: number
  /** Formant Q: high is thin and juicy, low is thick. */
  q?: number
  /** Squelch length multiplier. */
  long?: number
  /** Pitch multiplier on everything. */
  pitch?: number
  /** The body giving way under the shoe, low and short. */
  thump?: number
  /** Squelch level (the formant noise). */
  squelch?: number
}

/**
 * The fluid layer: a two-formant squelch sweeping down (the vowel of "squish"),
 * gated by an irregular slosh, over a cluster of rising bubbles clumped toward
 * the start, with a drip or two after. Pitched and stretched by body size.
 */
const wet = (b: Bus, at: number, size: number, amp: number, o: WetOpts = {}): void => {
  const kp = kf(size) * (o.pitch ?? 1)
  const ts = kt(size) * (o.long ?? 1)
  const q = o.q ?? 6
  const slosh = o.slosh ?? 0.5

  if (o.plop) {
    tone(b, {
      at, amp: amp * o.plop, f: 620 * kp, to: 1650 * kp, glide: 0.02 * ts,
      attack: 0.0012, decay: 0.014 * ts, harm: [[2, 0.18]]
    })
  }
  if (o.thump) {
    const f = 200 * Math.pow(kp, 0.7)
    tone(b, {
      at, amp: amp * o.thump, f, to: f * 0.55, glide: 0.05 * ts,
      attack: 0.002, decay: 0.028 * ts, harm: [[2, 0.45], [3, 0.15]]
    })
  }

  const sq = 0.055 * ts
  const f1 = jit(b, 1650 * kp, 0.08)
  const f2 = jit(b, 3300 * kp, 0.08)
  const sqAmp = amp * (o.squelch ?? 1)
  noise(b, {
    at: at + 0.004, amp: sqAmp * 0.8, mode: 'bp', f: f1, to: f1 * 0.48, glide: sq * 1.6, q,
    attack: 0.003, hold: sq * 0.35, decay: sq * 0.55,
    amRate: 38 / Math.sqrt(ts), amTo: 22 / Math.sqrt(ts), amDepth: slosh, amJitter: 0.5
  })
  noise(b, {
    at: at + 0.006, amp: sqAmp * 0.5, mode: 'bp', f: f2, to: f2 * 0.55, glide: sq * 1.4, q: q * 1.2,
    attack: 0.003, hold: sq * 0.25, decay: sq * 0.5,
    amRate: 51 / Math.sqrt(ts), amDepth: slosh * 0.8, amJitter: 0.6
  })

  const nb = o.bubbles ?? 4
  const win = 0.03 + 0.07 * ts
  const bLo = 1900 * kp
  for (let i = 0; i < nb; i++) {
    const t = at + 0.008 * ts + Math.pow(b.rnd(), 1.5) * win
    const f = clamp(logRange(b, bLo, 4400 * kp), 180, 6000)
    bubble(b, t, f, amp * 0.55 * Math.pow(bLo / f, 0.5) * range(b, 0.55, 1))
  }

  const nd = o.drips ?? 1
  let td = at + range(b, 0.085, 0.115) * ts
  for (let j = 0; j < nd; j++) {
    const g = amp * Math.pow(0.65, j)
    noise(b, { at: td, amp: g * 0.3, mode: 'bp', f: 2300 * Math.sqrt(kp), q: 1.6, attack: 0.0006, decay: 0.0025 })
    bubble(b, td + 0.003, clamp(logRange(b, 1150, 1900) * Math.pow(kp, 0.6), 300, 4000), g * 0.45, 1.6)
    td += range(b, 0.045, 0.075) * Math.sqrt(ts)
  }
}

// ─── Materials: shell ───────────────────────────────────────────────────────

interface ShellOpts {
  /** Crack transients in a row — a slam breaks a shell in stages. */
  stages?: number
  /** Crackle density multiplier. */
  grains?: number
  /** The hollow knock of the empty shell. */
  tok?: number
  /** Low-mid crunch body under the crack. */
  crunch?: number
  pitch?: number
  long?: number
}

/**
 * Chitin: a sharp PITCHED crack (a broadband snap plus an inharmonic ring that
 * sags as the shell gives), a dense bright crackle whose grains thin out as the
 * pieces settle, and the hollow "tok" of the shell itself.
 */
const shell = (b: Bus, at: number, size: number, amp: number, o: ShellOpts = {}): void => {
  const kp = Math.pow(kf(size), 0.6) * (o.pitch ?? 1)
  const ts = Math.pow(size / 1.25, 0.8) * (o.long ?? 1)
  const stages = o.stages ?? 1
  const gd = o.grains ?? 1

  let t = at
  for (let s = 0; s < stages; s++) {
    const g = amp * (s === stages - 1 ? 1 : 0.72)
    // A crack is not one click: it is two or three micro-fractures a few
    // milliseconds apart, over a short pitched ring that sags as the shell gives.
    noise(b, { at: t, amp: g, mode: 'hp', f: 1000, q: 0.7, attack: 0.0002, decay: 0.004 })
    noise(b, { at: t + range(b, 0.002, 0.004), amp: g * 0.6, mode: 'bp', f: 2600 * kp, q: 0.8, attack: 0.0002, decay: 0.003 })
    modal(b, {
      at: t, amp: g * 0.45, f: jit(b, 1750 * kp, 0.1), decay: 0.012, bend: -0.05, attack: 0.0003,
      modes: [[1, 1, 1], [2.31, 0.5, 0.6], [3.62, 0.22, 0.4]]
    })
    t += range(b, 0.018, 0.03) * Math.sqrt(ts)
  }

  // The crackle is the layer the player hears as "crunch", so it is the loud
  // one: dense, heavy-tailed, and bright without going past the phone band.
  const dur = 0.075 * ts * (0.7 + 0.45 * gd) + (t - at)
  grains(b, {
    at: at + 0.002, dur, amp: amp * 1.5, rate: 650 * gd, rateEnd: 60,
    lo: 1200, hi: 6200, tauLo: 0.0003, tauHi: 0.0014, pitched: 0.35, q: 1.8, alpha: 1.4
  })

  if (o.tok) {
    // Short: a hollow knock, not a note. A tok that rings is a woodblock.
    modal(b, {
      at: at + 0.001, amp: amp * o.tok, f: jit(b, 700 * Math.pow(kf(size), 0.9) * (o.pitch ?? 1), 0.06),
      decay: 0.014 * Math.sqrt(ts), attack: 0.0005,
      modes: [[1, 1, 1], [1.59, 0.55, 0.7], [2.46, 0.35, 0.5], [3.7, 0.15, 0.35]]
    })
  }
  if (o.crunch) {
    noise(b, { at: at + 0.001, amp: amp * o.crunch, mode: 'bp', f: 900 * kp, q: 1.1, attack: 0.0008, decay: 0.012 * ts })
  }
}

// ─── Materials: metal ───────────────────────────────────────────────────────

/** Mode ratios of a thin, free plate — dense and inharmonic, which is "tin". */
const PLATE: ReadonlyArray<readonly [number, number, number]> = [
  [1, 1, 1], [1.59, 0.8, 0.8], [2.14, 0.6, 0.7], [2.3, 0.55, 0.62],
  [2.65, 0.4, 0.55], [2.92, 0.32, 0.5], [3.16, 0.26, 0.45], [3.5, 0.18, 0.4]
]

/** Bent tin: a strike, a damped plate whose pitch SAGS as it dents, a run of
 *  little crumple creases, and a dull dunk of the chassis. */
const tin = (b: Bus, at: number, size: number, amp: number, crumple = 1, dunk = 0.25): void => {
  const kp = Math.pow(kf(size), 0.8)
  const ts = Math.pow(size / 1.1, 0.7)
  noise(b, { at, amp: amp * 0.8, mode: 'bp', f: 2400 * kp, q: 0.9, attack: 0.0003, decay: 0.005 })
  modal(b, { at, amp: amp * 0.35, f: jit(b, 780 * kp, 0.07), decay: 0.03 * ts, bend: -0.07, attack: 0.0006, modes: PLATE })
  // The crumple is what says TIN: a run of bright, inharmonic creases. It is
  // the loudest layer on purpose — the plate and the dunk only give it a body.
  const n = Math.round((8 + 5 * b.rnd()) * crumple)
  let t = at + 0.008
  for (let i = 0; i < n; i++) {
    t += range(b, 0.005, 0.02) * ts
    const size01 = Math.min(1, 0.35 * Math.pow(1 - b.rnd() * 0.99, -0.6))
    modal(b, {
      at: t, amp: amp * 0.75 * size01 * Math.pow(0.92, i), f: logRange(b, 1700, 4600) * Math.sqrt(kp),
      decay: range(b, 0.005, 0.012), attack: 0.0002, modes: [[1, 1, 1], [2.76, 0.45, 0.5], [5.1, 0.15, 0.3]]
    })
  }
  if (dunk) {
    tone(b, {
      at, amp: amp * dunk, f: 220 * kp, to: 140 * kp, glide: 0.05, attack: 0.001,
      decay: 0.025 * ts, harm: [[2, 0.5], [3, 0.25]]
    })
  }
}

/** The cartoon spring: a twangy tone with a fast decaying wobble. */
const boing = (b: Bus, at: number, size: number, amp: number, pitch = 1): void => {
  // ~340 Hz for the robobug, with strong upper partials: a boing whose
  // fundamental sits at 240 Hz is a hum on a phone, and the phone is the point.
  const f = jit(b, 420 * Math.pow(kf(size), 0.6) * pitch, 0.05)
  tone(b, {
    at, amp, f, to: f * 1.12, glide: 0.2,
    vibRate: range(b, 11, 15), vibDepth: 0.16, vibDecay: 0.12,
    attack: 0.003, hold: 0.008, decay: 0.075 * Math.sqrt(size / 1.1),
    harm: [[2, 0.55], [3, 0.3], [4.1, 0.12]]
  })
}

/** A small short-circuit: fine bright grains and a flickering hiss. */
const sparks = (b: Bus, at: number, amp: number, dur: number): void => {
  grains(b, {
    at, dur, amp, rate: 260, rateEnd: 30, lo: 2800, hi: 6400,
    tauLo: 0.00015, tauHi: 0.0005, pitched: 0.3, q: 2.5
  })
  noise(b, {
    at, amp: amp * 0.22, mode: 'bp', f: 4400, to: 3500, glide: dur, q: 2,
    attack: 0.002, hold: dur * 0.3, decay: dur * 0.3,
    amRate: 55, amDepth: 0.9, amJitter: 0.8, amSharp: 3
  })
}

/** Coolant: a few irregular wet coughs, each with a bubble in it. */
const splutter = (b: Bus, at: number, size: number, amp: number, bursts: number): void => {
  const kp = Math.sqrt(kf(size))
  let t = at
  for (let i = 0; i < bursts; i++) {
    const g = amp * range(b, 0.6, 1) * Math.pow(0.82, i)
    noise(b, {
      at: t, amp: g, mode: 'bp', f: jit(b, 1150 * kp, 0.2), to: 700 * kp, glide: 0.03, q: 3.5,
      attack: 0.0015, decay: range(b, 0.008, 0.018), amRate: 75, amDepth: 0.7, amJitter: 0.7
    })
    if (b.rnd() < 0.75) bubble(b, t + 0.004, logRange(b, 1300, 2800) * kp, g * 0.5)
    t += range(b, 0.028, 0.065) * Math.sqrt(size / 1.1)
  }
}

// ─── Materials: the rest of the bestiary ────────────────────────────────────

/** The stinkbug's parting shot: a jittery lip-buzz through a mouth resonance,
 *  breath over it, and a "t" to end on. A cartoon, never a real one. */
const pfft = (b: Bus, at: number, size: number, amp: number, long = 1): void => {
  const kp = Math.sqrt(kf(size))
  const dur = 0.24 * long * Math.pow(size, 0.4)
  buzz(b, {
    at, dur, amp: amp * 0.8, rate: range(b, 74, 84), rateTo: range(b, 50, 58), jitter: 0.2,
    f: 620 * kp, fTo: 470 * kp, q: 4.5, attack: 0.012, release: dur * 0.35, breath: 0.1, pulseMs: 0.9,
    formant2: [1450 * kp, 5, 0.55]
  })
  noise(b, {
    at: at + 0.004, amp: amp * 0.3, mode: 'bp', f: 1500 * kp, to: 950 * kp, glide: dur, q: 0.9,
    attack: 0.02, hold: dur * 0.45, decay: dur * 0.2
  })
  noise(b, { at: at + dur * 0.92, amp: amp * 0.35, mode: 'hp', f: 2600, q: 0.7, attack: 0.0006, decay: 0.004 })
}

interface RippleOpts {
  wet?: number
  gap?: number
  /** Force the ripple's direction: 1 rising, −1 falling, 0 rolled per variant. */
  dir?: number
}

/** A run of segment pops that accelerates — a centipede coming apart in order. */
const ripple = (b: Bus, at: number, size: number, amp: number, count: number, o: RippleOpts = {}): void => {
  const kp = kf(size)
  const rising = o.dir ? o.dir > 0 : b.rnd() < 0.5
  const step = rising ? 1.05 : 0.94
  let f = logRange(b, 1300, 1700) * kp * (rising ? 0.9 : 1.25)
  let t = at
  const gap = (o.gap ?? 0.024) * Math.sqrt(size / 0.8)
  const dec = 0.009 * Math.sqrt(size / 0.8)
  for (let i = 0; i < count; i++) {
    const g = amp * range(b, 0.75, 1) * (1 - 0.35 * i / count)
    tone(b, { at: t, amp: g * 0.7, f: f * 0.7, to: f * 1.9, glide: 0.012, attack: 0.001, decay: dec, harm: [[2, 0.12]] })
    noise(b, { at: t, amp: g * (o.wet ?? 0.4), mode: 'bp', f: f * 1.6, to: f * 0.9, glide: 0.012, q: 3, attack: 0.0008, decay: 0.006 })
    f *= jit(b, step, 0.02)
    t += gap * range(b, 0.8, 1.15) * (1 - 0.25 * i / count)
  }
}

/** Plush: a muffled, soft-attacked squash — a stuffed toy, not a body. */
const plush = (b: Bus, at: number, size: number, amp: number): void => {
  const ts = kt(size)
  noise(b, { at, amp: amp * 0.9, mode: 'lp', f: 1700, to: 420, glide: 0.08 * ts, q: 0.9, attack: 0.007, decay: 0.065 * ts })
  tone(b, { at, amp: amp * 0.5, f: 150, to: 92, glide: 0.06 * ts, attack: 0.006, decay: 0.05 * ts, harm: [[2, 0.35], [3, 0.1]] })
}

/** Bristles: a swelling rustle of tiny prickly ticks. */
const bristles = (b: Bus, at: number, amp: number, dur: number): void => {
  grains(b, {
    at, dur, amp, rate: 240, rateEnd: 110, lo: 2600, hi: 5600,
    tauLo: 0.0008, tauHi: 0.002, pitched: 0.5, q: 1.4, swell: true, alpha: 2.6
  })
}

/** A zip: a fast rising band of noise with a rising whistle inside it. */
const zip = (b: Bus, at: number, amp: number, dur = 0.03): void => {
  noise(b, { at, amp, mode: 'bp', f: 1400, to: 5200, glide: dur, q: 3, attack: 0.004, hold: dur * 0.5, decay: dur * 0.4 })
  tone(b, { at, amp: amp * 0.3, f: 900, to: 2800, glide: dur, attack: 0.004, hold: dur * 0.5, decay: dur * 0.35 })
}

/** A tick: the crispest transient in the bank, and the flea's whole identity. */
const tick = (b: Bus, at: number, amp: number, f = 4200): void => {
  noise(b, { at, amp: amp * 0.8, mode: 'hp', f: 2500, q: 0.7, attack: 0.0001, decay: 0.0012 })
  tone(b, { at, amp: amp * 0.6, f, attack: 0.0002, decay: 0.003 })
}

/** A dusty powder puff: soft-attacked, wide, and airy. */
const dust = (b: Bus, at: number, size: number, amp: number): void => {
  const ts = kt(size)
  noise(b, { at, amp, mode: 'bp', f: 1500 * Math.sqrt(kf(size)), to: 1000, glide: 0.1 * ts, q: 0.6, attack: 0.012, decay: 0.07 * ts })
  noise(b, { at, amp: amp * 0.45, mode: 'lp', f: 700, q: 0.8, attack: 0.008, decay: 0.045 * ts })
  grains(b, {
    at: at + 0.01, dur: 0.14 * ts, amp: amp * 0.25, rate: 90, rateEnd: 20, lo: 2500, hi: 5000,
    tauLo: 0.0005, tauHi: 0.0015, pitched: 0.3, q: 1.5, swell: true
  })
}

/** Wings beating and running down: a gated noise band whose rate falls. */
const flutter = (b: Bus, at: number, amp: number, dur = 0.2, lo = 16, hi = 34, band = 2200): void => {
  noise(b, {
    at, amp, mode: 'bp', f: band, to: band * 0.68, glide: dur, q: 1.3,
    attack: 0.005, hold: dur * 0.4, decay: dur * 0.35,
    amRate: hi, amTo: lo, amDepth: 0.9, amJitter: 0.15, amSharp: 2.5
  })
}

// ─── Materials: party ───────────────────────────────────────────────────────

/** Paper crunching: soft noise grains and a crinkly rustle over them. */
const paper = (b: Bus, at: number, amp: number, dur: number, density = 1, lo = 1400, hi = 5600): void => {
  grains(b, {
    at, dur, amp, rate: 380 * density, rateEnd: 40 * density, lo, hi,
    tauLo: 0.0006, tauHi: 0.0026, pitched: 0.08, q: 1.3
  })
  noise(b, {
    at, amp: amp * 0.3, mode: 'bp', f: Math.sqrt(lo * hi), to: Math.sqrt(lo * hi) * 0.75, glide: dur, q: 0.8,
    attack: 0.002, hold: dur * 0.2, decay: dur * 0.35, amRate: 95, amDepth: 0.75, amJitter: 0.9, amSharp: 2
  })
}

/** Hard candy raining onto a floor: each piece rings, bounces and settles. */
const candy = (b: Bus, at: number, amp: number, pieces: number, spread: number): void => {
  for (let i = 0; i < pieces; i++) {
    let t = at + Math.pow(b.rnd(), 1.3) * spread
    let g = amp * range(b, 0.5, 1)
    const f = logRange(b, 2000, 4000)
    const bounces = 1 + Math.floor(b.rnd() * 3)
    let gap = range(b, 0.03, 0.06)
    for (let j = 0; j < bounces; j++) {
      modal(b, {
        at: t, amp: g, f: jit(b, f, 0.03), decay: range(b, 0.005, 0.01), attack: 0.0002,
        modes: [[1, 1, 1], [2.3, 0.5, 0.6], [3.8, 0.2, 0.4]]
      })
      t += gap
      gap *= 0.62
      g *= 0.5
    }
  }
}

/** A party popper: the snap, the pop, and — for a big one — a slide whistle. */
const popper = (b: Bus, at: number, amp: number, pitch = 1, whee = 0): void => {
  noise(b, { at, amp, mode: 'hp', f: 1400, q: 0.7, attack: 0.0002, decay: 0.003 })
  noise(b, { at, amp: amp * 0.5, mode: 'bp', f: 900 * pitch, q: 1.5, attack: 0.0004, decay: 0.012 })
  tone(b, { at: at + 0.002, amp: amp * 0.55, f: 520 * pitch, to: 1450 * pitch, glide: 0.018, attack: 0.001, decay: 0.016, harm: [[2, 0.25]] })
  if (whee) {
    tone(b, {
      at: at + 0.05, amp: amp * whee, f: 950 * pitch, to: 1650 * pitch, glide: 0.14,
      attack: 0.02, hold: 0.06, decay: 0.05, vibRate: 7, vibDepth: 0.02, vibDecay: 1, harm: [[2, 0.08]]
    })
  }
}

/** Cardboard: a dry, woody crack — the confetti world's shell. */
const cardboard = (b: Bus, at: number, size: number, amp: number, stages = 1): void => {
  const kp = Math.sqrt(kf(size))
  let t = at
  for (let s = 0; s < stages; s++) {
    const g = amp * (s === stages - 1 ? 1 : 0.7)
    noise(b, { at: t, amp: g * 0.9, mode: 'bp', f: 1300 * kp, q: 1, attack: 0.0003, decay: 0.006 })
    modal(b, { at: t, amp: g * 0.45, f: jit(b, 520 * kp, 0.08), decay: 0.02, attack: 0.0004, modes: [[1, 1, 1], [2.7, 0.4, 0.5], [4.2, 0.15, 0.3]] })
    t += range(b, 0.02, 0.035)
  }
}

/** Foil crinkle: paper's metal cousin — the grains ring. */
const foil = (b: Bus, at: number, amp: number, dur: number): void => {
  grains(b, {
    at, dur, amp, rate: 420, rateEnd: 40, lo: 2500, hi: 6200,
    tauLo: 0.0006, tauHi: 0.002, pitched: 0.7, q: 2
  })
}

/**
 * Tiny feet getting away: a run of very short, soft ticks that spread out and
 * fade, every other step doubled by a lighter one — six legs, not one. Kept in
 * the phone band (2-4.5 kHz) and far under a crack's level, so it reads as a
 * scurry and never as a crackle. `paper` widens the band for the confetti world,
 * where the feet are paper ones.
 */
const scurry = (b: Bus, at: number, amp: number, steps: number, gap: number, paper = false): void => {
  let t = at
  const f0 = paper ? 2200 : 3200
  const q = paper ? 1.4 : 3
  for (let i = 0; i < steps; i++) {
    const u = i / steps
    const g = amp * range(b, 0.6, 1) * (1 - 0.75 * u)
    noise(b, { at: t, amp: g, mode: 'bp', f: jit(b, f0, 0.25), q, attack: 0.0004, decay: 0.004 })
    if (i % 2 === 0) {
      noise(b, { at: t + gap * 0.4, amp: g * 0.5, mode: 'bp', f: jit(b, f0 * 1.3, 0.2), q, attack: 0.0004, decay: 0.003 })
    }
    t += gap * range(b, 0.8, 1.2) * (1 + 0.4 * u)
  }
}

/** A string of cap pops rolling along — the confetti centipede. */
const caps = (b: Bus, at: number, amp: number, count: number, gap: number): void => {
  let t = at
  for (let i = 0; i < count; i++) {
    const g = amp * range(b, 0.7, 1) * (1 - 0.3 * i / count)
    noise(b, { at: t, amp: g, mode: 'hp', f: 1600, q: 0.7, attack: 0.0002, decay: 0.0025 })
    noise(b, { at: t, amp: g * 0.45, mode: 'bp', f: jit(b, 1500, 0.2), q: 2, attack: 0.0003, decay: 0.008 })
    t += gap * range(b, 0.8, 1.15) * (1 - 0.25 * i / count)
  }
}

/** The party blower's raspberry — the confetti stinkbug. */
const blower = (b: Bus, at: number, amp: number, dur: number): void => {
  buzz(b, {
    at, dur, amp: amp * 0.8, rate: range(b, 68, 78), rateTo: range(b, 52, 60), jitter: 0.08,
    f: 1150, fTo: 900, q: 3.2, attack: 0.015, release: dur * 0.3, breath: 0.1
  })
  noise(b, {
    at, amp: amp * 0.3, mode: 'bp', f: 2600, q: 1.2, attack: 0.01, hold: dur * 0.5, decay: dur * 0.25,
    amRate: 60, amDepth: 0.6, amJitter: 0.4
  })
}

// ─── Materials: soap ────────────────────────────────────────────────────────

/** A soap bubble popping: a soft-attacked rising blip and a breath of air.
 *  The soft attack is the whole point — no crack, nothing crisp, nothing wet. */
const soap = (b: Bus, at: number, f: number, amp: number, size = 1): void => {
  const d = 0.03 * Math.sqrt(size)
  tone(b, { at, amp, f, rise: range(b, 0.45, 0.75), riseT: d * 0.8, attack: 0.003, decay: d, harm: [[2, 0.1]] })
  noise(b, { at, amp: amp * 0.12, mode: 'bp', f: Math.min(5000, f * 2.2), q: 0.7, attack: 0.0015, decay: 0.006 })
}

/** Pentatonic ratios — a run of soap pops that is a tiny tune, never a clash. */
const PENTA = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3, 2, 9 / 4, 5 / 2]

const soapRun = (b: Bus, at: number, root: number, amp: number, count: number, gap: number, up: boolean): void => {
  for (let i = 0; i < count; i++) {
    const r = PENTA[up ? i % PENTA.length : (count - 1 - i) % PENTA.length]!
    soap(b, at + i * gap * range(b, 0.9, 1.1), root * r, amp * range(b, 0.75, 1) * (1 - 0.3 * i / count), 0.8)
  }
}

/** A big wobbly bubble — a stinkbug, a beetle, a boss in soap. */
const bloop = (b: Bus, at: number, f: number, amp: number, size = 1, wobble = 0.05): void => {
  tone(b, {
    at, amp, f, rise: 0.7, riseT: 0.04 * size, attack: 0.006, decay: 0.06 * size,
    vibRate: 9, vibDepth: wobble, vibDecay: 0.08 * size, harm: [[2, 0.14]]
  })
}

/** The bubble-style ricochet: a rubbery bonk. */
const bonk = (b: Bus, at: number, amp: number, f = 520): void => {
  tone(b, { at, amp, f, to: f * 0.72, glide: 0.08, attack: 0.003, decay: 0.04, vibRate: 18, vibDepth: 0.05, vibDecay: 0.05, harm: [[2, 0.2]] })
}

// ─── Ricochets ──────────────────────────────────────────────────────────────

/** A blow bouncing off chitin: a hollow knock, a small tick, and a tiny falling
 *  "nope" glide under it — the only musical hint that the tool was wrong. */
const shellClang = (b: Bus, size: number, amp = 1): void => {
  const kp = Math.pow(kf(size), 0.5)
  modal(b, { at: 0, amp: amp * 0.7, f: jit(b, 660 * kp, 0.05), decay: 0.026, attack: 0.0005, modes: [[1, 1, 1], [2.05, 0.5, 0.6], [3.4, 0.28, 0.4]] })
  tone(b, { at: 0, amp: amp * 0.35, f: jit(b, 3100, 0.05), attack: 0.0003, decay: 0.003 })
  tone(b, { at: 0.012, amp: amp * 0.16, f: 1100 * kp, to: 720 * kp, glide: 0.06, attack: 0.004, decay: 0.03 })
}

/** A blow bouncing off a machine: a clean metal tink, softened. Partials are
 *  kept under ~5 kHz and the attack is rounded so it rings rather than stabs. */
const metalClang = (b: Bus, size: number, amp = 1): void => {
  const kp = Math.pow(kf(size), 0.5)
  modal(b, {
    at: 0, amp: amp * 0.6, f: jit(b, 1150 * kp, 0.04), decay: 0.045, attack: 0.0008,
    modes: [[1, 1, 1], [1.5, 0.3, 0.8], [2.76, 0.42, 0.5], [4.1, 0.12, 0.3]]
  })
  noise(b, { at: 0, amp: amp * 0.35, mode: 'hp', f: 2000, q: 0.7, attack: 0.0003, decay: 0.002 })
  tone(b, { at: 0.012, amp: amp * 0.14, f: 1300 * kp, to: 860 * kp, glide: 0.06, attack: 0.004, decay: 0.03 })
}

/** Ricochet, per style and material. */
const clangFor = (b: Bus, style: JuiceStyleId, size: number, metal: boolean): void => {
  if (style === 'bubble') { bonk(b, 0, 0.8, metal ? 600 : 480); return }
  if (style === 'confetti' && !metal) {
    cardboard(b, 0, size, 0.7)
    tone(b, { at: 0.012, amp: 0.12, f: 1000, to: 680, glide: 0.06, attack: 0.004, decay: 0.03 })
    return
  }
  if (metal) metalClang(b, size)
  else shellClang(b, size)
}

/** A soft body taking a blow and living — a squeeze with no release. */
const softHurt = (b: Bus, style: JuiceStyleId, size: number): void => {
  if (style === 'bubble') { soap(b, 0, 700 * kf(size), 0.7, 1.2); return }
  if (style === 'confetti') { paper(b, 0, 0.6, 0.05, 0.7); return }
  wet(b, 0, size, 0.8, { plop: 0, bubbles: 1, drips: 0, long: 0.6, slosh: 0.3, thump: 0.4 })
}

// ─── The recipes ────────────────────────────────────────────────────────────

type Recipe = (b: Bus, kind: CrushKind, heavy: boolean) => void
interface RecipeSet { ooze: Recipe; confetti: Recipe; bubble: Recipe }

/**
 * Build a set whose `hurt` and `clang` fall back to the material defaults, so
 * a body only spells out the kinds it genuinely has an opinion about.
 */
const body = (
  size: number,
  metal: boolean,
  crush: RecipeSet,
  hurt?: Partial<RecipeSet>
): RecipeSet => {
  const wrap = (style: JuiceStyleId): Recipe => (b, kind, heavy) => {
    if (kind === 'crush') { crush[style](b, kind, heavy); return }
    if (kind === 'clang') { clangFor(b, style, size, metal); return }
    const h = hurt?.[style]
    if (h) h(b, kind, heavy)
    else softHurt(b, style, size)
  }
  return { ooze: wrap('ooze'), confetti: wrap('confetti'), bubble: wrap('bubble') }
}

const RECIPES: { readonly [K in CrushSubject]?: RecipeSet } = {
  // ── The ant: the classic. Everything else is measured against this. ──
  ant: body(0.8, false, {
    ooze: (b, _k, heavy) => {
      const s = heavy ? 1 : 0.8
      wet(b, 0, s, 1, { plop: 0.9, bubbles: heavy ? 6 : 4, drips: heavy ? 2 : 1, slosh: 0.45, q: 7, thump: heavy ? 0.6 : 0.3 })
    },
    confetti: (b, _k, heavy) => {
      popper(b, 0, 0.8, 1.3)
      paper(b, 0.004, 0.6, heavy ? 0.1 : 0.06, heavy ? 1.1 : 0.8, 2200, 6000)
    },
    bubble: (b, _k, heavy) => {
      soap(b, 0, jit(b, 1150, 0.06), 0.8)
      soap(b, 0.03, jit(b, 1700, 0.06), 0.45, 0.7)
      if (heavy) soap(b, 0.06, jit(b, 1450, 0.06), 0.35, 0.7)
    }
  }),

  // ── The sprinter: the ant, zippier. It was running when it went. ──
  sprinter: body(0.72, false, {
    ooze: (b, _k, heavy) => {
      // Brighter, tighter and quicker than the ant in every layer, led by a
      // zip and closed by a second pop hard on the first: "pip-pip".
      zip(b, 0, 0.6, heavy ? 0.04 : 0.032)
      wet(b, 0.014, heavy ? 0.85 : 0.7, 0.9, { plop: 1, bubbles: heavy ? 4 : 3, drips: 0, slosh: 0.25, q: 9, pitch: 1.35, long: 0.65, thump: heavy ? 0.4 : 0.15 })
      tone(b, { at: 0.04, amp: 0.55, f: 1400, to: 3300, glide: 0.01, attack: 0.001, decay: 0.008, harm: [[2, 0.15]] })
    },
    confetti: (b, _k, heavy) => {
      zip(b, 0, 0.8, 0.045)
      popper(b, 0.04, 0.8, 1.45)
      paper(b, 0.044, 0.4, heavy ? 0.07 : 0.045, 0.8, 2400, 6000)
    },
    bubble: (b, _k, heavy) => {
      soap(b, 0, jit(b, 1250, 0.05), 0.75, 0.8)
      soap(b, 0.028, jit(b, 1650, 0.05), 0.6, 0.7)
      soap(b, 0.055, jit(b, 2100, 0.05), heavy ? 0.5 : 0.4, 0.6)
    }
  }),

  // ── The flea: a crisp tick, a micro-pop, gone. ──
  flea: body(0.6, false, {
    // The smallest, crispest thing in the game: the tick IS the flea, and the
    // wet is a single high bead behind it — over before a sprinter's zip is.
    ooze: (b, _k, heavy) => {
      tick(b, 0, 1, jit(b, 4800, 0.08))
      wet(b, 0.004, heavy ? 0.65 : 0.55, 0.5, { plop: 0.7, bubbles: heavy ? 2 : 1, drips: 0, slosh: 0.15, q: 10, long: 0.4, pitch: 1.6, squelch: 0.4 })
    },
    confetti: (b, _k, heavy) => {
      tick(b, 0, 0.9, 3800)
      paper(b, 0.003, 0.45, heavy ? 0.05 : 0.03, 0.6, 2800, 6400)
    },
    bubble: (b, _k, heavy) => {
      soap(b, 0, jit(b, 2100, 0.06), 0.7, 0.5)
      if (heavy) soap(b, 0.025, jit(b, 2600, 0.06), 0.4, 0.4)
    }
  }),

  // ── The caterpillar: a plush toy squashed, bristles prickling. ──
  caterpillar: body(1.1, false, {
    ooze: (b, _k, heavy) => {
      plush(b, 0, heavy ? 1.3 : 1.1, 0.9)
      wet(b, 0.01, heavy ? 1.3 : 1.1, 0.75, { plop: 0.3, bubbles: heavy ? 5 : 4, drips: 1, slosh: 0.7, q: 3.2, long: 1.3, pitch: 0.9 })
      bristles(b, 0.006, 0.28, heavy ? 0.26 : 0.2)
    },
    confetti: (b, _k, heavy) => {
      plush(b, 0, 1.1, 0.4)
      noise(b, { at: 0, amp: 0.6, mode: 'bp', f: 1800, to: 1100, glide: 0.2, q: 0.7, attack: 0.012, hold: 0.04, decay: 0.06, amRate: 70, amDepth: 0.6, amJitter: 0.9, amSharp: 2 })
      paper(b, 0.01, 0.45, heavy ? 0.22 : 0.18, 0.7, 800, 3200)
      bristles(b, 0.01, 0.3, 0.18)
    },
    bubble: (b, _k, heavy) => {
      const n = heavy ? 9 : 7
      for (let i = 0; i < n; i++) soap(b, Math.pow(b.rnd(), 1.2) * 0.2, logRange(b, 600, 1100), 0.45 * range(b, 0.6, 1), 1.1)
      noise(b, { at: 0, amp: 0.06, mode: 'bp', f: 2600, q: 0.6, attack: 0.02, hold: 0.06, decay: 0.06 })
    }
  }),

  // ── The stinkbug: a squelch and the last word. ──
  stinkbug: body(1.0, false, {
    ooze: (b, _k, heavy) => {
      wet(b, 0, heavy ? 1.15 : 1.0, 0.55, { plop: 0.7, bubbles: 3, drips: 0, slosh: 0.5, q: 5, long: 0.8, thump: heavy ? 0.4 : 0.2 })
      pfft(b, jit(b, 0.055, 0.15), 1.0, 2, heavy ? 1.25 : 1)
    },
    confetti: (b, _k, heavy) => {
      popper(b, 0, 0.7, 1)
      blower(b, 0.04, 0.7, heavy ? 0.32 : 0.26)
    },
    bubble: (b, _k, heavy) => {
      // The big wobbly bubble, and a sigh of air as it goes — a narrow, soft
      // band, because anything broader is the ooze stinkbug's raspberry again.
      bloop(b, 0, jit(b, 420, 0.06), 0.8, heavy ? 1.3 : 1.1, 0.09)
      noise(b, { at: 0.05, amp: 0.1, mode: 'bp', f: 900, to: 700, glide: 0.2, q: 2.5, attack: 0.03, hold: 0.05, decay: 0.07 })
    }
  }),

  // ── The centipede: comes apart one segment at a time. ──
  centipede: body(0.8, false, {
    ooze: (b, _k, heavy) => {
      wet(b, 0, 0.8, 0.5, { plop: 0, bubbles: 2, drips: 0, long: 0.6, slosh: 0.4, q: 6 })
      ripple(b, 0.006, 0.8, 1, heavy ? 9 : 6, { wet: 0.5 })
      const end = (heavy ? 9 : 6) * 0.022
      for (let i = 0; i < 3; i++) bubble(b, end + b.rnd() * 0.05, logRange(b, 1800, 3600), 0.35)
    },
    confetti: (b, _k, heavy) => {
      caps(b, 0, 0.9, heavy ? 9 : 6, 0.026)
      paper(b, 0.03, 0.35, 0.12, 0.7, 2000, 5600)
    },
    bubble: (b, _k, heavy) => {
      soapRun(b, 0, jit(b, 700, 0.04), 0.65, heavy ? 8 : 6, 0.03, b.rnd() < 0.5)
    }
  }),

  // ── The piñata: it was always a party. ──
  pinatafly: body(0.95, false, {
    // In ooze the piñata is still a piñata — but a sticky one: a thick honey
    // squelch under the paper, and the candy lands in it. Confetti is the dry,
    // bright, all-paper party.
    ooze: (b, _k, heavy) => {
      popper(b, 0, 0.7, 0.9, heavy ? 0.3 : 0)
      wet(b, 0.006, 1.2, 0.75, { plop: 0.4, bubbles: 5, drips: 1, slosh: 0.7, long: 1.1, q: 3.2, pitch: 0.85, thump: 0.3 })
      paper(b, 0.004, 0.45, heavy ? 0.12 : 0.09, heavy ? 1.2 : 0.9, 1200, 4200)
      candy(b, 0.04, 0.35, heavy ? 12 : 9, heavy ? 0.28 : 0.22)
    },
    confetti: (b, _k, heavy) => {
      popper(b, 0, 0.9, 1.1, heavy ? 0.4 : 0.22)
      paper(b, 0.004, 0.8, heavy ? 0.2 : 0.15, 1.4, 1500, 6000)
      candy(b, 0.03, 0.45, heavy ? 14 : 11, 0.28)
    },
    bubble: (b, _k, heavy) => {
      soapRun(b, 0, jit(b, 1400, 0.03), 0.55, heavy ? 8 : 6, 0.035, false)
      for (let i = 0; i < 3; i++) soap(b, 0.02 + b.rnd() * 0.2, logRange(b, 2400, 3200), 0.2, 0.5)
    }
  }, {
    // Five hits to open. Each one has to sound like progress, and like a
    // piñata: a papery thwack and the candy shifting inside — no pop yet.
    ooze: (b, _k, heavy) => {
      noise(b, { at: 0, amp: 0.8, mode: 'bp', f: 1100, q: 0.9, attack: 0.0005, decay: heavy ? 0.03 : 0.022 })
      paper(b, 0.002, 0.45, 0.05, 0.8, 1300, 4500)
      candy(b, 0.015, 0.35, heavy ? 6 : 4, 0.1)
    },
    confetti: (b, _k, heavy) => {
      noise(b, { at: 0, amp: 0.8, mode: 'bp', f: 1200, q: 0.9, attack: 0.0005, decay: 0.022 })
      candy(b, 0.015, 0.35, heavy ? 6 : 4, 0.1)
    },
    bubble: (b, _k, heavy) => {
      soap(b, 0, jit(b, 900, 0.05), 0.6, 1)
      soap(b, 0.04, jit(b, 1350, 0.05), heavy ? 0.4 : 0.3, 0.7)
    }
  }),

  // ── The moth: a puff of dust and wings winding down. ──
  moth: body(1.15, false, {
    ooze: (b, _k, heavy) => {
      dust(b, 0, heavy ? 1.3 : 1.15, 0.5)
      flutter(b, 0.015, 0.95, heavy ? 0.26 : 0.2)
      wet(b, 0.004, 0.95, 0.4, { plop: 0.5, bubbles: 2, drips: 0, long: 0.6, q: 5 })
    },
    // Tissue paper, not dust: a higher, crinklier flutter with no puff under it.
    confetti: (b, _k, heavy) => {
      flutter(b, 0, 0.8, heavy ? 0.3 : 0.24, 16, 36, 3800)
      paper(b, 0.004, 0.5, heavy ? 0.2 : 0.16, 0.9, 2600, 6200)
    },
    bubble: (b, _k, heavy) => {
      noise(b, { at: 0, amp: 0.08, mode: 'bp', f: 1400, q: 2, attack: 0.015, decay: 0.05 })
      const n = heavy ? 18 : 14
      for (let i = 0; i < n; i++) soap(b, Math.pow(b.rnd(), 0.9) * 0.24, logRange(b, 2200, 3600), 0.18 * range(b, 0.5, 1), 0.4)
    }
  }, {
    // Knocked out of the air, not squashed: a startled flap and a little puff
    // of dust off the wings — short, because a moth takes two hits.
    ooze: (b, _k, heavy) => {
      noise(b, { at: 0, amp: 0.45, mode: 'bp', f: 1300, q: 0.9, attack: 0.008, decay: 0.03 })
      flutter(b, 0.006, 0.9, heavy ? 0.13 : 0.1, 26, 40)
    },
    confetti: (b) => { flutter(b, 0, 0.7, 0.14, 20, 36) },
    bubble: (b) => { soap(b, 0, jit(b, 1500, 0.05), 0.4, 0.6); soap(b, 0.03, jit(b, 1900, 0.05), 0.25, 0.5) }
  }),

  // ── The beetle: the shell, THEN the goo. The best crush in the game. ──
  beetle: body(1.25, false, {
    ooze: (b, _k, heavy) => {
      if (heavy) {
        // The charged slam that earns the whole mechanic: the shell goes in two
        // stages, the crackle runs long, a sub lands under it and the goo
        // gushes after a beat — the ear has to hear the shell LOSE before it
        // hears what was inside.
        shell(b, 0, 1.25, 0.8, { stages: 2, grains: 1.9, tok: 0.4, crunch: 0.55 })
        tone(b, { at: 0.002, amp: 0.3, f: 78, to: 44, glide: 0.16, attack: 0.002, decay: 0.08, harm: [[2, 0.45], [3, 0.15]] })
        wet(b, 0.045, 1.45, 0.8, { plop: 0.45, bubbles: 9, drips: 3, slosh: 0.65, q: 5.5, long: 1.35, thump: 0.35 })
      } else {
        shell(b, 0, 1.2, 0.95, { stages: 1, grains: 1.1, tok: 0.4, crunch: 0.35 })
        wet(b, 0.032, 1.25, 0.7, { plop: 0.4, bubbles: 6, drips: 2, slosh: 0.6, q: 5.5, long: 1.1, thump: 0.25 })
      }
    },
    confetti: (b, _k, heavy) => {
      cardboard(b, 0, 1.25, 1, heavy ? 2 : 1)
      modal(b, { at: 0.002, amp: 0.7, f: jit(b, 260, 0.06), decay: 0.024, attack: 0.001, modes: [[1, 1, 1], [1.7, 0.6, 0.7], [2.9, 0.3, 0.5]] })
      paper(b, 0.012, 0.45, heavy ? 0.18 : 0.12, heavy ? 1.2 : 0.9, 600, 2800)
      if (heavy) popper(b, 0.06, 0.6, 0.85, 0.25)
    },
    bubble: (b, _k, heavy) => {
      bloop(b, 0, jit(b, heavy ? 320 : 380, 0.05), 0.8, heavy ? 1.4 : 1.1)
      const n = heavy ? 9 : 6
      for (let i = 0; i < n; i++) soap(b, 0.05 + Math.pow(b.rnd(), 1.5) * 0.1, logRange(b, 1400, 2600), 0.3, 0.5)
    }
  }, {
    // Shell cracked, beetle alive: the crack and the tok, no goo. A slam that
    // did not finish it cracks further — two stages, more crackle.
    ooze: (b, _k, heavy) => {
      shell(b, 0, 1.2, 1, { stages: heavy ? 2 : 1, grains: heavy ? 1.2 : 0.75, tok: 0.5, crunch: heavy ? 0.4 : 0.25, long: 0.8 })
    },
    confetti: (b, _k, heavy) => {
      cardboard(b, 0, 1.25, 0.9, heavy ? 2 : 1)
      paper(b, 0.006, 0.35, 0.05, 0.6, 900, 3600)
    },
    bubble: (b, _k, heavy) => {
      bloop(b, 0, jit(b, 480, 0.05), 0.6, 0.6, 0.03)
      if (heavy) soap(b, 0.03, jit(b, 900, 0.05), 0.3, 0.6)
    }
  }),

  // ── The robobug: a toy machine coming apart. ──
  robobug: body(1.1, true, {
    ooze: (b, _k, heavy) => {
      tin(b, 0, 1.1, 1, heavy ? 1.5 : 1.1, heavy ? 0.35 : 0.25)
      sparks(b, 0.012, heavy ? 0.8 : 0.7, heavy ? 0.22 : 0.14)
      boing(b, jit(b, 0.05, 0.2), 1.1, heavy ? 0.45 : 0.38)
      splutter(b, jit(b, 0.1, 0.15), 1.1, 0.55, heavy ? 5 : 3)
    },
    confetti: (b, _k, heavy) => {
      foil(b, 0, 0.9, heavy ? 0.16 : 0.12)
      boing(b, 0.035, 1.1, 0.55)
      popper(b, 0.09, 0.5, 1.2, heavy ? 0.2 : 0)
    },
    bubble: (b, _k, heavy) => {
      tone(b, { at: 0, amp: 0.7, f: jit(b, 480, 0.05), rise: 0.3, riseT: 0.03, attack: 0.004, decay: 0.09, vibRate: 8, vibDepth: 0.22, vibDecay: 0.2, harm: [[2, 0.3], [3, 0.1]] })
      soap(b, 0.07, jit(b, 1300, 0.05), 0.35, 0.7)
      soap(b, 0.1, jit(b, 1750, 0.05), heavy ? 0.35 : 0.25, 0.6)
    }
  }, {
    ooze: (b, _k, heavy) => {
      tin(b, 0, 1.1, 0.95, heavy ? 0.8 : 0.55, 0.25)
      sparks(b, 0.01, 0.5, heavy ? 0.08 : 0.05)
    },
    confetti: (b, _k, heavy) => {
      foil(b, 0, 0.8, heavy ? 0.08 : 0.06)
      tone(b, { at: 0, amp: 0.3, f: 520, to: 470, glide: 0.05, attack: 0.001, decay: 0.03, harm: [[2.76, 0.3]] })
    },
    bubble: (b) => {
      tone(b, { at: 0, amp: 0.6, f: jit(b, 420, 0.05), attack: 0.004, decay: 0.05, vibRate: 14, vibDepth: 0.08, vibDecay: 0.06 })
    }
  }),

  // ── A boss egg ──
  pod: body(1.0, false, {
    ooze: (b) => {
      // An egg: a thin, high, hollow crack first — then what was in it.
      shell(b, 0, 0.9, 1, { stages: 1, grains: 0.9, tok: 0.55, crunch: 0.1, pitch: 1.5, long: 0.6 })
      wet(b, 0.03, 1.0, 0.7, { plop: 0.6, bubbles: 5, drips: 2, slosh: 0.55, q: 6 })
    },
    confetti: (b) => {
      cardboard(b, 0, 0.8, 0.7)
      popper(b, 0.02, 0.7, 1)
      paper(b, 0.024, 0.4, 0.1, 0.9)
      candy(b, 0.05, 0.4, 5, 0.12)
    },
    bubble: (b) => {
      soap(b, 0, jit(b, 700, 0.04), 0.7, 0.8)
      soap(b, 0.045, jit(b, 1050, 0.04), 0.6, 0.7)
    }
  }),

  // ── An egg hatching: the shell gives from inside, and the ants run ──
  //
  // The pod's crush turned inside out. The pop is a shell and then GOO — the
  // player did it; this is two small pecks, the split, and feet — it happened
  // without them. Two sounds a player can tell apart with their eyes shut is the
  // whole point: one is a reward, the other is "some ants just got out".
  hatch: body(0.7, false, {
    ooze: (b) => {
      shell(b, 0, 0.6, 0.4, { stages: 1, grains: 0.35, tok: 0.2, crunch: 0, pitch: 1.9, long: 0.35 })
      shell(b, 0.075, 0.6, 0.5, { stages: 1, grains: 0.45, tok: 0.25, crunch: 0, pitch: 1.8, long: 0.4 })
      shell(b, 0.16, 0.8, 1, { stages: 2, grains: 0.85, tok: 0.45, crunch: 0.05, pitch: 1.5, long: 0.6 })
      scurry(b, 0.25, 0.42, 14, 0.021)
    },
    confetti: (b) => {
      cardboard(b, 0, 0.5, 0.4)
      cardboard(b, 0.08, 0.6, 0.8, 2)
      popper(b, 0.16, 0.4, 1.4)
      scurry(b, 0.23, 0.4, 12, 0.024, true)
    },
    bubble: (b) => {
      soap(b, 0, jit(b, 900, 0.04), 0.4, 0.6)
      soap(b, 0.08, jit(b, 1100, 0.04), 0.5, 0.6)
      bloop(b, 0.15, jit(b, 520, 0.04), 0.7, 0.8)
      soapRun(b, 0.24, 1300, 0.3, 6, 0.03, true)
    }
  }),

  // ── The bosses: the same materials at boss size, each with a trick. ──

  // The queen is a jelly: huge, wobbly, and very, very wet.
  queenAnt: body(2.2, false, {
    ooze: (b) => {
      tone(b, { at: 0.004, amp: 0.55, f: 120, to: 70, glide: 0.25, attack: 0.004, decay: 0.12, vibRate: 7, vibDepth: 0.06, vibDecay: 0.3, harm: [[2, 0.5], [3, 0.2]] })
      wet(b, 0, 2.2, 1, { plop: 1, bubbles: 14, drips: 4, slosh: 0.65, q: 6, thump: 0.8 })
      wet(b, 0.09, 1.4, 0.55, { plop: 0.5, bubbles: 6, drips: 0, slosh: 0.5, q: 6 })
    },
    confetti: (b) => {
      popper(b, 0, 1, 0.75, 0.45)
      paper(b, 0.004, 0.8, 0.3, 1.6, 1200, 5600)
      candy(b, 0.05, 0.4, 18, 0.35)
    },
    bubble: (b) => {
      bloop(b, 0, jit(b, 260, 0.04), 0.8, 2, 0.08)
      soapRun(b, 0.08, 520, 0.4, 6, 0.045, true)
    }
  }, {
    ooze: (b) => {
      tone(b, { at: 0, amp: 0.7, f: 150, to: 105, glide: 0.12, attack: 0.003, decay: 0.07, vibRate: 7, vibDepth: 0.06, vibDecay: 0.2, harm: [[2, 0.5], [3, 0.2]] })
      wet(b, 0.004, 1.8, 0.7, { plop: 0, bubbles: 3, drips: 0, long: 0.6, slosh: 0.5, q: 5 })
    },
    confetti: (b) => { noise(b, { at: 0, amp: 0.8, mode: 'bp', f: 900, q: 0.9, attack: 0.0006, decay: 0.035 }); paper(b, 0.004, 0.4, 0.08, 0.8) },
    bubble: (b) => { bloop(b, 0, jit(b, 300, 0.04), 0.7, 1.2, 0.08) }
  }),

  // The king is armour: the shell goes in three stages before the goo.
  beetleKing: body(2.4, false, {
    ooze: (b) => {
      shell(b, 0, 2.4, 1, { stages: 3, grains: 2.2, tok: 0.55, crunch: 0.6, long: 1.3 })
      tone(b, { at: 0.004, amp: 0.55, f: 66, to: 38, glide: 0.25, attack: 0.003, decay: 0.12, harm: [[2, 0.4], [3, 0.15]] })
      wet(b, 0.1, 2.2, 0.85, { plop: 0.5, bubbles: 12, drips: 3, slosh: 0.65, q: 5, long: 1.2, thump: 0.4 })
    },
    confetti: (b) => {
      cardboard(b, 0, 2.2, 1, 3)
      paper(b, 0.02, 0.8, 0.32, 1.6, 900, 4400)
      popper(b, 0.12, 0.7, 0.8, 0.35)
    },
    bubble: (b) => {
      bloop(b, 0, jit(b, 220, 0.04), 0.85, 2.2, 0.04)
      for (let i = 0; i < 6; i++) soap(b, 0.06 + b.rnd() * 0.25, logRange(b, 600, 1400), 0.3, 1)
    }
  }, {
    ooze: (b) => { shell(b, 0, 2.3, 1, { stages: 2, grains: 1.4, tok: 0.6, crunch: 0.5 }) },
    confetti: (b) => { cardboard(b, 0, 2.2, 1, 2) },
    bubble: (b) => { bloop(b, 0, jit(b, 300, 0.04), 0.7, 0.9, 0.03) }
  }),

  // The matriarch is a long, long ripple.
  matriarch: body(1.8, false, {
    ooze: (b) => {
      ripple(b, 0, 1.6, 1, 13, { wet: 0.55, gap: 0.03, dir: -1 })
      wet(b, 0.3, 1.8, 0.8, { plop: 0.6, bubbles: 9, drips: 3, slosh: 0.6, q: 6, thump: 0.5 })
    },
    confetti: (b) => {
      caps(b, 0, 1, 14, 0.03)
      popper(b, 0.34, 0.8, 0.9, 0.3)
      paper(b, 0.34, 0.5, 0.2, 1.2)
    },
    bubble: (b) => { soapRun(b, 0, 440, 0.6, 12, 0.035, true) }
  }, {
    ooze: (b) => { ripple(b, 0, 1.8, 0.9, 4, { wet: 0.5, gap: 0.035 }); wet(b, 0.02, 1.5, 0.45, { plop: 0, bubbles: 2, drips: 0, long: 0.5 }) },
    confetti: (b) => { caps(b, 0, 0.9, 4, 0.035) },
    bubble: (b) => { soapRun(b, 0, 520, 0.55, 3, 0.04, true) }
  }),

  // Roach Prime is a machine, and it winds down like one.
  roachPrime: body(2.4, true, {
    ooze: (b) => {
      tin(b, 0, 2.4, 1, 2, 0.45)
      sparks(b, 0.01, 0.8, 0.34)
      boing(b, 0.06, 2.2, 0.5)
      splutter(b, 0.14, 2.0, 0.55, 7)
      tone(b, { at: 0.08, amp: 0.4, f: 520, to: 110, glide: 0.45, attack: 0.01, hold: 0.25, decay: 0.12, harm: [[2, 0.35], [3, 0.18], [4, 0.08]] })
    },
    confetti: (b) => {
      foil(b, 0, 1, 0.3)
      boing(b, 0.05, 2.2, 0.65)
      popper(b, 0.15, 0.8, 0.9, 0.4)
    },
    bubble: (b) => {
      tone(b, { at: 0, amp: 0.75, f: 200, rise: 0.5, riseT: 0.06, attack: 0.006, decay: 0.12, vibRate: 10, vibDepth: 0.12, vibDecay: 0.2, harm: [[2, 0.2]] })
      soapRun(b, 0.1, 600, 0.35, 5, 0.04, false)
    }
  }, {
    ooze: (b) => { tin(b, 0, 2.3, 1, 0.9, 0.4); sparks(b, 0.01, 0.55, 0.1) },
    confetti: (b) => { foil(b, 0, 0.9, 0.1); tone(b, { at: 0, amp: 0.35, f: 300, to: 270, glide: 0.06, attack: 0.001, decay: 0.05, harm: [[2.76, 0.3]] }) },
    bubble: (b) => { tone(b, { at: 0, amp: 0.65, f: 260, attack: 0.005, decay: 0.07, vibRate: 12, vibDepth: 0.1, vibDecay: 0.1 }) }
  })
}

/** Every subject the bank has a voice for. */
export const CRUSH_SUBJECTS: readonly CrushSubject[] = Object.keys(RECIPES) as CrushSubject[]

export const hasCrushVoice = (s: string): s is CrushSubject => s in RECIPES

// ─── Rendering ──────────────────────────────────────────────────────────────

export interface CrushSpec {
  subject: CrushSubject
  kind: CrushKind
  style: JuiceStyleId
  /** 0-based; wraps at `crushVariants()`. */
  variant: number
  heavy: boolean
  sampleRate: number
  /** Override the seed derived from the rest of the spec (tests). */
  seed?: number
}

/** The seed a spec renders from when none is given — stable across runs. */
export const crushSeed = (spec: Omit<CrushSpec, 'sampleRate' | 'seed'>): number => {
  const heavy = canonicalHeavy(spec.subject, spec.kind, spec.heavy)
  return hashString(`${spec.subject}|${spec.kind}|${spec.style}|${heavy ? 'H' : 'L'}|${spec.variant}`)
}

/** A crush being rendered a slice at a time. */
export interface CrushJob {
  /**
   * Do up to `budgetMs` of work. Returns the finished samples on the call that
   * completes the render, null while there is more to do. A single voice is
   * never split, so a slice can overrun by one voice (well under a millisecond
   * on a desktop, a few on a slow phone) — which is the point of voices being
   * small.
   */
  step: (budgetMs: number) => Float32Array | null
}

/**
 * Start rendering one crush in slices. The recipe runs immediately — it only
 * RECORDS its voices, which is cheap — and each `step` then runs recorded
 * sample loops until the budget is spent, with the master pass on a step of its
 * own. This is what lets the game fill its bank without a long task: a boss
 * crush that takes 15 ms in one go becomes five 3 ms slices between frames.
 */
export const startCrush = (spec: CrushSpec, now: () => number = () => performance.now()): CrushJob => {
  const sr = spec.sampleRate
  const heavy = canonicalHeavy(spec.subject, spec.kind, spec.heavy)
  const seed = spec.seed ?? crushSeed(spec)
  const jobs: Array<() => void> = []
  const bus: Bus = {
    out: new Float32Array(Math.ceil(maxSeconds(spec.subject, spec.kind) * sr)),
    sr,
    rnd: rngFrom(seed),
    jobs
  }
  const set = RECIPES[spec.subject] ?? RECIPES.ant!
  set[spec.style](bus, spec.kind, heavy)
  const target = levelDb(spec.subject, spec.kind, heavy)
  let next = 0
  return {
    step: (budgetMs) => {
      const t0 = now()
      const fresh = next === jobs.length
      while (next < jobs.length) {
        jobs[next++]!()
        if (now() - t0 >= budgetMs) return null
      }
      // The master pass is the single biggest piece of work, so it gets a slice
      // of its own — unless this slice ran voices and still has half its budget
      // left. A slice that STARTS with only the master pass to do always does
      // it: deferring it on elapsed time alone would never finish on a tiny
      // budget.
      if (!fresh && now() - t0 > budgetMs * 0.5) return null
      return finish(bus.out, sr, target)
    }
  }
}

/**
 * Render one crush in one go. Deterministic for a given spec: same inputs, same
 * samples — and the same samples `startCrush` produces in slices.
 */
export const renderCrush = (spec: CrushSpec): Float32Array =>
  startCrush(spec).step(Number.POSITIVE_INFINITY)!

// ─── Planning ───────────────────────────────────────────────────────────────

/** One buffer the runtime bank wants. */
export interface CrushSlot {
  subject: CrushSubject
  kind: CrushKind
  heavy: boolean
  variant: number
}

/** The bank key for a (subject, kind, heavy) triple, after canonicalising. */
export const crushSlotKey = (s: CrushSubject, kind: CrushKind, heavy: boolean): string =>
  `${s}|${kind}|${canonicalHeavy(s, kind, heavy) ? 'H' : 'L'}`

/**
 * Every buffer a set of subjects needs, in the order they are worth having:
 * one variant of each subject's everyday sound first (so every body on the
 * board has its own voice within a couple of idle slices), then the heavy
 * crush, then the rarer kinds, then the remaining variants.
 */
export const crushPlan = (subjects: readonly CrushSubject[]): CrushSlot[] => {
  const tiers: CrushSlot[][] = [[], [], [], []]
  const seen = new Set<string>()
  for (const s of subjects) {
    for (const kind of crushKindsFor(s)) {
      for (const heavy of [false, true]) {
        const h = canonicalHeavy(s, kind, heavy)
        const key = crushSlotKey(s, kind, h)
        if (seen.has(key)) continue
        seen.add(key)
        const n = crushVariants(s, kind, h)
        const tier = kind === 'crush' ? (h && !isBossSubject(s) ? 1 : 0) : 2
        for (let v = 0; v < n; v++) {
          tiers[v === 0 ? tier : 3]!.push({ subject: s, kind, heavy: h, variant: v })
        }
      }
    }
  }
  return tiers.flat()
}

/** Rough decoded size of a slot, bytes — for budgeting before rendering. */
export const estimateSlotBytes = (slot: CrushSlot, sampleRate = CRUSH_RENDER_RATE): number => {
  const typical = isBossSubject(slot.subject)
    ? (slot.kind === 'crush' ? 0.85 : 0.35)
    : slot.kind === 'crush' ? (slot.heavy ? 0.4 : 0.3) : slot.kind === 'hurt' ? 0.2 : 0.12
  return Math.ceil(typical * sampleRate) * 4
}
