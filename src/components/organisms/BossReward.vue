<template lang="pug">
  FReward(:model-value="open" :show-continue="false" reveal)
    template(#ribbon)
      span {{ t('bossReward.title') }}

    div.gift
      p.gift__sub {{ t('bossReward.subtitle', { n: stage }) }}

      div.gift__stand
        button.gift__card(
          type="button"
          :class="{ 'is-chosen': chosen }"
          :disabled="chosen"
          :aria-label="t(`weapons.${BOSS_REWARD_WEAPON}`)"
          @click.stop="take"
        )
          div.gift__frame
            div.gift__halo
            span.gift__free {{ t('hud.weaponFree') }}
            div.gift__art
              ArtIcon.gift__icon(kind="ui" :id="`weapon-card-${BOSS_REWARD_WEAPON}`" :fallback="BOSS_REWARD_WEAPON")
            div.gift__name {{ t(`weapons.${BOSS_REWARD_WEAPON}`) }}
            ul.gift__perks
              li.gift__perk
                GameIcon.gift__perk-icon(name="star")
                span {{ t(`weaponPick.${BOSS_REWARD_WEAPON}.a`) }}
              li.gift__perk
                GameIcon.gift__perk-icon(name="flame")
                span {{ t(`weaponPick.${BOSS_REWARD_WEAPON}.b`) }}
            div.gift__cta
              GameIcon.gift__cta-icon(name="unlock")
              span {{ t('weaponPick.take') }}
            //- The screen closes itself, and says so: a bar that drains while
            //- nobody touches anything, so the wait never reads as a hang.
            div.gift__timer(aria-hidden="true")
              div.gift__timer-fill(:style="{ transform: `scaleX(${1 - progress})` }")
</template>

<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import FReward from '@/components/atoms/FReward.vue'
import ArtIcon from '@/components/icons/ArtIcon.vue'
import GameIcon from '@/components/icons/GameIcon.vue'
import { BOSS_REWARD_WEAPON } from '@/game/weapons'
import { isGamePaused } from '@/use/useGamePause'
import useSounds from '@/use/useSound'

/**
 * ─── The first boss's gift ──────────────────────────────────────────────────
 *
 * The reveal that replaces the stage-1 handover. A quarter of the playtesters
 * who killed the first boss quit right there, so the kill now hands something
 * over in the same breath: one card, the launcher, on `FReward`'s burst — and
 * then the road goes on from where the boss fell.
 *
 * Rules it keeps:
 *
 *   • IT IS NOT A DECISION. The weapon is already the player's the moment this
 *     goes up (the scene persists it before opening). Tapping the card, or
 *     anywhere, only says "got it" sooner.
 *   • THREE SECONDS AT MOST. The bar drains, the card flares, and the road
 *     continues on the three-second mark whether or not anybody touched it. The
 *     clock holds while the game is paused — a hidden tab or an ad must not eat
 *     the reveal — and nothing else can stop it.
 *   • A STRAY TAP IS NOT A TAKE. A player hammering the road at the kill would
 *     otherwise close the screen on its first frame; taps count from `ARM_MS`.
 *   • Nothing here reads the save or the sim. The scene owns the flow.
 */

const props = defineProps<{
  open: boolean
  /** The stage the launcher rides — printed on the subtitle. */
  stage: number
}>()

const emit = defineEmits<{ (e: 'done'): void }>()

const { t } = useI18n()
const { playSound } = useSounds()

/** The whole screen, from going up to the road moving again. */
const REVEAL_MS = 3000
/** How long the card flares before the scene takes over — WeaponChoice's. */
const CHOSEN_MS = 560
/** Taps before this are the fight's, not the player's answer. */
const ARM_MS = 450

const chosen = ref(false)
/** 0..1 across the countdown to the automatic take. */
const progress = ref(0)

let openedAt = 0
let heldAt = 0
let raf = 0
let handoff: number | null = null

const take = (): void => {
  if (chosen.value) return
  chosen.value = true
  progress.value = 1
  playSound('reward-continue', 0.06)
  stopClock()
  handoff = window.setTimeout(() => {
    handoff = null
    emit('done')
  }, CHOSEN_MS)
}

/** The countdown, on the frame clock, held while the game is paused. */
const tick = (): void => {
  raf = requestAnimationFrame(tick)
  const now = performance.now()
  if (isGamePaused.value) {
    // Slide the start forward by however long the pause lasted, so the bar
    // resumes where it stopped rather than jumping.
    if (heldAt === 0) heldAt = now
    return
  }
  if (heldAt !== 0) {
    openedAt += now - heldAt
    heldAt = 0
  }
  // The bar reaches empty with exactly the flare left in the budget.
  progress.value = Math.min(1, (now - openedAt) / (REVEAL_MS - CHOSEN_MS))
  if (progress.value >= 1) take()
}

const armed = (): boolean => performance.now() - openedAt >= ARM_MS

const onPointer = (): void => { if (armed()) take() }
const onKey = (e: KeyboardEvent): void => {
  if (e.code !== 'Space' && e.code !== 'Enter' && e.code !== 'NumpadEnter' && e.code !== 'Escape') return
  e.preventDefault()
  if (armed()) take()
}

const startClock = (): void => {
  openedAt = performance.now()
  heldAt = 0
  raf = requestAnimationFrame(tick)
  // Capture phase: the tap lands on the reveal's backdrop or on the card, and
  // either way it is the same answer.
  window.addEventListener('pointerdown', onPointer, true)
  window.addEventListener('keydown', onKey, true)
}

const stopClock = (): void => {
  if (raf) cancelAnimationFrame(raf)
  raf = 0
  window.removeEventListener('pointerdown', onPointer, true)
  window.removeEventListener('keydown', onKey, true)
}

watch(() => props.open, (open) => {
  if (open) {
    chosen.value = false
    progress.value = 0
    playSound('level-up', 0.06)
    startClock()
    return
  }
  stopClock()
  if (handoff !== null) {
    clearTimeout(handoff)
    handoff = null
  }
}, { immediate: true })

onUnmounted(() => {
  stopClock()
  if (handoff !== null) clearTimeout(handoff)
})
</script>

<style scoped lang="sass">
.gift
  display: flex
  flex-direction: column
  align-items: center
  gap: clamp(0.6rem, 2.4vh, 1.2rem)
  width: 100%
  max-width: 30rem

.gift__sub
  margin: 0
  color: #ffe9b0
  font-weight: 800
  font-size: clamp(0.78rem, 3.4vmin, 1.05rem)
  text-align: center
  text-wrap: balance
  text-shadow: 2px 2px 0 rgba(0, 0, 0, 0.8)

// Room for the flare, for the reason `WeaponChoice` gives: the body is a scroll
// container sized to its content, and a card that scales past its box is cut.
.gift__stand
  display: flex
  justify-content: center
  width: 100%
  padding: clamp(0.8rem, 3vmin, 1.15rem) clamp(0.55rem, 2.6vw, 1rem)

.gift__card
  appearance: none
  margin: 0
  padding: 0
  border: 0
  background: none
  color: inherit
  font: inherit
  cursor: pointer
  -webkit-tap-highlight-color: transparent
  touch-action: manipulation
  width: min(15rem, 62vw)

  &:disabled
    cursor: default

  &:focus-visible .gift__frame,
  &:hover:not(:disabled) .gift__frame
    box-shadow: 0 0 0 0.18rem rgba(255, 217, 60, 0.75), 0 8px 24px rgba(0, 0, 0, 0.6), inset 0 0 0 1px rgba(255, 255, 255, 0.08)

.gift__frame
  position: relative
  display: flex
  flex-direction: column
  align-items: center
  gap: clamp(0.3rem, 1.4vh, 0.6rem)
  padding: clamp(0.7rem, 2.8vw, 1.1rem) clamp(0.55rem, 2.2vw, 0.9rem) clamp(0.7rem, 2.4vw, 0.95rem)
  border-radius: clamp(0.7rem, 3vw, 1.1rem)
  background: linear-gradient(170deg, #1a2440 0%, #0c1426 55%, #070c18 100%)
  box-shadow: 0 0 0 0.12rem rgba(255, 217, 60, 0.45), 0 8px 24px rgba(0, 0, 0, 0.6), inset 0 0 0 1px rgba(255, 255, 255, 0.08)
  overflow: hidden
  animation: gift-float 3.4s ease-in-out infinite
  transition: box-shadow 200ms ease

  .is-chosen &
    scale: 1.06
    box-shadow: 0 0 0 0.2rem #ffd93c, 0 0 2.2rem rgba(255, 217, 60, 0.7), 0 10px 28px rgba(0, 0, 0, 0.65)
    animation: gift-chosen 0.56s cubic-bezier(0.2, 1.5, 0.4, 1) both

// The launcher's warm pool — the same temperature its card has on the choice.
.gift__halo
  position: absolute
  left: 50%
  top: 34%
  width: 120%
  aspect-ratio: 1
  translate: -50% -50%
  border-radius: 50%
  pointer-events: none
  background: radial-gradient(circle, rgba(255, 168, 70, 0.46) 0%, rgba(255, 120, 40, 0.16) 38%, transparent 66%)

.gift__free
  position: absolute
  top: clamp(0.4rem, 1.6vw, 0.6rem)
  right: clamp(0.4rem, 1.6vw, 0.6rem)
  padding: 0.15em 0.55em
  border-radius: 999px
  background-image: linear-gradient(to bottom, #4ee07a, #1fae4f)
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.45)
  color: #fff
  font-weight: 900
  font-size: clamp(0.6rem, 2.6vmin, 0.8rem)
  letter-spacing: 0.04em
  text-transform: uppercase
  text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.7)

.gift__art
  position: relative
  width: clamp(4.2rem, 26vw, 7rem)
  height: clamp(4.2rem, 26vw, 7rem)
  filter: drop-shadow(0 6px 10px rgba(0, 0, 0, 0.7))
  color: #ffb347

.gift__icon
  width: 100%
  height: 100%

.gift__name
  position: relative
  color: #fff
  font-weight: 900
  font-size: clamp(0.9rem, 4vmin, 1.25rem)
  line-height: 1.1
  text-align: center
  text-transform: uppercase
  letter-spacing: 0.02em
  text-shadow: 2px 2px 0 #000

.gift__perks
  position: relative
  display: flex
  flex-direction: column
  gap: 0.2rem
  margin: 0
  padding: 0
  list-style: none

.gift__perk
  display: flex
  align-items: center
  gap: 0.35rem
  color: #d9e6ff
  font-weight: 800
  font-size: clamp(0.66rem, 2.9vmin, 0.86rem)
  line-height: 1.15
  text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.8)

.gift__perk .gift__perk-icon
  flex: 0 0 auto
  width: clamp(0.8rem, 3.4vmin, 1rem)
  height: clamp(0.8rem, 3.4vmin, 1rem)
  color: #ffd93c

.gift__cta
  position: relative
  display: inline-flex
  align-items: center
  gap: 0.3rem
  margin-top: 0.15rem
  padding: 0.32em 0.9em
  border-radius: 999px
  background-image: linear-gradient(to bottom, #ffcd00, #f7a000)
  box-shadow: 0 3px 0 rgba(0, 0, 0, 0.45), 0 0 10px rgba(255, 205, 0, 0.3)
  color: #fff
  font-weight: 900
  font-size: clamp(0.7rem, 3vmin, 0.92rem)
  text-transform: uppercase
  letter-spacing: 0.03em
  text-shadow: 2px 2px 0 rgba(0, 0, 0, 0.85)

.gift__cta .gift__cta-icon
  width: 1em
  height: 1em

.gift__timer
  position: relative
  width: 100%
  height: 0.28rem
  margin-top: 0.2rem
  border-radius: 999px
  background: rgba(255, 255, 255, 0.12)
  overflow: hidden

.gift__timer-fill
  width: 100%
  height: 100%
  border-radius: inherit
  background: linear-gradient(to right, #ffd93c, #ffb347)
  transform-origin: left center

@keyframes gift-float
  0%, 100%
    translate: 0 0
  50%
    translate: 0 -0.35rem

@keyframes gift-chosen
  0%
    scale: 1
  45%
    scale: 1.12
  100%
    scale: 1.06

// Short landscape phone: the card loses its float and shrinks its art so the
// whole thing fits under the ribbon without scrolling.
@media (max-height: 34rem)
  .gift
    gap: 0.4rem
  .gift__frame
    animation: none
    gap: 0.25rem
  .gift__art
    width: clamp(2.6rem, 14vh, 4rem)
    height: clamp(2.6rem, 14vh, 4rem)

@media (prefers-reduced-motion: reduce)
  .gift__frame
    animation: none
</style>
