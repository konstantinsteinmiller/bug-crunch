import { prependBaseUrl } from '@/utils/function'
import useUser, { DEFAULT_MUSIC_TRACK } from '@/use/useUser'
import {
  NO_SCENE, FEVER_STINGER_FILE, RESULT_STING_FILE, FEVER_BED_RETURN_MS, FEVER_STINGER_CUT_MS,
  routeBedFile, bedFileToWarm, type MusicScene
} from '@/game/musicRouting'
import { getAudioContext, loadAudioBuffer, resourceCache, registerHtmlAudio, unregisterHtmlAudio, isAudioSuspended, registerOneShotSource } from '@/use/useAssets'
import { isGamePaused } from '@/use/useGamePause'
import { isPlatformAudioMuted } from '@/use/useGamePauseAudio'
import { isMobileAudioMuted } from '@/use/useMobileAudioMute'

import { ref, onMounted, watch, onUnmounted } from 'vue'

// We keep the audio instance outside the hook so it's a true Singleton
const bgMusic = ref<HTMLAudioElement | null>(null)
const isLoaded = ref(false)
const isPlaying = ref(false)
// Tracks whether music is *meant* to be playing right now (i.e. a battle is
// in progress). Used so visibility-change resume only un-pauses when there's
// actually a battle running.
const shouldPlay = ref(false)

/**
 * Hard-stop the background music IMMEDIATELY (no fade) and clear the
 * play-intent flags. Use right before an interstitial ad is requested.
 *
 * Why this and not just the suspend gate: the pause gate (`useGamePauseAudio`)
 * pauses the music while `isAdShowing` is true and RESUMES it when the flag
 * drops. But the GamePix `interstitialAd()` promise can resolve before the ad
 * visually closes — `isAdShowing` then drops and the gate restarts the music
 * UNDER the still-open ad (the bug GamePix QA keeps reporting). Stopping the
 * music here first makes that impossible: the element is already paused before
 * any suspend runs, so it's never queued for auto-resume, and `shouldPlay =
 * false` stops any in-flight fade. The next round's `startBattleMusic()`
 * brings it back. Idempotent and null-safe.
 */
/** Set by `useMusic()` — see the assignment there for why it exists. */
let restartTrack: (() => void) | null = null

/**
 * Bring the battle music back after an ad that interrupted a LIVE run.
 *
 * `forceStopMusic` deliberately clears the play INTENT (`shouldPlay`), so the
 * pause gate cannot restart the track underneath an ad that is still open. Its
 * contract is that "the next round's `startBattleMusic()` brings it back", and
 * for the between-rounds interstitial that is exactly right — the next round is
 * one button press away.
 *
 * The GamePix first-LOAD interstitial breaks that assumption: it fires from the
 * splash, while stage 1 is already running, and stages 1-2 hand over without a
 * result screen — so the next `startBattleMusic()` is two or three stages and
 * several minutes away. Measured in a real browser against the built GamePix
 * bundle: the ad no-filled and the game stayed SILENT for the rest of the
 * opening. Nothing threw, and no test covered it.
 *
 * No-ops when the music was never wanted, and it goes through the normal start
 * path — so if the portal is muted this re-asserts the intent and stays silent,
 * and the unmute watcher sounds it later.
 */
export const resumeMusicAfterAd = (): void => {
  restartTrack?.()
}

/** Returns whether the music was WANTED when it was cut — the ad layer uses it
 *  to decide whether a late-opening ad owes the run its music back. */
export const forceStopMusic = (): boolean => {
  const wasWanted = shouldPlay.value
  shouldPlay.value = false
  try {
    bgMusic.value?.pause()
    if (bgMusic.value) {
      bgMusic.value.volume = 0
    }
  } catch { /* element gone / not ready */ }
  isPlaying.value = false
  return wasWanted
}

/**
 * Set the background-music playback rate directly. The game tick computes a
 * stage-aware rate from the ball's current speed (slow at stage start / under
 * slow-mo, faster as the run heats up — see useEpicGame.step) and feeds it here
 * each frame. Clamped to a sane band so a bad value can never warp the audio.
 * Idempotent, null-safe, and a no-op before the music element exists, so it must
 * never throw or allocate.
 */
export const setMusicRate = (rate: number): void => {
  if (!bgMusic.value) return
  const safe = Number.isFinite(rate) ? rate : 1
  const clamped = Math.max(0.5, Math.min(2, safe))
  try {
    bgMusic.value.playbackRate = clamped
  } catch { /* element not ready / rate unsupported */ }
}

/**
 * ─── The tempo follows the crowd ────────────────────────────────────────────
 *
 * A hundred and eighty people running is not the same scene as nine, and until
 * now the score did not know the difference — `setMusicRate` had been written,
 * clamped and documented here for months with no caller anywhere in the repo.
 *
 * The curve is deliberately shallow and deliberately SATURATING. `+18 %` at the
 * top is about a tone and a half of pitch on a looping track: felt as the run
 * tightening, never heard as a broken tape. It rises LINEARLY to that ceiling
 * at 600 survivors — a very good stage rather than an unreachable one (the hard
 * cap is `MAX_SQUAD`, 4000), because the effect has to be arriving while the
 * crowd is still growing rather than long since pinned at the top.
 *
 * Note the shape: `RANGE × min(1, n / FULL)`, not `min(RANGE, n / FULL)`. The
 * second is the obvious spelling and it is wrong — it saturates at 108
 * survivors, which most runs pass in the first two stages, so the tempo would
 * be pinned at maximum for nine tenths of a career and the feature would be a
 * constant rather than a signal.
 *
 * And it is a function of the crowd ON SCREEN, not of the stage number: losing
 * two thirds of a squad to a `÷3` drops the tempo with it, which is the half of
 * this that a stage-indexed version could never do.
 */
export const MUSIC_RATE_RANGE = 0.18
export const MUSIC_RATE_FULL_SQUAD = 600

/** Playback rate for a crowd of `squad`. Pure, clamped, total. */
export const squadMusicRate = (squad: number): number => {
  const n = Number.isFinite(squad) ? Math.max(0, squad) : 0
  return 1 + MUSIC_RATE_RANGE * Math.min(1, n / MUSIC_RATE_FULL_SQUAD)
}

/**
 * What the track does when the run ends badly.
 *
 * A hard drop below 1.0 rather than a fade: the crowd is gone, and a score that
 * keeps its tempo through a wipe is the single most common way a game tells the
 * player it did not notice. Held for `MUSIC_WIPE_MS`, which outlasts the wipe
 * effect and lands under the result screen.
 */
export const MUSIC_WIPE_RATE = 0.85
export const MUSIC_WIPE_MS = 2000

/**
 * Back-compat: drive tempo from a 0..1 intensity. Retained for any caller that
 * still thinks in "intensity"; maps onto a gentle 1.0×–1.15× rate band.
 */
export const setMusicIntensity = (intensity: number): void => {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(intensity) ? intensity : 0))
  setMusicRate(1 + clamped * 0.15)
}

/**
 * Slider value → music element volume. ONE scale for the fade-in and for a
 * slider move: they used to disagree (the fade aimed at ×0.125, the slider
 * watcher wrote ×0.025), so touching the music slider mid-run dropped the track
 * by 14 dB below the level every untouched player hears — and the level the
 * shipped tracks are mastered for (see `tools/music/render.mjs`).
 */
const MUSIC_VOLUME_SCALE = 0.125

// ─── Fades ──────────────────────────────────────────────────────────────────

/** The rate the player's fades have always run at: 0.005 of volume per 50 ms
 *  step — the default slider's 0.075 in 750 ms. */
const FADE_MS_PER_VOLUME = 50 / 0.005

let fadeTimer: ReturnType<typeof setInterval> | null = null
const cancelFade = (): void => {
  if (fadeTimer !== null) clearInterval(fadeTimer)
  fadeTimer = null
}

/**
 * Move the music element's volume from `from` (default: where it is) to `to`
 * over `ms`, in 50 ms steps, then call `onDone`. `alive` is re-checked every
 * step; when it turns false the fade stops where it is, without `onDone`.
 *
 * ONE fade at a time: a new fade cancels the running one, so a stop's fade-out
 * can no longer pause the NEXT level's track when the player taps through the
 * result screen quickly. And it ends on TIME, never by reading the volume back:
 * iOS ignores `volume` writes and reports 1 forever, and the fade-out that used
 * to wait for the volume to reach 0 there never ended — the track played on
 * under the result screen, and its interval leaked, once per level.
 */
const rampVolume = (to: number, ms: number, onDone?: () => void, alive?: () => boolean, from?: number): void => {
  cancelFade()
  const el = bgMusic.value
  if (!el) { onDone?.(); return }
  const start = from ?? el.volume
  const steps = Math.max(1, Math.round(ms / 50))
  let i = 0
  const timer = setInterval(() => {
    const cur = bgMusic.value
    if (!cur) {
      if (fadeTimer === timer) cancelFade()
      onDone?.()
      return
    }
    if (alive && !alive()) {
      if (fadeTimer === timer) cancelFade()
      return
    }
    i++
    const v = start + (to - start) * Math.min(1, i / steps)
    try { cur.volume = Math.max(0, Math.min(1, v)) } catch { /* element not ready */ }
    if (i >= steps) {
      if (fadeTimer === timer) cancelFade()
      onDone?.()
    }
  }, 50)
  fadeTimer = timer
}

// ─── Routing, and the two music cues ────────────────────────────────────────
//
// WHICH bed plays is decided in `game/musicRouting.ts` (a pure module with the
// rules and their tests); the scene tells the player where the game is with
// `setMusicScene`, and every start resolves the file through it. The beds all
// play through the ONE element above.
//
// The fever stinger and the result sting are not beds. They are decoded
// buffers played on the SHARED AudioContext from `useAssets` — the context the
// ad/pause gate suspends — and registered with `registerOneShotSource`, so the
// ad kill (`killOneShotSfx`) hard-stops them exactly as it stops an SFX. No
// second element and no second context: the ad-mute guarantee covers them the
// same way it covers every squish. (A second element would have needed its own
// line in `forceStopMusic`; a buffer on the shared context needs nothing.)
//
// Why a buffer and not the element: the stinger has to land ON the button
// press. A media element swapping its source starts 100-300 ms late; a decoded
// buffer starts on the next audio quantum.

let musicScene: MusicScene = NO_SCENE

/**
 * Tell the player where the game is: a level (`{ level }`), a Bug Party
 * (`{ level, party: true }`). The next bed start resolves through it; a bed
 * already playing is left alone until then.
 */
export const setMusicScene = (scene: MusicScene): void => {
  musicScene = { ...scene }
}

/** The scene the player is routing for — for tests and the debug overlay. */
export const getMusicScene = (): MusicScene => musicScene

const musicSrc = (file: string): string => prependBaseUrl('audio/music/' + file)

const warmedBeds = new Set<string>()

/**
 * Fetch ahead the bed the level after `level` will need — only ever the boss
 * loop or the attic, only when this level does not already play it (see
 * `bedFileToWarm`), and once per session. Neither is part of the first load:
 * 1-3 warms the Queen's fight, 2-10 warms the attic. A best-effort HTTP-cache
 * warm-up; the element streams the file on demand either way.
 */
export const warmMusicFor = (level: number): void => {
  const { userMusicTrack } = useUser()
  const file = bedFileToWarm(userMusicTrack.value, level, DEFAULT_MUSIC_TRACK)
  if (!file || warmedBeds.has(file) || typeof fetch !== 'function') return
  warmedBeds.add(file)
  try {
    void fetch(musicSrc(file), { priority: 'low' } as RequestInit)
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .catch(() => { warmedBeds.delete(file) })
  } catch {
    warmedBeds.delete(file)
  }
}

/**
 * Decode the stinger (99 KB) and the sting (30 KB) on the shared context. Called
 * when a level starts — never on the first load — so both are ready long before
 * the first vial fills.
 */
export const warmMusicCues = (): void => {
  void loadAudioBuffer(musicSrc(FEVER_STINGER_FILE))
  void loadAudioBuffer(musicSrc(RESULT_STING_FILE))
}

type CueKind = 'fever' | 'result'

interface Cue {
  kind: CueKind
  source: AudioBufferSourceNode
  gain: GainNode
  /** `ctx.currentTime` at the start — the stinger is timed on the audio clock. */
  startedAt: number
}

let cue: Cue | null = null

/** The cues follow the MUSIC slider, on the scale the beds use: the files are
 *  mastered on the beds' loudness scale, so the same gain lands them level. */
const cueVolume = (): number => {
  const { userMusicVolume } = useUser()
  return Math.max(0, Math.min(1, (userMusicVolume.value ?? 0.6) * MUSIC_VOLUME_SCALE))
}

const startCue = (kind: CueKind, file: string, onEnd?: () => void): boolean => {
  stopCue(0)
  // The gates the bed's start obeys. Under an ad, a pause or a hidden tab the
  // context is suspended, and a source started now would thaw later, out of its
  // moment — so it is not started at all.
  if (isAudioSuspended() || isGamePaused.value || isMobileAudioMuted.value || isPlatformAudioMuted.value) return false
  const volume = cueVolume()
  if (volume <= 0) return false
  const src = musicSrc(file)
  const ctx = getAudioContext()
  const buffer = resourceCache.audioBuffers.get(src)
  if (!ctx || !buffer || ctx.state !== 'running') {
    // Not decoded yet (or no Web Audio): skip this one, be ready for the next.
    if (ctx && !buffer) void loadAudioBuffer(src)
    return false
  }
  try {
    const source = ctx.createBufferSource()
    source.buffer = buffer
    const gain = ctx.createGain()
    gain.gain.value = volume
    source.connect(gain).connect(ctx.destination)
    const entry: Cue = { kind, source, gain, startedAt: ctx.currentTime }
    source.addEventListener('ended', () => {
      if (cue === entry) cue = null
      try { gain.disconnect() } catch { /* already gone */ }
      onEnd?.()
    }, { once: true })
    source.start()
    // THE line that puts the cue under the ad kill.
    registerOneShotSource(source)
    cue = entry
    return true
  } catch (e) {
    console.warn('[music] cue start failed', e)
    return false
  }
}

const stopCue = (fadeMs: number): void => {
  const c = cue
  if (!c) return
  cue = null
  try {
    const ctx = c.gain.context
    const now = ctx.currentTime
    if (fadeMs > 0 && ctx.state === 'running') {
      c.gain.gain.cancelScheduledValues(now)
      c.gain.gain.setValueAtTime(c.gain.gain.value, now)
      c.gain.gain.linearRampToValueAtTime(0, now + fadeMs / 1000)
      c.source.stop(now + fadeMs / 1000 + 0.02)
    } else {
      c.source.stop()
    }
  } catch { /* already stopped */ }
}

// ── The fever: the bed steps aside ──
//
// For the ten seconds of Splat Fever the stinger plays INSTEAD of the bed: the
// bed dips for 90 ms and pauses (a pause, not a volume duck — iOS ignores
// volume writes, and a ducked bed there would play at full level under the
// stinger), and it comes back where it left off, fading in from the stinger's
// last-beat hole. Played over the bed instead, the stinger (G) would sit on
// whatever key and bar the bed was in (F, D minor, F minor, the old tracks'
// keys) for ten seconds.

/** True while the bed is paused for the stinger. `playWithFade` refuses to start
 *  it, so no watcher (a closed modal, an unmute, a tab coming back) can bring it
 *  back on top of the stinger. */
let bedHeld = false
let bedReturnPoll: ReturnType<typeof setInterval> | null = null
/** Set by `useMusic()`: restart the bed through the normal gated start. */
let resumeBed: (() => void) | null = null

const clearBedReturn = (): void => {
  if (bedReturnPoll !== null) clearInterval(bedReturnPoll)
  bedReturnPoll = null
}

/** Let go of the bed without restarting it (a stop, a fresh start). */
const dropBedHold = (): void => {
  clearBedReturn()
  bedHeld = false
}

const releaseBed = (): void => {
  if (!bedHeld) { clearBedReturn(); return }
  dropBedHold()
  resumeBed?.()
}

const holdBed = (): void => {
  bedHeld = true
  const el = bgMusic.value
  if (!el || el.paused) return
  rampVolume(0, 90, () => {
    if (!bedHeld || !bgMusic.value) return
    bgMusic.value.pause()
    isPlaying.value = false
  })
}

/**
 * Splat Fever began: play the stinger and step the bed aside. A no-op when the
 * stinger is not decoded yet, the music slider is at zero, or anything has the
 * audio muted — the bed simply plays on, as it always did.
 */
export const playFeverStinger = (): void => {
  if (!startCue('fever', FEVER_STINGER_FILE, releaseBed)) return
  const c = cue
  if (!c) return
  holdBed()
  clearBedReturn()
  const ctx = c.gain.context
  const at = c.startedAt + FEVER_BED_RETURN_MS / 1000
  // Polled on the AUDIO clock, not a timer: a pause freezes the context and the
  // stinger with it, and a wall-clock timer would bring the bed back in the
  // middle of a stinger that has not finished.
  bedReturnPoll = setInterval(() => {
    if (cue !== c) { releaseBed(); return }
    if (ctx.currentTime >= at) releaseBed()
  }, 50)
}

/**
 * Splat Fever ended. Normally the stinger is ringing out by now and the bed is
 * already back; a fever cut short (the six-second gilded laces) fades the
 * stinger out and brings the bed back at once.
 */
export const endFeverStinger = (): void => {
  if (cue?.kind === 'fever') stopCue(FEVER_STINGER_CUT_MS)
  releaseBed()
}

// ── The result sting ──

let stingTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Play the result sting, `delayMs` from now — see `resultStingDelayMs` for why
 * it can wait. Dropped if a level has started by then.
 */
export const playResultSting = (delayMs = 0): void => {
  cancelResultSting()
  const go = (): void => {
    stingTimer = null
    if (shouldPlay.value) return
    startCue('result', RESULT_STING_FILE)
  }
  if (delayMs > 0) stingTimer = setTimeout(go, delayMs)
  else go()
}

/** The result screen went away: a sting that has not started never will, and
 *  one that is playing gets out of the way. */
export const cancelResultSting = (): void => {
  if (stingTimer !== null) clearTimeout(stingTimer)
  stingTimer = null
  if (cue?.kind === 'result') stopCue(150)
}

// A sting is a moment: interrupted by a pause (a modal, an ad, a hidden tab) it
// is dropped, not frozen and thawed seconds later on a different screen. The
// fever stinger is the opposite — it freezes with the fever's own clock, which
// the same pause stops. `sync`, so the stop lands before the context suspends.
watch(isGamePaused, (paused) => {
  if (paused && cue?.kind === 'result') stopCue(0)
}, { flush: 'sync' })

export const useMusic = () => {
  const { userMusicVolume, userMusicTrack } = useUser()

  const musicElementVolume = (): number =>
    Math.max(0, Math.min(1, (userMusicVolume.value ?? 0.6) * MUSIC_VOLUME_SCALE))

  watch(userMusicVolume, () => {
    if (cue) cue.gain.gain.value = cueVolume()
    if (!bgMusic.value) return
    bgMusic.value.volume = musicElementVolume()
  })

  // Live-swap the background track when the player picks a different one in
  // Options. Only reload if music is meant to be playing right now — otherwise
  // the next `startBattleMusic()` naturally picks up the new choice. Routed, so
  // a new pick may not change the file at all (a boss level plays the boss loop
  // whatever is picked) — then nothing restarts.
  watch(userMusicTrack, () => {
    if (!bgMusic.value || !shouldPlay.value) return
    if (elementPlays(currentTrackFile())) return
    isPlaying.value = false
    switchTrack()
  })

  // The bed for where the game is (`setMusicScene`) and what the player picked
  // — the rules are `routeBed` in `game/musicRouting.ts`. A save can carry a
  // track id this build no longer ships; that falls back to the default.
  const currentTrackFile = (): string =>
    routeBedFile(userMusicTrack.value, musicScene, DEFAULT_MUSIC_TRACK)

  /** Is the element pointed at `file` right now? */
  const elementPlays = (file: string): boolean =>
    !!bgMusic.value?.src && bgMusic.value.src.endsWith('/audio/music/' + file)

  /** Change beds while one is sounding: a 300 ms dip, then the new bed from its
   *  top with the usual fade-in. One element, so a dip rather than an overlap —
   *  and never two beds audible at once. */
  const switchTrack = (): void => {
    const el = bgMusic.value
    if (!el || el.paused) { loadAndPlayTrack(); return }
    rampVolume(0, 300, () => { if (shouldPlay.value) loadAndPlayTrack() })
  }

  resumeBed = () => {
    if (shouldPlay.value && bgMusic.value && bgMusic.value.paused) playWithFade()
  }

  // Point the music element at the active track and fade it in — using the
  // preloaded/decoded copy when available, otherwise fetching on demand.
  const loadAndPlayTrack = () => {
    if (!bgMusic.value) return
    // A fade still running from the last stop would otherwise finish by pausing
    // the track this is about to start.
    cancelFade()
    const src = prependBaseUrl('audio/music/' + currentTrackFile())
    const cached = resourceCache.audio.get(src)
    bgMusic.value.pause()
    bgMusic.value.volume = 0
    if (cached) {
      bgMusic.value.src = cached.src
      isLoaded.value = true
      playWithFade()
    } else {
      bgMusic.value.src = src
      bgMusic.value.load()
      bgMusic.value.addEventListener('canplaythrough', () => {
        isLoaded.value = true
        playWithFade()
      }, { once: true })
    }
  }

  const pauseMusic = () => {
    if (bgMusic.value) {
      bgMusic.value.pause()
      isPlaying.value = false
    }
  }

  const continueMusic = () => {
    if (bgMusic.value && shouldPlay.value) {
      playWithFade()
    }
  }

  const initMusic = () => {
    onMounted(() => {
      if (bgMusic.value) return // Already initialized
      const audio = new Audio()
      audio.loop = true
      audio.volume = 0
      audio.preload = 'auto'
      bgMusic.value = audio
      // Register with the global suspend/resume registry so tab-hide
      // and ad-show both halt the music track and resume it after.
      registerHtmlAudio(audio)

      // Re-fire the music start when the pause gate clears. `playWithFade`
      // refuses to play while `isGamePaused` is true (the ad/pause guard), so a
      // `startBattleMusic()` that was issued mid-ad sets `shouldPlay=true` but
      // doesn't actually sound. This watcher catches the false-edge (ad finished
      // or failed to fill, modal closed, tab refocused) and resumes the track
      // iff it's still wanted — the "resume only after the ad ends" half of the
      // requirement. `initMusic` is called once (App.vue) so this is a single
      // app-lifetime watcher.
      watch(isGamePaused, (paused) => {
        if (!paused && shouldPlay.value && bgMusic.value && bgMusic.value.paused) {
          playWithFade()
        }
      })

      // Same re-fire on the mobile hard-mute clearing: while muted, a
      // `startBattleMusic()` set `shouldPlay=true` but `playWithFade` refused to
      // sound. When the player unmutes, resume the track iff a battle is still
      // running and it isn't already playing (the generic suspend resume may have
      // already restarted it if it was mid-play when muted — hence the `paused`
      // guard avoids a double start).
      watch(isMobileAudioMuted, (muted) => {
        if (!muted && shouldPlay.value && bgMusic.value && bgMusic.value.paused) {
          playWithFade()
        }
      })

      // And the same false-edge re-fire for the PORTAL mute. Without it a
      // player who unmutes the portal chrome gets a permanently silent game:
      // `shouldPlay` is already true, `resumeAllAudio` only restarts elements
      // it actually paused (a track that never started isn't one of them), and
      // nothing else would ever call the start again.
      watch(isPlatformAudioMuted, (muted) => {
        if (!muted && shouldPlay.value && bgMusic.value && bgMusic.value.paused) {
          playWithFade()
        }
      })
    })
    onUnmounted(() => {
      stopCue(0)
      dropBedHold()
      cancelFade()
      if (bgMusic.value) unregisterHtmlAudio(bgMusic.value)
      bgMusic.value?.pause()
      bgMusic.value?.removeAttribute('src')
      bgMusic.value = null
      shouldPlay.value = false
      isPlaying.value = false
      isLoaded.value = false
    })
  }

  const isMusicPlaying = (): boolean => !!bgMusic.value && isPlaying.value

  const startBattleMusic = () => {
    if (!bgMusic.value) return
    // A result sting still ringing gives way to the level's bed.
    cancelResultSting()
    // Already playing a battle track — leave it alone so we don't restart
    // mid-fight on extra calls. Unless it is the WRONG bed for where the game
    // now is (`setMusicScene` moved on while it played): that is a transition.
    if (shouldPlay.value && isPlaying.value) {
      if (!elementPlays(currentTrackFile())) switchTrack()
      return
    }
    // A fresh start owes nothing to a fever that was cut short (an ad kills
    // the stinger): the bed is not being held for anything any more.
    if (cue?.kind === 'fever') stopCue(FEVER_STINGER_CUT_MS)
    dropBedHold()
    shouldPlay.value = true
    loadAndPlayTrack()
  }

  // Publish the starter at module scope so a caller that is not a component —
  // `useFirstLoadInterstitial`, which fires from the splash — can bring the
  // music back after an ad. Every `useMusic()` call closes over the same
  // module-level `bgMusic`, so a later overwrite is the same function.
  restartTrack = () => {
    // Something already brought it back (a watcher, the next round): a second
    // start would reload the track under itself.
    if (shouldPlay.value) return
    startBattleMusic()
  }

  const stopBattleMusic = () => {
    shouldPlay.value = false
    // A fever stinger does not outlive its level.
    if (cue?.kind === 'fever') stopCue(FEVER_STINGER_CUT_MS)
    dropBedHold()
    if (!bgMusic.value) return
    fadeOut(() => {
      bgMusic.value?.pause()
      isPlaying.value = false
    })
  }

  const playWithFade = () => {
    if (!bgMusic.value) return

    // HARD GUARD: never start bg music while the game is paused for ANY reason.
    // `isGamePaused` ORs every pause source — a rewarded/interstitial ad on
    // screen (`isAdShowing`, set by useAds), a Yandex auto-interstitial / tab-
    // hide / purchase dialog (`isPlatformPaused`, set by the SDK pause bridge),
    // or an app modal. The Yandex SDK fires transient pause/resume events around
    // ad preload AND rejects frequency-capped interstitials synchronously; without
    // this choke point a `startBattleMusic()` / `continueMusic()` call racing
    // those events would start music UNDERNEATH the ad — the hard-requirement
    // violation QA keeps flagging. `shouldPlay` stays true, so the
    // `isGamePaused`-drop watcher in `initMusic` re-fires this the moment the
    // gate clears (ad finished / failed to fill), satisfying "resume only after
    // the ad has finished or failed".
    if (isGamePaused.value) return

    // Mobile hard-mute: the player silenced the game to play their own audio.
    // Block the new start the same way the pause gate does; `shouldPlay` stays
    // true so the `isMobileAudioMuted`-drop watcher in `initMusic` re-fires this
    // the moment they unmute (if a battle is still running).
    if (isMobileAudioMuted.value) return

    // PORTAL hard-mute (GamePix `soundOff`, and every portal that mutes without
    // pausing). This is NOT covered by `isGamePaused` — a portal mute is
    // deliberately audio-only, gameplay carries on — so without this line the
    // music start walks straight past it.
    //
    // It is the reload flow that makes this mandatory rather than tidy: QA mutes
    // the portal chrome and reloads, the SDK reports "muted" during boot before
    // this element exists, `setPlatformAudioMuted` suspends an audio layer that
    // is still empty, and then the run's `startBattleMusic()` sounds. Reading
    // the flag HERE is what closes that, and the watcher below restarts the
    // track when the portal unmutes.
    if (isPlatformAudioMuted.value) return

    // The bed is stepped aside for the fever stinger. Every watcher above
    // (a modal closing, an unmute, a tab coming back) funnels through here, so
    // this one line keeps all of them from restarting it on top of the stinger;
    // `releaseBed` brings it back in the stinger's last beat.
    if (bedHeld) return

    // Browsers block autoplay until user interaction
    bgMusic.value.play().then(() => {
      isPlaying.value = true
      fadeIn()
    }).catch(() => {
      // Attach a one-time listener to the window to play on first click
      window.addEventListener('click', () => {
        if (!isPlaying.value && shouldPlay.value) playWithFade()
      }, { once: true })
    })
  }

  // Both fades run through `rampVolume`: the same 0.005-per-50 ms rate they
  // always had, but one at a time, and ending on time rather than on a volume
  // read-back that iOS never delivers (see `rampVolume`).
  const fadeIn = () => {
    if (!bgMusic.value) return
    const target = musicElementVolume()
    rampVolume(target, target * FADE_MS_PER_VOLUME, undefined, () => shouldPlay.value, 0)
  }

  const fadeOut = (onDone?: () => void) => {
    const el = bgMusic.value
    if (!el) {
      onDone?.()
      return
    }
    // From the level the fade-in aimed at, not from what the element reports:
    // an iOS element reports 1 and would take ten seconds to "fade".
    const from = Math.min(el.volume, musicElementVolume() || el.volume)
    rampVolume(0, from * FADE_MS_PER_VOLUME, onDone, undefined, from)
  }


  return { initMusic, isLoaded, isPlaying, isMusicPlaying, pauseMusic, continueMusic, startBattleMusic, stopBattleMusic }
}

// ─── SFX playback ──────────────────────────────────────────────────────────
//
// `playSound` has two paths:
//
//   1. Web Audio (fast path) — a preloaded AudioBuffer lives in
//      resourceCache.audioBuffers. We spawn a fresh AudioBufferSourceNode
//      + GainNode and start it. No fetch, no decode, no media-element
//      allocation — typically <0.5 ms on the main thread.
//
//      If the buffer isn't cached yet (sound played before preload
//      finished, or a sound not in the preload list), we kick off a
//      fetch+decode in the background. The first call on that sound still
//      pays the decode cost, but every subsequent call hits the fast path.
//
//   2. HTMLAudio fallback — only used when Web Audio is unavailable
//      (extremely rare in 2025). We keep the old cloneNode() + new Audio()
//      logic intact so nothing breaks.
//
// Return value: a minimal `SoundHandle` interface so existing callers that
// do `audio.addEventListener('ended', ...)` keep working. The handle is
// backed by either the source node (Web Audio) or the Audio element
// (fallback). `error` events never fire in the Web Audio path — a source
// that fails to start throws synchronously from `start()` and we map that
// to an immediate 'ended' dispatch so caller cleanup logic still runs.

export type SoundHandle = Pick<
  HTMLAudioElement,
  'addEventListener' | 'removeEventListener'
>

/** Handle returned by `playLoop`. Persistent looping voices (chain whir,
 *  ambient drones) live for the duration of a play state — the caller
 *  is responsible for `stop()` when the state changes. */
export interface LoopHandle {
  stop: () => void
  setVolume: (ratio: number) => void
}

const makeWebAudioHandle = (source: AudioBufferSourceNode): SoundHandle => {
  // AudioBufferSourceNode is already an EventTarget and fires 'ended' when
  // playback finishes or stop() is called. We just need to ignore 'error'
  // (Web Audio doesn't emit one) so callers that add both listeners don't
  // crash. Treating 'error' as a no-op is safe because 'ended' always
  // fires for a successfully-started source.
  return {
    addEventListener: ((event: string, cb: EventListener, opts?: AddEventListenerOptions | boolean) => {
      if (event === 'ended') source.addEventListener('ended', cb, opts)
    }) as HTMLAudioElement['addEventListener'],
    removeEventListener: ((event: string, cb: EventListener, opts?: EventListenerOptions | boolean) => {
      if (event === 'ended') source.removeEventListener('ended', cb, opts)
    }) as HTMLAudioElement['removeEventListener']
  }
}

const useSounds = () => {
  const { userSoundVolume } = useUser()

  const clampVolume = (ratio: number): number =>
    Math.max(0, Math.min(1, (userSoundVolume.value ?? 0.7) * ratio))

  const playViaWebAudio = (
    ctx: AudioContext,
    buffer: AudioBuffer,
    ratio: number,
    pitch: number
  ): SoundHandle | null => {
    try {
      const source = ctx.createBufferSource()
      source.buffer = buffer
      if (pitch !== 1) source.playbackRate.value = pitch
      const gain = ctx.createGain()
      gain.gain.value = clampVolume(ratio)
      source.connect(gain).connect(ctx.destination)
      source.start()
      // Track so an ad can hard-stop it (ctx.suspend only freezes; an early
      // gate-drop would otherwise let it tail audibly under the ad).
      registerOneShotSource(source)
      return makeWebAudioHandle(source)
    } catch (e) {
      // Browser refused to start (context killed, etc.) — signal the
      // caller's cleanup via a dispatched 'ended' so they don't leak a
      // slot in their active-sounds counter.
      console.warn('[sfx] Web Audio start failed', e)
      return null
    }
  }

  const playViaHtmlAudio = (src: string, ratio: number): HTMLAudioElement => {
    const cached = resourceCache.audio.get(src)
    const audio = cached
      ? (cached.cloneNode(false) as HTMLAudioElement)
      : new Audio(src)
    // iOS requires volume to be set BEFORE play(). Clamp to [0,1] —
    // Firefox throws DOMException if volume is NaN or out of range (can
    // happen when userSoundVolume hasn't loaded from IndexedDB yet).
    audio.volume = clampVolume(ratio)
    // Track this element with the global suspend registry so a mid-flight
    // SFX (this fallback path fires while a buffer is still decoding) is
    // paused if an ad opens before it finishes. Auto-unregister when the
    // one-shot ends so the WeakSet/Set don't grow unbounded.
    registerHtmlAudio(audio)
    const release = () => unregisterHtmlAudio(audio)
    audio.addEventListener('ended', release, { once: true })
    audio.addEventListener('error', release, { once: true })
    // `play()` returns a Promise in modern browsers, but `undefined` under
    // jsdom and old Safari — guard the `.catch` so a non-Promise return
    // doesn't throw and abort the gameplay tick that triggered the SFX.
    audio.play()?.catch(() => {
      /* autoplay blocked or media failed — ignore */
    })
    return audio
  }

  const playSound = (effect: string, ratio = 0.025, pitch = 1): SoundHandle | null => {
    // Hard mute while the game is paused for an ad / hidden tab. The Web
    // Audio context is already suspended (so a started source would be
    // frozen), but the HTMLAudio fallback would otherwise play immediately
    // under the ad — refuse to start any one-shot at all. This is the
    // "pause all sounds during ads" guarantee QA asked for.
    if (isAudioSuspended()) return null

    const src = prependBaseUrl(`audio/sfx/${effect}.ogg`)

    // Fast path: preloaded AudioBuffer + Web Audio.
    const buffer = resourceCache.audioBuffers.get(src)
    const ctx = getAudioContext()
    if (ctx && buffer) {
      return playViaWebAudio(ctx, buffer, ratio, pitch)
    }

    // Slow path: Web Audio available but buffer not yet decoded. Kick off
    // a background decode so subsequent calls hit the fast path, and play
    // *this* call via HTMLAudio so the player still hears it immediately.
    if (ctx && !buffer) {
      void loadAudioBuffer(src)
    }

    // Fallback: HTMLAudio (also used when Web Audio is unavailable).
    // Pitch is ignored here — HTMLAudio's playbackRate works but the
    // fallback path is intentionally bare-bones, and any modern browser
    // that hits it isn't sweating a fixed-pitch SFX.
    return playViaHtmlAudio(src, ratio)
  }

  /** Random-variant helper — fires one of `prefix-1` … `prefix-count`
   *  with a small per-call pitch jitter so a rapid burst (e.g. mowing a
   *  whole grass cluster) doesn't sound like a machine gun. */
  const playRandomVariant = (
    prefix: string,
    count: number,
    ratio = 0.04,
    pitchJitter = 0.08
  ): SoundHandle | null => {
    if (count < 1) return null
    const idx = 1 + Math.floor(Math.random() * count)
    const pitch = 1 + (Math.random() - 0.5) * pitchJitter * 2
    return playSound(`${prefix}-${idx}`, ratio, pitch)
  }

  /** Start a looping sample. Returns a handle whose `.stop()` ends the
   *  voice and `.setVolume()` retunes its gain. `playSound` plays one-
   *  shots; this is for chain-saw whirs, ambient drones, anything that
   *  should pulse for the duration of a state. */
  const playLoop = (effect: string, ratio = 0.025): LoopHandle | null => {
    // Don't spin up a looping voice while audio is globally suspended (ad
    // on screen / tab hidden). Gameplay is paused in that window anyway, so
    // nothing should be requesting a new loop — this is belt-and-braces.
    if (isAudioSuspended()) return null
    const src = prependBaseUrl(`audio/sfx/${effect}.ogg`)
    const ctx = getAudioContext()
    if (!ctx) return null
    let source: AudioBufferSourceNode | null = null
    let gain: GainNode | null = null
    let stopped = false
    const begin = (buffer: AudioBuffer) => {
      if (stopped) return
      try {
        source = ctx.createBufferSource()
        source.buffer = buffer
        source.loop = true
        gain = ctx.createGain()
        gain.gain.value = clampVolume(ratio)
        source.connect(gain).connect(ctx.destination)
        source.start()
      } catch (e) {
        console.warn('[sfx] loop start failed', e)
      }
    }
    const buffer = resourceCache.audioBuffers.get(src)
    if (buffer) {
      begin(buffer)
    } else {
      // Defer until decoded. If the user stops the loop before decode
      // resolves, `stopped` short-circuits inside `begin`.
      void loadAudioBuffer(src).then(b => { if (b) begin(b) })
    }
    return {
      stop: () => {
        stopped = true
        if (source) {
          try { source.stop() } catch { /* already stopped */ }
          try { source.disconnect() } catch { /* no-op */ }
          source = null
        }
        if (gain) {
          try { gain.disconnect() } catch { /* no-op */ }
          gain = null
        }
      },
      setVolume: (r: number) => {
        if (gain) gain.gain.value = clampVolume(r)
      }
    }
  }

  return {
    playSound,
    playRandomVariant,
    playLoop
  }
}

export default useSounds

