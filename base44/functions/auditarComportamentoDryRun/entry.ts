import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ============================================================================
// CONSTANTES E CONFIGURAÇÕES
// ============================================================================

const PRACAS = new Set([
  'Subtenente',
  '1º Sargento',
  '2º Sargento',
  '3º Sargento',
  'Cabo',
  'Soldado',
]);

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
// UTILITÁRIOS (Replicação de src/utils/calcularComportamento.js)
// ============================================================================

function normalizeText(texto = '') {
  return String(texto)
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

function toDate(dateLike) {
  if (!dateLike) return null;
  if (dateLike instanceof Date) return Number.isNaN(dateLike.getTime()) ? null : dateLike;
  const raw = String(dateLike).trim();
  if (!raw) return null;

  // Suporte a DD/MM/YYYY
  const matchBR = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (matchBR) {
    const [, dd, mm, yyyy] = matchBR;
    const date = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  // Suporte a YYYY-MM-DD
  const date = new Date(`${raw.slice(0, 10)}T00:00:00`);
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
  return String(punicao.status_punicao || punicao.status || 'Ativa').trim();
}

function getTipoPunicao(punicao = {}) {
  return String(punicao.tipo_punicao || punicao.tipo || '').trim();
}

function getDataBasePunicao(punicao = {}) {
  return (
    punicao.data_fim_cumprimento ||
    punicao.data_termino ||
    punicao.data_punicao ||
    punicao.data_aplicacao ||
    null
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

  // REGRA CORRIGIDA: sem exigir j4.quantidade > 0
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

function calcularComportamento(punicoes, postoGraduacao, hoje = new Date(), config = {}) {
  if (!isPraca(postoGraduacao)) return null;

  const referencia = toDate(hoje) || new Date();
  const dataInclusao = toDate(config.dataInclusaoMilitar || config.data_inclusao || null);

  const punicoesEntrada = Array.isArray(punicoes) ? punicoes : [];

  const punicoesValidas = punicoesEntrada
    .filter((p) => isPunicaoValida(p, config))
    .map(normalizePunicao)
    .filter((p) => p.data_base)
    .sort((a, b) => new Date(a.data_base).getTime() - new Date(b.data_base).getTime());

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
        total_punicoes_consideradas: punicoesValidas.length,
        ultima_punicao_data: ultimaPunicao?.data_base_iso || null,
        tempo_servico_anos: tempoServicoAnos,
        elegibilidade,
      },
    };
  }

  const resultado = resolveComportamentoPorJanelas(janela_1_ano, janela_2_anos, janela_4_anos, janela_8_anos, elegibilidade);

  return {
    ...resultado,
    detalhes: {
      total_punicoes_consideradas: punicoesValidas.length,
      ultima_punicao_data: ultimaPunicao?.data_base_iso || null,
      tempo_servico_anos: tempoServicoAnos,
      elegibilidade,
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

  const dataInclusao = toDate(config.dataInclusaoMilitar || config.data_inclusao || null);
  if (dataInclusao) {
    [2, 4, 8].forEach(anos => {
        const marco = addDays(addYears(dataInclusao, anos), 1);
        if (marco > referencia) datasCandidadas.push(marco);
    });
  }

  datasCandidadas.sort((a, b) => a.getTime() - b.getTime());

  for (const data of datasCandidadas) {
    const futuro = calcularComportamento(punicoes, postoGraduacao, data, config);
    if (futuro && compararComportamentos(atual.comportamento, futuro.comportamento) > 0) {
      return {
        data: formatDateISO(data),
        comportamento_futuro: futuro.comportamento,
        fundamento: futuro.fundamento,
      };
    }
  }

  return null;
}

// ============================================================================
// PROJEÇÃO DA DATA DE INÍCIO DO COMPORTAMENTO ATUAL
// ============================================================================

function estimarDataInicioComportamentoAtual(punicoes, postoGraduacao, dataInclusaoMilitar, hoje, comportamentoCalculado) {
    const referencia = toDate(hoje) || new Date();
    const dataInclusao = toDate(dataInclusaoMilitar);
    if (!dataInclusao) return null;

    const punicoesValidas = (Array.isArray(punicoes) ? punicoes : [])
        .filter((p) => isPunicaoValida(p))
        .map(normalizePunicao)
        .filter((p) => p.data_base);

    const datasCandidadasSet = new Set();

    // 1. Data de inclusão e marcos de tempo de serviço
    datasCandidadasSet.add(dataInclusao.getTime());
    [2, 4, 8].forEach(anos => {
        const d = addDays(addYears(dataInclusao, anos), 1);
        if (d <= referencia) datasCandidadasSet.add(d.getTime());
    });

    // 2. Datas baseadas em punições
    punicoesValidas.forEach(p => {
        if (p.data_base <= referencia) datasCandidadasSet.add(p.data_base.getTime());
        [1, 2, 4, 8].forEach(anos => {
            const d = addDays(addYears(p.data_base, anos), 1);
            if (d <= referencia) datasCandidadasSet.add(d.getTime());
        });
    });

    // 3. Hoje
    datasCandidadasSet.add(referencia.getTime());

    const datasOrdenadas = Array.from(datasCandidadasSet)
        .map(ts => new Date(ts))
        .sort((a, b) => a.getTime() - b.getTime());

    let dataInicioEstimada = null;
    let fundamentoEstimado = null;

    // Percorre do presente para o passado
    for (let i = datasOrdenadas.length - 1; i >= 0; i--) {
        const dataTeste = datasOrdenadas[i];
        const res = calcularComportamento(punicoes, postoGraduacao, dataTeste, { data_inclusao: dataInclusaoMilitar });

        if (res && res.comportamento === comportamentoCalculado) {
            dataInicioEstimada = dataTeste;
            fundamentoEstimado = res.fundamento;
        } else {
            // Se mudou o comportamento voltando no tempo, a última data que era igual é o início
            break;
        }
    }

    if (!dataInicioEstimada) return null;

    return {
        data: formatDateISO(dataInicioEstimada),
        fundamento: fundamentoEstimado
    };
}

// ============================================================================
// HANDLER DA DENO FUNCTION
// ============================================================================

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // 1) VALIDAÇÃO DE USUÁRIO
    let user = null;
    try {
      user = await base44.auth.me();
    } catch (_e) {
      user = null;
    }
    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // RESTRIÇÃO OBRIGATÓRIA: apenas admin
    if (user.role !== 'admin') {
        return Response.json({ error: 'Acesso negado: Requer privilégios de administrador.' }, { status: 403 });
    }

    // 2) CARREGAMENTO DE DADOS (asServiceRole para auditoria global)
    const [militares, punicoes] = await Promise.all([
      base44.asServiceRole.entities.Militar.list(),
      base44.asServiceRole.entities.PunicaoDisciplinar.list(),
    ]);

    // 3) PROCESSAMENTO
    const hoje = new Date();
    const summary = {
      totalAuditados: militares.length,
      totalElegiveis: 0,
      totalInconsistencias: 0,
      totalDivergencias: 0,
    };

    const agrupamento = {
      "Bom → Ótimo": 0,
      "Bom → Excepcional": 0,
    };

    const divergencias = [];
    const inconsistencias = [];

    // Agrupar punições por militar
    const punicoesPorMilitar = new Map();
    punicoes.forEach((p) => {
      if (!p.militar_id) return;
      if (!punicoesPorMilitar.has(p.militar_id)) {
        punicoesPorMilitar.set(p.militar_id, []);
      }
      punicoesPorMilitar.get(p.militar_id).push(p);
    });

    for (const militar of militares) {
      if (!isPraca(militar.posto_graduacao)) continue;
      summary.totalElegiveis++;

      if (!militar.data_inclusao) {
        summary.totalInconsistencias++;
        inconsistencias.push({
          militar_id: militar.id,
          militar_nome: militar.nome_completo || militar.nome,
          matricula: militar.matricula,
          posto_graduacao: militar.posto_graduacao,
          motivo: 'Data de inclusão não cadastrada',
        });
        continue;
      }

      const mPunicoes = punicoesPorMilitar.get(militar.id) || [];
      const calc = calcularComportamento(mPunicoes, militar.posto_graduacao, hoje, {
        data_inclusao: militar.data_inclusao,
      });

      if (!calc) continue;

      const comportamentoCadastrado = militar.comportamento || 'Bom';
      const comportamentoCalculado = calc.comportamento;

      if (comportamentoCadastrado !== comportamentoCalculado) {
        summary.totalDivergencias++;

        const proximaMelhoria = calcularProximaMelhoria(mPunicoes, militar.posto_graduacao, hoje, {
          data_inclusao: militar.data_inclusao,
        });

        const inicioComportamento = estimarDataInicioComportamentoAtual(mPunicoes, militar.posto_graduacao, militar.data_inclusao, hoje, comportamentoCalculado);

        const div = {
          militar_id: militar.id,
          militar_nome: militar.nome_completo || militar.nome,
          matricula: militar.matricula,
          posto_graduacao: militar.posto_graduacao,
          comportamento_cadastrado: comportamentoCadastrado,
          comportamento_calculado: comportamentoCalculado,
          fundamento: calc.fundamento,
          ultima_punicao_data: calc.detalhes.ultima_punicao_data,
          total_punicoes_consideradas: calc.detalhes.total_punicoes_consideradas,
          tempo_servico_anos: calc.detalhes.tempo_servico_anos,
          elegibilidade: calc.detalhes.elegibilidade,
          data_estimada_mudanca: inicioComportamento?.data || null,
          proxima_melhoria: proximaMelhoria,
        };

        divergencias.push(div);

        const chaveAgrupamento = `${comportamentoCadastrado} → ${comportamentoCalculado}`;
        if (agrupamento[chaveAgrupamento] !== undefined) {
          agrupamento[chaveAgrupamento]++;
        } else {
          agrupamento[chaveAgrupamento] = 1;
        }
      }
    }

    return Response.json({
      dryRun: true,
      generatedAt: hoje.toISOString(),
      confirmacao: "Nenhuma alteração foi realizada na base de dados. Execução somente leitura/dry-run.",
      summary,
      agrupamento,
      divergencias,
      inconsistencias,
    });

  } catch (error) {
    return Response.json({
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
});
