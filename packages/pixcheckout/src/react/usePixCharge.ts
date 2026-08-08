'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { isAbortError } from '../core/client';
import { createCorrelationID } from '../core/ids';
import { transition } from '../core/machine';
import { MAX_CONSECUTIVE_FAILURES, nextDelay } from '../core/polling';
import { PixError } from '../core/types';
import type { Charge, CheckoutState } from '../core/types';
import { writeClipboard } from './clipboard';
import { useWooviContext } from './WooviProvider';

export interface UsePixChargeOptions {
  /** Centavos, inteiro. 5000 = R$ 50,00. */
  amount: number;
  comment?: string;
  /**
   * Disparado UMA vez por intenção quando a cobrança fica pronta — é aqui que
   * a loja amarra o correlationID ao pedido dela (conciliação).
   */
  onChargeCreated?: (charge: Charge) => void;
  /** Disparado UMA vez quando o pagamento confirma. */
  onPaid?: (charge: Charge) => void;
  /** Disparado UMA vez quando a cobrança expira. */
  onExpired?: (charge: Charge) => void;
}

export interface UsePixChargeResult {
  state: CheckoutState;
  /** Atalho: a cobrança do estado atual, se houver. */
  charge: Charge | null;
  /** Derivado de charge.expiresAt a cada render — nunca dessincroniza. */
  remainingMs: number;
  /** true se copiou; false se o clipboard foi negado (mostre o código). */
  copyToClipboard: () => Promise<boolean>;
  /** Válido no estado error. */
  retry: () => void;
  /** Válido no estado expired. */
  newCharge: () => void;
}

const INITIAL_STATE: CheckoutState = { status: 'creating' };

function toPixError(err: unknown): PixError {
  if (err instanceof PixError) return err;
  return new PixError('network', err instanceof Error ? err.message : 'Falha de rede');
}

/**
 * A camada headless (FR-012): todo o comportamento do checkout, nenhum visual.
 * O reducer puro `transition` é a única fonte de mudança de estado; os efeitos
 * daqui só disparam eventos e cuidam de timers/requisições — e limpam TUDO
 * no desmonte (FR-005).
 */
export function usePixCharge(options: UsePixChargeOptions): UsePixChargeResult {
  const { client } = useWooviContext();
  const [state, dispatch] = useReducer(transition, INITIAL_STATE);

  // Uma intenção de compra = um correlationID (R9). StrictMode monta duas
  // vezes? O ID é o mesmo, então a Woovi devolve a MESMA cobrança (FR-020).
  const [intentId, setIntentId] = useState(() => createCorrelationID());
  const [now, setNow] = useState(() => Date.now());

  const stateRef = useRef(state);
  stateRef.current = state;
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const firedRef = useRef({ created: false, paid: false, expired: false });

  // ── 1. Criação: um POST por intenção, abortável ──────────────────────────
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    client
      .createCharge(
        {
          correlationID: intentId,
          value: optionsRef.current.amount,
          comment: optionsRef.current.comment,
        },
        { signal: controller.signal },
      )
      .then((charge) => {
        if (!cancelled) dispatch({ type: 'CHARGE_READY', charge });
      })
      .catch((err: unknown) => {
        if (!cancelled && !isAbortError(err)) dispatch({ type: 'CREATE_FAILED', error: toPixError(err) });
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [client, intentId]);

  // ── 2. Polling: setTimeout ENCADEADO (nunca setInterval) ─────────────────
  // O próximo agendamento só nasce quando a resposta anterior chega, então
  // rede lenta jamais empilha requisições. Aba oculta pausa; a volta checa
  // na hora. Pagou/expirou/desmontou → para e limpa (SC-004).
  useEffect(() => {
    if (state.status !== 'awaiting_payment') return;
    const { correlationID } = state.charge;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    let failures = 0;
    const startedAt = Date.now();

    const check = async () => {
      timer = undefined;
      controller = new AbortController();
      try {
        const fresh = await client.getCharge(correlationID, { signal: controller.signal });
        if (stopped) return;
        failures = 0;
        if (fresh.status === 'COMPLETED') {
          dispatch({ type: 'STATUS_PAID', charge: fresh });
          return;
        }
        if (fresh.status === 'EXPIRED') {
          dispatch({ type: 'STATUS_EXPIRED' });
          return;
        }
        schedule();
      } catch (err) {
        if (stopped || isAbortError(err)) return;
        failures += 1;
        if (failures >= MAX_CONSECUTIVE_FAILURES) {
          dispatch({ type: 'POLLING_LOST', error: toPixError(err) });
          return;
        }
        schedule();
      }
    };

    const schedule = () => {
      if (stopped) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      timer = setTimeout(check, nextDelay(Date.now() - startedAt));
    };

    const onVisibility = () => {
      if (document.visibilityState !== 'visible' || stopped) return;
      setNow(Date.now()); // contador correto imediatamente na volta
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
      void check();
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility);
    }
    schedule();

    return () => {
      stopped = true;
      if (timer !== undefined) clearTimeout(timer);
      controller?.abort();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
    };
  }, [client, state]);

  // ── 3. Tick do contador: 1s, só enquanto aguarda ─────────────────────────
  useEffect(() => {
    if (state.status !== 'awaiting_payment') return;
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, [state.status]);

  const remainingMs =
    state.status === 'awaiting_payment' ? Math.max(0, state.charge.expiresAt - now) : 0;

  // ── 4. Contador zerou: checagem FINAL — mas quem decide é o servidor ─────
  // O contador é do navegador; a expiração é da Woovi. Se o relógio local
  // disser "acabou" e a API disser ACTIVE, a cobrança AINDA É PAGÁVEL — seria
  // um erro caro esconder um QR válido porque o relógio do visitante adianta.
  // Então: pago → pago, expirado → expirado, ainda ativo → segue aguardando e
  // deixa o polling normal trazer a palavra final.
  const zeroed = state.status === 'awaiting_payment' && remainingMs <= 0;
  useEffect(() => {
    if (!zeroed) return;
    const current = stateRef.current;
    if (current.status !== 'awaiting_payment') return;
    let cancelled = false;
    const controller = new AbortController();
    client
      .getCharge(current.charge.correlationID, { signal: controller.signal })
      .then((fresh) => {
        if (cancelled) return;
        if (fresh.status === 'COMPLETED') dispatch({ type: 'STATUS_PAID', charge: fresh });
        else if (fresh.status === 'EXPIRED') dispatch({ type: 'STATUS_EXPIRED' });
      })
      .catch(() => {
        // Falha de rede não expira nada: o polling em curso decide, e ele já
        // tem contador de falhas próprio para virar estado de erro.
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [zeroed, client]);

  // ── 5. Callbacks disparados exatamente uma vez por intenção ──────────────
  useEffect(() => {
    if (state.status === 'awaiting_payment' && !firedRef.current.created) {
      firedRef.current.created = true;
      optionsRef.current.onChargeCreated?.(state.charge);
    }
    if (state.status === 'paid' && !firedRef.current.paid) {
      firedRef.current.paid = true;
      optionsRef.current.onPaid?.(state.charge);
    }
    if (state.status === 'expired' && !firedRef.current.expired) {
      firedRef.current.expired = true;
      optionsRef.current.onExpired?.(state.charge);
    }
  }, [state]);

  const startNewIntent = useCallback(() => {
    firedRef.current = { created: false, paid: false, expired: false };
    setNow(Date.now());
    setIntentId(createCorrelationID());
  }, []);

  const retry = useCallback(() => {
    if (stateRef.current.status !== 'error') return;
    dispatch({ type: 'RETRY' });
    startNewIntent();
  }, [startNewIntent]);

  const newCharge = useCallback(() => {
    if (stateRef.current.status !== 'expired') return;
    dispatch({ type: 'NEW_CHARGE' });
    startNewIntent();
  }, [startNewIntent]);

  const copyToClipboard = useCallback(async () => {
    const current = stateRef.current;
    const code = 'charge' in current && current.charge ? current.charge.brCode : null;
    if (!code) return false;
    return writeClipboard(code);
  }, []);

  const charge = 'charge' in state && state.charge ? state.charge : null;

  return { state, charge, remainingMs, copyToClipboard, retry, newCharge };
}
