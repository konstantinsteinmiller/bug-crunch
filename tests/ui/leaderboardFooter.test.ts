import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'
import en from '@/i18n/locales/en'
import de from '@/i18n/locales/de'
import ja from '@/i18n/locales/ja'
import { LANGUAGES } from '@/utils/enums'
import { formatCount } from '@/utils/localeNumber'

/**
 * ─── "You are #1,130 of 2,531" ────────────────────────────────────────────
 *
 * The footer is the whole reason a player who is nowhere near the top opens the
 * board at all, and it had two separate faults that only show up once the
 * message is actually rendered rather than merely present in every locale file.
 *
 * `tests/i18nParity.test.ts` already proves every locale carries `{n}` and
 * `{total}`. What it cannot see is the CALL SITE, which passed only `{n}` —
 * vue-i18n renders a missing named parameter as nothing at all, so the sentence
 * came out "You are #1,130 of " and a second span then appended "of 2,531".
 *
 * These cases render the messages the way the modal does.
 */

const i18nFor = (locale: string, messages: Record<string, unknown>) =>
  createI18n({ legacy: false, locale, fallbackLocale: 'en', messages: { [locale]: messages } })
    .global.t

describe('the board footer renders one complete sentence', () => {
  it('leaves no dangling "of" when both parameters are supplied', () => {
    const t = i18nFor('en', en)
    const out = t('leaderboard.yourRank', { n: '1,130', total: '2,531' })
    expect(out).toBe('You are #1,130 of 2,531')
  })

  it('would leave a dangling fragment if the population were dropped', () => {
    // The regression itself, pinned so nobody "simplifies" the call site back.
    const t = i18nFor('en', en)
    expect(t('leaderboard.yourRank', { n: '1,130' })).toBe('You are #1,130 of ')
  })

  it('keeps the population first in the languages that put it there', () => {
    // Japanese is "{total} 人中 #{n} 位" — the population leads. This is why the
    // footer is ONE message and not a rank span plus an "of N" span: a split
    // renders these languages backwards, and Korean, Turkish and Kazakh too.
    const t = i18nFor('ja', ja)
    const out = t('leaderboard.yourRank', { n: '1,130', total: '2,531' })
    expect(out.indexOf('2,531')).toBeLessThan(out.indexOf('1,130'))
  })

  it('groups both numbers the way the active language does', () => {
    const t = i18nFor('de', de)
    const n = formatCount(1130, 'de')
    const total = formatCount(2531, 'de')
    expect(t('leaderboard.yourRank', { n, total })).toBe('Du bist #1.130 von 2.531')
  })

  it('never pluralises on a value that arrives pre-formatted', async () => {
    // `{n}` and `{total}` are STRINGS by the time they reach these messages —
    // that is what makes the grouping locale-correct. vue-i18n's plural
    // selection needs a real number, so a locale that split one of them on `|`
    // would silently pick the wrong form, or render the raw pipe.
    const preFormatted = ['leaderboard.yourRank', 'leaderboard.of', 'result.rankOf']
    for (const code of LANGUAGES) {
      const mod = await import(`../../src/i18n/locales/${code}.ts`)
      for (const path of preFormatted) {
        const [group, key] = path.split('.') as [string, string]
        const message = (mod.default as Record<string, Record<string, string>>)[group]?.[key]
        expect(message, `${code} is missing ${path}`).toBeTypeOf('string')
        expect(message, `${code} pluralises ${path} on a pre-formatted value`)
          .not.toContain('|')
      }
    }
  })
})
