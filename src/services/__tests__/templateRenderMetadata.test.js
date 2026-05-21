import test from 'node:test';
import assert from 'node:assert/strict';

import { TEMPLATE_SOURCE_OF_TRUTH } from '../../constants/templateGovernance.js';
import { buildTemplateHash, buildTemplateRenderMetadata, parseTemplateRenderMetadata } from '../templateRenderMetadata.js';

test('retorna null quando template ausente', () => {
  assert.equal(buildTemplateRenderMetadata({ template: null }), null);
  assert.equal(buildTemplateRenderMetadata({ template: {} }), null);
});

test('retorna shape esperado com template presente', () => {
  const result = buildTemplateRenderMetadata({
    template: { id: 'tpl-1', nome: 'Template RP', tipo_registro: 'RP', modulo: 'livro', template: '  TEXTO\r\n' },
    user: { full_name: 'Usuário Teste' },
    sourceOfTruth: TEMPLATE_SOURCE_OF_TRUTH.MANUAL_OVERRIDE,
  });

  assert.equal(result.template_id, 'tpl-1');
  assert.equal(result.template_nome, 'Template RP');
  assert.equal(result.template_tipo, 'RP');
  assert.equal(result.template_modulo, 'livro');
  assert.equal(typeof result.template_hash, 'string');
  assert.equal(result.template_hash.length, 64);
  assert.equal(result.rendered_by, 'Usuário Teste');
  assert.equal(result.source_of_truth, TEMPLATE_SOURCE_OF_TRUTH.MANUAL_OVERRIDE);
  assert.equal(Number.isNaN(Date.parse(result.rendered_at)), false);
});

test('gera mesmo hash para conteúdo semanticamente igual após normalização', () => {
  const a = buildTemplateHash('  Linha A\r\nLinha B  ');
  const b = buildTemplateHash('Linha A\nLinha B');
  assert.equal(a, b);
});

test('gera hash diferente quando template muda', () => {
  const a = buildTemplateHash('Linha A\nLinha B');
  const b = buildTemplateHash('Linha A\nLinha C');
  assert.notEqual(a, b);
});

test('retorna hash null quando template não possui conteúdo', () => {
  assert.equal(buildTemplateHash('   \n\r\n  '), null);
  const metadata = buildTemplateRenderMetadata({ template: { id: 'x', nome: 'Sem Conteúdo' } });
  assert.equal(metadata.template_hash, null);
});

test('retorna objeto serializável e preserva source_of_truth', () => {
  const result = buildTemplateRenderMetadata({
    template: { id: '1', nome: 'Template A' },
    sourceOfTruth: 'custom_source',
  });

  assert.doesNotThrow(() => JSON.stringify(result));
  assert.equal(result.source_of_truth, 'custom_source');
});

test('faz parse de metadata_json quando metadata objeto não existe', () => {
  const result = parseTemplateRenderMetadata(null, JSON.stringify({ template_nome: 'Template Livro' }));
  assert.deepEqual(result, { template_nome: 'Template Livro' });
});

test('mantém compatibilidade retroativa com metadata antiga e nova', () => {
  const legado = { template_nome: 'Template Legado', template_tipo: 'RP' };
  const novo = { ...legado, template_id: 'tpl-123', template_hash: 'abc' };

  assert.deepEqual(parseTemplateRenderMetadata(legado), legado);
  assert.deepEqual(parseTemplateRenderMetadata(novo), novo);
});
