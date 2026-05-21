import test from 'node:test';
import assert from 'node:assert/strict';
import { selecionarPromocaoAtualEAnteriores } from '../selecionarPromocaoAtual.js';

const militar = { id: 'm1', posto_graduacao: '1º Sargento' };

const historico = (id, posto, dataPromocao, status = 'ativo', extra = {}) => ({
  id,
  militar_id: 'm1',
  posto_graduacao_novo: posto,
  data_promocao: dataPromocao,
  status_registro: status,
  ...extra,
});

test('seleciona Subtenente como promoção atual e anteriores em ordem decrescente', () => {
  const { promocaoAtual, promocoesAnteriores } = selecionarPromocaoAtualEAnteriores({
    militar,
    historicoPromocoes: [
      historico('1', '3º Sargento', '2018-01-01'),
      historico('2', '2º Sargento', '2020-01-01'),
      historico('3', '1º Sargento', '2022-01-01'),
      historico('4', 'Subtenente', '2025-01-01'),
    ],
  });

  assert.equal(promocaoAtual?.posto_graduacao_novo, 'Subtenente');
  assert.deepEqual(promocoesAnteriores.map((r) => r.posto_graduacao_novo), ['1º Sargento', '2º Sargento', '3º Sargento']);
});

test('ignora histórico cancelado na definição da promoção atual', () => {
  const { promocaoAtual } = selecionarPromocaoAtualEAnteriores({
    militar,
    historicoPromocoes: [
      historico('1', '1º Sargento', '2022-01-01', 'ativo'),
      historico('2', 'Subtenente', '2025-01-01', 'cancelado'),
    ],
  });

  assert.equal(promocaoAtual?.posto_graduacao_novo, '1º Sargento');
});

test('ignora histórico retificado na definição da promoção atual', () => {
  const { promocaoAtual } = selecionarPromocaoAtualEAnteriores({
    militar,
    historicoPromocoes: [
      historico('1', '1º Sargento', '2022-01-01', 'retificado'),
      historico('2', 'Subtenente', '2025-01-01', 'ativo'),
    ],
  });

  assert.equal(promocaoAtual?.posto_graduacao_novo, 'Subtenente');
});
