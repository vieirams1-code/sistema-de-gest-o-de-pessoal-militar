import test from 'node:test';
import assert from 'node:assert/strict';

import { buildTemplateVarsContrato, composeTemplateVarsRP } from './templateContratoUtils.js';

test('buildTemplateVarsContrato retorna núcleo canônico com aliases coerentes', () => {
  const vars = buildTemplateVarsContrato({
    nome_completo: 'Carlos Lima',
    posto: 'Cap',
    quadro: 'QOBM',
    matricula: '111',
  });

  assert.deepEqual(vars, {
    nome_completo: 'Carlos Lima',
    posto: 'Cap',
    posto_nome: 'Cap QOBM',
    quadro: 'QOBM',
    quadro_nome: 'QOBM',
    militar_quadro: 'QOBM',
    matricula: '111',
  });
});

test('buildTemplateVarsContrato prioriza matrícula documental > operacional > matrícula', () => {
  const vars = buildTemplateVarsContrato({
    militar_posto: 'Capitão',
    militar_quadro: 'QPTBM',
    matricula_documental: 'DOC-1',
    matricula_operacional: 'OP-2',
    matricula: 'LEG-3',
  });

  assert.equal(vars.matricula, 'DOC-1');
});

test('buildTemplateVarsContrato usa fallback de matrícula para "-"', () => {
  const vars = buildTemplateVarsContrato({ militar_posto: 'Capitão' });
  assert.equal(vars.matricula, '-');
});

test('composeTemplateVarsRP preserva matrícula específica do RP', () => {
  const vars = composeTemplateVarsRP({
    formData: { campo_legado: 'ok', matricula: 'FORM-1' },
    sourceRP: { matricula_documental: 'DOC-2' },
    rpSpecificOverrides: { matricula: 'RP-3', militar_matricula: 'RP-3' },
  });

  assert.equal(vars.matricula, 'RP-3');
  assert.equal(vars.militar_matricula, 'RP-3');
});

test('composeTemplateVarsRP preserva usuário/unidade/grupamento e mantém variáveis canônicas + legado', () => {
  const vars = composeTemplateVarsRP({
    formData: { campo_legado: 'valor-legado' },
    sourceRP: {
      nome_completo: 'Maria Silva',
      militar_posto: 'Capitão',
      militar_quadro: 'QOBM',
      matricula: '123',
    },
    rpSpecificOverrides: {
      usuario_nome: 'Operador',
      usuario_email: 'operador@corp.mil',
      grupamento_id: 'g-1',
      subgrupamento_id: 'sg-1',
      subgrupamento_tipo: 'tipo-1',
      unidade_id: 'u-1',
      numero_bg_ref: '100',
      data_bg_ref: '10 de maio de 2026',
      nota_ref: 'Nota X',
    },
  });

  assert.equal(vars.campo_legado, 'valor-legado');
  assert.equal(vars.nome_completo, 'Maria Silva');
  assert.equal(vars.posto, 'Cap');
  assert.equal(vars.quadro, 'QOBM');
  assert.equal(vars.usuario_nome, 'Operador');
  assert.equal(vars.usuario_email, 'operador@corp.mil');
  assert.equal(vars.grupamento_id, 'g-1');
  assert.equal(vars.subgrupamento_id, 'sg-1');
  assert.equal(vars.subgrupamento_tipo, 'tipo-1');
  assert.equal(vars.unidade_id, 'u-1');
  assert.equal(vars.numero_bg_ref, '100');
  assert.equal(vars.data_bg_ref, '10 de maio de 2026');
  assert.equal(vars.nota_ref, 'Nota X');
});
