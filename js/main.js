import {
  evaluateGuess,
  initialPosRanges,
  updatePosRanges,
  isWin,
  MAX_GUESSES,
  isAllowedGuess,
} from './game/rules.js';
import { resolveSecretWord, fetchDefinitionSnippet } from './game/dictionary.js';
import {
  initKeyboard,
  renderGuessRow,
  updateInputCells,
  refreshKeyboardHighlight,
  flashInputPop,
  clearGameBoard,
  showMessage,
  setStatusMessage,
  setGameInputEnabled,
  hideEndPanel,
  showPlayingChrome,
  showEndPanel,
  bindChrome,
  maybeShowFirstVisitModal,
  showModal,
} from './ui/dom.js';
import { shareResult } from './ui/share.js';
import { getDailyName } from './ui/names.js';
import { toggleKT, restoreKtFromStorage } from './ui/kt.js';
import { loadTodayWin, saveTodayWin, clearTodayWin } from './storage/dailyWin.js';

const KB_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'DEL'],
];

let allValid = new Set();
let answers = [];

let secretWord = '';
let guesses = [];
let currentInput = [];
let gameOver = false;
let gameReady = false;
let initGeneration = 0;
let resultGrid = [];
let posRanges = initialPosRanges();

async function loadWordData() {
  const [wRes, aRes] = await Promise.all([
    fetch('data/words.json'),
    fetch('data/answers.json'),
  ]);
  if (!wRes.ok || !aRes.ok) {
    throw new Error('word data fetch failed');
  }
  const words = await wRes.json();
  const answerList = await aRes.json();
  if (!Array.isArray(words) || !Array.isArray(answerList) || answerList.length === 0) {
    throw new Error('invalid word data');
  }
  answers = answerList;
  allValid = new Set(words);
}

function handleKey(key) {
  if (gameOver || !gameReady) return;
  if (key === 'DEL' || key === 'BACKSPACE') {
    if (currentInput.length > 0) {
      currentInput.pop();
      updateInputCells(currentInput);
      refreshKeyboardHighlight(posRanges, currentInput.length);
    }
    return;
  }
  if (key === 'ENTER') {
    submitGuess();
    return;
  }
  if (/^[A-Z]$/.test(key) && currentInput.length < 5) {
    currentInput.push(key);
    updateInputCells(currentInput);
    flashInputPop(currentInput.length - 1);
    refreshKeyboardHighlight(posRanges, currentInput.length);
  }
}

function submitGuess() {
  if (!gameReady) {
    showMessage('LOADING...');
    return;
  }
  if (!secretWord) {
    showMessage('CANNOT START GAME');
    return;
  }
  if (currentInput.length < 5) {
    showMessage('NOT ENOUGH LETTERS');
    return;
  }
  const word = currentInput.join('');
  if (!isAllowedGuess(word, allValid)) {
    showMessage('NOT IN WORD LIST');
    return;
  }
  const result = evaluateGuess(secretWord, word);
  guesses.push({ word, result });
  resultGrid.push(result.map((r) => r.type));
  renderGuessRow(word, result);
  updatePosRanges(posRanges, result);
  currentInput = [];
  updateInputCells(currentInput);
  refreshKeyboardHighlight(posRanges, 0);

  if (isWin(result)) {
    gameOver = true;
    setTimeout(() => endGame(true), 600);
  } else if (guesses.length >= MAX_GUESSES) {
    gameOver = true;
    setTimeout(() => endGame(false), 600);
  }
}

function loadDefinition(word, defEl) {
  defEl.textContent = 'Loading definition…';
  fetchDefinitionSnippet(
    word,
    (pos, def) => {
      defEl.textContent = pos + ': ' + def;
    },
    () => {
      defEl.textContent = 'Definition unavailable.';
    }
  );
}

function endGame(won) {
  showEndPanel(won, secretWord, guesses.length, getDailyName(), (word, defEl) => {
    loadDefinition(word, defEl);
  });
  if (won) {
    saveTodayWin({
      secretWord,
      guessWords: guesses.map((g) => g.word),
      resultGrid: resultGrid.map((row) => row.slice()),
    });
  }
}

async function initGame() {
  const gen = ++initGeneration;
  gameReady = false;
  posRanges = initialPosRanges();
  guesses = [];
  currentInput = [];
  gameOver = false;
  resultGrid = [];
  secretWord = '';
  clearGameBoard();
  hideEndPanel();
  updateInputCells(currentInput);
  initKeyboard(KB_ROWS, handleKey);

  const saved = loadTodayWin();
  if (saved) {
    secretWord = saved.secretWord;
    resultGrid = saved.resultGrid.map((row) => row.slice());
    guesses = saved.guessWords.map((w) => ({
      word: w,
      result: evaluateGuess(secretWord, w),
    }));
    posRanges = initialPosRanges();
    guesses.forEach((g) => updatePosRanges(posRanges, g.result));
    gameOver = true;
    gameReady = true;
    guesses.forEach((g) => renderGuessRow(g.word, g.result));
    updateInputCells([]);
    document.getElementById('input-row').style.display = 'none';
    document.getElementById('keyboard').style.display = 'none';
    showEndPanel(true, secretWord, guesses.length, getDailyName(), (word, defEl) => {
      loadDefinition(word, defEl);
    });
    return;
  }

  showPlayingChrome();
  setGameInputEnabled(false);
  setStatusMessage('LOADING...');
  refreshKeyboardHighlight(posRanges, 0);

  maybeShowFirstVisitModal();

  secretWord = resolveSecretWord(answers, 0);
  if (gen !== initGeneration) return;

  if (!secretWord) {
    setStatusMessage('CANNOT START GAME');
    setGameInputEnabled(false);
    return;
  }

  setStatusMessage('');
  setGameInputEnabled(true);
  gameReady = true;
  refreshKeyboardHighlight(posRanges, currentInput.length);
}

async function bootstrap() {
  restoreKtFromStorage();
  try {
    await loadWordData();
  } catch {
    showMessage('WORD LIST FAILED TO LOAD');
    return;
  }

  bindChrome({
    onToggleKt: toggleKT,
    onShowHelp: () => showModal(),
    onPlayAgain: async () => {
      clearTodayWin();
      await initGame();
    },
    onShare: () => shareResult(resultGrid, guesses.length),
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace') handleKey('BACKSPACE');
    else if (e.key === 'Enter') handleKey('ENTER');
    else if (/^[a-zA-Z]$/.test(e.key)) handleKey(e.key.toUpperCase());
  });

  await initGame();
}

bootstrap();
