import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
  Stamp,
  XCircle,
  PenLine,
  Ban,
  GitBranch,
  Shield,
  BadgeCheck,
  Triangle
} from 'lucide-react';
import { format } from 'date-fns';
import { createPageUrl } from '@/utils';

const statusColors = {
  'Aguardando Nota': 'bg-amber-100 text-amber-700 border-amber-200',
  'Aguardando Publicação': 'bg-blue-100 text-blue-700 border-blue-200',
  'Publicado': 'bg-emerald-100 text-emerald-700 border-emerald-200'
};

function calcStatus(nota, numBg, dataBg) {
  if (numBg && dataBg) return 'Publicado';
  if (nota) return 'Aguardando Publicação';
  return 'Aguardando Nota';
}

function detectarOrigemTipo(registro) {
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



function getChainBadge(chainStatus) {
  if (chainStatus === 'ok') {
    return { icon: BadgeCheck, className: 'bg-emerald-100 text-emerald-800 border-emerald-200', label: 'Integridade OK' };
  }
  if (chainStatus === 'inconsistente') {
    return { icon: Triangle, className: 'bg-red-100 text-red-800 border-red-200', label: 'Inconsistente' };
  }
  return { icon: GitBranch, className: 'bg-slate-100 text-slate-700 border-slate-200', label: 'Sem Cadeia' };
}

function getEditUrl(registro) {
  const tipo = detectarOrigemTipo(registro);

  if (tipo === 'ex-officio') {
    return `${createPageUrl('CadastrarPublicacao')}?id=${registro.id}`;
  }

  if (tipo === 'atestado') {
    return `${createPageUrl('CadastrarAtestado')}?id=${registro.id}`;
  }

  return `${createPageUrl('CadastrarRegistroLivro')}?id=${registro.id}`;
}

export default function PublicacaoCard({ registro, onUpdate, onDelete, onVerFamilia, todosRegistros = [] }) {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditingBg, setIsEditingBg] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [bgData, setBgData] = useState({
    nota_para_bg: registro.nota_para_bg || '',
    numero_bg: registro.numero_bg || '',
    data_bg: registro.data_bg || '',
  });

  const origemTipo = detectarOrigemTipo(registro);
  const contratoLivro = origemTipo === 'livro';
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

  const isPublicado = currentStatus === 'Publicado';

  // foiApostilada só é verdadeiro se a Apostila vinculada ainda é válida (não foi TSE)
  // Tipo do registro: original, apostila ou TSE
  const isApostila = registro.tipo === 'Apostila';
  const isTSE = registro.tipo === 'Tornar sem Efeito';
  const isDerivado = isApostila || isTSE;

  const apostilaVinculada = registro.apostilada_por_id
    ? todosRegistros.find(r => r.id === registro.apostilada_por_id)
    : null;
  // Para Apostilas: verifica se a apostila vinculada ainda não foi tornada sem efeito
  const apostilaAindaValida = apostilaVinculada
    ? !apostilaVinculada.tornada_sem_efeito_por_id && !todosRegistros.find(r => r.tipo === 'Tornar sem Efeito' && r.publicacao_referencia_id === apostilaVinculada.id)
    : !!registro.apostilada_por_id;
  const foiApostilada = apostilaAindaValida;

  // Para Apostilas: verifica também se existe um TSE derivado em todosRegistros referenciando esta
  const tseDaApostila = isApostila
    ? todosRegistros.find(r => r.tipo === 'Tornar sem Efeito' && r.publicacao_referencia_id === registro.id)
    : null;
  const foiTornadaSemEfeito = !!registro.tornada_sem_efeito_por_id || !!tseDaApostila;
  const temFamilia = foiApostilada || foiTornadaSemEfeito || !!registro.publicacao_referencia_id;

  // Regras de ações por tipo:
  // 3.1 Original publicada e válida → Nota/BG + Apostila + TSE + Família
  // 3.2 Original já tornada sem efeito → Nota/BG + Família
  // 3.3 Apostila publicada → Nota/BG + TSE + Família (NÃO Apostila)
  // 3.4 TSE publicada → Nota/BG + Família (NÃO Apostila, NÃO TSE)
  const podeApostilar = isPublicado && !foiTornadaSemEfeito && !isDerivado;
  const podeTornarSemEfeito = isPublicado && !foiTornadaSemEfeito && (
    (!isDerivado) || // original válida
    (isApostila)    // apostila publicada também pode ser tornada sem efeito
  ) && !isTSE;     // TSE não pode ser tornada sem efeito
  const podeMarcarPrioridade = !isPublicado;
  const podeEditar = !isPublicado;
  const podeExcluir = !isPublicado;

  const liveStatus = calcStatus(
    bgData.nota_para_bg,
    bgData.numero_bg,
    bgData.data_bg
  );

  const tipoBase =
    registro.tipo_registro ||
    registro.tipo ||
    (registro.medico || registro.cid_10
      ? (registro.necessita_jiso ? 'Atestado - JISO' : 'Atestado - Homologação')
      : '') ||
    'Publicação';

  const tipoLabel = getTipoDisplay(tipoBase);
  const grupoLabel = registro.grupo_display || getGrupoDisplay(registro);
  const nomeInstitucional = [registro.militar_posto, registro.militar_quadro, registro.militar_nome_exibicao || registro.militar_nome]
    .filter(Boolean)
    .join(' ');
  const cadeiaStatus = registro?.inconsistencia_contrato?.status || (registro?.vinculos_contrato?.cadeia?.existe ? 'ok' : null);
  const chainBadge = getChainBadge(cadeiaStatus);
  const ChainIcon = chainBadge.icon;

  // Ver Atestado: Homologação de Atestado tem atestado_homologado_id; Ata JISO tem atestados_jiso_ids
  const atestadoLink = registro.atestado_homologado_id
    ? `${createPageUrl('VerAtestado')}?id=${registro.atestado_homologado_id}`
    : null;
  const atestadosJISOIds = registro.tipo === 'Ata JISO' && registro.atestados_jiso_ids?.length
    ? registro.atestados_jiso_ids
    : null;

  // Código funcional legível
  function gerarCodigo(id) {
    if (!id) return '—';
    return `PUB-${id.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(-4)}`;
  }

  const codigoPrincipal = registro.publicacao_referencia_id ? gerarCodigo(registro.publicacao_referencia_id) : null;
  const urlPrincipal = registro.publicacao_referencia_id
    ? `${createPageUrl('CadastrarPublicacao')}?id=${registro.publicacao_referencia_id}`
    : null;

  const formatDate = (d) => {
    if (!d) return '-';
    try {
      return format(new Date(d + 'T00:00:00'), 'dd/MM/yyyy');
    } catch {
      return d;
    }
  };

  const handleTogglePrioridade = (e, flag) => {
    e.stopPropagation();
    const newVal = !registro[flag];
    onUpdate(registro.id, { [flag]: newVal }, origemTipo);
  };

  const handleSaveBg = () => {
    const novoStatus = calcStatus(
      bgData.nota_para_bg,
      bgData.numero_bg,
      bgData.data_bg
    );

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
    onDelete(registro.id, origemTipo);
    setShowDeleteConfirm(false);
  };

  const handleApostila = () => {
    navigate(
      `${createPageUrl('CadastrarPublicacao')}?tipo=Apostila&militar_id=${registro.militar_id}&ref_id=${registro.id}&origem_tipo=${origemTipo}`
    );
  };

  const handleTornarSemEfeito = () => {
    navigate(
      `${createPageUrl('CadastrarPublicacao')}?tipo=Tornar+sem+Efeito&militar_id=${registro.militar_id}&ref_id=${registro.id}&origem_tipo=${origemTipo}`
    );
  };

  return (
    <>
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Esta publicação ainda não foi publicada oficialmente. A exclusão só deve ser permitida
              se não houver movimentações posteriores dependentes dela. Em fluxos encadeados, como
              férias, exclusões intermediárias podem causar inconsistências.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDelete}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card
        className={`rounded-xl border transition-all duration-200 ${
          isTSE
            ? 'border-red-200 bg-red-50/40'
            : isApostila && foiTornadaSemEfeito
              ? 'border-red-200 bg-red-50/30'
            : isApostila
              ? 'border-purple-200 bg-purple-50/40'
            : foiTornadaSemEfeito
              ? 'border-red-200 bg-red-50/30'
            : foiApostilada
              ? 'border-purple-200 bg-purple-50/30'
            : !isPublicado && registro.urgente
              ? 'border-red-400 bg-red-50'
            : !isPublicado && registro.importante
              ? 'border-amber-400 bg-amber-50'
            : 'border-slate-200'
        }`}
      >
        <CardHeader className="pb-3 px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 flex-1 min-w-0">
              <div className="hidden sm:flex h-12 w-12 rounded-full bg-slate-50 border border-slate-200 items-center justify-center text-slate-400 shrink-0">
                <Shield className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                {/* Badges de tipo derivado — discretas, antes do nome */}
                {isTSE && (
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                    <Ban className="w-3 h-3" />
                    TSE
                  </span>
                )}

                {isApostila && !foiTornadaSemEfeito && (
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                    <Stamp className="w-3 h-3" />
                    Apostila
                  </span>
                )}

                {/* Badge na Apostila tornada sem efeito */}
                {isApostila && foiTornadaSemEfeito && (
                  <>
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                      <Stamp className="w-3 h-3" />
                      Apostila
                    </span>
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-red-500 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                      <XCircle className="w-3 h-3" />
                      Sem Validade
                    </span>
                  </>
                )}

                {/* Badge na original: sem validade — discreta */}
                {!isDerivado && foiTornadaSemEfeito && (
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-red-500 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                    <XCircle className="w-3 h-3" />
                    Sem Validade
                  </span>
                )}

                {/* Badge na original: apostilada — discreta */}
                {!isDerivado && foiApostilada && !foiTornadaSemEfeito && (
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-purple-500 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                    <Stamp className="w-3 h-3" />
                    Apostilada
                  </span>
                )}

                {registro.urgente && !isPublicado && (
                  <span className="flex items-center gap-1 text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                    <AlertTriangle className="w-3 h-3" />
                    URGENTE
                  </span>
                )}

                {registro.importante && !registro.urgente && !isPublicado && (
                  <span className="flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                    <Star className="w-3 h-3" />
                    IMPORTANTE
                  </span>
                )}

                <h3 className="text-xl font-bold text-slate-900 tracking-tight leading-none truncate">
                  {nomeInstitucional || 'Militar não identificado'}
                </h3>

                <Badge className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border ${statusColors[currentStatus] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                  {currentStatus}
                </Badge>

                {contratoLivro && (
                  <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide border ${chainBadge.className}`}>
                    <ChainIcon className="w-3 h-3" />
                    {chainBadge.label}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5 text-sm text-slate-600">
                {registro.militar_matricula && (
                  <span className="font-medium text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">Mat: {registro.militar_matricula}</span>
                )}

                {grupoLabel === 'Férias' ? (
                  <span className="flex items-center gap-2 flex-wrap">
                    <Badge className="bg-cyan-100 text-cyan-700 border-cyan-200 uppercase text-[10px] tracking-wide">
                      Férias
                    </Badge>
                    <Badge className="bg-slate-100 text-slate-700 border-slate-200 uppercase text-[10px] tracking-wide">
                      {tipoLabel}
                    </Badge>
                  </span>
                ) : tipoLabel ? (
                  <span className="flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5" />
                    {tipoLabel}
                  </span>
                ) : null}

                <span className="flex items-center gap-1.5 font-medium">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  {formatDate(registro.data_registro || registro.data_publicacao)}
                </span>

                {registro.numero_bg && (
                  <span className="font-medium text-emerald-700">
                    BG Nº {registro.numero_bg}
                  </span>
                )}

                {atestadoLink && (
                  <a
                    href={atestadoLink}
                    className="flex items-center gap-1 text-blue-600 hover:underline"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(atestadoLink);
                    }}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Ver Atestado
                  </a>
                )}
                {atestadosJISOIds && (
                  atestadosJISOIds.length === 1 ? (
                    <a
                      href={`${createPageUrl('VerAtestado')}?id=${atestadosJISOIds[0]}`}
                      className="flex items-center gap-1 text-blue-600 hover:underline"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`${createPageUrl('VerAtestado')}?id=${atestadosJISOIds[0]}`);
                      }}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Ver Atestado
                    </a>
                  ) : (
                    <span className="flex items-center gap-1 text-blue-600 text-sm font-medium">
                      <ExternalLink className="w-3.5 h-3.5" />
                      {atestadosJISOIds.length} atestado(s) vinculado(s)
                    </span>
                  )
                )}
              </div>

              {/* Origem e Vínculos rápidos — derivadas mostram a principal; original mostra quem a afetou */}
              {isDerivado && codigoPrincipal && (
                <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs text-slate-400">Publicação principal:</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(urlPrincipal); }}
                    className="flex items-center gap-1 text-xs font-mono font-semibold text-[#1e3a5f] hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" />
                    {codigoPrincipal}
                  </button>
                </div>
              )}

              {((!isDerivado && (foiTornadaSemEfeito || foiApostilada)) || (isApostila && foiTornadaSemEfeito)) && (
                <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                  {!isDerivado && foiApostilada && registro.apostilada_por_id && (
                    <span className="flex items-center gap-1 text-[11px] text-slate-500 bg-purple-50 border border-purple-200 rounded px-2 py-0.5">
                      <Stamp className="w-3 h-3 text-purple-400" />
                      <span>Apostilada por:</span>
                      <span className="font-mono font-semibold text-purple-700">{gerarCodigo(registro.apostilada_por_id)}</span>
                    </span>
                  )}
                  {foiTornadaSemEfeito && registro.tornada_sem_efeito_por_id && (
                    <span className="flex items-center gap-1 text-[11px] text-slate-500 bg-red-50 border border-red-200 rounded px-2 py-0.5">
                      <XCircle className="w-3 h-3 text-red-400" />
                      <span>Sem efeito por:</span>
                      <span className="font-mono font-semibold text-red-600">{gerarCodigo(registro.tornada_sem_efeito_por_id)}</span>
                    </span>
                  )}
                  {isApostila && foiTornadaSemEfeito && tseDaApostila && !registro.tornada_sem_efeito_por_id && (
                    <span className="flex items-center gap-1 text-[11px] text-slate-500 bg-red-50 border border-red-200 rounded px-2 py-0.5">
                      <XCircle className="w-3 h-3 text-red-400" />
                      <span>Sem efeito por:</span>
                      <span className="font-mono font-semibold text-red-600">{gerarCodigo(tseDaApostila.id)}</span>
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              {podeMarcarPrioridade && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    title={registro.urgente ? 'Remover Urgente' : 'Marcar como Urgente'}
                    onClick={(e) => handleTogglePrioridade(e, 'urgente')}
                    className={`text-xs gap-1 ${
                      registro.urgente
                        ? 'text-red-600'
                        : 'text-slate-400 hover:text-red-500'
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    title={registro.importante ? 'Remover Importante' : 'Marcar como Importante'}
                    onClick={(e) => handleTogglePrioridade(e, 'importante')}
                    className={`text-xs gap-1 ${
                      registro.importante
                        ? 'text-amber-500'
                        : 'text-slate-400 hover:text-amber-500'
                    }`}
                  >
                    <Star className="w-4 h-4" />
                  </Button>
                </>
              )}

              {!isEditingBg && (
                <Button
                  variant="ghost"
                  size="sm"
                  title="Preencher Nota/BG"
                  onClick={() => {
                    setIsEditingBg(true);
                    setIsExpanded(true);
                  }}
                  className="text-slate-500 hover:text-blue-600 text-xs gap-1"
                >
                  <FileText className="w-4 h-4" />
                  <span className="hidden sm:inline">Nota/BG</span>
                </Button>
              )}

              {podeEditar && (
                <Button
                  variant="ghost"
                  size="sm"
                  title="Editar publicação"
                  onClick={() => navigate(getEditUrl(registro))}
                  className="text-slate-500 hover:text-[#1e3a5f] text-xs gap-1"
                >
                  <Edit2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Editar</span>
                </Button>
              )}

              {podeApostilar && (
                <Button
                  variant="ghost"
                  size="sm"
                  title="Fazer Apostila"
                  onClick={handleApostila}
                  className="text-purple-500 hover:text-purple-700 text-xs gap-1"
                >
                  <PenLine className="w-4 h-4" />
                  <span className="hidden sm:inline">Apostila</span>
                </Button>
              )}

              {podeTornarSemEfeito && (
                <Button
                  variant="ghost"
                  size="sm"
                  title="Tornar sem Efeito"
                  onClick={handleTornarSemEfeito}
                  className="text-red-500 hover:text-red-700 text-xs gap-1"
                >
                  <Ban className="w-4 h-4" />
                  <span className="hidden sm:inline">Tornar s/ Efeito</span>
                </Button>
              )}

              {podeExcluir && (
                <Button
                  variant="ghost"
                  size="sm"
                  title="Excluir"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-slate-500 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}

              {temFamilia && onVerFamilia && (
                <Button
                  variant="ghost"
                  size="sm"
                  title="Ver família da publicação"
                  onClick={onVerFamilia}
                  className="text-[#1e3a5f] hover:text-[#1e3a5f] hover:bg-[#1e3a5f]/10 text-xs gap-1"
                >
                  <GitBranch className="w-4 h-4" />
                  <span className="hidden sm:inline">Família</span>
                </Button>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
        </CardHeader>

        {isExpanded && (
          <CardContent className="pt-0 px-6 pb-5 border-t border-slate-100">
            {isEditingBg ? (
              <div className="mt-4 space-y-3 bg-blue-50 p-4 rounded-lg border border-blue-100">
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
                  Preencher Nota / BG
                </p>

                <div>
                  <Label className="text-sm font-medium">Nota para BG</Label>
                  <Input
                    value={bgData.nota_para_bg}
                    onChange={(e) =>
                      setBgData((d) => ({ ...d, nota_para_bg: e.target.value }))
                    }
                    className="mt-1 bg-white"
                    placeholder="Ex: 001/2025"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm font-medium">Número do BG</Label>
                    <Input
                      value={bgData.numero_bg}
                      onChange={(e) =>
                        setBgData((d) => ({ ...d, numero_bg: e.target.value }))
                      }
                      className="mt-1 bg-white"
                      placeholder="Ex: 045/2025"
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Data do BG</Label>
                    <Input
                      type="date"
                      value={bgData.data_bg}
                      onChange={(e) =>
                        setBgData((d) => ({ ...d, data_bg: e.target.value }))
                      }
                      className="mt-1 bg-white"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge className={`${statusColors[liveStatus]} text-xs`}>
                    → {liveStatus}
                  </Badge>
                  <span className="text-xs text-slate-500">status resultante</span>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleSaveBg}
                    className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
                  >
                    <Save className="w-4 h-4 mr-1" />
                    Salvar
                  </Button>

                  <Button size="sm" variant="outline" onClick={handleCancelBg}>
                    <X className="w-4 h-4 mr-1" />
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-3 gap-4 text-sm bg-slate-50 rounded-lg border border-slate-100 p-3">


                {contratoLivro && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div className="p-3 rounded-lg border bg-slate-50">
                        <p className="text-xs text-slate-400 uppercase tracking-wide">Origem</p>
                        <p className="font-medium text-slate-700">{registro.origem || '—'}</p>
                      </div>
                      <div className="p-3 rounded-lg border bg-slate-50">
                        <p className="text-xs text-slate-400 uppercase tracking-wide">Data (Contrato)</p>
                        <p className="font-medium text-slate-700">{registro.data_display || formatDate(registro.data_registro)}</p>
                      </div>
                    </div>

                    {detalhesContrato && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Identificação do Ato</p>
                        <div className="p-3 bg-slate-50 rounded-lg border text-sm text-slate-700 space-y-1">
                          {detalhesContrato.observacoes && <p><span className="font-medium">Observações:</span> {detalhesContrato.observacoes}</p>}
                          {detalhesContrato.criado_em && <p><span className="font-medium">Criado em:</span> {detalhesContrato.criado_em}</p>}
                          {detalhesContrato.atualizado_em && <p><span className="font-medium">Atualizado em:</span> {detalhesContrato.atualizado_em}</p>}
                        </div>
                      </div>
                    )}

                    {vinculosContrato && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Origem e Vínculos</p>
                        <div className="p-3 bg-slate-50 rounded-lg border text-sm text-slate-700 space-y-1">
                          <p><span className="font-medium">Férias:</span> {vinculosContrato?.ferias?.label || '—'}</p>
                          <p><span className="font-medium">Período:</span> {vinculosContrato?.periodo?.label || '—'}</p>
                          <p><span className="font-medium">Cadeia:</span> {vinculosContrato?.cadeia?.existe ? `${vinculosContrato.cadeia.total_eventos} evento(s)` : 'Sem cadeia'}</p>
                        </div>
                      </div>
                    )}

                    {publicacaoContrato && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Texto da Publicação</p>
                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 text-sm text-slate-700 space-y-1">
                          <p><span className="font-medium">Status:</span> {publicacaoContrato.status || '—'}</p>
                          <p><span className="font-medium">Nota:</span> {publicacaoContrato.nota_para_bg || '—'}</p>
                          <p><span className="font-medium">BG:</span> {publicacaoContrato.numero_bg || '—'}</p>
                          <p><span className="font-medium">Data BG:</span> {formatDate(publicacaoContrato.data_bg)}</p>
                          {publicacaoContrato.texto && <p><span className="font-medium">Texto:</span> {publicacaoContrato.texto}</p>}
                        </div>
                      </div>
                    )}

                    {inconsistenciaContrato && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Estado da Cadeia de Férias</p>
                        <div className="p-3 bg-red-50 rounded-lg border border-red-100 text-sm text-slate-700">
                          <p className="font-medium text-red-700">{inconsistenciaContrato.motivo_curto}</p>
                          {inconsistenciaContrato.detalhe && <p>{inconsistenciaContrato.detalhe}</p>}
                        </div>
                      </div>
                    )}

                    {cadeiaEventosContrato.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Rastreabilidade</p>
                        <div className="p-3 bg-slate-50 rounded-lg border text-sm text-slate-700 space-y-1">
                          {cadeiaEventosContrato.map((evento) => (
                            <p key={evento.id}>
                              {evento.atual ? '• ' : '- '} {evento.tipo} ({evento.data})
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide">
                      Nota para BG
                    </p>
                    <p className="font-semibold mt-0.5 text-slate-800">
                      {registro.nota_para_bg || '—'}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide">
                      Número do BG
                    </p>
                    <p className="font-semibold mt-0.5 text-slate-800">
                      {registro.numero_bg || '—'}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide">
                      Data do BG
                    </p>
                    <p className="font-semibold mt-0.5 text-slate-800">
                      {formatDate(registro.data_bg)}
                    </p>
                  </div>
                </div>

                {(registro.data_inicio ||
                  registro.data_termino ||
                  registro.data_retorno ||
                  registro.dias ||
                  registro.periodo_aquisitivo ||
                  registro.data_designacao ||
                  registro.data_melhoria ||
                  registro.data_punicao) && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      Datas e Período
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                      {registro.data_inicio && (
                        <div>
                          <p className="text-xs text-slate-400">Data Início</p>
                          <p className="font-medium text-slate-700">
                            {formatDate(registro.data_inicio)}
                          </p>
                        </div>
                      )}

                      {registro.data_termino && (
                        <div>
                          <p className="text-xs text-slate-400">Data Término</p>
                          <p className="font-medium text-slate-700">
                            {formatDate(registro.data_termino)}
                          </p>
                        </div>
                      )}

                      {registro.data_retorno && (
                        <div>
                          <p className="text-xs text-slate-400">Data Retorno</p>
                          <p className="font-medium text-slate-700">
                            {formatDate(registro.data_retorno)}
                          </p>
                        </div>
                      )}

                      {registro.dias && (
                        <div>
                          <p className="text-xs text-slate-400">Dias</p>
                          <p className="font-medium text-slate-700">
                            {registro.dias} dias
                          </p>
                        </div>
                      )}

                      {registro.periodo_aquisitivo && (
                        <div>
                          <p className="text-xs text-slate-400">Período Aquisitivo</p>
                          <p className="font-medium text-slate-700">
                            {registro.periodo_aquisitivo}
                          </p>
                        </div>
                      )}

                      {registro.data_designacao && (
                        <div>
                          <p className="text-xs text-slate-400">Data Designação</p>
                          <p className="font-medium text-slate-700">
                            {formatDate(registro.data_designacao)}
                          </p>
                        </div>
                      )}

                      {registro.data_melhoria && (
                        <div>
                          <p className="text-xs text-slate-400">Data Melhoria</p>
                          <p className="font-medium text-slate-700">
                            {formatDate(registro.data_melhoria)}
                          </p>
                        </div>
                      )}

                      {registro.data_punicao && (
                        <div>
                          <p className="text-xs text-slate-400">Data Punição</p>
                          <p className="font-medium text-slate-700">
                            {formatDate(registro.data_punicao)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {(registro.funcao ||
                  registro.portaria ||
                  registro.tipo_punicao ||
                  registro.dias_punicao ||
                  registro.comportamento_atual ||
                  registro.comportamento_ingresso ||
                  registro.graduacao_punicao ||
                  registro.documento_referencia ||
                  registro.origem ||
                  registro.destino) && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      Dados Específicos
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                      {registro.funcao && (
                        <div>
                          <p className="text-xs text-slate-400">Função</p>
                          <p className="font-medium text-slate-700">{registro.funcao}</p>
                        </div>
                      )}

                      {registro.portaria && (
                        <div>
                          <p className="text-xs text-slate-400">Portaria</p>
                          <p className="font-medium text-slate-700">{registro.portaria}</p>
                        </div>
                      )}

                      {registro.tipo_punicao && (
                        <div>
                          <p className="text-xs text-slate-400">Tipo Punição</p>
                          <p className="font-medium text-slate-700">{registro.tipo_punicao}</p>
                        </div>
                      )}

                      {registro.dias_punicao && (
                        <div>
                          <p className="text-xs text-slate-400">Dias Punição</p>
                          <p className="font-medium text-slate-700">{registro.dias_punicao} dias</p>
                        </div>
                      )}

                      {registro.comportamento_atual && (
                        <div>
                          <p className="text-xs text-slate-400">Comportamento Atual</p>
                          <p className="font-medium text-slate-700">{registro.comportamento_atual}</p>
                        </div>
                      )}

                      {registro.comportamento_ingresso && (
                        <div>
                          <p className="text-xs text-slate-400">Comportamento Ingresso</p>
                          <p className="font-medium text-slate-700">{registro.comportamento_ingresso}</p>
                        </div>
                      )}

                      {registro.graduacao_punicao && (
                        <div>
                          <p className="text-xs text-slate-400">Graduação Punição</p>
                          <p className="font-medium text-slate-700">{registro.graduacao_punicao}</p>
                        </div>
                      )}

                      {registro.documento_referencia && (
                        <div>
                          <p className="text-xs text-slate-400">Documento</p>
                          <p className="font-medium text-slate-700">{registro.documento_referencia}</p>
                        </div>
                      )}

                      {registro.origem && (
                        <div>
                          <p className="text-xs text-slate-400">Origem</p>
                          <p className="font-medium text-slate-700">{registro.origem}</p>
                        </div>
                      )}

                      {registro.destino && (
                        <div>
                          <p className="text-xs text-slate-400">Destino</p>
                          <p className="font-medium text-slate-700">{registro.destino}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {registro.texto_publicacao && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                      Texto para Publicação
                    </p>
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {registro.texto_publicacao}
                    </div>
                  </div>
                )}

                {registro.observacoes && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                      Observações
                    </p>
                    <div className="p-3 bg-amber-50 rounded-lg border border-amber-100 text-sm text-slate-700">
                      {registro.observacoes}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </>
  );
}