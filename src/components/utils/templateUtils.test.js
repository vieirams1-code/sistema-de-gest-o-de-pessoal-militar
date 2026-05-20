import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildVarsLivro,
  montarPostoNomeTemplate,
  resolveQuadroTemplate,
} from './templateUtils.jsx';

test('buildVarsLivro expõe quadro_nome sem quebrar posto_nome legado', () => {
  const vars = buildVarsLivro({
    ferias: {
      militar_posto: 'Capitão',
      militar_quadro: 'QOBM',
      militar_nome: 'João da Silva',
      militar_matricula: '123456',
      data_inicio: '2026-04-01',
      data_fim: '2026-04-30',
      dias: 30,
      periodo_aquisitivo_ref: '2024/2025',
    },
  });

  assert.equal(vars.posto_nome, 'Cap QOBM');
  assert.equal(vars.posto, 'Cap');
  assert.equal(vars.quadro_nome, 'QOBM');
  assert.equal(vars.militar_quadro, 'QOBM');
});

test('resolveQuadroTemplate retorna QPTBM quando quadro real existir', () => {
  assert.equal(resolveQuadroTemplate({ quadro_nome: 'QPTBM' }), 'QPTBM');
});

test('resolveQuadroTemplate retorna QOBM quando quadro real existir', () => {
  assert.equal(resolveQuadroTemplate({ militar_quadro: 'QOBM' }), 'QOBM');
});

test('resolveQuadroTemplate não inventa fallback QOBM quando ausência de quadro', () => {
  assert.equal(resolveQuadroTemplate({}), '');
});

test('montarPostoNomeTemplate compõe posto + quadro', () => {
  assert.equal(montarPostoNomeTemplate({ abreviatura: 'Cap', quadro: 'QPTBM' }), 'Cap QPTBM');
});

test('montarPostoNomeTemplate retorna somente posto quando quadro não existe', () => {
  assert.equal(montarPostoNomeTemplate({ abreviatura: 'Cap', quadro: '' }), 'Cap');
});
