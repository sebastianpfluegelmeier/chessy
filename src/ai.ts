// Terrain Chess — heuristic AI.
// No search, no minimax, no future planning: every legal move is scored
// independently and the best is played (design doc "Artificial Intelligence").
import { GameState, Player, FullMove, TERRAIN_VALUE, BOARD_SIZE } from './constants.js';
import { legalMovesForSide, mobilityAt } from './rules.js';

const center = (BOARD_SIZE - 1) / 2; // 2.5 on a 6x6 board

export function scoreMove(state: GameState, mv: FullMove, side: Player): number {
  const { to } = mv;
  const destTerrain = state.terrain[to.r][to.c];
  let score = 0;

  // Capturing an enemy piece dominates everything.
  if (mv.capture) score += 100;

  // Landing on strong terrain prepares a strong move next turn.
  score += TERRAIN_VALUE[destTerrain];

  // Prefer the center (Chebyshev distance; center cells ~+4, edges ~0).
  const dist = Math.max(Math.abs(to.r - center), Math.abs(to.c - center));
  score += (center - dist) * 2;

  // Small mobility term: gently favour landing where you'll have options
  // (helps avoid dead-end terrain).
  score += 0.3 * mobilityAt(state, to.r, to.c, side);

  // Small random variation so play isn't deterministic.
  score += Math.random() * 3;

  return score;
}

export function chooseMove(state: GameState, side: Player): FullMove | null {
  const moves = legalMovesForSide(state, side);
  if (moves.length === 0) return null;

  let best: FullMove | null = null;
  let bestScore = -Infinity;
  for (const mv of moves) {
    const s = scoreMove(state, mv, side);
    if (s > bestScore) { bestScore = s; best = mv; }
  }
  if (best) best.score = bestScore;
  return best;
}
