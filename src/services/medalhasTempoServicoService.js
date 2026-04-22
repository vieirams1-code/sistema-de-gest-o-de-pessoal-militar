import { calcularTempoServico } from './tempoServicoService.js';

export const CATEGORIA_TEMPO_SERVICO = 'TEMPO_SERVICO';
export const CATEGORIA_DOM_PEDRO_II = 'DOM_PEDRO_II';
export const DOM_PEDRO_II_ANOS_MINIMOS_PADRAO = 30;

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
    categoria: CATEGORIA_DOM_PEDRO_II,
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
export const CODIGOS_MEDALHA_TEMPO_SERVICO = [...CODIGOS_TEMPO_AUTOMATICO];
const CODIGO_POR_NOME_LEGADO = new Map(
  TIPOS_FIXOS_MEDALHA_TEMPO.map((tipo) => [normalizarTexto(tipo.nome), tipo.codigo]),
);

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

function normalizarCodigo(valor) {
  return String(valor || '').trim().toUpperCase() || null;
}

function mapearCodigoTempoPorTexto(valor) {
  const texto = normalizarTexto(valor);
  if (!texto) return null;
  const porCatalogoLegado = CODIGO_POR_NOME_LEGADO.get(texto);
  if (porCatalogoLegado) return porCatalogoLegado;

  if (texto.includes('dom pedro ii') || texto.includes('dom pedro 2')) return 'DOM_PEDRO_II';
  if (!texto.includes('tempo') || !texto.includes('servico')) return null;

  if (texto.includes('40')) return 'TEMPO_40';
  if (texto.includes('30')) return 'TEMPO_30';
  if (texto.includes('20')) return 'TEMPO_20';
  if (texto.includes('10')) return 'TEMPO_10';

  return null;
}

export function resolverCodigoTipoMedalha(registroOuTexto) {
  if (!registroOuTexto) return null;
  const valorCodigo = typeof registroOuTexto === 'object'
    ? registroOuTexto.tipo_medalha_codigo || registroOuTexto.codigo
    : registroOuTexto;
  const codigoDireto = normalizarCodigo(valorCodigo);
  const pareceCodigoTecnico = /^[A-Z0-9_]+$/.test(String(codigoDireto || ''));
  if (codigoDireto && pareceCodigoTecnico) return codigoDireto;

  const texto = typeof registroOuTexto === 'object'
    ? registroOuTexto.tipo_medalha_nome || registroOuTexto.nome
    : registroOuTexto;
  return mapearCodigoTempoPorTexto(texto);
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

export function isImpedimentoAtivo(impedimento, referencia = new Date()) {
  if (!impedimento || impedimento.ativo === false) return false;

  const dataRef = new Date(referencia);
  if (Number.isNaN(dataRef.getTime())) return false;

  const dataInicio = impedimento.data_inicio ? new Date(impedimento.data_inicio) : null;
  const dataFim = impedimento.data_fim ? new Date(impedimento.data_fim) : null;

  if (dataInicio && !Number.isNaN(dataInicio.getTime()) && dataRef < dataInicio) return false;
  if (dataFim && !Number.isNaN(dataFim.getTime()) && dataRef > dataFim) return false;
  return true;
}

export function temImpedimentoAplicavel({ impedimentos = [], militarId, medalhaDevidaCodigo, referencia = new Date() }) {
  if (!militarId) return false;

  return impedimentos.some((item) => {
    if (item?.militar_id !== militarId) return false;
    if (!isImpedimentoAtivo(item, referencia)) return false;

    const tipoImpedida = normalizarCodigo(item.tipo_medalha_codigo);
    if (!tipoImpedida && !item.tipo_medalha_id) return true;
    if (tipoImpedida && tipoImpedida === normalizarCodigo(medalhaDevidaCodigo)) return true;
    return false;
  });
}

export function criarIndicacaoAutomatica({ militar, medalhaDevida, tipoMedalha }) {
  if (!militar?.id || !tipoMedalha?.id || !medalhaDevida) {
    throw new Error('Dados insuficientes para criar indicação automática.');
  }

  const hoje = new Date().toISOString().split('T')[0];
  return {
    militar_id: militar.id,
    militar_nome: militar.nome_completo || militar.nome || '',
    militar_posto: militar.posto_graduacao || militar.posto || '',
    militar_matricula: militar.matricula || '',
    tipo_medalha_id: tipoMedalha.id,
    tipo_medalha_nome: tipoMedalha.nome,
    tipo_medalha_codigo: medalhaDevida,
    data_indicacao: hoje,
    status: 'INDICADA',
    origem_registro: 'APURACAO_TEMPO_SERVICO',
    observacoes: 'Indicação automática gerada na apuração de medalhas.',
  };
}

function indexarTipos(tipos = []) {
  const porId = new Map();
  const porCodigo = new Map();
  const porNomeNormalizado = new Map();

  [...TIPOS_FIXOS_MEDALHA_TEMPO, ...tipos].forEach((tipo) => {
    if (tipo?.id) porId.set(tipo.id, tipo);
  });

  [...tipos, ...TIPOS_FIXOS_MEDALHA_TEMPO].forEach((tipo) => {
    if (!tipo) return;
    const codigoNormalizado = normalizarCodigo(tipo.codigo);
    if (codigoNormalizado) {
      const atual = porCodigo.get(codigoNormalizado);
      const proximo = { ...tipo, codigo: codigoNormalizado };
      if (!atual || (!atual.id && proximo.id)) {
        porCodigo.set(codigoNormalizado, proximo);
      }
    }
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

  const codigoRegistro = normalizarCodigo(registro.tipo_medalha_codigo);
  if (codigoRegistro && tipoIndexado.porCodigo.has(codigoRegistro)) {
    return tipoIndexado.porCodigo.get(codigoRegistro);
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

export function obterTipoMedalhaPorCodigo(codigo, tiposMedalha = []) {
  const tipoIndexado = indexarTipos(tiposMedalha);
  const codigoNormalizado = resolverCodigoTipoMedalha(codigo);
  if (!codigoNormalizado) return null;
  return tipoIndexado.porCodigo.get(codigoNormalizado) || null;
}

function deveAtualizarCampo(atual, proximo) {
  return (atual === undefined || atual === null || atual === '') && proximo !== undefined;
}

function gerarPatchTipoMedalha(tipoAtual = {}, tipoFixo = {}) {
  const patch = {};
  if (normalizarCodigo(tipoAtual.codigo) !== normalizarCodigo(tipoFixo.codigo)) patch.codigo = tipoFixo.codigo;
  if (deveAtualizarCampo(tipoAtual.nome, tipoFixo.nome)) patch.nome = tipoFixo.nome;
  if (deveAtualizarCampo(tipoAtual.categoria, tipoFixo.categoria)) patch.categoria = tipoFixo.categoria;
  if (deveAtualizarCampo(tipoAtual.ordem_hierarquica, tipoFixo.ordem_hierarquica)) patch.ordem_hierarquica = tipoFixo.ordem_hierarquica;
  if (deveAtualizarCampo(tipoAtual.anos_minimos, tipoFixo.anos_minimos)) patch.anos_minimos = tipoFixo.anos_minimos;
  if (deveAtualizarCampo(tipoAtual.ativo, tipoFixo.ativo)) patch.ativo = tipoFixo.ativo;
  if (deveAtualizarCampo(tipoAtual.ativa, tipoFixo.ativa)) patch.ativa = tipoFixo.ativa;
  if (deveAtualizarCampo(tipoAtual.automatico_na_apuracao, tipoFixo.automatico_na_apuracao)) {
    patch.automatico_na_apuracao = tipoFixo.automatico_na_apuracao;
  }
  return patch;
}

function localizarTipoExistente(tipoFixo, tipos = []) {
  const codigo = normalizarCodigo(tipoFixo.codigo);
  const nome = normalizarTexto(tipoFixo.nome);

  return tipos.find((item) => (
    normalizarCodigo(item?.codigo) === codigo
    || normalizarTexto(item?.nome) === nome
    || mapearCodigoTempoPorTexto(item?.nome) === codigo
  )) || null;
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

  const codigo = normalizarCodigo(tipo?.codigo || registro?.tipo_medalha_codigo || mapearCodigoTempoPorTexto(registro?.tipo_medalha_nome));
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

export function apurarMedalhaTempoServicoMilitar({
  militar,
  medalhas = [],
  tiposMedalha = [],
  impedimentos = [],
  referencia = new Date(),
}) {
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

  const impedido = medalhaDevidaCodigo && temImpedimentoAplicavel({
    impedimentos,
    militarId: militar?.id,
    medalhaDevidaCodigo,
    referencia,
  });
  if (situacao !== 'INCONSISTENTE' && impedido) {
    situacao = 'IMPEDIDO';
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

export function apurarListaMilitaresTempoServico({
  militares = [],
  medalhas = [],
  tiposMedalha = [],
  impedimentos = [],
  referencia = new Date(),
}) {
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
      impedimentos,
      referencia,
    }),
  }));
}

export function filtrarIndicacoesTempoResetaveis(medalhas = []) {
  return medalhas.filter((registro) => (
    CODIGOS_TEMPO_AUTOMATICO.includes(resolverCodigoTipoMedalha(registro))
    && normalizarStatusMedalha(registro.status) === 'INDICADA'
  ));
}

export function obterEstadoCelulaTempoServico({
  apuracao,
  codigoFaixa,
  registroMedalha,
  impedimentos = [],
  referencia = new Date(),
}) {
  const statusRegistro = normalizarStatusMedalha(registroMedalha?.status);
  if (statusRegistro === 'CONCEDIDA') return 'CONTEMPLADO';
  if (statusRegistro === 'INDICADA') return 'INDICADO';

  const impedido = temImpedimentoAplicavel({
    impedimentos,
    militarId: apuracao?.militar_id,
    medalhaDevidaCodigo: codigoFaixa,
    referencia,
  });
  if (impedido) return 'IMPEDIDO';

  if (apuracao?.medalha_devida_codigo === codigoFaixa && apuracao?.situacao === 'ELEGIVEL') return 'INDICAR';
  if (apuracao?.medalha_devida_codigo === codigoFaixa && apuracao?.situacao === 'JA_CONTEMPLADO') return 'CONTEMPLADO';
  return 'INABILITADO';
}

function obterMaiorMedalhaDomPedroRecebida(medalhas, tipoIndexado) {
  return medalhas.find((item) => (
    STATUS_CONSIDERADOS_CONCESSAO.has(normalizarStatusMedalha(item.status))
    && resolverCodigoTipoMedalha(resolverTipoMedalha(item, tipoIndexado) || item) === 'DOM_PEDRO_II'
  )) || null;
}

export function apurarMedalhaDomPedroIIMilitar({
  militar,
  medalhas = [],
  tiposMedalha = [],
  impedimentos = [],
  referencia = new Date(),
  anosMinimos = DOM_PEDRO_II_ANOS_MINIMOS_PADRAO,
}) {
  const tipoIndexado = indexarTipos(tiposMedalha);
  const tempoServico = calcularTempoServico(militar, referencia);
  const tempoServicoAnos = tempoServico.valido ? tempoServico.anos_completos : null;
  const jaRecebeu = Boolean(obterMaiorMedalhaDomPedroRecebida(medalhas, tipoIndexado));

  let situacao = 'SEM_DIREITO';
  if (!tempoServico.valido) {
    situacao = 'INCONSISTENTE';
  } else if (jaRecebeu) {
    situacao = 'JA_CONTEMPLADO';
  } else if (tempoServicoAnos >= anosMinimos) {
    situacao = 'ELEGIVEL';
  }

  const medalhaDevidaCodigo = (situacao === 'ELEGIVEL' || situacao === 'JA_CONTEMPLADO') ? 'DOM_PEDRO_II' : null;
  const impedido = medalhaDevidaCodigo && temImpedimentoAplicavel({
    impedimentos,
    militarId: militar?.id,
    medalhaDevidaCodigo,
    referencia,
  });
  if (situacao === 'ELEGIVEL' && impedido) {
    situacao = 'IMPEDIDO';
  }

  return {
    militar_id: militar?.id || null,
    tempo_servico_anos: tempoServicoAnos,
    maior_medalha_recebida_codigo: jaRecebeu ? 'DOM_PEDRO_II' : null,
    medalha_devida_codigo: medalhaDevidaCodigo,
    situacao,
  };
}

export function apurarListaMilitaresDomPedroII({
  militares = [],
  medalhas = [],
  tiposMedalha = [],
  impedimentos = [],
  referencia = new Date(),
  anosMinimos = DOM_PEDRO_II_ANOS_MINIMOS_PADRAO,
}) {
  const medalhasPorMilitar = medalhas.reduce((acc, medalha) => {
    const militarId = medalha?.militar_id;
    if (!militarId) return acc;
    if (!acc.has(militarId)) acc.set(militarId, []);
    acc.get(militarId).push(medalha);
    return acc;
  }, new Map());

  return militares.map((militar) => ({
    militar,
    ...apurarMedalhaDomPedroIIMilitar({
      militar,
      medalhas: medalhasPorMilitar.get(militar.id) || [],
      tiposMedalha,
      impedimentos,
      referencia,
      anosMinimos,
    }),
  }));
}

export async function garantirCatalogoFixoMedalhaTempo(base44Client) {
  const existentes = [...(await base44Client.entities.TipoMedalha.list('-created_date'))];
  let created = 0;
  let updated = 0;

  for (const tipoFixo of TIPOS_FIXOS_MEDALHA_TEMPO) {
    const existente = localizarTipoExistente(tipoFixo, existentes);
    if (!existente?.id) {
      const criado = await base44Client.entities.TipoMedalha.create(tipoFixo);
      existentes.push(criado || tipoFixo);
      created += 1;
      continue;
    }

    const patch = gerarPatchTipoMedalha(existente, tipoFixo);
    if (!Object.keys(patch).length) continue;
    await base44Client.entities.TipoMedalha.update(existente.id, patch);
    Object.assign(existente, patch);
    updated += 1;
  }

  return { created, updated };
}

export async function resolverOuGarantirTipoMedalha(base44Client, codigoOuNome, tiposMedalha = []) {
  const codigoResolvido = resolverCodigoTipoMedalha(codigoOuNome);
  if (!codigoResolvido) return null;

  let tipo = obterTipoMedalhaPorCodigo(codigoResolvido, tiposMedalha);
  if (tipo?.id) return tipo;

  await garantirCatalogoFixoMedalhaTempo(base44Client);
  const tiposAtualizados = await base44Client.entities.TipoMedalha.list('nome');
  tipo = obterTipoMedalhaPorCodigo(codigoResolvido, tiposAtualizados);
  return tipo || null;
}
