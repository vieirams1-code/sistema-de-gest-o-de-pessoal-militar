const usuarioAcessoFields = [
  'nome_usuario',
  'user_email',
  'ativo',
  'tipo_acesso',
  'grupamento_id',
  'grupamento_nome',
  'subgrupamento_id',
  'subgrupamento_nome',
  'subgrupamento_tipo',
  'militar_id',
  'militar_email',
  'perfil_id',
  'perfil_nome',
  /^acesso_/,
  /^perm_/,
];

const perfilPermissaoFields = ['nome_perfil', /^acesso_/, /^perm_/];

const solicitacaoCreateFields = [
  'militar_id',
  'militar_nome',
  'militar_posto',
  'militar_matricula',
  'snapshot_militar',
  'snapshot_militar_nome',
  'snapshot_militar_posto',
  'snapshot_militar_matricula',
  'campo_chave',
  'campo_label',
  'valor_atual',
  'valor_proposto',
  'justificativa',
  'data_solicitacao',
  'status',
];

const solicitacaoDecisionFields = ['status', 'usuario_decisao', 'data_decisao', 'observacao_decisao'];

const militarApprovedFields = [
  'telefone',
  'telefone_contato',
  'email',
  'endereco',
  'cep',
  'bairro',
  'cidade',
  'estado',
  'numero',
  'complemento',
  'nome_contato_emergencia',
  'telefone_contato_emergencia',
];

const militarDirectFields = [
  'nome_completo',
  'nome_guerra',
  'telefone',
  'telefone_contato',
  'email',
  'endereco',
  'cep',
  'bairro',
  'cidade',
  'estado',
  'numero',
  'complemento',
  'nome_contato_emergencia',
  'telefone_contato_emergencia',
  'observacoes',
  'foto_url',
];

export const ENTITY_MUTABLE_FIELDS = {
  UsuarioAcesso: {
    create: usuarioAcessoFields,
    update: usuarioAcessoFields,
  },
  PerfilPermissao: {
    create: perfilPermissaoFields,
    update: perfilPermissaoFields,
  },
  SolicitacaoAtualizacao: {
    create: solicitacaoCreateFields,
    update: solicitacaoDecisionFields,
    decision: solicitacaoDecisionFields,
  },
  Militar: {
    create: militarDirectFields,
    update: militarDirectFields,
    approvedSolicitation: militarApprovedFields,
  },
};

export const ENTITY_IMMUTABLE_FIELDS = {
  Militar: [
    'id',
    'created_date',
    'grupamento_id',
    'subgrupamento_id',
    'comportamento',
    'status_cadastro',
    'posto_graduacao',
    'matricula',
    'cpf',
    'rg',
    'data_incorporacao',
    'funcao',
    'lotacao',
  ],
  UsuarioAcesso: ['id', 'created_date'],
  PerfilPermissao: ['id', 'created_date'],
  SolicitacaoAtualizacao: [
    'id',
    'created_date',
    'militar_id',
    'militar_nome',
    'militar_posto',
    'militar_matricula',
    'snapshot_militar',
    'snapshot_militar_nome',
    'snapshot_militar_posto',
    'snapshot_militar_matricula',
    'campo_chave',
    'campo_label',
    'valor_atual',
    'valor_proposto',
    'justificativa',
    'data_solicitacao',
  ],
};
