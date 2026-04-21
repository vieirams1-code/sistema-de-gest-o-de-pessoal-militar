import test from 'node:test';
import assert from 'node:assert/strict';

import {
  filtrarPendenciasComportamentoDashboard,
  listarInconsistenciasCadastraisDashboard,
} from '../dashboardMilitarPendenciasService.js';

test('dashboard ignora pendências de militar excluído, mesclado, inativo e órfã', () => {
  const militares = [
    { id: 'm-ativo', nome_completo: 'Ativo', status_cadastro: 'Ativo' },
    { id: 'm-mesclado', nome_completo: 'Mesclado', status_cadastro: 'Mesclado' },
    { id: 'm-inativo', nome_completo: 'Inativo', status_cadastro: 'Inativo' },
  ];

  const pendencias = [
    { id: 'p-ok', militar_id: 'm-ativo', status_pendencia: 'Pendente' },
    { id: 'p-mesclado', militar_id: 'm-mesclado', status_pendencia: 'Pendente' },
    { id: 'p-inativo', militar_id: 'm-inativo', status_pendencia: 'Pendente' },
    { id: 'p-orfa', militar_id: 'nao-existe', status_pendencia: 'Pendente' },
    { id: 'p-desc', militar_id: 'm-ativo', status_pendencia: 'Descartada' },
  ];

  const visiveis = filtrarPendenciasComportamentoDashboard(pendencias, militares);
  assert.deepEqual(visiveis.map((item) => item.id), ['p-ok']);
});

test('dashboard ignora inconsistências cadastrais de militar não operacional', () => {
  const militares = [
    { id: 'm-ativo', nome_completo: 'Ativo', status_cadastro: 'Ativo', cpf: '', data_nascimento: '' },
    { id: 'm-mesclado', nome_completo: 'Mesclado', status_cadastro: 'Mesclado', cpf: '', data_nascimento: '' },
    { id: 'm-inativo', nome_completo: 'Inativo', status_cadastro: 'Inativo', cpf: '', data_nascimento: '' },
  ];

  const inconsistencias = listarInconsistenciasCadastraisDashboard(militares);

  assert.ok(inconsistencias.length > 0);
  assert.ok(inconsistencias.every((item) => item.militarId === 'm-ativo'));
});
