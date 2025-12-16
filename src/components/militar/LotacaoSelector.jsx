import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export default function LotacaoSelector({ value, onChange, name = "lotacao" }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [novaLotacao, setNovaLotacao] = useState('');
  const queryClient = useQueryClient();

  const { data: lotacoes = [] } = useQuery({
    queryKey: ['lotacoes'],
    queryFn: () => base44.entities.Lotacao.filter({ ativa: true }, 'nome')
  });

  const createMutation = useMutation({
    mutationFn: (nome) => base44.entities.Lotacao.create({ nome, ativa: true }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['lotacoes'] });
      onChange(name, data.nome);
      setDialogOpen(false);
      setNovaLotacao('');
    }
  });

  const handleCreate = () => {
    if (novaLotacao.trim()) {
      createMutation.mutate(novaLotacao.trim());
    }
  };

  return (
    <div className="space-y-1.5">
      <Label htmlFor={name} className="text-sm font-medium text-slate-700">
        Lotação
      </Label>
      <div className="flex gap-2">
        <Select value={value || ""} onValueChange={(v) => onChange(name, v)}>
          <SelectTrigger className="h-10 border-slate-200">
            <SelectValue placeholder="Selecione a lotação" />
          </SelectTrigger>
          <SelectContent>
            {lotacoes.map((lot) => (
              <SelectItem key={lot.id} value={lot.nome}>
                {lot.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setDialogOpen(true)}
          className="flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Lotação</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={novaLotacao}
              onChange={(e) => setNovaLotacao(e.target.value)}
              placeholder="Nome da lotação"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={!novaLotacao.trim()}>
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}