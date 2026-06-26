import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  ExternalLink, ArrowLeftRight, CheckCircle2, Archive, Send, Clock,
} from 'lucide-react';
import {
  getStatusBadgeClass, getPrioridadeBadgeClass,
} from '@/utils/controle-processos/controleProcessosConfig';
import { sanitizarLinkExterno } from '@/utils/controle-processos/sanitizarLinkExterno';
import { listarTramites, listarEventos } from '@/services/controleProcessosService';

function formatDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('pt-BR');
}

function Linha({ label, valor }) {
  if (!valor) return null;
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-slate-500 w-32 flex-shrink-0">{label}</span>
      <span className="text-slate-800 break-words">{valor}</span>
    </div>
  );
}

export default function ProcessoDetalheModal({
  open, onClose, processo, caixaNome, caixasById = {},
  podeTramitar, podeArquivar, podeEditar,
  onTramitar, onConcluir, onArquivar, onDespacho,
}) {
  const [despacho, setDespacho] = useState('');
  const [enviando, setEnviando] = useState(false);

  const { data: tramites = [], refetch: refetchTramites } = useQuery({
    queryKey: ['processo-tramites', processo?.id],
    queryFn: () => listarTramites(processo.id),
    enabled: open && !!processo?.id,
  });

  const { data: eventos = [], refetch: refetchEventos } = useQuery({
    queryKey: ['processo-eventos', processo?.id],
    queryFn: () => listarEventos(processo.id),
    enabled: open && !!processo?.id,
  });

  if (!processo) return null;

  const handleDespacho = async () => {
    if (!despacho.trim()) return;
    setEnviando(true);
    await onDespacho(processo, despacho.trim());
    setDespacho('');
    setEnviando(false);
    refetchEventos();
  };

  const handleTramitar = () => {
    onTramitar(processo);
  };

  const handleConcluir = async () => {
    await onConcluir(processo);
    refetchEventos();
  };
  const linkExternoSeguro = processo.link_externo
    ? sanitizarLinkExterno(processo.link_externo).linkLimpo
    : '';

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="pr-6">{processo.titulo}</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline">{processo.tipo_interno}</Badge>
          {processo.sistema_origem && <Badge variant="secondary">{processo.sistema_origem}</Badge>}
          <Badge className={getStatusBadgeClass(processo.status)}>{processo.status}</Badge>
          <Badge className={getPrioridadeBadgeClass(processo.prioridade)}>{processo.prioridade}</Badge>
        </div>

        {/* Ações rápidas */}
        <div className="flex flex-wrap gap-2 border-y border-slate-100 py-3">
          {linkExternoSeguro && (
            <Button variant="outline" size="sm" asChild>
              <a href={linkExternoSeguro} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-1.5" /> Abrir no sistema externo
              </a>
            </Button>
          )}
          {podeTramitar && (
            <Button variant="outline" size="sm" onClick={handleTramitar}>
              <ArrowLeftRight className="w-4 h-4 mr-1.5" /> Tramitar
            </Button>
          )}
          {podeEditar && processo.status !== 'Concluído' && (
            <Button variant="outline" size="sm" onClick={handleConcluir}>
              <CheckCircle2 className="w-4 h-4 mr-1.5" /> Concluir
            </Button>
          )}
          {podeArquivar && !processo.arquivado && (
            <Button variant="outline" size="sm" className="text-amber-700" onClick={() => onArquivar(processo)}>
              <Archive className="w-4 h-4 mr-1.5" /> Arquivar
            </Button>
          )}
        </div>

        {/* Dados principais */}
        <div className="space-y-1.5">
          <Linha label="Caixa atual" valor={caixaNome} />
          <Linha label="Responsável" valor={processo.responsavel_id} />
          <Linha label="NUP" valor={processo.nup} />
          <Linha label="Nº documento" valor={processo.numero_documento} />
          <Linha label="Assunto" valor={processo.assunto} />
          <Linha label="Prazo" valor={processo.prazo ? new Date(`${processo.prazo}T00:00:00`).toLocaleDateString('pt-BR') : ''} />
          <Linha label="Descrição" valor={processo.descricao_operacional} />
          {(processo.interessados_ids || []).length > 0 && (
            <Linha label="Interessados" valor={`${processo.interessados_ids.length} militar(es) vinculado(s)`} />
          )}
        </div>

        {/* Novo despacho */}
        {podeEditar && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-slate-800">Novo despacho interno</h4>
            <Textarea value={despacho} onChange={(e) => setDespacho(e.target.value)} rows={2} placeholder="Escreva um despacho..." />
            <div className="flex justify-end">
              <Button size="sm" onClick={handleDespacho} disabled={!despacho.trim() || enviando}>
                <Send className="w-4 h-4 mr-1.5" /> {enviando ? 'Registrando...' : 'Registrar despacho'}
              </Button>
            </div>
          </div>
        )}

        {/* Histórico de tramitações */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-slate-800">Histórico de tramitações</h4>
          {tramites.length === 0 ? (
            <p className="text-xs text-slate-400">Nenhuma tramitação registrada.</p>
          ) : (
            <div className="space-y-2">
              {tramites.map((t) => (
                <div key={t.id} className="rounded-md border border-slate-100 p-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-700">
                      {caixasById[t.caixa_origem_id]?.nome || 'Origem'} → {caixasById[t.caixa_destino_id]?.nome || 'Destino'}
                    </span>
                    <span className="text-slate-400">{formatDateTime(t.data_envio)}</span>
                  </div>
                  {t.acao_solicitada && <p className="text-slate-600 mt-0.5">Ação: {t.acao_solicitada}{t.urgente ? ' • Urgente' : ''}</p>}
                  {t.mensagem && <p className="text-slate-600 mt-0.5">{t.mensagem}</p>}
                  <p className="text-slate-400 mt-0.5">Por {t.remetente_id}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Linha do tempo de eventos */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-slate-800">Linha do tempo</h4>
          {eventos.length === 0 ? (
            <p className="text-xs text-slate-400">Nenhum evento registrado.</p>
          ) : (
            <div className="space-y-2 border-l-2 border-slate-100 pl-4">
              {eventos.map((ev) => (
                <div key={ev.id} className="relative">
                  <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-slate-300" />
                  <p className="text-xs text-slate-700">{ev.descricao || ev.tipo_evento}</p>
                  <p className="text-[11px] text-slate-400 inline-flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {formatDateTime(ev.data_evento)} — {ev.usuario_id}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
