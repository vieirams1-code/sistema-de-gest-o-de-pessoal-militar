import React from 'react';
import AccessDenied from '@/components/auth/AccessDenied';
import { useCurrentUser } from '@/components/auth/useCurrentUser';

export default function RequireModuleAccess({ children, moduleKey, moduleName }) {
  const { canAccessModule, isLoading, isAccessResolved } = useCurrentUser();

  if (isLoading || !isAccessResolved) {
    return null;
  }

  if (!canAccessModule(moduleKey)) {
    return <AccessDenied modulo={moduleName} />;
  }

  return children;
}
