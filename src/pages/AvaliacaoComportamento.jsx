import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Scale, Wand2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PRACAS, calcularComportamento, calcularProximaMelhoria } from '@/utils/calcularComportamento';
import {
  criarPendenciaComportamentoSemDuplicidade,
  garantirImplantacaoHistoricoComportamento,
  getPunicaoEntity,
  registrarMarcoHistoricoComportamento,
} from '@/services/justicaDisciplinaService';

export default function AvaliacaoComportamento() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filtro, setFiltro] = useState('');
  const punicaoEntity = getPunicaoEntity();

  const { data: militares = [], isLoading } = useQuery({
    queryKey: ['avaliacao-comportamento-militares'],
    queryFn: () => base44.entities.Militar.list(),
  });
  const { data: punicoes = [], isLoading: loadingPunicoes } = useQuery({
    queryKey: ['avaliacao-comportamento-punicoes'],
    queryFn: () => punicaoEntity.list(),
  });
  const { data: pendencias = [] } = useQuery({
    queryKey: ['pendencias-comportamento'],
    queryFn: () => base44.entities.PendenciaComportamento?.list?.('-created_date') || [],
  });

  const avaliacao = useMemo(() => {
    return militares
      .filter((m) => PRACAS.has(m.posto_graduacao))
      .filter((m) => (`${m.nome_completo} ${m.matricula}`).toLowerCase().includes(filtro.toLowerCase()))
      .map((militar) => {
        const punicoesMilitar = punicoes.filter((p) => p.militar_id === militar.id);
        const calculado = calcularComportamento(punicoesMilitar, militar.posto_graduacao, new Date(), {
          dataInclusaoMilitar: militar.data_inclusao,
        });
        const proxima = calcularProximaMelhoria(punicoesMilitar, militar.posto_graduacao, new Date(), {
          dataInclusaoMilitar: militar.data_inclusao,
        });
        const pendenciaExistente = pendencias.find(
          (p) => p.militar_id === militar.id && p.status_pendencia === 'Pendente',
        );
        return {
          militar,
          calculado,
          proxima,
          pendenciaExistente,
          divergente: (militar.comportamento || 'Bom') !== calculado?.comportamento,
        };
      });
  }, [militares, punicoes, filtro, pendencias]);

  const aplicarSugestao = async (linha) => {
    if (!linha.calculado?.comportamento) return;

    await base44.entities.Militar.update(linha.militar.id, {
      comportamento: linha.calculado.comportamento,
    });

    await garantirImplantacaoHistoricoComportamento({
      militarId: linha.militar.id,
      comportamentoAtual: linha.militar.comportamento || 'Bom',
      origemTipo: 'Militar',
      origemId: linha.militar.id,
    });

    await registrarMarcoHistoricoComportamento({
      militarId: linha.militar.id,
      dataVigencia: new Date().toISOString().slice(0, 10),
      comportamentoAnterior: linha.militar.comportamento || 'Bom',
      comportamento: linha.calculado.comportamento,
      motivoMudanca: 'Mudança efetiva de comportamento aprovada na Avaliação de Comportamento.',
      fundamentoLegal: linha.calculado.fundamento,
      origemTipo: 'PendenciaComportamento',
      origemId: linha.pendenciaExistente?.id || '',
      observacoes: 'Mudança aprovada manualmente na Avaliação de Comportamento.',
    });
    if (linha.pendenciaExistente?.id) {
      await base44.entities.PendenciaComportamento.update(linha.pendenciaExistente.id, {
        status_pendencia: 'Aplicada',
        data_confirmacao: new Date().toISOString().slice(0, 10),
      });
    }

    await queryClient.invalidateQueries({ queryKey: ['avaliacao-comportamento-militares'] });
    await queryClient.invalidateQueries({ queryKey: ['militares'] });
    await queryClient.invalidateQueries({ queryKey: ['pendencias-comportamento'] });
  };

  const gerarPendencia = async (linha) => {
    if (!linha.divergente || linha.pendenciaExistente || !linha.calculado?.comportamento) return;
    await criarPendenciaComportamentoSemDuplicidade({
      militar_id: linha.militar.id,
      militar_nome: linha.militar.nome_completo,
      comportamento_atual: linha.militar.comportamento || 'Bom',
      comportamento_sugerido: linha.calculado.comportamento,
      fundamento_legal: linha.calculado.fundamento,
      detalhes_calculo: JSON.stringify(linha.calculado.detalhes || {}),
      data_detectada: new Date().toISOString().slice(0, 10),
      status_pendencia: 'Pendente',
      confirmado_por: null,
      data_confirmacao: null,
    });
  };

  const gerarPendencias = async () => {
    for (const linha of avaliacao.filter((a) => a.divergente && !a.pendenciaExistente)) {
      // eslint-disable-next-line no-await-in-loop
      await gerarPendencia(linha);
    }
    await queryClient.invalidateQueries({ queryKey: ['pendencias-comportamento'] });
  };

  const aplicarTodos = async () => {
    for (const linha of avaliacao.filter((a) => a.divergente)) {
      // eslint-disable-next-line no-await-in-loop
      await aplicarSugestao(linha);
    }
    await queryClient.invalidateQueries({ queryKey: ['pendencias-comportamento'] });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Scale className="w-8 h-8 text-[#1e3a5f]" />
            <div>
              <h1 className="text-3xl font-bold text-[#1e3a5f]">Avaliação de Comportamento</h1>
              <p className="text-sm text-slate-500">Verificação automática conforme Decreto nº 1.260/1981</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={gerarPendencias}>
              <Wand2 className="w-4 h-4 mr-2" />
              Gerar pendências
            </Button>
            <Button className="bg-[#1e3a5f] hover:bg-[#2d4a6f]" onClick={aplicarTodos}>
              <Wand2 className="w-4 h-4 mr-2" />
              Aplicar Todos
            </Button>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 mb-4">
          <Input placeholder="Buscar por nome ou matrícula..." value={filtro} onChange={(e) => setFiltro(e.target.value)} />
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="p-3 text-left">Nome</th>
                <th className="p-3 text-left">Posto</th>
                <th className="p-3 text-left">Atual</th>
                <th className="p-3 text-left">Calculado</th>
                <th className="p-3 text-left">Mudança sugerida</th>
                <th className="p-3 text-left">Fundamento</th>
                <th className="p-3 text-left">Próxima melhoria</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading || loadingPunicoes ? (
                <tr><td className="p-4" colSpan={8}>Carregando...</td></tr>
              ) : avaliacao.map((linha) => (
                <tr key={linha.militar.id} className={linha.divergente ? 'bg-amber-50' : 'bg-white'}>
                  <td className="p-3">{linha.militar.nome_completo}</td>
                  <td className="p-3">{linha.militar.posto_graduacao}</td>
                  <td className="p-3">{linha.militar.comportamento || 'Bom'}</td>
                  <td className="p-3">{linha.calculado?.comportamento || '—'}</td>
                  <td className="p-3">
                    {linha.divergente
                      ? `${linha.militar.comportamento || 'Bom'} → ${linha.calculado?.comportamento || '—'}`
                      : 'Sem mudança'}
                  </td>
                  <td className="p-3">{linha.calculado?.fundamento || '—'}</td>
                  <td className="p-3">{linha.proxima?.data ? `${linha.proxima.data} (${linha.proxima.comportamento_futuro})` : '—'}</td>
                  <td className="p-3">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => navigate(createPageUrl('DetalheComportamento') + `?id=${linha.militar.id}`)}>
                        Detalhar
                      </Button>
                      {linha.divergente ? (
                        <>
                          <Button variant="outline" size="sm" onClick={() => gerarPendencia(linha)}>
                            {linha.pendenciaExistente ? 'Pendência criada' : 'Gerar pendência'}
                          </Button>
                          <Button size="sm" onClick={() => aplicarSugestao(linha)}>
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            Aplicar Sugestão
                          </Button>
                        </>
                      ) : (
                        <span className="text-slate-400 inline-flex items-center"><AlertTriangle className="w-4 h-4 mr-1" />Sem divergência</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
