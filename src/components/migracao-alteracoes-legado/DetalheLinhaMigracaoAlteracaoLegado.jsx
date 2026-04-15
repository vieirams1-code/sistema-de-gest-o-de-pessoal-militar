import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

function labelMilitar(m) {
  return `${m.posto_graduacao ? `${m.posto_graduacao} ` : ''}${m.nome_completo || m.nome_guerra || ''} ${m.matricula ? `(${m.matricula})` : ''}`.trim();
}

function LinhaAvisoCompacta({ titulo, itens = [], className = '' }) {
  if (!itens?.length) return null;

  return (
    <div className={`text-xs rounded-md px-3 py-2 ${className}`}>
      <span className="font-semibold">{titulo}:</span>{' '}
      <span>{itens.join(' • ')}</span>
    </div>
  );
}

function CampoResumo({ label, value }) {
  return (
    <div className="min-w-0 rounded-md border border-slate-200 bg-white px-3 py-2">
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
      <p className="text-xs text-slate-800 break-words">{value || '—'}</p>
    </div>
  );
}

function ConteudoDetalheLinha({
  linha,
  militares = [],
  tiposPublicacaoValidos = [],
  onSelecionarMilitar,
  onSelecionarTipoPublicacao,
  onSelecionarDestinoFinal,
  onAlterarMotivoDestino,
}) {
  const destinoFinal = linha.transformado.destino_final || 'IMPORTAR';
  const exigeMotivo = destinoFinal === 'IGNORAR' || destinoFinal === 'EXCLUIDO_DO_LOTE';
  const temAvisos = Boolean(linha.erros?.length || linha.revisoes?.length || linha.alertas?.length);

  return (
    <div className="space-y-3 text-sm">
      <div className="grid gap-2 lg:grid-cols-3">
        <div className="space-y-1 min-w-0">
          <Label className="text-xs text-slate-600">Militar vinculado</Label>
          <Select
            value={linha.transformado.militar_id || '__none__'}
            onValueChange={(valor) => {
              if (!valor || valor === '__none__') return;
              const militar = militares.find((m) => m.id === valor);
              if (militar) onSelecionarMilitar?.(linha, militar);
            }}
          >
            <SelectTrigger className="h-9 w-full">
              <SelectValue placeholder="Selecione um militar" />
            </SelectTrigger>
            <SelectContent>
              {linha.transformado.militar_id ? null : <SelectItem value="__none__">Sem vínculo</SelectItem>}
              {militares.map((m) => (
                <SelectItem key={m.id} value={m.id}>{labelMilitar(m)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1 min-w-0">
          <Label className="text-xs text-slate-600">Tipo confirmado</Label>
          <Select
            value={linha.transformado.tipo_publicacao_confirmado || '__none__'}
            onValueChange={(valor) => onSelecionarTipoPublicacao?.(linha, valor === '__none__' ? '' : valor)}
          >
            <SelectTrigger className="h-9 w-full">
              <SelectValue placeholder="Selecione o tipo final" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Pendente de classificação</SelectItem>
              {tiposPublicacaoValidos.map((tipo) => (
                <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1 min-w-0">
          <Label className="text-xs text-slate-600">Destino final</Label>
          <Select
            value={destinoFinal}
            onValueChange={(valor) => onSelecionarDestinoFinal?.(linha, valor)}
          >
            <SelectTrigger className="h-9 w-full">
              <SelectValue placeholder="Selecione o destino final" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="IMPORTAR">IMPORTAR</SelectItem>
              <SelectItem value="PENDENTE_CLASSIFICACAO">PENDENTE_CLASSIFICACAO</SelectItem>
              <SelectItem value="IGNORAR">IGNORAR</SelectItem>
              <SelectItem value="EXCLUIDO_DO_LOTE">EXCLUIDO_DO_LOTE</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <CampoResumo label="Matéria legado" value={linha.transformado.materia_legado} />
        <CampoResumo label="Tipo BG legado" value={linha.transformado.tipo_bg_legado} />
        <CampoResumo label="Tipo sugerido" value={linha.transformado.tipo_publicacao_sugerido} />
        <CampoResumo label="Confiança" value={linha.transformado.confianca_classificacao} />
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-slate-600">Trecho legado completo</Label>
        <div className="border border-slate-200 rounded-md bg-white p-3 max-h-60 overflow-y-auto">
          <p className="text-xs whitespace-pre-wrap break-words leading-relaxed text-slate-700">
            {linha.transformado.conteudo_trecho_legado || 'Sem trecho legado informado na planilha.'}
          </p>
        </div>
      </div>

      {exigeMotivo && (
        <div className="space-y-1">
          <Label className="text-xs text-slate-600">Motivo da decisão (obrigatório para IGNORAR e EXCLUIDO_DO_LOTE)</Label>
          <Textarea
            value={linha.transformado.motivo_destino || ''}
            onChange={(event) => onAlterarMotivoDestino?.(linha, event.target.value)}
            className="min-h-[68px] text-xs"
            placeholder="Ex.: linha fora de escopo do lote atual."
          />
        </div>
      )}

      {temAvisos && (
        <div className="space-y-1">
          <LinhaAvisoCompacta titulo="Erros" itens={linha.erros} className="bg-rose-50 text-rose-800 border border-rose-200" />
          <LinhaAvisoCompacta titulo="Pendências" itens={linha.revisoes || []} className="bg-indigo-50 text-indigo-800 border border-indigo-200" />
          <LinhaAvisoCompacta titulo="Alertas" itens={linha.alertas} className="bg-amber-50 text-amber-800 border border-amber-200" />
        </div>
      )}
    </div>
  );
}

export default function DetalheLinhaMigracaoAlteracaoLegado({
  linha,
  open,
  onOpenChange,
  modoInline = false,
  militares = [],
  tiposPublicacaoValidos = [],
  onSelecionarMilitar,
  onSelecionarTipoPublicacao,
  onSelecionarDestinoFinal,
  onAlterarMotivoDestino,
}) {
  if (!linha) return null;

  if (modoInline) {
    return (
      <ConteudoDetalheLinha
        linha={linha}
        militares={militares}
        tiposPublicacaoValidos={tiposPublicacaoValidos}
        onSelecionarMilitar={onSelecionarMilitar}
        onSelecionarTipoPublicacao={onSelecionarTipoPublicacao}
        onSelecionarDestinoFinal={onSelecionarDestinoFinal}
        onAlterarMotivoDestino={onAlterarMotivoDestino}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes da linha {linha.linhaNumero}</DialogTitle>
        </DialogHeader>

        <ConteudoDetalheLinha
          linha={linha}
          militares={militares}
          tiposPublicacaoValidos={tiposPublicacaoValidos}
          onSelecionarMilitar={onSelecionarMilitar}
          onSelecionarTipoPublicacao={onSelecionarTipoPublicacao}
          onSelecionarDestinoFinal={onSelecionarDestinoFinal}
          onAlterarMotivoDestino={onAlterarMotivoDestino}
        />
      </DialogContent>
    </Dialog>
  );
}
