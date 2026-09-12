// ─── When a device is locked to portrait ────────────────────────────────────
//
// The rule, pulled out of `PortraitLock.vue` and kept pure, for the same reason
// `outlinePath.ts` sits beside the component that draws with it: a rule that
// decides whether somebody can play the game AT ALL is exactly the kind of rule
// that must be assertable without a browser. The component owns the media query,
// the overlay and the pause; this owns the decision.
//
// Getting it wrong is asymmetric, which is why it is specced rather than
// eyeballed. A false negative is a phone showing a narrow road in a wide frame —
// the bug being fixed. A false positive is a laptop or a tablet being told to
// rotate a device that does not rotate, with no way out of it at all.

/**
 * The widest short edge that still counts as a phone, CSS px.
 *
 * 500 is not a new number: it is `isShortViewport`'s threshold, the line the
 * result screen already uses to decide a viewport is too short to carry its
 * ornament. Reusing it means the game has ONE idea of "short" rather than two
 * that can drift apart.
 *
 * Measured against the playtest's own hardware, which is the only calibration
 * that matters here:
 *
 *   • the phone was 844×390 — short edge 390, comfortably inside;
 *   • the tablet was 1180×820 — short edge 820, comfortably outside;
 *   • and a 1366×768 laptop is 768, outside as well, on top of already failing
 *     the pointer test.
 *
 * The gap between 390 and 820 is wide enough that no plausible device lands in
 * the middle by accident, which is what makes a single threshold safe here.
 */
export const PHONE_SHORT_EDGE_PX = 500

export interface PortraitLockInputs {
  /**
   * Does `(pointer: coarse)` match — is the player's PRIMARY input a finger?
   *
   * Deliberately the primary pointer and not `any-pointer: coarse`: a
   * touchscreen laptop answers yes to the latter while being driven with a
   * trackpad, and a laptop must never be asked to rotate. Deliberately not the
   * UA sniff either — that is the thing that is wrong about iPads, about
   * desktop-mode requests, and about whichever browser decides to lie next.
   */
  coarsePointer: boolean
  /** Viewport width, CSS px. */
  width: number
  /** Viewport height, CSS px. */
  height: number
}

/**
 * Should the rotate-your-phone overlay be up?
 *
 * Three conditions, all necessary:
 *
 *   • a coarse primary pointer — it is a phone or a tablet, not a computer;
 *   • the viewport is genuinely wider than it is tall — it is actually sideways,
 *     and a square-ish viewport is left alone rather than guessed at;
 *   • the short edge is phone-sized — it is a phone rather than a tablet.
 *
 * Reading the SHORT edge rather than the height is what makes this survive a
 * keyboard opening, a portal iframe, or a split-screen shell: the judgement is
 * about how much room there is, not about what the device says it is.
 */
export const shouldLockPortrait = (i: PortraitLockInputs): boolean => {
  if (!i.coarsePointer) return false
  // Not `>=`. A viewport that is exactly square is not sideways, and on a device
  // mid-rotation it is a frame the browser reports on its way between two states
  // — locking on it makes the overlay flicker during the very gesture it is
  // asking for.
  if (!(i.width > i.height)) return false
  if (!Number.isFinite(i.width) || !Number.isFinite(i.height)) return false
  return Math.min(i.width, i.height) <= PHONE_SHORT_EDGE_PX
}
