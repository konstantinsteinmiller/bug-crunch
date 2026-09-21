/**
 * ─── Props and hazards ──────────────────────────────────────────────────────
 *
 * The floor is not a flat arena. Every world brings one or two objects that
 * change how the foot or the bugs move, and the rule they all obey is that they
 * are OPPORTUNITIES BEFORE THEY ARE OBSTACLES: honey traps the flea that was
 * impossible to hit, salt panics a pack into a line, a sweeper is free kills if
 * you herd into it. Nothing here exists purely to take something away.
 *
 * Pure data + pure helpers; the simulation applies them.
 */

export type HazardId =
  /** A sticky puddle. Bugs inside it crawl at a third speed and CANNOT leap —
   *  which is what turns the flea from a reflex test into a setup. The foot
   *  slides a little when it lands on the rim. */
  | 'honey'
  /** A magnet plate. A heavy slam anywhere on the board arms it for a few
   *  seconds; while armed it drags armoured bodies (and only armoured ones)
   *  into its centre, which is the multi-squish setup the beetle tier needs. */
  | 'magnet'
  /** A shaker. Stomping it bursts salt outward: nothing dies, but every bug in
   *  the cloud panics — doubles speed, ignores its own AI and runs straight. */
  | 'salt'
  /** A sweeping bar (lawn mower, ceiling fan, arcade floor buffer) crossing the
   *  board on a fixed period. Instant death to anything it touches — including
   *  nothing the player owns, so it is pure profit if they can time it. */
  | 'sweeper'
  /** Attic cobweb. Halves the foot's agility while the shadow is over it, and
   *  holds any bug that walks in for a second. */
  | 'cobweb'
  /** Arcade conveyor. Everything standing on it — bugs AND the foot's landing
   *  point — drifts along the belt. */
  | 'conveyor'
  /** Breadcrumbs. Not a hazard at all: ants path TOWARDS them, which is how a
   *  level makes a swarm walk into one place the player can slam. */
  | 'crumbs'
  /** A shoebox with a ribbon on it — a Shoebox Trial. Stomp it open (three taps,
   *  a slam counts two) and the foot wears the shoe inside for `TRIAL_MS`.
   *  Never laid out by `hazards`: the level drops it in at `trialAt`. */
  | 'shoebox'
  /** A slick lane of spilt lemonade — the Spill twist. Bodies in it wade at half
   *  speed and cannot leap; a foot that lands in it and drags SKIDS. Laid by the
   *  twist and taken up again when it ends. */
  | 'slick'

export interface HazardSpec {
  id: HazardId
  /** Radius (or half-width for the bar-shaped ones), u. */
  size: number
  /** Bug speed multiplier while inside. 1 = unaffected. */
  bugSpeed: number
  /** Foot agility multiplier while the shadow is over it. */
  footAgility: number
  /** Bugs inside cannot dodge-leap. */
  grounds: boolean
  /** Touching it kills a bug outright. */
  lethal: boolean
  /** The player can trigger it by stomping it. */
  stompable: boolean
  /** Blows to break it open, where it breaks at all (the shoebox). A slam is two. */
  hp?: number
  /** Body colours for the procedural drawing. */
  body: string
  shade: string
  accent: string
}

const hz = (s: HazardSpec): HazardSpec => s

export const HAZARDS: readonly HazardSpec[] = [
  hz({
    id: 'honey', size: 11, bugSpeed: 0.34, footAgility: 0.8,
    grounds: true, lethal: false, stompable: false,
    body: '#f0a929', shade: '#b46f06', accent: '#ffe9a8'
  }),
  hz({
    id: 'magnet', size: 7, bugSpeed: 1, footAgility: 1,
    grounds: false, lethal: false, stompable: true,
    body: '#d7264a', shade: '#8a0f2b', accent: '#e9eef7'
  }),
  hz({
    id: 'salt', size: 5.5, bugSpeed: 1, footAgility: 1,
    grounds: false, lethal: false, stompable: true,
    body: '#e9eef7', shade: '#9aa7bd', accent: '#5d6a84'
  }),
  hz({
    id: 'sweeper', size: 8, bugSpeed: 1, footAgility: 1,
    grounds: false, lethal: true, stompable: false,
    body: '#8c93a6', shade: '#4d5468', accent: '#ffd93c'
  }),
  hz({
    id: 'cobweb', size: 13, bugSpeed: 0.25, footAgility: 0.55,
    grounds: true, lethal: false, stompable: false,
    body: '#dfe6f2', shade: '#98a4bb', accent: '#ffffff'
  }),
  hz({
    id: 'conveyor', size: 14, bugSpeed: 1, footAgility: 1,
    grounds: false, lethal: false, stompable: false,
    body: '#3a445c', shade: '#1d2434', accent: '#57e4ff'
  }),
  hz({
    id: 'crumbs', size: 6, bugSpeed: 1, footAgility: 1,
    grounds: false, lethal: false, stompable: false,
    body: '#e0b877', shade: '#a97f41', accent: '#fff0c9'
  }),
  hz({
    id: 'shoebox', size: 5, bugSpeed: 1, footAgility: 1,
    grounds: false, lethal: false, stompable: true, hp: 3,
    body: '#ff6b8f', shade: '#b8325a', accent: '#ffe45e'
  }),
  hz({
    // Half a honey. Enough to make a flea stand still and a line of ants wade,
    // not so much that a spill turns a level into a floor of statues.
    id: 'slick', size: 9, bugSpeed: 0.5, footAgility: 1,
    grounds: true, lethal: false, stompable: false,
    body: '#ffe066', shade: '#e0a800', accent: '#fff8c8'
  })
] as const

const BY_ID: Record<HazardId, HazardSpec> = Object.fromEntries(
  HAZARDS.map((h) => [h.id, h])
) as Record<HazardId, HazardSpec>

export const hazardSpec = (id: HazardId): HazardSpec => BY_ID[id]!

export const isHazardId = (v: unknown): v is HazardId =>
  typeof v === 'string' && v in BY_ID

// ─── Tuning the interactions ────────────────────────────────────────────────

/** How long a magnet stays armed after a slam, ms. */
export const MAGNET_ARMED_MS = 4000
/** Pull, in u/s, applied to armoured bodies inside a magnet's reach. */
export const MAGNET_PULL = 26
/** How far a magnet reaches, as a multiple of its own size. */
export const MAGNET_REACH = 4.2

/** Radius the salt cloud expands to, u, and how long it lasts. */
export const SALT_BURST_R = 26
export const SALT_PANIC_MS = 2600
/** Panic speed multiplier. */
export const SALT_PANIC_SPEED = 2.1

/** A sweeper crosses the whole board in this long, then waits. */
export const SWEEPER_CROSS_MS = 4200
export const SWEEPER_REST_MS = 3400

/** How long a bug is held by a cobweb it walks into, ms. */
export const COBWEB_HOLD_MS = 1000

/** Belt speed, u/s. */
export const CONVEYOR_SPEED = 9

/** The purple haze a stink bug leaves: radius, duration, and what it does. */
export const HAZE_R = 22
export const HAZE_MS = 3000
export const HAZE_FOOT_AGILITY = 0.55

/**
 * A spike costs the player this long with the foot pinned, and it breaks the
 * chain. It never costs a LIFE — this is a kids' game and a level is lost to
 * the clock, never to a health bar. What it costs is the run's momentum, which
 * at a ×20 chain is a genuinely painful price.
 */
export const SPIKE_STUN_MS = 900
