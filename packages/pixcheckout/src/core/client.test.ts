import { describe, expect, it, vi } from 'vitest';
import { createCoreClient, normalizeCharge } from './client.ts';
import { PixApiError, PixValidationError } from './types.ts';

const RAW_CHARGE = {
  charge: {
    correlationID: 'abc-123',
    value: 5000,
    status: 'ACTIVE',
    brCode: '000201br.gov.bcb.pix.original',
    qrCodeImage: 'https://api.woovi.com/openpix/charge/brcode/image/xyz',
    expiresIn: 86_400,
    paymentLinkUrl: 'https://woovi-sandbox.com/pay/xyz',
  },
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('createCharge — validação de valor antes de qualquer rede', () => {
  it('rejeita valor decimal, zero ou negativo sem chamar a API', async () => {
    const fetchStub = vi.fn();
    const client = createCoreClient('/api/pix', { fetch: fetchStub as unknown as typeof fetch });

    for (const value of [50.5, 0, -100]) {
      await expect(client.createCharge({ correlationID: 'a', value })).rejects.toBeInstanceOf(
        PixValidationError,
      );
    }
    expect(fetchStub).not.toHaveBeenCalled();
  });
});

describe('createCharge — correlationID repetido cai no fallback GET', () => {
  /**
   * Comportamento REAL do sandbox (verificado 2026-08-05): 400 + mensagem em
   * português. Este teste existe porque a primeira versão do detector procurava
   * a palavra inglesa "correlation" e não casava com "Correlação".
   */
  it('400 "Já existe uma cobrança com este Correlação ID" → busca e devolve a cobrança existente', async () => {
    const fetchStub = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ error: 'Já existe uma cobrança com este Correlação ID' }, 400),
      )
      .mockResolvedValueOnce(jsonResponse(RAW_CHARGE));

    const client = createCoreClient('/api/pix', { fetch: fetchStub as unknown as typeof fetch });
    const charge = await client.createCharge({ correlationID: 'abc-123', value: 5000 });

    expect(charge.brCode).toBe(RAW_CHARGE.charge.brCode);
    expect(fetchStub).toHaveBeenCalledTimes(2);
    expect(String(fetchStub.mock.calls[1]![0])).toBe('/api/pix/charge/abc-123');
  });

  it('também aceita 409 (caso a API mude para o status convencional)', async () => {
    const fetchStub = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'conflict' }, 409))
      .mockResolvedValueOnce(jsonResponse(RAW_CHARGE));

    const client = createCoreClient('/api/pix', { fetch: fetchStub as unknown as typeof fetch });
    await expect(client.createCharge({ correlationID: 'abc-123', value: 5000 })).resolves.toBeDefined();
  });

  it('erro que NÃO é de duplicidade não vira fallback — propaga', async () => {
    const fetchStub = vi.fn().mockResolvedValue(jsonResponse({ error: 'saldo insuficiente' }, 400));

    const client = createCoreClient('/api/pix', { fetch: fetchStub as unknown as typeof fetch });
    await expect(client.createCharge({ correlationID: 'abc-123', value: 5000 })).rejects.toBeInstanceOf(
      PixApiError,
    );
    expect(fetchStub).toHaveBeenCalledTimes(1);
  });
});

describe('normalizeCharge — a forma única que os componentes veem', () => {
  /**
   * A armadilha real da API (sandbox, 2026-08-05): `expiresIn` é o TTL FIXO da
   * cobrança, não o tempo restante. Numa cobrança criada há horas ele continua
   * dizendo 86400 — usá-lo como contador reiniciaria o tempo a cada refresh.
   */
  it('IGNORA o expiresIn da Woovi quando há expiresDate (expiresIn é TTL, não restante)', () => {
    const criadaOntem = { ...RAW_CHARGE.charge, expiresDate: '2026-08-06T19:29:25.790Z', expiresIn: 86_400 };
    const charge = normalizeCharge({ charge: criadaOntem });
    expect(charge.expiresAt).toBe(Date.parse('2026-08-06T19:29:25.790Z'));
  });

  it('prefere remainingSeconds (campo do handler) — âncora no relógio de quem recebe', () => {
    const before = Date.now();
    const charge = normalizeCharge({
      charge: { ...RAW_CHARGE.charge, remainingSeconds: 300, expiresDate: '2030-01-01T00:00:00.000Z' },
    });
    expect(charge.expiresAt).toBeGreaterThanOrEqual(before + 300_000);
    expect(charge.expiresAt).toBeLessThan(before + 301_000); // e não a data de 2030
  });

  it('cai para expiresIn só quando não há mais nada (momento da criação)', () => {
    const before = Date.now();
    const semData = { ...RAW_CHARGE.charge, expiresDate: undefined, expiresIn: 900 };
    expect(normalizeCharge({ charge: semData }).expiresAt).toBeGreaterThanOrEqual(before + 900_000);
  });

  it('status desconhecido vira ACTIVE — nunca declara pago/expirado errado', () => {
    const charge = normalizeCharge({ charge: { ...RAW_CHARGE.charge, status: 'ALGO_NOVO' } });
    expect(charge.status).toBe('ACTIVE');
  });

  it('mapeia COMPLETED e EXPIRED', () => {
    expect(normalizeCharge({ charge: { ...RAW_CHARGE.charge, status: 'COMPLETED' } }).status).toBe('COMPLETED');
    expect(normalizeCharge({ charge: { ...RAW_CHARGE.charge, status: 'EXPIRED' } }).status).toBe('EXPIRED');
  });

  it('resposta sem os campos essenciais é erro explícito', () => {
    expect(() => normalizeCharge({ charge: { correlationID: 'a' } })).toThrow(PixApiError);
  });
});
