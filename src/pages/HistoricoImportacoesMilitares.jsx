import React, { useEffect, useMemo, useState } from 'react';
import { History, RefreshCcw } from 'lucide-react';
import AccessDenied from '@/components/auth/AccessDenied';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import HistoricoImportacoesMilitaresResumoCards from '@/components/migracao-militares/HistoricoImportacoesMilitaresResumoCards';
import HistoricoImportacoesMilitaresFiltros from '@/components/migracao-militares/HistoricoImportacoesMilitaresFiltros';
import HistoricoImportacoesMilitaresLista from '@/components/migracao-militares/HistoricoImportacoesMilitaresLista';
import DetalheImportacaoMilitaresDrawer from '@/components/migracao-militares/DetalheImportacaoMilitaresDrawer';
import {
  atualizarOcultacaoHistoricoImportacaoMilitares,
  filtrarLotesHistorico,
  listarHistoricoImportacoesMilitares,
  montarResumoHistorico,
} from '@/services/historicoImportacoesMilitaresService';

const FILTROS_INICIAIS = {
  arquivo: '',
  inicio: '',
  fim: '',
  comPendencias: false,
  comErro: false,
  somenteConcluida: false,
  somenteAnalise: false,
  comRevisar: false,
  comLinhasErro: false,
  comAlerta: false,
  mostrarOcultadas: false,
};

export default function HistoricoImportacoesMilitares() {
  const { isAdmin, isLoading, isAccessResolved } = useCurrentUser();
  const { toast } = useToast();

  const [filtros, setFiltros] = useState(FILTROS_INICIAIS);
  const [carregando, setCarregando] = useState(true);
  const [lotes, setLotes] = useState([]);
  const [loteSelecionado, setLoteSelecionado] = useState(null);

  const carregar = async () => {
    try {
      setCarregando(true);
      const lista = await listarHistoricoImportacoesMilitares();
      setLotes(lista);
    } catch (error) {
      toast({
        title: 'Falha ao carregar histórico',
        description: error?.message || 'Não foi possível carregar os lotes de importação.',
        variant: 'destructive',
      });
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const ocultarLote = async (lote) => {
    if (!lote?.id) return;
    const confirmar = window.confirm(`Deseja ocultar o lote "${lote.nomeArquivo || 'Sem nome'}" do histórico?`);
    if (!confirmar) return;

    try {
      await atualizarOcultacaoHistoricoImportacaoMilitares(lote.id, true);
      setLotes((prev) => prev.map((item) => (item.id === lote.id ? { ...item, ocultoNoHistorico: true } : item)));
      toast({
        title: 'Lote ocultado',
        description: 'O lote foi removido da listagem padrão do histórico.',
      });
    } catch (error) {
      toast({
        title: 'Falha ao ocultar lote',
        description: error?.message || 'Não foi possível ocultar este lote no momento.',
        variant: 'destructive',
      });
    }
  };

  const restaurarLote = async (lote) => {
    if (!lote?.id) return;

    try {
      await atualizarOcultacaoHistoricoImportacaoMilitares(lote.id, false);
      setLotes((prev) => prev.map((item) => (item.id === lote.id ? { ...item, ocultoNoHistorico: false } : item)));
      toast({
        title: 'Lote restaurado',
        description: 'O lote voltou a aparecer normalmente no histórico.',
      });
    } catch (error) {
      toast({
        title: 'Falha ao restaurar lote',
        description: error?.message || 'Não foi possível restaurar este lote no momento.',
        variant: 'destructive',
      });
    }
  };

  const lotesFiltrados = useMemo(() => filtrarLotesHistorico(lotes, filtros), [lotes, filtros]);
  const resumo = useMemo(() => montarResumoHistorico(lotesFiltrados), [lotesFiltrados]);

  if (isLoading || !isAccessResolved) return null;
  if (!isAdmin) return <AccessDenied modulo="Histórico de Importações" />;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <History className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#1e3a5f]">Histórico de Importações</h1>
              <p className="text-sm text-slate-500">Visão operacional para conferência de lotes de Migração de Militares.</p>
            </div>
          </div>
          <Button variant="outline" onClick={carregar} disabled={carregando}>
            <RefreshCcw className="w-4 h-4 mr-2" /> Atualizar
          </Button>
        </div>

        <HistoricoImportacoesMilitaresResumoCards resumo={resumo} />

        <HistoricoImportacoesMilitaresFiltros
          filtros={filtros}
          onChangeFiltros={(patch) => setFiltros((prev) => ({ ...prev, ...patch }))}
          onLimpar={() => setFiltros(FILTROS_INICIAIS)}
        />

        {carregando ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">Carregando histórico...</div>
        ) : (
          <HistoricoImportacoesMilitaresLista
            lotes={lotesFiltrados}
            mostrarOcultadas={filtros.mostrarOcultadas}
            onAbrirDetalhe={setLoteSelecionado}
            onOcultarLote={ocultarLote}
            onRestaurarLote={restaurarLote}
          />
        )}
      </div>

      <DetalheImportacaoMilitaresDrawer
        open={Boolean(loteSelecionado)}
        onOpenChange={(open) => !open && setLoteSelecionado(null)}
        lote={loteSelecionado}
      />
    </div>
  );
}
