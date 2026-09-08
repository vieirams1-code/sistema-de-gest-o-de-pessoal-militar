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
 * Desde o F8-L06, RequireModuleAccess também usa AND entre as dimensões
 * módulo/ação. RequireAction permanece como guard explícito das páginas com
 * política canônica e grupos de capacidades independentes.
 *
 * Negação segura: tela genérica (AccessDenied), sem PII, sem backend, sem
 * alteração de estado, sem redirecionamento em loop.
 * ============================================================================
 */

import React from 'react';
import AccessDenied from '@/components/auth/AccessDenied';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import { AlertTriangle } from 'lucide-react';

export default function RequireAction({ children, moduleKey, moduleKeys = [], actionKey, actionKeys = [], moduleName }) {
  const {
    canAccessModule,
    canAccessAction,
    isLoading,
    isAccessError,
    isAccessResolved,
    shouldBlockAccessByPermissionError,
    permissions,
    canAccessAll,
  } = useCurrentUser();

  if (isLoading || !isAccessResolved) {
    return null;
  }

  // Erro de permissões: negação genérica, sem PII e sem ação que acione backend.
  if (isAccessError || shouldBlockAccessByPermissionError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-5">
          <div className="w-20 h-20 mx-auto rounded-full bg-amber-50 border-2 border-amber-200 flex items-center justify-center">
            <AlertTriangle className="w-10 h-10 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Acesso restrito</h1>
          <p className="text-slate-500 text-sm leading-relaxed">
            Você não possui permissão para acessar esta funcionalidade.
          </p>
        </div>
      </div>
    );
  }

  // Bypass administrativo preservado.
  const isAdminBypass = canAccessAll || permissions === 'ALL';

  // Fail-closed com suporte a grupos de capacidades: quando há várias chaves,
  // basta uma chave válida dentro de cada grupo (módulo e ação). Isso permite
  // que páginas de gestão sejam abertas por capacidades independentes, sem
  // depender de uma permissão legado oculta.
  const normalizedModuleKeys = [...(moduleKey ? [moduleKey] : []), ...moduleKeys].filter(Boolean);
  const normalizedActionKeys = [...(actionKey ? [actionKey] : []), ...actionKeys].filter(Boolean);
  const hasExplicitRule = normalizedModuleKeys.length > 0 || normalizedActionKeys.length > 0;
  const hasModuleAccess = normalizedModuleKeys.length === 0
    || normalizedModuleKeys.some((key) => canAccessModule(key));
  const hasActionAccess = normalizedActionKeys.length === 0
    || normalizedActionKeys.some((key) => canAccessAction(key));
  const canAccess = isAdminBypass || (hasExplicitRule && hasModuleAccess && hasActionAccess);

  if (!canAccess) {
    return <AccessDenied modulo={moduleName} />;
  }

  return children;
}