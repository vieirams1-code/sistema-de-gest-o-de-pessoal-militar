import React from 'react';
import { usePortalAuth } from './context/PortalAuthContext';
import { Shield, LogOut, User, Building, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PortalLayout({ children }) {
  const { militar, isAuthenticated, logout } = usePortalAuth();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-[#1e3a5f] text-white shadow-md sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600/30 flex items-center justify-center border border-blue-400/30">
              <Shield className="w-6 h-6 text-blue-200" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight leading-tight">Portal do Militar</h1>
              <p className="text-xs text-blue-200/80">Sistema de Gestão de Pessoal — Autoatendimento</p>
            </div>
          </div>

          {isAuthenticated && militar && (
            <div className="flex items-center space-x-3">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-sm font-semibold text-white">
                  {militar.nome_guerra || militar.nome_completo}
                </span>
                <span className="text-xs text-blue-200">
                  {militar.posto_graduacao} • {militar.quadro}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
                className="text-blue-100 hover:text-white hover:bg-blue-800/40 p-2 h-auto"
                title="Encerrar Sessão"
              >
                <LogOut className="w-4 h-4 mr-1.5" />
                <span className="text-xs">Sair</span>
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 md:p-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-slate-100 border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Corpo de Bombeiros Militar — SGP Militar</span>
          <span className="text-slate-400">Ambiente Seguro de Autoatendimento</span>
        </div>
      </footer>
    </div>
  );
}
