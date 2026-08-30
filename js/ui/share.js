import { getDailyName } from './names.js?v=3';

const GAME_SITE_URL = 'https://mindtwistgames.com';

/**
 * @param {string[][]} resultGrid rows of 'up'|'down'|'exact'
 * @param {number} guessCount
 */
export function buildShareText(resultGrid, guessCount) {
  const won = resultGrid.length && resultGrid[resultGrid.length - 1].every((t) => t === 'exact');
  const score = won ? guessCount : 'X';
  const up = String.fromCodePoint(0x1f534);
  const down = String.fromCodePoint(0x1f535);
  const exact = String.fromCodePoint(0x1f7e2);
  const name = getDailyName();
  let text = 'SKEWRD ' + score + '/6 — ' + name + '\n\n';
  text += resultGrid
    .map((row) =>
      row.map((t) => (t === 'up' ? up : t === 'down' ? down : exact)).join('')
    )
    .join('\n');
  text += '\n\n' + GAME_SITE_URL;
  return text;
}

export function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}

/**
 * @param {string[][]} resultGrid
 * @param {number} guessCount
 */
export async function shareResult(resultGrid, guessCount) {
  const text = buildShareText(resultGrid, guessCount);

  if (navigator.share) {
    try {
      await navigator.share({ title: 'SKEWRD', text, url: GAME_SITE_URL });
    } catch {
      /* cancelled */
    }
  } else if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      showToast('COPIED!');
    } catch {
      showToast('COPY FAILED');
    }
  } else {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('COPIED!');
  }
}
