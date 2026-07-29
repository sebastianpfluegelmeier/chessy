# Terrain Chess (working title)

A chess-inspired strategy prototype where **all pieces are identical** and have
no intrinsic movement. A piece moves according to the **terrain tile it is
currently standing on** — so the board itself is the strategic resource.

> Standing on a Knight tile → you move like a knight this turn.
> Land on a Queen tile → next turn you move like a queen.

That one-turn delay between *where you land* and *how you'll move* is the core
mechanic.

## Run it

No build step, no dependencies. Just open the page:

```
# simplest: open index.html in a browser
xdg-open index.html      # Linux
open index.html          # macOS

# or serve it (any static server works)
python3 -m http.server 8000   # then visit http://localhost:8000
```

## Rules (prototype)

- **Board:** 6×6, every square has a terrain type (King/Queen/Rook/Bishop/
  Knight/Pawn). Terrain grants the matching chess movement.
- **Pieces:** two teams, 8 identical pieces each, no inherent movement.
- **Movement:** always by the terrain you're standing on. Normal chess blocking
  and capturing; knights jump; pawns move one forward / capture one diagonally
  forward (no double move, promotion, or en passant). White moves ↑, Black ↓.
- **Win:** capture *all* enemy pieces. No king, no check, no checkmate.
- **Draw:** a side with pieces but no legal move (stalemate), or 120 plies with
  no capture.

## Controls

- **Click your piece** → shows legal moves (green), captures (red rings), and
  movement **rays** for sliding terrain.
- **Click any square** → *inspect* that terrain's movement pattern (ignores
  occupancy) — useful for learning the generated board.
- **Right-click / `Esc`** → clear selection.
- **Setup panel:** set each side to Human or AI (AI-vs-AI is watchable), AI
  speed, symmetric terrain on/off, and a **seed** (type one + Enter to load a
  specific board; "New board" makes a fresh random one).

## How it's built

Dependency-free vanilla JS + HTML canvas. Modules hang off a `window.TC`
namespace and load as plain `<script>` tags (works from `file://`).

| File | Responsibility |
|------|----------------|
| `src/constants.js` | terrain types, glyphs, colors, weights, values |
| `src/rules.js` | terrain-based movement + ray/visualization computation |
| `src/board.js` | seeded weighted generation + movement-graph validation |
| `src/game.js` | state, move application, win/draw conditions |
| `src/ai.js` | heuristic AI (no search) |
| `src/render.js` | canvas rendering |
| `src/main.js` | input, inspect/play modes, AI scheduling, UI |

### Board generator

Weighted-random terrain (pawn most common … queen very rare), optionally
**180°-symmetric** for balance. Each candidate is turned into a **movement
graph** (node per square, directed edge per legal one-step reach) and accepted
only if the graph is **strongly connected** — i.e. every tile is reachable and
nothing is stranded. Boards are reproducible by seed. This is a first step
toward the design doc's "desired generator"; it typically validates in 1–2
tries. The stats line under the board shows seed, connectivity, and average
mobility.

### AI

Pure heuristic, no lookahead: each legal move is scored independently —
capture `+100`, destination terrain value (Q30/R20/B16/N14/K10/P4), a small
center preference, a small onward-mobility term, and a little randomness — and
the best is played.

## Prototype status & findings

Implemented: playable board, full move visualization (rays, inspect mode,
play-mode highlights), validated seeded generator, weighted terrain
distribution, and the heuristic AI.

From 500 self-play (AI-vs-AI) games on symmetric boards:

- Roughly balanced: ~53% White / ~47% Black among decisive games.
- ~55% decisive, ~45% draws — and notably **~35% end in stalemate** (a side is
  immobilized). Pawn terrain being both common and restrictive is the main
  driver.
- Games average ~40 plies; board validation needs 1–2 attempts.

The high stalemate rate is a live balance question: the design philosophy talks
about "trapping opponents on weak terrain," so immobilization could arguably be
a **win** for the trapper rather than a draw. Currently it's scored as a draw
(the neutral default) — easy to flip. Tuning terrain weights, board size, and
this stalemate rule are natural next steps (design doc priorities #5–6).
