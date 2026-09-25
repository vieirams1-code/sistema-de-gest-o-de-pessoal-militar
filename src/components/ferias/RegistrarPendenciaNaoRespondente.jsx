import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ShieldAlert, CheckCircle2, AlertCircle, Clock3 } from 'lucide-react';

function formatarDataBR(valor) {
  const match = String(valor || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '-';
}

export default function RegistrarPendenciaNaoRespondente({ podeRegistrar, salvando, onRegistrar, previa, feedback }) {
  const [justificativa, setJustificativa] = useState('');

  if (!podeRegistrar) {
    return (
      <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs font-medium text-amber-800">
        Seu perfil pode consultar os não respondentes, mas não possui permissão para registrar a pendência.
      </div>
    );
  }

  const verificando = Boolean(previa?.loading);
  const bloqueio = previa?.error || '';
  const elegivel = previa?.data || null;
  const podeEnviar = Boolean(justificativa.trim()) && !salvando && !verificando && !bloqueio;

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

      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-xs leading-relaxed">
        {verificando ? (
          <span className="inline-flex items-center gap-2 text-slate-500">
            <Clock3 className="w-3.5 h-3.5" />
            Verificando o período aquisitivo elegível...
          </span>
        ) : bloqueio ? (
          <span className="inline-flex items-start gap-2 text-red-700">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>{bloqueio}</span>
          </span>
        ) : elegivel ? (
          <span className="inline-flex items-start gap-2 text-slate-700">
            <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-600" />
            <span>
              Período elegível: <strong>{formatarDataBR(elegivel.periodo?.inicio)} a {formatarDataBR(elegivel.periodo?.fim)}</strong> · serão liberados{' '}
              <strong>{elegivel.dias_liberados} dia(s)</strong> para definição.
            </span>
          </span>
        ) : (
          <span className="text-slate-500">Período aquisitivo ainda não verificado.</span>
        )}
      </div>

      <label className="block text-xs font-bold text-slate-600 mt-4 mb-1.5">
        Justificativa administrativa <span className="text-red-600">*</span>
      </label>
      <textarea
        value={justificativa}
        onChange={(event) => setJustificativa(event.target.value)}
        rows={3}
        placeholder="Ex.: militar não respondeu até o encerramento do prazo da campanha."
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
      />

      {!justificativa.trim() && !bloqueio && !verificando && (
        <p className="mt-1.5 text-xs text-slate-500">Informe a justificativa para habilitar o registro.</p>
      )}

      {feedback && (
        <div className={`mt-3 rounded-lg border px-3 py-3 text-xs font-medium leading-relaxed ${feedback.type === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
          {feedback.message}
        </div>
      )}

      <Button
        type="button"
        disabled={!podeEnviar}
        onClick={() => onRegistrar(justificativa.trim())}
        className="w-full mt-3 bg-slate-800 hover:bg-slate-900 h-11 font-bold"
      >
        {salvando ? 'Registrando...' : 'Registrar pendência e liberar definição'}
      </Button>
    </div>
  );
}