/**
 * Todos os textos que o comprador ve, num unico lugar (FR-022).
 * i18n futura = trocar este objeto. Nenhuma string de UI espalhada
 * pelos componentes.
 */
export const texts = {
  amountLabel: 'Valor a pagar',
  creating: 'Preparando o Pix…',
  instructions: 'Abra o app do seu banco, escolha pagar com Pix e escaneie o código — ou copie e cole.',
  instructionsMobile: 'Copie o código e cole na área Pix do app do seu banco.',
  copy: 'Copiar código Pix',
  copied: 'Copiado ✓',
  copyFailed: 'Não conseguimos copiar automaticamente. Selecione e copie o código abaixo:',
  expiresIn: 'Expira em',
  paidTitle: 'Pagamento confirmado',
  paidSubtitle: 'Recebemos o seu Pix. Pode fechar esta tela.',
  expiredTitle: 'Este código expirou',
  expiredSubtitle: 'Sem problema: gere um novo e pague em seguida.',
  newCharge: 'Gerar nova cobrança',
  errorCreateTitle: 'Não conseguimos gerar o Pix',
  errorPollingTitle: 'Perdemos a conexão',
  errorSubtitle: 'Verifique sua internet e tente de novo.',
  retry: 'Tentar de novo',
} as const;

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** 5000 → "R$ 50,00". Sempre via Intl; nunca concatenar "R$" na mao. */
export function formatBRL(cents: number): string {
  return brl.format(cents / 100);
}

/**
 * 90_000 → "01:30"; acima de 1h ganha segmento de horas: 86_400_000 → "24:00:00".
 * O TTL padrao do sandbox da Woovi e 24h — sem o segmento de horas o contador
 * mostraria "1440:00" (bug achado pelo code review). Piso em 00:00.
 */
export function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mmss = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return hours > 0 ? `${hours}:${mmss}` : mmss;
}
