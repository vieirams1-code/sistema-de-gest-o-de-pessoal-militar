import React from 'react';
import { Button } from '@/components/ui/button';

export default function SaneamentoMatriculaDivergenteTabela({ divergencias = [], escolhas = {}, onEscolher }) {
  if (!divergencias.length) {
    return (
      <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        Nenhuma divergência encontrada.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="px-3 py-2 text-left font-semibold">Militar</th>
            <th className="px-3 py-2 text-left font-semibold">Cadastro</th>
            <th className="px-3 py-2 text-left font-semibold">Histórico</th>
            <th className="px-3 py-2 text-left font-semibold">Matrícula oficial</th>
          </tr>
        </thead>
        <tbody>
          {divergencias.map((d) => (
            <tr key={d.militar_id} className="border-t border-slate-100 align-top">
              <td className="px-3 py-3">
                <p className="font-medium text-slate-900">{d.militar_nome}</p>
                <p className="text-xs text-slate-500">
                  {[d.militar_posto, d.militar_quadro].filter(Boolean).join(' • ')}
                </p>
              </td>
              <td className="px-3 py-3 font-mono text-slate-700">{d.matricula_cadastro}</td>
              <td className="px-3 py-3 font-mono text-slate-700">{d.matricula_historico}</td>
              <td className="px-3 py-3">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={escolhas[d.militar_id] === d.matricula_cadastro_normalizada ? 'default' : 'outline'}
                    onClick={() => onEscolher(d.militar_id, d.matricula_cadastro_normalizada)}
                  >
                    Cadastro
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={escolhas[d.militar_id] === d.matricula_historico_normalizada ? 'default' : 'outline'}
                    onClick={() => onEscolher(d.militar_id, d.matricula_historico_normalizada)}
                  >
                    Histórico
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}