import { buildTemplateVarsContrato } from '../utils/templateContratoUtils.js';

export function buildAtestadoTemplateVarsContrato({
  atestado = {},
  medicoCadastrado = null,
  militar = null,
  matriculaDocumental = '',
  matriculaOperacional = '',
} = {}) {
  return buildTemplateVarsContrato({
    ...atestado,
    militar,
    matricula_documental: matriculaDocumental,
    matricula_operacional: matriculaOperacional,
    medico_nome: atestado.medico_nome_snapshot || medicoCadastrado?.nome || atestado.medico_nome,
    medico_crm: atestado.medico_crm_snapshot || atestado.crm_medico || medicoCadastrado?.crm || atestado.medico_crm,
  });
}
