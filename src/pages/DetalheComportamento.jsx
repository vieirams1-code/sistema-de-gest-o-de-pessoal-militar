import React, { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Gavel } from 'lucide-react';
import ComportamentoTimeline from '@/components/militar/ComportamentoTimeline';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { calcularComportamento, calcularProximaMelhoria } from '@/utils/calcularComportamento';
import { getPunicaoEntity, obterHistoricoComportamentoMilitar } from '@/services/justicaDisciplinaService';

export default function DetalheComportamento() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id');
  const punicaoEntity = getPunicaoEntity();

  const { data: militar } = useQuery({
    queryKey: ['detalhe-comportamento-militar', id],
    queryFn: () => base44.entities.Militar.filter({ id }).then((r) => r[0] || null),
    enabled: !!id,
  });

  const { data: punicoes = [] } = useQuery({
    queryKey: ['detalhe-comportamento-punicoes', id],
    queryFn: () => punicaoEntity.filter({ militar_id: id }, '-data_fim_cumprimento'),
    enabled: !!id,
  });

  const { data: historico = [] } = useQuery({
    queryKey: ['detalhe-comportamento-historico', id],
    queryFn: () => obterHistoricoComportamentoMilitar(id, { ordem: 'asc' }),
    enabled: !!id,
  });

  const calculado = useMemo(() => {
    if (!militar) return null;
    return calcularComportamento(punicoes, militar.posto_graduacao, new Date(), {
      dataInclusaoMilitar: militar.data_inclusao,
    });
  }, [militar, punicoes]);

  const proximaMelhoria = useMemo(() => {
    if (!militar) return null;
    return calcularProximaMelhoria(punicoes, militar.posto_graduacao, new Date(), {
      dataInclusaoMilitar: militar.data_inclusao,
    });
  }, [militar, punicoes]);

  if (!militar) return <div className="p-6">Carregando...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-5xl mx-auto p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold text-[#1e3a5f]">Detalhe de Comportamento Disciplinar</h1>
        </div>

        <div className="bg-white rounded-xl border p-4">
          <h2 className="font-semibold">{militar.posto_graduacao} {militar.nome_completo}</h2>
          <p className="text-sm text-slate-500">Matrícula: {militar.matricula}</p>
          <p className="mt-2"><strong>Comportamento atual:</strong> {militar.comportamento || 'Bom'}</p>
          <p><strong>Comportamento calculado:</strong> {calculado?.comportamento || '—'}</p>
          <p><strong>Fundamento:</strong> {calculado?.fundamento || '—'}</p>
          <p><strong>Próxima melhoria:</strong> {proximaMelhoria?.data ? `${proximaMelhoria.data} → ${proximaMelhoria.comportamento_futuro}` : 'Sem melhoria prevista'}</p>
        </div>

        <div className="bg-white rounded-xl border p-4">
          <h3 className="font-semibold mb-3">Cálculo por janela</h3>
          {['janela_1_ano', 'janela_2_anos', 'janela_4_anos', 'janela_8_anos'].map((chave) => {
            const janela = calculado?.detalhes?.[chave];
            if (!janela) return null;
            return (
              <div key={chave} className="mb-3 rounded border p-3">
                <p className="font-medium">{chave.replaceAll('_', ' ')}</p>
                <p className="text-sm text-slate-600">Período: {janela.inicio} até {janela.fim}</p>
                <p className="text-sm text-slate-600">Punições: {janela.quantidade}</p>
                <p className="text-sm text-slate-600">Prisão equivalente: {janela.prisao_equivalente}</p>
                <p className="text-sm text-slate-600">Detenção equivalente: {janela.detencao_equivalente}</p>
              </div>
            );
          })}
        </div>

        <div className="bg-white rounded-xl border p-4">
          <h3 className="font-semibold mb-3">Timeline de punições (data_fim_cumprimento)</h3>
          <div className="space-y-2">
            {punicoes.map((p) => (
              <div key={p.id} className="border rounded p-3">
                <p className="font-medium">{p.tipo_punicao || p.tipo}</p>
                <p className="text-sm text-slate-600">Data base: {p.data_fim_cumprimento || p.data_termino || p.data_punicao || p.data_aplicacao || '—'}</p>
                <p className="text-sm text-slate-600">Status: {p.status_punicao || p.status || 'Ativa'}</p>
                <p className="text-sm text-slate-600">Dias: {p.dias || p.dias_punicao || 0}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border p-4">
          <h3 className="font-semibold mb-3 inline-flex items-center gap-2"><Gavel className="w-4 h-4" />Histórico de comportamento</h3>
          <ComportamentoTimeline eventos={historico} />
        </div>
      </div>
    </div>
  );
}
