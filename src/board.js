// Terrain Chess — board generation.
// Prototype: seeded, weighted-random terrain, optionally point-symmetric,
// validated against the movement graph (strongly connected = no tile is
// stranded and every tile is reachable). This is a first step toward the
// design doc's "Desired Generator".
window.TC = window.TC || {};
(function (TC) {
  'use strict';

  var N = TC.BOARD_SIZE;

  // mulberry32 — small deterministic PRNG so boards are reproducible by seed.
  function makeRNG(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function weightedTerrain(rng) {
    var list = TC.TERRAIN_LIST;
    var total = 0, i;
    for (i = 0; i < list.length; i++) total += TC.TERRAIN_WEIGHT[list[i]];
    var x = rng() * total;
    for (i = 0; i < list.length; i++) {
      x -= TC.TERRAIN_WEIGHT[list[i]];
      if (x < 0) return list[i];
    }
    return list[list.length - 1];
  }

  // symmetric = 180° rotational (point) symmetry, so both sides face a
  // mirrored board -> balanced strategic value / reduced first-player edge.
  function randomTerrain(rng, symmetric) {
    var grid = [];
    for (var r = 0; r < N; r++) grid.push(new Array(N).fill(null));
    for (var rr = 0; rr < N; rr++) {
      for (var cc = 0; cc < N; cc++) {
        if (grid[rr][cc]) continue; // already filled by its mirror
        var t = weightedTerrain(rng);
        grid[rr][cc] = t;
        if (symmetric) grid[N - 1 - rr][N - 1 - cc] = t;
      }
    }
    return grid;
  }

  function idx(r, c) { return r * N + c; }

  function buildGraph(grid) {
    var n = N * N;
    var adj = [];
    for (var i = 0; i < n; i++) adj.push([]);
    var edges = 0;
    for (var r = 0; r < N; r++) {
      for (var c = 0; c < N; c++) {
        var outs = TC.rules.terrainReach(grid, r, c);
        for (var k = 0; k < outs.length; k++) {
          adj[idx(r, c)].push(idx(outs[k].r, outs[k].c));
          edges++;
        }
      }
    }
    return { adj: adj, edges: edges };
  }

  // Kosaraju single-source test: strongly connected iff every node is
  // reachable from node 0 in both G and reverse(G).
  function isStronglyConnected(adj) {
    var n = adj.length;
    function reachCount(graph) {
      var seen = new Array(n).fill(false);
      var stack = [0];
      seen[0] = true;
      var count = 1;
      while (stack.length) {
        var u = stack.pop();
        var nb = graph[u];
        for (var i = 0; i < nb.length; i++) {
          if (!seen[nb[i]]) { seen[nb[i]] = true; count++; stack.push(nb[i]); }
        }
      }
      return count;
    }
    if (reachCount(adj) !== n) return false;
    var radj = [];
    for (var i = 0; i < n; i++) radj.push([]);
    for (var u = 0; u < n; u++) {
      for (var j = 0; j < adj[u].length; j++) radj[adj[u][j]].push(u);
    }
    return reachCount(radj) === n;
  }

  function terrainCounts(grid) {
    var counts = {};
    for (var i = 0; i < TC.TERRAIN_LIST.length; i++) counts[TC.TERRAIN_LIST[i]] = 0;
    for (var r = 0; r < N; r++) {
      for (var c = 0; c < N; c++) counts[grid[r][c]]++;
    }
    return counts;
  }

  // Generate a validated board. opts: { seed, symmetric, validate }.
  function generate(opts) {
    opts = opts || {};
    var symmetric = opts.symmetric !== false;      // default on
    var validate = opts.validate !== false;        // default on
    var baseSeed = (opts.seed != null) ? (opts.seed >>> 0) : ((Math.random() * 0xffffffff) >>> 0);

    var attempts = 0;
    var maxAttempts = 800;
    var seed = baseSeed;
    var grid, graph, connected;

    do {
      var rng = makeRNG(seed);
      grid = randomTerrain(rng, symmetric);
      graph = buildGraph(grid);
      connected = isStronglyConnected(graph.adj);
      attempts++;
      if (!validate || connected) break;
      seed = (seed + 0x9E3779B1) >>> 0; // jump to next candidate seed
    } while (attempts < maxAttempts);

    var stats = {
      seed: baseSeed,
      usedSeed: seed,
      attempts: attempts,
      symmetric: symmetric,
      stronglyConnected: connected,
      avgOutDegree: graph.edges / (N * N),
      counts: terrainCounts(grid)
    };

    return { terrain: grid, stats: stats };
  }

  TC.board = {
    generate: generate,
    makeRNG: makeRNG,
    buildGraph: buildGraph,
    isStronglyConnected: isStronglyConnected,
    terrainCounts: terrainCounts
  };
})(window.TC);
