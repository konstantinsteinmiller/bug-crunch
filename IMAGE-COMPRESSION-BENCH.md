# Image compression — benchmark and pipeline

_2026-09-08 · sharp 0.35.4 / libvips 8.18.6 · @napi-rs/image 1.14.0 · ssim.js 3.5.0_

**Result.** `pnpm compress-folder <dir>` reproduces TinyPNG locally with npm
packages only (no API key, no system binaries). On 55 real TinyPNG before/after
pairs from this repo it lands **2.1 % below TinyPNG's total** at a
**guaranteed minimum quality above TinyPNG's worst outputs**, and on the four
sample images it saves **73.6 %** overall.

```
pnpm compress-folder src/assets/promotion            # compress in place, keep <name>-original.<ext>
npm run compress-folder -- src/assets/promotion      # npm needs the "--", or it eats every --flag itself
pnpm compress-folder public/images --dry-run          # plan + measure, write nothing
pnpm compress-folder public/images --backup-dir public-backup      # public/ ships verbatim — keep backups out of it
pnpm compress-folder <dir> --force                    # redo from the pristine backups (no generation loss)
pnpm compress-folder <dir> --min-ssim 0.97 --min-psnr 35          # TinyPNG-aggressive
pnpm compress-folder <dir> --min-ssim 0.985 --min-psnr 38         # stricter
pnpm compress-bench <files…> --pairs originals,reference --out IMAGE-COMPRESSION-BENCH.md
```

## 1. What the pipeline does

`scripts/compress-images.mjs` walks a folder recursively (`png jpg jpeg webp`;
`*-original.*` and `node_modules/.git/dist` skipped) and, per file:

1. decodes the original once (EXIF orientation baked in) and builds the
   reference: the **content box** (bounding box of non-transparent pixels)
   composited over mid-grey, plus the list of soft-edge pixels (0 < α < 255);
2. runs a **smart-lossy search** for the lowest quality that clears three
   floors — starts at q80, steps down by 10 while all floors hold, refines by
   5 and by 2, or steps up by 5 until they hold; 4-6 encodes per file;
3. keeps the smallest passing encode only if it is smaller than the input;
   PNGs additionally get an **oxipng lossless re-pack** (6-17 % smaller, pixels
   untouched) and a lossless fallback if no lossy quality passes;
4. copies the original to `<name>-original.<ext>` (or `--backup-dir`) and
   writes the result in place. A file that already has a backup is skipped;
   `--force` re-compresses **from the backup**, so re-runs never stack loss.

| floor | default | why |
|---|---|---|
| SSIM (grey-composited, content box) | ≥ 0.98 | structure; the main perceptual guard |
| PSNR (same) | ≥ 36 dB | SSIM is blind to spread-out palette/dither noise |
| mean alpha error on soft edges | ≤ 6 / 255 | palette PNGs trade alpha levels for colours; at q ≤ 90 a logo's anti-aliased edge collapses to ~10 alpha steps and looks jagged while SSIM and PSNR still pass |
| quality window | 50 – 95 | below 50 libwebp/mozjpeg get blocky regardless of the metrics |

Per format: **PNG** libimagequant palette via sharp (dither 1.0, effort 10) +
oxipng; **JPEG** mozjpeg via sharp (trellis, progressive, optimised Huffman);
**WebP** libwebp via sharp, effort 5, sharp-YUV chroma (`smartSubsample`).
`--max-effort` adds one final webp encode at effort 6 (≈ 3 % smaller, ≈ 20×
slower per encode — see §5).

## 2. What was compared

| wrapper | codecs | verdict |
|---|---|---|
| **sharp** (libvips, prebuilt) | mozjpeg, libwebp, libimagequant + libspng | **winner** — best size at equal quality for JPEG, most knobs for WebP, same quantiser as pngquant/TinyPNG |
| **@napi-rs/image** (Rust, prebuilt) | mozjpeg, libwebp, imagequant, **oxipng** | kept for oxipng only; its mozjpeg quality scale gives 10-40 % larger JPEGs at the same q; imagequant `speed 1` takes 7-11 s per megapixel |
| @jsquash/{jpeg,webp,oxipng} (wasm) | mozjpeg, libwebp, oxipng | parity with sharp on webp (same libwebp), 3 % larger JPEG at q80, oxipng L4 takes ~60 s per megapixel — not worth the Node shims |
| TinyPNG | — | the reference: 55 real outputs found in `public/images/*/tinified.zip`, originals recovered from commit `8bcbafb` |

All three wrappers are the *same* underlying codecs; what differs is defaults
and exposed knobs. Quality was scored with `ssim.js` + PSNR on RGB after
compositing over grey (so alpha edits count and RGB garbage under α = 0 does
not), over the content box.

Sample set: `src/assets/promotion/cover-logo_1920x1080.jpg`,
`src/assets/art/hand-drawn-props2.png`, `src/assets/art/logo/logo_1024x1024.png`,
`src/assets/promotion/cover-logo_1920x1080.webp`. Reference set: 53 webp sprite
strips/icons + 2 PNG logos, minus `props/coin.webp` whose "original" turned out
to be a different drawing (SSIM 0.18).

## 3. Findings per format (sample images)

### JPEG — cover-logo_1920x1080.jpg (215.3 KB)

| candidate | KB | vs original | SSIM | PSNR |
|---|---:|---:|---:|---:|
| sharp mozjpeg q70 | 166.6 | −22.6 % | 0.9985 | 41.6 |
| sharp mozjpeg q75 | 182.2 | −15.3 % | 0.9994 | 43.2 |
| sharp mozjpeg q80 | 199.0 | −7.6 % | 0.9996 | 44.8 |
| sharp libjpeg q80 progressive | 213.4 | −0.9 % | 0.9996 | 43.5 |
| jsquash mozjpeg q80 | 222.4 | +3.3 % | 0.9996 | 46.7 |
| sharp mozjpeg q80 4:4:4 | 226.7 | +5.3 % | 0.9996 | 49.4 |
| napi mozjpeg q75 | 234.5 | +8.9 % | 0.9996 | 47.9 |
| napi mozjpeg q80 | 253.7 | +17.9 % | 0.9996 | 47.9 |

mozjpeg through sharp is ~8 % smaller than plain libjpeg at the same SSIM.
Pipeline result: **118.3 KB (−45 %) at q50, SSIM 0.9976, 37.8 dB** — clean at
2× zoom (cartoon render; a photo would stop higher).

### PNG — logo_1024x1024.png (334.0 KB, alpha) and hand-drawn-props2.png (1218.5 KB, opaque)

| candidate | logo KB | logo SSIM / PSNR | props KB | props SSIM / PSNR |
|---|---:|---|---:|---|
| sharp palette q60 e10 | 29.1 | 0.9936 / 42.3 | 216.8 | 0.9988 / 38.1 |
| sharp palette q80 e10 | 42.6 | 0.9936 / 45.3 | 274.8 | 0.9996 / 43.1 |
| sharp palette q80 + oxipng | 39.1 | same | 257.8 | same |
| sharp palette q90 e10 | 82.0 | 0.9996 / 48.6 | 274.8 | 0.9996 / 43.1 |
| napi quant 65-90 s1 | 136.9 | 0.9999 / 54.1 | 210.1 | 0.9990 / 39.8 |
| napi oxipng (lossless) | 311.5 | 1 / ∞ | 765.5 | 1 / ∞ |
| jsquash oxipng L4 (lossless, ~60 s) | 301.9 | 1 / ∞ | 884.6 | 1 / ∞ |
| sharp lossless c9 adaptive | 324.5 | 1 / ∞ | 871.9 | 1 / ∞ |

`quality` in sharp is libimagequant's *max* quality (napi's `maxQuality`), so
"napi 65-90" ≈ "sharp q90". Dither level (0 / 0.5 / 1) made no measurable
difference on either logo. What does matter for PNGs with alpha:

| logo_1024 palette q | alpha levels kept | mean alpha err on edges | KB (+ oxipng) |
|---:|---:|---:|---:|
| 50 | 7 | 15.1 | 25.4 |
| 70 | 11 | 11.0 | 28.4 |
| 80 | 13 | 10.0 | 39.1 |
| 90 | 18 | 7.4 | 76.0 |
| 100 | 73 | 3.2 | 154.7 |

At 3× zoom q90 still shows rough anti-aliasing on the white lettering; q100
matches the original. Hence the alpha-error floor. Pipeline results:
**logo_1024 103.0 KB (−69 %) at q95 (51.5 dB, alpha ± 5.3)**;
**props sheet 182.5 KB (−85 %) at q50** (opaque, so only SSIM/PSNR apply);
logo_512 12.4 KB vs TinyPNG's 23.1 KB.

### WebP — cover-logo_1920x1080.webp (104.0 KB, already lossy)

| candidate | KB | vs original | SSIM | PSNR |
|---|---:|---:|---:|---:|
| sharp q70 e6 smart | 99.3 | −4.6 % | 0.9987 | 42.4 |
| napi webp q75 | 102.2 | −1.7 % | 0.9985 | 42.1 |
| sharp q80 e6 smart | 112.6 | +8.3 % | 0.9988 | 42.3 |
| sharp q80 e4 smart | 112.7 | +8.3 % | 0.9987 | 42.2 |
| sharp q80 e6 plain / jsquash q80 m6 / napi q80 | 112.7-112.8 | +8.3 % | 0.9988 | 41.9 |
| sharp nearLossless q60 | 912.1 | +777 % | 0.9997 | 50.4 |
| sharp lossless e6 | 1206.1 | +1059 % | 1.0000 | ∞ |

Every wrapper is libwebp; sizes agree within 1 %. Re-encoding an existing
lossy webp only pays below its original quality — the pipeline's floors decide
(here: 86.3 KB, −17 %, at q50 / 38.8 dB). Near-lossless and lossless webp are
never an option for this kind of art.

## 4. Against TinyPNG (55 real pairs)

**What TinyPNG delivers.** Its webp outputs sit at median **38.1 dB / SSIM
0.993**, the 10th percentile at ~34 dB / 0.971, the worst at **31.7 dB /
0.952** (small textured props). Its PNG logos are near-lossless
(51.7 dB, 256-colour palette). Matching each file's TinyPNG quality with sharp
lands on **q75** almost every time, i.e. TinyPNG's webp is libwebp at q ≈ 75,
effort 6 — the codec is at parity (+3.4 % on a 5-step grid at effort 5); only
the *quality choice* differs.

**Codec matrix on the pairs** (fixed settings, no search; `pnpm compress-bench
--pairs`, 8 files in parallel so the ms column is relative only):

| webp candidate (53 files, 1613.6 KB original) | total KB | vs TinyPNG | files ≤ TinyPNG | mean SSIM | min SSIM | mean PSNR |
|---|---:|---:|---:|---:|---:|---:|
| sharp q70 e5 smart | 952.3 | −1.9 % | 51/53 | 0.9867 | 0.9466 | 37.85 |
| **sharp q75 e6 smart** | **962.5** | **−0.8 %** | 30/53 | 0.9878 | 0.9512 | 38.34 |
| **TinyPNG** | **970.5** | 0 | — | 0.9880 | 0.9518 | 37.99 |
| sharp q75 e5 smart | 981.8 | +1.2 % | 4/53 | 0.9881 | 0.9515 | 38.38 |
| napi webp q75 | 995.0 | +2.5 % | 0/53 | 0.9890 | 0.9540 | 38.42 |
| sharp q80 e5 smart alphaQuality 80 | 1009.5 | +4.0 % | 7/53 | 0.9912 | 0.9617 | 39.89 |
| jsquash webp q80 m6 | 1055.3 | +8.7 % | 0/53 | 0.9910 | 0.9601 | 39.59 |
| sharp q80 e5 plain | 1072.0 | +10.5 % | 0/53 | 0.9911 | 0.9603 | 39.62 |
| sharp q80 e5 smart | 1078.5 | +11.1 % | 0/53 | 0.9912 | 0.9617 | 39.89 |
| napi webp q80 | 1084.7 | +11.8 % | 0/53 | 0.9916 | 0.9625 | 39.78 |
| sharp q80 e4 smart | 1092.3 | +12.6 % | 0/53 | 0.9916 | 0.9645 | 40.05 |
| sharp q80 e5 preset drawing | 1117.4 | +15.1 % | 0/53 | 0.9914 | 0.9601 | 40.25 |
| sharp q85 e5 smart | 1240.5 | +27.8 % | 0/53 | 0.9944 | 0.9757 | 41.76 |
| sharp q90 e5 smart | 1479.0 | +52.4 % | 0/53 | 0.9980 | 0.9926 | 46.03 |
| sharp nearLossless q60 | 2700.0 | +178 % | 0/53 | 0.9994 | 0.9966 | 51.89 |

`sharp q75 e6 smart` and TinyPNG have the same size, the same mean and minimum
SSIM and the same PSNR to within 0.4 dB — that row *is* TinyPNG. Two more
things the matrix shows: `alphaQuality: 80` saves ~6 % over lossless alpha at
identical SSIM/PSNR (not enabled; the alpha-error floor would police it — a
candidate for a later pass), and the `drawing` preset is worse, not better, on
this art.

| png candidate (2 logos, 97.7 KB original) | total KB | vs TinyPNG | mean SSIM | mean PSNR |
|---|---:|---:|---:|---:|
| sharp palette q60 e10 | 18.4 | −34.4 % | 0.9998 | 45.64 |
| sharp palette q80 + oxipng | 20.1 | −28.3 % | 0.9999 | 48.47 |
| napi quant 65-90 s1 (+ oxipng: same) | 23.0 | −18.0 % | 0.9999 | 49.39 |
| sharp palette q80 e10 | 23.3 | −17.1 % | 0.9999 | 48.47 |
| **TinyPNG** | **28.0** | 0 | 1.0000 | 52.00 |
| sharp palette q90 e10 | 29.3 | +4.4 % | 1.0000 | 51.56 |
| jsquash oxipng L4 (lossless) | 74.4 | +165 % | 1.0000 | ∞ |
| napi oxipng (lossless) | 78.4 | +179 % | 1.0000 | ∞ |

**Floors vs total size** (content-box metrics, final pipeline):

| floors SSIM / PSNR | total vs TinyPNG | files ≤ TinyPNG |
|---|---:|---:|
| 0.985 / 38 dB | +8.8 % | 17 / 55 |
| **0.98 / 36 dB (default)** | **−2.1 %** | 28 / 55 |
| 0.97 / 35 dB | −7.3 % | 35 / 55 |

Pattern: on the large sprite strips (monsters, heroes, gates, backgrounds,
logos) the pipeline is **5-46 % smaller** than TinyPNG at the same or better
quality; on the small textured props/fx icons TinyPNG went down to 33-36 dB,
which the 36 dB floor refuses, so those come out 10-90 % larger — and they are
the smallest files in the set. Lower the floors if that trade is wanted.

```
file                       original   TinyPNG    pipeline   Δ     setting        SSIM   PSNR
logo/logo_512x512.png       82.8 KB   23.1 KB    12.4 KB   -46%  palette q50+ox 0.9972 36.1
logo/logo_192x192.png       14.9 KB    4.9 KB     2.9 KB   -41%  palette q55+ox 0.9983 36.4
gates/frame-mul.webp         9.1 KB    4.5 KB     3.5 KB   -21%  webp q50       0.9844 37.7
gates/frame-sub.webp        11.6 KB    5.6 KB     4.7 KB   -17%  webp q50       0.9941 36.9
ui/ribbon.webp              18.2 KB    9.3 KB     7.9 KB   -16%  webp q55       0.9862 36.1
monsters/grumpling.webp     67.2 KB   39.3 KB    33.7 KB   -14%  webp q50       0.9932 36.4
monsters/blorp.webp         49.9 KB   30.7 KB    26.4 KB   -14%  webp q50       0.9945 37.0
gates/frame-div.webp         9.1 KB    4.5 KB     3.8 KB   -14%  webp q50       0.9910 38.5
gates/frame-add.webp        10.4 KB    5.8 KB     5.0 KB   -13%  webp q50       0.9974 38.4
monsters/marrowknight.webp  67.0 KB   39.8 KB    34.5 KB   -13%  webp q50       0.9899 36.6
heroes/amber.webp           59.5 KB   34.2 KB    30.8 KB   -10%  webp q55       0.9899 36.2
monsters/nibbler.webp       53.0 KB   34.8 KB    31.7 KB    -9%  webp q50       0.9918 36.9
heroes/violet.webp          78.3 KB   50.1 KB    45.7 KB    -9%  webp q55       0.9885 36.1
monsters/wispling.webp      59.2 KB   37.6 KB    34.3 KB    -9%  webp q55       0.9948 36.1
monsters/cinderhound.webp   72.1 KB   48.4 KB    44.2 KB    -9%  webp q50       0.9924 36.5
fx/ring-heal.webp           12.4 KB    6.6 KB     6.0 KB    -9%  webp q63       0.9899 36.0
bg/ridge-near.webp          27.3 KB   17.7 KB    16.2 KB    -9%  webp q50       0.9906 39.0
monsters/gloomcrow.webp     73.5 KB   51.1 KB    46.8 KB    -8%  webp q50       0.9909 36.4
monsters/rattlejack.webp    79.2 KB   52.8 KB    48.4 KB    -8%  webp q55       0.9937 36.2
monsters/skewer.webp        66.6 KB   45.0 KB    41.4 KB    -8%  webp q50       0.9938 38.8
heroes/teal.webp            61.7 KB   38.7 KB    35.8 KB    -8%  webp q58       0.9935 36.0
monsters/snaggletusk.webp   62.8 KB   36.7 KB    34.3 KB    -7%  webp q60       0.9839 36.1
monsters/thornwick.webp    108.0 KB   76.5 KB    71.6 KB    -6%  webp q50       0.9920 38.9
bg/ridge-far.webp           18.6 KB   13.8 KB    12.9 KB    -6%  webp q50       0.9892 43.9
props/lever-arm.webp         7.5 KB    4.2 KB     3.9 KB    -6%  webp q65       0.9946 36.1
monsters/dustmoth.webp      64.2 KB   40.9 KB    38.8 KB    -5%  webp q63       0.9933 36.2
fx/ring-shock.webp          16.8 KB   10.2 KB     9.9 KB    -3%  webp q65       0.9924 36.3
monsters/bonecap.webp       81.2 KB   50.0 KB    48.6 KB    -3%  webp q68       0.9936 36.0
ui/skill-grenade.webp        4.4 KB    2.4 KB     2.6 KB    +7%  webp q78       0.9807 37.7
fx/smoke.webp               11.9 KB    6.7 KB     7.2 KB    +8%  webp q78       0.9844 36.4
fx/ring-heat.webp           18.6 KB   10.3 KB    11.2 KB    +8%  webp q78       0.9891 36.1
props/boulder-3.webp        14.4 KB    7.2 KB     7.9 KB    +9%  webp q78       0.9819 37.7
rounds/rocket.webp           9.8 KB    5.3 KB     5.9 KB   +10%  webp q78       0.9902 36.5
ui/crown.webp                7.6 KB    4.1 KB     4.7 KB   +15%  webp q80       0.9878 36.0
logo/logo_256x256.webp       7.8 KB    4.8 KB     5.9 KB   +22%  webp q85       0.9980 36.6
rounds/grenade.webp          5.0 KB    2.3 KB     2.9 KB   +27%  webp q83       0.9830 37.7
fx/muzzle.webp               9.2 KB    5.5 KB     7.0 KB   +28%  webp q83       0.9974 36.2
props/boulder-1.webp        14.8 KB    7.2 KB     9.3 KB   +29%  webp q83       0.9827 38.8
props/barricade.webp        34.1 KB   18.4 KB    23.8 KB   +30%  webp q83       0.9923 36.7
fx/scorch.webp              11.0 KB    5.6 KB     7.3 KB   +31%  webp q83       0.9824 38.7
rounds/bomb.webp            20.7 KB   10.4 KB    13.6 KB   +32%  webp q83       0.9805 37.5
props/boulder-2.webp        16.8 KB    8.5 KB    11.2 KB   +32%  webp q83       0.9839 38.9
props/pillar.webp           12.9 KB    6.5 KB     8.7 KB   +32%  webp q83       0.9914 36.1
fx/shield.webp              21.3 KB   10.5 KB    13.9 KB   +33%  webp q83       0.9810 37.4
props/barrel.webp           18.4 KB    8.4 KB    11.2 KB   +34%  webp q83       0.9832 38.2
ui/skill-shield.webp         5.5 KB    2.6 KB     3.5 KB   +34%  webp q85       0.9928 36.7
ui/chest.webp                6.5 KB    3.2 KB     4.3 KB   +35%  webp q85       0.9921 36.7
props/lever-post.webp       22.0 KB    9.1 KB    12.4 KB   +36%  webp q83       0.9807 38.7
props/crate-damage.webp     15.8 KB    7.1 KB     9.7 KB   +37%  webp q83       0.9840 39.1
props/crate-rate.webp       23.7 KB   10.4 KB    14.6 KB   +40%  webp q83       0.9809 37.4
fx/guard.webp               20.2 KB   10.0 KB    14.6 KB   +47%  webp q85       0.9900 36.7
rounds/tracer.webp           2.2 KB    1.0 KB     1.4 KB   +48%  webp q88       0.9983 38.4
fx/crest-guard.webp          7.1 KB    3.1 KB     4.5 KB   +48%  webp q85       0.9840 37.4
fx/crest-shield.webp         5.3 KB    2.2 KB     3.7 KB   +67%  webp q88       0.9855 41.1
props/guard-plate.webp      22.1 KB    9.2 KB    17.9 KB   +94%  webp q88       0.9871 41.0

total: original 1711 KB · TinyPNG 999 KB (-42%) · pipeline 977 KB (-43%, -2.1% vs TinyPNG)
```

## 5. Speed

libwebp effort 6 is the trap: on a 1824×256 alpha strip it takes **21 s** per
encode versus **0.9 s** at effort 5 for a 3 % smaller file (effort 3/4/5/6:
31.5 / 30.8 / 29.5 / 28.6 KB). The search therefore runs at effort 5 and
`--max-effort` adds one effort-6 encode for the chosen quality. Encodes are
single-threaded inside libvips, so the script parallelises across files
(default: half the cores, max 8). The 55-file reference set takes ~75 s on a
32-thread desktop; imagequant at effort 10 costs 1-5 s per megapixel, mozjpeg
~1 s per 2 MP.

## 6. Traps met on the way

- **`public/` ships verbatim.** A sibling `<name>-original.webp` under
  `public/images` goes straight into every portal zip. Use `--backup-dir` there.
  Nothing in `src` globs images (assets are probed by name at runtime), so
  sibling backups are harmless in `src/assets`.
- **Re-encoding an already-lossy file** stacks generation loss. The script
  never does it twice: a backup marks a file as done, and `--force` reads the
  backup, not the compressed file.
- **Metrics without alpha handling lie.** Encoders leave RGB garbage under
  α = 0; scoring raw RGBA makes a perfect encode look terrible. Composite over
  grey first. Scoring the whole canvas instead of the content box lets a sprite
  with wide transparent margins pass on its padding.
- **PSNR alone is blind to textures, SSIM alone to palette noise, both to
  alpha collapse.** Three floors, not one.
- **wasm codecs in Node** need `globalThis.ImageData` polyfilled and the
  `.wasm` compiled from the package path (`fetch` cannot load `file:` URLs);
  `@jsquash/oxipng` must be imported from `optimise.js`, not the package root.
- **`npm run script --flag` never delivers the flag.** npm keeps every
  `--option` for itself (it shows up as `npm_config_option=true`) and forwards
  only positionals; `--backup-dir public-backup` became a stray positional and
  the run silently used sibling backups at default effort. Use
  `npm run compress-folder -- <dir> …`, call `node scripts/…` directly in
  package.json scripts, or use pnpm, which forwards flags. The script now
  detects swallowed flags and refuses to run.
- **Git Bash mangles `A,B` path pairs** passed to Node (MSYS converts only the
  first `/c/...`); pass Windows-style paths or set `MSYS_NO_PATHCONV=1`.
- **TinyPNG's originals are recoverable.** `tinified.zip` next to the assets is
  the download; the commit before the swap holds the inputs. Exclude pairs
  whose SSIM is far below 0.9 — the art changed between commits.

## 7. Reusing this in another project

1. `pnpm add -D sharp ssim.js @napi-rs/image` (all prebuilt; no build step).
2. Copy `scripts/compress-images.mjs` and `scripts/image-compress-bench.mjs`.
3. Add `"compress-folder": "node scripts/compress-images.mjs"` and
   `"compress-bench": "node scripts/image-compress-bench.mjs"` to `scripts`.
4. `pnpm compress-folder <dir> --dry-run`, eyeball the plan, then run for real.
   For `public/` trees pass `--backup-dir`. Consider ignoring `*-original.*`
   in `.gitignore` if the originals should not be committed.
5. To re-calibrate for a different art style: `pnpm compress-bench` on a few
   representative files (plus `--pairs` if a reference tool's outputs exist),
   then adjust `CONFIG` at the top of `compress-images.mjs`.
