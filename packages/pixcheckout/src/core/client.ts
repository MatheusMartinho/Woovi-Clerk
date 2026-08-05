import type { Charge, ChargeStatus, CreateChargePayload } from './types.ts';
import { PixApiError, PixValidationError } from './types.ts';

export interface CoreClientOptions {
  /** Injetavel para testes: nenhum mock global de rede e necessario. */
  fetch?: typeof fetch;
  /** Ex.: { Authorization: appId } quando o client roda no servidor. */
  headers?: Record<string, string>;
}

export interface RequestOptions {
  signal?: AbortSignal;
}

export interface CoreClient {
  createCharge(payload: CreateChargePayload, opts?: RequestOptions): Promise<Charge>;
  getCharge(correlationID: string, opts?: RequestOptions): Promise<Charge>;
}

/**
 * O MESMO client serve os dois lados da fronteira de seguranca:
 * - no navegador: createCoreClient('/api/pix') — fala com o handler, sem chave
 * - no servidor:  createCoreClient('https://api.woovi-sandbox.com/api/v1',
 *                   { headers: { Authorization: appId } }) — fala com a Woovi
 */
export function createCoreClient(baseUrl: string, options: CoreClientOptions = {}): CoreClient {
  const base = baseUrl.replace(/\/+$/, '');
  const doFetch = options.fetch ?? fetch;
  const headers = { 'Content-Type': 'application/json', ...options.headers };

  async function request(path: string, init: RequestInit): Promise<unknown> {
    let response: Response;
    try {
      response = await doFetch(`${base}${path}`, { ...init, headers });
    } catch (err) {
      // Repassa aborts intactos (o hook os reconhece); embrulha o resto.
      if (err instanceof Error && err.name === 'AbortError') throw err;
      throw new PixApiError(err instanceof Error ? err.message : 'Falha de rede');
    }
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new PixApiError(body.slice(0, 300) || `HTTP ${response.status}`, response.status);
    }
    return response.json();
  }

  async function getCharge(correlationID: string, opts: RequestOptions = {}): Promise<Charge> {
    const raw = await request(`/charge/${encodeURIComponent(correlationID)}`, {
      method: 'GET',
      signal: opts.signal ?? null,
    });
    return normalizeCharge(raw);
  }

  return {
    getCharge,

    async createCharge(payload, opts = {}) {
      if (!Number.isInteger(payload.value) || payload.value <= 0) {
        throw new PixValidationError(
          `value deve ser um inteiro positivo em centavos (recebi ${payload.value}). Ex.: 5000 = R$ 50,00.`,
        );
      }
      try {
        const raw = await request('/charge', {
          method: 'POST',
          body: JSON.stringify(payload),
          signal: opts.signal ?? null,
        });
        return normalizeCharge(raw);
      } catch (err) {
        // correlationID repetido (StrictMode monta 2x, F5 no meio da criacao):
        // se a cobranca ja existe, busca e segue com ela. Tolera tanto uma API
        // idempotente quanto uma que responde conflito (R9).
        if (isDuplicateCorrelationError(err)) {
          return getCharge(payload.correlationID, opts);
        }
        throw err;
      }
    },
  };
}

function isDuplicateCorrelationError(err: unknown): boolean {
  if (!(err instanceof PixApiError)) return false;
  if (err.status === 409) return true;
  return /correlation/i.test(err.message) && /(exist|usad|used|duplicad)/i.test(err.message);
}

const STATUS_MAP: Record<string, ChargeStatus> = {
  COMPLETED: 'COMPLETED',
  EXPIRED: 'EXPIRED',
};

/**
 * Converte a resposta (da Woovi ou do handler) para a forma unica `Charge`.
 * Status desconhecido vira ACTIVE de proposito: o pior efeito e continuar
 * consultando — nunca declarar pago/expirado errado.
 */
export function normalizeCharge(raw: unknown): Charge {
  const container = raw as { charge?: Record<string, unknown> };
  const data = (container.charge ?? container) as Record<string, unknown>;

  const { correlationID, value, brCode } = data;

  if (typeof correlationID !== 'string' || typeof value !== 'number' || typeof brCode !== 'string') {
    throw new PixApiError('Resposta sem os campos esperados (correlationID, value, brCode).');
  }

  return {
    correlationID,
    value,
    status: STATUS_MAP[String(data.status)] ?? 'ACTIVE',
    brCode,
    qrCodeImage: typeof data.qrCodeImage === 'string' ? data.qrCodeImage : undefined,
    expiresAt: resolveExpiresAt(data),
    paymentLinkUrl: typeof data.paymentLinkUrl === 'string' ? data.paymentLinkUrl : undefined,
  };
}

/**
 * Woovi pode informar a expiracao como expiresIn (segundos a partir de agora)
 * e/ou expiresDate (ISO). Ja normalizado (expiresAt) tambem e aceito, porque o
 * handler devolve a cobranca ja convertida. Sem nenhum dos tres: 15 min, o
 * padrao da plataforma.
 */
function resolveExpiresAt(data: Record<string, unknown>): number {
  if (typeof data.expiresAt === 'number') return data.expiresAt;
  if (typeof data.expiresDate === 'string') {
    const parsed = Date.parse(data.expiresDate);
    if (!Number.isNaN(parsed)) return parsed;
  }
  if (typeof data.expiresIn === 'number') return Date.now() + data.expiresIn * 1000;
  return Date.now() + 15 * 60 * 1000;
}
