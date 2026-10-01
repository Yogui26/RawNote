// Réglages utilisateur (stockés uniquement dans le navigateur).

const KEY = 'rawnote:settings';

export const DEFAULTS = {
  theme: 'auto',
  fontSize: 16,
  wrap: false,
  bulletSet: 'unicode',
  justifyLast: false,
  alignWidth: '',
  autoContinue: true,
  autosave: true,
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    return { ...DEFAULTS, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch { /* stockage indisponible : on ignore */ }
}

export function applySettings(s, editorEl) {
  const root = document.documentElement;
  if (s.theme === 'light' || s.theme === 'dark') root.dataset.theme = s.theme;
  else delete root.dataset.theme;
  root.style.setProperty('--font-size', `${Math.min(40, Math.max(9, Number(s.fontSize) || 16))}px`);
  editorEl.classList.toggle('wrap', !!s.wrap);
  editorEl.wrap = s.wrap ? 'soft' : 'off';
}

export function loadDraft() {
  try {
    return localStorage.getItem('rawnote:doc') || '';
  } catch {
    return '';
  }
}

let timer = null;
export function saveDraftSoon(text) {
  clearTimeout(timer);
  timer = setTimeout(() => {
    try {
      localStorage.setItem('rawnote:doc', text);
    } catch { /* quota dépassé ou stockage bloqué */ }
  }, 400);
}

export function clearDraft() {
  try {
    localStorage.removeItem('rawnote:doc');
  } catch { /* rien */ }
}
