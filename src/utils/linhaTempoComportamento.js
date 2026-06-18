import {
  calcularComportamento,
  calcularProximaMelhoria,
  toDate,
  formatDateISO,
  addYears,
  addDays,
  normalizePunicao,
  isPunicaoValida,
} from './calcularComportamento.js';

/**
 * Motor de reconstrução histórica do comportamento disciplinar.
 */
export function gerarLinhaTempoComportamento({
  punicoes = [],
  postoGraduacao,
  dataInclusaoMilitar,
  comportamentoCadastrado,
  hoje = new Date(),
  config = {},
}) {
  const dataHoje = toDate(hoje) || new Date();
  const isoHoje = formatDateISO(dataHoje);
  const dataInclusao = toDate(dataInclusaoMilitar || config.data_inclusao);

  // 1. Normalizar punições válidas
  const punicoesValidas = (Array.isArray(punicoes) ? punicoes : [])
    .filter((p) => isPunicaoValida(p, config))
    .map(normalizePunicao)
    .filter((p) => p.data_base)
    .sort((a, b) => a.data_base - b.data_base);

  // 2. Criar datas candidatas
  const datasSet = new Set();

  const addDate = (d) => {
    if (d) datasSet.add(formatDateISO(d));
  };

  addDate(dataInclusao);
  if (dataInclusao) {
    addDate(addDays(addYears(dataInclusao, 2), 1));
    addDate(addDays(addYears(dataInclusao, 4), 1));
    addDate(addDays(addYears(dataInclusao, 8), 1));
  }

  punicoesValidas.forEach((p) => {
    addDate(p.data_base);
    addDate(addDays(addYears(p.data_base, 1), 1));
    addDate(addDays(addYears(p.data_base, 2), 1));
    addDate(addDays(addYears(p.data_base, 4), 1));
    addDate(addDays(addYears(p.data_base, 8), 1));
  });

  addDate(dataHoje);

  // Harmonização com calcularProximaMelhoria
  const proximaMelhoriaCalculada = calcularProximaMelhoria(punicoesValidas, postoGraduacao, dataHoje, {
    ...config,
    dataInclusaoMilitar,
  });
  if (proximaMelhoriaCalculada && proximaMelhoriaCalculada.data) {
    addDate(toDate(proximaMelhoriaCalculada.data));
  }

  const datasCandidatasSorted = Array.from(datasSet)
    .map((d) => toDate(d))
    .sort((a, b) => a - b);

  // 3. Calcular o comportamento em cada data candidata
  const marcos = datasCandidatasSorted.map((data) => {
    const calc = calcularComportamento(punicoesValidas, postoGraduacao, data, {
      ...config,
      dataInclusaoMilitar,
    });
    return {
      data,
      dataISO: formatDateISO(data),
      ...calc,
    };
  });

  // 4. Criar segmentos (Agrupar comportamentos iguais e consecutivos)
  const segmentosPuros = [];
  marcos.forEach((marco) => {
    const lastSeg = segmentosPuros[segmentosPuros.length - 1];
    const behaviorMatches = lastSeg && lastSeg.comportamento === marco.comportamento;
    const inconsistencyMatches = lastSeg && lastSeg.inconsistente_para_calculo === marco.inconsistente_para_calculo;

    if (!lastSeg || !behaviorMatches || !inconsistencyMatches) {
      segmentosPuros.push({
        inicio: marco.dataISO,
        comportamento: marco.comportamento,
        fundamento: marco.fundamento,
        detalhes: marco.detalhes,
        inconsistente_para_calculo: marco.inconsistente_para_calculo,
        inconsistencias: marco.inconsistencias,
      });
    }
  });

  // Definir data fim de cada segmento
  segmentosPuros.forEach((seg, index) => {
    const nextSeg = segmentosPuros[index + 1];
    if (nextSeg) {
      seg.fim = formatDateISO(addDays(toDate(nextSeg.inicio), -1));
    } else {
      // O último segmento vai até o último marco ou hoje, o que for maior
      const ultimoMarcoISO = marcos[marcos.length - 1].dataISO;
      seg.fim = ultimoMarcoISO > isoHoje ? ultimoMarcoISO : isoHoje;
    }
  });

  // 5. Formatar segmentos finais com metadados
  const segmentos = segmentosPuros.map((seg) => {
    const isAtual = isoHoje >= seg.inicio && isoHoje <= seg.fim;
    const isProjetado = seg.inicio > isoHoje;

    return {
      ...seg,
      origem: isProjetado ? 'PROJECAO' : 'HISTORICO',
      punicoesConsideradas: seg.detalhes?.janela_8_anos?.punicoes || [],
      janelas: {
        j1: seg.detalhes?.janela_1_ano,
        j2: seg.detalhes?.janela_2_anos,
        j4: seg.detalhes?.janela_4_anos,
        j8: seg.detalhes?.janela_8_anos,
      },
      isAtual,
      isProjetado,
    };
  });

  const segmentoAtual = segmentos.find((s) => s.isAtual);
  const comportamentoCalculadoHoje = calcularComportamento(punicoesValidas, postoGraduacao, dataHoje, {
    ...config,
    dataInclusaoMilitar,
  });

  const divergente = (
    comportamentoCadastrado
    && comportamentoCalculadoHoje?.comportamento
    && comportamentoCalculadoHoje.comportamento !== comportamentoCadastrado
  );

  // 6. Eventos da linha do tempo
  const eventos = [];
  if (dataInclusao) {
    eventos.push({ data: formatDateISO(dataInclusao), tipo: 'INCLUSAO', descricao: 'Inclusão no serviço ativo' });
  }

  punicoesValidas.forEach((p) => {
    eventos.push({
      data: p.data_base_iso,
      tipo: 'PUNICAO',
      descricao: `${p.tipo_resolvido} (${p.status_resolvido})`,
      punicao_id: p.id,
    });
  });

  segmentos.forEach((seg, index) => {
    if (index > 0) {
      eventos.push({
        data: seg.inicio,
        tipo: 'MUDANCA_COMPORTAMENTO',
        descricao: `Mudança para comportamento ${seg.comportamento}`,
        comportamento: seg.comportamento,
      });
    }
  });

  eventos.push({ data: isoHoje, tipo: 'HOJE', descricao: 'Data de referência atual' });

  if (proximaMelhoriaCalculada) {
    eventos.push({
      data: proximaMelhoriaCalculada.data,
      tipo: 'PROJECAO_FUTURA',
      descricao: `Projeção de melhoria para ${proximaMelhoriaCalculada.comportamento_futuro}`,
      comportamento: proximaMelhoriaCalculada.comportamento_futuro,
    });
  }

  eventos.sort((a, b) => {
    if (a.data !== b.data) return a.data.localeCompare(b.data);
    const ordem = { INCLUSAO: 1, PUNICAO: 2, MUDANCA_COMPORTAMENTO: 3, HOJE: 4, PROJECAO_FUTURA: 5 };
    return (ordem[a.tipo] || 99) - (ordem[b.tipo] || 99);
  });

  // 7. Memória de cálculo
  const memoriaCalculo = marcos.map((m) => ({
    dataReferencia: m.dataISO,
    comportamento: m.comportamento,
    fundamento: m.fundamento,
    janela_1_ano: m.detalhes?.janela_1_ano,
    janela_2_anos: m.detalhes?.janela_2_anos,
    janela_4_anos: m.detalhes?.janela_4_anos,
    janela_8_anos: m.detalhes?.janela_8_anos,
    total_punicoes_consideradas: m.detalhes?.total_punicoes_consideradas,
    ultima_punicao_data: m.detalhes?.ultima_punicao_data,
  }));

  const inconsistencias = comportamentoCalculadoHoje?.inconsistencias || [];

  return {
    comportamentoCalculadoHoje: comportamentoCalculadoHoje?.comportamento,
    comportamentoCadastrado,
    divergente,
    segmentoAtual,
    proximaMelhoria: proximaMelhoriaCalculada,
    eventos,
    segmentos,
    memoriaCalculo,
    inconsistencias,
  };
}
