import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Eye } from 'lucide-react';

const statusClassMap = {
  Ativo: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Encerrado: 'bg-slate-100 text-slate-700 border-slate-200',
  Cancelado: 'bg-red-100 text-red-700 border-red-200',
  Prorrogado: 'bg-blue-100 text-blue-700 border-blue-200',
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR');
};

const buildMilitarNome = (atestado) =>
  [atestado?.militar_posto_grad, atestado?.militar_nome].filter(Boolean).join(' ') || 'Militar não informado';

export default function AtestadosListaVisual({
  atestados = [],
  renderActions,
  renderExpandedContent,
  loading = false,
}) {
  const [expandedRows, setExpandedRows] = useState({});


  const toggleExpanded = (id) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-7 h-7 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!atestados.length) {
    return (
      <div className="bg-white rounded-xl p-8 text-center border border-slate-100 text-slate-500">
        Nenhum atestado encontrado.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {atestados.map((atestado) => {
        const isExpanded = !!expandedRows[atestado.id];
        const hasExpandedContent = typeof renderExpandedContent === 'function';
        const periodLabel = `${formatDate(atestado.data_inicio)} → ${formatDate(atestado.data_retorno || atestado.data_termino)}`;

        return (
          <div key={atestado.id} className="bg-white border border-slate-200 rounded-lg px-3 py-2.5 shadow-sm">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 items-start">
              <div className="lg:col-span-3 min-w-0">
                <p className="font-semibold text-[13px] text-slate-800 truncate">{buildMilitarNome(atestado)}</p>
                <p className="text-xs text-slate-500 truncate">
                  Matrícula: {atestado.militar_matricula_label || atestado.militar_matricula_atual || atestado.militar_matricula || '—'}
                </p>
                <p className="text-xs text-slate-500 truncate">Lotação: {atestado.militar_lotacao || '—'}</p>
              </div>

              <div className="lg:col-span-3">
                <p className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Período</p>
                <p className="text-sm text-slate-700">{periodLabel}</p>
                <Badge variant="outline" className="mt-1.5 text-xs">Dias: {atestado.dias || '—'}</Badge>
              </div>

              <div className="lg:col-span-4">
                <p className="text-sm text-slate-700">
                  Tipo: <span className="font-medium">{atestado.tipo_afastamento || '—'}</span>
                </p>
                {atestado.cid_10 && <p className="text-xs text-slate-500 mt-0.5">CID: {atestado.cid_10}</p>}
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <Badge className={`text-xs ${statusClassMap[atestado.status] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>{atestado.status || 'Sem status'}</Badge>
                  {atestado.status_jiso && <Badge variant="secondary" className="text-xs">{atestado.status_jiso}</Badge>}
                  {atestado.status_publicacao && <Badge variant="outline" className="text-xs">{atestado.status_publicacao}</Badge>}
                </div>
              </div>

              <div className="lg:col-span-2 flex lg:justify-end gap-1.5 flex-wrap">
                {hasExpandedContent && (
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => toggleExpanded(atestado.id)}>
                    {isExpanded ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
                    Detalhes
                  </Button>
                )}
                {typeof renderActions === 'function' ? renderActions(atestado) : <Button variant="ghost" size="sm" className="h-8 text-xs" disabled><Eye className="w-4 h-4 mr-1" />Visualizar detalhes</Button>}
              </div>
            </div>

            {hasExpandedContent && isExpanded && (
              <div className="mt-3 pt-3 border-t border-slate-100">
                {renderExpandedContent(atestado)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
