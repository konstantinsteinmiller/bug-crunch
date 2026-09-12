import { onBeforeUnmount, ref, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue'
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
 *
 * The id may be a getter, because one mark on the HUD CHANGES under a mounted
 * component: the incoming-attack badge is three drawables (one per answer) and
 * the answer can turn from "dodge" to "hold still" without the badge ever
 * leaving the screen. Read once at setup, that component keeps the first
 * painting and prints the wrong sign over the right word.
 */
export const useArtImage = (
  kind: ArtKind, id: MaybeRefOrGetter<string>
): Ref<string | null> => {
  const src = ref<string | null>(null)
  const read = (): void => { src.value = spriteFor(kind, toValue(id))?.src ?? null }
  read()
  watch(() => toValue(id), read)
  // Only this mark's own arrival, or a flag flip. Every HUD icon on screen used
  // to re-read — and Vue re-render — once per painting that decoded anywhere in
  // the game, which during the opening stage is most of the cast.
  const off = onArtChanged((change) => {
    if (!change || (change.kind === kind && change.id === toValue(id))) read()
  })
  onBeforeUnmount(off)
  return src
}
