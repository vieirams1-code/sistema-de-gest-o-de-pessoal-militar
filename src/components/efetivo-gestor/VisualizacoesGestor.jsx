import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Building2, MapPinned, Shield, UserRound, Users, ZoomIn, ZoomOut } from 'lucide-react';

const RESERVA_LABEL = 'Não informada';

const toPosto = (m) => String(m.posto_grad || m.posto || m.graduacao || '').toUpperCase();
const toNome = (m) => m.nome_completo || m.nome_guerra || 'Sem nome';
const toQuadro = (m) => m.quadro || m.condicao || m.situacao || RESERVA_LABEL;
const isTemporario = (m) => /(TEMP|TEMPOR|VOLUNT|CONTRAT)/i.test(`${m.condicao || ''} ${m.quadro || ''} ${m.situacao || ''}`);
const isOficial = (m) => /(CEL|TCEL|MAJ|CAP|TEN|ASP|OFICIAL|CORONEL)/i.test(toPosto(m));
const isPraca = (m) => !isOficial(m);

const summarizeMilitares = (militares = []) => {
  const total = militares.length;
  const oficiais = militares.filter(isOficial).length;
  const pracas = militares.filter(isPraca).length;
  const temporarios = militares.filter(isTemporario).length;
  return { total, oficiais, pracas, temporarios };
};

const MilitarMiniCard = ({ m, compact = false, destaque = false }) => (
  <div className={`group flex items-center justify-between rounded-2xl border ${destaque ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'} ${compact ? 'px-3 py-2' : 'px-4 py-3'} shadow-sm hover:border-blue-200 hover:shadow-md`}>
    <div className="min-w-0">
      <div className="truncate text-sm font-bold text-slate-900"><span className="text-blue-700">{toPosto(m) || 'SD'}</span> {toNome(m)}</div>
      <div className="mt-0.5 truncate text-xs text-slate-500">{toQuadro(m)} · Efetivo</div>
    </div>
    <UserRound className="h-4 w-4 text-slate-300" />
  </div>
);

const Kpi = ({ label, value, tone = 'slate' }) => (
  <div className={`rounded-2xl p-3 text-center ${tone === 'blue' ? 'bg-blue-50' : tone === 'emerald' ? 'bg-emerald-50' : 'bg-slate-50'}`}>
    <div className="text-lg font-black text-slate-900">{value}</div><div className="text-[11px] text-slate-500">{label}</div>
  </div>
);

function TreeNode({ node, searchTerm, expanded, onToggle }) {
  const isOpen = expanded[node.key] ?? true;
  const hasChildren = (node.children || []).length > 0;
  const resumo = summarizeMilitares(node.militares || []);

  return (
    <div className="flex flex-col items-center">
      <Card className="rounded-3xl border-slate-200 shadow-sm bg-white min-w-[280px]">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-500">{node.type}</p>
              <CardTitle className="text-sm">{node.title}</CardTitle>
            </div>
            <Badge variant="outline">{resumo.total}</Badge>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-2">
            <Kpi label="Total" value={resumo.total} />
            <Kpi label="Of" value={resumo.oficiais} tone="blue" />
            <Kpi label="Pr" value={resumo.pracas} tone="emerald" />
          </div>
          {hasChildren ? (
            <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => onToggle(node.key)}>
              {isOpen ? 'Colapsar' : 'Expandir'}
            </Button>
          ) : null}
        </CardHeader>
        {node.type === 'Unidade' ? (
          <CardContent className="pt-0 space-y-2 max-h-[220px] overflow-auto">
            {(node.militares || []).map((m) => (
              <MilitarMiniCard key={m.id || `${m.matricula}-${toNome(m)}`} m={m} compact destaque={Boolean(searchTerm && [m.nome_completo, m.nome_guerra, m.matricula].some((v) => String(v || '').toLowerCase().includes(searchTerm)))} />
            ))}
          </CardContent>
        ) : null}
      </Card>

      {hasChildren && isOpen ? (
        <>
          <div className="w-px h-8 bg-slate-300" />
          <div className="relative w-full pt-4">
            <div className="h-px bg-slate-300 absolute left-8 right-8 top-0" />
            <div className="flex items-start justify-center gap-4 px-2">
              {node.children.map((child) => (
                <div key={child.key} className="flex flex-col items-center">
                  <div className="w-px h-8 bg-slate-300" />
                  <TreeNode node={child} searchTerm={searchTerm} expanded={expanded} onToggle={onToggle} />
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

export default function VisualizacoesGestor({ estrutura, filtro }) {
  const [zoom, setZoom] = useState(1);
  const [expanded, setExpanded] = useState({});
  const q = String(filtro || '').trim().toLowerCase();
  const militarMatch = (m) => !q || [m.nome_completo, m.nome_guerra, m.matricula].some((v) => String(v || '').toLowerCase().includes(q));

  const filtrada = useMemo(() => estrutura.map((setor) => ({ ...setor, subsetores: setor.subsetores.map((ss) => ({ ...ss, unidades: ss.unidades.map((u) => ({ ...u, militares: u.militares.filter(militarMatch), setorNome: setor.setorNome, subsetorNome: ss.subsetorNome })).filter((u) => u.militares.length > 0 || !q) })).filter((ss) => ss.unidades.length > 0 || !q) })).filter((s) => s.subsetores.length > 0 || !q), [estrutura, q]);

  const unidadesFlat = useMemo(() => filtrada.flatMap((s) => s.subsetores.flatMap((ss) => ss.unidades)), [filtrada]);
  const militarFlat = useMemo(() => unidadesFlat.flatMap((u) => u.militares), [unidadesFlat]);
  const resumoGeral = useMemo(() => summarizeMilitares(militarFlat), [militarFlat]);
  const maxUnidade = Math.max(...unidadesFlat.map((u) => u.militares.length), 1);
  const toggle = (key) => setExpanded((prev) => ({ ...prev, [key]: !(prev[key] ?? true) }));

  const organogramaTree = useMemo(() => filtrada.map((setor) => ({
    key: `setor-${setor.setorNome}`,
    type: 'Setor',
    title: setor.setorNome,
    militares: setor.subsetores.flatMap((ss) => ss.unidades.flatMap((u) => u.militares)),
    children: setor.subsetores.map((ss) => ({
      key: `subsetor-${setor.setorNome}-${ss.subsetorNome}`,
      type: 'Subsetor',
      title: ss.subsetorNome,
      militares: ss.unidades.flatMap((u) => u.militares),
      children: ss.unidades.map((u) => ({
        key: `unidade-${setor.setorNome}-${ss.subsetorNome}-${u.unidadeNome}`,
        type: 'Unidade',
        title: u.unidadeNome,
        militares: u.militares,
        children: [],
      })),
    })),
  })), [filtrada]);

  return (
    <Tabs defaultValue="organograma" className="space-y-4">
      <TabsList className="grid grid-cols-2 md:grid-cols-4 h-auto"><TabsTrigger value="organograma">Organograma</TabsTrigger><TabsTrigger value="kanban">Kanban por Unidade</TabsTrigger><TabsTrigger value="mapa">Mapa Executivo</TabsTrigger><TabsTrigger value="arvore">Árvore com Zoom</TabsTrigger></TabsList>
      <TabsContent value="organograma" className="space-y-4">
        <div className="overflow-x-auto pb-2">
          <div className="min-w-max flex items-start gap-10 px-2">
            {organogramaTree.map((node) => (
              <TreeNode key={node.key} node={node} searchTerm={q} expanded={expanded} onToggle={toggle} />
            ))}
          </div>
        </div>
      </TabsContent>

      <TabsContent value="kanban" className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {unidadesFlat.map((u) => {
            const resumo = summarizeMilitares(u.militares);
            return <Card key={`${u.setorNome}-${u.subsetorNome}-${u.unidadeNome}`} className="rounded-3xl border-slate-200 shadow-sm bg-white flex flex-col">
              <CardHeader className="pb-3 border-b bg-slate-50/80 rounded-t-3xl"><div className="flex items-start justify-between gap-3"><div><CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4 text-blue-700" />{u.unidadeNome}</CardTitle><p className="text-xs text-slate-500 mt-1">{u.setorNome} · {u.subsetorNome}</p></div><Badge variant="outline" className="rounded-full">{resumo.total}</Badge></div>
              <div className="mt-3 grid grid-cols-3 gap-2"><Kpi label="Total" value={resumo.total} /><Kpi label="Oficiais" value={resumo.oficiais} tone="blue" /><Kpi label="Praças" value={resumo.pracas} tone="emerald" /></div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs"><Badge className="bg-blue-600"><Shield className="h-3 w-3 mr-1" />{resumo.oficiais}</Badge><Badge className="bg-emerald-600"><Users className="h-3 w-3 mr-1" />{resumo.pracas}</Badge>{resumo.temporarios > 0 && <Badge variant="secondary">Temp: {resumo.temporarios}</Badge>}</div></CardHeader>
              <CardContent className="pt-3 space-y-2 overflow-auto max-h-[520px]">{u.militares.map((m) => <MilitarMiniCard key={m.id || `${m.matricula}-${toNome(m)}`} m={m} compact destaque={militarMatch(m) && q} />)}</CardContent>
            </Card>;
          })}
        </div>
      </TabsContent>

      <TabsContent value="mapa" className="space-y-4">
        <div className="grid lg:grid-cols-12 gap-4">
          <Card className="lg:col-span-4 rounded-3xl border-slate-200 shadow-sm bg-slate-50"><CardHeader><CardTitle className="text-base flex items-center gap-2"><MapPinned className="h-4 w-4 text-blue-700" />Painel Executivo</CardTitle></CardHeader><CardContent className="space-y-3"><div className="grid grid-cols-2 gap-2"><Kpi label="Militares" value={resumoGeral.total} /><Kpi label="Unidades" value={unidadesFlat.length} /><Kpi label="Oficiais" value={resumoGeral.oficiais} tone="blue" /><Kpi label="Praças" value={resumoGeral.pracas} tone="emerald" /></div><div className="rounded-2xl bg-white border border-slate-200 p-3 text-sm">Temporários: <span className="font-bold">{resumoGeral.temporarios}</span></div><div className="space-y-2">{unidadesFlat.map((u) => {const t = u.militares.length; const width = Math.max(6, Math.round((t / maxUnidade) * 100)); return <div key={`bar-${u.unidadeNome}`}><div className="flex justify-between text-xs text-slate-600"><span className="truncate max-w-[75%]">{u.unidadeNome}</span><span>{t}</span></div><div className="h-2 rounded-full bg-slate-200"><div className="h-2 rounded-full bg-blue-600" style={{ width: `${width}%` }} /></div></div>;})}</div></CardContent></Card>
          <div className="lg:col-span-8 grid md:grid-cols-2 gap-4">{unidadesFlat.map((u) => {const r = summarizeMilitares(u.militares); const semOficial = r.oficiais === 0; const cadastroIncompleto = u.militares.some((m) => !m.matricula || !toPosto(m)); const efetivoElevado = r.total >= Math.max(20, Math.ceil(maxUnidade * 0.8)); return <Card key={`exec-${u.unidadeNome}`} className="rounded-3xl border-slate-200 shadow-sm"><CardHeader className="pb-2"><div className="flex items-start justify-between gap-2"><div><CardTitle className="text-sm">{u.unidadeNome}</CardTitle><p className="text-xs text-slate-500">{u.setorNome} · {u.subsetorNome}</p></div><div className="text-3xl font-black text-slate-900">{r.total}</div></div><div className="flex flex-wrap gap-2"><Badge className="bg-blue-600">Oficiais {r.oficiais}</Badge><Badge className="bg-emerald-600">Praças {r.pracas}</Badge>{r.temporarios > 0 && <Badge variant="secondary">Temp {r.temporarios}</Badge>}</div><div className="flex flex-wrap gap-2 text-xs">{semOficial && <Badge variant="outline" className="border-amber-300 text-amber-700"><AlertTriangle className="h-3 w-3 mr-1" />Sem oficial</Badge>}{cadastroIncompleto && <Badge variant="outline" className="border-orange-300 text-orange-700">Cadastro incompleto</Badge>}{efetivoElevado && <Badge variant="outline" className="border-blue-300 text-blue-700">Efetivo elevado</Badge>}</div></CardHeader><CardContent className="space-y-2">{u.militares.slice(0, 3).map((m) => <MilitarMiniCard key={`top-${m.id || m.matricula || toNome(m)}`} m={m} compact />)}</CardContent></Card>;})}</div>
        </div>
      </TabsContent>

      <TabsContent value="arvore" className="space-y-3">
        <div className="flex gap-2"><Button type="button" variant="outline" size="sm" onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}><ZoomOut className="w-4 h-4" /></Button><Button type="button" variant="outline" size="sm" onClick={() => setZoom(1)}>Reset</Button><Button type="button" variant="outline" size="sm" onClick={() => setZoom((z) => Math.min(1.8, z + 0.1))}><ZoomIn className="w-4 h-4" /></Button><Badge variant="secondary">Zoom: {Math.round(zoom * 100)}%</Badge></div>
        <div className="overflow-auto bg-slate-100 rounded-3xl p-6 border border-slate-200"><div className="min-w-[1180px] origin-top transition-transform" style={{ transform: `scale(${zoom})` }}>
          {filtrada.map((s) => <div key={`tree-${s.setorNome}`} className="mb-8">
            <div className="flex justify-center"><Card className="rounded-3xl shadow-sm border-slate-300 min-w-[280px]"><CardContent className="p-4 text-center"><p className="text-xs text-slate-500">Setor</p><p className="font-bold">{s.setorNome}</p></CardContent></Card></div>
            <div className="mx-auto h-8 w-px bg-slate-300" />
            {s.subsetores.map((ss) => <div key={`ss-${s.setorNome}-${ss.subsetorNome}`} className="mb-6">
              <div className="flex justify-center"><Card className="rounded-3xl shadow-sm border-slate-300 min-w-[260px]"><CardContent className="p-3 text-center"><p className="text-xs text-slate-500">Subsetor</p><p className="font-semibold">{ss.subsetorNome}</p></CardContent></Card></div>
              <div className="mx-auto h-6 w-px bg-slate-300" />
              <div className="relative pt-4"><div className="absolute top-0 left-[8%] right-[8%] h-px bg-slate-300" /><div className="grid grid-cols-3 gap-4">{ss.unidades.map((u) => {const r = summarizeMilitares(u.militares); return <div key={`u-${u.unidadeNome}`} className="relative"><div className="absolute -top-4 left-1/2 -translate-x-1/2 h-4 w-px bg-slate-300" /><Card className="rounded-3xl shadow-sm border-slate-200 bg-white"><CardHeader className="pb-2"><div className="flex justify-between"><CardTitle className="text-sm">{u.unidadeNome}</CardTitle><Badge variant="outline">{r.total}</Badge></div><div className="grid grid-cols-3 gap-2 mt-2"><Kpi label="Total" value={r.total} /><Kpi label="Of" value={r.oficiais} tone="blue" /><Kpi label="Pr" value={r.pracas} tone="emerald" /></div></CardHeader><CardContent className="space-y-2 max-h-[320px] overflow-auto">{u.militares.map((m) => <MilitarMiniCard key={`tree-m-${m.id || m.matricula || toNome(m)}`} m={m} compact destaque={militarMatch(m) && q} />)}</CardContent></Card></div>;})}</div></div>
            </div>)}
          </div>)}
        </div></div>
      </TabsContent>
    </Tabs>
  );
}
