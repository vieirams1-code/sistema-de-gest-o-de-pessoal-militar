import React from 'react';
import AccessDenied from '@/components/auth/AccessDenied';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDebugPanel from '@/components/auth/AccessDebugPanel';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function RequireModuleAccess({
  children,
  moduleKey,
  moduleKeys = [],
  actionKey,
  actionKeys = [],
  moduleName,
}) {
  const {
    canAccessModule,
    canAccessAction,
    isLoading,
    isAccessError,
    isAccessResolved,
    isPermissionPartialError,
    accessErrorDetails,
    shouldBlockAccessByPermissionError,
    permissionErrorMessage,
    debugAccess,
    permissions,
    canAccessAll,
    refetchAccess,
  } = useCurrentUser();

  React.useEffect(() => {
    if (!import.meta.env.DEV || !isPermissionPartialError) return;
    console.warn('[RequireModuleAccess] Erro parcial de permissões detectado (não bloqueante).', accessErrorDetails);
  }, [isPermissionPartialError, accessErrorDetails]);

  if (isLoading) {
    return null;
  }

  if (isAccessError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-5">
          <div className="w-20 h-20 mx-auto rounded-full bg-amber-50 border-2 border-amber-200 flex items-center justify-center">
            <AlertTriangle className="w-10 h-10 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Erro de Permissões</h1>
          <p className="text-slate-500 text-sm leading-relaxed">
            Erro ao carregar permissões. Tente novamente.
          </p>
          <Button
            type="button"
            className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white mt-2"
            onClick={() => refetchAccess()}
          >
            Tentar novamente
          </Button>
          <AccessDebugPanel debugAccess={debugAccess} />
        </div>
      </div>
    );
  }

  if (!isAccessResolved) {
    return null;
  }

  if (shouldBlockAccessByPermissionError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-5">
          <div className="w-20 h-20 mx-auto rounded-full bg-amber-50 border-2 border-amber-200 flex items-center justify-center">
            <AlertTriangle className="w-10 h-10 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Erro de Permissões</h1>
          <p className="text-slate-500 text-sm leading-relaxed">
            {permissionErrorMessage || 'Não foi possível carregar o perfil de permissões.'}
          </p>
          <Button
            type="button"
            className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white mt-2"
            onClick={() => refetchAccess()}
          >
            Tentar novamente
          </Button>
          <AccessDebugPanel debugAccess={debugAccess} />
        </div>
      </div>
    );
  }

  if (canAccessAll || permissions === 'ALL') {
    return children;
  }

  const normalizedModuleKeys = [
    ...(moduleKey ? [moduleKey] : []),
    ...moduleKeys,
  ];
  const normalizedActionKeys = [
    ...(actionKey ? [actionKey] : []),
    ...actionKeys,
  ];

  const hasModuleAccess = normalizedModuleKeys.some((key) => canAccessModule(key));
  const hasActionAccess = normalizedActionKeys.some((key) => canAccessAction(key));
  const hasExplicitRule = normalizedModuleKeys.length > 0 || normalizedActionKeys.length > 0;

  if (hasExplicitRule && !hasModuleAccess && !hasActionAccess) {
    return <AccessDenied modulo={moduleName} />;
  }

  return children;
}
