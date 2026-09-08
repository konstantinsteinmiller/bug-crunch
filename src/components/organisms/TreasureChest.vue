<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import useTowerEconomy from '@/use/useTowerEconomy'
import useSounds from '@/use/useSound'
import { spawnCoinExplosion } from '@/use/useCoinExplosion'
import IconCoin from '@/components/icons/IconCoin.vue'
import { useArtImage } from '@/use/useArtImage'
import { useTreasureChest } from '@/use/useTreasureChest'

/**
 * The idle chest, on the wallet column.
 *
 * Everything about WHEN it pays and HOW MUCH lives in `useTreasureChest.ts`;
 * this file is the chest itself — the art, the drain over it, the payout chip
 * under it, and the coins that fly to the badge when it opens.
 *
 * The state is persisted through the unified `tower_state` blob, so the fill
 * clock and the day's ledger ride the SaveManager's cloud push with the rest
 * of the player's progress. See `CHEST_KEY` / `CHEST_DAY_KEY` in `keys.ts`.
 */

interface Props {
  /** Element the coin explosion flies to (the coin badge). */
  targetEl?: HTMLElement | null
}

const props = withDefaults(defineProps<Props>(), {
  targetEl: null
})

const { t } = useI18n()
const { addCoins } = useTowerEconomy()
const { playSound } = useSounds()

const {
  phase, reward, isReady, isSpent, timeDisplay, shutterPct, collect
} = useTreasureChest()

/**
 * The painted chest, once the art pipeline has produced one and the art layer
 * is on — otherwise `null` and the SVG below draws it.
 *
 * The chest is the ONE mark this game paints twice over: the drawing has to
 * stay, because the flag is off on every portal build until the art is signed
 * off, and a HUD reward that is invisible on the build a reviewer sees is
 * worse than no reward at all.
 */
const painted = useArtImage('ui', 'chest')

const rootEl = ref<HTMLElement | null>(null)

const onClick = (): void => {
  const won = collect()
  if (won <= 0) return
  addCoins(won)
  playSound('reward-continue', 0.06)
  if (rootEl.value && props.targetEl) {
    spawnCoinExplosion({ sourceEl: rootEl.value, targetEl: props.targetEl })
  }
}
</script>

<template lang="pug">
  //- A real button: it is a control, it is reached by keyboard, and a screen
  //- reader has to be told which of the three states it is in — the count is a
  //- number on a chip, which is announced as nothing at all.
  button.treasure-chest(
    type="button"
    ref="rootEl"
    :class="{ 'is-ready': isReady, 'is-big': phase === 'big' && !isSpent, 'is-spent': isSpent }"
    :disabled="!isReady"
    :aria-label="isReady ? t('chest.ready', { n: reward }) : (isSpent ? t('chest.spent') : t('chest.filling'))"
    @click="onClick"
  )
    //- ── The painting ────────────────────────────────────────────────────
    //- The drain is a second element masked to the chest's own alpha, so the
    //- shutter shrinks INSIDE the chest's outline exactly as the SVG's
    //- clip-path does — a rectangle over a bitmap would darken the corners of
    //- the box instead of the chest.
    div.chest-art(v-if="painted")
      img.chest-art__img(:src="painted" alt="" draggable="false")
      div.chest-art__shade(
        v-if="isSpent || phase === 'cooldown'"
        :style="{ '--chest-mask': `url('${painted}')` }"
      )
        div.chest-art__shade-fill(:style="{ height: `${shutterPct * 100}%` }")

    //- ── The drawing ─────────────────────────────────────────────────────
    //- Programmatic chest art (SVG). The cooldown overlay sits inside the
    //- same SVG so a clipPath built from the chest body + lid can mask it
    //- to the icon's silhouette — the overlay shrinks within the chest
    //- outline rather than as a separate ring around it.
    svg.chest-svg(v-else viewBox="0 0 64 64")
      defs
        linearGradient(id="chestBody" x1="0" y1="0" x2="0" y2="1")
          stop(offset="0" stop-color="#a05a2c")
          stop(offset="1" stop-color="#5a2e10")
        linearGradient(id="chestLid" x1="0" y1="0" x2="0" y2="1")
          stop(offset="0" stop-color="#c0732e")
          stop(offset="1" stop-color="#7d4017")
        clipPath(id="chestClip")
          rect(x="6" y="28" width="52" height="28" rx="3")
          path(d="M6 28 Q32 8 58 28 Z")
      rect(x="6" y="28" width="52" height="28" rx="3" fill="url(#chestBody)" stroke="#2a1607" stroke-width="2")
      path(d="M6 28 Q32 8 58 28 Z" fill="url(#chestLid)" stroke="#2a1607" stroke-width="2")
      rect(x="26" y="34" width="12" height="14" rx="2" fill="#fcd34d" stroke="#5a3408" stroke-width="1.5")
      circle(cx="32" cy="40" r="2" fill="#5a3408")
      rect(x="6" y="38" width="52" height="3" fill="#3a1d09" opacity="0.6")
      rect(x="6" y="50" width="52" height="3" fill="#3a1d09" opacity="0.6")

      //- Cooldown overlay: 0.5-opacity black, clipped to the chest outline
      //- via `chestClip`. The rect drains from the top down — at start it
      //- covers the whole chest, at full cooldown it's gone.
      rect(
        v-if="isSpent || phase === 'cooldown'"
        x="0"
        :y="64 * (1 - shutterPct)"
        width="64"
        :height="64 * shutterPct"
        fill="rgba(0,0,0,0.5)"
        clip-path="url(#chestClip)"
        style="transition: y 0.3s linear, height 0.3s linear"
      )

    //- Status label: a countdown while it fills, the payout once it is ready.
    //- Both sit in the same slot so the chest's footprint never jumps.
    div.chest-label(aria-hidden="true")
      span.chest-timer(v-if="!isReady") {{ timeDisplay }}
      span.chest-payout(v-else :class="{ 'is-big': phase === 'big' }")
        IconCoin.chest-payout__coin
        span.chest-payout__value +{{ reward }}
</template>

<style scoped lang="sass">
.treasure-chest
  position: relative
  display: block
  width: 3rem
  height: 3rem
  padding: 0
  border: 0
  background: none
  pointer-events: auto
  touch-action: manipulation
  -webkit-tap-highlight-color: transparent
  cursor: default

  &:not(:disabled)
    cursor: pointer

  &:not(:disabled):active
    transform: translateY(2px) scale(0.94)

@media (min-width: 640px)
  .treasure-chest
    width: 3.5rem
    height: 3.5rem

// ─── The art, painted or drawn ──────────────────────────────────────────────

.chest-art
  position: relative
  width: 100%
  height: 100%

.chest-art__img
  display: block
  width: 100%
  height: 100%
  object-fit: contain

// Masked to the painting's own alpha, so the drain is cut to the chest and not
// to its bounding box. `mask-size: contain` + `center` mirror the `<img>`'s
// `object-fit`, which is what keeps the two in register at any aspect ratio.
.chest-art__shade
  position: absolute
  inset: 0
  overflow: hidden
  -webkit-mask-image: var(--chest-mask)
  mask-image: var(--chest-mask)
  -webkit-mask-size: contain
  mask-size: contain
  -webkit-mask-position: center
  mask-position: center
  -webkit-mask-repeat: no-repeat
  mask-repeat: no-repeat
  pointer-events: none

.chest-art__shade-fill
  position: absolute
  left: 0
  right: 0
  bottom: 0
  background-color: rgba(0, 0, 0, 0.5)
  transition: height 0.3s linear

.chest-svg
  display: block
  width: 100%
  height: 100%

.chest-art, .chest-svg
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.6))

.is-ready .chest-art,
.is-ready .chest-svg
  animation: chest-bob 1s ease-in-out infinite alternate

@keyframes chest-bob
  from
    transform: translateY(0)
  to
    transform: translateY(-3px)

.is-big .chest-art,
.is-big .chest-svg
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.6)) drop-shadow(0 0 8px rgba(255, 160, 0, 0.8))

// Spent for the day — drained of colour so the chest reads as put away, and the
// countdown underneath is to midnight rather than to a fill that cannot pay.
.is-spent .chest-art,
.is-spent .chest-svg
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.6)) grayscale(0.6)
  opacity: 0.7

// ─── Status label ───────────────────────────────────────────────────────────
//
// The countdown and the payout share one slot, centred under the chest, so the
// chest's footprint never jumps when it becomes ready.
//
// The payout chip is built in the same language as the rest of the HUD — dark
// outline, vertical gradient, drop shadow, outlined text.
.chest-label
  position: absolute
  top: calc(100% + 0.15rem)
  left: 50%
  translate: -50% 0
  display: flex
  justify-content: center
  // The chip is wider than the chest; letting it size itself and centre keeps
  // it from shunting the wallet column around.
  white-space: nowrap
  pointer-events: none

.chest-timer
  display: inline-block
  padding: 0.05em 0.4em
  border-radius: 999px
  background-color: rgba(10, 16, 30, 0.72)
  color: #cfdcf0
  font-weight: 900
  font-size: clamp(0.5rem, 2.1vw, 0.66rem)
  line-height: 1.5
  letter-spacing: 0.04em
  text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.8)

.chest-payout
  display: inline-flex
  align-items: center
  justify-content: center
  gap: 0.2em
  padding: 0.1em 0.45em
  border: 2px solid #2a1c06
  border-radius: 999px
  background-image: linear-gradient(to bottom, #cfd9e6, #93a3b8)
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.45)
  line-height: 1

  // The 10-minute chest is the one worth waiting for, so it gets the gold
  // treatment and the aura; the 3-minute one stays quiet silver.
  &.is-big
    background-image: linear-gradient(to bottom, #ffd85c, #f0a01c)
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.45), 0 0 12px rgba(255, 170, 30, 0.75)

.chest-payout__coin
  flex: 0 0 auto
  width: clamp(0.5rem, 2.1vw, 0.7rem)
  height: clamp(0.5rem, 2.1vw, 0.7rem)
  color: #fff6d0
  filter: drop-shadow(0 1px 0 rgba(0, 0, 0, 0.5))

.chest-payout__value
  color: #fff
  font-weight: 900
  font-size: clamp(0.5rem, 2.1vw, 0.68rem)
  line-height: 1.4
  text-shadow: 1.5px 1.5px 0 rgba(0, 0, 0, 0.75)
</style>
