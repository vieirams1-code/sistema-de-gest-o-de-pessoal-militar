import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { bulkEscopado } from '@/services/cudEscopadoClient';
import { useQueryClient } from '@tanstack/react-query';
import { ShieldAlert, Loader2, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { detectarPeriodosRecriadosIndevidamente } from './saneamentoPeriodosRecriados';
import { abreviarPostoGraduacao } from '@/components/folha-alteracoes/postoGraduacao';

function formatarMilitar(militar) {
  const posto = abreviarPostoGraduacao(militar?.posto_graduacao);
  const nome = militar?.nome_guerra || 'Militar';
  const matricula = militar?.matricula || '';
  return [posto, nome].filter(Boolean).join(' ') + (matricula ? ` — Mat. ${matricula}` : '');
}

export default function SaneamentoPeriodosRecriadosPanel({
  gruposMilitares = [],
  registrosLivro = [],
  publicacoesExOfficio = [],
  paBundleQueryKey = [],
}) {
  const [selecionados, setSelecionados] = useState(new Set());
  const [processando, setProcessando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const queryClient = useQueryClient();

  const suspeitos = useMemo(
    () => detectarPeriodosRecriadosIndevidamente({ gruposMilitares, registrosLivro, publicacoesExOfficio }),
    [gruposMilitares, registrosLivro, publicacoesExOfficio]
  );

  const suspeitosVisiveis = useMemo(() => {
    if (mostrarInativos) return suspeitos;
    return suspeitos.filter((item) => !item.periodo?.inativo);
  }, [suspeitos, mostrarInativos]);

  const toggleSelecionado = (id) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selecionarTudo = () => {
    const todos = new Set(suspeitosVisiveis.map((item) => item.periodo?.id).filter(Boolean));
    setSelecionados(todos);
  };

  const limparSelecao = () => setSelecionados(new Set());

  const handleInativar = async () => {
    if (selecionados.size === 0) return;
    setProcessando(true);
    setResultado(null);

    try {
      const itens = suspeitos
        .filter((item) => selecionados.has(item.periodo?.id))
        .map((item) => ({
          acao: 'update',
          id: item.periodo.id,
          inativo: true,
          status: 'Inativo',
          observacoes: 'Inativado por saneamento: período recriado indevidamente pelo gerador automático.',
        }));

      const resp = await bulkEscopado('PeriodoAquisitivo', itens);
      const sucesso = resp?.sucesso ?? 0;
      const total = resp?.total ?? itens.length;

      queryClient.invalidateQueries({ queryKey: paBundleQueryKey });

      setResultado({
        success: sucesso === total,
        message: `${sucesso} de ${total} período(s) inativado(s) com sucesso.`,
      });

      if (sucesso === total) {
        setSelecionados(new Set());
      }
    } catch (error) {
      setResultado({ success: false, message: error?.message || 'Falha ao inativar períodos.' });
    } finally {
      setProcessando(false);
    }
  };

  if (suspeitos.length === 0) {
    return (
      <Alert className="border-emerald-200 bg-emerald-50">
        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
        <AlertDescription className="text-emerald-700">
          Nenhum período suspeito de recriação indevida foi identificado.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      <Alert className="border-amber-300 bg-amber-50">
        <ShieldAlert className="w-4 h-4 text-amber-600" />
        <AlertDescription className="text-amber-800">
          <strong>{suspeitosVisiveis.length}</strong> período(s) suspeito(s) de recriação indevida pelo gerador automático.
          Estes períodos estão "Disponíveis" sem férias/Livro/publicações e são mais antigos que outro período com atividade do mesmo militar.
          Inative para preservar auditoria e impedir recriação futura.
        </AlertDescription>
      </Alert>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={selecionarTudo} disabled={processando || suspeitosVisiveis.length === 0}>
            Selecionar todos
          </Button>
          <Button variant="ghost" size="sm" onClick={limparSelecao} disabled={processando || selecionados.size === 0}>
            Limpar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMostrarInativos((prev) => !prev)}
            disabled={processando}
          >
            {mostrarInativos ? <EyeOff className="w-3.5 h-3.5 mr-1" /> : <Eye className="w-3.5 h-3.5 mr-1" />}
            {mostrarInativos ? 'Ocultar já inativos' : 'Mostrar já inativos'}
          </Button>
        </div>
        <Button
          onClick={handleInativar}
          disabled={processando || selecionados.size === 0}
          className="bg-amber-600 hover:bg-amber-700 text-white"
        >
          {processando ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Inativando...
            </>
          ) : (
            <>Inativar {selecionados.size > 0 ? `(${selecionados.size})` : ''}</>
          )}
        </Button>
      </div>

      {resultado && (
        <Alert className={resultado.success ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}>
          <AlertDescription className={resultado.success ? 'text-emerald-700' : 'text-red-700'}>
            {resultado.message}
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
        {suspeitosVisiveis.map((item) => {
          const periodo = item.periodo;
          const id = periodo?.id;
          const checked = selecionados.has(id);
          const inativo = Boolean(periodo?.inativo);

          return (
            <div
              key={id}
              className={`flex items-center gap-3 rounded-lg border p-3 ${inativo ? 'border-slate-200 bg-slate-50 opacity-60' : 'border-slate-200 bg-white'}`}
            >
              <Checkbox checked={checked} onCheckedChange={() => toggleSelecionado(id)} disabled={processando || inativo} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-slate-900 truncate">{formatarMilitar(item.militar)}</span>
                  <Badge variant="outline" className="text-xs">{periodo?.referencia || '-'}</Badge>
                  <Badge className="text-xs bg-emerald-100 text-emerald-700 border-emerald-200">{periodo?.status_operacional}</Badge>
                  {inativo && <Badge className="text-xs bg-slate-100 text-slate-500 border-slate-200">Inativo</Badge>}
                </div>
                <p className="text-xs text-slate-500 mt-1">{item.motivoDetalhe}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}