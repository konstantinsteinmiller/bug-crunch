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
import OptionsModal from '@/components/organisms/OptionsModal.vue'
import LeaderboardModal from '@/components/organisms/LeaderboardModal.vue'
import FReward from '@/components/atoms/FReward.vue'
import FButton from '@/components/atoms/FButton.vue'
import FHudButton from '@/components/atoms/FHudButton.vue'
import FHudBadge from '@/components/atoms/FHudBadge.vue'
import FMuteButton from '@/components/atoms/FMuteButton.vue'
import GameIcon from '@/components/icons/GameIcon.vue'
import IconCoin from '@/components/icons/IconCoin.vue'

import * as game from '@/use/useSplatixGame'
import * as art from '@/use/useSplatixArt'
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
import useSplatProgress from '@/use/useSplatProgress'
import useLocker from '@/use/useLocker'
import { getState, setState } from '@/use/useSplatixState'
import { HINTS_SEEN_KEY, ONBOARDED_KEY, TUTORIAL_KEY } from '@/keys'
import { levelLabel, levelSpec, worldOf, WORLDS, TOTAL_LEVELS } from '@/game/stages'
import { bossPhaseTicks, bossSpec } from '@/game/bosses'
import { starsEarned, evaluate, emptyTally, type RunTally } from '@/game/stars'
import { FEVER_MS, comboMusicRate } from '@/game/combo'
import { bugSpec } from '@/game/bugs'
import { warmNextLevelArt } from '@/game/artPreload'
import { installPreviewSeam } from '@/game/previewFeed'
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

const { t } = useI18n()
const { playSound } = useSounds()
const { startBattleMusic, stopBattleMusic } = useMusic()
const { preloadAssets } = useAssets()
const { userJuiceStyle, userHighVis, userSingleTap } = useUser()
const progress = useSplatProgress()
const { equippedShoe, affordableShoes } = useLocker()

// ─── Refs ───────────────────────────────────────────────────────────────────

const canvasRef = ref<HTMLCanvasElement | null>(null)
const topBarRef = ref<HTMLElement | null>(null)
const bottomBarRef = ref<HTMLElement | null>(null)
const railRef = ref<HTMLElement | null>(null)

const showResult = ref(false)
const showLocker = ref(false)
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

// ─── The onboarding lesson ──────────────────────────────────────────────────
//
// Three beats, and the player leaves each one by DOING it. See
// `TutorialOverlay.vue` for why there is nothing to dismiss.

const tutorialSeen = ref(getState<boolean>(TUTORIAL_KEY, false) === true)
const tutorialBeat = ref<0 | 1 | 2>(0)
const tutorialProgress = ref(0)
/** ms of qualifying action done in the current beat. */
let beatMs = 0
/**
 * How long the player has actually been PRESENT, so a beat cannot time out
 * before they have been asked.
 *
 * Counted from the first input, never from the wall clock. An interstitial, a
 * consent dialog or a tab opened in the background all leave the game running
 * with nobody looking at it, and a bail-out on wall time would dismiss the whole
 * lesson before the player ever reached the game.
 */
let presentMs = 0
let sawInput = false

const BEAT_MOVE_MS = 900
const BEAT_BAILOUT_MS = 14_000

const tutorialActive = computed(() =>
  !tutorialSeen.value && level.value === 1 && game.phase.value === 'play' && !showResult.value)

/** Where the lesson's hand is drawn, in CSS px. */
const tutorialAt = ref({ x: 0, y: 0 })

const finishTutorial = (): void => {
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
    if (tutorialActive.value) stepTutorial(dt)
  }

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

const stepTutorial = (dt: number): void => {
  const foot = game.getFoot()
  if (sawInput) presentMs += dt

  if (tutorialBeat.value === 0) {
    tutorialAt.value = { x: art.toX(foot.x), y: art.toY(foot.y) }
    if (foot.speed > 4) beatMs += dt
    tutorialProgress.value = Math.min(1, beatMs / BEAT_MOVE_MS)
    if (beatMs >= BEAT_MOVE_MS || presentMs > BEAT_BAILOUT_MS) nextBeat()
    return
  }

  // Beats 1 and 2 point at a live body when there is one, so the lesson is
  // always over something the player can actually hit.
  const bugs = game.getBugs()
  const n = game.getBugCount()
  const target = n > 0 ? bugs[0]! : null
  tutorialAt.value = target
    ? { x: art.toX(target.x), y: art.toY(target.y) }
    : { x: art.toX(foot.x), y: art.toY(foot.y) }
  tutorialProgress.value = 0
  if (presentMs > BEAT_BAILOUT_MS * (tutorialBeat.value + 1)) nextBeat()
}

const nextBeat = (): void => {
  beatMs = 0
  if (tutorialBeat.value >= 2) { finishTutorial(); return }
  tutorialBeat.value = (tutorialBeat.value + 1) as 0 | 1 | 2
  tutorialProgress.value = 0
}

/** Beat 1 is over the moment a bug is squished. */
watch(game.squished, (n, prev) => {
  if (tutorialActive.value && tutorialBeat.value === 1 && n > prev) nextBeat()
})

/** Beat 2 is over the moment a charged slam lands. */
watch(game.slams, (n, prev) => {
  if (tutorialActive.value && tutorialBeat.value === 2 && n > prev) finishTutorial()
})

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

/** The one-shot lessons this level introduces. */
const teachLevelHints = (): void => {
  for (const id of hintTimers) clearTimeout(id)
  hintTimers.length = 0
  const s = spec.value
  if (!onboarded.value) teach('move', 5200)
  const ids = new Set(s.roster.map((r) => r.id))
  hintTimers.push(setTimeout(() => {
    if (s.boss) { teach('boss', 5000); return }
    if (ids.has('caterpillar')) teach('spike')
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

const teachForBoss = (): void => {
  const s = spec.value
  if (!s.boss) return
  const p = bossSpec(s.boss).phases[game.bossPhaseIndex.value]
  if (p?.script === 'pods') teach('pods', 4200)
  else if (p?.script === 'charge') teach('boss', 4200)
}

/** The vial filling for the first time is worth saying once. */
watch(game.feverCharged, (ready) => {
  if (ready) teach('fever', 4200)
})

const onLevelEnd = async (won: boolean): Promise<void> => {
  const tally = game.tally.value
  const stars = starsEarned(spec.value.objectives, tally)
  const previousStars = progress.starsFor(level.value)
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

  showResult.value = true
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
  return rank > 0 ? `#${rank.toLocaleString()}` : null
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
        CoinBadge.scene__wallet

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

      //- The wordless lesson. Also inside the HUD layer, for the same reason:
      //- the gesture it is teaching must reach the canvas underneath it.
      TutorialOverlay(
        v-if="tutorialActive"
        :beat="tutorialBeat"
        :progress="tutorialProgress"
        :x="tutorialAt.x"
        :y="tutorialAt.y"
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
            span.result__chip-of(v-if="playerTotal > 0") {{ t('result.rankOf', { n: playerTotal }) }}

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
