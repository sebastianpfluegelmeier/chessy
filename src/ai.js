// Terrain Chess — heuristic AI.
// No search, no minimax, no future planning: every legal move is scored
// independently and the best is played (design doc "Artificial Intelligence").
window.TC = window.TC || {};
(function (TC) {
  'use strict';

  var N = TC.BOARD_SIZE;
  var center = (N - 1) / 2; // 2.5 on a 6x6 board

  function scoreMove(state, mv, side) {
    var to = mv.to;
    var destTerrain = state.terrain[to.r][to.c];

    var score = 0;

    // Capturing an enemy piece dominates everything.
    if (mv.capture) score += 100;

    // Landing on strong terrain prepares a strong move next turn.
    score += TC.TERRAIN_VALUE[destTerrain];

    // Prefer the center (Chebyshev distance; center cells ~+4, edges ~0).
    var dist = Math.max(Math.abs(to.r - center), Math.abs(to.c - center));
    score += (center - dist) * 2;

    // Small mobility term: gently favour landing where you'll have options
    // (helps "avoid obviously poor terrain" / dead ends).
    score += 0.3 * TC.rules.mobilityAt(state, to.r, to.c, side);

    // Small random variation so play isn't deterministic.
    score += Math.random() * 3;

    return score;
  }

  function chooseMove(state, side) {
    var moves = TC.rules.legalMovesForSide(state, side);
    if (moves.length === 0) return null;

    var best = null, bestScore = -Infinity;
    for (var i = 0; i < moves.length; i++) {
      var s = scoreMove(state, moves[i], side);
      if (s > bestScore) { bestScore = s; best = moves[i]; }
    }
    best.score = bestScore;
    return best;
  }

  TC.ai = {
    chooseMove: chooseMove,
    scoreMove: scoreMove
  };
})(window.TC);
