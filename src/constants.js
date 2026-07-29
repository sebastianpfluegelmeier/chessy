// Terrain Chess — shared constants.
// All modules hang off a single global namespace so the game runs from
// file:// with plain <script> tags (no build step, no ES-module CORS issues).
window.TC = window.TC || {};
(function (TC) {
  'use strict';

  // Terrain codes (uppercase). Kept separate from player codes below.
  var KING = 'K', QUEEN = 'Q', ROOK = 'R', BISHOP = 'B', KNIGHT = 'N', PAWN = 'P';

  TC.TERRAIN = { KING: KING, QUEEN: QUEEN, ROOK: ROOK, BISHOP: BISHOP, KNIGHT: KNIGHT, PAWN: PAWN };
  TC.TERRAIN_LIST = [KING, QUEEN, ROOK, BISHOP, KNIGHT, PAWN];

  // Chess symbols used to *label the terrain* (never reused for pieces).
  TC.GLYPH = {};
  TC.GLYPH[KING] = '♔';   // ♔
  TC.GLYPH[QUEEN] = '♕';  // ♕
  TC.GLYPH[ROOK] = '♖';   // ♖
  TC.GLYPH[BISHOP] = '♗'; // ♗
  TC.GLYPH[KNIGHT] = '♘'; // ♘
  TC.GLYPH[PAWN] = '♙';   // ♙

  TC.TERRAIN_NAME = { K: 'King', Q: 'Queen', R: 'Rook', B: 'Bishop', N: 'Knight', P: 'Pawn' };

  // Strategic value of standing on a tile (drives AI scoring & board stats).
  TC.TERRAIN_VALUE = {};
  TC.TERRAIN_VALUE[QUEEN] = 30;
  TC.TERRAIN_VALUE[ROOK] = 20;
  TC.TERRAIN_VALUE[BISHOP] = 16;
  TC.TERRAIN_VALUE[KNIGHT] = 14;
  TC.TERRAIN_VALUE[KING] = 10;
  TC.TERRAIN_VALUE[PAWN] = 4;

  // Weighted generation distribution (design doc "Terrain Distribution"):
  // pawn most common ... queen very rare. High-mobility terrain = objectives.
  TC.TERRAIN_WEIGHT = {};
  TC.TERRAIN_WEIGHT[PAWN] = 34;
  TC.TERRAIN_WEIGHT[KING] = 22;
  TC.TERRAIN_WEIGHT[KNIGHT] = 16;
  TC.TERRAIN_WEIGHT[BISHOP] = 14;
  TC.TERRAIN_WEIGHT[ROOK] = 9;
  TC.TERRAIN_WEIGHT[QUEEN] = 5;

  // Tile tint per terrain (kept pale so glyphs/pieces read clearly on top).
  TC.TERRAIN_COLOR = {};
  TC.TERRAIN_COLOR[KING] = '#f4cfa0';
  TC.TERRAIN_COLOR[QUEEN] = '#eab6ea';
  TC.TERRAIN_COLOR[ROOK] = '#aec6f0';
  TC.TERRAIN_COLOR[BISHOP] = '#aee2ba';
  TC.TERRAIN_COLOR[KNIGHT] = '#aadfe0';
  TC.TERRAIN_COLOR[PAWN] = '#dcdce0';

  // Player codes (lowercase — never collide with terrain codes).
  TC.WHITE = 'w';
  TC.BLACK = 'b';
  TC.other = function (side) { return side === TC.WHITE ? TC.BLACK : TC.WHITE; };

  TC.BOARD_SIZE = 6;

  // Draw the game if this many plies pass with no capture (stops AI-vs-AI
  // shuffling forever; capture-all has no natural repetition rule).
  TC.DRAW_LIMIT = 120;
})(window.TC);
