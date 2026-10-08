import { describe, expect, it } from 'vitest';
import {
  listarLotacoesDisponiveis,
  montarPlanoAnualFerias,
} from '../planoAnualFeriasDocumentoService';

const militares = [
  {
    id: 'm1', nome_completo: 'MILITAR UM', posto_graduacao: 'CB',
    matricula: '123-021', data_inclusao: '2015-08-10',
    estrutura_nome: '1º GBM',
  },
  {
    id: 'm2', nome_completo: 'MILITAR DOIS', posto_graduacao: 'SD',
    matricula: '999-021', data_inclusao: '2020-03-02',
    estrutura_nome: '2º GBM',
  },
];
const periodos = [
  {
    id: 'p1', militar_id: 'm1', inicio_aquisitivo: '2024-07-31',
    fim_aquisitivo: '2025-07-30', data_limite_gozo: '2027-07-30',
  },
];
const ferias = [
  {
    id: 'a', militar_id: 'm1', periodo_aquisitivo_id: 'p1',
    data_inicio: '2026-01-05', data_fim: '2026-01-19', dias: 15,
    tipo: 'Férias Regulares', status: 'Autorizada',
  },
  {
    id: 'b', militar_id: 'm1', periodo_aquisitivo_id: 'p1',
    data_inicio: '2026-07-01', data_fim: '2026-07-15', dias: 15,
    tipo: 'Férias Regulares', status: 'Prevista',
    data_saida_registrada: '2026-07-01T07:30:00',
  },
  {
    id: 'c', militar_id: 'm1', periodo_aquisitivo_id: 'p1',
    data_inicio: '2026-08-01', data_fim: '2026-08-15', dias: 15,
    tipo: 'Férias Regulares', status: 'Cancelada',
  },
  {
    id: 'd', militar_id: 'm2', data_inicio: '2026-09-05',
    tipo: 'Recesso', status: 'Prevista',
  },
  {
    id: 'e', militar_id: 'm2', data_inicio: '2025-12-05',
    tipo: 'Férias Regulares', status: 'Gozada',
  },
];

describe('emissão do Plano Anual de Férias', () => {
  it('agrupa pelo início das férias, omite canceladas e tipos alheios, sem repetir anos anteriores', () => {
    const plano = montarPlanoAnualFerias({ ano: 2026, ferias, militares, periodosAquisitivos: periodos });
    expect(plano.totalRegistros).toBe(2);
    expect(plano.totalMilitares).toBe(1);
    expect(plano.meses[0].linhas).toHaveLength(1);
    expect(plano.meses[6].linhas).toHaveLength(1);
    expect(plano.meses[7].linhas).toHaveLength(0);
    expect(plano.meses[8].linhas).toHaveLength(0);
  });

  it('mantém cada fração e utiliza o período aquisitivo vinculado', () => {
    const plano = montarPlanoAnualFerias({ ano: 2026, ferias, militares, periodosAquisitivos: periodos });
    const primeira = plano.meses[0].linhas[0];
    const segunda = plano.meses[6].linhas[0];
    expect(primeira.fracionamento).toContain('1ª de 2 etapas');
    expect(segunda.fracionamento).toContain('2ª de 2 etapas');
    expect(primeira.periodoAquisitivo).toBe('31/07/2024 a 30/07/2025');
    expect(primeira.periodoConcessivo).toBe('31/07/2025 a 30/07/2027');
    expect(primeira.livro).toBe('');
    expect(segunda.livro).toContain('Saída: 01/07/2026');
    expect(segunda.livro).not.toContain('Retorno');
  });

  it('usa matrícula atual autorizada e respeita a lotação selecionada', () => {
    const matriculasMilitar = [{
      id: 'mat1', militar_id: 'm1', matricula: '456.789-021',
      is_atual: true, data_inicio: '2025-01-01',
    }];
    const opcoes = listarLotacoesDisponiveis({ ano: 2026, ferias, militares });
    expect(opcoes).toEqual(['1º GBM']);
    const plano = montarPlanoAnualFerias({
      ano: 2026, ferias, militares, matriculasMilitar,
      periodosAquisitivos: periodos, lotacao: '1º GBM',
    });
    expect(plano.meses[0].linhas[0].matricula).toBe('456.789-021');
    expect(montarPlanoAnualFerias({
      ano: 2026, ferias, militares, periodosAquisitivos: periodos,
      lotacao: '2º GBM',
    }).totalRegistros).toBe(0);
  });

  it('não altera os registros originais', () => {
    const entrada = structuredClone(ferias);
    montarPlanoAnualFerias({ ano: 2026, ferias, militares, periodosAquisitivos: periodos });
    expect(ferias).toEqual(entrada);
  });
});
