import { getDailyAnswerForDaySlot } from './rng.js';

const DICT_URL = 'https://api.dictionaryapi.dev/api/v2/entries/en/';
const DICT_FETCH_MS = 8000;

/**
 * @param {string} url
 * @param {number} ms
 */
async function fetchWithTimeout(url, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

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
 * @param {() => void} [onUnavailable]
 */
export async function fetchDefinitionSnippet(word, onDefinition, onUnavailable) {
  try {
    const r = await fetchWithTimeout(DICT_URL + word.toLowerCase(), DICT_FETCH_MS);
    if (!r.ok) {
      onUnavailable?.();
      return;
    }
    const data = await r.json();
    const meaning = data?.[0]?.meanings?.[0];
    const defObj = meaning?.definitions?.[0];
    if (!meaning || !defObj) {
      onUnavailable?.();
      return;
    }
    onDefinition(meaning.partOfSpeech, defObj.definition);
  } catch {
    onUnavailable?.();
  }
}
