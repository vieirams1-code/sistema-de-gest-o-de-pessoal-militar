import test from 'node:test';
import assert from 'node:assert/strict';

import {
  agruparHistoricoPorAnoMes,
  deduplicarEventosFolhaAlteracoes,
  montarHistoricoFolhaAlteracoes,
  ordenarEventosFolhaAlteracoes,
} from './folhaAlteracoesHistorico.js';

test('Folha de Alterações preserva múltiplos registros publicados na mesma data', () => {
  const eventos = ordenarEventosFolhaAlteracoes(deduplicarEventosFolhaAlteracoes([
    {
      id: 'licenca-paternidade',
      data: '2026-05-22',
      texto: 'Licença Paternidade',
      referenciaBoletim: 'Boletim 100, de 22/05/2026',
      origem: 'PublicacaoExOfficio',
    },
    {
      id: 'dispensa-recompensa',
      data: '2026-05-22',
      texto: 'Dispensa como Recompensa',
      referenciaBoletim: 'Boletim 100, de 22/05/2026',
      origem: 'PublicacaoExOfficio',
    },
  ]));

  const historico = agruparHistoricoPorAnoMes(eventos, '2026-05-01', '2026-05-31');
  const maio = historico[0].meses[0];

  assert.equal(maio.titulo, 'MÊS DE MAIO/2026');
  assert.deepEqual(maio.eventos.map((evento) => evento.texto), [
    'Licença Paternidade',
    'Dispensa como Recompensa',
  ]);
});

test('Folha de Alterações deduplica somente o mesmo registro por origem e id', () => {
  const eventos = deduplicarEventosFolhaAlteracoes([
    { id: 'registro-1', data: '2026-05-22', texto: 'Licença Paternidade', origem: 'PublicacaoExOfficio' },
    { id: 'registro-1', data: '2026-05-22', texto: 'Licença Paternidade', origem: 'PublicacaoExOfficio' },
    { id: 'registro-2', data: '2026-05-22', texto: 'Dispensa como Recompensa', origem: 'PublicacaoExOfficio' },
  ]);

  assert.deepEqual(eventos.map((evento) => evento.texto), [
    'Licença Paternidade',
    'Dispensa como Recompensa',
  ]);
});

test('Folha de Alterações monta o fluxo completo com RegistroLivro e PublicacaoExOfficio do mesmo dia', () => {
  const militar = {
    id: 'militar-gabriel',
    nome_completo: 'Gabriel Mendes dos Santos',
    matricula: '123456',
  };

  const registros = [
    {
      id: 'licenca-paternidade-registro-livro',
      origem_fonte: 'RegistroLivro',
      militar_id: 'militar-gabriel',
      tipo_registro: 'Licença Paternidade',
      texto_publicacao: 'Licença Paternidade',
      numero_bg: '100',
      data_bg: '2026-05-22',
      status_publicacao: 'Publicado',
    },
    {
      id: 'dispensa-recompensa-ex-officio',
      origem_fonte: 'PublicacaoExOfficio',
      militar_nome: 'Gabriel Mendes dos Santos',
      tipo: 'Dispensa Recompensa',
      texto_publicacao: 'Dispensa como Recompensa',
      numero_bg: '100',
      data_bg: '2026-05-22',
      status_publicacao: 'Publicado',
    },
    {
      id: 'fora-periodo',
      origem_fonte: 'RegistroLivro',
      militar_id: 'militar-gabriel',
      tipo_registro: 'Curso/Estágio',
      texto_publicacao: 'Curso fora do período',
      numero_bg: '99',
      data_bg: '2026-05-20',
      status_publicacao: 'Publicado',
    },
    {
      id: 'sem-bg',
      origem_fonte: 'RegistroLivro',
      militar_id: 'militar-gabriel',
      tipo_registro: 'Elogio',
      texto_publicacao: 'Registro ainda sem publicação',
      status_publicacao: 'Aguardando Publicação',
    },
  ];

  const { eventos, agrupado, metricas } = montarHistoricoFolhaAlteracoes({
    registros,
    atestados: [],
    militar,
    dataInicial: '2026-05-21',
    dataFinal: '2026-05-23',
  });

  assert.deepEqual(eventos.map((evento) => evento.texto), [
    'Licença Paternidade',
    'Dispensa como Recompensa',
  ]);
  assert.equal(agrupado[0].meses[0].eventos.length, 2);
  assert.deepEqual(metricas, {
    brutos: 4,
    registrosBrutos: 4,
    atestadosBrutos: 0,
    aposFiltroMilitar: 4,
    aposFiltroPeriodo: 2,
    aposFiltroStatusPublicacao: 2,
    chegaramAgrupamento: 2,
    renderizados: 2,
  });
});

test('Folha de Alterações inclui e formata corretamente registros DOEMS', () => {
  const militar = {
    id: 'militar-gabriel',
    nome_completo: 'Gabriel Mendes dos Santos',
    matricula: '123456',
  };

  const registros = [
    {
      id: 'doems-promocao',
      origem_fonte: 'PublicacaoExOfficio',
      militar_id: 'militar-gabriel',
      tipo: 'Registro de Publicação DOEMS',
      subtipo_geral: 'Promoção',
      texto_publicacao: 'Promovido ao posto de Capitão',
      doems_edicao_numero: '1234',
      data_publicacao: '2026-05-22',
      status_publicacao: 'Publicado',
    },
  ];

  const { eventos } = montarHistoricoFolhaAlteracoes({
    registros,
    atestados: [],
    militar,
    dataInicial: '2026-05-01',
    dataFinal: '2026-05-31',
  });

  assert.equal(eventos.length, 1);
  const doems = eventos[0];
  assert.equal(doems.texto, 'Promovido ao posto de Capitão');
  assert.equal(doems.referenciaBoletim, 'DOEMS nº 1234, de 22/05/2026. Subtipo: Promoção.');
  assert.equal(doems.descricao, 'Registro de Publicação DOEMS - DOEMS nº 1234');
});

test('Folha de Alterações inclui registros DOEMS usando data_registro como fallback', () => {
  const militar = {
    id: 'militar-edson',
    nome_completo: 'Edson Vieira',
    matricula: '999888',
  };

  const registros = [
    {
      id: 'doems-fallback-date',
      origem_fonte: 'PublicacaoExOfficio',
      militar_id: 'militar-edson',
      tipo: 'Registro de Publicação DOEMS',
      subtipo_geral: 'Promoção',
      texto_publicacao: 'Texto da promoção do Edson',
      doems_edicao_numero: '5678',
      data_registro: '2026-06-09',
      status_publicacao: 'Publicado',
    },
  ];

  const { eventos } = montarHistoricoFolhaAlteracoes({
    registros,
    atestados: [],
    militar,
    dataInicial: '2026-06-01',
    dataFinal: '2026-06-30',
  });

  assert.equal(eventos.length, 1, 'O registro DOEMS deve ser incluído usando data_registro');
  const doems = eventos[0];
  assert.equal(doems.data, '2026-06-09');
  assert.equal(doems.referenciaBoletim, 'DOEMS nº 5678, de 09/06/2026. Subtipo: Promoção.');
});
