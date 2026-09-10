<template lang="pug">
  Transition(name="fade")
    //- Ensure classes with special characters are in parentheses
    div.fixed.inset-0.flex.flex-col.items-center.justify-center.backdrop-blur-md.touch-none.cursor-pointer(
      v-if="modelValue"
      class="bg-black/60"
      :class="[isAdShowing ? 'z-0' : 'z-[100]', isCompact ? 'p-2' : 'p-4', reveal ? 'is-reveal' : '']"
      :style="{\
        paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))',\
        paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))',\
        paddingLeft: 'calc(1rem + env(safe-area-inset-left, 0px))',\
        paddingRight: 'calc(1rem + env(safe-area-inset-right, 0px))'\
      }"
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
      //- at the bottom of the viewport as before.
      Transition(name="fade")
        div.flex.justify-center.animate-pulse.pointer-events-none(
          v-if="showContinue"
          :class="isCompact ? 'shrink-0 pt-1 pb-1' : 'absolute bottom-8 left-0 right-0 sm:bottom-12'"
        )
          div.text-white.font-black.uppercase.italic.tracking-widest.brawl-text(
            :class="isCompact ? 'text-xs' : 'text-sm md:text-2xl'"
          )
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
  text-shadow: 3px 3px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000

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

// ─── The body ────────────────────────────────────────────────────────────────

.reward-body
  position: relative
  width: 100%
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
  max-width: min(94vw, 36rem)
  min-height: 2.5em
  font-size: clamp(1.05rem, 4.4vw, 1.9rem)
  margin-bottom: clamp(0.4rem, 2vh, 1.1rem)
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
    font-size: clamp(0.85rem, 3.4vw, 1.3rem)
    margin-bottom: 0.3rem

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
