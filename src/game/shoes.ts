/**
 * ─── The Locker ─────────────────────────────────────────────────────────────
 *
 * Six shoes, and every one of them is a different GAME rather than a different
 * number. The matrix in the GDD is the contract; this is it in code.
 *
 * The rule the set is built to: **no shoe is strictly better than the starter.**
 * A steel boot that was simply the sneaker with bigger numbers would end the
 * Locker the moment it was bought — there would be nothing to choose, only
 * something to afford. So every upgrade gives up something the sneaker has:
 *
 *   steelBoot     immunity + reach, at half the agility and a long recovery
 *   bunnySlipper  invisible to dodgers, but can only ever open the soft shell
 *                 (beetle) and never the hardened one (robobug)
 *   rollerSkate   crushes a whole LINE, but only a narrow one
 *   cleatBoot     punctures anything, over a very small circle
 *   electricSock  kills things it never touched, but only weak ones
 *
 * All lengths are in **u** (see `bugs.ts`), all times in ms.
 */

export type ShoeId =
  | 'sneaker' | 'steelBoot' | 'bunnySlipper'
  | 'rollerSkate' | 'cleatBoot' | 'electricSock'

export interface ShoeSpec {
  id: ShoeId
  /** i18n key suffix — `shoes.<id>.name` / `.perk`. */
  name: ShoeId

  // ── The matrix, as the Locker prints it (1-5 pips) ──
  speedRank: 1 | 2 | 3 | 4 | 5
  radiusRank: 1 | 2 | 3 | 4 | 5
  pierceRank: 0 | 1 | 2 | 3 | 4 | 5

  // ── The numbers the simulation actually reads ──
  /**
   * How hard the foot chases the pointer, as a spring stiffness in 1/s.
   *
   * NOT a max speed. A cap would make a slow shoe feel broken on a big screen
   * (the finger arrives, the foot is still crossing the board); a spring makes
   * it feel HEAVY, which is the thing a steel boot is supposed to feel like.
   */
  agility: number
  /** Quick-stomp radius, u. */
  radius: number
  /** Heavy-slam radius as a multiple of `radius`. */
  slamScale: number
  /** Armour pierce. Compared against `BugSpec.armor`; a slam adds +2. */
  pierce: number
  /** Minimum gap between quick stomps, ms. */
  cooldown: number
  /** Hold time for a full slam charge, ms. */
  chargeMs: number
  /** Frozen-foot recovery after a slam, ms. */
  recoverMs: number
  /** Height the foot hovers at, 0..1. A high hover telegraphs more. */
  hover: number

  // ── Passives ──
  /** Spikes do not hurt. */
  spikeProof: boolean
  /** Dodgers never see the shadow — no ALERT, no leap. */
  silent: boolean
  /** A stomp held and dragged ploughs a line through everything it crosses. */
  slide: boolean
  /** Extra bodies a stomp arcs to. 0 = none. */
  chain: number
  /** A slam stuns everything in `slamScale × radius × 1.6` for `stunMs`. */
  stunMs: number

  // ── Unlock ──
  /** Coins. 0 = the starter, owned from the first boot. */
  cost: number
  /** Stars that must be banked before the Locker will sell it at all. */
  starGate: number
  /** Chassis colours for the procedural drawing. */
  body: string
  shade: string
  accent: string
  sole: string
}

const shoe = (s: ShoeSpec): ShoeSpec => s

export const SHOES: readonly ShoeSpec[] = [
  shoe({
    id: 'sneaker', name: 'sneaker',
    speedRank: 3, radiusRank: 3, pierceRank: 1,
    agility: 13, radius: 9.0, slamScale: 1.75, pierce: 1,
    cooldown: 150, chargeMs: 320, recoverMs: 420, hover: 0.36,
    spikeProof: false, silent: false, slide: false, chain: 0, stunMs: 0,
    cost: 0, starGate: 0,
    body: '#f4f6fb', shade: '#c3c9d8', accent: '#ff4d6d', sole: '#eceff6'
  }),
  shoe({
    id: 'steelBoot', name: 'steelBoot',
    speedRank: 1, radiusRank: 5, pierceRank: 5,
    agility: 6.5, radius: 13.2, slamScale: 2.0, pierce: 4,
    cooldown: 260, chargeMs: 380, recoverMs: 700, hover: 0.46,
    spikeProof: true, silent: false, slide: false, chain: 0, stunMs: 1400,
    cost: 350, starGate: 9,
    body: '#c98a3a', shade: '#7d4d13', accent: '#f2d08a', sole: '#3b2a16'
  }),
  shoe({
    id: 'bunnySlipper', name: 'bunnySlipper',
    speedRank: 5, radiusRank: 2, pierceRank: 0,
    agility: 22, radius: 7.4, slamScale: 1.5, pierce: 0,
    cooldown: 105, chargeMs: 260, recoverMs: 300, hover: 0.28,
    spikeProof: false, silent: true, slide: false, chain: 0, stunMs: 0,
    cost: 300, starGate: 15,
    body: '#ffd6e8', shade: '#e79fc2', accent: '#ffffff', sole: '#ffeaf3'
  }),
  shoe({
    id: 'rollerSkate', name: 'rollerSkate',
    speedRank: 4, radiusRank: 2, pierceRank: 2,
    agility: 17, radius: 7.7, slamScale: 1.6, pierce: 2,
    cooldown: 130, chargeMs: 300, recoverMs: 360, hover: 0.32,
    spikeProof: false, silent: false, slide: true, chain: 0, stunMs: 0,
    cost: 550, starGate: 24,
    body: '#ff5fa2', shade: '#c2266a', accent: '#ffe45e', sole: '#2b2f45'
  }),
  shoe({
    id: 'cleatBoot', name: 'cleatBoot',
    speedRank: 3, radiusRank: 1, pierceRank: 4,
    agility: 13, radius: 6.5, slamScale: 1.55, pierce: 3,
    cooldown: 120, chargeMs: 280, recoverMs: 380, hover: 0.34,
    spikeProof: false, silent: false, slide: false, chain: 0, stunMs: 0,
    cost: 700, starGate: 36,
    body: '#2fb9a0', shade: '#146d5c', accent: '#eafff9', sole: '#0f3b33'
  }),
  shoe({
    id: 'electricSock', name: 'electricSock',
    speedRank: 4, radiusRank: 3, pierceRank: 1,
    agility: 17.5, radius: 8.8, slamScale: 1.7, pierce: 1,
    cooldown: 140, chargeMs: 300, recoverMs: 400, hover: 0.33,
    spikeProof: false, silent: false, slide: false, chain: 3, stunMs: 0,
    cost: 900, starGate: 48,
    body: '#6f8bff', shade: '#33429e', accent: '#c8f3ff', sole: '#7c93ff'
  })
] as const

const BY_ID: Record<ShoeId, ShoeSpec> = Object.fromEntries(
  SHOES.map((s) => [s.id, s])
) as Record<ShoeId, ShoeSpec>

/** The one every player starts in and can never lose. */
export const STARTER_SHOE: ShoeId = 'sneaker'

export const shoeSpec = (id: ShoeId): ShoeSpec => BY_ID[id] ?? BY_ID[STARTER_SHOE]!

export const SHOE_IDS: readonly ShoeId[] = SHOES.map((s) => s.id)

export const isShoeId = (v: unknown): v is ShoeId =>
  typeof v === 'string' && v in BY_ID

/**
 * The pierce a given blow carries.
 *
 * A slam is worth +2 on top of the shoe's own rating, which is exactly the
 * amount that lets the STARTER sneaker (pierce 1) crack a beetle (armour 2)
 * with a slam and never with a tap. That single number is the whole of the
 * beetle lesson, and it is stated here rather than inside the sim so a test can
 * pin it.
 *
 * The beetle's armour was 1 in the first pass, which quietly deleted the lesson:
 * `pierce < armor` is false at 1 vs 1, so the tap the player was supposed to
 * bounce off with went straight through, and the hold-to-slam mechanic had
 * nothing left to teach. `tests/game/bugs.test.ts` pins both halves now.
 *
 * The rest of the matrix falls out of the same two numbers: the starter can
 * still slam its way through EVERY armoured bug in the game (3 >= robobug's 3),
 * so no shell is ever a paywall, while the bunny slipper (pierce 0) tops out at
 * a beetle and the cleat (3) taps through anything.
 */
export const SLAM_PIERCE_BONUS = 2

export const blowPierce = (shoe: ShoeSpec, heavy: boolean): number =>
  shoe.pierce + (heavy ? SLAM_PIERCE_BONUS : 0)

/**
 * Whether a shoe is purchasable right now.
 *
 * Two gates, deliberately different in kind: STARS say "you have played enough
 * of the game for this to be a choice rather than a shortcut", COINS say "you
 * have earned it". A shoe past its star gate but short of its price shows its
 * price; one short of the star gate shows the gate. Neither is ever hidden —
 * a Locker with invisible rows is a Locker nobody plans around.
 */
export interface ShoeAvailability {
  owned: boolean
  starLocked: boolean
  affordable: boolean
  starsShort: number
  coinsShort: number
}

export const shoeAvailability = (
  spec: ShoeSpec, owned: ReadonlyArray<ShoeId>, stars: number, coins: number
): ShoeAvailability => {
  const isOwned = spec.cost === 0 || owned.includes(spec.id)
  const starsShort = Math.max(0, spec.starGate - stars)
  const coinsShort = Math.max(0, spec.cost - coins)
  return {
    owned: isOwned,
    starLocked: !isOwned && starsShort > 0,
    affordable: !isOwned && starsShort === 0 && coinsShort === 0,
    starsShort,
    coinsShort
  }
}
