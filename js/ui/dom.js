/** @typedef {import('../game/rules.js').LetterResult} LetterResult */
/** @typedef {import('../game/rules.js').PosRange} PosRange */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/**
 * @param {string[][]} kbRows
 * @param {(key: string) => void} onKey
 */
export function initKeyboard(kbRows, onKey) {
  kbRows.forEach((row, ri) => {
    const rowEl = document.getElementById('kb-row-' + ri);
    rowEl.innerHTML = '';
    row.forEach((key) => {
      const btn = document.createElement('button');
      btn.className = 'key' + (key.length > 1 ? ' wide' : '');
      btn.textContent = key;
      btn.dataset.key = key;
      btn.addEventListener('click', () => onKey(key));
      rowEl.appendChild(btn);
    });
  });
}

/**
 * @param {string} word
 * @param {LetterResult[]} result
 */
export function renderGuessRow(word, result) {
  const board = document.getElementById('game-board');
  const row = document.createElement('div');
  row.className = 'row';
  result.forEach((r, i) => {
    const cell = document.createElement('div');
    cell.className = 'cell';
    const arrow = document.createElement('span');
    arrow.className = 'arrow';
    arrow.textContent = r.type === 'up' ? '\u2191' : r.type === 'down' ? '\u2193' : '\u2713';
    cell.appendChild(arrow);
    cell.appendChild(document.createTextNode(r.letter));
    setTimeout(() => cell.classList.add('revealed', r.type), i * 80);
    row.appendChild(cell);
  });
  board.appendChild(row);
}

/**
 * @param {string[]} currentInput
 */
export function updateInputCells(currentInput) {
  for (let i = 0; i < 5; i++) {
    const cell = document.getElementById('ic' + i);
    cell.textContent = currentInput[i] || '';
    cell.className = 'input-cell';
    if (i === currentInput.length) cell.classList.add('active');
    if (currentInput[i]) cell.classList.add('has-letter');
  }
}

/**
 * @param {PosRange[]} posRanges
 * @param {number} cursorIndex active position 0..4
 */
export function refreshKeyboardHighlight(posRanges, cursorIndex) {
  let pos = cursorIndex;
  if (pos > 4) pos = 4;
  const range = posRanges[pos];
  ALPHABET.forEach((letter) => {
    const btn = document.querySelector('.key[data-key="' + letter + '"]');
    if (!btn) return;
    const valid = letter >= range.lo && letter <= range.hi;
    btn.classList.remove('in-range', 'out-of-range');
    btn.classList.add(valid ? 'in-range' : 'out-of-range');
  });
}

export function flashInputPop(index) {
  const cell = document.getElementById('ic' + index);
  cell.classList.add('pop');
  setTimeout(() => cell.classList.remove('pop'), 150);
}

export function clearGameBoard() {
  document.getElementById('game-board').innerHTML = '';
}

export function showMessage(msg) {
  const el = document.getElementById('message');
  el.textContent = msg;
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
  setTimeout(() => {
    el.textContent = '';
    el.classList.remove('shake');
  }, 1800);
}

export function hideEndPanel() {
  document.getElementById('end-panel').classList.remove('show');
}

export function showPlayingChrome() {
  document.getElementById('input-row').style.display = 'grid';
  document.getElementById('keyboard').style.display = 'flex';
  document.getElementById('message').textContent = '';
}

/** Persistent status line (unlike showMessage, does not auto-clear). */
export function setStatusMessage(msg) {
  document.getElementById('message').textContent = msg;
}

/** @param {boolean} enabled */
export function setGameInputEnabled(enabled) {
  const inputRow = document.getElementById('input-row');
  const keyboard = document.getElementById('keyboard');
  if (!inputRow || !keyboard) return;
  inputRow.style.pointerEvents = enabled ? '' : 'none';
  keyboard.style.pointerEvents = enabled ? '' : 'none';
  inputRow.style.opacity = enabled ? '' : '0.5';
  keyboard.style.opacity = enabled ? '' : '0.5';
}

/**
 * @param {boolean} won
 * @param {string} secretWord
 * @param {number} guessCount
 * @param {string} dailyName
 * @param {(word: string, el: HTMLElement) => void} fetchDef
 */
export function showEndPanel(won, secretWord, guessCount, dailyName, fetchDef) {
  document.getElementById('input-row').style.display = 'none';
  const title = document.getElementById('end-title');
  const wordEl = document.getElementById('end-word');
  const defEl = document.getElementById('end-def');
  const nameEl = document.getElementById('end-name');
  nameEl.textContent = dailyName;
  title.textContent = won ? 'SOLVED!' : 'GAME OVER';
  title.className = 'end-title ' + (won ? 'win' : 'lose');
  wordEl.textContent = won
    ? 'IN ' + guessCount + ' GUESS' + (guessCount === 1 ? '' : 'ES')
    : 'THE WORD WAS: ' + secretWord;
  defEl.textContent = '';
  document.getElementById('end-panel').classList.add('show');
  fetchDef(secretWord, defEl);
}

export function showModal() {
  document.getElementById('modal').classList.add('show');
}

/**
 * @param {MouseEvent} [e]
 */
export function hideModal(e) {
  const modal = document.getElementById('modal');
  if (!e || e.target === modal) {
    modal.classList.remove('show');
    localStorage.setItem('skewrdPlayed', '1');
  }
}

/**
 * Wire static controls (help, modal, KT toggle, end buttons — callbacks from main)
 */
export function bindChrome({
  onToggleKt,
  onShowHelp,
  onPlayAgain,
  onShare,
}) {
  const ktToggle = document.getElementById('kt-toggle');
  if (ktToggle) ktToggle.addEventListener('click', onToggleKt);
  document.querySelector('.help-btn').addEventListener('click', onShowHelp);
  document.getElementById('modal').addEventListener('click', (e) => hideModal(e));
  document.querySelector('.close-modal').addEventListener('click', () => hideModal());
  document.querySelector('.share-btn').addEventListener('click', onShare);
  document.querySelector('.play-again-btn').addEventListener('click', onPlayAgain);
}

export function maybeShowFirstVisitModal() {
  if (!localStorage.getItem('skewrdPlayed')) {
    setTimeout(showModal, 400);
  }
}
