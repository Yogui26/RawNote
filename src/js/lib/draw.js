// Zone de dessin en grille de caractères : lignes, flèches, formes, texte.
// Les traits sont stockés sous forme de masques de directions pour que les
// croisements et jonctions (┼ ├ ┬ …) soient calculés automatiquement.

import { UP, RIGHT, DOWN, LEFT, LIGHT, DOUBLE, ROUND, ARROWS, REV, toAscii } from './chars.js';
import { charWidth, expandTabs, strWidth } from './width.js';

const CONT = '\0'; // seconde cellule d'un caractère large

export class Grid {
  constructor(w = 40, h = 16) {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this._alloc();
  }

  _alloc() {
    const n = this.w * this.h;
    this.light = new Uint8Array(n);
    this.dbl = new Uint8Array(n);
    this.rnd = new Uint8Array(n);
    this.ch = new Array(n).fill('');
  }

  clone() {
    const g = new Grid(this.w, this.h);
    g.light.set(this.light);
    g.dbl.set(this.dbl);
    g.rnd.set(this.rnd);
    g.ch = this.ch.slice();
    return g;
  }

  resize(w, h) {
    const g = new Grid(w, h);
    const mw = Math.min(w, this.w);
    const mh = Math.min(h, this.h);
    for (let y = 0; y < mh; y++) {
      for (let x = 0; x < mw; x++) {
        const a = y * this.w + x;
        const b = y * g.w + x;
        g.light[b] = this.light[a];
        g.dbl[b] = this.dbl[a];
        g.rnd[b] = this.rnd[a];
        g.ch[b] = this.ch[a];
      }
    }
    this.w = g.w;
    this.h = g.h;
    this.light = g.light;
    this.dbl = g.dbl;
    this.rnd = g.rnd;
    this.ch = g.ch;
  }

  ensure(w, h) {
    if (w > this.w || h > this.h) this.resize(Math.max(w, this.w), Math.max(h, this.h));
  }

  inb(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  idx(x, y) {
    return y * this.w + x;
  }

  isEmptyAt(x, y) {
    const i = this.idx(x, y);
    return !this.light[i] && !this.dbl[i] && !this.ch[i];
  }

  clearCell(x, y) {
    if (!this.inb(x, y)) return;
    const i = this.idx(x, y);
    const c = this.ch[i];
    if (c === CONT && x > 0) this.ch[i - 1] = '';
    else if (c && c !== CONT && charWidth(c.codePointAt(0)) === 2 && x + 1 < this.w && this.ch[i + 1] === CONT) this.ch[i + 1] = '';
    this.light[i] = 0;
    this.dbl[i] = 0;
    this.rnd[i] = 0;
    this.ch[i] = '';
  }

  /** Pose un caractère littéral (texte, pointe de flèche…) ; les largeurs nulles sont ignorées. */
  putChar(x, y, c) {
    if (!this.inb(x, y)) return;
    const w = charWidth(c.codePointAt(0));
    if (w === 0) return;
    if (w === 2 && x + 1 >= this.w) return;
    this.clearCell(x, y);
    this.ch[this.idx(x, y)] = c;
    if (w === 2) {
      this.clearCell(x + 1, y);
      this.ch[this.idx(x + 1, y)] = CONT;
    }
  }

  addMask(x, y, bits, double = false) {
    if (!this.inb(x, y)) return;
    const i = this.idx(x, y);
    if (this.ch[i]) this.clearCell(x, y);
    if (double) this.dbl[i] |= bits;
    else this.light[i] |= bits;
  }

  charAt(x, y) {
    const i = this.idx(x, y);
    const c = this.ch[i];
    if (c) return c === CONT ? '' : c;
    const d = this.dbl[i];
    const l = this.light[i];
    if (d) return DOUBLE[d | l] || DOUBLE[d] || ' ';
    if (l) return (this.rnd[i] && ROUND[l]) || LIGHT[l] || ' ';
    return ' ';
  }

  bbox() {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -1;
    let y1 = -1;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (!this.isEmptyAt(x, y)) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    return x1 < 0 ? null : { x0, y0, x1, y1 };
  }

  /** Lignes de texte du dessin (rognées au contenu par défaut). */
  toLines({ ascii = false, trim = true } = {}) {
    let box = { x0: 0, y0: 0, x1: this.w - 1, y1: this.h - 1 };
    if (trim) {
      box = this.bbox();
      if (!box) return [];
    }
    const lines = [];
    for (let y = box.y0; y <= box.y1; y++) {
      let s = '';
      for (let x = box.x0; x <= box.x1; x++) s += this.charAt(x, y);
      s = s.replace(/\s+$/, '');
      lines.push(ascii ? toAscii(s) : s);
    }
    return lines;
  }

  /** Charge des lignes de texte existantes (traits de cadre reconnus, le reste en texte). */
  static fromLines(lines, minW = 0, minH = 0) {
    const rows = lines.map((l) => Array.from(expandTabs(l)));
    const width = Math.max(0, ...rows.map((r) => r.reduce((a, c) => a + charWidth(c.codePointAt(0)), 0)));
    const g = new Grid(Math.max(minW, width), Math.max(minH, rows.length));
    rows.forEach((chars, y) => {
      let x = 0;
      for (const c of chars) {
        const w = charWidth(c.codePointAt(0));
        if (w === 0) continue;
        if (c !== ' ') {
          const info = REV[c];
          if (info) {
            const i = g.idx(x, y);
            if (info.kind === 'double') g.dbl[i] |= info.mask;
            else {
              g.light[i] |= info.mask;
              if (info.kind === 'round') g.rnd[i] = 1;
            }
          } else {
            g.putChar(x, y, c);
          }
        }
        x += w;
      }
    });
    return g;
  }
}

// ---------- traits ----------

const DIRS = {
  r: { next: RIGHT, prev: LEFT, ch: ARROWS.r },
  l: { next: LEFT, prev: RIGHT, ch: ARROWS.l },
  d: { next: DOWN, prev: UP, ch: ARROWS.d },
  u: { next: UP, prev: DOWN, ch: ARROWS.u },
};

function dirOf(a, b) {
  if (a.y === b.y) return b.x > a.x ? 'r' : 'l';
  return b.y > a.y ? 'd' : 'u';
}

function segment(g, a, b, double) {
  if (a.x === b.x && a.y === b.y) return;
  const d = DIRS[dirOf(a, b)];
  const dx = Math.sign(b.x - a.x);
  const dy = Math.sign(b.y - a.y);
  let x = a.x;
  let y = a.y;
  for (;;) {
    let bits = 0;
    if (x !== a.x || y !== a.y) bits |= d.prev;
    if (x !== b.x || y !== b.y) bits |= d.next;
    g.addMask(x, y, bits, double);
    if (x === b.x && y === b.y) break;
    x += dx;
    y += dy;
  }
}

/**
 * Trace une polyligne à angles droits.
 * @param {{double?:boolean, arrow?:'none'|'end'|'start'|'both'}} opts
 */
export function polyline(g, pts, { double = false, arrow = 'none' } = {}) {
  const p = pts.filter((pt, i) => i === 0 || pt.x !== pts[i - 1].x || pt.y !== pts[i - 1].y);
  if (p.length < 2) return;
  for (let i = 0; i < p.length - 1; i++) segment(g, p[i], p[i + 1], double);
  if (arrow === 'end' || arrow === 'both') {
    const last = p[p.length - 1];
    g.putChar(last.x, last.y, DIRS[dirOf(p[p.length - 2], last)].ch);
  }
  if (arrow === 'start' || arrow === 'both') {
    const first = p[0];
    g.putChar(first.x, first.y, DIRS[dirOf(p[1], first)].ch);
  }
}

/** Ligne droite : suit l'axe dominant du déplacement a -> b. */
export function line(g, a, b, opts = {}) {
  if (a.x === b.x && a.y === b.y) return;
  const horizontal = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
  polyline(g, [a, horizontal ? { x: b.x, y: a.y } : { x: a.x, y: b.y }], opts);
}

/** Ligne coudée : a -> coin -> b (horizontal d'abord, ou vertical d'abord avec first:'v'). */
export function elbow(g, a, b, opts = {}) {
  if (a.x === b.x || a.y === b.y) return line(g, a, b, opts);
  const corner = opts.first === 'v' ? { x: a.x, y: b.y } : { x: b.x, y: a.y };
  return polyline(g, [a, corner, b], opts);
}

// ---------- formes ----------

export function rect(g, x0, y0, x1, y1, { double = false, round = false } = {}) {
  const xa = Math.min(x0, x1);
  const xb = Math.max(x0, x1);
  const ya = Math.min(y0, y1);
  const yb = Math.max(y0, y1);
  if (xa === xb || ya === yb) {
    line(g, { x: xa, y: ya }, { x: xb, y: yb }, { double });
    return;
  }
  polyline(g, [{ x: xa, y: ya }, { x: xb, y: ya }, { x: xb, y: yb }, { x: xa, y: yb }, { x: xa, y: ya }], { double });
  if (round && !double) {
    for (const [x, y] of [[xa, ya], [xb, ya], [xa, yb], [xb, yb]]) g.rnd[g.idx(x, y)] = 1;
  }
}

/** Contour d'un losange inscrit dans un rectangle de w × h cellules. */
export function diamondGeometry(w, h) {
  const c = (w - 1) / 2;
  const even = h % 2 === 0;
  const k = h / 2;
  const mid = (h - 1) / 2;
  const rows = [];
  for (let y = 0; y < h; y++) {
    const dd = even ? (y < k ? k - 1 - y : y - k) : Math.abs(y - mid);
    const denom = even ? k : mid + 1;
    const t = 1 - dd / denom;
    let l = Math.round(c - c * t);
    let r = Math.round(c + c * t);
    if (r <= l) {
      if (r + 1 < w) r = l + 1;
      else l = r - 1;
    }
    const top = y < h / 2; // pour h impair, la ligne centrale est traitée par `middle`
    const middle = !even && y === mid;
    rows.push({ l, r, lc: middle ? '<' : top ? '/' : '\\', rc: middle ? '>' : top ? '\\' : '/' });
  }
  return rows;
}

export function diamond(g, x0, y0, x1, y1, { fill = false } = {}) {
  const xa = Math.min(x0, x1);
  const ya = Math.min(y0, y1);
  const w = Math.abs(x1 - x0) + 1;
  const h = Math.abs(y1 - y0) + 1;
  if (w < 3 || h < 2) return;
  const geo = diamondGeometry(w, h);
  geo.forEach((row, y) => {
    if (fill) for (let x = row.l + 1; x < row.r; x++) g.clearCell(xa + x, ya + y);
    g.putChar(xa + row.l, ya + y, row.lc);
    g.putChar(xa + row.r, ya + y, row.rc);
  });
}

// ---------- texte ----------

/** Écrit du texte multiligne en (x, y) ; les espaces laissent le fond intact. */
export function textBlock(g, x, y, text) {
  String(text).split('\n').forEach((lineText, j) => {
    let cx = x;
    for (const ch of expandTabs(lineText)) {
      const w = charWidth(ch.codePointAt(0));
      if (w === 0) continue;
      if (ch !== ' ') g.putChar(cx, y + j, ch);
      cx += w;
    }
  });
}

export function clearRect(g, x0, y0, x1, y1) {
  for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) g.clearCell(x, y);
  }
}

/** Dimensions d'un bloc de texte entouré d'une forme (process, terminal, décision). */
export function autoBoxSize(text, kind = 'process') {
  const lines = String(text).split('\n').map((l) => expandTabs(l).trimEnd());
  const widths = lines.map(strWidth);
  const tw = Math.max(1, ...widths);
  const th = lines.length;
  if (kind !== 'decision') return { w: tw + 4, h: th + 2, lines, widths, tw, th };

  for (let k = Math.max(2, Math.ceil((th + 2) / 2)); k < 200; k++) {
    const h = 2 * k;
    const w = Math.max(4 * k - 2, tw + 4);
    const geo = diamondGeometry(w, h);
    const y0 = Math.floor((h - th) / 2);
    let ok = true;
    for (let j = 0; j < th && ok; j++) {
      const row = geo[y0 + j];
      if (row.r - row.l - 1 < widths[j] + 2) ok = false;
    }
    if (ok) return { w, h, lines, widths, tw, th };
  }
  return { w: tw + 8, h: th + 4, lines, widths, tw, th };
}

/**
 * Dessine une forme avec son texte, coin supérieur gauche en (x, y).
 * @param {'process'|'terminator'|'decision'} kind
 */
export function autoBox(g, x, y, text, kind = 'process', { double = false } = {}) {
  const size = autoBoxSize(text, kind);
  g.ensure(x + size.w, y + size.h);
  const { w, h, lines, widths, tw, th } = size;
  if (kind === 'decision') {
    diamond(g, x, y, x + w - 1, y + h - 1, { fill: true });
    const y0 = y + Math.floor((h - th) / 2);
    lines.forEach((l, j) => {
      const row = diamondGeometry(w, h)[y0 - y + j];
      const inner = row.r - row.l - 1;
      textBlock(g, x + row.l + 1 + Math.floor((inner - widths[j]) / 2), y0 + j, l);
    });
  } else {
    clearRect(g, x + 1, y + 1, x + w - 2, y + h - 2);
    rect(g, x, y, x + w - 1, y + h - 1, { double, round: kind === 'terminator' });
    lines.forEach((l, j) => textBlock(g, x + 2 + Math.floor((tw - widths[j]) / 2), y + 1 + j, l));
  }
  return { x, y, w, h };
}

// ---------- sélection / déplacement ----------

export function extract(g, x0, y0, x1, y1) {
  const xa = Math.min(x0, x1);
  const ya = Math.min(y0, y1);
  const w = Math.abs(x1 - x0) + 1;
  const h = Math.abs(y1 - y0) + 1;
  const sub = new Grid(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!g.inb(xa + x, ya + y)) continue;
      const a = g.idx(xa + x, ya + y);
      const b = sub.idx(x, y);
      sub.light[b] = g.light[a];
      sub.dbl[b] = g.dbl[a];
      sub.rnd[b] = g.rnd[a];
      sub.ch[b] = g.ch[a];
    }
  }
  return sub;
}

/** Colle `sub` en (x, y) : seules les cellules non vides remplacent le fond. */
export function stamp(g, sub, x, y) {
  for (let j = 0; j < sub.h; j++) {
    for (let i = 0; i < sub.w; i++) {
      const s = sub.idx(i, j);
      if (!sub.light[s] && !sub.dbl[s] && !sub.ch[s]) continue;
      const tx = x + i;
      const ty = y + j;
      if (!g.inb(tx, ty)) continue;
      g.clearCell(tx, ty);
      const t = g.idx(tx, ty);
      g.light[t] = sub.light[s];
      g.dbl[t] = sub.dbl[s];
      g.rnd[t] = sub.rnd[s];
      g.ch[t] = sub.ch[s];
    }
  }
}
