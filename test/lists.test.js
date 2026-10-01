import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyList, renumber, reflow, indentLines, outdentLines, splitItem, parseItem,
  inferKind, toRoman, fromRoman, toAlpha, fromAlpha, stripMarker,
} from '../src/js/lib/lists.js';

test('conversions romain / alphabétique', () => {
  assert.equal(toRoman(4), 'iv');
  assert.equal(toRoman(1994), 'mcmxciv');
  assert.equal(fromRoman('xiv'), 14);
  assert.equal(toAlpha(1), 'a');
  assert.equal(toAlpha(26), 'z');
  assert.equal(toAlpha(27), 'aa');
  assert.equal(fromAlpha('ab'), 28);
});

test('analyse des éléments', () => {
  assert.equal(parseItem('texte normal'), null);
  assert.equal(parseItem('2024 était bien'), null);
  assert.deepEqual(parseItem('   2. suite'), { indent: 3, level: 1, marker: '2.', type: 'num', text: 'suite' });
  assert.equal(parseItem('• puce').type, 'bullet');
  assert.equal(parseItem('1.2.3. x').type, 'legal');
  assert.equal(parseItem('b) x').type, 'alpha');
  assert.equal(parseItem('iv. x').type, 'roman');
  assert.equal(parseItem('-').text, '');
});

test('liste à puces', () => {
  assert.deepEqual(applyList(['a', 'b'], 'bullet'), ['• a', '• b']);
  assert.deepEqual(applyList(['a', 'b'], 'bullet', { bulletSet: 'ascii' }), ['- a', '- b']);
});

test('puces : bascule (retrait) si déjà appliquées', () => {
  assert.deepEqual(applyList(['• a', '• b'], 'bullet'), ['a', 'b']);
});

test('numérotation, lettres, romains', () => {
  assert.deepEqual(applyList(['a', 'b', 'c'], 'num'), ['1. a', '2. b', '3. c']);
  assert.deepEqual(applyList(['a', 'b', 'c'], 'alpha'), ['a. a', 'b. b', 'c. c']);
  assert.deepEqual(applyList(['x', 'y', 'z', 'w'], 'roman'), ['i. x', 'ii. y', 'iii. z', 'iv. w']);
});

test('changement de type en remplaçant les anciens marqueurs', () => {
  assert.deepEqual(applyList(['1. a', '2. b'], 'alpha'), ['a. a', 'b. b']);
  assert.deepEqual(applyList(['• a', '• b'], 'num'), ['1. a', '2. b']);
});

test('plusieurs niveaux (plan)', () => {
  const out = applyList(['a', '   b', '      c', '   d', 'e'], 'outline');
  assert.deepEqual(out, ['1. a', '   a. b', '      i. c', '   b. d', '2. e']);
});

test('plusieurs niveaux (numérotation légale)', () => {
  const out = applyList(['a', '   b', '   c', 'd', '   e'], 'legal');
  assert.deepEqual(out, ['1. a', '   1.1. b', '   1.2. c', '2. d', '   2.1. e']);
});

test('puces à plusieurs niveaux', () => {
  assert.deepEqual(applyList(['a', '   b', '      c'], 'bullet'), ['• a', '   ◦ b', '      ▪ c']);
});

test('les lignes vides sont conservées', () => {
  assert.deepEqual(applyList(['a', '', 'b'], 'num'), ['1. a', '', '2. b']);
});

test('indentation / désindentation', () => {
  assert.deepEqual(indentLines(['x', '', 'y']), ['   x', '', '   y']);
  assert.deepEqual(outdentLines(['   x', ' y', 'z']), ['x', 'y', 'z']);
});

test('renumérotation après insertion et décalage', () => {
  const lines = ['1. a', '1. b', '5. c'];
  assert.deepEqual(renumber(lines), ['1. a', '2. b', '3. c']);
});

test('reflow : étend au bloc contigu et ignore le texte autour', () => {
  const doc = ['titre', '1. a', '   1. b', '3. c', '', '1. autre liste'];
  const r = reflow(doc, 2, 2);
  assert.equal(r.first, 1);
  assert.equal(r.last, 3);
  assert.deepEqual(r.lines, ['1. a', '   1. b', '2. c']); // niveau 2 déjà numérique : on garde le style
});

test('reflow retourne null hors liste', () => {
  assert.equal(reflow(['du texte', 'encore'], 0, 1), null);
});

test('inférence du type', () => {
  assert.equal(inferKind(['• a', '• b']).kind, 'bullet');
  assert.equal(inferKind(['- a', '- b']).bulletSet, 'ascii');
  assert.equal(inferKind(['1. a', '   a. b']).kind, 'outline');
  assert.equal(inferKind(['1. a', '   1.1. b']).kind, 'legal');
  assert.equal(inferKind(['a. x', 'b. y']).kind, 'alpha');
  assert.equal(inferKind(['i. x', 'ii. y']).kind, 'roman');
  assert.equal(inferKind(['3. x', '4. y']).start, 3);
});

test('Entrée : continuer la liste', () => {
  const r = splitItem('1. bonjour monde', 10);
  assert.equal(r.type, 'split');
  assert.equal(r.lines[0], '1. bonjour');
  assert.equal(r.lines[1].endsWith('monde'), true);
  const s = splitItem('• fin', 5);
  assert.equal(s.lines[1], '• ');
});

test('Entrée sur un élément vide : fin de liste', () => {
  assert.deepEqual(splitItem('   • ', 5), { type: 'end', level: 1 });
  assert.equal(splitItem('du texte', 3), null);
});

test('stripMarker', () => {
  assert.equal(stripMarker('   • a'), '   a');
  assert.equal(stripMarker('rien'), 'rien');
});

test('démarrer une liste sur une ligne vide', async () => {
  const { startList } = await import('../src/js/lib/lists.js');
  assert.equal(startList('bullet'), '• ');
  assert.equal(startList('num'), '1. ');
  assert.equal(startList('alpha'), 'a. ');
  assert.equal(startList('roman'), 'i. ');
  assert.equal(startList('legal'), '1. ');
});
