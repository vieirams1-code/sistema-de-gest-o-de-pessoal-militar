import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { UserPlus, Pencil, Trash2, Award, RefreshCw, AlertTriangle } from 'lucide-react';
import { STATUS_PARTICIPANTE_LABEL, STATUS_PARTICIPANTE_CLASSE, ALUNO_LABEL } from './cursoFormacaoConfig';
import { resolverStatusMilitarComCurso } from '@/services/militarStatusVirtual';
import { STATUS_ELEGIVEIS_PROMOCAO } from '@/services/cursoFormacaoService';

export default function ParticipantesTab({ curso, participantes, loading, podeGerir, onAdicionar, onAlterarStatus, onRemover, onGerarPromocao, onSincronizarPromovidos }) {
  if (!curso) {
    return <Card className="p-8 text-center text-slate-500">Selecione um curso na aba "Cursos" para ver os participantes.</Card>;
  }

  const cursoAtivo = ['aberto', 'em_andamento'].includes(curso.status);
  const temElegiveisSemPromocao = participantes.some((p) => STATUS_ELEGIVEIS_PROMOCAO.includes(p.status) && !p.promocao_id);
  const temPromocaoPendente = participantes.some((p) => p.promocao_id && p.status !== 'promovido');

  // Resolve o posto virtual (camada de exibição) por participante, sem mutar dados.
  const resolverVirtual = (p) => resolverStatusMilitarComCurso(
    { posto_graduacao: p.posto_origem, quadro: p.quadro_origem },
    [{ id: p.id, curso_id: p.curso_id, tipo_curso: curso.tipo, status: p.status }],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <p className="font-semibold">{curso.nome}</p>
          <p className="text-xs text-slate-500">Tratamento durante o curso: <strong>{ALUNO_LABEL[curso.tipo]}</strong></p>
        </div>
        {podeGerir && (
          <div className="flex items-center gap-2 flex-wrap">
            {cursoAtivo && (
              <Button onClick={onAdicionar} className="gap-2"><UserPlus className="w-4 h-4" /> Adicionar Participantes</Button>
            )}
            {temElegiveisSemPromocao && (
              <Button variant="secondary" onClick={onGerarPromocao} className="gap-2"><Award className="w-4 h-4" /> Gerar promoção dos aprovados</Button>
            )}
            {temPromocaoPendente && (
              <Button variant="outline" onClick={onSincronizarPromovidos} className="gap-2"><RefreshCw className="w-4 h-4" /> Sincronizar promovidos</Button>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Carregando participantes...</p>
      ) : participantes.length === 0 ? (
        <Card className="p-8 text-center text-slate-500">Nenhum participante neste curso.</Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Ord.</TableHead>
                <TableHead>Militar</TableHead>
                <TableHead>Posto Real</TableHead>
                <TableHead>Posto Virtual</TableHead>
                <TableHead>Status do Curso</TableHead>
                <TableHead>Origem da Exibição</TableHead>
                {podeGerir && <TableHead className="text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {participantes.map((p) => {
                const virtual = resolverVirtual(p);
                return (
                <TableRow key={p.id}>
                  <TableCell className="text-slate-400">{p.snapshot_antiguidade}</TableCell>
                  <TableCell>
                    <span className="font-medium">{p.nome_militar_snapshot}</span>
                    <span className="text-slate-400 text-xs"> · {p.matricula_snapshot}</span>
                  </TableCell>
                  <TableCell>{virtual.posto_real}</TableCell>
                  <TableCell>
                    {virtual.possui_posto_virtual ? (
                      <Badge className="bg-indigo-100 text-indigo-700">{virtual.posto_exibicao}</Badge>
                    ) : (
                      <span className="text-slate-400 text-xs">não aplicável</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={STATUS_PARTICIPANTE_CLASSE[p.status] || ''}>
                      {STATUS_PARTICIPANTE_LABEL[p.status] || p.status}
                    </Badge>
                    {p.status === 'pendente_reanalise' && (
                      <div className="mt-1 flex items-start gap-1 text-xs text-orange-700">
                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span>Promoção vinculada foi revertida. Ação administrativa necessária.</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-slate-500">
                    {virtual.possui_posto_virtual ? virtual.motivo_exibicao : '—'}
                  </TableCell>
                  {podeGerir && (
                    <TableCell className="text-right whitespace-nowrap">
                      {!['promovido', 'reprovado', 'desligado'].includes(p.status) && (
                        <Button size="sm" variant="ghost" className="gap-1" onClick={() => onAlterarStatus(p)}>
                          <Pencil className="w-3.5 h-3.5" /> Status
                        </Button>
                      )}
                      {p.status === 'em_curso' && (
                        <Button size="sm" variant="ghost" className="gap-1 text-red-600" onClick={() => onRemover(p)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}