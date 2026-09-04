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
| Runner | `scripts/perf-ab.mjs` | `pnpm perf:ab` — interleaved, CPU-throttled, paired verdict. |
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
