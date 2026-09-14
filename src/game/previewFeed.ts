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
 *                   rather than the world — the boss tell and the objective
 *                   call-out. The COMIC WORDS stay: SQUISH! over a flattened
 *                   beetle is the thing this game is sold on, it is painted on
 *                   the playfield rather than in a corner, and a portal's ban on
 *                   "promotional text" is not a ban on a game's own art.
 *
 *   ?feed=pure      everything above, and the RECORDER additionally no-ops
 *                   `fillText` / `strokeText` for the whole page, which takes
 *                   the comic words with it — for a spec that demands "no
 *                   hardcoded text, score counters, watermarks, UI or logos".
 *                   What is left is a shoe, a floor and a great many bugs
 *                   bursting, which for this game is enough. Nothing in this
 *                   file has to do that job: every word the world paints is
 *                   drawn with canvas text, so the recorder's own lever reaches
 *                   all of them at once (`preview.config.mjs`,
 *                   `clean.suppressCanvasText`).
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
 * exactly as a player sees it — HUD, chain badge, objective rail — and that
 * take still has to be DRIVEN, so `?preview=1` rides on every recording URL
 * while `?feed=` rides only on the clean ones. Tying the two together cost a
 * take: `--no-clean` dropped the feed parameter, the seam was never published,
 * and `boot()` sat waiting for a handle that was never coming.
 */
export const SEAM_ON: boolean = FEED_ON || params()?.get('preview') === '1'

/**
 * Hide the renderer's own readouts: the boss tell, the objective call-out, the
 * off-screen alert markers. True for both levels — they are interface in either
 * cut. The comic words painted ON the world are not: they are what this game is
 * sold on, and `pure` takes them out through the recorder instead.
 */
export const HIDE_READOUTS = FEED_ON

/** The shape published on `window.__preview`. */
export interface PreviewSeam {
  feed: FeedLevel
  game: typeof import('@/use/useBugCrunchGame')
  vfx: typeof import('@/use/useVfx')
  /** The painted-art layer and its want lists — a recording holds until every
   *  painting the level can ask for has decoded, or the clip would swap from
   *  the drawing to the painting mid-shot. */
  art: typeof import('@/game/art')
  artPreload: typeof import('@/game/artPreload')
  /** The save blob. A recorder that plays a level twice — once unrendered, to
   *  find out when the vial fills, and once for the camera — has to put the
   *  bookkeeping of the first run back: a clear moves the resume level, banks
   *  stars and coins, and clears the failure record that hands out relief, so
   *  the take would be a measurably different level from the one measured. */
  state: typeof import('@/use/useBugCrunchState')
  /** Freeze the scene's simulation while a run is staged, and let it go again.
   *  Refcount-safe: it holds at most one app pause at a time. */
  hold: (on: boolean) => void
  /** True while `hold(true)` is in force. */
  held: () => boolean
  /** The result screen's own two buttons, so a clip can end in motion rather
   *  than on a frozen board behind a hidden overlay. */
  next: () => void
  retry: () => void
  /**
   * Open a level outright — the scene's own `startLevel`.
   *
   * The two buttons above are what a PLAYER presses, and both of them read a
   * result summary to decide which level they mean. A recorder that wants to
   * open on 3-7 has no summary, so it gets the scene's own entry point: the
   * board is re-synced, the effects and the art are reset, the shoe and the
   * difficulty are re-read, and the level banner runs — exactly as it does
   * between two levels of a real session.
   */
  play: (level: number) => void
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
  scene: { next: () => void; retry: () => void; play: (level: number) => void }
): void => {
  if (!SEAM_ON) return
  void Promise.all([
    import('@/use/useBugCrunchGame'),
    import('@/use/useVfx'),
    import('@/use/useGamePause'),
    import('@/game/art'),
    import('@/game/artPreload'),
    import('@/use/useBugCrunchState')
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
      retry: scene.retry,
      play: scene.play
    }
    ;(window as unknown as Record<string, unknown>).__preview = seam
    console.warn(`[preview] window.__preview is live (feed=${FEED}).`)
  })
}
