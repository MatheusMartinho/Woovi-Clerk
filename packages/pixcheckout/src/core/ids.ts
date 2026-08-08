/**
 * crypto.randomUUID() so existe em contexto seguro (https ou localhost).
 * O jeito mais natural de testar um QR Pix e abrir o checkout NO CELULAR via
 * IP da rede local (http://192.168...) — contexto inseguro, onde randomUUID
 * nem existe e o checkout quebraria na primeira renderizacao.
 * getRandomValues, por outro lado, funciona em qualquer contexto.
 */
export function createCorrelationID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes =
    typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function'
      ? crypto.getRandomValues(new Uint8Array(16))
      : Uint8Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  // bits de versao (4) e variante (RFC 4122), como num UUID v4 de verdade
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
