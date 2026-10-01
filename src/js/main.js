// Point d'entrée : relie la barre d'outils, l'éditeur et les dialogues.

import { Editor, lineStart } from './ui/editor.js';
import {
  DEFAULTS, loadSettings, saveSettings, applySettings, loadDraft, saveDraftSoon, clearDraft,
} from './ui/settings.js';
import { toast, initMenus } from './ui/dialogs.js';
import { openTableDialog } from './ui/table-dialog.js';
import { openDrawDialog } from './ui/draw-dialog.js';
import { alignLines } from './lib/align.js';
import {
  applyList, indentLines, outdentLines, reflow, splitItem, isListLine, parseItem, startList, INDENT,
} from './lib/lists.js';
import { parseTable, findTableBlock } from './lib/table.js';
import { toAscii } from './lib/chars.js';
import { maxWidth } from './lib/width.js';

const $ = (id) => document.getElementById(id);
const ta = $('editor');
const ed = new Editor(ta);

let settings = loadSettings();
applySettings(settings, ta);
if (settings.autosave) {
  const draft = loadDraft();
  if (draft) ta.value = draft;
}
initMenus();

// ---------- barre d'état ----------
let statusQueued = false;
function updateStatus() {
  statusQueued = false;
  const lines = ta.value.split('\n');
  const pos = ta.selectionStart;
  const li = ed.lineIndexAt(pos);
  $('st-pos').textContent = `Ln ${li + 1}, Col ${pos - lineStart(lines, li) + 1}`;
  const n = ta.selectionEnd - ta.selectionStart;
  $('st-sel').hidden = n === 0;
  $('st-sel').textContent = `${n} car. sélectionné${n > 1 ? 's' : ''}`;
  $('st-doc').textContent = `${lines.length} ligne${lines.length > 1 ? 's' : ''} · ${maxWidth(lines)} col. max`;
}
function scheduleStatus() {
  if (statusQueued) return;
  statusQueued = true;
  requestAnimationFrame(updateStatus);
}

ta.addEventListener('input', () => {
  scheduleStatus();
  if (settings.autosave) saveDraftSoon(ta.value);
});
['keyup', 'click', 'focus'].forEach((t) => ta.addEventListener(t, scheduleStatus));
document.addEventListener('selectionchange', () => {
  if (document.activeElement === ta) scheduleStatus();
});
updateStatus();

// Les boutons ne doivent pas voler le focus (et donc la sélection) à la zone de texte.
document.querySelectorAll('#toolbar button, #topbar button, .menu button').forEach((b) => {
  b.addEventListener('mousedown', (e) => e.preventDefault());
});

// ---------- alignement ----------
function doAlign(mode) {
  const { first, last, lines } = ed.selectedLines({ scope: 'paragraph' });
  const slice = lines.slice(first, last + 1);
  if (!slice.some((l) => l.trim())) {
    toast('Sélectionnez des lignes de texte à aligner.');
    return;
  }
  const width = parseInt(settings.alignWidth, 10) || null;
  ed.replaceLines(first, last, alignLines(slice, mode, { width, justifyLast: settings.justifyLast }));
}

// ---------- listes ----------
function doList(kind) {
  const { first, last, lines } = ed.selectedLines();
  const slice = lines.slice(first, last + 1);
  if (!slice.some((l) => l.trim())) {
    const marker = startList(kind, { bulletSet: settings.bulletSet });
    const indent = slice[0].match(/^ */)[0];
    const text = indent + marker;
    const all = lines.slice();
    all[first] = text;
    ed.apply(all.join('\n'), lineStart(all, first) + text.length);
    return;
  }
  ed.replaceLines(first, last, applyList(slice, kind, { bulletSet: settings.bulletSet }));
}

function doIndent(delta) {
  const { first, last, lines, hasSelection } = ed.selectedLines();
  const slice = lines.slice(first, last + 1);
  const moved = delta > 0 ? indentLines(slice) : outdentLines(slice);
  const all = lines.slice();
  all.splice(first, last - first + 1, ...moved);
  const rf = reflow(all, first, last);
  if (rf) all.splice(rf.first, rf.last - rf.first + 1, ...rf.lines);

  if (!hasSelection) {
    // on garde le curseur à la même distance de la fin de ligne
    const fromEnd = lineStart(lines, first) + lines[first].length - ta.selectionStart;
    const newStart = lineStart(all, first);
    const caret = Math.max(newStart, newStart + all[first].length - fromEnd);
    ed.apply(all.join('\n'), caret);
  } else {
    const start = lineStart(all, first);
    ed.apply(all.join('\n'), start, lineStart(all, last) + all[last].length);
  }
}

function onTab(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (ed.escapeTab) return; // Échap puis Tab : on laisse le navigateur déplacer le focus
  e.preventDefault();
  const { first, last, lines, hasSelection } = ed.selectedLines();
  const multi = hasSelection && last > first;
  if (multi || isListLine(lines[first]) || e.shiftKey) {
    doIndent(e.shiftKey ? -1 : 1);
    return;
  }
  const col = ta.selectionStart - lineStart(lines, first);
  ed.insertText(' '.repeat(INDENT - (col % INDENT)));
}

function onEnter(e) {
  if (!settings.autoContinue || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
  if (ta.selectionStart !== ta.selectionEnd) return;
  const lines = ed.lines();
  const pos = ta.selectionStart;
  const li = ed.lineIndexAt(pos);
  const res = splitItem(lines[li], pos - lineStart(lines, li));
  if (!res) return;
  e.preventDefault();

  const all = lines.slice();
  let caret;
  if (res.type === 'end') {
    if (res.level > 0) {
      all[li] = outdentLines([lines[li]])[0];
      const rf = reflow(all, li, li);
      if (rf) all.splice(rf.first, rf.last - rf.first + 1, ...rf.lines);
      caret = lineStart(all, li) + all[li].length;
    } else {
      all[li] = '';
      caret = lineStart(all, li);
    }
  } else {
    all.splice(li, 1, ...res.lines);
    const rf = reflow(all, li, li + 1);
    if (rf) all.splice(rf.first, rf.last - rf.first + 1, ...rf.lines);
    const item = parseItem(all[li + 1]);
    caret = lineStart(all, li + 1) + (item ? item.indent + item.marker.length + 1 : all[li + 1].length);
  }
  ed.apply(all.join('\n'), caret);
}

ta.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    ed.escapeTab = true;
    return;
  }
  if (e.key === 'Tab') onTab(e);
  else if (e.key === 'Enter') onEnter(e);
  if (e.key !== 'Tab') ed.escapeTab = false;
});
ta.addEventListener('blur', () => { ed.escapeTab = false; });

// ---------- tableau & dessin ----------
async function doTable() {
  const { first, last, hasSelection, lines } = ed.selectedLines();
  let found = null;
  if (hasSelection) {
    const m = parseTable(lines.slice(first, last + 1));
    if (m) found = { start: first, end: last, model: m };
  }
  if (!found) found = findTableBlock(lines, ed.lineIndexAt(ta.selectionStart));
  const result = await openTableDialog(found ? found.model : null);
  if (!result) return;
  if (found) ed.replaceLines(found.start, found.end, result);
  else ed.insertBlock(result);
}

async function doDraw() {
  const { first, last, hasSelection, lines } = ed.selectedLines();
  const initial = hasSelection ? lines.slice(first, last + 1) : null;
  const result = await openDrawDialog(initial);
  if (!result) return;
  if (initial) ed.replaceLines(first, last, result);
  else ed.insertBlock(result);
}

// ---------- fichier ----------
async function decodeFile(file) {
  const buf = await file.arrayBuffer();
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    text = new TextDecoder('windows-1252').decode(buf);
  }
  return text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
}

async function importFile(file) {
  if (!file) return;
  if (ta.value.trim() && !confirm(`Remplacer le document actuel par « ${file.name} » ?`)) return;
  try {
    ed.apply(await decodeFile(file), 0, 0);
    ta.scrollTop = 0;
    ta.scrollLeft = 0;
    toast(`« ${file.name} » importé.`);
  } catch {
    toast('Impossible de lire ce fichier.');
  }
}

function exportFile() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const name = `texte-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}.txt`;
  const blob = new Blob([ta.value], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast(`Exporté : ${name}`);
}

async function copyText() {
  const hasSel = ta.selectionEnd > ta.selectionStart;
  const text = hasSel ? ta.value.slice(ta.selectionStart, ta.selectionEnd) : ta.value;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const s = [ta.selectionStart, ta.selectionEnd];
    if (!hasSel) ta.select();
    document.execCommand('copy');
    ta.setSelectionRange(...s);
  }
  toast(hasSel ? 'Sélection copiée.' : 'Document copié.');
}

function doAscii() {
  const { first, last, hasSelection, lines } = ed.selectedLines();
  const from = hasSelection ? first : 0;
  const to = hasSelection ? last : lines.length - 1;
  const slice = lines.slice(from, to + 1);
  const out = slice.map(toAscii);
  if (out.every((l, i) => l === slice[i])) {
    toast('Rien à convertir.');
    return;
  }
  ed.replaceLines(from, to, out, hasSelection ? {} : { caret: ta.selectionStart });
  toast('Converti en ASCII pur.');
}

function newDocument() {
  if (ta.value && !confirm('Effacer tout le document ? (Ctrl+Z permet de le récupérer)')) return;
  ed.apply('', 0, 0);
  clearDraft();
}

// ---------- réglages & aide ----------
const dlgSettings = $('dlg-settings');
const fields = {
  theme: $('se-theme'),
  fontSize: $('se-size'),
  bulletSet: $('se-bullets'),
  alignWidth: $('se-width'),
  justifyLast: $('se-justlast'),
  autoContinue: $('se-continue'),
  wrap: $('se-wrap'),
  autosave: $('se-autosave'),
};

function fillSettings() {
  for (const [key, el] of Object.entries(fields)) {
    if (el.type === 'checkbox') el.checked = !!settings[key];
    else el.value = settings[key];
  }
}

function readSettings() {
  const next = { ...settings };
  for (const [key, el] of Object.entries(fields)) {
    next[key] = el.type === 'checkbox' ? el.checked : el.value;
  }
  next.fontSize = Math.min(40, Math.max(9, parseInt(next.fontSize, 10) || DEFAULTS.fontSize));
  return next;
}

for (const el of Object.values(fields)) {
  el.addEventListener('change', () => {
    const wasAutosave = settings.autosave;
    settings = readSettings();
    applySettings(settings, ta);
    saveSettings(settings);
    if (wasAutosave && !settings.autosave) clearDraft();
    if (!wasAutosave && settings.autosave) saveDraftSoon(ta.value);
  });
}
$('se-reset').addEventListener('click', () => {
  settings = { ...DEFAULTS };
  fillSettings();
  applySettings(settings, ta);
  saveSettings(settings);
});
[dlgSettings, $('dlg-help')].forEach((d) => d.addEventListener('click', (e) => {
  if (e.target === d) d.close();
}));

// ---------- dispatch ----------
const actions = {
  undo: () => ed.undo(),
  redo: () => ed.redo(),
  align: (d) => doAlign(d.mode),
  list: (d) => doList(d.kind),
  indent: () => doIndent(1),
  outdent: () => doIndent(-1),
  table: doTable,
  draw: doDraw,
  new: newDocument,
  import: () => $('file-input').click(),
  export: exportFile,
  copy: copyText,
  ascii: doAscii,
  settings: () => { fillSettings(); dlgSettings.showModal(); },
  help: () => $('dlg-help').showModal(),
};

document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  actions[btn.dataset.action]?.(btn.dataset);
});

$('file-input').addEventListener('change', (e) => {
  importFile(e.target.files[0]);
  e.target.value = '';
});

ta.addEventListener('dragover', (e) => {
  if (e.dataTransfer?.types?.includes('Files')) e.preventDefault();
});
ta.addEventListener('drop', (e) => {
  const f = e.dataTransfer?.files?.[0];
  if (f) {
    e.preventDefault();
    importFile(f);
  }
});

if (!ta.value) ta.focus({ preventScroll: true });
