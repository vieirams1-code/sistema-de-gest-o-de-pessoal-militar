import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('tela principal remove controles manuais antigos e mantém ações diretas', async () => {
  const conteudo = await read('components/migracao-alteracoes-legado/TabelaPreviaMigracaoAlteracoesLegado.jsx');
  assert.ok(!conteudo.includes('Marcar tipo'));
  assert.ok(!conteudo.includes('Sugestão do sistema'));
  assert.ok(!conteudo.includes('Label className="text-xs text-slate-600">Destino final'));
  assert.match(conteudo, /onImportarRegistro\?\./);
  assert.match(conteudo, /onEnviarParaRevisaoRegistro\?\./);
  assert.match(conteudo, /onIgnorarRegistro\?\./);
});

test('seleção de tipo dispara autosave no backend', async () => {
  const conteudo = await read('pages/MigracaoAlteracoesLegado.jsx');
  assert.match(conteudo, /persistirEstadoAnaliseHistoricoAlteracoesLegado\(historicoId, proxima\)/);
  assert.match(conteudo, /Classificação atualizada automaticamente para este registro/);
});

test('ações finais por registro usam destino interno sem dropdown manual', async () => {
  const conteudo = await read('services/migracaoAlteracoesLegadoService.js');
  assert.match(conteudo, /executarAcaoRegistroMigracaoAlteracoesLegado/);
  assert.match(conteudo, /DESTINO_FINAL\.IMPORTAR/);
  assert.match(conteudo, /DESTINO_FINAL\.PENDENTE_CLASSIFICACAO/);
  assert.match(conteudo, /DESTINO_FINAL\.IGNORAR/);
});
