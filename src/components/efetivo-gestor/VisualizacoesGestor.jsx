import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Building2, Network, ShieldAlert, MapPin, Users, UserRound, User } from 'lucide-react';
import { classificarMilitar, ordenarMilitaresAntiguidade, resolvePostoGraduacao, toQuadro } from '@/utils/efetivo/gestorClassificacao';

const toNome = (m = {}) => m.nome_guerra || m.nome_completo || 'Sem nome';
const toNomeCompleto = (m = {}) => m.nome_completo || m.nome_guerra || 'Sem nome';

const summarizeMilitares = (militares = []) => {
  const total = militares.length;
  const oficiais = militares.filter((m) => classificarMilitar(m) === 'oficial').length;
  const temporarios = militares.filter((m) => classificarMilitar(m) === 'temporario').length;
  return { total, oficiais, pracas: total - oficiais - temporarios, temporarios };
};

const militarMatch = (m = {}, q = '') => !q || [m.nome_completo, m.nome_guerra, m.matricula, m.posto_graduacao, m.posto_grad, m.posto, m.graduacao]
  .some((v) => String(v || '').toLowerCase().includes(q));


const MilitarMiniCard = ({ militar, q }) => (
  <div className={`flex items-center justify-between gap-3 rounded-xl border bg-white p-3 shadow-sm ${q && militarMatch(militar, q) ? 'border-indigo-300 bg-indigo-50 ring-1 ring-indigo-300' : 'border-slate-200'}`}>
    <div className="flex min-w-0 items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100"><UserRound className="h-4 w-4 text-slate-500" /></div>
      <div className="min-w-0"><p className="truncate text-sm font-bold text-slate-900">{resolvePostoGraduacao(militar) || 'S/Posto'} {toNome(militar)}</p><p className="truncate text-xs text-slate-600">{toNomeCompleto(militar)}</p></div>
    </div><Badge variant="secondary" className="shrink-0 bg-slate-100 text-[10px] text-slate-700">{toQuadro(militar)}</Badge>
  </div>
);

const OrgPersonCard = ({ militar, searchTerm }) => <div className={`flex items-start gap-3 rounded-xl border p-3 shadow-sm ${searchTerm && militarMatch(militar, searchTerm) ? 'border-indigo-300 bg-indigo-50 ring-1 ring-indigo-300' : 'border-slate-200 bg-white'}`}><div className="mt-0.5 rounded-md bg-slate-100 p-2"><User className="h-4 w-4 text-slate-600" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-900">{resolvePostoGraduacao(militar)} {toNome(militar)}</p></div></div>;
const countPersonnel = (node) => (node?.personnel || []).length + (node?.children || []).reduce((acc, child) => acc + countPersonnel(child), 0);
const OrgTreeNode = ({ node, searchTerm }) => { const [isExpanded, setIsExpanded] = useState(true); const children = node?.children || []; const hasChildren = children.length > 0; const Icon = node.type === 'Setor' ? ShieldAlert : node.type === 'Subsetor' ? MapPin : Users; return <div className="relative flex flex-col items-center"><div className="relative z-10 w-[340px] rounded-xl border border-slate-200 bg-white shadow-lg"><div className="rounded-t-xl border-b p-4"><div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><Icon className="h-4 w-4" /><div><p className="text-xs">{node.type}</p><p className="text-sm font-semibold">{node.name}</p></div></div><Badge variant="outline" className="text-[10px] border-0">Total: {countPersonnel(node)}</Badge></div></div><div className="max-h-[320px] space-y-2 overflow-y-auto p-3">{(node.personnel || []).map((m) => <OrgPersonCard key={`${m.id || m.matricula}-${node.id}`} militar={m} searchTerm={searchTerm} />)}</div></div>{hasChildren && isExpanded ? <div className="mt-4 flex gap-4">{children.map((child) => <OrgTreeNode key={child.id} node={child} searchTerm={searchTerm} />)}</div> : null}<button type="button" onClick={() => setIsExpanded((p) => !p)} className="text-xs mt-2">{isExpanded ? 'Colapsar' : 'Expandir'}</button></div>; };

export default function VisualizacoesGestor({ estrutura, filtro, ordemAntiguidadeMap }) {
  const q = String(filtro || '').trim().toLowerCase();
  const filtrada = useMemo(() => (estrutura || []).map((setor) => ({
    ...setor,
    subsetores: (setor.subsetores || []).map((subsetor) => ({
      ...subsetor,
      unidades: (subsetor.unidades || []).map((unidade) => ({ ...unidade, militares: ordenarMilitaresAntiguidade((unidade.militares || []).filter((m) => militarMatch(m, q)), ordemAntiguidadeMap) })).filter((u) => !q || u.militares.length > 0),
    })).filter((ss) => !q || ss.unidades.length > 0),
  })).filter((s) => !q || s.subsetores.length > 0), [estrutura, q, ordemAntiguidadeMap]);

  const unidadesFlat = useMemo(() => filtrada.flatMap((s) => s.subsetores.flatMap((ss) => ss.unidades.map((u) => ({ ...u, setorNome: s.setorNome, subsetorNome: ss.subsetorNome })))), [filtrada]);
  const orgTree = useMemo(() => ({
    id: 'raiz', name: 'Estrutura', type: 'Setor', personnel: [], children: filtrada.map((setor, sIdx) => ({ id: `s-${sIdx}`, name: setor.setorNome, type: 'Setor', personnel: [], children: (setor.subsetores || []).map((subsetor, ssIdx) => ({ id: `ss-${sIdx}-${ssIdx}`, name: subsetor.subsetorNome, type: 'Subsetor', personnel: [], children: (subsetor.unidades || []).map((unidade, uIdx) => ({ id: `u-${sIdx}-${ssIdx}-${uIdx}`, name: unidade.unidadeNome, type: 'Unidade', personnel: unidade.militares || [], children: [] })) })) }))
  }), [filtrada]);

  return <Tabs defaultValue="organograma" className="space-y-4"><TabsList className="grid h-auto grid-cols-2"><TabsTrigger value="organograma"><Network className="mr-1 h-4 w-4" />Organograma</TabsTrigger><TabsTrigger value="kanban"><Building2 className="mr-1 h-4 w-4" />Kanban por Unidade</TabsTrigger></TabsList><TabsContent value="organograma"><div className="overflow-auto rounded-3xl border border-slate-200 bg-gradient-to-b from-slate-50 to-slate-100 p-8"><div className="min-w-max flex justify-center"><OrgTreeNode node={orgTree} searchTerm={q} /></div></div></TabsContent><TabsContent value="kanban"><div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{unidadesFlat.map((u) => { const r = summarizeMilitares(u.militares); return <Card key={`${u.setorNome}-${u.subsetorNome}-${u.unidadeNome}`} className="rounded-3xl"><CardHeader className="pb-3"><div className="flex items-start justify-between gap-2"><div><CardTitle className="text-base"><Building2 className="mr-1 inline h-4 w-4" />{u.unidadeNome}</CardTitle><p className="text-xs text-slate-600">{u.setorNome} · {u.subsetorNome}</p></div><Badge variant="outline">{r.total}</Badge></div></CardHeader><CardContent className="space-y-3"><div className="max-h-[520px] space-y-2 overflow-auto pr-1">{u.militares.map((m) => <MilitarMiniCard key={`${m.id || m.matricula}-${u.unidadeNome}`} militar={m} q={q} />)}</div></CardContent></Card>; })}</div></TabsContent></Tabs>;
}
