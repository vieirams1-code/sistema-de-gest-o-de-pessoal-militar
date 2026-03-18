const DEFAULT_GROUP = 'Outros';
const ORIGINAL_GROUP = 'Registro Original';

export const LIVRO_TIPOS_BASE = [
  { value: 'Saída Férias', label: 'Férias', grupo: 'Férias', sexo: null, descricao: 'Fluxo operacional de saída, retorno, interrupção ou retomada de férias.', palavrasChave: ['ferias', 'saida', 'retorno', 'interrupcao', 'retomada'], destaque: true },
  { value: 'Retorno Férias', label: 'Retorno de Férias', grupo: 'Férias', sexo: null, descricao: 'Encerramento do gozo de férias em curso.', palavrasChave: ['ferias', 'retorno', 'termino'] },
  { value: 'Interrupção de Férias', label: 'Interrupção de Férias', grupo: 'Férias', sexo: null, descricao: 'Interrupção formal de férias em andamento.', palavrasChave: ['ferias', 'interrupcao'] },
  { value: 'Nova Saída / Retomada', label: 'Nova Saída / Retomada', grupo: 'Férias', sexo: null, descricao: 'Retomada do gozo após interrupção.', palavrasChave: ['ferias', 'nova saida', 'retomada', 'continuacao'] },
  { value: 'Licença Maternidade', label: 'Licença Maternidade', grupo: 'Licenças', sexo: 'Feminino', descricao: 'Afastamento por maternidade com período integral previsto.', palavrasChave: ['licenca', 'maternidade', 'afastamento'], destaque: true },
  { value: 'Prorrogação de Licença Maternidade', label: 'Prorrogação de Licença Maternidade', grupo: 'Licenças', sexo: 'Feminino', descricao: 'Extensão do período de licença maternidade.', palavrasChave: ['prorrogacao', 'licenca', 'maternidade'] },
  { value: 'Licença Paternidade', label: 'Licença Paternidade', grupo: 'Licenças', sexo: 'Masculino', descricao: 'Afastamento por paternidade com duração padrão.', palavrasChave: ['licenca', 'paternidade', 'afastamento'], destaque: true },
  { value: 'Núpcias', label: 'Núpcias', grupo: 'Afastamentos', sexo: null, descricao: 'Registro de afastamento por casamento.', palavrasChave: ['nupcias', 'casamento'], destaque: true },
  { value: 'Luto', label: 'Luto', grupo: 'Afastamentos', sexo: null, descricao: 'Afastamento motivado por falecimento de familiar.', palavrasChave: ['luto', 'falecimento', 'obito'], destaque: true },
  { value: 'Cedência', label: 'Cedência', grupo: 'Movimentações', sexo: null, descricao: 'Movimentação temporária com origem e destino.', palavrasChave: ['cedencia', 'movimentacao', 'origem', 'destino'] },
  { value: 'Transferência', label: 'Transferência', grupo: 'Movimentações', sexo: null, descricao: 'Mudança de lotação com publicação de referência.', palavrasChave: ['transferencia', 'lotacao', 'movimentacao'], destaque: true },
  { value: 'Transferência para RR', label: 'Transferência para Reserva Remunerada', grupo: 'Movimentações', sexo: null, descricao: 'Transferência específica para reserva remunerada.', palavrasChave: ['transferencia', 'rr', 'reserva'] },
  { value: 'Trânsito', label: 'Trânsito', grupo: 'Movimentações', sexo: null, descricao: 'Período de trânsito entre origem e destino.', palavrasChave: ['transito', 'movimentacao'] },
  { value: 'Instalação', label: 'Instalação', grupo: 'Movimentações', sexo: null, descricao: 'Período de instalação vinculado à movimentação.', palavrasChave: ['instalacao', 'movimentacao'] },
  { value: 'Dispensa Recompensa', label: 'Dispensa como Recompensa', grupo: 'Afastamentos', sexo: null, descricao: 'Dispensa operacional vinculada a recompensa.', palavrasChave: ['dispensa', 'recompensa'] },
  { value: 'Deslocamento Missão', label: 'Deslocamento para Missões', grupo: 'Operacional', sexo: null, descricao: 'Registro de deslocamento operacional com retorno previsto.', palavrasChave: ['deslocamento', 'missao', 'operacional'], destaque: true },
  { value: 'Curso/Estágio', label: 'Cursos / Estágios / Capacitações', grupo: 'Operacional', sexo: null, descricao: 'Participação em curso, estágio ou capacitação.', palavrasChave: ['curso', 'estagio', 'capacitacao'], destaque: true },
  { value: 'Designação de Função', label: 'Designação de Função', grupo: 'Função', sexo: null, descricao: 'Assunção formal de função.', palavrasChave: ['designacao', 'funcao'] },
  { value: 'Dispensa de Função', label: 'Dispensa de Função', grupo: 'Função', sexo: null, descricao: 'Desligamento formal da função.', palavrasChave: ['dispensa', 'funcao'] },
];

export const LIVRO_TIPO_LABELS = {
  'Saída Férias': 'Saída de Férias',
  'Retorno Férias': 'Retorno de Férias',
  'Interrupção de Férias': 'Interrupção de Férias',
  'Nova Saída / Retomada': 'Nova Saída / Retomada',
};

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function normalizeSexo(sexo) {
  const normalized = normalizeText(sexo);
  if (normalized.startsWith('fem')) return 'Feminino';
  if (normalized.startsWith('mas')) return 'Masculino';
  return null;
}

function cloneMeta(tipo = {}) {
  return {
    value: tipo.value || tipo.nome || tipo.tipo_registro || '',
    label: tipo.label || tipo.nome || tipo.tipo_registro || tipo.value || 'Registro',
    grupo: tipo.grupo || DEFAULT_GROUP,
    sexo: tipo.sexo ?? null,
    descricao: tipo.descricao || tipo.observacoes || '',
    palavrasChave: Array.isArray(tipo.palavrasChave) ? tipo.palavrasChave : [],
    destaque: Boolean(tipo.destaque),
    origem: tipo.origem || 'base',
    legacy: Boolean(tipo.legacy),
  };
}

function mergeTipoMaps(targetMap, entry) {
  const normalized = cloneMeta(entry);
  if (!normalized.value) return;

  const existing = targetMap.get(normalized.value);
  if (!existing) {
    targetMap.set(normalized.value, normalized);
    return;
  }

  targetMap.set(normalized.value, {
    ...existing,
    ...normalized,
    label: existing.label || normalized.label,
    descricao: existing.descricao || normalized.descricao,
    palavrasChave: Array.from(new Set([...(existing.palavrasChave || []), ...(normalized.palavrasChave || [])])),
    destaque: existing.destaque || normalized.destaque,
    grupo: existing.grupo && existing.grupo !== DEFAULT_GROUP ? existing.grupo : normalized.grupo,
    origem: existing.origem || normalized.origem,
    legacy: existing.legacy || normalized.legacy,
  });
}

function shouldIncludeBySexo(tipo, sexo) {
  const sexoNormalizado = normalizeSexo(sexo);
  if (!tipo?.sexo || !sexoNormalizado) return true;
  return normalizeSexo(tipo.sexo) === sexoNormalizado;
}

function createTemplateMeta(template) {
  const tipo = template?.tipo_registro;
  if (!tipo) return null;
  return {
    value: tipo,
    label: LIVRO_TIPO_LABELS[tipo] || tipo,
    grupo: DEFAULT_GROUP,
    descricao: template?.nome ? `Template ativo: ${template.nome}` : 'Tipo derivado de template ativo do módulo Livro.',
    palavrasChave: ['template', template?.nome].filter(Boolean),
    destaque: false,
    origem: 'template',
  };
}

function createCustomMeta(customTipo) {
  if (!customTipo?.nome) return null;
  return {
    value: customTipo.nome,
    label: customTipo.nome,
    grupo: 'Personalizado',
    descricao: customTipo.descricao || 'Tipo personalizado configurado para o módulo Livro.',
    palavrasChave: ['customizado', ...(Array.isArray(customTipo.campos) ? customTipo.campos.map((campo) => campo.label || campo.chave).filter(Boolean) : [])],
    destaque: Boolean(customTipo.destaque),
    origem: 'custom',
  };
}

function createLegacyMeta(tipoAtualEdicao) {
  if (!tipoAtualEdicao) return null;
  return {
    value: tipoAtualEdicao,
    label: LIVRO_TIPO_LABELS[tipoAtualEdicao] || tipoAtualEdicao,
    grupo: ORIGINAL_GROUP,
    descricao: 'Tipo preservado do registro original em edição.',
    palavrasChave: ['legado', 'registro original', 'edicao'],
    destaque: false,
    origem: 'legacy',
    legacy: true,
  };
}

export function getTiposLivroFiltrados({ sexo, tiposCustom = [], templatesAtivos = [], tipoAtualEdicao = null } = {}) {
  const map = new Map();

  LIVRO_TIPOS_BASE.forEach((tipo) => mergeTipoMaps(map, { ...tipo, origem: 'base' }));
  tiposCustom.forEach((tipo) => {
    const meta = createCustomMeta(tipo);
    if (meta) mergeTipoMaps(map, meta);
  });
  templatesAtivos
    .filter((template) => template?.modulo === 'Livro' && template?.ativo !== false)
    .forEach((template) => {
      const meta = createTemplateMeta(template);
      if (meta) mergeTipoMaps(map, meta);
    });

  if (tipoAtualEdicao) {
    const meta = createLegacyMeta(tipoAtualEdicao);
    if (meta) mergeTipoMaps(map, meta);
  }

  return Array.from(map.values())
    .filter((tipo) => shouldIncludeBySexo(tipo, sexo) || tipo.value === tipoAtualEdicao)
    .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
}

export function groupTiposLivro(tipos = []) {
  const grouped = tipos.reduce((acc, tipo) => {
    const grupo = tipo.grupo || DEFAULT_GROUP;
    if (!acc[grupo]) acc[grupo] = [];
    acc[grupo].push(tipo);
    return acc;
  }, {});

  if (!grouped[DEFAULT_GROUP]) grouped[DEFAULT_GROUP] = [];
  return grouped;
}

export function getTipoRegistroLabel(tipoRegistro) {
  if (!tipoRegistro) return 'Registro';
  return LIVRO_TIPO_LABELS[tipoRegistro] || tipoRegistro;
}

export function matchesTipoLivroSearch(tipo, search = '') {
  const normalizedSearch = normalizeText(search).trim();
  if (!normalizedSearch) return true;

  const haystack = [
    tipo?.label,
    tipo?.value,
    tipo?.grupo,
    tipo?.descricao,
    ...(tipo?.palavrasChave || []),
  ]
    .map(normalizeText)
    .join(' ');

  return haystack.includes(normalizedSearch);
}
