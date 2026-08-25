import React, { useState } from 'react';
import { usePortalAuth } from '../context/PortalAuthContext';
import PortalCadastroView from './PortalCadastroView';
import PortalFeriasView from './PortalFeriasView';
import {
  UserCheck,
  Calendar,
  FileText,
  Clock,
  ShieldCheck,
  LogOut,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

export default function PortalHomeView() {
  const { militar, logout } = usePortalAuth();
  const [currentModule, setCurrentModule] = useState('HOME'); // 'HOME' | 'CADASTRO' | 'FERIAS'

  if (!militar) return null;

  if (currentModule === 'CADASTRO') {
    return <PortalCadastroView onBack={() => setCurrentModule('HOME')} />;
  }

  if (currentModule === 'FERIAS') {
    return <PortalFeriasView onBack={() => setCurrentModule('HOME')} />;
  }

  const initials = militar.nome_guerra
    ? militar.nome_guerra.slice(0, 2).toUpperCase()
    : (militar.nome_completo ? militar.nome_completo.slice(0, 2).toUpperCase() : 'BM');

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
      {/* CARD PRINCIPAL: IDENTIDADE FUNCIONAL */}
      <div className="bg-gradient-to-br from-[#1e3a5f] to-[#0f233d] rounded-2xl sm:rounded-3xl p-5 sm:p-7 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center space-x-4">
            {/* Foto ou Iniciais */}
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/10 border-2 border-white/20 flex items-center justify-center font-bold text-2xl sm:text-3xl text-white shadow-inner flex-shrink-0">
              {militar.foto_url ? (
                <img
                  src={militar.foto_url}
                  alt={militar.nome_guerra || 'Militar'}
                  className="w-full h-full object-cover rounded-2xl"
                />
              ) : (
                initials
              )}
            </div>

            {/* Informações Principais */}
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold tracking-wide uppercase">
                  {militar.posto_graduacao || 'Militar'}
                </span>
                {militar.quadro && (
                  <span className="px-2 py-0.5 rounded-full bg-white/10 text-slate-200 text-xs font-semibold">
                    {militar.quadro}
                  </span>
                )}
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                {militar.nome_guerra || militar.nome_completo}
              </h2>
              <p className="text-xs sm:text-sm text-slate-300">
                {militar.nome_completo}
              </p>
              <p className="text-xs text-slate-400 font-medium">
                Lotação: <span className="text-slate-200">{militar.lotacao || militar.estrutura_nome || 'Não informada'}</span>
              </p>
            </div>
          </div>

          {/* Botão Sair */}
          <div className="flex sm:flex-col items-end justify-between sm:justify-center border-t sm:border-t-0 pt-3 sm:pt-0 border-white/10">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={logout}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 hover:text-white rounded-xl text-xs h-9 font-medium backdrop-blur-sm"
            >
              <LogOut className="w-3.5 h-3.5 mr-1.5" />
              Encerrar Sessão
            </Button>
          </div>
        </div>
      </div>

      {/* GRADE DE SERVIÇOS E AUTOATENDIMENTO */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-base font-bold text-slate-800 flex items-center">
            <Sparkles className="w-4 h-4 mr-2 text-[#1e3a5f]" />
            Serviços e Autoatendimento
          </h3>
          <span className="text-xs text-slate-500 font-medium">Selecione uma opção</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {/* Card 1: Atualização Cadastral (Fase 1.3A) */}
          <Card
            onClick={() => setCurrentModule('CADASTRO')}
            className="hover:shadow-md transition-all border-slate-200 cursor-pointer group hover:border-[#1e3a5f]/40 bg-white"
          >
            <CardHeader className="p-4 sm:p-5 flex flex-row items-center justify-between pb-2 space-y-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#1e3a5f] flex items-center justify-center group-hover:scale-105 transition-transform">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-slate-800 group-hover:text-[#1e3a5f] transition-colors">
                    Ficha & Conferência Cadastral
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Confira seus dados pessoais, endereço e contatos
                  </CardDescription>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#1e3a5f] transition-colors" />
            </CardHeader>
          </Card>

          {/* Card 2: Férias e Fracionamento (Fase 1.3B) */}
          <Card
            onClick={() => setCurrentModule('FERIAS')}
            className="hover:shadow-md transition-all border-slate-200 cursor-pointer group hover:border-emerald-600/40 bg-white"
          >
            <CardHeader className="p-4 sm:p-5 flex flex-row items-center justify-between pb-2 space-y-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-slate-800 group-hover:text-emerald-700 transition-colors">
                    Plano de Férias & Saldos
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Opção de parcelamento e consulta de períodos
                  </CardDescription>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-700 transition-colors" />
            </CardHeader>
          </Card>

          {/* Card 3: Atestados Médicos (Informativo) */}
          <Card className="border-slate-200 opacity-60 bg-slate-50">
            <CardHeader className="p-4 sm:p-5 flex flex-row items-center justify-between pb-2 space-y-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-600 flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-slate-700">
                    Atestados & JISO
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Em breve • Envio de atestados pelo celular
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Card 4: Central de Pendências (Informativo) */}
          <Card className="border-slate-200 opacity-60 bg-slate-50">
            <CardHeader className="p-4 sm:p-5 flex flex-row items-center justify-between pb-2 space-y-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-600 flex items-center justify-center">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-slate-700">
                    Central de Pendências
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Em breve • Prazos e avisos da unidade
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </div>
      </div>

      {/* STATUS DE SEGURANÇA */}
      <Card className="bg-slate-50 border-slate-200">
        <CardContent className="p-4 flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>Sessão autenticada e protegida com criptografia de 256 bits.</span>
          </div>
          <span className="font-semibold text-slate-500 hidden sm:inline">
            CBMMS Digital
          </span>
        </CardContent>
      </Card>
    </div>
  );
}
