import React from 'react';
import { Archive, Check, FileText, RotateCcw, Search } from 'lucide-react';
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

export default function ArquivoDoemsCard({ diarios = [], carregando, onAbrirArquivo, onRetomarAnalise, onAlternarStatus }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-lg text-[#1e3a5f] flex items-center gap-2">
            <Archive className="w-5 h-5" />Diários importados
          </CardTitle>
          <Badge variant="outline">{diarios.length} no arquivo</Badge>
        </div>
        <p className="text-sm text-slate-500">Histórico dos DOEMS já lidos, com edição, data, situação e a análise salva para retomar a revisão.</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {carregando && <p className="text-sm text-slate-500">Carregando o arquivo de diários…</p>}
        {!carregando && diarios.length === 0 && (
          <p className="text-sm text-slate-500">Nenhum diário importado ainda. Ao ler um PDF, ele passa a constar aqui.</p>
        )}
        {diarios.map((diario) => (
          <div key={diario.id} className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">DOEMS Nº {diario.numero_edicao}</Badge>
                <span className="text-sm font-medium text-slate-800">{formatarData(diario.data_publicacao)}</span>
                <Badge className={CORES_STATUS[diario.status] || 'bg-slate-100 text-slate-700'}>{diario.status || 'Em análise'}</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {diario.analise_ia_json && (
                  <Button size="sm" variant="outline" onClick={() => onRetomarAnalise(diario)}>
                    <Search className="w-4 h-4 mr-1.5" />Reabrir revisão
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => onAbrirArquivo(diario)} disabled={!diario.arquivo_uri}>
                  <FileText className="w-4 h-4 mr-1.5" />Abrir PDF
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onAlternarStatus(diario)}>
                  {diario.status === 'Concluído'
                    ? <><RotateCcw className="w-4 h-4 mr-1.5" />Reabrir</>
                    : <><Check className="w-4 h-4 mr-1.5" />Concluir</>}
                </Button>
              </div>
            </div>
            <p className="text-xs text-slate-600">
              {diario.total_paginas || 0} página(s) · {diario.total_trechos || 0} trecho(s) lido(s) ·
              {' '}{diario.trechos_com_sugestao || 0} com sugestão · {diario.trechos_importados || 0} importado(s)
              {diario.trechos_truncados ? ' · leitura limitada ao primeiro bloco de páginas' : ''}
            </p>
            <p className="text-xs text-slate-500">
              {diario.arquivo_nome}
              {diario.importado_por_email ? ` · importado por ${diario.importado_por_email}` : ''}
              {diario.analise_ia_em ? ` · análise IA em ${formatarDataHora(diario.analise_ia_em)}` : ''}
              {diario.concluido_em ? ` · concluído em ${formatarDataHora(diario.concluido_em)}` : ''}
            </p>
            {diario.analise_ia_em && (
              <p className="text-xs text-slate-500">
                Análise IA: {diario.analise_ia_chamadas || 1} chamada(s) · {diario.trechos_com_sugestao || 0} trecho(s) com sugestão
                {diario.analise_ia_por_email ? ` · por ${diario.analise_ia_por_email}` : ''}
              </p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}