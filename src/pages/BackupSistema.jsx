import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Archive, Download, AlertTriangle, Database, FileArchive, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

export default function BackupSistema() {
  const { toast } = useToast();
  const [modo, setModo] = useState('somente_dados');
  const [gerando, setGerando] = useState(false);
  const [arquivoRestore, setArquivoRestore] = useState(null);
  const [restaurando, setRestaurando] = useState(false);
  const [relatorioRestore, setRelatorioRestore] = useState(null);

  const handleGerarBackup = async () => {
    setGerando(true);
    try {
      const incluirArquivos = modo === 'dados_e_arquivos';
      const backupPlanosFerias = modo === 'planos_ferias';
      toast({
        title: 'Gerando backup...',
        description: incluirArquivos
          ? 'Pode demorar alguns minutos. Não feche esta aba.'
          : 'Coletando todos os dados do sistema.',
      });

      const response = await base44.functions.invoke(
        backupPlanosFerias ? 'gerarBackupPlanosFerias' : 'gerarBackupSistema',
        backupPlanosFerias ? {} : { incluir_arquivos: incluirArquivos },
      );

      // A resposta vem como Blob/ArrayBuffer. O SDK retorna {data, status, headers}.
      const data = response?.data;
      if (!data) throw new Error('Resposta vazia do servidor.');

      // Converte em Blob para download
      const blob = data instanceof Blob ? data : new Blob([data], { type: 'application/zip' });
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = backupPlanosFerias
        ? `sgp-planos-ferias-backup-${stamp}.zip`
        : `sgp-backup-${stamp}${incluirArquivos ? '-completo' : '-dados'}.zip`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: 'Backup gerado com sucesso',
        description: `Arquivo ${filename} baixado.`,
      });
    } catch (error) {
      console.error('Erro ao gerar backup:', error);
      toast({
        title: 'Erro ao gerar backup',
        description: error?.message || 'Tente novamente em alguns instantes.',
        variant: 'destructive',
      });
    } finally {
      setGerando(false);
    }
  };

  const simularRestauracao = async () => {
    if (!arquivoRestore) return;
    setRestaurando(true);
    setRelatorioRestore(null);
    try {
      toast({ title: 'Validando backup...', description: 'Nenhum registro será alterado nesta etapa.' });
      const upload = await base44.integrations.Core.UploadFile({ file: arquivoRestore });
      const uploadData = upload && typeof upload === 'object' ? upload : {};
      const arquivoUrl = uploadData.file_url || uploadData.url || uploadData.signedUrl || uploadData.file?.url || uploadData.data?.file_url || uploadData.data?.url || '';
      if (!arquivoUrl) throw new Error('Não foi possível obter o endereço do arquivo enviado.');
      const response = await base44.functions.invoke('restaurarBackupPlanosFerias', { arquivo_url: arquivoUrl, modo: 'SIMULAR' });
      const simulacao = response?.data?.simulacao;
      if (!simulacao) throw new Error(response?.data?.error || `A simulação não retornou um relatório (HTTP ${response?.status || 'desconhecido'}).`);
      setRelatorioRestore({ arquivoUrl, simulacao });
      toast({ title: 'Simulação concluída', description: 'Confira os conflitos antes de confirmar.' });
    } catch (error) {
      const detalhe = error?.response?.data?.error || error?.data?.error || error?.message || 'Arquivo inválido.';
      toast({ title: 'Falha ao validar backup', description: detalhe, variant: 'destructive' });
    } finally {
      setRestaurando(false);
    }
  };

  const confirmarRestauracao = async () => {
    if (!relatorioRestore?.arquivoUrl) return;
    if (!window.confirm('Segunda confirmação: inserir somente os registros ausentes deste backup? Registros existentes serão preservados e nada será excluído.')) return;
    setRestaurando(true);
    try {
      const response = await base44.functions.invoke('restaurarBackupPlanosFerias', {
        arquivo_url: relatorioRestore.arquivoUrl,
        modo: 'CONFIRMAR',
      });
      setRelatorioRestore((atual) => ({ ...atual, resultado: response?.data?.restauracao || response?.data }));
      toast({ title: 'Restauração concluída', description: 'Os registros existentes foram preservados.' });
    } catch (error) {
      const detalhe = error?.response?.data?.error || error?.data?.error || error?.message || 'Nenhum registro foi confirmado.';
      toast({ title: 'Falha na restauração', description: detalhe, variant: 'destructive' });
    } finally {
      setRestaurando(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-blue-100 p-3">
          <Archive className="w-7 h-7 text-blue-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Backup do Sistema</h1>
          <p className="text-sm text-slate-500">
            Gere uma cópia completa dos dados do SGP para arquivamento em HD externo.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">O que deseja incluir no backup?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <RadioGroup value={modo} onValueChange={setModo} className="gap-4">
            <label
              htmlFor="planos_ferias"
              className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                modo === 'planos_ferias' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <RadioGroupItem value="planos_ferias" id="planos_ferias" className="mt-1" />
              <div className="flex-1">
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                  <Archive className="w-4 h-4" />
                  Planos de Férias e respostas (recomendado antes de alterações)
                </div>
                <p className="text-sm text-slate-600 mt-1">
                  Exporta os planos, campanhas, opções enviadas, respostas, decisões, permissões,
                  grupos, militares envolvidos, períodos aquisitivos, auditoria e férias geradas vinculadas.
                </p>
                <p className="text-xs text-slate-500 mt-2">Backup direcionado, sem modificar nenhum registro.</p>
              </div>
            </label>

            <label
              htmlFor="somente_dados"
              className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                modo === 'somente_dados' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <RadioGroupItem value="somente_dados" id="somente_dados" className="mt-1" />
              <div className="flex-1">
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                  <Database className="w-4 h-4" />
                  Somente dados (recomendado)
                </div>
                <p className="text-sm text-slate-600 mt-1">
                  Inclui todos os registros das tabelas (militares, férias, atestados, publicações,
                  medalhas etc.) em arquivos JSON. Arquivos físicos (PDFs, fotos) não são baixados,
                  mas seus links permanecem registrados.
                </p>
                <p className="text-xs text-slate-500 mt-2">Tamanho típico: alguns MB. Geração: rápida (segundos a 1 min).</p>
              </div>
            </label>

            <label
              htmlFor="dados_e_arquivos"
              className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                modo === 'dados_e_arquivos' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <RadioGroupItem value="dados_e_arquivos" id="dados_e_arquivos" className="mt-1" />
              <div className="flex-1">
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                  <FileArchive className="w-4 h-4" />
                  Dados + arquivos físicos (completo)
                </div>
                <p className="text-sm text-slate-600 mt-1">
                  Inclui tudo do modo anterior <strong>mais</strong> todos os PDFs, fotos e anexos
                  baixados dentro do ZIP. Ideal para guardar uma cópia 100% offline.
                </p>
                <p className="text-xs text-slate-500 mt-2">
                  Tamanho típico: centenas de MB a vários GB. Geração: pode levar de 5 a 30 minutos.
                </p>
              </div>
            </label>
          </RadioGroup>

          {modo === 'dados_e_arquivos' && (
            <Alert variant="default" className="border-amber-300 bg-amber-50">
              <AlertTriangle className="h-4 w-4 text-amber-700" />
              <AlertTitle className="text-amber-900">Atenção</AlertTitle>
              <AlertDescription className="text-amber-800">
                A geração do backup completo pode demorar bastante. Mantenha esta aba aberta até o
                download iniciar. Arquivos individuais maiores que 100 MB serão ignorados (constarão
                no manifesto de erros).
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end pt-2">
            <Button
              onClick={handleGerarBackup}
              disabled={gerando}
              size="lg"
              className="bg-blue-600 hover:bg-blue-700"
            >
              {gerando ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Gerando backup...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Gerar e baixar backup
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Restaurar backup de Planos de Férias</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">
            Selecione um ZIP de Planos de Férias. A primeira etapa apenas valida o manifesto,
            os checksums e os conflitos; ela não altera nenhum dado.
          </p>
          <input
            type="file"
            accept=".zip,application/zip"
            onChange={(event) => {
              setArquivoRestore(event.target.files?.[0] || null);
              setRelatorioRestore(null);
            }}
            className="block w-full rounded-xl border border-slate-300 bg-white p-3 text-sm"
          />
          <Button type="button" onClick={simularRestauracao} disabled={!arquivoRestore || restaurando} className="bg-amber-700 hover:bg-amber-800">
            {restaurando ? 'Validando...' : 'Simular restauração'}
          </Button>
          {relatorioRestore?.simulacao && (
            <Alert className="border-amber-300 bg-amber-50">
              <AlertTriangle className="h-4 w-4 text-amber-700" />
              <AlertTitle className="text-amber-900">Simulação pronta para revisão</AlertTitle>
              <AlertDescription className="space-y-2 text-amber-900">
                <p>{relatorioRestore.simulacao.registros_a_inserir} registro(s) ausente(s) seriam inserido(s).</p>
                <p>{relatorioRestore.simulacao.conflitos} registro(s) já existem e serão preservados.</p>
                <Button type="button" onClick={confirmarRestauracao} disabled={restaurando || relatorioRestore.resultado} className="bg-rose-700 hover:bg-rose-800">
                  Confirmar restauração aditiva
                </Button>
                {relatorioRestore.resultado && <p className="font-semibold">Processamento concluído. Verifique eventuais erros no relatório antes de utilizar os dados.</p>}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Como restaurar um backup?</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-600 space-y-2">
          <p>
            O ZIP gerado contém um arquivo <code className="bg-slate-100 px-1 rounded">manifesto.json</code>{' '}
            com a data, planos incluídos, contagem de registros e checksums, e uma pasta{' '}
            <code className="bg-slate-100 px-1 rounded">dados/</code> com um JSON por entidade.
          </p>
          <p>
            A restauração dos Planos de Férias será feita em duas etapas: primeiro uma simulação
            para identificar conflitos e depois a confirmação administrativa. O backup deve ser guardado
            em local seguro; a restauração nunca deverá sobrescrever respostas sem mostrar o impacto.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}