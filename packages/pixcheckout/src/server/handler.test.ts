import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWooviHandler } from './handler';

afterEach(() => {
  vi.unstubAllGlobals();
});

const WOOVI_CHARGE = {
  charge: {
    correlationID: 'abc-123',
    value: 5000,
    status: 'ACTIVE',
    brCode: '000201br.gov.bcb.pix...',
    expiresIn: 900,
  },
};

function wooviFetchStub(response: unknown = WOOVI_CHARGE, status = 200) {
  return vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
    new Response(JSON.stringify(response), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

function makeHandler(fetchImpl: typeof fetch, beforeCreate?: Parameters<typeof createWooviHandler>[0]['beforeCreate']) {
  vi.stubGlobal('fetch', fetchImpl);
  return createWooviHandler({ appId: 'APP_ID_SECRETO', beforeCreate });
}

const post = (body: unknown) =>
  new Request('http://localhost/api/pix/charge', { method: 'POST', body: JSON.stringify(body) });

describe('createWooviHandler', () => {
  it('lança na inicialização se o appId estiver ausente', () => {
    expect(() => createWooviHandler({ appId: '' })).toThrow(/WOOVI_APP_ID/);
  });

  it('rota desconhecida → 404 com formato de erro único', async () => {
    const handler = makeHandler(wooviFetchStub());
    const res = await handler(new Request('http://localhost/api/pix/qualquer-coisa'));
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe('not_found');
  });

  it('POST /charge repassa à Woovi com Authorization SEM Bearer e devolve a cobrança normalizada', async () => {
    const fetchStub = wooviFetchStub();
    const handler = makeHandler(fetchStub as unknown as typeof fetch);

    const res = await handler(post({ correlationID: 'abc-123', value: 5000 }));

    expect(res.status).toBe(200);
    const { charge } = await res.json();
    expect(charge.brCode).toBe(WOOVI_CHARGE.charge.brCode);
    expect(typeof charge.expiresAt).toBe('number'); // normalizada: instante absoluto

    const [url, init] = fetchStub.mock.calls[0]!;
    expect(String(url)).toBe('https://api.woovi-sandbox.com/api/v1/charge');
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'APP_ID_SECRETO' });
  });

  it('beforeCreate substitui o payload — o servidor fixa o preço', async () => {
    const fetchStub = wooviFetchStub();
    const handler = makeHandler(fetchStub as unknown as typeof fetch, (payload) => ({
      ...payload,
      value: 9900, // ignora o que o navegador pediu
    }));

    await handler(post({ correlationID: 'abc-123', value: 1 }));

    const body = JSON.parse(((fetchStub.mock.calls[0]![1] as RequestInit).body as string) ?? '{}');
    expect(body.value).toBe(9900);
  });

  it('corpo inválido → 400 validation, sem tocar na Woovi', async () => {
    const fetchStub = wooviFetchStub();
    const handler = makeHandler(fetchStub as unknown as typeof fetch);

    const res = await handler(post({ value: 'cinquenta' }));

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('validation');
    expect(fetchStub).not.toHaveBeenCalled();
  });

  it('GET /charge/{id} consulta por correlationID com URI encoding', async () => {
    const fetchStub = wooviFetchStub();
    const handler = makeHandler(fetchStub as unknown as typeof fetch);

    const res = await handler(new Request('http://localhost/api/pix/charge/abc%20123'));

    expect(res.status).toBe(200);
    expect(String(fetchStub.mock.calls[0]![0])).toBe(
      'https://api.woovi-sandbox.com/api/v1/charge/abc%20123',
    );
  });

  it('erro da Woovi → 502 com mensagem estática que NÃO vaza o appId nem o corpo cru', async () => {
    const handler = makeHandler(
      wooviFetchStub({ error: 'segredo interno da woovi: APP_ID_SECRETO' }, 500) as unknown as typeof fetch,
    );

    const res = await handler(post({ correlationID: 'abc-123', value: 5000 }));

    expect(res.status).toBe(502);
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain('APP_ID_SECRETO');
    expect(text).not.toContain('segredo interno');
  });
});
