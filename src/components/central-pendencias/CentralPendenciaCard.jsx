import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { formatarDataSegura } from '@/utils/central-pendencias/centralPendencias.helpers';
import CentralPendenciaActionModal from './CentralPendenciaActionModal';

const PRIORIDADE_CLASSES = {
  critica: 'bg-red-100 text-red-700',
  alta: 'bg-orange-100 text-orange-700',
  media: 'bg-amber-100 text-amber-700',
  baixa: 'bg-slate-100 text-slate-700',
};

export default function CentralPendenciaCard({ item }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState(null);

  const podeAprovar = Boolean(item?.id === 'co-consolidado-disciplinar' && item?.podeAprovarEmLoteComportamento);

  const abrirModal = () => {
    setError('');
    setResultado(null);
    setModalOpen(true);
  };

  const confirmarAprovacao = async () => {
    if (typeof item?.aoAprovarEmLoteComportamento !== 'function') return;

    setLoading(true);
    setError('');
    try {
      const resposta = await item.aoAprovarEmLoteComportamento(item);
      setResultado(resposta);
    } catch (e) {
      setError(e?.message || 'Falha ao aprovar pendências em lote.');
    } finally {
      setLoading(false);
    }
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
        {podeAprovar ? (
          <Button type="button" size="sm" onClick={abrirModal} disabled={loading}>
            Aprovar em lote
          </Button>
        ) : null}

        {item.origemLink ? (
          <Link to={item.origemLink} className="text-xs text-[#1e3a5f] underline">
            {item.origemLinkLabel || 'Abrir origem'}
          </Link>
        ) : null}
      </div>

      <CentralPendenciaActionModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        item={item}
        loading={loading}
        error={error}
        resultado={resultado}
        onConfirm={confirmarAprovacao}
      />
    </article>
  );
}
