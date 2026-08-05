'use client';

import { useMemo } from 'react';
import { renderSVG } from 'uqr';

export interface PixQRCodeProps {
  /** O código copia e cola — o QR é gerado localmente a partir dele (R6). */
  brCode: string;
  size?: number;
  className?: string;
}

/**
 * QR em SVG gerado no cliente: sem requisição extra, sem flash de imagem,
 * funciona offline no Storybook e escala perfeito em qualquer tela.
 */
export function PixQRCode({ brCode, size = 208, className }: PixQRCodeProps) {
  const svg = useMemo(() => renderSVG(brCode, { border: 1 }), [brCode]);
  return (
    <div
      role="img"
      aria-label="QR code para pagamento Pix"
      className={className ? `pixck-qr ${className}` : 'pixck-qr'}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
