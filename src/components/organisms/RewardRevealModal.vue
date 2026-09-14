<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import FReward from '@/components/atoms/FReward.vue'
import GameIcon from '@/components/icons/GameIcon.vue'
import { playFx } from '@/use/useGameAudio'
import { paintShoe, shoeSprite, SHOE_BOX } from '@/game/footArt'
import { shoeSpec } from '@/game/shoes'
import { paintBug, BUG_R_FRAC } from '@/game/bugArt'
import { paintFloorTile, FLOOR_TILE_PX } from '@/game/floorArt'
import { WORLDS } from '@/game/stages'
import type { CampaignReward } from '@/game/campaignRewards'

/**
 * ─── The gift screen ────────────────────────────────────────────────────────
 *
 * One thing won, presented as a present: `FReward` with its `reveal` burst on —
 * a slowly turning wheel of light and dark rays, a warm glow pooled behind the
 * prize, and the pop the stage banner lands with — a headline on the ribbon,
 * and a big picture of the thing itself.
 *
 * Six kinds of thing, catalogued in `game/campaignRewards.ts`. Which ones a
 * level result earned is arithmetic and lives there; this file is the theatre.
 *
 * ── The picture is THE GAME'S OWN DRAWING ──
 *
 * Not an illustration of the prize and not an icon: a shoe is drawn with
 * `paintShoe`, a bug with `paintBug` and a world with `paintFloorTile` — the
 * exact functions the renderer uses on the board — into a canvas. The thing
 * handed over and the thing played with are one object, and a painted override
 * dropped into `images/` changes both at once. The same rule `ShoeCard.vue`
 * follows in the Locker, and for the same reason: a lookalike is the one place
 * where the art can silently drift out of agreement with itself.
 *
 * Three of the six have no object to draw — a star total, a score and a pile of
 * coins are numbers — so those get a glyph from the shared icon set at card
 * size, which is the honest answer rather than a stock illustration.
 *
 * ── The queue ──
 *
 * Several things can be won at once: clearing the boss of world 1 opens world 2
 * AND lands a star milestone. Two modals would fight over the screen and the
 * player would see one of them for a frame. So this component owns a QUEUE: it
 * snapshots whatever it was handed when it opened, shows the items one at a
 * time — each with its own reveal and its own cue — and emits `done` only when
 * the last one has been tapped away. Anything that arrives while it is already
 * open is appended behind what is on screen, never swapped in front of it.
 *
 * ── Mounting it ──
 *
 *   <RewardRevealModal v-model="showReveals" :reward="pendingReveals" @done="onRevealsDone" />
 *
 * `reward` takes one reward or an array of them. Set it, then open. On `done`
 * the parent is free to show its result screen.
 */

interface Props {
  /** v-model: is a gift screen up? */
  modelValue: boolean
  /** What was won — one thing, or everything won at the same moment. */
  reward?: CampaignReward | readonly CampaignReward[] | null
}

const props = withDefaults(defineProps<Props>(), { reward: null })

const emit = defineEmits<{
  (e: 'update:modelValue', open: boolean): void
  /** Every queued reward has been shown and tapped away. */
  (e: 'done'): void
}>()

const { t } = useI18n()

// ─── The queue ──────────────────────────────────────────────────────────────

const queue = ref<CampaignReward[]>([])
const index = ref(0)
const current = computed<CampaignReward | null>(() => queue.value[index.value] ?? null)

const normalise = (r: Props['reward']): CampaignReward[] => {
  if (!r) return []
  return Array.isArray(r) ? [...(r as readonly CampaignReward[])] : [r as CampaignReward]
}

/**
 * The cue each kind arrives on.
 *
 * Two sounds, both of which the game already owns: `unlock` (the level-up
 * sample) for a thing that is now YOURS, `star` (the happy sample) for a number
 * that went up. No new cue is introduced — a gift screen that announces itself
 * with a sound nothing else in the game makes reads as a different game.
 */
const cueFor = (r: CampaignReward): 'unlock' | 'star' =>
  r.kind === 'stars' || r.kind === 'record' ? 'star' : 'unlock'

const present = (): void => {
  const r = current.value
  if (!r) return
  playFx(cueFor(r))
  // The canvas is only in the DOM once the kind that needs it has rendered.
  // Wrapped rather than passed by reference: this runs from a watcher with
  // `immediate`, which fires DURING setup — before `draw` below has been
  // initialised — and `nextTick(draw)` would read it in its temporal dead zone.
  void nextTick(() => draw())
}

const finish = (): void => {
  queue.value = []
  index.value = 0
  emit('update:modelValue', false)
  emit('done')
}

const advance = (): void => {
  if (index.value < queue.value.length - 1) {
    index.value += 1
    present()
    return
  }
  finish()
}

/**
 * The last `reward` prop this component acted on.
 *
 * A plain variable, not a ref: it exists only to tell "the parent handed me
 * something new" from "the open watcher already took this". Without it, a
 * parent that sets `reward` and `modelValue` in the same tick gets both
 * watchers firing against the same array and every prize shown twice.
 */
let lastSeen: Props['reward'] = null

watch(() => props.modelValue, (open) => {
  if (!open) {
    queue.value = []
    index.value = 0
    lastSeen = null
    return
  }
  lastSeen = props.reward
  queue.value = normalise(props.reward)
  index.value = 0
  // Opened with nothing to give. Close immediately and tell the parent — an
  // empty gift screen is a tap the player has to spend on nothing, and the
  // caller is usually waiting on `done` to show its own screen.
  if (queue.value.length === 0) {
    finish()
    return
  }
  present()
}, { immediate: true })

watch(() => props.reward, (r) => {
  if (!props.modelValue) return
  if (r === lastSeen) return
  lastSeen = r
  const more = normalise(r)
  if (more.length === 0) return
  // BEHIND what is on screen. A prize that replaced the one the player is
  // looking at would be a screen that changed under their thumb.
  queue.value = [...queue.value, ...more]
})

// ─── The picture ────────────────────────────────────────────────────────────

/** Kinds that draw themselves with the renderer's own paint functions. */
const usesCanvas = computed(() =>
  current.value?.kind === 'shoe' || current.value?.kind === 'foe' || current.value?.kind === 'world')

const canvasRef = ref<HTMLCanvasElement | null>(null)

/**
 * Draw the current prize into the card's canvas.
 *
 * Sized from its own laid-out box times the device pixel ratio (capped at 2),
 * so the drawing is crisp on a phone at dpr 3 without costing four times the
 * pixels on a desktop at dpr 1 — the same treatment `ShoeCard` gives its own.
 *
 * Returns quietly with no 2-D context: jsdom has none, and the card's ribbon,
 * caption and layout are all still worth rendering (and testing) without it.
 */
const draw = (): void => {
  const c = canvasRef.value
  const r = current.value
  if (!c || !r) return
  const rect = c.getBoundingClientRect()
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const w = Math.max(1, Math.round(rect.width * dpr))
  const h = Math.max(1, Math.round(rect.height * dpr))
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h }
  const ctx = c.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, w, h)

  if (r.kind === 'shoe') {
    ctx.save()
    // The origin sits HIGH in the box, because the ankle and lower leg run back
    // out of the heel and fade over nearly three half-lengths (`SHOE_BOX` is
    // 4.4 tall for a shoe that is 2 long). At 0.36 down and a 0.30 half-length
    // the toe lands just inside the top and the HEEL — the last part of the
    // shoe proper — sits at 0.66, well clear of the bottom.
    //
    // The leg still runs off the card, and that is deliberate: sized to contain
    // all 4.4 the shoe shrinks to a thumbnail, which is the wrong answer on the
    // one screen whose whole job is to show the player what they got. What was
    // wrong before was not the overflow but its EDGE — at this size the leg is
    // still opaque where the canvas ends, so it finished in a hard horizontal
    // cut that read as a rendering bug. `.is-shoe` fades the bottom of the
    // canvas out instead; see the stylesheet.
    ctx.translate(w / 2, h * 0.36)
    const half = Math.min(w, h) * 0.3
    const painted = shoeSprite(r.shoe)
    if (painted && painted.naturalWidth > 0) {
      const pw = half * SHOE_BOX.w
      const ph = pw * (painted.naturalHeight / painted.naturalWidth)
      // Anchored on the TOE, exactly as the renderer and the Locker do it — the
      // constant, not a copy of its value, so a change to the authoring box
      // cannot leave this card drawing a painted shoe somewhere else.
      ctx.drawImage(painted, -pw / 2, -ph * SHOE_BOX.toeFromTop, pw, ph)
    } else {
      paintShoe(ctx, r.shoe, shoeSpec(r.shoe), half)
    }
    ctx.restore()
    return
  }

  if (r.kind === 'foe') {
    ctx.save()
    ctx.translate(w / 2, h / 2)
    // `BUG_R_FRAC` is the share of a square frame a body fills — the same
    // number the sprite baker uses — so a bug on this card is the size it is
    // on the board, scaled up.
    paintBug(ctx, r.bug, (Math.min(w, h) / 2) * BUG_R_FRAC, 0.25)
    ctx.restore()
    return
  }

  // The three number-shaped kinds draw a glyph in the template and never reach
  // the canvas at all.
  if (r.kind !== 'world') return

  // A world has no single object to show, so the card shows the PLACE: four
  // copies of that world's own floor tile. `paintFloorTile` wants a
  // `FLOOR_TILE_PX`-square context, so it gets a scratch one and the result is
  // scaled in. Deliberately NOT `floorTile()`, which caches into the renderer's
  // own map — a modal must not grow the field's bake cache.
  const tile = document.createElement('canvas')
  tile.width = FLOOR_TILE_PX
  tile.height = FLOOR_TILE_PX
  const tg = tile.getContext('2d')
  if (!tg) return
  paintFloorTile(tg, r.world)
  const s = Math.min(w, h)
  const half = s / 2
  const ox = (w - s) / 2
  const oy = (h - s) / 2
  for (let ty = 0; ty < 2; ty++) {
    for (let tx = 0; tx < 2; tx++) {
      ctx.drawImage(tile, ox + tx * half, oy + ty * half, half, half)
    }
  }
}

// Redraw whenever the prize changes, and whenever the card's box does — a
// canvas whose backing store no longer matches its box is a blurry prize, and
// a rotation inside an open modal is the only way to catch it.
watch(current, () => { void nextTick(() => draw()) })

// The canvas is `v-if`'d in and out as the queue steps between kinds, so the
// observer follows the element rather than being attached once on mount.
let ro: ResizeObserver | null = null
watch(canvasRef, (el) => {
  ro?.disconnect()
  ro = null
  if (!el || typeof ResizeObserver === 'undefined') return
  ro = new ResizeObserver(() => draw())
  ro.observe(el)
})
onBeforeUnmount(() => { ro?.disconnect(); ro = null })

// ─── The words ──────────────────────────────────────────────────────────────

/** The ribbon headline — one short line per kind. */
const headline = computed(() => {
  const r = current.value
  if (!r) return ''
  return t(`reveal.${r.kind}`)
})

/**
 * The line under the picture: what the thing is CALLED.
 *
 * Every name comes from a key that already exists and is already translated
 * into all 21 locales — the worlds, the bestiary and the Locker all name their
 * own contents — so a gift screen cannot invent a second name for a thing the
 * player has seen named elsewhere.
 */
const caption = computed(() => {
  const r = current.value
  if (!r) return ''
  switch (r.kind) {
    case 'world': return t(`worlds.${WORLDS[r.world].theme}`)
    case 'shoe': return t(`shoes.${r.shoe}.name`)
    case 'foe': return t(`bugs.${r.bug}`)
    case 'stars': return t('reveal.starsTotal', { n: r.stars })
    case 'record': return t('reveal.recordScore', { n: r.score })
    case 'chest': return t('reveal.chestCoins', { n: r.coins })
  }
})

/** The small grey line under the caption, where there is something more to
 *  say. Only the record card has one: the number it beat. */
const subCaption = computed(() => {
  const r = current.value
  return r?.kind === 'record' ? t('reveal.recordBeat', { n: r.previous }) : ''
})
</script>

<template lang="pug">
  //- `showContinue` is always on: a gift screen with no way out is a trap, and
  //- the tap that dismisses it is the same tap that advances the queue.
  FReward(
    :model-value="modelValue"
    :show-continue="true"
    :reveal="true"
    @continue="advance"
  )
    template(#ribbon)
      span {{ headline }}

    div.reveal-card(v-if="current" :class="`is-${current.kind}`")
      //- ── The picture ─────────────────────────────────────────────────
      div.reveal-card__art
        canvas.reveal-card__canvas(
          v-if="usesCanvas"
          ref="canvasRef"
          :class="{ 'is-framed': current.kind === 'world', 'is-shoe': current.kind === 'shoe' }"
        )
        //- The three that are numbers rather than objects: a star total, a
        //- score and a pile of coins. Each gets the glyph the rest of the game
        //- already marks that idea with, at card size — never a second drawing
        //- of a star, and never an illustration nothing else in the game uses.
        //-
        //- The chest card shows the CHEST rather than a coin, and deliberately:
        //- it is the glyph on the thing the player just tapped, so the present
        //- and the button that produced it are recognisably one object. The
        //- coins are the caption.
        GameIcon.reveal-card__glyph(v-else-if="current.kind === 'stars'" name="star")
        GameIcon.reveal-card__glyph.is-trophy(v-else-if="current.kind === 'record'" name="trophy")
        GameIcon.reveal-card__glyph.is-chest(v-else name="chest")

      //- ── The name ────────────────────────────────────────────────────
      p.reveal-card__caption {{ caption }}
      p.reveal-card__sub(v-if="subCaption") {{ subCaption }}

      //- The count of things won, when there is more than one waiting. A child
      //- who has just been handed four presents should be able to see that
      //- three more are coming rather than discovering it by tapping.
      p.reveal-card__pager(v-if="queue.length > 1" aria-hidden="true")
        span.reveal-card__pip(
          v-for="(r, i) in queue"
          :key="i"
          :class="{ 'is-on': i <= index }"
        )
</template>

<style scoped lang="sass">
// Everything is `clamp(rem, vmin, rem)`. The card has to survive a 320x658
// portrait phone and a 500 px-tall landscape embed inside the same stylesheet,
// and `vmin` is the only unit that shrinks for both.
.reveal-card
  display: flex
  flex-direction: column
  align-items: center
  gap: clamp(0.3rem, 1.8vmin, 0.8rem)
  width: 100%
  max-width: min(90vw, 24rem)
  padding-inline: clamp(0.5rem, 3vmin, 1rem)

.reveal-card__art
  position: relative
  display: flex
  align-items: center
  justify-content: center
  width: clamp(6rem, 34vmin, 12rem)
  // Square by ratio, never by a height — the box follows the width and can
  // never collapse to nothing on a short viewport.
  aspect-ratio: 1 / 1

.reveal-card__canvas
  display: block
  width: 100%
  height: 100%
  filter: drop-shadow(0 0.1em 0.25em rgba(43, 27, 46, 0.55))

  // The shoe is drawn big enough to be looked at, which sends the lower leg
  // off the bottom of the canvas. Fading the last quarter turns that overflow
  // into the vanishing the leg already is, instead of a hard horizontal cut.
  // See the sizing comment in `draw()`.
  &.is-shoe
    -webkit-mask-image: linear-gradient(to bottom, #000 0 72%, transparent 97%)
    mask-image: linear-gradient(to bottom, #000 0 72%, transparent 97%)

  // A floor tile is a flat rectangle of pattern, so it needs a frame to read as
  // a picture of a place rather than as the modal's own background.
  &.is-framed
    border: 0.2em solid #2b1b2e
    border-radius: clamp(0.4rem, 2vmin, 0.9rem)
    box-shadow: 0 0.15em 0.4em rgba(43, 27, 46, 0.6)

.reveal-card__glyph
  width: 72%
  height: 72%
  color: #ffd93c
  filter: drop-shadow(0 0.06em 0 #2b1b2e) drop-shadow(0 0.12em 0.3em rgba(43, 27, 46, 0.6))

  &.is-trophy
    color: #ffe7a1

  &.is-chest
    color: #f5a842

.reveal-card__caption
  margin: 0
  color: #fff
  font-weight: 900
  text-transform: uppercase
  text-align: center
  text-wrap: balance
  line-height: 1.1
  font-size: clamp(0.9rem, 4.6vmin, 1.5rem)
  text-shadow: 0.09em 0.09em 0 #000, -0.03em -0.03em 0 #000, 0.03em -0.03em 0 #000, -0.03em 0.03em 0 #000, 0.03em 0.03em 0 #000

.reveal-card__sub
  margin: 0
  color: #cfd8ea
  font-weight: 700
  text-align: center
  line-height: 1.2
  font-size: clamp(0.62rem, 3vmin, 0.95rem)
  text-shadow: 0.08em 0.08em 0 rgba(0, 0, 0, 0.8)

.reveal-card__pager
  display: flex
  align-items: center
  justify-content: center
  gap: clamp(0.2rem, 1.2vmin, 0.4rem)
  margin: 0

.reveal-card__pip
  display: block
  width: clamp(0.32rem, 1.6vmin, 0.5rem)
  height: clamp(0.32rem, 1.6vmin, 0.5rem)
  border-radius: 999px
  background-color: rgba(255, 255, 255, 0.24)

  &.is-on
    background-color: #ffd93c
</style>
