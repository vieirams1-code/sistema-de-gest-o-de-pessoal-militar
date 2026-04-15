import React from 'react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

function FiltroSwitch({ id, label, checked, onChange }) {
  return (
    <label htmlFor={id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 bg-white">
      <span className="text-sm text-slate-700">{label}</span>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

export default function HistoricoImportacoesMilitaresFiltros({ filtros, onChangeFiltros, onLimpar }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-1">
          <label className="text-xs text-slate-500">Arquivo</label>
          <Input
            placeholder="Buscar por nome do arquivo"
            value={filtros.arquivo}
            onChange={(event) => onChangeFiltros({ arquivo: event.target.value })}
          />
        </div>
        <div>
          <label className="text-xs text-slate-500">Período de</label>
          <Input type="date" value={filtros.inicio} onChange={(event) => onChangeFiltros({ inicio: event.target.value })} />
        </div>
        <div>
          <label className="text-xs text-slate-500">Até</label>
          <Input type="date" value={filtros.fim} onChange={(event) => onChangeFiltros({ fim: event.target.value })} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
        <FiltroSwitch id="mostrar-ocultadas" label="Mostrar ocultadas" checked={filtros.mostrarOcultadas} onChange={(v) => onChangeFiltros({ mostrarOcultadas: v })} />
        <FiltroSwitch id="com-pendencias" label="Lote com pendências" checked={filtros.comPendencias} onChange={(v) => onChangeFiltros({ comPendencias: v })} />
        <FiltroSwitch id="com-erro" label="Lote com erro" checked={filtros.comErro} onChange={(v) => onChangeFiltros({ comErro: v })} />
        <FiltroSwitch id="concluida" label="Importação concluída" checked={filtros.somenteConcluida} onChange={(v) => onChangeFiltros({ somenteConcluida: v })} />
        <FiltroSwitch id="analise" label="Somente análise" checked={filtros.somenteAnalise} onChange={(v) => onChangeFiltros({ somenteAnalise: v })} />
        <FiltroSwitch id="com-revisar" label="Com linhas REVISAR" checked={filtros.comRevisar} onChange={(v) => onChangeFiltros({ comRevisar: v })} />
        <FiltroSwitch id="com-linhas-erro" label="Com linhas ERRO" checked={filtros.comLinhasErro} onChange={(v) => onChangeFiltros({ comLinhasErro: v })} />
        <FiltroSwitch id="com-alerta" label="Com APTO_COM_ALERTA" checked={filtros.comAlerta} onChange={(v) => onChangeFiltros({ comAlerta: v })} />
      </div>

      <div className="flex justify-end">
        <button type="button" onClick={onLimpar} className="text-sm text-slate-600 hover:text-slate-900 underline underline-offset-2">
          Limpar filtros
        </button>
      </div>
    </div>
  );
}
