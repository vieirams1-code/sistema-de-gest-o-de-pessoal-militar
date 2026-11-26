import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Check, Quote, SearchX, Upload, X } from 'lucide-react';
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

function categoriaDa(sugestao) {
  if (sugestao.categoria) return sugestao.categoria;
  return sugestao.militar_id ? 'identificado' : 'ambiguo';
}

/**
 * Cartão de uma sugestão da análise assistida por IA.
 * O militar sugerido vem do backend já validado contra o texto da nota.
 */
export default function SugestaoIaItem({
  sugestao,
  militares = [],
  podeImportar = true,
  importado = false,
  salvando = false,
  aberta = false,
  erro = '',
  rotuloItem,
  onAbrir,
  onRejeitar,
  onConfirmar,
  onCancelar,
}) {
  const categoria = categoriaDa(sugestao);
  const confianca = CONFIANCA[sugestao.confianca] || CONFIANCA.baixa;
  const militar = militares.find(m => String(m.id) === String(sugestao.militar_id)) || null;
  const semCorrespondencia = categoria === 'sem_correspondencia';
  const ambiguo = categoria === 'ambiguo';
  const rotulo = rotuloItem ? rotuloItem(sugestao.item) : 'Item';

  return (
    <div className={`rounded-lg border bg-white overflow-hidden ${semCorrespondencia ? 'border-slate-300' : ambiguo ? 'border-amber-300' : 'border-emerald-200'}`}>
      <div className="px-3 py-2 border-b flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{rotulo}</Badge>
          {semCorrespondencia
            ? <Badge className="bg-slate-200 text-slate-700"><SearchX className="w-3 h-3 mr-1" />Sem correspondência</Badge>
            : ambiguo
              ? <Badge className="bg-amber-100 text-amber-800"><AlertTriangle className="w-3 h-3 mr-1" />Requer conferência</Badge>
              : <Badge className={confianca.classe}>{confianca.rotulo}</Badge>}
          {sugestao.tipo_sugerido && <span className="text-xs text-slate-500">{sugestao.tipo_sugerido}</span>}
          {importado && <Badge className="bg-emerald-100 text-emerald-800">Importado</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" disabled={importado || salvando} onClick={() => onRejeitar(sugestao)}>
            <X className="w-4 h-4 mr-1.5" />Ignorar
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={importado || !podeImportar || salvando}
            onClick={() => onAbrir(aberta ? '' : sugestao.item_id)}
          >
            <Upload className="w-4 h-4 mr-1.5" />
            {aberta ? 'Cancelar' : semCorrespondencia || ambiguo ? 'Vincular manualmente' : 'Revisar e importar'}
          </Button>
        </div>
      </div>

      <div className="px-3 py-2.5 space-y-2">
        <p className="text-xs text-slate-600">
          Candidato: {militar
            ? <strong>{rotuloMilitar(militar)}</strong>
            : <strong className="text-slate-700">nenhum militar sugerido para esta nota</strong>}
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
            titulo={`Confirmar importação — ${rotulo}`}
            militarIdInicial={sugestao.militar_id || ''}
            tipoInicial={tipoSugerido(sugestao.tipo_sugerido)}
            textoInicial={sugestao.item?.contexto || ''}
            salvando={salvando}
            podeConfirmar={podeImportar}
            onCancelar={onCancelar}
            onConfirmar={onConfirmar}
          />
          {erro && <p role="alert" className="mt-2 text-sm text-red-700">{erro}</p>}
        </div>
      )}
    </div>
  );
}