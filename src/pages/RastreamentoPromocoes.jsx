import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ClipboardCopy, Eye, RefreshCw, Search } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const STATUS_OPERACIONAIS = new Set(['ativo', 'previsto']);
const STATUS_CANCELADOS_RETIFICADOS = new Set(['cancelado', 'retificado', 'retificada', 'cancelada']);

function texto(valor) {
  return String(valor ?? '').trim();
}

function normalizar(valor) {
  return texto(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function normalizarStatus(valor) {
  return normalizar(valor) || 'ativo';
}

function isOperacional(registro) {
  return STATUS_OPERACIONAIS.has(normalizarStatus(registro?.status_registro));
}

function isCanceladoRetificado(registro) {
  return STATUS_CANCELADOS_RETIFICADOS.has(normalizarStatus(registro?.status_registro));
}

function isAtivo(registro) {
  return normalizarStatus(registro?.status_registro) === 'ativo';
}

function isPrevisto(registro) {
  return normalizarStatus(registro?.status_registro) === 'previsto';
}

function ordemPreenchida(valor) {
  if (valor === null || valor === undefined || valor === '') return false;
  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0;
}

function dataFormatada(data) {
  if (!data) return '—';
  const [ano, mes, dia] = String(data).split('T')[0].split('-');
  if (!ano || !mes || !dia) return texto(data) || '—';
  return `${dia}/${mes}/${ano}`;
}

function valorOuTraco(valor) {
  return texto(valor) || '—';
}

function nomeMilitar(militar) {
  return texto(militar?.nome_guerra) || texto(militar?.nome_completo) || 'Militar sem nome';
}

function militarBuscaTexto(militar) {
  return normalizar([
    militar?.nome_guerra,
    militar?.nome_completo,
    militar?.matricula,
    militar?.posto_graduacao,
    militar?.quadro,
    militar?.lotacao,
  ].join(' '));
}

function historicoCompativelComMilitar(registro, militar) {
  return isAtivo(registro)
    && normalizar(registro?.posto_graduacao_novo) === normalizar(militar?.posto_graduacao)
    && normalizar(registro?.quadro_novo) === normalizar(militar?.quadro);
}

function chaveAgrupamento(registro) {
  return [
    registro?.posto_graduacao_novo,
    registro?.quadro_novo,
    registro?.data_promocao,
    registro?.data_publicacao,
    registro?.boletim_referencia,
    registro?.ato_referencia,
  ].map((valor) => normalizar(valor) || '∅').join('|');
}

function classificarConfianca({ totalMilitares, duplicidades, totalComReferencia, ativos, previstos }) {
  if (duplicidades > 0 || totalMilitares <= 1) return 'baixa';
  if (totalComReferencia >= 2 && ativos > 0 && previstos === 0) return 'alta';
  return 'média';
}

function montarRastreamento(militares, historicos) {
  const militaresAtivos = (militares || []).filter((militar) => normalizar(militar?.status_cadastro || 'Ativo') === 'ativo');
  const militarPorId = new Map(militaresAtivos.map((militar) => [String(militar.id), militar]));

  const historicosPorMilitar = new Map();
  (historicos || []).forEach((registro) => {
    const militarId = String(registro?.militar_id || '');
    if (!militarId) return;
    if (!historicosPorMilitar.has(militarId)) historicosPorMilitar.set(militarId, []);
    historicosPorMilitar.get(militarId).push(registro);
  });

  const semPromocao = militaresAtivos.filter((militar) => {
    const registros = historicosPorMilitar.get(String(militar.id)) || [];
    return !registros.some(isOperacional);
  });

  const semAtualCompativel = militaresAtivos.filter((militar) => {
    const registros = historicosPorMilitar.get(String(militar.id)) || [];
    return registros.length > 0 && !registros.some((registro) => historicoCompativelComMilitar(registro, militar));
  });

  const gruposMap = new Map();
  (historicos || []).forEach((registro) => {
    const chave = chaveAgrupamento(registro);
    if (!gruposMap.has(chave)) {
      gruposMap.set(chave, {
        key: chave,
        posto: valorOuTraco(registro?.posto_graduacao_novo),
        quadro: valorOuTraco(registro?.quadro_novo),
        data_promocao: registro?.data_promocao || '',
        data_publicacao: registro?.data_publicacao || '',
        boletim_referencia: valorOuTraco(registro?.boletim_referencia),
        ato_referencia: valorOuTraco(registro?.ato_referencia),
        registros: [],
      });
    }
    gruposMap.get(chave).registros.push(registro);
  });

  const agrupamentos = Array.from(gruposMap.values()).map((grupo) => {
    const idsMilitares = grupo.registros.map((registro) => String(registro?.militar_id || '')).filter(Boolean);
    const militaresUnicos = new Set(idsMilitares);
    const totalComReferencia = grupo.registros.filter((registro) => texto(registro?.boletim_referencia) || texto(registro?.ato_referencia) || texto(registro?.data_publicacao)).length;
    const resumo = {
      ...grupo,
      totalMilitares: militaresUnicos.size,
      comOrdem: grupo.registros.filter((registro) => ordemPreenchida(registro?.antiguidade_referencia_ordem)).length,
      semOrdem: grupo.registros.filter((registro) => !ordemPreenchida(registro?.antiguidade_referencia_ordem)).length,
      ativos: grupo.registros.filter(isAtivo).length,
      previstos: grupo.registros.filter(isPrevisto).length,
      canceladosRetificados: grupo.registros.filter(isCanceladoRetificado).length,
      duplicidades: idsMilitares.length - militaresUnicos.size,
      militares: Array.from(militaresUnicos).map((id) => militarPorId.get(id)).filter(Boolean),
    };
    return {
      ...resumo,
      confianca: classificarConfianca({
        totalMilitares: resumo.totalMilitares,
        duplicidades: resumo.duplicidades,
        totalComReferencia,
        ativos: resumo.ativos,
        previstos: resumo.previstos,
      }),
    };
  }).sort((a, b) => b.totalMilitares - a.totalMilitares || a.posto.localeCompare(b.posto, 'pt-BR'));

  const atuaisComOrdenacao = militaresAtivos.map((militar) => {
    const registros = (historicosPorMilitar.get(String(militar.id)) || [])
      .filter((registro) => historicoCompativelComMilitar(registro, militar) && texto(registro?.data_promocao) && ordemPreenchida(registro?.antiguidade_referencia_ordem))
      .sort((a, b) => Number(a.antiguidade_referencia_ordem) - Number(b.antiguidade_referencia_ordem));
    return registros[0] ? { militar, registro: registros[0] } : null;
  }).filter(Boolean).sort((a, b) => {
    const dataCompare = texto(b.registro.data_promocao).localeCompare(texto(a.registro.data_promocao));
    if (dataCompare) return dataCompare;
    return Number(a.registro.antiguidade_referencia_ordem) - Number(b.registro.antiguidade_referencia_ordem);
  });

  return { militaresAtivos, semPromocao, semAtualCompativel, agrupamentos, atuaisComOrdenacao };
}

function filtrarMilitares(lista, busca) {
  const termo = normalizar(busca);
  if (!termo) return lista;
  return lista.filter((militar) => militarBuscaTexto(militar).includes(termo));
}

function copiarTexto(conteudo) {
  if (!conteudo) return;
  if (navigator?.clipboard?.writeText) {
    navigator.clipboard.writeText(conteudo);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = conteudo;
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

function linhasMilitares(militares) {
  return (militares || []).map((militar) => [
    valorOuTraco(militar?.posto_graduacao),
    valorOuTraco(militar?.quadro),
    valorOuTraco(militar?.matricula),
    nomeMilitar(militar),
    valorOuTraco(militar?.lotacao),
  ].join('\t')).join('\n');
}

function PainelMilitares({ titulo, descricao, militares, busca, onBuscaChange }) {
  const filtrados = useMemo(() => filtrarMilitares(militares, busca), [militares, busca]);
  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="text-lg text-slate-900">{titulo}</CardTitle>
            <p className="mt-1 text-sm text-slate-500">{descricao}</p>
          </div>
          <Badge variant="outline" className="w-fit text-sm">{filtrados.length} / {militares.length}</Badge>
        </div>
        <div className="flex flex-col gap-2 md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input className="pl-9" placeholder="Buscar por nome, matrícula, posto, quadro ou lotação" value={busca} onChange={(e) => onBuscaChange(e.target.value)} />
          </div>
          <Button type="button" variant="outline" onClick={() => copiarTexto(linhasMilitares(filtrados))}>
            <ClipboardCopy className="mr-2 h-4 w-4" /> Copiar lista
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto rounded-lg border">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr><th className="p-3">Nome</th><th className="p-3">Matrícula</th><th className="p-3">Posto</th><th className="p-3">Quadro</th><th className="p-3">Lotação</th><th className="p-3">Ficha</th></tr>
            </thead>
            <tbody>
              {filtrados.map((militar) => (
                <tr key={militar.id} className="border-t">
                  <td className="p-3 font-medium text-slate-800">{nomeMilitar(militar)}</td>
                  <td className="p-3">{valorOuTraco(militar.matricula)}</td>
                  <td className="p-3">{valorOuTraco(militar.posto_graduacao)}</td>
                  <td className="p-3">{valorOuTraco(militar.quadro)}</td>
                  <td className="p-3">{valorOuTraco(militar.lotacao)}</td>
                  <td className="p-3"><Link className="text-blue-700 hover:underline" to={`${createPageUrl('VerMilitar')}?id=${militar.id}`}>Abrir ficha</Link></td>
                </tr>
              ))}
              {filtrados.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-slate-500">Nenhum militar encontrado.</td></tr>}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function confiancaVariant(confianca) {
  if (confianca === 'alta') return 'default';
  if (confianca === 'média') return 'secondary';
  return 'destructive';
}

export default function RastreamentoPromocoes() {
  const [buscaSemPromocao, setBuscaSemPromocao] = useState('');
  const [buscaSemAtual, setBuscaSemAtual] = useState('');
  const [filtroGrupo, setFiltroGrupo] = useState('');
  const [filtroConfianca, setFiltroConfianca] = useState('todas');
  const [grupoDetalhe, setGrupoDetalhe] = useState(null);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['rastreamento-promocoes-readonly'],
    queryFn: async () => {
      const [militares, historicos] = await Promise.all([
        base44.entities.Militar.filter({ status_cadastro: 'Ativo' }),
        base44.entities.HistoricoPromocaoMilitarV2.list(),
      ]);
      return montarRastreamento(militares || [], historicos || []);
    },
  });

  const gruposFiltrados = useMemo(() => {
    const termo = normalizar(filtroGrupo);
    return (data?.agrupamentos || []).filter((grupo) => {
      if (filtroConfianca !== 'todas' && grupo.confianca !== filtroConfianca) return false;
      if (!termo) return true;
      return normalizar([
        grupo.posto,
        grupo.quadro,
        grupo.data_promocao,
        grupo.data_publicacao,
        grupo.boletim_referencia,
        grupo.ato_referencia,
      ].join(' ')).includes(termo);
    });
  }, [data?.agrupamentos, filtroConfianca, filtroGrupo]);

  const atuaisPorGrupo = useMemo(() => {
    const grupos = new Map();
    (data?.atuaisComOrdenacao || []).forEach(({ militar, registro }) => {
      const chave = [registro.data_promocao, registro.antiguidade_referencia_ordem].join('|');
      if (!grupos.has(chave)) grupos.set(chave, { data_promocao: registro.data_promocao, ordem: registro.antiguidade_referencia_ordem, itens: [] });
      grupos.get(chave).itens.push({ militar, registro });
    });
    return Array.from(grupos.values()).sort((a, b) => texto(b.data_promocao).localeCompare(texto(a.data_promocao)) || Number(a.ordem) - Number(b.ordem));
  }, [data?.atuaisComOrdenacao]);

  if (isLoading) return <div className="p-6">Carregando rastreamento de promoções...</div>;
  if (error) return <div className="p-6 text-red-600">{error?.message || 'Falha ao carregar rastreamento de promoções.'}</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Antiguidade</p>
          <h1 className="text-2xl font-bold text-[#1e3a5f]">Rastreamento de Promoções</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">Painel 100% read-only para identificar lacunas, agrupamentos e militares ativos sem vínculo adequado em HistoricoPromocaoMilitarV2.</p>
        </div>
        <Button type="button" variant="outline" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} /> Atualizar
        </Button>
      </div>

      <Alert>
        <AlertTitle>Modo somente leitura</AlertTitle>
        <AlertDescription>Esta tela apenas consulta Militar ativo e HistoricoPromocaoMilitarV2. Não cria Promoção, não adiciona promocao_id, não vincula registros e não altera Militar, histórico, prévia geral, ordenação ou snapshots.</AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card><CardHeader><CardTitle className="text-sm">Militares ativos</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{data.militaresAtivos.length}</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Sem promoção operacional</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-amber-700">{data.semPromocao.length}</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Sem atual compatível</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-red-700">{data.semAtualCompativel.length}</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Agrupamentos detectados</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-blue-700">{data.agrupamentos.length}</p></CardContent></Card>
      </div>

      <PainelMilitares
        titulo="1. Militares sem nenhuma promoção operacional"
        descricao="Militares ativos sem qualquer histórico com status ativo ou previsto. Registros cancelados/retificados isolados não contam como vínculo operacional."
        militares={data.semPromocao}
        busca={buscaSemPromocao}
        onBuscaChange={setBuscaSemPromocao}
      />

      <PainelMilitares
        titulo="2. Militares sem promoção atual compatível"
        descricao="Militares ativos que possuem histórico, mas nenhum registro ativo em que posto_graduacao_novo e quadro_novo sejam compatíveis com o posto/quadro atual do cadastro."
        militares={data.semAtualCompativel}
        busca={buscaSemAtual}
        onBuscaChange={setBuscaSemAtual}
      />

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle>3. Agrupamentos detectados</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Agrupamento por posto_graduacao_novo, quadro_novo, data_promocao, data_publicacao, boletim_referencia e ato_referencia.</p>
            </div>
            <Badge variant="outline" className="w-fit text-sm">{gruposFiltrados.length} / {data.agrupamentos.length}</Badge>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px]">
            <div>
              <Label>Buscar agrupamento</Label>
              <Input value={filtroGrupo} onChange={(e) => setFiltroGrupo(e.target.value)} placeholder="Posto, quadro, datas, boletim ou ato" />
            </div>
            <div>
              <Label>Confiança</Label>
              <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={filtroConfianca} onChange={(e) => setFiltroConfianca(e.target.value)}>
                <option value="todas">Todas</option>
                <option value="alta">Alta</option>
                <option value="média">Média</option>
                <option value="baixa">Baixa</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto rounded-lg border">
            <table className="w-full min-w-[1120px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr><th className="p-3">Grupo</th><th className="p-3">Promoção</th><th className="p-3">Publicação</th><th className="p-3">Refs.</th><th className="p-3">Total</th><th className="p-3">Com ordem</th><th className="p-3">Sem ordem</th><th className="p-3">Ativos</th><th className="p-3">Previstos</th><th className="p-3">Cancel./Retif.</th><th className="p-3">Duplic.</th><th className="p-3">Confiança</th><th className="p-3">Detalhes</th></tr>
              </thead>
              <tbody>
                {gruposFiltrados.map((grupo) => (
                  <tr key={grupo.key} className="border-t">
                    <td className="p-3 font-medium">{grupo.posto} / {grupo.quadro}</td>
                    <td className="p-3">{dataFormatada(grupo.data_promocao)}</td>
                    <td className="p-3">{dataFormatada(grupo.data_publicacao)}</td>
                    <td className="p-3">{grupo.boletim_referencia}<br /><span className="text-xs text-slate-500">{grupo.ato_referencia}</span></td>
                    <td className="p-3">{grupo.totalMilitares}</td>
                    <td className="p-3">{grupo.comOrdem}</td>
                    <td className="p-3">{grupo.semOrdem}</td>
                    <td className="p-3">{grupo.ativos}</td>
                    <td className="p-3">{grupo.previstos}</td>
                    <td className="p-3">{grupo.canceladosRetificados}</td>
                    <td className="p-3">{grupo.duplicidades}</td>
                    <td className="p-3"><Badge variant={confiancaVariant(grupo.confianca)}>{grupo.confianca}</Badge></td>
                    <td className="p-3"><Button type="button" size="sm" variant="outline" onClick={() => setGrupoDetalhe(grupo)}><Eye className="mr-2 h-4 w-4" />Ver</Button></td>
                  </tr>
                ))}
                {gruposFiltrados.length === 0 && <tr><td colSpan={13} className="p-6 text-center text-slate-500">Nenhum agrupamento encontrado.</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>4. Promoções atuais com ordenação</CardTitle>
          <p className="mt-1 text-sm text-slate-500">Militares com promoção atual ativa compatível, data_promocao e antiguidade_referencia_ordem preenchidas, agrupados por data e ordem.</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {atuaisPorGrupo.map((grupo) => (
              <div key={`${grupo.data_promocao}-${grupo.ordem}`} className="rounded-lg border p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Badge variant="outline">Data: {dataFormatada(grupo.data_promocao)}</Badge>
                  <Badge variant="outline">Ordem: {grupo.ordem}</Badge>
                  <Badge>{grupo.itens.length} militar(es)</Badge>
                  <Button type="button" size="sm" variant="ghost" onClick={() => copiarTexto(linhasMilitares(grupo.itens.map((item) => item.militar)))}><ClipboardCopy className="mr-2 h-4 w-4" />Copiar lista</Button>
                </div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {grupo.itens.map(({ militar }) => (
                    <Link key={militar.id} to={`${createPageUrl('VerMilitar')}?id=${militar.id}`} className="rounded-md bg-slate-50 p-3 text-sm hover:bg-blue-50">
                      <strong>{nomeMilitar(militar)}</strong><br />{valorOuTraco(militar.posto_graduacao)} / {valorOuTraco(militar.quadro)} · Mat. {valorOuTraco(militar.matricula)}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
            {atuaisPorGrupo.length === 0 && <p className="rounded-lg border p-6 text-center text-slate-500">Nenhuma promoção atual com ordenação encontrada.</p>}
          </div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(grupoDetalhe)} onOpenChange={(open) => !open && setGrupoDetalhe(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader><DialogTitle>Detalhes do agrupamento</DialogTitle></DialogHeader>
          {grupoDetalhe && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                <div><span className="text-slate-500">Posto/quadro</span><p className="font-medium">{grupoDetalhe.posto} / {grupoDetalhe.quadro}</p></div>
                <div><span className="text-slate-500">Promoção</span><p className="font-medium">{dataFormatada(grupoDetalhe.data_promocao)}</p></div>
                <div><span className="text-slate-500">Publicação</span><p className="font-medium">{dataFormatada(grupoDetalhe.data_publicacao)}</p></div>
                <div><span className="text-slate-500">Confiança</span><p><Badge variant={confiancaVariant(grupoDetalhe.confianca)}>{grupoDetalhe.confianca}</Badge></p></div>
              </div>
              <Button type="button" variant="outline" onClick={() => copiarTexto(linhasMilitares(grupoDetalhe.militares))}><ClipboardCopy className="mr-2 h-4 w-4" />Copiar militares do agrupamento</Button>
              <div className="max-h-[55vh] overflow-auto rounded-lg border">
                <table className="w-full min-w-[880px] text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="p-3">Militar</th><th className="p-3">Matrícula</th><th className="p-3">Status</th><th className="p-3">Ordem</th><th className="p-3">Boletim</th><th className="p-3">Ato</th><th className="p-3">Ficha</th></tr></thead>
                  <tbody>
                    {grupoDetalhe.registros.map((registro, index) => {
                      const militar = data.militaresAtivos.find((item) => String(item.id) === String(registro.militar_id));
                      return (
                        <tr key={`${registro.id || registro.militar_id}-${index}`} className="border-t">
                          <td className="p-3 font-medium">{militar ? nomeMilitar(militar) : `ID ${valorOuTraco(registro.militar_id)}`}</td>
                          <td className="p-3">{valorOuTraco(militar?.matricula)}</td>
                          <td className="p-3">{valorOuTraco(registro.status_registro || 'ativo')}</td>
                          <td className="p-3">{valorOuTraco(registro.antiguidade_referencia_ordem)}</td>
                          <td className="p-3">{valorOuTraco(registro.boletim_referencia)}</td>
                          <td className="p-3">{valorOuTraco(registro.ato_referencia)}</td>
                          <td className="p-3">{militar ? <Link className="text-blue-700 hover:underline" to={`${createPageUrl('VerMilitar')}?id=${militar.id}`}>Abrir ficha</Link> : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
