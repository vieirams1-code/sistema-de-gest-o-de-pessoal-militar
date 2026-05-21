import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  Building2,
  MapPinned,
  Shield,
  ShieldAlert,
  UserCheck,
  UserRound,
  Users,
  ZoomIn,
  ZoomOut,
  Network,
  MapPin,
  ChevronDown,
  ChevronUp,
  User,
} from 'lucide-react';

const toPosto = (m = {}) => String(m.posto_grad || m.posto || m.graduacao || '').toUpperCase();
const toNome = (m = {}) => m.nome_guerra || m.nome_completo || 'Sem nome';
const toNomeCompleto = (m = {}) => m.nome_completo || m.nome_guerra || 'Sem nome';
const toQuadro = (m = {}) => m.quadro || m.condicao || m.situacao || 'Não informada';

const isOficial = (m = {}) => /(CEL|TCEL|MAJ|CAP|TEN|ASP|OFICIAL|CORONEL)/i.test(toPosto(m));
const isTemporario = (m = {}) => {
  const bucket = [m.condicao, m.quadro, m.situacao, m.vinculo, m.tipo_vinculo, m.regime].join(' ');
  return /(TEMP|TEMPOR|VOLUNT|CONTRAT)/i.test(bucket);
};

const summarizeMilitares = (militares = []) => {
  const total = militares.length;
  const oficiais = militares.filter(isOficial).length;
  const temporarios = militares.filter(isTemporario).length;
  return { total, oficiais, pracas: total - oficiais, temporarios };
};

const militarMatch = (m = {}, q = '') => {
  if (!q) return true;
  return [m.nome_completo, m.nome_guerra, m.matricula, m.posto_grad, m.posto, m.graduacao]
    .some((v) => String(v || '').toLowerCase().includes(q));
};

const getResponsavel = (militares = []) => militares.find((m) =>
  /(COMAND|CHEF|RESPONS|DIRETOR|COORDEN|GESTOR|CMT)/i.test(
    [m.funcao, m.cargo, m.funcao_nome, m.designacao].join(' '),
  ));

const getAlertasUnidade = (unidade, limiteEfetivoElevado) => {
  const militares = unidade?.militares || [];
  const responsavel = getResponsavel(militares);
  const resumo = summarizeMilitares(militares);
  const cadastroIncompleto = militares.some((m) => !toNomeCompleto(m) || !toPosto(m) || !m.matricula);
  const alertas = [];
  if (!responsavel) alertas.push('Sem responsável');
  if (resumo.oficiais === 0) alertas.push('Sem oficial');
  if (cadastroIncompleto) alertas.push('Cadastro incompleto');
  if (resumo.total >= limiteEfetivoElevado) alertas.push('Efetivo elevado');
  return alertas;
};

const MilitarMiniCard = ({ militar, q }) => {
  const match = q && militarMatch(militar, q);
  return (
    <div className={`flex items-center justify-between gap-3 rounded-xl border bg-white p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${match ? 'border-indigo-300 bg-indigo-50 ring-1 ring-indigo-300' : 'border-slate-200'}`}>
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100">
          <UserRound className="h-4 w-4 text-slate-500" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-900">{toPosto(militar) || 'S/Posto'} {toNome(militar)}</p>
          <p className="truncate text-xs text-slate-600">{toNomeCompleto(militar)}</p>
          <p className="text-[11px] text-slate-500">Mat: {militar.matricula || 'Não informada'}</p>
        </div>
      </div>
      <Badge variant="secondary" className="shrink-0 bg-slate-100 text-[10px] text-slate-700">{toQuadro(militar)}</Badge>
    </div>
  );
};

const Kpi = ({ label, value, tone = 'slate' }) => {
  const tones = {
    slate: 'bg-slate-50 text-slate-900',
    blue: 'bg-blue-50 text-blue-800',
    emerald: 'bg-emerald-50 text-emerald-800',
    violet: 'bg-violet-50 text-violet-800',
  };
  return <div className={`rounded-2xl p-3 ${tones[tone] || tones.slate}`}><p className="text-[11px] uppercase tracking-wide opacity-70">{label}</p><p className="text-xl font-bold">{value}</p></div>;
};
const OrgPersonCard = ({ militar, searchTerm }) => {
  const isHighlighted = searchTerm && militarMatch(militar, searchTerm);

  return (
    <div className={`flex items-start gap-3 rounded-xl border p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${isHighlighted ? 'border-indigo-300 bg-indigo-50 ring-1 ring-indigo-300' : 'border-slate-200 bg-white'}`} >
      <div className="mt-0.5 rounded-md bg-slate-100 p-2">
        <User className="h-4 w-4 text-slate-600" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900">{toPosto(militar)} {toNome(militar)}</p>
        <p className="truncate text-xs text-slate-600">{toNomeCompleto(militar)}</p>
        <p className="text-[11px] text-slate-500">Mat: {militar.matricula || 'Não informada'}</p>
      </div>
      <Badge variant="secondary" className="text-[10px]">{toQuadro(militar)}</Badge>
    </div>
  );
};

const countPersonnel = (node) => (node?.personnel || []).length + (node?.children || []).reduce((acc, child) => acc + countPersonnel(child), 0);

const OrgTreeNode = ({ node, searchTerm }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const children = node?.children || [];
  const hasChildren = children.length > 0;
  const totalEfetivo = countPersonnel(node);
  const directEfetivo = (node?.personnel || []).length;

  const Icon = node.type === 'Setor' ? ShieldAlert : node.type === 'Subsetor' ? MapPin : Users;

  return (
    <div className="relative flex flex-col items-center">
      <div className="relative z-10 w-[340px] rounded-xl border border-slate-200 bg-white shadow-lg">
        <div className={`rounded-t-xl border-b p-4 ${node.type === 'Setor' ? 'border-indigo-700 bg-indigo-800 text-white' : node.type === 'Subsetor' ? 'border-blue-800 bg-blue-700 text-white' : 'border-slate-200 bg-slate-50 text-slate-900'}`}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Icon className={`h-4 w-4 ${node.type === 'Setor' ? 'text-white' : node.type === 'Subsetor' ? 'text-blue-100' : 'text-emerald-600'}`} />
              <div>
                <p className={`text-xs ${node.type === 'Unidade' ? 'text-slate-500' : 'text-white/80'}`}>{node.type}</p>
                <p className={`text-sm font-semibold ${node.type === 'Unidade' ? 'text-slate-900' : 'text-white'}`}>{node.name}</p>
              </div>
            </div>
            <Badge variant="outline" className={`text-[10px] border-0 ${node.type === 'Setor' ? 'bg-indigo-900/50 text-indigo-100' : node.type === 'Subsetor' ? 'bg-blue-800/50 text-blue-50' : 'bg-slate-100 text-slate-700'}`}>Total: {totalEfetivo}</Badge>
          </div>
          <p className={`mt-2 text-[11px] ${node.type === 'Unidade' ? 'text-slate-500' : 'text-white/80'}`}>Efetivo Direto: {directEfetivo}</p>
        </div>

        <div className="max-h-[320px] space-y-2 overflow-y-auto p-3">
          {(node.personnel || []).length > 0 ? (
            node.personnel.map((m) => (
              <OrgPersonCard key={`${m.id || m.matricula || toNomeCompleto(m)}-${node.id}`} militar={m} searchTerm={searchTerm} />
            ))
          ) : (
            <p className="text-xs text-slate-500">Nenhum militar lotado diretamente.</p>
          )}
        </div>

        {hasChildren ? (
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="absolute -bottom-3 left-1/2 flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full border-2 border-indigo-200 bg-white shadow transition-colors hover:border-indigo-500 hover:bg-indigo-50"
          >
            {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-600" /> : <ChevronDown className="h-4 w-4 text-slate-600" />}
          </button>
        ) : null}
      </div>

      {hasChildren && isExpanded ? (
        <>
          <div className="w-[2px] h-8 bg-slate-300" />
          <div className="flex justify-center relative pt-4">
            {children.map((child, index) => (
              <div key={child.id || `${node.id}-${index}`} className="relative flex flex-col items-center px-4">
                {index !== 0 ? <div className="absolute right-1/2 top-0 h-[2px] w-1/2 bg-slate-300" /> : null}
                {index !== children.length - 1 ? <div className="absolute left-1/2 top-0 h-[2px] w-1/2 bg-slate-300" /> : null}
                <div className="w-[2px] h-6 bg-slate-300" />
                <OrgTreeNode node={child} searchTerm={searchTerm} />
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
};

const TreeNode = ({ node, q, expanded, onToggle }) => {
  const safeNode = { ...(node || {}), militares: node?.militares || [], children: node?.children || [], alertas: node?.alertas || [] };
  const isOpen = expanded[safeNode.key] ?? true;
  return (
    <div className="relative flex flex-col items-center">
      <Card className="w-[320px] rounded-2xl border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{safeNode.type} · {safeNode.title || 'Sem nome'}</CardTitle>
          <p className="text-xs text-slate-600">{safeNode.subtitle || ''}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {safeNode.responsavel ? <Badge variant="outline" className="text-[11px]"><UserCheck className="mr-1 h-3 w-3" />{toNome(safeNode.responsavel)}</Badge> : null}
            {(safeNode.alertas || []).map((a) => <Badge key={a} variant="secondary" className="text-[10px]">{a}</Badge>)}
          </div>
        </CardHeader>
        {safeNode.type === 'Unidade' ? (
          <CardContent>
            <div className="max-h-52 space-y-2 overflow-auto pr-1">
              {safeNode.militares.map((m) => <MilitarMiniCard key={`${m.id || m.matricula || toNomeCompleto(m)}-${safeNode.key}`} militar={m} q={q} />)}
            </div>
          </CardContent>
        ) : null}
      </Card>

      {(safeNode.children || []).length > 0 ? (
        <>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => onToggle(safeNode.key)}>{isOpen ? 'Colapsar' : 'Expandir'}</Button>
          {isOpen ? (
            <div className="relative mt-2 flex flex-col items-center">
              <div className="h-6 w-px bg-slate-300" />
              <div className="relative flex gap-6 pt-4">
                <div className="absolute left-6 right-6 top-0 h-px bg-slate-300" />
                {(safeNode.children || []).map((child, index) => (
                  <div key={child.key || `${safeNode.key}-${index}`} className="relative flex flex-col items-center">
                    <div className="h-4 w-px bg-slate-300" />
                    <TreeNode node={child} q={q} expanded={expanded} onToggle={onToggle} />
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
};

export default function VisualizacoesGestor({ estrutura, filtro }) {
  const [zoom, setZoom] = useState(1);
  const [expanded, setExpanded] = useState({});
  const q = String(filtro || '').trim().toLowerCase();

  const filtrada = useMemo(() => (estrutura || []).map((setor) => ({
    ...setor,
    subsetores: (setor.subsetores || []).map((subsetor) => ({
      ...subsetor,
      unidades: (subsetor.unidades || []).map((unidade) => ({
        ...unidade,
        militares: (unidade.militares || []).filter((m) => militarMatch(m, q)),
      })).filter((u) => !q || u.militares.length > 0),
    })).filter((ss) => !q || ss.unidades.length > 0),
  })).filter((s) => !q || s.subsetores.length > 0), [estrutura, q]);

  const unidadesFlat = useMemo(() => filtrada.flatMap((s) =>
    s.subsetores.flatMap((ss) => ss.unidades.map((u) => ({ ...u, setorNome: s.setorNome, subsetorNome: ss.subsetorNome })))), [filtrada]);
  const militarFlat = useMemo(() => unidadesFlat.flatMap((u) => u.militares), [unidadesFlat]);
  const resumoGeral = useMemo(() => summarizeMilitares(militarFlat), [militarFlat]);
  const maxUnidade = useMemo(() => Math.max(1, ...unidadesFlat.map((u) => u.militares.length)), [unidadesFlat]);
  const limiteEfetivoElevado = useMemo(() => Math.max(20, Math.ceil(maxUnidade * 0.85)), [maxUnidade]);

  const orgTree = useMemo(() => {
    const allUnidades = filtrada.flatMap((setor) =>
      (setor.subsetores || []).flatMap((subsetor) => (subsetor.unidades || []).map((unidade) => ({
        id: `u:${unidade.unidadeNome}`,
        name: unidade.unidadeNome,
        type: 'Unidade',
        personnel: unidade.militares || [],
        children: [],
      }))),
    );

    return {
      id: 'cmb',
      name: 'CMB',
      type: 'Setor',
      personnel: [],
      children: [{
        id: '1gbm',
        name: '1º GBM',
        type: 'Subsetor',
        personnel: [],
        children: allUnidades,
      }],
    };
  }, [filtrada]);

  const organogramaTree = useMemo(() => filtrada.map((setor) => {
    const subsetores = setor.subsetores.map((subsetor) => {
      const unidades = subsetor.unidades.map((unidade) => ({
        key: `u:${setor.setorNome}:${subsetor.subsetorNome}:${unidade.unidadeNome}`,
        type: 'Unidade',
        title: unidade.unidadeNome,
        subtitle: `${unidade.militares.length} militares`,
        militares: unidade.militares,
        responsavel: getResponsavel(unidade.militares),
        alertas: getAlertasUnidade(unidade, limiteEfetivoElevado),
        children: [],
      }));
      const subsetorMil = unidades.flatMap((u) => u.militares);
      return {
        key: `ss:${setor.setorNome}:${subsetor.subsetorNome}`,
        type: 'Subsetor',
        title: subsetor.subsetorNome,
        subtitle: `${unidades.length} unidades`,
        militares: subsetorMil,
        responsavel: getResponsavel(subsetorMil),
        alertas: [],
        children: unidades,
      };
    });
    const setorMil = subsetores.flatMap((ss) => ss.militares);
    return {
      key: `s:${setor.setorNome}`,
      type: 'Setor',
      title: setor.setorNome,
      subtitle: `${subsetores.length} subsetores`,
      militares: setorMil,
      responsavel: getResponsavel(setorMil),
      alertas: [],
      children: subsetores,
    };
  }), [filtrada, limiteEfetivoElevado]);

  const onToggle = (key) => setExpanded((prev) => ({ ...prev, [key]: !(prev[key] ?? true) }));

  return (
    <Tabs defaultValue="organograma" className="space-y-4">
      <TabsList className="grid h-auto grid-cols-2 md:grid-cols-4">
        <TabsTrigger value="organograma"><Network className="mr-1 h-4 w-4" />Organograma</TabsTrigger>
        <TabsTrigger value="kanban"><Building2 className="mr-1 h-4 w-4" />Kanban por Unidade</TabsTrigger>
        <TabsTrigger value="mapa"><MapPinned className="mr-1 h-4 w-4" />Mapa Executivo</TabsTrigger>
        <TabsTrigger value="arvore"><MapPin className="mr-1 h-4 w-4" />Árvore com Zoom</TabsTrigger>
      </TabsList>

      <TabsContent value="organograma">
        <div className="overflow-auto rounded-3xl border border-slate-200 bg-gradient-to-b from-slate-50 to-slate-100 p-8">
          <div className="min-w-max flex justify-center">
            <OrgTreeNode node={orgTree} searchTerm={q} />
          </div>
        </div>
      </TabsContent>

      <TabsContent value="kanban">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {unidadesFlat.map((u) => {
            const r = summarizeMilitares(u.militares);
            return (
              <Card key={`${u.setorNome}-${u.subsetorNome}-${u.unidadeNome}`} className="rounded-3xl">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base"><Building2 className="mr-1 inline h-4 w-4" />{u.unidadeNome}</CardTitle>
                      <p className="text-xs text-slate-600">{u.setorNome} · {u.subsetorNome}</p>
                    </div>
                    <Badge variant="outline">{r.total}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Kpi label="Total" value={r.total} tone="slate" />
                    <Kpi label="Oficiais" value={r.oficiais} tone="blue" />
                    <Kpi label="Praças" value={r.pracas} tone="emerald" />
                    <Kpi label="Temporários" value={r.temporarios} tone="violet" />
                  </div>
                  <div className="max-h-[520px] space-y-2 overflow-auto pr-1">
                    {u.militares.map((m) => <MilitarMiniCard key={`${m.id || m.matricula || toNomeCompleto(m)}-${u.unidadeNome}`} militar={m} q={q} />)}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </TabsContent>

      <TabsContent value="mapa">
        <div className="grid gap-4 lg:grid-cols-12">
          <div className="space-y-3 lg:col-span-4">
            <Kpi label="Total militares" value={resumoGeral.total} />
            <Kpi label="Unidades" value={unidadesFlat.length} tone="violet" />
            <Kpi label="Oficiais" value={resumoGeral.oficiais} tone="blue" />
            <Kpi label="Praças" value={resumoGeral.pracas} tone="emerald" />
            <Kpi label="Temporários" value={resumoGeral.temporarios} tone="slate" />
            <Card className="rounded-3xl">
              <CardHeader><CardTitle className="text-sm">Carga por unidade</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {unidadesFlat.map((u) => (
                  <div key={`bar-${u.unidadeNome}`}>
                    <div className="mb-1 flex justify-between text-xs"><span>{u.unidadeNome}</span><span>{u.militares.length}</span></div>
                    <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-blue-500" style={{ width: `${(u.militares.length / maxUnidade) * 100}%` }} /></div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
          <div className="grid gap-3 lg:col-span-8">
            {unidadesFlat.map((u) => {
              const r = summarizeMilitares(u.militares);
              const alertas = getAlertasUnidade(u, limiteEfetivoElevado);
              return (
                <Card key={`map-${u.unidadeNome}`} className="rounded-3xl">
                  <CardContent className="p-4">
                    <div className="mb-2 flex items-center justify-between"><h4 className="font-semibold">{u.unidadeNome}</h4><p className="text-3xl font-black text-slate-800">{r.total}</p></div>
                    <div className="mb-3 flex flex-wrap gap-2 text-xs">
                      <Badge className="bg-blue-600"><Shield className="mr-1 h-3 w-3" />{r.oficiais}</Badge>
                      <Badge className="bg-emerald-600"><Users className="mr-1 h-3 w-3" />{r.pracas}</Badge>
                      <Badge className="bg-violet-600"><UserCheck className="mr-1 h-3 w-3" />{r.temporarios}</Badge>
                    </div>
                    {alertas.length > 0 ? <div className="mb-3 flex flex-wrap gap-1">{alertas.map((a) => <Badge key={a} variant="secondary" className="text-[10px]"><AlertTriangle className="mr-1 h-3 w-3" />{a}</Badge>)}</div> : null}
                    <div className="grid gap-2 md:grid-cols-3">{u.militares.slice(0, 3).map((m) => <MilitarMiniCard key={`map-m-${m.id || m.matricula || toNomeCompleto(m)}`} militar={m} q={q} />)}</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </TabsContent>

      <TabsContent value="arvore" className="space-y-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setZoom((z) => Math.max(0.6, Number((z - 0.1).toFixed(2))))}><ZoomOut className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setZoom(1)}>Reset</Button>
          <Button variant="outline" size="sm" onClick={() => setZoom((z) => Math.min(1.8, Number((z + 0.1).toFixed(2))))}><ZoomIn className="h-4 w-4" /></Button>
        </div>
        <div className="overflow-auto rounded-3xl border bg-slate-100 p-6">
          <div className="min-w-[1180px]" style={{ transform: `scale(${zoom})`, transformOrigin: 'top' }}>
            <div className="space-y-8">
              {organogramaTree.map((setor) => (
                <div key={`zoom-${setor.key}`} className="space-y-4">
                  <TreeNode node={setor} q={q} expanded={expanded} onToggle={onToggle} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}
