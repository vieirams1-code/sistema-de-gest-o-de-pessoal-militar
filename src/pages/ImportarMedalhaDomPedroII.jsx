import React, { useState, useMemo } from 'react';
import { Database, FileUp, ShieldAlert, CheckCircle2, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import { useToast } from '@/components/ui/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import {
  analisarPlanilhaDomPedro,
  importarMedalhasDomPedro,
  STATUS_LINHA_MEDALHA,
} from '@/services/importacaoMedalhaDomPedroService';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

const statusConfig = {
  [STATUS_LINHA_MEDALHA.PRONTO]: { color: 'bg-emerald-100 text-emerald-700', label: 'Pronto' },
  [STATUS_LINHA_MEDALHA.MILITAR_NAO_ENCONTRADO]: { color: 'bg-amber-100 text-amber-700', label: 'Militar não encontrado' },
  [STATUS_LINHA_MEDALHA.DOEMS_INVALIDO]: { color: 'bg-rose-100 text-rose-700', label: 'DOEMS inválido' },
  [STATUS_LINHA_MEDALHA.DATA_INVALIDA]: { color: 'bg-rose-100 text-rose-700', label: 'Data inválida' },
  [STATUS_LINHA_MEDALHA.JA_IMPORTADO]: { color: 'bg-blue-100 text-blue-700', label: 'Já importado' },
  [STATUS_LINHA_MEDALHA.DUPLICADO_PLANILHA]: { color: 'bg-slate-100 text-slate-700', label: 'Duplicado na planilha' },
  [STATUS_LINHA_MEDALHA.ERRO]: { color: 'bg-rose-100 text-rose-700', label: 'Erro' },
};

export default function ImportarMedalhaDomPedroII() {
  const { isLoading, isAccessResolved, canAccessModule, canAccessAction, userEmail } = useCurrentUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [arquivo, setArquivo] = useState(null);
  const [analise, setAnalise] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [resultadoImportacao, setResultadoImportacao] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) setArquivo(file);
  };

  const handleAnalisar = async () => {
    if (!arquivo) return;
    setCarregando(true);
    try {
      const resultado = await analisarPlanilhaDomPedro(arquivo);
      setAnalise(resultado);
      toast({ title: 'Análise concluída', description: `${resultado.length} linhas processadas.` });
    } catch (error) {
      toast({
        title: 'Falha na análise',
        description: error?.message || 'Não foi possível analisar o arquivo.',
        variant: 'destructive',
      });
    } finally {
      setCarregando(false);
    }
  };

  const handleImportar = async () => {
    if (!analise) return;
    setCarregando(true);
    try {
      const resultado = await importarMedalhasDomPedro(analise, userEmail);
      setResultadoImportacao(resultado);
      toast({
        title: 'Importação concluída',
        description: `${resultado.importados} medalhas importadas com sucesso.`,
      });
      // Invalida caches relacionados
      queryClient.invalidateQueries({ queryKey: ['medalhas'] });
      queryClient.invalidateQueries({ queryKey: ['publicacoes-exofficio'] });
      queryClient.invalidateQueries({ queryKey: ['registros-militar'] });
    } catch (error) {
      toast({
        title: 'Erro na importação',
        description: error?.message || 'Falha ao importar registros.',
        variant: 'destructive',
      });
    } finally {
      setCarregando(false);
    }
  };

  const reiniciar = () => {
    setArquivo(null);
    setAnalise(null);
    setResultadoImportacao(null);
  };

  const resumoAnalise = useMemo(() => {
    if (!analise) return null;
    return analise.reduce((acc, l) => {
      acc.total++;
      if (l.status === STATUS_LINHA_MEDALHA.PRONTO) acc.validos++;
      else if (l.status === STATUS_LINHA_MEDALHA.MILITAR_NAO_ENCONTRADO) acc.naoEncontrados++;
      else if (l.status === STATUS_LINHA_MEDALHA.JA_IMPORTADO) acc.duplicados++;
      else acc.erros++;
      return acc;
    }, { total: 0, validos: 0, naoEncontrados: 0, duplicados: 0, erros: 0 });
  }, [analise]);

  if (isLoading || !isAccessResolved) return null;
  if (!canAccessModule('migracao_alteracoes_legado')) return <AccessDenied modulo="Importar Medalha Dom Pedro II" />;

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6">
      <div className="max-w-[96rem] mx-auto space-y-6">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#1e3a5f]">Importar Medalha Dom Pedro II</h1>
            <p className="text-sm text-slate-500">Módulo administrativo para migração fixa de concessões da Medalha Dom Pedro II via DOEMS.</p>
          </div>
        </div>

        {!analise && !resultadoImportacao && (
          <div className="space-y-6">
            <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-4 text-sm">
              <p className="font-semibold mb-2 flex items-center gap-2"><ShieldAlert className="w-4 h-4" /> Regras da Migração</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>A medalha é fixa: <strong>Medalha Dom Pedro II</strong>.</li>
                <li>Todos os registros são tratados como <strong>DOEMS</strong> (origem externa).</li>
                <li>Normalização automática de DOEMS (ex: "BG 124" ou "DOEMS 124" torna-se "124").</li>
                <li>Localização do militar pelo nome completo (normalizado).</li>
                <li>Registra a medalha na ficha e cria o texto da alteração automaticamente.</li>
              </ul>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                <FileUp className="w-8 h-8 text-slate-400" />
              </div>
              <div className="max-w-xs mx-auto">
                <p className="text-sm font-medium text-slate-700">Upload da Planilha</p>
                <p className="text-xs text-slate-500 mt-1">Selecione o arquivo .xlsx contendo as colunas: MILITARES DO CBMMS, DOEMS, DATA.</p>
              </div>
              <div className="flex items-center justify-center gap-2">
                <Input type="file" accept=".xlsx" onChange={handleFileChange} className="max-w-xs" />
                <Button onClick={handleAnalisar} disabled={!arquivo || carregando}>
                  {carregando ? <RefreshCcw className="w-4 h-4 mr-2 animate-spin" /> : 'Analisar Planilha'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {analise && !resultadoImportacao && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-white border border-slate-200 rounded-xl p-3 text-center">
                <p className="text-xs text-slate-500">Total lido</p>
                <p className="text-lg font-bold text-slate-700">{resumoAnalise.total}</p>
              </div>
              <div className="bg-white border border-emerald-200 rounded-xl p-3 text-center">
                <p className="text-xs text-slate-500">Válidos</p>
                <p className="text-lg font-bold text-emerald-700">{resumoAnalise.validos}</p>
              </div>
              <div className="bg-white border border-amber-200 rounded-xl p-3 text-center">
                <p className="text-xs text-slate-500">Não encontrados</p>
                <p className="text-lg font-bold text-amber-700">{resumoAnalise.naoEncontrados}</p>
              </div>
              <div className="bg-white border border-blue-200 rounded-xl p-3 text-center">
                <p className="text-xs text-slate-500">Já importados</p>
                <p className="text-lg font-bold text-blue-700">{resumoAnalise.duplicados}</p>
              </div>
              <div className="bg-white border border-rose-200 rounded-xl p-3 text-center">
                <p className="text-xs text-slate-500">Erros/Inválidos</p>
                <p className="text-lg font-bold text-rose-700">{resumoAnalise.erros}</p>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center">#</TableHead>
                    <TableHead>Militar</TableHead>
                    <TableHead>DOEMS</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analise.map((linha, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-center text-slate-400 text-xs">{linha.rowIndex}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">{linha.militar_nome}</span>
                          <span className="text-xs text-slate-500">{linha.militar_posto} {linha.militar_matricula && `• ${linha.militar_matricula}`}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm">{linha.doems_numero}</span>
                          {linha.doems_bruto !== linha.doems_numero && (
                            <span className="text-[10px] text-slate-400">Original: {linha.doems_bruto}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{linha.data_concessao ? new Date(linha.data_concessao + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={statusConfig[linha.status]?.color || ''}>
                          {statusConfig[linha.status]?.label || linha.status}
                        </Badge>
                        {linha.erros.length > 0 && (
                          <div className="text-[10px] text-rose-600 mt-1">
                            {linha.erros.join(', ')}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleImportar}
                disabled={carregando || resumoAnalise.validos === 0}
                className="bg-emerald-700 hover:bg-emerald-800"
              >
                {carregando ? <RefreshCcw className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Importar {resumoAnalise.validos} válidos
              </Button>
              <Button variant="outline" onClick={reiniciar} disabled={carregando}>
                Nova Análise
              </Button>
            </div>
          </div>
        )}

        {resultadoImportacao && (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-6">
            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Importação Finalizada</h2>
              <p className="text-slate-500 mt-1">O processo de migração foi concluído.</p>
            </div>

            <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                <p className="text-xs text-emerald-600 font-medium">Importados</p>
                <p className="text-2xl font-bold text-emerald-700">{resultadoImportacao.importados}</p>
              </div>
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-100">
                <p className="text-xs text-rose-600 font-medium">Falhas</p>
                <p className="text-2xl font-bold text-rose-700">{resultadoImportacao.erros}</p>
              </div>
            </div>

            <Button onClick={reiniciar}>
              Voltar ao Início
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
