<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RunPhase } from '@/use/useSurvivalGame'
import GameIcon from '@/components/icons/GameIcon.vue'

/**
 * The run readout.
 *
 * Three numbers and one rail, and nothing else — a runner is played with the
 * eyes on the lane, so anything in the HUD that cannot be read in a quarter of
 * a second is worse than not being there:
 *
 *   STAGE   — where you are (and the best you have ever done, small, beside it)
 *   SQUAD   — how many of you there are. The number the whole game is about.
 *   DMG     — how hard each of you hits, so a crate pickup has a visible home.
 *   RAIL    — how far through the stage you are, with the boss skull at the end
 *
 * During the boss fight the rail turns into the boss's health, because at that
 * point "how far along am I" and "how dead is it" are the same question.
 */

interface Props {
  stage: number
  best: number
  /** 0..1 along the stage. */
  progress: number
  squad: number
  damage: number
  /** Live shots/second per shooter — the stat rate crates raise. */
  fireRate: number
  phase: RunPhase
  /** 0..1 boss health; only read while `phase === 'boss'`. */
  bossHp: number
  /** A miniboss is on the field. */
  elite: boolean
  /** 0..1 miniboss health. */
  eliteHp: number
  /** Stages cleared in a row — the autobalancer's handicap. */
  challenge: number
}

const props = defineProps<Props>()
const { t } = useI18n()

const isBoss = computed(() => props.phase === 'boss')
const railPct = computed(() =>
  Math.round(Math.max(0, Math.min(1, num(isBoss.value ? props.bossHp : props.progress))) * 100)
)
const elitePct = computed(() => Math.round(Math.max(0, Math.min(1, num(props.eliteHp)) * 100)))

/**
 * Every number that reaches this HUD goes through here first.
 *
 * A readout is the one place in a game where a bad number is guaranteed to be
 * seen: a `NaN` in the fire-rate pill reads as a broken game even when the
 * simulation underneath is fine, and it only takes one undefined prop (a
 * hot-reloaded parent, a prop renamed on one side of a refactor) to produce
 * one. The HUD refusing to render nonsense is cheaper than every future caller
 * remembering not to send it.
 */
const num = (v: number): number => (Number.isFinite(v) ? v : 0)

/** One decimal, because a rate crate moves this by 0.55 and an integer readout
 *  would make half the pickups look like they did nothing. */
const rateLabel = computed(() => (Math.round(num(props.fireRate) * 10) / 10).toFixed(1))
const squadLabel = computed(() => Math.max(0, Math.round(num(props.squad))))
/** Damage is fractional now (the shop hands out +0.4 a level), so the pill
 *  shows a decimal only when there is one — "3" stays "3", "1.4" stays "1.4". */
const damageLabel = computed(() => {
  const v = Math.max(0, num(props.damage))
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
})
</script>

<template lang="pug">
  div.run-hud
    div.run-hud__row
      div.run-hud__stage
        span.run-hud__stage-label {{ t('hud.stage', { n: stage }) }}
        span.run-hud__best(v-if="best > 0") {{ t('hud.best', { n: best }) }}

      div.run-hud__stats
        div.run-hud__chip.is-squad
          GameIcon.run-hud__icon(name="squad")
          span.run-hud__value {{ squadLabel }}
        div.run-hud__chip.is-damage
          GameIcon.run-hud__icon(name="bolt")
          span.run-hud__value {{ damageLabel }}
        //- Fire rate is the stat a run has to EARN, so it gets equal billing
        //- with the two it multiplies.
        //- The autobalancer, made visible. A handicap the player cannot see is
        //- indistinguishable from the game being inconsistent — and a streak is
        //- a thing worth being proud of, so it is shown as a reward rather than
        //- as a warning. Appears only once it is actually doing something.
        div.run-hud__chip.is-streak(v-if="challenge > 0")
          GameIcon.run-hud__icon(name="flame")
          span.run-hud__value {{ challenge }}
        div.run-hud__chip.is-rate
          GameIcon.run-hud__icon(name="rate")
          span.run-hud__value {{ rateLabel }}

    div.run-hud__rail(:class="{ 'is-boss': isBoss }")
      //- The CHIP. A second fill on the same number with a slower, delayed
      //- transition, so a hit leaves a pale streak behind the red that catches
      //- up a moment later. It is the single cheapest thing that makes a health
      //- bar read as a health bar rather than as a progress rail — and it is
      //- the only part of the bar that says HOW HARD you just hit, which a
      //- smoothly shrinking edge cannot.
      div.run-hud__rail-chip(v-if="isBoss" :style="{ width: railPct + '%' }")
      div.run-hud__rail-fill(:style="{ width: railPct + '%' }")
      //- Notches and a glass sheen, painted over the fill. Both are gradients on
      //- an empty element rather than markup: a boss bar wants segmenting so a
      //- quarter is readable at a glance, and neither should cost a DOM node.
      div.run-hud__rail-ticks(v-if="isBoss")
      div.run-hud__rail-sheen
      GameIcon.run-hud__rail-skull(v-if="isBoss" name="skull")
      span.run-hud__rail-text(v-if="isBoss") {{ t('hud.boss') }}
      GameIcon.run-hud__rail-icon(v-else name="skull")

    //- Miniboss bar. Sits UNDER the stage rail rather than replacing it: the
    //- player still needs to know how far through the stage they are while
    //- they fight one, and a mid-stage elite that hijacked the whole rail read
    //- as "the boss is here" the first time it was tried.
    Transition(name="elite")
      div.run-hud__elite(v-if="elite && !isBoss")
        div.run-hud__elite-chip(:style="{ width: elitePct + '%' }")
        div.run-hud__elite-fill(:style="{ width: elitePct + '%' }")
        div.run-hud__elite-ticks
        div.run-hud__rail-sheen
        GameIcon.run-hud__elite-skull(name="skull")
        span.run-hud__elite-text {{ t('hud.miniboss') }}
</template>

<style scoped lang="sass">
.run-hud
  display: flex
  flex-direction: column
  gap: clamp(0.2rem, 1.1vw, 0.4rem)
  width: 100%
  pointer-events: none

.run-hud__row
  display: flex
  align-items: flex-start
  justify-content: space-between
  gap: clamp(0.3rem, 2vw, 0.75rem)

.run-hud__stage
  display: flex
  flex-direction: column
  align-items: flex-start
  gap: 0.1rem

.run-hud__stage-label
  color: #fff
  font-weight: 900
  text-transform: uppercase
  font-size: clamp(0.8rem, 4vw, 1.25rem)
  line-height: 1
  text-shadow: 2px 2px 0 #000, 0 0 12px rgba(120, 200, 255, 0.35)

.run-hud__best
  color: #ffd93c
  font-weight: 900
  text-transform: uppercase
  font-size: clamp(0.52rem, 2.4vw, 0.72rem)
  line-height: 1
  text-shadow: 2px 2px 0 #000

.run-hud__stats
  display: flex
  align-items: center
  gap: clamp(0.2rem, 1.4vw, 0.45rem)

.run-hud__chip
  display: inline-flex
  align-items: center
  gap: 0.2em
  padding: clamp(0.12rem, 0.9vw, 0.25rem) clamp(0.3rem, 1.8vw, 0.6rem)
  border: 2px solid rgba(0, 0, 0, 0.55)
  border-radius: 999px
  background-color: rgba(10, 16, 30, 0.72)
  backdrop-filter: blur(3px)

  &.is-squad
    color: #8fd6ff
  &.is-damage
    color: #ffca6b
  &.is-rate
    color: #a6ff9c
  &.is-streak
    color: #ff9a4a
    border-color: rgba(255, 154, 74, 0.55)

// Nested rather than written flat, and that is load-bearing: `GameIcon`'s own
// scoped rule is `.game-icon[data-v-…]` — one class plus one attribute, exactly
// the same specificity a flat `.run-hud__icon[data-v-…]` would have. On a tie the
// winner is whichever stylesheet the bundler happened to emit last. Nesting
// adds the ancestor class and settles it.
.run-hud__chip .run-hud__icon
  width: clamp(0.75rem, 3.4vw, 1rem)
  height: clamp(0.75rem, 3.4vw, 1rem)
  flex: 0 0 auto

.run-hud__value
  color: #fff
  font-weight: 900
  font-size: clamp(0.72rem, 3.4vw, 1rem)
  line-height: 1
  text-shadow: 2px 2px 0 #000

// ─── Progress rail ──────────────────────────────────────────────────────────
//
// Deliberately thin. It answers "am I nearly there?" without ever competing
// with the lane for attention — and it is the only place the boss is announced
// before it walks on, which is what stops the fight feeling like an ambush.

.run-hud__rail
  position: relative
  height: clamp(0.5rem, 2.2vw, 0.7rem)
  border: 2px solid rgba(0, 0, 0, 0.6)
  border-radius: 999px
  background-color: rgba(10, 16, 30, 0.7)
  overflow: hidden

  // A BOSS BAR, not a thicker progress rail. Taller, squarer, and ringed in a
  // warm rim so it stops reading as HUD furniture the moment the fight starts —
  // the thin blue rail it replaces was accurate and completely unalarming.
  &.is-boss
    height: clamp(1.05rem, 4.6vw, 1.5rem)
    border-radius: 0.28rem
    border-color: rgba(0, 0, 0, 0.75)
    background-color: rgba(30, 6, 8, 0.85)
    box-shadow: inset 0 0 0 1px rgba(255, 120, 90, 0.35), 0 0 0.7rem rgba(190, 20, 20, 0.3)

.run-hud__rail-fill
  position: absolute
  inset: 0 auto 0 0
  border-radius: 999px
  background-image: linear-gradient(to right, #4fd0ff, #a0f0ff)
  transition: width 120ms linear

  // RED, top-lit. The old red-to-orange ramp ran left to right, which reads as
  // a fuel gauge; health reads as a lit tube, so the ramp runs top to bottom
  // with the hot band across the middle.
  .is-boss &
    border-radius: 0.18rem
    background-image: linear-gradient(to bottom, #ff8a72 0%, #ec1f22 42%, #a20d14 100%)
    box-shadow: inset 0 -0.12rem 0 rgba(0, 0, 0, 0.35)
    transition: width 90ms linear

// The chip: the same number, arriving late.
.run-hud__rail-chip
  position: absolute
  inset: 0 auto 0 0
  border-radius: 0.18rem
  background-image: linear-gradient(to bottom, #fff0e2, #ffb9a4)
  opacity: 0.9
  transition: width 620ms cubic-bezier(0.22, 0.61, 0.36, 1) 130ms

.run-hud__rail-ticks
  position: absolute
  inset: 0
  pointer-events: none
  // Quarters, so "half gone" is a thing the eye can check rather than estimate.
  background-image: repeating-linear-gradient(to right, rgba(0, 0, 0, 0) 0 calc(25% - 2px), rgba(0, 0, 0, 0.55) calc(25% - 2px) 25%)

.run-hud__rail-sheen
  position: absolute
  inset: 0
  pointer-events: none
  border-radius: inherit
  background-image: linear-gradient(to bottom, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 255, 0.06) 45%, rgba(0, 0, 0, 0.22) 100%)

.run-hud__rail .run-hud__rail-skull
  position: absolute
  left: 0.2rem
  top: 50%
  translate: 0 -50%
  width: clamp(0.7rem, 3vw, 1rem)
  height: clamp(0.7rem, 3vw, 1rem)
  color: #ffd9c8
  filter: drop-shadow(0 1px 0 rgba(0, 0, 0, 0.8))

// Nested for the same specificity reason as `.run-hud__icon` above.
.run-hud__rail .run-hud__rail-icon
  position: absolute
  right: 0.1rem
  top: 50%
  translate: 0 -50%
  width: clamp(0.6rem, 2.6vw, 0.85rem)
  height: clamp(0.6rem, 2.6vw, 0.85rem)
  color: rgba(255, 255, 255, 0.75)

.run-hud__rail-text
  position: absolute
  inset: 0
  z-index: 2
  display: flex
  align-items: center
  justify-content: center
  color: #fff
  font-weight: 900
  text-transform: uppercase
  letter-spacing: 0.1em
  font-size: clamp(0.45rem, 2vw, 0.65rem)
  text-shadow: 2px 2px 0 rgba(0, 0, 0, 0.8)

// ─── Miniboss bar ───────────────────────────────────────────────────────────

.run-hud__elite
  position: relative
  height: clamp(0.85rem, 3.8vw, 1.15rem)
  border: 2px solid rgba(0, 0, 0, 0.72)
  border-radius: 0.24rem
  background-color: rgba(26, 8, 10, 0.85)
  box-shadow: inset 0 0 0 1px rgba(255, 140, 110, 0.28), 0 0 0.5rem rgba(170, 25, 25, 0.26)
  overflow: hidden

.run-hud__elite-fill
  position: absolute
  inset: 0 auto 0 0
  border-radius: 0.14rem
  // The same red as the boss, one step cooler and darker: an elite has to read
  // as the same KIND of thing without competing with the fight at the end.
  background-image: linear-gradient(to bottom, #ff7d63 0%, #d81f22 44%, #8e0d12 100%)
  box-shadow: inset 0 -0.1rem 0 rgba(0, 0, 0, 0.32)
  transition: width 90ms linear

.run-hud__elite-chip
  position: absolute
  inset: 0 auto 0 0
  border-radius: 0.14rem
  background-image: linear-gradient(to bottom, #ffeadf, #ffb49c)
  opacity: 0.88
  transition: width 560ms cubic-bezier(0.22, 0.61, 0.36, 1) 120ms

.run-hud__elite-ticks
  position: absolute
  inset: 0
  pointer-events: none
  background-image: repeating-linear-gradient(to right, rgba(0, 0, 0, 0) 0 calc(33.333% - 2px), rgba(0, 0, 0, 0.5) calc(33.333% - 2px) 33.333%)

.run-hud__elite .run-hud__elite-skull
  position: absolute
  left: 0.18rem
  top: 50%
  translate: 0 -50%
  width: clamp(0.6rem, 2.6vw, 0.82rem)
  height: clamp(0.6rem, 2.6vw, 0.82rem)
  color: #ffd2c2
  filter: drop-shadow(0 1px 0 rgba(0, 0, 0, 0.8))

.run-hud__elite-text
  position: absolute
  inset: 0
  z-index: 2
  display: flex
  align-items: center
  justify-content: center
  color: #fff
  font-weight: 900
  text-transform: uppercase
  letter-spacing: 0.08em
  font-size: clamp(0.42rem, 1.9vw, 0.6rem)
  text-shadow: 2px 2px 0 rgba(0, 0, 0, 0.85)

.elite-enter-active, .elite-leave-active
  transition: opacity 200ms ease, transform 200ms ease
.elite-enter-from, .elite-leave-to
  opacity: 0
  transform: scaleY(0.4)
</style>
