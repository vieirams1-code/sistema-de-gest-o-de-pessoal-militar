import React from 'react';
import { Archive, Check, FileText, RotateCcw, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const CORES_STATUS = {
  'Em análise': 'bg-blue-100 text-blue-800',
  'Em conciliação': 'bg-amber-100 text-amber-800',
  Concluído: 'bg-emerald-100 text-emerald-800',
  Arquivado: 'bg-slate-200 text-slate-700',
};

const STATUS_EDITAVEIS = ['Em análise', 'Em conciliação', 'Concluído'];

function formatarData(valor) {
  if (!valor) return 'Data não informada';
  const data = new Date(String(valor).slice(0, 10) + 'T12:00:00');
  if (Number.isNaN(data.getTime())) return String(valor);
  return data.toLocaleDateString('pt-BR');
}

function formatarDataHora(valor) {
  if (!valor) return '';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return '';
  return data.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export default function ArquivoBoletinsCard({
  boletins = [],
  carregando,
  reabrindoId = '',
  onAbrirArquivo,
  onReabrir,
  onAlterarStatus,
  onExcluir,
}) {
  const [excluir, setExcluir] = React.useState(null);

  const confirmarExclusao = async () => {
    const alvo = excluir;
    setExcluir(null);
    if (alvo) await onExcluir(alvo);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-lg text-[#1e3a5f] flex items-center gap-2">
            <Archive className="w-5 h-5" />Boletins importados
          </CardTitle>
          <Badge variant="outline">{boletins.length} no arquivo</Badge>
        </div>
        <p className="text-sm text-slate-500">
          Histórico dos PDFs já analisados. Abra um boletim para retomar a conciliação com a análise já salva.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {carregando && <p className="text-sm text-slate-500">Carregando o arquivo de boletins…</p>}
        {!carregando && boletins.length === 0 && (
          <p className="text-sm text-slate-500">Nenhum boletim importado ainda. Ao analisar um PDF, ele passa a constar aqui.</p>
        )}
        {boletins.map((boletim) => (
          <div key={boletim.id} className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{boletim.tipo} Nº {boletim.numero}</Badge>
                <span className="text-sm font-medium text-slate-800">{formatarData(boletim.data_boletim)}</span>
                <Badge className={CORES_STATUS[boletim.status] || 'bg-slate-100 text-slate-700'}>{boletim.status || 'Em análise'}</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={() => onReabrir(boletim)}
                  disabled={!boletim.arquivo_uri || reabrindoId === boletim.id}>
                  <RotateCcw className="w-4 h-4 mr-1.5" />
                  {reabrindoId === boletim.id ? 'Abrindo…' : 'Abrir boletim'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => onAbrirArquivo(boletim)} disabled={!boletim.arquivo_uri}>
                  <FileText className="w-4 h-4 mr-1.5" />PDF
                </Button>
                <select
                  aria-label={`Situação do ${boletim.tipo} ${boletim.numero}`}
                  className="h-8 rounded-md border px-2 text-xs bg-white"
                  value={STATUS_EDITAVEIS.includes(boletim.status) ? boletim.status : 'Em análise'}
                  onChange={event => onAlterarStatus(boletim, event.target.value)}
                >
                  {STATUS_EDITAVEIS.map(status => <option key={status} value={status}>{status}</option>)}
                </select>
                <Button size="sm" variant="ghost" className="text-red-700 hover:text-red-800"
                  aria-label={`Excluir ${boletim.tipo} ${boletim.numero}`}
                  onClick={() => setExcluir(boletim)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <p className="text-xs text-slate-600">
              {boletim.total_notas || 0} nota(s) · {boletim.notas_com_relacionados || 0} com seção de relacionados ·
              {' '}{boletim.militares_relacionados || 0} militar(es) listado(s) · {boletim.notas_sem_militar || 0} sem militar identificado ·
              {' '}{boletim.total_paginas || 0} página(s)
            </p>
            <p className="text-xs text-slate-500">
              {boletim.arquivo_nome}
              {boletim.importado_por_email ? ` · importado por ${boletim.importado_por_email}` : ''}
              {boletim.concluido_em ? ` · concluído em ${formatarDataHora(boletim.concluido_em)}` : ''}
            </p>
            {boletim.analise_ia_em && (
              <p className="text-xs text-slate-500">
                Análise IA: {boletim.analise_ia_chamadas || 1} chamada(s) · {boletim.analise_ia_sugestoes || 0} sugestão(ões) ·
                {' '}{formatarDataHora(boletim.analise_ia_em)}
                {boletim.analise_ia_por_email ? ` por ${boletim.analise_ia_por_email}` : ''}
              </p>
            )}
          </div>
        ))}
      </CardContent>

      <AlertDialog open={Boolean(excluir)} onOpenChange={(aberto) => { if (!aberto) setExcluir(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir boletim do arquivo?</AlertDialogTitle>
            <AlertDialogDescription>
              {excluir ? `${excluir.tipo} Nº ${excluir.numero} será removido do arquivo, junto com a análise de IA salva. `
                + 'As publicações já conciliadas no RP não são alteradas.' : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={confirmarExclusao}>
              <Check className="w-4 h-4 mr-1.5" />Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}