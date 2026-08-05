import type { CheckoutEvent, CheckoutState } from './types.ts';

/**
 * A maquina de estados do checkout como funcao pura: dado o estado atual e um
 * evento, devolve o proximo estado. Nenhum efeito, nenhum timer, nenhum fetch —
 * isso fica no hook. Evento que nao se aplica ao estado atual e ignorado
 * (devolve o mesmo estado), nunca lanca: eventos atrasados de requisicoes em
 * voo sao esperados, nao sao bugs.
 *
 * Tabela completa em specs/001-pixcheckout-library/data-model.md.
 */
export function transition(state: CheckoutState, event: CheckoutEvent): CheckoutState {
  switch (state.status) {
    case 'creating':
      if (event.type === 'CHARGE_READY') {
        return { status: 'awaiting_payment', charge: event.charge };
      }
      if (event.type === 'CREATE_FAILED') {
        return { status: 'error', reason: 'create_failed', error: event.error };
      }
      return state;

    case 'awaiting_payment':
      if (event.type === 'STATUS_PAID') {
        return { status: 'paid', charge: event.charge };
      }
      if (event.type === 'STATUS_EXPIRED') {
        return { status: 'expired', charge: state.charge };
      }
      if (event.type === 'POLLING_LOST') {
        return { status: 'error', reason: 'polling_lost', error: event.error, charge: state.charge };
      }
      return state;

    case 'expired':
      // Pago vence expirado: se uma checagem em voo revelar pagamento depois
      // do contador zerar, dinheiro recebido nunca fica escondido.
      if (event.type === 'STATUS_PAID') {
        return { status: 'paid', charge: event.charge };
      }
      if (event.type === 'NEW_CHARGE') {
        return { status: 'creating' };
      }
      return state;

    case 'error':
      // Mesmo racional: rede voltou e revelou pagamento? Mostra pago.
      if (event.type === 'STATUS_PAID') {
        return { status: 'paid', charge: event.charge };
      }
      if (event.type === 'RETRY') {
        return { status: 'creating' };
      }
      return state;

    case 'paid':
      // Terminal: nada tira o checkout de "pago".
      return state;
  }
}
