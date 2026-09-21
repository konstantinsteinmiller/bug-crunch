<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import GameIcon from '@/components/icons/GameIcon.vue'
import { paintBoss, paintBug, BUG_R_FRAC } from '@/game/bugArt'
import { paintHazard } from '@/game/propArt'
import { paintFloorTile, FLOOR_TILE_PX } from '@/game/floorArt'
import { paintPicnicProp } from '@/game/cutsceneArt'
import { paintTwistGlyph } from '@/use/useBugCrunchArt'
import { INK } from '@/game/inkArt'
import { levelLabel } from '@/game/stages'
import type { Peek } from '@/game/headline'

/**
 * ─── Peek: something under the napkin ───────────────────────────────────────
 *
 * The result screen's comma. Under the stars, a little picnic napkin with
 * SOMETHING under it — an ink silhouette, never the thing itself — that pokes
 * out, wriggles and hides again. A list of what is next gets read and
 * forgotten; a shape you cannot quite make out gets wondered about, and the
 * only way to find out is to press forward. Tap it and it hops and squeaks.
 *
 * What is under it comes from `game/headline.ts` (`nextHeadline`), which knows
 * what the next level has that this one did not: a new creature, a twist, a
 * shoebox, a party, a new world, or — when nothing else is new — the boss, with
 * the crown pips counting down how many levels are left before her.
 *
 * Drawn with the renderer's own painters (`paintBug`, `paintBoss`,
 * `paintHazard`), then flooded with ink through `source-in`: the silhouette of
 * the real drawable, at no art cost, and a painting dropped in later changes it
 * with everything else.
 */

interface Props {
  peek: Peek
  /** Short landscape viewports — the card drops to 64 px beside the stars. */
  compact?: boolean
  /** Reduced motion: no wriggle. */
  calm?: boolean
}

const props = withDefaults(defineProps<Props>(), { compact: false, calm: false })
const emit = defineEmits<{ (e: 'tap'): void }>()
const { t } = useI18n()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const hop = ref(false)
let hopTimer: ReturnType<typeof setTimeout> | null = null

const label = computed(() => t('result.peekNext', { n: levelLabel(props.peek.level) }))

/** The crown track: how many levels until the next boss, when it is close. */
const pips = computed(() => {
  const n = props.peek.toBoss
  return n > 0 && n <= 3 ? n : 0
})

const drawSilhouette = (ctx: CanvasRenderingContext2D, s: number): void => {
  const h = props.peek.headline
  const r = s * 0.36
  ctx.save()
  ctx.translate(s / 2, s * 0.46)
  switch (h.kind) {
    case 'bug':
      // The body radius that makes a whole walk frame fill the card — the
      // same arithmetic the gift screen's foe card uses.
      paintBug(ctx, h.bug, s * 0.44 * BUG_R_FRAC, 0.28)
      break
    case 'boss':
      paintBoss(ctx, h.boss, r * 0.9, 0.2, 0)
      break
    case 'hazard':
      paintHazard(ctx, h.hazard, r * 0.9, { t: 0.2 }, 7)
      break
    case 'trial':
      paintHazard(ctx, 'shoebox', r * 0.8, { t: 0.2 }, 7)
      break
    case 'rush': {
      // Three of them in the formation's shape.
      const bug = h.lead ?? h.bug
      const places = h.shape === 'ring'
        ? [[-0.5, 0], [0.5, 0], [0, -0.5]] as const
        : h.shape === 'vee'
          ? [[0, -0.45], [-0.45, 0.3], [0.45, 0.3]] as const
          : [[-0.6, 0], [0, 0], [0.6, 0]] as const
      for (const [px, py] of places) {
        ctx.save()
        ctx.translate(px * r, py * r)
        ctx.rotate(h.shape === 'line' ? Math.PI / 2 : 0)
        paintBug(ctx, bug, r * 0.34, 0.28)
        ctx.restore()
      }
      break
    }
    case 'twist':
      ctx.scale(r * 0.9, r * 0.9)
      paintTwistGlyph(ctx, h.twist)
      break
    case 'party':
      // The stolen sandwich, and the guests all round it.
      ctx.scale(r / 7, r / 7)
      paintPicnicProp(ctx, 'sandwich', 0, 0, 1)
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + 0.3
        ctx.save()
        ctx.translate(Math.cos(a) * 9, Math.sin(a) * 7)
        ctx.rotate(a + Math.PI / 2)
        paintBug(ctx, 'ant', 2.4, i / 5)
        ctx.restore()
      }
      break
    case 'world':
      break
  }
  ctx.restore()
}

const draw = (): void => {
  const c = canvasRef.value
  if (!c) return
  const rect = c.getBoundingClientRect()
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const s = Math.max(1, Math.round(Math.min(rect.width, rect.height) * dpr))
  if (c.width !== s || c.height !== s) { c.width = s; c.height = s }
  const ctx = c.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, s, s)
  const h = props.peek.headline
  if (h.kind === 'world') {
    // A postcard of the next floor, blurred: the PLACE, not yet the details.
    const tile = document.createElement('canvas')
    tile.width = FLOOR_TILE_PX
    tile.height = FLOOR_TILE_PX
    const tg = tile.getContext('2d')
    if (!tg) return
    paintFloorTile(tg, h.world)
    ctx.save()
    ctx.beginPath()
    ctx.roundRect(s * 0.1, s * 0.12, s * 0.8, s * 0.66, s * 0.08)
    ctx.clip()
    ctx.filter = 'blur(2px)'
    ctx.drawImage(tile, s * 0.1, s * 0.12, s * 0.8, s * 0.8)
    ctx.restore()
    return
  }
  drawSilhouette(ctx, s)
  // Flood it with ink: a shape, not a picture.
  ctx.save()
  ctx.globalCompositeOperation = 'source-in'
  ctx.fillStyle = INK
  ctx.fillRect(0, 0, s, s)
  ctx.restore()
  // A boss carries her trophy: a gold glint where the prize will be.
  if (h.kind === 'boss' && h.trophy) {
    ctx.save()
    ctx.globalCompositeOperation = 'source-over'
    const g = ctx.createRadialGradient(s * 0.5, s * 0.2, 0, s * 0.5, s * 0.2, s * 0.16)
    g.addColorStop(0, 'rgba(255,240,160,1)')
    g.addColorStop(1, 'rgba(255,200,40,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, s, s)
    ctx.restore()
  }
}

watch(() => props.peek, () => { void nextTick(draw) }, { deep: true })
onMounted(() => { void nextTick(draw) })
onBeforeUnmount(() => { if (hopTimer) clearTimeout(hopTimer) })

const onTap = (): void => {
  hop.value = false
  void nextTick(() => { hop.value = true })
  if (hopTimer) clearTimeout(hopTimer)
  hopTimer = setTimeout(() => { hop.value = false }, 520)
  emit('tap')
}
</script>

<template lang="pug">
  button.peek(
    type="button"
    :class="{ 'is-compact': compact, 'is-calm': calm }"
    :aria-label="label"
    @click="onTap"
  )
    span.peek__stage(aria-hidden="true")
      span.peek__thing(:class="{ 'is-hop': hop }")
        canvas.peek__canvas(ref="canvasRef")
      //- The napkin: red gingham, one corner folded back — the picnic's own
      //- cloth, so the mystery is on the blanket with everything else.
      span.peek__napkin
    span.peek__pips(v-if="pips > 0" aria-hidden="true")
      span.peek__pip(v-for="i in pips" :key="i" :class="{ 'is-crown': i === pips }")
        GameIcon.peek__crown(v-if="i === pips" name="trophy")
</template>

<style scoped lang="sass">
.peek
  position: relative
  display: inline-flex
  flex-direction: column
  align-items: center
  gap: 0.2rem
  padding: 0
  border: 0
  background: none
  cursor: pointer
  pointer-events: auto
  --peek: clamp(4.4rem, 20cqmin, 6rem)

  &.is-compact
    --peek: clamp(3.4rem, 14cqmin, 4rem)

.peek__stage
  position: relative
  display: block
  width: var(--peek)
  height: var(--peek)

// The thing under the napkin: pokes up, wriggles, sinks back.
.peek__thing
  position: absolute
  inset: 0
  animation: peek-poke 2.6s ease-in-out infinite

  &.is-hop
    animation: peek-hop 0.5s cubic-bezier(0.3, 1.6, 0.5, 1) 1

.peek__canvas
  width: 100%
  height: 100%
  display: block

// At rest the top half of the shape still shows over the napkin — a silhouette
// the eye cannot find is not a mystery, it is an empty cloth — and it POKES up
// to show nearly all of itself, never quite all.
@keyframes peek-poke
  0%, 18%
    translate: 0 12%
    rotate: 0deg
  32%
    translate: 0 -6%
    rotate: -6deg
  40%
    translate: 0 -4%
    rotate: 7deg
  48%
    translate: 0 -6%
    rotate: -4deg
  62%, 100%
    translate: 0 12%
    rotate: 0deg

@keyframes peek-hop
  0%
    translate: 0 20%
  45%
    translate: 0 -18%
    scale: 1.08
  100%
    translate: 0 20%

.peek__napkin
  position: absolute
  left: 4%
  right: 4%
  bottom: 0
  height: 38%
  border-radius: 18% 18% 12% 12% / 30% 30% 12% 12%
  background-color: #fdf4ea
  background-image: linear-gradient(90deg, rgba(232, 83, 79, 0.55) 50%, transparent 50%), linear-gradient(rgba(232, 83, 79, 0.55) 50%, transparent 50%)
  background-size: 22% 30%
  box-shadow: 0 0 0 2px #2b1b2e, 0 3px 0 2px rgba(43, 27, 46, 0.4)
  animation: peek-cloth 2.6s ease-in-out infinite

@keyframes peek-cloth
  0%, 18%, 62%, 100%
    rotate: 0deg
  34%
    rotate: -2deg
  44%
    rotate: 2deg

.is-calm
  .peek__thing, .peek__napkin
    animation: none

  .peek__thing
    translate: 0 8%

.peek__pips
  display: flex
  gap: 0.25rem

.peek__pip
  display: inline-flex
  align-items: center
  justify-content: center
  width: 0.7rem
  height: 0.7rem
  border-radius: 999px
  background-color: rgba(255, 255, 255, 0.55)
  box-shadow: 0 0 0 2px #2b1b2e

  &.is-crown
    width: 1.2rem
    height: 1.2rem
    background-color: #ffd93c

.peek__crown
  width: 0.8rem
  height: 0.8rem
  color: #2b1b2e

@media (prefers-reduced-motion: reduce)
  .peek__thing, .peek__napkin
    animation: none
</style>
