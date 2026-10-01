import test from 'node:test';
import assert from 'node:assert/strict';
import { strWidth } from '../src/js/lib/width.js';
import {
  createTable, renderTable, parseTable, findTableBlock, insertRow, insertCol, removeRow, removeCol, columnWidths,
} from '../src/js/lib/table.js';

const sample = () => ({
  cells: [['Nom', 'Qté'], ['Pomme', '3'], ['Fraise', '12']],
  colWidths: [null, null],
  aligns: ['l', 'r'],
  style: 'single',
  rowLines: 'all',
  header: false,
});

test('rendu : largeur automatique et alignements', () => {
  assert.deepEqual(renderTable(sample()), [
    '┌────────┬─────┐',
    '│ Nom    │ Qté │',
    '├────────┼─────┤',
    '│ Pomme  │   3 │',
    '├────────┼─────┤',
    '│ Fraise │  12 │',
    '└────────┴─────┘',
  ]);
});

test('rendu : en-tête renforcé, sans lignes intermédiaires', () => {
  const m = { ...sample(), header: true, rowLines: 'none' };
  assert.deepEqual(renderTable(m), [
    '┌────────┬─────┐',
    '│ Nom    │ Qté │',
    '╞════════╪═════╡',
    '│ Pomme  │   3 │',
    '│ Fraise │  12 │',
    '└────────┴─────┘',
  ]);
});

test('rendu : styles ASCII, double et arrondi', () => {
  assert.equal(renderTable({ ...sample(), style: 'ascii' })[0], '+--------+-----+');
  assert.equal(renderTable({ ...sample(), style: 'double' })[0], '╔════════╦═════╗');
  assert.equal(renderTable({ ...sample(), style: 'rounded' })[0], '╭────────┬─────╮');
});

test('rendu : largeur manuelle avec retour à la ligne', () => {
  const m = { ...sample(), colWidths: [5, null], cells: [['un deux trois', 'x']] };
  assert.deepEqual(renderTable(m), [
    '┌───────┬───┐',
    '│ un    │ x │',
    '│ deux  │   │',
    '│ trois │   │',
    '└───────┴───┘',
  ]);
});

test('rendu : cellules multilignes et indentation', () => {
  const lines = renderTable({ ...sample(), cells: [['a\nbb', 'c']] }, { indent: 2 });
  assert.equal(lines[1], '  │ a  │ c │');
  assert.equal(lines[2], '  │ bb │   │');
});

test('rendu : toutes les lignes ont la même largeur d\'affichage', () => {
  const lines = renderTable({ ...sample(), cells: [['日本語', 'é'], ['a', 'b']] });
  const w = strWidth(lines[0]);
  assert.ok(lines.every((l) => strWidth(l) === w), lines.join('\n'));
});

for (const style of ['single', 'rounded', 'double', 'ascii']) {
  for (const header of [false, true]) {
    for (const rowLines of ['all', 'none']) {
      test(`aller-retour parse/rendu (${style}, en-tête=${header}, lignes=${rowLines})`, () => {
        const m = { ...sample(), style, header, rowLines };
        const lines = renderTable(m, { indent: 1 });
        const parsed = parseTable(lines);
        assert.ok(parsed, 'tableau relu');
        assert.equal(parsed.style, style);
        assert.equal(parsed.header, header);
        assert.equal(parsed.indent, 1);
        assert.deepEqual(parsed.cells, m.cells);
        assert.deepEqual(parsed.aligns, ['l', 'r']);
        assert.deepEqual(renderTable(parsed, { indent: parsed.indent }), lines);
      });
    }
  }
}

test('relecture : alignement centré détecté', () => {
  const m = { ...sample(), aligns: ['c', 'c'], cells: [['a', 'bbbbb'], ['cccccc', 'd']] };
  const parsed = parseTable(renderTable(m));
  assert.deepEqual(parsed.aligns, ['c', 'c']);
});

test('relecture : une cellule multiligne reste une cellule avec tous les séparateurs', () => {
  const m = { ...sample(), cells: [['a\nb', 'c'], ['d', 'e']] };
  const parsed = parseTable(renderTable(m));
  assert.deepEqual(parsed.cells, m.cells);
});

test('relecture : rejette les lignes qui ne sont pas un tableau', () => {
  assert.equal(parseTable(['bonjour', 'monde', 'x']), null);
  assert.equal(parseTable(['┌──┬──┐', '│ a│ b│', '└────┘']), null); // bordure basse incohérente
  assert.equal(parseTable(['┌──┐', 'texte', '└──┘']), null);
});

test('findTableBlock : retrouve le tableau autour d\'une ligne', () => {
  const doc = ['avant', ...renderTable(sample()), 'après'];
  const found = findTableBlock(doc, 3);
  assert.equal(found.start, 1);
  assert.equal(found.end, 7);
  assert.equal(findTableBlock(doc, 0), null);
});

test('édition : ajout / suppression de lignes et colonnes', () => {
  let m = createTable(2, 2);
  m = insertRow(m, 1);
  assert.equal(m.cells.length, 3);
  m = insertCol(m, 0);
  assert.equal(m.cells[0].length, 3);
  assert.equal(m.colWidths.length, 3);
  m = removeCol(m, 0);
  m = removeRow(m, 0);
  assert.equal(m.cells.length, 2);
  assert.equal(m.cells[0].length, 2);
  // jamais en dessous d'une cellule
  let one = createTable(1, 1);
  one = removeRow(one, 0);
  one = removeCol(one, 0);
  assert.equal(one.cells.length, 1);
  assert.equal(one.cells[0].length, 1);
});

test('largeurs effectives', () => {
  assert.deepEqual(columnWidths({ ...sample(), colWidths: [10, null] }), [10, 3]);
});
