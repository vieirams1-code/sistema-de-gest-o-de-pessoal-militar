import test from 'node:test';
import assert from 'node:assert/strict';

import {
  EXTRACAO_EFETIVO_DEFAULT_COLUMNS,
  EXTRACAO_EFETIVO_FIELDS,
  EXTRACAO_EFETIVO_FORBIDDEN_FIELDS,
  getValorCampoEfetivo,
} from '../catalogoCamposEfetivo.js';

const DEFAULT_COLUMN_ORDER = Object.freeze([
  'posto_graduacao',
  'nome_guerra',
  'nome_completo',
  'matricula',
  'quadro',
  'lotacao_nome',
  'status_cadastro',
  'situacao_militar',
  'funcao',
]);

const ALLOWED_RENDERERS = new Set(['statusBadge']);
const ALLOWED_BACKEND_PARAMS = new Set([
  'postoGraduacaoFiltros',
  'statusCadastro',
  'situacaoMilitar',
  'lotacaoFiltro',
  'search',
]);
const ALLOWED_SORT_TYPES = new Set([
  'text',
  'naturalText',
  'postoGraduacao',
  'statusCadastro',
  'quadro',
]);
const ALLOWED_FILTER_MODES = new Set(['backend', 'client', 'hybrid']);
const ALLOWED_FILTER_TYPES = new Set(['select', 'text']);

const SELECTABLE_COLUMN_ORDER = Object.freeze([
  'posto_graduacao',
  'nome_guerra',
  'nome_completo',
  'matricula',
  'quadro',
  'lotacao_nome',
  'status_cadastro',
  'situacao_militar',
  'funcao',
  'condicao',
]);

const REQUIRED_COLUMN_IDS = Object.freeze(['nome_guerra', 'matricula']);

const SENSITIVE_FIELD_IDS = Object.freeze([
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

const SENSITIVE_TEXT_PATTERNS = Object.freeze([
  /relig/i,
  /sangu[ií]neo/i,
  /\bsexo\b/i,
  /etnia/i,
  /nascimento/i,
  /\bcpf\b/i,
  /\brg\b/i,
  /\bcnh\b/i,
  /filia[cç][aã]o/i,
  /endere[cç]o/i,
  /telefone/i,
  /e-?mail/i,
  /banc[aá]rio/i,
  /altura/i,
  /peso/i,
  /foto/i,
  /m[eé]dic/i,
  /sa[uú]de/i,
]);

function getDefaultColumnIds() {
  return EXTRACAO_EFETIVO_DEFAULT_COLUMNS.map((column) => column.id);
}

test('EXTRACAO_EFETIVO_FIELDS é uma allowlist íntegra e sem ids duplicados', () => {
  const entries = Object.entries(EXTRACAO_EFETIVO_FIELDS);
  const ids = entries.map(([, field]) => field.id);

  assert.ok(entries.length > 0, 'catálogo deve expor ao menos um campo permitido');
  assert.equal(new Set(ids).size, ids.length, 'catálogo não pode ter ids duplicados');

  for (const [key, field] of entries) {
    assert.equal(key, field.id, `chave ${key} deve bater com field.id`);
    assert.equal(typeof field.id, 'string', `${key} deve ter id textual`);
    assert.ok(field.id.trim(), `${key} deve ter id preenchido`);
    assert.equal(typeof field.label, 'string', `${key} deve ter label textual`);
    assert.ok(field.label.trim(), `${key} deve ter label preenchido`);
    assert.equal(typeof field.accessor, 'function', `${key} deve expor accessor controlado`);
  }
});

test('EXTRACAO_EFETIVO_DEFAULT_COLUMNS contém apenas referências da allowlist em ordem estável', () => {
  const defaultColumnIds = getDefaultColumnIds();

  assert.deepEqual(defaultColumnIds, DEFAULT_COLUMN_ORDER, 'ordem padrão da extração deve permanecer estável');
  assert.equal(
    new Set(defaultColumnIds).size,
    defaultColumnIds.length,
    'colunas padrão não podem ter duplicidade',
  );

  for (const column of EXTRACAO_EFETIVO_DEFAULT_COLUMNS) {
    assert.ok(EXTRACAO_EFETIVO_FIELDS[column.id], `coluna ${column.id} deve existir na allowlist`);
    assert.equal(
      column,
      EXTRACAO_EFETIVO_FIELDS[column.id],
      `coluna ${column.id} deve reutilizar a mesma referência do catálogo`,
    );
  }
});

test('colunas padrão não incluem campos proibidos nem campos sensíveis', () => {
  const defaultColumnIds = getDefaultColumnIds();
  const forbiddenFields = new Set(EXTRACAO_EFETIVO_FORBIDDEN_FIELDS);
  const sensitiveFields = new Set(SENSITIVE_FIELD_IDS);

  for (const column of EXTRACAO_EFETIVO_DEFAULT_COLUMNS) {
    assert.equal(forbiddenFields.has(column.id), false, `${column.id} não pode estar em campos proibidos`);
    assert.equal(sensitiveFields.has(column.id), false, `${column.id} não pode ser campo sensível`);

    const searchableColumnText = `${column.id} ${column.label}`;
    for (const pattern of SENSITIVE_TEXT_PATTERNS) {
      assert.equal(pattern.test(searchableColumnText), false, `${column.id} não pode indicar dado sensível`);
    }
  }

  assert.deepEqual(
    defaultColumnIds.filter((id) => forbiddenFields.has(id)),
    [],
    'lista de colunas padrão não pode cruzar com forbidden fields',
  );
});


test('colunas selecionáveis vêm apenas da allowlist positiva e respeitam metadados seguros', () => {
  const forbiddenFields = new Set(EXTRACAO_EFETIVO_FORBIDDEN_FIELDS);
  const sensitiveFields = new Set(SENSITIVE_FIELD_IDS);
  const selectableColumns = Object.values(EXTRACAO_EFETIVO_FIELDS)
    .filter((field) => field.selectable === true)
    .sort((a, b) => a.displayOrder - b.displayOrder);
  const selectableIds = selectableColumns.map((field) => field.id);
  const defaultColumnIds = getDefaultColumnIds();

  assert.deepEqual(selectableIds, SELECTABLE_COLUMN_ORDER, 'ordem visual de seleção deve ser explícita e estável');

  for (const field of selectableColumns) {
    assert.equal(EXTRACAO_EFETIVO_FIELDS[field.id], field, `${field.id} deve vir da allowlist`);
    assert.equal(forbiddenFields.has(field.id), false, `${field.id} não pode aparecer em forbidden fields`);
    assert.equal(sensitiveFields.has(field.id), false, `${field.id} não pode ser selecionável sensível`);
    assert.equal(typeof field.defaultVisible, 'boolean', `${field.id} deve declarar defaultVisible booleano`);
    assert.equal(typeof field.displayOrder, 'number', `${field.id} deve declarar displayOrder numérico`);
    assert.equal(typeof field.category, 'string', `${field.id} deve declarar categoria textual`);
    assert.ok(field.category.trim(), `${field.id} deve ter categoria preenchida`);

    const searchableColumnText = `${field.id} ${field.label}`;
    for (const pattern of SENSITIVE_TEXT_PATTERNS) {
      assert.equal(pattern.test(searchableColumnText), false, `${field.id} selecionável não pode indicar dado sensível`);
    }
  }

  assert.deepEqual(
    selectableIds.filter((id) => forbiddenFields.has(id)),
    [],
    'campos proibidos não podem ser marcados como selecionáveis',
  );
  assert.deepEqual(
    defaultColumnIds,
    selectableColumns.filter((field) => field.defaultVisible).map((field) => field.id),
    'defaultVisible deve refletir exatamente EXTRACAO_EFETIVO_DEFAULT_COLUMNS',
  );
});

test('colunas obrigatórias são metadado explícito e fazem parte das colunas padrão', () => {
  const defaultColumnIds = new Set(getDefaultColumnIds());
  const requiredIds = Object.values(EXTRACAO_EFETIVO_FIELDS)
    .filter((field) => field.required === true)
    .map((field) => field.id);

  assert.deepEqual(requiredIds, REQUIRED_COLUMN_IDS, 'colunas obrigatórias devem permanecer explícitas');

  for (const fieldId of requiredIds) {
    assert.equal(defaultColumnIds.has(fieldId), true, `${fieldId} obrigatório deve iniciar visível`);
    assert.equal(EXTRACAO_EFETIVO_FIELDS[fieldId].selectable, true, `${fieldId} obrigatório deve ser selecionável`);
  }
});


test('metadados de ordenação e filtro permanecem restritos à allowlist segura', () => {
  const allowlistIds = new Set(Object.keys(EXTRACAO_EFETIVO_FIELDS));
  const forbiddenFields = new Set(EXTRACAO_EFETIVO_FORBIDDEN_FIELDS);
  const sensitiveFields = new Set(SENSITIVE_FIELD_IDS);

  for (const field of Object.values(EXTRACAO_EFETIVO_FIELDS)) {
    assert.equal(allowlistIds.has(field.id), true, `${field.id} deve existir na allowlist antes de receber metadados`);
    assert.equal(forbiddenFields.has(field.id), false, `${field.id} não pode ser forbidden field`);
    assert.equal(sensitiveFields.has(field.id), false, `${field.id} não pode ser sensível`);

    if (field.sortable !== undefined) {
      assert.equal(field.sortable, true, `${field.id} sortable deve ser boolean true explícito`);
      assert.equal(allowlistIds.has(field.id), true, `${field.id} sortable deve vir da allowlist`);
    }

    if (field.filterable !== undefined) {
      assert.equal(field.filterable, true, `${field.id} filterable deve ser boolean true explícito`);
      assert.equal(allowlistIds.has(field.id), true, `${field.id} filterable deve vir da allowlist`);
      assert.equal(ALLOWED_FILTER_TYPES.has(field.filterType), true, `${field.id} usa filterType não permitido`);
    }

    if (field.searchable !== undefined) {
      assert.equal(field.searchable, true, `${field.id} searchable deve ser boolean true explícito`);
      assert.equal(allowlistIds.has(field.id), true, `${field.id} searchable deve vir da allowlist`);
    }

    if (field.backendParam !== undefined) {
      assert.equal(ALLOWED_BACKEND_PARAMS.has(field.backendParam), true, `${field.id} usa backendParam não aceito`);
    }

    if (field.sortType !== undefined) {
      assert.equal(ALLOWED_SORT_TYPES.has(field.sortType), true, `${field.id} usa sortType não permitido`);
    }

    if (field.sortRank !== undefined) {
      assert.equal(typeof field.sortRank, 'number', `${field.id} usa sortRank não numérico`);
    }

    if (field.filterMode !== undefined) {
      assert.equal(ALLOWED_FILTER_MODES.has(field.filterMode), true, `${field.id} usa filterMode não permitido`);
    }

    if (field.sourceFields !== undefined) {
      assert.equal(Array.isArray(field.sourceFields), true, `${field.id} sourceFields deve ser array`);
      for (const sourceField of field.sourceFields) {
        assert.equal(forbiddenFields.has(sourceField), false, `${field.id} não pode mapear sourceField proibido`);
        assert.equal(sensitiveFields.has(sourceField), false, `${field.id} não pode mapear sourceField sensível`);
      }
    }
  }
});

test('EXTRACAO_EFETIVO_FORBIDDEN_FIELDS permanece documental e fora da montagem do catálogo', () => {
  const forbiddenFields = new Set(EXTRACAO_EFETIVO_FORBIDDEN_FIELDS);
  const allowlistIds = Object.keys(EXTRACAO_EFETIVO_FIELDS);
  const defaultColumnIds = getDefaultColumnIds();

  assert.deepEqual(
    allowlistIds.filter((id) => forbiddenFields.has(id)),
    [],
    'campos proibidos não devem ser concatenados à allowlist',
  );
  assert.deepEqual(
    defaultColumnIds.filter((id) => forbiddenFields.has(id)),
    [],
    'campos proibidos não devem ser usados para montar colunas padrão',
  );

  for (const field of Object.values(EXTRACAO_EFETIVO_FIELDS)) {
    if (!Array.isArray(field.sourceFields)) continue;

    assert.deepEqual(
      field.sourceFields.filter((sourceField) => forbiddenFields.has(sourceField)),
      [],
      `${field.id} não pode declarar sourceFields proibidos`,
    );
  }
});

test('getValorCampoEfetivo retorna valores seguros, aplica fallbacks e normaliza quadro legado', () => {
  const militar = {
    posto_graduacao: '  Cabo  ',
    nome_guerra: '  Silva  ',
    matricula_atual: '  12345  ',
    matricula: '99999',
    quadro: ' QBMPT ',
    estrutura_nome: '  1º GBM  ',
    lotacao_atual: 'Outra lotação',
    status_cadastro: 'ativo',
  };

  assert.equal(getValorCampoEfetivo(militar, 'campo_inexistente'), '', 'campo inexistente deve ser seguro');
  assert.equal(getValorCampoEfetivo(militar, 'posto_graduacao'), 'Cabo', 'campo permitido deve retornar valor esperado');
  assert.equal(getValorCampoEfetivo(militar, 'matricula'), '12345', 'matrícula deve priorizar matricula_atual');
  assert.equal(getValorCampoEfetivo({ matricula: ' 88888 ' }, 'matricula'), '88888', 'matrícula deve cair para matricula');
  assert.equal(getValorCampoEfetivo(militar, 'lotacao_nome'), '1º GBM', 'lotação deve usar fallback lógico');
  assert.equal(getValorCampoEfetivo({ lotacao_nome: '  2º GBM ' }, 'lotacao_nome'), '2º GBM', 'lotação deve cair para campos alternativos');
  assert.equal(getValorCampoEfetivo(militar, 'quadro'), 'QPTBM', 'quadro deve normalizar legado QBMPT');

  for (const column of EXTRACAO_EFETIVO_DEFAULT_COLUMNS) {
    const valor = getValorCampoEfetivo({ [column.id]: { bruto: true } }, column.id);
    assert.notEqual(typeof valor, 'object', `${column.id} não deve retornar objeto cru`);
  }
});

test('renderAs é controlado e restrito a renderizadores conhecidos da allowlist', () => {
  for (const field of Object.values(EXTRACAO_EFETIVO_FIELDS)) {
    if (!field.renderAs) continue;

    assert.equal(ALLOWED_RENDERERS.has(field.renderAs), true, `${field.id} usa renderAs não permitido`);
  }

  for (const column of EXTRACAO_EFETIVO_DEFAULT_COLUMNS) {
    assert.equal(column, EXTRACAO_EFETIVO_FIELDS[column.id], `${column.id} deve vir da allowlist antes de renderizar`);
  }
});
