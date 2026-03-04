import React, { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, User, Filter, ClipboardList, Shield, Award, Calendar, BookOpen, FileText, Activity, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';

const TIPOS = [
  { value: 'todos', label: 'Todos os Registros' },
  { value: 'punicao', label: 'Punições' },
  { value: 'atestado', label: 'Atestados Médicos' },
  { value: 'ferias', label: 'Férias' },
  { value: 'livro', label: 'Registros do Livro' },
  { value: 'publicacao', label: 'Publicações Ex Officio' },
  { value: 'medalha', label: 'Medalhas' },
  { value: 'comportamento', label: 'Histórico de Comportamento' },
];

const tipoConfig = {
  punicao: { label: 'Punição', color: 'bg-red-100 text-red-700', icon: Shield },
  atestado: { label: 'Atestado Médico', color: 'bg-blue-100 text-blue-700', icon: FileText },
  ferias: { label: 'Férias', color: 'bg-green-100 text-green-700', icon: Calendar },
  livro: { label: 'Registro do Livro', color: 'bg-purple-100 text-purple-700', icon: BookOpen },
  publicacao: { label: 'Publicação Ex Officio', color: 'bg-amber-100 text-amber-700', icon: ClipboardList },
  medalha: { label: 'Medalha', color: 'bg-yellow-100 text-yellow-700', icon: Award },
  comportamento: { label: 'Comportamento', color: 'bg-slate-100 text-slate-700', icon: Activity },
};

function formatDate(d) {
  if (!d) return '—';
  try { return format(new Date(d + 'T00:00:00'), 'dd/MM/yyyy'); } catch { return d; }
}

function EventCard({ event }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = tipoConfig[event.tipo] || tipoConfig.publicacao;
  const Icon = cfg.icon;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div
        className="flex items-start gap-4 p-4 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.color.replace('text-', 'bg-').replace('bg-', 'bg-opacity-20 bg-')}`} style={{background: 'transparent'}}>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${cfg.color}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge className={cfg.color + ' text-xs'}>{cfg.label}</Badge>
            {event.subtipo && <span className="text-xs text-slate-500 font-medium">{event.subtipo}</span>}
          </div>
          <p className="font-medium text-slate-900 text-sm">{event.titulo}</p>
          {event.resumo && <p className="text-sm text-slate-500 mt-0.5 line-clamp-2">{event.resumo}</p>}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-sm text-slate-500 whitespace-nowrap">{formatDate(event.data)}</span>
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </div>
      {expanded && event.detalhes && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3 bg-slate-50">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {event.detalhes.map((d, i) => d.valor ? (
              <div key={i}>
                <p className="text-xs text-slate-500">{d.label}</p>
                <p className="text-sm font-medium text-slate-800">{d.valor}</p>
              </div>
            ) : null)}
          </div>
        </div>
      )}
    </div>
  );
}

export default function FichaMilitar() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const militarId = searchParams.get('id');

  const [tipoFiltro, setTipoFiltro] = useState('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  const { data: militar } = useQuery({
    queryKey: ['militar', militarId],
    queryFn: async () => { const r = await base44.entities.Militar.filter({ id: militarId }); return r[0]; },
    enabled: !!militarId
  });

  const { data: punicoes = [] } = useQuery({
    queryKey: ['ficha-punicoes', militarId],
    queryFn: () => base44.entities.Punicao.filter({ militar_id: militarId }),
    enabled: !!militarId
  });

  const { data: atestados = [] } = useQuery({
    queryKey: ['ficha-atestados', militarId],
    queryFn: () => base44.entities.Atestado.filter({ militar_id: militarId }),
    enabled: !!militarId
  });

  const { data: ferias = [] } = useQuery({
    queryKey: ['ficha-ferias', militarId],
    queryFn: () => base44.entities.Ferias.filter({ militar_id: militarId }),
    enabled: !!militarId
  });

  const { data: registrosLivro = [] } = useQuery({
    queryKey: ['ficha-livro', militarId],
    queryFn: () => base44.entities.RegistroLivro.filter({ militar_id: militarId }),
    enabled: !!militarId
  });

  const { data: publicacoes = [] } = useQuery({
    queryKey: ['ficha-publicacoes', militarId],
    queryFn: () => base44.entities.PublicacaoExOfficio.filter({ militar_id: militarId }),
    enabled: !!militarId
  });

  const { data: medalhas = [] } = useQuery({
    queryKey: ['ficha-medalhas', militarId],
    queryFn: () => base44.entities.Medalha.filter({ militar_id: militarId }),
    enabled: !!militarId
  });

  const { data: historico = [] } = useQuery({
    queryKey: ['ficha-comportamento', militarId],
    queryFn: () => base44.entities.HistoricoComportamento.filter({ militar_id: militarId }),
    enabled: !!militarId
  });

  const eventos = useMemo(() => {
    const lista = [];

    punicoes.forEach(p => lista.push({
      tipo: 'punicao', data: p.data_aplicacao,
      titulo: `${p.tipo}${p.motivo ? ` — ${p.motivo}` : ''}`,
      resumo: p.motivo,
      subtipo: p.tipo,
      detalhes: [
        { label: 'Tipo', valor: p.tipo },
        { label: 'Data Aplicação', valor: formatDate(p.data_aplicacao) },
        { label: 'Data Início', valor: formatDate(p.data_inicio) },
        { label: 'Data Término', valor: formatDate(p.data_termino) },
        { label: 'Documento', valor: p.documento_referencia },
        { label: 'Observações', valor: p.observacoes },
      ]
    }));

    atestados.forEach(a => lista.push({
      tipo: 'atestado', data: a.data_inicio,
      titulo: `Atestado — ${a.tipo_afastamento || ''}${a.cid_10 ? ` (${a.cid_10})` : ''}`,
      resumo: `${a.dias} dias — ${a.medico || ''}`,
      subtipo: a.tipo_afastamento,
      detalhes: [
        { label: 'Início', valor: formatDate(a.data_inicio) },
        { label: 'Término', valor: formatDate(a.data_termino) },
        { label: 'Dias', valor: a.dias ? `${a.dias} dias` : null },
        { label: 'Médico', valor: a.medico },
        { label: 'CID-10', valor: a.cid_10 },
        { label: 'Status', valor: a.status },
        { label: 'Necessita JISO', valor: a.necessita_jiso ? 'Sim' : 'Não' },
      ]
    }));

    ferias.forEach(f => lista.push({
      tipo: 'ferias', data: f.data_inicio,
      titulo: `Férias — ${f.tipo || 'Regulares'}`,
      resumo: `${f.dias} dias • ${formatDate(f.data_inicio)} a ${formatDate(f.data_fim)}`,
      subtipo: f.tipo,
      detalhes: [
        { label: 'Início', valor: formatDate(f.data_inicio) },
        { label: 'Fim', valor: formatDate(f.data_fim) },
        { label: 'Retorno', valor: formatDate(f.data_retorno) },
        { label: 'Dias', valor: f.dias ? `${f.dias} dias` : null },
        { label: 'Período', valor: f.periodo_aquisitivo_ref },
        { label: 'Status', valor: f.status },
      ]
    }));

    registrosLivro.forEach(r => lista.push({
      tipo: 'livro', data: r.data_registro,
      titulo: r.tipo_registro,
      resumo: r.observacoes,
      subtipo: r.tipo_registro,
      detalhes: [
        { label: 'Tipo', valor: r.tipo_registro },
        { label: 'Data', valor: formatDate(r.data_registro) },
        { label: 'Início', valor: formatDate(r.data_inicio) },
        { label: 'Término', valor: formatDate(r.data_termino) },
        { label: 'Dias', valor: r.dias ? `${r.dias} dias` : null },
        { label: 'Documento', valor: r.documento_referencia },
        { label: 'BG', valor: r.numero_bg },
        { label: 'Observações', valor: r.observacoes },
      ]
    }));

    publicacoes.forEach(p => lista.push({
      tipo: 'publicacao', data: p.data_publicacao,
      titulo: `${p.tipo}${p.subtipo_geral ? ` — ${p.subtipo_geral}` : ''}`,
      resumo: p.texto_publicacao?.substring(0, 120),
      subtipo: p.tipo,
      detalhes: [
        { label: 'Tipo', valor: p.tipo },
        { label: 'Data', valor: formatDate(p.data_publicacao) },
        { label: 'BG', valor: p.numero_bg },
        { label: 'Status', valor: p.status },
        { label: 'Portaria', valor: p.portaria },
        { label: 'Texto', valor: p.texto_publicacao?.substring(0, 200) },
      ]
    }));

    medalhas.forEach(m => lista.push({
      tipo: 'medalha', data: m.data_indicacao,
      titulo: m.tipo_medalha_nome || 'Medalha',
      resumo: `Status: ${m.status}`,
      subtipo: m.status,
      detalhes: [
        { label: 'Medalha', valor: m.tipo_medalha_nome },
        { label: 'Indicação', valor: formatDate(m.data_indicacao) },
        { label: 'Concessão', valor: formatDate(m.data_concessao) },
        { label: 'Status', valor: m.status },
        { label: 'Documento', valor: m.documento_referencia },
      ]
    }));

    historico.forEach(h => lista.push({
      tipo: 'comportamento', data: h.data_alteracao,
      titulo: `Comportamento: ${h.comportamento_anterior || 'N/D'} → ${h.comportamento_novo}`,
      resumo: `Motivo: ${h.motivo}`,
      subtipo: h.motivo,
      detalhes: [
        { label: 'Anterior', valor: h.comportamento_anterior },
        { label: 'Novo', valor: h.comportamento_novo },
        { label: 'Motivo', valor: h.motivo },
        { label: 'Data', valor: formatDate(h.data_alteracao) },
        { label: 'Observações', valor: h.observacoes },
      ]
    }));

    return lista.sort((a, b) => {
      if (!a.data && !b.data) return 0;
      if (!a.data) return 1;
      if (!b.data) return -1;
      return new Date(b.data) - new Date(a.data);
    });
  }, [punicoes, atestados, ferias, registrosLivro, publicacoes, medalhas, historico]);

  const eventosFiltrados = useMemo(() => {
    return eventos.filter(e => {
      if (tipoFiltro !== 'todos' && e.tipo !== tipoFiltro) return false;
      if (searchTerm && !e.titulo?.toLowerCase().includes(searchTerm.toLowerCase()) && !e.resumo?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (dataInicio && e.data && e.data < dataInicio) return false;
      if (dataFim && e.data && e.data > dataFim) return false;
      return true;
    });
  }, [eventos, tipoFiltro, searchTerm, dataInicio, dataFim]);

  if (!militarId) return <div className="p-8 text-center text-slate-500">Militar não especificado.</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-[#1e3a5f]">Ficha Militar</h1>
            {militar && (
              <p className="text-slate-500 text-sm">
                {militar.posto_graduacao} {militar.nome_completo} · Mat. {militar.matricula}
              </p>
            )}
          </div>
          {militar && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate(createPageUrl('VerMilitar') + `?id=${militarId}`)}>
                <User className="w-4 h-4 mr-2" />
                Ver Cadastro
              </Button>
            </div>
          )}
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6 space-y-3">
          <div className="flex items-center gap-2 text-slate-600 font-medium text-sm">
            <Filter className="w-4 h-4" />
            Filtros
          </div>
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Buscar nos registros..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
              <SelectTrigger className="w-full md:w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col md:flex-row gap-3 items-center">
            <label className="text-sm text-slate-500 whitespace-nowrap">Período:</label>
            <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="flex-1" placeholder="Data início" />
            <span className="text-slate-400 text-sm">até</span>
            <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="flex-1" placeholder="Data fim" />
            {(dataInicio || dataFim || tipoFiltro !== 'todos' || searchTerm) && (
              <Button variant="ghost" size="sm" onClick={() => { setDataInicio(''); setDataFim(''); setTipoFiltro('todos'); setSearchTerm(''); }}>
                Limpar
              </Button>
            )}
          </div>
        </div>

        {/* Contagem */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-slate-500">
            {eventosFiltrados.length} {eventosFiltrados.length === 1 ? 'registro' : 'registros'}
            {eventos.length !== eventosFiltrados.length && ` (de ${eventos.length} no total)`}
          </p>
        </div>

        {/* Timeline */}
        {eventosFiltrados.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <ClipboardList className="w-14 h-14 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold text-slate-700">Nenhum registro encontrado</h3>
            <p className="text-slate-500 text-sm mt-1">Tente ajustar os filtros</p>
          </div>
        ) : (
          <div className="space-y-3">
            {eventosFiltrados.map((event, i) => (
              <EventCard key={i} event={event} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}