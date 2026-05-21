import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ChevronDown, ChevronRight, Shield, UserRound, Users, ZoomIn, ZoomOut } from 'lucide-react';

const RESERVA_LABEL = 'Não informada';

const MilitRow = ({ m, destaque }) => (
  <div className={`text-xs py-1 px-2 rounded-md border border-transparent ${destaque ? 'bg-amber-100 border-amber-300' : 'bg-slate-50'}`}>
    <span className="font-medium">{m.nome_completo || m.nome_guerra || 'Sem nome'}</span>
    <span className="text-slate-500"> • {m.matricula || 'S/MAT'}</span>
  </div>
);

const toPosto = (m) => String(m.posto_grad || m.posto || m.graduacao || '').toUpperCase();
const isOficial = (m) => /(CEL|TCEL|MAJ|CAP|TEN|ASP|OFICIAL|CORONEL)/i.test(toPosto(m));
const isPraca = (m) => !isOficial(m);

const summarizeMilitares = (militares = []) => {
  const total = militares.length;
  const oficiais = militares.filter(isOficial).length;
  const pracas = militares.filter(isPraca).length;
  return { total, oficiais, pracas };
};

const toCondicao = (m) => String(m.condicao || m.situacao || m.status || 'Sem condição');

const NodeCard = ({ title, subtitle, resumo, children }) => (
  <div className="rounded-xl border bg-white shadow-sm p-3 min-w-[240px]">
    <div className="flex items-start justify-between gap-2">
      <div>
        <h4 className="font-semibold text-slate-900 text-sm">{title}</h4>
        {subtitle ? <p className="text-xs text-slate-500">{subtitle}</p> : null}
      </div>
      <Badge variant="outline" className="text-xs">{resumo.total}</Badge>
    </div>
    <div className="grid grid-cols-3 gap-2 mt-3 text-center">
      <div className="rounded-md bg-slate-50 py-1"><p className="text-[10px] text-slate-500">Total</p><p className="text-sm font-bold">{resumo.total}</p></div>
      <div className="rounded-md bg-blue-50 py-1"><p className="text-[10px] text-slate-500">Oficiais</p><p className="text-sm font-bold text-blue-700">{resumo.oficiais}</p></div>
      <div className="rounded-md bg-emerald-50 py-1"><p className="text-[10px] text-slate-500">Praças</p><p className="text-sm font-bold text-emerald-700">{resumo.pracas}</p></div>
    </div>
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
    .map((u) => {
      const resumo = summarizeMilitares(u.militares);
      const desequilibrio = resumo.total > 0 && (Math.max(resumo.oficiais, resumo.pracas) / resumo.total) > 0.85;
      return { unidade: u.unidadeNome, desequilibrio, resumo };
    })
    .filter((item) => item.desequilibrio), [unidadesFlat]);

  const toggle = (key) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <Tabs defaultValue="organograma" className="space-y-4">
      <TabsList className="grid grid-cols-2 md:grid-cols-4 h-auto">
        <TabsTrigger value="organograma">Organograma</TabsTrigger>
        <TabsTrigger value="kanban">Kanban por Unidade</TabsTrigger>
        <TabsTrigger value="mapa">Mapa Executivo</TabsTrigger>
        <TabsTrigger value="arvore">Árvore com Zoom</TabsTrigger>
      </TabsList>

      <TabsContent value="organograma" className="space-y-4">
        {filtrada.map((setor) => {
          const setorMilitares = setor.subsetores.flatMap((ss) => ss.unidades.flatMap((u) => u.militares));
          return (
            <div key={setor.setorNome} className="overflow-x-auto pb-2">
              <div className="flex items-start gap-4 min-w-max">
                <NodeCard title={setor.setorNome} subtitle="Setor" resumo={summarizeMilitares(setorMilitares)} />
                <div className="pt-16 text-slate-300">──▶</div>
                {setor.subsetores.map((ss) => {
                  const subsetorMilitares = ss.unidades.flatMap((u) => u.militares);
                  return (
                    <div key={ss.subsetorNome} className="flex items-start gap-4">
                      <NodeCard title={ss.subsetorNome} subtitle="Subsetor" resumo={summarizeMilitares(subsetorMilitares)} />
                      <div className="pt-16 text-slate-300">──▶</div>
                      <div className="grid md:grid-cols-2 gap-3">
                        {ss.unidades.map((u) => (
                          <NodeCard key={u.unidadeNome} title={u.unidadeNome} subtitle="Unidade" resumo={summarizeMilitares(u.militares)}>
                            <div className="mt-2 space-y-1 max-h-36 overflow-auto pr-1">
                              {u.militares.map((m) => <MilitRow key={m.id || `${m.matricula}-${m.nome_completo}`} m={m} destaque={militarMatch(m) && q} />)}
                            </div>
                          </NodeCard>
                        ))}
                      </div>
                    </div>
                  );
                })}
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
          <Card className="lg:col-span-5"><CardContent className="p-4"><p className="text-xs text-slate-500 mb-2">Alertas</p>{alertas.length === 0 ? <p className="text-sm text-slate-600">Sem alertas de concentração excessiva entre oficiais/praças.</p> : <div className="space-y-2">{alertas.map((a) => <div key={a.unidade} className="flex items-center gap-2 text-sm rounded-md bg-amber-50 border border-amber-200 p-2"><AlertTriangle className="w-4 h-4 text-amber-600" />{a.unidade}: composição com alta concentração ({a.resumo.oficiais} oficiais / {a.resumo.pracas} praças)</div>)}</div>}</CardContent></Card>
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
