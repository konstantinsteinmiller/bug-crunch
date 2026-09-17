/**
 * ─── The four bosses ────────────────────────────────────────────────────────
 *
 * Every world ends with one, and every one of them is THREE PHASES that ask
 * three different questions. The pattern the set follows, stated once:
 *
 *   phase 1   the boss is a big bug. Stomp it. Teaches where its hitbox is.
 *   phase 2   the boss stops being the target — something else is, on a clock.
 *             Teaches that the fight has a job in it.
 *   phase 3   the boss fights back on a tell the player must read and answer
 *             with a SLAM. Teaches the charge.
 *
 * Phase 3 is where the heavy slam stops being an option and becomes the answer,
 * which is why the beetle teaches the charged stomp on 1-3 and the first boss
 * asks for it on the very next level — one level is close enough that the
 * gesture is still in the hand, and the Queen's shell is the same question the
 * beetle's was, asked by something much bigger.
 *
 * ── A boss can arrive at less than full strength ──
 *
 * World 1 meets the Goliath Queen TWICE: at half strength on 1-4, as the first
 * big moment of the retention funnel, and at full strength on 1-10 as the
 * world's finale — "she's back, and angrier". The strength is a number on the
 * LEVEL (`LevelSpec.bossScale`) and is turned into a fight in exactly one place,
 * `scaleBoss` below, so the sim, the boss bar and its ticks, the payout and the
 * tests all read the same scaled spec and cannot disagree about what "half" is.
 *
 * Pure data. `useBugCrunchGame` runs the scripts; `bugArt` draws the bodies.
 */

import type { BugId } from '@/game/bugs'

export type BossId = 'queenAnt' | 'beetleKing' | 'matriarch' | 'roachPrime'

/** What a phase's director does, tick by tick. */
export type PhaseScript =
  /** The boss patrols; stomping its body is the only thing that matters. */
  | 'patrol'
  /** The boss patrols and spawns adds on a timer. */
  | 'summon'
  /** The boss drops eggs/pods that hatch on a clock; the PODS are the target
   *  and the boss is invulnerable until they are cleared. */
  | 'pods'
  /** The boss charges along a line. It telegraphs, winds up, then runs; the
   *  wind-up is a slam window and the run is a hazard. */
  | 'charge'
  /** The boss spins in place, sweeping a ring outward on a period. */
  | 'spin'
  /** The boss is behind a shield that only breaks to a slam; adds keep coming. */
  | 'shield'
  /** The boss sweeps a beam across the board on a telegraphed line. */
  | 'beam'

export interface BossPhase {
  script: PhaseScript
  /** Hits this phase takes before it ends. */
  hits: number
  /** Boss movement speed, u/s. */
  speed: number
  /** ms between whatever the script does on a timer (spawns, pods, charges). */
  beatMs: number
  /** Adds this phase spawns, when the script spawns any. */
  adds: readonly BugId[]
  /** How many adds per beat. */
  addCount: number
  /** Armour class for the phase — a slam is pierce+2, so a 3 here means only a
   *  slam from a genuinely hard shoe opens it. */
  armor: number
  /**
   * A hit only counts while the boss is VULNERABLE. Scripts that have an
   * invulnerable window (`pods`, `shield`, the run half of `charge`) say so
   * themselves; this is the floor for the rest.
   */
  vulnerable: boolean
  /** i18n key suffix for the one-line phase call-out. */
  tell: 'stomp' | 'pods' | 'charge' | 'spin' | 'shield' | 'beam' | 'summon'
  /**
   * ms between clutches of the BROOD in this phase, 0 for none — one egg a
   * clutch. A `pods` phase ignores it (its beat IS its clutch, two at a time),
   * and a boss that lays while charging reads it as the shortest gap between
   * two lays rather than as a timer: she lays when a charge is spent. See
   * "The brood" below.
   */
  eggMs: number
}

/** What a boss's egg looks like. The Queen's colony lays eggs; Roach Prime's
 *  arcade presses them out of a machine. */
export type EggLook = 'egg' | 'capsule'

/**
 * How an egg reaches the floor.
 *
 *   lay   out of the boss's own body, in a short hop to the floor beside it.
 *         The Queen is an ant queen — laying is what she IS — and Roach Prime
 *         is a factory on legs whose cutscene already has a line of pods.
 *   haul  a CARRIER ANT walks in from the edge of the board holding the egg
 *         over its head, sets it down, and walks off. A beetle or a centipede
 *         laying ant eggs is nonsense a six-year-old will call out; the colony
 *         bringing its eggs to the fight is a picture every child has seen
 *         in a picture book.
 */
export type EggDelivery = 'lay' | 'haul'

export interface BossSpec {
  id: BossId
  /** i18n key suffix — `bosses.<id>`. */
  name: BossId
  /** Body radius, u. Bosses are big: a third of the short edge. */
  size: number
  /** Which bug design the body is drawn FROM, scaled up and re-dressed. Keeping
   *  the silhouette of a creature the player already reads at 40 px is what
   *  makes a boss legible the instant it arrives. */
  base: BugId
  goo: readonly [number, number, number]
  body: string
  shade: string
  accent: string
  /** Crown/plate colour — the mark that says "this one is the boss". */
  crown: string
  phases: readonly [BossPhase, BossPhase, BossPhase]
  /** Score for felling it. */
  score: number
  /** The strength this spec was built at: 1 for every entry in `BOSSES`, less
   *  for one that came out of `scaleBoss`. */
  strength: number
  /** Pods the player must clear to end a `pods` phase. `POD_QUOTA` at full. */
  podQuota: number
  /** How long a pod has before it hatches, ms. `POD_HATCH_MS` at full. */
  podHatchMs: number
  /** How long a charge winds up — the counter-slam window — in ms.
   *  `CHARGE_WINDUP_MS` at full. */
  windupMs: number
  /** How long a spent charge leaves the boss wide open, ms. `CHARGE_SPENT_MS`
   *  at full. */
  spentMs: number
  /** How long a laying boss holds still after a spent charge, ms, on top of
   *  `spentMs`. `LAY_HOLD_MS` at full. */
  layHoldMs: number
  /** What its eggs look like, and how they get onto the floor. */
  eggLook: EggLook
  delivery: EggDelivery
  /** Ants one egg hatches into. `BROOD_ANTS` at full. */
  broodAnts: number
  /** Eggs on the floor (and in carriers' arms) at once. `EGG_CAP` at full. */
  eggCap: number
  /** Hatched ants alive at once. `HATCHLING_CAP` at full. */
  hatchlingCap: number
}

// ─── Charge timing ──────────────────────────────────────────────────────────
//
// The three windows of a `charge` beat, in ms. They are here rather than in the
// sim because the RATIO between them is the whole difficulty of the mechanic:
// `windup` is how long the player has to recognise the tell and start a charge,
// and a shoe's own `chargeMs` (260-380 ms) has to fit inside it with room to
// react. 900 ms leaves roughly half a second of reaction time on the slowest
// shoe, which is a fair ask for a nine-year-old and a formality for an adult.
//
// (Declared above the table because every entry's full-strength `windupMs` and
// pod clock are read off them.)

export const CHARGE_TELL_MS = 620
export const CHARGE_WINDUP_MS = 900
export const CHARGE_RUN_MS = 780
/** Recovery after a charge, during which the boss is wide open. */
export const CHARGE_SPENT_MS = 1100

/** A slam landed during the wind-up is a PERFECT counter: double damage and the
 *  charge is cancelled. This is the mechanical payoff the GDD asks for. */
export const CHARGE_COUNTER_HITS = 2

// ─── Pods ───────────────────────────────────────────────────────────────────

/** How long a pod has before it hatches, ms — at full strength. */
export const POD_HATCH_MS = 5200
/** Pods dropped per beat. */
export const POD_PER_BEAT = 2
/** Pods the player must clear to end a `pods` phase — at full strength. */
export const POD_QUOTA = 6
/** Pod radius, u. */
export const POD_SIZE = 4.2

// ─── The brood ──────────────────────────────────────────────────────────────
//
// Every boss fight has EGGS, and every egg is an ant egg. Until this pass the
// only eggs in the game were the two `pods` phases' — the Queen's second phase
// and the Matriarch's — and they hatched into a beetle or a centipede: the
// consequence of missing one was an armoured body on the floor, and the reward
// for stomping one was a flat 80 points that did not touch the chain. So eggs
// were a chore, and the boss fights had nothing in them to chain: scouted
// before this pass, no policy got past ×3 on either Queen, the Matriarch
// averaged ×0, and every boss asked for a ×6 to ×24 chain star nobody could
// reach.
//
// Now an egg is a REWARD LOOP with two good outcomes and no bad one:
//
//   STOMP IT   a pop, goo, points on the chain's multiplier, juice for the
//              vial, and a rung on the Splat Chain — `popEgg` pays it exactly
//              as a kill is paid. It is never a miss.
//   MISS IT    it wobbles, cracks in four stages you can read from across the
//              board, and hatches with a pop into a small cluster of ants that
//              scurry outward: the cheapest chain fodder in the game, and a
//              one-stomp ×3 for anyone who slams into the middle of them.
//
// Neither outcome can hurt a player, which is the point for a six-year-old: an
// egg is something to go and get, never something to be afraid of. The two
// `pods` phases keep their job (the boss is armoured until N eggs are popped)
// and their eggs hatch into ants too, so there is one rule about eggs in the
// whole game rather than two.
//
// ── Why it cannot flood the board ──
//
// Three caps, all scaled with the boss: live eggs (`eggCap`, carriers' eggs
// included), live hatchlings (`hatchlingCap`), and the level's own `maxAlive`.
// An egg whose clock runs out on a full board does not hatch — it sits on its
// last crack stage, wobbling, until there is room — so a cap never deletes a
// hatch the player was watching for, it only delays it. And an egg nobody pops
// blocks the next clutch at `eggCap`, so a player who ignores them all sees at
// most four eggs and nine ants, never a carpet.
//
// ── Measured ──
//
// `tools/preview-video` scout, portrait 360×640, spawn and autopilot seeds
// varied together; world 1 in the starter sneaker (the weakest player the game
// carries), worlds 2-4 in the fixture's steel boot. Wins, then the best chain
// rung a run reached. "Before" is this file without the brood.
//
//   1-4   average  13/15 ×0      →  12/15 (17/20) ×2-×3
//         good      5/5  ×0      →  10/10 ×2
//   1-10  average   5/10 ×1-×3   →   8/10 (14/20) ×2-×5
//         good      5/5  ×2      →  10/10 ×2
//   2-10  average  10/10 ×2-×3   →  10/10 ×1-×3
//         good     10/10 ×2-×3   →  10/10 ×1-×3
//   3-10  average  10/10 ×0 (×5 once)  →  10/10 ×3-×8
//         good     10/10 ×0      →  10/10 ×3-×5
//   4-10  average   3/10 ×3      →   5/10 ×3-×5
//         good     10/10 ×3      →  10/10 ×3-×8
//
// (4-10's "before" is after the fix to `bossStomp` that lets a slam break a
// `shield` at all — without it no run of any policy ever got past Roach Prime's
// first phase.) A good player plays straight past the eggs, which is why their
// chain barely moves; the chain stars in `stages.ts` are set off the same player
// steered to farm the brood.

/** Ants one egg hatches into — at full strength. A half-strength boss's eggs
 *  hatch two: a cluster, still, and still a chain, but a smaller floor. */
export const BROOD_ANTS = 3
/** Eggs alive at once, carried eggs included — at full strength. */
export const EGG_CAP = 4
/** Hatched ants alive at once — at full strength. Three clutches' worth. */
export const HATCHLING_CAP = 9

/** What a popped egg pays: base points on the chain's multiplier, and vial.
 *  A shade more juice than an ant (0.06), because the egg is the thing the
 *  fight is asking the player to go and get. */
export const EGG_SCORE = 40
export const EGG_JUICE = 0.08

/**
 * The hop a LAID egg takes from the boss's body to the floor, ms.
 *
 * Not stompable and not ticking while it flies: a child who taps the egg the
 * moment they see it leave the boss would otherwise hit bare floor where it is
 * about to land, which is a miss for watching closely. Short, so it reads as
 * "plop", not as a throw.
 */
export const EGG_LAY_MS = 380
/** How far a laid egg lands from the boss's middle, past the body's own edge, u. */
export const EGG_LAND_U: readonly [number, number] = [7, 20]

/**
 * How long a laying boss HOLDS STILL after a spent charge, ms, on top of the
 * spent window itself.
 *
 * The Queen's third phase is the fight's wall — every loss scouted on either
 * Queen before this pass was her charge phase, with a slam or two left to land
 * in a window a weak player kept missing. So she now stops at the end of a
 * spent charge to lay an egg, and she is wide open while she does: the egg is
 * the TELL for the longest open window of the fight. The rhythm a child learns
 * is the one the game wants taught — dodge the run, then when she squats, slam
 * her, then pop the egg.
 */
export const LAY_HOLD_MS = 800

/**
 * The crack stages an egg reads in — whole, hairline, cracked, splitting — as
 * equal quarters of its hatch clock.
 *
 * Four, because four is what a child can tell apart at 30 px without being
 * taught: "fine", "oh", "OH", "now". It is also the panel count of the painted
 * egg sheets (`artSheet.ts`), so the painter and the clock cannot disagree
 * about how many stages there are.
 */
export const EGG_STAGES = 4

/** How long a hatchling runs at salt-panic speed out of its shell, ms. The
 *  scurry is what makes a hatch read as "they got out" rather than as three
 *  ants appearing on a spot. */
export const HATCH_SCURRY_MS = 420

/**
 * A carrier ant's walk before it sets its egg down, ms.
 *
 * Long enough to be SEEN — an ant with an egg over its head crossing a stretch
 * of floor is the whole picture — and short enough that the egg lands near the
 * edge the carrier came in from, where a player standing under the boss has to
 * move to reach it. A carrier stomped on the way pops its egg with it: two rungs
 * for one stomp, which is the reward for noticing it early.
 */
export const CARRIER_WALK_MS = 1300

// ─── Beam ───────────────────────────────────────────────────────────────────

/** How long the beam's line is drawn before it fires, ms. */
export const BEAM_TELL_MS = 900
/** How long it sweeps for, ms. */
export const BEAM_SWEEP_MS = 1600
/** Half-width of the beam, u. */
export const BEAM_HALF = 7

// ─── The four ───────────────────────────────────────────────────────────────

const phase = (p: BossPhase): BossPhase => p

/** An entry at full strength: the dials every boss shares are filled in here,
 *  so the table below only carries what makes each boss that boss. */
const boss = (
  s: Omit<BossSpec,
    'strength' | 'podQuota' | 'podHatchMs' | 'windupMs' | 'spentMs' | 'layHoldMs'
    | 'broodAnts' | 'eggCap' | 'hatchlingCap'>
): BossSpec => ({
  ...s, strength: 1, podQuota: POD_QUOTA, podHatchMs: POD_HATCH_MS,
  windupMs: CHARGE_WINDUP_MS, spentMs: CHARGE_SPENT_MS, layHoldMs: LAY_HOLD_MS,
  broodAnts: BROOD_ANTS, eggCap: EGG_CAP, hatchlingCap: HATCHLING_CAP
})

export const BOSSES: Record<BossId, BossSpec> = {
  // ── World 1 · Goliath Queen Ant (GDD §7.3, implemented verbatim) ──
  queenAnt: boss({
    id: 'queenAnt', name: 'queenAnt', size: 15, base: 'ant',
    goo: [255, 74, 158], body: '#a8412a', shade: '#63220f', accent: '#ffd9a8',
    crown: '#ffd93c', score: 2500,
    // She LAYS: two eggs a beat in her egg phase (which hatch into ants now, not
    // the beetle they used to), and one at the end of every spent charge — held
    // still while she does it, so the egg is the tell for her widest window.
    eggLook: 'egg', delivery: 'lay',
    phases: [
      phase({
        script: 'summon', hits: 5, speed: 7.5, beatMs: 2100,
        adds: ['ant'], addCount: 2, armor: 0, vulnerable: true, tell: 'summon', eggMs: 0
      }),
      phase({
        script: 'pods', hits: 6, speed: 5, beatMs: 2600,
        adds: [], addCount: 0, armor: 0, vulnerable: false, tell: 'pods', eggMs: 0
      }),
      phase({
        script: 'charge', hits: 4, speed: 30, beatMs: 2800,
        adds: [], addCount: 0, armor: 2, vulnerable: true, tell: 'charge', eggMs: 2600
      })
    ]
  }),

  // ── World 2 · Thornback Beetle King ──
  beetleKing: boss({
    id: 'beetleKing', name: 'beetleKing', size: 16, base: 'beetle',
    goo: [66, 225, 122], body: '#2f7a45', shade: '#123a22', accent: '#c8ffd8',
    crown: '#ffb03a', score: 4200,
    // Carried in by the colony in the two phases that have no adds of their own
    // — the summon phase's shells and spikes are already a full floor.
    eggLook: 'egg', delivery: 'haul',
    phases: [
      phase({
        script: 'patrol', hits: 6, speed: 6.5, beatMs: 2400,
        adds: [], addCount: 0, armor: 2, vulnerable: true, tell: 'stomp', eggMs: 2400
      }),
      phase({
        script: 'summon', hits: 7, speed: 8, beatMs: 1900,
        adds: ['caterpillar', 'beetle'], addCount: 2, armor: 2, vulnerable: true, tell: 'summon', eggMs: 0
      }),
      phase({
        script: 'spin', hits: 6, speed: 11, beatMs: 2200,
        adds: [], addCount: 0, armor: 3, vulnerable: true, tell: 'spin', eggMs: 2200
      })
    ]
  }),

  // ── World 3 · Centipede Matriarch ──
  matriarch: boss({
    id: 'matriarch', name: 'matriarch', size: 13, base: 'centipede',
    goo: [255, 160, 60], body: '#9c4a18', shade: '#5a2708', accent: '#ffcf8a',
    crown: '#d9f5ff', score: 6400,
    // Carried, including her egg phase's: she is a centipede, and a centipede
    // laying ant eggs is the one thing on this list a child would call wrong.
    // The colony brings them; she guards the floor until they are popped.
    eggLook: 'egg', delivery: 'haul',
    phases: [
      phase({
        script: 'patrol', hits: 8, speed: 15, beatMs: 2000,
        adds: [], addCount: 0, armor: 1, vulnerable: true, tell: 'stomp', eggMs: 3400
      }),
      phase({
        script: 'pods', hits: 7, speed: 12, beatMs: 2300,
        adds: [], addCount: 0, armor: 1, vulnerable: false, tell: 'pods', eggMs: 0
      }),
      phase({
        script: 'charge', hits: 7, speed: 36, beatMs: 2400,
        adds: ['moth'], addCount: 1, armor: 3, vulnerable: true, tell: 'charge', eggMs: 3200
      })
    ]
  }),

  // ── World 4 · Mecha Roach Prime ──
  roachPrime: boss({
    id: 'roachPrime', name: 'roachPrime', size: 17, base: 'robobug',
    goo: [90, 240, 255], body: '#3d4a63', shade: '#1a2130', accent: '#6ef0ff',
    crown: '#ff3a7a', score: 9000,
    // A factory on legs: it presses out CAPSULES, the pods its cutscene's
    // production line is already making, with ants inside. Its own weapon never
    // burns one — the beam sweeps bodies, and a floor object it deleted would be
    // a reward taken away by the thing the player is dodging.
    eggLook: 'capsule', delivery: 'lay',
    phases: [
      phase({
        script: 'shield', hits: 8, speed: 9, beatMs: 2000,
        adds: ['robobug'], addCount: 2, armor: 3, vulnerable: false, tell: 'shield', eggMs: 3000
      }),
      phase({
        script: 'summon', hits: 9, speed: 13, beatMs: 1600,
        adds: ['robobug', 'flea'], addCount: 3, armor: 2, vulnerable: true, tell: 'summon', eggMs: 0
      }),
      phase({
        script: 'beam', hits: 8, speed: 16, beatMs: 2600,
        adds: [], addCount: 0, armor: 3, vulnerable: true, tell: 'beam', eggMs: 3400
      })
    ]
  })
}

export const BOSS_IDS: readonly BossId[] = Object.keys(BOSSES) as BossId[]

export const isBossId = (v: unknown): v is BossId =>
  typeof v === 'string' && v in BOSSES

// ─── Strength ───────────────────────────────────────────────────────────────

/** The weakest a boss may be made. Below a quarter the three phases stop being
 *  three questions — a phase of one hit with one add is a speed bump. */
export const MIN_BOSS_SCALE = 0.25

/**
 * A boss at `scale` of its strength. Pure: the spec in, a new spec out.
 *
 * "Half as strong" is not "half of every number". A fight is made of two kinds
 * of dial, and they are softened differently:
 *
 *   COUNTS scale straight by `scale` — how much the player has to DO.
 *     hits per phase   ceil, never under 1       Queen 5/6/4 → 3/3/2
 *     adds per beat    ceil, a phase that summoned still summons   2 → 1
 *     pods to clear    ceil                                        6 → 3
 *     ants per egg     ceil                                        3 → 2
 *     eggs / hatchlings at once   ceil                         4/9 → 2/5
 *     score            rounded                                  2500 → 1250
 *
 *   CLOCKS AND SPEEDS soften by `0.5 + 0.5 × scale` (¾ at half) — how FAST the
 *   player has to do it. Halving these too would be a different fight rather
 *   than a smaller one: a Queen crawling at half pace with eggs that never
 *   hatch teaches nothing about the one she becomes on 1-10.
 *     boss speed       × ¾      she is easier to put a foot on
 *     beat, egg clutch ÷ ¾      adds and eggs arrive a third further apart
 *     pod hatch        ÷ ¾      5.2 s → 6.9 s to reach an egg
 *     wind-up          ÷ ¾      the counter-slam window, 900 → 1200 ms
 *     spent            ÷ ¾      wide open after a charge, 1100 → 1467 ms
 *     lay hold         ÷ ¾      held still laying after one,  800 → 1067 ms
 *
 * And two things are NEVER touched, because they are the lessons: the three
 * phases and their scripts (so 1-4 is the same fight 1-10 is, in miniature),
 * and armour (so phase 3 still bounces a tap and still opens to a slam — the
 * charged stomp the beetle taught one level earlier).
 *
 * Applied to whatever spec it is handed, so it composes; `bossSpec(id, scale)`
 * always starts from the full-strength entry.
 */
export const scaleBoss = (spec: BossSpec, scale: number): BossSpec => {
  const k = Math.max(MIN_BOSS_SCALE, Math.min(1, Number.isFinite(scale) ? scale : 1))
  if (k === 1) return spec
  const slack = 0.5 + 0.5 * k
  const count = (n: number): number => (n > 0 ? Math.max(1, Math.ceil(n * k)) : 0)
  const [p1, p2, p3] = spec.phases.map((p) => phase({
    ...p,
    hits: count(p.hits),
    addCount: count(p.addCount),
    speed: Number((p.speed * slack).toFixed(3)),
    beatMs: Math.round(p.beatMs / slack),
    // A clock like the beat: a phase that lays still lays, a third further apart.
    eggMs: p.eggMs > 0 ? Math.round(p.eggMs / slack) : 0
  }))
  return {
    ...spec,
    phases: [p1!, p2!, p3!],
    score: Math.round(spec.score * k),
    strength: spec.strength * k,
    podQuota: count(spec.podQuota),
    podHatchMs: Math.round(spec.podHatchMs / slack),
    windupMs: Math.round(spec.windupMs / slack),
    spentMs: Math.round(spec.spentMs / slack),
    // An open window like `spent`, so it softens like `spent`.
    layHoldMs: Math.round(spec.layHoldMs / slack),
    // The brood is a COUNT: fewer ants to an egg, fewer eggs and hatchlings at
    // once — 3/4/9 → 2/2/5 at half — so 1-4's floor is a smaller version of
    // 1-10's and never a busier one.
    broodAnts: count(spec.broodAnts),
    // Never under one clutch: a `pods` beat lays two, and a cap of one would
    // silently swallow the second egg of every beat at quarter strength.
    eggCap: Math.max(POD_PER_BEAT, count(spec.eggCap)),
    hatchlingCap: count(spec.hatchlingCap)
  }
}

const scaled = new Map<string, BossSpec>()

/**
 * A boss, at a strength. Memoised, because the sim, the boss bar's ticks and the
 * lesson that points at the phase all ask for the same one inside a frame — and
 * so they are all handed the SAME object. At full strength it is the table
 * entry itself.
 */
export const bossSpec = (id: BossId, scale = 1): BossSpec => {
  if (scale >= 1) return BOSSES[id]
  const key = `${id}@${scale}`
  let hit = scaled.get(key)
  if (!hit) {
    hit = scaleBoss(BOSSES[id], scale)
    scaled.set(key, hit)
  }
  return hit
}

/** Total hits across all three phases — what the HUD's boss bar divides by. */
export const bossTotalHits = (spec: BossSpec): number =>
  spec.phases.reduce((n, p) => n + p.hits, 0)

/**
 * 0..1 of the boss bar remaining, given the phase index and hits taken in it.
 *
 * ONE bar for all three phases rather than three, because three bars read as
 * three fights and the whole point of the phase structure is that it is one
 * fight that keeps changing. The phase boundaries are drawn as ticks on the bar
 * instead, so the player can SEE the next change coming.
 */
export const bossHp01 = (spec: BossSpec, phaseIndex: number, hitsInPhase: number): number => {
  const total = bossTotalHits(spec)
  if (total <= 0) return 0
  let done = hitsInPhase
  for (let i = 0; i < phaseIndex && i < spec.phases.length; i++) done += spec.phases[i]!.hits
  return Math.max(0, Math.min(1, 1 - done / total))
}

/** Where each phase boundary sits on the bar, as 0..1 from the left. */
export const bossPhaseTicks = (spec: BossSpec): number[] => {
  const total = bossTotalHits(spec)
  const ticks: number[] = []
  let done = 0
  for (let i = 0; i < spec.phases.length - 1; i++) {
    done += spec.phases[i]!.hits
    ticks.push(1 - done / total)
  }
  return ticks
}
