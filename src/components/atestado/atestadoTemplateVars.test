import test from 'node:test';
import assert from 'node:assert/strict';

import { buildAtestadoTemplateVarsContrato } from './atestadoTemplateVars.js';

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
