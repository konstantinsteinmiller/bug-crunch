import { computed, ref, watch } from 'vue'
import { getState, setState, setStates } from '@/use/useBugCrunchState'
import { saveDataVersion, flushSaveNow } from '@/use/useSaveStatus'
import {
  BEST_COMBO_KEY, BEST_LEVEL_KEY, BEST_SCORE_KEY, COINS_KEY, FAILED_LEVELS_KEY,
  LEVEL_KEY, LEVEL_STARS_KEY, MOVES_KEY, NEAR_MISS_KEY, PARTY_BEST_KEY, RESULTS_SEEN_KEY,
  RUNS_KEY, TOTAL_COINS_KEY, TOTAL_SQUISHES_KEY
} from '@/keys'
import {
  TOTAL_LEVELS, clampLevel, isLevelUnlocked, levelPayout, partyPayout, starsToNextWorld,
  worldOf, worldOpenLevel
} from '@/game/stages'
import { SECOND_WIND_AT, type RunTally } from '@/game/stars'
import { isMoveId, moveForLevel, movesForBest, type MoveId } from '@/game/moves'

/**
 * ─── Meta progression ───────────────────────────────────────────────────────
 *
 * Coins, stars, the level the player is on, and what they have already failed.
 * Every field is a property of the one `bugcrunch_state` blob; nothing here
 * writes its own localStorage key.
 *
 * ── Why the refs are mirrored rather than computed ──
 *
 * `getState` reads a plain record, not a reactive source. Mirroring into refs
 * and re-reading them on `saveDataVersion` is what makes a CLOUD HYDRATE
 * visible: on a portal build the blob is populated from the SDK after these
 * modules have already evaluated, and a computed over a non-reactive read would
 * never notice. The watcher is the whole hydration contract for this module —
 * see `verify-cloud-save-hydration`.
 */

const readInt = (key: string, fallback: number): number => {
  const v = getState<unknown>(key)
  const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10)
  return Number.isFinite(n) ? n : fallback
}

const readMap = (key: string): Record<string, number> => {
  const v = getState<unknown>(key)
  if (v && typeof v === 'object' && !Array.isArray(v)) return { ...(v as Record<string, number>) }
  return {}
}

export const coins = ref(readInt(COINS_KEY, 0))
export const lifetimeCoins = ref(readInt(TOTAL_COINS_KEY, 0))
export const currentLevel = ref(clampLevel(readInt(LEVEL_KEY, 1)))
export const bestLevel = ref(readInt(BEST_LEVEL_KEY, 0))
export const bestScore = ref(readInt(BEST_SCORE_KEY, 0))
export const bestCombo = ref(readInt(BEST_COMBO_KEY, 0))
export const runs = ref(readInt(RUNS_KEY, 0))
export const totalSquishes = ref(readInt(TOTAL_SQUISHES_KEY, 0))
export const levelStars = ref<Record<string, number>>(readMap(LEVEL_STARS_KEY))
export const failedLevels = ref<Record<string, number>>(readMap(FAILED_LEVELS_KEY))
export const resultsSeen = ref(readInt(RESULTS_SEEN_KEY, 0))
export const nearMisses = ref<Record<string, number>>(readMap(NEAR_MISS_KEY))
export const partyBests = ref<Record<string, number>>(readMap(PARTY_BEST_KEY))

const readMoves = (): MoveId[] => {
  const raw = getState<unknown>(MOVES_KEY)
  return Array.isArray(raw) ? raw.filter(isMoveId) : []
}
const storedMoves = ref<MoveId[]>(readMoves())

/**
 * Every Boss Trophy the player owns: the ones written on a boss clear, and the
 * ones their deepest clear already implies — so a save from before trophies
 * existed, sitting on world 3, owns the Heel Spin, the Skid and the Quake on
 * the first frame this build reads it.
 */
export const ownedMoves = computed<MoveId[]>(() => {
  const set = new Set<MoveId>([...storedMoves.value, ...movesForBest(bestLevel.value)])
  return [...set]
})

/** Every star the player has banked, across every level. */
export const totalStars = computed(() => {
  let n = 0
  for (const v of Object.values(levelStars.value)) {
    if (typeof v === 'number' && v > 0) n += Math.min(3, v)
  }
  return n
})

/** The deepest world the star total has opened. */
export const openWorld = computed(() => {
  let w = 1
  for (let i = 2; i <= 4; i++) {
    if (isLevelUnlocked(worldOpenLevel(i as 2 | 3 | 4), totalStars.value)) w = i
  }
  return w
})

/** Stars still owed before the next world opens; 0 when nothing is locked. */
export const starsToUnlock = computed(() =>
  starsToNextWorld(currentLevel.value, totalStars.value))

/** Re-read everything when a hydrate lands. */
watch(saveDataVersion, () => {
  coins.value = readInt(COINS_KEY, coins.value)
  lifetimeCoins.value = readInt(TOTAL_COINS_KEY, lifetimeCoins.value)
  currentLevel.value = clampLevel(readInt(LEVEL_KEY, currentLevel.value))
  bestLevel.value = readInt(BEST_LEVEL_KEY, bestLevel.value)
  bestScore.value = readInt(BEST_SCORE_KEY, bestScore.value)
  bestCombo.value = readInt(BEST_COMBO_KEY, bestCombo.value)
  runs.value = readInt(RUNS_KEY, runs.value)
  totalSquishes.value = readInt(TOTAL_SQUISHES_KEY, totalSquishes.value)
  const stars = readMap(LEVEL_STARS_KEY)
  if (Object.keys(stars).length > 0) levelStars.value = stars
  const failed = readMap(FAILED_LEVELS_KEY)
  if (Object.keys(failed).length > 0) failedLevels.value = failed
  resultsSeen.value = readInt(RESULTS_SEEN_KEY, resultsSeen.value)
  const near = readMap(NEAR_MISS_KEY)
  if (Object.keys(near).length > 0) nearMisses.value = near
  const parties = readMap(PARTY_BEST_KEY)
  if (Object.keys(parties).length > 0) partyBests.value = parties
  const moves = readMoves()
  if (moves.length > 0) storedMoves.value = moves
})

// ─── Writes ─────────────────────────────────────────────────────────────────

export const addCoins = (n: number): void => {
  if (!Number.isFinite(n) || n === 0) return
  coins.value = Math.max(0, coins.value + Math.round(n))
  if (n > 0) lifetimeCoins.value += Math.round(n)
  setStates({ [COINS_KEY]: coins.value, [TOTAL_COINS_KEY]: lifetimeCoins.value })
}

/** Spend, atomically. Returns false and writes nothing when short. */
export const spendCoins = (n: number): boolean => {
  const cost = Math.max(0, Math.round(n))
  if (coins.value < cost) return false
  coins.value -= cost
  setState(COINS_KEY, coins.value)
  flushSaveNow()
  return true
}

export const starsFor = (level: number): number => {
  const v = levelStars.value[String(clampLevel(level))]
  return typeof v === 'number' ? Math.min(3, Math.max(0, v)) : 0
}

export const setLevel = (level: number): void => {
  currentLevel.value = clampLevel(level)
  setState(LEVEL_KEY, currentLevel.value)
}

/** How many times the player has failed a level. Drives the one-shot relief. */
export const failCount = (level: number): number => {
  const v = failedLevels.value[String(clampLevel(level))]
  return typeof v === 'number' ? Math.max(0, v) : 0
}

/**
 * The relief multiplier for a level the player keeps losing.
 *
 * Two rungs and then it stops. Being stuck is the single most common reason a
 * child closes a game, and a level that has beaten somebody three times is not
 * going to be beaten on the fourth by the same board; but relief that keeps
 * compounding turns into a game that plays itself, and the player can feel
 * that too. Applied to bug SPEED and the CLOCK, never to the quota — see
 * `StartOptions.relief`.
 */
export const reliefFor = (level: number): number => {
  const n = Math.min(2, failCount(level))
  return 1 + n * 0.09
}

// ─── So Close! ──────────────────────────────────────────────────────────────

/** Levels whose Second Wind has been spent this SESSION. Once per level per
 *  session: a player who fails on purpose for a full vial pays a whole level
 *  for it, and only once. In memory on purpose — a new session is a new try. */
const windsSpent = new Set<number>()

/**
 * Does a retry of `level` open with a Second Wind — a full vial?
 *
 * Only for the level's last FAILED run, only when it came at least
 * `SECOND_WIND_AT` of the way, and only once per level per session. Below the
 * bar the level was a wall rather than a near thing, and the relief ladder
 * (`reliefFor`) is the right help there instead.
 */
export const secondWindFor = (level: number): boolean => {
  const id = clampLevel(level)
  if (windsSpent.has(id)) return false
  const near = nearMisses.value[String(id)]
  return typeof near === 'number' && near >= SECOND_WIND_AT
}

/** The retry is starting with its Second Wind: spend it for this session. */
export const spendSecondWind = (level: number): void => { windsSpent.add(clampLevel(level)) }

// ─── Bug Party ──────────────────────────────────────────────────────────────

/** The best haul at the party after `level`, 0 if never played. */
export const partyBestFor = (level: number): number => {
  const v = partyBests.value[String(clampLevel(level))]
  return typeof v === 'number' ? Math.max(0, v) : 0
}

/**
 * Bank a party: its coins, and its best. A party has no stars, no fail and no
 * level pointer — the level the player is on does not move.
 */
export const bankParty = (level: number, kills: number): { coins: number; best: number; isBest: boolean } => {
  const key = String(clampLevel(level))
  const before = partyBestFor(level)
  const isBest = kills > before
  const coinsWon = partyPayout(kills)
  coins.value += coinsWon
  lifetimeCoins.value += coinsWon
  totalSquishes.value += kills
  if (isBest) partyBests.value = { ...partyBests.value, [key]: kills }
  setStates({
    [COINS_KEY]: coins.value,
    [TOTAL_COINS_KEY]: lifetimeCoins.value,
    [TOTAL_SQUISHES_KEY]: totalSquishes.value,
    [PARTY_BEST_KEY]: partyBests.value
  })
  flushSaveNow()
  return { coins: coinsWon, best: Math.max(before, kills), isBest }
}

export interface LevelResult {
  level: number
  stars: number
  tally: RunTally
  /** Coins banked. */
  coins: number
  /** This clear opened a new world. */
  unlockedWorld: number | null
  /** These stars beat the player's previous best on this level. */
  improved: boolean
  isRecord: boolean
  /** A Boss Trophy this clear won for the FIRST time, or null. */
  newMove: MoveId | null
}

/**
 * Bank a finished level.
 *
 * ONE write, through `setStates`, so a level boundary is one reactive identity
 * change and one cloud push rather than nine. A level boundary is also the
 * game's only natural checkpoint, so it flushes immediately rather than waiting
 * out the debounce: a player who closes the tab on the result screen has
 * finished the level, and the save has to agree.
 */
export const bankLevel = (
  level: number, stars: number, tally: RunTally, reached01 = 0
): LevelResult => {
  const id = clampLevel(level)
  const key = String(id)
  const before = starsFor(id)
  const gained = Math.max(0, Math.min(3, stars))
  const improved = gained > before

  const nextStars = { ...levelStars.value }
  if (improved) nextStars[key] = gained

  const nextFailed = { ...failedLevels.value }
  if (tally.cleared) delete nextFailed[key]
  else nextFailed[key] = (nextFailed[key] ?? 0) + 1

  // So Close!'s memory: how far the LAST failed run came. A clear wipes it.
  const nextNear = { ...nearMisses.value }
  if (tally.cleared) delete nextNear[key]
  else nextNear[key] = Math.round(Math.max(0, Math.min(1, reached01)) * 100) / 100
  nearMisses.value = nextNear

  // A Boss Trophy, the first time its boss falls.
  const drop = tally.cleared ? moveForLevel(id) : null
  const newMove = drop && !ownedMoves.value.includes(drop) ? drop : null
  if (newMove) storedMoves.value = [...storedMoves.value, newMove]

  const worldBefore = openWorld.value
  levelStars.value = nextStars
  failedLevels.value = nextFailed

  const payout = tally.cleared ? levelPayout(id, gained) : Math.round(levelPayout(id, 0) * 0.35)
  coins.value += payout
  lifetimeCoins.value += payout
  runs.value += 1
  totalSquishes.value += tally.squishes
  resultsSeen.value += 1

  const isRecord = tally.score > bestScore.value
  if (isRecord) bestScore.value = tally.score
  if (tally.bestCombo > bestCombo.value) bestCombo.value = tally.bestCombo
  if (tally.cleared && id > bestLevel.value) bestLevel.value = id

  const nextLevel = tally.cleared ? Math.min(TOTAL_LEVELS, id + 1) : id
  currentLevel.value = nextLevel

  setStates({
    [LEVEL_STARS_KEY]: nextStars,
    [FAILED_LEVELS_KEY]: nextFailed,
    [COINS_KEY]: coins.value,
    [TOTAL_COINS_KEY]: lifetimeCoins.value,
    [RUNS_KEY]: runs.value,
    [TOTAL_SQUISHES_KEY]: totalSquishes.value,
    [BEST_SCORE_KEY]: bestScore.value,
    [BEST_COMBO_KEY]: bestCombo.value,
    [BEST_LEVEL_KEY]: bestLevel.value,
    [LEVEL_KEY]: nextLevel,
    [RESULTS_SEEN_KEY]: resultsSeen.value,
    [NEAR_MISS_KEY]: nextNear,
    [MOVES_KEY]: storedMoves.value
  })
  flushSaveNow()

  const worldAfter = openWorld.value
  return {
    level: id,
    stars: gained,
    tally,
    coins: payout,
    unlockedWorld: worldAfter > worldBefore ? worldAfter : null,
    improved,
    isRecord,
    newMove
  }
}

/** The world the player is currently in. */
export const currentWorld = computed(() => worldOf(currentLevel.value))

/** Test seam. */
export const __resetProgress = (): void => {
  coins.value = 0
  lifetimeCoins.value = 0
  currentLevel.value = 1
  bestLevel.value = 0
  bestScore.value = 0
  bestCombo.value = 0
  runs.value = 0
  totalSquishes.value = 0
  levelStars.value = {}
  failedLevels.value = {}
  resultsSeen.value = 0
  nearMisses.value = {}
  partyBests.value = {}
  storedMoves.value = []
  windsSpent.clear()
}

const useSplatProgress = () => ({
  coins, lifetimeCoins, currentLevel, bestLevel, bestScore, bestCombo,
  runs, totalSquishes, levelStars, totalStars, openWorld, starsToUnlock,
  currentWorld, resultsSeen, ownedMoves, nearMisses,
  addCoins, spendCoins, starsFor, setLevel, failCount, reliefFor, bankLevel,
  secondWindFor, spendSecondWind, partyBestFor, bankParty
})

export default useSplatProgress
