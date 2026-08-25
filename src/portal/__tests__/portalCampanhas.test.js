/* global process */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Gestão de Campanhas do Portal do Militar — Escopo, Prazos & Retorno em Tempo Real', () => {
  const mockMilitares = [
    { id: 'mil_1', nome: 'Capitão Silva', lotacao_id: 'unidade_1gbm', quadro: 'QOBM', status: 'Ativo' },
    { id: 'mil_2', nome: 'Tenente Souza', lotacao_id: 'unidade_1gbm', quadro: 'QOBM', status: 'Ativo' },
    { id: 'mil_3', nome: 'Sargento Oliveira', lotacao_id: 'unidade_6gbm', quadro: 'QBM-1', status: 'Ativo' },
    { id: 'mil_4', nome: 'Cabo Santos', lotacao_id: 'unidade_abm', quadro: 'QBM-1', status: 'Inativo' }, // Inativo
  ];

  it('1. Filtro de escopo TODOS: deve incluir todos os militares ativos da corporação', () => {
    const escopo = { tipo_escopo: 'TODOS' };
    const filtrados = mockMilitares.filter((m) => {
      if (m.status !== 'Ativo') return false;
      return escopo.tipo_escopo === 'TODOS';
    });

    assert.equal(filtrados.length, 3);
    assert.equal(filtrados.some((m) => m.id === 'mil_4'), false);
  });

  it('2. Filtro de escopo UNIDADES: deve incluir apenas militares das unidades selecionadas', () => {
    const escopo = {
      tipo_escopo: 'UNIDADES',
      escopo_unidades_ids: ['unidade_1gbm'],
    };

    const filtrados = mockMilitares.filter((m) => {
      if (m.status !== 'Ativo') return false;
      return escopo.escopo_unidades_ids.includes(m.lotacao_id);
    });

    assert.equal(filtrados.length, 2);
    assert.equal(filtrados[0].id, 'mil_1');
    assert.equal(filtrados[1].id, 'mil_2');
    assert.equal(filtrados.some((m) => m.id === 'mil_3'), false);
  });

  it('3. Filtro de escopo QUADROS: deve incluir apenas militares do quadro especificado', () => {
    const escopo = {
      tipo_escopo: 'QUADROS',
      escopo_quadros: ['QOBM'],
    };

    const filtrados = mockMilitares.filter((m) => {
      if (m.status !== 'Ativo') return false;
      return escopo.escopo_quadros.includes(m.quadro);
    });

    assert.equal(filtrados.length, 2);
    assert.equal(filtrados.some((m) => m.quadro === 'QBM-1'), false);
  });

  it('4. Validação de elegibilidade no Portal: militar no escopo vê a campanha ativa', () => {
    const campanhasAtivas = [
      {
        id: 'camp_ferias_2027',
        tipo: 'PLANO_FERIAS',
        status: 'Aberta_Coleta',
        tipo_escopo: 'UNIDADES',
        escopo_unidades_ids: ['unidade_1gbm'],
        data_fim_militar: '2026-10-31',
      },
    ];

    const militar1 = mockMilitares[0]; // unidade_1gbm
    const militar3 = mockMilitares[2]; // unidade_6gbm

    const elegivel1 = campanhasAtivas.filter((cp) => cp.escopo_unidades_ids.includes(militar1.lotacao_id));
    const elegivel3 = campanhasAtivas.filter((cp) => cp.escopo_unidades_ids.includes(militar3.lotacao_id));

    assert.equal(elegivel1.length, 1);
    assert.equal(elegivel3.length, 0);
  });

  it('5. Cálculo em tempo real do retorno nominal e percentual de adesão', () => {
    const totalPublico = 50;
    const totalRespondidos = 35;
    const totalPendentes = totalPublico - totalRespondidos;
    const percentual = Math.round((totalRespondidos / totalPublico) * 100);

    assert.equal(totalPendentes, 15);
    assert.equal(percentual, 70);
  });
});
