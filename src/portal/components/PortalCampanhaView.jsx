import React, { useState, useEffect } from 'react';
import { getCampanhaFormulario, submeterRespostaCampanha } from '../api/PortalApiClient';
import { base44 } from '@/api/base44Client';
import {
  FileText,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowLeft,
  RefreshCw,
  Send,
  ShieldCheck,
  CheckSquare,
  FileCheck,
  Calendar,
  Eye,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';

function formatarDataBR(dataStr) {
  if (!dataStr) return '-';
  const str = String(dataStr).trim();
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`;
  }
  return str;
}

export default function PortalCampanhaView({ campanhaId, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState({});
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Estados de Formulário
  const [respostas, setRespostas] = useState({}); // { [campoId]: valor }
  const [arquivosAnexados, setArquivosAnexados] = useState({}); // { [campoId]: { url, nome } }
  const [arquivoDevolucao, setArquivoDevolucao] = useState({ url: '', nome: '' });
  const [respostaTextoGeral, setRespostaTextoGeral] = useState('');
  const [termoAceite, setTermoAceite] = useState(false);

  const loadCampanha = async () => {
    if (!campanhaId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await getCampanhaFormulario(campanhaId);
      setData(res);

      if (res?.resposta_existente) {
        const r = res.resposta_existente;
        setRespostas(r.respostas || {});
        setArquivosAnexados(r.arquivos_anexados || {});
        if (r.arquivo_devolucao_url) {
          setArquivoDevolucao({ url: r.arquivo_devolucao_url, nome: r.arquivo_devolucao_nome || 'documento_assinado.pdf' });
        }
        setRespostaTextoGeral(r.resposta_texto_geral || '');
        setTermoAceite(Boolean(r.termo_aceite));
      }
    } catch (err) {
      setErrorMsg(err.message || 'Falha ao carregar detalhes da campanha.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCampanha();
  }, [campanhaId]);

  // Manipulador de upload de arquivo via Base44 Storage
  const handleUploadFile = async (file, campoId = 'geral') => {
    if (!file) return;
    setUploadingFiles((prev) => ({ ...prev, [campoId]: true }));
    setErrorMsg(null);

    try {
      const uploadRes = await base44.integrations.Core.UploadFile({ file });
      const fileUrl = uploadRes?.file_url || uploadRes?.url;

      if (!fileUrl) {
        throw new Error('Não foi possível obter o link do arquivo enviado.');
      }

      if (campoId === 'geral' || campoId === 'devolucao') {
        setArquivoDevolucao({ url: fileUrl, nome: file.name });
      } else {
        setArquivosAnexados((prev) => ({
          ...prev,
          [campoId]: { url: fileUrl, nome: file.name, tamanho: file.size },
        }));
      }
    } catch (err) {
      setErrorMsg(err.message || 'Falha ao realizar upload do arquivo.');
    } finally {
      setUploadingFiles((prev) => ({ ...prev, [campoId]: false }));
    }
  };

  const handleCheckboxChange = (campoId, opcao, isChecked) => {
    setRespostas((prev) => {
      const atuais = Array.isArray(prev[campoId]) ? [...prev[campoId]] : [];
      let novos = [];
      if (isChecked) {
        if (!atuais.includes(opcao)) novos = [...atuais, opcao];
        else novos = atuais;
      } else {
        novos = atuais.filter((item) => item !== opcao);
      }
      return { ...prev, [campoId]: novos };
    });
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const campanha = data?.campanha;
    const campos = campanha?.formulario?.campos || [];

    // Validação de Campos Obrigatórios
    for (const c of campos) {
      if (c.obrigatorio) {
        if (c.tipo === 'upload_arquivo') {
          if (!arquivosAnexados[c.id]?.url) {
            setErrorMsg(`O anexo da pergunta "${c.pergunta}" é obrigatório.`);
            return;
          }
        } else if (c.tipo === 'termo_aceite') {
          if (!respostas[c.id]) {
            setErrorMsg(`Você deve confirmar o termo "${c.pergunta}" para continuar.`);
            return;
          }
        } else {
          const val = respostas[c.id];
          if (val === undefined || val === null || (typeof val === 'string' && val.trim() === '') || (Array.isArray(val) && val.length === 0)) {
            setErrorMsg(`A pergunta "${c.pergunta}" é de preenchimento obrigatório.`);
            return;
          }
        }
      }
    }

    if (campanha?.tipo === 'ASSINATURA_DOCUMENTO' && campanha?.exigir_devolucao_arquivo) {
      if (!arquivoDevolucao.url) {
        setErrorMsg('É obrigatório anexar o documento assinado para concluir o envio.');
        return;
      }
    }

    if (campanha?.texto_termo_aceite && !termoAceite) {
      setErrorMsg('Você deve marcar a declaração / termo de ciência para continuar.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await submeterRespostaCampanha({
        campanha_id: campanhaId,
        respostas_json: respostas,
        arquivos_anexados_json: arquivosAnexados,
        arquivo_devolucao_url: arquivoDevolucao.url,
        arquivo_devolucao_nome: arquivoDevolucao.nome,
        resposta_texto_geral: respostaTextoGeral,
        termo_aceite: termoAceite,
      });

      setSuccessMsg(res.message || 'Sua resposta foi enviada com sucesso ao Comando / RH!');
      await loadCampanha();
    } catch (err) {
      setErrorMsg(err.message || 'Falha ao enviar resposta.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-[#1e3a5f] rounded-full animate-spin"></div>
        <p className="text-sm text-slate-500 font-medium">Carregando formulário da campanha...</p>
      </div>
    );
  }

  const campanha = data?.campanha;
  const respostaExistente = data?.resposta_existente;
  const isRespondido = Boolean(respostaExistente);
  const campos = campanha?.formulario?.campos || [];

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
      {/* BARRA SUPERIOR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div className="flex items-center space-x-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="h-9 px-2 text-slate-600 hover:text-[#1e3a5f] hover:bg-slate-100 rounded-xl"
          >
            <ArrowLeft className="w-5 h-5 mr-1" />
            Voltar
          </Button>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center">
              <FileText className="w-5 h-5 mr-2 text-[#1e3a5f]" />
              {campanha?.titulo || 'Campanha Institucional'}
            </h2>
            <p className="text-xs text-slate-500 flex items-center">
              <Clock className="w-3.5 h-3.5 mr-1 text-slate-400" />
              Prazo limite: <strong className="ml-1 text-slate-700">{formatarDataBR(campanha?.data_fim_militar)}</strong>
            </p>
          </div>
        </div>

        {/* STATUS DA SUBMISSÃO */}
        <div className="flex items-center space-x-2">
          {isRespondido ? (
            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold flex items-center shadow-xs">
              <CheckCircle2 className="w-4 h-4 mr-1 text-emerald-600" />
              Respondido
            </span>
          ) : (
            <span className="px-3 py-1 bg-amber-100 text-amber-900 rounded-xl text-xs font-bold flex items-center shadow-xs">
              <AlertCircle className="w-4 h-4 mr-1 text-amber-600" />
              Pendente de Resposta
            </span>
          )}
        </div>
      </div>

      {/* FEEDBACK ALERTS */}
      {errorMsg && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-start space-x-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-start space-x-2">
          <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* COMPROVANTE SE JÁ ENVIADO */}
      {isRespondido && (
        <div className="p-4 bg-emerald-50/90 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5">
              <FileCheck className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-emerald-950 block text-sm">
                Sua resposta está registrada no sistema!
              </span>
              <span className="text-emerald-800 text-[11px] block mt-0.5">
                Enviado em: <strong>{new Date(respostaExistente.data_envio).toLocaleString('pt-BR')}</strong>
                {respostaExistente.status && ` • Situação: ${respostaExistente.status}`}
              </span>
              {respostaExistente.observacao_gestor && (
                <p className="mt-1 text-blue-800 bg-blue-50 p-2 rounded-lg border border-blue-200 text-[11px]">
                  <strong>Despacho do RH:</strong> {respostaExistente.observacao_gestor}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CARD DE ORIENTAÇÕES / INSTRUÇÕES */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-sm font-bold text-slate-800 flex items-center">
            <ShieldCheck className="w-4 h-4 mr-2 text-[#1e3a5f]" />
            Orientações e Instruções
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-5 text-xs text-slate-700 leading-relaxed whitespace-pre-line">
          {campanha?.instrucoes || 'Por favor, leia atentamente e preencha as informações solicitadas abaixo.'}
        </CardContent>
      </Card>

      {/* CARD DE ARQUIVO MODELO (Se a campanha tiver um modelo geral) */}
      {campanha?.arquivo_modelo_url && (
        <Card className="border-blue-200 bg-blue-50/50 shadow-sm">
          <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <strong className="text-slate-900 block font-bold text-sm">
                  Documento / Arquivo Modelo Oficial
                </strong>
                <span className="text-slate-600 text-xs">
                  {campanha.arquivo_modelo_nome || 'Arquivo para preenchimento e assinatura'}
                </span>
              </div>
            </div>

            <a
              href={campanha.arquivo_modelo_url}
              target="_blank"
              rel="noopener noreferrer"
              download
              className="inline-flex items-center justify-center bg-white hover:bg-slate-50 border border-blue-300 text-blue-800 rounded-xl px-4 py-2 text-xs font-bold shadow-xs transition-colors"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Baixar Modelo Oficial
            </a>
          </CardContent>
        </Card>
      )}

      {/* FORMULÁRIO DE PREENCHIMENTO */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* SEÇÃO 1: PERGUNTAS DO FORMULÁRIO DINÂMICO (Se houver) */}
        {campos.length > 0 && (
          <div className="space-y-4">
            {campos.map((campo, index) => (
              <Card key={campo.id || index} className="border-slate-200 shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-sm font-bold text-slate-800 flex items-center">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-[#1e3a5f] text-xs flex items-center justify-center font-bold mr-2">
                        {index + 1}
                      </span>
                      {campo.pergunta}
                      {campo.obrigatorio && (
                        <span className="text-red-500 font-bold ml-1" title="Campo Obrigatório">*</span>
                      )}
                    </CardTitle>
                  </div>
                  {campo.descricao_ajuda && (
                    <CardDescription className="text-xs text-slate-500 mt-1 pl-7">
                      {campo.descricao_ajuda}
                    </CardDescription>
                  )}
                </CardHeader>

                <CardContent className="p-4 pt-2 sm:p-5 sm:pt-2 pl-4 sm:pl-12 text-xs">
                  {/* RENDERIZADORES CONFORME O TIPO */}
                  {campo.tipo === 'texto_curto' && (
                    <Input
                      type="text"
                      value={respostas[campo.id] || ''}
                      onChange={(e) => setRespostas({ ...respostas, [campo.id]: e.target.value })}
                      placeholder="Sua resposta..."
                      className="text-xs rounded-xl h-10 border-slate-300"
                    />
                  )}

                  {campo.tipo === 'texto_longo' && (
                    <textarea
                      rows={3}
                      value={respostas[campo.id] || ''}
                      onChange={(e) => setRespostas({ ...respostas, [campo.id]: e.target.value })}
                      placeholder="Digite sua resposta detalhada..."
                      className="w-full p-3 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#1e3a5f]"
                    />
                  )}

                  {campo.tipo === 'numero' && (
                    <Input
                      type="number"
                      value={respostas[campo.id] || ''}
                      onChange={(e) => setRespostas({ ...respostas, [campo.id]: e.target.value })}
                      placeholder="0"
                      className="text-xs rounded-xl h-10 border-slate-300 max-w-xs"
                    />
                  )}

                  {campo.tipo === 'data' && (
                    <Input
                      type="date"
                      value={respostas[campo.id] || ''}
                      onChange={(e) => setRespostas({ ...respostas, [campo.id]: e.target.value })}
                      className="text-xs rounded-xl h-10 border-slate-300 max-w-xs"
                    />
                  )}

                  {campo.tipo === 'select' && (
                    <select
                      value={respostas[campo.id] || ''}
                      onChange={(e) => setRespostas({ ...respostas, [campo.id]: e.target.value })}
                      className="w-full h-10 px-3 border border-slate-300 rounded-xl text-xs bg-white outline-none focus:border-[#1e3a5f] font-medium"
                    >
                      <option value="">Selecione uma opção...</option>
                      {(campo.opcoes || []).map((op, i) => (
                        <option key={i} value={op}>{op}</option>
                      ))}
                    </select>
                  )}

                  {campo.tipo === 'multipla_escolha' && (
                    <div className="space-y-2">
                      {(campo.opcoes || []).map((op, i) => (
                        <label key={i} className="flex items-center space-x-2.5 cursor-pointer p-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all">
                          <input
                            type="radio"
                            name={`radio_${campo.id}`}
                            value={op}
                            checked={respostas[campo.id] === op}
                            onChange={(e) => setRespostas({ ...respostas, [campo.id]: e.target.value })}
                            className="w-4 h-4 accent-[#1e3a5f]"
                          />
                          <span className="text-slate-800 text-xs font-medium">{op}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {campo.tipo === 'checkbox' && (
                    <div className="space-y-2">
                      {(campo.opcoes || []).map((op, i) => {
                        const isChecked = Array.isArray(respostas[campo.id]) && respostas[campo.id].includes(op);
                        return (
                          <label key={i} className="flex items-center space-x-2.5 cursor-pointer p-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => handleCheckboxChange(campo.id, op, e.target.checked)}
                              className="w-4 h-4 accent-[#1e3a5f] rounded"
                            />
                            <span className="text-slate-800 text-xs font-medium">{op}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {campo.tipo === 'upload_arquivo' && (
                    <div className="space-y-2">
                      {campo.arquivo_modelo_url && (
                        <div className="mb-2">
                          <a
                            href={campo.arquivo_modelo_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            download
                            className="inline-flex items-center text-xs font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200"
                          >
                            <Download className="w-3.5 h-3.5 mr-1" />
                            Baixar Modelo Específico desta Pergunta
                          </a>
                        </div>
                      )}

                      {arquivosAnexados[campo.id]?.url ? (
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <FileCheck className="w-5 h-5 text-emerald-700 shrink-0" />
                            <span className="font-semibold text-emerald-950 text-xs truncate max-w-xs">
                              {arquivosAnexados[campo.id].nome}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <a
                              href={arquivosAnexados[campo.id].url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-700 hover:text-emerald-900 p-1"
                              title="Visualizar anexo"
                            >
                              <Eye className="w-4 h-4" />
                            </a>
                            <button
                              type="button"
                              onClick={() => {
                                const next = { ...arquivosAnexados };
                                delete next[campo.id];
                                setArquivosAnexados(next);
                              }}
                              className="text-red-500 hover:text-red-700 p-1"
                              title="Remover anexo"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="border-2 border-dashed border-slate-300 hover:border-[#1e3a5f] rounded-xl p-4 text-center cursor-pointer transition-colors bg-slate-50/50 relative">
                          <input
                            type="file"
                            onChange={(e) => handleUploadFile(e.target.files?.[0], campo.id)}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          />
                          {uploadingFiles[campo.id] ? (
                            <div className="flex items-center justify-center space-x-2 py-2">
                              <RefreshCw className="w-4 h-4 animate-spin text-[#1e3a5f]" />
                              <span className="text-xs text-slate-600 font-medium">Enviando anexo...</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center space-x-1 py-1">
                              <Upload className="w-5 h-5 text-slate-400 mb-1" />
                              <span className="text-xs font-semibold text-slate-700">Clique ou arraste para anexar o arquivo</span>
                              <span className="text-[10px] text-slate-400">Formatos aceitos: PDF, Imagens (PNG, JPG)</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {campo.tipo === 'termo_aceite' && (
                    <label className="flex items-start space-x-2.5 cursor-pointer p-3 bg-amber-50/60 border border-amber-200 rounded-xl">
                      <input
                        type="checkbox"
                        checked={Boolean(respostas[campo.id])}
                        onChange={(e) => setRespostas({ ...respostas, [campo.id]: e.target.checked })}
                        className="w-4 h-4 accent-amber-600 rounded mt-0.5"
                      />
                      <span className="text-amber-950 text-xs font-medium leading-relaxed">
                        {campo.pergunta}
                      </span>
                    </label>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* SEÇÃO 2: DEVOLUÇÃO DE DOCUMENTO ASSINADO (Para campanhas do tipo ASSINATURA_DOCUMENTO) */}
        {campanha?.tipo === 'ASSINATURA_DOCUMENTO' && (
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-sm font-bold text-slate-800 flex items-center">
                <Upload className="w-4 h-4 mr-2 text-emerald-600" />
                Anexo do Documento Assinado {campanha?.exigir_devolucao_arquivo && <span className="text-red-500 ml-1">*</span>}
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Faça o upload do documento preenchido e assinado para conferência do RH
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-5 text-xs space-y-3">
              {arquivoDevolucao.url ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <FileCheck className="w-5 h-5 text-emerald-700 shrink-0" />
                    <div>
                      <span className="font-bold text-emerald-950 text-xs block truncate max-w-xs">
                        {arquivoDevolucao.nome}
                      </span>
                      <span className="text-[10px] text-emerald-700">Arquivo pronto para submissão</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <a
                      href={arquivoDevolucao.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-700 hover:text-emerald-900 p-1"
                      title="Visualizar documento"
                    >
                      <Eye className="w-4 h-4" />
                    </a>
                    <button
                      type="button"
                      onClick={() => setArquivoDevolucao({ url: '', nome: '' })}
                      className="text-red-500 hover:text-red-700 p-1"
                      title="Remover anexo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed border-slate-300 hover:border-emerald-600 rounded-xl p-6 text-center cursor-pointer transition-colors bg-slate-50/50 relative">
                  <input
                    type="file"
                    onChange={(e) => handleUploadFile(e.target.files?.[0], 'devolucao')}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  {uploadingFiles['devolucao'] ? (
                    <div className="flex items-center justify-center space-x-2 py-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                      <span className="text-xs text-slate-600 font-medium">Enviando documento...</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-2">
                      <Upload className="w-6 h-6 text-emerald-600 mb-2" />
                      <span className="text-xs font-bold text-slate-800">Clique ou arraste seu documento assinado</span>
                      <span className="text-[11px] text-slate-400 mt-0.5">Formato PDF ou Imagem digitalizada</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* SEÇÃO 3: TERMO DE DECLARAÇÃO E CIÊNCIA INSTITUCIONAL */}
        {campanha?.texto_termo_aceite && (
          <Card className="border-amber-200 bg-amber-50/60 shadow-sm">
            <CardContent className="p-4 sm:p-5 text-xs">
              <label className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={termoAceite}
                  onChange={(e) => setTermoAceite(e.target.checked)}
                  required
                  className="w-4 h-4 accent-amber-600 rounded mt-0.5 shrink-0"
                />
                <div className="text-amber-950 font-medium leading-relaxed">
                  <strong className="block text-amber-950 mb-1">Declaração & Termo de Ciência:</strong>
                  {campanha.texto_termo_aceite}
                </div>
              </label>
            </CardContent>
          </Card>
        )}

        {/* BOTÃO DE SUBMISSÃO */}
        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            disabled={submitting}
            className="bg-[#1e3a5f] hover:bg-[#2a4d7d] text-white text-xs font-bold h-11 px-6 rounded-xl shadow-md transition-all flex items-center"
          >
            {submitting ? (
              <RefreshCw className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            {isRespondido ? 'Atualizar Minha Resposta' : 'Enviar Resposta ao Comando'}
          </Button>
        </div>
      </form>
    </div>
  );
}
