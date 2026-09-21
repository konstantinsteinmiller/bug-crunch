<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import GameIcon from '@/components/icons/GameIcon.vue'

/**
 * ─── The Juice vial ─────────────────────────────────────────────────────────
 *
 * One readout, three states, and the whole of the GDD's §6.2.
 *
 *   FILLING   a glass vial down the side of the screen, filling with the goo of
 *             whatever has been squished.
 *   READY     the vial is full and the glass flares — for the one frame before
 *             the game spends it. Nothing to press.
 *   RUNNING   the vial empties on a ten-second clock while the frenzy runs, so
 *             the player can see exactly how long they have left.
 *
 * ── Why there is no longer a button ──
 *
 * There was one: the vial filled, a flame lit up under it, and pressing it
 * bought the frenzy. Four of five blind testers never worked out what it was
 * for — the thirteen-year-old read the hint, went looking, and reported that it
 * "pointed at nothing obvious"; the seven-year-old only found out when her shoe
 * suddenly went giant. A control that has to be explained to be used, in a game
 * whose whole tutorial is wordless, is a control the game is better off
 * spending itself. Fever now fires the moment the vial is full (see
 * `feverArmed`), and the glass is what tells the story: filling, flare, drain.
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
const { t } = useI18n()

const running = computed(() => props.feverMs > 0)
const ready = computed(() => !running.value && props.juice >= 1)

/** What the glass shows: the vial while filling, the clock while running. */
const fill = computed(() => {
  if (running.value) return Math.max(0, Math.min(1, props.feverMs / Math.max(1, props.feverTotal)))
  return Math.max(0, Math.min(1, props.juice))
})

const pct = computed(() => Math.round(fill.value * 100))
</script>

<template lang="pug">
  div.vial(
    :class="{ 'is-ready': ready, 'is-running': running, 'is-calm': calm }"
    role="img"
    :aria-label="running ? t('fever.running') : ready ? t('fever.ready') : t('fever.filling', { n: pct })"
  )
    div.vial__glass(aria-hidden="true")
      div.vial__fill(:style="{ height: pct + '%' }")
        div.vial__surface
      div.vial__shine
      //- Three tick marks, so a partly-full vial reads as a quantity rather
      //- than as a colour.
      div.vial__ticks
        span(v-for="i in 3" :key="i")

    //- The flame is a MARK, not a control: it lights as the vial flares and
    //- rides the frenzy out, so the player learns what the full glass buys.
    div.vial__flame(aria-hidden="true")
      GameIcon.vial__flame-icon(name="flame")
</template>

<style scoped lang="sass">
.vial
  display: flex
  flex-direction: column
  align-items: center
  gap: clamp(0.2rem, 1vmin, 0.4rem)
  // A readout with nothing to press, so it lets the board have every tap that
  // lands on it — a bug walking behind the glass is still stompable.
  pointer-events: none

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

// ─── The flame mark ─────────────────────────────────────────────────────────
//
// What used to be a button, and the first cut of this kept the button's round
// plate and border — so two testers tapped it, nothing happened, and it went
// back on the list of things nobody understood. A control that cannot be
// pressed must not be SHAPED like one. So the plate is gone: what is left is a
// bare flame under the glass, the way a pilot light sits under a burner. It is
// dim while the vial fills, blazes when the vial flares, and burns while the
// frenzy runs.

.vial__flame
  position: relative
  display: inline-flex
  align-items: center
  justify-content: center
  width: clamp(1.6rem, 6.5vmin, 2.1rem)
  height: clamp(1.6rem, 6.5vmin, 2.1rem)
  // Dim, not invisible: an unlit pilot light still has to be SEEN, or the
  // player meets the flame for the first time in the same instant it fires and
  // learns nothing from it. Checked against the palest floor in the game (the
  // floured board) and the darkest (the arcade grid) — the ink outline is what
  // carries it on both.
  opacity: 0.72
  transition: opacity 140ms ease-out, filter 140ms ease-out, scale 140ms ease-out

.vial__flame-icon
  width: 100%
  height: 100%
  // Near-white with an ink outline, NOT a warm grey: the first cut was tinted
  // #d8c6ae, which is within a shade of the picnic floors it sits on, and the
  // lamp disappeared into the blanket. The outline is what makes one colour
  // work on all forty floors — bright against the attic and the arcade, dark
  // edged against the paper and the floured board.
  color: #f2e7d5
  filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.9)) drop-shadow(1px 2px 0 rgba(0, 0, 0, 0.8))

.is-ready .vial__flame,
.is-running .vial__flame
  opacity: 1

.is-ready .vial__flame-icon
  color: #ffd24a
  filter: drop-shadow(0 0 10px rgba(255, 205, 0, 0.95))

.is-ready:not(.is-calm) .vial__flame
  animation: fever-flare 0.45s ease-out

.is-running .vial__flame-icon
  color: #ff9c2a
  filter: drop-shadow(0 0 8px rgba(255, 140, 24, 0.85))

@keyframes fever-flare
  from
    scale: 1
  50%
    scale: 1.35
  to
    scale: 1
</style>
