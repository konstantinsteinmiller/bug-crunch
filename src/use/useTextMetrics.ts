// ─── Cached text measurement ────────────────────────────────────────────────
//
// `measureText` shapes the string exactly as a draw does — it builds the glyph
// run and sums the advances — so a call site that measures every frame is
// paying most of a text draw for a number that has not moved.
//
// The gate plates are the site this exists for. Each leaf sized its own plate
// from `ctx.measureText(label)` once per frame, for a label that changes twice a
// second while the player pumps it and never otherwise, at a size derived from
// `scale`, which is constant for the whole frame. It profiled at 1.6 % of all
// samples on a 6x-throttled phone — more than any actual drawing the gates do.
//
// ── Why only the measurement is cached ──
//
// The obvious next step is to bake the labels themselves into sprites and blit
// them. That was built, measured and reverted: interleaved A/B at 6x CPU
// throttle over real gameplay put it at -0.0 % on p95 work-per-frame with the
// baseline winning 4 of 6 paired reps. See `PERF-LEDGER.md`, 2026-09-05.
// The measurement cache survived that run because it is not a trade — it is a
// map lookup replacing a shaping pass, with byte-identical output.

const widths = new Map<string, number>()

/** Bounded so a caller whose label varies continuously degrades into "measure
 *  every frame" rather than into a leak. */
const MAX_ENTRIES = 192

/**
 * The advance width of `text` at `px` in the game's display face.
 *
 * Leaves `ctx.font` set on a miss and untouched on a hit, so callers must set
 * the font themselves before drawing rather than relying on this to have done
 * it — the whole point is that the hit path touches nothing.
 */
export const measureLabel = (
  ctx: CanvasRenderingContext2D, text: string, px: number
): number => {
  const key = `${text}|${px}`
  const hit = widths.get(key)
  if (hit !== undefined) return hit
  ctx.font = `900 ${px}px Angry, sans-serif`
  const w = ctx.measureText(text).width
  if (widths.size >= MAX_ENTRIES) widths.clear()
  widths.set(key, w)
  return w
}

export const clearLabelWidths = (): void => { widths.clear() }

/** Test seam: proves a per-entity site reuses one measurement rather than
 *  re-shaping the string every frame. */
export const labelWidthCount = (): number => widths.size
