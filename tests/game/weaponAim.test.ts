// ─── The launcher aims itself ───────────────────────────────────────────────
//
// The squad's own gun fires forward and only forward, and so does the gatling:
// the whole game is "point the crowd at the thing", and a rifle that aimed
// itself would delete the verb.
//
// The rocket launcher is the exception, and it is what makes it a different
// weapon rather than a bigger one. It fires roughly once a second; a round that
// misses because the pack drifted two units left is not a reward, it is a
// downgrade. So the launcher converts the player's job from AIMING to
// POSITIONING — which is the trade its cadence already implied.
//
// The refusals matter as much as the aim, and each is a rule about what the
// weapon is for:
//
//   • never behind the muzzle — a round that turns around lands in the crowd,
//     and the blast does not ask who is standing in it;
//   • never past the gun's reach — `BULLET_RANGE` is a promise about the screen,
//     and an auto-aimer that outranged it would make the Reach track pointless;
//   • never at scenery — crates, barrels and the puzzle's own levers are the
//     targets the PLAYER chooses.

import { beforeEach, describe, expect, it } from 'vitest'
import { BULLET_RANGE, type Foe } from '@/game/survival'
import { WEAPONS, weaponDpsMul, weaponStreams } from '@/game/weapons'
import { SHOOTERS } from '@/game/survival'

const importGame = () => import('@/use/useSurvivalGame')
type Game = Awaited<ReturnType<typeof importGame>>

const STEP_MS = 16

beforeEach(async () => {
  localStorage.clear()
  const { __resetTowerState } = await import('@/use/useTowerState')
  __resetTowerState()
  const game = await importGame()
  game.debugGiveWeapon(null)
})

/** A stage running, with a body to shoot at, and nothing else in the way. */
const armed = async (): Promise<{ game: Game; template: Foe }> => {
  const game = await importGame()
  game.startStage(9)
  game.debugAddUnits(80)
  for (let i = 0; i < 4000 && game.getFoes().length < 1; i++) game.step(STEP_MS)
  const template = game.getFoes()[0]
  expect(template, 'stage 9 should put something on the road').toBeTruthy()
  return { game, template: template! }
}

/**
 * Fire for a stretch of road at ONE body parked at `(dx, dy)` from the crowd,
 * and report the widest sideways velocity any round left the muzzle with.
 *
 * The road is emptied every frame so nothing else can be acquired, and the body
 * is re-planted every frame so the crowd never simply runs past it.
 */
const fireAt = (
  game: Game, template: Foe, weapon: 'rocket' | 'gatling' | null,
  dx: number, dy: number, frames = 200
): { peakVx: number; rounds: number } => {
  game.debugGiveWeapon(weapon)
  game.getBullets().length = 0
  const mark = { ...template, id: 99001, dead: false, hp: 1e9, maxHp: 1e9, speed: 0, hold: 0 }
  let peakVx = 0
  let rounds = 0
  for (let i = 0; i < frames; i++) {
    const a = game.anchor()
    mark.x = a.x + dx
    mark.y = a.y + dy
    const foes = game.getFoes()
    foes.length = 0
    foes.push(mark)
    game.getCrates().length = 0
    game.getBarricades().length = 0
    game.getRocks().length = 0
    game.getGuards().length = 0
    game.steerTo(a.x)
    game.step(STEP_MS)
    for (const b of game.getBullets()) {
      rounds++
      if (Math.abs(b.vx) > Math.abs(peakVx)) peakVx = b.vx
    }
  }
  game.debugGiveWeapon(null)
  return { peakVx, rounds }
}

describe('which weapons steer', () => {
  it('says so in one place', () => {
    // The flag is the contract the sim branches on; the two weapons' feel is
    // supposed to differ HERE and not in a special case somewhere downstream.
    expect(WEAPONS.rocket.homing).toBe(true)
    expect(WEAPONS.gatling.homing).toBe(false)
  })

  it('turns a rocket onto a body out at the shoulder', async () => {
    const { game, template } = await armed()
    // Roughly 3.5 units across and 6 up: a target the forward-firing gun would
    // miss completely, and the exact case the launcher exists for.
    const r = fireAt(game, template, 'rocket', 3.5, 6)
    expect(r.rounds, 'the launcher never fired').toBeGreaterThan(0)
    // The whole speed budget goes along the vector, so a target 3.5 across and
    // 6 up takes a real share of it sideways — far outside the ±0.25 scatter an
    // ordinary round carries.
    expect(r.peakVx, `peak vx ${r.peakVx}`).toBeGreaterThan(4)
  })

  it('follows the target to the other side of the road', async () => {
    const { game, template } = await armed()
    const left = fireAt(game, template, 'rocket', -3.5, 6)
    expect(left.peakVx, `peak vx ${left.peakVx}`).toBeLessThan(-4)
  })

  it('leaves the gatling and the plain gun firing straight', async () => {
    const { game, template } = await armed()
    // Same target, same road, no turn. This is the control that stops the test
    // above passing on a change that made EVERY weapon home.
    const gat = fireAt(game, template, 'gatling', 3.5, 6)
    expect(gat.rounds, 'the gatling never fired').toBeGreaterThan(0)
    expect(Math.abs(gat.peakVx), `gatling vx ${gat.peakVx}`).toBeLessThan(0.3)

    const plain = fireAt(game, template, null, 3.5, 6)
    expect(Math.abs(plain.peakVx), `plain vx ${plain.peakVx}`).toBeLessThan(0.3)
  })
})

describe('the launcher fires a salvo, and it grows with the squad', () => {
  // Reported by a player twice. First: "only fires one round no matter the size
  // of the squad" — the launcher shipped at a flat ONE stream, so a squad of
  // four and a squad of four hundred fired the same single rocket while the
  // number behind it grew by two orders of magnitude. Then, after scaling was
  // added off a base of one: "the rocket launcher is still only firing 1
  // bullet, that is not a good power fantasy". Both reports are about the same
  // thing — what LEAVES the crowd — and the floor below is the answer.
  it('never fires fewer than a salvo, however small the crowd', () => {
    // The fix for the second report. `streamsPer` was 12 off a base of one, so
    // every squad under a dozen — most of a stage's opening, and every run that
    // is going badly — still watched a single round leave.
    for (const crowd of [1, 2, 3, 8, 11]) {
      expect(weaponStreams('rocket', crowd), `crowd ${crowd}`).toBeGreaterThanOrEqual(3)
    }
  })

  it('fields more launchers as the crowd grows, and stops well short of a hose', () => {
    const crowds = [3, 12, 24, 36, 60, 400]
    const counts = crowds.map((n) => weaponStreams('rocket', n))
    // Monotonic, from a floor of three to a ceiling of five: the player asked
    // for "3-5 rocket rounds", and this is the band.
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]!, `crowd ${crowds[i]}`).toBeGreaterThanOrEqual(counts[i - 1]!)
    }
    expect(Math.min(...counts)).toBe(3)
    expect(Math.max(...counts)).toBe(5)
    expect(counts[counts.length - 1]).toBeGreaterThan(counts[0]!)
    // Capped LOW on purpose: the launcher's whole read is that it is not the
    // hose beside it. At `SHOOTERS` streams it would be a slower gatling with a
    // blast, and the two weapons would stop being a choice.
    expect(Math.max(...counts)).toBeLessThan(SHOOTERS / 2)
  })

  it('puts the whole salvo in the air on ONE frame', async () => {
    // The difference between a salvo and a trickle is entirely in whether the
    // rounds arrive together, and it is the whole point of the change: five
    // rounds a second leaving one at a time is the picture the single stream
    // already drew, only faster.
    const { game, template } = await armed()
    game.debugAddUnits(200)
    game.debugGiveWeapon('rocket')
    game.getBullets().length = 0
    const mark = { ...template, id: 99003, dead: false, hp: 1e9, maxHp: 1e9, speed: 0, hold: 0 }
    let biggestBurst = 0
    for (let i = 0; i < 300; i++) {
      const a = game.anchor()
      mark.x = a.x
      mark.y = a.y + 6
      const foes = game.getFoes()
      foes.length = 0
      foes.push(mark)
      const before = game.getBullets().length
      game.steerTo(a.x)
      game.step(STEP_MS)
      biggestBurst = Math.max(biggestBurst, game.getBullets().length - before)
    }
    game.debugGiveWeapon(null)
    // A crowd of 200 fields the full five, and all five leave together.
    expect(biggestBurst).toBeGreaterThanOrEqual(weaponStreams('rocket', 200))
    expect(WEAPONS.rocket.volley).toBe(true)
    // …and the gatling explicitly does not: fourteen tracers on one frame and
    // nothing for the next thirteen is a strobe, not a hose.
    expect(WEAPONS.gatling.volley).toBe(false)
  })

  it('spreads a salvo across the pack instead of stacking it on one body', async () => {
    // Five rockets into the monster the first one already killed is four rounds
    // of overkill, and on screen it is one explosion rather than a fan of five.
    const { game, template } = await armed()
    game.debugAddUnits(200)
    game.debugGiveWeapon('rocket')
    game.getBullets().length = 0
    // Four bodies abreast, well apart, all in reach.
    const pack = [-3, -1, 1, 3].map((dx, n) => ({
      ...template, id: 99100 + n, dead: false, hp: 1e9, maxHp: 1e9, speed: 0, hold: 0, dx
    }))
    let widestSpread = 0
    for (let i = 0; i < 300; i++) {
      const a = game.anchor()
      const foes = game.getFoes()
      foes.length = 0
      for (const f of pack) {
        f.x = a.x + f.dx
        f.y = a.y + 6
        foes.push(f)
      }
      const before = game.getBullets().length
      game.steerTo(a.x)
      game.step(STEP_MS)
      const fired = game.getBullets().slice(before)
      if (fired.length >= 2) {
        const xs = fired.map((b) => b.vx)
        widestSpread = Math.max(widestSpread, Math.max(...xs) - Math.min(...xs))
      }
    }
    game.debugGiveWeapon(null)
    // Rounds of one volley left along visibly different vectors, which they
    // cannot do if they all acquired the same monster from the same rank.
    expect(widestSpread, `spread ${widestSpread}`).toBeGreaterThan(2)
  })

  it('leaves the gatling and the plain gun on the squad’s own muzzles', () => {
    for (const n of [3, 40, 400]) {
      expect(weaponStreams('gatling', n)).toBe(SHOOTERS)
      expect(weaponStreams(null, n)).toBe(SHOOTERS)
    }
  })

  it('is a FEEL dial and not a buff — the DPS product does not move', () => {
    // `streams` divides the damage each round carries and multiplies the
    // cadence by the same factor, so it cancels out exactly. If it ever stops
    // cancelling, the launcher silently gets stronger as the crowd grows and
    // every balance number in `game/weapons.ts` is wrong.
    const dps = (alive: number, damage: number): number => {
      const streams = weaponStreams('rocket', alive)
      const perRound = ((alive * damage) / streams) * WEAPONS.rocket.damageMul
      const roundsPerSecond = streams * WEAPONS.rocket.rateMul
      return perRound * roundsPerSecond
    }
    // Same crowd, every stream count the cap allows: identical output.
    for (const alive of [3, 12, 24, 36, 60, 400]) {
      expect(dps(alive, 2)).toBeCloseTo(alive * 2 * weaponDpsMul('rocket'), 6)
    }
  })

  it('actually puts more rockets in the air for a bigger crowd', async () => {
    const { game, template } = await armed()
    const inFlight = (squad: number): number => {
      game.startStage(9)
      game.debugAddUnits(squad)
      game.debugGiveWeapon('rocket')
      game.getBullets().length = 0
      const mark = { ...template, id: 99002, dead: false, hp: 1e9, maxHp: 1e9, speed: 0, hold: 0 }
      let peak = 0
      for (let i = 0; i < 200; i++) {
        const a = game.anchor()
        mark.x = a.x
        mark.y = a.y + 6
        const foes = game.getFoes()
        foes.length = 0
        foes.push(mark)
        game.steerTo(a.x)
        game.step(STEP_MS)
        peak = Math.max(peak, game.getBullets().filter((b) => b.weapon === 'rocket').length)
      }
      return peak
    }
    const small = inFlight(4)
    const big = inFlight(200)
    game.debugGiveWeapon(null)
    expect(small, 'the launcher never fired for a small squad').toBeGreaterThan(0)
    expect(big, `small ${small} vs big ${big}`).toBeGreaterThan(small)
  })
})

describe('what it refuses to aim at', () => {
  it('never turns around for a body behind the crowd', async () => {
    const { game, template } = await armed()
    // Behind the muzzle. A rocket that turned back would detonate in the squad,
    // and the blast does not ask whose side anyone is on.
    const r = fireAt(game, template, 'rocket', 0, -4)
    expect(r.rounds, 'the launcher never fired').toBeGreaterThan(0)
    expect(Math.abs(r.peakVx), `turned back: vx ${r.peakVx}`).toBeLessThan(0.3)
  })

  it('never reaches past the gun', async () => {
    const { game, template } = await armed()
    // Parked comfortably beyond `BULLET_RANGE`. The reach is a promise about
    // what is on screen, and the Reach upgrade is the only thing allowed to
    // move it.
    const r = fireAt(game, template, 'rocket', 3.5, BULLET_RANGE + 4)
    expect(r.rounds, 'the launcher never fired').toBeGreaterThan(0)
    expect(Math.abs(r.peakVx), `outranged: vx ${r.peakVx}`).toBeLessThan(0.3)
  })

  it('does not spend the stage shooting the scenery', async () => {
    const { game, template } = await armed()
    game.debugGiveWeapon('rocket')
    game.getBullets().length = 0
    let peak = 0
    for (let i = 0; i < 200; i++) {
      const a = game.anchor()
      // No monsters at all — only a supply crate, far off the line. A launcher
      // that acquired crates would arrive at every pack with nothing left.
      game.getFoes().length = 0
      const crates = game.getCrates()
      crates.length = 0
      crates.push({
        id: 98001, kind: 'rate', x: a.x + 3.6, y: a.y + 6,
        hp: 1e9, maxHp: 1e9, spin: 0, dead: false
      })
      game.steerTo(a.x)
      game.step(STEP_MS)
      for (const b of game.getBullets()) peak = Math.max(peak, Math.abs(b.vx))
    }
    expect(peak, `turned for a crate: vx ${peak}`).toBeLessThan(0.3)
    game.debugGiveWeapon(null)
  })
})
