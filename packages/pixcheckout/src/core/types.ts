/**
 * Tipos da camada core. Zero React aqui: este arquivo (e tudo em src/core)
 * precisa rodar em Node puro — e a existencia dessa fronteira e o que permite
 * o mesmo cliente servir navegador (via handler) e servidor (via chave).
 */

export type ChargeStatus = 'ACTIVE' | 'COMPLETED' | 'EXPIRED';

/**
 * Cobranca normalizada. Os componentes nunca veem o payload cru da Woovi;
 * o client converte tudo para esta forma unica.
 */
export interface Charge {
  correlationID: string;
  /** Centavos, inteiro. 5000 = R$ 50,00. Dinheiro nunca em decimal. */
  value: number;
  status: ChargeStatus;
  /** Codigo copia e cola. Tambem e a fonte do QR gerado localmente. */
  brCode: string;
  /** URL da imagem da Woovi. Guardada como fallback; a UI nao depende dela. */
  qrCodeImage?: string;
  /**
   * Instante absoluto de expiracao (epoch ms). Normalizado a partir de
   * expiresIn/expiresDate: contador derivado de instante absoluto nunca
   * dessincroniza, ao contrario de "segundos restantes" decrementados.
   */
  expiresAt: number;
  paymentLinkUrl?: string;
}

export interface CreateChargePayload {
  correlationID: string;
  value: number;
  comment?: string;
}

export type PixErrorCode = 'validation' | 'woovi_api' | 'not_found' | 'network';

export class PixError extends Error {
  readonly code: PixErrorCode;

  constructor(code: PixErrorCode, message: string) {
    super(message);
    this.name = 'PixError';
    this.code = code;
  }
}

export class PixValidationError extends PixError {
  constructor(message: string) {
    super('validation', message);
    this.name = 'PixValidationError';
  }
}

export class PixApiError extends PixError {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(status === 404 ? 'not_found' : 'woovi_api', message);
    this.name = 'PixApiError';
    this.status = status;
  }
}

/**
 * Uniao discriminada: cada estado carrega exatamente os dados que fazem
 * sentido nele, entao "estado ambiguo" nem compila (FR-003).
 * O tempo restante NAO vive aqui — e derivado de charge.expiresAt.
 */
export type CheckoutState =
  | { status: 'creating' }
  | { status: 'awaiting_payment'; charge: Charge }
  | { status: 'paid'; charge: Charge }
  | { status: 'expired'; charge: Charge }
  | {
      status: 'error';
      reason: 'create_failed' | 'polling_lost';
      error: PixError;
      charge?: Charge;
    };

export type CheckoutEvent =
  | { type: 'CHARGE_READY'; charge: Charge }
  | { type: 'CREATE_FAILED'; error: PixError }
  | { type: 'STATUS_PAID'; charge: Charge }
  | { type: 'STATUS_EXPIRED' }
  | { type: 'POLLING_LOST'; error: PixError }
  | { type: 'RETRY' }
  | { type: 'NEW_CHARGE' };
