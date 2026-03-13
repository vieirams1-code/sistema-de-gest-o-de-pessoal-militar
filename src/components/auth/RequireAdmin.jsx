import React from 'react';
import { Navigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useCurrentUser } from '@/components/auth/useCurrentUser';

export default function RequireAdmin({ children }) {
  const { isLoading, isAdmin } = useCurrentUser();

  if (isLoading) {
    return null;
  }

  if (!isAdmin) {
    return <Navigate to={createPageUrl('Home')} replace />;
  }

  return children;
}
