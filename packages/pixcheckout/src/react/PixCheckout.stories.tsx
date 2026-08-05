import type { Meta, StoryObj } from '@storybook/react';
import type { Charge } from '../core/types';
import { PixApiError } from '../core/types';
import { PixCheckoutView } from './PixCheckout';
import { injectStyles } from './theme';

/**
 * Uma história por estado (FR-017 / SC-005): tudo renderiza offline, com
 * dados falsos, porque a View é apresentação pura — o estado entra por prop.
 */

const SAMPLE_BR_CODE =
  '00020126580014br.gov.bcb.pix0136123e4567-e89b-12d3-a456-4266554400005204000053039865405' +
  '50.005802BR5913LOJA EXEMPLO6009SAO PAULO62070503***6304ABCD';

const charge: Charge = {
  correlationID: 'demo-0001',
  value: 5000,
  status: 'ACTIVE',
  brCode: SAMPLE_BR_CODE,
  expiresAt: Date.now() + 12 * 60 * 1000,
};

const noop = () => {};

const meta = {
  title: 'PixCheckout/Estados',
  component: PixCheckoutView,
  decorators: [
    (Story) => {
      injectStyles();
      return (
        <div style={{ width: 640, maxWidth: '95vw' }}>
          <Story />
        </div>
      );
    },
  ],
  args: {
    remainingMs: 12 * 60 * 1000,
    onRetry: noop,
    onNewCharge: noop,
  },
} satisfies Meta<typeof PixCheckoutView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Criando: Story = {
  args: { state: { status: 'creating' } },
};

export const AguardandoPagamento: Story = {
  args: { state: { status: 'awaiting_payment', charge } },
};

/** Em recipiente estreito, o copia e cola assume o protagonismo (FR-009). */
export const AguardandoNoCelular: Story = {
  args: { state: { status: 'awaiting_payment', charge } },
  decorators: [
    (Story) => (
      <div style={{ width: 360 }}>
        <Story />
      </div>
    ),
  ],
};

export const Pago: Story = {
  args: { state: { status: 'paid', charge: { ...charge, status: 'COMPLETED' } } },
};

export const Expirado: Story = {
  args: { state: { status: 'expired', charge } },
};

export const Erro: Story = {
  args: {
    state: { status: 'error', reason: 'create_failed', error: new PixApiError('exemplo') },
  },
};

/** A prop appearance vira CSS variables — tema sem tocar em CSS (FR-015). */
export const AparenciaCustomizada: Story = {
  args: {
    state: { status: 'awaiting_payment', charge },
    appearance: { colorPrimary: '#7c3aed', borderRadius: '4px', fontFamily: 'Georgia, serif' },
  },
};
