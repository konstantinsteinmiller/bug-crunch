<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import FHudButton from '@/components/atoms/FHudButton.vue'
import FHudBadge from '@/components/atoms/FHudBadge.vue'
import { EXPEDITION_PAYOUT, useDailyExpedition } from '@/use/useDailyExpedition'

/**
 * ─── The expedition chip ────────────────────────────────────────────────────
 *
 * The whole entry point to the daily expedition, and deliberately the whole of
 * it: one control on the HUD's meta row, gold while today's road is unrun and
 * grey with a countdown once it has been taken.
 *
 * ── Why it is not a modal ──
 *
 * The obvious shape for a daily is the one every hybrid-casual game ships: a
 * popup on the first launch of the day. It is explicitly rejected here — the
 * player's first tap belongs to the game, not to a dialog about the game.
 * Everything this feature needs to say fits in a glyph and a badge: gold star
 * plus `×3` means there is a road waiting, grey star plus `7:20` means it has
 * been run and when the next one prints. Nobody has to be told.
 *
 * ── Why it takes two taps ──
 *
 * There is no menu in this game — it boots straight into a stage and there is
 * always a run in flight — so this chip necessarily sits beside the mute and
 * settings buttons DURING gameplay, and one stray tap would both abandon the
 * stage the player is running and spend the day's only attempt. The first tap
 * therefore only arms it and names it; the second one goes. It is not a
 * dialog: nothing is covered, the road keeps moving underneath, and ignoring
 * it for four seconds is the same as saying no.
 *
 * ── What it does NOT own ──
 *
 * When the day rolls over, which road prints, and whether it has been taken all
 * live in `useDailyExpedition.ts`, because those are the decisions and a
 * component cannot be asked what it would show at 23:59 UTC.
 */

const { t } = useI18n()
const { unlocked, available, spent, resetDisplay } = useDailyExpedition()

const emit = defineEmits<{ (e: 'start'): void }>()

/** How long the armed chip waits for the second tap. Long enough to read the
 *  label, short enough that a player who armed it by accident and looked away
 *  does not come back to a live button. */
const ARM_MS = 4000

const armed = ref(false)
let armTimer: number | null = null

const disarm = (): void => {
  armed.value = false
  if (armTimer !== null) {
    clearTimeout(armTimer)
    armTimer = null
  }
}

const onClick = (): void => {
  if (!available.value) return
  if (armed.value) {
    disarm()
    emit('start')
    return
  }
  armed.value = true
  if (armTimer !== null) clearTimeout(armTimer)
  armTimer = window.setTimeout(disarm, ARM_MS)
}

onUnmounted(disarm)
</script>

<template lang="pug">
  //- Absent, not disabled, below the unlock: a locked control on a HUD this
  //- tight is one more thing to look at that the player cannot act on.
  div.expedition(v-if="unlocked" :class="{ 'is-armed': armed }")
    //- The label the glyph cannot carry. It exists only while the chip is
    //- armed, which is also the only moment the player needs the word.
    Transition(name="expedition-tip")
      span.expedition__tip(v-if="armed") {{ t('expedition.confirm') }}
    FHudButton(
      :tone="available ? 'gold' : 'slate'"
      :icon="available ? 'star' : 'star-empty'"
      :attention="available && !armed"
      :is-disabled="!available"
      :aria-label="available ? (armed ? t('expedition.confirm') : t('expedition.available')) : t('expedition.spent', { time: resetDisplay })"
      @click="onClick"
    )
      template(#badge)
        //- Two different numbers in one slot, and the tone says which: gold
        //- `×3` is what today pays, grey `7:20` is when the next road prints.
        //- A spent chip that showed nothing would read as broken rather than
        //- as done — the exact failure the treasure chest's dead `00:00` was.
        FHudBadge(:tone="available ? 'gold' : 'blue'")
          | {{ available ? t('expedition.multiplier', { n: EXPEDITION_PAYOUT }) : resetDisplay }}
</template>

<style scoped lang="sass">
.expedition
  position: relative
  display: inline-flex

// Hung off the chip rather than laid out beside it, so a label whose width
// swings 2-3x across 21 locales can never move the mute and settings buttons it
// sits next to. Anchored by its LEFT edge and grown rightwards: the chip closes
// the bottom-left cluster, so the label runs into the empty middle of the screen
// rather than off the side — the same trick, mirrored, that the shop spotlight
// uses at the opposite corner.
.expedition__tip
  position: absolute
  bottom: 100%
  left: 0
  margin-bottom: 0.4rem
  padding: 0.3em 0.7em
  border: 2px solid #0f1a30
  border-radius: 0.6rem
  background-image: linear-gradient(to bottom, #ffcd00, #f7a000)
  box-shadow: 0 3px 0 rgba(0, 0, 0, 0.45), 0 0 12px rgba(255, 205, 0, 0.35)
  color: #fff
  font-weight: 900
  text-transform: uppercase
  white-space: nowrap
  letter-spacing: 0.02em
  font-size: clamp(0.7rem, 3.4vw, 0.95rem)
  text-shadow: 2px 2px 0 #000
  pointer-events: none

.expedition-tip-enter-active,
.expedition-tip-leave-active
  transition: opacity 0.15s ease, transform 0.15s ease

.expedition-tip-enter-from,
.expedition-tip-leave-to
  opacity: 0
  transform: translateY(0.25rem)
</style>
