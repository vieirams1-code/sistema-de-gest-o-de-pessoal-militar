import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { CheckCircle2, AlertCircle } from 'lucide-react';

/**
 * Lote 1D-D — Tabela de auditoria de comportamento.
 * Exibe sugestões geradas pelo dry-run e permite seleção via checkbox.
 *
 * Props:
 *  - sugestoes: lista da resposta de verificarComportamentoDisciplinarDryRun
 *  - selecionados: Set<string> com militar_id selecionados
 *  - onToggle: (militarId) => void
 *  - onToggleAll: () => void
 *  - pendenciasExistentesPorMilitar: Map<string, true> — para sinalizar duplicata
 */
export default function AuditoriaComportamentoTable({
  sugestoes = [],
  selecionados,
  onToggle,
  onToggleAll,
  pendenciasExistentesPorMilitar,
}) {
  const totalSelecionaveis = sugestoes.filter((s) => !pendenciasExistentesPorMilitar.has(s.militar_id)).length;
  const todosMarcados = totalSelecionaveis > 0 && totalSelecionaveis === selecionados.size;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-100 text-slate-700">
          <tr>
            <th className="p-3 w-12 text-left">
              <Checkbox
                checked={todosMarcados}
                onCheckedChange={onToggleAll}
                aria-label="Selecionar todos"
              />
            </th>
            <th className="p-3 text-left">Nome</th>
            <th className="p-3 text-left">Posto</th>
            <th className="p-3 text-left">Atual</th>
            <th className="p-3 text-left">Calculado</th>
            <th className="p-3 text-left">Tempo de serviço</th>
            <th className="p-3 text-left">Fundamento legal</th>
            <th className="p-3 text-left">Status</th>
          </tr>
        </thead>
        <tbody>
          {sugestoes.length === 0 ? (
            <tr>
              <td className="p-4 text-slate-500" colSpan={8}>
                Nenhuma sugestão encontrada para os parâmetros executados.
              </td>
            </tr>
          ) : sugestoes.map((s) => {
            const jaTemPendencia = pendenciasExistentesPorMilitar.has(s.militar_id);
            const tempo = s.detalhes_calculo?.tempo_servico_anos;
            const checked = selecionados.has(s.militar_id);
            return (
              <tr key={s.militar_id} className={jaTemPendencia ? 'bg-slate-50 text-slate-500' : 'bg-white'}>
                <td className="p-3">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => onToggle(s.militar_id)}
                    disabled={jaTemPendencia}
                    aria-label={`Selecionar ${s.militar_nome}`}
                  />
                </td>
                <td className="p-3 font-medium">{s.militar_nome}</td>
                <td className="p-3">{s.posto_graduacao}</td>
                <td className="p-3">{s.comportamento_atual}</td>
                <td className="p-3 font-semibold text-emerald-700">{s.comportamento_calculado}</td>
                <td className="p-3">{Number.isFinite(tempo) ? `${tempo} anos` : '—'}</td>
                <td className="p-3 text-slate-600 max-w-md">{s.fundamento_legal || '—'}</td>
                <td className="p-3">
                  {jaTemPendencia ? (
                    <span className="inline-flex items-center gap-1 text-amber-700 text-xs">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Pendência já existe
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-emerald-700 text-xs">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Pronta para criar
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}