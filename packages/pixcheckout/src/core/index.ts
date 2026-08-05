/**
 * Subpath `pixcheckout/core`: a camada 1 inteira, utilizavel em Node puro.
 */
export { createCoreClient, normalizeCharge } from './client';
export type { CoreClient, CoreClientOptions, RequestOptions } from './client';
export { transition } from './machine';
export {
  FAST_POLL_MS,
  FAST_WINDOW_MS,
  MAX_CONSECUTIVE_FAILURES,
  nextDelay,
  SLOW_POLL_MS,
} from './polling';
export { PixApiError, PixError, PixValidationError } from './types';
export type {
  Charge,
  ChargeStatus,
  CheckoutEvent,
  CheckoutState,
  CreateChargePayload,
  PixErrorCode,
} from './types';
