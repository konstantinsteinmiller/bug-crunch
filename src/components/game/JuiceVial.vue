<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import GameIcon from '@/components/icons/GameIcon.vue'

/**
 * ─── The Juice vial and the FEVER button ────────────────────────────────────
 *
 * One control, three states, and the whole of the GDD's §6.2.
 *
 *   FILLING   a glass vial down the side of the screen, filling with the goo of
 *             whatever has been squished. Inert; nothing to press.
 *   READY     the vial is full, the glass glows, and the button under it comes
 *             alive and starts to bounce. This is the only moment in the game
 *             the HUD actively asks to be pressed.
 *   RUNNING   the vial empties on a ten-second clock while the frenzy runs, so
 *             the player can see exactly how long they have left.
 *
 * ── Why it is a vial and not a bar ──
 *
 * A horizontal bar at the top of the screen is where every other meter in every
 * other game lives, and the player's eye is not there — it is on the foot, in
 * the middle. A tall vial down the SIDE sits in peripheral vision at the height
 * the hand is already at, and it fills UPWARD, which is the one direction that
 * reads as "getting closer" without a number.
 *
 * ── Placement ──
 *
 * The component positions nothing: the scene's own rail owns where it goes
 * (left in portrait, left in landscape, always clear of the safe-area inset).
 * Everything here is `vmin`-based so the vial is the same fraction of the short
 * edge on a phone and on a monitor.
 */

interface Props {
  /** 0..1 — how full the vial is. */
  juice: number
  /** ms of frenzy left; 0 when not running. */
  feverMs: number
  /** The frenzy's full duration, so the drain can be drawn as a fraction. */
  feverTotal: number
  /** Reduced-motion: no bounce, no pulse. */
  calm?: boolean
}

const props = withDefaults(defineProps<Props>(), { calm: false })
const emit = defineEmits<{ (e: 'fever'): void }>()
const { t } = useI18n()

const running = computed(() => props.feverMs > 0)
const ready = computed(() => !running.value && props.juice >= 1)

/** What the glass shows: the vial while filling, the clock while running. */
const fill = computed(() => {
  if (running.value) return Math.max(0, Math.min(1, props.feverMs / Math.max(1, props.feverTotal)))
  return Math.max(0, Math.min(1, props.juice))
})

const pct = computed(() => Math.round(fill.value * 100))

const onPress = (): void => {
  if (!ready.value) return
  emit('fever')
}
</script>

<template lang="pug">
  div.vial(:class="{ 'is-ready': ready, 'is-running': running, 'is-calm': calm }")
    //- The glass. `aria-hidden` because the button below carries the label and
    //- the value — a screen reader announcing a decorative tube is noise.
    div.vial__glass(aria-hidden="true")
      div.vial__fill(:style="{ height: pct + '%' }")
        div.vial__surface
      div.vial__shine
      //- Three tick marks, so a partly-full vial reads as a quantity rather
      //- than as a colour.
      div.vial__ticks
        span(v-for="i in 3" :key="i")

    button.vial__button(
      type="button"
      :disabled="!ready"
      :aria-label="running ? t('fever.running') : ready ? t('fever.ready') : t('fever.filling', { n: pct })"
      @click="onPress"
    )
      span.vial__button-shadow(aria-hidden="true")
      span.vial__button-body
        GameIcon.vial__button-icon(name="flame")
</template>

<style scoped lang="sass">
.vial
  display: flex
  flex-direction: column
  align-items: center
  gap: clamp(0.2rem, 1vmin, 0.4rem)
  pointer-events: auto

.vial__glass
  position: relative
  width: clamp(1.1rem, 4.4vmin, 1.7rem)
  height: clamp(5rem, 22vmin, 9rem)
  border: 2px solid rgba(255, 255, 255, 0.35)
  border-radius: 999px
  background-color: rgba(10, 6, 20, 0.82)
  overflow: hidden
  box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.6)

.vial__fill
  position: absolute
  inset: auto 0 0 0
  background-image: linear-gradient(180deg, #ff6eaa 0%, #ff3f86 45%, #b3006b 100%)
  transition: height 180ms ease-out

// The meniscus: a pale cap on the goo, which is what stops a coloured rectangle
// from reading as a progress bar.
.vial__surface
  position: absolute
  inset: 0 0 auto 0
  height: 0.4rem
  background-image: linear-gradient(180deg, rgba(255, 255, 255, 0.85), rgba(255, 255, 255, 0))
  border-radius: 999px

.vial__shine
  position: absolute
  top: 6%
  left: 18%
  width: 22%
  height: 62%
  border-radius: 999px
  background-image: linear-gradient(180deg, rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0))
  pointer-events: none

.vial__ticks
  position: absolute
  inset: 0
  display: flex
  flex-direction: column
  justify-content: space-evenly
  pointer-events: none

  span
    display: block
    height: 2px
    margin-inline: 22%
    background-color: rgba(255, 255, 255, 0.22)

.is-ready .vial__glass
  border-color: #ffd93c
  box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.6), 0 0 14px rgba(255, 217, 60, 0.8)

.is-running .vial__fill
  background-image: linear-gradient(180deg, #fff3b0 0%, #ffcd00 45%, #f7a000 100%)

// ─── The button ─────────────────────────────────────────────────────────────
//
// The same depth-plate construction as `FButton`, at a size that keeps a 44 px
// touch target on the smallest screen the game supports.

.vial__button
  position: relative
  display: inline-flex
  align-items: center
  justify-content: center
  width: clamp(2.75rem, 12vmin, 3.6rem)
  height: clamp(2.75rem, 12vmin, 3.6rem)
  min-width: 2.75rem
  min-height: 2.75rem
  padding: 0
  border: 0
  background: none
  cursor: pointer
  touch-action: manipulation
  -webkit-tap-highlight-color: transparent
  transition: transform 90ms ease-out, filter 90ms ease-out

  // Unavailable, not invisible. At 0.45 the ants walked straight through the
  // button on a busy board and the control stopped reading as a control; the
  // greyscale is what says "not yet", the opacity only softens it.
  &:disabled
    cursor: default
    opacity: 0.78
    filter: grayscale(0.85) brightness(0.72)

  &:active:not(:disabled)
    transform: translateY(2px) scale(0.94)

.vial__button-shadow
  position: absolute
  inset: 0
  translate: 0 3px
  border-radius: 999px
  background-color: #7a1f3a

.vial__button-body
  position: relative
  display: flex
  align-items: center
  justify-content: center
  width: 100%
  height: 100%
  border: 2px solid #0f1a30
  border-radius: 999px
  background-image: linear-gradient(to bottom, #ff8fb8, #d4145a)

.vial__button-icon
  width: 56%
  height: 56%
  color: #fff
  filter: drop-shadow(2px 2px 0 rgba(0, 0, 0, 0.75))

.is-ready .vial__button-body
  background-image: linear-gradient(to bottom, #fff3b0, #f7a000)

.is-ready:not(.is-calm) .vial__button
  animation: fever-bounce 0.6s infinite alternate
  filter: drop-shadow(0 0 10px rgba(255, 205, 0, 0.85))

.is-running .vial__button-body
  background-image: linear-gradient(to bottom, #ffe27a, #ff7a18)

@keyframes fever-bounce
  from
    translate: 0 0
  to
    translate: 0 -5px
</style>
