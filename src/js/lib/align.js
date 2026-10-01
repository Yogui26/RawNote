// Alignement de blocs de texte brut (gauche, centre, droite, justifié)
// par rapport à la plus longue ligne du bloc (ou à une largeur imposée).
// Les lignes de tableaux / dessins (caractères de cadre) sont déplacées en bloc,
// sans être retouchées ligne à ligne, pour ne pas casser leur forme.

import { strWidth, expandTabs } from './width.js';

const RIGID_RE = /[┌┐└┘├┤┬┴┼│─╔╗╚╝╠╣╦╩╬║═╭╮╰╯╞╡╪╟╢╫]|^\s*\+[-=+]+\+\s*$|^\s*\|.*\|\s*$/;

export const isRigidLine = (l) => RIGID_RE.test(l);

function justifyLine(text, width, flip) {
  const words = text.split(/\s+/);
  if (words.length < 2) return text;
  const wordsWidth = words.reduce((a, w) => a + strWidth(w), 0);
  const gaps = words.length - 1;
  const spaces = width - wordsWidth;
  if (spaces <= gaps) return words.join(' ');
  const base = Math.floor(spaces / gaps);
  const extra = spaces % gaps;
  let out = words[0];
  for (let i = 0; i < gaps; i++) {
    // on alterne le côté qui reçoit les espaces en trop pour éviter les « rivières »
    const rank = flip ? gaps - 1 - i : i;
    out += ' '.repeat(base + (rank < extra ? 1 : 0)) + words[i + 1];
  }
  return out;
}

/**
 * @param {string[]} lines
 * @param {'left'|'center'|'right'|'justify'} mode
 * @param {{width?: number|null, justifyLast?: boolean}} [opts]
 */
export function alignLines(lines, mode, { width = null, justifyLast = false } = {}) {
  if (!['left', 'center', 'right', 'justify'].includes(mode)) throw new Error(`Mode d'alignement inconnu : ${mode}`);

  const exp = lines.map((l) => expandTabs(l));
  const rigid = exp.map(isRigidLine);

  // blocs de lignes rigides (tableaux, dessins)
  const blockOf = new Array(exp.length).fill(null);
  for (let i = 0; i < exp.length;) {
    if (!rigid[i]) { i++; continue; }
    let j = i;
    while (j + 1 < exp.length && rigid[j + 1]) j++;
    const ls = exp.slice(i, j + 1).map((l) => l.replace(/\s+$/, ''));
    const indent = Math.min(...ls.filter(Boolean).map((l) => l.length - l.trimStart().length));
    const w = Math.max(...ls.map((l) => strWidth(l) - indent));
    const block = { indent, width: w };
    for (let k = i; k <= j; k++) blockOf[k] = block;
    i = j + 1;
  }

  const src = exp.map((l, i) => (rigid[i] ? l : l.trim()));
  const textWidths = src.map((l, i) => (rigid[i] ? 0 : strWidth(l)));
  const blockWidths = blockOf.filter(Boolean).map((b) => b.width);
  const target = width && width > 0 ? width : Math.max(0, ...textWidths, ...blockWidths);

  const lead = (w) => {
    if (mode === 'right') return Math.max(0, target - w);
    if (mode === 'center') return Math.max(0, Math.floor((target - w) / 2));
    return 0;
  };

  const out = [];
  let n = 0;
  for (let i = 0; i < src.length; i++) {
    const l = src[i];
    if (rigid[i]) {
      const b = blockOf[i];
      out.push(' '.repeat(lead(b.width)) + l.slice(b.indent).replace(/\s+$/, ''));
    } else if (!l) {
      out.push(l);
    } else if (mode === 'left') {
      out.push(l);
    } else if (mode === 'justify') {
      const lastOfParagraph = i === src.length - 1 || src[i + 1] === '' || rigid[i + 1];
      out.push(lastOfParagraph && !justifyLast ? l : justifyLine(l, target, n++ % 2 === 1));
    } else {
      out.push(' '.repeat(lead(strWidth(l))) + l);
    }
  }
  return out;
}

export function alignText(text, mode, opts) {
  return alignLines(text.split('\n'), mode, opts).join('\n');
}
