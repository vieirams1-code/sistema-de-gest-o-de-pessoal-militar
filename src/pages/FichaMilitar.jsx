import React from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function FichaMilitar() {
  const [searchParams] = useSearchParams();
  const militarId = searchParams.get('id');
  const tab = searchParams.get('tab') || 'comportamento';
  const query = militarId ? `?id=${militarId}&tab=${tab}` : '?tab=comportamento';
  return <Navigate to={`${createPageUrl('VerMilitar')}${query}`} replace />;
}
