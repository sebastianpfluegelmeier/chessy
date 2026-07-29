// Terrain Chess — movement rules.
// A piece moves by the terrain it is CURRENTLY standing on, not the
// destination. The destination's terrain only matters next turn.
import {
  Terrain, Player, Move, Ray, MoveViz, FullMove, GameState,
  WHITE, other, BOARD_SIZE
} from './constants.js';

const N = BOARD_SIZE;

type Occ = (r: number, c: number) => Player | null;
type Mode = 'play' | 'inspect';
type Dir = [number, number];

const DIR_ORTHO: Dir[] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const DIR_DIAG: Dir[] = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const DIR8: Dir[] = DIR_ORTHO.concat(DIR_DIAG);
const KNIGHT_OFF: Dir[] = [
  [-2, -1], [-2, 1], [-1, -2], [-1, 2],
  [1, -2], [1, 2], [2, -1], [2, 1]
];

export function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < N && c >= 0 && c < N;
}

// Core move generator.
//  mode 'play'    -> real captures/blocking (occ reflects the board).
//  mode 'inspect' -> occupancy ignored (occ returns null); pawns additionally
//                    expose their diagonal capture squares as markers.
export function computeMoves(
  occ: Occ, terrain: Terrain, r: number, c: number, owner: Player, mode: Mode
): MoveViz {
  const moves: Move[] = [];
  const rays: Ray[] = [];

  const add = (nr: number, nc: number, capture: boolean) => moves.push({ r: nr, c: nc, capture });

  const slide = (dirs: Dir[]) => {
    for (const [dr, dc] of dirs) {
      let far: { r: number; c: number } | null = null;
      for (let k = 1; ; k++) {
        const nr = r + dr * k, nc = c + dc * k;
        if (!inBounds(nr, nc)) break;
        const o = occ(nr, nc);
        if (o === null) { add(nr, nc, false); far = { r: nr, c: nc }; continue; }
        if (o === owner) break;                 // friendly blocks
        add(nr, nc, true); far = { r: nr, c: nc }; break; // capture enemy, then stop
      }
      if (far) rays.push({ from: { r, c }, to: far });
    }
  };

  const step = (dirs: Dir[]) => {
    for (const [dr, dc] of dirs) {
      const nr = r + dr, nc = c + dc;
      if (!inBounds(nr, nc)) continue;
      const o = occ(nr, nc);
      if (o === owner) continue;
      add(nr, nc, o !== null);
    }
  };

  switch (terrain) {
    case 'Q': slide(DIR8); break;
    case 'R': slide(DIR_ORTHO); break;
    case 'B': slide(DIR_DIAG); break;
    case 'K': step(DIR8); break;
    case 'N':
      for (const [dr, dc] of KNIGHT_OFF) {
        const nr = r + dr, nc = c + dc;
        if (!inBounds(nr, nc)) continue;
        const o = occ(nr, nc);
        if (o === owner) continue;
        add(nr, nc, o !== null);
      }
      break;
    case 'P': {
      const dir = owner === WHITE ? -1 : 1; // White ↑ (rows decrease), Black ↓
      const fr = r + dir;
      if (inBounds(fr, c) && (mode === 'inspect' || occ(fr, c) === null)) add(fr, c, false);
      for (const nc of [c - 1, c + 1]) {
        if (!inBounds(fr, nc)) continue;
        if (mode === 'inspect') { add(fr, nc, true); continue; }
        const o = occ(fr, nc);
        if (o !== null && o !== owner) add(fr, nc, true);
      }
      break;
    }
  }
  return { moves, rays };
}

// Real legal moves for the piece at (r,c).
export function legalMoves(state: GameState, r: number, c: number): Move[] {
  const owner = state.pieces[r][c];
  if (!owner) return [];
  const occ: Occ = (rr, cc) => state.pieces[rr][cc];
  return computeMoves(occ, state.terrain[r][c], r, c, owner, 'play').moves;
}

// Visualization payload for a selection (play) or an inspection.
export function visualize(
  state: GameState, r: number, c: number,
  opts: { ignoreOccupancy?: boolean; owner?: Player } = {}
): MoveViz {
  const ignore = !!opts.ignoreOccupancy;
  const owner: Player = opts.owner || state.pieces[r][c] || WHITE;
  const occ: Occ = ignore ? () => null : (rr, cc) => state.pieces[rr][cc];
  return computeMoves(occ, state.terrain[r][c], r, c, owner, ignore ? 'inspect' : 'play');
}

// Every from/to legal move for a whole side.
export function legalMovesForSide(state: GameState, side: Player): FullMove[] {
  const out: FullMove[] = [];
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (state.pieces[r][c] !== side) continue;
      for (const m of legalMoves(state, r, c)) {
        out.push({ from: { r, c }, to: { r: m.r, c: m.c }, capture: m.capture });
      }
    }
  }
  return out;
}

// Onward mobility from a tile on an empty board (AI mobility term).
export function mobilityAt(state: GameState, r: number, c: number, owner: Player): number {
  const occ: Occ = () => null;
  return computeMoves(occ, state.terrain[r][c], r, c, owner, 'inspect').moves.length;
}

// Directed reachability from a tile on an empty board — edges of the movement
// graph used by the generator. Pawn tiles contribute edges for both colours.
export function terrainReach(grid: Terrain[][], r: number, c: number): Move[] {
  const occ: Occ = () => null;
  const terrain = grid[r][c];
  if (terrain === 'P') {
    const seen = new Set<string>();
    const merged: Move[] = [];
    for (const p of [WHITE, other(WHITE)]) {
      for (const m of computeMoves(occ, terrain, r, c, p, 'inspect').moves) {
        const key = m.r + ',' + m.c;
        if (!seen.has(key)) { seen.add(key); merged.push(m); }
      }
    }
    return merged;
  }
  return computeMoves(occ, terrain, r, c, WHITE, 'inspect').moves;
}
