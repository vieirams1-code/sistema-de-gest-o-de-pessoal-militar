import React from 'react';
import { Link } from 'react-router-dom';
import { ROTULOS_PUBLICACAO_PROCEDIMENTO, TIPOS_RP_PROCEDIMENTO } from './procedimentoPublicacao';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, ExternalLink, FileText, Lock, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { calcularStatusPublicacaoRegistro } from '@/components/publicacao/publicacaoStateMachine';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import { obterProcedimentoEscopado, excluirProcedimentoEscopado } from '@/services/procedimentosEscopadoClient';
import {
  classeStatus, classePrazo, classificarPrazo, formatarData,
} from '@/components/procedimentos/procedimentoConfig';

const CLASSES_STATUS_PUBLICACAO = {
  'Aguardando Nota': 'bg-amber-50 border-amber-200 text-amber-800',
  'Aguardando Publicação': 'bg-blue-50 border-blue-200 text-blue-800',
  Publicado: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  padrao: 'bg-slate-50 border-slate-200 text-slate-700',
};

function Campo({ label, valor }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-sm text-slate-800">{valor || '—'}</p>
    </div>
  );
}

export default function ProcedimentoDetalheModal({ open, onOpenChange, procedimentoId, onEdit, onProrrogar, onPublicar, onChanged }) {
  const { toast } = useToast();
  const { canAccessAction, canAccessModule } = useCurrentUser();
  const podeVerPublicacoes = canAccessModule('controle_publicacoes') && canAccessAction('visualizar_controle_publicacoes');
  const podeExcluir = canAccessAction('perm_excluir_processo_controle');
  const podeEditar = canAccessAction('perm_editar_processo_controle');
  const podeGerar = canAccessAction('adicionar_publicacoes');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['procedimento-administrativo', procedimentoId],
    queryFn: () => obterProcedimentoEscopado(procedimentoId),
    enabled: open && !!procedimentoId,
  });

  const procedimento = data?.procedimento;
  const envolvidos = data?.envolvidos || [];
  const prazos = [...(data?.prazos || [])].sort((a, b) => String(b.data_fim || '').localeCompare(String(a.data_fim || '')));
  const prazo = classificarPrazo(procedimento);
  const publicacoes = data?.publicacoes || [];
  const resumoPublicacoes = publicacoes.reduce((resumo, pub) => {
    const status = calcularStatusPublicacaoRegistro(pub);
    if (status === 'Publicado') resumo.publicadas += 1;
    else if (status === 'Aguardando Publicação') resumo.aguardandoBg += 1;
    else resumo.aguardandoNota += 1;
    return resumo;
  }, { publicadas: 0, aguardandoBg: 0, aguardandoNota: 0 });
  const temPublicacao = (tipo, prazoId) =>
    publicacoes.some((pub) => pub.tipo === tipo && (!prazoId || pub.procedimento_prazo_id === prazoId));
  const prorrogacaoPendente = prazos.find((item) =>
    item.tipo === 'Prorrogação' && !temPublicacao(TIPOS_RP_PROCEDIMENTO.prorrogacao, item.id),
  );
  const podeRegistrarPrazo = podeEditar && Boolean(procedimento?.prazo_final || procedimento?.data_instauracao)
    && !['Solucionado', 'Arquivado', 'Cancelado'].includes(procedimento?.status);

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

        {isError && <p className="py-6 text-center text-sm text-slate-700" role="alert">Não foi possível carregar o procedimento.</p>}

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
                        {p.tipo === 'Prorrogação' && !temPublicacao(TIPOS_RP_PROCEDIMENTO.prorrogacao, p.id) && (
                          <p className="mt-1 text-xs text-amber-700">Publicação da prorrogação pendente</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-[#1e3a5f]">
                    <FileText className="h-4 w-4" /> Publicações vinculadas
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{publicacoes.length}</span>
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">Situação das notas e vínculo com o Controle de Publicações.</p>
                  {publicacoes.length > 0 && (
                    <p className="mt-1.5 text-xs text-slate-600" aria-label="Resumo das publicações">
                      {resumoPublicacoes.publicadas} publicada(s) · {resumoPublicacoes.aguardandoBg} aguardando BG · {resumoPublicacoes.aguardandoNota} aguardando nota
                    </p>
                  )}
                </div>
                {podeGerar && !procedimento.sigiloso && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" aria-label="Ações de publicações" title="Ações de publicações">
                        <MoreHorizontal className="h-5 w-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64">
                      {!procedimento.numero_portaria ? (
                        <DropdownMenuItem disabled>Cadastre o número da portaria primeiro</DropdownMenuItem>
                      ) : (
                        <>
                          {!temPublicacao(TIPOS_RP_PROCEDIMENTO.instauracao) && (
                            <DropdownMenuItem onSelect={() => onPublicar(procedimento, TIPOS_RP_PROCEDIMENTO.instauracao)}>
                              <FileText className="mr-2 h-4 w-4" /> Publicar instauração
                            </DropdownMenuItem>
                          )}
                          {prorrogacaoPendente ? (
                            <DropdownMenuItem onSelect={() => onPublicar(procedimento, TIPOS_RP_PROCEDIMENTO.prorrogacao, prorrogacaoPendente)}>
                              <CalendarClock className="mr-2 h-4 w-4" /> Publicar prorrogação pendente
                            </DropdownMenuItem>
                          ) : podeRegistrarPrazo && (
                            <DropdownMenuItem onSelect={() => onProrrogar(procedimento, true)}>
                              <CalendarClock className="mr-2 h-4 w-4" /> Prorrogar e gerar publicação
                            </DropdownMenuItem>
                          )}
                          {!temPublicacao(TIPOS_RP_PROCEDIMENTO.solucao) && (
                            <DropdownMenuItem onSelect={() => onPublicar(procedimento, TIPOS_RP_PROCEDIMENTO.solucao)}>
                              <FileText className="mr-2 h-4 w-4" /> Publicar solução
                            </DropdownMenuItem>
                          )}
                          {temPublicacao(TIPOS_RP_PROCEDIMENTO.instauracao) &&
                            temPublicacao(TIPOS_RP_PROCEDIMENTO.solucao) &&
                            !prorrogacaoPendente && !podeRegistrarPrazo && (
                              <DropdownMenuItem disabled>Nenhum ato pendente</DropdownMenuItem>
                            )}
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              {publicacoes.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
                  Ainda não há notas criadas para este procedimento.
                </p>
              ) : (
                <ul className="space-y-2">
                  {publicacoes.map((pub) => {
                    const status = calcularStatusPublicacaoRegistro(pub);
                    return (
                      <li key={pub.id} className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="min-w-0 text-sm font-semibold text-slate-800">{ROTULOS_PUBLICACAO_PROCEDIMENTO[pub.tipo] || pub.tipo}</p>
                          <span className={'shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ' + (CLASSES_STATUS_PUBLICACAO[status] || CLASSES_STATUS_PUBLICACAO.padrao)}>
                            {status}
                          </span>
                        </div>
                        <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
                          <div className="flex items-baseline gap-1.5">
                            <dt className="text-slate-500">Nota nº</dt>
                            <dd className="font-semibold text-slate-800">{pub.nota_para_bg || 'Pendente'}</dd>
                          </div>
                          <div className="flex items-baseline gap-1.5">
                            <dt className="text-slate-500">BG nº</dt>
                            <dd className="font-semibold text-slate-800">{pub.numero_bg || 'Pendente'}</dd>
                          </div>
                          <div className="flex items-baseline gap-1.5">
                            <dt className="text-slate-500">Data do BG</dt>
                            <dd className="font-medium text-slate-700">{pub.data_bg ? formatarData(pub.data_bg) : '—'}</dd>
                          </div>
                        </dl>
                        {podeVerPublicacoes && (
                          <div className="mt-2 border-t border-slate-200 pt-2">
                            <Link className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" to={'/Publicacoes?publicacao_id=' + encodeURIComponent(pub.id)}>
                              Ver nota e atualizar publicação <ExternalLink className="h-3.5 w-3.5" />
                            </Link>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
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
              {podeRegistrarPrazo && (
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