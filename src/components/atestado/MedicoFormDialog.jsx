import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Stethoscope } from 'lucide-react';
import { base44 } from '@/api/base44Client';
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
import { isSameCrm, medicoDisplayName, normalizeCrm } from './medicoUtils';

export default function MedicoFormDialog({ open, onOpenChange, initialSearch = '', onMedicoSaved }) {
  const [form, setForm] = useState({ nome: '', crm: '', observacoes: '' });
  const [saving, setSaving] = useState(false);
  const [existingMedico, setExistingMedico] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    const normalized = normalizeCrm(initialSearch);
    const looksLikeCrm = /\d/.test(normalized);
    setForm({
      nome: looksLikeCrm ? '' : String(initialSearch || '').trim(),
      crm: looksLikeCrm ? normalized : '',
      observacoes: '',
    });
    setExistingMedico(null);
    setError('');
  }, [initialSearch, open]);

  const normalizedCrm = useMemo(() => normalizeCrm(form.crm), [form.crm]);

  const findExistingByCrm = async () => {
    if (!normalizedCrm) return null;
    const directMatches = await base44.entities.Medico.filter({ crm: normalizedCrm });
    const direct = (directMatches || []).find((item) => isSameCrm(item.crm, normalizedCrm));
    if (direct) return direct;

    const recent = await base44.entities.Medico.list('-created_date', 200);
    return (recent || []).find((item) => isSameCrm(item.crm, normalizedCrm)) || null;
  };

  const selectExisting = (medico) => {
    if (!medico) return;
    onMedicoSaved?.(medico);
    onOpenChange(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    const nome = String(form.nome || '').trim();
    if (!nome || !normalizedCrm) {
      setError('Informe nome e CRM do médico.');
      return;
    }

    setSaving(true);
    try {
      const existing = await findExistingByCrm();
      if (existing) {
        setExistingMedico(existing);
        setError('Já existe um médico cadastrado com este CRM. Selecione o cadastro existente para evitar duplicidade.');
        return;
      }

      const created = await base44.entities.Medico.create({
        nome,
        crm: normalizedCrm,
        ativo: true,
        observacoes: String(form.observacoes || '').trim(),
      });
      onMedicoSaved?.(created);
      onOpenChange(false);
    } catch (err) {
      setError(err?.message || 'Falha ao cadastrar médico.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-[#1e3a5f]" />
            Cadastrar médico
          </DialogTitle>
          <DialogDescription>
            Informe os dados mínimos do médico. O CRM é validado antes da criação para evitar duplicidade simples.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="medico-nome">Nome do médico *</Label>
            <Input
              id="medico-nome"
              value={form.nome}
              onChange={(event) => setForm((prev) => ({ ...prev, nome: event.target.value }))}
              placeholder="Dr(a). Nome do médico"
              className="h-10 border-slate-200"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="medico-crm">CRM *</Label>
            <Input
              id="medico-crm"
              value={form.crm}
              onChange={(event) => setForm((prev) => ({ ...prev, crm: normalizeCrm(event.target.value) }))}
              placeholder="Ex.: CRM/UF 123456"
              className="h-10 border-slate-200"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="medico-observacoes">Observações</Label>
            <Textarea
              id="medico-observacoes"
              value={form.observacoes}
              onChange={(event) => setForm((prev) => ({ ...prev, observacoes: event.target.value }))}
              placeholder="Observações opcionais"
              className="min-h-[80px] border-slate-200"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              {error}
              {existingMedico && (
                <div className="mt-3 flex flex-col gap-2 rounded-md bg-white p-3 text-slate-700 sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-medium">{medicoDisplayName(existingMedico)}</span>
                  <Button type="button" size="sm" onClick={() => selectExisting(existingMedico)}>
                    Selecionar existente
                  </Button>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-[#1e3a5f] hover:bg-[#2d4a6f]" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cadastrar e selecionar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
