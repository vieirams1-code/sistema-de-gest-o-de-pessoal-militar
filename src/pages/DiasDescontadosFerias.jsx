import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Download, CalendarMinus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { listarDescontosFerias } from '@/services/diasDescontadosFeriasService';

const fmt = (v) => (v ? new Date(`${v}T00:00:00`).toLocaleDateString('pt-BR') : '—');
const norm = (v) => String(v || '').toLowerCase();

function csvEscape(v) { return `"${String(v ?? '').replaceAll('"', '""')}"`; }

export default function DiasDescontadosFerias() {
  const navigate = useNavigate();
  const { canAccessModule, canAccessAction, isLoading: loadingUser, isAccessResolved } = useCurrentUser();
  const [filtros, setFiltros] = useState({ militar: '', lotacao: '', periodo: '', status: '', publicacao: '' });

  const canView = canAccessModule('ferias') && (canAccessAction('visualizar_ferias') || canAccessAction('visualizar_creditos_ferias'));
  const { data: descontos = [] } = useQuery({ queryKey: ['dias-descontados-ferias'], queryFn: () => listarDescontosFerias(), enabled: isAccessResolved && canView });
  const { data: militares = [] } = useQuery({ queryKey: ['dias-descontados-ferias-militares'], queryFn: () => base44.entities.Militar.list('nome_completo'), enabled: isAccessResolved && canView });
  const militarById = useMemo(() => new Map(militares.map((m) => [String(m.id), m])), [militares]);

  const filtrados = useMemo(() => descontos.filter((d) => {
    const militar = militarById.get(String(d.militar_id)) || {};
    return (!filtros.militar || norm(`${d.militar_nome} ${militar.nome_completo} ${militar.nome_guerra} ${d.militar_matricula}`).includes(norm(filtros.militar)))
      && (!filtros.lotacao || norm(`${militar.lotacao} ${militar.unidade} ${militar.subunidade}`).includes(norm(filtros.lotacao)))
      && (!filtros.periodo || norm(d.periodo_aquisitivo_ref).includes(norm(filtros.periodo)))
      && (!filtros.status || norm(d.status).includes(norm(filtros.status)))
      && (!filtros.publicacao || norm(`${d.publicacao_id} ${d.publicacao_numero_bg}`).includes(norm(filtros.publicacao)));
  }), [descontos, filtros, militarById]);

  const exportarCsv = () => {
    const header = ['Militar','Lotação','Período aquisitivo','Dias descontados','Publicação de origem','Data','Status','Usuário responsável'];
    const rows = filtrados.map((d) => {
      const militar = militarById.get(String(d.militar_id)) || {};
      return [d.militar_nome || militar.nome_completo, militar.lotacao || militar.unidade, d.periodo_aquisitivo_ref, d.dias_descontados, d.publicacao_numero_bg || d.publicacao_id, d.data_desconto, d.status, d.usuario_criacao];
    });
    const csv = [header, ...rows].map((r) => r.map(csvEscape).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a'); a.href = url; a.download = 'dias-descontados-ferias.csv'; a.click(); URL.revokeObjectURL(url);
  };

  if (!loadingUser && isAccessResolved && !canView) return <AccessDenied modulo="Férias — Dias Descontados" />;

  return <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3"><Button variant="outline" onClick={() => navigate(createPageUrl('Ferias'))}><ArrowLeft className="h-4 w-4 mr-2" />Voltar</Button><div><h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><CalendarMinus className="h-6 w-6" />Dias Descontados</h1><p className="text-slate-500">Histórico rastreável de descontos de férias gerados por publicações RP.</p></div></div>
      <Button onClick={exportarCsv}><Download className="h-4 w-4 mr-2" />Exportar CSV</Button>
    </div>
    <Card><CardHeader><CardTitle>Filtros</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-5">{Object.keys(filtros).map((k) => <Input key={k} placeholder={k[0].toUpperCase()+k.slice(1)} value={filtros[k]} onChange={(e) => setFiltros((p) => ({ ...p, [k]: e.target.value }))} />)}</CardContent></Card>
    <Card><CardContent className="p-0 overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-100 text-slate-600"><tr>{['Militar','Período aquisitivo','Dias descontados','Publicação de origem','Data','Status','Usuário responsável'].map(h => <th key={h} className="text-left px-4 py-3">{h}</th>)}</tr></thead><tbody>{filtrados.map((d) => <tr key={d.id} className="border-t"><td className="px-4 py-3 font-medium">{d.militar_posto} {d.militar_nome}<div className="text-xs text-slate-500">{d.militar_matricula}</div></td><td className="px-4 py-3">{d.periodo_aquisitivo_ref}</td><td className="px-4 py-3">{d.dias_descontados}</td><td className="px-4 py-3">{d.publicacao_numero_bg || d.publicacao_id || '—'}</td><td className="px-4 py-3">{fmt(d.data_desconto)}</td><td className="px-4 py-3"><Badge variant={d.status === 'ativo' ? 'default' : 'secondary'}>{d.status}</Badge></td><td className="px-4 py-3">{d.usuario_criacao || '—'}</td></tr>)}{!filtrados.length && <tr><td colSpan="7" className="px-4 py-8 text-center text-slate-500">Nenhum desconto encontrado.</td></tr>}</tbody></table></CardContent></Card>
  </div>;
}
