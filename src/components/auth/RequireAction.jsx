/**
 * RequireAction — P1.3-A (ENFORCEMENT REAL / MÍNIMO E SEGURO)
 * ============================================================================
 * Guard de rota que exige, de forma combinada (AND):
 *   - acesso ao módulo (canAccessModule(moduleKey)); e
 *   - posse da action (canAccessAction(actionKey)), quando actionKey informado.
 *
 * Reaproveita useCurrentUser (mesma fonte do RequireModuleAccess), respeitando:
 *   - estados de carregamento / erro de permissões;
 *   - usuário efetivo (impersonação já tratada internamente pelo useCurrentUser);
 *   - bypass para admin / canAccessAll.
 *
 * Diferença em relação ao RequireModuleAccess: este exige módulo E action (AND),
 * enquanto o RequireModuleAccess avalia em modo OR. Guard isolado para não
 * alterar o comportamento das demais rotas.
 *
 * Negação segura: tela genérica (AccessDenied), sem PII, sem backend, sem
 * alteração de estado, sem redirecionamento em loop.
 * ============================================================================
 */

import React from 'react';
import AccessDenied from '@/components/auth/AccessDenied';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function RequireAction({ children, moduleKey, actionKey, moduleName }) {
  const {
    canAccessModule,
    canAccessAction,
    isLoading,
    isAccessError,
    isAccessResolved,
    shouldBlockAccessByPermissionError,
    permissionErrorMessage,
    permissions,
    canAccessAll,
    refetchAccess,
  } = useCurrentUser();

  if (isLoading || !isAccessResolved) {
    return null;
  }

  if (isAccessError || shouldBlockAccessByPermissionError) {
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
        </div>
      </div>
    );
  }

  if (canAccessAll || permissions === 'ALL') {
    return children;
  }

  const hasModuleAccess = moduleKey ? canAccessModule(moduleKey) : true;
  const hasActionAccess = actionKey ? canAccessAction(actionKey) : true;

  if (!hasModuleAccess || !hasActionAccess) {
    return <AccessDenied modulo={moduleName} />;
  }

  return children;
}