import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function DetalheLinhaMigracao({ linha, open, onOpenChange }) {
  if (!linha) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes da linha {linha.linhaNumero}</DialogTitle>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-4 text-sm">
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
          <section className="bg-rose-50 rounded-lg p-3">
            <h3 className="font-semibold mb-2">Erros</h3>
            {linha.erros.length === 0 ? <p>Nenhum erro.</p> : <ul className="list-disc pl-5">{linha.erros.map((e) => <li key={e}>{e}</li>)}</ul>}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
