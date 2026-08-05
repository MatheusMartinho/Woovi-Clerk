import { describe, expect, it } from 'vitest';
import { formatBRL, formatCountdown } from './texts';

describe('formatBRL — centavos inteiros para moeda pt-BR', () => {
  it('5000 → R$ 50,00', () => {
    // Intl usa espaço não separável entre R$ e o número
    expect(formatBRL(5000).replace(/ /g, ' ')).toBe('R$ 50,00');
  });

  it('1 centavo e valores grandes', () => {
    expect(formatBRL(1).replace(/ /g, ' ')).toBe('R$ 0,01');
    expect(formatBRL(123456789).replace(/ /g, ' ')).toBe('R$ 1.234.567,89');
  });
});

describe('formatCountdown — mm:ss com piso em zero', () => {
  it('90s → 01:30', () => {
    expect(formatCountdown(90_000)).toBe('01:30');
  });

  it('nunca fica negativo', () => {
    expect(formatCountdown(-5_000)).toBe('00:00');
  });

  it('arredonda para baixo (999ms ainda é 00:00)', () => {
    expect(formatCountdown(999)).toBe('00:00');
  });
});
