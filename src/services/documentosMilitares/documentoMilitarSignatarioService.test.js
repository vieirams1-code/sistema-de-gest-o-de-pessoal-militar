import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizarSignatarioMilitar } from './documentoMilitarSignatarioService.js';

test('normaliza militar signatário para campos textuais editáveis', () => {
  assert.deepEqual(normalizarSignatarioMilitar({
    nome_completo: 'João Souza',
    posto_graduacao: 'Major',
    matricula_atual: '123456',
    funcao_atual: 'Comandante',
    lotacao_atual: { nome: '1º GBM' },
  }), {
    nomeSignatario: 'João Souza',
    cargoSignatario: 'Major - Comandante / 1º GBM',
    matriculaSignatario: '123456',
  });
});

