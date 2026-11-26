import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TIPOS_IMPORTACAO, filtrarMilitaresPorBusca, rotuloMilitar } from '@/services/conciliacaoImportService';

export default function FormularioImportacaoNota({
  militares = [],
  titulo,
  militarIdInicial = '',
  tipoInicial = '',
  textoInicial = '',
  salvando = false,
  podeConfirmar = true,
  rotuloAcao = 'Confirmar e importar RP',
  textoConfirmacao = 'Confirmei o militar, o tipo e o texto com o documento original. Autorizo criar um RP publicado com este registro.',
  onCancelar,
  onConfirmar,
}) {
  const [busca, setBusca] = useState('');
  const [militarId, setMilitarId] = useState(militarIdInicial);
  const [tipoValue, setTipoValue] = useState(tipoInicial);
  const [texto, setTexto] = useState(textoInicial);
  const [confirmado, setConfirmado] = useState(false);

  const lista = useMemo(() => filtrarMilitaresPorBusca(militares, busca), [militares, busca]);
  const militarSelecionado = militares.find(m => String(m.id) === String(militarId)) || null;

  const enviar = () => {
    const tipo = TIPOS_IMPORTACAO.find(t => t.value === tipoValue);
    if (!militarSelecionado || !tipo || !String(texto || '').trim()) return;
    onConfirmar({ militar: militarSelecionado, tipo, texto: String(texto).trim() });
  };

  const bloqueado = salvando || !podeConfirmar || !confirmado
    || !militarSelecionado || !tipoValue || !String(texto || '').trim();

  return (
    <div className="border-t pt-4 space-y-3 bg-slate-50/60 rounded-b-lg">
      <p className="font-semibold text-sm text-[#1e3a5f]">{titulo}</p>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <Label>Militar responsável pelo RP *</Label>
          <Input
            placeholder="Buscar militar ativo por nome ou matrícula"
            value={busca}
            onChange={e => { setBusca(e.target.value); setMilitarId(''); }}
          />
          <select
            aria-label="Confirmar militar destinatário da publicação"
            className="w-full h-10 border rounded-md px-2 text-sm bg-white"
            value={militarId}
            onChange={e => setMilitarId(e.target.value)}
          >
            <option value="">Selecione explicitamente o militar</option>
            {lista.map(m => <option key={m.id} value={m.id}>{rotuloMilitar(m)}</option>)}
            {militarSelecionado && !lista.some(m => String(m.id) === String(militarId)) && (
              <option value={militarId}>{rotuloMilitar(militarSelecionado)}</option>
            )}
          </select>
        </div>
        <div className="space-y-1">
          <Label>Tipo do RP *</Label>
          <select
            aria-label="Tipo do registro de publicação"
            value={tipoValue}
            onChange={e => setTipoValue(e.target.value)}
            className="w-full h-10 border rounded-md px-2 text-sm bg-white"
          >
            <option value="">Selecione o tipo a registrar</option>
            {TIPOS_IMPORTACAO.map(t => <option key={t.entidade + t.value} value={t.value}>{t.label}</option>)}
          </select>
          <p className="text-xs text-slate-500">A classificação sugerida é apenas indicativa. Confirme a correta.</p>
        </div>
      </div>
      <div className="space-y-1">
        <Label>Texto da publicação (revisável) *</Label>
        <textarea
          aria-label="Texto a importar"
          rows={5}
          className="w-full rounded-md border p-3 text-sm bg-white"
          value={texto}
          onChange={e => setTexto(e.target.value)}
        />
      </div>
      <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
        <input type="checkbox" checked={confirmado} onChange={e => setConfirmado(e.target.checked)} className="mt-1" />
        {textoConfirmacao}
      </label>
      {!podeConfirmar && (
        <p className="text-xs text-amber-700">Sem permissão para criar este tipo de RP.</p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        {onCancelar && (
          <Button variant="outline" size="sm" onClick={onCancelar} disabled={salvando}>Cancelar</Button>
        )}
        <Button size="sm" disabled={bloqueado} onClick={enviar}>
          {salvando ? 'Importando…' : rotuloAcao}
        </Button>
      </div>
    </div>
  );
}