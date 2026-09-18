import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function AlvosInativacaoPeriodoTabela({ alvos = [] }) {
  if (!alvos.length) {
    return (
      <p className="text-sm text-slate-500">
        Nenhum militar elegível encontrado para este escopo.
      </p>
    );
  }

  return (
    <div className="max-h-96 overflow-y-auto rounded-xl border border-slate-200">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Militar</TableHead>
            <TableHead>Matrícula</TableHead>
            <TableHead>Unidade</TableHead>
            <TableHead>Período</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {alvos.map((alvo) => (
            <TableRow key={alvo.periodo_id}>
              <TableCell className="font-medium text-slate-800">{alvo.militar_nome || '—'}</TableCell>
              <TableCell className="text-slate-600">{alvo.militar_matricula || '—'}</TableCell>
              <TableCell className="text-slate-600">{alvo.militar_lotacao || '—'}</TableCell>
              <TableCell className="text-slate-600">{alvo.periodo_ref || '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}