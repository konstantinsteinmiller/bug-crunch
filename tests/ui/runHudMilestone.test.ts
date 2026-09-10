import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import en from '@/i18n/locales/en'

/**
 * ─── The squad chip, punched ────────────────────────────────────────────────
 *
 * The ladder itself is proved in `tests/ui/squadMilestones.test.ts`. What is
 * proved here is the WIRING, which is the half that goes wrong quietly: a HUD
 * that announces on the way down, a HUD that re-announces because it reset its
 * state on the wrong signal, and a punch that never restarts because a CSS
 * animation was expected to re-trigger itself.
 *
 * The reset is the interesting part, and it takes TWO signals because a run can
 * begin in two shapes: a retry repeats the stage number (caught by the phase
 * edge out of `'wipe'` / `'clear'`), and a stage jump that never passes through
 * a result screen repeats no phase edge (caught by the stage number). A boss
 * phase is neither — it is the middle of a run — and the specs below say so,
 * because "re-arm on any return to `'run'`" is the version that looks correct
 * and replays the ladder the first time a boss fight is survivable.
 */

const playFx = vi.fn()
vi.mock('@/use/useGameAudio', () => ({ playFx: (...args: unknown[]) => playFx(...args) }))

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })

const BASE_PROPS = {
  stage: 3, best: 5, progress: 0.2, squad: 10, damage: 2, fireRate: 1.5,
  phase: 'run' as const, bossHp: 0, elite: false, eliteHp: 0, challenge: 0
}

const mountHud = async () => {
  const RunHud = (await import('@/components/game/RunHud.vue')).default
  return mount(RunHud, { props: { ...BASE_PROPS }, global: { plugins: [i18n] } })
}

beforeEach(() => { playFx.mockClear() })

describe('the HUD announces a round number once', () => {
  it('punches the chip, names the number and plays the fanfare on the way up', async () => {
    const hud = await mountHud()
    const chip = () => hud.find('.run-hud__chip.is-squad')

    expect(chip().classes()).not.toContain('is-punched')
    expect(hud.find('.run-hud__milestone').exists()).toBe(false)

    await hud.setProps({ squad: 26 })
    expect(chip().classes()).toContain('is-punched')
    expect(hud.find('.run-hud__milestone').text()).toBe('25 strong!')
    // Rung 0 — the fanfare climbs the same pentatonic ladder the pump does.
    expect(playFx).toHaveBeenCalledWith('squadMilestone', 0)
  })

  it('re-keys the chip on every announcement so the CSS animation restarts', async () => {
    const hud = await mountHud()
    const key = () => (hud.find('.run-hud__chip.is-squad').element as HTMLElement)

    await hud.setProps({ squad: 30 })
    const first = key()
    await hud.setProps({ squad: 60 })
    // A fresh DOM node, which is the whole mechanism: writing a CSS custom
    // property on the SAME node would not restart a finished animation.
    expect(key()).not.toBe(first)
  })

  it('says nothing while the squad oscillates on a rung it already crossed', async () => {
    const hud = await mountHud()
    await hud.setProps({ squad: 105 })
    expect(playFx).toHaveBeenCalledTimes(1)

    for (const squad of [96, 100, 88, 101, 99]) await hud.setProps({ squad })
    expect(playFx).toHaveBeenCalledTimes(1)
  })

  it('does not replay the ladder when a rally hands a wiped crowd back', async () => {
    const hud = await mountHud()
    await hud.setProps({ squad: 140 })
    playFx.mockClear()

    // Wiped to three, rallied, and back up past where it was.
    for (const squad of [3, 12, 40, 90, 160]) await hud.setProps({ squad })
    expect(playFx).not.toHaveBeenCalled()

    // …and the NEXT rung still works.
    await hud.setProps({ squad: 220 })
    expect(playFx).toHaveBeenCalledWith('squadMilestone', 3)
  })

  it('announces one rung for a door that crossed five', async () => {
    const hud = await mountHud()
    await hud.setProps({ squad: 300 })
    playFx.mockClear()
    await hud.setProps({ squad: 900 })
    expect(playFx).toHaveBeenCalledTimes(1)
    expect(playFx).toHaveBeenCalledWith('squadMilestone', 5)
    expect(hud.find('.run-hud__milestone').text()).toBe('800 strong!')
  })
})

describe('a new run arms the ladder again', () => {
  it('re-arms on a RETRY, which repeats the stage number', async () => {
    const hud = await mountHud()
    // One announcement, not three: 10 → 120 crosses 25, 50 and 100 in a single
    // prop update, and the player did one thing.
    await hud.setProps({ squad: 120 })
    expect(playFx).toHaveBeenCalledTimes(1)
    playFx.mockClear()

    // wipe → `retryStage` → `startStage` sets phase back to 'run' on the SAME
    // stage. Squad goes to 0 and the road starts again.
    await hud.setProps({ phase: 'wipe' })
    await hud.setProps({ phase: 'run', squad: 0 })
    await hud.setProps({ squad: 30 })
    expect(playFx).toHaveBeenCalledWith('squadMilestone', 0)
  })

  it('re-arms on the next stage', async () => {
    const hud = await mountHud()
    await hud.setProps({ squad: 60 })
    playFx.mockClear()

    await hud.setProps({ phase: 'clear' })
    await hud.setProps({ phase: 'run', stage: 4, squad: 0 })
    await hud.setProps({ squad: 26 })
    await hud.setProps({ squad: 55 })
    // Rung 0 then rung 1 — the whole early ladder is live again.
    expect(playFx.mock.calls.map((c) => c[1])).toEqual([0, 1])
  })

  it('does NOT re-arm on a boss phase, which is the middle of a run', async () => {
    const hud = await mountHud()
    await hud.setProps({ squad: 60 })
    playFx.mockClear()

    await hud.setProps({ phase: 'boss' })
    await hud.setProps({ phase: 'run' })
    await hud.setProps({ squad: 55 })
    expect(playFx).not.toHaveBeenCalled()
    // …and 50 is still spent, so only the NEXT rung can speak.
    await hud.setProps({ squad: 101 })
    expect(playFx.mock.calls.map((c) => c[1])).toEqual([2])
  })

  it('clears the word when the run ends, so a result screen has nothing behind it', async () => {
    const hud = await mountHud()
    await hud.setProps({ squad: 26 })
    expect(hud.find('.run-hud__milestone').exists()).toBe(true)
    await hud.setProps({ phase: 'wipe' })
    await hud.setProps({ phase: 'run', squad: 0 })
    expect(hud.find('.run-hud__milestone').exists()).toBe(false)
  })
})
