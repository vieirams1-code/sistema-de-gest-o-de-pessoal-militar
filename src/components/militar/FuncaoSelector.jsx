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

export default function FuncaoSelector({ value, onChange, name = "funcao" }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [novaFuncao, setNovaFuncao] = useState('');
  const queryClient = useQueryClient();

  const { data: funcoes = [] } = useQuery({
    queryKey: ['funcoes'],
    queryFn: () => base44.entities.Funcao.filter({ ativa: true }, 'nome')
  });

  const createMutation = useMutation({
    mutationFn: (nome) => base44.entities.Funcao.create({ nome, ativa: true }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['funcoes'] });
      onChange(name, data.nome);
      setDialogOpen(false);
      setNovaFuncao('');
    }
  });

  const handleCreate = () => {
    if (novaFuncao.trim()) {
      createMutation.mutate(novaFuncao.trim());
    }
  };

  return (
    <div className="space-y-1.5">
      <Label htmlFor={name} className="text-sm font-medium text-slate-700">
        Função
      </Label>
      <div className="flex gap-2">
        <Select value={value || ""} onValueChange={(v) => onChange(name, v)}>
          <SelectTrigger className="h-10 border-slate-200">
            <SelectValue placeholder="Selecione a função" />
          </SelectTrigger>
          <SelectContent>
            {funcoes.map((func) => (
              <SelectItem key={func.id} value={func.nome}>
                {func.nome}
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
            <DialogTitle>Nova Função</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={novaFuncao}
              onChange={(e) => setNovaFuncao(e.target.value)}
              placeholder="Nome da função"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={!novaFuncao.trim()}>
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}