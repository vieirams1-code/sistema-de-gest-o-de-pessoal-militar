import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import MilitarSelector from '@/components/atestado/MilitarSelector';
import { PAPEIS_ENVOLVIDO } from '@/components/procedimentos/procedimentoConfig';

const VAZIO = {
  militar_id: '', nome: '', posto: '', quadro: '', matricula: '', papel: 'Investigado', observacao: '',
};

export default function EnvolvidosEditor({ envolvidos = [], onChange }) {
  const atualizar = (indice, patch) => {
    onChange(envolvidos.map((item, i) => (i === indice ? { ...item, ...patch } : item)));
  };

  return (
    <div className="space-y-3">
      {envolvidos.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-200 p-3 text-xs text-slate-500">
          Nenhum envolvido vinculado. Adicione investigados, testemunhas ou outros participantes.
        </p>
      )}

      {envolvidos.map((envolvido, indice) => (
        <div key={indice} className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_180px_auto] sm:items-end">
            <MilitarSelector
              value={envolvido.militar_id}
              onChange={(_, valor) => atualizar(indice, { militar_id: valor || '' })}
              onMilitarSelect={(militar) => {
                if (!militar) {
                  atualizar(indice, { militar_id: '', nome: '', posto: '', quadro: '', matricula: '' });
                  return;
                }
                atualizar(indice, {
                  militar_id: militar.id || '',
                  nome: militar.nome_completo || militar.nome_guerra || '',
                  posto: militar.posto_graduacao || '',
                  quadro: militar.quadro || '',
                  matricula: militar.matricula || '',
                });
              }}
            />
            <div>
              <label className="text-sm font-medium text-slate-700">Papel</label>
              <Select value={envolvido.papel} onValueChange={(valor) => atualizar(indice, { papel: valor })}>
                <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAPEIS_ENVOLVIDO.map((papel) => <SelectItem key={papel} value={papel}>{papel}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-red-600 hover:bg-red-50"
              onClick={() => onChange(envolvidos.filter((_, i) => i !== indice))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <Input
            value={envolvido.observacao || ''}
            onChange={(e) => atualizar(indice, { observacao: e.target.value })}
            placeholder="Observação (opcional)"
            className="mt-2 bg-white"
          />
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...envolvidos, { ...VAZIO }])}>
        <Plus className="mr-1 h-4 w-4" /> Adicionar envolvido
      </Button>
    </div>
  );
}