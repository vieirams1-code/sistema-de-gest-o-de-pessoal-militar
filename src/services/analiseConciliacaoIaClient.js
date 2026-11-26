import { base44 } from '@/api/base44Client';
import { empacotarCandidatos } from '@/utils/boletim/candidatosIa';

/**
 * Cliente da análise assistida por IA da conciliação (BG, BGR e DOEMS).
 * A chamada só acontece por ação explícita do usuário. O resultado é
 * sempre tratado como sugestão para revisão.
 *
 * O recorte dos militares por nota é feito no backend, de forma
 * determinística: cada item é comparado apenas com os militares citados
 * no seu próprio texto.
 */

export async function analisarDocumentoComIA({ tipo, numero, data, itens = [], militares = [] }) {
  if (!itens.length) throw new Error('Nenhum trecho disponível para analisar.');

  const candidatos = empacotarCandidatos(militares);
  if (!candidatos.length) {
    throw new Error('O efetivo ativo não foi carregado. Recarregue a página antes de analisar.');
  }

  const response = await base44.functions.invoke('analisarDocumentoConciliacaoIA', {
    tipo,
    numero,
    data,
    itens: itens.map(item => ({
      id: String(item.id),
      numero: item.numero || '',
      pagina: item.pagina || '',
      contexto: item.contexto,
    })),
    candidatos,
  });

  const body = response?.data ?? response ?? {};
  if (body?.error) throw new Error(body.error);
  return {
    sugestoes: Array.isArray(body?.sugestoes) ? body.sugestoes : [],
    observacoes: body?.observacoes || '',
    meta: body?.meta || {},
    candidatosConsiderados: candidatos.length,
  };
}