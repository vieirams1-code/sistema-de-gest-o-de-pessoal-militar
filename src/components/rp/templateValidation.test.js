import test from 'node:test';
import assert from 'node:assert/strict';

import { getTemplateAtivoPorTipo, tipoExigeTemplate } from './templateValidation.js';

const BASE_TEMPLATE = {
  ativo: true,
  tipo_registro: 'Ata JISO',
  modulo: 'ExOfficio',
  template: 'Texto {{nome_completo}} - {{posto}}',
};

test('prioriza template de UNIDADE sobre SUBSETOR/SETOR/GLOBAL', () => {
  const templates = [
    { ...BASE_TEMPLATE, id: 'global', escopo: 'GLOBAL' },
    { ...BASE_TEMPLATE, id: 'setor', escopo: 'SETOR', setor_id: 'g1' },
    { ...BASE_TEMPLATE, id: 'subsetor', escopo: 'SUBSETOR', setor_id: 'g1', subsetor_id: 's1' },
    { ...BASE_TEMPLATE, id: 'unidade', escopo: 'UNIDADE', setor_id: 'g1', subsetor_id: 's1', unidade_id: 'u1' },
  ];

  const escolhido = getTemplateAtivoPorTipo('Ata JISO', 'ExOfficio', templates, {
    grupamento_id: 'g1',
    subgrupamento_id: 's1',
    subgrupamento_tipo: 'Unidade',
    unidade_id: 'u1',
  });

  assert.equal(escolhido?.id, 'unidade');
});

test('usa SUBSETOR quando UNIDADE não existe', () => {
  const templates = [
    { ...BASE_TEMPLATE, id: 'global', escopo: 'GLOBAL' },
    { ...BASE_TEMPLATE, id: 'setor', escopo: 'SETOR', setor_id: 'g1' },
    { ...BASE_TEMPLATE, id: 'subsetor', escopo: 'SUBSETOR', setor_id: 'g1', subsetor_id: 's1' },
  ];

  const escolhido = getTemplateAtivoPorTipo('Ata JISO', 'ExOfficio', templates, {
    grupamento_id: 'g1',
    subgrupamento_id: 's1',
  });

  assert.equal(escolhido?.id, 'subsetor');
});

test('usa SETOR quando não há SUBSETOR/UNIDADE', () => {
  const templates = [
    { ...BASE_TEMPLATE, id: 'global', escopo: 'GLOBAL' },
    { ...BASE_TEMPLATE, id: 'setor', escopo: 'SETOR', setor_id: 'g1' },
  ];

  const escolhido = getTemplateAtivoPorTipo('Ata JISO', 'ExOfficio', templates, {
    grupamento_id: 'g1',
  });

  assert.equal(escolhido?.id, 'setor');
});

test('faz fallback para GLOBAL quando não houver escopo mais específico', () => {
  const templates = [{ ...BASE_TEMPLATE, id: 'global', escopo: 'GLOBAL' }];

  const escolhido = getTemplateAtivoPorTipo('Ata JISO', 'ExOfficio', templates, {
    grupamento_id: 'g1',
    subgrupamento_id: 's1',
    unidade_id: 'u1',
  });

  assert.equal(escolhido?.id, 'global');
});

test('gera texto_publicacao aplicando template resolvido', () => {
  const templates = [{ ...BASE_TEMPLATE, id: 'global', escopo: 'GLOBAL' }];
  const escolhido = getTemplateAtivoPorTipo('Ata JISO', 'ExOfficio', templates, {});

  const texto = aplicarTemplateLocal(escolhido.template, {
    nome_completo: 'Fulano de Tal',
    posto: 'Cap',
  });

  assert.equal(texto, 'Texto Fulano de Tal - Cap');
});

test('bloqueio permanece quando tipo exige template e não existe template aplicável', () => {
  const escolhido = getTemplateAtivoPorTipo('Ata JISO', 'ExOfficio', [], {
    grupamento_id: 'g1',
    subgrupamento_id: 's1',
  });

  assert.equal(tipoExigeTemplate('Ata JISO'), true);
  assert.equal(escolhido, null);
});
function aplicarTemplateLocal(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}
