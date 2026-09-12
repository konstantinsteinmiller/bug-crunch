/**
 * ─── The recording seam ─────────────────────────────────────────────────────
 *
 * DEV ONLY, and the whole file resolves to `'off'` in every build a player ever
 * loads. `tools/preview-video` drives the REAL game through this — the real
 * renderer, the real save, the real sim — and records it frame by frame. See
 * that folder's `CONTRACT.md`, and the skill's SKILL.md Phase 0.1.
 *
 * ── Two levers, both switched from the URL ──
 *
 *   ?feed=preview   the marketing cut. The recorder hides the DOM (the HUD, the
 *                   buttons, the banners, the result screen) on its own; this
 *                   switches off what the RENDERER paints that is a readout
 *                   rather than the game — floating damage numbers, the health
 *                   bars over crates and barricades, the off-screen elite
 *                   marker. The numbers on the gate leaves STAY: "×3" over a
 *                   doorway is the thing this genre is sold on, and a portal's
 *                   ban on "promotional text" is not a ban on the game's own
 *                   playfield.
 *
 *   ?feed=pure      everything above, and the RECORDER additionally no-ops
 *                   `fillText` / `strokeText` for the whole page, which takes
 *                   the gate values and the crate health with it — for a spec
 *                   that demands "no hardcoded text, score counters,
 *                   watermarks, UI or logos". The crowd's own size is then the
 *                   only score on screen, which — for a crowd runner — is
 *                   enough. Nothing in this file has to do that job: every
 *                   number the world paints is drawn with canvas text, so the
 *                   recorder's own lever reaches all of them at once
 *                   (`preview.config.mjs`, `clean.suppressCanvasText`).
 *
 * ── Why it is resolved once, at module load ──
 *
 * `drawScene` reads these on every drawable on every frame. A URL parse (or a
 * reactive read) in that loop would cost the game something real to serve a
 * flag no player ever sets.
 *
 * ── The scripting handle ──
 *
 * `installPreviewSeam()` publishes `window.__preview` — the simulation module,
 * the effect queue and a pause the recorder can hold while it stages a run.
 * It is DEV-only and inert unless `?preview=1` (or a `?feed=`) asked for it, so
 * nothing here is a surface a portal build can reach. The alternative —
 * `window.__run` behind the
 * `cheat` localStorage flag — also turns on the keyboard cheats and only
 * appears after a dynamic import has resolved, which a recorder cannot wait on
 * deterministically.
 */

export type FeedLevel = 'off' | 'preview' | 'pure'

const params = (): URLSearchParams | null => {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null
  try {
    return new URLSearchParams(window.location.search)
  } catch {
    return null
  }
}

const readFeed = (): FeedLevel => {
  const raw = params()?.get('feed')
  return raw === 'preview' || raw === 'pure' ? raw : 'off'
}

/** The level asked for, resolved once. `'off'` in every player's session. */
export const FEED: FeedLevel = readFeed()

/** Recording. Anything that is a READOUT rather than the world is off. */
export const FEED_ON = FEED !== 'off'

/**
 * Publish the scripting handle.
 *
 * DELIBERATELY a different flag from the feed. `--no-clean` records the game
 * exactly as a player sees it — HUD, damage numbers, health bars — and that
 * take still has to be DRIVEN, so `?preview=1` rides on every recording URL
 * while `?feed=` rides only on the clean ones. Tying the two together cost a
 * take: `--no-clean` dropped the feed parameter, the seam was never published,
 * and `boot()` sat waiting for a handle that was never coming.
 */
export const SEAM_ON: boolean = FEED_ON || params()?.get('preview') === '1'

/**
 * Hide the renderer's own readouts: floating damage numbers, the health bars
 * over breakables and foes, the elite's screen-edge marker. True for both
 * levels — they are interface in either cut. The numbers painted ON the world
 * (a gate's value, a crate's HP) are not: they are what the genre is sold on,
 * and `pure` takes them out through the recorder instead.
 */
export const HIDE_READOUTS = FEED_ON

/** The shape published on `window.__preview`. */
export interface PreviewSeam {
  feed: FeedLevel
  game: typeof import('@/use/useSurvivalGame')
  vfx: typeof import('@/use/useVfx')
  /** The painted-art layer and its want lists — a recording holds until every
   *  painting the stage can ask for has decoded, or the clip would swap from
   *  the drawing to the painting mid-shot. */
  art: typeof import('@/game/art')
  artPreload: typeof import('@/game/artPreload')
  /** The save blob. A recorder that plays a stage twice — once unrendered, to
   *  find out when the boss dies, and once for the camera — has to put the
   *  bookkeeping of the first run back: a clear winds the autobalancer up and
   *  moves the resume stage, and the take would then be a different fight. */
  state: typeof import('@/use/useTowerState')
  /** Freeze the scene's simulation while a run is staged, and let it go again.
   *  Refcount-safe: it holds at most one app pause at a time. */
  hold: (on: boolean) => void
  /** True while `hold(true)` is in force. */
  held: () => boolean
  /** The result screen's own two buttons, so a clip can end in motion rather
   *  than on a frozen road behind a hidden overlay. */
  next: () => void
  retry: () => void
}

/**
 * Publish the seam. Called once from the scene's `onMounted`; a no-op unless
 * `?preview=1` (or a `?feed=`) is set, and compiled out of production by
 * `import.meta.env.DEV`.
 *
 * The modules are reached through a DYNAMIC import for the same reason
 * `useCheats` does it: a static one would pull the simulation and the effect
 * queue into whatever chunk this file lands in.
 */
export const installPreviewSeam = (
  scene: { next: () => void; retry: () => void }
): void => {
  if (!SEAM_ON) return
  void Promise.all([
    import('@/use/useSurvivalGame'),
    import('@/use/useVfx'),
    import('@/use/useGamePause'),
    import('@/game/art'),
    import('@/game/artPreload'),
    import('@/use/useTowerState')
  ]).then(([game, vfx, pause, art, artPreload, state]) => {
    let release: (() => void) | null = null
    const seam: PreviewSeam = {
      feed: FEED,
      game,
      vfx,
      art,
      artPreload,
      state,
      hold: (on: boolean): void => {
        if (on) release ??= pause.acquireAppPause()
        else {
          release?.()
          release = null
        }
      },
      held: (): boolean => release !== null,
      next: scene.next,
      retry: scene.retry
    }
    ;(window as unknown as Record<string, unknown>).__preview = seam
    console.warn(`[preview] window.__preview is live (feed=${FEED}).`)
  })
}
