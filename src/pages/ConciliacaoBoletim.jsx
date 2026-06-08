import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ArrowLeftRight, FileSearch, Link2, Unlink2 } from 'lucide-react';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import { fetchScopedFeriasBundle } from '@/services/getScopedFeriasBundleClient';
import { atualizarEscopado } from '@/services/cudEscopadoClient';
import { listarAtestadosPublicacaoEscopo, listarPublicacoesExOfficioEscopo } from '@/services/publicacoesPainelService';

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

function obterTrechosComDestaque(texto, termosRelevantes = []) {
  if (!texto?.trim() || !termosRelevantes.length) {
    return [{ texto, destaque: false }];
  }

  const baseTermos = [...new Set(termosRelevantes)]
    .filter((termo) => termo.length >= 4)
    .sort((a, b) => b.length - a.length)
    .slice(0, 16);

  if (!baseTermos.length) {
    return [{ texto, destaque: false }];
  }

  const termosSet = new Set(baseTermos.map((t) => t.toLowerCase()));
  const regex = new RegExp(`(${baseTermos.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');

  return texto.split(regex).filter(Boolean).map((parte) => ({
    texto: parte,
    destaque: termosSet.has(parte.toLowerCase()),
  }));
}

function TextoExpansivel({ texto = '', textoVazio = 'Sem conteúdo para exibir.', termosRelevantes = [] }) {
  const [expandido, setExpandido] = useState(false);
  const textoFinal = texto?.trim() || textoVazio;
  const podeExpandir = textoFinal.length > 170;
  const partes = obterTrechosComDestaque(textoFinal, termosRelevantes);

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
        {partes.map((parte, index) => (
          <span
            key={`${parte.texto}-${index}`}
            className={parte.destaque ? 'bg-yellow-200/80 px-0.5 rounded-sm' : ''}
          >
            {parte.texto}
          </span>
        ))}
      </p>
      {podeExpandir ? (
        <button
          type="button"
          onClick={() => setExpandido((prev) => !prev)}
          className="text-[11px] font-medium text-blue-700 hover:underline"
        >
          {expandido ? 'Ver menos' : 'Ver texto completo'}
        </button>
      ) : null}
    </div>
  );
}

function obterTermosRelevantesComparacao(correspondencia) {
  const textoCombinado = `${correspondencia?.trechoComparadoSistema || ''} ${correspondencia?.trechoComparadoBoletim || ''}`;

  return [...new Set(
    normalizarTextoComparacao(textoCombinado)
      .split(' ')
      .filter((token) => token.length >= 4)
  )];
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
  const bruto = valor?.toString?.() || '';
  const limpo = bruto.replace(/\u00A0/g, ' ').trim();

  if (!limpo) return '';

  const matchContextual = limpo.match(/NOTA\s*N(?:\.|º|°)?\s*[:\-]?\s*([0-9]{1,8})/i);
  if (matchContextual?.[1]) {
    const semZeros = matchContextual[1].replace(/^0+/, '');
    if (semZeros.length >= 4 && semZeros.length <= 8) return semZeros;
  }

  const gruposNumericos = limpo.match(/\d{1,8}/g) || [];
  for (const grupo of gruposNumericos) {
    const semZeros = grupo.replace(/^0+/, '');
    if (semZeros.length >= 4 && semZeros.length <= 8) {
      return semZeros;
    }
  }

  return '';
}

function getNotaConciliadaPersistida(registro) {
  return normalizarNota(
    registro.nota_conciliada_boletim
    || registro.nota_boletim_vinculada
    || registro.nota_conciliada
    || ''
  );
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

function normalizarTextoComparacao(texto = '') {
  return (texto || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\x00-\x1F\x7F]/g, ' ')
    .replace(/\r/g, '\n')
    .replace(/[^\p{L}\p{N}\n ]/gu, ' ')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function calcularSimilaridadeDice(tokensA = [], tokensB = []) {
  if (!tokensA.length || !tokensB.length) return 0;

  const frequenciaA = new Map();
  const frequenciaB = new Map();

  tokensA.forEach((token) => frequenciaA.set(token, (frequenciaA.get(token) || 0) + 1));
  tokensB.forEach((token) => frequenciaB.set(token, (frequenciaB.get(token) || 0) + 1));

  let intersecao = 0;
  frequenciaA.forEach((countA, token) => {
    const countB = frequenciaB.get(token) || 0;
    intersecao += Math.min(countA, countB);
  });

  return (2 * intersecao) / (tokensA.length + tokensB.length);
}

function calcularCoberturaReferencia(tokensReferencia = [], tokensComparados = []) {
  if (!tokensReferencia.length || !tokensComparados.length) return 0;

  const frequenciaReferencia = new Map();
  const frequenciaComparados = new Map();

  tokensReferencia.forEach((token) => frequenciaReferencia.set(token, (frequenciaReferencia.get(token) || 0) + 1));
  tokensComparados.forEach((token) => frequenciaComparados.set(token, (frequenciaComparados.get(token) || 0) + 1));

  let termosCobertos = 0;
  frequenciaReferencia.forEach((countRef, token) => {
    const countComp = frequenciaComparados.get(token) || 0;
    termosCobertos += Math.min(countRef, countComp);
  });

  return termosCobertos / tokensReferencia.length;
}

function calcularPercentualTrechos(tokensSistema = [], tokensBoletim = []) {
  const coberturaPublicacao = calcularCoberturaReferencia(tokensSistema, tokensBoletim);
  const similaridadeDice = calcularSimilaridadeDice(tokensSistema, tokensBoletim);
  const combinado = (coberturaPublicacao * 0.75) + (similaridadeDice * 0.25);

  return Math.round(combinado * 100);
}

function classificarCorrespondencia(percentual) {
  if (percentual >= 80) {
    return { label: 'Alta correspondência', className: 'bg-emerald-100 text-emerald-700' };
  }

  if (percentual >= 55) {
    return { label: 'Média correspondência', className: 'bg-amber-100 text-amber-700' };
  }

  return { label: 'Baixa correspondência', className: 'bg-rose-100 text-rose-700' };
}

function calcularCorrespondenciaTextual(pub, nota) {
  const tokensSistema = pub?.tokens_sistema || normalizarTextoComparacao(pub?.texto_publicacao || pub?.texto || '').split(' ').filter(Boolean);
  const freqSistema = pub?.frequencia_sistema;
  const tokensBoletim = nota?.tokens_boletim || normalizarTextoComparacao(nota?.contexto || '').split(' ').filter(Boolean);

  const sistemaNormalizado = pub?.texto_normalizado_sistema || tokensSistema.join(' ');
  const boletimNormalizado = normalizarTextoComparacao(nota?.contexto || '');

  if (!tokensSistema.length || !tokensBoletim.length) {
    return {
      percentual: 0,
      trechoComparadoBoletim: boletimNormalizado,
      trechoComparadoSistema: sistemaNormalizado,
    };
  }

  if (boletimNormalizado.includes(sistemaNormalizado)) {
    return {
      percentual: 100,
      trechoComparadoBoletim: sistemaNormalizado,
      trechoComparadoSistema: sistemaNormalizado,
    };
  }

  const freqSistemaFinal = freqSistema || new Map();
  if (!freqSistema) {
    tokensSistema.forEach((t) => freqSistemaFinal.set(t, (freqSistemaFinal.get(t) || 0) + 1));
  }

  const n = tokensSistema.length;
  const m = tokensBoletim.length;

  const calcPercentual = (inter, janelaSize) => {
    const cobertura = inter / n;
    const dice = (2 * inter) / (n + janelaSize);
    return Math.round(((cobertura * 0.75) + (dice * 0.25)) * 100);
  };

  let intersecaoTotal = 0;
  const freqTotalBoletim = new Map();
  tokensBoletim.forEach((t) => {
    const count = (freqTotalBoletim.get(t) || 0) + 1;
    freqTotalBoletim.set(t, count);
    if (count <= (freqSistemaFinal.get(t) || 0)) {
      intersecaoTotal += 1;
    }
  });

  let melhorPercentual = calcPercentual(intersecaoTotal, m);
  let melhorTrecho = tokensBoletim.join(' ');

  const minJanela = Math.max(5, Math.floor(n * 0.6));
  const maxJanela = Math.min(m, Math.max(minJanela, Math.ceil(n * 1.4)));

  for (let janela = minJanela; janela <= maxJanela; janela += 1) {
    let intersecaoAtual = 0;
    const freqJanela = new Map();

    for (let i = 0; i < janela; i += 1) {
      const token = tokensBoletim[i];
      const countJanela = (freqJanela.get(token) || 0) + 1;
      freqJanela.set(token, countJanela);

      const countSistema = freqSistemaFinal.get(token) || 0;
      if (countJanela <= countSistema) {
        intersecaoAtual += 1;
      }
    }

    let p = calcPercentual(intersecaoAtual, janela);
    if (p > melhorPercentual) {
      melhorPercentual = p;
      melhorTrecho = tokensBoletim.slice(0, janela).join(' ');
    }

    for (let inicio = 1; inicio <= m - janela; inicio += 1) {
      const removido = tokensBoletim[inicio - 1];
      const countRemovido = freqJanela.get(removido);
      if (countRemovido <= (freqSistemaFinal.get(removido) || 0)) {
        intersecaoAtual -= 1;
      }
      freqJanela.set(removido, countRemovido - 1);

      const adicionado = tokensBoletim[inicio + janela - 1];
      const countAdicionado = (freqJanela.get(adicionado) || 0) + 1;
      freqJanela.set(adicionado, countAdicionado);
      if (countAdicionado <= (freqSistemaFinal.get(adicionado) || 0)) {
        intersecaoAtual += 1;
      }

      p = calcPercentual(intersecaoAtual, janela);
      if (p > melhorPercentual) {
        melhorPercentual = p;
        melhorTrecho = tokensBoletim.slice(inicio, inicio + janela).join(' ');
      }
    }
  }

  return {
    percentual: melhorPercentual,
    trechoComparadoBoletim: melhorTrecho,
    trechoComparadoSistema: sistemaNormalizado,
  };
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

function limparBlocoNota(texto = '') {
  return texto
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

function recortarBlocoComLimite(bloco = '', limite = 2200) {
  if (bloco.length <= limite) return bloco;

  const trecho = bloco.slice(0, limite);
  const corteNatural = Math.max(
    trecho.lastIndexOf('\nNOTA N'),
    trecho.lastIndexOf('. '),
    trecho.lastIndexOf('; '),
    trecho.lastIndexOf(': '),
    trecho.lastIndexOf('\n')
  );

  if (corteNatural > 500) {
    return trecho.slice(0, corteNatural).trim();
  }

  return trecho.trim();
}

function extrairBlocoNota(textoPagina = '', inicioNota = 0, proximoInicioNota = null) {
  if (!textoPagina) return '';

  const limiteMaximo = 2200;
  const limiteMinimoSemProximaNota = 900;
  const inicioSeguro = Math.max(0, inicioNota);

  let fim = proximoInicioNota ?? Math.min(textoPagina.length, inicioSeguro + limiteMaximo);

  if (!proximoInicioNota && (fim - inicioSeguro) < limiteMinimoSemProximaNota) {
    fim = Math.min(textoPagina.length, inicioSeguro + limiteMinimoSemProximaNota);
  }

  const blocoBruto = textoPagina.slice(inicioSeguro, fim);
  return recortarBlocoComLimite(limparBlocoNota(blocoBruto), limiteMaximo);
}

function extrairNotasDoTexto(textoPagina, pagina) {
  if (!textoPagina?.length) return [];

  const texto = normalizarTextoExtraido(textoPagina);
  const regexContextual = /\bNOTA\s+N(?:\.|º|°)?\s*[:\-]?\s*([1-9]\d{3,7})\b/gi;
  const encontrados = [];
  const vistos = new Set();
  const matches = [...texto.matchAll(regexContextual)];

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const candidato = match[1];
    const notaNorm = normalizarNota(candidato);
    if (!notaValida(notaNorm)) continue;
    if (notaNorm === '00000') continue;

    const inicioNota = match.index || 0;
    const proximaNota = matches[index + 1];
    const inicioProximaNota = proximaNota?.index ?? null;
    const contexto = extrairBlocoNota(texto, inicioNota, inicioProximaNota);

    if (!contexto || textoPareceEstrutural(contexto)) continue;

    const key = `${notaNorm}-${pagina}-${inicioNota}`;
    if (vistos.has(key)) continue;

    vistos.add(key);
    encontrados.push({
      id: key,
      nota: notaNorm,
      nota_normalizada: notaNorm,
      contexto,
      tokens_boletim: normalizarTextoComparacao(contexto).split(' ').filter(Boolean),
      pagina,
    });
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

function contarOcorrenciasNotasPendentes(pendentes = []) {
  const mapa = new Map();

  pendentes.forEach((pub) => {
    const nota = pub.nota_normalizada;
    if (!nota) return;
    mapa.set(nota, (mapa.get(nota) || 0) + 1);
  });

  return mapa;
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
  const [erroVinculo, setErroVinculo] = useState('');
  
  const { isAdmin, getMilitarScopeFilters, canAccessModule, isAccessResolved, isLoading: loadingUser } = useCurrentUser();
  const hasAccess = canAccessModule('conciliacao_boletim');

  const { data: registrosLivro = [], isLoading: isLoadingLivro } = useQuery({
    queryKey: ['conciliacao-registros-livro'],
    queryFn: async () => {
      if (isAdmin) return base44.entities.RegistroLivro.list('-created_date');
      const scopeFilters = getMilitarScopeFilters();
      if (!scopeFilters.length) return [];

      const bundle = await fetchScopedFeriasBundle();
      const m = new Map();
      (bundle?.registrosLivro || []).forEach((item) => {
        if (!item?.id) return;
        m.set(item.id, item);
      });
      return Array.from(m.values()).sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));
    },
    enabled: isAccessResolved && hasAccess
  });

  const { data: publicacoesExOfficio = [], isLoading: isLoadingExOfficio } = useQuery({
    queryKey: ['conciliacao-publicacoes-ex-officio'],
    queryFn: () => listarPublicacoesExOfficioEscopo({ isAdmin, getMilitarScopeFilters }),
    enabled: isAccessResolved && hasAccess
  });


  const { data: atestados = [], isLoading: isLoadingAtestados } = useQuery({
    queryKey: ['conciliacao-atestados-publicacao'],
    queryFn: () => listarAtestadosPublicacaoEscopo({ isAdmin, getMilitarScopeFilters }),
    enabled: isAccessResolved && hasAccess
  });

  const pendentesMap = useMemo(() => {
    const enriched = [...registrosLivro, ...publicacoesExOfficio, ...atestados]
      .map((registro) => {
        const textoSistema = (registro.texto_publicacao || registro.texto || '').trim();
        const textoNorm = normalizarTextoComparacao(textoSistema);
        const tokens = textoNorm.split(' ').filter(Boolean);
        const freq = new Map();
        tokens.forEach((t) => freq.set(t, (freq.get(t) || 0) + 1));

        return {
          ...registro,
          origem_tipo: detectarOrigemTipo(registro),
          status_calculado: calcStatus(registro),
          nota_normalizada: normalizarNota(registro.nota_para_bg),
          nota_conciliada_persistida: getNotaConciliadaPersistida(registro),
          texto_normalizado_sistema: textoNorm,
          tokens_sistema: tokens,
          frequencia_sistema: freq,
        };
      })
      .filter((registro) => registro.status_calculado === 'Aguardando Publicação' && registro.nota_para_bg);

    return new Map(enriched.map((p) => [p.id, p]));
  }, [registrosLivro, publicacoesExOfficio, atestados]);

  const pendentes = useMemo(() => {
    return Array.from(pendentesMap.values())
      .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
  }, [pendentesMap]);

  const ocorrenciasNotasPendentes = useMemo(() => contarOcorrenciasNotasPendentes(pendentes), [pendentes]);

  const notasDuplicadasNoSistema = useMemo(() => {
    return Array.from(ocorrenciasNotasPendentes.entries())
      .filter(([, quantidade]) => quantidade > 1)
      .map(([nota]) => nota);
  }, [ocorrenciasNotasPendentes]);

  const { mapaNotasById, mapaNotasByNumero } = useMemo(() => {
    const byId = new Map();
    const byNumero = new Map();

    notasEncontradas.forEach((n) => {
      byId.set(n.id, n);
      byNumero.set(n.nota_normalizada, n);
    });

    return { mapaNotasById: byId, mapaNotasByNumero: byNumero };
  }, [notasEncontradas]);

  const conciliacaoAutomatica = useMemo(() => {
    if (!conciliacaoIniciada || !pendentes.length || !mapaNotasByNumero.size) return {};

    const auto = {};

    for (const pub of pendentes) {
      if (!pub.nota_normalizada) continue;
      if ((ocorrenciasNotasPendentes.get(pub.nota_normalizada) || 0) !== 1) continue;
      const notaEncontrada = mapaNotasByNumero.get(pub.nota_normalizada);
      if (notaEncontrada) {
        auto[pub.id] = notaEncontrada.id;
      }
    }

    return auto;
  }, [conciliacaoIniciada, pendentes, mapaNotasByNumero, ocorrenciasNotasPendentes]);

  const vinculosPersistidos = useMemo(() => {
    if (!mapaNotasByNumero.size) return {};
    const resultado = {};

    for (const pub of pendentes) {
      if (!pub.nota_conciliada_persistida) continue;
      const notaEncontrada = mapaNotasByNumero.get(pub.nota_conciliada_persistida);
      if (notaEncontrada) {
        resultado[pub.id] = notaEncontrada.id;
      }
    }

    return resultado;
  }, [pendentes, mapaNotasByNumero]);

  const vinculosEfetivos = useMemo(() => {
    const combinados = { ...vinculosPersistidos, ...conciliacaoAutomatica };

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
  }, [conciliacaoAutomatica, vinculosPersistidos, vinculos, vinculosRemovidos]);

  const mapaVinculosInvertido = useMemo(() => {
    const mapa = new Map();
    Object.entries(vinculosEfetivos).forEach(([pubId, notaId]) => {
      if (!notaId) return;
      if (!mapa.has(notaId)) mapa.set(notaId, []);
      mapa.get(notaId).push(pubId);
    });
    return mapa;
  }, [vinculosEfetivos]);

  const notasConciliadasIds = useMemo(() => new Set(mapaVinculosInvertido.keys()), [mapaVinculosInvertido]);

  useEffect(() => {
    const idsAtivos = new Set(pendentes.map((item) => item.id));

    setVinculos((atual) => {
      const entries = Object.entries(atual);
      const filtrados = Object.fromEntries(entries.filter(([id]) => idsAtivos.has(id)));
      return Object.keys(filtrados).length === entries.length ? atual : filtrados;
    });

    setVinculosRemovidos((atual) => {
      const entries = Object.entries(atual);
      const filtrados = Object.fromEntries(entries.filter(([id]) => idsAtivos.has(id)));
      return Object.keys(filtrados).length === entries.length ? atual : filtrados;
    });
  }, [pendentes]);

  const pendentesSemCorrespondencia = useMemo(
    () => pendentes.filter((pub) => !vinculosEfetivos[pub.id]),
    [pendentes, vinculosEfetivos]
  );

  const publicacoesConciliadas = useMemo(
    () => pendentes.filter((pub) => !!vinculosEfetivos[pub.id]),
    [pendentes, vinculosEfetivos]
  );

  const notasSemItem = useMemo(
    () => notasEncontradas.filter((nota) => !notasConciliadasIds.has(nota.id)),
    [notasEncontradas, notasConciliadasIds]
  );

  const existeDuplicidadeNosVinculos = useMemo(() => {
    for (const ids of mapaVinculosInvertido.values()) {
      if (ids.length > 1) return true;
    }
    return false;
  }, [mapaVinculosInvertido]);

  const correspondenciaPorPublicacao = useMemo(() => {
    const mapa = {};

    publicacoesConciliadas.forEach((pub) => {
      const notaId = vinculosEfetivos[pub.id];
      const nota = mapaNotasById.get(notaId);

      mapa[pub.id] = calcularCorrespondenciaTextual(pub, nota);
    });

    return mapa;
  }, [publicacoesConciliadas, vinculosEfetivos, mapaNotasById]);

  const confirmarMutation = useMutation({
    mutationFn: async () => {
      if (!numeroBoletim || !dataBoletim) {
        throw new Error('Informe o número e a data do boletim antes de confirmar.');
      }

      if (publicacoesConciliadas.length === 0) {
        throw new Error('Não há publicações conciliadas para confirmar.');
      }

      if (existeDuplicidadeNosVinculos) {
        throw new Error('Há a mesma nota do boletim vinculada a mais de uma publicação. Revise os vínculos antes de confirmar.');
      }

      const updates = publicacoesConciliadas.flatMap((pub) => {
        const notaId = vinculosEfetivos[pub.id];
        const nota = mapaNotasById.get(notaId);
        const payloadBase = {
          numero_bg: numeroBoletim,
          data_bg: dataBoletim,
          nota_conciliada_boletim: nota?.nota_normalizada || '',
        };


        if (pub.origem_tipo === 'atestado') {
          return [atualizarEscopado('Atestado', pub.id, { ...payloadBase, status_publicacao: 'Publicado' })];
        }

        if (pub.origem_tipo === 'ex-officio') {
          return [atualizarEscopado('PublicacaoExOfficio', pub.id, { ...payloadBase, status: 'Publicado' })];
        }

        return [atualizarEscopado('RegistroLivro', pub.id, { ...payloadBase, status: 'Publicado' })];
      });

      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conciliacao-registros-livro'] });
      queryClient.invalidateQueries({ queryKey: ['conciliacao-publicacoes-ex-officio'] });
      queryClient.invalidateQueries({ queryKey: ['conciliacao-atestados-publicacao'] });
      queryClient.invalidateQueries({ queryKey: ['publicacoes-ex-officio'] });
      queryClient.invalidateQueries({ queryKey: ['registros-livro'] });
      queryClient.invalidateQueries({ queryKey: ['registros-livro-all'] });
      queryClient.invalidateQueries({ queryKey: ['atestados-publicacao'] });
      queryClient.invalidateQueries({ queryKey: ['publicacoes'] });
      queryClient.invalidateQueries({ queryKey: ['atestados'] });

      setMensagemProcessamento('Conciliação confirmada e publicações atualizadas com sucesso.');
      setErroVinculo('');
      setVinculos({});
      setVinculosRemovidos({});
      setDesvinculosManuais([]);
      setConciliacaoIniciada(false);
      setNotasEncontradas([]);
      setArquivoPdf(null);
    },
    onError: (error) => {
      setErroVinculo(error?.message || 'Falha ao confirmar a conciliação.');
    },
  });

  const atualizarPersistenciaVinculo = async (pub, notaNormalizada) => {
    const payload = { nota_conciliada_boletim: notaNormalizada || '' };

    if (pub.origem_tipo === 'atestado') {
      await atualizarEscopado('Atestado', pub.id, payload);
      return;
    }

    if (pub.origem_tipo === 'ex-officio') {
      await atualizarEscopado('PublicacaoExOfficio', pub.id, payload);
      return;
    }


    await atualizarEscopado('RegistroLivro', pub.id, payload);
  };

  const processarBoletim = async () => {
    setErroProcessamento('');
    setMensagemProcessamento('');
    setErroVinculo('');

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

  const handleVinculoManual = async (pubId, notaId) => {
    const pub = pendentesMap.get(pubId);
    if (!pub) return;

    setErroVinculo('');

    const estadoAnteriorVinculo = vinculos[pubId] || '';
    const estadoAnteriorRemocao = !!vinculosRemovidos[pubId];

    const pubsUsandoNota = mapaVinculosInvertido.get(notaId) || [];
    const conflitoExistente = pubsUsandoNota.find((id) => id !== pubId);

    if (!notaId) {
      setVinculos((prev) => ({ ...prev, [pubId]: '' }));
      setVinculosRemovidos((prev) => ({ ...prev, [pubId]: true }));
      try {
        await atualizarPersistenciaVinculo(pub, '');
      } catch (error) {
        setVinculos((prev) => ({ ...prev, [pubId]: estadoAnteriorVinculo }));
        setVinculosRemovidos((prev) => ({ ...prev, [pubId]: estadoAnteriorRemocao }));
        setErroVinculo('Falha ao remover vínculo. Tente novamente.');
      }
      return;
    }

    if (conflitoExistente) {
      const pubConflitanteObj = pendentesMap.get(conflitoExistente);
      setErroVinculo(`Esta nota do boletim já está vinculada a "${getReferenciaPrincipal(pubConflitanteObj || {})}".`);
      return;
    }

    const notaSelecionada = mapaNotasById.get(notaId);
    if (!notaSelecionada) {
      setErroVinculo('Nota selecionada não encontrada na leitura atual do boletim.');
      return;
    }

    setVinculos((prev) => ({ ...prev, [pubId]: notaId }));
    setVinculosRemovidos((prev) => ({ ...prev, [pubId]: false }));

    try {
      await atualizarPersistenciaVinculo(pub, notaSelecionada.nota_normalizada);
      queryClient.invalidateQueries({ queryKey: ['conciliacao-registros-livro'] });
      queryClient.invalidateQueries({ queryKey: ['conciliacao-publicacoes-ex-officio'] });
      queryClient.invalidateQueries({ queryKey: ['conciliacao-atestados-publicacao'] });
      queryClient.invalidateQueries({ queryKey: ['registros-livro'] });
      queryClient.invalidateQueries({ queryKey: ['registros-livro-all'] });
      queryClient.invalidateQueries({ queryKey: ['publicacoes-ex-officio'] });
      queryClient.invalidateQueries({ queryKey: ['atestados-publicacao'] });
    } catch (error) {
      setVinculos((prev) => ({ ...prev, [pubId]: estadoAnteriorVinculo }));
      setVinculosRemovidos((prev) => ({ ...prev, [pubId]: estadoAnteriorRemocao }));
      setErroVinculo('Falha ao salvar vínculo manual. Tente novamente.');
    }
  };

  const iniciarConciliacao = async () => {
    setErroVinculo('');
    setConciliacaoIniciada(true);

    try {
      const pendentesAuto = pendentes.filter((pub) => {
        if (!pub.nota_normalizada) return false;
        if (!mapaNotasByNumero.has(pub.nota_normalizada)) return false;
        return (ocorrenciasNotasPendentes.get(pub.nota_normalizada) || 0) === 1;
      });

      await Promise.all(
        pendentesAuto.map((pub) => atualizarPersistenciaVinculo(pub, pub.nota_normalizada))
      );

      queryClient.invalidateQueries({ queryKey: ['conciliacao-registros-livro'] });
      queryClient.invalidateQueries({ queryKey: ['conciliacao-publicacoes-ex-officio'] });
      queryClient.invalidateQueries({ queryKey: ['conciliacao-atestados-publicacao'] });
      queryClient.invalidateQueries({ queryKey: ['registros-livro'] });
      queryClient.invalidateQueries({ queryKey: ['registros-livro-all'] });
      queryClient.invalidateQueries({ queryKey: ['publicacoes-ex-officio'] });
      queryClient.invalidateQueries({ queryKey: ['atestados-publicacao'] });

      if (notasDuplicadasNoSistema.length > 0) {
        setErroVinculo(`Há notas repetidas no sistema pendente (${notasDuplicadasNoSistema.join(', ')}). Esses casos exigem revisão manual antes da confirmação.`);
      }
    } catch (error) {
      setErroVinculo('A conciliação automática foi aplicada na tela, mas houve falha ao persistir todos os vínculos.');
    }
  };

  const removerVinculo = async (pub) => {
    const notaId = vinculosEfetivos[pub.id];
    if (!notaId) return;

    setErroVinculo('');

    const estadoAnteriorVinculo = vinculos[pub.id] || '';
    const estadoAnteriorRemocao = !!vinculosRemovidos[pub.id];

    setVinculos((prev) => ({ ...prev, [pub.id]: '' }));
    setVinculosRemovidos((prev) => ({ ...prev, [pub.id]: true }));
    setDesvinculosManuais((prev) => ([
      {
        pubId: pub.id,
        referencia: getReferenciaPrincipal(pub),
        notaSistema: pub.nota_para_bg,
        notaBoletim: mapaNotasById.get(notaId)?.nota || '-',
      },
      ...prev.filter((item) => item.pubId !== pub.id),
    ]));

    try {
      await atualizarPersistenciaVinculo(pub, '');
      queryClient.invalidateQueries({ queryKey: ['conciliacao-registros-livro'] });
      queryClient.invalidateQueries({ queryKey: ['conciliacao-publicacoes-ex-officio'] });
      queryClient.invalidateQueries({ queryKey: ['conciliacao-atestados-publicacao'] });
      queryClient.invalidateQueries({ queryKey: ['registros-livro'] });
      queryClient.invalidateQueries({ queryKey: ['registros-livro-all'] });
      queryClient.invalidateQueries({ queryKey: ['publicacoes-ex-officio'] });
      queryClient.invalidateQueries({ queryKey: ['atestados-publicacao'] });
    } catch (error) {
      setVinculos((prev) => ({ ...prev, [pub.id]: estadoAnteriorVinculo }));
      setVinculosRemovidos((prev) => ({ ...prev, [pub.id]: estadoAnteriorRemocao }));
      setErroVinculo('Falha ao remover vínculo.');
    }
  };

  if (loadingUser || !isAccessResolved) return null;
  if (!hasAccess) return <AccessDenied modulo="Controle de Publicações" />;

  const isCarregandoDados = isLoadingLivro || isLoadingExOfficio || isLoadingAtestados;

  if (isCarregandoDados) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-[#1e3a5f]">Conciliação com Boletim</CardTitle>
          <p className="text-sm font-semibold text-blue-700">Conciliação Boletim v2.1</p>
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
          {erroVinculo && <p className="text-xs text-red-600 font-medium">{erroVinculo}</p>}
          {notasDuplicadasNoSistema.length > 0 && (
            <p className="text-xs text-amber-700 font-medium">
              Atenção: há notas repetidas entre publicações pendentes no sistema ({notasDuplicadasNoSistema.join(', ')}). Esses itens não serão conciliados automaticamente.
            </p>
          )}
          {existeDuplicidadeNosVinculos && (
            <p className="text-xs text-rose-700 font-medium">
              Há a mesma nota do boletim vinculada a mais de uma publicação. Corrija isso antes de confirmar.
            </p>
          )}
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><ArrowLeftRight className="w-4 h-4" />Comparação lado a lado (Sistema × Boletim)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {publicacoesConciliadas.length === 0 && <p className="text-sm text-slate-500">Nenhum vínculo criado.</p>}
          {publicacoesConciliadas.map((pub) => {
            const notaId = vinculosEfetivos[pub.id];
            const nota = mapaNotasById.get(notaId);
            const automatico = conciliacaoAutomatica[pub.id] === notaId;
            const correspondencia = correspondenciaPorPublicacao[pub.id] || { percentual: 0, trechoComparadoSistema: '', trechoComparadoBoletim: '' };
            const faixa = classificarCorrespondencia(correspondencia.percentual);
            const termosRelevantes = obterTermosRelevantesComparacao(correspondencia);

            return (
              <div key={pub.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr]">
                  <div className="rounded-lg border bg-white p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Badge className="bg-blue-100 text-blue-700">Sistema</Badge>
                      <Badge variant="outline">Nota {pub.nota_para_bg}</Badge>
                    </div>
                    <p className="text-sm font-medium text-slate-800">{getReferenciaPrincipal(pub)}</p>
                    <TextoExpansivel
                      texto={(pub.texto_publicacao || pub.texto || '').replace(/\s+/g, ' ').trim() || 'Sem texto de publicação'}
                      termosRelevantes={termosRelevantes}
                    />
                  </div>

                  <div className="flex flex-col items-center justify-center gap-2 min-w-[170px]">
                    <div className="h-7 w-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center">↔</div>
                    <p className="text-3xl font-extrabold text-blue-700 leading-none">{correspondencia.percentual}%</p>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Percentual de correspondência</p>
                    <Badge className={faixa.className}>{faixa.label}</Badge>
                    {automatico ? (
                      <Badge className="bg-emerald-100 text-emerald-700"><Link2 className="w-3 h-3 mr-1" />Automática</Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-700"><Unlink2 className="w-3 h-3 mr-1" />Manual</Badge>
                    )}
                    <Button type="button" variant="outline" size="sm" onClick={() => removerVinculo(pub)}>
                      Desvincular
                    </Button>
                  </div>

                  <div className="rounded-lg border bg-white p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Badge className="bg-indigo-100 text-indigo-700">Boletim</Badge>
                      <Badge variant="outline">Nota {nota?.nota || '-'}</Badge>
                    </div>
                    <p className="text-xs text-slate-500">{nota?.pagina ? `Página ${nota.pagina}` : 'Página não identificada'}</p>
                    <TextoExpansivel texto={nota?.contexto || 'Sem contexto identificado.'} termosRelevantes={termosRelevantes} />
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Pendências de vínculo manual</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {!conciliacaoIniciada ? <p className="text-sm text-slate-500">Inicie a Etapa 2 para revisar e vincular manualmente.</p> : null}
          {pendentes.map((pub) => {
            return (
              <div key={pub.id} className="rounded-lg border p-3 bg-white space-y-2">
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
                    {notasEncontradas.map((nota) => {
                      const pubsUsando = mapaVinculosInvertido.get(nota.id) || [];
                      const conflitaId = pubsUsando.find((id) => id !== pub.id);
                      const pubConflitante = conflitaId ? pendentesMap.get(conflitaId) : null;

                      return (
                        <option
                          key={nota.id}
                          value={nota.id}
                          disabled={!!conflitaId}
                        >
                          {conflitaId
                            ? `Nota ${nota.nota} — já vinculada a ${getReferenciaPrincipal(pubConflitante || {})}`
                            : `Nota ${nota.nota}`}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Pendentes do sistema sem correspondência</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {pendentesSemCorrespondencia.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum item pendente sem correspondência.</p>
            ) : pendentesSemCorrespondencia.map((pub) => (
              <div key={pub.id} className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="text-sm font-medium text-slate-800">{getReferenciaPrincipal(pub)}</p>
                <p className="text-xs text-slate-600">Nota do sistema: {pub.nota_para_bg}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Notas encontradas sem item no sistema</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {notasSemItem.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhuma nota sem item correspondente.</p>
            ) : notasSemItem.map((nota) => (
              <div key={nota.id} className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2">
                <p className="text-sm font-medium text-slate-800">Nota {nota.nota}</p>
                <TextoExpansivel texto={nota.contexto || 'Sem contexto identificado.'} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={() => confirmarMutation.mutate()}
          disabled={
            !numeroBoletim ||
            !dataBoletim ||
            publicacoesConciliadas.length === 0 ||
            confirmarMutation.isPending ||
            existeDuplicidadeNosVinculos
          }
        >
          {confirmarMutation.isPending ? 'Confirmando...' : 'Confirmar conciliação e publicar'}
        </Button>
      </div>
    </div>
  );
}
