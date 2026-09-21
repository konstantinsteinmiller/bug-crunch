# Bug Crunch leaderboard — setup, start to finish

Every command below is run on Windows in PowerShell, from the repo root unless
it says otherwise.

## Where it lives (deployed 2026-09-18)

| | |
|---|---|
| Cloudflare account | `rodent.race.app@gmail.com` — account id `7c5ee6a28676c02440e38e4f3e7bbb15` |
| workers.dev subdomain | `rodent-race` |
| Worker | `bug-crunch-leaderboard` → **https://bug-crunch-leaderboard.rodent-race.workers.dev** |
| D1 database | `bug-crunch-leaderboard`, id `a3fca06c-ee50-4763-885d-8ccd8bfd4117`, region WEUR |
| Signed submissions | **on** — `SCORE_SECRET` on the Worker, the same value in `VITE_LEADERBOARD_SECRET` in `.env` |

**Not the `hyperg8` account.** The older boards (`survivalist-leaderboard`,
`tower-siege-leaderboard`) live on a different Cloudflare account under the
`hyperg8` subdomain. `wrangler` on this machine logs into the rodent-race
account, and so do the newer boards (`glyphyx-`, `merge-idle-war-`,
`spin-and-mow-leaderboard`, `leaderboard-chaos-arena`). If `wrangler whoami`
ever shows a different account, stop: every command below would act on the
wrong one.

Steps 1–7 below have been done. They are kept as the procedure for a rebuild
from scratch (new account, deleted database), and steps 6 and 7 double as the
checks to re-run after changing the Worker.

---

## 1. Install the Worker toolchain

The Worker has its own `package.json`, deliberately separate from the game's —
it deploys on its own schedule and shares none of the game's dependencies.

```powershell
cd worker
npm install
```

## 2. Authorise the CLI

```powershell
npx wrangler login
npx wrangler whoami     # must say rodent.race.app@gmail.com
```

The login uses whichever Cloudflare account the browser is signed into at the
moment you click **Allow** — check it before clicking.

## 3. Create the database

```powershell
npx wrangler d1 create bug-crunch-leaderboard
```

Copy the printed `database_id` into `worker/wrangler.toml`. That one line is the
only edit the file needs.

## 4. Create the tables

```powershell
npm run db:init
```

Runs `schema.sql` against the **remote** database (the real one, not the local
emulator). Wrangler asks before touching remote data — answer `y` (or pass
`--yes`). Three statements run: two `CREATE TABLE` (`scores`, `board_cache`) and
one `CREATE INDEX` (`idx_scores_rank`).

## 5. Deploy

```powershell
npm run deploy
```

It prints `https://bug-crunch-leaderboard.rodent-race.workers.dev`. That URL is
what the game needs.

## 6. Check it is alive

### Read-only

```powershell
Invoke-RestMethod https://bug-crunch-leaderboard.rodent-race.workers.dev/top
```

A new board answers `{"updatedAt":…,"total":0,"entries":[],"dist":[]}`.

### The one sanctioned write, then clean it up

Signing is on, so a test score must carry an HMAC of `id:score:squad` made with
the secret from `.env`. On the wire `score` is the best single-level POINT
total and `squad` is the deepest level cleared (the column kept its name from
the schema the other games share).

```powershell
$base   = 'https://bug-crunch-leaderboard.rodent-race.workers.dev'
$secret = (Select-String -Path .env -Pattern '^VITE_LEADERBOARD_SECRET=(.*)$').Matches[0].Groups[1].Value.Trim()
$id = 'testplayer01'; $score = 13700; $squad = 12
$hmac = [System.Security.Cryptography.HMACSHA256]::new([Text.Encoding]::UTF8.GetBytes($secret))
$sig  = -join ($hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes("${id}:${score}:${squad}")) | ForEach-Object { $_.ToString('x2') })
$body = @{ id = $id; name = 'Tester'; score = $score; squad = $squad; sig = $sig } | ConvertTo-Json
Invoke-RestMethod -Method Post -ContentType 'application/json' -Body $body "$base/score"
```

It returns `rank: 1, best: 13700`. `total` can read `0` for up to an hour: the
histogram it is summed from is materialised on a 60-minute clock (see below),
and the client already copes with a board whose total lags its rows.

The guards, each of which must be **refused** (`Invoke-RestMethod` throws on a
4xx — that is the pass):

| Request | Expected |
|---|---|
| the same body without `sig` | `401 bad signature` |
| a `sig` that is not the HMAC | `401 bad signature` |
| `score` above 10 000 000 or `squad` above 1 000 | `422 implausible` |
| a second valid write for the same id inside 3 s | `429 too fast` |

Then delete the test row, and the materialised board that may still hold it:

```powershell
cd worker
npx wrangler d1 execute bug-crunch-leaderboard --remote `
  --command "DELETE FROM scores WHERE id = 'testplayer01'; DELETE FROM board_cache;"
npx wrangler d1 execute bug-crunch-leaderboard --remote `
  --command "SELECT (SELECT COUNT(*) FROM scores) AS scores, (SELECT COUNT(*) FROM board_cache) AS cache"
```

The last line must print `scores: 0, cache: 0`. The edge copy of `/top` expires
by itself within 60 s.

(The deploy on 2026-09-18 ran exactly this: 401 / 401 / 422 / 200 / 429, then
the delete, then `0 / 0`.)

## 7. Point the game at it

`.env` (repo root):

```
VITE_LEADERBOARD_URL=https://bug-crunch-leaderboard.rodent-race.workers.dev
VITE_LEADERBOARD_SECRET=<the SCORE_SECRET value>
```

Vite loads `.env` for **every** mode, so these two lines switch the live board
on for `pnpm dev` and for every portal build — CrazyGames, GamePix, Playgama,
GameMonetize, GameDistribution, itch, Glitch, Wavedash, Tauri — which then post
real scores.

**Poki and Yandex are the exceptions**, and their `.env.<mode>.local` files
blank both variables again:

* **Poki** forbids every external runtime request.
* **Yandex**'s moderators reject third-party storage URLs anywhere in the bundle
  or the CSP ("Service storage URL detected").

With the URL empty neither build makes a request. They ship the **seeded** board
instead (see "The baked boards" below). The secret is blanked too, so it does
not ship in bundles that have no use for it.

You do not need to touch `csp.ts`: `buildCsp()` reads the same variable and
folds its origin into `connect-src` (and leaves it out on Yandex).

To see it working, `pnpm dev`, play a level to its result screen, and watch the
Network tab: exactly one request to the Worker — a `POST /score` on a personal
record, or a `GET /top` when it is not. **`pnpm dev` posts to the production
board**, so a cheat-assisted dev run lands on the real board. Point a dev
session at a local Worker (below) when that matters.

## 8. Ship it

Nothing extra. `pnpm build:crazy-web`, `build:gamepix` and the rest pick the
variable up from `.env`. To confirm before uploading, grep the built HTML for
the origin — it must be present in the CSP meta tag:

```powershell
Select-String -Path dist\index.html -Pattern "rodent-race.workers.dev"
```

and **absent** from a Poki or Yandex build.

---

## Running it locally (optional)

Useful when changing the Worker itself — no deploys, no remote data:

```powershell
cd worker
npm run db:init:local     # tables in the local emulator
npm run dev               # http://localhost:8787
```

Then set `VITE_LEADERBOARD_URL=http://localhost:8787` in the game's `.env` while
you work. A local Worker has no `SCORE_SECRET` unless you give it one (a
`worker/.dev.vars` file with `SCORE_SECRET=…`); without it, signed requests are
simply accepted. The edge cache is a no-op locally, so every `/top` hits the
database — expected, and not what production does.

## Signed submissions

On. The Worker demands a signature whenever `SCORE_SECRET` exists, and the
client sends one whenever `VITE_LEADERBOARD_SECRET` is set; the signed message
is `${id}:${score}:${squad}` (HMAC-SHA256, lowercase hex) on both sides.

It raises the bar against hand-rolled POSTs. It does not make the board
tamper-proof: the secret ships inside a public bundle, so a determined player
can extract it. The bound in `plausible()` is what actually caps the damage.

To rotate it, change both sides together — an old build still in a portal's
cache will get `401` on its next write until it is replaced:

```powershell
cd worker
npx wrangler secret put SCORE_SECRET     # paste the new long random string
```

then put the same string in `.env` and rebuild every live portal build.

## The plausibility bound

`plausible()` refuses a score above `MAX_SCORE` (10 000 000) or a level above
`MAX_LEVEL` (1 000). Real aces post in the tens of thousands; even a physically
impossible run — every squish on the richest bug at a ×50 chain in Fever, plus a
boss — lands around a million. The bound is a cap on the absurd, set where no
honest run can reach it, because a false reject silently loses somebody's
genuine best. (It was `MAX_STAGE = 2 000` until the first deploy, inherited from
a board whose score was a stage count, and would have refused every good run.)

## Locking down origins (optional, later)

`ALLOWED_ORIGINS` in `wrangler.toml` is empty, which allows any origin. That is
the right setting while you are still collecting portal URLs — each portal
serves the game from a different host, and sandboxed iframes send
`Origin: null`, so an early allowlist mostly locks out your own game. Once you
know the real list:

```toml
ALLOWED_ORIGINS = "https://www.crazygames.com,https://html5.gamemonetize.com"
```

Then `npm run deploy` again.

## Watching it in production

* **Live logs:** `npx wrangler tail` (from `worker/`), or the dashboard under
  **Workers & Pages → bug-crunch-leaderboard → Logs**.
* **Quota use:** same page, **Metrics**. The free tier's numbers to watch are
  requests/day (100k) and D1 rows written/day (100k). The rodent-race account
  carries five boards, and they share one allowance.
* **The data:** **Storage & Databases → D1 → bug-crunch-leaderboard → Console**
  runs SQL straight from the browser, e.g.
  `SELECT * FROM scores ORDER BY score DESC LIMIT 20;`

## Emptying the board

```powershell
cd worker
npx wrangler d1 execute bug-crunch-leaderboard --remote --command "DELETE FROM scores"
# The materialised top-N and histogram are separate rows and do not clear themselves.
npx wrangler d1 execute bug-crunch-leaderboard --remote --command "DELETE FROM board_cache"
```

## The histogram on `/top`

`GET /top` returns the published rows **and** a histogram of every score:

```json
{ "updatedAt": 1757254334067, "total": 2422,
  "entries": [ ... 100 rows ... ],
  "dist": [[13625,1],[12825,1],[11650,1], ...] }
```

`dist` is `[score, howManyPlayersHaveIt]`, score-descending, so the client can
compute the rank this Worker would — `COUNT(*) WHERE score > ?` plus one — for
**any** score without asking. That is what removes `#100+` from the game: the
rows stop at 100, and on a board of thousands almost every player is below the
cut.

The histogram is materialised into `board_cache` under the id `dist` and rebuilt
only when that row is older than `DIST_TTL_MS` (one hour); the top-100 under
`top` on a five-minute clock. Its `GROUP BY score` is the one query here that
reads every row, so it must never run per request or on the write path.

## The baked boards

Every build carries a board in the bundle, as `virtual:leaderboard-snapshot`
(`vite.config.ts`), but not the same one:

| Build | Baked board | Why |
|---|---|---|
| Poki, Yandex (URL empty) | `data/leaderboard-seed.json` — **seeded**, modelled from a retention curve (`pnpm leaderboard:seed`, deterministic, committed) | They can never post, so the baked copy is their entire board forever. A snapshot of the live board would rank them against a survivorship sample. |
| Everything else (URL set) | `data/leaderboard-snapshot.json` — a copy of the live `/top` | The bottom rung of the offline ladder (live fetch → per-device cache → this), shown when the fetch fails and the device has no cache yet. |

`pnpm leaderboard:snapshot` writes the snapshot from
`DEFAULT_SOURCE` in `scripts/leaderboard-snapshot.mjs` (the rodent-race URL;
override with `LEADERBOARD_SNAPSHOT_URL`). A live build refreshes it itself when
the file is more than ten minutes old, and never fails on it.

**Until real players post, there is no snapshot.** A fresh board has an empty
histogram, which the script refuses to bake ("/top had no usable histogram
buckets"), so live builds made now ship without the offline rung: the live board
works, but a player whose fetch fails on a device with no cache sees no board.
Once the board has players, run `pnpm leaderboard:snapshot` and **commit the
JSON** — that is what makes an offline build reproducible.

## Playgama's own leaderboard

Not wired. Bug Crunch posts only to this Worker; there is no
`bridge.leaderboard` call.

## How a player is identified

`usePlayerIdentity.ts` resolves the id in tiers, best first:

1. **The uuid in the save blob** (`bc_player_id`) — rides the cloud save, so it
   follows the player between devices.
2. **The uuid in its own localStorage key** (`bug-crunch_uid`) — deliberately
   outside the `bc_`-prefixed blob the cloud save mirrors, so a hydrate arriving
   with an older blob cannot replace it. This is the tier that stops duplicate
   rows.
3. **A fresh mint.**

There is no platform-SDK tier: the portals this game ships to either expose no
stable player id or one that changes between anonymous sessions. Whichever
answers, the id is written back to both homes and flushed synchronously — an id
living only in memory until a debounce fires is an id a reload can lose, and a
lost id is a new row.

## Player names

Three tiers, highest first, each in its own storage slot so a later tier can
still take over:

| Tier | Slot | Source |
|---|---|---|
| 1 | `bc_player_name` | chosen by the player (`setPlayerName()`) |
| 2 | `bc_sdk_name` | the CrazyGames username — the only SDK here that offers one |
| 3 | `bc_anon_name` (+ `bug-crunch_name`) | generated once: a word and six digits, e.g. `Roamer156962` |

A late SDK name is corrected with one write on the next `reportRun` (it compares
against `bc_posted_name`); a quiet SDK keeps the last known name rather than
flipping back to the generated one. Control codes, zero-width characters and
bidi overrides are stripped and names are capped at 16 characters — on the
client so the player sees what the board will show, and again on the Worker.

There is no UI for tier 1 yet: `setPlayerName()` is wired, but nothing calls it.
