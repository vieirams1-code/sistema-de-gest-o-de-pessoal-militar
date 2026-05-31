import React, { useMemo, useState } from 'react';
import { Database, Download, RefreshCcw, Search, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AccessDenied from '@/components/auth/AccessDenied';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import { useToast } from '@/components/ui/use-toast';
import { base44 } from '@/api/base44Client';
import UploadMigracaoAlteracoesLegado from '@/components/migracao-alteracoes-legado/UploadMigracaoAlteracoesLegado';
import ResumoMigracaoAlteracoesLegadoCards from '@/components/migracao-alteracoes-legado/ResumoMigracaoAlteracoesLegadoCards';
import TabelaPreviaMigracaoAlteracoesLegado from '@/components/migracao-alteracoes-legado/TabelaPreviaMigracaoAlteracoesLegado';
import SelecaoMilitarDestino from '@/components/migracao-alteracoes-legado/SelecaoMilitarDestino';
import {
  atualizarMilitarLinhaAnalise,
  atualizarTipoPublicacaoLinhaAnalise,
  atualizarDestinoLinhaAnalise,
  atualizarMotivoDestinoLinhaAnalise,
  exportarModeloMigracaoAlteracoesLegado,
  exportarRelatorioMigracaoAlteracoesLegado,
  importarAnaliseAlteracoesLegado,
} from '@/services/migracaoAlteracoesLegadoService';
import {
  analisarArquivoMigracaoAlteracoesLegadoSimplificado,
  STATUS_LINHA_SIMPLIFICADO,
} from '@/services/migracaoAlteracoesLegadoSimplificadoService';

const filtros = [
  { id: 'TODOS', label: 'Todos' },
  { id: 'APTO', label: 'Prontas' },
  { id: 'ERRO', label: 'Erros' },
  { id: 'REVISAR', label: 'Duplicadas' },
];

const filtrosDestino = [
  { id: 'TODOS', label: 'Todos os destinos' },
  { id: 'IMPORTAR', label: 'IMPORTAR' },
  { id: 'PENDENTE_CLASSIFICACAO', label: 'PENDENTE_CLASSIFICACAO' },
  { id: 'IGNORAR', label: 'IGNORAR' },
  { id: 'EXCLUIDO_DO_LOTE', label: 'EXCLUIDO_DO_LOTE' },
];

function filtrarBusca(linha, termo) {
  if (!termo) return true;
  const t = linha.transformado || {};
  const alvo = [
    t.militar_nome,
    t.nota_id_legado,
    t.numero_bg,
    t.materia_legado,
    t.conteudo_trecho_legado,
  ].join(' ').toLowerCase();
  return alvo.includes(termo.toLowerCase());
}

/**
 * Lote 2 — mapeia o retorno da análise simplificada para o shape que a
 * TabelaPreviaMigracaoAlteracoesLegado já entende (sem alterar a tabela).
 *
 * Mapeamento de status simplificado -> status atual da tabela:
 *  - 'pronta'    -> APTO
 *  - 'erro'      -> ERRO
 *  - 'duplicada' -> REVISAR (linha visivelmente bloqueada via revisões)
 */
function adaptarAnaliseSimplificadaParaTabela(analiseSimples, militarDestinoSnapshot) {
  const snapshot = analiseSimples.militarDestino || {};
  const militarNome = snapshot.nome_completo || militarDestinoSnapshot?.nome_completo || militarDestinoSnapshot?.militar_nome || '';
  const militarMatricula = snapshot.matricula
    || militarDestinoSnapshot?.militar_matricula_atual
    || militarDestinoSnapshot?.matricula
    || militarDestinoSnapshot?.militar_matricula
    || '';

  const mapStatus = {
    [STATUS_LINHA_SIMPLIFICADO.PRONTA]: 'APTO',
    [STATUS_LINHA_SIMPLIFICADO.ERRO]: 'ERRO',
    [STATUS_LINHA_SIMPLIFICADO.DUPLICADA]: 'REVISAR',
  };

  const linhas = analiseSimples.linhas.map((linha) => ({
    linhaNumero: linha.rowIndex,
    status: mapStatus[linha.status] || 'ERRO',
    statusSimplificado: linha.status,
    original: {},
    transformado: {
      militar_id: snapshot.id || '',
      militar_nome: militarNome,
      militar_matricula: militarMatricula,
      militar_matricula_atual: militarMatricula,
      nota_id_legado: linha.numero_nota,
      numero_bg: linha.numero_bg_br,
      data_bg_br: linha.data_bg_br,
      materia_legado: linha.tipo_legado,
      tipo_publicacao_sugerido: linha.tipo_classificado,
      tipo_publicacao_confirmado: linha.tipo_classificado,
      conteudo_trecho_legado: linha.texto_publicado,
      destino_final: linha.status === STATUS_LINHA_SIMPLIFICADO.PRONTA ? 'IMPORTAR' : 'PENDENTE_CLASSIFICACAO',
      motivo_destino: linha.erros[0] || linha.avisos[0] || '',
    },
    erros: linha.erros,
    alertas: linha.avisos,
    revisoes: linha.status === STATUS_LINHA_SIMPLIFICADO.DUPLICADA ? ['Suspeita de duplicidade detectada na análise simplificada.'] : [],
    observacoes: [],
    ajustes_manuais: [],
    recusada: linha.recusada,
  }));

  const resumo = {
    total_linhas: analiseSimples.resumo.total_linhas,
    total_aptas: analiseSimples.resumo.total_prontas,
    total_aptas_com_alerta: 0,
    total_revisar: analiseSimples.resumo.total_duplicadas,
    total_ignoradas: 0,
    total_erros: analiseSimples.resumo.total_erros,
    total_excluidas_lote: 0,
    total_pendentes_classificacao: 0,
    total_alertas: analiseSimples.resumo.total_com_avisos,
    total_duplicidades: analiseSimples.resumo.total_duplicadas,
  };

  return {
    arquivo: { ...analiseSimples.arquivo, hash: '', hash_lote: '' },
    lote_ja_processado: false,
    lote_original_id: null,
    versao_regra_migracao: analiseSimples.versao_regra,
    tipo_publicacao_neutro: 'LEGADO_NAO_CLASSIFICADO',
    tipos_publicacao_validos: [],
    linhas,
    resumo,
    fluxo_simplificado: true,
  };
}

export default function MigracaoAlteracoesLegado() {
  const { isLoading, isAccessResolved, canAccessModule, canAccessAction } = useCurrentUser();
  const { toast } = useToast();

  const [arquivo, setArquivo] = useState(null);
  const [analise, setAnalise] = useState(null);
  const [historicoId, setHistoricoId] = useState(null);
  const [historicoDisponivel, setHistoricoDisponivel] = useState(true);
  const [carregando, setCarregando] = useState(false);
  const [filtro, setFiltro] = useState('TODOS');
  const [filtroDestino, setFiltroDestino] = useState('TODOS');
  const [busca, setBusca] = useState('');
  const [avisoHistorico, setAvisoHistorico] = useState('');
  const [resultadoImportacao, setResultadoImportacao] = useState(null);
  const [militares, setMilitares] = useState([]);
  // Lote 1 — novo fluxo simplificado: militar de destino selecionado antes do upload.
  // Armazenamos o id (string) e um snapshot mínimo retornado pelo MilitarSelector
  // (nome, posto, matrícula e — quando disponível — lotação).
  const [militarDestinoId, setMilitarDestinoId] = useState('');
  const [militarDestinoSnapshot, setMilitarDestinoSnapshot] = useState(null);

  const linhasFiltradas = useMemo(() => {
    if (!analise) return [];
    return analise.linhas.filter((linha) => {
      const statusValido = filtro === 'TODOS' ? true : linha.status === filtro;
      const destinoLinha = linha.transformado?.destino_final || 'IMPORTAR';
      const destinoValido = filtroDestino === 'TODOS' ? true : destinoLinha === filtroDestino;
      return statusValido && destinoValido && filtrarBusca(linha, busca.trim());
    });
  }, [analise, filtro, filtroDestino, busca]);

  const podeImportar = !!analise && !carregando;

  const handleAnalisar = async () => {
    if (!militarDestinoId) {
      toast({ title: 'Selecione um militar', description: 'Escolha o militar destino antes de analisar a planilha.', variant: 'destructive' });
      return;
    }
    if (!arquivo) {
      toast({ title: 'Arquivo obrigatório', description: 'Selecione um arquivo antes de iniciar a análise.', variant: 'destructive' });
      return;
    }
    try {
      setCarregando(true);
      setHistoricoId(null);
      setHistoricoDisponivel(false);
      setResultadoImportacao(null);
      setAvisoHistorico('Lote 2: análise simplificada não grava histórico. A persistência será reintroduzida em lote posterior.');

      // Lote 2 — Análise simplificada pelo militar destino selecionado.
      const analiseSimples = await analisarArquivoMigracaoAlteracoesLegadoSimplificado(arquivo, {
        militarDestinoId,
        militarDestinoSnapshot,
      });
      const analiseAdaptada = adaptarAnaliseSimplificadaParaTabela(analiseSimples, militarDestinoSnapshot);

      const militarDestinoParaLista = militarDestinoSnapshot
        ? { id: militarDestinoId, ...militarDestinoSnapshot }
        : { id: militarDestinoId };
      setMilitares([militarDestinoParaLista]);
      setAnalise(analiseAdaptada);

      const r = analiseSimples.resumo;
      toast({
        title: 'Análise concluída',
        description: `Prontas: ${r.total_prontas} · Erros: ${r.total_erros} · Duplicadas: ${r.total_duplicadas}`,
      });
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
      const totalJaImportadas = resultado?.totalJaImportadas || 0;

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
        toast({
          title: 'Importação finalizada',
          description: totalJaImportadas > 0
            ? `Importadas ${resultado.totalImportadas}; ${totalJaImportadas} já existiam e foram reaproveitadas.`
            : `Foram importadas ${resultado.totalImportadas} publicações legado.`,
        });
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
    setFiltroDestino('TODOS');
    setMilitarDestinoId('');
    setMilitarDestinoSnapshot(null);
  };

  const handleSelecionarMilitarDestino = (novoId) => {
    setMilitarDestinoId(novoId || '');
    if (!novoId) {
      setMilitarDestinoSnapshot(null);
      // Limpa o arquivo escolhido para evitar inconsistência visual quando o
      // usuário troca/limpa o militar antes de analisar a planilha.
      setArquivo(null);
    }
  };

  const handleMilitarDestinoSelect = (snapshot) => {
    setMilitarDestinoSnapshot(snapshot || null);
  };

  if (isLoading || !isAccessResolved) return null;
  if (!canAccessModule('migracao_alteracoes_legado') || !canAccessAction('migrar_alteracoes_legado')) return <AccessDenied modulo="Migração de Alterações Legado" />;

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6">
      <div className="max-w-[96rem] mx-auto space-y-6">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#1e3a5f]">Migração de Alterações Legado</h1>
            <p className="text-sm text-slate-500">Tela administrativa para revisar, classificar e importar alterações legadas no padrão do SGP Militar.</p>
          </div>
        </div>

        {!analise && !resultadoImportacao && (
          <>
            <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-4 text-sm">
              <p className="font-semibold mb-2 flex items-center gap-2"><ShieldAlert className="w-4 h-4" /> Regras desta migração</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>A importação é feita por militar selecionado: todas as linhas da planilha serão vinculadas a esse militar.</li>
                <li>Cada linha da planilha gera um registro individual em PublicacaoExOfficio.</li>
                <li>Registros válidos entram como publicados, com BG e data BG obrigatórios.</li>
                <li>A origem legado é marcada com <code>origem_registro=legado</code> e <code>importado_legado=true</code>.</li>
                <li>Nota ID legado é preservada em campo próprio, separado do número do BG.</li>
                <li>O sistema não tenta mais identificar o militar pela planilha.</li>
              </ul>
            </div>

            <SelecaoMilitarDestino
              militarId={militarDestinoId}
              militarSnapshot={militarDestinoSnapshot}
              onChangeMilitarId={handleSelecionarMilitarDestino}
              onMilitarSelect={handleMilitarDestinoSelect}
              disabled={carregando}
            />

            {militarDestinoId ? (
              <UploadMigracaoAlteracoesLegado file={arquivo} onFileChange={setArquivo} onAnalisar={handleAnalisar} onDownloadModelo={exportarModeloMigracaoAlteracoesLegado} loading={carregando} />
            ) : (
              <div className="bg-white border border-dashed border-slate-300 rounded-xl p-6 text-center text-sm text-slate-500">
                Selecione um militar para habilitar o envio da planilha.
              </div>
            )}
          </>
        )}

        {analise && !resultadoImportacao && (
          <div className="space-y-4">
            <ResumoMigracaoAlteracoesLegadoCards resumo={analise.resumo} />

            <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 lg:grid-cols-[1.3fr,220px,240px,auto] gap-3 items-end">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  placeholder="Buscar por militar, matrícula, matéria, nota ou BG"
                  value={busca}
                  onChange={(event) => setBusca(event.target.value)}
                  className="pl-9"
                />
              </div>

              <div>
                <p className="text-xs text-slate-500 mb-1">Status</p>
                <Select value={filtro} onValueChange={setFiltro}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filtrar status" />
                  </SelectTrigger>
                  <SelectContent>
                    {filtros.map((item) => (
                      <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <p className="text-xs text-slate-500 mb-1">Destino final</p>
                <Select value={filtroDestino} onValueChange={setFiltroDestino}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filtrar destino" />
                  </SelectTrigger>
                  <SelectContent>
                    {filtrosDestino.map((item) => (
                      <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button variant="outline" onClick={() => setAnalise((valorAtual) => ({ ...valorAtual }))}>
                <RefreshCcw className="w-4 h-4 mr-2" /> Atualizar
              </Button>
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
              somenteLeitura={analise.fluxo_simplificado === true}
            />

            <div className="flex flex-wrap gap-2">
              {!analise.fluxo_simplificado && (
                <>
                  <Button disabled={!podeImportar} className="bg-emerald-700 hover:bg-emerald-800" onClick={() => handleImportar(false)}>Importar linhas aptas</Button>
                  <Button disabled={!podeImportar} className="bg-amber-600 hover:bg-amber-700" onClick={() => handleImportar(true, false)}>Importar aptas e aptas com alerta</Button>
                  <Button disabled={!podeImportar} className="bg-indigo-600 hover:bg-indigo-700" onClick={() => handleImportar(true, true)}>Importar incluindo pendentes de classificação</Button>
                </>
              )}
              {analise.fluxo_simplificado && (
                <div className="w-full rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-900 px-3 py-2 text-xs">
                  Lote 2: apenas análise. Edição inline, recusa e importação serão habilitadas nos próximos lotes.
                </div>
              )}
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