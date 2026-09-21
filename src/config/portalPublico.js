/**
 * Endereço público oficial do Portal do Militar (lado do painel).
 *
 * Deve permanecer idêntico ao definido em base44/shared/portal/portalUrl.ts.
 * O link nunca é derivado do navegador de quem dispara — a pré-visualização
 * geraria endereços temporários que deixam o militar na tela de espera.
 */
export const ENDERECO_PUBLICO_PORTAL = 'https://vivicas.base44.app/Portal';

const HOSTS_NAO_PUBLICOS = /(^|\.)(preview|preview-sandbox|sandbox|localhost|127\.0\.0\.1)(\.|--|$)/i;

export function ehEnderecoPublico(valor) {
  const raw = String(valor ?? '').trim();
  if (!raw) return false;
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol)) return false;
    return !HOSTS_NAO_PUBLICOS.test(url.hostname);
  } catch {
    return false;
  }
}