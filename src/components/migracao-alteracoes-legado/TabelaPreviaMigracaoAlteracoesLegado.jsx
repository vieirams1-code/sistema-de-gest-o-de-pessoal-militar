import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronsUpDown, FileText, UserRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { construirSugestaoSistema } from '@/components/migracao-alteracoes-legado/sugestaoSistemaHelper';

const statusLabel = {
  APTO: 'Apto',
  APTO_COM_ALERTA: 'Apto com alerta',
  REVISAR: 'Revisar',
  IGNORADO: 'Ignorado',
  EXCLUIDO_DO_LOTE: 'Excluído do lote',
  ERRO: 'Erro',
};

const statusClass = {
  APTO: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  APTO_COM_ALERTA: 'bg-amber-100 text-amber-800 border-amber-200',
  REVISAR: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  IGNORADO: 'bg-slate-100 text-slate-700 border-slate-200',
  EXCLUIDO_DO_LOTE: 'bg-zinc-200 text-zinc-700 border-zinc-300',
  ERRO: 'bg-rose-100 text-rose-800 border-rose-200',
};

const destinosFinais = [
  'IMPORTAR',
  'PENDENTE_CLASSIFICACAO',
  'IGNORAR',
  'EXCLUIDO_DO_LOTE',
];

function labelMilitar(m) {
  return `${m.posto_graduacao ? `${m.posto_graduacao} ` : ''}${m.nome_completo || m.nome_guerra || ''} ${m.matricula ? `(${m.matricula})` : ''}`.trim();
}

export default function TabelaPreviaMigracaoAlteracoesLegado({
  linhas,
  militares = [],
  tiposPublicacaoValidos = [],
  onSelecionarMilitar,
  onSelecionarTipoPublicacao,
  onSelecionarDestinoFinal,
  onAlterarMotivoDestino,
}) {
  const [linhaSelecionadaNumero, setLinhaSelecionadaNumero] = useState(null);
  const [autocompleteAberto, setAutocompleteAberto] = useState(false);

  useEffect(() => {
    if (!linhas.length) {
      setLinhaSelecionadaNumero(null);
      return;
    }

    const selecionadaExiste = linhas.some((linha) => linha.linhaNumero === linhaSelecionadaNumero);
    if (!selecionadaExiste) {
      setLinhaSelecionadaNumero(linhas[0].linhaNumero);
    }
  }, [linhas, linhaSelecionadaNumero]);

  const linhaSelecionada = useMemo(
    () => linhas.find((linha) => linha.linhaNumero === linhaSelecionadaNumero) || null,
    [linhas, linhaSelecionadaNumero],
  );

  if (!linhas.length) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 text-sm text-slate-500">
        Nenhum registro encontrado para os filtros aplicados.
      </div>
    );
  }

  const destinoFinal = linhaSelecionada?.transformado.destino_final || 'IMPORTAR';
  const exigeMotivo = destinoFinal === 'IGNORAR' || destinoFinal === 'EXCLUIDO_DO_LOTE';
  const sugestoes = construirSugestaoSistema(linhaSelecionada, tiposPublicacaoValidos);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[25rem,1fr] gap-4">
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <h3 className="text-sm font-semibold text-slate-700">Registros legados</h3>
          <p className="text-xs text-slate-500">Selecione um item para revisar os detalhes e classificar.</p>
        </div>
        <div className="max-h-[68vh] overflow-y-auto p-3 space-y-2">
          {linhas.map((linha) => {
            const selecionada = linha.linhaNumero === linhaSelecionadaNumero;
            const nomeMilitar = linha.transformado.militar_nome || linha.transformado.nome_completo_legado || linha.transformado.nome_guerra_legado || 'Militar não identificado';
            const trecho = linha.transformado.conteudo_trecho_legado || linha.transformado.materia_legado || 'Sem trecho disponível';

            return (
              <button
                key={linha.linhaNumero}
                type="button"
                onClick={() => setLinhaSelecionadaNumero(linha.linhaNumero)}
                className={cn(
                  'w-full text-left rounded-lg border p-3 transition-colors',
                  selecionada
                    ? 'border-indigo-400 bg-indigo-50 shadow-sm'
                    : 'border-slate-200 bg-white hover:bg-slate-50',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-800 truncate">{nomeMilitar}</p>
                    <p className="text-xs text-slate-500">Matrícula: {linha.transformado.matricula_legado || '—'}</p>
                  </div>
                  <Badge className={cn('border', statusClass[linha.status])}>{statusLabel[linha.status]}</Badge>
                </div>
                <p className="text-xs text-slate-700 mt-2 truncate">{linha.transformado.materia_legado || 'Matéria não informada'}</p>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{trecho}</p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-4 md:p-5 flex flex-col gap-4">
        {!linhaSelecionada ? null : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Militar vinculado</p>
                <p className="text-sm font-semibold text-slate-800">{linhaSelecionada.transformado.militar_nome || 'Sem vínculo confirmado'}</p>
                <p className="text-xs text-slate-600">Matrícula: {linhaSelecionada.transformado.militar_matricula_atual || linhaSelecionada.transformado.matricula_legado || '—'}</p>
                <div className="mt-3">
                  <Label className="text-xs text-slate-600">Ajustar militar</Label>
                  <Select
                    value={linhaSelecionada.transformado.militar_id || '__none__'}
                    onValueChange={(valor) => {
                      if (!valor || valor === '__none__') return;
                      const militar = militares.find((m) => m.id === valor);
                      if (militar) onSelecionarMilitar?.(linhaSelecionada, militar);
                    }}
                  >
                    <SelectTrigger className="h-9 mt-1">
                      <SelectValue placeholder="Selecione um militar" />
                    </SelectTrigger>
                    <SelectContent>
                      {linhaSelecionada.transformado.militar_id ? null : <SelectItem value="__none__">Sem vínculo</SelectItem>}
                      {militares.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{labelMilitar(m)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Matéria legada</p>
                <p className="text-sm font-semibold text-slate-800">{linhaSelecionada.transformado.materia_legado || 'Não informada'}</p>
                <p className="text-xs text-slate-600">Referência: Nota {linhaSelecionada.transformado.nota_id_legado || '—'} • BG {linhaSelecionada.transformado.numero_bg || '—'}</p>
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs text-slate-600">Classificação atual:</span>
                  <Badge className={cn('border', statusClass[linhaSelecionada.status])}>{statusLabel[linhaSelecionada.status]}</Badge>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-slate-600">Trecho do texto legado</Label>
              <div className="border border-slate-200 rounded-lg bg-white p-3 min-h-36 max-h-56 overflow-y-auto">
                <p className="text-sm whitespace-pre-wrap break-words leading-relaxed text-slate-700">
                  {linhaSelecionada.transformado.conteudo_trecho_legado || 'Sem trecho legado informado na planilha.'}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
              <p className="text-xs font-medium text-indigo-700 uppercase tracking-wide">Sugestão do sistema</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge className="bg-indigo-700 text-white">{sugestoes.principal.tipo}</Badge>
                <span className="text-sm font-semibold text-indigo-700">{sugestoes.principal.confianca}% de confiança</span>
              </div>
              {sugestoes.secundarias.length > 0 && (
                <div className="mt-2 text-xs text-indigo-900 space-y-1">
                  {sugestoes.secundarias.map((item) => (
                    <p key={item.tipo}>{item.tipo} — {item.confianca}%</p>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-slate-600">Pesquisar tipo do sistema</Label>
                <Popover open={autocompleteAberto} onOpenChange={setAutocompleteAberto}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                      {linhaSelecionada.transformado.tipo_publicacao_confirmado || 'Selecione o tipo'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Pesquisar tipo..." />
                      <CommandList>
                        <CommandEmpty>Nenhum tipo encontrado.</CommandEmpty>
                        <CommandGroup className="max-h-60 overflow-auto">
                          <CommandItem
                            value="Pendente de classificação"
                            onSelect={() => {
                              onSelecionarTipoPublicacao?.(linhaSelecionada, '');
                              setAutocompleteAberto(false);
                            }}
                          >
                            <Check className={cn('mr-2 h-4 w-4', !linhaSelecionada.transformado.tipo_publicacao_confirmado ? 'opacity-100' : 'opacity-0')} />
                            Pendente de classificação
                          </CommandItem>
                          {tiposPublicacaoValidos.map((tipo) => (
                            <CommandItem
                              key={tipo}
                              value={tipo}
                              onSelect={() => {
                                onSelecionarTipoPublicacao?.(linhaSelecionada, tipo);
                                setAutocompleteAberto(false);
                              }}
                            >
                              <Check className={cn('mr-2 h-4 w-4', linhaSelecionada.transformado.tipo_publicacao_confirmado === tipo ? 'opacity-100' : 'opacity-0')} />
                              {tipo}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-slate-600">Destino final</Label>
                <Select
                  value={destinoFinal}
                  onValueChange={(valor) => onSelecionarDestinoFinal?.(linhaSelecionada, valor)}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Selecione o destino final" />
                  </SelectTrigger>
                  <SelectContent>
                    {destinosFinais.map((destino) => (
                      <SelectItem key={destino} value={destino}>{destino}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-slate-600">Observações</Label>
              <Textarea
                value={linhaSelecionada.transformado.motivo_destino || ''}
                onChange={(event) => onAlterarMotivoDestino?.(linhaSelecionada, event.target.value)}
                className="min-h-[76px] text-sm"
                placeholder={exigeMotivo ? 'Motivo obrigatório para este destino.' : 'Observação opcional sobre o registro.'}
              />
            </div>

            <div className="mt-auto border-t border-slate-200 pt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                className="bg-indigo-600 hover:bg-indigo-700"
                onClick={() => {
                  const tipoPrincipal = sugestoes.principal.tipo === 'Sem sugestão' ? '' : sugestoes.principal.tipo;
                  if (tipoPrincipal) onSelecionarTipoPublicacao?.(linhaSelecionada, tipoPrincipal);
                }}
              >
                <FileText className="w-4 h-4 mr-2" /> Marcar tipo
              </Button>
              <Button type="button" className="bg-emerald-700 hover:bg-emerald-800" onClick={() => onSelecionarDestinoFinal?.(linhaSelecionada, 'IMPORTAR')}>
                <Check className="w-4 h-4 mr-2" /> Importar
              </Button>
              <Button type="button" variant="outline" onClick={() => onSelecionarDestinoFinal?.(linhaSelecionada, 'PENDENTE_CLASSIFICACAO')}>
                <UserRound className="w-4 h-4 mr-2" /> Enviar para revisão
              </Button>
              <Button type="button" variant="outline" className="text-rose-700 border-rose-200 hover:text-rose-800" onClick={() => onSelecionarDestinoFinal?.(linhaSelecionada, 'IGNORAR')}>
                Ignorar
              </Button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
