import { getDailyAnswerForDaySlot } from './rng.js';

const DICT_URL = 'https://api.dictionaryapi.dev/api/v2/entries/en/';
const MAX_SKIP = 30;

/**
 * Picks a secret word: same chain as findValidWord — try dictionary until valid entry.
 * @param {string[]} answers
 * @param {number} [startOffset]
 * @returns {Promise<string>}
 */
export async function resolveSecretWord(answers, startOffset = 0) {
  const baseDay = Math.floor(Date.now() / 86400000);

  async function tryOffset(offset) {
    if (offset > MAX_SKIP) {
      return getDailyAnswerForDaySlot(answers, baseDay);
    }
    const daySlot = baseDay + offset;
    const candidate = getDailyAnswerForDaySlot(answers, daySlot);
    try {
      const r = await fetch(DICT_URL + candidate.toLowerCase());
      if (!r.ok) return tryOffset(offset + 1);
      const data = await r.json();
      if (data && data[0] && data[0].meanings && data[0].meanings.length > 0) {
        return candidate;
      }
      return tryOffset(offset + 1);
    } catch {
      return tryOffset(offset + 1);
    }
  }

  return tryOffset(startOffset);
}

/**
 * @param {string} word
 * @param {(pos: string, def: string) => void} onDefinition
 */
export async function fetchDefinitionSnippet(word, onDefinition) {
  try {
    const r = await fetch(DICT_URL + word.toLowerCase());
    if (!r.ok) return;
    const data = await r.json();
    const meaning = data[0].meanings[0];
    const pos = meaning.partOfSpeech;
    const def = meaning.definitions[0].definition;
    onDefinition(pos, def);
  } catch {
    /* ignore */
  }
}
