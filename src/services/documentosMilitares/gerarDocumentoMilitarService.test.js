import assert from 'node:assert/strict';
import test from 'node:test';

import { MODULO_DOCUMENTOS_MILITARES } from './documentoMilitarVarsService.js';
import {
  filtrarTemplatesDocumentosMilitares,
  identificarCamposTemplateDocumentoMilitar,
  renderizarDocumentoMilitarIndividual,
} from './gerarDocumentoMilitarService.js';

const militar = {
  nome_completo: 'Maria da Silva',
  posto_graduacao: 'Capitão',
  matricula: '123456',
};

test('renderiza fluxo individual combinando template, militar e campos manuais', () => {
  assert.equal(
    renderizarDocumentoMilitarIndividual({
      template: '{{posto_graduacao}} {{nome_completo}}, matrícula {{matricula}}, seguirá para {{campo:destino}}.',
      militar,
      camposManuais: { destino: 'Comando-Geral' },
    }),
    'Capitão Maria da Silva, matrícula 123456, seguirá para Comando-Geral.'
  );
});

test('mantém campo dinâmico sem valor visível na prévia', () => {
  assert.equal(
    renderizarDocumentoMilitarIndividual({
      template: '{{nome_completo}} / {{campo:destino}} / {{campo:observacoes}}',
      militar,
      camposManuais: { destino: '', observacoes: null },
    }),
    'Maria da Silva / {{campo:destino}} / {{campo:observacoes}}'
  );
});

test('renderiza diretamente template sem campo dinâmico', () => {
  const template = 'Militar: {{nome_completo}}. Matrícula: {{matricula}}.';

  assert.deepEqual(identificarCamposTemplateDocumentoMilitar(template), []);
  assert.equal(
    renderizarDocumentoMilitarIndividual({ template, militar }),
    'Militar: Maria da Silva. Matrícula: 123456.'
  );
});

test('mantém variável militar sem valor visível na prévia', () => {
  assert.equal(
    renderizarDocumentoMilitarIndividual({ template: '{{nome_completo}} / CPF: {{cpf}}', militar }),
    'Maria da Silva / CPF: {{cpf}}'
  );
});

test('considera somente templates do módulo DocumentosMilitares', () => {
  const templates = [
    { id: 'documento', modulo: MODULO_DOCUMENTOS_MILITARES },
    { id: 'ferias', modulo: 'Livro' },
    { id: 'atestado', modulo: 'ExOfficio' },
    { id: 'sem-modulo' },
  ];

  assert.deepEqual(filtrarTemplatesDocumentosMilitares(templates), [templates[0]]);
  assert.deepEqual(filtrarTemplatesDocumentosMilitares(null), []);
});
