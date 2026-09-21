// Which music plays when — and whether the files the rules name are the files
// that ship.
//
// The routing is a design contract (see `src/game/musicRouting.ts` for the
// rule and its reasons): a boss level plays the boss loop, world 3 plays the
// attic in place of the default and the seeded `cozy` but keeps a deliberate
// `trance`, a party plays the player's own track. These tests walk the whole
// campaign for every Settings choice rather than spot-checking three levels, so
// moving a boss or adding a world cannot quietly change what a child hears.
//
// The asset half reads the shipped Ogg files' own headers: the fever stinger
// must be EXACTLY `FEVER_MS` long (a stinger a few hundred ms short leaves a
// hole before the bed returns; a long one plays over the next fever's start),
// and the beds must be the 60-90 s loops the brief asked for.

import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import {
  ATTIC_STANDS_IN_FOR, ATTIC_WORLD, BED_FILES, FEVER_BED_RETURN_MS, FEVER_STINGER_BPM, FEVER_STINGER_FILE,
  FEVER_STINGER_MS, LEVEL_END_STING_MS, NO_SCENE, PLAYER_TRACKS, RESULT_STING_FILE, RESULT_STING_MS,
  bedFileToWarm, isPlayerTrack, resultStingDelayMs, routeBed, routeBedFile
} from '@/game/musicRouting'
import { BOSS_FIGHTS, PARTY_AFTER, TOTAL_LEVELS, isBossLevel, worldOf } from '@/game/stages'
import { FEVER_MS } from '@/game/combo'
import { DEFAULT_MUSIC_TRACK, MUSIC_TRACK_FILES } from '@/use/useUser'

const MUSIC_DIR = resolve(__dirname, '../../public/audio/music')
const levels = Array.from({ length: TOTAL_LEVELS }, (_, i) => i + 1)

describe('routeBed — which bed a level plays', () => {
  it('every boss level plays the boss loop, whatever the Settings say', () => {
    const bossLevels = Object.keys(BOSS_FIGHTS).map(Number)
    expect(bossLevels.length).toBeGreaterThanOrEqual(4) // one per world, at least
    for (const level of bossLevels) {
      for (const choice of PLAYER_TRACKS) expect(routeBed(choice, { level })).toBe('boss')
    }
  })

  it('world 3 plays the attic in place of parade and cozy, and keeps trance', () => {
    const attic = levels.filter((l) => worldOf(l) === ATTIC_WORLD && !isBossLevel(l))
    expect(attic).toHaveLength(9) // 3-1 … 3-9; 3-10 is the Matriarch
    for (const level of attic) {
      expect(routeBed('parade', { level })).toBe('attic')
      expect(routeBed('cozy', { level })).toBe('attic')
      expect(routeBed('trance', { level })).toBe('trance')
    }
    expect([...ATTIC_STANDS_IN_FOR].sort()).toEqual(['cozy', 'parade'])
  })

  it('every other level plays the player\'s own track', () => {
    const plain = levels.filter((l) => worldOf(l) !== ATTIC_WORLD && !isBossLevel(l))
    for (const level of plain) {
      for (const choice of PLAYER_TRACKS) expect(routeBed(choice, { level })).toBe(choice)
    }
  })

  it('the whole campaign, one table: nothing else ever plays the routed beds', () => {
    for (const choice of PLAYER_TRACKS) {
      for (const level of levels) {
        const bed = routeBed(choice, { level })
        const expected = isBossLevel(level)
          ? 'boss'
          : worldOf(level) === ATTIC_WORLD && choice !== 'trance' ? 'attic' : choice
        expect(bed, `${choice} on level ${level}`).toBe(expected)
      }
    }
  })

  it('a Bug Party plays the player\'s own track on every world, the attic\'s too', () => {
    for (const after of PARTY_AFTER) {
      for (const choice of PLAYER_TRACKS) expect(routeBed(choice, { level: after, party: true })).toBe(choice)
    }
    // The party after 3-6 is IN world 3, and still a party.
    expect(PARTY_AFTER.some((l) => worldOf(l) === ATTIC_WORLD)).toBe(true)
  })

  it('outside a level it is always the player\'s own track', () => {
    for (const choice of PLAYER_TRACKS) expect(routeBed(choice, NO_SCENE)).toBe(choice)
  })

  it('a track id this build does not ship falls back to the default — and is still routed', () => {
    for (const junk of ['epic', '', undefined, null, 42]) {
      expect(isPlayerTrack(junk)).toBe(false)
      expect(routeBed(junk, NO_SCENE, DEFAULT_MUSIC_TRACK)).toBe(DEFAULT_MUSIC_TRACK)
      expect(routeBed(junk, { level: 23 }, DEFAULT_MUSIC_TRACK)).toBe('attic')
      expect(routeBed(junk, { level: 40 }, DEFAULT_MUSIC_TRACK)).toBe('boss')
    }
  })

  it('routeBedFile resolves through the same rule to a file name', () => {
    expect(routeBedFile('parade', { level: 1 })).toBe('crunch-parade.ogg')
    expect(routeBedFile('parade', { level: 21 })).toBe('attic-tiptoe.ogg')
    expect(routeBedFile('trance', { level: 21 })).toBe('trance.ogg')
    expect(routeBedFile('cozy', { level: 20 })).toBe('boss-stomp.ogg')
  })
})

describe('the Settings list and the bed table agree', () => {
  it('the three choices are exactly the tracks Settings offers, on the same files', () => {
    expect([...PLAYER_TRACKS].sort()).toEqual(Object.keys(MUSIC_TRACK_FILES).sort())
    for (const t of PLAYER_TRACKS) expect(BED_FILES[t]).toBe(MUSIC_TRACK_FILES[t as keyof typeof MUSIC_TRACK_FILES])
    expect(isPlayerTrack(DEFAULT_MUSIC_TRACK)).toBe(true)
  })
})

describe('bedFileToWarm — the routed beds load only when they could be needed', () => {
  it('warms the boss loop on the level before each fight, and nothing on the fight', () => {
    for (const fight of Object.keys(BOSS_FIGHTS).map(Number)) {
      expect(bedFileToWarm('parade', fight - 1), `before ${fight}`).toBe(BED_FILES.boss)
    }
    expect(bedFileToWarm('parade', 4)).toBeNull() // 1-5 is plain parade again
  })

  it('warms the attic from 2-10, and only for the tracks it stands in for', () => {
    expect(bedFileToWarm('parade', 20)).toBe(BED_FILES.attic)
    expect(bedFileToWarm('cozy', 20)).toBe(BED_FILES.attic)
    expect(bedFileToWarm('trance', 20)).toBeNull()
    // Already in the attic: the next attic level needs nothing new.
    expect(bedFileToWarm('parade', 21)).toBeNull()
  })

  it('never warms a Settings track, and nothing past the last level', () => {
    for (const choice of PLAYER_TRACKS) {
      for (const level of levels) {
        const f = bedFileToWarm(choice, level)
        if (f !== null) expect([BED_FILES.attic, BED_FILES.boss]).toContain(f)
      }
    }
    expect(bedFileToWarm('parade', TOTAL_LEVELS)).toBeNull()
  })
})

describe('resultStingDelayMs — never two stings at once', () => {
  it('waits out the level-end sample on the direct path (no ad, no gift screen)', () => {
    // The result screen opens CELEBRATE_MS (900 ms) after the level-end sample.
    expect(resultStingDelayMs(10_900, 10_000)).toBe(LEVEL_END_STING_MS - 900)
  })

  it('plays at once when an ad or the gift screen already put the sample behind it', () => {
    expect(resultStingDelayMs(20_000, 10_000)).toBe(0)
    expect(resultStingDelayMs(10_000 + LEVEL_END_STING_MS, 10_000)).toBe(0)
  })

  it('is total: no level-end on record, or garbage clocks, mean no wait', () => {
    expect(resultStingDelayMs(5, null)).toBe(0)
    expect(resultStingDelayMs(Number.NaN, 0)).toBe(0)
    expect(resultStingDelayMs(0, Number.NaN)).toBe(0)
  })

  it('outlasts the 1.34 s level-clear sample and the 1.35 s boss-down sample', () => {
    expect(LEVEL_END_STING_MS).toBeGreaterThanOrEqual(1350)
  })
})

describe('the fever stinger timing', () => {
  it('is exactly one Fever long', () => {
    expect(FEVER_STINGER_MS).toBe(FEVER_MS)
  })

  it('brings the bed back in the stinger\'s last beat, not after it', () => {
    const beatMs = 60_000 / FEVER_STINGER_BPM
    expect(FEVER_BED_RETURN_MS).toBeGreaterThan(FEVER_STINGER_MS - beatMs - 1)
    expect(FEVER_BED_RETURN_MS).toBeLessThan(FEVER_STINGER_MS)
  })

  it('the score is written to exactly that length at that tempo', async () => {
    // A plain .mjs score from the music tools (no types), by file URL.
    const url = pathToFileURL(resolve(__dirname, '../../tools/music/scores/fever-stinger.mjs')).href
    const score = await import(/* @vite-ignore */ url)
    const bars = score.SECTIONS.reduce((n: number, s: { chords: unknown[] }) => n + s.chords.length, 0)
    expect(score.TEMPO).toBe(FEVER_STINGER_BPM)
    expect(Math.round(bars * 4 * (60_000 / score.TEMPO))).toBe(FEVER_MS)
    expect(score.RENDER.loop.lengthSec * 1000).toBe(FEVER_MS)
  })
})

// ─── The shipped files ──────────────────────────────────────────────────────

/** Channels, rate and length of an Ogg Vorbis file, from its own pages: the
 *  identification header on the first page and the granule position (the
 *  sample count) on the last. */
const readOgg = (file: string): { channels: number; rate: number; samples: number } => {
  const b = readFileSync(file)
  expect(b.subarray(0, 4).toString('latin1')).toBe('OggS')
  const ident = b.indexOf(Buffer.from([0x01, 0x76, 0x6f, 0x72, 0x62, 0x69, 0x73])) // \x01vorbis
  expect(ident).toBeGreaterThan(0)
  const channels = b.readUInt8(ident + 11)
  const rate = b.readUInt32LE(ident + 12)
  const last = b.lastIndexOf(Buffer.from('OggS', 'latin1'))
  const samples = Number(b.readBigInt64LE(last + 6))
  return { channels, rate, samples }
}

describe('the shipped music files', () => {
  it('every bed and cue the rules name exists', () => {
    for (const f of [...Object.values(BED_FILES), FEVER_STINGER_FILE, RESULT_STING_FILE]) {
      expect(existsSync(resolve(MUSIC_DIR, f)), f).toBe(true)
    }
  })

  it('the fever stinger decodes to exactly FEVER_MS', () => {
    const { rate, samples } = readOgg(resolve(MUSIC_DIR, FEVER_STINGER_FILE))
    expect((samples / rate) * 1000).toBe(FEVER_MS)
  })

  it('the result sting is its advertised three seconds', () => {
    const { rate, samples } = readOgg(resolve(MUSIC_DIR, RESULT_STING_FILE))
    expect((samples / rate) * 1000).toBe(RESULT_STING_MS)
  })

  it('the boss loop and the attic are 60-90 s loops', () => {
    for (const f of [BED_FILES.boss, BED_FILES.attic]) {
      const { rate, samples } = readOgg(resolve(MUSIC_DIR, f))
      const sec = samples / rate
      expect(sec, f).toBeGreaterThanOrEqual(60)
      expect(sec, f).toBeLessThanOrEqual(90)
    }
  })

  it('the new pieces match the parade\'s format and stay inside its bitrate', () => {
    const parade = readOgg(resolve(MUSIC_DIR, BED_FILES.parade))
    const paradeKbps = (statSync(resolve(MUSIC_DIR, BED_FILES.parade)).size * 8) / (parade.samples / parade.rate) / 1000
    for (const f of [BED_FILES.boss, BED_FILES.attic, FEVER_STINGER_FILE, RESULT_STING_FILE]) {
      const o = readOgg(resolve(MUSIC_DIR, f))
      expect(o.rate, f).toBe(parade.rate)
      expect(o.channels, f).toBe(parade.channels)
      const kbps = (statSync(resolve(MUSIC_DIR, f)).size * 8) / (o.samples / o.rate) / 1000
      // Same encoder and quality; a denser or sparser mix moves VBR a little.
      expect(kbps, f).toBeLessThan(paradeKbps * 1.25)
    }
  })

  it('a player track in Settings is never one of the routed beds', () => {
    const settings = new Set<string>(Object.values(MUSIC_TRACK_FILES))
    for (const routed of [BED_FILES.attic, BED_FILES.boss] as string[]) expect(settings.has(routed)).toBe(false)
    expect((PLAYER_TRACKS as readonly string[]).includes('attic')).toBe(false)
    expect((PLAYER_TRACKS as readonly string[]).includes('boss')).toBe(false)
  })
})
