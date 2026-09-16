import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
const date = value => value ? value.slice(0,10).split('-').reverse().join('/') : '-';

export default function PreviaGeracaoFeriasModal({ open, onClose, plano, previa, resultado, busy, error, onRefresh, onConfirm }) {
  const bloqueados = resultado?.bloqueados || previa?.bloqueados || [];
  return <Dialog open={open} onOpenChange={value => { if (!value && !busy) onClose(); }}>
    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" onEscapeKeyDown={e => busy && e.preventDefault()} onPointerDownOutside={e => busy && e.preventDefault()}>
      <DialogHeader><DialogTitle>{resultado ? 'Resultado da geração' : 'Conferir geração de férias'}</DialogTitle><DialogDescription>{plano?.titulo} · {plano?.ano_referencia} — somente definições aprovadas no seu escopo; filtros da lista não limitam este lote.</DialogDescription></DialogHeader>
      {busy && <p role="status" className="text-sm text-muted-foreground">{previa ? 'Gerando férias, aguarde...' : 'Conferindo aprovações, saldos e datas...'}</p>}
      {error && <p role="alert" className="rounded-lg border border-destructive p-3 text-sm text-destructive">{error}</p>}
      {resultado ? <p role="status" className="rounded-lg border bg-secondary p-3 font-semibold">{resultado.message}</p> : previa && <>
        <p data-testid="geracao-resumo" className="rounded-lg border bg-secondary p-3 text-sm"><strong>{previa.total_escalas} escala(s) · {previa.total_parcelas} parcela(s)</strong> serão cadastradas como <strong>Prevista</strong>; {previa.ja_geradas} escala(s) já gerada(s) serão preservadas.</p>
        <p className="text-xs text-muted-foreground">{previa.pendentes} resposta(s) pendente(s), não contemplada(s) ou sem aprovação apta ficam fora da geração; nenhuma ausência de resposta é aprovada automaticamente.</p>
        {previa.itens.length ? <div className="overflow-x-auto rounded-lg border"><table className="w-full text-sm"><thead className="bg-muted"><tr>{['Militar / período', 'Parcela', 'Início', 'Fim', 'Retorno', 'Dias'].map(t => <th key={t} className="p-2 text-left">{t}</th>)}</tr></thead><tbody>{previa.itens.flatMap(item => item.parcelas.map(p => <tr key={`${item.opcao_id}-${p.etapa}`} className="border-t"><td className="p-2"><strong>{item.militar_nome}</strong><div className="text-xs text-muted-foreground">{item.militar_posto} · {item.militar_matricula}<br />{item.periodo_ref}</div></td><td className="p-2">{p.etapa}ª</td><td className="p-2 whitespace-nowrap">{date(p.data_inicio)}</td><td className="p-2 whitespace-nowrap">{date(p.data_fim)}</td><td className="p-2 whitespace-nowrap">{date(p.data_retorno)}</td><td className="p-2">{p.dias}</td></tr>))}</tbody></table></div> : <p className="py-4 text-sm text-muted-foreground">Nenhuma nova escala apta para geração.</p>}
      </>}
      {bloqueados.length > 0 && <div className="rounded-lg border p-3"><h3 className="mb-2 text-sm font-semibold">Escalas que exigem revisão ({bloqueados.length})</h3><ul className="space-y-2 text-sm">{bloqueados.map(item => <li key={item.opcao_id}><strong>{item.militar_nome}</strong>: {item.motivo}</li>)}</ul></div>}
      <DialogFooter><Button variant="outline" disabled={busy} onClick={onClose}>{resultado ? 'Concluir' : 'Cancelar'}</Button>{!resultado && <><Button variant="outline" disabled={busy} onClick={onRefresh}>Atualizar prévia</Button><Button disabled={busy || !!error || !previa?.total_escalas} onClick={onConfirm}>Confirmar geração de férias</Button></>}</DialogFooter>
    </DialogContent>
  </Dialog>;
}