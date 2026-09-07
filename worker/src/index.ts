/**
 * ─── Survivalist leaderboard ────────────────────────────────────────────────
 *
 * A Cloudflare Worker over one D1 table. Two routes:
 *
 *   GET  /top    → the materialised top-100 PLUS the score histogram for the
 *                  whole population, edge-cached for `EDGE_TTL`
 *   POST /score  → upsert one player's best, and return their rank + the board
 *
 * The histogram is what lets the client rank a player EXACTLY without asking:
 * the published rows stop at 100, so on a board of thousands almost everyone is
 * below the cut and could otherwise only be told "#100+".
 *
 * THE SCORE IS THE HIGHEST STAGE REACHED. Not a point total — the game's whole
 * progression is "how deep did you get", so the board is a depth chart and
 * `score` is a small integer that grows by one at a time.
 *
 * Design rules, in the order they matter:
 *
 *   1. The client may never be blocked by this. Every response is fast or the
 *      client's own 6 s timeout gives up and the game carries on with no rank.
 *   2. The free tier is a design constraint, not a footnote. The board is
 *      materialised into ONE row (`board_cache`) so a view costs one row read
 *      instead of a hundred, and the edge cache makes most views cost zero.
 *   3. Trust nothing. The id and name are re-sanitised here even though the
 *      client already did it, and an implausible score is refused outright.
 */

export interface Env {
  DB: D1Database
  ALLOWED_ORIGINS?: string
  SCORE_SECRET?: string
}

interface BoardEntry { rank: number; name: string; score: number; squad: number }
interface Board { updatedAt: number; total: number; entries: BoardEntry[] }

/** Rows in the published table. */
const TOP_N = 100
/** Seconds the edge may serve a stale board. */
const EDGE_TTL = 60
/** One id may not write more often than this. */
const WRITE_COOLDOWN_MS = 3_000

/**
 * The only real cheat cap, and it is deliberately generous.
 *
 * Stages are unbounded by design (the generator runs forever), so this cannot
 * be "the last stage" — it is a bound on the absurd. A player physically cannot
 * clear a stage in under ~30 s, so 2 000 stages is well over a day of unbroken
 * play; anything past it is a fabricated request. A false reject silently loses
 * somebody's genuine best, which is far worse than admitting an outlier, so the
 * bound is set where no honest run can ever reach it.
 */
const MAX_STAGE = 2_000
/** Squad is capped in the client at `MAX_SQUAD` = 4 000 (raised from 1 600 when
 *  the road went endless); the headroom here is for the next raise. */
const MAX_SQUAD = 100_000

const plausible = (score: number, squad: number): boolean =>
  Number.isInteger(score) && Number.isInteger(squad) &&
  score >= 0 && score <= MAX_STAGE &&
  squad >= 0 && squad <= MAX_SQUAD

/** `[a-zA-Z0-9_-]`, 8–64 — the same shape the client mints. */
const validId = (id: unknown): id is string =>
  typeof id === 'string' && /^[a-zA-Z0-9_-]{8,64}$/.test(id)

/**
 * Strip the characters that let a name break a table or impersonate a rank:
 * C0/C1 controls, zero-width joiners and spaces, bidi overrides, and the BOM.
 * No profanity filter — that is a moderation policy, not a parser.
 */
const cleanName = (raw: unknown): string => {
  if (typeof raw !== 'string') return 'Anon'
  const out = raw
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F\u200B-\u200F\u202A-\u202E\uFEFF]/g, '')
    .trim()
    .slice(0, 16)
  return out.length > 0 ? out : 'Anon'
}

const corsHeaders = (env: Env, origin: string | null): Record<string, string> => {
  const allowed = (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  // An empty allowlist means "any": every portal build has its own origin and a
  // sandboxed iframe sends `null`, so locking this down is opt-in per deploy.
  const ok = allowed.length === 0 || (origin !== null && allowed.includes(origin))
  return {
    'access-control-allow-origin': ok ? (origin ?? '*') : 'null',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400'
  }
}

const json = (body: unknown, status = 200, extra: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...extra }
  })

const hmac = async (secret: string, message: string): Promise<string> => {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Constant-time compare, so a signature cannot be probed a byte at a time. */
const safeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

const readBoard = async (env: Env): Promise<Board> => {
  const row = await env.DB
    .prepare("SELECT json FROM board_cache WHERE id = 'top'")
    .first<{ json: string }>()
  if (row?.json) {
    try { return JSON.parse(row.json) as Board } catch { /* fall through */ }
  }
  return rebuildBoard(env)
}

const rebuildBoard = async (env: Env): Promise<Board> => {
  const { results } = await env.DB
    .prepare('SELECT name, score, squad FROM scores ORDER BY score DESC, updated_at ASC LIMIT ?')
    .bind(TOP_N)
    .all<{ name: string; score: number; squad: number }>()
  const totalRow = await env.DB
    .prepare('SELECT COUNT(*) AS n FROM scores')
    .first<{ n: number }>()

  const board: Board = {
    updatedAt: Date.now(),
    total: totalRow?.n ?? 0,
    entries: (results ?? []).map((r, i) => ({
      rank: i + 1, name: r.name, score: r.score, squad: r.squad
    }))
  }
  await env.DB
    .prepare(
      "INSERT INTO board_cache (id, json, updated_at) VALUES ('top', ?, ?)\n" +
      'ON CONFLICT(id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at'
    )
    .bind(JSON.stringify(board), board.updatedAt)
    .run()
  return board
}

/**
 * The score histogram, densest-first — `[score, howManyPlayersHaveIt]`.
 *
 * This is the one query on the Worker whose cost scales with the player base:
 * `GROUP BY score` reads every row. So it is NEVER run per request and never on
 * the write path — it is materialised into `board_cache` beside the board and
 * only recomputed once its row is older than `DIST_TTL_MS`. A read costs one
 * row; a rebuild costs the table, a few times an hour at most.
 *
 * It rides along on `/top` because of what it buys the client: an EXACT rank
 * for any score. Without it a player below the hundredth published row can only
 * be told "#100+", which on a board of a few thousand is almost everyone.
 */
// An hour, not a few minutes. A rebuild reads the whole table, and the account
// is close enough to the free tier's ceiling to have hit it — 24 rebuilds a day
// over a few thousand rows is a rounding error against the allowance, where a
// 15-minute TTL would be four times that for a histogram whose ranks move by a
// handful of places in an hour.
const DIST_TTL_MS = 60 * 60_000

const rebuildDist = async (env: Env): Promise<[number, number][]> => {
  const { results } = await env.DB
    .prepare('SELECT score, COUNT(*) AS n FROM scores GROUP BY score ORDER BY score DESC')
    .all<{ score: number; n: number }>()
  const buckets: [number, number][] = (results ?? []).map((r) => [r.score, r.n])
  await env.DB
    .prepare(
      "INSERT INTO board_cache (id, json, updated_at) VALUES ('dist', ?, ?)\n" +
      'ON CONFLICT(id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at'
    )
    .bind(JSON.stringify(buckets), Date.now())
    .run()
  return buckets
}

const readDist = async (env: Env): Promise<[number, number][]> => {
  const row = await env.DB
    .prepare("SELECT json, updated_at FROM board_cache WHERE id = 'dist'")
    .first<{ json: string; updated_at: number }>()
  if (row?.json && Date.now() - row.updated_at < DIST_TTL_MS) {
    try { return JSON.parse(row.json) as [number, number][] } catch { /* fall through */ }
  }
  return rebuildDist(env)
}

const sumDist = (dist: [number, number][]): number =>
  dist.reduce((sum, [, n]) => sum + n, 0)

/**
 * The board as the client receives it: rows to list, plus the histogram to rank
 * against.
 *
 * `total` is taken from the HISTOGRAM whenever there is one, not from the
 * board's own `COUNT(*)`. The two are separate reads of a moving table, and a
 * rank derived from the buckets has to be a rank out of the number those
 * buckets add up to — otherwise the game can print "#1204 of 1203".
 */
const withDist = async (env: Env, board: Board): Promise<Board & { dist: [number, number][] }> => {
  const dist = await readDist(env)
  return { ...board, total: sumDist(dist) || board.total, dist }
}

/** Ties share a rank rather than being split — `COUNT(*) WHERE score > ?` + 1. */
const rankOf = async (env: Env, score: number): Promise<number> => {
  const row = await env.DB
    .prepare('SELECT COUNT(*) AS n FROM scores WHERE score > ?')
    .bind(score)
    .first<{ n: number }>()
  return (row?.n ?? 0) + 1
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const origin = request.headers.get('origin')
    const cors = corsHeaders(env, origin)

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })

    // ── GET /top ──
    if (request.method === 'GET' && url.pathname === '/top') {
      const cache = caches.default
      const cacheKey = new Request(new URL('/top', url.origin).toString(), { method: 'GET' })
      const hit = await cache.match(cacheKey)
      if (hit) {
        const out = new Response(hit.body, hit)
        for (const [k, v] of Object.entries(cors)) out.headers.set(k, v)
        return out
      }
      const board = await withDist(env, await readBoard(env))
      const fresh = json(board, 200, { 'cache-control': `public, max-age=${EDGE_TTL}` })
      await cache.put(cacheKey, fresh.clone())
      for (const [k, v] of Object.entries(cors)) fresh.headers.set(k, v)
      return fresh
    }

    // ── POST /score ──
    if (request.method === 'POST' && url.pathname === '/score') {
      let body: Record<string, unknown>
      try {
        body = (await request.json()) as Record<string, unknown>
      } catch {
        return json({ error: 'bad json' }, 400, cors)
      }

      const id = body.id
      const score = Number(body.score)
      const squad = Number(body.squad)
      const name = cleanName(body.name)

      if (!validId(id)) return json({ error: 'bad id' }, 400, cors)
      if (!plausible(score, squad)) return json({ error: 'implausible' }, 422, cors)

      if (env.SCORE_SECRET) {
        const expected = await hmac(env.SCORE_SECRET, `${id}:${score}:${squad}`)
        if (typeof body.sig !== 'string' || !safeEqual(body.sig, expected)) {
          return json({ error: 'bad signature' }, 401, cors)
        }
      }

      const now = Date.now()
      const existing = await env.DB
        .prepare('SELECT name, score, updated_at FROM scores WHERE id = ?')
        .bind(id)
        .first<{ name: string; score: number; updated_at: number }>()

      if (existing && now - existing.updated_at < WRITE_COOLDOWN_MS) {
        return json({ error: 'too fast' }, 429, cors)
      }

      // Three outcomes, deliberately not one `ON CONFLICT`: a new player, a new
      // record, and "same score, different name" are different writes, and the
      // third must not touch the score or its timestamp (which would jump the
      // player ahead of everyone they were tied with).
      let best = existing?.score ?? 0
      let changed = false
      if (!existing) {
        await env.DB
          .prepare('INSERT INTO scores (id, name, score, squad, updated_at) VALUES (?, ?, ?, ?, ?)')
          .bind(id, name, score, squad, now)
          .run()
        best = score
        changed = true
      } else if (score > existing.score) {
        await env.DB
          .prepare('UPDATE scores SET name = ?, score = ?, squad = ?, updated_at = ? WHERE id = ?')
          .bind(name, score, squad, now, id)
          .run()
        best = score
        changed = true
      } else if (existing.name !== name) {
        await env.DB.prepare('UPDATE scores SET name = ? WHERE id = ?').bind(name, id).run()
        changed = true
      }

      const board = await withDist(env, changed ? await rebuildBoard(env) : await readBoard(env))
      if (changed) {
        await caches.default.delete(new Request(new URL('/top', url.origin).toString()))
      }
      return json({ rank: await rankOf(env, best), best, total: board.total, board }, 200, cors)
    }

    return json({ error: 'not found' }, 404, cors)
  }
}
