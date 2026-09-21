/**
 * ─── Bug Crunch's cue sheet ─────────────────────────────────────────────────
 *
 * Every rendered cue: what it is built from, how many takes it ships, which
 * sprite file it lives in, how the runtime picks a take, and how loud it must
 * sit IN THE MIX. `tools/audio/build-sfx.mjs` renders these, masters them,
 * measures them, packs them into sprites and writes the runtime manifest
 * (`src/game/audio/sfxSprites.ts`).
 *
 * ── Levels ──
 *
 * `target` is the cue's loudness at its runtime gain, before the player's
 * slider, on the project's phone-weighted scale (`ph50` = loudest 50 ms, the
 * crush bank's scale; `ph400` = loudest 400 ms, for the long cues). The anchors,
 * measured with the same meter (see sound-todo.md → "Levels"):
 *
 *   light crush −27 … −29.5 · armoured slam-kill −24 · stompHeavy −23.2 (kept)
 *   hurt −27 … −31 · clang −31 · the old chain bell −29.6 … −26.4
 *
 * The build computes each cue's runtime gain from `target` — the balance lives
 * in this one table, like `levelDb()` for the crush bank.
 *
 * ── Kid-friendly is a constraint, not a flavour ──
 *
 * The audience starts at six. Nothing below is harsh (every render is
 * low-passed at 10 kHz, crackle grains stay under ~6.5 kHz), nothing is scary
 * (the boss's warnings are cartoon — a hoof scrape and a slide whistle, not a
 * growl), and every mistake sound is a little comic rather than punishing.
 * And the game is WORDLESS: no voice anywhere, so the party's "crowd" is
 * applause and noisemakers, and the twist's "uh-oh" is a clarinet.
 */
import {
  BAR, adEnv, fm, jit, logRange, mtof, noise, osc, partials, pick, range, reed, scatter, st, strike, svf, tick
} from './dsp.mjs'
import {
  applause, blower, brass, cardboard, coin, crash, floorboards, mallet, pin, popper, puff, rattle,
  shellKnock, snare, sparkle, thump, whistle, whoosh, woodblock
} from './instruments.mjs'

/** The chain's ladder — the same formula as `chainFreq` in `useGameAudio.ts`
 *  (a test holds the two together): G major pentatonic from G4, three octaves. */
export const CHAIN_ROOT = 392
export const PENTATONIC = [0, 2, 4, 7, 9]
export const LADDER_STEPS = 15
export const chainFreqOf = (step) => {
  const n = Math.max(0, Math.floor(step)) % LADDER_STEPS
  return CHAIN_ROOT * Math.pow(2, (PENTATONIC[n % 5] + Math.floor(n / 5) * 12) / 12)
}

// Notes used by the stings. The finisher shares B major with the fanfare sample
// it lands on (`celebration-1`, measured: B major); the chain, the vial, the
// fever and the stars share G — the chain's pentatonic, and the key of the
// music's fever stinger and result sting (see sound-todo.md → Music).
const B5 = mtof(83), Ds6 = mtof(87), Fs6 = mtof(90), B6 = mtof(95), Ds7 = mtof(99)
const G4 = mtof(67), Bn4 = mtof(71), D5 = mtof(74), G5 = mtof(79), A5 = mtof(81), Bn5 = mtof(83), D6 = mtof(86), E6 = mtof(88), G6 = mtof(91), A6 = mtof(93)

/** Loop helpers: a loop's periodic parts must fit a whole number of cycles in
 *  its period. `onGrid(f, L)` snaps a frequency to the nearest one that does. */
const onGrid = (f, L) => Math.max(1, Math.round(f * L)) / L

export const SPRITES = {
  foot: { tier: 1, note: 'the shoe: every stomp, the slam, the charge' },
  chain: { tier: 1, note: 'the chain ladder, its lapse, Growth Spurt' },
  flow: { tier: 1, note: 'the vial, the finisher, the heartbeat, stars, the clock' },
  props: { tier: 2, note: 'hazards, moves, spikes, the skate' },
  sets: { tier: 2, note: 'the retention set pieces' },
  boss: { tier: 2, note: 'boss tells, phases, the counter sting' }
}

export const CUES = {
  // ══ THE FOOT ═══════════════════════════════════════════════════════════════

  stompLight: {
    sprite: 'foot', slots: 5, pick: 'rotate', dur: 0.2, target: -33, metric: 'ph50',
    hp: 80, maxDur: 0.12, rate: 0.03,
    about: `A rubber sole on a hard floor: a contact tick, the rubber's slap (the 1–2 kHz a phone plays), a soft-contact strike of the floor's modes, the air squeezed out under the sole. Dry and tight, ~90 ms.`,
    render: (b) => {
      const f = jit(b, 1, 0.08)
      tick(b, 0.0005, range(b, 2900, 4200), 1.1, 0.0045, range(b, 0.18, 0.26))
      noise(b, { at: 0.0003, dur: 0.035, amp: 0.3, mode: 'bp', f: range(b, 1300, 2000), q: 1.1, env: (t) => adEnv(t, 0.0004, 0.001, 0.011) })
      strike(b, {
        at: 0, amp: 0.9, contact: range(b, 0.0022, 0.0032), rough: 0.18,
        modes: [[168 * f, 1, 0.07], [292 * f, 0.75, 0.055], [468 * f, 0.6, 0.042], [790 * f, 0.45, 0.03], [1340 * f, 0.26, 0.02], [2150 * f, 0.12, 0.013]]
      })
      noise(b, { at: 0.001, dur: 0.05, amp: 0.1, mode: 'lp', f: range(b, 1100, 1700), color: 'pink', env: (t) => adEnv(t, 0.002, 0, 0.02) })
    }
  },

  stompHeavy: {
    sprite: 'foot', slots: 3, pick: 'rotate', dur: 0.8, target: -23, metric: 'ph50',
    hp: 45, rate: 0.025, gainPower: [0.8, 1], ratePower: [1.03, 0.97], room: ['floor', 0.26], maxDur: 0.62,
    about: `The slam, built like a kick drum: a snap to place it, a 1–2 kHz smack and the sole's own hard-rubber thock (the part a phone plays), a saturated pitch-drop body so the weight arrives as 120–400 Hz harmonics rather than a sub the speaker drops, the floorboards (tuned off the body's harmonics so they do not beat), dust, crumbs hopping, a short dark room.`,
    render: (b) => {
      const f = jit(b, 1, 0.05)
      noise(b, { at: 0, dur: 0.014, amp: 0.5, mode: 'bp', f: range(b, 3600, 4800), q: 0.7, env: (t) => adEnv(t, 0.0002, 0.0006, 0.006) })
      noise(b, { at: 0.0005, dur: 0.06, amp: 0.55, mode: 'bp', f: [[0, 2200], [0.04, 1100]], q: 0.9, env: (t) => adEnv(t, 0.0005, 0.002, 0.022) })
      strike(b, { at: 0, amp: 0.6, contact: 0.0015, modes: [[540 * f, 1, 0.055], [890 * f, 0.7, 0.045], [1330 * f, 0.5, 0.032], [2050 * f, 0.3, 0.02]] })
      thump(b, { at: 0, f0: 180 * f, f1: 62 * f, glide: 0.028, t60: 0.26, amp: 0.9, drive: 3 })
      floorboards(b, { at: 0.001, amp: 0.4, scale: f * 1.07, contact: 0.004, t: 0.7 })
      noise(b, { at: 0.002, dur: 0.36, amp: 0.2, mode: 'lp', f: [[0, 3600], [0.3, 170]], env: (t) => adEnv(t, 0.003, 0.012, 0.2) })
      scatter(b, 0.03, 0.3, (u) => 45 * (1 - u) + 8, (t) => {
        tick(b, t, logRange(b, 900, 3600), 2.4, range(b, 0.004, 0.012), range(b, 0.03, 0.11))
      })
    }
  },

  land: {
    sprite: 'foot', slots: 2, pick: 'rotate', dur: 0.5, target: -29, metric: 'ph50',
    hp: 50, rate: 0.03, room: ['floor', 0.2],
    about: `A slam that hit nothing: the same floor, duller — no snap, no crumbs — and the shoe rocking heel-toe to a stop. A miss that sounds as good as a hit teaches nothing.`,
    render: (b) => {
      const f = jit(b, 1, 0.05)
      thump(b, { at: 0, f0: 118 * f, f1: 56 * f, glide: 0.03, t60: 0.2, amp: 0.8, drive: 2 })
      floorboards(b, { at: 0.001, amp: 0.45, scale: f * 0.95, contact: 0.0065, t: 0.8 })
      puff(b, { at: 0.002, dur: 0.14, f: 1200, fTo: 300, amp: 0.12 })
      floorboards(b, { at: 0.088, amp: 0.16, scale: f * 1.12, contact: 0.004, t: 0.5 })
      floorboards(b, { at: 0.152, amp: 0.07, scale: f * 1.05, contact: 0.004, t: 0.4 })
    }
  },

  charge: {
    sprite: 'foot', slots: 1, pick: 'loop', loop: true, dur: 0.5, target: -31, metric: 'ph50',
    hp: 90,
    about: `The wind-up as a COZY GATHER: a warm D3 hum breathing four times a second, a soft intake of air under it, a felt-tipped clockwork pawl winding eight to the second, and one quiet glass harmonic three octaves up that glints as the pitch climbs. The runtime raises its playback rate with the charge — the hum rises about eight semitones, the breath opens from 3.2 to 5 Hz, the pawl winds from 6.4 to 10 a second — and stops it dead on release.`,
    // ─── Why this was rebuilt ─────────────────────────────────────────────
    //
    // The first version was a 220 Hz reed with formants at 1150 and 2400 Hz,
    // gated by a 16 Hz tremolo at 0.65 depth and shaped to a point (`pow 1.6`),
    // with a 1322/1330 Hz pair beating underneath. Every one of those numbers
    // is a textbook recipe for ANNOYING, and the player holds it for up to
    // 600 ms every few seconds:
    //
    //   • 16 Hz tremolo at depth, carried by the runtime's own rate ramp to
    //     20 Hz at full charge — the centre of the ROUGHNESS band, where
    //     amplitude modulation stops reading as a pulse and starts reading as
    //     a rasp. The louder and more charged it got, the rougher it got.
    //   • formants at 1150/2400 Hz riding to 1450/3000 — straight through the
    //     ear's most sensitive octave, on a sustained tone, which is a wasp.
    //   • an 8 Hz beat at 1.3 kHz: a second roughness source in the same band.
    //
    // ── What replaced it ──
    //
    // The same job — "energy is being stored, and there is more of it every
    // frame" — done with the two things this game's audience actually finds
    // satisfying, and nothing in the rasp band:
    //
    //   THE BREATH    a warm hum on a low fundamental, swelling at 4 Hz. Four
    //                 Hz is a slow breath, an order of magnitude below the
    //                 roughness band, and it never enters it: the rate ramp
    //                 tops it out at 5 Hz, which is where a singer's vibrato
    //                 lives. The pitch does all the rising; the modulation
    //                 stays calm.
    //   THE PAWL      the "charging" READ, and the reason this is not just a
    //                 pad. Discrete felt-tipped wooden ticks at 8 a second —
    //                 slow enough that the ear counts them as events rather
    //                 than fusing them into a buzz (fusion starts around
    //                 20 Hz, which is exactly where the old tremolo sat). They
    //                 wind visibly faster as the charge builds, which is the
    //                 clearest feedback in the cue.
    //
    // Everything periodic is snapped with `onGrid`, and the ticks are placed at
    // exact quarters of the loop, so the kept middle period is seamless and the
    // pawl's alternation lands the same way across the loop point.
    //
    // ── Measured, both cues, at both ends of the runtime's rate ramp ──
    //
    //                       modulation energy      where the modulation
    //                       in the 15-35 Hz        actually peaks
    //                       roughness band
    //   OLD @ 0.80x               6.1 %                 12.8 Hz
    //   OLD @ 1.26x              49.7 %                 20.3 Hz   ← held = raspy
    //   NEW @ 0.80x               8.7 %                  3.3 Hz
    //   NEW @ 1.26x              16.6 %                  5.0 Hz   ← held = faster
    //
    // The old cue put HALF its modulation energy into the rasp band at full
    // charge, and peaked dead in the middle of it. The new one peaks on the
    // breath at either end; what is left in the band is the pawl's tick rate,
    // which is a train of separate damped events rather than a tone being
    // chopped — the ear counts those, it does not hear them as roughness.
    // The old cue also put 3.2 % of its spectrum in 1.5-4 kHz at full charge;
    // this one puts none.
    render: (b, _i, { L }) => {
      const D = b.out.length / b.sr
      const TAU = 2 * Math.PI
      // 4 Hz at L = 0.5 s — the grid is 2 Hz here, so this is as slow as a
      // breath can be without halving to a 2 Hz pump.
      const breathHz = onGrid(4, L)
      const swell = (t, depth) => 1 - depth + depth * (0.5 - 0.5 * Math.cos(TAU * breathHz * t))
      // D3. Low enough to be warm at the ramp's top (1.26× ≈ 186 Hz) rather
      // than shrill, and its 2nd–4th harmonics are what a phone speaker
      // actually reproduces — which is what `ph50` levels it against.
      const f0 = onGrid(148, L)

      // ── The hum ── the body of the thing gathering itself.
      partials(b, {
        at: 0, dur: D, pitch: f0,
        parts: [[1, 1], [2, 0.5], [3, 0.2], [4, 0.07], [6, 0.02]],
        amp: 0.46, env: (t) => swell(t, 0.22)
      })

      // ── The intake ── soft air, pink and low-passed well under the band the
      // old cue lived in. `periodic` makes the noise itself loop.
      noise(b, {
        at: 0, dur: D, amp: 0.19, mode: 'lp', f: 760, q: 0.7, color: 'pink', periodic: L,
        env: (t) => swell(t, 0.34)
      })

      // ── The pawl ── a wooden clockwork, alternating two neighbouring pitches
      // so it reads as a mechanism with two teeth rather than a metronome.
      //
      // The amplitudes here are not a guess and they are not "small because a
      // tick should be quiet". Measured against the hum on the project's own
      // phone-weighted meter, the first pass at 0.065 came out 29 dB down — a
      // layer that does not exist on a phone speaker, which would have left
      // this cue a warm pad with no wind-up in it at all. These land it about
      // 15 dB down: plainly audible as a mechanism, well under the hum.
      //
      // `hard` was measured too, and it moves the band balance by almost
      // nothing (the hum's own harmonics dominate every band either way) — so
      // it is set for the CONTACT the ear reads, a wooden pawl rather than a
      // felt thud, and the level is what carries the layer.
      const step = L / 4
      for (let t = 0; t < D - 0.0001; t += step) {
        const odd = Math.round(t / step) % 2 === 1
        woodblock(b, { at: t, f: odd ? 466 : 440, amp: odd ? 0.23 : 0.3, t60: 0.055, hard: 0.7 })
      }

      // ── The glint ── one quiet harmonic of the hum (the 8th) and a fifth
      // above it. Consonant by construction, so it fuses into the hum's timbre
      // instead of sitting on top as a separate tone — which is the one thing
      // the old beating pair could never do.
      partials(b, {
        at: 0, dur: D, pitch: onGrid(f0 * 8, L), parts: [[1, 1], [1.5, 0.35]],
        amp: 0.055, env: (t) => 0.55 + 0.45 * (0.5 - 0.5 * Math.cos(TAU * onGrid(2, L) * t))
      })
    }
  },

  chargeReady: {
    sprite: 'foot', slots: 1, pick: 'rotate', dur: 0.4, target: -34, metric: 'ph50', hp: 200,
    about: `A small bright "ting" the moment the charge is full — a release point the player can hear.`,
    render: (b) => {
      mallet(b, { at: 0, f: mtof(95), amp: 0.7, hard: 0.8, kind: 'glock', t60: 0.35 })
      mallet(b, { at: 0.035, f: mtof(102), amp: 0.3, hard: 0.8, kind: 'glock', t60: 0.25 })
    }
  },

  pivot: {
    sprite: 'props', slots: 2, pick: 'rotate', dur: 0.35, target: -30, metric: 'ph50', hp: 150, rate: 0.03,
    about: `The heel turn: a sneaker squeak (a stick-slip pulse train through the sole's resonances) over a rising swish.`,
    render: (b) => {
      const f = jit(b, 1, 0.06)
      reed(b, {
        at: 0.018, dur: 0.12, pitch: [[0, 880 * f], [0.05, 1320 * f], [0.12, 1120 * f]], jitter: 0.07, pulseMs: 0.22,
        formants: [[2300, 4, 1], [3500, 5, 0.5], [1300, 3, 0.45]], env: [[0, 0], [0.012, 1], [0.09, 0.8], [0.12, 0]], amp: 0.5
      })
      whoosh(b, { at: 0, dur: 0.26, from: 900, to: 3800, amp: 0.28, q: 1.1, peak: 0.3 })
    }
  },

  slide: {
    sprite: 'props', slots: 1, pick: 'loop', loop: true, dur: 0.5, target: -33, metric: 'ph50', hp: 100,
    about: `The roller skate ploughing a line, as a seamless loop: a wheel rumble thumping as the axle turns, the hiss of polyurethane on the floor, and a faint bearing whine.`,
    render: (b, _i, { L }) => {
      const D = b.out.length / b.sr
      noise(b, { at: 0, dur: D, amp: 0.5, mode: 'lp', f: 420, q: 0.9, periodic: L, env: (t) => 0.7 + 0.3 * Math.pow(0.5 + 0.5 * Math.cos(2 * Math.PI * onGrid(14, L) * t), 3) })
      noise(b, { at: 0, dur: D, amp: 0.3, mode: 'bp', f: 1500, q: 0.8, periodic: L, env: (t) => 0.8 + 0.2 * Math.sin(2 * Math.PI * onGrid(28, L) * t) })
      partials(b, { at: 0, dur: D, pitch: onGrid(1150, L), parts: [[1, 0.035], [2, 0.012]], amp: 1, env: (t) => 0.8 + 0.2 * Math.sin(2 * Math.PI * onGrid(4, L) * t) })
    }
  },

  // ══ THE BODIES ═════════════════════════════════════════════════════════════

  spike: {
    sprite: 'props', slots: 2, pick: 'rotate', dur: 0.6, target: -25.5, metric: 'ph50', hp: 120, rate: 0.02,
    about: `The mistake, played for a laugh: three needle pricks, a jaw-harp "bwoing" as the foot bounces off, then a plunger-muted trombone sliding down a fifth. Unmistakably wrong, never harsh — and an instrument, never a voice.`,
    render: (b, v) => {
      const f = v === 0 ? 1 : st(-1)
      for (let k = 0; k < 3; k++) tick(b, 0.002 + k * 0.012 + range(b, 0, 0.004), range(b, 3800, 5200), 3, 0.004, 0.16)
      osc(b, { at: 0.004, dur: 0.3, wave: 'tri', pitch: [[0, 330 * f], [0.3, 240 * f]], vibRate: 17, vibDepth: 0.06, amp: 0.34, env: (t) => adEnv(t, 0.003, 0.01, 0.2) })
      reed(b, {
        at: 0.07, dur: 0.42, jitter: 0.008, pulseMs: 0.8, breath: 0.06,
        pitch: [[0, 294 * f], [0.1, 286 * f], [0.42, 196 * f]],
        // A trombone's lip buzz through its bell (the 1.2 and 2.4 kHz rings
        // are brass, not a vowel), the plunger opening once — kept narrow, so
        // it reads as an instrument and never as a voice.
        formants: [[[[0, 620], [0.1, 900], [0.42, 640]], 2.2, 1], [1200, 4, 0.7], [2400, 5, 0.35]],
        env: [[0, 0], [0.02, 1], [0.1, 0.85], [0.34, 0.7], [0.42, 0]], amp: 0.55
      })
    }
  },

  // ══ THE CHAIN AND THE VIAL ═════════════════════════════════════════════════

  chainStep: {
    sprite: 'chain', slots: LADDER_STEPS, pick: 'index', dur: 0.7, target: -28, metric: 'ph50', hp: 200,
    slotDb: (i) => i * (2 / 14), room: ['plate', 0.14], maxDur: 0.55, fadeOutMs: 60,
    about: `Fifteen notes, each rendered at its own pitch (no resampling): a glockenspiel–celesta bar struck with a mallet that gets harder up the ladder, with a beating shimmer on the upper rungs and a touch of plate. Loudness-matched rung to rung with a gentle 2 dB rise, so the phrase climbs without the top notes shrieking.`,
    render: (b, i) => {
      const f = chainFreqOf(i)
      const k = i / 14
      const t60 = 0.95 - 0.45 * k
      strike(b, {
        at: 0, amp: 1, contact: 0.0013 - 0.0006 * k,
        modes: [[f, 1, t60], [2 * f, 0.13, t60 * 0.5], [BAR[1] * f, 0.3, t60 * 0.33], [BAR[2] * f, 0.1, t60 * 0.14], [BAR[3] * f, 0.04, t60 * 0.07]]
      })
      tick(b, 0.0003, Math.min(7000, f * 4), 2, 0.003, 0.05 + 0.06 * k)
      if (k > 0.25) partials(b, { at: 0.002, dur: 0.55, pitch: f, parts: [[3, 0.05 * k, 0.35], [3 + 5 / f, 0.05 * k, 0.35]], amp: 1, env: (t) => adEnv(t, 0.004, 0, 0.45) })
    }
  },

  chainBreak: {
    sprite: 'chain', slots: 2, pick: 'rotate', dur: 0.7, target: -33, metric: 'ph50', hp: 150,
    about: `The chain lapsing: two soft marimba notes falling a fourth. The clock ran out — a shrug, not a failure.`,
    render: (b, v) => {
      const [a, c] = v === 0 ? [D5, mtof(69)] : [mtof(76), Bn4]
      mallet(b, { at: 0, f: a, amp: 0.9, hard: 0.25, kind: 'marimba', t60: 0.45 })
      mallet(b, { at: 0.11, f: c, amp: 0.7, hard: 0.2, kind: 'marimba', t60: 0.55 })
    }
  },

  grow: {
    sprite: 'chain', slots: 4, pick: 'rotate', dur: 0.3, target: -33, metric: 'ph50', hp: 150, rate: 0.02, ratePower: [0.94, 1.18],
    about: `Growth Spurt: a squeaky rubber toy squeezed — a squeaker reed rising through the toy's body resonances over a little rubber boing. The runtime raises its pitch with the multiplier.`,
    render: (b) => {
      const f = jit(b, 1, 0.05)
      reed(b, {
        at: 0.004, dur: 0.15, pitch: [[0, 720 * f], [0.1, 1060 * f], [0.15, 1010 * f]], pulseMs: 0.34, jitter: 0.025, breath: 0.45,
        formants: [[1850, 3, 1], [3050, 4, 0.55], [950, 2, 0.45]], env: [[0, 0], [0.014, 1], [0.1, 0.9], [0.15, 0]], amp: 0.6
      })
      osc(b, { at: 0, dur: 0.17, wave: 'tri', pitch: [[0, 190 * f], [0.08, 330 * f]], vibRate: 22, vibDepth: 0.04, amp: 0.22, env: (t) => adEnv(t, 0.004, 0.02, 0.1) })
    }
  },

  deflate: {
    sprite: 'chain', slots: 1, pick: 'rotate', dur: 0.7, target: -31, metric: 'ph50', hp: 150, rate: 0.03,
    about: `The shoe shrinking back from ×3 and up: a balloon's neck squealing down as the air goes, fluttering, and a last little "pft".`,
    render: (b) => {
      reed(b, {
        at: 0, dur: 0.52, pitch: [[0, 780], [0.1, 660], [0.45, 270], [0.52, 230]], pulseMs: 0.55, jitter: 0.12, shimmer: 0.35, breath: 0.7,
        formants: [[1150, 2.5, 1], [2450, 3, 0.55], [520, 2, 0.45]], env: [[0, 0], [0.02, 1], [0.4, 0.7], [0.52, 0]], amp: 0.6
      })
      noise(b, { at: 0, dur: 0.5, amp: 0.1, mode: 'bp', f: [[0, 3400], [0.5, 1500]], q: 0.8, env: [[0, 0], [0.03, 1], [0.5, 0]] })
      puff(b, { at: 0.53, dur: 0.07, f: 1800, amp: 0.2 })
    }
  },

  feverReady: {
    sprite: 'flow', slots: 1, pick: 'rotate', dur: 1.2, target: -23.5, metric: 'ph50', hp: 250,
    presence: { f: 3000, gain: 2, q: 0.9 }, room: ['plate', 0.22],
    about: `The vial is full — the one cue that must never be missed on a busy board. Everything about it is chosen to be unlike the rest of the mix: a sparkle glissando up the ladder, then a bright FM bell "ding-DING!" a fourth apart (a rhythm nothing else has), then a shimmering tremolo halo, all sitting in the 2–5 kHz band a phone plays best and the squish leaves free.`,
    render: (b) => {
      const run = [G6, A6, mtof(95), mtof(98), mtof(100), mtof(103)]
      run.forEach((f, i) => mallet(b, { at: i * 0.021, f, amp: 0.22 + i * 0.04, hard: 0.9, kind: 'glock', t60: 0.3 }))
      for (const [at, f, a] of [[0.14, D6, 0.7], [0.25, G6, 1]]) {
        fm(b, { at, dur: 1, pitch: f, ratio: 3.5, index: 2.4, indexT60: 0.25, t60: 0.85, amp: a * 0.5 })
        mallet(b, { at, f, amp: a * 0.6, hard: 0.85, kind: 'glock', t60: 0.8 })
      }
      partials(b, {
        at: 0.26, dur: 0.85, pitch: G6, parts: [[1, 0.12], [1.5, 0.07], [2, 0.06]], amp: 1,
        env: (t) => adEnv(t, 0.03, 0.05, 0.6) * (0.55 + 0.45 * Math.sin(2 * Math.PI * 9 * t))
      })
      sparkle(b, { from: 0.2, to: 0.8, rate: 30, lo: 3000, hi: 6500, amp: 0.3 })
    }
  },

  feverStart: {
    sprite: 'flow', slots: 1, pick: 'rotate', dur: 2, target: -25, metric: 'ph400', hp: 45, room: ['hall', 0.34], maxDur: 1.7,
    about: `The gilded boot arriving: a gold "shwang" (a plate's inharmonic cluster, a friendly crash and a saturated body), a brass run up G–B–D–G into a held chord, an upward whoosh, and a rain of glints.`,
    render: (b) => {
      thump(b, { at: 0, f0: 140, f1: 55, glide: 0.04, t60: 0.45, amp: 0.75, drive: 2.5 })
      strike(b, { at: 0, amp: 0.4, contact: 0.0008, modes: [[233, 1, 1.1], [411, 0.8, 0.9], [587, 0.6, 0.8], [838, 0.5, 0.6], [1190, 0.4, 0.5], [1662, 0.3, 0.4], [2310, 0.2, 0.3]] })
      crash(b, { at: 0.002, amp: 0.55, t60: 1.1 })
      whoosh(b, { at: 0, dur: 0.42, from: 600, to: 7000, amp: 0.3, q: 1, peak: 0.7 })
      const notes = [G4, Bn4, D5, G5]
      notes.forEach((f, i) => brass(b, { at: 0.02 + i * 0.055, f, dur: 0.14, amp: 0.28, bright: 0.9 }))
      for (const f of [G4, Bn4, D5, G5]) brass(b, { at: 0.24, f, dur: 0.62, amp: 0.22, bright: 0.7, release: 0.35, scoop: 0 })
      sparkle(b, { from: 0.18, to: 1.3, rate: 45, lo: 2800, hi: 7000, amp: 0.35 })
    }
  },

  feverEnd: {
    sprite: 'flow', slots: 1, pick: 'rotate', dur: 0.9, target: -29, metric: 'ph50', hp: 90, room: ['plate', 0.18],
    about: `The boot shrinking, accented ON the frame it shrinks (the event): a rubbery "fwoomp" down, a puff of air, and the fever's bells walking back down D–B–G.`,
    render: (b) => {
      osc(b, { at: 0, dur: 0.22, wave: 'tri', pitch: [[0, 720], [0.2, 170]], amp: 0.45, env: (t) => adEnv(t, 0.003, 0.02, 0.14) })
      puff(b, { at: 0, dur: 0.18, f: 2200, fTo: 400, amp: 0.25 })
      ;[D6, Bn5, G5].forEach((f, i) => mallet(b, { at: 0.05 + i * 0.085, f, amp: 0.45 - i * 0.08, hard: 0.55, kind: 'glock', t60: 0.5 }))
    }
  },

  // ══ THE CLOSE OF A LEVEL ═══════════════════════════════════════════════════

  finisher: {
    sprite: 'flow', slots: 2, pick: 'index', dur: 2, target: -21, metric: 'ph50', slotDb: (i) => (i === 0 ? -2.5 : 0),
    hp: 45, room: ['hall', 0.34], maxDur: 1.65, fadeOutMs: 120,
    about: `The jackpot that closes every level, in B major so it lands IN the fanfare that starts on the same frame (celebration-1). Slot 0 is the tap finish, slot 1 the slam. The slam: a big saturated hit and the floor, a cash-register "ka-CHING!", a glockenspiel run up B–D♯–F♯–B–D♯, a friendly crash, two party poppers and a shower of coins; its weight is inside the first 0.9 s, before any interstitial can cut it.`,
    render: (b, i) => {
      const heavy = i === 1
      if (heavy) {
        noise(b, { at: 0, dur: 0.014, amp: 0.45, mode: 'bp', f: 4200, q: 0.7, env: (t) => adEnv(t, 0.0002, 0.0006, 0.006) })
        thump(b, { at: 0, f0: 165, f1: 52, glide: 0.04, t60: 0.42, amp: 0.6, drive: 3 })
        floorboards(b, { at: 0.001, amp: 0.35, contact: 0.004 })
      } else {
        thump(b, { at: 0, f0: 150, f1: 70, glide: 0.03, t60: 0.2, amp: 0.32, drive: 2 })
        floorboards(b, { at: 0.001, amp: 0.18, contact: 0.003, t: 0.7 })
      }
      // Ka — the drawer — then CHING.
      woodblock(b, { at: 0.02, f: 1650, amp: 0.3, t60: 0.04 })
      tick(b, 0.02, 3400, 2, 0.006, 0.2)
      coin(b, { at: 0.055, f: B6, amp: 0.85, t60: 0.7 })
      coin(b, { at: 0.058, f: Fs6 * 2, amp: 0.5, t60: 0.55 })
      fm(b, { at: 0.055, dur: 1.2, pitch: B6, ratio: 2.76, index: 1.6, indexT60: 0.2, t60: 0.9, amp: 0.32 })
      const run = heavy ? [B5, Ds6, Fs6, B6, Ds7] : [B5, Ds6, Fs6, B6]
      run.forEach((f, k) => mallet(b, { at: 0.07 + k * 0.048, f, amp: 0.62 + k * 0.06, hard: 0.85, kind: 'glock', t60: 0.8 }))
      crash(b, { at: 0.003, amp: heavy ? 0.55 : 0.3, t60: heavy ? 1.2 : 0.8 })
      popper(b, { at: 0.085, amp: heavy ? 0.5 : 0.4 })
      if (heavy) {
        popper(b, { at: 0.16, amp: 0.45 })
        scatter(b, 0.12, 1.1, (u) => 34 * (1 - u) + 4, (t, u) => coin(b, { at: t, f: logRange(b, 2600, 4200), amp: range(b, 0.08, 0.2) * (1 - 0.6 * u), t60: range(b, 0.12, 0.3) }))
      }
      sparkle(b, { from: 0.3, to: heavy ? 1.3 : 0.9, rate: 28, lo: 3000, hi: 7000, amp: 0.25 })
    }
  },

  heartbeat: {
    sprite: 'flow', slots: 2, pick: 'rotate', dur: 0.5, target: -31, metric: 'ph50', hp: 45, rate: 0.015,
    about: `Lub-dub under the one-to-go hold — soft and muffled, a held breath rather than a horror film. The old one was a 50 Hz sine a phone could not play; this one's body is saturated into 100–400 Hz so it is felt on a speaker too.`,
    render: (b) => {
      const f = jit(b, 1, 0.03)
      for (const [at, f0, a] of [[0, 92, 1], [0.165, 104, 0.7]]) {
        thump(b, { at, f0: f0 * f, f1: 52 * f, glide: 0.025, t60: 0.13, amp: a * 0.9, drive: 3.2, attack: 0.004 })
        strike(b, { at, amp: a * 0.35, contact: 0.009, modes: [[118 * f, 1, 0.08], [205 * f, 0.6, 0.06], [340 * f, 0.4, 0.04]] })
      }
    }
  },

  star: {
    sprite: 'flow', slots: 3, pick: 'index', dur: 1, target: -29, metric: 'ph50', hp: 250, room: ['plate', 0.2], maxDur: 0.8, fadeOutMs: 80,
    slotDb: (i) => i * 0.8,
    about: `One note per star, rising B–D–G, in G major because the result screen's sting ("Stomped It!", tools/music) lands on G and the stars ring inside its first second: a celesta bar with a glockenspiel octave and a paper-crinkle of sparkle; the third star rings longer and adds the B above.`,
    render: (b, i) => {
      const f = [Bn5, D6, G6][i]
      mallet(b, { at: 0, f, amp: 0.9, hard: 0.75, kind: 'celesta', t60: 0.9 + i * 0.2 })
      mallet(b, { at: 0.004, f: f * 2, amp: 0.3, hard: 0.9, kind: 'glock', t60: 0.5 })
      if (i === 2) mallet(b, { at: 0.06, f: B6, amp: 0.4, hard: 0.85, kind: 'glock', t60: 0.8 })
      sparkle(b, { from: 0.01, to: 0.35 + i * 0.1, rate: 40 + i * 20, lo: 3500, hi: 7200, amp: 0.2 })
    }
  },

  tick: {
    sprite: 'flow', slots: 2, pick: 'alternate', dur: 0.2, target: -34, metric: 'ph50', hp: 300, rate: 0.01,
    about: `The last ten seconds: a dry wood block, tick then tock. Quiet, and it never rises — a clock that panics makes a child panic.`,
    render: (b, v) => {
      woodblock(b, { at: 0, f: v === 0 ? 1320 : 1110, amp: 0.8, t60: 0.055, hard: 0.85 })
    }
  },

  // ══ PROPS ══════════════════════════════════════════════════════════════════

  salt: {
    sprite: 'props', slots: 2, pick: 'rotate', dur: 0.7, target: -27, metric: 'ph50', hp: 200, rate: 0.03,
    about: `A shaker bursting: the cap's plastic "pok", a spray of air, and hundreds of grains skittering over the floor, thinning out.`,
    render: (b) => {
      strike(b, { at: 0, amp: 0.5, contact: 0.0008, modes: [[range(b, 1050, 1350), 1, 0.05], [range(b, 2100, 2600), 0.5, 0.03], [range(b, 520, 650), 0.5, 0.04]] })
      noise(b, { at: 0.002, dur: 0.25, amp: 0.2, mode: 'hp', f: 3500, env: (t) => adEnv(t, 0.002, 0.02, 0.12) })
      scatter(b, 0.005, 0.5, (u) => 900 * Math.pow(1 - u, 2) + 40, (t, u) => {
        tick(b, t, logRange(b, 3200, 7500), 2.5, range(b, 0.0008, 0.002), range(b, 0.05, 0.2) * (1 - 0.5 * u))
      })
    }
  },

  magnet: {
    sprite: 'props', slots: 1, pick: 'rotate', dur: 0.8, target: -29, metric: 'ph50', hp: 90,
    about: `An electromagnet arming: a relay's clunk, a mains hum swelling up (a buzzy 120 Hz with its harmonics carried where a phone can play them) with a wobble, then the "vwomp" as it lets go.`,
    render: (b) => {
      woodblock(b, { at: 0, f: 820, amp: 0.4, t60: 0.05 })
      tick(b, 0.001, 3000, 2, 0.004, 0.25)
      reed(b, {
        at: 0.02, dur: 0.52, pitch: [[0, 118], [0.35, 126], [0.45, 124], [0.52, 90]], jitter: 0.004, pulseMs: 0.7,
        formants: [[900, 1.5, 1], [1900, 2, 0.6], [360, 1.4, 0.5]], amp: 0.6,
        env: (t) => Math.min(1, t / 0.3) * (t > 0.44 ? Math.max(0, 1 - (t - 0.44) / 0.08) : 1) * (0.8 + 0.2 * Math.sin(2 * Math.PI * 7 * t))
      })
      thump(b, { at: 0.46, f0: 150, f1: 70, glide: 0.04, t60: 0.14, amp: 0.3, drive: 1.5 })
    }
  },

  sweep: {
    sprite: 'props', slots: 3, pick: 'rotate', dur: 0.4, target: -29, metric: 'ph50', hp: 120, rate: 0.03,
    about: `The bar crossing a body: mechanical, not musical — a swish, a wiper's double clack, and a low knock of the rail.`,
    render: (b) => {
      whoosh(b, { at: 0, dur: 0.18, from: range(b, 700, 1000), to: range(b, 2600, 3400), amp: 0.35, q: 1.1, peak: 0.55 })
      const c = range(b, 0.05, 0.07)
      woodblock(b, { at: c, f: range(b, 1500, 1800), amp: 0.4, t60: 0.03 })
      woodblock(b, { at: c + range(b, 0.022, 0.03), f: range(b, 1250, 1450), amp: 0.3, t60: 0.03 })
      strike(b, { at: c, amp: 0.4, contact: 0.003, modes: [[210, 1, 0.07], [380, 0.6, 0.05], [640, 0.4, 0.035]] })
    }
  },

  podHatch: {
    sprite: 'props', slots: 1, pick: 'rotate', dur: 0.7, target: -31, metric: 'ph50', hp: 150,
    about: `Layered OVER the crush bank's crack-and-scurry (which says WHAT happened): an ocarina's little "aww", two notes falling a minor third, so an egg that got away feels like a loss without being a punishment.`,
    render: (b) => {
      for (const [at, f, dur] of [[0, mtof(76), 0.16], [0.17, mtof(73), 0.34]]) {
        osc(b, { at, dur, pitch: [[0, f * 1.01], [0.03, f]], vibRate: 5.5, vibDepth: 0.008, vibDelay: 0.08, amp: 0.5, env: (t) => Math.min(1, t / 0.02) * (t > dur - 0.08 ? Math.max(0, (dur - t) / 0.08) : 1) })
        partials(b, { at, dur, pitch: f, parts: [[2, 0.08], [3, 0.04]], amp: 0.5, env: (t) => Math.min(1, t / 0.02) * (t > dur - 0.08 ? Math.max(0, (dur - t) / 0.08) : 1) })
        noise(b, { at, dur, amp: 0.05, mode: 'bp', f: f * 2, q: 3, env: (t) => Math.min(1, t / 0.015) * Math.max(0, 1 - t / dur) })
      }
    }
  },

  arc: {
    sprite: 'props', slots: 4, pick: 'rotate', dur: 0.2, target: -31, metric: 'ph50', hp: 150, rate: 0.04,
    about: `The electric sock's arc to a body: a cartoon "bzzt" — an irregular buzz stuttering two or three times through a bright band, a few sparks — band-limited so it zaps without stinging.`,
    render: (b) => {
      const bursts = 2 + Math.floor(b.rnd() * 2)
      let t = 0
      for (let k = 0; k < bursts; k++) {
        const d = range(b, 0.02, 0.04)
        reed(b, {
          at: t, dur: d, pitch: range(b, 95, 140), jitter: 0.35, pulseMs: 0.12, breath: 0.6,
          formants: [[range(b, 1800, 2600), 2.2, 1], [range(b, 3600, 4600), 3, 0.5]],
          env: (u) => adEnv(u, 0.001, d * 0.5, d * 0.6), amp: 0.6 * (1 - 0.25 * k)
        })
        t += d + range(b, 0.006, 0.014)
      }
      scatter(b, 0, t, 120, (u) => tick(b, u, logRange(b, 3500, 6500), 3, 0.002, range(b, 0.05, 0.15)))
    }
  },

  // ══ THE BOSS ═══════════════════════════════════════════════════════════════

  bossPhase: {
    sprite: 'boss', slots: 1, pick: 'rotate', dur: 1.4, target: -24, metric: 'ph50', hp: 45, room: ['hall', 0.28], maxDur: 1.2,
    about: `The boss changing gear: a gear-crunch ratchet, then "dun-DUN!" — two low brass stabs a fifth apart, each on a timpani hit.`,
    render: (b) => {
      scatter(b, 0, 0.1, 150, (t) => woodblock(b, { at: t, f: range(b, 900, 1300), amp: 0.25, t60: 0.02 }))
      for (const [at, f, dur] of [[0.12, mtof(43), 0.16], [0.36, mtof(50), 0.5]]) {
        brass(b, { at, f, dur, amp: 0.5, bright: 0.6, release: 0.2 })
        brass(b, { at, f: f * 2, dur, amp: 0.3, bright: 0.6, release: 0.2 })
        thump(b, { at, f0: f * 1.6, f1: f, glide: 0.05, t60: 0.5, amp: 0.55, drive: 2.2 })
        strike(b, { at, amp: 0.3, contact: 0.003, modes: [[f * 1.5, 1, 0.4], [f * 2.4, 0.6, 0.3], [f * 3.3, 0.4, 0.2]] })
      }
    }
  },

  bossCharge: {
    sprite: 'boss', slots: 1, pick: 'rotate', dur: 0.8, target: -24, metric: 'ph50', hp: 120, maxDur: 0.7,
    about: `The charge tell, and it has 620 ms to work: two hoof scrapes, a slide whistle climbing the whole time, and a snort AT 0.6 s — the moment the wind-up (the counter window) begins. A cartoon bull, not a monster.`,
    render: (b) => {
      for (const at of [0, 0.2]) {
        noise(b, { at, dur: 0.13, amp: 0.4, mode: 'bp', f: [[0, 1500], [0.12, 2600]], q: 1.2, env: (t) => adEnv(t, 0.01, 0.03, 0.06) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 60 * t)) })
        strike(b, { at, amp: 0.3, contact: 0.004, modes: [[160, 1, 0.07], [300, 0.6, 0.05]] })
      }
      osc(b, {
        at: 0.02, dur: 0.58, pitch: [[0, 620], [0.55, 1560]], vibRate: 9, vibDepth: 0.012, amp: 0.45,
        env: (t) => Math.min(1, t / 0.08) * (t > 0.52 ? Math.max(0, 1 - (t - 0.52) / 0.06) : 1)
      })
      noise(b, { at: 0.02, dur: 0.58, amp: 0.05, mode: 'bp', f: [[0, 1240], [0.55, 3100]], q: 4, env: (t) => Math.min(1, t / 0.1) * (t > 0.52 ? Math.max(0, 1 - (t - 0.52) / 0.06) : 1) })
      puff(b, { at: 0.59, dur: 0.09, f: 1700, amp: 0.5 })
      noise(b, { at: 0.59, dur: 0.08, amp: 0.25, mode: 'bp', f: 700, q: 1.5, env: (t) => adEnv(t, 0.003, 0.01, 0.035) })
    }
  },

  bossBeam: {
    sprite: 'boss', slots: 1, pick: 'rotate', dur: 2.7, target: -31, metric: 'ph400', hp: 110, maxDur: 2.6,
    about: `The beam, timed to the sim (900 ms tell, 1600 ms sweep): a toy ray-gun charging up with a rising warble, a "pew" as it fires, then a buzzy, wobbling beam that powers down at 2.5 s.`,
    render: (b) => {
      osc(b, { at: 0, dur: 0.9, pitch: [[0, 300], [0.88, 1250]], vibRate: 12, vibDepth: 0.02, amp: 0.3, env: (t) => Math.min(1, t / 0.2) * (t > 0.85 ? Math.max(0, 1 - (t - 0.85) / 0.05) : 1) * (0.6 + 0.4 * Math.sin(2 * Math.PI * (6 + 14 * t / 0.9) * t)) })
      osc(b, { at: 0.9, dur: 0.12, pitch: [[0, 2200], [0.12, 700]], amp: 0.4, env: (t) => adEnv(t, 0.002, 0.01, 0.08) })
      for (const [cents, g] of [[0, 1], [11, 0.7], [-9, 0.6]]) {
        osc(b, {
          at: 0.92, dur: 1.6, wave: 'saw', pitch: (t) => 150 * Math.pow(2, cents / 1200) * (1 + 0.03 * Math.sin(2 * Math.PI * 5 * t)), amp: 0.12 * g,
          env: (t) => Math.min(1, t / 0.03) * (t > 1.5 ? Math.max(0, 1 - (t - 1.5) / 0.1) : 1)
        })
      }
      noise(b, { at: 0.92, dur: 1.6, amp: 0.08, mode: 'bp', f: [[0, 2400], [0.8, 3200], [1.6, 2400]], q: 3, env: (t) => Math.min(1, t / 0.03) * (t > 1.5 ? Math.max(0, 1 - (t - 1.5) / 0.1) : 1) })
      osc(b, { at: 2.44, dur: 0.18, pitch: [[0, 900], [0.18, 200]], amp: 0.25, env: (t) => adEnv(t, 0.004, 0.02, 0.12) })
    },
    post: (x, sr) => svf(x, sr, 'lp', 3800, 0.7)
  },

  bossCounter: {
    sprite: 'boss', slots: 1, pick: 'rotate', dur: 1.4, target: -24, metric: 'ph50', hp: 90, room: ['hall', 0.3], maxDur: 1.2,
    about: `The perfect counter's sting, over the boss's full crush from the bank: "ta-DAAH!" — a brass pickup into a G major stab, a crash, and a glint.`,
    render: (b) => {
      brass(b, { at: 0, f: D5, dur: 0.08, amp: 0.35, bright: 1 })
      for (const f of [G4, Bn4, D5, G5]) brass(b, { at: 0.11, f, dur: 0.5, amp: 0.28, bright: 1, release: 0.3 })
      crash(b, { at: 0.11, amp: 0.45, t60: 0.9 })
      sparkle(b, { from: 0.12, to: 0.7, rate: 30, amp: 0.25 })
    }
  },

  // ══ THE SET PIECES ═════════════════════════════════════════════════════════

  rushTell: {
    sprite: 'sets', slots: 1, pick: 'rotate', dur: 1.35, target: -30, metric: 'ph400', hp: 90, room: ['floor', 0.22], maxDur: 1.3,
    about: `A real snare roll over the 1.1 s tell: strokes accelerating from single taps into a buzz roll, crescendo, velocity-dependent brightness and tuning drift per stroke, landing on an accent at 1.08 s — right where the whistle takes over.`,
    render: (b) => {
      let t = 0
      let k = 0
      while (t < 1.05) {
        const u = t / 1.05
        const vel = 0.25 + 0.65 * Math.pow(u, 1.4)
        snare(b, { at: t, vel: vel * (k % 2 === 0 ? 1 : 0.86), tune: jit(b, 1, 0.012) })
        const rate = 7 + 23 * Math.pow(u, 1.2)
        t += (1 / rate) * jit(b, 1, 0.08)
        k++
      }
      snare(b, { at: 1.08, vel: 1, tune: 1 })
    }
  },

  rushGo: {
    sprite: 'sets', slots: 1, pick: 'rotate', dur: 0.45, target: -28, metric: 'ph50', hp: 300,
    about: `Here they come: a referee's pea whistle — a scooped tone the pea rattles at ~34 Hz, with the breath and chiff of the blow.`,
    render: (b) => {
      whistle(b, { at: 0, f: 2750, dur: 0.3, amp: 0.8, trill: 34, scoop: 0.1 })
    }
  },

  multi: {
    sprite: 'sets', slots: 6, pick: 'stack', dur: 0.8, target: -30, metric: 'ph50', hp: 250, maxDur: 0.55, fadeOutMs: 60,
    about: `One chime per body a stomp took: six notes up a G major arpeggio, each a coin disc's metallic ting over a soft bar; the runtime stacks the first n, 35 ms apart, so a four-for-one SOUNDS like four.`,
    render: (b, i) => {
      const f = [G5, Bn5, D6, G6, mtof(95), mtof(98)][i]
      // A coin disc's bright inharmonic "ting" over a softer bar an octave
      // down: metallic, so a stack of them never blurs into the chain's notes.
      coin(b, { at: 0, f: f * 2, amp: 0.7, t60: 0.4 })
      mallet(b, { at: 0.002, f, amp: 0.45, hard: 0.8, kind: 'glock', t60: 0.45 })
    }
  },

  flip: {
    sprite: 'sets', slots: 2, pick: 'rotate', dur: 0.45, target: -30, metric: 'ph50', hp: 150, rate: 0.03,
    about: `A shell going over on its back: a hollow chitin "tok", a rock and a smaller tok as it settles, and six little legs pedalling at the air.`,
    render: (b) => {
      const f = range(b, 640, 780)
      shellKnock(b, { at: 0, f, amp: 0.8 })
      shellKnock(b, { at: range(b, 0.07, 0.09), f: f * 1.08, amp: 0.35, t60: 0.06 })
      shellKnock(b, { at: range(b, 0.13, 0.15), f: f * 1.05, amp: 0.15, t60: 0.05 })
      scatter(b, 0.1, 0.38, 70, (t) => tick(b, t, logRange(b, 2400, 4800), 3, 0.003, range(b, 0.05, 0.12)))
    }
  },

  kick: {
    sprite: 'sets', slots: 3, pick: 'rotate', dur: 0.45, target: -28, metric: 'ph50', hp: 90, rate: 0.03,
    about: `Beetle Bowling's kick: the toe meeting a shell — a big hollow "THWOCK" (shell modes, a body thump) — and the whoosh of it taking off down the lane.`,
    render: (b) => {
      const f = range(b, 520, 640)
      thump(b, { at: 0, f0: 190, f1: 90, glide: 0.02, t60: 0.1, amp: 0.5, drive: 2 })
      shellKnock(b, { at: 0, f, amp: 0.9, t60: 0.12, hard: 0.6 })
      whoosh(b, { at: 0.02, dur: 0.3, from: 1200, to: 2800, amp: 0.2, q: 1.3, peak: 0.25 })
    }
  },

  pins: {
    sprite: 'sets', slots: 2, pick: 'index', dur: 1.8, target: -25, metric: 'ph50', hp: 70, room: ['alley', 0.3], maxDur: 1.4, fadeOutMs: 120,
    slotDb: (i) => (i === 0 ? -2 : 0),
    about: `Real bowling pins, modelled: every pin is a maple body with its own tuning, and the strike is an event list — the shell hitting the head pin, pin-on-pin collisions cascading, pins hitting the lane and bouncing, a last rattle — in a bowling alley. Slot 0 is a few pins, slot 1 a strike.`,
    render: (b, i) => {
      const n = i === 0 ? 4 : 10
      const tunings = Array.from({ length: n }, () => range(b, 0.92, 1.1))
      shellKnock(b, { at: 0, f: 560, amp: 0.6, t60: 0.1 })
      pin(b, { at: 0.002, f: tunings[0], amp: 1 })
      // Pin on pin.
      scatter(b, 0.015, i === 0 ? 0.18 : 0.3, (u) => (i === 0 ? 30 : 70) * (1 - u) + 5, (t, u) => {
        pin(b, { at: t, f: pick(b, tunings) * jit(b, 1, 0.01), amp: range(b, 0.35, 0.9) * (1 - 0.5 * u), hard: range(b, 0.8, 1) })
      })
      // Pins hitting the lane and bouncing.
      scatter(b, 0.12, i === 0 ? 0.6 : 0.9, (u) => (i === 0 ? 12 : 26) * (1 - u) + 3, (t, u) => {
        pin(b, { at: t, f: pick(b, tunings), amp: range(b, 0.2, 0.55) * (1 - 0.6 * u), hard: 0.75, floor: true })
      })
      if (i === 1) scatter(b, 0.6, 1.1, 14, (t, u) => pin(b, { at: t, f: pick(b, tunings), amp: range(b, 0.05, 0.15) * (1 - u), hard: 0.7 }))
    }
  },

  boxDrop: {
    sprite: 'sets', slots: 1, pick: 'rotate', dur: 0.5, target: -29, metric: 'ph50', hp: 70, room: ['floor', 0.2],
    about: `The present landing: a cardboard box's thump (its air cavity and damped panels), a papery settle, and a small bounce.`,
    render: (b) => {
      cardboard(b, { at: 0, f: 150, amp: 1, contact: 0.005 })
      thump(b, { at: 0, f0: 120, f1: 70, glide: 0.03, t60: 0.12, amp: 0.35, drive: 1.5 })
      cardboard(b, { at: 0.085, f: 165, amp: 0.3, contact: 0.004 })
    }
  },

  boxHit: {
    sprite: 'sets', slots: 3, pick: 'index', indexScale: 3, indexBase: -1, dur: 0.35, target: -29, metric: 'ph50', hp: 90,
    slotDb: (i) => i * 0.8,
    about: `Blows on the box, rising a step each (E–G–A of the ladder's scale): cardboard knocks with a pitched cavity — a countdown you can hear.`,
    render: (b, i) => {
      const f = [mtof(64), mtof(67), mtof(69)][i]
      cardboard(b, { at: 0, f, amp: 1, contact: 0.0028 })
      strike(b, { at: 0, amp: 0.35, contact: 0.002, modes: [[f * 2, 1, 0.08], [f * 3, 0.4, 0.05]] })
    }
  },

  boxOpen: {
    sprite: 'sets', slots: 1, pick: 'rotate', dur: 1.1, target: -26, metric: 'ph50', hp: 120, room: ['plate', 0.2], maxDur: 0.95,
    about: `The lid flies: a cardboard "fwump" and a tissue-paper rustle, then a glockenspiel run up the ladder and a sparkle — ta-da.`,
    render: (b) => {
      cardboard(b, { at: 0, f: 200, amp: 0.7, contact: 0.004 })
      puff(b, { at: 0, dur: 0.14, f: 2400, fTo: 700, amp: 0.3 })
      scatter(b, 0.02, 0.3, (u) => 220 * (1 - u) + 20, (t) => tick(b, t, logRange(b, 2000, 6000), 1, range(b, 0.002, 0.006), range(b, 0.04, 0.12)))
      ;[G5, A5, Bn5, D6, E6, G6].forEach((f, k) => mallet(b, { at: 0.08 + k * 0.042, f, amp: 0.35 + k * 0.05, hard: 0.8, kind: 'glock', t60: 0.55 }))
      sparkle(b, { from: 0.3, to: 0.8, rate: 30, amp: 0.25 })
    }
  },

  trialEnd: {
    sprite: 'sets', slots: 1, pick: 'rotate', dur: 0.8, target: -30, metric: 'ph50', hp: 120, room: ['plate', 0.18],
    about: `The borrowed shoe going back (and a spare box vanishing): a soft magic "poof" and two chimes stepping down.`,
    render: (b) => {
      puff(b, { at: 0, dur: 0.22, f: 3200, fTo: 600, amp: 0.4 })
      noise(b, { at: 0, dur: 0.25, amp: 0.12, mode: 'bp', f: [[0, 5000], [0.25, 1800]], q: 1.2, env: (t) => adEnv(t, 0.01, 0.02, 0.12) })
      mallet(b, { at: 0.06, f: D6, amp: 0.45, hard: 0.55, kind: 'celesta', t60: 0.5 })
      mallet(b, { at: 0.16, f: G5, amp: 0.4, hard: 0.5, kind: 'celesta', t60: 0.6 })
    }
  },

  quake: {
    sprite: 'sets', slots: 1, pick: 'rotate', dur: 1.4, target: -29, metric: 'ph400', hp: 40, room: ['floor', 0.3], maxDur: 1.2,
    about: `The Quake trophy: a big cartoon BOOM (a saturated low body a phone can carry), the floor ringing, a rolling rumble with a tremble in it, and everything on the table rattling.`,
    render: (b) => {
      noise(b, { at: 0, dur: 0.016, amp: 0.4, mode: 'bp', f: 3000, q: 0.7, env: (t) => adEnv(t, 0.0002, 0.001, 0.007) })
      thump(b, { at: 0, f0: 120, f1: 40, glide: 0.06, t60: 0.7, amp: 1, drive: 3.2 })
      floorboards(b, { at: 0.001, amp: 0.6, scale: 0.85, contact: 0.006, t: 1.4 })
      noise(b, { at: 0.01, dur: 1, amp: 0.4, mode: 'lp', f: [[0, 700], [1, 220]], color: 'brown', env: (t) => adEnv(t, 0.02, 0.05, 0.6) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 17 * t)) })
      rattle(b, { from: 0.03, to: 0.75, amp: 0.3, rate: 60 })
    }
  },

  echo: {
    sprite: 'sets', slots: 1, pick: 'rotate', dur: 0.7, target: -28, metric: 'ph50', hp: 60, room: ['floor', 0.3],
    about: `The Echo trophy's repeat, 400 ms after the slam: a softer, rounder slam with a "wub-wub-wub" flutter on it — the same stomp, as a ghost.`,
    render: (b) => {
      const L = { ...b, out: new Float32Array(b.out.length) }
      thump(L, { at: 0, f0: 130, f1: 55, glide: 0.035, t60: 0.3, amp: 0.8, drive: 2.2 })
      floorboards(L, { at: 0.001, amp: 0.4, contact: 0.006, t: 0.9 })
      noise(L, { at: 0.002, dur: 0.3, amp: 0.15, mode: 'lp', f: [[0, 2200], [0.3, 200]], env: (t) => adEnv(t, 0.004, 0.01, 0.2) })
      for (let n = 0; n < L.out.length; n++) {
        const t = n / b.sr
        b.out[n] += L.out[n] * (0.55 + 0.45 * Math.cos(2 * Math.PI * 24 * t))
      }
    }
  },

  twistTell: {
    sprite: 'sets', slots: 1, pick: 'rotate', dur: 0.7, target: -27, metric: 'ph50', hp: 150, room: ['plate', 0.15],
    about: `"Uh-oh!" as an instrument, never a voice: a clarinet (odd harmonics, a breathy onset) falling a fourth, the second note leaning into a wobble.`,
    render: (b) => {
      for (const [at, f, dur, vib] of [[0, mtof(76), 0.14, 0], [0.18, mtof(71), 0.3, 0.012]]) {
        osc(b, {
          at, dur, wave: 'square', pitch: [[0, f * 1.02], [0.03, f], [dur, f * (vib ? 0.97 : 1)]], vibRate: 6, vibDepth: vib, vibDelay: 0.06, amp: 0.3,
          env: (t) => Math.min(1, t / 0.02) * (t > dur - 0.05 ? Math.max(0, (dur - t) / 0.05) : 1)
        })
        noise(b, { at, dur, amp: 0.04, mode: 'bp', f: f * 3, q: 2, env: (t) => Math.min(1, t / 0.02) * Math.max(0, 1 - t / dur) })
      }
    },
    post: (x, sr) => svf(x, sr, 'lp', 2400, 0.8)
  },

  party: {
    sprite: 'sets', slots: 1, pick: 'rotate', dur: 1.9, target: -26, metric: 'ph400', hp: 90, room: ['hall', 0.25], maxDur: 1.75, fadeOutMs: 150,
    about: `The party starts — and the game is wordless, so the crowd is hands and noisemakers, not voices: a party blower unrolling, a popper and its streamers, a burst of applause, a second blower, a rattle, and a bell run up the ladder.`,
    render: (b) => {
      blower(b, { at: 0, dur: 0.36, amp: 0.5 })
      popper(b, { at: 0.34, amp: 0.7 })
      applause(b, { from: 0.36, to: 1.6, amp: 0.4, peakRate: 70 })
      blower(b, { at: 0.62, dur: 0.3, f0: 260, f1: 340, amp: 0.3 })
      scatter(b, 0.5, 0.95, 40, (t) => woodblock(b, { at: t, f: range(b, 1500, 1900), amp: 0.12, t60: 0.02 }))
      ;[G5, A5, Bn5, D6, E6, G6].forEach((f, k) => mallet(b, { at: 0.4 + k * 0.05, f, amp: 0.25 + k * 0.03, hard: 0.8, kind: 'glock', t60: 0.5 }))
    }
  }
}

/** Fill defaults and validate the table — the build and the tests read it through this. */
export const cueList = () => Object.entries(CUES).map(([id, c]) => ({ id, ...c }))
