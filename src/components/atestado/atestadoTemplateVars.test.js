import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAtestadoTemplateVarsContrato,
  getTipoTemplateHomologacaoAtestado,
  getTipoTemplatePublicacaoAtestado,
  TIPO_TEMPLATE_HOMOLOGACAO_ATESTADO,
  TIPO_TEMPLATE_HOMOLOGACAO_ATESTADO_ACOMPANHAMENTO,
} from './atestadoTemplateVars.js';

test('homologação usa CRM do médico cadastrado quando o atestado possui somente snapshot do nome', () => {
  const vars = buildAtestadoTemplateVarsContrato({
    atestado: {
      medico_id: 'medico-1',
      medico_nome_snapshot: 'Dra. Nome Histórico',
    },
    medicoCadastrado: {
      id: 'medico-1',
      nome: 'Dra. Nome Atualizado',
      crm: 'CRM 12345',
    },
  });

  const texto = 'Médico: {{medico_nome}} — {{medico_crm}}.'.replace(
    /\{\{(\w+)\}\}/g,
    (_, key) => vars[key] ?? `{{${key}}}`
  );

  assert.equal(texto, 'Médico: Dra. Nome Histórico — CRM 12345.');
  assert.doesNotMatch(texto, /\{\{medico_(?:nome|crm)\}\}/);
});


test('atestado comum mantém a chave atual de template de homologação', () => {
  assert.equal(
    getTipoTemplateHomologacaoAtestado({ acompanhado: false }),
    TIPO_TEMPLATE_HOMOLOGACAO_ATESTADO
  );
});

test('atestado de acompanhamento usa chave específica e renderiza variáveis seguras sem placeholders residuais', () => {
  const atestado = {
    acompanhado: true,
    grau_parentesco: 'Filho(a)',
    militar_nome: 'Militar Exemplo',
    militar_posto: 'Cabo',
    militar_matricula: '123456',
  };
  const vars = buildAtestadoTemplateVarsContrato({ atestado });
  const texto = '{{tipo_atestado_texto}} para {{nome_completo}} — parentesco: {{acompanhado_parentesco}}.'.replace(
    /\{\{(\w+)\}\}/g,
    (_, key) => vars[key] ?? `{{${key}}}`
  );

  assert.equal(
    getTipoTemplateHomologacaoAtestado(atestado),
    TIPO_TEMPLATE_HOMOLOGACAO_ATESTADO_ACOMPANHAMENTO
  );
  assert.equal(
    getTipoTemplatePublicacaoAtestado(TIPO_TEMPLATE_HOMOLOGACAO_ATESTADO, atestado),
    TIPO_TEMPLATE_HOMOLOGACAO_ATESTADO_ACOMPANHAMENTO
  );
  assert.equal(texto, 'atestado de acompanhamento para Militar Exemplo — parentesco: Filho(a).');
  assert.doesNotMatch(texto, /\{\{[^}]+\}\}/);
});
