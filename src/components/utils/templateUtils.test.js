import test from 'node:test';
import assert from 'node:assert/strict';

import { buildVarsLivro } from './templateUtils.jsx';

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
});
