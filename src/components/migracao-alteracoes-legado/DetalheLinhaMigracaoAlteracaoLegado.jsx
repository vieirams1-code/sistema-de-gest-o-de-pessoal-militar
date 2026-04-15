import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

function labelMilitar(m) {
  return `${m.posto_graduacao ? `${m.posto_graduacao} ` : ''}${m.nome_completo || m.nome_guerra || ''} ${m.matricula ? `(${m.matricula})` : ''}`.trim();
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
  return (
    <div className="space-y-4 text-sm">
      <div className="bg-slate-50 rounded-lg p-3 space-y-2">
        <Label>Selecionar / trocar militar vinculado</Label>
        <Select
          value={linha.transformado.militar_id || '__none__'}
          onValueChange={(valor) => {
            if (!valor || valor === '__none__') return;
            const militar = militares.find((m) => m.id === valor);
            if (militar) onSelecionarMilitar?.(linha, militar);
          }}
        >
          <SelectTrigger>
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

      <div className="bg-slate-50 rounded-lg p-3 space-y-2">
        <Label>Confirmar / trocar tipo final para importação</Label>
        <Select
          value={linha.transformado.tipo_publicacao_confirmado || '__none__'}
          onValueChange={(valor) => onSelecionarTipoPublicacao?.(linha, valor === '__none__' ? '' : valor)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione o tipo final" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Pendente de classificação</SelectItem>
            {tiposPublicacaoValidos.map((tipo) => (
              <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-slate-500">
          Sugerido: <strong>{linha.transformado.tipo_publicacao_sugerido || '—'}</strong>
          {linha.transformado.confianca_classificacao ? ` • Confiança: ${linha.transformado.confianca_classificacao}` : ''}
        </p>
      </div>

      <div className="bg-slate-50 rounded-lg p-3 space-y-2">
        <Label>Definir destino final da linha no lote</Label>
        <Select
          value={linha.transformado.destino_final || 'IMPORTAR'}
          onValueChange={(valor) => onSelecionarDestinoFinal?.(linha, valor)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione o destino final" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="IMPORTAR">IMPORTAR</SelectItem>
            <SelectItem value="PENDENTE_CLASSIFICACAO">PENDENTE_CLASSIFICACAO</SelectItem>
            <SelectItem value="IGNORAR">IGNORAR</SelectItem>
            <SelectItem value="EXCLUIDO_DO_LOTE">EXCLUIDO_DO_LOTE</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-slate-500">
          Destino sugerido automaticamente: <strong>{linha.transformado.destino_sugerido || '—'}</strong>
          {linha.transformado.motivo_destino ? ` • Motivo: ${linha.transformado.motivo_destino}` : ''}
        </p>
        <div className="space-y-1">
          <Label className="text-xs">Motivo da decisão (obrigatório para IGNORAR e EXCLUIDO_DO_LOTE)</Label>
          <Textarea
            value={linha.transformado.motivo_destino || ''}
            onChange={(event) => onAlterarMotivoDestino?.(linha, event.target.value)}
            placeholder="Ex.: linha fora de escopo do lote atual."
          />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <section className="bg-emerald-50 rounded-lg p-4 md:col-span-2">
          <h3 className="font-semibold mb-2">Trecho legado capturado</h3>
          <div className="bg-white/60 border border-emerald-100 rounded-md p-3 max-h-[18rem] overflow-auto">
            <p className="text-xs whitespace-pre-wrap leading-relaxed">{linha.transformado.conteudo_trecho_legado || 'Sem trecho legado informado na planilha.'}</p>
          </div>
        </section>
        <section className="bg-blue-50 rounded-lg p-3 md:col-span-2">
          <h3 className="font-semibold mb-2">Classificação automática mínima</h3>
          <div className="grid md:grid-cols-2 gap-2 text-xs">
            <p><strong>Matéria legado:</strong> {linha.transformado.materia_legado || '—'}</p>
            <p><strong>Tipo BG legado:</strong> {linha.transformado.tipo_bg_legado || '—'}</p>
            <p><strong>Militar legado:</strong> {linha.transformado.nome_completo_legado || linha.transformado.nome_guerra_legado || '—'}</p>
            <p><strong>Militar vinculado:</strong> {linha.transformado.militar_nome || '—'}</p>
            <p><strong>Tipo sugerido:</strong> {linha.transformado.tipo_publicacao_sugerido || '—'}</p>
            <p><strong>Tipo final confirmado:</strong> {linha.transformado.tipo_publicacao_confirmado || 'Pendente'}</p>
            <p><strong>Destino final:</strong> {linha.transformado.destino_final || 'IMPORTAR'}</p>
            <p><strong>Confiança:</strong> {linha.transformado.confianca_classificacao || '—'}</p>
            <p><strong>Revisão manual (origem planilha):</strong> {linha.transformado.revisao_manual || '—'}</p>
            <p className="md:col-span-2"><strong>Motivo:</strong> {linha.transformado.motivo_classificacao || '—'}</p>
            <p className="md:col-span-2"><strong>Regra usada:</strong> {linha.transformado.regra_usada || '—'}</p>
            <p className="md:col-span-2"><strong>Observação:</strong> {linha.transformado.observacao_classificacao || '—'}</p>
          </div>
        </section>
        <section className="bg-amber-50 rounded-lg p-3">
          <h3 className="font-semibold mb-2">Alertas</h3>
          {linha.alertas.length === 0 ? <p>Nenhum alerta.</p> : <ul className="list-disc pl-5">{linha.alertas.map((a) => <li key={a}>{a}</li>)}</ul>}
        </section>
        <section className="bg-indigo-50 rounded-lg p-3">
          <h3 className="font-semibold mb-2">Pendências de revisão</h3>
          {(linha.revisoes || []).length === 0 ? <p>Nenhuma pendência de revisão.</p> : <ul className="list-disc pl-5">{(linha.revisoes || []).map((r) => <li key={r}>{r}</li>)}</ul>}
        </section>
        <section className="bg-rose-50 rounded-lg p-3 md:col-span-2">
          <h3 className="font-semibold mb-2">Erros bloqueantes</h3>
          {linha.erros.length === 0 ? <p>Nenhum erro bloqueante.</p> : <ul className="list-disc pl-5">{linha.erros.map((e) => <li key={e}>{e}</li>)}</ul>}
        </section>
      </div>
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
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
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
