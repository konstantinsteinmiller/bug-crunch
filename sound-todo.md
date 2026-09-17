# Bug Crunch — sound to-do

Every cue in this game is **synthesised** except six, which already play
shipped samples. There are two kinds of synthesis:

* **The crush bank** — every body's crush, wound and ricochet (`squish`, `hurt`,
  `clang`, `podPop`, and the boss's `bossHit` / `bossCounter` / `bossDie` body
  layer). Designed per bug, rendered offline-style by pure TypeScript
  (`src/game/audio/crushSynth.ts`) into AudioBuffers during idle time, played as
  one buffer source per kill. See **Priority 1**.
* **Live Web Audio** — everything else (noise bursts, tones, bells, crackle, a
  convolver reverb), built per event, and the fallback for a crush whose buffer
  is not rendered yet.

Nothing is silent and nothing is missing — the rest of this file is the list of
cues a recorded sample would still improve, in the order that buys the most.

## How a sample gets in

`playFx(id, power, pan)` in `src/use/useGameAudio.ts` is the single entry point.
It checks `SAMPLE_CUES` first:

```ts
const SAMPLE_CUES: Partial<Record<FxSound, [string, number]>> = {
  coin: ['coin-pickup', 0.05],
  levelClear: ['celebration-1', 0.09],
  bossDie: ['celebration-3', 0.1],
  levelFail: ['lose', 0.1],
  star: ['happy', 0.07],
  unlock: ['level-up', 0.07]
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

| Cue | What to record |
| --- | --- |
| `spike` | 1 variation. The player got hurt. Should be unmistakably a *mistake* sound: descending, a little comic, never harsh. The audience starts at six. |

---

## Priority 2 — the foot

The player hears these more often than anything except the squish, and they are
the only feedback that the *input* registered.

| Cue | What to record |
| --- | --- |
| `stompLight` | A rubber sole on a hard floor. Dry, tight, ~90 ms. |
| `stompHeavy` | The slam. Low body, a real thump, a touch of room. |
| `charge` | A rising tension bed while the slam winds up — must loop cleanly and stop dead on release. |
| `land` | The shoe touching down out of a slam that hit nothing. |
| `pivot` | The heel-turn sweep. Short scuff. |
| `slide` | The roller skate's ploughing line. A loop. |

---

## Priority 3 — the chain and the vial

This is the game's reward music. It is currently a **pentatonic ladder** —
`PENTATONIC = [0, 2, 4, 7, 9]`, wrapping every three octaves, so a fifty-long
chain is a repeating rising phrase rather than a dog whistle. That behaviour has
to survive whatever replaces it.

| Cue | What to record |
| --- | --- |
| `chainStep` | **A set of 15 pitched notes**, not one sample. The engine indexes them by rung (`LADDER_STEPS = 15`). One sample pitch-shifted 40 semitones is the thing this design exists to avoid. |
| `chainBreak` | Short, falling, and *not* punishing. A chain lapsing is the clock running out, not a failure. |
| `feverReady` | The vial filled. Must cut through a busy board — this is the one cue the player must never miss. |
| `feverStart` | The gilded boot arriving. Big, gold, ascending. |
| `feverEnd` | The wind-down. Should land on the beat the boot shrinks. |

---

## Priority 4 — props and the boss

| Cue | What to record |
| --- | --- |
| `salt` | A shaker bursting. |
| `magnet` | An electromagnet arming — a hum that ends. |
| `sweep` | The bar crossing. Mechanical, not musical. |
| `podPop` | Done in the crush bank (the egg-shell crack with goo). |
| `podHatch` | One that was not — should feel like a *loss*. |
| `arc` | The electric sock's chain arc. |
| `bossHit` | Done in the crush bank: the boss's own `hurt` (queen's jelly smack, king's shell, matriarch's segments, roach's dent). |
| `bossCounter` | The boss's full crush from the bank under the chord. A dedicated sting over it could still add something. |
| `bossPhase` | The boss changing gear. |
| `bossCharge` | The charge tell — **this is a warning, and it has 620 ms to work.** |
| `bossBeam` | The sweep attack. |

`bossDie` already plays `celebration-3`, with the `stompHeavy` synth and the
boss's crush from the bank under it.

---

## Priority 5 — flow

| Cue | Status |
| --- | --- |
| `levelClear` | sample (`celebration-1`) |
| `levelFail` | sample (`lose`) |
| `star` | sample (`happy`) — fires once per star, so a set of three rising notes would be better |
| `unlock` | sample (`level-up`) |
| `coin` | sample (`coin-pickup`) |
| `countUp` | synthesised — the result screen's score tick |
| `tick` | synthesised — the last ten seconds of the clock |

---

## Music

Three tracks ship, selectable in Settings (listed in this order):

| Track | File | Where it belongs |
| --- | --- | --- |
| `parade` | `public/audio/music/crunch-parade.ogg` | **the default** — "Crunch Parade", the game's own theme (below) |
| `trance` | `public/audio/music/trance.ogg` | the arcade world, and players who want a drive |
| `cozy` | `public/audio/music/bg-cozy.ogg` | warm, unhurried, the picnic-blanket worlds |

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
   high-tempo chiptune/funk during Fever Mode"*. There is no Fever track yet —
   the rate change carries it. **A dedicated 10-second Fever stinger is the
   single highest-value music addition left.**

### Still wanted

| Track | Length | Notes |
| --- | --- | --- |
| Fever stinger | 10 s, exactly `FEVER_MS` | Should be able to start on any beat and end clean. |
| Boss loop | 60–90 s | One is enough — the four bosses are told apart by their tells, not their music. |
| World 3 (attic) bed | 60–90 s | The one world where `cozy` reads wrong; it wants sparse and a little spooky. |
| Result-screen sting | 3 s | Currently `celebration-1` does double duty. |

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
* **Volume ratios are per-cue, not global.** The numbers in `SAMPLE_CUES` are
  deliberately small (0.05–0.1): the samples are peak-normalised and the game
  runs a lot of them at once.
* **Panning follows the screen.** `playFx(id, power, pan)` takes a −1…1 pan
  computed from the event's x position. Record in mono; the engine places it.
* **Calm mode does not mute.** It removes shake and flashes, not sound. A player
  who wants silence uses the mute button, which every portal also drives through
  `useCrazyMuteSync`.
