import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { determinarStatusOperacional, STATUS_OPERACIONAL } from '../statusOperacionalService.js';

describe('statusOperacionalService', () => {
  const hoje = '2023-10-27'; // Sexta-feira
  const hojeDate = new Date(`${hoje}T00:00:00`);

  it('deve retornar DISPONIVEL quando não há entradas', () => {
    const resultado = determinarStatusOperacional({ hoje });
    assert.equal(resultado.status, STATUS_OPERACIONAL.DISPONIVEL);
    assert.equal(resultado.prioridade, 1);
  });

  it('deve retornar JISO quando há uma JISO agendada para hoje', () => {
    const jisos = [{ id: '1', data_jiso: hoje, status: 'Agendada' }];
    const resultado = determinarStatusOperacional({ jisos, hoje });
    assert.equal(resultado.status, STATUS_OPERACIONAL.JISO);
    assert.equal(resultado.prioridade, 5);
    assert.equal(resultado.motivo, 'JISO Agendada');
  });

  it('deve ignorar JISO realizada ou cancelada', () => {
    const jisos = [
      { id: '1', data_jiso: hoje, status: 'Realizada' },
      { id: '2', data_jiso: hoje, status: 'Cancelada' }
    ];
    const resultado = determinarStatusOperacional({ jisos, hoje });
    assert.equal(resultado.status, STATUS_OPERACIONAL.DISPONIVEL);
  });

  it('deve retornar AFASTADO quando há um atestado vigente', () => {
    const atestados = [{
      id: '1',
      data_inicio: '2023-10-25',
      data_termino: '2023-10-30',
      status: 'Ativo',
      tipo_afastamento: 'LTS'
    }];
    const resultado = determinarStatusOperacional({ atestados, hoje });
    assert.equal(resultado.status, STATUS_OPERACIONAL.AFASTADO);
    assert.equal(resultado.prioridade, 4);
    assert.equal(resultado.motivo, 'LTS');
  });

  it('deve retornar FERIAS quando há férias em curso', () => {
    const ferias = [{
      id: '1',
      data_inicio: '2023-10-01',
      data_retorno: '2023-10-31',
      status: 'Em Curso'
    }];
    const resultado = determinarStatusOperacional({ ferias, hoje });
    assert.equal(resultado.status, STATUS_OPERACIONAL.FERIAS);
    assert.equal(resultado.prioridade, 3);
  });

  it('deve ignorar férias que não estão "em curso"', () => {
    const ferias = [{
      id: '1',
      data_inicio: '2023-10-01',
      data_retorno: '2023-10-31',
      status: 'Agendada'
    }];
    const resultado = determinarStatusOperacional({ ferias, hoje });
    assert.equal(resultado.status, STATUS_OPERACIONAL.DISPONIVEL);
  });

  it('deve retornar LICENCA quando há licença/LTIP vigente', () => {
    const licencas = [{
      id: '1',
      ltip_data_inicio: '2023-01-01',
      ltip_data_fim: '2023-12-31',
      status: 'Ativo',
      tipo_registro: 'LTIP'
    }];
    const resultado = determinarStatusOperacional({ licencas, hoje });
    assert.equal(resultado.status, STATUS_OPERACIONAL.LICENCA);
    assert.equal(resultado.prioridade, 2);
  });

  describe('Prioridade', () => {
    it('JISO deve ter prioridade sobre AFASTADO', () => {
      const jisos = [{ id: '1', data_jiso: hoje, status: 'Agendada' }];
      const atestados = [{ id: '2', data_inicio: hoje, data_termino: hoje, status: 'Ativo' }];
      const resultado = determinarStatusOperacional({ jisos, atestados, hoje });
      assert.equal(resultado.status, STATUS_OPERACIONAL.JISO);
    });

    it('AFASTADO deve ter prioridade sobre FERIAS', () => {
      const atestados = [{ id: '1', data_inicio: hoje, data_termino: hoje, status: 'Ativo' }];
      const ferias = [{ id: '2', data_inicio: hoje, data_retorno: hoje, status: 'Em Curso' }];
      const resultado = determinarStatusOperacional({ atestados, ferias, hoje });
      assert.equal(resultado.status, STATUS_OPERACIONAL.AFASTADO);
    });

    it('FERIAS deve ter prioridade sobre LICENCA', () => {
      const ferias = [{ id: '1', data_inicio: hoje, data_retorno: hoje, status: 'Em Curso' }];
      const licencas = [{ id: '2', ltip_data_inicio: hoje, ltip_data_fim: hoje, status: 'Ativo' }];
      const resultado = determinarStatusOperacional({ ferias, licencas, hoje });
      assert.equal(resultado.status, STATUS_OPERACIONAL.FERIAS);
    });

    it('LICENCA deve ter prioridade sobre DISPONIVEL', () => {
      const licencas = [{ id: '1', ltip_data_inicio: hoje, ltip_data_fim: hoje, status: 'Ativo' }];
      const resultado = determinarStatusOperacional({ licencas, hoje });
      assert.equal(resultado.status, STATUS_OPERACIONAL.LICENCA);
    });
  });

  describe('Limites de Datas', () => {
    it('deve ser vigente no primeiro dia', () => {
      const data = '2023-11-01';
      const ferias = [{ id: '1', data_inicio: data, data_retorno: '2023-11-30', status: 'Em Curso' }];
      const resultado = determinarStatusOperacional({ ferias, hoje: data });
      assert.equal(resultado.status, STATUS_OPERACIONAL.FERIAS);
    });

    it('deve ser vigente no último dia', () => {
      const data = '2023-11-30';
      const ferias = [{ id: '1', data_inicio: '2023-11-01', data_retorno: data, status: 'Em Curso' }];
      const resultado = determinarStatusOperacional({ ferias, hoje: data });
      assert.equal(resultado.status, STATUS_OPERACIONAL.FERIAS);
    });

    it('não deve ser vigente um dia antes', () => {
      const data = '2023-10-31';
      const ferias = [{ id: '1', data_inicio: '2023-11-01', data_retorno: '2023-11-30', status: 'Em Curso' }];
      const resultado = determinarStatusOperacional({ ferias, hoje: data });
      assert.equal(resultado.status, STATUS_OPERACIONAL.DISPONIVEL);
    });

    it('não deve ser vigente um dia depois', () => {
      const data = '2023-12-01';
      const ferias = [{ id: '1', data_inicio: '2023-11-01', data_retorno: '2023-11-30', status: 'Em Curso' }];
      const resultado = determinarStatusOperacional({ ferias, hoje: data });
      assert.equal(resultado.status, STATUS_OPERACIONAL.DISPONIVEL);
    });
  });
});
