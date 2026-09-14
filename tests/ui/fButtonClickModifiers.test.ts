// ─── `@click.stop` on an FButton must reach the parent's handler ────────────
//
// This is the test that would have caught a broken Locker.
//
// `FButton` used to emit its click with NO payload (`$emit('click')`). On a
// COMPONENT there is no DOM node for Vue to attach a listener to, so the
// compiler turns `@click.stop` into `withModifiers(handler, ['stop'])` — and
// that wrapper's very first statement is `event.stopPropagation()` on argument
// zero of the emit. With nothing emitted, argument zero is `undefined`, so
// every `@click.stop="…"` on an FButton threw
//
//     TypeError: Cannot read properties of undefined (reading 'stopPropagation')
//
// before the wrapped handler ran. In the Locker that meant pressing an enabled
// "Buy 350" did nothing at all: the purchase never fired, and because the throw
// happened inside event dispatch nothing in the UI changed to say so.
//
// Two halves, deliberately:
//
//   1. the UNIT — mount `FButton` under a parent that binds `@click.stop`, and
//      assert the parent's handler ran. `withModifiers` is what the template
//      compiler emits for that binding, so calling it directly pins the exact
//      mechanism rather than a lookalike.
//   2. the SOURCE — assert the template still forwards `$event`. A payload can
//      be dropped again by a one-character edit, and the unit test above is the
//      only thing standing between that edit and a dead shop.

import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, withModifiers } from 'vue'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import FButton from '@/components/atoms/FButton.vue'

/** FButton calls `useI18n()` for its icon-only accessible-name fallback, so it
 *  needs an i18n instance installed — an empty message set is enough. */
const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  missingWarn: false,
  fallbackWarn: false,
  messages: { en: {} }
})

/**
 * A parent that binds `@click.stop` to an `FButton`, exactly as `ShoeCard`
 * does. `withModifiers(fn, ['stop'])` IS the compiler's output for that
 * binding on a component — see `compiler-core`'s `transformOn`.
 */
const mountWithStop = (onClick: () => void, isDisabled = false) =>
  mount(defineComponent({
    setup: () => () => h('div', { onClick: () => { /* the card's own select */ } }, [
      h(FButton, {
        label: 'Buy 350',
        isDisabled,
        onClick: withModifiers(onClick, ['stop'])
      })
    ])
  }), { global: { plugins: [i18n] } })

describe('FButton forwards the native click event', () => {
  it('runs a parent handler bound with @click.stop', async () => {
    const onClick = vi.fn()
    const wrapper = mountWithStop(onClick)

    await wrapper.find('button').trigger('click')

    expect(onClick, 'the .stop-wrapped handler never ran — the emit had no event payload')
      .toHaveBeenCalledTimes(1)
  })

  it('does not let the click reach the card behind it', async () => {
    // The other half of what `.stop` is for: tapping Buy must not also toggle
    // the card open/closed. A payload-less emit broke this too — by throwing
    // before either handler ran, which looks the same as "it worked" from the
    // parent's point of view and is not.
    const onCard = vi.fn()
    const onButton = vi.fn()
    const wrapper = mount(defineComponent({
      setup: () => () => h('div', { onClick: onCard }, [
        h(FButton, { label: 'Buy 350', onClick: withModifiers(onButton, ['stop']) })
      ])
    }), { global: { plugins: [i18n] } })

    await wrapper.find('button').trigger('click')

    expect(onButton).toHaveBeenCalledTimes(1)
    expect(onCard, 'the press bubbled to the card and toggled it').not.toHaveBeenCalled()
  })

  it('emits the MouseEvent itself, so .prevent and .self work too', async () => {
    const onClick = vi.fn()
    const wrapper = mount(FButton, {
      props: { label: 'Buy 350' },
      attrs: { onClick },
      global: { plugins: [i18n] }
    })

    await wrapper.find('button').trigger('click')

    expect(onClick).toHaveBeenCalledTimes(1)
    expect(onClick.mock.calls[0]![0], 'click was emitted without its native event')
      .toBeInstanceOf(Event)
  })

  it('a disabled button still emits nothing', async () => {
    const onClick = vi.fn()
    const wrapper = mountWithStop(onClick, true)

    await wrapper.find('button').trigger('click')

    expect(onClick).not.toHaveBeenCalled()
  })

  it('the template still forwards $event', () => {
    const src = readFileSync(
      resolve(__dirname, '../..', 'src/components/atoms/FButton.vue'), 'utf8'
    )
    expect(src, 'FButton emits click with no payload again — every @click.stop consumer is broken')
      .toMatch(/\$emit\(\s*'click'\s*,\s*\$event\s*\)/)
  })
})
