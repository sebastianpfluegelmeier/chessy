// Terrain Chess — app controller: input, modes, AI turns, UI wiring.
window.TC = window.TC || {};
(function (TC) {
  'use strict';

  var state, renderer, ui;
  var controllers = { w: 'human', b: 'ai' }; // default: you are White vs AI Black
  var aiDelay = 450;
  var aiTimer = null;
  var gen = 0; // bumped on New Game to invalidate stale AI callbacks

  var els = {};

  function humanSide() {
    if (controllers.w === 'human') return TC.WHITE;
    if (controllers.b === 'human') return TC.BLACK;
    return state.turn; // both AI -> use side to move (for inspect pawn orientation)
  }

  function clearVis() { ui.vis = null; }

  function selectPiece(r, c) {
    var v = TC.rules.visualize(state, r, c, {});
    ui.vis = { kind: 'select', origin: { r: r, c: c }, moves: v.moves, rays: v.rays,
               terrain: state.terrain[r][c] };
  }

  function inspect(r, c) {
    var owner = humanSide();
    var v = TC.rules.visualize(state, r, c, { ignoreOccupancy: true, owner: owner });
    ui.vis = { kind: 'inspect', origin: { r: r, c: c }, moves: v.moves, rays: v.rays,
               terrain: state.terrain[r][c] };
  }

  function visMoveAt(r, c) {
    if (!ui.vis || ui.vis.kind !== 'select') return null;
    var ms = ui.vis.moves;
    for (var i = 0; i < ms.length; i++) if (ms[i].r === r && ms[i].c === c) return ms[i];
    return null;
  }

  function onBoardClick(ev) {
    var rect = renderer.canvas.getBoundingClientRect();
    var pos = renderer.cellFromPixel(ev.clientX - rect.left, ev.clientY - rect.top);
    if (!pos) return;
    var r = pos.r, c = pos.c;

    // 1) Completing a selected move.
    if (visMoveAt(r, c)) {
      doHumanMove(ui.vis.origin, { r: r, c: c });
      return;
    }

    // 2) Selecting one of your own pieces (only on your human turn).
    var canPlay = !state.winner && controllers[state.turn] === 'human';
    if (canPlay && state.pieces[r][c] === state.turn) {
      selectPiece(r, c);
      render();
      return;
    }

    // 3) Otherwise inspect the terrain of the clicked square.
    inspect(r, c);
    render();
  }

  function doHumanMove(from, to) {
    clearVis();
    TC.game.applyMove(state, from, to);
    render();
    scheduleNext();
  }

  function scheduleNext() {
    if (aiTimer) { clearTimeout(aiTimer); aiTimer = null; }
    if (state.winner) return;
    if (controllers[state.turn] !== 'ai') return;
    var myGen = gen;
    aiTimer = setTimeout(function () {
      if (myGen !== gen) return; // superseded by a New Game
      aiTimer = null;
      var mv = TC.ai.chooseMove(state, state.turn);
      if (!mv) return; // stalemate already resolved in applyMove
      clearVis();
      TC.game.applyMove(state, mv.from, mv.to);
      render();
      scheduleNext();
    }, aiDelay);
  }

  // ---- UI ----

  function render() {
    renderer.draw(state, ui);
    updateStatus();
  }

  function updateStatus() {
    var w = TC.game.countPieces(state, TC.WHITE);
    var b = TC.game.countPieces(state, TC.BLACK);
    els.whiteCount.textContent = w;
    els.blackCount.textContent = b;

    var msg;
    if (state.winner === 'draw') {
      msg = 'Draw — ' + state.reason + '.';
    } else if (state.winner) {
      msg = (state.winner === TC.WHITE ? 'White' : 'Black') + ' wins — ' + state.reason + '.';
    } else {
      var who = state.turn === TC.WHITE ? 'White' : 'Black';
      var kind = controllers[state.turn] === 'ai' ? ' (AI)' : ' (you)';
      msg = who + kind + ' to move.';
    }
    els.status.textContent = msg;
    els.status.className = 'status' + (state.winner ? ' status--over' : '');

    // selection / inspection detail
    var detail = '';
    if (ui.vis) {
      var o = ui.vis.origin;
      var name = TC.TERRAIN_NAME[ui.vis.terrain];
      var sq = TC.squareName(o.r, o.c);
      var count = ui.vis.moves.length;
      if (ui.vis.kind === 'inspect') {
        detail = 'Inspecting ' + sq + ': ' + name + ' terrain — ' +
                 TERRAIN_HINT[ui.vis.terrain] + ' (' + count + ' squares, ignoring occupancy).';
      } else {
        detail = 'Selected ' + sq + ' on ' + name + ' terrain — ' + count + ' legal move' +
                 (count === 1 ? '' : 's') + '.';
      }
    } else {
      detail = 'Click a piece to see its moves, or any square to inspect its terrain.';
    }
    els.detail.textContent = detail;

    // board generation stats
    var st = state.stats;
    els.stats.textContent = 'Board #' + st.usedSeed +
      '  ·  ' + (st.stronglyConnected ? 'connected ✓' : 'not fully connected') +
      '  ·  avg mobility ' + st.avgOutDegree.toFixed(1) +
      '  ·  ' + st.attempts + ' gen attempt' + (st.attempts === 1 ? '' : 's');
  }

  var TERRAIN_HINT = {
    K: 'one step in any direction',
    Q: 'slides in all 8 directions',
    R: 'slides orthogonally',
    B: 'slides diagonally',
    N: 'knight jumps (ignores blocking)',
    P: 'forward one; captures diagonally forward'
  };

  function buildLegend() {
    var frag = document.createDocumentFragment();
    for (var i = 0; i < TC.TERRAIN_LIST.length; i++) {
      var t = TC.TERRAIN_LIST[i];
      var row = document.createElement('div');
      row.className = 'legend-row';
      var sw = document.createElement('span');
      sw.className = 'legend-swatch';
      sw.style.background = TC.TERRAIN_COLOR[t];
      sw.textContent = TC.GLYPH[t];
      var label = document.createElement('span');
      label.className = 'legend-label';
      label.textContent = TC.TERRAIN_NAME[t];
      var val = document.createElement('span');
      val.className = 'legend-val';
      val.textContent = 'value ' + TC.TERRAIN_VALUE[t];
      row.appendChild(sw); row.appendChild(label); row.appendChild(val);
      frag.appendChild(row);
    }
    els.legend.innerHTML = '';
    els.legend.appendChild(frag);
  }

  function newGame() {
    gen++;
    if (aiTimer) { clearTimeout(aiTimer); aiTimer = null; }
    controllers.w = els.whiteCtrl.value;
    controllers.b = els.blackCtrl.value;
    var symmetric = els.symmetric.checked;
    var seedRaw = els.seed.value.trim();
    var opts = { symmetric: symmetric };
    if (seedRaw !== '') {
      var s = parseInt(seedRaw, 10);
      if (!isNaN(s)) opts.seed = s;
    }
    state = TC.game.newGame(opts);
    els.seed.value = state.stats.usedSeed; // reflect the seed actually used
    ui = { vis: null };
    render();
    scheduleNext();
    // log generation stats for iteration
    if (window.console) {
      console.log('New board', state.stats);
    }
  }

  function init() {
    els.canvas = document.getElementById('board');
    els.status = document.getElementById('status');
    els.detail = document.getElementById('detail');
    els.stats = document.getElementById('stats');
    els.whiteCount = document.getElementById('whiteCount');
    els.blackCount = document.getElementById('blackCount');
    els.legend = document.getElementById('legend');
    els.newGame = document.getElementById('newGame');
    els.seed = document.getElementById('seed');
    els.symmetric = document.getElementById('symmetric');
    els.whiteCtrl = document.getElementById('whiteCtrl');
    els.blackCtrl = document.getElementById('blackCtrl');
    els.speed = document.getElementById('speed');

    renderer = new TC.Renderer(els.canvas);
    buildLegend();

    els.canvas.addEventListener('click', onBoardClick);
    els.canvas.addEventListener('contextmenu', function (e) {
      e.preventDefault(); clearVis(); render();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { clearVis(); render(); }
    });

    els.newGame.addEventListener('click', function () { els.seed.value = ''; newGame(); });
    // Typing a seed and pressing Enter (or blurring) loads that exact board.
    els.seed.addEventListener('change', function () { newGame(); });
    els.seed.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); newGame(); }
    });
    els.whiteCtrl.addEventListener('change', function () {
      controllers.w = els.whiteCtrl.value; clearVis(); render(); scheduleNext();
    });
    els.blackCtrl.addEventListener('change', function () {
      controllers.b = els.blackCtrl.value; clearVis(); render(); scheduleNext();
    });
    els.speed.addEventListener('change', function () {
      aiDelay = parseInt(els.speed.value, 10) || 450;
    });

    // first board
    state = TC.game.newGame({ symmetric: true });
    els.seed.value = state.stats.usedSeed;
    ui = { vis: null };
    render();
    scheduleNext();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window.TC);
