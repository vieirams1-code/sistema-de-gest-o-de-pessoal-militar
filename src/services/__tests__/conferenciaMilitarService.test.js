import { describe, it, expect, vi, beforeEach } from 'vitest';
import { conferenciaMilitarService } from '../conferenciaMilitarService';
import { base44 } from '@/api/base44Client';
import * as cudEscopadoClient from '../cudEscopadoClient';

vi.mock('@/api/base44Client', () => ({
  base44: {
    entities: {
      ConferenciaMilitar: {
        get: vi.fn(),
        query: vi.fn(() => ({
          where: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
          get: vi.fn(),
        })),
      },
      ItemConferenciaMilitar: {
        query: vi.fn(() => ({
          where: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
          get: vi.fn(),
        })),
      },
    },
  },
}));

vi.mock('../cudEscopadoClient', () => ({
  criarEscopado: vi.fn(),
  atualizarEscopado: vi.fn(),
  bulkEscopado: vi.fn(),
}));

describe('conferenciaMilitarService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('gerarItensPadraoConferencia', () => {
    it('deve gerar itens de ingresso para tipo ingresso', async () => {
      await conferenciaMilitarService.gerarItensPadraoConferencia('conf123', 'ingresso', 'milt123');

      expect(cudEscopadoClient.bulkEscopado).toHaveBeenCalledWith(
        'ItemConferenciaMilitar',
        expect.arrayContaining([
          expect.objectContaining({ titulo: 'Conferir dados funcionais básicos' }),
          expect.objectContaining({ titulo: 'Conferir histórico de promoções' }),
        ])
      );

      const calls = cudEscopadoClient.bulkEscopado.mock.calls[0][1];
      expect(calls.length).toBe(10);
    });

    it('deve gerar itens de retorno para tipo reativacao', async () => {
      await conferenciaMilitarService.gerarItensPadraoConferencia('conf123', 'reativacao', 'milt123');

      expect(cudEscopadoClient.bulkEscopado).toHaveBeenCalledWith(
        'ItemConferenciaMilitar',
        expect.arrayContaining([
          expect.objectContaining({ titulo: 'Conferir alterações funcionais no período de ausência' }),
          expect.objectContaining({ titulo: 'Validar situação atual do militar após retorno' }),
        ])
      );

      const calls = cudEscopadoClient.bulkEscopado.mock.calls[0][1];
      expect(calls.length).toBe(9);
    });
  });

  describe('concluirConferencia', () => {
    it('não deve concluir se houver item obrigatório pendente', async () => {
      vi.spyOn(conferenciaMilitarService, 'obterConferenciaDetalhada').mockResolvedValue({
        id: 'conf1',
        status: 'em_andamento',
        itens: [
          { id: 'item1', obrigatorio: true, status: 'pendente' }
        ]
      });

      await expect(conferenciaMilitarService.concluirConferencia('conf1'))
        .rejects.toThrow(/existem 1 itens obrigatórios pendentes/);
    });

    it('deve concluir como concluida se todos os itens estiverem conferidos', async () => {
      vi.spyOn(conferenciaMilitarService, 'obterConferenciaDetalhada').mockResolvedValue({
        id: 'conf1',
        status: 'em_andamento',
        itens: [
          { id: 'item1', obrigatorio: true, status: 'conferido' },
          { id: 'item2', obrigatorio: true, status: 'nao_possui' }
        ]
      });

      await conferenciaMilitarService.concluirConferencia('conf1');

      expect(cudEscopadoClient.atualizarEscopado).toHaveBeenCalledWith(
        'ConferenciaMilitar',
        'conf1',
        expect.objectContaining({ status: 'concluida' })
      );
    });

    it('deve concluir como concluida_com_pendencias se houver itens para revisar ou não localizado', async () => {
      vi.spyOn(conferenciaMilitarService, 'obterConferenciaDetalhada').mockResolvedValue({
        id: 'conf1',
        status: 'em_andamento',
        itens: [
          { id: 'item1', obrigatorio: true, status: 'conferido' },
          { id: 'item2', obrigatorio: true, status: 'revisar' }
        ]
      });

      await conferenciaMilitarService.concluirConferencia('conf1');

      expect(cudEscopadoClient.atualizarEscopado).toHaveBeenCalledWith(
        'ConferenciaMilitar',
        'conf1',
        expect.objectContaining({ status: 'concluida_com_pendencias' })
      );
    });
  });

  describe('atualizarStatusConferencia', () => {
    it('deve calcular progresso corretamente', async () => {
      vi.spyOn(conferenciaMilitarService, 'obterConferenciaDetalhada').mockResolvedValue({
        id: 'conf1',
        status: 'pendente',
        itens: [
          { id: 'item1', status: 'conferido' },
          { id: 'item2', status: 'pendente' },
          { id: 'item3', status: 'pendente' },
          { id: 'item4', status: 'pendente' },
        ]
      });

      await conferenciaMilitarService.atualizarStatusConferencia('conf1');

      expect(cudEscopadoClient.atualizarEscopado).toHaveBeenCalledWith(
        'ConferenciaMilitar',
        'conf1',
        expect.objectContaining({
          progresso_percentual: 25,
          status: 'em_andamento'
        })
      );
    });
  });
});
