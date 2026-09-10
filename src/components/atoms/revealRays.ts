/**
 * ─── The reveal's ray burst ─────────────────────────────────────────────────
 *
 * The backdrop `FReward` draws in `reveal` mode: a burst of rays from the centre
 * of the screen, alternating light and dark, turning slowly — the way a prize
 * is presented in every mobile game that has ever presented one. It is one
 * element with one conic gradient and one transform, so it costs the GPU a
 * single composited layer and the CPU nothing at all.
 *
 * SIXTEEN rays, and not more, on purpose: at 24 the wedges are too narrow to
 * read as beams at phone size and the burst turns into a texture; at 8 it
 * reads as a pinwheel. Sixteen is where "rays of light" lands.
 */
export const REVEAL_RAYS = 16

/** Light and dark, alternating: eight of each. */
export const REVEAL_LIGHT_RAYS = REVEAL_RAYS / 2

/**
 * The conic gradient for a `rays`-ray burst, `light` and `dark` alternating in
 * equal wedges. Built rather than typed because the wedge angles have to add
 * up to exactly 360° or the last ray is a different width from the rest.
 */
export const rayGradient = (rays: number, light: string, dark: string): string => {
  const wedge = 360 / rays
  const stops: string[] = []
  for (let i = 0; i < rays; i++) {
    const from = (i * wedge).toFixed(3)
    const to = ((i + 1) * wedge).toFixed(3)
    stops.push(`${i % 2 === 0 ? light : dark} ${from}deg ${to}deg`)
  }
  return `conic-gradient(from 0deg at 50% 50%, ${stops.join(', ')})`
}

/** Warm gold light against a deep, slightly cool dark — the reward palette the
 *  result screen's coins already use. Both translucent: the backdrop's blur and
 *  the road underneath stay visible through the beams. */
export const REVEAL_LIGHT = 'rgba(255, 214, 110, 0.30)'
export const REVEAL_DARK = 'rgba(6, 10, 22, 0.42)'
