import { describe, expect, it } from 'vitest';
import { transition } from './machine.ts';
import type { Charge, CheckoutEvent, CheckoutState } from './types.ts';
import { PixApiError } from './types.ts';

const charge: Charge = {
  correlationID: 'abc-123',
  value: 5000,
  status: 'ACTIVE',
  brCode: '000201br.gov.bcb.pix...',
  expiresAt: 1_900_000_000_000,
};

const paidCharge: Charge = { ...charge, status: 'COMPLETED' };
const error = new PixApiError('falhou');

const creating: CheckoutState = { status: 'creating' };
const awaiting: CheckoutState = { status: 'awaiting_payment', charge };
const paid: CheckoutState = { status: 'paid', charge: paidCharge };
const expired: CheckoutState = { status: 'expired', charge };
const errored: CheckoutState = { status: 'error', reason: 'create_failed', error };

const CHARGE_READY: CheckoutEvent = { type: 'CHARGE_READY', charge };
const CREATE_FAILED: CheckoutEvent = { type: 'CREATE_FAILED', error };
const STATUS_PAID: CheckoutEvent = { type: 'STATUS_PAID', charge: paidCharge };
const STATUS_EXPIRED: CheckoutEvent = { type: 'STATUS_EXPIRED' };
const POLLING_LOST: CheckoutEvent = { type: 'POLLING_LOST', error };
const RETRY: CheckoutEvent = { type: 'RETRY' };
const NEW_CHARGE: CheckoutEvent = { type: 'NEW_CHARGE' };

const ALL_EVENTS = [CHARGE_READY, CREATE_FAILED, STATUS_PAID, STATUS_EXPIRED, POLLING_LOST, RETRY, NEW_CHARGE];

describe('transition — células ativas da tabela', () => {
  it('creating + CHARGE_READY → awaiting_payment com a cobrança', () => {
    expect(transition(creating, CHARGE_READY)).toEqual({ status: 'awaiting_payment', charge });
  });

  it('creating + CREATE_FAILED → error(create_failed)', () => {
    expect(transition(creating, CREATE_FAILED)).toEqual({
      status: 'error',
      reason: 'create_failed',
      error,
    });
  });

  it('awaiting + STATUS_PAID → paid', () => {
    expect(transition(awaiting, STATUS_PAID)).toEqual({ status: 'paid', charge: paidCharge });
  });

  it('awaiting + STATUS_EXPIRED → expired preservando a cobrança', () => {
    expect(transition(awaiting, STATUS_EXPIRED)).toEqual({ status: 'expired', charge });
  });

  it('awaiting + POLLING_LOST → error(polling_lost) preservando a cobrança', () => {
    expect(transition(awaiting, POLLING_LOST)).toEqual({
      status: 'error',
      reason: 'polling_lost',
      error,
      charge,
    });
  });

  it('expired + STATUS_PAID → paid (pago vence expirado)', () => {
    expect(transition(expired, STATUS_PAID)).toEqual({ status: 'paid', charge: paidCharge });
  });

  it('expired + NEW_CHARGE → creating', () => {
    expect(transition(expired, NEW_CHARGE)).toEqual({ status: 'creating' });
  });

  it('error + RETRY → creating', () => {
    expect(transition(errored, RETRY)).toEqual({ status: 'creating' });
  });

  it('error + STATUS_PAID → paid (rede voltou revelando pagamento)', () => {
    expect(transition(errored, STATUS_PAID)).toEqual({ status: 'paid', charge: paidCharge });
  });
});

describe('transition — eventos ignorados devolvem o MESMO estado (sem exceção)', () => {
  const cases: Array<[string, CheckoutState, CheckoutEvent[]]> = [
    ['creating', creating, [STATUS_PAID, STATUS_EXPIRED, POLLING_LOST, RETRY, NEW_CHARGE]],
    ['awaiting_payment', awaiting, [CHARGE_READY, CREATE_FAILED, RETRY, NEW_CHARGE]],
    ['expired', expired, [CHARGE_READY, CREATE_FAILED, STATUS_EXPIRED, POLLING_LOST, RETRY]],
    ['error', errored, [CHARGE_READY, CREATE_FAILED, STATUS_EXPIRED, POLLING_LOST, NEW_CHARGE]],
    ['paid (terminal: ignora TUDO)', paid, ALL_EVENTS],
  ];

  for (const [name, state, events] of cases) {
    it(name, () => {
      for (const event of events) {
        expect(transition(state, event)).toBe(state);
      }
    });
  }
});
