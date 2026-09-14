import { getState, setState } from '@/use/useBugCrunchState'
import { flushSaveNow } from '@/use/useSaveStatus'
import {
  ANON_NAME_KEY, PLAYER_ID_KEY, PLAYER_NAME_KEY, SDK_NAME_KEY
} from '@/keys'

/**
 * ─── Who the leaderboard row belongs to ─────────────────────────────────────
 *
 * Two questions, answered independently because they fail differently:
 *
 *   WHO   — a stable id. Gets it wrong and the player collects duplicate rows,
 *           which is unfixable from the client and looks like the board eating
 *           their progress.
 *   WHAT  — a display name. Gets it wrong and a row is mislabelled, which is
 *           annoying and self-correcting.
 *
 * Neither ever prompts. A leaderboard that opens a text field before the player
 * has played is a leaderboard most players never appear on.
 */

export interface PlayerIdentity {
  id: string
  name: string
  source: 'sdk' | 'save' | 'device' | 'fresh'
}

/**
 * The id's own localStorage key, deliberately OUTSIDE the `bc_`-prefixed save
 * blob.
 *
 * That prefix is exactly what the cloud save layer allowlists and mirrors, so a
 * hydrate from an older cloud blob can hand the game a save with no id in it —
 * and the game would mint a second one, and the player would have two rows.
 * This copy exists to be the one thing a cloud round-trip cannot overwrite.
 */
const DEVICE_UID_KEY = 'bug-crunch_uid'
const DEVICE_NAME_KEY = 'bug-crunch_name'

/** The shape the worker validates against. Keep the two in step. */
const ID_RE = /^[a-zA-Z0-9_-]{8,64}$/
const NAME_MAX = 16

/**
 * Strip what would let a name break the table or fake a rank: C0/C1 controls,
 * zero-width characters, bidi overrides, the BOM. No profanity filter — that is
 * a moderation policy, not a parser, and it belongs on the server if anywhere.
 */
export const cleanName = (raw: unknown): string => {
  if (typeof raw !== 'string') return ''
  // The class members are written as \u ESCAPES, and must stay that way.
  // They used to be the literal characters, which reads fine in an editor and
  // survives every normal build -- and then breaks the single-file builds
  // outright. `vite-plugin-singlefile` inlines the bundle into a <script> in
  // index.html, and HTML tokenisation replaces a literal U+0000 with U+FFFD
  // (WHATWG 13.2.5). The class then starts `[\ufffd-\u001f`, which is a range
  // out of order: the regex throws at PARSE time, so the whole bundle fails to
  // evaluate and the game never leaves the splash at 0%. It cost a GamePix
  // release pass to find, because the dev server and the multi-file builds
  // keep the byte intact and are completely unaffected.
  // eslint-disable-next-line no-control-regex
  return raw.replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\ufeff]/g, '')
    .trim()
    .slice(0, NAME_MAX)
}

const readLocal = (key: string): string => {
  try { return localStorage.getItem(key) ?? '' } catch { return '' }
}
const writeLocal = (key: string, value: string): void => {
  try { localStorage.setItem(key, value) } catch { /* private mode, quota */ }
}

/** Uniform below `max`, without the modulo bias a naive `% max` introduces. */
const randomBelow = (max: number): number => {
  const limit = Math.floor(0xffffffff / max) * max
  const buf = new Uint32Array(1)
  for (let i = 0; i < 20; i++) {
    crypto.getRandomValues(buf)
    if (buf[0]! < limit) return buf[0]! % max
  }
  return buf[0]! % max
}

const mintId = (): string => {
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Every word is ≤ 9 characters, so `word + six digits` can never be truncated
 * by `NAME_MAX` — a name that got cut would collide with every other cut name.
 */
const ANON_WORDS = [
  'Survivor', 'Runner', 'Scout', 'Nomad', 'Drifter',
  'Ranger', 'Wanderer', 'Strider', 'Trekker', 'Roamer'
] as const

const mintName = (): string => {
  const word = ANON_WORDS[randomBelow(ANON_WORDS.length)]!
  return `${word}${100000 + randomBelow(900000)}`
}

/**
 * The player's stable id, resolved once and written back everywhere.
 *
 * Save blob first, then the standalone device key, then a fresh mint. There is
 * no platform-SDK tier: the portals this game ships to either expose no stable
 * player id at all or expose one that changes between anonymous sessions, and a
 * "stable" id that is not is worse than an anonymous one that is.
 */
const resolveId = (): { id: string; source: PlayerIdentity['source'] } => {
  const saved = getState<string>(PLAYER_ID_KEY, '')
  if (ID_RE.test(saved)) return { id: saved, source: 'save' }

  const device = readLocal(DEVICE_UID_KEY)
  if (ID_RE.test(device)) return { id: device, source: 'device' }

  return { id: mintId(), source: 'fresh' }
}

/**
 * The display name, in strict precedence. Never collapse these into one slot:
 * whichever wrote first would then own the name forever.
 *
 *   1. chosen by the player
 *   2. handed over by a platform SDK, REMEMBERED — so an offline session does
 *      not flip the row back to a generated name
 *   3. generated once, and kept
 */
const resolveName = (sdkName: string | null): string => {
  const chosen = cleanName(getState<string>(PLAYER_NAME_KEY, ''))
  if (chosen) return chosen

  const fresh = cleanName(sdkName)
  if (fresh) {
    if (getState<string>(SDK_NAME_KEY, '') !== fresh) setState(SDK_NAME_KEY, fresh)
    return fresh
  }
  const remembered = cleanName(getState<string>(SDK_NAME_KEY, ''))
  if (remembered) return remembered

  const anon = cleanName(getState<string>(ANON_NAME_KEY, '')) || cleanName(readLocal(DEVICE_NAME_KEY))
  if (anon) return anon

  return mintName()
}

/**
 * Resolve both, persist anything that was missing, and flush.
 *
 * The flush is synchronous on purpose: the save layer debounces by 200 ms, and
 * a reload inside that window would mint a second identity — which is the one
 * failure mode that cannot be repaired later.
 */
export const resolveIdentity = async (): Promise<PlayerIdentity> => {
  const { id, source } = resolveId()

  // The CG SDK is the only platform here that offers a name, and it is loaded
  // lazily so a non-CG build never pays for the import.
  let sdkName: string | null = null
  try {
    const cg = await import('@/use/useCrazyGames')
    sdkName = cg.crazyPlayerName.value
  } catch { /* not a CrazyGames build */ }

  const name = resolveName(sdkName)

  let dirty = false
  if (getState<string>(PLAYER_ID_KEY, '') !== id) { setState(PLAYER_ID_KEY, id); dirty = true }
  if (readLocal(DEVICE_UID_KEY) !== id) writeLocal(DEVICE_UID_KEY, id)
  if (!cleanName(getState<string>(PLAYER_NAME_KEY, '')) && !cleanName(sdkName)) {
    if (getState<string>(ANON_NAME_KEY, '') !== name) { setState(ANON_NAME_KEY, name); dirty = true }
    if (readLocal(DEVICE_NAME_KEY) !== name) writeLocal(DEVICE_NAME_KEY, name)
  }
  if (dirty) void flushSaveNow()

  return { id, name, source: sdkName ? 'sdk' : source }
}

/** Let the player name themselves. Highest precedence, never overwritten. */
export const setPlayerName = (name: string): void => {
  const clean = cleanName(name)
  setState(PLAYER_NAME_KEY, clean)
  void flushSaveNow()
}

/** The name the board would show right now. */
export const playerDisplayName = async (): Promise<string> => (await resolveIdentity()).name
