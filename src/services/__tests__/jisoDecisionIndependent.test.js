import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const backend = readFileSync(
  new URL('../../../base44/functions/registrarDecisaoJisoIndependente/entry.ts', import.meta.url),
  'utf8',
);
const client = readFileSync(new URL('../jisoDecisionClient.js', import.meta.url), 'utf8');

test('decisão exige registrar_decisao_jiso e escopo do militar', () => {
  assert.match(backend, /ACTION_DECISAO = 'registrar_decisao_jiso'/);
  assert.match(backend, /functions\.invoke\('getUserPermissions', payload\)/);
  assert.match(backend, /functions\.invoke\('getScopedMilitares'/);
  assert.match(backend, /JISO_OUT_OF_SCOPE/);
});

test('decisão exige efeito para todos os vínculos ativos', () => {
  assert.match(backend, /entities\.JISOAtestado\.filter\(\{/);
  assert.match(backend, /ativo: true/);
  assert.match(backend, /EFEITOS_INCOMPLETOS/);
  assert.match(backend, /links\.length !== effects\.length/);
});

test('decisão valida militar da JISO, vínculo e atestado antes das escritas', () => {
  assert.match(backend, /VINCULO_MILITAR_DIVERGENTE/);
  assert.match(backend, /ATESTADO_MILITAR_DIVERGENTE/);
  assert.match(backend, /plans\.push\(buildEffectPlan/);
});

test('JISOAtestado é fonte de verdade e Atestado recebe apenas reflexo legado', () => {
  assert.match(backend, /entities\.JISOAtestado\.update\(plan\.vinculo_id, plan\.vinculo_patch\)/);
  assert.match(backend, /entities\.Atestado\.update\(plan\.atestado_id, plan\.atestado_compat_patch\)/);
  assert.match(backend, /fonte_de_verdade: 'JISOAtestado'/);
});

test('dias homologados geram datas por atestado', () => {
  assert.match(backend, /dataTermino = addDaysIso\(atestado\.data_inicio, dias - 1\)/);
  assert.match(backend, /dataRetorno = addDaysIso\(atestado\.data_inicio, dias\)/);
  assert.match(backend, /dias_homologados: dias/);
});

test('JISO é marcada realizada somente após efeitos e reflexos', () => {
  const idxLinks = backend.indexOf('entities.JISOAtestado.update');
  const idxAtestados = backend.indexOf('entities.Atestado.update');
  const idxJiso = backend.indexOf('entities.JISO.update(jisoId, jisoPatch)');
  assert.ok(idxLinks > -1 && idxAtestados > idxLinks && idxJiso > idxAtestados);
  assert.match(backend, /status: 'Realizada'/);
});

test('falha parcial é explicitamente auditada e reexecutável', () => {
  assert.match(backend, /DECISAO_JISO_PARTIAL_WRITE/);
  assert.match(backend, /partial_write: true/);
  assert.match(backend, /decisao_jiso_parcial_falha/);
});

test('cliente envia snapshot de concorrência da JISO', () => {
  assert.match(client, /jiso_updated_date_snapshot: jiso\.updated_date \|\| ''/);
  assert.match(client, /registrarDecisaoJisoIndependente/);
});
