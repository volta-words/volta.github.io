const FLOWERS = ['🌸', '🌼', '🌺', '🌻', '💐', '🌷', '🌹', '🏵️'];
const KT_KEY = 'ktmode';

const MOON = '\u263D';
const SUN = '\u2600';

let ktFlowers = [];

function spawnFlowers() {
  FLOWERS.forEach((f, i) => {
    const el = document.createElement('div');
    el.className = 'flower';
    el.textContent = f;
    el.style.left = 8 + i * 12 + '%';
    el.style.top = 10 + Math.random() * 80 + '%';
    el.style.fontSize = 18 + Math.random() * 16 + 'px';
    el.style.animationDuration = 4 + Math.random() * 4 + 's';
    el.style.animationDelay = -Math.random() * 4 + 's';
    document.body.appendChild(el);
    ktFlowers.push(el);
  });
}

function removeFlowers() {
  ktFlowers.forEach((el) => el.remove());
  ktFlowers = [];
}

export function syncKtToggleUi() {
  const btn = document.getElementById('kt-toggle');
  if (!btn) return;
  const kt = document.body.classList.contains('kt');
  btn.setAttribute('aria-pressed', kt ? 'true' : 'false');
  btn.textContent = kt ? SUN : MOON;
  btn.title = kt ? 'KT mode (warm theme)' : 'Default theme';
}

export function isKtMode() {
  return document.body.classList.contains('kt');
}

export function toggleKT() {
  const body = document.body;
  if (body.classList.contains('kt')) {
    body.classList.remove('kt');
    removeFlowers();
    localStorage.removeItem(KT_KEY);
  } else {
    body.classList.add('kt');
    spawnFlowers();
    localStorage.setItem(KT_KEY, '1');
  }
  syncKtToggleUi();
}

export function restoreKtFromStorage() {
  if (localStorage.getItem(KT_KEY) === '1') {
    document.body.classList.add('kt');
    spawnFlowers();
  }
  syncKtToggleUi();
}
