import test from 'node:test';
import assert from 'node:assert/strict';

import { getTemplateAtivoPorTipo, lintTemplateOnSave, tipoExigeTemplate } from './templateValidation.js';

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

test('variável desconhecida bloqueia em tipo com contrato', () => {
  const result = lintTemplateOnSave({
    modulo: 'Livro',
    tipoRegistro: 'Saída Férias',
    template: 'Texto {{nome_completo}} {{variavel_que_nao_existe}}',
  });
  assert.equal(result.ok, false);
  assert.equal(result.findings.some((f) => f.code === 'VAR_DESCONHECIDA' && f.severity === 'ERRO'), true);
});

test('template vazio bloqueia', () => {
  const result = lintTemplateOnSave({
    modulo: 'Livro',
    tipoRegistro: 'Saída Férias',
    template: '   ',
  });
  assert.equal(result.ok, false);
  assert.equal(result.findings.some((f) => f.code === 'TEMPLATE_VAZIO' && f.severity === 'ERRO'), true);
});

test('alias gera alerta e não bloqueia', () => {
  const result = lintTemplateOnSave({
    modulo: 'Livro',
    tipoRegistro: 'Saída Férias',
    template: 'Texto {{nome_completo}} {{posto}} {{matricula}} {{data_inicio}}',
  });
  assert.equal(result.ok, true);
  assert.equal(result.findings.some((f) => f.code === 'VAR_ALIAS' && f.severity === 'ALERTA'), true);
});

test('obrigatória ausente gera alerta e não bloqueia', () => {
  const result = lintTemplateOnSave({
    modulo: 'Livro',
    tipoRegistro: 'Saída Férias',
    template: 'Texto {{nome_completo}}',
  });
  assert.equal(result.ok, true);
  assert.equal(result.findings.some((f) => f.code === 'VAR_OBRIGATORIA_AUSENTE' && f.severity === 'ALERTA'), true);
});

test('tipo sem contrato não bloqueia e gera alerta', () => {
  const result = lintTemplateOnSave({
    modulo: 'Livro',
    tipoRegistro: 'Tipo sem contrato',
    template: 'Texto {{qualquer_variavel}}',
  });
  assert.equal(result.ok, true);
  assert.equal(result.findings.some((f) => f.code === 'CONTRATO_AUSENTE' && f.severity === 'ALERTA'), true);
});

test('template válido passa', () => {
  const result = lintTemplateOnSave({
    modulo: 'Livro',
    tipoRegistro: 'Retorno Férias',
    template: 'Texto {{nome_completo}} {{posto_nome}} {{matricula}} {{data_retorno}}',
  });
  assert.equal(result.ok, true);
  assert.equal(result.summary.erros, 0);
});

test('saída férias oficial com data_registro não gera VAR_DESCONHECIDA', () => {
  const result = lintTemplateOnSave({
    modulo: 'Livro',
    tipoRegistro: 'Início de Férias',
    template: 'Texto {{data_registro}} {{dias}} {{dias_extenso}} {{periodo_aquisitivo}}',
  });
  assert.equal(result.ok, true);
  assert.equal(result.findings.some((f) => f.code === 'VAR_DESCONHECIDA'), false);
});

test('interrupção férias com variáveis de buildVarsLivro passa sem VAR_DESCONHECIDA', () => {
  const result = lintTemplateOnSave({
    modulo: 'Livro',
    tipoRegistro: 'Interrupção',
    template:
      'Texto {{nome_completo}} {{posto_nome}} {{matricula}} {{data_registro}} {{data_interrupcao}} {{dias_gozados_interrupcao}} {{saldo_remanescente}} {{periodo_aquisitivo}}',
  });
  assert.equal(result.ok, true);
  assert.equal(result.findings.some((f) => f.code === 'VAR_DESCONHECIDA'), false);
});

test('continuação/nova saída com data_inicio e saldo_remanescente passa', () => {
  const result = lintTemplateOnSave({
    modulo: 'Livro',
    tipoRegistro: 'Nova Saída',
    template:
      'Texto {{nome_completo}} {{posto_nome}} {{matricula}} {{data_registro}} {{data_inicio}} {{data_retorno}} {{saldo_remanescente}}',
  });
  assert.equal(result.ok, true);
  assert.equal(result.findings.some((f) => f.code === 'VAR_DESCONHECIDA'), false);
});

test('retorno férias oficial com data_registro passa sem VAR_DESCONHECIDA', () => {
  const result = lintTemplateOnSave({
    modulo: 'Livro',
    tipoRegistro: 'Retorno Férias',
    template:
      'Texto {{nome_completo}} {{posto_nome}} {{matricula}} {{data_registro}} {{data_retorno}} {{periodo_aquisitivo}}',
  });
  assert.equal(result.ok, true);
  assert.equal(result.findings.some((f) => f.code === 'VAR_DESCONHECIDA'), false);
});


test('homologação de atestado aceita variáveis usadas no fluxo real', () => {
  const result = lintTemplateOnSave({
    modulo: 'ExOfficio',
    tipoRegistro: 'Homologação de Atestado',
    template:
      'Texto {{nome_completo}} {{posto_nome}} {{matricula}} {{dias}} {{dias_extenso}} {{tipo_afastamento}} {{data_inicio}} {{data_termino}} {{medico_nome}} {{medico_crm}}',
  });
  assert.equal(result.ok, true);
  assert.equal(result.findings.some((f) => f.code === 'VAR_DESCONHECIDA'), false);
});

test('homologação de atestado de acompanhamento aceita variáveis específicas seguras', () => {
  const result = lintTemplateOnSave({
    modulo: 'ExOfficio',
    tipoRegistro: 'Homologação de Atestado de Acompanhamento',
    template:
      'Texto {{nome_completo}} {{posto_nome}} {{matricula}} {{dias}} {{tipo_afastamento}} {{acompanhado_nome}} {{acompanhado_parentesco}} {{tipo_atestado_texto}}',
  });
  assert.equal(result.ok, true);
  assert.equal(result.findings.some((f) => f.code === 'VAR_DESCONHECIDA'), false);
});

test('homologação de atestado comum bloqueia variável exclusiva de acompanhamento', () => {
  const result = lintTemplateOnSave({
    modulo: 'ExOfficio',
    tipoRegistro: 'Homologação de Atestado',
    template: 'Texto {{nome_completo}} {{posto_nome}} {{matricula}} {{acompanhado_nome}}',
  });
  assert.equal(result.ok, false);
  assert.equal(result.findings.some((f) => f.code === 'VAR_DESCONHECIDA' && f.variavel === 'acompanhado_nome'), true);
});

test('homologação de atestado continua bloqueando variável desconhecida', () => {
  const result = lintTemplateOnSave({
    modulo: 'ExOfficio',
    tipoRegistro: 'Homologação de Atestado',
    template: 'Texto {{nome_completo}} {{posto_nome}} {{matricula}} {{variavel_estranha}}',
  });
  assert.equal(result.ok, false);
  assert.equal(result.findings.some((f) => f.code === 'VAR_DESCONHECIDA' && f.severity === 'ERRO'), true);
});
