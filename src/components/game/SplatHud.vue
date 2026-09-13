<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import GameIcon from '@/components/icons/GameIcon.vue'

/**
 * ─── The top strip ──────────────────────────────────────────────────────────
 *
 * Four readouts and one rail, and every one of them earns its place by being
 * something the player CHANGES:
 *
 *   level    where they are — "2-7", the only text on the strip
 *   score    what they are building
 *   chain    the multiplier, with the 1.5 s window draining around it
 *   timer    what they are racing
 *
 * The rail under them is the level's own objective: bugs squished against the
 * quota, or the boss's health. One rail, because the player can only be trying
 * to finish one thing at a time.
 *
 * ── Why the chain badge is the biggest thing here ──
 *
 * The chain is the game's whole skill expression, and it is invisible in the
 * fiction — nothing on the floor tells you what your multiplier is. So it gets
 * the loudest treatment on the strip: it grows with the rung, it wears the
 * rung's own colour, and the ring around it drains in real time so a player can
 * see the window closing without reading a number.
 *
 * Everything is `clamp()` / `vmin`, so one layout survives a 320 px phone, a
 * landscape phone, a tablet and a 4K monitor without a single breakpoint.
 */

interface Props {
  /** "2-7". */
  label: string
  score: number
  /** Chain length, and the multiplier it has earned. */
  chain: number
  mult: number
  /** 0..1 of the chain window left — the draining ring. */
  urgency: number
  /** Seconds. */
  time: number
  /** 0..1 along the level's own objective. */
  progress: number
  /** Bugs squished and the quota, when the level has one. */
  squished: number
  quota: number
  /** The player's best on this level, 0..3, so the strip can show what is left
   *  to earn on a replay. */
  stars: number
}

const props = defineProps<Props>()
const { t } = useI18n()

/** Under ten seconds the clock turns red and starts breathing. Ten rather than
 *  five: a six-year-old needs long enough to change what they are doing. */
const URGENT_S = 10

const timeText = computed(() => {
  const s = Math.max(0, Math.ceil(props.time))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
})

const urgent = computed(() => props.time <= URGENT_S)

/**
 * The chain badge's tier, which decides its colour and how big it is.
 *
 * Keyed off the MULTIPLIER rather than the count, so it steps exactly when the
 * ladder does and the badge's jump is the same event as the comic word's.
 */
const tier = computed(() => {
  if (props.mult >= 20) return 'ultra'
  if (props.mult >= 8) return 'splat'
  if (props.mult >= 3) return 'crunch'
  return 'squish'
})

/** Ring geometry, as stroke-dashoffset over a 100-unit circumference. */
const dash = computed(() => `${Math.max(0, Math.min(1, props.urgency)) * 100} 100`)

const scoreText = computed(() => props.score.toLocaleString())
</script>

<template lang="pug">
  div.hud
    div.hud__row
      //- The place. Small, quiet, and the only word up here.
      div.hud__chip.is-level
        span.hud__level {{ label }}
        span.hud__stars(v-if="stars > 0" :aria-label="t('result.starsEarned', { n: stars })")
          GameIcon.hud__star(v-for="i in stars" :key="i" name="star")

      //- The score. The widest thing on the strip, so it owns the middle.
      div.hud__score
        span.sr-only {{ t('hud.score') }}
        span.hud__score-value {{ scoreText }}

      //- The clock.
      div.hud__chip.is-time(:class="{ 'is-urgent': urgent }")
        GameIcon.hud__chip-icon(name="clock")
        span.sr-only {{ t('hud.time') }}
        span.hud__chip-value {{ timeText }}

    //- The chain. Absolutely positioned under the row so a badge that grows to
    //- twice its size never moves the score beside it.
    Transition(name="chain")
      div.hud__chain(v-if="chain > 1" :class="`tier-${tier}`")
        svg.hud__chain-ring(viewBox="0 0 36 36" aria-hidden="true")
          circle.hud__chain-track(cx="18" cy="18" r="15.9155")
          circle.hud__chain-fill(cx="18" cy="18" r="15.9155" :stroke-dasharray="dash")
        span.hud__chain-value
          span.hud__chain-x ×
          | {{ mult }}
        span.sr-only {{ t('hud.chain', { n: chain }) }}

    //- The objective rail.
    div.hud__rail
      div.hud__rail-fill(:style="{ width: Math.round(Math.max(0, Math.min(1, progress)) * 100) + '%' }")
      span.hud__rail-text(v-if="quota > 0") {{ squished }}/{{ quota }}
</template>

<style scoped lang="sass">
.hud
  position: relative
  display: flex
  flex-direction: column
  gap: clamp(0.2rem, 1vw, 0.4rem)
  width: 100%
  min-width: 0

.hud__row
  display: flex
  align-items: center
  justify-content: space-between
  gap: clamp(0.25rem, 1.6vw, 0.6rem)
  min-width: 0

.hud__chip
  display: inline-flex
  align-items: center
  gap: 0.3em
  flex: 0 0 auto
  min-height: 1.6rem
  padding: clamp(0.12rem, 0.8vw, 0.3rem) clamp(0.4rem, 2vw, 0.7rem)
  border: 2px solid rgba(255, 255, 255, 0.2)
  border-radius: 999px
  background-color: rgba(12, 8, 22, 0.62)
  backdrop-filter: blur(3px)
  color: #fff
  font-weight: 900
  line-height: 1
  font-size: clamp(0.66rem, 3vmin, 1rem)
  text-shadow: 2px 2px 0 rgba(0, 0, 0, 0.85)

.hud__chip-icon
  width: 1.05em
  height: 1.05em
  flex: 0 0 auto
  color: #ffd93c

.hud__level
  letter-spacing: 0.04em

.hud__stars
  display: inline-flex
  gap: 0.1em
  margin-left: 0.2em

.hud__star
  width: 0.85em
  height: 0.85em
  color: #ffd93c

.is-time.is-urgent
  border-color: rgba(255, 90, 110, 0.85)
  color: #ffd9dd
  animation: hud-urgent 1s ease-in-out infinite

  .hud__chip-icon
    color: #ff5a6e

@keyframes hud-urgent
  0%, 100%
    background-color: rgba(80, 10, 24, 0.7)
  50%
    background-color: rgba(150, 20, 40, 0.8)

.hud__score
  flex: 1 1 auto
  min-width: 0
  text-align: center

.hud__score-value
  display: block
  color: #fff
  font-weight: 900
  line-height: 1
  font-size: clamp(1rem, 5.2vmin, 2rem)
  letter-spacing: 0.01em
  white-space: nowrap
  overflow: hidden
  text-overflow: ellipsis
  text-shadow: 0.13em 0.13em 0 #000, -0.045em -0.045em 0 #000, 0.045em -0.045em 0 #000, -0.045em 0.045em 0 #000, 0.045em 0.045em 0 #000

// ─── The chain badge ────────────────────────────────────────────────────────
//
// Hung off the strip's own box rather than placed in the row, so growing it by
// half does not move the score. Centred, because the eye is in the middle of
// the screen and this is the readout the player most wants in the corner of it.

.hud__chain
  position: absolute
  top: 100%
  left: 50%
  translate: -50% 0.2rem
  display: inline-flex
  align-items: center
  justify-content: center
  width: clamp(2.4rem, 11vmin, 3.6rem)
  height: clamp(2.4rem, 11vmin, 3.6rem)
  pointer-events: none

.hud__chain-ring
  position: absolute
  inset: 0
  width: 100%
  height: 100%
  rotate: -90deg

.hud__chain-track
  fill: rgba(12, 8, 22, 0.66)
  stroke: rgba(255, 255, 255, 0.18)
  stroke-width: 3

.hud__chain-fill
  fill: none
  stroke: currentColor
  stroke-width: 3.4
  stroke-linecap: round
  transition: stroke-dasharray 90ms linear

.hud__chain-value
  position: relative
  color: #fff
  font-weight: 900
  line-height: 1
  font-size: clamp(0.8rem, 3.8vmin, 1.3rem)
  text-shadow: 2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000

.hud__chain-x
  font-size: 0.75em
  opacity: 0.85

// The four tiers, matching `uiArt.WORD_TONE` — the badge and the word that pops
// out of the kill are the same object said twice, so they must never disagree.
.tier-squish
  color: #ff6eaa
.tier-crunch
  color: #ffd93c
.tier-splat
  color: #ff9f2e
  scale: 1.08
.tier-ultra
  color: #ff5d5d
  scale: 1.18
  animation: chain-throb 0.5s ease-in-out infinite alternate

@keyframes chain-throb
  from
    filter: drop-shadow(0 0 0 rgba(255, 93, 93, 0))
  to
    filter: drop-shadow(0 0 10px rgba(255, 93, 93, 0.9))

.chain-enter-active
  transition: opacity 140ms ease-out, scale 220ms cubic-bezier(0.18, 0.89, 0.32, 1.28)
.chain-leave-active
  transition: opacity 180ms ease-in, scale 180ms ease-in
.chain-enter-from, .chain-leave-to
  opacity: 0
  scale: 0.6

// ─── The objective rail ─────────────────────────────────────────────────────

.hud__rail
  position: relative
  width: 100%
  height: clamp(0.62rem, 2.6vmin, 0.95rem)
  border: 2px solid rgba(255, 255, 255, 0.22)
  border-radius: 999px
  background-color: rgba(12, 8, 22, 0.6)
  overflow: hidden

.hud__rail-fill
  position: absolute
  inset: 0 auto 0 0
  border-radius: 999px
  background-image: linear-gradient(90deg, #6ee7a0, #ffd93c)
  transition: width 160ms ease-out

.hud__rail-text
  position: absolute
  inset: 0
  display: flex
  align-items: center
  justify-content: center
  color: #fff
  font-weight: 900
  font-size: clamp(0.46rem, 1.9vmin, 0.66rem)
  line-height: 1
  letter-spacing: 0.05em
  text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.9)

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
