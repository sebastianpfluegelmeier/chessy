// Terrain Chess — game state & rules of play.
import { GameState, Player, Coord, WHITE, BLACK, other, BOARD_SIZE, DRAW_LIMIT } from './constants.js';
import { generate, GenOptions } from './board.js';
import { legalMovesForSide, legalMoves } from './rules.js';

const N = BOARD_SIZE;

// Prototype starting layout (design doc): full home row + the two near-corners
// = 8 identical pieces per side, symmetrical.
//   BBBBBB / B....B / ...... / ...... / W....W / WWWWWW
export function initialPieces(): (Player | null)[][] {
  const p: (Player | null)[][] = [];
  for (let r = 0; r < N; r++) p.push(new Array(N).fill(null));
  for (let c = 0; c < N; c++) { p[0][c] = BLACK; p[N - 1][c] = WHITE; }
  p[1][0] = BLACK; p[1][N - 1] = BLACK;
  p[N - 2][0] = WHITE; p[N - 2][N - 1] = WHITE;
  return p;
}

export function countPieces(state: GameState, side: Player): number {
  let n = 0;
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (state.pieces[r][c] === side) n++;
  return n;
}

export function newGame(opts: GenOptions = {}): GameState {
  const board = generate(opts);
  return {
    size: N,
    terrain: board.terrain,
    stats: board.stats,
    pieces: initialPieces(),
    turn: WHITE, // White moves first
    winner: null,
    reason: '',
    lastMove: null,
    moveCount: 0,
    movesSinceCapture: 0,
    drawLimit: DRAW_LIMIT
  };
}

export function isLegal(state: GameState, from: Coord, to: Coord): boolean {
  for (const m of legalMoves(state, from.r, from.c)) {
    if (m.r === to.r && m.c === to.c) return true;
  }
  return false;
}

// Apply a move (assumed legal) and resolve end-of-game conditions.
export function applyMove(state: GameState, from: Coord, to: Coord): GameState {
  const side = state.pieces[from.r][from.c];
  if (!side) return state;
  const captured = state.pieces[to.r][to.c] !== null;

  state.pieces[to.r][to.c] = side;
  state.pieces[from.r][from.c] = null;
  state.lastMove = { from: { r: from.r, c: from.c }, to: { r: to.r, c: to.c }, capture: captured };
  state.moveCount++;
  state.movesSinceCapture = captured ? 0 : state.movesSinceCapture + 1;

  const opp = other(side);

  // Win: opponent has no pieces left.
  if (countPieces(state, opp) === 0) {
    state.winner = side;
    state.reason = 'captured all enemy pieces';
    state.turn = side;
    return state;
  }

  state.turn = opp;

  // Stalemate: opponent still has pieces but no legal move -> draw.
  if (legalMovesForSide(state, opp).length === 0) {
    state.winner = 'draw';
    state.reason = 'stalemate — ' + (opp === WHITE ? 'White' : 'Black') + ' has no legal move';
    return state;
  }

  // Progress draw: too many plies without a capture.
  if (state.movesSinceCapture >= state.drawLimit) {
    state.winner = 'draw';
    state.reason = 'no capture in ' + state.drawLimit + ' plies';
  }
  return state;
}
