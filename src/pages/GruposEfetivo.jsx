import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { UsersRound, Plus, Search, UserPlus, UserMinus, Power, Pencil, X } from 'lucide-react';

const TIPOS = [
  ['GRUPO_SERVICO', 'Grupo de serviço'],
  ['EQUIPE_OPERACIONAL', 'Equipe operacional'],
  ['SEGMENTO_ADMINISTRATIVO', 'Segmento administrativo'],
  ['QUALIFICACAO', 'Qualificação'],
  ['OUTRO', 'Outro'],
];

const FORM = { nome: '', sigla: '', tipo: 'SEGMENTO_ADMINISTRATIVO', descricao: '', ativo: true, data_inicio: '', data_fim: '', origem: 'MANUAL', observacoes: '' };

export default function GruposEfetivo() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [busca, setBusca] = useState('');
  const [grupoId, setGrupoId] = useState(null);
  const [form, setForm] = useState(FORM);
  const [editando, setEditando] = useState(false);
  const [militarBusca, setMilitarBusca] = useState('');

  const { data: grupos = [], isLoading: carregandoGrupos } = useQuery({
    queryKey: ['grupos-efetivo'],
    queryFn: () => base44.entities.GrupoEfetivo.list('-created_date'),
  });
  const { data: membros = [] } = useQuery({
    queryKey: ['membros-grupo-efetivo', grupoId],
    queryFn: () => grupoId ? base44.entities.MembroGrupoEfetivo.filter({ grupo_id: grupoId }) : Promise.resolve([]),
    enabled: Boolean(grupoId),
  });
  const { data: militares = [] } = useQuery({
    queryKey: ['militares-grupos-efetivo'],
    queryFn: () => base44.entities.Militar.list('nome', 500),
  });

  const grupoAtual = grupos.find((g) => g.id === grupoId) || null;
  const membrosIds = useMemo(() => new Set(membros.map((m) => String(m.militar_id))), [membros]);
  const filtrados = useMemo(() => grupos.filter((g) => {
    const alvo = `${g.nome || ''} ${g.sigla || ''} ${g.tipo || ''}`.toLowerCase();
    return alvo.includes(busca.toLowerCase());
  }), [grupos, busca]);
  const militaresDisponiveis = useMemo(() => militares.filter((m) => {
    const alvo = `${m.nome || ''} ${m.matricula || ''} ${m.posto_graduacao || ''}`.toLowerCase();
    return !membrosIds.has(String(m.id)) && alvo.includes(militarBusca.toLowerCase());
  }).slice(0, 30), [militares, membrosIds, militarBusca]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['grupos-efetivo'] });
    qc.invalidateQueries({ queryKey: ['membros-grupo-efetivo', grupoId] });
  };

  const salvar = useMutation({
    mutationFn: () => grupoId ? base44.entities.GrupoEfetivo.update(grupoId, form) : base44.entities.GrupoEfetivo.create(form),
    onSuccess: (g) => {
      refresh();
      setGrupoId(g?.id || grupoId);
      setEditando(false);
      toast({ title: 'Grupo salvo com sucesso.' });
    },
    onError: (e) => toast({ title: 'Não foi possível salvar o grupo.', description: e?.message, variant: 'destructive' }),
  });

  const alternar = useMutation({
    mutationFn: (g) => base44.entities.GrupoEfetivo.update(g.id, { ativo: g.ativo === false }),
    onSuccess: () => { refresh(); toast({ title: 'Status do grupo atualizado.' }); },
    onError: (e) => toast({ title: 'Não foi possível atualizar o grupo.', description: e?.message, variant: 'destructive' }),
  });

  const vincular = useMutation({
    mutationFn: (militarId) => base44.entities.MembroGrupoEfetivo.create({ grupo_id: grupoId, militar_id: militarId, ativo: true, origem: 'MANUAL' }),
    onSuccess: () => { refresh(); setMilitarBusca(''); toast({ title: 'Militar incluído no grupo.' }); },
    onError: (e) => toast({ title: 'Não foi possível incluir o militar.', description: e?.message, variant: 'destructive' }),
  });

  const desvincular = useMutation({
    mutationFn: (membroId) => base44.entities.MembroGrupoEfetivo.update(membroId, { ativo: false, data_fim: new Date().toISOString().slice(0, 10) }),
    onSuccess: () => { refresh(); toast({ title: 'Militar removido do grupo.' }); },
    onError: (e) => toast({ title: 'Não foi possível remover o militar.', description: e?.message, variant: 'destructive' }),
  });

  const novo = () => { setGrupoId(null); setForm(FORM); setEditando(true); };
  const editar = (g) => { setGrupoId(g.id); setForm({ ...FORM, ...g }); setEditando(true); };
  const selecionar = (g) => { setGrupoId(g.id); setEditando(false); };

  return <div className="min-h-screen bg-slate-50 p-6">
    <div className="max-w-7xl mx-auto space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div className="flex gap-3 items-start">
          <UsersRound className="w-8 h-8 text-indigo-600 mt-1" />
          <div><h1 className="text-2xl font-bold text-slate-900">Grupos do efetivo</h1><p className="text-sm text-slate-500 mt-1">Cadastre segmentos reutilizáveis para campanhas, escalas e filtros operacionais.</p></div>
        </div>
        <Button onClick={novo}><Plus className="w-4 h-4 mr-2" />Novo grupo</Button>
      </header>
      <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">Um grupo pode ser usado em várias campanhas e futuramente nas escalas. A alteração do grupo não altera campanhas já encerradas.</div>
      <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-6">
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b"><div className="relative"><Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" /><Input className="pl-9" placeholder="Buscar grupo..." value={busca} onChange={(e) => setBusca(e.target.value)} /></div></div>
          <div className="divide-y divide-slate-100 max-h-[620px] overflow-auto">
            {carregandoGrupos && <p className="p-5 text-sm text-slate-500">Carregando grupos...</p>}
            {!carregandoGrupos && filtrados.length === 0 && <p className="p-5 text-sm text-slate-500">Nenhum grupo cadastrado.</p>}
            {filtrados.map((g) => <button type="button" key={g.id} onClick={() => selecionar(g)} className={`w-full text-left p-4 hover:bg-slate-50 ${grupoId === g.id ? 'bg-indigo-50 border-l-4 border-indigo-500' : ''}`}>
              <div className="flex items-center justify-between gap-2"><span className="font-semibold text-slate-900">{g.nome}</span><span className={`text-xs rounded-full px-2 py-1 ${g.ativo === false ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700'}`}>{g.ativo === false ? 'Inativo' : 'Ativo'}</span></div>
              <div className="text-xs text-slate-500 mt-1">{g.sigla || 'Sem sigla'} · {TIPOS.find(([v]) => v === g.tipo)?.[1] || g.tipo}</div>
            </button>)}
          </div>
        </section>
        <section className="space-y-6">
          {!grupoAtual && !editando && <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center text-slate-500"><UsersRound className="w-10 h-10 mx-auto mb-3 text-slate-300" /><p>Selecione um grupo para administrar seus membros ou crie um novo.</p></div>}
          {editando && <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex justify-between items-center mb-5"><h2 className="font-semibold text-slate-900">{grupoId ? 'Editar grupo' : 'Novo grupo'}</h2><Button variant="ghost" size="icon" onClick={() => setEditando(false)}><X className="w-4 h-4" /></Button></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Nome"><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></Field>
              <Field label="Sigla"><Input value={form.sigla} onChange={(e) => setForm({ ...form, sigla: e.target.value.toUpperCase() })} /></Field>
              <Field label="Tipo"><select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>{TIPOS.map(([v, l]) => <option value={v} key={v}>{l}</option>)}</select></Field>
              <Field label="Início de validade"><Input type="date" value={form.data_inicio || ''} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} /></Field>
              <Field label="Fim de validade"><Input type="date" value={form.data_fim || ''} onChange={(e) => setForm({ ...form, data_fim: e.target.value })} /></Field>
              <Field label="Descrição"><Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></Field>
            </div>
            <div className="flex justify-end gap-3 mt-5"><Button variant="outline" onClick={() => setEditando(false)}>Cancelar</Button><Button disabled={salvar.isPending || !form.nome.trim()} onClick={() => salvar.mutate()}>Salvar grupo</Button></div>
          </div>}
          {grupoAtual && !editando && <><div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold text-slate-900">{grupoAtual.nome}</h2><p className="text-sm text-slate-500">{grupoAtual.descricao || 'Sem descrição'}</p><p className="text-xs text-slate-500 mt-2">{membros.filter((m) => m.ativo !== false).length} membro(s) ativo(s) · {grupoAtual.ativo === false ? 'grupo inativo' : 'grupo ativo'}</p></div><div className="flex gap-2"><Button variant="outline" onClick={() => editar(grupoAtual)}><Pencil className="w-4 h-4 mr-2" />Editar</Button><Button variant="outline" onClick={() => alternar.mutate(grupoAtual)}><Power className="w-4 h-4 mr-2" />{grupoAtual.ativo === false ? 'Reativar' : 'Desativar'}</Button></div></div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5"><h3 className="font-semibold text-slate-900 mb-3">Adicionar militar</h3><div className="relative mb-3"><Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" /><Input className="pl-9" placeholder="Nome ou matrícula..." value={militarBusca} onChange={(e) => setMilitarBusca(e.target.value)} /></div><div className="max-h-80 overflow-auto divide-y">{militaresDisponiveis.map((m) => <div key={m.id} className="flex items-center justify-between gap-2 py-2"><div><p className="text-sm font-medium">{m.nome_completo || m.nome || 'Militar sem nome'}</p><p className="text-xs text-slate-600">Nome de guerra: {m.nome_guerra || '—'}</p><p className="text-xs text-slate-500">{m.matricula || m.posto_graduacao || '—'}</p></div><Button size="sm" variant="outline" onClick={() => vincular.mutate(m.id)} disabled={vincular.isPending}><UserPlus className="w-4 h-4" /></Button></div>)}{militarBusca && militaresDisponiveis.length === 0 && <p className="text-sm text-slate-500 py-3">Nenhum militar disponível.</p>}</div></div>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5"><h3 className="font-semibold text-slate-900 mb-3">Membros do grupo</h3><div className="max-h-96 overflow-auto divide-y">{membros.filter((m) => m.ativo !== false).map((m) => { const militar = militares.find((x) => x.id === m.militar_id); return <div key={m.id} className="flex items-center justify-between gap-2 py-2"><div><p className="text-sm font-medium">{militar?.nome_completo || militar?.nome || 'Militar não localizado'}</p><p className="text-xs text-slate-600">Nome de guerra: {militar?.nome_guerra || '—'}</p><p className="text-xs text-slate-500">{militar?.matricula || militar?.posto_graduacao || '—'}</p></div><Button size="sm" variant="ghost" onClick={() => desvincular.mutate(m.id)} disabled={desvincular.isPending}><UserMinus className="w-4 h-4 text-rose-600" /></Button></div>; })}{membros.filter((m) => m.ativo !== false).length === 0 && <p className="text-sm text-slate-500 py-3">Nenhum membro ativo.</p>}</div></div>
          </div></>}
        </section>
      </div>
    </div>
  </div>;
}
function Field({ label, children }) { return <label className="block"><span className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">{label}</span>{children}</label>; }
