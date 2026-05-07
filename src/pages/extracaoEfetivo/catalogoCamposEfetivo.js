import { normalizarQuadroLegado } from '../../utils/postoQuadroCompatibilidade.js';

const MATRICULA_FIELDS = ['matricula_atual', 'matricula'];
const LOTACAO_NOME_FIELDS = [
  'estrutura_nome',
  'subgrupamento_nome',
  'grupamento_nome',
  'lotacao_atual',
  'lotacao_nome',
  'lotacao',
  'subgrupamento',
  'unidade_nome',
];

function normalizarTextoCampo(value) {
  return String(value || '').trim();
}

export function getPrimeiroValorEfetivo(record = {}, fields = []) {
  for (const field of fields) {
    const value = normalizarTextoCampo(record?.[field]);
    if (value) return value;
  }

  return '';
}

export function getMatriculaEfetivo(militar = {}) {
  return getPrimeiroValorEfetivo(militar, MATRICULA_FIELDS);
}

export function getLotacaoNomeEfetivo(militar = {}) {
  return getPrimeiroValorEfetivo(militar, LOTACAO_NOME_FIELDS);
}

export function getQuadroEfetivo(militar = {}) {
  return normalizarQuadroLegado(militar?.quadro) || normalizarTextoCampo(militar?.quadro);
}

export const EXTRACAO_EFETIVO_FIELDS = Object.freeze({
  posto_graduacao: Object.freeze({
    id: 'posto_graduacao',
    label: 'Posto/graduação',
    selectable: true,
    defaultVisible: true,
    displayOrder: 10,
    category: 'Identificação',
    accessor: (militar) => normalizarTextoCampo(militar?.posto_graduacao),
    cellClassName: 'font-semibold text-[#1e3a5f] whitespace-nowrap',
  }),
  nome_guerra: Object.freeze({
    id: 'nome_guerra',
    label: 'Nome de guerra',
    selectable: true,
    defaultVisible: true,
    required: true,
    displayOrder: 20,
    category: 'Identificação',
    accessor: (militar) => normalizarTextoCampo(militar?.nome_guerra),
    cellClassName: 'whitespace-nowrap',
  }),
  nome_completo: Object.freeze({
    id: 'nome_completo',
    label: 'Nome completo',
    selectable: true,
    defaultVisible: true,
    displayOrder: 30,
    category: 'Identificação',
    accessor: (militar) => normalizarTextoCampo(militar?.nome_completo),
    cellClassName: 'min-w-60',
  }),
  matricula: Object.freeze({
    id: 'matricula',
    label: 'Matrícula',
    selectable: true,
    defaultVisible: true,
    required: true,
    displayOrder: 40,
    category: 'Identificação',
    accessor: getMatriculaEfetivo,
    cellClassName: 'whitespace-nowrap',
  }),
  quadro: Object.freeze({
    id: 'quadro',
    label: 'Quadro',
    selectable: true,
    defaultVisible: true,
    displayOrder: 50,
    category: 'Vínculo funcional',
    accessor: getQuadroEfetivo,
    cellClassName: 'whitespace-nowrap',
  }),
  lotacao_nome: Object.freeze({
    id: 'lotacao_nome',
    label: 'Lotação',
    selectable: true,
    defaultVisible: true,
    displayOrder: 60,
    category: 'Vínculo funcional',
    accessor: getLotacaoNomeEfetivo,
    cellClassName: 'min-w-56',
  }),
  status_cadastro: Object.freeze({
    id: 'status_cadastro',
    label: 'Status',
    selectable: true,
    defaultVisible: true,
    displayOrder: 70,
    category: 'Vínculo funcional',
    accessor: (militar) => normalizarTextoCampo(militar?.status_cadastro),
    cellClassName: 'whitespace-nowrap',
    renderAs: 'statusBadge',
  }),
  situacao_militar: Object.freeze({
    id: 'situacao_militar',
    label: 'Situação militar',
    selectable: true,
    defaultVisible: true,
    displayOrder: 80,
    category: 'Vínculo funcional',
    accessor: (militar) => normalizarTextoCampo(militar?.situacao_militar),
    cellClassName: 'whitespace-nowrap',
  }),
  funcao: Object.freeze({
    id: 'funcao',
    label: 'Função',
    selectable: true,
    defaultVisible: true,
    displayOrder: 90,
    category: 'Vínculo funcional',
    accessor: (militar) => normalizarTextoCampo(militar?.funcao),
    cellClassName: 'min-w-44',
  }),
  condicao: Object.freeze({
    id: 'condicao',
    label: 'Condição',
    selectable: true,
    defaultVisible: false,
    displayOrder: 100,
    category: 'Vínculo funcional',
    accessor: (militar) => normalizarTextoCampo(militar?.condicao),
  }),
});

export const EXTRACAO_EFETIVO_DEFAULT_COLUMNS = Object.freeze([
  EXTRACAO_EFETIVO_FIELDS.posto_graduacao,
  EXTRACAO_EFETIVO_FIELDS.nome_guerra,
  EXTRACAO_EFETIVO_FIELDS.nome_completo,
  EXTRACAO_EFETIVO_FIELDS.matricula,
  EXTRACAO_EFETIVO_FIELDS.quadro,
  EXTRACAO_EFETIVO_FIELDS.lotacao_nome,
  EXTRACAO_EFETIVO_FIELDS.status_cadastro,
  EXTRACAO_EFETIVO_FIELDS.situacao_militar,
  EXTRACAO_EFETIVO_FIELDS.funcao,
]);

export const EXTRACAO_EFETIVO_FORBIDDEN_FIELDS = Object.freeze([
  'religiao',
  'tipo_sanguineo',
  'sexo',
  'etnia',
  'data_nascimento',
  'cpf',
  'rg',
  'cnh',
  'filiacao',
  'endereco',
  'telefone',
  'email_particular',
  'email_funcional',
  'dados_bancarios',
  'altura',
  'peso',
  'foto',
  'dados_medicos',
  'saude',
]);

export function getValorCampoEfetivo(militar = {}, fieldId = '') {
  const field = EXTRACAO_EFETIVO_FIELDS[fieldId];

  if (!field) return '';

  return field.accessor(militar);
}
