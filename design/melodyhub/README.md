# Handoff: MelodyHub Design System

## Overview
A design system extracted from a MelodyHub dashboard screenshot: a three-zone dark-rail
music-collaboration workspace. This bundle documents its colour, type, geometry and component
rules so they can be reimplemented in a real codebase.

## About the Design Files
The files in this bundle are **design references created in HTML** — a prototype/spec page showing
the intended look, not production code to copy. The task is to **recreate these rules in the target
codebase's existing environment** (React, Vue, SwiftUI, native, etc.) using its established patterns
and libraries. If no environment exists yet, pick the most appropriate framework and implement there.

## Fidelity
**High-fidelity.** All colours are pixel-sampled from the source screenshot; type sizes, radii and
spacing are measured. Recreate faithfully.

## How to use this in Claude Code
1. Unzip this folder into your repo (e.g. `design/melodyhub/`).
2. Copy `CLAUDE.md` contents into your repo's root `CLAUDE.md` (or import it with
   `@design/melodyhub/CLAUDE.md`) so every Claude Code session picks up the rules automatically.
3. Drop `tokens.css` into your global stylesheet, or `tailwind.tokens.js` into your Tailwind config.
4. Ask Claude Code, e.g.:
   > Read design/melodyhub/README.md and CLAUDE.md. Build the Quick Actions section as a React
   > component using our existing Card primitive and the tokens in tokens.css.
5. Open `MelodyHub Design Breakdown.dc.html` in a browser for the visual reference.

## Screens / Views

### Dashboard — Home
**Purpose:** landing surface; user scans today's schedule, jumps into a project, or starts a new one.

**Layout** — three fixed/fluid zones plus a pinned player:
- Left rail: fixed `240px`, full height, `#181C27`.
- Work column: fluid, `padding: 20px 24px`, gutters `16px`.
- Context column: fixed `~380px`, stack of cards with `16px` gaps.
- Player bar: full width, pinned bottom, height `~96px`, `#1D2031`.
- Section vertical rhythm: `32–40px`.

**Components**
1. **Brand lockup** — 4-bar violet equaliser mark + `MelodyHub` (700, 22px) + tagline
   `Ideas. People. Progress.` (400, 12px, `#8B92A6`).
2. **Nav item** — `padding: 12px 16px`, `radius 12px`, icon 20px + label 15px.
   Rest: label `#A8AEBE`, icon `#6C7386`. Active: background `#2F2D45`, icon + label `#FFFFFF`, weight 500.
   No left-border accent. Section label `PLAYLISTS` at 11px, +18% tracking, `#6C7386`, with a `+` affordance right.
3. **Search field** — full-width pill, `radius 999px`, background `#EFEFF9`, `padding 14px 20px`,
   leading 18px magnifier `#8A90A0`, placeholder 15px `#8A90A0`.
4. **Hero panel** — `radius 16px`, background `#040A18` + right-anchored photo with a
   left-to-right dark scrim. Eyebrow row `CREATE · COLLABORATE · AMPLIFY` (12px, +18% tracking,
   `#8E86C9`), display headline 54px/1.05, -3% tracking, 700, white, with the final word in
   **italic** `#8E86C9→#B9A9EE` gradient tone. Subline 16px `#C9CEDC`. Primary CTA pill.
   Handwritten script line `Good Ideas Play On` bottom-right over the photo, ~28px, white,
   closed by a short 40px underscore rule.
5. **Primary button** — `background #6B66DE`, white 15px/500 label, `padding 14px 24px`,
   `radius 999px`, trailing `→`. Hover: darken to `#5A55CE`. One per screen.
6. **Quick action tile** — white card, `radius 12px`, `1px #EEF0F5` border, `padding 20px`.
   Contains a 56px `radius 12px` tinted square holding a 24px line icon, then title (16px/500)
   and helper line (14px `#6E7482`). Four colourways: violet `#9F8CE4` on `#F4F1FD`,
   sky `#89B8EB` on `#EAF3FD`, blush `#F9B8DD` on `#FDEEF7`, mint `#7CD4AC` on `#EAF9F2`.
7. **Project card** — white card, `radius 12px`. 16:9 photo top with a translucent dark status
   chip (`rgba(24,28,39,0.72)`, `radius 999px`, `padding 7px 15px`, 13px/500 white) floated
   top-right. Body: title 16px/500, description 14px `#6E7482`, footer row of overlapping 28px
   circular avatars (`+N` counter) left and `Due 12 Sep 2026` (13px `#8A90A0`) right.
8. **Task row** — 22px circular checkbox (`1.5px #D3D7E2` unchecked; `#6B66DE` fill + white
   check when done), label 15px, right-aligned time range 14px `#8A90A0`, `1px #EEF0F5` divider.
9. **Quote panel** — `radius 16px`, dark mountain photo, equaliser mark top-left, pull-quote in
   20px/1.25 white with curly quotes, underscore rule beneath, 52px circular `#6B66DE` play button
   bottom-right.
10. **Vibes grid** — 4 × 3:4 photo thumbs, `radius 8px`, `gap 8px`, caption 12px `#6E7482` below.
11. **Recommended row** — 44px `radius 8px` art, title 14px/500, artist 12px `#8A90A0`,
    trailing 20px `⊕` add button `#B4B9C6`.
12. **Player bar** — 48px album art + track title 15px white / artist 13px `#8A90A0`, heart
    toggle; centred transport (shuffle, prev, 44px white circular play, next, repeat);
    elapsed/total 13px `#8A90A0` flanking a 4px `radius 999px` progress track
    (`#383D50` rail, `#BABCD5` fill); volume slider and queue icon right.
13. **Section header** — title 24px/700 with an optional `View all →` link right, 14px `#6B66DE`.

## Interactions & Behavior
- Nav: click sets active item (rail background + white ink); route-driven.
- Task checkbox: click toggles; checked shows violet fill and strikes nothing (label stays full ink).
- Cards: hover raises border to `#DDE0EA` and shadow to `0 4px 16px rgba(24,28,39,0.06)`,
  `transition: 160ms ease-out`.
- Buttons/links: `120ms ease` colour transition; focus ring `2px #6B66DE` at `2px` offset.
- Play buttons: scale `1.04` on hover; icon swaps to pause when playing.
- Progress + volume: draggable; fill width bound to position.
- Responsive: context column drops below the work column under ~1200px; rail collapses to a
  72px icon-only strip under ~900px; quick actions go 4 → 2 → 1 columns.
- Loading: skeleton blocks in `#EFEFF9` at the card's own radius. Empty states: centred muted
  line plus the primary pill.

## State Management
- `activeNavItem` (string) — set by router.
- `tasks: [{id, title, start, end, done}]` — `done` toggled by checkbox.
- `projects: [{id, title, description, status, thumb, members[], dueDate}]`.
- `player: {trackId, isPlaying, positionMs, durationMs, volume, shuffle, repeatMode}` —
  persist `positionMs` and `volume`.
- `searchQuery` (debounced ~200ms), `recommendations[]`, `vibes[]` — fetched on mount.

## Design Tokens
See `tokens.css` and `tailwind.tokens.js` for machine-readable versions.

Colour
- Rail ink `#181C27` · Stage black `#040A18` · Player bar `#1D2031` · Quote panel `#262E45`
- Nav active `#2F2D45` · Canvas `#FBFCFE` · Surface `#FFFFFF` · Field/chip `#EFEFF9`
- Hairline `#EEF0F5` · Border `#E4E7EF`
- Accent `#6B66DE` (hover `#5A55CE`) · on-dark accent `#8E86C9`
- Text: primary `#181C27`, secondary `#5A6070`, muted `#8A90A0`; on dark: `#FFFFFF`,
  `#C9CEDC`, `#8B92A6`
- Tiles: violet `#9F8CE4`/`#F4F1FD`, sky `#89B8EB`/`#EAF3FD`, blush `#F9B8DD`/`#FDEEF7`,
  mint `#7CD4AC`/`#EAF9F2`

Spacing — 8px base: 4, 8, 12, 16 (gutter), 20, 24 (card padding), 32, 40 (section gap).

Typography — one geometric humanist sans at 400 / 500 / 700 (DM Sans, Poppins or Plus Jakarta
Sans are all faithful substitutes), plus one handwriting face used exactly once over imagery
(Caveat).
- Display 54px / 1.05 / 700 / -3% — italic + accent colour for emphasis
- Section title 24px / 1.2 / 700 / -2%
- Card title 16px / 1.3 / 500
- Body 14px / 1.5 / 400 / `#6E7482`
- Meta 13px / 1.4 / 400 / `#8A90A0`
- Eyebrow 12px / 500 / +18% tracking / uppercase
- Script accent ~28px, imagery only

Radius — 8 (icon squares, thumbs) · 12 (cards, nav items, tiles) · 16 (hero, dark panels) ·
999 (buttons, chips, avatars, sliders).

Shadow — depth comes from contrast, not elevation. Resting cards: `1px` hairline only.
Hover: `0 4px 16px rgba(24,28,39,0.06)`.

## Assets
- Photography: low-key, night-lit music scenes with violet/magenta bokeh (stage guitar, vinyl,
  studio desk, microphone, mountains at dusk). Not included — source licensed equivalents and
  keep them dark enough that white type clears 4.5:1.
- Icons: thin-stroke line set at ~1.5px (Lucide or Phosphor Light match the source closely).
- Logo mark: 4-bar violet equaliser, bars of unequal height, `radius 999px` caps.
- Avatars: circular photo, 28px in card footers, 36px in the top bar.

## Copy voice
Warm three-beat fragments (`Ideas. People. Progress.`). Every card pairs a plain noun title with
one encouraging helper line. Never exclamation marks, never emoji.

## Files
- `MelodyHub Design Breakdown.dc.html` — the visual spec page (open in a browser)
- `tokens.css` — CSS custom properties
- `tailwind.tokens.js` — Tailwind theme extension
- `CLAUDE.md` — drop-in rules file for Claude Code
