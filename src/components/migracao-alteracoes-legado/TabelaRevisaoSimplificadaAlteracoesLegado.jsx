import React from 'react';
import { RotateCcw, XCircle, AlertTriangle, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const statusClass = {
  pronta: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  erro: 'bg-orange-100 text-orange-800 border-orange-200',
  duplicada: 'bg-red-100 text-red-800 border-red-200',
  recusada: 'bg-slate-200 text-slate-700 border-slate-300',
};

function ListaMensagens({ itens, tipo = 'aviso', vazio = '—' }) {
  if (!itens?.length) return <span className="text-slate-400">{vazio}</span>;
  
  const Icon = tipo === 'erro' ? AlertCircle : AlertTriangle;

  return (
    <div className="space-y-1.5">
      {itens.map((item, idx) => (
        <p key={idx} className="flex items-start gap-1.5 leading-snug">
          <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{item}</span>
        </p>
      ))}
    </div>
  );
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
            <TableHead className="min-w-56">Status publicação</TableHead>
            <TableHead className="min-w-36">Número nota</TableHead>
            <TableHead className="min-w-32">Número BG/BR</TableHead>
            <TableHead className="min-w-32">Tipo BG</TableHead>
            <TableHead className="min-w-36">Data BG/BR</TableHead>
            <TableHead className="min-w-40">Matéria</TableHead>
            <TableHead className="min-w-52">Tipo classificado</TableHead>
            <TableHead className="min-w-80">Texto publicado</TableHead>
            <TableHead className="min-w-64">Erros</TableHead>
            <TableHead className="min-w-64">Avisos</TableHead>
            <TableHead>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {linhas.map((linha) => {
            const desabilitada = linha.recusada;
            const isDuplicada = linha.statusSimplificado === 'duplicada';
            const valorTipo = linha.tipo_classificado || '__fallback__';
            
            const statusVisual = desabilitada 
              ? 'recusada' 
              : (linha.statusSimplificado || linha.status?.toLowerCase() || 'erro');
            
            const badgeLabel = desabilitada ? 'RECUSADA' : statusVisual.toUpperCase();
            
            const tipoBg = linha.tipo_bg_legado || linha.transformado?.tipo_bg_legado || '—';
            const materia = linha.materia_legado || linha.tipo_legado || linha.transformado?.materia_legado || '—';

            return (
              <TableRow 
                key={linha.linhaNumero} 
                className={cn(
                  desabilitada && 'bg-slate-100 opacity-60 text-slate-500 grayscale',
                  !desabilitada && isDuplicada && 'border-2 border-red-400 bg-red-50/40'
                )}
              >
                <TableCell><Badge className={cn('border', statusClass[statusVisual] || statusClass.erro)}>{badgeLabel}</Badge></TableCell>
                <TableCell>{linha.linhaNumero}</TableCell>
                <TableCell className="text-xs font-medium text-slate-700">{linha.status_publicacao}</TableCell>
                <TableCell><Input disabled={desabilitada} value={linha.numero_nota || ''} onChange={(e) => onAlterarLinha(linha, { numero_nota: e.target.value })} /></TableCell>
                <TableCell><Input disabled={desabilitada} value={linha.numero_bg_br || ''} onChange={(e) => onAlterarLinha(linha, { numero_bg_br: e.target.value })} /></TableCell>
                <TableCell className="text-xs font-medium">{tipoBg}</TableCell>
                <TableCell><Input disabled={desabilitada} value={linha.data_bg_br || ''} onChange={(e) => onAlterarLinha(linha, { data_bg_br: e.target.value })} placeholder="dd/mm/aaaa" /></TableCell>
                <TableCell className="text-xs font-medium">{materia}</TableCell>
                <TableCell>
                  <Select disabled={desabilitada} value={valorTipo} onValueChange={(valor) => onAlterarLinha(linha, { tipo_classificado: valor === '__fallback__' ? '' : valor })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__fallback__">{linha.tipo_legado ? `${linha.tipo_legado} (fallback legado)` : 'Sem classificação'}</SelectItem>
                      {tiposPublicacaoValidos.map((tipo) => <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell><Textarea disabled={desabilitada} value={linha.texto_publicado || ''} onChange={(e) => onAlterarLinha(linha, { texto_publicado: e.target.value })} className="min-h-20" /></TableCell>
                <TableCell className="text-xs text-rose-700 font-medium"><ListaMensagens itens={linha.erros} tipo="erro" /></TableCell>
                <TableCell className="text-xs text-amber-700 font-medium"><ListaMensagens itens={linha.avisos} tipo="aviso" /></TableCell>
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
