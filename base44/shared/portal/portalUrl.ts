/**
 * Endereço público oficial do Portal do Militar.
 *
 * Fonte única de verdade para todos os links de Portal enviados em mensagens
 * (campanhas de férias, avisos e demais comunicações). O link NUNCA deve ser
 * derivado do navegador de quem dispara, pois a pré-visualização geraria
 * endereços temporários que deixam o militar na tela "Preview is starting up".
 */
export const ENDERECO_PUBLICO_PORTAL = 'https://vivicas.base44.app/Portal';

/** Hosts de pré-visualização/sandbox que não podem ser enviados em mensagens. */
const HOSTS_NAO_PUBLICOS = /(^|\.)(preview|preview-sandbox|sandbox|localhost|127\.0\.0\.1)(\.|--|$)/i;

export function ehEnderecoPublico(valor: unknown): boolean {
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

/**
 * Resolve o link do Portal usado nas mensagens.
 * Sem valor informado, devolve o endereço público oficial.
 * Recusa endereços inválidos e endereços de pré-visualização/sandbox.
 */
export function resolverLinkPortal(valor?: unknown): string {
  const raw = String(valor ?? '').trim();
  if (!raw) return ENDERECO_PUBLICO_PORTAL;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw Object.assign(new Error('Link do Portal do Militar inválido.'), { status: 400 });
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw Object.assign(new Error('Link do Portal do Militar inválido.'), { status: 400 });
  }
  if (HOSTS_NAO_PUBLICOS.test(url.hostname)) {
    throw Object.assign(
      new Error('O link do Portal precisa apontar para o endereço público do sistema. Endereços de pré-visualização não podem ser usados nas mensagens.'),
      { status: 400 },
    );
  }
  return url.toString();
}