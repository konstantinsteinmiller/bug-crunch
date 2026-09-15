<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { BUGS, type BugId } from '@/game/bugs'
import { SHOES, shoeSpec, type ShoeId } from '@/game/shoes'
import { BOSS_IDS, bossSpec, type BossId } from '@/game/bosses'
import { HAZARDS, type HazardId } from '@/game/hazards'
import { ART_BRAND, ART_CATALOGUE } from '@/game/artCatalogue'
import {
  artOverridesEnabled, artOverrideSource, refreshArtOverrides, setArtOverrides, spriteFor
} from '@/game/art'
import { paintBug, paintBoss, bugFrame, bugFrameEdge, primeBugs, bakeSlice, BUG_R_FRAC } from '@/game/bugArt'
import { paintShoe, shoeSprite } from '@/game/footArt'
import { paintCoin, paintHaze, paintHazard, paintPod, paintSaltBurst } from '@/game/propArt'
import { floorTile, paintFloorTile, FLOOR_TILE_PX, resetFloors } from '@/game/floorArt'
import {
  blitBanner, paintShockRing, paintSplat, paintUiIcon,
  UI_ICON_IDS, BANNER, SPLAT_REACH, type SplatSheetId, type UiIconId
} from '@/game/uiArt'
import { paintSmokeRef } from '@/use/useVfx'
import type { WorldId } from '@/game/stages'
import { SHOE_BOX } from '@/game/artBoxes'
import { ICON_PATHS } from '@/components/icons/iconPaths'
import { isGameIconName } from '@/components/icons/iconNames'
import { prependBaseUrl } from '@/utils/function'

/**
 * `/playground` — the verification scene.
 *
 * The art pipeline's second screen, and the one that does the only job the
 * bench cannot: it shows what came BACK against the drawing it replaces.
 *
 * Three columns per drawable — DRAWN, PAINTED, and the two OVERLAID with the
 * painting at half opacity. The third is the one that matters: a painting that
 * registers correctly sits exactly on the drawing, and one that came back a
 * third too small or half a panel low is instantly obvious in a way that two
 * pictures side by side never are.
 *
 * Every cell is rendered by the GAME'S OWN painter with the art layer forced on
 * or off, rather than by a private copy of the geometry. A playground that drew
 * its own version of the drawing would agree with itself and prove nothing.
 */

const CELL = 132

const artOn = ref(artOverridesEnabled())
const source = ref(artOverrideSource())
const world = ref<WorldId>(1)

const toggle = (): void => {
  artOn.value = setArtOverrides(!artOn.value)
  source.value = artOverrideSource()
  resetFloors()
  void draw()
}

const refresh = (): void => {
  refreshArtOverrides()
  resetFloors()
  void draw()
}

// ─── Rows ───────────────────────────────────────────────────────────────────

interface Row { key: string; label: string; target: string; painted: boolean }

/**
 * Bumped after every redraw.
 *
 * `spriteFor` is a plain function, not a ref — deliberately, because the field
 * asks it per drawable per frame — so a computed that calls it never
 * invalidates on its own. Probes settle a second or two after the page opens,
 * which is exactly when a freshly sliced painting arrives, so without this the
 * page would go on saying "drawn only" over a cell that is visibly painted.
 */
const probeTick = ref(0)

const rows = computed<Row[]>(() => {
  void probeTick.value
  const out: Row[] = []
  const add = (kind: Parameters<typeof spriteFor>[0], id: string, label: string): void => {
    out.push({
      key: `${kind}/${id}`,
      label,
      target: `images/${kind === 'bug' ? 'bugs' : kind === 'boss' ? 'bosses' : kind === 'shoe' ? 'shoes' : kind}/${id}.webp`,
      painted: !!spriteFor(kind, id)
    })
  }
  for (const b of BUGS) add('bug', b.id, b.id)
  for (const s of SHOES) add('shoe', s.id, s.id)
  for (const b of BOSS_IDS) add('boss', b, b)
  for (const id of ART_CATALOGUE.prop) add('prop', id, id)
  for (const id of ART_CATALOGUE.fx) add('fx', id, id)
  for (const id of ART_CATALOGUE.bg) add('bg', id, id)
  for (const id of ART_CATALOGUE.ui) add('ui', id, id)
  return out
})

const paintedCount = computed(() => rows.value.filter((r) => r.painted).length)

// ─── Drawing ────────────────────────────────────────────────────────────────

const gridRef = ref<HTMLElement | null>(null)

/**
 * Draw one cell.
 *
 * `mode` decides which layers go in: `drawn` forces the procedural path,
 * `painted` blits the bitmap alone, and `both` lays the painting over the
 * drawing at half opacity.
 */
const cell = (canvas: HTMLCanvasElement, row: Row, mode: 'drawn' | 'painted' | 'both'): void => {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = CELL * dpr
  canvas.height = CELL * dpr
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, CELL, CELL)
  // A checker, so a transparent return is visibly transparent.
  for (let y = 0; y < CELL; y += 12) {
    for (let x = 0; x < CELL; x += 12) {
      ctx.fillStyle = ((x / 12 + y / 12) % 2 === 0) ? '#222833' : '#1a1f28'
      ctx.fillRect(x, y, 12, 12)
    }
  }

  const [kind, id] = row.key.split('/') as [Parameters<typeof spriteFor>[0], string]
  const half = CELL * 0.38

  if (mode !== 'painted') drawProcedural(ctx, kind, id, half)
  if (mode !== 'drawn') {
    ctx.save()
    if (mode === 'both') ctx.globalAlpha = 0.5
    drawPainted(ctx, kind, id, half)
    ctx.restore()
  }
}

const drawProcedural = (
  ctx: CanvasRenderingContext2D, kind: string, id: string, half: number
): void => {
  ctx.save()
  ctx.translate(CELL / 2, CELL / 2)
  switch (kind) {
    case 'bug':
      paintBug(ctx, id as BugId, half * BUG_R_FRAC * 1.6, 0)
      break
    case 'shoe':
      ctx.translate(0, -CELL * 0.06)
      paintShoe(ctx, id as ShoeId, shoeSpec(id as ShoeId), half * 0.7)
      break
    case 'boss':
      paintBoss(ctx, id as BossId, half * 0.6, 0, 0)
      break
    case 'prop':
      if (id === 'coin') paintCoin(ctx, half * 0.8, 0)
      else if (id === 'pod') paintPod(ctx, half * 0.8, 0, '#ffd07a')
      else paintHazard(ctx, id as HazardId, half * 0.85, { t: 0, angle: 0 }, 3)
      break
    case 'fx':
      if (id.startsWith('ring-')) {
        paintShockRing(ctx, half, 0.55, id === 'ring-fever' ? 'rgba(255,205,0,0.95)' : 'rgba(255,255,255,0.95)',
          id === 'ring-slam' ? 1.8 : id === 'ring-fever' ? 2.6 : 0.7)
      } else if (id === 'haze') paintHaze(ctx, half, 0, 1)
      else if (id === 'salt-cloud') paintSaltBurst(ctx, half, 0.6)
      else if (id === 'scorch') {
        paintSplat(ctx, half * 0.6, '#3a2a1e', 7, 'ooze', 1, 0, { procedural: true })
      } else if (id.startsWith('splat')) {
        // The drawn splat this sheet has to beat, in a goo colour rather than
        // white — the A/B is about whether the painting reads as the same mark
        // once the game has tinted it, and a white one answers a different
        // question.
        paintSplat(ctx, half / SPLAT_REACH[id as SplatSheetId], SPLAT_AB_GOO, 5,
          id === 'splat-confetti' ? 'confetti' : 'ooze', 1, 0,
          { procedural: true, opaque: true })
      } else if (id === 'smoke') paintSmokeRef(ctx, half)
      else {
        ctx.fillStyle = '#fff6c8'
        ctx.beginPath()
        ctx.arc(0, 0, half * 0.4, 0, Math.PI * 2)
        ctx.fill()
      }
      break
    case 'bg': {
      ctx.restore()
      const w = Number(id.slice('floor-'.length)) as WorldId
      const tile = document.createElement('canvas')
      tile.width = FLOOR_TILE_PX
      tile.height = FLOOR_TILE_PX
      paintFloorTile(tile.getContext('2d')!, w)
      ctx.drawImage(tile, 0, 0, CELL, CELL)
      return
    }
    case 'ui':
      if (id === 'ribbon') {
        ctx.restore()
        blitBanner(ctx, 4, CELL / 2 - CELL * 0.12, CELL - 8, CELL * 0.24, { procedural: true })
        return
      }
      if (UI_ICON_IDS.includes(id as UiIconId)) {
        paintUiIcon(ctx, id as UiIconId, half * 1.4, { procedural: true })
      } else if (id.startsWith('icon-')) {
        // The vector glyph the painting has to beat, filled from the same
        // `Path2D` list `GameIcon` renders — one path, nonzero, so the holes
        // that are meant to be holes stay holes.
        const name = id.slice('icon-'.length)
        const subPaths = isGameIconName(name) ? ICON_PATHS[name] : null
        if (subPaths?.length) {
          const box = half * 1.4
          ctx.translate(-box / 2, -box / 2)
          ctx.scale(box / 24, box / 24)
          const path = new Path2D()
          for (const d of subPaths) path.addPath(new Path2D(d))
          ctx.fillStyle = '#ffffff'
          ctx.fill(path, 'nonzero')
        }
      }
      break
  }
  ctx.restore()
}

const drawPainted = (
  ctx: CanvasRenderingContext2D, kind: string, id: string, half: number
): void => {
  if (kind === 'bug') {
    const frame = bugFrame(id as BugId, 0)
    if (!frame) return
    const edge = bugFrameEdge(id as BugId)
    const k = (half * 2) / Math.max(1, edge)
    ctx.drawImage(frame, CELL / 2 - edge * k / 2, CELL / 2 - edge * k / 2, edge * k, edge * k)
    return
  }
  if (kind === 'shoe') {
    const img = shoeSprite(id as ShoeId)
    if (!img || !img.naturalWidth) return
    const w = half * 2 * (SHOE_BOX.w / SHOE_BOX.h)
    const h = half * 2
    ctx.drawImage(img, CELL / 2 - w / 2, CELL / 2 - h * 0.5, w, h)
    return
  }
  if (kind === 'bg') {
    const img = spriteFor('bg', id)
    if (!img || !img.naturalWidth) return
    ctx.drawImage(img, 0, 0, CELL, CELL)
    return
  }
  if (kind === 'ui' && id === 'ribbon') {
    const img = spriteFor('ui', 'ribbon')
    if (!img || !img.naturalWidth) return
    blitBanner(ctx, 4, CELL / 2 - CELL * 0.12, CELL - 8, CELL * 0.24)
    return
  }
  if (kind === 'fx' && id.startsWith('splat')) {
    // Through the game's own path, not a raw blit of the file: the file is a
    // FOUR-PANEL greyscale strip, so blitting it whole would show a squashed
    // contact sheet in grey and answer nothing. `paintSplat` slices it, tints it
    // and places it exactly as the floor does.
    ctx.save()
    ctx.translate(CELL / 2, CELL / 2)
    paintSplat(ctx, half / SPLAT_REACH[id as SplatSheetId], SPLAT_AB_GOO, 5,
      id === 'splat-confetti' ? 'confetti' : 'ooze', 1, 0, { opaque: true })
    ctx.restore()
    return
  }
  const img = spriteFor(kind as Parameters<typeof spriteFor>[0], id)
  if (!img || !img.naturalWidth) return
  ctx.drawImage(img, CELL / 2 - half, CELL / 2 - half, half * 2, half * 2)
}

/** The goo the splat A/B is tinted with: the SPRINTER's own, straight out of
 *  `bugs.ts`. The sheet is greyscale by contract, so a grey A/B would be judging
 *  the one thing the player never sees — it has to be looked at tinted. */
const SPLAT_AB_GOO = 'rgb(46,232,196)'

const draw = async (): Promise<void> => {
  primeBugs(BUGS.map((b) => b.id), 3)
  for (let i = 0; i < 40; i++) if (bakeSlice(20)) break
  await new Promise((r) => requestAnimationFrame(() => r(null)))
  const root = gridRef.value
  if (!root) return
  for (const el of root.querySelectorAll<HTMLCanvasElement>('canvas[data-key]')) {
    const key = el.dataset.key!
    const mode = el.dataset.mode as 'drawn' | 'painted' | 'both'
    const row = rows.value.find((r) => r.key === key)
    if (row) cell(el, row, mode)
  }
  // Keep the floor cache honest with whatever the flag now says.
  void floorTile(world.value)
  probeTick.value++
}

/**
 * The brand bitmaps, at the sizes they are actually shown.
 *
 * Neither is probed — the splash reads them off disk on every build — so they
 * have no drawn/painted A/B to sit in the grid above. What they DO need is the
 * same acceptance test everything else gets: the mascot is 200-340 px on the
 * splash but the logo lands on a portal tile at 64, and a wordmark that is mud
 * at 64 is a store listing nobody clicks.
 */
const BRAND_SIZES = [24, 40, 64, 120, 200]
const brand = Object.entries(ART_BRAND).map(([name, rel]) => ({
  name,
  rel,
  // Cache-busted per page load so a freshly sliced painting is not served from
  // the last visit's memory cache — the whole reason to open this page.
  src: `${prependBaseUrl(rel)}?v=${Date.now()}`
}))

let timer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  void draw()
  // The probes settle asynchronously, so a redraw a few times over the first
  // couple of seconds is what makes the page correct without a subscription.
  let n = 0
  timer = setInterval(() => { void draw(); if (++n > 6 && timer) clearInterval(timer) }, 700)
})

onUnmounted(() => { if (timer) clearInterval(timer) })

watch(world, () => { void draw() })

void BANNER
</script>

<template lang="pug">
  .playground
    header
      h1 Playground
      p.lede
        | What came back, against the drawing it replaces. The third column lays the
        |  painting over the drawing at half opacity — a return that registers sits
        |  exactly on it.
      .bar
        button(@click="toggle") Painted art: {{ artOn ? 'ON' : 'OFF' }}
        button.ghost(@click="refresh") Re-probe
        span.status {{ paintedCount }} / {{ rows.length }} painted · source: {{ source }}

    section.brand
      h2 Brand — never probed, always shipped
      p.lede
        | The splash reads these off disk on every build, art layer or not. Each one
        |  at the sizes it is actually seen at.
      .brand-rows
        .brand-row(v-for="b in brand" :key="b.name")
          .meta
            strong {{ b.name }}
            code {{ b.rel }}
          .brand-sizes
            figure(v-for="px in BRAND_SIZES" :key="px")
              .shot(:style="{ width: `${px}px`, height: `${px}px` }")
                img(:src="b.src" :alt="b.name")
              figcaption {{ px }} px

    .grid(ref="gridRef")
      .row(v-for="row in rows" :key="row.key" :class="{ 'is-missing': !row.painted }")
        .meta
          strong {{ row.label }}
          code {{ row.target }}
          span.tag(v-if="!row.painted") drawn only
        .cells
          figure
            canvas(:data-key="row.key" data-mode="drawn" :width="CELL" :height="CELL")
            figcaption drawn
          figure
            canvas(:data-key="row.key" data-mode="painted" :width="CELL" :height="CELL")
            figcaption painted
          figure
            canvas(:data-key="row.key" data-mode="both" :width="CELL" :height="CELL")
            figcaption overlaid
</template>

<style scoped lang="sass">
.playground
  min-height: 100vh
  height: 100vh
  overflow-y: auto
  padding: 24px
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

.brand
  margin: 0 0 26px
  padding: 14px
  border: 1px solid #242c36
  border-radius: 8px
  background: #11161d

h2
  margin: 0 0 4px
  font-size: 16px

.brand-rows
  display: flex
  flex-direction: column
  gap: 14px

.brand-row
  display: flex
  align-items: center
  flex-wrap: wrap
  gap: 16px

.brand-sizes
  display: flex
  align-items: flex-end
  gap: 14px

  figure
    margin: 0
    text-align: center

  figcaption
    color: #7d8894
    font-family: ui-monospace, monospace
    font-size: 11px

// A checker under each one, so a bitmap that lost its transparency says so.
.shot
  display: grid
  place-items: center
  background-image: linear-gradient(45deg, #222833 25%, transparent 25%), linear-gradient(-45deg, #222833 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #222833 75%), linear-gradient(-45deg, transparent 75%, #222833 75%)
  background-size: 12px 12px
  background-position: 0 0, 0 6px, 6px -6px, -6px 0
  background-color: #1a1f28

  img
    width: 100%
    height: 100%
    object-fit: contain

.bar
  display: flex
  align-items: center
  gap: 10px
  margin-bottom: 24px

button
  padding: 9px 16px
  border: 1px solid #2f7d9e
  border-radius: 7px
  background: #14364a
  color: #cfeeff
  font: inherit
  font-weight: 600
  cursor: pointer

  &.ghost
    border-color: #2a323d
    background: transparent
    color: #9aa7b4

.status
  color: #7fe0ff
  font-family: ui-monospace, monospace
  font-size: 13px

.grid
  display: flex
  flex-direction: column
  gap: 10px

.row
  display: flex
  align-items: center
  gap: 18px
  padding: 8px 10px
  border: 1px solid #242c36
  border-radius: 8px
  background-color: #12171f

  &.is-missing
    opacity: 0.72

.meta
  display: flex
  flex-direction: column
  gap: 2px
  width: 16rem
  flex: 0 0 auto

code
  color: #7fe0ff
  font-family: ui-monospace, monospace
  font-size: 11px

.tag
  align-self: flex-start
  padding: 1px 6px
  border-radius: 999px
  background: #3a2a12
  color: #ffc86b
  font-size: 11px

.cells
  display: flex
  gap: 10px

figure
  margin: 0
  text-align: center

canvas
  display: block
  border-radius: 6px

figcaption
  margin-top: 2px
  color: #7d8894
  font-size: 11px
</style>
