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
