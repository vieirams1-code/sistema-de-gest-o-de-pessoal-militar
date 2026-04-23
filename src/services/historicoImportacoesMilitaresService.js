import { base44 } from '@/api/base44Client';

const ENTITY_NAME = 'ImportacaoMilitares';
const ENTITY_NAME_ALTERACOES = 'ImportacaoAlteracoesLegado';
const ERROR_MILITARES = 'Falha ao acessar histórico de importações. Entidade ImportacaoMilitares não encontrada.';
const ERROR_ALTERACOES = 'Falha ao acessar histórico de importações. Entidade ImportacaoAlteracoesLegado não encontrada.';
let historicoClientOverride = null;

const STATUS_LINHA = {
  APTO: 'APTO',
  APTO_COM_ALERTA: 'APTO_COM_ALERTA',
  REVISAR: 'REVISAR',
  IGNORADO: 'IGNORADO',
  ERRO: 'ERRO',
  DUPLICADO: 'DUPLICADO',
};

const STATUS_LOTE_LABEL = {
  SOMENTE_ANALISE: 'Somente análise',
  PARCIAL: 'Importação parcial',
  CONCLUIDA: 'Importação concluída',
  FALHA: 'Importação com falha',
  CANCELADA: 'Importação cancelada',
  PENDENTE: 'Importação pendente',
};

const STATUS_LOTE_BADGE_CLASS = {
  [STATUS_LOTE_LABEL.CONCLUIDA]: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  [STATUS_LOTE_LABEL.PARCIAL]: 'bg-amber-100 text-amber-800 border-amber-200',
  [STATUS_LOTE_LABEL.FALHA]: 'bg-rose-100 text-rose-800 border-rose-200',
  [STATUS_LOTE_LABEL.CANCELADA]: 'bg-slate-200 text-slate-800 border-slate-300',
  [STATUS_LOTE_LABEL.PENDENTE]: 'bg-blue-100 text-blue-800 border-blue-200',
  [STATUS_LOTE_LABEL.SOMENTE_ANALISE]: 'bg-indigo-100 text-indigo-800 border-indigo-200',
};

const STATUS_BADGE_CLASS = {
  APTO: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  APTO_COM_ALERTA: 'bg-amber-100 text-amber-800 border-amber-200',
  REVISAR: 'bg-orange-100 text-orange-800 border-orange-200',
  IGNORADO: 'bg-slate-100 text-slate-700 border-slate-200',
  ERRO: 'bg-rose-100 text-rose-800 border-rose-200',
  DUPLICADO: 'bg-slate-100 text-slate-700 border-slate-200',
};

function toArray(valor) {
  if (Array.isArray(valor)) return valor;
  if (typeof valor === 'string' && valor.trim()) return [valor.trim()];
  return [];
}

function toNumber(...candidatos) {
  for (const valor of candidatos) {
    const numero = Number(valor);
    if (Number.isFinite(numero)) return numero;
  }
  return 0;
}

function pickFirstString(...candidatos) {
  for (const valor of candidatos) {
    if (typeof valor === 'string' && valor.trim()) return valor.trim();
  }
  return '';
}

function pickMatriculaAtual(...candidatos) {
  return pickFirstString(...candidatos);
}

function safeJsonParse(texto, fallback) {
  if (typeof texto !== 'string' || !texto.trim()) return fallback;
  try {
    return JSON.parse(texto);
  } catch {
    return fallback;
  }
}

function normalizarStatusLinha(status, erros, alertas) {
  const statusBruto = String(status || '').trim().toUpperCase();
  if (statusBruto) {
    if (statusBruto === 'DUPLICADO') return STATUS_LINHA.IGNORADO;
    if (Object.values(STATUS_LINHA).includes(statusBruto)) return statusBruto;
  }

  if (erros.length > 0) return STATUS_LINHA.ERRO;
  if (alertas.length > 0) return STATUS_LINHA.APTO_COM_ALERTA;
  return STATUS_LINHA.APTO;
}

function detectarAjustesAutomaticos(linha) {
  const textos = [
    ...toArray(linha.alertas),
    ...toArray(linha.observacoes),
    ...toArray(linha.observacoes_importacao),
  ].map((item) => String(item || '').toLowerCase());

  const ajustes = [];
  if (textos.some((item) => item.includes('matrícula ajustada') || item.includes('matricula ajustada'))) {
    ajustes.push('Matrícula ajustada automaticamente');
  }
  if (textos.some((item) => item.includes('telefone inválido') || item.includes('telefone invalido'))) {
    ajustes.push('Telefone invalidado por inconsistência');
  }
  if (textos.some((item) => item.includes('ausente') || item.includes('deixado em branco'))) {
    ajustes.push('Dado ausente tratado automaticamente');
  }

  return ajustes;
}

function obterPrincipalMotivo(linha) {
  const erros = toArray(linha.erros);
  const revisar = toArray(linha.pendencias_revisao);
  const alertas = toArray(linha.alertas);

  if (erros.length > 0) return erros[0];
  if (revisar.length > 0) return revisar[0];
  if (alertas.length > 0) return alertas[0];
  return 'Sem pendências';
}

function normalizarLinha(raw, index) {
  const transformado = raw?.transformado || raw?.dados_transformados || raw?.militar_transformado || {};
  const original = raw?.original || raw?.dados_originais || {};
  const alertas = toArray(raw?.alertas || raw?.avisos);
  const erros = toArray(raw?.erros || raw?.falhas);
  const observacoes = toArray(raw?.observacoes || raw?.observacao || raw?.observacoes_importacao);

  const pendenciasRevisao = toArray(raw?.pendencias_revisao || raw?.revisar || raw?.pendencias);

  const importada = Boolean(
    raw?.importada
    || raw?.foi_importada
    || raw?.importado
    || raw?.militar_id
    || raw?.id_criado
  );

  const status = normalizarStatusLinha(raw?.status, erros, alertas);
  const matriculaHistorica = pickFirstString(
    original?.matricula,
    original?.['matrícula'],
    raw?.matricula,
  );
  const matriculaAtual = pickMatriculaAtual(
    transformado?.matricula_atual,
    transformado?.matricula,
    raw?.matricula_atual,
  );

  return {
    id: raw?.id || `linha-${index + 1}`,
    linhaNumero: toNumber(raw?.linhaNumero, raw?.linha_numero, index + 1),
    status,
    nome: pickFirstString(transformado?.nome_completo, original?.nome_completo, original?.nome, raw?.nome),
    matricula: matriculaAtual || matriculaHistorica,
    matricula_atual: matriculaAtual,
    matricula_historica: matriculaHistorica,
    posto: pickFirstString(transformado?.posto_graduacao, original?.posto_graduacao, original?.posto, original?.['posto/graduação']),
    cpf: pickFirstString(transformado?.cpf, original?.cpf),
    telefone: pickFirstString(transformado?.telefone, original?.telefone, original?.celular),
    observacoes,
    importada,
    alertas,
    erros,
    pendencias_revisao: pendenciasRevisao,
    dadosOriginais: original,
    dadosTransformados: transformado,
    ajustesAutomaticos: detectarAjustesAutomaticos({ alertas, observacoes, observacoes_importacao: raw?.observacoes_importacao }),
    principalMotivo: obterPrincipalMotivo({ erros, pendencias_revisao: pendenciasRevisao, alertas }),
  };
}

function obterLinhasDoRelatorio(relatorio) {
  const candidatas = [
    relatorio?.linhas,
    relatorio?.analise?.linhas,
    relatorio?.importacao?.linhas,
    relatorio?.itens,
    relatorio?.rows,
  ];

  const linhas = candidatas.find((item) => Array.isArray(item)) || [];
  return linhas.map(normalizarLinha);
}

function calcularResumoDasLinhas(linhas) {
  const resumo = {
    total_linhas: linhas.length,
    total_aptas: 0,
    total_aptas_com_alerta: 0,
    total_revisar: 0,
    total_ignoradas: 0,
    total_erros: 0,
    total_importadas: 0,
  };

  linhas.forEach((linha) => {
    if (linha.status === STATUS_LINHA.APTO) resumo.total_aptas += 1;
    if (linha.status === STATUS_LINHA.APTO_COM_ALERTA) resumo.total_aptas_com_alerta += 1;
    if (linha.status === STATUS_LINHA.REVISAR) resumo.total_revisar += 1;
    if (linha.status === STATUS_LINHA.IGNORADO || linha.status === STATUS_LINHA.DUPLICADO) resumo.total_ignoradas += 1;
    if (linha.status === STATUS_LINHA.ERRO) resumo.total_erros += 1;
    if (linha.importada) resumo.total_importadas += 1;
  });

  return resumo;
}

function inferirStatusLote({ statusImportacao, totalImportadas, totalLinhas, totalErros }) {
  const status = String(statusImportacao || '').toLowerCase();

  if (status.includes('cancel')) return STATUS_LOTE_LABEL.CANCELADA;
  if (status.includes('importando') || status.includes('pendente') || status.includes('fila')) return STATUS_LOTE_LABEL.PENDENTE;
  if (status.includes('falh')) return STATUS_LOTE_LABEL.FALHA;
  if (status.includes('parcial')) return STATUS_LOTE_LABEL.PARCIAL;
  if (status.includes('importado') && totalImportadas > 0 && totalImportadas >= totalLinhas) return STATUS_LOTE_LABEL.CONCLUIDA;

  if (totalImportadas <= 0) {
    if (totalErros > 0 && status.includes('import')) return STATUS_LOTE_LABEL.FALHA;
    return STATUS_LOTE_LABEL.SOMENTE_ANALISE;
  }

  if (totalImportadas < totalLinhas) return STATUS_LOTE_LABEL.PARCIAL;
  return STATUS_LOTE_LABEL.CONCLUIDA;
}

function normalizarDataLote(item) {
  return item?.data_importacao
    || item?.created_date
    || item?.updated_date
    || item?.createdAt
    || '';
}

function normalizarLote(item) {
  const relatorio = safeJsonParse(item?.relatorio_json, {});
  const linhas = obterLinhasDoRelatorio(relatorio);
  const resumoLinhas = calcularResumoDasLinhas(linhas);

  const totalLinhas = toNumber(item?.total_linhas, item?.totalLinhas, resumoLinhas.total_linhas);
  const totalAptas = toNumber(item?.total_aptas, item?.totalAptas, resumoLinhas.total_aptas);
  const totalAptasComAlerta = toNumber(item?.total_aptas_com_alerta, item?.totalAptasComAlerta, resumoLinhas.total_aptas_com_alerta);
  const totalRevisar = toNumber(item?.total_revisar, item?.totalRevisar, resumoLinhas.total_revisar);
  const totalIgnoradas = toNumber(item?.total_ignoradas, item?.total_duplicadas, item?.totalIgnoradas, resumoLinhas.total_ignoradas);
  const totalErros = toNumber(item?.total_erros, item?.totalErros, resumoLinhas.total_erros);
  const totalImportadas = toNumber(item?.total_importadas, item?.totalImportadas, resumoLinhas.total_importadas);

  const statusImportacao = pickFirstString(item?.status_importacao, item?.statusImportacao, 'Analisado');
  const tipoImportacao = pickFirstString(
    item?.tipo_importacao,
    item?.tipo,
    relatorio?.tipo_importacao,
    relatorio?.tipo,
    item?.origem_historico === ENTITY_NAME_ALTERACOES ? 'Migração de Alterações Legado' : '',
    'Migração de Militares',
  );
  const referenciaLote = pickFirstString(
    item?.referencia_lote,
    relatorio?.referencia_lote,
    relatorio?.lote_referencia,
    relatorio?.arquivo?.lote,
  );

  return {
    id: item?.id,
    origem_historico: item?.origem_historico || ENTITY_NAME,
    dataHora: normalizarDataLote(item),
    nomeArquivo: pickFirstString(item?.nome_arquivo, relatorio?.arquivo?.nome, 'Arquivo sem nome'),
    tipoImportacao,
    referenciaLote,
    importadoPor: pickFirstString(item?.importado_por_nome, item?.importado_por),
    statusImportacao,
    statusGeral: inferirStatusLote({ statusImportacao, totalImportadas, totalLinhas, totalErros }),
    resumo: {
      total_linhas: totalLinhas,
      total_aptas: totalAptas,
      total_aptas_com_alerta: totalAptasComAlerta,
      total_revisar: totalRevisar,
      total_ignoradas: totalIgnoradas,
      total_erros: totalErros,
      total_importadas: totalImportadas,
      total_nao_importadas: toNumber(item?.total_nao_importadas, totalLinhas - totalImportadas),
    },
    linhas,
    observacoes: pickFirstString(item?.observacoes),
    relatorioRaw: { ...relatorio, origem_historico: item?.origem_historico || ENTITY_NAME },
  };
}

function toDateSafe(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isDateInRange(dateText, inicio, fim) {
  const data = toDateSafe(dateText);
  if (!data) return false;

  if (inicio) {
    const inicioDate = toDateSafe(`${inicio}T00:00:00`);
    if (inicioDate && data < inicioDate) return false;
  }

  if (fim) {
    const fimDate = toDateSafe(`${fim}T23:59:59`);
    if (fimDate && data > fimDate) return false;
  }

  return true;
}

export async function listarHistoricoImportacoesMilitares() {
  const client = historicoClientOverride || base44;
  const entityMilitares = client?.entities?.[ENTITY_NAME];
  const entityAlteracoes = client?.entities?.[ENTITY_NAME_ALTERACOES];

  const [resMilitares, resAlteracoes] = await Promise.allSettled([
    entityMilitares?.list ? entityMilitares.list('-created_date', 1000) : Promise.reject(new Error(ERROR_MILITARES)),
    entityAlteracoes?.list ? entityAlteracoes.list('-created_date', 1000) : Promise.reject(new Error(ERROR_ALTERACOES)),
  ]);

  const erros = [resMilitares, resAlteracoes]
    .filter((resultado) => resultado.status === 'rejected')
    .map((resultado) => resultado.reason?.message || 'Erro ao consultar histórico de importações.');
  if (erros.length === 2) {
    throw new Error(erros[0]);
  }
  if (erros.length > 0) {
    console.error('[HistoricoImportacoes] Uma das fontes de histórico não pôde ser carregada.', erros);
  }

  const lotesMilitares = resMilitares.status === 'fulfilled'
    ? (resMilitares.value || []).map((item) => ({ ...item, origem_historico: ENTITY_NAME }))
    : [];
  const lotesAlteracoes = resAlteracoes.status === 'fulfilled'
    ? (resAlteracoes.value || []).map((item) => ({ ...item, origem_historico: ENTITY_NAME_ALTERACOES }))
    : [];

  return [...lotesMilitares, ...lotesAlteracoes]
    .map(normalizarLote)
    .sort((a, b) => new Date(b.dataHora || 0).getTime() - new Date(a.dataHora || 0).getTime());
}

export async function excluirHistoricoImportacaoMilitares(loteId) {
  const client = historicoClientOverride || base44;
  const entity = client?.entities?.[ENTITY_NAME];
  if (!entity?.delete) {
    throw new Error(ERROR_MILITARES);
  }

  return entity.delete(loteId);
}

export async function excluirHistoricoImportacao(lote) {
  const client = historicoClientOverride || base44;
  const entityName = lote?.relatorioRaw?.origem_historico || lote?.origem_historico || ENTITY_NAME;
  const entity = client?.entities?.[entityName];
  if (!entity?.delete) {
    throw new Error(entityName === ENTITY_NAME_ALTERACOES ? ERROR_ALTERACOES : ERROR_MILITARES);
  }
  return entity.delete(lote.id);
}

export function __setHistoricoImportacoesClientForTests(client) {
  historicoClientOverride = client || null;
}

export function filtrarLotesHistorico(lotes, filtros) {
  const termo = String(filtros?.busca || '').trim().toLowerCase();
  const executor = String(filtros?.executor || '').trim().toLowerCase();
  const tipoImportacao = String(filtros?.tipoImportacao || '').trim().toLowerCase();
  const statusGeral = String(filtros?.statusGeral || '').trim();

  return (lotes || []).filter((lote) => {
    if (termo) {
      const haystack = [
        lote.nomeArquivo,
        lote.observacoes,
        lote.referenciaLote,
        lote.statusImportacao,
      ].join(' ').toLowerCase();

      if (!haystack.includes(termo)) return false;
    }

    if (executor && !String(lote.importadoPor || '').toLowerCase().includes(executor)) return false;
    if (tipoImportacao && !String(lote.tipoImportacao || '').toLowerCase().includes(tipoImportacao)) return false;
    if (statusGeral && lote.statusGeral !== statusGeral) return false;
    if ((filtros?.inicio || filtros?.fim) && !isDateInRange(lote.dataHora, filtros?.inicio, filtros?.fim)) return false;

    const pendencias = lote.resumo.total_revisar + lote.resumo.total_erros;

    if (filtros?.comPendencias && pendencias <= 0) return false;
    if (filtros?.comErro && lote.resumo.total_erros <= 0) return false;
    if (filtros?.somenteConcluida && lote.statusGeral !== STATUS_LOTE_LABEL.CONCLUIDA) return false;
    if (filtros?.somenteAnalise && lote.statusGeral !== STATUS_LOTE_LABEL.SOMENTE_ANALISE) return false;
    if (filtros?.comRevisar && lote.resumo.total_revisar <= 0) return false;
    if (filtros?.comLinhasErro && lote.resumo.total_erros <= 0) return false;
    if (filtros?.comAlerta && lote.resumo.total_aptas_com_alerta <= 0) return false;

    return true;
  });
}

export function montarResumoHistorico(lotes) {
  const totalLotes = lotes.length;

  const acumulado = lotes.reduce((acc, lote) => {
    acc.totalLinhas += lote.resumo.total_linhas;
    acc.totalImportadas += lote.resumo.total_importadas;
    acc.totalPendencias += lote.resumo.total_revisar + lote.resumo.total_erros;
    acc.totalAlertas += lote.resumo.total_aptas_com_alerta;
    if (lote.statusGeral === STATUS_LOTE_LABEL.CONCLUIDA) acc.totalConcluidas += 1;
    if (lote.statusGeral === STATUS_LOTE_LABEL.PARCIAL) acc.totalParciais += 1;
    if (lote.statusGeral === STATUS_LOTE_LABEL.FALHA) acc.totalComErro += 1;
    return acc;
  }, {
    totalLinhas: 0,
    totalImportadas: 0,
    totalPendencias: 0,
    totalAlertas: 0,
    totalConcluidas: 0,
    totalParciais: 0,
    totalComErro: 0,
  });

  return {
    totalLotes,
    totalLinhas: acumulado.totalLinhas,
    totalImportadas: acumulado.totalImportadas,
    totalPendencias: acumulado.totalPendencias,
    totalAlertas: acumulado.totalAlertas,
    totalConcluidas: acumulado.totalConcluidas,
    totalParciais: acumulado.totalParciais,
    totalComErro: acumulado.totalComErro,
    ultimoLote: lotes[0] || null,
  };
}

export function obterOpcoesFiltrosHistorico(lotes) {
  const tipos = new Set();
  const status = new Set();

  (lotes || []).forEach((lote) => {
    if (lote?.tipoImportacao) tipos.add(lote.tipoImportacao);
    if (lote?.statusGeral) status.add(lote.statusGeral);
  });

  return {
    tiposImportacao: Array.from(tipos).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    statusDisponiveis: Array.from(status).sort((a, b) => a.localeCompare(b, 'pt-BR')),
  };
}

function escapeCsv(valor) {
  const texto = String(valor ?? '');
  if (texto.includes('"') || texto.includes(',') || texto.includes('\n')) {
    return `"${texto.replace(/"/g, '""')}"`;
  }
  return texto;
}

export function exportarCsvHistoricoHumano(lote) {
  const headers = [
    'status',
    'nome',
    'matricula_atual',
    'matricula_historica',
    'posto',
    'cpf',
    'telefone',
    'principal_motivo',
    'alertas',
    'erros',
    'observacoes',
    'importada',
  ];

  const linhas = (lote?.linhas || []).map((linha) => [
    linha.status,
    linha.nome,
    linha.matricula_atual || linha.matricula || '',
    linha.matricula_historica || '',
    linha.posto,
    linha.cpf,
    linha.telefone,
    linha.principalMotivo,
    linha.alertas.join(' | '),
    linha.erros.join(' | '),
    linha.observacoes.join(' | '),
    linha.importada ? 'Sim' : 'Não',
  ]);

  const csv = [headers, ...linhas].map((colunas) => colunas.map(escapeCsv).join(',')).join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `historico-importacao-militares-${lote?.nomeArquivo || 'lote'}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export { STATUS_LOTE_LABEL, STATUS_BADGE_CLASS, STATUS_LINHA, STATUS_LOTE_BADGE_CLASS };
