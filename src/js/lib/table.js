// Tableaux en texte brut : génération et relecture.

import { TABLE_STYLES } from './chars.js';
import { strWidth, padAlign, wrapText, sliceCols, expandTabs } from './width.js';

/**
 * Modèle de tableau :
 *  cells:     string[][]            contenu (les cellules peuvent contenir des \n)
 *  colWidths: (number|null)[]       largeur de contenu par colonne, null = automatique
 *  aligns:    ('l'|'c'|'r')[]       alignement du texte par colonne
 *  style:     'single'|'rounded'|'double'|'ascii'
 *  rowLines:  'all'|'none'          séparateur entre toutes les lignes ou aucun
 *  header:    boolean               séparateur renforcé sous la première ligne
 */
export function createTable(rows = 3, cols = 3, style = 'single') {
  return normalize({
    cells: Array.from({ length: rows }, () => Array.from({ length: cols }, () => '')),
    colWidths: [],
    aligns: [],
    style,
    rowLines: 'all',
    header: false,
  });
}

export function normalize(model) {
  const cols = Math.max(1, ...model.cells.map((r) => r.length), model.colWidths?.length || 0);
  const cells = model.cells.length ? model.cells.map((r) => Array.from({ length: cols }, (_, i) => String(r[i] ?? ''))) : [Array(cols).fill('')];
  return {
    cells,
    colWidths: Array.from({ length: cols }, (_, i) => {
      const w = model.colWidths?.[i];
      return w && w > 0 ? Math.floor(w) : null;
    }),
    aligns: Array.from({ length: cols }, (_, i) => model.aligns?.[i] || 'l'),
    style: TABLE_STYLES[model.style] ? model.style : 'single',
    rowLines: model.rowLines === 'none' ? 'none' : 'all',
    header: !!model.header,
  };
}

export function insertRow(model, at) {
  const m = normalize(model);
  m.cells.splice(at, 0, Array(m.colWidths.length).fill(''));
  return m;
}

export function removeRow(model, at) {
  const m = normalize(model);
  if (m.cells.length > 1) m.cells.splice(at, 1);
  return m;
}

export function insertCol(model, at) {
  const m = normalize(model);
  m.cells.forEach((r) => r.splice(at, 0, ''));
  m.colWidths.splice(at, 0, null);
  m.aligns.splice(at, 0, 'l');
  return m;
}

export function removeCol(model, at) {
  const m = normalize(model);
  if (m.colWidths.length > 1) {
    m.cells.forEach((r) => r.splice(at, 1));
    m.colWidths.splice(at, 1);
    m.aligns.splice(at, 1);
  }
  return m;
}

function cellLines(text, width) {
  if (width) return wrapText(text, width);
  return String(text).split('\n').map((l) => expandTabs(l).trimEnd());
}

/** Largeurs effectives des colonnes (contenu seul, hors marges). */
export function columnWidths(model) {
  const m = normalize(model);
  return m.colWidths.map((w, c) => {
    if (w) return w;
    let max = 1;
    for (const row of m.cells) for (const l of cellLines(row[c], null)) max = Math.max(max, strWidth(l));
    return max;
  });
}

/** Produit les lignes de texte du tableau. */
export function renderTable(model, { indent = 0 } = {}) {
  const m = normalize(model);
  const S = TABLE_STYLES[m.style];
  const widths = columnWidths(m);
  const pad = ' '.repeat(indent);

  const border = (l, h, j, r) => l + widths.map((w) => h.repeat(w + 2)).join(j) + r;
  const top = border(S.tl, S.h, S.tj, S.tr);
  const bottom = border(S.bl, S.h, S.bj, S.br);
  const sep = border(S.lj, S.h, S.x, S.rj);
  const hsep = border(S.hl, S.hh, S.hx, S.hr);

  const out = [top];
  m.cells.forEach((row, r) => {
    const lines = row.map((txt, c) => cellLines(txt, m.colWidths[c]));
    const height = Math.max(1, ...lines.map((l) => l.length));
    for (let k = 0; k < height; k++) {
      out.push(S.v + lines.map((l, c) => ` ${padAlign(l[k] ?? '', widths[c], m.aligns[c])} `).join(S.v) + S.v);
    }
    if (r < m.cells.length - 1) {
      if (m.header && r === 0) out.push(hsep);
      else if (m.rowLines === 'all') out.push(sep);
    }
  });
  out.push(bottom);
  return out.map((l) => pad + l);
}

// ---------- relecture ----------

function detectStyle(firstChar) {
  for (const [name, S] of Object.entries(TABLE_STYLES)) if (S.tl === firstChar) return name;
  return null;
}

const FIRST_CHARS = new Set(['┌', '├', '└', '╞', '│', '╔', '╠', '╚', '╟', '║', '╭', '╰', '+', '|']);

function columnOf(line, chars) {
  const pos = [];
  let col = 0;
  for (const ch of line) {
    if (chars.has(ch)) pos.push(col);
    col += strWidth(ch);
  }
  return pos;
}

/**
 * Relit un tableau produit par renderTable. Retourne null si les lignes ne forment
 * pas un tableau reconnu.
 * @returns {(ReturnType<typeof normalize> & {indent:number}) | null}
 */
export function parseTable(lines) {
  if (lines.length < 3) return null;
  const src = lines.map((l) => expandTabs(l).trimEnd());
  const indent = src[0].length - src[0].trimStart().length;
  const ls = src.map((l) => (l.startsWith(' '.repeat(indent)) ? l.slice(indent) : null));
  if (ls.some((l) => l === null)) return null;

  const styleName = detectStyle(ls[0][0]);
  if (!styleName) return null;
  const S = TABLE_STYLES[styleName];
  const borderChars = new Set([S.tl, S.tr, S.bl, S.br, S.h, S.tj, S.bj, S.lj, S.rj, S.x, S.hl, S.hh, S.hx, S.hr]);
  const startChars = new Set([S.tl, S.bl, S.lj, S.hl]);

  const isBorder = (l) => l.length > 0 && startChars.has(l[0]) && [...l].every((c) => borderChars.has(c));
  const isContent = (l) => l.length > 1 && l[0] === S.v && l[l.length - 1] === S.v;

  if (!isBorder(ls[0]) || ls[0][0] !== S.tl) return null;
  const last = ls[ls.length - 1];
  if (!isBorder(last) || last[0] !== S.bl) return null;

  const cuts = columnOf(ls[0], new Set([S.tl, S.tj, S.tr]));
  if (cuts.length < 2) return null;
  const bottomCuts = columnOf(last, new Set([S.bl, S.bj, S.br]));
  if (bottomCuts.join() !== cuts.join()) return null;
  const nCols = cuts.length - 1;

  // groupes de lignes de contenu séparés par des lignes de séparation
  const groups = [[]];
  const seps = [];
  for (let i = 1; i < ls.length - 1; i++) {
    const l = ls[i];
    if (isBorder(l)) {
      const hdr = S.hh !== S.h && l.includes(S.hh);
      if (columnOf(l, new Set([S.lj, S.x, S.rj, S.hl, S.hx, S.hr])).join() !== cuts.join()) return null;
      seps.push({ header: hdr, afterGroup: groups.length - 1 });
      groups.push([]);
    } else if (isContent(l)) {
      groups[groups.length - 1].push(l);
    } else {
      return null;
    }
  }
  if (groups.some((g) => !g.length)) return null;

  // découpage des lignes de contenu en cellules
  const votes = Array.from({ length: nCols }, () => ({ l: 0, c: 0, r: 0 }));
  const splitLine = (l) => {
    for (const p of cuts) if (sliceCols(l, p, p + 1) !== S.v) return null;
    return cuts.slice(0, -1).map((p, c) => {
      let raw = sliceCols(l, p + 1, cuts[c + 1]);
      if (raw.startsWith(' ')) raw = raw.slice(1);
      if (raw.endsWith(' ')) raw = raw.slice(0, -1);
      const lead = raw.length - raw.trimStart().length;
      const trail = raw.length - raw.trimEnd().length;
      const text = raw.trim();
      if (text) {
        if (lead === 0 && trail > 0) votes[c].l++;
        else if (trail === 0 && lead > 0) votes[c].r++;
        else if (lead > 0 && trail > 0 && Math.abs(lead - trail) <= 1) votes[c].c++;
      }
      return text;
    });
  };

  const groupRows = groups.map((g) => g.map(splitLine));
  if (groupRows.some((g) => g.some((r) => r === null))) return null;

  const header = seps.length > 0 && seps[0].header && seps[0].afterGroup === 0;
  const normalSeps = seps.filter((s, i) => !(i === 0 && header));
  const rowLines = normalSeps.length > 0 ? 'all' : 'none';

  const cells = [];
  groupRows.forEach((g, gi) => {
    const oneRowPerGroup = rowLines === 'all' || (header && gi === 0);
    if (oneRowPerGroup) {
      cells.push(Array.from({ length: nCols }, (_, c) => g.map((r) => r[c]).join('\n').replace(/^\n+|\n+$/g, '')));
    } else {
      for (const r of g) cells.push(r);
    }
  });

  return {
    cells,
    colWidths: cuts.slice(0, -1).map((p, c) => Math.max(1, cuts[c + 1] - p - 1 - 2)),
    aligns: votes.map((v) => (v.r > v.l && v.r >= v.c ? 'r' : v.c > v.l && v.c > v.r ? 'c' : 'l')),
    style: styleName,
    rowLines,
    header,
    indent,
  };
}

/** Cherche le bloc de tableau contenant la ligne `idx`. */
export function findTableBlock(lines, idx) {
  const isT = (l) => l !== undefined && l.trim() !== '' && FIRST_CHARS.has(l.trimStart()[0]);
  if (!isT(lines[idx])) return null;
  let a = idx;
  let b = idx;
  while (a > 0 && isT(lines[a - 1])) a--;
  while (b < lines.length - 1 && isT(lines[b + 1])) b++;
  const model = parseTable(lines.slice(a, b + 1));
  return model ? { start: a, end: b, model } : null;
}
