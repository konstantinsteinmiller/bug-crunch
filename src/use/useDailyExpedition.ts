import { computed, onUnmounted, ref, watch, type ComputedRef } from 'vue'
import { BEST_STAGE_KEY, EXPEDITION_KEY } from '@/keys'
import { getState, setState, towerState } from '@/use/useTowerState'
import { saveDataVersion } from '@/use/useSaveStatus'

/**
 * ─── The daily expedition ───────────────────────────────────────────────────
 *
 * One road a day, the same road for everybody, worth triple coins, taken once.
 *
 * It exists because the honest answer to "why open this tomorrow" was, until
 * now, the treasure chest and nothing else — and a chest is a faucet, not a
 * reason to PLAY. The rejected answer is the one every hybrid-casual game
 * ships: a login modal in front of the game on the first launch of the day.
 * This is the version that respects the player's first tap. Nothing pops up,
 * nothing interrupts a run, nothing is lost by never noticing it: there is a
 * chip on the HUD that is gold today and grey once it has been used.
 *
 * Everything about WHEN it is available lives here; `useSurvivalGame` owns
 * what the run does, and `DailyExpedition.vue` owns the chip.
 *
 * ── The clock, which is the only genuinely hard decision in the feature ──
 *
 * The seed IS the day, so the choice of clock is the choice of what "the same
 * road for everyone" means.
 *
 * LOCAL time was rejected. It makes the sentence false: two players comparing
 * the same road at the same instant would be on different roads whenever they
 * are in different timezones, and — worse — a single player can have TWO of
 * today's expeditions by moving east, or by moving the device clock forward an
 * hour, because their local `YYYYMMDD` rolls over twice against one real day.
 * A shared object cannot be keyed on a clock that is different per viewer.
 *
 * UTC is therefore what ships, and its cost is stated rather than hidden: the
 * day flips at 01:00/02:00 in Europe and at 16:00/17:00 the previous afternoon
 * on the American west coast, so for some players "today's expedition" arrives
 * mid-evening. That is a strange boundary but a CONSISTENT one, and it is a
 * boundary the chip can point at — it shows the time to the next reset, so
 * nobody has to work out when their day flips. The chest deliberately does the
 * opposite (`todayKey` in `useTreasureChest.ts` is local) and the two are meant
 * to disagree: the chest caps an allowance that belongs to one player, and an
 * allowance is measured in that player's own day.
 *
 * Every function here takes `now` as a number. Nothing in the feature calls
 * `new Date()` where a test cannot reach it, which is the only way a day
 * boundary is ever actually verified rather than assumed.
 */

/**
 * The rung of the difficulty curve the expedition road is built at.
 *
 * 16 rather than "wherever the player is", because both alternatives are worse.
 * Building it at the player's own stage makes it a re-skin of the campaign and
 * a different fight for everyone, which is the opposite of a shared road; and
 * anything from 1-15 is HAND-AUTHORED (see the `stageOne`…`stageFifteen`
 * dispatch in `buildTrack`), so the daily seed would move almost nothing and
 * every day would print the same teaching stage.
 *
 * 16 is the first rung the generator writes by itself, which makes it the
 * lowest number where the seed genuinely shapes the whole road — and it is the
 * gentlest of the procedural stages, which is the half of the trade that keeps
 * this attemptable.
 */
export const EXPEDITION_STAGE = 16

/**
 * Deepest cleared stage that opens the chip.
 *
 * Four rungs below the road itself. The expedition carries NO autobalancer —
 * no retry relief, no clear-streak handicap, no decline lean (see
 * `startStage`) — so it is deliberately the hard end of what a player at this
 * depth can attempt, and offering it any earlier would be putting a road in
 * front of somebody that their shop cannot answer. Below the gate the chip is
 * absent rather than disabled: a locked control the player cannot act on is
 * one more thing on a HUD that has no room for it.
 */
export const EXPEDITION_UNLOCK_BEST = 12

/**
 * What the expedition multiplies its own payout by.
 *
 * Applied once, inside `finishRun`, to the coins THAT RUN banked — never to
 * `stageReward`, never to the scavenge multiplier, never to anything a
 * campaign run reads. The rewarded video's own ×3 is deliberately computed off
 * the un-multiplied figure (`RunSummary.baseCoins`) so the two do not compound
 * into a 9× that would quietly re-price the entire upgrade curve against one
 * button on one screen a day.
 */
export const EXPEDITION_PAYOUT = 3

/** Milliseconds in a day — the UTC day has no DST, which is a second reason
 *  the arithmetic below is allowed to be this simple. */
const DAY_MS = 86_400_000

/**
 * Today's expedition day, as the integer `YYYYMMDD`, in UTC.
 *
 * Doubles as the RNG seed handed to `buildTrack`, exactly as the roadmap
 * specified — an integer that changes once a day and never repeats, so the
 * road is a pure function of the date and of nothing else.
 */
export const expeditionDay = (now: number): number => {
  const d = new Date(now)
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate()
}

/** Milliseconds from `now` to the next UTC midnight, when a new road prints. */
export const msUntilExpeditionReset = (now: number): number =>
  DAY_MS - (((now % DAY_MS) + DAY_MS) % DAY_MS)

/**
 * The day of the last expedition the player started, or 0.
 *
 * Anything that is not a finite positive integer reads as 0 — a save blob can
 * come back from a cloud restore holding whatever the SDK had, and the safe
 * direction for a garbage value is "you may go", not "you are locked out of a
 * feature until tomorrow with no way to tell why".
 */
export const lastExpeditionDay = (): number => {
  const v = getState<unknown>(EXPEDITION_KEY)
  const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

/** Has today's expedition already been started? */
export const expeditionSpent = (now: number): boolean =>
  lastExpeditionDay() === expeditionDay(now)

/** Has the player come far enough for the chip to exist at all? */
export const expeditionUnlocked = (): boolean =>
  (Number(getState(BEST_STAGE_KEY, 0)) || 0) >= EXPEDITION_UNLOCK_BEST

/**
 * Spend the day.
 *
 * Called at the moment the run STARTS, not when it ends — see `EXPEDITION_KEY`
 * for why. The write goes through the ordinary blob path, so it is debounced
 * with everything else; `startExpedition` flushes right after, because the very
 * next thing that can happen is the player reloading a road they are losing.
 */
export const markExpeditionTaken = (now: number): void => {
  setState(EXPEDITION_KEY, expeditionDay(now))
}

export interface DailyExpedition {
  /** The chip should exist at all — see `EXPEDITION_UNLOCK_BEST`. */
  unlocked: ComputedRef<boolean>
  /** Today's road is still there for the taking. */
  available: ComputedRef<boolean>
  /** Today's road has been used. The chip stays, greyed, with the countdown. */
  spent: ComputedRef<boolean>
  /** `H:MM` until the next road prints. Hours only — a to-the-second countdown
   *  on a wait of up to 24 h is a clock the player has to keep watching. */
  resetDisplay: ComputedRef<string>
  /** The integer seed for today's road, live so a session left open overnight
   *  picks up tomorrow's without a reload. */
  seed: ComputedRef<number>
}

/**
 * The chip's state, ticking. Call from a component's `setup` — it owns a
 * one-minute interval it releases on unmount.
 *
 * A minute, not a second like the chest's: the only thing this counts down to
 * is midnight, and a per-second tick on a number whose smallest visible digit
 * is a minute is 59 wasted reactive passes a minute for the whole session.
 */
export const useDailyExpedition = (): DailyExpedition => {
  const now = ref(Date.now())
  const lastDay = ref(lastExpeditionDay())
  const best = ref(Number(getState(BEST_STAGE_KEY, 0)) || 0)

  // A cloud save can land seconds after boot and rewrite the blob underneath
  // this — on a second device that is the ONLY thing between the player and a
  // second expedition. Both refs re-read on the hydrate bump and on any blob
  // identity change, exactly as the wallet and the chest do.
  const refresh = (): void => {
    lastDay.value = lastExpeditionDay()
    best.value = Number(getState(BEST_STAGE_KEY, 0)) || 0
  }
  watch(saveDataVersion, refresh)
  watch(towerState, refresh, { deep: false })

  const tick = window.setInterval(() => { now.value = Date.now() }, 60_000)
  onUnmounted(() => clearInterval(tick))

  const today = computed(() => expeditionDay(now.value))
  const unlocked = computed(() => best.value >= EXPEDITION_UNLOCK_BEST)
  const spent = computed(() => lastDay.value === today.value)
  const available = computed(() => unlocked.value && !spent.value)

  const resetDisplay = computed(() => {
    const total = Math.ceil(msUntilExpeditionReset(now.value) / 60_000)
    const h = Math.floor(total / 60)
    const mm = String(total % 60).padStart(2, '0')
    return `${h}:${mm}`
  })

  return { unlocked, available, spent, resetDisplay, seed: today }
}
