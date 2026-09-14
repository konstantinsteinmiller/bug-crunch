# Bug Crunch — sound to-do

Every cue in this game is **synthesised at run time today** (Web Audio:
noise bursts, tones, bells, crackle, and a convolver reverb) except six, which
already play shipped samples. Nothing is silent and nothing is missing — this
file is the list of cues a recorded sample would improve, in the order that buys
the most.

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

## Priority 1 — the squish

`squish` is the busiest cue in the game by a wide margin, and the whole mix is
built around it. It is also the one the GDD names directly: *"wet squelch/pop,
varied pitch by bug size"*.

| Cue | What to record | Notes |
| --- | --- | --- |
| `squish` | 6–10 variations | Wet, short (< 180 ms), with a distinct *pop* at the end. The synthesiser already varies pitch by body size and pans by screen position — a sample set should be pitch-neutral and let the engine do that. |
| `hurt` | 3 variations | A body that survived: duller, no pop, no release. |
| `clang` | 2 variations | Metal on shell. **Short and not shrill** — see the throttle note. |
| `spike` | 1 | The player got hurt. Should be unmistakably a *mistake* sound: descending, a little comic, never harsh. The audience starts at six. |

The pitch/size mapping is set by `setSquishVoice()` immediately before each
`playFx('squish')`; that call stays whether the source is a sample or the
synthesiser.

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
| `podPop` | A boss egg destroyed. |
| `podHatch` | One that was not — should feel like a *loss*. |
| `arc` | The electric sock's chain arc. |
| `bossHit` | Heavier than `hurt`, with weight behind it. |
| `bossCounter` | The counter window paid off. The best sound in the game after `squish`. |
| `bossPhase` | The boss changing gear. |
| `bossCharge` | The charge tell — **this is a warning, and it has 620 ms to work.** |
| `bossBeam` | The sweep attack. |

`bossDie` already plays `celebration-3`.

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

Two tracks ship, selectable in Settings:

| Track | File | Where it belongs |
| --- | --- | --- |
| `cozy` | `public/audio/music/bg-cozy.ogg` | **the default** — warm, unhurried, the picnic-blanket worlds |
| `trance` | `public/audio/music/trance.ogg` | the arcade world, and players who want a drive |

### What music has to do in this game

1. **Speed up with the chain.** `comboMusicRate(multiplier)` drives playback rate
   from ×1 to ×1.16 — shallow and saturating on purpose: +16 % is a tone and a
   half on a loop, which reads as the run tightening. More is heard as a broken
   tape. **A track must survive a 16 % speed-up without artefacting**, which in
   practice means no heavy time-stretched material and no dead-obvious vocal.
2. **Loop seamlessly.** It plays for the whole level.
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
  each synthesised voice is an oscillator graph built at call time.
* **Volume ratios are per-cue, not global.** The numbers in `SAMPLE_CUES` are
  deliberately small (0.05–0.1): the samples are peak-normalised and the game
  runs a lot of them at once.
* **Panning follows the screen.** `playFx(id, power, pan)` takes a −1…1 pan
  computed from the event's x position. Record in mono; the engine places it.
* **Calm mode does not mute.** It removes shake and flashes, not sound. A player
  who wants silence uses the mute button, which every portal also drives through
  `useCrazyMuteSync`.
