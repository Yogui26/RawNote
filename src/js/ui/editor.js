// Enveloppe autour du <textarea> : lecture des lignes / sélection et remplacement
// minimal du texte en conservant l'historique d'annulation natif.

const isHigh = (c) => c >= 0xd800 && c <= 0xdbff;
const isLow = (c) => c >= 0xdc00 && c <= 0xdfff;

/** Offset du début de la ligne `i` dans le texte formé par `lines` joint par \n. */
export function lineStart(lines, i) {
  let off = 0;
  for (let k = 0; k < i && k < lines.length; k++) off += lines[k].length + 1;
  return off;
}

export class Editor {
  constructor(ta) {
    this.ta = ta;
  }

  get value() {
    return this.ta.value;
  }

  lines() {
    return this.ta.value.split('\n');
  }

  lineIndexAt(pos) {
    const v = this.ta.value;
    let n = 0;
    for (let i = 0; i < pos && i < v.length; i++) if (v.charCodeAt(i) === 10) n++;
    return n;
  }

  /**
   * Lignes concernées par la sélection.
   * scope 'paragraph' : sans sélection, étend au bloc de lignes non vides contenant le curseur.
   */
  selectedLines({ scope = 'line' } = {}) {
    const ta = this.ta;
    const v = ta.value;
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    const hasSelection = e > s;
    const lines = v.split('\n');
    let first = this.lineIndexAt(s);
    let last = this.lineIndexAt(hasSelection && v[e - 1] === '\n' ? e - 1 : e);
    if (!hasSelection && scope === 'paragraph' && lines[first].trim() !== '') {
      while (first > 0 && lines[first - 1].trim() !== '') first--;
      while (last < lines.length - 1 && lines[last + 1].trim() !== '') last++;
    }
    return { first, last, hasSelection, lines };
  }

  /** Remplace la plage [start, end) en conservant l'historique natif quand c'est possible. */
  replaceRange(start, end, text) {
    const ta = this.ta;
    ta.focus({ preventScroll: true });
    const before = ta.value.slice(0, start);
    const after = ta.value.slice(end);
    ta.setSelectionRange(start, end);
    let ok = false;
    try {
      ok = document.execCommand('insertText', false, text);
    } catch { ok = false; }
    if (!ok || ta.value !== before + text + after) {
      ta.value = before + text + after;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  /**
   * Remplace tout le texte en ne touchant que la partie qui change, puis place la sélection
   * (positions exprimées dans le nouveau texte).
   */
  apply(newValue, selStart = null, selEnd = selStart) {
    const ta = this.ta;
    const old = ta.value;
    if (old !== newValue) {
      const max = Math.min(old.length, newValue.length);
      let p = 0;
      while (p < max && old.charCodeAt(p) === newValue.charCodeAt(p)) p++;
      if (p > 0 && isHigh(old.charCodeAt(p - 1))) p--;
      let s = 0;
      while (s < max - p && old.charCodeAt(old.length - 1 - s) === newValue.charCodeAt(newValue.length - 1 - s)) s++;
      if (s > 0 && isLow(old.charCodeAt(old.length - s))) s--;
      this.replaceRange(p, old.length - s, newValue.slice(p, newValue.length - s));
    }
    if (selStart !== null) ta.setSelectionRange(selStart, selEnd);
    ta.focus({ preventScroll: true });
  }

  /** Remplace les lignes first..last par `newSlice` et sélectionne le résultat (ou place le curseur). */
  replaceLines(first, last, newSlice, { select = true, caret = null } = {}) {
    const all = this.lines();
    all.splice(first, last - first + 1, ...newSlice);
    const start = lineStart(all, first);
    const len = newSlice.join('\n').length;
    if (caret !== null) this.apply(all.join('\n'), caret);
    else if (select) this.apply(all.join('\n'), start, start + len);
    else this.apply(all.join('\n'), start + len);
  }

  /** Insère un bloc de lignes : remplace la sélection / la ligne vide, sinon l'ajoute sous la ligne courante. */
  insertBlock(blockLines) {
    const { first, last, hasSelection, lines } = this.selectedLines();
    if (hasSelection) {
      this.replaceLines(first, last, blockLines);
      return;
    }
    if (lines[first].trim() === '') {
      this.replaceLines(first, first, blockLines);
      return;
    }
    const all = lines;
    all.splice(first + 1, 0, ...blockLines);
    const start = lineStart(all, first + 1);
    this.apply(all.join('\n'), start, start + blockLines.join('\n').length);
  }

  insertText(text) {
    const ta = this.ta;
    this.replaceRange(ta.selectionStart, ta.selectionEnd, text);
  }

  undo() {
    this.ta.focus({ preventScroll: true });
    try { document.execCommand('undo'); } catch { /* non pris en charge */ }
  }

  redo() {
    this.ta.focus({ preventScroll: true });
    try { document.execCommand('redo'); } catch { /* non pris en charge */ }
  }
}
