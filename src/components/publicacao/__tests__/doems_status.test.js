import { test } from 'node:test';
import assert from 'node:assert';
import { calcularStatusPublicacaoRegistro, STATUS_PUBLICACAO } from '../publicacaoStateMachine.js';

test('calcularStatusPublicacaoRegistro - DOEMS deve retornar Publicado mesmo sem BG', () => {
  const registroDOEMS = {
    tipo_registro: 'Registro de Publicação DOEMS'
  };

  const status = calcularStatusPublicacaoRegistro(registroDOEMS);
  assert.strictEqual(status, STATUS_PUBLICACAO.PUBLICADO);
});

test('calcularStatusPublicacaoRegistro - Tipo comum sem nota nem BG deve retornar Aguardando Nota', () => {
  const registroComum = {
    tipo_registro: 'Elogio Individual'
  };

  const status = calcularStatusPublicacaoRegistro(registroComum);
  assert.strictEqual(status, STATUS_PUBLICACAO.AGUARDANDO_NOTA);
});

test('calcularStatusPublicacaoRegistro - Tipo comum com nota deve retornar Aguardando Publicação', () => {
  const registroComum = {
    tipo_registro: 'Elogio Individual',
    nota_para_bg: '01'
  };

  const status = calcularStatusPublicacaoRegistro(registroComum);
  assert.strictEqual(status, STATUS_PUBLICACAO.AGUARDANDO_PUBLICACAO);
});

test('calcularStatusPublicacaoRegistro - Tipo comum com BG deve retornar Publicado', () => {
  const registroComum = {
    tipo_registro: 'Elogio Individual',
    numero_bg: '123',
    data_bg: '2023-01-01'
  };

  const status = calcularStatusPublicacaoRegistro(registroComum);
  assert.strictEqual(status, STATUS_PUBLICACAO.PUBLICADO);
});
