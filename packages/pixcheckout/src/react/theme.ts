import type { CSSProperties } from 'react';

/**
 * Tema via CSS variables (R7): o integrador muda cor/raio/fonte por prop,
 * sem guerra de especificidade e sem importar arquivo CSS nenhum —
 * o provider injeta a stylesheet uma unica vez.
 */
export interface Appearance {
  /** Cor de destaque (botao principal, icone de sucesso). */
  colorPrimary?: string;
  /** Raio de borda do cartao; os elementos internos derivam dele. */
  borderRadius?: string;
  /** Familia tipografica do checkout inteiro. */
  fontFamily?: string;
}

const STYLE_ID = 'pixck-styles';

/**
 * Layout mobile-first de verdade: o copia e cola vem ANTES do QR no DOM
 * (celular e leitores de tela veem primeiro — FR-009); em recipiente largo,
 * a @container query poe o QR como protagonista a esquerda. Container query
 * em vez de media query porque o checkout e um widget embutido: ele deve
 * responder ao espaco QUE LHE DERAM, nao ao tamanho da janela.
 */
export const stylesheet = `
.pixck-root {
  --pixck-color-primary: #059669;
  --pixck-radius: 16px;
  --pixck-font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  container-type: inline-size;
  width: 100%;
  max-width: 680px;
}
.pixck-card {
  font-family: var(--pixck-font);
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: var(--pixck-radius);
  padding: 24px;
  color: #111827;
  box-sizing: border-box;
}
.pixck-card *, .pixck-card *::before, .pixck-card *::after { box-sizing: inherit; }

.pixck-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}
.pixck-amount-label { display: block; font-size: 13px; color: #6b7280; }
.pixck-amount { font-size: 28px; font-weight: 700; }
.pixck-countdown {
  font-variant-numeric: tabular-nums;
  background: #f3f4f6;
  border-radius: 999px;
  padding: 6px 14px;
  font-size: 14px;
  color: #374151;
  white-space: nowrap;
}

.pixck-body { display: grid; gap: 20px; grid-template-areas: 'copy' 'qr'; }
.pixck-copyarea { grid-area: copy; display: flex; flex-direction: column; gap: 12px; }
.pixck-qrarea { grid-area: qr; display: flex; justify-content: center; }

@container (min-width: 560px) {
  .pixck-body {
    grid-template-areas: 'qr copy';
    grid-template-columns: auto 1fr;
    align-items: center;
  }
  .pixck-instructions--wide { display: block; }
  .pixck-instructions--mobile { display: none; }
}

.pixck-instructions { margin: 0; font-size: 14px; line-height: 1.5; color: #374151; }
/* instrucao certa para cada contexto: sem camera apontavel no celular */
.pixck-instructions--wide { display: none; }

.pixck-btn {
  font: inherit;
  font-weight: 600;
  border: 0;
  cursor: pointer;
  border-radius: calc(var(--pixck-radius) * 0.6);
  padding: 14px 20px;
  min-height: 48px; /* alvo de toque confortavel */
  transition: filter 0.15s;
}
.pixck-btn:hover { filter: brightness(0.95); }
.pixck-btn:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--pixck-color-primary) 40%, transparent);
  outline-offset: 2px;
}
.pixck-btn-primary { background: var(--pixck-color-primary); color: #ffffff; }
.pixck-btn-secondary { background: #ffffff; color: #111827; border: 1px solid #d1d5db; }

.pixck-qr {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: calc(var(--pixck-radius) * 0.6);
  padding: 8px;
}
.pixck-qr svg { display: block; width: 100%; height: 100%; }

.pixck-code {
  display: block;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  word-break: break-all;
  user-select: all;
  background: #f9fafb;
  border: 1px dashed #d1d5db;
  border-radius: 8px;
  padding: 12px;
}

.pixck-result { text-align: center; padding: 24px 8px; }
.pixck-result-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 26px;
  margin-bottom: 12px;
}
.pixck-result-icon-paid {
  background: color-mix(in srgb, var(--pixck-color-primary) 15%, #ffffff);
  color: var(--pixck-color-primary);
}
.pixck-result-icon-muted { background: #f3f4f6; color: #6b7280; }
.pixck-result-title { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
.pixck-result-subtitle { margin: 0 0 20px; font-size: 14px; color: #6b7280; }

/* esqueleto no formato do conteudo final — nunca spinner solto (FR-016) */
.pixck-skeleton { display: grid; gap: 16px; }
.pixck-shimmer {
  border-radius: 8px;
  background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
  background-size: 200% 100%;
  animation: pixck-shimmer 1.4s infinite;
}
@keyframes pixck-shimmer { to { background-position: -200% 0; } }
@media (prefers-reduced-motion: reduce) {
  .pixck-shimmer { animation: none; }
}
`;

/** Idempotente e segura em SSR: no servidor simplesmente nao faz nada. */
export function injectStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = stylesheet;
  document.head.appendChild(el);
}

/** Junta a classe base da biblioteca com a classe opcional do integrador. */
export function cx(base: string, className?: string): string {
  return className ? `${base} ${className}` : base;
}

export function appearanceToVars(appearance?: Appearance): CSSProperties {
  const vars: Record<string, string> = {};
  if (appearance?.colorPrimary) vars['--pixck-color-primary'] = appearance.colorPrimary;
  if (appearance?.borderRadius) vars['--pixck-radius'] = appearance.borderRadius;
  if (appearance?.fontFamily) vars['--pixck-font'] = appearance.fontFamily;
  return vars as CSSProperties;
}
