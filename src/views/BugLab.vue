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
import {
  paintComicWord, paintAlert, paintSplat, paintStar, SPLAT_REACH, SPLAT_SHEET
} from '@/game/uiArt'
import { JUICE_STYLES, type JuiceStyleId } from '@/game/juiceStyle'
import type { WorldId } from '@/game/stages'
import {
  CRUSH_JITTER, CRUSH_MIX, CRUSH_RENDER_RATE, CRUSH_SUBJECTS, crushKindsFor, crushVariants, renderCrush,
  type CrushKind, type CrushSubject
} from '@/game/audio/crushSynth'
import { getAudioContext } from '@/use/useAssets'

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
const tab = ref<'bugs' | 'shoes' | 'bosses' | 'props' | 'fx' | 'audio'>('bugs')

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
    case 'audio': return []
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
    // `half / SPLAT_REACH`, because `r` is the BODY radius and the mark reaches
    // `r * SPLAT_REACH` — drawn at `half` its droplets were being clipped off by
    // the cell. Full opacity so the three juice styles are compared as pictures
    // rather than through their own three alphas, and no `procedural`, so this
    // is the live check that the painted strip slices and tints.
    const reach = SPLAT_REACH[SPLAT_SHEET[style.value]]
    paintSplat(ctx, half / reach, '#ff4a9e', 3, style.value, 1, 0, { opaque: true })
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

// ─── Audio: the crush bank, one button per sound ────────────────────────────
//
// The same pure renderer the game fills its bank from, played on the game's own
// shared AudioContext — so what you hear here is byte-for-byte what a kill
// plays, minus the pan. Each press renders fresh (a few ms) and steps to the
// next variant, so pressing one button repeatedly walks its variations; "×6"
// fires six kills in 1.2 s with the runtime's own rate and gain jitter, which
// is the machine-gun test. "loud" lifts everything 12 dB for a laptop speaker;
// off, it is the in-game level at the default SFX slider.

interface AudioButton { label: string; kind: CrushKind; heavy: boolean }

const audioButtons = (s: CrushSubject): AudioButton[] => {
  const out: AudioButton[] = []
  for (const kind of crushKindsFor(s)) {
    out.push({ label: kind, kind, heavy: false })
    if (kind !== 'clang' && s !== 'pod' && s !== 'hatch') out.push({ label: `${kind} heavy`, kind, heavy: true })
  }
  return out
}

const loud = ref(true)
const lastInfo = ref('')
const variantAt = new Map<string, number>()

const playCrushSample = (s: CrushSubject, b: AudioButton, at = 0, variant?: number): void => {
  const ctx = getAudioContext()
  if (!ctx) return
  if (ctx.state === 'suspended') void ctx.resume()
  const key = `${s}|${b.kind}|${b.heavy}`
  const n = crushVariants(s, b.kind, b.heavy)
  const v = variant ?? (variantAt.get(key) ?? 0) % n
  if (variant === undefined) variantAt.set(key, v + 1)
  const t0 = performance.now()
  const data = renderCrush({ subject: s, kind: b.kind, style: style.value, variant: v, heavy: b.heavy, sampleRate: CRUSH_RENDER_RATE })
  const ms = performance.now() - t0
  const buf = ctx.createBuffer(1, data.length, CRUSH_RENDER_RATE)
  buf.getChannelData(0).set(data)
  const src = ctx.createBufferSource()
  src.buffer = buf
  src.playbackRate.value = 1 + CRUSH_JITTER[b.kind] * (Math.random() * 2 - 1)
  const g = ctx.createGain()
  g.gain.value = CRUSH_MIX[b.kind] * 0.7 * (loud.value ? 4 : 1) * (0.9 + Math.random() * 0.2)
  src.connect(g).connect(ctx.destination)
  src.start(ctx.currentTime + at)
  lastInfo.value = `${style.value} · ${s} · ${b.label} · variant ${v + 1}/${n} · ${Math.round((data.length / CRUSH_RENDER_RATE) * 1000)} ms · rendered in ${ms.toFixed(1)} ms`
}

const playRapid = (s: CrushSubject): void => {
  const b: AudioButton = { label: 'crush', kind: 'crush', heavy: false }
  const n = crushVariants(s, 'crush', false)
  let last = -1
  for (let i = 0; i < 6; i++) {
    let v = Math.floor(Math.random() * n)
    if (n > 1 && v === last) v = (v + 1) % n
    last = v
    playCrushSample(s, b, i * 0.2, v)
  }
}
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
        button(v-for="k in ['bugs', 'shoes', 'bosses', 'props', 'fx', 'audio']" :key="k"
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
        template(v-if="tab === 'audio'")
          span.sep
          label
            input(type="checkbox" v-model="loud")
            |  loud

    .audio(v-if="tab === 'audio'")
      p.info {{ lastInfo || 'Pick a Juice Style above, then press a sound. Pressing again steps through its variants.' }}
      .audio-row(v-for="s in CRUSH_SUBJECTS" :key="s")
        span.name {{ s }}
        button(v-for="b in audioButtons(s)" :key="b.label" @click="playCrushSample(s, b)") {{ b.label }}
        button.ghost(@click="playRapid(s)") ×6
    canvas(v-show="tab !== 'audio'" ref="canvasRef")
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

.audio
  display: grid
  gap: 6px
  margin-bottom: 16px

.info
  margin: 0 0 8px
  color: #9aa7b4
  font-family: ui-monospace, monospace
  font-size: 12px

.audio-row
  display: flex
  align-items: center
  flex-wrap: wrap
  gap: 6px

  .name
    width: 110px
    color: #e6edf3
    font-weight: 700

canvas
  display: block
  width: 100%
  border: 1px solid #242c36
  border-radius: 8px
</style>
