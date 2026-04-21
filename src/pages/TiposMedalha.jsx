import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Award, Plus, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  TIPOS_FIXOS_MEDALHA_TEMPO,
  deduplicarTiposMedalha,
  garantirCatalogoFixoMedalhaTempo,
} from '@/services/medalhasTempoServicoService';

export default function TiposMedalha() {
  const queryClient = useQueryClient();
  const { canAccessModule, isLoading: loadingUser, isAccessResolved } = useCurrentUser();
  const hasMedalhasAccess = canAccessModule('medalhas');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null });
  const [formData, setFormData] = useState({ nome: '', descricao: '' });

  const { data: tipos = [] } = useQuery({
    queryKey: ['tipos-medalha'],
    queryFn: async () => {
      const lista = await base44.entities.TipoMedalha.list('-created_date');
      return deduplicarTiposMedalha(lista);
    },
  });

  useQuery({
    queryKey: ['tipos-medalha-fixos-sync'],
    queryFn: () => garantirCatalogoFixoMedalhaTempo(base44),
    enabled: isAccessResolved && hasMedalhasAccess,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.TipoMedalha.create({ ...data, ativa: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tipos-medalha'] });
      setDialogOpen(false);
      setFormData({ nome: '', descricao: '' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.TipoMedalha.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tipos-medalha'] });
      setDeleteDialog({ open: false, id: null });
    }
  });

  if (loadingUser || !isAccessResolved) return null;
  if (!hasMedalhasAccess) return <AccessDenied modulo="Medalhas" />;

  const codigosFixos = new Set(TIPOS_FIXOS_MEDALHA_TEMPO.map((item) => item.codigo));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Award className="w-8 h-8 text-[#1e3a5f]" />
            <div>
              <h1 className="text-3xl font-bold text-[#1e3a5f]">Tipos de Medalha</h1>
              <p className="text-slate-500">Gerenciar tipos de medalhas</p>
            </div>
          </div>
          <Button onClick={() => setDialogOpen(true)} className="bg-[#1e3a5f] hover:bg-[#2d4a6f]">
            <Plus className="w-5 h-5 mr-2" />
            Novo Tipo
          </Button>
        </div>

        <div className="space-y-3">
          {tipos.map(tipo => (
            <div key={tipo.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-slate-900">{tipo.nome}</h3>
                    {codigosFixos.has(tipo.codigo) && (
                      <span className="text-xs rounded-full px-2 py-0.5 bg-blue-100 text-blue-700">Fixo</span>
                    )}
                  </div>
                  {tipo.descricao && <p className="text-sm text-slate-600">{tipo.descricao}</p>}
                </div>
                {!codigosFixos.has(tipo.codigo) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteDialog({ open: true, id: tipo.id })}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
          {tipos.length === 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
              <Award className="w-16 h-16 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">Nenhum tipo cadastrado</p>
            </div>
          )}
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Tipo de Medalha</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Input
                  placeholder="Nome da medalha"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                />
              </div>
              <div>
                <Textarea
                  placeholder="Descrição (opcional)"
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={() => createMutation.mutate(formData)} disabled={!formData.nome.trim()}>
                Criar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir este tipo de medalha?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteMutation.mutate(deleteDialog.id)} className="bg-red-600 hover:bg-red-700">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
