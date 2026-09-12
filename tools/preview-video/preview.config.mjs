/**
 * ─── Survivalist preview-video configuration ────────────────────────────────
 *
 *   pnpm preview:video                          # every format, both scenarios
 *   pnpm preview:video --formats 10s            # one deliverable
 *   pnpm preview:video --formats crazygames     # the portal cut
 *   pnpm preview:video --scenarios success      # one scenario, every format
 *   pnpm preview:video --url-param feed=pure    # a fully TEXTLESS cut (below)
 *   pnpm preview:video --no-clean               # with the whole HUD on
 *   pnpm preview:video --only-setup             # stop on the opening frame
 *   pnpm preview:video --help
 *
 * Output, one folder per quality — each a complete, uniformly named set:
 *
 *   preview-videos/lossless/<scenario>-<format>-<orientation>-<W>x<H>.mp4 (+ .png poster)
 *   preview-videos/high/…     the same clips as upload-ready H.264 4:2:0
 */

/**
 * ── The two cuts ──
 *
 * `feed=preview` (the default) hides the HUD and the renderer's own readouts —
 * floating damage numbers, health bars, the elite's screen-edge marker — and
 * KEEPS the numbers painted on the world: the `×3` over a doorway and the HP on
 * a crate. A crowd runner is sold on exactly those, and no portal rule this
 * game ships against forbids the game's own playfield (CrazyGames bans logos,
 * promotional text, cursors and black bars — see the skill's
 * reference/portal-specs.md).
 *
 * `--url-param feed=pure` is the cut for a spec that says "no hardcoded text,
 * score counters, watermarks, UI or logos": the same feed, plus the recorder's
 * `fillText`/`strokeText` no-op over the whole page. Every number in this game
 * is canvas text, so that one lever reaches all of them — which is why the two
 * cuts are one URL parameter apart and why the game-side flag has no second
 * level (`src/game/previewFeed.ts`).
 *
 * Sniffed out of argv because `suppressCanvasText` is a config field rather
 * than a flag, and the two halves of the pure cut must never disagree: a run
 * with the game's `pure` flag but the recorder's text still on would ship a
 * clip that is only half textless.
 */
const PURE = process.argv.join(' ').includes('feed=pure')

export default {
  // The port-ownership check. Twenty-odd games in this folder run their dev
  // server on 2050 and every one of them answers a fetch perfectly happily.
  title: 'Survivalist',

  // The DEV server, not a production build: `window.__preview` and the feed
  // flag are both `import.meta.env.DEV` only.
  //
  // Port 2067 is this pipeline's own — 2050 is `pnpm dev` (and every other
  // game's), 2063 is glyphyx's recorder. Colliding with a running dev server
  // costs somebody their session, and colliding with ANOTHER GAME's costs you
  // a recording of their game (which is what `title` above catches).
  server: {
    mode: 'dev',
    port: 2067,
    command: 'pnpm',
    args: ['exec', 'vite', '--port', '{port}', '--strictPort'],
    env: {
      // `.env` points the board at the PRODUCTION worker and its origin list is
      // open, so a localhost run posts real entries — a recorded run clears
      // stages and would put "Runner…" rows on the live leaderboard. An
      // unreachable endpoint switches `reportRun` off at the source without
      // depending on an empty env var surviving a Windows spawn. Port 9 is
      // discard; nothing listens, the fetch fails immediately, and the board
      // falls back to its baked snapshot (which nothing records anyway).
      VITE_LEADERBOARD_URL: 'http://localhost:9/leaderboard-off-while-recording'
    },
    // The recording page never hears hot reload. Another session works in this
    // repo constantly (art exports land in `public/`), and one of those writes
    // in the middle of a 900-frame capture navigates the page out from under
    // the frame loop.
    hotReload: false
  },

  // ── The deliverables ──
  //
  // Sizes are output PIXELS; the game sees width/dpr × height/dpr CSS px.
  //
  // THE DPR CAP: `GameScene.resize()` clamps the canvas at
  // `min(devicePixelRatio, 2)` on the high tier. Every orientation here is
  // therefore dpr 2 — ask for 1080x1920 at dpr 3 and the canvas would be
  // 720x1280 upscaled by the browser, i.e. a soft 1080p. 1080x1920 at dpr 2 is
  // a 540x960 CSS viewport, which is a phone.
  formats: {
    '10s': {
      durationMs: 10_000,
      orientations: {
        portrait: { width: 720, height: 1280, dpr: 2, isMobile: true, hasTouch: true },
        landscape: { width: 1280, height: 720, dpr: 2, isMobile: false, hasTouch: false }
      }
    },

    // MP4 · H.264 · 30 s · 1920x1080 + 1080x1920. A different STORY, not a
    // longer one: the whole back half of a stage, gates through boss.
    '30s': {
      durationMs: 30_000,
      orientations: {
        portrait: { width: 1080, height: 1920, dpr: 2, isMobile: true, hasTouch: true },
        landscape: { width: 1920, height: 1080, dpr: 2, isMobile: false, hasTouch: false }
      },
      scenarios: { success: 'success-30s', fail: 'fail-30s' }
    },

    // CrazyGames: "15-20 seconds maximum", 1080p landscape 16:9 AND portrait
    // 2:3 — 1080x1620, NOT 9:16 — 50 MB cap, no sound. `high` only: a lossless
    // 16 s 1080p master is far past the cap and is not what gets uploaded.
    // docs.crazygames.com/requirements/game-covers/
    crazygames: {
      durationMs: 16_000,
      // `high` is the upload; `balanced` rides along because a second encoder
      // on the same captured frames is nearly free, it halves the file if a
      // bitrate cap ever turns up — and because a format with only ONE quality
      // writes into the output root instead of a folder, which would leave the
      // portal cuts sitting somewhere different from every other deliverable.
      quality: ['high', 'balanced'],
      orientations: {
        landscape: { width: 1920, height: 1080, dpr: 2, isMobile: false, hasTouch: false },
        portrait: { width: 1080, height: 1620, dpr: 2, isMobile: true, hasTouch: true }
      }
    },

    // Poki's animated thumbnail: 1:1, "4 to 6 seconds", "50fps or higher",
    // muted, 100 MB. Square is its own orientation, so it gets a `--square
    // WxH` flag for free. Keep the action centred — the square crop is what the
    // player sees and it trims the edges of everything else.
    // developers.poki.com/guide/your-game-page
    poki: {
      durationMs: 5_000,
      fps: 60,
      quality: ['high', 'balanced'],
      orientations: {
        square: { width: 1080, height: 1080, dpr: 2, isMobile: true, hasTouch: true }
      }
    }
  },

  scenarios: ['success', 'fail'],

  fps: 30,
  // Two files from ONE capture. `lossless` (qp 0, yuv444p) is the archive —
  // Safari and QuickTime refuse 4:4:4 and every portal validator is stricter
  // still; `high` (crf 14, yuv420p) is the upload.
  quality: ['lossless', 'high'],
  outDir: 'preview-videos',
  capture: 'virtual',

  // The clock pins WHEN each frame is sampled; this pins WHAT is drawn in it.
  // This game pulls `Math.random` for muzzle flashes, blood, coin spray, crowd
  // jitter and every spawn scatter — hundreds of times a frame in a firefight.
  // `_drive.mjs` re-seeds from this value again at the top of every take, after
  // the real-time staging has burned an unknowable number of draws.
  seedRandom: 7,

  clean: {
    enabled: true,
    // The arena canvas by name. `canvas` alone would also keep the coin-badge
    // and share-card canvases the HUD mounts.
    keep: ['canvas.scene__canvas'],
    // FALSE for the default cut: the gate values are the story. `--url-param
    // feed=pure` flips both halves together — see PURE above.
    suppressCanvasText: PURE,
    urlParams: { feed: PURE ? 'pure' : 'preview' }
  },

  urlParams: {
    // The scripting handle (`window.__preview`), on EVERY recording URL — a
    // `--no-clean` take is driven the same way a clean one is. The feed flag
    // below is the separate half: it decides what the renderer hides.
    preview: '1',
    // Pin the quality ladder. It is a downgrade-only ratchet driven by a
    // rolling FPS average, and a recorder that spends 200 ms of wall time on
    // every frame is exactly the workload that trips it — without the pin, a
    // take can drop to `low` mid-clip, which RESIZES the canvas and re-bakes
    // every sprite on screen. It also decides the DPR cap the sizes above are
    // chosen against.
    tier: 'high',
    // The painted art, explicitly rather than by inheriting `.env`. `?art=`
    // persists to localStorage, which is per-context and thrown away with the
    // browser, so this never leaks into a hand-run dev session.
    art: 'on'
  },

  async onPageReady() { /* the scenarios boot the game themselves — see _drive.mjs */ }
}
