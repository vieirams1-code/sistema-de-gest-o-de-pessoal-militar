import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { consolidarFerias } from '../militarFeriasService.js';

describe('militarFeriasService', () => {
  const militarId = 'm1';
  const hoje = '2023-10-27';

  it('deve retornar valores zerados/vazios quando não há dados', () => {
    const resultado = consolidarFerias({ periodosAquisitivos: [], ferias: [], hoje });

    assert.equal(resultado.saldoAtual, 0);
    assert.deepEqual(resultado.periodos, []);
    assert.deepEqual(resultado.historico, []);
    assert.deepEqual(resultado.situacaoAtual, { emGozo: false, registro: null });
    assert.equal(resultado.proximoVencimento, null);
  });

  it('deve consolidar corretamente múltiplos períodos e férias', () => {
    const periodosAquisitivos = [
      {
        id: 'p1',
        militar_id: militarId,
        inicio_aquisitivo: '2021-01-01',
        fim_aquisitivo: '2021-12-31',
        data_limite_gozo: '2023-12-31',
        dias_base: 30,
        status: 'Ativo'
      },
      {
        id: 'p2',
        militar_id: militarId,
        inicio_aquisitivo: '2022-01-01',
        fim_aquisitivo: '2022-12-31',
        data_limite_gozo: '2024-12-31',
        dias_base: 30,
        status: 'Ativo'
      }
    ];

    const ferias = [
      {
        id: 'f1',
        militar_id: militarId,
        periodo_aquisitivo_id: 'p1',
        data_inicio: '2022-05-01',
        data_fim: '2022-05-15',
        dias: 15,
        status: 'Gozada'
      },
      {
        id: 'f2',
        militar_id: militarId,
        periodo_aquisitivo_id: 'p1',
        data_inicio: '2023-10-20',
        data_fim: '2023-11-03',
        dias: 15,
        status: 'Em Curso'
      }
    ];

    const resultado = consolidarFerias({ periodosAquisitivos, ferias, hoje });

    // p1: 30 - 15 (gozada) - 15 (em curso/prevista) = 0 saldo
    // p2: 30 - 0 = 30 saldo
    assert.equal(resultado.saldoAtual, 30);

    // Períodos ordenados por início (decrescente)
    assert.equal(resultado.periodos[0].id, 'p2');
    assert.equal(resultado.periodos[0].dias_saldo, 30);
    assert.equal(resultado.periodos[1].id, 'p1');
    assert.equal(resultado.periodos[1].dias_saldo, 0);

    // Histórico ordenado por data_inicio (decrescente)
    assert.equal(resultado.historico[0].id, 'f2');
    assert.equal(resultado.historico[1].id, 'f1');

    // Situação atual (f2 está em curso em 2023-10-27)
    assert.equal(resultado.situacaoAtual.emGozo, true);
    assert.equal(resultado.situacaoAtual.registro.id, 'f2');

    // Próximo vencimento (p2 é o único com saldo > 0)
    assert.equal(resultado.proximoVencimento, '2024-12-31');
  });

  it('deve ignorar períodos inativos no saldo total', () => {
    const periodosAquisitivos = [
      {
        id: 'p1',
        militar_id: militarId,
        inicio_aquisitivo: '2021-01-01',
        data_limite_gozo: '2023-12-31',
        dias_base: 30,
        status: 'Ativo'
      },
      {
        id: 'p2',
        militar_id: militarId,
        inicio_aquisitivo: '2020-01-01',
        data_limite_gozo: '2022-12-31',
        dias_base: 30,
        status: 'Inativo'
      }
    ];

    const resultado = consolidarFerias({ periodosAquisitivos, ferias: [], hoje });

    assert.equal(resultado.saldoAtual, 30);
    assert.equal(resultado.periodos.length, 1);
    assert.equal(resultado.periodos[0].id, 'p1');
  });

  it('deve identificar o vencimento mais próximo entre períodos com saldo', () => {
    const periodosAquisitivos = [
      {
        id: 'p1',
        militar_id: militarId,
        inicio_aquisitivo: '2021-01-01',
        data_limite_gozo: '2023-12-31',
        dias_base: 30,
        status: 'Ativo'
      },
      {
        id: 'p2',
        militar_id: militarId,
        inicio_aquisitivo: '2022-01-01',
        data_limite_gozo: '2024-12-31',
        dias_base: 30,
        status: 'Ativo'
      }
    ];

    const ferias = [
      {
        id: 'f1',
        militar_id: militarId,
        periodo_aquisitivo_id: 'p1',
        data_inicio: '2022-01-01',
        dias: 30,
        status: 'Gozada'
      }
    ];

    const resultado = consolidarFerias({ periodosAquisitivos, ferias, hoje });

    // p1 saldo 0, p2 saldo 30.
    // Próximo vencimento deve ser de p2, pois p1 não tem mais saldo.
    assert.equal(resultado.saldoAtual, 30);
    assert.equal(resultado.proximoVencimento, '2024-12-31');
  });
});
