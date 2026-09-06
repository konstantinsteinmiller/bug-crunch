# Still prompts — one object per generation

Generated from the manifest — do not hand-edit, re-export instead.

Attach `art-sheets/still-<kind>-<id>.png` and paste the matching block
beside it. There is no grid to preserve here, which is the whole point.

Drop results in `art-sheets/painted/`, keeping the `still-<kind>-<id>` in
the name, then run `pnpm slice-sheets`. Every return is measured against
its reference and normalised onto it.

# crate-damage — Supply crate (damage)  (images/props/crate-damage.webp)

Paint ONE game sprite in a single square (1:1) image.
The attached reference is exactly what to paint, at exactly the size and
position it is drawn at. Match both.

WHAT IT IS: A supply crate: a square iron-banded strongbox of dark oak planks with riveted black-iron corners and a faint sickly-GREEN painted seal or band on its face. Square and flat-on.

LEAVE OUT WHAT THE GAME PAINTS LIVE. The game paints a green chevron badge, a glowing rim and an HP number over the middle of the face, so keep the CENTRE plain and readable and put the detail at the edges.

STYLE — grim painted dark fantasy, like a plate from a gothic illustrated
bestiary or the key art of a dungeon crawler. Match this in every panel:
· INK FIRST. Heavy hand-drawn contour lines in near-black ink, jagged and
  confident, thick on the shadow side and thin on the lit side, with
  dry-brush breaks. The drawing must look DRAWN — scratchy linework showing
  through the paint.
· PAINTED, NOT RENDERED. Flat blocks of gouache-like paint inside the lines
  with visible brushwork, rough cel-style shadow shapes and a little grain.
  No airbrush, no smooth 3D shading, no plastic gloss.
· DESATURATED, LOW-KEY colour: bone, ash grey, dried blood, rust, bruise
  purple, swamp green, cold slate — with ONE hot accent per subject (ember
  orange, sickly witch-green, cold soul-blue, tarnished gold). Deep shadows
  that fall to black.
· HIGH CONTRAST and cold. The light comes from the UPPER LEFT. Chiaroscuro:
  most of every form in shadow, one edge picked out.
· Gothic, grotesque, worn: cracked bone, rusted iron, torn cloth, wet stone,
  candle-soot. Everything has been through something.
· Menacing rather than cute — but the SILHOUETTE stays readable at 40 px, so
  keep the big shapes simple and put the detail inside them.

AVOID — this is exactly how earlier attempts went wrong:
· NO cute, cozy, storybook, chibi or plush look. No rounded friendly faces,
  no button eyes, no smiles.
· NO candy-bright, saturated, neon or pastel colour. If it looks cheerful,
  it is wrong.
· NO glossy, plasticky, airbrushed mobile-game rendering. No smooth 3D
  volume, no bevelled edges, no lens flares, no rim-lit chrome.
· NO photorealism and no hyper-detailed fur or scales — this is paint, and it
  is read at thumbnail size.
· NO warm paper, parchment or sepia wash over the whole image. Warmth is an
  accent, not a filter, and the ground is not part of the painting.
· NO frames, borders, cards, vignettes, matting or paper background inside
  the frame. The object itself fills the frame edge to edge, corner to
  corner, and its outer edge is the frame's edge.
· Keep the subject the same subject and silhouette it already has. This is a
  restyle, not a redesign.

SIZE AND PLACEMENT — this is the part that goes wrong.
The subject fills its frame edge to edge, exactly as the reference does.
Do not shrink it onto a card or leave a polite margin.
· Do not rotate it or change the viewing angle.
· No cast shadow on the ground. The game draws its own.

BACKGROUND — read this before anything else. It matters more than the style.
Fill every pixel that is not the object itself with solid, flat, pure magenta
#FF00FF. Treat it as a green-screen: one flat chroma-key colour, edge to edge.
· EXACTLY #FF00FF — red 255, green 0, blue 255. Not pink, not rose, not dusty
  pink, not mauve, not a soft or tinted version of it. Only the true colour can
  be cut away cleanly; a near miss has to be flood-filled instead, and a flood
  fill eats any pale paint it can reach.
· NOT transparent. Transparency gets exported as a grey-and-white CHECKERBOARD
  and then baked into the artwork as though the squares were paint.
· NOT white, cream, black, parchment, paper, or any tinted or textured ground.
· The object must NOT sit on a card, panel, sheet, badge, frame or rectangle of
  any kind. The magenta must touch the outline of the object on every side.
· No drop shadow onto the background, and no vignette.
· The object itself must contain no magenta or hot pink.
· The dark, desaturated palette above is for the OBJECT. The ground is not
  part of the painting and is not toned down with it: it stays a vivid,
  eye-hurting #FF00FF however dark everything else is. Dusty rose, pale pink
  and mauve are the failure this whole clause is about.

OUTPUT — read this twice, it is where every previous attempt failed:
· ONE image, exactly 512 x 512 pixels — square (1:1).
  If your tool has an aspect-ratio control, set it to match. Returns have
  come back at the tool's default ratio before, which overrides this line —
  the setting wins, so change the setting.
· ONE object. Not two, not a comparison, not variants side by side, not a
  before-and-after pair.
· No frame, border, card, label, caption, arrow, annotation or drop shadow.

---

# crate-rate — Supply crate (rate)  (images/props/crate-rate.webp)

Paint ONE game sprite in a single square (1:1) image.
The attached reference is exactly what to paint, at exactly the size and
position it is drawn at. Match both.

WHAT IT IS: A supply crate: a square iron-banded strongbox of dark oak planks with riveted black-iron corners and a cold BLUE painted seal or band on its face. Square and flat-on. Its sibling is the same crate banded green, and the two must be tellable apart by the colour of the band alone.

LEAVE OUT WHAT THE GAME PAINTS LIVE. The game paints a blue bolt badge, a glowing rim and an HP number over the middle of the face, so keep the CENTRE plain and readable and put the detail at the edges.

STYLE — grim painted dark fantasy, like a plate from a gothic illustrated
bestiary or the key art of a dungeon crawler. Match this in every panel:
· INK FIRST. Heavy hand-drawn contour lines in near-black ink, jagged and
  confident, thick on the shadow side and thin on the lit side, with
  dry-brush breaks. The drawing must look DRAWN — scratchy linework showing
  through the paint.
· PAINTED, NOT RENDERED. Flat blocks of gouache-like paint inside the lines
  with visible brushwork, rough cel-style shadow shapes and a little grain.
  No airbrush, no smooth 3D shading, no plastic gloss.
· DESATURATED, LOW-KEY colour: bone, ash grey, dried blood, rust, bruise
  purple, swamp green, cold slate — with ONE hot accent per subject (ember
  orange, sickly witch-green, cold soul-blue, tarnished gold). Deep shadows
  that fall to black.
· HIGH CONTRAST and cold. The light comes from the UPPER LEFT. Chiaroscuro:
  most of every form in shadow, one edge picked out.
· Gothic, grotesque, worn: cracked bone, rusted iron, torn cloth, wet stone,
  candle-soot. Everything has been through something.
· Menacing rather than cute — but the SILHOUETTE stays readable at 40 px, so
  keep the big shapes simple and put the detail inside them.

AVOID — this is exactly how earlier attempts went wrong:
· NO cute, cozy, storybook, chibi or plush look. No rounded friendly faces,
  no button eyes, no smiles.
· NO candy-bright, saturated, neon or pastel colour. If it looks cheerful,
  it is wrong.
· NO glossy, plasticky, airbrushed mobile-game rendering. No smooth 3D
  volume, no bevelled edges, no lens flares, no rim-lit chrome.
· NO photorealism and no hyper-detailed fur or scales — this is paint, and it
  is read at thumbnail size.
· NO warm paper, parchment or sepia wash over the whole image. Warmth is an
  accent, not a filter, and the ground is not part of the painting.
· NO frames, borders, cards, vignettes, matting or paper background inside
  the frame. The object itself fills the frame edge to edge, corner to
  corner, and its outer edge is the frame's edge.
· Keep the subject the same subject and silhouette it already has. This is a
  restyle, not a redesign.

SIZE AND PLACEMENT — this is the part that goes wrong.
The subject fills its frame edge to edge, exactly as the reference does.
Do not shrink it onto a card or leave a polite margin.
· Do not rotate it or change the viewing angle.
· No cast shadow on the ground. The game draws its own.

BACKGROUND — read this before anything else. It matters more than the style.
Fill every pixel that is not the object itself with solid, flat, pure magenta
#FF00FF. Treat it as a green-screen: one flat chroma-key colour, edge to edge.
· EXACTLY #FF00FF — red 255, green 0, blue 255. Not pink, not rose, not dusty
  pink, not mauve, not a soft or tinted version of it. Only the true colour can
  be cut away cleanly; a near miss has to be flood-filled instead, and a flood
  fill eats any pale paint it can reach.
· NOT transparent. Transparency gets exported as a grey-and-white CHECKERBOARD
  and then baked into the artwork as though the squares were paint.
· NOT white, cream, black, parchment, paper, or any tinted or textured ground.
· The object must NOT sit on a card, panel, sheet, badge, frame or rectangle of
  any kind. The magenta must touch the outline of the object on every side.
· No drop shadow onto the background, and no vignette.
· The object itself must contain no magenta or hot pink.
· The dark, desaturated palette above is for the OBJECT. The ground is not
  part of the painting and is not toned down with it: it stays a vivid,
  eye-hurting #FF00FF however dark everything else is. Dusty rose, pale pink
  and mauve are the failure this whole clause is about.

OUTPUT — read this twice, it is where every previous attempt failed:
· ONE image, exactly 512 x 512 pixels — square (1:1).
  If your tool has an aspect-ratio control, set it to match. Returns have
  come back at the tool's default ratio before, which overrides this line —
  the setting wins, so change the setting.
· ONE object. Not two, not a comparison, not variants side by side, not a
  before-and-after pair.
· No frame, border, card, label, caption, arrow, annotation or drop shadow.

---

# barricade — Barricade block  (images/props/barricade.webp)

Paint ONE game sprite in a single square (1:1) image.
The attached reference is exactly what to paint, at exactly the size and
position it is drawn at. Match both.

WHAT IT IS: A barricade block: a rough wall of mortared dark stone with bone and rusted iron scraps set into it, seen flat-on. Fully opaque, edge to edge.

LEAVE OUT WHAT THE GAME PAINTS LIVE. The game paints hazard chevrons, a damage bar and an HP number over it, so keep it mid-tone and quiet — texture, not objects.

STYLE — grim painted dark fantasy, like a plate from a gothic illustrated
bestiary or the key art of a dungeon crawler. Match this in every panel:
· INK FIRST. Heavy hand-drawn contour lines in near-black ink, jagged and
  confident, thick on the shadow side and thin on the lit side, with
  dry-brush breaks. The drawing must look DRAWN — scratchy linework showing
  through the paint.
· PAINTED, NOT RENDERED. Flat blocks of gouache-like paint inside the lines
  with visible brushwork, rough cel-style shadow shapes and a little grain.
  No airbrush, no smooth 3D shading, no plastic gloss.
· DESATURATED, LOW-KEY colour: bone, ash grey, dried blood, rust, bruise
  purple, swamp green, cold slate — with ONE hot accent per subject (ember
  orange, sickly witch-green, cold soul-blue, tarnished gold). Deep shadows
  that fall to black.
· HIGH CONTRAST and cold. The light comes from the UPPER LEFT. Chiaroscuro:
  most of every form in shadow, one edge picked out.
· Gothic, grotesque, worn: cracked bone, rusted iron, torn cloth, wet stone,
  candle-soot. Everything has been through something.
· Menacing rather than cute — but the SILHOUETTE stays readable at 40 px, so
  keep the big shapes simple and put the detail inside them.

AVOID — this is exactly how earlier attempts went wrong:
· NO cute, cozy, storybook, chibi or plush look. No rounded friendly faces,
  no button eyes, no smiles.
· NO candy-bright, saturated, neon or pastel colour. If it looks cheerful,
  it is wrong.
· NO glossy, plasticky, airbrushed mobile-game rendering. No smooth 3D
  volume, no bevelled edges, no lens flares, no rim-lit chrome.
· NO photorealism and no hyper-detailed fur or scales — this is paint, and it
  is read at thumbnail size.
· NO warm paper, parchment or sepia wash over the whole image. Warmth is an
  accent, not a filter, and the ground is not part of the painting.
· NO frames, borders, cards, vignettes, matting or paper background inside
  the frame. The object itself fills the frame edge to edge, corner to
  corner, and its outer edge is the frame's edge.
· Keep the subject the same subject and silhouette it already has. This is a
  restyle, not a redesign.

SIZE AND PLACEMENT — this is the part that goes wrong.
The subject fills its frame edge to edge, exactly as the reference does.
Do not shrink it onto a card or leave a polite margin.
· Do not rotate it or change the viewing angle.
· No cast shadow on the ground. The game draws its own.

BACKGROUND: none. This image is FULLY OPAQUE from edge to edge — no
transparency, no checkerboard, no magenta anywhere.

SEAMLESSLY TILEABLE, HORIZONTALLY. This image is repeated end to end, so
the right edge must join the left edge with no visible seam, no matching
feature straddling the join, and no vignette or fade at either side. It
does NOT need to tile vertically.

OUTPUT — read this twice, it is where every previous attempt failed:
· ONE image, exactly 512 x 512 pixels — square (1:1).
  If your tool has an aspect-ratio control, set it to match. Returns have
  come back at the tool's default ratio before, which overrides this line —
  the setting wins, so change the setting.
· ONE object. Not two, not a comparison, not variants side by side, not a
  before-and-after pair.
· No frame, border, card, label, caption, arrow, annotation or drop shadow.

---

# boulder-1 — Boulder (1 of 3)  (images/props/boulder-1.webp)

Paint ONE game sprite in a single square (1:1) image.
The attached reference is exactly what to paint, at exactly the size and
position it is drawn at. Match both.

WHAT IT IS: An unbreakable boulder: one heavy irregular lump of dark grey rock, squat and wide, cracked, with a lit crown edge upper-left and deep shadow lower-right. NO metal, NO number, NO glow, nothing that could be read as a meter — the absence of a number IS the mechanic. Fills most of the frame.

STYLE — grim painted dark fantasy, like a plate from a gothic illustrated
bestiary or the key art of a dungeon crawler. Match this in every panel:
· INK FIRST. Heavy hand-drawn contour lines in near-black ink, jagged and
  confident, thick on the shadow side and thin on the lit side, with
  dry-brush breaks. The drawing must look DRAWN — scratchy linework showing
  through the paint.
· PAINTED, NOT RENDERED. Flat blocks of gouache-like paint inside the lines
  with visible brushwork, rough cel-style shadow shapes and a little grain.
  No airbrush, no smooth 3D shading, no plastic gloss.
· DESATURATED, LOW-KEY colour: bone, ash grey, dried blood, rust, bruise
  purple, swamp green, cold slate — with ONE hot accent per subject (ember
  orange, sickly witch-green, cold soul-blue, tarnished gold). Deep shadows
  that fall to black.
· HIGH CONTRAST and cold. The light comes from the UPPER LEFT. Chiaroscuro:
  most of every form in shadow, one edge picked out.
· Gothic, grotesque, worn: cracked bone, rusted iron, torn cloth, wet stone,
  candle-soot. Everything has been through something.
· Menacing rather than cute — but the SILHOUETTE stays readable at 40 px, so
  keep the big shapes simple and put the detail inside them.

AVOID — this is exactly how earlier attempts went wrong:
· NO cute, cozy, storybook, chibi or plush look. No rounded friendly faces,
  no button eyes, no smiles.
· NO candy-bright, saturated, neon or pastel colour. If it looks cheerful,
  it is wrong.
· NO glossy, plasticky, airbrushed mobile-game rendering. No smooth 3D
  volume, no bevelled edges, no lens flares, no rim-lit chrome.
· NO photorealism and no hyper-detailed fur or scales — this is paint, and it
  is read at thumbnail size.
· NO warm paper, parchment or sepia wash over the whole image. Warmth is an
  accent, not a filter, and the ground is not part of the painting.
· NO frames, borders, cards, vignettes, matting or paper background inside
  the frame. The object itself fills the frame edge to edge, corner to
  corner, and its outer edge is the frame's edge.
· Keep the subject the same subject and silhouette it already has. This is a
  restyle, not a redesign.

SIZE AND PLACEMENT — this is the part that goes wrong.
The subject fills its frame edge to edge, exactly as the reference does.
Do not shrink it onto a card or leave a polite margin.
· Do not rotate it or change the viewing angle.
· No cast shadow on the ground. The game draws its own.

BACKGROUND — read this before anything else. It matters more than the style.
Fill every pixel that is not the object itself with solid, flat, pure magenta
#FF00FF. Treat it as a green-screen: one flat chroma-key colour, edge to edge.
· EXACTLY #FF00FF — red 255, green 0, blue 255. Not pink, not rose, not dusty
  pink, not mauve, not a soft or tinted version of it. Only the true colour can
  be cut away cleanly; a near miss has to be flood-filled instead, and a flood
  fill eats any pale paint it can reach.
· NOT transparent. Transparency gets exported as a grey-and-white CHECKERBOARD
  and then baked into the artwork as though the squares were paint.
· NOT white, cream, black, parchment, paper, or any tinted or textured ground.
· The object must NOT sit on a card, panel, sheet, badge, frame or rectangle of
  any kind. The magenta must touch the outline of the object on every side.
· No drop shadow onto the background, and no vignette.
· The object itself must contain no magenta or hot pink.
· The dark, desaturated palette above is for the OBJECT. The ground is not
  part of the painting and is not toned down with it: it stays a vivid,
  eye-hurting #FF00FF however dark everything else is. Dusty rose, pale pink
  and mauve are the failure this whole clause is about.

OUTPUT — read this twice, it is where every previous attempt failed:
· ONE image, exactly 512 x 512 pixels — square (1:1).
  If your tool has an aspect-ratio control, set it to match. Returns have
  come back at the tool's default ratio before, which overrides this line —
  the setting wins, so change the setting.
· ONE object. Not two, not a comparison, not variants side by side, not a
  before-and-after pair.
· No frame, border, card, label, caption, arrow, annotation or drop shadow.

---

# boulder-2 — Boulder (2 of 3)  (images/props/boulder-2.webp)

Paint ONE game sprite in a single square (1:1) image.
The attached reference is exactly what to paint, at exactly the size and
position it is drawn at. Match both.

WHAT IT IS: An unbreakable boulder: one heavy irregular lump of dark grey rock, taller than it is wide with a split down one side, cracked, with a lit crown edge upper-left and deep shadow lower-right. NO metal, NO number, NO glow, nothing that could be read as a meter. Fills most of the frame.

STYLE — grim painted dark fantasy, like a plate from a gothic illustrated
bestiary or the key art of a dungeon crawler. Match this in every panel:
· INK FIRST. Heavy hand-drawn contour lines in near-black ink, jagged and
  confident, thick on the shadow side and thin on the lit side, with
  dry-brush breaks. The drawing must look DRAWN — scratchy linework showing
  through the paint.
· PAINTED, NOT RENDERED. Flat blocks of gouache-like paint inside the lines
  with visible brushwork, rough cel-style shadow shapes and a little grain.
  No airbrush, no smooth 3D shading, no plastic gloss.
· DESATURATED, LOW-KEY colour: bone, ash grey, dried blood, rust, bruise
  purple, swamp green, cold slate — with ONE hot accent per subject (ember
  orange, sickly witch-green, cold soul-blue, tarnished gold). Deep shadows
  that fall to black.
· HIGH CONTRAST and cold. The light comes from the UPPER LEFT. Chiaroscuro:
  most of every form in shadow, one edge picked out.
· Gothic, grotesque, worn: cracked bone, rusted iron, torn cloth, wet stone,
  candle-soot. Everything has been through something.
· Menacing rather than cute — but the SILHOUETTE stays readable at 40 px, so
  keep the big shapes simple and put the detail inside them.

AVOID — this is exactly how earlier attempts went wrong:
· NO cute, cozy, storybook, chibi or plush look. No rounded friendly faces,
  no button eyes, no smiles.
· NO candy-bright, saturated, neon or pastel colour. If it looks cheerful,
  it is wrong.
· NO glossy, plasticky, airbrushed mobile-game rendering. No smooth 3D
  volume, no bevelled edges, no lens flares, no rim-lit chrome.
· NO photorealism and no hyper-detailed fur or scales — this is paint, and it
  is read at thumbnail size.
· NO warm paper, parchment or sepia wash over the whole image. Warmth is an
  accent, not a filter, and the ground is not part of the painting.
· NO frames, borders, cards, vignettes, matting or paper background inside
  the frame. The object itself fills the frame edge to edge, corner to
  corner, and its outer edge is the frame's edge.
· Keep the subject the same subject and silhouette it already has. This is a
  restyle, not a redesign.

SIZE AND PLACEMENT — this is the part that goes wrong.
The subject fills its frame edge to edge, exactly as the reference does.
Do not shrink it onto a card or leave a polite margin.
· Do not rotate it or change the viewing angle.
· No cast shadow on the ground. The game draws its own.

BACKGROUND — read this before anything else. It matters more than the style.
Fill every pixel that is not the object itself with solid, flat, pure magenta
#FF00FF. Treat it as a green-screen: one flat chroma-key colour, edge to edge.
· EXACTLY #FF00FF — red 255, green 0, blue 255. Not pink, not rose, not dusty
  pink, not mauve, not a soft or tinted version of it. Only the true colour can
  be cut away cleanly; a near miss has to be flood-filled instead, and a flood
  fill eats any pale paint it can reach.
· NOT transparent. Transparency gets exported as a grey-and-white CHECKERBOARD
  and then baked into the artwork as though the squares were paint.
· NOT white, cream, black, parchment, paper, or any tinted or textured ground.
· The object must NOT sit on a card, panel, sheet, badge, frame or rectangle of
  any kind. The magenta must touch the outline of the object on every side.
· No drop shadow onto the background, and no vignette.
· The object itself must contain no magenta or hot pink.
· The dark, desaturated palette above is for the OBJECT. The ground is not
  part of the painting and is not toned down with it: it stays a vivid,
  eye-hurting #FF00FF however dark everything else is. Dusty rose, pale pink
  and mauve are the failure this whole clause is about.

OUTPUT — read this twice, it is where every previous attempt failed:
· ONE image, exactly 512 x 512 pixels — square (1:1).
  If your tool has an aspect-ratio control, set it to match. Returns have
  come back at the tool's default ratio before, which overrides this line —
  the setting wins, so change the setting.
· ONE object. Not two, not a comparison, not variants side by side, not a
  before-and-after pair.
· No frame, border, card, label, caption, arrow, annotation or drop shadow.

---

# boulder-3 — Boulder (3 of 3)  (images/props/boulder-3.webp)

Paint ONE game sprite in a single square (1:1) image.
The attached reference is exactly what to paint, at exactly the size and
position it is drawn at. Match both.

WHAT IT IS: An unbreakable boulder: one heavy irregular lump of dark grey rock, rounded with a flat top, cracked, with a lit crown edge upper-left and deep shadow lower-right. NO metal, NO number, NO glow, nothing that could be read as a meter. Fills most of the frame.

STYLE — grim painted dark fantasy, like a plate from a gothic illustrated
bestiary or the key art of a dungeon crawler. Match this in every panel:
· INK FIRST. Heavy hand-drawn contour lines in near-black ink, jagged and
  confident, thick on the shadow side and thin on the lit side, with
  dry-brush breaks. The drawing must look DRAWN — scratchy linework showing
  through the paint.
· PAINTED, NOT RENDERED. Flat blocks of gouache-like paint inside the lines
  with visible brushwork, rough cel-style shadow shapes and a little grain.
  No airbrush, no smooth 3D shading, no plastic gloss.
· DESATURATED, LOW-KEY colour: bone, ash grey, dried blood, rust, bruise
  purple, swamp green, cold slate — with ONE hot accent per subject (ember
  orange, sickly witch-green, cold soul-blue, tarnished gold). Deep shadows
  that fall to black.
· HIGH CONTRAST and cold. The light comes from the UPPER LEFT. Chiaroscuro:
  most of every form in shadow, one edge picked out.
· Gothic, grotesque, worn: cracked bone, rusted iron, torn cloth, wet stone,
  candle-soot. Everything has been through something.
· Menacing rather than cute — but the SILHOUETTE stays readable at 40 px, so
  keep the big shapes simple and put the detail inside them.

AVOID — this is exactly how earlier attempts went wrong:
· NO cute, cozy, storybook, chibi or plush look. No rounded friendly faces,
  no button eyes, no smiles.
· NO candy-bright, saturated, neon or pastel colour. If it looks cheerful,
  it is wrong.
· NO glossy, plasticky, airbrushed mobile-game rendering. No smooth 3D
  volume, no bevelled edges, no lens flares, no rim-lit chrome.
· NO photorealism and no hyper-detailed fur or scales — this is paint, and it
  is read at thumbnail size.
· NO warm paper, parchment or sepia wash over the whole image. Warmth is an
  accent, not a filter, and the ground is not part of the painting.
· NO frames, borders, cards, vignettes, matting or paper background inside
  the frame. The object itself fills the frame edge to edge, corner to
  corner, and its outer edge is the frame's edge.
· Keep the subject the same subject and silhouette it already has. This is a
  restyle, not a redesign.

SIZE AND PLACEMENT — this is the part that goes wrong.
The subject fills its frame edge to edge, exactly as the reference does.
Do not shrink it onto a card or leave a polite margin.
· Do not rotate it or change the viewing angle.
· No cast shadow on the ground. The game draws its own.

BACKGROUND — read this before anything else. It matters more than the style.
Fill every pixel that is not the object itself with solid, flat, pure magenta
#FF00FF. Treat it as a green-screen: one flat chroma-key colour, edge to edge.
· EXACTLY #FF00FF — red 255, green 0, blue 255. Not pink, not rose, not dusty
  pink, not mauve, not a soft or tinted version of it. Only the true colour can
  be cut away cleanly; a near miss has to be flood-filled instead, and a flood
  fill eats any pale paint it can reach.
· NOT transparent. Transparency gets exported as a grey-and-white CHECKERBOARD
  and then baked into the artwork as though the squares were paint.
· NOT white, cream, black, parchment, paper, or any tinted or textured ground.
· The object must NOT sit on a card, panel, sheet, badge, frame or rectangle of
  any kind. The magenta must touch the outline of the object on every side.
· No drop shadow onto the background, and no vignette.
· The object itself must contain no magenta or hot pink.
· The dark, desaturated palette above is for the OBJECT. The ground is not
  part of the painting and is not toned down with it: it stays a vivid,
  eye-hurting #FF00FF however dark everything else is. Dusty rose, pale pink
  and mauve are the failure this whole clause is about.

OUTPUT — read this twice, it is where every previous attempt failed:
· ONE image, exactly 512 x 512 pixels — square (1:1).
  If your tool has an aspect-ratio control, set it to match. Returns have
  come back at the tool's default ratio before, which overrides this line —
  the setting wins, so change the setting.
· ONE object. Not two, not a comparison, not variants side by side, not a
  before-and-after pair.
· No frame, border, card, label, caption, arrow, annotation or drop shadow.

---

# barrel — Powder keg  (images/props/barrel.webp)

Paint ONE game sprite in a single square (1:1) image.
The attached reference is exactly what to paint, at exactly the size and
position it is drawn at. Match both.

WHAT IT IS: A powder keg: a dark riveted black-iron drum standing upright, four fifths as wide as it is tall, with two dull dried-blood-red bands and a crude skull-and-fuse stencil on its face. Intact state only. Centred, the drum filling the frame's full height.

LEAVE OUT WHAT THE GAME PAINTS LIVE. The game paints the damage cracks and the lit strobe over it, so paint it whole and unlit.

STYLE — grim painted dark fantasy, like a plate from a gothic illustrated
bestiary or the key art of a dungeon crawler. Match this in every panel:
· INK FIRST. Heavy hand-drawn contour lines in near-black ink, jagged and
  confident, thick on the shadow side and thin on the lit side, with
  dry-brush breaks. The drawing must look DRAWN — scratchy linework showing
  through the paint.
· PAINTED, NOT RENDERED. Flat blocks of gouache-like paint inside the lines
  with visible brushwork, rough cel-style shadow shapes and a little grain.
  No airbrush, no smooth 3D shading, no plastic gloss.
· DESATURATED, LOW-KEY colour: bone, ash grey, dried blood, rust, bruise
  purple, swamp green, cold slate — with ONE hot accent per subject (ember
  orange, sickly witch-green, cold soul-blue, tarnished gold). Deep shadows
  that fall to black.
· HIGH CONTRAST and cold. The light comes from the UPPER LEFT. Chiaroscuro:
  most of every form in shadow, one edge picked out.
· Gothic, grotesque, worn: cracked bone, rusted iron, torn cloth, wet stone,
  candle-soot. Everything has been through something.
· Menacing rather than cute — but the SILHOUETTE stays readable at 40 px, so
  keep the big shapes simple and put the detail inside them.

AVOID — this is exactly how earlier attempts went wrong:
· NO cute, cozy, storybook, chibi or plush look. No rounded friendly faces,
  no button eyes, no smiles.
· NO candy-bright, saturated, neon or pastel colour. If it looks cheerful,
  it is wrong.
· NO glossy, plasticky, airbrushed mobile-game rendering. No smooth 3D
  volume, no bevelled edges, no lens flares, no rim-lit chrome.
· NO photorealism and no hyper-detailed fur or scales — this is paint, and it
  is read at thumbnail size.
· NO warm paper, parchment or sepia wash over the whole image. Warmth is an
  accent, not a filter, and the ground is not part of the painting.
· NO frames, borders, cards, vignettes, matting or paper background behind
  the drawing. Nothing but flat magenta behind it, right up to its outline.
· Keep the subject the same subject and silhouette it already has. This is a
  restyle, not a redesign.

SIZE AND PLACEMENT — this is the part that goes wrong.
Do not enlarge it to fill the frame. The reference leaves air around the
subject and that air is not waste — it is where the things drawn live around
it go. Keep the subject the same fraction of the frame that the reference
has it, in the same place.
· Do not rotate it or change the viewing angle.
· No cast shadow on the ground. The game draws its own.

BACKGROUND — read this before anything else. It matters more than the style.
Fill every pixel that is not the object itself with solid, flat, pure magenta
#FF00FF. Treat it as a green-screen: one flat chroma-key colour, edge to edge.
· EXACTLY #FF00FF — red 255, green 0, blue 255. Not pink, not rose, not dusty
  pink, not mauve, not a soft or tinted version of it. Only the true colour can
  be cut away cleanly; a near miss has to be flood-filled instead, and a flood
  fill eats any pale paint it can reach.
· NOT transparent. Transparency gets exported as a grey-and-white CHECKERBOARD
  and then baked into the artwork as though the squares were paint.
· NOT white, cream, black, parchment, paper, or any tinted or textured ground.
· The object must NOT sit on a card, panel, sheet, badge, frame or rectangle of
  any kind. The magenta must touch the outline of the object on every side.
· No drop shadow onto the background, and no vignette.
· The object itself must contain no magenta or hot pink.
· The dark, desaturated palette above is for the OBJECT. The ground is not
  part of the painting and is not toned down with it: it stays a vivid,
  eye-hurting #FF00FF however dark everything else is. Dusty rose, pale pink
  and mauve are the failure this whole clause is about.

OUTPUT — read this twice, it is where every previous attempt failed:
· ONE image, exactly 512 x 512 pixels — square (1:1).
  If your tool has an aspect-ratio control, set it to match. Returns have
  come back at the tool's default ratio before, which overrides this line —
  the setting wins, so change the setting.
· ONE object. Not two, not a comparison, not variants side by side, not a
  before-and-after pair.
· No frame, border, card, label, caption, arrow, annotation or drop shadow.

---

# pillar — Divider pillar  (images/props/pillar.webp)

Paint ONE game sprite in a single portrait, 1:2.22 image.
The attached reference is exactly what to paint, at exactly the size and
position it is drawn at. Match both.

WHAT IT IS: A divider pillar: a tall iron post with heavy steel caps top and bottom, its body striped in diagonal black and dull-yellow hazard chevrons, scarred and rusted, seen straight on. Upright, filling the frame's full height, the caps a little wider than the shaft.

LEAVE OUT WHAT THE GAME PAINTS LIVE. NO lamp on top and NO glow — the beacon and the red warning are painted live.

STYLE — grim painted dark fantasy, like a plate from a gothic illustrated
bestiary or the key art of a dungeon crawler. Match this in every panel:
· INK FIRST. Heavy hand-drawn contour lines in near-black ink, jagged and
  confident, thick on the shadow side and thin on the lit side, with
  dry-brush breaks. The drawing must look DRAWN — scratchy linework showing
  through the paint.
· PAINTED, NOT RENDERED. Flat blocks of gouache-like paint inside the lines
  with visible brushwork, rough cel-style shadow shapes and a little grain.
  No airbrush, no smooth 3D shading, no plastic gloss.
· DESATURATED, LOW-KEY colour: bone, ash grey, dried blood, rust, bruise
  purple, swamp green, cold slate — with ONE hot accent per subject (ember
  orange, sickly witch-green, cold soul-blue, tarnished gold). Deep shadows
  that fall to black.
· HIGH CONTRAST and cold. The light comes from the UPPER LEFT. Chiaroscuro:
  most of every form in shadow, one edge picked out.
· Gothic, grotesque, worn: cracked bone, rusted iron, torn cloth, wet stone,
  candle-soot. Everything has been through something.
· Menacing rather than cute — but the SILHOUETTE stays readable at 40 px, so
  keep the big shapes simple and put the detail inside them.

AVOID — this is exactly how earlier attempts went wrong:
· NO cute, cozy, storybook, chibi or plush look. No rounded friendly faces,
  no button eyes, no smiles.
· NO candy-bright, saturated, neon or pastel colour. If it looks cheerful,
  it is wrong.
· NO glossy, plasticky, airbrushed mobile-game rendering. No smooth 3D
  volume, no bevelled edges, no lens flares, no rim-lit chrome.
· NO photorealism and no hyper-detailed fur or scales — this is paint, and it
  is read at thumbnail size.
· NO warm paper, parchment or sepia wash over the whole image. Warmth is an
  accent, not a filter, and the ground is not part of the painting.
· NO frames, borders, cards, vignettes, matting or paper background inside
  the frame. The object itself fills the frame edge to edge, corner to
  corner, and its outer edge is the frame's edge.
· Keep the subject the same subject and silhouette it already has. This is a
  restyle, not a redesign.

SIZE AND PLACEMENT — this is the part that goes wrong.
The subject fills its frame edge to edge, exactly as the reference does.
Do not shrink it onto a card or leave a polite margin.
· Do not rotate it or change the viewing angle.
· No cast shadow on the ground. The game draws its own.

BACKGROUND — read this before anything else. It matters more than the style.
Fill every pixel that is not the object itself with solid, flat, pure magenta
#FF00FF. Treat it as a green-screen: one flat chroma-key colour, edge to edge.
· EXACTLY #FF00FF — red 255, green 0, blue 255. Not pink, not rose, not dusty
  pink, not mauve, not a soft or tinted version of it. Only the true colour can
  be cut away cleanly; a near miss has to be flood-filled instead, and a flood
  fill eats any pale paint it can reach.
· NOT transparent. Transparency gets exported as a grey-and-white CHECKERBOARD
  and then baked into the artwork as though the squares were paint.
· NOT white, cream, black, parchment, paper, or any tinted or textured ground.
· The object must NOT sit on a card, panel, sheet, badge, frame or rectangle of
  any kind. The magenta must touch the outline of the object on every side.
· No drop shadow onto the background, and no vignette.
· The object itself must contain no magenta or hot pink.
· The dark, desaturated palette above is for the OBJECT. The ground is not
  part of the painting and is not toned down with it: it stays a vivid,
  eye-hurting #FF00FF however dark everything else is. Dusty rose, pale pink
  and mauve are the failure this whole clause is about.

OUTPUT — read this twice, it is where every previous attempt failed:
· ONE image, exactly 288 x 640 pixels — portrait, 1:2.22.
  If your tool has an aspect-ratio control, set it to match. Returns have
  come back at the tool's default ratio before, which overrides this line —
  the setting wins, so change the setting.
· ONE object. Not two, not a comparison, not variants side by side, not a
  before-and-after pair.
· No frame, border, card, label, caption, arrow, annotation or drop shadow.

---

# coin — Coin  (images/props/coin.webp)

Paint ONE game sprite in a single square (1:1) image.
The attached reference is exactly what to paint, at exactly the size and
position it is drawn at. Match both.

WHAT IT IS: A coin pickup: a face-on tarnished gold coin with a grim skull or sigil embossed and a worn, notched edge. It must be round and face-on — the game spins it by squashing it sideways. Fills the frame.

STYLE — grim painted dark fantasy, like a plate from a gothic illustrated
bestiary or the key art of a dungeon crawler. Match this in every panel:
· INK FIRST. Heavy hand-drawn contour lines in near-black ink, jagged and
  confident, thick on the shadow side and thin on the lit side, with
  dry-brush breaks. The drawing must look DRAWN — scratchy linework showing
  through the paint.
· PAINTED, NOT RENDERED. Flat blocks of gouache-like paint inside the lines
  with visible brushwork, rough cel-style shadow shapes and a little grain.
  No airbrush, no smooth 3D shading, no plastic gloss.
· DESATURATED, LOW-KEY colour: bone, ash grey, dried blood, rust, bruise
  purple, swamp green, cold slate — with ONE hot accent per subject (ember
  orange, sickly witch-green, cold soul-blue, tarnished gold). Deep shadows
  that fall to black.
· HIGH CONTRAST and cold. The light comes from the UPPER LEFT. Chiaroscuro:
  most of every form in shadow, one edge picked out.
· Gothic, grotesque, worn: cracked bone, rusted iron, torn cloth, wet stone,
  candle-soot. Everything has been through something.
· Menacing rather than cute — but the SILHOUETTE stays readable at 40 px, so
  keep the big shapes simple and put the detail inside them.

AVOID — this is exactly how earlier attempts went wrong:
· NO cute, cozy, storybook, chibi or plush look. No rounded friendly faces,
  no button eyes, no smiles.
· NO candy-bright, saturated, neon or pastel colour. If it looks cheerful,
  it is wrong.
· NO glossy, plasticky, airbrushed mobile-game rendering. No smooth 3D
  volume, no bevelled edges, no lens flares, no rim-lit chrome.
· NO photorealism and no hyper-detailed fur or scales — this is paint, and it
  is read at thumbnail size.
· NO warm paper, parchment or sepia wash over the whole image. Warmth is an
  accent, not a filter, and the ground is not part of the painting.
· NO frames, borders, cards, vignettes, matting or paper background inside
  the frame. The object itself fills the frame edge to edge, corner to
  corner, and its outer edge is the frame's edge.
· Keep the subject the same subject and silhouette it already has. This is a
  restyle, not a redesign.

SIZE AND PLACEMENT — this is the part that goes wrong.
The subject fills its frame edge to edge, exactly as the reference does.
Do not shrink it onto a card or leave a polite margin.
· Do not rotate it or change the viewing angle.
· No cast shadow on the ground. The game draws its own.

BACKGROUND — read this before anything else. It matters more than the style.
Fill every pixel that is not the object itself with solid, flat, pure magenta
#FF00FF. Treat it as a green-screen: one flat chroma-key colour, edge to edge.
· EXACTLY #FF00FF — red 255, green 0, blue 255. Not pink, not rose, not dusty
  pink, not mauve, not a soft or tinted version of it. Only the true colour can
  be cut away cleanly; a near miss has to be flood-filled instead, and a flood
  fill eats any pale paint it can reach.
· NOT transparent. Transparency gets exported as a grey-and-white CHECKERBOARD
  and then baked into the artwork as though the squares were paint.
· NOT white, cream, black, parchment, paper, or any tinted or textured ground.
· The object must NOT sit on a card, panel, sheet, badge, frame or rectangle of
  any kind. The magenta must touch the outline of the object on every side.
· No drop shadow onto the background, and no vignette.
· The object itself must contain no magenta or hot pink.
· The dark, desaturated palette above is for the OBJECT. The ground is not
  part of the painting and is not toned down with it: it stays a vivid,
  eye-hurting #FF00FF however dark everything else is. Dusty rose, pale pink
  and mauve are the failure this whole clause is about.

OUTPUT — read this twice, it is where every previous attempt failed:
· ONE image, exactly 512 x 512 pixels — square (1:1).
  If your tool has an aspect-ratio control, set it to match. Returns have
  come back at the tool's default ratio before, which overrides this line —
  the setting wins, so change the setting.
· ONE object. Not two, not a comparison, not variants side by side, not a
  before-and-after pair.
· No frame, border, card, label, caption, arrow, annotation or drop shadow.

---

# weapon-box — Weapon case (shut)  (images/props/weapon-box.webp)

Paint ONE game sprite in a single square (1:1) image.
The attached reference is exactly what to paint, at exactly the size and
position it is drawn at. Match both.

WHAT IT IS: A weapon case, shut and dead: a square armoured strongbox of cold grey gun-steel, flat-on, its face a heavy riveted plate recessed inside a thick bevelled frame, with dark sealed seams and scuffed dull-blue paint. NOTHING glows, nothing is warm — it is inert metal, and that is the read. Square and flat-on, filling the frame.

LEAVE OUT WHAT THE GAME PAINTS LIVE. The game paints the weapon glyph and a heavy cross-brace over the middle of the face, so keep the CENTRE plain, flat and mid-tone and put the detail — rivets, bevels, scuffs — around the edges.

STYLE — grim painted dark fantasy, like a plate from a gothic illustrated
bestiary or the key art of a dungeon crawler. Match this in every panel:
· INK FIRST. Heavy hand-drawn contour lines in near-black ink, jagged and
  confident, thick on the shadow side and thin on the lit side, with
  dry-brush breaks. The drawing must look DRAWN — scratchy linework showing
  through the paint.
· PAINTED, NOT RENDERED. Flat blocks of gouache-like paint inside the lines
  with visible brushwork, rough cel-style shadow shapes and a little grain.
  No airbrush, no smooth 3D shading, no plastic gloss.
· DESATURATED, LOW-KEY colour: bone, ash grey, dried blood, rust, bruise
  purple, swamp green, cold slate — with ONE hot accent per subject (ember
  orange, sickly witch-green, cold soul-blue, tarnished gold). Deep shadows
  that fall to black.
· HIGH CONTRAST and cold. The light comes from the UPPER LEFT. Chiaroscuro:
  most of every form in shadow, one edge picked out.
· Gothic, grotesque, worn: cracked bone, rusted iron, torn cloth, wet stone,
  candle-soot. Everything has been through something.
· Menacing rather than cute — but the SILHOUETTE stays readable at 40 px, so
  keep the big shapes simple and put the detail inside them.

AVOID — this is exactly how earlier attempts went wrong:
· NO cute, cozy, storybook, chibi or plush look. No rounded friendly faces,
  no button eyes, no smiles.
· NO candy-bright, saturated, neon or pastel colour. If it looks cheerful,
  it is wrong.
· NO glossy, plasticky, airbrushed mobile-game rendering. No smooth 3D
  volume, no bevelled edges, no lens flares, no rim-lit chrome.
· NO photorealism and no hyper-detailed fur or scales — this is paint, and it
  is read at thumbnail size.
· NO warm paper, parchment or sepia wash over the whole image. Warmth is an
  accent, not a filter, and the ground is not part of the painting.
· NO frames, borders, cards, vignettes, matting or paper background inside
  the frame. The object itself fills the frame edge to edge, corner to
  corner, and its outer edge is the frame's edge.
· Keep the subject the same subject and silhouette it already has. This is a
  restyle, not a redesign.

SIZE AND PLACEMENT — this is the part that goes wrong.
The subject fills its frame edge to edge, exactly as the reference does.
Do not shrink it onto a card or leave a polite margin.
· Do not rotate it or change the viewing angle.
· No cast shadow on the ground. The game draws its own.

BACKGROUND — read this before anything else. It matters more than the style.
Fill every pixel that is not the object itself with solid, flat, pure magenta
#FF00FF. Treat it as a green-screen: one flat chroma-key colour, edge to edge.
· EXACTLY #FF00FF — red 255, green 0, blue 255. Not pink, not rose, not dusty
  pink, not mauve, not a soft or tinted version of it. Only the true colour can
  be cut away cleanly; a near miss has to be flood-filled instead, and a flood
  fill eats any pale paint it can reach.
· NOT transparent. Transparency gets exported as a grey-and-white CHECKERBOARD
  and then baked into the artwork as though the squares were paint.
· NOT white, cream, black, parchment, paper, or any tinted or textured ground.
· The object must NOT sit on a card, panel, sheet, badge, frame or rectangle of
  any kind. The magenta must touch the outline of the object on every side.
· No drop shadow onto the background, and no vignette.
· The object itself must contain no magenta or hot pink.
· The dark, desaturated palette above is for the OBJECT. The ground is not
  part of the painting and is not toned down with it: it stays a vivid,
  eye-hurting #FF00FF however dark everything else is. Dusty rose, pale pink
  and mauve are the failure this whole clause is about.

OUTPUT — read this twice, it is where every previous attempt failed:
· ONE image, exactly 512 x 512 pixels — square (1:1).
  If your tool has an aspect-ratio control, set it to match. Returns have
  come back at the tool's default ratio before, which overrides this line —
  the setting wins, so change the setting.
· ONE object. Not two, not a comparison, not variants side by side, not a
  before-and-after pair.
· No frame, border, card, label, caption, arrow, annotation or drop shadow.

---

# weapon-box-open — Weapon case (open)  (images/props/weapon-box-open.webp)

Paint ONE game sprite in a single square (1:1) image.
The attached reference is exactly what to paint, at exactly the size and
position it is drawn at. Match both.

WHAT IT IS: The same square armoured strongbox, now UNSEALED and lit from within: the dark steel is banded and edged in hot brass and worn gold, its seams cracked open with warm amber light spilling out, the recessed face plate glowing a rich lamp-gold. Read as a PRIZE across a whole screen — warm, bright, obviously changed from the cold shut one. Square and flat-on, filling the frame.

LEAVE OUT WHAT THE GAME PAINTS LIVE. The game paints the weapon glyph in near-black over the middle of the face, plus damage cracks, a pulsing halo and an expanding ring, so keep the CENTRE plain, bright and readable and put the detail around the edges.

STYLE — grim painted dark fantasy, like a plate from a gothic illustrated
bestiary or the key art of a dungeon crawler. Match this in every panel:
· INK FIRST. Heavy hand-drawn contour lines in near-black ink, jagged and
  confident, thick on the shadow side and thin on the lit side, with
  dry-brush breaks. The drawing must look DRAWN — scratchy linework showing
  through the paint.
· PAINTED, NOT RENDERED. Flat blocks of gouache-like paint inside the lines
  with visible brushwork, rough cel-style shadow shapes and a little grain.
  No airbrush, no smooth 3D shading, no plastic gloss.
· DESATURATED, LOW-KEY colour: bone, ash grey, dried blood, rust, bruise
  purple, swamp green, cold slate — with ONE hot accent per subject (ember
  orange, sickly witch-green, cold soul-blue, tarnished gold). Deep shadows
  that fall to black.
· HIGH CONTRAST and cold. The light comes from the UPPER LEFT. Chiaroscuro:
  most of every form in shadow, one edge picked out.
· Gothic, grotesque, worn: cracked bone, rusted iron, torn cloth, wet stone,
  candle-soot. Everything has been through something.
· Menacing rather than cute — but the SILHOUETTE stays readable at 40 px, so
  keep the big shapes simple and put the detail inside them.

AVOID — this is exactly how earlier attempts went wrong:
· NO cute, cozy, storybook, chibi or plush look. No rounded friendly faces,
  no button eyes, no smiles.
· NO candy-bright, saturated, neon or pastel colour. If it looks cheerful,
  it is wrong.
· NO glossy, plasticky, airbrushed mobile-game rendering. No smooth 3D
  volume, no bevelled edges, no lens flares, no rim-lit chrome.
· NO photorealism and no hyper-detailed fur or scales — this is paint, and it
  is read at thumbnail size.
· NO warm paper, parchment or sepia wash over the whole image. Warmth is an
  accent, not a filter, and the ground is not part of the painting.
· NO frames, borders, cards, vignettes, matting or paper background inside
  the frame. The object itself fills the frame edge to edge, corner to
  corner, and its outer edge is the frame's edge.
· Keep the subject the same subject and silhouette it already has. This is a
  restyle, not a redesign.

SIZE AND PLACEMENT — this is the part that goes wrong.
The subject fills its frame edge to edge, exactly as the reference does.
Do not shrink it onto a card or leave a polite margin.
· Do not rotate it or change the viewing angle.
· No cast shadow on the ground. The game draws its own.

BACKGROUND — read this before anything else. It matters more than the style.
Fill every pixel that is not the object itself with solid, flat, pure magenta
#FF00FF. Treat it as a green-screen: one flat chroma-key colour, edge to edge.
· EXACTLY #FF00FF — red 255, green 0, blue 255. Not pink, not rose, not dusty
  pink, not mauve, not a soft or tinted version of it. Only the true colour can
  be cut away cleanly; a near miss has to be flood-filled instead, and a flood
  fill eats any pale paint it can reach.
· NOT transparent. Transparency gets exported as a grey-and-white CHECKERBOARD
  and then baked into the artwork as though the squares were paint.
· NOT white, cream, black, parchment, paper, or any tinted or textured ground.
· The object must NOT sit on a card, panel, sheet, badge, frame or rectangle of
  any kind. The magenta must touch the outline of the object on every side.
· No drop shadow onto the background, and no vignette.
· The object itself must contain no magenta or hot pink.
· The dark, desaturated palette above is for the OBJECT. The ground is not
  part of the painting and is not toned down with it: it stays a vivid,
  eye-hurting #FF00FF however dark everything else is. Dusty rose, pale pink
  and mauve are the failure this whole clause is about.

OUTPUT — read this twice, it is where every previous attempt failed:
· ONE image, exactly 512 x 512 pixels — square (1:1).
  If your tool has an aspect-ratio control, set it to match. Returns have
  come back at the tool's default ratio before, which overrides this line —
  the setting wins, so change the setting.
· ONE object. Not two, not a comparison, not variants side by side, not a
  before-and-after pair.
· No frame, border, card, label, caption, arrow, annotation or drop shadow.

---

# guard-plate — Weapon-case armour plate  (images/props/guard-plate.webp)

Paint ONE game sprite in a single square (1:1) image.
The attached reference is exactly what to paint, at exactly the size and
position it is drawn at. Match both.

WHAT IT IS: A bolted-on armour plate: a slab of riveted grey-blue battleship steel seen flat-on, its face crossed by two rows of heavy dome rivets, scuffed and streaked with rust runs from the rivet heads. Two of these stand EDGE TO EDGE over the case they protect, so the left and right edges are clean vertical panel edges — a plate, not a crate. Square-ish and flat-on, filling the frame.

LEAVE OUT WHAT THE GAME PAINTS LIVE. The game darkens and reddens the whole plate as it is shot and flashes it white on every hit, so paint it INTACT and evenly lit — no cracks, no holes, no damage of its own.

STYLE — grim painted dark fantasy, like a plate from a gothic illustrated
bestiary or the key art of a dungeon crawler. Match this in every panel:
· INK FIRST. Heavy hand-drawn contour lines in near-black ink, jagged and
  confident, thick on the shadow side and thin on the lit side, with
  dry-brush breaks. The drawing must look DRAWN — scratchy linework showing
  through the paint.
· PAINTED, NOT RENDERED. Flat blocks of gouache-like paint inside the lines
  with visible brushwork, rough cel-style shadow shapes and a little grain.
  No airbrush, no smooth 3D shading, no plastic gloss.
· DESATURATED, LOW-KEY colour: bone, ash grey, dried blood, rust, bruise
  purple, swamp green, cold slate — with ONE hot accent per subject (ember
  orange, sickly witch-green, cold soul-blue, tarnished gold). Deep shadows
  that fall to black.
· HIGH CONTRAST and cold. The light comes from the UPPER LEFT. Chiaroscuro:
  most of every form in shadow, one edge picked out.
· Gothic, grotesque, worn: cracked bone, rusted iron, torn cloth, wet stone,
  candle-soot. Everything has been through something.
· Menacing rather than cute — but the SILHOUETTE stays readable at 40 px, so
  keep the big shapes simple and put the detail inside them.

AVOID — this is exactly how earlier attempts went wrong:
· NO cute, cozy, storybook, chibi or plush look. No rounded friendly faces,
  no button eyes, no smiles.
· NO candy-bright, saturated, neon or pastel colour. If it looks cheerful,
  it is wrong.
· NO glossy, plasticky, airbrushed mobile-game rendering. No smooth 3D
  volume, no bevelled edges, no lens flares, no rim-lit chrome.
· NO photorealism and no hyper-detailed fur or scales — this is paint, and it
  is read at thumbnail size.
· NO warm paper, parchment or sepia wash over the whole image. Warmth is an
  accent, not a filter, and the ground is not part of the painting.
· NO frames, borders, cards, vignettes, matting or paper background inside
  the frame. The object itself fills the frame edge to edge, corner to
  corner, and its outer edge is the frame's edge.
· Keep the subject the same subject and silhouette it already has. This is a
  restyle, not a redesign.

SIZE AND PLACEMENT — this is the part that goes wrong.
The subject fills its frame edge to edge, exactly as the reference does.
Do not shrink it onto a card or leave a polite margin.
· Do not rotate it or change the viewing angle.
· No cast shadow on the ground. The game draws its own.

BACKGROUND — read this before anything else. It matters more than the style.
Fill every pixel that is not the object itself with solid, flat, pure magenta
#FF00FF. Treat it as a green-screen: one flat chroma-key colour, edge to edge.
· EXACTLY #FF00FF — red 255, green 0, blue 255. Not pink, not rose, not dusty
  pink, not mauve, not a soft or tinted version of it. Only the true colour can
  be cut away cleanly; a near miss has to be flood-filled instead, and a flood
  fill eats any pale paint it can reach.
· NOT transparent. Transparency gets exported as a grey-and-white CHECKERBOARD
  and then baked into the artwork as though the squares were paint.
· NOT white, cream, black, parchment, paper, or any tinted or textured ground.
· The object must NOT sit on a card, panel, sheet, badge, frame or rectangle of
  any kind. The magenta must touch the outline of the object on every side.
· No drop shadow onto the background, and no vignette.
· The object itself must contain no magenta or hot pink.
· The dark, desaturated palette above is for the OBJECT. The ground is not
  part of the painting and is not toned down with it: it stays a vivid,
  eye-hurting #FF00FF however dark everything else is. Dusty rose, pale pink
  and mauve are the failure this whole clause is about.

OUTPUT — read this twice, it is where every previous attempt failed:
· ONE image, exactly 512 x 512 pixels — square (1:1).
  If your tool has an aspect-ratio control, set it to match. Returns have
  come back at the tool's default ratio before, which overrides this line —
  the setting wins, so change the setting.
· ONE object. Not two, not a comparison, not variants side by side, not a
  before-and-after pair.
· No frame, border, card, label, caption, arrow, annotation or drop shadow.

---

# lever-post — Lever housing  (images/props/lever-post.webp)

Paint ONE game sprite in a single landscape, 2:1 image.
The attached reference is exactly what to paint, at exactly the size and
position it is drawn at. Match both.

WHAT IT IS: The housing of a road-side lever: a low, wide iron footing bolted flat to the ground, seen straight on — a squat rusted-steel box with a heavy bevelled lid, four corner bolts and a dark slot across its top where the arm comes out. Low and wide, twice as wide as it is tall, filling the frame.

LEAVE OUT WHAT THE GAME PAINTS LIVE. The ARM is a separate painting that swings out of the slot, so paint the housing alone — no arm, no handle, nothing standing up out of it.

STYLE — grim painted dark fantasy, like a plate from a gothic illustrated
bestiary or the key art of a dungeon crawler. Match this in every panel:
· INK FIRST. Heavy hand-drawn contour lines in near-black ink, jagged and
  confident, thick on the shadow side and thin on the lit side, with
  dry-brush breaks. The drawing must look DRAWN — scratchy linework showing
  through the paint.
· PAINTED, NOT RENDERED. Flat blocks of gouache-like paint inside the lines
  with visible brushwork, rough cel-style shadow shapes and a little grain.
  No airbrush, no smooth 3D shading, no plastic gloss.
· DESATURATED, LOW-KEY colour: bone, ash grey, dried blood, rust, bruise
  purple, swamp green, cold slate — with ONE hot accent per subject (ember
  orange, sickly witch-green, cold soul-blue, tarnished gold). Deep shadows
  that fall to black.
· HIGH CONTRAST and cold. The light comes from the UPPER LEFT. Chiaroscuro:
  most of every form in shadow, one edge picked out.
· Gothic, grotesque, worn: cracked bone, rusted iron, torn cloth, wet stone,
  candle-soot. Everything has been through something.
· Menacing rather than cute — but the SILHOUETTE stays readable at 40 px, so
  keep the big shapes simple and put the detail inside them.

AVOID — this is exactly how earlier attempts went wrong:
· NO cute, cozy, storybook, chibi or plush look. No rounded friendly faces,
  no button eyes, no smiles.
· NO candy-bright, saturated, neon or pastel colour. If it looks cheerful,
  it is wrong.
· NO glossy, plasticky, airbrushed mobile-game rendering. No smooth 3D
  volume, no bevelled edges, no lens flares, no rim-lit chrome.
· NO photorealism and no hyper-detailed fur or scales — this is paint, and it
  is read at thumbnail size.
· NO warm paper, parchment or sepia wash over the whole image. Warmth is an
  accent, not a filter, and the ground is not part of the painting.
· NO frames, borders, cards, vignettes, matting or paper background inside
  the frame. The object itself fills the frame edge to edge, corner to
  corner, and its outer edge is the frame's edge.
· Keep the subject the same subject and silhouette it already has. This is a
  restyle, not a redesign.

SIZE AND PLACEMENT — this is the part that goes wrong.
The subject fills its frame edge to edge, exactly as the reference does.
Do not shrink it onto a card or leave a polite margin.
· Do not rotate it or change the viewing angle.
· No cast shadow on the ground. The game draws its own.

BACKGROUND — read this before anything else. It matters more than the style.
Fill every pixel that is not the object itself with solid, flat, pure magenta
#FF00FF. Treat it as a green-screen: one flat chroma-key colour, edge to edge.
· EXACTLY #FF00FF — red 255, green 0, blue 255. Not pink, not rose, not dusty
  pink, not mauve, not a soft or tinted version of it. Only the true colour can
  be cut away cleanly; a near miss has to be flood-filled instead, and a flood
  fill eats any pale paint it can reach.
· NOT transparent. Transparency gets exported as a grey-and-white CHECKERBOARD
  and then baked into the artwork as though the squares were paint.
· NOT white, cream, black, parchment, paper, or any tinted or textured ground.
· The object must NOT sit on a card, panel, sheet, badge, frame or rectangle of
  any kind. The magenta must touch the outline of the object on every side.
· No drop shadow onto the background, and no vignette.
· The object itself must contain no magenta or hot pink.
· The dark, desaturated palette above is for the OBJECT. The ground is not
  part of the painting and is not toned down with it: it stays a vivid,
  eye-hurting #FF00FF however dark everything else is. Dusty rose, pale pink
  and mauve are the failure this whole clause is about.

OUTPUT — read this twice, it is where every previous attempt failed:
· ONE image, exactly 512 x 256 pixels — landscape, 2:1.
  If your tool has an aspect-ratio control, set it to match. Returns have
  come back at the tool's default ratio before, which overrides this line —
  the setting wins, so change the setting.
· ONE object. Not two, not a comparison, not variants side by side, not a
  before-and-after pair.
· No frame, border, card, label, caption, arrow, annotation or drop shadow.

---

# lever-arm — Lever arm  (images/props/lever-arm.webp)

Paint ONE game sprite in a single portrait, 9:16 image.
The attached reference is exactly what to paint, at exactly the size and
position it is drawn at. Match both.

WHAT IT IS: The arm of a road-side lever, standing straight UP: a stout iron rod with a wrapped grip, rising from the bottom edge of the frame, and at its top an EMPTY round socket — an open iron ring or claw with nothing in it. The socket must be a hole, not a ball: the game lights a glowing orb inside it. Centred, the rod filling the frame's full height, the socket at the very top.

LEAVE OUT WHAT THE GAME PAINTS LIVE. The knob is painted live INSIDE the socket — red while the lever is live, green once it is pulled — so leave the socket open and unlit.

DRAW IT AT REST, standing UP: the pivot at the bottom edge, the socket at the top. The game swings it over as the lever is pulled. Do not add motion blur, speed lines or
a second copy of it: the game turns and moves it out of this one picture.

STYLE — grim painted dark fantasy, like a plate from a gothic illustrated
bestiary or the key art of a dungeon crawler. Match this in every panel:
· INK FIRST. Heavy hand-drawn contour lines in near-black ink, jagged and
  confident, thick on the shadow side and thin on the lit side, with
  dry-brush breaks. The drawing must look DRAWN — scratchy linework showing
  through the paint.
· PAINTED, NOT RENDERED. Flat blocks of gouache-like paint inside the lines
  with visible brushwork, rough cel-style shadow shapes and a little grain.
  No airbrush, no smooth 3D shading, no plastic gloss.
· DESATURATED, LOW-KEY colour: bone, ash grey, dried blood, rust, bruise
  purple, swamp green, cold slate — with ONE hot accent per subject (ember
  orange, sickly witch-green, cold soul-blue, tarnished gold). Deep shadows
  that fall to black.
· HIGH CONTRAST and cold. The light comes from the UPPER LEFT. Chiaroscuro:
  most of every form in shadow, one edge picked out.
· Gothic, grotesque, worn: cracked bone, rusted iron, torn cloth, wet stone,
  candle-soot. Everything has been through something.
· Menacing rather than cute — but the SILHOUETTE stays readable at 40 px, so
  keep the big shapes simple and put the detail inside them.

AVOID — this is exactly how earlier attempts went wrong:
· NO cute, cozy, storybook, chibi or plush look. No rounded friendly faces,
  no button eyes, no smiles.
· NO candy-bright, saturated, neon or pastel colour. If it looks cheerful,
  it is wrong.
· NO glossy, plasticky, airbrushed mobile-game rendering. No smooth 3D
  volume, no bevelled edges, no lens flares, no rim-lit chrome.
· NO photorealism and no hyper-detailed fur or scales — this is paint, and it
  is read at thumbnail size.
· NO warm paper, parchment or sepia wash over the whole image. Warmth is an
  accent, not a filter, and the ground is not part of the painting.
· NO frames, borders, cards, vignettes, matting or paper background behind
  the drawing. Nothing but flat magenta behind it, right up to its outline.
· Keep the subject the same subject and silhouette it already has. This is a
  restyle, not a redesign.

SIZE AND PLACEMENT — this is the part that goes wrong.
Do not enlarge it to fill the frame. The reference leaves air around the
subject and that air is not waste — it is where the things drawn live around
it go. Keep the subject the same fraction of the frame that the reference
has it, in the same place.
· Its bottom edge must land at the same height from the bottom of the
  frame as the reference has it — the game registers the return by it.
· Do not rotate it or change the viewing angle.
· No cast shadow on the ground. The game draws its own.

BACKGROUND — read this before anything else. It matters more than the style.
Fill every pixel that is not the object itself with solid, flat, pure magenta
#FF00FF. Treat it as a green-screen: one flat chroma-key colour, edge to edge.
· EXACTLY #FF00FF — red 255, green 0, blue 255. Not pink, not rose, not dusty
  pink, not mauve, not a soft or tinted version of it. Only the true colour can
  be cut away cleanly; a near miss has to be flood-filled instead, and a flood
  fill eats any pale paint it can reach.
· NOT transparent. Transparency gets exported as a grey-and-white CHECKERBOARD
  and then baked into the artwork as though the squares were paint.
· NOT white, cream, black, parchment, paper, or any tinted or textured ground.
· The object must NOT sit on a card, panel, sheet, badge, frame or rectangle of
  any kind. The magenta must touch the outline of the object on every side.
· No drop shadow onto the background, and no vignette.
· The object itself must contain no magenta or hot pink.
· The dark, desaturated palette above is for the OBJECT. The ground is not
  part of the painting and is not toned down with it: it stays a vivid,
  eye-hurting #FF00FF however dark everything else is. Dusty rose, pale pink
  and mauve are the failure this whole clause is about.

OUTPUT — read this twice, it is where every previous attempt failed:
· ONE image, exactly 288 x 512 pixels — portrait, 9:16.
  If your tool has an aspect-ratio control, set it to match. Returns have
  come back at the tool's default ratio before, which overrides this line —
  the setting wins, so change the setting.
· ONE object. Not two, not a comparison, not variants side by side, not a
  before-and-after pair.
· No frame, border, card, label, caption, arrow, annotation or drop shadow.

---

# frame-add — Gate frame — the door that pays  (images/gates/frame-add.webp)

Paint ONE game sprite in a single landscape, 21:9 image.
The attached reference is exactly what to paint, at exactly the size and
position it is drawn at. Match both.

WHAT IT IS: A gate FRAME for a magical doorway, seen straight on: two THIN, tall posts, one at each side of the frame, joined by a thin lintel or arch across the top; the whole MIDDLE IS OPEN — flat magenta — because the game paints the glowing curtain, the flowing chevrons and the number plate inside the opening. The posts stand on the road; leave a little magenta under and over them exactly as the reference does. THIS ONE is the door that PAYS: clean cold-iron posts lit with pale cyan runes, a faint cold light on the metal, intact. Cold cyan is its identity — nothing warm on it.

THE POSTS — measure them against the FRAME, not against your idea of a gate.
In the reference each post is a pillar 6% of the frame wide, its outer
face 12% in from the frame's edge and its inner face 18% in.
That is as wide as a post can be. Paint it EXACTLY that wide — the width the
reference draws it, not wider, not a pair, not a wall. The DOORWAY between
the two inner faces is 64% of the width and it is EMPTY from the lintel
to the ground: nothing stands in it, nothing leans into it, no rubble, no
floor, no shadow.
· Exactly TWO posts: one at the left edge, one at the right. Not a pair per
  side, not a slab beside a pillar, not a wall.
· A post wider than the reference is squeezed thinner by the slicer until it
  fits — the painting survives, squashed. The last three returns had posts
  three times the reference width, and every one of them came back as a
  squeezed sliver.
· Bulk goes UP — a taller cap, a finial, a heavier lintel — never sideways.
· The lintel or arch across the top is thin and can be stretched; nothing
  else spans the doorway. Anything painted below the lintel between the
  posts is thrown away.

STYLE — grim painted dark fantasy, like a plate from a gothic illustrated
bestiary or the key art of a dungeon crawler. Match this in every panel:
· INK FIRST. Heavy hand-drawn contour lines in near-black ink, jagged and
  confident, thick on the shadow side and thin on the lit side, with
  dry-brush breaks. The drawing must look DRAWN — scratchy linework showing
  through the paint.
· PAINTED, NOT RENDERED. Flat blocks of gouache-like paint inside the lines
  with visible brushwork, rough cel-style shadow shapes and a little grain.
  No airbrush, no smooth 3D shading, no plastic gloss.
· DESATURATED, LOW-KEY colour: bone, ash grey, dried blood, rust, bruise
  purple, swamp green, cold slate — with ONE hot accent per subject (ember
  orange, sickly witch-green, cold soul-blue, tarnished gold). Deep shadows
  that fall to black.
· HIGH CONTRAST and cold. The light comes from the UPPER LEFT. Chiaroscuro:
  most of every form in shadow, one edge picked out.
· Gothic, grotesque, worn: cracked bone, rusted iron, torn cloth, wet stone,
  candle-soot. Everything has been through something.
· Menacing rather than cute — but the SILHOUETTE stays readable at 40 px, so
  keep the big shapes simple and put the detail inside them.

AVOID — this is exactly how earlier attempts went wrong:
· NO cute, cozy, storybook, chibi or plush look. No rounded friendly faces,
  no button eyes, no smiles.
· NO candy-bright, saturated, neon or pastel colour. If it looks cheerful,
  it is wrong.
· NO glossy, plasticky, airbrushed mobile-game rendering. No smooth 3D
  volume, no bevelled edges, no lens flares, no rim-lit chrome.
· NO photorealism and no hyper-detailed fur or scales — this is paint, and it
  is read at thumbnail size.
· NO warm paper, parchment or sepia wash over the whole image. Warmth is an
  accent, not a filter, and the ground is not part of the painting.
· NO frames, borders, cards, vignettes, matting or paper background behind
  the drawing. Nothing but flat magenta behind it, right up to its outline.
· Keep the subject the same subject and silhouette it already has. This is a
  restyle, not a redesign.

SIZE AND PLACEMENT — this is the part that goes wrong.
Do not enlarge it to fill the frame. The reference leaves air around the
subject and that air is not waste — it is where the things drawn live around
it go. Keep the subject the same fraction of the frame that the reference
has it, in the same place.
· Do not rotate it or change the viewing angle.
· No cast shadow on the ground. The game draws its own.

BACKGROUND — read this before anything else. It matters more than the style.
Fill every pixel that is not the object itself with solid, flat, pure magenta
#FF00FF. Treat it as a green-screen: one flat chroma-key colour, edge to edge.
· EXACTLY #FF00FF — red 255, green 0, blue 255. Not pink, not rose, not dusty
  pink, not mauve, not a soft or tinted version of it. Only the true colour can
  be cut away cleanly; a near miss has to be flood-filled instead, and a flood
  fill eats any pale paint it can reach.
· NOT transparent. Transparency gets exported as a grey-and-white CHECKERBOARD
  and then baked into the artwork as though the squares were paint.
· NOT white, cream, black, parchment, paper, or any tinted or textured ground.
· The object must NOT sit on a card, panel, sheet, badge, frame or rectangle of
  any kind. The magenta must touch the outline of the object on every side.
· No drop shadow onto the background, and no vignette.
· The object itself must contain no magenta or hot pink.
· The dark, desaturated palette above is for the OBJECT. The ground is not
  part of the painting and is not toned down with it: it stays a vivid,
  eye-hurting #FF00FF however dark everything else is. Dusty rose, pale pink
  and mauve are the failure this whole clause is about.

BEFORE YOU CALL IT FINISHED, count and check:
· Two posts, one per side, each 6% of the frame wide — the width the
  reference draws them — with the doorway 64% of the width between them.
· The doorway between them is empty magenta from the lintel down to the
  ground.
· No shadow on the ground, no ground at all — the posts stand on magenta.

OUTPUT — read this twice, it is where every previous attempt failed:
· ONE image, exactly 1344 x 576 pixels — landscape, 21:9.
  If your tool has an aspect-ratio control, set it to match. Returns have
  come back at the tool's default ratio before, which overrides this line —
  the setting wins, so change the setting.
· ONE object. Not two, not a comparison, not variants side by side, not a
  before-and-after pair.
· No frame, border, card, label, caption, arrow, annotation or drop shadow.

---

# frame-sub — Gate frame — the door that bills  (images/gates/frame-sub.webp)

Paint ONE game sprite in a single landscape, 21:9 image.
The attached reference is exactly what to paint, at exactly the size and
position it is drawn at. Match both.

WHAT IT IS: A gate FRAME for a magical doorway, seen straight on: two THIN, tall posts, one at each side of the frame, joined by a thin lintel or arch across the top; the whole MIDDLE IS OPEN — flat magenta — because the game paints the glowing curtain, the flowing chevrons and the number plate inside the opening. The posts stand on the road; leave a little magenta under and over them exactly as the reference does. THIS ONE is the door that BILLS: scorched iron posts with an amber-brown, sooty, dried-blood cast, dull embers in the cracks, intact but ugly.

THE POSTS — measure them against the FRAME, not against your idea of a gate.
In the reference each post is a pillar 6% of the frame wide, its outer
face 12% in from the frame's edge and its inner face 18% in.
That is as wide as a post can be. Paint it EXACTLY that wide — the width the
reference draws it, not wider, not a pair, not a wall. The DOORWAY between
the two inner faces is 64% of the width and it is EMPTY from the lintel
to the ground: nothing stands in it, nothing leans into it, no rubble, no
floor, no shadow.
· Exactly TWO posts: one at the left edge, one at the right. Not a pair per
  side, not a slab beside a pillar, not a wall.
· A post wider than the reference is squeezed thinner by the slicer until it
  fits — the painting survives, squashed. The last three returns had posts
  three times the reference width, and every one of them came back as a
  squeezed sliver.
· Bulk goes UP — a taller cap, a finial, a heavier lintel — never sideways.
· The lintel or arch across the top is thin and can be stretched; nothing
  else spans the doorway. Anything painted below the lintel between the
  posts is thrown away.

STYLE — grim painted dark fantasy, like a plate from a gothic illustrated
bestiary or the key art of a dungeon crawler. Match this in every panel:
· INK FIRST. Heavy hand-drawn contour lines in near-black ink, jagged and
  confident, thick on the shadow side and thin on the lit side, with
  dry-brush breaks. The drawing must look DRAWN — scratchy linework showing
  through the paint.
· PAINTED, NOT RENDERED. Flat blocks of gouache-like paint inside the lines
  with visible brushwork, rough cel-style shadow shapes and a little grain.
  No airbrush, no smooth 3D shading, no plastic gloss.
· DESATURATED, LOW-KEY colour: bone, ash grey, dried blood, rust, bruise
  purple, swamp green, cold slate — with ONE hot accent per subject (ember
  orange, sickly witch-green, cold soul-blue, tarnished gold). Deep shadows
  that fall to black.
· HIGH CONTRAST and cold. The light comes from the UPPER LEFT. Chiaroscuro:
  most of every form in shadow, one edge picked out.
· Gothic, grotesque, worn: cracked bone, rusted iron, torn cloth, wet stone,
  candle-soot. Everything has been through something.
· Menacing rather than cute — but the SILHOUETTE stays readable at 40 px, so
  keep the big shapes simple and put the detail inside them.

AVOID — this is exactly how earlier attempts went wrong:
· NO cute, cozy, storybook, chibi or plush look. No rounded friendly faces,
  no button eyes, no smiles.
· NO candy-bright, saturated, neon or pastel colour. If it looks cheerful,
  it is wrong.
· NO glossy, plasticky, airbrushed mobile-game rendering. No smooth 3D
  volume, no bevelled edges, no lens flares, no rim-lit chrome.
· NO photorealism and no hyper-detailed fur or scales — this is paint, and it
  is read at thumbnail size.
· NO warm paper, parchment or sepia wash over the whole image. Warmth is an
  accent, not a filter, and the ground is not part of the painting.
· NO frames, borders, cards, vignettes, matting or paper background behind
  the drawing. Nothing but flat magenta behind it, right up to its outline.
· Keep the subject the same subject and silhouette it already has. This is a
  restyle, not a redesign.

SIZE AND PLACEMENT — this is the part that goes wrong.
Do not enlarge it to fill the frame. The reference leaves air around the
subject and that air is not waste — it is where the things drawn live around
it go. Keep the subject the same fraction of the frame that the reference
has it, in the same place.
· Do not rotate it or change the viewing angle.
· No cast shadow on the ground. The game draws its own.

BACKGROUND — read this before anything else. It matters more than the style.
Fill every pixel that is not the object itself with solid, flat, pure magenta
#FF00FF. Treat it as a green-screen: one flat chroma-key colour, edge to edge.
· EXACTLY #FF00FF — red 255, green 0, blue 255. Not pink, not rose, not dusty
  pink, not mauve, not a soft or tinted version of it. Only the true colour can
  be cut away cleanly; a near miss has to be flood-filled instead, and a flood
  fill eats any pale paint it can reach.
· NOT transparent. Transparency gets exported as a grey-and-white CHECKERBOARD
  and then baked into the artwork as though the squares were paint.
· NOT white, cream, black, parchment, paper, or any tinted or textured ground.
· The object must NOT sit on a card, panel, sheet, badge, frame or rectangle of
  any kind. The magenta must touch the outline of the object on every side.
· No drop shadow onto the background, and no vignette.
· The object itself must contain no magenta or hot pink.
· The dark, desaturated palette above is for the OBJECT. The ground is not
  part of the painting and is not toned down with it: it stays a vivid,
  eye-hurting #FF00FF however dark everything else is. Dusty rose, pale pink
  and mauve are the failure this whole clause is about.

BEFORE YOU CALL IT FINISHED, count and check:
· Two posts, one per side, each 6% of the frame wide — the width the
  reference draws them — with the doorway 64% of the width between them.
· The doorway between them is empty magenta from the lintel down to the
  ground.
· No shadow on the ground, no ground at all — the posts stand on magenta.

OUTPUT — read this twice, it is where every previous attempt failed:
· ONE image, exactly 1344 x 576 pixels — landscape, 21:9.
  If your tool has an aspect-ratio control, set it to match. Returns have
  come back at the tool's default ratio before, which overrides this line —
  the setting wins, so change the setting.
· ONE object. Not two, not a comparison, not variants side by side, not a
  before-and-after pair.
· No frame, border, card, label, caption, arrow, annotation or drop shadow.

---

# frame-mul — Gate frame — the multiplier  (images/gates/frame-mul.webp)

Paint ONE game sprite in a single landscape, 21:9 image.
The attached reference is exactly what to paint, at exactly the size and
position it is drawn at. Match both.

WHAT IT IS: A gate FRAME for a magical doorway, seen straight on: two THIN, tall posts, one at each side of the frame, joined by a thin lintel or arch across the top; the whole MIDDLE IS OPEN — flat magenta — because the game paints the glowing curtain, the flowing chevrons and the number plate inside the opening. The posts stand on the road; leave a little magenta under and over them exactly as the reference does. THIS ONE is the MULTIPLIER: posts of dark violet-black iron with deep purple runes — deep VIOLET, never pink and never magenta, because magenta is the background key and would be cut away with the sky.

THE POSTS — measure them against the FRAME, not against your idea of a gate.
In the reference each post is a pillar 6% of the frame wide, its outer
face 12% in from the frame's edge and its inner face 18% in.
That is as wide as a post can be. Paint it EXACTLY that wide — the width the
reference draws it, not wider, not a pair, not a wall. The DOORWAY between
the two inner faces is 64% of the width and it is EMPTY from the lintel
to the ground: nothing stands in it, nothing leans into it, no rubble, no
floor, no shadow.
· Exactly TWO posts: one at the left edge, one at the right. Not a pair per
  side, not a slab beside a pillar, not a wall.
· A post wider than the reference is squeezed thinner by the slicer until it
  fits — the painting survives, squashed. The last three returns had posts
  three times the reference width, and every one of them came back as a
  squeezed sliver.
· Bulk goes UP — a taller cap, a finial, a heavier lintel — never sideways.
· The lintel or arch across the top is thin and can be stretched; nothing
  else spans the doorway. Anything painted below the lintel between the
  posts is thrown away.

STYLE — grim painted dark fantasy, like a plate from a gothic illustrated
bestiary or the key art of a dungeon crawler. Match this in every panel:
· INK FIRST. Heavy hand-drawn contour lines in near-black ink, jagged and
  confident, thick on the shadow side and thin on the lit side, with
  dry-brush breaks. The drawing must look DRAWN — scratchy linework showing
  through the paint.
· PAINTED, NOT RENDERED. Flat blocks of gouache-like paint inside the lines
  with visible brushwork, rough cel-style shadow shapes and a little grain.
  No airbrush, no smooth 3D shading, no plastic gloss.
· DESATURATED, LOW-KEY colour: bone, ash grey, dried blood, rust, bruise
  purple, swamp green, cold slate — with ONE hot accent per subject (ember
  orange, sickly witch-green, cold soul-blue, tarnished gold). Deep shadows
  that fall to black.
· HIGH CONTRAST and cold. The light comes from the UPPER LEFT. Chiaroscuro:
  most of every form in shadow, one edge picked out.
· Gothic, grotesque, worn: cracked bone, rusted iron, torn cloth, wet stone,
  candle-soot. Everything has been through something.
· Menacing rather than cute — but the SILHOUETTE stays readable at 40 px, so
  keep the big shapes simple and put the detail inside them.

AVOID — this is exactly how earlier attempts went wrong:
· NO cute, cozy, storybook, chibi or plush look. No rounded friendly faces,
  no button eyes, no smiles.
· NO candy-bright, saturated, neon or pastel colour. If it looks cheerful,
  it is wrong.
· NO glossy, plasticky, airbrushed mobile-game rendering. No smooth 3D
  volume, no bevelled edges, no lens flares, no rim-lit chrome.
· NO photorealism and no hyper-detailed fur or scales — this is paint, and it
  is read at thumbnail size.
· NO warm paper, parchment or sepia wash over the whole image. Warmth is an
  accent, not a filter, and the ground is not part of the painting.
· NO frames, borders, cards, vignettes, matting or paper background behind
  the drawing. Nothing but flat magenta behind it, right up to its outline.
· Keep the subject the same subject and silhouette it already has. This is a
  restyle, not a redesign.

SIZE AND PLACEMENT — this is the part that goes wrong.
Do not enlarge it to fill the frame. The reference leaves air around the
subject and that air is not waste — it is where the things drawn live around
it go. Keep the subject the same fraction of the frame that the reference
has it, in the same place.
· Do not rotate it or change the viewing angle.
· No cast shadow on the ground. The game draws its own.

BACKGROUND — read this before anything else. It matters more than the style.
Fill every pixel that is not the object itself with solid, flat, pure magenta
#FF00FF. Treat it as a green-screen: one flat chroma-key colour, edge to edge.
· EXACTLY #FF00FF — red 255, green 0, blue 255. Not pink, not rose, not dusty
  pink, not mauve, not a soft or tinted version of it. Only the true colour can
  be cut away cleanly; a near miss has to be flood-filled instead, and a flood
  fill eats any pale paint it can reach.
· NOT transparent. Transparency gets exported as a grey-and-white CHECKERBOARD
  and then baked into the artwork as though the squares were paint.
· NOT white, cream, black, parchment, paper, or any tinted or textured ground.
· The object must NOT sit on a card, panel, sheet, badge, frame or rectangle of
  any kind. The magenta must touch the outline of the object on every side.
· No drop shadow onto the background, and no vignette.
· The object itself must contain no magenta or hot pink.
· The dark, desaturated palette above is for the OBJECT. The ground is not
  part of the painting and is not toned down with it: it stays a vivid,
  eye-hurting #FF00FF however dark everything else is. Dusty rose, pale pink
  and mauve are the failure this whole clause is about.

BEFORE YOU CALL IT FINISHED, count and check:
· Two posts, one per side, each 6% of the frame wide — the width the
  reference draws them — with the doorway 64% of the width between them.
· The doorway between them is empty magenta from the lintel down to the
  ground.
· No shadow on the ground, no ground at all — the posts stand on magenta.

OUTPUT — read this twice, it is where every previous attempt failed:
· ONE image, exactly 1344 x 576 pixels — landscape, 21:9.
  If your tool has an aspect-ratio control, set it to match. Returns have
  come back at the tool's default ratio before, which overrides this line —
  the setting wins, so change the setting.
· ONE object. Not two, not a comparison, not variants side by side, not a
  before-and-after pair.
· No frame, border, card, label, caption, arrow, annotation or drop shadow.

---

# frame-div — Gate frame — the trap  (images/gates/frame-div.webp)

Paint ONE game sprite in a single landscape, 21:9 image.
The attached reference is exactly what to paint, at exactly the size and
position it is drawn at. Match both.

WHAT IT IS: A gate FRAME for a magical doorway, seen straight on: two THIN, tall posts, one at each side of the frame, joined by a thin lintel or arch across the top; the whole MIDDLE IS OPEN — flat magenta — because the game paints the glowing curtain, the flowing chevrons and the number plate inside the opening. The posts stand on the road; leave a little magenta under and over them exactly as the reference does. THIS ONE is the TRAP: rusted red-black iron posts, each still ONE pillar of the reference's width, with the top of the post cracked off jagged and a snapped stub above the break, dirty and scorched — a frame that has already failed somebody. Broken means the TOP is broken; the post itself stays a pillar, not a heap of rubble, not a wall.

THE POSTS — measure them against the FRAME, not against your idea of a gate.
In the reference each post is a pillar 6% of the frame wide, its outer
face 12% in from the frame's edge and its inner face 18% in.
That is as wide as a post can be. Paint it EXACTLY that wide — the width the
reference draws it, not wider, not a pair, not a wall. The DOORWAY between
the two inner faces is 64% of the width and it is EMPTY from the lintel
to the ground: nothing stands in it, nothing leans into it, no rubble, no
floor, no shadow.
· Exactly TWO posts: one at the left edge, one at the right. Not a pair per
  side, not a slab beside a pillar, not a wall.
· A post wider than the reference is squeezed thinner by the slicer until it
  fits — the painting survives, squashed. The last three returns had posts
  three times the reference width, and every one of them came back as a
  squeezed sliver.
· Bulk goes UP — a taller cap, a finial, a heavier lintel — never sideways.
· The lintel or arch across the top is thin and can be stretched; nothing
  else spans the doorway. Anything painted below the lintel between the
  posts is thrown away.

STYLE — grim painted dark fantasy, like a plate from a gothic illustrated
bestiary or the key art of a dungeon crawler. Match this in every panel:
· INK FIRST. Heavy hand-drawn contour lines in near-black ink, jagged and
  confident, thick on the shadow side and thin on the lit side, with
  dry-brush breaks. The drawing must look DRAWN — scratchy linework showing
  through the paint.
· PAINTED, NOT RENDERED. Flat blocks of gouache-like paint inside the lines
  with visible brushwork, rough cel-style shadow shapes and a little grain.
  No airbrush, no smooth 3D shading, no plastic gloss.
· DESATURATED, LOW-KEY colour: bone, ash grey, dried blood, rust, bruise
  purple, swamp green, cold slate — with ONE hot accent per subject (ember
  orange, sickly witch-green, cold soul-blue, tarnished gold). Deep shadows
  that fall to black.
· HIGH CONTRAST and cold. The light comes from the UPPER LEFT. Chiaroscuro:
  most of every form in shadow, one edge picked out.
· Gothic, grotesque, worn: cracked bone, rusted iron, torn cloth, wet stone,
  candle-soot. Everything has been through something.
· Menacing rather than cute — but the SILHOUETTE stays readable at 40 px, so
  keep the big shapes simple and put the detail inside them.

AVOID — this is exactly how earlier attempts went wrong:
· NO cute, cozy, storybook, chibi or plush look. No rounded friendly faces,
  no button eyes, no smiles.
· NO candy-bright, saturated, neon or pastel colour. If it looks cheerful,
  it is wrong.
· NO glossy, plasticky, airbrushed mobile-game rendering. No smooth 3D
  volume, no bevelled edges, no lens flares, no rim-lit chrome.
· NO photorealism and no hyper-detailed fur or scales — this is paint, and it
  is read at thumbnail size.
· NO warm paper, parchment or sepia wash over the whole image. Warmth is an
  accent, not a filter, and the ground is not part of the painting.
· NO frames, borders, cards, vignettes, matting or paper background behind
  the drawing. Nothing but flat magenta behind it, right up to its outline.
· Keep the subject the same subject and silhouette it already has. This is a
  restyle, not a redesign.

SIZE AND PLACEMENT — this is the part that goes wrong.
Do not enlarge it to fill the frame. The reference leaves air around the
subject and that air is not waste — it is where the things drawn live around
it go. Keep the subject the same fraction of the frame that the reference
has it, in the same place.
· Do not rotate it or change the viewing angle.
· No cast shadow on the ground. The game draws its own.

BACKGROUND — read this before anything else. It matters more than the style.
Fill every pixel that is not the object itself with solid, flat, pure magenta
#FF00FF. Treat it as a green-screen: one flat chroma-key colour, edge to edge.
· EXACTLY #FF00FF — red 255, green 0, blue 255. Not pink, not rose, not dusty
  pink, not mauve, not a soft or tinted version of it. Only the true colour can
  be cut away cleanly; a near miss has to be flood-filled instead, and a flood
  fill eats any pale paint it can reach.
· NOT transparent. Transparency gets exported as a grey-and-white CHECKERBOARD
  and then baked into the artwork as though the squares were paint.
· NOT white, cream, black, parchment, paper, or any tinted or textured ground.
· The object must NOT sit on a card, panel, sheet, badge, frame or rectangle of
  any kind. The magenta must touch the outline of the object on every side.
· No drop shadow onto the background, and no vignette.
· The object itself must contain no magenta or hot pink.
· The dark, desaturated palette above is for the OBJECT. The ground is not
  part of the painting and is not toned down with it: it stays a vivid,
  eye-hurting #FF00FF however dark everything else is. Dusty rose, pale pink
  and mauve are the failure this whole clause is about.

BEFORE YOU CALL IT FINISHED, count and check:
· Two posts, one per side, each 6% of the frame wide — the width the
  reference draws them — with the doorway 64% of the width between them.
· The doorway between them is empty magenta from the lintel down to the
  ground.
· No shadow on the ground, no ground at all — the posts stand on magenta.

OUTPUT — read this twice, it is where every previous attempt failed:
· ONE image, exactly 1344 x 576 pixels — landscape, 21:9.
  If your tool has an aspect-ratio control, set it to match. Returns have
  come back at the tool's default ratio before, which overrides this line —
  the setting wins, so change the setting.
· ONE object. Not two, not a comparison, not variants side by side, not a
  before-and-after pair.
· No frame, border, card, label, caption, arrow, annotation or drop shadow.

---

# tracer — The crowd's round  (images/rounds/tracer.webp)

Paint ONE game sprite in a single square (1:1) image.
The attached reference is exactly what to paint, at exactly the size and
position it is drawn at. Match both.

WHAT IT IS: The crowd's round: a short vertical streak of hot lead — a bright white-gold core with a thin ember-orange glow tail below it. It is one of a hundred on screen, so it is a streak, not an object. The streak spans the full height of the frame and about a quarter of its width, centred.

DRAW IT AT REST, pointing UP: it flies up the screen, so the bright head is at the TOP and the tail trails DOWN. Do not add motion blur, speed lines or
a second copy of it: the game turns and moves it out of this one picture.

KEEP ANY GLOW TIGHT. A halo, aura or bloom spreading out into the background
is measured as part of the object when the return is fitted back onto the
reference — a wide aura therefore comes back as a tiny object inside a huge
smear. It also cannot be keyed: soft light over magenta turns pink rather
than transparent. Any glow belongs inside the shape's own outline, or within
a hair of it.

STYLE — grim painted dark fantasy, like a plate from a gothic illustrated
bestiary or the key art of a dungeon crawler. Match this in every panel:
· INK FIRST. Heavy hand-drawn contour lines in near-black ink, jagged and
  confident, thick on the shadow side and thin on the lit side, with
  dry-brush breaks. The drawing must look DRAWN — scratchy linework showing
  through the paint.
· PAINTED, NOT RENDERED. Flat blocks of gouache-like paint inside the lines
  with visible brushwork, rough cel-style shadow shapes and a little grain.
  No airbrush, no smooth 3D shading, no plastic gloss.
· DESATURATED, LOW-KEY colour: bone, ash grey, dried blood, rust, bruise
  purple, swamp green, cold slate — with ONE hot accent per subject (ember
  orange, sickly witch-green, cold soul-blue, tarnished gold). Deep shadows
  that fall to black.
· HIGH CONTRAST and cold. The light comes from the UPPER LEFT. Chiaroscuro:
  most of every form in shadow, one edge picked out.
· Gothic, grotesque, worn: cracked bone, rusted iron, torn cloth, wet stone,
  candle-soot. Everything has been through something.
· Menacing rather than cute — but the SILHOUETTE stays readable at 40 px, so
  keep the big shapes simple and put the detail inside them.

AVOID — this is exactly how earlier attempts went wrong:
· NO cute, cozy, storybook, chibi or plush look. No rounded friendly faces,
  no button eyes, no smiles.
· NO candy-bright, saturated, neon or pastel colour. If it looks cheerful,
  it is wrong.
· NO glossy, plasticky, airbrushed mobile-game rendering. No smooth 3D
  volume, no bevelled edges, no lens flares, no rim-lit chrome.
· NO photorealism and no hyper-detailed fur or scales — this is paint, and it
  is read at thumbnail size.
· NO warm paper, parchment or sepia wash over the whole image. Warmth is an
  accent, not a filter, and the ground is not part of the painting.
· NO frames, borders, cards, vignettes, matting or paper background behind
  the drawing. Nothing but flat magenta behind it, right up to its outline.
· Keep the subject the same subject and silhouette it already has. This is a
  restyle, not a redesign.

SIZE AND PLACEMENT — this is the part that goes wrong.
Do not enlarge it to fill the frame. The reference leaves air around the
subject and that air is not waste — it is where the things drawn live around
it go. Keep the subject the same fraction of the frame that the reference
has it, in the same place.
· Do not rotate it or change the viewing angle.
· No cast shadow on the ground. The game draws its own.

BACKGROUND — read this before anything else. It matters more than the style.
Fill every pixel that is not the object itself with solid, flat, pure magenta
#FF00FF. Treat it as a green-screen: one flat chroma-key colour, edge to edge.
· EXACTLY #FF00FF — red 255, green 0, blue 255. Not pink, not rose, not dusty
  pink, not mauve, not a soft or tinted version of it. Only the true colour can
  be cut away cleanly; a near miss has to be flood-filled instead, and a flood
  fill eats any pale paint it can reach.
· NOT transparent. Transparency gets exported as a grey-and-white CHECKERBOARD
  and then baked into the artwork as though the squares were paint.
· NOT white, cream, black, parchment, paper, or any tinted or textured ground.
· The object must NOT sit on a card, panel, sheet, badge, frame or rectangle of
  any kind. The magenta must touch the outline of the object on every side.
· No drop shadow onto the background, and no vignette.
· The object itself must contain no magenta or hot pink.
· The dark, desaturated palette above is for the OBJECT. The ground is not
  part of the painting and is not toned down with it: it stays a vivid,
  eye-hurting #FF00FF however dark everything else is. Dusty rose, pale pink
  and mauve are the failure this whole clause is about.

OUTPUT — read this twice, it is where every previous attempt failed:
· ONE image, exactly 512 x 512 pixels — square (1:1).
  If your tool has an aspect-ratio control, set it to match. Returns have
  come back at the tool's default ratio before, which overrides this line —
  the setting wins, so change the setting.
· ONE object. Not two, not a comparison, not variants side by side, not a
  before-and-after pair.
· No frame, border, card, label, caption, arrow, annotation or drop shadow.

---

# bolt-gunner — The gunner's round  (images/rounds/bolt-gunner.webp)

Paint ONE game sprite in a single square (1:1) image.
The attached reference is exactly what to paint, at exactly the size and
position it is drawn at. Match both.

WHAT IT IS: The gunner's round: a fat slow orb of cold cyan witchfire around a dark iron core, with a short tail of fading cyan behind it. Small in its frame — the tail is longer than the head is wide.

DRAW IT AT REST, pointing RIGHT: the head sits at 0.7 of the width with the tail trailing off to the LEFT. The game turns it to its heading.. Do not add motion blur, speed lines or
a second copy of it: the game turns and moves it out of this one picture.

KEEP ANY GLOW TIGHT. A halo, aura or bloom spreading out into the background
is measured as part of the object when the return is fitted back onto the
reference — a wide aura therefore comes back as a tiny object inside a huge
smear. It also cannot be keyed: soft light over magenta turns pink rather
than transparent. Any glow belongs inside the shape's own outline, or within
a hair of it.

STYLE — grim painted dark fantasy, like a plate from a gothic illustrated
bestiary or the key art of a dungeon crawler. Match this in every panel:
· INK FIRST. Heavy hand-drawn contour lines in near-black ink, jagged and
  confident, thick on the shadow side and thin on the lit side, with
  dry-brush breaks. The drawing must look DRAWN — scratchy linework showing
  through the paint.
· PAINTED, NOT RENDERED. Flat blocks of gouache-like paint inside the lines
  with visible brushwork, rough cel-style shadow shapes and a little grain.
  No airbrush, no smooth 3D shading, no plastic gloss.
· DESATURATED, LOW-KEY colour: bone, ash grey, dried blood, rust, bruise
  purple, swamp green, cold slate — with ONE hot accent per subject (ember
  orange, sickly witch-green, cold soul-blue, tarnished gold). Deep shadows
  that fall to black.
· HIGH CONTRAST and cold. The light comes from the UPPER LEFT. Chiaroscuro:
  most of every form in shadow, one edge picked out.
· Gothic, grotesque, worn: cracked bone, rusted iron, torn cloth, wet stone,
  candle-soot. Everything has been through something.
· Menacing rather than cute — but the SILHOUETTE stays readable at 40 px, so
  keep the big shapes simple and put the detail inside them.

AVOID — this is exactly how earlier attempts went wrong:
· NO cute, cozy, storybook, chibi or plush look. No rounded friendly faces,
  no button eyes, no smiles.
· NO candy-bright, saturated, neon or pastel colour. If it looks cheerful,
  it is wrong.
· NO glossy, plasticky, airbrushed mobile-game rendering. No smooth 3D
  volume, no bevelled edges, no lens flares, no rim-lit chrome.
· NO photorealism and no hyper-detailed fur or scales — this is paint, and it
  is read at thumbnail size.
· NO warm paper, parchment or sepia wash over the whole image. Warmth is an
  accent, not a filter, and the ground is not part of the painting.
· NO frames, borders, cards, vignettes, matting or paper background behind
  the drawing. Nothing but flat magenta behind it, right up to its outline.
· Keep the subject the same subject and silhouette it already has. This is a
  restyle, not a redesign.

SIZE AND PLACEMENT — this is the part that goes wrong.
Do not enlarge it to fill the frame. The reference leaves air around the
subject and that air is not waste — it is where the things drawn live around
it go. Keep the subject the same fraction of the frame that the reference
has it, in the same place.
· Do not rotate it or change the viewing angle.
· No cast shadow on the ground. The game draws its own.

BACKGROUND — read this before anything else. It matters more than the style.
Fill every pixel that is not the object itself with solid, flat, pure magenta
#FF00FF. Treat it as a green-screen: one flat chroma-key colour, edge to edge.
· EXACTLY #FF00FF — red 255, green 0, blue 255. Not pink, not rose, not dusty
  pink, not mauve, not a soft or tinted version of it. Only the true colour can
  be cut away cleanly; a near miss has to be flood-filled instead, and a flood
  fill eats any pale paint it can reach.
· NOT transparent. Transparency gets exported as a grey-and-white CHECKERBOARD
  and then baked into the artwork as though the squares were paint.
· NOT white, cream, black, parchment, paper, or any tinted or textured ground.
· The object must NOT sit on a card, panel, sheet, badge, frame or rectangle of
  any kind. The magenta must touch the outline of the object on every side.
· No drop shadow onto the background, and no vignette.
· The object itself must contain no magenta or hot pink.
· The dark, desaturated palette above is for the OBJECT. The ground is not
  part of the painting and is not toned down with it: it stays a vivid,
  eye-hurting #FF00FF however dark everything else is. Dusty rose, pale pink
  and mauve are the failure this whole clause is about.

OUTPUT — read this twice, it is where every previous attempt failed:
· ONE image, exactly 512 x 512 pixels — square (1:1).
  If your tool has an aspect-ratio control, set it to match. Returns have
  come back at the tool's default ratio before, which overrides this line —
  the setting wins, so change the setting.
· ONE object. Not two, not a comparison, not variants side by side, not a
  before-and-after pair.
· No frame, border, card, label, caption, arrow, annotation or drop shadow.

---

# bolt-boss — The healer's bolt  (images/rounds/bolt-boss.webp)

Paint ONE game sprite in a single square (1:1) image.
The attached reference is exactly what to paint, at exactly the size and
position it is drawn at. Match both.

WHAT IT IS: The healer's bolt: a sickly green orb of necrotic light with a pale core and a short trail behind it. Small in its frame.

DRAW IT AT REST, pointing RIGHT: the head sits at 0.7 of the width with the tail trailing off to the LEFT. The game turns it to its heading.. Do not add motion blur, speed lines or
a second copy of it: the game turns and moves it out of this one picture.

KEEP ANY GLOW TIGHT. A halo, aura or bloom spreading out into the background
is measured as part of the object when the return is fitted back onto the
reference — a wide aura therefore comes back as a tiny object inside a huge
smear. It also cannot be keyed: soft light over magenta turns pink rather
than transparent. Any glow belongs inside the shape's own outline, or within
a hair of it.

STYLE — grim painted dark fantasy, like a plate from a gothic illustrated
bestiary or the key art of a dungeon crawler. Match this in every panel:
· INK FIRST. Heavy hand-drawn contour lines in near-black ink, jagged and
  confident, thick on the shadow side and thin on the lit side, with
  dry-brush breaks. The drawing must look DRAWN — scratchy linework showing
  through the paint.
· PAINTED, NOT RENDERED. Flat blocks of gouache-like paint inside the lines
  with visible brushwork, rough cel-style shadow shapes and a little grain.
  No airbrush, no smooth 3D shading, no plastic gloss.
· DESATURATED, LOW-KEY colour: bone, ash grey, dried blood, rust, bruise
  purple, swamp green, cold slate — with ONE hot accent per subject (ember
  orange, sickly witch-green, cold soul-blue, tarnished gold). Deep shadows
  that fall to black.
· HIGH CONTRAST and cold. The light comes from the UPPER LEFT. Chiaroscuro:
  most of every form in shadow, one edge picked out.
· Gothic, grotesque, worn: cracked bone, rusted iron, torn cloth, wet stone,
  candle-soot. Everything has been through something.
· Menacing rather than cute — but the SILHOUETTE stays readable at 40 px, so
  keep the big shapes simple and put the detail inside them.

AVOID — this is exactly how earlier attempts went wrong:
· NO cute, cozy, storybook, chibi or plush look. No rounded friendly faces,
  no button eyes, no smiles.
· NO candy-bright, saturated, neon or pastel colour. If it looks cheerful,
  it is wrong.
· NO glossy, plasticky, airbrushed mobile-game rendering. No smooth 3D
  volume, no bevelled edges, no lens flares, no rim-lit chrome.
· NO photorealism and no hyper-detailed fur or scales — this is paint, and it
  is read at thumbnail size.
· NO warm paper, parchment or sepia wash over the whole image. Warmth is an
  accent, not a filter, and the ground is not part of the painting.
· NO frames, borders, cards, vignettes, matting or paper background behind
  the drawing. Nothing but flat magenta behind it, right up to its outline.
· Keep the subject the same subject and silhouette it already has. This is a
  restyle, not a redesign.

SIZE AND PLACEMENT — this is the part that goes wrong.
Do not enlarge it to fill the frame. The reference leaves air around the
subject and that air is not waste — it is where the things drawn live around
it go. Keep the subject the same fraction of the frame that the reference
has it, in the same place.
· Do not rotate it or change the viewing angle.
· No cast shadow on the ground. The game draws its own.

BACKGROUND — read this before anything else. It matters more than the style.
Fill every pixel that is not the object itself with solid, flat, pure magenta
#FF00FF. Treat it as a green-screen: one flat chroma-key colour, edge to edge.
· EXACTLY #FF00FF — red 255, green 0, blue 255. Not pink, not rose, not dusty
  pink, not mauve, not a soft or tinted version of it. Only the true colour can
  be cut away cleanly; a near miss has to be flood-filled instead, and a flood
  fill eats any pale paint it can reach.
· NOT transparent. Transparency gets exported as a grey-and-white CHECKERBOARD
  and then baked into the artwork as though the squares were paint.
· NOT white, cream, black, parchment, paper, or any tinted or textured ground.
· The object must NOT sit on a card, panel, sheet, badge, frame or rectangle of
  any kind. The magenta must touch the outline of the object on every side.
· No drop shadow onto the background, and no vignette.
· The object itself must contain no magenta or hot pink.
· The dark, desaturated palette above is for the OBJECT. The ground is not
  part of the painting and is not toned down with it: it stays a vivid,
  eye-hurting #FF00FF however dark everything else is. Dusty rose, pale pink
  and mauve are the failure this whole clause is about.

OUTPUT — read this twice, it is where every previous attempt failed:
· ONE image, exactly 512 x 512 pixels — square (1:1).
  If your tool has an aspect-ratio control, set it to match. Returns have
  come back at the tool's default ratio before, which overrides this line —
  the setting wins, so change the setting.
· ONE object. Not two, not a comparison, not variants side by side, not a
  before-and-after pair.
· No frame, border, card, label, caption, arrow, annotation or drop shadow.

---

# roller — The rolling boulder  (images/rounds/roller.webp)

Paint ONE game sprite in a single square (1:1) image.
The attached reference is exactly what to paint, at exactly the size and
position it is drawn at. Match both.

WHAT IT IS: The rolling boulder: a huge iron-banded stone sphere studded with rusted spikes, dark, with a rim light along its lower edge, seen face-on. The SPHERE is a full circle about three quarters of the frame across, centred — in the reference it spans from 12% to 88% of the width — and the spikes reach out from it into the margin around it, never crossing the frame edge. The sphere is what kills; keep it that size.

LEAVE OUT WHAT THE GAME PAINTS LIVE. The game scrolls its own bands over it to sell the roll, so paint it still.

STYLE — grim painted dark fantasy, like a plate from a gothic illustrated
bestiary or the key art of a dungeon crawler. Match this in every panel:
· INK FIRST. Heavy hand-drawn contour lines in near-black ink, jagged and
  confident, thick on the shadow side and thin on the lit side, with
  dry-brush breaks. The drawing must look DRAWN — scratchy linework showing
  through the paint.
· PAINTED, NOT RENDERED. Flat blocks of gouache-like paint inside the lines
  with visible brushwork, rough cel-style shadow shapes and a little grain.
  No airbrush, no smooth 3D shading, no plastic gloss.
· DESATURATED, LOW-KEY colour: bone, ash grey, dried blood, rust, bruise
  purple, swamp green, cold slate — with ONE hot accent per subject (ember
  orange, sickly witch-green, cold soul-blue, tarnished gold). Deep shadows
  that fall to black.
· HIGH CONTRAST and cold. The light comes from the UPPER LEFT. Chiaroscuro:
  most of every form in shadow, one edge picked out.
· Gothic, grotesque, worn: cracked bone, rusted iron, torn cloth, wet stone,
  candle-soot. Everything has been through something.
· Menacing rather than cute — but the SILHOUETTE stays readable at 40 px, so
  keep the big shapes simple and put the detail inside them.

AVOID — this is exactly how earlier attempts went wrong:
· NO cute, cozy, storybook, chibi or plush look. No rounded friendly faces,
  no button eyes, no smiles.
· NO candy-bright, saturated, neon or pastel colour. If it looks cheerful,
  it is wrong.
· NO glossy, plasticky, airbrushed mobile-game rendering. No smooth 3D
  volume, no bevelled edges, no lens flares, no rim-lit chrome.
· NO photorealism and no hyper-detailed fur or scales — this is paint, and it
  is read at thumbnail size.
· NO warm paper, parchment or sepia wash over the whole image. Warmth is an
  accent, not a filter, and the ground is not part of the painting.
· NO frames, borders, cards, vignettes, matting or paper background behind
  the drawing. Nothing but flat magenta behind it, right up to its outline.
· Keep the subject the same subject and silhouette it already has. This is a
  restyle, not a redesign.

SIZE AND PLACEMENT — this is the part that goes wrong.
Do not enlarge it to fill the frame. The reference leaves air around the
subject and that air is not waste — it is where the things drawn live around
it go. Keep the subject the same fraction of the frame that the reference
has it, in the same place.
· Do not rotate it or change the viewing angle.
· No cast shadow on the ground. The game draws its own.

BACKGROUND — read this before anything else. It matters more than the style.
Fill every pixel that is not the object itself with solid, flat, pure magenta
#FF00FF. Treat it as a green-screen: one flat chroma-key colour, edge to edge.
· EXACTLY #FF00FF — red 255, green 0, blue 255. Not pink, not rose, not dusty
  pink, not mauve, not a soft or tinted version of it. Only the true colour can
  be cut away cleanly; a near miss has to be flood-filled instead, and a flood
  fill eats any pale paint it can reach.
· NOT transparent. Transparency gets exported as a grey-and-white CHECKERBOARD
  and then baked into the artwork as though the squares were paint.
· NOT white, cream, black, parchment, paper, or any tinted or textured ground.
· The object must NOT sit on a card, panel, sheet, badge, frame or rectangle of
  any kind. The magenta must touch the outline of the object on every side.
· No drop shadow onto the background, and no vignette.
· The object itself must contain no magenta or hot pink.
· The dark, desaturated palette above is for the OBJECT. The ground is not
  part of the painting and is not toned down with it: it stays a vivid,
  eye-hurting #FF00FF however dark everything else is. Dusty rose, pale pink
  and mauve are the failure this whole clause is about.

OUTPUT — read this twice, it is where every previous attempt failed:
· ONE image, exactly 512 x 512 pixels — square (1:1).
  If your tool has an aspect-ratio control, set it to match. Returns have
  come back at the tool's default ratio before, which overrides this line —
  the setting wins, so change the setting.
· ONE object. Not two, not a comparison, not variants side by side, not a
  before-and-after pair.
· No frame, border, card, label, caption, arrow, annotation or drop shadow.

---

# meteor — The boss's rock  (images/rounds/meteor.webp)

Paint ONE game sprite in a single square (1:1) image.
The attached reference is exactly what to paint, at exactly the size and
position it is drawn at. Match both.

WHAT IT IS: The boss's falling rock: a jagged black stone wrapped in orange fire, a white-hot core around the stone, and a flame tail streaming UPWARD from it — it falls down the screen. The stone sits in the LOWER part of the frame with the tail reaching the top.

DRAW IT AT REST, falling: the stone low in the frame, the tail rising to the top edge. Do not add motion blur, speed lines or
a second copy of it: the game turns and moves it out of this one picture.

KEEP ANY GLOW TIGHT. A halo, aura or bloom spreading out into the background
is measured as part of the object when the return is fitted back onto the
reference — a wide aura therefore comes back as a tiny object inside a huge
smear. It also cannot be keyed: soft light over magenta turns pink rather
than transparent. Any glow belongs inside the shape's own outline, or within
a hair of it.

STYLE — grim painted dark fantasy, like a plate from a gothic illustrated
bestiary or the key art of a dungeon crawler. Match this in every panel:
· INK FIRST. Heavy hand-drawn contour lines in near-black ink, jagged and
  confident, thick on the shadow side and thin on the lit side, with
  dry-brush breaks. The drawing must look DRAWN — scratchy linework showing
  through the paint.
· PAINTED, NOT RENDERED. Flat blocks of gouache-like paint inside the lines
  with visible brushwork, rough cel-style shadow shapes and a little grain.
  No airbrush, no smooth 3D shading, no plastic gloss.
· DESATURATED, LOW-KEY colour: bone, ash grey, dried blood, rust, bruise
  purple, swamp green, cold slate — with ONE hot accent per subject (ember
  orange, sickly witch-green, cold soul-blue, tarnished gold). Deep shadows
  that fall to black.
· HIGH CONTRAST and cold. The light comes from the UPPER LEFT. Chiaroscuro:
  most of every form in shadow, one edge picked out.
· Gothic, grotesque, worn: cracked bone, rusted iron, torn cloth, wet stone,
  candle-soot. Everything has been through something.
· Menacing rather than cute — but the SILHOUETTE stays readable at 40 px, so
  keep the big shapes simple and put the detail inside them.

AVOID — this is exactly how earlier attempts went wrong:
· NO cute, cozy, storybook, chibi or plush look. No rounded friendly faces,
  no button eyes, no smiles.
· NO candy-bright, saturated, neon or pastel colour. If it looks cheerful,
  it is wrong.
· NO glossy, plasticky, airbrushed mobile-game rendering. No smooth 3D
  volume, no bevelled edges, no lens flares, no rim-lit chrome.
· NO photorealism and no hyper-detailed fur or scales — this is paint, and it
  is read at thumbnail size.
· NO warm paper, parchment or sepia wash over the whole image. Warmth is an
  accent, not a filter, and the ground is not part of the painting.
· NO frames, borders, cards, vignettes, matting or paper background behind
  the drawing. Nothing but flat magenta behind it, right up to its outline.
· Keep the subject the same subject and silhouette it already has. This is a
  restyle, not a redesign.

SIZE AND PLACEMENT — this is the part that goes wrong.
Do not enlarge it to fill the frame. The reference leaves air around the
subject and that air is not waste — it is where the things drawn live around
it go. Keep the subject the same fraction of the frame that the reference
has it, in the same place.
· Its bottom edge must land at the same height from the bottom of the
  frame as the reference has it — the game registers the return by it.
· Do not rotate it or change the viewing angle.
· No cast shadow on the ground. The game draws its own.

BACKGROUND — read this before anything else. It matters more than the style.
Fill every pixel that is not the object itself with solid, flat, pure magenta
#FF00FF. Treat it as a green-screen: one flat chroma-key colour, edge to edge.
· EXACTLY #FF00FF — red 255, green 0, blue 255. Not pink, not rose, not dusty
  pink, not mauve, not a soft or tinted version of it. Only the true colour can
  be cut away cleanly; a near miss has to be flood-filled instead, and a flood
  fill eats any pale paint it can reach.
· NOT transparent. Transparency gets exported as a grey-and-white CHECKERBOARD
  and then baked into the artwork as though the squares were paint.
· NOT white, cream, black, parchment, paper, or any tinted or textured ground.
· The object must NOT sit on a card, panel, sheet, badge, frame or rectangle of
  any kind. The magenta must touch the outline of the object on every side.
· No drop shadow onto the background, and no vignette.
· The object itself must contain no magenta or hot pink.
· The dark, desaturated palette above is for the OBJECT. The ground is not
  part of the painting and is not toned down with it: it stays a vivid,
  eye-hurting #FF00FF however dark everything else is. Dusty rose, pale pink
  and mauve are the failure this whole clause is about.

OUTPUT — read this twice, it is where every previous attempt failed:
· ONE image, exactly 512 x 512 pixels — square (1:1).
  If your tool has an aspect-ratio control, set it to match. Returns have
  come back at the tool's default ratio before, which overrides this line —
  the setting wins, so change the setting.
· ONE object. Not two, not a comparison, not variants side by side, not a
  before-and-after pair.
· No frame, border, card, label, caption, arrow, annotation or drop shadow.

---

# bomb — The bomber's charge  (images/rounds/bomb.webp)

Paint ONE game sprite in a single square (1:1) image.
The attached reference is exactly what to paint, at exactly the size and
position it is drawn at. Match both.

WHAT IT IS: The bomber's charge: a black iron bomb with a lit fuse and a tight ember glow around it. Centred, about half the frame across.

LEAVE OUT WHAT THE GAME PAINTS LIVE. The spark walking down the fuse is painted live, so no spark.

KEEP ANY GLOW TIGHT. A halo, aura or bloom spreading out into the background
is measured as part of the object when the return is fitted back onto the
reference — a wide aura therefore comes back as a tiny object inside a huge
smear. It also cannot be keyed: soft light over magenta turns pink rather
than transparent. Any glow belongs inside the shape's own outline, or within
a hair of it.

STYLE — grim painted dark fantasy, like a plate from a gothic illustrated
bestiary or the key art of a dungeon crawler. Match this in every panel:
· INK FIRST. Heavy hand-drawn contour lines in near-black ink, jagged and
  confident, thick on the shadow side and thin on the lit side, with
  dry-brush breaks. The drawing must look DRAWN — scratchy linework showing
  through the paint.
· PAINTED, NOT RENDERED. Flat blocks of gouache-like paint inside the lines
  with visible brushwork, rough cel-style shadow shapes and a little grain.
  No airbrush, no smooth 3D shading, no plastic gloss.
· DESATURATED, LOW-KEY colour: bone, ash grey, dried blood, rust, bruise
  purple, swamp green, cold slate — with ONE hot accent per subject (ember
  orange, sickly witch-green, cold soul-blue, tarnished gold). Deep shadows
  that fall to black.
· HIGH CONTRAST and cold. The light comes from the UPPER LEFT. Chiaroscuro:
  most of every form in shadow, one edge picked out.
· Gothic, grotesque, worn: cracked bone, rusted iron, torn cloth, wet stone,
  candle-soot. Everything has been through something.
· Menacing rather than cute — but the SILHOUETTE stays readable at 40 px, so
  keep the big shapes simple and put the detail inside them.

AVOID — this is exactly how earlier attempts went wrong:
· NO cute, cozy, storybook, chibi or plush look. No rounded friendly faces,
  no button eyes, no smiles.
· NO candy-bright, saturated, neon or pastel colour. If it looks cheerful,
  it is wrong.
· NO glossy, plasticky, airbrushed mobile-game rendering. No smooth 3D
  volume, no bevelled edges, no lens flares, no rim-lit chrome.
· NO photorealism and no hyper-detailed fur or scales — this is paint, and it
  is read at thumbnail size.
· NO warm paper, parchment or sepia wash over the whole image. Warmth is an
  accent, not a filter, and the ground is not part of the painting.
· NO frames, borders, cards, vignettes, matting or paper background behind
  the drawing. Nothing but flat magenta behind it, right up to its outline.
· Keep the subject the same subject and silhouette it already has. This is a
  restyle, not a redesign.

SIZE AND PLACEMENT — this is the part that goes wrong.
Do not enlarge it to fill the frame. The reference leaves air around the
subject and that air is not waste — it is where the things drawn live around
it go. Keep the subject the same fraction of the frame that the reference
has it, in the same place.
· Do not rotate it or change the viewing angle.
· No cast shadow on the ground. The game draws its own.

BACKGROUND — read this before anything else. It matters more than the style.
Fill every pixel that is not the object itself with solid, flat, pure magenta
#FF00FF. Treat it as a green-screen: one flat chroma-key colour, edge to edge.
· EXACTLY #FF00FF — red 255, green 0, blue 255. Not pink, not rose, not dusty
  pink, not mauve, not a soft or tinted version of it. Only the true colour can
  be cut away cleanly; a near miss has to be flood-filled instead, and a flood
  fill eats any pale paint it can reach.
· NOT transparent. Transparency gets exported as a grey-and-white CHECKERBOARD
  and then baked into the artwork as though the squares were paint.
· NOT white, cream, black, parchment, paper, or any tinted or textured ground.
· The object must NOT sit on a card, panel, sheet, badge, frame or rectangle of
  any kind. The magenta must touch the outline of the object on every side.
· No drop shadow onto the background, and no vignette.
· The object itself must contain no magenta or hot pink.
· The dark, desaturated palette above is for the OBJECT. The ground is not
  part of the painting and is not toned down with it: it stays a vivid,
  eye-hurting #FF00FF however dark everything else is. Dusty rose, pale pink
  and mauve are the failure this whole clause is about.

OUTPUT — read this twice, it is where every previous attempt failed:
· ONE image, exactly 512 x 512 pixels — square (1:1).
  If your tool has an aspect-ratio control, set it to match. Returns have
  come back at the tool's default ratio before, which overrides this line —
  the setting wins, so change the setting.
· ONE object. Not two, not a comparison, not variants side by side, not a
  before-and-after pair.
· No frame, border, card, label, caption, arrow, annotation or drop shadow.

---

# grenade — The player's grenade  (images/rounds/grenade.webp)

Paint ONE game sprite in a single square (1:1) image.
The attached reference is exactly what to paint, at exactly the size and
position it is drawn at. Match both.

WHAT IT IS: The player's grenade: a small iron-grey sphere with a band across its middle, centred, filling most of the frame.

DRAW IT AT REST, level: it tumbles in flight and the game turns it. Do not add motion blur, speed lines or
a second copy of it: the game turns and moves it out of this one picture.

STYLE — grim painted dark fantasy, like a plate from a gothic illustrated
bestiary or the key art of a dungeon crawler. Match this in every panel:
· INK FIRST. Heavy hand-drawn contour lines in near-black ink, jagged and
  confident, thick on the shadow side and thin on the lit side, with
  dry-brush breaks. The drawing must look DRAWN — scratchy linework showing
  through the paint.
· PAINTED, NOT RENDERED. Flat blocks of gouache-like paint inside the lines
  with visible brushwork, rough cel-style shadow shapes and a little grain.
  No airbrush, no smooth 3D shading, no plastic gloss.
· DESATURATED, LOW-KEY colour: bone, ash grey, dried blood, rust, bruise
  purple, swamp green, cold slate — with ONE hot accent per subject (ember
  orange, sickly witch-green, cold soul-blue, tarnished gold). Deep shadows
  that fall to black.
· HIGH CONTRAST and cold. The light comes from the UPPER LEFT. Chiaroscuro:
  most of every form in shadow, one edge picked out.
· Gothic, grotesque, worn: cracked bone, rusted iron, torn cloth, wet stone,
  candle-soot. Everything has been through something.
· Menacing rather than cute — but the SILHOUETTE stays readable at 40 px, so
  keep the big shapes simple and put the detail inside them.

AVOID — this is exactly how earlier attempts went wrong:
· NO cute, cozy, storybook, chibi or plush look. No rounded friendly faces,
  no button eyes, no smiles.
· NO candy-bright, saturated, neon or pastel colour. If it looks cheerful,
  it is wrong.
· NO glossy, plasticky, airbrushed mobile-game rendering. No smooth 3D
  volume, no bevelled edges, no lens flares, no rim-lit chrome.
· NO photorealism and no hyper-detailed fur or scales — this is paint, and it
  is read at thumbnail size.
· NO warm paper, parchment or sepia wash over the whole image. Warmth is an
  accent, not a filter, and the ground is not part of the painting.
· NO frames, borders, cards, vignettes, matting or paper background behind
  the drawing. Nothing but flat magenta behind it, right up to its outline.
· Keep the subject the same subject and silhouette it already has. This is a
  restyle, not a redesign.

SIZE AND PLACEMENT — this is the part that goes wrong.
Do not enlarge it to fill the frame. The reference leaves air around the
subject and that air is not waste — it is where the things drawn live around
it go. Keep the subject the same fraction of the frame that the reference
has it, in the same place.
· Do not rotate it or change the viewing angle.
· No cast shadow on the ground. The game draws its own.

BACKGROUND — read this before anything else. It matters more than the style.
Fill every pixel that is not the object itself with solid, flat, pure magenta
#FF00FF. Treat it as a green-screen: one flat chroma-key colour, edge to edge.
· EXACTLY #FF00FF — red 255, green 0, blue 255. Not pink, not rose, not dusty
  pink, not mauve, not a soft or tinted version of it. Only the true colour can
  be cut away cleanly; a near miss has to be flood-filled instead, and a flood
  fill eats any pale paint it can reach.
· NOT transparent. Transparency gets exported as a grey-and-white CHECKERBOARD
  and then baked into the artwork as though the squares were paint.
· NOT white, cream, black, parchment, paper, or any tinted or textured ground.
· The object must NOT sit on a card, panel, sheet, badge, frame or rectangle of
  any kind. The magenta must touch the outline of the object on every side.
· No drop shadow onto the background, and no vignette.
· The object itself must contain no magenta or hot pink.
· The dark, desaturated palette above is for the OBJECT. The ground is not
  part of the painting and is not toned down with it: it stays a vivid,
  eye-hurting #FF00FF however dark everything else is. Dusty rose, pale pink
  and mauve are the failure this whole clause is about.

OUTPUT — read this twice, it is where every previous attempt failed:
· ONE image, exactly 512 x 512 pixels — square (1:1).
  If your tool has an aspect-ratio control, set it to match. Returns have
  come back at the tool's default ratio before, which overrides this line —
  the setting wins, so change the setting.
· ONE object. Not two, not a comparison, not variants side by side, not a
  before-and-after pair.
· No frame, border, card, label, caption, arrow, annotation or drop shadow.

---

# rocket — The launcher's rocket  (images/rounds/rocket.webp)

Paint ONE game sprite in a single portrait, 9:16 image.
The attached reference is exactly what to paint, at exactly the size and
position it is drawn at. Match both.

WHAT IT IS: The launcher's rocket in flight, nose up: a fat black-iron shell with a blunt warhead, a band of rust round its middle, two or three swept fins at its tail, and a hot exhaust plume streaming DOWN from it — a white-gold core inside ember-orange flame that frays into smoke. The SHELL sits in the upper part of the frame with its nose a little below the top edge and is about half the frame's width; the PLUME runs from the fins down to the bottom edge and may be as wide as the frame. It is the heaviest thing the player fires, so it must read as iron, not as a spark.

LEAVE OUT WHAT THE GAME PAINTS LIVE. The blast when it lands is painted live, so no explosion, no smoke ring, just the shell in flight.

DRAW IT AT REST, pointing UP: it flies up the screen nose first, so the warhead is at the TOP and the plume trails DOWN. The game turns it to its heading. Do not add motion blur, speed lines or
a second copy of it: the game turns and moves it out of this one picture.

KEEP ANY GLOW TIGHT. A halo, aura or bloom spreading out into the background
is measured as part of the object when the return is fitted back onto the
reference — a wide aura therefore comes back as a tiny object inside a huge
smear. It also cannot be keyed: soft light over magenta turns pink rather
than transparent. Any glow belongs inside the shape's own outline, or within
a hair of it.

STYLE — grim painted dark fantasy, like a plate from a gothic illustrated
bestiary or the key art of a dungeon crawler. Match this in every panel:
· INK FIRST. Heavy hand-drawn contour lines in near-black ink, jagged and
  confident, thick on the shadow side and thin on the lit side, with
  dry-brush breaks. The drawing must look DRAWN — scratchy linework showing
  through the paint.
· PAINTED, NOT RENDERED. Flat blocks of gouache-like paint inside the lines
  with visible brushwork, rough cel-style shadow shapes and a little grain.
  No airbrush, no smooth 3D shading, no plastic gloss.
· DESATURATED, LOW-KEY colour: bone, ash grey, dried blood, rust, bruise
  purple, swamp green, cold slate — with ONE hot accent per subject (ember
  orange, sickly witch-green, cold soul-blue, tarnished gold). Deep shadows
  that fall to black.
· HIGH CONTRAST and cold. The light comes from the UPPER LEFT. Chiaroscuro:
  most of every form in shadow, one edge picked out.
· Gothic, grotesque, worn: cracked bone, rusted iron, torn cloth, wet stone,
  candle-soot. Everything has been through something.
· Menacing rather than cute — but the SILHOUETTE stays readable at 40 px, so
  keep the big shapes simple and put the detail inside them.

AVOID — this is exactly how earlier attempts went wrong:
· NO cute, cozy, storybook, chibi or plush look. No rounded friendly faces,
  no button eyes, no smiles.
· NO candy-bright, saturated, neon or pastel colour. If it looks cheerful,
  it is wrong.
· NO glossy, plasticky, airbrushed mobile-game rendering. No smooth 3D
  volume, no bevelled edges, no lens flares, no rim-lit chrome.
· NO photorealism and no hyper-detailed fur or scales — this is paint, and it
  is read at thumbnail size.
· NO warm paper, parchment or sepia wash over the whole image. Warmth is an
  accent, not a filter, and the ground is not part of the painting.
· NO frames, borders, cards, vignettes, matting or paper background behind
  the drawing. Nothing but flat magenta behind it, right up to its outline.
· Keep the subject the same subject and silhouette it already has. This is a
  restyle, not a redesign.

SIZE AND PLACEMENT — this is the part that goes wrong.
Do not enlarge it to fill the frame. The reference leaves air around the
subject and that air is not waste — it is where the things drawn live around
it go. Keep the subject the same fraction of the frame that the reference
has it, in the same place.
· Do not rotate it or change the viewing angle.
· No cast shadow on the ground. The game draws its own.

BACKGROUND — read this before anything else. It matters more than the style.
Fill every pixel that is not the object itself with solid, flat, pure magenta
#FF00FF. Treat it as a green-screen: one flat chroma-key colour, edge to edge.
· EXACTLY #FF00FF — red 255, green 0, blue 255. Not pink, not rose, not dusty
  pink, not mauve, not a soft or tinted version of it. Only the true colour can
  be cut away cleanly; a near miss has to be flood-filled instead, and a flood
  fill eats any pale paint it can reach.
· NOT transparent. Transparency gets exported as a grey-and-white CHECKERBOARD
  and then baked into the artwork as though the squares were paint.
· NOT white, cream, black, parchment, paper, or any tinted or textured ground.
· The object must NOT sit on a card, panel, sheet, badge, frame or rectangle of
  any kind. The magenta must touch the outline of the object on every side.
· No drop shadow onto the background, and no vignette.
· The object itself must contain no magenta or hot pink.
· The dark, desaturated palette above is for the OBJECT. The ground is not
  part of the painting and is not toned down with it: it stays a vivid,
  eye-hurting #FF00FF however dark everything else is. Dusty rose, pale pink
  and mauve are the failure this whole clause is about.

OUTPUT — read this twice, it is where every previous attempt failed:
· ONE image, exactly 288 x 512 pixels — portrait, 9:16.
  If your tool has an aspect-ratio control, set it to match. Returns have
  come back at the tool's default ratio before, which overrides this line —
  the setting wins, so change the setting.
· ONE object. Not two, not a comparison, not variants side by side, not a
  before-and-after pair.
· No frame, border, card, label, caption, arrow, annotation or drop shadow.

---

# muzzle — Muzzle flash  (images/fx/muzzle.webp)

Paint ONE game sprite in a single square (1:1) image.
The attached reference is exactly what to paint, at exactly the size and
position it is drawn at. Match both.

WHAT IT IS: A muzzle flash: a hot white-gold burst, spiky, TIGHT, with an ember-orange fringe. It is drawn additively over the road, so dark pixels add nothing and the shape has to carry itself in light alone. Centred, filling most of the frame — but every spike stays inside the frame edge, nothing touches it.

KEEP ANY GLOW TIGHT. A halo, aura or bloom spreading out into the background
is measured as part of the object when the return is fitted back onto the
reference — a wide aura therefore comes back as a tiny object inside a huge
smear. It also cannot be keyed: soft light over magenta turns pink rather
than transparent. Any glow belongs inside the shape's own outline, or within
a hair of it.

STYLE — grim painted dark fantasy, like a plate from a gothic illustrated
bestiary or the key art of a dungeon crawler. Match this in every panel:
· INK FIRST. Heavy hand-drawn contour lines in near-black ink, jagged and
  confident, thick on the shadow side and thin on the lit side, with
  dry-brush breaks. The drawing must look DRAWN — scratchy linework showing
  through the paint.
· PAINTED, NOT RENDERED. Flat blocks of gouache-like paint inside the lines
  with visible brushwork, rough cel-style shadow shapes and a little grain.
  No airbrush, no smooth 3D shading, no plastic gloss.
· DESATURATED, LOW-KEY colour: bone, ash grey, dried blood, rust, bruise
  purple, swamp green, cold slate — with ONE hot accent per subject (ember
  orange, sickly witch-green, cold soul-blue, tarnished gold). Deep shadows
  that fall to black.
· HIGH CONTRAST and cold. The light comes from the UPPER LEFT. Chiaroscuro:
  most of every form in shadow, one edge picked out.
· Gothic, grotesque, worn: cracked bone, rusted iron, torn cloth, wet stone,
  candle-soot. Everything has been through something.
· Menacing rather than cute — but the SILHOUETTE stays readable at 40 px, so
  keep the big shapes simple and put the detail inside them.

AVOID — this is exactly how earlier attempts went wrong:
· NO cute, cozy, storybook, chibi or plush look. No rounded friendly faces,
  no button eyes, no smiles.
· NO candy-bright, saturated, neon or pastel colour. If it looks cheerful,
  it is wrong.
· NO glossy, plasticky, airbrushed mobile-game rendering. No smooth 3D
  volume, no bevelled edges, no lens flares, no rim-lit chrome.
· NO photorealism and no hyper-detailed fur or scales — this is paint, and it
  is read at thumbnail size.
· NO warm paper, parchment or sepia wash over the whole image. Warmth is an
  accent, not a filter, and the ground is not part of the painting.
· NO frames, borders, cards, vignettes, matting or paper background behind
  the drawing. Nothing but flat magenta behind it, right up to its outline.
· Keep the subject the same subject and silhouette it already has. This is a
  restyle, not a redesign.

SIZE AND PLACEMENT — this is the part that goes wrong.
Do not enlarge it to fill the frame. The reference leaves air around the
subject and that air is not waste — it is where the things drawn live around
it go. Keep the subject the same fraction of the frame that the reference
has it, in the same place.
· Do not rotate it or change the viewing angle.
· No cast shadow on the ground. The game draws its own.

BACKGROUND — read this before anything else. It matters more than the style.
Fill every pixel that is not the object itself with solid, flat, pure magenta
#FF00FF. Treat it as a green-screen: one flat chroma-key colour, edge to edge.
· EXACTLY #FF00FF — red 255, green 0, blue 255. Not pink, not rose, not dusty
  pink, not mauve, not a soft or tinted version of it. Only the true colour can
  be cut away cleanly; a near miss has to be flood-filled instead, and a flood
  fill eats any pale paint it can reach.
· NOT transparent. Transparency gets exported as a grey-and-white CHECKERBOARD
  and then baked into the artwork as though the squares were paint.
· NOT white, cream, black, parchment, paper, or any tinted or textured ground.
· The object must NOT sit on a card, panel, sheet, badge, frame or rectangle of
  any kind. The magenta must touch the outline of the object on every side.
· No drop shadow onto the background, and no vignette.
· The object itself must contain no magenta or hot pink.
· The dark, desaturated palette above is for the OBJECT. The ground is not
  part of the painting and is not toned down with it: it stays a vivid,
  eye-hurting #FF00FF however dark everything else is. Dusty rose, pale pink
  and mauve are the failure this whole clause is about.

OUTPUT — read this twice, it is where every previous attempt failed:
· ONE image, exactly 512 x 512 pixels — square (1:1).
  If your tool has an aspect-ratio control, set it to match. Returns have
  come back at the tool's default ratio before, which overrides this line —
  the setting wins, so change the setting.
· ONE object. Not two, not a comparison, not variants side by side, not a
  before-and-after pair.
· No frame, border, card, label, caption, arrow, annotation or drop shadow.

---

# smoke — Smoke puff  (images/fx/smoke.webp)

Paint ONE game sprite in a single square (1:1) image.
The attached reference is exactly what to paint, at exactly the size and
position it is drawn at. Match both.

WHAT IT IS: A smoke puff: a soft round cloud, densest in the middle, fading to nothing at its edge. Centred, filling the frame.

GREYSCALE ONLY. Paint it in white through grey with alpha — no colour
at all. The game tints it per emitter (dust, soot, blood), and any colour
painted in here fights every one of those tints.

STYLE — grim painted dark fantasy, like a plate from a gothic illustrated
bestiary or the key art of a dungeon crawler. Match this in every panel:
· INK FIRST. Heavy hand-drawn contour lines in near-black ink, jagged and
  confident, thick on the shadow side and thin on the lit side, with
  dry-brush breaks. The drawing must look DRAWN — scratchy linework showing
  through the paint.
· PAINTED, NOT RENDERED. Flat blocks of gouache-like paint inside the lines
  with visible brushwork, rough cel-style shadow shapes and a little grain.
  No airbrush, no smooth 3D shading, no plastic gloss.
· DESATURATED, LOW-KEY colour: bone, ash grey, dried blood, rust, bruise
  purple, swamp green, cold slate — with ONE hot accent per subject (ember
  orange, sickly witch-green, cold soul-blue, tarnished gold). Deep shadows
  that fall to black.
· HIGH CONTRAST and cold. The light comes from the UPPER LEFT. Chiaroscuro:
  most of every form in shadow, one edge picked out.
· Gothic, grotesque, worn: cracked bone, rusted iron, torn cloth, wet stone,
  candle-soot. Everything has been through something.
· Menacing rather than cute — but the SILHOUETTE stays readable at 40 px, so
  keep the big shapes simple and put the detail inside them.

AVOID — this is exactly how earlier attempts went wrong:
· NO cute, cozy, storybook, chibi or plush look. No rounded friendly faces,
  no button eyes, no smiles.
· NO candy-bright, saturated, neon or pastel colour. If it looks cheerful,
  it is wrong.
· NO glossy, plasticky, airbrushed mobile-game rendering. No smooth 3D
  volume, no bevelled edges, no lens flares, no rim-lit chrome.
· NO photorealism and no hyper-detailed fur or scales — this is paint, and it
  is read at thumbnail size.
· NO warm paper, parchment or sepia wash over the whole image. Warmth is an
  accent, not a filter, and the ground is not part of the painting.
· NO frames, borders, cards, vignettes, matting or paper background behind
  the drawing. Nothing but flat magenta behind it, right up to its outline.
· Keep the subject the same subject and silhouette it already has. This is a
  restyle, not a redesign.

SIZE AND PLACEMENT — this is the part that goes wrong.
Do not enlarge it to fill the frame. The reference leaves air around the
subject and that air is not waste — it is where the things drawn live around
it go. Keep the subject the same fraction of the frame that the reference
has it, in the same place.
· Do not rotate it or change the viewing angle.
· No cast shadow on the ground. The game draws its own.

BACKGROUND — read this before anything else. It matters more than the style.
Fill every pixel that is not the object itself with solid, flat, pure magenta
#FF00FF. Treat it as a green-screen: one flat chroma-key colour, edge to edge.
· EXACTLY #FF00FF — red 255, green 0, blue 255. Not pink, not rose, not dusty
  pink, not mauve, not a soft or tinted version of it. Only the true colour can
  be cut away cleanly; a near miss has to be flood-filled instead, and a flood
  fill eats any pale paint it can reach.
· NOT transparent. Transparency gets exported as a grey-and-white CHECKERBOARD
  and then baked into the artwork as though the squares were paint.
· NOT white, cream, black, parchment, paper, or any tinted or textured ground.
· The object must NOT sit on a card, panel, sheet, badge, frame or rectangle of
  any kind. The magenta must touch the outline of the object on every side.
· No drop shadow onto the background, and no vignette.
· The object itself must contain no magenta or hot pink.
· The dark, desaturated palette above is for the OBJECT. The ground is not
  part of the painting and is not toned down with it: it stays a vivid,
  eye-hurting #FF00FF however dark everything else is. Dusty rose, pale pink
  and mauve are the failure this whole clause is about.

OUTPUT — read this twice, it is where every previous attempt failed:
· ONE image, exactly 512 x 512 pixels — square (1:1).
  If your tool has an aspect-ratio control, set it to match. Returns have
  come back at the tool's default ratio before, which overrides this line —
  the setting wins, so change the setting.
· ONE object. Not two, not a comparison, not variants side by side, not a
  before-and-after pair.
· No frame, border, card, label, caption, arrow, annotation or drop shadow.

---

# scorch — Scorch mark  (images/fx/scorch.webp)

Paint ONE game sprite in a single landscape, 1.82:1 image.
The attached reference is exactly what to paint, at exactly the size and
position it is drawn at. Match both.

WHAT IT IS: A scorch mark on the road: a soft black-charcoal burn, an ellipse wider than it is tall, darkest in the middle, fading out to nothing at its edge. Charcoal only — no colour, no embers.

STYLE — grim painted dark fantasy, like a plate from a gothic illustrated
bestiary or the key art of a dungeon crawler. Match this in every panel:
· INK FIRST. Heavy hand-drawn contour lines in near-black ink, jagged and
  confident, thick on the shadow side and thin on the lit side, with
  dry-brush breaks. The drawing must look DRAWN — scratchy linework showing
  through the paint.
· PAINTED, NOT RENDERED. Flat blocks of gouache-like paint inside the lines
  with visible brushwork, rough cel-style shadow shapes and a little grain.
  No airbrush, no smooth 3D shading, no plastic gloss.
· DESATURATED, LOW-KEY colour: bone, ash grey, dried blood, rust, bruise
  purple, swamp green, cold slate — with ONE hot accent per subject (ember
  orange, sickly witch-green, cold soul-blue, tarnished gold). Deep shadows
  that fall to black.
· HIGH CONTRAST and cold. The light comes from the UPPER LEFT. Chiaroscuro:
  most of every form in shadow, one edge picked out.
· Gothic, grotesque, worn: cracked bone, rusted iron, torn cloth, wet stone,
  candle-soot. Everything has been through something.
· Menacing rather than cute — but the SILHOUETTE stays readable at 40 px, so
  keep the big shapes simple and put the detail inside them.

AVOID — this is exactly how earlier attempts went wrong:
· NO cute, cozy, storybook, chibi or plush look. No rounded friendly faces,
  no button eyes, no smiles.
· NO candy-bright, saturated, neon or pastel colour. If it looks cheerful,
  it is wrong.
· NO glossy, plasticky, airbrushed mobile-game rendering. No smooth 3D
  volume, no bevelled edges, no lens flares, no rim-lit chrome.
· NO photorealism and no hyper-detailed fur or scales — this is paint, and it
  is read at thumbnail size.
· NO warm paper, parchment or sepia wash over the whole image. Warmth is an
  accent, not a filter, and the ground is not part of the painting.
· NO frames, borders, cards, vignettes, matting or paper background behind
  the drawing. Nothing but flat magenta behind it, right up to its outline.
· Keep the subject the same subject and silhouette it already has. This is a
  restyle, not a redesign.

SIZE AND PLACEMENT — this is the part that goes wrong.
Do not enlarge it to fill the frame. The reference leaves air around the
subject and that air is not waste — it is where the things drawn live around
it go. Keep the subject the same fraction of the frame that the reference
has it, in the same place.
· Do not rotate it or change the viewing angle.
· No cast shadow on the ground. The game draws its own.

BACKGROUND — read this before anything else. It matters more than the style.
Fill every pixel that is not the object itself with solid, flat, pure magenta
#FF00FF. Treat it as a green-screen: one flat chroma-key colour, edge to edge.
· EXACTLY #FF00FF — red 255, green 0, blue 255. Not pink, not rose, not dusty
  pink, not mauve, not a soft or tinted version of it. Only the true colour can
  be cut away cleanly; a near miss has to be flood-filled instead, and a flood
  fill eats any pale paint it can reach.
· NOT transparent. Transparency gets exported as a grey-and-white CHECKERBOARD
  and then baked into the artwork as though the squares were paint.
· NOT white, cream, black, parchment, paper, or any tinted or textured ground.
· The object must NOT sit on a card, panel, sheet, badge, frame or rectangle of
  any kind. The magenta must touch the outline of the object on every side.
· No drop shadow onto the background, and no vignette.
· The object itself must contain no magenta or hot pink.
· The dark, desaturated palette above is for the OBJECT. The ground is not
  part of the painting and is not toned down with it: it stays a vivid,
  eye-hurting #FF00FF however dark everything else is. Dusty rose, pale pink
  and mauve are the failure this whole clause is about.

OUTPUT — read this twice, it is where every previous attempt failed:
· ONE image, exactly 512 x 282 pixels — landscape, 1.82:1.
  If your tool has an aspect-ratio control, set it to match. Returns have
  come back at the tool's default ratio before, which overrides this line —
  the setting wins, so change the setting.
· ONE object. Not two, not a comparison, not variants side by side, not a
  before-and-after pair.
· No frame, border, card, label, caption, arrow, annotation or drop shadow.

---

# ring-shock — Shockwave ring  (images/fx/ring-shock.webp)

Paint ONE game sprite in a single square (1:1) image.
The attached reference is exactly what to paint, at exactly the size and
position it is drawn at. Match both.

WHAT IT IS: A shockwave ring: a thin bright white-blue ring, a full circle seen from above, with a hard inner edge and a soft outer glow. TRANSPARENT INSIDE — the ring is stretched flat over the road. The ring itself spans about 89% of the frame, exactly as the reference has it; the glow outside it stays inside the frame edge.

KEEP ANY GLOW TIGHT. A halo, aura or bloom spreading out into the background
is measured as part of the object when the return is fitted back onto the
reference — a wide aura therefore comes back as a tiny object inside a huge
smear. It also cannot be keyed: soft light over magenta turns pink rather
than transparent. Any glow belongs inside the shape's own outline, or within
a hair of it.

STYLE — grim painted dark fantasy, like a plate from a gothic illustrated
bestiary or the key art of a dungeon crawler. Match this in every panel:
· INK FIRST. Heavy hand-drawn contour lines in near-black ink, jagged and
  confident, thick on the shadow side and thin on the lit side, with
  dry-brush breaks. The drawing must look DRAWN — scratchy linework showing
  through the paint.
· PAINTED, NOT RENDERED. Flat blocks of gouache-like paint inside the lines
  with visible brushwork, rough cel-style shadow shapes and a little grain.
  No airbrush, no smooth 3D shading, no plastic gloss.
· DESATURATED, LOW-KEY colour: bone, ash grey, dried blood, rust, bruise
  purple, swamp green, cold slate — with ONE hot accent per subject (ember
  orange, sickly witch-green, cold soul-blue, tarnished gold). Deep shadows
  that fall to black.
· HIGH CONTRAST and cold. The light comes from the UPPER LEFT. Chiaroscuro:
  most of every form in shadow, one edge picked out.
· Gothic, grotesque, worn: cracked bone, rusted iron, torn cloth, wet stone,
  candle-soot. Everything has been through something.
· Menacing rather than cute — but the SILHOUETTE stays readable at 40 px, so
  keep the big shapes simple and put the detail inside them.

AVOID — this is exactly how earlier attempts went wrong:
· NO cute, cozy, storybook, chibi or plush look. No rounded friendly faces,
  no button eyes, no smiles.
· NO candy-bright, saturated, neon or pastel colour. If it looks cheerful,
  it is wrong.
· NO glossy, plasticky, airbrushed mobile-game rendering. No smooth 3D
  volume, no bevelled edges, no lens flares, no rim-lit chrome.
· NO photorealism and no hyper-detailed fur or scales — this is paint, and it
  is read at thumbnail size.
· NO warm paper, parchment or sepia wash over the whole image. Warmth is an
  accent, not a filter, and the ground is not part of the painting.
· NO frames, borders, cards, vignettes, matting or paper background behind
  the drawing. Nothing but flat magenta behind it, right up to its outline.
· Keep the subject the same subject and silhouette it already has. This is a
  restyle, not a redesign.

SIZE AND PLACEMENT — this is the part that goes wrong.
Do not enlarge it to fill the frame. The reference leaves air around the
subject and that air is not waste — it is where the things drawn live around
it go. Keep the subject the same fraction of the frame that the reference
has it, in the same place.
· Do not rotate it or change the viewing angle.
· No cast shadow on the ground. The game draws its own.

BACKGROUND — read this before anything else. It matters more than the style.
Fill every pixel that is not the object itself with solid, flat, pure magenta
#FF00FF. Treat it as a green-screen: one flat chroma-key colour, edge to edge.
· EXACTLY #FF00FF — red 255, green 0, blue 255. Not pink, not rose, not dusty
  pink, not mauve, not a soft or tinted version of it. Only the true colour can
  be cut away cleanly; a near miss has to be flood-filled instead, and a flood
  fill eats any pale paint it can reach.
· NOT transparent. Transparency gets exported as a grey-and-white CHECKERBOARD
  and then baked into the artwork as though the squares were paint.
· NOT white, cream, black, parchment, paper, or any tinted or textured ground.
· The object must NOT sit on a card, panel, sheet, badge, frame or rectangle of
  any kind. The magenta must touch the outline of the object on every side.
· No drop shadow onto the background, and no vignette.
· The object itself must contain no magenta or hot pink.
· The dark, desaturated palette above is for the OBJECT. The ground is not
  part of the painting and is not toned down with it: it stays a vivid,
  eye-hurting #FF00FF however dark everything else is. Dusty rose, pale pink
  and mauve are the failure this whole clause is about.

OUTPUT — read this twice, it is where every previous attempt failed:
· ONE image, exactly 512 x 512 pixels — square (1:1).
  If your tool has an aspect-ratio control, set it to match. Returns have
  come back at the tool's default ratio before, which overrides this line —
  the setting wins, so change the setting.
· ONE object. Not two, not a comparison, not variants side by side, not a
  before-and-after pair.
· No frame, border, card, label, caption, arrow, annotation or drop shadow.

---

# ring-heat — Slam telegraph ring  (images/fx/ring-heat.webp)

Paint ONE game sprite in a single square (1:1) image.
The attached reference is exactly what to paint, at exactly the size and
position it is drawn at. Match both.

WHAT IT IS: A slam telegraph ring: a thin ember-orange ring, a full circle, hard edge inside, soft heat outside, TRANSPARENT INSIDE. The ring itself spans about 89% of the frame, exactly as the reference has it — it marks the radius the hit lands in, so it must not grow or shrink — and the heat outside it stays inside the frame edge.

KEEP ANY GLOW TIGHT. A halo, aura or bloom spreading out into the background
is measured as part of the object when the return is fitted back onto the
reference — a wide aura therefore comes back as a tiny object inside a huge
smear. It also cannot be keyed: soft light over magenta turns pink rather
than transparent. Any glow belongs inside the shape's own outline, or within
a hair of it.

STYLE — grim painted dark fantasy, like a plate from a gothic illustrated
bestiary or the key art of a dungeon crawler. Match this in every panel:
· INK FIRST. Heavy hand-drawn contour lines in near-black ink, jagged and
  confident, thick on the shadow side and thin on the lit side, with
  dry-brush breaks. The drawing must look DRAWN — scratchy linework showing
  through the paint.
· PAINTED, NOT RENDERED. Flat blocks of gouache-like paint inside the lines
  with visible brushwork, rough cel-style shadow shapes and a little grain.
  No airbrush, no smooth 3D shading, no plastic gloss.
· DESATURATED, LOW-KEY colour: bone, ash grey, dried blood, rust, bruise
  purple, swamp green, cold slate — with ONE hot accent per subject (ember
  orange, sickly witch-green, cold soul-blue, tarnished gold). Deep shadows
  that fall to black.
· HIGH CONTRAST and cold. The light comes from the UPPER LEFT. Chiaroscuro:
  most of every form in shadow, one edge picked out.
· Gothic, grotesque, worn: cracked bone, rusted iron, torn cloth, wet stone,
  candle-soot. Everything has been through something.
· Menacing rather than cute — but the SILHOUETTE stays readable at 40 px, so
  keep the big shapes simple and put the detail inside them.

AVOID — this is exactly how earlier attempts went wrong:
· NO cute, cozy, storybook, chibi or plush look. No rounded friendly faces,
  no button eyes, no smiles.
· NO candy-bright, saturated, neon or pastel colour. If it looks cheerful,
  it is wrong.
· NO glossy, plasticky, airbrushed mobile-game rendering. No smooth 3D
  volume, no bevelled edges, no lens flares, no rim-lit chrome.
· NO photorealism and no hyper-detailed fur or scales — this is paint, and it
  is read at thumbnail size.
· NO warm paper, parchment or sepia wash over the whole image. Warmth is an
  accent, not a filter, and the ground is not part of the painting.
· NO frames, borders, cards, vignettes, matting or paper background behind
  the drawing. Nothing but flat magenta behind it, right up to its outline.
· Keep the subject the same subject and silhouette it already has. This is a
  restyle, not a redesign.

SIZE AND PLACEMENT — this is the part that goes wrong.
Do not enlarge it to fill the frame. The reference leaves air around the
subject and that air is not waste — it is where the things drawn live around
it go. Keep the subject the same fraction of the frame that the reference
has it, in the same place.
· Do not rotate it or change the viewing angle.
· No cast shadow on the ground. The game draws its own.

BACKGROUND — read this before anything else. It matters more than the style.
Fill every pixel that is not the object itself with solid, flat, pure magenta
#FF00FF. Treat it as a green-screen: one flat chroma-key colour, edge to edge.
· EXACTLY #FF00FF — red 255, green 0, blue 255. Not pink, not rose, not dusty
  pink, not mauve, not a soft or tinted version of it. Only the true colour can
  be cut away cleanly; a near miss has to be flood-filled instead, and a flood
  fill eats any pale paint it can reach.
· NOT transparent. Transparency gets exported as a grey-and-white CHECKERBOARD
  and then baked into the artwork as though the squares were paint.
· NOT white, cream, black, parchment, paper, or any tinted or textured ground.
· The object must NOT sit on a card, panel, sheet, badge, frame or rectangle of
  any kind. The magenta must touch the outline of the object on every side.
· No drop shadow onto the background, and no vignette.
· The object itself must contain no magenta or hot pink.
· The dark, desaturated palette above is for the OBJECT. The ground is not
  part of the painting and is not toned down with it: it stays a vivid,
  eye-hurting #FF00FF however dark everything else is. Dusty rose, pale pink
  and mauve are the failure this whole clause is about.

OUTPUT — read this twice, it is where every previous attempt failed:
· ONE image, exactly 512 x 512 pixels — square (1:1).
  If your tool has an aspect-ratio control, set it to match. Returns have
  come back at the tool's default ratio before, which overrides this line —
  the setting wins, so change the setting.
· ONE object. Not two, not a comparison, not variants side by side, not a
  before-and-after pair.
· No frame, border, card, label, caption, arrow, annotation or drop shadow.

---

# ring-heal — Heal ring  (images/fx/ring-heal.webp)

Paint ONE game sprite in a single square (1:1) image.
The attached reference is exactly what to paint, at exactly the size and
position it is drawn at. Match both.

WHAT IT IS: A heal ring: a thin sickly green ring, a full circle, TRANSPARENT INSIDE. Green is a colour the game uses nowhere else, so it must be unmistakably green. The ring itself spans about 89% of the frame, exactly as the reference has it; any glow outside it stays inside the frame edge.

KEEP ANY GLOW TIGHT. A halo, aura or bloom spreading out into the background
is measured as part of the object when the return is fitted back onto the
reference — a wide aura therefore comes back as a tiny object inside a huge
smear. It also cannot be keyed: soft light over magenta turns pink rather
than transparent. Any glow belongs inside the shape's own outline, or within
a hair of it.

STYLE — grim painted dark fantasy, like a plate from a gothic illustrated
bestiary or the key art of a dungeon crawler. Match this in every panel:
· INK FIRST. Heavy hand-drawn contour lines in near-black ink, jagged and
  confident, thick on the shadow side and thin on the lit side, with
  dry-brush breaks. The drawing must look DRAWN — scratchy linework showing
  through the paint.
· PAINTED, NOT RENDERED. Flat blocks of gouache-like paint inside the lines
  with visible brushwork, rough cel-style shadow shapes and a little grain.
  No airbrush, no smooth 3D shading, no plastic gloss.
· DESATURATED, LOW-KEY colour: bone, ash grey, dried blood, rust, bruise
  purple, swamp green, cold slate — with ONE hot accent per subject (ember
  orange, sickly witch-green, cold soul-blue, tarnished gold). Deep shadows
  that fall to black.
· HIGH CONTRAST and cold. The light comes from the UPPER LEFT. Chiaroscuro:
  most of every form in shadow, one edge picked out.
· Gothic, grotesque, worn: cracked bone, rusted iron, torn cloth, wet stone,
  candle-soot. Everything has been through something.
· Menacing rather than cute — but the SILHOUETTE stays readable at 40 px, so
  keep the big shapes simple and put the detail inside them.

AVOID — this is exactly how earlier attempts went wrong:
· NO cute, cozy, storybook, chibi or plush look. No rounded friendly faces,
  no button eyes, no smiles.
· NO candy-bright, saturated, neon or pastel colour. If it looks cheerful,
  it is wrong.
· NO glossy, plasticky, airbrushed mobile-game rendering. No smooth 3D
  volume, no bevelled edges, no lens flares, no rim-lit chrome.
· NO photorealism and no hyper-detailed fur or scales — this is paint, and it
  is read at thumbnail size.
· NO warm paper, parchment or sepia wash over the whole image. Warmth is an
  accent, not a filter, and the ground is not part of the painting.
· NO frames, borders, cards, vignettes, matting or paper background behind
  the drawing. Nothing but flat magenta behind it, right up to its outline.
· Keep the subject the same subject and silhouette it already has. This is a
  restyle, not a redesign.

SIZE AND PLACEMENT — this is the part that goes wrong.
Do not enlarge it to fill the frame. The reference leaves air around the
subject and that air is not waste — it is where the things drawn live around
it go. Keep the subject the same fraction of the frame that the reference
has it, in the same place.
· Do not rotate it or change the viewing angle.
· No cast shadow on the ground. The game draws its own.

BACKGROUND — read this before anything else. It matters more than the style.
Fill every pixel that is not the object itself with solid, flat, pure magenta
#FF00FF. Treat it as a green-screen: one flat chroma-key colour, edge to edge.
· EXACTLY #FF00FF — red 255, green 0, blue 255. Not pink, not rose, not dusty
  pink, not mauve, not a soft or tinted version of it. Only the true colour can
  be cut away cleanly; a near miss has to be flood-filled instead, and a flood
  fill eats any pale paint it can reach.
· NOT transparent. Transparency gets exported as a grey-and-white CHECKERBOARD
  and then baked into the artwork as though the squares were paint.
· NOT white, cream, black, parchment, paper, or any tinted or textured ground.
· The object must NOT sit on a card, panel, sheet, badge, frame or rectangle of
  any kind. The magenta must touch the outline of the object on every side.
· No drop shadow onto the background, and no vignette.
· The object itself must contain no magenta or hot pink.
· The dark, desaturated palette above is for the OBJECT. The ground is not
  part of the painting and is not toned down with it: it stays a vivid,
  eye-hurting #FF00FF however dark everything else is. Dusty rose, pale pink
  and mauve are the failure this whole clause is about.

OUTPUT — read this twice, it is where every previous attempt failed:
· ONE image, exactly 512 x 512 pixels — square (1:1).
  If your tool has an aspect-ratio control, set it to match. Returns have
  come back at the tool's default ratio before, which overrides this line —
  the setting wins, so change the setting.
· ONE object. Not two, not a comparison, not variants side by side, not a
  before-and-after pair.
· No frame, border, card, label, caption, arrow, annotation or drop shadow.

---

# shield — Shield dome  (images/fx/shield.webp)

Paint ONE game sprite in a single square (1:1) image.
The attached reference is exactly what to paint, at exactly the size and
position it is drawn at. Match both.

WHAT IT IS: The player's shield dome: a translucent cold-blue energy bubble, a full circle seen face-on, with a bright rim, a faint honeycomb texture across the surface and a specular sweep upper-left. The INTERIOR stays mostly transparent — it is stretched over the crowd and the crowd must stay readable through it. The rim spans about 89% of the frame, exactly as the reference has it; its glow outside stays inside the frame edge.

KEEP ANY GLOW TIGHT. A halo, aura or bloom spreading out into the background
is measured as part of the object when the return is fitted back onto the
reference — a wide aura therefore comes back as a tiny object inside a huge
smear. It also cannot be keyed: soft light over magenta turns pink rather
than transparent. Any glow belongs inside the shape's own outline, or within
a hair of it.

STYLE — grim painted dark fantasy, like a plate from a gothic illustrated
bestiary or the key art of a dungeon crawler. Match this in every panel:
· INK FIRST. Heavy hand-drawn contour lines in near-black ink, jagged and
  confident, thick on the shadow side and thin on the lit side, with
  dry-brush breaks. The drawing must look DRAWN — scratchy linework showing
  through the paint.
· PAINTED, NOT RENDERED. Flat blocks of gouache-like paint inside the lines
  with visible brushwork, rough cel-style shadow shapes and a little grain.
  No airbrush, no smooth 3D shading, no plastic gloss.
· DESATURATED, LOW-KEY colour: bone, ash grey, dried blood, rust, bruise
  purple, swamp green, cold slate — with ONE hot accent per subject (ember
  orange, sickly witch-green, cold soul-blue, tarnished gold). Deep shadows
  that fall to black.
· HIGH CONTRAST and cold. The light comes from the UPPER LEFT. Chiaroscuro:
  most of every form in shadow, one edge picked out.
· Gothic, grotesque, worn: cracked bone, rusted iron, torn cloth, wet stone,
  candle-soot. Everything has been through something.
· Menacing rather than cute — but the SILHOUETTE stays readable at 40 px, so
  keep the big shapes simple and put the detail inside them.

AVOID — this is exactly how earlier attempts went wrong:
· NO cute, cozy, storybook, chibi or plush look. No rounded friendly faces,
  no button eyes, no smiles.
· NO candy-bright, saturated, neon or pastel colour. If it looks cheerful,
  it is wrong.
· NO glossy, plasticky, airbrushed mobile-game rendering. No smooth 3D
  volume, no bevelled edges, no lens flares, no rim-lit chrome.
· NO photorealism and no hyper-detailed fur or scales — this is paint, and it
  is read at thumbnail size.
· NO warm paper, parchment or sepia wash over the whole image. Warmth is an
  accent, not a filter, and the ground is not part of the painting.
· NO frames, borders, cards, vignettes, matting or paper background behind
  the drawing. Nothing but flat magenta behind it, right up to its outline.
· Keep the subject the same subject and silhouette it already has. This is a
  restyle, not a redesign.

SIZE AND PLACEMENT — this is the part that goes wrong.
Do not enlarge it to fill the frame. The reference leaves air around the
subject and that air is not waste — it is where the things drawn live around
it go. Keep the subject the same fraction of the frame that the reference
has it, in the same place.
· Do not rotate it or change the viewing angle.
· No cast shadow on the ground. The game draws its own.

BACKGROUND — read this before anything else. It matters more than the style.
Fill every pixel that is not the object itself with solid, flat, pure magenta
#FF00FF. Treat it as a green-screen: one flat chroma-key colour, edge to edge.
· EXACTLY #FF00FF — red 255, green 0, blue 255. Not pink, not rose, not dusty
  pink, not mauve, not a soft or tinted version of it. Only the true colour can
  be cut away cleanly; a near miss has to be flood-filled instead, and a flood
  fill eats any pale paint it can reach.
· NOT transparent. Transparency gets exported as a grey-and-white CHECKERBOARD
  and then baked into the artwork as though the squares were paint.
· NOT white, cream, black, parchment, paper, or any tinted or textured ground.
· The object must NOT sit on a card, panel, sheet, badge, frame or rectangle of
  any kind. The magenta must touch the outline of the object on every side.
· No drop shadow onto the background, and no vignette.
· The object itself must contain no magenta or hot pink.
· The dark, desaturated palette above is for the OBJECT. The ground is not
  part of the painting and is not toned down with it: it stays a vivid,
  eye-hurting #FF00FF however dark everything else is. Dusty rose, pale pink
  and mauve are the failure this whole clause is about.

OUTPUT — read this twice, it is where every previous attempt failed:
· ONE image, exactly 512 x 512 pixels — square (1:1).
  If your tool has an aspect-ratio control, set it to match. Returns have
  come back at the tool's default ratio before, which overrides this line —
  the setting wins, so change the setting.
· ONE object. Not two, not a comparison, not variants side by side, not a
  before-and-after pair.
· No frame, border, card, label, caption, arrow, annotation or drop shadow.

---

# guard — Boss guard barrier  (images/fx/guard.webp)

Paint ONE game sprite in a single square (1:1) image.
The attached reference is exactly what to paint, at exactly the size and
position it is drawn at. Match both.

WHAT IT IS: The boss's guard barrier: a point-up HEXAGON of ember-orange energy, a translucent fill with a hot rim. The hexagon spans about 89% of the frame, exactly as the reference has it; the rim's glow outside it stays inside the frame edge.

KEEP ANY GLOW TIGHT. A halo, aura or bloom spreading out into the background
is measured as part of the object when the return is fitted back onto the
reference — a wide aura therefore comes back as a tiny object inside a huge
smear. It also cannot be keyed: soft light over magenta turns pink rather
than transparent. Any glow belongs inside the shape's own outline, or within
a hair of it.

STYLE — grim painted dark fantasy, like a plate from a gothic illustrated
bestiary or the key art of a dungeon crawler. Match this in every panel:
· INK FIRST. Heavy hand-drawn contour lines in near-black ink, jagged and
  confident, thick on the shadow side and thin on the lit side, with
  dry-brush breaks. The drawing must look DRAWN — scratchy linework showing
  through the paint.
· PAINTED, NOT RENDERED. Flat blocks of gouache-like paint inside the lines
  with visible brushwork, rough cel-style shadow shapes and a little grain.
  No airbrush, no smooth 3D shading, no plastic gloss.
· DESATURATED, LOW-KEY colour: bone, ash grey, dried blood, rust, bruise
  purple, swamp green, cold slate — with ONE hot accent per subject (ember
  orange, sickly witch-green, cold soul-blue, tarnished gold). Deep shadows
  that fall to black.
· HIGH CONTRAST and cold. The light comes from the UPPER LEFT. Chiaroscuro:
  most of every form in shadow, one edge picked out.
· Gothic, grotesque, worn: cracked bone, rusted iron, torn cloth, wet stone,
  candle-soot. Everything has been through something.
· Menacing rather than cute — but the SILHOUETTE stays readable at 40 px, so
  keep the big shapes simple and put the detail inside them.

AVOID — this is exactly how earlier attempts went wrong:
· NO cute, cozy, storybook, chibi or plush look. No rounded friendly faces,
  no button eyes, no smiles.
· NO candy-bright, saturated, neon or pastel colour. If it looks cheerful,
  it is wrong.
· NO glossy, plasticky, airbrushed mobile-game rendering. No smooth 3D
  volume, no bevelled edges, no lens flares, no rim-lit chrome.
· NO photorealism and no hyper-detailed fur or scales — this is paint, and it
  is read at thumbnail size.
· NO warm paper, parchment or sepia wash over the whole image. Warmth is an
  accent, not a filter, and the ground is not part of the painting.
· NO frames, borders, cards, vignettes, matting or paper background behind
  the drawing. Nothing but flat magenta behind it, right up to its outline.
· Keep the subject the same subject and silhouette it already has. This is a
  restyle, not a redesign.

SIZE AND PLACEMENT — this is the part that goes wrong.
Do not enlarge it to fill the frame. The reference leaves air around the
subject and that air is not waste — it is where the things drawn live around
it go. Keep the subject the same fraction of the frame that the reference
has it, in the same place.
· Do not rotate it or change the viewing angle.
· No cast shadow on the ground. The game draws its own.

BACKGROUND — read this before anything else. It matters more than the style.
Fill every pixel that is not the object itself with solid, flat, pure magenta
#FF00FF. Treat it as a green-screen: one flat chroma-key colour, edge to edge.
· EXACTLY #FF00FF — red 255, green 0, blue 255. Not pink, not rose, not dusty
  pink, not mauve, not a soft or tinted version of it. Only the true colour can
  be cut away cleanly; a near miss has to be flood-filled instead, and a flood
  fill eats any pale paint it can reach.
· NOT transparent. Transparency gets exported as a grey-and-white CHECKERBOARD
  and then baked into the artwork as though the squares were paint.
· NOT white, cream, black, parchment, paper, or any tinted or textured ground.
· The object must NOT sit on a card, panel, sheet, badge, frame or rectangle of
  any kind. The magenta must touch the outline of the object on every side.
· No drop shadow onto the background, and no vignette.
· The object itself must contain no magenta or hot pink.
· The dark, desaturated palette above is for the OBJECT. The ground is not
  part of the painting and is not toned down with it: it stays a vivid,
  eye-hurting #FF00FF however dark everything else is. Dusty rose, pale pink
  and mauve are the failure this whole clause is about.

OUTPUT — read this twice, it is where every previous attempt failed:
· ONE image, exactly 512 x 512 pixels — square (1:1).
  If your tool has an aspect-ratio control, set it to match. Returns have
  come back at the tool's default ratio before, which overrides this line —
  the setting wins, so change the setting.
· ONE object. Not two, not a comparison, not variants side by side, not a
  before-and-after pair.
· No frame, border, card, label, caption, arrow, annotation or drop shadow.

---

# crest-shield — Shield crest  (images/fx/crest-shield.webp)

Paint ONE game sprite in a single square (1:1) image.
The attached reference is exactly what to paint, at exactly the size and
position it is drawn at. Match both.

WHAT IT IS: A heater shield crest — flat top, straight shoulders, tapering to a rounded point — in cold blue with a heavy near-black rim, a chief band across the top and a centre rib. Heraldry read at 20 px. Fills the frame.

STYLE — grim painted dark fantasy, like a plate from a gothic illustrated
bestiary or the key art of a dungeon crawler. Match this in every panel:
· INK FIRST. Heavy hand-drawn contour lines in near-black ink, jagged and
  confident, thick on the shadow side and thin on the lit side, with
  dry-brush breaks. The drawing must look DRAWN — scratchy linework showing
  through the paint.
· PAINTED, NOT RENDERED. Flat blocks of gouache-like paint inside the lines
  with visible brushwork, rough cel-style shadow shapes and a little grain.
  No airbrush, no smooth 3D shading, no plastic gloss.
· DESATURATED, LOW-KEY colour: bone, ash grey, dried blood, rust, bruise
  purple, swamp green, cold slate — with ONE hot accent per subject (ember
  orange, sickly witch-green, cold soul-blue, tarnished gold). Deep shadows
  that fall to black.
· HIGH CONTRAST and cold. The light comes from the UPPER LEFT. Chiaroscuro:
  most of every form in shadow, one edge picked out.
· Gothic, grotesque, worn: cracked bone, rusted iron, torn cloth, wet stone,
  candle-soot. Everything has been through something.
· Menacing rather than cute — but the SILHOUETTE stays readable at 40 px, so
  keep the big shapes simple and put the detail inside them.

AVOID — this is exactly how earlier attempts went wrong:
· NO cute, cozy, storybook, chibi or plush look. No rounded friendly faces,
  no button eyes, no smiles.
· NO candy-bright, saturated, neon or pastel colour. If it looks cheerful,
  it is wrong.
· NO glossy, plasticky, airbrushed mobile-game rendering. No smooth 3D
  volume, no bevelled edges, no lens flares, no rim-lit chrome.
· NO photorealism and no hyper-detailed fur or scales — this is paint, and it
  is read at thumbnail size.
· NO warm paper, parchment or sepia wash over the whole image. Warmth is an
  accent, not a filter, and the ground is not part of the painting.
· NO frames, borders, cards, vignettes, matting or paper background inside
  the frame. The object itself fills the frame edge to edge, corner to
  corner, and its outer edge is the frame's edge.
· Keep the subject the same subject and silhouette it already has. This is a
  restyle, not a redesign.

SIZE AND PLACEMENT — this is the part that goes wrong.
The subject fills its frame edge to edge, exactly as the reference does.
Do not shrink it onto a card or leave a polite margin.
· Do not rotate it or change the viewing angle.
· No cast shadow on the ground. The game draws its own.

BACKGROUND — read this before anything else. It matters more than the style.
Fill every pixel that is not the object itself with solid, flat, pure magenta
#FF00FF. Treat it as a green-screen: one flat chroma-key colour, edge to edge.
· EXACTLY #FF00FF — red 255, green 0, blue 255. Not pink, not rose, not dusty
  pink, not mauve, not a soft or tinted version of it. Only the true colour can
  be cut away cleanly; a near miss has to be flood-filled instead, and a flood
  fill eats any pale paint it can reach.
· NOT transparent. Transparency gets exported as a grey-and-white CHECKERBOARD
  and then baked into the artwork as though the squares were paint.
· NOT white, cream, black, parchment, paper, or any tinted or textured ground.
· The object must NOT sit on a card, panel, sheet, badge, frame or rectangle of
  any kind. The magenta must touch the outline of the object on every side.
· No drop shadow onto the background, and no vignette.
· The object itself must contain no magenta or hot pink.
· The dark, desaturated palette above is for the OBJECT. The ground is not
  part of the painting and is not toned down with it: it stays a vivid,
  eye-hurting #FF00FF however dark everything else is. Dusty rose, pale pink
  and mauve are the failure this whole clause is about.

OUTPUT — read this twice, it is where every previous attempt failed:
· ONE image, exactly 512 x 512 pixels — square (1:1).
  If your tool has an aspect-ratio control, set it to match. Returns have
  come back at the tool's default ratio before, which overrides this line —
  the setting wins, so change the setting.
· ONE object. Not two, not a comparison, not variants side by side, not a
  before-and-after pair.
· No frame, border, card, label, caption, arrow, annotation or drop shadow.

---

# crest-guard — Guard crest  (images/fx/crest-guard.webp)

Paint ONE game sprite in a single square (1:1) image.
The attached reference is exactly what to paint, at exactly the size and
position it is drawn at. Match both.

WHAT IT IS: A heater shield crest — flat top, straight shoulders, tapering to a rounded point — in ember-orange and tarnished gold with a heavy dark rim, a chief band across the top and a centre rib: the boss's own. Fills the frame.

STYLE — grim painted dark fantasy, like a plate from a gothic illustrated
bestiary or the key art of a dungeon crawler. Match this in every panel:
· INK FIRST. Heavy hand-drawn contour lines in near-black ink, jagged and
  confident, thick on the shadow side and thin on the lit side, with
  dry-brush breaks. The drawing must look DRAWN — scratchy linework showing
  through the paint.
· PAINTED, NOT RENDERED. Flat blocks of gouache-like paint inside the lines
  with visible brushwork, rough cel-style shadow shapes and a little grain.
  No airbrush, no smooth 3D shading, no plastic gloss.
· DESATURATED, LOW-KEY colour: bone, ash grey, dried blood, rust, bruise
  purple, swamp green, cold slate — with ONE hot accent per subject (ember
  orange, sickly witch-green, cold soul-blue, tarnished gold). Deep shadows
  that fall to black.
· HIGH CONTRAST and cold. The light comes from the UPPER LEFT. Chiaroscuro:
  most of every form in shadow, one edge picked out.
· Gothic, grotesque, worn: cracked bone, rusted iron, torn cloth, wet stone,
  candle-soot. Everything has been through something.
· Menacing rather than cute — but the SILHOUETTE stays readable at 40 px, so
  keep the big shapes simple and put the detail inside them.

AVOID — this is exactly how earlier attempts went wrong:
· NO cute, cozy, storybook, chibi or plush look. No rounded friendly faces,
  no button eyes, no smiles.
· NO candy-bright, saturated, neon or pastel colour. If it looks cheerful,
  it is wrong.
· NO glossy, plasticky, airbrushed mobile-game rendering. No smooth 3D
  volume, no bevelled edges, no lens flares, no rim-lit chrome.
· NO photorealism and no hyper-detailed fur or scales — this is paint, and it
  is read at thumbnail size.
· NO warm paper, parchment or sepia wash over the whole image. Warmth is an
  accent, not a filter, and the ground is not part of the painting.
· NO frames, borders, cards, vignettes, matting or paper background inside
  the frame. The object itself fills the frame edge to edge, corner to
  corner, and its outer edge is the frame's edge.
· Keep the subject the same subject and silhouette it already has. This is a
  restyle, not a redesign.

SIZE AND PLACEMENT — this is the part that goes wrong.
The subject fills its frame edge to edge, exactly as the reference does.
Do not shrink it onto a card or leave a polite margin.
· Do not rotate it or change the viewing angle.
· No cast shadow on the ground. The game draws its own.

BACKGROUND — read this before anything else. It matters more than the style.
Fill every pixel that is not the object itself with solid, flat, pure magenta
#FF00FF. Treat it as a green-screen: one flat chroma-key colour, edge to edge.
· EXACTLY #FF00FF — red 255, green 0, blue 255. Not pink, not rose, not dusty
  pink, not mauve, not a soft or tinted version of it. Only the true colour can
  be cut away cleanly; a near miss has to be flood-filled instead, and a flood
  fill eats any pale paint it can reach.
· NOT transparent. Transparency gets exported as a grey-and-white CHECKERBOARD
  and then baked into the artwork as though the squares were paint.
· NOT white, cream, black, parchment, paper, or any tinted or textured ground.
· The object must NOT sit on a card, panel, sheet, badge, frame or rectangle of
  any kind. The magenta must touch the outline of the object on every side.
· No drop shadow onto the background, and no vignette.
· The object itself must contain no magenta or hot pink.
· The dark, desaturated palette above is for the OBJECT. The ground is not
  part of the painting and is not toned down with it: it stays a vivid,
  eye-hurting #FF00FF however dark everything else is. Dusty rose, pale pink
  and mauve are the failure this whole clause is about.

OUTPUT — read this twice, it is where every previous attempt failed:
· ONE image, exactly 512 x 512 pixels — square (1:1).
  If your tool has an aspect-ratio control, set it to match. Returns have
  come back at the tool's default ratio before, which overrides this line —
  the setting wins, so change the setting.
· ONE object. Not two, not a comparison, not variants side by side, not a
  before-and-after pair.
· No frame, border, card, label, caption, arrow, annotation or drop shadow.

---

# ridge-far — Far ridge  (images/bg/ridge-far.webp)

Paint ONE game sprite in a single landscape, 4.00:1 image.
The attached reference is exactly what to paint, at exactly the size and
position it is drawn at. Match both.

WHAT IT IS: A far parallax ridge: jagged dead peaks with a broken tower or two and a gallows on the skyline. The SKY above the ridge line is solid magenta; everything below the ridge line is SOLID BLACK silhouette — the game tints it per stage, so no colour, no shading, no lights. The ridge line runs at about 40% down the frame.

STYLE — grim painted dark fantasy, like a plate from a gothic illustrated
bestiary or the key art of a dungeon crawler. Match this in every panel:
· INK FIRST. Heavy hand-drawn contour lines in near-black ink, jagged and
  confident, thick on the shadow side and thin on the lit side, with
  dry-brush breaks. The drawing must look DRAWN — scratchy linework showing
  through the paint.
· PAINTED, NOT RENDERED. Flat blocks of gouache-like paint inside the lines
  with visible brushwork, rough cel-style shadow shapes and a little grain.
  No airbrush, no smooth 3D shading, no plastic gloss.
· DESATURATED, LOW-KEY colour: bone, ash grey, dried blood, rust, bruise
  purple, swamp green, cold slate — with ONE hot accent per subject (ember
  orange, sickly witch-green, cold soul-blue, tarnished gold). Deep shadows
  that fall to black.
· HIGH CONTRAST and cold. The light comes from the UPPER LEFT. Chiaroscuro:
  most of every form in shadow, one edge picked out.
· Gothic, grotesque, worn: cracked bone, rusted iron, torn cloth, wet stone,
  candle-soot. Everything has been through something.
· Menacing rather than cute — but the SILHOUETTE stays readable at 40 px, so
  keep the big shapes simple and put the detail inside them.

AVOID — this is exactly how earlier attempts went wrong:
· NO cute, cozy, storybook, chibi or plush look. No rounded friendly faces,
  no button eyes, no smiles.
· NO candy-bright, saturated, neon or pastel colour. If it looks cheerful,
  it is wrong.
· NO glossy, plasticky, airbrushed mobile-game rendering. No smooth 3D
  volume, no bevelled edges, no lens flares, no rim-lit chrome.
· NO photorealism and no hyper-detailed fur or scales — this is paint, and it
  is read at thumbnail size.
· NO warm paper, parchment or sepia wash over the whole image. Warmth is an
  accent, not a filter, and the ground is not part of the painting.
· NO frames, borders, cards, vignettes, matting or paper background behind
  the drawing. Nothing but flat magenta behind it, right up to its outline.
· Keep the subject the same subject and silhouette it already has. This is a
  restyle, not a redesign.

SIZE AND PLACEMENT — this is the part that goes wrong.
Do not enlarge it to fill the frame. The reference leaves air around the
subject and that air is not waste — it is where the things drawn live around
it go. Keep the subject the same fraction of the frame that the reference
has it, in the same place.
· Do not rotate it or change the viewing angle.
· No cast shadow on the ground. The game draws its own.

BACKGROUND — read this before anything else.
Everything ABOVE the ridge line is sky, and it must be solid, flat, pure
magenta #FF00FF — a green-screen colour, keyed out automatically. NOT
transparent: transparency gets exported as a grey-and-white CHECKERBOARD
and then baked in as though the squares were paint. NOT white, NOT pale
blue, NOT a gradient or haze. BELOW the ridge line the artwork is fully
opaque black, right down to the bottom edge — do not fade it out.

SEAMLESSLY TILEABLE, HORIZONTALLY. This image is repeated end to end, so
the right edge must join the left edge with no visible seam, no matching
feature straddling the join, and no vignette or fade at either side. It
does NOT need to tile vertically.

OUTPUT — read this twice, it is where every previous attempt failed:
· ONE image, exactly 1536 x 384 pixels — landscape, 4.00:1.
  If your tool has an aspect-ratio control, set it to match. Returns have
  come back at the tool's default ratio before, which overrides this line —
  the setting wins, so change the setting.
· ONE object. Not two, not a comparison, not variants side by side, not a
  before-and-after pair.
· No frame, border, card, label, caption, arrow, annotation or drop shadow.

---

# ridge-near — Near ridge  (images/bg/ridge-near.webp)

Paint ONE game sprite in a single landscape, 4.00:1 image.
The attached reference is exactly what to paint, at exactly the size and
position it is drawn at. Match both.

WHAT IT IS: A near parallax ridge, lower and closer than the far one: a dune of ruined walls, leaning grave-posts and bare trees. The SKY above the ridge line is solid magenta; everything below it is SOLID BLACK silhouette — the game tints it per stage, so no colour, no shading, no lights. The ridge line runs at about 40% down the frame.

STYLE — grim painted dark fantasy, like a plate from a gothic illustrated
bestiary or the key art of a dungeon crawler. Match this in every panel:
· INK FIRST. Heavy hand-drawn contour lines in near-black ink, jagged and
  confident, thick on the shadow side and thin on the lit side, with
  dry-brush breaks. The drawing must look DRAWN — scratchy linework showing
  through the paint.
· PAINTED, NOT RENDERED. Flat blocks of gouache-like paint inside the lines
  with visible brushwork, rough cel-style shadow shapes and a little grain.
  No airbrush, no smooth 3D shading, no plastic gloss.
· DESATURATED, LOW-KEY colour: bone, ash grey, dried blood, rust, bruise
  purple, swamp green, cold slate — with ONE hot accent per subject (ember
  orange, sickly witch-green, cold soul-blue, tarnished gold). Deep shadows
  that fall to black.
· HIGH CONTRAST and cold. The light comes from the UPPER LEFT. Chiaroscuro:
  most of every form in shadow, one edge picked out.
· Gothic, grotesque, worn: cracked bone, rusted iron, torn cloth, wet stone,
  candle-soot. Everything has been through something.
· Menacing rather than cute — but the SILHOUETTE stays readable at 40 px, so
  keep the big shapes simple and put the detail inside them.

AVOID — this is exactly how earlier attempts went wrong:
· NO cute, cozy, storybook, chibi or plush look. No rounded friendly faces,
  no button eyes, no smiles.
· NO candy-bright, saturated, neon or pastel colour. If it looks cheerful,
  it is wrong.
· NO glossy, plasticky, airbrushed mobile-game rendering. No smooth 3D
  volume, no bevelled edges, no lens flares, no rim-lit chrome.
· NO photorealism and no hyper-detailed fur or scales — this is paint, and it
  is read at thumbnail size.
· NO warm paper, parchment or sepia wash over the whole image. Warmth is an
  accent, not a filter, and the ground is not part of the painting.
· NO frames, borders, cards, vignettes, matting or paper background behind
  the drawing. Nothing but flat magenta behind it, right up to its outline.
· Keep the subject the same subject and silhouette it already has. This is a
  restyle, not a redesign.

SIZE AND PLACEMENT — this is the part that goes wrong.
Do not enlarge it to fill the frame. The reference leaves air around the
subject and that air is not waste — it is where the things drawn live around
it go. Keep the subject the same fraction of the frame that the reference
has it, in the same place.
· Do not rotate it or change the viewing angle.
· No cast shadow on the ground. The game draws its own.

BACKGROUND — read this before anything else.
Everything ABOVE the ridge line is sky, and it must be solid, flat, pure
magenta #FF00FF — a green-screen colour, keyed out automatically. NOT
transparent: transparency gets exported as a grey-and-white CHECKERBOARD
and then baked in as though the squares were paint. NOT white, NOT pale
blue, NOT a gradient or haze. BELOW the ridge line the artwork is fully
opaque black, right down to the bottom edge — do not fade it out.

SEAMLESSLY TILEABLE, HORIZONTALLY. This image is repeated end to end, so
the right edge must join the left edge with no visible seam, no matching
feature straddling the join, and no vignette or fade at either side. It
does NOT need to tile vertically.

OUTPUT — read this twice, it is where every previous attempt failed:
· ONE image, exactly 1536 x 384 pixels — landscape, 4.00:1.
  If your tool has an aspect-ratio control, set it to match. Returns have
  come back at the tool's default ratio before, which overrides this line —
  the setting wins, so change the setting.
· ONE object. Not two, not a comparison, not variants side by side, not a
  before-and-after pair.
· No frame, border, card, label, caption, arrow, annotation or drop shadow.

---

# crown — Elite crown  (images/ui/crown.webp)

Paint ONE game sprite in a single square (1:1) image.
The attached reference is exactly what to paint, at exactly the size and
position it is drawn at. Match both.

WHAT IT IS: The elite's crown: a small three-pointed crown of tarnished gold with a heavy dark rim, its base flat at the bottom of the frame. Read at 20 px — bold shape, no fine detail. Fills the frame.

STYLE — grim painted dark fantasy, like a plate from a gothic illustrated
bestiary or the key art of a dungeon crawler. Match this in every panel:
· INK FIRST. Heavy hand-drawn contour lines in near-black ink, jagged and
  confident, thick on the shadow side and thin on the lit side, with
  dry-brush breaks. The drawing must look DRAWN — scratchy linework showing
  through the paint.
· PAINTED, NOT RENDERED. Flat blocks of gouache-like paint inside the lines
  with visible brushwork, rough cel-style shadow shapes and a little grain.
  No airbrush, no smooth 3D shading, no plastic gloss.
· DESATURATED, LOW-KEY colour: bone, ash grey, dried blood, rust, bruise
  purple, swamp green, cold slate — with ONE hot accent per subject (ember
  orange, sickly witch-green, cold soul-blue, tarnished gold). Deep shadows
  that fall to black.
· HIGH CONTRAST and cold. The light comes from the UPPER LEFT. Chiaroscuro:
  most of every form in shadow, one edge picked out.
· Gothic, grotesque, worn: cracked bone, rusted iron, torn cloth, wet stone,
  candle-soot. Everything has been through something.
· Menacing rather than cute — but the SILHOUETTE stays readable at 40 px, so
  keep the big shapes simple and put the detail inside them.

AVOID — this is exactly how earlier attempts went wrong:
· NO cute, cozy, storybook, chibi or plush look. No rounded friendly faces,
  no button eyes, no smiles.
· NO candy-bright, saturated, neon or pastel colour. If it looks cheerful,
  it is wrong.
· NO glossy, plasticky, airbrushed mobile-game rendering. No smooth 3D
  volume, no bevelled edges, no lens flares, no rim-lit chrome.
· NO photorealism and no hyper-detailed fur or scales — this is paint, and it
  is read at thumbnail size.
· NO warm paper, parchment or sepia wash over the whole image. Warmth is an
  accent, not a filter, and the ground is not part of the painting.
· NO frames, borders, cards, vignettes, matting or paper background inside
  the frame. The object itself fills the frame edge to edge, corner to
  corner, and its outer edge is the frame's edge.
· Keep the subject the same subject and silhouette it already has. This is a
  restyle, not a redesign.

SIZE AND PLACEMENT — this is the part that goes wrong.
The subject fills its frame edge to edge, exactly as the reference does.
Do not shrink it onto a card or leave a polite margin.
· Do not rotate it or change the viewing angle.
· No cast shadow on the ground. The game draws its own.

BACKGROUND — read this before anything else. It matters more than the style.
Fill every pixel that is not the object itself with solid, flat, pure magenta
#FF00FF. Treat it as a green-screen: one flat chroma-key colour, edge to edge.
· EXACTLY #FF00FF — red 255, green 0, blue 255. Not pink, not rose, not dusty
  pink, not mauve, not a soft or tinted version of it. Only the true colour can
  be cut away cleanly; a near miss has to be flood-filled instead, and a flood
  fill eats any pale paint it can reach.
· NOT transparent. Transparency gets exported as a grey-and-white CHECKERBOARD
  and then baked into the artwork as though the squares were paint.
· NOT white, cream, black, parchment, paper, or any tinted or textured ground.
· The object must NOT sit on a card, panel, sheet, badge, frame or rectangle of
  any kind. The magenta must touch the outline of the object on every side.
· No drop shadow onto the background, and no vignette.
· The object itself must contain no magenta or hot pink.
· The dark, desaturated palette above is for the OBJECT. The ground is not
  part of the painting and is not toned down with it: it stays a vivid,
  eye-hurting #FF00FF however dark everything else is. Dusty rose, pale pink
  and mauve are the failure this whole clause is about.

OUTPUT — read this twice, it is where every previous attempt failed:
· ONE image, exactly 512 x 512 pixels — square (1:1).
  If your tool has an aspect-ratio control, set it to match. Returns have
  come back at the tool's default ratio before, which overrides this line —
  the setting wins, so change the setting.
· ONE object. Not two, not a comparison, not variants side by side, not a
  before-and-after pair.
· No frame, border, card, label, caption, arrow, annotation or drop shadow.

---

# ribbon — Result banner  (images/ui/ribbon.webp)

Paint ONE game sprite in a single landscape, 21:9 image.
The attached reference is exactly what to paint, at exactly the size and
position it is drawn at. Match both.

WHAT IT IS: The result screen's title banner: a long horizontal plate of blackened iron with a swallow-tailed notch cut into each end, bound along its top and bottom edges with a thin line of tarnished gold, a round iron-gold boss beside each notch and a small rivet in each corner. The plate spans the FULL WIDTH and nearly the full height of the frame, exactly as the reference does. All the detail lives in the two END PIECES — the outer 17% of the width at each side — because the game keeps those at true size and STRETCHES THE MIDDLE sideways to fit the words: the middle 66% is a plain, flat, dark band with nothing on it but the two gold lines running straight through.

LEAVE OUT WHAT THE GAME PAINTS LIVE. The title is printed in white across the middle band, so the middle stays plain, flat and dark — no emblem, no rune, no glint, no lettering.

STYLE — grim painted dark fantasy, like a plate from a gothic illustrated
bestiary or the key art of a dungeon crawler. Match this in every panel:
· INK FIRST. Heavy hand-drawn contour lines in near-black ink, jagged and
  confident, thick on the shadow side and thin on the lit side, with
  dry-brush breaks. The drawing must look DRAWN — scratchy linework showing
  through the paint.
· PAINTED, NOT RENDERED. Flat blocks of gouache-like paint inside the lines
  with visible brushwork, rough cel-style shadow shapes and a little grain.
  No airbrush, no smooth 3D shading, no plastic gloss.
· DESATURATED, LOW-KEY colour: bone, ash grey, dried blood, rust, bruise
  purple, swamp green, cold slate — with ONE hot accent per subject (ember
  orange, sickly witch-green, cold soul-blue, tarnished gold). Deep shadows
  that fall to black.
· HIGH CONTRAST and cold. The light comes from the UPPER LEFT. Chiaroscuro:
  most of every form in shadow, one edge picked out.
· Gothic, grotesque, worn: cracked bone, rusted iron, torn cloth, wet stone,
  candle-soot. Everything has been through something.
· Menacing rather than cute — but the SILHOUETTE stays readable at 40 px, so
  keep the big shapes simple and put the detail inside them.

AVOID — this is exactly how earlier attempts went wrong:
· NO cute, cozy, storybook, chibi or plush look. No rounded friendly faces,
  no button eyes, no smiles.
· NO candy-bright, saturated, neon or pastel colour. If it looks cheerful,
  it is wrong.
· NO glossy, plasticky, airbrushed mobile-game rendering. No smooth 3D
  volume, no bevelled edges, no lens flares, no rim-lit chrome.
· NO photorealism and no hyper-detailed fur or scales — this is paint, and it
  is read at thumbnail size.
· NO warm paper, parchment or sepia wash over the whole image. Warmth is an
  accent, not a filter, and the ground is not part of the painting.
· NO frames, borders, cards, vignettes, matting or paper background behind
  the drawing. Nothing but flat magenta behind it, right up to its outline.
· Keep the subject the same subject and silhouette it already has. This is a
  restyle, not a redesign.

SIZE AND PLACEMENT — this is the part that goes wrong.
Do not enlarge it to fill the frame. The reference leaves air around the
subject and that air is not waste — it is where the things drawn live around
it go. Keep the subject the same fraction of the frame that the reference
has it, in the same place.
· Do not rotate it or change the viewing angle.
· No cast shadow on the ground. The game draws its own.

BACKGROUND — read this before anything else. It matters more than the style.
Fill every pixel that is not the object itself with solid, flat, pure magenta
#FF00FF. Treat it as a green-screen: one flat chroma-key colour, edge to edge.
· EXACTLY #FF00FF — red 255, green 0, blue 255. Not pink, not rose, not dusty
  pink, not mauve, not a soft or tinted version of it. Only the true colour can
  be cut away cleanly; a near miss has to be flood-filled instead, and a flood
  fill eats any pale paint it can reach.
· NOT transparent. Transparency gets exported as a grey-and-white CHECKERBOARD
  and then baked into the artwork as though the squares were paint.
· NOT white, cream, black, parchment, paper, or any tinted or textured ground.
· The object must NOT sit on a card, panel, sheet, badge, frame or rectangle of
  any kind. The magenta must touch the outline of the object on every side.
· No drop shadow onto the background, and no vignette.
· The object itself must contain no magenta or hot pink.
· The dark, desaturated palette above is for the OBJECT. The ground is not
  part of the painting and is not toned down with it: it stays a vivid,
  eye-hurting #FF00FF however dark everything else is. Dusty rose, pale pink
  and mauve are the failure this whole clause is about.

OUTPUT — read this twice, it is where every previous attempt failed:
· ONE image, exactly 1344 x 576 pixels — landscape, 21:9.
  If your tool has an aspect-ratio control, set it to match. Returns have
  come back at the tool's default ratio before, which overrides this line —
  the setting wins, so change the setting.
· ONE object. Not two, not a comparison, not variants side by side, not a
  before-and-after pair.
· No frame, border, card, label, caption, arrow, annotation or drop shadow.

---

# chest — The shop chest  (images/ui/chest.webp)

Paint ONE game sprite in a single square (1:1) image.
The attached reference is exactly what to paint, at exactly the size and
position it is drawn at. Match both.

WHAT IT IS: The shop button's treasure chest: a squat iron-banded strongbox of dark oak seen straight on and a little from above, its domed lid raised a crack so a cold gold light leaks from the gap, a skull-faced iron hasp on the front, riveted black-iron bands and corners. A thing you would loot. Bold shape, no fine detail — it is read at 24 px on a button — and the same silhouette as the reference: a wide lid over a box, the lid overhanging.

STYLE — grim painted dark fantasy, like a plate from a gothic illustrated
bestiary or the key art of a dungeon crawler. Match this in every panel:
· INK FIRST. Heavy hand-drawn contour lines in near-black ink, jagged and
  confident, thick on the shadow side and thin on the lit side, with
  dry-brush breaks. The drawing must look DRAWN — scratchy linework showing
  through the paint.
· PAINTED, NOT RENDERED. Flat blocks of gouache-like paint inside the lines
  with visible brushwork, rough cel-style shadow shapes and a little grain.
  No airbrush, no smooth 3D shading, no plastic gloss.
· DESATURATED, LOW-KEY colour: bone, ash grey, dried blood, rust, bruise
  purple, swamp green, cold slate — with ONE hot accent per subject (ember
  orange, sickly witch-green, cold soul-blue, tarnished gold). Deep shadows
  that fall to black.
· HIGH CONTRAST and cold. The light comes from the UPPER LEFT. Chiaroscuro:
  most of every form in shadow, one edge picked out.
· Gothic, grotesque, worn: cracked bone, rusted iron, torn cloth, wet stone,
  candle-soot. Everything has been through something.
· Menacing rather than cute — but the SILHOUETTE stays readable at 40 px, so
  keep the big shapes simple and put the detail inside them.

AVOID — this is exactly how earlier attempts went wrong:
· NO cute, cozy, storybook, chibi or plush look. No rounded friendly faces,
  no button eyes, no smiles.
· NO candy-bright, saturated, neon or pastel colour. If it looks cheerful,
  it is wrong.
· NO glossy, plasticky, airbrushed mobile-game rendering. No smooth 3D
  volume, no bevelled edges, no lens flares, no rim-lit chrome.
· NO photorealism and no hyper-detailed fur or scales — this is paint, and it
  is read at thumbnail size.
· NO warm paper, parchment or sepia wash over the whole image. Warmth is an
  accent, not a filter, and the ground is not part of the painting.
· NO frames, borders, cards, vignettes, matting or paper background behind
  the drawing. Nothing but flat magenta behind it, right up to its outline.
· Keep the subject the same subject and silhouette it already has. This is a
  restyle, not a redesign.

SIZE AND PLACEMENT — this is the part that goes wrong.
Do not enlarge it to fill the frame. The reference leaves air around the
subject and that air is not waste — it is where the things drawn live around
it go. Keep the subject the same fraction of the frame that the reference
has it, in the same place.
· Do not rotate it or change the viewing angle.
· No cast shadow on the ground. The game draws its own.

BACKGROUND — read this before anything else. It matters more than the style.
Fill every pixel that is not the object itself with solid, flat, pure magenta
#FF00FF. Treat it as a green-screen: one flat chroma-key colour, edge to edge.
· EXACTLY #FF00FF — red 255, green 0, blue 255. Not pink, not rose, not dusty
  pink, not mauve, not a soft or tinted version of it. Only the true colour can
  be cut away cleanly; a near miss has to be flood-filled instead, and a flood
  fill eats any pale paint it can reach.
· NOT transparent. Transparency gets exported as a grey-and-white CHECKERBOARD
  and then baked into the artwork as though the squares were paint.
· NOT white, cream, black, parchment, paper, or any tinted or textured ground.
· The object must NOT sit on a card, panel, sheet, badge, frame or rectangle of
  any kind. The magenta must touch the outline of the object on every side.
· No drop shadow onto the background, and no vignette.
· The object itself must contain no magenta or hot pink.
· The dark, desaturated palette above is for the OBJECT. The ground is not
  part of the painting and is not toned down with it: it stays a vivid,
  eye-hurting #FF00FF however dark everything else is. Dusty rose, pale pink
  and mauve are the failure this whole clause is about.

OUTPUT — read this twice, it is where every previous attempt failed:
· ONE image, exactly 512 x 512 pixels — square (1:1).
  If your tool has an aspect-ratio control, set it to match. Returns have
  come back at the tool's default ratio before, which overrides this line —
  the setting wins, so change the setting.
· ONE object. Not two, not a comparison, not variants side by side, not a
  before-and-after pair.
· No frame, border, card, label, caption, arrow, annotation or drop shadow.

---

# skill-grenade — The grenade skill  (images/ui/skill-grenade.webp)

Paint ONE game sprite in a single square (1:1) image.
The attached reference is exactly what to paint, at exactly the size and
position it is drawn at. Match both.

WHAT IT IS: The grenade skill's button icon: a round black-iron bomb with a short fuse curling from its top and a spark on the fuse's end — the one the player throws. Bold and simple, read at 24 px on a round button; the same silhouette as the reference, a ball with the fuse to the upper right.

STYLE — grim painted dark fantasy, like a plate from a gothic illustrated
bestiary or the key art of a dungeon crawler. Match this in every panel:
· INK FIRST. Heavy hand-drawn contour lines in near-black ink, jagged and
  confident, thick on the shadow side and thin on the lit side, with
  dry-brush breaks. The drawing must look DRAWN — scratchy linework showing
  through the paint.
· PAINTED, NOT RENDERED. Flat blocks of gouache-like paint inside the lines
  with visible brushwork, rough cel-style shadow shapes and a little grain.
  No airbrush, no smooth 3D shading, no plastic gloss.
· DESATURATED, LOW-KEY colour: bone, ash grey, dried blood, rust, bruise
  purple, swamp green, cold slate — with ONE hot accent per subject (ember
  orange, sickly witch-green, cold soul-blue, tarnished gold). Deep shadows
  that fall to black.
· HIGH CONTRAST and cold. The light comes from the UPPER LEFT. Chiaroscuro:
  most of every form in shadow, one edge picked out.
· Gothic, grotesque, worn: cracked bone, rusted iron, torn cloth, wet stone,
  candle-soot. Everything has been through something.
· Menacing rather than cute — but the SILHOUETTE stays readable at 40 px, so
  keep the big shapes simple and put the detail inside them.

AVOID — this is exactly how earlier attempts went wrong:
· NO cute, cozy, storybook, chibi or plush look. No rounded friendly faces,
  no button eyes, no smiles.
· NO candy-bright, saturated, neon or pastel colour. If it looks cheerful,
  it is wrong.
· NO glossy, plasticky, airbrushed mobile-game rendering. No smooth 3D
  volume, no bevelled edges, no lens flares, no rim-lit chrome.
· NO photorealism and no hyper-detailed fur or scales — this is paint, and it
  is read at thumbnail size.
· NO warm paper, parchment or sepia wash over the whole image. Warmth is an
  accent, not a filter, and the ground is not part of the painting.
· NO frames, borders, cards, vignettes, matting or paper background behind
  the drawing. Nothing but flat magenta behind it, right up to its outline.
· Keep the subject the same subject and silhouette it already has. This is a
  restyle, not a redesign.

SIZE AND PLACEMENT — this is the part that goes wrong.
Do not enlarge it to fill the frame. The reference leaves air around the
subject and that air is not waste — it is where the things drawn live around
it go. Keep the subject the same fraction of the frame that the reference
has it, in the same place.
· Do not rotate it or change the viewing angle.
· No cast shadow on the ground. The game draws its own.

BACKGROUND — read this before anything else. It matters more than the style.
Fill every pixel that is not the object itself with solid, flat, pure magenta
#FF00FF. Treat it as a green-screen: one flat chroma-key colour, edge to edge.
· EXACTLY #FF00FF — red 255, green 0, blue 255. Not pink, not rose, not dusty
  pink, not mauve, not a soft or tinted version of it. Only the true colour can
  be cut away cleanly; a near miss has to be flood-filled instead, and a flood
  fill eats any pale paint it can reach.
· NOT transparent. Transparency gets exported as a grey-and-white CHECKERBOARD
  and then baked into the artwork as though the squares were paint.
· NOT white, cream, black, parchment, paper, or any tinted or textured ground.
· The object must NOT sit on a card, panel, sheet, badge, frame or rectangle of
  any kind. The magenta must touch the outline of the object on every side.
· No drop shadow onto the background, and no vignette.
· The object itself must contain no magenta or hot pink.
· The dark, desaturated palette above is for the OBJECT. The ground is not
  part of the painting and is not toned down with it: it stays a vivid,
  eye-hurting #FF00FF however dark everything else is. Dusty rose, pale pink
  and mauve are the failure this whole clause is about.

OUTPUT — read this twice, it is where every previous attempt failed:
· ONE image, exactly 512 x 512 pixels — square (1:1).
  If your tool has an aspect-ratio control, set it to match. Returns have
  come back at the tool's default ratio before, which overrides this line —
  the setting wins, so change the setting.
· ONE object. Not two, not a comparison, not variants side by side, not a
  before-and-after pair.
· No frame, border, card, label, caption, arrow, annotation or drop shadow.

---

# skill-shield — The shield skill  (images/ui/skill-shield.webp)

Paint ONE game sprite in a single square (1:1) image.
The attached reference is exactly what to paint, at exactly the size and
position it is drawn at. Match both.

WHAT IT IS: The shield skill's button icon: a heater shield of cold steel with a heavy near-black rim and a raised iron boss, a cold blue witch-light glowing in its centre band — the same cold blue as the dome it raises over the crowd. Bold and simple, read at 24 px on a round button; the same silhouette as the reference.

STYLE — grim painted dark fantasy, like a plate from a gothic illustrated
bestiary or the key art of a dungeon crawler. Match this in every panel:
· INK FIRST. Heavy hand-drawn contour lines in near-black ink, jagged and
  confident, thick on the shadow side and thin on the lit side, with
  dry-brush breaks. The drawing must look DRAWN — scratchy linework showing
  through the paint.
· PAINTED, NOT RENDERED. Flat blocks of gouache-like paint inside the lines
  with visible brushwork, rough cel-style shadow shapes and a little grain.
  No airbrush, no smooth 3D shading, no plastic gloss.
· DESATURATED, LOW-KEY colour: bone, ash grey, dried blood, rust, bruise
  purple, swamp green, cold slate — with ONE hot accent per subject (ember
  orange, sickly witch-green, cold soul-blue, tarnished gold). Deep shadows
  that fall to black.
· HIGH CONTRAST and cold. The light comes from the UPPER LEFT. Chiaroscuro:
  most of every form in shadow, one edge picked out.
· Gothic, grotesque, worn: cracked bone, rusted iron, torn cloth, wet stone,
  candle-soot. Everything has been through something.
· Menacing rather than cute — but the SILHOUETTE stays readable at 40 px, so
  keep the big shapes simple and put the detail inside them.

AVOID — this is exactly how earlier attempts went wrong:
· NO cute, cozy, storybook, chibi or plush look. No rounded friendly faces,
  no button eyes, no smiles.
· NO candy-bright, saturated, neon or pastel colour. If it looks cheerful,
  it is wrong.
· NO glossy, plasticky, airbrushed mobile-game rendering. No smooth 3D
  volume, no bevelled edges, no lens flares, no rim-lit chrome.
· NO photorealism and no hyper-detailed fur or scales — this is paint, and it
  is read at thumbnail size.
· NO warm paper, parchment or sepia wash over the whole image. Warmth is an
  accent, not a filter, and the ground is not part of the painting.
· NO frames, borders, cards, vignettes, matting or paper background behind
  the drawing. Nothing but flat magenta behind it, right up to its outline.
· Keep the subject the same subject and silhouette it already has. This is a
  restyle, not a redesign.

SIZE AND PLACEMENT — this is the part that goes wrong.
Do not enlarge it to fill the frame. The reference leaves air around the
subject and that air is not waste — it is where the things drawn live around
it go. Keep the subject the same fraction of the frame that the reference
has it, in the same place.
· Do not rotate it or change the viewing angle.
· No cast shadow on the ground. The game draws its own.

BACKGROUND — read this before anything else. It matters more than the style.
Fill every pixel that is not the object itself with solid, flat, pure magenta
#FF00FF. Treat it as a green-screen: one flat chroma-key colour, edge to edge.
· EXACTLY #FF00FF — red 255, green 0, blue 255. Not pink, not rose, not dusty
  pink, not mauve, not a soft or tinted version of it. Only the true colour can
  be cut away cleanly; a near miss has to be flood-filled instead, and a flood
  fill eats any pale paint it can reach.
· NOT transparent. Transparency gets exported as a grey-and-white CHECKERBOARD
  and then baked into the artwork as though the squares were paint.
· NOT white, cream, black, parchment, paper, or any tinted or textured ground.
· The object must NOT sit on a card, panel, sheet, badge, frame or rectangle of
  any kind. The magenta must touch the outline of the object on every side.
· No drop shadow onto the background, and no vignette.
· The object itself must contain no magenta or hot pink.
· The dark, desaturated palette above is for the OBJECT. The ground is not
  part of the painting and is not toned down with it: it stays a vivid,
  eye-hurting #FF00FF however dark everything else is. Dusty rose, pale pink
  and mauve are the failure this whole clause is about.

OUTPUT — read this twice, it is where every previous attempt failed:
· ONE image, exactly 512 x 512 pixels — square (1:1).
  If your tool has an aspect-ratio control, set it to match. Returns have
  come back at the tool's default ratio before, which overrides this line —
  the setting wins, so change the setting.
· ONE object. Not two, not a comparison, not variants side by side, not a
  before-and-after pair.
· No frame, border, card, label, caption, arrow, annotation or drop shadow.

---

# logo — Title logo  (images/logo/logo_512x512.png)

Paint ONE game sprite in a single square (1:1) image.
The attached reference is exactly what to paint, at exactly the size and
position it is drawn at. Match both.

WHAT IT IS: The game's title logo: the single word SURVIVALIST in carved bone-and-black-iron dark-fantasy lettering, cracked and chipped, a faint ember glow at the edges. Spelled exactly S-U-R-V-I-V-A-L-I-S-T, in one line, readable at 192 px. Centred, filling about nine tenths of the width.

STYLE — grim painted dark fantasy, like a plate from a gothic illustrated
bestiary or the key art of a dungeon crawler. Match this in every panel:
· INK FIRST. Heavy hand-drawn contour lines in near-black ink, jagged and
  confident, thick on the shadow side and thin on the lit side, with
  dry-brush breaks. The drawing must look DRAWN — scratchy linework showing
  through the paint.
· PAINTED, NOT RENDERED. Flat blocks of gouache-like paint inside the lines
  with visible brushwork, rough cel-style shadow shapes and a little grain.
  No airbrush, no smooth 3D shading, no plastic gloss.
· DESATURATED, LOW-KEY colour: bone, ash grey, dried blood, rust, bruise
  purple, swamp green, cold slate — with ONE hot accent per subject (ember
  orange, sickly witch-green, cold soul-blue, tarnished gold). Deep shadows
  that fall to black.
· HIGH CONTRAST and cold. The light comes from the UPPER LEFT. Chiaroscuro:
  most of every form in shadow, one edge picked out.
· Gothic, grotesque, worn: cracked bone, rusted iron, torn cloth, wet stone,
  candle-soot. Everything has been through something.
· Menacing rather than cute — but the SILHOUETTE stays readable at 40 px, so
  keep the big shapes simple and put the detail inside them.

AVOID — this is exactly how earlier attempts went wrong:
· NO cute, cozy, storybook, chibi or plush look. No rounded friendly faces,
  no button eyes, no smiles.
· NO candy-bright, saturated, neon or pastel colour. If it looks cheerful,
  it is wrong.
· NO glossy, plasticky, airbrushed mobile-game rendering. No smooth 3D
  volume, no bevelled edges, no lens flares, no rim-lit chrome.
· NO photorealism and no hyper-detailed fur or scales — this is paint, and it
  is read at thumbnail size.
· NO warm paper, parchment or sepia wash over the whole image. Warmth is an
  accent, not a filter, and the ground is not part of the painting.
· NO frames, borders, cards, vignettes, matting or paper background behind
  the drawing. Nothing but flat magenta behind it, right up to its outline.
· Keep the subject the same subject and silhouette it already has. This is a
  restyle, not a redesign.

SIZE AND PLACEMENT — this is the part that goes wrong.
Do not enlarge it to fill the frame. The reference leaves air around the
subject and that air is not waste — it is where the things drawn live around
it go. Keep the subject the same fraction of the frame that the reference
has it, in the same place.
· Do not rotate it or change the viewing angle.
· No cast shadow on the ground. The game draws its own.

BACKGROUND — read this before anything else. It matters more than the style.
Fill every pixel that is not the object itself with solid, flat, pure magenta
#FF00FF. Treat it as a green-screen: one flat chroma-key colour, edge to edge.
· EXACTLY #FF00FF — red 255, green 0, blue 255. Not pink, not rose, not dusty
  pink, not mauve, not a soft or tinted version of it. Only the true colour can
  be cut away cleanly; a near miss has to be flood-filled instead, and a flood
  fill eats any pale paint it can reach.
· NOT transparent. Transparency gets exported as a grey-and-white CHECKERBOARD
  and then baked into the artwork as though the squares were paint.
· NOT white, cream, black, parchment, paper, or any tinted or textured ground.
· The object must NOT sit on a card, panel, sheet, badge, frame or rectangle of
  any kind. The magenta must touch the outline of the object on every side.
· No drop shadow onto the background, and no vignette.
· The object itself must contain no magenta or hot pink.
· The dark, desaturated palette above is for the OBJECT. The ground is not
  part of the painting and is not toned down with it: it stays a vivid,
  eye-hurting #FF00FF however dark everything else is. Dusty rose, pale pink
  and mauve are the failure this whole clause is about.

OUTPUT — read this twice, it is where every previous attempt failed:
· ONE image, exactly 1024 x 1024 pixels — square (1:1).
  If your tool has an aspect-ratio control, set it to match. Returns have
  come back at the tool's default ratio before, which overrides this line —
  the setting wins, so change the setting.
· ONE object. Not two, not a comparison, not variants side by side, not a
  before-and-after pair.
· No frame, border, card, label, caption, arrow, annotation or drop shadow.
