import React, { useMemo, useState } from 'react';
import { Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import ArquivoBoletinsCard from '@/components/conciliacao-boletim/ArquivoBoletinsCard';

function normalizar(valor) {
  return String(valor || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim();
}

export default function ArquivoBoletinsSheet({ boletins = [], carregando, ...handlers }) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');

  const filtrados = useMemo(() => {
    const termo = normalizar(busca);
    if (!termo) return boletins;
    return boletins.filter(boletim => normalizar(
      `${boletim.tipo} ${boletim.numero} ${boletim.status} ${boletim.data_boletim} ${boletim.arquivo_nome}`
    ).includes(termo));
  }, [boletins, busca]);

  return (
    <Sheet open={aberto} onOpenChange={setAberto}>
      <SheetTrigger asChild>
        <Button variant="outline" className="border-slate-300 bg-white">
          <Archive className="w-4 h-4 mr-2" />
          Boletins importados
          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{boletins.length}</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader className="mb-3 pr-8">
          <SheetTitle className="text-[#1e3a5f]">Arquivo de boletins conciliados</SheetTitle>
          <p className="text-sm text-slate-500">
            Abra um boletim para continuar de onde parou: a análise de IA salva é carregada sem nova chamada.
          </p>
          <Input
            className="mt-2"
            placeholder="Buscar por número, data, situação ou arquivo"
            value={busca}
            onChange={event => setBusca(event.target.value)}
          />
        </SheetHeader>
        <ArquivoBoletinsCard
          boletins={filtrados}
          carregando={carregando}
          {...handlers}
          onReabrir={(boletim) => {
            setAberto(false);
            handlers.onReabrir?.(boletim);
          }}
        />
      </SheetContent>
    </Sheet>
  );
}