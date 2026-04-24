import React, { useEffect, useState } from 'react';
import { CalendarIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { canonicalDateToBR, canonicalDateToUTCDate, normalizeLegacyDateToCanonical } from '@/utils/dateNormalization';

const CAMPOS_INICIAIS = {
  nome_completo: '',
  nome_guerra: '',
  matricula: '',
  cpf: '',
  data_inclusao: '',
};

export default function DetalheLinhaMigracao({ linha, open, onOpenChange, onSalvarCorrecao, saving = false, modo = 'IMPORTAR' }) {
  const isConferencia = modo === 'CONFERIR';
  const [form, setForm] = useState(CAMPOS_INICIAIS);
  const [erroDataInclusao, setErroDataInclusao] = useState('');

  useEffect(() => {
    const dataCanonical = normalizeLegacyDateToCanonical(linha?.transformado?.data_inclusao || '');
    setForm({
      nome_completo: linha?.transformado?.nome_completo || '',
      nome_guerra: linha?.transformado?.nome_guerra || '',
      matricula: linha?.transformado?.matricula || '',
      cpf: linha?.transformado?.cpf || '',
      data_inclusao: canonicalDateToBR(dataCanonical),
    });
    setErroDataInclusao('');
  }, [linha]);

  const handleChange = (campo, valor) => setForm((prev) => ({ ...prev, [campo]: valor }));

  const handleDataInclusaoChange = (value) => {
    handleChange('data_inclusao', value);
    setErroDataInclusao('');
  };

  const handleDataInclusaoBlur = () => {
    if (!form.data_inclusao?.trim()) {
      setErroDataInclusao('');
      return;
    }

    const canonical = normalizeLegacyDateToCanonical(form.data_inclusao);
    if (!canonical) {
      setErroDataInclusao('Data inválida. Use o formato dd/mm/aaaa.');
      return;
    }

    handleChange('data_inclusao', canonicalDateToBR(canonical));
  };

  const handleSalvar = () => {
    const dataCanonical = normalizeLegacyDateToCanonical(form.data_inclusao);
    if (!dataCanonical) {
      setErroDataInclusao('Data inválida. Informe uma data real no formato dd/mm/aaaa.');
      return;
    }

    onSalvarCorrecao?.(linha.linhaNumero, {
      ...form,
      data_inclusao: dataCanonical,
    });
  };

  if (!linha) return null;

  const dataSelecionada = canonicalDateToUTCDate(form.data_inclusao);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes da linha {linha.linhaNumero}</DialogTitle>
        </DialogHeader>

        {isConferencia && (
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <section className="bg-slate-50 rounded-lg p-3">
              <h3 className="font-semibold mb-2">Dados da planilha</h3>
              <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(linha.dados_planilha || {}, null, 2)}</pre>
            </section>
            <section className="bg-indigo-50 rounded-lg p-3">
              <h3 className="font-semibold mb-2">Militar encontrado</h3>
              <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(linha.militar_encontrado || {}, null, 2)}</pre>
            </section>
            <section className="bg-amber-50 rounded-lg p-3">
              <h3 className="font-semibold mb-2">Campo de match</h3>
              <p>{linha.campo_match || '—'}</p>
            </section>
            <section className="bg-rose-50 rounded-lg p-3">
              <h3 className="font-semibold mb-2">Divergências</h3>
              {!linha.divergencias?.length ? <p>Nenhuma divergência.</p> : <ul className="list-disc pl-5">{linha.divergencias.map((d) => <li key={d}>{d}</li>)}</ul>}
            </section>
            <section className="bg-slate-100 rounded-lg p-3 md:col-span-2">
              <h3 className="font-semibold mb-2">Observações</h3>
              {!linha.observacoes?.length ? <p>Sem observações.</p> : <ul className="list-disc pl-5">{linha.observacoes.map((o) => <li key={o}>{o}</li>)}</ul>}
            </section>
          </div>
        )}

        {!isConferencia && (
        <section className="border border-slate-200 rounded-lg p-4 bg-white space-y-3">
          <h3 className="font-semibold text-sm">Correção pré-importação</h3>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Nome Completo</Label>
              <Input value={form.nome_completo} onChange={(event) => handleChange('nome_completo', event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Nome de Guerra</Label>
              <Input value={form.nome_guerra} onChange={(event) => handleChange('nome_guerra', event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Matrícula</Label>
              <Input value={form.matricula} onChange={(event) => handleChange('matricula', event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>CPF</Label>
              <Input value={form.cpf} onChange={(event) => handleChange('cpf', event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Data de Inclusão</Label>
              <div className="flex gap-2">
                <Input
                  value={form.data_inclusao}
                  onChange={(event) => handleDataInclusaoChange(event.target.value)}
                  onBlur={handleDataInclusaoBlur}
                  placeholder="dd/mm/aaaa"
                  className={cn(erroDataInclusao && 'border-red-500 focus-visible:ring-red-200')}
                />
                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="px-3" aria-label="Abrir calendário de data de inclusão">
                      <CalendarIcon className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      selected={dataSelecionada}
                      onSelect={(date) => {
                        if (!date) return;
                        const canonical = normalizeLegacyDateToCanonical(date);
                        handleChange('data_inclusao', canonicalDateToBR(canonical));
                        setErroDataInclusao('');
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              {erroDataInclusao && <p className="text-xs text-red-600">{erroDataInclusao}</p>}
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSalvar} disabled={saving}>{saving ? 'Salvando...' : 'Salvar correção'}</Button>
          </div>
        </section>
        )}

        {!isConferencia && (
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <section className="bg-slate-50 rounded-lg p-3">
            <h3 className="font-semibold mb-2">Dados originais</h3>
            <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(linha.original, null, 2)}</pre>
          </section>
          <section className="bg-slate-50 rounded-lg p-3">
            <h3 className="font-semibold mb-2">Dados transformados</h3>
            <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(linha.transformado, null, 2)}</pre>
          </section>
          <section className="bg-amber-50 rounded-lg p-3">
            <h3 className="font-semibold mb-2">Alertas</h3>
            {linha.alertas.length === 0 ? <p>Nenhum alerta.</p> : <ul className="list-disc pl-5">{linha.alertas.map((a) => <li key={a}>{a}</li>)}</ul>}
          </section>
          <section className="bg-rose-50 rounded-lg p-3">
            <h3 className="font-semibold mb-2">Erros</h3>
            {linha.erros.length === 0 ? <p>Nenhum erro.</p> : <ul className="list-disc pl-5">{linha.erros.map((e) => <li key={e}>{e}</li>)}</ul>}
          </section>
        </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
