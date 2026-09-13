<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import GameIcon from '@/components/icons/GameIcon.vue'
import IconCoin from '@/components/icons/IconCoin.vue'
import FButton from '@/components/atoms/FButton.vue'
import { paintShoe, shoeSprite, SHOE_BOX } from '@/game/footArt'
import type { ShoeSpec } from '@/game/shoes'

/**
 * ─── One shoe in the Locker ─────────────────────────────────────────────────
 *
 * A picture, a name, three stat pips, and one button whose caption depends on
 * what the player can do with it right now.
 *
 * ── The picture is THE GAME'S OWN DRAWING ──
 *
 * Not an illustration of the shoe, and not an icon: the card renders it with
 * `paintShoe`, the exact function the renderer uses on the board, into a small
 * canvas. So the thing bought and the thing worn are one object, and a painted
 * override that lands in `images/shoes/` changes both at once. A card drawn from
 * a lookalike would be the one place in the game where the art can silently
 * drift out of agreement with itself.
 *
 * ── The stat pips ──
 *
 * Three rows of five, exactly as the GDD's matrix prints them. Pips rather than
 * numbers because the audience starts at six, and "speed 4" means nothing to a
 * six-year-old while four filled dots against five mean everything.
 */

interface Props {
  spec: ShoeSpec
  owned: boolean
  starLocked: boolean
  affordable: boolean
  starsShort: number
  coinsShort: number
  equipped: boolean
  open: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{ (e: 'select'): void; (e: 'act'): void }>()
const { t } = useI18n()

const canvasRef = ref<HTMLCanvasElement | null>(null)

/**
 * Draw the shoe into the card's canvas.
 *
 * Re-run on mount and whenever the card's identity changes. The canvas is sized
 * from its own laid-out box times the device pixel ratio, so the drawing is
 * crisp on a phone at dpr 3 and does not cost four times the pixels on a
 * monitor at dpr 1.
 */
const draw = (): void => {
  const c = canvasRef.value
  if (!c) return
  const rect = c.getBoundingClientRect()
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const w = Math.max(1, Math.round(rect.width * dpr))
  const h = Math.max(1, Math.round(rect.height * dpr))
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h }
  const ctx = c.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, w, h)
  ctx.save()
  // The origin sits high in the box and the shoe is drawn small, because the
  // ankle and lower leg run BACK out of the heel and fade over nearly three
  // half-lengths (`footArt.legAndCuff`). Centred and drawn large, the leg ran
  // off the bottom of the card and the fade read as a smudge behind the name.
  ctx.translate(w / 2, h * 0.4)
  const painted = shoeSprite(props.spec.id)
  const half = Math.min(w, h) * 0.26
  if (painted && painted.naturalWidth > 0) {
    const pw = half * SHOE_BOX.w
    const ph = pw * (painted.naturalHeight / painted.naturalWidth)
    // Anchored on the TOE, exactly as the renderer does it — the constant, not
    // a copy of its value, so a change to the authoring box cannot leave the
    // Locker drawing a painted shoe in a different place from the board.
    ctx.drawImage(painted, -pw / 2, -ph * SHOE_BOX.toeFromTop, pw, ph)
  } else {
    paintShoe(ctx, props.spec.id, props.spec, half)
  }
  ctx.restore()
}

onMounted(() => {
  draw()
  // A resize changes the canvas's box, and a canvas whose backing store no
  // longer matches its box is a blurry shoe. One observer per card; cheap, and
  // it is the only way to catch a rotation inside an open modal.
  if (typeof ResizeObserver !== 'undefined' && canvasRef.value) {
    const ro = new ResizeObserver(() => draw())
    ro.observe(canvasRef.value)
  }
})
watch(() => [props.spec.id, props.open], () => { void Promise.resolve().then(draw) })

/** Five pips per row, filled to the rank. */
const pips = computed(() => [
  { icon: 'right' as const, label: t('shoes.stats.speed'), n: props.spec.speedRank },
  { icon: 'target' as const, label: t('shoes.stats.radius'), n: props.spec.radiusRank },
  { icon: 'shield' as const, label: t('shoes.stats.pierce'), n: props.spec.pierceRank }
])

/** What the one button says, and whether it can be pressed. */
const action = computed(() => {
  if (props.equipped) return { label: t('locker.worn'), disabled: true, type: 'success' as const }
  if (props.owned) return { label: t('locker.wear'), disabled: false, type: 'success' as const }
  if (props.starLocked) {
    return { label: t('locker.needStars', { n: props.starsShort }), disabled: true, type: 'secondary' as const }
  }
  if (!props.affordable) {
    return { label: t('locker.needCoins', { n: props.coinsShort }), disabled: true, type: 'secondary' as const }
  }
  return { label: t('locker.buy', { n: props.spec.cost }), disabled: false, type: 'primary' as const }
})
</script>

<template lang="pug">
  div.shoe-card(
    :class="{ 'is-open': open, 'is-equipped': equipped, 'is-locked': starLocked, 'is-owned': owned }"
    @click="emit('select')"
  )
    div.shoe-card__art
      canvas.shoe-card__canvas(ref="canvasRef")
      span.shoe-card__lock(v-if="starLocked" aria-hidden="true")
        GameIcon(name="lock")
      span.shoe-card__worn(v-if="equipped" aria-hidden="true")
        GameIcon(name="check")

    span.shoe-card__name {{ t(`shoes.${spec.id}.name`) }}

    //- The perk, and the trade it asks for. One line each, and the trade is
    //- always shown: a Locker that only lists upsides is a Locker that lies.
    div.shoe-card__body(v-if="open")
      p.shoe-card__perk {{ t(`shoes.${spec.id}.perk`) }}
      p.shoe-card__trade {{ t(`shoes.${spec.id}.trade`) }}

      ul.shoe-card__stats
        li.shoe-card__stat(v-for="p in pips" :key="p.label")
          GameIcon.shoe-card__stat-icon(:name="p.icon")
          span.sr-only {{ p.label }}
          span.shoe-card__pips
            span.shoe-card__pip(v-for="i in 5" :key="i" :class="{ 'is-on': i <= p.n }")

      FButton(
        block
        size="sm"
        :type="action.type"
        :is-disabled="action.disabled"
        @click.stop="emit('act')"
      )
        span.shoe-card__cta
          IconCoin.shoe-card__cta-coin(v-if="!owned && !starLocked && affordable")
          | {{ action.label }}
</template>

<style scoped lang="sass">
.shoe-card
  display: flex
  flex-direction: column
  align-items: center
  gap: clamp(0.14rem, 0.9vmin, 0.3rem)
  padding: clamp(0.3rem, 1.6vmin, 0.6rem)
  border: 3px solid rgba(255, 255, 255, 0.16)
  border-radius: clamp(0.6rem, 2.4vmin, 1rem)
  background-color: rgba(10, 18, 36, 0.72)
  cursor: pointer
  transition: border-color 140ms ease-out, background-color 140ms ease-out

  &:hover
    border-color: rgba(255, 255, 255, 0.3)

.is-open
  border-color: rgba(255, 217, 60, 0.7)
  background-color: rgba(20, 30, 54, 0.85)

.is-equipped
  border-color: rgba(103, 224, 138, 0.8)

.is-locked
  opacity: 0.72

.shoe-card__art
  position: relative
  width: 100%
  aspect-ratio: 1 / 1
  max-height: clamp(3.4rem, 18vmin, 6rem)

.shoe-card__canvas
  display: block
  width: 100%
  height: 100%

.shoe-card__lock, .shoe-card__worn
  position: absolute
  right: 4%
  top: 4%
  display: flex
  align-items: center
  justify-content: center
  width: clamp(1.1rem, 4.5vmin, 1.5rem)
  height: clamp(1.1rem, 4.5vmin, 1.5rem)
  border-radius: 999px
  border: 2px solid rgba(0, 0, 0, 0.55)

  :deep(svg)
    width: 62%
    height: 62%

.shoe-card__lock
  background-color: rgba(20, 26, 44, 0.9)
  color: #9fb0cc

.shoe-card__worn
  background-color: #1f9d4d
  color: #fff

.shoe-card__name
  color: #fff
  font-weight: 900
  text-align: center
  line-height: 1.1
  font-size: clamp(0.6rem, 2.6vmin, 0.9rem)
  text-shadow: 2px 2px 0 rgba(0, 0, 0, 0.85)

.shoe-card__body
  display: flex
  flex-direction: column
  align-items: stretch
  gap: clamp(0.2rem, 1.1vmin, 0.4rem)
  width: 100%

.shoe-card__perk, .shoe-card__trade
  margin: 0
  text-align: center
  line-height: 1.2
  font-size: clamp(0.52rem, 2.2vmin, 0.74rem)

.shoe-card__perk
  color: #c8f2d6

.shoe-card__trade
  color: #ffb9a8

.shoe-card__stats
  display: flex
  flex-direction: column
  gap: 0.18rem
  margin: 0
  padding: 0
  list-style: none

.shoe-card__stat
  display: flex
  align-items: center
  gap: 0.35em

.shoe-card__stat-icon
  flex: 0 0 auto
  width: clamp(0.65rem, 2.6vmin, 0.9rem)
  height: clamp(0.65rem, 2.6vmin, 0.9rem)
  color: #9fb0cc

.shoe-card__pips
  display: flex
  gap: 0.2em

.shoe-card__pip
  display: block
  width: clamp(0.3rem, 1.4vmin, 0.45rem)
  height: clamp(0.3rem, 1.4vmin, 0.45rem)
  border-radius: 999px
  background-color: rgba(255, 255, 255, 0.16)

  &.is-on
    background-color: #ffd93c

.shoe-card__cta
  display: inline-flex
  align-items: center
  gap: 0.3em

.shoe-card__cta-coin
  width: 1.1em
  height: 1.1em

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
