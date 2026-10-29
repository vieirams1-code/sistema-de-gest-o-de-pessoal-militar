import React from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export default function NotaColetivaCampos({ dados, onChange, disabled, podePublicar }) {
  const campo = (nome, label, type = 'text', required = false) => <label className="block space-y-1 text-sm" key={nome}>
    <span>{label}</span><Input aria-label={label} type={type} required={required} value={dados[nome] || ''} disabled={disabled || (['nota_para_bg', 'numero_bg', 'data_bg'].includes(nome) && !podePublicar)} onChange={e => onChange(nome, e.target.value)} />
  </label>;
  return <section className="space-y-4">
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block space-y-1 text-sm"><span>Tipo da publicação</span><select aria-label="Tipo da publicação coletiva" className="h-10 w-full rounded-md border bg-background px-3" value={dados.tipo} disabled={disabled} onChange={e => onChange('tipo', e.target.value)}>
        <option value="Geral">Geral (atas de TAF e outros atos documentais)</option><option value="Transcrição de Documentos">Transcrição de Documentos</option>
      </select></label>
      {campo('data_publicacao', 'Data da publicação', 'date', true)}
      {campo('nota_para_bg', 'Nota para BG')}{campo('numero_bg', 'Número do BG')}{campo('data_bg', 'Data do BG', 'date')}
    </div>
    <label className="block space-y-1 text-sm"><span>Texto integral da publicação *</span><Textarea aria-label="Texto integral da publicação" rows={9} required disabled={disabled} value={dados.texto_publicacao} onChange={e => onChange('texto_publicacao', e.target.value)} placeholder="Cole a ata completa, incluindo os resultados dos militares." /></label>
    <label className="block space-y-1 text-sm"><span>Observações internas</span><Textarea aria-label="Observações internas da nota" rows={2} disabled={disabled} value={dados.observacoes || ''} onChange={e => onChange('observacoes', e.target.value)} /></label>
  </section>;
}