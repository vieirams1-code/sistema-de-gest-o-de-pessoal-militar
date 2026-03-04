import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { format, addDays, parseISO, subDays } from 'date-fns';
import { PlusCircle, History, Trash2 } from 'lucide-react';

export default function JisoHistoricoModal({ atestado, open, onClose }) {
  const queryClient = useQueryClient();
  const [tipo, setTipo] = useState('Prorrogação');
  const [dias, setDias] = useState('');
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDeleteIdx, setConfirmDeleteIdx] = useState(null);

  const calcularNovasDatas = () => {
    if (!atestado.data_termino || !dias) return null;
    const diasNum = parseInt(dias);
    if (isNaN(diasNum) || diasNum <= 0) return null;
    const deltaSign = tipo === 'Prorrogação' ? 1 : -1;
    const novaTermino = addDays(parseISO(atestado.data_termino), deltaSign * diasNum);
    const novaRetorno = addDays(novaTermino, 1);
    return {
      nova_data_termino: format(novaTermino, 'yyyy-MM-dd'),
      nova_data_retorno: format(novaRetorno, 'yyyy-MM-dd')
    };
  };

  const novasDatas = calcularNovasDatas();

  const handleSave = async () => {
    if (!novasDatas || !motivo) return;
    setSaving(true);

    const novoRegistro = {
      data_registro: new Date().toISOString().split('T')[0],
      tipo,
      dias_alterados: parseInt(dias),
      nova_data_termino: novasDatas.nova_data_termino,
      nova_data_retorno: novasDatas.nova_data_retorno,
      motivo
    };

    const historicoAtual = atestado.historico_jiso || [];
    await base44.entities.Atestado.update(atestado.id, {
      data_termino: novasDatas.nova_data_termino,
      data_retorno: novasDatas.nova_data_retorno,
      historico_jiso: [...historicoAtual, novoRegistro]
    });

    queryClient.invalidateQueries({ queryKey: ['atestados'] });
    queryClient.invalidateQueries({ queryKey: ['atestados-dashboard'] });
    setSaving(false);
    setDias('');
    setMotivo('');
    onClose();
  };

  const handleDelete = async (idx) => {
    const historico = [...(atestado.historico_jiso || [])];
    // Reverter o efeito deste registro nas datas
    const entry = historico[idx];
    // Recalcular datas a partir do histórico restante
    const restante = historico.filter((_, i) => i !== idx);
    let novaTermino = atestado.data_inicio;
    // Recalcular data_termino somando dias originais do atestado
    const { addDays: ad, parseISO: pI } = await import('date-fns');
    let base = pI(atestado.data_inicio + 'T00:00:00');
    let termino = ad(base, atestado.dias - 1);
    for (const r of restante) {
      const delta = r.tipo === 'Prorrogação' ? r.dias_alterados : -r.dias_alterados;
      termino = ad(termino, delta);
    }
    const novaDataTermino = format(termino, 'yyyy-MM-dd');
    const novaDataRetorno = format(ad(termino, 1), 'yyyy-MM-dd');

    await base44.entities.Atestado.update(atestado.id, {
      historico_jiso: restante,
      data_termino: novaDataTermino,
      data_retorno: novaDataRetorno
    });
    queryClient.invalidateQueries({ queryKey: ['atestados'] });
    queryClient.invalidateQueries({ queryKey: ['atestados-dashboard'] });
    setConfirmDeleteIdx(null);
  };

  const formatDate = (d) => {
    if (!d) return '-';
    return format(parseISO(d + 'T00:00:00'), 'dd/MM/yyyy');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#1e3a5f]">
            <History className="w-5 h-5" />
            Registrar Decisão da JISO
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Situação atual */}
          <div className="p-3 bg-slate-50 rounded-lg text-sm space-y-1">
            <p className="text-slate-500">Período atual:</p>
            <p className="font-medium text-slate-800">
              {formatDate(atestado.data_inicio)} → {formatDate(atestado.data_termino)} ({atestado.dias} dias)
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Tipo de Decisão</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Prorrogação">Prorrogação (adicionar dias)</SelectItem>
                <SelectItem value="Cassação">Cassação (reduzir dias)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Quantidade de Dias</Label>
            <Input
              type="number"
              min="1"
              value={dias}
              onChange={e => setDias(e.target.value)}
              placeholder="Ex: 15"
            />
          </div>

          {novasDatas && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm space-y-1">
              <p className="text-blue-700 font-medium">Nova data de término:</p>
              <p className="text-blue-900 font-bold">{formatDate(novasDatas.nova_data_termino)}</p>
              <p className="text-blue-700 font-medium mt-1">Nova data de retorno:</p>
              <p className="text-blue-900 font-bold">{formatDate(novasDatas.nova_data_retorno)}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Motivo / Observação <span className="text-red-500">*</span></Label>
            <Textarea
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              placeholder="Descreva o motivo da decisão da JISO..."
              rows={3}
            />
          </div>

          {/* Histórico anterior */}
          {atestado.historico_jiso?.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm text-slate-600">Histórico de Decisões</Label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {atestado.historico_jiso.map((h, idx) => (
                  <div key={idx} className="p-2 border rounded text-xs bg-white">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-semibold ${h.tipo === 'Prorrogação' ? 'text-blue-700' : 'text-red-700'}`}>
                        {h.tipo} de {h.dias_alterados} dias
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">{formatDate(h.data_registro)}</span>
                        <button
                          onClick={() => setConfirmDeleteIdx(idx)}
                          className="text-red-400 hover:text-red-600"
                          title="Excluir registro"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="text-slate-600">{h.motivo}</p>
                    <p className="text-slate-400">Novo término: {formatDate(h.nova_data_termino)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={saving || !novasDatas || !motivo}
              className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
            >
              {saving ? 'Salvando...' : (
                <><PlusCircle className="w-4 h-4 mr-2" />Registrar</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}