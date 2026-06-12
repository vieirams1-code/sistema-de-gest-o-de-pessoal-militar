import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileUp, FileText, CheckCircle2, Loader2, ChevronRight, ChevronLeft, Download, Info, Trash2, Edit } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import {
  processZip,
  processMultipleFiles,
  vincularMilitares,
  executarImportacaoLote
} from '@/services/importacaoLoteAcervoService';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STEPS = [
  { id: 1, title: 'Método', description: 'Selecionar origem' },
  { id: 2, title: 'Processamento', description: 'Leitura de arquivos' },
  { id: 3, title: 'Identificação', description: 'Vínculo com militares' },
  { id: 4, title: 'Configuração', description: 'Metadados do lote' },
  { id: 5, title: 'Execução', description: 'Upload e registro' },
  { id: 6, title: 'Resultado', description: 'Relatório final' }
];

import AccessDenied from '@/components/auth/AccessDenied';

export default function ImportacaoLoteAcervo() {
  const { userEmail, canAccessAction } = useCurrentUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [metodo, setMetodo] = useState(null); // 'ZIP' ou 'PDF'
  const [files, setFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [importId, setImportId] = useState(null);
  const [progress, setProgress] = useState(null);
  const [coverageBefore, setCoverageBefore] = useState(null);
  const [loteOptions, setLoteOptions] = useState({
    origem_documento_fisico: '',
    digitalizado_por: userEmail || '',
    digitalizado_em: new Date().toISOString().split('T')[0],
    conferido_por: '',
    conferido_em: '',
    observacoes_conferencia: ''
  });

  const [editingFileIdx, setEditingFileIdx] = useState(null);

  if (!canAccessAction('gerir_acervo_historico')) {
    return <AccessDenied modulo="Importação em Lote do Acervo" />;
  }

  const handleUpdateFileMetadata = (idx, newData) => {
    setFiles(prev => prev.map((f, i) => i === idx ? { ...f, metadata: { ...f.metadata, ...newData } } : f));
  };

  const handleFileSelection = async (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (!selectedFiles.length) return;

    setProcessing(true);
    try {
      let processed = [];
      if (metodo === 'ZIP') {
        processed = await processZip(selectedFiles[0]);
      } else {
        processed = await processMultipleFiles(selectedFiles);
      }

      const comVinculos = await vincularMilitares(processed);
      setFiles(comVinculos);
      setStep(3);
    } catch (err) {
      toast({ title: 'Erro no processamento', description: err.message, variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const handleStartImport = async () => {
    setStep(5);
    try {
      // Calcula cobertura antes
      const acervo = await base44.entities.AcervoFuncionalHistorico.list();
      const comAcervoAntes = new Set(acervo.map(a => a.militar_id)).size;
      setCoverageBefore(comAcervoAntes);

      const importacao = await base44.entities.ImportacaoAcervo.create({
        usuario: userEmail,
        data_inicio: new Date().toISOString(),
        status: 'PROCESSANDO',
        total_arquivos: files.length
      });
      setImportId(importacao.id);

      const result = await executarImportacaoLote(
        importacao.id,
        files,
        loteOptions,
        (p) => setProgress(p)
      );

      // Calcula cobertura depois
      const acervoDepois = await base44.entities.AcervoFuncionalHistorico.list();
      const comAcervoDepois = new Set(acervoDepois.map(a => a.militar_id)).size;

      setStep(6);
      setProgress({ ...result, coverageAfter: comAcervoDepois });
      queryClient.invalidateQueries({ queryKey: ['acervo-stats'] });
    } catch (err) {
      toast({ title: 'Falha na importação', description: err.message, variant: 'destructive' });
    }
  };

  const exportCSV = () => {
    if (!progress?.logs) return;
    const headers = [
      'arquivo_original',
      'militar_matricula',
      'militar_nome',
      'tipo_documento',
      'titulo',
      'resultado',
      'motivo',
      'drive_file_id',
      'acervo_id',
      'hash_sha256',
      'usuario_importacao',
      'data_importacao'
    ];

    const csvContent = [
      headers.join(','),
      ...progress.logs.map(log => [
        `"${log.arquivo_original || log.arquivo || ''}"`,
        `"${log.militar_matricula || ''}"`,
        `"${log.militar_nome || ''}"`,
        `"${log.tipo_documento || ''}"`,
        `"${log.titulo || ''}"`,
        `"${log.resultado || ''}"`,
        `"${log.mensagem || ''}"`,
        `"${log.drive_file_id || ''}"`,
        `"${log.acervo_id || ''}"`,
        `"${log.hash_sha256 || ''}"`,
        `"${log.usuario_importacao || ''}"`,
        `"${log.data_importacao || ''}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio_importacao_${importId}.csv`;
    link.click();
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1e3a5f] mb-2">Assistente de Importação em Lote</h1>
          <p className="text-slate-500">Digitalização Assistida do Acervo Histórico</p>
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 max-w-md text-xs">
          <p className="font-bold text-blue-800 mb-2 uppercase flex items-center gap-1">
            <Info className="w-3 h-3" /> Padrões Recomendados
          </p>
          <ul className="space-y-1 text-blue-700">
            <li><strong>Alterações:</strong> MATRICULA_Alteracao_AAAA-AAAA.pdf</li>
            <li><strong>Certidões:</strong> MATRICULA_Certidao_AAAA_COMPORTAMENTO.pdf</li>
            <li><strong>Diversos:</strong> MATRICULA_Diversos_Titulo.pdf</li>
          </ul>
          <p className="mt-2 text-[10px] text-blue-600">Aceita _, - ou espaço como separadores e matrícula com pontuação.</p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex justify-between mb-8 overflow-x-auto pb-4">
        {STEPS.map((s) => (
          <div key={s.id} className={`flex flex-col items-center min-w-[120px] ${step === s.id ? 'text-blue-600' : step > s.id ? 'text-emerald-600' : 'text-slate-400'}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 border-2 ${step === s.id ? 'border-blue-600 bg-blue-50' : step > s.id ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200'}`}>
              {step > s.id ? <CheckCircle2 className="w-6 h-6" /> : <span>{s.id}</span>}
            </div>
            <span className="text-xs font-bold uppercase">{s.title}</span>
            <span className="text-[10px] text-center">{s.description}</span>
          </div>
        ))}
      </div>

      <Card className="min-h-[400px]">
        <CardContent className="pt-8">
          {step === 1 && (
            <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto py-12">
              <Button
                variant="outline"
                className="h-40 flex flex-col gap-4 border-2 hover:border-blue-500 hover:bg-blue-50"
                onClick={() => { setMetodo('ZIP'); setStep(2); }}
              >
                <div className="p-4 bg-blue-100 rounded-full text-blue-600">
                  <FileUp className="w-8 h-8" />
                </div>
                <div className="text-center">
                  <p className="font-bold">Pasta Compactada (ZIP)</p>
                  <p className="text-xs text-slate-500">Múltiplos arquivos e subpastas</p>
                </div>
              </Button>
              <Button
                variant="outline"
                className="h-40 flex flex-col gap-4 border-2 hover:border-blue-500 hover:bg-blue-50"
                onClick={() => { setMetodo('PDF'); setStep(2); }}
              >
                <div className="p-4 bg-blue-100 rounded-full text-blue-600">
                  <FileText className="w-8 h-8" />
                </div>
                <div className="text-center">
                  <p className="font-bold">Arquivos PDFs</p>
                  <p className="text-xs text-slate-500">Seleção múltipla de arquivos</p>
                </div>
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="max-w-xl mx-auto py-12 text-center">
              {processing ? (
                <div className="space-y-4">
                  <Loader2 className="w-12 h-12 animate-spin mx-auto text-blue-600" />
                  <p className="font-medium">Processando arquivos e identificando padrões...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="border-2 border-dashed border-slate-200 rounded-xl p-12 bg-slate-50">
                    <input
                      type="file"
                      id="file-upload"
                      className="hidden"
                      multiple={metodo === 'PDF'}
                      accept={metodo === 'ZIP' ? '.zip' : '.pdf'}
                      onChange={handleFileSelection}
                    />
                    <label htmlFor="file-upload" className="cursor-pointer">
                      <FileUp className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                      <p className="text-slate-600 font-medium">Clique para selecionar ou arraste aqui</p>
                      <p className="text-sm text-slate-400 mt-1">
                        {metodo === 'ZIP' ? 'Apenas arquivos .zip contendo PDFs' : 'Múltiplos arquivos .pdf'}
                      </p>
                    </label>
                  </div>
                  <Button variant="ghost" onClick={() => setStep(1)}><ChevronLeft className="w-4 h-4 mr-2" /> Voltar</Button>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">Arquivos Identificados ({files.length})</h3>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setStep(2)}>Adicionar mais</Button>
                  <Button size="sm" onClick={() => setStep(4)}>Próximo <ChevronRight className="w-4 h-4 ml-2" /></Button>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Arquivo</TableHead>
                      <TableHead>Militar Identificado</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Confiança</TableHead>
                      <TableHead>Situação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {files.map((f, i) => (
                      <TableRow key={i} className={editingFileIdx === i ? 'bg-blue-50' : ''}>
                        <TableCell className="max-w-[150px] truncate">
                          <p className="text-xs font-medium">{f.filename}</p>
                          <p className="text-[10px] text-slate-400">{(f.size / 1024).toFixed(1)} KB</p>
                        </TableCell>
                        <TableCell>
                          {editingFileIdx === i ? (
                            <Input
                              size="sm"
                              className="h-8 text-xs"
                              placeholder="Matrícula"
                              value={f.metadata.matricula || ''}
                              onChange={e => handleUpdateFileMetadata(i, { matricula: e.target.value })}
                            />
                          ) : (
                            <div className="text-xs">
                              {f.militar ? (
                                <>
                                  <p className="font-bold">{f.militar.nome}</p>
                                  <p className="text-slate-500">{f.militar.matricula}</p>
                                </>
                              ) : (
                                <span className="text-red-500 italic">Militar não encontrado ({f.metadata.matricula || '?'})</span>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingFileIdx === i ? (
                            <div className="flex flex-col gap-1">
                              <Select
                                value={f.metadata.tipo_documento}
                                onValueChange={v => handleUpdateFileMetadata(i, { tipo_documento: v })}
                              >
                                <SelectTrigger className="h-8 text-[10px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="ALTERACAO">ALTERAÇÃO</SelectItem>
                                  <SelectItem value="CERTIDAO_COMPORTAMENTO">CERTIDÃO</SelectItem>
                                  <SelectItem value="DIVERSOS">DIVERSOS</SelectItem>
                                </SelectContent>
                              </Select>
                              <Input
                                className="h-8 text-[10px]"
                                placeholder="Título"
                                value={f.metadata.titulo || ''}
                                onChange={e => handleUpdateFileMetadata(i, { titulo: e.target.value })}
                              />
                            </div>
                          ) : (
                            <div className="text-xs">
                              <Badge variant="outline" className="text-[10px] h-4 mb-1">{f.metadata.tipo_documento}</Badge>
                              <p className="truncate max-w-[150px]">{f.metadata.titulo}</p>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge className={
                              f.metadata.confianca === 'ALTA' ? 'bg-emerald-100 text-emerald-700' :
                              f.metadata.confianca === 'MEDIA' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                            }>
                              {f.metadata.confianca}
                            </Badge>
                            {f.duplicado && (
                              <Badge variant="destructive" className="text-[8px] h-3">DUPLICADO</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {editingFileIdx === i ? (
                            <Button size="sm" variant="ghost" onClick={() => {
                              vincularMilitares([files[i]]).then(res => {
                                setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, ...res[0] } : f));
                                setEditingFileIdx(null);
                              });
                            }}>Salvar</Button>
                          ) : (
                            <div className="flex justify-end gap-1">
                              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingFileIdx(i)}>
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
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

          {step === 4 && (
            <div className="max-w-4xl mx-auto py-8 space-y-8">
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Info className="w-5 h-5 text-blue-600" /> Cadeia de Custódia do Lote
                  </h3>
                  <p className="text-xs text-slate-500">Estes dados serão aplicados a todos os arquivos do lote, exceto quando houver sobrescrita individual.</p>

                  <div className="grid gap-4 bg-slate-50 p-6 rounded-xl border">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold">Origem Física</Label>
                        <Input
                          placeholder="Ex: Caixa 42"
                          value={loteOptions.origem_documento_fisico}
                          onChange={e => setLoteOptions(prev => ({ ...prev, origem_documento_fisico: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold">Digitalizado Por</Label>
                        <Input
                          value={loteOptions.digitalizado_por}
                          onChange={e => setLoteOptions(prev => ({ ...prev, digitalizado_por: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold">Data Digitalização</Label>
                        <Input
                          type="date"
                          value={loteOptions.digitalizado_em}
                          onChange={e => setLoteOptions(prev => ({ ...prev, digitalizado_em: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold">Conferido Por</Label>
                        <Input
                          value={loteOptions.conferido_por}
                          onChange={e => setLoteOptions(prev => ({ ...prev, conferido_por: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold">Observações de Conferência</Label>
                      <Input
                        value={loteOptions.observacoes_conferencia}
                        onChange={e => setLoteOptions(prev => ({ ...prev, observacoes_conferencia: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                   <h3 className="text-lg font-bold">Resumo da Prévia</h3>
                   <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Arquivos Totais</span>
                        <Badge variant="secondary">{files.length}</Badge>
                      </div>
                      <div className="flex justify-between items-center text-emerald-700">
                        <span className="text-sm font-medium">Identificação Alta Confiança</span>
                        <span className="font-bold">{files.filter(f => f.metadata.confianca === 'ALTA').length}</span>
                      </div>
                      <div className="flex justify-between items-center text-amber-700">
                        <span className="text-sm font-medium">Necessitam Revisão Manual</span>
                        <span className="font-bold">{files.filter(f => f.metadata.confianca !== 'ALTA').length}</span>
                      </div>
                      <div className="pt-4 border-t border-blue-200">
                        <p className="text-[10px] text-blue-600 leading-tight">
                          <strong>Importante:</strong> Esta etapa é obrigatória para garantir a integridade dos dados.
                          Após clicar em "Iniciar", o processo não poderá ser desfeito em massa.
                        </p>
                      </div>
                   </div>
                </div>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Atenção:</strong> Arquivos com confiança <strong>ALTA</strong> serão marcados automaticamente como <strong>VALIDADOS</strong>.
                  Os demais entrarão na fila de revisão pós-importação.
                </p>
              </div>

              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setStep(3)}><ChevronLeft className="w-4 h-4 mr-2" /> Voltar</Button>
                <Button onClick={handleStartImport} className="bg-blue-600">Iniciar Importação de {files.length} arquivos</Button>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="max-w-xl mx-auto py-12 space-y-8">
              <div className="text-center space-y-2">
                <h3 className="text-xl font-bold">Importação em Andamento</h3>
                <p className="text-slate-500">Fazendo upload para o Google Drive e registrando no Base44</p>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between text-sm font-medium">
                  <span>Progresso Geral</span>
                  <span>{progress?.percentual || 0}%</span>
                </div>
                <Progress value={progress?.percentual || 0} className="h-4" />

                <div className="grid grid-cols-4 gap-2 text-center pt-4">
                  <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                    <p className="text-xs text-emerald-600 font-bold uppercase">Sucesso</p>
                    <p className="text-xl font-bold text-emerald-700">{progress?.importados || 0}</p>
                  </div>
                  <div className="bg-amber-50 p-3 rounded-lg border border-amber-100">
                    <p className="text-xs text-amber-600 font-bold uppercase">Duplicados</p>
                    <p className="text-xl font-bold text-amber-700">{progress?.duplicados || 0}</p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <p className="text-xs text-slate-500 font-bold uppercase">Ignorados</p>
                    <p className="text-xl font-bold text-slate-700">{progress?.ignorados || 0}</p>
                  </div>
                  <div className="bg-red-50 p-3 rounded-lg border border-red-100">
                    <p className="text-xs text-red-600 font-bold uppercase">Falhas</p>
                    <p className="text-xl font-bold text-red-700">{progress?.falhas || 0}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600" /> Importação Finalizada
                  </h3>
                  <p className="text-slate-500">O lote foi processado com sucesso.</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={exportCSV}>
                    <Download className="w-4 h-4 mr-2" /> Exportar CSV
                  </Button>
                  <Button onClick={() => window.location.reload()}>Nova Importação</Button>
                </div>
              </div>

              <div className="grid md:grid-cols-4 gap-4">
                <StatCard title="Total" value={files.length} color="blue" />
                <StatCard title="Importados" value={progress?.importados} color="emerald" />
                <StatCard title="Duplicados" value={progress?.duplicados} color="amber" />
                <StatCard title="Erros" value={progress?.falhas} color="red" />
              </div>

              <Card className="bg-slate-50 border-slate-200">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-slate-500 uppercase">Impacto na Cobertura do Acervo</p>
                      <p className="text-xs text-slate-400">Militares com pelo menos um documento digitalizado</p>
                    </div>
                    <div className="flex items-center gap-8">
                      <div className="text-center">
                        <p className="text-xs text-slate-500 uppercase">Antes</p>
                        <p className="text-2xl font-bold">{coverageBefore || 0}</p>
                      </div>
                      <ChevronRight className="w-6 h-6 text-slate-300" />
                      <div className="text-center">
                        <p className="text-xs text-emerald-600 font-bold uppercase">Depois</p>
                        <p className="text-2xl font-bold text-emerald-700">{progress?.coverageAfter || 0}</p>
                      </div>
                      <div className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-sm font-bold">
                        +{ (progress?.coverageAfter || 0) - (coverageBefore || 0) }
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="border rounded-lg overflow-hidden">
                <div className="p-4 bg-slate-50 border-b flex items-center justify-between">
                  <h4 className="font-bold text-sm uppercase">Log de Execução</h4>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Arquivo</TableHead>
                      <TableHead>Militar</TableHead>
                      <TableHead>Resultado</TableHead>
                      <TableHead>Detalhes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {progress?.logs?.map((log, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs">{log.arquivo}</TableCell>
                        <TableCell className="text-xs font-medium">{log.militar || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={log.resultado === 'IMPORTADO' ? 'default' : log.resultado === 'ERRO' ? 'destructive' : 'secondary'}>
                            {log.resultado}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">{log.mensagem}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ title, value, color }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    red: 'bg-red-50 text-red-700 border-red-100'
  };

  return (
    <Card className={colors[color]}>
      <CardContent className="pt-6 text-center">
        <p className="text-xs font-bold uppercase mb-1 opacity-70">{title}</p>
        <p className="text-3xl font-black">{value || 0}</p>
      </CardContent>
    </Card>
  );
}
