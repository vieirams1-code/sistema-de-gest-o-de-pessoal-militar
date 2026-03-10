import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  ArrowLeftRight, Upload, CheckCircle2, AlertCircle, XCircle,
  FileText, Loader2, ChevronDown, ChevronUp, Eye
} from 'lucide-react';

// Calcula similaridade entre dois textos (Dice coefficient sobre bigramas)
function calculateTextMatchingPercentage(text1, text2) {
  if (!text1 || !text2) return { percentage: 0, classification: 'Baixa' };

  const normalize = (t) => t.toLowerCase().replace(/[^a-z0-9\u00c0-\u017f\s]/g, '').replace(/\s+/g, ' ').trim();
  const getBigrams = (str) => {
    const bigrams = new Set();
    for (let i = 0; i < str.length - 1; i++) bigrams.add(str.slice(i, i + 2));
    return bigrams;
  };

  const s1 = normalize(text1);
  const s2 = normalize(text2);
  const b1 = getBigrams(s1);
  const b2 = getBigrams(s2);

  let intersection = 0;
  b1.forEach(bg => { if (b2.has(bg)) intersection++; });

  const similarity = b1.size + b2.size === 0 ? 0 : Math.round((2 * intersection / (b1.size + b2.size)) * 100);

  let classification;
  if (similarity > 70) classification = 'Alta';
  else if (similarity > 40) classification = 'Média';
  else classification = 'Baixa';

  return { percentage: similarity, classification };
}

// Extrai notas do texto do boletim usando heurísticas
function extrairNotasDoBoletim(texto) {
  if (!texto) return [];
  const notas = [];
  const linhas = texto.split('\n').map(l => l.trim()).filter(Boolean);

  // Tenta identificar blocos de nota por padrões comuns
  const padroes = [
    /^(\d+[\.\-\)]\s+.+)/,       // "1. texto" ou "1- texto"
    /^(NOTA[:\s].+)/i,
    /^(Art\..+)/i,
    /^([A-ZÁÊÃÕÔÜ][^.]{10,}\.)/, // frase com maiúscula e pelo menos 10 chars
  ];

  let blocoAtual = null;
  for (const linha of linhas) {
    const isParagrafoNovo = padroes.some(p => p.test(linha));
    if (isParagrafoNovo && blocoAtual) {
      notas.push(blocoAtual.trim());
      blocoAtual = linha;
    } else if (isParagrafoNovo) {
      blocoAtual = linha;
    } else if (blocoAtual) {
      blocoAtual += ' ' + linha;
    }
  }
  if (blocoAtual) notas.push(blocoAtual.trim());

  // Fallback: divide por parágrafo duplo
  if (notas.length === 0) {
    return texto.split(/\n{2,}/).map(p => p.replace(/\n/g, ' ').trim()).filter(p => p.length > 20);
  }

  return notas;
}

// Lê o PDF e retorna o texto
async function lerPDF(file) {
  const pdfjsLib = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.mjs';

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let textoCompleto = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map(item => item.str).join(' ');
    textoCompleto += pageText + '\n';
  }

  return textoCompleto;
}

export default function ConciliacaoBoletim() {
  const [etapa, setEtapa] = useState(1); // 1=upload, 2=análise, 3=resultado
  const [arquivo, setArquivo] = useState(null);
  const [textoBG, setTextoBG] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [publicacoes, setPublicacoes] = useState([]);
  const [vinculos, setVinculos] = useState([]);
  const [expandidos, setExpandidos] = useState({});
  const [erro, setErro] = useState(null);
  const inputRef = useRef();

  const handleArquivo = (e) => {
    const file = e.target.files?.[0];
    if (file) setArquivo(file);
  };

  const processarBoletim = async () => {
    if (!arquivo) return;
    setCarregando(true);
    setErro(null);

    try {
      let texto = '';
      if (arquivo.type === 'application/pdf') {
        texto = await lerPDF(arquivo);
      } else {
        texto = await arquivo.text();
      }
      setTextoBG(texto);

      // Carrega publicações aguardando publicação
      const [pubs, registros] = await Promise.all([
        base44.entities.PublicacaoExOfficio.filter({ status: 'Aguardando Publicação' }),
        base44.entities.RegistroLivro.filter({ status: 'Aguardando Publicação' }),
      ]);

      const todasPubs = [
        ...pubs.map(p => ({ ...p, _origem: 'PublicacaoExOfficio' })),
        ...registros.map(r => ({ ...r, _origem: 'RegistroLivro' })),
      ];

      setPublicacoes(todasPubs);

      // Extrai notas do BG
      const notasBG = extrairNotasDoBoletim(texto);

      // Compara cada publicação com as notas do BG
      const resultados = todasPubs.map(pub => {
        const textoPub = pub.nota_para_bg || pub.texto_publicacao || pub.titulo || '';
        let melhorMatch = { percentage: 0, classification: 'Baixa', notaIdx: -1 };

        notasBG.forEach((nota, idx) => {
          const match = calculateTextMatchingPercentage(textoPub, nota);
          if (match.percentage > melhorMatch.percentage) {
            melhorMatch = { ...match, notaIdx: idx };
          }
        });

        return {
          publicacao: pub,
          match: melhorMatch,
          notaBG: melhorMatch.notaIdx >= 0 ? notasBG[melhorMatch.notaIdx] : null,
          status: melhorMatch.percentage >= 70 ? 'confirmado' : melhorMatch.percentage >= 40 ? 'revisar' : 'nao_encontrado',
        };
      });

      setVinculos(resultados);
      setEtapa(3);
    } catch (err) {
      setErro('Erro ao processar o boletim: ' + err.message);
    } finally {
      setCarregando(false);
    }
  };

  const confirmarPublicacao = async (vinculo) => {
    const { publicacao } = vinculo;
    const entity = publicacao._origem === 'PublicacaoExOfficio'
      ? base44.entities.PublicacaoExOfficio
      : base44.entities.RegistroLivro;

    await entity.update(publicacao.id, { status: 'Publicado' });
    setVinculos(prev => prev.map(v =>
      v.publicacao.id === publicacao.id ? { ...v, confirmado: true } : v
    ));
  };

  const toggleExpandido = (id) => {
    setExpandidos(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const countByStatus = (status) => vinculos.filter(v => v.status === status).length;
  const confirmados = vinculos.filter(v => v.confirmado).length;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 bg-blue-100 rounded-xl">
            <ArrowLeftRight className="w-6 h-6 text-blue-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Conciliação com Boletim</h1>
            <p className="text-slate-500 text-sm">Verifique quais publicações constam no Boletim Geral</p>
          </div>
        </div>

        {/* Etapa 1: Upload */}
        {etapa === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Etapa 1 — Enviar Boletim Geral</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-slate-600 text-sm">
                Faça upload do arquivo PDF ou TXT do Boletim Geral para iniciar a conciliação automática das publicações pendentes.
              </p>
              <div
                className="border-2 border-dashed border-slate-300 rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all"
                onClick={() => inputRef.current?.click()}
              >
                <Upload className="w-10 h-10 text-slate-400" />
                <p className="text-slate-600 font-medium">
                  {arquivo ? arquivo.name : 'Clique para selecionar o Boletim (PDF ou TXT)'}
                </p>
                {arquivo && <p className="text-xs text-slate-400">{(arquivo.size / 1024).toFixed(1)} KB</p>}
                <input ref={inputRef} type="file" accept=".pdf,.txt" className="hidden" onChange={handleArquivo} />
              </div>

              {erro && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg text-sm">
                  <AlertCircle className="w-4 h-4" /> {erro}
                </div>
              )}

              <Button
                className="w-full"
                disabled={!arquivo || carregando}
                onClick={processarBoletim}
              >
                {carregando ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Processando...</>
                ) : (
                  <><ArrowLeftRight className="w-4 h-4" /> Iniciar Conciliação</>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Etapa 3: Resultado */}
        {etapa === 3 && (
          <div className="space-y-6">
            {/* Resumo */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total analisadas', value: vinculos.length, color: 'bg-blue-50 text-blue-700' },
                { label: 'Encontradas', value: countByStatus('confirmado'), color: 'bg-green-50 text-green-700' },
                { label: 'Revisar', value: countByStatus('revisar'), color: 'bg-yellow-50 text-yellow-700' },
                { label: 'Não encontradas', value: countByStatus('nao_encontrado'), color: 'bg-red-50 text-red-700' },
              ].map(({ label, value, color }) => (
                <Card key={label} className={`${color} border-0`}>
                  <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold">{value}</p>
                    <p className="text-xs mt-1 opacity-80">{label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {confirmados > 0 && (
              <div className="flex items-center gap-2 text-green-700 bg-green-50 p-3 rounded-lg text-sm">
                <CheckCircle2 className="w-4 h-4" />
                {confirmados} publicação(ões) confirmada(s) como publicada(s).
              </div>
            )}

            {/* Lista de vínculos */}
            <div className="space-y-3">
              {vinculos.map((v) => {
                const { publicacao, match, notaBG, status, confirmado } = v;
                const id = publicacao.id;
                const exp = expandidos[id];

                const statusConfig = {
                  confirmado: { label: 'Encontrada', color: 'bg-green-100 text-green-700', icon: <CheckCircle2 className="w-4 h-4" /> },
                  revisar: { label: 'Revisar', color: 'bg-yellow-100 text-yellow-700', icon: <AlertCircle className="w-4 h-4" /> },
                  nao_encontrado: { label: 'Não encontrada', color: 'bg-red-100 text-red-700', icon: <XCircle className="w-4 h-4" /> },
                }[status];

                return (
                  <Card key={id} className={confirmado ? 'opacity-60' : ''}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <FileText className="w-5 h-5 text-slate-400 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="font-medium text-slate-800 text-sm truncate">
                              {publicacao.tipo || publicacao.tipo_registro} — {publicacao.militar_nome || 'Geral'}
                            </span>
                            <Badge className={`${statusConfig.color} flex items-center gap-1 text-xs border-0`}>
                              {statusConfig.icon} {statusConfig.label}
                            </Badge>
                            {confirmado && (
                              <Badge className="bg-green-100 text-green-700 border-0 text-xs">✓ Confirmado</Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-2 mt-2">
                            <Progress value={match.percentage} className="h-1.5 flex-1" />
                            <span className="text-xs text-slate-500 shrink-0">{match.percentage}% similaridade</span>
                          </div>

                          <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                            {publicacao.nota_para_bg || publicacao.texto_publicacao || '(sem nota gerada)'}
                          </p>

                          <div className="flex items-center gap-2 mt-3">
                            <button
                              className="text-xs text-blue-600 flex items-center gap-1 hover:underline"
                              onClick={() => toggleExpandido(id)}
                            >
                              <Eye className="w-3 h-3" />
                              {exp ? 'Ocultar' : 'Ver'} comparação
                              {exp ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>

                            {!confirmado && (status === 'confirmado' || status === 'revisar') && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-7 ml-auto"
                                onClick={() => confirmarPublicacao(v)}
                              >
                                <CheckCircle2 className="w-3 h-3 mr-1" /> Confirmar como publicada
                              </Button>
                            )}
                          </div>

                          {exp && (
                            <div className="mt-3 grid md:grid-cols-2 gap-3">
                              <div className="bg-slate-50 rounded-lg p-3">
                                <p className="text-xs font-semibold text-slate-500 mb-1">Nota do sistema</p>
                                <p className="text-xs text-slate-700 whitespace-pre-wrap">
                                  {publicacao.nota_para_bg || publicacao.texto_publicacao || '(sem nota)'}
                                </p>
                              </div>
                              <div className="bg-blue-50 rounded-lg p-3">
                                <p className="text-xs font-semibold text-blue-500 mb-1">Trecho no BG</p>
                                <p className="text-xs text-slate-700 whitespace-pre-wrap">
                                  {notaBG || '(nenhum trecho correspondente encontrado)'}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <Button variant="outline" onClick={() => { setEtapa(1); setArquivo(null); setVinculos([]); setExpandidos({}); }}>
              ← Nova Conciliação
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}