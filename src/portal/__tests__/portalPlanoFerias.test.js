/* global process */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Plano Anual de Férias — Workflow em 2 Camadas & Geração Automática em Lote', () => {
  it('1. As 3 opções do militar são preferências alternativas de mês, não frações duplicadas', () => {
    const opcao1 = {
      meses_resumo: 'Janeiro',
      parcelas: [{ etapa: 1, dias: 30, mes: '01', data_inicio: '2027-01-15' }],
    };
    const opcao2 = {
      meses_resumo: 'Julho',
      parcelas: [{ etapa: 1, dias: 30, mes: '07', data_inicio: '2027-07-01' }],
    };
    const opcao3 = {
      meses_resumo: 'Setembro',
      parcelas: [{ etapa: 1, dias: 30, mes: '09', data_inicio: '2027-09-01' }],
    };

    assert.equal(opcao1.parcelas.length, 1);
    assert.equal(opcao2.parcelas.length, 1);
    assert.equal(opcao3.parcelas.length, 1);
    assert.deepEqual(
      new Set([opcao1.parcelas[0].mes, opcao2.parcelas[0].mes, opcao3.parcelas[0].mes]).size,
      3
    );
    assert.equal(opcao1.parcelas[0].data_inicio, '2027-01-15');
  });

  it('2. Camada 1: S1/Gestor aprova Opção 2 e formata os dados para homologação', () => {
    const mockOpcao = {
      id: 'op_123',
      militar_nome: 'Edson Vieira',
      opcao_1_detalhes: JSON.stringify([{ etapa: 1, dias: 15, mes: '01', data_inicio: '2027-01-05' }]),
      opcao_2_detalhes: JSON.stringify([{ etapa: 1, dias: 15, mes: '02', data_inicio: '2027-02-05' }]),
    };

    const tipoEscolhido = 'OPCAO_2';
    const parcelasAprovadas = JSON.parse(mockOpcao.opcao_2_detalhes);

    const decisaoCamada1 = {
      status_camada_1: 'Opcao_2_Aprovada',
      decisao_camada_1_opcao: tipoEscolhido,
      decisao_camada_1_detalhes: JSON.stringify(parcelasAprovadas),
      gestor_unidade_nome: 'Capitão S1',
    };

    assert.equal(decisaoCamada1.status_camada_1, 'Opcao_2_Aprovada');
    assert.equal(parcelasAprovadas[0].mes, '02');
  });

  it('3. Camada 2: Homologação Superior consolida a escala', () => {
    const homologacaoSuperior = {
      status_camada_2: 'Homologado_Superior',
      superior_homologador_nome: 'Coronel Comandante',
      data_homologacao: new Date().toISOString(),
    };

    assert.equal(homologacaoSuperior.status_camada_2, 'Homologado_Superior');
  });

  it('4. Geração em Lote: Cálculo exato de datas de término e retorno', () => {
    const parcelas = [
      { etapa: 1, dias: 15, data_inicio: '2027-01-05' },
      { etapa: 2, dias: 15, data_inicio: '2027-07-01' },
    ];

    const feriasGeradas = parcelas.map((p) => {
      const dtInicio = new Date(p.data_inicio);
      const dtFim = new Date(dtInicio);
      dtFim.setDate(dtFim.getDate() + p.dias - 1);

      const dtRetorno = new Date(dtFim);
      dtRetorno.setDate(dtRetorno.getDate() + 1);

      return {
        dias: p.dias,
        data_inicio: dtInicio.toISOString().split('T')[0],
        data_fim: dtFim.toISOString().split('T')[0],
        data_retorno: dtRetorno.toISOString().split('T')[0],
      };
    });

    // 2027-01-05 + 15 dias -> 2027-01-19 (Retorno: 2027-01-20)
    assert.equal(feriasGeradas[0].data_inicio, '2027-01-05');
    assert.equal(feriasGeradas[0].data_fim, '2027-01-19');
    assert.equal(feriasGeradas[0].data_retorno, '2027-01-20');

    // 2027-07-01 + 15 dias -> 2027-07-15 (Retorno: 2027-07-16)
    assert.equal(feriasGeradas[1].data_inicio, '2027-07-01');
    assert.equal(feriasGeradas[1].data_fim, '2027-07-15');
    assert.equal(feriasGeradas[1].data_retorno, '2027-07-16');
  });

  it('5. Distribuição de efetivo por mês contabiliza corretamente', () => {
    const mockOpcoes = [
      { decisao_camada_1_detalhes: JSON.stringify([{ mes: '01', dias: 15 }, { mes: '07', dias: 15 }]) },
      { decisao_camada_1_detalhes: JSON.stringify([{ mes: '01', dias: 15 }, { mes: '08', dias: 15 }]) },
      { decisao_camada_1_detalhes: JSON.stringify([{ mes: '02', dias: 30 }]) },
    ];

    const contagem = Array(12).fill(0);
    mockOpcoes.forEach((op) => {
      const list = JSON.parse(op.decisao_camada_1_detalhes);
      list.forEach((p) => {
        const m = parseInt(p.mes, 10);
        contagem[m - 1]++;
      });
    });

    assert.equal(contagem[0], 2); // 2 militares em Janeiro
    assert.equal(contagem[1], 1); // 1 militar em Fevereiro
    assert.equal(contagem[6], 1); // 1 militar em Julho
    assert.equal(contagem[7], 1); // 1 militar em Agosto
    assert.equal(contagem[11], 0); // 0 militares em Dezembro
  });

  it('6. Período mais antigo totalmente comprometido é ignorado no plano seguinte', () => {
    const periodos = [
      { id: 'antigo', inicio: '2025-01-15', direito: 30, gozados: 15, previstos: 15 },
      { id: 'seguinte', inicio: '2026-01-15', direito: 30, gozados: 0, previstos: 0 },
    ];

    const elegivel = periodos
      .map((p) => ({ ...p, sem_previsao: Math.max(0, p.direito - p.gozados - p.previstos) }))
      .sort((a, b) => a.inicio.localeCompare(b.inicio))
      .find((p) => p.sem_previsao > 0);

    assert.equal(elegivel.id, 'seguinte');
    assert.equal(elegivel.sem_previsao, 30);
  });

  it('7. Mês de aquisição permanece disponível, com início ajustado para o dia seguinte ao fim do período', () => {
    const fimAquisitivo = '2027-11-12';
    const dt = new Date(`${fimAquisitivo}T00:00:00Z`);
    dt.setUTCDate(dt.getUTCDate() + 1);
    const primeiraDataLegal = dt.toISOString().slice(0, 10);

    const regraMes = (mes) => {
      const inicioMes = `2027-${mes}-01`;
      const fimMes = new Date(Date.UTC(2027, Number(mes), 0)).toISOString().slice(0, 10);
      const dataInicio = primeiraDataLegal > inicioMes ? primeiraDataLegal : inicioMes;
      return { permitido: dataInicio <= fimMes, dataInicio };
    };

    assert.equal(regraMes('10').permitido, false);
    assert.deepEqual(regraMes('11'), { permitido: true, dataInicio: '2027-11-13' });
    assert.deepEqual(regraMes('12'), { permitido: true, dataInicio: '2027-12-01' });
  });
});
