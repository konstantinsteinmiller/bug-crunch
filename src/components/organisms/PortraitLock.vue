<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { windowHeight, windowWidth } from '@/use/useUser'
import { acquireModalOpen } from '@/use/useModalState'
import { shouldLockPortrait } from '@/components/organisms/portraitLock'

/**
 * ─── Portrait only, on phones ───────────────────────────────────────────────
 *
 * Turned sideways, this game does not work. The road is a fixed number of world
 * units wide and the camera keys its scale to the SHORT axis, so a landscape
 * phone gets a narrow ribbon of lane down the middle of a wide frame with two
 * empty margins either side — and the crowd, whose screen position is a share of
 * the viewport HEIGHT, ends up parked near the bottom edge with almost no road
 * visible ahead of it. Every playtester who rotated reported the same thing, and
 * one of them played a whole stage that way before mentioning it.
 *
 * The owner's call was the simple one: don't allow landscape at all. So this is a
 * hard block rather than a responsive layout — a full-screen cover, an animated
 * phone rotating itself back to portrait, and the game paused behind it.
 *
 * ─── The rule, and why it is this rule ──────────────────────────────────────
 *
 * Two conditions, and both have to be honest or this locks out people whose
 * devices are fine:
 *
 *   • A COARSE PRIMARY POINTER. `(pointer: coarse)` describes the input the
 *     player is actually using, which is the only thing that separates a phone
 *     from a laptop that happens to be short. Deliberately NOT `any-pointer:
 *     coarse` — a touchscreen laptop answers yes to that while its primary
 *     pointer is a trackpad, and a 1366×768 laptop must keep working. Also not
 *     the UA sniff (`mobileCheck`): it is the thing that is wrong about iPads,
 *     desktop-mode requests and every browser that decides to lie this year.
 *   • A SHORT EDGE OF 500 px OR LESS. The playtest's own two devices are the
 *     spec: the phone was 844×390 (short edge 390 → locked) and the tablet was
 *     1180×820 (short edge 820 → untouched). 500 is not a new number either —
 *     it is `isShortViewport`'s threshold, the line the result screen already
 *     uses to decide a viewport is too short for its ornament.
 *
 * Plus the obvious third: the viewport is actually wider than it is tall. Read
 * from `windowWidth`/`windowHeight`, which `App.vue` already keeps current on
 * resize, on `orientationchange` and on a 400 ms poll — the poll is why this
 * cannot be missed by a browser that reports a rotation late, which several do.
 *
 * A short edge measured in CSS pixels also means a phone with a keyboard open,
 * or a tiny portal iframe, is judged on what it actually has rather than on what
 * kind of device it claims to be.
 *
 * The rule itself lives in `portraitLock.ts` beside this file — pure, and specced
 * against the playtest's own two devices. A rule that decides whether somebody
 * can play the game at all does not belong inside a `<script setup>` where the
 * only way to assert it is to mount a browser.
 */

const { t } = useI18n()

const isCoarsePointer = ref(false)
let coarseQuery: MediaQueryList | null = null
const onCoarseChange = (e: MediaQueryListEvent): void => { isCoarsePointer.value = e.matches }

const locked = computed(() => shouldLockPortrait({
  coarsePointer: isCoarsePointer.value,
  width: windowWidth.value,
  height: windowHeight.value
}))

/**
 * ─── The game is PAUSED behind this, and is not being played ────────────────
 *
 * Through `acquireModalOpen`, which is the same hook every other blocking
 * overlay in the game uses, and it does two separate things that both matter
 * here:
 *
 *   • it takes an app pause (`useGamePause`), which stops the simulation and
 *     mutes the audio — the scene's RAF loop reads `isGamePaused` and does not
 *     call `step`, so nothing chews the squad while the player is rotating;
 *   • it raises `isAnyModalOpen`, which is one of `isGameplayLive`'s inputs — so
 *     `syncGameplayLifecycle` sends `gameplayStop` to every portal listening.
 *     That is the half a hand-rolled overlay would have missed: a portal must
 *     never be told the player is playing while they are staring at a rotate
 *     prompt, and Poki grades its funnel on exactly that bracket.
 *
 * Refcounted, so it composes with a shop or an ad that was already open when the
 * phone turned — and released on unmount, because a pause that outlives its
 * overlay is a game that never comes back.
 */
let release: (() => void) | null = null

const hold = (on: boolean): void => {
  if (on && !release) release = acquireModalOpen()
  else if (!on && release) { release(); release = null }
}

watch(locked, hold)

/**
 * Ask the platform to keep us in portrait, and never rely on it.
 *
 * `screen.orientation.lock` is the right thing to try — a device that honours it
 * never shows this overlay at all — but it is unavailable or refused nearly
 * everywhere that matters: it needs fullscreen on Chrome/Android, iOS Safari has
 * no implementation, desktop Safari throws synchronously, and a portal iframe
 * without `allow="fullscreen"` cannot get there either. So every route out of it
 * is swallowed: the property may not exist, the call may throw, and the promise
 * it returns may reject. THE OVERLAY IS THE MECHANISM; this is an optimisation.
 */
// `lock` is NOT in this project's TS DOM lib — the Screen Orientation API's
// locking half is still flagged as such, which is itself the warning this
// function is built around. Declared structurally here rather than widened with
// `any`, so the argument and the return stay checked at the call site.
type LockableOrientation = { lock?: (o: 'portrait') => unknown }

const tryOrientationLock = (): void => {
  try {
    const o = (screen as Screen & { orientation?: LockableOrientation }).orientation
    if (!o || typeof o.lock !== 'function') return
    const p = o.lock('portrait')
    if (p instanceof Promise) p.catch(() => { /* refused — the overlay handles it */ })
  } catch { /* no implementation, or not in fullscreen. Expected. */ }
}

watch(locked, (on) => { if (on) tryOrientationLock() })

onMounted(() => {
  if (typeof window.matchMedia === 'function') {
    coarseQuery = window.matchMedia('(pointer: coarse)')
    isCoarsePointer.value = coarseQuery.matches
    coarseQuery.addEventListener('change', onCoarseChange)
  }
  // Once at boot as well as on every lock: a player who opens the game already
  // sideways is the common case, and the request is free when it fails.
  tryOrientationLock()
})

onUnmounted(() => {
  coarseQuery?.removeEventListener('change', onCoarseChange)
  hold(false)
})
</script>

<template lang="pug">
  Transition(name="portrait-lock")
    div.portrait-lock(
      v-if="locked"
      role="dialog"
      aria-modal="true"
      aria-labelledby="portrait-lock-title"
    )
      //- ── The phone, rotating itself ────────────────────────────────────────
      //-
      //- Drawn rather than borrowed: an emoji is whatever the platform font
      //- feels like that day, and none of them can show the one thing this has
      //- to show, which is the MOVEMENT from one orientation to the other.
      //-
      //- The device is authored in its PORTRAIT pose — the pose the player is
      //- being asked for — and the animation starts it at -90° and turns it
      //- upright. That way the end state is the artwork's own geometry, which is
      //- what `prefers-reduced-motion` can simply show as a still.
      svg.portrait-lock__art(viewBox="0 0 120 120" aria-hidden="true")
        defs
          //- The screen's own light. A hint of the road's green, so the little
          //- phone is recognisably showing THIS game.
          linearGradient(id="pl-screen" x1="0" y1="0" x2="0" y2="1")
            stop(offset="0" stop-color="#16263f")
            stop(offset="0.55" stop-color="#0d1728")
            stop(offset="1" stop-color="#1d3320")
          radialGradient(id="pl-halo" cx="0.5" cy="0.5" r="0.5")
            stop(offset="0" stop-color="#ffd93c" stop-opacity="0.34")
            stop(offset="0.62" stop-color="#ffd93c" stop-opacity="0.12")
            stop(offset="1" stop-color="#ffd93c" stop-opacity="0")

        circle.portrait-lock__halo(cx="60" cy="60" r="54" fill="url(#pl-halo)")

        //- Everything that rotates, and nothing that does not.
        g.portrait-lock__phone
          //- Body. Two rects rather than one with a thick stroke: the bezel is a
          //- different colour from the shell, and a stroke cannot be.
          //- Sized to very nearly fill the box on its long axis (98 of 120), so
          //- the drawing is the picture rather than an icon floating in padding.
          //- 98 is the ceiling: rotated a quarter turn it becomes the WIDTH, and
          //- anything longer would clip against the viewBox mid-turn.
          rect(x="39" y="11" width="42" height="98" rx="8" fill="#1b2740" stroke="#0a1020" stroke-width="2.8")
          rect(x="44" y="20" width="32" height="80" rx="3.5" fill="url(#pl-screen)" stroke="#070d18" stroke-width="1.3")
          //- Earpiece and home bar — the two marks that make a rounded rectangle
          //- read as a phone at a glance, and the two that make its orientation
          //- unambiguous while it turns.
          rect(x="54" y="14.8" width="12" height="2" rx="1" fill="#0a1020")
          rect(x="53" y="103" width="14" height="2.2" rx="1.1" fill="#0a1020")
          //- A sliver of the game inside the screen: the lane, and the crowd on
          //- it. Two shapes, because the joke only works if it is legible.
          rect(x="52" y="20" width="16" height="80" fill="#20301c" opacity="0.85")
          circle(cx="60" cy="86" r="3.6" fill="#7ad14f")
          circle(cx="54.8" cy="91" r="2.7" fill="#5fae3d")
          circle(cx="65.2" cy="91" r="2.7" fill="#5fae3d")

        //- The rotation hint: an arc sweeping anticlockwise around the device's
        //- upper-left with a head on the end of it, alive only while the device
        //- is actually turning.
        //-
        //- LAST in the drawing, so it paints over the phone. The device's own
        //- half-diagonal is 53 units, so any arc small enough to stay inside this
        //- viewBox is also inside the circle the device sweeps as it turns —
        //- drawn underneath, the arc spent most of the rotation hidden behind the
        //- thing it was pointing at, which is exactly when it is needed. On top it
        //- wraps the corner, which is the motif anyway.
        //-
        //- Big, too: the first pass used a 34-unit arc and read as a stray tick
        //- rather than as "this whole object turns".
        g.portrait-lock__turn(fill="none" stroke="#ffd93c" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round")
          path(d="M14 66A52 52 0 0 1 58 8")
          path(d="M48.5 5.5 59.5 8.5 56 19")

      div.portrait-lock__copy
        h2#portrait-lock-title.portrait-lock__title {{ t('portrait.title') }}
        p.portrait-lock__body {{ t('portrait.body') }}
</template>

<style scoped lang="sass">
// Above everything. The game's own overlays are inside the scene's stacking
// context; this one is a statement about the whole viewport, so it is `fixed` and
// it is the last thing in the app.
// Laid out as a ROW, which is the only shape this is ever seen in: the overlay
// exists exclusively on a landscape phone, and stacked vertically the phone
// drawing and the copy cannot both fit between a 390 px top and bottom edge.
.portrait-lock
  position: fixed
  inset: 0
  z-index: 9000
  display: flex
  flex-direction: row
  align-items: center
  justify-content: center
  gap: clamp(1rem, 6vw, 3rem)
  padding: calc(env(safe-area-inset-top, 0px) + 1rem) calc(env(safe-area-inset-right, 0px) + 1rem) calc(env(safe-area-inset-bottom, 0px) + 1rem) calc(env(safe-area-inset-left, 0px) + 1rem)
  // Opaque, not a scrim. Half-covering a game that is unplayable in this
  // orientation just shows the player the broken frame behind the apology.
  background-image: radial-gradient(circle at 50% 42%, #16233c 0%, #0a1020 62%, #05080f 100%)
  // It swallows every gesture: the canvas underneath is still mounted, and a
  // stray drag through this would steer a squad nobody can see.
  pointer-events: auto
  touch-action: none

// Sized off the SHORT axis (`vh` here, since the overlay only exists in
// landscape), because the thing that decides how big this can be is the height
// between the two edges — and because a `vw` term on an 844 px-wide phone picks
// its maximum on the axis with room to spare and spills off the one that does
// not. The same argument the result screen makes for `vmin`.
//
// Deliberately LARGE. The first pass sized the drawing at 26vh and it read as an
// icon sitting next to a sentence, with two thirds of the screen empty around it;
// this is a full-screen block on a device somebody is holding wrong, and the
// picture is the part that does the explaining in every language.
.portrait-lock__art
  flex: 0 0 auto
  width: clamp(7rem, 56vh, 17rem)
  height: clamp(7rem, 56vh, 17rem)
  // The halo and the rotating device both reach outside the viewBox's nominal
  // bounds at the extremes of the turn.
  overflow: visible

.portrait-lock__copy
  display: flex
  flex-direction: column
  align-items: flex-start
  gap: 0.45em
  max-width: 24rem

.portrait-lock__title
  margin: 0
  color: #fff
  font-weight: 900
  text-transform: uppercase
  line-height: 1.05
  font-size: clamp(1.3rem, 9vh, 2.75rem)
  text-shadow: 4px 4px 0 #000

.portrait-lock__body
  margin: 0
  color: #b9cbe8
  font-weight: 700
  line-height: 1.3
  font-size: clamp(0.8rem, 4.4vh, 1.25rem)
  text-shadow: 2px 2px 0 rgba(0, 0, 0, 0.85)

// ─── The turn ───────────────────────────────────────────────────────────────
//
// One cycle: the phone appears lying down, waits long enough to be READ as lying
// down, turns upright, sits there long enough to be read as upright, and fades.
// The two pauses are the whole design — a phone that rotates continuously never
// shows the player either state clearly, and what it communicates is "something
// is spinning" rather than "this way up".
//
// `rotate`, not `transform`, so it composes with anything the artwork or a future
// hover state puts in `transform`. `transform-origin` is in user units and SVG
// children resolve it against the viewBox by default, so 60 60 is the middle of
// the drawing — the device's own centre.
.portrait-lock__phone
  transform-origin: 60px 60px
  animation: pl-turn 3400ms ease-in-out infinite

@keyframes pl-turn
  0%
    opacity: 0
    rotate: -90deg
  8%
    opacity: 1
    rotate: -90deg
  32%
    rotate: -90deg
  58%
    rotate: 0deg
  88%
    opacity: 1
    rotate: 0deg
  100%
    opacity: 0
    rotate: 0deg

// The arrow is only true while the turn is happening, so it exists only then.
// Left on screen next to a settled phone it would be an instruction to rotate
// something that is already the right way up.
.portrait-lock__turn
  opacity: 0
  animation: pl-arrow 3400ms ease-in-out infinite

@keyframes pl-arrow
  0%, 14%
    opacity: 0
  26%
    opacity: 1
  56%
    opacity: 0.85
  64%, 100%
    opacity: 0

.portrait-lock__halo
  animation: pl-halo 3400ms ease-in-out infinite

@keyframes pl-halo
  0%, 100%
    opacity: 0.35
  58%
    opacity: 1

// ─── No motion ──────────────────────────────────────────────────────────────
//
// The phone in its portrait end state, held still. Nothing loops, nothing
// fades in and out, and the arrow goes — an arrow with no movement behind it is
// an instruction to turn a phone that is already upright.
//
// The words carry it instead, which is why they are a real sentence rather than
// a caption under a picture.
@media (prefers-reduced-motion: reduce)
  .portrait-lock__phone
    animation: none
    opacity: 1
    rotate: 0deg

  .portrait-lock__turn
    display: none

  .portrait-lock__halo
    animation: none
    opacity: 0.6

.portrait-lock-enter-active, .portrait-lock-leave-active
  transition: opacity 180ms ease

.portrait-lock-enter-from, .portrait-lock-leave-to
  opacity: 0
</style>
