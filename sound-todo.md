# Bug Crunch — sound to-do

Most of this game's cues are now **rendered offline** from physical and modal
models and shipped as six small Vorbis sprites (195 KB in all). Four sources, one
entry point (`playFx`):

* **Rendered cues** — the foot, the chain, the vial, the finisher, the props,
  the set pieces and the boss's tells. Built by `pnpm audio:sfx` from the cue
  sheet in `tools/audio/sfx/recipes.mjs`, played by `useSfxSprites.ts`. See
  **The rendered cues** below.
* **The crush bank** — every body's crush, wound and ricochet (`squish`, `hurt`,
  `clang`, `podPop`, and the boss's `bossHit` / `bossCounter` / `bossDie` body
  layer). Designed per bug, rendered offline-style by pure TypeScript
  (`src/game/audio/crushSynth.ts`) into AudioBuffers during idle time, played as
  one buffer source per kill. See **Priority 1**.
* **Shipped samples** — the coin, the level-end stings, the unlock (`SAMPLE_CUES`).
* **Live Web Audio** — oscillators and noise built per event: the fallback for a
  rendered cue whose sprite has not landed (or will not decode) and for a crush
  whose buffer is not rendered yet, and `countUp`, which nothing fires yet.

Nothing is silent and nothing is missing — the rest of this file says what each
cue is now and what a real recording would still add, in the order that buys the
most.

## How a sample gets in

`playFx(id, power, pan)` in `src/use/useGameAudio.ts` is the single entry point.
It plays a cue's rendered take when it has one (see **The rendered cues**), and
otherwise checks `SAMPLE_CUES`:

```ts
const SAMPLE_CUES: Partial<Record<FxSound, [string, number]>> = {
  coin: ['coin-pickup', 0.21],
  levelClear: ['celebration-1', 0.71],
  bossDie: ['celebration-3', 0.9],
  levelFail: ['lose', 0.1],
  star: ['happy', 0.21],
  unlock: ['level-up', 0.77]
}
```

To replace a synthesised cue: drop `public/audio/sfx/<name>.ogg` and add one row
to that table — `[filename without extension, volume ratio]`. The synthesised
version stays in the file as the fallback and is what plays if the sample fails
to decode.

**Format:** `.ogg` (Vorbis), mono, 44.1 kHz, peak-normalised to about −3 dBFS,
trimmed to the first sample of attack. Keep them short — most of these fire
dozens of times a second.

**Everything runs on the shared `AudioContext` from `useAssets`**, which the ad
and pause gate suspends. That is what makes "no game audio during an ad" true for
free, and a sample added here inherits it.

### Throttling is already in place

`THROTTLES` caps each cue's rate (`squish` is 8 per 300 ms with a 34 ms floor;
`clang` is 3 per 500 ms, because a ricochet is a *negative* cue and a player
hammering a beetle hears it four times a second). A new sample inherits its cue's
budget. **Do not raise a cap to make a sample audible — make the sample shorter.**

---

## Priority 1 — the squish: done, as the crush bank

`squish` is the busiest cue in the game by a wide margin, and the whole mix is
built around it. The GDD asks for *"wet squelch/pop, varied pitch by bug size"*;
the bank goes further — **every body has its own crush**, built from its
material, so a player tracking a busy board hears WHAT died without looking.

### Per body

| Body | `ooze` (default) | `confetti` | `bubble` |
| --- | --- | --- | --- |
| ant | the classic: high plop, juicy two-formant squelch, rising bubbles, a drip | tiny party popper + high paper crinkle | one round soap pop + a small one |
| sprinter | the ant brighter and quicker: a zip, the plop, a second "pip" | streamer whoosh + popper | three quick rising pops |
| flea | a crisp tick and one high bead | tick + micro crinkle | one tiny high pop |
| caterpillar | a muffled plush squash, thick squelch, a soft prickly bristle rustle | tissue-paper scrunch | a soft foam of low pops |
| stinkbug | a squelch, then a comic lip-buzz "pfffft" with a "t" | popper + party-blower raspberry | a big wobbly bubble and a sigh of air |
| centipede | a rolling ripple of 6 (9 on a slam) segment pops | a string of cap pops | a pentatonic run of pops |
| pinatafly | popper, sticky honey squelch, papery crunch, candy raining down | popper + slide whistle, big crunch, more candy | a descending sparkle run |
| moth | a dusty puff and wings fluttering to a stop | tissue-paper flutter | a fizz of micro-bubbles |
| beetle | **chitin**: a pitched shell crack (two stages on a slam), a dense bright crackle, a hollow "tok" — THEN the goo gushing | a cardboard box: woody crack + low box thock | one big low bubble, then small ones escaping |
| robobug | **metal**: bent tin (a plate that sags as it dents, crumple creases), a spring "boing", a spark fizz, a coolant splutter | foil crinkle + boing + popper | a rubber-toy wobble pop |
| pod | a thin egg-shell crack with goo under it | papier-mâché egg with a toy rattling inside | a quick two-note bloop |
| queenAnt | a huge wobbly jelly splat, many bubbles, long drips | big popper + candy shower | big bloop + a rising run |
| beetleKing | the shell going in three stages, a long crackle, a sub, the gush | a three-stage cardboard crack | a huge low bloop + pops |
| matriarch | a long falling ripple of big segment pops into a wet burst | a long cap-pop string | a long rising pentatonic run |
| roachPrime | a big tin crumple, sparks, a boing, a splutter, and a wind-down whine | big foil + boing | a big wobble bloop |

`hurt` is the material **without the release** — the beetle's shell cracks and
holds (crack + crackle + tok, no goo; a slam cracks it in two stages), the
robobug dents, the piñata gets a papery thwack and its candy shifts, the moth is
knocked into a startled flap. A boss's `hurt` is its `bossHit`. `clang` is a
short, plain ricochet per material: a hollow knock off chitin, a rounded tink off
metal, a cardboard knock in confetti, a rubbery bonk in bubble.

### How it works

* **Pure and deterministic.** `renderCrush({ subject, kind, style, variant,
  heavy, sampleRate, seed })` returns a `Float32Array` — no Web Audio in it — so
  it runs in Node, in the tests and in the game alike. The DSP primitives live in
  `src/game/audio/dsp.ts` (enveloped tones with bubble chirps and vibrato,
  noise through a sweeping state-variable filter, Poisson grain clouds with
  heavy-tailed sizes, modal bodies with pitch sag, a two-formant pulse buzz) and
  every render ends in the same master pass: DC block, 8.5 kHz low-pass,
  phone-weighted loudness normalisation, look-ahead limiting at 0.92, tail trim
  at −42 dB and faded edges.
* **Rendered in slices.** A recipe only *records* its voices; `startCrush()`
  runs them a few milliseconds at a time, so the game fills its bank between
  frames and never takes a long task for it, and the slices produce exactly the
  samples a one-shot render does (a test holds that).
* **The bank** (`useGameAudio.ts`): `primeCrushBank({ style, cast, boss })` is
  called by the scene on every level start and Juice Style change. It renders the
  level's cast first (one everyday crush per body, then slams, wounds, ricochets,
  then the remaining variants), then the rest of the bestiary, into AudioBuffers
  on the **shared** context at 24 kHz. Budget: **6 MB decoded** — the whole
  bestiary plus the biggest boss and its pods measures 2.7 MB (104 buffers; a
  world-one cast alone is ~0.2 MB); past 80 % only the level's own cast
  is rendered, and a new level may evict bodies it cannot show. A Juice Style
  change rebuilds the bank.
* **Playing a crush** is one `AudioBufferSource` → gain → `StereoPanner`,
  registered with `registerOneShotSource` so an interstitial hard-stops it.
  Variants: 4 per everyday crush, 3 per slam, 3/2 per wound, 2 per ricochet,
  never the same one twice in a row, plus ±4.5 % playback-rate and ±10 % gain
  jitter. Until a body's buffer exists, the old three-layer live squish plays —
  nothing is ever silent; a slam whose heavy variants are still rendering plays
  the body's own light crush a touch lower and louder instead.
* **The body voice.** The scene calls `setSquishVoice({ bug, style, heavy })`
  immediately before `squish`, `hurt`, `clang`, `podPop` and the boss cues. The
  sim's `hurt` and `clang` events carry the bug id and `heavy` for this; a clang
  with no bug rang off the boss.

### Levels (phone-weighted, at the mix, before the player's slider)

| Cue | Old live synth | Crush bank |
| --- | --- | --- |
| light crush | squish −31.7 | −26.5 … −29.5 (the old squish's juice sat around 500 Hz, which a phone barely plays; integrated EBU R128 is about equal) |
| armoured slam-kill | — | ≈ −24, still under `stompHeavy` (≈ −22 … −23) |
| `hurt` | −36.9 | −27 … −31 |
| `clang` | −25.1 | ≈ −31 — deliberately quieter; it is a negative cue |

Per-kind gains are `CRUSH_MIX` in `crushSynth.ts`; per-body trims are
`TRIM_DB`. Re-measure after any change with the audition tool.

### Auditioning

```
pnpm audio:render -- --out <dir> --png           # every body × style × kind
pnpm audio:render -- --only beetle,robobug --styles ooze --png
```

Writes a WAV per body/style/kind, every variant back to back, a **rapid-fire**
file per body (six kills in 1.2 s with the runtime's own variant rotation and
jitter — the machine-gun test), a runtime-gain catalogue per style, the old live
cues as `reference/legacy-*.wav`, `report.txt` with duration, peak, DC, loudness
against `stompHeavy`, spectral features and the closest-sounding pair per style,
and with `--png` a spectrogram-over-waveform per file plus a labelled contact
sheet per style. In the dev build, `/#/bug-lab` → **audio** has a play button per
body, kind and style.

### What a recorded sample would still add

Probably nothing for the everyday crushes — the bank is per-body, varied and
free to download. If one ever replaces a body, keep the per-body identity above
and the length (< 400 ms for a bug), and feed it through the same bank slot
rather than `SAMPLE_CUES`, so the variant rotation, jitter and pan still apply.

`spike`, the one cue this section used to ask for, is now rendered (below).

---

## The rendered cues — how every priority below is built

Everything in Priorities 2–6 (and `spike`) is now **rendered offline** from
physical and modal models and shipped as six Vorbis **sprites** — several takes
of several cues per file — instead of being built from oscillators per event.

```
pnpm audio:sfx                          # audition set → <tmp>/bug-crunch-sfx-build
pnpm audio:sfx -- --png                 # + spectrogram/waveform per cue
pnpm audio:sfx -- --only finisher,pins  # a few cues
pnpm audio:sfx -- --ship                # write public/audio/sfx/sfx-*.ogg and the manifest
```

* **The cue sheet** is `tools/audio/sfx/recipes.mjs`: per cue its takes, its
  sprite, how the runtime picks a take, its room, its sub cut and its **target
  level in the mix** (the phone-weighted scale the crush bank uses). The voices
  it is built from are in `sfx/instruments.mjs` (a kick-drum body saturated so a
  phone hears its weight as harmonics, floorboards, mallet bars, a wood block, a
  chitin shell, cardboard, a maple bowling pin, a coin disc, a snare, a friendly
  crash, claps and applause, a pea whistle, a cartoon brass section, a party
  blower, a popper) on the primitives in `sfx/dsp.mjs` (modal resonator banks
  excited by a contact force — so a softer strike is darker, not just quieter —
  Karplus–Strong, a formant reed, FM bells, band-limited oscillators,
  time-varying state-variable filters, 4×-oversampled saturation, FFT
  convolution with synthetic rooms).
* **Mastering** (`sfx/master.mjs`, `sfx/render.mjs`): DC block, 4th-order sub cut
  (45–300 Hz per cue — no sub a phone speaker cannot play, eating the headroom),
  optional presence lift, 10 kHz top cut, edges trimmed to the first sample of
  attack and faded; takes loudness-matched to each other, then one scale per cue
  to a −3 dBTP true-peak ceiling with at most 1.5 dB of look-ahead limiting.
  Loops render three periods, keep the middle one, and run every filter
  circularly, so they are seamless by construction.
* **Shipping**: decimated to 22.05 kHz (windowed-sinc), packed into sprites with
  silent gaps (a loop carries a guard copy of its own tail and head on both
  sides, so neither the decoder's resampler nor the Vorbis window sees a
  discontinuity at a loop point), Vorbis q2, then **decoded back and
  re-measured**: exact sample counts, true peaks, loop seams, and the codec's
  level drift — taken back out of the shipped gain (Vorbis adds up to ~1 dB to a
  noisy cue).
* **Runtime**: `useSfxSprites.ts` loads and plays them; `playFx` tries the
  rendered take first. The `SAMPLE_CUES` row and the live `synth()` recipe stay
  as the fallbacks — for a sprite still downloading and for a browser that cannot
  decode Vorbis — so no cue is ever silent. The manifest is generated
  (`src/game/audio/sfxSprites.ts`); a test fails if it and the cue sheet disagree.
* **Staging and payload**: tier 1 is what level 1-1 can play (`sfx-foot` 16.4 KB,
  `sfx-chain` 27.3 KB, `sfx-flow` 38.0 KB — **81.6 KB**) and loads with the idle
  SFX preload after the paintings. Tier 2 (`sfx-props` 32.1, `sfx-sets` 57.1,
  `sfx-boss` 24.5 — **113.7 KB**) loads on an idle slot once the first level has
  ended (a minute after tier 1 at the latest); any cue asked for before its
  sprite has landed starts that sprite loading and plays the live synth
  meanwhile. **195.3 KB in all.** Decoded buffers are halved to 22.05/24 kHz
  (exact — the files hold nothing above 11 kHz): ~4.9 MB for the whole set.
* **The ad-mute guarantee**: every take plays on the ONE shared context through
  the same `route()` as every other voice, every source — loops included — is
  registered with `registerOneShotSource`, nothing creates a context or a media
  element (a test reads the module's source for that), and `playFx`'s gates run
  first. Checked in headless Chrome and Firefox: every cue plays through the
  sprite path, a held loop dies with `killOneShotSfx`, nothing starts while the
  context is suspended.
* **Variation**: the takes rotate (never the same one twice in a row) with a
  ±1–4 % rate and ±10 % gain jitter — the crush bank's rule; `pnpm audio:sfx`
  writes a machine-gun file per busy cue (`rapid/`). Notes (the chain, the stars,
  the shoebox, the finisher) are indexed and never jittered: a note stays in tune.

### Levels (phone-weighted dB at the mix, before the player's slider)

`ph50` is the crush bank's meter (loudest 50 ms); the long cues are set on
`ph400` (loudest 400 ms) and marked L. "Old" is the live synth each replaced,
measured the same way (`sfx/legacyCues.mjs` renders them). The anchors did not
move: a light crush −27 … −29.5, a slam-kill ≈ −24, `stompHeavy` −23.

`SAMPLE_CUES` was re-balanced on the same meter. Its ratios had been set as if
every file were peak-normalised; they are not (`celebration-1` peaks at −12.6
dBFS, `level-up` at −17), so the coin sat at −46.6 against a −27 squish and the
level-clear fanfare 20 dB under the finisher it lands with. Now `coin` 0.21
(≈ −34), `levelClear` 0.71, `bossDie` 0.9, `unlock` 0.77 (≈ −29 … −30 L, with
`lose`, the one sample that was already in the frame), `star` 0.21 (the
fallback, matched to the rendered set).

---

## Priority 2 — the foot

| Cue | Now | Takes · length · level (old) | What a recording would still add |
| --- | --- | --- | --- |
| `stompLight` | A rubber sole on a hard floor: a contact tick, the rubber's 1–2 kHz slap (the part a phone plays), a soft-contact strike of the floor's modes, the air squeezed out. Deliberately under a squish. | 5 · ~80 ms · −33 (−37) | Little — a Foley pass of a sneaker on boards might add micro-texture. |
| `stompHeavy` | Built like a kick drum: a snap, a 1–2 kHz smack and the sole's hard-rubber thock, a saturated pitch-drop body (weight as 120–400 Hz harmonics), floorboards tuned off the body's harmonics so nothing beats, dust, crumbs hopping, a short dark room. | 3 · ~370 ms · −23 (−23.2) | Nothing essential. |
| `charge` | **A seamless 0.5 s loop**, held every frame the foot charges and **stopped dead (6 ms) on release**: a **cozy gather** — a warm D3 hum breathing at 4 Hz, a soft intake of air, a wooden clockwork pawl winding 8 to the second, and one quiet glass harmonic three octaves up. Its playback rate climbs 0.80 → 1.26 with the charge, so the pitch rises ~8 semitones, the breath opens 3.2 → 5 Hz and the pawl winds 6.4 → 10 a second; it swells from −37 to −31, and a small "ting" (`chargeReady`, −34) marks the moment it is full. A loop not held for 180 ms stops itself, so a pause or a cutscene can never leave it droning. Cutscene beats fire it as a 0.7 s one-shot. **REBUILT** (was a nasal 220 Hz reed under a 16 Hz tremolo with a beating 1.3 kHz pair): the runtime's own rate ramp carried that tremolo to 20 Hz at full charge — the centre of the roughness band — so the cue got measurably raspier the longer it was held. Measured, 15–35 Hz modulation energy at full charge: **49.7 % → 16.6 %**, peak modulation 20.3 Hz → 5.0 Hz, and 1.5–4 kHz content 3.2 % → 0 %. The pawl is the "charging" read and is mixed ~15 dB under the hum on the phone meter — the first pass had it at −29 dB, which is inaudible on a phone. | loop · −31 at full (−37.9) | Nothing. |
| `land` | A slam that hit nothing (**newly wired**: `stomp` with `heavy && !hit` plays this instead of the slam): the same floor, duller — no snap, no crumbs — and the shoe rocking heel-toe to a stop. The old one was a 110 Hz sine a phone could not play. | 2 · ~260 ms · −29 (−43.7) | Nothing. |
| `pivot` | The heel turn: a sneaker squeak (a stick-slip pulse train through the sole's resonances) over a rising swish. | 2 · ~275 ms · −30 (−31.6) | A real sneaker squeak on a gym floor would be the one upgrade here. |
| `slide` | **A seamless 0.5 s loop**, held while the skate slides (**newly wired**): wheel rumble thumping as the axle turns, polyurethane hiss, a faint bearing whine. | loop · −33 (−38.4) | A real roller-skate recording would add grit. |

---

## Priority 3 — the chain and the vial

| Cue | Now | Takes · length · level (old) | What a recording would still add |
| --- | --- | --- | --- |
| `chainStep` | **Fifteen notes, each rendered at its own pitch** (no resampling; a test checks every fundamental against `chainFreq`): a glockenspiel–celesta bar struck with a mallet that gets harder up the ladder, a beating shimmer on the upper rungs, a touch of plate. Loudness-matched rung to rung with a gentle 2 dB rise. **The mapping was fixed**: the scene indexed the ladder by squish count, clamped, so ×12 already reached E7 and ×20, ×30, ×40 and ×50 all repeated that one 2.6 kHz note. Now `chainStepPower(mult)` gives each multiplier rung the next note, spread over the whole ladder — A4 D5 E5 A5 D6 E6 A6 B6 E7 — so only ×50 touches the top. `chainFreq`, `PENTATONIC`, `LADDER_STEPS` and the wrap are unchanged. | 15 · ~550 ms · −28 → −26 (−29.6 … −26.4) | Nothing — modal bars are what a glockenspiel is. |
| `chainBreak` | Two soft marimba notes falling a fourth: a shrug, not a failure. | 2 · ~490 ms · −33 (−34.5) | Nothing. |
| `grow` | A squeaky rubber toy squeezed (a squeaker reed through the toy's body resonances) over a small rubber boing; pitch rises with the multiplier (rate 0.94 → 1.18). | 4 · ~170 ms · −33 (−37.7) | A real squeaky toy. |
| `deflate` | A balloon's neck squealing down as the air goes, fluttering, and a last little "pft". | 1 · ~580 ms · −31 (−34.6) | A real balloon. |
| `feverReady` | The one cue a player must never miss, so everything about it is unlike the rest of the mix: a sparkle glissando up the ladder, a bright FM bell "ding-DING!" a fourth apart (a rhythm nothing else has), a 9 Hz shimmering halo — all in the 2–5 kHz band a phone plays best and the squish leaves free. **Newly wired**: it plays on the frame the vial fills (it only ever played in cutscenes). | 1 · ~990 ms · −23.5 (−28.0) | Nothing. |
| `feverStart` | The gilded boot arriving: a gold "shwang" (a plate's inharmonic cluster, a friendly crash, a saturated body), a brass run up G–B–D–G into a held G-major chord, an upward whoosh, a rain of glints. In G, with the music's fever stinger that starts on the same press. | 1 · ~1.6 s · −25 L (−25.7 L) | A real brass section stab — synthesised brass is the weakest voice in the set. |
| `feverEnd` | Accented ON the frame the boot shrinks (the event): a rubbery "fwoomp" down, a puff, the fever's bells walking back D–B–G. | 1 · ~480 ms · −29 (−30.4) | Nothing. |

---

## Priority 4 — props and the boss

| Cue | Now | Takes · length · level (old) | What a recording would still add |
| --- | --- | --- | --- |
| `salt` | A shaker bursting: the cap's plastic "pok", a spray of air, hundreds of grains skittering over the floor and thinning out. 4 dB under the old bright hiss. | 2 · ~510 ms · −27 (−23.0) | A real shaker. |
| `magnet` | An electromagnet arming: a relay's clunk, a 120 Hz mains hum swelling (its harmonics where a phone plays them) with a wobble, then the "vwomp" as it lets go. | 1 · ~580 ms · −29 (−31.9) | Nothing. |
| `sweep` | The bar crossing a body — mechanical, not musical: a swish, a wiper's double clack, the rail's low knock. | 3 · ~195 ms · −29 (−27.9) | Nothing. |
| `podPop` | Done in the crush bank (the egg-shell crack with goo). | — | — |
| `podHatch` | The bank's crack-and-scurry says WHAT happened; **layered over it**, an ocarina's little "aww" — two notes falling a minor third — says it was a loss, without punishing. | 1 · ~525 ms · −31 over the bank | Nothing. |
| `arc` | The electric sock's arc: a cartoon "bzzt" — an irregular buzz stuttering two or three times through a bright band, a few sparks — band-limited so it zaps without stinging. | 4 · ~125 ms · −31 (−33.2) | Nothing. |
| `bossHit` | Done in the crush bank: the boss's own `hurt`. | — | — |
| `bossCounter` | The boss's full crush from the bank, with **a dedicated sting over it**: "ta-DAAH!" — a brass pickup into a G-major stab, a crash, a glint (replacing the live bell chord). | 1 · ~1.2 s · −24 (−23.1) | A real brass stab. |
| `bossPhase` | The boss changing gear: a gear-crunch ratchet, then "dun-DUN!" — two low brass stabs a fifth apart, each on a timpani hit. | 1 · ~1.2 s · −24 (−23.6) | Real brass and timpani. |
| `bossCharge` | The charge tell, with 620 ms to work: two hoof scrapes, a slide whistle climbing the whole time, and a snort AT 0.6 s — the moment the wind-up (the counter window) opens. A cartoon bull, not a monster. **Newly wired** to the sim's `tell` sub-state (it only played in cutscenes). | 1 · ~650 ms · −24 (−28.6) | Nothing. |
| `bossBeam` | Timed to the sim's 900 ms tell + 1600 ms sweep: a toy ray-gun charging up with a rising warble, a "pew" as it fires, a buzzy wobbling beam that powers down at 2.5 s. **Newly wired** to every beam cycle. | 1 · ~2.56 s · −31 L (−33.6 L) | Nothing. |

`bossDie` is **staged**, and that is the whole cue. It used to fire
`celebration-3` and the boss's crush in the same millisecond, and the fanfare
won: a 1.35 s brass sting starting on the same sample as the body means the body
is never heard, so the moment the player spent two minutes earning sounded like a
menu confirming a purchase. Now, in order:

| at | layer |
| --- | --- |
| 0 ms | **the blow** — the rendered `stompHeavy` at full weight, the live recipe until it has downloaded |
| 0 ms | **the body** — the boss's own `crush` from the bank at `BOSS_DIE_BOOST` (×1.35): the queen's jelly, the king's three-stage shell, the matriarch's ripple, Roach Prime winding down |
| 100 / 190 / 280 ms | **the splatter** — three wet slaps walked out in time and panned apart, the goo the burst threw landing around the player. Per Juice Style: goo is a low thump under a bright splat, confetti is paper chips and a popper, bubble is three soft soap pops and nothing wet |
| 300 ms | **the fanfare** — `celebration-3`, once the squash has been heard |

The fanfare runs on a `setTimeout` rather than being scheduled into the audio
graph, deliberately: `playSound` re-asks `isAudioSuspended()` when it fires, so a
commercial break opening inside those 300 ms gets silence instead of a brass
sting playing under it. A node scheduled at `currentTime + 0.3` would already be
committed. The delay is paid for by `CELEBRATE_BOSS_MS`, which holds the board
for 1.7 s before anything covers it.

`bossDie` is therefore **not** a `SAMPLE_CUES` row (a sample row plays *instead*
of the synth recipe) and **is** in `LAYERED`, so a rendered take built for it
later would layer over the body rather than replace it.

---

## Priority 5 — flow

| Cue | Now | Takes · length · level (old) |
| --- | --- | --- |
| `levelClear` | sample (`celebration-1`), re-balanced 0.09 → 0.71 | ≈ −29 L (−47.0 L) |
| `levelFail` | sample (`lose`), unchanged | −29.0 L |
| `star` | **Rendered: one note per star, rising B–D–G** — in G, inside the music's result sting (see Music): a celesta bar with a glockenspiel octave and a paper-crinkle of sparkle; the third star rings longer and adds the B above. The scene now passes the star's index. `happy` is the fallback. | 3 · ~800 ms · −29 → −27.4 (happy −38.5) |
| `unlock` | sample (`level-up`), re-balanced 0.07 → 0.77 | ≈ −30 L (−50.9 L) |
| `coin` | sample (`coin-pickup`), re-balanced 0.05 → 0.21 | ≈ −34 (−46.6) |
| `countUp` | live synth, unchanged — **nothing fires it**: the result screen has no score count-up. Render it when one exists. | — |
| `tick` | **Rendered**: a dry wood block, tick then tock, quiet, never rising. **Newly wired**: one per second of the last ten, never over the one-to-go heartbeat (it only played in cutscenes). | 2 · ~60 ms · −34 (−38.7) |

---

## Priority 6 — the retention set pieces

| Cue | Now | Takes · length · level (old) | What a recording would still add |
| --- | --- | --- | --- |
| `rushTell` | **A real snare roll**, modelled: membrane modes, two bands of snare wires that buzz longer after harder strokes, the stick's crack; strokes accelerate from single taps into a buzz roll with a crescendo and per-stroke tuning drift, landing on an accent at 1.08 s where the whistle takes over. | 1 · ~1.3 s · −30 L (−44.4 L) | **The music ducking under it is not done** — music routing is the composer's; a 4–6 dB dip of the bed over the 1.1 s tell would finish it (as a pause or a Web Audio gain: iOS ignores `volume`). |
| `rushGo` | A referee's pea whistle: a scooped tone the pea rattles at ~34 Hz, breath and chiff. | 1 · ~315 ms · −28 (−35.8) | Nothing. |
| `multi` | One chime per body: six notes up a G-major arpeggio, each a coin disc's metallic ting over a soft bar, stacked 35 ms apart (2 at a two-for-one, 6 at six) — metallic, so it never blurs into the chain's notes. | 6 · ~340 ms · −30 per chime (−30.7 … −28.5) | Nothing. |
| `grow` / `deflate` | See Priority 3. | | |
| `heartbeat` | Lub-dub, soft and muffled — a held breath, not a horror film. The old one was a 50 Hz sine a phone could not play; this body is saturated into 100–400 Hz so it is felt on a speaker too. | 2 · ~320 ms · −31 (−39.0) | Nothing. |
| `finisher` | **The jackpot, in B major so it lands IN the `celebration-1` fanfare that starts on the same frame.** Slot 0 the tap finish (2.5 dB under), slot 1 the slam: a saturated hit and the floor, a cash-register "ka-CHING!", a glockenspiel run B–D♯–F♯–B–D♯, a friendly crash, two party poppers and a shower of coins, in a hall. Its weight is inside the first 0.9 s — before `CELEBRATE_MS`, and before any interstitial can cut it. | 2 · ~1.3 s · −21 / −23.5 (−22.8) | **Still the one worth recording**: a real brass-and-cymbal jackpot hit and real coins would lift it further. |
| `flip` | A shell going over: a hollow chitin "tok", a rock and a smaller tok as it settles, six little legs pedalling. | 2 · ~395 ms · −30 (−36.5) | Nothing. |
| `kick` | The toe meeting a shell: a big hollow "THWOCK" (shell modes over a body thump) and the whoosh of it taking off down the lane. | 3 · ~335 ms · −28 (−33.1) | Nothing. |
| `pins` | **Bowling pins, modelled**: each pin a maple body with its own tuning; the strike is an event list — the shell on the head pin, pin-on-pin collisions cascading, pins hitting the lane and bouncing, a last rattle — in a bowling-alley room. Slot 0 a clatter of three or four pins, slot 1 a strike (five or more). | 2 · ~1.36 s · −27 / −25 (−32.5) | Real pins in a real alley would still be richer. |
| `boxDrop` / `boxHit` / `boxOpen` / `trialEnd` | Cardboard, modelled (the box's air cavity gives it a pitch, damped panels, a papery rustle): the present landing with a small bounce; blows rising a step each (E–G–A); the lid's "fwump", tissue paper, a glockenspiel run up the ladder; a soft magic "poof" and two chimes stepping down. | 1 · 341 ms · −29 (−35.0) / 3 · ~85 ms · −29 → −27.4 (−35.9) / 1 · 746 ms · −26 (−27.6) / 1 · 486 ms · −30 (−35.3) | Nothing. |
| `quake` / `echo` | A big cartoon BOOM a phone can carry, the floor ringing, a rolling rumble with a tremble, everything on the table rattling; the Echo's repeat is a softer, rounder slam with a "wub-wub-wub" flutter. The old pair were almost all sub-bass. | 1 · 751 ms · −29 L (−40.3 L) / 1 · 300 ms · −28 (−35.1) | Nothing. |
| `twistTell` | "Uh-oh!" as an instrument, never a voice: a clarinet falling a fourth, the second note leaning into a wobble. | 1 · ~870 ms · −27 (−27.8) | Nothing — a voiced "uh-oh" would break the wordless rule. |
| `party` | The game is wordless, so the crowd is hands and noisemakers: a party blower unrolling, a popper and its streamers, a burst of applause (a Poisson crowd of three-to-four-burst claps), a second blower, a rattle, a bell run up the ladder. | 1 · ~1.75 s · −26 L (−32.5 L) | Recorded applause and a real blower — still wordless. |

## Music

Seven files in `public/audio/music/`. Three **beds** are the Settings choices
(listed in this order), two more beds are **routed** by where the game is, and
two **cues** play over the beds' moments:

| Piece | File | Size | When it plays |
| --- | --- | --- | --- |
| `parade` — Crunch Parade | `crunch-parade.ogg` | 871 KB | **the default** — the game's own theme (below) |
| `trance` | `trance.ogg` | 148 KB | a Settings choice: the arcade drive |
| `cozy` | `bg-cozy.ogg` | 66 KB | a Settings choice: warm, unhurried |
| `attic` — Attic Tiptoe | `attic-tiptoe.ogg` | 644 KB | world 3, in place of `parade` / `cozy` (routed) |
| `boss` — Big Bug Stomp | `boss-stomp.ogg` | 685 KB | every boss level (routed) |
| Gilded Boot (fever stinger) | `fever-stinger.ogg` | 99 KB | Splat Fever — exactly `FEVER_MS`, instead of the bed |
| Stomped It! (result sting) | `result-sting.ogg` | 30 KB | a CLEARED result screen |

All five new-pipeline files are stereo 44.1 kHz Vorbis q2 (72-82 kb/s), the
format and encoder of Crunch Parade. No new Settings entry: the routed pieces
are not choices.

`DEFAULT_MUSIC_TRACK` in `useUser.ts` only reaches a save with no track in it.
Every save that booted an earlier build already holds `cozy` — the
settings-stranding write seeds it — and a seeded value cannot be told from a
chosen one, so those players keep `cozy` until they pick. (Testing locally:
pick it in Options, or clear `bc_music_track` from the save.)

### Crunch Parade — how it is made

Composed as data and rendered offline — no samples, no service:
`pnpm music:render` (add `-- --analyse` for spectrograms, waveforms, a picture of
the loop seam and loudness at ×1.16). The score is `tools/music/score.mjs`; the
synthesiser, sequencer, harmony check and mastering live beside it.

* **Cartoon funk in F mixolydian, 116 BPM, 16th swing, 44 bars = 91.03 s.** The
  hook is two bars: a sneaking 16th-note run, then three unison stomps on beats
  1-2-3 (melody, bass, kick and clap together) and a hole on 4.
* **Map:** bar 1 (0:00) tiptoe intro → 5 (0:08) hook on marimba → 13 (0:25)
  kazoo calls / marimba answers, a build and a fake-out → 21 (0:41) breakdown,
  kick/clap/shaker only → 29 (0:58) hook + pizz counter-line, brass, cowbell →
  37 (1:14) shout chorus → 41 (1:23) stop-time turnaround F7-Eb7-Db7-C7, a slide
  whistle sneaks off into bar 1.
* **Band:** kick, snare, multi-burst clap, snaps, 808-style hats, shaker,
  woodblocks, cowbell, toms, crash; slap bass and a Karplus-Strong upright;
  marimba and xylophone (modal), pizzicato strings, a formant kazoo, clav chops,
  brass stabs; slide whistle and a boing. Freeverb and a ping-pong delay.
* **Every note is checked against its chord before rendering** — the render
  refuses to run with a clash (0 today).
* **Seamless by construction:** every event is mixed a loop early and a loop
  late as well, the effects run straight across, and the middle pass is cut
  out. The audio just past the cut matches the loop's start to −126 dB, and the
  ogg decodes to exactly the rendered sample count.
* **Mix for the squish:** the hook sits ~4 LU under the drums, the kazoo ~7, and
  everything melodic is short (mallets, plucks, chops). The bed ducks ~2 dB on
  every kick, the master dips 1.5 dB at 2.3 kHz, and the low end is mono under
  120 Hz. The bass carries a band-limited grit layer, so a phone still plays
  the line.
* **Level and size:** −28.0 LUFS integrated, −13.0 dBTP, LRA 4.2 LU — between
  `bg-cozy` (−33.0) and `trance` (−26.9), because one element volume serves
  every track and the SFX were balanced against those. Stereo 44.1 kHz Vorbis
  q2, 871 KB. (The quiet master costs the codec nothing: coding error measured
  within 0.3 dB of a +12 dB copy.)

### Which music plays when — the routing rule

`routeBed` in `src/game/musicRouting.ts` (pure; `tests/game/musicRouting.test.ts`
walks all 40 levels × all three choices), applied in this order:

1. **A Bug Party plays the player's own track**, on whatever world it follows.
2. **A boss level plays `boss`**, whatever Settings say (1-4, 1-10, 2-10, 3-10,
   4-10 — read from `BOSS_FIGHTS`). The fight is a set piece, scored like a
   cutscene; one loop serves all four bosses.
3. **World 3 plays `attic` in place of `parade` and `cozy`, and keeps `trance`.**
   `parade` is the default and `cozy` is what every earlier save was seeded with
   (see above) — neither can be told from a deliberate pick, and both are the
   daylight reading the attic is not. `trance` has never been a default or a
   seed, so a player holding it chose it, and a choice is kept. The attic bed is
   Crunch Parade's own hook told in the dark, so a parade player still hears
   their theme.
4. Everywhere else, the player's track.

The scene says where it is — `setMusicScene({ level })` in `startLevel`,
`{ level, party: true }` in `startParty` — and every bed start resolves through
it. `tests/platforms/musicPlayerRouting.test.ts` drives the real player.

**Transitions.** One media element, so there is never a second bed audible:
level to level is what it always was (fade out at the level end, fresh start on
the next), and a bed change while one sounds (a new pick in Options that routes
to a different file) is a 300 ms dip, then the new bed from its top with the
usual fade-in. A pick that routes to the same file (any pick on a boss level)
restarts nothing.

**Fever.** The stinger starts on the FEVER press (a decoded buffer, so on the
next audio quantum — measured 16 ms in Chrome; a media element swapping its
source is 100-300 ms late). The bed dips for 90 ms and PAUSES — a pause, not a
volume duck, because iOS ignores `volume` writes and a ducked bed would play at
full level under the stinger there. It comes back where it left off, fading in
from the stinger's last-beat hole (`FEVER_BED_RETURN_MS`, 9 583 ms), timed on the
AUDIO clock so a pause freezes the bed's return with the stinger. While it is
held, `playWithFade` refuses to start it, so no watcher (a modal closing, an
unmute, a tab coming back) can bring it back on top. Six-second gilded laces:
`feverEnd` fades the stinger (250 ms) and brings the bed back; a level ending
mid-fever stops it with the bed.

**Result sting.** Plays on a cleared result screen, held back by
`resultStingDelayMs` until the level-end sample has rung out: `levelClear`
(`celebration-1`, 1.34 s, B major) and on a boss `bossDie`'s `celebration-3`
(1.35 s) fire at the level end, and the screen can open 900 ms later. The sting
starts no earlier than 1 400 ms after the level end — up to half a second after
the screen opens on the direct path, at once after an ad or the gift screen.
`levelClear` keeps its job (the win on the board); the result screen no longer
rides on its tail. Never on a lost level (`lose` already played). Dropped when
the screen closes, when the next level's bed starts, or when a pause interrupts
it — a sting is a moment, not something to thaw on another screen.

**The ad-mute guarantee.** Beds go through the one registered element
(`forceStopMusic`, the suspend registry). The cues are buffers on the SHARED
AudioContext, registered with `registerOneShotSource`, so `killOneShotSfx` —
which every ad path calls first — stops them, and they refuse to start while
`isAudioSuspended` / `isGamePaused` / the mobile mute / the portal mute holds.
No second element, no second context; the mute/suspend code is untouched.

**Loading.** The attic and the boss loop are never part of the first load:
`warmMusicFor(level)` at each level start fetches the NEXT level's routed bed
when it differs from this one (1-3 warms the Queen, 2-10 warms the attic; a
trance player crossing into world 3 warms nothing), and the element streams on
demand as it always did. The two cues are decoded on the shared context at the
first level start (`warmMusicCues`); one that is not decoded yet is skipped and
the bed simply plays on.

**Fades.** Both fades now end on time and one cancels the other. The old fade-out
waited to read `volume` back at 0 — which iOS never reports — so on an iPhone the
track played on under the result screen and an interval leaked per level; and a
quick tap through the result screen could let the last level's fade-out pause
the new track.

### The other four — how they are made

Same pipeline, same band. `pnpm music:render` renders all five (`-- --track
boss,attic` for some, `-- --analyse` for pictures and loudness). The scores are
`tools/music/scores/{attic,boss,fever-stinger,result-sting}.mjs`; the pipeline
gained one-shot rendering (exact length, a proof that the ending was already
quiet before a 60 ms insurance fade), per-score buses and effects, a bitexact
encode, a `_` "damped" articulation, and eight voices (8-bit pulse, timpani,
tuba, music box, theremin, bassoon, toy organ, noise riser). Crunch Parade still
renders bit for bit (WAV hash unchanged).

**One tune in five places.** `score.mjs` exports the hook (`HOOK_LINES`) and every
other score quotes it — `transpose()`d, or re-moded where minor needs it —
rather than re-typing it:

| Piece | Key, tempo, form | Tie to the theme | Level | Checks |
| --- | --- | --- | --- | --- |
| Attic Tiptoe | D dorian, 92 BPM swung, 28 bars = 73.04 s: clock-and-tiptoe intro → the sneak on bassoon, the stomps as pizzicato tiptoes, a theremin falling F-E-D-C in the holes → a music box plays the parade's hook VERBATIM in F over the parade's chords, then A7♭9 pulls it back to minor → the sneak with a toy-organ off-beat → "tip, tip… BOO" | the relative minor; the parade's tiptoe intro becomes the whole bed | −28.9 LUFS, −12.6 dBTP, LRA 2.6; no kick, no crash | 0 clashes, 1 deliberate rub (A7♭9); seam −112 dB |
| Big Bug Stomp | F minor, 132 BPM straight, 40 bars = 72.73 s: the boss arrives on a timpani roll and STEALS the three stomps → the hook as a villain's march (marimba + low brass, tuba oom-pah, pizz ostinato) → the hero answers with the stomp motif in A♭ major → kazoo "nyah-nyah", the tuba laughing on the Neapolitan G♭ (the breather) → the march, fuller → the parade's falling-dominant turnaround in minor | the parallel minor: still "in F", lights off | −27.5 LUFS, −13.3 dBTP, LRA 2.9; stems on the parade's ladder | 0 clashes, 4 deliberate rubs (the villain's C7♭9); seam −136 dB |
| Gilded Boot | G mixolydian, 144 BPM, 6 bars = 10.000 s: HIT + an 8-bit power-up → the sneak on chip lead and marimba → CRUNCH ×3 with a chip run in the hole → the sneak over C7 → over D7 with a snare roll and riser → the final CRUNCH ×3 on G6/9, then the hole the bed returns in | the hook a tone up and a gear up; no pickup, so sample 0 is the downbeat | −26.5 LUFS (the parade's loudest 3 s are −25.8), −13.8 dBTP | 0 / 0; last 100 ms at −35 dB re peak before the fade |
| Stomped It! | G major, 160 BPM, 2 bars = 3.000 s: the sneak's chromatic tail into CRUNCH ×3 (D, D, G), then TA-DAA — G6/9 brass, marimba tremolo, xylophone run, a slide-whistle "whee" | the hook's last gesture as a victory | −26.0 LUFS, −12.9 dBTP | 0 / 0; tail −53 dB before the fade |

**Why G for both cues.** `feverStart` rings a G-major bell chord from the same
instant the stinger starts, and the `star` cue (`happy`) that lands up to three
times in the sting's first second is a stock sample in G major (E–F#–G over G) —
in the theme's F both would sit a semitone off. G is also a tone above the
theme: the oldest power-up in music. **For the SFX designer:** a replacement
`star` cue in G (say B5–D6–G6 rising) keeps sitting inside the sting's chord;
`celebration-1` is in B major, which is why the sting waits for it.

**Browsers.** The format follows the existing tracks (Ogg Vorbis). Safari plays
Vorbis from 18.4 (macOS and iOS); an older Safari plays none of the game's
audio, cues included — every SFX and bed is .ogg, so that predates this. On iOS
`HTMLMediaElement.volume` is read-only (always 1): the beds play at full element
level there while every SFX and both cues run at their mixed Web Audio gains —
see "Still wanted".

### What music has to do in this game

1. **Speed up with the chain.** `comboMusicRate(multiplier)` drives playback rate
   from ×1 to ×1.16 — shallow and saturating on purpose. **A track must survive
   a 16 % speed-up without artefacting**, which in practice means no heavy
   time-stretched material and no dead-obvious vocal. Note that a media
   element's `preservesPitch` defaults to `true`, so what the browser does at
   ×1.16 is a pitch-preserving *time-stretch*, not the "tone and a half" of tape
   speed the code comments describe; set `preservesPitch = false` on the music
   element if the tape effect is the intent. Crunch Parade is measured both ways
   (loudness and peak unchanged at ×1.16).
2. **Loop seamlessly.** It plays for the whole level. `audio.loop` on a media
   element is not sample-accurate in every browser; Crunch Parade puts its loop
   point in a near-silent staccato gap so a few ms of seek gap land where they
   are least audible.
3. **Get out of the way during Fever.** The GDD asks for a *"shift into
   high-tempo chiptune/funk during Fever Mode"*: that is the Gilded Boot
   stinger, instead of the bed, for exactly `FEVER_MS` (above). It plays on Web
   Audio at ×1 and never meets the chain's rate.

### Still wanted

The four pieces the brief asked for (fever stinger, boss loop, attic bed,
result sting) have shipped. What would still improve the music:

| Item | Notes |
| --- | --- |
| Route the music element through a Web Audio `GainNode` | iOS ignores `volume`, so on an iPhone every bed plays ~22 dB over the level the SFX were balanced against. `createMediaElementSource` on the shared context would fix the balance (and put the beds under `ctx.suspend()` as well). It changes the player next to the ad-mute code, so it waits until the ad-audio fix has landed and been QA'd. |
| A fail sting | A lost level's screen plays nothing after `lose`. A soft, "so close" version of the sting would suit the So Close! retry. |
| `preservesPitch` | Decide tape speed vs time-stretch for the chain's ×1.16 (item 1 above). All three new-pipeline beds are measured both ways. |
| `trance` / `cozy` | They predate the pipeline (mono 22 kHz, hand-made); re-scoring them as data would give the whole Settings list the theme's identity. |

---

## Mixing rules already enforced in code

Written down here because a new sample can break any of them:

* **The ad mute guarantee.** Everything runs through the shared, suspendable
  `AudioContext`. Never create a second one.
* **Per-cue throttles.** See above. They protect the mix *and* the main thread —
  each live synthesised voice is an oscillator graph built at call time. The
  crush bank made a kill three nodes instead of a dozen; the caps did not move.
* **The crush bank stays on the shared context and inside its budget.**
  Buffers are created with `ctx.createBuffer` on the one shared context (never an
  OfflineAudioContext or a second context), decoded memory stays under
  `CRUSH_BUDGET_BYTES` (6 MB), and rendering only ever happens in the pump's
  small slices — never inside `playFx`.
* **Volume ratios are per-cue, not global — and measured, not guessed.** A
  `SAMPLE_CUES` ratio multiplies whatever level its file happens to have, so set
  it on the phone-weighted meter against the cues around it (see **Levels** under
  The rendered cues); the rendered cues' gains are computed from their targets by
  `pnpm audio:sfx`, from the decoded file.
* **Panning follows the screen.** `playFx(id, power, pan)` takes a −1…1 pan
  computed from the event's x position. Record in mono; the engine places it.
* **Calm mode does not mute.** It removes shake and flashes, not sound. A player
  who wants silence uses the mute button, which every portal also drives through
  `useCrazyMuteSync`.
