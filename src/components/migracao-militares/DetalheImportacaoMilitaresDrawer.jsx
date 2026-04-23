import React, { useMemo, useState } from 'react';
import { Download, FileUp, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import TabelaLinhasImportacaoMilitares from './TabelaLinhasImportacaoMilitares';
import { exportarCsvHistoricoHumano, STATUS_BADGE_CLASS, STATUS_LOTE_BADGE_CLASS } from '@/services/historicoImportacoesMilitaresService';

function Bloco({ titulo, itens, vazio = 'Sem informações.' }) {
  const lista = Array.isArray(itens) ? itens : [];
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <h4 className="text-sm font-semibold text-slate-700 mb-2">{titulo}</h4>
      {lista.length === 0 ? (
        <p className="text-sm text-slate-500">{vazio}</p>
      ) : (
        <ul className="text-sm text-slate-700 list-disc pl-5 space-y-1">
          {lista.map((item, idx) => <li key={`${titulo}-${idx}`}>{item}</li>)}
        </ul>
      )}
    </div>
  );
}

function ObjetoAmigavel({ titulo, dados }) {
  const entries = Object.entries(dados || {}).filter(([, valor]) => String(valor ?? '').trim() !== '');
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <h4 className="text-sm font-semibold text-slate-700 mb-2">{titulo}</h4>
      {entries.length === 0 ? (
        <p className="text-sm text-slate-500">Sem dados disponíveis.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {entries.map(([chave, valor]) => (
            <div key={chave} className="rounded bg-slate-50 border border-slate-200 px-2 py-1.5">
              <p className="text-[11px] text-slate-500">{chave.replaceAll('_', ' ')}</p>
              <p className="text-sm text-slate-700 break-words">{String(valor)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DetalheImportacaoMilitaresDrawer({ open, onOpenChange, lote }) {
  const [linhaSelecionada, setLinhaSelecionada] = useState(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const linhasAgrupadas = useMemo(() => {
    const linhas = lote?.linhas || [];
    return {
      APTO: linhas.filter((x) => x.status === 'APTO'),
      APTO_COM_ALERTA: linhas.filter((x) => x.status === 'APTO_COM_ALERTA'),
      REVISAR: linhas.filter((x) => x.status === 'REVISAR'),
      IGNORADO: linhas.filter((x) => x.status === 'IGNORADO' || x.status === 'DUPLICADO'),
      ERRO: linhas.filter((x) => x.status === 'ERRO'),
    };
  }, [lote]);

  const usarComoReferencia = () => {
    if (!lote) return;
    sessionStorage.setItem('referencia_lote_migracao_militares', JSON.stringify({
      id: lote.id,
      nomeArquivo: lote.nomeArquivo,
      dataHora: lote.dataHora,
    }));

    navigate(createPageUrl('MigracaoMilitares'));
    toast({
      title: 'Lote enviado como referência',
      description: 'A página de Migração de Militares foi aberta. Use este lote como base para nova conferência.',
    });
  };

  return (
    <Sheet open={open} onOpenChange={(next) => {
      onOpenChange(next);
      if (!next) setLinhaSelecionada(null);
    }}>
      <SheetContent side="right" className="sm:max-w-[92vw] w-full overflow-y-auto bg-slate-50">
        {!lote ? null : (
          <div className="space-y-4">
            <SheetHeader>
              <SheetTitle className="text-[#1e3a5f]">Detalhe do lote: {lote.nomeArquivo}</SheetTitle>
              <SheetDescription>
                <span className="inline-flex items-center gap-2">
                  Status geral:
                  <Badge className={STATUS_LOTE_BADGE_CLASS[lote.statusGeral] || 'bg-slate-100 text-slate-700'}>{lote.statusGeral}</Badge>
                </span>
              </SheetDescription>
            </SheetHeader>

            <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
              <p><span className="font-semibold">Tipo:</span> {lote.tipoImportacao || 'Não informado'}</p>
              <p><span className="font-semibold">Executor:</span> {lote.importadoPor || 'Não informado'}</p>
              <p><span className="font-semibold">Referência:</span> {lote.referenciaLote || 'Não informada'}</p>
              <p><span className="font-semibold">Observações:</span> {lote.observacoes || 'Sem observações.'}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => exportarCsvHistoricoHumano(lote)}>
                <Download className="w-4 h-4 mr-2" /> Exportar CSV legível
              </Button>
              <Button variant="outline" onClick={usarComoReferencia}>
                <FileUp className="w-4 h-4 mr-2" /> Usar este lote como referência
              </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
              {[
                { label: 'APTO', value: lote.resumo.total_aptas, status: 'APTO' },
                { label: 'APTO_COM_ALERTA', value: lote.resumo.total_aptas_com_alerta, status: 'APTO_COM_ALERTA' },
                { label: 'REVISAR', value: lote.resumo.total_revisar, status: 'REVISAR' },
                { label: 'IGNORADO', value: lote.resumo.total_ignoradas, status: 'IGNORADO' },
                { label: 'ERRO', value: lote.resumo.total_erros, status: 'ERRO' },
                { label: 'IMPORTADAS', value: lote.resumo.total_importadas, status: 'APTO' },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-[11px] text-slate-500">{item.label}</p>
                  <p className="text-xl font-bold text-slate-800">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              {Object.entries(linhasAgrupadas).map(([status, linhas]) => (
                <div key={status} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge className={STATUS_BADGE_CLASS[status] || 'bg-slate-100 text-slate-700'}>{status}</Badge>
                    <span className="text-sm text-slate-600">{linhas.length} linha(s)</span>
                  </div>
                  <TabelaLinhasImportacaoMilitares linhas={linhas} onSelecionarLinha={setLinhaSelecionada} />
                </div>
              ))}
            </div>

            {linhaSelecionada ? (
              <div className="rounded-xl border border-slate-300 bg-white p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <ChevronRight className="w-4 h-4" />
                  Linha {linhaSelecionada.linhaNumero} • {linhaSelecionada.nome || 'Sem nome'}
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                  <ObjetoAmigavel titulo="Dados originais" dados={linhaSelecionada.dadosOriginais} />
                  <ObjetoAmigavel titulo="Dados transformados" dados={linhaSelecionada.dadosTransformados} />
                  <Bloco titulo="Alertas" itens={linhaSelecionada.alertas} vazio="Sem alertas." />
                  <Bloco titulo="Erros" itens={linhaSelecionada.erros} vazio="Sem erros." />
                  <Bloco titulo="Observações da importação" itens={linhaSelecionada.observacoes} vazio="Sem observações." />
                </div>
              </div>
            ) : null}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
