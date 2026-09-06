# Walk-cycle prompts — one design per generation

Generated from the manifest — do not hand-edit, re-export instead.

Attach `art-sheets/walk-<id>.png` and paste the matching block beside it.
Each is a grid of panels showing ONE subject through ONE cycle, and the
whole job is that it comes back as one subject and not eight.

Drop results in `art-sheets/painted/`, keeping the `walk-<id>` in the name,
then run `pnpm slice-sheets`. The slicer cuts the grid by proportion, so an
off-size return is fine as long as the panels are where the grid says.

# grumpling — Grumpling  (images/monsters/grumpling.webp)

WHAT COMES BACK IS A SPRITE SHEET, NOT A PORTRAIT.
Repaint a WALK CYCLE. The attached sheet is 4 columns x 2 rows
= EXACTLY 8 panels, read left to right along the top row and then the
bottom row. Every panel is the SAME creature at a different moment of one step.

· 8 panels. Not 1, not 4, not 12, not 16, not 24. Exactly 2 rows of 4 — do not add a row.
· ONE big painting of the character filling the canvas is the wrong answer
  however well it is painted, and so is a square canvas.
· The panels are TALLER than the creature on purpose. A low, wide creature leaves
  empty magenta above itself in every panel, and that space is NOT room for
  another row: 2 rows of 4, with air above each creature, is the whole
  sheet. A 4-row return cannot be cut — that is what came back last time.

ONE CHARACTER — read this before anything else.
All 8 panels must show the same individual:
identical colours, identical clothing and gear, identical proportions,
identical silhouette, identical markings, identical number of limbs and
horns. Only the POSE changes, and it changes exactly as the reference
shows — same limb positions, same body lean, same head angle.
· ONE colour scheme in every panel. A creature that is grey in one panel and
  brown in another is not one creature animated, it is several creatures side by
  side, and the result is unusable.
· Do not redesign it. Do not add or remove parts between panels.
· Do not turn it to face a different direction in any panel.
· Do not re-scale it: the creature must be the same size in every panel, and the
  same size it is in the reference. Do not move it around inside its panel.
· It faces the viewer in the reference. Keep that direction in all 8 panels.

WHAT IT IS: Grumpling — A gremlin-imp: a skull-sized head on a runt body, all underbite and needle teeth, torn bat-ears with one drooping lower than the other, oversized clawed feet, a pale sunken belly. It shuffles, permanently unimpressed. Menacing, not cute — a thing that bites ankles.

Colour identity (keep the HUE — this is how the player tells it from the
rest of the cast — but grim, desaturated and low-key, never vivid): mossy sick green hide going grey at the joints, a bone-pale belly, two small ember-coal eyes.

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

LAYOUT — the grid is a cutting guide, and it is cut blindly.
Each panel is exactly 1/4 of the width and 1/2 of the height.
A creature does NOT fill its panel — it is centred in it, at the size the
reference draws it, with clear magenta all round.
Never let a limb, tail, weapon or shadow cross into a neighbouring panel.
Do not add, drop, merge or reorder panels.
Do NOT draw the panel edges. No boxes, borders, gutters, guides, rules or
numbers — in ANY colour, magenta included. The magenta is the empty space the
creatures sit in, not a grid to draw with: the space BETWEEN two panels is the
same flat background as the space around each creature, and nothing marks the
join. The panels are found by measuring, so a drawn line is not a help, it is
a mark that ends up welded into the sprite.

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

The feet land on the same line in every panel — the same height from the
bottom of the panel as in the reference. If the feet drift up or down
between panels the creature bobs when it walks.
· The reference draws a soft contact shadow under the feet. Keep one, the
  same size in every panel, and keep it tight to the feet.

BEFORE YOU CALL IT FINISHED, count and check:
· 4 panels across, 2 down, 8 in all — and empty magenta
  above every creature, with no extra row squeezed into it.
· The canvas is landscape, 16:9.
· Every panel holds the same creature, at the same size, in the same colours,
  facing the viewer.
· Every pixel that is not the character is flat, vivid #FF00FF — hold it
  against a pure magenta swatch, not against your memory of one.

OUTPUT: one image, 1280 x 720 pixels (16:9, landscape). If your tool has
an aspect-ratio control, set it to 16:9 — a square return crushes the grid
and cannot be cut. No labels, captions, numbers or watermarks.

---

# bonecap — Bonecap  (images/monsters/bonecap.webp)

WHAT COMES BACK IS A SPRITE SHEET, NOT A PORTRAIT.
Repaint a WALK CYCLE. The attached sheet is 4 columns x 2 rows
= EXACTLY 8 panels, read left to right along the top row and then the
bottom row. Every panel is the SAME creature at a different moment of one step.

· 8 panels. Not 1, not 4, not 12, not 16, not 24. Exactly 2 rows of 4 — do not add a row.
· ONE big painting of the character filling the canvas is the wrong answer
  however well it is painted, and so is a square canvas.
· The panels are TALLER than the creature on purpose. A low, wide creature leaves
  empty magenta above itself in every panel, and that space is NOT room for
  another row: 2 rows of 4, with air above each creature, is the whole
  sheet. A 4-row return cannot be cut — that is what came back last time.

ONE CHARACTER — read this before anything else.
All 8 panels must show the same individual:
identical colours, identical clothing and gear, identical proportions,
identical silhouette, identical markings, identical number of limbs and
horns. Only the POSE changes, and it changes exactly as the reference
shows — same limb positions, same body lean, same head angle.
· ONE colour scheme in every panel. A creature that is grey in one panel and
  brown in another is not one creature animated, it is several creatures side by
  side, and the result is unusable.
· Do not redesign it. Do not add or remove parts between panels.
· Do not turn it to face a different direction in any panel.
· Do not re-scale it: the creature must be the same size in every panel, and the
  same size it is in the reference. Do not move it around inside its panel.
· It faces the viewer in the reference. Keep that direction in all 8 panels.

WHAT IT IS: Bonecap — Fungal undead: a hunched human skeleton whose skull is swallowed by a great pale toadstool cap with gills underneath, spore-light glowing in the empty sockets and between the ribs, mycelium threading the yellowed bone, one arm longer than the other.

Colour identity (keep the HUE — this is how the player tells it from the
rest of the cast — but grim, desaturated and low-key, never vivid): bone ivory, a cap of bruised grey-cream with dark spots, the light a poison green.

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

LAYOUT — the grid is a cutting guide, and it is cut blindly.
Each panel is exactly 1/4 of the width and 1/2 of the height.
A creature does NOT fill its panel — it is centred in it, at the size the
reference draws it, with clear magenta all round.
Never let a limb, tail, weapon or shadow cross into a neighbouring panel.
Do not add, drop, merge or reorder panels.
Do NOT draw the panel edges. No boxes, borders, gutters, guides, rules or
numbers — in ANY colour, magenta included. The magenta is the empty space the
creatures sit in, not a grid to draw with: the space BETWEEN two panels is the
same flat background as the space around each creature, and nothing marks the
join. The panels are found by measuring, so a drawn line is not a help, it is
a mark that ends up welded into the sprite.

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

The feet land on the same line in every panel — the same height from the
bottom of the panel as in the reference. If the feet drift up or down
between panels the creature bobs when it walks.
· The reference draws a soft contact shadow under the feet. Keep one, the
  same size in every panel, and keep it tight to the feet.

BEFORE YOU CALL IT FINISHED, count and check:
· 4 panels across, 2 down, 8 in all — and empty magenta
  above every creature, with no extra row squeezed into it.
· The canvas is landscape, 16:9.
· Every panel holds the same creature, at the same size, in the same colours,
  facing the viewer.
· Every pixel that is not the character is flat, vivid #FF00FF — hold it
  against a pure magenta swatch, not against your memory of one.

OUTPUT: one image, 1280 x 720 pixels (16:9, landscape). If your tool has
an aspect-ratio control, set it to 16:9 — a square return crushes the grid
and cannot be cut. No labels, captions, numbers or watermarks.

---

# snaggletusk — Snaggletusk  (images/monsters/snaggletusk.webp)

WHAT COMES BACK IS A SPRITE SHEET, NOT A PORTRAIT.
Repaint a WALK CYCLE. The attached sheet is 4 columns x 2 rows
= EXACTLY 8 panels, read left to right along the top row and then the
bottom row. Every panel is the SAME creature at a different moment of one step.

· 8 panels. Not 1, not 4, not 12, not 16, not 24. Exactly 2 rows of 4 — do not add a row.
· ONE big painting of the character filling the canvas is the wrong answer
  however well it is painted, and so is a square canvas.
· The panels are TALLER than the creature on purpose. A low, wide creature leaves
  empty magenta above itself in every panel, and that space is NOT room for
  another row: 2 rows of 4, with air above each creature, is the whole
  sheet. A 4-row return cannot be cut — that is what came back last time.

ONE CHARACTER — read this before anything else.
All 8 panels must show the same individual:
identical colours, identical clothing and gear, identical proportions,
identical silhouette, identical markings, identical number of limbs and
horns. Only the POSE changes, and it changes exactly as the reference
shows — same limb positions, same body lean, same head angle.
· ONE colour scheme in every panel. A creature that is grey in one panel and
  brown in another is not one creature animated, it is several creatures side by
  side, and the result is unusable.
· Do not redesign it. Do not add or remove parts between panels.
· Do not turn it to face a different direction in any panel.
· Do not re-scale it: the creature must be the same size in every panel, and the
  same size it is in the reference. Do not move it around inside its panel.
· It faces LEFT in the reference. Keep that direction in all 8 panels.

WHAT IT IS: Snaggletusk — A boar-beast, side on: low, heavy and forward — a hulking bristled boar with one great cracked tusk and a broken stump where the other was, scarred hide, a ridge of black bristles, small furious eyes, hooves that gouge. Built to hit a wall and keep going.

Colour identity (keep the HUE — this is how the player tells it from the
rest of the cast — but grim, desaturated and low-key, never vivid): ash-brown hide, black bristles, a dirty ivory tusk, ember eyes.

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

LAYOUT — the grid is a cutting guide, and it is cut blindly.
Each panel is exactly 1/4 of the width and 1/2 of the height.
A creature does NOT fill its panel — it is centred in it, at the size the
reference draws it, with clear magenta all round.
Never let a limb, tail, weapon or shadow cross into a neighbouring panel.
Do not add, drop, merge or reorder panels.
Do NOT draw the panel edges. No boxes, borders, gutters, guides, rules or
numbers — in ANY colour, magenta included. The magenta is the empty space the
creatures sit in, not a grid to draw with: the space BETWEEN two panels is the
same flat background as the space around each creature, and nothing marks the
join. The panels are found by measuring, so a drawn line is not a help, it is
a mark that ends up welded into the sprite.

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

The feet land on the same line in every panel — the same height from the
bottom of the panel as in the reference. If the feet drift up or down
between panels the creature bobs when it walks.
· The reference draws a soft contact shadow under the feet. Keep one, the
  same size in every panel, and keep it tight to the feet.

BEFORE YOU CALL IT FINISHED, count and check:
· 4 panels across, 2 down, 8 in all — and empty magenta
  above every creature, with no extra row squeezed into it.
· The canvas is landscape, 16:9.
· Every panel holds the same creature, at the same size, in the same colours,
  facing LEFT.
· Every pixel that is not the character is flat, vivid #FF00FF — hold it
  against a pure magenta swatch, not against your memory of one.

OUTPUT: one image, 1280 x 720 pixels (16:9, landscape). If your tool has
an aspect-ratio control, set it to 16:9 — a square return crushes the grid
and cannot be cut. No labels, captions, numbers or watermarks.

---

# wispling — Wispling  (images/monsters/wispling.webp)

WHAT COMES BACK IS A SPRITE SHEET, NOT A PORTRAIT.
Repaint a WALK CYCLE. The attached sheet is 4 columns x 2 rows
= EXACTLY 8 panels, read left to right along the top row and then the
bottom row. Every panel is the SAME creature at a different moment of one step.

· 8 panels. Not 1, not 4, not 12, not 16, not 24. Exactly 2 rows of 4 — do not add a row.
· ONE big painting of the character filling the canvas is the wrong answer
  however well it is painted, and so is a square canvas.
· The panels are TALLER than the creature on purpose. A low, wide creature leaves
  empty magenta above itself in every panel, and that space is NOT room for
  another row: 2 rows of 4, with air above each creature, is the whole
  sheet. A 4-row return cannot be cut — that is what came back last time.

ONE CHARACTER — read this before anything else.
All 8 panels must show the same individual:
identical colours, identical clothing and gear, identical proportions,
identical silhouette, identical markings, identical number of limbs and
horns. Only the POSE changes, and it changes exactly as the reference
shows — same limb positions, same body lean, same head angle.
· ONE colour scheme in every panel. A creature that is grey in one panel and
  brown in another is not one creature animated, it is several creatures side by
  side, and the result is unusable.
· Do not redesign it. Do not add or remove parts between panels.
· Do not turn it to face a different direction in any panel.
· Do not re-scale it: the creature must be the same size in every panel, and the
  same size it is in the reference. Do not move it around inside its panel.
· It faces the viewer in the reference. Keep that direction in all 8 panels.

WHAT IT IS: Wispling — A lantern ghost: a tattered floating shroud with no body inside it, a cold flame burning where a face should be, two hollow eyes that never blink together, rags trailing that never touch the ground. Sinister, not endearing.

Colour identity (keep the HUE — this is how the player tells it from the
rest of the cast — but grim, desaturated and low-key, never vivid): a faded grey-teal linen shroud, the flame cold blue-white, nothing warm anywhere on it.

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

LAYOUT — the grid is a cutting guide, and it is cut blindly.
Each panel is exactly 1/4 of the width and 1/2 of the height.
A creature does NOT fill its panel — it is centred in it, at the size the
reference draws it, with clear magenta all round.
Never let a limb, tail, weapon or shadow cross into a neighbouring panel.
Do not add, drop, merge or reorder panels.
Do NOT draw the panel edges. No boxes, borders, gutters, guides, rules or
numbers — in ANY colour, magenta included. The magenta is the empty space the
creatures sit in, not a grid to draw with: the space BETWEEN two panels is the
same flat background as the space around each creature, and nothing marks the
join. The panels are found by measuring, so a drawn line is not a help, it is
a mark that ends up welded into the sprite.

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

The feet land on the same line in every panel — the same height from the
bottom of the panel as in the reference. If the feet drift up or down
between panels the creature bobs when it walks.
· The reference draws a soft contact shadow under the feet. Keep one, the
  same size in every panel, and keep it tight to the feet.

BEFORE YOU CALL IT FINISHED, count and check:
· 4 panels across, 2 down, 8 in all — and empty magenta
  above every creature, with no extra row squeezed into it.
· The canvas is landscape, 16:9.
· Every panel holds the same creature, at the same size, in the same colours,
  facing the viewer.
· Every pixel that is not the character is flat, vivid #FF00FF — hold it
  against a pure magenta swatch, not against your memory of one.

OUTPUT: one image, 1280 x 720 pixels (16:9, landscape). If your tool has
an aspect-ratio control, set it to 16:9 — a square return crushes the grid
and cannot be cut. No labels, captions, numbers or watermarks.

---

# marrowknight — Marrow Knight  (images/monsters/marrowknight.webp)

WHAT COMES BACK IS A SPRITE SHEET, NOT A PORTRAIT.
Repaint a WALK CYCLE. The attached sheet is 4 columns x 2 rows
= EXACTLY 8 panels, read left to right along the top row and then the
bottom row. Every panel is the SAME creature at a different moment of one step.

· 8 panels. Not 1, not 4, not 12, not 16, not 24. Exactly 2 rows of 4 — do not add a row.
· ONE big painting of the character filling the canvas is the wrong answer
  however well it is painted, and so is a square canvas.
· The panels are TALLER than the creature on purpose. A low, wide creature leaves
  empty magenta above itself in every panel, and that space is NOT room for
  another row: 2 rows of 4, with air above each creature, is the whole
  sheet. A 4-row return cannot be cut — that is what came back last time.

ONE CHARACTER — read this before anything else.
All 8 panels must show the same individual:
identical colours, identical clothing and gear, identical proportions,
identical silhouette, identical markings, identical number of limbs and
horns. Only the POSE changes, and it changes exactly as the reference
shows — same limb positions, same body lean, same head angle.
· ONE colour scheme in every panel. A creature that is grey in one panel and
  brown in another is not one creature animated, it is several creatures side by
  side, and the result is unusable.
· Do not redesign it. Do not add or remove parts between panels.
· Do not turn it to face a different direction in any panel.
· Do not re-scale it: the creature must be the same size in every panel, and the
  same size it is in the reference. Do not move it around inside its panel.
· It faces the viewer in the reference. Keep that direction in all 8 panels.

WHAT IT IS: Marrow Knight — An armoured skeleton knight, front on: dented black-iron plate over yellowed bone, a horned great-helm with cold light in the visor slit, a notched greatsword held low, a rotting tabard over the cuirass. It waits rather than lurches — the one that outranks the rest.

Colour identity (keep the HUE — this is how the player tells it from the
rest of the cast — but grim, desaturated and low-key, never vivid): blackened iron, bone, a tabard in dried-blood red gone brown, the visor light cold blue.

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

LAYOUT — the grid is a cutting guide, and it is cut blindly.
Each panel is exactly 1/4 of the width and 1/2 of the height.
A creature does NOT fill its panel — it is centred in it, at the size the
reference draws it, with clear magenta all round.
Never let a limb, tail, weapon or shadow cross into a neighbouring panel.
Do not add, drop, merge or reorder panels.
Do NOT draw the panel edges. No boxes, borders, gutters, guides, rules or
numbers — in ANY colour, magenta included. The magenta is the empty space the
creatures sit in, not a grid to draw with: the space BETWEEN two panels is the
same flat background as the space around each creature, and nothing marks the
join. The panels are found by measuring, so a drawn line is not a help, it is
a mark that ends up welded into the sprite.

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

The feet land on the same line in every panel — the same height from the
bottom of the panel as in the reference. If the feet drift up or down
between panels the creature bobs when it walks.
· The reference draws a soft contact shadow under the feet. Keep one, the
  same size in every panel, and keep it tight to the feet.

BEFORE YOU CALL IT FINISHED, count and check:
· 4 panels across, 2 down, 8 in all — and empty magenta
  above every creature, with no extra row squeezed into it.
· The canvas is landscape, 16:9.
· Every panel holds the same creature, at the same size, in the same colours,
  facing the viewer.
· Every pixel that is not the character is flat, vivid #FF00FF — hold it
  against a pure magenta swatch, not against your memory of one.

OUTPUT: one image, 1280 x 720 pixels (16:9, landscape). If your tool has
an aspect-ratio control, set it to 16:9 — a square return crushes the grid
and cannot be cut. No labels, captions, numbers or watermarks.

---

# nibbler — Nibbler  (images/monsters/nibbler.webp)

WHAT COMES BACK IS A SPRITE SHEET, NOT A PORTRAIT.
Repaint a WALK CYCLE. The attached sheet is 4 columns x 2 rows
= EXACTLY 8 panels, read left to right along the top row and then the
bottom row. Every panel is the SAME creature at a different moment of one step.

· 8 panels. Not 1, not 4, not 12, not 16, not 24. Exactly 2 rows of 4 — do not add a row.
· ONE big painting of the character filling the canvas is the wrong answer
  however well it is painted, and so is a square canvas.
· The panels are TALLER than the creature on purpose. A low, wide creature leaves
  empty magenta above itself in every panel, and that space is NOT room for
  another row: 2 rows of 4, with air above each creature, is the whole
  sheet. A 4-row return cannot be cut — that is what came back last time.

ONE CHARACTER — read this before anything else.
All 8 panels must show the same individual:
identical colours, identical clothing and gear, identical proportions,
identical silhouette, identical markings, identical number of limbs and
horns. Only the POSE changes, and it changes exactly as the reference
shows — same limb positions, same body lean, same head angle.
· ONE colour scheme in every panel. A creature that is grey in one panel and
  brown in another is not one creature animated, it is several creatures side by
  side, and the result is unusable.
· Do not redesign it. Do not add or remove parts between panels.
· Do not turn it to face a different direction in any panel.
· Do not re-scale it: the creature must be the same size in every panel, and the
  same size it is in the reference. Do not move it around inside its panel.
· It faces the viewer in the reference. Keep that direction in all 8 panels.

WHAT IT IS: Nibbler — A bat-imp: mostly ears and mouth — two huge ragged ears, one torn, a gaping needle-toothed maw, small red eyes, leathery wings folded round it like a cloak, hooked feet.

Colour identity (keep the HUE — this is how the player tells it from the
rest of the cast — but grim, desaturated and low-key, never vivid): dusk-purple hide going black at the ears, wing membrane a bruised plum, ivory teeth, ember-red eyes.

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

LAYOUT — the grid is a cutting guide, and it is cut blindly.
Each panel is exactly 1/4 of the width and 1/2 of the height.
A creature does NOT fill its panel — it is centred in it, at the size the
reference draws it, with clear magenta all round.
Never let a limb, tail, weapon or shadow cross into a neighbouring panel.
Do not add, drop, merge or reorder panels.
Do NOT draw the panel edges. No boxes, borders, gutters, guides, rules or
numbers — in ANY colour, magenta included. The magenta is the empty space the
creatures sit in, not a grid to draw with: the space BETWEEN two panels is the
same flat background as the space around each creature, and nothing marks the
join. The panels are found by measuring, so a drawn line is not a help, it is
a mark that ends up welded into the sprite.

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

The feet land on the same line in every panel — the same height from the
bottom of the panel as in the reference. If the feet drift up or down
between panels the creature bobs when it walks.
· The reference draws a soft contact shadow under the feet. Keep one, the
  same size in every panel, and keep it tight to the feet.

BEFORE YOU CALL IT FINISHED, count and check:
· 4 panels across, 2 down, 8 in all — and empty magenta
  above every creature, with no extra row squeezed into it.
· The canvas is landscape, 16:9.
· Every panel holds the same creature, at the same size, in the same colours,
  facing the viewer.
· Every pixel that is not the character is flat, vivid #FF00FF — hold it
  against a pure magenta swatch, not against your memory of one.

OUTPUT: one image, 1280 x 720 pixels (16:9, landscape). If your tool has
an aspect-ratio control, set it to 16:9 — a square return crushes the grid
and cannot be cut. No labels, captions, numbers or watermarks.

---

# cinderhound — Cinderhound  (images/monsters/cinderhound.webp)

WHAT COMES BACK IS A SPRITE SHEET, NOT A PORTRAIT.
Repaint a WALK CYCLE. The attached sheet is 4 columns x 2 rows
= EXACTLY 8 panels, read left to right along the top row and then the
bottom row. Every panel is the SAME creature at a different moment of one step.

· 8 panels. Not 1, not 4, not 12, not 16, not 24. Exactly 2 rows of 4 — do not add a row.
· ONE big painting of the character filling the canvas is the wrong answer
  however well it is painted, and so is a square canvas.
· The panels are TALLER than the creature on purpose. A low, wide creature leaves
  empty magenta above itself in every panel, and that space is NOT room for
  another row: 2 rows of 4, with air above each creature, is the whole
  sheet. A 4-row return cannot be cut — that is what came back last time.

ONE CHARACTER — read this before anything else.
All 8 panels must show the same individual:
identical colours, identical clothing and gear, identical proportions,
identical silhouette, identical markings, identical number of limbs and
horns. Only the POSE changes, and it changes exactly as the reference
shows — same limb positions, same body lean, same head angle.
· ONE colour scheme in every panel. A creature that is grey in one panel and
  brown in another is not one creature animated, it is several creatures side by
  side, and the result is unusable.
· Do not redesign it. Do not add or remove parts between panels.
· Do not turn it to face a different direction in any panel.
· Do not re-scale it: the creature must be the same size in every panel, and the
  same size it is in the reference. Do not move it around inside its panel.
· It faces LEFT in the reference. Keep that direction in all 8 panels.

WHAT IT IS: Cinderhound — A burning hound, side on: all legs and ribs — a starved skeletal dog with embers glowing between its ribs, fire licking off its spine, a long muzzle of black teeth, hide cracked with heat lines, a tail that is a wisp of smoke. The fast one, and it is starving.

Colour identity (keep the HUE — this is how the player tells it from the
rest of the cast — but grim, desaturated and low-key, never vivid): ash grey and charcoal, the cracks and ribs ember orange, white-hot eyes.

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

LAYOUT — the grid is a cutting guide, and it is cut blindly.
Each panel is exactly 1/4 of the width and 1/2 of the height.
A creature does NOT fill its panel — it is centred in it, at the size the
reference draws it, with clear magenta all round.
Never let a limb, tail, weapon or shadow cross into a neighbouring panel.
Do not add, drop, merge or reorder panels.
Do NOT draw the panel edges. No boxes, borders, gutters, guides, rules or
numbers — in ANY colour, magenta included. The magenta is the empty space the
creatures sit in, not a grid to draw with: the space BETWEEN two panels is the
same flat background as the space around each creature, and nothing marks the
join. The panels are found by measuring, so a drawn line is not a help, it is
a mark that ends up welded into the sprite.

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

The feet land on the same line in every panel — the same height from the
bottom of the panel as in the reference. If the feet drift up or down
between panels the creature bobs when it walks.
· The reference draws a soft contact shadow under the feet. Keep one, the
  same size in every panel, and keep it tight to the feet.

BEFORE YOU CALL IT FINISHED, count and check:
· 4 panels across, 2 down, 8 in all — and empty magenta
  above every creature, with no extra row squeezed into it.
· The canvas is landscape, 16:9.
· Every panel holds the same creature, at the same size, in the same colours,
  facing LEFT.
· Every pixel that is not the character is flat, vivid #FF00FF — hold it
  against a pure magenta swatch, not against your memory of one.

OUTPUT: one image, 1280 x 720 pixels (16:9, landscape). If your tool has
an aspect-ratio control, set it to 16:9 — a square return crushes the grid
and cannot be cut. No labels, captions, numbers or watermarks.

---

# blorp — Blorp  (images/monsters/blorp.webp)

WHAT COMES BACK IS A SPRITE SHEET, NOT A PORTRAIT.
Repaint a WALK CYCLE. The attached sheet is 4 columns x 2 rows
= EXACTLY 8 panels, read left to right along the top row and then the
bottom row. Every panel is the SAME creature at a different moment of one step.

· 8 panels. Not 1, not 4, not 12, not 16, not 24. Exactly 2 rows of 4 — do not add a row.
· ONE big painting of the character filling the canvas is the wrong answer
  however well it is painted, and so is a square canvas.
· The panels are TALLER than the creature on purpose. A low, wide creature leaves
  empty magenta above itself in every panel, and that space is NOT room for
  another row: 2 rows of 4, with air above each creature, is the whole
  sheet. A 4-row return cannot be cut — that is what came back last time.

ONE CHARACTER — read this before anything else.
All 8 panels must show the same individual:
identical colours, identical clothing and gear, identical proportions,
identical silhouette, identical markings, identical number of limbs and
horns. Only the POSE changes, and it changes exactly as the reference
shows — same limb positions, same body lean, same head angle.
· ONE colour scheme in every panel. A creature that is grey in one panel and
  brown in another is not one creature animated, it is several creatures side by
  side, and the result is unusable.
· Do not redesign it. Do not add or remove parts between panels.
· Do not turn it to face a different direction in any panel.
· Do not re-scale it: the creature must be the same size in every panel, and the
  same size it is in the reference. Do not move it around inside its panel.
· It faces the viewer in the reference. Keep that direction in all 8 panels.

WHAT IT IS: Blorp — A swamp ooze: a heaving mound of murky slime with a bone and a skull suspended inside it, a wide toothless grin that is not friendly, two mismatched bubble eyes, dripping at the edges.

Colour identity (keep the HUE — this is how the player tells it from the
rest of the cast — but grim, desaturated and low-key, never vivid): bog green shading to black, a sick yellow-green highlight on the wet crest, the bones inside bone-white.

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

LAYOUT — the grid is a cutting guide, and it is cut blindly.
Each panel is exactly 1/4 of the width and 1/2 of the height.
A creature does NOT fill its panel — it is centred in it, at the size the
reference draws it, with clear magenta all round.
Never let a limb, tail, weapon or shadow cross into a neighbouring panel.
Do not add, drop, merge or reorder panels.
Do NOT draw the panel edges. No boxes, borders, gutters, guides, rules or
numbers — in ANY colour, magenta included. The magenta is the empty space the
creatures sit in, not a grid to draw with: the space BETWEEN two panels is the
same flat background as the space around each creature, and nothing marks the
join. The panels are found by measuring, so a drawn line is not a help, it is
a mark that ends up welded into the sprite.

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

The feet land on the same line in every panel — the same height from the
bottom of the panel as in the reference. If the feet drift up or down
between panels the creature bobs when it walks.
· The reference draws a soft contact shadow under the feet. Keep one, the
  same size in every panel, and keep it tight to the feet.

BEFORE YOU CALL IT FINISHED, count and check:
· 4 panels across, 2 down, 8 in all — and empty magenta
  above every creature, with no extra row squeezed into it.
· The canvas is landscape, 16:9.
· Every panel holds the same creature, at the same size, in the same colours,
  facing the viewer.
· Every pixel that is not the character is flat, vivid #FF00FF — hold it
  against a pure magenta swatch, not against your memory of one.

OUTPUT: one image, 1280 x 720 pixels (16:9, landscape). If your tool has
an aspect-ratio control, set it to 16:9 — a square return crushes the grid
and cannot be cut. No labels, captions, numbers or watermarks.

---

# thornwick — Thornwick  (images/monsters/thornwick.webp)

WHAT COMES BACK IS A SPRITE SHEET, NOT A PORTRAIT.
Repaint a WALK CYCLE. The attached sheet is 4 columns x 2 rows
= EXACTLY 8 panels, read left to right along the top row and then the
bottom row. Every panel is the SAME creature at a different moment of one step.

· 8 panels. Not 1, not 4, not 12, not 16, not 24. Exactly 2 rows of 4 — do not add a row.
· ONE big painting of the character filling the canvas is the wrong answer
  however well it is painted, and so is a square canvas.
· The panels are TALLER than the creature on purpose. A low, wide creature leaves
  empty magenta above itself in every panel, and that space is NOT room for
  another row: 2 rows of 4, with air above each creature, is the whole
  sheet. A 4-row return cannot be cut — that is what came back last time.

ONE CHARACTER — read this before anything else.
All 8 panels must show the same individual:
identical colours, identical clothing and gear, identical proportions,
identical silhouette, identical markings, identical number of limbs and
horns. Only the POSE changes, and it changes exactly as the reference
shows — same limb positions, same body lean, same head angle.
· ONE colour scheme in every panel. A creature that is grey in one panel and
  brown in another is not one creature animated, it is several creatures side by
  side, and the result is unusable.
· Do not redesign it. Do not add or remove parts between panels.
· Do not turn it to face a different direction in any panel.
· Do not re-scale it: the creature must be the same size in every panel, and the
  same size it is in the reference. Do not move it around inside its panel.
· It faces the viewer in the reference. Keep that direction in all 8 panels.

WHAT IT IS: Thornwick — A bramble treant: a slow, patient tree-thing made entirely of black thorns and dead wood, a hollow face split into the trunk with a pale witch-light burning inside it, roots for feet, bramble-whips for arms, a crown of bare branches.

Colour identity (keep the HUE — this is how the player tells it from the
rest of the cast — but grim, desaturated and low-key, never vivid): dead bark black-brown, near-black thorns, the light in the face a pale sick green-white, a few dead leaves in rust.

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

LAYOUT — the grid is a cutting guide, and it is cut blindly.
Each panel is exactly 1/4 of the width and 1/2 of the height.
A creature does NOT fill its panel — it is centred in it, at the size the
reference draws it, with clear magenta all round.
Never let a limb, tail, weapon or shadow cross into a neighbouring panel.
Do not add, drop, merge or reorder panels.
Do NOT draw the panel edges. No boxes, borders, gutters, guides, rules or
numbers — in ANY colour, magenta included. The magenta is the empty space the
creatures sit in, not a grid to draw with: the space BETWEEN two panels is the
same flat background as the space around each creature, and nothing marks the
join. The panels are found by measuring, so a drawn line is not a help, it is
a mark that ends up welded into the sprite.

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

The feet land on the same line in every panel — the same height from the
bottom of the panel as in the reference. If the feet drift up or down
between panels the creature bobs when it walks.
· The reference draws a soft contact shadow under the feet. Keep one, the
  same size in every panel, and keep it tight to the feet.

BEFORE YOU CALL IT FINISHED, count and check:
· 4 panels across, 2 down, 8 in all — and empty magenta
  above every creature, with no extra row squeezed into it.
· The canvas is landscape, 16:9.
· Every panel holds the same creature, at the same size, in the same colours,
  facing the viewer.
· Every pixel that is not the character is flat, vivid #FF00FF — hold it
  against a pure magenta swatch, not against your memory of one.

OUTPUT: one image, 1280 x 720 pixels (16:9, landscape). If your tool has
an aspect-ratio control, set it to 16:9 — a square return crushes the grid
and cannot be cut. No labels, captions, numbers or watermarks.

---

# rattlejack — Rattlejack  (images/monsters/rattlejack.webp)

WHAT COMES BACK IS A SPRITE SHEET, NOT A PORTRAIT.
Repaint a WALK CYCLE. The attached sheet is 4 columns x 2 rows
= EXACTLY 8 panels, read left to right along the top row and then the
bottom row. Every panel is the SAME creature at a different moment of one step.

· 8 panels. Not 1, not 4, not 12, not 16, not 24. Exactly 2 rows of 4 — do not add a row.
· ONE big painting of the character filling the canvas is the wrong answer
  however well it is painted, and so is a square canvas.
· The panels are TALLER than the creature on purpose. A low, wide creature leaves
  empty magenta above itself in every panel, and that space is NOT room for
  another row: 2 rows of 4, with air above each creature, is the whole
  sheet. A 4-row return cannot be cut — that is what came back last time.

ONE CHARACTER — read this before anything else.
All 8 panels must show the same individual:
identical colours, identical clothing and gear, identical proportions,
identical silhouette, identical markings, identical number of limbs and
horns. Only the POSE changes, and it changes exactly as the reference
shows — same limb positions, same body lean, same head angle.
· ONE colour scheme in every panel. A creature that is grey in one panel and
  brown in another is not one creature animated, it is several creatures side by
  side, and the result is unusable.
· Do not redesign it. Do not add or remove parts between panels.
· Do not turn it to face a different direction in any panel.
· Do not re-scale it: the creature must be the same size in every panel, and the
  same size it is in the reference. Do not move it around inside its panel.
· It faces the viewer in the reference. Keep that direction in all 8 panels.

WHAT IT IS: Rattlejack — A scrap skeleton: a jittering human skeleton in stolen scraps of armour, a dented iron cooking pot worn as a helm, a rusted cleaver, bones tied together with wire, one socket lit. No plan whatsoever.

Colour identity (keep the HUE — this is how the player tells it from the
rest of the cast — but grim, desaturated and low-key, never vivid): yellowed bone, rust-brown iron, a tatter of faded red cloth, the lit socket ember-red.

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

LAYOUT — the grid is a cutting guide, and it is cut blindly.
Each panel is exactly 1/4 of the width and 1/2 of the height.
A creature does NOT fill its panel — it is centred in it, at the size the
reference draws it, with clear magenta all round.
Never let a limb, tail, weapon or shadow cross into a neighbouring panel.
Do not add, drop, merge or reorder panels.
Do NOT draw the panel edges. No boxes, borders, gutters, guides, rules or
numbers — in ANY colour, magenta included. The magenta is the empty space the
creatures sit in, not a grid to draw with: the space BETWEEN two panels is the
same flat background as the space around each creature, and nothing marks the
join. The panels are found by measuring, so a drawn line is not a help, it is
a mark that ends up welded into the sprite.

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

The feet land on the same line in every panel — the same height from the
bottom of the panel as in the reference. If the feet drift up or down
between panels the creature bobs when it walks.
· The reference draws a soft contact shadow under the feet. Keep one, the
  same size in every panel, and keep it tight to the feet.

BEFORE YOU CALL IT FINISHED, count and check:
· 4 panels across, 2 down, 8 in all — and empty magenta
  above every creature, with no extra row squeezed into it.
· The canvas is landscape, 16:9.
· Every panel holds the same creature, at the same size, in the same colours,
  facing the viewer.
· Every pixel that is not the character is flat, vivid #FF00FF — hold it
  against a pure magenta swatch, not against your memory of one.

OUTPUT: one image, 1280 x 720 pixels (16:9, landscape). If your tool has
an aspect-ratio control, set it to 16:9 — a square return crushes the grid
and cannot be cut. No labels, captions, numbers or watermarks.

---

# dustmoth — Dustmoth  (images/monsters/dustmoth.webp)

WHAT COMES BACK IS A SPRITE SHEET, NOT A PORTRAIT.
Repaint a WALK CYCLE. The attached sheet is 4 columns x 2 rows
= EXACTLY 8 panels, read left to right along the top row and then the
bottom row. Every panel is the SAME creature at a different moment of one step.

· 8 panels. Not 1, not 4, not 12, not 16, not 24. Exactly 2 rows of 4 — do not add a row.
· ONE big painting of the character filling the canvas is the wrong answer
  however well it is painted, and so is a square canvas.
· The panels are TALLER than the creature on purpose. A low, wide creature leaves
  empty magenta above itself in every panel, and that space is NOT room for
  another row: 2 rows of 4, with air above each creature, is the whole
  sheet. A 4-row return cannot be cut — that is what came back last time.

ONE CHARACTER — read this before anything else.
All 8 panels must show the same individual:
identical colours, identical clothing and gear, identical proportions,
identical silhouette, identical markings, identical number of limbs and
horns. Only the POSE changes, and it changes exactly as the reference
shows — same limb positions, same body lean, same head angle.
· ONE colour scheme in every panel. A creature that is grey in one panel and
  brown in another is not one creature animated, it is several creatures side by
  side, and the result is unusable.
· Do not redesign it. Do not add or remove parts between panels.
· Do not turn it to face a different direction in any panel.
· Do not re-scale it: the creature must be the same size in every panel, and the
  same size it is in the reference. Do not move it around inside its panel.
· It faces the viewer in the reference. Keep that direction in all 8 panels.

WHAT IT IS: Dustmoth — A crypt moth, front on, wings spread: a great dusty moth with tattered wing edges and two staring eyespots on the forewings, a furred thorax, dangling hooked legs, feathery antennae. Sinister — the eyespots are watching.

Colour identity (keep the HUE — this is how the player tells it from the
rest of the cast — but grim, desaturated and low-key, never vivid): dust grey and dead-leaf brown, the eyespots ringed in bone and bruise-purple, a faint cold shimmer on the wing scales.

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

LAYOUT — the grid is a cutting guide, and it is cut blindly.
Each panel is exactly 1/4 of the width and 1/2 of the height.
A creature does NOT fill its panel — it is centred in it, at the size the
reference draws it, with clear magenta all round.
Never let a limb, tail, weapon or shadow cross into a neighbouring panel.
Do not add, drop, merge or reorder panels.
Do NOT draw the panel edges. No boxes, borders, gutters, guides, rules or
numbers — in ANY colour, magenta included. The magenta is the empty space the
creatures sit in, not a grid to draw with: the space BETWEEN two panels is the
same flat background as the space around each creature, and nothing marks the
join. The panels are found by measuring, so a drawn line is not a help, it is
a mark that ends up welded into the sprite.

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

The feet land on the same line in every panel — the same height from the
bottom of the panel as in the reference. If the feet drift up or down
between panels the creature bobs when it walks.
· The reference draws a soft contact shadow under the feet. Keep one, the
  same size in every panel, and keep it tight to the feet.

BEFORE YOU CALL IT FINISHED, count and check:
· 4 panels across, 2 down, 8 in all — and empty magenta
  above every creature, with no extra row squeezed into it.
· The canvas is landscape, 16:9.
· Every panel holds the same creature, at the same size, in the same colours,
  facing the viewer.
· Every pixel that is not the character is flat, vivid #FF00FF — hold it
  against a pure magenta swatch, not against your memory of one.

OUTPUT: one image, 1280 x 720 pixels (16:9, landscape). If your tool has
an aspect-ratio control, set it to 16:9 — a square return crushes the grid
and cannot be cut. No labels, captions, numbers or watermarks.

---

# skewer — Skewer  (images/monsters/skewer.webp)

WHAT COMES BACK IS A SPRITE SHEET, NOT A PORTRAIT.
Repaint a WALK CYCLE. The attached sheet is 4 columns x 2 rows
= EXACTLY 8 panels, read left to right along the top row and then the
bottom row. Every panel is the SAME creature at a different moment of one step.

· 8 panels. Not 1, not 4, not 12, not 16, not 24. Exactly 2 rows of 4 — do not add a row.
· ONE big painting of the character filling the canvas is the wrong answer
  however well it is painted, and so is a square canvas.
· The panels are TALLER than the creature on purpose. A low, wide creature leaves
  empty magenta above itself in every panel, and that space is NOT room for
  another row: 2 rows of 4, with air above each creature, is the whole
  sheet. A 4-row return cannot be cut — that is what came back last time.

ONE CHARACTER — read this before anything else.
All 8 panels must show the same individual:
identical colours, identical clothing and gear, identical proportions,
identical silhouette, identical markings, identical number of limbs and
horns. Only the POSE changes, and it changes exactly as the reference
shows — same limb positions, same body lean, same head angle.
· ONE colour scheme in every panel. A creature that is grey in one panel and
  brown in another is not one creature animated, it is several creatures side by
  side, and the result is unusable.
· Do not redesign it. Do not add or remove parts between panels.
· Do not turn it to face a different direction in any panel.
· Do not re-scale it: the creature must be the same size in every panel, and the
  same size it is in the reference. Do not move it around inside its panel.
· It faces LEFT in the reference. Keep that direction in all 8 panels.

WHAT IT IS: Skewer — A wyrmling, side on: a small fast serpentine dragon that is almost entirely the pointy end — a spear-pointed head, a long neck, small ragged bat wings, a whipping tail.

Colour identity (keep the HUE — this is how the player tells it from the
rest of the cast — but grim, desaturated and low-key, never vivid): slate green scales going black along the spine, a dull bone belly, a hot yellow slit of an eye.

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

LAYOUT — the grid is a cutting guide, and it is cut blindly.
Each panel is exactly 1/4 of the width and 1/2 of the height.
A creature does NOT fill its panel — it is centred in it, at the size the
reference draws it, with clear magenta all round.
Never let a limb, tail, weapon or shadow cross into a neighbouring panel.
Do not add, drop, merge or reorder panels.
Do NOT draw the panel edges. No boxes, borders, gutters, guides, rules or
numbers — in ANY colour, magenta included. The magenta is the empty space the
creatures sit in, not a grid to draw with: the space BETWEEN two panels is the
same flat background as the space around each creature, and nothing marks the
join. The panels are found by measuring, so a drawn line is not a help, it is
a mark that ends up welded into the sprite.

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

The feet land on the same line in every panel — the same height from the
bottom of the panel as in the reference. If the feet drift up or down
between panels the creature bobs when it walks.
· The reference draws a soft contact shadow under the feet. Keep one, the
  same size in every panel, and keep it tight to the feet.

BEFORE YOU CALL IT FINISHED, count and check:
· 4 panels across, 2 down, 8 in all — and empty magenta
  above every creature, with no extra row squeezed into it.
· The canvas is landscape, 16:9.
· Every panel holds the same creature, at the same size, in the same colours,
  facing LEFT.
· Every pixel that is not the character is flat, vivid #FF00FF — hold it
  against a pure magenta swatch, not against your memory of one.

OUTPUT: one image, 1280 x 720 pixels (16:9, landscape). If your tool has
an aspect-ratio control, set it to 16:9 — a square return crushes the grid
and cannot be cut. No labels, captions, numbers or watermarks.

---

# gloomcrow — Gloomcrow  (images/monsters/gloomcrow.webp)

WHAT COMES BACK IS A SPRITE SHEET, NOT A PORTRAIT.
Repaint a WALK CYCLE. The attached sheet is 4 columns x 2 rows
= EXACTLY 8 panels, read left to right along the top row and then the
bottom row. Every panel is the SAME creature at a different moment of one step.

· 8 panels. Not 1, not 4, not 12, not 16, not 24. Exactly 2 rows of 4 — do not add a row.
· ONE big painting of the character filling the canvas is the wrong answer
  however well it is painted, and so is a square canvas.
· The panels are TALLER than the creature on purpose. A low, wide creature leaves
  empty magenta above itself in every panel, and that space is NOT room for
  another row: 2 rows of 4, with air above each creature, is the whole
  sheet. A 4-row return cannot be cut — that is what came back last time.

ONE CHARACTER — read this before anything else.
All 8 panels must show the same individual:
identical colours, identical clothing and gear, identical proportions,
identical silhouette, identical markings, identical number of limbs and
horns. Only the POSE changes, and it changes exactly as the reference
shows — same limb positions, same body lean, same head angle.
· ONE colour scheme in every panel. A creature that is grey in one panel and
  brown in another is not one creature animated, it is several creatures side by
  side, and the result is unusable.
· Do not redesign it. Do not add or remove parts between panels.
· Do not turn it to face a different direction in any panel.
· Do not re-scale it: the creature must be the same size in every panel, and the
  same size it is in the reference. Do not move it around inside its panel.
· It faces the viewer in the reference. Keep that direction in all 8 panels.

WHAT IT IS: Gloomcrow — A bone crow, front on, wings out: a large carrion crow with a bare skull for a head, tattered feathers, a lit socket, a stolen gold trinket clutched in its beak.

Colour identity (keep the HUE — this is how the player tells it from the
rest of the cast — but grim, desaturated and low-key, never vivid): feathers near-black with a cold blue sheen, a bone-white skull, ember-red sockets, the trinket tarnished gold — the only bright thing on it.

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

LAYOUT — the grid is a cutting guide, and it is cut blindly.
Each panel is exactly 1/4 of the width and 1/2 of the height.
A creature does NOT fill its panel — it is centred in it, at the size the
reference draws it, with clear magenta all round.
Never let a limb, tail, weapon or shadow cross into a neighbouring panel.
Do not add, drop, merge or reorder panels.
Do NOT draw the panel edges. No boxes, borders, gutters, guides, rules or
numbers — in ANY colour, magenta included. The magenta is the empty space the
creatures sit in, not a grid to draw with: the space BETWEEN two panels is the
same flat background as the space around each creature, and nothing marks the
join. The panels are found by measuring, so a drawn line is not a help, it is
a mark that ends up welded into the sprite.

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

The feet land on the same line in every panel — the same height from the
bottom of the panel as in the reference. If the feet drift up or down
between panels the creature bobs when it walks.
· The reference draws a soft contact shadow under the feet. Keep one, the
  same size in every panel, and keep it tight to the feet.

BEFORE YOU CALL IT FINISHED, count and check:
· 4 panels across, 2 down, 8 in all — and empty magenta
  above every creature, with no extra row squeezed into it.
· The canvas is landscape, 16:9.
· Every panel holds the same creature, at the same size, in the same colours,
  facing the viewer.
· Every pixel that is not the character is flat, vivid #FF00FF — hold it
  against a pure magenta swatch, not against your memory of one.

OUTPUT: one image, 1280 x 720 pixels (16:9, landscape). If your tool has
an aspect-ratio control, set it to 16:9 — a square return crushes the grid
and cannot be cut. No labels, captions, numbers or watermarks.

---

# teal — Survivor (teal)  (images/heroes/teal.webp)

WHAT COMES BACK IS A SPRITE SHEET, NOT A PORTRAIT.
Repaint a RUN CYCLE. The attached sheet is 4 columns x 2 rows
= EXACTLY 8 panels, read left to right along the top row and then the
bottom row. Every panel is the SAME survivor at a different moment of ONE running stride.

· 8 panels. Not 1, not 4, not 12, not 16, not 24. Exactly 2 rows of 4 — do not add a row.
· ONE big painting of the character filling the canvas is the wrong answer
  however well it is painted, and so is a square canvas.
· The panels are TALLER than the survivor on purpose. A low, wide survivor leaves
  empty magenta above itself in every panel, and that space is NOT room for
  another row: 2 rows of 4, with air above each survivor, is the whole
  sheet. A 4-row return cannot be cut — that is what came back last time.

ONE CHARACTER — read this before anything else.
All 8 panels must show the same individual:
identical colours, identical clothing and gear, identical proportions,
identical silhouette, identical markings, identical number of limbs and
horns. Only the POSE changes, and it changes exactly as the reference
shows — same limb positions, same body lean, same head angle.
· ONE colour scheme in every panel. A survivor that is grey in one panel and
  brown in another is not one survivor animated, it is several survivors side by
  side, and the result is unusable.
· Do not redesign it. Do not add or remove parts between panels.
· Do not turn it to face a different direction in any panel.
· Do not re-scale it: the survivor must be the same size in every panel, and the
  same size it is in the reference. Do not move it around inside its panel.
· It faces AWAY from the viewer — it is seen from behind in the reference. Keep that direction in all 8 panels.

READ THE PANELS — it is a RUN, and the legs are the whole animation.
Top row left to right is panels 1 to 4, bottom row 5 to 8. In every panel
the body, pack, hood, arms and gun are IDENTICAL; only the legs change, and
they change exactly as the reference draws them:
· panel 1: left foot planted well forward, that leg straight; the right leg folding up behind, its boot three quarters of the way to the seat.
· panel 2: left foot planted under the hips; the right boot at the TOP of its swing, folded tight, its SOLE turned to the viewer.
· panel 3: left foot planted behind, pushing off; the right leg unfolding, its boot coming down and forward.
· panel 4: FLIGHT — both feet off the ground: the left boot just leaving the road behind, the right boot about to land in front.
· panel 5: right foot planted well forward, that leg straight; the left leg folding up behind, its boot three quarters of the way to the seat.
· panel 6: right foot planted under the hips; the left boot at the TOP of its swing, folded tight, its SOLE turned to the viewer.
· panel 7: right foot planted behind, pushing off; the left leg unfolding, its boot coming down and forward.
· panel 8: FLIGHT — both feet off the ground: the right boot just leaving the road behind, the left boot about to land in front.
· The legs stay UNDER the hips and never splay out sideways into a V, never
  cross, never skate. The stride runs INTO the screen, so a foot goes UP
  (folding behind, sole showing) or DOWN (planted) — not left or right.
· No two panels are the same pose. Panels 1-4 and 5-8 are the two halves of
  one stride with the other leg leading.
· The camera is square behind the back: the pack faces the viewer flat-on,
  both shoulders show equally, and the face never shows. Do not turn the
  figure three-quarters on to show the gun.

WHAT IT IS: Survivor (teal) — A lone survivor seen from DIRECTLY BEHIND, running away from the viewer up the road: a hooded figure in a ragged coat with the hood up, a battered leather pack with a bedroll lashed across the top, a short black-iron hand-cannon held forward in both hands so only the stock and a hint of barrel show above one shoulder, heavy boots. Head down, leaning into the run, the hood's tie-tails streaming behind. The tails are the one part that reads at 16 px — keep them. It RUNS: one leg straight and planted, the other folded up behind with the sole of its boot showing, exactly as each panel of the reference has it.

Colour identity (keep the HUE — this is how the player tells it from the
rest of the cast — but grim, desaturated and low-key, never vivid): a muted teal wool coat, slate trousers, an oiled brown pack, a bone-cream hood — the coat's teal is its identity in the crowd.

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

LAYOUT — the grid is a cutting guide, and it is cut blindly.
Each panel is exactly 1/4 of the width and 1/2 of the height.
A survivor does NOT fill its panel — it is centred in it, at the size the
reference draws it, with clear magenta all round.
Never let a limb, tail, weapon or shadow cross into a neighbouring panel.
Do not add, drop, merge or reorder panels.
Do NOT draw the panel edges. No boxes, borders, gutters, guides, rules or
numbers — in ANY colour, magenta included. The magenta is the empty space the
survivors sit in, not a grid to draw with: the space BETWEEN two panels is the
same flat background as the space around each survivor, and nothing marks the
join. The panels are found by measuring, so a drawn line is not a help, it is
a mark that ends up welded into the sprite.

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

The feet land on the same line in every panel — the same height from the
bottom of the panel as in the reference. If the feet drift up or down
between panels the survivor bobs when it runs.
· The reference draws a soft contact shadow under the feet. Keep one, the
  same size in every panel, and keep it tight to the feet.

BEFORE YOU CALL IT FINISHED, count and check:
· 4 panels across, 2 down, 8 in all — and empty magenta
  above every survivor, with no extra row squeezed into it.
· The canvas is twice as wide as it is tall.
· Every panel holds the same survivor, at the same size, in the same colours,
  facing AWAY from the viewer — it is seen from behind.
· Every pixel that is not the character is flat, vivid #FF00FF — hold it
  against a pure magenta swatch, not against your memory of one.

OUTPUT: one image, 1280 x 640 pixels (2:1, landscape). If your tool has
an aspect-ratio control, set it to 2:1 — a square return crushes the grid
and cannot be cut. No labels, captions, numbers or watermarks.

---

# amber — Survivor (amber)  (images/heroes/amber.webp)

WHAT COMES BACK IS A SPRITE SHEET, NOT A PORTRAIT.
Repaint a RUN CYCLE. The attached sheet is 4 columns x 2 rows
= EXACTLY 8 panels, read left to right along the top row and then the
bottom row. Every panel is the SAME survivor at a different moment of ONE running stride.

· 8 panels. Not 1, not 4, not 12, not 16, not 24. Exactly 2 rows of 4 — do not add a row.
· ONE big painting of the character filling the canvas is the wrong answer
  however well it is painted, and so is a square canvas.
· The panels are TALLER than the survivor on purpose. A low, wide survivor leaves
  empty magenta above itself in every panel, and that space is NOT room for
  another row: 2 rows of 4, with air above each survivor, is the whole
  sheet. A 4-row return cannot be cut — that is what came back last time.

ONE CHARACTER — read this before anything else.
All 8 panels must show the same individual:
identical colours, identical clothing and gear, identical proportions,
identical silhouette, identical markings, identical number of limbs and
horns. Only the POSE changes, and it changes exactly as the reference
shows — same limb positions, same body lean, same head angle.
· ONE colour scheme in every panel. A survivor that is grey in one panel and
  brown in another is not one survivor animated, it is several survivors side by
  side, and the result is unusable.
· Do not redesign it. Do not add or remove parts between panels.
· Do not turn it to face a different direction in any panel.
· Do not re-scale it: the survivor must be the same size in every panel, and the
  same size it is in the reference. Do not move it around inside its panel.
· It faces AWAY from the viewer — it is seen from behind in the reference. Keep that direction in all 8 panels.

READ THE PANELS — it is a RUN, and the legs are the whole animation.
Top row left to right is panels 1 to 4, bottom row 5 to 8. In every panel
the body, pack, hood, arms and gun are IDENTICAL; only the legs change, and
they change exactly as the reference draws them:
· panel 1: left foot planted well forward, that leg straight; the right leg folding up behind, its boot three quarters of the way to the seat.
· panel 2: left foot planted under the hips; the right boot at the TOP of its swing, folded tight, its SOLE turned to the viewer.
· panel 3: left foot planted behind, pushing off; the right leg unfolding, its boot coming down and forward.
· panel 4: FLIGHT — both feet off the ground: the left boot just leaving the road behind, the right boot about to land in front.
· panel 5: right foot planted well forward, that leg straight; the left leg folding up behind, its boot three quarters of the way to the seat.
· panel 6: right foot planted under the hips; the left boot at the TOP of its swing, folded tight, its SOLE turned to the viewer.
· panel 7: right foot planted behind, pushing off; the left leg unfolding, its boot coming down and forward.
· panel 8: FLIGHT — both feet off the ground: the right boot just leaving the road behind, the left boot about to land in front.
· The legs stay UNDER the hips and never splay out sideways into a V, never
  cross, never skate. The stride runs INTO the screen, so a foot goes UP
  (folding behind, sole showing) or DOWN (planted) — not left or right.
· No two panels are the same pose. Panels 1-4 and 5-8 are the two halves of
  one stride with the other leg leading.
· The camera is square behind the back: the pack faces the viewer flat-on,
  both shoulders show equally, and the face never shows. Do not turn the
  figure three-quarters on to show the gun.

WHAT IT IS: Survivor (amber) — A lone survivor seen from DIRECTLY BEHIND, running away from the viewer up the road: a hooded figure in a ragged coat with the hood up, a battered leather pack with a bedroll lashed across the top, a short black-iron hand-cannon held forward in both hands so only the stock and a hint of barrel show above one shoulder, heavy boots. Head down, leaning into the run, the hood's tie-tails streaming behind. The tails are the one part that reads at 16 px — keep them. It RUNS: one leg straight and planted, the other folded up behind with the sole of its boot showing, exactly as each panel of the reference has it.

Colour identity (keep the HUE — this is how the player tells it from the
rest of the cast — but grim, desaturated and low-key, never vivid): a tarnished amber-brown leather coat, charcoal trousers, a dark pack, a grey-linen hood — the amber is its identity in the crowd.

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

LAYOUT — the grid is a cutting guide, and it is cut blindly.
Each panel is exactly 1/4 of the width and 1/2 of the height.
A survivor does NOT fill its panel — it is centred in it, at the size the
reference draws it, with clear magenta all round.
Never let a limb, tail, weapon or shadow cross into a neighbouring panel.
Do not add, drop, merge or reorder panels.
Do NOT draw the panel edges. No boxes, borders, gutters, guides, rules or
numbers — in ANY colour, magenta included. The magenta is the empty space the
survivors sit in, not a grid to draw with: the space BETWEEN two panels is the
same flat background as the space around each survivor, and nothing marks the
join. The panels are found by measuring, so a drawn line is not a help, it is
a mark that ends up welded into the sprite.

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

The feet land on the same line in every panel — the same height from the
bottom of the panel as in the reference. If the feet drift up or down
between panels the survivor bobs when it runs.
· The reference draws a soft contact shadow under the feet. Keep one, the
  same size in every panel, and keep it tight to the feet.

BEFORE YOU CALL IT FINISHED, count and check:
· 4 panels across, 2 down, 8 in all — and empty magenta
  above every survivor, with no extra row squeezed into it.
· The canvas is twice as wide as it is tall.
· Every panel holds the same survivor, at the same size, in the same colours,
  facing AWAY from the viewer — it is seen from behind.
· Every pixel that is not the character is flat, vivid #FF00FF — hold it
  against a pure magenta swatch, not against your memory of one.

OUTPUT: one image, 1280 x 640 pixels (2:1, landscape). If your tool has
an aspect-ratio control, set it to 2:1 — a square return crushes the grid
and cannot be cut. No labels, captions, numbers or watermarks.

---

# violet — Survivor (violet)  (images/heroes/violet.webp)

WHAT COMES BACK IS A SPRITE SHEET, NOT A PORTRAIT.
Repaint a RUN CYCLE. The attached sheet is 4 columns x 2 rows
= EXACTLY 8 panels, read left to right along the top row and then the
bottom row. Every panel is the SAME survivor at a different moment of ONE running stride.

· 8 panels. Not 1, not 4, not 12, not 16, not 24. Exactly 2 rows of 4 — do not add a row.
· ONE big painting of the character filling the canvas is the wrong answer
  however well it is painted, and so is a square canvas.
· The panels are TALLER than the survivor on purpose. A low, wide survivor leaves
  empty magenta above itself in every panel, and that space is NOT room for
  another row: 2 rows of 4, with air above each survivor, is the whole
  sheet. A 4-row return cannot be cut — that is what came back last time.

ONE CHARACTER — read this before anything else.
All 8 panels must show the same individual:
identical colours, identical clothing and gear, identical proportions,
identical silhouette, identical markings, identical number of limbs and
horns. Only the POSE changes, and it changes exactly as the reference
shows — same limb positions, same body lean, same head angle.
· ONE colour scheme in every panel. A survivor that is grey in one panel and
  brown in another is not one survivor animated, it is several survivors side by
  side, and the result is unusable.
· Do not redesign it. Do not add or remove parts between panels.
· Do not turn it to face a different direction in any panel.
· Do not re-scale it: the survivor must be the same size in every panel, and the
  same size it is in the reference. Do not move it around inside its panel.
· It faces AWAY from the viewer — it is seen from behind in the reference. Keep that direction in all 8 panels.

READ THE PANELS — it is a RUN, and the legs are the whole animation.
Top row left to right is panels 1 to 4, bottom row 5 to 8. In every panel
the body, pack, hood, arms and gun are IDENTICAL; only the legs change, and
they change exactly as the reference draws them:
· panel 1: left foot planted well forward, that leg straight; the right leg folding up behind, its boot three quarters of the way to the seat.
· panel 2: left foot planted under the hips; the right boot at the TOP of its swing, folded tight, its SOLE turned to the viewer.
· panel 3: left foot planted behind, pushing off; the right leg unfolding, its boot coming down and forward.
· panel 4: FLIGHT — both feet off the ground: the left boot just leaving the road behind, the right boot about to land in front.
· panel 5: right foot planted well forward, that leg straight; the left leg folding up behind, its boot three quarters of the way to the seat.
· panel 6: right foot planted under the hips; the left boot at the TOP of its swing, folded tight, its SOLE turned to the viewer.
· panel 7: right foot planted behind, pushing off; the left leg unfolding, its boot coming down and forward.
· panel 8: FLIGHT — both feet off the ground: the right boot just leaving the road behind, the left boot about to land in front.
· The legs stay UNDER the hips and never splay out sideways into a V, never
  cross, never skate. The stride runs INTO the screen, so a foot goes UP
  (folding behind, sole showing) or DOWN (planted) — not left or right.
· No two panels are the same pose. Panels 1-4 and 5-8 are the two halves of
  one stride with the other leg leading.
· The camera is square behind the back: the pack faces the viewer flat-on,
  both shoulders show equally, and the face never shows. Do not turn the
  figure three-quarters on to show the gun.

WHAT IT IS: Survivor (violet) — A lone survivor seen from DIRECTLY BEHIND, running away from the viewer up the road: a hooded figure in a ragged coat with the hood up, a battered leather pack with a bedroll lashed across the top, a short black-iron hand-cannon held forward in both hands so only the stock and a hint of barrel show above one shoulder, heavy boots. Head down, leaning into the run, the hood's tie-tails streaming behind. The tails are the one part that reads at 16 px — keep them. It RUNS: one leg straight and planted, the other folded up behind with the sole of its boot showing, exactly as each panel of the reference has it.

Colour identity (keep the HUE — this is how the player tells it from the
rest of the cast — but grim, desaturated and low-key, never vivid): a dusk-violet cloak-coat, slate trousers, a brown pack, a pale blue-grey hood — the violet is its identity in the crowd.

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

LAYOUT — the grid is a cutting guide, and it is cut blindly.
Each panel is exactly 1/4 of the width and 1/2 of the height.
A survivor does NOT fill its panel — it is centred in it, at the size the
reference draws it, with clear magenta all round.
Never let a limb, tail, weapon or shadow cross into a neighbouring panel.
Do not add, drop, merge or reorder panels.
Do NOT draw the panel edges. No boxes, borders, gutters, guides, rules or
numbers — in ANY colour, magenta included. The magenta is the empty space the
survivors sit in, not a grid to draw with: the space BETWEEN two panels is the
same flat background as the space around each survivor, and nothing marks the
join. The panels are found by measuring, so a drawn line is not a help, it is
a mark that ends up welded into the sprite.

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

The feet land on the same line in every panel — the same height from the
bottom of the panel as in the reference. If the feet drift up or down
between panels the survivor bobs when it runs.
· The reference draws a soft contact shadow under the feet. Keep one, the
  same size in every panel, and keep it tight to the feet.

BEFORE YOU CALL IT FINISHED, count and check:
· 4 panels across, 2 down, 8 in all — and empty magenta
  above every survivor, with no extra row squeezed into it.
· The canvas is twice as wide as it is tall.
· Every panel holds the same survivor, at the same size, in the same colours,
  facing AWAY from the viewer — it is seen from behind.
· Every pixel that is not the character is flat, vivid #FF00FF — hold it
  against a pure magenta swatch, not against your memory of one.

OUTPUT: one image, 1280 x 640 pixels (2:1, landscape). If your tool has
an aspect-ratio control, set it to 2:1 — a square return crushes the grid
and cannot be cut. No labels, captions, numbers or watermarks.
