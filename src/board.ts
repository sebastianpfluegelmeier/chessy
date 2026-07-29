// Terrain Chess — board generation.
// Seeded, weighted-random terrain, optionally 180°-symmetric, validated
// against the movement graph (strongly connected = every tile reachable,
// nothing stranded). A first step toward the design doc's "desired generator".
import { Terrain, TERRAINS, TERRAIN_WEIGHT, BoardStats, BOARD_SIZE } from './constants.js';
import { terrainReach } from './rules.js';

const N = BOARD_SIZE;

// mulberry32 — small deterministic PRNG so boards are reproducible by seed.
export function makeRNG(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function weightedTerrain(rng: () => number): Terrain {
  let total = 0;
  for (const t of TERRAINS) total += TERRAIN_WEIGHT[t];
  let x = rng() * total;
  for (const t of TERRAINS) {
    x -= TERRAIN_WEIGHT[t];
    if (x < 0) return t;
  }
  return TERRAINS[TERRAINS.length - 1];
}

// symmetric = 180° rotational (point) symmetry, so both sides face a mirrored
// board -> balanced strategic value / reduced first-player advantage.
function randomTerrain(rng: () => number, symmetric: boolean): Terrain[][] {
  const grid: Terrain[][] = [];
  for (let r = 0; r < N; r++) grid.push(new Array(N).fill('P'));
  const filled: boolean[][] = [];
  for (let r = 0; r < N; r++) filled.push(new Array(N).fill(false));
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (filled[r][c]) continue;
      const t = weightedTerrain(rng);
      grid[r][c] = t; filled[r][c] = true;
      if (symmetric) { grid[N - 1 - r][N - 1 - c] = t; filled[N - 1 - r][N - 1 - c] = true; }
    }
  }
  return grid;
}

const idx = (r: number, c: number) => r * N + c;

export function buildGraph(grid: Terrain[][]): { adj: number[][]; edges: number } {
  const adj: number[][] = [];
  for (let i = 0; i < N * N; i++) adj.push([]);
  let edges = 0;
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      for (const m of terrainReach(grid, r, c)) {
        adj[idx(r, c)].push(idx(m.r, m.c));
        edges++;
      }
    }
  }
  return { adj, edges };
}

// Kosaraju single-source test: strongly connected iff every node is reachable
// from node 0 in both G and reverse(G).
export function isStronglyConnected(adj: number[][]): boolean {
  const n = adj.length;
  const reachCount = (graph: number[][]): number => {
    const seen = new Array(n).fill(false);
    const stack = [0];
    seen[0] = true;
    let count = 1;
    while (stack.length) {
      const u = stack.pop() as number;
      for (const v of graph[u]) if (!seen[v]) { seen[v] = true; count++; stack.push(v); }
    }
    return count;
  };
  if (reachCount(adj) !== n) return false;
  const radj: number[][] = [];
  for (let i = 0; i < n; i++) radj.push([]);
  for (let u = 0; u < n; u++) for (const v of adj[u]) radj[v].push(u);
  return reachCount(radj) === n;
}

export function terrainCounts(grid: Terrain[][]): Record<Terrain, number> {
  const counts = { K: 0, Q: 0, R: 0, B: 0, N: 0, P: 0 } as Record<Terrain, number>;
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) counts[grid[r][c]]++;
  return counts;
}

export interface GenOptions { seed?: number; symmetric?: boolean; validate?: boolean; }

export function generate(opts: GenOptions = {}): { terrain: Terrain[][]; stats: BoardStats } {
  const symmetric = opts.symmetric !== false; // default on
  const validate = opts.validate !== false;   // default on
  const baseSeed = (opts.seed != null) ? (opts.seed >>> 0) : ((Math.random() * 0xffffffff) >>> 0);

  let attempts = 0;
  const maxAttempts = 800;
  let seed = baseSeed;
  let grid: Terrain[][] = [];
  let graph = { adj: [] as number[][], edges: 0 };
  let connected = false;

  do {
    const rng = makeRNG(seed);
    grid = randomTerrain(rng, symmetric);
    graph = buildGraph(grid);
    connected = isStronglyConnected(graph.adj);
    attempts++;
    if (!validate || connected) break;
    seed = (seed + 0x9E3779B1) >>> 0;
  } while (attempts < maxAttempts);

  const stats: BoardStats = {
    seed: baseSeed,
    usedSeed: seed,
    attempts,
    symmetric,
    stronglyConnected: connected,
    avgOutDegree: graph.edges / (N * N),
    counts: terrainCounts(grid)
  };

  return { terrain: grid, stats };
}
