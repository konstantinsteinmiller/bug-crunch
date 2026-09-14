<template lang="pug">
  Transition(name="fade")
    //- Ensure classes with special characters are in parentheses
    div.reward-overlay.fixed.inset-0.flex.flex-col.items-center.justify-center.backdrop-blur-md.touch-none.cursor-pointer(
      v-if="modelValue"
      class="bg-black/60"
      :class="[\
        isAdShowing ? 'z-0' : 'z-[100]',\
        reveal ? 'is-reveal' : '',\
        showContinue && !isCompact ? 'has-floating-hint' : ''\
      ]"
      @click="handleOverlayClick"
    )
      //- ── The reveal ──────────────────────────────────────────────────────
      //- Rays from the centre of the screen, light and dark alternating,
      //- turning slowly, with a warm glow pooled behind whatever is being
      //- presented — the way every mobile game that has ever handed over a
      //- gift hands one over. Opt-in (`reveal`), so the ordinary result screen
      //- stays a result screen and the burst is saved for a prize: a weapon,
      //- a chest, a record. See `revealRays.ts` for the numbers.
      div.reveal(v-if="reveal" aria-hidden="true")
        div.reveal__rays(:style="rayStyle")
        div.reveal__glow
        div.reveal__sparks

      //- The banner: a plate of dark iron sized by its own caption, so the
      //- title is centred by flex and nothing else. The slot content (or a
      //- fallback "Rewards" label) is the whole of what is in it — see
      //- `.banner` for why it is a border-image rather than a picture.
      div.banner.relative.shrink-0.z-10(
        v-if="$slots.ribbon"
        :class="{ 'is-compact': isCompact }"
        :style="bannerStyle"
      )
        div.banner__text
          slot(name="ribbon")
            span {{ t('rewards') }}

      //- Content area. One bounded, scrollable flex child in every mode — see
      //- `.reward-body`.
      //-
      //- The desktop branch used to be `h-full`, which asked for 100% of the
      //- overlay's height while the ribbon was ALSO in the flow above it, so the
      //- column was taller than the screen by exactly one ribbon. That is what
      //- put a scrollbar on the result screen and hid its first line behind the
      //- banner; it never showed up on a phone, because the compact branch was
      //- already doing the right thing.
      div.reward-body.relative
        slot

      //- Tap-to-continue hint. In landscape it sits INLINE in the flow (shrink-0)
      //- so it can never overlap the centred reward content; otherwise it floats
      //- at the bottom of the viewport — and the overlay reserves its whole band
      //- as padding (`has-floating-hint`), so that placement cannot overlap the
      //- content either. See `--rw-hint-band`.
      Transition(name="fade")
        div.reward-hint.flex.justify-center.animate-pulse.pointer-events-none(
          v-if="showContinue"
          :class="isCompact ? 'is-inline shrink-0' : 'is-floating absolute left-0 right-0'"
        )
          div.reward-hint__text.text-white.font-black.uppercase.italic.tracking-widest.brawl-text
            | {{ isMobile ? t('tapToContinue') : t('clickToContinue') }}
</template>

<script setup lang="ts">
import { computed, watch, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { isMobileLandscape, isShortViewport } from '@/use/useUser'
import { BANNER, bannerDataUrl } from '@/game/uiArt'
import { useArtImage } from '@/use/useArtImage'
import { REVEAL_DARK, REVEAL_LIGHT, REVEAL_RAYS, rayGradient } from '@/components/atoms/revealRays'

// "Compact" layout = the short-viewport treatment: mobile landscape OR any
// short embed (≤500px tall, e.g. a CG iframe on a Chromebook). In both cases
// the centred desktop layout overflows, so the banner shrinks and the
// tap/click-to-continue hint flows INLINE below the content (shrink-0) instead
// of floating absolutely at the bottom — where it otherwise overlapped the
// reward button.
const isCompact = computed(() => isMobileLandscape.value || isShortViewport.value)
// Sink the reward overlay below the ad layer whenever an interstitial/rewarded
// is on screen. GameMonetize (and several other portals) inject their ad
// container at a z-index lower than this modal's z-[100], so without this the
// modal — including its backdrop-blur — paints OVER the playing ad.
import { isAdShowing } from '@/use/useGamePause'

const props = defineProps<{
  modelValue: boolean
  showContinue: boolean
  /**
   * Present the content as a GIFT: a slowly turning burst of light and dark
   * rays behind it and a warm glow pooled under it. Off for a summary, on for
   * a prize — the weapon choice, a chest opening, a new record.
   */
  reveal?: boolean
}>()

/** The burst, built once: sixteen wedges that have to add up to 360°. */
const rayStyle = {
  backgroundImage: rayGradient(REVEAL_RAYS, REVEAL_LIGHT, REVEAL_DARK)
}

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'continue'): void
}>()

const { t } = useI18n()

// ─── The banner's picture ────────────────────────────────────────────────────
//
// The drawing (`uiArt.ts`, baked once to a data URL) until the art pipeline's
// painting at `images/ui/ribbon.webp` decodes with the art layer on — then
// that, through the same three slices. The slice fraction and the end pieces'
// width-to-height ratio come from `BANNER` rather than being typed into the
// stylesheet, so the CSS cut and the painted end piece cannot drift apart.
const paintedBanner = useArtImage('ui', 'ribbon')
const bannerStyle = computed(() => ({
  '--banner-src': `url("${paintedBanner.value ?? bannerDataUrl()}")`,
  '--banner-slice': `${(BANNER.cap * 100).toFixed(2)}%`,
  '--banner-cap': ((BANNER.cap * BANNER.w) / BANNER.h).toFixed(3)
}))

const isMobile = computed(() => {
  return typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)
})

const handleOverlayClick = () => {
  if (props.showContinue) emit('continue')
}

// Desktop shortcut: Space / Enter triggers the same "continue" action
// the overlay click does, but only while the reward is up AND in
// continue-mode. Listener is attached only when the modal becomes
// visible so background views aren't intercepting these keys.
const onContinueKey = (e: KeyboardEvent) => {
  if (!props.modelValue || !props.showContinue) return
  if (e.code !== 'Space' && e.code !== 'Enter' && e.code !== 'NumpadEnter') return
  // Skip when focus is on a typing target — players might be editing
  // toolbar inputs in the background.
  const t = e.target
  if (t instanceof HTMLElement) {
    if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return
    if (t.isContentEditable) return
  }
  e.preventDefault()
  emit('continue')
}

watch(() => props.modelValue, (open) => {
  if (open) window.addEventListener('keydown', onContinueKey)
  else window.removeEventListener('keydown', onContinueKey)
}, { immediate: true })

onUnmounted(() => {
  window.removeEventListener('keydown', onContinueKey)
})
</script>

<style scoped lang="sass">
.fade-enter-active, .fade-leave-active
  transition: opacity 0.4s ease

.fade-enter-from, .fade-leave-to
  opacity: 0

.brawl-text
  text-shadow: 0.13em 0.13em 0 #000, -0.045em -0.045em 0 #000, 0.045em -0.045em 0 #000, -0.045em 0.045em 0 #000, 0.045em 0.045em 0 #000

// ─── The reveal ──────────────────────────────────────────────────────────────
//
// Three layers, all `pointer-events: none`, all behind the banner and body:
//
//   rays   — one square, wider than any viewport's diagonal, carrying a single
//            conic gradient, spun by one transform. One composited layer; the
//            browser never repaints it, only re-composites it.
//   glow   — a warm radial pool under the prize, breathing slowly.
//   sparks — a handful of drifting motes from two radial-gradient "dots"
//            tiled and scrolled, so the air reads as lit rather than flat.
//
// The rays are masked to fade out toward the edges: a burst that reaches the
// corners at full strength stops being light and starts being wallpaper.

.reveal
  position: absolute
  inset: 0
  overflow: hidden
  pointer-events: none
  z-index: 0

.reveal__rays
  position: absolute
  left: 50%
  top: 50%
  width: 260vmax
  height: 260vmax
  translate: -50% -50%
  border-radius: 50%
  animation: reveal-spin 42s linear infinite
  -webkit-mask-image: radial-gradient(circle at 50% 50%, #000 0%, rgba(0, 0, 0, 0.9) 12%, rgba(0, 0, 0, 0.45) 24%, transparent 40%)
  mask-image: radial-gradient(circle at 50% 50%, #000 0%, rgba(0, 0, 0, 0.9) 12%, rgba(0, 0, 0, 0.45) 24%, transparent 40%)
  will-change: transform

.reveal__glow
  position: absolute
  left: 50%
  top: 50%
  width: min(120vmin, 60rem)
  height: min(120vmin, 60rem)
  translate: -50% -50%
  border-radius: 50%
  background: radial-gradient(circle, rgba(255, 224, 150, 0.34) 0%, rgba(255, 190, 90, 0.16) 28%, rgba(255, 170, 60, 0.05) 48%, transparent 66%)
  animation: reveal-breathe 3.6s ease-in-out infinite
  will-change: transform, opacity

.reveal__sparks
  position: absolute
  inset: -20%
  background-image: radial-gradient(circle, rgba(255, 236, 190, 0.9) 0 1px, transparent 2px), radial-gradient(circle, rgba(255, 214, 120, 0.7) 0 1.5px, transparent 3px)
  background-size: 9rem 9rem, 13rem 13rem
  background-position: 0 0, 4rem 6rem
  opacity: 0.55
  animation: reveal-drift 22s linear infinite
  -webkit-mask-image: radial-gradient(circle at 50% 50%, #000 0%, rgba(0, 0, 0, 0.6) 35%, transparent 62%)
  mask-image: radial-gradient(circle at 50% 50%, #000 0%, rgba(0, 0, 0, 0.6) 35%, transparent 62%)

// The prize itself arrives with a snap: scaled up out of the glow with a
// little overshoot, the same curve the stage banner lands with.
.is-reveal .reward-body,
.is-reveal .banner
  animation: reveal-pop 0.55s cubic-bezier(0.2, 1.5, 0.4, 1) both

.is-reveal .reward-body
  animation-delay: 0.08s

@keyframes reveal-spin
  from
    rotate: 0deg
  to
    rotate: 360deg

@keyframes reveal-breathe
  0%, 100%
    scale: 1
    opacity: 0.85
  50%
    scale: 1.08
    opacity: 1

@keyframes reveal-drift
  from
    background-position: 0 0, 4rem 6rem
  to
    background-position: 0 -9rem, 4rem -7rem

@keyframes reveal-pop
  from
    opacity: 0
    scale: 0.72
  to
    opacity: 1
    scale: 1

@media (prefers-reduced-motion: reduce)
  .reveal__rays, .reveal__glow, .reveal__sparks
    animation: none
  .is-reveal .reward-body, .is-reveal .banner
    animation: none

// ─── The overlay ─────────────────────────────────────────────────────────────
//
// THE WHOLE SCREEN IS DRIVEN OFF THIS BOX, NOT OFF THE VIEWPORT.
//
// `container-type: size` makes the overlay a size query container, so every
// `cqmin` / `cqh` / `cqw` in the banner, the body, the star row, the objective
// list, the result block and the gift card resolves against THIS element's
// content box. That box is the one the content actually has to fit inside: the
// visible area (`position: fixed` tracks the small viewport), already minus the
// safe-area insets and minus this padding.
//
// `vh` / `vmin` / `100dvh` do NOT describe that box. On a mobile browser with a
// collapsing URL bar they report the LARGE viewport, so a ladder tuned in
// devtools overflows the moment the bar is showing; inside a portal iframe they
// report whatever the iframe was given rather than what is on screen. Every
// `vmin` on this screen was a guess at the number below, and the fix for a
// screen that must never scroll is to stop guessing it.
//
// Where there is no container — `StarRow` and `ObjectiveList` are also used on
// the level banner — container units fall back to the small viewport, which is
// exactly what `vmin` meant there before. So the banner is unchanged and only
// the reward screens gain.
//
// The overlay's OWN padding stays in `vmin`: a container's padding cannot be
// expressed in its own container units without arguing with itself.
.reward-overlay
  --rw-pad: clamp(0.35rem, 2vmin, 1rem)
  // Was `text-sm md:text-2xl`; a clamp instead, so the one wayfinding line on a
  // gift screen keeps its ~14px on a phone and its 24px on a desktop without the
  // jump at the `md` breakpoint.
  --rw-hint-size: clamp(0.8rem, 3.4vmin, 1.5rem)
  --rw-hint-gap: clamp(0.4rem, 2.4vmin, 1.5rem)
  // The floating hint's whole band: its line plus the clearance under the
  // content. `has-floating-hint` reserves this as padding, which is what makes
  // "the hint never overlaps the content" true by construction rather than by
  // hoping the content stayed short.
  --rw-hint-band: calc(var(--rw-hint-size) * 1.3 + var(--rw-hint-gap))
  container-type: size
  container-name: reward
  padding-block: calc(var(--rw-pad) + env(safe-area-inset-top, 0px)) calc(var(--rw-pad) + env(safe-area-inset-bottom, 0px))
  padding-inline: calc(var(--rw-pad) + env(safe-area-inset-left, 0px)) calc(var(--rw-pad) + env(safe-area-inset-right, 0px))

  &.has-floating-hint
    padding-bottom: calc(var(--rw-pad) + var(--rw-hint-band) + env(safe-area-inset-bottom, 0px))

// ─── The tap/click-to-continue hint ──────────────────────────────────────────
//
// Two placements, neither of which can land on the content:
//   is-inline   — a `shrink-0` flex child (landscape phone / short embed), so
//                 the column simply has one more row.
//   is-floating — pinned to the bottom of the VIEWPORT, with its band reserved
//                 as overlay padding above (see `--rw-hint-band`).
.reward-hint
  &.is-floating
    bottom: calc(var(--rw-pad) + env(safe-area-inset-bottom, 0px))

  &.is-inline
    padding-block: clamp(0.08rem, 0.7cqmin, 0.28rem)

.reward-hint__text
  font-size: var(--rw-hint-size)
  line-height: 1.3

// ─── The body ────────────────────────────────────────────────────────────────

.reward-body
  position: relative
  width: 100%
  // A bleed gutter, not decoration. `FButton` paints its 3D depth plate with
  // `transform: translateY(3px)` on an absolutely positioned child, which is
  // real SCROLLABLE overflow below the last row — so a result screen whose
  // content fit perfectly still reported `scrollHeight` 3px over `clientHeight`
  // and scrolled by three pixels, at every viewport, forever. Reserving the
  // plate's travel here is the honest fix: it is space the button needs.
  padding-bottom: 4px
  // `0 1 auto`, not `1 1 auto`: the body takes the height its content needs and
  // no more, so the overlay's own `justify-center` centres the BANNER AND THE
  // CONTENT AS ONE GROUP. Growing to fill instead pins the banner to the top of
  // the screen and centres the content in whatever is left, which on a desktop
  // window opens a dead band between the two that reads as a loading state.
  // It still shrinks (and then scrolls) when the content cannot fit.
  flex: 0 1 auto
  min-height: 0
  display: flex
  flex-direction: column
  align-items: center
  overflow-y: auto
  overscroll-behavior: contain

  // No native scrollbar. On Windows the classic bar — track, thumb and two
  // arrow buttons — paints a strip of desktop chrome down the side of a result
  // screen, and it is the first thing the eye finds. The content still scrolls
  // by drag and wheel; it is the furniture that goes.
  scrollbar-width: none
  -ms-overflow-style: none

  &::-webkit-scrollbar
    width: 0
    height: 0

  // Centred with AUTO MARGINS rather than `justify-content: center`. On a
  // scroll container, centred flex content that overflows is clipped at the
  // top and cannot be scrolled back to — the top of the content ends up above
  // the scroll origin. Auto margins centre while it fits and collapse to zero
  // when it does not, which is the behaviour this screen needs on a 320x480
  // phone in a portal iframe.
  > *
    margin-block: auto

// ─── The banner ──────────────────────────────────────────────────────────────
//
// ONE image, three slices: an end piece each side kept at true size, and a
// middle stretched to the caption. So the banner's height is the caption's
// line and its width is the caption's width, and the title is centred by
// flex because there is nothing else in the box.
//
// The parchment ribbon this replaces was a fixed-aspect bitmap with a flat
// panel above two curled tails. Its caption had to be sized off the art,
// lifted 14% to clear the curl, gutted 21% a side to miss the rods, and the
// whole thing capped by a viewport-height ladder so it would hand its room
// back to the buttons on a short screen. Every one of those numbers was a
// guess about where the text would land, and in German on a 320px phone it
// still landed on the rods. This one has no numbers to guess: the type sets
// the box, and the box is the banner.
//
// `--banner-src`, `--banner-slice` and `--banner-cap` are set inline from
// `BANNER` in `uiArt.ts`, which is also what the reference sheet is drawn
// from — one set of numbers for the drawing, the painting and the cut.
.banner
  display: inline-flex
  align-items: center
  justify-content: center
  max-width: min(94cqw, 36rem)
  min-height: 2.3em
  // `cqmin`, so the plate follows the SHORT side of the overlay. It used to
  // follow `vw`, which on a landscape phone is the long one — 844x390 asked for
  // a 30px caption and a 76px plate out of 390px of screen, a fifth of the
  // height spent on the word "LEVEL CLEAR".
  font-size: clamp(0.95rem, 4.6cqmin, 1.8rem)
  margin-bottom: clamp(0.25rem, 1.4cqh, 0.9rem)
  border-style: solid
  border-color: transparent
  border-width: 0 calc(2.5em * var(--banner-cap, 0.4))
  border-image-source: var(--banner-src)
  border-image-slice: 0 var(--banner-slice, 17%) 0 var(--banner-slice, 17%) fill
  border-image-width: 0 calc(2.5em * var(--banner-cap, 0.4))
  border-image-repeat: stretch
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.55))

  // Landscape phone / short embed: the caption is the banner, so shrinking the
  // type shrinks the whole thing, layout box included.
  &.is-compact
    font-size: clamp(0.8rem, 4.2cqmin, 1.2rem)
    margin-bottom: clamp(0.2rem, 1cqh, 0.4rem)

.banner__text
  padding: 0.15em 0.35em
  color: #fff
  font-weight: 900
  font-style: italic
  text-transform: uppercase
  letter-spacing: -0.01em
  line-height: 1
  text-align: center
  text-wrap: balance
  text-shadow: 2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000
</style>
