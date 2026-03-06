import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Calendar, FileText, Save, Edit2, X, ChevronDown, ChevronUp, Trash2, ExternalLink, Star, AlertTriangle, Stamp, XCircle } from 'lucide-react';
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

export default function PublicacaoCard({ registro, onUpdate, onDelete }) {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditingBg, setIsEditingBg] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [bgData, setBgData] = useState({
    nota_para_bg: registro.nota_para_bg || '',
    numero_bg: registro.numero_bg || '',
    data_bg: registro.data_bg || '',
  });

  const handleTogglePrioridade = (e, flag) => {
    e.stopPropagation();
    // tipo_registro indica registro de livro; tipo indica ex-officio; cid_10/medico indica atestado
    let tipo = 'livro';
    if (registro.tipo && !registro.tipo_registro) tipo = 'ex-officio';
    else if (registro.medico || registro.cid_10) tipo = 'atestado';
    const newVal = !registro[flag];
    onUpdate(registro.id, { [flag]: newVal }, tipo);
  };

  // Status canônico: sempre usar o calculado a partir dos campos de BG
  const currentStatus = calcStatus(registro.nota_para_bg, registro.numero_bg, registro.data_bg);

  const handleSaveBg = () => {
    const novoStatus = calcStatus(bgData.nota_para_bg, bgData.numero_bg, bgData.data_bg);
    let tipo = 'livro';
    if (registro.tipo) tipo = 'ex-officio';
    else if (registro.medico || registro.cid_10) tipo = 'atestado';

    const updateData = tipo === 'atestado'
      ? { ...bgData, status_publicacao: novoStatus }
      : { ...bgData, status: novoStatus };

    onUpdate(registro.id, updateData, tipo);
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

  const formatDate = (d) => {
    if (!d) return '-';
    try { return format(new Date(d + 'T00:00:00'), 'dd/MM/yyyy'); } catch { return d; }
  };

  const tipoLabel = registro.tipo_registro || registro.tipo ||
    (registro.medico || registro.cid_10
      ? (registro.necessita_jiso ? 'Atestado - JISO' : 'Atestado - Homologação')
      : '');

  const foiApostilada = !!registro.apostilada_por_id;
  const foiTornadaSemEfeito = !!registro.tornada_sem_efeito_por_id;

  // Link para atestado vinculado (publicações ex-officio que têm atestado_homologado_id ou atestados_jiso_ids)
  const atestadoLink = registro.atestado_homologado_id
    ? createPageUrl('VerAtestado') + `?id=${registro.atestado_homologado_id}`
    : null;

  // É uma publicação ex-officio editável
  const isExOfficio = !!(registro.tipo && !registro.medico && !registro.cid_10);

  const liveStatus = calcStatus(bgData.nota_para_bg, bgData.numero_bg, bgData.data_bg);

  return (
    <>
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta publicação? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => { onDelete(registro.id, registro.tipo ? 'ex-officio' : (registro.medico || registro.cid_10 ? 'atestado' : 'livro')); setShowDeleteConfirm(false); }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className={`border hover:shadow-md transition-shadow ${foiTornadaSemEfeito ? 'border-red-400 bg-red-50 opacity-70' : foiApostilada ? 'border-purple-400 bg-purple-50' : registro.urgente ? 'border-red-400 bg-red-50' : registro.importante ? 'border-amber-400 bg-amber-50' : 'border-slate-200'}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                {foiTornadaSemEfeito && (
                  <span className="flex items-center gap-1 text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full border border-red-300">
                    <XCircle className="w-3 h-3" /> TORNADA SEM EFEITO
                  </span>
                )}
                {foiApostilada && !foiTornadaSemEfeito && (
                  <span className="flex items-center gap-1 text-xs font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full border border-purple-300">
                    <Stamp className="w-3 h-3" /> APOSTILADA
                  </span>
                )}
                {registro.urgente && <span className="flex items-center gap-1 text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full"><AlertTriangle className="w-3 h-3" />URGENTE</span>}
                {registro.importante && !registro.urgente && <span className="flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full"><Star className="w-3 h-3" />IMPORTANTE</span>}
                <h3 className="font-semibold text-lg text-slate-900 truncate">
                  {registro.militar_posto && `${registro.militar_posto} `}
                  {registro.militar_nome}
                </h3>
                <Badge className={statusColors[currentStatus]}>{currentStatus}</Badge>
              </div>
              <div className="flex flex-wrap gap-3 text-sm text-slate-600">
                {registro.militar_matricula && (
                  <span>Mat: {registro.militar_matricula}</span>
                )}
                {tipoLabel && (
                  <span className="flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5" />
                    {tipoLabel}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatDate(registro.data_registro || registro.data_publicacao)}
                </span>
                {registro.numero_bg && (
                  <span className="font-medium text-emerald-700">BG Nº {registro.numero_bg}</span>
                )}
                {atestadoLink && (
                  <a
                    href={atestadoLink}
                    className="flex items-center gap-1 text-blue-600 hover:underline"
                    onClick={e => { e.stopPropagation(); navigate(atestadoLink); }}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Ver Atestado
                  </a>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              {/* Marcar Urgente */}
              <Button variant="ghost" size="sm" title={registro.urgente ? 'Remover Urgente' : 'Marcar como Urgente'} onClick={() => handleTogglePrioridade('urgente')} className={`text-xs gap-1 ${registro.urgente ? 'text-red-600' : 'text-slate-400 hover:text-red-500'}`}>
                <AlertTriangle className="w-4 h-4" />
              </Button>
              {/* Marcar Importante */}
              <Button variant="ghost" size="sm" title={registro.importante ? 'Remover Importante' : 'Marcar como Importante'} onClick={() => handleTogglePrioridade('importante')} className={`text-xs gap-1 ${registro.importante ? 'text-amber-500' : 'text-slate-400 hover:text-amber-500'}`}>
                <Star className="w-4 h-4" />
              </Button>
              {/* Editar nota/BG inline */}
              {!isEditingBg && (
                <Button
                  variant="ghost"
                  size="sm"
                  title="Preencher Nota/BG"
                  onClick={() => { setIsEditingBg(true); setIsExpanded(true); }}
                  className="text-slate-500 hover:text-blue-600 text-xs gap-1"
                >
                  <FileText className="w-4 h-4" />
                  <span className="hidden sm:inline">Nota/BG</span>
                </Button>
              )}
              {/* Editar completo (ex-officio) */}
              {isExOfficio && (
                <Button
                  variant="ghost"
                  size="sm"
                  title="Editar publicação"
                  onClick={() => navigate(createPageUrl('CadastrarPublicacao') + `?id=${registro.id}`)}
                  className="text-slate-500 hover:text-[#1e3a5f] text-xs gap-1"
                >
                  <Edit2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Editar</span>
                </Button>
              )}
              {/* Excluir */}
              {isExOfficio && (
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
              {/* Expandir */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </CardHeader>

        {isExpanded && (
          <CardContent className="pt-0 border-t border-slate-100">
            {/* Inline BG editing */}
            {isEditingBg ? (
              <div className="mt-4 space-y-3 bg-blue-50 p-4 rounded-lg border border-blue-100">
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Preencher Nota / BG</p>
                <div>
                  <Label className="text-sm font-medium">Nota para BG</Label>
                  <Input
                    value={bgData.nota_para_bg}
                    onChange={e => setBgData(d => ({ ...d, nota_para_bg: e.target.value }))}
                    className="mt-1 bg-white"
                    placeholder="Ex: 001/2025"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm font-medium">Número do BG</Label>
                    <Input
                      value={bgData.numero_bg}
                      onChange={e => setBgData(d => ({ ...d, numero_bg: e.target.value }))}
                      className="mt-1 bg-white"
                      placeholder="Ex: 045/2025"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Data do BG</Label>
                    <Input
                      type="date"
                      value={bgData.data_bg}
                      onChange={e => setBgData(d => ({ ...d, data_bg: e.target.value }))}
                      className="mt-1 bg-white"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={statusColors[liveStatus] + ' text-xs'}>
                    → {liveStatus}
                  </Badge>
                  <span className="text-xs text-slate-500">status resultante</span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveBg} className="bg-[#1e3a5f] hover:bg-[#2d4a6f]">
                    <Save className="w-4 h-4 mr-1" /> Salvar
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleCancelBg}>
                    <X className="w-4 h-4 mr-1" /> Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {registro.texto_publicacao && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Texto para Publicação</p>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-sm text-slate-700 leading-relaxed">
                      {registro.texto_publicacao}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-slate-500">Nota para BG</p>
                    <p className="font-medium mt-0.5">{registro.nota_para_bg || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Número do BG</p>
                    <p className="font-medium mt-0.5">{registro.numero_bg || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Data do BG</p>
                    <p className="font-medium mt-0.5">{formatDate(registro.data_bg)}</p>
                  </div>
                </div>
                {registro.observacoes && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Observações</p>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-sm text-slate-700">
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