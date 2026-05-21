import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut } from 'lucide-react';

const MilitRow = ({ m, destaque }) => (
  <div className={`text-sm py-1 ${destaque ? 'bg-amber-100 rounded px-2' : ''}`}>
    {m.nome_completo || m.nome_guerra || 'Sem nome'} <span className="text-slate-500">• {m.matricula || 'S/MAT'}</span>
  </div>
);

export default function VisualizacoesGestor({ estrutura, filtro }) {
  const [zoom, setZoom] = useState(1);
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

  return (
    <Tabs defaultValue="organograma" className="space-y-4">
      <TabsList className="grid grid-cols-2 md:grid-cols-4 h-auto">
        <TabsTrigger value="organograma">Organograma</TabsTrigger>
        <TabsTrigger value="kanban">Kanban por Unidade</TabsTrigger>
        <TabsTrigger value="mapa">Mapa Executivo</TabsTrigger>
        <TabsTrigger value="arvore">Árvore com Zoom</TabsTrigger>
      </TabsList>

      <TabsContent value="organograma" className="space-y-3">
        {filtrada.map((setor) => <Card key={setor.setorNome}><CardHeader><CardTitle>{setor.setorNome}</CardTitle></CardHeader><CardContent>{setor.subsetores.map((ss) => <div key={ss.subsetorNome} className="mb-3"><div className="font-semibold text-slate-700">{ss.subsetorNome}</div>{ss.unidades.map((u) => <div key={u.unidadeNome} className="ml-4 mt-1"><div className="text-sm text-slate-600">{u.unidadeNome} <Badge variant="outline">{u.militares.length}</Badge></div>{u.militares.map((m) => <MilitRow key={m.id || `${m.matricula}-${m.nome_completo}`} m={m} destaque={militarMatch(m) && q} />)}</div>)}</div>)}</CardContent></Card>)}
      </TabsContent>

      <TabsContent value="kanban"><div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">{unidadesFlat.map((u) => <Card key={u.unidadeNome}><CardHeader><CardTitle className="text-base">{u.unidadeNome}</CardTitle></CardHeader><CardContent>{u.militares.map((m) => <MilitRow key={m.id || m.matricula} m={m} destaque={militarMatch(m) && q} />)}</CardContent></Card>)}</div></TabsContent>

      <TabsContent value="mapa"><div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">{unidadesFlat.map((u) => <Card key={u.unidadeNome}><CardHeader><CardTitle className="text-sm">{u.unidadeNome}</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{u.militares.length}</p><p className="text-xs text-slate-500">militares</p></CardContent></Card>)}</div></TabsContent>

      <TabsContent value="arvore" className="space-y-3">
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setZoom((z) => Math.max(0.7, z - 0.1))}><ZoomOut className="w-4 h-4" /></Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setZoom((z) => Math.min(1.5, z + 0.1))}><ZoomIn className="w-4 h-4" /></Button>
          <Badge variant="secondary">Zoom: {Math.round(zoom * 100)}%</Badge>
        </div>
        <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }} className="space-y-2">
          {filtrada.map((s) => <div key={s.setorNome} className="border rounded p-2"><div className="font-semibold">{s.setorNome}</div>{s.subsetores.map((ss) => <div key={ss.subsetorNome} className="ml-4"><div>{ss.subsetorNome}</div>{ss.unidades.map((u) => <div key={u.unidadeNome} className="ml-4 text-sm">{u.unidadeNome} ({u.militares.length})</div>)}</div>)}</div>)}
        </div>
      </TabsContent>
    </Tabs>
  );
}
