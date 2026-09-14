/**
 * ─── The seeded board, for the portals that can never gain a player ─────────
 *
 * Poki forbids every external runtime request and Yandex rejects third-party
 * storage URLs, so those builds ship `VITE_LEADERBOARD_URL` empty: they cannot
 * READ the board and, more to the point here, they can never WRITE to it. Their
 * baked copy is not a stale snapshot of a living board — it is the whole board,
 * for the life of the build, and nobody playing it will ever appear on it.
 *
 * Seeding it from the live board does not work either, and the arithmetic is the
 * reason. The live board is 2 422 players of whom 56 % never got past stage 2
 * and 1.5 % passed stage 20, because it is a record of everyone who ever opened
 * the game once. Ranking a Poki player against that says more about the sample
 * than about them.
 *
 * So this generates a board from a stated RETENTION CURVE instead. It is
 * modelled data, and it is written down as modelled data — see `SURVIVAL`.
 *
 * ── Determinism is the point ──
 *
 * Every number below comes out of a seeded PRNG, so re-running this produces a
 * byte-identical file. A board that churned on every run would move every
 * player's rank for no reason, and a rank that moves without the player doing
 * anything is worse than no rank.
 *
 *     pnpm leaderboard:seed
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Where the board is written.
 *
 * A function, not a top-level constant, so importing this module costs nothing
 * but the parse. `leaderboardSeed.test.ts` imports `stageCounts` and the score
 * model from here, and under Vitest `import.meta.url` is not a `file:` URL —
 * resolving it at module scope threw "The URL must be of scheme file" and took
 * the whole suite with it before a single case ran. Only the CLI needs the
 * path, and only the CLI asks for it.
 */
export const seedFile = () =>
  resolve(fileURLToPath(new URL('../data/leaderboard-seed.json', import.meta.url)))

/**
 * How many players the board claims.
 *
 * Sized to what this game plausibly has, not to what looks impressive. A board
 * claiming six figures next to a game nobody has heard of is the tell that it
 * was invented; the sibling projects run 366 (tower-siege) and ~5 000
 * (survivalist) on real traffic, and this sits between them.
 *
 * ── Changing it changes the tail ──
 *
 * The published hundred is a FRACTION of the population, and the fraction moves
 * with this number: 100 of 2 531 is the top 3.95 %, where 100 of 154 331 was
 * the top 0.065 % — two orders of magnitude apart. The board is ranked by
 * points rather than by depth, so the cut lands wherever the score model puts
 * it and the tail anchors did NOT need re-fitting here; the band shares are
 * fractions and are unaffected. But re-run `pnpm leaderboard:seed` and read the
 * printout after any change: the checks worth looking at are that no stage has
 * emptied out, that the histogram is still monotone from the quit peak to the
 * last level, and that the top 100 is still drawn from a spread of levels
 * rather than all from the deepest one.
 */
const TOTAL = 2_531

/** Rows the board publishes, matching the Worker's `TOP_N`. */
const TOP_N = 100

/**
 * The campaign's length — four worlds of ten levels.
 *
 * Mirrors `TOTAL_LEVELS` in `src/game/stages.ts`, and `leaderboardSeed.test.ts`
 * fails if the two ever disagree. The curve must not model stages the game does
 * not have: a board whose best players sit on "stage 52" ranks nobody, because
 * no real player can reach it.
 */
export const MAX_STAGE = 40

/**
 * The retention curve, as `stage → fraction of players whose BEST is ≥ stage`.
 *
 * A survival function rather than a histogram, because that is the shape the
 * design intent is actually stated in — "most quit on 3 and 4", "only ~8 % go
 * past 20" are both statements about how many are still there, and deriving the
 * per-stage counts from them cannot drift out of agreement with them.
 *
 *   1 → 1.000   everyone reaches stage 1
 *   3 → 0.930     7 % gave up on 1-2         "some few on stage 1 and 2"
 *   5 → 0.620    31 % gave up on 3-4         "most players quit on 3 and 4"
 *  11 → 0.250    37 % gave up on 5-10        "most players play till 5-10"
 *  21 → 0.080    17 % gave up on 11-20
 *  40 → 0.0094    8 % are still going past 20  "the best players reach 40"
 *  41 → 0        there is no past the last level
 *
 * ── Why the tail is one segment and not four ──
 *
 * The board this was ported from had to bend its tail over four anchors: its
 * campaign ran past stage 60, so the brief's wall at 20 forced the drop-off
 * RATE to jump there, and a step in the rate is a visible step in the
 * histogram. Here the rate does not have to jump at all — 21 → 40 is nineteen
 * stages to spend 8 % in, which is almost exactly the ~10.8 %/stage the 11-20
 * segment already runs at. The single anchor at 40 IS the smooth answer, and
 * stage 21 ends up holding fewer players than stage 20 rather than more.
 *
 * ── The pile-up on 40 is real, not an artefact ──
 *
 * `survival(41) = 0` puts every remaining player — 24 of them at this
 * population — on stage 40, because a forty-level campaign has nowhere else to
 * put them. On a histogram of STAGES that is a spike: stage 39 holds 3. It
 * never reaches a player, because the board is ranked by SCORE and those 24
 * spread across a wide band of point totals (see `SKILL`), so the histogram the
 * game actually reads stays smooth.
 *
 * Interpolated log-linearly between anchors, which is what makes the middle of
 * a band decay smoothly instead of stepping at the anchors — a histogram with
 * visible steps in it reads as generated the moment anyone plots it.
 */
const SURVIVAL = [
  [1, 1],
  [3, 0.93],
  [5, 0.62],
  [11, 0.25],
  [21, 0.08],
  [40, 0.0094],
  [41, 0]
]

/** Fraction of players still going at `stage`. */
const survival = (stage) => {
  if (stage <= 1) return 1
  for (let i = 0; i < SURVIVAL.length - 1; i++) {
    const [x0, y0] = SURVIVAL[i]
    const [x1, y1] = SURVIVAL[i + 1]
    if (stage < x0 || stage > x1) continue
    const t = (stage - x0) / (x1 - x0)
    // Log-linear, so a constant per-stage drop-off rate is a straight line.
    // Guarded for the final anchor, where the curve reaches zero.
    if (y1 <= 0 || y0 <= 0) return y0 + (y1 - y0) * t
    return y0 * Math.pow(y1 / y0, t)
  }
  return 0
}

// ─── Stage → score ──────────────────────────────────────────────────────────
//
// THE BOARD IS RANKED BY POINTS, NOT BY DEPTH, and getting that backwards is
// the whole reason this section exists. `useLeaderboard` posts
// `{ score: bestScore, squad: bestLevel }` — `score` is the best SINGLE-LEVEL
// point total, `squad` is the deepest level cleared. A seeded board that put a
// stage number in `score` publishes a histogram topping out at 40 while every
// real player posts hundreds or thousands, so `rankFromDist` finds nobody above
// them and answers "#1 of the entire board" to everyone who has cleared a level.
// That is exactly what this board did before the model below replaced it.
//
// The retention curve still runs over STAGES, because that is the shape the
// design intent is stated in. Each player's stage is then converted into the
// points they would plausibly have posted.

/**
 * Each level's bug quota, mirrored from `levelSpec()` in `src/game/stages.ts`.
 *
 * Copied rather than imported: this script is plain Node and the game's modules
 * are TypeScript behind an `@/` alias. `leaderboardSeed.test.ts` CAN import
 * them, and re-derives this table from `allLevels()` so the copy cannot drift
 * silently when the campaign is retuned.
 *
 * The four zeroes are the boss levels (10, 20, 30, 40), which carry no quota of
 * their own; `quotaFor` hands them the level below's.
 */
export const QUOTA = [
  8, 12, 14, 18, 21, 25, 30, 34, 39, 0,
  34, 36, 38, 41, 45, 48, 53, 57, 61, 0,
  56, 58, 61, 64, 68, 72, 77, 82, 87, 0,
  78, 80, 84, 88, 93, 98, 103, 109, 116, 0
]

const quotaFor = (level) => (QUOTA[level - 1] > 0 ? QUOTA[level - 1] : QUOTA[level - 2])

const worldOf = (level) => Math.floor((level - 1) / 10) + 1

/**
 * A level's three-star SCORE objective — `quota * 26 * (1 + w * 0.55)`, the
 * same expression `optionals()` uses in `src/game/stages.ts`.
 *
 * This is what a modelled score hangs off, because it is the game's own
 * statement of "a good total on this level". It runs 208 on level 1 to 7 992 on
 * level 40, and the test pins it against the three levels that actually carry a
 * score objective (15, 25 and 35 → 1 814, 3 713, 6 408).
 */
export const scoreTargetFor = (level) =>
  Math.round(quotaFor(level) * 26 * (1 + (worldOf(level) - 1) * 0.55))

/**
 * How a player's best total compares with that objective.
 *
 * Lognormal, because a score is a product of things that multiply — how many
 * bugs, at what combo, under how much fever — and a product of spreads is
 * lognormal rather than normal. `mu` sits just under 1: the objective is a
 * three-star ask, so the median player who reached a level falls a little short
 * of it.
 *
 * Players parked on the LAST level get their own pair. They are the only ones
 * with nowhere further to go, so they keep replaying the deepest level they
 * have and their best total drifts up while their depth cannot. That widening
 * is also what stops all 100 published rows reading "40" in the level column —
 * with this spread a strong level-36 run out-scores a mediocre level-40 one, so
 * the top of the board comes out a mix — at this population the published
 * hundred spans levels 19 to 40, with only 24 of the rows on 40 — rather than a
 * hundred identical cells.
 *
 * That spread is a function of TOTAL as much as of `sigma`: the published
 * hundred is the top 3.95 % of 2 531 players, where on a 154 331-player board
 * it was the top 0.065 % and came almost entirely off the last two levels.
 *
 * The right tail needs taming, and it must not be taken off with a `Math.min`.
 *
 * How badly it needs taming scales with TOTAL, because the worst outlier is the
 * worst of N draws: at 154 331 players somebody landed four sigma out at nearly
 * five times the level-40 objective, which reads as a broken score rather than
 * as a great run. At 2 531 the draw only reaches 1.75x it, so `soften` barely
 * engages — but it stays, because the population is a knob and a hard ceiling
 * fails the moment somebody turns it back up.
 *
 * A hard ceiling is an atom of probability sitting on one value, so
 * every draw past it lands on exactly the same number: the first cut of this
 * board had ELEVEN players tied at the clamp, which is the top eleven rows of
 * the published table showing one identical score. `soften` squeezes everything
 * above `knee` asymptotically towards `max` instead, so the extreme runs stay
 * extreme, stay distinct, and stay inside a believable ceiling.
 *
 * The floor is a plain `Math.max` and that is fine: the bottom of any real
 * board IS one enormous tied bucket of players who bounced in their first
 * minute, and they are far below anything the top 100 shows.
 */
const SKILL = {
  mu: Math.log(0.92),
  sigma: 0.32,
  capMu: Math.log(0.98),
  capSigma: 0.28,
  min: 0.45,
  knee: 1.5,
  max: 2.1
}

/** Compress the right tail into `[knee, max)` without ever reaching `max`. */
const soften = (factor) => {
  if (factor <= SKILL.knee) return factor
  const room = SKILL.max - SKILL.knee
  return SKILL.knee + room * (1 - Math.exp(-(factor - SKILL.knee) / room))
}

/**
 * Scores are rounded to this before they are counted.
 *
 * `dist` ships one `[score, count]` pair per distinct value, and point totals
 * are spread thinly enough that an unrounded board would publish nearly one
 * bucket per player. At 25 this board publishes 231, the file gzips to 2.5 kB,
 * and the rank a player is shown moves by a handful of places — comfortably
 * inside the honesty of a modelled board.
 */
const BUCKET = 25

/**
 * How many players stop on each stage, `[stage, howMany]` ascending.
 *
 * Pure — it reads the curve and nothing else, so the CLI's band report and the
 * test both see exactly the population `buildSeed` draws from, without a second
 * copy of the arithmetic to keep in step.
 */
export const stageCounts = () => {
  const counts = []
  for (let stage = 1; stage <= MAX_STAGE; stage++) {
    const n = Math.round(TOTAL * (survival(stage) - survival(stage + 1)))
    if (n > 0) counts.push([stage, n])
  }

  // Rounding leaves the sum a little off the target; correct it on the biggest
  // stage, the one place a handful of players cannot be noticed.
  const sum = counts.reduce((a, [, n]) => a + n, 0)
  if (sum !== TOTAL) {
    let biggest = 0
    for (let i = 1; i < counts.length; i++) if (counts[i][1] > counts[biggest][1]) biggest = i
    counts[biggest][1] += TOTAL - sum
  }
  return counts
}

/** Deterministic PRNG — mulberry32. Same seed, same board, every run. */
const rng = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = seed
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/**
 * One standard normal from the same stream — Box-Muller.
 *
 * The spare half of each pair is deliberately DISCARDED rather than cached.
 * Caching it is the usual optimisation and it would make the draw depend on how
 * many times the function had been called before, which is a second kind of
 * state on top of the PRNG's own; two players would swap scores if a stage's
 * population ever changed by one. Burning two uniforms per draw keeps the board
 * a pure function of the seed.
 */
const gauss = (r) => {
  let u = 0
  let v = 0
  while (u === 0) u = r()
  while (v === 0) v = r()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

// ─── Names ──────────────────────────────────────────────────────────────────
//
// Shaped to match what the live board actually contains, which is almost
// entirely portal handles (CrazyGames usernames) rather than this game's own
// anonymous mint. Measured on the real top-100: 98 handles, 2 `Word######`.
// `cleanName` caps a name at 16 characters, so every pattern here stays inside
// that or it would be silently truncated somewhere else.

const ADJ = [
  'Juicy', 'Real', 'Brilliant', 'Silent', 'Crimson', 'Rapid', 'Iron', 'Lucky',
  'Neon', 'Frost', 'Wild', 'Grim', 'Golden', 'Shadow', 'Turbo', 'Mad', 'Salty',
  'Cosmic', 'Rusty', 'Velvet', 'Hyper', 'Quiet', 'Feral', 'Prime'
]
const NOUN = [
  'Cloud', 'Milkshake', 'Demon', 'Falcon', 'Comet', 'Badger', 'Wolf', 'Pixel',
  'Rocket', 'Nomad', 'Panda', 'Viper', 'Yeti', 'Gremlin', 'Bishop', 'Otter',
  'Hydra', 'Muffin', 'Raven', 'Goblin', 'Turtle', 'Phantom', 'Bandit', 'Koala'
]
/** The game's own anonymous mint (`usePlayerIdentity.ANON_WORDS`). */
const ANON = [
  'Survivor', 'Runner', 'Scout', 'Nomad', 'Drifter',
  'Ranger', 'Wanderer', 'Strider', 'Trekker', 'Roamer'
]
const SYL_A = ['Ka', 'Hi', 'Zu', 'Mo', 'Ra', 'Ta', 'Ni', 'Vo', 'Sa', 'Yu', 'Le', 'Do']
const SYL_B = ['ze', 'ppi', 'nda', 'rro', 'shi', 'mba', 'kko', 'ven', 'lia', 'gan']
const SYL_C = ['ko', 'riot', 'ssi', 'rashi', 'ra', 'nix', 'dor', 'la', 'thas', 'mi']
const SUFFIX = ['RX', 'y', 'Jbql', 'GG', 'x', 'TV', 'zz', 'Q', 'io', 'kk']

const pick = (r, xs) => xs[Math.floor(r() * xs.length)]

/** One plausible handle, in the proportions the live board shows. */
const mintName = (r) => {
  const roll = r()
  let name
  if (roll < 0.34) {
    name = pick(r, ADJ) + pick(r, NOUN)
  } else if (roll < 0.56) {
    name = `${pick(r, ADJ)}${pick(r, NOUN)}.${pick(r, SUFFIX)}`
  } else if (roll < 0.8) {
    name = pick(r, SYL_A) + pick(r, SYL_B) + pick(r, SYL_C)
  } else if (roll < 0.92) {
    name = (pick(r, SYL_A) + pick(r, SYL_B) + pick(r, SYL_C)).toUpperCase()
  } else {
    // The game's own anonymous mint, at roughly the rate the real board has it.
    name = `${pick(r, ANON)}${100000 + Math.floor(r() * 900000)}`
  }
  // Trimmed to `cleanName`'s own 16-character ceiling, then stripped of any
  // punctuation the cut landed on — "GoldenMilkshake." reads as a bug rather
  // than as a handle.
  return name.slice(0, 16).replace(/[^A-Za-z0-9]+$/, '')
}

// ─── Build ──────────────────────────────────────────────────────────────────

/** The board's stated build date, 2026-09-08 — the day the curve was fitted.
 *  A constant so the file stays byte-reproducible; see `buildSeed`'s return. */
const SEED_EPOCH = Date.UTC(2026, 8, 8)

export const buildSeed = () => {
  const r = rng(20260908)

  const perStage = stageCounts()

  // Every player, as the pair the game itself posts: the best single-level
  // POINT total, and the deepest level cleared. Both come out of the same draw,
  // so the two columns of a published row always describe one coherent player.
  const players = []
  for (const [stage, n] of perStage) {
    const atCap = stage === MAX_STAGE
    const mu = atCap ? SKILL.capMu : SKILL.mu
    const sigma = atCap ? SKILL.capSigma : SKILL.sigma
    const target = scoreTargetFor(stage)
    for (let i = 0; i < n; i++) {
      const factor = Math.max(SKILL.min, soften(Math.exp(mu + sigma * gauss(r))))
      // Rounded to `BUCKET` so the histogram stays publishable; floored at one
      // bucket so nobody's best total is zero.
      players.push([Math.max(BUCKET, Math.round((target * factor) / BUCKET) * BUCKET), stage])
    }
  }

  // Score DESC, then depth DESC — the order every rank walk in the game
  // depends on, and the order the published rows are taken from. The tie-break
  // on depth only decides which of two equal scores is listed first.
  players.sort((a, b) => b[0] - a[0] || b[1] - a[1])

  // The histogram, over SCORE. This is what `rankFromDist` walks, both here and
  // in the Worker, so it has to describe the same population as the rows below.
  const byScore = new Map()
  for (const [score] of players) byScore.set(score, (byScore.get(score) ?? 0) + 1)
  const dist = [...byScore.entries()].sort((a, b) => b[0] - a[0])

  // The published rows: the top of the same sorted list, so `entries` and
  // `dist` cannot disagree. A board whose visible rows contradict its own
  // histogram would rank its own listed players wrongly.
  const entries = players.slice(0, TOP_N).map(([score, stage], i) => ({
    rank: i + 1,
    name: mintName(r),
    score,
    // `squad` is the wire name of the SECOND column everywhere else in this
    // project — the Worker's schema, `BoardEntry`, `SnapshotEntry` and the
    // modal all spell it that way, and the template's `flair` reached none of
    // them. A seeded board that says `flair` renders 100 blank Level cells,
    // which is what shipped until this was corrected.
    squad: stage
  }))

  return {
    source: 'seeded:retention-curve',
    // FIXED, not `Date.now()`. The board is committed, and the whole point of
    // the seeded PRNG is that re-running this script reproduces the file byte
    // for byte — a wall clock in here re-writes both fields on every run, so a
    // regeneration that changed nothing still lands as a diff and the next
    // reader cannot tell it apart from one that did. Nothing reads either
    // field on the seeded path: `vite.config.ts` only compares `fetchedAt`
    // against its ten-minute refresh window on the SNAPSHOT branch, which a
    // seeded build returns before reaching.
    fetchedAt: SEED_EPOCH,
    updatedAt: SEED_EPOCH,
    total: players.length,
    entries,
    dist
  }
}

// ─── CLI ────────────────────────────────────────────────────────────────────

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const seed = buildSeed()
  const out = seedFile()
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, JSON.stringify(seed, null, 2) + '\n', 'utf-8')

  // The bands are the BRIEF, and the brief is stated in stages — so they are
  // counted off the stage histogram, not off `dist`, which is now points.
  const stages = stageCounts()
  const band = (lo, hi) => stages.filter(([s]) => s >= lo && s <= hi).reduce((a, [, n]) => a + n, 0)
  const pct = (n) => `${((100 * n) / seed.total).toFixed(1)}%`
  const lastRow = seed.entries[seed.entries.length - 1]
  console.log(`[seed] ${seed.total} players, top score ${seed.dist[0][0]}, ` +
    `published cut at ${lastRow.score} (level ${lastRow.squad}), ${seed.dist.length} buckets`)
  console.log(`[seed]   stage 1-2  ${String(band(1, 2)).padStart(6)}  ${pct(band(1, 2))}`)
  console.log(`[seed]   stage 3-4  ${String(band(3, 4)).padStart(6)}  ${pct(band(3, 4))}`)
  console.log(`[seed]   stage 5-10 ${String(band(5, 10)).padStart(6)}  ${pct(band(5, 10))}`)
  console.log(`[seed]   stage 11-20${String(band(11, 20)).padStart(6)}  ${pct(band(11, 20))}`)
  console.log(`[seed]   past 20    ${String(band(21, 40)).padStart(6)}  ${pct(band(21, 40))}`)
  console.log(`[seed] wrote ${out}`)
}
