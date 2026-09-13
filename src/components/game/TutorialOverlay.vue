<script setup lang="ts">
import { computed } from 'vue'
import { isMobilePortrait } from '@/use/useUser'
import { mobileCheck } from '@/utils/function'

/**
 * ─── The first fifteen seconds ──────────────────────────────────────────────
 *
 * The only thing standing between a stranger and this game is that they do not
 * yet know a shoe follows their finger. This teaches that, and two more things,
 * WITHOUT A SINGLE WORD.
 *
 * ── Why wordless ──
 *
 * The audience starts at six. A six-year-old on a phone in a language they are
 * still learning to read will not read an instruction, and a ten-year-old will
 * not either — they will tap past it and then be confused, which is worse than
 * never having shown it. Every locale this game ships to gets the same overlay,
 * and it is correct in all of them because there is nothing in it to translate.
 *
 * ── The three beats ──
 *
 *   0 · MOVE   a hand glyph drags back and forth along a dotted track, with a
 *              ghost shoe following it one beat behind. Retires the moment the
 *              player has moved the real foot for a second.
 *   1 · TAP    the hand drops onto a single ant, a burst pops, the ant is gone.
 *              Retires on the first successful squish.
 *   2 · HOLD   the hand presses and stays down; a ring fills around it; it
 *              releases and a big shockwave goes out. Retires on the first
 *              heavy slam.
 *
 * ── Three rules it is built to ──
 *
 *   1. IT IS NOT A PAGE. There is no OK button and nothing to dismiss. The
 *      player leaves each beat by DOING it. A tutorial you can click past is a
 *      tutorial that teaches clicking past tutorials.
 *   2. IT NEVER EATS THE GESTURE. `pointer-events: none` all the way down, so
 *      the finger that is learning is playing, not being intercepted by the
 *      thing explaining.
 *   3. IT SHOWS THE PLAYER'S OWN DEVICE. A finger on touch, a cursor on
 *      desktop. The wrong glyph reads as a game built for somebody else.
 *
 * The board stays lit underneath: the scrim is a ring, not a sheet, so the one
 * thing the player is being asked to look at is the one thing not dimmed.
 */

interface Props {
  /** Which lesson is running: 0 move, 1 tap, 2 hold. */
  beat: 0 | 1 | 2
  /** 0..1 — how much of the current beat's requirement has been done. Drives
   *  the ring, which is the only feedback that the gesture is working. */
  progress: number
  /** Where the lesson's demonstration sits, in CSS px from the top-left of the
   *  canvas. The scene passes the foot's own position for beat 0 and the
   *  tutorial ant's for beats 1 and 2, so the hand is always over the thing it
   *  is talking about. */
  x: number
  y: number
}

const props = defineProps<Props>()

const isTouch = computed(() => mobileCheck() || isMobilePortrait.value
  || (typeof window !== 'undefined' && navigator.maxTouchPoints > 0))

/** Ring geometry, as stroke-dashoffset over a 100-unit circumference. */
const dash = computed(() => `${Math.max(0, Math.min(1, props.progress)) * 100} 100`)

const stageStyle = computed(() => ({ left: `${props.x}px`, top: `${props.y}px` }))
</script>

<template lang="pug">
  Transition(name="tut")
    div.tut(:key="beat" aria-hidden="true")
      //- A hole over the demonstration, dark everywhere else.
      div.tut__scrim(:style="{ '--hx': x + 'px', '--hy': y + 'px' }")

      div.tut__stage(:style="stageStyle" :class="`beat-${beat}`")
        //- BEAT 0 — the track the hand slides along. Only this beat has one.
        div.tut__track(v-if="beat === 0")

        //- BEAT 1 / 2 — a target ring where the hand is going to land.
        div.tut__target(v-if="beat > 0")

        //- The charge ring. Beat 2 only: it fills as the demo hand holds, which
        //- is exactly what the real charge ring on the real foot will do.
        svg.tut__charge(v-if="beat === 2" viewBox="0 0 36 36")
          circle.tut__charge-track(cx="18" cy="18" r="15.9155")
          circle.tut__charge-fill(cx="18" cy="18" r="15.9155")

        //- The hand. One glyph, animated per beat.
        div.tut__hand(:class="isTouch ? 'is-touch' : 'is-mouse'")
          svg(v-if="isTouch" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round")
            path(d="M9 11V6a2 2 0 1 1 4 0v5")
            path(d="M13 8a2 2 0 1 1 4 0v6a6 6 0 0 1-6 6h-1a5 5 0 0 1-4.3-2.4L4 15a1.6 1.6 0 0 1 2.6-1.9L8 15")
          svg(v-else viewBox="0 0 24 24" fill="currentColor")
            path(d="M5 3l14 7.5-6 1.6L10.6 19z")

        //- The tap ripple, on beats 1 and 2: it fires on the same clock the
        //- hand lands on, so the cause and the effect are one animation.
        div.tut__ripple(v-if="beat > 0")
        div.tut__ripple.is-late(v-if="beat === 2")

      //- The progress ring, parked below the demonstration rather than on it —
      //- on it, it would be mistaken for part of the lesson.
      svg.tut__ring(:style="{ left: x + 'px', top: y + 'px' }" viewBox="0 0 36 36")
        circle.tut__ring-track(cx="18" cy="18" r="15.9155")
        circle.tut__ring-fill(cx="18" cy="18" r="15.9155" :stroke-dasharray="dash")
</template>

<style scoped lang="sass">
.tut
  position: absolute
  inset: 0
  // Rule 2: the gesture belongs to the game underneath, always.
  pointer-events: none
  z-index: 30

.tut__scrim
  position: absolute
  inset: 0
  // A hole over the lesson rather than a sheet over the board: the thing being
  // demonstrated stays fully lit and everything else recedes.
  background: radial-gradient(circle 30vmin at var(--hx) var(--hy), rgba(4, 4, 12, 0) 0%, rgba(4, 4, 12, 0.10) 45%, rgba(4, 4, 12, 0.44) 100%)

.tut__stage
  position: absolute
  translate: -50% -50%
  width: 0
  height: 0

// ─── Beat 0 — the drag track ────────────────────────────────────────────────

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

// ─── Beats 1 / 2 — the target ───────────────────────────────────────────────

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

@keyframes tut-target
  0%, 100%
    scale: 1
    opacity: 0.85
  50%
    scale: 1.12
    opacity: 1

.tut__charge
  position: absolute
  left: 50%
  top: 50%
  translate: -50% -50%
  width: clamp(4rem, 18vmin, 6.4rem)
  height: clamp(4rem, 18vmin, 6.4rem)
  rotate: -90deg

.tut__charge-track
  fill: none
  stroke: rgba(255, 255, 255, 0.18)
  stroke-width: 3

.tut__charge-fill
  fill: none
  stroke: #ffd93c
  stroke-width: 4
  stroke-linecap: round
  stroke-dasharray: 0 100
  animation: tut-charge 2.4s ease-in-out infinite

@keyframes tut-charge
  0%, 24%
    stroke-dasharray: 0 100
  56%
    stroke-dasharray: 100 100
  62%, 100%
    stroke-dasharray: 0 100

// ─── The hand ───────────────────────────────────────────────────────────────

.tut__hand
  position: absolute
  left: 50%
  top: 50%
  width: clamp(1.9rem, 8.5vmin, 2.8rem)
  height: clamp(1.9rem, 8.5vmin, 2.8rem)
  color: #ffd93c
  filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.85))

  svg
    width: 100%
    height: 100%

// Beat 0: one axis, back and forth, at a pace a hand can copy. The pause at
// each end is what makes it read as a deliberate drag rather than a slider.
.beat-0 .tut__hand
  animation: tut-drag 2.4s ease-in-out infinite

@keyframes tut-drag
  0%, 8%
    translate: -180% -30%
  46%, 54%
    translate: 80% -30%
  92%, 100%
    translate: -180% -30%

// Beat 1: down, and away.
.beat-1 .tut__hand
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

// Beat 2: down, HELD, then away — the hold is the lesson, so it is most of the
// cycle.
.beat-2 .tut__hand
  animation: tut-hold 2.4s ease-in-out infinite

@keyframes tut-hold
  0%
    translate: -20% -120%
    scale: 1
  18%, 58%
    translate: -20% -46%
    scale: 0.86
  70%, 100%
    translate: -20% -120%
    scale: 1

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

.beat-1 .tut__ripple
  animation: tut-ripple 1.6s ease-out infinite
  animation-delay: 0.48s

.beat-2 .tut__ripple
  animation: tut-ripple-big 2.4s ease-out infinite
  animation-delay: 1.39s

.beat-2 .tut__ripple.is-late
  animation-delay: 1.52s

@keyframes tut-ripple
  0%
    scale: 0.3
    opacity: 0.95
  100%
    scale: 1.6
    opacity: 0

@keyframes tut-ripple-big
  0%
    scale: 0.3
    opacity: 1
    border-color: rgba(255, 217, 60, 0.95)
  100%
    scale: 3.4
    opacity: 0
    border-color: rgba(255, 217, 60, 0)

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

@media (prefers-reduced-motion: reduce)
  .tut__hand, .tut__target, .tut__ripple, .tut__charge-fill
    animation-duration: 4.8s
</style>
