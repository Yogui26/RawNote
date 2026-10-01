// Listes à puces / numérotées / lettrées / romaines, sur plusieurs niveaux.
// Tout est exprimé en tableaux de lignes (aucun accès au DOM).

import { expandTabs } from './width.js';

export const INDENT = 3;
export const BULLETS = { unicode: ['•', '◦', '▪'], ascii: ['-', '*', '+'] };
const BULLET_CHARS = new Set(['-', '*', '+', '•', '◦', '▪', '‣', '–']);

export const KINDS = ['bullet', 'num', 'alpha', 'roman', 'outline', 'legal'];

// ---------- conversions ----------

export function toRoman(n) {
  const table = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'],
    [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']];
  let out = '';
  for (const [v, s] of table) {
    while (n >= v) {
      out += s;
      n -= v;
    }
  }
  return out;
}

export function fromRoman(s) {
  const map = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 };
  let total = 0;
  s = s.toLowerCase();
  for (let i = 0; i < s.length; i++) {
    const v = map[s[i]];
    if (!v) return 0;
    const next = map[s[i + 1]] || 0;
    total += v < next ? -v : v;
  }
  return total;
}

export function toAlpha(n) {
  let s = '';
  while (n > 0) {
    n--;
    s = String.fromCharCode(97 + (n % 26)) + s;
    n = Math.floor(n / 26);
  }
  return s;
}

export function fromAlpha(s) {
  let n = 0;
  for (const ch of s.toLowerCase()) n = n * 26 + (ch.charCodeAt(0) - 96);
  return n;
}

// ---------- analyse d'une ligne ----------

function isRomanToken(tok) {
  const m = /^([ivxlcdm]+|[IVXLCDM]+)[.)]$/.exec(tok);
  if (!m) return false;
  const n = fromRoman(m[1]);
  return n > 0 && toRoman(n) === m[1].toLowerCase();
}

/**
 * Analyse une ligne. Retourne null si ce n'est pas un élément de liste.
 * @returns {{indent:number, level:number, marker:string, type:string, text:string}|null}
 */
export function parseItem(line) {
  const l = expandTabs(line);
  const m = /^( *)(\S+)(?: +(.*))?$/.exec(l);
  if (!m) return null;
  const [, sp, tok, rest = ''] = m;
  let type = null;
  if (BULLET_CHARS.has(tok)) type = 'bullet';
  else if (/^\d+[.)]$/.test(tok)) type = 'num';
  else if (/^\d+(\.\d+)+\.?$/.test(tok)) type = 'legal';
  else if (/^[a-zA-Z][.)]$/.test(tok)) type = 'alpha';
  else if (isRomanToken(tok)) type = 'roman';
  if (!type) return null;
  return { indent: sp.length, level: Math.floor(sp.length / INDENT), marker: tok, type, text: rest };
}

export function isListLine(line) {
  return parseItem(line) !== null;
}

function matchesKind(item, kind) {
  if (!item) return false;
  switch (kind) {
    case 'bullet': return item.type === 'bullet';
    case 'num': return item.type === 'num';
    case 'alpha': return item.type === 'alpha';
    case 'roman': return item.type === 'roman' || (item.type === 'alpha' && /^[ivxlcdm][.)]$/.test(item.marker));
    case 'legal': return item.type === 'legal' || item.type === 'num';
    case 'outline': return true;
    default: return false;
  }
}

// ---------- génération des marqueurs ----------

function markerFor(kind, level, counters, bulletSet) {
  const n = counters[level];
  switch (kind) {
    case 'bullet': {
      const set = BULLETS[bulletSet] || BULLETS.unicode;
      return set[level % set.length];
    }
    case 'num': return `${n}.`;
    case 'alpha': return `${toAlpha(n)}.`;
    case 'roman': return `${toRoman(n)}.`;
    case 'legal': return `${counters.slice(0, level + 1).join('.')}.`;
    case 'outline': {
      const t = level % 3;
      return t === 0 ? `${n}.` : t === 1 ? `${toAlpha(n)}.` : `${toRoman(n)}.`;
    }
    default: throw new Error(`Type de liste inconnu : ${kind}`);
  }
}

/**
 * Construit des lignes de liste à partir d'entrées {level, text} (ou {pass} pour
 * une ligne laissée telle quelle) en numérotant selon `kind`.
 */
function build(entries, kind, { bulletSet = 'unicode', start = 1 } = {}) {
  const counters = [];
  const out = [];
  let prev = -1;
  for (const en of entries) {
    if (en.pass !== undefined) {
      out.push(en.pass);
      continue;
    }
    let level = en.level;
    if (prev >= 0) level = Math.min(level, prev + 1);
    counters.length = Math.min(counters.length, level + 1);
    while (counters.length < level) counters.push(1);
    counters[level] = (counters[level] ?? (level === 0 ? start - 1 : 0)) + 1;
    out.push(`${' '.repeat(level * INDENT)}${markerFor(kind, level, counters, bulletSet)} ${en.text}`);
    prev = level;
  }
  return out;
}

const leading = (s) => s.length - s.trimStart().length;

// ---------- API ----------

/** Applique (ou retire si déjà appliqué) un type de liste aux lignes données. */
export function applyList(lines, kind, { bulletSet = 'unicode' } = {}) {
  const idx = lines.map((l, i) => (l.trim() ? i : -1)).filter((i) => i >= 0);
  if (!idx.length) return lines.slice();

  if (idx.every((i) => matchesKind(parseItem(lines[i]), kind))) {
    return lines.map((l) => {
      const it = parseItem(l);
      return it ? ' '.repeat(it.indent) + it.text : l;
    });
  }

  const entries = lines.map((l) => {
    if (!l.trim()) return { pass: l };
    const e = expandTabs(l);
    const it = parseItem(e);
    const indent = leading(e);
    return { level: Math.floor(indent / INDENT), text: it ? it.text : e.trim() };
  });
  return build(entries, kind, { bulletSet, start: 1 });
}

/** Déduit le type de liste, le jeu de puces et le numéro de départ d'un bloc existant. */
export function inferKind(lines) {
  const items = lines.map(parseItem).filter(Boolean);
  if (!items.length) return { kind: 'num', bulletSet: 'unicode', start: 1 };
  const minLevel = Math.min(...items.map((i) => i.level));
  const topItems = items.filter((i) => i.level === minLevel);
  const top = topItems[0];
  const deeper = items.filter((i) => i.level > minLevel);
  let kind;
  let bulletSet = 'unicode';
  let start = 1;

  if (top.type === 'bullet') {
    kind = 'bullet';
    if (['-', '*', '+'].includes(top.marker)) bulletSet = 'ascii';
  } else if (top.type === 'legal') {
    kind = 'legal';
  } else if (top.type === 'num') {
    if (deeper.some((i) => i.type === 'legal')) kind = 'legal';
    else if (deeper.some((i) => i.type === 'num')) kind = 'num';
    else kind = 'outline';
  } else if (top.type === 'roman') {
    kind = 'roman';
  } else {
    // lettre isolée : « i. » est lu comme romain, sauf si la suivante est « j. »
    const second = topItems[1];
    if (top.marker[0].toLowerCase() === 'i' && !(second && second.marker[0].toLowerCase() === 'j')) kind = 'roman';
    else kind = 'alpha';
  }

  const num = top.marker.match(/^\d+/);
  if (kind === 'num' || kind === 'legal' || kind === 'outline') start = num ? Number(num[0]) : 1;
  else if (kind === 'alpha') start = fromAlpha(top.marker[0]) || 1;
  else if (kind === 'roman') start = fromRoman(top.marker.replace(/[.)]$/, '')) || 1;
  return { kind, bulletSet, start };
}

/**
 * Renumérote le bloc de lignes (éléments de liste ; les autres lignes sont conservées).
 */
export function renumber(lines, opts) {
  const info = { ...inferKind(lines), ...opts };
  const entries = lines.map((l) => {
    const it = parseItem(l);
    return it ? { level: it.level, text: it.text } : { pass: l };
  });
  return build(entries, info.kind, info);
}

/** Étend la plage [first, last] au bloc contigu d'éléments de liste puis le renumérote. */
export function reflow(lines, first, last, opts) {
  let a = first;
  let b = last;
  while (a > 0 && isListLine(lines[a - 1])) a--;
  while (b < lines.length - 1 && isListLine(lines[b + 1])) b++;
  const sub = lines.slice(a, b + 1);
  if (!sub.some(isListLine)) return null;
  return { first: a, last: b, lines: renumber(sub, opts) };
}

export function indentLines(lines, n = 1) {
  return lines.map((l) => (l.trim() ? ' '.repeat(n * INDENT) + expandTabs(l) : l));
}

export function outdentLines(lines, n = 1) {
  return lines.map((l) => {
    if (!l.trim()) return l;
    const e = expandTabs(l);
    return e.slice(Math.min(n * INDENT, leading(e)));
  });
}

/**
 * Comportement de la touche Entrée dans une liste.
 * @returns {null | {type:'end', level:number} | {type:'split', lines:string[]}}
 */
export function splitItem(line, caretCol) {
  const e = expandTabs(line);
  const it = parseItem(e);
  if (!it) return null;
  const markerEnd = it.indent + it.marker.length;
  if (caretCol < markerEnd) return null;
  if (it.text.trim() === '') return { type: 'end', level: it.level };
  const textStart = Math.min(e.length, markerEnd + 1);
  const cut = Math.max(caretCol, textStart);
  const before = e.slice(0, cut).trimEnd();
  const after = e.slice(cut).trimStart();
  const placeholder = it.type === 'bullet' ? '•' : '1.';
  return { type: 'split', lines: [before, `${' '.repeat(it.indent)}${placeholder} ${after}`] };
}

/** Retire le marqueur d'une ligne de liste (garde l'indentation du texte). */
export function stripMarker(line) {
  const it = parseItem(line);
  return it ? ' '.repeat(it.indent) + it.text : line;
}

/** Marqueur d'un premier élément vide (pour démarrer une liste sur une ligne vide). */
export function startList(kind, { bulletSet = 'unicode' } = {}) {
  return build([{ level: 0, text: '' }], kind, { bulletSet, start: 1 })[0];
}
