import { describe, expect, it } from 'vitest'
import {
  COBWEB_HOLD_MS,
  CONVEYOR_SPEED,
  HAZARDS,
  HAZE_FOOT_AGILITY,
  HAZE_MS,
  HAZE_R,
  MAGNET_ARMED_MS,
  MAGNET_PULL,
  MAGNET_REACH,
  SALT_BURST_R,
  SALT_PANIC_MS,
  SALT_PANIC_SPEED,
  SPIKE_STUN_MS,
  SWEEPER_CROSS_MS,
  SWEEPER_REST_MS,
  hazardSpec,
  isHazardId
} from '@/game/hazards'
import { allLevels } from '@/game/stages'

describe('the hazard set', () => {
  it('has a unique id for every entry, and the lookup agrees', () => {
    const ids = HAZARDS.map((h) => h.id)
    expect(new Set(ids).size).toBe(HAZARDS.length)
    for (const h of HAZARDS) expect(hazardSpec(h.id)).toBe(h)
  })

  it('guards its own type predicate', () => {
    expect(isHazardId('honey')).toBe(true)
    expect(isHazardId('lava')).toBe(false)
    expect(isHazardId(3)).toBe(false)
  })

  it('keeps every multiplier in a sane range', () => {
    for (const h of HAZARDS) {
      expect(h.size).toBeGreaterThan(0)
      expect(h.bugSpeed).toBeGreaterThan(0)
      expect(h.bugSpeed).toBeLessThanOrEqual(1)
      expect(h.footAgility).toBeGreaterThan(0)
      expect(h.footAgility).toBeLessThanOrEqual(1)
    }
  })

  it('has exactly one lethal hazard, and the player can never stomp it', () => {
    const lethal = HAZARDS.filter((h) => h.lethal)
    expect(lethal.map((h) => h.id)).toEqual(['sweeper'])
    for (const h of lethal) expect(h.stompable).toBe(false)
  })

  it('grounds a bug only where it also slows it — a slow that lets it leap is no trap', () => {
    for (const h of HAZARDS) {
      if (h.grounds) expect(h.bugSpeed).toBeLessThan(1)
    }
  })

  it('only ever puts a hazard on a level that the set knows about', () => {
    for (const level of allLevels()) {
      for (const id of level.hazards) expect(isHazardId(id)).toBe(true)
    }
  })

  it('every hazard actually appears somewhere in the campaign', () => {
    // Laid out by a level, dropped in by a Shoebox Trial, or spilt by a twist.
    const used = new Set<string>(allLevels().flatMap((l) => l.hazards))
    if (allLevels().some((l) => l.trial)) used.add('shoebox')
    if (allLevels().some((l) => l.twist === 'spill')) used.add('slick')
    for (const h of HAZARDS) expect(used.has(h.id), h.id).toBe(true)
  })
})

describe('the hazard timings', () => {
  it('gives the sweeper a rest the player can plan around', () => {
    expect(SWEEPER_CROSS_MS).toBeGreaterThan(0)
    expect(SWEEPER_REST_MS).toBeGreaterThan(0)
  })

  it('arms the magnet long enough to be worth a slam', () => {
    expect(MAGNET_ARMED_MS).toBeGreaterThanOrEqual(2_000)
    expect(MAGNET_PULL).toBeGreaterThan(0)
    expect(MAGNET_REACH).toBeGreaterThan(0)
  })

  it('makes salt a panic, not a kill', () => {
    expect(SALT_BURST_R).toBeGreaterThan(hazardSpec('salt').size)
    expect(SALT_PANIC_MS).toBeGreaterThan(0)
    expect(SALT_PANIC_SPEED).toBeGreaterThan(1)
  })

  it('holds a bug in a cobweb for about a second', () => {
    expect(COBWEB_HOLD_MS).toBeGreaterThanOrEqual(500)
    expect(COBWEB_HOLD_MS).toBeLessThanOrEqual(2_000)
  })

  it('moves the conveyor', () => {
    expect(CONVEYOR_SPEED).toBeGreaterThan(0)
  })

  it('makes a stinkbug haze big, brief and genuinely annoying', () => {
    expect(HAZE_R).toBeGreaterThan(0)
    expect(HAZE_MS).toBeGreaterThan(0)
    expect(HAZE_FOOT_AGILITY).toBeLessThan(1)
  })

  it('stuns the foot on a spike, but not for so long the level is lost to it', () => {
    expect(SPIKE_STUN_MS).toBeGreaterThan(0)
    expect(SPIKE_STUN_MS).toBeLessThanOrEqual(1_500)
  })
})
