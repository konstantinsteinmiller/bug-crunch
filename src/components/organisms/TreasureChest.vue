<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { addCoins } from '@/use/useSplatProgress'
import { playFx } from '@/use/useGameAudio'
import { spawnCoinExplosion } from '@/use/useCoinExplosion'
import IconCoin from '@/components/icons/IconCoin.vue'
import { useArtImage } from '@/use/useArtImage'
import { BIG_REWARD, useTreasureChest, type ChestPhase } from '@/use/useTreasureChest'

/**
 * ─── The idle chest, on the HUD ─────────────────────────────────────────────
 *
 * Everything about WHEN it pays and HOW MUCH lives in `useTreasureChest.ts`;
 * this file is the chest itself — the art, the drain over it, the payout chip
 * under it, and the coins that fly to the wallet when it opens.
 *
 * The state is persisted through the unified `bugcrunch_state` blob, so the fill
 * clock and the day's ledger ride the SaveManager's cloud push with the rest of
 * the player's progress. See `CHEST_KEY` / `CHEST_DAY_KEY` in `keys.ts`.
 *
 * ── It pays the wallet itself ──
 *
 * `collect()` deliberately does not touch the wallet, so that this component
 * owns the whole transaction: the coins, the noise and the VFX in one place.
 * A parent must NOT add the emitted coins again — `claimed` is a notification
 * (raise a reveal, log an event), not a request.
 */

interface Props {
  /** Element the coin explosion flies to — the `CoinBadge`'s root. Optional:
   *  with nothing to fly to the chest still pays, it just pops instead. */
  targetEl?: HTMLElement | null
}

const props = withDefaults(defineProps<Props>(), {
  targetEl: null
})

const emit = defineEmits<{
  /** The chest was opened and the wallet has ALREADY been paid. `gold` marks
   *  the ten-minute prize, which is the only one worth a reveal screen. */
  (e: 'claimed', payload: { coins: number; phase: ChestPhase; gold: boolean }): void
}>()

const { t } = useI18n()

const {
  phase, reward, isReady, isSpent, timeDisplay, shutterPct, collect
} = useTreasureChest()

/**
 * The painted chest, once the art pipeline has produced one and the art layer
 * is on — otherwise `null` and the SVG below draws it.
 *
 * The chest is one of the few marks this game draws twice over: the drawing has
 * to stay, because the flag is off on every portal build until the art is
 * signed off, and a HUD reward that is invisible on the build a reviewer sees
 * is worse than no reward at all.
 *
 * NOTE for whoever paints it: `images/ui/chest.webp` in this repo is inherited
 * from the game this was forked out of and is DARK IRON — black straps, cold
 * rim light, dungeon palette. It is wrong for Bug Crunch and will look wrong the
 * moment the art flag goes on. The drawing below is the reference: warm wood,
 * one key light from the upper left, `#2b1b2e` ink, no black.
 */
const painted = useArtImage('ui', 'chest')

const rootEl = ref<HTMLElement | null>(null)

const onClick = (): void => {
  const won = collect()
  if (won <= 0) return
  const gold = won >= BIG_REWARD
  addCoins(won)
  // ONE cue, not two: `spawnCoinExplosion` plays its own sample as the coins
  // leave, so the synth coin only stands in when there is no badge to fly to
  // (the chest mounted outside the HUD, or a test harness).
  if (rootEl.value && props.targetEl) {
    spawnCoinExplosion({ sourceEl: rootEl.value, targetEl: props.targetEl })
  } else {
    playFx('coin')
  }
  emit('claimed', { coins: won, phase: phase.value, gold })
}
</script>

<template lang="pug">
  //- ── The chest's column ──────────────────────────────────────────────────
  //-
  //- A wrapper rather than the button itself, so the `under` slot can hang
  //- something beneath the chest that TRAVELS WITH IT — mounted, hidden and
  //- moved as one thing by whoever placed the chest, with no second wiring in
  //- the scene. The slot is deliberately outside the `<button>`: anything in
  //- there would otherwise join the chest's hit area and its accessible name.
  //-
  //- The wrapper states no width. `.chest` keeps the exact box it always had —
  //- the `chest` tutorial lesson aims at its centre via `elCentre('.chest',
  //- '.scene__wallet')` — and the slot's content is free to be a little wider
  //- or narrower without moving it.
  div.chest-col
    //- A real button: it is a control, it is reached by keyboard, and a screen
    //- reader has to be told which of the three states it is in — the count is a
    //- number on a chip, which is announced as nothing at all.
    button.chest(
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
      div.chest__art(v-if="painted")
        img.chest__img(:src="painted" alt="" draggable="false")
        div.chest__shade(
          v-if="isSpent || phase === 'cooldown'"
          :style="{ '--chest-mask': `url('${painted}')` }"
        )
          div.chest__shade-fill(:style="{ height: `${shutterPct * 100}%` }")

      //- ── The drawing ─────────────────────────────────────────────────────
      //-
      //- Bug Crunch's own art direction, not the dark-iron chest this was ported
      //- from. Four rules, the same four every other drawable in this game
      //- follows (`inkArt.ts`):
      //-
      //-   • ONE ink colour, `#2b1b2e` — a warm near-black. Pure #000 reads as
      //-     clip-art, and a cast outlined in three different blacks reads as
      //-     three casts.
      //-   • ONE key light, upper LEFT (`SHADOW_DIR` 1.05 rad puts every shadow
      //-     down-and-right). So: the soft highlight sits on the lid's top-left
      //-     shoulder and the hard cel shadow is a drawn SHAPE down the right
      //-     side — authored geometry, never a computed gradient.
      //-   • Fat, even ink and generous corner radii, because the audience starts
      //-     at six and the whole chest is about 38 px tall on a phone. Anything
      //-     finer than ~2.4 units in this 64-unit box disappears at that size.
      //-   • Warm honey wood and a butter-gold clasp. No grey, no black, no
      //-     rivets: this is a present, not a strongbox.
      //-
      //- The cooldown overlay lives inside the same SVG so a clipPath built from
      //- the lid + body can mask it to the chest's silhouette — the drain
      //- shrinks within the outline rather than as a rectangle over the box.
      svg.chest__svg(v-else viewBox="0 0 64 64")
        defs
          linearGradient(id="sxChestBody" x1="0" y1="0" x2="0" y2="1")
            stop(offset="0" stop-color="#ffc76f")
            stop(offset="1" stop-color="#e8862a")
          linearGradient(id="sxChestLid" x1="0" y1="0" x2="0" y2="1")
            stop(offset="0" stop-color="#ffe6ab")
            stop(offset="1" stop-color="#f5a842")
          linearGradient(id="sxChestClasp" x1="0" y1="0" x2="0" y2="1")
            stop(offset="0" stop-color="#fff0b4")
            stop(offset="1" stop-color="#efb02c")
          //- The silhouette: lid + body + lip, as one clip region.
          clipPath(id="sxChestClip")
            path(d="M9 33 C9 18 18 12.5 32 12.5 C46 12.5 55 18 55 33 Z")
            rect(x="7" y="30" width="50" height="6.5" rx="3.2")
            rect(x="9.5" y="34" width="45" height="20" rx="4.5")
          //- The body alone, for the cel shadow that must not spill onto the lid.
          clipPath(id="sxChestBodyClip")
            rect(x="9.5" y="34" width="45" height="20" rx="4.5")
          clipPath(id="sxChestLidClip")
            path(d="M9 33 C9 18 18 12.5 32 12.5 C46 12.5 55 18 55 33 Z")

        //- Contact shadow. Soft and offset down-and-right, so the chest sits on
        //- the HUD instead of floating over it.
        ellipse(cx="33.5" cy="55.5" rx="21" ry="3.6" fill="#2b1b2e" opacity="0.16")

        //- ── The box ──
        g(stroke="#2b1b2e" stroke-width="2.6" stroke-linejoin="round")
          rect(x="9.5" y="34" width="45" height="20" rx="4.5" fill="url(#sxChestBody)")
          path(d="M9 33 C9 18 18 12.5 32 12.5 C46 12.5 55 18 55 33 Z" fill="url(#sxChestLid)")
          rect(x="7" y="30" width="50" height="6.5" rx="3.2" fill="url(#sxChestLid)")

        //- ── Cel shading: drawn shapes, hard edges, clipped to their own part ──
        g(clip-path="url(#sxChestBodyClip)")
          path(d="M44 32 C47.5 40 47 48 43.5 56 L58 56 L58 32 Z" fill="#c96a16" opacity="0.42")
        g(clip-path="url(#sxChestLidClip)")
          path(d="M43 10 C49 16 50.5 25 49.5 35 L59 35 L59 10 Z" fill="#d98a22" opacity="0.36")
          //- The key light: one soft smear on the top-left shoulder. An ellipse
          //- rather than a gradient, because a cel painter puts a highlight where
          //- it reads, not where the maths says.
          ellipse(cx="22" cy="21.5" rx="8" ry="3.6" fill="#fff6df" opacity="0.55" transform="rotate(-22 22 21.5)")

        //- One plank seam. A single line, low on the body where it will not
        //- collide with the clasp — two lines turn to mush at HUD size.
        path(
          d="M12.5 48.5 H51.5"
          stroke="#c96a16"
          stroke-width="1.8"
          stroke-linecap="round"
          opacity="0.5"
        )

        //- ── The clasp ──
        g(stroke="#2b1b2e" stroke-width="2.4" stroke-linejoin="round")
          rect(x="26.5" y="28" width="11" height="14" rx="3.2" fill="url(#sxChestClasp)")
        //- Keyhole: a disc and a tapering slot, ink on gold.
        path(
          d="M32 33.2 a2.1 2.1 0 1 1 0.01 0 M30.9 35.2 h2.2 l0.7 3.4 h-3.6 Z"
          fill="#2b1b2e"
        )

        //- ── Sparkles ──
        //- Only on the gold chest, and only three of them. A permanent twinkle is
        //- wallpaper; one that arrives when the prize turns gold is a signal.
        g.chest__sparks(v-if="phase === 'big' && !isSpent" fill="#fff3c4")
          path(d="M50 17 q0.7 2.6 3.3 3.3 q-2.6 0.7 -3.3 3.3 q-0.7 -2.6 -3.3 -3.3 q2.6 -0.7 3.3 -3.3 Z")
          path(d="M14 25 q0.5 1.9 2.4 2.4 q-1.9 0.5 -2.4 2.4 q-0.5 -1.9 -2.4 -2.4 q1.9 -0.5 2.4 -2.4 Z")
          path(d="M53 42 q0.45 1.7 2.2 2.2 q-1.7 0.45 -2.2 2.2 q-0.45 -1.7 -2.2 -2.2 q1.7 -0.45 2.2 -2.2 Z")

        //- Cooldown / spent overlay, clipped to the chest outline. A warm ink
        //- veil rather than 50 % black: this palette has no black in it, and a
        //- neutral grey wash turns the honey wood to mud.
        rect(
          v-if="isSpent || phase === 'cooldown'"
          x="0"
          :y="64 * (1 - shutterPct)"
          width="64"
          :height="64 * shutterPct"
          fill="rgba(43, 27, 46, 0.55)"
          clip-path="url(#sxChestClip)"
          style="transition: y 0.3s linear, height 0.3s linear"
        )

      //- Status label: a countdown while it fills, the payout once it is ready.
      //-
      //- The row is IN FLOW and reserves its own height, rather than floating
      //- absolutely below the art as it did in the game this came from. There the
      //- chest lived in a corner with nothing under it; here it has to sit inside
      //- a HUD bar that lays elements out, and an absolutely-positioned label is
      //- invisible to that layout — it would hang over whatever is beneath it at
      //- some viewport size and nowhere in the stylesheet would say so.
      //-
      //- The CHIP inside the row is still absolutely centred, because the payout
      //- chip is wider than the chest and must not be allowed to set the
      //- component's width.
      div.chest__label(aria-hidden="true")
        span.chest__timer(v-if="!isReady") {{ timeDisplay }}
        span.chest__payout(v-else :class="{ 'is-big': phase === 'big' }")
          IconCoin.chest__payout-coin
          span.chest__payout-value +{{ reward }}

    //- ── Under the chest ─────────────────────────────────────────────────────
    //- Whatever the scene wants to ride along below it — the play-time quest
    //- badges, in this game. Empty by default and costs a mount when unused.
    slot(name="under")
</template>

<style scoped lang="sass">
// ─── The column ─────────────────────────────────────────────────────────────
//
// The chest, and whatever the `under` slot brought with it, stacked and
// centred. It states NO WIDTH: the chest keeps the `clamp()` box it has always
// had, so the `chest` tutorial lesson still lands on the same centre, and a
// slot item a few pixels wider or narrower cannot shift it.
//
// `pointer-events: none` is the safe default, not a copy-paste: the HUD layer
// above is already non-interactive and `.chest` opts ITSELF back in below, so
// passengers in the slot stay pictures unless they ask not to be.
.chest-col
  display: flex
  flex-direction: column
  align-items: center
  gap: clamp(0.1rem, 0.7vmin, 0.3rem)
  pointer-events: none

// ─── The control ────────────────────────────────────────────────────────────
//
// Every size here is `clamp(rem, vmin, rem)`. `vmin` rather than `vw` because
// the HUD this sits in has to survive a 320x658 portrait phone AND a landscape
// embed 500 px tall — a `vw` chest grows in the one place there is no room for
// it. Nothing is a fixed pixel and nothing can reach zero.
.chest
  position: relative
  display: flex
  flex-direction: column
  align-items: center
  gap: clamp(0.06rem, 0.4vmin, 0.18rem)
  width: clamp(2.4rem, 11vmin, 3.4rem)
  padding: 0
  border: 0
  background: none
  // The HUD layer is `pointer-events: none`; a control inside it has to opt
  // back in or it is a picture.
  pointer-events: auto
  touch-action: manipulation
  -webkit-tap-highlight-color: transparent
  cursor: default

  &:not(:disabled)
    cursor: pointer

  &:not(:disabled):active
    transform: translateY(4%) scale(0.94)

  &:focus-visible
    outline: 0.15rem solid #ffd93c
    outline-offset: 0.15rem
    border-radius: 0.4rem

// ─── The art, painted or drawn ──────────────────────────────────────────────

.chest__art, .chest__svg
  position: relative
  width: 100%
  // Square by ratio, never by a height: the box follows the width at any
  // viewport and can never collapse.
  aspect-ratio: 1 / 1
  filter: drop-shadow(0 0.06em 0.1em rgba(43, 27, 46, 0.45))

.chest__img
  display: block
  width: 100%
  height: 100%
  object-fit: contain

// Masked to the painting's own alpha, so the drain is cut to the chest and not
// to its bounding box. `mask-size: contain` + `center` mirror the `<img>`'s
// `object-fit`, which is what keeps the two in register at any aspect ratio.
.chest__shade
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

.chest__shade-fill
  position: absolute
  left: 0
  right: 0
  bottom: 0
  background-color: rgba(43, 27, 46, 0.55)
  transition: height 0.3s linear

.chest__svg
  display: block
  height: auto

.is-ready .chest__art,
.is-ready .chest__svg
  animation: chest-bob 1s ease-in-out infinite alternate

@keyframes chest-bob
  from
    transform: translateY(0)
  to
    transform: translateY(-7%)

// The ten-minute chest is the one worth waiting for, so it gets a warm gold
// aura — the game's own light, not a rim light on iron.
.is-big .chest__art,
.is-big .chest__svg
  filter: drop-shadow(0 0.06em 0.1em rgba(43, 27, 46, 0.45)) drop-shadow(0 0 0.3em rgba(255, 196, 60, 0.9))

.chest__sparks
  animation: chest-twinkle 1.6s ease-in-out infinite

@keyframes chest-twinkle
  0%, 100%
    opacity: 0.35
  50%
    opacity: 1

// Spent for the day — drained of colour so the chest reads as put away, and the
// countdown underneath is to midnight rather than to a fill that cannot pay.
.is-spent .chest__art,
.is-spent .chest__svg
  filter: drop-shadow(0 0.06em 0.1em rgba(43, 27, 46, 0.45)) grayscale(0.55)
  opacity: 0.72

@media (prefers-reduced-motion: reduce)
  .is-ready .chest__art,
  .is-ready .chest__svg,
  .chest__sparks
    animation: none

// ─── Status label ───────────────────────────────────────────────────────────

.chest__label
  position: relative
  display: flex
  justify-content: center
  width: 100%
  // Reserves the row so the chest's footprint never jumps between the
  // countdown and the payout chip.
  min-height: 1.5em
  font-size: clamp(0.5rem, 2.4vmin, 0.7rem)
  pointer-events: none

.chest__timer, .chest__payout
  position: absolute
  top: 0
  left: 50%
  translate: -50% 0
  white-space: nowrap

.chest__timer
  display: inline-block
  padding: 0.1em 0.5em
  border-radius: 999px
  background-color: rgba(43, 27, 46, 0.78)
  color: #ffe7c2
  font-weight: 900
  line-height: 1.35
  letter-spacing: 0.04em
  text-shadow: 0.08em 0.08em 0 rgba(43, 27, 46, 0.9)

.chest__payout
  display: inline-flex
  align-items: center
  justify-content: center
  gap: 0.25em
  padding: 0.1em 0.5em
  border: 0.16em solid #2b1b2e
  border-radius: 999px
  background-image: linear-gradient(to bottom, #ffe6ab, #f5a842)
  box-shadow: 0 0.1em 0.2em rgba(43, 27, 46, 0.45)
  line-height: 1.3

  // Gold, glowing, and the same warm light the chest itself picks up.
  &.is-big
    background-image: linear-gradient(to bottom, #fff0b4, #efb02c)
    box-shadow: 0 0.1em 0.2em rgba(43, 27, 46, 0.45), 0 0 0.6em rgba(255, 196, 60, 0.8)

.chest__payout-coin
  flex: 0 0 auto
  width: 1.1em
  height: 1.1em
  filter: drop-shadow(0 0.05em 0 rgba(43, 27, 46, 0.5))

.chest__payout-value
  color: #fff
  font-weight: 900
  text-shadow: 0.1em 0.1em 0 #2b1b2e, -0.05em -0.05em 0 #2b1b2e, 0.05em -0.05em 0 #2b1b2e, -0.05em 0.05em 0 #2b1b2e
</style>
