import React from 'react';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';

const ACAO_LABEL = {
  criar_curso: 'Criou curso',
  atualizar_curso: 'Atualizou curso',
  cancelar_curso: 'Cancelou curso',
  encerrar_curso: 'Encerrou curso',
  adicionar_participante: 'Adicionou participante',
  alterar_status: 'Alterou status',
  remover_participante: 'Removeu participante',
};

export default function AuditoriaTab({ registros, loading, curso }) {
  if (!curso) {
    return <Card className="p-8 text-center text-slate-500">Selecione um curso para ver a auditoria.</Card>;
  }

  return (
    <Card>
      {loading ? (
        <p className="p-4 text-sm text-slate-500">Carregando auditoria...</p>
      ) : registros.length === 0 ? (
        <p className="p-8 text-center text-slate-500">Nenhum registro de auditoria.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data/Hora</TableHead>
              <TableHead>Ação</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Justificativa</TableHead>
              <TableHead>Usuário</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {registros.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap text-xs text-slate-500">
                  {r.data_hora ? format(new Date(r.data_hora), 'dd/MM/yyyy HH:mm') : '—'}
                </TableCell>
                <TableCell>{ACAO_LABEL[r.acao] || r.acao}</TableCell>
                <TableCell className="text-xs">
                  {r.status_anterior ? `${r.status_anterior} → ` : ''}{r.status_novo || '—'}
                </TableCell>
                <TableCell className="text-xs text-slate-500 max-w-[200px] truncate">{r.justificativa || '—'}</TableCell>
                <TableCell className="text-xs">{r.usuario_nome || '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}