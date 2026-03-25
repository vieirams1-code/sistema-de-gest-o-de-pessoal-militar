const PRACAS = new Set(['Subtenente', '1º Sargento', '2º Sargento', '3º Sargento', 'Cabo', 'Soldado']);

const STATUS_EXCLUIDOS = new Set(['Anulada']);
const STATUS_REABILITADA = 'Reabilitada';

const COMPORTAMENTO_ORDEM = ['Mau', 'Insuficiente', 'Bom', 'Ótimo', 'Excepcional'];

const TIPO_PESO_PRISAO = {
  'Prisão': 1,
  'Prisao': 1,
  'Detenção': 0.5,
  'Detencao': 0.5,
  'Repreensão': 0.25,
  'Repreensao': 0.25,
  'Advertência': 0,
  'Advertencia': 0,
  'Advertência Verbal': 0,
};

function toDate(dateLike) {
  if (!dateLike) return null;
  if (dateLike instanceof Date) return Number.isNaN(dateLike.getTime()) ? null : dateLike;
  const date = new Date(`${String(dateLike).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateISO(date) {
  if (!date) return null;
  return date.toISOString().slice(0, 10);
}

function addYears(baseDate, years) {
  const date = new Date(baseDate);
  date.setFullYear(date.getFullYear() + years);
  return date;
}

function subtractYears(baseDate, years) {
  return addYears(baseDate, -years);
}

function addDays(baseDate, days) {
  const date = new Date(baseDate);
  date.setDate(date.getDate() + days);
  return date;
}

function getStatusPunicao(punicao = {}) {
  return punicao.status_punicao || punicao.status || 'Ativa';
}

function getTipoPunicao(punicao = {}) {
  return punicao.tipo_punicao || punicao.tipo || '';
}

function getDataBasePunicao(punicao = {}) {
  return (
    punicao.data_fim_cumprimento
    || punicao.data_termino
    || punicao.data_punicao
    || punicao.data_aplicacao
    || null
  );
}

function normalizePunicao(punicao = {}) {
  const tipo = getTipoPunicao(punicao);
  const pesoPrisao = TIPO_PESO_PRISAO[tipo] ?? 0;
  const dataBase = toDate(getDataBasePunicao(punicao));
  return {
    ...punicao,
    status_resolvido: getStatusPunicao(punicao),
    tipo_resolvido: tipo,
    data_base: dataBase,
    data_base_iso: formatDateISO(dataBase),
    prisao_equivalente: pesoPrisao,
    detencao_equivalente: pesoPrisao * 2,
  };
}

function isPraca(postoGraduacao) {
  return PRACAS.has(postoGraduacao);
}

function isPunicaoValida(punicao, { incluirReabilitadas = false } = {}) {
  const status = getStatusPunicao(punicao);
  if (STATUS_EXCLUIDOS.has(status)) return false;
  if (!incluirReabilitadas && status === STATUS_REABILITADA) return false;
  return true;
}

function isInWindow(date, start, end) {
  if (!date || !start || !end) return false;
  return date >= start && date <= end;
}

function summarizeWindowWithStart(punicoesNormalizadas, inicio, fim, anos) {
  const dentroJanela = punicoesNormalizadas.filter((p) => isInWindow(p.data_base, inicio, fim));

  const prisao_equivalente = dentroJanela.reduce((acc, p) => acc + p.prisao_equivalente, 0);
  const detencao_equivalente = dentroJanela.reduce((acc, p) => acc + p.detencao_equivalente, 0);

  return {
    periodo_anos: anos,
    inicio: formatDateISO(inicio),
    fim: formatDateISO(fim),
    quantidade: dentroJanela.length,
    prisao_equivalente,
    detencao_equivalente,
    punicoes: dentroJanela.map((p) => ({
      id: p.id,
      tipo: p.tipo_resolvido,
      status: p.status_resolvido,
      data_fim_cumprimento: p.data_base_iso,
      prisao_equivalente: p.prisao_equivalente,
      detencao_equivalente: p.detencao_equivalente,
      dias: Number(p.dias || p.dias_punicao || 0),
      em_separado: Boolean(p.prisao_em_separado || p.em_separado),
    })),
  };
}

function getServiceYears(dataInclusao, referencia) {
  if (!dataInclusao || !referencia) return 0;
  let anos = referencia.getFullYear() - dataInclusao.getFullYear();
  const mes = referencia.getMonth() - dataInclusao.getMonth();
  if (mes < 0 || (mes === 0 && referencia.getDate() < dataInclusao.getDate())) {
    anos -= 1;
  }
  return Math.max(anos, 0);
}

function temRegraArt53(punicoesNormalizadas, postoGraduacao) {
  if (postoGraduacao !== 'Soldado') return null;

  return punicoesNormalizadas.find((p) => {
    const tipo = p.tipo_resolvido;
    const dias = Number(p.dias || p.dias_punicao || 0);
    const separado = Boolean(p.prisao_em_separado || p.em_separado);
    return (tipo === 'Prisão' || tipo === 'Prisao') && separado && dias > 20;
  }) || null;
}

function resolveComportamentoPorJanelas(j1, j2, j4, j8, elegibilidade = {}) {
  if (j1.prisao_equivalente > 2) {
    return {
      comportamento: 'Mau',
      fundamento: 'Art. 52, alínea e: mais de 2 prisões equivalentes no período de 1 ano.',
    };
  }

  if (j1.quantidade > 0 && j1.prisao_equivalente <= 2) {
    return {
      comportamento: 'Insuficiente',
      fundamento: 'Art. 52, alínea d: até 2 prisões equivalentes no período de 1 ano.',
    };
  }

  if (!elegibilidade.bom) {
    return {
      comportamento: 'Insuficiente',
      fundamento: 'Art. 52, alíneas c-e c/c tempo mínimo: sem 2 anos completos de efetivo serviço, não há classificação em Bom ou superior.',
    };
  }

  if (j2.quantidade > 0 && j2.prisao_equivalente <= 2) {
    return {
      comportamento: 'Bom',
      fundamento: 'Art. 52, alínea c: até 2 prisões equivalentes no período de 2 anos.',
    };
  }

  if (elegibilidade.otimo && j4.quantidade > 0 && j4.detencao_equivalente <= 1) {
    return {
      comportamento: 'Ótimo',
      fundamento: 'Art. 52, alínea b: até 1 detenção equivalente no período de 4 anos.',
    };
  }

  if (elegibilidade.excepcional && j8.quantidade === 0) {
    return {
      comportamento: 'Excepcional',
      fundamento: 'Art. 52, alínea a: sem punição válida no período de 8 anos.',
    };
  }

  return {
    comportamento: 'Bom',
    fundamento: 'Art. 51, §2º c/c Art. 52: manutenção em Bom por ausência de hipótese específica superior ou inferior.',
  };
}

export function calcularComportamento(punicoes, postoGraduacao, hoje = new Date(), config = {}) {
  if (!isPraca(postoGraduacao)) return null;

  const referencia = toDate(hoje) || new Date();
  const dataInclusao = toDate(config.dataInclusaoMilitar || config.data_inclusao || null);
  const punicoesEntrada = Array.isArray(punicoes) ? punicoes : [];

  const punicoesValidas = punicoesEntrada
    .filter((p) => isPunicaoValida(p, config))
    .map(normalizePunicao)
    .filter((p) => p.data_base)
    .sort((a, b) => new Date(a.data_base) - new Date(b.data_base));

  const art53 = temRegraArt53(punicoesValidas, postoGraduacao);

  const construirJanela = (anos) => {
    const inicioLegal = subtractYears(referencia, anos);
    const inicio = dataInclusao && dataInclusao > inicioLegal ? dataInclusao : inicioLegal;
    return summarizeWindowWithStart(punicoesValidas, inicio, referencia, anos);
  };

  const janela_1_ano = construirJanela(1);
  const janela_2_anos = construirJanela(2);
  const janela_4_anos = construirJanela(4);
  const janela_8_anos = construirJanela(8);
  const tempoServicoAnos = getServiceYears(dataInclusao, referencia);
  const elegibilidade = {
    bom: !dataInclusao || tempoServicoAnos >= 2,
    otimo: !dataInclusao || tempoServicoAnos >= 4,
    excepcional: !dataInclusao || tempoServicoAnos >= 8,
  };

  const ultimaPunicao = punicoesValidas.at(-1);

  if (art53) {
    return {
      comportamento: 'Mau',
      fundamento: 'Art. 53: Soldado punido com prisão em separado superior a 20 dias.',
      detalhes: {
        janela_1_ano,
        janela_2_anos,
        janela_4_anos,
        janela_8_anos,
        total_punicoes_consideradas: punicoesValidas.length,
        ultima_punicao_data: ultimaPunicao?.data_base_iso || null,
        regra_critica_art53: {
          aplicada: true,
          punicao_id: art53.id,
          data_fim_cumprimento: art53.data_base_iso,
          dias: Number(art53.dias || art53.dias_punicao || 0),
        },
      },
    };
  }

  const resultado = resolveComportamentoPorJanelas(janela_1_ano, janela_2_anos, janela_4_anos, janela_8_anos, elegibilidade);

  return {
    ...resultado,
    detalhes: {
      janela_1_ano,
      janela_2_anos,
      janela_4_anos,
      janela_8_anos,
      total_punicoes_consideradas: punicoesValidas.length,
      ultima_punicao_data: ultimaPunicao?.data_base_iso || null,
      data_inclusao_militar: formatDateISO(dataInclusao),
      tempo_servico_anos: tempoServicoAnos,
      elegibilidade_classificacao: elegibilidade,
      regra_critica_art53: { aplicada: false },
    },
  };
}

export function compararComportamentos(atual, novo) {
  const a = COMPORTAMENTO_ORDEM.indexOf(atual);
  const b = COMPORTAMENTO_ORDEM.indexOf(novo);
  if (a === -1 || b === -1) return 0;
  if (b > a) return 1;
  if (b < a) return -1;
  return 0;
}

export function calcularProximaMelhoria(punicoes, postoGraduacao, hoje = new Date(), config = {}) {
  if (!isPraca(postoGraduacao)) return null;

  const referencia = toDate(hoje) || new Date();
  const atual = calcularComportamento(punicoes, postoGraduacao, referencia, config);
  if (!atual) return null;

  const punicoesValidas = (Array.isArray(punicoes) ? punicoes : [])
    .filter((p) => isPunicaoValida(p, config))
    .map(normalizePunicao)
    .filter((p) => p.data_base);

  const datasCandidadas = punicoesValidas.flatMap((p) => [
    addDays(addYears(p.data_base, 1), 1),
    addDays(addYears(p.data_base, 2), 1),
    addDays(addYears(p.data_base, 4), 1),
    addDays(addYears(p.data_base, 8), 1),
  ]).filter((d) => d > referencia);

  datasCandidadas.sort((a, b) => a - b);

  for (const data of datasCandidadas) {
    const futuro = calcularComportamento(punicoes, postoGraduacao, data, config);
    if (futuro && compararComportamentos(atual.comportamento, futuro.comportamento) > 0) {
      return {
        data: formatDateISO(data),
        comportamento_atual: atual.comportamento,
        comportamento_futuro: futuro.comportamento,
        fundamento: futuro.fundamento,
      };
    }
  }

  return null;
}

export { PRACAS };
