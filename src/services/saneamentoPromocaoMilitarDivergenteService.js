import { base44 } from '@/api/base44Client';
import { carregarMilitaresComMatriculas } from '@/services/matriculaMilitarViewService';
import { montarDivergenciasPromocao, construirPayloadSincronizacaoPromocao } from '@/utils/antiguidade/saneamentoPromocaoDivergencia';

export const CONFIRMACAO_SINCRONIZACAO_PROMOCAO = 'SINCRONIZAR PROMOCAO';

export async function auditarMilitaresDivergentesPromocao({ entities = base44.entities, carregarMilitares = carregarMilitaresComMatriculas } = {}) {
  const militaresAtivos = await entities.Militar.filter({ status_cadastro: 'ativo' });
  const militaresEnriquecidos = await carregarMilitares(militaresAtivos || []);
  const historicos = await entities.HistoricoPromocaoMilitarV2.list();
  return montarDivergenciasPromocao({ militares: militaresEnriquecidos || [], historicos: historicos || [] }).map((item) => ({
    militar_id: item.militar_id,
    nome: item.militar.nome_completo || item.militar.nome_guerra || '—',
    matricula: item.militar.matricula || item.militar.matricula_atual || '—',
    posto_atual_militar: item.militar.posto_graduacao || '',
    quadro_atual_militar: item.militar.quadro || '',
    posto_historico_ativo: item.historico.posto_graduacao_novo || '',
    quadro_historico_ativo: item.historico.quadro_novo || '',
    data_promocao: item.historico.data_promocao || null,
    publicacao_ato: item.historico.ato_referencia || item.historico.boletim_referencia || '—',
    historico_id: item.historico.id,
    historico: item.historico,
    militar: item.militar,
  }));
}


export async function sincronizarCadastroMilitarComHistorico({ militarId, historico, confirmacao, entities = base44.entities }) {
  if (confirmacao !== CONFIRMACAO_SINCRONIZACAO_PROMOCAO) {
    throw new Error('Confirmação inválida para sincronização de promoção.');
  }
  if (!militarId) throw new Error('militarId é obrigatório.');

  const payload = construirPayloadSincronizacaoPromocao(historico);
  const antes = {
    posto_graduacao: historico?.militar?.posto_graduacao,
    quadro: historico?.militar?.quadro,
  };

  // eslint-disable-next-line no-console
  console.info('[SANEAMENTO_PROMOCAO_SYNC] Atualizando militar', { militarId, antes, depois: payload });

  await entities.Militar.update(militarId, payload);
  return payload;
}
