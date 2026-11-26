import React, { useState } from 'react';
import { Check } from 'lucide-react';
import SugestaoIaItem from '@/components/conciliacao-boletim/SugestaoIaItem';

function categoriaDa(sugestao) {
  if (sugestao.categoria) return sugestao.categoria;
  return sugestao.militar_id ? 'identificado' : 'ambiguo';
}

const GRUPOS = [
  {
    chave: 'identificado',
    titulo: 'Identificados no texto',
    descricao: 'O nome do militar aparece na própria nota. Confira e importe.',
    classe: 'text-emerald-800',
  },
  {
    chave: 'ambiguo',
    titulo: 'Requerem conferência',
    descricao: 'Indício parcial ou mais de um militar com o mesmo nome. O vínculo não foi decidido automaticamente.',
    classe: 'text-amber-800',
  },
  {
    chave: 'sem_correspondencia',
    titulo: 'Sem correspondência no texto',
    descricao: 'Nenhum nome do efetivo foi localizado nesta nota. Isso não significa ausência do militar no efetivo.',
    classe: 'text-slate-700',
  },
];

export default function SugestoesRevisaoIA({
  sugestoes = [],
  militares = [],
  podeImportar = true,
  importados = {},
  onImportar,
  onRejeitar,
  rotuloItem,
}) {
  const [abertaId, setAbertaId] = useState('');
  const [salvandoId, setSalvandoId] = useState('');
  const [erroId, setErroId] = useState('');

  if (!sugestoes.length) return null;

  const confirmarImportacao = async (sugestao, dados) => {
    setErroId('');
    setSalvandoId(sugestao.item_id);
    try {
      await onImportar({ sugestao, ...dados });
      setAbertaId('');
    } catch (e) {
      setErroId(e?.message || 'Não foi possível importar esta sugestão.');
    } finally {
      setSalvandoId('');
    }
  };

  return (
    <div className="space-y-4">
      {GRUPOS.map(grupo => {
        const itens = sugestoes.filter(sugestao => categoriaDa(sugestao) === grupo.chave);
        if (!itens.length) return null;
        return (
          <div key={grupo.chave} className="space-y-2">
            <div>
              <p className={`text-sm font-semibold ${grupo.classe}`}>{grupo.titulo} ({itens.length})</p>
              <p className="text-xs text-slate-500">{grupo.descricao}</p>
            </div>
            {itens.map(sugestao => (
              <SugestaoIaItem
                key={sugestao.item_id}
                sugestao={sugestao}
                militares={militares}
                podeImportar={podeImportar}
                importado={Boolean(importados[sugestao.item_id])}
                salvando={salvandoId === sugestao.item_id}
                aberta={abertaId === sugestao.item_id}
                erro={erroId === sugestao.item_id ? erroId : ''}
                rotuloItem={rotuloItem}
                onAbrir={setAbertaId}
                onRejeitar={onRejeitar}
                onCancelar={() => setAbertaId('')}
                onConfirmar={(dados) => confirmarImportacao(sugestao, dados)}
              />
            ))}
          </div>
        );
      })}
      <p className="text-xs text-slate-500 flex items-center gap-1.5">
        <Check className="w-3.5 h-3.5 text-emerald-600" />
        Nenhuma sugestão é gravada automaticamente: cada importação exige revisão e confirmação individual.
      </p>
    </div>
  );
}