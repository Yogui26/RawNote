import test from 'node:test';
import assert from 'node:assert/strict';
import { strWidth, wrapText, padAlign, sliceCols, expandTabs } from '../src/js/lib/width.js';
import { alignLines } from '../src/js/lib/align.js';

test('largeur : ASCII, accents, CJK, combinants', () => {
  assert.equal(strWidth('abc'), 3);
  assert.equal(strWidth('é'), 1);
  assert.equal(strWidth('é'), 1);
  assert.equal(strWidth('日本'), 4);
  assert.equal(strWidth('┌─┐'), 3);
});

test('tabulations développées sur la grille', () => {
  assert.equal(expandTabs('a\tb'), 'a   b');
  assert.equal(expandTabs('\tx'), '    x');
});

test('padAlign', () => {
  assert.equal(padAlign('ab', 6, 'l'), 'ab    ');
  assert.equal(padAlign('ab', 6, 'r'), '    ab');
  assert.equal(padAlign('ab', 6, 'c'), '  ab  ');
  assert.equal(padAlign('abc', 6, 'c'), ' abc  ');
  assert.equal(padAlign('abcdefg', 3, 'c'), 'abcdefg');
});

test('sliceCols', () => {
  assert.equal(sliceCols('abcdef', 1, 4), 'bcd');
  assert.equal(sliceCols('日本x', 0, 2), '日');
});

test('wrapText', () => {
  assert.deepEqual(wrapText('un deux trois quatre', 9), ['un deux', 'trois', 'quatre']);
  assert.deepEqual(wrapText('abcdefghij', 4), ['abcd', 'efgh', 'ij']);
  assert.deepEqual(wrapText('a\n\nb', 5), ['a', '', 'b']);
});

test('alignement : droite et centre selon la plus longue ligne', () => {
  const src = ['court', 'une ligne plus longue', 'moyen'];
  const w = 'une ligne plus longue'.length;
  const right = alignLines(src, 'right');
  assert.ok(right.every((l) => l.length === w));
  assert.equal(right[0], ' '.repeat(w - 5) + 'court');
  const center = alignLines(src, 'center');
  assert.equal(center[0], ' '.repeat(Math.floor((w - 5) / 2)) + 'court');
  assert.equal(center[1], 'une ligne plus longue');
});

test('alignement : gauche retire les espaces de tête', () => {
  assert.deepEqual(alignLines(['   a', '      bb  '], 'left'), ['a', 'bb']);
});

test('alignement : largeur imposée', () => {
  assert.deepEqual(alignLines(['ab'], 'right', { width: 5 }), ['   ab']);
  assert.deepEqual(alignLines(['ab'], 'center', { width: 6 }), ['  ab']);
});

test('justification : toutes les lignes sauf la dernière du paragraphe font la même largeur', () => {
  const src = ['un deux trois quatre', 'a b c', 'cinq six', '', 'autre para', 'fin'];
  const out = alignLines(src, 'justify');
  const w = 20;
  assert.equal(out[0].length, w);
  assert.equal(out[1].length, w);
  assert.equal(out[2], 'cinq six'); // dernière ligne du paragraphe
  assert.equal(out[3], '');
  assert.equal(out[4].length, w);
  assert.equal(out[5], 'fin');
});

test('justification de la dernière ligne sur demande', () => {
  const out = alignLines(['un deux trois quatre', 'cinq six'], 'justify', { justifyLast: true });
  assert.equal(out[1].length, 20);
});

test('justification : un mot seul reste inchangé', () => {
  assert.deepEqual(alignLines(['unmotlongtrèsvraiment', 'a', 'x'], 'justify')[1], 'a');
});

test('alignement : un tableau est déplacé en bloc, sans être déformé', () => {
  const table = ['┌───┬───┐', '│ a │ b │', '└───┴───┘'];
  const src = ['un titre assez long pour tout', ...table];
  const center = alignLines(src, 'center');
  const shift = Math.floor((29 - 9) / 2);
  assert.deepEqual(center.slice(1), table.map((l) => ' '.repeat(shift) + l));
  const right = alignLines(src, 'right');
  assert.deepEqual(right.slice(1), table.map((l) => ' '.repeat(29 - 9) + l));
  const left = alignLines(['      ' + table[0], '      ' + table[1], '      ' + table[2]], 'left');
  assert.deepEqual(left, table);
});

test('alignement : le tableau compte dans la largeur de référence', () => {
  const table = ['┌───────────┐', '│ a         │', '└───────────┘'];
  const out = alignLines(['court', ...table], 'right');
  assert.equal(out[0], ' '.repeat(13 - 5) + 'court');
  assert.deepEqual(out.slice(1), table);
});

test('justification : une ligne avant un tableau est la dernière de son paragraphe', () => {
  const out = alignLines(['un deux trois', '┌──┐', '│  │', '└──┘'], 'justify');
  assert.equal(out[0], 'un deux trois');
});
