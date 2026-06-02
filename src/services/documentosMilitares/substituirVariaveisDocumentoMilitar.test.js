import assert from 'node:assert/strict';
import test from 'node:test';

import { substituirVariaveisDocumentoMilitar } from './substituirVariaveisDocumentoMilitar.js';

test('substitui placeholders aceitando espaços internos e ocorrências repetidas', () => {
  const resultado = substituirVariaveisDocumentoMilitar(
    '{{ nome_completo }} - {{posto_graduacao}} - {{nome_completo}}',
    { nome_completo: 'Maria da Silva', posto_graduacao: 'Capitão' }
  );

  assert.equal(resultado, 'Maria da Silva - Capitão - Maria da Silva');
});

test('substitui variáveis ausentes ou não textuais por string vazia', () => {
  const resultado = substituirVariaveisDocumentoMilitar(
    'CPF: {{cpf}} / ausente: {{nao_existe}} / objeto: {{objeto}} / zero: {{zero}}',
    { cpf: null, objeto: { valor: 'não deve vazar' }, zero: 0 }
  );

  assert.equal(resultado, 'CPF:  / ausente:  / objeto:  / zero: 0');
});

test('retorna texto vazio quando o template não é uma string', () => {
  assert.equal(substituirVariaveisDocumentoMilitar(null, { nome_completo: 'Maria' }), '');
});

test('pode manter placeholders desconhecidos evidentes para preview administrativo', () => {
  assert.equal(
    substituirVariaveisDocumentoMilitar('Nome: {{nome_completo}} / {{revisar}}', { nome_completo: 'Maria' }, { manterDesconhecidas: true }),
    'Nome: Maria / {{revisar}}'
  );
});
