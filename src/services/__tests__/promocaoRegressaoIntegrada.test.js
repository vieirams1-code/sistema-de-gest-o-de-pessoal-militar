import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calcularInsercaoPorAntiguidadeAnterior,
  excluirCadeiaPromocaoMilitar,
  montarPayloadAdicaoManualTurma,
  montarPatchPromocaoMilitar,
  publicarPromocaoOficial,
  reverterPublicacaoPromocaoMilitar,
} from '../promocaoService.js';

test('fluxo início de cadeia (3º Sgt): aceita ordem manual, bloqueia ordenação automática e publica com histórico V2 + antiguidade', async () => {
  const promocao = {
    id: 'promo-3sgt',
    posto_graduacao: '3º Sgt',
    quadro: 'QPPM',
    data_promocao: '2026-01-01',
    data_publicacao: '2026-01-02',
    boletim_referencia: 'BG 1',
    ato_referencia: 'ATO 1',
    status: 'ativa',
  };
  const militar = { id: 'm-1', posto_graduacao: 'Aluno', quadro: 'QPPM', data_nascimento: '1990-01-01', matricula: '100' };

  const payloadManual = montarPayloadAdicaoManualTurma({
    promocao,
    historico: { id: 'h-base', militar_id: 'm-1' },
    militar,
    ordem: 7,
    registrosExistentes: [{ ordem: 1 }],
    usuario: { email: 'teste@pm.mil' },
  });
  assert.equal(payloadManual.ordem, 7);

  const insercaoAutomatica = calcularInsercaoPorAntiguidadeAnterior({ promocao, militar, turmaAtual: [], historicos: [], militares: [militar] });
  assert.equal(insercaoAutomatica.podeAdicionar, false);
  assert.equal(insercaoAutomatica.ordemSugerida, null);
  assert.match(insercaoAutomatica.alertas[0], /(manter ordem manual|Sem histórico ativo no posto anterior esperado)/i);

  const chamadas = [];
  const entities = {
    HistoricoPromocaoMilitarV2: {
      list: async () => [],
      create: async (payload) => {
        chamadas.push(['histCreate', payload]);
        return { id: 'hist-v2-1', ...payload };
      },
      update: async () => {},
    },
    PromocaoMilitar: {
      update: async (id, patch) => chamadas.push(['pmUpdate', id, patch]),
    },
    Promocao: {
      update: async (id, patch) => chamadas.push(['promoUpdate', id, patch]),
    },
    Militar: {
      update: async (id, patch) => chamadas.push(['milUpdate', id, patch]),
    },
  };

  const item = { id: 'pm-1', militar_id: militar.id, ordem: 7, selecionado: true, publicado: false, status: 'elegivel', militar };
  await publicarPromocaoOficial({ promocao, itens: [item], entities, temAlteracoesPendentes: false });

  const histPayload = chamadas.find((c) => c[0] === 'histCreate')[1];
  assert.equal(histPayload.antiguidade_referencia_ordem, 7);
  assert.equal(chamadas.some((c) => c[0] === 'pmUpdate' && c[2].status === 'publicado'), true);
});

test('promoção sucessiva histórica (2º Sgt): ordenação usa base anterior e aplica desempates', () => {
  const promocao = { id: 'promo-2sgt', posto_graduacao: '2º Sargento' };
  const militares = [
    { id: 'm-a', data_nascimento: '1991-01-01', matricula: '200' },
    { id: 'm-b', data_nascimento: '1990-01-01', matricula: '201' },
    { id: 'm-c', data_nascimento: '1990-01-01', matricula: '199' },
    { id: 'm-new', data_nascimento: '1992-01-01', matricula: '999' },
  ];
  const turmaAtual = [
    { id: 'pm-a', militar_id: 'm-a', ordem: 1 },
    { id: 'pm-b', militar_id: 'm-b', ordem: 2 },
    { id: 'pm-c', militar_id: 'm-c', ordem: 3 },
  ];
  const historicos = [
    { militar_id: 'm-a', posto_graduacao_novo: '3º Sargento', data_promocao: '2020-01-01', antiguidade_referencia_ordem: 5, status_registro: 'ativo' },
    { militar_id: 'm-b', posto_graduacao_novo: '3º Sargento', data_promocao: '2020-01-01', antiguidade_referencia_ordem: 5, status_registro: 'ativo' },
    { militar_id: 'm-c', posto_graduacao_novo: '3º Sargento', data_promocao: '2020-01-01', antiguidade_referencia_ordem: 5, status_registro: 'ativo' },
    { militar_id: 'm-new', posto_graduacao_novo: '3º Sargento', data_promocao: '2020-01-01', antiguidade_referencia_ordem: 5, status_registro: 'ativo' },
  ];

  const res = calcularInsercaoPorAntiguidadeAnterior({ promocao, militar: militares[3], turmaAtual, historicos, militares });
  assert.equal(res.podeAdicionar, true);
  assert.equal(res.ordemSugerida, 4);
  assert.equal(res.deslocamentos.length, 0);

  const patch = montarPatchPromocaoMilitar({ ordem: 4, selecionado: true, status: 'elegivel' }, { promocao });
  assert.equal(patch.ordem, 4);
});

test('militar sem histórico-base entra no fim com alerta e sem bloquear inclusão', () => {
  const promocao = { id: 'promo-2sgt', posto_graduacao: '2º Sargento' };
  const militar = { id: 'm-sem-base', data_nascimento: '1999-01-01', matricula: '301' };
  const turmaAtual = [{ id: 'pm-1', militar_id: 'm-1', ordem: 1 }, { id: 'pm-2', militar_id: 'm-2', ordem: 2 }];

  const calc = calcularInsercaoPorAntiguidadeAnterior({ promocao, militar, turmaAtual, historicos: [], militares: [militar] });
  assert.equal(calc.podeAdicionar, false);
  assert.match(calc.alertas[0], /Sem histórico ativo no posto anterior esperado/);

  const payload = montarPayloadAdicaoManualTurma({ promocao, militar, militarId: militar.id, registrosExistentes: turmaAtual });
  assert.equal(payload.ordem, 3);
});

test('reversão: cancela histórico, exige motivo e restaura cadastro somente quando coincidir', async () => {
  const chamadas = [];
  const entities = {
    HistoricoPromocaoMilitarV2: {
      get: async () => ({
        id: 'hist-1', status_registro: 'ativo', posto_graduacao_anterior: '1º Sgt', quadro_anterior: 'QPPM', posto_graduacao_novo: 'Subtenente', quadro_novo: 'QPPM',
      }),
      update: async (id, patch) => chamadas.push(['histUpdate', id, patch]),
    },
    PromocaoMilitar: { update: async (id, patch) => chamadas.push(['pmUpdate', id, patch]) },
    Promocao: { update: async (id, patch) => chamadas.push(['promoUpdate', id, patch]) },
    Militar: {
      get: async () => ({ id: 'm-1', posto_graduacao: 'Subtenente', quadro: 'QPPM' }),
      update: async (id, patch) => chamadas.push(['milUpdate', id, patch]),
    },
  };

  const r = await reverterPublicacaoPromocaoMilitar({
    promocao: { id: 'p-1', status: 'publicada' },
    item: { id: 'pm-1', militar_id: 'm-1', historico_promocao_v2_id: 'hist-1', publicado: true, status: 'publicado', atualizar_cadastro_militar: true },
    itensPromocao: [{ id: 'pm-1', publicado: true, status: 'publicado' }],
    entities,
    motivo: 'erro material',
  });
  assert.equal(r.historicoCancelado, true);
  assert.equal(r.cadastroRestaurado, true);
  assert.equal(chamadas.some((c) => c[0] === 'milUpdate'), true);
});

test('exclusão definitiva: não publicado remove, publicado bloqueia, cancelado remove e histórico ativo bloqueia', async () => {
  await assert.rejects(() => excluirCadeiaPromocaoMilitar({ promocaoMilitarId: 'x', motivo: '', entities: {} }), /obrigatório/);

  const entitiesNaoPublicado = {
    PromocaoMilitar: { get: async () => ({ id: 'pm-1', promocao_id: 'p-1', status: 'elegivel', publicado: false }), delete: async () => {}, filter: async () => [] },
    Promocao: { delete: async () => {}, update: async () => {} },
    HistoricoPromocaoMilitarV2: { delete: async () => {} },
  };
  const ok = await excluirCadeiaPromocaoMilitar({ promocaoMilitarId: 'pm-1', motivo: 'nunca publicado', entities: entitiesNaoPublicado });
  assert.equal(ok.promocaoMilitarExcluido, true);

  const entitiesPublicado = {
    PromocaoMilitar: {
      get: async () => ({ id: 'pm-2', promocao_id: 'p-1', status: 'publicado', publicado: true }),
      delete: async () => {},
    },
    Promocao: { delete: async () => {}, update: async () => {} },
    HistoricoPromocaoMilitarV2: { delete: async () => {} },
  };
  await assert.rejects(() => excluirCadeiaPromocaoMilitar({ promocaoMilitarId: 'pm-2', motivo: 'x', entities: entitiesPublicado }), /publicad/);
});

test('lote 7 cadeia complexa: retificar/republicar, reverter/republicar, promoção coletiva parcial, dupla promoção sequencial e coexistência histórico cancelado+ativo', async () => {
  const historicos = [];
  const promocaoMilitarStore = new Map();
  const promocoes = new Map();
  const militares = new Map();
  const idHistorico = () => `hist-${historicos.length + 1}`;

  const entities = {
    HistoricoPromocaoMilitarV2: {
      list: async () => historicos,
      get: async (id) => historicos.find((h) => h.id === id) || null,
      create: async (payload) => {
        const novo = { id: idHistorico(), ...payload };
        historicos.push(novo);
        return novo;
      },
      update: async (id, patch) => {
        const idx = historicos.findIndex((h) => h.id === id);
        historicos[idx] = { ...historicos[idx], ...patch };
      },
    },
    PromocaoMilitar: {
      update: async (id, patch) => promocaoMilitarStore.set(id, { ...(promocaoMilitarStore.get(id) || {}), ...patch }),
    },
    Promocao: {
      update: async (id, patch) => promocoes.set(id, { ...(promocoes.get(id) || {}), ...patch }),
    },
    Militar: {
      get: async (id) => militares.get(id),
      update: async (id, patch) => militares.set(id, { ...militares.get(id), ...patch }),
    },
  };

  // 1) publicar → retificar(manual) → republicar (novo ato, mesma graduação/quadro)
  const promocaoA = { id: 'promo-a', posto_graduacao: '2º Sgt', quadro: 'QPPM', data_promocao: '2026-01-10', status: 'rascunho' };
  const itemA = { id: 'pm-a', militar_id: 'm-a', ordem: 1, status: 'elegivel', publicado: false, militar: { posto_graduacao: '3º Sgt', quadro: 'QPPM' } };
  await publicarPromocaoOficial({ promocao: promocaoA, itens: [itemA], entities });
  const histA1 = historicos.find((h) => h.promocao_id === 'promo-a');
  await entities.HistoricoPromocaoMilitarV2.update(histA1.id, { status_registro: 'retificado', motivo_retificacao: 'erro material' });
  const promocaoA2 = { ...promocaoA, id: 'promo-a2', data_promocao: '2026-01-11' };
  await publicarPromocaoOficial({ promocao: promocaoA2, itens: [{ ...itemA, id: 'pm-a2', publicado: false }], entities });
  assert.equal(historicos.filter((h) => h.militar_id === 'm-a' && h.status_registro === 'ativo').length, 1);

  // 2) publicar → reverter → republicar
  militares.set('m-b', { id: 'm-b', posto_graduacao: 'Subtenente', quadro: 'QPPM' });
  const promocaoB = { id: 'promo-b', posto_graduacao: 'Subtenente', quadro: 'QPPM', data_promocao: '2026-02-01', status: 'publicada' };
  const itemB = { id: 'pm-b', militar_id: 'm-b', ordem: 2, status: 'publicado', publicado: true, atualizar_cadastro_militar: true, militar: { posto_graduacao: '1º Sgt', quadro: 'QPPM' } };
  await publicarPromocaoOficial({ promocao: { ...promocaoB, id: 'promo-b-seed', status: 'rascunho' }, itens: [{ ...itemB, id: 'pm-b-seed', publicado: false, status: 'elegivel' }], entities });
  const histB1 = historicos.findLast((h) => h.militar_id === 'm-b' && h.status_registro === 'ativo');
  await reverterPublicacaoPromocaoMilitar({ promocao: promocaoB, item: { ...itemB, historico_promocao_v2_id: histB1.id }, itensPromocao: [itemB], entities, motivo: 'ajuste legal' });
  await publicarPromocaoOficial({ promocao: { ...promocaoB, id: 'promo-b2', status: 'rascunho', data_promocao: '2026-02-02' }, itens: [{ ...itemB, id: 'pm-b2', publicado: false, status: 'elegivel' }], entities });
  assert.equal(historicos.filter((h) => h.militar_id === 'm-b' && h.status_registro === 'ativo').length, 1);

  // 3) promoção coletiva parcial + 5) ordem manual antes/depois publicação
  const promocaoC = { id: 'promo-c', posto_graduacao: '2º Sgt', quadro: 'QPPM', data_promocao: '2026-03-01', status: 'rascunho' };
  const itensC = [
    { id: 'pm-c1', militar_id: 'm-c1', ordem: 10, status: 'elegivel', publicado: false, militar: { posto_graduacao: '3º Sgt', quadro: 'QPPM' } },
    { id: 'pm-c2', militar_id: 'm-c2', ordem: 11, status: 'cancelado', publicado: false, militar: { posto_graduacao: '3º Sgt', quadro: 'QPPM' } },
  ];
  await assert.rejects(() => publicarPromocaoOficial({ promocao: promocaoC, itens: itensC, entities }), /bloqueado\/cancelado\/retificado/);
  await publicarPromocaoOficial({ promocao: promocaoC, itens: [itensC[0]], entities });
  const histC1 = historicos.findLast((h) => h.militar_id === 'm-c1');
  assert.equal(histC1.antiguidade_referencia_ordem, 10);
  await entities.PromocaoMilitar.update('pm-c1', { ordem: 12 }); // alteração manual após publicar
  assert.equal(promocaoMilitarStore.get('pm-c1').ordem, 12);

  // 4) militar promovido duas vezes seguidas: 3º Sgt -> 2º Sgt -> 1º Sgt
  const militarSeq = { id: 'm-seq', posto_graduacao: '3º Sgt', quadro: 'QPPM' };
  militares.set('m-seq', militarSeq);
  await publicarPromocaoOficial({
    promocao: { id: 'promo-d1', posto_graduacao: '2º Sgt', quadro: 'QPPM', data_promocao: '2026-04-01', status: 'rascunho' },
    itens: [{ id: 'pm-d1', militar_id: 'm-seq', ordem: 20, status: 'elegivel', publicado: false, militar: militarSeq }],
    entities,
  });
  await publicarPromocaoOficial({
    promocao: { id: 'promo-d2', posto_graduacao: '1º Sgt', quadro: 'QPPM', data_promocao: '2026-05-01', status: 'rascunho' },
    itens: [{ id: 'pm-d2', militar_id: 'm-seq', ordem: 4, status: 'elegivel', publicado: false, militar: { id: 'm-seq', posto_graduacao: '2º Sgt', quadro: 'QPPM' } }],
    entities,
  });
  const seqAtivos = historicos.filter((h) => h.militar_id === 'm-seq' && h.status_registro === 'ativo');
  assert.equal(seqAtivos.length, 2);
  assert.equal(seqAtivos[0].posto_graduacao_novo, '2º Sgt');
  assert.equal(seqAtivos[1].posto_graduacao_novo, '1º Sgt');

  // 6) coexistência de histórico cancelado com histórico ativo
  const histosB = historicos.filter((h) => h.militar_id === 'm-b');
  assert.equal(histosB.some((h) => h.status_registro === 'cancelado'), true);
  assert.equal(histosB.some((h) => h.status_registro === 'ativo'), true);
});
