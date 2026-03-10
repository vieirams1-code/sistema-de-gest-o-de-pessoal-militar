import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ArrowLeftRight, FileSearch, Link2, Unlink2 } from 'lucide-react';

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

function resumirTexto(texto = '') {
  const limpo = texto.replace(/\s+/g, ' ').trim();
  if (!limpo) return 'Sem texto de publicação';
  return limpo.length > 110 ? `${limpo.slice(0, 110)}...` : limpo;
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

function extrairTextoLegivel(raw) {
  return raw
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ')
    .replace(/[\uFFFD]/g, ' ')
    .replace(/\(([^)]{0,180})\)\s*Tj/g, ' $1\n')
    .replace(/\[(.*?)\]\s*TJ/gs, (_, bloco = '') => bloco.replace(/\(([^)]{0,180})\)/g, ' $1'))
    .replace(/\r/g, '\n')
    .replace(/\f/g, '\n')
    .replace(/[{}<>\[\]\\/]{2,}/g, ' ')
    .replace(/[^\p{L}\d\n.,:;\-º°()/ ]/gu, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/(NOTA\s+N(?:\.|º|°)?\s*\d{4,8})/gi, '\n$1\n')
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

function extrairNotasDoTexto(rawText) {
  if (!rawText?.length) return [];

  const texto = extrairTextoLegivel(rawText);
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
        pagina: null,
      });
    }
  }

  return encontrados;
}

async function extrairNotasPdf(file) {
  const buffer = await file.arrayBuffer();
  const latin = new TextDecoder('latin1').decode(buffer);
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
  const notas = [...extrairNotasDoTexto(latin), ...extrairNotasDoTexto(utf8)];

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
    if (!pendentes.length || !notasEncontradas.length) return {};
    const mapaNotas = new Map(notasEncontradas.map((nota) => [nota.nota_normalizada, nota.id]));
    const auto = {};

    for (const pub of pendentes) {
      if (mapaNotas.has(pub.nota_normalizada)) {
        auto[pub.id] = mapaNotas.get(pub.nota_normalizada);
      }
    }
    return auto;
  }, [pendentes, notasEncontradas]);

  const vinculosEfetivos = useMemo(() => ({ ...conciliacaoAutomatica, ...vinculos }), [conciliacaoAutomatica, vinculos]);

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

      if (notas.length === 0) {
        setMensagemProcessamento('PDF processado, mas nenhuma nota válida foi identificada.');
      } else {
        setMensagemProcessamento(`${notas.length} nota(s) encontrada(s) no PDF e carregada(s) para conciliação.`);
      }
    } catch (error) {
      setErroProcessamento(error?.message || 'Não foi possível processar o PDF enviado. Verifique o arquivo e tente novamente.');
      setNotasEncontradas([]);
      setVinculos({});
    } finally {
      setProcessandoPdf(false);
    }
  };

  const handleVinculoManual = (pubId, notaId) => {
    setVinculos((prev) => ({ ...prev, [pubId]: notaId }));
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-[#1e3a5f]">Conciliação com Boletim</CardTitle>
          <p className="text-sm font-semibold text-blue-700">Conciliação Boletim v1.2</p>
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
              {processandoPdf ? 'Processando...' : 'Buscar notas'}
            </Button>
          </div>
        </CardContent>
        <div className="px-6 pb-4 space-y-2">
          {processandoPdf && <p className="text-xs text-blue-600 font-medium">Processando PDF para buscar notas...</p>}
          {erroProcessamento && <p className="text-xs text-red-600 font-medium">{erroProcessamento}</p>}
          {!erroProcessamento && mensagemProcessamento && <p className="text-xs text-emerald-700 font-medium">{mensagemProcessamento}</p>}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-base">Publicações pendentes (sistema)</CardTitle></CardHeader>
          <CardContent className="space-y-3 max-h-[520px] overflow-auto">
            {pendentes.map((pub) => (
              <div key={pub.id} className="rounded-lg border p-3 bg-white space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline">Nota {pub.nota_para_bg}</Badge>
                  <Badge className="bg-blue-100 text-blue-700">{pub.status_calculado}</Badge>
                </div>
                <p className="text-sm font-medium text-slate-800">{getReferenciaPrincipal(pub)}</p>
                <p className="text-xs text-slate-600">{resumirTexto(pub.texto_publicacao || pub.texto || '')}</p>
                <div>
                  <Label className="text-xs">Vincular nota encontrada</Label>
                  <select
                    className="w-full mt-1 border rounded-md h-9 px-2 text-sm"
                    value={vinculosEfetivos[pub.id] || ''}
                    onChange={(e) => handleVinculoManual(pub.id, e.target.value)}
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
                <p className="text-xs text-slate-600">{nota.contexto}</p>
                {nota.pagina ? <p className="text-[11px] text-slate-500">Página: {nota.pagina}</p> : null}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

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
