// ─── The funnel the portal bracket cannot see ───────────────────────────────
//
// `useGameplayLifecycle` tells the portals how long and how often somebody
// played; these six events are the only thing in the build that can say WHERE
// they stopped. The contracts worth pinning are the ones a silent regression
// would eat: an event that throws would end a run from inside `finishRun`, a
// wipe billed to the wrong system would send a tuning pass at the wrong file,
// and a props bag with a seventeen-digit float in it is refused by half the
// portal SDKs that take one.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  RING, analyticsLog, dominantCause, normaliseProps, track, __resetAnalytics
} from '@/use/useAnalytics'

beforeEach(() => {
  __resetAnalytics()
  delete (window as any).PokiSDK
  delete (window as any).GamePix
  delete (window as any).gtag
  delete (window as any).dataLayer
})

describe('the props bag', () => {
  it('drops undefined rather than sending a key with no value', () => {
    // The call site writes `cause: dominantCause(deaths)`, which is undefined on
    // a run where nobody died. A key with no value is worse than no key: it
    // reads downstream as a cause that exists and is unknown.
    expect(normaliseProps({ stage: 4, cause: undefined })).toEqual({ stage: 4 })
  })

  it('rounds floats to three places and keeps integers exact', () => {
    // `progress01` is the float that actually travels, and it arrives as
    // whatever the sim's accumulator made of it.
    const out = normaliseProps({ progress01: 0.8123456789, stage: 9 })
    expect(out.progress01).toBe(0.812)
    expect(out.stage).toBe(9)
  })

  it('drops NaN and Infinity instead of sending them', () => {
    expect(normaliseProps({ a: Number.NaN, b: Number.POSITIVE_INFINITY, c: 1 })).toEqual({ c: 1 })
  })

  it('keeps booleans, and caps a string', () => {
    const out = normaliseProps({ ok: false, id: 'x'.repeat(200) })
    expect(out.ok).toBe(false)
    expect(String(out.id)).toHaveLength(64)
  })
})

describe('which system took the run', () => {
  it('bills the loss to the cause that took the MOST bodies, not the last one', () => {
    // The whole point of the field. A crowd chewed down to four by barricades
    // and finished by a boss slam is a barricade problem; billing it to the
    // slam sends the next tuning pass at the wrong system.
    expect(dominantCause({ foe: 3, barricade: 40, slam: 1 })).toBe('barricade')
  })

  it('says nothing at all when nobody died', () => {
    // A run that ended with the squad intact did not end this way, and a
    // defaulted "foe" would be a fabricated data point.
    expect(dominantCause({ foe: 0, barricade: 0 })).toBeUndefined()
  })
})

describe('recording an event', () => {
  it('keeps the session readable in order, newest last', () => {
    track('stage_start', { stage: 1 })
    track('wipe', { stage: 1, cause: 'foe' })
    const log = analyticsLog()
    expect(log.map((r) => r.event)).toEqual(['stage_start', 'wipe'])
    expect(log[1]!.props).toMatchObject({ stage: 1, cause: 'foe' })
  })

  it('never grows past the ring, so a long career cannot eat memory', () => {
    for (let i = 0; i < RING + 40; i++) track('gate_pass', { stage: i })
    expect(analyticsLog()).toHaveLength(RING)
    // The OLDEST are the ones dropped: a session's tail is what gets read.
    expect(analyticsLog()[RING - 1]!.props.stage).toBe(RING + 39)
  })

  it('no-ops silently when the host page offers no event sink', () => {
    // Most portals we ship to have none, and that is a correct outcome rather
    // than a failure worth logging.
    expect(() => track('shop_open', { coins: 12 })).not.toThrow()
    expect(analyticsLog()).toHaveLength(1)
  })
})

describe('the portal sink', () => {
  it('forwards to Poki\'s custom event when the SDK is the one on the page', () => {
    const customEvent = vi.fn()
    ;(window as any).PokiSDK = { customEvent }
    track('stage_end', { stage: 3 })
    expect(customEvent).toHaveBeenCalledTimes(1)
    expect(customEvent.mock.calls[0]![1]).toBe('stage_end')
    expect(customEvent.mock.calls[0]![2]).toMatchObject({ stage: 3 })
  })

  it('falls through to a host page\'s own analytics when no portal SDK has one', () => {
    const gtag = vi.fn()
    ;(window as any).gtag = gtag
    track('upgrade_buy', { id: 'squad', level: 3 })
    expect(gtag).toHaveBeenCalledWith('event', 'upgrade_buy', { id: 'squad', level: 3 })
  })

  it('survives a sink that throws, and stops calling it', () => {
    // This sits on the stage boundary and on the gate branch. An analytics call
    // that can throw is an analytics call that can end a run — and one that
    // throws every gate would also flood the console for the whole session.
    const customEvent = vi.fn(() => { throw new Error('sdk is angry') })
    ;(window as any).PokiSDK = { customEvent }
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(() => track('gate_pass', { stage: 2 })).not.toThrow()
    track('gate_pass', { stage: 2 })
    track('gate_pass', { stage: 2 })

    expect(customEvent).toHaveBeenCalledTimes(1)
    // …and every event is still recorded locally, which is the sink that matters.
    expect(analyticsLog()).toHaveLength(3)
    warn.mockRestore()
  })
})
