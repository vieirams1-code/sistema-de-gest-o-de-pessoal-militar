import React from 'react';
import { Link } from 'react-router-dom';

export default function NotaColetivaVinculos({ registro }) {
  if (!registro?.coletiva) return null;
  return <details className="rounded-md border p-3 text-sm">
    <summary className="cursor-pointer font-medium">Nota coletiva · {registro.militares_ids?.length || 0} militares vinculados</summary>
    <p className="mt-2 text-muted-foreground">O texto integral desta publicação é o mesmo em todas as fichas vinculadas.</p>
    <ul className="mt-2 space-y-1">{(registro.militares_vinculados || []).map(m => <li key={m.militar_id}>
      <Link className="text-primary underline" to={'/RegistrosMilitar?militar_id=' + encodeURIComponent(m.militar_id)}>{m.militar_posto} · {m.militar_nome} · {m.militar_matricula}</Link>
    </li>)}</ul>
  </details>;
}