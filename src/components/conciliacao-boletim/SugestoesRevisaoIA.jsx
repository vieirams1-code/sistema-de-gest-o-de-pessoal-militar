import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, Quote, Upload, X } from 'lucide-react';
import TextoRevisavel from '@/components/conciliacao-boletim/TextoRevisavel';
import FormularioImportacaoNota from '@/components/conciliacao-boletim/FormularioImportacaoNota';
import { TIPOS_IMPORTACAO, rotuloMilitar } from '@/services/conciliacaoImportService';

const CONFIANCA = {
  alta: { rotulo: 'Evidência forte', classe: 'bg-emerald-100 text-emerald-800' },
  media: { rotulo: 'Confirmar', classe: 'bg-amber-100 text-amber-800' },
  baixa: { rotulo: 'Indício fraco', classe: 'bg-slate-200 text-slate-700' },
};

function tipoSugerido(valor) {
  return TIPOS_IMPORTACAO.some(t => t.value === valor) ? valor : '';
}

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
    <div className="space-y-3">
      {sugestoes.map((sugestao) => {
        const confianca = CONFIANCA[sugestao.confianca] || CONFIANCA.baixa;
        const importado = Boolean(importados[sugestao.item_id]);
        const militar = militares.find(m => String(m.id) === String(sugestao.militar_id)) || null;
        const aberta = abertaId === sugestao.item_id;
        return (
          <div key={sugestao.item_id} className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div className="px-3 py-2 border-b flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{rotuloItem ? rotuloItem(sugestao.item) : 'Item'}</Badge>
                <Badge className={confianca.classe}>{confianca.rotulo}</Badge>
                {sugestao.tipo_sugerido && <span className="text-xs text-slate-500">{sugestao.tipo_sugerido}</span>}
                {importado && <Badge className="bg-emerald-100 text-emerald-800">Importado</Badge>}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={importado || salvandoId === sugestao.item_id}
                  onClick={() => onRejeitar(sugestao)}
                >
                  <X className="w-4 h-4 mr-1.5" />Rejeitar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={importado || !podeImportar || salvandoId === sugestao.item_id}
                  onClick={() => { setErroId(''); setAbertaId(aberta ? '' : sugestao.item_id); }}
                >
                  <Upload className="w-4 h-4 mr-1.5" />{aberta ? 'Cancelar' : 'Revisar e importar'}
                </Button>
              </div>
            </div>

            <div className="px-3 py-2.5 space-y-2">
              <p className="text-xs text-slate-600">
                Candidato: {militar
                  ? <strong>{rotuloMilitar(militar)}</strong>
                  : <strong className="text-amber-700">nenhum militar sugerido — confira manualmente</strong>}
              </p>
              {sugestao.resumo && <p className="text-sm text-slate-700">{sugestao.resumo}</p>}
              {sugestao.motivo && <p className="text-xs text-slate-600">{sugestao.motivo}</p>}
              {sugestao.trecho_evidencia && (
                <p className="flex gap-2 rounded-md bg-slate-50 border border-slate-200 p-2 text-xs text-slate-700 italic">
                  <Quote className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
                  <span>{sugestao.trecho_evidencia}</span>
                </p>
              )}
              <TextoRevisavel texto={sugestao.item?.contexto || ''} limite={600} />
            </div>

            {aberta && (
              <div className="px-3 pb-3">
                <FormularioImportacaoNota
                  militares={militares}
                  titulo={`Confirmar importação — ${rotuloItem ? rotuloItem(sugestao.item) : 'item'}`}
                  militarIdInicial={sugestao.militar_id || ''}
                  tipoInicial={tipoSugerido(sugestao.tipo_sugerido)}
                  textoInicial={sugestao.item?.contexto || ''}
                  salvando={salvandoId === sugestao.item_id}
                  podeConfirmar={podeImportar}
                  onCancelar={() => setAbertaId('')}
                  onConfirmar={(dados) => confirmarImportacao(sugestao, dados)}
                />
                {erroId === sugestao.item_id && (
                  <p role="alert" className="mt-2 text-sm text-red-700">{erroId}</p>
                )}
              </div>
            )}
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