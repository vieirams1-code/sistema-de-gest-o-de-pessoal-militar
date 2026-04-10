import React, { useMemo, useState } from 'react';
import { Database, Download, RefreshCcw, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AccessDenied from '@/components/auth/AccessDenied';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import { useToast } from '@/components/ui/use-toast';
import { base44 } from '@/api/base44Client';
import UploadMigracaoMilitares from '@/components/migracao/UploadMigracaoMilitares';
import ResumoMigracaoCards from '@/components/migracao/ResumoMigracaoCards';
import TabelaPreviaMigracao from '@/components/migracao/TabelaPreviaMigracao';
import DetalheLinhaMigracao from '@/components/migracao/DetalheLinhaMigracao';
import {
  analisarArquivoMigracao,
  exportarRelatorio,
  importarAnalise,
  salvarAnaliseHistorico,
} from '@/services/migracaoMilitaresService';

const filtros = [
  { id: 'TODOS', label: 'Todos' },
  { id: 'APTO', label: 'Aptos' },
  { id: 'APTO_COM_ALERTA', label: 'Aptos com alerta' },
  { id: 'DUPLICADO', label: 'Duplicados' },
  { id: 'ERRO', label: 'Erros' },
];

export default function MigracaoMilitares() {
  const { isAdmin, isLoading, isAccessResolved } = useCurrentUser();
  const { toast } = useToast();

  const [arquivo, setArquivo] = useState(null);
  const [analise, setAnalise] = useState(null);
  const [historicoId, setHistoricoId] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [filtro, setFiltro] = useState('TODOS');
  const [busca, setBusca] = useState('');
  const [linhaSelecionada, setLinhaSelecionada] = useState(null);
  const [resultadoImportacao, setResultadoImportacao] = useState(null);

  const linhasFiltradas = useMemo(() => {
    if (!analise) return [];
    const termo = busca.trim().toLowerCase();
    return analise.linhas.filter((linha) => {
      const matchStatus = filtro === 'TODOS' ? true : linha.status === filtro;
      const matchBusca = !termo
        ? true
        : (linha.transformado.nome_completo || '').toLowerCase().includes(termo)
          || (linha.transformado.matricula || '').toLowerCase().includes(termo);
      return matchStatus && matchBusca;
    });
  }, [analise, filtro, busca]);

  const handleAnalisar = async () => {
    if (!arquivo) return;
    try {
      setCarregando(true);
      const resultado = await analisarArquivoMigracao(arquivo);
      setAnalise(resultado);
      setResultadoImportacao(null);

      const usuario = await base44.auth.me();
      const historico = await salvarAnaliseHistorico(resultado, usuario);
      setHistoricoId(historico?.id);

      toast({ title: 'Análise concluída', description: 'Prévia gerada com sucesso.' });
    } catch (error) {
      toast({
        title: 'Falha na análise',
        description: error?.message || 'Não foi possível analisar o arquivo.',
        variant: 'destructive',
      });
    } finally {
      setCarregando(false);
    }
  };

  const handleImportar = async (incluirAlertas) => {
    if (!analise || !historicoId) return;
    try {
      setCarregando(true);
      const usuario = await base44.auth.me();
      const resultado = await importarAnalise({
        analise,
        incluirAlertas,
        historicoId,
        usuario,
      });
      setResultadoImportacao(resultado);
      toast({ title: 'Importação finalizada', description: `Foram importados ${resultado.totalImportadas} registros.` });
    } catch (error) {
      toast({ title: 'Erro na importação', description: error?.message || 'Falha ao importar lote.', variant: 'destructive' });
    } finally {
      setCarregando(false);
    }
  };

  const reiniciarFluxo = () => {
    setArquivo(null);
    setAnalise(null);
    setHistoricoId(null);
    setResultadoImportacao(null);
    setBusca('');
    setFiltro('TODOS');
  };

  if (isLoading || !isAccessResolved) return null;
  if (!isAdmin) return <AccessDenied modulo="Migração de Militares" />;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#1e3a5f]">Migração de Militares</h1>
            <p className="text-sm text-slate-500">Módulo administrativo para análise e importação de dados legados.</p>
          </div>
        </div>

        {!analise && !resultadoImportacao && (
          <>
            <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-4 text-sm">
              <p className="font-semibold mb-2 flex items-center gap-2"><ShieldAlert className="w-4 h-4" /> Regras desta primeira versão</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Lotação antiga não será importada.</li>
                <li>Função antiga não será importada.</li>
                <li>Fotos não serão importadas.</li>
                <li>Comportamento antigo não será importado.</li>
                <li>Estrutura organizacional será preenchida manualmente depois.</li>
              </ul>
            </div>
            <UploadMigracaoMilitares
              file={arquivo}
              onFileChange={setArquivo}
              onAnalisar={handleAnalisar}
              loading={carregando}
            />
          </>
        )}

        {analise && !resultadoImportacao && (
          <div className="space-y-4">
            <ResumoMigracaoCards resumo={analise.resumo} />

            <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
              <div className="flex flex-wrap gap-2">
                {filtros.map((item) => (
                  <Button
                    key={item.id}
                    size="sm"
                    variant={filtro === item.id ? 'default' : 'outline'}
                    onClick={() => setFiltro(item.id)}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
              <Input
                placeholder="Buscar por nome ou matrícula"
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                className="md:max-w-sm"
              />
            </div>

            <TabelaPreviaMigracao linhas={linhasFiltradas} onSelectLinha={setLinhaSelecionada} />

            <div className="flex flex-wrap gap-2">
              <Button disabled={carregando} className="bg-emerald-700 hover:bg-emerald-800" onClick={() => handleImportar(false)}>Importar linhas aptas</Button>
              <Button disabled={carregando} className="bg-amber-600 hover:bg-amber-700" onClick={() => handleImportar(true)}>Importar aptas e aptas com alerta</Button>
              <Button variant="outline" onClick={() => exportarRelatorio({ ...analise, estado: 'Analise' }, `relatorio-analise-${analise.arquivo.nome}.json`)}>
                <Download className="w-4 h-4 mr-2" /> Exportar relatório
              </Button>
              <Button variant="outline" onClick={reiniciarFluxo}><RefreshCcw className="w-4 h-4 mr-2" /> Nova análise</Button>
            </div>
          </div>
        )}

        {resultadoImportacao && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-semibold text-[#1e3a5f]">Importação concluída ({resultadoImportacao.statusImportacao})</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-emerald-50"><p className="text-xs text-slate-500">Total importado</p><p className="text-2xl font-bold text-emerald-700">{resultadoImportacao.totalImportadas}</p></div>
              <div className="p-3 rounded-lg bg-slate-100"><p className="text-xs text-slate-500">Total não importado</p><p className="text-2xl font-bold text-slate-700">{resultadoImportacao.totalNaoImportadas}</p></div>
              <div className="p-3 rounded-lg bg-amber-50"><p className="text-xs text-slate-500">Total com alerta</p><p className="text-2xl font-bold text-amber-700">{analise.resumo.total_aptas_com_alerta}</p></div>
              <div className="p-3 rounded-lg bg-rose-50"><p className="text-xs text-slate-500">Total com erro</p><p className="text-2xl font-bold text-rose-700">{analise.resumo.total_erros}</p></div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => exportarRelatorio(resultadoImportacao.relatorio, `relatorio-importacao-${analise.arquivo.nome}.json`)}>
                <Download className="w-4 h-4 mr-2" /> Baixar relatório
              </Button>
              <Button variant="outline" onClick={reiniciarFluxo}><RefreshCcw className="w-4 h-4 mr-2" /> Iniciar nova análise</Button>
            </div>
          </div>
        )}
      </div>

      <DetalheLinhaMigracao linha={linhaSelecionada} open={Boolean(linhaSelecionada)} onOpenChange={(open) => !open && setLinhaSelecionada(null)} />
    </div>
  );
}
