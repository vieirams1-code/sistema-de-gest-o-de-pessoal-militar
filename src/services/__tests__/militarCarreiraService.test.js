import { describe, it } from 'node:test';
import assert from 'node:assert';
import { montarConsolidadoCarreira } from '../militarCarreiraService.js';

describe('militarCarreiraService - montarConsolidadoCarreira', () => {
  const militarExemplo = {
    id: 'm1',
    nome_completo: 'JOAO SILVA',
    posto_graduacao: 'Soldado',
    data_inclusao: '2010-01-01',
    comportamento: 'Bom'
  };

  const historicoPromocoes = [
    {
      id: 'p1',
      militar_id: 'm1',
      data_promocao: '2010-01-01',
      posto_graduacao_novo: 'Soldado',
      status_registro: 'ativo'
    }
  ];

  const medalhas = [
    {
      id: 'med1',
      militar_id: 'm1',
      tipo_medalha_codigo: 'TEMPO_10',
      status: 'CONCEDIDA',
      data_concessao: '2020-01-01'
    }
  ];

  it('deve consolidar visão de carreira para um militar praça', () => {
    const consolidado = montarConsolidadoCarreira({
      militar: militarExemplo,
      historicoPromocoes,
      medalhas,
      comportamento: [] // sem punições
    });

    assert.strictEqual(consolidado.tempoServico.valido, true);
    assert.ok(consolidado.tempoServico.anos_completos >= 10);

    assert.strictEqual(consolidado.promocaoAtual.id, 'p1');
    assert.strictEqual(consolidado.historicoPromocoes.length, 1);

    assert.strictEqual(consolidado.medalhas.length, 1);

    assert.strictEqual(consolidado.comportamentoAtual.comportamento, 'Excepcional'); // 10+ anos sem punição

    assert.ok(consolidado.resumoCarreira.texto.includes('Soldado'));
    assert.ok(consolidado.resumoCarreira.texto.includes('Excepcional'));
  });

  it('deve lidar com militar oficial (sem cálculo de comportamento automático)', () => {
    const oficial = {
      ...militarExemplo,
      posto_graduacao: 'Major',
      comportamento: 'N/A'
    };

    const consolidado = montarConsolidadoCarreira({
      militar: oficial,
      historicoPromocoes: [],
      medalhas: [],
      comportamento: 'N/A'
    });

    // Para oficiais, calcularComportamento retorna null, mas o service trata fallback
    assert.strictEqual(consolidado.comportamentoAtual.comportamento, 'N/A');
    assert.strictEqual(consolidado.resumoCarreira.texto.includes('Major'), true);
  });

  it('deve identificar próxima medalha devida', () => {
    const recruta = {
      ...militarExemplo,
      data_inclusao: new Date().toISOString().slice(0, 10) // recém incluído
    };

    const consolidado = montarConsolidadoCarreira({
      militar: recruta,
      historicoPromocoes: [],
      medalhas: [],
      comportamento: []
    });

    assert.strictEqual(consolidado.tempoServico.anos_completos, 0);
    assert.strictEqual(consolidado.proximaMedalha.codigo, null);
    assert.strictEqual(consolidado.proximaMedalha.situacao, 'SEM_DIREITO');
  });

  it('deve ordenar histórico de promoções corretamente', () => {
    const historicoMultiplo = [
      { id: 'p1', militar_id: 'm1', data_promocao: '2010-01-01', status_registro: 'ativo' },
      { id: 'p2', militar_id: 'm1', data_promocao: '2015-01-01', status_registro: 'ativo' }
    ];

    const consolidado = montarConsolidadoCarreira({
      militar: militarExemplo,
      historicoPromocoes: historicoMultiplo
    });

    assert.strictEqual(consolidado.promocaoAtual.id, 'p2');
    assert.strictEqual(consolidado.historicoPromocoes[0].id, 'p2');
    assert.strictEqual(consolidado.historicoPromocoes[1].id, 'p1');
  });
});
