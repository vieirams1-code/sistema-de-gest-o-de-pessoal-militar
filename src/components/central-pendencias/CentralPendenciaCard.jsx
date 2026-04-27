import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { formatarDataSegura } from '@/utils/central-pendencias/centralPendencias.helpers';
import CentralPendenciaActionModal from './CentralPendenciaActionModal';
import CentralPendenciaAtestadoModal from './CentralPendenciaAtestadoModal';

const PRIORIDADE_CLASSES = {
  critica: 'bg-red-100 text-red-700',
  alta: 'bg-orange-100 text-orange-700',
  media: 'bg-amber-100 text-amber-700',
  baixa: 'bg-slate-100 text-slate-700',
};

export default function CentralPendenciaCard({ item, pendenciasAtestado = [], indiceAtestado = -1 }) {
  const [modalOpen, setModalOpen] = useState(false);
  const ehComportamentoConsolidado = item?.id === 'co-consolidado-disciplinar';
  const ehAtestado = item?.categoriaSlug === 'atestados';
  const [indiceAtestadoSelecionado, setIndiceAtestadoSelecionado] = useState(indiceAtestado >= 0 ? indiceAtestado : 0);

  const abrirModal = () => {
    if (ehAtestado && indiceAtestado >= 0) {
      setIndiceAtestadoSelecionado(indiceAtestado);
    }
    setModalOpen(true);
  };

  return (
    <article className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700">{item.categoria}</span>
        <span className={`text-xs px-2 py-1 rounded ${PRIORIDADE_CLASSES[item.prioridade] || PRIORIDADE_CLASSES.media}`}>
          {item.prioridade}
        </span>
        <span className="text-xs text-slate-500">{item.situacao}</span>
      </div>
      <h3 className="font-semibold text-slate-800">{item.titulo}</h3>
      <p className="text-sm text-slate-600">{item.descricao}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-1 text-xs text-slate-500">
        <p><strong>Militar:</strong> {item.militar || '—'}</p>
        <p><strong>Setor/OBM:</strong> {item.setor || '—'}</p>
        <p><strong>Data de referência:</strong> {formatarDataSegura(item.dataReferencia)}</p>
        <p><strong>Origem:</strong> {item.origem}</p>
      </div>
      <p className="text-xs text-slate-600"><strong>Sugestão:</strong> {item.sugestaoAcao}</p>
      <div className="flex flex-wrap items-center gap-3">
        {ehComportamentoConsolidado ? (
          <Button type="button" size="sm" onClick={abrirModal}>
            Analisar pendências
          </Button>
        ) : null}
        {ehAtestado ? (
          <Button type="button" size="sm" onClick={abrirModal}>
            Analisar atestado
          </Button>
        ) : null}

        {item.origemLink && !ehAtestado ? (
          <Link to={item.origemLink} className="text-xs text-[#1e3a5f] underline">
            {item.origemLinkLabel || 'Abrir origem'}
          </Link>
        ) : null}
      </div>

      {ehComportamentoConsolidado ? (
        <CentralPendenciaActionModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          item={item}
        />
      ) : null}

      {ehAtestado ? (
        <CentralPendenciaAtestadoModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          pendenciasAtestado={pendenciasAtestado}
          indiceAtual={indiceAtestadoSelecionado}
          onSelecionarIndice={setIndiceAtestadoSelecionado}
        />
      ) : null}
    </article>
  );
}
