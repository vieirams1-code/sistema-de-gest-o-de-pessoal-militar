import React, { useState, useEffect } from 'react';
import { RotateCcw, XCircle, AlertTriangle, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const statusClass = {
  pronta: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  erro: 'bg-orange-100 text-orange-800 border-orange-200',
  duplicada: 'bg-red-100 text-red-800 border-red-200',
  recusada: 'bg-slate-200 text-slate-700 border-slate-300',
};

function ListaMensagens({ itens, tipo = 'aviso', vazio = '—' }) {
  if (!itens?.length) return <span className="text-slate-400">{vazio}</span>;
  
  const Icon = tipo === 'erro' ? AlertCircle : AlertTriangle;

  return (
    <div className="space-y-1.5">
      {itens.map((item, idx) => (
        <p key={idx} className="flex items-start gap-1.5 leading-snug">
          <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{item}</span>
        </p>
      ))}
    </div>
  );
}

export default function TabelaRevisaoSimplificadaAlteracoesLegado({
  linhas,
  tiposPublicacaoValidos = [],
  onAlterarLinha,
  onAlternarRecusa,
}) {
  const [selecionadaId, setSelecionadaId] = useState(null);

  useEffect(() => {
    if (linhas.length > 0) {
      if (!selecionadaId || !linhas.find((l) => l.linhaNumero === selecionadaId)) {
        setSelecionadaId(linhas[0].linhaNumero);
      }
    } else {
      setSelecionadaId(null);
    }
  }, [linhas, selecionadaId]);

  if (!linhas.length) {
    return <div className="bg-white border border-slate-200 rounded-xl p-6 text-sm text-slate-500">Nenhum registro encontrado para os filtros aplicados.</div>;
  }

  const selecionadaIndex = linhas.findIndex((l) => l.linhaNumero === selecionadaId);
  const selecionada = selecionadaIndex >= 0 ? linhas[selecionadaIndex] : null;

  const handleNext = () => {
    if (selecionadaIndex < linhas.length - 1) {
      setSelecionadaId(linhas[selecionadaIndex + 1].linhaNumero);
    }
  };

  const handlePrev = () => {
    if (selecionadaIndex > 0) {
      setSelecionadaId(linhas[selecionadaIndex - 1].linhaNumero);
    }
  };

  // Navegação por teclado (Seta para Cima / Baixo)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Se o usuário estiver digitando em um campo de texto, não interfira
      const activeTag = document.activeElement?.tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag)) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (selecionadaIndex < linhas.length - 1) {
          setSelecionadaId(linhas[selecionadaIndex + 1].linhaNumero);
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (selecionadaIndex > 0) {
          setSelecionadaId(linhas[selecionadaIndex - 1].linhaNumero);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [linhas, selecionadaIndex]);

  return (
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col lg:flex-row min-h-[600px] lg:h-[calc(100vh-250px)]">
      {/* Coluna Esquerda - Lista de Cards */}
      <div className="w-full lg:w-[320px] xl:w-[360px] shrink-0 border-b lg:border-b-0 lg:border-r border-slate-200 bg-slate-50 flex flex-col lg:h-full max-h-[400px] lg:max-h-full">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-100 shrink-0">
          <h3 className="text-sm font-semibold text-slate-700">Revisão simplificada ({linhas.length})</h3>
          <p className="text-xs text-slate-500">Corrija os dados antes da importação.</p>
        </div>
        <div className="p-3 space-y-2 overflow-y-auto flex-1">
          {linhas.map((linha) => {
            const desabilitada = linha.recusada;
            const isDuplicada = linha.statusSimplificado === 'duplicada';
            const isErro = linha.statusSimplificado === 'erro';
            const isSelected = linha.linhaNumero === selecionadaId;
            
            const statusVisual = desabilitada 
              ? 'recusada' 
              : (linha.statusSimplificado || linha.status?.toLowerCase() || 'erro');
            
            const badgeLabel = desabilitada ? 'RECUSADA' : statusVisual.toUpperCase();
            
            const tipoBg = linha.tipo_bg_legado || linha.transformado?.tipo_bg_legado || '—';
            const materia = linha.materia_legado || linha.tipo_legado || linha.transformado?.materia_legado || '—';

            return (
              <div
                key={linha.linhaNumero}
                onClick={() => setSelecionadaId(linha.linhaNumero)}
                className={cn(
                  "p-3 rounded-lg border cursor-pointer transition-colors text-left",
                  isSelected ? "border-indigo-500 bg-indigo-50 shadow-sm ring-1 ring-indigo-500/20" : "border-slate-200 bg-white hover:border-slate-300",
                  desabilitada && !isSelected && 'bg-slate-100 opacity-60 text-slate-500 grayscale',
                  !desabilitada && isDuplicada && !isSelected && 'border-red-300 bg-red-50',
                  !desabilitada && isErro && !isSelected && 'border-orange-300 bg-orange-50'
                )}
              >
                <div className="flex justify-between items-start mb-2">
                  <Badge className={cn('border text-[10px] px-1.5 py-0', statusClass[statusVisual] || statusClass.erro)}>
                    {badgeLabel}
                  </Badge>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-500">Linha {linha.linhaNumero}</span>
                    <button
                      type="button"
                      title={desabilitada ? "Restaurar linha" : "Recusar linha"}
                      onClick={(e) => {
                        e.stopPropagation();
                        onAlternarRecusa(linha);
                      }}
                      className={cn("p-1 rounded transition-colors", desabilitada ? "text-slate-500 hover:bg-slate-200 hover:text-slate-700" : "text-rose-500 hover:bg-rose-100 hover:text-rose-700")}
                    >
                      {desabilitada ? <RotateCcw className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div className="text-xs text-slate-600 mb-1.5 flex flex-wrap gap-1">
                  <span className="font-semibold text-slate-700">Nota {linha.numero_nota || '—'}</span>
                  <span>&middot;</span>
                  <span>BG {linha.numero_bg_br || '—'}</span>
                  <span>&middot;</span>
                  <span>{linha.data_bg_br || '—'}</span>
                </div>
                <div className="text-xs font-medium text-slate-800 mb-1.5 flex gap-1.5 items-center">
                  <span className="bg-slate-200/70 px-1.5 py-0.5 rounded border border-slate-200 shrink-0">{tipoBg}</span>
                  <span className="truncate" title={materia}>{materia}</span>
                </div>
                <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mt-2 border-t border-slate-100 pt-1.5">
                  {linha.texto_publicado || 'Sem texto publicado.'}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Coluna Direita - Painel de Detalhe e Edição */}
      <div className="flex-1 bg-white flex flex-col lg:h-full overflow-hidden">
        {selecionada ? (() => {
          const linha = selecionada;
          const desabilitada = linha.recusada;
          const valorTipo = linha.tipo_classificado || '__fallback__';
          const tipoBg = linha.tipo_bg_legado || linha.transformado?.tipo_bg_legado || '—';
          const materia = linha.materia_legado || linha.tipo_legado || linha.transformado?.materia_legado || '—';
          
          const statusVisual = desabilitada 
            ? 'recusada' 
            : (linha.statusSimplificado || linha.status?.toLowerCase() || 'erro');
          const badgeLabel = desabilitada ? 'RECUSADA' : statusVisual.toUpperCase();

          return (
            <div className="flex flex-col h-full">
              {/* Header fixo do Painel */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 p-4 shrink-0 bg-white">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-bold text-slate-800">Linha {linha.linhaNumero}</h3>
                  <Badge className={cn('border px-2 py-0.5', statusClass[statusVisual] || statusClass.erro)}>
                    {badgeLabel}
                  </Badge>
                  <Badge variant="outline" className="text-slate-600 bg-slate-50 border-slate-200 hidden sm:inline-flex">
                    Publicação: {linha.status_publicacao}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handlePrev} disabled={selecionadaIndex <= 0}>
                    <ChevronLeft className="w-4 h-4 mr-1" /> <span className="hidden sm:inline">Anterior</span>
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleNext} disabled={selecionadaIndex >= linhas.length - 1}>
                    <span className="hidden sm:inline">Próximo</span> <ChevronRight className="w-4 h-4 ml-1 sm:ml-2" />
                  </Button>
                </div>
              </div>

              {/* Scrollable Form Content */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-white">
                <div className="space-y-6">
                  {/* Seção: Identificação */}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-slate-700 mb-4">Identificação</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-500">Número da Nota</label>
                        <Input disabled={desabilitada} value={linha.numero_nota || ''} onChange={(e) => onAlterarLinha(linha, { numero_nota: e.target.value })} className="bg-white" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-500">Número BG/BR</label>
                        <Input disabled={desabilitada} value={linha.numero_bg_br || ''} onChange={(e) => onAlterarLinha(linha, { numero_bg_br: e.target.value })} className="bg-white" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-500">Data BG/BR</label>
                        <Input disabled={desabilitada} value={linha.data_bg_br || ''} onChange={(e) => onAlterarLinha(linha, { data_bg_br: e.target.value })} placeholder="dd/mm/aaaa" className="bg-white" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-500">Tipo BG (Legado)</label>
                        <Input disabled value={tipoBg} className="bg-slate-100 text-slate-600" />
                      </div>
                      <div className="space-y-1.5 lg:col-span-2">
                        <label className="text-xs font-medium text-slate-500">Matéria (Legado)</label>
                        <Input disabled value={materia} className="bg-slate-100 text-slate-600" />
                      </div>
                    </div>
                  </div>

                  {/* Seção: Classificação */}
                  <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-indigo-900 mb-4">Classificação Final</h4>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-indigo-700">Tipo Classificado</label>
                      <Select disabled={desabilitada} value={valorTipo} onValueChange={(valor) => onAlterarLinha(linha, { tipo_classificado: valor === '__fallback__' ? '' : valor })}>
                        <SelectTrigger className="bg-white border-indigo-200 focus:ring-indigo-500">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__fallback__">{linha.tipo_legado || 'Sem classificação'}</SelectItem>
                          {tiposPublicacaoValidos.map((tipo) => <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Seção: Erros e Avisos (Movida para cima do Texto) */}
                  {(linha.erros?.length > 0 || linha.avisos?.length > 0) && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {linha.erros?.length > 0 && (
                        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4">
                          <h4 className="text-sm font-semibold text-rose-800 mb-3 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /> Erros bloqueantes</h4>
                          <div className="text-sm text-rose-700"><ListaMensagens itens={linha.erros} tipo="erro" /></div>
                        </div>
                      )}
                      {linha.avisos?.length > 0 && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                          <h4 className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> Avisos</h4>
                          <div className="text-sm text-amber-700"><ListaMensagens itens={linha.avisos} tipo="aviso" /></div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Seção: Texto Publicado */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700 flex justify-between">
                      Texto Publicado
                    </label>
                    <Textarea 
                      disabled={desabilitada} 
                      value={linha.texto_publicado || ''} 
                      onChange={(e) => onAlterarLinha(linha, { texto_publicado: e.target.value })} 
                      className="min-h-[320px] resize-y font-mono text-sm leading-relaxed p-4" 
                      placeholder="Conteúdo do texto publicado..."
                    />
                  </div>
                </div>
              </div>

              {/* Rodapé fixo com a ação principal */}
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end shrink-0">
                <Button 
                  type="button" 
                  variant={desabilitada ? 'outline' : 'destructive'} 
                  className={cn(!desabilitada && 'bg-rose-600 hover:bg-rose-700')} 
                  onClick={() => onAlternarRecusa(linha)}
                >
                  {desabilitada ? <RotateCcw className="w-4 h-4 mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
                  {desabilitada ? 'Restaurar linha' : 'Recusar linha'}
                </Button>
              </div>
            </div>
          );
        })() : (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm">
            Selecione um registro na lista para visualizar e editar os detalhes.
          </div>
        )}
      </div>
    </section>
  );
}
