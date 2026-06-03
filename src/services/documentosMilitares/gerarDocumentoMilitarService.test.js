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

test('preserva acentos, símbolos institucionais e quebras de linha do template e dos campos manuais', () => {
  assert.equal(
    renderizarDocumentoMilitarIndividual({
      template: 'Referência: § 1º\nMilitar: {{nome_completo}}\n{{campo:observacoes}}',
      militar,
      camposManuais: { observacoes: 'Promoção à 2ª classe\nTemperatura: 30°' },
    }),
    'Referência: § 1º\nMilitar: Maria da Silva\nPromoção à 2ª classe\nTemperatura: 30°'
  );
});

test('renderiza template grande sem truncar conteúdo equivalente a cinco páginas', () => {
  const blocos = Array.from({ length: 5 }, (_, pagina) => (
    `Página ${pagina + 1}: {{nome_completo}}\n${'Linha institucional preservada.\n'.repeat(55)}`
  ));
  const template = blocos.join('\n');
  const resultado = renderizarDocumentoMilitarIndividual({ template, militar });

  assert.equal(resultado, template.replaceAll('{{nome_completo}}', 'Maria da Silva'));
  assert.match(resultado, /Página 1: Maria da Silva/);
  assert.match(resultado, /Página 5: Maria da Silva/);
});
