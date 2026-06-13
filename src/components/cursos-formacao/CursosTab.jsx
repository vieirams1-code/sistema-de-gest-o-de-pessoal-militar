import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GraduationCap, Ban, CheckCircle2, Eye } from 'lucide-react';
import { STATUS_CURSO_LABEL, STATUS_CURSO_CLASSE, TIPO_CURSO_LABEL } from './cursoFormacaoConfig';

export default function CursosTab({ cursos, loading, podeGerir, onNovo, onSelecionar, onCancelar, onEncerrar }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {podeGerir && (
          <Button onClick={onNovo} className="gap-2">
            <GraduationCap className="w-4 h-4" /> Novo Curso
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Carregando cursos...</p>
      ) : cursos.length === 0 ? (
        <Card className="p-8 text-center text-slate-500">Nenhum curso de formação cadastrado.</Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {cursos.map((curso) => (
            <Card key={curso.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{curso.nome}</p>
                  <p className="text-xs text-slate-500">{TIPO_CURSO_LABEL[curso.tipo] || curso.tipo}</p>
                  {curso.turma_referencia && <p className="text-xs text-slate-400">Turma: {curso.turma_referencia}</p>}
                </div>
                <Badge className={STATUS_CURSO_CLASSE[curso.status] || ''}>
                  {STATUS_CURSO_LABEL[curso.status] || curso.status}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="gap-1" onClick={() => onSelecionar(curso)}>
                  <Eye className="w-3.5 h-3.5" /> Participantes
                </Button>
                {podeGerir && ['aberto', 'em_andamento'].includes(curso.status) && (
                  <>
                    <Button size="sm" variant="outline" className="gap-1 text-emerald-700" onClick={() => onEncerrar(curso)}>
                      <CheckCircle2 className="w-3.5 h-3.5" /> Encerrar
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1 text-red-600" onClick={() => onCancelar(curso)}>
                      <Ban className="w-3.5 h-3.5" /> Cancelar
                    </Button>
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}