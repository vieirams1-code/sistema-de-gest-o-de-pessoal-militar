import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import {
  Calendar,
  FileText,
  Save,
  Edit2,
  X,
  ChevronDown,
  ChevronUp,
  Trash2,
  ExternalLink,
  Star,
  AlertTriangle,
  PenLine,
  Ban,
  GitBranch,
  Shield,
  Link2,
  BadgeCheck,
  FileBadge,
  User,
  Lock,
  Layers3
} from 'lucide-react';
import { format } from 'date-fns';
import { createPageUrl } from '@/utils';
import {
  isLoteCompiladoPublicado,
  MENSAGEM_BLOQUEIO_MANUTENCAO_LOTE,
  podeManterFilhosNoLoteCompilado,
  isRegistroFilhoDePublicacaoCompilada,
  podeDesfazerLoteCompilado,
} from '@/components/publicacao/publicacaoCompiladaService';

const statusColors = {
  'Aguardando Nota': 'bg-amber-100 text-amber-700 border-amber-200',
  'Aguardando Publicação': 'bg-blue-100 text-blue-700 border-blue-200',
  'Publicado': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Inconsistente': 'bg-red-100 text-red-700 border-red-200',
};

function calcStatus(nota, numBg, dataBg) {
  if (numBg && dataBg) return 'Publicado';
  if (nota) return 'Aguardando Publicação';
  return 'Aguardando Nota';
}

function detectarOrigemTipo(registro) {
  if (registro?.tipo_lote || registro?.quantidade_itens) {
    return 'publicacao-compilada';
  }
  if (registro.tipo && !registro.tipo_registro && !registro.medico && !registro.cid_10) {
    return 'ex-officio';
  }
  if (registro.medico || registro.cid_10) {
    return 'atestado';
  }
  return 'livro';
}

function getTipoDisplay(tipo) {
  if (tipo === 'Saída Férias') return 'Início';
  if (tipo === 'Interrupção de Férias') return 'Interrupção';
  if (tipo === 'Nova Saída / Retomada') return 'Continuação';
  if (tipo === 'Retorno Férias') return 'Término';
  return tipo;
}

function getGrupoDisplay(registro) {
  const tipoBase = registro.tipo_registro || registro.tipo || '';

  if (
    tipoBase === 'Saída Férias' ||
    tipoBase === 'Interrupção de Férias' ||
    tipoBase === 'Nova Saída / Retomada' ||
    tipoBase === 'Retorno Férias'
  ) {
    return 'Férias';
  }

  if (registro.medico || registro.cid_10) {
    return 'Atestado';
  }

  return '';
}

function getEditUrl(registro) {
  const tipo = detectarOrigemTipo(registro);

  if (tipo === 'ex-officio') {
    return `${createPageUrl('CadastrarPublicacao')}?id=${registro.id}`;
  }

  if (tipo === 'atestado') {
    return `${createPageUrl('CadastrarAtestado')}?id=${registro.id}`;
  }

  if (tipo === 'publicacao-compilada') {
    return null;
  }

  return `${createPageUrl('CadastrarRegistroLivro')}?id=${registro.id}`;
}

function formatDate(d) {
  if (!d) return '-';
  try {
    if (String(d).includes('T')) return format(new Date(d), 'dd/MM/yyyy');
    return format(new Date(`${d}T00:00:00`), 'dd/MM/yyyy');
  } catch {
    return d;
  }
}

function gerarCodigo(id) {
  if (!id) return '—';
  return `PUB-${id.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(-4)}`;
}

function getActBadgeClasses(grupo, tipo) {
  if (grupo === 'Férias') {
    if (tipo === 'Interrupção') return 'bg-cyan-50 text-cyan-800 border-cyan-200';
    if (tipo === 'Início') return 'bg-blue-50 text-blue-800 border-blue-200';
    if (tipo === 'Continuação') return 'bg-indigo-50 text-indigo-800 border-indigo-200';
    if (tipo === 'Término') return 'bg-amber-50 text-amber-800 border-amber-200';
    return 'bg-cyan-50 text-cyan-800 border-cyan-200';
  }
  if (grupo === 'Atestado') return 'bg-rose-50 text-rose-800 border-rose-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

function getIntegridadeBadge(registro) {
  if (
    registro.status_calculado === 'Inconsistente' ||
    registro.integridade_status === 'inconsistente' ||
    registro.inconsistencia_contrato?.motivo_curto
  ) {
    return {
      label: 'INCONSISTENTE',
      className: 'bg-red-100 text-red-800 border-red-200'
    };
  }

  return {
    label: 'INTEGRIDADE OK',
    className: 'bg-emerald-100 text-emerald-800 border-emerald-200'
  };
}

function FieldBlock({ label, children, className = '' }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-slate-50 p-4 ${className}`}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2">{label}</p>
      <div className="text-sm text-slate-800">{children}</div>
    </div>
  );
}

export default function PublicacaoCard({ registro, onUpdate, onDelete, onVerFamilia, onDesagruparFilho, todosRegistros = [], isAdmin: _isAdmin = false, modoAdmin = false, canAccessAction = (_a) => false }) {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isChildrenExpanded, setIsChildrenExpanded] = useState(false);
  const [isEditingBg, setIsEditingBg] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [bgData, setBgData] = useState({
    nota_para_bg: registro.nota_para_bg || '',
    numero_bg: registro.numero_bg || '',
    data_bg: registro.data_bg || '',
  });

  const origemTipo = detectarOrigemTipo(registro);
  const contratoLivro = origemTipo === 'livro';
  const isLoteCompilado = origemTipo === 'publicacao-compilada';
  const isFilhoLoteCompilado = isRegistroFilhoDePublicacaoCompilada(registro);
  const detalhesContrato = registro.detalhes_contrato;
  const vinculosContrato = registro.vinculos_contrato;
  const publicacaoContrato = registro.publicacao_contrato;
  const inconsistenciaContrato = registro.inconsistencia_contrato;
  const cadeiaEventosContrato = registro.cadeia_eventos_contrato || [];

  const currentStatus = calcStatus(
    registro.nota_para_bg,
    registro.numero_bg,
    registro.data_bg
  );

  const isPublicado = isLoteCompilado ? isLoteCompiladoPublicado(registro) : currentStatus === 'Publicado';
  const isApostila = registro.tipo === 'Apostila';
  const isTSE = registro.tipo === 'Tornar sem Efeito';
  const isDerivado = isApostila || isTSE;

  const apostilaVinculada = registro.apostilada_por_id
    ? todosRegistros.find(r => r.id === registro.apostilada_por_id)
    : null;
  const apostilaAindaValida = apostilaVinculada
    ? !apostilaVinculada.tornada_sem_efeito_por_id && !todosRegistros.find(r => r.tipo === 'Tornar sem Efeito' && r.publicacao_referencia_id === apostilaVinculada.id)
    : !!registro.apostilada_por_id;
  const foiApostilada = apostilaAindaValida;

  const tseDaApostila = isApostila
    ? todosRegistros.find(r => r.tipo === 'Tornar sem Efeito' && r.publicacao_referencia_id === registro.id)
    : null;
  const foiTornadaSemEfeito = !!registro.tornada_sem_efeito_por_id || !!tseDaApostila;
  const temFamilia = foiApostilada || foiTornadaSemEfeito || !!registro.publicacao_referencia_id;

  const podeApostilar = isPublicado && !foiTornadaSemEfeito && !isDerivado;
  const podeTornarSemEfeito = isPublicado && !foiTornadaSemEfeito && ((!isDerivado) || isApostila) && !isTSE;
  const podeMarcarPrioridade = !isPublicado && !isFilhoLoteCompilado;
  const podeEditar = !isPublicado && origemTipo !== 'livro' && origemTipo !== 'publicacao-compilada';
  const temPermissaoAdmin = canAccessAction('admin_mode');
  const podeExcluir = !isPublicado && temPermissaoAdmin && modoAdmin;
  const podeExcluirDesabilitado = !isPublicado && temPermissaoAdmin && !modoAdmin;
  const mensagemRegistroFilho = 'Registro vinculado a publicação compilada. Edite o lote pai.';
  const mensagemExclusaoFilho = 'Registro vinculado a publicação compilada e não pode ser excluído isoladamente.';
  const mensagemLotePublicado = 'Publicação compilada já publicada não pode ser removida.';
  const mensagemBloqueioManutencaoLote = MENSAGEM_BLOQUEIO_MANUTENCAO_LOTE;
  const filhosDoLote = isLoteCompilado
    ? todosRegistros
      .filter((item) => item?.publicacao_compilada_id === registro.id)
      .sort((a, b) => (a?.publicacao_compilada_ordem ?? 0) - (b?.publicacao_compilada_ordem ?? 0))
    : [];
  const lotePermiteManutencaoFilhos = isLoteCompilado ? podeManterFilhosNoLoteCompilado(registro) : true;
  const podeDesagruparFilho = isFilhoLoteCompilado && !isPublicado && temPermissaoAdmin && modoAdmin && typeof onDesagruparFilho === 'function';
  const podeDesagruparFilhoDoLote = isLoteCompilado && lotePermiteManutencaoFilhos && !isPublicado && temPermissaoAdmin && modoAdmin && typeof onDesagruparFilho === 'function';

  const liveStatus = calcStatus(bgData.nota_para_bg, bgData.numero_bg, bgData.data_bg);

  const tipoBase =
    registro.tipo_registro ||
    registro.tipo ||
    (registro.medico || registro.cid_10
      ? (registro.necessita_jiso ? 'Atestado - JISO' : 'Atestado - Homologação')
      : '') ||
    'Publicação';

  const tipoLabel = getTipoDisplay(tipoBase);
  const grupoLabel = registro.grupo_display || getGrupoDisplay(registro);
  const atestadoLink = registro.atestado_homologado_id
    ? `${createPageUrl('VerAtestado')}?id=${registro.atestado_homologado_id}`
    : null;
  const atestadosJISOIds = registro.tipo === 'Ata JISO' && registro.atestados_jiso_ids?.length
    ? registro.atestados_jiso_ids
    : null;

  const codigoPrincipal = registro.publicacao_referencia_id ? gerarCodigo(registro.publicacao_referencia_id) : null;
  const urlPrincipal = registro.publicacao_referencia_id
    ? `${createPageUrl('CadastrarPublicacao')}?id=${registro.publicacao_referencia_id}`
    : null;

  const handleTogglePrioridade = (e, flag) => {
    e.stopPropagation();
    const newVal = !registro[flag];
    onUpdate(registro.id, { [flag]: newVal }, origemTipo);
  };

  const handleSaveBg = () => {
    if (isFilhoLoteCompilado) {
      alert(mensagemRegistroFilho);
      return;
    }

    const novoStatus = calcStatus(bgData.nota_para_bg, bgData.numero_bg, bgData.data_bg);

    const updateData =
      origemTipo === 'atestado'
        ? { ...bgData, status_publicacao: novoStatus }
        : { ...bgData, status: novoStatus };

    onUpdate(registro.id, updateData, origemTipo);
    setIsEditingBg(false);
  };

  const handleCancelBg = () => {
    setBgData({
      nota_para_bg: registro.nota_para_bg || '',
      numero_bg: registro.numero_bg || '',
      data_bg: registro.data_bg || '',
    });
    setIsEditingBg(false);
  };

  const handleDelete = () => {
    if (!canAccessAction('admin_mode') || !modoAdmin) {
      alert('Ação restrita. Exige permissão de administração e modo admin ativo.');
      return;
    }
    if (isFilhoLoteCompilado) {
      alert(mensagemExclusaoFilho);
      return;
    }
    if (isLoteCompilado && !podeDesfazerLoteCompilado(registro)) {
      alert(mensagemLotePublicado);
      return;
    }
    onDelete(registro.id, origemTipo);
    setShowDeleteConfirm(false);
  };

  const handleApostila = () => {
    navigate(`${createPageUrl('CadastrarPublicacao')}?tipo=Apostila&militar_id=${registro.militar_id}&ref_id=${registro.id}&origem_tipo=${origemTipo}`);
  };

  const handleTornarSemEfeito = () => {
    navigate(`${createPageUrl('CadastrarPublicacao')}?tipo=Tornar+sem+Efeito&militar_id=${registro.militar_id}&ref_id=${registro.id}&origem_tipo=${origemTipo}`);
  };

  const handleDesagruparFilho = async () => {
    if (!podeDesagruparFilho) return;
    await onDesagruparFilho(registro);
  };

  const integridadeBadge = getIntegridadeBadge(registro);
  const nomeInstitucional = registro.militar_nome_institucional || registro.militar_nome || 'Militar';
  const dataHeader = formatDate(registro.data_registro || registro.created_date || registro.data_inicio);
  const textoPublicacao = publicacaoContrato?.texto || registro.texto_publicacao || 'Sem texto gerado.';
  const origemLabel = contratoLivro
    ? (registro.origem || 'Automática')
    : (origemTipo === 'ex-officio' ? 'Ex Officio' : origemTipo === 'atestado' ? 'Atestado' : isLoteCompilado ? 'Lote compilado' : 'Manual');

  const renderFilhoAgrupado = (filho) => {
    const nomeFilho = filho.militar_nome_institucional || filho.militar_nome || 'Militar não identificado';
    const tipoFilhoBase = filho.tipo_composto_display || filho.tipo_registro || filho.tipo || 'Registro';
    const tipoFilho = getTipoDisplay(tipoFilhoBase);
    const filhoPublicado = Boolean(filho?.numero_bg && filho?.data_bg);
    const podeDesagruparFilhoExpandido = podeDesagruparFilhoDoLote && !filhoPublicado;

    return (
      <div
        key={filho.id}
        className="rounded-xl border border-indigo-100 bg-white px-4 py-3 shadow-sm"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border border-indigo-200 bg-indigo-50 text-indigo-700">
                Filho {filho.publicacao_compilada_ordem ?? '—'}
              </Badge>
              <span className="text-sm font-semibold text-slate-900">{nomeFilho}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-700">
                MAT: {filho.militar_matricula || '—'}
              </span>
              <span className="rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-700">
                Tipo: {tipoFilho}
              </span>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <span className="font-semibold text-slate-900">Nota para BG:</span> {filho.nota_para_bg || '—'}
            </div>
          </div>

          {podeDesagruparFilhoExpandido && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onDesagruparFilho(filho)}
              className="shrink-0 border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800"
            >
              <Layers3 className="mr-2 h-4 w-4" />
              Desagrupar
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isLoteCompilado ? 'Confirmar desfazer lote' : 'Confirmar exclusão'}</AlertDialogTitle>
            <AlertDialogDescription>
              {isLoteCompilado
                ? 'Desfazer publicação compilada? Os registros voltarão ao estado individual.'
                : `Esta publicação ainda não foi publicada oficialmente. A exclusão só deve ser permitida
              se não houver movimentações posteriores dependentes dela. Em fluxos encadeados, como
              férias, exclusões intermediárias podem causar inconsistências.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleDelete}>
              {isLoteCompilado ? 'Desfazer lote' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
            <div className="flex items-start gap-4 min-w-0">
              <div className="w-14 h-14 rounded-full border-2 border-slate-200 bg-slate-50 flex items-center justify-center text-slate-400 shrink-0">
                <User className="w-7 h-7" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5 mb-2">
                  {isTSE && <Badge className="border bg-red-50 text-red-700 border-red-200">TSE</Badge>}
                  {isApostila && <Badge className="border bg-purple-50 text-purple-700 border-purple-200">Apostila</Badge>}
                  {foiTornadaSemEfeito && <Badge className="border bg-red-50 text-red-700 border-red-200">Sem Validade</Badge>}
                  {foiApostilada && !isDerivado && !foiTornadaSemEfeito && <Badge className="border bg-purple-50 text-purple-700 border-purple-200">Apostilada</Badge>}
                  {registro.urgente && !isPublicado && <Badge className="border bg-red-100 text-red-700 border-red-200">URGENTE</Badge>}
                  {registro.importante && !registro.urgente && !isPublicado && <Badge className="border bg-amber-100 text-amber-700 border-amber-200">IMPORTANTE</Badge>}
                  {isFilhoLoteCompilado && (
                    <Badge className="border bg-indigo-50 text-indigo-700 border-indigo-200">
                      <Layers3 className="mr-1 h-3.5 w-3.5" />
                      Em lote compilado
                    </Badge>
                  )}
                  {isLoteCompilado && (
                    <Badge className="border bg-indigo-100 text-indigo-800 border-indigo-200">
                      <Layers3 className="mr-1 h-3.5 w-3.5" />
                      Lote pai
                    </Badge>
                  )}

                  <h3 className="text-xl font-semibold tracking-tight text-[#1e3a5f] sm:text-2xl">{nomeInstitucional}</h3>

                  <Badge className={`border ${statusColors[registro.status_calculado] || statusColors[currentStatus] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                    {registro.status_calculado || currentStatus}
                  </Badge>
                  <Badge className={`border ${integridadeBadge.className}`}>{integridadeBadge.label}</Badge>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                  <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-semibold">
                    MAT: {registro.militar_matricula || '—'}
                  </span>
                  {grupoLabel && <Badge className={`border ${getActBadgeClasses(grupoLabel, tipoLabel)}`}>{grupoLabel.toUpperCase()}</Badge>}
                  {tipoLabel && <Badge className={`border ${getActBadgeClasses(grupoLabel, tipoLabel)}`}>{tipoLabel.toUpperCase()}</Badge>}
                  <span className="inline-flex items-center gap-1.5 text-slate-500 font-medium">
                    <Calendar className="w-4 h-4" />{dataHeader}
                  </span>
                  {registro.numero_bg && <span className="font-medium text-emerald-700">BG Nº {registro.numero_bg}</span>}
                </div>

                {isDerivado && codigoPrincipal && (
                  <div className="mt-2 flex items-center gap-1.5 flex-wrap text-xs">
                    <span className="text-slate-400">Publicação principal:</span>
                    <button onClick={(e) => { e.stopPropagation(); navigate(urlPrincipal); }} className="flex items-center gap-1 font-mono font-semibold text-[#1e3a5f] hover:underline">
                      <ExternalLink className="w-3 h-3" />{codigoPrincipal}
                    </button>
                  </div>
                )}
                {atestadoLink && (
                  <button onClick={(e) => { e.stopPropagation(); navigate(atestadoLink); }} className="mt-2 inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
                    <ExternalLink className="w-3.5 h-3.5" />Ver Atestado
                  </button>
                )}
                {atestadosJISOIds && (
                  <span className="mt-2 inline-flex items-center gap-1 text-sm text-blue-600 font-medium">
                    <ExternalLink className="w-3.5 h-3.5" />{atestadosJISOIds.length} atestado(s) vinculado(s)
                  </span>
                )}
                {isFilhoLoteCompilado && (
                  <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-900">
                    Registro vinculado a publicação compilada. Edite o lote pai.
                  </div>
                )}
                {isLoteCompilado && (
                  <div className="mt-3 space-y-3 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-3 text-sm text-indigo-900">
                    <div>
                      <span className="font-semibold">Lote pai operacional.</span> Este registro controla {registro.quantidade_itens || filhosDoLote.length || 0} filho(s) vinculados e concentra a publicação/conciliação do conjunto.
                    </div>
                    <div className="flex flex-col gap-3 rounded-xl border border-indigo-200 bg-white/70 p-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-2">
                          <div className="text-xs font-medium text-indigo-800">
                            Resumo: {registro.quantidade_itens || filhosDoLote.length || 0} publicação(ões) agrupada(s).
                          </div>
                          {!lotePermiteManutencaoFilhos && (
                            <div className="text-xs font-medium text-amber-700">
                              {mensagemBloqueioManutencaoLote}
                            </div>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setIsChildrenExpanded((value) => !value)}
                          className="gap-2 border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800"
                        >
                          {isChildrenExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          {isChildrenExpanded ? 'Recolher filhos' : 'Expandir filhos'}
                        </Button>
                      </div>

                      {isChildrenExpanded && (
                        filhosDoLote.length > 0 ? (
                          <div className="space-y-3 border-l-2 border-indigo-200 pl-4">
                            {filhosDoLote.map(renderFilhoAgrupado)}
                          </div>
                        ) : (
                          <div className="rounded-lg border border-dashed border-indigo-200 bg-white px-3 py-4 text-sm text-slate-500">
                            Nenhum filho vinculado a este lote.
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}
                {isFilhoLoteCompilado && podeDesagruparFilho && (
                  <div className="mt-3 rounded-xl border border-indigo-200 bg-white px-3 py-2 text-sm text-indigo-900">
                    Filho elegível para desagrupar antes da publicação do lote.
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center flex-wrap gap-2 xl:justify-end">
              {podeMarcarPrioridade && (
                <>
                  <Button variant="ghost" size="sm" onClick={(e) => handleTogglePrioridade(e, 'urgente')} className={registro.urgente ? 'text-red-600' : 'text-slate-400 hover:text-red-500'}>
                    <AlertTriangle className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={(e) => handleTogglePrioridade(e, 'importante')} className={registro.importante ? 'text-amber-500' : 'text-slate-400 hover:text-amber-500'}>
                    <Star className="w-4 h-4" />
                  </Button>
                </>
              )}
              {!isEditingBg && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (isFilhoLoteCompilado) {
                      alert(mensagemRegistroFilho);
                      return;
                    }
                    setIsEditingBg(true);
                    setIsExpanded(true);
                  }}
                  className="text-slate-500 hover:text-blue-600 text-xs gap-1"
                >
                  <FileText className="w-4 h-4" /><span className="hidden sm:inline">Nota/BG</span>
                </Button>
              )}
              {podeEditar && (
                <Button variant="ghost" size="sm" onClick={() => navigate(getEditUrl(registro))} className="text-slate-500 hover:text-[#1e3a5f] text-xs gap-1">
                  <Edit2 className="w-4 h-4" /><span className="hidden sm:inline">Editar</span>
                </Button>
              )}
              {podeApostilar && (
                <Button variant="ghost" size="sm" onClick={handleApostila} className="text-purple-500 hover:text-purple-700 text-xs gap-1">
                  <PenLine className="w-4 h-4" /><span className="hidden sm:inline">Apostila</span>
                </Button>
              )}
              {podeTornarSemEfeito && (
                <Button variant="ghost" size="sm" onClick={handleTornarSemEfeito} className="text-red-500 hover:text-red-700 text-xs gap-1">
                  <Ban className="w-4 h-4" /><span className="hidden sm:inline">Tornar s/ Efeito</span>
                </Button>
              )}
              {(podeExcluir || (isFilhoLoteCompilado && temPermissaoAdmin && modoAdmin) || (isLoteCompilado && temPermissaoAdmin && modoAdmin)) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (isFilhoLoteCompilado) {
                      alert(mensagemExclusaoFilho);
                      return;
                    }
                    if (isLoteCompilado && !podeDesfazerLoteCompilado(registro)) {
                      alert(mensagemLotePublicado);
                      return;
                    }
                    setShowDeleteConfirm(true);
                  }}
                  className="text-slate-500 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
              {podeExcluirDesabilitado && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled
                  title="Ative o modo admin para usar esta função."
                  className="text-slate-400"
                >
                  <Lock className="w-4 h-4" />
                </Button>
              )}
              {temFamilia && onVerFamilia && (
                <Button variant="ghost" size="sm" onClick={onVerFamilia} className="text-[#1e3a5f] hover:bg-[#1e3a5f]/10 text-xs gap-1">
                  <GitBranch className="w-4 h-4" /><span className="hidden sm:inline">Família</span>
                </Button>
              )}
              {podeDesagruparFilho && (
                <Button variant="ghost" size="sm" onClick={handleDesagruparFilho} className="text-indigo-600 hover:text-indigo-800 text-xs gap-1">
                  <Layers3 className="w-4 h-4" /><span className="hidden sm:inline">Desagrupar</span>
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => setIsExpanded(!isExpanded)}>
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>

        {isExpanded && (
          <CardContent className="p-5">
            {isEditingBg ? (
              <div className="space-y-3 bg-blue-50 p-4 rounded-lg border border-blue-100">
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Preencher Nota / BG</p>
                <div>
                  <Label className="text-sm font-medium">Nota para BG</Label>
                  <Input value={bgData.nota_para_bg} onChange={(e) => setBgData((d) => ({ ...d, nota_para_bg: e.target.value }))} className="mt-1 bg-white" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm font-medium">Número do BG</Label>
                    <Input value={bgData.numero_bg} onChange={(e) => setBgData((d) => ({ ...d, numero_bg: e.target.value }))} className="mt-1 bg-white" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Data do BG</Label>
                    <Input type="date" value={bgData.data_bg} onChange={(e) => setBgData((d) => ({ ...d, data_bg: e.target.value }))} className="mt-1 bg-white" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={`${statusColors[liveStatus]} text-xs`}>→ {liveStatus}</Badge>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveBg} className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"><Save className="w-4 h-4 mr-1" />Salvar</Button>
                  <Button size="sm" variant="outline" onClick={handleCancelBg}><X className="w-4 h-4 mr-1" />Cancelar</Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-6">
                <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FieldBlock label="Origem"><div className="text-2xl font-semibold text-slate-900">{origemLabel}</div></FieldBlock>
                    <FieldBlock label="Data (Contrato)">
                      <div className="space-y-1">
                        <div className="font-semibold text-slate-900">{formatDate(registro.data_registro || registro.data_inicio)}</div>
                        {(registro.data_fim || registro.data_termino) && <div className="font-semibold text-slate-700">{formatDate(registro.data_fim || registro.data_termino)}</div>}
                      </div>
                    </FieldBlock>
                  </div>

                  <FieldBlock label="Identificação do Ato">
                    <div className="space-y-1.5">
                      <p><span className="font-semibold">Criado em:</span> {detalhesContrato?.criado_em || formatDate(registro.created_date)}</p>
                      <p><span className="font-semibold">Atualizado em:</span> {detalhesContrato?.atualizado_em || '—'}</p>
                      {registro.assunto && <p><span className="font-semibold">Assunto:</span> {registro.assunto}</p>}
                    </div>
                  </FieldBlock>

                  <FieldBlock label="Origem e Vínculos">
                    <div className="space-y-1.5">
                      <p><span className="font-semibold">Férias:</span> {vinculosContrato?.ferias?.label || (registro.ferias_id ? `Vinculada (${registro.ferias_id})` : '—')}</p>
                      <p><span className="font-semibold">Lote compilado:</span> {registro.publicacao_compilada_id ? `Sim (${registro.publicacao_compilada_id})` : 'Não'}</p>
                      <p><span className="font-semibold">Ordem no lote:</span> {registro.publicacao_compilada_ordem ?? '—'}</p>
                      {isLoteCompilado && <p><span className="font-semibold">Itens controlados:</span> {registro.quantidade_itens || 0}</p>}
                      <p><span className="font-semibold">Período:</span> {vinculosContrato?.periodo?.label || registro.periodo_aquisitivo || '—'}</p>
                      <p><span className="font-semibold">Cadeia:</span> {vinculosContrato?.cadeia?.existe ? `${vinculosContrato.cadeia.total_eventos} evento(s)` : (cadeiaEventosContrato.length ? `${cadeiaEventosContrato.length} evento(s)` : 'Sem cadeia')}</p>
                      {registro.publicacao_referencia_id && <p><span className="font-semibold">Código principal:</span> {gerarCodigo(registro.publicacao_referencia_id)}</p>}
                    </div>
                  </FieldBlock>

                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2">Texto da Publicação</p>
                    <div className="rounded-xl border border-blue-100 bg-blue-50 p-5 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                      <div className="mb-3 space-y-1">
                        <p><span className="font-semibold">Status:</span> {publicacaoContrato?.status || registro.status_calculado || currentStatus}</p>
                        <p><span className="font-semibold">Nota:</span> {registro.nota_para_bg || publicacaoContrato?.nota_para_bg || '—'}</p>
                      </div>
                      {textoPublicacao}
                    </div>
                  </div>

                  {registro.observacoes && (
                    <FieldBlock label="Observações"><div className="text-slate-700">{registro.observacoes}</div></FieldBlock>
                  )}
                </div>

                <div className="space-y-5">
                  <FieldBlock label="Nota para BG"><div className="font-semibold">{registro.nota_para_bg || '—'}</div></FieldBlock>
                  <FieldBlock label="Número do BG"><div className="font-semibold">{registro.numero_bg || '—'}</div></FieldBlock>
                  <FieldBlock label="Rastreabilidade">
                    {cadeiaEventosContrato.length > 0 ? (
                      <div className="space-y-2">
                        {cadeiaEventosContrato.map((evento) => (
                          <div key={evento.id} className={`flex items-center justify-between rounded-lg border px-3 py-2 ${evento.atual ? 'bg-amber-50 border-amber-300' : 'bg-white border-slate-200'}`}>
                            <div className="flex items-center gap-2">
                              <span className={`w-2.5 h-2.5 rounded-full ${evento.atual ? 'bg-amber-500' : 'bg-slate-300'}`}></span>
                              <span className="font-medium text-slate-800">{evento.tipo}</span>
                            </div>
                            <span className="text-sm text-slate-500">{evento.data}</span>
                          </div>
                        ))}
                      </div>
                    ) : <div className="text-slate-500">Sem rastreabilidade detalhada.</div>}
                  </FieldBlock>
                  <FieldBlock label="Data do BG"><div className="font-semibold">{formatDate(registro.data_bg)}</div></FieldBlock>

                  {(registro.data_inicio || registro.data_termino || registro.data_retorno || registro.dias || registro.periodo_aquisitivo) && (
                    <FieldBlock label="Datas e Período">
                      <div className="space-y-1.5">
                        {registro.data_inicio && <p><span className="font-semibold">Início:</span> {formatDate(registro.data_inicio)}</p>}
                        {registro.data_termino && <p><span className="font-semibold">Término:</span> {formatDate(registro.data_termino)}</p>}
                        {registro.data_retorno && <p><span className="font-semibold">Retorno:</span> {formatDate(registro.data_retorno)}</p>}
                        {registro.dias && <p><span className="font-semibold">Dias:</span> {registro.dias}</p>}
                        {registro.periodo_aquisitivo && <p><span className="font-semibold">Período:</span> {registro.periodo_aquisitivo}</p>}
                      </div>
                    </FieldBlock>
                  )}

                  {(registro.funcao || registro.portaria || registro.tipo_punicao || registro.documento_referencia || registro.destino) && (
                    <FieldBlock label="Dados Específicos">
                      <div className="space-y-1.5">
                        {registro.funcao && <p><span className="font-semibold">Função:</span> {registro.funcao}</p>}
                        {registro.portaria && <p><span className="font-semibold">Portaria:</span> {registro.portaria}</p>}
                        {registro.tipo_punicao && <p><span className="font-semibold">Tipo Punição:</span> {registro.tipo_punicao}</p>}
                        {registro.documento_referencia && <p><span className="font-semibold">Documento:</span> {registro.documento_referencia}</p>}
                        {registro.destino && <p><span className="font-semibold">Destino:</span> {registro.destino}</p>}
                      </div>
                    </FieldBlock>
                  )}

                  {inconsistenciaContrato && (
                    <FieldBlock label="Inconsistência" className="border-red-200 bg-red-50">
                      <p className="font-semibold text-red-700">{inconsistenciaContrato.motivo_curto}</p>
                      {inconsistenciaContrato.detalhe && <p>{inconsistenciaContrato.detalhe}</p>}
                    </FieldBlock>
                  )}

                  {temFamilia && onVerFamilia && (
                    <FieldBlock label="Família de Publicação">
                      <Button variant="outline" onClick={onVerFamilia} className="w-full justify-start gap-2"><GitBranch className="w-4 h-4" />Ver vínculos da família</Button>
                    </FieldBlock>
                  )}

                  <FieldBlock label="Links e Integridade">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2"><Shield className="w-4 h-4 text-slate-500" />{integridadeBadge.label}</div>
                      {codigoPrincipal && <div className="flex items-center gap-2"><Link2 className="w-4 h-4 text-slate-500" />{codigoPrincipal}</div>}
                      <div className="flex items-center gap-2"><BadgeCheck className="w-4 h-4 text-slate-500" />Status: {registro.status_calculado || currentStatus}</div>
                      <div className="flex items-center gap-2"><FileBadge className="w-4 h-4 text-slate-500" />ID: {registro.id}</div>
                    </div>
                  </FieldBlock>
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </>
  );
}
