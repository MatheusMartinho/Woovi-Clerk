'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PixCheckout, WooviProvider } from 'pixcheckout';

export default function CheckoutPage() {
  const router = useRouter();

  // As cinco linhas prometidas — todo o resto desta página é decoração:
  return (
    <main className="page">
      <Link className="voltar" href="/">
        ← voltar para a loja
      </Link>
      <WooviProvider endpoint="/api/pix">
        <PixCheckout amount={5000} onPaid={() => router.push('/obrigado')} />
      </WooviProvider>
    </main>
  );
}
