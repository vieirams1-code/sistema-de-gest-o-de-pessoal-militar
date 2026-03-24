import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Scale, Wand2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PRACAS, calcularComportamento, calcularProximaMelhoria } from '@/utils/calcularComportamento';

export default function AvaliacaoComportamento() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filtro, setFiltro] = useState('');

  const { data: militares = [], isLoading } = useQuery({
    queryKey: ['avaliacao-comportamento-militares'],
    queryFn: () => base44.entities.Militar.list(),
  });
  const { data: punicoes = [], isLoading: loadingPunicoes } = useQuery({
    queryKey: ['avaliacao-comportamento-punicoes'],
    queryFn: () => base44.entities.Punicao.list(),
  });

  const avaliacao = useMemo(() => {
    return militares
      .filter((m) => PRACAS.has(m.posto_graduacao))
      .filter((m) => (`${m.nome_completo} ${m.matricula}`).toLowerCase().includes(filtro.toLowerCase()))
      .map((militar) => {
        const punicoesMilitar = punicoes.filter((p) => p.militar_id === militar.id);
        const calculado = calcularComportamento(punicoesMilitar, militar.posto_graduacao);
        const proxima = calcularProximaMelhoria(punicoesMilitar, militar.posto_graduacao);
        return {
          militar,
          calculado,
          proxima,
          divergente: (militar.comportamento || 'Bom') !== calculado?.comportamento,
        };
      });
  }, [militares, punicoes, filtro]);

  const aplicarSugestao = async (linha) => {
    if (!linha.calculado?.comportamento) return;

    await base44.entities.Militar.update(linha.militar.id, {
      comportamento: linha.calculado.comportamento,
    });

    await base44.entities.HistoricoComportamento.create({
      militar_id: linha.militar.id,
      comportamento_anterior: linha.militar.comportamento || 'Bom',
      comportamento_novo: linha.calculado.comportamento,
      fundamento_legal: linha.calculado.fundamento,
      motivo: 'Aplicação manual de sugestão de cálculo',
      data_alteracao: new Date().toISOString().slice(0, 10),
    });

    await queryClient.invalidateQueries({ queryKey: ['avaliacao-comportamento-militares'] });
    await queryClient.invalidateQueries({ queryKey: ['militares'] });
  };

  const aplicarTodos = async () => {
    for (const linha of avaliacao.filter((a) => a.divergente)) {
      // eslint-disable-next-line no-await-in-loop
      await aplicarSugestao(linha);
    }
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
          <Button className="bg-[#1e3a5f] hover:bg-[#2d4a6f]" onClick={aplicarTodos}>
            <Wand2 className="w-4 h-4 mr-2" />
            Aplicar todos
          </Button>
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
                <th className="p-3 text-left">Fundamento</th>
                <th className="p-3 text-left">Próxima melhoria</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading || loadingPunicoes ? (
                <tr><td className="p-4" colSpan={7}>Carregando...</td></tr>
              ) : avaliacao.map((linha) => (
                <tr key={linha.militar.id} className={linha.divergente ? 'bg-amber-50' : 'bg-white'}>
                  <td className="p-3">{linha.militar.nome_completo}</td>
                  <td className="p-3">{linha.militar.posto_graduacao}</td>
                  <td className="p-3">{linha.militar.comportamento || 'Bom'}</td>
                  <td className="p-3">{linha.calculado?.comportamento || '—'}</td>
                  <td className="p-3">{linha.calculado?.fundamento || '—'}</td>
                  <td className="p-3">{linha.proxima?.data ? `${linha.proxima.data} (${linha.proxima.comportamento_futuro})` : '—'}</td>
                  <td className="p-3">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => navigate(createPageUrl('DetalheComportamento') + `?id=${linha.militar.id}`)}>
                        Detalhar
                      </Button>
                      {linha.divergente ? (
                        <Button size="sm" onClick={() => aplicarSugestao(linha)}>
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                          Aplicar sugestão
                        </Button>
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
