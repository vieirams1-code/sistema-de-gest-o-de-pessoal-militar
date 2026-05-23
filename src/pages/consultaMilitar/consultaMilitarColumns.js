const toText = (value, fallback = '—') => {
  if (value === null || value === undefined) return fallback;
  const normalized = String(value).trim();
  return normalized || fallback;
};

const toDate = (value, fallback = '—') => {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return toText(value, fallback);
  return date.toLocaleDateString('pt-BR');
};

const getFirst = (obj, keys = []) => {
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return null;
};

export const CONSULTA_MILITAR_COLUNAS_ALLOWLIST = [
  {
    key: 'posto_graduacao',
    label: 'Graduação',
    group: 'Carreira',
    defaultVisible: true,
    futureFilterType: 'multiselect',
    sensitive: false,
    // TODO(governanca): aplicar visibleFor na renderização/exportação por perfil.
    visibleFor: ['admin', 'gestor'],
    accessor: (militar) => toText(militar?.posto_graduacao, 'Sem posto'),
  },
  {
    key: 'nome',
    label: 'Nome/Nome de guerra',
    group: 'Identificação',
    defaultVisible: true,
    futureFilterType: 'text',
    sensitive: false,
    visibleFor: ['admin', 'gestor'],
    accessor: (militar) => toText(militar?.nome_guerra || militar?.nome_completo),
  },
  {
    key: 'nome_completo',
    label: 'Nome completo',
    group: 'Identificação',
    defaultVisible: false,
    futureFilterType: 'text',
    sensitive: false,
    visibleFor: ['admin', 'gestor'],
    accessor: (militar) => toText(militar?.nome_completo),
  },
  {
    key: 'nome_guerra',
    label: 'Nome de guerra',
    group: 'Identificação',
    defaultVisible: false,
    futureFilterType: 'text',
    sensitive: false,
    visibleFor: ['admin', 'gestor'],
    accessor: (militar) => toText(militar?.nome_guerra),
  },
  {
    key: 'matricula',
    label: 'Matrícula',
    group: 'Identificação',
    defaultVisible: true,
    futureFilterType: 'text',
    sensitive: false,
    visibleFor: ['admin', 'gestor'],
    accessor: (militar) => toText(militar?.matricula),
  },
  {
    key: 'quadro',
    label: 'Quadro',
    group: 'Carreira',
    defaultVisible: true,
    futureFilterType: 'multiselect',
    sensitive: false,
    visibleFor: ['admin', 'gestor'],
    accessor: (militar) => toText(militar?.quadro),
  },
  {
    key: 'antiguidade_ordem',
    label: 'Antiguidade/ordem',
    group: 'Carreira',
    defaultVisible: false,
    futureFilterType: 'text',
    sensitive: false,
    visibleFor: ['admin', 'gestor'],
    accessor: (militar) => toText(getFirst(militar, ['ordem_antiguidade', 'antiguidade_ordem', 'antiguidade'])),
  },
  {
    key: 'data_inclusao',
    label: 'Data de inclusão',
    group: 'Carreira',
    defaultVisible: false,
    futureFilterType: 'text',
    sensitive: false,
    visibleFor: ['admin', 'gestor'],
    accessor: (militar) => toDate(getFirst(militar, ['data_inclusao', 'inclusao_data'])),
  },
  {
    key: 'data_promocao_atual',
    label: 'Data da promoção atual',
    group: 'Carreira',
    defaultVisible: false,
    futureFilterType: 'text',
    sensitive: false,
    visibleFor: ['admin', 'gestor'],
    accessor: (militar) => toDate(getFirst(militar, ['data_promocao_atual', 'promocao_atual_data'])),
  },
  {
    key: 'comportamento',
    label: 'Comportamento',
    group: 'Carreira',
    defaultVisible: false,
    futureFilterType: 'multiselect',
    sensitive: false,
    visibleFor: ['admin', 'gestor'],
    accessor: (militar) => toText(militar?.comportamento),
  },
  {
    key: 'lotacao',
    label: 'Lotação',
    group: 'Carreira',
    defaultVisible: true,
    futureFilterType: 'multiselect',
    sensitive: false,
    visibleFor: ['admin', 'gestor'],
    accessor: (militar) => toText(militar?.lotacao_atual, 'Sem lotação'),
  },
  {
    key: 'unidade',
    label: 'Unidade',
    group: 'Lotação',
    defaultVisible: false,
    futureFilterType: 'multiselect',
    sensitive: false,
    visibleFor: ['admin', 'gestor'],
    accessor: (militar) => toText(getFirst(militar, ['unidade', 'unidade_nome'])),
  },
  {
    key: 'subgrupamento',
    label: 'Subgrupamento',
    group: 'Lotação',
    defaultVisible: false,
    futureFilterType: 'multiselect',
    sensitive: false,
    visibleFor: ['admin', 'gestor'],
    accessor: (militar) => toText(getFirst(militar, ['subgrupamento', 'subsetor_nome'])),
  },
  {
    key: 'grupamento',
    label: 'Grupamento',
    group: 'Lotação',
    defaultVisible: false,
    futureFilterType: 'multiselect',
    sensitive: false,
    visibleFor: ['admin', 'gestor'],
    accessor: (militar) => toText(getFirst(militar, ['grupamento', 'setor_nome'])),
  },
  {
    key: 'municipio',
    label: 'Município/Cidade',
    group: 'Lotação',
    defaultVisible: false,
    futureFilterType: 'multiselect',
    sensitive: false,
    visibleFor: ['admin', 'gestor'],
    accessor: (militar) => toText(getFirst(militar, ['municipio', 'cidade'])),
  },
  {
    key: 'setor_subsetor',
    label: 'Setor/Subsetor',
    group: 'Lotação',
    defaultVisible: false,
    futureFilterType: 'text',
    sensitive: false,
    visibleFor: ['admin', 'gestor'],
    accessor: (militar) => toText(getFirst(militar, ['setor_subsetor', 'subsetor', 'setor'])),
  },
  {
    key: 'situacao_militar',
    label: 'Situação',
    group: 'Situação',
    defaultVisible: true,
    futureFilterType: 'multiselect',
    sensitive: false,
    visibleFor: ['admin', 'gestor'],
    accessor: (militar) => toText(militar?.situacao_militar),
  },
  {
    key: 'situacao_condicao_militar',
    label: 'Condição',
    group: 'Situação',
    defaultVisible: true,
    futureFilterType: 'multiselect',
    sensitive: false,
    visibleFor: ['admin', 'gestor'],
    accessor: (militar) => toText(militar?.situacao_condicao_militar),
  },
  {
    key: 'condicao',
    label: 'Condição (registro)',
    group: 'Situação',
    defaultVisible: false,
    futureFilterType: 'multiselect',
    sensitive: false,
    visibleFor: ['admin', 'gestor'],
    accessor: (militar) => toText(militar?.condicao),
  },
  {
    key: 'origem_destino',
    label: 'Origem/Destino',
    group: 'Situação',
    defaultVisible: false,
    futureFilterType: 'text',
    sensitive: false,
    visibleFor: ['admin', 'gestor'],
    accessor: (militar) => toText(getFirst(militar, ['condicao_origem_destino', 'destino', 'origem_destino'])),
  },
  {
    key: 'movimento_condicao',
    label: 'Movimento condição',
    group: 'Situação',
    defaultVisible: false,
    futureFilterType: 'multiselect',
    sensitive: false,
    visibleFor: ['admin', 'gestor'],
    accessor: (militar) => toText(getFirst(militar, ['movimento_condicao', 'condicao_movimento'])),
  },
  {
    key: 'status_cadastro',
    label: 'Status cadastro',
    group: 'Situação',
    defaultVisible: false,
    futureFilterType: 'multiselect',
    sensitive: false,
    visibleFor: ['admin', 'gestor'],
    accessor: (militar) => toText(militar?.status_cadastro, 'Ativo'),
  },
  {
    key: 'tipo_sanguineo',
    label: 'Tipo sanguíneo',
    group: 'Identificação',
    defaultVisible: false,
    futureFilterType: 'multiselect',
    sensitive: true,
    visibleFor: ['admin'],
    accessor: (militar) => toText(militar?.tipo_sanguineo),
  },
  {
    key: 'cpf',
    label: 'CPF',
    group: 'Identificação',
    defaultVisible: false,
    futureFilterType: 'text',
    sensitive: true,
    visibleFor: ['admin'],
    accessor: (militar) => toText(militar?.cpf),
  },
  {
    key: 'rg',
    label: 'RG',
    group: 'Identificação',
    defaultVisible: false,
    futureFilterType: 'text',
    sensitive: true,
    visibleFor: ['admin'],
    accessor: (militar) => toText(militar?.rg),
  },
  {
    key: 'data_nascimento',
    label: 'Data de nascimento',
    group: 'Identificação',
    defaultVisible: false,
    futureFilterType: 'text',
    sensitive: true,
    visibleFor: ['admin'],
    accessor: (militar) => toDate(militar?.data_nascimento),
  },
  {
    key: 'idade',
    label: 'Idade',
    group: 'Identificação',
    defaultVisible: false,
    futureFilterType: 'text',
    sensitive: true,
    visibleFor: ['admin'],
    accessor: (militar) => toText(militar?.idade),
  },
  {
    key: 'sexo',
    label: 'Sexo',
    group: 'Identificação',
    defaultVisible: false,
    futureFilterType: 'multiselect',
    sensitive: true,
    visibleFor: ['admin'],
    accessor: (militar) => toText(militar?.sexo),
  },
  {
    key: 'telefone',
    label: 'Telefone',
    group: 'Contato',
    defaultVisible: false,
    futureFilterType: 'text',
    sensitive: true,
    visibleFor: ['admin'],
    accessor: (militar) => toText(militar?.telefone),
  },
  {
    key: 'email',
    label: 'E-mail',
    group: 'Contato',
    defaultVisible: false,
    futureFilterType: 'text',
    sensitive: true,
    visibleFor: ['admin'],
    accessor: (militar) => toText(militar?.email),
  },
  {
    key: 'endereco',
    label: 'Endereço',
    group: 'Contato',
    defaultVisible: false,
    futureFilterType: 'text',
    sensitive: true,
    visibleFor: ['admin'],
    accessor: (militar) => toText(militar?.endereco),
  },
  {
    key: 'observacoes_administrativas',
    label: 'Observações administrativas',
    group: 'Saúde/Administrativo',
    defaultVisible: false,
    futureFilterType: 'text',
    sensitive: true,
    visibleFor: ['admin'],
    accessor: (militar) => toText(getFirst(militar, ['observacoes_administrativas', 'restricoes_administrativas'])),
  },
];

export const CONSULTA_MILITAR_COLUNAS_GROUP_ORDER = ['Identificação', 'Carreira', 'Lotação', 'Contato', 'Situação', 'Saúde/Administrativo'];
export const CONSULTA_MILITAR_COLUNAS_STORAGE_KEY = 'consulta_militar_visible_columns_v1';

function canSeeSensitiveColumn({ column, userContext }) {
  if (!column?.sensitive) return true;

  if (userContext?.isAdmin) return true;

  const canAccessSensitiveAction = typeof userContext?.canAccessAction === 'function'
    ? userContext.canAccessAction('acesso_dados_sensiveis')
    : false;
  if (canAccessSensitiveAction) return true;

  const visibleFor = Array.isArray(column?.visibleFor) ? column.visibleFor : [];
  if (visibleFor.length === 0) return false;

  const roles = Array.isArray(userContext?.roles) ? userContext.roles.map((role) => String(role || '').toLowerCase()) : [];
  const modoAcesso = String(userContext?.modoAcesso || '').toLowerCase();
  return visibleFor.some((role) => {
    const normalized = String(role || '').toLowerCase();
    return normalized === modoAcesso || roles.includes(normalized);
  });
}

export function getAllowedConsultaMilitarColumns({ userContext } = {}) {
  return CONSULTA_MILITAR_COLUNAS_ALLOWLIST.filter((column) => canSeeSensitiveColumn({ column, userContext }));
}
