import test from 'node:test';
import assert from 'node:assert/strict';
import {
  Grid, line, elbow, rect, polyline, diamond, diamondGeometry, textBlock, autoBox, autoBoxSize,
  extract, stamp, clearRect,
} from '../src/js/lib/draw.js';

const lines = (g, o) => g.toLines(o);

test('ligne horizontale et verticale', () => {
  const g = new Grid(10, 5);
  line(g, { x: 1, y: 1 }, { x: 5, y: 1 });
  assert.deepEqual(lines(g), ['─────']);
  const v = new Grid(5, 6);
  line(v, { x: 2, y: 1 }, { x: 2, y: 4 });
  assert.deepEqual(lines(v), ['│', '│', '│', '│']);
});

test('la ligne suit l\'axe dominant', () => {
  const g = new Grid(10, 10);
  line(g, { x: 0, y: 0 }, { x: 6, y: 2 });
  assert.deepEqual(lines(g), ['───────']);
});

test('rectangle simple, double et arrondi', () => {
  const g = new Grid(10, 6);
  rect(g, 0, 0, 4, 2);
  assert.deepEqual(lines(g), ['┌───┐', '│   │', '└───┘']);
  const d = new Grid(10, 6);
  rect(d, 0, 0, 4, 2, { double: true });
  assert.deepEqual(lines(d), ['╔═══╗', '║   ║', '╚═══╝']);
  const r = new Grid(10, 6);
  rect(r, 0, 0, 4, 2, { round: true });
  assert.deepEqual(lines(r), ['╭───╮', '│   │', '╰───╯']);
});

test('rectangle : coins dans n\'importe quel ordre', () => {
  const g = new Grid(10, 6);
  rect(g, 4, 2, 0, 0);
  assert.deepEqual(lines(g), ['┌───┐', '│   │', '└───┘']);
});

test('jonctions et croisements calculés automatiquement', () => {
  const g = new Grid(10, 6);
  rect(g, 0, 0, 6, 4);
  line(g, { x: 3, y: 0 }, { x: 3, y: 4 });
  line(g, { x: 0, y: 2 }, { x: 6, y: 2 });
  assert.deepEqual(lines(g), [
    '┌──┬──┐',
    '│  │  │',
    '├──┼──┤',
    '│  │  │',
    '└──┴──┘',
  ]);
});

test('flèches', () => {
  const g = new Grid(10, 6);
  line(g, { x: 0, y: 0 }, { x: 4, y: 0 }, { arrow: 'end' });
  assert.deepEqual(lines(g), ['────►']);
  const l = new Grid(10, 6);
  line(l, { x: 4, y: 0 }, { x: 0, y: 0 }, { arrow: 'end' });
  assert.deepEqual(lines(l), ['◄────']);
  const b = new Grid(10, 6);
  line(b, { x: 0, y: 0 }, { x: 4, y: 0 }, { arrow: 'both' });
  assert.deepEqual(lines(b), ['◄───►']);
  const v = new Grid(4, 6);
  line(v, { x: 0, y: 0 }, { x: 0, y: 3 }, { arrow: 'end' });
  assert.deepEqual(lines(v), ['│', '│', '│', '▼']);
});

test('ligne coudée', () => {
  const g = new Grid(10, 6);
  elbow(g, { x: 0, y: 0 }, { x: 3, y: 2 }, { arrow: 'end' });
  assert.deepEqual(lines(g), ['───┐', '   │', '   ▼']);
  const v = new Grid(10, 6);
  elbow(v, { x: 0, y: 0 }, { x: 3, y: 2 }, { first: 'v' });
  assert.deepEqual(lines(v), ['│', '│', '└───']);
});

test('trait double', () => {
  const g = new Grid(10, 3);
  line(g, { x: 0, y: 0 }, { x: 3, y: 0 }, { double: true });
  assert.deepEqual(lines(g), ['════']);
});

test('texte : les espaces laissent le fond, le texte remplace les traits', () => {
  const g = new Grid(10, 3);
  line(g, { x: 0, y: 0 }, { x: 5, y: 0 });
  textBlock(g, 1, 0, 'a b');
  assert.deepEqual(lines(g), ['─a─b──']);
  textBlock(g, 0, 1, 'ligne1\nl2');
  assert.deepEqual(lines(g), ['─a─b──', 'ligne1', 'l2']);
});

test('un trait redessiné sur du texte le remplace', () => {
  const g = new Grid(10, 3);
  textBlock(g, 0, 0, 'abc');
  line(g, { x: 0, y: 0 }, { x: 2, y: 0 });
  assert.deepEqual(lines(g), ['───']);
});

test('caractères larges (CJK) : cellule de continuation', () => {
  const g = new Grid(10, 2);
  textBlock(g, 0, 0, '日本x');
  assert.deepEqual(lines(g), ['日本x']);
  g.clearCell(1, 0);
  assert.deepEqual(lines(g), ['本x']); // la moitié restante du caractère large a bien disparu
  assert.equal(lines(g, { trim: false })[0], '  本x');
});

test('boîte avec texte (process)', () => {
  const g = new Grid(5, 5);
  autoBox(g, 0, 0, 'Début', 'process');
  assert.deepEqual(lines(g), ['┌───────┐', '│ Début │', '└───────┘']);
});

test('boîte process : dimensions et centrage multiligne', () => {
  const g = new Grid(5, 5);
  const r = autoBox(g, 0, 0, 'Un\nDeux', 'process');
  assert.equal(r.w, 8);
  assert.equal(r.h, 4);
  assert.deepEqual(lines(g), ['┌──────┐', '│  Un  │', '│ Deux │', '└──────┘']);
});

test('terminal : coins arrondis', () => {
  const g = new Grid(5, 5);
  autoBox(g, 0, 0, 'Fin', 'terminator');
  assert.deepEqual(lines(g), ['╭─────╮', '│ Fin │', '╰─────╯']);
});

test('losange : géométrie symétrique et texte contenu', () => {
  const geo = diamondGeometry(10, 4);
  assert.equal(geo.length, 4);
  assert.equal(geo[1].l, 0);
  assert.equal(geo[1].r, 9);
  assert.equal(geo[0].l + geo[0].r, 9);
  const g = new Grid(5, 5);
  const box = autoBox(g, 0, 0, 'Ok ?', 'decision');
  const out = lines(g);
  assert.equal(out.length, box.h);
  assert.ok(out.some((l) => l.includes('Ok ?')));
  const row = out.find((l) => l.includes('Ok ?'));
  assert.ok(row.trimStart().startsWith('/') || row.trimStart().startsWith('\\'));
});

test('losange : le texte long agrandit la forme', () => {
  const small = autoBoxSize('Oui', 'decision');
  const big = autoBoxSize('Une condition vraiment longue ?', 'decision');
  assert.ok(big.w > small.w);
});

test('losange par glisser (taille libre)', () => {
  const g = new Grid(12, 6);
  diamond(g, 0, 0, 7, 3);
  assert.equal(lines(g).length, 4);
});

test('aller-retour texte -> grille -> texte', () => {
  const src = [
    '┌──┬──┐',
    '│ a│ b│',
    '├──┼──┤',
    '╭──╯  │',
    '└─►  ◄┘',
  ];
  const g = Grid.fromLines(src);
  assert.deepEqual(lines(g), src);
});

test('conversion ASCII pur', () => {
  const g = new Grid(10, 5);
  rect(g, 0, 0, 5, 2, { double: true });
  line(g, { x: 0, y: 4 }, { x: 4, y: 4 }, { arrow: 'end' });
  assert.deepEqual(lines(g, { ascii: true }), ['+====+', '|    |', '+====+', '', '---->']);
});

test('rognage et grille vide', () => {
  const g = new Grid(10, 10);
  assert.deepEqual(lines(g), []);
  textBlock(g, 3, 4, 'x');
  assert.deepEqual(lines(g), ['x']);
  assert.equal(lines(g, { trim: false }).length, 10);
});

test('extraction, effacement et collage', () => {
  const g = new Grid(12, 6);
  rect(g, 0, 0, 3, 2);
  const sub = extract(g, 0, 0, 3, 2);
  clearRect(g, 0, 0, 3, 2);
  assert.deepEqual(lines(g), []);
  stamp(g, sub, 5, 1);
  assert.deepEqual(lines(g), ['┌──┐', '│  │', '└──┘']);
  assert.deepEqual(g.bbox(), { x0: 5, y0: 1, x1: 8, y1: 3 });
});

test('le collage est transparent là où la source est vide', () => {
  const g = new Grid(10, 3);
  line(g, { x: 0, y: 0 }, { x: 5, y: 0 });
  const sub = new Grid(3, 1);
  textBlock(sub, 1, 0, 'x');
  stamp(g, sub, 1, 0);
  assert.deepEqual(lines(g), ['──x───']);
});

test('agrandissement automatique de la grille', () => {
  const g = new Grid(4, 4);
  autoBox(g, 2, 2, 'Long texte', 'process');
  assert.ok(g.w >= 2 + 14 && g.h >= 2 + 3);
});

test('polyline ignore les points doublons', () => {
  const g = new Grid(10, 3);
  polyline(g, [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 3, y: 0 }]);
  assert.deepEqual(lines(g), ['────']);
});
