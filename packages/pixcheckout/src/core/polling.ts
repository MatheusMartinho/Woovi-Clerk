/**
 * Politica de polling como dados e funcoes puras (decisao R5 do research):
 * a agenda e testavel sem timer nenhum.
 */

/** Intervalo nos primeiros minutos: a maioria dos Pix e paga logo. */
export const FAST_POLL_MS = 3_000;

/** Intervalo depois da janela rapida: urgencia caiu, poupa requisicoes. */
export const SLOW_POLL_MS = 10_000;

/** Duracao da janela rapida. */
export const FAST_WINDOW_MS = 120_000;

/**
 * Falhas de rede consecutivas toleradas antes de declarar 'error'.
 * Uma falha isolada nao derruba o checkout; a contagem zera a cada sucesso.
 */
export const MAX_CONSECUTIVE_FAILURES = 3;

/** Quanto esperar ate a proxima consulta, dado quanto tempo ja se passou. */
export function nextDelay(elapsedMs: number): number {
  return elapsedMs < FAST_WINDOW_MS ? FAST_POLL_MS : SLOW_POLL_MS;
}
