import Link from 'next/link';

/** Destino do onPaid: a confirmação da loja. */
export default function ObrigadoPage() {
  return (
    <main className="page obrigado">
      <span className="emoji" aria-hidden>
        📦
      </span>
      <h1>Obrigado! Pagamento recebido.</h1>
      <p>Seu café sai para entrega ainda hoje.</p>
      <Link className="botao-comprar" href="/">
        Voltar para a loja
      </Link>
    </main>
  );
}
