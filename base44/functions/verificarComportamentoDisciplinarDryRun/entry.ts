/**
 * verificarComportamentoDisciplinarDryRun — Lote 1D-B
 * ----------------------------------------------------------------------------
 * Deno Function ADMIN-ONLY para diagnóstico de comportamento disciplinar.
 *
 * Modo: DRY-RUN. NÃO cria, atualiza ou exclui NENHUMA entidade.
 *
 * Regras críticas (Lote 1D-B):
 *   - Exige autenticação (base44.auth.me).
 *   - Exige admin real (user.role === 'admin'). Usuário comum recebe 403.
 *   - Lê apenas: Militar e PunicaoDisciplinar (via asServiceRole).
 *   - Evita N+1: busca militares uma vez, punições uma vez (ou por militar
 *     quando o payload pede um militar específico) e agrupa em memória.
 *   - Processa apenas praças (Subtenente, 1º/2º/3º Sargento, Cabo, Soldado).
 *   - Aceita payload:
 *       {
 *         "militarId": "opcional",
 *         "incluirReabilitadas": false,
 *         "dataReferencia": "YYYY-MM-DD opcional",
 *         "limit": 300
 *       }
 *   - Retorna relatório com sugestões + flags dryRun e nenhum_dado_alterado.
 *
 * IMPORTANTE: a lógica de cálculo é uma cópia fiel de
 * `src/utils/calcularComportamento.js`. Não dá para importar do frontend
 * porque cada Deno Function é deployada isoladamente.
 *
 * Não chama nem reaproveita `services/justicaDisciplinaService.js` — isso
 * evitaria escrita acidental e mantém o dry-run estritamente leitura.
 * ----------------------------------------------------------------------------
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ============================================================================
// CONSTANTES E LIMITES
// ============================================================================

const LIMIT_DEFAULT = 300;
const LIMIT_MAX = 1000; // teto de segurança absoluto, mesmo se payload pedir mais

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
// UTILITÁRIOS DE NORMALIZAÇÃO E DATA (cópia de utils/calcularComportamento.js)
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

// Lote 1D-C — bloqueio por dado cadastral incompleto.
// Considera data_inclusao válida apenas se for uma data parseável e
// cronologicamente plausível (>= 1900-01-01 e <= hoje + 1 dia).
function isDataInclusaoValida(rawDataInclusao) {
  if (rawDataInclusao === null || rawDataInclusao === undefined || rawDataInclusao === '') {
    return false;
  }
  const d = toDate(rawDataInclusao);
  if (!d) return false;
  const minimo = new Date('1900-01-01T00:00:00');
  const amanha = new Date();
  amanha.setDate(amanha.getDate() + 1);
  if (d < minimo) return false;
  if (d > amanha) return false;
  return true;
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

  if (podeSerOtimo && j4.quantidade > 0 && j4.detencao_equivalente <= 1) {
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
// CÁLCULO PRINCIPAL DE COMPORTAMENTO
// ----------------------------------------------------------------------------
// Versão simplificada de utils/calcularComportamento.js. Não chama
// `obterInconsistenciasCalculoComportamento` (não disponível neste contexto).
// O bloqueio por inconsistência cadastral fica para uma versão futura, quando
// a lógica for migrada para um módulo compartilhável. Aqui só calculamos com
// base nos dados disponíveis.
// ============================================================================

function calcularComportamento(punicoes, postoGraduacao, hoje = new Date(), config = {}) {
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

  const resultado = resolveComportamentoPorJanelas(
    janela_1_ano,
    janela_2_anos,
    janela_4_anos,
    janela_8_anos,
    elegibilidade,
  );

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

// ============================================================================
// VALIDAÇÃO DE PAYLOAD
// ============================================================================

function parsePayload(raw = {}) {
  const out = {
    militarId: null,
    incluirReabilitadas: false,
    dataReferencia: null,
    limit: LIMIT_DEFAULT,
  };

  if (raw.militarId && typeof raw.militarId === 'string') {
    out.militarId = raw.militarId.trim() || null;
  }

  if (raw.incluirReabilitadas === true) {
    out.incluirReabilitadas = true;
  }

  if (raw.dataReferencia && typeof raw.dataReferencia === 'string') {
    const iso = raw.dataReferencia.trim().slice(0, 10);
    // valida formato YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso) && !Number.isNaN(new Date(`${iso}T00:00:00`).getTime())) {
      out.dataReferencia = iso;
    }
  }

  if (Number.isFinite(raw.limit)) {
    const n = Math.floor(raw.limit);
    if (n > 0) out.limit = Math.min(n, LIMIT_MAX);
  }

  return out;
}

// ============================================================================
// HANDLER
// ============================================================================

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // 1) AUTENTICAÇÃO
    let user = null;
    try {
      user = await base44.auth.me();
    } catch (_e) {
      user = null;
    }
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2) ADMIN GUARD — apenas role admin real.
    if (user.role !== 'admin') {
      return Response.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 },
      );
    }

    // 3) PAYLOAD
    let body = {};
    try {
      body = await req.json();
    } catch (_e) {
      body = {};
    }
    const params = parsePayload(body || {});
    const dataReferenciaDate = params.dataReferencia
      ? new Date(`${params.dataReferencia}T00:00:00`)
      : new Date();

    const sugestoes = [];
    const inconsistencias = [];
    const erros = [];
    let totalMilitaresLidos = 0;
    let totalPracasProcessadas = 0;
    let totalMudancasSugeridas = 0;

    // 4) FLUXO POR MILITAR ESPECÍFICO
    if (params.militarId) {
      let militares = [];
      try {
        militares = await base44.asServiceRole.entities.Militar.filter({ id: params.militarId });
      } catch (e) {
        return Response.json(
          {
            error: 'Falha ao ler entidade Militar',
            detalhe: e?.message || String(e),
          },
          { status: 500 },
        );
      }

      const militar = Array.isArray(militares) ? militares[0] : null;
      totalMilitaresLidos = militar ? 1 : 0;

      if (!militar) {
        return Response.json({
          dryRun: true,
          nenhum_dado_alterado: true,
          executado_por: user.email,
          data_execucao: new Date().toISOString(),
          parametros: params,
          total_militares_lidos: 0,
          total_pracas_processadas: 0,
          total_sugestoes: 0,
          total_mudancas_sugeridas: 0,
          total_inconsistencias: 0,
          sugestoes: [],
          inconsistencias: [],
          erros: [{ militar_id: params.militarId, erro: 'militar_nao_encontrado' }],
        });
      }

      if (!isPraca(militar.posto_graduacao)) {
        return Response.json({
          dryRun: true,
          nenhum_dado_alterado: true,
          executado_por: user.email,
          data_execucao: new Date().toISOString(),
          parametros: params,
          total_militares_lidos: 1,
          total_pracas_processadas: 0,
          total_sugestoes: 0,
          total_mudancas_sugeridas: 0,
          total_inconsistencias: 0,
          sugestoes: [],
          inconsistencias: [],
          erros: [{
            militar_id: militar.id,
            erro: `posto_graduacao_nao_e_praca: ${militar.posto_graduacao || 'desconhecido'}`,
          }],
        });
      }

      let punicoes = [];
      try {
        punicoes = await base44.asServiceRole.entities.PunicaoDisciplinar.filter({
          militar_id: militar.id,
        });
      } catch (e) {
        erros.push({ militar_id: militar.id, erro: `falha_punicoes: ${e?.message || e}` });
        punicoes = [];
      }

      const resultado = montarSugestao(militar, punicoes, dataReferenciaDate, params.incluirReabilitadas);
      if (resultado) {
        totalPracasProcessadas = 1;
        if (resultado.tipo === 'sugestao') {
          sugestoes.push(resultado.sugestao);
          if (
            resultado.sugestao.mudou_para_melhor
            || resultado.sugestao.comportamento_calculado !== resultado.sugestao.comportamento_atual
          ) {
            totalMudancasSugeridas = 1;
          }
        } else if (resultado.tipo === 'inconsistencia') {
          inconsistencias.push(resultado.inconsistencia);
        }
      }

      return Response.json({
        dryRun: true,
        nenhum_dado_alterado: true,
        executado_por: user.email,
        data_execucao: new Date().toISOString(),
        parametros: params,
        total_militares_lidos: totalMilitaresLidos,
        total_pracas_processadas: totalPracasProcessadas,
        total_sugestoes: sugestoes.length,
        total_mudancas_sugeridas: totalMudancasSugeridas,
        total_inconsistencias: inconsistencias.length,
        sugestoes,
        inconsistencias,
        erros,
      });
    }

    // 5) FLUXO EM LOTE (sem militarId): busca tudo uma vez, agrupa em memória.
    let todosMilitares = [];
    try {
      todosMilitares = await base44.asServiceRole.entities.Militar.list();
    } catch (e) {
      return Response.json(
        { error: 'Falha ao listar Militar', detalhe: e?.message || String(e) },
        { status: 500 },
      );
    }
    totalMilitaresLidos = Array.isArray(todosMilitares) ? todosMilitares.length : 0;

    const pracas = (Array.isArray(todosMilitares) ? todosMilitares : [])
      .filter((m) => isPraca(m?.posto_graduacao))
      .slice(0, params.limit);

    let todasPunicoes = [];
    try {
      // Uma única chamada list() para evitar N+1.
      todasPunicoes = await base44.asServiceRole.entities.PunicaoDisciplinar.list();
    } catch (e) {
      return Response.json(
        { error: 'Falha ao listar PunicaoDisciplinar', detalhe: e?.message || String(e) },
        { status: 500 },
      );
    }

    // Agrupa punições por militar_id em memória.
    const punicoesPorMilitar = new Map();
    for (const p of (Array.isArray(todasPunicoes) ? todasPunicoes : [])) {
      const mid = p?.militar_id;
      if (!mid) continue;
      if (!punicoesPorMilitar.has(mid)) punicoesPorMilitar.set(mid, []);
      punicoesPorMilitar.get(mid).push(p);
    }

    for (const militar of pracas) {
      try {
        const punicoes = punicoesPorMilitar.get(militar.id) || [];
        const resultado = montarSugestao(militar, punicoes, dataReferenciaDate, params.incluirReabilitadas);
        if (resultado) {
          totalPracasProcessadas += 1;
          if (resultado.tipo === 'sugestao') {
            sugestoes.push(resultado.sugestao);
            if (
              resultado.sugestao.comportamento_calculado
              && resultado.sugestao.comportamento_calculado !== resultado.sugestao.comportamento_atual
            ) {
              totalMudancasSugeridas += 1;
            }
          } else if (resultado.tipo === 'inconsistencia') {
            inconsistencias.push(resultado.inconsistencia);
          }
        }
      } catch (e) {
        erros.push({ militar_id: militar?.id || null, erro: e?.message || String(e) });
      }
    }

    return Response.json({
      dryRun: true,
      nenhum_dado_alterado: true,
      executado_por: user.email,
      data_execucao: new Date().toISOString(),
      parametros: params,
      total_militares_lidos: totalMilitaresLidos,
      total_pracas_processadas: totalPracasProcessadas,
      total_sugestoes: sugestoes.length,
      total_mudancas_sugeridas: totalMudancasSugeridas,
      total_inconsistencias: inconsistencias.length,
      sugestoes,
      inconsistencias,
      erros,
    });
  } catch (error) {
    return Response.json(
      { error: error?.message || 'Erro inesperado', dryRun: true, nenhum_dado_alterado: true },
      { status: 500 },
    );
  }
});

// ----------------------------------------------------------------------------
// Auxiliar: monta o item de sugestão para um militar.
// Retorna null se o cálculo não puder ser feito.
// ----------------------------------------------------------------------------
// Lote 1D-C — agora pode retornar:
//   - { tipo: 'sugestao', sugestao }
//   - { tipo: 'inconsistencia', inconsistencia }
//   - null  (não é praça ou militar inválido)
function montarSugestao(militar, punicoes, dataReferenciaDate, incluirReabilitadas) {
  if (!militar || !militar.id) return null;
  if (!isPraca(militar.posto_graduacao)) return null;

  // BLOQUEIO 1D-C: sem data_inclusao válida não há janela confiável.
  // Não calculamos comportamento e registramos inconsistência.
  if (!isDataInclusaoValida(militar.data_inclusao)) {
    return {
      tipo: 'inconsistencia',
      inconsistencia: {
        militar_id: militar.id,
        militar_nome: militar.nome_completo || '',
        posto_graduacao: militar.posto_graduacao || '',
        motivo: 'DATA_INCLUSAO_AUSENTE_OU_INVALIDA',
        data_inclusao_recebida: militar.data_inclusao ?? null,
      },
    };
  }

  const calculado = calcularComportamento(
    Array.isArray(punicoes) ? punicoes : [],
    militar.posto_graduacao,
    dataReferenciaDate,
    {
      incluirReabilitadas: Boolean(incluirReabilitadas),
      dataInclusaoMilitar: militar.data_inclusao || null,
    },
  );

  if (!calculado || !calculado.comportamento) return null;

  const atual = militar.comportamento || 'Bom';
  const calc = calculado.comportamento;
  const mudouParaMelhor = compararComportamentos(atual, calc) > 0;

  return {
    tipo: 'sugestao',
    sugestao: {
      militar_id: militar.id,
      militar_nome: militar.nome_completo || '',
      posto_graduacao: militar.posto_graduacao || '',
      comportamento_atual: atual,
      comportamento_calculado: calc,
      mudou_para_melhor: mudouParaMelhor,
      fundamento_legal: calculado.fundamento || '',
      detalhes_calculo: calculado.detalhes || {},
    },
  };
}