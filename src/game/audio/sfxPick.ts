/**
 * ─── Picking a take from a rendered cue ─────────────────────────────────────
 *
 * Pure: no Web Audio, no DOM. The runtime (`useSfxSprites`) asks these what to
 * play and how; the tests ask them the same questions. The data they read is the
 * generated manifest (`sfxSprites.ts`, written by `pnpm audio:sfx -- --ship`).
 *
 *   rotate     a random take, never the same one twice in a row (the crush
 *              bank's rule), with a small playback-rate and gain jitter — the
 *              machine-gun test
 *   alternate  take 0, 1, 0, 1… (the clock's tick and tock)
 *   index      the take `power` names: `round(power × scale) + base`. The chain's
 *              fifteen rungs, the three stars, the tap-or-slam finisher. No
 *              jitter — these are NOTES, and a note must stay in tune.
 *   stack      the first n takes, staggered (one chime per body a stomp took)
 *   loop       the loop region, held while the caller keeps asking for it
 */

export type SfxPick = 'rotate' | 'alternate' | 'index' | 'stack' | 'loop'

export interface SfxSpriteSpec {
  /** File name under `audio/sfx/`, without `.ogg`. */
  file: string
  /** 1 = what the first level needs (loaded with the idle preload); 2 = the rest. */
  tier: number
  seconds: number
  bytes: number
}

export interface SfxCueSpec {
  sprite: string
  /** Gain that puts the cue at its target level in the mix, before the slider. */
  gain: number
  pick: SfxPick
  /** Each take: [offset, duration], seconds into the sprite. */
  slots: ReadonlyArray<readonly [number, number]>
  /** For `loop`: [loopStart, loopEnd], seconds into the sprite. */
  loop?: readonly [number, number]
  /** ± playback-rate jitter per shot (rotate / alternate only). */
  rate?: number
  /** Playback rate from `power`: [at 0, at 1]. */
  ratePower?: readonly [number, number]
  /** Gain multiplier from `power`: [at 0, at 1]. */
  gainPower?: readonly [number, number]
  /** `index`: slot = round(power × indexScale) + indexBase. Defaults: n − 1, 0. */
  indexScale?: number
  indexBase?: number
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v))
const p01 = (p: number): number => (Number.isFinite(p) ? clamp(p, 0, 1) : 0)

/**
 * Which take to play. `last` is the take this cue played last time (−1 for
 * none); `rnd` is a draw in [0, 1).
 */
export const pickSlot = (cue: SfxCueSpec, power: number, last: number, rnd: number): number => {
  const n = cue.slots.length
  if (n <= 1) return 0
  switch (cue.pick) {
    case 'index': {
      const scale = cue.indexScale ?? n - 1
      const base = cue.indexBase ?? 0
      return clamp(Math.round(p01(power) * scale) + base, 0, n - 1)
    }
    case 'alternate':
      return last < 0 ? 0 : (last + 1) % n
    case 'rotate': {
      let pick = clamp(Math.floor(rnd * n), 0, n - 1)
      if (pick === last) pick = (pick + 1) % n
      return pick
    }
    default:
      return 0
  }
}

/** How many takes a `stack` cue plays for `power` (the old synth's 2 + 4p). */
export const stackCount = (cue: SfxCueSpec, power: number): number =>
  clamp(2 + Math.round(p01(power) * 4), 1, cue.slots.length)

/** Playback rate for one shot. Notes (`index`, `stack`) never jitter. */
export const shotRate = (cue: SfxCueSpec, power: number, rnd: number): number => {
  let r = 1
  if (cue.ratePower) r *= cue.ratePower[0] + (cue.ratePower[1] - cue.ratePower[0]) * p01(power)
  if (cue.rate && (cue.pick === 'rotate' || cue.pick === 'alternate')) r *= 1 + cue.rate * (rnd * 2 - 1)
  return r
}

/** Gain for one shot, before the player's slider: the manifest gain, the
 *  power curve, and ±10 % jitter on the cues that rotate. */
export const shotGain = (cue: SfxCueSpec, power: number, rnd: number): number => {
  let g = cue.gain
  if (cue.gainPower) g *= cue.gainPower[0] + (cue.gainPower[1] - cue.gainPower[0]) * p01(power)
  if (cue.pick === 'rotate') g *= 0.9 + 0.2 * rnd
  return g
}

/** The sprite files of a tier, in manifest order. */
export const spritesOfTier = (sprites: Readonly<Record<string, SfxSpriteSpec>>, tier: number): string[] =>
  Object.keys(sprites).filter((id) => sprites[id]!.tier === tier)
