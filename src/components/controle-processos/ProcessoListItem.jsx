import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreVertical, ExternalLink, ArrowLeftRight, Pencil, Archive, Eye, Users, Clock } from 'lucide-react';
import {
  getStatusBadgeClass, getPrioridadeBadgeClass, classificarPrazo,
} from '@/utils/controle-processos/controleProcessosConfig';

function PrazoLabel({ prazo }) {
  if (!prazo) return <span className="text-slate-400">—</span>;
  const cls = classificarPrazo(prazo);
  const map = {
    atrasado: 'text-red-700 font-semibold',
    hoje: 'text-orange-700 font-semibold',
    proximo: 'text-amber-700',
    no_prazo: 'text-slate-600',
  };
  const data = new Date(`${prazo}T00:00:00`).toLocaleDateString('pt-BR');
  return (
    <span className={`inline-flex items-center gap-1 ${map[cls] || 'text-slate-600'}`}>
      <Clock className="w-3.5 h-3.5" /> {data}
    </span>
  );
}

export default function ProcessoListItem({
  processo, caixaNome, podeEditar, podeTramitar, podeArquivar,
  onVer, onTramitar, onEditar, onArquivar,
}) {
  const interessados = processo.interessados_ids || [];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">{processo.tipo_interno}</Badge>
            {processo.sistema_origem && (
              <Badge variant="secondary" className="text-xs">{processo.sistema_origem}</Badge>
            )}
            <Badge className={`text-xs ${getStatusBadgeClass(processo.status)}`}>{processo.status}</Badge>
            <Badge className={`text-xs ${getPrioridadeBadgeClass(processo.prioridade)}`}>{processo.prioridade}</Badge>
          </div>
          <button onClick={onVer} className="mt-2 text-left">
            <p className="font-semibold text-slate-900 truncate hover:text-blue-700">{processo.titulo}</p>
          </button>
          {processo.nup && <p className="text-xs text-slate-500 mt-0.5">NUP: {processo.nup}</p>}
          <div className="mt-2 flex items-center gap-4 text-xs text-slate-600 flex-wrap">
            <span>Caixa: <strong>{caixaNome || '—'}</strong></span>
            {processo.responsavel_id && <span>Resp.: {processo.responsavel_id}</span>}
            {interessados.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <Users className="w-3.5 h-3.5" /> {interessados.length} interessado(s)
              </span>
            )}
            <PrazoLabel prazo={processo.prazo} />
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="flex-shrink-0">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onVer}><Eye className="w-4 h-4 mr-2" /> Ver detalhes</DropdownMenuItem>
            {processo.link_externo && (
              <DropdownMenuItem asChild>
                <a href={processo.link_externo} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" /> Abrir no {processo.sistema_origem || 'sistema'}
                </a>
              </DropdownMenuItem>
            )}
            {podeTramitar && <DropdownMenuItem onClick={onTramitar}><ArrowLeftRight className="w-4 h-4 mr-2" /> Tramitar</DropdownMenuItem>}
            {podeEditar && <DropdownMenuItem onClick={onEditar}><Pencil className="w-4 h-4 mr-2" /> Editar</DropdownMenuItem>}
            {podeArquivar && !processo.arquivado && (
              <DropdownMenuItem onClick={onArquivar} className="text-amber-700">
                <Archive className="w-4 h-4 mr-2" /> Arquivar
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}