import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ============================================================================
// CONSTANTES E REGRAS
// ============================================================================

const PRACAS = new Set(['Subtenente', '1º Sargento', '2º Sargento', '3º Sargento', 'Cabo', 'Soldado']);

const STATUS_EXCLUIDOS = new Set(['ANULADA']);
const STATUS_REABILITADA = 'REABILITADA';

const TIPOS_PUNICAO_VALIDOS = new Set([
  'ADVERTENCIA',
  'ADVERTENCIA VERBAL',
  'REPREENSAO',
  'DETENCAO',
  'PRISAO',
  'PRISAO EM SEPARADO',
]);

const COMPORTAMENTO_ORDEM = ['Mau', 'Insuficiente', 'Bom', 'Ótimo', 'Excepcional'];

const TIPO_PESO_PRISAO = {
  'PRISAO': 1,
  'PRISAO EM SEPARADO': 1,
  'DETENCAO': 0.5,
  'REPREENSAO': 0.25,
  'ADVERTENCIA': 0,
  'ADVERTENCIA VERBAL': 0,
};

// ============================================================================
// UTILITÁRIOS DE DATA E NORMALIZAÇÃO
// ============================================================================

function normalizeText(texto = '') {
  return String(texto)
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

/**
 * Converte diversos formatos de data para objeto Date.
 * Suporta ISO (YYYY-MM-DD) e BR (DD/MM/YYYY).
 */
function toDate(dateLike) {
  if (dateLike === null || dateLike === undefined || dateLike === '') return null;
  if (dateLike instanceof Date) return Number.isNaN(dateLike.getTime()) ? null : dateLike;

  const raw = String(dateLike).trim();
  if (!raw) return null;

  // BR: DD/MM/YYYY
  const matchBR = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (matchBR) {
    const [, dd, mm, yyyy] = matchBR;
    const date = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  // ISO: YYYY-MM-DD
  const matchISO = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (matchISO) {
    const date = new Date(`${raw.slice(0, 10)}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
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
  return String(punicao.status_punicao || punicao.status || 'Ativa').trim();
}

function getTipoPunicao(punicao = {}) {
  return String(punicao.tipo_punicao || punicao.tipo || '').trim();
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
  const tipoNormalizado = normalizeText(tipo);
  const pesoPrisao = TIPO_PESO_PRISAO[tipoNormalizado] ?? 0;
  const dataBase = toDate(getDataBasePunicao(punicao));
  return {
    ...punicao,
    status_resolvido: getStatusPunicao(punicao),
    tipo_resolvido: tipo,
    tipo_normalizado: tipoNormalizado,
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
  const status = normalizeText(getStatusPunicao(punicao));
  const tipo = normalizeText(getTipoPunicao(punicao));
  if (!TIPOS_PUNICAO_VALIDOS.has(tipo)) return false;
  if (STATUS_EXCLUIDOS.has(status)) return false;
  if (!incluirReabilitadas && status === normalizeText(STATUS_REABILITADA)) return false;
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
      em_separado: Boolean(p.prisao_em_separado || p.em_separado || p.agravada_prisao_em_separado),
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
    const tipo = p.tipo_normalizado;
    const dias = Number(p.dias || p.dias_punicao || 0);
    const separado = Boolean(p.prisao_em_separado || p.em_separado || p.agravada_prisao_em_separado);
    return (tipo === 'PRISAO' || tipo === 'PRISAO EM SEPARADO') && separado && dias > 20;
  }) || null;
}

function resolveComportamentoPorJanelas(j1, j2, j4, j8, elegibilidade = {}) {
  const podeSerOtimo = elegibilidade?.otimo ?? true;
  const podeSerExcepcional = elegibilidade?.excepcional ?? true;

  if (j1.prisao_equivalente > 2) {
    return {
      comportamento: 'Mau',
      fundamento: 'Art. 52, alínea e: mais de 2 prisões equivalentes no período de 1 ano.',
    };
  }

  if (j1.prisao_equivalente === 2) {
    return {
      comportamento: 'Insuficiente',
      fundamento: 'Art. 52, alínea d: exatamente 2 prisões equivalentes no período de 1 ano.',
    };
  }

  if (podeSerExcepcional && j8.quantidade === 0) {
    return {
      comportamento: 'Excepcional',
      fundamento: 'Art. 52, alínea a: sem punição válida no período de 8 anos.',
    };
  }

  if (podeSerOtimo && j4.detencao_equivalente <= 1) {
    return {
      comportamento: 'Ótimo',
      fundamento: 'Art. 52, alínea b: até 1 detenção equivalente no período de 4 anos.',
    };
  }

  return {
    comportamento: 'Bom',
    fundamento: 'Art. 51, §2º c/c Art. 52: manutenção em Bom por ausência de hipótese específica superior ou inferior.',
  };
}

// ============================================================================
// INCONSISTÊNCIAS CADASTRAIS (Portado de src/utils/inconsistenciasCadastrais.js)
// ============================================================================

function vazio(valor) {
  if (valor === null || valor === undefined) return true;
  return String(valor).trim() === '';
}

function listarInconsistenciasCadastraisMilitar(militar = {}) {
  if (!militar || typeof militar !== 'object') return [];

  const inconsistencias = [];

  if (vazio(militar.data_inclusao)) {
    inconsistencias.push({
      tipo: 'sem_data_inclusao',
      campo: 'data_inclusao',
      labelCampo: 'data de inclusão',
      impacto: 'Impede cálculo de comportamento por tempo.',
      regraBloqueada: 'comportamento',
    });
  }

  if (vazio(militar.posto_graduacao)) {
    inconsistencias.push({
      tipo: 'sem_posto_graduacao',
      campo: 'posto_graduacao',
      labelCampo: 'posto/graduação',
      impacto: 'Impede enquadramento funcional e regras disciplinares.',
      regraBloqueada: 'enquadramento_funcional',
    });
  }

  return inconsistencias;
}

function obterInconsistenciasCalculoComportamento(militar = {}) {
  return listarInconsistenciasCadastraisMilitar(militar)
    .filter((item) => item.regraBloqueada === 'comportamento' || item.tipo === 'sem_posto_graduacao');
}

// ============================================================================
// CÁLCULO PRINCIPAL (Portado de src/utils/calcularComportamento.js)
// ============================================================================

function calcularComportamento(punicoes, postoGraduacao, hoje = new Date(), config = {}) {
  if (!isPraca(postoGraduacao)) return null;

  const referencia = toDate(hoje) || new Date();
  const dataInclusao = toDate(config.dataInclusaoMilitar || config.data_inclusao || null);
  const inconsistenciasCalculo = obterInconsistenciasCalculoComportamento({
    data_inclusao: config.dataInclusaoMilitar || config.data_inclusao || null,
    posto_graduacao: postoGraduacao,
  });

  if (inconsistenciasCalculo.length > 0) {
    return {
      comportamento: null,
      fundamento: 'Cálculo bloqueado por inconsistência cadastral.',
      inconsistente_para_calculo: true,
      inconsistencias: inconsistenciasCalculo,
      detalhes: {
        bloqueado_por_inconsistencia: true,
        inconsistencias: inconsistenciasCalculo,
      },
    };
  }

  const punicoesEntrada = Array.isArray(punicoes) ? punicoes : [];

  const punicoesValidas = punicoesEntrada
    .filter((p) => isPunicaoValida(p, config))
    .map(normalizePunicao)
    .filter((p) => p.data_base)
    .sort((a, b) => (a.data_base?.getTime() || 0) - (b.data_base?.getTime() || 0));

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

function compararComportamentos(atual, novo) {
  const a = COMPORTAMENTO_ORDEM.indexOf(atual);
  const b = COMPORTAMENTO_ORDEM.indexOf(novo);
  if (a === -1 || b === -1) return 0;
  if (b > a) return 1;
  if (b < a) return -1;
  return 0;
}

function calcularProximaMelhoria(punicoes, postoGraduacao, hoje = new Date(), config = {}) {
  if (!isPraca(postoGraduacao)) return null;

  const referencia = toDate(hoje) || new Date();
  const atual = calcularComportamento(punicoes, postoGraduacao, referencia, config);
  if (!atual) return null;
  if (atual?.inconsistente_para_calculo) return null;

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

  datasCandidadas.sort((a, b) => a.getTime() - b.getTime());

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

// ============================================================================
// MOTOR DE LINHA DO TEMPO (Portado de src/utils/linhaTempoComportamento.js)
// ============================================================================

/**
 * Motor de reconstrução histórica do comportamento disciplinar.
 */
function gerarLinhaTempoComportamento({
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
    .sort((a, b) => (a.data_base?.getTime() || 0) - (b.data_base?.getTime() || 0));

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
    .sort((a, b) => (a?.getTime() || 0) - (b?.getTime() || 0));

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
      const ultimoMarcoISO = marcos[marcos.length - 1]?.dataISO || isoHoje;
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

// ============================================================================
// HANDLER DA DENO FUNCTION
// ============================================================================

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // 1. Validar usuário autenticado
    let user = null;
    try {
      user = await base44.auth.me();
    } catch (_e) {
      user = null;
    }
    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // 2. Restringir a admin nesta etapa
    if (user.role !== 'admin') {
      return Response.json({ error: 'Acesso negado: Requer privilégios de administrador.' }, { status: 403 });
    }

    // 3. Obter parâmetros do payload
    let body = {};
    try {
      body = await req.json();
    } catch (_e) {
      body = {};
    }

    const { militar_id } = body;
    if (!militar_id) {
      return Response.json({ error: 'Parâmetro militar_id é obrigatório.' }, { status: 400 });
    }

    // 4. Buscar o militar
    const [militar] = await base44.asServiceRole.entities.Militar.filter({ id: militar_id });
    if (!militar) {
      return Response.json({ error: 'Militar não encontrado.' }, { status: 404 });
    }

    // 5. Buscar punições disciplinares do militar
    const punicoes = await base44.asServiceRole.entities.PunicaoDisciplinar.filter({ militar_id });

    // 6. Executar gerarLinhaTempoComportamento(...)
    const linhaTempo = gerarLinhaTempoComportamento({
      punicoes,
      postoGraduacao: militar.posto_graduacao,
      dataInclusaoMilitar: militar.data_inclusao,
      comportamentoCadastrado: militar.comportamento || 'Bom',
      hoje: new Date(),
    });

    // 7. Retornar JSON completo do motor histórico
    return Response.json({
      dryRun: true,
      militar: {
        id: militar.id,
        nome: militar.nome_completo || militar.nome,
        matricula: militar.matricula,
        posto_graduacao: militar.posto_graduacao,
        comportamento_cadastrado: militar.comportamento || 'Bom'
      },
      linhaTempo,
      confirmacao: "Nenhuma alteração foi realizada na base de dados. Execução somente leitura/dry-run."
    });

  } catch (error) {
    return Response.json({
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
});
