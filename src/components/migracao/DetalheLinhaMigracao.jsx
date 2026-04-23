import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function DetalheLinhaMigracao({ linha, open, onOpenChange, onSalvarCorrecao, saving = false }) {
  const [form, setForm] = useState({
    nome_completo: '',
    nome_guerra: '',
    matricula: '',
    cpf: '',
    data_inclusao: '',
  });

  useEffect(() => {
    setForm({
      nome_completo: linha?.transformado?.nome_completo || '',
      nome_guerra: linha?.transformado?.nome_guerra || '',
      matricula: linha?.transformado?.matricula || '',
      cpf: linha?.transformado?.cpf || '',
      data_inclusao: linha?.transformado?.data_inclusao || '',
    });
  }, [linha]);

  const handleChange = (campo, valor) => setForm((prev) => ({ ...prev, [campo]: valor }));
  const handleSalvar = () => onSalvarCorrecao?.(linha.linhaNumero, form);
  if (!linha) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes da linha {linha.linhaNumero}</DialogTitle>
        </DialogHeader>

        <section className="border border-slate-200 rounded-lg p-4 bg-white space-y-3">
          <h3 className="font-semibold text-sm">Correção pré-importação</h3>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Nome Completo</Label>
              <Input value={form.nome_completo} onChange={(event) => handleChange('nome_completo', event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Nome de Guerra</Label>
              <Input value={form.nome_guerra} onChange={(event) => handleChange('nome_guerra', event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Matrícula</Label>
              <Input value={form.matricula} onChange={(event) => handleChange('matricula', event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>CPF</Label>
              <Input value={form.cpf} onChange={(event) => handleChange('cpf', event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Data de Inclusão</Label>
              <Input value={form.data_inclusao} onChange={(event) => handleChange('data_inclusao', event.target.value)} placeholder="dd/mm/aaaa ou aaaa-mm-dd" />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSalvar} disabled={saving}>{saving ? 'Salvando...' : 'Salvar correção'}</Button>
          </div>
        </section>

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
