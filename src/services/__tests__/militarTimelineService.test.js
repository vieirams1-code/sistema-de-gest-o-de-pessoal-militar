import test from 'node:test';
import assert from 'node:assert/strict';
import { getMilitarTimeline, __setMilitarTimelineClientForTests } from '../militarTimelineService.js';

// Helper para criar mock de entidade
const createMockEntity = (data = []) => ({
  filter: async () => data,
});

test('getMilitarTimeline - ordena por data decrescente', async () => {
  const mockBase44 = {
    entities: {
      RegistroLivro: createMockEntity([{ data_publicacao: '2023-01-01', tipo_registro: 'Evento A' }]),
      PublicacaoExOfficio: createMockEntity([{ data_publicacao: '2023-02-01', tipo: 'Evento B' }]),
      Ferias: createMockEntity([{ data_inicio: '2023-03-01', dias: 30 }]),
      Atestado: createMockEntity([{ data_inicio: '2023-04-01', dias: 5 }]),
      HistoricoPromocaoMilitarV2: createMockEntity([{ data_promocao: '2023-05-01', posto_graduacao_novo: 'Cabo' }]),
      Medalha: createMockEntity([{ data_concessao: '2023-06-01', tipo_medalha_nome: 'Medalha X' }]),
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
});

test('getMilitarTimeline - lida com múltiplos eventos na mesma data', async () => {
  const mockBase44 = {
    entities: {
      RegistroLivro: createMockEntity([{ data_publicacao: '2023-01-01', tipo_registro: 'Evento A' }]),
      PublicacaoExOfficio: createMockEntity([{ data_publicacao: '2023-01-01', tipo: 'Evento B' }]),
      Ferias: createMockEntity([]),
      Atestado: createMockEntity([]),
      HistoricoPromocaoMilitarV2: createMockEntity([]),
      Medalha: createMockEntity([]),
    },
  };

  __setMilitarTimelineClientForTests(mockBase44);

  const timeline = await getMilitarTimeline('m1');

  assert.equal(timeline.length, 2);
  assert.equal(timeline[0].data, '2023-01-01');
  assert.equal(timeline[1].data, '2023-01-01');
});

test('getMilitarTimeline - lida com eventos sem data (coloca no fim)', async () => {
  const mockBase44 = {
    entities: {
      RegistroLivro: createMockEntity([{ data_publicacao: '2023-01-01', tipo_registro: 'Com data' }]),
      PublicacaoExOfficio: createMockEntity([{ data_publicacao: null, tipo: 'Sem data' }]),
      Ferias: createMockEntity([]),
      Atestado: createMockEntity([]),
      HistoricoPromocaoMilitarV2: createMockEntity([]),
      Medalha: createMockEntity([]),
    },
  };

  __setMilitarTimelineClientForTests(mockBase44);

  const timeline = await getMilitarTimeline('m1');

  assert.equal(timeline.length, 2);
  assert.equal(timeline[0].titulo, 'Com data');
  assert.equal(timeline[1].titulo, 'Sem data');
});

test('getMilitarTimeline - remove eventos duplicados', async () => {
  const event = { data_publicacao: '2023-01-01', tipo_registro: 'Duplicado', conteudo: 'Mesmo conteúdo' };
  const mockBase44 = {
    entities: {
      RegistroLivro: createMockEntity([event, event]),
      PublicacaoExOfficio: createMockEntity([]),
      Ferias: createMockEntity([]),
      Atestado: createMockEntity([]),
      HistoricoPromocaoMilitarV2: createMockEntity([]),
      Medalha: createMockEntity([]),
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
      Ferias: createMockEntity([{ data_inicio: '2023-01-01', dias: 15, periodo_aquisitivo_ref: '2022/2023' }]),
      Atestado: createMockEntity([{ data_inicio: '2023-02-01', dias: 3, tipo_afastamento: 'LTS', cid_10: 'Z00' }]),
      HistoricoPromocaoMilitarV2: createMockEntity([{ data_promocao: '2023-03-01', posto_graduacao_novo: 'Sgt', quadro_novo: 'QPBM', boletim_referencia: 'BG 100' }]),
      Medalha: createMockEntity([]),
    },
  };

  __setMilitarTimelineClientForTests(mockBase44);

  const timeline = await getMilitarTimeline('m1');

  const promo = timeline.find(it => it.tipo === 'Promoção');
  assert.equal(promo.titulo, 'Sgt QPBM');
  assert.equal(promo.descricao, 'Boletim: BG 100');

  const ferias = timeline.find(it => it.tipo === 'Férias');
  assert.equal(ferias.descricao, '15 dias ref. ao período 2022/2023');

  const atestado = timeline.find(it => it.tipo === 'Atestado');
  assert.equal(atestado.titulo, 'LTS');
  assert.equal(atestado.descricao, '3 dias - CID: Z00');
});
