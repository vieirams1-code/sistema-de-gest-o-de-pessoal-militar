import test from 'node:test';
import assert from 'node:assert/strict';

import { buildTemplateVarsContrato } from './templateContratoUtils.js';

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
