/**
 * ─── One cue, from recipe to shippable takes ────────────────────────────────
 *
 * `renderCue` is the whole per-cue half of `build-sfx.mjs`, pure and importable
 * (the tests call it): render every take from its seed, add the room, master
 * it, loudness-match the takes to each other on the cue's own meter, scale the
 * cue so its loudest true peak sits at the ceiling (with at most `limitDb` of
 * look-ahead limiting), and compute the runtime gain that puts it at its target
 * in the mix.
 */
import { hashString, makeBus, reverb } from './dsp.mjs'
import { room } from './instruments.mjs'
import { limitHard, master, masterLoop } from './master.mjs'
import { phone400Db, phoneLoudnessDb, truePeak } from './loudness.mjs'

export const RENDER_SR = 44100
/** File ceiling, dBTP — the "about −3 dBFS" of sound-todo.md's format rules,
 *  which leaves the Vorbis encoder its overshoot. */
export const CEILING_DB = -3.0

export const metricOf = (x, sr, metric) => (metric === 'ph400' ? phone400Db(x, sr) : phoneLoudnessDb(x, sr))

const scaled = (x, g) => Float32Array.from(x, (v) => v * g)

/** Render one take, mastered but not yet levelled. */
export const renderTake = (id, c, i, sr = RENDER_SR) => {
  const seed = hashString(`${id}:${i}`)
  if (c.loop) {
    // Three periods, the middle one kept: every filter and resonator has
    // settled, and (with periodic sources) the period is exactly periodic.
    // Even at 44.1 kHz so it halves exactly to 22.05.
    const P = Math.round((c.dur * sr) / 2) * 2
    const b = makeBus((3 * P) / sr, sr, seed)
    c.render(b, i, { L: P / sr })
    return masterLoop(b.out.slice(P, 2 * P), sr, c)
  }
  const b = makeBus(c.dur, sr, seed)
  c.render(b, i, { L: c.dur })
  let x = b.out
  if (c.post) c.post(x, sr)
  if (c.room) x = reverb(x, room(sr, c.room[0]), c.room[1], { sr, sendHp: c.room[2] ?? 150 })
  return master(x, sr, c)
}

export const renderCue = (id, c, sr = RENDER_SR) => {
  const takes = Array.from({ length: c.slots }, (_, i) => renderTake(id, c, i, sr))
  const slotDb = (i) => (c.slotDb ? c.slotDb(i) : 0)
  const lv = takes.map((x) => metricOf(x, sr, c.metric))
  const matched = takes.map((x, i) => scaled(x, Math.pow(10, (slotDb(i) - lv[i]) / 20)))
  const limitDb = c.limitDb ?? 1.5
  const ceiling = Math.pow(10, CEILING_DB / 20)
  const maxTp = Math.max(...matched.map((x) => truePeak(x)))
  const s = (ceiling * Math.pow(10, limitDb / 20)) / maxTp
  const final = matched.map((x) => limitHard(scaled(x, s), sr, ceiling, { circular: !!c.loop }))
  const fileLevel = final.reduce((a, x, i) => a + metricOf(x, sr, c.metric) - slotDb(i), 0) / final.length
  const gain = Math.pow(10, (c.target - fileLevel) / 20)
  return { id, c, takes: final, gain, fileLevel }
}
