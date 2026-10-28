import test from 'node:test';
import assert from 'node:assert/strict';
import corpoNotaAuditoria from './corpoNotaAuditoria.js';
import { analisarBoletimContraRegistros } from './auditoriaPdf.js';
import { extrairNotasDasPaginas } from './extrairNotasTexto.js';

const militares = [
  { id: 'beneficiario', nome_completo: 'Joao Antonio da Silva', nome_guerra: 'SILVA', matricula: '123456-7', status_cadastro: 'Ativo' },
  { id: 'assinante', nome_completo: 'Maria Helena de Souza', nome_guerra: 'HELENA', matricula: '987654-3', status_cadastro: 'Ativo' },
];
const nota = { id: '12345:1', nota: '12345', contexto: 'NOTA N. 12345\nCURSO\nJoao Antonio da Silva concluiu o curso.\nAprovado por: Maria Helena de Souza\nASSINADO POR\nOutros atos: matricula 987654-3' };

test('somente o destinatário no corpo aparece, não a autoridade ou outro ato anexado', () => {
  const res = analisarBoletimContraRegistros([nota], militares, []);
  assert.deepEqual(res.ocorrencias.map(o => o.militar.id), ['beneficiario']);
  assert.equal(res.ocorrencias[0].nota.contexto, corpoNotaAuditoria(nota).contexto);
  assert.doesNotMatch(res.ocorrencias[0].nota.contexto, /Maria|Outros atos/);
  assert.match(nota.contexto, /Maria/); // Original intacto para a vinculação numérica.
});

test('assinatura e metadados não viram destinatários, mesmo por nome completo ou matrícula', () => {
  for (const marcador of ['ASSINADO POR', 'Assinatura digital', 'MILITARES RELACIONADOS COM A NOTA']) {
    const res = analisarBoletimContraRegistros([{ ...nota, contexto: 'NOTA N. 12345\nOutro militar concluiu o curso.\n' + marcador + '\nMaria Helena de Souza 987654-3' }], militares, []);
    assert.equal(res.ocorrencias.length, 0);
  }
});

test('preserva todos os destinatários e continuação legítima entre páginas', () => {
  const extraido = extrairNotasDasPaginas([
    { pagina: 1, texto: 'NOTA N. 12345\nJoao Antonio da Silva e' },
    { pagina: 2, texto: 'Maria Helena de Souza concluem o curso.\nAprovado por: outra autoridade\nNOTA N. 54321\nOutro assunto.' },
  ]);
  const res = analisarBoletimContraRegistros(extraido.notas, militares, [{ id: 'r1', militar_id: 'beneficiario', nota_para_bg: '12345' }]);
  assert.equal(res.ocorrencias.length, 2);
  assert.equal(res.ocorrencias.find(o => o.militar.id === 'beneficiario').status, 'registro_localizado');
  assert.equal(res.ocorrencias.find(o => o.militar.id === 'assinante').status, 'sem_registro');
  assert.match(res.ocorrencias[1].nota.contexto, /concluem o curso/);
});

test('matrícula continua suficiente mesmo com nome abreviado', () => {
  const res = analisarBoletimContraRegistros([{ ...nota, contexto: 'NOTA N. 12345\nConcede ferias ao Sgt J. A. Silva, matricula 123.456-7.' }], militares, []);
  assert.equal(res.ocorrencias[0].militar.id, 'beneficiario');
  assert.equal(res.ocorrencias[0].criterio, 'Matrícula');
});