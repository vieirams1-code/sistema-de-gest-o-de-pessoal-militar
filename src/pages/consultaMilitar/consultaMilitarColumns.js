const toText = (value, fallback = '—') => {
  if (value === null || value === undefined) return fallback;
  const normalized = String(value).trim();
  return normalized || fallback;
};

export const CONSULTA_MILITAR_COLUNAS_ALLOWLIST = [
  {
    key: 'posto_graduacao',
    label: 'Graduação',
    group: 'Carreira',
    defaultVisible: true,
    futureFilterType: 'multiselect',
    accessor: (militar) => toText(militar?.posto_graduacao, 'Sem posto'),
  },
  {
    key: 'nome',
    label: 'Nome/Nome de guerra',
    group: 'Identificação',
    defaultVisible: true,
    futureFilterType: 'text',
    accessor: (militar) => toText(militar?.nome_guerra || militar?.nome_completo),
  },
  {
    key: 'matricula',
    label: 'Matrícula',
    group: 'Identificação',
    defaultVisible: true,
    futureFilterType: 'text',
    accessor: (militar) => toText(militar?.matricula),
  },
  {
    key: 'quadro',
    label: 'Quadro',
    group: 'Carreira',
    defaultVisible: true,
    futureFilterType: 'multiselect',
    accessor: (militar) => toText(militar?.quadro),
  },
  {
    key: 'lotacao',
    label: 'Lotação',
    group: 'Carreira',
    defaultVisible: true,
    futureFilterType: 'multiselect',
    accessor: (militar) => toText(militar?.lotacao_atual, 'Sem lotação'),
  },
  {
    key: 'situacao_militar',
    label: 'Situação',
    group: 'Situação',
    defaultVisible: true,
    futureFilterType: 'multiselect',
    accessor: (militar) => toText(militar?.situacao_militar),
  },
  {
    key: 'situacao_condicao_militar',
    label: 'Condição',
    group: 'Situação',
    defaultVisible: true,
    futureFilterType: 'multiselect',
    accessor: (militar) => toText(militar?.situacao_condicao_militar),
  },
  {
    key: 'status_cadastro',
    label: 'Status cadastro',
    group: 'Situação',
    defaultVisible: false,
    futureFilterType: 'multiselect',
    accessor: (militar) => toText(militar?.status_cadastro, 'Ativo'),
  },
  {
    key: 'tipo_sanguineo',
    label: 'Tipo sanguíneo',
    group: 'Identificação',
    defaultVisible: false,
    futureFilterType: 'multiselect',
    accessor: (militar) => toText(militar?.tipo_sanguineo),
  },
  {
    key: 'telefone',
    label: 'Telefone',
    group: 'Contato',
    defaultVisible: false,
    futureFilterType: 'text',
    accessor: (militar) => toText(militar?.telefone),
  },
  {
    key: 'email',
    label: 'E-mail',
    group: 'Contato',
    defaultVisible: false,
    futureFilterType: 'text',
    accessor: (militar) => toText(militar?.email),
  },
];

export const CONSULTA_MILITAR_COLUNAS_GROUP_ORDER = ['Identificação', 'Carreira', 'Contato', 'Situação'];
export const CONSULTA_MILITAR_COLUNAS_STORAGE_KEY = 'consulta_militar_visible_columns_v1';
