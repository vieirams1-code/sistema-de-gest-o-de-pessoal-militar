import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CRITERIOS_INDIVIDUAIS_PROMOCAO_COLETIVA } from '@/utils/antiguidade/promocaoColetivaRules';

const numberOrEmpty = (value) => (Number(value || 0) > 0 ? String(value) : '');

export default function PromocaoColetivaItensTable({ itens, readOnly, onItemChange, onRemove }) {
  if (!itens?.length) {
    return <p className="text-sm text-slate-600">Nenhum militar adicionado a este ato.</p>;
  }

  const update = (item, field, value) => onItemChange(item, { ...item, [field]: value });

  return (
    <div className="overflow-auto border rounded-md">
      <table className="w-full text-xs min-w-[1100px]">
        <thead className="bg-slate-50 text-left">
          <tr>
            <th className="p-2">Militar</th>
            <th className="p-2">Posto/quadro anterior</th>
            <th className="p-2">Posto/quadro novo</th>
            <th className="p-2">Critério</th>
            <th className="p-2">Ordem boletim</th>
            <th className="p-2">Ordem curso</th>
            <th className="p-2">Nota curso</th>
            <th className="p-2">Posição final</th>
            <th className="p-2">Ajuste manual</th>
            <th className="p-2">Motivo ajuste</th>
            <th className="p-2">Status</th>
            <th className="p-2">Ações</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((item) => (
            <tr key={item.id} className="border-t align-top">
              <td className="p-2">
                <div className="font-semibold">{item.nome_guerra_snapshot || item.nome_completo_snapshot || '—'}</div>
                <div>{item.nome_completo_snapshot || '—'}</div>
                <div className="text-slate-500">{item.matricula_snapshot || 'S/MAT'}</div>
              </td>
              <td className="p-2">{item.posto_graduacao_anterior || '—'} / {item.quadro_anterior || '—'}</td>
              <td className="p-2">{item.posto_graduacao_novo || '—'} / {item.quadro_novo || '—'}</td>
              <td className="p-2">
                <select className="h-8 rounded-md border bg-transparent px-2" value={item.criterio_individual || 'antiguidade'} onChange={(e) => update(item, 'criterio_individual', e.target.value)} disabled={readOnly}>
                  {CRITERIOS_INDIVIDUAIS_PROMOCAO_COLETIVA.map((criterio) => <option key={criterio.value} value={criterio.value}>{criterio.label}</option>)}
                </select>
              </td>
              <td className="p-2"><Input type="number" min="0" value={numberOrEmpty(item.ordem_boletim)} onChange={(e) => update(item, 'ordem_boletim', Number(e.target.value || 0))} disabled={readOnly} /></td>
              <td className="p-2"><Input type="number" min="0" value={numberOrEmpty(item.ordem_informada_curso)} onChange={(e) => update(item, 'ordem_informada_curso', Number(e.target.value || 0))} disabled={readOnly} /></td>
              <td className="p-2"><Input type="number" step="0.01" min="0" value={numberOrEmpty(item.nota_curso)} onChange={(e) => update(item, 'nota_curso', Number(e.target.value || 0))} disabled={readOnly} /></td>
              <td className="p-2"><Input type="number" min="0" value={numberOrEmpty(item.posicao_final)} onChange={(e) => update(item, 'posicao_final', Number(e.target.value || 0))} disabled={readOnly} /></td>
              <td className="p-2 text-center"><input type="checkbox" checked={item.ajuste_manual === true} onChange={(e) => update(item, 'ajuste_manual', e.target.checked)} disabled={readOnly} /></td>
              <td className="p-2"><Input value={item.motivo_ajuste || ''} onChange={(e) => update(item, 'motivo_ajuste', e.target.value)} disabled={readOnly} /></td>
              <td className="p-2">{item.status_item || 'rascunho'}</td>
              <td className="p-2"><Button size="sm" variant="destructive" onClick={() => onRemove(item)} disabled={readOnly}>Remover item</Button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
