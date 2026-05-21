import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Shield,
  UserCheck,
  UserRound,
  Users,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

const RESERVA_LABEL = 'Não informada';
const ALERTA_EFETIVO_ELEVADO = 45;
const RESPONSAVEL_REGEX = /(COMAND|CHEF|RESPONS|DIRETOR|COORDEN|GESTOR|CMT)/i;

const MilitRow = ({ m, destaque }) => (
  <div className={`text-xs py-1 px-2 rounded-md border ${destaque ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-slate-50 border-slate-200'}`}>
    <span className="font-medium">{m.nome_completo || m.nome_guerra || 'Sem nome'}</span>
    <span className="text-slate-500"> • {m.matricula || 'S/MAT'}</span>
  </div>
);

const toPosto = (m) => String(m.posto_grad || m.posto || m.graduacao || '').toUpperCase();
const isOficial = (m) => /(CEL|TCEL|MAJ|CAP|TEN|ASP|OFICIAL|CORONEL)/i.test(toPosto(m));
const isPraca = (m) => !isOficial(m);
const isTemporario = (m) => /(TEMP|TEMPOR|CONTRAT)/i.test(String(m.vinculo || m.tipo_vinculo || m.regime || m.situacao || ''));

const summarizeMilitares = (militares = []) => {
  const total = militares.length;
  const oficiais = militares.filter(isOficial).length;
  const pracas = militares.filter(isPraca).length;
  const temporarios = militares.filter(isTemporario).length;
  return { total, oficiais, pracas, temporarios };
};

const toCondicao = (m) => String(m.condicao || m.situacao || m.status || 'Sem condição');

const getResponsavel = (militares = []) => militares.find((m) => RESPONSAVEL_REGEX.test(String(m.cargo || m.funcao || m.funcao_nome || m.designacao || '')));

const getAlertasUnidade = (unidade) => {
  const resumo = summarizeMilitares(unidade.militares);
  const responsavel = getResponsavel(unidade.militares);
  const semDadosCriticos = unidade.militares.some((m) => !m.nome_completo || !m.matricula || !toPosto(m));
  const alertas = [];

  if (!responsavel) alertas.push('Sem responsável');
  if (resumo.oficiais === 0) alertas.push('Sem oficial');
  if (semDadosCriticos) alertas.push('Cadastro incompleto');
  if (resumo.total >= ALERTA_EFETIVO_ELEVADO) alertas.push('Efetivo elevado');

  return alertas;
};

const StructureCard = ({ title, tipo, resumo, responsavel, alertas = [], children, className = '' }) => (
  <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm p-4 ${className}`}>
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-[11px] uppercase tracking-wide text-slate-500">{tipo}</p>
        <h4 className="font-semibold text-slate-900 text-sm leading-snug">{title}</h4>
        {responsavel ? (
          <p className="text-xs text-slate-600 mt-1 flex items-center gap-1"><UserCheck className="w-3 h-3" /> Resp.: {responsavel.nome_completo || responsavel.nome_guerra || 'Sem nome'}</p>
        ) : (
          <p className="text-xs text-amber-700 mt-1">Sem responsável identificado</p>
        )}
      </div>
      <Badge variant="outline" className="text-xs bg-slate-50"><Users className="w-3 h-3 mr-1" />{resumo.total}</Badge>
    </div>

    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-center">
      <div className="rounded-md bg-slate-50 py-1"><p className="text-[10px] text-slate-500">Total</p><p className="text-sm font-bold">{resumo.total}</p></div>
      <div className="rounded-md bg-blue-50 py-1"><p className="text-[10px] text-slate-500">Oficiais</p><p className="text-sm font-bold text-blue-700">{resumo.oficiais}</p></div>
      <div className="rounded-md bg-emerald-50 py-1"><p className="text-[10px] text-slate-500">Praças</p><p className="text-sm font-bold text-emerald-700">{resumo.pracas}</p></div>
      <div className="rounded-md bg-violet-50 py-1"><p className="text-[10px] text-slate-500">Temporários</p><p className="text-sm font-bold text-violet-700">{resumo.temporarios}</p></div>
    </div>

    {alertas.length > 0 ? (
      <div className="mt-3 flex flex-wrap gap-1">
        {alertas.map((alerta) => <Badge key={alerta} variant="secondary" className="text-[10px] bg-amber-100 text-amber-800">{alerta}</Badge>)}
      </div>
    ) : null}
    {children}
  </div>
);

export default function VisualizacoesGestor({ estrutura, filtro }) {
  const [zoom, setZoom] = useState(1);
  const [expanded, setExpanded] = useState({});
  const q = String(filtro || '').trim().toLowerCase();

  const militarMatch = (m) => !q || [m.nome_completo, m.nome_guerra, m.matricula].some((v) => String(v || '').toLowerCase().includes(q));

  const filtrada = useMemo(() => estrutura.map((setor) => ({
    ...setor,
    subsetores: setor.subsetores.map((ss) => ({
      ...ss,
      unidades: ss.unidades.map((u) => ({ ...u, militares: u.militares.filter(militarMatch) })).filter((u) => u.militares.length > 0 || !q),
    })).filter((ss) => ss.unidades.length > 0 || !q),
  })).filter((s) => s.subsetores.length > 0 || !q), [estrutura, q]);

  const unidadesFlat = useMemo(() => filtrada.flatMap((s) => s.subsetores.flatMap((ss) => ss.unidades)), [filtrada]);
  const militarFlat = useMemo(() => unidadesFlat.flatMap((u) => u.militares), [unidadesFlat]);
  const resumoGeral = useMemo(() => summarizeMilitares(militarFlat), [militarFlat]);

  const condicoes = useMemo(() => {
    const map = new Map();
    militarFlat.forEach((m) => {
      const c = toCondicao(m);
      map.set(c, (map.get(c) || 0) + 1);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [militarFlat]);

  const alertas = useMemo(() => unidadesFlat
    .map((u) => ({ unidade: u.unidadeNome, alertas: getAlertasUnidade(u), resumo: summarizeMilitares(u.militares) }))
    .filter((item) => item.alertas.includes('Efetivo elevado')), [unidadesFlat]);

  const toggle = (key) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <Tabs defaultValue="organograma" className="space-y-4">
      <TabsList className="grid grid-cols-2 md:grid-cols-4 h-auto">
        <TabsTrigger value="organograma">Organograma</TabsTrigger>
        <TabsTrigger value="kanban">Kanban por Unidade</TabsTrigger>
        <TabsTrigger value="mapa">Mapa Executivo</TabsTrigger>
        <TabsTrigger value="arvore">Árvore com Zoom</TabsTrigger>
      </TabsList>

      <TabsContent value="organograma" className="space-y-6">
        {filtrada.map((setor) => {
          const setorMilitares = setor.subsetores.flatMap((ss) => ss.unidades.flatMap((u) => u.militares));
          const setorResumo = summarizeMilitares(setorMilitares);
          const setorResponsavel = getResponsavel(setorMilitares);

          return (
            <div key={setor.setorNome} className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 overflow-x-auto">
              <div className="min-w-[960px] space-y-4">
                <StructureCard title={setor.setorNome} tipo="Setor" resumo={setorResumo} responsavel={setorResponsavel} />

                <div className="ml-10 border-l-2 border-slate-300 pl-6 space-y-5">
                  {setor.subsetores.map((ss) => {
                    const subsetorMilitares = ss.unidades.flatMap((u) => u.militares);
                    const subsetorResumo = summarizeMilitares(subsetorMilitares);
                    const subsetorResponsavel = getResponsavel(subsetorMilitares);

                    return (
                      <div key={ss.subsetorNome} className="relative">
                        <div className="absolute -left-6 top-7 h-px w-6 bg-slate-300" />
                        <StructureCard title={ss.subsetorNome} tipo="Subsetor" resumo={subsetorResumo} responsavel={subsetorResponsavel} />

                        <div className="ml-8 mt-3 border-l border-slate-300 pl-4 grid md:grid-cols-2 xl:grid-cols-3 gap-3">
                          {ss.unidades.map((u) => {
                            const resumoUnidade = summarizeMilitares(u.militares);
                            const unidadeResponsavel = getResponsavel(u.militares);
                            const unidadeAlertas = getAlertasUnidade(u);
                            const unidadeKey = `org:${setor.setorNome}:${ss.subsetorNome}:${u.unidadeNome}`;
                            const unidadeOpen = expanded[unidadeKey] ?? true;

                            return (
                              <div key={u.unidadeNome} className="relative">
                                <div className="absolute -left-4 top-7 h-px w-4 bg-slate-300" />
                                <StructureCard title={u.unidadeNome} tipo="Unidade" resumo={resumoUnidade} responsavel={unidadeResponsavel} alertas={unidadeAlertas}>
                                  <div className="mt-3">
                                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => toggle(unidadeKey)}>
                                      {unidadeOpen ? <ChevronDown className="w-3 h-3 mr-1" /> : <ChevronRight className="w-3 h-3 mr-1" />}
                                      {unidadeOpen ? 'Ocultar militares' : 'Exibir militares'}
                                    </Button>

                                    {unidadeOpen ? (
                                      <div className="mt-2 max-h-40 overflow-y-auto space-y-1 pr-1">
                                        {u.militares.map((m) => <MilitRow key={m.id || `${m.matricula}-${m.nome_completo}`} m={m} destaque={militarMatch(m) && q} />)}
                                      </div>
                                    ) : null}
                                  </div>
                                </StructureCard>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </TabsContent>

      <TabsContent value="kanban">
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {unidadesFlat.map((u) => {
            const resumo = summarizeMilitares(u.militares);
            return (
              <Card key={u.unidadeNome} className="flex flex-col max-h-[560px]">
                <CardHeader className="pb-3 border-b bg-slate-50/80">
                  <CardTitle className="text-sm">{u.unidadeNome}</CardTitle>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline"><Users className="w-3 h-3 mr-1" /> {resumo.total} total</Badge>
                    <Badge className="bg-blue-600"><Shield className="w-3 h-3 mr-1" /> {resumo.oficiais} oficiais</Badge>
                    <Badge className="bg-emerald-600"><UserRound className="w-3 h-3 mr-1" /> {resumo.pracas} praças</Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-3 overflow-auto space-y-2">
                  {u.militares.map((m) => <MilitRow key={m.id || m.matricula} m={m} destaque={militarMatch(m) && q} />)}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </TabsContent>
      <TabsContent value="mapa" className="space-y-4">
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Total</p><p className="text-2xl font-bold">{resumoGeral.total}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Oficiais</p><p className="text-2xl font-bold text-blue-700">{resumoGeral.oficiais}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Praças</p><p className="text-2xl font-bold text-emerald-700">{resumoGeral.pracas}</p></CardContent></Card>
          <Card className="sm:col-span-2"><CardContent className="p-4"><p className="text-xs text-slate-500 mb-2">Condições</p><div className="flex flex-wrap gap-2">{condicoes.slice(0, 6).map(([nome, qtd]) => <Badge key={nome} variant="secondary">{nome || RESERVA_LABEL}: {qtd}</Badge>)}</div></CardContent></Card>
          <Card className="lg:col-span-5"><CardContent className="p-4"><p className="text-xs text-slate-500 mb-2">Alertas</p>{alertas.length === 0 ? <p className="text-sm text-slate-600">Sem alertas de efetivo elevado nas unidades.</p> : <div className="space-y-2">{alertas.map((a) => <div key={a.unidade} className="flex items-center gap-2 text-sm rounded-md bg-amber-50 border border-amber-200 p-2"><AlertTriangle className="w-4 h-4 text-amber-600" />{a.unidade}: efetivo elevado ({a.resumo.total} militares)</div>)}</div>}</CardContent></Card>
        </div>
      </TabsContent>
      <TabsContent value="arvore" className="space-y-3">
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}><ZoomOut className="w-4 h-4" /></Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setZoom((z) => Math.min(1.8, z + 0.1))}><ZoomIn className="w-4 h-4" /></Button>
          <Badge variant="secondary">Zoom: {Math.round(zoom * 100)}%</Badge>
        </div>
        <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }} className="space-y-4 pb-6">
          {filtrada.map((s) => {
            const setorKey = `setor:${s.setorNome}`;
            const setorOpen = expanded[setorKey] ?? true;
            return (
              <div key={s.setorNome} className="rounded-xl border p-3 bg-white">
                <button className="flex items-center gap-1 font-semibold" onClick={() => toggle(setorKey)}>{setorOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}{s.setorNome}</button>
                {setorOpen ? <div className="ml-6 border-l pl-4 mt-2 space-y-3">{s.subsetores.map((ss) => {
                  const ssKey = `subsetor:${s.setorNome}:${ss.subsetorNome}`;
                  const ssOpen = expanded[ssKey] ?? true;
                  return <div key={ss.subsetorNome}><button className="flex items-center gap-1 text-sm font-medium" onClick={() => toggle(ssKey)}>{ssOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}{ss.subsetorNome}</button>{ssOpen ? <div className="ml-6 border-l pl-4 mt-2 grid lg:grid-cols-2 gap-3">{ss.unidades.map((u) => {
                    const resumo = summarizeMilitares(u.militares);
                    return <div key={u.unidadeNome} className="border rounded-lg p-2 bg-slate-50"><div className="flex items-center justify-between"><p className="font-medium text-sm">{u.unidadeNome}</p><Badge variant="outline">{resumo.total}</Badge></div><div className="mt-2 max-h-28 overflow-auto space-y-1">{u.militares.map((m) => <MilitRow key={m.id || m.matricula} m={m} destaque={militarMatch(m) && q} />)}</div></div>;
                  })}</div> : null}</div>;
                })}</div> : null}
              </div>
            );
          })}
        </div>
      </TabsContent>
    </Tabs>
  );
}
