import React, { useMemo, useState } from 'react';
import { AlertTriangle, FileText, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ContratoDesignacaoModal from '@/components/militar/ContratoDesignacaoModal';
import EncerrarContratoDesignacaoModal from '@/components/militar/EncerrarContratoDesignacaoModal';
import CancelarContratoDesignacaoModal from '@/components/militar/CancelarContratoDesignacaoModal';
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

export default function ContratosDesignacaoSection({
  contratos = [],
  matriculas = [],
  militarId,
  isLoading = false,
  canCreate = false,
  canEncerrar = false,
  canCancelar = false,
  onCreate,
  onUpdate,
  isSaving = false,
}) {
  const [modalNovoOpen, setModalNovoOpen] = useState(false);
  const [detalhe, setDetalhe] = useState(null);
  const [encerrar, setEncerrar] = useState(null);
  const [cancelar, setCancelar] = useState(null);

  const ordenados = useMemo(() => ordenarContratosDesignacao(contratos), [contratos]);
  const ativo = useMemo(() => getContratoAtivoDesignacao(contratos), [contratos]);
  const totalAtivos = useMemo(() => contarContratosAtivosDesignacao(contratos), [contratos]);

  const handleCreate = async (payload) => {
    await onCreate?.(payload);
    setModalNovoOpen(false);
  };

  const handleUpdate = async (contrato, payload) => {
    if (!contrato?.id) return;
    await onUpdate?.(contrato.id, payload);
    setEncerrar(null);
    setCancelar(null);
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
              Histórico de contratos de designação do militar. A data de inclusão original permanece preservada; a data-base de férias será considerada futuramente apenas para contrato ativo válido.
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
          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-left">Matrícula</th>
                  <th className="p-3 text-left">Início</th>
                  <th className="p-3 text-left">Fim/encerramento</th>
                  <th className="p-3 text-left">Data-base férias</th>
                  <th className="p-3 text-left">Contrato/boletim</th>
                  <th className="p-3 text-left">Publicação</th>
                  <th className="p-3 text-left">Legal/tipo</th>
                  <th className="p-3 text-left">Observações</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {ordenados.map((contrato) => {
                  const badge = getContratoDesignacaoStatusBadge(contrato.status_contrato);
                  const ativoContrato = normalizarStatusContratoDesignacao(contrato.status_contrato) === 'ativo';
                  return (
                    <tr key={contrato.id || `${contrato.matricula_designacao}-${contrato.data_inicio_contrato}`} className="border-t border-slate-100 align-top">
                      <td className="p-3"><Badge className={badge.className}>{badge.label}</Badge></td>
                      <td className="p-3 font-medium text-slate-700">{contrato.matricula_designacao || '—'}</td>
                      <td className="p-3">{formatDate(contrato.data_inicio_contrato)}</td>
                      <td className="p-3">{formatDate(contrato.data_fim_contrato || contrato.data_encerramento_operacional)}</td>
                      <td className="p-3">{formatDate(contrato.data_inclusao_para_ferias)}</td>
                      <td className="p-3">{contrato.numero_contrato || '—'}<br /><span className="text-xs text-slate-500">{contrato.boletim_publicacao || '—'}</span></td>
                      <td className="p-3">{formatDate(contrato.data_publicacao)}</td>
                      <td className="p-3">{contrato.fonte_legal || '—'}<br /><span className="text-xs text-slate-500">{contrato.tipo_designacao || '—'}</span></td>
                      <td className="p-3 max-w-[180px]">{resumoObservacoes(contrato.observacoes)}</td>
                      <td className="p-3">
                        <div className="flex flex-col gap-2 items-end">
                          <Button size="sm" variant="outline" onClick={() => setDetalhe(contrato)}>Ver detalhes</Button>
                          {ativoContrato && canEncerrar && <Button size="sm" variant="outline" onClick={() => setEncerrar(contrato)}>Encerrar</Button>}
                          {canCancelar && normalizarStatusContratoDesignacao(contrato.status_contrato) !== 'cancelado' && <Button size="sm" variant="destructive" onClick={() => setCancelar(contrato)}>Cancelar lançamento</Button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <ContratoDesignacaoModal
          open={modalNovoOpen}
          onOpenChange={setModalNovoOpen}
          militarId={militarId}
          matriculas={matriculas}
          onSubmit={handleCreate}
          isSubmitting={isSaving}
        />
        <ContratoDesignacaoModal
          open={Boolean(detalhe)}
          onOpenChange={(open) => !open && setDetalhe(null)}
          militarId={militarId}
          matriculas={matriculas}
          contrato={detalhe}
          readOnly
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
      </CardContent>
    </Card>
  );
}
