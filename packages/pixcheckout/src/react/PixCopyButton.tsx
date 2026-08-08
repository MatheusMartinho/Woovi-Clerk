'use client';

import { useEffect, useRef, useState } from 'react';
import { texts } from '../i18n/texts';
import { writeClipboard } from './clipboard';
import { cx } from './theme';

export interface PixCopyButtonProps {
  brCode: string;
  className?: string;
}

/**
 * Copia e cola com feedback: vira "Copiado ✓" por 2 segundos (FR-008).
 * Se o clipboard for negado, o código aparece completo e selecionável —
 * a pessoa ainda consegue pagar (edge case da spec).
 */
export function PixCopyButton({ brCode, className }: PixCopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  async function handleCopy() {
    const ok = await writeClipboard(brCode);
    if (ok) {
      setFailed(false);
      setCopied(true);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2_000);
    } else {
      setFailed(true);
    }
  }

  return (
    <>
      <button
        type="button"
        className={cx('pixck-btn pixck-btn-primary', className)}
        onClick={handleCopy}
        aria-live="polite"
      >
        {copied ? texts.copied : texts.copy}
      </button>
      {failed ? (
        <div>
          <p className="pixck-instructions">{texts.copyFailed}</p>
          <code className="pixck-code">{brCode}</code>
        </div>
      ) : null}
    </>
  );
}
