/**
 * Camada READ-ONLY de POSTO OPERACIONAL para a Prévia da Listagem de Antiguidade Geral.
 *
 * Princípio obrigatório: NÃO altera Militar.posto_graduacao, o Histórico de
 * Promoções (HistoricoPromocaoMilitarV2) nem o cálculo oficial de antiguidade.
 * Esta camada apenas:
 *   1. deriva um `posto_operacional` de exibição para militares em CFC/CFS ativo
 *      (Aluno a Cabo / Aluno a Sargento);
 *   2. reordena os itens já calculados pela Prévia por PRECEDÊNCIA OPERACIONAL
 *      (maior → menor), inserindo as posições virtuais nos pontos institucionais.
 *
 * A antiguidade oficial gravada e a classificação histórica permanecem intactas:
 * a reordenação só muda a ORDEM DE EXIBIÇÃO; os campos de antiguidade/promoção
 * de cada item não são modificados.
 */

import {
  ALUNO_CABO,
  ALUNO_SARGENTO,
  STATUS_POSTO_VIRTUAL,
  compararPorPostoVirtualDescendente,
} from '../../services/militarStatusVirtual.js';

const ALUNO_LABEL_POR_TIPO = {
  CFC: ALUNO_CABO,
  CFS: ALUNO_SARGENTO,
};

/**
 * Constrói um Map militar_id(string) -> { posto_operacional, tipo_curso,
 * snapshot_antiguidade, ordem_antiguidade_origem } a partir dos participantes
 * de curso ativo. Considera apenas status que mantêm posto virtual.
 * @param {Array} participantesAtivos lista de ParticipanteCursoFormacao já
 *   decorados com `tipo_curso` (CFC/CFS).
 */
export function montarMapaPostoOperacionalPorMilitar(participantesAtivos) {
  const mapa = new Map();
  if (!Array.isArray(participantesAtivos)) return mapa;

  participantesAtivos.forEach((participante) => {
    if (!participante) return;
    if (!STATUS_POSTO_VIRTUAL.includes(participante.status)) return;
    const postoOperacional = ALUNO_LABEL_POR_TIPO[participante.tipo_curso];
    if (!postoOperacional) return;
    const militarId = String(participante.militar_id || '');
    if (!militarId) return;

    mapa.set(militarId, {
      posto_operacional: postoOperacional,
      tipo_curso: participante.tipo_curso,
      snapshot_antiguidade: participante.snapshot_antiguidade ?? null,
      ordem_antiguidade_origem: participante.ordem_antiguidade_origem ?? null,
    });
  });

  return mapa;
}

/**
 * Aplica posto operacional + reordenação operacional aos itens da Prévia Geral.
 * @param {Array} itens itens calculados por calcularPreviaAntiguidadeGeral.
 * @param {Map} mapaPostoOperacional Map militar_id -> dados de curso ativo.
 * @returns {Array} nova lista de itens (não muta a original) com:
 *   - posto_operacional: label de exibição (oficial quando sem curso ativo);
 *   - possui_posto_virtual, tipo_curso_formacao;
 *   - posicao_operacional: 1..N na nova ordem operacional.
 */
export function aplicarPostoOperacionalEReordenar(itens, mapaPostoOperacional) {
  const lista = Array.isArray(itens) ? itens : [];
  const mapa = mapaPostoOperacional instanceof Map ? mapaPostoOperacional : new Map();

  const decorados = lista.map((item, index) => {
    const dadosCurso = mapa.get(String(item?.militar_id || ''));
    const possuiPostoVirtual = Boolean(dadosCurso?.posto_operacional);
    const postoOperacional = possuiPostoVirtual ? dadosCurso.posto_operacional : (item?.posto_graduacao || '');

    return {
      ...item,
      posto_operacional: postoOperacional,
      possui_posto_virtual: possuiPostoVirtual,
      tipo_curso_formacao: dadosCurso?.tipo_curso || null,
      // Antiguidade do curso (desempate entre alunos do mesmo posto operacional).
      // Quando ausente, recai na posição oficial já calculada pela Prévia.
      _snapshotAntiguidadeCurso: dadosCurso?.snapshot_antiguidade ?? null,
      _ordemAntiguidadeCurso: dadosCurso?.ordem_antiguidade_origem ?? null,
      _ordemPreviaOficial: Number.isFinite(item?.posicao) ? item.posicao : index + 1,
    };
  });

  const ordenado = decorados
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      // Precedência operacional (maior → menor), com posições virtuais inseridas.
      const ordemPosto = compararPorPostoVirtualDescendente(
        {
          posto_exibicao: a.item.posto_operacional,
          snapshot_antiguidade: a.item._snapshotAntiguidadeCurso,
          ordem_antiguidade_origem: a.item._ordemAntiguidadeCurso,
        },
        {
          posto_exibicao: b.item.posto_operacional,
          snapshot_antiguidade: b.item._snapshotAntiguidadeCurso,
          ordem_antiguidade_origem: b.item._ordemAntiguidadeCurso,
        },
      );
      if (ordemPosto !== 0) return ordemPosto;

      // Dentro do mesmo posto operacional: preserva a antiguidade oficial já
      // calculada pela Prévia (não recalcula nada).
      if (a.item._ordemPreviaOficial !== b.item._ordemPreviaOficial) {
        return a.item._ordemPreviaOficial - b.item._ordemPreviaOficial;
      }
      return a.index - b.index;
    })
    .map(({ item }, posicaoOperacional) => {
      const { _snapshotAntiguidadeCurso, _ordemAntiguidadeCurso, _ordemPreviaOficial, ...limpo } = item;
      return { ...limpo, posicao_operacional: posicaoOperacional + 1 };
    });

  return ordenado;
}

export default aplicarPostoOperacionalEReordenar;