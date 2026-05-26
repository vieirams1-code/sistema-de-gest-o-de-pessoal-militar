import React from 'react';
import FuncoesTagsManager from '@/components/funcoes-tags/FuncoesTagsManager';
import { useCurrentUser } from '@/components/auth/useCurrentUser';

export default function Tags() {
  const { isAdmin } = useCurrentUser();
  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <FuncoesTagsManager initialTab="grupos" showFuncoesTab={false} isAdmin={isAdmin} />
    </div>
  );
}
