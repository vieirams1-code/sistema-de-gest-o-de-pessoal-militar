import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  MODOS_RECLASSIFICACAO_PROMOCAO_COLETIVA,
  TIPOS_PROMOCAO_COLETIVA,
} from '@/utils/antiguidade/promocaoColetivaRules';

function Field({ label, children }) {
  return <div className="space-y-1"><Label>{label}</Label>{children}</div>;
}

export default function PromocaoColetivaForm({ ato, onChange, onSave, onConferir, onCancelar, readOnly, saving }) {
  const update = (field, value) => onChange({ ...ato, [field]: value });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dados básicos do ato de promoção</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="Número de controle">
            <Input value={ato.numero_controle || ''} onChange={(e) => update('numero_controle', e.target.value)} disabled={readOnly} />
          </Field>
          <Field label="Título">
            <Input value={ato.titulo || ''} onChange={(e) => update('titulo', e.target.value)} disabled={readOnly} />
          </Field>
          <Field label="Status">
            <Input value={ato.status || 'rascunho'} readOnly />
          </Field>
          <Field label="Data da promoção">
            <Input type="date" value={ato.data_promocao || ''} onChange={(e) => update('data_promocao', e.target.value)} disabled={readOnly} />
          </Field>
          <Field label="Data de publicação">
            <Input type="date" value={ato.data_publicacao || ''} onChange={(e) => update('data_publicacao', e.target.value)} disabled={readOnly} />
          </Field>
          <Field label="Boletim de referência">
            <Input value={ato.boletim_referencia || ''} onChange={(e) => update('boletim_referencia', e.target.value)} disabled={readOnly} />
          </Field>
          <Field label="Ato de referência">
            <Input value={ato.ato_referencia || ''} onChange={(e) => update('ato_referencia', e.target.value)} disabled={readOnly} />
          </Field>
          <Field label="Posto/graduação destino">
            <Input value={ato.posto_graduacao_destino || ''} onChange={(e) => update('posto_graduacao_destino', e.target.value)} disabled={readOnly} />
          </Field>
          <Field label="Quadro destino">
            <Input value={ato.quadro_destino || ''} onChange={(e) => update('quadro_destino', e.target.value)} disabled={readOnly} />
          </Field>
          <Field label="Tipo de promoção">
            <select className="h-9 w-full rounded-md border bg-transparent px-3 text-sm" value={ato.tipo_promocao || 'antiguidade'} onChange={(e) => update('tipo_promocao', e.target.value)} disabled={readOnly}>
              {TIPOS_PROMOCAO_COLETIVA.map((tipo) => <option key={tipo.value} value={tipo.value}>{tipo.label}</option>)}
            </select>
          </Field>
          <Field label="Modo de reclassificação">
            <select className="h-9 w-full rounded-md border bg-transparent px-3 text-sm" value={ato.modo_reclassificacao || 'preserva_antiguidade_anterior'} onChange={(e) => update('modo_reclassificacao', e.target.value)} disabled={readOnly}>
              {MODOS_RECLASSIFICACAO_PROMOCAO_COLETIVA.map((modo) => <option key={modo.value} value={modo.value}>{modo.label}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Observações">
          <Textarea value={ato.observacoes || ''} onChange={(e) => update('observacoes', e.target.value)} disabled={readOnly} />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onSave} disabled={readOnly || saving}>{saving ? 'Salvando...' : 'Salvar rascunho'}</Button>
          <Button variant="outline" onClick={onConferir} disabled={readOnly || saving}>Marcar como conferida</Button>
          <Button variant="destructive" onClick={onCancelar} disabled={ato.status === 'cancelada' || saving}>Cancelar ato</Button>
        </div>
      </CardContent>
    </Card>
  );
}
