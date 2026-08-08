/**
 * Subpath `pixcheckout/core`: a camada 1 inteira, utilizavel em Node puro.
 */
export { createCoreClient, isAbortError, normalizeCharge, trimTrailingSlash } from './client.ts';
export { createCorrelationID } from './ids.ts';
export type { CoreClient, CoreClientOptions, RequestOptions } from './client.ts';
export { transition } from './machine.ts';
export {
  FAST_POLL_MS,
  FAST_WINDOW_MS,
  MAX_CONSECUTIVE_FAILURES,
  nextDelay,
  SLOW_POLL_MS,
} from './polling.ts';
export { PixApiError, PixError, PixValidationError } from './types.ts';
export type {
  Charge,
  ChargeStatus,
  CheckoutEvent,
  CheckoutState,
  CreateChargePayload,
  PixErrorCode,
} from './types.ts';
