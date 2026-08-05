'use client';

import { formatCountdown, texts } from '../i18n/texts';

export interface PixStatusProps {
  remainingMs: number;
  className?: string;
}

/** Contador de expiração visível (FR-007), sempre derivado do instante absoluto. */
export function PixStatus({ remainingMs, className }: PixStatusProps) {
  const countdown = formatCountdown(remainingMs);
  return (
    <span
      role="timer"
      aria-label={`${texts.expiresIn} ${countdown}`}
      className={className ? `pixck-countdown ${className}` : 'pixck-countdown'}
    >
      {texts.expiresIn} <strong>{countdown}</strong>
    </span>
  );
}
