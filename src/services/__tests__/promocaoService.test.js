import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  avaliarAlertasTurmaOperacional,
  avaliarCompatibilidadePromocao,
  buscarCandidatosProvaveis,
  excluirCadeiaPromocaoMilitar,
  filtrarCandidatosCompativeis,
  mensagemBloqueioExclusaoPromocao,
  montarDiagnosticoMilitaresPromocao,
  montarPatchPromocaoMilitar,
  montarPayloadAdicaoManualTurma,
  montarPayloadsPromocaoMilitarAgrupamento,
  motivosBloqueioVinculoProvavel,
  promocaoPermiteExclusao,
  podeVincularProvavelAdministrativamente,
  publicarPromocaoOficial,
  reverterPublicacaoPromocaoMilitar,
  validarPublicacaoPromocao,
  validarSalvarTurmaOperacional,
} from '../promocaoService.js';

test('exclusão definitiva remove histórico, item e exclui promoção quando ficar vazia', async () => {
  const chamadas = [];
  const entities = {
    PromocaoMilitar: {
      get: async () => ({ id: 'pm-1', promocao_id: 'promo-1', status: 'cancelado', publicado: false, historico_promocao_v2_id: 'hist-1' }),
      delete: async (id) => chamadas.push(['pmDelete', id]),
      filter: async () => [],
    },
    HistoricoPromocaoMilitarV2: {
      get: async () => ({ id: 'hist-1' }),
      delete: async (id) => chamadas.push(['histDelete', id]),
    },
    Promocao: {
      delete: async (id) => chamadas.push(['promoDelete', id]),
      update: async (id, patch) => chamadas.push(['promoUpdate', id, patch]),
    },
  };

  const resultado = await excluirCadeiaPromocaoMilitar({
    promocaoMilitarId: 'pm-1',
    motivo: 'Cancelado em duplicidade',
    entities,
  });

  assert.equal(resultado.promocaoExcluida, true);
  assert.deepEqual(chamadas, [
    ['histDelete', 'hist-1'],
    ['pmDelete', 'pm-1'],
    ['promoDelete', 'promo-1'],
  ]);
});

test('exclusão definitiva recalcula promoção quando ainda houver itens', async () => {
  const chamadas = [];
  const entities = {
    PromocaoMilitar: {
      get: async () => ({ id: 'pm-1', promocao_id: 'promo-1', status: 'cancelado', publicado: false }),
      delete: async (id) => chamadas.push(['pmDelete', id]),
      filter: async () => [{ id: 'pm-2', status: 'publicado', publicado: true }],
    },
    HistoricoPromocaoMilitarV2: {
      delete: async () => {},
    },
    Promocao: {
      delete: async () => chamadas.push(['promoDelete']),
      update: async (id, patch) => chamadas.push(['promoUpdate', id, patch]),
    },
  };

  const resultado = await excluirCadeiaPromocaoMilitar({
    promocaoMilitarId: 'pm-1',
    motivo: 'Retirado por revisão administrativa',
    entities,
  });

  assert.equal(resultado.promocaoExcluida, false);
  assert.deepEqual(chamadas, [
    ['pmDelete', 'pm-1'],
    ['promoUpdate', 'promo-1', { status: 'publicada' }],
  ]);
});

const promocao = {
  id: 'promo-1',
  posto_graduacao: 'Capitão',
  quadro: 'QOPM',
  data_promocao: '2026-04-21',
  data_publicacao: '2026-04-22',
  boletim_referencia: 'BG 10',
  ato_referencia: 'ATO 5',
  status: 'ativa',
};


test('exclusão de promoção é permitida para rascunho sem vínculo real informado', () => {
  assert.equal(promocaoPermiteExclusao({ status: 'rascunho' }), true);
  assert.equal(mensagemBloqueioExclusaoPromocao({ status: 'rascunho' }), '');
});

test('exclusão de promoção não rascunho é permitida sem PromocaoMilitar vinculado real', () => {
  for (const status of ['ativa', 'publicada', 'publicado', 'concluída', 'concluida', 'homologada']) {
    assert.equal(promocaoPermiteExclusao({ status }, { vinculadosReais: 0 }), true);
    assert.equal(mensagemBloqueioExclusaoPromocao({ status }, { vinculadosReais: 0 }), '');
  }
});

test('exclusão de promoção é bloqueada quando há PromocaoMilitar vinculado real', () => {
  assert.equal(promocaoPermiteExclusao({ status: 'rascunho' }, { vinculadosReais: 1 }), false);
  assert.equal(promocaoPermiteExclusao({ status: 'ativa' }, { turma: [{ id: 'pm-1', militar_id: 'm1' }] }), false);
  assert.equal(
    mensagemBloqueioExclusaoPromocao({ status: 'ativa' }, { turma: [{ id: 'pm-1', militar_id: 'm1' }] }),
    'Somente promoções em rascunho ou sem militares vinculados reais podem ser excluídas.',
  );
});

test('exclusão de promoção é bloqueada quando há vínculo oficial sensível na turma', () => {
  assert.equal(
    promocaoPermiteExclusao(
      { status: 'rascunho' },
      { turma: [{ id: 'pm-1', historico_promocao_v2_id: 'hist-1' }] },
    ),
    false,
  );
});

test('classifica compatibilidade forte somente quando chave completa bate', () => {
  const historico = {
    posto_graduacao_novo: 'Capitão',
    quadro_novo: 'QOPM',
    data_promocao: '2026-04-21',
    data_publicacao: '2026-04-22',
    boletim_referencia: 'BG 10',
    ato_referencia: 'ATO 5',
    status_registro: 'ativo',
    antiguidade_referencia_ordem: 1,
  };

  assert.deepEqual(avaliarCompatibilidadePromocao(historico, promocao), {
    compatibilidade: 'forte',
    motivos: [],
  });
});

test('classifica provável quando bate posto, quadro e data, mas falta boletim ou ato', () => {
  const historico = {
    posto_graduacao_novo: 'Capitão',
    quadro_novo: 'QOPM',
    data_promocao: '2026-04-21',
    data_publicacao: '2026-04-22',
    boletim_referencia: '',
    ato_referencia: '',
    status_registro: 'ativo',
    antiguidade_referencia_ordem: 2,
  };

  const avaliacao = avaliarCompatibilidadePromocao(historico, promocao);
  assert.equal(avaliacao.compatibilidade, 'provável');
  assert.deepEqual(avaliacao.motivos, ['faltando boletim', 'faltando ato']);
});

test('somente compatibilidade forte entra como candidato vinculável', () => {
  const forte = {
    id: 'h1',
    posto_graduacao_novo: 'Capitão',
    quadro_novo: 'QOPM',
    data_promocao: '2026-04-21',
    data_publicacao: '2026-04-22',
    boletim_referencia: 'BG 10',
    ato_referencia: 'ATO 5',
    status_registro: 'ativo',
    antiguidade_referencia_ordem: 1,
  };
  const provavel = { ...forte, id: 'h2', boletim_referencia: '' };
  const jaVinculado = { ...forte, id: 'h3', promocao_id: 'outra' };

  assert.deepEqual(filtrarCandidatosCompativeis({ promocao, historicos: [forte, provavel, jaVinculado] }).map((h) => h.id), ['h1']);
  assert.deepEqual(buscarCandidatosProvaveis({ promocao, historicos: [forte, provavel, jaVinculado] }).map((h) => h.id), ['h2', 'h3']);
});

test('diagnóstico por militar expõe conflitos, prováveis e sem histórico V2', () => {
  const historicos = [
    {
      id: 'h1',
      militar_id: 'm1',
      posto_graduacao_novo: 'Capitão',
      quadro_novo: 'QOPM',
      data_promocao: '2026-04-21',
      data_publicacao: '2026-04-22',
      boletim_referencia: 'BG 10',
      ato_referencia: 'ATO 5',
      status_registro: 'ativo',
      antiguidade_referencia_ordem: 1,
      promocao_id: 'outra',
    },
    {
      id: 'h2',
      militar_id: 'm2',
      posto_graduacao_novo: 'Capitão',
      quadro_novo: 'QOPM',
      data_promocao: '2026-04-21',
      data_publicacao: '2026-04-22',
      boletim_referencia: '',
      ato_referencia: 'ATO 5',
      status_registro: 'ativo',
      antiguidade_referencia_ordem: 2,
    },
  ];
  const militares = [
    { id: 'm1', nome_guerra: 'João', posto_graduacao: 'Capitão', quadro: 'QOPM' },
    { id: 'm2', nome_guerra: 'Pedro', posto_graduacao: 'Capitão', quadro: 'QOPM' },
    { id: 'm3', nome_guerra: 'Carlos', posto_graduacao: 'Capitão', quadro: 'QOPM' },
  ];

  const linhas = montarDiagnosticoMilitaresPromocao({ promocao, historicos, militares });
  assert.equal(linhas.find((linha) => linha.militar_id === 'm1').acaoSugerida, 'Conflito');
  assert.equal(linhas.find((linha) => linha.militar_id === 'm2').motivo, 'faltando boletim');
  assert.equal(linhas.find((linha) => linha.militar_id === 'm3').motivo, 'Sem histórico V2');
});


test('provável por boletim, ato ou data de publicação divergente pode ser vinculado administrativamente', () => {
  const base = {
    id: 'h-provavel',
    militar_id: 'm1',
    posto_graduacao_novo: 'Capitão',
    quadro_novo: 'QOPM',
    data_promocao: '2026-04-21',
    data_publicacao: '2026-04-22',
    boletim_referencia: 'BG 10',
    ato_referencia: 'ATO 5',
    status_registro: 'ativo',
    antiguidade_referencia_ordem: 1,
  };

  const semBoletim = { ...base, id: 'h-sem-boletim', boletim_referencia: '' };
  const semAto = { ...base, id: 'h-sem-ato', ato_referencia: '' };
  const publicacaoDivergente = { ...base, id: 'h-pub-div', data_publicacao: '2026-04-23' };

  assert.equal(podeVincularProvavelAdministrativamente(semBoletim, promocao), true);
  assert.equal(podeVincularProvavelAdministrativamente(semAto, promocao), true);
  assert.equal(podeVincularProvavelAdministrativamente(publicacaoDivergente, promocao), true);
  assert.deepEqual(avaliarCompatibilidadePromocao(publicacaoDivergente, promocao).motivos, ['data de publicação divergente']);
});

test('provável com data de promoção divergente ou bloqueios graves não pode ser vinculado administrativamente', () => {
  const base = {
    id: 'h-base',
    militar_id: 'm1',
    posto_graduacao_novo: 'Capitão',
    quadro_novo: 'QOPM',
    data_promocao: '2026-04-21',
    data_publicacao: '2026-04-23',
    boletim_referencia: 'BG 10',
    ato_referencia: 'ATO 5',
    status_registro: 'ativo',
    antiguidade_referencia_ordem: 1,
  };

  const dataPromocaoDivergente = { ...base, data_promocao: '2026-04-20' };
  const cancelado = { ...base, status_registro: 'cancelado' };
  const retificado = { ...base, status_registro: 'retificado' };
  const vinculadoOutra = { ...base, promocao_id: 'outra-promocao' };
  const semMilitar = { ...base, militar_id: '' };

  assert.equal(podeVincularProvavelAdministrativamente(dataPromocaoDivergente, promocao), false);
  assert.deepEqual(avaliarCompatibilidadePromocao(dataPromocaoDivergente, promocao).motivos, ['data de promoção divergente']);
  assert.deepEqual(motivosBloqueioVinculoProvavel(dataPromocaoDivergente, promocao), ['data de promoção divergente']);
  assert.equal(podeVincularProvavelAdministrativamente(cancelado, promocao), false);
  assert.equal(podeVincularProvavelAdministrativamente(retificado, promocao), false);
  assert.equal(podeVincularProvavelAdministrativamente(vinculadoOutra, promocao), false);
  assert.equal(podeVincularProvavelAdministrativamente(semMilitar, promocao), false);
});


test('patch de edição da turma altera somente campos operacionais de PromocaoMilitar', () => {
  const patchOrdem = montarPatchPromocaoMilitar({
    id: 'pm1',
    promocao_id: 'promo-1',
    militar_id: 'm1',
    ordem: 7,
    selecionado: true,
    status: 'elegivel',
    justificativa: '',
    observacao: '',
    publicado: false,
  });

  assert.deepEqual(Object.keys(patchOrdem).sort(), [
    'atualizar_cadastro_militar',
    'justificativa',
    'motivo_atualizacao_cadastro',
    'observacao',
    'ordem',
    'resultado_aplicacao_cadastro',
    'selecionado',
    'status',
  ]);
  assert.equal(patchOrdem.ordem, 7);
  assert.equal(patchOrdem.selecionado, true);
  assert.equal(patchOrdem.status, 'elegivel');
  assert.equal(Object.hasOwn(patchOrdem, 'militar_id'), false);
  assert.equal(Object.hasOwn(patchOrdem, 'historico_promocao_v2_id'), false);
});


test('patch de edição nunca envia ordem como string vazia', () => {
  const patch = montarPatchPromocaoMilitar({
    id: 'pm1',
    ordem: '',
    selecionado: true,
    status: 'selecionado',
  });

  assert.equal(Object.hasOwn(patch, 'ordem'), false);
  assert.notEqual(patch.ordem, '');
});

test('bloqueado ou cancelado sem justificativa bloqueia salvar turma', () => {
  const validacao = validarSalvarTurmaOperacional([
    { id: 'pm1', militar_id: 'm1', ordem: 1, selecionado: false, status: 'bloqueado', justificativa: '' },
  ]);

  assert.equal(validacao.valido, false);
  assert.deepEqual(validacao.bloqueios, ['bloqueado/cancelado sem justificativa']);
});

test('ordem duplicada entre selecionados bloqueia salvar turma', () => {
  const validacao = validarSalvarTurmaOperacional([
    { id: 'pm1', militar_id: 'm1', ordem: 1, selecionado: true, status: 'selecionado', justificativa: '' },
    { id: 'pm2', militar_id: 'm2', ordem: 1, selecionado: true, status: 'selecionado', justificativa: '' },
  ]);

  assert.equal(validacao.valido, false);
  assert.deepEqual(validacao.bloqueios, ['ordem duplicada entre selecionados']);
});

test('ordem vazia gera alerta visual, mas não bloqueia salvar', () => {
  const turma = [{ id: 'pm1', militar_id: 'm1', ordem: '', selecionado: true, status: 'selecionado', justificativa: '' }];
  const alertas = avaliarAlertasTurmaOperacional(turma);
  const validacao = validarSalvarTurmaOperacional(turma);

  assert.deepEqual(alertas.alertasPorId.get('pm1'), ['sem ordem']);
  assert.equal(validacao.valido, true);
});

test('duplicidade de militar na turma bloqueia salvar', () => {
  const validacao = validarSalvarTurmaOperacional([
    { id: 'pm1', militar_id: 'm1', ordem: 1, selecionado: true, status: 'selecionado' },
    { id: 'pm2', militar_id: 'm1', ordem: 2, selecionado: true, status: 'selecionado' },
  ]);

  assert.equal(validacao.valido, false);
  assert.deepEqual(validacao.bloqueios, ['militar duplicado na turma']);
});

test('payload de adicionar candidato cria apenas PromocaoMilitar em rascunho operacional', () => {
  const payload = montarPayloadAdicaoManualTurma({
    promocao,
    historico: { id: 'h1', militar_id: 'm1' },
    usuario: { email: 'operador@example.test' },
    registrosExistentes: [{ ordem: 1 }, { ordem: 4 }, { ordem: 9 }],
  });

  assert.equal(payload.promocao_id, 'promo-1');
  assert.equal(payload.militar_id, 'm1');
  assert.equal(payload.status, 'elegivel');
  assert.equal(payload.selecionado, false);
  assert.equal(payload.publicado, false);
  assert.equal(payload.origem, 'adicao_manual');
  assert.equal(payload.ordem, 10);
  assert.notEqual(payload.ordem, '');
  assert.equal(payload.usuario_vinculo, 'operador@example.test');
  assert.equal(Object.hasOwn(payload, 'status_registro'), false);
  assert.equal(Object.hasOwn(payload, 'posto_graduacao'), false);
});


test('promoção criada por agrupamento com 8 históricos cria 8 PromocaoMilitar', () => {
  const historicos = Array.from({ length: 8 }, (_, index) => ({
    id: `h${index + 1}`,
    militar_id: `m${index + 1}`,
    antiguidade_referencia_ordem: index + 1,
  }));
  const payloads = montarPayloadsPromocaoMilitarAgrupamento({ promocao, historicos });

  assert.equal(payloads.length, 8);
  assert.deepEqual(payloads.map((payload) => payload.militar_id), ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8']);
  assert.equal(payloads.every((payload) => payload.promocao_id === 'promo-1'), true);
  assert.equal(payloads.every((payload) => payload.status === 'publicado' && payload.selecionado === true && payload.publicado === true), true);
  assert.equal(payloads.every((payload) => payload.origem === 'agrupamento'), true);
});

test('reverte item publicado cancelando histórico sem delete físico', async () => {
  const calls = { historicoUpdate: 0, historicoDelete: 0 };
  const entities = {
    HistoricoPromocaoMilitarV2: {
      get: async () => ({ id: 'h1', posto_graduacao_anterior: '1º Sgt', quadro_anterior: 'QPPM', posto_graduacao_novo: 'Subtenente', quadro_novo: 'QPPM' }),
      update: async () => { calls.historicoUpdate += 1; },
      delete: async () => { calls.historicoDelete += 1; },
    },
    PromocaoMilitar: { update: async () => {} },
    Promocao: { update: async () => {} },
  };
  await reverterPublicacaoPromocaoMilitar({
    promocao: { id: 'p1' },
    item: { id: 'pm1', publicado: true, status: 'publicado', historico_promocao_v2_id: 'h1', militar_id: 'm1', militar: { id: 'm1' } },
    itensPromocao: [{ id: 'pm1', publicado: true, status: 'publicado' }],
    entities,
    motivo: 'Erro material',
  });
  assert.equal(calls.historicoUpdate, 1);
  assert.equal(calls.historicoDelete, 0);
});

test('reversão restaura cadastro quando elegível e ainda coincidente', async () => {
  const calls = { militarUpdate: null };
  const entities = {
    HistoricoPromocaoMilitarV2: {
      get: async () => ({ id: 'h1', posto_graduacao_anterior: '1º Sgt', quadro_anterior: 'QPPM', posto_graduacao_novo: 'Subtenente', quadro_novo: 'QPPM' }),
      update: async () => {},
    },
    Militar: {
      get: async () => ({ id: 'm1', posto_graduacao: 'Subtenente', quadro: 'QPPM' }),
      update: async (_id, patch) => { calls.militarUpdate = patch; },
    },
    PromocaoMilitar: { update: async () => {} },
    Promocao: { update: async () => {} },
  };
  const resultado = await reverterPublicacaoPromocaoMilitar({
    promocao: { id: 'p1' },
    item: { id: 'pm1', publicado: true, status: 'publicado', historico_promocao_v2_id: 'h1', militar_id: 'm1', militar: { id: 'm1' }, atualizar_cadastro_militar: true },
    itensPromocao: [{ id: 'pm1', publicado: true, status: 'publicado' }],
    entities,
    motivo: 'Retificação administrativa',
  });
  assert.deepEqual(calls.militarUpdate, { posto_graduacao: '1º Sgt', quadro: 'QPPM' });
  assert.equal(resultado.cadastroRestaurado, true);
});

test('reversão restaura cadastro usando militar_id mesmo sem objeto militar no item', async () => {
  const calls = { militarGetId: '', militarUpdate: null };
  const entities = {
    HistoricoPromocaoMilitarV2: {
      get: async () => ({ id: 'h1', posto_graduacao_anterior: '1º Sgt', quadro_anterior: 'QPPM', posto_graduacao_novo: 'Subtenente', quadro_novo: 'QPPM' }),
      update: async () => {},
    },
    Militar: {
      get: async (id) => {
        calls.militarGetId = id;
        return { id: 'm1', posto_graduacao: 'Subtenente', quadro: 'QPPM' };
      },
      update: async (_id, patch) => { calls.militarUpdate = patch; },
    },
    PromocaoMilitar: { update: async () => {} },
    Promocao: { update: async () => {} },
  };

  const resultado = await reverterPublicacaoPromocaoMilitar({
    promocao: { id: 'p1' },
    item: { id: 'pm1', publicado: true, status: 'publicado', historico_promocao_v2_id: 'h1', militar_id: 'm1', atualizar_cadastro_militar: true },
    itensPromocao: [{ id: 'pm1', publicado: true, status: 'publicado' }],
    entities,
    motivo: 'Retificação administrativa',
  });

  assert.equal(calls.militarGetId, 'm1');
  assert.deepEqual(calls.militarUpdate, { posto_graduacao: '1º Sgt', quadro: 'QPPM' });
  assert.equal(resultado.cadastroRestaurado, true);
});

test('reversão bloqueia rollback de cadastro quando militar já divergiu', async () => {
  let atualizou = false;
  const entities = {
    HistoricoPromocaoMilitarV2: {
      get: async () => ({ id: 'h1', posto_graduacao_anterior: '1º Sgt', quadro_anterior: 'QPPM', posto_graduacao_novo: 'Subtenente', quadro_novo: 'QPPM' }),
      update: async () => {},
    },
    Militar: {
      get: async () => ({ id: 'm1', posto_graduacao: 'Capitão', quadro: 'QOPM' }),
      update: async () => { atualizou = true; },
    },
    PromocaoMilitar: { update: async () => {} },
    Promocao: { update: async () => {} },
  };
  const resultado = await reverterPublicacaoPromocaoMilitar({
    promocao: { id: 'p1' },
    item: { id: 'pm1', publicado: true, status: 'publicado', historico_promocao_v2_id: 'h1', militar_id: 'm1', militar: { id: 'm1' }, resultado_aplicacao_cadastro: 'imediatamente_superior' },
    itensPromocao: [{ id: 'pm1', publicado: true, status: 'publicado' }],
    entities,
    motivo: 'Publicação indevida',
  });
  assert.equal(atualizou, false);
  assert.equal(resultado.cadastroRestaurado, false);
});

test('reversão parcial mantém promoção publicada parcial', async () => {
  let statusPromocao = '';
  const entities = {
    HistoricoPromocaoMilitarV2: { get: async () => ({ id: 'h1' }), update: async () => {} },
    PromocaoMilitar: { update: async () => {} },
    Promocao: { update: async (_id, patch) => { statusPromocao = patch.status; } },
  };
  await reverterPublicacaoPromocaoMilitar({
    promocao: { id: 'p1' },
    item: { id: 'pm1', publicado: true, status: 'publicado', historico_promocao_v2_id: 'h1', militar_id: 'm1' },
    itensPromocao: [{ id: 'pm1', publicado: true, status: 'publicado' }, { id: 'pm2', publicado: true, status: 'publicado' }],
    entities,
    motivo: 'Outro',
  });
  assert.equal(statusPromocao, 'publicada_parcial');
});

test('reversão total move promoção para rascunho', async () => {
  let statusPromocao = '';
  const entities = {
    HistoricoPromocaoMilitarV2: { get: async () => ({ id: 'h1' }), update: async () => {} },
    PromocaoMilitar: { update: async () => {} },
    Promocao: { update: async (_id, patch) => { statusPromocao = patch.status; } },
  };
  await reverterPublicacaoPromocaoMilitar({
    promocao: { id: 'p1' },
    item: { id: 'pm1', publicado: true, status: 'publicado', historico_promocao_v2_id: 'h1', militar_id: 'm1' },
    itensPromocao: [{ id: 'pm1', publicado: true, status: 'publicado' }],
    entities,
    motivo: 'Outro',
  });
  assert.equal(statusPromocao, 'rascunho');
});

test('idempotência: segunda reversão é bloqueada sem corromper', async () => {
  const entities = {
    HistoricoPromocaoMilitarV2: { get: async () => ({ id: 'h1' }), update: async () => {} },
    PromocaoMilitar: { update: async () => {} },
    Promocao: { update: async () => {} },
  };
  await assert.rejects(
    () => reverterPublicacaoPromocaoMilitar({
      promocao: { id: 'p1' },
      item: { id: 'pm1', publicado: false, status: 'cancelado', historico_promocao_v2_id: 'h1', militar_id: 'm1' },
      itensPromocao: [{ id: 'pm1', publicado: false, status: 'cancelado' }],
      entities,
      motivo: 'Outro',
    }),
    /Somente itens publicados podem ser revertidos/,
  );
});

test('promoção por agrupamento não cria PromocaoMilitar duplicado por promocao_id e militar_id', () => {
  const historicos = [
    { id: 'h1', militar_id: 'm1', antiguidade_referencia_ordem: 1 },
    { id: 'h2', militar_id: 'm2', antiguidade_referencia_ordem: 2 },
  ];
  const payloads = montarPayloadsPromocaoMilitarAgrupamento({
    promocao,
    historicos,
    registrosExistentes: [{ promocao_id: 'promo-1', militar_id: 'm1', ordem: 7 }],
  });

  assert.deepEqual(payloads.map((payload) => payload.militar_id), ['m2']);
});

test('backfill não recria PromocaoMilitar quando já existe cancelado para mesmo promocao_id + militar_id', () => {
  const historicos = [{ id: 'h1', militar_id: 'm1', antiguidade_referencia_ordem: 1 }];
  const payloads = montarPayloadsPromocaoMilitarAgrupamento({
    promocao,
    historicos,
    registrosExistentes: [{ promocao_id: 'promo-1', militar_id: 'm1', status: 'cancelado', publicado: false }],
  });
  assert.equal(payloads.length, 0);
});

test('ordem numérica do histórico é preservada ao montar turma do agrupamento', () => {
  const [payload] = montarPayloadsPromocaoMilitarAgrupamento({
    promocao,
    historicos: [{ id: 'h1', militar_id: 'm1', antiguidade_referencia_ordem: '7' }],
  });

  assert.equal(payload.ordem, 7);
  assert.equal(typeof payload.ordem, 'number');
});

test('ordem vazia no histórico vira próximo número válido na turma do agrupamento', () => {
  const [payload] = montarPayloadsPromocaoMilitarAgrupamento({
    promocao,
    historicos: [{ id: 'h1', militar_id: 'm1', antiguidade_referencia_ordem: '' }],
    registrosExistentes: [{ ordem: 1 }, { ordem: 4 }, { ordem: 9 }],
  });

  assert.equal(payload.ordem, 10);
  assert.notEqual(payload.ordem, '');
});

test('alertas cobrem publicado sem histórico e publicado desselecionado', () => {
  const alertas = avaliarAlertasTurmaOperacional([
    { id: 'pm1', militar_id: 'm1', ordem: 1, selecionado: false, status: 'publicado', publicado: true, historico_promocao_v2_id: '' },
  ]);

  assert.deepEqual(alertas.alertasPorId.get('pm1'), [
    'publicado mas selecionado = false',
    'status publicado sem historico_promocao_v2_id',
  ]);
});


test('salvar turma não depende mais de marcação manual para promoção inferior', () => {
  const validacao = validarSalvarTurmaOperacional([
    {
      id: 'pm1',
      militar_id: 'm1',
      ordem: 1,
      selecionado: true,
      status: 'selecionado',
      atualizar_cadastro_militar: true,
      militar: { posto_graduacao: 'Subtenente' },
    },
  ], { promocao: { posto_graduacao: '3º Sargento' } });

  assert.equal(validacao.valido, true);
});

test('promoção inferior com cadastro preservado pode ser salva', () => {
  const validacao = validarSalvarTurmaOperacional([
    {
      id: 'pm1',
      militar_id: 'm1',
      ordem: 1,
      selecionado: true,
      status: 'selecionado',
      atualizar_cadastro_militar: false,
      militar: { posto_graduacao: 'Subtenente' },
    },
  ], { promocao: { posto_graduacao: '3º Sargento' } });

  assert.equal(validacao.valido, true);
});

test('salvar turma persiste campos derivados automaticamente no patch', () => {
  const patch = montarPatchPromocaoMilitar({
    id: 'pm1',
    ordem: 1,
    selecionado: true,
    status: 'selecionado',
    atualizar_cadastro_militar: false,
    motivo_atualizacao_cadastro: '',
    resultado_aplicacao_cadastro: '',
    militar: { posto_graduacao: 'Cabo' },
  }, { promocao: { posto_graduacao: '3º Sargento' } });

  assert.equal(patch.atualizar_cadastro_militar, true);
  assert.equal(patch.motivo_atualizacao_cadastro, 'Promoção imediatamente superior ao cadastro atual.');
  assert.equal(patch.resultado_aplicacao_cadastro, 'imediatamente_superior');
});


test('runtime de salvar turma para Tenentes recalcula imediatamente superior e não bloqueia', () => {
  const casos = [
    ['2º Tenente', '1º Tenente'],
    ['2º Ten', '1º Ten'],
    ['Segundo Tenente', 'Primeiro Tenente'],
  ];

  for (const [origem, destino] of casos) {
    const item = {
      id: `pm-${origem}`,
      militar_id: 'm1',
      ordem: 1,
      selecionado: true,
      status: 'selecionado',
      militar: { posto_graduacao: origem },
    };
    const promocaoTenente = { posto_graduacao: destino };
    const patch = montarPatchPromocaoMilitar(item, { promocao: promocaoTenente });
    const validacao = validarSalvarTurmaOperacional([item], { promocao: promocaoTenente });

    assert.equal(patch.resultado_aplicacao_cadastro, 'imediatamente_superior', `${origem} -> ${destino}`);
    assert.equal(patch.atualizar_cadastro_militar, true);
    assert.equal(validacao.valido, true);
    assert.deepEqual(validacao.bloqueios, []);
  }
});

test('salvar turma bloqueia quando houver item incompatível', () => {
  const validacao = validarSalvarTurmaOperacional([
    {
      id: 'pm1',
      militar_id: 'm1',
      ordem: 1,
      selecionado: true,
      status: 'selecionado',
      militar: { posto_graduacao: 'Soldado' },
    },
  ], { promocao: { posto_graduacao: '3º Sargento' } });

  assert.equal(validacao.valido, false);
  assert.deepEqual(validacao.bloqueios, ['Há militar incompatível com o cadastro atual. Revise antes de salvar.']);
});

test('adição manual cria PromocaoMilitar com campos derivados automaticamente', () => {
  const payload = montarPayloadAdicaoManualTurma({
    promocao: { id: 'promo-1', posto_graduacao: '3º Sargento' },
    militar: { id: 'm1', posto_graduacao: 'Cabo' },
    militarId: 'm1',
    registrosExistentes: [],
  });

  assert.equal(payload.atualizar_cadastro_militar, true);
  assert.equal(payload.motivo_atualizacao_cadastro, 'Promoção imediatamente superior ao cadastro atual.');
  assert.equal(payload.resultado_aplicacao_cadastro, 'imediatamente_superior');
});

test('DetalhePromocao não contém checkbox de atualização cadastral nem ações em lote removidas', () => {
  const detalhePromocao = readFileSync(new URL('../../pages/DetalhePromocao.jsx', import.meta.url), 'utf8');

  assert.equal(detalhePromocao.includes('Atualizar cadastro do militar'), false);
  assert.equal(detalhePromocao.includes('Histórico somente'), false);
  assert.equal(detalhePromocao.includes('Atualizar promoções superiores'), false);
  assert.equal(detalhePromocao.includes('Restaurar sugestão'), false);
});

test('apenas serviço de publicação pode acionar atualização cadastral explícita', () => {
  const detalhePromocao = readFileSync(new URL('../../pages/DetalhePromocao.jsx', import.meta.url), 'utf8');
  const rastreamentoPromocoes = readFileSync(new URL('../../pages/RastreamentoPromocoes.jsx', import.meta.url), 'utf8');
  assert.equal(detalleSemEspacos(detalhePromocao).includes('entities.Militar.update'), false);
  assert.equal(detalleSemEspacos(rastreamentoPromocoes).includes('entities.Militar.update'), false);
});

test('DetalhePromocao não escreve Histórico V2 diretamente', () => {
  const detalhePromocao = readFileSync(new URL('../../pages/DetalhePromocao.jsx', import.meta.url), 'utf8');
  const rastreamentoPromocoes = readFileSync(new URL('../../pages/RastreamentoPromocoes.jsx', import.meta.url), 'utf8');
  const promocaoService = readFileSync(new URL('../promocaoService.js', import.meta.url), 'utf8');

  assert.equal(detalleSemEspacos(detalhePromocao).includes('HistoricoPromocaoMilitarV2.update'), false);
  assert.equal(detalleSemEspacos(detalhePromocao).includes('HistoricoPromocaoMilitarV2.create'), false);
  assert.equal(detalleSemEspacos(detalhePromocao).includes('HistoricoPromocaoMilitarV2.delete'), false);
  assert.equal(detalleSemEspacos(rastreamentoPromocoes).includes('HistoricoPromocaoMilitarV2.update'), false);
  assert.equal(detalleSemEspacos(rastreamentoPromocoes).includes('HistoricoPromocaoMilitarV2.create'), false);
  assert.equal(detalleSemEspacos(rastreamentoPromocoes).includes('HistoricoPromocaoMilitarV2.delete'), false);
  assert.equal(promocaoService.includes('HistoricoPromocaoMilitarV2.delete'), false);
});


const promocaoPublicacao = {
  id: 'promo-pub-1',
  posto_graduacao: 'Capitão',
  quadro: 'QOBM',
  data_promocao: '2026-05-01',
  data_publicacao: '2026-05-02',
  boletim_referencia: 'BG 20',
  ato_referencia: 'ATO 10',
  status: 'ativa',
};

function itemPublicacao(overrides = {}) {
  return {
    id: 'pm-1',
    promocao_id: 'promo-pub-1',
    militar_id: 'm1',
    ordem: 1,
    status: 'selecionado',
    selecionado: true,
    militar: { id: 'm1', posto_graduacao: '1º Tenente', quadro: 'QOBM', nome_guerra: 'Alfa' },
    ...overrides,
  };
}

function entidadesPublicacao({ historicos = [] } = {}) {
  const chamadas = {
    historicoCreate: [],
    historicoUpdate: [],
    militarUpdate: [],
    promocaoMilitarUpdate: [],
    promocaoUpdate: [],
  };
  let contadorHistorico = 1;
  return {
    chamadas,
    entities: {
      HistoricoPromocaoMilitarV2: {
        list: async () => historicos,
        create: async (payload) => {
          chamadas.historicoCreate.push(payload);
          return { id: `hist-novo-${contadorHistorico++}`, ...payload };
        },
        update: async (id, patch) => {
          chamadas.historicoUpdate.push({ id, patch });
          return { id, ...patch };
        },
      },
      Militar: {
        update: async (id, patch) => {
          chamadas.militarUpdate.push({ id, patch });
          return { id, ...patch };
        },
      },
      PromocaoMilitar: {
        update: async (id, patch) => {
          chamadas.promocaoMilitarUpdate.push({ id, patch });
          return { id, ...patch };
        },
      },
      Promocao: {
        update: async (id, patch) => {
          chamadas.promocaoUpdate.push({ id, patch });
          return { id, ...patch };
        },
      },
    },
  };
}

async function rejeitaSemEscrita(contexto, textoMensagem) {
  const { chamadas } = contexto;
  await assert.rejects(
    publicarPromocaoOficial({ ...contexto.args, entities: contexto.entities }),
    (error) => error.message.includes(textoMensagem),
  );
  assert.equal(chamadas.historicoCreate.length, 0);
  assert.equal(chamadas.historicoUpdate.length, 0);
  assert.equal(chamadas.militarUpdate.length, 0);
  assert.equal(chamadas.promocaoMilitarUpdate.length, 0);
  assert.equal(chamadas.promocaoUpdate.length, 0);
}

test('publicação bloqueia promoção sem data_promocao antes de qualquer escrita', async () => {
  const contexto = entidadesPublicacao();
  await rejeitaSemEscrita({
    ...contexto,
    args: { promocao: { ...promocaoPublicacao, data_promocao: '' }, itens: [itemPublicacao()] },
  }, 'data da promoção');
});

test('publicação bloqueia promoção sem posto/quadro destino', async () => {
  const contexto = entidadesPublicacao();
  await rejeitaSemEscrita({
    ...contexto,
    args: { promocao: { ...promocaoPublicacao, posto_graduacao: '', quadro: '' }, itens: [itemPublicacao()] },
  }, 'posto/graduação destino');
});

test('publicação bloqueia militar incompatível', async () => {
  const contexto = entidadesPublicacao();
  await rejeitaSemEscrita({
    ...contexto,
    args: { promocao: promocaoPublicacao, itens: [itemPublicacao({ militar: { id: 'm1', posto_graduacao: 'Soldado', quadro: 'QOBM' } })] },
  }, 'incompatível');
});

test('publicação bloqueia militar em revisão', async () => {
  const contexto = entidadesPublicacao();
  await rejeitaSemEscrita({
    ...contexto,
    args: { promocao: promocaoPublicacao, itens: [itemPublicacao({ militar: { id: 'm1', posto_graduacao: 'Posto Desconhecido', quadro: 'QOBM' } })] },
  }, 'revisão');
});

test('publicação bloqueia ordem duplicada', async () => {
  const contexto = entidadesPublicacao();
  await rejeitaSemEscrita({
    ...contexto,
    args: { promocao: promocaoPublicacao, itens: [itemPublicacao(), itemPublicacao({ id: 'pm-2', militar_id: 'm2', ordem: 1, militar: { id: 'm2', posto_graduacao: '1º Tenente', quadro: 'QOBM' } })] },
  }, 'ordem duplicada');
});

test('publicação bloqueia militar duplicado', async () => {
  const contexto = entidadesPublicacao();
  await rejeitaSemEscrita({
    ...contexto,
    args: { promocao: promocaoPublicacao, itens: [itemPublicacao(), itemPublicacao({ id: 'pm-2', ordem: 2 })] },
  }, 'militar duplicado');
});

test('publicação histórica cria Histórico V2 e não atualiza Militar', async () => {
  const contexto = entidadesPublicacao();
  const resultado = await publicarPromocaoOficial({
    promocao: { ...promocaoPublicacao, posto_graduacao: '1º Tenente' },
    itens: [itemPublicacao({ militar: { id: 'm1', posto_graduacao: 'Capitão', quadro: 'QOBM' } })],
    entities: contexto.entities,
  });

  assert.equal(resultado.publicados, 1);
  assert.equal(contexto.chamadas.historicoCreate.length, 1);
  assert.equal(contexto.chamadas.militarUpdate.length, 0);
  assert.equal(contexto.chamadas.promocaoMilitarUpdate[0].patch.status, 'publicado');
});

test('publicação atual cria Histórico V2 e não atualiza Militar', async () => {
  const contexto = entidadesPublicacao();
  await publicarPromocaoOficial({
    promocao: promocaoPublicacao,
    itens: [itemPublicacao({ militar: { id: 'm1', posto_graduacao: 'Capitão', quadro: 'QOBM' } })],
    entities: contexto.entities,
  });

  assert.equal(contexto.chamadas.historicoCreate.length, 1);
  assert.equal(contexto.chamadas.militarUpdate.length, 0);
});

test('publicação imediatamente superior cria Histórico V2 e atualiza Militar', async () => {
  const contexto = entidadesPublicacao();
  await publicarPromocaoOficial({ promocao: promocaoPublicacao, itens: [itemPublicacao()], entities: contexto.entities });

  assert.equal(contexto.chamadas.historicoCreate.length, 1);
  assert.deepEqual(contexto.chamadas.militarUpdate[0], { id: 'm1', patch: { posto_graduacao: 'Capitão' } });
});

test('publicação 2º Tenente para 1º Tenente atualiza Militar e cria Histórico V2', async () => {
  const contexto = entidadesPublicacao();
  await publicarPromocaoOficial({
    promocao: { ...promocaoPublicacao, posto_graduacao: '1º Tenente' },
    itens: [itemPublicacao({ militar: { id: 'm1', posto_graduacao: '2º Tenente', quadro: 'QOBM' } })],
    entities: contexto.entities,
  });

  assert.equal(contexto.chamadas.historicoCreate[0].posto_graduacao_anterior, '2º Tenente');
  assert.deepEqual(contexto.chamadas.militarUpdate[0], { id: 'm1', patch: { posto_graduacao: '1º Tenente' } });
});

test('histórico ativo exato com promocao_id vazio é vinculado e não recriado', async () => {
  const contexto = entidadesPublicacao({ historicos: [{
    id: 'hist-1',
    militar_id: 'm1',
    posto_graduacao_novo: 'Capitão',
    quadro_novo: 'QOBM',
    data_promocao: '2026-05-01',
    status_registro: 'ativo',
    promocao_id: '',
  }] });

  await publicarPromocaoOficial({ promocao: promocaoPublicacao, itens: [itemPublicacao()], entities: contexto.entities });

  assert.equal(contexto.chamadas.historicoCreate.length, 0);
  assert.equal(contexto.chamadas.historicoUpdate[0].id, 'hist-1');
  assert.equal(contexto.chamadas.historicoUpdate[0].patch.promocao_id, 'promo-pub-1');
});

test('histórico ativo exato com mesma promocao_id é idempotente', async () => {
  const contexto = entidadesPublicacao({ historicos: [{
    id: 'hist-1',
    militar_id: 'm1',
    posto_graduacao_novo: 'Capitão',
    quadro_novo: 'QOBM',
    data_promocao: '2026-05-01',
    status_registro: 'ativo',
    promocao_id: 'promo-pub-1',
  }] });

  await publicarPromocaoOficial({ promocao: promocaoPublicacao, itens: [itemPublicacao()], entities: contexto.entities });

  assert.equal(contexto.chamadas.historicoCreate.length, 0);
  assert.equal(contexto.chamadas.historicoUpdate.length, 0);
  assert.equal(contexto.chamadas.promocaoMilitarUpdate[0].patch.historico_promocao_v2_id, 'hist-1');
});

test('histórico ativo exato com outra promocao_id bloqueia sem escrita', async () => {
  const contexto = entidadesPublicacao({ historicos: [{
    id: 'hist-1',
    militar_id: 'm1',
    posto_graduacao_novo: 'Capitão',
    quadro_novo: 'QOBM',
    data_promocao: '2026-05-01',
    status_registro: 'ativo',
    promocao_id: 'outra-promo',
  }] });

  await rejeitaSemEscrita({
    ...contexto,
    args: { promocao: promocaoPublicacao, itens: [itemPublicacao()] },
  }, 'outra promoção');
});

test('publicação expõe validação para bloquear alterações pendentes na tela', () => {
  const validacao = validarPublicacaoPromocao({ promocao: promocaoPublicacao, itens: [itemPublicacao()], temAlteracoesPendentes: true });

  assert.equal(validacao.valido, false);
  assert.ok(validacao.bloqueios.includes('Salve as alterações pendentes antes de publicar.'));
});

test('validarPublicacaoPromocao permite cenário completo 2º Tenente -> 1º Tenente / QOBM', () => {
  const validacao = validarPublicacaoPromocao({
    promocao: { ...promocaoPublicacao, posto_graduacao: '1º Tenente', quadro: 'QOBM', data_promocao: '2026-05-01' },
    itens: [itemPublicacao({ militar: { id: 'm1', posto_graduacao: '2º Tenente', quadro: 'QOBM' }, ordem: 1 })],
    temAlteracoesPendentes: false,
  });

  assert.equal(validacao.valido, true);
  assert.deepEqual(validacao.bloqueios, []);
});

test('validarPublicacaoPromocao bloqueia sem quadro', () => {
  const validacao = validarPublicacaoPromocao({ promocao: { ...promocaoPublicacao, quadro: '' }, itens: [itemPublicacao()] });
  assert.equal(validacao.valido, false);
  assert.ok(validacao.bloqueios.includes('Informe o quadro destino antes de publicar.'));
});

test('validarPublicacaoPromocao bloqueia sem data', () => {
  const validacao = validarPublicacaoPromocao({ promocao: { ...promocaoPublicacao, data_promocao: '' }, itens: [itemPublicacao()] });
  assert.equal(validacao.valido, false);
  assert.ok(validacao.bloqueios.includes('Informe a data da promoção antes de publicar.'));
});

test('validarPublicacaoPromocao bloqueia sem item', () => {
  const validacao = validarPublicacaoPromocao({ promocao: promocaoPublicacao, itens: [] });
  assert.equal(validacao.valido, false);
  assert.ok(validacao.bloqueios.includes('Inclua ao menos um militar antes de publicar.'));
});

test('validarPublicacaoPromocao bloqueia item com ordem inválida', () => {
  const validacao = validarPublicacaoPromocao({ promocao: promocaoPublicacao, itens: [itemPublicacao({ ordem: 0 })] });
  assert.equal(validacao.valido, false);
  assert.ok(validacao.bloqueios.includes('Linha 1: ordem inválida.'));
});

test('serviço de publicação não altera motor da Prévia Geral nem snapshots', () => {
  const previa = readFileSync(new URL('../../utils/antiguidade/calcularPreviaAntiguidadeGeral.js', import.meta.url), 'utf8');
  const detalhePromocao = readFileSync(new URL('../../pages/DetalhePromocao.jsx', import.meta.url), 'utf8');
  const promocaoService = readFileSync(new URL('../promocaoService.js', import.meta.url), 'utf8');

  assert.equal(previa.includes('publicarPromocaoOficial'), false);
  assert.equal(detalleSemEspacos(detalhePromocao).includes('HistoricoPromocaoMilitarV2.create'), false);
  assert.equal(detalleSemEspacos(detalhePromocao).includes('entities.Militar.update'), false);
  assert.equal(promocaoService.includes('HistoricoPromocaoMilitarV2.delete'), false);
});

function detalleSemEspacos(valor) {
  return valor.replace(/\s+/g, '');
}
