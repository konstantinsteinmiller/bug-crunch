import { computed, onUnmounted, ref, watch, type ComputedRef } from 'vue'
import { CHEST_KEY, CHEST_DAY_KEY } from '@/keys'
import { getState, setStates, bugCrunchState } from '@/use/useBugCrunchState'
import { saveDataVersion } from '@/use/useSaveStatus'

/**
 * ─── The idle treasure chest ────────────────────────────────────────────────
 *
 * A chest on the HUD that fills on WALL-CLOCK time and pays coins for a tap.
 * It is the game's only reason to open the tab when you are not in the mood
 * for a level, which is why every number in here is a retention decision rather
 * than a balance one.
 *
 * The state machine and its policy live in this module rather than in
 * `TreasureChest.vue` for two reasons: the numbers are the feature (they are
 * pinned by `tests/game/treasureChest.test.ts`), and a component cannot be
 * asked what it would pay at 03:00 on the day the cap rolls over.
 */

/** The chest becomes claimable — for the small prize — after three minutes. */
export const SMALL_READY_AT_MS = 3 * 60 * 1000
/** …and turns gold after ten, if the player leaves it alone. */
export const BIG_READY_AT_MS = 10 * 60 * 1000

/**
 * ─── What the chest pays, and why these numbers ─────────────────────────────
 *
 * Ported from a game whose economy was nothing like this one's, so the ladder
 * (3 min / 10 min) is kept and every COIN figure was re-derived from Bug Crunch's
 * own payout curve. Copying 25/100/300 across would have been a guess wearing
 * the clothes of a decision.
 *
 * ── What playing pays ──
 *
 * `levelPayout` in `game/stages.ts` is `20 + world*14 + stars*(8 + world*4)`,
 * plus a boss bonus on every tenth level. A three-star clear therefore pays:
 *
 *     world 1 → 70    world 2 → 96    world 3 → 122   world 4 → 148
 *     and the four bosses → 190 / 246 / 302 / 358
 *
 * A level runs 48-90 s on the clock (`WORLDS[*].time`), and with the card, the
 * result screen and the odd retry a level CYCLE is about two minutes of wall
 * clock. So playing earns roughly **35 coins a minute in world 1 and ~74 in
 * world 4** — call it 50/min across the campaign.
 *
 * ── What the chest may pay ──
 *
 * The chest must not out-earn playing, and it must not come close: the moment
 * the fastest route to a shoe is an open tab, the game is the thing standing
 * between the player and their money.
 *
 *   BIG_REWARD = 80 over ten minutes → **8 coins a minute**, about a sixth of
 *   what playing pays. It is also a shade more than a three-star world-1 clear
 *   is worth per minute of ATTENTION, which is the point: the chest is a gift
 *   for coming back, not a job.
 *
 *   SMALL_REWARD = 20 over three minutes → 6.7 coins a minute. Deliberately a
 *   worse RATE than the gold one, so a player who can wait is rewarded for
 *   waiting and one who cannot still gets something. (Same shape as the
 *   original's 25/100: a 1:4 step, not a 1:2.)
 */
export const SMALL_REWARD = 20
export const BIG_REWARD = 80

/**
 * Ceiling on what the chest may pay in one calendar day.
 *
 * Uncapped, 8 coins a minute is 480 an hour and 11,520 a day — enough to buy
 * the ENTIRE Locker (350 + 300 + 550 + 700 + 900 = 2800 coins) in under six
 * hours of a tab nobody is looking at. That is not a faucet, it is a cheat.
 *
 * 240 is three gold claims, and it was chosen against two fixed points:
 *
 *   • it is LESS THAN THE CHEAPEST SHOE (the Bunny Slipper, 300). A whole
 *     day of perfect chest-claiming cannot buy a single pair. Every shoe in
 *     this game is bought by playing; the chest only ever shortens the wait.
 *   • it is about two and a half three-star world-2 clears (96 each) — five
 *     minutes of actual play. Worth opening the tab for, not worth leaving it
 *     open for.
 *
 * At this cap the full Locker takes twelve days of flawless idling, against
 * roughly an hour of playing. The arithmetic has to read that lopsided or the
 * cap is not doing its job.
 */
export const DAILY_CAP = 240

export type ChestPhase = 'cooldown' | 'small' | 'big'

export interface DayLedger {
  day: string
  coins: number
}

/**
 * The calendar day the cap is measured in, in the PLAYER's timezone.
 *
 * Deliberately not `toISOString().slice(0, 10)` — UTC. A player in Berlin
 * would have their allowance reset at 02:00, and one in Los Angeles at 17:00
 * the afternoon before, neither of which is a boundary anyone recognises as a
 * new day. It also has to agree with `msUntilReset`, or the chest counts down
 * to a moment when nothing happens.
 *
 * An old UTC key simply reads as "not today" and zeroes the ledger, which is
 * generous rather than harmful, so no migration is needed.
 */
export const todayKey = (now: number = Date.now()): string => {
  const d = new Date(now)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

/** Milliseconds from `now` to the next LOCAL midnight, when the cap rolls over. */
export const msUntilReset = (now: number): number => {
  const d = new Date(now)
  d.setHours(24, 0, 0, 0)
  return Math.max(0, d.getTime() - now)
}

/** Today's payout ledger out of the save blob. A ledger from any other day —
 *  or a malformed one — reads as an untouched allowance. */
export const readLedger = (now: number = Date.now()): DayLedger => {
  const day = todayKey(now)
  const v = getState<Partial<DayLedger> | undefined>(CHEST_DAY_KEY)
  return v && v.day === day
    ? { day, coins: Math.max(0, Number(v.coins) || 0) }
    : { day, coins: 0 }
}

/**
 * When the chest was last claimed.
 *
 * A player who has NEVER claimed gets a chest that is already filled to the
 * small prize — `now - SMALL_READY_AT_MS` — rather than one that starts its
 * three minutes at boot. The chest is the one thing on the HUD that has to be
 * TAUGHT (nothing else on screen pays you for waiting), and a first-time
 * player who is shown a countdown learns nothing; one who taps it in the first
 * ten seconds and watches 20 coins fly into the wallet learns all of it, and
 * arrives at the Locker with something to spend.
 *
 * That matters more here than it did in the game this came from: Bug Crunch's
 * audience starts at six, and a six-year-old does not form a hypothesis about
 * what a shut box with a timer under it might eventually do.
 *
 * The seed is a computed value, never written: until the first claim there is
 * no chest field in the save at all, so a cloud blob that arrives late cannot
 * lose a race against a locally-written placeholder.
 */
export const readCollectedAt = (now: number = Date.now()): number => {
  const v = getState<unknown>(CHEST_KEY)
  const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10)
  return Number.isFinite(n) && n > 0 ? n : now - SMALL_READY_AT_MS
}

export const phaseFor = (elapsedMs: number): ChestPhase => {
  if (elapsedMs < SMALL_READY_AT_MS) return 'cooldown'
  if (elapsedMs < BIG_READY_AT_MS) return 'small'
  return 'big'
}

export interface TreasureChest {
  /** Where the fill has got to. */
  phase: ComputedRef<ChestPhase>
  /** What a tap pays RIGHT NOW — already trimmed to what the day has left. */
  reward: ComputedRef<number>
  /** True when a tap would pay something. */
  isReady: ComputedRef<boolean>
  /** The day's allowance is gone: the chest still fills, but cannot pay. */
  isSpent: ComputedRef<boolean>
  /** Milliseconds until the state on screen changes — the next fill step, or
   *  midnight when the day is spent. */
  remainingMs: ComputedRef<number>
  /** `MM:SS`, or `H:MM:SS` on the wait for midnight. */
  timeDisplay: ComputedRef<string>
  /** 1 → fully shuttered, 0 → open. Drives the drain over the chest art. */
  shutterPct: ComputedRef<number>
  /** Claim it. Returns the coins won — 0 when it was not ready, so a caller
   *  can decide whether to play the sound. Does NOT touch the wallet: the
   *  caller owns the payout, the VFX and the noise. */
  collect: () => number
}

/**
 * The chest, ticking. Call from a component's `setup` — it owns a 1 Hz
 * interval that it releases on unmount.
 */
export const useTreasureChest = (): TreasureChest => {
  const now = ref(Date.now())
  const collectedAt = ref(readCollectedAt(now.value))
  const ledger = ref<DayLedger>(readLedger(now.value))

  // A cloud save can arrive seconds after boot and rewrite the blob under us —
  // on a second device that is the ONLY thing standing between the player and
  // a second allowance. Both refs re-read on the hydrate bump and on any blob
  // identity change, exactly as the wallet does.
  const refresh = (): void => {
    collectedAt.value = readCollectedAt(now.value)
    ledger.value = readLedger(now.value)
  }
  watch(saveDataVersion, refresh)
  watch(bugCrunchState, refresh, { deep: false })

  const tick = window.setInterval(() => {
    now.value = Date.now()
    // Roll the ledger over at midnight without needing a reload.
    if (ledger.value.day !== todayKey(now.value)) ledger.value = readLedger(now.value)
  }, 1000)
  onUnmounted(() => clearInterval(tick))

  const elapsedMs = computed(() => Math.max(0, now.value - collectedAt.value))
  const phase = computed<ChestPhase>(() => phaseFor(elapsedMs.value))

  /** What today has left in it. */
  const dailyLeft = computed(() => Math.max(0, DAILY_CAP - ledger.value.coins))

  // Trimmed to whatever the day has left, so the chest visibly winds down
  // rather than silently paying nothing.
  const reward = computed(() =>
    Math.min(dailyLeft.value, phase.value === 'big' ? BIG_REWARD : SMALL_REWARD)
  )

  /**
   * The state that made this chest look broken in the game it came from.
   *
   * `reward` floors at the daily cap, so once the allowance was claimed the
   * chest went un-clickable — while `remainingMs` returned 0 for the big phase,
   * pinning the label to a dead `00:00` for the rest of the day. A timer at
   * zero next to a button that does nothing reads as a bug, not as a limit.
   */
  const isSpent = computed(() => dailyLeft.value === 0)
  const isReady = computed(() => phase.value !== 'cooldown' && reward.value > 0)

  const remainingMs = computed(() => {
    // Spent: what the player is waiting on is midnight, not the next fill.
    if (isSpent.value) return msUntilReset(now.value)
    if (phase.value === 'cooldown') return SMALL_READY_AT_MS - elapsedMs.value
    if (phase.value === 'small') return BIG_READY_AT_MS - elapsedMs.value
    return 0
  })

  const timeDisplay = computed(() => {
    const totalSec = Math.ceil(remainingMs.value / 1000)
    const h = Math.floor(totalSec / 3600)
    const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0')
    const ss = String(totalSec % 60).padStart(2, '0')
    // Hours only ever show on the wait for midnight — a fill is under ten
    // minutes, so the common case keeps its compact MM:SS.
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
  })

  const shutterPct = computed(() => {
    // A spent chest stays fully shuttered, so it reads as closed rather than
    // as a ready chest that refuses to open.
    if (isSpent.value) return 1
    if (phase.value !== 'cooldown') return 0
    return remainingMs.value / SMALL_READY_AT_MS
  })

  const collect = (): number => {
    if (!isReady.value) return 0
    const won = reward.value
    const at = Date.now()
    const nextLedger: DayLedger = { day: todayKey(at), coins: readLedger(at).coins + won }
    now.value = at
    collectedAt.value = at
    ledger.value = nextLedger
    // One batched write → one reactive pass, one persist schedule.
    setStates({ [CHEST_KEY]: at, [CHEST_DAY_KEY]: nextLedger })
    return won
  }

  return { phase, reward, isReady, isSpent, remainingMs, timeDisplay, shutterPct, collect }
}
