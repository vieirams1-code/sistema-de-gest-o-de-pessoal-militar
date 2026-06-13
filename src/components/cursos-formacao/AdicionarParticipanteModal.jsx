import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Plus, Check } from 'lucide-react';
import { fetchScopedMilitares } from '@/services/getScopedMilitaresClient';

export default function AdicionarParticipanteModal({ open, onOpenChange, onConfirmar, saving, idsExistentes = [] }) {
  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [selecionados, setSelecionados] = useState([]);

  const buscar = async () => {
    if (!busca.trim()) return;
    setBuscando(true);
    try {
      const { militares } = await fetchScopedMilitares({ search: busca.trim(), limit: 25, statusCadastro: 'Ativo' });
      setResultados(militares);
    } finally {
      setBuscando(false);
    }
  };

  const toggle = (militar) => {
    setSelecionados((prev) =>
      prev.some((m) => m.id === militar.id) ? prev.filter((m) => m.id !== militar.id) : [...prev, militar],
    );
  };

  const confirmar = async () => {
    await onConfirmar(selecionados);
    setSelecionados([]);
    setResultados([]);
    setBusca('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar Participantes</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2">
          <Input
            placeholder="Buscar por nome ou matrícula"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && buscar()}
          />
          <Button type="button" variant="outline" onClick={buscar} disabled={buscando} className="gap-1">
            <Search className="w-4 h-4" /> Buscar
          </Button>
        </div>

        <div className="max-h-64 overflow-y-auto space-y-1">
          {resultados.map((m) => {
            const jaNoCurso = idsExistentes.includes(m.id);
            const sel = selecionados.some((s) => s.id === m.id);
            return (
              <button
                key={m.id}
                type="button"
                disabled={jaNoCurso}
                onClick={() => toggle(m)}
                className={`w-full flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm ${jaNoCurso ? 'opacity-40 cursor-not-allowed' : sel ? 'border-blue-400 bg-blue-50' : 'hover:bg-slate-50'}`}
              >
                <span className="min-w-0 truncate">
                  <span className="font-medium">{m.posto_graduacao}</span> {m.nome_completo}
                  <span className="text-slate-400"> · {m.matricula}</span>
                </span>
                {jaNoCurso ? <span className="text-xs text-slate-400">no curso</span> : sel ? <Check className="w-4 h-4 text-blue-600" /> : <Plus className="w-4 h-4 text-slate-400" />}
              </button>
            );
          })}
          {resultados.length === 0 && !buscando && <p className="text-sm text-slate-400 text-center py-4">Busque um militar para adicionar.</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" onClick={confirmar} disabled={saving || selecionados.length === 0}>
            {saving ? 'Adicionando...' : `Adicionar (${selecionados.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}