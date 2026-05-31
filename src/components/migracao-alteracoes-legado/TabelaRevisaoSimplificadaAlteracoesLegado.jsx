import React from 'react';
import { RotateCcw, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const statusClass = {
  pronta: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  erro: 'bg-rose-100 text-rose-800 border-rose-200',
  duplicada: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  recusada: 'bg-slate-200 text-slate-700 border-slate-300',
};

function ListaMensagens({ itens, vazio = '—' }) {
  if (!itens?.length) return <span className="text-slate-400">{vazio}</span>;
  return <div className="space-y-1">{itens.map((item) => <p key={item}>{item}</p>)}</div>;
}

export default function TabelaRevisaoSimplificadaAlteracoesLegado({
  linhas,
  tiposPublicacaoValidos = [],
  onAlterarLinha,
  onAlternarRecusa,
}) {
  if (!linhas.length) {
    return <div className="bg-white border border-slate-200 rounded-xl p-6 text-sm text-slate-500">Nenhum registro encontrado para os filtros aplicados.</div>;
  }

  return (
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
        <h3 className="text-sm font-semibold text-slate-700">Revisão simplificada</h3>
        <p className="text-xs text-slate-500">Corrija os dados antes da importação. Linhas recusadas deixam de bloquear a conclusão.</p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Status</TableHead>
            <TableHead>Linha</TableHead>
            <TableHead className="min-w-36">Número nota</TableHead>
            <TableHead className="min-w-32">Número BG/BR</TableHead>
            <TableHead className="min-w-36">Data BG/BR</TableHead>
            <TableHead className="min-w-40">Tipo legado</TableHead>
            <TableHead className="min-w-52">Tipo classificado</TableHead>
            <TableHead className="min-w-80">Texto publicado</TableHead>
            <TableHead className="min-w-64">Erros</TableHead>
            <TableHead className="min-w-64">Avisos</TableHead>
            <TableHead>Ação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {linhas.map((linha) => {
            const desabilitada = linha.recusada;
            const valorTipo = linha.tipo_classificado || '__fallback__';
            return (
              <TableRow key={linha.linhaNumero} className={cn(desabilitada && 'bg-slate-50 opacity-75')}>
                <TableCell><Badge className={cn('border capitalize', statusClass[linha.status])}>{linha.status}</Badge></TableCell>
                <TableCell>{linha.linhaNumero}</TableCell>
                <TableCell><Input disabled={desabilitada} value={linha.numero_nota} onChange={(e) => onAlterarLinha(linha, { numero_nota: e.target.value })} /></TableCell>
                <TableCell><Input disabled={desabilitada} value={linha.numero_bg_br} onChange={(e) => onAlterarLinha(linha, { numero_bg_br: e.target.value })} /></TableCell>
                <TableCell><Input disabled={desabilitada} value={linha.data_bg_br} onChange={(e) => onAlterarLinha(linha, { data_bg_br: e.target.value })} placeholder="dd/mm/aaaa" /></TableCell>
                <TableCell className="text-xs text-slate-700">{linha.tipo_legado || '—'}</TableCell>
                <TableCell>
                  <Select disabled={desabilitada} value={valorTipo} onValueChange={(valor) => onAlterarLinha(linha, { tipo_classificado: valor === '__fallback__' ? '' : valor })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__fallback__">{linha.tipo_legado ? `${linha.tipo_legado} (fallback legado)` : 'Sem classificação'}</SelectItem>
                      {tiposPublicacaoValidos.map((tipo) => <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell><Textarea disabled={desabilitada} value={linha.texto_publicado} onChange={(e) => onAlterarLinha(linha, { texto_publicado: e.target.value })} className="min-h-20" /></TableCell>
                <TableCell className="text-xs text-rose-700"><ListaMensagens itens={linha.erros} /></TableCell>
                <TableCell className="text-xs text-amber-700"><ListaMensagens itens={linha.avisos} /></TableCell>
                <TableCell>
                  <Button type="button" variant="outline" size="sm" className={cn(!desabilitada && 'text-rose-700 border-rose-200')} onClick={() => onAlternarRecusa(linha)}>
                    {desabilitada ? <RotateCcw className="w-4 h-4 mr-1" /> : <XCircle className="w-4 h-4 mr-1" />}
                    {desabilitada ? 'Restaurar' : 'Recusar'}
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </section>
  );
}
