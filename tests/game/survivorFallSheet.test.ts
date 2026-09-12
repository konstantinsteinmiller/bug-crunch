// ─── The squad's fall sheet ─────────────────────────────────────────────────
//
// The same contract the boss deaths keep, one size down, with three parties
// that never meet: the tool that renders the reference
// (`tools/export-falls.mjs`), the slicer that cuts the return, and the renderer
// that blits it. What is pinned here is everything a diff would not catch — the
// panel box the painting has to land in, the grid the cut assumes, the clauses
// the prompt exists for, and the index entry that a plain `pnpm art:export`
// silently drops.

import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  BOSS_DEATHS, FALL_COLS, FALL_FRAMES, FALL_PANEL, FALL_ROWS, HERO_PANEL_H,
  STILLS, SURVIVOR_FALLS, WALKS, promptForFall
} from '@/game/artSheet'
import { ART_FOLDERS } from '@/game/art'
import { DOWN_ART_ID, DOWN_POSES, HERO_FRAME_ASPECT, OUTFITS } from '@/game/heroSprites'

const sheets = () => SURVIVOR_FALLS
const index = (): { walks?: Array<Record<string, unknown>> } =>
  JSON.parse(readFileSync(resolve(__dirname, '../../art-sheets/sheet-index.json'), 'utf-8'))

describe('the sheet is cut blindly, so its shape is exact', () => {
  it('is the hero walk panel, square, at a ratio an image tool actually offers', () => {
    for (const f of sheets()) {
      // The panel IS the runtime's blit box. A painting cut from any other box
      // lands with its ground line somewhere the feet never were.
      expect(f.panelW).toBe(HERO_PANEL_H)
      expect(f.panelH).toBe(HERO_PANEL_H)
      expect(f.panelW / f.panelH).toBeCloseTo(HERO_FRAME_ASPECT, 6)
      expect(f.panelW).toBe(FALL_PANEL)
      expect(f.w).toBe(f.cols * f.panelW)
      expect(f.h).toBe(f.rows * f.panelH)
      // 3:2 — asked for in the prompt, and one of the handful of ratios the
      // free image tools emit. A 3-panel strip would have been 3:1 and come
      // back squeezed into whatever the tool could do.
      expect(f.w * 2).toBe(f.h * 3)
      expect(promptForFall(f)).toContain('(3:2, landscape)')
    }
  })

  it('covers every outfit and every held pose exactly once', () => {
    expect(FALL_COLS).toBe(OUTFITS.length)
    expect(FALL_ROWS).toBe(DOWN_POSES.length)
    expect(FALL_FRAMES).toBe(FALL_COLS * FALL_ROWS)
    for (const f of sheets()) {
      expect(f.frames).toBe(FALL_FRAMES)
      expect(f.cols * f.rows).toBe(f.frames)
      expect(f.poses).toEqual(DOWN_POSES)
    }
  })

  it('lands under the squad\'s own folder and collides with nothing', () => {
    const targets = [...WALKS.map((w) => w.target), ...STILLS.map((s) => s.target),
      ...BOSS_DEATHS.map((d) => d.target), ...sheets().map((f) => f.target)]
    const files = [...WALKS.map((w) => w.file), ...STILLS.map((s) => s.file),
      ...BOSS_DEATHS.map((d) => d.file), ...sheets().map((f) => f.file)]
    expect(new Set(targets).size).toBe(targets.length)
    expect(new Set(files).size).toBe(files.length)
    for (const f of sheets()) {
      expect(f.target).toBe(`${ART_FOLDERS[f.kind]}/${f.id}.webp`)
      expect(f.id).toBe(DOWN_ART_ID)
      // It rides in the hero folder but it is NOT a walk: a walk sheet is a
      // cycle of one outfit, and every invariant over `WALKS` is about that.
      expect(WALKS.some((w) => w.id === f.id || w.file === f.file)).toBe(false)
    }
  })

  it('has a character model, attached first', () => {
    for (const f of sheets()) {
      expect(f.model).toBe('models/survivors.png')
      expect(existsSync(resolve(__dirname, '../../art-sheets', f.model)),
        `${f.model} — run pnpm art:models`).toBe(true)
      // Named in the prompt as image 1, because the words decide which of the
      // two attachments is the subject: the boss deaths came back as other
      // creatures entirely until the model went first.
      const p = promptForFall(f)
      expect(p.indexOf('IMAGE 1')).toBeLessThan(p.indexOf('IMAGE 2'))
      expect(p).toContain(f.model)
      expect(p).toContain(`${f.file}.png`)
    }
  })
})

describe('the prompt carries the clauses the return depends on', () => {
  it('states the shape first, the count as a number, and the ground last', () => {
    for (const f of sheets()) {
      const p = promptForFall(f)
      expect(p.indexOf('A SPRITE SHEET')).toBeLessThan(p.indexOf('THE LOOK'))
      expect(p).toContain(`EXACTLY ${f.frames} panels`)
      expect(p).toContain(`Not 1, not ${f.cols}`)
      expect(p).toContain('#FF00FF')
      expect(p.lastIndexOf('#FF00FF')).toBeGreaterThan(p.indexOf('LAYOUT'))
      expect(p).toContain('OUTPUT: one image, 960 x 640 pixels')
    }
  })

  it('forbids the one pose this character cannot be drawn in', () => {
    // The survivor is a BACK view and has no face anywhere in the game. A body
    // rolled face up is not a bad painting of the character, it is a painting
    // of a character that does not exist.
    for (const f of sheets()) {
      const p = promptForFall(f)
      expect(p).toContain('NO FACE')
      expect(p).toContain('Face DOWN')
      expect(p).toContain('Not one of them is face up')
    }
  })

  it('keeps it a children\'s game', () => {
    for (const f of sheets()) {
      const p = promptForFall(f)
      expect(p).toContain('FOR CHILDREN')
      expect(p).toContain('NO blood, gore, wounds')
      expect(p).toContain('NO puddle, pool, splash')
      // Defeat is the pose. Nothing in this prompt may ask for an injury.
      expect(p).not.toMatch(/\b(wounded|bleeding|injur\w+|corpse)\b/i)
    }
  })

  it('names each column by its outfit, so three coats cannot swap places', () => {
    for (const f of sheets()) {
      const p = promptForFall(f)
      for (let i = 0; i < OUTFITS.length; i++) {
        expect(p).toContain(`column ${i + 1}`)
        expect(p).toContain(OUTFITS[i]!.id)
      }
      for (let r = 0; r < f.rows; r++) {
        expect(p).toContain(`ROW ${r + 1}, panels ${r * f.cols + 1}-${r * f.cols + f.cols}`)
      }
    }
  })
})

describe('the sheet is in the pipeline, not beside it', () => {
  it('has an index entry the slicer can cut, matching the manifest', () => {
    // The trap this pins: a full `pnpm art:export` rewrites sheet-index.json
    // from the bench's own walk of the manifest, which has no painter for this
    // sheet — so it drops the entry and the next `pnpm slice-sheets` quietly
    // stops cutting the fall. The fix is one command; the failure is silent.
    const entry = (index().walks ?? []).find((w) => w.falls)
    expect(entry, 'no fall sheet in sheet-index.json — run node tools/export-falls.mjs').toBeDefined()
    const f = sheets()[0]!
    expect(entry!.id).toBe(f.id)
    expect(entry!.file).toBe(`${f.file}.png`)
    expect(entry!.kind).toBe(f.kind)
    expect(entry!.cols).toBe(f.cols)
    expect(entry!.rows).toBe(f.rows)
    expect(entry!.frames).toBe(f.frames)
    expect(entry!.target).toBe(f.target)
    expect(entry!.panel).toEqual({ w: f.panelW, h: f.panelH })
    expect(entry!.anchor).toBe('feet')
    expect(entry!.maxEdge).toBe(f.maxEdge)
    // Measured, or the slicer has nothing to normalise a return onto and a
    // painting that came back half again as big stays that size in play.
    expect(entry!.fit, 're-run node tools/export-falls.mjs').toBeTruthy()
  })

  it('has its reference on disk, at the size the prompt asks for', () => {
    const f = sheets()[0]!
    const ref = resolve(__dirname, '../../art-sheets', `${f.file}.png`)
    expect(existsSync(ref), `${f.file}.png — run node tools/export-falls.mjs`).toBe(true)
    // The PNG header carries its own size; no decoder needed.
    const head = readFileSync(ref).subarray(16, 24)
    expect(head.readUInt32BE(0)).toBe(f.w)
    expect(head.readUInt32BE(4)).toBe(f.h)
  })
})
