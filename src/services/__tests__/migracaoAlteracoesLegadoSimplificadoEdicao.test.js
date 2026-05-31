import test from 'node:test';
import assert from 'node:assert/strict';
import {
  atualizarLinhaRevisaoSimplificada,
  gerarResumoRevisaoSimplificada,
  revalidarLinhasRevisaoSimplificada,
} from '../migracaoAlteracoesLegadoSimplificadoEdicao.js';

function linha(linhaNumero, numero_nota, extras = {}) {
  return {
    linhaNumero,
    numero_nota,
    numero_bg_br: '',
    data_bg_br: '',
    tipo_legado: 'Férias',
    tipo_classificado: '',
    texto_publicado: 'Texto',
    numerosNotaImportados: [],
    recusada: false,
    transformado: {},
    ...extras,
  };
}

test('revalida obrigatórios e duplicidade dentro da própria análise', () => {
  const linhas = revalidarLinhasRevisaoSimplificada([
    linha(2, 'NOTA-1'),
    linha(3, ' NOTA-1 '),
    linha(4, '', { texto_publicado: '' }),
  ]);

  assert.equal(linhas[0].status, 'duplicada');
  assert.equal(linhas[1].status, 'duplicada');
  assert.equal(linhas[2].status, 'erro');
  assert.match(linhas[2].erros.join(' '), /Número da nota é obrigatório/);
  assert.match(linhas[2].erros.join(' '), /Texto publicado é obrigatório/);
});

test('nota importada deixa de ser duplicada quando usuário informa número livre', () => {
  const original = revalidarLinhasRevisaoSimplificada([
    linha(2, 'NOTA-1', { numerosNotaImportados: ['NOTA-1', 'NOTA-2'] }),
  ]);
  assert.equal(original[0].status, 'duplicada');

  const livre = atualizarLinhaRevisaoSimplificada(original, 2, { numero_nota: 'NOTA-3' });
  assert.equal(livre[0].status, 'pronta');

  const outraImportada = atualizarLinhaRevisaoSimplificada(livre, 2, { numero_nota: 'NOTA-2' });
  assert.equal(outraImportada[0].status, 'duplicada');
});

test('linha recusada sai dos bloqueios e restauração revalida o lote', () => {
  const duplicadas = revalidarLinhasRevisaoSimplificada([linha(2, 'A'), linha(3, 'A')]);
  const recusada = atualizarLinhaRevisaoSimplificada(duplicadas, 2, { recusada: true });
  assert.equal(recusada[0].status, 'recusada');
  assert.equal(recusada[0].status_publicacao, 'AGUARDANDO_PUBLICACAO');
  assert.equal(recusada[0].transformado.status_publicacao, 'AGUARDANDO_PUBLICACAO');
  assert.equal(recusada[1].status, 'pronta');
  assert.equal(gerarResumoRevisaoSimplificada(recusada).total_erros, 0);

  const restaurada = atualizarLinhaRevisaoSimplificada(recusada, 2, { recusada: false });
  assert.equal(restaurada[0].status, 'duplicada');
  assert.equal(restaurada[1].status, 'duplicada');
});

test('calcula status de publicação sem usar AGUARDANDO_NOTA e sincroniza futura importação', () => {
  const aguardandoSemBg = revalidarLinhasRevisaoSimplificada([
    linha(2, 'NOTA-1'),
  ]);
  assert.equal(aguardandoSemBg[0].status_publicacao, 'AGUARDANDO_PUBLICACAO');
  assert.equal(aguardandoSemBg[0].transformado.status_publicacao, 'AGUARDANDO_PUBLICACAO');

  const aguardandoSemData = atualizarLinhaRevisaoSimplificada(aguardandoSemBg, 2, { numero_bg_br: 'BG-10' });
  assert.equal(aguardandoSemData[0].status_publicacao, 'AGUARDANDO_PUBLICACAO');
  assert.equal(aguardandoSemData[0].transformado.status_publicacao, 'AGUARDANDO_PUBLICACAO');

  const publicado = atualizarLinhaRevisaoSimplificada(aguardandoSemData, 2, { data_bg_br: '31/05/2026' });
  assert.equal(publicado[0].status_publicacao, 'PUBLICADO');
  assert.equal(publicado[0].transformado.status_publicacao, 'PUBLICADO');
});

test('linha sem nota continua erro bloqueante e não recebe AGUARDANDO_NOTA', () => {
  const [semNota] = revalidarLinhasRevisaoSimplificada([
    linha(2, '', { numero_bg_br: 'BG-10', data_bg_br: '31/05/2026' }),
  ]);

  assert.equal(semNota.status, 'erro');
  assert.equal(semNota.status_publicacao, 'AGUARDANDO_PUBLICACAO');
  assert.equal(semNota.transformado.status_publicacao, 'AGUARDANDO_PUBLICACAO');
  assert.match(semNota.erros.join(' '), /Número da nota é obrigatório/);
});
