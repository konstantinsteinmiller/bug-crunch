import { onBeforeUnmount, ref, type Ref } from 'vue'
import { onArtChanged, spriteFor, type ArtKind } from '@/game/art'

/**
 * A painting's URL for the DOM side of the game, or `null` while the drawing
 * stands in.
 *
 * The field asks `spriteFor` per drawable per frame and gets an image or
 * nothing; a Vue template cannot poll, so this is the same probe as a ref:
 * it re-reads when a file decodes or the flag flips (`onArtChanged`) and the
 * `<img>` or `border-image` bound to it swaps in the same tick. With the art
 * layer off it stays `null` and not one request is made — the same contract
 * every painter on the field keeps.
 */
export const useArtImage = (kind: ArtKind, id: string): Ref<string | null> => {
  const src = ref<string | null>(null)
  const read = (): void => { src.value = spriteFor(kind, id)?.src ?? null }
  read()
  const off = onArtChanged(read)
  onBeforeUnmount(off)
  return src
}
