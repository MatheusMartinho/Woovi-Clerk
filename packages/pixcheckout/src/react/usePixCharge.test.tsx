import { act, renderHook } from '@testing-library/react';
import { StrictMode } from 'react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoreClient } from '../core/client';
import type { Charge, ChargeStatus, CreateChargePayload } from '../core/types';
import { usePixCharge } from './usePixCharge';
import { WooviProvider } from './WooviProvider';

function makeCharge(correlationID: string, status: ChargeStatus = 'ACTIVE'): Charge {
  return {
    correlationID,
    value: 5000,
    status,
    brCode: '000201br.gov.bcb.pix.teste',
    expiresAt: Date.now() + 15 * 60 * 1000,
  };
}

/**
 * Client falso: nenhum mock global de rede. O status devolvido pelo polling
 * é controlado pelo teste via setStatus().
 */
function makeFakeClient() {
  let status: ChargeStatus = 'ACTIVE';
  let expiresInMs = 15 * 60 * 1000;
  const created: CreateChargePayload[] = [];
  const client: CoreClient = {
    createCharge: vi.fn(async (payload: CreateChargePayload) => {
      created.push(payload);
      return { ...makeCharge(payload.correlationID), expiresAt: Date.now() + expiresInMs };
    }),
    getCharge: vi.fn(async (correlationID: string) => makeCharge(correlationID, status)),
  };
  return {
    client,
    created,
    setStatus(next: ChargeStatus) {
      status = next;
    },
    setExpiresInMs(ms: number) {
      expiresInMs = ms;
    },
  };
}

function wrapper(client: CoreClient, strict = false) {
  return function Wrapper({ children }: { children: ReactNode }) {
    const tree = <WooviProvider client={client}>{children}</WooviProvider>;
    return strict ? <StrictMode>{tree}</StrictMode> : tree;
  };
}

/** Deixa as microtasks da criação resolverem sob fake timers. */
async function flush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('usePixCharge — criação', () => {
  it('cria a cobrança ao montar e vai para awaiting_payment', async () => {
    const fake = makeFakeClient();
    const { result } = renderHook(() => usePixCharge({ amount: 5000 }), {
      wrapper: wrapper(fake.client),
    });

    expect(result.current.state.status).toBe('creating');
    await flush();
    expect(result.current.state.status).toBe('awaiting_payment');
    expect(result.current.charge?.value).toBe(5000);
  });

  it('StrictMode monta duas vezes → UMA cobrança (mesmo correlationID)', async () => {
    const fake = makeFakeClient();
    const { result } = renderHook(() => usePixCharge({ amount: 5000 }), {
      wrapper: wrapper(fake.client, true),
    });

    await flush();
    expect(result.current.state.status).toBe('awaiting_payment');
    const ids = new Set(fake.created.map((p) => p.correlationID));
    expect(ids.size).toBe(1); // FR-020: mesma intenção, mesma cobrança
  });

  it('onChargeCreated dispara UMA vez por intenção, com a cobrança pronta', async () => {
    const fake = makeFakeClient();
    const onChargeCreated = vi.fn();
    renderHook(() => usePixCharge({ amount: 5000, onChargeCreated }), {
      wrapper: wrapper(fake.client),
    });

    await flush();
    await advance(3_000); // polls extras não redisparam o callback
    await advance(3_000);

    expect(onChargeCreated).toHaveBeenCalledTimes(1);
    expect(onChargeCreated.mock.calls[0]![0].correlationID).toBe(fake.created[0]!.correlationID);
  });

  it('falha na criação → error(create_failed); retry cria NOVA intenção', async () => {
    const fake = makeFakeClient();
    (fake.client.createCharge as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error('rede caiu'));

    const { result } = renderHook(() => usePixCharge({ amount: 5000 }), {
      wrapper: wrapper(fake.client),
    });

    await flush();
    expect(result.current.state).toMatchObject({ status: 'error', reason: 'create_failed' });

    await act(async () => {
      result.current.retry();
    });
    await flush();

    expect(result.current.state.status).toBe('awaiting_payment');
    const calls = (fake.client.createCharge as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.length).toBe(2);
    expect(calls[0]![0].correlationID).not.toBe(calls[1]![0].correlationID);
  });
});

describe('usePixCharge — provider não recria o client por render (achado do review)', () => {
  it('re-render com appearance inline (objeto novo) NÃO cria outra cobrança', async () => {
    const fake = makeFakeClient();
    // provider por endpoint (client criado internamente) + appearance inline,
    // como um integrador desavisado escreveria
    function Wrapper({ children }: { children: ReactNode }) {
      return (
        <WooviProvider client={fake.client} appearance={{ colorPrimary: '#123456' }}>
          {children}
        </WooviProvider>
      );
    }
    const { result, rerender } = renderHook(() => usePixCharge({ amount: 5000 }), {
      wrapper: Wrapper,
    });
    await flush();
    expect(result.current.state.status).toBe('awaiting_payment');

    rerender(); // novo objeto appearance a cada render do wrapper
    rerender();
    await flush();

    expect(fake.created.length).toBe(1); // uma intenção, uma cobrança — sempre
    expect(result.current.state.status).toBe('awaiting_payment');
  });
});

describe('usePixCharge — polling para e limpa (SC-004)', () => {
  it('pagou → paid, onPaid dispara UMA vez e o polling CESSA', async () => {
    const fake = makeFakeClient();
    const onPaid = vi.fn();
    const { result } = renderHook(() => usePixCharge({ amount: 5000, onPaid }), {
      wrapper: wrapper(fake.client),
    });
    await flush();

    fake.setStatus('COMPLETED');
    await advance(3_000); // primeira consulta

    expect(result.current.state.status).toBe('paid');
    expect(onPaid).toHaveBeenCalledTimes(1);

    const callsAfterPaid = (fake.client.getCharge as ReturnType<typeof vi.fn>).mock.calls.length;
    await advance(120_000);
    expect((fake.client.getCharge as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callsAfterPaid);
  });

  it('expirou (via API) → expired, onExpired dispara e o polling CESSA', async () => {
    const fake = makeFakeClient();
    const onExpired = vi.fn();
    const { result } = renderHook(() => usePixCharge({ amount: 5000, onExpired }), {
      wrapper: wrapper(fake.client),
    });
    await flush();

    fake.setStatus('EXPIRED');
    await advance(3_000);

    expect(result.current.state.status).toBe('expired');
    expect(onExpired).toHaveBeenCalledTimes(1);

    const calls = (fake.client.getCharge as ReturnType<typeof vi.fn>).mock.calls.length;
    await advance(120_000);
    expect((fake.client.getCharge as ReturnType<typeof vi.fn>).mock.calls.length).toBe(calls);
  });

  it('desmonte → ZERO consultas e ZERO timers depois (FR-005)', async () => {
    const fake = makeFakeClient();
    const { unmount } = renderHook(() => usePixCharge({ amount: 5000 }), {
      wrapper: wrapper(fake.client),
    });
    await flush();

    unmount();
    expect(vi.getTimerCount()).toBe(0);

    await advance(120_000);
    expect(fake.client.getCharge as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
  });

  it('3 falhas consecutivas → error(polling_lost); sucesso no meio zera a contagem', async () => {
    const fake = makeFakeClient();
    const getCharge = fake.client.getCharge as ReturnType<typeof vi.fn>;
    const { result } = renderHook(() => usePixCharge({ amount: 5000 }), {
      wrapper: wrapper(fake.client),
    });
    await flush();

    // duas falhas, um sucesso, duas falhas: continua aguardando (contagem zerou)
    getCharge
      .mockRejectedValueOnce(new Error('falha 1'))
      .mockRejectedValueOnce(new Error('falha 2'))
      .mockResolvedValueOnce(makeCharge('x', 'ACTIVE'))
      .mockRejectedValueOnce(new Error('falha 3'))
      .mockRejectedValueOnce(new Error('falha 4'));

    for (let i = 0; i < 5; i += 1) await advance(3_000);
    expect(result.current.state.status).toBe('awaiting_payment');

    // terceira falha consecutiva agora derruba
    getCharge
      .mockRejectedValueOnce(new Error('a'))
      .mockRejectedValueOnce(new Error('b'))
      .mockRejectedValueOnce(new Error('c'));
    for (let i = 0; i < 3; i += 1) await advance(3_000);

    expect(result.current.state).toMatchObject({ status: 'error', reason: 'polling_lost' });
  });
});

describe('usePixCharge — expiração local e "pago vence expirado"', () => {
  it('contador zera e a checagem final revela pagamento → paid, nunca expired', async () => {
    const fake = makeFakeClient();
    fake.setExpiresInMs(5_000); // expira em 5s
    const onExpired = vi.fn();
    const { result } = renderHook(() => usePixCharge({ amount: 5000, onExpired }), {
      wrapper: wrapper(fake.client),
    });
    await flush();

    // a consulta normal dos 3s ainda vê ACTIVE...
    await advance(3_000);
    expect(result.current.state.status).toBe('awaiting_payment');

    // ...o pagamento entra no apagar das luzes, e só a CHECAGEM FINAL o vê
    fake.setStatus('COMPLETED');
    await advance(2_100);
    await flush();

    expect(result.current.state.status).toBe('paid');
    expect(onExpired).not.toHaveBeenCalled();
  });

  it('contador zera e o servidor confirma → expired; newCharge inicia nova intenção', async () => {
    const fake = makeFakeClient();
    fake.setExpiresInMs(5_000);
    const { result } = renderHook(() => usePixCharge({ amount: 5000 }), {
      wrapper: wrapper(fake.client),
    });
    await flush();

    fake.setStatus('EXPIRED'); // a Woovi marca como expirada
    await advance(5_100);
    await flush();
    expect(result.current.state.status).toBe('expired');

    fake.setExpiresInMs(15 * 60 * 1000);
    await act(async () => {
      result.current.newCharge();
    });
    await flush();

    expect(result.current.state.status).toBe('awaiting_payment');
    expect(fake.created.length).toBe(2);
    expect(fake.created[0]!.correlationID).not.toBe(fake.created[1]!.correlationID);
  });

  it('contador zera mas o servidor ainda diz ACTIVE → NÃO expira (relógio local não manda)', async () => {
    const fake = makeFakeClient();
    fake.setExpiresInMs(5_000); // como se o relógio do visitante adiantasse
    const onExpired = vi.fn();
    const { result } = renderHook(() => usePixCharge({ amount: 5000, onExpired }), {
      wrapper: wrapper(fake.client),
    });
    await flush();

    await advance(5_100); // contador zerou; a API continua respondendo ACTIVE
    await flush();

    // O QR ainda é válido: esconder a cobrança aqui seria perder um pagamento.
    expect(result.current.state.status).toBe('awaiting_payment');
    expect(onExpired).not.toHaveBeenCalled();

    // ...e quando o servidor finalmente marca, o polling normal traz a verdade.
    fake.setStatus('EXPIRED');
    await advance(10_000);
    expect(result.current.state.status).toBe('expired');
  });
});

describe('usePixCharge — aba oculta pausa o polling', () => {
  function setVisibility(value: 'visible' | 'hidden') {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => value,
    });
    document.dispatchEvent(new Event('visibilitychange'));
  }

  afterEach(() => {
    setVisibility('visible');
  });

  it('escondeu → cadeia para; voltou → checagem imediata', async () => {
    const fake = makeFakeClient();
    const getCharge = fake.client.getCharge as ReturnType<typeof vi.fn>;
    renderHook(() => usePixCharge({ amount: 5000 }), { wrapper: wrapper(fake.client) });
    await flush();

    await act(async () => {
      setVisibility('hidden');
    });
    // a consulta já agendada ainda roda uma vez, mas não agenda a próxima
    await advance(3_000);
    const callsWhileHidden = getCharge.mock.calls.length;
    await advance(60_000);
    expect(getCharge.mock.calls.length).toBe(callsWhileHidden);

    await act(async () => {
      setVisibility('visible');
    });
    await flush();
    expect(getCharge.mock.calls.length).toBe(callsWhileHidden + 1); // checou na volta
  });
});
