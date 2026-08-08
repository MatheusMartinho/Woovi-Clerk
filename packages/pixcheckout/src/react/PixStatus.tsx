'use client';

import { formatCountdown, texts } from '../i18n/texts';
import { cx } from './theme';

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
      className={cx('pixck-countdown', className)}
    >
      {texts.expiresIn} <strong>{countdown}</strong>
    </span>
  );
}
