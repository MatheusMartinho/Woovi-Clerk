import Link from 'next/link';

/** A lojinha fictícia: um produto, um botão. O protagonista é o checkout. */
export default function LojaPage() {
  return (
    <main className="page">
      <span className="brand">Café Cinco Linhas</span>
      <div className="produto">
        <span className="produto-emoji" aria-hidden>
          ☕
        </span>
        <h1>Pacote de café especial — 250g</h1>
        <p>
          Torrado esta semana, notas de chocolate e caramelo. Enviado no mesmo dia para todo o
          Brasil. (É uma loja de mentira — mas o Pix do checkout é o fluxo real do sandbox.)
        </p>
        <span className="produto-preco">R$ 50,00</span>
        <Link className="botao-comprar" href="/checkout">
          Comprar com Pix
        </Link>
      </div>
    </main>
  );
}
