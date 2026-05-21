import test from 'node:test';
import assert from 'node:assert/strict';

import { TEMPLATE_SOURCE_OF_TRUTH } from '../../constants/templateGovernance.js';
import { buildTemplateRenderMetadata, parseTemplateRenderMetadata } from '../templateRenderMetadata.js';

test('retorna null quando template ausente', () => {
  assert.equal(buildTemplateRenderMetadata({ template: null }), null);
  assert.equal(buildTemplateRenderMetadata({ template: {} }), null);
});

test('retorna shape esperado com template presente', () => {
  const result = buildTemplateRenderMetadata({
    template: { nome: 'Template RP', tipo_registro: 'RP', modulo: 'livro' },
    user: { full_name: 'Usuário Teste' },
    sourceOfTruth: TEMPLATE_SOURCE_OF_TRUTH.MANUAL_OVERRIDE,
  });

  assert.equal(result.template_nome, 'Template RP');
  assert.equal(result.template_tipo, 'RP');
  assert.equal(result.template_modulo, 'livro');
  assert.equal(result.rendered_by, 'Usuário Teste');
  assert.equal(result.source_of_truth, TEMPLATE_SOURCE_OF_TRUTH.MANUAL_OVERRIDE);
  assert.equal(Number.isNaN(Date.parse(result.rendered_at)), false);
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
