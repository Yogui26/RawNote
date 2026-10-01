// Dialogue d'édition de tableau : grille de saisie, largeurs manuelles ou automatiques, aperçu en direct.

import {
  createTable, normalize, renderTable, columnWidths, insertRow, removeRow, insertCol, removeCol,
} from '../lib/table.js';
import { maxWidth } from '../lib/width.js';

const $ = (id) => document.getElementById(id);

/**
 * @param {object|null} initial modèle existant (relu depuis le texte) ou null pour un nouveau tableau
 * @returns {Promise<string[]|null>} lignes du tableau, ou null si annulé
 */
export function openTableDialog(initial = null) {
  const dlg = $('dlg-table');
  const grid = $('te-grid');
  const preview = $('te-preview');
  const info = $('te-info');
  const styleSel = $('te-style');
  const rowlinesSel = $('te-rowlines');
  const headerChk = $('te-header');
  const indent = initial?.indent || 0;

  let model = normalize(initial || createTable(3, 3));
  let active = { r: 0, c: 0 };
  let charPx = 8.4;

  dlg.querySelector('#dlg-table-title').textContent = initial ? 'Modifier le tableau' : 'Nouveau tableau';
  $('te-ok').textContent = initial ? 'Appliquer' : 'Insérer';

  function measureChar() {
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;font:14px var(--mono)';
    probe.textContent = '0'.repeat(50);
    dlg.appendChild(probe);
    const w = probe.getBoundingClientRect().width / 50;
    probe.remove();
    return w || 8.4;
  }

  function syncControls() {
    styleSel.value = model.style;
    rowlinesSel.value = model.rowLines;
    headerChk.checked = model.header;
  }

  function updatePreview() {
    const lines = renderTable(model, { indent: 0 });
    preview.textContent = lines.join('\n');
    info.textContent = `${model.cells.length} × ${model.colWidths.length} · ${maxWidth(lines)} col.`;
  }

  function colCssWidth(c) {
    const w = model.colWidths[c];
    return w ? `calc(${w}ch + 22px)` : '';
  }

  function autosize(ta) {
    ta.style.height = 'auto';
    ta.style.height = `${ta.scrollHeight + 2}px`;
  }

  function focusCell(r, c) {
    const ta = grid.querySelector(`textarea[data-r="${r}"][data-c="${c}"]`);
    if (ta) {
      ta.focus();
      ta.select();
    }
  }

  function markActive() {
    grid.querySelectorAll('td.act').forEach((td) => td.classList.remove('act'));
    grid.querySelectorAll('.on').forEach((el) => el.classList.remove('on'));
    grid.querySelector(`textarea[data-r="${active.r}"][data-c="${active.c}"]`)?.closest('td')?.classList.add('act');
    grid.querySelector(`th.rowhead[data-r="${active.r}"]`)?.classList.add('on');
    grid.querySelector(`th.col[data-c="${active.c}"]`)?.classList.add('on');
  }

  function alignButton(c, a, icon, label) {
    const b = document.createElement('button');
    b.type = 'button';
    b.title = label;
    b.setAttribute('aria-label', `${label} (colonne ${c + 1})`);
    b.setAttribute('aria-pressed', String(model.aligns[c] === a));
    b.innerHTML = `<svg><use href="#i-${icon}"/></svg>`;
    b.addEventListener('click', () => {
      model.aligns[c] = a;
      b.parentElement.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      updatePreview();
    });
    return b;
  }

  function startResize(e, c, handle) {
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    handle.classList.add('on');
    const x0 = e.clientX;
    const w0 = columnWidths(model)[c];
    const th = grid.querySelector(`th.col[data-c="${c}"]`);
    const inp = th.querySelector('input');
    const move = (ev) => {
      const w = Math.max(1, Math.round(w0 + (ev.clientX - x0) / charPx));
      model.colWidths[c] = w;
      th.style.width = colCssWidth(c);
      inp.value = w;
      updatePreview();
    };
    const up = () => {
      handle.classList.remove('on');
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
      grid.querySelectorAll('textarea').forEach(autosize);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  }

  function pasteInto(r, c, text) {
    const rows = text.replace(/\r/g, '').replace(/\n$/, '').split('\n').map((l) => l.split('\t'));
    rows.forEach((cols, i) => {
      while (model.cells.length <= r + i) model = insertRow(model, model.cells.length);
      cols.forEach((val, j) => {
        while (model.colWidths.length <= c + j) model = insertCol(model, model.colWidths.length);
        model.cells[r + i][c + j] = val;
      });
    });
    rebuild();
    focusCell(r, c);
  }

  function rebuild() {
    grid.replaceChildren();
    const nCols = model.colWidths.length;
    const thead = document.createElement('thead');
    const hr = document.createElement('tr');
    const corner = document.createElement('th');
    corner.className = 'corner';
    hr.appendChild(corner);
    for (let c = 0; c < nCols; c++) {
      const th = document.createElement('th');
      th.className = 'col';
      th.dataset.c = c;
      th.style.width = colCssWidth(c);
      const ctl = document.createElement('div');
      ctl.className = 'colctl';
      ctl.append(
        alignButton(c, 'l', 'left', 'Aligner à gauche'),
        alignButton(c, 'c', 'center', 'Centrer'),
        alignButton(c, 'r', 'right', 'Aligner à droite'),
      );
      const wi = document.createElement('input');
      wi.type = 'number';
      wi.min = 1;
      wi.max = 200;
      wi.inputMode = 'numeric';
      wi.placeholder = 'auto';
      wi.title = 'Largeur de la colonne en caractères (vide = automatique)';
      wi.setAttribute('aria-label', `Largeur de la colonne ${c + 1}`);
      wi.value = model.colWidths[c] || '';
      wi.addEventListener('input', () => {
        const v = parseInt(wi.value, 10);
        model.colWidths[c] = v > 0 ? v : null;
        th.style.width = colCssWidth(c);
        updatePreview();
        grid.querySelectorAll('textarea').forEach(autosize);
      });
      wi.addEventListener('focus', () => { active.c = c; markActive(); });
      ctl.appendChild(wi);
      const rs = document.createElement('div');
      rs.className = 'rs';
      rs.title = 'Glisser pour redimensionner la colonne';
      rs.addEventListener('pointerdown', (e) => startResize(e, c, rs));
      th.append(ctl, rs);
      hr.appendChild(th);
    }
    thead.appendChild(hr);

    const tbody = document.createElement('tbody');
    model.cells.forEach((row, r) => {
      const tr = document.createElement('tr');
      const rh = document.createElement('th');
      rh.className = 'rowhead';
      rh.dataset.r = r;
      rh.textContent = r + 1;
      tr.appendChild(rh);
      row.forEach((val, c) => {
        const td = document.createElement('td');
        const ta = document.createElement('textarea');
        ta.rows = 1;
        ta.value = val;
        ta.dataset.r = r;
        ta.dataset.c = c;
        ta.spellcheck = false;
        ta.setAttribute('aria-label', `Ligne ${r + 1}, colonne ${c + 1}`);
        ta.addEventListener('input', () => {
          model.cells[r][c] = ta.value;
          autosize(ta);
          updatePreview();
        });
        ta.addEventListener('focus', () => { active = { r, c }; markActive(); });
        ta.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
            e.preventDefault();
            if (r === model.cells.length - 1) {
              model = insertRow(model, r + 1);
              rebuild();
            }
            focusCell(r + 1, c);
          } else if (e.key === 'Tab' && !e.shiftKey && r === model.cells.length - 1 && c === nCols - 1) {
            e.preventDefault();
            model = insertRow(model, r + 1);
            rebuild();
            focusCell(r + 1, 0);
          }
        });
        ta.addEventListener('paste', (e) => {
          const t = e.clipboardData?.getData('text/plain') ?? '';
          if (/[\t\n]/.test(t.replace(/\n$/, ''))) {
            e.preventDefault();
            pasteInto(r, c, t);
          }
        });
        td.appendChild(ta);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    grid.append(thead, tbody);
    grid.querySelectorAll('textarea').forEach(autosize);
    markActive();
    updatePreview();
  }

  // ---------- actions de la barre d'outils ----------
  const actions = {
    'row-above': () => { model = insertRow(model, active.r); rebuild(); focusCell(active.r, active.c); },
    'row-below': () => { model = insertRow(model, active.r + 1); active.r += 1; rebuild(); focusCell(active.r, active.c); },
    'row-del': () => { model = removeRow(model, active.r); active.r = Math.min(active.r, model.cells.length - 1); rebuild(); focusCell(active.r, active.c); },
    'col-left': () => { model = insertCol(model, active.c); rebuild(); focusCell(active.r, active.c); },
    'col-right': () => { model = insertCol(model, active.c + 1); active.c += 1; rebuild(); focusCell(active.r, active.c); },
    'col-del': () => { model = removeCol(model, active.c); active.c = Math.min(active.c, model.colWidths.length - 1); rebuild(); focusCell(active.r, active.c); },
    auto: () => { model.colWidths = model.colWidths.map(() => null); rebuild(); },
  };

  return new Promise((resolve) => {
    const onToolClick = (e) => {
      const b = e.target.closest('[data-te]');
      if (b) actions[b.dataset.te]?.();
    };
    const onStyle = () => { model.style = styleSel.value; updatePreview(); };
    const onRowLines = () => { model.rowLines = rowlinesSel.value; updatePreview(); };
    const onHeader = () => { model.header = headerChk.checked; updatePreview(); };
    const onOk = () => dlg.close('ok');
    const onCloseBtn = (e) => { if (e.target.closest('[data-close]')) dlg.close('cancel'); };

    $('te-tools').addEventListener('click', onToolClick);
    styleSel.addEventListener('change', onStyle);
    rowlinesSel.addEventListener('change', onRowLines);
    headerChk.addEventListener('change', onHeader);
    $('te-ok').addEventListener('click', onOk);
    dlg.addEventListener('click', onCloseBtn);

    const finish = () => {
      $('te-tools').removeEventListener('click', onToolClick);
      styleSel.removeEventListener('change', onStyle);
      rowlinesSel.removeEventListener('change', onRowLines);
      headerChk.removeEventListener('change', onHeader);
      $('te-ok').removeEventListener('click', onOk);
      dlg.removeEventListener('click', onCloseBtn);
      dlg.removeEventListener('close', finish);
      resolve(dlg.returnValue === 'ok' ? renderTable(model, { indent }) : null);
    };
    dlg.addEventListener('close', finish);

    dlg.returnValue = '';
    dlg.showModal();
    charPx = measureChar();
    syncControls();
    rebuild();
    focusCell(0, 0);
  });
}
