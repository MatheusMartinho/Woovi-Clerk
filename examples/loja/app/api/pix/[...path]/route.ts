import { createWooviHandler } from 'pixcheckout/server';

/**
 * O backend da loja em um arquivo: a chave vive em process.env, o navegador
 * fala apenas com /api/pix/*, e o handler repassa à Woovi.
 *
 * Inicialização preguiçosa para o `next build` passar sem a env var —
 * na primeira requisição real, sem WOOVI_APP_ID, o erro é claro e imediato.
 */
let cached: ((req: Request) => Promise<Response>) | null = null;

function handler(req: Request): Promise<Response> {
  cached ??= createWooviHandler({
    appId: process.env.WOOVI_APP_ID ?? '',
    // Integridade de preço: o VALOR é decidido aqui, no servidor. Se um
    // navegador malicioso pedir "cobre R$ 0,01", a loja cobra R$ 50,00
    // do mesmo jeito — proxy sem validação não é proxy seguro.
    beforeCreate: (payload) => ({ ...payload, value: 5000 }),
  });
  return cached(req);
}

export { handler as GET, handler as POST };
