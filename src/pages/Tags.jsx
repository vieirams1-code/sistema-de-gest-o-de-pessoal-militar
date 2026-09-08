import React from 'react';
import FuncoesTagsManager from '@/components/funcoes-tags/FuncoesTagsManager';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';

export default function Tags() {
  const { isAdmin, canAccessModule, canAccessAction, isLoading, isAccessResolved } = useCurrentUser();
  const podeVisualizar = isAdmin || (canAccessModule('tags') && canAccessAction('visualizar_tags'));
  const podeGerir = isAdmin || canAccessAction('gerir_tags');

  if (isLoading || !isAccessResolved) return null;
  if (!podeVisualizar) return <AccessDenied modulo="Tags" />;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <FuncoesTagsManager initialTab="grupos" showFuncoesTab={false} isAdmin={isAdmin} canEdit={podeGerir} />
    </div>
  );
}
