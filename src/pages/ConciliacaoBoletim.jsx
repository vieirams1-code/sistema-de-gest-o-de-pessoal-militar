import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ArrowLeftRight, FileSearch, Link2, Unlink2 } from 'lucide-react';

const PDFJS_CDN_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs';
const PDFJS_WORKER_CDN_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';

let pdfJsLibPromise;

async function carregarPdfJs() {
  if (!pdfJsLibPromise) {
    pdfJsLibPromise = import(/* @vite-ignore */ PDFJS_CDN_URL).then((mod) => {
      mod.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_CDN_URL;
      return mod;
    });
  }

  return pdfJsLibPromise;
}

function calcStatus(registro) {
  if (registro.numero_bg && registro.data_bg) return 'Publicado';
  if (registro.nota_para_bg) return 'Aguardando Publicação';
  return 'Aguardando Nota';
}

function detectarOrigemTipo(registro) {
  if (registro.tipo && !registro.tipo_registro && !registro.medico && !registro.cid_10) return 'ex-officio';
  if (registro.medico || registro.cid_10) return 'atestado';
  return 'livro';
}

function TextoExpansivel({ texto = '', textoVazio = 'Sem conteúdo para exibir.' }) {
  const [expandido, setExpandido] = useState(false);
  const textoFinal = texto?.trim() || textoVazio;
  const podeExpandir = textoFinal.length > 170;

  return (
    <div className="space-y-1">
      <p
        className="text-xs text-slate-600"
        style={expandido ? undefined : {
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {textoFinal}
      </p>
      {podeExpandir ? (
        <button
          type="button"
          onClick={() => setExpandido((prev) => !prev)}
          className="text-[11px] font-medium text-blue-700 hover:underline"
        >
          {expandido ? 'Ver menos' : 'Ver mais'}
        </button>
      ) : null}
    </div>
  );
}

function getReferenciaPrincipal(registro) {
  return (
    registro.militar_nome ||
    registro.nome_completo ||
    registro.nome_guerra ||
    registro.titulo ||
    registro.tipo_registro ||
    registro.tipo ||
    'Publicação'
  );
}

function normalizarNota(valor = '') {
  return valor.toString().replace(/[^\d]/g, '').trim();
}

function normalizarTextoExtraido(texto = '') {
  return texto
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ')
    .replace(/[\uFFFD]/g, ' ')
    .replace(/\r/g, '\n')
    .replace(/\s+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

function textoPareceEstrutural(linha) {
  if (!linha) return true;
  const limpo = linha.trim();
  if (!limpo) return true;

  const semEspacos = limpo.replace(/\s+/g, '');
  const proporcaoDigitos = (semEspacos.match(/\d/g) || []).length / Math.max(semEspacos.length, 1);
  const proporcaoSimbolos = (semEspacos.match(/[^\p{L}\d]/gu) || []).length / Math.max(semEspacos.length, 1);

  if (/^\d{1,12}$/.test(semEspacos) && semEspacos.startsWith('0')) return true;
  if (/^[0\-_.]{4,}$/.test(semEspacos)) return true;
  if (proporcaoDigitos > 0.85 && !/[\p{L}]/u.test(semEspacos)) return true;
  if (proporcaoSimbolos > 0.5 && !/[\p{L}]/u.test(semEspacos)) return true;

  return false;
}

function notaValida(notaNorm) {
  if (!notaNorm) return false;
  if (!/^\d{4,8}$/.test(notaNorm)) return false;
  if (notaNorm.startsWith('0')) return false;
  if (/^(\d)\1{3,}$/.test(notaNorm)) return false;
  return true;
}

function extrairNotasDoTexto(textoPagina, pagina) {
  if (!textoPagina?.length) return [];

  const texto = normalizarTextoExtraido(textoPagina);
  const linhas = texto
    .split(/\n+/)
    .flatMap((linha) => linha.split(/(?<=[.;:])\s+(?=NOTA\s+N)/gi))
    .map((linha) => linha.replace(/\s+/g, ' ').trim())
    .filter((linha) => linha && !textoPareceEstrutural(linha));

  const regexContextual = /\bNOTA\s+N(?:\.|º|°)?\s*[:\-]?\s*([1-9]\d{3,7})\b/gi;
  const encontrados = [];
  const vistos = new Set();

  for (const linha of linhas) {
    const notasContextuais = [...linha.matchAll(regexContextual)];

    for (const match of notasContextuais) {
      const candidato = match[1];
      const notaNorm = normalizarNota(candidato);
      if (!notaValida(notaNorm)) continue;
      if (notaNorm === '00000') continue;

      const inicioMatch = Math.max((match.index || 0) - 55, 0);
      const finalMatch = Math.min((match.index || 0) + match[0].length + 55, linha.length);
      const contextoCru = linha.slice(inicioMatch, finalMatch).replace(/\s+/g, ' ').trim();
      const contexto = contextoCru.length > 170 ? `${contextoCru.slice(0, 170)}...` : contextoCru;

      const key = `${notaNorm}-${contexto.slice(0, 80)}`;
      if (vistos.has(key)) continue;

      vistos.add(key);
      encontrados.push({
        id: key,
        nota: notaNorm,
        nota_normalizada: notaNorm,
        contexto,
        pagina,
      });
    }
  }

  return encontrados;
}

async function extrairTextoPorPagina(file) {
  const pdfJs = await carregarPdfJs();
  const buffer = await file.arrayBuffer();
  const loadingTask = pdfJs.getDocument({ data: buffer, useWorkerFetch: false });
  const pdf = await loadingTask.promise;
  const paginas = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    const itensOrdenados = [...content.items].sort((a, b) => {
      const yA = a.transform?.[5] || 0;
      const yB = b.transform?.[5] || 0;
      if (Math.abs(yB - yA) > 2) return yB - yA;
      const xA = a.transform?.[4] || 0;
      const xB = b.transform?.[4] || 0;
      return xA - xB;
    });

    let ultimoY = null;
    let textoPagina = '';

    for (const item of itensOrdenados) {
      const textoItem = item.str || '';
      const x = item.transform?.[4] || 0;
      const y = item.transform?.[5] || 0;
      const quebraLinha = ultimoY !== null && Math.abs(y - ultimoY) > 2;

      if (quebraLinha) {
        textoPagina += '\n';
      } else if (textoPagina && x > 0) {
        textoPagina += ' ';
      }

      textoPagina += textoItem;
      ultimoY = y;
    }

    paginas.push({ pagina: pageNum, texto: normalizarTextoExtraido(textoPagina) });
  }

  return paginas;
}

async function extrairNotasPdf(file) {
  const paginas = await extrairTextoPorPagina(file);
  const notas = paginas.flatMap(({ pagina, texto }) => extrairNotasDoTexto(texto, pagina));

  const porNota = new Map();
  for (const nota of notas) {
    if (!porNota.has(nota.nota_normalizada)) {
      porNota.set(nota.nota_normalizada, nota);
    }
  }

  return Array.from(porNota.values());
}

export default function ConciliacaoBoletim() {
  const queryClient = useQueryClient();
  const [numeroBoletim, setNumeroBoletim] = useState('');
  const [dataBoletim, setDataBoletim] = useState('');
  const [arquivoPdf, setArquivoPdf] = useState(null);
  const [notasEncontradas, setNotasEncontradas] = useState([]);
  const [vinculos, setVinculos] = useState({});
  const [processandoPdf, setProcessandoPdf] = useState(false);
  const [erroProcessamento, setErroProcessamento] = useState('');
  const [mensagemProcessamento, setMensagemProcessamento] = useState('');
  const [conciliacaoIniciada, setConciliacaoIniciada] = useState(false);
  const [vinculosRemovidos, setVinculosRemovidos] = useState({});
  const [desvinculosManuais, setDesvinculosManuais] = useState([]);

  const { data: registrosLivro = [] } = useQuery({
    queryKey: ['conciliacao-registros-livro'],
    queryFn: () => base44.entities.RegistroLivro.list('-created_date'),
  });

  const { data: publicacoesExOfficio = [] } = useQuery({
    queryKey: ['conciliacao-publicacoes-ex-officio'],
    queryFn: () => base44.entities.PublicacaoExOfficio.list('-created_date'),
  });

  const { data: atestados = [] } = useQuery({
    queryKey: ['conciliacao-atestados-publicacao'],
    queryFn: async () => {
      const all = await base44.entities.Atestado.list('-created_date');
      return all.filter((a) => a.nota_para_bg || a.numero_bg);
    },
  });

  const pendentes = useMemo(() => {
    return [...registrosLivro, ...publicacoesExOfficio, ...atestados]
      .map((registro) => ({
        ...registro,
        origem_tipo: detectarOrigemTipo(registro),
        status_calculado: calcStatus(registro),
        nota_normalizada: normalizarNota(registro.nota_para_bg),
      }))
      .filter((registro) => registro.status_calculado === 'Aguardando Publicação' && registro.nota_para_bg)
      .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
  }, [registrosLivro, publicacoesExOfficio, atestados]);

  const conciliacaoAutomatica = useMemo(() => {
    if (!conciliacaoIniciada || !pendentes.length || !notasEncontradas.length) return {};
    const mapaNotas = new Map(notasEncontradas.map((nota) => [nota.nota_normalizada, nota.id]));
    const auto = {};

    for (const pub of pendentes) {
      if (mapaNotas.has(pub.nota_normalizada)) {
        auto[pub.id] = mapaNotas.get(pub.nota_normalizada);
      }
    }
    return auto;
  }, [conciliacaoIniciada, pendentes, notasEncontradas]);

  const vinculosEfetivos = useMemo(() => {
    const combinados = { ...conciliacaoAutomatica };

    Object.keys(vinculosRemovidos).forEach((pubId) => {
      if (vinculosRemovidos[pubId]) {
        delete combinados[pubId];
      }
    });

    Object.entries(vinculos).forEach(([pubId, notaId]) => {
      if (notaId) {
        combinados[pubId] = notaId;
      } else {
        delete combinados[pubId];
      }
    });

    return combinados;
  }, [conciliacaoAutomatica, vinculos, vinculosRemovidos]);

  const notasConciliadasIds = useMemo(() => new Set(Object.values(vinculosEfetivos)), [vinculosEfetivos]);

  const pendentesSemCorrespondencia = pendentes.filter((pub) => !vinculosEfetivos[pub.id]);
  const publicacoesConciliadas = pendentes.filter((pub) => !!vinculosEfetivos[pub.id]);
  const notasSemItem = notasEncontradas.filter((nota) => !notasConciliadasIds.has(nota.id));

  const confirmarMutation = useMutation({
    mutationFn: async () => {
      const updates = publicacoesConciliadas.map((pub) => {
        const payloadBase = {
          numero_bg: numeroBoletim,
          data_bg: dataBoletim,
        };

        if (pub.origem_tipo === 'atestado') {
          return base44.entities.Atestado.update(pub.id, { ...payloadBase, status_publicacao: 'Publicado' });
        }

        if (pub.origem_tipo === 'ex-officio') {
          return base44.entities.PublicacaoExOfficio.update(pub.id, { ...payloadBase, status: 'Publicado' });
        }

        return base44.entities.RegistroLivro.update(pub.id, { ...payloadBase, status: 'Publicado' });
      });

      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conciliacao-registros-livro'] });
      queryClient.invalidateQueries({ queryKey: ['conciliacao-publicacoes-ex-officio'] });
      queryClient.invalidateQueries({ queryKey: ['conciliacao-atestados-publicacao'] });
      queryClient.invalidateQueries({ queryKey: ['publicacoes-ex-officio'] });
      queryClient.invalidateQueries({ queryKey: ['registros-livro'] });
      queryClient.invalidateQueries({ queryKey: ['atestados-publicacao'] });
    },
  });

  const processarBoletim = async () => {
    setErroProcessamento('');
    setMensagemProcessamento('');

    if (!arquivoPdf) {
      setErroProcessamento('Selecione um arquivo PDF antes de buscar notas.');
      return;
    }

    setProcessandoPdf(true);
    try {
      const notas = await extrairNotasPdf(arquivoPdf);
      setNotasEncontradas(notas);
      setVinculos({});
      setVinculosRemovidos({});
      setDesvinculosManuais([]);
      setConciliacaoIniciada(false);

      if (notas.length === 0) {
        setMensagemProcessamento('PDF processado, mas nenhuma nota válida foi identificada.');
      } else {
        setMensagemProcessamento(`${notas.length} nota(s) encontrada(s) no PDF e carregada(s) para conciliação.`);
      }
    } catch (error) {
      setErroProcessamento(error?.message || 'Não foi possível processar o PDF enviado. Verifique o arquivo e tente novamente.');
      setNotasEncontradas([]);
      setVinculos({});
      setVinculosRemovidos({});
      setDesvinculosManuais([]);
      setConciliacaoIniciada(false);
    } finally {
      setProcessandoPdf(false);
    }
  };

  const handleVinculoManual = (pubId, notaId) => {
    if (!notaId) {
      setVinculos((prev) => ({ ...prev, [pubId]: '' }));
      setVinculosRemovidos((prev) => ({ ...prev, [pubId]: true }));
      return;
    }

    setVinculos((prev) => ({ ...prev, [pubId]: notaId }));
    setVinculosRemovidos((prev) => ({ ...prev, [pubId]: false }));
  };

  const iniciarConciliacao = () => {
    setConciliacaoIniciada(true);
  };

  const removerVinculo = (pub) => {
    const notaId = vinculosEfetivos[pub.id];
    if (!notaId) return;

    setVinculos((prev) => ({ ...prev, [pub.id]: '' }));
    setVinculosRemovidos((prev) => ({ ...prev, [pub.id]: true }));
    setDesvinculosManuais((prev) => ([
      {
        pubId: pub.id,
        referencia: getReferenciaPrincipal(pub),
        notaSistema: pub.nota_para_bg,
        notaBoletim: notasEncontradas.find((nota) => nota.id === notaId)?.nota || '-',
      },
      ...prev.filter((item) => item.pubId !== pub.id),
    ]));
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-[#1e3a5f]">Conciliação com Boletim</CardTitle>
          <p className="text-sm font-semibold text-blue-700">Conciliação Boletim v1.4</p>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div>
            <Label>Número do boletim</Label>
            <Input value={numeroBoletim} onChange={(e) => setNumeroBoletim(e.target.value)} placeholder="Ex: 045" />
          </div>
          <div>
            <Label>Data do boletim</Label>
            <Input type="date" value={dataBoletim} onChange={(e) => setDataBoletim(e.target.value)} />
          </div>
          <div>
            <Label>Upload do PDF</Label>
            <Input type="file" accept="application/pdf" onChange={(e) => setArquivoPdf(e.target.files?.[0] || null)} />
          </div>
          <div className="flex items-end">
            <Button type="button" onClick={processarBoletim} disabled={processandoPdf} className="w-full">
              <FileSearch className="w-4 h-4 mr-2" />
              {processandoPdf ? 'Lendo boletim...' : 'Etapa 1: Ler boletim'}
            </Button>
          </div>
        </CardContent>
        <div className="px-6 pb-4 space-y-2">
          {processandoPdf && <p className="text-xs text-blue-600 font-medium">Processando PDF para buscar notas...</p>}
          {erroProcessamento && <p className="text-xs text-red-600 font-medium">{erroProcessamento}</p>}
          {!erroProcessamento && mensagemProcessamento && <p className="text-xs text-emerald-700 font-medium">{mensagemProcessamento}</p>}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Etapa 2 — Conciliação</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1 text-sm text-slate-600">
            <p>1) Faça a leitura do PDF na Etapa 1.</p>
            <p>2) Inicie a conciliação para aplicar os vínculos automáticos e revisar manualmente.</p>
          </div>
          <Button type="button" onClick={iniciarConciliacao} disabled={notasEncontradas.length === 0 || conciliacaoIniciada}>
            {conciliacaoIniciada ? 'Conciliação iniciada' : 'Iniciar conciliação'}
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-base">Publicações pendentes (sistema)</CardTitle></CardHeader>
          <CardContent className="space-y-3 max-h-[520px] overflow-auto">
            {!conciliacaoIniciada ? <p className="text-sm text-slate-500">Inicie a Etapa 2 para conciliar.</p> : null}
            {pendentes.map((pub) => (
              <div key={pub.id} className="rounded-lg border p-3 bg-white space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline">Nota {pub.nota_para_bg}</Badge>
                  {vinculosRemovidos[pub.id] ? (
                    <Badge className="bg-rose-100 text-rose-700">Desvinculada manualmente</Badge>
                  ) : (
                    <Badge className="bg-blue-100 text-blue-700">{pub.status_calculado}</Badge>
                  )}
                </div>
                <p className="text-sm font-medium text-slate-800">{getReferenciaPrincipal(pub)}</p>
                <TextoExpansivel texto={(pub.texto_publicacao || pub.texto || '').replace(/\s+/g, ' ').trim() || 'Sem texto de publicação'} />
                <div>
                  <Label className="text-xs">Vincular nota encontrada</Label>
                  <select
                    className="w-full mt-1 border rounded-md h-9 px-2 text-sm"
                    value={vinculosEfetivos[pub.id] || ''}
                    onChange={(e) => handleVinculoManual(pub.id, e.target.value)}
                    disabled={!conciliacaoIniciada}
                  >
                    <option value="">Sem vínculo</option>
                    {notasEncontradas.map((nota) => (
                      <option key={nota.id} value={nota.id}>Nota {nota.nota}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><ArrowLeftRight className="w-4 h-4" />Vínculos</CardTitle></CardHeader>
          <CardContent className="space-y-3 max-h-[520px] overflow-auto">
            {publicacoesConciliadas.length === 0 && <p className="text-sm text-slate-500">Nenhum vínculo criado.</p>}
            {publicacoesConciliadas.map((pub) => {
              const nota = notasEncontradas.find((n) => n.id === vinculosEfetivos[pub.id]);
              const automatico = conciliacaoAutomatica[pub.id] === vinculosEfetivos[pub.id];
              return (
                <div key={pub.id} className="rounded-lg border p-3 space-y-2 bg-slate-50">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Nota sistema {pub.nota_para_bg}</span>
                  {automatico ? (
                      <Badge className="bg-emerald-100 text-emerald-700"><Link2 className="w-3 h-3 mr-1" />Automática</Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-700"><Unlink2 className="w-3 h-3 mr-1" />Manual</Badge>
                  )}
                </div>
                <p className="text-xs text-slate-600">↔ Nota no boletim: {nota?.nota || '-'}</p>
                <TextoExpansivel texto={`Sistema: ${getReferenciaPrincipal(pub)} — ${(pub.texto_publicacao || pub.texto || '').replace(/\s+/g, ' ').trim() || 'Sem texto de publicação'}`} />
                <TextoExpansivel texto={`Boletim: ${nota?.contexto || 'Sem contexto identificado.'}`} />
                <div className="flex justify-end">
                  <Button type="button" variant="outline" size="sm" onClick={() => removerVinculo(pub)}>
                    Remover vínculo
                  </Button>
                </div>
              </div>
            );
          })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Notas encontradas no boletim</CardTitle></CardHeader>
          <CardContent className="space-y-3 max-h-[520px] overflow-auto">
            {notasEncontradas.map((nota) => (
              <div key={nota.id} className="rounded-lg border p-3 bg-white space-y-1">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">Nota {nota.nota}</Badge>
                  {notasConciliadasIds.has(nota.id) ? (
                    <Badge className="bg-emerald-100 text-emerald-700">Conciliada</Badge>
                  ) : (
                    <Badge className="bg-amber-100 text-amber-700">Sem vínculo</Badge>
                  )}
                </div>
                <TextoExpansivel texto={nota.contexto} />
                {nota.pagina ? <p className="text-[11px] text-slate-500">Página: {nota.pagina}</p> : null}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {desvinculosManuais.length > 0 ? (
        <Card>
          <CardHeader><CardTitle className="text-sm">Auditoria de desvínculos manuais</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {desvinculosManuais.map((evento) => (
              <div key={evento.pubId} className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                Publicação "{evento.referencia}" (nota sistema {evento.notaSistema}) desvinculada da nota {evento.notaBoletim} do boletim.
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-sm">Conciliadas automaticamente</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-emerald-700">{publicacoesConciliadas.filter((p) => conciliacaoAutomatica[p.id]).length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Pendentes sem correspondência</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-amber-700">{pendentesSemCorrespondencia.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Encontradas sem item no sistema</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-blue-700">{notasSemItem.length}</p></CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={() => confirmarMutation.mutate()}
          disabled={!numeroBoletim || !dataBoletim || publicacoesConciliadas.length === 0 || confirmarMutation.isPending}
        >
          {confirmarMutation.isPending ? 'Confirmando...' : 'Confirmar conciliação e publicar'}
        </Button>
      </div>
    </div>
  );
}
