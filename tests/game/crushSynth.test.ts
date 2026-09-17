// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  BOSS_SUBJECTS, CRUSH_BUDGET_BYTES, CRUSH_KINDS, CRUSH_RENDER_RATE, CRUSH_SUBJECTS,
  canonicalHeavy, crushKindsFor, crushPlan, crushSlotKey, crushVariants, hasCrushVoice, isBossSubject,
  renderCrush, startCrush, type CrushKind, type CrushSubject
} from '@/game/audio/crushSynth'
import { audioFeatures, featureDistance, powerSpectrum, type AudioFeatures } from '@/game/audio/audioFeatures'
import { BUGS, BUG_IDS } from '@/game/bugs'
import { BOSS_IDS } from '@/game/bosses'
import { JUICE_STYLES, type JuiceStyleId } from '@/game/juiceStyle'

/**
 * The crush bank's synthesiser, measured rather than listened to.
 *
 * These pin the CONTRACT the runtime relies on (every body has a voice, every
 * render is finite, clean-edged, under the ceiling and inside its length
 * budget, the same spec is the same samples) and the one DESIGN promise that can
 * regress silently: that the bodies sound different from each other. A refactor
 * that routed every bug through the ant's recipe would pass every other test in
 * this repo.
 */

const SR = CRUSH_RENDER_RATE

// Renders are deterministic, so the suite renders each spec once.
const memo = new Map<string, Float32Array>()
const render = (subject: CrushSubject, kind: CrushKind, style: JuiceStyleId, heavy = false, variant = 0): Float32Array => {
  const key = `${subject}|${kind}|${style}|${canonicalHeavy(subject, kind, heavy)}|${variant}`
  let x = memo.get(key)
  if (!x) {
    x = renderCrush({ subject, kind, style, variant, heavy, sampleRate: SR })
    memo.set(key, x)
  }
  return x
}

/** Spectral flatness over 1–8 kHz: ~0 for tones, higher for broadband noise.
 *  A shell cracking is noise; goo, soap and bells are tones. */
const flatness = (x: Float32Array): number => {
  const spec = powerSpectrum(x, 1024)
  const binHz = SR / 1024
  let lg = 0
  let ar = 0
  let n = 0
  for (let k = Math.ceil(1000 / binHz); k < Math.floor(8000 / binHz); k++) {
    const p = spec[k]! + 1e-12
    lg += Math.log(p)
    ar += p
    n++
  }
  return Math.exp(lg / n) / (ar / n)
}

describe('crush bank coverage', () => {
  it('has a voice for every bug, every boss, the pod and its hatch', () => {
    for (const id of BUG_IDS) expect(hasCrushVoice(id), id).toBe(true)
    for (const id of BOSS_IDS) expect(hasCrushVoice(id), id).toBe(true)
    expect(hasCrushVoice('pod')).toBe(true)
    expect(hasCrushVoice('hatch')).toBe(true)
    expect([...BOSS_SUBJECTS].sort()).toEqual([...BOSS_IDS].sort())
  })

  it('renders the kinds the bestiary can actually produce', () => {
    for (const b of BUGS) {
      const kinds = crushKindsFor(b.id)
      expect(kinds, b.id).toContain('crush')
      expect(kinds.includes('hurt'), `${b.id} hurt`).toBe(b.hp > 1 && b.segments === 0)
      expect(kinds.includes('clang'), `${b.id} clang`).toBe(b.armor > 0)
    }
    // The two armoured bodies are the whole reason `hurt` and `clang` exist.
    expect(crushKindsFor('beetle')).toEqual(['crush', 'hurt', 'clang'])
    expect(crushKindsFor('robobug')).toEqual(['crush', 'hurt', 'clang'])
    expect(crushKindsFor('pod')).toEqual(['crush'])
    expect(crushKindsFor('hatch')).toEqual(['crush'])
    for (const boss of BOSS_IDS) expect(crushKindsFor(boss)).toEqual(CRUSH_KINDS)
  })

  it('collapses the heavy flag where it makes no difference', () => {
    expect(canonicalHeavy('beetle', 'crush', true)).toBe(true)
    expect(canonicalHeavy('beetle', 'clang', true)).toBe(false)
    expect(canonicalHeavy('pod', 'crush', true)).toBe(false)
    expect(canonicalHeavy('hatch', 'crush', true)).toBe(false)
    expect(canonicalHeavy('queenAnt', 'crush', false)).toBe(true)
    expect(canonicalHeavy('queenAnt', 'hurt', true)).toBe(false)
    expect(crushSlotKey('beetle', 'clang', true)).toBe(crushSlotKey('beetle', 'clang', false))
  })
})

describe('renderCrush — the contract', () => {
  it('is deterministic for a spec, and the seed and variant matter', () => {
    const a = render('beetle', 'crush', 'ooze', true)
    const b = render('beetle', 'crush', 'ooze', true)
    expect(Array.from(a)).toEqual(Array.from(b))

    const other = render('beetle', 'crush', 'ooze', true, 1)
    expect(Array.from(other)).not.toEqual(Array.from(a))

    const seeded = renderCrush({ subject: 'beetle', kind: 'crush', style: 'ooze', variant: 0, heavy: true, sampleRate: SR, seed: 12345 })
    expect(Array.from(seeded)).not.toEqual(Array.from(a))
    const seededAgain = renderCrush({ subject: 'beetle', kind: 'crush', style: 'ooze', variant: 0, heavy: true, sampleRate: SR, seed: 12345 })
    expect(Array.from(seededAgain)).toEqual(Array.from(seeded))
  })

  it('renders the same samples in slices as in one go', () => {
    // The game fills its bank a few milliseconds at a time; the bench and these
    // tests render in one call. If the two ever differed, nothing here would be
    // testing what a player hears. A fake clock that advances 1 ms per call
    // forces a yield after nearly every voice.
    for (const [subject, kind, heavy] of [['beetle', 'crush', true], ['stinkbug', 'crush', false], ['roachPrime', 'crush', true]] as const) {
      let clock = 0
      const job = startCrush({ subject, kind, style: 'ooze', variant: 2, heavy, sampleRate: SR }, () => clock++)
      let data: Float32Array | null = null
      let slices = 0
      while (!data && slices < 10_000) { data = job.step(2); slices++ }
      expect(slices, subject).toBeGreaterThan(5)
      expect(Array.from(data!), subject).toEqual(Array.from(render(subject, kind, 'ooze', heavy, 2)))
    }
    // A zero budget runs one voice per step and must still finish — a job that
    // deferred its master pass on elapsed time alone never would.
    const tiny = startCrush({ subject: 'ant', kind: 'crush', style: 'ooze', variant: 0, heavy: false, sampleRate: SR })
    let out: Float32Array | null = null
    let steps = 0
    while (!out && steps < 100_000) { out = tiny.step(0); steps++ }
    expect(out).not.toBeNull()
    expect(Array.from(out!)).toEqual(Array.from(render('ant', 'crush', 'ooze')))
  })

  it('every body × style × kind × weight is finite, clean, under the ceiling and inside its length', () => {
    for (const style of JUICE_STYLES) {
      for (const subject of CRUSH_SUBJECTS) {
        for (const kind of crushKindsFor(subject)) {
          for (const heavy of [false, true]) {
            const label = `${style}/${subject}/${kind}/${heavy ? 'heavy' : 'light'}`
            const x = render(subject, kind, style, heavy)
            let peak = 0
            let sq = 0
            let sum = 0
            let finite = true
            for (const v of x) {
              if (!Number.isFinite(v)) finite = false
              peak = Math.max(peak, Math.abs(v))
              sq += v * v
              sum += v
            }
            const ms = (x.length / SR) * 1000
            const rmsDb = 10 * Math.log10(sq / x.length)
            expect(finite, label).toBe(true)
            expect(peak, label).toBeLessThanOrEqual(0.99)
            // Non-silent: well above the dither floor of any real playback.
            expect(peak, label).toBeGreaterThan(0.2)
            expect(rmsDb, label).toBeGreaterThan(-45)
            // No DC, and no click at either edge.
            expect(Math.abs(sum / x.length), label).toBeLessThan(2e-3)
            expect(Math.abs(x[0]!), label).toBeLessThan(1e-3)
            expect(Math.abs(x[x.length - 1]!), label).toBeLessThan(1e-3)
            // Length budgets: a crush that runs long is memory and mud.
            expect(ms, label).toBeGreaterThan(20)
            const max = isBossSubject(subject) ? 1200 : kind === 'crush' ? 800 : 450
            expect(ms, label).toBeLessThanOrEqual(max)
          }
        }
      }
    }
  })

  it('keeps the whole bestiary plus a boss inside the decoded-memory budget', () => {
    // Measured, not estimated: every slot the runtime would render for all ten
    // bugs, the heaviest boss and its pods, in the longest style.
    let worst = 0
    for (const style of JUICE_STYLES) {
      let bytes = 0
      for (const slot of crushPlan([...BUG_IDS, 'roachPrime', 'pod', 'hatch'])) {
        bytes += render(slot.subject, slot.kind, style, slot.heavy, slot.variant).length * 4
      }
      worst = Math.max(worst, bytes)
    }
    expect(worst).toBeLessThan(CRUSH_BUDGET_BYTES)
  })
})

describe('crushPlan', () => {
  it('puts one everyday crush per cast member first', () => {
    const cast: CrushSubject[] = ['ant', 'beetle', 'robobug']
    const plan = crushPlan(cast)
    const head = plan.slice(0, cast.length)
    expect(head.map((s) => s.subject)).toEqual(cast)
    for (const s of head) {
      expect(s.kind).toBe('crush')
      expect(s.heavy).toBe(false)
      expect(s.variant).toBe(0)
    }
  })

  it('plans every variant of every slot exactly once', () => {
    const plan = crushPlan(['beetle', 'queenAnt', 'pod'])
    const keys = plan.map((s) => `${crushSlotKey(s.subject, s.kind, s.heavy)}#${s.variant}`)
    expect(new Set(keys).size).toBe(keys.length)
    const beetleCrushHeavy = plan.filter((s) => s.subject === 'beetle' && s.kind === 'crush' && s.heavy)
    expect(beetleCrushHeavy.length).toBe(crushVariants('beetle', 'crush', true))
    expect(plan.filter((s) => s.subject === 'pod').length).toBe(crushVariants('pod', 'crush', false))
  })
})

describe('every crush sounds different — the design promise', () => {
  /** Mean feature distance from one render to a set, skipping itself. */
  const meanTo = (x: AudioFeatures, set: readonly AudioFeatures[]): number => {
    const others = set.filter((y) => y !== x)
    return others.reduce((a, y) => a + featureDistance(x, y), 0) / others.length
  }

  it('every variant of every bug is identifiable as that bug, in every style and weight', () => {
    // A pairwise "distance > threshold" check is vacuous here: two variants of
    // ONE bug differ by as much as two quiet bugs do. The real promise is that a
    // bug has an identity its variants share — so each variant must sit closer
    // to its own siblings than to any other bug's set (leave-one-out nearest
    // class). Routing two bugs through one recipe fails this at once.
    for (const style of JUICE_STYLES) {
      for (const heavy of [false, true]) {
        const n = crushVariants('ant', 'crush', heavy)
        const sets = new Map(BUG_IDS.map((id) => [
          id, Array.from({ length: n }, (_, v) => audioFeatures(render(id, 'crush', style, heavy, v), SR))
        ]))
        for (const [id, own] of sets) {
          for (const [v, x] of own.entries()) {
            const self = meanTo(x, own)
            for (const [other, set] of sets) {
              if (other === id) continue
              expect(meanTo(x, set), `${style}/${heavy ? 'H' : 'L'}: ${id}#${v} is closer to ${other}`).toBeGreaterThan(self)
            }
          }
        }
      }
    }
  })

  it('a style changes the sound of the same body by more than its variants do', () => {
    for (const id of BUG_IDS) {
      const by = Object.fromEntries(JUICE_STYLES.map((style) => [
        style, [0, 1, 2, 3].map((v) => audioFeatures(render(id, 'crush', style, false, v), SR))
      ])) as Record<JuiceStyleId, AudioFeatures[]>
      const spread = Math.max(...JUICE_STYLES.map((s) => by[s].reduce((a, x) => a + meanTo(x, by[s]), 0) / 4))
      for (const [a, b] of [['ooze', 'confetti'], ['ooze', 'bubble'], ['confetti', 'bubble']] as const) {
        const across = by[a].reduce((acc, x) => acc + meanTo(x, by[b]), 0) / 4
        expect(across, `${id} ${a}~${b}`).toBeGreaterThan(spread)
      }
    }
  })

  it('the beetle cracks: its wound is broadband noise, the ant is not', () => {
    // A crack is a crackle of grains — flat across 1–8 kHz. Goo is bubbles and
    // formants — peaky. If the beetle's shell ever stops sounding like a shell,
    // this is where it shows.
    const beetleHurt = flatness(render('beetle', 'hurt', 'ooze'))
    const beetleSlam = flatness(render('beetle', 'crush', 'ooze', true))
    const ant = flatness(render('ant', 'crush', 'ooze'))
    expect(beetleHurt).toBeGreaterThan(0.3)
    expect(beetleHurt).toBeGreaterThan(ant * 1.8)
    expect(beetleSlam).toBeGreaterThan(ant * 1.4)
  })

  it('a wound is the crush without the release: shorter, and without the goo tail', () => {
    for (const id of ['beetle', 'robobug'] as const) {
      const hurt = audioFeatures(render(id, 'hurt', 'ooze'), SR)
      const crush = audioFeatures(render(id, 'crush', 'ooze'), SR)
      expect(crush.durationMs, id).toBeGreaterThan(hurt.durationMs * 1.5)
      expect(crush.envCentroidMs, id).toBeGreaterThan(hurt.envCentroidMs)
    }
  })

  it('the charged slam on the beetle is the biggest bug crush in the game', () => {
    const slam = render('beetle', 'crush', 'ooze', true)
    const slamF = audioFeatures(slam, SR)
    for (const id of BUG_IDS) {
      if (id === 'beetle') continue
      const light = audioFeatures(render(id, 'crush', 'ooze'), SR)
      expect(slamF.phoneDb, id).toBeGreaterThan(light.phoneDb)
    }
    // Designed +3 dB over the tap-kill; the limiter shaves a little off the
    // slam's transient, so the floor asserted is "clearly bigger", not exact.
    expect(slamF.phoneDb).toBeGreaterThan(audioFeatures(render('beetle', 'crush', 'ooze'), SR).phoneDb + 2.5)
  })

  // The two egg cues are a REWARD and a CONSEQUENCE, and a player has to tell
  // them apart with their eyes on the other side of the board: the pop is a
  // shell and then goo, the hatch is pecks, a split and little feet getting away.
  it('a hatch is its own sound, not the pop played again', () => {
    for (const style of JUICE_STYLES) {
      const pops = [0, 1, 2].map((v) => audioFeatures(render('pod', 'crush', style, false, v), SR))
      const hatches = [0, 1].map((v) => audioFeatures(render('hatch', 'crush', style, false, v), SR))
      const within = featureDistance(pops[0]!, pops[1]!)
      for (const h of hatches) {
        for (const p of pops) expect(featureDistance(h, p), style).toBeGreaterThan(within)
      }
    }
  })

  it('a hatch sits under the pop in the mix — heard, never louder than the stomp that prevents it', () => {
    for (const style of JUICE_STYLES) {
      const pop = audioFeatures(render('pod', 'crush', style), SR)
      const hatch = audioFeatures(render('hatch', 'crush', style), SR)
      expect(hatch.phoneDb, style).toBeLessThan(pop.phoneDb)
    }
  })

  it('bubble style is soap: tonal everywhere, no crunch', () => {
    for (const subject of CRUSH_SUBJECTS) {
      for (const kind of crushKindsFor(subject)) {
        const f = flatness(render(subject, kind, 'bubble'))
        expect(f, `${subject}/${kind}`).toBeLessThan(0.25)
      }
    }
  })
})
