import React, { useEffect, useMemo, useState } from 'react';
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
  carregarAnaliseHistorico,
  corrigirLinhaPreImportacao,
  exportarRelatorio,
  importarAnalise,
  persistirCorrecaoPreImportacaoHistorico,
  salvarAnaliseHistorico,
} from '@/services/migracaoMilitaresService';

const filtros = [
  { id: 'TODOS', label: 'Todos' },
  { id: 'APTO', label: 'Aptos' },
  { id: 'APTO_COM_ALERTA', label: 'Aptos com alerta' },
  { id: 'DUPLICADO', label: 'Duplicados' },
  { id: 'ERRO', label: 'Erros' },
];

const ERRO_ENTIDADE_HISTORICO = 'Falha ao acessar o histórico de importação de militares. Verifique se a entidade ImportacaoMilitares está publicada no app.';
const STORAGE_KEY = 'migracao_militares_historico_id';

export default function MigracaoMilitares() {
  const { isLoading, isAccessResolved, canAccessModule, canAccessAction } = useCurrentUser();
  const { toast } = useToast();

  const [arquivo, setArquivo] = useState(null);
  const [analise, setAnalise] = useState(null);
  const [historicoId, setHistoricoId] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [filtro, setFiltro] = useState('TODOS');
  const [busca, setBusca] = useState('');
  const [linhaSelecionada, setLinhaSelecionada] = useState(null);
  const [resultadoImportacao, setResultadoImportacao] = useState(null);
  const [salvandoCorrecao, setSalvandoCorrecao] = useState(false);

  useEffect(() => {
    const restaurarDraft = async () => {
      const historicoSalvo = sessionStorage.getItem(STORAGE_KEY);
      if (!historicoSalvo || analise || resultadoImportacao) return;
      try {
        setCarregando(true);
        const relatorio = await carregarAnaliseHistorico(historicoSalvo);
        if (relatorio?.linhas?.length) {
          setAnalise(relatorio);
          setHistoricoId(historicoSalvo);
          toast({ title: 'Rascunho restaurado', description: 'Última análise da migração foi carregada do histórico.' });
        } else {
          sessionStorage.removeItem(STORAGE_KEY);
        }
      } catch (error) {
        console.warn('[MigracaoMilitares] Falha ao restaurar análise salva.', error);
      } finally {
        setCarregando(false);
      }
    };
    restaurarDraft();
  }, [analise, resultadoImportacao, toast]);

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
      if (historico?.id) sessionStorage.setItem(STORAGE_KEY, historico.id);

      toast({ title: 'Análise concluída', description: 'Prévia gerada com sucesso.' });
    } catch (error) {
      const mensagem = String(error?.message || '').includes('Entity schema ImportacaoMilitares not found in app')
        ? ERRO_ENTIDADE_HISTORICO
        : error?.message || 'Não foi possível analisar o arquivo.';
      toast({
        title: 'Falha na análise',
        description: mensagem,
        variant: 'destructive',
      });
    } finally {
      setCarregando(false);
    }
  };

  const handleImportar = async (incluirAlertas) => {
    if (!analise) return;
    try {
      setCarregando(true);
      const usuario = await base44.auth.me();
      const historicoIdAtual = historicoId || (await salvarAnaliseHistorico(analise, usuario))?.id;
      if (!historicoIdAtual) {
        throw new Error('Não foi possível criar o registro de histórico da importação.');
      }
      if (!historicoId) setHistoricoId(historicoIdAtual);
      sessionStorage.setItem(STORAGE_KEY, historicoIdAtual);
      const resultado = await importarAnalise({
        analise,
        incluirAlertas,
        historicoId: historicoIdAtual,
        usuario,
      });
      if (resultado?.historicoId && resultado.historicoId !== historicoId) {
        setHistoricoId(resultado.historicoId);
      }
      setResultadoImportacao(resultado);
      const avisoHistorico = Array.isArray(resultado?.avisosHistorico) && resultado.avisosHistorico.length > 0;
      toast({
        title: avisoHistorico ? 'Importação finalizada com alerta' : 'Importação finalizada',
        description: avisoHistorico
          ? `Foram importados ${resultado.totalImportadas} registros, porém houve problema ao sincronizar o histórico. Consulte o console/log para diagnóstico.`
          : `Foram importados ${resultado.totalImportadas} registros.`,
        variant: avisoHistorico ? 'destructive' : 'default',
      });
    } catch (error) {
      const mensagem = String(error?.message || '').includes('Entity schema ImportacaoMilitares not found in app')
        ? ERRO_ENTIDADE_HISTORICO
        : error?.message || 'Falha ao importar lote.';
      toast({ title: 'Erro na importação', description: mensagem, variant: 'destructive' });
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
    sessionStorage.removeItem(STORAGE_KEY);
  };

  const handleSalvarCorrecao = async (linhaNumero, camposEditados) => {
    if (!analise) return;
    try {
      setSalvandoCorrecao(true);
      const usuario = await base44.auth.me();
      const { analiseAtualizada, linhaAtualizada, alteracoes } = await corrigirLinhaPreImportacao({
        analise,
        linhaNumero,
        campos: camposEditados,
        usuario,
      });
      setAnalise(analiseAtualizada);
      setLinhaSelecionada(linhaAtualizada);
      let historicoIdAtual = historicoId;
      if (!historicoIdAtual) {
        const historicoCriado = await salvarAnaliseHistorico(analiseAtualizada, usuario);
        historicoIdAtual = historicoCriado?.id || null;
        if (historicoIdAtual) {
          setHistoricoId(historicoIdAtual);
          sessionStorage.setItem(STORAGE_KEY, historicoIdAtual);
        }
      }

      if (historicoIdAtual) {
        await persistirCorrecaoPreImportacaoHistorico({
          historicoId: historicoIdAtual,
          analise: analiseAtualizada,
          usuario,
          linhaNumero,
          alteracoes,
        });
      }
      const aptoParaImportacao = linhaAtualizada?.status === 'APTO' || linhaAtualizada?.status === 'APTO_COM_ALERTA';
      toast({
        title: 'Correção salva',
        description: aptoParaImportacao
          ? 'Correção salva. Registro agora está apto para importação.'
          : 'Correção salva, mas ainda há pendências.',
      });
    } catch (error) {
      toast({
        title: 'Falha ao salvar correção',
        description: error?.message || 'Não foi possível salvar as alterações da linha.',
        variant: 'destructive',
      });
    } finally {
      setSalvandoCorrecao(false);
    }
  };

  if (isLoading || !isAccessResolved) return null;
  if (!canAccessModule('migracao_militares') || !canAccessAction('importar_militares')) return <AccessDenied modulo="Migração de Militares" />;

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

      <DetalheLinhaMigracao
        linha={linhaSelecionada}
        open={Boolean(linhaSelecionada)}
        saving={salvandoCorrecao}
        onSalvarCorrecao={handleSalvarCorrecao}
        onOpenChange={(open) => !open && setLinhaSelecionada(null)}
      />
    </div>
  );
}
