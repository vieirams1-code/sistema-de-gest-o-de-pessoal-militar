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
  excluirHistoricoImportacaoMilitares,
  filtrarLotesHistorico,
  listarHistoricoImportacoesMilitares,
  montarResumoHistorico,
  STATUS_LOTE_OPTIONS,
} from '@/services/historicoImportacoesMilitaresService';

const FILTROS_INICIAIS = {
  busca: '',
  inicio: '',
  fim: '',
  tipoImportacao: 'TODOS',
  status: 'TODOS',
  executor: 'TODOS',
};

const TEXTO_CONFIRMACAO_EXCLUSAO = `Deseja excluir este lote do histórico de importação?\nEsta ação remove apenas o registro do histórico e não apaga os militares já importados.`;

export default function HistoricoImportacoesMilitares() {
  const { isAdmin, isLoading, isAccessResolved } = useCurrentUser();
  const { toast } = useToast();

  const [filtros, setFiltros] = useState(FILTROS_INICIAIS);
  const [carregando, setCarregando] = useState(true);
  const [lotes, setLotes] = useState([]);
  const [loteSelecionado, setLoteSelecionado] = useState(null);
  const [lotesExcluindo, setLotesExcluindo] = useState({});

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

  const excluirLote = async (lote) => {
    if (!lote?.id) return;
    if (lotesExcluindo[lote.id]) return;

    const confirmar = window.confirm(TEXTO_CONFIRMACAO_EXCLUSAO);
    if (!confirmar) return;

    setLotesExcluindo((prev) => ({ ...prev, [lote.id]: true }));

    try {
      await excluirHistoricoImportacaoMilitares(lote.id);

      setLotes((prev) => prev.filter((item) => item.id !== lote.id));
      setLoteSelecionado((prev) => (prev?.id === lote.id ? null : prev));

      toast({
        title: 'Lote excluído do histórico',
        description: 'O registro foi removido do histórico. Os militares importados permanecem intactos.',
      });
    } catch (error) {
      toast({
        title: 'Falha ao excluir lote',
        description: error?.message || 'Não foi possível excluir este lote no momento.',
        variant: 'destructive',
      });
    } finally {
      setLotesExcluindo((prev) => {
        const next = { ...prev };
        delete next[lote.id];
        return next;
      });
    }
  };

  const tiposImportacao = useMemo(() => [...new Set(lotes.map((item) => item.tipoImportacao).filter(Boolean))], [lotes]);
  const executores = useMemo(() => [...new Set(lotes.map((item) => item.importadoPor).filter(Boolean))], [lotes]);
  const lotesFiltrados = useMemo(() => filtrarLotesHistorico(lotes, filtros), [lotes, filtros]);
  const resumo = useMemo(() => montarResumoHistorico(lotesFiltrados), [lotesFiltrados]);

  if (isLoading || !isAccessResolved) return null;
  if (!isAdmin) return <AccessDenied modulo="Histórico de Importações" />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-5">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <History className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-[#1e3a5f]">Histórico de Importações</h1>
              <p className="text-sm text-slate-500">Acompanhe lotes processados, status, executores e resultados por importação.</p>
            </div>
          </div>
          <Button variant="outline" onClick={carregar} disabled={carregando}>
            <RefreshCcw className="w-4 h-4 mr-2" /> Atualizar listagem
          </Button>
        </div>

        <HistoricoImportacoesMilitaresResumoCards resumo={resumo} />

        <HistoricoImportacoesMilitaresFiltros
          filtros={filtros}
          onChangeFiltros={(patch) => setFiltros((prev) => ({ ...prev, ...patch }))}
          onLimpar={() => setFiltros(FILTROS_INICIAIS)}
          tiposImportacao={tiposImportacao}
          executores={executores}
          statusOptions={STATUS_LOTE_OPTIONS}
        />

        {carregando ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">Carregando histórico...</div>
        ) : (
          <HistoricoImportacoesMilitaresLista
            lotes={lotesFiltrados}
            lotesExcluindo={lotesExcluindo}
            onAbrirDetalhe={setLoteSelecionado}
            onExcluirLote={excluirLote}
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
