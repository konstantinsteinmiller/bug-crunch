/**
 * ─── The campaign ───────────────────────────────────────────────────────────
 *
 * Four worlds, ten levels each, forty levels. Every world ends on a boss — and
 * world 1 meets its boss twice, at half strength on 1-4 and at full strength on
 * 1-10. Where the fights are is DATA (`BOSS_FIGHTS`), never arithmetic on a
 * level's index: every consumer asks `levelSpec(n).boss`.
 *
 * ── Generated, not typed out ──
 *
 * A hand-written table of forty levels is forty chances to make a level that is
 * flatter than the one before it, and no way to see the curve. So the curve is
 * stated ONCE per world — a start and an end for each dial — and each level is
 * interpolated along it. Levels that need to be special (the tutorial, the
 * first appearance of each tier, the bosses) then override exactly the fields
 * they care about, which is the only place a reader has to look to find an
 * exception.
 *
 * ── The curve's shape ──
 *
 * `ease` is not linear. Early levels in a world move slowly (a new world is
 * already a change of scenery, of fauna and of hazard — adding a difficulty
 * jump on top is three new things at once), and the last three tighten
 * sharply into the boss. `t^1.35` is that shape.
 *
 * Everything is deterministic: `levelSpec(n)` is a pure function of `n`, so the
 * board a player sees on 3-7 is the board anybody else sees on 3-7, no seed
 * required, and a save only ever has to store the level NUMBER.
 */

import type { BugId } from '@/game/bugs'
import { bugSpec, rosterForLevel } from '@/game/bugs'
import type { HazardId } from '@/game/hazards'
import type { Objective, ObjectiveTriple } from '@/game/stars'
import type { BossId } from '@/game/bosses'
import type { ShoeId } from '@/game/shoes'
import type { MoveId } from '@/game/moves'
import type { TwistId } from '@/game/twists'

export const LEVELS_PER_WORLD = 10
export const WORLD_COUNT = 4
export const TOTAL_LEVELS = LEVELS_PER_WORLD * WORLD_COUNT

export type WorldId = 1 | 2 | 3 | 4

export interface RosterEntry { id: BugId; weight: number }

export interface WorldSpec {
  id: WorldId
  /** i18n key suffix — `worlds.<theme>`. */
  theme: 'picnic' | 'backyard' | 'attic' | 'arcade'
  /** Stars that must be banked before the world opens. World 1 is always open. */
  starGate: number
  /** The fauna of this place. Debut gates inside `bugs.ts` open them in turn. */
  roster: readonly RosterEntry[]
  /** Objects scattered on the floor, chosen per level from this pool. */
  hazards: readonly HazardId[]
  /** The boss this world ends on. Where it is fought, and at what strength, is
   *  `BOSS_FIGHTS` — which a test holds to this field for every world's last
   *  level. */
  boss: BossId
  /** Floor palette, read by `floorArt.ts`. */
  floor: {
    base: string
    alt: string
    line: string
    shade: string
    /** Ambient tint laid over the whole board, RGBA. The attic is dim, the
     *  arcade is lit from below. */
    ambient: string
  }
  // ── The curve. `[first level, last level]`. ──
  /** Bugs the player must squish to clear. */
  quota: readonly [number, number]
  /** Seconds on the clock. */
  time: readonly [number, number]
  /** Bugs alive at once, cap. */
  maxAlive: readonly [number, number]
  /** ms between spawns at the START of a level, and at the END of one. The
   *  second number is smaller: a level accelerates inside itself too. */
  spawnMs: readonly [number, number]
  /** How much faster the last level's bugs move than the first's. */
  speed: readonly [number, number]
}

export const WORLDS: Record<WorldId, WorldSpec> = {
  1: {
    id: 1, theme: 'picnic', starGate: 0, boss: 'queenAnt',
    roster: [
      { id: 'ant', weight: 62 },
      // A garnish, not a course. A caterpillar the player is RIGHT to leave
      // alone never dies — only Fever or a spike-proof shoe removes one — so
      // every one rolled holds a `maxAlive` slot until the level ends. At this
      // weight a picnic level rolls two or three in a whole run, which keeps
      // "look before you stomp" alive without letting it jam the board. See the
      // 1-2 note below for the level that weights it up, and why only that one.
      { id: 'caterpillar', weight: 8 },
      { id: 'beetle', weight: 18 },
      // The sprinter is an ant with one extra rule, so it rides the ant's own
      // weight class — a clear minority of the picnic, common enough that a
      // player meets one every few seconds on the levels it is open on.
      { id: 'sprinter', weight: 26 },
      { id: 'pinatafly', weight: 10 },
      { id: 'flea', weight: 16 }
    ],
    // No salt shaker: it moved to 2-2 — see the world-1 block in `OVERRIDES`.
    hazards: ['crumbs', 'honey'],
    floor: {
      base: '#e8534f', alt: '#fdf4ea', line: '#ffffff',
      shade: '#b53a37', ambient: 'rgba(255,238,206,0.10)'
    },
    quota: [10, 44], time: [48, 66], maxAlive: [6, 15],
    spawnMs: [1100, 420], speed: [0.80, 1.02]
  },
  2: {
    id: 2, theme: 'backyard', starGate: 12, boss: 'beetleKing',
    roster: [
      { id: 'ant', weight: 34 },
      // Still a picnic ant, and still worth meeting: world 2 hands it honey and
      // a mower to be herded into, which is the second half of the lesson.
      // Worlds 3 and 4 drop it — the attic and the arcade have fauna of their
      // own, and a cast that never loses anybody gets thinner every world.
      { id: 'sprinter', weight: 20 },
      { id: 'beetle', weight: 26 },
      { id: 'caterpillar', weight: 22 },
      { id: 'stinkbug', weight: 18 },
      { id: 'flea', weight: 16 },
      { id: 'pinatafly', weight: 8 }
    ],
    // Salt third, so the generic slice (`1 + floor(index / 4)` of this list)
    // leaves 2-1..2-7 exactly as they were and hands the shaker back on 2-8..2-10
    // in the crumb pile's place. 2-2 and 2-3 pin it by hand — see `OVERRIDES`.
    hazards: ['honey', 'sweeper', 'salt', 'crumbs', 'magnet'],
    floor: {
      base: '#4b8f3a', alt: '#3c7530', line: '#6fb857',
      shade: '#2b5622', ambient: 'rgba(190,255,170,0.08)'
    },
    quota: [34, 66], time: [58, 76], maxAlive: [12, 20],
    spawnMs: [760, 330], speed: [0.96, 1.16]
  },
  3: {
    id: 3, theme: 'attic', starGate: 34, boss: 'matriarch',
    roster: [
      { id: 'centipede', weight: 24 },
      { id: 'moth', weight: 22 },
      { id: 'ant', weight: 22 },
      { id: 'beetle', weight: 18 },
      { id: 'flea', weight: 16 },
      { id: 'stinkbug', weight: 14 },
      { id: 'caterpillar', weight: 12 },
      { id: 'pinatafly', weight: 8 }
    ],
    hazards: ['cobweb', 'sweeper', 'honey', 'magnet'],
    floor: {
      base: '#7a5a3c', alt: '#63472e', line: '#95704b',
      shade: '#3f2c1c', ambient: 'rgba(24,18,48,0.30)'
    },
    quota: [56, 92], time: [66, 86], maxAlive: [16, 26],
    spawnMs: [660, 280], speed: [1.06, 1.28]
  },
  4: {
    id: 4, theme: 'arcade', starGate: 64, boss: 'roachPrime',
    roster: [
      { id: 'robobug', weight: 26 },
      { id: 'flea', weight: 20 },
      { id: 'centipede', weight: 18 },
      { id: 'beetle', weight: 18 },
      { id: 'ant', weight: 16 },
      { id: 'stinkbug', weight: 14 },
      { id: 'moth', weight: 14 },
      { id: 'caterpillar', weight: 12 },
      { id: 'pinatafly', weight: 8 }
    ],
    hazards: ['conveyor', 'sweeper', 'magnet', 'honey'],
    floor: {
      base: '#171a33', alt: '#101226', line: '#3de0ff',
      shade: '#080a18', ambient: 'rgba(90,60,255,0.18)'
    },
    quota: [78, 122], time: [74, 96], maxAlive: [20, 32],
    spawnMs: [560, 240], speed: [1.18, 1.44]
  }
}

export interface LevelSpec {
  /** 1..40, the number the save stores. */
  id: number
  world: WorldId
  /** 1..10 within its world — what the HUD prints as "2-7". */
  index: number
  /** The boss id when this is a boss level, else null. THE answer to "is this a
   *  boss level" — `isBossLevel` reads it, and so does everything else. */
  boss: BossId | null
  /**
   * How strong this level's boss is, 0..1 — `bossSpec(boss, bossScale)` is the
   * fight. 1 on every level that is not a boss level, and on every finale.
   */
  bossScale: number
  /**
   * Seconds on the clock, and (below) bugs to squish.
   *
   * ── How these two numbers were set ──
   *
   * By MEASUREMENT, with `tools/preview-video`'s scout: it plays a whole level
   * unrendered with a scripted player and reports when the quota was met. The
   * first pass was authored by feel, and a mediocre bot cleared level 2-7 in
   * thirty seconds of a hundred-and-one-second clock — the timer was never a
   * threat, the "finish with N seconds left" objective was free, and the fail
   * state effectively did not exist outside the boss levels.
   *
   * The rule now: a COMPETENT run finishes at roughly 55-70 % of the clock.
   * That leaves a careful player comfortable, a distracted one in real trouble
   * for the last ten seconds, and a level 45-70 seconds long rather than two
   * minutes — which is also the right size for a session that has to survive
   * a bus stop.
   */
  time: number
  /** Bugs to squish to clear. On a boss level this is 0 — the boss IS the
   *  quota, and a bug counter next to a boss bar is two progress readouts
   *  competing for the same glance. */
  quota: number
  roster: readonly RosterEntry[]
  /**
   * The hard ceiling on bodies alive at once.
   *
   * Also, with `spawnMs`, the answer to DEAD AIR. The first pass let a skilled
   * player empty the board and then stand on an empty floor waiting for the next
   * spawn — a third of the frames of a scouted run had nothing to aim at. The
   * board has to refill faster than a good player can clear it, or the game's
   * best players get the worst version of it.
   */
  maxAlive: number
  /** [at level start, at level end] — the director lerps between them. */
  spawnMs: readonly [number, number]
  /** Multiplier on every bug's base speed. */
  speed: number
  hazards: readonly HazardId[]
  objectives: ObjectiveTriple
  /**
   * The level's Rush Lines, in the order they fire — see `RushSpec`. Empty on a
   * boss level: the boss is the set piece there.
   */
  rushes: readonly RushSpec[]
  /** A Shoebox Trial: the shoe in the box, or a PAIR of boxes to choose from. */
  trial?: ShoeId | readonly [ShoeId, ShoeId]
  /** Where in the quota the box drops in, 0..1. */
  trialAt?: number
  /** The level's Uh-oh! Twist — see `game/twists.ts`. */
  twist?: TwistId
  /** A Bug Party, not a level: no stars, no fail, a fifteen-second clock that
   *  ends in a WIN, and a board of ants that pour out of the stolen sandwich. */
  party?: boolean
}

// ─── Rush Lines ─────────────────────────────────────────────────────────────
//
// At the turn of a level a snare roll draws a sugar trail across the board and a
// tight conga of bugs marches down it — carrying crumbs of the sandwich from the
// intro, because that is what they are doing on this blanket. One well-placed
// stomp takes four. It is the answer to the fault `RETENTION-FEATURES.md` §1
// measured first: a stomp was worth exactly ONE bug through the whole opening,
// on a board too thin for the giant shoe the store tile sells.
//
// A rush is PART of the quota, never on top of it: the bodies it brings count
// when they die, so a level with a rush in it is not a longer level, it is a
// level with a shape — a trickle, a surge, a lull, and the close.

export type RushShape =
  /** Nose to tail down a lane across the board's short axis. */
  | 'line'
  /** A ring closing on the shoe — the formation the Heel Spin answers. */
  | 'ring'
  /** A V with an armoured body at the point: slam the point, tap the tail. */
  | 'vee'

export interface RushSpec {
  /** Where it fires, as a share of the quota squished. */
  at: number
  /** What marches. */
  bug: BugId
  /** How many. */
  count: number
  shape: RushShape
  /** `vee` only: the body at the point. */
  lead?: BugId
  /** The lane is laid past a live body of this kind when one is on the board —
   *  1-2's conga walks right by the caterpillar: stomp the line, not the spikes. */
  past?: BugId
  /**
   * A PRACTICE formation for a boss trophy: it fires only for a player who owns
   * the move, and it is the move's lesson — a ring for the Heel Spin, a line for
   * the Skid. A player replaying an old level without it simply never sees it.
   */
  practice?: MoveId
}

/** How much of a level's quota one rush may bring. A conga that is half the
 *  level is the level. Pinned in `stages.test.ts`. */
export const RUSH_MAX_SHARE = 0.4

/** 0..1 along a world, eased so the last three levels do most of the work. */
const ease = (index: number): number => {
  const t = LEVELS_PER_WORLD > 1 ? (index - 1) / (LEVELS_PER_WORLD - 1) : 0
  return Math.pow(Math.max(0, Math.min(1, t)), 1.35)
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

/**
 * The two optional objectives for a level.
 *
 * Rotating rather than random, and the rotation is keyed on the level's index
 * inside its world — so every world teaches the same lessons in the same order
 * and a player who three-starred 1-4 knows what 2-4 is going to ask of them.
 * The numbers scale with the world, which is what stops world 4's "reach ×8"
 * from being free.
 */
const optionals = (world: WorldId, index: number, quota: number): [Objective, Objective] => {
  const w = world - 1
  const combo = [4, 6, 8, 12][w]!
  const bigCombo = [8, 12, 20, 30][w]!
  const acc = [55, 62, 68, 72][w]!
  switch (index % 5) {
    case 1: return [{ kind: 'combo', n: combo }, { kind: 'noSpike' }]
    case 2: return [{ kind: 'accuracy', n: acc }, { kind: 'combo', n: bigCombo }]
    case 3: return [{ kind: 'combo', n: combo }, { kind: 'time', n: Math.round(12 + w * 4) }]
    case 4: return [{ kind: 'fever', n: 1 }, { kind: 'noMiss', n: Math.max(3, 10 - w * 2) }]
    default: return [
      { kind: 'combo', n: bigCombo },
      { kind: 'score', n: Math.round(quota * 26 * (1 + w * 0.55)) }
    ]
  }
}

/**
 * Hand-authored exceptions.
 *
 * Everything NOT listed here comes off the curve. Keyed by level id so a reader
 * looking for "why is 1-1 like that" finds one entry rather than a branch
 * buried in the generator.
 */
const OVERRIDES: Record<number, Partial<LevelSpec>> = {
  // ═══ World 1: one new idea per level, and never two ═══════════════════════
  //
  // The opening used to be three levels of the same level. 1-1 was ants; 1-2
  // was ants with a crumb pile the player does nothing with; 1-3 was ants with
  // a piñata fly that, at weight 10 of 90, most players met once. Three minutes
  // of "tap the brown thing" is the whole of the retention funnel, and it was
  // spending them proving there was nothing else to learn.
  //
  // The first re-cut gave every level one new idea — and players still drifted
  // off thirty to fifty seconds in, because the first half of those ideas were
  // all ANTS: the ant, an ant that runs, a pile ants walk to. Nothing on the
  // board said "no" to the player until the beetle on 1-4, and nothing BIG
  // happened until 1-10, five or six minutes in, past where most first sessions
  // end. So the order below front-loads the two ideas that change what a tap
  // MEANS, and brings the world's boss inside the funnel at half strength:
  //
  //   1-1   the ant             the assumption
  //   1-2   the caterpillar     a stomp can be WRONG
  //   1-3   the beetle          a tap is not enough: the slam
  //   1-4   the Goliath Queen   at half strength — the slam, asked for by
  //                             something the size of a dinner plate
  //   1-5   the sprinter        the first target that reacts to YOU
  //   1-6   the crumb pile      the floor helps — and it is how you bait a sprinter
  //   1-7   the piñata fly      a target worth chasing
  //   1-8   the flea            a target that will not wait
  //   1-9   honey               the answer to the flea AND the sprinter
  //   1-10  the Goliath Queen   at full strength: she's back, and angrier
  //
  // Three rhythms are load-bearing in that order. First, a problem and its
  // answer sit on two different levels, the answer second: the sprinter on 1-5
  // is answered by the crumb pile on 1-6, the flea on 1-8 by honey on 1-9.
  // Handing over the answer on the same level as the problem is not a lesson,
  // it is a hint. Second, a hazard never debuts on the same level as a creature,
  // and a boss level debuts nothing but its boss — which is why 1-2 to 1-8 all
  // pin `hazards` below, where the generic slice (`1 + floor(index / 4)` of the
  // world's pool) would otherwise have poured a pile or honey in underneath a
  // debut. Third, the slam is taught one level before the first thing that
  // REQUIRES it: the Queen's third phase is armour a tap bounces off.
  //
  // ── Where the salt shaker went ──
  //
  // Nine slots once the Queen moved in, and ten ideas to fill them. Salt was the
  // one idea in world 1 that nothing else leaned on — it answers no creature and
  // no later level asks for it — so it moved to 2-2, the slot the caterpillar
  // vacated, where it is world 2's first new idea after the change of scenery.
  // Doubling it up with honey on 1-9 would have broken the one rule this block
  // exists for.
  //
  // ── Why SOME debut levels pin a ROSTER, and some deliberately do not ──
  //
  // A debut whose debutant is a sixth of the roll is a debut a third of players
  // never notice, so 1-2, 1-5 and 1-7 weight their own new creature up for one
  // level. (1-6 to 1-9 all pin a roster as well, but to thin the shells OUT —
  // see the block above 1-5 — so the world's ordinary mix no longer comes back
  // until the Queen.)
  //
  // The beetle is written the other way, and was MEASURED, with the headless
  // scout playing on the `average` policy in the starter sneaker — the weakest
  // player the game has to carry — back when the beetle was 1-4's:
  //
  //   beetle at the world weight (17 %)  →  12 of an 18 quota
  //   beetle weighted up to 24 %         →   2 of an 18 quota
  //
  // Six times worse, and the cause is that an armoured body a weak player will
  // not slam does not DIE: it sits in `maxAlive` forever, the board stops
  // refilling, and the level turns into a floor of beetles being tapped. An
  // armoured debutant is the one kind that must never be weighted up. (Those two
  // runs are the "never slams at all" end of the range: the scout's policies
  // let go of a charge a fifth of the way up the ring, so none of them ever
  // landed a slam until `_drive.mjs` was fixed. The rule stands; the re-measured
  // numbers are on each entry below.)
  //
  // The caterpillar is the same trap in a different body, and a harder one: in
  // any shoe but the steel boot NOTHING a player does on purpose kills it — the
  // right answer is to leave it, and a caterpillar left alone holds its slot for
  // the rest of the level. It may be weighted up on 1-2 only because that board
  // is roomy for its quota; everywhere after, it is a garnish.
  //
  // ── How the numbers below were measured ──
  //
  // `tools/preview-video` scout, portrait 360×640, starter sneaker, ten runs a
  // level (autopilot seed and spawn seed varied together). `average` is the
  // player the level has to be survivable for; `good` is there to show the
  // level is not free. Levels not listed with numbers kept the world's curve.
  //
  // 1-5 to 1-9 carry a second, larger pass: the same scout loop, the same
  // `_drive.mjs` players and the same sim, stepped in Node instead of in a page
  // (checked run for run against the browser — ten of ten identical on 1-9),
  // which makes 240 runs a level cheap: spawn seeds 1-240, portrait board, the
  // starter sneaker, no relief. "Of 240" on an entry is that pass.

  // ── 1-1: the lesson ──
  // A guaranteed win, on purpose. The whole level is ants walking in straight
  // lines with a generous clock and nothing that can punish a wrong tap. The
  // tutorial runs over it, and the first thing a new player does in this game is
  // succeed at it — which is the single highest-leverage decision in the whole
  // retention funnel.
  //
  // ── …and it has a SHAPE now ──
  //
  // Eight ants one at a time was the whole of 1-1, and `RETENTION-FEATURES.md`
  // §1 measured what that costs: one kill per stomp, an empty board a fifth of
  // the time, and nothing in the level louder than its first squish. So the
  // quota is eleven, and the middle of it is a RUSH — after the third ant, a
  // snare roll, a sugar trail, and a conga of five carrying the sandwich off in
  // crumbs, straight out of the intro cutscene. One stomp in the middle of the
  // line takes three. Three ants, a rush of five, three ants: the rush sits in
  // the level instead of ending it, and the last ant is the Big Finish.
  1: {
    quota: 11, time: 55, maxAlive: 4, spawnMs: [1500, 1050], speed: 0.72,
    hazards: [],
    objectives: [{ kind: 'clear' }, { kind: 'combo', n: 3 }, { kind: 'noMiss', n: 12 }],
    rushes: [{ at: 0.27, bug: 'ant', count: 5, shape: 'line' }]
  },
  // ── 1-2: the caterpillar, and NOTHING else ──
  //
  // 1-1's board — bare floor, a gentle clock — so the single thing different
  // about it is that some of what walks in must NOT be stomped. It is the first
  // level that can hurt the player, and the spike lesson (the hand that reaches
  // and recoils) goes up the frame the first one is on the board — ahead of
  // anything else on screen, see `armBodyLessons` in `GameScene.vue`.
  //
  // A seventh of the roll, on a board of six. Measured:
  //
  //   caterpillar 20 %, maxAlive 5  →  average 4 of 5 runs, but the bad ones
  //                                    took 23-31 spikes and 34-41 s at the cap:
  //                                    four caterpillars held four of the five
  //                                    slots, and the run that lost did so 11
  //                                    of 12
  //   caterpillar 14 %, maxAlive 6  →  average 10 of 10, 17-45 s (worst: 13 s
  //                                    left); good 10 of 10 in 12-18 s
  //
  // …and then re-measured over 30 seeds with the SPAWN seed varied too, which is
  // the harder and more honest sample — the ten-seed pass above holds one board
  // fixed. It found the same jam one notch down:
  //
  //   caterpillar 14 %, maxAlive 6  →  average 28 of 30 AND good 28 of 30, a
  //                                    median of 4-5 spikes, boards where two
  //                                    or three uneatable bodies sat in six
  //                                    slots for the whole run
  //   caterpillar 11 %, maxAlive 9  →  average 30 of 30, good 30 of 30, no jam,
  //                                    spikes down to a median of 2-3
  //
  // A level the game's own good player loses on the second board of the campaign
  // is not a lesson, it is a wall, so the cap moved rather than the clock.
  //
  // Still met by nearly everyone: 9 of the 10 `good` runs had one on the board
  // when the quota fell. The stars are the lesson in one mark (`noSpike`: kept
  // on three `average` runs in ten and two `good` ones — a foot that lands beside
  // an ant lands on the caterpillar next to it too, which is the lesson) and a
  // small chain that says "and keep squishing the ants while you do it".
  //
  // ── The Steel Boot, in a box ──
  //
  // A quarter of the way in — after the spike lesson has said "not that one" —
  // a present drops onto the blanket. Three taps and the foot is a big brown
  // boot for twelve seconds: CRUNCH, the caterpillar it was just told to leave
  // alone, no ouch. Then the sneaker is back and the Locker glows with the
  // boot's picture. It is not the answer to the caterpillar (the answer is
  // leaving it, and later buying the boot); it is the TASTE of the answer, at
  // minute one and a half, which is where the funnel needs a reason to stay.
  // The boot is spike-proof, so a trial never costs the `noSpike` star.
  //
  // The conga comes later, back in the sneaker, and walks right past a
  // caterpillar when there is one: stomp the line, not the spikes.
  2: {
    quota: 12, time: 58, maxAlive: 9, spawnMs: [1350, 900], speed: 0.80,
    hazards: [],
    roster: [{ id: 'ant', weight: 88 }, { id: 'caterpillar', weight: 11 }],
    objectives: [{ kind: 'clear' }, { kind: 'noSpike' }, { kind: 'combo', n: 4 }],
    trial: 'steelBoot', trialAt: 0.25,
    rushes: [{ at: 0.6, bug: 'ant', count: 5, shape: 'line', past: 'caterpillar' }]
  },
  // ── 1-3: the beetle. The shell is the first "a tap is not enough". ──
  //
  // ── Why this one IS pinned, against the rule above ──
  //
  // The rule is that an armoured debutant is never weighted UP. This pins it
  // DOWN, for the same reason: on the world's own mix (18 of 88 ≈ a fifth
  // beetles) 1-3 was the hardest non-boss level in the game for a weak player —
  // 15 of 30 runs, with the board JAMMED for a median of 33 of its 50 seconds.
  // Every loss is the same loss: a player who has not yet taken the slam lesson
  // taps a shell, the shell does not die, it holds its `maxAlive` slot until the
  // clock runs out, and the level stops being a level.
  //
  // Measured with the Node scout, 30 seeds per policy, spawn seed varied, the
  // starter sneaker (`average` is the weakest policy the tools carry):
  //
  //   quota 12, maxAlive  9, world mix (beetle 20 %)  →  average 15/30, jam 33 s
  //   quota 12, maxAlive 13, world mix                →  average 15/30, jam 33 s
  //     — room alone does nothing: the spare slots fill with beetles too.
  //   quota 12, maxAlive 11, beetle 13 %              →  average 25/30, jam 12 s
  //     — but only 13 of 30 GOOD runs still met a two-beetle star.
  //   quota 12, maxAlive 12, beetle 16 % (this)       →  average 24/30, jam 12 s
  //                                                      good 30/30, 7-27 s
  //
  // So the beetle stays common enough to be the level's subject — two or three
  // in a run, which is also what keeps the slam lesson armed — and the star
  // asks for ONE shell rather than two: at this weight two was 18 of 30 for a
  // good player and one is 24 of 30, and a single cracked shell is already the
  // whole gesture. Three stars stays a real ask (16 of 30 good runs).
  //
  // The caterpillar comes down with it. At the world's 8 it was costing a weak
  // player a median of six spike hits here, on top of the jam; at 4 it is the
  // garnish 1-2 taught it to be.
  //
  // ── The V ──
  //
  // Its rush is a V with a beetle at the point: the tap bounces off the point,
  // the slam lesson follows the bounce, and the slam that answers it flips the
  // beetle onto its back (`BugSpec.flips`) — one more tap and it is done, and
  // the ants behind it were in the circle too. A guaranteed shell on the level
  // whose subject is shells, without weighting the beetle up (see above).
  3: {
    quota: 12, maxAlive: 12,
    hazards: [],
    roster: [{ id: 'ant', weight: 72 }, { id: 'caterpillar', weight: 4 }, { id: 'beetle', weight: 15 }],
    objectives: [{ kind: 'clear' }, { kind: 'kind', id: 'beetle', n: 1 }, { kind: 'noSpike' }],
    rushes: [{ at: 0.4, bug: 'ant', count: 4, shape: 'vee', lead: 'beetle' }]
  },
  // ── 1-4: the Goliath Queen, at half strength (`BOSS_FIGHTS`) ──
  //
  // All three phases of the 1-10 fight at half the count — 3/3/2 hits, three
  // eggs, one ant a beat, softer clocks; `scaleBoss` has the whole definition.
  // On the curve's 52-second clock:
  //
  //   average  12 of 15 runs, down at 13-42 s; every loss is phase 3 with a
  //            quarter or an eighth of the bar left and no slam landed in an
  //            open window in forty seconds of trying
  //   good     10 of 10, 10-15 s
  //   (full Queen on 1-10: average 5 of 10, good 15-18 s)
  //
  // Re-measured with the brood (every boss fight's eggs — "The brood" in
  // `bosses.ts`), the same fifteen seeds, spawn and autopilot varied together:
  //
  //   average  12 of 15 (17 of 20), down at 12-47 s; the three losses the same
  //            phase-3 loss as before, a quarter or an eighth of the bar left
  //   good     10 of 10, 10-11 s
  //   (1-10: average 8 of 10 (14 of 20), 24-62 s; good 10 of 10, 16-20 s)
  //
  // The Queen's third phase lays one egg at the end of a spent charge and holds
  // still while she does — the egg is the tell for her widest window — and at
  // half strength that hold is a clock `scaleBoss` softens like every other
  // window. Without that, the same seeds lost one more run on 1-4: a weak player
  // wandering off the Queen after her eggs.
  //
  // A 60-second clock was tried and changed nothing — the same runs lost, the
  // same way — so the curve stays. Bare floor, like every debut.
  //
  // The stars: `noSpike` stays from the finale's set (nothing here has spikes),
  // and the finale's chain star does not come with it. Before the brood no
  // policy chained past ×3 on either Queen; with it a chain is POSSIBLE here —
  // a player hunting it, letting a clutch hatch and slamming the cluster, reaches
  // ×3 in 8 of 10 scouted runs — but it is still the first boss a child meets,
  // and 1-10 is where the chain star lives. Beating her with 25 seconds to spare
  // is the skill ask instead: `good` does, `average` about half the time.
  4: {
    hazards: [],
    objectives: [{ kind: 'clear' }, { kind: 'noSpike' }, { kind: 'time', n: 25 }]
  },
  // ═══ 1-5 to 1-9: the middle of the world, sized for the weakest player ═══
  //
  // These were the world at full density, and on them the `average` player —
  // the one a level has to carry — lost nearly every run, while `good` cleared
  // each in 16-21 s:
  //
  //   average, of 240    1-5 140 · 1-6 41 · 1-7 3 · 1-8 16 · 1-9 10
  //
  // Four walls in a row between the half-strength Queen and the full one, in the
  // stretch of the campaign a first session actually reaches. The levers were
  // measured one at a time (20-60 runs a variant), in order of what each did:
  //
  //   the beetle, 13-16 % → 2 %   1-6..1-9 6/1/3/1 → 16/8/6/5 of 20 at 6 %. The
  //                               debut's trap again, as a garnish: a shell is
  //                               the biggest thing on the floor, a player who
  //                               will not slam taps it anyway, and every tap
  //                               clangs. At 3 % a LOST 1-9 still ended with more
  //                               than three times the beetles of a won one.
  //   `maxAlive` +3               1-8 9 → 16, 1-9 8 → 12 of 20. The opposite of
  //                               the obvious fix, and −2 helped nothing: a slot
  //                               a shell or a caterpillar holds is a smaller
  //                               share of a roomier board, and a dense board is
  //                               where one stomp takes two ants.
  //   quota × 0.88                the rest of the gap (19/16/16/13 → 20/19/18/16
  //                               of 20). A weak player lands about one blow a
  //                               second whatever the board does, so past a
  //                               point the ask itself had to come down.
  //   the caterpillar, 6-7 % → 3 % two or three a level: still met, still a
  //                               reason to look before stomping.
  //
  // …and three that did NOT help, so nobody spends a pass on them again:
  // thinning the sprinter (39/35/39/32 → 39/31/29/34 of 40 — a winded sprinter
  // stands still, and the crumbs and the honey both stop one; 1-9 even plays
  // better with a quarter of its roll sprinters than a fifth, 44 → 53 of 60),
  // slower bugs (×0.9, and a ×0.97-0.92 ramp: both inside the noise), and a
  // longer clock (1-9 at 66 s: 47 of 60, against 45 at 63).
  //
  // So the clocks, the spawn ramps and the speeds are still the curve's. After:
  //
  //   average, of 240    1-5 205 · 1-6 234 · 1-7 219 · 1-8 214 · 1-9 206
  //   good, of 240       every run, medians 13-16 s
  //
  // Easiest on the crumb pile — the level that hands over an answer — and then
  // gently harder, level on level, into the Queen. The weak player's own wins
  // now land at 40-66 % of the clock, where `time` wants a competent run; `good`
  // finishes in about a quarter of it. It never was in that band here (29-37 %
  // before), and more clock would only have moved it further out, so what a
  // strong player chases on these levels is the THIRD star: each one is measured
  // below to take real play.

  // ── 1-5: the sprinter ant ──
  //
  // The first target that watches YOU, on a bare floor, weighted up to two
  // fifths of the roll so the rule becomes a rule rather than a glitch. The
  // beetle is thinned to a garnish here — it is not the debutant, and a floor
  // of shells under a new rule is two lessons:
  //
  //   beetle 14 %, caterpillar 6 %  →  average 1 of 5, jammed 33-46 s
  //   beetle 8 %, caterpillar 4 %   →  average 7 of 10; good 10 of 10, 14-20 s
  //                                    (140 of 240 in the second pass)
  //   beetle 4 %, caterpillar 3 %   →  average 205 of 240, jam 29 → 9 s; good
  //                                    240 of 240, 15-17 s
  //
  // The last step rode along with 1-6..1-9: left at 58 %, this would have been
  // the hardest board between the two Queens for the weakest player, and a ramp
  // that eases off after its first level is a wall with a slope behind it.
  //
  // The stars point straight at the lesson: four sprinters says "you have to
  // actually catch these", and a miss budget says how — a player who chases one
  // across the board burns taps on bare floor, and a player who waits out the
  // four-tenths of a second it spends winded burns none.
  5: {
    hazards: [],
    roster: [
      { id: 'ant', weight: 53 }, { id: 'caterpillar', weight: 3 },
      { id: 'beetle', weight: 4 }, { id: 'sprinter', weight: 40 }
    ],
    objectives: [
      { kind: 'clear' }, { kind: 'kind', id: 'sprinter', n: 4 }, { kind: 'noMiss', n: 10 }
    ],
    // It opens on the Queen's own trick: a ring of ants closing on the shoe, and
    // the hand double-tapping — WHOOSH, the Heel Spin she dropped on 1-4. Then a
    // conga, and from here on the slam is also a way to FINISH a level.
    rushes: [
      { at: 0.08, bug: 'ant', count: 6, shape: 'ring', practice: 'spin' },
      { at: 0.55, bug: 'ant', count: 6, shape: 'line' }
    ]
  },
  // ── 1-6: the crumb pile ──
  // The first thing on the floor that is not a bug — and it PULLS ants and
  // sprinters alike, so the first lesson about the floor is that the floor
  // HELPS, and it arrives one level after the creature it is the answer to.
  // Sprinters stay near their 1-5 share (31 %): this is the level that answers
  // them.
  //
  //   world mix, quota 25, maxAlive 10   →  average 41 of 240, jammed 41 s
  //   beetle 2 %, quota 22, maxAlive 13  →  average 234 of 240 in 22 s; good
  //                                         240 of 240 in 13 s
  //
  // Both stars are the pile. Five sprinters says "let it bait them" (the weak
  // player: 91 % of runs), and a ×12 chain says "take the knot it gathers" —
  // the first big chain of the game, made by `good` in 69 % of runs and by
  // `average` in 55 %, because the pile does half the work. The old pair (×5,
  // ten misses) was met by everybody who cleared, `good` included.
  6: {
    quota: 22, maxAlive: 13,
    hazards: ['crumbs'],
    roster: [
      { id: 'ant', weight: 64 }, { id: 'caterpillar', weight: 3 },
      { id: 'beetle', weight: 2 }, { id: 'sprinter', weight: 31 }
    ],
    objectives: [{ kind: 'clear' }, { kind: 'kind', id: 'sprinter', n: 5 }, { kind: 'combo', n: 12 }],
    // Beetle Bowling's level. The V's point is a beetle and its lane runs through
    // the crumb pile, where the ants behind it knot up — slam the point over and
    // flick it through the knot. The beetle is 2 % of this roll (see above), so
    // the rush is where the ball comes from.
    rushes: [
      { at: 0.3, bug: 'ant', count: 6, shape: 'vee', lead: 'beetle' },
      { at: 0.7, bug: 'ant', count: 6, shape: 'line' }
    ]
  },
  // ── 1-7: the piñata fly ──
  // One target worth chasing — and the first level where chasing is the RIGHT
  // answer, two levels after the one where it was the wrong one. It gets a level
  // of its own instead of being a rare surprise on somebody else's.
  //
  //   piñata 16 %, beetle 16 %, quota 30, maxAlive 11  →  average 3 of 240
  //   piñata 10 %, beetle 2 %, quota 26, maxAlive 14   →  average 219 of 240
  //                                                       in 37 s; good 240 of
  //                                                       240 in 16 s
  //
  // Five blows on a zigzag is a lot of a weak player's clock, so the fly is
  // weighted up by less than it was — a tenth of the roll, still half again the
  // world's share, and 2.6 piñatas in a quota's worth of kills: two of them in
  // 73 % of `average` runs. Chasing one lets a chain lapse, which is what makes
  // the ×12 the real ask here: `good` 77 %, `average` 18 %.
  7: {
    quota: 26, maxAlive: 14,
    hazards: ['crumbs'],
    roster: [
      { id: 'ant', weight: 61 }, { id: 'caterpillar', weight: 3 }, { id: 'beetle', weight: 2 },
      { id: 'sprinter', weight: 24 }, { id: 'pinatafly', weight: 10 }
    ],
    objectives: [{ kind: 'clear' }, { kind: 'kind', id: 'pinatafly', n: 2 }, { kind: 'combo', n: 12 }],
    // The first Uh-oh! The lemonade glass from the intro tips over and a slick
    // lane runs across the blanket: bodies wade in it, and a foot pressed and
    // DRAGGED through it skids and ploughs the lot. The drag is met here, worn on
    // 1-8 in the Roller Skate, and owned for good off the Queen on 1-10.
    rushes: [
      { at: 0.3, bug: 'sprinter', count: 5, shape: 'line' },
      { at: 0.75, bug: 'ant', count: 7, shape: 'line' }
    ],
    twist: 'spill'
  },
  // ── 1-8: the flea ──
  // The first target that moves when you aim at it — a different question from
  // the sprinter's, and the level is deliberately bare of honey so the player
  // feels the question before they are handed the tool. The roster is pinned
  // only to thin the beetle: the flea keeps the world's own share (12 % against
  // 11), so the debut is no rarer — three or four fleas at 1-8's quota.
  //
  //   world mix, quota 34, maxAlive 12   →  average 16 of 240, jammed 46 s
  //   beetle 2 %, quota 30, maxAlive 15  →  average 214 of 240 in 40 s; good
  //                                         240 of 240 in 16 s
  //
  // Two fleas, not three: the tool is still a level away, and the weak player
  // took three in 65 % of runs, two in 79 %. The chain climbs to ×20 — `good`
  // 69 %, `average` one run in ten.
  8: {
    quota: 30, maxAlive: 15,
    hazards: ['crumbs'],
    roster: [
      { id: 'ant', weight: 55 }, { id: 'caterpillar', weight: 3 }, { id: 'beetle', weight: 2 },
      { id: 'sprinter', weight: 21 }, { id: 'pinatafly', weight: 7 }, { id: 'flea', weight: 12 }
    ],
    objectives: [{ kind: 'clear' }, { kind: 'kind', id: 'flea', n: 2 }, { kind: 'combo', n: 20 }],
    // The Roller Skate in a box: the drag from the spill, on any floor, for
    // twelve seconds — a flea under a plough is a flea that did not get to leap.
    trial: 'rollerSkate', trialAt: 0.25,
    rushes: [
      { at: 0.45, bug: 'sprinter', count: 6, shape: 'line' },
      { at: 0.75, bug: 'ant', count: 7, shape: 'line' }
    ]
  },
  // ── 1-9: honey ──
  // The answer to the flea, handed over one level after the problem, and to the
  // sprinter four levels after that one — a puddle grounds both, and a sprinter
  // that runs into one stops. Stated here rather than left to the slice so a
  // reader looking for "when does honey arrive" finds it in the table with
  // everything else. A quarter of the roll is sprinters for the same reason
  // (see the block above: 44 → 53 of 60 against a fifth).
  //
  //   world mix, quota 39, maxAlive 14                  →  average 10 of 240
  //   beetle 2 %, sprinter 25 %, quota 34, maxAlive 17  →  average 206 of 240
  //                                                        in 42 s; good 240
  //                                                        of 240 in 16 s
  //
  // The hardest of the four for the weak player, on purpose: it is the step
  // before the full Queen. The star is the flea again, one more of them now that
  // there is a tool for it (71 % of `average` runs, 83 % of `good`). The third
  // is the Queen's own `noSpike`, asked on the busiest board yet: `good` keeps it
  // in 85 % of runs and `average` in 46 % — where a ×20 chain on a quota this
  // long was 98 % and 13 %, free for one and out of reach for the other.
  9: {
    quota: 34, maxAlive: 17,
    hazards: ['crumbs', 'honey'],
    roster: [
      { id: 'ant', weight: 51 }, { id: 'caterpillar', weight: 3 }, { id: 'beetle', weight: 2 },
      { id: 'sprinter', weight: 25 }, { id: 'pinatafly', weight: 7 }, { id: 'flea', weight: 12 }
    ],
    objectives: [{ kind: 'clear' }, { kind: 'kind', id: 'flea', n: 3 }, { kind: 'noSpike' }],
    rushes: [
      { at: 0.35, bug: 'ant', count: 7, shape: 'vee', lead: 'beetle' },
      { at: 0.7, bug: 'sprinter', count: 7, shape: 'line' }
    ]
  },

  // ── World 2 ──
  // 2-2: the salt shaker, moved from 1-8 (see "Where the salt shaker went"). The
  // first floor object the PLAYER sets off rather than walks around: a stomp on
  // it panics everything in the cloud into a straight line, which is the
  // cheapest big chain in the backyard — hence the star. This slot used to be
  // the caterpillar's debut, which is 1-2 now.
  12: {
    hazards: ['honey', 'salt'],
    objectives: [{ kind: 'clear' }, { kind: 'combo', n: 12 }, { kind: 'noMiss', n: 8 }]
  },
  // 2-3: the shaker again, so the level after its debut does not take it away.
  13: { hazards: ['honey', 'salt'] },
  // 2-4: the stink bug.
  14: {
    objectives: [{ kind: 'clear' }, { kind: 'kind', id: 'stinkbug', n: 4 }, { kind: 'accuracy', n: 60 }]
  },
  // 2-5: the mower. Free kills for anyone who can herd.
  15: { hazards: ['sweeper', 'honey'] },
  // 2-7: the magnet, and with it the beetle multi-squish.
  17: { hazards: ['magnet', 'sweeper'] },

  // ── World 3 ──
  // 3-1: the cobweb and the centipede, together, because the web is what makes
  // a centipede stand still long enough to read.
  21: {
    hazards: ['cobweb'],
    objectives: [{ kind: 'clear' }, { kind: 'kind', id: 'centipede', n: 2 }, { kind: 'combo', n: 8 }]
  },
  // 3-3: the moth. The first thing the foot cannot reach at will.
  23: {
    objectives: [{ kind: 'clear' }, { kind: 'kind', id: 'moth', n: 5 }, { kind: 'combo', n: 12 }]
  },
  // 3-6: everything at once, in the dark.
  26: { hazards: ['cobweb', 'sweeper', 'magnet'] },

  // ── World 4 ──
  // 4-1: the conveyor and the robo-bug.
  31: {
    hazards: ['conveyor'],
    objectives: [{ kind: 'clear' }, { kind: 'kind', id: 'robobug', n: 5 }, { kind: 'combo', n: 12 }]
  },
  // 4-5: the arcade at full tilt.
  35: { hazards: ['conveyor', 'sweeper', 'magnet'] },
  // 4-9: the last level before the last boss. The hardest board in the game
  // that is not a boss, and it is allowed to be.
  39: {
    maxAlive: 30, spawnMs: [420, 300], speed: 1.5,
    hazards: ['conveyor', 'sweeper', 'magnet', 'honey'],
    objectives: [{ kind: 'clear' }, { kind: 'combo', n: 30 }, { kind: 'feverKills', n: 14 }]
  }
}

/** One boss fight: who, and how hard. */
export interface BossFight {
  boss: BossId
  /** 0..1 of the boss's full strength — see `scaleBoss` in `bosses.ts`. */
  scale: number
}

/**
 * ─── Where the bosses are ───────────────────────────────────────────────────
 *
 * The one table that says which levels are boss fights. It used to be
 * arithmetic — "the tenth level of every world" — spread across the generator,
 * the payout, the tests and the stinger, and moving the first boss would have
 * meant finding every copy of `=== 10`. Now `levelSpec(n).boss` is the only
 * question anybody asks, and this is the only place that answers it.
 *
 * Every world still ENDS on its own boss at full strength (a test holds this
 * table to `WORLDS[w].boss`). World 1 also meets its Queen early, at half
 * strength — see the world-1 block in `OVERRIDES` for why 1-4, and `scaleBoss`
 * for what "half" is.
 */
export const BOSS_FIGHTS: Readonly<Record<number, BossFight>> = {
  4: { boss: 'queenAnt', scale: 0.5 },
  10: { boss: 'queenAnt', scale: 1 },
  20: { boss: 'beetleKing', scale: 1 },
  30: { boss: 'matriarch', scale: 1 },
  40: { boss: 'roachPrime', scale: 1 }
}

/**
 * Boss levels.
 *
 * A boss level has no quota and no roster ramp of its own — the boss script
 * spawns its own adds — so the curve fields are set to the values the fight
 * actually wants rather than interpolated.
 */
const BOSS_LEVEL: Partial<LevelSpec> = {
  quota: 0, maxAlive: 16, spawnMs: [1400, 900], rushes: []
}

// ─── Something new on every level ───────────────────────────────────────────
//
// World 1 authors its set pieces entry by entry above. Past it, the new moments
// are tables, keyed by level, so a reader asking "what is 3-4 about" finds it in
// one line: the twist, the trial, the practice formation that follows a trophy.

/**
 * The formation that opens the level after a trophy, for a player who owns the
 * move — the move's lesson, played rather than shown. 1-5's ring is authored in
 * its own entry; these are the three that follow the world bosses.
 */
const PRACTICE: Readonly<Record<number, RushSpec>> = {
  11: { at: 0.08, bug: 'ant', count: 6, shape: 'line', practice: 'skid' },
  21: { at: 0.08, bug: 'beetle', count: 5, shape: 'ring', practice: 'quake' },
  31: { at: 0.08, bug: 'flea', count: 5, shape: 'ring', practice: 'echo' }
}

/**
 * Shoebox Trials past world 1 — about one level in three, and from world 2 in
 * PAIRS on the seventh level: two boxes on opposite sides, open one and the
 * other goes *poof*. A shoe the player already owns is swapped for one they do
 * not at run time (see the sim's `startTrial`), so a box is never a shrug.
 */
const TRIALS: Readonly<Record<number, ShoeId | readonly [ShoeId, ShoeId]>> = {
  13: 'bunnySlipper',
  17: ['cleatBoot', 'electricSock'],
  22: 'steelBoot',
  28: ['rollerSkate', 'bunnySlipper'],
  32: 'electricSock',
  37: ['cleatBoot', 'steelBoot']
}

/** Where a trial's box drops in, as a share of the quota. */
export const TRIAL_AT = 0.35

/**
 * The Uh-oh! Twists past world 1's spill — exactly the levels that had nothing
 * new of their own: no creature debut, no floor object, no boss.
 */
const TWIST_LEVELS: Readonly<Record<number, TwistId>> = {
  19: 'sprinkler',
  24: 'blackout',
  27: 'draft',
  33: 'surge',
  36: 'glitch'
}

/**
 * The body a generated rush is made of: the lightest thing on the roster a tap
 * kills cleanly — no armour, no spikes, no wings, no tail, no stink. A conga of
 * caterpillars is a wall, and a conga of beetles is a different feature.
 */
const rushBody = (roster: readonly RosterEntry[]): BugId => {
  let best: BugId = 'ant'
  let size = Infinity
  for (const r of roster) {
    const b = bugSpec(r.id)
    if (b.armor > 0 || b.spiky || b.airborne || b.segments > 0 || b.stinks || b.hp > 1) continue
    if (b.size < size) { size = b.size; best = r.id }
  }
  return best
}

/**
 * A level's rushes, off the curve: one at the turn early in a world, two (35 %
 * and 70 %) from the fifth level on, five bodies growing to twelve along the
 * world's own `ease`. Each world lines them up its own way — the backyard in
 * V's with a beetle at the point to slam or bowl, the arcade with a robobug at
 * the point — and never more than `RUSH_MAX_SHARE` of the quota in one.
 */
const generatedRushes = (
  world: WorldId, index: number, quota: number, roster: readonly RosterEntry[]
): RushSpec[] => {
  if (quota <= 0) return []
  const bug = rushBody(roster)
  const count = Math.max(3, Math.min(Math.floor(quota * RUSH_MAX_SHARE), Math.round(lerp(5, 12, ease(index)))))
  const has = (id: BugId): boolean => roster.some((r) => r.id === id)
  const vee = world === 2 && has('beetle') ? 'beetle' : world === 4 && has('robobug') ? 'robobug' : null
  const ats = index >= 5 ? [0.35, 0.7] : [0.5]
  return ats.map((at, i) => vee && i === 0
    ? { at, bug, count, shape: 'vee' as const, lead: vee }
    : { at, bug, count, shape: 'line' as const })
}

// ─── Bug Party ──────────────────────────────────────────────────────────────
//
// After 1-2, and after the sixth level of every world, the ants throw a party
// with the sandwich they stole in the intro — and the player crashes it in the
// gilded boot for fifteen seconds with nothing to lose. It is not a level: no
// stars, no fail, never a gate, and never followed by an interstitial. Two
// learning levels, then pure release — the Candy Crush "sugar crush" moment.
//
// ── Why it moved from after 1-3 ──
//
// Measured. In a blind test of five first-time players the first party landed
// at 36 s, 38 s and 63 s, and every player who reached one rated it the best
// thing in the game and played on for minutes. The two who never saw one quit
// at 33 s and 48 s — a few seconds short of it. The game's loudest promise was
// sitting just past the edge of the shortest patience it has to survive, so it
// moved one level earlier, which is about twenty seconds earlier in the run.
//
// It stays at 1-2 rather than 1-1 because a party is release, and release needs
// something to be released FROM: 1-2 is the first board that can hurt (the
// spike), so the party answers the game's first "ouch".

/** Levels a party follows. */
export const PARTY_AFTER: readonly number[] = [2, 6, 16, 26, 36]

export const partyAfter = (level: number): boolean => PARTY_AFTER.includes(clampLevel(level))

/** A party's clock, seconds, and the ceiling on bodies it pours out. */
export const PARTY_SECONDS = 15
export const PARTY_MAX_ALIVE = 40

/**
 * Who comes to the party, per world. Mostly ants — it is their party — with the
 * world's own guest: beetles in the backyard (a gilded boot pops a shell like a
 * grape), moths in the attic, robobugs in the arcade.
 */
const PARTY_GUESTS: Readonly<Record<WorldId, readonly RosterEntry[]>> = {
  1: [{ id: 'ant', weight: 80 }, { id: 'sprinter', weight: 20 }],
  2: [{ id: 'ant', weight: 70 }, { id: 'beetle', weight: 30 }],
  3: [{ id: 'ant', weight: 65 }, { id: 'moth', weight: 35 }],
  4: [{ id: 'ant', weight: 65 }, { id: 'robobug', weight: 35 }]
}

/**
 * The party that follows `level`, as a level the sim can run. Its `id` is the
 * level it follows, so the floor, the lighting and the world are that level's.
 */
export const partySpec = (level: number): LevelSpec => {
  const id = clampLevel(level)
  const world = worldOf(id)
  const w = WORLDS[world]
  return {
    id,
    world,
    index: indexOf(id),
    boss: null,
    bossScale: 1,
    time: PARTY_SECONDS,
    quota: 0,
    roster: PARTY_GUESTS[world],
    maxAlive: PARTY_MAX_ALIVE,
    spawnMs: [140, 110],
    speed: w.speed[0],
    hazards: [],
    objectives: [{ kind: 'clear' }, { kind: 'clear' }, { kind: 'clear' }],
    rushes: [],
    party: true
  }
}

/** Coins a party pays: one for every four bodies, capped so a party is a treat
 *  and never the best-paying thing in the game. */
export const partyPayout = (kills: number): number =>
  Math.max(0, Math.min(40, Math.floor(Math.max(0, kills) / 4)))

/**
 * A world boss's stars: the clear, no spikes, and a chain.
 *
 * ── The chain, re-set by measurement ──
 *
 * The first table asked for ×6, ×10, ×16 and ×24, and was written when a boss
 * fight had almost nothing in it to chain: scouted, no policy got past ×3 on the
 * Queen, the Matriarch averaged ×0, and Roach Prime's star was unreachable twice
 * over (its shield phase could not be hurt at all). A boss chain star was a star
 * nobody could earn — and a ×6 is really a ×8, because the ladder has no ×6 rung.
 *
 * Every fight has eggs now, and the hatchlings are the chain (see "The brood" in
 * `bosses.ts`). The asks are the rungs a GOOD player who goes for the star
 * reaches — scouted with the `good` autopilot steered to pop eggs, let clutches
 * hatch and slam the clusters before finishing the boss, ten runs a boss, in the
 * fixture's steel boot past world 1:
 *
 *   1-10  ×8    reached ×12 in 10 of 10; played straight, `average` ×3-×5
 *   2-10  ×5    ×5 or better in 5 of 10 — the King's shells and spikes are a
 *               thinner floor to chain on, so his ask is a rung lower
 *   3-10  ×8    ×8 or better in 9 of 10; played straight, `average` ×3-×8
 *   4-10  ×8    ×8 or better in 8 of 10; played straight, `average` ×5
 *
 * A star a good player reaches when they try, and a weak one does not reach by
 * accident — which is what a star is for.
 */
const bossObjectives = (world: WorldId): ObjectiveTriple => {
  const combo = [8, 5, 8, 8][world - 1]!
  return [{ kind: 'clear' }, { kind: 'noSpike' }, { kind: 'combo', n: combo }]
}

/** Clamp any incoming level number onto the campaign. */
export const clampLevel = (n: number): number => {
  if (!Number.isFinite(n)) return 1
  return Math.max(1, Math.min(TOTAL_LEVELS, Math.floor(n)))
}

export const worldOf = (level: number): WorldId =>
  (Math.floor((clampLevel(level) - 1) / LEVELS_PER_WORLD) + 1) as WorldId

export const indexOf = (level: number): number =>
  ((clampLevel(level) - 1) % LEVELS_PER_WORLD) + 1

/** "3-7" — the label the HUD and the banner print. */
export const levelLabel = (level: number): string =>
  `${worldOf(level)}-${indexOf(level)}`

/** Is `level` a boss fight — at any strength. Read off `BOSS_FIGHTS`, which is
 *  exactly what `levelSpec(level).boss` is built from. */
export const isBossLevel = (level: number): boolean =>
  BOSS_FIGHTS[clampLevel(level)] !== undefined

/**
 * Build one level. Pure and total: any number in, a valid level out.
 *
 * Memoised because the result is immutable and the HUD, the director, the
 * result screen and the art preloader all ask for the same one repeatedly
 * inside a single frame.
 */
const cache = new Map<number, LevelSpec>()

export const levelSpec = (levelRaw: number): LevelSpec => {
  const id = clampLevel(levelRaw)
  const hit = cache.get(id)
  if (hit) return hit

  const world = worldOf(id)
  const index = indexOf(id)
  const w = WORLDS[world]
  const t = ease(index)
  const fight = BOSS_FIGHTS[id] ?? null

  const quota = Math.round(lerp(w.quota[0], w.quota[1], t))
  const base: LevelSpec = {
    id,
    world,
    index,
    boss: fight ? fight.boss : null,
    bossScale: fight ? fight.scale : 1,
    time: Math.round(lerp(w.time[0], w.time[1], t)),
    quota,
    roster: rosterForLevel(w.roster, id),
    maxAlive: Math.round(lerp(w.maxAlive[0], w.maxAlive[1], t)),
    spawnMs: [
      Math.round(lerp(w.spawnMs[0], w.spawnMs[1], t)),
      Math.round(lerp(w.spawnMs[0], w.spawnMs[1], t) * 0.72)
    ],
    speed: Number(lerp(w.speed[0], w.speed[1], t).toFixed(3)),
    // One hazard early in a world, two by the middle, three at the end — drawn
    // in the world's own order so the first one a player meets is always the
    // same one.
    hazards: w.hazards.slice(0, Math.min(w.hazards.length, 1 + Math.floor(index / 4))),
    objectives: [{ kind: 'clear' }, ...optionals(world, index, quota)] as unknown as ObjectiveTriple,
    // Filled in below, once the override has had its say on the quota.
    rushes: []
  }

  const override = OVERRIDES[id] ?? {}
  const spec: LevelSpec = {
    ...base,
    ...(fight ? { ...BOSS_LEVEL, objectives: bossObjectives(world) } : {}),
    ...override
  }

  // A roster override may name a bug before its debut; re-filter so the debut
  // gate is the single authority and an override cannot accidentally leak the
  // robo-bug into world 1.
  const roster = rosterForLevel(spec.roster, id)
  // The set pieces: an authored entry wins outright; everything else comes off
  // the tables and the curve. A practice formation is prepended — it OPENS the
  // level it belongs to.
  const rushes = override.rushes
    ?? (fight ? [] : generatedRushes(world, index, spec.quota, roster))
  const practice = PRACTICE[id]
  const trial = override.trial ?? TRIALS[id]
  const twist = override.twist ?? TWIST_LEVELS[id]
  const final: LevelSpec = {
    ...spec,
    roster,
    rushes: practice ? [practice, ...rushes] : rushes,
    ...(trial ? { trial, trialAt: override.trialAt ?? TRIAL_AT } : {}),
    ...(twist ? { twist } : {})
  }
  cache.set(id, final)
  return final
}

/** Every level, in order. Used by the balance tests and the art preloader. */
export const allLevels = (): LevelSpec[] =>
  Array.from({ length: TOTAL_LEVELS }, (_, i) => levelSpec(i + 1))

/**
 * Which bug designs a level can put on screen — what the art preloader needs
 * so the splash waits for THIS level's cast and not the whole bestiary.
 */
export const levelCast = (level: number): BugId[] => {
  const spec = levelSpec(level)
  return spec.roster.map((r) => r.id)
}

/**
 * Is `level` reachable with `stars` banked?
 *
 * Only WORLDS are gated, never individual levels: being stuck one level from
 * the end of a world and being told to go back and re-star old levels is the
 * single most reliable way to lose a child player. The gate sits at the world
 * boundary, where the game has just given them a boss clear and a payout, and
 * where going back is a victory lap rather than a punishment.
 */
export const isLevelUnlocked = (level: number, stars: number): boolean =>
  stars >= WORLDS[worldOf(level)].starGate

/** The first level of the deepest world the player has opened. */
export const worldOpenLevel = (world: WorldId): number =>
  (world - 1) * LEVELS_PER_WORLD + 1

/** Stars still needed to open the next world, or 0 when nothing is locked. */
export const starsToNextWorld = (level: number, stars: number): number => {
  const next = worldOf(level) + 1
  if (next > WORLD_COUNT) return 0
  return Math.max(0, WORLDS[next as WorldId].starGate - stars)
}

/**
 * Coins a cleared level pays.
 *
 * Priced off the WORLD rather than off the score, so the payout is something a
 * player can plan around ("two more levels and I can afford the boot") instead
 * of a number that swings with how well a particular run went. The score has
 * the leaderboard to be interesting on.
 *
 * The boss bonus scales with the boss: the half-strength Queen on 1-4 pays half
 * the Queen's bonus (60 against 120), which is still the biggest purse a new
 * player has seen by then, and leaves the full one for the fight that earns it.
 */
export const levelPayout = (level: number, stars: number): number => {
  const world = worldOf(level)
  const spec = levelSpec(level)
  const base = 20 + world * 14
  const bossBonus = spec.boss ? (90 + world * 30) * spec.bossScale : 0
  return Math.round(base + stars * (8 + world * 4) + bossBonus)
}
