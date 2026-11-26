import React from 'react';
import { Archive, Check, FileText, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const CORES_STATUS = {
  'Em análise': 'bg-blue-100 text-blue-800',
  'Em conciliação': 'bg-amber-100 text-amber-800',
  Concluído: 'bg-emerald-100 text-emerald-800',
  Arquivado: 'bg-slate-200 text-slate-700',
};

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

export default function ArquivoBoletinsCard({ boletins = [], carregando, onAbrirArquivo, onAlternarStatus }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-lg text-[#1e3a5f] flex items-center gap-2">
            <Archive className="w-5 h-5" />Boletins importados
          </CardTitle>
          <Badge variant="outline">{boletins.length} no arquivo</Badge>
        </div>
        <p className="text-sm text-slate-500">Histórico dos PDFs já analisados, com data, número, tipo e situação da conciliação.</p>
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
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => onAbrirArquivo(boletim)} disabled={!boletim.arquivo_uri}>
                  <FileText className="w-4 h-4 mr-1.5" />Abrir PDF
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onAlternarStatus(boletim)}>
                  {boletim.status === 'Concluído'
                    ? <><RotateCcw className="w-4 h-4 mr-1.5" />Reabrir</>
                    : <><Check className="w-4 h-4 mr-1.5" />Concluir</>}
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
    </Card>
  );
}