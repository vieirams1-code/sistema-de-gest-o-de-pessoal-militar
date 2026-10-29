import React from 'react';
import { Input } from '@/components/ui/input';


export default function NotaColetivaCampos({ dados, onChange, disabled, podePublicar, tipos }) {
  const campo = (nome, label, type = 'text', required = false) => <label className="block space-y-1 text-sm" key={nome}>
    <span>{label}</span><Input aria-label={label} type={type} required={required} value={dados[nome] || ''} disabled={disabled || (['nota_para_bg', 'numero_bg', 'data_bg'].includes(nome) && !podePublicar)} onChange={e => onChange(nome, e.target.value)} />
  </label>;
  return <section className="space-y-4">
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block space-y-1 text-sm"><span>Tipo da publicação</span><select aria-label="Tipo da publicação coletiva" className="h-10 w-full rounded-md border bg-background px-3" value={dados.tipo} disabled={disabled} onChange={e => onChange('tipo', e.target.value)}>
        {tipos.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select></label>
      {campo('data_publicacao', 'Data da publicação', 'date', true)}
      {campo('nota_para_bg', 'Nota para BG')}{campo('numero_bg', 'Número do BG')}{campo('data_bg', 'Data do BG', 'date')}
    </div>

  </section>;
}