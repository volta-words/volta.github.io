export const MAX_GUESSES = 6;

/** @typedef {'exact'|'up'|'down'} ResultType */
/** @typedef {{ letter: string, type: ResultType }} LetterResult */
/** @typedef {{ lo: string, hi: string, exact: boolean }} PosRange */

/**
 * @param {string} secret
 * @param {string} guessWord
 * @returns {LetterResult[]}
 */
export function evaluateGuess(secret, guessWord) {
  return guessWord.split('').map((letter, i) => {
    const target = secret[i];
    if (letter === target) return { letter, type: 'exact' };
    if (letter < target) return { letter, type: 'up' };
    return { letter, type: 'down' };
  });
}

/** @returns {PosRange[]} */
export function initialPosRanges() {
  return [
    { lo: 'A', hi: 'Z', exact: false },
    { lo: 'A', hi: 'Z', exact: false },
    { lo: 'A', hi: 'Z', exact: false },
    { lo: 'A', hi: 'Z', exact: false },
    { lo: 'A', hi: 'Z', exact: false },
  ];
}

/**
 * Mutates ranges in place (same semantics as original updateRanges).
 * @param {PosRange[]} ranges
 * @param {LetterResult[]} result
 */
export function updatePosRanges(ranges, result) {
  result.forEach((r, i) => {
    if (r.type === 'exact') {
      ranges[i].lo = r.letter;
      ranges[i].hi = r.letter;
      ranges[i].exact = true;
    } else if (r.type === 'up') {
      const next = String.fromCharCode(r.letter.charCodeAt(0) + 1);
      if (next <= 'Z' && next > ranges[i].lo) ranges[i].lo = next;
    } else if (r.type === 'down') {
      const prev = String.fromCharCode(r.letter.charCodeAt(0) - 1);
      if (prev >= 'A' && prev < ranges[i].hi) ranges[i].hi = prev;
    }
  });
}

/** @param {LetterResult[]} result */
export function isWin(result) {
  return result.every((r) => r.type === 'exact');
}

/** @param {string} word */
/** @param {Set<string>} validSet */
export function isAllowedGuess(word, validSet) {
  return validSet.has(word);
}
