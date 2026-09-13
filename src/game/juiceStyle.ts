/**
 * ─── Juice Style ────────────────────────────────────────────────────────────
 *
 * GDD §2.2 and §10.2. Three ways of drawing the same event, so that a player
 * who finds squishing bugs unpleasant — a six-year-old, a squeamish adult, a
 * parent watching over a shoulder — can keep the game rather than close it.
 *
 * THE RULE: a style changes the PICTURE and the SOUND, never a number. Every
 * radius, every score, every hitbox is identical across all three. A setting
 * that quietly made the game easier would turn an accessibility option into a
 * difficulty selector, and then nobody could use it honestly.
 *
 *   ooze      the default. Cartoon slime in the bug's own colour, with a
 *             persistent floor decal.
 *   confetti  piñata. The body bursts into paper shapes in a bright fixed
 *             palette; the decal is a scatter of chips rather than a puddle.
 *   bubble    soap. The body pops into translucent rings that drift up and
 *             vanish; almost no decal at all.
 */

export type JuiceStyleId = 'ooze' | 'confetti' | 'bubble'

export const JUICE_STYLES: readonly JuiceStyleId[] = ['ooze', 'confetti', 'bubble']

export const isJuiceStyle = (v: unknown): v is JuiceStyleId =>
  typeof v === 'string' && (JUICE_STYLES as readonly string[]).includes(v)

export interface JuiceStyleSpec {
  id: JuiceStyleId
  /**
   * Particle shape index into `useVfx`'s bucket:
   *   0 soft round · 1 shard/quad · 2 spark streak · 3 smoke puff
   */
  shape: 0 | 1 | 2 | 3
  /** Particles per squish, before the quality tier scales it. */
  burst: number
  /** How long a burst particle lives, ms. */
  life: number
  /** Gravity on a burst particle, u/s². Negative falls. */
  gravity: number
  /** Opacity of the floor decal this style stamps. 0 = none. */
  decalAlpha: number
  /** Decal radius as a multiple of the body radius. */
  decalScale: number
  /** Additive blending — bubbles glow, ooze does not. */
  additive: boolean
  /**
   * When set, the burst ignores the bug's own `goo` colour and rolls from this
   * palette instead. Confetti is confetti whatever it came out of.
   */
  palette: ReadonlyArray<readonly [number, number, number]> | null
  /** The synth voice used for the squish layer — see `useGameAudio`. */
  voice: 'wet' | 'paper' | 'pop'
}

const CONFETTI_PALETTE = [
  [255, 92, 138], [255, 206, 54], [92, 222, 255],
  [140, 255, 140], [200, 130, 255], [255, 150, 70]
] as const

const BUBBLE_PALETTE = [
  [190, 235, 255], [215, 255, 244], [255, 226, 250], [225, 225, 255]
] as const

export const JUICE_STYLE: Record<JuiceStyleId, JuiceStyleSpec> = {
  ooze: {
    id: 'ooze', shape: 0, burst: 16, life: 620, gravity: -34,
    decalAlpha: 0.86, decalScale: 2.1, additive: false,
    palette: null, voice: 'wet'
  },
  confetti: {
    id: 'confetti', shape: 1, burst: 22, life: 900, gravity: -22,
    decalAlpha: 0.42, decalScale: 1.5, additive: false,
    palette: CONFETTI_PALETTE, voice: 'paper'
  },
  bubble: {
    id: 'bubble', shape: 0, burst: 13, life: 780, gravity: 10,
    decalAlpha: 0.12, decalScale: 1.2, additive: true,
    palette: BUBBLE_PALETTE, voice: 'pop'
  }
}

export const DEFAULT_JUICE_STYLE: JuiceStyleId = 'ooze'

/**
 * The colour one burst particle should be.
 *
 * `i` is the particle's index in the burst, so a confetti spray cycles the
 * palette deterministically instead of rolling a random colour per particle —
 * which is both cheaper and produces a better-looking spread (a random roll
 * clumps).
 */
export const burstColour = (
  style: JuiceStyleSpec,
  goo: readonly [number, number, number],
  i: number
): readonly [number, number, number] => {
  const p = style.palette
  if (!p || p.length === 0) return goo
  return p[i % p.length]!
}
