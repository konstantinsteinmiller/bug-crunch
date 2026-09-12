import { describe, expect, it } from 'vitest'
import {
  WALKS, STILLS, MONSTER_WALKS, HERO_WALKS, WALK_FRAMES, WALK_COLS, WALK_ROWS,
  promptForWalk, promptForStill, catalogueDrift, BACKGROUND_RULE, GATE_POST, GATE_REF_POST_W,
  framesOf, colsOf, rowsOf, sheetW, sheetH
} from '@/game/artSheet'
import { ART_CATALOGUE } from '@/game/artCatalogue'
import { ART_FOLDERS } from '@/game/art'
import { MONSTERS } from '@/game/monsters'
import { OUTFITS, HERO_FRAME_ASPECT } from '@/game/heroSprites'
import { MONSTER_FRAME_ASPECT } from '@/game/monsterSprites'
import {
  GATE_FRAME, RIDGE_BAND, ROLLER_ART_PAD, FX_PAD, ROCKET_BOX,
  ROLLER_BANDS_ON_FACE, ROLLER_BANDS_AROUND, ROLLER_ROLL_HZ, ROLLER_SPIN_PER_LOOP
} from '@/use/useSurvivalArt'
import { ROLLER_R, ROLLER_SPEED } from '@/game/threats'
import { BANNER, UI_ICON_IDS } from '@/game/uiArt'

/**
 * The art manifest is a contract between three parties that never meet: the
 * bench that draws the reference, the slicer that cuts the return, and the
 * renderer that blits the result. These pin the parts a diff would not catch.
 */

describe('the manifest covers the cast', () => {
  it('paints a walk cycle for every design and every outfit, and nothing else', () => {
    expect(MONSTER_WALKS.map((w) => w.id).sort()).toEqual(MONSTERS.map((m) => m.id).sort())
    expect(HERO_WALKS.map((w) => w.id).sort()).toEqual(OUTFITS.map((o) => o.id).sort())
  })

  it('paints every still the runtime probes, and probes every still it paints', () => {
    expect(catalogueDrift()).toEqual({ unpainted: [], unprobed: [] })
  })

  it('never sends two returns to one file', () => {
    const targets = [
      ...WALKS.map((w) => w.target),
      ...STILLS.map((s) => s.target),
      ...STILLS.flatMap((s) => (s.extra ?? []).map((e) => e.target))
    ]
    expect(new Set(targets).size).toBe(targets.length)
    const files = [...WALKS.map((w) => w.file), ...STILLS.map((s) => s.file)]
    expect(new Set(files).size).toBe(files.length)
  })

  it('lands every probed still under its kind\'s own folder', () => {
    for (const s of STILLS) {
      if (s.id === 'logo') continue
      expect(s.target).toBe(`${ART_FOLDERS[s.kind]}/${s.id}.webp`)
    }
    for (const w of WALKS) expect(w.target).toBe(`${ART_FOLDERS[w.kind]}/${w.id}.webp`)
  })

  it('keeps the catalogue keyed by real art kinds', () => {
    for (const kind of Object.keys(ART_CATALOGUE)) expect(ART_FOLDERS).toHaveProperty(kind)
  })
})

describe('the sheets are cut blindly, so their shapes are exact', () => {
  it('lays every walk out on a grid of the bake\'s own frame box, at a ratio tools offer', () => {
    for (const w of WALKS) {
      expect(w.cols).toBe(WALK_COLS)
      expect(w.rows).toBe(WALK_ROWS)
      expect(w.frames).toBe(WALK_FRAMES)
      expect(w.w).toBe(w.cols * w.panelW)
      expect(w.h).toBe(w.rows * w.panelH)
      // 16:9 for the taller monster frame, 2:1 for the square survivor frame.
      expect(w.w * 9 === w.h * 16 || w.w === w.h * 2, `${w.id} ${w.w}x${w.h}`).toBe(true)
      expect(w.maxEdge).toBeGreaterThanOrEqual(w.panelH / 4)
      // The panel IS the frame box scaled up, to within the strip counter's slack.
      const frameAspect = w.kind === 'monster' ? MONSTER_FRAME_ASPECT : HERO_FRAME_ASPECT
      expect(Math.abs(w.panelW / w.panelH - frameAspect) / frameAspect).toBeLessThan(0.01)
      expect(promptForWalk(w)).toContain(w.w * 9 === w.h * 16 ? '(16:9, landscape)' : '(2:1, landscape)')
    }
  })

  it('gives every still whole pixels and a cap no bigger than its reference', () => {
    for (const s of STILLS) {
      expect(Number.isInteger(s.w) && Number.isInteger(s.h)).toBe(true)
      expect(s.maxEdge).toBeLessThanOrEqual(s.h)
      expect(s.maxEdge).toBeGreaterThan(0)
    }
  })

  it('marks the logo exact, because the PWA manifest reads that file at 512', () => {
    // The slicer writes every frame at most 256 px tall by default; the one
    // file something outside the game reads at a fixed size opts out by name.
    const logo = STILLS.find((s) => s.id === 'logo')!
    expect(logo.exact).toBe(true)
    expect(logo.maxEdge).toBe(512)
    expect(logo.target).toContain('512x512')
    for (const s of STILLS) if (s.id !== 'logo') expect(s.exact, s.id).toBeUndefined()
  })

  it('draws the gate frames at the renderer\'s own nine-slice geometry', () => {
    for (const s of STILLS.filter((x) => x.kind === 'gate')) {
      expect(s.w).toBe(GATE_FRAME.w)
      expect(s.h).toBe(GATE_FRAME.h)
    }
    // The cap has to contain the whole post band with room to spare, the band
    // has to sit inside the panel, and a post at the band's width must still
    // hide under a divider pillar where two leaves share an edge.
    expect(GATE_POST.outer).toBeGreaterThan(0)
    expect(GATE_POST.inner).toBeLessThan(GATE_POST.cut)
    expect(GATE_POST.cut * 2).toBeLessThan(1)
    expect(GATE_POST.width).toBeCloseTo(GATE_REF_POST_W * GATE_FRAME.ppu / GATE_FRAME.w, 9)
    expect(GATE_REF_POST_W - 0.09).toBeLessThanOrEqual(0.25)
    expect(GATE_POST.bottom).toBeGreaterThan(0.5)
    expect(GATE_POST.bottom).toBeLessThan(1)
    // 21:9 — a ratio the image tools actually offer.
    expect(GATE_FRAME.w * 9).toBe(GATE_FRAME.h * 21)
  })

  it('leaves the roller and the glowing effects the margin their paintings reach into', () => {
    // A spiked ball needs air for its spikes and a ring for its glow; the
    // blit is padded by the same factor, so the shape lands where it did.
    expect(ROLLER_ART_PAD).toBeGreaterThan(1.2)
    expect(FX_PAD).toBeGreaterThan(1.05)
    expect(promptForStill(STILLS.find((s) => s.id === 'roller')!)).toContain('12% to 88%')
    expect(promptForStill(STILLS.find((s) => s.id === 'ring-heat')!)).toContain('89% of the frame')
  })

  it('draws the ridge bands at the renderer\'s own band shape', () => {
    for (const s of STILLS.filter((x) => x.id.startsWith('ridge-'))) {
      expect(s.w / s.h).toBeCloseTo(RIDGE_BAND.w / RIDGE_BAND.h, 6)
      expect(s.bg).toBe('magenta-sky')
      expect(s.tile).toBe('x')
    }
  })

  it('never fits a glow-only effect onto a solid-pixel box', () => {
    // A drawn flash is a third solid and two thirds glow; a painting fitted
    // onto that box shrinks to a third. These are placed by the prompt instead.
    // The roller joins them for a different reason: its painting carries
    // spikes the drawing does not, and a fit would shrink the sphere to make
    // room for them. The prompt places the sphere by measured fractions.
    // The gates join them too: the slicer re-composes a gate onto its post
    // band, and a fit on top of that shrank the frame and slid the posts into
    // the doorway.
    // The rocket is a shell on a plume of light; the plume is most of it.
    for (const id of ['muzzle', 'smoke', 'scorch', 'tracer', 'bolt-gunner', 'bolt-boss', 'meteor', 'bomb', 'roller',
      'frame-add', 'frame-sub', 'frame-mul', 'frame-div', 'rocket']) {
      expect(STILLS.find((s) => s.id === id)?.fit, id).toBe(false)
    }
    // …and the solid things ARE fitted, because that is what registers them —
    // the banner among them, since a painted end piece has to land under the
    // CSS cut, and the fit is what puts it there.
    for (const id of ['crate-damage', 'pillar', 'coin', 'grenade', 'crown', 'ring-heat',
      'ribbon', ...UI_ICON_IDS]) {
      expect(STILLS.find((s) => s.id === id)?.fit, id).toBeUndefined()
    }
  })

  it('draws the banner and the rocket at ratios the image tools offer, from the runtime\'s own boxes', () => {
    const banner = STILLS.find((s) => s.id === 'ribbon')!
    expect(banner.w).toBe(BANNER.w)
    expect(banner.h).toBe(BANNER.h)
    expect(banner.w * 9).toBe(banner.h * 21)
    // The prompt states the end piece as the fraction CSS cuts at.
    expect(promptForStill(banner)).toContain(`${Math.round(BANNER.cap * 100)}%`)
    expect(promptForStill(banner)).toContain('STRETCHES THE MIDDLE')
    const rocket = STILLS.find((s) => s.id === 'rocket')!
    expect(rocket.w * 16).toBe(rocket.h * 9)
    expect(rocket.w / rocket.h).toBeCloseTo(ROCKET_BOX.w / ROCKET_BOX.h, 9)
    expect(promptForStill(rocket)).toContain('portrait, 9:16')
    expect(promptForStill(rocket)).toContain('pointing UP')
  })

  it('paints an icon for the chest and both skills, and probes each', () => {
    for (const id of ['chest', 'skill-grenade', 'skill-shield']) {
      const s = STILLS.find((x) => x.id === id)
      expect(s?.kind, id).toBe('ui')
      expect(ART_CATALOGUE.ui).toContain(id)
      expect(promptForStill(s!)).toContain('24 px')
    }
  })

  it('marks the barricade tile opaque and seamless, and paints no road tile at all', () => {
    const wall = STILLS.find((s) => s.id === 'barricade')!
    expect(wall.bg).toBe('opaque')
    expect(wall.tile).toBe('x')
    // A painted road was tried and read as objects under the crowd.
    expect(STILLS.find((s) => s.id === 'lane')).toBeUndefined()
    expect(ART_CATALOGUE.bg).not.toContain('lane')
  })

  it('states the gate posts as the fractions of the frame the reference draws them at', () => {
    const add = STILLS.find((s) => s.id === 'frame-add')!
    const p = promptForStill(add)
    expect(p).toContain('THE POSTS — measure them against the FRAME')
    expect(p).toContain(`${Math.round(GATE_POST.width * 100)}% of the frame wide`)
    expect(p).toContain(`${Math.round(GATE_POST.doorway * 100)}% of the width`)
    expect(p).toContain('Exactly TWO posts')
    expect(p).toContain('squeezed thinner by the slicer')
    expect(p).toContain('BEFORE YOU CALL IT FINISHED')
    expect(p).toContain('landscape, 21:9')
  })
})

describe('the prompts carry the clauses that decide whether a return is usable', () => {
  it('walk prompts state the shape first, the count as a number, and the ground last', () => {
    for (const w of WALKS) {
      const p = promptForWalk(w)
      expect(p.indexOf('SPRITE SHEET')).toBeLessThan(p.indexOf('STYLE'))
      expect(p).toContain(`EXACTLY ${w.frames} panels`)
      expect(p).toContain(`${w.w} x ${w.h} pixels`)
      expect(p).toContain('#FF00FF')
      expect(p).toContain(w.blurb)
      expect(p.indexOf('ONE CHARACTER')).toBeLessThan(p.indexOf('STYLE'))
      // The survivors are the one thing seen from behind.
      if (w.kind === 'hero') expect(p).toContain('seen from behind')
    }
  })

  it('still prompts name the exact pixels and the right ground', () => {
    for (const s of STILLS) {
      const p = promptForStill(s)
      // The SHEET's pixels, which for an animated still is its whole grid and
      // not one panel. Asking for a panel-sized canvas and eight panels inside
      // it is the contradiction that comes back as one squashed frame.
      expect(p, s.id).toContain(`${sheetW(s)} x ${sheetH(s)} pixels`)
      expect(p).toContain(s.blurb)
      if (s.bg === 'opaque') expect(p).toContain('FULLY OPAQUE')
      else if (s.bg === 'magenta-sky') expect(p).toContain('ABOVE the ridge line')
      else expect(p).toContain(BACKGROUND_RULE)
      if (s.tile === 'x') expect(p).toContain('TILEABLE, HORIZONTALLY')
      if (s.tile === 'xy') expect(p).toContain('TILEABLE ON BOTH AXES')
      // A cycle sheet is ASKED for motion, so "draw it at rest" would
      // contradict its own `WHAT MOVES` clause; the orientation survives.
      if (s.authored) {
        expect(p, s.id).toContain(framesOf(s) > 1 ? 'ORIENTATION, in every panel' : 'DRAW IT AT REST')
      }
      if (s.live) expect(p).toContain('LEAVE OUT WHAT THE GAME PAINTS LIVE')
      if (s.greyscale) expect(p).toContain('GREYSCALE ONLY')
    }
  })

  it('asks an animated still for a LOOP, and counts its panels', () => {
    // A projectile is a solid object inside an effect, and only the effect may
    // move: the head of a round is what the game measures its kill against, so
    // a head that wanders between panels is a hitbox that lies. Every clause
    // below is the difference between a return that can be sliced and one that
    // has to be re-rolled.
    const cycles = STILLS.filter((s) => framesOf(s) > 1)
    // The five the player called lifeless — every projectile a boss or an
    // elite puts on the road.
    expect(cycles.map((s) => s.id).sort())
      .toEqual(['bolt-boss', 'bolt-gunner', 'bomb', 'meteor', 'roller'])

    for (const s of cycles) {
      const p = promptForStill(s)
      expect(colsOf(s) * rowsOf(s), s.id).toBe(framesOf(s))
      expect(p, s.id).toContain('READ THE PANELS')
      expect(p, s.id).toContain(`${colsOf(s)} columns x ${rowsOf(s)} rows = EXACTLY ${framesOf(s)} panels`)
      // The two clauses a strip is unusable without: every panel repainted,
      // and the last one leading back into the first.
      expect(p, s.id).toContain('Repaint EVERY panel')
      expect(p, s.id).toContain('IT MUST LOOP')
      // …and the one that keeps the hitbox honest.
      expect(p, s.id).toContain('WHAT MOVES:')
      expect(p, s.id).toContain('keeps the same size, the same colours and the same place')
      expect(s.cycle, `${s.id} has no WHAT MOVES copy`).toBeTruthy()
      // The subject is stated before the panels are, per the prompt anatomy.
      expect(p.indexOf('WHAT IT IS'), s.id).toBeLessThan(p.indexOf('READ THE PANELS'))
    }
  })

  it('scripts a mechanical cycle panel by panel, and names the row trap', () => {
    // The failure this is here to stop, twice observed: handed a 4x2 grid, a
    // painter returns ONE arrangement across the top row and a second across
    // the bottom — two states, not eight steps, which plays as a thing that
    // snaps between two poses. The cure is the one the survivor's stride
    // already needed (`HERO_PANELS`): name every panel.
    for (const s of STILLS.filter((x) => framesOf(x) > 1)) {
      const p = promptForStill(s)
      expect(p, s.id).toContain('ROWS ARE NOT')
      expect(p, s.id).toContain('are DIFFERENT from each other')
      expect(p, s.id).toContain('not one moment repeated across the row')
      if (!s.panels) continue
      // A scripted cycle names each frame, with the count matching the grid.
      expect(s.panels, s.id).toHaveLength(framesOf(s))
      expect(p, s.id).toContain('PANEL BY PANEL')
      for (let i = 0; i < framesOf(s); i++) {
        expect(p, `${s.id} panel ${i + 1}`).toContain(`· panel ${i + 1}:`)
      }
      // Measured against panel 1, not against the neighbour — an error that
      // accumulates leaves the loop unable to close.
      expect(p, s.id).toContain('measure each one against panel 1')
    }
  })

  it('derives the roller\'s roll rate and its band count from the same picture', () => {
    // Got this wrong once, in a way no test would have caught: the four bands
    // were counted as four around the WHOLE ball rather than four across its
    // face, which halved the roll rate and would have shipped a ball whose
    // surface travelled at half the speed of the ground — a skid.
    //
    // The face is half the ball, so bands around it are twice what is on it.
    expect(ROLLER_BANDS_AROUND).toBe(ROLLER_BANDS_ON_FACE * 2)
    // One loop is one band gap of surface travel, and the surface travels at
    // the ball's own speed: revolutions a second, times bands around.
    const revsPerSecond = ROLLER_SPEED / (2 * Math.PI * ROLLER_R)
    expect(ROLLER_ROLL_HZ).toBeCloseTo(revsPerSecond * ROLLER_BANDS_AROUND, 9)
    // …and at eight frames that has to land somewhere a painted strip can be
    // read as motion rather than as steps.
    const fps = ROLLER_ROLL_HZ * 8
    expect(fps, `${fps.toFixed(1)} fps`).toBeGreaterThan(10)
    expect(fps, `${fps.toFixed(1)} fps`).toBeLessThan(30)
    // The drawn bands step exactly one gap per loop, so the drawing and a
    // painted strip cover the same ground per frame — the whole point of
    // driving both from one cycle.
    expect(ROLLER_SPIN_PER_LOOP).toBeCloseTo(2 / ROLLER_BANDS_ON_FACE, 9)
  })

  it('leaves every other still a one-panel sheet', () => {
    // The grid is opt-in. A still that quietly gained panels would be exported
    // as a strip, sliced into slivers and blitted as a flicker.
    for (const s of STILLS.filter((x) => framesOf(x) === 1)) {
      expect(colsOf(s), s.id).toBe(1)
      expect(rowsOf(s), s.id).toBe(1)
      expect(sheetW(s), s.id).toBe(s.w)
      expect(sheetH(s), s.id).toBe(s.h)
      expect(promptForStill(s), s.id).not.toContain('READ THE PANELS')
    }
  })

  it('scripts the survivor\'s stride panel by panel, and only the survivor\'s', () => {
    // The painter held one pose for two panels and jumped to the next, three
    // returns running; the reference of the time invited it. Now every panel
    // is named, the flight moments included, and the legs are told to stay
    // under the hips.
    for (const w of HERO_WALKS) {
      const p = promptForWalk(w)
      expect(p).toContain('READ THE PANELS')
      expect(p).toContain('· panel 1:')
      expect(p).toContain('· panel 8:')
      expect(p).toContain('FLIGHT')
      expect(p).toContain('never splay')
      expect(p).toContain('DIRECTLY BEHIND')
      expect(p.indexOf('READ THE PANELS')).toBeLessThan(p.indexOf('WHAT IT IS'))
    }
    for (const w of MONSTER_WALKS) expect(promptForWalk(w)).not.toContain('READ THE PANELS')
  })

  it('locks the dark register and forbids the cozy one it replaces', () => {
    const p = promptForWalk(WALKS[0]!)
    expect(p).toContain('dark fantasy')
    expect(p).toContain('NO cute, cozy, storybook')
    expect(p).not.toMatch(/cozy hand-drawn/)
    expect(p).toContain('UPPER LEFT')
  })

  it('never asks a painter for magenta on the object', () => {
    // The multiplier gate's game tint is magenta-pink — the one place a naive
    // colour clause would hand the painter the chroma key itself.
    const mul = STILLS.find((s) => s.id === 'frame-mul')!
    expect(promptForStill(mul)).toContain('never magenta')
  })
})

// ─── Boss deaths ────────────────────────────────────────────────────────────
//
// The one sheet that is not a loop: eight panels from the kill to the body,
// played once and held. What these pin is the contract with the two other
// parties — the slicer (a grid it can cut blindly, an id no walk answers to)
// and the renderer (the walk's scale and feet line, the probe path it asks for
// at 80 % of the road) — and the three things the prompt exists to prevent.
describe('boss deaths', () => {
  it('paints one for every body a boss can wear, under images/deaths/', async () => {
    const { bossDesigns } = await import('@/game/foes')
    const { BOSS_DEATHS } = await import('@/game/artSheet')
    expect(BOSS_DEATHS.map((d) => d.design).sort()).toEqual([...bossDesigns()].sort())
    for (const d of BOSS_DEATHS) {
      expect(d.target).toBe(`${ART_FOLDERS.death}/${d.design}.webp`)
      // Its own id: the walk of the same design answers to the bare one, and
      // the slicer keys sheets by id.
      expect(d.id).toBe(`death-${d.design}`)
      expect(WALKS.some((w) => w.id === d.id || w.file === d.file)).toBe(false)
    }
  })

  it('is a 4 x 2 grid at 21:9, on the walk panel\'s height and the runtime\'s aspect', async () => {
    const { BOSS_DEATHS, DEATH_POSES, MONSTER_PANEL_H } = await import('@/game/artSheet')
    const { DEATH_FRAME_ASPECT } = await import('@/game/monsterSprites')
    expect(DEATH_POSES.upright).toHaveLength(8)
    expect(DEATH_POSES.side).toHaveLength(8)
    for (const d of BOSS_DEATHS) {
      expect([d.cols, d.rows, d.frames]).toEqual([4, 2, 8])
      expect(d.w).toBe(d.cols * d.panelW)
      expect(d.h).toBe(d.rows * d.panelH)
      expect(d.w * 9).toBe(d.h * 21)
      // Same height as the walk panel: the creature is the same size to the
      // pixel, so the cut at the kill cannot pop.
      expect(d.panelH).toBe(MONSTER_PANEL_H)
      // …and the shape the renderer slices the strip by.
      expect(d.panelW / d.panelH).toBeCloseTo(DEATH_FRAME_ASPECT, 2)
    }
  })

  it('goes onto its back upright and onto its flank side-on, and lands to the LEFT on screen', async () => {
    const { BOSS_DEATHS, DEATH_POSES } = await import('@/game/artSheet')
    // The last panel is the body the game keeps: it must say how it lies, with
    // the limbs spread — a body at attention reads as a standing one turned over.
    expect(DEATH_POSES.upright[7]).toMatch(/on its back, spread out/)
    expect(DEATH_POSES.side[7]).toMatch(/on its flank with its legs stretched out/)
    // …and that it lies the way panel 7 left it: one return flipped the body
    // end for end between the two, so the held corpse snapped round.
    for (const last of [DEATH_POSES.upright[7], DEATH_POSES.side[7]]) {
      expect(last).toMatch(/same place as panel 7/)
      expect(last).toMatch(/NOT turned round/)
    }
    for (const d of BOSS_DEATHS) {
      // A side-on body collapses along the ground; tipping it a quarter turn
      // stood it on its rump in the first layout.
      expect(d.stance).toBe(d.faces === 'front' ? 'upright' : 'side')
      expect(d.fall).toBe(d.faces === 'left' ? 1 : -1)
      // The field mirrors a left-facer; the strip is never mirrored again.
      const mirror = d.faces === 'left' ? -1 : 1
      expect(d.fall * mirror).toBe(-1)
    }
  })

  it('asks for a real fall, the painted creature, and nothing a child should not see', async () => {
    const { BOSS_DEATHS, promptForDeath } = await import('@/game/artSheet')
    for (const d of BOSS_DEATHS) {
      const p = promptForDeath(d)
      expect(p).toContain(`${d.file}.png`)
      // The CHARACTER is attached, not described: one frame of the creature's
      // walk as the game shows it. A death painted from words alone came back
      // as a different creature, and the swap at the kill is then a costume
      // change. `tools/art-models.mjs` writes it at the same path.
      expect(d.model).toBe(`models/${d.design}.png`)
      // The character first, the layout second and for poses only.
      expect(p).toContain(`IMAGE 1 — \`${d.model}\` — THE CHARACTER`)
      expect(p).toContain(`IMAGE 2 — \`${d.file}.png\` — THE ANIMATION`)
      expect(p.indexOf('IMAGE 1')).toBeLessThan(p.indexOf('IMAGE 2'))
      expect(p).toMatch(/PROPORTIONS/)
      // The layout is the drawn fall now (monsterKit's "Dying"), not a plank
      // tipped over, so the painter follows it rather than being warned off it.
      expect(p).toContain('FOLLOW ITS POSES')
      expect(p).not.toContain('DO NOT COPY')
      expect(p).toMatch(/NO blood/)
      expect(p).toMatch(/NO puddle/)
      expect(p).toContain('EXACTLY 8 panels')
      expect(p).toContain(`${d.w} x ${d.h}`)
      expect(p).toContain(BACKGROUND_RULE)
      // Every panel named, in order.
      for (let i = 1; i <= 8; i++) expect(p).toContain(`· panel ${i}:`)
    }
  })

  it('says who each boss is in words, and hands it no gear its walk does not hold', async () => {
    const { BOSS_DEATHS, DEATH_IDENTITY, DEATH_POSES, promptForDeath } = await import('@/game/artSheet')
    // The panel lines are shared by every boss, so they name no gear at all:
    // "anything it was holding flies out" got a sword and shield painted in.
    // And no ALL-CAPS headings — those came back as captions in the panels.
    for (const line of [...DEATH_POSES.upright, ...DEATH_POSES.side]) {
      expect(line).not.toMatch(/weapon|sword|shield|holding|club|mace/i)
      expect(line.slice(0, 12)).toBe(line.slice(0, 12).toLowerCase())
    }
    for (const d of BOSS_DEATHS) {
      const who = DEATH_IDENTITY[d.design]
      expect(who, `${d.design} needs a DEATH_IDENTITY line`).toBeDefined()
      const p = promptForDeath(d)
      expect(p).toContain(who!.looks)
      if (who!.holds) {
        expect(p).toContain(who!.holds)
        expect(p).toMatch(/flies loose at the blow/)
      } else {
        expect(p).toMatch(/carries NOTHING/)
        expect(p).not.toMatch(/flies loose/)
      }
      // Nothing that reads as a caption to paint, and no panel edges.
      expect(p).toMatch(/NO panel borders/)
      expect(p).toMatch(/Never write them, or any other words, in the image/)
    }
  })
})
