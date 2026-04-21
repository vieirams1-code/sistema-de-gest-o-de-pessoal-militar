import { calcularTempoServico } from './tempoServicoService.js';

export const CATEGORIA_TEMPO_SERVICO = 'TEMPO_SERVICO';

export const TIPOS_FIXOS_MEDALHA_TEMPO = [
  {
    codigo: 'TEMPO_10',
    nome: 'Medalha de Tempo de Serviço - 10 anos',
    categoria: CATEGORIA_TEMPO_SERVICO,
    ordem_hierarquica: 10,
    anos_minimos: 10,
    ativo: true,
    ativa: true,
    automatico_na_apuracao: true,
  },
  {
    codigo: 'TEMPO_20',
    nome: 'Medalha de Tempo de Serviço - 20 anos',
    categoria: CATEGORIA_TEMPO_SERVICO,
    ordem_hierarquica: 20,
    anos_minimos: 20,
    ativo: true,
    ativa: true,
    automatico_na_apuracao: true,
  },
  {
    codigo: 'TEMPO_30',
    nome: 'Medalha de Tempo de Serviço - 30 anos',
    categoria: CATEGORIA_TEMPO_SERVICO,
    ordem_hierarquica: 30,
    anos_minimos: 30,
    ativo: true,
    ativa: true,
    automatico_na_apuracao: true,
  },
  {
    codigo: 'TEMPO_40',
    nome: 'Medalha de Tempo de Serviço - 40 anos',
    categoria: CATEGORIA_TEMPO_SERVICO,
    ordem_hierarquica: 40,
    anos_minimos: 40,
    ativo: true,
    ativa: true,
    automatico_na_apuracao: true,
  },
  {
    codigo: 'DOM_PEDRO_II',
    nome: 'Medalha Dom Pedro II',
    categoria: CATEGORIA_TEMPO_SERVICO,
    ordem_hierarquica: 50,
    anos_minimos: null,
    ativo: true,
    ativa: true,
    automatico_na_apuracao: false,
  },
];

const STATUS_MAP = new Map([
  ['INDICADO', 'INDICADA'],
  ['INDICADA', 'INDICADA'],
  ['CONCEDIDO', 'CONCEDIDA'],
  ['CONCEDIDA', 'CONCEDIDA'],
  ['PUBLICADO', 'CONCEDIDA'],
  ['PUBLICADA', 'CONCEDIDA'],
  ['CANCELADO', 'CANCELADA'],
  ['CANCELADA', 'CANCELADA'],
  ['NEGADO', 'CANCELADA'],
]);

const STATUS_CONSIDERADOS_CONCESSAO = new Set(['CONCEDIDA']);

const CODIGOS_TEMPO_AUTOMATICO = ['TEMPO_10', 'TEMPO_20', 'TEMPO_30', 'TEMPO_40'];

function normalizarTexto(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase();
}

export function normalizarStatusMedalha(status) {
  const chave = String(status || '').trim().toUpperCase();
  return STATUS_MAP.get(chave) || chave || null;
}

export function deduplicarTiposMedalha(tipos = []) {
  const unicos = new Map();

  tipos.forEach((tipo) => {
    if (!tipo) return;
    const chaveCodigo = String(tipo.codigo || '').trim().toUpperCase();
    const chaveNome = normalizarTexto(tipo.nome);
    const chave = chaveCodigo ? `COD:${chaveCodigo}` : `NOME:${chaveNome}`;
    if (!chaveNome && !chaveCodigo) return;
    if (!unicos.has(chave)) {
      unicos.set(chave, tipo);
    }
  });

  return Array.from(unicos.values());
}

function mapearCodigoTempoPorTexto(valor) {
  const texto = normalizarTexto(valor);
  if (!texto) return null;

  if (texto.includes('dom pedro ii') || texto.includes('dom pedro 2')) return 'DOM_PEDRO_II';
  if (!texto.includes('tempo') || !texto.includes('servico')) return null;

  if (texto.includes('40')) return 'TEMPO_40';
  if (texto.includes('30')) return 'TEMPO_30';
  if (texto.includes('20')) return 'TEMPO_20';
  if (texto.includes('10')) return 'TEMPO_10';

  return null;
}

export function calcularAnosTempoServico(militar, referencia = new Date()) {
  const tempoServico = calcularTempoServico(militar, referencia);
  return tempoServico.valido ? tempoServico.anos_completos : null;
}

export function obterCodigoFaixaPorAnos(anosServico) {
  if (typeof anosServico !== 'number' || anosServico < 10) return null;
  if (anosServico >= 40) return 'TEMPO_40';
  if (anosServico >= 30) return 'TEMPO_30';
  if (anosServico >= 20) return 'TEMPO_20';
  return 'TEMPO_10';
}

function indexarTipos(tipos = []) {
  const porId = new Map();
  const porCodigo = new Map();
  const porNomeNormalizado = new Map();

  deduplicarTiposMedalha([...TIPOS_FIXOS_MEDALHA_TEMPO, ...tipos]).forEach((tipo) => {
    if (!tipo) return;
    if (tipo.id) porId.set(tipo.id, tipo);
    if (tipo.codigo) porCodigo.set(tipo.codigo, tipo);
    const nomeNormalizado = normalizarTexto(tipo.nome);
    if (nomeNormalizado) porNomeNormalizado.set(nomeNormalizado, tipo);
  });

  return { porId, porCodigo, porNomeNormalizado };
}

function resolverTipoMedalha(registro, tipoIndexado) {
  if (!registro) return null;
  if (registro.tipo_medalha_id && tipoIndexado.porId.has(registro.tipo_medalha_id)) {
    return tipoIndexado.porId.get(registro.tipo_medalha_id);
  }

  if (registro.tipo_medalha_codigo && tipoIndexado.porCodigo.has(registro.tipo_medalha_codigo)) {
    return tipoIndexado.porCodigo.get(registro.tipo_medalha_codigo);
  }

  const nomeNormalizado = normalizarTexto(registro.tipo_medalha_nome);
  if (nomeNormalizado && tipoIndexado.porNomeNormalizado.has(nomeNormalizado)) {
    return tipoIndexado.porNomeNormalizado.get(nomeNormalizado);
  }

  const codigoLegado = mapearCodigoTempoPorTexto(registro.tipo_medalha_nome);
  if (codigoLegado && tipoIndexado.porCodigo.has(codigoLegado)) {
    return tipoIndexado.porCodigo.get(codigoLegado);
  }

  return null;
}

function obterOrdemHierarquicaRegistro(registro, tipoIndexado) {
  const tipo = resolverTipoMedalha(registro, tipoIndexado);
  if (typeof tipo?.ordem_hierarquica === 'number') return tipo.ordem_hierarquica;

  if (typeof registro?.tipo_medalha_ordem === 'number') return registro.tipo_medalha_ordem;
  if (typeof registro?.anos_minimos === 'number') return registro.anos_minimos;

  return -1;
}

function isMedalhaTempoServico(registro, tipoIndexado) {
  const tipo = resolverTipoMedalha(registro, tipoIndexado);
  if (tipo?.categoria === CATEGORIA_TEMPO_SERVICO) return true;

  const codigo = tipo?.codigo || registro?.tipo_medalha_codigo || mapearCodigoTempoPorTexto(registro?.tipo_medalha_nome);
  if (CODIGOS_TEMPO_AUTOMATICO.includes(codigo)) return true;

  return false;
}

function obterMaiorMedalhaTempoRecebida(medalhas, tipoIndexado) {
  const candidatas = medalhas
    .filter((item) => STATUS_CONSIDERADOS_CONCESSAO.has(normalizarStatusMedalha(item.status)))
    .filter((item) => isMedalhaTempoServico(item, tipoIndexado));

  if (!candidatas.length) return null;

  return candidatas.reduce((maior, atual) => (
    obterOrdemHierarquicaRegistro(atual, tipoIndexado) > obterOrdemHierarquicaRegistro(maior, tipoIndexado)
      ? atual
      : maior
  ));
}

export function apurarMedalhaTempoServicoMilitar({ militar, medalhas = [], tiposMedalha = [], referencia = new Date() }) {
  const tipoIndexado = indexarTipos(tiposMedalha);
  const tempoServico = calcularTempoServico(militar, referencia);
  const tempoServicoAnos = tempoServico.valido ? tempoServico.anos_completos : null;
  const faixaAlcancadaCodigo = obterCodigoFaixaPorAnos(tempoServicoAnos);
  const faixaAlcancadaTipo = faixaAlcancadaCodigo ? tipoIndexado.porCodigo.get(faixaAlcancadaCodigo) : null;
  const maiorMedalhaRecebida = obterMaiorMedalhaTempoRecebida(medalhas, tipoIndexado);
  const maiorMedalhaRecebidaOrdem = obterOrdemHierarquicaRegistro(maiorMedalhaRecebida, tipoIndexado);
  const faixaAlcancadaOrdem = faixaAlcancadaTipo?.ordem_hierarquica || -1;

  let situacao = tempoServico.valido ? 'SEM_DIREITO' : 'INCONSISTENTE';
  let medalhaDevidaCodigo = null;

  if (!tempoServico.valido) {
    situacao = 'INCONSISTENTE';
  } else if (faixaAlcancadaCodigo) {
    medalhaDevidaCodigo = faixaAlcancadaCodigo;

    if (!maiorMedalhaRecebida) {
      situacao = 'ELEGIVEL';
    } else if (maiorMedalhaRecebidaOrdem < faixaAlcancadaOrdem) {
      situacao = 'ELEGIVEL';
    } else if (maiorMedalhaRecebidaOrdem === faixaAlcancadaOrdem) {
      situacao = 'JA_CONTEMPLADO';
    } else {
      situacao = 'INCONSISTENTE';
    }
  } else if (maiorMedalhaRecebida) {
    situacao = 'INCONSISTENTE';
  }

  return {
    militar_id: militar?.id || null,
    tempo_servico_anos: tempoServicoAnos,
    faixa_alcancada_codigo: faixaAlcancadaCodigo,
    maior_medalha_recebida_codigo:
      resolverTipoMedalha(maiorMedalhaRecebida, tipoIndexado)?.codigo || maiorMedalhaRecebida?.tipo_medalha_codigo || null,
    medalha_devida_codigo: medalhaDevidaCodigo,
    situacao,
  };
}

export function apurarListaMilitaresTempoServico({ militares = [], medalhas = [], tiposMedalha = [], referencia = new Date() }) {
  const medalhasPorMilitar = medalhas.reduce((acc, medalha) => {
    const militarId = medalha?.militar_id;
    if (!militarId) return acc;
    if (!acc.has(militarId)) acc.set(militarId, []);
    acc.get(militarId).push(medalha);
    return acc;
  }, new Map());

  return militares.map((militar) => ({
    militar,
    ...apurarMedalhaTempoServicoMilitar({
      militar,
      medalhas: medalhasPorMilitar.get(militar.id) || [],
      tiposMedalha,
      referencia,
    }),
  }));
}

export async function garantirCatalogoFixoMedalhaTempo(base44Client) {
  const existentes = await base44Client.entities.TipoMedalha.list('-created_date');
  const codigosExistentes = new Set(existentes.map((item) => item.codigo).filter(Boolean));

  const pendentes = TIPOS_FIXOS_MEDALHA_TEMPO.filter((tipo) => !codigosExistentes.has(tipo.codigo));
  if (!pendentes.length) return { created: 0 };

  await Promise.all(pendentes.map((tipo) => base44Client.entities.TipoMedalha.create(tipo)));
  return { created: pendentes.length };
}
