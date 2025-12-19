
import { Word } from '../types';

/**
 * SuperMemo-2 Algorithm implementation
 * quality: 0-5 (0: total failure, 5: perfect response)
 */
export function updateWordProgress(word: Word, quality: number): Word {
  let { repetition, interval, easeFactor } = word;

  if (quality >= 3) {
    if (repetition === 0) {
      interval = 1;
    } else if (repetition === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetition += 1;
  } else {
    repetition = 0;
    interval = 1;
  }

  easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (easeFactor < 1.3) easeFactor = 1.3;

  const nextReviewDate = Date.now() + interval * 24 * 60 * 60 * 1000;

  return {
    ...word,
    repetition,
    interval,
    easeFactor,
    nextReviewDate
  };
}
