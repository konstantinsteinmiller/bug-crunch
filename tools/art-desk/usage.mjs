/**
 * ─── The generation ledger ──────────────────────────────────────────────────
 *
 * How many images have been asked of Gemini, kept in ONE file for every project
 * on this machine (`~/.art-desk/usage.json`), because the thing that runs out
 * is not a project's patience — it is a Google account's allowance, and every
 * project spends the same one.
 *
 * Two different ceilings are counted against it, and the difference matters:
 *
 *   dailyCap    a hard stop. Reach it and a run ends. Off by default
 *               (`Infinity`) — the day is not what runs out.
 *   accountCap  how many generations one account is good for before Gemini
 *               starts refusing. Reaching it PAUSES a run and asks for another
 *               account; nothing is lost, and no quota is spent discovering the
 *               wall. Counted from the last confirmed account switch rather
 *               than from midnight, because that is the span that shares an
 *               allowance.
 *
 * Lifted out of `server.mjs` when `tools/art-promotion.mjs` became a second
 * thing that paints: two counters over one quota drift apart silently, and the
 * symptom of the drift is the queue walking into a refusal it was built to
 * avoid.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

export const USAGE = join(homedir(), '.art-desk', 'usage.json')

export const today = () => new Date().toISOString().slice(0, 10)

export const usage = () => {
  try { return JSON.parse(readFileSync(USAGE, 'utf-8')) } catch { return {} }
}

export const usedToday = () => usage()[today()] ?? 0

/**
 * Generations since the last confirmed account switch.
 *
 * Kept under a reserved key rather than a date, so the file stays the
 * day-keyed history it has always been and an older desk reading it just sees
 * one extra entry it ignores. The key is not a date, so it can never collide.
 */
export const ACCOUNT_KEY = '_sinceAccountSwitch'

/**
 * Falls back to TODAY'S count when the key is absent, which is what every
 * install that predates this counter looks like.
 *
 * Starting such an install at 0 would be the wrong way round: it would hand a
 * fresh allowance to an account that has already spent most of one today, and
 * the queue would run straight into Gemini's real refusal — the case this whole
 * mechanism exists to avoid. Today's count is the best evidence available, and
 * it errs towards asking for a switch too early rather than too late. One
 * "Switched account" press corrects it.
 */
export const usedOnAccount = () => {
  const u = usage()
  return u[ACCOUNT_KEY] ?? u[today()] ?? 0
}

export const countGeneration = () => {
  const u = usage()
  u[today()] = (u[today()] ?? 0) + 1
  u[ACCOUNT_KEY] = (u[ACCOUNT_KEY] ?? 0) + 1
  mkdirSync(dirname(USAGE), { recursive: true })
  writeFileSync(USAGE, JSON.stringify(u, null, 2))
}

/** Called when a DIFFERENT Google account has been signed in. The day total is
 *  deliberately untouched — it is a record of the day, not of the account. */
export const resetAccountCount = () => {
  const u = usage()
  u[ACCOUNT_KEY] = 0
  mkdirSync(dirname(USAGE), { recursive: true })
  writeFileSync(USAGE, JSON.stringify(u, null, 2))
}
