<template lang="pug">
  Transition(name="stage-banner")
    div.stage-banner(v-if="show" aria-live="polite")
      div.stage-banner__stage {{ t('hud.stage', { n: stage }) }}
      div.stage-banner__unlock(v-if="unlock")
        GameIcon.stage-banner__icon(:name="unlock.icon")
        div.stage-banner__unlock-text
          span.stage-banner__unlock-name {{ unlock.label }}
          span.stage-banner__unlock-tag {{ t('flow.unlocked') }}
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import GameIcon from '@/components/icons/GameIcon.vue'
import type { GameIconName } from '@/components/icons/iconNames'

/**
 * ─── The between-stages banner ──────────────────────────────────────────────
 *
 * What the early stages use INSTEAD of a result screen.
 *
 * A cleared stage used to stop the game: music down, overlay up, statistics, a
 * button. That is the right shape for a player who has decided to stay and is
 * choosing what to buy — and the wrong shape at twenty-five seconds, where it
 * reads as an ending to someone who has not decided anything yet. Measured, half
 * of Poki's testers left at exactly that screen.
 *
 * So the opening stages hand over without stopping. The road keeps moving, the
 * music keeps playing, and this rides over the top of the next stage's empty
 * opening — which is already fifteen units of nothing by design, so it costs no
 * gameplay at all. It is deliberately not dismissable and deliberately has no
 * button: there is nothing to decide here, which is the entire point.
 */
const { t } = useI18n()

interface Props {
  show: boolean
  stage: number
  /** Something the player just earned, announced on the same beat. */
  unlock: { icon: GameIconName; label: string } | null
}
defineProps<Props>()
</script>

<style scoped lang="sass">
.stage-banner
  position: absolute
  left: 50%
  top: 30%
  transform: translate(-50%, -50%)
  display: flex
  flex-direction: column
  align-items: center
  gap: clamp(0.5rem, 2.5vw, 0.9rem)
  // Never eats a steer: the player is still driving underneath it.
  pointer-events: none
  z-index: 45
  text-align: center

.stage-banner__stage
  font-weight: 900
  font-size: clamp(1.7rem, 9vw, 3rem)
  letter-spacing: 0.04em
  color: #fff
  text-transform: uppercase
  text-shadow: 0 3px 0 rgba(0, 0, 0, 0.55), 0 0 1.6rem rgba(120, 200, 255, 0.5)

.stage-banner__unlock
  display: flex
  align-items: center
  gap: clamp(0.4rem, 2vw, 0.7rem)
  padding: clamp(0.35rem, 1.8vw, 0.6rem) clamp(0.7rem, 3.4vw, 1.1rem)
  border-radius: 999px
  background-color: rgba(10, 20, 38, 0.86)
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.5), 0 0 0 0.14rem rgba(127, 227, 255, 0.32)

.stage-banner__icon
  width: clamp(1.3rem, 6vw, 1.8rem)
  height: clamp(1.3rem, 6vw, 1.8rem)
  color: #7fe3ff

.stage-banner__unlock-text
  display: flex
  flex-direction: column
  align-items: flex-start
  line-height: 1.1

.stage-banner__unlock-name
  font-weight: 900
  font-size: clamp(0.85rem, 4vw, 1.1rem)
  color: #fff

.stage-banner__unlock-tag
  font-weight: 800
  font-size: clamp(0.62rem, 3vw, 0.78rem)
  letter-spacing: 0.06em
  text-transform: uppercase
  color: #7fe3ff

// Arrives fast and hard — it is a reward, not a notification — and leaves slowly
// enough that it never looks like a flicker.
.stage-banner-enter-active
  transition: opacity 0.18s ease, transform 0.28s cubic-bezier(0.2, 1.6, 0.4, 1)

.stage-banner-leave-active
  transition: opacity 0.5s ease, transform 0.5s ease

.stage-banner-enter-from
  opacity: 0
  transform: translate(-50%, -50%) scale(0.7)

.stage-banner-leave-to
  opacity: 0
  transform: translate(-50%, -80%) scale(1.02)
</style>
