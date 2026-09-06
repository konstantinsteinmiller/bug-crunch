<script setup lang="ts">
import GameIcon from '@/components/icons/GameIcon.vue'
import type { GameIconName } from '@/components/icons/iconNames'
import type { ArtKind } from '@/game/art'
import { useArtImage } from '@/use/useArtImage'

/**
 * A glyph the art pipeline can repaint.
 *
 * Draws the shared glyph exactly as `GameIcon` does — until a painting exists
 * at `images/<kind>/<id>.webp` and the art layer is on, when the painting
 * draws in the same box instead. Nothing about the button depends on the
 * file: a fresh clone, a portal build with the flag off and a painting that
 * has not decoded yet all show the glyph.
 *
 * Both branches are the component's single root, so a parent's sizing class
 * lands on whichever is showing; the painting is `object-fit: contain`, so
 * it sits in the glyph's box rather than stretching to it.
 */
const props = defineProps<{
  kind: ArtKind
  id: string
  /** The glyph drawn while there is no painting. */
  fallback: GameIconName
}>()

const painted = useArtImage(props.kind, props.id)
</script>

<template lang="pug">
  img.art-icon.is-painted(v-if="painted" :src="painted" alt="" draggable="false" aria-hidden="true")
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
