import React from 'react';
import AccessDenied from '@/components/auth/AccessDenied';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import FuncoesTagsManager from '@/components/funcoes-tags/FuncoesTagsManager';

export default function Funcoes() {
  const { canAccessModule, canAccessAction, isLoading: loadingUser, isAccessResolved } = useCurrentUser();
  const hasFuncoesAccess = canAccessModule('adicoes_personalizacoes') || canAccessAction('gerir_adicoes_personalizacoes');
  const canEditFuncoes = canAccessAction('gerir_configuracoes') || canAccessAction('gerir_adicoes_personalizacoes');

  if (loadingUser || !isAccessResolved) return null;
  if (!hasFuncoesAccess) return <AccessDenied modulo="Funções" />;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <FuncoesTagsManager
        canEdit={canEditFuncoes}
        initialTab="funcoes"
        showTagsTabs={false}
        title="Funções"
        subtitle="Gerencie as funções utilizadas nos cadastros e vínculos funcionais do sistema"
      />
    </div>
  );
}
