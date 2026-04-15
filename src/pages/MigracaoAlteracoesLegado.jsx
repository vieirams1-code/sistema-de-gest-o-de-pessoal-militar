import React, { useMemo, useState } from 'react';
import { Database, Download, RefreshCcw, ShieldAlert, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AccessDenied from '@/components/auth/AccessDenied';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import { useToast } from '@/components/ui/use-toast';
import { base44 } from '@/api/base44Client';
import UploadMigracaoAlteracoesLegado from '@/components/migracao-alteracoes-legado/UploadMigracaoAlteracoesLegado';
import ResumoMigracaoAlteracoesLegadoCards from '@/components/migracao-alteracoes-legado/ResumoMigracaoAlteracoesLegadoCards';
import TabelaPreviaMigracaoAlteracoesLegado from '@/components/migracao-alteracoes-legado/TabelaPreviaMigracaoAlteracoesLegado';
import {
  analisarArquivoMigracaoAlteracoesLegado,
  atualizarMilitarLinhaAnalise,
  atualizarTipoPublicacaoLinhaAnalise,
  atualizarDestinoLinhaAnalise,
  atualizarMotivoDestinoLinhaAnalise,
  exportarRelatorioMigracaoAlteracoesLegado,
  importarAnaliseAlteracoesLegado,
  salvarAnaliseHistoricoAlteracoesLegado,
} from '@/services/migracaoAlteracoesLegadoService';

const filtros = [
  { id: 'TODOS', label: 'Todos' },
  { id: 'APTO', label: 'Aptos' },
  { id: 'APTO_COM_ALERTA', label: 'Aptos com alerta' },
  { id: 'REVISAR', label: 'Revisar' },
  { id: 'IGNORADO', label: 'Ignorados' },
  { id: 'EXCLUIDO_DO_LOTE', label: 'Excluídos do lote' },
  { id: 'ERRO', label: 'Erros' },
];

function filtrarBusca(linha, termo) {
  if (!termo) return true;
  const alvo = [
    linha.transformado.militar_nome,
    linha.transformado.nome_completo_legado,
    linha.transformado.nome_guerra_legado,
    linha.transformado.matricula_legado,
    linha.transformado.materia_legado,
    linha.transformado.nota_id_legado,
    linha.transformado.numero_bg,
  ].join(' ').toLowerCase();
  return alvo.includes(termo.toLowerCase());
}

export default function MigracaoAlteracoesLegado() {
  const { isAdmin, isLoading, isAccessResolved } = useCurrentUser();
  const { toast } = useToast();

  const [arquivo, setArquivo] = useState(null);
  const [analise, setAnalise] = useState(null);
  const [historicoId, setHistoricoId] = useState(null);
  const [historicoDisponivel, setHistoricoDisponivel] = useState(true);
  const [carregando, setCarregando] = useState(false);
  const [filtro, setFiltro] = useState('TODOS');
  const [busca, setBusca] = useState('');
  const [avisoHistorico, setAvisoHistorico] = useState('');
  const [resultadoImportacao, setResultadoImportacao] = useState(null);
  const [militares, setMilitares] = useState([]);

  const linhasFiltradas = useMemo(() => {
    if (!analise) return [];
    return analise.linhas.filter((linha) => {
      const statusValido = filtro === 'TODOS' ? true : linha.status === filtro;
      return statusValido && filtrarBusca(linha, busca.trim());
    });
  }, [analise, filtro, busca]);

  const podeImportar = !!analise && !carregando;

  const handleAnalisar = async () => {
    if (!arquivo) {
      toast({ title: 'Arquivo obrigatório', description: 'Selecione um arquivo antes de iniciar a análise.', variant: 'destructive' });
      return;
    }
    try {
      setCarregando(true);
      setHistoricoId(null);
      setHistoricoDisponivel(true);
      setResultadoImportacao(null);
      setAvisoHistorico('');
      const [resultado, usuario, listaMilitares] = await Promise.all([
        analisarArquivoMigracaoAlteracoesLegado(arquivo),
        base44.auth.me(),
        base44.entities.Militar.list('-created_date', 10000),
      ]);
      setMilitares(listaMilitares);
      setAnalise(resultado);
      toast({ title: 'Análise concluída', description: 'Prévia da migração de alterações legado gerada com sucesso.' });

      try {
        const historico = await salvarAnaliseHistoricoAlteracoesLegado(resultado, usuario);
        setHistoricoId(historico?.id || null);
        setHistoricoDisponivel(Boolean(historico?.id));
        setAvisoHistorico('');
      } catch (historicoError) {
        setHistoricoId(null);
        setHistoricoDisponivel(false);
        setAvisoHistorico(historicoError?.message || 'Análise sem histórico: a entidade de histórico não está disponível no ambiente.');
      }
    } catch (error) {
      setAnalise(null);
      setHistoricoId(null);
      setHistoricoDisponivel(true);
      toast({
        title: 'Falha na análise',
        description: error?.message || 'Não foi possível analisar o arquivo.',
        variant: 'destructive',
      });
    } finally {
      setCarregando(false);
    }
  };

  const handleImportar = async (incluirAlertas, incluirPendentesClassificacao = false) => {
    if (!analise) {
      toast({ title: 'Análise obrigatória', description: 'Analise um arquivo antes de iniciar a importação.', variant: 'destructive' });
      return;
    }

    try {
      setCarregando(true);
      const usuario = await base44.auth.me();
      const resultado = await importarAnaliseAlteracoesLegado({
        analise,
        incluirAlertas,
        incluirPendentesClassificacao,
        historicoId: historicoId || null,
        usuario,
      });
      setResultadoImportacao(resultado);

      const avisoHistoricoIndisponivel = resultado.avisosHistorico?.find((aviso) => aviso.includes('entidade de histórico não está disponível'));
      if (avisoHistoricoIndisponivel) {
        setHistoricoDisponivel(false);
        setAvisoHistorico('Análise sem histórico: a entidade ImportacaoAlteracoesLegado não está disponível neste ambiente.');
        toast({ title: 'Importação finalizada', description: `Foram importadas ${resultado.totalImportadas} publicações legado.` });
      } else if (resultado.avisosHistorico?.length) {
        toast({
          title: 'Importação finalizada com aviso',
          description: resultado.avisosHistorico[0],
        });
      } else {
        toast({ title: 'Importação finalizada', description: `Foram importadas ${resultado.totalImportadas} publicações legado.` });
      }
    } catch (error) {
      toast({ title: 'Erro na importação', description: error?.message || 'Falha ao importar lote.', variant: 'destructive' });
    } finally {
      setCarregando(false);
    }
  };

  const handleAjusteMilitar = (linha, militar) => {
    if (!analise) return;
    const proxima = atualizarMilitarLinhaAnalise(analise, linha.linhaNumero, militar);
    setAnalise(proxima);
  };

  const handleAjusteTipoPublicacao = (linha, tipoPublicacao) => {
    if (!analise) return;
    const proxima = atualizarTipoPublicacaoLinhaAnalise(analise, linha.linhaNumero, tipoPublicacao);
    setAnalise(proxima);
  };


  const handleAjusteDestinoFinal = (linha, destinoFinal) => {
    if (!analise) return;
    const proxima = atualizarDestinoLinhaAnalise(analise, linha.linhaNumero, destinoFinal);
    setAnalise(proxima);
  };

  const handleAjusteMotivoDestino = (linha, motivoDestino) => {
    if (!analise) return;
    const proxima = atualizarMotivoDestinoLinhaAnalise(analise, linha.linhaNumero, motivoDestino);
    setAnalise(proxima);
  };

  const reiniciarFluxo = () => {
    setArquivo(null);
    setAnalise(null);
    setHistoricoId(null);
    setHistoricoDisponivel(true);
    setResultadoImportacao(null);
    setBusca('');
    setFiltro('TODOS');
  };

  if (isLoading || !isAccessResolved) return null;
  if (!isAdmin) return <AccessDenied modulo="Migração de Alterações Legado" />;

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6">
      <div className="max-w-[96rem] mx-auto space-y-6">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#1e3a5f]">Migração de Alterações Legado</h1>
            <p className="text-sm text-slate-500">Módulo administrativo para análise e importação de publicações históricas para PublicacaoExOfficio.</p>
          </div>
        </div>

        {!analise && !resultadoImportacao && (
          <>
            <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-4 text-sm">
              <p className="font-semibold mb-2 flex items-center gap-2"><ShieldAlert className="w-4 h-4" /> Regras desta migração</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Cada linha da planilha bruta do legado gera um registro individual em PublicacaoExOfficio.</li>
                <li>Registros válidos entram como publicados, com BG e data BG obrigatórios.</li>
                <li>A origem legado é marcada com <code>origem_registro=legado</code> e <code>importado_legado=true</code>.</li>
                <li>Nota ID legado é preservada em campo próprio, separado do número do BG.</li>
                <li>Sem correspondência segura de tipo, o padrão é <code>PENDENTE_CLASSIFICACAO</code> com <code>LEGADO_NAO_CLASSIFICADO</code>.</li>
                <li>Vínculo com militar e tipo final podem ser revisados manualmente antes da importação.</li>
              </ul>
            </div>
            <UploadMigracaoAlteracoesLegado file={arquivo} onFileChange={setArquivo} onAnalisar={handleAnalisar} loading={carregando} />
          </>
        )}

        {analise && !resultadoImportacao && (
          <div className="space-y-4">
            <ResumoMigracaoAlteracoesLegadoCards resumo={analise.resumo} />

            <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                {filtros.map((item) => (
                  <Button key={item.id} size="sm" variant={filtro === item.id ? 'default' : 'outline'} onClick={() => setFiltro(item.id)}>
                    {item.label}
                  </Button>
                ))}
              </div>
              <div className="relative md:max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  placeholder="Buscar por militar, matrícula, matéria, nota ou BG"
                  value={busca}
                  onChange={(event) => setBusca(event.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {!historicoDisponivel && (
              <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-4 text-sm">
                <p className="font-semibold">Análise sem histórico</p>
                <p>{avisoHistorico || 'A entidade ImportacaoAlteracoesLegado não está disponível neste ambiente. A análise e a importação continuam habilitadas no modo degradado.'}</p>
              </div>
            )}

            <TabelaPreviaMigracaoAlteracoesLegado
              linhas={linhasFiltradas}
              militares={militares}
              tiposPublicacaoValidos={analise.tipos_publicacao_validos || []}
              onSelecionarMilitar={handleAjusteMilitar}
              onSelecionarTipoPublicacao={handleAjusteTipoPublicacao}
              onSelecionarDestinoFinal={handleAjusteDestinoFinal}
              onAlterarMotivoDestino={handleAjusteMotivoDestino}
            />

            <div className="flex flex-wrap gap-2">
              <Button disabled={!podeImportar} className="bg-emerald-700 hover:bg-emerald-800" onClick={() => handleImportar(false)}>Importar linhas aptas</Button>
              <Button disabled={!podeImportar} className="bg-amber-600 hover:bg-amber-700" onClick={() => handleImportar(true, false)}>Importar aptas e aptas com alerta</Button>
              <Button disabled={!podeImportar} className="bg-indigo-600 hover:bg-indigo-700" onClick={() => handleImportar(true, true)}>Importar incluindo pendentes de classificação</Button>
              <Button variant="outline" onClick={() => exportarRelatorioMigracaoAlteracoesLegado({ ...analise, estado: 'Analise' }, `relatorio-analise-alteracoes-legado-${analise.arquivo.nome}.json`)}>
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
              <div className="p-3 rounded-lg bg-rose-50"><p className="text-xs text-slate-500">Total com erro</p><p className="text-2xl font-bold text-rose-700">{analise.resumo.total_erros}</p></div>
              <div className="p-3 rounded-lg bg-amber-50"><p className="text-xs text-slate-500">Total com alerta</p><p className="text-2xl font-bold text-amber-700">{analise.resumo.total_aptas_com_alerta}</p></div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => exportarRelatorioMigracaoAlteracoesLegado(resultadoImportacao.relatorio, `relatorio-importacao-alteracoes-legado-${analise.arquivo.nome}.json`)}>
                <Download className="w-4 h-4 mr-2" /> Baixar relatório
              </Button>
              <Button variant="outline" onClick={reiniciarFluxo}><RefreshCcw className="w-4 h-4 mr-2" /> Iniciar nova análise</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
