import assert from 'node:assert/strict';
import test from 'node:test';

import {
  identificarCamposDinamicosDocumentoMilitar,
  substituirCamposDinamicosDocumentoMilitar,
} from './camposDinamicosDocumentoMilitar.js';

test('identifica campos dinâmicos válidos e ignora variáveis normais ou formatos inválidos', () => {
  assert.deepEqual(
    identificarCamposDinamicosDocumentoMilitar('{{campo:nome_curso}} {{nome_completo}} {{campo:}} {{campo}} {{campo:destino_documento}}'),
    ['nome_curso', 'destino_documento']
  );
});

test('aceita espaços internos e normaliza chaves para minúsculas e snake_case', () => {
  assert.deepEqual(
    identificarCamposDinamicosDocumentoMilitar('{{ campo:Nome do Curso }} / {{campo:Período-Curso}}'),
    ['nome_do_curso', 'periodo_curso']
  );
});

test('remove duplicidades normalizadas mantendo a ordem da primeira ocorrência', () => {
  assert.deepEqual(
    identificarCamposDinamicosDocumentoMilitar('{{campo:Nome Curso}} {{campo:destino}} {{ campo:nome-curso }}'),
    ['nome_curso', 'destino']
  );
});

test('substitui somente campos dinâmicos que possuem valores manuais informados', () => {
  assert.equal(
    substituirCamposDinamicosDocumentoMilitar(
      '{{nome_completo}} fará {{ campo:Nome Curso }}. Destino: {{campo:destino}}.',
      { nome_curso: 'Curso de Formação' }
    ),
    '{{nome_completo}} fará Curso de Formação. Destino: {{campo:destino}}.'
  );
});

test('mantém placeholder dinâmico visível quando o valor manual não existe ou não é textual', () => {
  assert.equal(
    substituirCamposDinamicosDocumentoMilitar('{{campo:observacoes}} / {{campo:destino}}', { observacoes: null }),
    '{{campo:observacoes}} / {{campo:destino}}'
  );
});
