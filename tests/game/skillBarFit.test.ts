import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import en from '@/i18n/locales/en'
import { SKILL_SLOTS } from '@/use/useSkills'

/**
 * ─── The skill row sits under the squad, and fits the road ──────────────────
 *
 * The bar used to choose between two layouts: centred under the squad when the
 * band between the crowd's floor and the bottom HUD strip could hold it, and a
 * column up the right edge when it could not. The measurements said a desktop
 * had 18 px of clearance and took the band; a real desktop window, which is
 * shorter than the one that was measured, took the column for a whole playtest —
 * and a skill button out beside the road drags the crowd into the right rail
 * every time a mouse reaches for it, which is the exact failure the move under
 * the squad was made to fix.
 *
 * So there is one placement now, and these are its two halves:
 *
 *   POSITION   centred on the road (the stylesheet's job — the road is the
 *              middle of the viewport at every aspect ratio, which needs no
 *              measurement) and parked on the MEASURED bottom strip.
 *   SIZE       capped by the lane's own width, so four buttons and their gaps
 *              fit between the rails instead of overhanging them.
 *
 * jsdom has no layout engine and no CSS, so what can be proved here is the
 * arithmetic the component contributes — the inline custom property and the
 * inline `bottom` — and NOT the clamp that consumes them. The floor that keeps
 * a touch target hittable lives in the stylesheet (`--skill-floor`, raised under
 * `@media (pointer: coarse)`) and is the one part of this that has to be checked
 * with a finger.
 */

vi.mock('@/use/useSound', () => ({ default: () => ({ playSound: vi.fn() }) }))

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })

/** The stylesheet's gap ceiling, mirrored from `ROW_GAP_MAX_PX` in the bar. */
const GAP = 9
/** What the bar should publish as the widest a button may be, for a given lane. */
const fitFor = (laneHalfPx: number): number =>
  Math.round((laneHalfPx * 2 - (SKILL_SLOTS.length - 1) * GAP) / SKILL_SLOTS.length)

const PROPS = { shieldLive: false, laneHalfPx: 180, squadFloorPx: 500, hudBottomPx: 100 }

let wrapper: VueWrapper | null = null
const mountBar = async (props: Record<string, unknown> = {}): Promise<VueWrapper> => {
  const SkillBar = (await import('@/components/game/SkillBar.vue')).default
  wrapper = mount(SkillBar, {
    props: { ...PROPS, ...props }, global: { plugins: [i18n] }, attachTo: document.body
  })
  await nextTick()
  return wrapper
}

beforeEach(async () => {
  localStorage.clear()
  const { __resetTowerState } = await import('@/use/useTowerState')
  __resetTowerState()
  const { __setUpgradeLevel } = await import('@/use/useUpgrades')
  __setUpgradeLevel('shield', 0)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.restoreAllMocks()
})

describe('the row is sized to the road', () => {
  it('publishes the widest button that lets the whole row fit between the rails', async () => {
    const w = await mountBar()
    // 360 px of road, three gaps of 9, four slots → 83 px a button.
    expect(w.attributes('style')).toContain(`--skill-fit: ${fitFor(180)}px`)
    expect(fitFor(180) * SKILL_SLOTS.length + (SKILL_SLOTS.length - 1) * GAP)
      .toBeLessThanOrEqual(360)
  })

  it('shrinks with the lane on a viewport that zooms the camera out', async () => {
    // A landscape phone: the camera fits the usable HEIGHT rather than the lane's
    // width, so the road on screen is a fraction of the window. The cap the bar
    // asks for gets small enough that the stylesheet's touch floor takes over —
    // which is deliberate, and is why this asserts the ASK and not the outcome.
    const w = await mountBar({ laneHalfPx: 57 })
    expect(w.attributes('style')).toContain(`--skill-fit: ${fitFor(57)}px`)
    expect(fitFor(57)).toBeLessThan(fitFor(180))
  })

  it('sizes off the slot count, so buying a skill never resizes the row', async () => {
    const w = await mountBar()
    const before = w.attributes('style')
    const { __setUpgradeLevel } = await import('@/use/useUpgrades')
    __setUpgradeLevel('shield', 1)
    await nextTick()
    expect(w.findAll('.skills__btn:not(.skills__btn--locked)').length, 'the shield did not arrive').toBe(2)
    // A slot filling mid-run must not move the three buttons beside it — the
    // player's thumb is already on its way to one of them.
    expect(w.attributes('style')).toBe(before)
  })
})

describe('what the bar does before the scene has measured anything', () => {
  it('leaves the stylesheet alone rather than parking on an unmeasured strip', async () => {
    // `hudBottomPx` is 0 until the scene measures the bottom bar. Parking on it
    // then would put the row ten pixels off the bottom of the screen — on top of
    // mute and settings, which are buttons.
    const w = await mountBar({ hudBottomPx: 0 })
    expect(w.attributes('style') ?? '').not.toContain('bottom')
  })

  it('asks for no width cap until it knows how wide the road is', async () => {
    const w = await mountBar({ laneHalfPx: 0 })
    expect(w.attributes('style') ?? '').not.toContain('--skill-fit')
  })

  it('parks on the strip the moment there is one, gap included', async () => {
    const w = await mountBar()
    // 100 px of HUD strip plus the 10 px gap the placement module owns.
    expect(w.attributes('style')).toContain('bottom: 110px')
  })
})
