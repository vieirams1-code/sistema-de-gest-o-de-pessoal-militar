import { calcularTempoServico } from './tempoServicoService.js';
import { selecionarPromocaoAtualEAnteriores } from '../utils/antiguidade/selecionarPromocaoAtual.js';
import { calcularComportamento } from '../utils/calcularComportamento.js';
import { apurarMedalhaTempoServicoMilitar } from './medalhasTempoServicoService.js';

/**
 * Consolida a visão de carreira do militar.
 *
 * @param {Object} params
 * @param {Object} params.militar - Objeto do militar.
 * @param {Array} params.historicoPromocoes - Lista de históricos de promoções.
 * @param {Array} params.medalhas - Lista de medalhas do militar.
 * @param {Array|String} params.comportamento - Lista de punições (para cálculo) ou comportamento atual.
 * @returns {Object} Visão consolidada da carreira.
 */
export function montarConsolidadoCarreira({
  militar = {},
  historicoPromocoes = [],
  medalhas = [],
  comportamento = []
} = {}) {
  const hoje = new Date();

  // 1. Tempo de Serviço
  const tempoServico = calcularTempoServico(militar, hoje);

  // 2. Promoções
  const { promocaoAtual, ativosOrdenados } = selecionarPromocaoAtualEAnteriores({
    historicoPromocoes,
    militar
  });

  // 3. Comportamento
  let comportamentoAtual = null;
  if (Array.isArray(comportamento)) {
    comportamentoAtual = calcularComportamento(comportamento, militar?.posto_graduacao, hoje, {
      data_inclusao: militar?.data_inclusao || militar?.data_ingresso
    });
  } else {
    // Se vier como string ou não vier, tenta usar o que está no militar ou o valor passado
    comportamentoAtual = {
      comportamento: comportamento || militar?.comportamento || 'Bom',
      fundamento: 'Informação proveniente do cadastro ou parâmetro direto.'
    };
  }

  // 4. Próxima Medalha (Tempo de Serviço)
  const apuracaoMedalha = apurarMedalhaTempoServicoMilitar({
    militar,
    medalhas,
    referencia: hoje
  });

  const proximaMedalha = {
    codigo: apuracaoMedalha.medalha_devida_codigo,
    situacao: apuracaoMedalha.situacao,
    anosParaProxima: null // Pode ser expandido se necessário calcular o gap
  };

  // 5. Resumo da Carreira
  const anosCompletos = tempoServico?.anos_completos ?? 0;
  const postoDesc = militar?.posto_graduacao || 'Não informado';
  const comportamentoDesc = comportamentoAtual?.comportamento || 'Não informado';

  const resumoCarreira = {
    texto: `${postoDesc} com ${anosCompletos} anos de serviço. Comportamento ${comportamentoDesc}.`,
    dataUltimaPromocao: promocaoAtual?.data_promocao || null,
    totalPromocoes: (ativosOrdenados || []).length,
    totalMedalhas: (medalhas || []).length
  };

  return {
    tempoServico,
    promocaoAtual,
    historicoPromocoes: ativosOrdenados,
    medalhas,
    comportamentoAtual,
    proximaMedalha,
    resumoCarreira
  };
}
