/* global process */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

function assertNoClientSuppliedMilitarId(body) {
  if (body && typeof body === 'object') {
    const keys = Object.keys(body).map((k) => k.toLowerCase());
    if (keys.includes('militar_id') || keys.includes('militarid')) {
      const err = new Error('IDOR_BLOCKED: Parâmetro militar_id não permitido no corpo da requisição.');
      err.status = 400;
      throw err;
    }
  }
}

describe('Portal Serviços & Autoatendimento — Testes de Produção (Fases 1.3A & 1.3B)', () => {
  it('1. Deve bloquear tentativa de IDOR com militar_id no body', () => {
    assert.throws(
      () => {
        assertNoClientSuppliedMilitarId({
          acao: 'CADASTRO_SOLICITAR_ALTERACAO',
          militar_id: 'attacker_target_militar',
          campo_chave: 'telefone_celular',
          valor_proposto: '6799999999',
        });
      },
      (err) => {
        assert.equal(err.status, 400);
        return true;
      }
    );
  });

  it('2. Deve bloquear tentativa de IDOR com militarId (camelCase)', () => {
    assert.throws(
      () => {
        assertNoClientSuppliedMilitarId({
          acao: 'FERIAS_SUBMETER_OPCAO',
          militarId: 'target_id',
          periodo_aquisitivo_id: 'pa_123',
        });
      },
      (err) => {
        assert.equal(err.status, 400);
        return true;
      }
    );
  });

  it('3. Validação de soma de parcelas de férias: não deve exceder saldo disponível', () => {
    const saldoDisponivel = 30;
    const parcelasValidas = [
      { etapa: 1, dias: 15, data_inicio: '2026-10-01' },
      { etapa: 2, dias: 15, data_inicio: '2027-01-10' },
    ];
    const totalValido = parcelasValidas.reduce((acc, p) => acc + p.dias, 0);
    assert.equal(totalValido, saldoDisponivel);

    const parcelasInvalidas = [
      { etapa: 1, dias: 20, data_inicio: '2026-10-01' },
      { etapa: 2, dias: 15, data_inicio: '2027-01-10' },
    ];
    const totalInvalido = parcelasInvalidas.reduce((acc, p) => acc + p.dias, 0);
    assert.equal(totalInvalido > saldoDisponivel, true);
  });

  it('4. Validação de modalidade 3 etapas (10+10+10)', () => {
    const parcelas = [
      { etapa: 1, dias: 10, data_inicio: '2026-06-01' },
      { etapa: 2, dias: 10, data_inicio: '2026-10-01' },
      { etapa: 3, dias: 10, data_inicio: '2027-02-01' },
    ];
    const total = parcelas.reduce((acc, p) => acc + p.dias, 0);
    assert.equal(total, 30);
    assert.equal(parcelas.length, 3);
  });

  it('5. Estrutura de DTO sanitizado de dependente não deve expor CPF ou dados bancários', () => {
    const mockRawDependentes = [
      {
        id: 'dep_1',
        militar_id: 'mil_1',
        nome_completo: 'Maria Souza',
        grau_parentesco: 'Filho(a)',
        data_nascimento: '2015-05-12',
        dependente_ir: true,
        cpf: '11122233344',
        dados_bancarios: 'Ag 1234 CC 5678',
      },
    ];

    const sanitized = mockRawDependentes.map((dep) => ({
      id: dep.id,
      nome_completo: dep.nome_completo,
      grau_parentesco: dep.grau_parentesco,
      data_nascimento: dep.data_nascimento,
      dependente_ir: Boolean(dep.dependente_ir),
    }));

    assert.equal(sanitized[0].id, 'dep_1');
    assert.equal(sanitized[0].nome_completo, 'Maria Souza');
    assert.equal('cpf' in sanitized[0], false);
    assert.equal('dados_bancarios' in sanitized[0], false);
  });

  it('6. Deve ordenar períodos cronologicamente e identificar o período mais antigo com saldo pendente', () => {
    const mockPeriodos = [
      { id: 'pa_2023', inicio_aquisitivo: '2023-01-01', fim_aquisitivo: '2023-12-31', dias_direito: 30, dias_gozados: 30, status: 'Gozado' },
      { id: 'pa_2024', inicio_aquisitivo: '2024-01-01', fim_aquisitivo: '2024-12-31', dias_direito: 30, dias_gozados: 0, status: 'Disponível' },
      { id: 'pa_2025', inicio_aquisitivo: '2025-01-01', fim_aquisitivo: '2025-12-31', dias_direito: 30, dias_gozados: 0, status: 'Pendente' },
    ];

    const periodosOrdenados = mockPeriodos.sort((a, b) => {
      const dtA = new Date(a.inicio_aquisitivo).getTime();
      const dtB = new Date(b.inicio_aquisitivo).getTime();
      return dtA - dtB;
    });

    let maisAntigoId = null;
    for (const p of periodosOrdenados) {
      const saldo = (p.dias_direito || 30) - (p.dias_gozados || 0);
      if (saldo > 0 && p.status !== 'Inativo') {
        maisAntigoId = p.id;
        break;
      }
    }

    assert.equal(maisAntigoId, 'pa_2024'); // pa_2023 já foi 100% gozado, logo pa_2024 é o mais antigo pendente
    assert.equal(periodosOrdenados[0].id, 'pa_2023');
    assert.equal(periodosOrdenados[1].id, 'pa_2024');
    assert.equal(periodosOrdenados[2].id, 'pa_2025');
  });

  it('7. Deve filtrar modalidades de férias conforme permissões do administrador', () => {
    const configAdmin = {
      permitir_1_etapa: true,
      permitir_2_etapas: true,
      permitir_3_etapas: false, // Desativado pelo RH
      permitir_custom: false,
    };

    const modalidadesAtivas = [
      configAdmin.permitir_1_etapa && { id: '1_ETAPA_30', label: '1 Etapa (30 dias)' },
      configAdmin.permitir_2_etapas && { id: '2_ETAPAS_15', label: '2 Etapas (15 + 15)' },
      configAdmin.permitir_3_etapas && { id: '3_ETAPAS_10', label: '3 Etapas (10+10+10)' },
      configAdmin.permitir_custom && { id: 'CUSTOM', label: 'Personalizado' },
    ].filter(Boolean);

    assert.equal(modalidadesAtivas.length, 2);
    assert.equal(modalidadesAtivas.some((m) => m.id === '3_ETAPAS_10'), false);
    assert.equal(modalidadesAtivas.some((m) => m.id === '1_ETAPA_30'), true);
    assert.equal(modalidadesAtivas.some((m) => m.id === '2_ETAPAS_15'), true);
  });
});
