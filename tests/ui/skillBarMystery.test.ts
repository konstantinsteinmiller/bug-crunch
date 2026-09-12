import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import en from '@/i18n/locales/en'
import { DECOY_GIFT_STAGE, FROST_GIFT_STAGE, SHIELD_GIFT_STAGE } from '@/game/ladder'

/**
 * ─── The skills still to come, shown as mysteries ───────────────────────────
 *
 * The bar used to show only what the player owned. It now shows every slot —
 * the ones still to come greyed behind a question mark — and the specs below
 * are the promises that keep a locked slot from being a dead button:
 *
 *   IT IS NOT A CONTROL   pressing one never uses a skill and never steers;
 *                         it shakes and says when it opens.
 *   IT HINTS, BARELY      every locked slot carries a faint silhouette of the
 *                         skill behind it — shield, ice crystal, flare.
 *   IT PAYS OFF ONCE      the first time a slot fills, its button plays a
 *                         reveal — once, ever, and not on the next mount.
 *   IT FITS               the wide row under the squad shows every slot; the
 *                         tall fallback column shows only the NEXT one.
 *
 * …and the free Frost Nova the stage-4 boss hands over is the fourth state:
 * a real button, badged, for exactly one press.
 */

const playSound = vi.fn()
vi.mock('@/use/useSound', () => ({ default: () => ({ playSound: (...a: unknown[]) => playSound(...a) }) }))

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })

/** jsdom has no layout, so the bar's one measurement — a button's height — is
 *  stubbed. Tall enough viewport plus a real button height puts it UNDER the
 *  squad; a zero height is the pre-layout state, which takes the fallback. */
const layout = (buttonPx: number): void => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0, y: 0, width: buttonPx, height: buttonPx, top: 0, left: 0,
    right: buttonPx, bottom: buttonPx, toJSON: () => ({})
  } as DOMRect)
  Object.defineProperty(window, 'innerHeight', { value: 900, configurable: true })
}

const PROPS = { shieldLive: false, laneHalfPx: 180, squadFloorPx: 500, hudBottomPx: 100 }

let wrapper: VueWrapper | null = null
const mountBar = async (): Promise<VueWrapper> => {
  const SkillBar = (await import('@/components/game/SkillBar.vue')).default
  wrapper = mount(SkillBar, { props: PROPS, global: { plugins: [i18n] }, attachTo: document.body })
  await nextTick()
  await nextTick()
  return wrapper
}

/** Write the deepest stage the save has cleared — what the late skills key off. */
const clearedThrough = async (n: number): Promise<void> => {
  const { setState } = await import('@/use/useTowerState')
  const { BEST_STAGE_KEY } = await import('@/keys')
  setState(BEST_STAGE_KEY, n)
}

beforeEach(async () => {
  localStorage.clear()
  const { __resetTowerState } = await import('@/use/useTowerState')
  __resetTowerState()
  const { __setUpgradeLevel } = await import('@/use/useUpgrades')
  __setUpgradeLevel('shield', 0)
  playSound.mockClear()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.restoreAllMocks()
})

describe('the row under the squad shows every slot', () => {
  it('draws the grenade as a button and the three skills still to come as mysteries', async () => {
    layout(50)
    const w = await mountBar()
    const locked = w.findAll('.skills__btn--locked')
    const owned = w.findAll('.skills__btn:not(.skills__btn--locked)')
    expect(owned.length, 'the grenade is the only skill a fresh save owns').toBe(1)
    expect(locked.length, 'the shield, the frost and the flare should be waiting').toBe(3)
    // A locked slot is not a skill on cooldown: no ring, no countdown.
    for (const l of locked) {
      expect(l.find('.skills__ring').exists()).toBe(false)
      expect(l.find('.skills__count').exists()).toBe(false)
      expect(l.attributes('aria-disabled')).toBe('true')
    }
  })

  it('gives every locked slot a silhouette to guess from, behind the question mark', async () => {
    layout(50)
    const w = await mountBar()
    const locked = w.findAll('.skills__btn--locked')
    for (const l of locked) {
      expect(l.find('.mystery__ghost').exists(), 'a locked slot with nothing to guess from').toBe(true)
      expect(l.find('.mystery__glyph').text()).toBe('?')
    }
  })

  it('says when each one opens', async () => {
    layout(50)
    const w = await mountBar()
    const [shield, frost, decoy] = w.findAll('.skills__btn--locked')
    expect(shield!.attributes('aria-label')).toBe(`Unlocks at stage ${SHIELD_GIFT_STAGE}`)
    expect(frost!.attributes('aria-label')).toBe(`Unlocks at stage ${FROST_GIFT_STAGE}`)
    expect(decoy!.attributes('aria-label')).toBe(`Unlocks at stage ${DECOY_GIFT_STAGE}`)
  })
})

describe('a locked slot is not a control', () => {
  it('shakes and shows its hint on a press, and never uses a skill', async () => {
    layout(50)
    const w = await mountBar()
    const shield = w.findAll('.skills__btn--locked')[0]!
    await shield.trigger('pointerdown')
    await nextTick()
    await nextTick()
    expect(w.emitted('use'), 'a locked slot fired a skill').toBeUndefined()
    expect(playSound).toHaveBeenCalledWith('obstacle-hit', 0.03)
    expect(shield.classes()).toContain('skills__btn--nudge')
    expect(shield.find('.skills__hint').text()).toBe(`Unlocks at stage ${SHIELD_GIFT_STAGE}`)
  })
})

describe('the fallback column shows only what is next', () => {
  it('keeps the tall layout to the grenade and the one slot the player is playing toward', async () => {
    layout(0)
    const w = await mountBar()
    const locked = w.findAll('.skills__btn--locked')
    expect(w.classes()).not.toContain('skills--under')
    expect(locked.length, 'the column stacked every mystery up the edge').toBe(1)
    expect(locked[0]!.attributes('aria-label')).toBe(`Unlocks at stage ${SHIELD_GIFT_STAGE}`)
  })
})

describe('the question mark comes off once', () => {
  it('reveals the shield the first time it is owned, and never again', async () => {
    layout(50)
    const w = await mountBar()
    const { __setUpgradeLevel } = await import('@/use/useUpgrades')
    __setUpgradeLevel('shield', 1)
    await nextTick()
    await nextTick()
    const owned = w.findAll('.skills__btn:not(.skills__btn--locked)')
    expect(owned.length, 'the shield did not fill its slot').toBe(2)
    expect(owned[1]!.classes(), 'the shield arrived without its reveal').toContain('skills__btn--reveal')
    expect(playSound, 'the reveal was silent').toHaveBeenCalledWith('reward-continue', 0.08)
    expect(w.findAll('.skills__btn--locked').length).toBe(2)

    // A fresh mount — the next run — shows it owned and quiet.
    w.unmount()
    const again = await mountBar()
    const shield = again.findAll('.skills__btn:not(.skills__btn--locked)')[1]!
    expect(shield.classes(), 'the reveal replayed on the next run').not.toContain('skills__btn--reveal')
  })

  it('never reveals what a save already owned before reveals existed', async () => {
    // A returning player who bought the shield weeks ago: their save has no
    // record of reveals at all, and must not be treated as seeing it for the
    // first time.
    const { __setUpgradeLevel } = await import('@/use/useUpgrades')
    __setUpgradeLevel('shield', 3)
    layout(50)
    const w = await mountBar()
    const shield = w.findAll('.skills__btn:not(.skills__btn--locked)')[1]!
    expect(shield.classes()).not.toContain('skills__btn--reveal')
  })

  it('does reveal the late skills to a veteran whose save predates them', async () => {
    // Past stage 10 with no record of reveals: the shield was theirs before the
    // question marks existed, but the frost and the flare are new to everybody.
    const { __setUpgradeLevel } = await import('@/use/useUpgrades')
    __setUpgradeLevel('shield', 2)
    await clearedThrough(12)
    layout(50)
    const w = await mountBar()
    const buttons = w.findAll('.skills__btn:not(.skills__btn--locked)')
    expect(buttons.length, 'a stage-12 save owns all four').toBe(4)
    expect(buttons[1]!.classes()).not.toContain('skills__btn--reveal')
    expect(buttons[2]!.classes()).toContain('skills__btn--reveal')
    expect(buttons[3]!.classes()).toContain('skills__btn--reveal')
  })
})

describe('the stage-4 boss hands over one free Frost Nova', () => {
  it('fills the frost slot with a badged, pressable button after stage 4', async () => {
    await clearedThrough(4)
    layout(50)
    const w = await mountBar()
    const trial = w.find('.skills__btn--trial')
    expect(trial.exists(), 'no free try after the stage-4 boss').toBe(true)
    expect(trial.find('.skills__badge').text()).toBe('×1')
    expect(trial.attributes('aria-label')).toBe('Frost Nova · free try')
    expect(trial.classes(), 'the free try arrived without a reveal').toContain('skills__btn--reveal')
    await trial.trigger('pointerdown')
    expect(w.emitted('use')?.[0]).toEqual(['frost'])
  })

  it('goes back behind its question mark once it has been spent', async () => {
    await clearedThrough(5)
    const { spendTrial } = await import('@/use/useSkills')
    spendTrial('frost')
    layout(50)
    const w = await mountBar()
    expect(w.find('.skills__btn--trial').exists()).toBe(false)
    const [, frost] = w.findAll('.skills__btn--locked')
    expect(frost!.attributes('aria-label')).toBe(`Unlocks at stage ${FROST_GIFT_STAGE}`)
  })

  it('is not offered before the stage-4 boss, nor once the skill is owned for good', async () => {
    await clearedThrough(3)
    layout(50)
    let w = await mountBar()
    expect(w.find('.skills__btn--trial').exists()).toBe(false)
    w.unmount()
    await clearedThrough(FROST_GIFT_STAGE - 1)
    w = await mountBar()
    expect(w.find('.skills__btn--trial').exists()).toBe(false)
    expect(w.find('.skills__btn--frost').exists(), 'frost is owned from stage 7').toBe(true)
  })
})
