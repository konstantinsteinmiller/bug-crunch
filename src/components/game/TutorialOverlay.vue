<script setup lang="ts">
import { computed } from 'vue'
import { isMobilePortrait } from '@/use/useUser'
import { mobileCheck } from '@/utils/function'
import type { Lesson } from '@/game/tutorial'

/**
 * ─── How this game says anything ────────────────────────────────────────────
 *
 * One overlay, seven animations, and not a single word in any of them.
 *
 * ── Why wordless ──
 *
 * The audience starts at six. A six-year-old on a phone in a language they are
 * still learning to read will not read an instruction, and a ten-year-old will
 * not either — they will tap past it and then be confused, which is worse than
 * never having shown it. Every locale this game ships to gets the same overlay,
 * and it is correct in all of them because there is nothing in it to translate.
 *
 * ── The seven things it can say ──
 *
 *   drag   a hand slides along a dotted track, a ghost shoe one beat behind it
 *   tap    a hand drops onto a point and a burst pops
 *   hold   a hand presses and STAYS down, a ring fills, a big wave goes out
 *   avoid  a hand reaches for a point and recoils — the only lesson in the game
 *          whose answer is "do not", so it is the only one drawn in red
 *   point  a hand pulses at a control, with a ring drawn round it
 *   flow   an arrow travels from one point to another: THIS causes THAT. It is
 *          how the game explains its own goal without saying it
 *   watch  no hand at all — a ring breathing around something to look at
 *
 * ── Three rules it is built to ──
 *
 *   1. IT IS NOT A PAGE. There is no OK button and nothing to dismiss. The
 *      player leaves each lesson by DOING it. A tutorial you can click past is
 *      a tutorial that teaches clicking past tutorials.
 *   2. IT NEVER EATS THE GESTURE. `pointer-events: none` all the way down, so
 *      the finger that is learning is playing, not being intercepted by the
 *      thing explaining.
 *   3. IT SHOWS THE PLAYER'S OWN DEVICE. A finger on touch, a cursor on
 *      desktop. The wrong glyph reads as a game built for somebody else.
 *
 * ── Why it is `fixed` and above the modals ──
 *
 * Two of the lessons are about the SHOP, and the shop is an `FModal` at
 * z-index 110. A lesson that pointed at the buy button from underneath it would
 * be pointing at nothing. So the overlay is fixed to the viewport and sits above
 * every panel — and those lessons carry `scrim: 'none'`, because the modal is
 * already its own scrim and dimming it twice makes the thing being pointed at
 * darker than the board behind it.
 */

interface Props {
  /** The lesson to draw, or null for nothing. */
  lesson: Lesson | null
  /** Where it points, in CSS px from the top-left of the viewport. The scene
   *  resolves this: the foot, a live bug, or a HUD element's own rect. */
  x: number
  y: number
  /** The far end of a `flow` arrow. Ignored by every other gesture. */
  toX?: number
  toY?: number
  /** 0..1 — how much of the requirement has been done. Drives the ring, which
   *  is the only feedback that the gesture is working. */
  progress: number
}

const props = withDefaults(defineProps<Props>(), { toX: 0, toY: 0 })

const isTouch = computed(() => mobileCheck() || isMobilePortrait.value
  || (typeof window !== 'undefined' && navigator.maxTouchPoints > 0))

const gesture = computed(() => props.lesson?.gesture ?? 'watch')
const scrim = computed(() => props.lesson?.scrim ?? 'soft')

/** Ring geometry, as stroke-dashoffset over a 100-unit circumference. */
const dash = computed(() => `${Math.max(0, Math.min(1, props.progress)) * 100} 100`)

/**
 * Is there anything for the progress ring to say?
 *
 * It used to be drawn under EVERY lesson, and for the slam that made two meters
 * on screen at once — a charge ring that fills and, an inch below it, a second
 * ring that never moves, because a `hold` lesson has neither a `holdMs` nor a
 * `doing` signal and its `progress` is pinned at zero for its whole life. A
 * dead meter beside a live one is not neutral: it reads as the live one being
 * broken. So it appears only when it is about to mean something — a lesson with
 * a `holdMs` counts itself down, and `move` fills it the moment the foot
 * actually starts travelling.
 */
const showRing = computed(() =>
  props.lesson !== null && (props.lesson.holdMs !== undefined || props.progress > 0))

const stageStyle = computed(() => ({ left: `${props.x}px`, top: `${props.y}px` }))

// ─── The flow arrow ─────────────────────────────────────────────────────────
//
// Drawn as ONE rotated bar rather than an SVG line, so it costs a transform
// instead of a layout: the scene moves both ends of it every frame (a bug
// walks, and the HUD reflows on a rotation), and an SVG that re-resolves its
// geometry sixty times a second on a phone is a frame budget nobody has.

const flow = computed(() => {
  const dx = props.toX - props.x
  const dy = props.toY - props.y
  return {
    length: Math.hypot(dx, dy),
    angle: (Math.atan2(dy, dx) * 180) / Math.PI
  }
})

const flowStyle = computed(() => ({
  left: `${props.x}px`,
  top: `${props.y}px`,
  width: `${flow.value.length}px`,
  rotate: `${flow.value.angle}deg`
}))

/**
 * The flick's line: THROUGH the target and on toward the group it is aimed at.
 * Drawn from a little behind the target so the swipe visibly starts before it,
 * and never shorter than a readable throw.
 */
const flickStyle = computed(() => {
  const len = Math.max(120, flow.value.length)
  const back = 48
  const a = (flow.value.angle * Math.PI) / 180
  return {
    left: `${props.x - Math.cos(a) * back}px`,
    top: `${props.y - Math.sin(a) * back}px`,
    width: `${len + back}px`,
    rotate: `${flow.value.angle}deg`,
    '--flick-a': `${flow.value.angle}deg`
  }
})
</script>

<template lang="pug">
  Transition(name="tut")
    div.tut(v-if="lesson" :key="lesson.id" aria-hidden="true")
      //- A hole over the lesson, dark everywhere else — or a light wash, or
      //- nothing at all. See `Scrim` in `game/tutorial.ts`.
      div.tut__scrim(
        v-if="scrim !== 'none'"
        :class="`is-${scrim}`"
        :style="{ '--hx': x + 'px', '--hy': y + 'px' }"
      )

      //- ── flow: THIS causes THAT ──────────────────────────────────────────
      div.tut__flow(v-if="gesture === 'flow'" :style="flowStyle")
        div.tut__flow-line
        div.tut__flow-dot
        div.tut__flow-head

      //- ── flick: a swipe THROUGH the target, and the ball it sends ────────
      //- The same rotated-bar trick as the flow, run fast: a hand swipes the
      //- length of it and a ghost of the body rolls on down the line after it.
      div.tut__flick(v-if="gesture === 'flick'" :style="flickStyle")
        div.tut__flick-line
        div.tut__flick-ball
        div.tut__flick-hand(:class="isTouch ? 'is-touch' : 'is-mouse'")
          svg(v-if="isTouch" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round")
            path(d="M9 11V6a2 2 0 1 1 4 0v5")
            path(d="M13 8a2 2 0 1 1 4 0v6a6 6 0 0 1-6 6h-1a5 5 0 0 1-4.3-2.4L4 15a1.6 1.6 0 0 1 2.6-1.9L8 15")
          svg(v-else viewBox="0 0 24 24" fill="currentColor")
            path(d="M5 3l14 7.5-6 1.6L10.6 19z")

      div.tut__stage(:style="stageStyle" :class="`is-${gesture}`")
        //- drag — the track the hand slides along. The skid shares it: the
        //- difference is that the hand is PRESSED the whole way along.
        div.tut__track(v-if="gesture === 'drag' || gesture === 'skid'")

        //- Everything except a drag lands ON something, so it gets a target.
        div.tut__target(v-if="gesture !== 'drag' && gesture !== 'flow' && gesture !== 'skid'")

        //- double — the swirl the second tap sets off, round the target.
        div.tut__swirl(v-if="gesture === 'double'")

        //- skid — the press ring riding along under the hand: a tap that never
        //- lifted, dragged.
        div.tut__press(v-if="gesture === 'skid'")

        //- hold — the charge METER, drawn a good deal wider than the target it
        //- rings so it reads as a thing that FILLS rather than as a second
        //- target. The tick on it is `MIN_SLAM_CHARGE`: without somewhere to
        //- get past, a meter is only a countdown.
        svg.tut__charge(v-if="gesture === 'hold'" viewBox="0 0 36 36")
          circle.tut__charge-track(cx="18" cy="18" r="15.9155")
          circle.tut__charge-fill(cx="18" cy="18" r="15.9155")
          circle.tut__charge-mark(cx="18" cy="18" r="15.9155")

        //- The hand. One glyph, animated per gesture. `watch` and `flow` have
        //- none: there is nothing to do, only something to see.
        div.tut__hand(
          v-if="gesture !== 'watch' && gesture !== 'flow' && gesture !== 'flick'"
          :class="isTouch ? 'is-touch' : 'is-mouse'"
        )
          svg(v-if="isTouch" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round")
            path(d="M9 11V6a2 2 0 1 1 4 0v5")
            path(d="M13 8a2 2 0 1 1 4 0v6a6 6 0 0 1-6 6h-1a5 5 0 0 1-4.3-2.4L4 15a1.6 1.6 0 0 1 2.6-1.9L8 15")
          svg(v-else viewBox="0 0 24 24" fill="currentColor")
            path(d="M5 3l14 7.5-6 1.6L10.6 19z")

        //- The ripple, on the gesture that lands: it fires on the same clock
        //- the hand lands on, so cause and effect are one animation.
        div.tut__ripple(v-if="gesture === 'tap' || gesture === 'double'")

        //- hold — the payoff, in three pieces on one clock. The ECHO is the
        //- light stomp the press itself lands (the real `press()` does exactly
        //- that before it ever starts charging), drawn at the size a tap really
        //- is. The FLASH and the WAVE are the slam, and they go out three times
        //- as far. The player already knows how to tap; the whole content of
        //- this lesson is the difference between those two sizes, and a size
        //- cannot be shown on its own — so both are in every cycle.
        template(v-if="gesture === 'hold'")
          div.tut__echo
          div.tut__flash
          div.tut__wave
          div.tut__wave.is-trail

        //- avoid — the bar across the target. The only red mark in the whole
        //- tutorial, because it is the only lesson that means "not this".
        div.tut__no(v-if="gesture === 'avoid'")

      //- The progress ring, parked below the lesson rather than on it — on it,
      //- it would be mistaken for part of the lesson. Absent entirely when it
      //- has nothing to fill: see `showRing`.
      svg.tut__ring(v-if="showRing" :style="{ left: x + 'px', top: y + 'px' }" viewBox="0 0 36 36")
        circle.tut__ring-track(cx="18" cy="18" r="15.9155")
        circle.tut__ring-fill(cx="18" cy="18" r="15.9155" :stroke-dasharray="dash")
</template>

<style scoped lang="sass">
.tut
  // FIXED, and above every panel: two of the lessons are about the shop, which
  // is an FModal at z-index 110.
  position: fixed
  inset: 0
  // Rule 2: the gesture belongs to the game underneath, always.
  pointer-events: none
  z-index: 130

.tut__scrim
  position: absolute
  inset: 0

  // A hole over the lesson rather than a sheet over the board: the thing being
  // demonstrated stays fully lit and everything else recedes.
  &.is-hole
    background: radial-gradient(circle 30vmin at var(--hx) var(--hy), rgba(4, 4, 12, 0) 0%, rgba(4, 4, 12, 0.10) 45%, rgba(4, 4, 12, 0.44) 100%)

  // A lesson that arrives MID-LEVEL must not black out the bug that is about to
  // walk into the foot. Half the weight, and a much wider hole.
  &.is-soft
    background: radial-gradient(circle 46vmin at var(--hx) var(--hy), rgba(4, 4, 12, 0) 0%, rgba(4, 4, 12, 0.04) 55%, rgba(4, 4, 12, 0.22) 100%)

.tut__stage
  position: absolute
  translate: -50% -50%
  width: 0
  height: 0
  // Stated once, so the hold lesson can offset the hand by a FRACTION OF
  // ITSELF and land its fingertip on the target instead of its palm.
  --tut-hand: clamp(1.9rem, 8.5vmin, 2.8rem)

// ─── drag — the track ───────────────────────────────────────────────────────

.tut__track
  position: absolute
  left: 50%
  top: 50%
  translate: -50% -50%
  width: clamp(7rem, 34vmin, 13rem)
  height: 3px
  border-radius: 999px
  background: repeating-linear-gradient(90deg, rgba(255, 217, 60, 0.9) 0 10px, rgba(255, 217, 60, 0) 10px 20px)
  opacity: 0.8

// ─── The target ─────────────────────────────────────────────────────────────

.tut__target
  position: absolute
  left: 50%
  top: 50%
  translate: -50% -50%
  width: clamp(3rem, 14vmin, 5rem)
  height: clamp(3rem, 14vmin, 5rem)
  border: 3px dashed rgba(255, 217, 60, 0.85)
  border-radius: 999px
  animation: tut-target 1.6s ease-in-out infinite

// A control is a rectangle, not a bug: the ring round it is wider and calmer,
// so it reads as "this button" rather than "something is about to happen here".
.is-point .tut__target
  width: clamp(3.6rem, 17vmin, 6rem)
  height: clamp(3.6rem, 17vmin, 6rem)
  border-style: solid
  border-color: rgba(255, 217, 60, 0.9)

.is-avoid .tut__target
  border-color: rgba(255, 90, 110, 0.95)

.is-watch .tut__target
  border-style: solid
  border-color: rgba(255, 255, 255, 0.9)
  animation: tut-watch 1.9s ease-in-out infinite

// hold: the target is the blow's REACH, and the reach is what the charge buys.
// So it does not pulse on a loop like every other target — it grows with the
// meter, punches on release, and settles back. It is the "the foot swells" half
// of the lesson, and it is drawn rather than described.
.is-hold .tut__target
  border-style: solid
  border-color: rgba(255, 217, 60, 0.92)
  filter: drop-shadow(0 0 5px rgba(0, 0, 0, 0.85))
  animation: tut-hold-target 2600ms linear infinite

@keyframes tut-hold-target
  0%
    scale: 1
    opacity: 0.7
  7%
    scale: 1
    opacity: 1
  10%
    scale: 0.88
  16%
    scale: 1.02
  58%
    scale: 1.62
  62%
    scale: 1.62
  // The punch, and then straight back out of the way. Held out at the wave's
  // own radius it merged with it into one fat gold disc — the impact has to be
  // a ring LEAVING something, and something has to be left behind for it to
  // leave.
  64%
    scale: 1.88
    opacity: 1
  73%
    scale: 1.14
    opacity: 0.5
  88%, 100%
    scale: 1
    opacity: 0.7

@keyframes tut-target
  0%, 100%
    scale: 1
    opacity: 0.85
  50%
    scale: 1.12
    opacity: 1

@keyframes tut-watch
  0%, 100%
    scale: 1
    opacity: 0.55
  50%
    scale: 1.18
    opacity: 1

// ─── hold — the big stomp, in three beats ───────────────────────────────────
//
// The one lesson in this game that cannot be taught by showing the gesture,
// because the player already OWNS the gesture. They have been tapping since
// level 1-1; what they do not know is that the press has a second half. So the
// animation is not a demonstration, it is a COMPARISON, and every element below
// is on one 2600 ms clock so the comparison happens inside a single glance:
//
//     0 –  7 %   the hand comes down
//     7 %        it lands — and the press's own light stomp goes out (`echo`),
//                which is not licence, it is what `press()` really does: a
//                quick stomp first, and only then a charge
//     7 – 16 %   that tap and nothing else. The meter is still empty
//    16 – 58 %   the hand STAYS DOWN, the meter fills, and the target swells
//                with it — what is growing is the blow's reach. The mark at
//                34 % of the meter is `MIN_SLAM_CHARGE`, crossed at 30 % of
//                the cycle, and it lights when the fill reaches it
//    58 – 62 %   full, held
//    64 %        RELEASE. The hand snaps away; flash, then wave
//    64 – 88 %   the wave goes out to 3.6×, against the echo's 1.35×
//    88 – 100 %  rest, and again
//
// The ORDER and the PROPORTIONS are the simulation's, slowed about four times
// so a six-year-old can follow them. In the real foot a press costs 70 ms of
// drop, 70 ms of impact and 150 ms of cooldown before charging even begins,
// then `shoe.chargeMs` (320 ms in the starter sneaker) to fill — passing
// `MIN_SLAM_CHARGE` 109 ms in, at 34 % of the ring, which is where the mark is.

.tut__charge
  position: absolute
  left: 50%
  top: 50%
  translate: -50% -50%
  // WIDER than the target it rings. At the target's own 14vmin it was a third
  // concentric yellow circle inside seventy pixels, and the hand, the target
  // and the meter merged into one gold blob sitting on top of the beetle the
  // lesson was about.
  width: clamp(6.6rem, 31vmin, 10.5rem)
  height: clamp(6.6rem, 31vmin, 10.5rem)
  rotate: -90deg
  overflow: visible
  filter: drop-shadow(0 0 5px rgba(0, 0, 0, 0.8))

.tut__charge-track
  fill: none
  stroke: rgba(8, 8, 20, 0.5)
  stroke-width: 2.8

.tut__charge-fill
  fill: none
  stroke: #ffd93c
  stroke-width: 3.6
  stroke-linecap: round
  stroke-dasharray: 0 100
  animation: tut-charge 2600ms linear infinite

// The threshold. The circle's circumference is 100 units by construction
// (r = 15.9155), so a dash parked 34 units along it is 34 % of the charge —
// the exact number `release()` compares against before it will call the blow a
// slam. A meter with nothing to get PAST is only a countdown.
.tut__charge-mark
  fill: none
  stroke: #ffffff
  stroke-width: 6.2
  stroke-dasharray: 2.2 97.8
  stroke-dashoffset: -32.9
  animation: tut-charge-mark 2600ms linear infinite

// The opacity is not decoration. `stroke-linecap: round` on a zero-length dash
// draws a round cap anyway — an empty meter rendered as a stray gold dot at
// twelve o'clock, which on a board full of coins and pickups reads as a thing
// to go and collect. So the fill is simply absent until it has length.
@keyframes tut-charge
  0%, 16%
    stroke-dasharray: 0 100
    opacity: 0
  19%
    opacity: 1
  58%, 63%
    stroke-dasharray: 100 100
    opacity: 1
  64%, 100%
    stroke-dasharray: 0 100
    opacity: 0

@keyframes tut-charge-mark
  0%, 29%
    opacity: 0.5
    scale: 1
  31%
    opacity: 1
    scale: 1.14
  35%, 63%
    opacity: 1
    scale: 1
  64%, 100%
    opacity: 0.5
    scale: 1

// ─── avoid — the bar ────────────────────────────────────────────────────────

.tut__no
  position: absolute
  left: 50%
  top: 50%
  translate: -50% -50%
  rotate: -45deg
  width: clamp(3rem, 14vmin, 5rem)
  height: clamp(0.3rem, 1.4vmin, 0.5rem)
  border-radius: 999px
  background-color: #ff5a6e
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.5)
  animation: tut-target 1.6s ease-in-out infinite

// ─── The hand ───────────────────────────────────────────────────────────────

.tut__hand
  position: absolute
  left: 50%
  top: 50%
  width: var(--tut-hand)
  height: var(--tut-hand)
  color: #ffd93c
  filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.85))

  svg
    width: 100%
    height: 100%

// drag: one axis, back and forth, at a pace a hand can copy. The pause at each
// end is what makes it read as a deliberate drag rather than as a slider.
.is-drag .tut__hand
  animation: tut-drag 2.4s ease-in-out infinite

@keyframes tut-drag
  0%, 8%
    translate: -180% -30%
  46%, 54%
    translate: 80% -30%
  92%, 100%
    translate: -180% -30%

// tap: down, and away.
.is-tap .tut__hand
  animation: tut-tap 1.6s ease-in-out infinite

@keyframes tut-tap
  0%
    translate: -20% -120%
    scale: 1
  30%, 42%
    translate: -20% -46%
    scale: 0.88
  70%, 100%
    translate: -20% -120%
    scale: 1

// hold: down at 7 %, DOWN until 64 %, and gone in a snap. Well over half the
// cycle is a hand doing nothing but staying put, because that IS the lesson —
// and the snap off at the end is what makes the wave read as caused by the
// release rather than by the press.
.is-hold .tut__hand
  // Land the FINGERTIP on the target, not the palm. Centred, the hand and the
  // full charge ring together covered the beetle completely at the peak of the
  // animation — the drawing hid the thing it was drawn about. The touch glyph's
  // tip sits at roughly (46 %, 25 %) of its own box; the cursor's at (21 %, 13 %).
  margin-left: calc(var(--tut-hand) * -0.46)
  margin-top: calc(var(--tut-hand) * -0.25)
  animation: tut-hold-hand 2600ms linear infinite

.is-hold .tut__hand.is-mouse
  margin-left: calc(var(--tut-hand) * -0.21)
  margin-top: calc(var(--tut-hand) * -0.13)

@keyframes tut-hold-hand
  0%
    translate: 0 -150%
    scale: 1
    animation-timing-function: cubic-bezier(0.45, 0, 0.9, 0.55)
  7%
    translate: 0 0
    scale: 0.95
  10%
    translate: 0 7%
    scale: 0.88
  16%
    translate: 0 5%
    scale: 0.9
  // A shallow breath while it is held down, so a hand that must stay put for
  // most of a second still reads as pressing rather than as a frozen frame.
  36%
    translate: 0 8%
    scale: 0.86
  58%, 62%
    translate: 0 5%
    scale: 0.9
    animation-timing-function: cubic-bezier(0.2, 0.85, 0.3, 1)
  66%
    translate: 0 -34%
    scale: 1.04
  80%, 100%
    translate: 0 -150%
    scale: 1

// avoid: reaches, thinks better of it, and pulls back fast. The retreat is
// quicker than the approach, which is what makes it read as a flinch.
.is-avoid .tut__hand
  color: #ff8a95
  animation: tut-avoid 1.9s ease-in-out infinite

@keyframes tut-avoid
  0%
    translate: -20% -150%
  38%
    translate: -20% -78%
  46%
    translate: -20% -84%
  60%, 100%
    translate: -20% -150%

// point: hovers beside the control and nods at it, never covering it.
.is-point .tut__hand
  animation: tut-point 1.5s ease-in-out infinite

@keyframes tut-point
  0%, 100%
    translate: 10% -10%
  50%
    translate: -6% -34%

// ─── The ripple ─────────────────────────────────────────────────────────────

.tut__ripple
  position: absolute
  left: 50%
  top: 50%
  translate: -50% -50%
  width: clamp(3rem, 14vmin, 5rem)
  height: clamp(3rem, 14vmin, 5rem)
  border: 3px solid rgba(255, 255, 255, 0.9)
  border-radius: 999px
  opacity: 0

.is-tap .tut__ripple
  animation: tut-ripple 1.6s ease-out infinite
  animation-delay: 0.48s

@keyframes tut-ripple
  0%
    scale: 0.3
    opacity: 0.95
  100%
    scale: 1.6
    opacity: 0

// ─── hold — the echo, the flash and the wave ────────────────────────────────
//
// Peak 1.35× against peak 3.6×, in the same cycle, on the same clock, from the
// same centre. That ratio is the entire lesson: the old cut drew only the big
// one, and a ring you have nothing to measure against is just a ring.

.tut__echo, .tut__wave, .tut__flash
  position: absolute
  left: 50%
  top: 50%
  translate: -50% -50%
  width: clamp(3rem, 14vmin, 5rem)
  height: clamp(3rem, 14vmin, 5rem)
  border-radius: 999px
  opacity: 0

// The light stomp the press itself lands, at the size a tap really is. It has
// to LEAVE, visibly, past the target — an echo that expands inside the ring it
// started in is not a stomp, it is a highlight.
.tut__echo
  border: 3px solid rgba(255, 255, 255, 0.9)
  filter: drop-shadow(0 0 3px rgba(0, 0, 0, 0.8))
  animation: tut-hold-echo 2600ms ease-out infinite

@keyframes tut-hold-echo
  0%, 6%
    scale: 0.7
    opacity: 0
  8%
    scale: 0.98
    opacity: 1
  21%, 100%
    scale: 1.7
    opacity: 0

// The weight. A ring says how FAR the blow reached; a hard bloom on the same
// frame is what makes it read as HEAVY rather than as a wider version of the
// same tap.
//
// An ANNULUS, not a disc. The first cut was a filled radial and it whited out
// the bug at the exact instant the lesson was making its point — the payoff
// frame has to show the armoured thing being hit, or it is a payoff for
// nothing. The middle 26 % of it is transparent on purpose.
.tut__flash
  background: radial-gradient(circle, rgba(255, 255, 255, 0) 26%, rgba(255, 255, 255, 0.92) 44%, rgba(255, 205, 70, 0.55) 62%, rgba(255, 205, 70, 0) 78%)
  animation: tut-hold-flash 2600ms ease-out infinite

@keyframes tut-hold-flash
  0%, 63%
    scale: 0.6
    opacity: 0
  65%
    scale: 1.45
    opacity: 1
  73%, 100%
    scale: 2.4
    opacity: 0

// No inset glow: it fills the ring in, and a filled ring at the impact frame is
// a gold coin sitting on the bug rather than a wave leaving it.
// The dark hairline is doing real work: gold on a red-and-white gingham floor
// at 40 % opacity is nearly invisible, and the wave spends most of its life
// fading. A 2 px dark ring outside the gold one separates it from whatever it
// happens to be crossing.
.tut__wave
  border: 5px solid rgba(255, 217, 60, 0.95)
  box-shadow: 0 0 0 2px rgba(26, 12, 0, 0.45), 0 0 16px rgba(255, 180, 40, 0.5)
  animation: tut-hold-wave 2600ms cubic-bezier(0.08, 0.7, 0.3, 1) infinite

// A thin second front behind the first. One ring is an outline; two travelling
// apart are a shockwave.
.tut__wave.is-trail
  border-width: 2px
  border-color: rgba(255, 255, 255, 0.85)
  box-shadow: 0 0 0 1px rgba(26, 12, 0, 0.4)
  animation-name: tut-hold-wave-trail

// The opacity holds high while it travels and drops at the end, rather than
// fading linearly across the whole journey — a wave that is half transparent by
// the time it is big enough to read is a wave nobody saw.
@keyframes tut-hold-wave
  0%, 63%
    scale: 0.9
    opacity: 0
  65%
    scale: 1.85
    opacity: 1
  78%
    scale: 3.1
    opacity: 0.8
  90%, 100%
    scale: 3.9
    opacity: 0

@keyframes tut-hold-wave-trail
  0%, 65%
    scale: 0.9
    opacity: 0
  68%
    scale: 1.5
    opacity: 0.95
  80%
    scale: 2.4
    opacity: 0.6
  92%, 100%
    scale: 2.9
    opacity: 0

// ─── flow — this causes that ────────────────────────────────────────────────

.tut__flow
  position: absolute
  height: 0
  transform-origin: 0 0
  pointer-events: none

.tut__flow-line
  position: absolute
  left: 0
  top: -1.5px
  width: 100%
  height: 3px
  border-radius: 999px
  background: repeating-linear-gradient(90deg, rgba(255, 217, 60, 0.95) 0 12px, rgba(255, 217, 60, 0) 12px 22px)
  opacity: 0.9

// A bead running the length of it, because a dotted line is a connection and a
// MOVING bead is a direction — and direction is the entire content of the
// lesson that explains what the game wants.
.tut__flow-dot
  position: absolute
  top: 50%
  width: clamp(0.55rem, 2.4vmin, 0.85rem)
  height: clamp(0.55rem, 2.4vmin, 0.85rem)
  translate: -50% -50%
  border-radius: 999px
  background-color: #ffd93c
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.55), 0 0 12px rgba(255, 217, 60, 0.9)
  animation: tut-flow 1.5s cubic-bezier(0.45, 0, 0.35, 1) infinite

.tut__flow-head
  position: absolute
  right: 0
  top: 50%
  width: 0
  height: 0
  translate: 0 -50%
  border-top: clamp(0.35rem, 1.5vmin, 0.55rem) solid transparent
  border-bottom: clamp(0.35rem, 1.5vmin, 0.55rem) solid transparent
  border-left: clamp(0.55rem, 2.2vmin, 0.8rem) solid #ffd93c
  filter: drop-shadow(0 0 4px rgba(0, 0, 0, 0.7))

@keyframes tut-flow
  0%
    left: 0
    opacity: 0
  12%
    opacity: 1
  88%
    opacity: 1
  100%
    left: 100%
    opacity: 0

// ─── double — the Heel Spin ─────────────────────────────────────────────────
//
// Two drops on one spot, fast, and then a swirl goes round the target: the
// second tap is what makes the spin, so the swirl is on the SECOND drop's
// frame and not the first. 1.8 s, which is a double tap slowed about four
// times, like every other gesture here.

.is-double .tut__hand
  animation: tut-double 1.8s ease-in-out infinite

@keyframes tut-double
  0%
    translate: -20% -120%
    scale: 1
  18%, 22%
    translate: -20% -46%
    scale: 0.88
  30%
    translate: -20% -80%
    scale: 0.96
  38%, 44%
    translate: -20% -46%
    scale: 0.88
  70%, 100%
    translate: -20% -120%
    scale: 1

.tut__swirl
  position: absolute
  left: 50%
  top: 50%
  translate: -50% -50%
  width: clamp(6rem, 28vmin, 9.5rem)
  height: clamp(6rem, 28vmin, 9.5rem)
  border-radius: 999px
  border: 4px solid transparent
  border-top-color: rgba(190, 230, 255, 0.95)
  border-right-color: rgba(190, 230, 255, 0.55)
  filter: drop-shadow(0 0 4px rgba(0, 0, 0, 0.7))
  opacity: 0
  animation: tut-swirl 1.8s ease-out infinite

@keyframes tut-swirl
  0%, 40%
    opacity: 0
    rotate: 0deg
    scale: 0.6
  46%
    opacity: 1
  80%
    opacity: 0.8
    rotate: 540deg
    scale: 1.1
  92%, 100%
    opacity: 0
    rotate: 720deg
    scale: 1.2

// ─── skid — press, and DRAG ─────────────────────────────────────────────────
//
// The drag lesson's track and the tap lesson's press, on one clock: the hand
// comes down at the left end, STAYS down, and slides right with the press ring
// riding under it. Faster across than the move lesson's drag, because a skid is
// a quick plough and a slow one never starts (the foot has to be moving).

.is-skid .tut__hand
  animation: tut-skid 2.2s ease-in-out infinite

@keyframes tut-skid
  0%
    translate: -180% -130%
    scale: 1
  14%
    translate: -180% -46%
    scale: 0.88
  24%
    translate: -180% -46%
    scale: 0.88
  54%
    translate: 80% -46%
    scale: 0.88
  66%, 100%
    translate: 80% -130%
    scale: 1

.tut__press
  position: absolute
  left: 50%
  top: 50%
  width: clamp(2.4rem, 11vmin, 3.8rem)
  height: clamp(2.4rem, 11vmin, 3.8rem)
  border: 3px solid rgba(255, 217, 60, 0.95)
  border-radius: 999px
  filter: drop-shadow(0 0 4px rgba(0, 0, 0, 0.8))
  opacity: 0
  animation: tut-press 2.2s ease-in-out infinite

@keyframes tut-press
  0%, 13%
    translate: -210% -50%
    opacity: 0
  16%, 24%
    translate: -210% -50%
    opacity: 1
  54%
    translate: 110% -50%
    opacity: 1
  60%, 100%
    translate: 110% -50%
    opacity: 0

// ─── flick — the kick ───────────────────────────────────────────────────────

.tut__flick
  position: absolute
  height: 0
  transform-origin: 0 0
  pointer-events: none

.tut__flick-line
  position: absolute
  left: 0
  top: -1.5px
  width: 100%
  height: 3px
  border-radius: 999px
  background: repeating-linear-gradient(90deg, rgba(255, 217, 60, 0.95) 0 8px, rgba(255, 217, 60, 0) 8px 16px)
  opacity: 0.85

// A ghost of the body, rolling on down the line AFTER the hand has swiped
// through it — the swipe and the roll are cause and effect, so the roll starts
// on the swipe's frame.
.tut__flick-ball
  position: absolute
  top: 50%
  width: clamp(1.2rem, 5vmin, 1.8rem)
  height: clamp(1.2rem, 5vmin, 1.8rem)
  translate: -50% -50%
  border-radius: 999px
  border: 3px dashed rgba(255, 255, 255, 0.95)
  background: rgba(66, 225, 122, 0.35)
  opacity: 0
  animation: tut-flick-ball 1.7s cubic-bezier(0.2, 0.7, 0.3, 1) infinite

@keyframes tut-flick-ball
  0%, 34%
    left: 48px
    opacity: 0
    rotate: 0deg
  38%
    opacity: 1
  90%
    opacity: 0.9
  100%
    left: 100%
    opacity: 0
    rotate: 720deg

.tut__flick-hand
  position: absolute
  top: 0
  width: clamp(1.9rem, 8.5vmin, 2.8rem)
  height: clamp(1.9rem, 8.5vmin, 2.8rem)
  color: #ffd93c
  filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.85))
  // Counter-rotated so the hand stays upright whatever angle the line is at —
  // a hand swiping upside down reads as a different gesture.
  rotate: calc(-1 * var(--flick-a, 0deg))
  animation: tut-flick-hand 1.7s ease-in infinite

  svg
    width: 100%
    height: 100%

@keyframes tut-flick-hand
  0%
    left: 0
    translate: -40% -60%
    opacity: 0
  8%
    opacity: 1
  36%
    left: 96px
    translate: -40% -60%
    opacity: 1
  46%, 100%
    left: 140px
    translate: -40% -60%
    opacity: 0

// ─── The progress ring ──────────────────────────────────────────────────────

.tut__ring
  position: absolute
  translate: -50% -50%
  margin-top: clamp(3.4rem, 15vmin, 5.4rem)
  width: clamp(1.5rem, 6vmin, 2rem)
  height: clamp(1.5rem, 6vmin, 2rem)
  rotate: -90deg

.tut__ring-track
  fill: none
  stroke: rgba(255, 255, 255, 0.22)
  stroke-width: 3

.tut__ring-fill
  fill: none
  stroke: #ffd93c
  stroke-width: 3
  stroke-linecap: round
  transition: stroke-dasharray 90ms linear

.tut-enter-active, .tut-leave-active
  transition: opacity 300ms ease-out

.tut-enter-from, .tut-leave-to
  opacity: 0

// Every element of a gesture has to be slowed to the SAME duration or it is not
// slowed, it is desynchronised — the hold lesson is four elements telling one
// story in lockstep, and a wave that goes out while the meter is still filling
// teaches the opposite of the thing.
@media (prefers-reduced-motion: reduce)
  .tut__hand, .tut__target, .tut__ripple, .tut__charge-fill, .tut__charge-mark,
  .tut__no, .tut__flow-dot, .tut__echo, .tut__flash, .tut__wave,
  .tut__swirl, .tut__press, .tut__flick-ball, .tut__flick-hand
    animation-duration: 4.8s
</style>
