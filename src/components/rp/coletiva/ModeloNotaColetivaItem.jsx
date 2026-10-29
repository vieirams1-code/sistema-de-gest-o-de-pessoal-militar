import React, { useState } from 'react';
import { Button } from '@/components/ui/button';

export default function ModeloNotaColetivaItem({ modelo, onEdit, onDelete, pending }) {
  const [confirmar, setConfirmar] = useState(false);
  return <article className="space-y-2 rounded-md border p-3" data-modelo-id={modelo.id}>
    <h3 className="font-medium">{modelo.nome}</h3>
    <p className="text-xs text-muted-foreground">{modelo.tipo} · {modelo.ativo ? 'Ativo' : 'Inativo'}</p>
    <p className="whitespace-pre-wrap break-words text-sm">{modelo.cabecalho}</p>
    <div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => onEdit(modelo)}>Editar modelo</Button>
      <Button type="button" size="sm" variant={confirmar ? 'destructive' : 'outline'} disabled={pending} onClick={() => confirmar ? onDelete(modelo.id) : setConfirmar(true)}>{confirmar ? 'Confirmar exclusão do modelo' : 'Excluir modelo'}</Button>
      {confirmar && <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmar(false)}>Não excluir</Button>}
    </div>
  </article>;
}