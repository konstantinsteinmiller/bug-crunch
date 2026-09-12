import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import en from '@/i18n/locales/en'

/**
 * ─── Two guns on one badge ──────────────────────────────────────────────────
 *
 * Stage 2 can fire the gatling from its gift box and the first boss's launcher
 * at once (`sideWeapon`). The badge has to say both, each with its own real
 * multiplier — a half-power launcher advertised at the full launcher's ×3.3
 * would be the HUD lying — and before the box breaks it promises the gift as an
 * addition, not a swap.
 */

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })
const STUBS = { GameIcon: { props: ['name'], template: '<i :data-icon="name"/>' } }

const mountTag = async (props: Record<string, unknown>) => {
  const WeaponTag = (await import('@/components/game/WeaponTag.vue')).default
  return mount(WeaponTag, {
    props: { puzzle: null, pulled: 0, total: 0, gift: false, active: null, ...props },
    global: { plugins: [i18n], stubs: STUBS }
  })
}

describe('the weapon tag with two guns', () => {
  it('shows the main gun and the side gun, each at its own power', async () => {
    const w = await mountTag({ active: 'gatling', side: 'rocket', sidePower: 0.5 })
    expect(w.text()).toContain('Gatling Gun')
    expect(w.text()).toContain('×4.4')
    // Half of the launcher's 3.3.
    expect(w.text()).toContain('×1.7')
    expect(w.findAll('[data-icon]').map((i) => i.attributes('data-icon'))).toEqual(['gatling', 'rocket'])
    expect(w.find('[role="status"]').attributes('aria-label')).toBe('Gatling Gun + Rocket Launcher ready')
  })

  it('promises the gift box ahead as an addition while the launcher is held', async () => {
    const w = await mountTag({ active: 'rocket', power: 0.5, puzzle: 'gatling', gift: true })
    expect(w.text()).toContain('×1.7')
    expect(w.text()).toContain('FREE')
    expect(w.findAll('[data-icon]').map((i) => i.attributes('data-icon'))).toEqual(['rocket', 'gatling'])
  })

  it('is the one-gun badge it always was without a second weapon', async () => {
    const w = await mountTag({ active: 'gatling' })
    expect(w.find('.wtag__plus').exists()).toBe(false)
    expect(w.find('[role="status"]').attributes('aria-label')).toBe('Gatling Gun ready')
  })
})
