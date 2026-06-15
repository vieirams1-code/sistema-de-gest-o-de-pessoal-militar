import { base44 } from '@/api/base44Client';
import { getEffectiveEmail } from '@/utils/impersonation';

/**
 * Busca escopada de documentos do Acervo Funcional Histórico (Busca Global).
 * Substitui as chamadas diretas a AcervoFuncionalHistorico.list() + Militar.list()
 * no frontend, garantindo que somente registros dentro do escopo do usuário
 * efetivo sejam retornados.
 */
export async function fetchScopedAcervoHistorico({ search } = {}) {
  const effectiveEmail = getEffectiveEmail();
  const payload = { search: search || '' };
  if (effectiveEmail) payload.effectiveEmail = effectiveEmail;

  const response = await base44.functions.invoke('getScopedAcervoHistorico', payload);
  const data = response?.data ?? response ?? {};
  return {
    documentos: Array.isArray(data.documentos) ? data.documentos : [],
    meta: data.meta || {},
  };
}