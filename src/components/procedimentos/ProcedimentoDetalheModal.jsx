import React from 'react';
import { Link } from 'react-router-dom';
import { TIPOS_RP_PROCEDIMENTO } from './procedimentoPublicacao';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, Lock, Pencil, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import { obterProcedimentoEscopado, excluirProcedimentoEscopado } from '@/services/procedimentosEscopadoClient';
import {
  classeStatus, classePrazo, classificarPrazo, formatarData,
} from '@/components/procedimentos/procedimentoConfig';

function Campo({ label, valor }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-sm text-slate-800">{valor || '—'}</p>
    </div>
  );
}

export default function ProcedimentoDetalheModal({ open, onOpenChange, procedimentoId, onEdit, onProrrogar, onChanged }) {
  const { toast } = useToast();
  const { canAccessAction } = useCurrentUser();
  const podeExcluir = canAccessAction('perm_excluir_processo_controle');
  const podeEditar = canAccessAction('perm_editar_processo_controle');
  const podeGerar = canAccessAction('adicionar_publicacoes');

  const { data, isLoading } = useQuery({
    queryKey: ['procedimento-administrativo', procedimentoId],
    queryFn: () => obterProcedimentoEscopado(procedimentoId),
    enabled: open && !!procedimentoId,
  });

  const procedimento = data?.procedimento;
  const envolvidos = data?.envolvidos || [];
  const prazos = [...(data?.prazos || [])].sort((a, b) => String(b.data_fim || '').localeCompare(String(a.data_fim || '')));
  const prazo = classificarPrazo(procedimento);
  const publicacoes = data?.publicacoes || [];
  const publicacaoUrl = (tipo, prazoId) => {
    const params = new URLSearchParams({ tipo, procedimento_id: procedimentoId });
    if (prazoId) params.set('procedimento_prazo_id', prazoId);
    return `/CadastrarRegistroRP?${params}`;
  };
  const temPublicacao = (tipo, prazoId) =>
    publicacoes.some((pub) => pub.tipo === tipo && (!prazoId || pub.procedimento_prazo_id === prazoId));

  const handleExcluir = async () => {
    if (!procedimento) return;
    if (!window.confirm('Excluir definitivamente este procedimento e seus vínculos?')) return;
    try {
      await excluirProcedimentoEscopado(procedimento.id);
      toast({ title: 'Procedimento excluído.' });
      onOpenChange(false);
      onChanged?.();
    } catch (e) {
      toast({ title: 'Erro ao excluir', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {procedimento ? `${procedimento.tipo_procedimento} · ${procedimento.numero_procedimento || 'sem número'}` : 'Procedimento'}
          </DialogTitle>
        </DialogHeader>

        {isLoading && <p className="py-6 text-center text-sm text-slate-500">Carregando procedimento...</p>}

        {procedimento && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${classeStatus(procedimento.status)}`}>
                {procedimento.status}
              </span>
              <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${classePrazo(prazo.chave)}`}>
                {prazo.label}
              </span>
              {procedimento.sigiloso && (
                <span className="inline-flex items-center gap-1 rounded-md border border-purple-200 bg-purple-50 px-2 py-0.5 text-[11px] font-medium text-purple-700">
                  <Lock className="h-3 w-3" /> Sigiloso
                </span>
              )}
            </div>

            <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3 sm:grid-cols-3">
              <Campo label="Portaria" valor={procedimento.numero_portaria} />
              <Campo label="Data da portaria" valor={formatarData(procedimento.data_portaria)} />
              <Campo label="Instauração" valor={formatarData(procedimento.data_instauracao)} />
              <Campo label="Prazo final" valor={formatarData(procedimento.prazo_final)} />
              <Campo label="Prorrogações" valor={String(procedimento.prorrogacoes_count || 0)} />
              <Campo label="Prioridade" valor={procedimento.prioridade_risco} />
              <Campo label="Autoridade instauradora" valor={procedimento.autoridade_instauradora} />
              <Campo label="Unidade" valor={procedimento.unidade} />
              <Campo
                label="Encarregado"
                valor={[procedimento.encarregado_posto, procedimento.encarregado_nome].filter(Boolean).join(' ')}
              />
            </div>

            {procedimento.objeto && (
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Objeto</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{procedimento.objeto}</p>
              </div>
            )}

            <div>
              <p className="mb-2 text-sm font-semibold text-slate-800">Envolvidos ({envolvidos.length})</p>
              {envolvidos.length === 0 ? (
                <p className="text-xs text-slate-500">Nenhum envolvido registrado.</p>
              ) : (
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {envolvidos.map((e) => (
                    <li key={e.id} className="flex items-center justify-between gap-2 px-3 py-2">
                      <span className="text-sm text-slate-800">
                        {[e.posto, e.nome].filter(Boolean).join(' ') || 'Militar não identificado'}
                        {e.matricula ? <span className="ml-2 text-xs text-slate-400">Mat. {e.matricula}</span> : null}
                      </span>
                      <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600">{e.papel}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-slate-800">Histórico de prazos</p>
              {prazos.length === 0 ? (
                <p className="text-xs text-slate-500">Sem prazos registrados.</p>
              ) : (
                <ul className="space-y-2">
                  {prazos.map((p) => (
                    <li key={p.id} className="flex items-start gap-2 rounded-lg border border-slate-200 p-2.5">
                      <CalendarClock className="mt-0.5 h-4 w-4 text-slate-400" />
                      <div className="min-w-0">
                        <p className="text-sm text-slate-800">
                          {p.tipo} · {p.dias || 0} dias · até {formatarData(p.data_fim)}
                        </p>
                        {p.motivo && <p className="text-xs text-slate-500">{p.motivo}</p>}
                        {podeGerar && !procedimento.sigiloso && p.tipo === 'Prorrogação' && !temPublicacao(TIPOS_RP_PROCEDIMENTO.prorrogacao, p.id) && (
                          <Link className="mt-1 inline-block text-sm font-medium text-blue-700 hover:underline" to={publicacaoUrl(TIPOS_RP_PROCEDIMENTO.prorrogacao, p.id)}>
                            Gerar publicação da prorrogação
                          </Link>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-800">Publicações vinculadas</h3>
              {publicacoes.length === 0 ? (
                <p className="text-xs text-slate-500">Sem publicações vinculadas.</p>
              ) : (
                <ul className="divide-y rounded-lg border border-slate-200">
                  {publicacoes.map((pub) => (
                    <li key={pub.id} className="flex flex-wrap justify-between gap-2 px-3 py-2 text-sm">
                      <span>{pub.tipo}</span>
                      <span className="text-slate-600">
                        {[pub.status, pub.nota_para_bg && `Nota ${pub.nota_para_bg}`, pub.numero_bg && `BG ${pub.numero_bg}`, pub.data_bg && formatarData(pub.data_bg)].filter(Boolean).join(' · ')}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {podeGerar && !procedimento.sigiloso && (
                <div className="flex flex-wrap gap-2">
                  {[
                    [TIPOS_RP_PROCEDIMENTO.instauracao, 'Gerar portaria de instauração', procedimento.numero_portaria],
                    [TIPOS_RP_PROCEDIMENTO.designacao, 'Gerar designação de encarregado', procedimento.tipo_procedimento === 'PAD' && procedimento.encarregado_id && procedimento.numero_portaria],
                    [TIPOS_RP_PROCEDIMENTO.solucao, 'Gerar publicação da solução', procedimento.numero_portaria],
                  ].filter(([tipo, , disponivel]) => disponivel && !temPublicacao(tipo)).map(([tipo, label]) => (
                    <Button key={tipo} asChild variant="outline" size="sm">
                      <Link to={publicacaoUrl(tipo)}>{label}</Link>
                    </Button>
                  ))}
                </div>
              )}
            </section>

            {procedimento.observacoes && (
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Observações</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{procedimento.observacoes}</p>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {podeExcluir && procedimento && (
            <Button variant="ghost" className="mr-auto text-red-600 hover:bg-red-50" onClick={handleExcluir}>
              <Trash2 className="mr-1 h-4 w-4" /> Excluir
            </Button>
          )}
          {podeEditar && procedimento && (
            <>
              {!['Solucionado', 'Arquivado', 'Cancelado'].includes(procedimento.status) && (
                <Button variant="outline" onClick={() => onProrrogar(procedimento)}>Prorrogar prazo</Button>
              )}
              <Button onClick={() => onEdit(procedimento, envolvidos)}>
                <Pencil className="mr-1 h-4 w-4" /> Editar
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}