import test from 'node:test';
import assert from 'node:assert/strict';

import { construirSugestaoSistema } from '../../components/migracao-alteracoes-legado/sugestaoSistemaHelper.js';

test('construirSugestaoSistema prioriza sugestão existente e converte confiança textual', () => {
  const linha = {
    transformado: {
      materia_legado: 'HOMOLOGAÇÃO DE ATESTADO MÉDICO',
      conteudo_trecho_legado: 'Homologação de atestado médico para tratamento.',
      tipo_publicacao_sugerido: 'Homologação de Atestado',
      confianca_classificacao: 'ALTA',
    },
  };

  const resultado = construirSugestaoSistema(linha, ['Homologação de Atestado', 'Ata JISO', 'Concessão de Férias']);

  assert.equal(resultado.principal.tipo, 'Homologação de Atestado');
  assert.ok(resultado.principal.confianca >= 92);
  assert.ok(resultado.secundarias.length <= 2);
});

test('construirSugestaoSistema usa heurística determinística quando não há sugestão prévia', () => {
  const linha = {
    transformado: {
      materia_legado: 'CONCESSÃO DE FÉRIAS',
      conteudo_trecho_legado: 'Concedo férias regulamentares ao militar.',
      tipo_publicacao_confirmado: '',
      confianca_classificacao: '',
    },
  };

  const resultado = construirSugestaoSistema(linha, ['Concessão de Férias', 'Licença Especial']);

  assert.equal(resultado.principal.tipo, 'Concessão de Férias');
  assert.ok(resultado.principal.confianca >= 35);
});
