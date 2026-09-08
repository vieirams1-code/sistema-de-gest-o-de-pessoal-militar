import test from 'node:test';
import assert from 'node:assert/strict';
import { canShowArmamentosTab, canShowAtestadosTab } from '../militarFichaTabsVisibility.js';

const denyModule = () => false;
const denyAction = () => false;
const allowModule = (allowed) => (moduleKey) => moduleKey === allowed;
const allowAction = (allowed) => (actionKey) => actionKey === allowed;

test('canShowAtestadosTab exige módulo e visualizar_atestados', () => {
  assert.equal(canShowAtestadosTab({ canAccessModule: allowModule('atestados'), canAccessAction: allowAction('visualizar_atestados') }), true);
  assert.equal(canShowAtestadosTab({ atestados: [{ id: 'a1' }], canAccessModule: denyModule, canAccessAction: denyAction }), false);
  assert.equal(canShowAtestadosTab({ isLoadingAtestados: true, canAccessModule: denyModule, canAccessAction: denyAction }), false);
  assert.equal(canShowAtestadosTab({ canAccessModule: allowModule('atestados'), canAccessAction: denyAction }), false);
  assert.equal(canShowAtestadosTab({ canAccessModule: denyModule, canAccessAction: allowAction('visualizar_atestados') }), false);
  assert.equal(canShowAtestadosTab({ canAccessModule: denyModule, canAccessAction: allowAction('ver_dados_sensiveis_atestado') }), false);
});

test('canShowArmamentosTab exige módulo e visualizar_armamentos', () => {
  assert.equal(canShowArmamentosTab({ canAccessModule: allowModule('armamentos'), canAccessAction: allowAction('visualizar_armamentos') }), true);
  assert.equal(canShowArmamentosTab({ armamentos: [{ id: 'ar1' }], canAccessModule: denyModule, canAccessAction: denyAction }), false);
  assert.equal(canShowArmamentosTab({ isLoadingArmamentos: true, canAccessModule: denyModule, canAccessAction: denyAction }), false);
  assert.equal(canShowArmamentosTab({ canAccessModule: allowModule('armamentos'), canAccessAction: denyAction }), false);
  assert.equal(canShowArmamentosTab({ canAccessModule: denyModule, canAccessAction: allowAction('visualizar_armamentos') }), false);
  assert.equal(canShowArmamentosTab({ canAccessModule: denyModule, canAccessAction: allowAction('editar_armamentos') }), false);
});
