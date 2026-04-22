import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

export default function ExportarIndicadosModal({
  open,
  onOpenChange,
  campos,
  defaultSelecionados,
  onConfirm,
  confirmando,
}) {
  const [selecionados, setSelecionados] = useState(defaultSelecionados || []);

  useEffect(() => {
    if (open) {
      setSelecionados(defaultSelecionados || []);
    }
  }, [open, defaultSelecionados]);

  const mapaCampos = useMemo(() => new Map(campos.map((campo) => [campo.key, campo])), [campos]);

  const alternarCampo = (key, checked) => {
    setSelecionados((atual) => {
      if (checked) return atual.includes(key) ? atual : [...atual, key];
      return atual.filter((item) => item !== key);
    });
  };

  const todosSelecionados = selecionados.length === campos.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Exportar indicados para Excel</DialogTitle>
          <DialogDescription>Selecione os campos que devem compor a planilha de exportação.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-auto pr-1">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <p className="text-sm font-medium text-slate-700">Campos disponíveis</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setSelecionados(todosSelecionados ? [] : campos.map((campo) => campo.key))}
            >
              {todosSelecionados ? 'Limpar seleção' : 'Selecionar todos'}
            </Button>
          </div>

          {['Dados do militar', 'Dados da indicação'].map((grupo) => (
            <div key={grupo} className="rounded-lg border p-3 space-y-2">
              <p className="text-sm font-semibold text-slate-700">{grupo}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {campos.filter((campo) => campo.group === grupo).map((campo) => (
                  <label key={campo.key} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <Checkbox
                      checked={selecionados.includes(campo.key)}
                      onCheckedChange={(checked) => alternarCampo(campo.key, Boolean(checked))}
                    />
                    <span>{campo.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            type="button"
            disabled={selecionados.length === 0 || confirmando}
            onClick={() => onConfirm(selecionados.map((key) => mapaCampos.get(key)).filter(Boolean))}
          >
            Confirmar exportação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
