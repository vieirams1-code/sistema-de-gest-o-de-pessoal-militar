import { buildTemplateVarsContrato } from '../utils/templateContratoUtils.js';

export const TIPO_TEMPLATE_HOMOLOGACAO_ATESTADO = 'Homologação de Atestado';
export const TIPO_TEMPLATE_HOMOLOGACAO_ATESTADO_ACOMPANHAMENTO = 'Homologação de Atestado de Acompanhamento';

export function getTipoTemplateHomologacaoAtestado(atestado = {}) {
  return atestado?.acompanhado === true
    ? TIPO_TEMPLATE_HOMOLOGACAO_ATESTADO_ACOMPANHAMENTO
    : TIPO_TEMPLATE_HOMOLOGACAO_ATESTADO;
}

export function getTipoTemplatePublicacaoAtestado(tipoRegistro, atestado = {}) {
  return tipoRegistro === TIPO_TEMPLATE_HOMOLOGACAO_ATESTADO
    ? getTipoTemplateHomologacaoAtestado(atestado)
    : tipoRegistro;
}

export function buildAtestadoTemplateVarsContrato({
  atestado = {},
  medicoCadastrado = null,
  militar = null,
  matriculaDocumental = '',
  matriculaOperacional = '',
} = {}) {
  return {
    ...buildTemplateVarsContrato({
      ...atestado,
      militar,
      matricula_documental: matriculaDocumental,
      matricula_operacional: matriculaOperacional,
      medico_nome: atestado.medico_nome_snapshot || medicoCadastrado?.nome || atestado.medico_nome,
      medico_crm: atestado.medico_crm_snapshot || atestado.crm_medico || medicoCadastrado?.crm || atestado.medico_crm,
    }),
    acompanhado_parentesco: atestado.grau_parentesco || '',
    tipo_atestado_texto: atestado.acompanhado === true ? 'atestado de acompanhamento' : 'atestado médico',
  };
}
