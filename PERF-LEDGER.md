# Performance experiment ledger — survivalist

Every performance change tried on this project, kept or reverted, with the
measurement that decided it. Null and negative results are the valuable rows:
they are what stops the same idea being re-tried here or in the next game.

Procedure: `web-game-performance-optimize`.

---

## Harness

Installed in the repo. Interleaved A/B/A/B over CDP against a **headed** Chrome
on a private `--user-data-dir` (the shared MCP profile is usually locked by
another session; this never has to close a browser that belongs to open work).

| Piece | Path | What it is |
|---|---|---|
| Variant flags | `src/use/perfVariants.ts` | Boot-frozen A/B flags. Nothing set ⇒ shipping path. |
| Probe | `src/use/usePerfProbe.ts` | Zero-alloc ring buffers; work/interval percentiles, long tasks, heap slope, `step`/`draw` phase timers. Publishes `window.__perf`. |
| Runner | `scripts/perf-play.mjs` | `pnpm perf:play` — **the one to use for renderer work.** Interleaved, CPU-throttled, paired verdict, and it PLAYS the game (see the 2026-09-05 harness row). Fresh browser per measurement. |
| Runner (no input) | `scripts/perf-ab.mjs` | `pnpm perf:ab` — the original. Fine against `perf/harness.html`, which needs no input; against the game itself it measures the tutorial. |
| Isolation harness | `perf/harness.html` | Prices ONE draw path with a fixed seeded workload, when driving real gameplay adds more variance than the change under test. |

Wired into the real game: `GameScene.vue`'s RAF loop brackets `step` and `draw`,
`main.ts` calls `installPerfProbe` after mount. All of it no-ops unless
`?perfprobe=1`. **Cost in the shipped bundle: 1117 B gzipped** (893 B probe +
224 B flags), 0.61 % of the 182.9 kB main chunk. `perf/` and `scripts/` are not
build entries — verified absent from `dist/` after `vite build`.

Run against the **real game** by default; reach for `perf/harness.html` only
when isolating a single pass. A 40 % saving on a pass that is 4 % of the frame
is a 1.6 % saving, and only the real game will tell you that.

```bash
pnpm dev
pnpm perf:ab --a "perf=<thing>-legacy" --b ""            # real game
pnpm perf:ab --base "http://127.0.0.1:5173/perf/harness.html?n=150" \
             --a "perf=<thing>-legacy" --b ""            # one isolated pass
```

Arms alternate every rep and the order flips on odd reps, so neither arm is
systematically first. The verdict uses the **paired** comparison (did B beat A
rep for rep; do the arms' ranges overlap), not the gap against one arm's own
spread across reps — drift moves both arms together and inflates that spread.
The runner reads `activeVariants()` back from the page and refuses to report a
run where the flag it asked for was not the flag that parsed.

### Noise floor — measured, and the bar every experiment must clear

An **A/A run** (identical flags on both arms) against the real game, to
calibrate the harness against itself:

```
A/A, real game route, 4x CPU throttle, 300 frames/rep, 4 reps
  median-of-rep workP95   A 4.350 ms  ->  B 4.450 ms   (+2.3%)
  paired wins              2/4 reps
  ranges                   A [3.500, 6.200]  B [4.300, 4.800]  overlapping
  VERDICT (correctly)      revert / log the null result
```

**A difference under ~10 % on `workP95` at these settings is not
distinguishable from noise.** Raise `--reps` and `--frames` before believing
anything smaller. Note the harness correctly refused to call a winner when
there was none — that is the property that makes the rest of this file worth
trusting.

### And the finding that outranks every optimization below

That same A/A shows the real game at **workP95 ≈ 4.4 ms against a 16.7 ms
budget, with the RAF interval pinned at 16.9 ms, at 4× CPU throttle** — the
mid-range-Android proxy. The game holds 60 fps on the target profile with about
12 ms of headroom.

Per the procedure's own rule: *if the worst target device holds the fps target
with headroom, the correct verdict is don't — spend the time on content.* Treat
further renderer micro-optimization here as unjustified until a real device, a
heavier scene (boss + peak wave + full VFX), or a player report says otherwise.

---

## 2026-09-05 — the harness was measuring the TUTORIAL ❌ HARNESS BUG, FIXED

**Read this before trusting any number produced by `pnpm perf:ab` alone.**

`scripts/perf-ab.mjs` loads the page and waits. In this game that measures the
tutorial: the squad holds its column until the first pointer event arrives, so a
run with no input never draws a gate, a crate, a foe or a single glyph. Proof:
a draw-call breakdown over 1 504 frames with **zero `fillText` calls**, and a
screenshot at 26 s still reading *"Swipe to move your squad"*.

Every A/B against `--base <the game>` with no scripted input is therefore a
comparison of two empty roads. The runs below use a driver that dispatches one
`pointerdown` and then a 5 s-period sine steer across 70 % of the lane, installed
IN THE PAGE (a CDP round trip per event is as slow and as variable as the thing
being measured under throttling). With it, `workP50` at 6× goes from 1.7 ms to
7.7 ms — the difference between measuring the menu and measuring the game.

Two more properties the runner needs and did not have:

* **A long, unthrottled settle before the clock starts.** The idle sprite baker
  builds the stage's monster strips in the first seconds of play at ~12 ms a
  frame. An A/A run that started measuring at 3 s reported 48 long tasks in one
  arm and 9 in the other — a 34 % spread between two IDENTICAL arms. 12 s of
  settle fixes it.
* **A fresh browser per measurement.** Chrome degrades across repeated
  navigations of this page: an A/A at 4 reps in one browser returned 1 320, 604,
  93 and then 0 recorded frames on successive runs.

With all three, the A/A noise floor is **−0.7 % on `workP95`** (A 13.60 ms → B
13.50 ms, 3 reps, 6×, 22 s each) — in line with the ~10 % bar the original A/A
established.

The driver lives in `scripts/perf-play.mjs` (`pnpm perf:play`); the old runner is
kept for isolated-pass work against `perf/harness.html`, which needs no input.

---

## 2026-09-05 — 12× CPU throttle ❌ DO NOT USE ON THIS PROJECT

At 12× the idle sprite baker's long tasks swamp everything. `workP95` tracks the
long-task count and nothing else: reps with ~70 long tasks scored 9.1–9.9 ms in
BOTH arms, reps with 140–325 scored 14–24 ms in BOTH arms. A run reported
"+39.4 %" for a change that is a dead null at 6×. 6× is the ceiling here.

---

## 2026-09-05 — the `min` quality tier ✅ KEPT (a fidelity cut, deliberately)

**Not an optimization — a product decision, taken because players reported runs
sitting at ~10 fps.** The ladder had no rung below 40 fps, so a device at 12 fps
and one at 38 fps were treated identically; and `renderScaleTier` committed the
canvas resolution ONCE and never moved again, so a device that met its trouble
after the 10 s calibration window had the single biggest lever bolted shut for
the rest of the session.

Three changes, all in `useVfx.ts`:

* a fourth tier, `min`, entered below 25 fps — DPR **0.8** (below the device
  grid; the compositor scales it back up), no lane gravel, no depth fade, no
  decals, no gate chevrons, no divider glow or beacon, no per-body shadows, 70
  drawn survivors instead of 190, a 110-particle pool instead of 900;
* the steady-state window closes on 60 frames **or one second of rendered time**,
  whichever comes first — a pure frame window is a one-second control at 60 fps
  and a SIX-second one at 10 fps, so the device in the most trouble waited
  longest for help. Downgrades also stopped waiting on the 2.5 s hold; upgrades
  still do;
* the resolution became a **ratchet** instead of a one-shot lock: still
  downgrade-only and never reversed, but a further step needs the live tier to
  have held for 4 s. Bounded at three re-sizes a session.

```
tier=high vs tier=min   headed Chrome 152, 412x915 @ DPR 2, 6x CPU throttle,
                        scripted sine steer, 4 reps interleaved, 22 s each,
                        fresh browser per run

  median-of-rep workP50      7.55 ms  ->   5.75 ms   (-24%)
  median-of-rep workP95     15.55 ms  ->  12.65 ms   (-19%)
  median-of-rep workP99     20.95 ms  ->  17.45 ms   (-17%)
  RAF interval p50          33.30 ms  ->  16.75 ms   (-50%)   <- the headline
  RAF interval p95          50.15 ms  ->  42.10 ms   (-16%)
  long tasks                    51.5  ->     11.0    (-79%)
  paired wins for min        3/4 reps
  ranges                     A [11.7, 16.5]  B [11.6, 14.7]

VERDICT: keep
```

**The interval, not the work, is the point.** The median frame goes from missing
a vsync to hitting one — 30 fps to 60 fps on this profile — while `workP95` moves
only 19 %. That gap is the tell: most of what `min` buys is not CPU time inside
the RAF callback at all, it is **fill rate**. DPR 2 → 0.8 is 6.25× fewer pixels,
and it is the largest single term in the result.

Draw calls fall too, and by how much depends entirely on how busy the road is:
142.5/frame → 132.1 (−7 %) on a quiet stretch, 153.2 → 100.9 (−34 %) on a busy
one, where dropping to 70 drawn survivors from 190 and losing the per-body
shadows and gate chevrons actually bites. Worth knowing which number you are
looking at before quoting either.

**Cost.** Visibly softer, and the road loses its gravel and its depth fade. The
vignette was KEPT at `min` on purpose: it costs one composite over a 0.24 Mpx
canvas, and without it the road reads flat and washed out toward the horizon.
Unit-tested in `qualityCalibration.test.ts`, including that a 4 000 ms tab switch
cannot trip the new one-second window — the outlier filter had to be extended to
the steady-state controller, which until now was protected only by its 60-frame
minimum.

`?tier=min|low|medium|high` pins the ladder for QA and for A/B arms; it is off in
every player session and resolved once, at module load.

---

## 2026-09-05 — bake the vignette, the gate plates and the labels to sprites ❌ REVERTED

The three parts of that day's renderer pass that were a genuine TRADE rather
than strictly-less-work, measured together behind `perf=bake-legacy`:

* the full-screen vignette → a texture blitted (0.6 MB, baked at 400 px on the
  long edge);
* each gate's number plate — frame, outline and glyphs → one sprite, blitted,
  with `pop` carried by the destination rectangle;
* the outlined numbers on crates and barricades → a keyed label-sprite cache.

The hypothesis was reasonable: `strokeText` profiled at 2.7 % of all samples and
`measureText` at another 1.6 %, and a full-screen radial ramp is the most
expensive thing the renderer asks for per pixel.

```
bake-legacy vs baked      6x CPU throttle, 412x915 DPR 2, tier pinned high,
                          6 reps interleaved, 1 400 frames/rep

  median-of-rep workP95    4.950 ms  ->  4.950 ms   (-0.0%)
  paired wins for B        2/6 reps
  ranges                   A [3.600, 6.100]  B [4.600, 7.800]  overlapping
  RAF interval p95         17.45 ms  ->  17.45 ms

VERDICT: revert
```

A dead null. Reverted with its flag, and ~250 lines and 0.6 MB of texture went
with it. (This run predates the scripted-input fix above and so understates the
scene — but it is the arm that ADDS work, and it did not win on the light scene
either, losing 4 of 6 paired reps. A busier scene does not turn that into a win.)

**Kept from the wreckage**, because it is not a trade: `measureLabel` in
`useTextMetrics.ts`. Each gate leaf called `ctx.measureText` once a frame to size
its plate, for a label that changes twice a second at most, at a font size
derived from a frame-constant `scale`. A map lookup replacing a shaping pass,
with byte-identical output.

---

## 2026-09-05 — renderer hygiene pass ✅ KEPT, unmeasured

Filed as Tier A hygiene under the same rule as the 2026-09-04 muzzle-flash hoist
(exempt from *deliberation*, not from honesty about being unmeasured). Every item
is strictly less work for identical output, and there is no mechanism by which
any of them loses. They could not be A/B'd as a bundle after the fact: isolating
them would need a flag inside eleven separate loops, which is the shape the
procedure tells you not to build.

**Gradients that were rebuilt every frame, now cached** — the off-lane wash, the
depth fade and the two rails in `drawLane`; the curtain, both posts, the hot
spark and the plate in `drawGates`; the pillar warning glow and the beacon lamp
in `drawDividers`; the tube and sheen of the miniboss HP plate; the vignette.
Two of them also needed the position pushed into a transform (the rails and the
gate posts were pinned to absolute screen coordinates and so could never hit a
cache at all — see `useGradientRamps`). The divider glow's throb moved to
`globalAlpha`, which is exact rather than approximate because its outer stop is
transparent; the beacon's amber-to-red shift is bucketed to 8 of 255 in green,
which is the one place in the pass where output changes at all.

**Stroke submissions batched** — a gate's six chevrons and the trap's two bars
were a `beginPath`/`stroke` each; they are now one path and one stroke apiece.
Tracers were two strokes PER BULLET with a frame-constant colour and width; they
are now two strokes for the whole pass. Safe under `lighter` because tracers are
vertical lines at the survivors' own spacing (~0.3 world units) against a 0.1
glow width, so they never overlap.

**Pixels not submitted** — the backdrop is a viewport-and-a-half tall texture
that was blitted whole every frame and then covered by an opaque road across
~80 % of a portrait screen; it is now two source-cut strips either side of the
lane. The lane's gravel pattern filled `h + 2 * tile` for a scroll offset that
only ever spans one tile.

**Per-frame strings and reads** — the crowd's shadow tone was a template literal
built once per drawn survivor; every `quality.value` in the renderer was a Vue
ref getter, several inside per-entity loops, and the tier is now latched once a
frame into a plain local.

Effect on the one thing that can be counted rather than timed:
**stroke submissions 37.7/frame → 30.3, total draw calls 142.5/frame → 139.6**
(`drawImage` rises 12.2 → 13.8, which is the backdrop becoming two blits of far
fewer pixels than the one it replaced).

**Not done, deliberately:** caching the crowd's pooled contact shadow. It is one
gradient for the whole frame, not one per entity, and its key would have to carry
both a continuously moving crowd radius and a continuous squeeze — hundreds of
combinations into a 256-entry cache shared with every per-entity ramp in the
renderer, evicting the ramps the cache exists for to save one build a frame.

---

## 2026-09-04 — smoke particles: bake the ramp to a sprite ✅ KEPT

**Hypothesis.** The particle pool rebuilt a two-stop radial gradient per smoke
puff at absolute screen coordinates, so the rasteriser rebuilt the ramp for
every puff every frame. Baking one sprite per colour and blitting it should cut
the particle paint substantially, at the cost of ~150 kB of texture per colour.

**Scenario.** 150 puffs — the realistic peak for this game's three smoke
emitters, not the 900 pool cap. 412x915 at DPR 2. Fixed seed, pool never
stepped, so both arms paint an identical set and simulation variance is zero.

```
smoke-sprite-blit vs per-puff-gradient   headed Chrome 152, RTX 4090 laptop

unthrottled, 6 reps interleaved, 400 frames/rep
  median-of-rep p95 work/frame   A 1.200 ms  ->  B 0.700 ms   (-42%)
  paired wins for B              5/5 completed reps
  ranges                         A [1.000, 1.700]  B [0.600, 0.900]  DISJOINT
  RAF interval p95               A 16.90 ms  ->  B 16.90 ms

4x CPU throttle, 6 reps interleaved, 300 frames/rep
  median-of-rep p50 work/frame   A 5.850 ms  ->  B 3.550 ms   (-39%)
  paired wins for B (p50)        6/6 reps
  median-of-rep p95 work/frame   A 11.700 ms ->  B 9.500 ms   (-19%, ranges
                                 overlap — p95 is noisy under CPU throttling)
  RAF interval p95               A 16.90 ms  ->  B 17.70 ms

VERDICT: keep
```

**What it does not buy.** The RAF interval was ~17 ms in both arms — the game
was vsync-capped either way at this workload. This is frame-budget headroom on a
weak device, not a frame-rate change.

**Cost.** ~150 kB per distinct smoke colour (192x192 RGBA); a handful of colours
in play. A gradient fallback path is retained for "no offscreen context", which
is what jsdom hits under test.

---

## 2026-09-04 — smoke particles: cached UNIT ramp sized by `scale()` ❌ REPLACED

The first thing tried, and the intuitive one: cache a single unit-radius ramp
per colour and place/size it with `translate` + `scale`. It ships one gradient
instead of 900 and looks like the clean fix.

It is a much smaller win than the blit, and a `scale()` in the pool's hottest
loop is work the blit does not do — `drawImage`'s destination rectangle carries
the size for free. Superseded before it was ever measured on the real harness;
what killed it is that the sprite arm above beats the *original* by 42% while
this approach's own advantage over the original was never established on a
trustworthy harness at all.

There is a test (`gradientRamps.test.ts`) asserting no path reintroduces a
`scale()` here, so the tidier-looking form cannot drift back in.

---

## 2026-09-04 — headless Chrome as a canvas perf harness ❌ DO NOT USE

**The most important row here.** An early standalone benchmark run under
`--headless=new --dump-dom` produced numbers that contradicted themselves
between runs: the untouched baseline arm reported 25.4 ms in one run and 3.98 ms
in the next, with the only edit being the sprite size of a *different* arm.

Cause: a canvas that is never composited lets the browser skip raster work, and
`getImageData` does not reliably force it. Conclusions drawn from that harness
(including a claimed 4x win and a claimed ranking of intermediate approaches)
were discarded.

**Rule for this project:** canvas/GPU timings come from a headed browser with a
visible, attached canvas in a RAF loop. Headless is fine for correctness, never
for paint cost.

---

## 2026-09-04 — muzzle flash: hoist the ramp out of the crowd loop ✅ KEPT, unmeasured

`drawUnits` rebuilt a three-stop radial ramp for every firing survivor, up to
190 a frame, from values (`scale`, `rateHeat`) that are constant for the whole
frame. Now built once per pass.

Not A/B'd: this is a loop-invariant hoist with byte-identical output and
strictly less work — there is no mechanism by which it loses. Filed as Tier A
hygiene ("do not recreate renderer objects during render"), which the procedure
exempts from deliberation, not from honesty about being unmeasured. An earlier
claim of "-10%" for this came from the discredited headless harness and is
withdrawn.

Same reasoning covers the remaining low-N ramp caches (coin glow and body, crate
halo and body, rock body, barricade body) and interning the particle `rgb()`
strings. All are unmeasured; all are strictly-less-work with identical output.

---

## 2026-09-04 — decal ramps: quantise the radius into the cache key ❌ REVERTED

Rounding each scorch mark's radius to the nearest half pixel to raise the cache
hit rate. Reverted before shipping: it trades real output fidelity for a saving
no measurement asked for, at a site capped at 24 entities. The emitters ask for
a handful of fixed radii times a frame-constant `scale`, so **exact** keys
already hit for almost every decal.

Kept: the ramp cache itself at full precision.

---

## Not attempted

- `shadowBlur` removal — the usual first suspect on canvas, and **there is no
  `shadowBlur` anywhere in this codebase.** The 46 hits an early grep attributed
  to it are all `globalCompositeOperation` (39 of them `'lighter'`), already
  bucketed to two switches per frame by the particle pass. Do not re-open this.
- Porting the renderer to WebGL (Rapid.js / PixiJS) — the renderer is procedural
  vector Canvas2D with 12 `drawImage` calls in the whole codebase, so a sprite
  batcher has nothing to batch until far more of the art is baked. See the
  sprite-baking work in `spriteBake.test.ts` / `monsterSprites.ts` for the path
  that would have to come first.
