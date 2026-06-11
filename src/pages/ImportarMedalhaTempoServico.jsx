import React, { useState, useMemo } from 'react';
import { Database, FileUp, ShieldAlert, CheckCircle2, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import { useToast } from '@/components/ui/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import {
  analisarPlanilhaMedalha,
  importarMedalhas,
  STATUS_LINHA_MEDALHA,
  CONFIG_MEDALHAS,
} from '@/services/importacaoMedalhaService';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const statusConfig = {
  [STATUS_LINHA_MEDALHA.PRONTO]: { color: 'bg-emerald-100 text-emerald-700', label: 'Pronto' },
  [STATUS_LINHA_MEDALHA.MILITAR_NAO_ENCONTRADO]: { color: 'bg-amber-100 text-amber-700', label: 'Militar não encontrado' },
  [STATUS_LINHA_MEDALHA.DOEMS_INVALIDO]: { color: 'bg-rose-100 text-rose-700', label: 'DOEMS inválido' },
  [STATUS_LINHA_MEDALHA.DATA_INVALIDA]: { color: 'bg-rose-100 text-rose-700', label: 'Data inválida' },
  [STATUS_LINHA_MEDALHA.JA_IMPORTADO]: { color: 'bg-blue-100 text-blue-700', label: 'Já importado' },
  [STATUS_LINHA_MEDALHA.DUPLICADO_PLANILHA]: { color: 'bg-slate-100 text-slate-700', label: 'Duplicado na planilha' },
  [STATUS_LINHA_MEDALHA.ERRO]: { color: 'bg-rose-100 text-rose-700', label: 'Erro' },
};

const OPCOES_MEDALHA = [
  { value: 'TEMPO_10', label: 'Medalha de 10 anos' },
  { value: 'TEMPO_20', label: 'Medalha de 20 anos' },
  { value: 'TEMPO_30', label: 'Medalha de 30 anos' },
  { value: 'TEMPO_40', label: 'Medalha de 40 anos' },
];

export default function ImportarMedalhaTempoServico() {
  const { isLoading, isAccessResolved, canAccessModule, userEmail } = useCurrentUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [medalhaSelecionada, setMedalhaSelecionada] = useState('');
  const [arquivo, setArquivo] = useState(null);
  const [analise, setAnalise] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [resultadoImportacao, setResultadoImportacao] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) setArquivo(file);
  };

  const handleAnalisar = async () => {
    if (!arquivo || !medalhaSelecionada) return;
    setCarregando(true);
    try {
      const resultado = await analisarPlanilhaMedalha(arquivo, medalhaSelecionada);
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
      const resultado = await importarMedalhas(analise, userEmail);
      setResultadoImportacao(resultado);
      toast({
        title: 'Importação concluída',
        description: `${resultado.importados} medalhas importadas com sucesso.`,
      });
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
      else if (l.status === STATUS_LINHA_MEDALHA.JA_IMPORTADO) acc.jaImportados++;
      else acc.erros++;
      return acc;
    }, { total: 0, validos: 0, naoEncontrados: 0, jaImportados: 0, erros: 0 });
  }, [analise]);

  const nomeMedalhaSelecionada = useMemo(() => {
    return CONFIG_MEDALHAS[medalhaSelecionada]?.nome || '';
  }, [medalhaSelecionada]);

  if (isLoading || !isAccessResolved) return null;
  if (!canAccessModule('migracao_alteracoes_legado')) return <AccessDenied modulo="Importar Medalhas Tempo de Serviço" />;

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6">
      <div className="max-w-[96rem] mx-auto space-y-6">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#1e3a5f]">Importar Medalhas por Tempo de Serviço</h1>
            <p className="text-sm text-slate-500">Módulo administrativo para migração de concessões de medalhas de 10, 20, 30 e 40 anos via DOEMS.</p>
          </div>
        </div>

        {!analise && !resultadoImportacao && (
          <div className="space-y-6">
            <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-4 text-sm">
              <p className="font-semibold mb-2 flex items-center gap-2"><ShieldAlert className="w-4 h-4" /> Regras da Migração</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>O tipo selecionado vale para todos os registros da planilha.</li>
                <li>Todos os registros são tratados como <strong>DOEMS</strong> (origem externa).</li>
                <li>Impedimento de duplicidade: não permite a mesma medalha para o mesmo militar, mesmo com DOEMS diferente.</li>
                <li>Ordenação automática por <strong>antiguidade institucional</strong>.</li>
                <li>Registra a medalha na ficha e cria o texto da alteração automaticamente.</li>
              </ul>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-8 space-y-6">
              <div className="max-w-md mx-auto space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">1. Selecione o Tipo de Medalha</label>
                  <Select value={medalhaSelecionada} onValueChange={setMedalhaSelecionada}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a medalha..." />
                    </SelectTrigger>
                    <SelectContent>
                      {OPCOES_MEDALHA.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">2. Upload da Planilha (.xlsx)</label>
                  <div className="flex items-center gap-2">
                    <Input type="file" accept=".xlsx" onChange={handleFileChange} />
                  </div>
                  <p className="text-[10px] text-slate-500">Colunas obrigatórias: MILITARES DO CBMMS, DOEMS, DATA.</p>
                </div>

                <Button
                  className="w-full"
                  onClick={handleAnalisar}
                  disabled={!arquivo || !medalhaSelecionada || carregando}
                >
                  {carregando ? <RefreshCcw className="w-4 h-4 mr-2 animate-spin" /> : <FileUp className="w-4 h-4 mr-2" />}
                  Analisar Planilha
                </Button>
              </div>
            </div>
          </div>
        )}

        {analise && !resultadoImportacao && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="text-indigo-700 border-indigo-200 bg-indigo-50 px-3 py-1 text-sm">
                Medalha: {nomeMedalhaSelecionada}
              </Badge>
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
                  Trocar Planilha/Tipo
                </Button>
              </div>
            </div>

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
                <p className="text-lg font-bold text-blue-700">{resumoAnalise.jaImportados}</p>
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
                    <TableHead>Militar (Ordenado por Antiguidade)</TableHead>
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
          </div>
        )}

        {resultadoImportacao && (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-6">
            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Importação Finalizada</h2>
              <p className="text-slate-500 mt-1">O processo de migração de {nomeMedalhaSelecionada} foi concluído.</p>
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
