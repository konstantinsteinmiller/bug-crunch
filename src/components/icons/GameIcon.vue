<script setup lang="ts">
import { computed } from 'vue'
import { ICON_PATHS } from './iconPaths'
import type { GameIconName } from './iconNames'
import { artIdForGlyph, isTintedGlyph } from '@/game/artCatalogue'
import { useArtImage } from '@/use/useArtImage'

/**
 * ─── The one icon component ─────────────────────────────────────────────────
 *
 * Every glyph in the game comes from here. Before this, icons were pasted as
 * raw `<svg>` blocks into whichever component needed them (GooScene's settings
 * cog, FIconButton's six hard-coded `d` strings, FModal's close X, …), so the
 * same idea was drawn three different ways at three different stroke weights.
 *
 * The glyphs are SOLID fills, not strokes: they sit white on saturated candy
 * plastic, where a 2px outline greys out and disappears at HUD size.
 *
 * All of a glyph's sub-paths are concatenated into ONE `d` on ONE `<path>`,
 * and that is load-bearing rather than tidiness: a sub-path can only cut a
 * hole in the sub-paths it shares an element with. Rendered as a `<path>` per
 * entry — as this component used to — the counter of `info`, the lock's
 * keyhole and the bore of the gear all silently filled themselves in.
 *
 * The winding rule is the default `nonzero`, not `evenodd`. Most of these
 * glyphs are assembled from limbs that overlap on purpose (the shackle sunk
 * into the lock body, the arrow head sitting on its shaft, the note stems
 * crossing their beam); evenodd would XOR every one of those overlaps into a
 * hole. Under nonzero they merge, and `iconPaths` cuts its holes deliberately
 * by winding those sub-paths the other way round.
 *
 * The SVG fills its box, so the *caller* owns sizing — set a width/height on
 * the parent and the glyph follows. Colour comes from `currentColor`.
 *
 * ─── The painted rung ───────────────────────────────────────────────────────
 *
 * Every glyph in this set is also a slot in the art manifest, so a painted mark
 * can replace the vector one WITHOUT a call site opting in — which is the whole
 * point: there are getting on for sixty of these across the HUD, the modals, the
 * Locker and the result screen, and a painted icon set that only reached the
 * handful of buttons somebody remembered to pass an `art` prop to would be a
 * half-painted UI, which looks worse than an unpainted one.
 *
 * The id is `artCatalogue.artIdForGlyph`: the HUD mark where this glyph already
 * IS one (`boot` → `ui/locker`), so the canvas and the DOM share one painting,
 * and `ui/icon-<name>` otherwise. With the art layer off — which is how every
 * portal build ships — nothing is probed and this is the same component it was.
 *
 * `ArtIcon` still exists and still sits above this: it is for the marks that
 * have a canvas DRAWING as well as a glyph (the banner, the fever vial), and its
 * fallback lands here, where the same probe is a cache hit rather than a second
 * request.
 */
const props = defineProps<{
  name: GameIconName
  /**
   * This glyph is the HERO of its surface, not a mark on a button.
   *
   * Set it where the glyph is drawn at OBJECT size — the gift card's ~95 px
   * picture of the prize — and leave it off everywhere else. It changes nothing
   * for a glyph with no painting and nothing for an untinted one; see
   * `.is-tinted.is-hero` in the stylesheet for what it buys and why the small
   * end must not have it.
   */
  hero?: boolean
}>()

const d = computed(() => (ICON_PATHS[props.name] ?? ICON_PATHS.help).join(''))

const painted = useArtImage('ui', () => artIdForGlyph(props.name))

/**
 * Is this mark's painting a silhouette the STYLESHEET colours?
 *
 * See `TINTED_GLYPHS` in `artCatalogue.ts`. The short of it: the vector rung is
 * `fill="currentColor"` and obeys `color:` for free, and an `<img>` obeys
 * nothing — so a mark whose colour is state (an earned star is gold, an unearned
 * one is a ghost) has to reach the page as a MASK filled with `currentColor`
 * rather than as a picture, or the two rungs stop being interchangeable.
 */
const tinted = computed(() => painted.value !== null && isTintedGlyph(props.name))

/** The painting, as a mask source. */
const maskStyle = computed(() => ({ '--glyph-src': `url("${painted.value}")` }))
</script>

<template lang="pug">
  //- A mark whose colour is state: the painting as a MASK, filled with
  //- `currentColor`, so `color:` reaches it exactly as it reaches the vector.
  span.game-icon.is-painted.is-tinted(
    v-if="tinted"
    :class="{ 'is-hero': hero }"
    :style="maskStyle"
    aria-hidden="true"
  )
  img.game-icon.is-painted(
    v-else-if="painted"
    :src="painted"
    alt=""
    draggable="false"
    aria-hidden="true"
  )
  svg.game-icon(
    v-else
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
  )
    path(:d="d")
</template>

<style scoped lang="sass">
.game-icon
  display: block
  width: 100%
  height: 100%
  // The glyph is decoration painted on top of a button; never let it swallow
  // the press that was aimed at the button underneath it.
  pointer-events: none

// A painting sits in the glyph's box rather than stretching to it: the vector
// is authored square with its own margin and a painted mark is not always, so
// `contain` is what keeps the two interchangeable in a row of buttons.
.game-icon.is-painted
  object-fit: contain

// The tinted rung. `contain` / `no-repeat` / `center` are the mask's spelling of
// the `object-fit: contain` above, so a mark lands in exactly the same box
// whichever rung draws it. `drop-shadow` and `opacity` still apply — the
// element's painted content is the masked fill, which is the shape — so the
// star row's glow and the empty socket's ghosting work unchanged.
.game-icon.is-tinted
  background-color: currentColor
  -webkit-mask-image: var(--glyph-src)
  mask-image: var(--glyph-src)
  -webkit-mask-repeat: no-repeat
  mask-repeat: no-repeat
  -webkit-mask-position: center
  mask-position: center
  -webkit-mask-size: contain
  mask-size: contain

// ─── The hero rung ───────────────────────────────────────────────────────────
//
// THE MASK IS RIGHT AT 16 px AND WRONG AT 95 px, AND IT IS THE SAME FILE.
//
// A tinted mark's painting is one flat near-white shape WITH THE HOUSE INK
// around and inside it — `trophy.webp`'s interior sits at luminance 254 in the
// median, and the quarter of it that is darker is the ink line that separates
// the bowl from its handles and its stem. `greyscale: true` never meant "no
// ink"; it meant "no colour of its own, the game supplies that".
//
// Masking keeps ALPHA only, so the ink is filled with the same `currentColor` as
// the body and the shape loses every line inside its own outline. At 16–24 px on
// a candy-plastic button that is the point: measured at 16 px, keeping the ink
// eats a third of the glyph and a bold white boot turns to noise, which is why
// the marks register is flat by contract. At 95 px, as the whole picture on a
// gift card, it is why a carefully painted trophy arrives as a cream sticker.
//
// So the hero rung colours the painting THROUGH ITS OWN VALUES instead of
// replacing them: `currentColor` as the ground, the painting multiplied over it,
// the result still cut by the mask. A flat near-white body multiplies to pure
// tint — the card's colour is not muddied — while the ink and the little shading
// the bowl has survive as ink and shading. It is the same operation
// `bakeSplatTint` (`uiArt.ts`) and `bakePuffSprite` do on canvas, in CSS.
//
// The mask stays, so `color:` still reaches this rung and the vector and painted
// rungs are still interchangeable. A browser without `background-blend-mode`
// falls back to exactly the flat fill above rather than to anything new.
//
// NOT default, and that is the measurement rather than caution: this is only
// ever right where the glyph is drawn near its source resolution. It is also why
// a TRANSLUCENT `color` must not reach it — multiply against a 22%-alpha ground
// returns the painting at full strength, which would light every empty star
// socket on the result screen. Nothing hero-sized is ghosted, so the two never
// meet; see `StarRow`'s socket, which is a mark and stays on the rung above.
.game-icon.is-tinted.is-hero
  background-image: var(--glyph-src)
  background-repeat: no-repeat
  background-position: center
  background-size: contain
  background-blend-mode: multiply
</style>
