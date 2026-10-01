// Dialogue de dessin : canvas sur grille de caractères (traits, flèches, formes, texte, logigramme).

import {
  Grid, line, elbow, rect, diamond, textBlock, autoBox, clearRect, extract, stamp,
} from '../lib/draw.js';
import { UP, RIGHT, DOWN, LEFT, ROUND } from '../lib/chars.js';
import { strWidth } from '../lib/width.js';
import { askText, toast } from './dialogs.js';

const $ = (id) => document.getElementById(id);
const FONT = '"MonoEmbedded", "DejaVu Sans Mono", ui-monospace, Menlo, Consolas, monospace';
const TEXT_TOOLS = {
  text: { title: 'Texte à placer', kind: null },
  box: { title: 'Texte de l\'étape', kind: 'process' },
  terminator: { title: 'Texte du début / de la fin', kind: 'terminator' },
  decision: { title: 'Question de la décision', kind: 'decision' },
};
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/**
 * @param {string[]|null} initialLines contenu existant à modifier, ou null pour un nouveau dessin
 * @returns {Promise<string[]|null>} lignes du dessin, ou null si annulé
 */
export async function openDrawDialog(initialLines = null) {
  const dlg = $('dlg-draw');
  const canvas = $('dr-canvas');
  const wrap = $('dr-wrap');
  const ctx = canvas.getContext('2d');
  const measure = document.createElement('canvas').getContext('2d');

  try { await document.fonts?.load('16px MonoEmbedded'); } catch { /* police système utilisée */ }

  let grid;
  if (initialLines && initialLines.length) {
    grid = Grid.fromLines(initialLines);
    grid.ensure(Math.max(40, grid.w + 6), Math.max(16, grid.h + 3));
  } else {
    grid = new Grid(60, 24);
  }

  let tool = 'line';
  const opts = { double: false, arrow: 'none', first: 'h', ascii: false };
  let undoStack = [];
  let redoStack = [];
  let sel = null;
  let drag = null;
  let dirty = false;
  let fs = 16;
  let cw = 10;
  let chh = 22;
  let dpr = window.devicePixelRatio || 1;
  let col = {};

  // ---------- affichage ----------
  function readColors() {
    const cs = getComputedStyle(document.documentElement);
    const get = (n) => cs.getPropertyValue(n).trim();
    col = { fg: get('--fg') || '#000', bg: get('--surface') || '#fff', grid: get('--draw-grid') || 'rgba(0,0,0,.1)', sel: get('--draw-sel') || '#0a6cff' };
  }

  function layout() {
    dpr = window.devicePixelRatio || 1;
    measure.font = `${fs}px ${FONT}`;
    cw = measure.measureText('M').width;
    chh = Math.round(fs * 1.35);
    const cssW = Math.ceil(cw * grid.w);
    const cssH = chh * grid.h;
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    canvas.width = Math.ceil(cssW * dpr);
    canvas.height = Math.ceil(cssH * dpr);
    $('dr-w').value = grid.w;
    $('dr-h').value = grid.h;
  }

  function maskPath(m, x, y, rounded) {
    const cx = (x + 0.5) * cw;
    const cy = (y + 0.5) * chh;
    const top = y * chh;
    const bottom = (y + 1) * chh;
    const left = x * cw;
    const right = (x + 1) * cw;
    if (rounded && ROUND[m]) {
      const a = m & UP ? [cx, top] : [cx, bottom];
      const b = m & LEFT ? [left, cy] : [right, cy];
      ctx.moveTo(a[0], a[1]);
      ctx.quadraticCurveTo(cx, cy, b[0], b[1]);
      return;
    }
    if (m & UP) { ctx.moveTo(cx, top); ctx.lineTo(cx, cy); }
    if (m & DOWN) { ctx.moveTo(cx, cy); ctx.lineTo(cx, bottom); }
    if (m & LEFT) { ctx.moveTo(left, cy); ctx.lineTo(cx, cy); }
    if (m & RIGHT) { ctx.moveTo(cx, cy); ctx.lineTo(right, cy); }
  }

  function paint(g = grid, s = sel) {
    const W = cw * g.w;
    const H = chh * g.h;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = col.bg;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = col.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= g.w; x++) { ctx.moveTo(Math.round(x * cw) + 0.5, 0); ctx.lineTo(Math.round(x * cw) + 0.5, H); }
    for (let y = 0; y <= g.h; y++) { ctx.moveTo(0, y * chh + 0.5); ctx.lineTo(W, y * chh + 0.5); }
    ctx.stroke();

    const lw = Math.max(1.2, fs / 11);
    ctx.lineCap = 'square';
    ctx.lineJoin = 'miter';

    ctx.strokeStyle = col.fg;
    ctx.lineWidth = lw;
    ctx.beginPath();
    for (let y = 0; y < g.h; y++) {
      for (let x = 0; x < g.w; x++) {
        const i = y * g.w + x;
        if (g.ch[i] || g.dbl[i] || !g.light[i]) continue;
        maskPath(g.light[i], x, y, g.rnd[i]);
      }
    }
    ctx.stroke();

    // traits doubles : un trait épais recoupé par un trait fin de la couleur du fond
    ctx.beginPath();
    for (let y = 0; y < g.h; y++) {
      for (let x = 0; x < g.w; x++) {
        const i = y * g.w + x;
        if (g.ch[i] || !g.dbl[i]) continue;
        maskPath(g.dbl[i] | g.light[i], x, y, false);
      }
    }
    ctx.lineWidth = lw * 3.4;
    ctx.stroke();
    ctx.strokeStyle = col.bg;
    ctx.lineWidth = lw * 1.2;
    ctx.stroke();

    ctx.fillStyle = col.fg;
    ctx.font = `${fs}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let y = 0; y < g.h; y++) {
      for (let x = 0; x < g.w; x++) {
        const c = g.ch[y * g.w + x];
        if (!c || c === '\0') continue;
        const wide = strWidth(c) === 2;
        ctx.fillText(c, (x + (wide ? 1 : 0.5)) * cw, (y + 0.5) * chh + 1);
      }
    }

    if (s) {
      const x = s.x0 * cw;
      const y = s.y0 * chh;
      const w = (s.x1 - s.x0 + 1) * cw;
      const h = (s.y1 - s.y0 + 1) * chh;
      ctx.fillStyle = col.sel;
      ctx.globalAlpha = 0.12;
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = col.sel;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 3]);
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      ctx.setLineDash([]);
    }
  }

  function relayout() {
    layout();
    paint();
  }

  // ---------- historique ----------
  function updateButtons() {
    dlg.querySelector('[data-dr="undo"]').disabled = !undoStack.length;
    dlg.querySelector('[data-dr="redo"]').disabled = !redoStack.length;
    $('dr-selbtns').hidden = !sel;
  }

  function pushUndo(snapshot = grid) {
    undoStack.push(snapshot.clone());
    if (undoStack.length > 100) undoStack.shift();
    redoStack = [];
    dirty = true;
    updateButtons();
  }

  function undo() {
    if (!undoStack.length) return;
    redoStack.push(grid.clone());
    grid = undoStack.pop();
    sel = null;
    relayout();
    updateButtons();
  }

  function redo() {
    if (!redoStack.length) return;
    undoStack.push(grid.clone());
    grid = redoStack.pop();
    sel = null;
    relayout();
    updateButtons();
  }

  // ---------- outils ----------
  function cellAt(e) {
    const r = canvas.getBoundingClientRect();
    return {
      x: clamp(Math.floor((e.clientX - r.left) / cw), 0, grid.w - 1),
      y: clamp(Math.floor((e.clientY - r.top) / chh), 0, grid.h - 1),
    };
  }

  function applyShape(g, a, b) {
    const o = { double: opts.double, arrow: opts.arrow };
    switch (tool) {
      case 'line': line(g, a, b, o); break;
      case 'elbow': elbow(g, a, b, { ...o, first: opts.first }); break;
      case 'rect': rect(g, a.x, a.y, b.x, b.y, { double: opts.double }); break;
      case 'round': rect(g, a.x, a.y, b.x, b.y, { round: true, double: opts.double }); break;
      case 'diamond': diamond(g, a.x, a.y, b.x, b.y, { fill: true }); break;
      default: break;
    }
  }

  const SHAPE_TOOLS = new Set(['line', 'elbow', 'rect', 'round', 'diamond']);
  const norm = (a, b) => ({ x0: Math.min(a.x, b.x), y0: Math.min(a.y, b.y), x1: Math.max(a.x, b.x), y1: Math.max(a.y, b.y) });
  const inSel = (c) => sel && c.x >= sel.x0 && c.x <= sel.x1 && c.y >= sel.y0 && c.y <= sel.y1;

  function eraseLine(a, b) {
    const dx = Math.abs(b.x - a.x);
    const dy = Math.abs(b.y - a.y);
    const sx = a.x < b.x ? 1 : -1;
    const sy = a.y < b.y ? 1 : -1;
    let err = dx - dy;
    let { x, y } = a;
    for (;;) {
      grid.clearCell(x, y);
      if (x === b.x && y === b.y) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
    }
  }

  function moveSelection(dx, dy, copy = false) {
    if (!sel) return;
    pushUndo();
    const sub = extract(grid, sel.x0, sel.y0, sel.x1, sel.y1);
    if (!copy) clearRect(grid, sel.x0, sel.y0, sel.x1, sel.y1);
    const nx = Math.max(0, sel.x0 + dx);
    const ny = Math.max(0, sel.y0 + dy);
    const nw = nx + sub.w;
    const nh = ny + sub.h;
    if (nw > grid.w || nh > grid.h) { grid.ensure(nw, nh); layout(); }
    stamp(grid, sub, nx, ny);
    sel = { x0: nx, y0: ny, x1: nx + sub.w - 1, y1: ny + sub.h - 1 };
    paint();
  }

  function onDown(e) {
    if (tool === 'pan' || (e.button !== undefined && e.button !== 0)) return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    const c = cellAt(e);
    drag = { start: c, cur: c, copy: e.altKey || e.ctrlKey || e.metaKey, mode: null };
    if (tool === 'erase') {
      pushUndo();
      grid.clearCell(c.x, c.y);
      paint();
    } else if (tool === 'select') {
      if (inSel(c)) {
        drag.mode = 'move';
        drag.lifted = extract(grid, sel.x0, sel.y0, sel.x1, sel.y1);
        drag.base = grid.clone();
        if (!drag.copy) clearRect(drag.base, sel.x0, sel.y0, sel.x1, sel.y1);
        drag.orig = sel;
      } else {
        drag.mode = 'marquee';
        sel = norm(c, c);
        updateButtons();
        paint();
      }
    }
  }

  function onMove(e) {
    const c = cellAt(e);
    $('dr-pos').textContent = `${c.x + 1}, ${c.y + 1}`;
    if (!drag) return;
    const prev = drag.cur;
    drag.cur = c;
    if (c.x === prev.x && c.y === prev.y) return;
    if (tool === 'erase') {
      eraseLine(prev, c);
      paint();
    } else if (tool === 'select') {
      if (drag.mode === 'marquee') {
        sel = norm(drag.start, c);
        paint();
      } else if (drag.mode === 'move') {
        const dx = c.x - drag.start.x;
        const dy = c.y - drag.start.y;
        const g2 = drag.base.clone();
        stamp(g2, drag.lifted, drag.orig.x0 + dx, drag.orig.y0 + dy);
        drag.preview = g2;
        drag.moved = { x0: drag.orig.x0 + dx, y0: drag.orig.y0 + dy, x1: drag.orig.x1 + dx, y1: drag.orig.y1 + dy };
        paint(g2, drag.moved);
      }
    } else if (SHAPE_TOOLS.has(tool)) {
      const g2 = grid.clone();
      applyShape(g2, drag.start, c);
      paint(g2);
    }
  }

  async function onUp(e) {
    if (!drag) return;
    const d = drag;
    drag = null;
    const c = cellAt(e);
    if (tool === 'select') {
      if (d.mode === 'move' && d.preview && (d.moved.x0 !== d.orig.x0 || d.moved.y0 !== d.orig.y0)) {
        pushUndo();
        grid = d.preview;
        sel = d.moved;
      }
      updateButtons();
      paint();
      return;
    }
    if (tool === 'erase') {
      paint();
      return;
    }
    if (SHAPE_TOOLS.has(tool)) {
      if (d.start.x === c.x && d.start.y === c.y) {
        paint();
        return;
      }
      pushUndo();
      applyShape(grid, d.start, c);
      paint();
      return;
    }
    const def = TEXT_TOOLS[tool];
    if (!def) return;
    const val = await askText({ title: def.title, ok: 'Placer', placeholder: def.kind === 'decision' ? 'Ex. : Valide ?' : '' });
    if (val === null || val.trim() === '') return;
    pushUndo();
    if (def.kind) {
      autoBox(grid, c.x, c.y, val, def.kind, { double: opts.double });
    } else {
      const rows = val.split('\n');
      grid.ensure(c.x + Math.max(...rows.map(strWidth)), c.y + rows.length);
      textBlock(grid, c.x, c.y, val);
    }
    layout();
    paint();
  }

  function setTool(t) {
    tool = t;
    if (t !== 'select') sel = null;
    dlg.querySelectorAll('[data-tool]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === t)));
    canvas.classList.toggle('pan', t === 'pan');
    updateButtons();
    paint();
  }

  function resizeGrid() {
    const w = clamp(parseInt($('dr-w').value, 10) || grid.w, 5, 400);
    const h = clamp(parseInt($('dr-h').value, 10) || grid.h, 3, 300);
    if (w === grid.w && h === grid.h) return;
    pushUndo();
    grid.resize(w, h);
    sel = null;
    relayout();
    updateButtons();
  }

  function zoom(delta) {
    fs = clamp(fs + delta, 8, 40);
    relayout();
  }

  function fitZoom() {
    const avail = Math.max(240, wrap.clientWidth - 24);
    fs = clamp(Math.floor(avail / (grid.w * 0.602)), 10, 20);
  }

  const dr = {
    undo, redo,
    'zoom-in': () => zoom(2),
    'zoom-out': () => zoom(-2),
    clear: () => {
      if (grid.bbox() && confirm('Tout effacer dans la zone de dessin ?')) {
        pushUndo();
        clearRect(grid, 0, 0, grid.w - 1, grid.h - 1);
        sel = null;
        paint();
        updateButtons();
      }
    },
    del: () => {
      if (!sel) return;
      pushUndo();
      clearRect(grid, sel.x0, sel.y0, sel.x1, sel.y1);
      paint();
    },
    dup: () => moveSelection(2, 1, true),
  };

  // ---------- cycle de vie ----------
  return new Promise((resolve) => {
    const ac = new AbortController();
    const on = (target, type, fn, o = {}) => target.addEventListener(type, fn, { ...o, signal: ac.signal });

    on(canvas, 'pointerdown', onDown);
    on(canvas, 'pointermove', onMove);
    on(canvas, 'pointerup', onUp);
    on(canvas, 'pointercancel', () => { drag = null; paint(); });

    on(dlg, 'click', (e) => {
      const t = e.target.closest('[data-tool]');
      if (t) { setTool(t.dataset.tool); return; }
      const b = e.target.closest('[data-dr]');
      if (b) { dr[b.dataset.dr]?.(); return; }
      if (e.target.closest('[data-close]')) {
        if (!dirty || confirm('Abandonner le dessin ?')) dlg.close('cancel');
      }
    });
    on(dlg, 'cancel', (e) => {
      if (dirty && !confirm('Abandonner le dessin ?')) e.preventDefault();
    });

    on($('dr-double'), 'change', (e) => { opts.double = e.target.value === '1'; });
    on($('dr-arrow'), 'change', (e) => { opts.arrow = e.target.value; });
    on($('dr-first'), 'change', (e) => { opts.first = e.target.value; });
    on($('dr-ascii'), 'change', (e) => { opts.ascii = e.target.checked; });
    on($('dr-w'), 'change', resizeGrid);
    on($('dr-h'), 'change', resizeGrid);

    on(dlg, 'keydown', (e) => {
      if (e.target.closest('input, select, textarea')) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
      if (!sel) return;
      const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (step) { e.preventDefault(); moveSelection(step[0], step[1], false); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); dr.del(); }
    });

    $('dr-ok').addEventListener('click', () => {
      if (!grid.bbox()) { toast('Le dessin est vide.'); return; }
      dlg.close('ok');
    }, { signal: ac.signal });

    on(dlg, 'close', () => {
      const lines = dlg.returnValue === 'ok' ? grid.toLines({ ascii: opts.ascii }) : null;
      ac.abort();
      resolve(lines);
    });

    // état initial de l'interface
    $('dr-double').value = '0';
    $('dr-arrow').value = 'none';
    $('dr-first').value = 'h';
    $('dr-ascii').checked = false;
    $('dr-pos').textContent = '';
    dlg.returnValue = '';
    dlg.showModal();
    readColors();
    fitZoom();
    setTool(initialLines ? 'select' : 'line');
    relayout();
    updateButtons();
  });
}
