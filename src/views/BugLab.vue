<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { BUGS, type BugId } from '@/game/bugs'
import { SHOES, shoeSpec, type ShoeId } from '@/game/shoes'
import { BOSS_IDS, bossSpec, type BossId } from '@/game/bosses'
import { HAZARDS, type HazardId } from '@/game/hazards'
import { paintBug, paintBoss, paintSegment, paintDamage } from '@/game/bugArt'
import { paintShoe, paintFootShadow, paintStompRing, SHOE_FRAC } from '@/game/footArt'
import { paintHazard } from '@/game/propArt'
import { paintFloorTile, FLOOR_TILE_PX } from '@/game/floorArt'
import { paintComicWord, paintAlert, paintSplat, paintStar } from '@/game/uiArt'
import { JUICE_STYLES, type JuiceStyleId } from '@/game/juiceStyle'
import type { WorldId } from '@/game/stages'

/**
 * `/bug-lab` — the design bench for the cast.
 *
 * Every drawing in the game, animated, at several sizes, over every floor, with
 * a slider for the walk cycle. It exists to answer the one question a static
 * sheet cannot: DOES IT STILL READ AT 30 PX, moving, on the floor it will
 * actually be seen on?
 *
 * That is the size a bug is on a 320 px phone, and it is the size at which most
 * character design quietly fails — an outline that is beautiful at 200 px turns
 * to mud at 30, and nobody finds out until the game is on a phone.
 *
 * DEV ONLY. Lazy-routed, so it costs a player who never visits it nothing.
 */

const SIZES = [24, 40, 64, 120, 200]

const cycle = ref(0)
const auto = ref(true)
const world = ref<WorldId>(1)
const style = ref<JuiceStyleId>('ooze')
const tab = ref<'bugs' | 'shoes' | 'bosses' | 'props' | 'fx'>('bugs')

// The narrowing lives HERE and not in the template. A template expression is
// compiled to plain JavaScript, so `tab = k as any` inside one is a TypeScript
// cast in a JavaScript string: the browser threw `SyntaxError: Unexpected
// identifier 'as'` on the route's own chunk, the view never mounted, and the
// splash sat at 100% saying "still loading" with nothing behind it.
const setTab = (k: string): void => { tab.value = k as typeof tab.value }
const setWorld = (w: number): void => { world.value = w as WorldId }

const canvasRef = ref<HTMLCanvasElement | null>(null)
let raf = 0

const floor = (() => {
  const cache = new Map<WorldId, HTMLCanvasElement>()
  return (w: WorldId): HTMLCanvasElement => {
    const hit = cache.get(w)
    if (hit) return hit
    const c = document.createElement('canvas')
    c.width = FLOOR_TILE_PX
    c.height = FLOOR_TILE_PX
    paintFloorTile(c.getContext('2d')!, w)
    cache.set(w, c)
    return c
  }
})()

const rows = computed<string[]>(() => {
  switch (tab.value) {
    case 'bugs': return BUGS.map((b) => b.id)
    case 'shoes': return SHOES.map((s) => s.id)
    case 'bosses': return [...BOSS_IDS]
    case 'props': return HAZARDS.map((h) => h.id)
    case 'fx': return ['splat', 'word-squish', 'word-crunch', 'word-splat', 'word-ultra', 'alert', 'star', 'damage', 'segment']
  }
})

const ROW_H = 220

const draw = (): void => {
  const c = canvasRef.value
  if (!c) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const w = c.clientWidth
  const h = rows.value.length * ROW_H
  c.width = Math.max(1, Math.round(w * dpr))
  c.height = Math.max(1, Math.round(h * dpr))
  c.style.height = `${h}px`
  const ctx = c.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  // The floor these things will actually be seen on.
  const pat = ctx.createPattern(floor(world.value), 'repeat')
  ctx.fillStyle = pat ?? '#222'
  ctx.fillRect(0, 0, w, h)

  rows.value.forEach((id, r) => {
    const y = r * ROW_H + ROW_H / 2
    ctx.save()
    ctx.translate(0, y)

    // The row's name, in the margin.
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillRect(0, -ROW_H / 2, 130, ROW_H)
    ctx.fillStyle = '#e6edf3'
    ctx.font = '700 14px ui-sans-serif, system-ui, sans-serif'
    ctx.textBaseline = 'middle'
    ctx.fillText(id, 10, 0)

    let x = 170
    for (const size of SIZES) {
      ctx.save()
      ctx.translate(x, 0)
      drawOne(ctx, id, size / 2)
      ctx.restore()
      // The size, under each.
      ctx.fillStyle = 'rgba(255,255,255,0.55)'
      ctx.font = '500 11px ui-monospace, monospace'
      ctx.fillText(`${size}px`, x - 12, ROW_H / 2 - 12)
      x += size + 64
    }
    ctx.restore()

    ctx.strokeStyle = 'rgba(255,255,255,0.12)'
    ctx.beginPath()
    ctx.moveTo(0, (r + 1) * ROW_H)
    ctx.lineTo(w, (r + 1) * ROW_H)
    ctx.stroke()
  })
}

const drawOne = (ctx: CanvasRenderingContext2D, id: string, half: number): void => {
  switch (tab.value) {
    case 'bugs':
      paintBug(ctx, id as BugId, half, cycle.value)
      break
    case 'shoes': {
      // With the shadow, because the shadow is half of what the player reads.
      paintFootShadow(ctx, 0, half * 0.9, half * 1.5, 0.3)
      paintStompRing(ctx, 0, half * 0.9, half * 1.5, false, 0, false)
      paintShoe(ctx, id as ShoeId, shoeSpec(id as ShoeId), half * SHOE_FRAC * 1.5)
      break
    }
    case 'bosses':
      paintBoss(ctx, id as BossId, half, cycle.value, Math.floor(cycle.value * 3) % 3)
      break
    case 'props':
      paintHazard(ctx, id as HazardId, half, { t: cycle.value, armed: true, angle: 0 }, 3)
      break
    case 'fx':
      drawFx(ctx, id, half)
      break
  }
}

const drawFx = (ctx: CanvasRenderingContext2D, id: string, half: number): void => {
  if (id === 'splat') {
    paintSplat(ctx, half, '#ff4a9e', 3, style.value, 1, 0)
    return
  }
  if (id.startsWith('word-')) {
    const tone = id.slice('word-'.length) as 'squish' | 'crunch' | 'splat' | 'ultra'
    const text = { squish: 'SQUISH!', crunch: 'CRUNCH!', splat: 'SPLAT!', ultra: 'ULTRA SPLAT!' }[tone]
    paintComicWord(ctx, text, tone, half * 0.7, 1, -0.1, 1)
    return
  }
  if (id === 'alert') { paintAlert(ctx, half * 0.7, 1); return }
  if (id === 'star') { paintStar(ctx, half, true); return }
  if (id === 'damage') {
    paintBug(ctx, 'beetle', half, cycle.value)
    paintDamage(ctx, half, 0.7)
    return
  }
  if (id === 'segment') { paintSegment(ctx, half, 1, cycle.value) }
}

const tick = (): void => {
  raf = requestAnimationFrame(tick)
  if (auto.value) cycle.value = (performance.now() / 900) % 1
  draw()
}

onMounted(() => {
  raf = requestAnimationFrame(tick)
  window.addEventListener('resize', draw)
})
onUnmounted(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('resize', draw)
})

watch([tab, world, style], () => draw())
</script>

<template lang="pug">
  .bug-lab
    header
      h1 Bug lab
      p.lede
        | Every drawing, animated, at five sizes, over the floor it will be seen on.
        |  The 24 px column is the question: a design that is mud there is mud on a
        |  phone.
      .bar
        button(v-for="k in ['bugs', 'shoes', 'bosses', 'props', 'fx']" :key="k"
          :class="{ on: tab === k }" @click="setTab(k)") {{ k }}
        span.sep
        button.ghost(v-for="w in [1, 2, 3, 4]" :key="`w${w}`"
          :class="{ on: world === w }" @click="setWorld(w)") world {{ w }}
        span.sep
        button.ghost(v-for="s in JUICE_STYLES" :key="s"
          :class="{ on: style === s }" @click="style = s") {{ s }}
        span.sep
        label
          input(type="checkbox" v-model="auto")
          |  animate
        input.slider(type="range" min="0" max="1" step="0.01" v-model.number="cycle" :disabled="auto")

    canvas(ref="canvasRef")
</template>

<style scoped lang="sass">
.bug-lab
  min-height: 100vh
  height: 100vh
  overflow-y: auto
  padding: 20px
  background: #0d1117
  color: #e6edf3
  font: 14px/1.5 ui-sans-serif, system-ui, sans-serif

h1
  margin: 0 0 6px
  font-size: 22px

.lede
  max-width: 70ch
  margin: 0 0 14px
  color: #9aa7b4

.bar
  display: flex
  align-items: center
  flex-wrap: wrap
  gap: 8px
  margin-bottom: 16px

.sep
  width: 12px

button
  padding: 6px 12px
  border: 1px solid #2a323d
  border-radius: 6px
  background: transparent
  color: #9aa7b4
  font: inherit
  cursor: pointer

  &.on
    border-color: #2f7d9e
    background: #14364a
    color: #cfeeff

.slider
  width: 180px

canvas
  display: block
  width: 100%
  border: 1px solid #242c36
  border-radius: 8px
</style>
