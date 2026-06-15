import React, { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Settings, Sliders } from 'lucide-react';
import TiposPublicacaoManager from '@/components/configuracoes/TiposPublicacaoManager';
import FuncoesTagsManager from '@/components/funcoes-tags/FuncoesTagsManager';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';

const TAB_TAGS_VALIDAS = ['grupos', 'tags'];

const normalizarTabConfiguracoes = (valorTab) => {
  if (typeof valorTab !== 'string') return 'grupos';
  const normalizada = valorTab.trim().toLowerCase();
  if (TAB_TAGS_VALIDAS.includes(normalizada)) return normalizada;
  return 'grupos';
};

export default function Configuracoes() {
  const [searchParams] = useSearchParams();
  const { canAccessModule, canAccessAction, isLoading: loadingUser, isAccessResolved } = useCurrentUser();
  const hasConfiguracoesAccess = canAccessModule('configuracoes');

  const rawTab = searchParams?.get?.('tab');
  const selectedTab = useMemo(() => normalizarTabConfiguracoes(rawTab), [rawTab]);

  if (loadingUser || !isAccessResolved) return null;
  if (!hasConfiguracoesAccess) return <AccessDenied modulo="Configurações" />;

  if (!canAccessAction('gerir_configuracoes')) {
    return <AccessDenied modulo="Adições e Personalizações" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Settings className="w-8 h-8 text-[#1e3a5f]" />
          <div>
            <h1 className="text-3xl font-bold text-[#1e3a5f]">Configurações Gerais</h1>
            <p className="text-slate-500">Gerencie personalizações gerais e parâmetros avançados do sistema</p>
          </div>
        </div>

        <div className="flex gap-2 mb-6 border-b border-slate-200">
          <div className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 border-[#1e3a5f] text-[#1e3a5f] -mb-px">
            <Sliders className="w-4 h-4" />
            Adições e Personalizações
          </div>
        </div>

        <div className="space-y-6">
          <TiposPublicacaoManager />
          <FuncoesTagsManager canEdit={canAccessAction('gerir_configuracoes')} initialTab={selectedTab} showFuncoesTab={false} />
        </div>
      </div>
    </div>
  );
}
