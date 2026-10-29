import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';

export default function ExcluirNotaColetivaDialog({ disabled, onConfirm }) {
  return <AlertDialog>
    <AlertDialogTrigger asChild><Button type="button" variant="destructive" disabled={disabled}>Excluir rascunho coletivo</Button></AlertDialogTrigger>
    <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir nota coletiva não publicada?</AlertDialogTitle><AlertDialogDescription>A nota e todos os seus vínculos serão excluídos juntos, removendo-a das fichas dos militares selecionados.</AlertDialogDescription></AlertDialogHeader>
      <AlertDialogFooter><AlertDialogCancel>Manter nota coletiva</AlertDialogCancel><AlertDialogAction disabled={disabled} onClick={onConfirm}>Confirmar exclusão coletiva</AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}