<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import SplatHud from '@/components/game/SplatHud.vue'
import JuiceVial from '@/components/game/JuiceVial.vue'
import LevelBanner from '@/components/game/LevelBanner.vue'
import BossBar from '@/components/game/BossBar.vue'
import ControlHint, { type HintId } from '@/components/game/ControlHint.vue'
import TutorialOverlay from '@/components/game/TutorialOverlay.vue'
import ObjectiveList from '@/components/game/ObjectiveList.vue'
import StarRow from '@/components/game/StarRow.vue'
import CoinBadge from '@/components/organisms/CoinBadge.vue'
import LockerModal from '@/components/organisms/LockerModal.vue'
import TreasureChest from '@/components/organisms/TreasureChest.vue'
import RewardRevealModal from '@/components/organisms/RewardRevealModal.vue'
import OptionsModal from '@/components/organisms/OptionsModal.vue'
import LeaderboardModal from '@/components/organisms/LeaderboardModal.vue'
import FReward from '@/components/atoms/FReward.vue'
import FButton from '@/components/atoms/FButton.vue'
import FHudButton from '@/components/atoms/FHudButton.vue'
import FHudBadge from '@/components/atoms/FHudBadge.vue'
import FMuteButton from '@/components/atoms/FMuteButton.vue'
import GameIcon from '@/components/icons/GameIcon.vue'
import IconCoin from '@/components/icons/IconCoin.vue'

import * as game from '@/use/useBugCrunchGame'
import * as art from '@/use/useBugCrunchArt'
import { playFx, setSquishVoice, warmAudio } from '@/use/useGameAudio'
import { resetVfx, sampleFrame } from '@/use/useVfx'
import { useMusic, setMusicRate } from '@/use/useSound'
import useSounds from '@/use/useSound'
import { haptic } from '@/use/useHaptics'
import useAssets from '@/use/useAssets'
import useUser, {
  isMobileLandscape, isShortViewport, windowWidth, windowHeight, difficultyFactor
} from '@/use/useUser'
import { isAnyModalOpen } from '@/use/useModalState'
import { isAdShowing, isGamePaused, isPlatformPaused, isVisibilityHidden } from '@/use/useGamePause'
import { isGameplayLive, restartGameplayBracket, syncGameplayLifecycle } from '@/use/useGameplayLifecycle'
import { canShowInterstitial, markInterstitialShown } from '@/use/useAdGate'
import { showMidgameAd } from '@/use/useAds'
import { leaderboardEnabled, ensureBoard, playerTotal, rankFor, reportRun } from '@/use/useLeaderboard'
import { formatCount } from '@/utils/localeNumber'
import useSplatProgress from '@/use/useSplatProgress'
import useLocker from '@/use/useLocker'
import { getState, setState } from '@/use/useBugCrunchState'
import { HINTS_SEEN_KEY, ONBOARDED_KEY, SEEN_BUGS_KEY, TUTORIAL_KEY } from '@/keys'
import { levelLabel, levelSpec, worldOf, WORLDS, TOTAL_LEVELS } from '@/game/stages'
import { bossPhaseTicks, bossSpec } from '@/game/bosses'
import { starsEarned, evaluate, emptyTally, type RunTally } from '@/game/stars'
import { FEVER_MS, comboMusicRate } from '@/game/combo'
import { bugSpec, type BugId } from '@/game/bugs'
import { blowPierce } from '@/game/shoes'
import { rewardsForResult, nextSeenBugs, type CampaignReward } from '@/game/campaignRewards'
import { warmNextLevelArt } from '@/game/artPreload'
import { installPreviewSeam } from '@/game/previewFeed'
import * as tutor from '@/use/useTutorial'
import { type LessonId } from '@/game/tutorial'
import { mobileCheck } from '@/utils/function'

/**
 * ─── The scene ──────────────────────────────────────────────────────────────
 *
 * One canvas, one HUD layer over it, and three modals. The game boots STRAIGHT
 * INTO LEVEL 1-1 — there is no main menu, because a menu is a decision asked of
 * somebody who has not yet been given a reason to care.
 *
 * This file owns exactly three things:
 *
 *   1. INPUT. Pointer events become aim points and presses; that is all it
 *      knows about the game's controls.
 *   2. THE FRAME. `requestAnimationFrame` → `game.step` → the event drain →
 *      `art.drawScene`. Every visual decision lives in the renderer and every
 *      rule in the simulation; neither is reachable from a template.
 *   3. THE FLOW. Level start, level end, the result screen, the next level.
 *
 * ── The board's geometry ──
 *
 * The canvas fills the viewport. The PLAY RECT — where bodies live and the foot
 * may go — is that minus the MEASURED height of the HUD's own bars, so nothing
 * on the floor is ever hidden under a readout. Measured rather than assumed,
 * because the bars grow with the type scale, the language and the safe-area
 * inset, and a guessed inset is wrong on exactly the phones that can least
 * afford it.
 */

const { t, locale } = useI18n()

/**
 * Group a number for the player's language — `154331` → `154,331` / `154.331`.
 *
 * Read `locale.value` INSIDE the call rather than building a formatter once at
 * setup: this component is mounted for the whole session, so a formatter fixed
 * at first paint would keep English commas on a board the player has since
 * switched to German. See `src/utils/localeNumber.ts` for why the digits stay
 * Latin.
 */
const fmt = (n: number): string => formatCount(n, locale.value)
const { playSound } = useSounds()
const { startBattleMusic, stopBattleMusic } = useMusic()
const { preloadAssets } = useAssets()
const { userJuiceStyle, userHighVis, userSingleTap } = useUser()
const progress = useSplatProgress()
const { equippedShoe, equippedSpec, affordableShoes, ownedShoes } = useLocker()

// ─── Refs ───────────────────────────────────────────────────────────────────

const canvasRef = ref<HTMLCanvasElement | null>(null)
const topBarRef = ref<HTMLElement | null>(null)
const bottomBarRef = ref<HTMLElement | null>(null)
const railRef = ref<HTMLElement | null>(null)

const showResult = ref(false)
const showLocker = ref(false)

// ─── The gift screen ────────────────────────────────────────────────────────
//
// Things won during the campaign are PRESENTED before the result screen rather
// than listed on it. A world opening, a star milestone, a new species met and a
// personal best are four different feelings, and a row of chips on a summary
// gives all four the same weight — which is to say none. `RewardRevealModal`
// takes the queue and shows them one at a time, each with the burst the reward
// overlay was built for, and hands control back when it is empty.
const showReveals = ref(false)
const pendingReveals = ref<CampaignReward[]>([])
const onRevealsDone = (): void => { showResult.value = true }

/** The wallet's own element, so the chest's coins have somewhere to fly to. */
const coinBadgeRef = ref<InstanceType<typeof CoinBadge> | null>(null)
const coinBadgeEl = computed<HTMLElement | null>(() => coinBadgeRef.value?.rootEl ?? null)
const showOptions = ref(false)
const showLeaderboard = ref(false)
const showBanner = ref(false)

const isTouch = mobileCheck()
  || (typeof window !== 'undefined' && navigator.maxTouchPoints > 0)

// ─── Level state ────────────────────────────────────────────────────────────

const level = ref(progress.currentLevel.value)
const spec = computed(() => levelSpec(level.value))
const label = computed(() => levelLabel(level.value))
const world = computed(() => worldOf(level.value))
const theme = computed(() => WORLDS[world.value].theme)

/** The three objectives' live state, for the level card. */
const met = computed(() => evaluate(spec.value.objectives, game.tally.value))

interface Summary {
  level: number
  cleared: boolean
  stars: number
  previousStars: number
  coins: number
  tally: RunTally
  isRecord: boolean
  unlockedWorld: number | null
  met: readonly [boolean, boolean, boolean]
}

const summary = ref<Summary>({
  level: 1, cleared: false, stars: 0, previousStars: 0, coins: 0,
  tally: emptyTally(), isRecord: false, unlockedWorld: null, met: [false, false, false]
})

const summarySpec = computed(() => levelSpec(summary.value.level))

// ─── The lessons ────────────────────────────────────────────────────────────
//
// The scene's half of the tutorial: WHEN each lesson becomes relevant, and
// WHERE on the screen it points. Which lesson is on screen, and whether it has
// ever been taught, belong to `useTutorial`; what it looks like belongs to
// `TutorialOverlay`. See `game/tutorial.ts` for why there is a list at all.

/**
 * How long the player has actually been PRESENT.
 *
 * Counted from the first input, never from the wall clock. An interstitial, a
 * consent dialog or a tab opened in the background all leave the game running
 * with nobody looking at it, and a bail-out on wall time would retire the whole
 * lesson before the player ever reached the game.
 */
let sawInput = false

/** The legacy flag: true once the opening three lessons are behind the player.
 *  Still written, because the control-hint pill and the result screen read it. */
const tutorialSeen = ref(getState<boolean>(TUTORIAL_KEY, false) === true)

const activeLesson = tutor.activeLesson
const lessonSpecOf = tutor.activeSpec
const lessonProgress = tutor.lessonProgress

/** Where the lesson points, and (for a `flow`) where it points TO, in CSS px. */
const lessonAt = ref({ x: 0, y: 0 })
const lessonTo = ref({ x: 0, y: 0 })

/**
 * Is the lesson on screen right now?
 *
 * A board lesson stops with the game — every modal takes an app pause, and a
 * lesson armed at the last second of a level must not tick its bail-out away
 * behind the result screen. The META lessons are the exception: they are ABOUT
 * those screens, so they run through the pause (`whilePaused`).
 */
const lessonShown = computed(() =>
  lessonSpecOf.value !== null
  && (!isGamePaused.value || lessonSpecOf.value.whilePaused === true))

/**
 * The centre of a HUD control, in viewport px.
 *
 * A LIST of selectors rather than one, because several of the things a lesson
 * points at are owned by other components whose markup is allowed to change —
 * and a lesson that silently points at (0, 0) because a class was renamed is
 * worse than one that does not run. The first selector that resolves wins; if
 * none do, the caller falls back to the foot and the lesson still reads.
 */
const elCentre = (...selectors: string[]): { x: number; y: number } | null => {
  for (const sel of selectors) {
    const el = document.querySelector(sel)
    if (!el) continue
    const r = el.getBoundingClientRect()
    if (r.width <= 0 && r.height <= 0) continue
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  }
  return null
}

const finishTutorial = (): void => {
  if (tutorialSeen.value) return
  tutorialSeen.value = true
  setState(TUTORIAL_KEY, true)
}

// ─── The running hint ───────────────────────────────────────────────────────

const hintsSeen = ref<Record<string, boolean>>(
  (getState<Record<string, boolean>>(HINTS_SEEN_KEY, {}) ?? {}) as Record<string, boolean>)
const onboarded = ref(getState<boolean>(ONBOARDED_KEY, false) === true)
const activeHint = ref<HintId | null>(null)
let hintTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Show a one-shot hint, once ever.
 *
 * `move` is the exception: it is shown at the top of every level until the
 * player has cleared one, because the control is the whole game and somebody
 * who put the game down for a week should be reminded rather than assumed.
 */
const teach = (id: HintId, ms = 4200): void => {
  if (id !== 'move' && hintsSeen.value[id]) return
  if (id === 'move' && onboarded.value) return
  activeHint.value = id
  if (id !== 'move') {
    hintsSeen.value = { ...hintsSeen.value, [id]: true }
    setState(HINTS_SEEN_KEY, hintsSeen.value)
  }
  if (hintTimer) clearTimeout(hintTimer)
  hintTimer = setTimeout(() => { activeHint.value = null }, ms)
}

const bossShown = computed(() =>
  spec.value.boss !== null && game.phase.value === 'play' && !showResult.value)

/** A boss tell and a primer must never be on screen together — see
 *  `ControlHint.vue`. The tell has a countdown; the primer does not. */
const hintSuppressed = computed(() => bossShown.value && game.bossTell.value !== null)

// ─── Sizing ─────────────────────────────────────────────────────────────────

let pxPerU = 4

const resize = (): void => {
  const c = canvasRef.value
  if (!c) return
  const w = window.innerWidth
  const h = window.innerHeight
  const dpr = art.setScale(w, h, window.devicePixelRatio || 1)
  c.width = Math.max(1, Math.round(w * dpr))
  c.height = Math.max(1, Math.round(h * dpr))
  c.style.width = `${w}px`
  c.style.height = `${h}px`
  const ctx = c.getContext('2d')
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  pxPerU = art.getPxPerU()
  syncBoard()
}

/**
 * Hand the simulation the board, in u, with the HUD's own bars carved out.
 *
 * The left inset is the vial's rail. It is always on the left, in both
 * orientations, because a control that moves between portrait and landscape is
 * a control the player has to find twice.
 */
const syncBoard = (): void => {
  const w = window.innerWidth
  const h = window.innerHeight
  const top = (topBarRef.value?.getBoundingClientRect().height ?? 0) + 8
  const bottom = (bottomBarRef.value?.getBoundingClientRect().height ?? 0) + 8
  // Measured, not guessed: the rail is centred with the rest of the HUD on a
  // wide screen, so where it ends is a layout result rather than a constant.
  // Capped at a fifth of the board so a very wide vial can never eat the field.
  const railRight = railRef.value?.getBoundingClientRect().right ?? 0
  const left = Math.min(w * 0.2, railRight + 6)
  game.setBoard({
    w: w / pxPerU,
    h: h / pxPerU,
    x0: left / pxPerU,
    y0: top / pxPerU,
    x1: (w - 6) / pxPerU,
    y1: (h - bottom) / pxPerU
  })
}

// ─── Input ──────────────────────────────────────────────────────────────────
//
// One rule for the whole game: the foot goes where the player points. On touch
// it is LIFTED above the finger so the thumb never covers the target; on a mouse
// the cursor is a point and no lift is needed.

const pointerActive = ref(false)

const toWorld = (e: PointerEvent): { x: number; y: number } => {
  const lift = e.pointerType === 'touch' ? game.TOUCH_LIFT_U : 0
  return { x: art.fromX(e.clientX), y: art.fromY(e.clientY) - lift }
}

const onPointerDown = (e: PointerEvent): void => {
  if (!interactive.value) return
  canvasRef.value?.setPointerCapture?.(e.pointerId)
  pointerActive.value = true
  sawInput = true
  const p = toWorld(e)
  // Right button is a direct slam on desktop — no charge, full power.
  if (e.button === 2) {
    game.aim(p.x, p.y)
    game.slamNow()
    return
  }
  game.press(p.x, p.y, performance.now())
}

const onPointerMove = (e: PointerEvent): void => {
  if (!interactive.value) return
  // On a mouse the foot tracks the cursor always; on touch it only tracks a
  // finger that is down. A touch game whose foot follows nothing between taps
  // has no hover state at all — and the hover shadow is half the game.
  if (e.pointerType !== 'touch' || pointerActive.value) {
    sawInput = true
    const p = toWorld(e)
    game.aim(p.x, p.y)
  }
}

const onPointerUp = (): void => {
  pointerActive.value = false
  game.release()
}

const onKeyDown = (e: KeyboardEvent): void => {
  if (e.repeat) return
  if (e.code === 'Space') {
    e.preventDefault()
    onFever()
    return
  }
  if (e.code === 'Escape') {
    e.preventDefault()
    showOptions.value = true
  }
}

/** The canvas accepts input only while the level is genuinely being played. */
const interactive = computed(() =>
  game.phase.value === 'play' && !showResult.value && !isGamePaused.value)

// ─── The frame ──────────────────────────────────────────────────────────────

let raf = 0
let lastT = 0

const loop = (now: number): void => {
  raf = requestAnimationFrame(loop)
  const dt = lastT === 0 ? 16.7 : Math.min(100, now - lastT)
  lastT = now
  sampleFrame(dt)

  const ctx = canvasRef.value?.getContext('2d')
  if (!ctx) return

  if (!isGamePaused.value) {
    game.step(dt)
    drainToWorld()
    if (sawInput) { armBodyLessons(); armChestLesson() }
  }

  // OUTSIDE the pause gate: the meta lessons are about the panels that cause
  // the pause, and would never get a frame if they stopped with the board.
  if (lessonShown.value) stepTutorial(dt)

  art.drawScene(ctx, window.innerWidth, window.innerHeight, isGamePaused.value ? 0 : dt)
}

/**
 * Turn the simulation's events into sound, haptics and pictures.
 *
 * The renderer owns the pictures (`art.applyEvents`); this owns the SOUND,
 * because the mix needs things the renderer does not — which shoe is on, which
 * Juice Style is set, and where on the board the event happened.
 */
const drainToWorld = (): void => {
  const events = game.drainEvents()
  if (events.length === 0) return
  art.applyEvents(events)

  const shoe = game.getShoe()
  const weight = 1 - (shoe.speedRank - 1) / 4
  const style = userJuiceStyle.value

  for (const e of events) {
    switch (e.k) {
      case 'squish': {
        const b = bugSpec(e.bug)
        setSquishVoice({
          mass: Math.min(1, Math.max(0, (b.size - 1.8) / 2.2)),
          weight,
          style,
          debris: b.armor > 0 || b.airborne,
          heavy: e.heavy,
          pan: pan(e.x)
        })
        playFx('squish', 0, pan(e.x))
        haptic('tick')
        break
      }
      case 'hurt': playFx('hurt', 0, pan(e.x)); break
      case 'clang': playFx('clang', 0, pan(e.x)); break
      case 'spike':
        playFx('spike', 0, pan(e.x))
        haptic('impact')
        break
      case 'stomp':
        playFx(e.heavy ? 'stompHeavy' : 'stompLight', e.heavy ? 1 : 0, pan(e.x))
        if (e.heavy) haptic('impact')
        break
      case 'pivot': playFx('pivot', 0, pan(e.x)); break
      case 'chain':
        if (e.step) playFx('chainStep', Math.min(1, (e.n - 1) / 14))
        break
      case 'chainLost': playFx('chainBreak'); break
      case 'fever':
        playFx('feverStart')
        haptic('reward')
        break
      case 'feverEnd': playFx('feverEnd'); break
      case 'coin':
        playFx('coin', 0, pan(e.x))
        progress.addCoins(e.n)
        break
      case 'salt': playFx('salt', 0, pan(e.x)); break
      case 'magnet': playFx('magnet', 0, pan(e.x)); break
      case 'sweep': playFx('sweep', 0, pan(e.x)); break
      case 'podPop': playFx('podPop', 0, pan(e.x)); break
      case 'podHatch': playFx('podHatch', 0, pan(e.x)); break
      case 'chain-arc': playFx('arc'); break
      case 'bossHit':
        playFx(e.counter ? 'bossCounter' : 'bossHit', 0, pan(e.x))
        if (e.counter) haptic('reward')
        break
      case 'bossPhase':
        playFx('bossPhase')
        teachForBoss()
        break
      case 'bossDown':
        playFx('bossDie')
        haptic('reward')
        break
      case 'end':
        void onLevelEnd(e.won)
        break
      default:
        break
    }
  }
}

/** −1 left, +1 right, from a world x. Cheap stereo that costs nothing and makes
 *  a board feel wide. */
const pan = (x: number): number => {
  const b = game.getBoard()
  const mid = (b.x0 + b.x1) / 2
  const half = Math.max(1, (b.x1 - b.x0) / 2)
  return Math.max(-1, Math.min(1, (x - mid) / half)) * 0.6
}

// ─── The tutorial's clock ───────────────────────────────────────────────────

/**
 * The nearest live body the lesson can point at, or null.
 *
 * `want` filters by a predicate — the spike lesson has to land on a caterpillar
 * and nothing else, or it teaches the player to avoid ants.
 */
const nearestBody = (want?: (id: string) => boolean): { x: number; y: number } | null => {
  const bugs = game.getBugs()
  const n = game.getBugCount()
  const foot = game.getFoot()
  let best: { x: number; y: number } | null = null
  let bestD = Infinity
  for (let i = 0; i < n; i++) {
    const b = bugs[i]!
    if (!b.alive) continue
    if (want && !want(b.id)) continue
    const d = (b.x - foot.x) ** 2 + (b.y - foot.y) ** 2
    if (d < bestD) { bestD = d; best = { x: b.x, y: b.y } }
  }
  return best
}

/** Where each lesson points. World positions go through the art transform;
 *  HUD controls are read off their own rects. */
const aimLesson = (id: LessonId): void => {
  const foot = game.getFoot()
  const atFoot = { x: art.toX(foot.x), y: art.toY(foot.y) }
  const world = (p: { x: number; y: number } | null) =>
    (p ? { x: art.toX(p.x), y: art.toY(p.y) } : atFoot)

  switch (id) {
    case 'move':
      lessonAt.value = atFoot
      return
    case 'stomp':
    case 'chain':
      lessonAt.value = world(nearestBody())
      return
    case 'goal': {
      // The only lesson with two ends: a body on the floor, and the bar at the
      // top of the screen that fills when it is squished.
      lessonAt.value = world(nearestBody())
      lessonTo.value = elCentre('.hud__rail') ?? { x: windowWidth.value / 2, y: 40 }
      return
    }
    case 'slam':
      lessonAt.value = world(
        nearestBody((b) => blowPierce(equippedSpec.value, false) < bugSpec(b as never).armor)
        ?? nearestBody()
      )
      return
    case 'spike':
      lessonAt.value = world(nearestBody((b) => bugSpec(b as never).spiky))
      return
    case 'dodge':
      lessonAt.value = world(nearestBody((b) => bugSpec(b as never).dodges))
      return
    case 'boss': {
      const boss = game.getBoss()
      lessonAt.value = boss
        ? { x: art.toX(boss.x), y: art.toY(boss.y) }
        : (elCentre('.scene__boss') ?? atFoot)
      return
    }
    case 'fever':
      lessonAt.value = elCentre('.vial__button', '.scene__rail') ?? atFoot
      return
    case 'chest':
      lessonAt.value = elCentre('.chest', '.scene__wallet') ?? atFoot
      return
    case 'locker':
      lessonAt.value = elCentre('.scene__locker button', '.scene__locker') ?? atFoot
      return
    case 'buy':
      lessonAt.value = elCentre(
        '.shoe-card.is-affordable .f-button',
        '.shoe-card.is-open .f-button',
        '.shoe-card'
      ) ?? atFoot
      return
    case 'stars':
      lessonAt.value = elCentre('.result__stars', '.result') ?? atFoot
  }
}

/**
 * One frame of the tutorial.
 *
 * AIMING happens every frame; the CLOCK only runs while the player is present.
 * The two were one thing in the first cut, gated together on `sawInput`, and
 * that put the result screen's star lesson in the top-left corner of the
 * screen: `sawInput` is set from canvas input, the result screen makes the
 * canvas non-interactive, and a player who reached it without having dragged
 * the shoe first left the lesson pointing at (0, 0) — its initial value, never
 * updated.
 *
 * `present` is therefore not just "touched the board". A lesson that lives on a
 * PANEL was reached by pressing a button to get there, which is as present as a
 * player ever is.
 */
const stepTutorial = (dt: number): void => {
  const id = activeLesson.value
  if (id === null) return
  aimLesson(id)
  const present = sawInput || lessonSpecOf.value?.whilePaused === true
  if (!present) return
  // `move` is the one lesson with no event to listen for — there is no "moved"
  // signal, only a foot that is or is not travelling.
  const doing = id === 'move' && game.getFoot().speed > 4
  tutor.step(dt, doing)
}

/**
 * The opening three run in ORDER, and each one arms the next.
 *
 * Armed here rather than at the level's start, which is where the first cut put
 * them: at the level's start nothing has been taught yet, so the condition
 * "`move` is done" was false and the stomp lesson was never armed at all — a
 * new player was shown how to move and then left on an empty screen with no
 * idea what to do with it. The lesson that follows a lesson has to be armed by
 * the lesson before it.
 */
watch(() => tutor.isTaught('move'), (done) => {
  if (done && !tutor.isTaught('stomp')) tutor.arm('stomp')
}, { immediate: true })

/** Squishing something retires the stomp lesson, and opens the two that only
 *  make sense once the player has landed one. */
watch(game.squished, (n, prev) => {
  if (n <= prev) return
  tutor.complete('stomp')
  if (!tutor.isTaught('goal')) tutor.arm('goal')
  else if (n >= 2 && !tutor.isTaught('chain')) tutor.arm('chain')
})

/** A chain of two is the chain lesson, learned. */
watch(game.chainCount, (n) => { if (n >= 2) tutor.complete('chain') })

/** A charged slam retires the slam lesson — and the opening three. */
watch(game.slams, (n, prev) => {
  if (n > prev) { tutor.complete('slam'); finishTutorial() }
})

/** Spending the vial retires the Fever lesson. */
watch(game.feverMs, (n, prev) => { if (n > 0 && prev <= 0) tutor.complete('fever') })

/** The vial filling for the first time is the moment to point at the button. */
watch(game.feverCharged, (ready) => {
  if (ready) { teach('fever', 4200); tutor.arm('fever') }
})

/** Hitting the boss retires the boss lesson. */
watch(game.bossHp, (hp, prev) => { if (hp < prev) tutor.complete('boss') })

// ─── The meta lessons ───────────────────────────────────────────────────────
//
// The shop was the single loudest piece of feedback on the first build: a
// reviewer reported that "skin buying does not work", and two of the three
// reasons were that nobody knew the Locker existed and nobody knew a card had
// to be pressed before it would sell them anything. So the game now points at
// both, in order, and only at the moment the player can ACTUALLY afford
// something — an arrow pointing at a shop you cannot buy from teaches
// disappointment.

/**
 * The chest was opened.
 *
 * The wallet has ALREADY been paid by the component — the coins are mid-flight
 * to the badge as this runs — so there is nothing to add here. Two things do
 * belong here: the lesson is over, and a GOLD prize off the board is worth a
 * gift screen. A gold prize mid-level is not: the coin burst is the feedback
 * there, and a modal over a running clock is a punishment for claiming.
 */
const onChestClaimed = (p: { coins: number; gold: boolean }): void => {
  tutor.complete('chest')
  if (!p.gold || !showResult.value) return
  pendingReveals.value = [{ kind: 'chest', coins: p.coins, gold: true }]
  showReveals.value = true
}

/**
 * The chest is claimable for the first time.
 *
 * Probed off the DOM rather than off the composable, and deliberately: the
 * chest owns its own 1 Hz clock inside the component, and a second copy of that
 * clock out here would be a second source of truth for when it is ready. What
 * the lesson needs is not the state, it is the BUTTON — which it has to find
 * anyway to point at.
 */
const armChestLesson = (): void => {
  if (tutor.isTaught('chest')) return
  if (document.querySelector('.chest.is-ready')) tutor.arm('chest')
}

/**
 * The moment the player can first afford something.
 *
 * Armed here as well as on the result screen, because coins do not only arrive
 * at the end of a level — the chest pays out mid-session — and "you have enough
 * for a new shoe" is only interesting in the second it becomes true. The
 * director's queue keeps it behind anything happening on the board (the shop
 * lessons are the last two rungs of the curriculum), so it waits its turn
 * rather than landing on top of a chain.
 */
watch(affordableShoes, (n, before) => {
  if (n > 0 && before === 0) tutor.arm('locker')
})

/** The result screen is the natural pause to mention the shop in. */
watch(showResult, (open) => {
  if (!open) { tutor.shelve('stars'); tutor.shelve('locker'); return }
  tutor.arm('stars')
  if (affordableShoes.value > 0) tutor.arm('locker')
})

/** Opening it retires the first half and arms the second. */
watch(showLocker, (open) => {
  if (!open) { tutor.shelve('buy'); return }
  tutor.complete('locker')
  if (affordableShoes.value > 0) {
    // One tick, so the modal's cards are in the DOM before the lesson tries to
    // find the one it is pointing at.
    void nextTick(() => { if (showLocker.value) tutor.arm('buy') })
  }
})

/** A shoe actually bought is the lesson, learned — and the end of the shop
 *  curriculum. */
watch(ownedShoes, (now, before) => {
  if (now.length > before.length) { tutor.complete('buy'); tutor.complete('locker') }
}, { deep: false })

// ─── Flow ───────────────────────────────────────────────────────────────────

const startLevel = (n: number): void => {
  level.value = Math.max(1, Math.min(TOTAL_LEVELS, n))
  progress.setLevel(level.value)
  resetVfx()
  art.resetArt()
  art.setHighVis(userHighVis.value)
  syncBoard()
  game.setTouch(isTouch)
  game.startLevel({
    level: level.value,
    shoe: equippedShoe.value,
    juiceStyle: userJuiceStyle.value,
    singleTap: userSingleTap.value,
    difficulty: difficultyFactor(),
    relief: progress.reliefFor(level.value)
  })
  showResult.value = false
  showBanner.value = true
  if (bannerTimer) clearTimeout(bannerTimer)
  bannerTimer = setTimeout(() => { showBanner.value = false }, 1700)
  startBattleMusic()
  teachLevelHints()
  warmNextLevelArt(level.value + 1)
}

let bannerTimer: ReturnType<typeof setTimeout> | null = null
const hintTimers: ReturnType<typeof setTimeout>[] = []

/**
 * What this level introduces — the text pills AND the wordless lessons.
 *
 * The two are not alternatives. A pill is a reminder for somebody who can read
 * and already knows the game; a lesson is how a six-year-old finds out the
 * mechanic exists at all. The pill retires on a timer, the lesson retires when
 * the player does the thing.
 *
 * Lessons are armed on a DELAY rather than at the level's first frame, for the
 * same reason the pills are: a level opens on a banner and a board filling up,
 * and an instruction laid over that is one more thing competing for the same
 * glance. The exception is the very first level, where there is nothing else to
 * be looking at and the control is the only thing that matters.
 */
const teachLevelHints = (): void => {
  for (const id of hintTimers) clearTimeout(id)
  hintTimers.length = 0
  const s = spec.value
  if (!onboarded.value) teach('move', 5200)

  // The opening three, in order, and only in the first level: move, then the
  // stomp, and the goal follows the first squish (see the `squished` watcher).
  if (!tutor.isTaught('move')) tutor.arm('move')
  if (tutor.isTaught('move') && !tutor.isTaught('stomp')) tutor.arm('stomp')

  const ids = new Set(s.roster.map((r) => r.id))
  hintTimers.push(setTimeout(() => {
    if (s.boss) { teach('boss', 5000); tutor.arm('boss'); return }
    if (ids.has('caterpillar')) teach('spike')
    // Before the beetle: the sprinter debuts on 1-2 and the beetle on 1-4, and
    // a primer that arrives two levels after the thing it is about is not a
    // primer.
    else if (ids.has('sprinter')) teach('sprinter')
    else if (ids.has('beetle')) teach('beetle')
    else if (ids.has('flea')) teach('flea')
    else if (ids.has('stinkbug')) teach('stink')
  }, 2400))
  hintTimers.push(setTimeout(() => {
    for (const h of s.hazards) {
      if (h === 'honey') { teach('honey'); return }
      if (h === 'cobweb') { teach('web'); return }
      if (h === 'conveyor') { teach('belt'); return }
      if (h === 'sweeper') { teach('sweeper'); return }
    }
  }, 9000))
}

/**
 * Lessons that wait for their subject to be ON THE BOARD.
 *
 * A roster says a caterpillar *can* appear; it does not say one has. Pointing
 * at where a spiky bug would be if there were one teaches nothing, so these are
 * armed from the frame loop the moment the thing actually exists — which is
 * also the first moment the player could be hurt by not knowing.
 */
const armBodyLessons = (): void => {
  if (game.phase.value !== 'play' || showResult.value) return
  const bugs = game.getBugs()
  const n = game.getBugCount()
  let sawArmour = false
  let sawSpike = false
  let sawDodge = false
  for (let i = 0; i < n; i++) {
    const b = bugs[i]!
    if (!b.alive) continue
    // Armoured FOR THIS SHOE. A beetle is armour 2 and the steel boot pierces 4,
    // so a player wearing it taps straight through — and teaching them to charge
    // for it would be teaching a slower way to do what they were already doing.
    if (blowPierce(equippedSpec.value, false) < b.spec.armor) sawArmour = true
    if (b.spec.spiky) sawSpike = true
    if (b.spec.dodges) sawDodge = true
  }
  // Spikes first: it is the only one of the three that costs the player
  // something to learn the hard way.
  if (sawSpike && !equippedSpec.value.spikeProof) tutor.arm('spike')
  if (sawArmour) tutor.arm('slam')
  if (sawDodge) tutor.arm('dodge')
}

const teachForBoss = (): void => {
  const s = spec.value
  if (!s.boss) return
  const p = bossSpec(s.boss).phases[game.bossPhaseIndex.value]
  if (p?.script === 'pods') teach('pods', 4200)
  else if (p?.script === 'charge') teach('boss', 4200)
}

const onLevelEnd = async (won: boolean): Promise<void> => {
  const tally = game.tally.value
  const stars = starsEarned(spec.value.objectives, tally)
  const previousStars = progress.starsFor(level.value)
  // Read BEFORE banking: `bankLevel` moves both of these, and a reveal that
  // compared a number with itself would announce every run as a record.
  const starsBefore = progress.totalStars.value
  const bestBefore = progress.bestScore.value
  const banked = progress.bankLevel(level.value, stars, tally)

  summary.value = {
    level: level.value,
    cleared: won,
    stars,
    previousStars,
    coins: banked.coins,
    tally,
    isRecord: banked.isRecord,
    unlockedWorld: banked.unlockedWorld,
    met: evaluate(spec.value.objectives, tally)
  }

  if (!onboarded.value && won) {
    onboarded.value = true
    setState(ONBOARDED_KEY, true)
  }

  playFx(won ? 'levelClear' : 'levelFail')
  stopBattleMusic()
  setMusicRate(1)

  // The board, then the screen. `reportRun` never throws and is never awaited
  // at a call site the player is waiting on.
  if (leaderboardEnabled) {
    void reportRun(progress.bestScore.value, progress.bestLevel.value, { force: true })
    void ensureBoard()
  }

  // ── The ad goes BEFORE the result screen, always ──
  //
  // An interstitial that lands ON the result screen covers the stars the player
  // just earned and steals the one moment the whole level was for; portals grade
  // the same way. So the ad is requested first and the screen opens after it
  // resolves — or immediately, when the gate says no.
  //
  // Never before level 3: the opening minutes are the retention funnel, and an
  // ad inside them is the single most expensive thing a hybrid-casual game can
  // do to its own first session.
  if (won && level.value > 2 && canShowInterstitial()) {
    markInterstitialShown()
    try { await showMidgameAd() } catch { /* no fill — carry on */ }
  }

  // ── What this run WON, before what it scored ──
  //
  // The gift screen goes first and the result screen follows it, because the
  // two are answering different questions: "what did you just earn" and "how
  // did you do". Opened with an empty queue the modal closes immediately and
  // still emits `done`, so this is never a place a player can get stuck.
  const seen = getState<BugId[]>(SEEN_BUGS_KEY, [])
  pendingReveals.value = rewardsForResult({
    tally: banked.tally,
    unlockedWorld: banked.unlockedWorld,
    starsBefore,
    starsAfter: progress.totalStars.value,
    isRecord: banked.isRecord,
    previousBest: bestBefore,
    seenBugs: seen
  })
  const nextSeen = nextSeenBugs(seen, banked.tally)
  if (nextSeen !== seen) setState(SEEN_BUGS_KEY, nextSeen)

  if (pendingReveals.value.length > 0) showReveals.value = true
  else showResult.value = true
  warmNextLevelArt(won ? level.value + 1 : level.value)
}

const onNext = (): void => {
  const next = summary.value.cleared
    ? Math.min(TOTAL_LEVELS, summary.value.level + 1)
    : summary.value.level
  showResult.value = false
  // A handover with no screen between two levels has to say so by hand, or the
  // portals hear one endless play — see `restartGameplayBracket`.
  restartGameplayBracket()
  startLevel(next)
}

const onRetry = (): void => {
  showResult.value = false
  restartGameplayBracket()
  startLevel(summary.value.level)
}

// ─── Result-screen readouts ─────────────────────────────────────────────────

const resultRank = computed(() => {
  if (!leaderboardEnabled) return null
  const rank = rankFor(progress.bestScore.value)
  // `#` is built here rather than in the template: pug reads a leading `#` as
  // an id shorthand and will not parse `#{rank}`.
  //
  // Grouped through the GAME's locale, not `toLocaleString()`'s no-argument
  // form, which follows the browser's locale instead — a player running the
  // game in English on a German system was being shown `1.130` beside an
  // otherwise English screen.
  return rank > 0 ? `#${fmt(rank)}` : null
})

const resultCompact = computed(() => isMobileLandscape.value || isShortViewport.value)

const bossTicks = computed(() =>
  spec.value.boss ? bossPhaseTicks(bossSpec(spec.value.boss)) : [])

const railProgress = computed(() => {
  if (spec.value.boss) return 1 - game.bossHp.value
  return spec.value.quota > 0 ? Math.min(1, game.squished.value / spec.value.quota) : 0
})

const nextLabel = computed(() => levelLabel(Math.min(TOTAL_LEVELS, summary.value.level + 1)))

const unlockedWorldName = computed(() => {
  const w = summary.value.unlockedWorld
  if (!w) return ''
  return t(`worlds.${WORLDS[w as 1 | 2 | 3 | 4].theme}`)
})

// ─── Lifecycle wiring ───────────────────────────────────────────────────────

const gameplayLive = computed(() => isGameplayLive({
  phase: game.phase.value,
  showResult: showResult.value,
  anyModalOpen: isAnyModalOpen.value,
  adShowing: isAdShowing.value,
  visibilityHidden: isVisibilityHidden.value,
  platformPaused: isPlatformPaused.value,
  // Always false, and deliberately so. The portal bracket asks "is the player
  // playing?", and during a lesson they are: the overlay is
  // `pointer-events: none`, the clock runs and the bugs keep walking. Only the
  // lessons that land on a MODAL pause anything, and those are already covered
  // by `anyModalOpen`. Reporting a stop for each of thirteen lessons would flap
  // the bracket across a whole campaign for no player-visible reason.
  tutorialActive: false
}))

watch(gameplayLive, (live) => syncGameplayLifecycle(live))

// The music's tempo follows the chain — GDD §8.2, "the track speeds up as the
// multiplier rises". Watched rather than set per frame: it changes on a rung,
// which is a few times a level, not sixty times a second.
watch(game.chainMult, (m) => setMusicRate(comboMusicRate(m)))

watch(userHighVis, (v) => art.setHighVis(v))

watch([windowWidth, windowHeight], () => { void nextTick(resize) })
watch(isMobileLandscape, () => { void nextTick(resize) })

// A frame that runs while an ad is up is a frame the player did not see and the
// portal did not want. `isGamePaused` already halts the step; zeroing the clock
// stops the resume from fast-forwarding through what was missed.
watch(isGamePaused, (paused) => { if (paused) lastT = 0 })

// ─── Mount ──────────────────────────────────────────────────────────────────

onMounted(async () => {
  await preloadAssets()
  await nextTick()
  resize()
  warmAudio()
  startLevel(progress.currentLevel.value)
  raf = requestAnimationFrame(loop)

  window.addEventListener('resize', resize)
  window.addEventListener('orientationchange', resize)
  window.addEventListener('keydown', onKeyDown)

  // `play` is the recorder's own way in: `next`/`retry` are the player's two
  // buttons and both depend on a result screen having decided what they mean,
  // which a scenario that wants to open on level 23 does not have.
  if (import.meta.env.DEV) {
    installPreviewSeam({ next: onNext, retry: onRetry, play: startLevel })
  }
})

onUnmounted(() => {
  cancelAnimationFrame(raf)
  if (hintTimer) clearTimeout(hintTimer)
  if (bannerTimer) clearTimeout(bannerTimer)
  for (const id of hintTimers) clearTimeout(id)
  game.stopLevel()
  stopBattleMusic()
  syncGameplayLifecycle(false)
  window.removeEventListener('resize', resize)
  window.removeEventListener('orientationchange', resize)
  window.removeEventListener('keydown', onKeyDown)
})

// ─── Reduced motion ─────────────────────────────────────────────────────────

const calm = typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

const onFever = (): void => {
  if (game.tryFever()) haptic('reward')
}

const openLocker = (): void => {
  showLocker.value = true
  playSound('modal-open', 0.07)
}

const onStarLand = (): void => playFx('star')
</script>

<template lang="pug">
  div.scene
    canvas.scene__canvas(
      ref="canvasRef"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @contextmenu.prevent
    )

    //- ── HUD overlay ───────────────────────────────────────────────────────
    //- Non-interactive by default; individual controls opt back in.
    div.scene__hud
      div.scene__top(ref="topBarRef")
        SplatHud.scene__hud-main(
          :label="label"
          :score="game.score.value"
          :chain="game.chainCount.value"
          :mult="game.chainMult.value"
          :urgency="game.chainLeft.value"
          :time="game.timeLeft.value"
          :progress="railProgress"
          :squished="game.squished.value"
          :quota="spec.quota"
          :stars="progress.starsFor(level)"
        )
        //- The wallet column: what the player has, and the one thing on the
        //- HUD that pays them for coming back.
        div.scene__wallet
          CoinBadge(ref="coinBadgeRef")
          TreasureChest(
            v-if="!showResult && !showReveals"
            :target-el="coinBadgeEl"
            @claimed="onChestClaimed"
          )

      //- The boss bar, under the strip and clear of the chain badge.
      div.scene__boss(v-if="bossShown")
        BossBar(
          :show="bossShown"
          :hp="game.bossHp.value"
          :ticks="bossTicks"
          :name="spec.boss ?? ''"
          :tell="game.bossTell.value"
          :phase="game.bossPhaseIndex.value"
          :phases="3"
        )

      //- The middle band: the vial rail on the left, the board everywhere else.
      div.scene__mid
        div.scene__rail(ref="railRef")
          JuiceVial(
            :juice="game.juice.value"
            :fever-ms="game.feverMs.value"
            :fever-total="FEVER_MS"
            :calm="calm"
            @fever="onFever"
          )

      //- The control primer, centred above the bottom bar.
      div.scene__hint
        ControlHint(:hint="activeHint" :suppressed="hintSuppressed")

      //- ── Bottom bar ────────────────────────────────────────────────────
      div.scene__bottom(ref="bottomBarRef")
        div.scene__meta
          FMuteButton
          //- Gone entirely — not disabled — on a build with no board. A button
          //- that opens an empty list is worse than no button.
          FHudButton(
            v-if="leaderboardEnabled"
            tone="slate"
            icon="trophy"
            :aria-label="t('leaderboard.title')"
            @click="showLeaderboard = true"
          )
          FHudButton(
            tone="slate"
            icon="settings"
            :aria-label="t('options.title')"
            @click="showOptions = true"
          )
        div.scene__locker
          FHudButton(
            tone="green"
            icon="boot"
            art="locker"
            :attention="affordableShoes > 0"
            :aria-label="t('locker.title')"
            @click="openLocker"
          )
            template(#badge)
              FHudBadge(v-if="affordableShoes > 0" tone="red") {{ affordableShoes }}

      //- The level card. Inside the HUD layer, which is already
      //- `pointer-events: none`, so the level under it is already playable.
      LevelBanner(
        :show="showBanner"
        :label="label"
        :theme="theme"
        :objectives="spec.objectives"
        :tally="game.tally.value"
        :quota="spec.quota"
        :met="met"
        :boss="spec.boss"
      )

      //- The wordless lesson. Inside the HUD layer for the same reason the rest
      //- of it is — the gesture it teaches must reach the canvas underneath —
      //- but `position: fixed` and above every panel, because two of the
      //- lessons are about the shop and the shop is a modal.
      TutorialOverlay(
        :lesson="lessonShown ? lessonSpecOf : null"
        :progress="lessonProgress"
        :x="lessonAt.x"
        :y="lessonAt.y"
        :to-x="lessonTo.x"
        :to-y="lessonTo.y"
      )

    //- ── Result screen ─────────────────────────────────────────────────────
    FReward(v-model="showResult" :show-continue="false" :reveal="summary.stars >= 3")
      template(#ribbon)
        span {{ summary.cleared ? t('result.cleared') : t('result.timeUp') }}

      div.result
        StarRow.result__stars(
          :stars="summary.stars"
          :previous="summary.previousStars"
          :calm="calm"
          @land="onStarLand"
        )

        div.result__headline
          //- ON A WIN THIS LOOKS FORWARD, and on a loss it looks back. A screen
          //- that headlines the level just finished either way is a summary —
          //- the shape of an ending — and the level they cleared is already
          //- named on the ribbon above.
          span.result__level(v-if="summary.cleared && summary.level < TOTAL_LEVELS")
            | {{ t('result.upNext', { n: nextLabel }) }}
          span.result__level(v-else-if="summary.cleared") {{ t('result.campaignDone') }}
          span.result__level(v-else) {{ t('result.retryLevel') }}
          span.result__record(v-if="summary.isRecord") {{ t('result.newRecord') }}

        //- What was and was not earned, so a replay has a reason.
        ObjectiveList.result__objectives(
          :objectives="summarySpec.objectives"
          :tally="summary.tally"
          :quota="summarySpec.quota"
          :met="summary.met"
          compact
        )

        //- Three chips on ONE line: the score, the squishes, and where that
        //- score stands against everybody else's. Glyphs rather than captions,
        //- because a caption's width swings 2-3x across the 21 locales this game
        //- ships to and the row would have to be laid out for the worst of them.
        div.result__chips
          div.result__chip
            GameIcon.result__chip-icon(name="star")
            span.sr-only {{ t('hud.score') }}
            span.result__chip-value {{ summary.tally.score }}
          div.result__chip
            GameIcon.result__chip-icon(name="bug")
            span.sr-only {{ t('result.squishes') }}
            span.result__chip-value {{ summary.tally.squishes }}
          div.result__chip.is-rank(v-if="resultRank")
            GameIcon.result__chip-icon(name="trophy")
            span.sr-only {{ t('leaderboard.title') }}
            span.result__chip-value {{ resultRank }}
            span.result__chip-of(v-if="playerTotal > 0") {{ t('result.rankOf', { n: fmt(playerTotal) }) }}

        div.result__unlock(v-if="summary.unlockedWorld")
          GameIcon.result__unlock-icon(name="unlock")
          span {{ t('result.worldUnlocked', { n: unlockedWorldName }) }}

        div.result__coins
          IconCoin(class="result__coin-icon")
          span.result__coin-value +{{ summary.coins }}

        //- Two glyphs where two captions used to be. Both actions are
        //- conventional, both sit in a cluster, and a wrong tap costs one tap to
        //- undo — which is the whole test for whether a caption may become a
        //- glyph. The forward action is LAST and 25 % larger, because once the
        //- captions are gone the row is uniform and the one button that ends the
        //- screen needs another way to be found.
        div.result__actions
          FButton(
            icon-only
            icon="boot"
            art="locker"
            :size="resultCompact ? 'sm' : 'md'"
            type="secondary"
            :aria-label="t('locker.title')"
            @click="openLocker"
          )
          FButton(
            icon-only
            :icon="summary.cleared ? 'skip-forward' : 'replay'"
            :size="resultCompact ? 'sm' : 'md'"
            type="success"
            :emphasis="1.25"
            :aria-label="summary.cleared ? t('result.nextLevel') : t('result.tryAgain')"
            @click="summary.cleared ? onNext() : onRetry()"
          )

    //- Before FReward in the tree, because it plays before it on screen.
    RewardRevealModal(
      v-model="showReveals"
      :reward="pendingReveals"
      @done="onRevealsDone"
    )

    LockerModal(v-model="showLocker")
    OptionsModal(:is-open="showOptions" @close="showOptions = false")
    LeaderboardModal(v-if="leaderboardEnabled" v-model="showLeaderboard")
</template>

<style scoped lang="sass">
.scene
  position: relative
  width: 100vw
  height: 100vh
  height: 100dvh
  overflow: hidden
  background-color: #120c1e

.scene__canvas
  position: absolute
  inset: 0
  display: block
  // The canvas owns every gesture; the browser must not steal them for
  // scrolling, pull-to-refresh or double-tap zoom.
  touch-action: none

.scene__hud
  position: absolute
  inset: 0
  pointer-events: none
  display: flex
  flex-direction: column

// ─── Top bar ────────────────────────────────────────────────────────────────

// ─── The HUD's own column ───────────────────────────────────────────────────
//
// Both bars are capped at `--hud-max` and centred. On a phone the cap is wider
// than the screen and changes nothing; on a 1440px desktop it stops the score
// strip from stretching into a 1400px-wide progress rail with a coin badge
// marooned in the far corner — the HUD keeps the shape it was designed in and
// the play area reads as a board rather than as a browser window.
.scene
  --hud-max: 46rem

.scene__top
  display: flex
  align-items: flex-start
  gap: clamp(0.3rem, 2vw, 0.75rem)
  width: 100%
  max-width: var(--hud-max)
  margin-inline: auto
  padding: calc(clamp(0.3rem, 1.6vw, 0.6rem) + env(safe-area-inset-top, 0px)) calc(clamp(0.35rem, 2vw, 0.7rem) + env(safe-area-inset-right, 0px)) 0 calc(clamp(0.35rem, 2vw, 0.7rem) + env(safe-area-inset-left, 0px))

.scene__hud-main
  flex: 1 1 auto
  min-width: 0

.scene__wallet
  flex: 0 0 auto
  display: flex
  flex-direction: column
  align-items: center
  gap: clamp(0.2rem, 1.4vmin, 0.5rem)
  pointer-events: auto

.scene__boss
  display: flex
  justify-content: center
  // Clear of the chain badge, which hangs off the strip's own bottom edge.
  margin-top: clamp(1.7rem, 8vmin, 2.8rem)
  padding-inline: clamp(0.5rem, 3vw, 1rem)

// ─── The middle band ────────────────────────────────────────────────────────
//
// Takes the free height between the bars. The vial rail is pinned to the left
// and vertically centred; nothing else lives here, because everything else in
// the middle of the screen is the game.

.scene__mid
  flex: 1 1 auto
  min-height: 0
  display: flex
  align-items: center
  width: 100%
  max-width: var(--hud-max)
  margin-inline: auto
  padding-left: calc(clamp(0.25rem, 1.4vw, 0.55rem) + env(safe-area-inset-left, 0px))

.scene__rail
  display: flex
  align-items: center
  pointer-events: auto

.scene__hint
  display: flex
  justify-content: center
  padding-inline: 0.5rem
  padding-bottom: clamp(0.25rem, 1.6vw, 0.6rem)

// ─── Bottom bar ─────────────────────────────────────────────────────────────

.scene__bottom
  display: flex
  align-items: flex-end
  justify-content: space-between
  gap: clamp(0.3rem, 2vw, 0.7rem)
  width: 100%
  max-width: var(--hud-max)
  margin-inline: auto
  padding: 0 calc(clamp(0.35rem, 2vw, 0.7rem) + env(safe-area-inset-right, 0px)) calc(clamp(0.4rem, 2.4vw, 0.8rem) + env(safe-area-inset-bottom, 0px)) calc(clamp(0.35rem, 2vw, 0.7rem) + env(safe-area-inset-left, 0px))

.scene__meta
  display: flex
  align-items: flex-end
  gap: clamp(0.2rem, 1.2vw, 0.4rem)
  pointer-events: auto

.scene__locker
  position: relative
  display: flex
  align-items: center
  pointer-events: auto

// ─── Result screen ──────────────────────────────────────────────────────────

.result
  display: flex
  flex-direction: column
  align-items: center
  gap: clamp(0.28rem, 1.6vmin, 0.7rem)
  width: 100%

.result__stars
  margin-block: clamp(0.2rem, 1.4vmin, 0.6rem)

.result__headline
  display: flex
  flex-direction: column
  align-items: center
  gap: 0.15rem

.result__level
  color: #fff
  font-weight: 900
  text-transform: uppercase
  text-align: center
  line-height: 1.1
  font-size: clamp(0.85rem, 4.6vmin, 1.6rem)
  text-shadow: 3px 3px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000

.result__record
  color: #ffd93c
  font-weight: 900
  text-transform: uppercase
  letter-spacing: 0.08em
  font-size: clamp(0.6rem, 3vmin, 0.9rem)
  text-shadow: 2px 2px 0 #000

.result__objectives
  margin-block: clamp(0.1rem, 0.8vmin, 0.3rem)

.result__chips
  display: flex
  align-items: center
  justify-content: center
  flex-wrap: wrap
  gap: clamp(0.25rem, 1.6vmin, 0.6rem)

.result__chip
  display: inline-flex
  align-items: center
  gap: 0.3em
  padding: clamp(0.15rem, 1vmin, 0.32rem) clamp(0.45rem, 2.4vmin, 0.8rem)
  border: 2px solid rgba(255, 255, 255, 0.2)
  border-radius: 999px
  background-color: rgba(8, 14, 28, 0.6)
  color: #fff
  font-weight: 900
  line-height: 1
  font-size: clamp(0.66rem, 3vmin, 1rem)
  text-shadow: 2px 2px 0 rgba(0, 0, 0, 0.85)

.result__chip-icon
  width: 1.1em
  height: 1.1em
  flex: 0 0 auto
  color: #9fb0cc

.is-rank
  border-color: rgba(255, 217, 60, 0.65)

  .result__chip-icon
    color: #ffd93c

.result__chip-of
  opacity: 0.7
  font-size: 0.8em

.result__unlock
  display: inline-flex
  align-items: center
  gap: 0.4em
  padding: clamp(0.18rem, 1.1vmin, 0.36rem) clamp(0.5rem, 2.6vmin, 0.9rem)
  border: 2px solid rgba(103, 224, 138, 0.7)
  border-radius: 999px
  background-color: rgba(10, 58, 30, 0.7)
  color: #d7ffe6
  font-weight: 900
  text-align: center
  line-height: 1.15
  font-size: clamp(0.6rem, 2.8vmin, 0.9rem)
  text-shadow: 2px 2px 0 rgba(0, 0, 0, 0.85)

.result__unlock-icon
  width: 1.2em
  height: 1.2em
  flex: 0 0 auto
  color: #67e08a

.result__coins
  display: inline-flex
  align-items: center
  gap: 0.35em

.result__coin-icon
  width: clamp(1.1rem, 5vmin, 1.8rem)
  height: clamp(1.1rem, 5vmin, 1.8rem)
  color: #ffd93c

.result__coin-value
  color: #ffd93c
  font-weight: 900
  line-height: 1
  font-size: clamp(1rem, 5.4vmin, 1.9rem)
  text-shadow: 3px 3px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000

.result__actions
  display: flex
  align-items: center
  justify-content: center
  gap: clamp(0.5rem, 3vmin, 1.2rem)
  margin-top: clamp(0.2rem, 1.4vmin, 0.6rem)

.sr-only
  position: absolute
  width: 1px
  height: 1px
  padding: 0
  margin: -1px
  overflow: hidden
  clip: rect(0, 0, 0, 0)
  white-space: nowrap
  border: 0
</style>
