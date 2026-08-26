import React, { useState } from 'react';

const MESES_OPCOES = [
  { value: 'jan', label: 'Janeiro (1ª Opção)' },
  { value: 'fev', label: 'Fevereiro' },
  { value: 'mar', label: 'Março (2ª Opção)' },
  { value: 'abr', label: 'Abril' },
  { value: 'mai', label: 'Maio' },
  { value: 'jun', label: 'Junho' },
  { value: 'jul', label: 'Julho' },
  { value: 'ago', label: 'Agosto' },
  { value: 'set', label: 'Setembro' },
  { value: 'out', label: 'Outubro' },
  { value: 'nov', label: 'Novembro (3ª Opção)' },
  { value: 'dez', label: 'Dezembro' },
];

export default function GestorDrawer({
  isOpen = true,
  onClose,
  militar = {
    nome: '2º Tenente Edson Vieira de Souza',
    matricula: '188.747-821',
    modalidade: '2 Frações (15 + 15 dias)',
    preferencias: ['1º Jan', '2º Mar', '3º Nov'],
  },
  onSalvar,
  onNegar,
}) {
  const [fracao1, setFracao1] = useState('jan');
  const [fracao2, setFracao2] = useState('mar');

  if (!isOpen) return null;

  const handleSalvar = () => {
    if (onSalvar) {
      onSalvar({ militar, fracao1, fracao2 });
    } else {
      console.log('Escala salva:', { militar, fracao1, fracao2 });
      alert('Escala salva com sucesso!');
    }
    if (onClose) onClose();
  };

  const handleNegar = () => {
    if (onNegar) {
      onNegar(militar);
    } else {
      console.log('Solicitação negada:', militar);
      alert('Solicitação indeferida.');
    }
    if (onClose) onClose();
  };

  return (
    <>
      {/* Fundo escuro */}
      <div
        className="absolute inset-0 bg-slate-900/40 z-20 transition-opacity"
        onClick={onClose}
      ></div>

      {/* O Drawer */}
      <div className="absolute right-0 top-0 bottom-0 w-full md:w-[750px] bg-white shadow-2xl border-l border-slate-200 z-30 flex flex-col font-sans animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="p-5 border-b border-slate-200 bg-slate-50 flex justify-between items-start shrink-0">
          <div className="flex gap-4 items-start">
            <div>
              <h2 className="font-bold text-xl text-slate-900">{militar.nome}</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 bg-white border border-slate-200 p-2 rounded-full shadow-sm cursor-pointer transition-colors"
          >
            <i className="ph ph-x"></i>
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 p-6 bg-white flex flex-col gap-6 overflow-y-auto">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-center justify-between gap-4 shrink-0">
            <div>
              <p className="text-xs font-bold text-blue-600 uppercase mb-1">Modalidade Solicitada</p>
              <p className="text-lg font-extrabold text-blue-900">{militar.modalidade}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-blue-600 uppercase mb-2">Preferências do Militar</p>
              <div className="flex gap-2 justify-end">
                {militar.preferencias?.map((pref, idx) => (
                  <span
                    key={idx}
                    className="bg-white border border-blue-200 text-blue-800 px-2.5 py-1 rounded text-xs font-bold"
                  >
                    {pref}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-xl border border-slate-200 flex-1">
            {/* Fração 1 */}
            <div>
              <label className="block text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                <span className="bg-slate-800 text-white w-6 h-6 rounded flex items-center justify-center text-xs">
                  1
                </span>
                Primeira Fração (15 dias)
              </label>
              <div className="bg-white rounded-lg border border-slate-300 shadow-sm p-1">
                <select
                  value={fracao1}
                  onChange={(e) => setFracao1(e.target.value)}
                  className="w-full p-2.5 text-slate-900 bg-transparent outline-none font-medium cursor-pointer"
                >
                  <option value="" disabled>
                    Selecione o mês...
                  </option>
                  {MESES_OPCOES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Fração 2 */}
            <div>
              <label className="block text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                <span className="bg-slate-800 text-white w-6 h-6 rounded flex items-center justify-center text-xs">
                  2
                </span>
                Segunda Fração (15 dias)
              </label>
              <div className="bg-white rounded-lg border border-slate-300 shadow-sm p-1">
                <select
                  value={fracao2}
                  onChange={(e) => setFracao2(e.target.value)}
                  className="w-full p-2.5 text-slate-900 bg-transparent outline-none font-medium cursor-pointer"
                >
                  <option value="" disabled>
                    Selecione o mês...
                  </option>
                  {MESES_OPCOES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-slate-200 bg-white flex justify-between items-center shrink-0">
          <button
            type="button"
            onClick={handleNegar}
            className="text-red-600 hover:bg-red-50 font-medium text-sm flex items-center gap-2 px-4 py-2.5 rounded-lg border border-transparent cursor-pointer transition-colors"
          >
            <i className="ph ph-prohibit"></i> Negar Solicitação
          </button>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50 cursor-pointer transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSalvar}
              className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold flex items-center gap-2 cursor-pointer shadow-sm transition-colors"
            >
              <i className="ph ph-check-circle text-lg"></i> Salvar Escala
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
