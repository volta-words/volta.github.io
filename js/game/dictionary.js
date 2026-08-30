import { getDailyAnswerForDaySlot } from './rng.js';

const DICT_URL = 'https://api.dictionaryapi.dev/api/v2/entries/en/';

/**
 * Picks today's secret word from the local answer list (no network).
 * @param {string[]} answers
 * @param {number} [startOffset] day-slot offset (defaults to today)
 * @returns {string}
 */
export function resolveSecretWord(answers, startOffset = 0) {
  const baseDay = Math.floor(Date.now() / 86400000);
  return getDailyAnswerForDaySlot(answers, baseDay + startOffset);
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
