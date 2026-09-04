import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, FileCheck2, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { registrarDecisaoJisoIndependente } from '@/services/jisoDecisionClient';

function initialEffect(item) {
  return {
    vinculo_id: item?.vinculo?.id || '',
    resultado_atestado: item?.vinculo?.resultado_atestado || '',
    dias_homologados: item?.vinculo?.dias_homologados ?? item?.atestado?.dias_jiso ?? item?.atestado?.dias ?? '',
    observacoes: item?.vinculo?.observacoes || '',
  };
}

export default function JisoDecisionDialog({ jiso, linkedAtestados = [], open, onOpenChange, onSaved }) {
  const [resultadoJiso, setResultadoJiso] = useState('');
  const [parecerJiso, setParecerJiso] = useState('');
  const [ataJiso, setAtaJiso] = useState('');
  const [effects, setEffects] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(null);

  const hasLegacyOnlyLink = useMemo(
    () => linkedAtestados.some((item) => !item?.vinculo?.id),
    [linkedAtestados],
  );

  useEffect(() => {
    if (!open) return;
    setResultadoJiso(jiso?.resultado_jiso || '');
    setParecerJiso(jiso?.parecer_jiso || '');
    setAtaJiso(jiso?.ata_jiso || '');
    setError('');
    setSaved(null);
    const next = {};
    for (const item of linkedAtestados) {
      const effect = initialEffect(item);
      const key = effect.vinculo_id || `legacy:${item?.atestado?.id || Math.random()}`;
      next[key] = effect;
    }
    setEffects(next);
  }, [open, jiso?.id, linkedAtestados]);

  const updateEffect = (key, field, value) => {
    setEffects((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  };

  const salvar = async () => {
    if (!jiso?.id) return;
    if (hasLegacyOnlyLink) {
      setError('Esta JISO ainda possui vínculo legado sem registro JISOAtestado. Execute a migração dos vínculos antes de usar a nova decisão múltipla.');
      return;
    }
    if (!resultadoJiso.trim()) {
      setError('Informe o resultado geral da JISO.');
      return;
    }

    const efeitosAtestados = linkedAtestados.map((item) => {
      const key = item.vinculo.id;
      const effect = effects[key] || {};
      return {
        vinculo_id: key,
        resultado_atestado: String(effect.resultado_atestado || '').trim(),
        dias_homologados: effect.dias_homologados === '' ? null : Number(effect.dias_homologados),
        observacoes: String(effect.observacoes || '').trim(),
      };
    });

    const semResultado = efeitosAtestados.find((effect) => !effect.resultado_atestado);
    if (semResultado) {
      setError('Informe o resultado de cada atestado vinculado.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const result = await registrarDecisaoJisoIndependente(jiso, {
        resultado_jiso: resultadoJiso.trim(),
        parecer_jiso: parecerJiso.trim(),
        ata_jiso: ataJiso.trim(),
        efeitos_atestados: efeitosAtestados,
      });
      setSaved(result);
      await onSaved?.(result);
    } catch (err) {
      const meta = err?.meta || err?.raw?.data?.meta || {};
      const detalhe = meta?.partial_write
        ? ' Houve gravação parcial; recarregue a JISO antes de tentar novamente.'
        : '';
      setError(`${err?.message || 'Não foi possível registrar a decisão.'}${detalhe}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCheck2 className="w-5 h-5" /> Registrar decisão da JISO
          </DialogTitle>
          <DialogDescription>
            Registre o resultado geral da sessão e, quando houver atestados vinculados, o efeito individual sobre cada um.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
            <p className="font-semibold text-slate-900">{jiso?.militar_posto || ''} {jiso?.militar_nome || 'Militar'}</p>
            <p className="text-slate-500 mt-1">{jiso?.finalidade_jiso || 'Finalidade não informada'} · {linkedAtestados.length} {linkedAtestados.length === 1 ? 'atestado vinculado' : 'atestados vinculados'}</p>
          </div>

          {hasLegacyOnlyLink && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 flex items-start gap-2">
              <TriangleAlert className="w-5 h-5 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Vínculo legado pendente de migração.</p>
                <p className="mt-1">A decisão nova fica bloqueada até que o vínculo antigo seja materializado em JISOAtestado, evitando gravações ambíguas.</p>
              </div>
            </div>
          )}

          <section className="space-y-3">
            <h3 className="font-semibold text-slate-900">Resultado da sessão</h3>
            <div className="grid gap-2">
              <Label>Resultado geral *</Label>
              <Input
                value={resultadoJiso}
                onChange={(e) => setResultadoJiso(e.target.value)}
                placeholder="Ex.: Apto, inapto temporariamente, homologação concluída..."
              />
            </div>
            <div className="grid gap-2">
              <Label>Parecer da JISO</Label>
              <Textarea value={parecerJiso} onChange={(e) => setParecerJiso(e.target.value)} rows={4} />
            </div>
            <div className="grid gap-2">
              <Label>Referência / dados da Ata</Label>
              <Input value={ataJiso} onChange={(e) => setAtaJiso(e.target.value)} placeholder="Número ou referência da Ata, quando disponível" />
            </div>
          </section>

          {linkedAtestados.length > 0 && (
            <section className="space-y-3">
              <div>
                <h3 className="font-semibold text-slate-900">Efeito por atestado</h3>
                <p className="text-xs text-slate-500 mt-1">Os dias e datas resultantes pertencem ao vínculo entre esta JISO e cada atestado.</p>
              </div>
              {linkedAtestados.map((item, index) => {
                const key = item?.vinculo?.id || `legacy:${item?.atestado?.id || index}`;
                const effect = effects[key] || initialEffect(item);
                return (
                  <div key={key} className="rounded-xl border border-slate-200 p-4 space-y-3">
                    <div>
                      <p className="font-medium text-slate-900">Atestado {index + 1} · {item?.atestado?.tipo_afastamento || 'Afastamento'}</p>
                      <p className="text-xs text-slate-500 mt-1">Início: {item?.atestado?.data_inicio || '—'} · Original: {item?.atestado?.dias || '—'} dias</p>
                    </div>
                    <div className="grid md:grid-cols-[1fr_160px] gap-3">
                      <div className="grid gap-2">
                        <Label>Resultado deste atestado *</Label>
                        <Input
                          value={effect.resultado_atestado || ''}
                          onChange={(e) => updateEffect(key, 'resultado_atestado', e.target.value)}
                          placeholder="Ex.: Homologado integralmente, prorrogado, cassado..."
                          disabled={!item?.vinculo?.id}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Dias homologados</Label>
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          value={effect.dias_homologados ?? ''}
                          onChange={(e) => updateEffect(key, 'dias_homologados', e.target.value)}
                          disabled={!item?.vinculo?.id}
                        />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label>Observação específica</Label>
                      <Textarea
                        value={effect.observacoes || ''}
                        onChange={(e) => updateEffect(key, 'observacoes', e.target.value)}
                        rows={2}
                        disabled={!item?.vinculo?.id}
                      />
                    </div>
                  </div>
                );
              })}
            </section>
          )}

          {linkedAtestados.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500 text-center">
              Esta JISO não possui atestados vinculados. Somente o resultado geral será registrado.
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 flex items-start gap-2">
              <TriangleAlert className="w-5 h-5 mt-0.5 shrink-0" /> {error}
            </div>
          )}

          {saved && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Decisão registrada.</p>
                <p className="text-sm mt-1">{saved.quantidade_atestados || 0} atestado(s) processado(s). A JISO foi marcada como Realizada.</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{saved ? 'Fechar' : 'Cancelar'}</Button>
          {!saved && (
            <Button onClick={salvar} disabled={saving || hasLegacyOnlyLink} className="bg-[#1e3a5f] hover:bg-[#294c75]">
              <FileCheck2 className="w-4 h-4 mr-2" /> {saving ? 'Registrando...' : 'Registrar decisão'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
