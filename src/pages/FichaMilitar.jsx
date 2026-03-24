import React, { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, User, Filter, ClipboardList, Shield, Award, Calendar, BookOpen, FileText, Activity, Search, ChevronDown, ChevronUp, Trash2, PenLine, Ban, AlertTriangle, Star
} from 'lucide-react';
import { createPageUrl } from '@/utils';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import { format } from 'date-fns';
import { montarCadeia, identificarDescendentes, executarExclusaoAdminCadeia } from '@/components/ferias/feriasAdminUtils';
import { reverterAtestadosPorExclusaoPublicacao } from '@/components/atestado/atestadoPublicacaoHelpers';
import { excluirAtestadoComReflexoNoQuadro } from '@/components/quadro/quadroHelpers';
import { calcularComportamento, calcularProximaMelhoria } from '@/utils/calcularComportamento';

const TIPOS = [
  { value: 'todos', label: 'Todos os Registros' },
  { value: 'elogios_punicoes', label: 'Extrato de Elogios e Punições' },
  { value: 'punicao', label: 'Punições' },
  { value: 'atestado', label: 'Atestados Médicos' },
  { value: 'ferias', label: 'Férias' },
  { value: 'livro', label: 'Registros do Livro' },
  { value: 'publicacao', label: 'Publicações Ex Officio' },
  { value: 'medalha', label: 'Medalhas' },
  { value: 'comportamento', label: 'Histórico de Comportamento' },
];

const tipoConfig = {
  punicao: { label: 'Punição', color: 'bg-red-100 text-red-700', icon: Shield },
  atestado: { label: 'Atestado Médico', color: 'bg-blue-100 text-blue-700', icon: FileText },
  ferias: { label: 'Férias', color: 'bg-green-100 text-green-700', icon: Calendar },
  livro: { label: 'Registro do Livro', color: 'bg-purple-100 text-purple-700', icon: BookOpen },
  publicacao: { label: 'Publicação Ex Officio', color: 'bg-amber-100 text-amber-700', icon: ClipboardList },
  medalha: { label: 'Medalha', color: 'bg-yellow-100 text-yellow-700', icon: Award },
  comportamento: { label: 'Comportamento', color: 'bg-slate-100 text-slate-700', icon: Activity },
};

function getTipoDisplay(tipo) {
  if (tipo === 'Saída Férias') return 'Início';
  if (tipo === 'Interrupção de Férias') return 'Interrupção';
  if (tipo === 'Nova Saída / Retomada') return 'Continuação';
  if (tipo === 'Retorno Férias') return 'Término';
  return tipo;
}

function formatDate(d) {
  if (!d) return '—';
  try { return format(new Date(`${d}T00:00:00`), 'dd/MM/yyyy'); } catch { return d; }
}

function calcStatusPublicacao(registro) {
  if (registro?.numero_bg && registro?.data_bg) return 'Publicado';
  if (registro?.nota_para_bg) return 'Aguardando Publicação';
  return 'Aguardando Nota';
}

function isOperacaoFeriasLivro(registro) {
  return [
    'Saída Férias',
    'Interrupção de Férias',
    'Nova Saída / Retomada',
    'Retorno Férias',
  ].includes(registro?.tipo_registro);
}

function isFeriasPublicacaoExOfficio(registro) {
  return [
    'Saída Férias',
    'Interrupção de Férias',
    'Nova Saída / Retomada',
    'Retorno Férias',
  ].includes(registro?.tipo);
}

function EventCard({ event, onDelete }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const cfg = tipoConfig[event.tipo] || tipoConfig.publicacao;
  const Icon = cfg.icon;

  const isPublicacao = event.tipo === 'publicacao';
  const statusPublicacao = event.raw?.status || '';
  const isPublicada = isPublicacao && (statusPublicacao === 'Publicado' || (event.raw?.numero_bg && event.raw?.data_bg));
  const foiTornadaSemEfeito = isPublicacao && !!event.raw?.tornada_sem_efeito_por_id;
  const podeApostilarOuTSE = isPublicada && !foiTornadaSemEfeito;
  const podeExcluir = !isPublicada;

  const statusColors = {
    'Aguardando Nota': 'bg-amber-100 text-amber-700',
    'Aguardando Publicação': 'bg-blue-100 text-blue-700',
    'Publicado': 'bg-emerald-100 text-emerald-700',
  };

  const statusDisplay = isPublicacao
    ? (event.raw?.numero_bg && event.raw?.data_bg ? 'Publicado'
      : event.raw?.nota_para_bg ? 'Aguardando Publicação'
      : 'Aguardando Nota')
    : null;

  const tipoLabelBruto = event.subtipo || event.titulo || '';
  const tipoLabel = getTipoDisplay(tipoLabelBruto);

  return (
    <div className={`bg-white rounded-xl border shadow-sm overflow-hidden ${foiTornadaSemEfeito ? 'border-red-300 opacity-70' : isPublicada ? 'border-emerald-200' : 'border-slate-200'}`}>
      <div
        className="flex items-start gap-4 p-4 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.color}`}>
          <Icon className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge className={cfg.color + ' text-xs'}>{cfg.label}</Badge>
            {event.subtipo && <span className="text-xs text-slate-500 font-medium">{tipoLabel}</span>}
            {statusDisplay && (
              <Badge className={`text-xs ${statusColors[statusDisplay] || ''}`}>{statusDisplay}</Badge>
            )}
            {foiTornadaSemEfeito && <Badge className="text-xs bg-red-100 text-red-700">TORNADA SEM EFEITO</Badge>}
            {event.raw?.urgente && !isPublicada && (
              <Badge className="text-xs bg-red-100 text-red-700">
                <AlertTriangle className="w-3 h-3 mr-1" />
                URGENTE
              </Badge>
            )}
            {event.raw?.importante && !event.raw?.urgente && !isPublicada && (
              <Badge className="text-xs bg-amber-100 text-amber-700">
                <Star className="w-3 h-3 mr-1" />
                IMPORTANTE
              </Badge>
            )}
          </div>

          <p className="font-medium text-slate-900 text-sm">{event.titulo}</p>
          {event.resumo && <p className="text-sm text-slate-500 mt-0.5 line-clamp-2">{event.resumo}</p>}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <span className="text-sm text-slate-500 whitespace-nowrap mr-1">{formatDate(event.data)}</span>

          {podeApostilarOuTSE && (
            <>
              <button
                className="p-1 rounded hover:bg-purple-50 text-purple-400 hover:text-purple-600 transition-colors"
                title="Fazer Apostila"
                onClick={() => navigate(createPageUrl('CadastrarPublicacao') + `?tipo=Apostila&militar_id=${event.raw.militar_id}&ref_id=${event.id}`)}
              >
                <PenLine className="w-4 h-4" />
              </button>
              <button
                className="p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors"
                title="Tornar sem Efeito"
                onClick={() => navigate(createPageUrl('CadastrarPublicacao') + `?tipo=Tornar+sem+Efeito&militar_id=${event.raw.militar_id}&ref_id=${event.id}`)}
              >
                <Ban className="w-4 h-4" />
              </button>
            </>
          )}

          {podeExcluir ? (
            <button
              className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
              title="Excluir"
              onClick={() => onDelete(event)}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          ) : isPublicacao ? (
            <span className="text-xs text-slate-400 px-1" title="Publicações publicadas não podem ser excluídas">🔒</span>
          ) : (
            <button
              className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
              title="Excluir"
              onClick={() => onDelete(event)}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </div>

      {expanded && event.detalhes && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3 bg-slate-50">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {event.detalhes.map((d, i) => d.valor ? (
              <div key={i}>
                <p className="text-xs text-slate-500">{d.label}</p>
                <p className="text-sm font-medium text-slate-800">{d.valor}</p>
              </div>
            ) : null)}
          </div>

          {isPublicacao && event.raw?.texto_publicacao && (
            <div className="mt-3">
              <p className="text-xs text-slate-500 mb-1 font-medium">Texto para Publicação</p>
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                {event.raw.texto_publicacao}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function FichaMilitar() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const militarId = searchParams.get('id');
  const { hasAccess, hasSelfAccess, canAccessModule, isLoading: loadingUser, isAccessResolved } = useCurrentUser();
  const hasMilitaresAccess = canAccessModule('militares');

  const filtroParam = searchParams.get('filtro');
  const [tipoFiltro, setTipoFiltro] = useState(filtroParam === 'elogios_punicoes' ? 'elogios_punicoes' : 'todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteDeps, setDeleteDeps] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDepsConfirm, setShowDepsConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data: militar } = useQuery({
    queryKey: ['militar', militarId],
    queryFn: async () => {
      const r = await base44.entities.Militar.filter({ id: militarId });
      return r[0];
    },
    enabled: !!militarId && isAccessResolved
  });

  const canViewMilitar = militar ? (hasAccess(militar) || hasSelfAccess(militar)) : false;

  const { data: punicoes = [], refetch: refetchPunicoes } = useQuery({
    queryKey: ['ficha-punicoes', militarId],
    queryFn: () => base44.entities.Punicao.filter({ militar_id: militarId }),
    enabled: !!militarId && isAccessResolved && canViewMilitar
  });

  const { data: atestados = [], refetch: refetchAtestados } = useQuery({
    queryKey: ['ficha-atestados', militarId],
    queryFn: () => base44.entities.Atestado.filter({ militar_id: militarId }),
    enabled: !!militarId && isAccessResolved && canViewMilitar
  });

  const { data: registrosLivro = [], refetch: refetchLivro } = useQuery({
    queryKey: ['ficha-livro', militarId],
    queryFn: () => base44.entities.RegistroLivro.filter({ militar_id: militarId }),
    enabled: !!militarId && isAccessResolved && canViewMilitar
  });

  const { data: publicacoes = [], refetch: refetchPublicacoes } = useQuery({
    queryKey: ['ficha-publicacoes', militarId],
    queryFn: () => base44.entities.PublicacaoExOfficio.filter({ militar_id: militarId }),
    enabled: !!militarId && isAccessResolved && canViewMilitar
  });

  const { data: medalhas = [], refetch: refetchMedalhas } = useQuery({
    queryKey: ['ficha-medalhas', militarId],
    queryFn: () => base44.entities.Medalha.filter({ militar_id: militarId }),
    enabled: !!militarId && isAccessResolved && canViewMilitar
  });

  const { data: historico = [], refetch: refetchHistorico } = useQuery({
    queryKey: ['ficha-comportamento', militarId],
    queryFn: () => base44.entities.HistoricoComportamento.filter({ militar_id: militarId }),
    enabled: !!militarId && isAccessResolved && canViewMilitar
  });

  const refetchAll = () => {
    refetchPunicoes();
    refetchAtestados();
    refetchLivro();
    refetchPublicacoes();
    refetchMedalhas();
    refetchHistorico();
  };

  const eventos = useMemo(() => {
    const lista = [];

    punicoes.forEach(p => lista.push({
      tipo: 'punicao', data: p.data_aplicacao, id: p.id, raw: p,
      titulo: `${p.tipo}${p.motivo ? ` — ${p.motivo}` : ''}`,
      resumo: p.motivo, subtipo: p.tipo,
      detalhes: [
        { label: 'Tipo', valor: p.tipo },
        { label: 'Data Aplicação', valor: formatDate(p.data_aplicacao) },
        { label: 'Data Início', valor: formatDate(p.data_inicio) },
        { label: 'Data Término', valor: formatDate(p.data_termino) },
        { label: 'Documento', valor: p.documento_referencia },
        { label: 'Observações', valor: p.observacoes },
      ]
    }));

    atestados.forEach(a => lista.push({
      tipo: 'atestado', data: a.data_inicio, id: a.id, raw: a,
      titulo: `Atestado — ${a.tipo_afastamento || ''}${a.cid_10 ? ` (${a.cid_10})` : ''}`,
      resumo: `${a.dias} dias — ${a.medico || ''}`, subtipo: a.tipo_afastamento,
      detalhes: [
        { label: 'Início', valor: formatDate(a.data_inicio) },
        { label: 'Término', valor: formatDate(a.data_termino) },
        { label: 'Dias', valor: a.dias ? `${a.dias} dias` : null },
        { label: 'Médico', valor: a.medico },
        { label: 'CID-10', valor: a.cid_10 },
        { label: 'Status', valor: a.status },
        { label: 'Necessita JISO', valor: a.necessita_jiso ? 'Sim' : 'Não' },
      ]
    }));

    registrosLivro.forEach(r => {
      const subtipo = isOperacaoFeriasLivro(r) ? getTipoDisplay(r.tipo_registro) : r.tipo_registro;
      const titulo = isOperacaoFeriasLivro(r)
        ? `Férias — ${getTipoDisplay(r.tipo_registro)}`
        : r.tipo_registro;

      lista.push({
        tipo: 'livro', data: r.data_registro, id: r.id, raw: r,
        titulo,
        resumo: r.observacoes,
        subtipo,
        detalhes: [
          { label: 'Tipo', valor: subtipo },
          { label: 'Data', valor: formatDate(r.data_registro) },
          { label: 'Início', valor: formatDate(r.data_inicio) },
          { label: 'Término', valor: formatDate(r.data_termino) },
          { label: 'Dias', valor: r.dias ? `${r.dias} dias` : null },
          { label: 'Documento', valor: r.documento_referencia },
          { label: 'BG', valor: r.numero_bg },
          { label: 'Observações', valor: r.observacoes },
        ]
      });
    });

    publicacoes.forEach(p => {
      const subtipo = isFeriasPublicacaoExOfficio(p) ? getTipoDisplay(p.tipo) : p.tipo;
      const titulo = isFeriasPublicacaoExOfficio(p)
        ? `Férias — ${getTipoDisplay(p.tipo)}`
        : `${p.tipo}${p.subtipo_geral ? ` — ${p.subtipo_geral}` : ''}`;

      lista.push({
        tipo: 'publicacao', data: p.data_publicacao, id: p.id, raw: p,
        titulo,
        resumo: p.texto_publicacao?.substring(0, 120),
        subtipo,
        detalhes: [
          { label: 'Tipo', valor: subtipo },
          { label: 'Data', valor: formatDate(p.data_publicacao) },
          { label: 'BG', valor: p.numero_bg },
          { label: 'Status', valor: p.status },
          { label: 'Portaria', valor: p.portaria },
          { label: 'Texto', valor: p.texto_publicacao?.substring(0, 200) },
        ]
      });
    });

    medalhas.forEach(m => lista.push({
      tipo: 'medalha', data: m.data_indicacao, id: m.id, raw: m,
      titulo: m.tipo_medalha_nome || 'Medalha',
      resumo: `Status: ${m.status}`, subtipo: m.status,
      detalhes: [
        { label: 'Medalha', valor: m.tipo_medalha_nome },
        { label: 'Indicação', valor: formatDate(m.data_indicacao) },
        { label: 'Concessão', valor: formatDate(m.data_concessao) },
        { label: 'Status', valor: m.status },
        { label: 'Documento', valor: m.documento_referencia },
      ]
    }));

    historico.filter(h => h.motivo !== 'Manual').forEach(h => lista.push({
      tipo: 'comportamento', data: h.data_alteracao, id: h.id, raw: h,
      titulo: `Comportamento: ${h.comportamento_anterior || 'N/D'} → ${h.comportamento_novo}`,
      resumo: `Motivo: ${h.motivo}`, subtipo: h.motivo,
      detalhes: [
        { label: 'Anterior', valor: h.comportamento_anterior },
        { label: 'Novo', valor: h.comportamento_novo },
        { label: 'Motivo', valor: h.motivo },
        { label: 'Data', valor: formatDate(h.data_alteracao) },
        { label: 'Observações', valor: h.observacoes },
      ]
    }));

    return lista.sort((a, b) => {
      if (!a.data && !b.data) return 0;
      if (!a.data) return 1;
      if (!b.data) return -1;
      return new Date(b.data) - new Date(a.data);
    });
  }, [punicoes, atestados, registrosLivro, publicacoes, medalhas, historico]);

  const ELOGIOS_PUNICOES_TIPOS_PUB = ['Elogio Individual', 'Melhoria de Comportamento', 'Punição', 'Geral'];

  const eventosFiltrados = useMemo(() => {
    return eventos.filter(e => {
      if (tipoFiltro === 'elogios_punicoes') {
        const isPunicao = e.tipo === 'punicao';
        const isElogioOuPunicaoPub = e.tipo === 'publicacao' && ELOGIOS_PUNICOES_TIPOS_PUB.includes(e.raw?.tipo);
        if (!isPunicao && !isElogioOuPunicaoPub) return false;
      } else if (tipoFiltro !== 'todos' && e.tipo !== tipoFiltro) {
        return false;
      }

      if (searchTerm) {
        const termo = searchTerm.toLowerCase();
        const hit =
          e.titulo?.toLowerCase().includes(termo) ||
          e.resumo?.toLowerCase().includes(termo) ||
          e.subtipo?.toLowerCase().includes(termo);
        if (!hit) return false;
      }

      if (dataInicio && e.data && e.data < dataInicio) return false;
      if (dataFim && e.data && e.data > dataFim) return false;
      return true;
    });
  }, [eventos, tipoFiltro, searchTerm, dataInicio, dataFim]);

  const avaliacaoComportamento = useMemo(() => {
    if (!militar) return null;
    return calcularComportamento(punicoes, militar.posto_graduacao);
  }, [militar, punicoes]);

  const proximaMelhoria = useMemo(() => {
    if (!militar) return null;
    return calcularProximaMelhoria(punicoes, militar.posto_graduacao);
  }, [militar, punicoes]);

  const calcularDependencias = (event) => {
    const deps = [];

    if (event.tipo === 'atestado') {
      publicacoes.forEach(p => {
        if (p.atestado_homologado_id === event.id || (p.atestados_jiso_ids || []).includes(event.id)) {
          deps.push({
            tipo: 'publicacao',
            id: p.id,
            raw: p,
            label: `Publicação Ex Officio: ${p.tipo} (${formatDate(p.data_publicacao)})`
          });
        }
      });
    }

    return deps;
  };

  const handleDeleteRequest = (event) => {
    if (event.tipo === 'publicacao') {
      const isPublicada = (event.raw?.numero_bg && event.raw?.data_bg) || event.raw?.status === 'Publicado';
      if (isPublicada) return;
    }

    const deps = calcularDependencias(event);
    setDeleteTarget(event);

    if (deps.length > 0) {
      setDeleteDeps({ event, deps });
      setShowDepsConfirm(true);
    } else {
      setShowDeleteConfirm(true);
    }
  };

  const executeDelete = async (event, incluirDeps = false, deps = []) => {
    setDeleting(true);

    try {
      const reverterExOfficio = async (registro) => {
        if (!registro) return;

        await reverterAtestadosPorExclusaoPublicacao(
          registro,
          base44.entities.Atestado,
          base44.entities.PublicacaoExOfficio
        );
      };

      const excluirLivroComReversao = async (registroLivro) => {
        if (!registroLivro?.ferias_id || !isOperacaoFeriasLivro(registroLivro)) {
          await base44.entities.RegistroLivro.delete(registroLivro.id);
          return;
        }

        const feriasList = await base44.entities.Ferias.filter({ id: registroLivro.ferias_id });
        const ferias = feriasList[0];

        if (!ferias) {
          await base44.entities.RegistroLivro.delete(registroLivro.id);
          return;
        }

        const todosRegistrosFerias = await base44.entities.RegistroLivro.filter({ ferias_id: registroLivro.ferias_id });
        const cadeia = montarCadeia(ferias, todosRegistrosFerias);
        const eventoAlvo = cadeia.find(e => e.id === registroLivro.id) || registroLivro;
        const descendentes = identificarDescendentes(eventoAlvo, cadeia);

        const descendentesPublicados = descendentes.filter((d) => calcStatusPublicacao(d) === 'Publicado');
        if (descendentesPublicados.length > 0) {
          throw new Error('Não é possível excluir este registro porque existem eventos posteriores já publicados na cadeia de férias.');
        }

        await executarExclusaoAdminCadeia({
          ferias,
          eventoAlvo,
          incluirDescendentes: descendentes.length > 0,
          cadeia,
          queryClient,
        });
      };

      if (incluirDeps && deps.length > 0) {
        for (const dep of deps) {
          if (dep.tipo === 'publicacao') {
            await reverterExOfficio(dep.raw);
            await base44.entities.PublicacaoExOfficio.delete(dep.id);
          }
        }
      }

      if (event.tipo === 'punicao') {
        await base44.entities.Punicao.delete(event.id);
      } else if (event.tipo === 'atestado') {
        await excluirAtestadoComReflexoNoQuadro(event.raw || { id: event.id });
      } else if (event.tipo === 'livro') {
        await excluirLivroComReversao(event.raw || { id: event.id });
      } else if (event.tipo === 'publicacao') {
        await reverterExOfficio(event.raw);
        await base44.entities.PublicacaoExOfficio.delete(event.id);
      } else if (event.tipo === 'medalha') {
        await base44.entities.Medalha.delete(event.id);
      } else if (event.tipo === 'comportamento') {
        await base44.entities.HistoricoComportamento.delete(event.id);
      }

      refetchAll();
      queryClient.invalidateQueries({ queryKey: ['ferias'] });
      queryClient.invalidateQueries({ queryKey: ['periodos-aquisitivos'] });
      queryClient.invalidateQueries({ queryKey: ['registros-livro-all'] });
      queryClient.invalidateQueries({ queryKey: ['registros-livro'] });
      queryClient.invalidateQueries({ queryKey: ['publicacoes-ex-officio'] });
      queryClient.invalidateQueries({ queryKey: ['atestados'] });
      queryClient.invalidateQueries({ queryKey: ['publicacoes-atestado'] });
      queryClient.invalidateQueries({ queryKey: ['cards'] });
    } catch (error) {
      alert(error?.message || 'Não foi possível excluir o registro com segurança.');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
      setDeleteDeps(null);
      setShowDeleteConfirm(false);
      setShowDepsConfirm(false);
    }
  };

  if (loadingUser || !isAccessResolved) return null;
  if (!hasMilitaresAccess) return <AccessDenied modulo="Efetivo" />;

  if (!militarId) {
    return <div className="p-8 text-center text-slate-500">Militar não especificado.</div>;
  }


  if (militar && !canViewMilitar) {
    return <div className="p-8 text-center text-slate-500">Acesso negado para esta ficha militar.</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>

          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-[#1e3a5f]">Ficha Militar</h1>
            {militar && (
              <p className="text-slate-500 text-sm">
                {militar.posto_graduacao} {militar.nome_completo} · Mat. {militar.matricula}
              </p>
            )}
          </div>

          {militar && (
            <Button variant="outline" size="sm" onClick={() => navigate(createPageUrl('VerMilitar') + `?id=${militarId}`)}>
              <User className="w-4 h-4 mr-2" />
              Ver Cadastro
            </Button>
          )}
        </div>

        {militar && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Comportamento</h3>
            <div className="grid md:grid-cols-3 gap-3 text-sm">
              <div className="rounded-lg border p-3">
                <p className="text-slate-500">Atual</p>
                <p className="font-semibold">{militar.comportamento || 'Bom'}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-slate-500">Calculado</p>
                <p className="font-semibold">{avaliacaoComportamento?.comportamento || '—'}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-slate-500">Próxima melhoria</p>
                <p className="font-semibold">{proximaMelhoria?.data ? `${proximaMelhoria.data} (${proximaMelhoria.comportamento_futuro})` : '—'}</p>
              </div>
            </div>
            {avaliacaoComportamento?.fundamento && (
              <p className="mt-3 text-xs text-slate-600">{avaliacaoComportamento.fundamento}</p>
            )}
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6 space-y-3">
          <div className="flex items-center gap-2 text-slate-600 font-medium text-sm">
            <Filter className="w-4 h-4" />
            Filtros
          </div>

          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Buscar nos registros..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
              <SelectTrigger className="w-full md:w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col md:flex-row gap-3 items-center">
            <label className="text-sm text-slate-500 whitespace-nowrap">Período:</label>
            <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="flex-1" />
            <span className="text-slate-400 text-sm">até</span>
            <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="flex-1" />
            {(dataInicio || dataFim || tipoFiltro !== 'todos' || searchTerm) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDataInicio('');
                  setDataFim('');
                  setTipoFiltro('todos');
                  setSearchTerm('');
                }}
              >
                Limpar
              </Button>
            )}
          </div>
        </div>

        <div className="mb-4">
          <p className="text-sm text-slate-500">
            {eventosFiltrados.length} {eventosFiltrados.length === 1 ? 'registro' : 'registros'}
            {eventos.length !== eventosFiltrados.length && ` (de ${eventos.length} no total)`}
          </p>
        </div>

        {eventosFiltrados.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <ClipboardList className="w-14 h-14 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold text-slate-700">Nenhum registro encontrado</h3>
            <p className="text-slate-500 text-sm mt-1">Tente ajustar os filtros</p>
          </div>
        ) : (tipoFiltro === 'publicacao' || tipoFiltro === 'todos') && eventosFiltrados.some(e => e.tipo === 'publicacao') ? (
          (() => {
            const getStatusPub = (e) => {
              if (e.tipo !== 'publicacao') return null;
              if (e.raw?.numero_bg && e.raw?.data_bg) return 'Publicado';
              if (e.raw?.nota_para_bg) return 'Aguardando Publicação';
              return 'Aguardando Nota';
            };

            const grupos = [
              { key: 'Aguardando Nota', color: 'text-amber-700', border: 'border-amber-300', bg: 'bg-amber-50' },
              { key: 'Aguardando Publicação', color: 'text-blue-700', border: 'border-blue-300', bg: 'bg-blue-50' },
              { key: 'Publicado', color: 'text-emerald-700', border: 'border-emerald-300', bg: 'bg-emerald-50' },
            ];

            const pubEventos = eventosFiltrados.filter(e => e.tipo === 'publicacao');
            const outrosEventos = eventosFiltrados.filter(e => e.tipo !== 'publicacao');

            return (
              <div className="space-y-6">
                {outrosEventos.length > 0 && (
                  <div className="space-y-3">
                    {outrosEventos.map((event) => (
                      <EventCard key={event.tipo + event.id} event={event} onDelete={handleDeleteRequest} />
                    ))}
                  </div>
                )}

                {pubEventos.length > 0 && (
                  <div className="space-y-5">
                    {grupos.map(grupo => {
                      const items = pubEventos.filter(e => getStatusPub(e) === grupo.key);
                      if (items.length === 0) return null;

                      return (
                        <div key={grupo.key}>
                          <div className={`flex items-center gap-2 mb-2 px-3 py-1.5 rounded-lg border ${grupo.border} ${grupo.bg}`}>
                            <span className={`font-bold text-sm ${grupo.color}`}>{grupo.key}</span>
                            <span className={`text-xs ${grupo.color} opacity-70`}>— {items.length} publicação(ões)</span>
                          </div>
                          <div className="space-y-3">
                            {items.map(event => (
                              <EventCard key={event.tipo + event.id} event={event} onDelete={handleDeleteRequest} />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()
        ) : (
          <div className="space-y-3">
            {eventosFiltrados.map((event) => (
              <EventCard key={event.tipo + event.id} event={event} onDelete={handleDeleteRequest} />
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este registro? Esta ação não pode ser desfeita.
              {deleteTarget && <span className="block mt-2 font-medium text-slate-700">"{deleteTarget.titulo}"</span>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={deleting}
              onClick={() => executeDelete(deleteTarget)}
            >
              {deleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDepsConfirm} onOpenChange={setShowDepsConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Registros dependentes encontrados</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>O registro <span className="font-medium text-slate-700">"{deleteDeps?.event?.titulo}"</span> possui os seguintes registros vinculados:</p>
                <ul className="mt-2 space-y-1">
                  {deleteDeps?.deps?.map((d, i) => (
                    <li key={i} className="text-sm text-slate-600 bg-slate-50 rounded px-3 py-1.5">• {d.label}</li>
                  ))}
                </ul>
                <p className="mt-3">Deseja excluir também os registros dependentes?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <Button
              variant="outline"
              disabled={deleting}
              onClick={() => executeDelete(deleteDeps.event, false, [])}
            >
              Excluir apenas este
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={deleting}
              onClick={() => executeDelete(deleteDeps.event, true, deleteDeps.deps)}
            >
              {deleting ? 'Excluindo...' : 'Excluir tudo'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
