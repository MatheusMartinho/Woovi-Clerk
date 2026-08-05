import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Café Cinco Linhas — demo PixCheckout',
  description: 'Loja de exemplo do PixCheckout: um checkout Pix completo em cinco linhas de React.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
