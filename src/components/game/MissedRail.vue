<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { paintBug, BUG_R_FRAC } from '@/game/bugArt'
import type { BugId } from '@/game/bugs'
import type { RosterEntry } from '@/game/stages'

/**
 * ─── So Close! — the bugs you were missing ──────────────────────────────────
 *
 * A failed level used to end on "Time's up" and an empty star. "You lost" is a
 * wall; "two to go" is a gradient, and a gradient pulls. So a near miss shows
 * the bodies it was short by, as blinking ghost silhouettes in a row — the
 * likeliest kinds by the level's own roll, never more than five — and the retry
 * button beside it carries the full vial the next try opens with.
 *
 * Silhouettes, not pictures: the renderer's own painter flooded with a pale
 * wash through `source-in`, so they read as SPACES the player did not fill
 * rather than as creatures that beat them.
 */

interface Props {
  /** Bodies still owed when the clock ran out. */
  missing: number
  /** The level's roll — the ghosts are its heaviest kinds. */
  roster: readonly RosterEntry[]
}

const props = defineProps<Props>()
const { t } = useI18n()

const MAX = 5
const canvasRef = ref<HTMLCanvasElement | null>(null)

/** Which kinds to draw: the level's heaviest few, in weight order, cycled. */
const ghosts = computed<BugId[]>(() => {
  const n = Math.max(0, Math.min(MAX, props.missing))
  const kinds = [...props.roster]
    .filter((r) => r.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 2)
    .map((r) => r.id)
  if (kinds.length === 0) return []
  return Array.from({ length: n }, (_, i) => kinds[i % kinds.length]!)
})

const label = computed(() => t('result.missed', { n: props.missing }))

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
  const list = ghosts.value
  if (list.length === 0) return
  const cell = Math.min(h, w / MAX)
  const x0 = (w - cell * list.length) / 2
  list.forEach((id, i) => {
    ctx.save()
    ctx.translate(x0 + cell * (i + 0.5), h / 2)
    paintBug(ctx, id, cell * 0.46 * BUG_R_FRAC, 0.28)
    ctx.restore()
  })
  ctx.save()
  ctx.globalCompositeOperation = 'source-in'
  ctx.fillStyle = 'rgba(255,255,255,0.42)'
  ctx.fillRect(0, 0, w, h)
  ctx.restore()
}

watch(ghosts, () => { void nextTick(draw) })
onMounted(() => { void nextTick(draw) })
</script>

<template lang="pug">
  div.missed(v-if="ghosts.length > 0" role="img" :aria-label="label")
    canvas.missed__canvas(ref="canvasRef")
</template>

<style scoped lang="sass">
.missed
  width: clamp(9rem, 44cqmin, 15rem)
  height: clamp(1.8rem, 8cqmin, 2.8rem)

.missed__canvas
  width: 100%
  height: 100%
  display: block
  animation: missed-blink 1.1s ease-in-out infinite

@keyframes missed-blink
  0%, 100%
    opacity: 1
  50%
    opacity: 0.35

@media (prefers-reduced-motion: reduce)
  .missed__canvas
    animation: none
</style>
