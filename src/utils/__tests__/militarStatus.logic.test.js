import { test } from 'node:test';
import assert from 'node:assert';
import { isMilitarAtivo } from '../militarStatus.js';

test('isMilitarAtivo: identifies inactive military correctly', () => {
  const inactiveMilitar = {
    id: '123',
    nome_completo: 'Matheus Angelo do Nascimento Cristaldo',
    matricula: '508.859-021',
    status_cadastro: 'Inativo'
  };
  assert.strictEqual(isMilitarAtivo(inactiveMilitar), false, 'Should be inactive with status_cadastro: Inativo');

  const inactiveMilitar2 = {
    ativo: false
  };
  assert.strictEqual(isMilitarAtivo(inactiveMilitar2), false, 'Should be inactive with ativo: false');

  const inactiveMilitar3 = {
    status: 'Inativa'
  };
  assert.strictEqual(isMilitarAtivo(inactiveMilitar3), false, 'Should be inactive with status: Inativa');

  const inactiveMilitar4 = {
    status_do_cadastro: 'inactive'
  };
  assert.strictEqual(isMilitarAtivo(inactiveMilitar4), false, 'Should be inactive with status_do_cadastro: inactive');
});

test('isMilitarAtivo: identifies active military correctly', () => {
  const activeMilitar = {
    status_cadastro: 'Ativo'
  };
  assert.strictEqual(isMilitarAtivo(activeMilitar), true, 'Should be active with status_cadastro: Ativo');

  const activeMilitar2 = {
    ativo: true
  };
  assert.strictEqual(isMilitarAtivo(activeMilitar2), true, 'Should be active with ativo: true');

  const activeMilitar3 = {
    status_cadastro: ''
  };
  assert.strictEqual(isMilitarAtivo(activeMilitar3), true, 'Should be active by default if no indication of inactivity');

  const activeMilitar4 = {
    status_cadastro: 'Ativa'
  };
  assert.strictEqual(isMilitarAtivo(activeMilitar4), true, 'Should be active with status_cadastro: Ativa (not in VALORES_INATIVOS)');
});
