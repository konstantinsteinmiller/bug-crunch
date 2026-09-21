// The music player, driven for real: which file the ONE music element plays in
// each scene, what the fever stinger does to it, when the result sting sounds —
// and that both cues are under the ad kill.
//
// `tests/game/musicRouting.test.ts` holds the RULES (pure). This holds the
// player to them: a rule the element never follows is not a rule. It also pins
// the half of the design that is about the ad-mute guarantee rather than taste:
// the stinger and the sting are one-shot sources on the shared AudioContext,
// registered with `registerOneShotSource`, so `killOneShotSfx` — what every ad
// path calls before it opens — stops them. No second element, no second context.
//
// The element is jsdom's, with `play`/`pause`/`paused` modelled the way a
// browser behaves (jsdom plays nothing), and every bed is seeded into the
// decoded cache so a start is synchronous — the same trick, and the same
// reason, as `portalMuteMusicGate.test.ts`.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { mount } from '@vue/test-utils'

import {
  useMusic, setMusicScene, playFeverStinger, endFeverStinger, playResultSting, cancelResultSting
} from '@/use/useSound'
import { resourceCache, killOneShotSfx } from '@/use/useAssets'
import { setPlatformAudioMuted } from '@/use/useGamePauseAudio'
import useUser from '@/use/useUser'
import { prependBaseUrl } from '@/utils/function'
import {
  BED_FILES, FEVER_BED_RETURN_MS, FEVER_STINGER_FILE, NO_SCENE, RESULT_STING_FILE
} from '@/game/musicRouting'

// ─── A shared AudioContext that records what is played on it ────────────────

class FakeParam {
  value = 1
  cancelScheduledValues = vi.fn()
  setValueAtTime = vi.fn()
  linearRampToValueAtTime = vi.fn((v: number) => { this.value = v })
}

class FakeGain {
  gain = new FakeParam()
  constructor (public context: FakeContext) {}
  connect = vi.fn((n: unknown) => n)
  disconnect = vi.fn()
}

class FakeSource extends EventTarget {
  buffer: unknown = null
  started = false
  stopped = false
  constructor (public context: FakeContext) { super() }
  connect = vi.fn((n: unknown) => n)
  disconnect = vi.fn()
  start = vi.fn(() => { this.started = true })
  // A browser fires `ended` asynchronously after a stop.
  stop = vi.fn(() => {
    if (this.stopped) return
    this.stopped = true
    queueMicrotask(() => this.dispatchEvent(new Event('ended')))
  })
}

class FakeContext {
  state: 'running' | 'suspended' | 'closed' = 'running'
  currentTime = 0
  destination = {}
  sources: FakeSource[] = []
  createGain = (): FakeGain => new FakeGain(this)
  createBufferSource = (): FakeSource => {
    const s = new FakeSource(this)
    this.sources.push(s)
    return s
  }
  suspend = vi.fn(() => { this.state = 'suspended'; return Promise.resolve() })
  resume = vi.fn(() => { this.state = 'running'; return Promise.resolve() })
  decodeAudioData = vi.fn()
}

// `getAudioContext` builds the shared context once per module graph and keeps
// it, so there is ONE fake for the whole file, reset between tests.
const ctx = new FakeContext()
;(window as unknown as { AudioContext: unknown }).AudioContext = function AudioContext () {
  return ctx
} as unknown as typeof AudioContext

// ─── A media element that behaves like one ──────────────────────────────────

const PLAYING = Symbol('playing')
type El = HTMLMediaElement & { [PLAYING]?: boolean }
let plays: string[] = []
let originals: { play: PropertyDescriptor; pause: PropertyDescriptor; paused: PropertyDescriptor }

const beds = (): string[] => Object.values(BED_FILES)
const flush = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) await Promise.resolve()
  await nextTick()
}
/** The last file the element was asked to play, by name. */
const nowPlaying = (): string | undefined => plays[plays.length - 1]?.split('/').pop()

const mountMusic = () => {
  let api!: ReturnType<typeof useMusic>
  const wrapper = mount(defineComponent({
    setup () {
      api = useMusic()
      api.initMusic()
      return () => null
    }
  }))
  return { wrapper, api }
}

beforeEach(() => {
  vi.useFakeTimers()
  const proto = HTMLMediaElement.prototype
  originals = {
    play: Object.getOwnPropertyDescriptor(proto, 'play')!,
    pause: Object.getOwnPropertyDescriptor(proto, 'pause')!,
    paused: Object.getOwnPropertyDescriptor(proto, 'paused')!
  }
  plays = []
  Object.defineProperty(proto, 'play', {
    configurable: true,
    value: function (this: El) { this[PLAYING] = true; plays.push(this.src); return Promise.resolve() }
  })
  Object.defineProperty(proto, 'pause', {
    configurable: true,
    value: function (this: El) { this[PLAYING] = false }
  })
  Object.defineProperty(proto, 'paused', {
    configurable: true,
    get (this: El) { return !this[PLAYING] }
  })
  ctx.sources = []
  ctx.currentTime = 0
  ctx.state = 'running'
  for (const f of beds()) {
    const src = prependBaseUrl('audio/music/' + f)
    resourceCache.audio.set(src, { src } as unknown as HTMLAudioElement)
  }
  for (const f of [FEVER_STINGER_FILE, RESULT_STING_FILE]) {
    resourceCache.audioBuffers.set(prependBaseUrl('audio/music/' + f), { duration: 1 } as unknown as AudioBuffer)
  }
  setMusicScene(NO_SCENE)
})

afterEach(async () => {
  setPlatformAudioMuted(false)
  useUser().setSettingValue('musicTrack', 'parade')
  await flush()
  vi.useRealTimers()
  const proto = HTMLMediaElement.prototype
  Object.defineProperty(proto, 'play', originals.play)
  Object.defineProperty(proto, 'pause', originals.pause)
  Object.defineProperty(proto, 'paused', originals.paused)
  resourceCache.audio.clear()
  resourceCache.audioBuffers.clear()
})

describe('which bed the element plays', () => {
  it('outside a level: the player\'s own track (CONTROL — the start really plays)', async () => {
    const { wrapper, api } = mountMusic()
    api.startBattleMusic()
    await flush()
    expect(nowPlaying()).toBe(BED_FILES.parade)
    wrapper.unmount()
  })

  it('a boss level plays the boss loop, world 3 the attic, a plain level the pick', async () => {
    const { wrapper, api } = mountMusic()
    const expectBed = async (level: number, file: string, party = false): Promise<void> => {
      api.stopBattleMusic()
      vi.advanceTimersByTime(2000)
      setMusicScene({ level, party })
      api.startBattleMusic()
      await flush()
      expect(nowPlaying(), `level ${level}${party ? ' (party)' : ''}`).toBe(file)
    }
    await expectBed(1, BED_FILES.parade)
    await expectBed(4, BED_FILES.boss) // the Queen at half strength
    await expectBed(23, BED_FILES.attic)
    await expectBed(30, BED_FILES.boss) // the Matriarch, in the attic
    await expectBed(26, BED_FILES.parade, true) // the party after 3-6
    await expectBed(35, BED_FILES.parade)
    wrapper.unmount()
  })

  it('trance is kept in the attic; cozy is not', async () => {
    const { wrapper, api } = mountMusic()
    const user = useUser()
    setMusicScene({ level: 23 })
    user.setSettingValue('musicTrack', 'trance')
    api.startBattleMusic()
    await flush()
    expect(nowPlaying()).toBe(BED_FILES.trance)

    // Picked mid-level in Options: the watcher re-routes, and cozy → the attic.
    user.setSettingValue('musicTrack', 'cozy')
    await flush()
    vi.advanceTimersByTime(400) // the 300 ms dip between beds
    await flush()
    expect(nowPlaying()).toBe(BED_FILES.attic)
    wrapper.unmount()
  })

  it('a new pick on a boss level does not restart the fight\'s music', async () => {
    const { wrapper, api } = mountMusic()
    setMusicScene({ level: 20 })
    api.startBattleMusic()
    await flush()
    const before = plays.length
    useUser().setSettingValue('musicTrack', 'cozy')
    await flush()
    vi.advanceTimersByTime(1000)
    await flush()
    expect(plays.length).toBe(before)
    expect(nowPlaying()).toBe(BED_FILES.boss)
    wrapper.unmount()
  })

  it('an extra start on the right bed is a no-op; on the wrong bed it is a transition', async () => {
    const { wrapper, api } = mountMusic()
    setMusicScene({ level: 5 })
    api.startBattleMusic()
    await flush()
    const n = plays.length
    api.startBattleMusic()
    await flush()
    expect(plays.length).toBe(n)

    setMusicScene({ level: 10 })
    api.startBattleMusic()
    vi.advanceTimersByTime(400)
    await flush()
    expect(nowPlaying()).toBe(BED_FILES.boss)
    wrapper.unmount()
  })
})

describe('the fever stinger', () => {
  it('plays instead of the bed, and hands the bed back in its last beat', async () => {
    const { wrapper, api } = mountMusic()
    setMusicScene({ level: 5 })
    api.startBattleMusic()
    await flush()
    vi.advanceTimersByTime(1000) // fade-in done
    const bedPlays = plays.length

    playFeverStinger()
    const stinger = ctx.sources.at(-1)!
    expect(stinger.started).toBe(true)
    vi.advanceTimersByTime(150) // the 90 ms dip, then the pause
    await flush()

    // Held: nothing that normally restarts the bed may do it now.
    api.continueMusic()
    await flush()
    expect(plays.length).toBe(bedPlays)

    // Just before the last beat: still held.
    ctx.currentTime = FEVER_BED_RETURN_MS / 1000 - 0.1
    vi.advanceTimersByTime(100)
    await flush()
    expect(plays.length).toBe(bedPlays)

    // The last beat's hole: the bed is back (the same file, where it paused).
    ctx.currentTime = FEVER_BED_RETURN_MS / 1000 + 0.01
    vi.advanceTimersByTime(100)
    await flush()
    expect(plays.length).toBe(bedPlays + 1)
    expect(nowPlaying()).toBe(BED_FILES.parade)
    wrapper.unmount()
  })

  it('freezes with a pause instead of handing the bed back on a wall clock', async () => {
    const { wrapper, api } = mountMusic()
    setMusicScene({ level: 5 })
    api.startBattleMusic()
    await flush()
    const bedPlays = plays.length
    playFeverStinger()
    // Ten seconds of wall time with the audio clock frozen (a pause suspends
    // the context): the stinger has not moved, so neither does the bed.
    vi.advanceTimersByTime(12_000)
    await flush()
    expect(plays.length).toBe(bedPlays)
    wrapper.unmount()
  })

  it('a fever cut short (the gilded laces) fades the stinger and brings the bed back', async () => {
    const { wrapper, api } = mountMusic()
    setMusicScene({ level: 5 })
    api.startBattleMusic()
    await flush()
    const bedPlays = plays.length
    playFeverStinger()
    const stinger = ctx.sources.at(-1)!
    vi.advanceTimersByTime(150)
    endFeverStinger()
    await flush()
    expect(stinger.stop).toHaveBeenCalled()
    expect(plays.length).toBe(bedPlays + 1)
    wrapper.unmount()
  })

  it('does not outlive its level', async () => {
    const { wrapper, api } = mountMusic()
    setMusicScene({ level: 5 })
    api.startBattleMusic()
    await flush()
    playFeverStinger()
    const stinger = ctx.sources.at(-1)!
    api.stopBattleMusic()
    expect(stinger.stop).toHaveBeenCalled()
    wrapper.unmount()
  })

  it('never starts under a portal mute (and the bed is left alone)', async () => {
    const { wrapper, api } = mountMusic()
    setMusicScene({ level: 5 })
    api.startBattleMusic()
    await flush()
    setPlatformAudioMuted(true)
    const n = ctx.sources.length
    playFeverStinger()
    expect(ctx.sources.length).toBe(n)
    wrapper.unmount()
  })
})

describe('the ad-mute guarantee covers the cues', () => {
  it('the ad kill stops a playing fever stinger', async () => {
    const { wrapper, api } = mountMusic()
    setMusicScene({ level: 5 })
    api.startBattleMusic()
    await flush()
    playFeverStinger()
    const stinger = ctx.sources.at(-1)!
    killOneShotSfx() // what every ad path calls before the ad opens
    expect(stinger.stop).toHaveBeenCalled()
    wrapper.unmount()
  })

  it('the ad kill stops a playing result sting', async () => {
    const { wrapper } = mountMusic()
    playResultSting(0)
    const sting = ctx.sources.at(-1)!
    expect(sting.started).toBe(true)
    killOneShotSfx()
    expect(sting.stop).toHaveBeenCalled()
    wrapper.unmount()
  })

  it('the cues play on the shared context and nowhere else', async () => {
    const { wrapper, api } = mountMusic()
    setMusicScene({ level: 5 })
    api.startBattleMusic()
    await flush()
    playFeverStinger()
    const stinger = ctx.sources.at(-1)!
    expect(stinger.context).toBe(ctx)
    expect(stinger.connect).toHaveBeenCalled()
    wrapper.unmount()
  })
})

describe('the result sting', () => {
  it('waits the delay it is given, then plays once', async () => {
    const { wrapper } = mountMusic()
    const n = ctx.sources.length
    playResultSting(500)
    vi.advanceTimersByTime(499)
    expect(ctx.sources.length).toBe(n)
    vi.advanceTimersByTime(2)
    expect(ctx.sources.length).toBe(n + 1)
    wrapper.unmount()
  })

  it('gives way the moment the next level\'s bed starts', async () => {
    const { wrapper, api } = mountMusic()
    playResultSting(0)
    const sting = ctx.sources.at(-1)!
    setMusicScene({ level: 6 })
    api.startBattleMusic()
    expect(sting.stop).toHaveBeenCalled()
    wrapper.unmount()
  })

  it('is dropped if the screen closes before it starts', async () => {
    const { wrapper } = mountMusic()
    const n = ctx.sources.length
    playResultSting(500)
    cancelResultSting()
    vi.advanceTimersByTime(1000)
    expect(ctx.sources.length).toBe(n)
    wrapper.unmount()
  })
})
