import React, { useMemo } from 'react';
import ComunicacoesPage from './ComunicacoesPage';
import { useAuth } from '@/lib/AuthContext';
import { useCurrentUser } from '@/components/auth/useCurrentUser';

export default function ComunicacoesInternasPage() {
  const { appPublicSettings } = useAuth();
  const { user, canAccessAction } = useCurrentUser();

  const featureFlags = useMemo(() => {
    const root = appPublicSettings?.public_settings || appPublicSettings || {};

    return {
      ...(root.feature_flags || {}),
      ...(root.featureFlags || {}),
      ...(root.modulos || {}),
    };
  }, [appPublicSettings]);

  const currentUser = useMemo(() => {
    const permissions = canAccessAction('acessar_comunicacoes')
      ? ['acessar_comunicacoes']
      : [];

    return {
      ...user,
      permissions,
    };
  }, [canAccessAction, user]);

  return (
    <ComunicacoesPage
      currentUser={currentUser}
      featureFlags={featureFlags}
      currentUserName={user?.full_name || user?.name || user?.email || 'Usuário do Sistema'}
      currentUserRole={user?.role || 'Comunicações Internas'}
    />
  );
}
