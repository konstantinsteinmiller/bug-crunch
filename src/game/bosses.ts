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
 * which is why the tutorial teaches the charge on level 1-1 and the first boss
 * asks for it nine levels later — long enough to have forgotten the button,
 * close enough that remembering is a small pleasure rather than a wall.
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
}

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
}

const phase = (p: BossPhase): BossPhase => p

export const BOSSES: Record<BossId, BossSpec> = {
  // ── World 1 · Goliath Queen Ant (GDD §7.3, implemented verbatim) ──
  queenAnt: {
    id: 'queenAnt', name: 'queenAnt', size: 15, base: 'ant',
    goo: [255, 74, 158], body: '#a8412a', shade: '#63220f', accent: '#ffd9a8',
    crown: '#ffd93c', score: 2500,
    phases: [
      phase({
        script: 'summon', hits: 5, speed: 7.5, beatMs: 2100,
        adds: ['ant'], addCount: 2, armor: 0, vulnerable: true, tell: 'summon'
      }),
      phase({
        script: 'pods', hits: 6, speed: 5, beatMs: 2600,
        adds: ['beetle'], addCount: 1, armor: 0, vulnerable: false, tell: 'pods'
      }),
      phase({
        script: 'charge', hits: 4, speed: 30, beatMs: 2800,
        adds: [], addCount: 0, armor: 2, vulnerable: true, tell: 'charge'
      })
    ]
  },

  // ── World 2 · Thornback Beetle King ──
  beetleKing: {
    id: 'beetleKing', name: 'beetleKing', size: 16, base: 'beetle',
    goo: [66, 225, 122], body: '#2f7a45', shade: '#123a22', accent: '#c8ffd8',
    crown: '#ffb03a', score: 4200,
    phases: [
      phase({
        script: 'patrol', hits: 6, speed: 6.5, beatMs: 2400,
        adds: [], addCount: 0, armor: 2, vulnerable: true, tell: 'stomp'
      }),
      phase({
        script: 'summon', hits: 7, speed: 8, beatMs: 1900,
        adds: ['caterpillar', 'beetle'], addCount: 2, armor: 2, vulnerable: true, tell: 'summon'
      }),
      phase({
        script: 'spin', hits: 6, speed: 11, beatMs: 2200,
        adds: [], addCount: 0, armor: 3, vulnerable: true, tell: 'spin'
      })
    ]
  },

  // ── World 3 · Centipede Matriarch ──
  matriarch: {
    id: 'matriarch', name: 'matriarch', size: 13, base: 'centipede',
    goo: [255, 160, 60], body: '#9c4a18', shade: '#5a2708', accent: '#ffcf8a',
    crown: '#d9f5ff', score: 6400,
    phases: [
      phase({
        script: 'patrol', hits: 8, speed: 15, beatMs: 2000,
        adds: [], addCount: 0, armor: 1, vulnerable: true, tell: 'stomp'
      }),
      phase({
        script: 'pods', hits: 7, speed: 12, beatMs: 2300,
        adds: ['centipede'], addCount: 1, armor: 1, vulnerable: false, tell: 'pods'
      }),
      phase({
        script: 'charge', hits: 7, speed: 36, beatMs: 2400,
        adds: ['moth'], addCount: 1, armor: 3, vulnerable: true, tell: 'charge'
      })
    ]
  },

  // ── World 4 · Mecha Roach Prime ──
  roachPrime: {
    id: 'roachPrime', name: 'roachPrime', size: 17, base: 'robobug',
    goo: [90, 240, 255], body: '#3d4a63', shade: '#1a2130', accent: '#6ef0ff',
    crown: '#ff3a7a', score: 9000,
    phases: [
      phase({
        script: 'shield', hits: 8, speed: 9, beatMs: 2000,
        adds: ['robobug'], addCount: 2, armor: 3, vulnerable: false, tell: 'shield'
      }),
      phase({
        script: 'summon', hits: 9, speed: 13, beatMs: 1600,
        adds: ['robobug', 'flea'], addCount: 3, armor: 2, vulnerable: true, tell: 'summon'
      }),
      phase({
        script: 'beam', hits: 8, speed: 16, beatMs: 2600,
        adds: [], addCount: 0, armor: 3, vulnerable: true, tell: 'beam'
      })
    ]
  }
}

export const BOSS_IDS: readonly BossId[] = Object.keys(BOSSES) as BossId[]

export const bossSpec = (id: BossId): BossSpec => BOSSES[id]

export const isBossId = (v: unknown): v is BossId =>
  typeof v === 'string' && v in BOSSES

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

// ─── Charge timing ──────────────────────────────────────────────────────────
//
// The three windows of a `charge` beat, in ms. They are here rather than in the
// sim because the RATIO between them is the whole difficulty of the mechanic:
// `windup` is how long the player has to recognise the tell and start a charge,
// and a shoe's own `chargeMs` (260-380 ms) has to fit inside it with room to
// react. 900 ms leaves roughly half a second of reaction time on the slowest
// shoe, which is a fair ask for a nine-year-old and a formality for an adult.

export const CHARGE_TELL_MS = 620
export const CHARGE_WINDUP_MS = 900
export const CHARGE_RUN_MS = 780
/** Recovery after a charge, during which the boss is wide open. */
export const CHARGE_SPENT_MS = 1100

/** A slam landed during the wind-up is a PERFECT counter: double damage and the
 *  charge is cancelled. This is the mechanical payoff the GDD asks for. */
export const CHARGE_COUNTER_HITS = 2

// ─── Pods ───────────────────────────────────────────────────────────────────

/** How long a pod has before it hatches, ms. */
export const POD_HATCH_MS = 5200
/** Pods dropped per beat. */
export const POD_PER_BEAT = 2
/** Pods the player must clear to end a `pods` phase. */
export const POD_QUOTA = 6
/** Pod radius, u. */
export const POD_SIZE = 4.2

// ─── Beam ───────────────────────────────────────────────────────────────────

/** How long the beam's line is drawn before it fires, ms. */
export const BEAM_TELL_MS = 900
/** How long it sweeps for, ms. */
export const BEAM_SWEEP_MS = 1600
/** Half-width of the beam, u. */
export const BEAM_HALF = 7
