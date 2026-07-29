# Terrain Chess (working title)

A chess-inspired strategy prototype where **all pieces are identical** and have
no intrinsic movement. A piece moves according to the **terrain tile it is
currently standing on** — so the board itself is the strategic resource.

> Standing on a Knight tile → you move like a knight this turn.
> Land on a Queen tile → next turn you move like a queen.

That one-turn delay between *where you land* and *how you'll move* is the core
mechanic.

Written in **TypeScript** with **no runtime dependencies** (just `tsc` to build)
and rendered on a plain HTML canvas.

## Play

- **Modes:** *1 Player* (you vs the heuristic AI — pick your colour) and
  *2 Players* (hotseat: both players share this browser).
- **Click your piece** → shows legal moves (green), captures (red rings), and
  movement **rays** for sliding terrain.
- **Click any square** → *inspect* that terrain's movement pattern (ignores
  occupancy) — useful for learning the generated board.
- **Right-click / `Esc`** → clear selection.
- **Board panel:** symmetric terrain on/off and a **seed** (type one + Enter to
  load a specific board; "New board" makes a fresh random one).

## Build & run

Requires Node (for the TypeScript compiler only).

```bash
npm install       # installs typescript (dev dependency)
npm run build     # compiles src/*.ts -> dist/*.js (ES modules)
npm run serve     # serves at http://localhost:8000  (ES modules need http, not file://)
# or in one step:
npm run dev
```

Then open <http://localhost:8000>. `npm run watch` recompiles on save.

## Deploy (GitHub Pages)

A workflow (`.github/workflows/deploy.yml`) builds the TypeScript and publishes
the site on every push. **One-time setup:** in the repo, go to
**Settings → Pages → Build and deployment → Source = "GitHub Actions"**. After
that the site deploys automatically to
`https://<user>.github.io/chessy/`. Build output (`dist/`) is generated in CI
and not committed.

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

## Architecture

Each `src/*.ts` module compiles to an ES module and loads via `<script type="module">`.

| File | Responsibility |
|------|----------------|
| `src/constants.ts` | types, terrain glyphs/colors/weights/values |
| `src/rules.ts` | terrain-based movement + ray/visualization computation |
| `src/board.ts` | seeded weighted generation + movement-graph validation |
| `src/game.ts` | state, move application, win/draw conditions |
| `src/ai.ts` | heuristic AI (no search) |
| `src/render.ts` | canvas rendering |
| `src/main.ts` | input, modes, AI scheduling, UI |

### Board generator

Weighted-random terrain (pawn most common … queen very rare), optionally
**180°-symmetric** for balance. Each candidate becomes a **movement graph**
(node per square, directed edge per legal one-step reach) and is accepted only
if the graph is **strongly connected** — every tile reachable, nothing
stranded. Boards are reproducible by seed and typically validate in 1–2 tries.

### AI

Pure heuristic, no lookahead: each legal move is scored independently — capture
`+100`, destination terrain value (Q30/R20/B16/N14/K10/P4), a small center
preference, a small onward-mobility term, and a little randomness — best wins.

## Prototype status & findings

Implemented: playable board, 1P/2P modes, full move visualization (rays,
inspect mode, play-mode highlights), a validated seeded generator, weighted
terrain distribution, and the heuristic AI.

From self-play (AI-vs-AI) on symmetric boards: roughly balanced sides, games
average ~40 plies, and **~40–45% end in draws — notably ~35% by stalemate** (a
side gets immobilized). Pawn terrain being both common and restrictive is the
main driver. The design philosophy mentions "trapping opponents on weak
terrain," so immobilization could arguably be a **win** for the trapper rather
than a draw — currently it's the neutral default (a draw) and easy to flip.
Tuning terrain weights, board size, and this stalemate rule are natural next
steps.
