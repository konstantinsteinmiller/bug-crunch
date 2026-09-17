import { describe, expect, it } from 'vitest'
import {
  BUGS,
  BUG_IDS,
  blowDamage,
  bugSpec,
  isBugId,
  resolveStomp,
  rosterForLevel,
  type BugSpec
} from '@/game/bugs'
import { SLAM_PIERCE_BONUS, blowPierce, shoeSpec } from '@/game/shoes'

const stomp = (bug: BugSpec, over: Partial<Parameters<typeof resolveStomp>[0]> = {}) =>
  resolveStomp({ bug, damage: 0, pierce: 9, spikeProof: false, fever: false, heavy: false, ...over })

describe('the bestiary', () => {
  it('has a unique id for every entry, and the lookup agrees', () => {
    expect(new Set(BUG_IDS).size).toBe(BUGS.length)
    for (const b of BUGS) expect(bugSpec(b.id)).toBe(b)
  })

  it('throws on an unknown id rather than papering over a typo in a roster', () => {
    // @ts-expect-error — deliberately outside the union.
    expect(() => bugSpec('woodlouse')).toThrow()
  })

  it('guards its own type predicate', () => {
    expect(isBugId('ant')).toBe(true)
    expect(isBugId('woodlouse')).toBe(false)
    expect(isBugId(7)).toBe(false)
    expect(isBugId(null)).toBe(false)
  })

  it('gives every bug a positive size, score, juice and hp', () => {
    for (const b of BUGS) {
      expect(b.size).toBeGreaterThan(0)
      expect(b.hp).toBeGreaterThanOrEqual(1)
      expect(b.score).toBeGreaterThan(0)
      expect(b.juice).toBeGreaterThan(0)
      expect(b.debut).toBeGreaterThanOrEqual(1)
    }
  })

  it('stays readable at phone scale: nothing is a speck', () => {
    // `u` is a hundredth of the short edge, so 2.5u is 8px on a 320px phone.
    for (const b of BUGS) expect(b.size).toBeGreaterThanOrEqual(2.5)
  })

  it('pays more for the bugs that are harder to kill', () => {
    const ant = bugSpec('ant')
    for (const b of BUGS) {
      if (b.id === 'ant') continue
      expect(b.score).toBeGreaterThanOrEqual(ant.score)
    }
  })

  it('opens the game with the ant and nothing else', () => {
    const debutants = BUGS.filter((b) => b.debut === 1).map((b) => b.id)
    expect(debutants).toEqual(['ant'])
  })

  // The complaint this pacing was written against: "the first 3 levels feel
  // like playing the same mechanics 3 times". Two designs sharing a debut is
  // the shape of that problem — one of them is met, the other is noise.
  it('never debuts two designs on the same level of world 1', () => {
    const debuts = BUGS.filter((b) => b.debut <= 10).map((b) => b.debut)
    expect(debuts.length).toBeGreaterThan(3)
    expect(new Set(debuts).size).toBe(debuts.length)
  })

  // The order the owner asked for after players drifted off 30-50 s in: the
  // two ideas that change what a tap MEANS come first, and the Queen's shell
  // is taught (the beetle) before the level she asks for it on (1-4).
  it('opens world 1 caterpillar, beetle, sprinter, piñata, flea — in that order', () => {
    expect(bugSpec('caterpillar').debut).toBe(2)
    expect(bugSpec('beetle').debut).toBe(3)
    expect(bugSpec('sprinter').debut).toBe(5)
    expect(bugSpec('pinatafly').debut).toBe(7)
    expect(bugSpec('flea').debut).toBe(8)
  })
})

describe('the caterpillar', () => {
  const caterpillar = bugSpec('caterpillar')

  it('arrives on level 2 — the first thing the game adds after the ant', () => {
    expect(rosterForLevel([{ id: 'caterpillar', weight: 1 }], 1)).toHaveLength(0)
    expect(rosterForLevel([{ id: 'caterpillar', weight: 1 }], 2)).toHaveLength(1)
    const second = BUGS.filter((b) => b.id !== 'ant').sort((a, b) => a.debut - b.debut)[0]
    expect(second?.id).toBe('caterpillar')
  })

  // The lesson a six-year-old can learn on their second level is only fair if
  // the caterpillar asks ONE question: it must not also be fast, armoured or
  // evasive, or 1-2 is three lessons wearing one body.
  it('breaks exactly one assumption: stomping it hurts', () => {
    expect(caterpillar.spiky).toBe(true)
    expect(caterpillar.armor).toBe(0)
    expect(caterpillar.dodges).toBe(false)
    expect(caterpillar.sprints).toBe(false)
    expect(caterpillar.airborne).toBe(false)
    expect(caterpillar.speed).toBeLessThan(bugSpec('ant').speed)
  })
})

// The first target that reacts to the player. Everything asserted here is why it
// is a DIFFERENT creature from the flea rather than a second one.
describe('the sprinter ant', () => {
  const sprinter = bugSpec('sprinter')
  const ant = bugSpec('ant')
  const flea = bugSpec('flea')

  it('arrives on level 5 — the first level after the half-strength Queen', () => {
    expect(sprinter.debut).toBe(5)
    expect(rosterForLevel([{ id: 'sprinter', weight: 1 }], 4)).toHaveLength(0)
    expect(rosterForLevel([{ id: 'sprinter', weight: 1 }], 5)).toHaveLength(1)
  })

  it('is the ant plus exactly one rule, so only the rule has to be learned', () => {
    expect(sprinter.motion).toBe(ant.motion)
    expect(sprinter.hp).toBe(1)
    expect(sprinter.armor).toBe(0)
    expect(sprinter.spiky).toBe(false)
    expect(sprinter.stinks).toBe(false)
    expect(sprinter.segments).toBe(0)
    expect(sprinter.airborne).toBe(false)
  })

  it('sprints, and does NOT dodge — they are different questions', () => {
    expect(sprinter.sprints).toBe(true)
    expect(sprinter.dodges).toBe(false)
    expect(flea.dodges).toBe(true)
    expect(flea.sprints).toBe(false)
  })

  it('is the only sprinter in the cast, and nothing does both', () => {
    expect(BUGS.filter((b) => b.sprints).map((b) => b.id)).toEqual(['sprinter'])
    for (const b of BUGS) expect(b.dodges && b.sprints).toBe(false)
  })

  it('pays more than a plain ant, and less than the flea it is not', () => {
    expect(sprinter.score).toBeGreaterThan(ant.score)
    expect(sprinter.score).toBeLessThan(flea.score)
  })

  // The vial is a reward for VOLUME, and pricing a hook's juice by how annoying
  // it is would have made the meter about hooks. Mass, like everything else.
  it('prices its juice by mass rather than by difficulty', () => {
    expect(sprinter.size).toBeLessThan(ant.size)
    expect(sprinter.juice).toBeLessThanOrEqual(ant.juice)
  })

  it('costs the spawn director more attention than an ant and less than a beetle', () => {
    expect(sprinter.cost).toBeGreaterThan(ant.cost)
    expect(sprinter.cost).toBeLessThan(bugSpec('beetle').cost)
  })
})

describe('resolveStomp', () => {
  it('kills a one-hit bug outright', () => {
    expect(stomp(bugSpec('ant'))).toBe('splat')
  })

  it('leaves an armoured bug alive when the shoe is too soft — and CLANGS', () => {
    const beetle = bugSpec('beetle')
    expect(beetle.armor).toBeGreaterThan(0)
    expect(stomp(beetle, { pierce: beetle.armor - 1 })).toBe('ricochet')
  })

  it('hurts before it kills when a bug has more than one hit point', () => {
    const tough = BUGS.find((b) => b.hp > 1)
    expect(tough).toBeDefined()
    expect(stomp(tough!, { damage: 0 })).toBe('hurt')
    expect(stomp(tough!, { damage: tough!.hp - 1 })).toBe('splat')
  })

  // The reason a slam exists at all. It costs a charge and a long recovery —
  // about three taps' worth of time — so a slam that did a tap's damage would be
  // a strictly worse move than tapping, and the only reason to ever charge would
  // be armour.
  it('a slam is worth two blows, so it opens a shell in half the hits', () => {
    expect(blowDamage(false)).toBe(1)
    expect(blowDamage(true)).toBe(2)
    const beetle = bugSpec('beetle')
    expect(beetle.hp).toBeGreaterThan(2)
    // Three taps to kill…
    expect(stomp(beetle, { damage: beetle.hp - 2, heavy: false })).toBe('hurt')
    // …two slams.
    expect(stomp(beetle, { damage: beetle.hp - 2, heavy: true })).toBe('splat')
  })

  it('spikes the player for stomping a spiky bug in an ordinary shoe', () => {
    const spiky = BUGS.find((b) => b.spiky)
    expect(spiky).toBeDefined()
    expect(stomp(spiky!)).toBe('spike')
    expect(stomp(spiky!, { spikeProof: true })).not.toBe('spike')
  })

  // Order is load-bearing; each of these pins one rung of it.
  it('Fever beats everything, including spikes and armour', () => {
    const spiky = BUGS.find((b) => b.spiky)!
    const armoured = BUGS.find((b) => b.armor > 0)!
    expect(stomp(spiky, { fever: true })).toBe('splat')
    expect(stomp(armoured, { fever: true, pierce: 0 })).toBe('splat')
  })

  it('reports the spike even when the shoe would have killed the bug', () => {
    const spiky = BUGS.find((b) => b.spiky)!
    expect(stomp(spiky, { pierce: 99, damage: 99 })).toBe('spike')
  })

  it('a ricochet outranks damage: the shell has to open first', () => {
    const beetle = bugSpec('beetle')
    expect(stomp(beetle, { pierce: 0, damage: 99 })).toBe('ricochet')
  })

  it('a centipede headshot is an instant kill, armour permitting', () => {
    const centipede = bugSpec('centipede')
    expect(stomp(centipede, { headshot: true, damage: 0 })).toBe('splat')
  })
})

// The single number the whole beetle lesson is made of.
describe('the starter sneaker vs the beetle', () => {
  const sneaker = shoeSpec('sneaker')
  const beetle = bugSpec('beetle')

  it('cannot crack the shell with a tap', () => {
    expect(blowPierce(sneaker, false)).toBeLessThan(beetle.armor)
  })

  it('CAN crack it with a heavy slam', () => {
    expect(blowPierce(sneaker, true)).toBeGreaterThanOrEqual(beetle.armor)
    expect(blowPierce(sneaker, true) - blowPierce(sneaker, false)).toBe(SLAM_PIERCE_BONUS)
  })
})

describe('rosterForLevel', () => {
  const roster = BUG_IDS.map((id) => ({ id, weight: 10 }))

  it('only admits bugs that have debuted', () => {
    const early = rosterForLevel(roster, 1)
    expect(early.map((r) => r.id)).toEqual(['ant'])
    for (const r of rosterForLevel(roster, 12)) {
      expect(bugSpec(r.id).debut).toBeLessThanOrEqual(12)
    }
  })

  it('grows monotonically with the level', () => {
    let last = 0
    for (let level = 1; level <= 40; level++) {
      const n = rosterForLevel(roster, level).length
      expect(n).toBeGreaterThanOrEqual(last)
      last = n
    }
    expect(last).toBe(BUG_IDS.length)
  })

  it('keeps the weights untouched', () => {
    expect(rosterForLevel([{ id: 'ant', weight: 62 }], 1)).toEqual([{ id: 'ant', weight: 62 }])
  })
})
