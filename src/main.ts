// Terrain Chess — app controller: input, game modes, AI turns, UI wiring.
import {
  GameState, Player, Terrain, WHITE, BLACK,
  TERRAINS, GLYPH, TERRAIN_NAME, TERRAIN_VALUE, TERRAIN_COLOR, TERRAIN_HINT
} from './constants.js';
import * as Game from './game.js';
import * as Rules from './rules.js';
import * as AI from './ai.js';
import { Renderer, Vis, squareName } from './render.js';

type Mode = '1p' | '2p';
type Controller = 'human' | 'ai';

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error('missing #' + id);
  return el as T;
}

class App {
  state!: GameState;
  renderer: Renderer;
  vis: Vis | null = null;

  mode: Mode = '1p';
  humanColor: Player = WHITE; // in 1P: which side the human plays
  aiDelay = 450;
  private aiTimer: number | null = null;
  private gen = 0; // bumped on New Game to invalidate stale AI callbacks

  canvas: HTMLCanvasElement;
  seedEl: HTMLInputElement;
  symmetricEl: HTMLInputElement;
  humanColorEl: HTMLSelectElement;
  speedEl: HTMLSelectElement;
  oneOpts: HTMLElement;

  constructor() {
    this.canvas = byId<HTMLCanvasElement>('board');
    this.seedEl = byId<HTMLInputElement>('seed');
    this.symmetricEl = byId<HTMLInputElement>('symmetric');
    this.humanColorEl = byId<HTMLSelectElement>('humanColor');
    this.speedEl = byId<HTMLSelectElement>('speed');
    this.oneOpts = byId<HTMLElement>('oneOpts');

    this.renderer = new Renderer(this.canvas);
    this.buildLegend();
    this.wireEvents();
    this.newGame();
  }

  private controllerFor(side: Player): Controller {
    if (this.mode === '2p') return 'human';
    return side === this.humanColor ? 'human' : 'ai';
  }

  // Side used for pawn orientation when inspecting terrain.
  private inspectSide(): Player {
    if (this.mode === '1p') return this.humanColor;
    return this.state.turn;
  }

  // ---- input ----

  private onBoardClick = (ev: MouseEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    const pos = this.renderer.cellFromPixel(ev.clientX - rect.left, ev.clientY - rect.top);
    if (!pos) return;
    const { r, c } = pos;

    // 1) complete a selected move
    const target = this.selectedMoveAt(r, c);
    if (target) { this.doMove(this.vis!.origin, { r, c }); return; }

    // 2) select one of your own pieces (only on a human turn)
    const canPlay = !this.state.winner && this.controllerFor(this.state.turn) === 'human';
    if (canPlay && this.state.pieces[r][c] === this.state.turn) {
      const v = Rules.visualize(this.state, r, c, {});
      this.vis = { kind: 'select', origin: { r, c }, moves: v.moves, rays: v.rays,
                   terrain: this.state.terrain[r][c] };
      this.render();
      return;
    }

    // 3) otherwise inspect the clicked square's terrain
    const v = Rules.visualize(this.state, r, c, { ignoreOccupancy: true, owner: this.inspectSide() });
    this.vis = { kind: 'inspect', origin: { r, c }, moves: v.moves, rays: v.rays,
                 terrain: this.state.terrain[r][c] };
    this.render();
  };

  private selectedMoveAt(r: number, c: number) {
    if (!this.vis || this.vis.kind !== 'select') return null;
    return this.vis.moves.find(m => m.r === r && m.c === c) || null;
  }

  private doMove(from: { r: number; c: number }, to: { r: number; c: number }): void {
    this.vis = null;
    Game.applyMove(this.state, from, to);
    this.render();
    this.scheduleAI();
  }

  private scheduleAI(): void {
    if (this.aiTimer !== null) { clearTimeout(this.aiTimer); this.aiTimer = null; }
    if (this.state.winner) return;
    if (this.controllerFor(this.state.turn) !== 'ai') return;
    const myGen = this.gen;
    this.aiTimer = window.setTimeout(() => {
      if (myGen !== this.gen) return; // superseded by a New Game
      this.aiTimer = null;
      const mv = AI.chooseMove(this.state, this.state.turn);
      if (!mv) return; // stalemate already resolved in applyMove
      this.vis = null;
      Game.applyMove(this.state, mv.from, mv.to);
      this.render();
      this.scheduleAI();
    }, this.aiDelay);
  }

  // ---- rendering / status ----

  private render(): void {
    this.renderer.draw(this.state, this.vis);
    this.updateStatus();
  }

  private updateStatus(): void {
    const w = Game.countPieces(this.state, WHITE);
    const b = Game.countPieces(this.state, BLACK);
    byId('whiteCount').textContent = String(w);
    byId('blackCount').textContent = String(b);

    let msg: string;
    if (this.state.winner === 'draw') {
      msg = 'Draw — ' + this.state.reason + '.';
    } else if (this.state.winner) {
      msg = (this.state.winner === WHITE ? 'White' : 'Black') + ' wins — ' + this.state.reason + '.';
    } else {
      const who = this.state.turn === WHITE ? 'White' : 'Black';
      const ctl = this.controllerFor(this.state.turn);
      const tag = this.mode === '1p' ? (ctl === 'ai' ? ' (AI)' : ' (you)') : '';
      msg = who + tag + ' to move.';
    }
    const status = byId('status');
    status.textContent = msg;
    status.className = 'status' + (this.state.winner ? ' status--over' : '');

    let detail: string;
    if (this.vis) {
      const o = this.vis.origin;
      const name = TERRAIN_NAME[this.vis.terrain as Terrain];
      const sq = squareName(o.r, o.c);
      const count = this.vis.moves.length;
      if (this.vis.kind === 'inspect') {
        detail = 'Inspecting ' + sq + ': ' + name + ' terrain — ' +
          TERRAIN_HINT[this.vis.terrain as Terrain] + ' (' + count + ' squares, ignoring occupancy).';
      } else {
        detail = 'Selected ' + sq + ' on ' + name + ' terrain — ' + count +
          ' legal move' + (count === 1 ? '' : 's') + '.';
      }
    } else {
      detail = 'Click a piece to see its moves, or any square to inspect its terrain.';
    }
    byId('detail').textContent = detail;

    const st = this.state.stats;
    byId('stats').textContent = 'Board #' + st.usedSeed +
      '  ·  ' + (st.stronglyConnected ? 'connected ✓' : 'not fully connected') +
      '  ·  avg mobility ' + st.avgOutDegree.toFixed(1) +
      '  ·  ' + st.attempts + ' gen attempt' + (st.attempts === 1 ? '' : 's');
  }

  private buildLegend(): void {
    const legend = byId('legend');
    legend.innerHTML = '';
    for (const t of TERRAINS) {
      const row = document.createElement('div');
      row.className = 'legend-row';
      const sw = document.createElement('span');
      sw.className = 'legend-swatch';
      sw.style.background = TERRAIN_COLOR[t];
      sw.textContent = GLYPH[t];
      const label = document.createElement('span');
      label.className = 'legend-label';
      label.textContent = TERRAIN_NAME[t];
      const val = document.createElement('span');
      val.className = 'legend-val';
      val.textContent = 'value ' + TERRAIN_VALUE[t];
      row.append(sw, label, val);
      legend.appendChild(row);
    }
  }

  // ---- controls ----

  private setMode(mode: Mode): void {
    this.mode = mode;
    document.querySelectorAll<HTMLElement>('#modeSeg .seg').forEach(el => {
      el.classList.toggle('seg--on', el.dataset.mode === mode);
    });
    this.oneOpts.style.display = mode === '1p' ? '' : 'none';
    this.vis = null;
    this.render();
    this.scheduleAI();
  }

  private newGame(): void {
    this.gen++;
    if (this.aiTimer !== null) { clearTimeout(this.aiTimer); this.aiTimer = null; }
    const symmetric = this.symmetricEl.checked;
    const seedRaw = this.seedEl.value.trim();
    const opts: { symmetric: boolean; seed?: number } = { symmetric };
    if (seedRaw !== '') {
      const s = parseInt(seedRaw, 10);
      if (!isNaN(s)) opts.seed = s;
    }
    this.state = Game.newGame(opts);
    this.seedEl.value = String(this.state.stats.usedSeed);
    this.vis = null;
    this.render();
    this.scheduleAI();
  }

  private wireEvents(): void {
    this.canvas.addEventListener('click', this.onBoardClick);
    this.canvas.addEventListener('contextmenu', e => { e.preventDefault(); this.vis = null; this.render(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { this.vis = null; this.render(); } });

    document.querySelectorAll<HTMLElement>('#modeSeg .seg').forEach(el => {
      el.addEventListener('click', () => this.setMode(el.dataset.mode as Mode));
    });
    this.humanColorEl.addEventListener('change', () => {
      this.humanColor = this.humanColorEl.value as Player;
      this.vis = null; this.render(); this.scheduleAI();
    });
    this.speedEl.addEventListener('change', () => {
      this.aiDelay = parseInt(this.speedEl.value, 10) || 450;
    });

    byId('newGame').addEventListener('click', () => { this.seedEl.value = ''; this.newGame(); });
    this.seedEl.addEventListener('change', () => this.newGame());
    this.seedEl.addEventListener('keydown', e => {
      if ((e as KeyboardEvent).key === 'Enter') { e.preventDefault(); this.newGame(); }
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { new App(); });
} else {
  new App();
}
