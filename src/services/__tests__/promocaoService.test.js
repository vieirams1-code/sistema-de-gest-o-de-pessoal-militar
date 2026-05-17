import test from 'node:test';
import assert from 'node:assert/strict';

import {
  avaliarCompatibilidadePromocao,
  buscarCandidatosProvaveis,
  filtrarCandidatosCompativeis,
  montarDiagnosticoMilitaresPromocao,
  motivosBloqueioVinculoProvavel,
  podeVincularProvavelAdministrativamente,
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
