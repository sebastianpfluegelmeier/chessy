// Terrain Chess — movement rules.
// A piece moves according to the terrain it is CURRENTLY standing on
// (not the destination). That delayed effect is the core mechanic; the
// destination's terrain only matters next turn.
window.TC = window.TC || {};
(function (TC) {
  'use strict';

  var N = TC.BOARD_SIZE;
  var T = TC.TERRAIN;

  var DIR_ORTHO = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  var DIR_DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  var DIR8 = DIR_ORTHO.concat(DIR_DIAG);
  var KNIGHT_OFF = [
    [-2, -1], [-2, 1], [-1, -2], [-1, 2],
    [1, -2], [1, 2], [2, -1], [2, 1]
  ];

  function inBounds(r, c) { return r >= 0 && r < N && c >= 0 && c < N; }

  // Core move generator. `occ(r,c)` returns 'w' | 'b' | null.
  // mode 'play'  -> real captures/blocking.
  // mode 'inspect' -> occupancy ignored (occ should return null); pawns also
  //                   expose their diagonal *capture squares* as markers.
  // Returns { moves:[{r,c,capture}], rays:[{from:{r,c}, to:{r,c}}] }.
  function computeMoves(occ, terrain, r, c, owner, mode) {
    var moves = [];
    var rays = [];
    var enemy = TC.other(owner);

    function add(nr, nc, capture) { moves.push({ r: nr, c: nc, capture: !!capture }); }

    function slide(dirs) {
      for (var i = 0; i < dirs.length; i++) {
        var dr = dirs[i][0], dc = dirs[i][1];
        var far = null;
        for (var k = 1; ; k++) {
          var nr = r + dr * k, nc = c + dc * k;
          if (!inBounds(nr, nc)) break;
          var o = occ(nr, nc);
          if (o === null) { add(nr, nc, false); far = { r: nr, c: nc }; continue; }
          if (o === owner) break;          // friendly blocks, cannot pass
          add(nr, nc, true); far = { r: nr, c: nc }; break; // capture enemy, then stop
        }
        if (far) rays.push({ from: { r: r, c: c }, to: far });
      }
    }

    function step(dirs) {
      for (var i = 0; i < dirs.length; i++) {
        var nr = r + dirs[i][0], nc = c + dirs[i][1];
        if (!inBounds(nr, nc)) continue;
        var o = occ(nr, nc);
        if (o === owner) continue;
        add(nr, nc, o !== null);
      }
    }

    switch (terrain) {
      case T.QUEEN: slide(DIR8); break;
      case T.ROOK: slide(DIR_ORTHO); break;
      case T.BISHOP: slide(DIR_DIAG); break;
      case T.KING: step(DIR8); break;
      case T.KNIGHT: // jumps over pieces; ignores blocking
        for (var i = 0; i < KNIGHT_OFF.length; i++) {
          var nr = r + KNIGHT_OFF[i][0], nc = c + KNIGHT_OFF[i][1];
          if (!inBounds(nr, nc)) continue;
          var o = occ(nr, nc);
          if (o === owner) continue;
          add(nr, nc, o !== null);
        }
        break;
      case T.PAWN: {
        var dir = owner === TC.WHITE ? -1 : 1; // White ↑ (rows decrease), Black ↓
        var fr = r + dir;
        // one square forward (never a capture)
        if (inBounds(fr, c) && (mode === 'inspect' || occ(fr, c) === null)) add(fr, c, false);
        // one square diagonally forward = capture
        var diagCols = [c - 1, c + 1];
        for (var d = 0; d < 2; d++) {
          var nc = diagCols[d];
          if (!inBounds(fr, nc)) continue;
          if (mode === 'inspect') { add(fr, nc, true); continue; }
          var o = occ(fr, nc);
          if (o !== null && o !== owner) add(fr, nc, true);
        }
        break;
      }
    }
    return { moves: moves, rays: rays };
  }

  // Real legal moves for the piece at (r,c), given actual occupancy.
  function legalMoves(state, r, c) {
    var owner = state.pieces[r][c];
    if (!owner) return [];
    var occ = function (rr, cc) { return state.pieces[rr][cc]; };
    return computeMoves(occ, state.terrain[r][c], r, c, owner, 'play').moves;
  }

  // Visualization payload for selection (play) or inspect.
  // opts: { ignoreOccupancy:bool, owner:'w'|'b' }
  function visualize(state, r, c, opts) {
    opts = opts || {};
    var ignore = !!opts.ignoreOccupancy;
    var owner = opts.owner || state.pieces[r][c] || TC.WHITE;
    var occ = ignore ? function () { return null; }
                     : function (rr, cc) { return state.pieces[rr][cc]; };
    return computeMoves(occ, state.terrain[r][c], r, c, owner, ignore ? 'inspect' : 'play');
  }

  // Every from/to legal move for a whole side.
  function legalMovesForSide(state, side) {
    var out = [];
    for (var r = 0; r < N; r++) {
      for (var c = 0; c < N; c++) {
        if (state.pieces[r][c] !== side) continue;
        var ms = legalMoves(state, r, c);
        for (var i = 0; i < ms.length; i++) {
          out.push({ from: { r: r, c: c }, to: { r: ms[i].r, c: ms[i].c }, capture: ms[i].capture });
        }
      }
    }
    return out;
  }

  // How many squares a piece could reach FROM (r,c) on an empty board.
  // Used by the AI's small mobility term.
  function mobilityAt(state, r, c, owner) {
    var occ = function () { return null; };
    return computeMoves(occ, state.terrain[r][c], r, c, owner, 'inspect').moves.length;
  }

  // Directed reachability from a tile on an empty board — the edges of the
  // movement graph used by the board generator. Pawn tiles contribute edges
  // for BOTH colors (either colour could occupy the tile).
  function terrainReach(grid, r, c) {
    var occ = function () { return null; };
    var terrain = grid[r][c];
    if (terrain === T.PAWN) {
      var a = computeMoves(occ, terrain, r, c, TC.WHITE, 'inspect').moves;
      var b = computeMoves(occ, terrain, r, c, TC.BLACK, 'inspect').moves;
      var seen = {};
      var merged = [];
      var all = a.concat(b);
      for (var i = 0; i < all.length; i++) {
        var key = all[i].r + ',' + all[i].c;
        if (!seen[key]) { seen[key] = true; merged.push(all[i]); }
      }
      return merged;
    }
    return computeMoves(occ, terrain, r, c, TC.WHITE, 'inspect').moves;
  }

  TC.rules = {
    computeMoves: computeMoves,
    legalMoves: legalMoves,
    visualize: visualize,
    legalMovesForSide: legalMovesForSide,
    mobilityAt: mobilityAt,
    terrainReach: terrainReach,
    inBounds: inBounds
  };
})(window.TC);
