import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import SaneamentoMatriculaDivergenteCard from '@/components/saneamento/SaneamentoMatriculaDivergenteCard';
import SaneamentoOpcoesFeriasOrfasCard from '@/components/saneamento/SaneamentoOpcoesFeriasOrfasCard';

export default function SaneamentoCadastral() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Saneamento de Dados</h1>
        <p className="text-sm text-slate-500">
          Correção assistida de inconsistências cadastrais e de vínculos de férias.
        </p>
      </div>

      <Alert className="border-amber-300 bg-amber-50">
        <AlertTriangle className="h-4 w-4 text-amber-700" />
        <AlertTitle className="text-amber-900">Ação sobre dados de produção</AlertTitle>
        <AlertDescription className="text-amber-800">
          Cada ferramenta gera uma prévia do que será alterado e só grava após a sua confirmação. Toda
          alteração é registrada com autor, data e valores anterior e novo.
        </AlertDescription>
      </Alert>

      <SaneamentoMatriculaDivergenteCard />
      <SaneamentoOpcoesFeriasOrfasCard />
    </div>
  );
}