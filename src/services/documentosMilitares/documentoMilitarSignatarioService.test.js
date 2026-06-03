import assert from 'node:assert/strict';
import test from 'node:test';

import {
  montarAssinaturaSignatario,
  montarVariaveisSignatarioDocumentoMilitar,
  normalizarSignatarioMilitar,
} from './documentoMilitarSignatarioService.js';

test('normaliza militar signatário para campos textuais editáveis', () => {
  assert.deepEqual(normalizarSignatarioMilitar({
    nome_completo: 'João Souza',
    posto_graduacao: 'Major',
    matricula_atual: '123456',
    funcao_atual: 'Comandante',
    lotacao_atual: { nome: '1º GBM' },
    quadro: 'QOBM',
  }), {
    nomeSignatario: 'João Souza',
    postoGraduacaoSignatario: 'Major',
    quadroSignatario: 'QOBM',
    funcaoSignatario: 'Comandante/1º GBM',
    cargoSignatario: 'Major - Comandante / 1º GBM',
    matriculaSignatario: '123456',
  });
});

test('monta assinatura institucional do signatário em até três linhas sem campos vazios', () => {
  assert.equal(montarAssinaturaSignatario({
    nome: 'Edson Vieira de Souza',
    postoGraduacao: '2º TEN',
    quadro: 'QOBM',
    matricula: '108.747-021',
    funcao: 'Chefe da B1/1ºGBM/CBMMS',
  }), 'Edson Vieira de Souza - 2º TEN QOBM\nMatrícula 108.747-021\nChefe da B1/1ºGBM/CBMMS');

  assert.equal(montarAssinaturaSignatario({
    nome: 'Edson Vieira de Souza',
    postoGraduacao: '2º TEN',
    quadro: 'QOBM',
    matricula: '108.747-021',
  }), 'Edson Vieira de Souza - 2º TEN QOBM\nMatrícula 108.747-021');
});

test('monta variáveis canônicas do signatário preservando aliases antigos da configuração', () => {
  assert.deepEqual(montarVariaveisSignatarioDocumentoMilitar({
    nomeSignatario: 'Edson Vieira de Souza',
    postoGraduacaoSignatario: '2º TEN',
    quadroSignatario: 'QOBM',
    matriculaSignatario: '108.747-021',
    funcaoSignatario: 'Chefe da B1/1ºGBM/CBMMS',
  }), {
    signatario_nome: 'Edson Vieira de Souza',
    signatario_posto_graduacao: '2º TEN',
    signatario_quadro: 'QOBM',
    signatario_matricula: '108.747-021',
    signatario_funcao: 'Chefe da B1/1ºGBM/CBMMS',
    assinatura_signatario: 'Edson Vieira de Souza - 2º TEN QOBM\nMatrícula 108.747-021\nChefe da B1/1ºGBM/CBMMS',
  });
});
