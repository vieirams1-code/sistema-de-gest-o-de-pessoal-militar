import test from 'node:test';
import assert from 'node:assert/strict';
import { ordenarPorAntiguidadeAnterior } from '../ordenacaoPromocao.js';

const promocao = { posto_graduacao: '2º Sgt', quadro: 'QPPM', data_promocao: '2020-12-02' };

test('ordena promoção histórica de 2º Sgt com base em histórico de 3º Sgt', () => {
  const itens = [
    { id: 'pm1', militar_id: '1', militar: { id: '1', nome_completo: 'Alpha', data_nascimento: '1990-05-01', matricula: '3' } },
    { id: 'pm2', militar_id: '2', militar: { id: '2', nome_completo: 'Bravo', data_nascimento: '1988-01-10', matricula: '2' } },
  ];
  const historico = [
    { militar_id: '1', posto_graduacao_novo: '3º Sgt', quadro_novo: 'QPPM', data_promocao: '2019-01-01', antiguidade_referencia_ordem: 2, status_registro: 'ativo' },
    { militar_id: '2', posto_graduacao_novo: '3º Sgt', quadro_novo: 'QPPM', data_promocao: '2018-01-01', antiguidade_referencia_ordem: 10, status_registro: 'ativo' },
  ];
  const resultado = ordenarPorAntiguidadeAnterior({ promocao, itensPromocao: itens, historicoV2: historico, militares: [] });
  assert.deepEqual(resultado.ordenados.map((x) => x.militar_id), ['2', '1']);
  assert.equal(resultado.encontrados, 2);
  assert.equal(resultado.semHistorico.length, 0);
  assert.equal(resultado.base.posto, '3º Sargento');
  assert.equal(resultado.alertas.some((alerta) => alerta.toLowerCase().includes('nenhum')), false);
  assert.equal(resultado.alertas.some((alerta) => alerta.toLowerCase().includes('incompleta')), false);
});

test('militar sem histórico-base vai ao final e gera alerta nominal', () => {
  const itens = [
    { id: 'pm1', militar_id: '1', militar: { id: '1', nome_completo: 'Alpha', matricula: '1' } },
    { id: 'pm2', militar_id: '2', militar: { id: '2', nome_completo: 'Bravo', matricula: '2' } },
  ];
  const historico = [
    { militar_id: '1', posto_graduacao_novo: '3º Sgt', quadro_novo: 'QPPM', data_promocao: '2019-01-01', antiguidade_referencia_ordem: 2, status_registro: 'ativo' },
  ];
  const resultado = ordenarPorAntiguidadeAnterior({ promocao, itensPromocao: itens, historicoV2: historico, militares: [] });
  assert.equal(resultado.totalSemHistorico, 1);
  assert.equal(resultado.semHistorico[0], 'Bravo');
  assert.deepEqual(resultado.ordenados.map((x) => x.militar_id), ['1', '2']);
});
