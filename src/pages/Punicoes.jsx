import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, Plus, Search, Trash2, Edit } from 'lucide-react';
import { format } from 'date-fns';
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
import AccessDenied from '@/components/auth/AccessDenied';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import { calcularComportamento } from '@/utils/calcularComportamento';
import { getPunicaoEntity } from '@/services/justicaDisciplinaService';
import { useScopedMilitarIds, filtrarPorMilitarIdsPermitidos } from '@/hooks/useScopedMilitarIds';
import { useUsuarioPodeAgirSobreMilitar } from '@/hooks/useUsuarioPodeAgirSobreMilitar';

export default function Punicoes() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canAccessModule, canAccessAction, isLoading: loadingUser, isAccessResolved } = useCurrentUser();
  const { validar: validarEscopoMilitar } = useUsuarioPodeAgirSobreMilitar();
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteDialog, setDeleteDialog] = useState({ open: false, militar_id: null, id: null });
  const canAdicionarPunicoes = canAccessAction('adicionar_punicoes');
  const canEditarPunicoes = canAccessAction('editar_punicoes');
  const canExcluirPunicoes = canAccessAction('excluir_punicoes');
  let entity = null;
  try { entity = getPunicaoEntity(); } catch (_) {}

  // Lote 1D-E: escopo transversal — usuário restrito vê apenas punições
  // dos militares dentro do seu escopo. Admin continua vendo tudo.
  const { ids: scopedIds, isAdmin: scopedIsAdmin, isReady: scopedReady } = useScopedMilitarIds();
  const scopeKey = scopedIsAdmin ? 'admin' : (scopedIds || []).join(',');

  const { data: punicoes = [], isLoading } = useQuery({
    queryKey: ['punicoes-disciplinares', scopeKey],
    queryFn: async () => {
      const lista = await entity.list('-created_date');
      return filtrarPorMilitarIdsPermitidos(lista, scopedIds);
    },
    enabled: isAccessResolved && !!entity && scopedReady,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => entity.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['punicoes-disciplinares'] });
      setDeleteDialog({ open: false, id: null });
    }
  });

  const openDeleteDialog = (punicao) => {
    if (!canExcluirPunicoes) return;
    const escopo = validarEscopoMilitar(punicao?.militar_id);
    if (!escopo.permitido) {
      alert(escopo.motivo);
      return;
    }
    setDeleteDialog({ open: true, id: punicao.id, militar_id: punicao.militar_id });
  };

  const handleNavegarEditarPunicao = (punicao) => {
    if (!canEditarPunicoes) return;
    const escopo = validarEscopoMilitar(punicao?.militar_id);
    if (!escopo.permitido) {
      alert(escopo.motivo);
      return;
    }
    navigate(createPageUrl('CadastrarPunicao') + `?id=${punicao.id}`);
  };

  const confirmarExclusaoPunicao = () => {
    if (!canExcluirPunicoes) return;
    const escopo = validarEscopoMilitar(deleteDialog.militar_id);
    if (!escopo.permitido) {
      alert(escopo.motivo);
      setDeleteDialog({ open: false, id: null, militar_id: null });
      return;
    }
    deleteMutation.mutate(deleteDialog.id);
  };

  const filteredPunicoes = punicoes.filter(p =>
    p.militar_nome?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!loadingUser && isAccessResolved && !canAccessModule('punicoes')) return <AccessDenied modulo="Lançamento de Punições" />;

  const getImpactoComportamento = (punicao) => {
    const r = calcularComportamento([punicao], punicao.posto_graduacao);
    return r?.comportamento || 'Sem impacto';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-[#1e3a5f]" />
            <div>
              <h1 className="text-3xl font-bold text-[#1e3a5f]">Lançamento de Punições</h1>
              <p className="text-slate-500">Registro disciplinar próprio (sem origem no Livro/RP)</p>
            </div>
          </div>
          <Button
            onClick={() => canAdicionarPunicoes && navigate(createPageUrl('CadastrarPunicao'))}
            disabled={!canAdicionarPunicoes}
            className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
          >
            <Plus className="w-5 h-5 mr-2" />
            Nova Punição
          </Button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input placeholder="Buscar por nome..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" /></div>
        ) : filteredPunicoes.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">Nenhuma punição encontrada</div>
        ) : (
          <div className="space-y-3">
            {filteredPunicoes.map((punicao) => (
              <div key={punicao.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900">{punicao.posto_graduacao} {punicao.militar_nome}</h3>
                    <p className="text-sm text-slate-600">Tipo: {punicao.tipo_punicao}</p>
                    <p className="text-sm text-slate-600">Dias: {punicao.dias_punicao || 0}</p>
                    <p className="text-sm text-slate-600">Período: {punicao.data_inicio_cumprimento || '-'} até {punicao.data_fim_cumprimento || '-'}</p>
                    <p className="text-sm text-slate-600">Status: {punicao.status_punicao || '-'}</p>
                    <p className="text-sm text-slate-700 mt-2"><span className="font-medium">Impacto:</span> {getImpactoComportamento(punicao)}</p>
                    {punicao.created_date && <p className="text-xs text-slate-400 mt-1">Lançada em {format(new Date(punicao.created_date), 'dd/MM/yyyy HH:mm')}</p>}
                  </div>
                  <div className="flex gap-2">
                    {canEditarPunicoes && (
                      <Button variant="ghost" size="icon" onClick={() => handleNavegarEditarPunicao(punicao)} className="text-[#1e3a5f]"><Edit className="w-4 h-4" /></Button>
                    )}
                    {canExcluirPunicoes && (
                      <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(punicao)} className="text-red-600"><Trash2 className="w-4 h-4" /></Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>Tem certeza que deseja excluir esta punição?</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmarExclusaoPunicao} className="bg-red-600 hover:bg-red-700">Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}