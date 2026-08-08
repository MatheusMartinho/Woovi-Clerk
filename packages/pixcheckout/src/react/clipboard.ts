/**
 * A UNICA implementacao de copiar da biblioteca: usada pelo PixCopyButton e
 * pelo copyToClipboard() do hook headless. Antes eram duas copias — uma
 * melhoria de fallback numa nunca chegaria na outra (achado do code review).
 * false = clipboard indisponivel/negado; quem chama mostra o codigo visivel.
 */
export async function writeClipboard(text: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
