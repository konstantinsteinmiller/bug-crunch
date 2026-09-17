// The shared AudioContext has to unlock on a TOUCH, not only on a mouse click.
//
// Browsers grant user activation on `pointerdown` only for a mouse; a finger
// earns it on `pointerup` / `touchend`. The unlock used to be a single `once`
// listener on `pointerdown`, so on a phone the first tap's `resume()` was
// refused, the listener was spent, and every Web Audio cue stayed silent.
//
// The fake context below models exactly that rule: `resume()` only succeeds
// while the page holds activation, which the test grants on the events a real
// touch grants it on.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let activated = false
let contexts: FakeContext[] = []

class FakeContext {
  state: 'suspended' | 'running' | 'closed' = 'suspended'
  resume = vi.fn(() => {
    if (activated) this.state = 'running'
    return activated ? Promise.resolve() : Promise.reject(new Error('not allowed'))
  })
  suspend = vi.fn(() => { this.state = 'suspended'; return Promise.resolve() })
  constructor () { contexts.push(this) }
}

const flush = () => new Promise((r) => setTimeout(r, 0))

const touch = async (type: 'pointerdown' | 'pointerup' | 'touchend'): Promise<void> => {
  // A finger: no activation on pointerdown, activation on pointerup/touchend.
  activated = type !== 'pointerdown'
  const ev = type === 'touchend'
    ? new Event('touchend', { bubbles: true })
    : Object.assign(new Event(type, { bubbles: true }), { pointerType: 'touch' })
  window.dispatchEvent(ev)
  await flush()
}

beforeEach(() => {
  vi.resetModules()
  activated = false
  contexts = []
  ;(window as unknown as { AudioContext: unknown }).AudioContext = FakeContext
})

afterEach(() => {
  delete (window as unknown as { AudioContext?: unknown }).AudioContext
})

describe('audio unlock on a gesture', () => {
  it('survives a refused pointerdown and unlocks on the touch that carries activation', async () => {
    const { getAudioContext } = await import('@/use/useAssets')
    const ctx = getAudioContext() as unknown as FakeContext
    expect(ctx.state).toBe('suspended')

    await touch('pointerdown')
    expect(ctx.state).toBe('suspended')

    await touch('pointerup')
    expect(ctx.state).toBe('running')
  })

  it('also unlocks from touchend alone', async () => {
    const { getAudioContext } = await import('@/use/useAssets')
    const ctx = getAudioContext() as unknown as FakeContext
    await touch('touchend')
    expect(ctx.state).toBe('running')
  })

  it('stops listening once the context is running', async () => {
    const { getAudioContext } = await import('@/use/useAssets')
    const ctx = getAudioContext() as unknown as FakeContext
    await touch('pointerup')
    expect(ctx.state).toBe('running')
    const calls = ctx.resume.mock.calls.length

    // A later ad suspends it; that path belongs to resumeAllAudio, and a stray
    // tap during the ad must not resume underneath it.
    ctx.state = 'suspended'
    await touch('pointerup')
    expect(ctx.resume.mock.calls.length).toBe(calls)
  })

  it('never resumes while something holds the global mute', async () => {
    const { getAudioContext, suspendAllAudio, resumeAllAudio } = await import('@/use/useAssets')
    const ctx = getAudioContext() as unknown as FakeContext
    suspendAllAudio()
    await touch('pointerup')
    expect(ctx.state).toBe('suspended')
    resumeAllAudio()
    await flush()
    await touch('pointerup')
    expect(ctx.state).toBe('running')
  })
})
