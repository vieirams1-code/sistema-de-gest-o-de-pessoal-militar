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
  FileText,
  FileBadge,
  User,
  Link2
} from 'lucide-react';
import { format } from 'date-fns';
import { createPageUrl } from '@/utils';

const statusColors = {
  'Aguardando Nota': 'bg-amber-100 text-amber-800 border-amber-200',
  'Aguardando Publicação': 'bg-blue-100 text-blue-800 border-blue-200',
  'Publicado': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'Inconsistente': 'bg-red-100 text-red-800 border-red-200',
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
  const tipoBase = registro?.tipo_registro || registro?.tipo || '';

  if (
    tipoBase === 'Saída Férias' ||
    tipoBase === 'Interrupção de Férias' ||
    tipoBase === 'Nova Saída / Retomada' ||
    tipoBase === 'Retorno Férias'
  ) {
    return 'Férias';
  }

  if (registro?.medico || registro?.cid_10) {
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

  return `${createPageUrl('CadastrarRegistroLivro')}?id=${registro.id}`;
}

function formatDate(d) {
  if (!d) return '-';
  try {
    if (d.includes('T')) return format(new Date(d), 'dd/MM/yyyy');
    return format(new Date(d + 'T00:00:00'), 'dd/MM/yyyy');
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
  if (registro.status_calculado === 'Inconsistente' || registro.integridade_status === 'inconsistente' || registro.inconsistencia_contrato?.motivo_curto) {
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

  const tipoLabel = registro.tipo_display || getTipoDisplay(tipoBase);
  const grupoLabel = registro.grupo_display || getGrupoDisplay(registro);

  const codigoPrincipal = registro.publicacao_referencia_id ? gerarCodigo(registro.publicacao_referencia_id) : null;

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

  const tipoChipClasses = getActBadgeClasses(grupoLabel, tipoLabel);
  const integridadeBadge = getIntegridadeBadge(registro);
  const nomeInstitucional = registro.militar_nome_institucional || registro.militar_nome || 'Militar';
  const dataHeader = formatDate(registro.data_registro || registro.created_date || registro.data_inicio);
  const textoPublicacao = publicacaoContrato?.texto || registro.texto_publicacao || 'Sem texto gerado.';
  const origemLabel = contratoLivro ? (registro.origem || 'Automática') : (origemTipo === 'ex-officio' ? 'Ex Officio' : origemTipo === 'atestado' ? 'Atestado' : 'Manual');

  return (
    <>
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Esta publicação será excluída. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
            <div className="flex items-start gap-4 min-w-0">
              <div className="w-14 h-14 rounded-full border-2 border-slate-200 bg-slate-50 flex items-center justify-center text-slate-400 shrink-0">
                <User className="w-7 h-7" />
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5 mb-2">
                  <h3 className="text-[2rem] leading-none font-bold text-slate-900 tracking-tight">
                    {nomeInstitucional}
                  </h3>

                  <Badge className={`border ${statusColors[registro.status_calculado] || statusColors[currentStatus] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                    {registro.status_calculado || currentStatus}
                  </Badge>

                  <Badge className={`border ${integridadeBadge.className}`}>
                    {integridadeBadge.label}
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                  <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-semibold">
                    MAT: {registro.militar_matricula || '—'}
                  </span>

                  {grupoLabel && (
                    <Badge className={`border ${tipoChipClasses}`}>
                      {grupoLabel.toUpperCase()}
                    </Badge>
                  )}

                  <Badge className={`border ${tipoChipClasses}`}>
                    {tipoLabel.toUpperCase()}
                  </Badge>

                  <span className="inline-flex items-center gap-1.5 text-slate-500 font-medium">
                    <Calendar className="w-4 h-4" />
                    {dataHeader}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center flex-wrap gap-3 xl:justify-end">
              {registro.status_calculado === 'Inconsistente' && (
                <button
                  className="text-slate-400 hover:text-amber-600 transition-colors"
                  title={registro.integridade_mensagem || 'Inconsistência detectada'}
                >
                  <AlertTriangle className="w-5 h-5" />
                </button>
              )}

              {podeMarcarPrioridade && (
                <button
                  onClick={(e) => handleTogglePrioridade(e, 'prioritario')}
                  className={`text-slate-400 hover:text-amber-500 transition-colors ${registro.prioritario ? 'text-amber-500' : ''}`}
                  title="Marcar prioridade"
                >
                  <Star className="w-5 h-5" />
                </button>
              )}

              {temFamilia && (
                <Button variant="ghost" size="sm" className="text-slate-700" onClick={onVerFamilia}>
                  <GitBranch className="w-4 h-4 mr-1" />
                  Família
                </Button>
              )}

              <Button variant="ghost" size="sm" className="text-slate-700">
                <FileBadge className="w-4 h-4 mr-1" />
                Nota/BG
              </Button>

              {podeEditar && (
                <Button variant="ghost" size="sm" className="text-slate-700" onClick={() => navigate(getEditUrl(registro))}>
                  <Edit2 className="w-4 h-4 mr-1" />
                  Editar
                </Button>
              )}

              {podeExcluir && (
                <button
                  className="text-red-500 hover:text-red-600 transition-colors"
                  onClick={() => setShowDeleteConfirm(true)}
                  title="Excluir"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}

              <Button
                variant="outline"
                size="icon"
                className="rounded-lg border-slate-300"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>

        {isExpanded && (
          <CardContent className="p-5">
            <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-6">
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FieldBlock label="Origem">
                    <div className="text-2xl font-semibold text-slate-900">{origemLabel}</div>
                  </FieldBlock>

                  <FieldBlock label="Data (Contrato)">
                    <div className="space-y-1">
                      <div className="font-semibold text-slate-900">{formatDate(registro.data_registro || registro.data_inicio)}</div>
                      {(registro.data_fim || registro.data_termino) && (
                        <div className="font-semibold text-slate-700">{formatDate(registro.data_fim || registro.data_termino)}</div>
                      )}
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
                    <p><span className="font-semibold">Período:</span> {vinculosContrato?.periodo?.label || registro.periodo_aquisitivo || '—'}</p>
                    <p><span className="font-semibold">Cadeia:</span> {vinculosContrato?.cadeia?.existe ? `${vinculosContrato.cadeia.total_eventos} evento(s)` : (cadeiaEventosContrato.length ? `${cadeiaEventosContrato.length} evento(s)` : 'Sem cadeia')}</p>
                    {codigoPrincipal && <p><span className="font-semibold">Código principal:</span> {codigoPrincipal}</p>}
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
                  <FieldBlock label="Observações" className="bg-amber-50 border-amber-200">
                    {registro.observacoes}
                  </FieldBlock>
                )}

                {isEditingBg ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
                    <div>
                      <Label className="text-sm font-medium">Nota para BG</Label>
                      <Input
                        value={bgData.nota_para_bg}
                        onChange={(e) => setBgData((d) => ({ ...d, nota_para_bg: e.target.value }))}
                        className="mt-1 bg-white"
                        placeholder="Ex: 001/2026"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-sm font-medium">Número do BG</Label>
                        <Input
                          value={bgData.numero_bg}
                          onChange={(e) => setBgData((d) => ({ ...d, numero_bg: e.target.value }))}
                          className="mt-1 bg-white"
                          placeholder="Ex: 045/2026"
                        />
                      </div>

                      <div>
                        <Label className="text-sm font-medium">Data do BG</Label>
                        <Input
                          type="date"
                          value={bgData.data_bg}
                          onChange={(e) => setBgData((d) => ({ ...d, data_bg: e.target.value }))}
                          className="mt-1 bg-white"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge className={`${statusColors[liveStatus]} border`}>
                        {liveStatus}
                      </Badge>
                      <span className="text-xs text-slate-500">status resultante</span>
                    </div>

                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSaveBg} className="bg-[#1e3a5f] hover:bg-[#28486d]">
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
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => setIsEditingBg(true)}>
                      <PenLine className="w-4 h-4 mr-1" />
                      Editar Nota/BG
                    </Button>

                    {podeApostilar && (
                      <Button variant="outline" size="sm" onClick={handleApostila}>
                        <Stamp className="w-4 h-4 mr-1" />
                        Apostila
                      </Button>
                    )}

                    {podeTornarSemEfeito && (
                      <Button variant="outline" size="sm" onClick={handleTornarSemEfeito}>
                        <Ban className="w-4 h-4 mr-1" />
                        Tornar sem Efeito
                      </Button>
                    )}

                    <Button variant="outline" size="sm" onClick={() => navigate(getEditUrl(registro))}>
                      <ExternalLink className="w-4 h-4 mr-1" />
                      Abrir Origem
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-5">
                <FieldBlock label="Nota para BG">
                  <div className="text-xl font-semibold text-slate-900">{registro.nota_para_bg || '—'}</div>
                </FieldBlock>

                <FieldBlock label="Número do BG">
                  <div className="text-xl font-semibold text-slate-900">{registro.numero_bg || '—'}</div>
                </FieldBlock>

                <FieldBlock label="Rastreabilidade">
                  {cadeiaEventosContrato.length > 0 ? (
                    <div className="space-y-2">
                      {cadeiaEventosContrato.map((evento) => (
                        <div
                          key={evento.id}
                          className={`flex items-center justify-between rounded-lg border px-3 py-2 ${evento.atual ? 'bg-amber-50 border-amber-300' : 'bg-white border-slate-200'}`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full ${evento.atual ? 'bg-amber-500' : 'bg-slate-300'}`}></span>
                            <span className="font-medium text-slate-800">{evento.tipo}</span>
                          </div>
                          <span className="text-sm text-slate-500">{evento.data}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-slate-500">Sem rastreabilidade detalhada.</div>
                  )}
                </FieldBlock>

                <FieldBlock label="Data do BG">
                  <div className="text-xl font-semibold text-slate-900">{formatDate(registro.data_bg)}</div>
                </FieldBlock>

                <FieldBlock label="Datas e Período">
                  <div className="space-y-2">
                    {registro.dias && <p><span className="font-semibold">Dias:</span> {registro.dias} dias</p>}
                    {registro.periodo_aquisitivo && <p><span className="font-semibold">Período Aquisitivo:</span> {registro.periodo_aquisitivo}</p>}
                    {registro.data_inicio && <p><span className="font-semibold">Data Início:</span> {formatDate(registro.data_inicio)}</p>}
                    {registro.data_termino && <p><span className="font-semibold">Data Término:</span> {formatDate(registro.data_termino)}</p>}
                    {registro.data_retorno && <p><span className="font-semibold">Data Retorno:</span> {formatDate(registro.data_retorno)}</p>}
                  </div>
                </FieldBlock>

                <FieldBlock label="Dados Específicos">
                  <div className="space-y-2">
                    {registro.origem && <p><span className="font-semibold">Origem:</span> {registro.origem}</p>}
                    {registro.destino && <p><span className="font-semibold">Destino:</span> {registro.destino}</p>}
                    {registro.funcao && <p><span className="font-semibold">Função:</span> {registro.funcao}</p>}
                    {registro.portaria && <p><span className="font-semibold">Portaria:</span> {registro.portaria}</p>}
                    {registro.tipo_punicao && <p><span className="font-semibold">Tipo Punição:</span> {registro.tipo_punicao}</p>}
                    {registro.dias_punicao && <p><span className="font-semibold">Dias Punição:</span> {registro.dias_punicao} dias</p>}
                    {!registro.origem && !registro.destino && !registro.funcao && !registro.portaria && !registro.tipo_punicao && !registro.dias_punicao && (
                      <div className="text-slate-500">—</div>
                    )}
                  </div>
                </FieldBlock>

                {inconsistenciaContrato && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-red-500 mb-2">Inconsistência</p>
                    <p className="font-semibold text-red-700">{inconsistenciaContrato.motivo_curto}</p>
                    {inconsistenciaContrato.detalhe && (
                      <p className="text-sm text-red-700 mt-1">{inconsistenciaContrato.detalhe}</p>
                    )}
                  </div>
                )}

                {(foiApostilada || foiTornadaSemEfeito) && (
                  <div className="flex flex-wrap gap-2">
                    {foiApostilada && (
                      <Badge className="bg-purple-100 text-purple-800 border border-purple-200">
                        <Stamp className="w-3.5 h-3.5 mr-1" />
                        Apostilada
                      </Badge>
                    )}
                    {foiTornadaSemEfeito && (
                      <Badge className="bg-red-100 text-red-800 border border-red-200">
                        <XCircle className="w-3.5 h-3.5 mr-1" />
                        Tornada sem efeito
                      </Badge>
                    )}
                  </div>
                )}

                {temFamilia && (
                  <Button variant="outline" className="w-full justify-center" onClick={onVerFamilia}>
                    <GitBranch className="w-4 h-4 mr-2" />
                    Ver Família de Publicação
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </>
  );
}