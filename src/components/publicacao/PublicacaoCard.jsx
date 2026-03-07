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
  Ban
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

  const origemTipo = detectarOrigemTipo(registro);

  const currentStatus = calcStatus(
    registro.nota_para_bg,
    registro.numero_bg,
    registro.data_bg
  );

  const isPublicado = currentStatus === 'Publicado';
  const foiApostilada = !!registro.apostilada_por_id;
  const foiTornadaSemEfeito = !!registro.tornada_sem_efeito_por_id;

  const podeApostilarOuTSE = isPublicado && !foiTornadaSemEfeito;
  const podeMarcarPrioridade = !isPublicado;
  const podeEditar = !isPublicado;
  const podeExcluir = !isPublicado;

  const liveStatus = calcStatus(
    bgData.nota_para_bg,
    bgData.numero_bg,
    bgData.data_bg
  );

  const tipoLabel =
    registro.tipo_registro ||
    registro.tipo ||
    (registro.medico || registro.cid_10
      ? (registro.necessita_jiso ? 'Atestado - JISO' : 'Atestado - Homologação')
      : '');

  const atestadoLink = registro.atestado_homologado_id
    ? `${createPageUrl('VerAtestado')}?id=${registro.atestado_homologado_id}`
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
      `${createPageUrl('CadastrarPublicacao')}?tipo=Apostila&militar_id=${registro.militar_id}&ref_id=${registro.id}`
    );
  };

  const handleTornarSemEfeito = () => {
    navigate(
      `${createPageUrl('CadastrarPublicacao')}?tipo=Tornar+sem+Efeito&militar_id=${registro.militar_id}&ref_id=${registro.id}`
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
        className={`border hover:shadow-md transition-shadow ${
          foiTornadaSemEfeito
            ? 'border-red-400 bg-red-50 opacity-70'
            : foiApostilada
              ? 'border-purple-400 bg-purple-50'
              : !isPublicado && registro.urgente
                ? 'border-red-400 bg-red-50'
                : !isPublicado && registro.importante
                  ? 'border-amber-400 bg-amber-50'
                  : 'border-slate-200'
        }`}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                {foiTornadaSemEfeito && (
                  <span className="flex items-center gap-1 text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full border border-red-300">
                    <XCircle className="w-3 h-3" />
                    TORNADA SEM EFEITO
                  </span>
                )}

                {foiApostilada && !foiTornadaSemEfeito && (
                  <span className="flex items-center gap-1 text-xs font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full border border-purple-300">
                    <Stamp className="w-3 h-3" />
                    APOSTILADA
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

                <h3 className="font-semibold text-lg text-slate-900 truncate">
                  {registro.militar_posto && `${registro.militar_posto} `}
                  {registro.militar_nome}
                </h3>

                <Badge className={statusColors[currentStatus]}>
                  {currentStatus}
                </Badge>
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
              </div>
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

              {podeApostilarOuTSE && (
                <>
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
                </>
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
        </CardHeader>

        {isExpanded && (
          <CardContent className="pt-0 border-t border-slate-100">
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