// ─── Which music plays when ─────────────────────────────────────────────────
//
// The rules, pure and total, so "which track plays on 3-7 for a player who
// picked trance?" is a test and not a play-through. The player (`useSound.ts`)
// owns the element and the transitions; everything it decides about WHICH file
// comes from here. The pieces themselves are composed as data in
// `tools/music/` (see `sound-todo.md` → Music).
//
// ─── The beds (one media element, one at a time) ────────────────────────────
//
//   parade  Crunch Parade — the theme, and the default
//   trance  the arcade drive
//   cozy    the picnic blanket
//   attic   Attic Tiptoe — world 3
//   boss    Big Bug Stomp — every boss level
//
// The first three are the Settings choices. The last two are never chosen:
// they are routed. The rule, in the order it is applied:
//
//   1. A PARTY plays the player's own track. It is a celebration on whatever
//      world it follows, and the sandwich-thief ants did not come for a ghost
//      story.
//   2. A BOSS level plays `boss`, whatever the Settings say. The fight is a set
//      piece, scored like a cutscene; one loop serves all four bosses (they are
//      told apart by their tells, not their music).
//   3. WORLD 3 plays `attic` IN PLACE OF `parade` or `cozy`, and keeps `trance`.
//      `parade` is the default and `cozy` is what every save from an earlier
//      build was seeded with — neither can be told from a deliberate pick (see
//      `DEFAULT_MUSIC_TRACK` in `useUser.ts`), and both are exactly the
//      daylight, picnic-blanket reading the attic is not. `trance` has never
//      been a default or a seed, so a player holding it chose it, and a choice
//      is kept. The attic bed is Crunch Parade's own hook re-told in the dark,
//      so a parade player still hears their theme.
//   4. Everywhere else, the player's track.
//
// ─── The cues (on the shared AudioContext, over or instead of the bed) ──────
//
//   fever-stinger  exactly FEVER_MS; the bed pauses under it and comes back in
//                  its last beat's hole (`FEVER_BED_RETURN_MS`)
//   result-sting   3 s on a CLEARED result screen, never on top of the
//                  level-clear sample (`resultStingDelayMs`)

import { FEVER_MS } from '@/game/combo'
import { isBossLevel, worldOf, TOTAL_LEVELS } from '@/game/stages'

/** The Settings choices. Mirrors `MusicTrack` in `useUser.ts` (a test holds the
 *  two lists together) without importing that module's boot-time side effects. */
export type PlayerTrack = 'parade' | 'trance' | 'cozy'
export type BedId = PlayerTrack | 'attic' | 'boss'

export const PLAYER_TRACKS: readonly PlayerTrack[] = ['parade', 'trance', 'cozy']

export const isPlayerTrack = (v: unknown): v is PlayerTrack =>
  typeof v === 'string' && (PLAYER_TRACKS as readonly string[]).includes(v)

/** Every bed → its file under `public/audio/music/`. */
export const BED_FILES: Readonly<Record<BedId, string>> = {
  parade: 'crunch-parade.ogg',
  trance: 'trance.ogg',
  cozy: 'bg-cozy.ogg',
  attic: 'attic-tiptoe.ogg',
  boss: 'boss-stomp.ogg'
}

export const FEVER_STINGER_FILE = 'fever-stinger.ogg'
export const RESULT_STING_FILE = 'result-sting.ogg'

/** The world whose bed is `attic`. */
export const ATTIC_WORLD = 3
/** The choices the attic bed stands in for there — see rule 3 above. */
export const ATTIC_STANDS_IN_FOR: readonly PlayerTrack[] = ['parade', 'cozy']

/** Where the music is being asked for. `level: null` is "not in a level" (the
 *  player before any level has started, and every test that never sets one):
 *  the player's own track. */
export interface MusicScene {
  level: number | null
  party?: boolean
}

export const NO_SCENE: MusicScene = { level: null }

/**
 * The bed for `scene`, given the Settings `choice`. A choice this build does
 * not ship (an older save's id) falls back to `fallback`.
 */
export const routeBed = (choice: unknown, scene: MusicScene, fallback: PlayerTrack = 'parade'): BedId => {
  const own: PlayerTrack = isPlayerTrack(choice) ? choice : fallback
  if (scene.level === null || !Number.isFinite(scene.level) || scene.party) return own
  if (isBossLevel(scene.level)) return 'boss'
  if (worldOf(scene.level) === ATTIC_WORLD && ATTIC_STANDS_IN_FOR.includes(own)) return 'attic'
  return own
}

export const routeBedFile = (choice: unknown, scene: MusicScene, fallback: PlayerTrack = 'parade'): string =>
  BED_FILES[routeBed(choice, scene, fallback)]

/**
 * The file worth fetching ahead for the level AFTER `level`, or null.
 *
 * Only the two routed beds are ever warmed, and only when the next level will
 * actually play one and this level does not: that is "loaded when it could be
 * needed" — 1-3 warms the Queen's fight, 2-10 warms the attic, and a player on
 * trance crossing into world 3 warms nothing. The Settings tracks are fetched on
 * demand the way they always were.
 */
export const bedFileToWarm = (choice: unknown, level: number, fallback: PlayerTrack = 'parade'): string | null => {
  if (!Number.isFinite(level) || level >= TOTAL_LEVELS) return null
  const next = routeBed(choice, { level: level + 1 }, fallback)
  if (next !== 'attic' && next !== 'boss') return null
  if (routeBed(choice, { level }, fallback) === next) return null
  return BED_FILES[next]
}

// ─── The fever stinger ──────────────────────────────────────────────────────

/** Its length — the file is rendered to exactly this many ms. */
export const FEVER_STINGER_MS = FEVER_MS
/** Its tempo (`tools/music/scores/fever-stinger.mjs`). */
export const FEVER_STINGER_BPM = 144
/**
 * When the paused bed comes back, ms into the stinger: the start of its last
 * beat, the HOLE after the three final stomps. The bed fades in under the
 * stinger's ring-out instead of after a gap.
 */
export const FEVER_BED_RETURN_MS = Math.round(FEVER_STINGER_MS - 60_000 / FEVER_STINGER_BPM)
/** How fast a stinger cut short (the level ended, the laces ran out) fades. */
export const FEVER_STINGER_CUT_MS = 250

// ─── The result sting ───────────────────────────────────────────────────────

/** Its length. */
export const RESULT_STING_MS = 3000

/**
 * How long the level-end sample needs before anything else may sting, ms.
 *
 * A win fires `levelClear` (`celebration-1`, 1.34 s, B major) — and on a boss,
 * `bossDie`'s `celebration-3` (1.35 s) in the same frame — and the result screen
 * opens after the win beat's hold (`winBeatPlan`, at least 2.4 s now, when no ad
 * and no gift screen stand between). The sting is in G major: started on top of
 * the tail it would be two stings in two keys at once. So it waits for the tail,
 * plus 60 ms of air.
 *
 * That hold is comfortably longer than this, which means the direct path now
 * returns 0 as well. Kept anyway, and deliberately: this is a fact about the
 * SAMPLE, not about whatever the screen in front of it happens to hold for, and
 * the next person to shorten a celebration should not have to rediscover that
 * two stings in two keys is what they are trading against.
 */
export const LEVEL_END_STING_MS = 1400

/**
 * How long to hold the result sting after the result screen opens at
 * `openedAt`, given the level-end sample fired at `levelEndAt` (both on the same
 * clock, ms). Zero whenever an ad or the gift screen already put the tail far
 * behind; up to half a second on the direct path.
 */
export const resultStingDelayMs = (openedAt: number, levelEndAt: number | null): number => {
  if (levelEndAt === null || !Number.isFinite(levelEndAt) || !Number.isFinite(openedAt)) return 0
  return Math.max(0, Math.round(levelEndAt + LEVEL_END_STING_MS - openedAt))
}
