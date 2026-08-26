import React, { useState } from 'react';

const MESES = [
  { value: 'jan', label: 'Janeiro' },
  { value: 'fev', label: 'Fevereiro' },
  { value: 'mar', label: 'Março' },
  { value: 'abr', label: 'Abril' },
  { value: 'mai', label: 'Maio' },
  { value: 'jun', label: 'Junho' },
  { value: 'jul', label: 'Julho' },
  { value: 'ago', label: 'Agosto' },
  { value: 'set', label: 'Setembro' },
  { value: 'out', label: 'Outubro' },
  { value: 'nov', label: 'Novembro' },
  { value: 'dez', label: 'Dezembro' },
];

export default function PortalColaborador({
  militarNome = '2º Tenente Edson Vieira de Souza',
  tituloCampanha = 'Plano Anual de Férias 2027',
  periodoAquisitivo = '13/09/2024 a 12/09/2025',
  onSubmit,
}) {
  const [modalidade, setModalidade] = useState('2');
  const [opcao1, setOpcao1] = useState('jan');
  const [opcao2, setOpcao2] = useState('mar');
  const [opcao3, setOpcao3] = useState('nov');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSubmit) {
      onSubmit({ modalidade, opcao1, opcao2, opcao3 });
    } else {
      console.log('Opções registradas:', { modalidade, opcao1, opcao2, opcao3 });
      alert('Opções de férias registradas com sucesso!');
    }
  };

  return (
    <div className="flex-col h-full bg-slate-50 overflow-y-auto font-sans">
      {/* Header App */}
      <div className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-green-600 text-white rounded-full flex items-center justify-center text-lg shadow-sm">
            <i className="ph ph-user"></i>
          </div>
          <div>
            <h2 className="font-bold text-lg text-slate-900">{militarNome}</h2>
            <p className="text-sm text-slate-500">Portal do Militar • Solicitação de Férias</p>
          </div>
        </div>
      </div>

      <div className="p-8 max-w-4xl mx-auto w-full">
        <div className="mb-6">
          <h3 className="text-2xl font-bold text-slate-900">{tituloCampanha}</h3>
          <p className="text-slate-600 mt-1">Período Aquisitivo: {periodoAquisitivo}</p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Passo 1 */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <h4 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 mb-5 flex items-center gap-2">
              <i className="ph ph-list-numbers text-green-600"></i> Passo 1: Escolha a Modalidade
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="relative flex cursor-pointer rounded-lg border border-slate-300 bg-white p-4 shadow-sm focus:outline-none hover:bg-slate-50 has-[:checked]:border-green-500 has-[:checked]:bg-green-50 has-[:checked]:ring-1 has-[:checked]:ring-green-500 transition-all">
                <input
                  type="radio"
                  name="modalidade"
                  value="1"
                  className="peer sr-only"
                  checked={modalidade === '1'}
                  onChange={(e) => setModalidade(e.target.value)}
                />
                <span className="flex flex-col flex-1">
                  <span className="block text-sm font-bold text-slate-900 mb-1">Integral (30 dias)</span>
                </span>
                <i className="ph ph-check-circle text-green-600 text-xl opacity-0 peer-checked:opacity-100 absolute right-4 top-4"></i>
              </label>

              <label className="relative flex cursor-pointer rounded-lg border border-slate-300 bg-white p-4 shadow-sm focus:outline-none hover:bg-slate-50 has-[:checked]:border-green-500 has-[:checked]:bg-green-50 has-[:checked]:ring-1 has-[:checked]:ring-green-500 transition-all">
                <input
                  type="radio"
                  name="modalidade"
                  value="2"
                  className="peer sr-only"
                  checked={modalidade === '2'}
                  onChange={(e) => setModalidade(e.target.value)}
                />
                <span className="flex flex-col flex-1">
                  <span className="block text-sm font-bold text-slate-900 mb-1">2 Frações (15 + 15)</span>
                </span>
                <i className="ph ph-check-circle text-green-600 text-xl opacity-0 peer-checked:opacity-100 absolute right-4 top-4"></i>
              </label>

              <label className="relative flex cursor-pointer rounded-lg border border-slate-300 bg-white p-4 shadow-sm focus:outline-none hover:bg-slate-50 has-[:checked]:border-green-500 has-[:checked]:bg-green-50 has-[:checked]:ring-1 has-[:checked]:ring-green-500 transition-all">
                <input
                  type="radio"
                  name="modalidade"
                  value="3"
                  className="peer sr-only"
                  checked={modalidade === '3'}
                  onChange={(e) => setModalidade(e.target.value)}
                />
                <span className="flex flex-col flex-1">
                  <span className="block text-sm font-bold text-slate-900 mb-1">3 Frações (10 + 10 + 10)</span>
                </span>
                <i className="ph ph-check-circle text-green-600 text-xl opacity-0 peer-checked:opacity-100 absolute right-4 top-4"></i>
              </label>
            </div>
          </div>

          {/* Passo 2 */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h4 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 mb-5 flex items-center gap-2">
              <i className="ph ph-calendar-star text-green-600"></i> Passo 2: Preferência de Meses
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">1ª Opção</label>
                <select
                  value={opcao1}
                  onChange={(e) => setOpcao1(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-3 text-slate-900 focus:ring-2 focus:ring-green-500 outline-none"
                >
                  {MESES.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">2ª Opção</label>
                <select
                  value={opcao2}
                  onChange={(e) => setOpcao2(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-3 text-slate-900 focus:ring-2 focus:ring-green-500 outline-none"
                >
                  {MESES.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">3ª Opção</label>
                <select
                  value={opcao3}
                  onChange={(e) => setOpcao3(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-3 text-slate-900 focus:ring-2 focus:ring-green-500 outline-none"
                >
                  {MESES.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-8 flex justify-end">
              <button
                type="submit"
                className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold shadow-sm transition-colors flex items-center gap-2 cursor-pointer"
              >
                <i className="ph ph-paper-plane-tilt"></i> Registrar Minhas Opções
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
