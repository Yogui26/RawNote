// Largeur d'affichage en colonnes (approximation de wcwidth) et utilitaires de texte.

const ZERO = [
  [0x0300, 0x036f], [0x0483, 0x0489], [0x0591, 0x05bd], [0x200b, 0x200f],
  [0x202a, 0x202e], [0x2060, 0x2064], [0x20d0, 0x20ff], [0xfe00, 0xfe0f],
  [0xfe20, 0xfe2f], [0xe0100, 0xe01ef],
];

const WIDE = [
  [0x1100, 0x115f], [0x231a, 0x231b], [0x2329, 0x232a], [0x23e9, 0x23ec],
  [0x23f0, 0x23f0], [0x23f3, 0x23f3], [0x25fd, 0x25fe], [0x2614, 0x2615],
  [0x2648, 0x2653], [0x267f, 0x267f], [0x2693, 0x2693], [0x26a1, 0x26a1],
  [0x26aa, 0x26ab], [0x26bd, 0x26be], [0x26c4, 0x26c5], [0x26ce, 0x26ce],
  [0x26d4, 0x26d4], [0x26ea, 0x26ea], [0x26f2, 0x26f3], [0x26f5, 0x26f5],
  [0x26fa, 0x26fa], [0x26fd, 0x26fd], [0x2705, 0x2705], [0x270a, 0x270b],
  [0x2728, 0x2728], [0x274c, 0x274c], [0x274e, 0x274e], [0x2753, 0x2755],
  [0x2757, 0x2757], [0x2795, 0x2797], [0x27b0, 0x27b0], [0x27bf, 0x27bf],
  [0x2b1b, 0x2b1c], [0x2b50, 0x2b50], [0x2b55, 0x2b55], [0x2e80, 0x303e],
  [0x3041, 0x33ff], [0x3400, 0x4dbf], [0x4e00, 0xa4cf], [0xa960, 0xa97f],
  [0xac00, 0xd7a3], [0xf900, 0xfaff], [0xfe10, 0xfe19], [0xfe30, 0xfe6f],
  [0xff00, 0xff60], [0xffe0, 0xffe6], [0x1f300, 0x1f64f], [0x1f680, 0x1f6ff],
  [0x1f900, 0x1f9ff], [0x20000, 0x3fffd],
];

function inRanges(cp, ranges) {
  for (const [a, b] of ranges) if (cp >= a && cp <= b) return true;
  return false;
}

export function charWidth(cp) {
  if (cp < 32 || (cp >= 0x7f && cp < 0xa0)) return 0;
  if (cp < 0x300) return 1;
  if (inRanges(cp, ZERO)) return 0;
  if (inRanges(cp, WIDE)) return 2;
  return 1;
}

export function strWidth(s) {
  let w = 0;
  for (const ch of s) w += charWidth(ch.codePointAt(0));
  return w;
}

export function maxWidth(lines) {
  let m = 0;
  for (const l of lines) m = Math.max(m, strWidth(l));
  return m;
}

export function expandTabs(s, size = 4) {
  if (!s.includes('\t')) return s;
  let out = '';
  let col = 0;
  for (const ch of s) {
    if (ch === '\t') {
      const n = size - (col % size);
      out += ' '.repeat(n);
      col += n;
    } else {
      out += ch;
      col += charWidth(ch.codePointAt(0));
    }
  }
  return out;
}

/** Complète `s` avec des espaces jusqu'à la largeur `w` ('l' gauche, 'c' centre, 'r' droite). */
export function padAlign(s, w, align = 'l') {
  const gap = w - strWidth(s);
  if (gap <= 0) return s;
  if (align === 'r') return ' '.repeat(gap) + s;
  if (align === 'c') {
    const left = Math.floor(gap / 2);
    return ' '.repeat(left) + s + ' '.repeat(gap - left);
  }
  return s + ' '.repeat(gap);
}

/** Sous-chaîne couvrant les colonnes d'affichage [from, to). */
export function sliceCols(s, from, to) {
  let col = 0;
  let out = '';
  for (const ch of s) {
    const w = charWidth(ch.codePointAt(0));
    if (col >= from && col < to) out += ch;
    col += w;
    if (col >= to && w > 0) break;
  }
  return out;
}

function breakWord(word, width) {
  const chunks = [];
  let cur = '';
  let cw = 0;
  for (const ch of word) {
    const w = charWidth(ch.codePointAt(0));
    if (cw + w > width && cur) {
      chunks.push(cur);
      cur = '';
      cw = 0;
    }
    cur += ch;
    cw += w;
  }
  if (cur) chunks.push(cur);
  return chunks;
}

/** Retour à la ligne automatique à `width` colonnes ; conserve les sauts de ligne explicites. */
export function wrapText(text, width) {
  width = Math.max(1, width | 0);
  const out = [];
  for (const para of String(text).split('\n')) {
    const words = expandTabs(para).trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      out.push('');
      continue;
    }
    let line = '';
    let lw = 0;
    for (const word of words) {
      const ww = strWidth(word);
      if (ww > width) {
        if (line) out.push(line);
        const chunks = breakWord(word, width);
        for (let i = 0; i < chunks.length - 1; i++) out.push(chunks[i]);
        line = chunks[chunks.length - 1];
        lw = strWidth(line);
      } else if (!line) {
        line = word;
        lw = ww;
      } else if (lw + 1 + ww <= width) {
        line += ' ' + word;
        lw += 1 + ww;
      } else {
        out.push(line);
        line = word;
        lw = ww;
      }
    }
    out.push(line);
  }
  return out;
}
