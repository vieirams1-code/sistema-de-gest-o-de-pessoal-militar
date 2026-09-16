import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ShieldAlert } from 'lucide-react';

export default function RegistrarPendenciaNaoRespondente({ podeRegistrar, salvando, onRegistrar }) {
  const [justificativa, setJustificativa] = useState('');

  if (!podeRegistrar) {
    return (
      <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs font-medium text-amber-800">
        Seu perfil pode consultar os não respondentes, mas não possui permissão para registrar a pendência.
      </div>
    );
  }

  return (
    <div className="mt-6 pt-5 border-t border-slate-200">
      <div className="flex items-start gap-2">
        <ShieldAlert className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
        <div>
          <h3 className="font-black text-sm text-slate-900">Tratamento formal</h3>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Registra que o militar não respondeu no prazo e libera a definição administrativa das férias pelo gestor.
          </p>
        </div>
      </div>

      <label className="block text-xs font-bold text-slate-600 mt-4 mb-1.5">Justificativa administrativa</label>
      <textarea
        value={justificativa}
        onChange={(event) => setJustificativa(event.target.value)}
        rows={3}
        placeholder="Ex.: militar não respondeu até o encerramento do prazo da campanha."
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
      />

      <Button
        type="button"
        disabled={salvando || !justificativa.trim()}
        onClick={() => onRegistrar(justificativa.trim())}
        className="w-full mt-3 bg-slate-800 hover:bg-slate-900 h-11 font-bold"
      >
        {salvando ? 'Registrando...' : 'Registrar pendência e liberar definição'}
      </Button>
    </div>
  );
}