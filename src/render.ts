// Terrain Chess — canvas rendering.
import {
  GameState, Coord, Move, Ray, GLYPH, TERRAIN_COLOR, BOARD_SIZE, WHITE
} from './constants.js';

const N = BOARD_SIZE;
const GLYPH_FONT = '"DejaVu Sans", "Segoe UI Symbol", "Arial Unicode MS", serif';

export interface Vis {
  kind: 'select' | 'inspect';
  origin: Coord;
  moves: Move[];
  rays: Ray[];
  terrain: string;
}

export class Renderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  size: number;
  cell: number;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context unavailable');
    this.ctx = ctx;
    this.size = canvas.clientWidth || 600;
    this.cell = this.size / N;
    this.setupHiDPI();
  }

  private setupHiDPI(): void {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = this.size * dpr;
    this.canvas.height = this.size * dpr;
    this.canvas.style.width = this.size + 'px';
    this.canvas.style.height = this.size + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  cellFromPixel(px: number, py: number): Coord | null {
    const c = Math.floor(px / this.cell);
    const r = Math.floor(py / this.cell);
    if (r < 0 || r >= N || c < 0 || c >= N) return null;
    return { r, c };
  }

  private center(r: number, c: number): { x: number; y: number } {
    return { x: c * this.cell + this.cell / 2, y: r * this.cell + this.cell / 2 };
  }

  draw(state: GameState, vis: Vis | null): void {
    const { ctx, cell } = this;
    ctx.clearRect(0, 0, this.size, this.size);

    // tiles
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const x = c * cell, y = r * cell;
        ctx.fillStyle = TERRAIN_COLOR[state.terrain[r][c]];
        ctx.fillRect(x, y, cell, cell);
        ctx.fillStyle = (r + c) % 2 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.10)';
        ctx.fillRect(x, y, cell, cell);
      }
    }

    // last move tint
    if (state.lastMove) {
      this.tintCell(state.lastMove.from, 'rgba(245,220,120,0.30)');
      this.tintCell(state.lastMove.to, 'rgba(245,220,120,0.42)');
    }

    // big terrain glyph on EMPTY cells
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (state.pieces[r][c]) continue;
        const ct = this.center(r, c);
        ctx.font = Math.floor(cell * 0.62) + 'px ' + GLYPH_FONT;
        ctx.fillStyle = 'rgba(40,40,55,0.42)';
        ctx.fillText(GLYPH[state.terrain[r][c]], ct.x, ct.y + cell * 0.02);
      }
    }

    // movement visualization (under pieces): rays + non-capture markers
    if (vis) { this.drawRays(vis.rays); this.drawMarkers(vis.moves, false); }

    // pieces
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const p = state.pieces[r][c];
        if (p) this.drawPiece(r, c, p);
      }
    }

    // corner terrain glyph on occupied cells (terrain stays visible)
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (!state.pieces[r][c]) continue;
        const x = c * cell, y = r * cell;
        ctx.font = Math.floor(cell * 0.30) + 'px ' + GLYPH_FONT;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = 'rgba(20,20,30,0.78)';
        ctx.fillText(GLYPH[state.terrain[r][c]], x + cell * 0.06, y + cell * 0.04);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
      }
    }

    // capture rings (over pieces so they encircle the target)
    if (vis) this.drawMarkers(vis.moves, true);

    // selection / inspect outline
    if (vis) {
      const col = vis.kind === 'inspect' ? '#3a86e8' : '#e8b53a';
      this.outlineCell(vis.origin, col, vis.kind === 'inspect');
    }

    this.drawCoords();
  }

  private tintCell(pos: Coord, color: string): void {
    const { ctx, cell } = this;
    ctx.fillStyle = color;
    ctx.fillRect(pos.c * cell, pos.r * cell, cell, cell);
  }

  private drawRays(rays: Ray[]): void {
    if (!rays.length) return;
    const { ctx, cell } = this;
    ctx.save();
    ctx.strokeStyle = 'rgba(60,170,100,0.55)';
    ctx.lineWidth = Math.max(3, cell * 0.05);
    ctx.lineCap = 'round';
    for (const ray of rays) {
      const a = this.center(ray.from.r, ray.from.c);
      const b = this.center(ray.to.r, ray.to.c);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawMarkers(moves: Move[], captureLayer: boolean): void {
    const { ctx, cell } = this;
    for (const m of moves) {
      const ct = this.center(m.r, m.c);
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
  }

  private drawPiece(r: number, c: number, side: string): void {
    const { ctx, cell } = this;
    const ct = this.center(r, c);
    const rad = cell * 0.28;
    ctx.beginPath();
    ctx.arc(ct.x, ct.y + 2, rad, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(ct.x, ct.y, rad, 0, Math.PI * 2);
    if (side === WHITE) {
      ctx.fillStyle = '#fafafa'; ctx.fill();
      ctx.lineWidth = Math.max(2.5, cell * 0.035); ctx.strokeStyle = '#1b1b22';
    } else {
      ctx.fillStyle = '#1b1b22'; ctx.fill();
      ctx.lineWidth = Math.max(2, cell * 0.03); ctx.strokeStyle = '#f4f4f6';
    }
    ctx.stroke();
  }

  private outlineCell(pos: Coord, color: string, dashed: boolean): void {
    const { ctx, cell } = this;
    const pad = cell * 0.05;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(3, cell * 0.045);
    if (dashed) ctx.setLineDash([cell * 0.12, cell * 0.08]);
    ctx.strokeRect(pos.c * cell + pad, pos.r * cell + pad, cell - 2 * pad, cell - 2 * pad);
    ctx.restore();
  }

  private drawCoords(): void {
    const { ctx, cell } = this;
    ctx.font = Math.floor(cell * 0.14) + 'px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(30,30,40,0.55)';
    for (let c = 0; c < N; c++) {
      ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
      ctx.fillText(String.fromCharCode(97 + c), (c + 1) * cell - 3, this.size - 3);
    }
    for (let r = 0; r < N; r++) {
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(String(N - r), 3, r * cell + 2);
    }
  }
}

export const squareName = (r: number, c: number): string =>
  String.fromCharCode(97 + c) + String(N - r);
