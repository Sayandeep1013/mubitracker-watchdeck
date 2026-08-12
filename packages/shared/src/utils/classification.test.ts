import { describe, expect, it } from 'vitest';
import { classifyMedia } from './classification.js';
import { TMDB_GENRE_ANIMATION, TMDB_GENRE_DOCUMENTARY } from '../constants/tmdb.js';

describe('classifyMedia', () => {
  it('classifies Japanese animation as anime', () => {
    expect(classifyMedia([TMDB_GENRE_ANIMATION], 'ja')).toBe('anime');
  });

  it('classifies non-Japanese animation as animation', () => {
    expect(classifyMedia([TMDB_GENRE_ANIMATION], 'en')).toBe('animation');
  });

  it('classifies documentary genre', () => {
    expect(classifyMedia([TMDB_GENRE_DOCUMENTARY], 'en')).toBe('documentary');
  });

  it('defaults to live_action', () => {
    expect(classifyMedia([28], 'en')).toBe('live_action');
  });
});
