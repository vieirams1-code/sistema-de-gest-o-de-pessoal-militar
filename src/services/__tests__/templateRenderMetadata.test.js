import { describe, expect, it } from 'vitest';
import { TEMPLATE_SOURCE_OF_TRUTH } from '@/constants/templateGovernance';
import { buildTemplateRenderMetadata } from '@/services/templateRenderMetadata';

describe('buildTemplateRenderMetadata', () => {
  it('retorna null quando template ausente', () => {
    expect(buildTemplateRenderMetadata({ template: null })).toBeNull();
    expect(buildTemplateRenderMetadata({ template: {} })).toBeNull();
  });

  it('retorna shape esperado com template presente', () => {
    const result = buildTemplateRenderMetadata({
      template: { nome: 'Template RP', tipo_registro: 'RP', modulo: 'livro' },
      user: { full_name: 'Usuário Teste' },
      sourceOfTruth: TEMPLATE_SOURCE_OF_TRUTH.MANUAL_OVERRIDE,
    });

    expect(result).toMatchObject({
      template_nome: 'Template RP',
      template_tipo: 'RP',
      template_modulo: 'livro',
      rendered_by: 'Usuário Teste',
      source_of_truth: TEMPLATE_SOURCE_OF_TRUTH.MANUAL_OVERRIDE,
    });
    expect(Number.isNaN(Date.parse(result.rendered_at))).toBe(false);
  });

  it('retorna objeto serializável e preserva source_of_truth', () => {
    const result = buildTemplateRenderMetadata({
      template: { id: '1', nome: 'Template A' },
      sourceOfTruth: 'custom_source',
    });

    expect(() => JSON.stringify(result)).not.toThrow();
    expect(result.source_of_truth).toBe('custom_source');
  });
});
