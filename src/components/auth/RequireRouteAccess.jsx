import React from 'react';
import { Navigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import AccessDenied from '@/components/auth/AccessDenied';
import { useCurrentUser } from '@/components/auth/useCurrentUser';

export default function RequireRouteAccess({
  children,
  moduleKey,
  moduleName,
  actionKey,
  anyActionKeys,
  actionName,
  requireAdminLegacy = false,
}) {
  const { isLoading, isAccessResolved, isAdmin, canAccessModule, canAccessAction } = useCurrentUser();

  if (isLoading || !isAccessResolved) {
    return null;
  }

  if (requireAdminLegacy && !isAdmin) {
    return <Navigate to={createPageUrl('Home')} replace />;
  }

  if (moduleKey && !canAccessModule(moduleKey)) {
    return <AccessDenied modulo={moduleName || moduleKey} />;
  }

  if (actionKey && !canAccessAction(actionKey)) {
    return <AccessDenied modulo={actionName || actionKey} />;
  }

  if (Array.isArray(anyActionKeys) && anyActionKeys.length > 0) {
    const hasAnyAction = anyActionKeys.some((key) => canAccessAction(key));
    if (!hasAnyAction) {
      return <AccessDenied modulo={actionName || 'Ação restrita'} />;
    }
  }

  return children;
}
