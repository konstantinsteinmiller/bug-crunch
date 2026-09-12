<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import GameIcon from '@/components/icons/GameIcon.vue'
import type { GameIconName } from '@/components/icons/iconNames'
import type { ArtKind } from '@/game/art'
import { useArtImage } from '@/use/useArtImage'

/**
 * A glyph the art pipeline can repaint.
 *
 * Three rungs, best first: the PAINTING at `images/<kind>/<id>.webp` once it
 * exists and the art layer is on; the DRAWING, for the handful of marks
 * `uiArt` paints on a canvas rather than filling from a glyph path; and the
 * shared glyph, which every button falls back to and which is what a fresh
 * clone, a portal build with the flag off and a mark with no drawing all show.
 *
 * Both branches are the component's single root, so a parent's sizing class
 * lands on whichever is showing; the bitmap is `object-fit: contain`, so it
 * sits in the glyph's box rather than stretching to it.
 */
const props = defineProps<{
  kind: ArtKind
  id: string
  /** The glyph drawn when there is neither a painting nor a drawing. */
  fallback: GameIconName
}>()

const painted = useArtImage(props.kind, () => props.id)

/**
 * The canvas-drawn stand-in, resolved after mount.
 *
 * Deliberately a dynamic import: `uiArt` pulls the whole ink-art vocabulary in
 * behind it, and `ArtIcon` sits inside two buttons that half the app's screens
 * use. Loading it on mount keeps it out of every one of those chunks and
 * costs nothing visible — a mark with no painting shows its glyph for the one
 * frame before the module resolves, which is the same thing it would show if
 * the drawing did not exist at all.
 */
const drawn = ref<string | null>(null)
const resolveDrawn = async (): Promise<void> => {
  if (props.kind !== 'ui') return
  try {
    const { drawnUiMark } = await import('@/game/uiArt')
    drawn.value = drawnUiMark(props.id)
  } catch { /* no drawing — the glyph is the floor */ }
}
onMounted(resolveDrawn)
// …and again when the id changes under a mounted icon — see `useArtImage`.
watch(() => props.id, () => { drawn.value = null; void resolveDrawn() })

const src = computed<string | null>(() => painted.value ?? drawn.value)
</script>

<template lang="pug">
  img.art-icon.is-painted(v-if="src" :src="src" alt="" draggable="false" aria-hidden="true")
  GameIcon.art-icon(v-else :name="fallback")
</template>

<style scoped lang="sass">
.art-icon
  display: block
  width: 100%
  height: 100%
  object-fit: contain
  // Decoration on a button; the press belongs to the button underneath.
  pointer-events: none
</style>
