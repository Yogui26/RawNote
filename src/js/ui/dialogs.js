// Petits utilitaires d'interface : toast, saisie de texte, menus déroulants.

let toastTimer = null;
export function toast(msg, ms = 2600) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, ms);
}

/**
 * Demande un texte (éventuellement multiligne) dans un petit dialogue.
 * @returns {Promise<string|null>} null si annulé
 */
export function askText({ title = 'Texte', value = '', ok = 'OK', placeholder = '' } = {}) {
  const dlg = document.getElementById('dlg-prompt');
  const input = document.getElementById('pr-input');
  document.getElementById('pr-title').textContent = title;
  document.getElementById('pr-ok').textContent = ok;
  input.value = value;
  input.placeholder = placeholder;

  return new Promise((resolve) => {
    const onKey = (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        dlg.close('ok');
      }
    };
    const onNl = () => {
      const s = input.selectionStart;
      input.setRangeText('\n', s, input.selectionEnd, 'end');
      input.focus();
    };
    const finish = () => {
      input.removeEventListener('keydown', onKey);
      document.getElementById('pr-nl').removeEventListener('click', onNl);
      dlg.removeEventListener('close', finish);
      resolve(dlg.returnValue === 'ok' ? input.value : null);
    };
    input.addEventListener('keydown', onKey);
    document.getElementById('pr-nl').addEventListener('click', onNl);
    dlg.addEventListener('close', finish);
    dlg.returnValue = '';
    dlg.showModal();
    input.focus();
    input.select();
  });
}

/** Menus déroulants : un bouton [data-menu="id"] ouvre l'élément #id placé sous lui. */
export function initMenus() {
  const closeAll = (except = null) => {
    document.querySelectorAll('.menu').forEach((m) => {
      if (m !== except) m.hidden = true;
    });
    document.querySelectorAll('[data-menu]').forEach((b) => {
      const m = document.getElementById(b.dataset.menu);
      b.setAttribute('aria-expanded', String(!!m && !m.hidden));
    });
  };

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-menu]');
    if (!btn) {
      closeAll();
      return;
    }
    const menu = document.getElementById(btn.dataset.menu);
    const opening = menu.hidden;
    closeAll(opening ? menu : null);
    menu.hidden = !opening;
    btn.setAttribute('aria-expanded', String(opening));
    if (opening) {
      const r = btn.getBoundingClientRect();
      const w = menu.offsetWidth;
      menu.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - w - 8))}px`;
      menu.style.top = `${r.bottom + 4}px`;
      menu.querySelector('button')?.focus({ preventScroll: true });
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAll();
  });
  window.addEventListener('resize', () => closeAll());
}
