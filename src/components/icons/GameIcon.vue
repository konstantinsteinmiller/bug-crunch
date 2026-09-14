<script setup lang="ts">
import { computed } from 'vue'
import { ICON_PATHS } from './iconPaths'
import type { GameIconName } from './iconNames'
import { artIdForGlyph } from '@/game/artCatalogue'
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
const props = defineProps<{ name: GameIconName }>()

const d = computed(() => (ICON_PATHS[props.name] ?? ICON_PATHS.help).join(''))

const painted = useArtImage('ui', () => artIdForGlyph(props.name))
</script>

<template lang="pug">
  img.game-icon.is-painted(
    v-if="painted"
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
</style>
