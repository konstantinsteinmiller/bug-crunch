// ─── The skill row's one remaining number ───────────────────────────────────
//
// This file used to pin a LAYOUT CHOICE: `skillRowFitsUnderSquad` measured the
// viewport and decided whether the row could sit under the squad or had to fall
// back to a column at the right edge of the screen. Both the rule and its
// fallback are gone — the owner asked for the row to sit under the squad on
// every viewport, shrunk to the lane, because the right-edge column put the
// controls off the play surface entirely on a desktop.
//
// What is left of that module is one constant, and the reason it is still worth
// a spec is that it is the only thing standing between the buttons and the HUD
// strip underneath them: a zero here would have the row touching the mute and
// settings glyphs, which is a mis-tap on a control that ends a run.

import { describe, expect, it } from 'vitest'
import { SKILL_ROW_HUD_GAP_PX } from '@/components/game/skillBarPlacement'

describe('the gap under the skill row', () => {
  it('keeps the buttons clear of the HUD strip', () => {
    expect(SKILL_ROW_HUD_GAP_PX).toBeGreaterThan(0)
  })

  it('is a gap, not a margin — small enough that the row stays low', () => {
    // The row is pushed as LOW as the strip allows rather than centred in the
    // band, because every pixel between it and the steering surface is bought
    // from the same budget. A gap that grew into a layout would undo that.
    expect(SKILL_ROW_HUD_GAP_PX).toBeLessThanOrEqual(16)
  })
})
