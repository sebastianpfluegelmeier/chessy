// Terrain Chess — game state & rules of play.
window.TC = window.TC || {};
(function (TC) {
  'use strict';

  var N = TC.BOARD_SIZE;

  // Prototype starting layout (design doc):
  //   BBBBBB
  //   B....B
  //   ......
  //   ......
  //   W....W
  //   WWWWWW
  // Full home row + the two near-corners = 8 pieces per side, symmetrical.
  function initialPieces() {
    var p = [];
    for (var r = 0; r < N; r++) p.push(new Array(N).fill(null));
    for (var c = 0; c < N; c++) {
      p[0][c] = TC.BLACK;
      p[N - 1][c] = TC.WHITE;
    }
    p[1][0] = TC.BLACK; p[1][N - 1] = TC.BLACK;
    p[N - 2][0] = TC.WHITE; p[N - 2][N - 1] = TC.WHITE;
    return p;
  }

  function countPieces(state, side) {
    var n = 0;
    for (var r = 0; r < N; r++) {
      for (var c = 0; c < N; c++) if (state.pieces[r][c] === side) n++;
    }
    return n;
  }

  function newGame(opts) {
    opts = opts || {};
    var board = TC.board.generate(opts);
    return {
      size: N,
      terrain: board.terrain,
      stats: board.stats,
      pieces: initialPieces(),
      turn: TC.WHITE,        // White moves first
      winner: null,          // 'w' | 'b' | 'draw' | null
      reason: '',
      lastMove: null,        // { from, to, capture }
      moveCount: 0,
      movesSinceCapture: 0,
      drawLimit: TC.DRAW_LIMIT
    };
  }

  // Is `to` a legal destination for the piece at `from`?
  function isLegal(state, from, to) {
    var ms = TC.rules.legalMoves(state, from.r, from.c);
    for (var i = 0; i < ms.length; i++) {
      if (ms[i].r === to.r && ms[i].c === to.c) return true;
    }
    return false;
  }

  // Apply a move (assumed legal) and resolve end-of-game conditions.
  function applyMove(state, from, to) {
    var side = state.pieces[from.r][from.c];
    var captured = state.pieces[to.r][to.c] !== null;

    state.pieces[to.r][to.c] = side;
    state.pieces[from.r][from.c] = null;
    state.lastMove = { from: { r: from.r, c: from.c }, to: { r: to.r, c: to.c }, capture: captured };
    state.moveCount++;
    state.movesSinceCapture = captured ? 0 : state.movesSinceCapture + 1;

    var opp = TC.other(side);

    // Win: opponent has no pieces left.
    if (countPieces(state, opp) === 0) {
      state.winner = side;
      state.reason = 'captured all enemy pieces';
      state.turn = side;
      return state;
    }

    state.turn = opp;

    // Stalemate: opponent still has pieces but no legal move -> draw.
    if (TC.rules.legalMovesForSide(state, opp).length === 0) {
      state.winner = 'draw';
      state.reason = 'stalemate — ' + (opp === TC.WHITE ? 'White' : 'Black') + ' has no legal move';
      return state;
    }

    // Progress draw: too many plies without a capture.
    if (state.movesSinceCapture >= state.drawLimit) {
      state.winner = 'draw';
      state.reason = 'no capture in ' + state.drawLimit + ' plies';
    }
    return state;
  }

  TC.game = {
    newGame: newGame,
    applyMove: applyMove,
    isLegal: isLegal,
    countPieces: countPieces,
    initialPieces: initialPieces
  };
})(window.TC);
