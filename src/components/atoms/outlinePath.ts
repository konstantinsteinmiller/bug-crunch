/**
 * ─── A stroke that traces a rounded rectangle ───────────────────────────────
 *
 * The auto-advance countdown on the result screen is drawn AROUND the button
 * it will press, and the button is a rounded square — so the timer has to be a
 * rounded square too, run clockwise from the top like a clock, or it reads as
 * a ring someone left behind the button.
 *
 * One SVG path, built from the measured box: start at the top centre, go
 * clockwise through four quarter-arcs and back. Used with `pathLength="100"`
 * on the element, so the dash offset is a percentage whatever the geometry is
 * and nothing here ever has to know the perimeter.
 */

export interface OutlineBox {
  /** Top-left of the box being traced, in the SVG's own units. */
  x: number
  y: number
  w: number
  h: number
  /** The box's corner radius. */
  r: number
}

const n = (v: number): string => (Math.round(v * 100) / 100).toString()

/**
 * The `d` for a rounded-rectangle outline, clockwise from the top centre,
 * pulled `inset` inside the box on every side so a stroke of `2 × inset` sits
 * exactly on the edge. The radius shrinks with the inset, so the traced corner
 * stays concentric with the box's own.
 */
export const roundedOutlineFromTop = (box: OutlineBox, inset = 0): string => {
  const x0 = box.x + inset
  const y0 = box.y + inset
  const x1 = box.x + box.w - inset
  const y1 = box.y + box.h - inset
  if (x1 <= x0 || y1 <= y0) return ''
  const r = Math.max(0, Math.min(box.r - inset, (x1 - x0) / 2, (y1 - y0) / 2))
  const cx = (x0 + x1) / 2
  const arc = (ex: number, ey: number): string => `A ${n(r)} ${n(r)} 0 0 1 ${n(ex)} ${n(ey)}`
  return [
    `M ${n(cx)} ${n(y0)}`,
    `H ${n(x1 - r)}`, arc(x1, y0 + r),
    `V ${n(y1 - r)}`, arc(x1 - r, y1),
    `H ${n(x0 + r)}`, arc(x0, y1 - r),
    `V ${n(y0 + r)}`, arc(x0 + r, y0),
    'Z'
  ].join(' ')
}
