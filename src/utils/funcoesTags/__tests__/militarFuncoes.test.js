import { describe, expect, it } from 'vitest';
import { separarFuncoesPorStatus, validarDuplicidadeInstitucionalAtiva } from '../militarFuncoes';

describe('separarFuncoesPorStatus', () => {
  it('separa vínculos ativos e encerrados', () => {
    const { ativas, encerradas } = separarFuncoesPorStatus([
      { id: '1', status: 'ativa' },
      { id: '2', status: 'encerrada' },
      { id: '3', status: 'ATIVA' }
    ]);

    expect(ativas).toHaveLength(2);
    expect(encerradas).toHaveLength(1);
  });
});

describe('validarDuplicidadeInstitucionalAtiva', () => {
  it('bloqueia duplicidade de comandante', () => {
    const mensagem = validarDuplicidadeInstitucionalAtiva({
      vinculosAtivos: [{ funcao: { institucional_chave: 'comandante' } }],
      funcaoSelecionada: { institucional_chave: 'comandante' }
    });

    expect(mensagem).toBe('Este militar já possui a função Comandante ativa.');
  });

  it('permite função sem regra institucional única', () => {
    const mensagem = validarDuplicidadeInstitucionalAtiva({
      vinculosAtivos: [{ funcao: { institucional_chave: 'comandante' } }],
      funcaoSelecionada: { institucional_chave: 'chefia' }
    });

    expect(mensagem).toBeNull();
  });
});
