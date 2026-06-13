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

const calculateAge = (value) => {
  if (!value) return null;
  const birthDate = new Date(value);
  if (Number.isNaN(birthDate.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  return age >= 0 ? age : null;
};

const getFirst = (obj, keys = []) => {
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return null;
};

const getNested = (obj, path) => {
  if (!obj || !path) return null;
  const value = String(path)
    .split('.')
    .reduce((acc, key) => (acc === null || acc === undefined ? null : acc[key]), obj);
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  return value;
};

const getFirstFromPaths = (obj, paths = []) => {
  for (const path of paths) {
    const value = getNested(obj, path);
    if (value !== null) return value;
  }
  return null;
};

import { getPostoGraduacaoMilitar, getQuadroMilitar } from '../../utils/militarPostoGraduacao.js';

// Posto a exibir na coluna: prioriza o posto virtual (Curso de Formação ativo)
// quando presente; caso contrário usa o posto/graduação oficial.
const getPostoExibicao = (militar) => (
  militar?.possui_posto_virtual && militar?.posto_graduacao_exibicao
    ? String(militar.posto_graduacao_exibicao).trim()
    : getPostoGraduacaoMilitar(militar)
);

const buildEndereco = (militar) => {
  const logradouro = getFirst(militar, ['logradouro', 'endereco_logradouro']);
  const numero = getFirst(militar, ['numero', 'endereco_numero']);
  const bairro = getFirst(militar, ['bairro', 'endereco_bairro']);
  const cidade = getFirst(militar, ['cidade', 'municipio', 'endereco_cidade']);

  const partes = [logradouro, numero, bairro, cidade]
    .map((parte) => (parte === null || parte === undefined ? '' : String(parte).trim()))
    .filter(Boolean);

  return partes.length ? partes.join(', ') : null;
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
    minWidth: 140,
    align: 'left',
    nowrap: true,
    accessor: (militar) => getPostoExibicao(militar),
  },
  {
    key: 'nome',
    label: 'Nome/Nome de guerra',
    group: 'Identificação',
    defaultVisible: true,
    futureFilterType: 'text',
    sensitive: false,
    visibleFor: ['admin', 'gestor'],
    minWidth: 240,
    align: 'left',
    truncate: true,
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
    minWidth: 240,
    align: 'left',
    truncate: true,
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
    minWidth: 240,
    align: 'left',
    truncate: true,
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
    minWidth: 130,
    align: 'center',
    nowrap: true,
    accessor: (militar) => toText(militar?.matricula),
  },
  {
    key: 'graduacao_origem_curso',
    label: 'Graduação de origem no curso',
    group: 'Carreira',
    defaultVisible: false,
    futureFilterType: 'text',
    sensitive: false,
    visibleFor: ['admin', 'gestor'],
    minWidth: 200,
    align: 'left',
    nowrap: true,
    // Dado técnico interno do vínculo do curso (auditoria / retorno em caso de
    // reprovação/desligamento). Só tem valor quando há posto virtual ativo.
    accessor: (militar) => (
      militar?.possui_posto_virtual
        ? toText(militar?.posto_graduacao_real || getPostoGraduacaoMilitar(militar))
        : '—'
    ),
  },
  {
    key: 'quadro',
    label: 'Quadro',
    group: 'Carreira',
    defaultVisible: true,
    futureFilterType: 'multiselect',
    sensitive: false,
    visibleFor: ['admin', 'gestor'],
    minWidth: 120,
    align: 'left',
    nowrap: true,
    accessor: (militar) => getQuadroMilitar(militar),
  },
  {
    key: 'antiguidade_ordem',
    future: true,
    label: 'Antiguidade/ordem',
    group: 'Carreira',
    defaultVisible: false,
    futureFilterType: 'text',
    sensitive: false,
    visibleFor: ['admin', 'gestor'],
    minWidth: 130,
    align: 'center',
    nowrap: true,
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
    minWidth: 130,
    align: 'center',
    nowrap: true,
    accessor: (militar) => toDate(getFirst(militar, ['data_inclusao', 'inclusao_data', 'dataInclusao'])),
  },
  {
    key: 'data_promocao_atual',
    future: true,
    label: 'Data da promoção atual',
    group: 'Carreira',
    defaultVisible: false,
    futureFilterType: 'text',
    sensitive: false,
    visibleFor: ['admin', 'gestor'],
    minWidth: 130,
    align: 'center',
    nowrap: true,
    accessor: (militar) => toDate(getFirst(militar, ['data_promocao_atual', 'promocao_atual_data', 'dataPromocaoAtual'])),
  },
  {
    key: 'comportamento',
    label: 'Comportamento',
    group: 'Carreira',
    defaultVisible: false,
    futureFilterType: 'multiselect',
    sensitive: false,
    visibleFor: ['admin', 'gestor'],
    minWidth: 120,
    align: 'left',
    nowrap: true,
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
    minWidth: 180,
    align: 'left',
    truncate: true,
    accessor: (militar) => toText(getFirstFromPaths(militar, ['lotacao_atual', 'lotacao', 'lotacao_nome', 'lotacao.nome']), 'Sem lotação'),
  },
  {
    key: 'unidade',
    future: true,
    label: 'Unidade',
    group: 'Lotação',
    defaultVisible: false,
    futureFilterType: 'multiselect',
    sensitive: false,
    visibleFor: ['admin', 'gestor'],
    minWidth: 180,
    align: 'left',
    truncate: true,
    accessor: (militar) => toText(getFirstFromPaths(militar, ['unidade', 'unidade_nome', 'lotacao_unidade', 'lotacao.unidade', 'lotacao.unidade_nome'])),
  },
  {
    key: 'subgrupamento',
    label: 'Subgrupamento',
    group: 'Lotação',
    defaultVisible: false,
    futureFilterType: 'multiselect',
    sensitive: false,
    visibleFor: ['admin', 'gestor'],
    minWidth: 180,
    align: 'left',
    truncate: true,
    accessor: (militar) => {
      const estruturaTipo = String(militar?.estrutura_tipo || '').toLowerCase();
      const estruturaNome = militar?.estrutura_nome;
      const subgrupamentoEstrutura = (estruturaTipo.includes('subgrupamento') || estruturaTipo.includes('unidade')) ? estruturaNome : null;
      return toText(getFirstFromPaths(militar, ['subgrupamento', 'subsetor_nome', 'lotacao_subgrupamento', 'lotacao.subgrupamento', 'lotacao.subsetor_nome']) || subgrupamentoEstrutura);
    },
  },
  {
    key: 'grupamento',
    future: true,
    label: 'Grupamento',
    group: 'Lotação',
    defaultVisible: false,
    futureFilterType: 'multiselect',
    sensitive: false,
    visibleFor: ['admin', 'gestor'],
    minWidth: 180,
    align: 'left',
    truncate: true,
    accessor: (militar) => toText(getFirstFromPaths(militar, ['grupamento', 'setor_nome', 'lotacao_grupamento', 'lotacao.grupamento', 'lotacao.setor_nome'])),
  },
  {
    key: 'municipio',
    label: 'Município/Cidade',
    group: 'Lotação',
    defaultVisible: false,
    futureFilterType: 'multiselect',
    sensitive: false,
    visibleFor: ['admin', 'gestor'],
    minWidth: 180,
    align: 'left',
    truncate: true,
    accessor: (militar) => toText(getFirstFromPaths(militar, ['municipio', 'cidade', 'lotacao_municipio', 'lotacao.municipio', 'lotacao.cidade'])),
  },
  {
    key: 'setor_subsetor',
    future: true,
    label: 'Setor/Subsetor',
    group: 'Lotação',
    defaultVisible: false,
    futureFilterType: 'text',
    sensitive: false,
    visibleFor: ['admin', 'gestor'],
    minWidth: 180,
    align: 'left',
    truncate: true,
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
    minWidth: 120,
    align: 'center',
    nowrap: true,
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
    minWidth: 120,
    align: 'center',
    nowrap: true,
    accessor: (militar) => toText(getFirst(militar, ['condicao', 'situacao_condicao_militar'])),
  },
  {
    key: 'condicao',
    label: 'Condição (registro)',
    group: 'Situação',
    defaultVisible: false,
    futureFilterType: 'multiselect',
    sensitive: false,
    visibleFor: ['admin', 'gestor'],
    minWidth: 120,
    align: 'center',
    nowrap: true,
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
    minWidth: 180,
    align: 'left',
    truncate: true,
    accessor: (militar) => toText(getFirstFromPaths(militar, ['condicao_origem_destino', 'origem_destino', 'destino', 'origem', 'movimento_origem_destino'])),
  },
  {
    key: 'movimento_condicao',
    label: 'Movimento condição',
    group: 'Situação',
    defaultVisible: false,
    futureFilterType: 'multiselect',
    sensitive: false,
    visibleFor: ['admin', 'gestor'],
    accessor: (militar) => toText(getFirst(militar, ['condicao_movimento', 'movimento_condicao'])),
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
    accessor: (militar) => toText(getFirst(militar, ['tipo_sanguineo', 'tipoSanguineo', 'grupo_sanguineo', 'tipo_sangue', 'sangue', 'fator_rh'])),
  },
  {
    key: 'cpf',
    label: 'CPF',
    group: 'Identificação',
    defaultVisible: false,
    futureFilterType: 'text',
    sensitive: true,
    visibleFor: ['admin'],
    minWidth: 150,
    align: 'center',
    nowrap: true,
    accessor: (militar) => toText(getFirst(militar, ['cpf', 'cpf_numero'])),
  },
  {
    key: 'rg',
    label: 'RG',
    group: 'Identificação',
    defaultVisible: false,
    futureFilterType: 'text',
    sensitive: true,
    visibleFor: ['admin'],
    minWidth: 150,
    align: 'center',
    nowrap: true,
    accessor: (militar) => toText(getFirst(militar, ['rg', 'rg_numero'])),
  },
  {
    key: 'data_nascimento',
    label: 'Data de nascimento',
    group: 'Identificação',
    defaultVisible: false,
    futureFilterType: 'text',
    sensitive: true,
    visibleFor: ['admin'],
    minWidth: 130,
    align: 'center',
    nowrap: true,
    accessor: (militar) => toDate(getFirst(militar, ['data_nascimento', 'dataNascimento', 'nascimento', 'data_nasc'])),
  },
  {
    key: 'idade',
    label: 'Idade',
    group: 'Identificação',
    defaultVisible: false,
    futureFilterType: 'text',
    sensitive: true,
    visibleFor: ['admin'],
    accessor: (militar) => {
      const idade = calculateAge(getFirst(militar, ['data_nascimento', 'dataNascimento', 'nascimento', 'data_nasc']));
      return idade === null ? '—' : String(idade);
    },
  },
  {
    key: 'sexo',
    label: 'Sexo',
    group: 'Identificação',
    defaultVisible: false,
    futureFilterType: 'multiselect',
    sensitive: true,
    visibleFor: ['admin'],
    minWidth: 90,
    align: 'center',
    nowrap: true,
    accessor: (militar) => toText(getFirst(militar, ['sexo', 'genero', 'sexo_biologico', 'sexoBiologico', 'genero_militar'])),
  },
  {
    key: 'telefone',
    label: 'Telefone',
    group: 'Contato',
    defaultVisible: false,
    futureFilterType: 'text',
    sensitive: true,
    visibleFor: ['admin'],
    accessor: (militar) => toText(getFirst(militar, ['telefone', 'telefone_principal', 'telefone_celular', 'celular'])),
  },
  {
    key: 'email',
    label: 'E-mail',
    group: 'Contato',
    defaultVisible: false,
    futureFilterType: 'text',
    sensitive: true,
    visibleFor: ['admin'],
    accessor: (militar) => toText(getFirst(militar, ['email_funcional', 'email_particular', 'email'])),
  },
  {
    key: 'endereco',
    label: 'Endereço',
    group: 'Contato',
    defaultVisible: false,
    futureFilterType: 'text',
    sensitive: true,
    visibleFor: ['admin'],
    accessor: (militar) => toText(buildEndereco(militar) || getFirstFromPaths(militar, ['endereco', 'endereco_completo', 'residencia_endereco', 'contato.endereco'])),
  },
  {
    key: 'observacoes_administrativas',
    future: true,
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