import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Medal, ChevronRight } from 'lucide-react';
import { createPageUrl } from '@/utils';

const TABS = [
  { id: 'registradas', label: 'Registradas', path: 'Medalhas', title: 'Medalhas', description: 'Controle de indicações e concessões' },
  { id: 'dompedro', label: 'Dom Pedro II', path: 'IndicacoesDomPedroII', title: 'Indicações Dom Pedro II', description: 'Fluxo manual separado para indicação e concessão da medalha Dom Pedro II.', actionKey: 'perm_visualizar_dom_pedro' },
  { id: 'tempo', label: 'Tempo de Serviço', path: 'ApuracaoMedalhasTempoServico', title: 'Apuração de Tempo de Serviço', description: 'Tabela operacional por militar para indicação e concessão das faixas de 10, 20, 30 e 40 anos.' },
];

export default function MedalhasTabNavigation({ activeTab, actions, canAccessAction }) {
  const navigate = useNavigate();
  const currentTab = TABS.find((tab) => tab.id === activeTab) || TABS[0];

  const visibleTabs = TABS.filter(tab => {
    if (tab.id === 'dompedro' && canAccessAction) {
      return canAccessAction('perm_visualizar_dom_pedro');
    }
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Breadcrumbs */}
      <nav className="flex items-center text-xs font-medium text-slate-500 uppercase tracking-wider">
        <span>Carreira</span>
        <ChevronRight className="w-3 h-3 mx-1 text-slate-400" />
        <span>Medalhas</span>
        <ChevronRight className="w-3 h-3 mx-1 text-slate-400" />
        <span className="text-slate-900">{currentTab.label}</span>
      </nav>

      {/* Main Header */}
      <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-slate-100 p-2 mt-0.5">
            <Medal className="w-6 h-6 text-[#1e3a5f]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#1e3a5f]">{currentTab.title}</h1>
            <p className="text-sm text-slate-600 mt-1">{currentTab.description}</p>
          </div>
        </div>

        {actions && (
          <div className="flex flex-wrap gap-2">
            {actions}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        {visibleTabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => navigate(createPageUrl(tab.path))}
              className={`px-4 py-2 text-sm font-medium transition-colors relative ${
                isActive
                  ? 'text-[#1e3a5f]'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              {tab.label}
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1e3a5f]" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
