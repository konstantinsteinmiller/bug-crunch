#!/usr/bin/env python3
"""
Registration check: does a painted return sit where the drawing it replaces sat?

    python tools/measure-art.py cells                        # every sliced panel vs its recorded fit
    python tools/measure-art.py cells --sheet runes-melee    # one sheet
    python tools/measure-art.py pairs public/images/runes    # sliced singles vs single-<id>.png references
    python tools/measure-art.py strips public/images/monsters  # per-frame coverage of walk strips

The point of this file is that "does the art look right" is answerable by
arithmetic, and the arithmetic finds things the eye does not: a stone a third
too big, a glyph icon off-centre, two walk frames eaten by a flood fill, a
frame whose corners never reach the edge.

`cells` reads `art-sheets/sheet-index.json` — the bench recorded, per SHEET,
where the DRAWN content sat (`fit`: w/h/cx/bottom as fractions of one panel,
solid pixels only; the union of every panel for a walk or a death, panel 0 for
a still) — and measures the sliced strip under `public/` the same way. The
slicer already normalised the return onto that box, so a big number here means
the normalisation was refused (a wild return) or switched off.

(From the art-generation-pipeline skill's template; `cells` is adapted to
Survivalist's index, which is `{ walks: [...] }` with one fit per sheet.)

Requires Pillow. No other dependency.
"""
import argparse
import glob
import json
import os
import statistics
import sys

try:
    from PIL import Image
except ImportError:
    sys.exit('needs Pillow:  pip install pillow')

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

# The alpha above which a pixel counts as the subject. Deliberately high: a
# soft glow is light, not extent, and letting a halo into the bounding box is
# how a fitted stone ends up a fraction of the size it should be. The bench and
# the slicer measure at the same floor, or the three disagree about the subject.
SOLID = 140
# Anything at or under this is background for coverage counting.
PRESENT = 16


def bbox(path, alpha=SOLID, magenta_is_bg=True):
    """(w, h, cx, cy) of the drawn content as fractions of the image, or None."""
    im = Image.open(path).convert('RGBA')
    W, H = im.size
    px = im.load()
    mnx, mny, mxx, mxy = W, H, -1, -1
    for y in range(H):
        for x in range(W):
            r, g, b, a = px[x, y]
            if a <= alpha:
                continue
            # A reference sheet is flooded with chroma-key magenta rather than
            # transparency, so both forms of "background" are handled here.
            if magenta_is_bg and r > 190 and g < 70 and b > 190:
                continue
            if x < mnx: mnx = x
            if x > mxx: mxx = x
            if y < mny: mny = y
            if y > mxy: mxy = y
    if mxx < 0:
        return None
    return ((mxx - mnx + 1) / W, (mxy - mny + 1) / H,
            ((mnx + mxx + 1) / 2) / W, ((mny + mxy + 1) / 2) / H)


def judge(ref, got):
    """Worst axis ratio, centre offset and a note, comparing two (w, h, cx, cy)."""
    worst = max(got[0] / ref[0] if ref[0] else 1, got[1] / ref[1] if ref[1] else 1)
    off = max(abs(got[2] - ref[2]), abs(got[3] - ref[3]))
    note = ''
    if worst > 1.15: note = 'OVERSIZE'
    elif worst < 0.80: note = 'undersize'
    if off > 0.05: note = (note + ' OFF-CENTRE').strip()
    return worst, off, note


def print_rows(rows):
    print(f'{"":<28} {"drawn w/h":>12}  {"painted w/h":>12}  {"centre":>13}  {"size":>6}  note')
    for ident, pair, worst, note in rows:
        if not pair:
            print(f'{ident:<28} {"":>12}  {"":>12}  {"":>13}  {"":>6}  {note}')
            continue
        r, p = pair
        print(f'{ident:<28} {r[0]:>5.2f} {r[1]:>6.2f}  {p[0]:>5.2f} {p[1]:>6.2f}  '
              f'{p[2]:>6.2f},{p[3]:>5.2f}  {worst:>5.2f}x  {note}')
    bad = [r for r in rows if r[3]]
    print(f'\n{len(rows) - len(bad)}/{len(rows)} within tolerance'
          + (f' — check: {", ".join(r[0] for r in bad)}' if bad else ''))


def strip_box(path, frames, union):
    """(w, h, cx, cy) of a sliced strip's content as fractions of ONE panel.

    `union` folds every panel's box together, the way the bench measured a walk
    or a death; otherwise only panel 0 counts, the way it measured a still."""
    im = Image.open(path).convert('RGBA')
    W, H = im.size
    n = max(1, frames)
    fw = W // n
    px = im.load()
    mnx, mny, mxx, mxy = fw, H, -1, -1
    for i in range(n if union else 1):
        for y in range(H):
            for x in range(i * fw, (i + 1) * fw):
                if px[x, y][3] <= SOLID:
                    continue
                lx = x - i * fw
                if lx < mnx: mnx = lx
                if lx > mxx: mxx = lx
                if y < mny: mny = y
                if y > mxy: mxy = y
    if mxx < 0:
        return None
    return ((mxx - mnx + 1) / fw, (mxy - mny + 1) / H,
            ((mnx + mxx + 1) / 2) / fw, ((mny + mxy + 1) / 2) / H)


def cmd_cells(args):
    """Every sliced strip against the fit the bench recorded for its sheet."""
    index_file = os.path.join(ROOT, 'art-sheets', 'sheet-index.json')
    if not os.path.exists(index_file):
        sys.exit('no art-sheets/sheet-index.json — export from /#/art-sheets first')
    with open(index_file, encoding='utf-8') as f:
        index = json.load(f)
    rows = []
    for sheet in index.get('walks', []):
        if args.sheet and sheet['id'] != args.sheet:
            continue
        target, fit = sheet.get('target'), sheet.get('fit')
        if not target or not fit or sheet.get('fill'):
            continue
        out = os.path.join(ROOT, 'public', target)
        if not os.path.exists(out):
            continue
        # A creature's box (walks, deaths) is the union of its panels; a still's
        # is its first panel — `tight` is the index's own word for which.
        p = strip_box(out, sheet.get('frames', 1), union=not sheet.get('tight', False))
        if not p:
            rows.append((sheet['id'], None, None, 'empty'))
            continue
        r = (fit['w'], fit['h'], fit['cx'], fit['bottom'] - fit['h'] / 2)
        worst, _off, note = judge(r, p)
        rows.append((sheet['id'], (r, p), worst, note))
    if not rows:
        print('nothing sliced yet under public/ for the sheets in the index')
        return
    print_rows(rows)


def cmd_pairs(args):
    """Compare each sliced sprite against the single-object reference it was cut from."""
    scales = dict(kv.split('=') for kv in args.scale)
    rows = []
    for out in sorted(glob.glob(os.path.join(args.out_dir, '*.webp'))):
        ident = os.path.basename(out)[:-5]
        ref = os.path.join(args.ref_dir, f'{args.ref_prefix}{ident}.png')
        if not os.path.exists(ref):
            rows.append((ident, None, None, 'no reference'))
            continue
        r, p = bbox(ref), bbox(out, magenta_is_bg=False)
        if not r or not p:
            rows.append((ident, None, None, 'empty'))
            continue
        k = float(scales.get(ident, 1))
        pk = (p[0] * k, p[1] * k, p[2], p[3])
        worst, _off, note = judge(r, pk)
        rows.append((ident, (r, pk), worst, note))
    print_rows(rows)


def cmd_strips(args):
    """Per-frame coverage of an animation strip. Finds frames eaten by the key."""
    for f in sorted(glob.glob(os.path.join(args.dir, '*.webp'))):
        im = Image.open(f).convert('RGBA')
        W, H = im.size
        px = im.load()
        n = args.frames or (round(W / (H * args.aspect)) if W > H * 1.5 else 1)
        fw = W // n
        cov = [sum(1 for y in range(0, H, 2) for x in range(i * fw, (i + 1) * fw, 2)
                   if px[x, y][3] > PRESENT) for i in range(n)]
        med = statistics.median(cov) or 1
        weak = [i for i, c in enumerate(cov) if c < med * 0.45]
        flag = f'  <-- FRAMES {weak} EATEN' if weak else ''
        print(f'{os.path.basename(f):<28} {W}x{H} n={n} '
              f'weakest {min(cov) / med:.0%} of median{flag}')


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='cmd', required=True)

    p = sub.add_parser('cells', help='sliced lattice panels vs the fit the bench recorded')
    p.add_argument('--sheet', default='', help='only this sheet id, e.g. runes-melee')
    p.set_defaults(func=cmd_cells)

    p = sub.add_parser('pairs', help='sliced sprites vs their single-object references')
    p.add_argument('out_dir', help='e.g. public/images/runes')
    p.add_argument('--ref-dir', default=os.path.join(ROOT, 'art-sheets', 'singles'))
    p.add_argument('--ref-prefix', default='single-')
    p.add_argument('--scale', nargs='*', default=[],
                   help='runtime blit multipliers, e.g. forge=1.2')
    p.set_defaults(func=cmd_pairs)

    p = sub.add_parser('strips', help='per-frame coverage of animation strips')
    p.add_argument('dir', help='e.g. public/images/monsters')
    p.add_argument('--frames', type=int, default=0, help='override frame count')
    p.add_argument('--aspect', type=float, default=228 / 256,
                   help='one panel\'s width:height (monsters 228/256, heroes and bolts 1)')
    p.set_defaults(func=cmd_strips)

    args = ap.parse_args()
    args.func(args)


if __name__ == '__main__':
    main()
