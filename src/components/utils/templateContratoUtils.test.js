import test from 'node:test';
import assert from 'node:assert/strict';

import { buildTemplateVarsContrato, composeTemplateVarsRP } from './templateContratoUtils.js';

test('buildTemplateVarsContrato retorna núcleo canônico com aliases coerentes', () => {
  const vars = buildTemplateVarsContrato({
    nome_completo: 'Carlos Lima',
    posto: 'CAP',
    quadro: 'QOBM',
    matricula: '111',
  });

  assert.deepEqual(vars, {
    nome_completo: 'Carlos Lima',
    posto: 'CAP',
    posto_nome: 'CAP QOBM',
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
  assert.equal(vars.posto, 'CAP');
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


test('buildTemplateVarsContrato normaliza posto/graduacao para maiúsculas e mantém quadro inalterado', () => {
  const casos = [
    { posto: 'Sd', quadro: 'QPBM', esperadoPosto: 'SD', esperadoPostoNome: 'SD QPBM' },
    { posto: '3º Sgt', quadro: 'QOBM', esperadoPosto: '3º SGT', esperadoPostoNome: '3º SGT QOBM' },
    { posto: '2º Tenente', quadro: 'QBMP 1.a', esperadoPosto: '2º TENENTE', esperadoPostoNome: '2º TENENTE QBMP 1.a' },
  ];

  for (const { posto, quadro, esperadoPosto, esperadoPostoNome } of casos) {
    const vars = buildTemplateVarsContrato({ posto, quadro });
    assert.equal(vars.posto, esperadoPosto);
    assert.equal(vars.posto_nome, esperadoPostoNome);
  }

  const quadroOriginal = 'qbmp 1.a';
  const varsQuadro = buildTemplateVarsContrato({ posto: 'Cap', quadro: quadroOriginal });
  assert.equal(varsQuadro.quadro, quadroOriginal);
  assert.equal(varsQuadro.quadro_nome, quadroOriginal);
  assert.equal(varsQuadro.militar_quadro, quadroOriginal);
});
