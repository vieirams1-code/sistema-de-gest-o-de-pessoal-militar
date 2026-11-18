import React, { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { renovarContratoDesignacaoEscopado } from '@/services/cudEscopadoClient';
import { getEffectiveEmail } from '@/services/getScopedMilitaresClient';
import { normalizarStatusContratoDesignacao } from '@/services/contratosDesignacaoMilitarService';
import { calcularRenovacaoContrato, contratoDesignacaoDeterminado } from '../../../base44/shared/contratoDesignacaoVigencia.js';

const dataBr = (data = '') => String(data).slice(0, 10).split('-').reverse().join('/');

export function contratoPodeRenovar(contrato) {
  return Boolean(contratoDesignacaoDeterminado(contrato)
    && normalizarStatusContratoDesignacao(contrato?.status_contrato) === 'ativo'
    && calcularRenovacaoContrato(contrato.data_fim_contrato));
}

export function HistoricoRenovacoesContrato({ contrato }) {
  const eventos = contrato?.historico_renovacoes;
  if (!eventos?.length) return null;

  return (
    <section className="rounded-md border border-slate-200 p-4 md:col-span-2">
      <h3 className="mb-2 text-sm font-semibold text-slate-800">Histórico de renovações</h3>
      <ul className="divide-y divide-slate-100 text-sm text-slate-700">
        {[...eventos].reverse().map((evento) => (
          <li key={evento.data_fim_anterior} className="space-y-1 py-2">
            <p className="font-medium">{dataBr(evento.data_inicio_renovacao)} a {dataBr(evento.data_fim_nova)}</p>
            <p className="text-xs text-slate-600">
              {[evento.boletim_referencia, evento.data_publicacao && dataBr(evento.data_publicacao)].filter(Boolean).join(' · ')}
            </p>
            {evento.observacoes && <p className="whitespace-pre-wrap">{evento.observacoes}</p>}
            <p className="text-xs text-slate-500">Registro em {dataBr(evento.registrado_em)}{evento.registrado_por && ` · ${evento.registrado_por}`}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function RenovarContratoDesignacaoModal({ contrato, onClose }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [salvando, setSalvando] = useState(false);
  const bloqueio = useRef(false);
  const [erro, setErro] = useState('');
  const [form, setForm] = useState({ boletim_referencia: '', data_publicacao: '', observacoes: '' });
  const renovacao = calcularRenovacaoContrato(contrato.data_fim_contrato);
  const alterar = (campo, valor) => setForm((atual) => ({ ...atual, [campo]: valor }));

  async function salvar(evento) {
    evento.preventDefault();
    if (bloqueio.current || !contratoPodeRenovar(contrato)) return;
    bloqueio.current = true;
    setSalvando(true);
    setErro('');
    try {
      const atualizado = await renovarContratoDesignacaoEscopado(contrato.id, {
        ...form, data_fim_esperada: contrato.data_fim_contrato,
      }, getEffectiveEmail());
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['painel-contratos-designacao'] }),
        queryClient.invalidateQueries({ queryKey: ['ver-contratos-designacao', contrato.militar_id] }),
        queryClient.invalidateQueries({ queryKey: ['pa-bundle'] }),
      ]);
      toast({ title: 'Renovação registrada', description: `Nova vigência até ${dataBr(atualizado.data_fim_contrato)}.` });
      onClose();
    } catch (error) {
      setErro(error?.message || 'Não foi possível registrar a renovação.');
    } finally {
      setSalvando(false);
      bloqueio.current = false;
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !bloqueio.current) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Renovar contrato por 1 ano</DialogTitle>
          <DialogDescription>Confirme a vigência da renovação do contrato {contrato.numero_contrato || contrato.matricula_designacao}.</DialogDescription>
        </DialogHeader>
        <form onSubmit={salvar} className="space-y-4">
          <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
            <p>Fim vigente: {dataBr(contrato.data_fim_contrato)}</p>
            {renovacao && <p className="mt-1 font-semibold text-slate-900">Renovação: {dataBr(renovacao.inicio)} a {dataBr(renovacao.fim)}</p>}
          </div>
          <fieldset disabled={salvando} className="space-y-3">
            <div>
              <Label htmlFor="renovacao-boletim">Boletim ou referência do ato (opcional)</Label>
              <Input id="renovacao-boletim" className="mt-1" value={form.boletim_referencia} onChange={(e) => alterar('boletim_referencia', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="renovacao-data">Data da publicação (opcional)</Label>
              <Input id="renovacao-data" className="mt-1" type="date" value={form.data_publicacao} onChange={(e) => alterar('data_publicacao', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="renovacao-observacoes">Observações</Label>
              <Textarea id="renovacao-observacoes" className="mt-1" rows={2} value={form.observacoes} onChange={(e) => alterar('observacoes', e.target.value)} />
            </div>
          </fieldset>
          {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={salvando} onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={salvando || !renovacao}>{salvando ? 'Registrando…' : 'Registrar renovação'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
