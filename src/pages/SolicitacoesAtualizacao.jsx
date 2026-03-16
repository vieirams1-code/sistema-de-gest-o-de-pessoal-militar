import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { CheckCircle, XCircle, Clock, User, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import RequireAdmin from '@/components/auth/RequireAdmin';

const CAMPOS_MUTAVEIS_WHITELIST = new Set([
  'telefone',
  'telefone_contato',
  'email',
  'endereco',
  'cep',
  'bairro',
  'cidade',
  'estado',
  'numero',
  'complemento',
  'nome_contato_emergencia',
  'telefone_contato_emergencia',
]);

const statusConfig = {
  'Pendente': { color: 'bg-amber-100 text-amber-700', icon: Clock },
  'Aprovada': { color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  'Rejeitada': { color: 'bg-red-100 text-red-700', icon: XCircle },
};

function formatDate(d) {
  if (!d) return '—';
  try { return format(new Date(d + 'T00:00:00'), 'dd/MM/yyyy'); } catch { return d; }
}

export default function SolicitacoesAtualizacao() {
  const queryClient = useQueryClient();
  const { user, isAdmin } = useCurrentUser();
  const [filtroStatus, setFiltroStatus] = useState('Pendente');
  const [decisaoModal, setDecisaoModal] = useState(null); // { solicitacao, acao: 'aprovar'|'rejeitar' }
  const [obsDecisao, setObsDecisao] = useState('');
  const [processing, setProcessing] = useState(false);

  const { data: solicitacoes = [], isLoading } = useQuery({
    queryKey: ['solicitacoes-atualizacao', filtroStatus],
    queryFn: () => base44.entities.SolicitacaoAtualizacao.filter(
      filtroStatus === 'todos' ? {} : { status: filtroStatus },
      '-data_solicitacao'
    ),
  });

  const handleDecisao = async () => {
    const { solicitacao, acao } = decisaoModal;
    if (!isAdmin) return;
    setProcessing(true);
    const novoStatus = acao === 'aprovar' ? 'Aprovada' : 'Rejeitada';
    await base44.entities.SolicitacaoAtualizacao.update(solicitacao.id, {
      status: novoStatus,
      usuario_decisao: user?.full_name || user?.email || 'Usuário',
      data_decisao: new Date().toISOString().split('T')[0],
      observacao_decisao: obsDecisao,
    });

    // Se aprovado: atualizar o cadastro do militar
    if (acao === 'aprovar' && solicitacao.militar_id && solicitacao.campo_chave) {
      if (CAMPOS_MUTAVEIS_WHITELIST.has(solicitacao.campo_chave)) {
        await base44.entities.Militar.update(solicitacao.militar_id, {
          [solicitacao.campo_chave]: solicitacao.valor_proposto,
        });
      }
    }

    queryClient.invalidateQueries({ queryKey: ['solicitacoes-atualizacao'] });
    setDecisaoModal(null);
    setObsDecisao('');
    setProcessing(false);
  };

  // Exceção temporária: mantido em admin puro (RequireAdmin) até a criação
  // de uma action key específica (ex: gerir_solicitacoes_atualizacao).
  return (
    <RequireAdmin>
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#1e3a5f]">Solicitações de Atualização Cadastral</h1>
            <p className="text-slate-500 text-sm">Analise e aprove solicitações de correção de dados</p>
          </div>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Pendente">Pendentes</SelectItem>
              <SelectItem value="Aprovada">Aprovadas</SelectItem>
              <SelectItem value="Rejeitada">Rejeitadas</SelectItem>
              <SelectItem value="todos">Todas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" /></div>
        ) : solicitacoes.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
            <Clock className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500">Nenhuma solicitação {filtroStatus !== 'todos' ? filtroStatus.toLowerCase() : ''}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {solicitacoes.map(s => {
              const cfg = statusConfig[s.status] || statusConfig['Pendente'];
              const Ico = cfg.icon;
              return (
                <div key={s.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <Badge className={cfg.color + ' text-xs flex items-center gap-1'}>
                          <Ico className="w-3 h-3" />{s.status}
                        </Badge>
                        <span className="text-sm font-semibold text-slate-700">{s.militar_posto} {s.militar_nome}</span>
                        <span className="text-xs text-slate-400">Mat. {s.militar_matricula}</span>
                      </div>
                      <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-100 text-sm">
                        <div>
                          <p className="text-xs text-slate-400 mb-0.5">Campo</p>
                          <p className="font-semibold text-slate-700">{s.campo_label}</p>
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-slate-400 mb-0.5">Valor atual</p>
                          <p className="text-slate-600">{s.valor_atual || '(vazio)'}</p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                        <div className="flex-1">
                          <p className="text-xs text-slate-400 mb-0.5">Valor proposto</p>
                          <p className="font-semibold text-emerald-700">{s.valor_proposto}</p>
                        </div>
                      </div>
                      {s.justificativa && (
                        <p className="text-xs text-slate-500 mt-2 italic">Justificativa: {s.justificativa}</p>
                      )}
                      <div className="flex gap-4 mt-2 text-xs text-slate-400">
                        <span>Solicitado em: {formatDate(s.data_solicitacao)}</span>
                        {s.data_decisao && <span>Decisão em: {formatDate(s.data_decisao)} por {s.usuario_decisao}</span>}
                      </div>
                      {s.observacao_decisao && (
                        <p className="text-xs text-slate-500 mt-1">Obs. decisão: {s.observacao_decisao}</p>
                      )}
                    </div>
                    {isAdmin && s.status === 'Pendente' && (
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => { setDecisaoModal({ solicitacao: s, acao: 'aprovar' }); setObsDecisao(''); }}>
                          <CheckCircle className="w-4 h-4 mr-1" /> Aprovar
                        </Button>
                        <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => { setDecisaoModal({ solicitacao: s, acao: 'rejeitar' }); setObsDecisao(''); }}>
                          <XCircle className="w-4 h-4 mr-1" /> Rejeitar
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AlertDialog open={!!decisaoModal} onOpenChange={() => setDecisaoModal(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{decisaoModal?.acao === 'aprovar' ? 'Aprovar' : 'Rejeitar'} solicitação?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                {decisaoModal?.acao === 'aprovar' && (
                  <p className="mb-3 text-emerald-700 font-medium">O cadastro do militar será atualizado automaticamente.</p>
                )}
                <label className="text-sm font-medium text-slate-700 block mb-1">Observação (opcional)</label>
                <textarea
                  value={obsDecisao}
                  onChange={e => setObsDecisao(e.target.value)}
                  rows={3}
                  className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none"
                  placeholder="Informe o motivo da decisão..."
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={processing}
              className={decisaoModal?.acao === 'aprovar' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}
              onClick={handleDecisao}
            >
              {processing ? 'Processando...' : decisaoModal?.acao === 'aprovar' ? 'Confirmar Aprovação' : 'Confirmar Rejeição'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </RequireAdmin>
  );
}