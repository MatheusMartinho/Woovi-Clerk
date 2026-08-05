import { describe, expect, it } from 'vitest';
import { FAST_POLL_MS, FAST_WINDOW_MS, nextDelay, SLOW_POLL_MS } from './polling';

describe('nextDelay — 3s na janela rápida, 10s depois', () => {
  it('começa rápido', () => {
    expect(nextDelay(0)).toBe(FAST_POLL_MS);
  });

  it('continua rápido até um instante antes de 2 minutos', () => {
    expect(nextDelay(FAST_WINDOW_MS - 1)).toBe(FAST_POLL_MS);
  });

  it('desacelera exatamente aos 2 minutos', () => {
    expect(nextDelay(FAST_WINDOW_MS)).toBe(SLOW_POLL_MS);
  });

  it('permanece lento depois', () => {
    expect(nextDelay(FAST_WINDOW_MS * 10)).toBe(SLOW_POLL_MS);
  });
});
