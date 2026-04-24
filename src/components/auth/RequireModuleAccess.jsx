import React from 'react';
import AccessDenied from '@/components/auth/AccessDenied';
import { useCurrentUser } from '@/components/auth/useCurrentUser';

export default function RequireModuleAccess({
  children,
  moduleKey,
  moduleKeys = [],
  actionKey,
  actionKeys = [],
  moduleName,
}) {
  const { canAccessModule, canAccessAction, isLoading, isAccessResolved, permissions, canAccessAll } = useCurrentUser();

  if (isLoading || !isAccessResolved) {
    return null;
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
