import { spriteFor, onArtChanged, type ArtKind } from '@/game/art'

/**
 * ─── Painted animation strips ───────────────────────────────────────────────
 *
 * A drop-in strip is one image holding N panels side by side, covering exactly
 * one cycle of something that moves — a monster's step, a survivor's stride.
 * The renderer plays it from the same clock that drives the procedural bake, so
 * a design can swap from the drawing to the painting mid-stride without a pop.
 *
 * The frame COUNT is read off the image rather than declared anywhere. Every
 * panel is the procedural frame box scaled up — same proportions by
 * construction — so the number of panels falls out of the strip's own shape.
 * That means eight frames today and sixteen later is a change to the export
 * sheet and to nothing else, and a design that nobody can keep consistent for
 * eight panels can come back as four. A single square image is a one-frame
 * strip, which is how every still in the pipeline gets its fit for free.
 */

/** Sliced frames per `kind/id`. `null` is a settled miss, not "still probing". */
const cache = new Map<string, HTMLCanvasElement[] | null>()

/**
 * The frames of a painted strip, slicing it on first use.
 *
 * `aspect` is the width:height of ONE panel — the procedural frame box's own
 * proportions. Getting it wrong does not fail loudly, it miscounts the panels
 * and shreds the animation, so it is passed by the caller that owns the box
 * rather than guessed at here.
 *
 * Returns null until the bitmap has decoded, which is the whole fallback story:
 * whatever was drawing keeps drawing, and the swap happens when it is ready.
 */
export const stripFrames = (
  kind: ArtKind, id: string, aspect: number
): HTMLCanvasElement[] | null => {
  const key = `${kind}/${id}`
  const cached = cache.get(key)
  if (cached !== undefined) return cached

  const img = spriteFor(kind, id)
  // `null` here means the probe has not settled (or the flag is off) and must
  // NOT be cached as a miss; a decoded image with no width is a broken file
  // and can be.
  if (!img) return null
  if (!img.naturalWidth) { cache.set(key, null); return null }

  const fh = img.naturalHeight
  const n = Math.round(img.naturalWidth / (fh * aspect))
  // A strip that divides into no sane number of panels is not a strip — a
  // single still dropped in the wrong folder, most likely. Refuse it rather
  // than shredding it into slivers.
  if (n < 1 || n > 32) { cache.set(key, null); return null }
  const fw = Math.floor(img.naturalWidth / n)
  if (fw < 8 || fh < 8) { cache.set(key, null); return null }

  const frames: HTMLCanvasElement[] = []
  for (let i = 0; i < n; i++) {
    const c = document.createElement('canvas')
    c.width = fw
    c.height = fh
    c.getContext('2d')?.drawImage(img, i * fw, 0, fw, fh, 0, 0, fw, fh)
    frames.push(c)
  }
  cache.set(key, frames)
  return frames
}

/** The frame at a normalised cycle position, or null if there is no strip. */
export const stripFrame = (
  kind: ArtKind, id: string, aspect: number, cycle01: number
): HTMLCanvasElement | null => {
  const frames = stripFrames(kind, id, aspect)
  if (!frames) return null
  const c01 = ((cycle01 % 1) + 1) % 1
  return frames[Math.floor(c01 * frames.length) % frames.length] ?? null
}

/** How many strips have been sliced so far — a test seam. */
export const stripCacheSize = (): number => cache.size

// The flag can be turned off at run time and a strip can decode long after the
// first miss, so the slices are dropped whenever the art layer changes rather
// than being trusted for the life of the page.
//
// SCOPED: a decode names its own `kind/id`, which is exactly this cache's key,
// so one arrival drops one strip. Dropping all of them re-sliced every monster,
// hero and death strip on screen — up to 32 canvases each — once per painting,
// and the paintings arrive one after another through the opening stage.
// `null` (a flag flip, a refresh) still means everything.
onArtChanged((change) => {
  if (!change) cache.clear()
  else cache.delete(`${change.kind}/${change.id}`)
})
