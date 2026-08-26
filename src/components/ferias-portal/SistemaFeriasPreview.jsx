import React, { useState } from 'react';
import PortalColaborador from './PortalColaborador';
import PainelGestor from './PainelGestor';
import GestorDrawer from './GestorDrawer';

export default function SistemaFeriasPreview() {
  const [activeTab, setActiveTab] = useState('gestor'); // 'colaborador' | 'gestor' | 'drawer'

  return (
    <div className="flex flex-col h-screen w-full bg-slate-900 font-sans">
      {/* Topbar de Navegação / Alternância de Telas */}
      <div className="bg-slate-800 border-b border-slate-700 px-6 py-3 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-md">
        <div className="flex items-center gap-2 text-white font-bold text-sm">
          <i className="ph ph-squares-four text-green-400 text-lg"></i>
          <span>Sistema de Férias • Preview dos Componentes</span>
        </div>

        <div className="flex items-center bg-slate-900/80 p-1 rounded-xl border border-slate-700">
          <button
            type="button"
            onClick={() => setActiveTab('colaborador')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'colaborador'
                ? 'bg-green-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <i className="ph ph-user"></i>
            1. Portal do Colaborador
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('gestor')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'gestor'
                ? 'bg-green-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <i className="ph ph-calendar-check"></i>
            2. Painel do Gestor
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('drawer')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'drawer'
                ? 'bg-green-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <i className="ph ph-sidebar-simple"></i>
            3. Visualização com Drawer Aberto
          </button>
        </div>
      </div>

      {/* Conteúdo da Tela Ativa */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'colaborador' && <PortalColaborador />}

        {activeTab === 'gestor' && <PainelGestor />}

        {activeTab === 'drawer' && (
          <div className="relative h-full w-full">
            <PainelGestor />
            <GestorDrawer
              isOpen={true}
              onClose={() => setActiveTab('gestor')}
              onSalvar={(data) => {
                console.log('Salvo pelo preview:', data);
                setActiveTab('gestor');
              }}
              onNegar={() => setActiveTab('gestor')}
            />
          </div>
        )}
      </div>
    </div>
  );
}
