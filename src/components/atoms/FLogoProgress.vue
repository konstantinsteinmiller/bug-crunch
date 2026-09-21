<template lang="pug">
  Transition(name="splash-fade")
    div.splash-backdrop.no-os-ui(v-if="!backdropHidden")
      //- The panning tile — the same layer the static splash draws, on the
      //- same clock (see `adoptAnimationClock`), so it keeps drifting through
      //- the handover instead of jumping back to where it started.
      div.backdrop-tiles(ref="tilesEl" :style="tileStyle" aria-hidden="true")

  //- The loading read-out only renders during the loading sequence. Once `done`
  //- flips true (progress = 100% AND the joke's punchline has landed, OR the 8s
  //- fallback fires) it fades out and
  //- unmounts — it deliberately does NOT shrink to the top-left corner like the
  //- previous splash flow.
  //-
  //- ─── The greeting ─────────────────────────────────────────────────────────
  //-
  //- What used to be here was Tower Siege's: three stacked blocks pulsing in
  //- sequence, carried over with the splash flow along with its wordmark. A
  //- loading spinner tells a first-time player nothing except that they are
  //- waiting, and the splash is the ONE moment every player sees before they
  //- decide whether to stay.
  //-
  //- So it is a joke instead, and the joke is the game. The ant waving on the
  //- card is the crumb thief cutscene 01 opens on, and the one thing this game
  //- does to ants is stomp them — so a stomp comes for it. The stomp ring and
  //- the foot's shadow close in round it ("Uh-oh!"), the sneaker slams down,
  //- and the ant is already out from under it, back on its spot, taunting
  //- ("Missed me!").
  //-
  //- That buys two things in the seconds before the game starts. It teaches the
  //- one read the whole game runs on — a ring and a shadow closing in mean a
  //- foot is about to land THERE — with the game's own ring, shadow and shoe,
  //- before the player has touched anything. And it gives the player a cheeky
  //- little rival rather than a victim: nobody is squished on the splash, and
  //- the ant that taunted you is the one that steals your lunch a moment later.
  //-
  //- The composition is a greeting card — ant and bubble on top, the mark under
  //- both — and it is duplicated (ant + mark, nothing else) as the inline static
  //- splash in `index.html`, so the handover from static HTML to this component
  //- is one continuous picture with the gag starting on top of it rather than a
  //- swap between two different screens.
  Transition(name="loader-fade")
    div.no-os-ui(
      v-if="!done"
      class="fixed z-[200] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
    )
      //- The beat is on the whole card, not just the stage, because the stomp
      //- lands on the whole card: the logo and the read-out take the thump too.
      div.greet(:class="`is-${phase}`" :style="gagStyle")
        //- The gag's stage. Nothing in it is in normal flow: the ant, the stomp
        //- and the bubble are all pinned, so the bubble growing from one line to
        //- the other (much longer in some locales) cannot nudge the ant.
        //-
        //- Stacked the way the game stacks them: the foot's shadow UNDER the
        //- bug, the shoe OVER it, and the ring over everything, because the ring
        //- is not part of the world — it is the game saying where the foot lands.
        div.greet-stage
          div.landing(aria-hidden="true")
            div.stomp-shadow

          //- Three layers, one motion each, so no beat ever restarts another's:
          //- the box carries the dodge, the float never stops, and the picture
          //- itself trembles or giggles. The float is the layer the static
          //- splash also draws, and the one whose clock is adopted at handover.
          div.greeter(aria-hidden="true")
            div.greeter-float(ref="floatEl")
              img.greeter-img(:src="MASCOT_SRC" alt="" decoding="async" fetchpriority="high")

          div.landing(aria-hidden="true")
            img.stomp-shoe(:src="SHOE_SRC" alt="" decoding="async")
            div.stomp-puff
            svg.stomp-ring(viewBox="0 0 100 86")
              ellipse.stomp-ring-under(cx="50" cy="43" rx="47" ry="40")
              ellipse.stomp-ring-dash(cx="50" cy="43" rx="47" ry="40")

          //- One bubble, re-keyed per beat: the key is what replays the pop, and
          //- `out-in` is deliberately NOT used — coming round again, the "Uh-oh!"
          //- grows over the taunt as it goes, which reads as the ant's grin
          //- dropping the moment it sees the ring again.
          Transition(name="bubble-pop")
            div.bubble(v-if="bubbleKey" :key="phase")
              span.bubble-text {{ t(bubbleKey) }}

        div.greet-logo
          img(:src="LOGO_SRC" :alt="t('gameName')" decoding="async" fetchpriority="high")

        span(class="percentage-text text-shadow text-amber-500") {{ Math.round(progress) }}%

        Transition(name="hint-fade")
          div.stuck-hint(v-if="showStuckHint") {{ t('loading.tooLong') }}
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import useAssets, { releaseSplash } from '@/use/useAssets'
import { stopLoading } from '@/use/useCrazyGames'
import { armFirstLoadInterstitial, notifySplashGone } from '@/use/useFirstLoadInterstitial'
import { prependBaseUrl } from '@/utils/function'
import { ART_BRAND } from '@/game/artCatalogue'
import { ART_FOLDERS } from '@/game/art'
import { LIFT_SCALE, SHOE_BOX, SHOE_FRAC } from '@/game/footArt'
import { STARTER_SHOE } from '@/game/shoes'

const { t } = useI18n()

// ─── The greeting's bitmaps ─────────────────────────────────────────────────
//
// Read straight off disk rather than through `spriteFor`. The art-override
// layer is a GAMEPLAY switch — it ships OFF on the portals so a missing paint
// never shows up in a QA console as a 404 — and the splash is not optional: it
// must be the same picture on every build. These two files are in `public/`,
// they are always there, and the static splash in `index.html` has already
// asked for both by the time this component mounts, so both are cache hits.
//
// The cost is ~60 KB on the boot path, spent while the sprite bake (which is
// what the loading bar is actually waiting for) does its several seconds of
// work. It is the only thing the player looks at in that window.
//
// The two paths come from `ART_BRAND` rather than being typed here, because they
// are also manifest slots: the art pipeline paints both and the slicer writes
// over exactly these files. Spelling them out in a third place (after the
// manifest and the static splash in `index.html`) is how a repaint lands on disk
// and never reaches the screen.
const MASCOT_SRC = prependBaseUrl(ART_BRAND.mascot)
const LOGO_SRC = prependBaseUrl(ART_BRAND.logo)

/**
 * The shoe that comes down on the greeter: the starter sneaker, the shoe every
 * first-time player is wearing, from the file the renderer's own `spriteFor`
 * reads — so a repaint of the sneaker lands here too. By path rather than
 * through `spriteFor` for the same reason as the two above: the splash must not
 * depend on the art switch.
 *
 * The static splash does not ask for this one. It is ~6 KB and not needed until
 * the first stomp, more than a second after mount; if it has still not arrived
 * by then, the ring, the shadow and the dodge tell the joke without it.
 */
const SHOE_SRC = prependBaseUrl(`${ART_FOLDERS.shoe}/${STARTER_SHOE}.webp`)

// ─── The gag's clock ────────────────────────────────────────────────────────
//
// The ant floats alone, then a loop of three beats: the stomp closes in
// ("Uh-oh!"), the shoe comes down and misses, the ant taunts ("Missed me!").
//
// `LURK_MS` is a floor, not a dramatic pause. The static splash takes 400 ms to
// fade out (see `onMounted`, and `#static-splash` in `index.html`) and sits at a
// HIGHER z-index than this component the whole time, so anything staged before
// that finishes is staged behind it and is simply never seen. This is that fade
// plus a small margin.
//
// The splash does not clear until the taunt has landed — see
// `PUNCHLINE_READ_MS` — because a splash that resolves on the threat alone
// shows an ant about to be squished and never the half that makes it likeable.
// That makes these numbers a cost: on any load faster than the joke, every
// millisecond of staging is a millisecond before the game, for every player. So
// the beats stay as tight as they can and still read.
const LURK_MS = 500
/** The ring snaps round the ant and the shadow tightens on it, which is the
 *  foot coming down. Long enough to read, short enough that it is a stomp and
 *  not a hover. */
const LOOM_MS = 1000
/** The shoe drops, lands, holds and lifts, and the ant is out from under it.
 *  The styles hang every moment inside it off this one number — the landing is
 *  at 20 %, see `.stomp-shoe` — so change it here and nowhere else. */
const STOMP_MS = 650
/** The taunt's turn. Longer than the threat — a load can run 8 s, and a gag
 *  that re-stomps every second stops being funny and starts being a strobe. */
const TEASE_MS = 2800
/**
 * How long the FIRST taunt has to be up before the splash may clear: the ant
 * back on its spot and "Missed me!" popped and read. A load that finishes
 * before then waits for it, so the joke plays in full at least once before the
 * game begins; a load that takes longer is not held at all.
 *
 * On a load faster than the joke that puts the splash at LURK + LOOM + STOMP +
 * this ≈ 3 s after mount, and the fade-out happens mid-giggle, on the
 * punchline.
 */
const PUNCHLINE_READ_MS = 900

/** The clock, handed to the styles, so the keyframes cannot drift off it. */
const gagStyle = {
  '--loom': `${LOOM_MS}ms`,
  '--stomp': `${STOMP_MS}ms`,
  // The shoe on the splash is the shoe on the board: the same width against its
  // own ring, the same stomp point, the same growth when raised. Handed over as
  // the constants rather than copies of their values, so a change to how the
  // renderer draws the foot cannot leave the splash drawing a different one.
  '--shoe-w': `${SHOE_FRAC * SHOE_BOX.w * 50}%`,
  '--shoe-toe': `${SHOE_BOX.toeFromTop * 100}%`,
  '--shoe-lift': `${1 + LIFT_SCALE}`
}

const floatEl = ref<HTMLElement | null>(null)
const tilesEl = ref<HTMLElement | null>(null)

/**
 * The backdrop tile, by URL rather than as a bundled import.
 *
 * It lives in `public/` because the static splash in `index.html` names it
 * too, and by the time this component mounts the browser has already fetched
 * and decoded it for that layer — so the layer taking over here is drawn from
 * the cache in its first frame. Generated from the game's own paintings by
 * `pnpm art:bg-tile`.
 */
const tileStyle = { backgroundImage: `url(${prependBaseUrl('images/bg/bg-tile_800x800.webp')})` }

/**
 * Hand the static splash's animations over to this one, mid-stride.
 *
 * The two are the same picture at the same size, and for the 400 ms the static
 * splash spends fading out they are both on screen — so if their floats are at
 * different points, the crossfade shows the ant twice, tilted one way and
 * bobbing in two places at once. Which
 * they WILL be: one started when the browser parsed `index.html`, the other
 * when Vue mounted, and the gap between those is the whole module graph.
 *
 * The fix is not a shared clock but a copied one: `getAnimations()` hands back
 * the live CSS animations on both elements, and `currentTime` is writable, so
 * the new pair is simply set to wherever the old pair had got to. Wrapped
 * because `getAnimations` is the kind of API a stripped-down webview inside a
 * portal's app can be missing, and a frame pop is not worth a boot failure.
 */
const adoptAnimationClock = (from: Element | null | undefined, to: Element | null): void => {
  if (!from || !to || typeof from.getAnimations !== 'function') return
  const was = from.getAnimations()
  const now = to.getAnimations()
  for (let i = 0; i < Math.min(was.length, now.length); i++) {
    const t = was[i]?.currentTime
    if (t !== null && t !== undefined) now[i]!.currentTime = t
  }
}

type GreetPhase = 'lurk' | 'loom' | 'stomp' | 'tease'
type GagBeat = Exclude<GreetPhase, 'lurk'>
const phase = ref<GreetPhase>('lurk')
let greetTimerId: number | null = null

/** Each beat's length and the beat after it. The loop never goes back to
 *  `lurk` — that is only the wait for the static splash to clear. */
const BEATS: Record<GagBeat, { hold: number; next: GagBeat }> = {
  loom: { hold: LOOM_MS, next: 'stomp' },
  stomp: { hold: STOMP_MS, next: 'tease' },
  tease: { hold: TEASE_MS, next: 'loom' }
}

/** What the ant says on each beat. Nothing while the shoe is down: the landing
 *  is the joke's one silent moment, and a word over it would step on it. */
const BUBBLES: Partial<Record<GreetPhase, string>> = {
  loom: 'loading.uhOh',
  tease: 'loading.missed'
}
const bubbleKey = computed(() => BUBBLES[phase.value] ?? null)

/** The first taunt has been on screen for `PUNCHLINE_READ_MS`. Once true it
 *  stays true: the joke has to land once, not on every loop. */
const punchlineLanded = ref(false)
let punchlineTimerId: number | null = null

/** Advance the gag, then schedule the next beat. Loops for as long as the
 *  splash is up, which is at least until the first taunt has landed. */
const runGreeting = (next: GagBeat): void => {
  phase.value = next
  if (next === 'tease' && punchlineTimerId === null) {
    punchlineTimerId = window.setTimeout(() => { punchlineLanded.value = true }, PUNCHLINE_READ_MS)
  }
  const beat = BEATS[next]
  greetTimerId = window.setTimeout(() => runGreeting(beat.next), beat.hold)
}

const { loadingProgress, preloadAssets } = useAssets()
const progress = computed(() => loadingProgress.value)

void preloadAssets()

// First-load interstitial — ON for GamePix and GameMonetize.
//
// GameMonetize QA, 2026-09-09: "Ads should be shown the first time after the
// game loads." That ad was served by `useFirstStartInterstitial`, awaited in
// `GameScene.boot()`, and it SAMPLES `isInterstitialReady` exactly once — which
// makes the placement a race it loses on a real portal:
//
//   * `boot()` runs from `onMounted` on the lazily-imported GameScene route
//     chunk — a local, modulepreloaded file.
//   * The ad SDK is only injected by `initAds()`, called AFTER `app.mount()`
//     returns (`main.ts`), and does not report ready until
//     api.gamemonetize.com has loaded and its ad stack has initialised.
//
// So the game's own chunk beats a cross-origin ad SDK, `isInterstitialReady` is
// false at the one moment that module looks, and it deliberately does not burn
// its one-shot when not ready — waiting for a retry that cannot come, because
// `boot()` runs once per session. No ad, no error, nothing logged.
//
// It stayed hidden because BOTH proofs were run against an SDK with no network
// in front of it: the unit suite hands the module a ready ref, and the portal-QA
// stub answered SDK_READY in 30 ms, so locally the SDK won the race every time.
// (`scripts/portal-qa.mjs` now delays that handshake for this reason.)
//
// This orchestrator has no such race: it WATCHES readiness and fires on the
// first moment the splash is gone AND the SDK reports a fillable interstitial,
// however long the SDK takes to come up.
//
// GameDistribution is armed for the same reason: its moderation carries the same
// first-load requirement, and its ad sat on the same sampled-once placement, so
// it was equally dead. The post-splash fire was once removed on GD for producing
// borderline-incidental-click impressions — that trade is being taken again
// knowingly, because the alternative shipped no first ad at all.
//
// Every env read is a static literal so Rollup DCEs the entire branch (helper
// module included) on other platform builds — same pattern as the Playgama /
// GamePix loading signals further down.
if (
  import.meta.env.VITE_APP_GAMEPIX === 'true'
  || import.meta.env.VITE_APP_GAME_MONETIZE === 'true'
  || import.meta.env.VITE_APP_GAME_DISTRIBUTION === 'true'
) {
  armFirstLoadInterstitial()
}

const done = ref(false)
const backdropHidden = ref(false)
const showStuckHint = ref(false)
let stuckHintId: number | null = null

let settleFallbackId: number | null = null

onMounted(() => {
  const staticSplash = document.getElementById('static-splash')
  if (staticSplash) {
    // Before it starts fading: the ant's float.
    adoptAnimationClock(staticSplash.querySelector('.splash-greeter'), floatEl.value)
    // The tile, too: a layer starting its drift from zero would show the
    // pattern doubled and sliding against itself through the crossfade.
    adoptAnimationClock(staticSplash.querySelector('.splash-tiles'), tilesEl.value)
    staticSplash.classList.add('hidden')
    setTimeout(() => staticSplash.remove(), 500)
  }

  // Hard fallback so the splash always clears, even if the asset loader never
  // reports 100% (offline / blocked images / dropped requests).
  //
  // Raised from 4 s: the loader now also waits for the survivor sprite strips to
  // bake (see `useAssets.preloadAssets`), and on the low-idle devices that wait
  // exists for, 4 s could fire FIRST — dropping the splash right back into the
  // capsule crowd it is there to prevent. `useAssets` bounds its own wait at
  // 6 s, so this sits past that and is a true last resort rather than the normal
  // exit. The hint moves earlier so a slow load says something before then.
  //
  // It does not wait for the joke: the taunt has landed by ~3 s, well inside
  // this, and a last resort that something else can hold up is not one.
  settleFallbackId = window.setTimeout(() => {
    if (!done.value) done.value = true
  }, 8000)
  stuckHintId = window.setTimeout(() => {
    if (!done.value) showStuckHint.value = true
  }, 5000)

  greetTimerId = window.setTimeout(() => runGreeting('loom'), LURK_MS)
})
onUnmounted(() => {
  if (settleFallbackId !== null) clearTimeout(settleFallbackId)
  if (stuckHintId !== null) clearTimeout(stuckHintId)
  if (greetTimerId !== null) clearTimeout(greetTimerId)
  if (punchlineTimerId !== null) clearTimeout(punchlineTimerId)
})

// The splash lets go when the load is finished AND the joke has landed,
// whichever comes second. The game is released first and the splash starts to
// fade 100 ms later, so the level's first frames are drawn while the loading
// screen is still opaque — the same order the load alone used to give.
//
// `immediate: true` fires the handler with the current values the moment the
// watcher is set up. Without it, an asset loader that already reports 100%
// (instant boots, especially on localhost) never trips the watcher, and the
// splash sits around for the full `settleFallbackId` window.
watch([() => progress.value >= 100, punchlineLanded], ([loaded, landed]) => {
  if (!loaded || !landed || done.value) return
  releaseSplash()
  setTimeout(() => { done.value = true }, 100)
}, { immediate: true })

let cgLoadSignaled = false
const signalGameReadyToCG = () => {
  if (cgLoadSignaled) return
  cgLoadSignaled = true
  try { stopLoading() } catch (e) { console.warn('[FLogoProgress] CG ready-to-play failed', e) }
}

// Playgama's `game_ready` is certification-mandatory — fire it on the same
// splash-resolved edge as CG's loadingStop. The plugin guards the message
// internally so it fires once even if the watcher re-triggers.
//
// Gate uses the inline `import.meta.env.VITE_APP_*` literal (NOT the
// `isPlaygama` re-export from `useUser`) so Rollup can statically
// eliminate the dynamic-import branch on non-Playgama builds. The
// cross-module constant propagation isn't reliable enough for the
// re-exported `const` to be recognised as a build-time literal, and
// without DCE every build picks up a ~5 KB lazy `playgamaPlugin` chunk
// it never loads. Same pattern in `main.ts`.
let playgamaLoadSignaled = false
const signalGameReadyToPlaygama = () => {
  if (playgamaLoadSignaled) return
  if (import.meta.env.VITE_APP_PLAYGAMA !== 'true') return
  playgamaLoadSignaled = true
  void import('@/utils/playgamaPlugin').then(({ playgamaGameLoadingStop }) => {
    try { playgamaGameLoadingStop() }
    catch (e) { console.warn('[FLogoProgress] Playgama game_ready failed', e) }
  })
}

// GamePix's `gameLoaded` is the analogous certification-critical edge —
// the toolkit's pause/resume self-test requires a complete
// `customLoading → gameLoading(0..100) → gameLoaded` chain or
// `processLoadingEvent` dies on every pause click. The plugin guards the
// `gameLoaded` fire internally so re-triggering is harmless. Same
// `import.meta.env` literal pattern as the Playgama branch above so
// non-GamePix builds DCE the dynamic-import entirely.
let gamepixLoadSignaled = false
const signalGameReadyToGamepix = () => {
  if (gamepixLoadSignaled) return
  if (import.meta.env.VITE_APP_GAMEPIX !== 'true') return
  gamepixLoadSignaled = true
  void import('@/utils/gamepixPlugin').then(({ gamePixGameLoadingStop }) => {
    try { gamePixGameLoadingStop() }
    catch (e) { console.warn('[FLogoProgress] GamePix gameLoaded failed', e) }
  })
}

// Yandex's `LoadingAPI.ready()` is certification-mandatory — fire it on the
// same splash-resolved edge as CG / Playgama / GamePix. Cert text: "At the
// moment when the user can start playing the game, the LoadingAPI.ready()
// method from Game Ready must be called." The plugin guards the call
// internally so re-triggering is harmless. Same `import.meta.env` literal
// pattern as the platform branches above so non-Yandex builds DCE the
// dynamic-import entirely.
// Poki's `gameLoadingFinished()` is the ONE strictly-required SDK call — fire it
// on the same splash-resolved edge as CG / Playgama / GamePix / Yandex. There is
// no progress counterpart to pair it with: `gameLoadingStart()` and
// `gameLoadingProgress()` are both `() => {}` in the shipped v2 core, so the
// loading bar above is ours alone to drive. The plugin guards the call
// internally so re-triggering is harmless. Same `import.meta.env` literal
// pattern as the branches above so non-Poki builds DCE the dynamic import (this
// component IS in the obfuscator's exclude list, which is what makes a dynamic
// `'@/…'` specifier safe here).
let pokiLoadSignaled = false
const signalGameReadyToPoki = () => {
  if (pokiLoadSignaled) return
  if (import.meta.env.VITE_APP_POKI !== 'true') return
  pokiLoadSignaled = true
  void import('@/utils/pokiPlugin').then(({ pokiGameLoadingFinished }) => {
    try { pokiGameLoadingFinished() }
    catch (e) { console.warn('[FLogoProgress] Poki gameLoadingFinished failed', e) }
  })
}

let yandexLoadSignaled = false
const signalGameReadyToYandex = () => {
  if (yandexLoadSignaled) return
  if (import.meta.env.VITE_APP_YANDEX !== 'true') return
  yandexLoadSignaled = true
  void import('@/utils/yandexPlugin').then(({ yandexLoadingReady }) => {
    try { yandexLoadingReady() }
    catch (e) { console.warn('[FLogoProgress] Yandex LoadingAPI.ready failed', e) }
  })
}

watch(done, (isDone) => {
  if (isDone) {
    // Already done by the gate above on a normal exit. This is for the 8 s
    // fallback, which clears the splash without it — and a game still waiting
    // on the release behind a splash that has gone would be a black screen.
    releaseSplash()
    setTimeout(() => {
      backdropHidden.value = true
      signalGameReadyToCG()
      signalGameReadyToPlaygama()
      signalGameReadyToGamepix()
      signalGameReadyToYandex()
      signalGameReadyToPoki()
      // Triggers the GamePix / GameMonetize / GameDistribution first-load ad (no-op on
      // other builds — the orchestrator was never armed there). Runs alongside
      // the platform `game_ready` / `gameLoaded` signals so the ad lands
      // immediately once the splash is gone and the SDK is fillable; if the SDK
      // is still initialising this only ARMS the fire, and the readiness watcher
      // in the orchestrator lands it a moment later.
      notifySplashGone()
    }, 150)
  }
})
</script>

<style scoped lang="sass">
.no-os-ui
  caret-color: transparent
  user-select: none
  -webkit-user-select: none
  -webkit-touch-callout: none
  -webkit-tap-highlight-color: transparent

  &, & *
    -webkit-user-drag: none

// --- The greeting card -----------------------------------------------------
//
// Every measurement of the card, the stage and the ant is shared with the
// inline static splash in `index.html`, which draws the same ant at the same
// size in the same place so the handover between the two is invisible. Change
// one, change both. The stomp is this component's alone.

// The card's width, and therefore the logo's. Everything else is a percentage
// of it, so the whole composition scales as one on a phone.
$greet-w: clamp(200px, 58vmin, 340px)

.greet
  position: relative
  display: flex
  flex-direction: column
  align-items: center
  gap: 0.55rem
  width: $greet-w

// The stage is squat: the ant stands in the left half and the bubble fills the
// right, rather than the ant being centred with the bubble hanging off the side
// where a 320 px-wide portrait phone would clip it.
.greet-stage
  position: relative
  width: 100%
  aspect-ratio: 340 / 200

// The ant stands in the LEFT half of the stage and the bubble fills the right,
// so a 320 px portrait phone never clips the speech. This box is where it
// stands; it only moves to get out from under the shoe.
.greeter
  position: absolute
  left: 1%
  bottom: -2%
  height: 112%
  aspect-ratio: 1 / 1

// The float. It never stops and never restarts, on any beat — which is what
// lets the dodge and the tremble come and go on the layers either side of it
// without the ant ever jumping.
.greeter-float
  width: 100%
  height: 100%
  animation: greeter-float 2.6s ease-in-out infinite

.greeter-img
  display: block
  // Tailwind preflight caps every image at `max-width: 100%`; the still is
  // square and fills its own window, so both axes are stated.
  max-width: none
  width: 100%
  height: 100%

@keyframes greeter-float
  0%, 100%
    transform: translateY(0) rotate(-1.5deg)
  50%
    transform: translateY(-6%) rotate(1.5deg)

// --- The stomp -------------------------------------------------------------
//
// The game's own read of a foot coming down, at the size of the ant: the soft
// shadow tightening and darkening as the foot drops, the dashed ring the stomp
// will hit, and the painted shoe itself (`paintFootShadow`, `paintStompRing`
// and `drawShoe`). The splash teaches nothing the board does not do exactly.
//
// Both `.landing` boxes are the ring: centred on the ant's box (34 %, 46 %) and
// wide enough to take in its head and its outstretched arms, at the ring's own
// 1 : 0.86 — the ant is IN the target. That width also sizes the shoe
// (`--shoe-w` of it), so a smaller ring means a toy shoe and a stomp with no
// weight. `top` is in stage HEIGHTS, so the 0.86 goes through the stage's
// 340 : 200 as well:
//
//   ring height = 54 % × 0.86 × 340/200 = 78.95 % of the stage's height
//   top         = 46 % − 78.95 % / 2   = 6.53 %
.landing
  position: absolute
  left: 7%
  top: 6.53%
  width: 54%
  aspect-ratio: 100 / 86
  pointer-events: none

.stomp-shadow,
.stomp-puff,
.stomp-ring
  position: absolute
  inset: 0
  width: 100%
  height: 100%
  opacity: 0

// `paintFootShadow`, with the foot at rest: the same stops, with the alphas
// raised by half again. That function's 0.42 is tuned for a sunny blanket; on
// this navy it all but vanished, and the loom then read as a ring appearing
// rather than a foot coming down. The loom starts it where that function has it
// at full lift — wider by SHADOW_SPREAD, and paler — and closes it to this.
.stomp-shadow
  border-radius: 50%
  background: radial-gradient(closest-side, rgba(0, 0, 0, 0.64) 15%, rgba(0, 0, 0, 0.4) 70%, rgba(0, 0, 0, 0))

// `paintStompRing` at its default weight: a dark under-stroke so it survives any
// ground, and the white dash over it at 0.3 r on, 0.2 r off. In the viewBox r is
// 50, so the numbers are that function's, unscaled.
.stomp-ring
  overflow: visible

.stomp-ring-under,
.stomp-ring-dash
  fill: none

.stomp-ring-under
  stroke: rgba(20, 10, 26, 0.55)
  stroke-width: 5

.stomp-ring-dash
  stroke: rgba(255, 255, 255, 0.8)
  stroke-width: 3
  stroke-dasharray: 15 10

// The dust the landing kicks up: one ring, out and gone.
.stomp-puff
  box-sizing: border-box
  border-radius: 50%
  border: 0.22em solid rgba(244, 234, 214, 0.9)

// The shoe, placed the way the renderer places it: its box is `--shoe-w` of the
// ring, and the painting's stomp point — `--shoe-toe` of the way down its
// centre line — sits on the ring's centre. The transform origin is that same
// point, so the drop and the lift scale about where the foot lands.
.stomp-shoe
  position: absolute
  left: 50%
  top: 50%
  width: var(--shoe-w)
  max-width: none
  height: auto
  opacity: 0
  transform-origin: 50% var(--shoe-toe)
  transform: translate(-50%, calc(-1 * var(--shoe-toe)))
  // The board crops the leg with the screen edge; here it would hang over the
  // logo. It fades out below the heel instead.
  -webkit-mask-image: linear-gradient(to bottom, #000 60%, transparent 88%)
  mask-image: linear-gradient(to bottom, #000 60%, transparent 88%)

// ── Beat 1 — the loom ──
// The ring snaps round the ant, the shadow closes on it, and after a beat to
// notice, it starts to shake.
.greet.is-loom
  .stomp-ring
    animation: ring-lock 0.26s cubic-bezier(0.2, 1.5, 0.4, 1) both
  .stomp-shadow
    // Accelerating: the foot is falling.
    animation: shadow-close var(--loom) cubic-bezier(0.55, 0, 1, 0.45) both
  .greeter-img
    animation: greeter-tremble 0.1s linear 0.25s infinite

@keyframes ring-lock
  from
    transform: scale(1.35)
    opacity: 0
  to
    transform: scale(1)
    opacity: 1

// From `paintFootShadow` at z = 1 (radius × 1.85, alpha × 0.38) to z = 0.
@keyframes shadow-close
  from
    transform: scale(1.85)
    opacity: 0.38
  to
    transform: scale(1)
    opacity: 1

@keyframes greeter-tremble
  0%, 100%
    transform: translateX(0) rotate(0deg)
  25%
    transform: translateX(-1.5%) rotate(-1.5deg)
  75%
    transform: translateX(1.5%) rotate(1.5deg)

// ── Beat 2 — the stomp ──
// Every keyframe below is a share of `--stomp`, and the landing is at 20 % of
// it in all of them: the ant is clear at 16 %, the shoe touches down at 20 %,
// and the puff and the thump start on that same frame. Keep them together.
.greet.is-stomp
  animation: card-thump 0.28s ease-out calc(var(--stomp) * 0.2) both
  .greeter
    animation: greeter-dodge var(--stomp) linear both
  .stomp-shoe
    animation: shoe-slam var(--stomp) linear both
  .stomp-puff
    animation: puff-out 0.38s ease-out calc(var(--stomp) * 0.2) both
  .stomp-ring
    animation: ring-out var(--stomp) ease-in both
  .stomp-shadow
    animation: shadow-out var(--stomp) linear both

// A scramble, not a slide: it leans into the run, overshoots as it brakes, and
// stays out there, peeking, until the shoe has gone.
@keyframes greeter-dodge
  0%
    transform: translate(0, 0) rotate(0deg)
    animation-timing-function: ease-in
  16%
    transform: translate(-62%, 4%) rotate(-16deg)
    animation-timing-function: ease-out
  26%
    transform: translate(-70%, 1%) rotate(-7deg)
  40%, 100%
    transform: translate(-66%, 0) rotate(-3deg)

// Drops from the camera — big, as the board draws a raised shoe — lands, squashes
// the way `paintShoe` squashes on impact, holds, and lifts away the way it came.
@keyframes shoe-slam
  0%
    transform: translate(-50%, calc(-1 * var(--shoe-toe))) scale(var(--shoe-lift))
    opacity: 0
    animation-timing-function: ease-in
  8%
    opacity: 1
  20%
    transform: translate(-50%, calc(-1 * var(--shoe-toe))) scale(1)
    opacity: 1
    animation-timing-function: ease-out
  27%
    transform: translate(-50%, calc(-1 * var(--shoe-toe))) scale(1.22, 0.78)
  36%, 62%
    transform: translate(-50%, calc(-1 * var(--shoe-toe))) scale(1)
    opacity: 1
    animation-timing-function: ease-in
  100%
    transform: translate(-50%, calc(-1 * var(--shoe-toe))) scale(var(--shoe-lift))
    opacity: 0

@keyframes puff-out
  from
    transform: scale(0.55)
    opacity: 0.95
  to
    transform: scale(1.3)
    opacity: 0

// The ring holds while the shoe is down and goes with it — tightening a touch
// on the landing, the way the board's does not, because here it has to read in
// a fraction of a second at a sixth of the size.
@keyframes ring-out
  0%, 18%
    transform: scale(1)
    opacity: 1
  24%
    transform: scale(0.94)
    opacity: 1
  30%, 62%
    transform: scale(1)
    opacity: 1
  100%
    transform: scale(1.12)
    opacity: 0

// Tightest under the landed shoe, then back up and out with the lift.
@keyframes shadow-out
  0%
    transform: scale(1)
    opacity: 1
  20%, 62%
    transform: scale(0.94)
    opacity: 1
  100%
    transform: scale(1.85)
    opacity: 0

// The whole card takes the hit — the logo and the read-out included.
@keyframes card-thump
  0%
    transform: translateY(0)
  30%
    transform: translateY(4px)
  65%
    transform: translateY(-1.5px)
  100%
    transform: translateY(0)

// ── Beat 3 — the taunt ──
// Back on its spot, overshooting a little in its hurry, and then pleased with
// itself: the shoulder-shake that turns "about to be squished" into "come on
// then".
.greet.is-tease
  .greeter
    animation: greeter-return 0.4s cubic-bezier(0.3, 1.4, 0.5, 1) both
  .greeter-img
    animation: greeter-giggle 0.42s ease-in-out 0.4s infinite

@keyframes greeter-return
  from
    transform: translate(-66%, 0) rotate(-3deg)
  to
    transform: translate(0, 0) rotate(0deg)

@keyframes greeter-giggle
  0%, 100%
    transform: translateY(0) rotate(0deg)
  25%
    transform: translateY(-3%) rotate(-4deg)
  75%
    transform: translateY(-3%) rotate(4deg)

// --- The speech bubble -----------------------------------------------------
//
// Drawn rather than painted. A bitmap bubble would have to be re-cut for every
// locale's word length — "Missed me!" is ten characters and its Japanese and
// Thai counterparts are neither that length nor that shape — and it would be
// one more file on the boot path. The ink-heavy border matches the cast's
// linework.
//
// Pinned, not in flow: the bubble grows rightward from a fixed left edge as the
// text changes, so the ant never shifts under it.
.bubble
  position: absolute
  left: 46%
  top: 0
  // Sized for a two-word taunt at a 320 px viewport — Spanish's "¡No me
  // diste!" is the longest any locale ships. It is a cap, not a width: the
  // bubble shrinks to "Uh-oh!" and grows to the taunt on its own, and a longer
  // string than any of these WRAPS rather than spilling out of the plate,
  // which is why there is no `white-space: nowrap` here.
  max-width: 58%
  padding: 0.42em 0.7em 0.5em
  border: 0.13em solid #10131f
  border-radius: 0.85em
  background: #f4ead6
  box-shadow: 0 0.18em 0 rgba(16, 19, 31, 0.55)
  // The pop grows out of the ant's head, which is down and to the left.
  transform-origin: 0% 100%

// The tail: two stacked triangles — the dark one is the ink outline, the light
// one sits a hair inside it — aimed down-left at the ant.
.bubble::before,
.bubble::after
  content: ''
  position: absolute
  left: 0.9em
  width: 0
  height: 0
  border-style: solid

.bubble::before
  bottom: -1.02em
  border-width: 1.05em 0.78em 0 0
  border-color: #10131f transparent transparent transparent

.bubble::after
  bottom: -0.72em
  border-width: 0.82em 0.58em 0 0
  border-color: #f4ead6 transparent transparent transparent

.bubble-text
  display: block
  color: #17110c
  font-size: clamp(0.95rem, 4.6vmin, 1.5rem)
  font-weight: 900
  line-height: 1.15
  text-align: center

// The taunt is a wobble, not a shout — the bubble giggles along with the ant.
//
// The pop is restated here rather than left to `.bubble-pop-enter-active`
// below: this selector outranks that one, so without it the taunt would never
// pop at all, it would simply appear, already wobbling.
.greet.is-tease .bubble
  animation: bubble-pop-in 0.34s cubic-bezier(0.16, 1.5, 0.4, 1), bubble-giggle 0.42s ease-in-out 0.34s infinite

@keyframes bubble-giggle
  0%, 100%
    transform: rotate(0deg) scale(1)
  25%
    transform: rotate(-2deg) scale(1.04)
  75%
    transform: rotate(2deg) scale(1.04)

// The pop. Overshoots hard on the way in — a yelp has to arrive faster than the
// eye can follow it — and leaves quickly and small so the next beat is already
// growing over it.
.bubble-pop-enter-active
  animation: bubble-pop-in 0.34s cubic-bezier(0.16, 1.5, 0.4, 1)

.bubble-pop-leave-active
  animation: bubble-pop-in 0.16s ease-in reverse

@keyframes bubble-pop-in
  0%
    transform: scale(0.2) rotate(-14deg)
    opacity: 0
  60%
    transform: scale(1.12) rotate(3deg)
    opacity: 1
  100%
    transform: scale(1) rotate(0deg)
    opacity: 1

// --- The title -------------------------------------------------------------
//
// The lockup, shown WHOLE — no crop, no offset, no measured constant.
//
// What used to be here was a crop: `aspect-ratio: 512 / 344` with a
// `margin-top: -16.41%`, both derived by hand from the alpha bbox of whatever
// `logo_512x512.png` happened to be at the time, with a comment telling the
// next person to re-measure them after every repaint. Two things were wrong
// with that. The obvious one is that nobody re-measures: the numbers were
// taken off a painted wordmark and the file underneath them could change
// without the crop noticing. The quiet one is that `index.html` showed the
// SAME file uncropped at a different width, so the two halves of the handover
// were never the same size — the logo jumped the moment Vue mounted, inside
// the 400 ms both layers are on screen together.
//
// `scripts/make-brand.mjs` now lays the ink out to fill its square with a small
// even margin, so there is nothing to crop, and `tests/ui/brandLockup.test.ts`
// fails if a future logo stops holding to that. 76%, the same 76% as
// `.splash-logo` in index.html. Change one, change both.
.greet-logo
  width: 76%
  aspect-ratio: 1 / 1

  img
    display: block
    // Both axes stated: the box is already square and the file is square, and
    // `height: auto` would let the app stylesheet's image reset decide, which
    // is how the two splashes drift apart again.
    width: 100%
    height: 100%

.percentage-text
  font-size: clamp(0.9rem, 4vw, 1.35rem)
  font-weight: 900

// Motion is the whole point here, so this cannot be a blanket `animation: none`
// — with everything frozen there is no joke, just an ant beside a word. The
// story stays and the violence goes: no tremble, no slam, no squash, no dust,
// no thump and no giggle. The ring and the shadow fade in, the ant steps aside,
// the shoe fades in on the empty spot and out again, and the ant steps back.
// The gentle float stays, as it always has.
@media (prefers-reduced-motion: reduce)
  .greet.is-loom .greeter-img,
  .greet.is-tease .greeter-img,
  .greet.is-stomp,
  .greet.is-stomp .stomp-puff
    animation: none

  .greet.is-loom .stomp-ring
    animation: soft-in 0.25s ease-out both

  .greet.is-loom .stomp-shadow
    animation: soft-in var(--loom) ease-in both

  .greet.is-stomp .stomp-ring,
  .greet.is-stomp .stomp-shadow
    animation: soft-out var(--stomp) linear both

  .greet.is-stomp .stomp-shoe
    animation: shoe-soft var(--stomp) linear both

  .greet.is-stomp .greeter
    animation: greeter-step-aside var(--stomp) linear both

  .greet.is-tease .greeter
    animation: greeter-return 0.5s ease-in-out both

  .greet.is-tease .bubble
    animation: soft-in 0.25s ease-out

  .bubble-pop-enter-active
    animation: soft-in 0.25s ease-out

  .bubble-pop-leave-active
    animation: soft-in 0.15s ease-in reverse

  @keyframes soft-in
    from
      opacity: 0
    to
      opacity: 1

  @keyframes soft-out
    0%, 62%
      opacity: 1
    100%
      opacity: 0

  @keyframes shoe-soft
    0%
      opacity: 0
    20%, 62%
      opacity: 1
    100%
      opacity: 0

  @keyframes greeter-step-aside
    0%
      transform: translate(0, 0)
      animation-timing-function: ease-in-out
    30%, 100%
      transform: translate(-66%, 0)

// --- The backdrop -----------------------------------------------------------
//
// The same ground, tile and drift as the inline splash in index.html — read
// the long comment on `.splash-tiles` there. Change one, change both
// (`tests/ui/splashTiles.test.ts` holds them to it).

$tile: 400px

.splash-backdrop
  position: fixed
  inset: 0
  z-index: 150
  // The tile layer is one tile bigger than the screen; without this it would
  // hand the page a scrollbar.
  overflow: hidden
  // Matches the inline splash in index.html AND the scene's sky, so the
  // handover from static HTML → Vue splash → canvas is one continuous colour
  // with no flash between the three.
  background: radial-gradient(circle at 50% 38%, #1b2b52 0%, #0a1224 70%)

.backdrop-tiles
  position: absolute
  top: -$tile
  left: -$tile
  right: 0
  bottom: 0
  background-position: 0 0
  background-size: $tile $tile
  background-repeat: repeat
  opacity: 0.16
  will-change: transform
  animation: backdrop-tiles-in 0.6s ease-out both, backdrop-tiles-pan 40s linear infinite

@keyframes backdrop-tiles-in
  from
    opacity: 0

@keyframes backdrop-tiles-pan
  to
    transform: translate3d($tile, $tile, 0)

@media (prefers-reduced-motion: reduce)
  .backdrop-tiles
    animation: none

.splash-fade-leave-active
  transition: opacity 0.4s ease-out
  pointer-events: none

.splash-fade-leave-to
  opacity: 0

.loader-fade-leave-active
  transition: opacity 0.35s ease-out, transform 0.35s ease-out
  pointer-events: none

.loader-fade-leave-to
  opacity: 0
  transform: translate(-50%, -50%) scale(0.85)

.stuck-hint
  color: rgba(255, 200, 0, 0.85)
  font-size: 0.9rem
  text-align: center
  max-width: 80vw
</style>
