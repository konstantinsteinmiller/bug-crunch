import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Staged art loading: what the splash holds for is derived from the stage the
 * player is about to play, not listed — so a new player waits for a stage's
 * worth of bitmaps and a returning one waits for THEIR stage's cast.
 */

let stage = 1
vi.mock('@/use/useTowerState', () => ({
  getState: (_key: string, fallback: unknown) => stage ?? fallback
}))

const trackImages = (): string[] => {
  const requested: string[] = []
  class FakeImage {
    decoding = 'auto'
    naturalWidth = 0
    addEventListener(): void { /* never fires */ }
    set src(value: string) { requested.push(value) }
    get src(): string { return '' }
  }
  vi.stubGlobal('Image', FakeImage as unknown as typeof Image)
  return requested
}

const load = async (artOn: boolean) => {
  vi.resetModules()
  vi.stubEnv('VITE_ENABLE_ART_OVERRIDES', artOn ? 'true' : '')
  return import('@/game/artPreload')
}

const has = (wants: readonly (readonly [string, string])[], kind: string, id: string): boolean =>
  wants.some(([k, i]) => k === kind && i === id)

beforeEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  window.history.replaceState({}, '', '/')
  localStorage.removeItem('artOverrides')
  stage = 1
})

describe('tier 0 — behind the splash', () => {
  it('is a stage\'s worth, not the cast: a new player waits for stage 1', async () => {
    stage = 1
    const m = await load(true)
    const t0 = m.criticalArtWants()
    expect(has(t0, 'hero', 'teal')).toBe(true)
    expect(has(t0, 'monster', 'grumpling')).toBe(true)
    expect(has(t0, 'bg', 'ridge-far')).toBe(true)
    // The road tile is drawn, never painted, so it is never fetched.
    expect(has(t0, 'bg', 'lane')).toBe(false)
    expect(has(t0, 'prop', 'crate-damage')).toBe(true)
    expect(has(t0, 'round', 'tracer')).toBe(true)
    // The shop button and the grenade button are on screen from the first second.
    expect(has(t0, 'ui', 'chest')).toBe(true)
    expect(has(t0, 'ui', 'skill-grenade')).toBe(true)
    // The rocket's first box is stage 8's — see `weaponForStage`.
    expect(has(t0, 'round', 'rocket')).toBe(false)
    // Stage 7's brute, stage 3's bill door and the stage-6 arena's keg are not
    // on stage 1's screen and must not be on its splash.
    expect(has(t0, 'monster', 'snaggletusk')).toBe(false)
    expect(has(t0, 'gate', 'frame-sub')).toBe(false)
    expect(has(t0, 'prop', 'barrel')).toBe(false)
    expect(t0.length).toBeLessThan(40)
  })

  it('follows a returning player to their own stage', async () => {
    stage = 7
    const m = await load(true)
    const t0 = m.criticalArtWants()
    expect(m.resumeStage()).toBe(7)
    expect(has(t0, 'monster', 'snaggletusk')).toBe(true)
    expect(has(t0, 'gate', 'frame-sub')).toBe(true)
    expect(has(t0, 'ui', 'crown')).toBe(true)
  })

  it('treats a broken save as a new player', async () => {
    stage = Number.NaN
    const m = await load(true)
    expect(m.resumeStage()).toBe(1)
  })
})

describe('tiers 1 and 2', () => {
  it('puts the stage\'s own threats and the next stage\'s newcomers first, without repeating tier 0', async () => {
    stage = 6
    const m = await load(true)
    const t0 = new Set(m.criticalArtWants().map(([k, i]) => `${k}/${i}`))
    const t1 = m.earlyArtWants()
    for (const [k, i] of t1) expect(t0.has(`${k}/${i}`)).toBe(false)
    // Stage 6's arena has barrels, and stage 7 brings the brutes. Stage 6's
    // own boss is the summoner, which is always the Marrow Knight — already
    // in tier 0 as a husk design — so both brutes are stage-7 newcomers here.
    expect(has(t1, 'prop', 'barrel')).toBe(true)
    expect(has(t1, 'monster', 'thornwick')).toBe(true)
    expect(has(t1, 'monster', 'snaggletusk')).toBe(true)
    expect(has(t1, 'round', 'grenade')).toBe(true)
    // The shield's button and the banner the stage ends on follow the splash.
    expect(has(t1, 'ui', 'skill-shield')).toBe(true)
    expect(has(t1, 'ui', 'ribbon')).toBe(true)
    // Stage 6's box holds the GATLING — it is the first puzzle stage, and the
    // first prize is the weapon that does not also teach a new verb. Neither
    // stage 6 nor stage 7 needs the rocket painted.
    expect(has(t1, 'round', 'rocket')).toBe(false)
    // The box itself is on stage 6's road, though, in both its states.
    expect(has(t1, 'prop', 'weapon-box')).toBe(true)
  })

  it('fetches the rocket only for the stages whose box holds it', async () => {
    stage = 1
    let m = await load(true)
    expect(has(m.earlyArtWants(), 'round', 'rocket')).toBe(false)
    // Stage 7 carries no puzzle at all, but stage 8 — the next — is the
    // rocket's first box, and tier 1 covers the stage after this one.
    stage = 7
    m = await load(true)
    expect(has(m.earlyArtWants(), 'round', 'rocket')).toBe(true)
    // Stage 9 and stage 10 are a blank road and a gatling box: nothing to fetch.
    stage = 9
    m = await load(true)
    expect(has(m.earlyArtWants(), 'round', 'rocket')).toBe(false)
  })

  it('fetches no puzzle art at all for the stages between the boxes', async () => {
    // Half the campaign's roads carry no weapon beat — see `WEAPON_EVERY`.
    // Holding the splash for a box that is not on the road is a slower start
    // bought for nothing.
    stage = 3
    const m = await load(true)
    const t0 = new Set(m.criticalArtWants().map(([k, i]) => `${k}/${i}`))
    expect(t0.has('prop/weapon-box')).toBe(false)
    expect(has(m.earlyArtWants(), 'prop', 'weapon-box')).toBe(false)
  })

  it('sweeps every painting in the end, so nothing is orphaned', async () => {
    const m = await load(true)
    const { ART_CATALOGUE } = await import('@/game/artCatalogue')
    const { allMonsterIds } = await import('@/game/monsterSprites')
    const all = m.allArtWants()
    for (const [kind, ids] of Object.entries(ART_CATALOGUE)) {
      for (const id of ids) expect(has(all, kind, id)).toBe(true)
    }
    for (const id of allMonsterIds()) expect(has(all, 'monster', id)).toBe(true)
    expect(new Set(all.map(([k, i]) => `${k}/${i}`)).size).toBe(all.length)
  })

  it('requests nothing at all with overrides off', async () => {
    const requested = trackImages()
    const m = await load(false)
    await m.preloadRemainingArt()
    expect(requested).toEqual([])
  })

  it('requests tier 1 serially and then the rest when on', async () => {
    const requested = trackImages()
    vi.stubGlobal('requestIdleCallback', (cb: () => void) => { cb(); return 1 })
    const m = await load(true)
    const early = m.earlyArtWants()
    // Tier 1 awaits each probe, and the fakes never settle — so only the
    // first is asked for before the promise parks. That IS the serial order.
    const p = m.preloadRemainingArt()
    expect(requested).toHaveLength(1)
    expect(requested[0]).toContain(`${early[0]![1]}.webp`)
    void p
  })
})
