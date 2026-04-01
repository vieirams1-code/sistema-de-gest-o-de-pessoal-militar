/**
 * rpTiposConfig.js
 * Configuração central de tipos do módulo RP (Registro de Publicações).
 * Unifica os antigos módulos Livro e PublicacaoExOfficio em uma única fonte de verdade.
 */
import { getTemplateAtivoPorTipo } from '@/components/rp/templateValidation';

// ─── Constantes de módulo ───────────────────────────────────────────────────
export const MODULO_LIVRO = 'Livro';
export const MODULO_EX_OFFICIO = 'ExOfficio';

// ─── Base de tipos ──────────────────────────────────────────────────────────
export const RP_TIPOS_BASE = [
  // FÉRIAS
  {
    value: 'Saída Férias',
    label: 'Início de Férias',
    grupo: 'Férias',
    modulo: MODULO_LIVRO,
    sexo: null,
    descricao: 'Fluxo operacional de saída de férias.',
    palavrasChave: ['ferias', 'saida', 'inicio'],
    destaque: true,
  },
  {
    value: 'Retorno Férias',
    label: 'Término de Férias',
    grupo: 'Férias',
    modulo: MODULO_LIVRO,
    sexo: null,
    descricao: 'Encerramento do gozo de férias em curso.',
    palavrasChave: ['ferias', 'retorno', 'termino'],
    destaque: false,
  },
  {
    value: 'Interrupção de Férias',
    label: 'Interrupção de Férias',
    grupo: 'Férias',
    modulo: MODULO_LIVRO,
    sexo: null,
    descricao: 'Interrupção formal de férias em andamento.',
    palavrasChave: ['ferias', 'interrupcao'],
    destaque: false,
  },
  {
    value: 'Nova Saída / Retomada',
    label: 'Continuação de Férias',
    grupo: 'Férias',
    modulo: MODULO_LIVRO,
    sexo: null,
    descricao: 'Retomada do gozo após interrupção.',
    palavrasChave: ['ferias', 'nova saida', 'retomada', 'continuacao'],
    destaque: false,
  },

  // LICENÇAS
  {
    value: 'Licença Maternidade',
    label: 'Licença Maternidade',
    grupo: 'Licenças',
    modulo: MODULO_LIVRO,
    sexo: 'Feminino',
    descricao: 'Afastamento por maternidade com período integral previsto.',
    palavrasChave: ['licenca', 'maternidade', 'afastamento'],
    destaque: true,
  },
  {
    value: 'Prorrogação de Licença Maternidade',
    label: 'Prorrogação de Licença Maternidade',
    grupo: 'Licenças',
    modulo: MODULO_LIVRO,
    sexo: 'Feminino',
    descricao: 'Extensão do período de licença maternidade.',
    palavrasChave: ['prorrogacao', 'licenca', 'maternidade'],
    destaque: false,
  },
  {
    value: 'Licença Paternidade',
    label: 'Licença Paternidade',
    grupo: 'Licenças',
    modulo: MODULO_LIVRO,
    sexo: 'Masculino',
    descricao: 'Afastamento por paternidade com duração padrão.',
    palavrasChave: ['licenca', 'paternidade', 'afastamento'],
    destaque: true,
  },

  // AFASTAMENTOS
  {
    value: 'Núpcias',
    label: 'Núpcias',
    grupo: 'Afastamentos',
    modulo: MODULO_LIVRO,
    sexo: null,
    descricao: 'Registro de afastamento por casamento.',
    palavrasChave: ['nupcias', 'casamento'],
    destaque: true,
  },
  {
    value: 'Luto',
    label: 'Luto',
    grupo: 'Afastamentos',
    modulo: MODULO_LIVRO,
    sexo: null,
    descricao: 'Afastamento motivado por falecimento de familiar.',
    palavrasChave: ['luto', 'falecimento', 'obito'],
    destaque: true,
  },
  {
    value: 'Dispensa Recompensa',
    label: 'Dispensa como Recompensa',
    grupo: 'Afastamentos',
    modulo: MODULO_LIVRO,
    sexo: null,
    descricao: 'Dispensa operacional vinculada a recompensa.',
    palavrasChave: ['dispensa', 'recompensa'],
    destaque: false,
  },

  // MOVIMENTAÇÕES
  {
    value: 'Transferência',
    label: 'Transferência',
    grupo: 'Movimentações',
    modulo: MODULO_LIVRO,
    sexo: null,
    descricao: 'Mudança de lotação com publicação de referência.',
    palavrasChave: ['transferencia', 'lotacao', 'movimentacao'],
    destaque: true,
  },
  {
    value: 'Transferência para RR',
    label: 'Transferência para Reserva Remunerada',
    grupo: 'Movimentações',
    modulo: MODULO_LIVRO,
    sexo: null,
    descricao: 'Transferência específica para reserva remunerada.',
    palavrasChave: ['transferencia', 'rr', 'reserva'],
    destaque: false,
  },
  {
    value: 'Cedência',
    label: 'Cedência',
    grupo: 'Movimentações',
    modulo: MODULO_LIVRO,
    sexo: null,
    descricao: 'Movimentação temporária com origem e destino.',
    palavrasChave: ['cedencia', 'movimentacao'],
    destaque: false,
  },
  {
    value: 'Trânsito',
    label: 'Trânsito',
    grupo: 'Movimentações',
    modulo: MODULO_LIVRO,
    sexo: null,
    descricao: 'Período de trânsito entre origem e destino.',
    palavrasChave: ['transito', 'movimentacao'],
    destaque: false,
  },
  {
    value: 'Instalação',
    label: 'Instalação',
    grupo: 'Movimentações',
    modulo: MODULO_LIVRO,
    sexo: null,
    descricao: 'Período de instalação vinculado à movimentação.',
    palavrasChave: ['instalacao', 'movimentacao'],
    destaque: false,
  },

  // OPERACIONAL
  {
    value: 'Deslocamento Missão',
    label: 'Deslocamento para Missões',
    grupo: 'Operacional',
    modulo: MODULO_LIVRO,
    sexo: null,
    descricao: 'Registro de deslocamento operacional com retorno previsto.',
    palavrasChave: ['deslocamento', 'missao', 'operacional'],
    destaque: true,
  },
  {
    value: 'Curso/Estágio',
    label: 'Cursos / Estágios / Capacitações',
    grupo: 'Operacional',
    modulo: MODULO_LIVRO,
    sexo: null,
    descricao: 'Participação em curso, estágio ou capacitação.',
    palavrasChave: ['curso', 'estagio', 'capacitacao'],
    destaque: true,
  },

  // DISCIPLINAR
  {
    value: 'Punição',
    label: 'Punição',
    grupo: 'Disciplinar',
    modulo: MODULO_EX_OFFICIO,
    sexo: null,
    descricao: 'Aplicação de sanção disciplinar com portaria.',
    palavrasChave: ['punicao', 'sancao', 'disciplinar'],
    destaque: true,
  },
  {
    value: 'Melhoria de Comportamento',
    label: 'Melhoria de Comportamento',
    grupo: 'Disciplinar',
    modulo: MODULO_EX_OFFICIO,
    sexo: null,
    descricao: 'Registro de melhoria no conceito comportamental.',
    palavrasChave: ['melhoria', 'comportamento', 'conceito'],
    destaque: false,
  },
  {
    value: 'ELEVACAO_COMPORTAMENTO_DISCIPLINAR',
    label: 'Elevação de Comportamento Disciplinar',
    grupo: 'Disciplinar',
    modulo: MODULO_EX_OFFICIO,
    sexo: null,
    descricao: 'Texto de RP para elevação/melhoria de comportamento disciplinar.',
    palavrasChave: ['elevacao', 'melhoria', 'comportamento', 'disciplinar'],
    destaque: false,
  },

  // RECONHECIMENTO
  {
    value: 'Elogio Individual',
    label: 'Elogio Individual',
    grupo: 'Reconhecimento',
    modulo: MODULO_EX_OFFICIO,
    sexo: null,
    descricao: 'Registro de elogio individual em BG.',
    palavrasChave: ['elogio', 'reconhecimento'],
    destaque: true,
  },

  // FUNÇÃO
  {
    value: 'Designação de Função',
    label: 'Designação de Função',
    grupo: 'Função',
    modulo: MODULO_EX_OFFICIO,
    sexo: null,
    descricao: 'Assunção formal de função.',
    palavrasChave: ['designacao', 'funcao'],
    destaque: false,
  },
  {
    value: 'Dispensa de Função',
    label: 'Dispensa de Função',
    grupo: 'Função',
    modulo: MODULO_EX_OFFICIO,
    sexo: null,
    descricao: 'Desligamento formal da função.',
    palavrasChave: ['dispensa', 'funcao'],
    destaque: false,
  },

  // JURÍDICO
  {
    value: 'Ata JISO',
    label: 'Ata JISO',
    grupo: 'Jurídico',
    modulo: MODULO_EX_OFFICIO,
    sexo: null,
    descricao: 'Publicação de ata da Junta de Inspeção de Saúde.',
    palavrasChave: ['ata', 'jiso', 'junta', 'saude'],
    destaque: false,
  },
  {
    value: 'Homologação de Atestado',
    label: 'Homologação de Atestado',
    grupo: 'Jurídico',
    modulo: MODULO_EX_OFFICIO,
    sexo: null,
    descricao: 'Homologação de atestado médico pelo comandante.',
    palavrasChave: ['homologacao', 'atestado', 'medico'],
    destaque: false,
  },

  // ADMINISTRATIVO
  {
    value: 'Transcrição de Documentos',
    label: 'Transcrição de Documentos',
    grupo: 'Administrativo',
    modulo: MODULO_EX_OFFICIO,
    sexo: null,
    descricao: 'Transcrição formal de documentos no BG.',
    palavrasChave: ['transcricao', 'documento', 'administrativo'],
    destaque: false,
  },
  {
    value: 'Apostila',
    label: 'Apostila',
    grupo: 'Administrativo',
    modulo: MODULO_EX_OFFICIO,
    sexo: null,
    descricao: 'Correção de publicação anterior via apostilamento.',
    palavrasChave: ['apostila', 'correcao', 'retificacao'],
    destaque: false,
  },
  {
    value: 'Tornar sem Efeito',
    label: 'Tornar sem Efeito',
    grupo: 'Administrativo',
    modulo: MODULO_EX_OFFICIO,
    sexo: null,
    descricao: 'Anulação de publicação anterior.',
    palavrasChave: ['tornar sem efeito', 'anulacao', 'cancelamento'],
    destaque: false,
  },
  {
    value: 'Geral',
    label: 'Geral',
    grupo: 'Administrativo',
    modulo: MODULO_EX_OFFICIO,
    sexo: null,
    descricao: 'Publicação de texto livre sem template obrigatório.',
    palavrasChave: ['geral', 'livre', 'avulso'],
    destaque: false,
  },
];

// ─── Labels com alias (ex: Saída Férias → Início de Férias) ─────────────────
export const RP_TIPO_LABELS = {
  'Saída Férias': 'Início de Férias',
  'Retorno Férias': 'Término de Férias',
  'Interrupção de Férias': 'Interrupção de Férias',
  'Nova Saída / Retomada': 'Continuação de Férias',
  'ELEVACAO_COMPORTAMENTO_DISCIPLINAR': 'Elevação de Comportamento Disciplinar',
  'MARCO_INICIAL_COMPORTAMENTO_DISCIPLINAR': 'Marco Inicial de Comportamento Disciplinar',
  'saida_ferias': 'Início de Férias',
  'retorno_ferias': 'Término de Férias',
  'interrupcao_de_ferias': 'Interrupção de Férias',
  'nova_saida_retomada': 'Continuação de Férias',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function normalizeSexo(sexo) {
  const n = normalizeText(sexo);
  if (n.startsWith('fem')) return 'Feminino';
  if (n.startsWith('mas')) return 'Masculino';
  return null;
}

function cloneMeta(tipo = {}) {
  return {
    value: tipo.value || tipo.nome || '',
    label: tipo.label || tipo.nome || tipo.value || 'Registro',
    grupo: tipo.grupo || 'Outros',
    modulo: tipo.modulo || MODULO_EX_OFFICIO,
    sexo: tipo.sexo ?? null,
    descricao: tipo.descricao || '',
    palavrasChave: Array.isArray(tipo.palavrasChave) ? tipo.palavrasChave : [],
    destaque: Boolean(tipo.destaque),
    origem: tipo.origem || 'base',
    legacy: Boolean(tipo.legacy),
  };
}

function mergeTipoMaps(map, entry) {
  const meta = cloneMeta(entry);
  if (!meta.value) return;
  const existing = map.get(meta.value);
  if (!existing) { map.set(meta.value, meta); return; }
  map.set(meta.value, {
    ...existing,
    ...meta,
    label: existing.label || meta.label,
    descricao: existing.descricao || meta.descricao,
    palavrasChave: Array.from(new Set([...(existing.palavrasChave || []), ...(meta.palavrasChave || [])])),
    destaque: existing.destaque || meta.destaque,
    grupo: existing.grupo && existing.grupo !== 'Outros' ? existing.grupo : meta.grupo,
  });
}

/**
 * Retorna o módulo (Livro | ExOfficio) de um tipo pelo value.
 * Tipos customizados usam o campo modulo cadastrado.
 */
export function getModuloByTipo(tipoValue, tiposCustom = []) {
  const custom = tiposCustom.find((t) => t.nome === tipoValue);
  if (custom) return custom.modulo === 'Livro' ? MODULO_LIVRO : MODULO_EX_OFFICIO;
  const base = RP_TIPOS_BASE.find((t) => t.value === tipoValue);
  return base?.modulo ?? MODULO_EX_OFFICIO;
}

/**
 * Retorna o label amigável de um tipo pelo value.
 */
export function getRPTipoLabel(tipoValue) {
  if (!tipoValue) return 'Registro';
  return RP_TIPO_LABELS[tipoValue] || tipoValue;
}

/**
 * Retorna a lista de tipos filtrada por sexo, tipos customizados e templates ativos.
 * Equivale ao getTiposLivroFiltrados do módulo antigo, agora unificado.
 */
export function getTiposRPFiltrados({
  sexo,
  tiposCustom = [],
  templatesAtivos = [],
  tipoAtualEdicao = null,
} = {}) {
  const map = new Map();

  // 1. Base
  RP_TIPOS_BASE.forEach((t) => mergeTipoMaps(map, { ...t, origem: 'base' }));

  // 2. Tipos customizados (ambos os módulos)
  tiposCustom.forEach((t) => {
    if (!t?.nome) return;
    mergeTipoMaps(map, {
      value: t.nome,
      label: t.nome,
      grupo: 'Personalizado',
      modulo: t.modulo === 'Livro' ? MODULO_LIVRO : MODULO_EX_OFFICIO,
      descricao: t.descricao || 'Tipo personalizado.',
      palavrasChave: ['customizado', ...(Array.isArray(t.campos) ? t.campos.map((c) => c.label || c.chave).filter(Boolean) : [])],
      destaque: Boolean(t.destaque),
      origem: 'custom',
    });
  });

  // 3. Templates ativos de ambos os módulos
  templatesAtivos
    .forEach((tmpl) => {
      if (!tmpl?.tipo_registro) return;
      const moduloTemplate = getTemplateAtivoPorTipo(tmpl.tipo_registro, tmpl.modulo, templatesAtivos)?.modulo;
      if (!moduloTemplate) return;
      mergeTipoMaps(map, {
        value: tmpl.tipo_registro,
        label: RP_TIPO_LABELS[tmpl.tipo_registro] || tmpl.tipo_registro,
        grupo: 'Outros',
        modulo: moduloTemplate === 'Livro' ? MODULO_LIVRO : MODULO_EX_OFFICIO,
        descricao: tmpl.nome ? `Template ativo: ${tmpl.nome}` : 'Tipo derivado de template ativo.',
        palavrasChave: ['template', tmpl.nome].filter(Boolean),
        destaque: false,
        origem: 'template',
      });
    });

  // 4. Tipo legado (edição) — sempre incluso
  if (tipoAtualEdicao && !map.has(tipoAtualEdicao)) {
    mergeTipoMaps(map, {
      value: tipoAtualEdicao,
      label: RP_TIPO_LABELS[tipoAtualEdicao] || tipoAtualEdicao,
      grupo: 'Registro Original',
      modulo: getModuloByTipo(tipoAtualEdicao, tiposCustom),
      descricao: 'Tipo preservado do registro original em edição.',
      palavrasChave: ['legado', 'registro original'],
      destaque: false,
      origem: 'legacy',
      legacy: true,
    });
  }

  const sexoNormalizado = normalizeSexo(sexo);

  return Array.from(map.values())
    .filter((t) => {
      if (t.value === tipoAtualEdicao) return true;
      if (!t.sexo || !sexoNormalizado) return true;
      return normalizeSexo(t.sexo) === sexoNormalizado;
    })
    .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
}

/**
 * Agrupa a lista de tipos por grupo.
 */
export function groupTiposRP(tipos = []) {
  return tipos.reduce((acc, tipo) => {
    const g = tipo.grupo || 'Outros';
    if (!acc[g]) acc[g] = [];
    acc[g].push(tipo);
    return acc;
  }, {});
}

/**
 * Verifica se uma string de busca bate com um tipo.
 */
export function matchesTipoRPSearch(tipo, search = '') {
  const q = normalizeText(search).trim();
  if (!q) return true;
  const haystack = [
    tipo?.label, tipo?.value, tipo?.grupo, tipo?.descricao, ...(tipo?.palavrasChave || []),
  ].map(normalizeText).join(' ');
  return haystack.includes(q);
}
