import { TEMPLATE_SOURCE_OF_TRUTH } from '@/constants/templateGovernance';

function buildRenderedBy(user = {}) {
  return user?.full_name || user?.name || user?.email || user?.id || 'sistema';
}

export function buildTemplateRenderMetadata({ template = {}, modulo = '', user = {}, sourceOfTruth = TEMPLATE_SOURCE_OF_TRUTH.RENDER_ON_SUBMIT } = {}) {
  if (!template?.id && !template?.nome && !template?.tipo_registro) return null;

  return {
    template_nome: template?.nome || template?.tipo_registro || 'Template sem nome',
    template_tipo: template?.tipo_registro || '',
    template_modulo: template?.modulo || modulo || '',
    rendered_at: new Date().toISOString(),
    rendered_by: buildRenderedBy(user),
    source_of_truth: sourceOfTruth,
  };
}
