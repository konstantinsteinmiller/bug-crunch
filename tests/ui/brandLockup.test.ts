import { readFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import sharp from 'sharp'

/**
 * The brand, and the contract that lets the splash show it without measuring it.
 *
 * There are two drawings and one identity — the LOCKUP (`BUG` over `CRUNCH`
 * under a gilded sole) at 192/256/512, and the MARK (that sole alone on an ink
 * tile, no lettering) for the favicon, the apple-touch icon and the manifest's
 * maskable slots. A wordmark that works at 512 px is mud at 16 px, so the small
 * sizes get a different drawing rather than a smaller one.
 *
 * What is pinned here:
 *
 *   1. The lockup FILLS ITS SQUARE with a small even margin. This is the
 *      contract that removed a hand-measured `margin-top: -16.41%` crop from
 *      `FLogoProgress.vue` — a constant derived from one particular file's
 *      alpha bbox, which nobody re-derived when the file changed, and which
 *      `index.html` did not apply at all, so the two halves of the splash
 *      handover were different sizes. With the ink inside the frame both
 *      splashes can simply show the square.
 *   2. Both splashes show it at the SAME size. They are one picture across a
 *      400 ms crossfade; a different width on either side is a jump.
 *   3. The favicon is a REAL multi-size .ico. The previous one was a 32 px PNG
 *      with the extension swapped, so the tab strip got a box-filtered 32→16
 *      downsample of a detailed mark.
 *   4. The mark survives 16 px — still a tile, still a hot splat, still a gold
 *      object, rather than one grey smudge.
 *   5. The manifest declares sizes the files on disk actually are.
 */

const ROOT = resolve(__dirname, '../..')
const html = readFileSync(join(ROOT, 'index.html'), 'utf8')
const vue = readFileSync(join(ROOT, 'src/components/atoms/FLogoProgress.vue'), 'utf8')

const LOGO = join(ROOT, 'public/images/logo/logo_512x512.png')
const FAVICON = join(ROOT, 'public/favicon.ico')
const MANIFEST = join(ROOT, 'public/manifest.json')

/** The alpha bounding box of a bitmap, as fractions of its own size. */
const inkBox = async (file: string, threshold = 40) => {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * info.channels + 3]! > threshold) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  return {
    left: x0 / info.width,
    top: y0 / info.height,
    right: (info.width - 1 - x1) / info.width,
    bottom: (info.height - 1 - y1) / info.height,
    width: (x1 - x0 + 1) / info.width,
    height: (y1 - y0 + 1) / info.height
  }
}

describe('the lockup fills its own square', () => {
  it('is not a device floating in air — every side is close to the frame', async () => {
    // WHAT THIS PROTECTS, now that the lockup is a PAINTING (`art-sheets` →
    // `still-ui-logo`): the splash shows this file in a plain 1:1 box at 76 %
    // with no crop, and that only works while the ink actually fills its square.
    // The placeholder this replaced was a device in a thin band, which is what
    // made a hand-measured crop look necessary in the first place — and a crop
    // is a constant somebody has to re-measure every time the art changes.
    //
    // The old floor — at least 1 % of clear margin on all four sides — is gone,
    // and deliberately. It described the DRAWN lockup, which was laid out to a
    // margin this generator controls. The painting is full bleed by
    // composition: the sneaker's shaft enters from above (52 px of ink on the
    // top row), the splat runs out below (448 px), and its flung droplets reach
    // within 4 px on the left and 1 px on the right. None of that is a crop
    // accident and no prompt can hold a painter to a five-pixel gutter.
    //
    // A genuinely clipped painting is still caught, by the cap here and by the
    // height and width tests below.
    const box = await inkBox(LOGO)
    for (const side of ['left', 'right', 'top', 'bottom'] as const) {
      // Above ~10 % the splash is mostly empty air and somebody starts wanting
      // a crop again.
      expect(box[side], side).toBeLessThanOrEqual(0.11)
    }
  })

  it('is a lockup rather than a band — it uses most of the height', async () => {
    // The placeholder this replaced was a device in a thin band at 0.40..0.60,
    // which is what made a crop look necessary in the first place.
    const box = await inkBox(LOGO)
    expect(box.height).toBeGreaterThan(0.8)
    expect(box.width).toBeGreaterThan(0.8)
  })

  it('carries no measured crop in either splash', () => {
    // A negative margin or a non-square aspect on the logo box means somebody
    // has re-introduced a constant that has to be kept in step with a bitmap.
    const vueStyle = vue.slice(vue.indexOf('<style scoped'))
    const greet = vueStyle.slice(vueStyle.indexOf('.greet-logo'), vueStyle.indexOf('.percentage-text'))
    expect(greet).not.toMatch(/margin-top:\s*-/)
    expect(greet).toContain('aspect-ratio: 1 / 1')
  })

  it('is shown at the same size by both splashes', () => {
    // index.html paints before any script runs; FLogoProgress takes over when
    // Vue mounts, and for 400 ms they are both on screen.
    const inline = html.slice(html.indexOf('<style>'), html.indexOf('</style>'))
    const staticW = inline.match(/\.splash-logo\s*\{[^}]*width:\s*(\d+)%/)?.[1]
    const vueW = vue.slice(vue.indexOf('<style scoped')).match(/\.greet-logo\s*\n\s*width:\s*(\d+)%/)?.[1]
    expect(staticW).toBeDefined()
    expect(vueW).toBeDefined()
    expect(vueW).toBe(staticW)
  })
})

describe('the favicon', () => {
  const ico = readFileSync(FAVICON)

  it('is a real ICO container, not a PNG with the extension swapped', () => {
    // ICONDIR: reserved 0, type 1 (icon), then the entry count.
    expect(ico.readUInt16LE(0)).toBe(0)
    expect(ico.readUInt16LE(2)).toBe(1)
    expect(ico.readUInt16LE(4)).toBeGreaterThan(1)
    // …and specifically not a PNG, whose first bytes are \x89PNG.
    expect(ico.subarray(0, 4).toString('latin1')).not.toBe('\x89PNG')
  })

  it('carries 16, 32 and 48, each rendered at its own size', () => {
    const count = ico.readUInt16LE(4)
    const sizes: number[] = []
    for (let i = 0; i < count; i++) {
      const o = 6 + i * 16
      sizes.push(ico.readUInt8(o) || 256)
      // Every entry must point inside the file, or a browser silently shows
      // the default page icon and nobody notices for a release.
      const len = ico.readUInt32LE(o + 8)
      const off = ico.readUInt32LE(o + 12)
      expect(off + len).toBeLessThanOrEqual(ico.length)
    }
    expect(sizes).toEqual([16, 32, 48])
  })

  it('is still reachable at the site root, and is not the only icon offered', () => {
    // Some portals and older browsers fetch `/favicon.ico` without reading the
    // document at all, so the .ico link stays whatever else is added. Absolute
    // paths, because Vite only rewrites those against a `--base=./` build.
    expect(html).toContain('<link rel="icon" href="/favicon.ico"')
    expect(html).toMatch(/<link rel="icon" type="image\/png"[^>]*href="\/images\/logo\/mark_32x32\.png"/)
    expect(html).toMatch(/<link rel="apple-touch-icon"[^>]*href="\/images\/logo\/mark_180x180\.png"/)
  })
})

describe('the mark survives a favicon', () => {
  it('is a filled tile at 16 px — three readable regions, not a smudge', async () => {
    const { data, info } = await sharp(join(ROOT, 'public/images/logo/mark_32x32.png'))
      .resize(16, 16).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const n = info.width * info.height
    let opaque = 0
    let gold = 0
    let hot = 0
    for (let i = 0; i < n; i++) {
      const [r, g, b, a] = [data[i * 4]!, data[i * 4 + 1]!, data[i * 4 + 2]!, data[i * 4 + 3]!]
      if (a > 200) opaque++
      // The hero object: warm, bright, and much more red+green than blue.
      if (a > 200 && r > 180 && g > 130 && b < 130) gold++
      // The splat: hot pink — red high, blue well above green.
      if (a > 200 && r > 170 && b > g + 20) hot++
    }
    // A tile, not a transparent glyph: the ground is most of the frame.
    expect(opaque / n).toBeGreaterThan(0.6)
    // The sole is still a shape you can point at, at 16 px.
    //
    // 0.09, not the 0.10 the DRAWN mark met. Measured through this same 32→16
    // path, drawn scores gold 12.5 % / pink 2.3 % / opaque 73 %, and the
    // painting scores gold 9.8 % / pink 3.9 % / opaque 100 %: it trades a little
    // gold for a tile that actually fills its square and a splat that reads.
    // That is a different balance, not a worse one, and the floor moved once to
    // describe it rather than drifting whenever a repaint lands.
    expect(gold / n).toBeGreaterThan(0.09)
    // …and the splat has not been squeezed out from behind it.
    expect(hot / n).toBeGreaterThan(0.02)
  })

  it('has no lettering in it — that is the whole reason it exists', async () => {
    // A cheap proxy for "this is one object, not nine": at 16 px a wordmark is
    // a horizontal grille, so the ink would alternate many times across the
    // middle row. One object crosses its own edges a handful of times.
    const { data, info } = await sharp(join(ROOT, 'public/images/logo/mark_32x32.png'))
      .resize(16, 16).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const y = 8
    let runs = 0
    let prev = false
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 4
      const isGold = data[i]! > 180 && data[i + 1]! > 130 && data[i + 2]! < 130
      if (isGold !== prev) runs++
      prev = isGold
    }
    expect(runs).toBeLessThanOrEqual(4)
  })
})

describe('the manifest points at files that exist and are what it says', () => {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'))

  it('declares the size each icon actually is', async () => {
    expect(manifest.icons.length).toBeGreaterThan(0)
    for (const icon of manifest.icons) {
      // Relative on purpose: a manifest's icon URLs resolve against the
      // MANIFEST's own URL, which is what makes one file work for a root
      // deploy and a `--base=./` portal zip alike.
      expect(icon.src.startsWith('/')).toBe(false)
      const file = join(ROOT, 'public', icon.src)
      expect(existsSync(file), icon.src).toBe(true)
      const meta = await sharp(file).metadata()
      expect(`${meta.width}x${meta.height}`, icon.src).toBe(icon.sizes)
    }
  })

  it('offers a maskable pair, and they are opaque to the corner', async () => {
    const maskable = manifest.icons.filter((i: { purpose?: string }) => i.purpose === 'maskable')
    expect(maskable.length).toBeGreaterThanOrEqual(2)
    for (const icon of maskable) {
      // Android crops a maskable icon to a circle of 80 % diameter and paints
      // whatever is left. A transparent corner there is a transparent corner
      // on the launcher.
      const box = await inkBox(join(ROOT, 'public', icon.src), 200)
      expect(box.width, icon.src).toBe(1)
      expect(box.height, icon.src).toBe(1)
    }
  })
})
