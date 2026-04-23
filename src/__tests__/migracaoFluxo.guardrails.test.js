import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('importação de militares mantém histórico persistido com fallback explícito', async () => {
  const conteudo = await read('services/migracaoMilitaresService.js');
  assert.match(conteudo, /Registro de histórico .* indisponível para atualização/);
  assert.match(conteudo, /salvarAnaliseHistorico\(analise, usuario\)/);
  assert.match(conteudo, /marcar status IMPORTANDO em lote recriado/);
  assert.ok(!conteudo.includes('return null;\n  }\n\n  try {\n    return await entity.update'));
});

test('menu de migração não exibe revisão de duplicidades no fluxo normal', async () => {
  const conteudo = await read('Layout.jsx');
  assert.ok(!conteudo.includes("{ name: 'Revisão Duplicidades'"));
  assert.match(conteudo, /Histórico de Importações/);
  assert.match(conteudo, /Classificação Pendentes Legado/);
});

test('classificação pendentes legado permanece com descrição de ferramenta administrativa', async () => {
  const conteudo = await read('pages/ClassificacaoPendentesLegado.jsx');
  assert.match(conteudo, /Ferramenta administrativa de migração/);
  assert.match(conteudo, /LEGADO_NAO_CLASSIFICADO/);
});
