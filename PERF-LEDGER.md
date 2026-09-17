# Performance ledger — Bug Crunch

Every performance experiment run on this project, **including the ones that did
nothing**. Written by the `web-game-performance-optimize` skill. Newest first.
Never delete a row — supersede it.

## Budget

| | |
|---|---|
| Target device profile | cheap Android phone, Chrome. Desktop proxy: headless Chrome 152, 4× and 6× CPU throttle, 360×800 DPR 3, touch + Android UA |
| Target | 60 fps → 16.7 ms/frame |
| Primary metrics | frames over 33 ms per window, long tasks, rAF-interval p95/p99 (vsync-quantized, so over-budget counts carry the signal) |
| Scenarios | fresh first load → intro cutscene → 1-1…1-3 play (30 s); 3-3 seeded save: level start (8 s) + play (30 s); Juice Style switch mid-play (+30 s); 1-4 boss (stinger + fight) |
| Harness | out-of-tree CDP driver (production build via `vite preview`, in-page probe injected before app scripts, autopilot over `window.__run` with `localStorage.cheat`, fresh browser context per rep, interleaved A/B) |

## Experiments

### 2026-09-17 hud-per-frame — the clock chip and the chain ring stop taking a fresh float every frame   [SHIPPED, FRAME-TIME UNMEASURED]
- Area:        `useBugCrunchGame.ts` — `timeLeft` / `chainLeft`, flag `hud-per-frame-legacy`
- Hypothesis:  the standing conclusion below says the biggest main-thread cost in
               play is Vue re-renders, not audio. Two refs were the trigger for
               ~all of them: `timeLeft` took a float every frame (the chip prints
               `Math.ceil`, i.e. the same value ~59 times out of 60) and
               `chainLeft` took one every frame for the whole of a chain. Every
               write re-renders the component that owns the HUD subtree.
               Change: the sim keeps its float clock in `clockMs`, `timeLeft`
               holds whole seconds and is written only when the printed second
               changes, and `chainLeft` is quantised to 1/24ths.
- Mechanism:   PINNED BY TEST, not by a timing run —
               `tests/game/sim.test.ts` → "the HUD is only told when what it
               prints changes": ≤6 clock writes per 5 s of frames (was ~300),
               ≤26 ring writes per chain window (was ~90), the ring still lands
               exactly on 0 the frame a chain lapses, and the clock still counts
               down in real time. All three fail on the legacy path.
- Setup:       interleaved A/B, 4 reps, 6×, production build, `--urls` arms.
- Result:      **INVALID — no usable numbers.** Both arms ran at ~2 fps
               (`intP50` 458 ms legacy / 492 ms new against 16.8 ms for the same
               scenario in the rows above), and unthrottled the page still paced
               at 50 ms/frame while doing 3.4 ms of work — i.e. frame cadence on
               this machine was capped by something outside the game (other
               GPU-heavy apps were up), so no frame-time delta can be read out
               of it in either direction.
- Verdict:     SHIP the quantisation on the mechanism (strictly fewer reactive
               writes, no behaviour change beyond the ring's 4 % steps, cost is
               one `Math.ceil` per frame), and leave the frame-time claim OPEN.
- Follow-up:   re-run on a quiet machine or a real phone:
               `node ab.mjs level --throttle 6 --reps 4 --prefix hud
                 --urls "legacy=<host>/?perf=hud-per-frame-legacy,new=<host>/"`
               and check the legacy arm reproduces `intP50` ≈ 16.8 ms BEFORE
               reading the delta. If it wins, delete the flag and the legacy
               branch; if it is a null result, the flag still goes — the test is
               what keeps the write counts down.
               The rest of the re-render cost is untouched: the HUD templates run
               vue-i18n `translate`/`compile` on every render they do take, and
               the vial and boss bar have continuous values of their own.

### 2026-09-16 bank-idle-only — busy frames render only each cast body's first everyday crush; the rest waits for real idle time   [REVERTED — GREY]
- Area:        crush bank scheduling (`useGameAudio.ts` → `schedulePump` / `pumpCrushBank`)
- Hypothesis:  with every slot on the 60 ms `requestIdleCallback` timeout, a slow
               phone renders the whole bestiary inside full frames (3 ms slices that
               overrun by one voice to 20–50 ms at 6×). Keeping the timeout only for
               the cast's tier-0 crush and sending the rest to timeout-less idle
               callbacks should cut over-budget frames while the bank fills.
               Cost: ~60 LOC, bank fills later on a busy phone.
- Setup:       6×, 360×800 DPR 3, headless, interleaved, both arms in one build
               (`?perf=bank-legacy`), 4–6 reps per window. Machine shared with other
               agents' dev servers and browsers — noisy.
- Result:      (median, legacy → new; "pairs" = interleaved reps where new was lower)
               3-3 play 30 s     >33 ms frames 174.5 → 141.5 (-19 %, 4/4)  long tasks 112 → 87.5 (4/4)
               1-1..1-3 play 30s >33 ms frames 93 → 76 (5/6)               long tasks 60 → 34.5 (5/6)
               3-3 level start   >33 ms frames 33 → 22 (3/4, ranges overlap)
               intro cutscene    >33 ms frames 8 → 8.5 (3/6)  — null
               Juice switch +30s >33 ms frames 129 → 175.5 (1/6)          long tasks 82.5 → 120.5 (1/6)  — REGRESSION
- Verdict:     REVERT. A win while the boot-time bank fills, a regression after a
               Juice Style change. Slice shape was nearly the same in both arms
               (idle callbacks are plentiful even at 6×); what changed was how long
               bodies waited for their buffers — and a body without its buffer plays
               the LIVE squish, which costs the main thread more per kill than the
               bank's slices (see the bank-off row below). Deferring bank work moves
               cost into live synthesis instead of removing it.
- Follow-up:   the bank's real cost is the one-voice OVERRUN per slice (worst unit
               ≈2.2 ms voice / ≈3 ms master pass on desktop Node → 13–18 ms at 6×).
               Next hypotheses, in order: (1) render in a Worker (the DSP is already
               pure and Node-runnable) — zero main-thread DSP, but verify the
               obfuscator/`new URL(…, import.meta.url)` path and portal CSPs;
               (2) split `finish` into staged passes and make voice loops resumable
               at sample granularity so no unit exceeds ~0.5 ms desktop. Re-verify on
               a real phone either way.

### 2026-09-16 bank-off (diagnostic) — the crush bank on vs. never pumped (every crush live-synthesised)   [DIAGNOSTIC]
- Setup:       6×, 3 reps interleaved, legacy scheduling, probe drops the pump's idle callbacks.
- Result:      3-3 level start 8 s  >33 ms frames on 49 vs off 25, long tasks 27 vs 12 — the bank costs frames while it fills
               1-1..1-3 play 30 s   >33 ms frames on 81 vs off 161, long tasks 35 vs 63 — once filled, the bank HALVES jank vs live synthesis
               intro cutscene       >33 ms frames 8 vs 8 — no measurable cost (the whole bank fills during the cutscene)
- Conclusion:  keep the bank. Its cost is front-loaded and bounded; live synthesis is the expensive path during play.

## Standing conclusions

- **The bank itself is a net win during play** (half the over-budget frames of live synthesis at 6×). Don't propose removing it.
- **Deferring bank renders is not free** — fallbacks are live synthesis. Attack slice overrun (unit size / Worker) instead.
- **Two HUD refs no longer re-render the HUD every frame** (2026-09-17 row): the
  clock chip moves when its printed second changes, the chain ring in 1/24ths.
  Pinned by test; the frame-time payoff is still unmeasured on a phone.
- **Biggest main-thread cost in play is not audio**: a 20 s CPU profile of 3-3 at 6× attributed ~3.2 s to Vue `flushJobs` (GameScene, SplatHud, vial, TreasureChest and quest-badge templates re-rendering per frame, with vue-i18n `translate`/`compile` inside), ~2.2 s to `drawScene`, ~1.6 s to the bank pump, ~0.3 s to the sim step, ~0.1 s GC. Unmeasured as a fix — a candidate for its own experiment.
- Desktop-proxy only so far. No real phone has confirmed any row.
