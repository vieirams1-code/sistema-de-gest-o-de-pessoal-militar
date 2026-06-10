import React, { useEffect, useMemo, useState } from 'react';
import { Database, Download, RefreshCcw, Search, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AccessDenied from '@/components/auth/AccessDenied';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import { useToast } from '@/components/ui/use-toast';
import { base44 } from '@/api/base44Client';
import { getTiposRPFiltrados } from '@/components/rp/rpTiposConfig';
import UploadMigracaoAlteracoesLegado from '@/components/migracao-alteracoes-legado/UploadMigracaoAlteracoesLegado';
import ResumoMigracaoAlteracoesLegadoCards from '@/components/migracao-alteracoes-legado/ResumoMigracaoAlteracoesLegadoCards';
import ResumoImpactoMigracaoSimplificada from '@/components/migracao-alteracoes-legado/ResumoImpactoMigracaoSimplificada';
import TabelaPreviaMigracaoAlteracoesLegado from '@/components/migracao-alteracoes-legado/TabelaPreviaMigracaoAlteracoesLegado';
import TabelaRevisaoSimplificadaAlteracoesLegado from '@/components/migracao-alteracoes-legado/TabelaRevisaoSimplificadaAlteracoesLegado';
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
import {
  atualizarLinhaRevisaoSimplificada,
  gerarResumoRevisaoSimplificada,
  montarPayloadPublicacaoExOfficioMigracaoLegado,
  normalizarNumeroNota,
  revalidarLinhasRevisaoSimplificada,
} from '@/services/migracaoAlteracoesLegadoSimplificadoEdicao';
import { criarEscopado } from '@/services/cudEscopadoClient';
import {
  listarClassificacoesHistoricasAlteracoes,
  salvarClassificacaoHistoricaAlteracao,
} from '@/services/classificacoesHistoricasAlteracoesService';

const filtros = [
  { id: 'TODOS', label: 'Todos' },
  { id: 'APTO', label: 'Prontas' },
  { id: 'ERRO', label: 'Erros' },
  { id: 'REVISAR', label: 'Duplicadas' },
];

const filtrosSimplificados = [
  { id: 'TODOS', label: 'Todos' },
  { id: 'pronta', label: 'Prontas' },
  { id: 'pendente_confirmacao', label: 'Pendentes Confirmação' },
  { id: 'erro', label: 'Erros' },
  { id: 'duplicada', label: 'Duplicadas' },
  { id: 'recusada', label: 'Recusadas' },
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
    linha.numero_nota,
    linha.numero_bg_br,
    linha.tipo_legado,
    linha.tipo_classificado,
    linha.texto_publicado,
  ].join(' ').toLowerCase();
  return alvo.includes(termo.toLowerCase());
}

/**
 * Mapeia o retorno da análise simplificada para o shape compartilhado pela
 * página e preserva os campos próprios da tabela editável do lote 3.
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

  const numerosNotaImportados = analiseSimples.numerosNotaJaExistentes || [];
  const linhas = revalidarLinhasRevisaoSimplificada(analiseSimples.linhas.map((linha) => ({
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
      classificacao_original_legado: linha.classificacao_original_legado !== undefined ? String(linha.classificacao_original_legado) : linha.tipo_legado,
      classificacao_historica_id: linha.classificacao_historica_id || '',
      classificacao_historica_nome: linha.classificacao_historica_nome || '',
      tipo_publicacao_sugerido: linha.tipo_classificado,
      tipo_publicacao_confirmado: linha.tipo_classificado,
      conteudo_trecho_legado: linha.texto_publicado,
      status_publicacao: linha.status_publicacao,
      tipo_bg_legado: linha.tipo_bg_legado,
      destino_final: linha.status === STATUS_LINHA_SIMPLIFICADO.PRONTA ? 'IMPORTAR' : 'PENDENTE_CLASSIFICACAO',
      motivo_destino: linha.erros[0] || linha.avisos[0] || '',
    },
    erros: linha.erros,
    alertas: linha.avisos,
    revisoes: linha.status === STATUS_LINHA_SIMPLIFICADO.DUPLICADA ? ['Suspeita de duplicidade detectada na análise simplificada.'] : [],
    observacoes: [],
    ajustes_manuais: [],
    recusada: linha.recusada,
    classificacao_confirmada: false,
    numero_nota: linha.numero_nota,
    numero_bg_br: linha.numero_bg_br,
    data_bg_br: linha.data_bg_br,
    tipo_legado: linha.tipo_legado,
    classificacao_original_legado: linha.classificacao_original_legado !== undefined ? String(linha.classificacao_original_legado) : linha.tipo_legado,
    classificacao_historica_id: linha.classificacao_historica_id || '',
    classificacao_historica_nome: linha.classificacao_historica_nome || '',
    tipo_classificado: linha.tipo_classificado,
    tipo_bg_legado: linha.tipo_bg_legado,
    texto_publicado: linha.texto_publicado,
    status_publicacao: linha.status_publicacao,
    numerosNotaImportados,
  })));

  const resumo = gerarResumoRevisaoSimplificada(linhas);

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
  const [classificacoesHistoricas, setClassificacoesHistoricas] = useState([]);
  const [carregandoClassificacoes, setCarregandoClassificacoes] = useState(false);

  const carregarClassificacoesHistoricas = async () => {
    setCarregandoClassificacoes(true);
    try {
      const registros = await listarClassificacoesHistoricasAlteracoes();
      setClassificacoesHistoricas((registros || []).filter((item) => item?.ativo !== false && item?.uso_migracao !== false));
    } catch (error) {
      toast({
        title: 'Falha ao carregar classificações históricas',
        description: error?.message || 'Não foi possível listar o catálogo de classificações históricas.',
        variant: 'destructive',
      });
    } finally {
      setCarregandoClassificacoes(false);
    }
  };

  useEffect(() => {
    carregarClassificacoesHistoricas();
  }, []);

  const linhasFiltradas = useMemo(() => {
    if (!analise) return [];
    return analise.linhas.filter((linha) => {
      const statusValido = filtro === 'TODOS' ? true : linha.status === filtro;
      const destinoLinha = linha.transformado?.destino_final || 'IMPORTAR';
      const destinoValido = analise.fluxo_simplificado || filtroDestino === 'TODOS' || destinoLinha === filtroDestino;
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
      setAvisoHistorico('Lote 3: revisão simplificada não grava histórico. A persistência será reintroduzida em lote posterior.');

      // Lote 2 — Análise simplificada pelo militar destino selecionado.
      const [analiseSimples, tiposPublicacaoCustom] = await Promise.all([
        analisarArquivoMigracaoAlteracoesLegadoSimplificado(arquivo, {
          militarDestinoId,
          militarDestinoSnapshot,
        }),
        base44.entities.TipoPublicacaoCustom.list('-created_date').catch(() => []),
      ]);
      const analiseAdaptada = adaptarAnaliseSimplificadaParaTabela(analiseSimples, militarDestinoSnapshot);
      analiseAdaptada.tipos_publicacao_validos = Array.from(new Set(
        getTiposRPFiltrados({ tiposCustom: tiposPublicacaoCustom })
          .map((tipo) => tipo?.label || tipo?.value)
          .filter(Boolean),
      )).sort((a, b) => a.localeCompare(b, 'pt-BR'));

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

  const handleImportarSimplificado = async () => {
    if (!analise?.fluxo_simplificado) return;

    setCarregando(true);
    const linhasParaImportar = analise.linhas.filter((l) => l.statusSimplificado === 'pronta' && !l.recusada);

    if (linhasParaImportar.length === 0) {
      toast({ title: 'Aviso', description: 'Nenhuma alteração pronta para importação.', variant: 'destructive' });
      setCarregando(false);
      return;
    }

    const falhas = [];
    let importadas = 0;

    const militarId = linhasParaImportar[0].transformado.militar_id;
    let notasExistentes = new Set();
    try {
      const existingPubs = await base44.entities.PublicacaoExOfficio.filter({ militar_id: militarId }, 'nota_id_legado');
      notasExistentes = new Set(existingPubs.map((p) => normalizarNumeroNota(p.nota_id_legado)).filter(Boolean));
    } catch (e) {
      console.warn("Falha ao buscar publicações existentes", e);
    }

    for (const linha of linhasParaImportar) {
      try {
        const notaNormalizada = normalizarNumeroNota(linha.numero_nota);
        if (notaNormalizada && notasExistentes.has(notaNormalizada)) {
          throw new Error('Nota já importada para este militar.');
        }

        const payload = montarPayloadPublicacaoExOfficioMigracaoLegado(linha);

        await criarEscopado('PublicacaoExOfficio', payload);
        importadas++;
        if (notaNormalizada) notasExistentes.add(notaNormalizada);
      } catch (error) {
        falhas.push({
          linhaNumero: linha.linhaNumero,
          erro: error.message || 'Erro desconhecido ao gravar.',
        });
      }
    }

    setCarregando(false);

    if (falhas.length > 0) {
      toast({
        title: 'Importação parcial',
        description: `Foram importadas ${importadas} alterações. Ocorreram ${falhas.length} falhas.`,
        variant: 'destructive',
      });
      setAnalise((prev) => {
        const novasLinhas = prev.linhas.map((l) => {
          const falha = falhas.find((f) => f.linhaNumero === l.linhaNumero);
          if (falha) {
            return { ...l, statusSimplificado: 'erro', status: 'ERRO', erros: [falha.erro] };
          }
          if (l.statusSimplificado === 'pronta' && !l.recusada) {
            return null;
          }
          return l;
        }).filter(Boolean);

        return { ...prev, linhas: novasLinhas, resumo: gerarResumoRevisaoSimplificada(novasLinhas) };
      });
    } else {
      toast({
        title: 'Importação concluída',
        description: `Todas as ${importadas} alterações válidas foram importadas com sucesso.`,
      });
      setResultadoImportacao({
        statusImportacao: 'Sucesso',
        totalImportadas: importadas,
        totalNaoImportadas: analise.linhas.length - linhasParaImportar.length,
        relatorio: { ...analise, estado: 'Importado' },
      });
    }
  };

  const handleAjusteMilitar = (linha, militar) => {
    if (!analise) return;
    const proxima = atualizarMilitarLinhaAnalise(analise, linha.linhaNumero, militar);
    setAnalise(proxima);
  };

  const handleCriarClassificacaoHistorica = async (form) => {
    const criada = await salvarClassificacaoHistoricaAlteracao(null, {
      ...form,
      uso_migracao: true,
      legado: true,
      ativo: true,
    });
    await carregarClassificacoesHistoricas();
    return criada;
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

  const handleAlterarLinhaSimplificada = (linha, alteracoes) => {
    setAnalise((atual) => {
      if (!atual?.fluxo_simplificado) return atual;
      const linhas = atualizarLinhaRevisaoSimplificada(atual.linhas, linha.linhaNumero, alteracoes);
      return { ...atual, linhas, resumo: gerarResumoRevisaoSimplificada(linhas) };
    });
  };

  const handleAlternarRecusaSimplificada = (linha) => {
    handleAlterarLinhaSimplificada(linha, { recusada: !linha.recusada });
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
                <li>Registros sem BG/Data BG entram como 'Aguardando Publicação' se possuírem nota.</li>
                <li>Informe número e data do BG apenas quando a publicação estiver disponível.</li>
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
            {analise.fluxo_simplificado ? (
              <div className="space-y-4">
                <ResumoImpactoMigracaoSimplificada linhas={analise.linhas} />
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                  <div className="bg-white border border-slate-200 rounded-xl p-3 text-center">
                    <p className="text-xs text-slate-500">Total</p>
                    <p className="text-lg font-bold text-slate-700">{analise.linhas.length}</p>
                  </div>
                  <div className="bg-white border border-emerald-200 rounded-xl p-3 text-center">
                    <p className="text-xs text-slate-500">Prontas</p>
                    <p className="text-lg font-bold text-emerald-700">{analise.linhas.filter(l => l.statusSimplificado === 'pronta' && !l.recusada).length}</p>
                  </div>
                  <div className="bg-white border border-indigo-200 rounded-xl p-3 text-center">
                    <p className="text-xs text-slate-500">Publicadas</p>
                    <p className="text-lg font-bold text-indigo-700">{analise.linhas.filter(l => l.status_publicacao === 'PUBLICADO' && !l.recusada).length}</p>
                  </div>
                  <div className="bg-white border border-sky-200 rounded-xl p-3 text-center">
                    <p className="text-xs text-slate-500">Aguardando pub.</p>
                    <p className="text-lg font-bold text-sky-700">{analise.linhas.filter(l => l.status_publicacao === 'AGUARDANDO_PUBLICACAO' && !l.recusada).length}</p>
                  </div>
                  <div className="bg-white border border-amber-200 rounded-xl p-3 text-center">
                    <p className="text-xs text-slate-500">Duplicadas</p>
                    <p className="text-lg font-bold text-amber-700">{analise.linhas.filter(l => l.statusSimplificado === 'duplicada' && !l.recusada).length}</p>
                  </div>
                  <div className="bg-white border border-rose-200 rounded-xl p-3 text-center">
                    <p className="text-xs text-slate-500">Erros</p>
                    <p className="text-lg font-bold text-rose-700">{analise.linhas.filter(l => l.statusSimplificado === 'erro' && !l.recusada).length}</p>
                  </div>
                  <div className="bg-white border border-slate-300 rounded-xl p-3 text-center opacity-70">
                    <p className="text-xs text-slate-500">Recusadas</p>
                    <p className="text-lg font-bold text-slate-600">{analise.linhas.filter(l => l.recusada).length}</p>
                  </div>
                </div>
              </div>
            ) : (
              <ResumoMigracaoAlteracoesLegadoCards resumo={analise.resumo} />
            )}

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
                    {(analise.fluxo_simplificado ? filtrosSimplificados : filtros).map((item) => (
                      <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!analise.fluxo_simplificado && (
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
              )}

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

            {analise.fluxo_simplificado ? (
              <TabelaRevisaoSimplificadaAlteracoesLegado
                linhas={linhasFiltradas}
                tiposPublicacaoValidos={analise.tipos_publicacao_validos || []}
                classificacoesHistoricas={classificacoesHistoricas}
                carregandoClassificacoesHistoricas={carregandoClassificacoes}
                onCriarClassificacaoHistorica={handleCriarClassificacaoHistorica}
                onAlterarLinha={handleAlterarLinhaSimplificada}
                onAlternarRecusa={handleAlternarRecusaSimplificada}
              />
            ) : (
              <TabelaPreviaMigracaoAlteracoesLegado
                linhas={linhasFiltradas}
                militares={militares}
                tiposPublicacaoValidos={analise.tipos_publicacao_validos || []}
                onSelecionarMilitar={handleAjusteMilitar}
                onSelecionarTipoPublicacao={handleAjusteTipoPublicacao}
                onSelecionarDestinoFinal={handleAjusteDestinoFinal}
                onAlterarMotivoDestino={handleAjusteMotivoDestino}
              />
            )}

            <div className="flex flex-wrap gap-2">
              {!analise.fluxo_simplificado && (
                <>
                  <Button disabled={!podeImportar} className="bg-emerald-700 hover:bg-emerald-800" onClick={() => handleImportar(false)}>Importar linhas aptas</Button>
                  <Button disabled={!podeImportar} className="bg-amber-600 hover:bg-amber-700" onClick={() => handleImportar(true, false)}>Importar aptas e aptas com alerta</Button>
                  <Button disabled={!podeImportar} className="bg-indigo-600 hover:bg-indigo-700" onClick={() => handleImportar(true, true)}>Importar incluindo pendentes de classificação</Button>
                </>
              )}
              {analise.fluxo_simplificado && (
                <>
                  <Button disabled={!podeImportar || carregando} className="bg-emerald-700 hover:bg-emerald-800" onClick={handleImportarSimplificado}>
                    Finalizar importação
                  </Button>
                  <div className="w-full rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-900 px-3 py-2 text-xs flex items-center">
                    Lote 4: Importação efetiva das alterações. Apenas linhas prontas e não recusadas serão gravadas.
                  </div>
                </>
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
