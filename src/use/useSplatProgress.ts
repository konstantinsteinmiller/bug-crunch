import { computed, ref, watch } from 'vue'
import { getState, setState, setStates } from '@/use/useSplatixState'
import { saveDataVersion, flushSaveNow } from '@/use/useSaveStatus'
import {
  BEST_COMBO_KEY, BEST_LEVEL_KEY, BEST_SCORE_KEY, COINS_KEY, FAILED_LEVELS_KEY,
  LEVEL_KEY, LEVEL_STARS_KEY, RESULTS_SEEN_KEY, RUNS_KEY, TOTAL_COINS_KEY,
  TOTAL_SQUISHES_KEY
} from '@/keys'
import {
  TOTAL_LEVELS, clampLevel, isLevelUnlocked, levelPayout, starsToNextWorld,
  worldOf, worldOpenLevel
} from '@/game/stages'
import type { RunTally } from '@/game/stars'

/**
 * ─── Meta progression ───────────────────────────────────────────────────────
 *
 * Coins, stars, the level the player is on, and what they have already failed.
 * Every field is a property of the one `splatix_state` blob; nothing here
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
export const bankLevel = (level: number, stars: number, tally: RunTally): LevelResult => {
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
    [RESULTS_SEEN_KEY]: resultsSeen.value
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
    isRecord
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
}

const useSplatProgress = () => ({
  coins, lifetimeCoins, currentLevel, bestLevel, bestScore, bestCombo,
  runs, totalSquishes, levelStars, totalStars, openWorld, starsToUnlock,
  currentWorld, resultsSeen,
  addCoins, spendCoins, starsFor, setLevel, failCount, reliefFor, bankLevel
})

export default useSplatProgress
