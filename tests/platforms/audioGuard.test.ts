// The ad-audio guarantee, at the layer that owns it: `audioGuard`.
//
// Poki's QA probe wraps `window.AudioContext` and `HTMLMediaElement.prototype
// .play` and, during a break, counts every context still `running` and every
// element still audible. It measures the PAGE, so the guarantee has to hold for
// every source on it — not only the ones our code registered by hand:
//
//   • a context or element created by ANY module, before the ad or DURING it;
//   • a resume from a gesture / visibility handler that lands mid-ad;
//   • a resume already in flight when the ad begins (`state` still reads
//     `suspended` then — the old code trusted it and skipped the suspend);
//   • and on the way out: back exactly once, and never over a player's mute.
//
// The fake context changes `state` asynchronously, the way a real one does.
// That asynchrony is the whole of the in-flight race, so a fake that flipped
// state synchronously would make that test pass against the old code too.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type State = 'suspended' | 'running' | 'closed'

class FakeAudioContext extends EventTarget {
  static initialState: State = 'running'
  static created: FakeAudioContext[] = []
  state: State
  nativeResumes = 0
  nativeSuspends = 0
  constructor () {
    super()
    this.state = FakeAudioContext.initialState
    FakeAudioContext.created.push(this)
  }

  // On the PROTOTYPE, like the real API — that is what the guard hooks.
  resume (): Promise<void> {
    this.nativeResumes++
    return Promise.resolve().then(() => this.set('running'))
  }

  suspend (): Promise<void> {
    this.nativeSuspends++
    return Promise.resolve().then(() => this.set('suspended'))
  }

  set (s: State): void {
    if (this.state === 'closed' || this.state === s) return
    this.state = s
    this.dispatchEvent(new Event('statechange'))
  }
}

// ── A media layer jsdom does not have: play/pause that actually change state ──
const playing = new WeakSet<HTMLMediaElement>()
const basePlay = vi.fn(function (this: HTMLMediaElement) { playing.add(this); return Promise.resolve() })
const basePause = vi.fn(function (this: HTMLMediaElement) { playing.delete(this) })
let savedPlay: PropertyDescriptor | undefined
let savedPause: PropertyDescriptor | undefined
let savedPaused: PropertyDescriptor | undefined

const flush = async (): Promise<void> => {
  for (let i = 0; i < 6; i++) await Promise.resolve()
}

type Guard = typeof import('@/use/audioGuard')
let guard: Guard

beforeEach(async () => {
  vi.resetModules()
  FakeAudioContext.initialState = 'running'
  FakeAudioContext.created = []
  ;(window as unknown as { AudioContext: unknown }).AudioContext = FakeAudioContext

  const proto = HTMLMediaElement.prototype
  savedPlay = Object.getOwnPropertyDescriptor(proto, 'play')
  savedPause = Object.getOwnPropertyDescriptor(proto, 'pause')
  savedPaused = Object.getOwnPropertyDescriptor(proto, 'paused')
  basePlay.mockClear()
  basePause.mockClear()
  Object.defineProperty(proto, 'play', { configurable: true, writable: true, value: basePlay })
  Object.defineProperty(proto, 'pause', { configurable: true, writable: true, value: basePause })
  Object.defineProperty(proto, 'paused', { configurable: true, get (this: HTMLMediaElement) { return !playing.has(this) } })

  guard = await import('@/use/audioGuard')
  guard.installAudioGuard()
})

afterEach(() => {
  guard.uninstallAudioGuard()
  delete (window as unknown as { AudioContext?: unknown }).AudioContext
  const proto = HTMLMediaElement.prototype
  if (savedPlay) Object.defineProperty(proto, 'play', savedPlay)
  if (savedPause) Object.defineProperty(proto, 'pause', savedPause)
  if (savedPaused) Object.defineProperty(proto, 'paused', savedPaused)
})

/** A context made the way any module would make one. */
const newContext = (): FakeAudioContext =>
  new (window as unknown as { AudioContext: new () => FakeAudioContext }).AudioContext()

describe('audioGuard — every context on the page, not just the shared one', () => {
  it('suspends a context some OTHER module created, and brings it back once', async () => {
    const shared = newContext()
    const musicRenderersOwn = newContext()

    const release = guard.holdSilence()
    await flush()
    expect(shared.state).toBe('suspended')
    expect(musicRenderersOwn.state).toBe('suspended')

    release()
    await flush()
    expect(shared.state).toBe('running')
    expect(musicRenderersOwn.state).toBe('running')
    expect(shared.nativeResumes).toBe(1)
    expect(musicRenderersOwn.nativeResumes).toBe(1)
  })

  it('a context created WHILE silenced is born suspended, and runs once the hold lets go', async () => {
    const release = guard.holdSilence()
    const bornMidAd = newContext() // a page with activation starts contexts running
    await flush()
    expect(bornMidAd.state).toBe('suspended')

    release()
    await flush()
    expect(bornMidAd.state).toBe('running')
  })

  it('a resume() from a gesture / visibility handler mid-ad is deferred, not obeyed', async () => {
    const ctx = newContext()
    const release = guard.holdSilence()
    await flush()

    let resolved = false
    void (ctx as unknown as AudioContext).resume().then(() => { resolved = true })
    await flush()
    expect(ctx.state).toBe('suspended')
    expect(resolved).toBe(false)

    release()
    await flush()
    expect(ctx.state).toBe('running')
    expect(resolved).toBe(true)
  })

  it('a resume already IN FLIGHT when the ad begins cannot leave the context running', async () => {
    // `state` still reads "suspended" while a resume is on its way — the old
    // layer checked it, skipped the suspend, and the resume then landed.
    FakeAudioContext.initialState = 'suspended'
    const ctx = newContext()
    void (ctx as unknown as AudioContext).resume()
    expect(ctx.state).toBe('suspended')

    const release = guard.holdSilence()
    await flush()
    expect(ctx.state).toBe('suspended')

    release()
    await flush()
    expect(ctx.state).toBe('running')
  })

  it('backstop: a context woken by a route the hook cannot see goes straight back to sleep', async () => {
    const ctx = newContext()
    guard.suspendAllAudio()
    await flush()
    // e.g. iOS resuming a context by itself after an audio interruption
    ctx.set('running')
    await flush()
    expect(ctx.state).toBe('suspended')
    guard.resumeAllAudio()
    await flush()
    expect(ctx.state).toBe('running')
  })

  it('an owner suspend() during the hold wins over the restore', async () => {
    const ctx = newContext()
    const release = guard.holdSilence()
    await flush()
    void (ctx as unknown as AudioContext).suspend() // its owner is done with it
    release()
    await flush()
    expect(ctx.state).toBe('suspended')
  })

  it('does not resume a context nobody had unlocked yet — that stays the gesture handler\'s job', async () => {
    FakeAudioContext.initialState = 'suspended' // autoplay policy, no gesture yet
    const ctx = newContext()
    const release = guard.holdSilence()
    release()
    await flush()
    expect(ctx.nativeResumes).toBe(0)
    expect(ctx.state).toBe('suspended')
  })
})

describe('audioGuard — every <audio> element, including ones made mid-ad', () => {
  it('an element created and played DURING the hold does not sound, then starts when released', async () => {
    const release = guard.holdSilence()
    const sfx = new Audio('audio/sfx/new-cue.ogg') // a cue another agent just added
    let started = false
    void sfx.play().then(() => { started = true })
    await flush()
    expect(basePlay).not.toHaveBeenCalled()
    expect(sfx.paused).toBe(true)
    expect(started).toBe(false)

    release()
    await flush()
    expect(basePlay).toHaveBeenCalledTimes(1)
    expect(sfx.paused).toBe(false)
    expect(started).toBe(true)
  })

  it('pauses a playing element (registered or not) and restores it exactly once', async () => {
    const music = new Audio('audio/music/any.ogg')
    music.loop = true
    await music.play() // never registered by hand — the play hook tracks it
    expect(basePlay).toHaveBeenCalledTimes(1)

    const release = guard.holdSilence()
    expect(music.paused).toBe(true)
    release()
    release() // a double release must not play it twice
    await flush()
    expect(music.paused).toBe(false)
    expect(basePlay).toHaveBeenCalledTimes(2)
  })

  it('an owner pause() during the hold wins: the track is not brought back', async () => {
    const music = new Audio('audio/music/any.ogg')
    music.loop = true
    await music.play()
    const release = guard.holdSilence()
    music.pause() // forceStopMusic cleared the intent while the ad was up
    release()
    await flush()
    expect(music.paused).toBe(true)
    expect(basePlay).toHaveBeenCalledTimes(1)
  })

  it('a pause() cancels a play() that the hold had deferred, and rejects its promise', async () => {
    const release = guard.holdSilence()
    const el = new Audio('a.ogg')
    const p = el.play()
    el.pause()
    await expect(p).rejects.toMatchObject({ name: 'AbortError' })
    release()
    await flush()
    expect(basePlay).not.toHaveBeenCalled()
  })

  it('a one-shot that finished is forgotten — the release never replays it', async () => {
    const sfx = new Audio('a.ogg')
    await sfx.play()
    playing.delete(sfx)
    sfx.dispatchEvent(new Event('ended'))
    const release = guard.holdSilence()
    release()
    await flush()
    expect(basePlay).toHaveBeenCalledTimes(1)
  })
})

describe('audioGuard — restore respects the player, and never resumes twice', () => {
  it('an ad ending under a player/portal mute leaves everything silent until the mute lifts', async () => {
    const ctx = newContext()
    const music = new Audio('m.ogg')
    music.loop = true
    await music.play()

    guard.suspendAllAudio() // the player's mute (mobile hard-mute / portal soundOff)
    const releaseAd = guard.holdSilence() // then an ad
    releaseAd()
    await flush()
    expect(ctx.state).toBe('suspended')
    expect(music.paused).toBe(true)
    expect(guard.isAudioSuspended()).toBe(true)

    guard.resumeAllAudio() // the player unmutes
    await flush()
    expect(ctx.state).toBe('running')
    expect(music.paused).toBe(false)
  })

  it('overlapping holds resume each source ONCE, and an unbalanced resume is a no-op', async () => {
    const ctx = newContext()
    const el = new Audio('m.ogg')
    el.loop = true
    await el.play()

    const a = guard.holdSilence() // tab hidden
    const b = guard.holdSilence() // ad
    a()
    await flush()
    expect(ctx.state).toBe('suspended')
    b()
    await flush()
    guard.resumeAllAudio() // stray extra release from someone else
    guard.resumeAllAudio()
    await flush()
    expect(ctx.nativeResumes).toBe(1)
    expect(basePlay).toHaveBeenCalledTimes(2) // the original play + ONE restore
  })

  it('never touches volume: what the player set is what comes back', async () => {
    const el = new Audio('m.ogg')
    el.volume = 0.07
    el.loop = true
    await el.play()
    const release = guard.holdSilence()
    release()
    await flush()
    expect(el.volume).toBeCloseTo(0.07)
  })
})

describe('killOneShotSfx — voices are stopped, not frozen', () => {
  it('stops every registered voice, oscillators included', async () => {
    const osc = { stop: vi.fn(), addEventListener: vi.fn() }
    const buf = { stop: vi.fn(), addEventListener: vi.fn() }
    guard.registerOneShotSource(osc as unknown as AudioScheduledSourceNode)
    guard.registerOneShotSource(buf as unknown as AudioScheduledSourceNode)
    guard.killOneShotSfx()
    expect(osc.stop).toHaveBeenCalledTimes(1)
    expect(buf.stop).toHaveBeenCalledTimes(1)
  })
})
