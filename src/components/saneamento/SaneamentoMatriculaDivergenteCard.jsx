import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import { Eye, Loader2, ShieldCheck } from 'lucide-react';
import SaneamentoMatriculaDivergenteTabela from './SaneamentoMatriculaDivergenteTabela';

export default function SaneamentoMatriculaDivergenteCard() {
  const { toast } = useToast();
  const [previa, setPrevia] = useState(null);
  const [escolhas, setEscolhas] = useState({});
  const [carregando, setCarregando] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const chamar = async (payload) => {
    const response = await base44.functions.invoke('saneamentoMatriculaDivergente', payload);
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
      setEscolhas({});
    } catch (error) {
      toast({ title: 'Falha ao gerar a prévia', description: erroLegivel(error), variant: 'destructive' });
    } finally {
      setCarregando(false);
    }
  };

  const aplicar = async () => {
    const correcoes = Object.entries(escolhas).map(([militar_id, matricula_oficial]) => ({ militar_id, matricula_oficial }));
    if (!correcoes.length) return;
    const confirmado = window.confirm(
      `Confirmar o alinhamento de ${correcoes.length} matrícula(s)? Esta ação altera dados de produção.`
    );
    if (!confirmado) return;

    setAplicando(true);
    try {
      const data = await chamar({ acao: 'EXECUTAR', correcoes });
      setResultado(data);
      setPrevia(null);
      setEscolhas({});
      toast({ title: 'Saneamento concluído', description: data.message });
    } catch (error) {
      toast({ title: 'Falha no saneamento', description: erroLegivel(error), variant: 'destructive' });
    } finally {
      setAplicando(false);
    }
  };

  const divergencias = previa?.divergencias || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShieldCheck className="w-5 h-5 text-blue-700" />
          Matrícula divergente (cadastro x histórico)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-600">
          Compara a matrícula do cadastro do militar com a matrícula atual do histórico. Quando divergem, o
          portal recusa o acesso mesmo com o número correto. Escolha a versão oficial de cada caso para alinhar
          os dois registros.
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
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Militares varridos</p>
                <p className="text-2xl font-bold text-slate-900">{previa.total_militares ?? 0}</p>
              </div>
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
                <p className="text-xs uppercase tracking-wide text-amber-700">Divergências</p>
                <p className="text-2xl font-bold text-amber-900">{previa.total_divergencias ?? 0}</p>
              </div>
            </div>

            <SaneamentoMatriculaDivergenteTabela
              divergencias={divergencias}
              escolhas={escolhas}
              onEscolher={(militarId, valor) => setEscolhas((prev) => ({ ...prev, [militarId]: valor }))}
            />

            {divergencias.length > 0 && (
              <div className="flex justify-end">
                <Button type="button" onClick={aplicar} disabled={aplicando || !Object.keys(escolhas).length}>
                  {aplicando ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Aplicando...</>
                  ) : (
                    `Aplicar saneamento (${Object.keys(escolhas).length})`
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
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}