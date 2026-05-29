import { describe, it, expect } from 'vitest';
import { militarCorrespondeBusca } from '@/services/matriculaMilitarViewService';
import { normalizarTextoBusca, somenteDigitos } from '@/utils/normalizarBuscaMilitar';

describe('normalizarBuscaMilitar', () => {
  describe('normalizarTextoBusca', () => {
    it('deve remover acentos', () => {
      expect(normalizarTextoBusca('Élder')).toBe('elder');
      expect(normalizarTextoBusca('João')).toBe('joao');
      expect(normalizarTextoBusca('Côté')).toBe('cote');
    });

    it('deve converter para minúsculas', () => {
      expect(normalizarTextoBusca('JOÃO')).toBe('joao');
      expect(normalizarTextoBusca('JoÃo')).toBe('joao');
    });

    it('deve fazer trim', () => {
      expect(normalizarTextoBusca('  João  ')).toBe('joao');
    });

    it('deve normalizar espaços múltiplos', () => {
      expect(normalizarTextoBusca('João   Silva')).toBe('joao silva');
    });

    it('deve lidar com valores null/undefined', () => {
      expect(normalizarTextoBusca(null)).toBe('');
      expect(normalizarTextoBusca(undefined)).toBe('');
    });
  });

  describe('somenteDigitos', () => {
    it('deve remover tudo que não for dígito', () => {
      expect(somenteDigitos('108.747-021')).toBe('108747021');
      expect(somenteDigitos('010.133-021')).toBe('010133021');
    });

    it('deve lidar com null/undefined', () => {
      expect(somenteDigitos(null)).toBe('');
      expect(somenteDigitos(undefined)).toBe('');
    });
  });
});

describe('militarCorrespondeBusca', () => {
  const militar = {
    id: '1',
    nome_completo: 'João Silva Santos',
    nome_guerra: 'João',
    posto_graduacao: 'Capitão',
    matricula_atual: '108.747-021',
    matricula: '108.747-021',
    cpf: '010.133-021',
    lotacao_atual: 'Corpo de Bombeiros',
    quadro: 'Permanente',
    subgrupamento_nome: 'Batalhão 01',
  };

  it('deve encontrar por nome sem acentos (Élder -> Elder)', () => {
    const militarComAcento = { ...militar, nome_guerra: 'Élder' };
    expect(militarCorrespondeBusca(militarComAcento, 'Elder')).toBe(true);
  });

  it('deve encontrar por nome com acentos (João -> Joao)', () => {
    expect(militarCorrespondeBusca(militar, 'Joao')).toBe(true);
  });

  it('deve encontrar por matrícula sem máscara (108747021)', () => {
    expect(militarCorrespondeBusca(militar, '108747021')).toBe(true);
  });

  it('deve encontrar por matrícula com máscara (108.747-021)', () => {
    expect(militarCorrespondeBusca(militar, '108.747-021')).toBe(true);
  });

  it('deve encontrar por CPF sem máscara', () => {
    expect(militarCorrespondeBusca(militar, '010133021')).toBe(true);
  });

  it('deve encontrar por CPF com máscara', () => {
    expect(militarCorrespondeBusca(militar, '010.133-021')).toBe(true);
  });

  it('deve encontrar por posto_graduacao', () => {
    expect(militarCorrespondeBusca(militar, 'Capitão')).toBe(true);
  });

  it('deve encontrar por post_graduacao sem acento', () => {
    expect(militarCorrespondeBusca(militar, 'Capitao')).toBe(true);
  });

  it('deve encontrar por lotacao', () => {
    expect(militarCorrespondeBusca(militar, 'Corpo de Bombeiros')).toBe(true);
  });

  it('deve encontrar por quadro', () => {
    expect(militarCorrespondeBusca(militar, 'Permanente')).toBe(true);
  });

  it('deve retornar true para termo vazio', () => {
    expect(militarCorrespondeBusca(militar, '')).toBe(true);
  });

  it('deve retornar false para termo não encontrado', () => {
    expect(militarCorrespondeBusca(militar, 'xyz123')).toBe(false);
  });

  it('deve diferenciar maiúsculas/minúsculas corretamente após normalização', () => {
    expect(militarCorrespondeBusca(militar, 'JOÃO')).toBe(true);
    expect(militarCorrespondeBusca(militar, 'joão')).toBe(true);
  });
});
