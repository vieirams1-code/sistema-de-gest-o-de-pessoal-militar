import test from 'node:test';
import assert from 'node:assert/strict';

import {
  enriquecerMilitarComMatriculas,
  filtrarMilitaresOperacionais,
  isMilitarMesclado,
  militarCorrespondeBusca,
  montarIndiceMatriculas,
  resolverMatriculaAtual,
} from '../matriculaMilitarViewService.js';

test('exibe matrícula atual a partir da nova estrutura', () => {
  const militar = { id: 'm1', matricula: '111.111-111' };
  const indice = montarIndiceMatriculas([
    { id: 'a1', militar_id: 'm1', matricula: '111.111-111', is_atual: false, data_inicio: '2020-01-01' },
    { id: 'a2', militar_id: 'm1', matricula: '222.222-222', is_atual: true, data_inicio: '2024-01-01' },
  ]);

  const enriquecido = enriquecerMilitarComMatriculas(militar, indice);
  assert.equal(resolverMatriculaAtual(militar, enriquecido.matriculas_historico), '222.222-222');
  assert.equal(enriquecido.matricula_atual, '222.222-222');
});

test('busca encontra matrícula atual e histórica', () => {
  const militar = {
    id: 'm1',
    nome_completo: 'João da Silva',
    matricula_atual: '222.222-222',
    matriculas_historico: [
      { matricula: '111.111-111', matricula_normalizada: '111111111' },
      { matricula: '222.222-222', matricula_normalizada: '222222222' },
    ],
  };

  assert.equal(militarCorrespondeBusca(militar, '222.222-222'), true);
  assert.equal(militarCorrespondeBusca(militar, '111111111'), true);
  assert.equal(militarCorrespondeBusca(militar, 'joão'), true);
  assert.equal(militarCorrespondeBusca(militar, '999.999-999'), false);
});

test('militar mesclado é filtrado de fluxo operacional comum', () => {
  const base = [
    { id: 'ativo', status_cadastro: 'Ativo' },
    { id: 'mesclado-a', status_cadastro: 'Mesclado' },
    { id: 'mesclado-b', merged_into_id: 'destino' },
  ];

  const filtrados = filtrarMilitaresOperacionais(base, { incluirInativos: true });
  assert.deepEqual(filtrados.map((m) => m.id), ['ativo']);
  assert.equal(isMilitarMesclado(base[1]), true);
  assert.equal(isMilitarMesclado(base[2]), true);
});
