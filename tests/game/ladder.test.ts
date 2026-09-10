// ─── The gift ladder ────────────────────────────────────────────────────────
//
// What the opening stages hand over and what they PROMISE, in order. The
// banner, the HUD chip and the scene all read the same three functions, so
// the contract is pinned here once: weapon choice into stage 3, shield into
// stage 4, and a weapon on the road every other stage from 4 — always the next
// one, never one already passed.

import { describe, expect, it } from 'vitest'
import { SHIELD_GIFT_STAGE, nextUnlock, nextWeaponStage, stagesAway } from '@/game/ladder'
import {
  WEAPON_EVERY, WEAPON_PICK_STAGE, WEAPON_STAGE, stageHasWeapon, weaponForStage
} from '@/game/weapons'

describe('the ladder', () => {
  it('runs choice → shield → weapon on the road, on consecutive stages', () => {
    expect(WEAPON_PICK_STAGE).toBe(3)
    expect(SHIELD_GIFT_STAGE).toBe(WEAPON_PICK_STAGE + 1)
    expect(WEAPON_STAGE).toBe(SHIELD_GIFT_STAGE)
    // …and the puzzle keeps coming every other stage, forever.
    expect(WEAPON_EVERY).toBe(2)
    for (const s of [4, 6, 8, 100, 400]) expect(stageHasWeapon(s)).toBe(true)
    for (const s of [1, 2, 3, 5, 7, 101]) expect(stageHasWeapon(s)).toBe(false)
  })

  it('promises the weapon choice on stages 1 and 2, the shield on 3', () => {
    for (const s of [1, 2]) {
      const u = nextUnlock(s)!
      expect(u.kind).toBe('weaponPick')
      expect(u.atStage).toBe(WEAPON_PICK_STAGE)
      expect(u.icon).toBe('gift')
    }
    const shield = nextUnlock(3)!
    expect(shield.kind).toBe('shield')
    expect(shield.atStage).toBe(SHIELD_GIFT_STAGE)
    expect(shield.icon).toBe('shield')
  })

  it('names the NEXT box and the weapon it holds, from stage 4 on', () => {
    for (let s = 4; s <= 60; s++) {
      const u = nextUnlock(s)!
      expect(u.kind, `stage ${s}`).toBe('weapon')
      // Strictly after the current stage: the promise is never the road the
      // player is already on.
      expect(u.atStage, `stage ${s}`).toBeGreaterThan(s)
      expect(stageHasWeapon(u.atStage)).toBe(true)
      // The nearest one, not a later one.
      expect(nextWeaponStage(s)).toBe(u.atStage)
      for (let t = s + 1; t < u.atStage; t++) expect(stageHasWeapon(t), `stage ${t}`).toBe(false)
      // Labelled by the weapon in THAT box, and the icon is the weapon.
      expect(u.weapon).toBe(weaponForStage(u.atStage))
      expect(u.icon).toBe(u.weapon)
    }
  })

  it('counts the stages to go from the stage the player is on', () => {
    expect(stagesAway(1, nextUnlock(1)!)).toBe(2)
    expect(stagesAway(2, nextUnlock(2)!)).toBe(1)
    expect(stagesAway(3, nextUnlock(3)!)).toBe(1)
    // A puzzle stage promises the one after next: two stages away.
    expect(stagesAway(4, nextUnlock(4)!)).toBe(2)
    expect(stagesAway(5, nextUnlock(5)!)).toBe(1)
    // Never zero, whatever the input — "in 0 stages" is a chip that lies.
    expect(stagesAway(99, { atStage: 3, icon: 'gift', kind: 'weaponPick' })).toBe(1)
  })

  it('survives nonsense stage numbers', () => {
    expect(nextUnlock(0)!.kind).toBe('weaponPick')
    expect(nextUnlock(-5)!.kind).toBe('weaponPick')
    expect(nextUnlock(2.7)!.kind).toBe('weaponPick')
    expect(nextWeaponStage(4, 1)).toBeNull()
  })
})
