import React, { useMemo, useState } from 'react';
import { AlertTriangle, Archive, Edit3, FileText, Loader2, Plus, Wand2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { base44 } from '@/api/base44Client';
import ContratoDesignacaoModal from '@/components/militar/ContratoDesignacaoModal';
import EncerrarContratoDesignacaoModal from '@/components/militar/EncerrarContratoDesignacaoModal';
import CancelarContratoDesignacaoModal from '@/components/militar/CancelarContratoDesignacaoModal';
import ExcluirContratoDesignacaoModal from '@/components/militar/ExcluirContratoDesignacaoModal';
import TransicaoLegadoAtivaPreviewModal from '@/components/militar/TransicaoLegadoAtivaPreviewModal';
import {
  buscarEfeitosContratoEmPeriodos,
  getCampoCadeiaFeriasAlterado,
  isContratoAtivoOperacional,
  MENSAGEM_CONTRATO_COM_EFEITOS,
} from '@/services/painelContratosDesignacaoService';
import {
  contarContratosAtivosDesignacao,
  formatarContratoDesignacaoResumo,
  getContratoAtivoDesignacao,
  getContratoDesignacaoStatusBadge,
  normalizarStatusContratoDesignacao,
  ordenarContratosDesignacao,
} from '@/services/contratosDesignacaoMilitarService';

function formatDate(date) {
  if (!date) return '—';
  try { return new Date(`${String(date).slice(0, 10)}T00:00:00`).toLocaleDateString('pt-BR'); } catch (_e) { return date; }
}

function resumoObservacoes(texto) {
  const raw = String(texto || '').trim();
  if (!raw) return '—';
  return raw.length > 90 ? `${raw.slice(0, 90)}...` : raw;
}

function DetailItem({ label, value }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-medium text-slate-700 whitespace-pre-wrap">{value || '—'}</p>
    </div>
  );
}

function formatarPeriodoBloqueante(bloqueante) {
  const referencia = bloqueante?.referencia ? `Ref. ${bloqueante.referencia}` : 'Sem referência';
  const periodo = bloqueante?.periodo || 'Período não informado';
  const status = bloqueante?.status ? `status ${bloqueante.status}` : 'status não informado';
  const quantidade = Number(bloqueante?.quantidade_ferias || 0);
  return `${referencia} — ${periodo} — ${status} — ${quantidade} férias vinculada(s)`;
}

export default function ContratosDesignacaoSection({
  contratos = [],
  militares = [],
  matriculas = [],
  militarId,
  isLoading = false,
  canCreate = false,
  canEdit = false,
  canEncerrar = false,
  canCancelar = false,
  canExcluir = false,
  canPrepararLegadoAtiva = false,
  legadoAtivaPorContrato = {},
  onCreate,
  onUpdate,
  onDelete,
  onArchive,
  isSaving = false,
  isArchiving = false,
}) {
  const { toast } = useToast();
  const [modalNovoOpen, setModalNovoOpen] = useState(false);
  const [detalhe, setDetalhe] = useState(null);
  const [edicao, setEdicao] = useState(null);
  const [edicaoBloqueiaCadeia, setEdicaoBloqueiaCadeia] = useState(false);
  const [encerrar, setEncerrar] = useState(null);
  const [cancelar, setCancelar] = useState(null);
  const [excluir, setExcluir] = useState(null);
  const [previewLegadoAtiva, setPreviewLegadoAtiva] = useState(null);
  const [arquivamento, setArquivamento] = useState(null);
  const [confirmarArquivamento, setConfirmarArquivamento] = useState(false);
  const [arquivamentoBloqueio, setArquivamentoBloqueio] = useState(null);

  const ordenados = useMemo(() => ordenarContratosDesignacao(contratos), [contratos]);
  const ativo = useMemo(() => getContratoAtivoDesignacao(contratos), [contratos]);
  const totalAtivos = useMemo(() => contarContratosAtivosDesignacao(contratos), [contratos]);

  const handleCreate = async (payload) => {
    await onCreate?.(payload);
    setModalNovoOpen(false);
  };

  const handleAbrirEdicao = async (contrato) => {
    if (!contrato) return;
    try {
      const periodosComEfeito = await buscarEfeitosContratoEmPeriodos(base44, contrato.id);
      setEdicaoBloqueiaCadeia(periodosComEfeito.length > 0);
      setEdicao(contrato);
    } catch (error) {
      toast({
        title: 'Erro ao verificar efeitos do contrato',
        description: error?.message || 'Não foi possível verificar os períodos aquisitivos antes da edição.',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = async (payload) => {
    if (!edicao?.id) return;
    const periodosComEfeito = await buscarEfeitosContratoEmPeriodos(base44, edicao.id);
    if (periodosComEfeito.length > 0) {
      const campoAlterado = getCampoCadeiaFeriasAlterado(edicao, payload);
      if (campoAlterado) throw new Error(`Campo ${campoAlterado} bloqueado: ${MENSAGEM_CONTRATO_COM_EFEITOS}`);
    }
    await onUpdate?.(edicao.id, {
      ...payload,
      militar_id: edicao.militar_id,
      matricula_militar_id: edicao.matricula_militar_id || payload.matricula_militar_id,
      matricula_designacao: edicao.matricula_designacao || payload.matricula_designacao,
    });
    setEdicao(null);
    setEdicaoBloqueiaCadeia(false);
  };

  const handleUpdate = async (contrato, payload) => {
    if (!contrato?.id) return;
    await onUpdate?.(contrato.id, payload);
    setEncerrar(null);
    setCancelar(null);
  };

  const handleDelete = async (contrato) => {
    if (!contrato?.id) return;
    const periodosComEfeito = await buscarEfeitosContratoEmPeriodos(base44, contrato.id);
    if (periodosComEfeito.length > 0) {
      toast({ title: 'Exclusão bloqueada', description: MENSAGEM_CONTRATO_COM_EFEITOS, variant: 'destructive' });
      return;
    }
    await onDelete?.(contrato.id);
    setExcluir(null);
  };

  const handleArchive = async () => {
    if (!arquivamento?.id || !confirmarArquivamento) return;
    setArquivamentoBloqueio(null);
    try {
      await onArchive?.(arquivamento);
      setArquivamento(null);
      setConfirmarArquivamento(false);
    } catch (error) {
      if (error?.code === 'PERIODOS_COM_FERIAS_VINCULADAS') {
        setArquivamentoBloqueio({ mensagem: error.message, bloqueantes: Array.isArray(error?.bloqueantes) ? error.bloqueantes : [] });
        return;
      }
      throw error;
    }
  };

  return (
    <Card className="shadow-sm md:col-span-2">
      <CardHeader className="pb-2">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2 text-[#1e3a5f]">
              <FileText className="w-5 h-5" /> Contratos de Designação
              <Badge variant="outline">{ordenados.length}</Badge>
            </CardTitle>
            <p className="text-sm text-slate-500 mt-1">
              Registro administrativo próprio do militar. Esta seção não altera matrícula, férias, saldos, Livro, publicações ou geradores automaticamente.
            </p>
          </div>
          {canCreate && (
            <Button onClick={() => setModalNovoOpen(true)} className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white">
              <Plus className="w-4 h-4 mr-2" />Novo contrato
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Total de contratos</p>
            <p className="text-xl font-bold text-slate-800">{ordenados.length}</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 md:col-span-2">
            <p className="text-xs text-slate-500">Contrato ativo</p>
            {ativo ? (
              <div className="mt-1 flex flex-wrap gap-2 items-center">
                <Badge className={getContratoDesignacaoStatusBadge(ativo.status_contrato).className}>Ativo</Badge>
                <span className="font-medium text-slate-700">{formatarContratoDesignacaoResumo(ativo)}</span>
              </div>
            ) : <p className="font-medium text-slate-700">Nenhum contrato ativo</p>}
          </div>
        </div>

        {totalAtivos > 1 && (
          <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 flex gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5" /> Há mais de um contrato ativo para este militar. Regularize os lançamentos antes de novas integrações.
          </div>
        )}
        {totalAtivos === 0 && (
          <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
            Não há contrato ativo. A data de inclusão original do militar permanece preservada.
          </div>
        )}

        {isLoading ? (
          <div className="rounded-md border border-slate-200 p-4 text-sm text-slate-500">Carregando contratos...</div>
        ) : ordenados.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            Nenhum contrato de designação cadastrado para este militar.
          </div>
        ) : (
          <div className="rounded-md border border-slate-200 text-sm">
            <div className="hidden grid-cols-[1fr_1.25fr_1.15fr_0.9fr] gap-3 rounded-t-md bg-slate-50 p-3 text-xs font-semibold uppercase text-slate-500 lg:grid">
              <span>Status / matrícula / datas</span>
              <span>Contrato / boletim / publicação</span>
              <span>Legal / tipo / observações</span>
              <span className="text-right">Ações</span>
            </div>
            <div className="divide-y divide-slate-100">
              {ordenados.map((contrato) => {
                const badge = getContratoDesignacaoStatusBadge(contrato.status_contrato);
                const ativoContrato = normalizarStatusContratoDesignacao(contrato.status_contrato) === 'ativo';
                const legadoInfo = legadoAtivaPorContrato[String(contrato.id)] || { aplicado: false };
                const podeArquivarLegadoAtiva = !legadoInfo.aplicado && canPrepararLegadoAtiva && isContratoAtivoOperacional(contrato);
                const podePrepararLegadoAtiva = ativoContrato && Boolean(contrato.data_inclusao_para_ferias) && canPrepararLegadoAtiva;
                return (
                  <div key={contrato.id || `${contrato.matricula_designacao}-${contrato.data_inicio_contrato}`} className="grid grid-cols-1 gap-3 p-3 lg:grid-cols-[1fr_1.25fr_1.15fr_0.9fr] lg:items-start">
                    <div className="min-w-0 space-y-1">
                      <p className="text-[11px] font-semibold uppercase text-slate-500 lg:hidden">Status / matrícula / datas</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={badge.className}>{badge.label}</Badge>
                        <Badge variant="outline" className={legadoInfo.aplicado ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}>
                          Legado da Ativa: {legadoInfo.aplicado ? 'Aplicado' : 'Pendente'}
                        </Badge>
                        <span className="break-words font-medium text-slate-700">{contrato.matricula_designacao || '—'}</span>
                      </div>
                      <p className="text-xs text-slate-500">Início: {formatDate(contrato.data_inicio_contrato)} • Data-base férias: {formatDate(contrato.data_inclusao_para_ferias || contrato.data_inicio_contrato)}</p>
                      <p className="text-xs text-slate-500">Fim: {formatDate(contrato.data_fim_contrato || contrato.data_encerramento_operacional)}</p>
                    </div>

                    <div className="min-w-0 rounded-md bg-slate-50 p-2 lg:bg-transparent lg:p-0">
                      <p className="text-[11px] font-semibold uppercase text-slate-500 lg:hidden">Contrato / boletim / publicação</p>
                      <p className="break-words font-medium text-slate-800">{contrato.numero_contrato || '—'}</p>
                      <p className="break-words text-xs text-slate-500">Boletim/publicação: {contrato.boletim_publicacao || '—'} • Data publicação: {formatDate(contrato.data_publicacao)}</p>
                    </div>

                    <div className="min-w-0 space-y-1">
                      <p className="text-[11px] font-semibold uppercase text-slate-500 lg:hidden">Legal / tipo / observações</p>
                      <p className="break-words text-slate-700">{contrato.fonte_legal || '—'}</p>
                      <p className="break-words text-xs text-slate-500">Tipo: {contrato.tipo_designacao || '—'}</p>
                      <p className="break-words text-xs leading-5 text-slate-500">Obs.: {resumoObservacoes(contrato.observacoes)}</p>
                    </div>

                    <div className="min-w-0 rounded-md border border-slate-200 bg-white p-2 lg:border-0 lg:p-0">
                      <p className="mb-2 text-[11px] font-semibold uppercase text-slate-500 lg:hidden">Ações</p>
                      <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
                        <Button size="sm" variant="outline" onClick={() => setDetalhe(contrato)}>Ver detalhes</Button>
                        {canEdit && <Button size="sm" variant="outline" onClick={() => handleAbrirEdicao(contrato)}><Edit3 className="mr-1 h-4 w-4" />Editar contrato</Button>}
                        {podeArquivarLegadoAtiva && (
                          <Button size="sm" variant="outline" onClick={() => { setArquivamento(contrato); setConfirmarArquivamento(false); setArquivamentoBloqueio(null); }} className="whitespace-normal border-amber-200 text-amber-800 hover:bg-amber-50">
                            <Archive className="mr-1 h-4 w-4 shrink-0" />Arquivar períodos da ativa
                          </Button>
                        )}
                        {podePrepararLegadoAtiva && (
                          <Button size="sm" variant="outline" onClick={() => setPreviewLegadoAtiva(contrato)} className="whitespace-normal border-amber-200 text-amber-800 hover:bg-amber-50">
                            <Wand2 className="mr-1 h-4 w-4 shrink-0" />Ver prévia legado
                          </Button>
                        )}
                        {ativoContrato && canEncerrar && <Button size="sm" variant="outline" onClick={() => setEncerrar(contrato)}>Encerrar</Button>}
                        {canCancelar && normalizarStatusContratoDesignacao(contrato.status_contrato) !== 'cancelado' && <Button size="sm" variant="destructive" onClick={() => setCancelar(contrato)}>Cancelar</Button>}
                        {canExcluir && <Button size="sm" variant="destructive" onClick={() => setExcluir(contrato)}>Excluir contrato</Button>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <ContratoDesignacaoModal
          open={modalNovoOpen}
          onOpenChange={setModalNovoOpen}
          militarId={militarId}
          militares={militares}
          matriculas={matriculas}
          onSubmit={handleCreate}
          isSubmitting={isSaving}
        />
        <ContratoDesignacaoModal
          open={Boolean(detalhe)}
          onOpenChange={(open) => !open && setDetalhe(null)}
          militarId={militarId}
          militares={militares}
          matriculas={matriculas}
          contrato={detalhe}
          readOnly
        />
        <ContratoDesignacaoModal
          open={Boolean(edicao)}
          onOpenChange={(open) => { if (!open) { setEdicao(null); setEdicaoBloqueiaCadeia(false); } }}
          militarId={militarId}
          militares={militares}
          matriculas={matriculas}
          contrato={edicao}
          bloqueiaCadeiaFerias={edicaoBloqueiaCadeia}
          onSubmit={handleEdit}
          isSubmitting={isSaving}
        />
        <EncerrarContratoDesignacaoModal
          open={Boolean(encerrar)}
          onOpenChange={(open) => !open && setEncerrar(null)}
          contrato={encerrar}
          onSubmit={handleUpdate}
          isSubmitting={isSaving}
        />
        <CancelarContratoDesignacaoModal
          open={Boolean(cancelar)}
          onOpenChange={(open) => !open && setCancelar(null)}
          contrato={cancelar}
          onSubmit={handleUpdate}
          isSubmitting={isSaving}
        />
        <ExcluirContratoDesignacaoModal
          open={Boolean(excluir)}
          onOpenChange={(open) => !open && setExcluir(null)}
          contrato={excluir}
          onSubmit={handleDelete}
          isSubmitting={isSaving}
        />
        <TransicaoLegadoAtivaPreviewModal
          open={Boolean(previewLegadoAtiva)}
          onOpenChange={(open) => !open && setPreviewLegadoAtiva(null)}
          militarId={militarId}
          contrato={previewLegadoAtiva}
        />

        {arquivamento && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true">
            <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
              <div className="border-b border-slate-200 p-5">
                <h2 className="text-xl font-bold text-slate-900">Arquivar períodos da ativa</h2>
                <p className="mt-1 text-sm text-slate-500">Arquivamento lógico em bloco da cadeia anterior à nova data-base de férias.</p>
              </div>
              <div className="space-y-4 p-5">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <DetailItem label="Matrícula usada no contrato" value={arquivamento.matricula_designacao} />
                  <DetailItem label="Contrato" value={[arquivamento.numero_contrato, arquivamento.boletim_publicacao].filter(Boolean).join(' • ')} />
                  <DetailItem label="Início" value={formatDate(arquivamento.data_inicio_contrato)} />
                  <DetailItem label="Nova data-base" value={formatDate(arquivamento.data_inclusao_para_ferias || arquivamento.data_inicio_contrato)} />
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  Esta ação não apaga períodos, férias, Livro ou publicações. Apenas retira a cadeia antiga da operação normal.
                </div>
                {arquivamentoBloqueio && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900" role="alert">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
                      <div>
                        <p className="font-semibold">Não foi possível arquivar/excluir os períodos porque existem férias lançadas em um ou mais períodos da cadeia antiga.</p>
                        <p className="mt-1">Exclua ou corrija as férias vinculadas antes de continuar.</p>
                        {arquivamentoBloqueio.bloqueantes?.length > 0 && (
                          <ul className="mt-3 list-disc space-y-1 pl-5">
                            {arquivamentoBloqueio.bloqueantes.map((bloqueante) => (
                              <li key={bloqueante.id || `${bloqueante.referencia}-${bloqueante.periodo}`}>{formatarPeriodoBloqueante(bloqueante)}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-slate-300"
                    checked={confirmarArquivamento}
                    onChange={(event) => setConfirmarArquivamento(event.target.checked)}
                  />
                  <span>Confirmo o arquivamento lógico da cadeia anterior</span>
                </label>
              </div>
              <div className="flex justify-end gap-3 border-t border-slate-200 p-5">
                <Button variant="outline" onClick={() => { setArquivamento(null); setConfirmarArquivamento(false); setArquivamentoBloqueio(null); }} disabled={isArchiving}>Cancelar</Button>
                <Button onClick={handleArchive} disabled={!confirmarArquivamento || isArchiving} className="bg-[#1e3a5f] text-white hover:bg-[#2d4a6f]">
                  {isArchiving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Archive className="mr-2 h-4 w-4" />}
                  Arquivar períodos
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
