import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const backend = readFileSync(
  new URL('../../../base44/functions/notificarJisoIndependenteWhatsAppTemplate/entry.ts', import.meta.url),
  'utf8',
);
const client = readFileSync(new URL('../jisoWhatsAppClient.js', import.meta.url), 'utf8');

test('WhatsApp independente usa jiso_id e não exige atestado_id', () => {
  assert.match(backend, /const jisoId = normalizeText\(payload\?\.jiso_id\)/);
  assert.match(backend, /jiso_id obrigatório/);
  assert.doesNotMatch(backend, /atestado_id obrigatório/);
});

test('convocação exige gerir_jiso e valida escopo do militar', () => {
  assert.match(backend, /ACTION_GERIR_JISO = 'gerir_jiso'/);
  assert.match(backend, /functions\.invoke\('getUserPermissions', payload\)/);
  assert.match(backend, /functions\.invoke\('getScopedMilitares'/);
  assert.match(backend, /JISO fora do escopo permitido/);
});

test('data e hora da convocação vêm da JISO', () => {
  assert.match(backend, /const dataJiso = normalizeText\(jiso\?\.data_jiso\)/);
  assert.match(backend, /const horaJiso = normalizeText\(jiso\?\.hora_jiso\)/);
  assert.doesNotMatch(backend, /atestado\.data_jiso_agendada/);
});

test('tracking do WhatsApp é persistido na JISO e não no atestado', () => {
  assert.match(backend, /entities\.JISO\.update\(jisoId, \{/);
  assert.match(backend, /jiso_whatsapp_status: 'enviado'/);
  assert.match(backend, /jiso_whatsapp_mensagem: mensagemFinal/);
  assert.doesNotMatch(backend, /entities\.Atestado\.update\(/);
});

test('template suporta variáveis próprias da JISO e resumo de múltiplos atestados', () => {
  for (const field of ['finalidade_jiso', 'motivo_jiso', 'local_jiso', 'secao_jiso', 'quantidade_atestados', 'resumo_atestados']) {
    assert.match(backend, new RegExp(`${field}:`));
  }
  assert.match(backend, /ATESTADO_ONLY_VARS/);
  assert.match(backend, /atestados\.length !== 1/);
});

test('envio exige nova prévia quando dados relevantes da JISO mudam', () => {
  assert.match(backend, /data_jiso_snapshot/);
  assert.match(backend, /hora_jiso_snapshot/);
  assert.match(backend, /local_jiso_snapshot/);
  assert.match(backend, /finalidade_jiso_snapshot/);
  assert.match(backend, /Os dados de convocação da JISO mudaram após a prévia/);
});

test('cliente usa somente a função independente', () => {
  assert.match(client, /notificarJisoIndependenteWhatsAppTemplate/);
  assert.doesNotMatch(client, /notificarJisoWhatsAppTemplate/);
  assert.match(client, /action: 'preview'/);
  assert.match(client, /action: 'send'/);
});
