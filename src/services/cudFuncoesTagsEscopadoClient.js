import { base44 } from '@/api/base44Client';

async function invocar(payload, { unwrapData = true } = {}) {
  try {
    const response = await base44.functions.invoke('cudFuncoesTagsEscopado', payload);
    const body = response?.data ?? response;
    if (body?.error) throw new Error(body.error);
    if (!unwrapData) return body;
    return body?.data || body;
  } catch (error) {
    const status = error?.response?.status;
    const body = error?.response?.data;
    const backendMessage = body?.message || body?.error || body?.details || error?.message;
    throw new Error(backendMessage || 'Falha ao executar operação em lote.');
  }
}

// Endpoint mantido exclusivamente para operações em massa (Bulk)
// que utilizam otimizações de performance (bulkCreate) no backend.
export const bulkMilitarFuncoesEscopado = (itens) => invocar({ entidade: 'MilitarFuncao', operacao: 'bulk', itens }, { unwrapData: false });
export const bulkMilitarTagsEscopado = (itens) => invocar({ entidade: 'MilitarTag', operacao: 'bulk', itens }, { unwrapData: false });
export const bulkFeriasTagsEscopado = (itens) => invocar({ entidade: 'FeriasTag', operacao: 'bulk', itens }, { unwrapData: false });
