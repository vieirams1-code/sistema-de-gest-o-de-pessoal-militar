import React, { useState } from 'react';
import GestorDrawer from './GestorDrawer';

const MOCK_SOLICITACOES = [
  {
    id: 1,
    postoAbrev: '2º',
    nome: '2º Tenente Edson Vieira de Souza',
    matricula: '188.747-821',
    modalidade: '2 Frações (15 + 15 dias)',
    modalidadeResumo: '2 Frações (15+15d)',
    status: 'Pendente',
    preferencias: ['1º Jan', '2º Mar', '3º Nov'],
  },
  {
    id: 2,
    postoAbrev: 'Cap',
    nome: 'Capitão Lucas Andrade Silva',
    matricula: '142.990-112',
    modalidade: 'Integral (30 dias)',
    modalidadeResumo: 'Integral (30d)',
    status: 'Pendente',
    preferencias: ['1º Jul', '2º Jan', '3º Dez'],
  },
  {
    id: 3,
    postoAbrev: '1º',
    nome: '1º Sargento Roberto Carlos Lima',
    matricula: '098.341-550',
    modalidade: '3 Frações (10 + 10 + 10 dias)',
    modalidadeResumo: '3 Frações (10+10+10d)',
    status: 'Homologado',
    preferencias: ['1º Fev', '2º Jun', '3º Out'],
  },
];

export default function PainelGestor({
  titulo = 'Gestão de Férias 2027',
  statusCampanha = 'Coleta Aberta',
  solicitacoes = MOCK_SOLICITACOES,
}) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [militarSelecionado, setMilitarSelecionado] = useState(MOCK_SOLICITACOES[0]);

  const handleAbrirDrawer = (militar) => {
    setMilitarSelecionado(militar);
    setIsDrawerOpen(true);
  };

  const handleFecharDrawer = () => {
    setIsDrawerOpen(false);
  };

  return (
    <div className="flex-col h-full bg-slate-100 overflow-hidden relative font-sans">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="bg-green-100 text-green-700 p-2 rounded-lg">
            <i className="ph ph-calendar-check text-2xl"></i>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-3">
              {titulo}
              <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded border border-green-200 uppercase tracking-wide">
                {statusCampanha}
              </span>
            </h1>
          </div>
        </div>
      </div>

      {/* Body List */}
      <div className="flex-1 overflow-y-auto p-6 relative">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
          {solicitacoes.map((item) => {
            const isPendente = item.status === 'Pendente';

            return (
              <div
                key={item.id}
                className="grid grid-cols-12 gap-4 p-4 items-center border-b border-slate-100 hover:bg-blue-50 transition-colors bg-blue-50/30"
              >
                <div className="col-span-5 flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-800 text-white rounded-full flex items-center justify-center font-bold text-sm">
                    {item.postoAbrev}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{item.nome}</p>
                    <p className="text-xs text-slate-500">Mat: {item.matricula}</p>
                  </div>
                </div>

                <div className="col-span-3">
                  <p className="text-sm font-medium text-slate-800">{item.modalidadeResumo || item.modalidade}</p>
                </div>

                <div className="col-span-2 text-center">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${
                      isPendente
                        ? 'bg-orange-100 text-orange-700 border-orange-200'
                        : 'bg-emerald-100 text-emerald-700 border-emerald-200'
                    }`}
                  >
                    {item.status}
                  </span>
                </div>

                <div className="col-span-2 text-right">
                  {/* ESTE BOTÃO DEVE ABRIR O DRAWER */}
                  <button
                    type="button"
                    onClick={() => handleAbrirDrawer(item)}
                    className="px-4 py-1.5 bg-green-50 text-green-700 hover:bg-green-600 hover:text-white border border-green-200 rounded-lg text-sm font-semibold transition-colors cursor-pointer"
                  >
                    Definir Escala
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Renderização do Drawer Lateral */}
      {isDrawerOpen && (
        <GestorDrawer
          isOpen={isDrawerOpen}
          militar={militarSelecionado}
          onClose={handleFecharDrawer}
          onSalvar={(escala) => {
            console.log('Escala confirmada:', escala);
            setIsDrawerOpen(false);
          }}
          onNegar={(m) => {
            console.log('Escala negada:', m);
            setIsDrawerOpen(false);
          }}
        />
      )}
    </div>
  );
}
