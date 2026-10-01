// Tables de caractères de cadre (tableaux et dessins).

export const UP = 1;
export const RIGHT = 2;
export const DOWN = 4;
export const LEFT = 8;

// masque de directions -> caractère
export const LIGHT = {
  [UP]: '│', [DOWN]: '│', [UP | DOWN]: '│',
  [LEFT]: '─', [RIGHT]: '─', [LEFT | RIGHT]: '─',
  [DOWN | RIGHT]: '┌', [DOWN | LEFT]: '┐', [UP | RIGHT]: '└', [UP | LEFT]: '┘',
  [UP | DOWN | RIGHT]: '├', [UP | DOWN | LEFT]: '┤',
  [DOWN | LEFT | RIGHT]: '┬', [UP | LEFT | RIGHT]: '┴',
  [UP | DOWN | LEFT | RIGHT]: '┼',
};

export const DOUBLE = {
  [UP]: '║', [DOWN]: '║', [UP | DOWN]: '║',
  [LEFT]: '═', [RIGHT]: '═', [LEFT | RIGHT]: '═',
  [DOWN | RIGHT]: '╔', [DOWN | LEFT]: '╗', [UP | RIGHT]: '╚', [UP | LEFT]: '╝',
  [UP | DOWN | RIGHT]: '╠', [UP | DOWN | LEFT]: '╣',
  [DOWN | LEFT | RIGHT]: '╦', [UP | LEFT | RIGHT]: '╩',
  [UP | DOWN | LEFT | RIGHT]: '╬',
};

export const ROUND = {
  [DOWN | RIGHT]: '╭', [DOWN | LEFT]: '╮', [UP | RIGHT]: '╰', [UP | LEFT]: '╯',
};

export const ARROWS = { r: '►', l: '◄', u: '▲', d: '▼' };

// caractère -> { mask, kind } pour relire un dessin existant
// Les clés entières sont parcourues par ordre croissant : pour │ ─ ║ ═ c'est donc
// le masque à deux directions (UP|DOWN, LEFT|RIGHT) qui l'emporte sur les masques simples.
export const REV = {};
for (const [mask, ch] of Object.entries(LIGHT)) REV[ch] = { mask: Number(mask), kind: 'light' };
for (const [mask, ch] of Object.entries(DOUBLE)) REV[ch] = { mask: Number(mask), kind: 'double' };
for (const [mask, ch] of Object.entries(ROUND)) REV[ch] = { mask: Number(mask), kind: 'round' };

// styles de tableaux
export const TABLE_STYLES = {
  single: {
    tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│', tj: '┬', bj: '┴', lj: '├', rj: '┤', x: '┼',
    hl: '╞', hh: '═', hx: '╪', hr: '╡',
  },
  rounded: {
    tl: '╭', tr: '╮', bl: '╰', br: '╯', h: '─', v: '│', tj: '┬', bj: '┴', lj: '├', rj: '┤', x: '┼',
    hl: '╞', hh: '═', hx: '╪', hr: '╡',
  },
  double: {
    tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║', tj: '╦', bj: '╩', lj: '╠', rj: '╣', x: '╬',
    hl: '╟', hh: '─', hx: '╫', hr: '╢',
  },
  ascii: {
    tl: '+', tr: '+', bl: '+', br: '+', h: '-', v: '|', tj: '+', bj: '+', lj: '+', rj: '+', x: '+',
    hl: '+', hh: '=', hx: '+', hr: '+',
  },
};

// conversion Unicode -> ASCII pur
const ASCII_MAP = {};
for (const ch of Object.values(LIGHT)) ASCII_MAP[ch] = ch === '│' ? '|' : ch === '─' ? '-' : '+';
for (const ch of Object.values(DOUBLE)) ASCII_MAP[ch] = ch === '║' ? '|' : ch === '═' ? '=' : '+';
for (const ch of Object.values(ROUND)) ASCII_MAP[ch] = '+';
for (const ch of ['╞', '╡', '╪', '╟', '╢', '╫']) ASCII_MAP[ch] = '+';
Object.assign(ASCII_MAP, { '►': '>', '◄': '<', '▲': '^', '▼': 'v', '•': '-', '◦': '*', '▪': '+', '‣': '>' });

export function toAscii(s) {
  let out = '';
  for (const ch of s) out += ASCII_MAP[ch] ?? ch;
  return out;
}

/** Vrai si la chaîne contient au moins un caractère convertible par toAscii. */
export function hasNonAscii(s) {
  for (const ch of s) if (ASCII_MAP[ch] !== undefined) return true;
  return false;
}
