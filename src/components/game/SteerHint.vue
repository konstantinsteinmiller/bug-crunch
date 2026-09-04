<template lang="pug">
  Transition(name="steer-hint")
    div.steer-hint(v-if="show" :style="trackStyle" aria-hidden="true")
      div.steer-hint__finger(:style="fingerStyle")
        //- A hand with one finger out, drawn rather than typed: this hint exists
        //- for players who did not read the words, so it must not contain any.
        svg(viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round")
          path(d="M9 11V6a2 2 0 1 1 4 0v5")
          path(d="M13 8a2 2 0 1 1 4 0v6a6 6 0 0 1-6 6h-1a5 5 0 0 1-4.3-2.4L4 15a1.6 1.6 0 0 1 2.6-1.9L8 15")
      //- A short ghost trail under the finger, so the SHAPE of the gesture is
      //- legible in a single glance rather than only over a full sweep.
      div.steer-hint__trail
</template>

<script setup lang="ts">
import { computed } from 'vue'

/**
 * ─── The steer hint ─────────────────────────────────────────────────────────
 *
 * A finger sliding left and right inside the road, for the opening seconds of a
 * mobile run.
 *
 * The control is one axis and nothing else, which is exactly why it needed
 * this: there is no button to press and no stick to find, so a player who does
 * not think to DRAG sees a game that appears to be playing itself. The written
 * primer ("Move the mouse to steer your squad") answers a question a phone
 * player never asks, and the first-run lightbox only ever appears once.
 *
 * Deliberately inside the lane. A finger drawn over the scenery reads as UI
 * chrome; a finger travelling between the same two rails the crowd travels
 * between reads as an instruction about the crowd. The lane's on-screen width
 * is measured by the scene (`worldToScreenX`) rather than guessed at as a
 * percentage, so it is correct on every aspect ratio the game supports.
 */
interface Props {
  /** Half the road's width, in CSS pixels — the scene measures it. */
  laneHalfPx: number
  show: boolean
}

const props = defineProps<Props>()

/** The lane, as a box the finger animates inside. */
const trackStyle = computed(() => ({
  width: `${Math.max(80, props.laneHalfPx * 2)}px`
}))

/**
 * Travel is a fraction of the lane rather than its full width: a finger that
 * reaches the rails suggests the crowd should be driven into them, and the
 * useful part of the road is the middle anyway.
 */
const fingerStyle = computed(() => ({
  '--steer-travel': `${Math.max(28, props.laneHalfPx * 0.58)}px`
}))
</script>

<style scoped lang="sass">
.steer-hint
  position: absolute
  left: 50%
  top: 62%
  transform: translateX(-50%)
  height: 0
  // Never eats the gesture it is asking for.
  pointer-events: none
  z-index: 40
  display: flex
  align-items: center
  justify-content: center

.steer-hint__finger
  position: absolute
  color: #fff
  width: clamp(2rem, 11vw, 3.1rem)
  height: clamp(2rem, 11vw, 3.1rem)
  filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.85))
  animation: steer-sweep 2.1s ease-in-out infinite

  svg
    width: 100%
    height: 100%

.steer-hint__trail
  position: absolute
  height: 0.22rem
  width: 62%
  border-radius: 999px
  background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.42) 50%, rgba(255,255,255,0) 100%)
  animation: steer-trail 2.1s ease-in-out infinite

// Left, right, back — the whole gesture, twice over, before the hint retires.
@keyframes steer-sweep
  0%, 100%
    transform: translateX(calc(var(--steer-travel) * -1))
  50%
    transform: translateX(var(--steer-travel))

@keyframes steer-trail
  0%, 100%
    opacity: 0.15
  50%
    opacity: 0.5

.steer-hint-enter-active, .steer-hint-leave-active
  transition: opacity 0.45s ease

.steer-hint-enter-from, .steer-hint-leave-to
  opacity: 0
</style>
