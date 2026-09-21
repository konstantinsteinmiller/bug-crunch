// ─── The audio guard: one owner of "the game is silent right now" ───────────
//
// Every reason the game must be silent — an ad on screen, a hidden tab, a portal
// mute, the player's own mobile mute — holds a slot here. While ANY slot is
// held:
//
//   • every AudioContext the page has created is suspended, and
//   • every <audio> element is paused,
//
// and when the last slot lets go, exactly the ones that were sounding come back
// — once each, at the volume and on the track their owners left them on. This
// module never touches a volume, a src or a track choice: it pauses and
// resumes, so the player's own settings are whatever they were.
//
// ── Why a registry and not a list of known sources ──
//
// The old layer suspended ONE context (the `useAssets` singleton) and paused the
// elements that had been registered by hand. Anything else — a second context, a
// music player with its own element, an SFX path that forgot to register — was
// invisible to it, and sounded straight through an ad. Portal QA measures the
// PAGE, not our bookkeeping: Poki's probe wraps `window.AudioContext` and
// `HTMLMediaElement.prototype.play` and counts everything it sees. So this
// guard hooks the same two places (`installAudioGuard`):
//
//   • the `AudioContext` / `webkitAudioContext` constructors, so a context
//     created ANYWHERE, at any time, is tracked — and one born while a slot is
//     held is suspended at birth;
//   • `play()` / `pause()` on `HTMLAudioElement.prototype`, so every audio
//     element is tracked the first time it plays, and a `play()` issued while a
//     slot is held is DEFERRED (it starts when the hold lets go, and its promise
//     settles then) instead of sounding under the ad.
//
// `<video>` is deliberately NOT hooked: ad SDKs play their creatives in video
// elements inside this same frame (Poki's house ad, IMA), and pausing the ad is
// the one thing worse than leaking audio under it. Game code that ever plays a
// video registers it explicitly with `registerHtmlAudio`.
//
// ── Why `resume()` and `suspend()` are hooked too ──
//
// "Unlock audio on the first gesture", "resume on visibility", a debug page's
// own `ctx.resume()` — every one of them is a way to wake a context in the
// middle of an ad. While a slot is held a `resume()` records the wish and
// returns a promise that settles when the hold lets go, and an owner's own
// `suspend()` cancels that wish. A `statechange` listener backs both up: a
// context that reaches `running` by any other route while silenced (a native
// path we did not wrap, iOS resuming by itself after an interruption) is
// suspended again on the spot.
//
// ── Why `state` is never trusted to decide ──
//
// `AudioContext.state` lags the calls: a `resume()` in flight still reads
// `suspended` until the audio thread answers. The old code suspended only
// "if state === 'running'" — so a suspend requested while a resume was still in
// flight was skipped, the resume then landed, and the context came up RUNNING
// under the ad. Here a slot always calls `suspend()` (a no-op on a suspended
// context), and a context with a resume in flight counts as sounding.

type Waiter = { resolve: () => void; reject: (e: unknown) => void }

interface ContextState {
  /** Resume this context when the last slot lets go. */
  resumeOnRelease: boolean
  /** A native `resume()` has been issued and has not answered yet. */
  resumePending: boolean
  /** Callers of a `resume()` deferred by the hold. */
  waiters: Array<() => void>
}

interface ElementState {
  resumeOnRelease: boolean
  /** Callers of a `play()` deferred by the hold. */
  waiters: Waiter[]
}

/** How many reasons the game has to be silent right now. */
let depth = 0
const contexts = new Map<AudioContext, ContextState>()
const elements = new Map<HTMLMediaElement, ElementState>()
/** In-flight one-shot voices, so an ad can stop them outright. */
const oneShots = new Set<AudioScheduledSourceNode>()

/** Set while the guard itself calls play/pause/resume/suspend, so its own calls
 *  pass straight through the hooks. The calls are synchronous up to the promise
 *  they return, so a flag is enough. */
let internal = false
const asGuard = <T>(fn: () => T): T => {
  const was = internal
  internal = true
  try { return fn() } finally { internal = was }
}

const abortError = (): unknown => {
  try { return new DOMException('play() deferred by the audio guard was cancelled by pause()', 'AbortError') } catch { return new Error('AbortError') }
}

const settleContextWaiters = (st: ContextState): void => {
  for (const w of st.waiters.splice(0)) { try { w() } catch { /* caller's problem */ } }
}

const rejectElementWaiters = (st: ElementState, e: unknown = abortError()): void => {
  for (const w of st.waiters.splice(0)) { try { w.reject(e) } catch { /* caller's problem */ } }
}

// ─── Context plumbing ───────────────────────────────────────────────────────

const guardSuspend = (ctx: AudioContext): void => {
  try {
    const p = asGuard(() => ctx.suspend())
    void p?.catch?.(() => { /* closed / unsupported */ })
  } catch { /* older impls throw instead of rejecting */ }
}

/** After a resume answers: if something wants silence again by now, the
 *  context goes straight back to sleep (and will be resumed on release). */
const afterResume = (ctx: AudioContext, st: ContextState): void => {
  st.resumePending = false
  if (depth > 0 && ctx.state === 'running') {
    st.resumeOnRelease = true
    guardSuspend(ctx)
  } else if (depth === 0) {
    settleContextWaiters(st)
  }
}

/** Issue a resume and track it as in flight — `state` still reads `suspended`
 *  until it lands, and a slot taken in that window must count it as sounding. */
const trackedResume = (ctx: AudioContext, st: ContextState, call: () => Promise<void> | undefined): Promise<void> | undefined => {
  st.resumePending = true
  let p: Promise<void> | undefined
  try { p = call() } catch (e) { st.resumePending = false; throw e }
  const done = (): void => afterResume(ctx, st)
  if (p && typeof p.then === 'function') p.then(done, done)
  else done()
  return p
}

const guardResume = (ctx: AudioContext, st: ContextState): void => {
  try { void trackedResume(ctx, st, () => asGuard(() => ctx.resume()))?.catch?.(() => {}) } catch { afterResume(ctx, st) }
}

/**
 * Track a context. Idempotent. Called for every context the hooked constructor
 * builds, and explicitly by `getAudioContext` (so the shared context is covered
 * even where the hooks are not installed, e.g. tests).
 */
export const trackAudioContext = (ctx: AudioContext | null | undefined): void => {
  if (!ctx || contexts.has(ctx)) return
  const st: ContextState = { resumeOnRelease: false, resumePending: false, waiters: [] }
  contexts.set(ctx, st)
  try {
    ctx.addEventListener?.('statechange', () => {
      if (ctx.state === 'closed') {
        contexts.delete(ctx)
        settleContextWaiters(st)
        return
      }
      // Woken by a route we do not wrap while something wants silence.
      if (depth > 0 && ctx.state === 'running') {
        st.resumeOnRelease = true
        guardSuspend(ctx)
      }
    })
  } catch { /* a fake without events */ }
  // Born into silence. A context built on a page that has seen a gesture starts
  // `running`, so one created while an ad is up would sound under it.
  if (depth > 0) {
    st.resumeOnRelease = true
    guardSuspend(ctx)
  }
}

// ─── Element plumbing ───────────────────────────────────────────────────────

const onElementEnded = (ev: Event): void => {
  const el = ev.target as HTMLMediaElement | null
  if (!el || el.loop) return
  const st = elements.get(el)
  if (st && st.waiters.length === 0) elements.delete(el)
}

/** Track an audio element. Idempotent. Every element that PLAYS is tracked by
 *  the hook; this is also the explicit door for anything the hook cannot see. */
export const registerHtmlAudio = (el: HTMLMediaElement): void => {
  if (!el || elements.has(el)) return
  elements.set(el, { resumeOnRelease: false, waiters: [] })
  // A finished one-shot has nothing left to restore; drop it so the registry
  // does not grow with every SFX the fallback path ever played.
  try { el.addEventListener?.('ended', onElementEnded) } catch { /* fake element */ }
}

export const unregisterHtmlAudio = (el: HTMLMediaElement): void => {
  const st = elements.get(el)
  if (!st) return
  elements.delete(el)
  rejectElementWaiters(st)
}

const guardPause = (el: HTMLMediaElement): void => {
  try { asGuard(() => el.pause()) } catch { /* element gone */ }
}

const guardPlay = (el: HTMLMediaElement, waiters: Waiter[]): void => {
  let p: Promise<void> | undefined
  try {
    p = asGuard(() => el.play())
  } catch (e) {
    for (const w of waiters) w.reject(e)
    return
  }
  if (p && typeof p.then === 'function') {
    p.then(() => { for (const w of waiters) w.resolve() }, (e) => { for (const w of waiters) w.reject(e) })
  } else {
    for (const w of waiters) w.resolve()
  }
}

// ─── Holding and releasing ──────────────────────────────────────────────────

/** Silence everything that is sounding, remembering what was. Idempotent: run
 *  on every new slot, so anything that slipped in under an existing hold (an
 *  element played through a route the hook cannot see) is caught too. */
const sweep = (): void => {
  for (const [ctx, st] of contexts) {
    if (ctx.state === 'closed') continue
    if (ctx.state === 'running' || st.resumePending) st.resumeOnRelease = true
    guardSuspend(ctx)
  }
  for (const [el, st] of elements) {
    if (!el.paused) {
      st.resumeOnRelease = true
      guardPause(el)
    }
  }
}

/** Bring back exactly what the hold took away — each one once. A deferred
 *  `play()`/`resume()` always implies `resumeOnRelease`; an owner's own
 *  `pause()`/`suspend()` during the hold clears it and settles its callers. */
const restore = (): void => {
  for (const [ctx, st] of contexts) {
    if (!st.resumeOnRelease || ctx.state === 'closed') { st.resumeOnRelease = false; settleContextWaiters(st); continue }
    st.resumeOnRelease = false
    guardResume(ctx, st)
  }
  const replay: Array<[HTMLMediaElement, Waiter[]]> = []
  for (const [el, st] of elements) {
    if (!st.resumeOnRelease) continue
    st.resumeOnRelease = false
    replay.push([el, st.waiters.splice(0)])
  }
  for (const [el, waiters] of replay) guardPlay(el, waiters)
}

/**
 * Take a silence slot. Stacks: nested slots need matching releases before
 * anything sounds again, so an ad opened under a portal mute can never un-mute
 * the portal's choice when it closes.
 */
export const suspendAllAudio = (): void => {
  depth += 1
  sweep()
}

/** Give a slot back. The last one out restores exactly what was sounding.
 *  Unbalanced calls (no slot held) are ignored — never a second resume. */
export const resumeAllAudio = (): void => {
  if (depth === 0) return
  depth -= 1
  if (depth === 0) restore()
}

/** A slot as a handle: `const release = holdSilence(); … release()`. The
 *  handle is idempotent, so a double release can never drop someone else's. */
export const holdSilence = (): (() => void) => {
  suspendAllAudio()
  let released = false
  return () => {
    if (released) return
    released = true
    resumeAllAudio()
  }
}

/** True while anything holds a slot. SFX entry points refuse new one-shots
 *  while this is true, so nothing starts under an ad in the first place. */
export const isAudioSuspended = (): boolean => depth > 0

// ─── One-shots ──────────────────────────────────────────────────────────────

/** Register an in-flight one-shot voice (buffer source OR oscillator) so
 *  `killOneShotSfx()` can stop it. Removes itself when it ends. */
export const registerOneShotSource = (source: AudioScheduledSourceNode): void => {
  oneShots.add(source)
  try { source.addEventListener('ended', () => oneShots.delete(source), { once: true }) } catch { /* fake */ }
}

/**
 * Hard-stop every in-flight one-shot so nothing tails into an ad. Suspending
 * only FREEZES a Web Audio voice — it would thaw and finish after the ad,
 * seconds late. Also pauses non-looping elements (the decode-fallback SFX) and
 * forgets them, so the release cannot replay them. Loops (the music, the scene's
 * whirs) are left to their owners, who restart them properly.
 */
export const killOneShotSfx = (): void => {
  for (const s of [...oneShots]) {
    try { s.stop() } catch { /* already ended */ }
    oneShots.delete(s)
  }
  for (const [el, st] of [...elements]) {
    if (el.loop) continue
    st.resumeOnRelease = false
    rejectElementWaiters(st)
    if (!el.paused) guardPause(el)
    // A killed one-shot never fires `ended`, so nothing else would ever drop
    // it. If its owner plays it again, the play hook tracks it afresh.
    elements.delete(el)
  }
}

// ─── The hooks ──────────────────────────────────────────────────────────────

const REAL = '__bcAudioGuardReal'
const ORIG = '__bcAudioGuardOrig'

type AnyFn = (...args: unknown[]) => unknown
type Patched = Record<string, AnyFn | undefined>

const patchContextPrototype = (proto: Record<string, unknown> | undefined): void => {
  // Owned by this module's own `wrapContextConstructor` call if marked: the
  // install path always unpatches first, so a mark here is our own.
  if (!proto || proto[ORIG]) return
  const resume = proto.resume as AnyFn | undefined
  const suspend = proto.suspend as AnyFn | undefined
  if (typeof resume !== 'function' || typeof suspend !== 'function') return
  proto[ORIG] = { resume, suspend } satisfies Patched
  proto.resume = function (this: AudioContext, ...args: unknown[]) {
    const st = contexts.get(this)
    if (internal || !st) return resume.apply(this, args)
    if (depth === 0) return trackedResume(this, st, () => resume.apply(this, args) as Promise<void> | undefined)
    // Silenced: remember the wish, settle when the hold lets go.
    st.resumeOnRelease = true
    return new Promise<void>((res) => st.waiters.push(res))
  }
  proto.suspend = function (this: AudioContext, ...args: unknown[]) {
    const st = contexts.get(this)
    // The owner wants it asleep: that outranks a resume it asked for earlier.
    if (st && !internal && depth > 0) {
      st.resumeOnRelease = false
      settleContextWaiters(st)
    }
    return suspend.apply(this, args)
  }
}

const unpatchContextPrototype = (proto: Record<string, unknown> | undefined): void => {
  const orig = proto?.[ORIG] as Patched | undefined
  if (!proto || !orig) return
  proto.resume = orig.resume
  proto.suspend = orig.suspend
  delete proto[ORIG]
}

const wrapContextConstructor = (name: 'AudioContext' | 'webkitAudioContext'): void => {
  const w = window as unknown as Record<string, unknown>
  const current = w[name] as (AnyFn & Record<string, unknown>) | undefined
  if (typeof current !== 'function') return
  const Real = (current[REAL] as AnyFn | undefined) ?? current
  patchContextPrototype((Real as unknown as { prototype?: Record<string, unknown> }).prototype)
  if (current[REAL]) return // already ours
  const Guarded = function (...args: unknown[]): AudioContext {
    const ctx = Reflect.construct(Real as unknown as new (...a: unknown[]) => AudioContext, args) as AudioContext
    trackAudioContext(ctx)
    return ctx
  } as unknown as AnyFn & Record<string, unknown>
  Guarded.prototype = (Real as unknown as { prototype: unknown }).prototype
  Guarded[REAL] = Real
  w[name] = Guarded
}

const unwrapContextConstructor = (name: 'AudioContext' | 'webkitAudioContext'): void => {
  const w = window as unknown as Record<string, unknown>
  const current = w[name] as (AnyFn & Record<string, unknown>) | undefined
  const Real = current?.[REAL] as (AnyFn & { prototype?: Record<string, unknown> }) | undefined
  if (!Real) return
  unpatchContextPrototype(Real.prototype)
  w[name] = Real
}

/** The prototype play/pause the hooks delegate to, looked up at CALL time so a
 *  test (or a QA probe) that swaps `HTMLMediaElement.prototype.play` later is
 *  still the thing that runs. */
const basePlay = (el: HTMLMediaElement): Promise<void> =>
  (Object.getPrototypeOf(HTMLAudioElement.prototype) as HTMLMediaElement).play.call(el)
const basePause = (el: HTMLMediaElement): void =>
  (Object.getPrototypeOf(HTMLAudioElement.prototype) as HTMLMediaElement).pause.call(el)

const patchAudioElements = (): void => {
  if (typeof HTMLAudioElement === 'undefined') return
  const proto = HTMLAudioElement.prototype as unknown as Record<string, unknown>
  if (Object.prototype.hasOwnProperty.call(proto, ORIG)) return
  proto[ORIG] = {
    play: Object.prototype.hasOwnProperty.call(proto, 'play') ? proto.play as AnyFn : undefined,
    pause: Object.prototype.hasOwnProperty.call(proto, 'pause') ? proto.pause as AnyFn : undefined
  } satisfies Patched
  proto.play = function (this: HTMLAudioElement): Promise<void> {
    registerHtmlAudio(this)
    if (internal || depth === 0) return basePlay(this)
    // Silenced: this element will play when the hold lets go — not now.
    const st = elements.get(this)!
    st.resumeOnRelease = true
    return new Promise<void>((resolve, reject) => st.waiters.push({ resolve, reject }))
  }
  proto.pause = function (this: HTMLAudioElement): void {
    const st = elements.get(this)
    // The owner stopped it: it must not come back when the hold lets go.
    if (st && !internal && depth > 0) {
      st.resumeOnRelease = false
      rejectElementWaiters(st)
    }
    return basePause(this)
  }
}

const unpatchAudioElements = (): void => {
  if (typeof HTMLAudioElement === 'undefined') return
  const proto = HTMLAudioElement.prototype as unknown as Record<string, unknown>
  const orig = proto[ORIG] as Patched | undefined
  if (!orig) return
  if (orig.play) proto.play = orig.play
  else delete proto.play
  if (orig.pause) proto.pause = orig.pause
  else delete proto.pause
  delete proto[ORIG]
}

let installed = false

/**
 * Install the page-level hooks. Idempotent; called at boot on every build (from
 * `installGamePauseAudio`, which `main.ts` and `useAds` both run before any
 * sound can play), so a source created anywhere afterwards is covered.
 */
export const installAudioGuard = (): void => {
  if (installed || typeof window === 'undefined') return
  installed = true
  // A previous copy of this module (Vite HMR, a test's module reset) may own
  // the hooks, pointing them at ITS registry. The newest copy takes over, or
  // contexts made from here on would be tracked where nothing looks.
  unwrapContextConstructor('AudioContext')
  unwrapContextConstructor('webkitAudioContext')
  unpatchAudioElements()
  wrapContextConstructor('AudioContext')
  wrapContextConstructor('webkitAudioContext')
  patchAudioElements()
}

/** Test seam: remove the hooks again. */
export const uninstallAudioGuard = (): void => {
  if (!installed || typeof window === 'undefined') return
  installed = false
  unwrapContextConstructor('AudioContext')
  unwrapContextConstructor('webkitAudioContext')
  unpatchAudioElements()
}

/** Debug/QA snapshot of everything the guard holds. */
export const __audioGuardSnapshot = () => ({
  depth,
  contexts: [...contexts.keys()].map((c) => c.state),
  elements: [...elements.keys()].map((e) => ({ paused: e.paused, loop: e.loop })),
  oneShots: oneShots.size
})
