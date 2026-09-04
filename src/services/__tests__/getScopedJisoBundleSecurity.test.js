import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const backend = readFileSync(
  new URL('../../../base44/functions/getScopedJisoBundle/entry.ts', import.meta.url),
  'utf8',
);
const client = readFileSync(new URL('../getScopedJisoBundleClient.js', import.meta.url), 'utf8');

test('bundle JISO exige capacidade funcional JISO', () => {
  assert.match(backend, /ACTIONS_JISO = \['gerir_jiso', 'registrar_decisao_jiso', 'publicar_ata_jiso'\]/);
  assert.match(backend, /JISO_PERMISSION_REQUIRED/);
});

test('bundle deriva escopo diretamente dos militares permitidos', () => {
  assert.match(backend, /functions\.invoke\('getScopedMilitares'/);
  assert.match(backend, /militarIds\.has\(normalizeId\(item\?\.militar_id\)\)/);
});

test('bundle inclui JISO sem depender de atestado_id', () => {
  assert.match(backend, /const jisos = allJisos\.filter/);
  assert.doesNotMatch(backend, /const jisos = allJisos\.filter\([\s\S]*atestado_id/);
});

test('bundle projeta atestado sem CID ou dados médicos sensíveis', () => {
  assert.match(backend, /function projectAtestado/);
  assert.doesNotMatch(backend, /cid_10:/);
  assert.doesNotMatch(backend, /cid_descricao:/);
  assert.doesNotMatch(backend, /medico_nome_snapshot:/);
  assert.match(backend, /sensitive_medical_fields_returned: false/);
});

test('bundle mantém compatibilidade com vínculo legado', () => {
  assert.match(backend, /const legadoId = normalizeId\(jiso\?\.atestado_id\)/);
  assert.match(backend, /include_legacy_links: true/);
});

test('cliente injeta effectiveEmail e usa função escopada', () => {
  assert.match(client, /getEffectiveEmail\(\)/);
  assert.match(client, /functions\.invoke\('getScopedJisoBundle', finalPayload\)/);
  assert.doesNotMatch(client, /base44\.entities\.JISO/);
});
