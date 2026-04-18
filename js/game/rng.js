/**
 * Mulberry32 — same algorithm as original volta.html
 * @param {number} seed
 * @returns {() => number} PRNG in [0, 1)
 */
export function seededRand(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @param {string[]} answers
 * @param {number} daySlot Math.floor(Date.now()/864e5) + offset
 */
export function getDailyAnswerForDaySlot(answers, daySlot) {
  if (!answers.length) return '';
  const rand = seededRand(daySlot * 2654435761);
  const idx = Math.floor(rand() * answers.length);
  return answers[idx];
}
