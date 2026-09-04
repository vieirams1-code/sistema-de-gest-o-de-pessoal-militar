import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  new URL('../../../base44/functions/aplicarMigracaoJisoIndependente/entry.ts', import.meta.url),
  'utf8',
);

test('aplicação exige admin real e confirmação literal', () => {
  assert.match(source, /String\(authUser\.role \|\| ''\)\.toLowerCase\(\) !== 'admin'/);
  assert.match(source, /CONFIRMACAO_EXATA = 'APLICAR_MIGRACAO_JISO_INDEPENDENTE_V1'/);
  assert.match(source, /MIGRATION_CONFIRMATION_REQUIRED/);
});

test('migração não altera nem exclui atestados legados', () => {
  assert.doesNotMatch(source, /entities\.Atestado\.update\(/);
  assert.doesNotMatch(source, /entities\.Atestado\.delete\(/);
  assert.match(source, /atestados_alterados: 0/);
  assert.match(source, /atestados_legados_preservados: true/);
});

test('migração nunca funde ou exclui JISOs', () => {
  assert.doesNotMatch(source, /entities\.JISO\.delete\(/);
  assert.match(source, /jisos_fundidas: 0/);
  assert.match(source, /jisos_excluidas: 0/);
  assert.match(source, /nenhuma_fusao_automatica: true/);
});

test('migração cria vínculo legado e é reexecutável', () => {
  assert.match(source, /origem_vinculo: 'migracao_legado'/);
  assert.match(source, /vinculoAtivoKey\.has\(key\)/);
  assert.match(source, /vinculoAtivoKey\.add\(key\)/);
  assert.match(source, /reexecucao_idempotente_para_vinculos: true/);
});

test('migração bloqueia JISO e atestado de militares divergentes', () => {
  assert.match(source, /militarJiso !== militarAtestado/);
  assert.match(source, /MILITAR_DIVERGENTE/);
});

test('migração move apenas dados ausentes para a JISO', () => {
  assert.match(source, /function addCopyIfMissing/);
  assert.match(source, /!hasValue\(currentValue\) && hasValue\(legacyValue\)/);
  assert.match(source, /entities\.JISO\.update\(jisoId, patchJiso\)/);
});
