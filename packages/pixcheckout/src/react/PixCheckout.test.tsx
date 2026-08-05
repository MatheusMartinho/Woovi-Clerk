import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Charge, CheckoutState } from '../core/types';
import { PixApiError } from '../core/types';
import { texts } from '../i18n/texts';
import { PixCheckoutView } from './PixCheckout';

const charge: Charge = {
  correlationID: 'abc-123',
  value: 5000,
  status: 'ACTIVE',
  brCode: '000201br.gov.bcb.pix.teste.componente',
  expiresAt: Date.now() + 10 * 60 * 1000,
};

const noop = () => {};

function renderState(state: CheckoutState, handlers?: { onRetry?: () => void; onNewCharge?: () => void }) {
  return render(
    <PixCheckoutView
      state={state}
      remainingMs={90_000}
      onRetry={handlers?.onRetry ?? noop}
      onNewCharge={handlers?.onNewCharge ?? noop}
    />,
  );
}

describe('PixCheckoutView — uma interface por estado (FR-003)', () => {
  it('creating: esqueleto no formato do conteúdo, nunca spinner', () => {
    const { container } = renderState({ status: 'creating' });
    expect(screen.getByRole('status').getAttribute('aria-busy')).toBe('true');
    expect(container.querySelectorAll('.pixck-shimmer').length).toBeGreaterThanOrEqual(3);
  });

  it('awaiting: valor formatado, contador, botão de copiar e QR', () => {
    const { container } = renderState({ status: 'awaiting_payment', charge });
    expect(screen.getByText(/R\$\s*50,00/)).toBeDefined();
    expect(screen.getByRole('timer').textContent).toContain('01:30');
    expect(screen.getByRole('button', { name: texts.copy })).toBeDefined();
    expect(screen.getByRole('img', { name: /qr code/i })).toBeDefined();
    expect(container.querySelector('.pixck-qr svg')).not.toBeNull();
  });

  it('awaiting: copia e cola vem ANTES do QR no DOM (prioridade mobile, FR-009)', () => {
    const { container } = renderState({ status: 'awaiting_payment', charge });
    const copyArea = container.querySelector('.pixck-copyarea')!;
    const qrArea = container.querySelector('.pixck-qrarea')!;
    const position = copyArea.compareDocumentPosition(qrArea);
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('paid: confirmação com o valor', () => {
    renderState({ status: 'paid', charge: { ...charge, status: 'COMPLETED' } });
    expect(screen.getByText(texts.paidTitle)).toBeDefined();
    expect(screen.getByText(/R\$\s*50,00/)).toBeDefined();
  });

  it('expired: a tela não se esvazia — botão de nova cobrança chama o handler (FR-010)', () => {
    const onNewCharge = vi.fn();
    renderState({ status: 'expired', charge }, { onNewCharge });
    fireEvent.click(screen.getByRole('button', { name: texts.newCharge }));
    expect(onNewCharge).toHaveBeenCalledTimes(1);
  });

  it('error: mensagem amigável + tentar de novo chama o handler (FR-011)', () => {
    const onRetry = vi.fn();
    renderState(
      { status: 'error', reason: 'create_failed', error: new PixApiError('detalhe interno') },
      { onRetry },
    );
    expect(screen.getByText(texts.errorCreateTitle)).toBeDefined();
    expect(screen.queryByText(/detalhe interno/)).toBeNull(); // erro cru nunca vaza pra UI
    fireEvent.click(screen.getByRole('button', { name: texts.retry }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('PixCopyButton dentro do checkout — feedback e fallback (FR-008)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    // @ts-expect-error limpeza do stub de clipboard
    delete navigator.clipboard;
  });

  function stubClipboard(writeText: () => Promise<void>) {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn(writeText) },
    });
  }

  it('copiar → "Copiado ✓" por 2 segundos → volta ao texto original', async () => {
    stubClipboard(() => Promise.resolve());
    renderState({ status: 'awaiting_payment', charge });

    fireEvent.click(screen.getByRole('button', { name: texts.copy }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByRole('button', { name: texts.copied })).toBeDefined();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(screen.getByRole('button', { name: texts.copy })).toBeDefined();
  });

  it('clipboard negado → código completo aparece selecionável (ainda dá pra pagar)', async () => {
    stubClipboard(() => Promise.reject(new Error('negado')));
    renderState({ status: 'awaiting_payment', charge });

    fireEvent.click(screen.getByRole('button', { name: texts.copy }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByText(texts.copyFailed)).toBeDefined();
    expect(screen.getByText(charge.brCode)).toBeDefined();
  });
});
