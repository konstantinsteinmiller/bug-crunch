<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import GameIcon from '@/components/icons/GameIcon.vue'

/**
 * ─── The boss bar ───────────────────────────────────────────────────────────
 *
 * ONE bar for all three phases, with the phase boundaries drawn on it as ticks.
 *
 * Three separate bars would read as three fights, and the whole point of the
 * phase structure is that it is one fight that keeps changing. The ticks are
 * what let the player SEE the next change coming — which turns a phase
 * transition from a thing that happens to them into a thing they were counting
 * down to.
 *
 * Under the bar sits the phase TELL: one short line naming what the boss is
 * doing right now ("stomp the eggs", "slam the charge"). It is the one piece of
 * instruction in the game that appears while something is actively trying to
 * beat the player, so it is short, it is high-contrast, and it changes only on a
 * phase boundary — never on a beat.
 */

interface Props {
  show: boolean
  /** 0..1 remaining. */
  hp: number
  /** Where the phase boundaries sit on the bar, 0..1 from the left. */
  ticks: readonly number[]
  /** i18n key suffix for the boss's name. */
  name: string
  /** i18n key suffix for the current phase's tell. */
  tell: string | null
  /** 0-based phase index, for the pip row. */
  phase: number
  phases: number
}

const props = defineProps<Props>()
const { t } = useI18n()

const pct = computed(() => Math.round(Math.max(0, Math.min(1, props.hp)) * 100))

/** Under a fifth the bar goes hot and starts breathing — the one moment the
 *  game tells a child "you are about to win" without a word. */
const nearly = computed(() => props.hp > 0 && props.hp <= 0.2)
</script>

<template lang="pug">
  Transition(name="boss-bar")
    div.boss-bar(v-if="show" aria-live="polite")
      div.boss-bar__head
        GameIcon.boss-bar__icon(name="skull")
        span.boss-bar__name {{ t(`bosses.${name}`) }}
        span.boss-bar__pips
          span.boss-bar__pip(
            v-for="i in phases"
            :key="i"
            :class="{ 'is-done': i - 1 < phase, 'is-live': i - 1 === phase }"
          )

      div.boss-bar__rail(:class="{ 'is-nearly': nearly }")
        div.boss-bar__fill(:style="{ width: pct + '%' }")
        span.boss-bar__tick(
          v-for="(tick, i) in ticks"
          :key="i"
          :style="{ left: Math.round(tick * 100) + '%' }"
          aria-hidden="true"
        )

      Transition(name="boss-tell")
        div.boss-bar__tell(v-if="tell" :key="tell") {{ t(`boss.tell.${tell}`) }}
</template>

<style scoped lang="sass">
.boss-bar
  display: flex
  flex-direction: column
  align-items: center
  gap: clamp(0.15rem, 0.9vmin, 0.32rem)
  width: min(30rem, 94%)
  pointer-events: none

.boss-bar__head
  display: flex
  align-items: center
  gap: clamp(0.2rem, 1.2vmin, 0.45rem)
  max-width: 100%

.boss-bar__icon
  flex: 0 0 auto
  width: clamp(0.8rem, 3.2vmin, 1.15rem)
  height: clamp(0.8rem, 3.2vmin, 1.15rem)
  color: #ff5a6e

.boss-bar__name
  min-width: 0
  color: #ffd9dd
  font-weight: 900
  text-transform: uppercase
  letter-spacing: 0.06em
  line-height: 1.1
  font-size: clamp(0.58rem, 2.6vmin, 0.9rem)
  white-space: nowrap
  overflow: hidden
  text-overflow: ellipsis
  text-shadow: 2px 2px 0 rgba(0, 0, 0, 0.9)

.boss-bar__pips
  display: inline-flex
  gap: 0.2em
  flex: 0 0 auto

.boss-bar__pip
  display: block
  width: clamp(0.3rem, 1.3vmin, 0.45rem)
  height: clamp(0.3rem, 1.3vmin, 0.45rem)
  border: 1px solid rgba(255, 255, 255, 0.5)
  border-radius: 999px

  &.is-done
    background-color: rgba(255, 255, 255, 0.35)
  &.is-live
    background-color: #ff5a6e
    border-color: #ffd9dd
    box-shadow: 0 0 8px rgba(255, 90, 110, 0.9)

.boss-bar__rail
  position: relative
  width: 100%
  height: clamp(0.5rem, 2.2vmin, 0.85rem)
  border: 2px solid rgba(255, 255, 255, 0.28)
  border-radius: 999px
  background-color: rgba(12, 8, 22, 0.7)
  overflow: hidden

.boss-bar__fill
  position: absolute
  inset: 0 auto 0 0
  border-radius: 999px
  background-image: linear-gradient(90deg, #7a0014, #ff5a6e 55%, #ffb3c0)
  transition: width 220ms ease-out

.boss-bar__tick
  position: absolute
  top: 0
  bottom: 0
  width: 2px
  translate: -1px 0
  background-color: rgba(255, 255, 255, 0.65)

.is-nearly
  animation: boss-nearly 0.9s ease-in-out infinite

  .boss-bar__fill
    background-image: linear-gradient(90deg, #ff8a00, #ffd93c)

@keyframes boss-nearly
  0%, 100%
    box-shadow: 0 0 0 rgba(255, 217, 60, 0)
  50%
    box-shadow: 0 0 12px rgba(255, 217, 60, 0.85)

.boss-bar__tell
  padding: clamp(0.12rem, 0.9vmin, 0.28rem) clamp(0.45rem, 2.4vmin, 0.85rem)
  border: 2px solid rgba(255, 217, 60, 0.55)
  border-radius: 999px
  background-color: rgba(12, 8, 22, 0.78)
  color: #fff
  font-weight: 900
  text-align: center
  line-height: 1.15
  font-size: clamp(0.56rem, 2.5vmin, 0.85rem)
  text-shadow: 2px 2px 0 rgba(0, 0, 0, 0.9)

.boss-bar-enter-active, .boss-bar-leave-active
  transition: opacity 260ms ease-out, translate 260ms ease-out
.boss-bar-enter-from, .boss-bar-leave-to
  opacity: 0
  translate: 0 -0.5rem

.boss-tell-enter-active, .boss-tell-leave-active
  transition: opacity 200ms ease-out, scale 200ms ease-out
.boss-tell-enter-from, .boss-tell-leave-to
  opacity: 0
  scale: 0.9
.boss-tell-leave-active
  position: absolute
</style>
