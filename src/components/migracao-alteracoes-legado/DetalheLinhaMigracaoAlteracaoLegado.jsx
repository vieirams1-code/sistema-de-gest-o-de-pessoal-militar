import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

function labelMilitar(m) {
  return `${m.posto_graduacao ? `${m.posto_graduacao} ` : ''}${m.nome_completo || m.nome_guerra || ''} ${m.matricula ? `(${m.matricula})` : ''}`.trim();
}

export default function DetalheLinhaMigracaoAlteracaoLegado({ linha, open, onOpenChange, militares = [], onSelecionarMilitar }) {
  if (!linha) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes da linha {linha.linhaNumero}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="bg-slate-50 rounded-lg p-3 space-y-2">
            <Label>Selecionar / trocar militar vinculado</Label>
            <Select
              value={linha.transformado.militar_id || '__none__'}
              onValueChange={(valor) => {
                if (!valor || valor === '__none__') return;
                const militar = militares.find((m) => m.id === valor);
                if (militar) onSelecionarMilitar?.(linha, militar);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um militar" />
              </SelectTrigger>
              <SelectContent>
                {linha.transformado.militar_id ? null : <SelectItem value="__none__">Sem vínculo</SelectItem>}
                {militares.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{labelMilitar(m)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <section className="bg-emerald-50 rounded-lg p-3 md:col-span-2">
              <h3 className="font-semibold mb-2">Trecho legado capturado</h3>
              <p className="text-xs whitespace-pre-wrap">{linha.transformado.conteudo_trecho_legado || 'Sem trecho legado informado na planilha.'}</p>
            </section>
            <section className="bg-slate-50 rounded-lg p-3">
              <h3 className="font-semibold mb-2">Dados originais</h3>
              <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(linha.original, null, 2)}</pre>
            </section>
            <section className="bg-slate-50 rounded-lg p-3">
              <h3 className="font-semibold mb-2">Dados transformados</h3>
              <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(linha.transformado, null, 2)}</pre>
            </section>
            <section className="bg-amber-50 rounded-lg p-3">
              <h3 className="font-semibold mb-2">Alertas</h3>
              {linha.alertas.length === 0 ? <p>Nenhum alerta.</p> : <ul className="list-disc pl-5">{linha.alertas.map((a) => <li key={a}>{a}</li>)}</ul>}
            </section>
            <section className="bg-indigo-50 rounded-lg p-3">
              <h3 className="font-semibold mb-2">Pendências de revisão</h3>
              {(linha.revisoes || []).length === 0 ? <p>Nenhuma pendência de revisão.</p> : <ul className="list-disc pl-5">{(linha.revisoes || []).map((r) => <li key={r}>{r}</li>)}</ul>}
            </section>
            <section className="bg-rose-50 rounded-lg p-3 md:col-span-2">
              <h3 className="font-semibold mb-2">Erros bloqueantes</h3>
              {linha.erros.length === 0 ? <p>Nenhum erro bloqueante.</p> : <ul className="list-disc pl-5">{linha.erros.map((e) => <li key={e}>{e}</li>)}</ul>}
            </section>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
