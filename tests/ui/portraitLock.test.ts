// ─── Who gets told to rotate their phone, and who must never be ─────────────
//
// The overlay this rule drives is the hardest block in the game: while it is up
// there is no way to play at all. So the interesting assertions are not the ones
// that prove a phone is caught — they are the ones that prove a tablet, a laptop
// and a desktop are not, because a false positive there is a device that cannot
// reach the game and cannot rotate its way out.
//
// The three viewports below are not invented. 844×390 is the phone the
// first-contact playtest ran and the device that reported "a narrow road in a
// wide frame"; 1180×820 is the tablet from the same playtest, which played fine;
// 1366×768 is the laptop the brief names explicitly as a device that must keep
// working.

import { describe, expect, it } from 'vitest'
import { PHONE_SHORT_EDGE_PX, shouldLockPortrait } from '@/components/organisms/portraitLock'

const phoneLandscape = { coarsePointer: true, width: 844, height: 390 }
const phonePortrait = { coarsePointer: true, width: 390, height: 844 }
const tabletLandscape = { coarsePointer: true, width: 1180, height: 820 }
const laptop = { coarsePointer: false, width: 1366, height: 768 }

describe('the portrait lock', () => {
  it('locks the playtest’s phone in landscape', () => {
    expect(shouldLockPortrait(phoneLandscape)).toBe(true)
  })

  it('leaves the same phone alone the moment it is upright', () => {
    // The overlay has to let go by itself. There is no button on it, so a rule
    // that latched would strand the player in it forever.
    expect(shouldLockPortrait(phonePortrait)).toBe(false)
  })

  it('never locks the playtest’s tablet, in either orientation', () => {
    // 820 px of short edge is a landscape the game plays perfectly well, and a
    // tablet on a stand may not be rotatable at all.
    expect(shouldLockPortrait(tabletLandscape)).toBe(false)
    expect(shouldLockPortrait({ ...tabletLandscape, width: 820, height: 1180 })).toBe(false)
  })

  it('never locks a laptop, however short its window is', () => {
    // Both halves of the rule protect this one: the pointer is fine, and the
    // short edge is 768. Checked with an absurdly short window too, because a
    // browser window dragged to a letterbox is a thing people do.
    expect(shouldLockPortrait(laptop)).toBe(false)
    expect(shouldLockPortrait({ coarsePointer: false, width: 1366, height: 300 })).toBe(false)
  })

  it('ignores a coarse pointer that is not actually sideways', () => {
    // A square viewport is not a rotated one, and on a phone mid-rotation it is a
    // frame the browser reports on the way between two states. Locking on it
    // makes the overlay flicker during the exact gesture it is asking for.
    expect(shouldLockPortrait({ coarsePointer: true, width: 400, height: 400 })).toBe(false)
  })

  it('reads the SHORT edge, not the height', () => {
    // Which is what makes it survive a keyboard, a portal iframe or a
    // split-screen shell: the judgement is about how much room there is.
    expect(shouldLockPortrait({
      coarsePointer: true, width: PHONE_SHORT_EDGE_PX, height: PHONE_SHORT_EDGE_PX - 1
    })).toBe(true)
    expect(shouldLockPortrait({
      coarsePointer: true, width: PHONE_SHORT_EDGE_PX + 2, height: PHONE_SHORT_EDGE_PX + 1
    })).toBe(false)
  })

  it('survives a viewport that is nonsense', () => {
    // It is fed from live refs that a resize handler writes, and a device that
    // reports a garbage dimension for one frame must not black the game out.
    expect(shouldLockPortrait({ coarsePointer: true, width: Number.NaN, height: 390 })).toBe(false)
    expect(shouldLockPortrait({ coarsePointer: true, width: 844, height: Number.NaN })).toBe(false)
    expect(shouldLockPortrait({ coarsePointer: true, width: Infinity, height: 390 })).toBe(false)
  })
})
