// Terrain Chess — shared types & constants.

export type Terrain = 'K' | 'Q' | 'R' | 'B' | 'N' | 'P';
export type Player = 'w' | 'b';
export type Winner = Player | 'draw' | null;

export interface Coord { r: number; c: number; }
export interface Move { r: number; c: number; capture: boolean; }
export interface Ray { from: Coord; to: Coord; }
export interface MoveViz { moves: Move[]; rays: Ray[]; }
export interface FullMove { from: Coord; to: Coord; capture: boolean; score?: number; }

export interface BoardStats {
  seed: number;
  usedSeed: number;
  attempts: number;
  symmetric: boolean;
  stronglyConnected: boolean;
  avgOutDegree: number;
  counts: Record<Terrain, number>;
}

export interface GameState {
  size: number;
  terrain: Terrain[][];
  stats: BoardStats;
  pieces: (Player | null)[][];
  turn: Player;
  winner: Winner;
  reason: string;
  lastMove: { from: Coord; to: Coord; capture: boolean } | null;
  moveCount: number;
  movesSinceCapture: number;
  drawLimit: number;
}

export const TERRAINS: Terrain[] = ['K', 'Q', 'R', 'B', 'N', 'P'];

// Chess symbols LABEL the terrain (never reused for the pieces themselves).
export const GLYPH: Record<Terrain, string> = { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙' };
export const TERRAIN_NAME: Record<Terrain, string> = {
  K: 'King', Q: 'Queen', R: 'Rook', B: 'Bishop', N: 'Knight', P: 'Pawn'
};

// Strategic value of standing on a tile (drives AI scoring + stats).
export const TERRAIN_VALUE: Record<Terrain, number> = { Q: 30, R: 20, B: 16, N: 14, K: 10, P: 4 };

// Generation weights: pawn most common … queen very rare (design doc).
export const TERRAIN_WEIGHT: Record<Terrain, number> = { P: 34, K: 22, N: 16, B: 14, R: 9, Q: 5 };

// Pale tile tints so glyphs and pieces stay readable on top.
export const TERRAIN_COLOR: Record<Terrain, string> = {
  K: '#f4cfa0', Q: '#eab6ea', R: '#aec6f0', B: '#aee2ba', N: '#aadfe0', P: '#dcdce0'
};

export const TERRAIN_HINT: Record<Terrain, string> = {
  K: 'one step in any direction',
  Q: 'slides in all 8 directions',
  R: 'slides orthogonally',
  B: 'slides diagonally',
  N: 'knight jumps (ignores blocking)',
  P: 'forward one; captures diagonally forward'
};

export const WHITE: Player = 'w';
export const BLACK: Player = 'b';
export const other = (p: Player): Player => (p === 'w' ? 'b' : 'w');

export const BOARD_SIZE = 6;

// Draw if this many plies pass with no capture (stops endless AI shuffling).
export const DRAW_LIMIT = 120;
