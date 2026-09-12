import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import en from '@/i18n/locales/en'

/**
 * ─── The first boss's gift, on the clock ────────────────────────────────────
 *
 * The reveal exists to be SHORT: a quarter of the playtesters quit at the first
 * kill, and a screen that waits for a tap is one more place to stop. So the
 * promise pinned here is the timing — it closes itself on the three-second mark,
 * a tap only makes that sooner, a stray tap from the fight does not count, and
 * a paused game does not spend the clock.
 */

vi.mock('@/use/useSound', () => ({ default: () => ({ playSound: vi.fn() }) }))

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })

// The reveal's frame and the art are someone else's specs; stubbed so this one
// is about the clock and nothing else.
const STUBS = {
  FReward: { props: ['modelValue'], template: '<div v-if="modelValue"><slot name="ribbon"/><slot/></div>' },
  ArtIcon: { template: '<i/>' },
  GameIcon: { template: '<i/>' }
}

const mountReveal = async () => {
  const BossReward = (await import('@/components/organisms/BossReward.vue')).default
  return mount(BossReward, {
    props: { open: true, stage: 2 },
    global: { plugins: [i18n], stubs: STUBS },
    attachTo: document.body
  })
}

/** A press anywhere, then the render it causes. */
const tap = async (): Promise<void> => {
  window.dispatchEvent(new Event('pointerdown'))
  await nextTick()
}

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance']
  })
})

afterEach(async () => {
  const { isAdShowing } = await import('@/use/useGamePause')
  isAdShowing.value = false
  vi.useRealTimers()
})

describe('the first boss\'s gift', () => {
  it('names the fight and the stage the launcher is for', async () => {
    const w = await mountReveal()
    expect(w.text()).toContain('Boss defeated!')
    expect(w.text()).toContain('A gift for Stage 2')
    expect(w.text()).toContain('Rocket Launcher')
    w.unmount()
  })

  it('closes itself on the three-second mark, untouched', async () => {
    const w = await mountReveal()
    await vi.advanceTimersByTimeAsync(2900)
    expect(w.emitted('done')).toBeUndefined()
    await vi.advanceTimersByTimeAsync(200)
    expect(w.emitted('done')).toHaveLength(1)
    w.unmount()
  })

  it('lets a tap close it sooner — anywhere, the card or the backdrop', async () => {
    const w = await mountReveal()
    await vi.advanceTimersByTimeAsync(800)
    await tap()
    expect(w.find('.gift__card').classes()).toContain('is-chosen')
    // The card flares first, so the player sees the answer land.
    await vi.advanceTimersByTimeAsync(300)
    expect(w.emitted('done')).toBeUndefined()
    await vi.advanceTimersByTimeAsync(400)
    expect(w.emitted('done')).toHaveLength(1)
    // …and only once, whatever else gets pressed on the way out.
    await tap()
    await vi.advanceTimersByTimeAsync(3000)
    expect(w.emitted('done')).toHaveLength(1)
    w.unmount()
  })

  it('does not count a tap that arrives with the screen — that one was the fight\'s', async () => {
    const w = await mountReveal()
    await vi.advanceTimersByTimeAsync(100)
    await tap()
    expect(w.find('.gift__card').classes()).not.toContain('is-chosen')
    await vi.advanceTimersByTimeAsync(1500)
    expect(w.emitted('done')).toBeUndefined()
    w.unmount()
  })

  it('holds the clock while the game is paused', async () => {
    const { isAdShowing } = await import('@/use/useGamePause')
    const w = await mountReveal()
    await vi.advanceTimersByTimeAsync(1000)
    isAdShowing.value = true
    await vi.advanceTimersByTimeAsync(10_000)
    expect(w.emitted('done')).toBeUndefined()
    isAdShowing.value = false
    // Two seconds of the three were still owed when the pause began.
    await vi.advanceTimersByTimeAsync(1800)
    expect(w.emitted('done')).toBeUndefined()
    await vi.advanceTimersByTimeAsync(400)
    expect(w.emitted('done')).toHaveLength(1)
    w.unmount()
  })
})
