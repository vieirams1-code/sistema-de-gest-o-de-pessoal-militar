import React from 'react';
import { Navigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function Processos() {
  // O módulo antigo de Processos foi substituído pelo Quadro Operacional.
  // Este redirecionamento garante que links antigos (favoritos) continuem funcionando e enviem
  // o usuário para a nova ferramenta.
  return <Navigate to={createPageUrl('QuadroOperacional')} replace />;
}