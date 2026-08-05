import type { Meta, StoryObj } from '@storybook/react';
import type { CoreClient } from '../core/client';
import type { Charge, ChargeStatus } from '../core/types';
import { formatCountdown } from '../i18n/texts';
import { usePixCharge } from './usePixCharge';
import { WooviProvider } from './WooviProvider';

/**
 * A camada 2 sozinha (US2/FR-012): os cinco estados renderizados como TEXTO
 * PURO usando apenas usePixCharge() — nenhum componente visual da biblioteca.
 * É o que um dev com design próprio construiria por cima; também é o passo 4
 * do guia ("renderize cada estado como texto").
 */

const SAMPLE_BR_CODE = '00020126580014br.gov.bcb.pix.demo.headless6304ABCD';

/** Client falso: cria em ~1,2s e "paga" na terceira consulta de status. */
function makeWalkthroughClient(): CoreClient {
  let polls = 0;
  const make = (correlationID: string, status: ChargeStatus): Charge => ({
    correlationID,
    value: 5000,
    status,
    brCode: SAMPLE_BR_CODE,
    expiresAt: Date.now() + 5 * 60 * 1000,
  });
  return {
    async createCharge(payload) {
      await new Promise((resolve) => setTimeout(resolve, 1_200));
      polls = 0;
      return make(payload.correlationID, 'ACTIVE');
    },
    async getCharge(correlationID) {
      polls += 1;
      return make(correlationID, polls >= 3 ? 'COMPLETED' : 'ACTIVE');
    },
  };
}

function HeadlessCheckout() {
  const { state, charge, remainingMs, copyToClipboard, retry, newCharge } = usePixCharge({
    amount: 5000,
  });

  return (
    <pre style={{ fontSize: 14, lineHeight: 1.8 }}>
      {`estado:    ${state.status}
restante:  ${formatCountdown(remainingMs)}
brCode:    ${charge ? `${charge.brCode.slice(0, 32)}…` : '—'}

(pagamento simulado confirma na 3ª consulta, ~9s)`}
      {'\n\n'}
      <button type="button" onClick={() => void copyToClipboard()}>
        copiar
      </button>{' '}
      <button type="button" onClick={retry}>
        retry
      </button>{' '}
      <button type="button" onClick={newCharge}>
        nova cobrança
      </button>
    </pre>
  );
}

const meta = {
  title: 'PixCheckout/Headless (só o hook)',
  component: HeadlessCheckout,
  decorators: [
    (Story) => (
      <WooviProvider client={makeWalkthroughClient()}>
        <Story />
      </WooviProvider>
    ),
  ],
} satisfies Meta<typeof HeadlessCheckout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CicloCompleto: Story = {};
