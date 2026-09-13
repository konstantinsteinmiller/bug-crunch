<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import ObjectiveList from '@/components/game/ObjectiveList.vue'
import GameIcon from '@/components/icons/GameIcon.vue'
import type { ObjectiveTriple, RunTally } from '@/game/stars'

/**
 * ─── The level card ─────────────────────────────────────────────────────────
 *
 * Rides over the first second and a half of a level: the world's name, the
 * level's number, and the three things worth a star.
 *
 * It is deliberately NOT dismissable and deliberately has no button. There is
 * nothing to decide here — the level has already started underneath it, the
 * board is already filling, and a player who ignores the card entirely has lost
 * nothing. That is the whole design: a card you must acknowledge is a stop, and
 * a hybrid-casual game cannot afford a stop at second zero.
 *
 * On a boss level the objective strip is replaced by the boss's name, because
 * "clear the quota" is not what is about to happen and a list that says so
 * would be the card contradicting the fight.
 */

interface Props {
  show: boolean
  /** "2-7". */
  label: string
  /** i18n key suffix for the world — `worlds.<theme>`. */
  theme: string
  objectives: ObjectiveTriple
  tally: RunTally
  quota: number
  met: readonly [boolean, boolean, boolean]
  /** The boss's i18n key suffix on a boss level, else null. */
  boss: string | null
}

defineProps<Props>()
const { t } = useI18n()
</script>

<template lang="pug">
  Transition(name="level-banner")
    div.level-banner(v-if="show" aria-live="polite")
      div.level-banner__card
        span.level-banner__world {{ t(`worlds.${theme}`) }}
        span.level-banner__label {{ label }}

        div.level-banner__boss(v-if="boss")
          GameIcon.level-banner__boss-icon(name="skull")
          span.level-banner__boss-name {{ t(`bosses.${boss}`) }}

        ObjectiveList.level-banner__objectives(
          v-else
          :objectives="objectives"
          :tally="tally"
          :quota="quota"
          :met="met"
          compact
        )
</template>

<style scoped lang="sass">
.level-banner
  position: absolute
  inset: 0
  display: flex
  align-items: center
  justify-content: center
  padding: clamp(0.75rem, 4vmin, 2rem)
  pointer-events: none
  z-index: 24

.level-banner__card
  display: flex
  flex-direction: column
  align-items: center
  gap: clamp(0.25rem, 1.4vmin, 0.6rem)
  width: min(28rem, 92vw)
  padding: clamp(0.6rem, 3vmin, 1.2rem) clamp(0.8rem, 4vmin, 1.6rem)
  border: 3px solid rgba(255, 255, 255, 0.22)
  border-radius: clamp(0.8rem, 3.4vmin, 1.6rem)
  background-color: rgba(10, 6, 20, 0.78)
  backdrop-filter: blur(6px)
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.6)

.level-banner__world
  color: #ffd93c
  font-weight: 900
  text-transform: uppercase
  letter-spacing: 0.12em
  line-height: 1.1
  text-align: center
  font-size: clamp(0.62rem, 3vmin, 0.95rem)
  text-shadow: 2px 2px 0 rgba(0, 0, 0, 0.9)

.level-banner__label
  color: #fff
  font-weight: 900
  line-height: 1
  font-size: clamp(1.8rem, 10vmin, 3.6rem)
  letter-spacing: 0.02em
  text-shadow: 4px 4px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000

.level-banner__objectives
  margin-top: clamp(0.2rem, 1.2vmin, 0.5rem)

.level-banner__boss
  display: inline-flex
  align-items: center
  gap: 0.4em
  margin-top: clamp(0.2rem, 1.2vmin, 0.5rem)
  padding: clamp(0.25rem, 1.4vmin, 0.5rem) clamp(0.6rem, 3vmin, 1.1rem)
  border: 2px solid rgba(255, 90, 110, 0.7)
  border-radius: 999px
  background-color: rgba(70, 8, 24, 0.7)

.level-banner__boss-icon
  width: 1.2em
  height: 1.2em
  color: #ff5a6e

.level-banner__boss-name
  color: #ffd9dd
  font-weight: 900
  text-transform: uppercase
  letter-spacing: 0.06em
  font-size: clamp(0.7rem, 3.4vmin, 1.1rem)
  text-shadow: 2px 2px 0 rgba(0, 0, 0, 0.9)

.level-banner-enter-active
  transition: opacity 260ms ease-out, scale 340ms cubic-bezier(0.18, 0.89, 0.32, 1.28)
.level-banner-leave-active
  transition: opacity 320ms ease-in, scale 320ms ease-in
.level-banner-enter-from
  opacity: 0
  scale: 0.86
.level-banner-leave-to
  opacity: 0
  scale: 1.08
</style>
