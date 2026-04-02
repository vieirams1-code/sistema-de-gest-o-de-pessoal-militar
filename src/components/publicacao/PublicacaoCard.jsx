import React, { useState } from 'react';
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
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, ArrowLeft, ArrowRight, Calendar, ChevronDown, ChevronUp, FileText, Pause, Save, Shield, Trash2, X } from 'lucide-react';
import { format } from 'date-fns';
import { getRPTipoLabel } from '@/components/rp/rpTiposConfig';
import {
  calcularStatusPublicacaoRegistro,
  EVENTO_AUDITORIA_PUBLICACAO,
  STATUS_PUBLICACAO,
} from '@/components/publicacao/publicacaoStateMachine';

const statusColors = {
  'Aguardando Nota': 'bg-amber-100 text-amber-700 border-amber-200',
  'Aguardando Publicação': 'bg-blue-100 text-blue-700 border-blue-200',
  'Publicado': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Inconsistente': 'bg-red-100 text-red-700 border-red-200',
};

function detectarOrigemTipo(registro) {
  if (registro.tipo && !registro.tipo_registro && !registro.medico && !registro.cid_10) return 'ex-officio';
  if (registro.medico || registro.cid_10) return 'atestado';
  return 'livro';
}

function getTipoDisplay(tipo) {
  if (tipo === 'Saída Férias') return 'Início';
  if (tipo === 'Interrupção de Férias') return 'Interrupção';
  if (tipo === 'Nova Saída / Retomada') return 'Continuação';
  if (tipo === 'Retorno Férias') return 'Término';
  return getRPTipoLabel(tipo);
}

function getTipoVisual(tipo) {
  const tipoBase = String(tipo || '').toLowerCase();

  if (tipoBase.includes('saída férias') || tipoBase.includes('inicio de férias') || tipoBase.includes('início de férias')) {
    return { icon: ArrowRight, label: 'Início de Férias', className: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
  }
  if (tipoBase.includes('retorno férias') || tipoBase.includes('término de férias') || tipoBase.includes('termino de férias')) {
    return { icon: ArrowLeft, label: 'Término de Férias', className: 'text-amber-700 bg-amber-50 border-amber-200' };
  }
  if (tipoBase.includes('interrupção de férias') || tipoBase.includes('interrupcao de férias')) {
    return { icon: Pause, label: 'Interrupção de Férias', className: 'text-orange-700 bg-orange-50 border-orange-200' };
  }
  if (tipoBase.includes('nova saída') || tipoBase.includes('retomada') || tipoBase.includes('continuação')) {
    return { icon: ArrowRight, label: 'Continuação de Férias', className: 'text-sky-700 bg-sky-50 border-sky-200' };
  }
  return { icon: Shield, label: getTipoDisplay(tipo), className: 'text-slate-700 bg-slate-50 border-slate-200' };
}

function formatDate(value) {
  if (!value) return '-';
  try {
    if (String(value).includes('T')) return format(new Date(value), 'dd/MM/yyyy');
    return format(new Date(`${value}T00:00:00`), 'dd/MM/yyyy');
  } catch {
    return String(value);
  }
}


function formatDateTime(value) {
  if (!value) return '-';
  try {
    return format(new Date(value), 'dd/MM/yyyy HH:mm');
  } catch {
    return String(value);
  }
}

function getHistoricoPublicacao(registro) {
  const historico = Array.isArray(registro?.historico_publicacao) ? registro.historico_publicacao : [];
  return [...historico].sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
}

function getBloqueiosOperacionais(registro) {
  return getHistoricoPublicacao(registro).filter(
    (evento) => (evento?.evento || evento?.acao) === EVENTO_AUDITORIA_PUBLICACAO.BLOQUEIO
  );
}

export default function PublicacaoCard({ registro, onUpdate, onDelete, onVerFamilia, canAccessAction = () => false, modoAdmin = false, isAdmin = false }) {
  const [isEditingBg, setIsEditingBg] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showTextoPublicacao, setShowTextoPublicacao] = useState(false);
  const [showHistorico, setShowHistorico] = useState(false);
  const [bgData, setBgData] = useState({
    nota_para_bg: registro.nota_para_bg || '',
    numero_bg: registro.numero_bg || '',
    data_bg: registro.data_bg || '',
  });

  const origemTipo = detectarOrigemTipo(registro);
  const currentStatus = registro.status_calculado || calcularStatusPublicacaoRegistro(registro);
  const tipoVisual = getTipoVisual(registro.tipo_registro || registro.tipo || '');
  const TipoIcon = tipoVisual.icon;
  const isPublicado = currentStatus === STATUS_PUBLICACAO.PUBLICADO;
  const podePublicarBg = canAccessAction('publicar_bg') || canAccessAction('admin_mode');
  const podeInformarBg = !isPublicado && (
    currentStatus === STATUS_PUBLICACAO.AGUARDANDO_NOTA ||
    currentStatus === STATUS_PUBLICACAO.AGUARDANDO_PUBLICACAO
  );
  const podeExcluir = !isPublicado && canAccessAction('admin_mode') && modoAdmin;
  const podeExcluirDesabilitado = !isPublicado && canAccessAction('admin_mode') && !modoAdmin;
  const historicoPublicacao = getHistoricoPublicacao(registro);
  const bloqueiosOperacionais = getBloqueiosOperacionais(registro);
  const ultimoBloqueio = bloqueiosOperacionais[0] || null;

  const handleSaveBg = () => {
    onUpdate(registro.id, bgData, origemTipo);
    setIsEditingBg(false);
  };

  return (
    <Card className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-slate-900">{registro.militar_nome_institucional || registro.militar_nome || 'Sem militar'}</h3>
            <p className="text-sm text-slate-500">{registro.militar_nome_guerra || 'Sem nome de guerra'}</p>
            <div className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold ${tipoVisual.className}`}>
              <TipoIcon className="h-3.5 w-3.5" />
              <span>{tipoVisual.label}</span>
            </div>
          </div>
          <Badge className={statusColors[registro.status_calculado || currentStatus] || statusColors[currentStatus]}>
            {registro.status_calculado || currentStatus}
          </Badge>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-500">Nota para BG</p>
            <p className="text-sm text-slate-800 whitespace-pre-wrap">{registro.nota_para_bg || '—'}</p>
          </div>
          <div className="rounded-lg border bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-500">Número BG</p>
            <p className="text-sm text-slate-800">{registro.numero_bg || '—'}</p>
          </div>
          <div className="rounded-lg border bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-500">Data BG</p>
            <p className="text-sm text-slate-800">{formatDate(registro.data_bg)}</p>
          </div>
        </div>

        {bloqueiosOperacionais.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-700" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                  Bloqueio operacional registrado ({bloqueiosOperacionais.length})
                </p>
                <p className="mt-1 text-sm text-amber-900">
                  {ultimoBloqueio?.resumo || 'Há tentativa bloqueada no fluxo. Consulte o histórico para detalhes.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {isEditingBg && (
          <div className="grid gap-3 rounded-lg border bg-slate-50 p-4 md:grid-cols-3">
            <div className="md:col-span-3">
              <Label>Nota para BG</Label>
              <Input value={bgData.nota_para_bg} onChange={(e) => setBgData((v) => ({ ...v, nota_para_bg: e.target.value }))} />
            </div>
            <div>
              <Label>Número BG</Label>
              <Input value={bgData.numero_bg} onChange={(e) => setBgData((v) => ({ ...v, numero_bg: e.target.value }))} />
            </div>
            <div>
              <Label>Data BG</Label>
              <Input type="date" value={bgData.data_bg} onChange={(e) => setBgData((v) => ({ ...v, data_bg: e.target.value }))} />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={handleSaveBg}><Save className="mr-2 h-4 w-4" />Salvar</Button>
              <Button variant="outline" onClick={() => setIsEditingBg(false)}><X className="mr-2 h-4 w-4" />Cancelar</Button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {podeInformarBg && !isEditingBg && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditingBg(true)}
              disabled={!podePublicarBg}
              title={!podePublicarBg ? 'Ação negada: você não tem permissão para informar BG.' : ''}
            >
              <Calendar className="mr-2 h-4 w-4" /> Informar BG
            </Button>
          )}
          {onVerFamilia && (
            <Button variant="outline" size="sm" onClick={onVerFamilia}>
              <FileText className="mr-2 h-4 w-4" /> Família
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowTextoPublicacao((prev) => !prev)}>
            {showTextoPublicacao ? <ChevronUp className="mr-2 h-4 w-4" /> : <ChevronDown className="mr-2 h-4 w-4" />}
            {showTextoPublicacao ? 'Recolher texto' : 'Expandir texto'}
          </Button>
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => setShowHistorico((prev) => !prev)}>
              {showHistorico ? <ChevronUp className="mr-2 h-4 w-4" /> : <ChevronDown className="mr-2 h-4 w-4" />}
              {showHistorico ? 'Ocultar histórico' : 'Histórico'}
            </Button>
          )}
          {podeExcluir && (
            <Button variant="destructive" size="sm" onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 className="mr-2 h-4 w-4" /> Excluir
            </Button>
          )}
          {podeExcluirDesabilitado && (
            <Button variant="outline" size="sm" disabled title="Ative o modo admin para excluir.">
              <Trash2 className="mr-2 h-4 w-4" /> Excluir
            </Button>
          )}
        </div>

        {showTextoPublicacao && (
          <div className="rounded-lg border bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-500">Texto para publicação</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">
              {registro.texto_publicacao || 'Nenhum texto de publicação gerado para este registro.'}
            </p>
          </div>
        )}

        {isAdmin && showHistorico && (
          <div className="rounded-lg border bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-500">Trilha de auditoria</p>
            {historicoPublicacao.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Nenhum evento registrado até o momento.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {historicoPublicacao.slice(0, 8).map((evento) => (
                  <div key={evento.id || `${evento.timestamp}-${evento.evento}`} className="rounded-md border bg-white p-2 text-xs text-slate-700">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-slate-800">{evento.evento || evento.acao || 'evento'}</span>
                      <span className="text-slate-500">{formatDateTime(evento.timestamp)}</span>
                    </div>
                    {(evento.estado_anterior || evento.estado_novo) && (
                      <p className="mt-1 text-slate-600">{evento.estado_anterior || '—'} → {evento.estado_novo || '—'}</p>
                    )}
                    <p className="mt-1 text-slate-600">{evento.resumo || 'Sem resumo.'}</p>
                    {(evento.antes || evento.depois) && (
                      <div className="mt-1 rounded border border-slate-100 bg-slate-50 p-2 text-[11px] text-slate-600">
                        {Object.entries({
                          'Nota BG': [evento?.antes?.nota_para_bg, evento?.depois?.nota_para_bg],
                          'Número BG': [evento?.antes?.numero_bg, evento?.depois?.numero_bg],
                          'Data BG': [evento?.antes?.data_bg, evento?.depois?.data_bg],
                          Status: [evento?.antes?.status_calculado, evento?.depois?.status_calculado],
                        })
                          .filter(([, [antes, depois]]) => String(antes || '') !== String(depois || ''))
                          .map(([label, [antes, depois]]) => (
                            <p key={`${evento.id || evento.timestamp}-${label}`}>
                              <span className="font-semibold">{label}:</span> {antes || '—'} → {depois || '—'}
                            </p>
                          ))}
                      </div>
                    )}
                    <p className="mt-1 text-slate-400">{evento.usuario?.nome || evento.usuario?.email || 'Usuário não identificado'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não poderá ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onDelete(registro.id, origemTipo);
                setShowDeleteConfirm(false);
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
