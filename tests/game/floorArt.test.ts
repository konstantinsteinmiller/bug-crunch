import { existsSync } from 'node:fs'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ART_CATALOGUE, LEVEL_FLOOR_ART_IDS, floorArtIdFor } from '@/game/artCatalogue'
import {
  FLOORS, FLOOR_IDS, FLOOR_PALETTE, FLOOR_SUBJECT, isLeadFloor, worldOfFloor, type FloorId
} from '@/game/floors'
import { WORLDS } from '@/game/stages'

/**
 * ─── The floor paintings ship in step with the list that asks for them ──────
 *
 * Thirty-six of the forty floors are a level's own surface, and they arrive one
 * painting at a time. Two lists have to agree about which of them have landed:
 * `LEVEL_FLOOR_ART_IDS` (what the game probes and preloads) and
 * `public/images/bg/` (what is actually there).
 *
 * They fail in opposite directions and both are silent:
 *
 *   AN ID WITH NO FILE   `spriteFor` requests it the first time that level is
 *                        drawn and gets a 404. Free for the renderer — the
 *                        floor draws itself — and NOT free on a portal:
 *                        CrazyGames' QA console reports every 404 as a broken
 *                        build, which is a rejection for a file nobody missed.
 *   A FILE WITH NO ID    `floorArtIdFor` returns null, so the painting is never
 *                        probed and never drawn. The tile ships in the archive,
 *                        costs its bytes on every download, and is invisible.
 *
 * Neither shows up in play, which is why this is a test and not a convention.
 * `pnpm art:floors --ids` prints the array to paste.
 */

const BG_DIR = join(process.cwd(), 'public', 'images', 'bg')

/** The level-floor paintings actually on disk, by floor id. */
const paintedOnDisk = (): FloorId[] => {
  if (!existsSync(BG_DIR)) return []
  const files = new Set(readdirSync(BG_DIR))
  return FLOOR_IDS.filter((id) => !isLeadFloor(id) && files.has(`${id}.webp`))
}

describe('the level-floor ship manifest', () => {
  it('names only floors whose painting is on disk', () => {
    const onDisk = new Set(paintedOnDisk())
    const missing = LEVEL_FLOOR_ART_IDS.filter((id) => !onDisk.has(id))
    expect(missing, `listed but not painted — these 404 in play: ${missing.join(', ')}`)
      .toEqual([])
  })

  it('names every level-floor painting that is on disk', () => {
    const listed = new Set<string>(LEVEL_FLOOR_ART_IDS)
    const orphans = paintedOnDisk().filter((id) => !listed.has(id))
    expect(orphans, `painted but never probed — dead weight in the build: ${orphans.join(', ')}`)
      .toEqual([])
  })

  it('puts every listed floor in the catalogue the preloader reads', () => {
    for (const id of LEVEL_FLOOR_ART_IDS) expect(ART_CATALOGUE.bg).toContain(id)
    // …and the four leads never left it.
    for (const w of [1, 2, 3, 4]) expect(ART_CATALOGUE.bg).toContain(`floor-${w}`)
  })

  it('never lists a lead floor, which ships under the world id instead', () => {
    for (const id of LEVEL_FLOOR_ART_IDS) expect(isLeadFloor(id)).toBe(false)
  })
})

describe('floorArtIdFor is the one rule the renderer and the preloader share', () => {
  it('sends a world lead to the id it has always shipped under', () => {
    for (const w of [1, 2, 3, 4] as const) {
      const lead = FLOORS[w][0]!
      expect(floorArtIdFor(lead)).toBe(`floor-${w}`)
    }
  })

  it('sends a painted level floor to its own id', () => {
    for (const id of LEVEL_FLOOR_ART_IDS) expect(floorArtIdFor(id)).toBe(id)
  })

  it('returns null for a level floor with no painting, so nothing is requested', () => {
    const listed = new Set<string>(LEVEL_FLOOR_ART_IDS)
    const unpainted = FLOOR_IDS.filter((id) => !isLeadFloor(id) && !listed.has(id))
    // While the batch is arriving this is most of them; once it has all landed
    // it is none. Either way the rule is the same and the assertion is not
    // vacuous — it is skipped only when there is genuinely nothing unpainted.
    for (const id of unpainted) expect(floorArtIdFor(id)).toBeNull()
    expect(unpainted.length + LEVEL_FLOOR_ART_IDS.length).toBe(FLOOR_IDS.length - 4)
  })
})

describe('every floor can be handed to a painter', () => {
  it('says what it is, in a phrase that carries no colour of its own', () => {
    // The colours come from `FLOOR_PALETTE`, which is what the legibility test
    // judges; a subject that names a colour is a subject that can contradict
    // it. Checked against the words a painter would actually act on rather
    // than against every string that happens to be a colour name.
    const COLOUR_WORDS = [
      'red', 'green', 'blue', 'yellow', 'orange', 'purple', 'pink', 'brown',
      'black', 'white', 'grey', 'gray', 'cyan', 'magenta', 'navy', 'beige',
      'cream', 'golden', 'silver'
    ]
    for (const id of FLOOR_IDS) {
      const subject = FLOOR_SUBJECT[id]
      expect(subject, `${id} has no subject`).toBeTruthy()
      expect(subject.length, `${id}'s subject is too thin to paint from`).toBeGreaterThan(12)
      for (const w of COLOUR_WORDS) {
        expect(
          new RegExp(`\\b${w}\\b`, 'i').test(subject),
          `${id}'s subject names the colour "${w}" — that belongs in FLOOR_PALETTE`
        ).toBe(false)
      }
    }
  })

  it('covers all forty, and names its own world', () => {
    expect(Object.keys(FLOOR_SUBJECT).sort()).toEqual([...FLOOR_IDS].sort())
    for (const id of FLOOR_IDS) {
      expect(FLOOR_PALETTE[id]).toBeDefined()
      expect(WORLDS[worldOfFloor(id)]).toBeDefined()
    }
  })
})
