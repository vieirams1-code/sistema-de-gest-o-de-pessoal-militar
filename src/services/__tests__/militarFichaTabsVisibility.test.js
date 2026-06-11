import test from 'node:test';
import assert from 'node:assert/strict';
import { canShowArmamentosTab, canShowAtestadosTab } from '../militarFichaTabsVisibility.js';

const denyModule = () => false;
const denyAction = () => false;
const allowModule = (allowed) => (moduleKey) => moduleKey === allowed;
const allowAction = (allowed) => (actionKey) => actionKey === allowed;

test('canShowAtestadosTab exibe quando há atestados', () => {
  assert.equal(canShowAtestadosTab({ atestados: [{ id: 'a1' }], canAccessModule: denyModule, canAccessAction: denyAction }), true);
});

test('canShowAtestadosTab exibe para permissão sensível/de gestão de atestados', () => {
  assert.equal(canShowAtestadosTab({ canAccessModule: allowModule('atestados'), canAccessAction: denyAction }), true);
  assert.equal(canShowAtestadosTab({ canAccessModule: denyModule, canAccessAction: allowAction('ver_dados_sensiveis_atestado') }), true);
  assert.equal(canShowAtestadosTab({ canAccessModule: denyModule, canAccessAction: allowAction('gerir_encaminhamento_dp_dintel_atestado') }), true);
});

test('canShowAtestadosTab oculta sem dados, sem carregamento e sem permissão relevante', () => {
  assert.equal(canShowAtestadosTab({ atestados: [], canAccessModule: denyModule, canAccessAction: denyAction }), false);
});

test('canShowArmamentosTab exibe quando há armamentos', () => {
  assert.equal(canShowArmamentosTab({ armamentos: [{ id: 'ar1' }], canAccessModule: denyModule, canAccessAction: denyAction }), true);
});

test('canShowArmamentosTab exibe para permissão de consulta/gestão de armamentos', () => {
  assert.equal(canShowArmamentosTab({ canAccessModule: allowModule('armamentos'), canAccessAction: denyAction }), true);
  assert.equal(canShowArmamentosTab({ canAccessModule: denyModule, canAccessAction: allowAction('visualizar_armamentos') }), true);
  assert.equal(canShowArmamentosTab({ canAccessModule: denyModule, canAccessAction: allowAction('editar_armamentos') }), true);
});

test('canShowArmamentosTab oculta sem dados, sem carregamento e sem permissão relevante', () => {
  assert.equal(canShowArmamentosTab({ armamentos: [], canAccessModule: denyModule, canAccessAction: denyAction }), false);
});

test('abas permanecem visíveis durante carregamento para evitar fallback prematuro de URL direta', () => {
  assert.equal(canShowAtestadosTab({ isLoadingAtestados: true, canAccessModule: denyModule, canAccessAction: denyAction }), true);
  assert.equal(canShowArmamentosTab({ isLoadingArmamentos: true, canAccessModule: denyModule, canAccessAction: denyAction }), true);
});
