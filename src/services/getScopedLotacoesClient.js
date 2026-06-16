import { base44 } from '@/api/base44Client';
import { getEffectiveEmail as getEffectiveEmailFromStorage } from '@/utils/impersonation';

// =====================================================================
// getScopedLotacoesClient — Lote 1C-A
// ---------------------------------------------------------------------
// Helper mínimo para invocar a Deno Function `getScopedLotacoes` a partir
// do frontend. Encapsula:
//   - leitura do effectiveEmail (modo usuário efetivo) via helper central
//     de impersonação (utils/impersonation), que entende o envelope com TTL;
//   - normalização do payload;
//   - extração da resposta axios-like (response.data) com fallback seguro.
//
// A validação real de impersonação ocorre no backend; o sessionStorage
// aqui é apenas uma ponte controlada (mesmo padrão do
// getScopedMilitaresClient e do useCurrentUser).
// =====================================================================

// (P0.1) Reexporta o helper central para preservar a API pública deste módulo
// sem ler o sessionStorage diretamente (evita enviar o envelope JSON inteiro).
export function getEffectiveEmail() {
  return getEffectiveEmailFromStorage();
}

/**
 * Invoca a Deno Function `getScopedLotacoes`.
 *
 * @param {Object} payload
 * @returns {Promise<{ lotacoes: Array, meta: Object }>}
 */
export async function fetchScopedLotacoes(payload = {}) {
  const effectiveEmail = payload.effectiveEmail !== undefined
    ? payload.effectiveEmail
    : getEffectiveEmailFromStorage();

  const finalPayload = { ...payload };
  if (effectiveEmail) {
    finalPayload.effectiveEmail = effectiveEmail;
  } else {
    delete finalPayload.effectiveEmail;
  }

  const response = await base44.functions.invoke('getScopedLotacoes', finalPayload);
  const data = response?.data ?? response ?? {};
  return {
    lotacoes: Array.isArray(data.lotacoes) ? data.lotacoes : [],
    lotacoesTree: Array.isArray(data.lotacoesTree) ? data.lotacoesTree : [],
    meta: data.meta || {},
  };
}