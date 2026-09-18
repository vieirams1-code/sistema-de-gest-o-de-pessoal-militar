import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import { AlertTriangle, CalendarX, Eye, Loader2, RotateCcw } from 'lucide-react';
import AlvosInativacaoPeriodoTabela from '@/components/ferias/AlvosInativacaoPeriodoTabela';

const PERIODOS = [
  { valor: '2024/2025', label: '2024/2025' },
  { valor: '2023/2024', label: '2023/2024' },
];

export default function InativacaoPeriodoLote() {
  const { toast } = useToast();
  const [periodoRef, setPeriodoRef] = useState(PERIODOS[0].valor);
  const [previa, setPrevia] = useState(null);
  const [carregandoPrevia, setCarregandoPrevia] = useState(false);
  const [executando, setExecutando] = useState(false);
  const [revertendo, setRevertendo] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [resultadoReversao, setResultadoReversao] = useState(null);

  const chamar = async (payload) => {
    const response = await base44.functions.invoke('inativarPeriodoAquisitivoLote', payload);
    return response?.data || {};
  };

  const erroLegivel = (error) =>
    error?.response?.data?.error || error?.data?.error || error?.message || 'Tente novamente.';

  const carregarPrevia = async () => {
    setCarregandoPrevia(true);
    setResultado(null);
    try {
      setPrevia(await chamar({ acao: 'PREVIA', periodo_ref: periodoRef }));
    } catch (error) {
      toast({ title: 'Falha ao gerar a prévia', description: erroLegivel(error), variant: 'destructive' });
    } finally {
      setCarregandoPrevia(false);
    }
  };

  const confirmarInativacao = async () => {
    if (!previa?.alvos?.length) return;
    const confirmado = window.confirm(
      `Confirmar a inativação do período ${periodoRef} de ${previa.alvos.length} militar(es)? Esta ação altera dados de produção.`
    );
    if (!confirmado) return;
    setExecutando(true);
    try {
      const data = await chamar({ acao: 'EXECUTAR', periodo_ref: periodoRef });
      setResultado(data);
      setPrevia(null);
      toast({ title: 'Inativação concluída', description: data.message });
    } catch (error) {
      toast({ title: 'Falha na inativação', description: erroLegivel(error), variant: 'destructive' });
    } finally {
      setExecutando(false);
    }
  };

  const reverter = async () => {
    const confirmado = window.confirm(
      'Reativar todos os períodos inativados por esta operação?'
    );
    if (!confirmado) return;
    setRevertendo(true);
    try {
      const data = await chamar({ acao: 'REVERTER' });
      setResultadoReversao(data);
      toast({ title: 'Reversão concluída', description: data.message });
    } catch (error) {
      toast({ title: 'Falha na reversão', description: erroLegivel(error), variant: 'destructive' });
    } finally {
      setRevertendo(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-amber-100 p-3">
          <CalendarX className="w-7 h-7 text-amber-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inativação de Período Aquisitivo em Lote</h1>
          <p className="text-sm text-slate-500">
            Inativa um período aquisitivo dos militares ativos de Nova Alvorada do Sul e Sidrolândia.
          </p>
        </div>
      </div>

      <Alert className="border-amber-300 bg-amber-50">
        <AlertTriangle className="h-4 w-4 text-amber-700" />
        <AlertTitle className="text-amber-900">Ação sobre dados de produção</AlertTitle>
        <AlertDescription className="text-amber-800">
          A inativação remove o período do controle e libera o militar para preencher o plano de férias.
          Sempre gere a prévia e confira a lista antes de confirmar. A operação pode ser revertida pelo botão
          de reversão abaixo.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">1. Prévia dos afetados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">
            Militares com cadastro <strong>Ativo</strong> lotados em <strong>Nova Alvorada do Sul</strong> ou{' '}
            <strong>Sidrolândia</strong> que possuem o período selecionado ainda em aberto.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-slate-600">Período:</span>
            {PERIODOS.map((periodo) => (
              <Button
                key={periodo.valor}
                type="button"
                size="sm"
                variant={periodoRef === periodo.valor ? 'default' : 'outline'}
                onClick={() => {
                  setPeriodoRef(periodo.valor);
                  setPrevia(null);
                  setResultado(null);
                }}
                disabled={carregandoPrevia || executando}
              >
                {periodo.label}
              </Button>
            ))}
          </div>

          <Button type="button" variant="outline" onClick={carregarPrevia} disabled={carregandoPrevia || executando}>
            {carregandoPrevia ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Calculando...</>
            ) : (
              <><Eye className="w-4 h-4 mr-2" /> Gerar prévia</>
            )}
          </Button>

          {previa && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Militares no escopo</p>
                  <p className="text-2xl font-bold text-slate-900">{previa.total_militares_escopo ?? 0}</p>
                </div>
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-amber-700">Períodos a inativar</p>
                  <p className="text-2xl font-bold text-amber-900">{previa.total_alvos ?? 0}</p>
                </div>
              </div>

              <AlvosInativacaoPeriodoTabela alvos={previa.alvos || []} />

              {previa.alvos?.length > 0 && (
                <div className="flex justify-end">
                  <Button type="button" onClick={confirmarInativacao} disabled={executando} className="bg-amber-700 hover:bg-amber-800">
                    {executando ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Inativando...</>
                    ) : (
                      `Confirmar inativação (${previa.alvos.length})`
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}

          {resultado && (
            <Alert className="border-emerald-300 bg-emerald-50">
              <AlertTitle className="text-emerald-900">Inativação processada</AlertTitle>
              <AlertDescription className="text-emerald-800">
                <p>{resultado.message}</p>
                <p>Ignorados por falha: {resultado.total_ignorados ?? 0}.</p>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">2. Reverter operação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">
            Reativa os períodos inativados por esta operação, conforme o registro de auditoria. Inativações
            feitas por outros motivos não são afetadas.
          </p>
          <Button type="button" variant="outline" onClick={reverter} disabled={revertendo || executando} className="border-rose-300 text-rose-700 hover:bg-rose-50">
            {revertendo ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Revertendo...</>
            ) : (
              <><RotateCcw className="w-4 h-4 mr-2" /> Reverter inativações desta operação</>
            )}
          </Button>

          {resultadoReversao && (
            <Alert className="border-slate-300">
              <AlertTitle className="text-slate-900">Reversão processada</AlertTitle>
              <AlertDescription className="text-slate-700">
                <p>{resultadoReversao.message}</p>
                <p>Não encontrados: {resultadoReversao.total_nao_encontrados ?? 0}.</p>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}