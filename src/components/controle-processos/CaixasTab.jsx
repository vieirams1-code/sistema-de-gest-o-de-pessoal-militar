import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Users, ShieldCheck, Inbox } from 'lucide-react';

export default function CaixasTab({ caixas = [], onNova, onEditar, salvando }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={onNova} disabled={salvando}>
          <Plus className="w-4 h-4 mr-1.5" /> Nova caixa
        </Button>
      </div>

      {caixas.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-10 text-center">
          <Inbox className="w-8 h-8 mx-auto text-slate-300 mb-2" />
          <p className="text-sm text-slate-500">Nenhuma caixa processual cadastrada.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {caixas.map((c) => (
            <div key={c.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-900 truncate">{c.nome}</p>
                    {c.ativa === false && <Badge variant="secondary" className="text-xs">Inativa</Badge>}
                  </div>
                  {c.descricao && <p className="text-xs text-slate-500 mt-0.5">{c.descricao}</p>}
                  <div className="mt-2 flex items-center gap-4 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" /> {(c.usuarios_ids || []).length} membro(s)
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" /> {(c.gestores_ids || []).length} gestor(es)
                    </span>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => onEditar(c)} className="flex-shrink-0">
                  <Pencil className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}