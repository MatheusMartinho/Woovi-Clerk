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
/** Aborto e sinal de cleanup, nao de falha — a definicao vive AQUI, num lugar so. */
export function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}

export function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

export function createCoreClient(baseUrl: string, options: CoreClientOptions = {}): CoreClient {
  const base = trimTrailingSlash(baseUrl);
  const doFetch = options.fetch ?? fetch;
  const headers = { 'Content-Type': 'application/json', ...options.headers };

  async function request(path: string, init: RequestInit): Promise<unknown> {
    let response: Response;
    try {
      response = await doFetch(`${base}${path}`, { ...init, headers });
    } catch (err) {
      // Repassa aborts intactos (o hook os reconhece); embrulha o resto.
      if (isAbortError(err)) throw err;
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

/**
 * Verificado contra o sandbox em 2026-08-05: a Woovi NAO e idempotente no POST.
 * Ela responde 400 com {"error":"Ja existe uma cobranca com este Correlacao ID"}
 * — em portugues, e nao 409 como a intuicao sugere. Por isso o teste casa o
 * prefixo "correla" (pega correlation/correlacao/correlação) e nao a palavra
 * inteira em ingles, e aceita 400 alem de 409.
 */
function isDuplicateCorrelationError(err: unknown): boolean {
  if (!(err instanceof PixApiError)) return false;
  if (err.status === 409) return true;
  const message = err.message.toLowerCase();
  return /correla/.test(message) && /(exist|já existe|usad|used|duplicad|already)/.test(message);
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
 * De quem e o relogio?
 *
 * ARMADILHA verificada no sandbox em 2026-08-05: o campo `expiresIn` da Woovi
 * NAO e o tempo restante — e o TTL fixo da cobranca. Numa cobranca criada ha
 * 5 minutos ele continua dizendo 86400. Usa-lo como contador faria o tempo
 * reiniciar a cada refresh da pagina. Por isso ele e o ULTIMO recurso, so
 * aproveitavel no instante da criacao.
 *
 * `remainingSeconds` e campo NOSSO, emitido pelo handler: quanto falta de
 * verdade, medido no servidor. E relativo de proposito, para o navegador
 * ancora-lo no PROPRIO relogio — um instante absoluto do servidor erraria
 * exatamente o tanto que o relogio do visitante estiver desregulado, e desvio
 * de minutos num desktop e bem mais comum que os ~200ms de latencia que o
 * valor relativo custa.
 *
 * Tudo isso vale so para o CONTADOR na tela. Quem decide se expirou de verdade
 * e o servidor (ver a checagem final em usePixCharge).
 */
function resolveExpiresAt(data: Record<string, unknown>): number {
  if (typeof data.remainingSeconds === 'number') return Date.now() + data.remainingSeconds * 1000;
  if (typeof data.expiresDate === 'string') {
    const parsed = Date.parse(data.expiresDate);
    if (!Number.isNaN(parsed)) return parsed;
  }
  if (typeof data.expiresAt === 'number') return data.expiresAt;
  if (typeof data.expiresIn === 'number') return Date.now() + data.expiresIn * 1000;
  return Date.now() + 15 * 60 * 1000;
}
