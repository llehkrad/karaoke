# MelodyHub design system — rules for Claude Code

Apply these to any UI in this project. Tokens live in `tokens.css` (CSS vars) and
`tailwind.tokens.js`. Full spec: `README.md`. Visual reference:
`MelodyHub Design Breakdown.dc.html`.

## Non-negotiables
- **One accent.** `#6B66DE` is the only interactive colour: primary buttons, links, checked
  states, active indicators. Never introduce a second brand hue.
- **Two-neutral shell.** Dark navigation (`#181C27`) and player (`#1D2031`) against a near-white
  workspace (`#FBFCFE`). Content cards are pure white.
- **Category colour is decorative only.** The violet/sky/blush/mint tile colours appear solely as
  an icon glyph on a ~8% tint of themselves. Never as a button, badge or text colour.
- **Depth by contrast, not elevation.** Resting cards get a `1px #EEF0F5` hairline and no shadow.
  Shadow appears only on hover (`0 4px 16px rgba(24,28,39,0.06)`).
- **One type family** at 400/500/700. Emphasis is italic and/or accent colour — never a second
  family. The handwriting face is used at most once per screen, only over photography.
- **Radius ladder:** 8 icon squares/thumbs → 12 cards/nav/tiles → 16 hero and dark panels →
  999 buttons, chips, avatars, sliders. Nothing else.
- **8px spacing:** 24px card padding, 16px gutters, 32–40px between sections.
- **Status is a translucent dark pill** (`rgba(24,28,39,0.72)`) over the thumbnail — not a
  coloured badge, not a status dot.
- **Photography is low-key and scrimmed** so white type clears 4.5:1. Never place type on an
  unscrimmed photo.
- **Icons:** thin-stroke line set, ~1.5px, 20px in nav, 24px inside tiles. Lucide/Phosphor Light.

## Never
- Left-border accent stripes on active nav items (use the filled `#2F2D45` block).
- Gradient backgrounds on UI surfaces (gradients exist only as photo scrims).
- Emoji, exclamation marks, or more than one primary button per screen.
- Drop shadows on resting elements, or a third neutral temperature.

## Copy
Warm three-beat fragments ("Ideas. People. Progress."). Card = plain noun title + one
encouraging helper line in `#6E7482`.
