import { describe, expect, it } from 'vitest'
import {
  SHOES,
  SHOE_IDS,
  SLAM_PIERCE_BONUS,
  STARTER_SHOE,
  blowPierce,
  isShoeId,
  shoeAvailability,
  shoeSpec
} from '@/game/shoes'
import { BUGS } from '@/game/bugs'

const starter = shoeSpec(STARTER_SHOE)

describe('the Locker', () => {
  it('has a unique id for every shoe, and the lookup agrees', () => {
    expect(new Set(SHOE_IDS).size).toBe(SHOES.length)
    for (const s of SHOES) expect(shoeSpec(s.id)).toBe(s)
  })

  it('falls back to the starter rather than exploding on an unknown id', () => {
    // @ts-expect-error — deliberately outside the union.
    expect(shoeSpec('flipflop')).toBe(starter)
  })

  it('guards its own type predicate', () => {
    expect(isShoeId('sneaker')).toBe(true)
    expect(isShoeId('flipflop')).toBe(false)
    expect(isShoeId(undefined)).toBe(false)
  })

  it('gives away exactly one shoe, and it is the starter', () => {
    const free = SHOES.filter((s) => s.cost === 0)
    expect(free.map((s) => s.id)).toEqual([STARTER_SHOE])
    expect(starter.starGate).toBe(0)
  })

  it('prices and star-gates every other shoe above zero', () => {
    for (const s of SHOES) {
      if (s.id === STARTER_SHOE) continue
      expect(s.cost).toBeGreaterThan(0)
      expect(s.starGate).toBeGreaterThan(0)
    }
  })

  it('keeps every tuning number in a sane range', () => {
    for (const s of SHOES) {
      expect(s.agility).toBeGreaterThan(0)
      expect(s.radius).toBeGreaterThan(0)
      expect(s.slamScale).toBeGreaterThan(1)
      expect(s.cooldown).toBeGreaterThan(0)
      expect(s.chargeMs).toBeGreaterThan(0)
      expect(s.recoverMs).toBeGreaterThan(0)
      expect(s.hover).toBeGreaterThan(0)
      expect(s.hover).toBeLessThan(1)
    }
  })

  it('stays readable: no stomp circle is smaller than the biggest bug', () => {
    const biggest = Math.max(...BUGS.map((b) => b.size))
    for (const s of SHOES) expect(s.radius * 2).toBeGreaterThan(biggest)
  })
})

// The rule the whole set is built to. A shoe that is the sneaker with bigger
// numbers ends the Locker the moment it is bought: there is nothing left to
// choose, only something to afford.
describe('no shoe strictly dominates the starter', () => {
  it.each(SHOES.filter((s) => s.id !== STARTER_SHOE).map((s) => [s.id, s] as const))(
    '%s gives something up',
    (_id, s) => {
      const betterEverywhere =
        s.agility >= starter.agility &&
        s.radius >= starter.radius &&
        s.pierce >= starter.pierce &&
        s.cooldown <= starter.cooldown &&
        s.recoverMs <= starter.recoverMs
      expect(betterEverywhere).toBe(false)
    }
  )

  it('and every upgrade is genuinely better at SOMETHING', () => {
    for (const s of SHOES) {
      if (s.id === STARTER_SHOE) continue
      const betterSomewhere =
        s.agility > starter.agility ||
        s.radius > starter.radius ||
        s.pierce > starter.pierce ||
        s.spikeProof || s.silent || s.slide || s.chain > 0 || s.stunMs > 0
      expect(betterSomewhere).toBe(true)
    }
  })
})

describe('blowPierce', () => {
  it('adds the slam bonus, and only on a slam', () => {
    for (const s of SHOES) {
      expect(blowPierce(s, false)).toBe(s.pierce)
      expect(blowPierce(s, true)).toBe(s.pierce + SLAM_PIERCE_BONUS)
    }
  })

  it('lets the starter slam through every shell in the game, so no bug is a paywall', () => {
    const hardest = Math.max(...BUGS.map((b) => b.armor))
    expect(blowPierce(starter, true)).toBeGreaterThanOrEqual(hardest)
  })
})

describe('shoeAvailability', () => {
  const boot = shoeSpec('steelBoot')

  it('reports the starter as owned even with nothing banked', () => {
    const a = shoeAvailability(starter, [], 0, 0)
    expect(a.owned).toBe(true)
    expect(a.starLocked).toBe(false)
  })

  it('shows the STAR gate first when the player is short of stars', () => {
    const a = shoeAvailability(boot, [], boot.starGate - 3, 99_999)
    expect(a.owned).toBe(false)
    expect(a.starLocked).toBe(true)
    expect(a.affordable).toBe(false)
    expect(a.starsShort).toBe(3)
  })

  it('shows the PRICE once the stars are in', () => {
    const a = shoeAvailability(boot, [], boot.starGate, boot.cost - 50)
    expect(a.starLocked).toBe(false)
    expect(a.affordable).toBe(false)
    expect(a.coinsShort).toBe(50)
  })

  it('is affordable when both gates are clear', () => {
    const a = shoeAvailability(boot, [], boot.starGate, boot.cost)
    expect(a.affordable).toBe(true)
    expect(a.starsShort).toBe(0)
    expect(a.coinsShort).toBe(0)
  })

  it('an owned shoe is never locked or priced again', () => {
    const a = shoeAvailability(boot, ['steelBoot'], 0, 0)
    expect(a.owned).toBe(true)
    expect(a.starLocked).toBe(false)
    expect(a.affordable).toBe(false)
  })
})
