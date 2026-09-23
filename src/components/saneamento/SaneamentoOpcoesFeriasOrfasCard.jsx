import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import { CalendarX, Eye, Loader2 } from 'lucide-react';
import SaneamentoOpcoesFeriasOrfasTabela from './SaneamentoOpcoesFeriasOrfasTabela';

export default function SaneamentoOpcoesFeriasOrfasCard() {
  const { toast } = useToast();
  const [previa, setPrevia] = useState(null);
  const [selecionados, setSelecionados] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const chamar = async (payload) => {
    const response = await base44.functions.invoke('saneamentoOpcoesFeriasOrfas', payload);
    return response?.data || {};
  };

  const erroLegivel = (error) =>
    error?.response?.data?.error || error?.data?.error || error?.message || 'Tente novamente.';

  const carregarPrevia = async () => {
    setCarregando(true);
    setResultado(null);
    try {
      const data = await chamar({ acao: 'PREVIA' });
      setPrevia(data);
      setSelecionados((data.casos || []).filter((caso) => caso.pode_corrigir).map((caso) => caso.opcao_id));
    } catch (error) {
      toast({ title: 'Falha ao gerar a prévia', description: erroLegivel(error), variant: 'destructive' });
    } finally {
      setCarregando(false);
    }
  };

  const alternar = (opcaoId) => {
    setSelecionados((prev) => (
      prev.includes(opcaoId) ? prev.filter((id) => id !== opcaoId) : [...prev, opcaoId]
    ));
  };

  const aplicar = async () => {
    if (!selecionados.length) return;
    const confirmado = window.confirm(
      `Confirmar o reapontamento de ${selecionados.length} opção(ões) de férias? Esta ação altera dados de produção.`
    );
    if (!confirmado) return;

    setAplicando(true);
    try {
      const data = await chamar({
        acao: 'EXECUTAR',
        opcoes: selecionados.map((opcao_id) => ({ opcao_id })),
      });
      setResultado(data);
      setPrevia(null);
      setSelecionados([]);
      toast({ title: 'Saneamento concluído', description: data.message });
    } catch (error) {
      toast({ title: 'Falha no saneamento', description: erroLegivel(error), variant: 'destructive' });
    } finally {
      setAplicando(false);
    }
  };

  const casos = previa?.casos || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <CalendarX className="w-5 h-5 text-amber-700" />
          Opções de férias em período inativado
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-600">
          Localiza respostas de férias vinculadas a um período aquisitivo já inativado e sugere o período ativo
          mais antigo com saldo disponível. Os meses escolhidos pelo militar são preservados.
        </p>

        <Button type="button" variant="outline" onClick={carregarPrevia} disabled={carregando || aplicando}>
          {carregando ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Varrendo...</>
          ) : (
            <><Eye className="w-4 h-4 mr-2" /> Gerar prévia</>
          )}
        </Button>

        {previa && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Opções analisadas</p>
                <p className="text-2xl font-bold text-slate-900">{previa.total_opcoes ?? 0}</p>
              </div>
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
                <p className="text-xs uppercase tracking-wide text-amber-700">Casos encontrados</p>
                <p className="text-2xl font-bold text-amber-900">{previa.total_casos ?? 0}</p>
              </div>
              <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4">
                <p className="text-xs uppercase tracking-wide text-emerald-700">Podem ser corrigidos</p>
                <p className="text-2xl font-bold text-emerald-900">{previa.total_corrigiveis ?? 0}</p>
              </div>
            </div>

            <SaneamentoOpcoesFeriasOrfasTabela
              casos={casos}
              selecionados={selecionados}
              onToggle={alternar}
            />

            {selecionados.length > 0 && (
              <div className="flex justify-end">
                <Button type="button" onClick={aplicar} disabled={aplicando} className="bg-amber-700 hover:bg-amber-800">
                  {aplicando ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Aplicando...</>
                  ) : (
                    `Aplicar saneamento (${selecionados.length})`
                  )}
                </Button>
              </div>
            )}
          </div>
        )}

        {resultado && (
          <Alert className="border-emerald-300 bg-emerald-50">
            <AlertTitle className="text-emerald-900">Saneamento processado</AlertTitle>
            <AlertDescription className="text-emerald-800">
              <p>{resultado.message}</p>
              <p>Falhas: {resultado.total_falhas ?? 0}.</p>
              <p>Enviados para reanálise do gestor: {resultado.total_revisao ?? 0}.</p>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}