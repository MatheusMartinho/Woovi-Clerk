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

  it('acima de 1h ganha segmento de horas — TTL de 24h do sandbox mostra 24:00:00, não 1440:00', () => {
    expect(formatCountdown(86_400_000)).toBe('24:00:00');
    expect(formatCountdown(3_600_000)).toBe('1:00:00');
    expect(formatCountdown(3_661_000)).toBe('1:01:01');
    expect(formatCountdown(3_599_000)).toBe('59:59'); // 1s antes de 1h continua mm:ss
  });
});
