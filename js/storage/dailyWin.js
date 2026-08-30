import { evaluateGuess, isWin } from '../game/rules.js?v=4';

const STORAGE_KEY = 'skewrdDailyWin';

export function getDayEpoch() {
  return Math.floor(Date.now() / 86400000);
}

/**
 * @returns {{ secretWord: string, guessWords: string[], resultGrid: string[][] } | null}
 */
export function loadTodayWin() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
  } catch {
    return null;
  }

  let o;
  try {
    o = JSON.parse(raw);
  } catch {
    clearTodayWin();
    return null;
  }

  if (o.v !== 1 || o.day !== getDayEpoch()) return null;
  if (typeof o.secretWord !== 'string' || o.secretWord.length !== 5 || !/^[A-Z]+$/.test(o.secretWord)) {
    clearTodayWin();
    return null;
  }
  if (!Array.isArray(o.guessWords) || o.guessWords.length < 1 || o.guessWords.length > 6) {
    clearTodayWin();
    return null;
  }
  for (const w of o.guessWords) {
    if (typeof w !== 'string' || w.length !== 5 || !/^[A-Z]+$/.test(w)) {
      clearTodayWin();
      return null;
    }
  }

  const lastResult = evaluateGuess(o.secretWord, o.guessWords[o.guessWords.length - 1]);
  if (!isWin(lastResult)) {
    clearTodayWin();
    return null;
  }

  let resultGrid;
  if (Array.isArray(o.resultGrid) && o.resultGrid.length === o.guessWords.length) {
    const ok = o.resultGrid.every((row, i) => {
      if (!Array.isArray(row) || row.length !== 5) return false;
      const expected = evaluateGuess(o.secretWord, o.guessWords[i]).map((r) => r.type);
      return row.every((cell, j) => cell === expected[j]);
    });
    if (!ok) {
      clearTodayWin();
      return null;
    }
    resultGrid = o.resultGrid.map((row) => row.slice());
  } else {
    resultGrid = o.guessWords.map((w) => evaluateGuess(o.secretWord, w).map((r) => r.type));
  }

  return {
    secretWord: o.secretWord,
    guessWords: o.guessWords.slice(),
    resultGrid,
  };
}

/**
 * @param {{ secretWord: string, guessWords: string[], resultGrid: string[][] }} payload
 */
export function saveTodayWin(payload) {
  try {
    const data = {
      v: 1,
      day: getDayEpoch(),
      secretWord: payload.secretWord,
      guessWords: payload.guessWords,
      resultGrid: payload.resultGrid,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearTodayWin() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
