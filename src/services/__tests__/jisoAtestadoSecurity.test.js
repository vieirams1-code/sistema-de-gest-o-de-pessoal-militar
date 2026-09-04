import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (relative) => readFileSync(new URL(relative, import.meta.url), 'utf8');

const backend = read('../../../base44/functions/cudJisoAtestado/entry.ts');
const jisoSchema = JSON.parse(read('../../../entities/JISO.json'));
const vinculoSchema = JSON.parse(read('../../../entities/JISOAtestado.json'));
const client = read('../jisoAtestadoCudClient.js');

test('JISO pode existir sem atestado e mantém militar como vínculo obrigatório', () => {
  assert.deepEqual(jisoSchema.required, ['militar_id']);
  assert.ok(jisoSchema.properties.atestado_id);
  assert.match(jisoSchema.properties.atestado_id.description, /legado/i);
});

test('JISOAtestado exige identidade completa do relacionamento', () => {
  assert.deepEqual(vinculoSchema.required, ['jiso_id', 'atestado_id', 'militar_id']);
  assert.equal(vinculoSchema.properties.ativo.default, true);
  assert.ok(vinculoSchema.properties.resultado_atestado);
  assert.ok(vinculoSchema.properties.dias_homologados);
});

test('portão JISOAtestado reutiliza permissões e escopo canônicos', () => {
  assert.match(backend, /base44\.functions\.invoke\('getUserPermissions', payload\)/);
  assert.match(backend, /base44\.functions\.invoke\('getScopedAtestadosBundle', payload\)/);
  assert.match(backend, /ACTION_GERIR_JISO = 'gerir_jiso'/);
  assert.match(backend, /ACTION_REGISTRAR_DECISAO = 'registrar_decisao_jiso'/);
});

test('portão rejeita vínculo entre JISO e atestado de militares diferentes', () => {
  assert.match(backend, /militarJiso !== militarAtestado/);
  assert.match(backend, /JISO_ATESTADO_MILITAR_DIVERGENTE/);
  assert.match(backend, /ATESTADO_OUT_OF_SCOPE/);
});

test('portão impede vínculo ativo duplicado', () => {
  assert.match(backend, /entities\.JISOAtestado\.filter\(\{[\s\S]*jiso_id: jisoId,[\s\S]*atestado_id: atestadoId,[\s\S]*ativo: true/);
  assert.match(backend, /JISO_ATESTADO_VINCULO_DUPLICADO/);
});

test('identidade do vínculo é imutável e desvinculação é auditável', () => {
  assert.match(backend, /CAMPOS_IDENTIDADE = new Set\(\['jiso_id', 'atestado_id', 'militar_id'\]\)/);
  assert.match(backend, /VINCULO_IDENTITY_IMMUTABLE/);
  assert.match(backend, /ativo: false/);
  assert.match(backend, /desvinculado_em: new Date\(\)\.toISOString\(\)/);
  assert.doesNotMatch(backend, /entities\.JISOAtestado\.delete\(/);
});

test('cliente frontend usa somente o portão dedicado', () => {
  assert.match(client, /base44\.functions\.invoke\('cudJisoAtestado', finalPayload\)/);
  assert.match(client, /operation: 'create'/);
  assert.match(client, /operation: 'update'/);
  assert.match(client, /operation: 'delete'/);
  assert.doesNotMatch(client, /base44\.entities\.JISOAtestado/);
});
