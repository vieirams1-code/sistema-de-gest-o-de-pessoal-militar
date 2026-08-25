import React from 'react';
import { PortalAuthProvider, usePortalAuth } from './context/PortalAuthContext';
import PortalLayout from './PortalLayout';
import PortalLoginForm from './components/PortalLoginForm';
import PortalHomeView from './components/PortalHomeView';

function PortalContent() {
  const { militar, isAuthenticated, isLoading } = usePortalAuth();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4 animate-in fade-in">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-[#1e3a5f] rounded-full animate-spin"></div>
        <p className="text-sm text-slate-500 font-medium tracking-tight">Validando sessão segura...</p>
      </div>
    );
  }

  // Não autenticado: Exibe Formulário Mobile-First de Login por CPF & OTP
  if (!isAuthenticated || !militar) {
    return <PortalLoginForm />;
  }

  // Autenticado: Exibe Painel de Autoatendimento do Militar
  return <PortalHomeView />;
}

export default function PortalApp() {
  return (
    <PortalAuthProvider>
      <PortalLayout>
        <PortalContent />
      </PortalLayout>
    </PortalAuthProvider>
  );
}
