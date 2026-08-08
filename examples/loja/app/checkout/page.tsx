'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { PixCheckout, WooviProvider } from 'pixcheckout';
import type { Charge } from 'pixcheckout';

export default function CheckoutPage() {
  const router = useRouter();
  const [charge, setCharge] = useState<Charge | null>(null);
  const [paying, setPaying] = useState(false);

  // Só para o painel de demonstração abaixo — uma loja real não precisa disto.
  async function simularPagamento() {
    if (!charge || paying) return;
    setPaying(true);
    await fetch('/api/sandbox/pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correlationID: charge.correlationID }),
    }).catch(() => setPaying(false));
    // daqui em diante ninguém precisa fazer nada: o polling do componente
    // percebe o pagamento e o onPaid navega — é exatamente essa a graça.
  }

  // As cinco linhas prometidas — todo o resto desta página é decoração:
  return (
    <main className="page">
      <Link className="voltar" href="/">
        ← voltar para a loja
      </Link>
      <WooviProvider endpoint="/api/pix">
        <PixCheckout
          amount={5000}
          onChargeCreated={setCharge}
          onPaid={() => router.push('/obrigado')}
        />
      </WooviProvider>

      {charge ? (
        <aside className="sandbox-painel">
          <p>
            <strong>Modo demonstração.</strong> Numa loja real, você pagaria no app do seu banco.
            Como isto é o sandbox da Woovi (dinheiro de mentira), pode pagar com um clique:
          </p>
          <button type="button" onClick={simularPagamento} disabled={paying}>
            {paying ? 'Pagando… observe o checkout acima ☝️' : '✨ Simular pagamento'}
          </button>
        </aside>
      ) : null}
    </main>
  );
}
