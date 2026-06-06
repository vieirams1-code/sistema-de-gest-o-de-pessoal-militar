import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { consolidarSaudeMilitar } from '../militarSaudeService.js';

describe('militarSaudeService', () => {
  const hoje = new Date('2024-05-20T00:00:00');

  it('deve retornar valores padrão quando não há dados', () => {
    const resultado = consolidarSaudeMilitar([], [], hoje);
    assert.deepEqual(resultado, {
      quantidadeAtestados: 0,
      ultimoAtestado: null,
      afastamentoAtivo: false,
      diasAfastados12Meses: 0,
      possuiJiso: false,
      statusSaude: 'Sem restrições',
    });
  });

  it('deve identificar afastamento ativo e último atestado', () => {
    const atestados = [
      { id: 'a1', status: 'Ativo', data_inicio: '2024-05-19', data_termino: '2024-05-21' },
      { id: 'a2', status: 'Encerrado', data_inicio: '2024-01-01', data_termino: '2024-01-05' }
    ];
    const resultado = consolidarSaudeMilitar(atestados, [], hoje);

    assert.equal(resultado.quantidadeAtestados, 2);
    assert.equal(resultado.ultimoAtestado.id, 'a1');
    assert.equal(resultado.afastamentoAtivo, true);
    assert.equal(resultado.statusSaude, 'Com afastamento');
  });

  it('deve ignorar atestados cancelados', () => {
    const atestados = [
      { id: 'a1', status: 'Cancelado', data_inicio: '2024-05-19', data_termino: '2024-05-21' }
    ];
    const resultado = consolidarSaudeMilitar(atestados, [], hoje);
    assert.equal(resultado.quantidadeAtestados, 0);
    assert.equal(resultado.afastamentoAtivo, false);
  });

  it('deve calcular corretamente dias afastados nos últimos 12 meses', () => {
    const atestados = [
      // 5 dias
      { id: 'a1', status: 'Encerrado', data_inicio: '2024-05-01', data_termino: '2024-05-05' },
      // 5 dias sobrepostos (total 1 a 7 = 7 dias)
      { id: 'a2', status: 'Encerrado', data_inicio: '2024-05-03', data_termino: '2024-05-07' },
      // Fora da janela de 1 ano
      { id: 'a3', status: 'Encerrado', data_inicio: '2023-01-01', data_termino: '2023-01-10' }
    ];
    const resultado = consolidarSaudeMilitar(atestados, [], hoje);
    assert.equal(resultado.diasAfastados12Meses, 7);
  });

  it('deve identificar JISO vigente', () => {
    const jisos = [{ id: 'j1', status: 'Agendada', data_jiso: '2024-05-20' }];
    const resultado = consolidarSaudeMilitar([], jisos, hoje);
    assert.equal(resultado.possuiJiso, true);
    assert.equal(resultado.statusSaude, 'JISO agendada');
  });

  it('afastamento deve ter prioridade sobre JISO no statusSaude', () => {
    const atestados = [{ id: 'a1', status: 'Ativo', data_inicio: '2024-05-20', data_termino: '2024-05-20' }];
    const jisos = [{ id: 'j1', status: 'Agendada', data_jiso: '2024-05-20' }];
    const resultado = consolidarSaudeMilitar(atestados, jisos, hoje);
    assert.equal(resultado.statusSaude, 'Com afastamento');
  });
});
