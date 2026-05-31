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

test('lote 2 mantém consulta de publicações escopada ao militar e status simplificados', async () => {
  const conteudo = await read('services/migracaoAlteracoesLegadoSimplificadoService.js');
  assert.match(conteudo, /PublicacaoExOfficio\.filter\(\s*\{ militar_id: militarId \},\s*'-created_date',\s*5000,\s*\)/);
  assert.doesNotMatch(conteudo, /base44\.entities\.Militar\.list\(/);
  assert.match(conteudo, /PRONTA: 'pronta'/);
  assert.match(conteudo, /ERRO: 'erro'/);
  assert.match(conteudo, /DUPLICADA: 'duplicada'/);
});

test('lote 3 usa tabela própria editável sem expor controles legados no modo simplificado', async () => {
  const pagina = await read('pages/MigracaoAlteracoesLegado.jsx');
  const tabela = await read('components/migracao-alteracoes-legado/TabelaRevisaoSimplificadaAlteracoesLegado.jsx');
  assert.match(pagina, /analise\.fluxo_simplificado \? \(/);
  assert.match(pagina, /<TabelaRevisaoSimplificadaAlteracoesLegado/);
  assert.match(pagina, /\{!analise\.fluxo_simplificado && \(/);
  assert.match(tabela, /Número nota/);
  assert.match(tabela, /Texto publicado/);
  assert.match(tabela, /Status publicação/);
  assert.match(tabela, /linha\.status_publicacao/);
  assert.match(tabela, /Restaurar/);
  assert.match(tabela, /Recusar/);
});

test('lote 2 aceita CSV e XLSX, bloqueia XLS e protege runtime Node sem DOMParser', async () => {
  const conteudo = await read('services/migracaoAlteracoesLegadoSimplificadoService.js');
  assert.match(conteudo, /nome\.endsWith\('\.csv'\)/);
  assert.match(conteudo, /nome\.endsWith\('\.xlsx'\)/);
  assert.match(conteudo, /nome\.endsWith\('\.xls'\).*Formato \.xls não suportado/);
  assert.match(conteudo, /typeof DOMParser === 'undefined'/);
});

test('lote 3.1 calcula publicação legado sem AGUARDANDO_NOTA e prepara persistência futura', async () => {
  const analise = await read('services/migracaoAlteracoesLegadoSimplificadoService.js');
  const edicao = await read('services/migracaoAlteracoesLegadoSimplificadoEdicao.js');
  const status = await read('services/migracaoAlteracoesLegadoStatusPublicacao.js');
  const pagina = await read('pages/MigracaoAlteracoesLegado.jsx');

  assert.match(analise, /const CAMPOS_OBRIGATORIOS = \['numero_nota', 'texto_publicado'\]/);
  assert.match(analise, /status_publicacao: calcularStatusPublicacaoLegado/);
  assert.match(edicao, /status_publicacao: statusPublicacao/);
  assert.match(edicao, /const statusPublicacao = calcularStatusPublicacaoLegado/);
  assert.match(pagina, /status_publicacao: linha\.status_publicacao/);
  assert.match(status, /AGUARDANDO_PUBLICACAO: 'AGUARDANDO_PUBLICACAO'/);
  assert.match(status, /PUBLICADO: 'PUBLICADO'/);
  assert.doesNotMatch(status, /AGUARDANDO_NOTA/);
});
