import test from 'node:test';
import assert from 'node:assert/strict';
import { getMilitarTimeline, __setMilitarTimelineClientForTests } from '../militarTimelineService.js';

// Helper para criar mock de entidade
const createMockEntity = (data = []) => ({
  filter: async () => data,
  list: async () => data,
});

test('getMilitarTimeline - ordena por data decrescente', async () => {
  const mockBase44 = {
    entities: {
      RegistroLivro: createMockEntity([{ id: 'r1', data_publicacao: '2023-01-01', tipo_registro: 'Evento A' }]),
      PublicacaoExOfficio: createMockEntity([{ id: 'p1', data_publicacao: '2023-02-01', tipo: 'Evento B' }]),
      Ferias: createMockEntity([{ id: 'f1', data_inicio: '2023-03-01', dias: 30 }]),
      Atestado: createMockEntity([{ id: 'a1', data_inicio: '2023-04-01', dias: 5 }]),
      HistoricoPromocaoMilitarV2: createMockEntity([{ id: 'pr1', data_promocao: '2023-05-01', posto_graduacao_novo: 'Cabo' }]),
      Medalha: createMockEntity([{ id: 'm1', data_concessao: '2023-06-01', tipo_medalha_nome: 'Medalha X' }]),
      MilitarFuncao: createMockEntity([]),
      GratificacaoFuncao: createMockEntity([]),
      FuncaoMilitar: createMockEntity([]),
      TipoGratificacaoFuncao: createMockEntity([]),
    },
  };

  __setMilitarTimelineClientForTests(mockBase44);

  const timeline = await getMilitarTimeline('m1');

  assert.equal(timeline.length, 6);
  assert.equal(timeline[0].data, '2023-06-01'); // Medalha
  assert.equal(timeline[1].data, '2023-05-01'); // Promoção
  assert.equal(timeline[2].data, '2023-04-01'); // Atestado
  assert.equal(timeline[3].data, '2023-03-01'); // Férias
  assert.equal(timeline[4].data, '2023-02-01'); // Publicação Ex Officio
  assert.equal(timeline[5].data, '2023-01-01'); // Registro Livro

  // Verifica campos novos
  assert.equal(timeline[0].id, 'm1');
  assert.equal(timeline[0].origem, 'Medalha');
  assert.equal(timeline[0].categoria, 'Carreira');
});

test('getMilitarTimeline - lida com múltiplos eventos na mesma data', async () => {
  const mockBase44 = {
    entities: {
      RegistroLivro: createMockEntity([{ id: 'r1', data_publicacao: '2023-01-01', tipo_registro: 'Evento A' }]),
      PublicacaoExOfficio: createMockEntity([{ id: 'p1', data_publicacao: '2023-01-01', tipo: 'Evento B' }]),
      Ferias: createMockEntity([]),
      Atestado: createMockEntity([]),
      HistoricoPromocaoMilitarV2: createMockEntity([]),
      Medalha: createMockEntity([]),
      MilitarFuncao: createMockEntity([]),
      GratificacaoFuncao: createMockEntity([]),
      FuncaoMilitar: createMockEntity([]),
      TipoGratificacaoFuncao: createMockEntity([]),
    },
  };

  __setMilitarTimelineClientForTests(mockBase44);

  const timeline = await getMilitarTimeline('m1');

  assert.equal(timeline.length, 2);
  assert.equal(timeline[0].data, '2023-01-01');
  assert.equal(timeline[1].data, '2023-01-01');
});

test('getMilitarTimeline - ignora eventos sem data', async () => {
  const mockBase44 = {
    entities: {
      RegistroLivro: createMockEntity([{ id: 'r1', data_publicacao: '2023-01-01', tipo_registro: 'Com data' }]),
      PublicacaoExOfficio: createMockEntity([{ id: 'p1', data_publicacao: null, tipo: 'Sem data' }]),
      Ferias: createMockEntity([]),
      Atestado: createMockEntity([]),
      HistoricoPromocaoMilitarV2: createMockEntity([]),
      Medalha: createMockEntity([]),
      MilitarFuncao: createMockEntity([]),
      GratificacaoFuncao: createMockEntity([]),
      FuncaoMilitar: createMockEntity([]),
      TipoGratificacaoFuncao: createMockEntity([]),
    },
  };

  __setMilitarTimelineClientForTests(mockBase44);

  const timeline = await getMilitarTimeline('m1');

  assert.equal(timeline.length, 1);
  assert.equal(timeline[0].titulo, 'Com data');
});

test('getMilitarTimeline - remove eventos duplicados', async () => {
  const event = { id: 'r1', data_publicacao: '2023-01-01', tipo_registro: 'Duplicado', conteudo: 'Mesmo conteúdo' };
  const mockBase44 = {
    entities: {
      RegistroLivro: createMockEntity([event, event]),
      PublicacaoExOfficio: createMockEntity([]),
      Ferias: createMockEntity([]),
      Atestado: createMockEntity([]),
      HistoricoPromocaoMilitarV2: createMockEntity([]),
      Medalha: createMockEntity([]),
      MilitarFuncao: createMockEntity([]),
      GratificacaoFuncao: createMockEntity([]),
      FuncaoMilitar: createMockEntity([]),
      TipoGratificacaoFuncao: createMockEntity([]),
    },
  };

  __setMilitarTimelineClientForTests(mockBase44);

  const timeline = await getMilitarTimeline('m1');

  assert.equal(timeline.length, 1);
  assert.equal(timeline[0].titulo, 'Duplicado');
});

test('getMilitarTimeline - formatação correta dos campos', async () => {
  const mockBase44 = {
    entities: {
      RegistroLivro: createMockEntity([]),
      PublicacaoExOfficio: createMockEntity([]),
      Ferias: createMockEntity([{ id: 'f1', data_inicio: '2023-01-01', dias: 15, periodo_aquisitivo_ref: '2022/2023' }]),
      Atestado: createMockEntity([{ id: 'a1', data_inicio: '2023-02-01', dias: 3, tipo_afastamento: 'LTS', cid_10: 'Z00' }]),
      HistoricoPromocaoMilitarV2: createMockEntity([{ id: 'pr1', data_promocao: '2023-03-01', posto_graduacao_novo: 'Sgt', quadro_novo: 'QPBM', boletim_referencia: 'BG 100' }]),
      Medalha: createMockEntity([]),
      MilitarFuncao: createMockEntity([]),
      GratificacaoFuncao: createMockEntity([]),
      FuncaoMilitar: createMockEntity([]),
      TipoGratificacaoFuncao: createMockEntity([]),
    },
  };

  __setMilitarTimelineClientForTests(mockBase44);

  const timeline = await getMilitarTimeline('m1');

  const promo = timeline.find(it => it.tipo === 'Promoção');
  assert.equal(promo.titulo, 'Sgt QPBM');
  assert.equal(promo.descricao, 'Boletim: BG 100');
  assert.equal(promo.origem, 'HistoricoPromocaoMilitarV2');
  assert.equal(promo.categoria, 'Carreira');

  const ferias = timeline.find(it => it.tipo === 'Férias');
  assert.equal(ferias.descricao, '15 dias ref. ao período 2022/2023');
  assert.equal(ferias.origem, 'Ferias');
  assert.equal(ferias.categoria, 'Férias');

  const atestado = timeline.find(it => it.tipo === 'Atestado');
  assert.equal(atestado.titulo, 'LTS');
  assert.equal(atestado.descricao, '3 dias - CID: Z00');
  assert.equal(atestado.origem, 'Atestado');
  assert.equal(atestado.categoria, 'Saúde');
});

test('getMilitarTimeline - inclui funções e gratificações', async () => {
  const mockBase44 = {
    entities: {
      RegistroLivro: createMockEntity([]),
      PublicacaoExOfficio: createMockEntity([]),
      Ferias: createMockEntity([]),
      Atestado: createMockEntity([]),
      HistoricoPromocaoMilitarV2: createMockEntity([]),
      Medalha: createMockEntity([]),
      MilitarFuncao: createMockEntity([{ id: 'vf1', militar_id: 'm1', funcao_militar_id: 'f1', data_inicio: '2023-07-01', principal: true, status: 'ativa' }]),
      GratificacaoFuncao: createMockEntity([{ id: 'gf1', militar_id: 'm1', tipo_gratificacao_funcao_id: 'tg1', data_solicitacao: '2023-08-01', funcao_gratificada: 'Comandante', status: 'nomeado_ativo' }]),
      FuncaoMilitar: createMockEntity([{ id: 'f1', nome: 'Comandante de Pelotão' }]),
      TipoGratificacaoFuncao: createMockEntity([{ id: 'tg1', nome: 'Gratificação de Comando' }]),
    },
  };

  __setMilitarTimelineClientForTests(mockBase44);

  const timeline = await getMilitarTimeline('m1');

  assert.equal(timeline.length, 2);

  const func = timeline.find(it => it.tipo === 'Função');
  assert.equal(func.titulo, 'Comandante de Pelotão');
  assert.equal(func.categoria, 'Função');
  assert.ok(func.descricao.includes('Principal'));

  const grat = timeline.find(it => it.tipo === 'Gratificação');
  assert.equal(grat.titulo, 'Gratificação de Comando');
  assert.equal(grat.categoria, 'Gratificação');
  assert.ok(grat.descricao.includes('Comandante'));
});
