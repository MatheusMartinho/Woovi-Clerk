import { createCoreClient } from '../core/client';
import { PixApiError, PixValidationError } from '../core/types';
import type { CreateChargePayload } from '../core/types';

export interface WooviHandlerConfig {
  /** AppID da Woovi. SEMPRE de variável de ambiente — nunca um literal no código. */
  appId: string;
  /** Default: sandbox. Em produção: https://api.woovi.com */
  baseUrl?: string;
  /**
   * Ponto de integridade de preço: roda no SEU servidor antes de criar a
   * cobrança. Esconder a chave impede roubo de credencial, mas não impede um
   * navegador malicioso de pedir "cobre R$ 1" — fixe/valide o value aqui.
   */
  beforeCreate?: (
    payload: CreateChargePayload,
    req: Request,
  ) => CreateChargePayload | Promise<CreateChargePayload>;
}

const DEFAULT_BASE_URL = 'https://api.woovi-sandbox.com';

/**
 * O backend pronto que mantém o setup em cinco minutos (FR-021): um arquivo
 * no servidor do lojista, chave em env var, e o navegador nunca vê segredo.
 *
 * Padrão Web Request/Response: monta em Next.js (route handler), funções
 * Vercel, Hono, Bun — qualquer runtime moderno.
 *
 * Superfície mínima, dois endpoints:
 *   POST {base}/charge               → cria cobrança
 *   GET  {base}/charge/{correlationID} → consulta status
 */
export function createWooviHandler(config: WooviHandlerConfig): (req: Request) => Promise<Response> {
  if (!config?.appId) {
    throw new Error(
      'createWooviHandler: appId ausente. Defina WOOVI_APP_ID no ambiente do servidor ' +
        '(nunca no código, nunca no frontend).',
    );
  }

  const base = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
  const woovi = createCoreClient(`${base}/api/v1`, {
    headers: { Authorization: config.appId }, // sem "Bearer": é o formato da Woovi
  });

  return async function handler(req: Request): Promise<Response> {
    const { pathname } = new URL(req.url);

    try {
      const statusMatch = pathname.match(/\/charge\/([^/]+)$/);
      if (req.method === 'GET' && statusMatch) {
        const charge = await woovi.getCharge(decodeURIComponent(statusMatch[1]!));
        return json({ charge }, 200);
      }

      if (req.method === 'POST' && /\/charge$/.test(pathname)) {
        const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
        if (!body || typeof body.correlationID !== 'string' || typeof body.value !== 'number') {
          return json(
            { error: { code: 'validation', message: 'Corpo inválido: correlationID (string) e value (número) são obrigatórios.' } },
            400,
          );
        }

        let payload: CreateChargePayload = {
          correlationID: body.correlationID,
          value: body.value,
          comment: typeof body.comment === 'string' ? body.comment : undefined,
        };
        if (config.beforeCreate) {
          payload = await config.beforeCreate(payload, req);
        }

        const charge = await woovi.createCharge(payload);
        return json({ charge }, 200);
      }

      return json({ error: { code: 'not_found', message: 'Rota não suportada.' } }, 404);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Mensagens estáticas de propósito: a resposta que chega ao navegador nunca
 * ecoa o corpo cru da Woovi nem qualquer credencial.
 */
function errorResponse(err: unknown): Response {
  if (err instanceof PixValidationError) {
    return json({ error: { code: 'validation', message: err.message } }, 400);
  }
  if (err instanceof PixApiError && err.status === 404) {
    return json({ error: { code: 'not_found', message: 'Cobrança não encontrada.' } }, 404);
  }
  return json({ error: { code: 'woovi_api', message: 'Falha ao comunicar com a Woovi. Tente novamente.' } }, 502);
}
