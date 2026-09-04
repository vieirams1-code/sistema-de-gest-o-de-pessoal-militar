import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const backend = readFileSync(
  new URL('../../../base44/functions/cudJiso/entry.ts', import.meta.url),
  'utf8',
);
const client = readFileSync(new URL('../jisoCudClient.js', import.meta.url), 'utf8');

test('criação de JISO exige gerir_jiso e não registrar decisão', () => {
  assert.match(backend, /ACTION_GERIR = 'gerir_jiso'/);
  assert.match(backend, /Permissão gerir_jiso é obrigatória para criar\/agendar JISO/);
});

test('JISO é escopada pelo militar sem depender de atestado', () => {
  assert.match(backend, /functions\.invoke\('getScopedMilitares'/);
  assert.match(backend, /militarIds: \[militarId\]/);
  assert.doesNotMatch(backend, /atestado_id: data/);
});

test('atualização separa gestão, decisão e publicação', () => {
  assert.match(backend, /CAMPOS_GESTAO/);
  assert.match(backend, /CAMPOS_DECISAO/);
  assert.match(backend, /CAMPOS_PUBLICACAO/);
  assert.match(backend, /ACTION_DECISAO = 'registrar_decisao_jiso'/);
  assert.match(backend, /ACTION_PUBLICAR = 'publicar_ata_jiso'/);
});

test('identidade e tracking WhatsApp não podem ser alterados pela rota genérica', () => {
  assert.match(backend, /CAMPOS_BLOQUEADOS/);
  for (const field of ['atestado_id', 'militar_id', 'jiso_whatsapp_enviado_em', 'jiso_whatsapp_mensagem']) {
    assert.match(backend, new RegExp(`'${field}'`));
  }
  assert.match(backend, /JISO_FIELD_IMMUTABLE/);
});

test('cliente usa somente cudJiso', () => {
  assert.match(client, /functions\.invoke\('cudJiso', finalPayload\)/);
  assert.doesNotMatch(client, /base44\.entities\.JISO/);
});
