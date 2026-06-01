import test from 'node:test';
import assert from 'node:assert/strict';
import {
  atualizarLinhaRevisaoSimplificada,
  gerarResumoRevisaoSimplificada,
  montarPayloadPublicacaoExOfficioMigracaoLegado,
  resolverTipoFinalMigracaoLegado,
  revalidarLinhasRevisaoSimplificada,
} from '../migracaoAlteracoesLegadoSimplificadoEdicao.js';

function linha(linhaNumero, numero_nota, extras = {}) {
  return {
    linhaNumero,
    numero_nota,
    numero_bg_br: '',
    data_bg_br: '31/05/2026',
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
    linha(2, 'NOTA-1', { data_bg_br: '' }),
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


test('payload usa classificação manual e marca classificação como concluída', () => {
  const payload = montarPayloadPublicacaoExOfficioMigracaoLegado(linha(2, ' NOTA-1 ', {
    tipo_classificado: 'Elogio Individual',
  }));

  assert.equal(payload.nota_id_legado, 'NOTA-1');
  assert.equal(payload.tipo, 'Elogio Individual');
  assert.equal(payload.tipo_registro, 'Elogio Individual');
  assert.equal(payload.classificacao_pendente, false);
});

test('payload usa matéria legado como fallback sem bloquear e marca classificação pendente', () => {
  const entrada = linha(2, 'NOTA-1', {
    materia_legado: 'Licença Especial',
    tipo_legado: '',
    tipo_classificado: '__fallback__',
  });
  const [validada] = revalidarLinhasRevisaoSimplificada([entrada]);
  const payload = montarPayloadPublicacaoExOfficioMigracaoLegado(validada);

  assert.equal(validada.status, 'pronta');
  assert.match(validada.avisos.join(' '), /usando tipo legado como fallback/);
  assert.equal(payload.tipo, 'Licença Especial');
  assert.equal(payload.materia_legado, 'Licença Especial');
  assert.equal(payload.classificacao_pendente, true);
});

test('linha sem classificação e sem matéria ou tipo legado fica bloqueada com erro claro', () => {
  const entrada = linha(2, 'NOTA-1', {
    materia_legado: '',
    tipo_legado: '',
    tipo_classificado: '',
    transformado: {},
  });
  const [validada] = revalidarLinhasRevisaoSimplificada([entrada]);

  assert.equal(validada.status, 'erro');
  assert.match(validada.erros.join(' '), /Tipo\/matéria ausente\. Classifique manualmente antes de importar\./);
  assert.throws(
    () => montarPayloadPublicacaoExOfficioMigracaoLegado(entrada),
    /Tipo\/matéria ausente\. Classifique manualmente antes de importar\./,
  );
});

test('payload persiste data_publicacao, data_bg, texto_publicacao, metadados legado e status publicado', () => {
  const payload = montarPayloadPublicacaoExOfficioMigracaoLegado(linha(2, 'NOTA-1', {
    numero_bg_br: 'BG-10',
    data_bg_br: '31/05/2026',
    texto_publicado: 'Texto publicado na timeline',
    tipo_bg_legado: 'BG',
  }));

  assert.equal(payload.data_publicacao, '31/05/2026');
  assert.equal(payload.data_bg, '31/05/2026');
  assert.equal(payload.texto_publicacao, 'Texto publicado na timeline');
  assert.equal(payload.tipo_bg_legado, 'BG');
  assert.equal(payload.origem_registro, 'legado');
  assert.equal(payload.importado_legado, true);
  assert.equal(payload.status, 'Publicado');
  assert.ok(!Object.hasOwn(payload, 'texto_publicado'));
});

test('data_publicacao usa transformado.data_bg_br e data_bg como fallbacks', () => {
  const viaTransformado = montarPayloadPublicacaoExOfficioMigracaoLegado(linha(2, 'NOTA-1', {
    data_bg_br: '',
    transformado: { data_bg_br: '30/05/2026' },
  }));
  const viaDataBg = montarPayloadPublicacaoExOfficioMigracaoLegado(linha(3, 'NOTA-2', {
    data_bg_br: '',
    data_bg: '29/05/2026',
  }));

  assert.equal(viaTransformado.data_publicacao, '30/05/2026');
  assert.equal(viaDataBg.data_publicacao, '29/05/2026');
});

test('linha sem data_publicacao válida fica bloqueada antes da importação', () => {
  const entrada = linha(2, 'NOTA-1', { data_bg_br: '' });
  const [validada] = revalidarLinhasRevisaoSimplificada([entrada]);

  assert.equal(validada.status, 'erro');
  assert.match(validada.erros.join(' '), /Data da publicação ausente\. Preencha a data do BG\/BR antes de importar\./);
  assert.throws(
    () => montarPayloadPublicacaoExOfficioMigracaoLegado(entrada),
    /Data da publicação ausente\. Preencha a data do BG\/BR antes de importar\./,
  );
});

test('resolver tipo usa tipo_legado e transformado.materia_legado após matéria legado', () => {
  assert.deepEqual(
    resolverTipoFinalMigracaoLegado({ tipo_legado: 'Férias' }),
    { tipoFinal: 'Férias', classificacaoPendente: true },
  );
  assert.deepEqual(
    resolverTipoFinalMigracaoLegado({ transformado: { materia_legado: 'Movimentação' } }),
    { tipoFinal: 'Movimentação', classificacaoPendente: true },
  );
});
