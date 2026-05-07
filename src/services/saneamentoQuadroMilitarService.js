import { base44 } from '@/api/base44Client';
import { carregarMilitaresComMatriculas, getLotacaoAtualMilitar } from '@/services/matriculaMilitarViewService';

export const QBMPT_LEGADO_FILTRO = { quadro: 'QBMPT' };
export const QBMPT_PARA_QPTBM_PAYLOAD = { quadro: 'QPTBM' };

function prepararMilitarPreview(militar = {}) {
  return {
    ...militar,
    lotacao_informativa: getLotacaoAtualMilitar(militar),
  };
}

export async function listarMilitaresQbmptLegado() {
  const militares = await base44.entities.Militar.filter(QBMPT_LEGADO_FILTRO);
  const enriquecidos = await carregarMilitaresComMatriculas(militares || []);
  return (enriquecidos || []).map(prepararMilitarPreview);
}

export async function converterMilitaresQbmptParaQptbm(militares = []) {
  const candidatos = (militares || []).filter((militar) => String(militar?.quadro || '').trim() === 'QBMPT');
  const resultados = await Promise.allSettled(
    candidatos.map((militar) => base44.entities.Militar.update(militar.id, QBMPT_PARA_QPTBM_PAYLOAD))
  );

  const idsAtualizados = [];
  const falhas = [];

  resultados.forEach((resultado, index) => {
    const militar = candidatos[index];
    if (resultado.status === 'fulfilled') {
      idsAtualizados.push(militar.id);
      return;
    }

    falhas.push({
      id: militar.id,
      nome_guerra: militar.nome_guerra || '',
      mensagem: resultado.reason?.message || 'Falha desconhecida ao atualizar Militar.quadro.',
    });
  });

  return {
    totalEncontrado: (militares || []).length,
    totalAtualizado: idsAtualizados.length,
    falhas,
    idsAtualizados,
  };
}
