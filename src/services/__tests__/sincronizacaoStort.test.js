import { describe, it, expect, vi } from 'vitest';
import { atualizarCadastroMilitar } from '../../../base44/functions/utils';
import { getPostoGraduacaoOficial } from '../../utils/militarPostoGraduacao';

describe('Sincronização Rafael Stort Zulli', () => {
  it('deve atualizar todos os campos redundantes (incluindo acentuados) e ser detectado pelo helper do Efetivo', async () => {
    const militarId = 'stort-id';
    const dadosNovos = { posto_graduacao: 'Cabo', quadro: 'QBMP-1.a' };

    // Mock do Militar com campos redundantes
    const militarMock = {
      id: militarId,
      matricula: '415.443-021',
      nome_completo: 'Rafael Stort Zulli',
      posto_graduacao: 'Soldado',
      posto_grad: 'Soldado',
      posto: 'Soldado',
      graduacao: 'Soldado',
      posto_graduacao_atual: 'Soldado',
      'posto_graduação': 'Soldado',
      quadro: 'QBMP-1.a',
      quadro_atual: 'QBMP-1.a',
      militar_quadro: 'QBMP-1.a',
      status_cadastro: 'Ativo'
    };

    const updatesEnviados = [];
    const base44Mock = {
      asServiceRole: {
        entities: {
          Militar: {
            get: vi.fn()
              .mockResolvedValueOnce(militarMock) // Primeiro get em atualizarCadastroMilitar
              .mockResolvedValueOnce({
                ...militarMock,
                posto_graduacao: 'Cabo',
                posto_grad: 'Cabo',
                posto: 'Cabo',
                graduacao: 'Cabo',
                posto_graduacao_atual: 'Cabo',
                'posto_graduação': 'Cabo',
                quadro: 'QBMP-1.a',
                quadro_atual: 'QBMP-1.a',
                militar_quadro: 'QBMP-1.a',
              }), // Segundo get em atualizarCadastroMilitar (releitura)
            update: vi.fn().mockImplementation((id, data) => {
              updatesEnviados.push(data);
              return Promise.resolve();
            })
          },
          AssistenteLog: {
            create: vi.fn().mockResolvedValue({})
          }
        }
      }
    };

    const result = await atualizarCadastroMilitar(
      base44Mock,
      militarId,
      dadosNovos,
      { executado_por: 'test@example.com', origem: 'teste' }
    );

    expect(result.success).toBe(true);
    const payload = updatesEnviados[0];

    // Verifica se os campos fundamentais e redundantes foram incluídos no payload
    expect(payload.posto_graduacao).toBe('Cabo');
    expect(payload.posto_grad).toBe('Cabo');
    expect(payload.posto).toBe('Cabo');
    expect(payload.graduacao).toBe('Cabo');
    expect(payload.posto_graduacao_atual).toBe('Cabo');
    expect(payload['posto_graduação']).toBe('Cabo');

    // Simula a releitura que o Efetivo faria usando o payload resultante
    const militarAposUpdate = {
        ...militarMock,
        ...payload
    };

    const rankCalculado = getPostoGraduacaoOficial(militarAposUpdate);
    expect(rankCalculado).toBe('Cabo');
  });
});
