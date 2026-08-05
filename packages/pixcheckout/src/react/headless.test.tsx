/**
 * US2: prova executável de que a camada headless sustenta uma UI própria —
 * um componente de TEXTO PURO percorre criando → aguardando → pago usando
 * só usePixCharge(), sem importar nenhum componente visual da biblioteca.
 */
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoreClient } from '../core/client';
import type { Charge, ChargeStatus, CreateChargePayload } from '../core/types';
import * as publicApi from '../index';
import { usePixCharge } from './usePixCharge';
import { WooviProvider } from './WooviProvider';

function make(correlationID: string, status: ChargeStatus): Charge {
  return {
    correlationID,
    value: 5000,
    status,
    brCode: 'br-code-headless',
    expiresAt: Date.now() + 15 * 60 * 1000,
  };
}

function TextOnlyCheckout() {
  const { state, remainingMs } = usePixCharge({ amount: 5000 });
  return (
    <p>
      estado: {state.status} / restante: {Math.ceil(remainingMs / 1000)}s
    </p>
  );
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('headless (US2)', () => {
  it('texto puro percorre creating → awaiting_payment → paid só com o hook', async () => {
    let status: ChargeStatus = 'ACTIVE';
    const client: CoreClient = {
      createCharge: async (payload: CreateChargePayload) => make(payload.correlationID, 'ACTIVE'),
      getCharge: async (correlationID: string) => make(correlationID, status),
    };

    render(
      <WooviProvider client={client}>
        <TextOnlyCheckout />
      </WooviProvider>,
    );

    expect(screen.getByText(/estado: creating/)).toBeDefined();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText(/estado: awaiting_payment/)).toBeDefined();

    status = 'COMPLETED';
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });
    expect(screen.getByText(/estado: paid/)).toBeDefined();
  });

  it('a superfície pública expõe o caminho headless e não vaza internos', () => {
    expect(typeof publicApi.usePixCharge).toBe('function');
    expect(typeof publicApi.WooviProvider).toBe('function');
    expect(typeof publicApi.PixCheckout).toBe('function');
    // presentational escape hatch para composição avançada
    expect(typeof publicApi.PixCheckoutView).toBe('function');
    // internos NÃO exportados
    expect('injectStyles' in publicApi).toBe(false);
    expect('transition' in publicApi).toBe(false);
  });
});
