// Terrain Chess — canvas rendering.
// Layers per frame:
//   tiles (terrain tint + checker) -> last-move tint -> big glyph (empty cells)
//   -> rays -> non-capture markers -> pieces -> capture rings + corner glyphs
//   -> selection / inspect outline -> coordinate labels
window.TC = window.TC || {};
(function (TC) {
  'use strict';

  var N = TC.BOARD_SIZE;
  var GLYPH_FONT = '"DejaVu Sans", "Segoe UI Symbol", "Arial Unicode MS", serif';

  function shade(hex, amount) {
    // amount in [-1,1]; negative darkens, positive lightens.
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    var t = amount < 0 ? 0 : 255;
    var p = Math.abs(amount);
    r = Math.round((t - r) * p + r);
    g = Math.round((t - g) * p + g);
    b = Math.round((t - b) * p + b);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function Renderer(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.size = canvas.clientWidth || 600;
    this.cell = this.size / N;
    this._setupHiDPI();
  }

  Renderer.prototype._setupHiDPI = function () {
    var dpr = window.devicePixelRatio || 1;
    this.canvas.width = this.size * dpr;
    this.canvas.height = this.size * dpr;
    this.canvas.style.width = this.size + 'px';
    this.canvas.style.height = this.size + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  Renderer.prototype.cellFromPixel = function (px, py) {
    var c = Math.floor(px / this.cell);
    var r = Math.floor(py / this.cell);
    if (r < 0 || r >= N || c < 0 || c >= N) return null;
    return { r: r, c: c };
  };

  Renderer.prototype._center = function (r, c) {
    return { x: c * this.cell + this.cell / 2, y: r * this.cell + this.cell / 2 };
  };

  Renderer.prototype.draw = function (state, ui) {
    var ctx = this.ctx, cell = this.cell;
    ctx.clearRect(0, 0, this.size, this.size);

    // --- tiles ---
    for (var r = 0; r < N; r++) {
      for (var c = 0; c < N; c++) {
        var terrain = state.terrain[r][c];
        var base = TC.TERRAIN_COLOR[terrain];
        var x = c * cell, y = r * cell;
        ctx.fillStyle = base;
        ctx.fillRect(x, y, cell, cell);
        // checker overlay so the grid stays readable
        ctx.fillStyle = (r + c) % 2 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.10)';
        ctx.fillRect(x, y, cell, cell);
      }
    }

    // --- last move tint ---
    if (state.lastMove) {
      this._tintCell(state.lastMove.from, 'rgba(245,220,120,0.30)');
      this._tintCell(state.lastMove.to, 'rgba(245,220,120,0.42)');
    }

    // --- big terrain glyph on EMPTY cells (occupied cells show corner glyph) ---
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (r = 0; r < N; r++) {
      for (c = 0; c < N; c++) {
        if (state.pieces[r][c]) continue;
        var ct = this._center(r, c);
        ctx.font = Math.floor(cell * 0.62) + 'px ' + GLYPH_FONT;
        ctx.fillStyle = 'rgba(40,40,55,0.42)';
        ctx.fillText(TC.GLYPH[state.terrain[r][c]], ct.x, ct.y + cell * 0.02);
      }
    }

    // --- movement visualization (rays + non-capture markers) under pieces ---
    var vis = ui && ui.vis;
    if (vis) this._drawRays(vis.rays);
    if (vis) this._drawMarkers(state, vis.moves, false);

    // --- pieces ---
    for (r = 0; r < N; r++) {
      for (c = 0; c < N; c++) {
        if (state.pieces[r][c]) this._drawPiece(r, c, state.pieces[r][c]);
      }
    }

    // --- corner terrain glyphs on occupied cells (terrain stays visible) ---
    for (r = 0; r < N; r++) {
      for (c = 0; c < N; c++) {
        if (!state.pieces[r][c]) continue;
        var x2 = c * cell, y2 = r * cell;
        ctx.font = Math.floor(cell * 0.30) + 'px ' + GLYPH_FONT;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = 'rgba(20,20,30,0.78)';
        ctx.fillText(TC.GLYPH[state.terrain[r][c]], x2 + cell * 0.06, y2 + cell * 0.04);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
      }
    }

    // --- capture rings (drawn over pieces so they encircle the target) ---
    if (vis) this._drawMarkers(state, vis.moves, true);

    // --- selection / inspect outline on the origin cell ---
    if (vis) {
      var col = vis.kind === 'inspect' ? '#3a86e8' : '#e8b53a';
      this._outlineCell(vis.origin, col, vis.kind === 'inspect');
    }

    this._drawCoords();
  };

  Renderer.prototype._tintCell = function (cellPos, color) {
    var ctx = this.ctx, cell = this.cell;
    ctx.fillStyle = color;
    ctx.fillRect(cellPos.c * cell, cellPos.r * cell, cell, cell);
  };

  Renderer.prototype._drawRays = function (rays) {
    if (!rays || !rays.length) return;
    var ctx = this.ctx, cell = this.cell;
    ctx.save();
    ctx.strokeStyle = 'rgba(60,170,100,0.55)';
    ctx.lineWidth = Math.max(3, cell * 0.05);
    ctx.lineCap = 'round';
    for (var i = 0; i < rays.length; i++) {
      var a = this._center(rays[i].from.r, rays[i].from.c);
      var b = this._center(rays[i].to.r, rays[i].to.c);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.restore();
  };

  Renderer.prototype._drawMarkers = function (state, moves, captureLayer) {
    if (!moves) return;
    var ctx = this.ctx, cell = this.cell;
    for (var i = 0; i < moves.length; i++) {
      var m = moves[i];
      var ct = this._center(m.r, m.c);
      if (m.capture) {
        if (!captureLayer) continue;
        ctx.beginPath();
        ctx.arc(ct.x, ct.y, cell * 0.40, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(214,66,66,0.95)';
        ctx.lineWidth = Math.max(3, cell * 0.06);
        ctx.stroke();
      } else {
        if (captureLayer) continue;
        ctx.beginPath();
        ctx.arc(ct.x, ct.y, cell * 0.16, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(56,178,92,0.92)';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(20,110,50,0.9)';
        ctx.stroke();
      }
    }
  };

  Renderer.prototype._drawPiece = function (r, c, side) {
    var ctx = this.ctx, cell = this.cell;
    var ct = this._center(r, c);
    var rad = cell * 0.28;
    // soft shadow
    ctx.beginPath();
    ctx.arc(ct.x, ct.y + 2, rad, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(ct.x, ct.y, rad, 0, Math.PI * 2);
    if (side === TC.WHITE) {
      ctx.fillStyle = '#fafafa';
      ctx.fill();
      ctx.lineWidth = Math.max(2.5, cell * 0.035);
      ctx.strokeStyle = '#1b1b22';
    } else {
      ctx.fillStyle = '#1b1b22';
      ctx.fill();
      ctx.lineWidth = Math.max(2, cell * 0.03);
      ctx.strokeStyle = '#f4f4f6';
    }
    ctx.stroke();
  };

  Renderer.prototype._outlineCell = function (pos, color, dashed) {
    var ctx = this.ctx, cell = this.cell;
    var pad = cell * 0.05;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(3, cell * 0.045);
    if (dashed) ctx.setLineDash([cell * 0.12, cell * 0.08]);
    ctx.strokeRect(pos.c * cell + pad, pos.r * cell + pad, cell - 2 * pad, cell - 2 * pad);
    ctx.restore();
  };

  Renderer.prototype._drawCoords = function () {
    var ctx = this.ctx, cell = this.cell;
    ctx.font = Math.floor(cell * 0.14) + 'px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(30,30,40,0.55)';
    for (var c = 0; c < N; c++) {
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText(String.fromCharCode(97 + c), (c + 1) * cell - 3, this.size - 3);
    }
    for (var r = 0; r < N; r++) {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(String(N - r), 3, r * cell + 2);
    }
  };

  TC.Renderer = Renderer;
  TC.squareName = function (r, c) { return String.fromCharCode(97 + c) + String(N - r); };
})(window.TC);
