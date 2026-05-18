import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  avaliarAlertasTurmaOperacional,
  avaliarCompatibilidadePromocao,
  buscarCandidatosProvaveis,
  filtrarCandidatosCompativeis,
  montarDiagnosticoMilitaresPromocao,
  montarPatchPromocaoMilitar,
  montarPayloadAdicaoManualTurma,
  montarPayloadsPromocaoMilitarAgrupamento,
  motivosBloqueioVinculoProvavel,
  podeVincularProvavelAdministrativamente,
  validarSalvarTurmaOperacional,
} from '../promocaoService.js';

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


test('tentar marcar atualização cadastral para posto inferior bloqueia salvar turma', () => {
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

  assert.equal(validacao.valido, false);
  assert.deepEqual(validacao.bloqueios, ['Há militar marcado para atualização cadastral que seria rebaixado.']);
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

test('salvar turma persiste atualizar_cadastro_militar no patch', () => {
  const patch = montarPatchPromocaoMilitar({
    id: 'pm1',
    ordem: 1,
    selecionado: true,
    status: 'selecionado',
    atualizar_cadastro_militar: true,
    motivo_atualizacao_cadastro: 'Promoção superior ao cadastro atual.',
    resultado_aplicacao_cadastro: 'Cadastro será atualizado',
  });

  assert.equal(patch.atualizar_cadastro_militar, true);
  assert.equal(patch.motivo_atualizacao_cadastro, 'Promoção superior ao cadastro atual.');
  assert.equal(patch.resultado_aplicacao_cadastro, 'Cadastro será atualizado');
});

test('nenhuma ação faz Militar.update', () => {
  const detalhePromocao = readFileSync(new URL('../../pages/DetalhePromocao.jsx', import.meta.url), 'utf8');
  const rastreamentoPromocoes = readFileSync(new URL('../../pages/RastreamentoPromocoes.jsx', import.meta.url), 'utf8');
  const promocaoService = readFileSync(new URL('../promocaoService.js', import.meta.url), 'utf8');

  assert.equal(detalleSemEspacos(detalhePromocao).includes('entities.Militar.update'), false);
  assert.equal(detalleSemEspacos(rastreamentoPromocoes).includes('entities.Militar.update'), false);
  assert.equal(detalleSemEspacos(promocaoService).includes('Militar.update'), false);
});

test('nenhuma ação altera Histórico V2', () => {
  const detalhePromocao = readFileSync(new URL('../../pages/DetalhePromocao.jsx', import.meta.url), 'utf8');
  const rastreamentoPromocoes = readFileSync(new URL('../../pages/RastreamentoPromocoes.jsx', import.meta.url), 'utf8');
  const promocaoService = readFileSync(new URL('../promocaoService.js', import.meta.url), 'utf8');

  assert.equal(detalleSemEspacos(detalhePromocao).includes('HistoricoPromocaoMilitarV2.update'), false);
  assert.equal(detalleSemEspacos(detalhePromocao).includes('HistoricoPromocaoMilitarV2.create'), false);
  assert.equal(detalleSemEspacos(rastreamentoPromocoes).includes('HistoricoPromocaoMilitarV2.update'), false);
  assert.equal(detalleSemEspacos(rastreamentoPromocoes).includes('HistoricoPromocaoMilitarV2.create'), false);
  assert.equal(detalleSemEspacos(promocaoService).includes('HistoricoPromocaoMilitarV2'), false);
});

function detalleSemEspacos(valor) {
  return valor.replace(/\s+/g, '');
}
