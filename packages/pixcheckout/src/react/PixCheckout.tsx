'use client';

import type { ReactNode } from 'react';
import type { Charge, CheckoutState } from '../core/types';
import { formatBRL, texts } from '../i18n/texts';
import { PixCopyButton } from './PixCopyButton';
import { PixQRCode } from './PixQRCode';
import { PixStatus } from './PixStatus';
import { appearanceToVars } from './theme';
import type { Appearance } from './theme';
import { usePixCharge } from './usePixCharge';
import { useWooviContext } from './WooviProvider';

export interface PixCheckoutProps {
  /** Centavos, inteiro. 5000 = R$ 50,00. */
  amount: number;
  comment?: string;
  onPaid?: (charge: Charge) => void;
  onExpired?: (charge: Charge) => void;
  className?: string;
}

/**
 * O caminho de 90%: o checkout completo. Toda a inteligência vem do
 * usePixCharge; este componente só escolhe qual interface renderizar
 * para cada estado — e é exatamente por isso que ele não tem estado próprio.
 */
export function PixCheckout(props: PixCheckoutProps) {
  const { appearance } = useWooviContext();
  const { state, remainingMs, retry, newCharge } = usePixCharge(props);
  return (
    <PixCheckoutView
      state={state}
      remainingMs={remainingMs}
      onRetry={retry}
      onNewCharge={newCharge}
      appearance={appearance}
      className={props.className}
    />
  );
}

export interface PixCheckoutViewProps {
  state: CheckoutState;
  remainingMs: number;
  onRetry: () => void;
  onNewCharge: () => void;
  appearance?: Appearance;
  className?: string;
}

/**
 * Camada de apresentação pura: recebe o estado, devolve interface.
 * Separada do hook para o Storybook mostrar cada estado sem rede (SC-005)
 * e para os testes de comportamento não dependerem de timers.
 */
export function PixCheckoutView({
  state,
  remainingMs,
  onRetry,
  onNewCharge,
  appearance,
  className,
}: PixCheckoutViewProps) {
  return (
    <div
      className={className ? `pixck-root ${className}` : 'pixck-root'}
      style={appearanceToVars(appearance)}
    >
      <div className="pixck-card" data-state={state.status} aria-live="polite">
        {state.status === 'creating' ? <CreatingSkeleton /> : null}
        {state.status === 'awaiting_payment' ? (
          <Awaiting charge={state.charge} remainingMs={remainingMs} />
        ) : null}
        {state.status === 'paid' ? (
          <Result
            icon="✓"
            iconVariant="paid"
            title={texts.paidTitle}
            subtitle={texts.paidSubtitle}
            amount={state.charge.value}
          />
        ) : null}
        {state.status === 'expired' ? (
          <Result icon="⏱" iconVariant="muted" title={texts.expiredTitle} subtitle={texts.expiredSubtitle}>
            <button type="button" className="pixck-btn pixck-btn-primary" onClick={onNewCharge}>
              {texts.newCharge}
            </button>
          </Result>
        ) : null}
        {state.status === 'error' ? (
          <Result
            icon="!"
            iconVariant="muted"
            title={state.reason === 'create_failed' ? texts.errorCreateTitle : texts.errorPollingTitle}
            subtitle={texts.errorSubtitle}
          >
            <button type="button" className="pixck-btn pixck-btn-secondary" onClick={onRetry}>
              {texts.retry}
            </button>
          </Result>
        ) : null}
      </div>
    </div>
  );
}

function Awaiting({ charge, remainingMs }: { charge: Charge; remainingMs: number }) {
  return (
    <>
      <div className="pixck-header">
        <div>
          <span className="pixck-amount-label">{texts.amountLabel}</span>
          <span className="pixck-amount">{formatBRL(charge.value)}</span>
        </div>
        <PixStatus remainingMs={remainingMs} />
      </div>
      <div className="pixck-body">
        {/* copia e cola ANTES do QR no DOM: prioridade no celular e em leitores de tela (FR-009) */}
        <div className="pixck-copyarea">
          <p className="pixck-instructions">{texts.instructions}</p>
          <PixCopyButton brCode={charge.brCode} />
        </div>
        <div className="pixck-qrarea">
          <PixQRCode brCode={charge.brCode} />
        </div>
      </div>
    </>
  );
}

function Result({
  icon,
  iconVariant,
  title,
  subtitle,
  amount,
  children,
}: {
  icon: string;
  iconVariant: 'paid' | 'muted';
  title: string;
  subtitle: string;
  amount?: number;
  children?: ReactNode;
}) {
  return (
    <div className="pixck-result">
      <span className={`pixck-result-icon pixck-result-icon-${iconVariant}`} aria-hidden="true">
        {icon}
      </span>
      <h2 className="pixck-result-title">{title}</h2>
      <p className="pixck-result-subtitle">
        {amount !== undefined ? `${formatBRL(amount)} · ` : ''}
        {subtitle}
      </p>
      {children}
    </div>
  );
}

/** Esqueleto no formato do conteúdo final — nunca spinner solto (FR-016). */
function CreatingSkeleton() {
  return (
    <div className="pixck-skeleton" role="status" aria-busy="true" aria-label={texts.creating}>
      <div className="pixck-shimmer" style={{ height: 34, width: '40%' }} />
      <div className="pixck-shimmer" style={{ height: 48 }} />
      <div className="pixck-shimmer" style={{ height: 208, width: 208, margin: '0 auto' }} />
    </div>
  );
}
