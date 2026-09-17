import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import {
  CalendarClock, ClipboardList, Edit3, MapPin, Plus, Power, Save, ShieldCheck, UsersRound, X,
} from 'lucide-react';

const TABS = [
  ['quartel', 'Quartéis e postos', MapPin],
  ['ala', 'Alas e grupos 24x72', UsersRound],
  ['modelo', 'Modelos de guarnição', ShieldCheck],
  ['empenho', 'Empenhos operacionais', ClipboardList],
];

const EMPTY = {
  quartel: { nome: '', sigla: '', tipo: 'QUARTEL', estrutura_id: '', estrutura_nome: '', observacoes: '', ativo: true },
  ala: { nome: '', sigla: '', quartel_posto_id: '', quartel_posto_nome: '', ciclo: '24X72', hora_inicio: '07:00', hora_fim: '07:00', observacoes: '', ativo: true },
  modelo: { nome: '', descricao: '', quantitativo: 4, auxiliares: 3, possui_motorista: true, grupo_id: '', grupo_nome: '', observacoes: '', ativo: true },
  empenho: { nome: '', tipo: 'TIF_PANTANAL', ciclo: '', data_inicio: '', data_fim: '', destino: '', descricao: '', status: 'PLANEJADO', observacoes: '' },
};

const ENTITY = {
  quartel: 'QuartelPosto',
  ala: 'AlaGrupo',
  modelo: 'ModeloGuarnicao',
  empenho: 'EmpenhoOperacional',
};

async function carregarDados() {
  const [quartel, alas, modelos, vagas, empenhos] = await Promise.all([
    base44.entities.QuartelPosto.list('-created_date', 200),
    base44.entities.AlaGrupo.list('-created_date', 200),
    base44.entities.ModeloGuarnicao.list('-created_date', 200),
    base44.entities.ModeloGuarnicaoVaga.list('ordem', 500),
    base44.entities.EmpenhoOperacional.list('-data_inicio', 200),
  ]);
  return { quartel, alas, modelos, vagas, empenhos };
}

function Campo({ label, children, className = '' }) {
  return <label className={`block ${className}`}><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>{children}</label>;
}

function Status({ ativo }) {
  return <span className={`rounded-full px-2 py-1 text-xs font-medium ${ativo ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{ativo ? 'Ativo' : 'Inativo'}</span>;
}

export default function Sargenteacao() {
  const { isAdmin, canAccessModule, canAccessAction, isLoading, isAccessResolved } = useCurrentUser();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState('quartel');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY.quartel);
  const podeVisualizar = isAdmin || (canAccessModule('sargenteacao') && canAccessAction('visualizar_sargenteacao'));
  const podeGerir = isAdmin || canAccessAction('gerir_sargenteacao');
  const { data = {}, isLoading: carregando, error } = useQuery({
    queryKey: ['sargenteacao-dados'],
    queryFn: carregarDados,
    enabled: isAccessResolved && podeVisualizar,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['sargenteacao-dados'] });
  const iniciarNovo = (tipo = tab) => { setTab(tipo); setEditing(null); setForm({ ...EMPTY[tipo] }); };
  const iniciarEdicao = (tipo, item) => {\n    setTab(tipo);\n    setEditing(item.id);\n    if (tipo === 'modelo') {\n      const vagas = (data.vagas || []).filter((vaga) => vaga.modelo_guarnicao_id === item.id);\n      setForm({ ...EMPTY[tipo], ...item, possui_motorista: vagas.some((vaga) => vaga.funcao_operacional === 'MOTORISTA'), auxiliares: vagas.filter((vaga) => vaga.funcao_operacional === 'AUXILIAR').length });\n      return;\n    }\n    setForm({ ...EMPTY[tipo], ...item });\n  };

  const salvar = useMutation({
    mutationFn: async ({ tipo, values }) => {
      const entity = base44.entities[ENTITY[tipo]];
      const saved = editing ? await entity.update(editing, values) : await entity.create(values);
      if (tipo === 'modelo') {
        const modeloId = editing || saved?.id;
        const existentes = await base44.entities.ModeloGuarnicaoVaga.filter({ modelo_guarnicao_id: modeloId });
        await Promise.all((existentes || []).map((vaga) => base44.entities.ModeloGuarnicaoVaga.delete(vaga.id)));
        const vagas = [];
        if (values.possui_motorista) vagas.push({ modelo_guarnicao_id: modeloId, funcao_operacional: 'MOTORISTA', ordem: 1, obrigatoria: true });
        for (let i = 0; i < Number(values.auxiliares || 0); i += 1) {
          vagas.push({ modelo_guarnicao_id: modeloId, funcao_operacional: 'AUXILIAR', ordem: vagas.length + 1, obrigatoria: true });
        }
        if (vagas.length) await Promise.all(vagas.map((vaga) => base44.entities.ModeloGuarnicaoVaga.create(vaga)));
      }
      return saved;
    },
    onSuccess: () => { refresh(); setEditing(null); setForm({ ...EMPTY[tab] }); toast({ title: 'Registro salvo com sucesso.' }); },
    onError: (e) => toast({ title: 'Não foi possível salvar.', description: e?.message, variant: 'destructive' }),
  });

  const alternar = useMutation({
    mutationFn: ({ tipo, item }) => base44.entities[ENTITY[tipo]].update(item.id, { ativo: item.ativo === false }),
    onSuccess: refresh,
    onError: (e) => toast({ title: 'Não foi possível alterar o status.', description: e?.message, variant: 'destructive' }),
  });

  const salvarFormulario = (event) => {
    event.preventDefault();
    if (!podeGerir) return;
    const values = { ...form };
    if (tab === 'modelo') {
      values.quantitativo = Number(values.quantitativo || 0);
      delete values.auxiliares;
      delete values.possui_motorista;
    }
    salvar.mutate({ tipo: tab, values: tab === 'modelo' ? { ...values, quantitativo: Number(form.quantitativo || 0) } : values });
  };

  const counts = useMemo(() => ({
    quartel: data.quartel?.length || 0,
    ala: data.alas?.length || 0,
    modelo: data.modelos?.length || 0,
    empenho: data.empenhos?.length || 0,
  }), [data]);

  if (isLoading || !isAccessResolved) return null;
  if (!podeVisualizar) return <AccessDenied modulo="Sargenteação" />;

  const lista = tab === 'quartel' ? data.quartel : tab === 'ala' ? data.alas : tab === 'modelo' ? data.modelos : data.empenhos;
  const selectedQuartel = data.quartel?.find((item) => item.id === form.quartel_posto_id);
  const vagasDoModelo = data.vagas?.filter((vaga) => vaga.modelo_guarnicao_id === (editing || form.id)) || [];

  return <div className="min-h-screen bg-slate-50 p-6">
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-indigo-100 p-3 text-indigo-700"><CalendarClock className="h-7 w-7" /></div>
          <div><h1 className="text-2xl font-bold text-slate-900">Sargenteação</h1><p className="mt-1 text-sm text-slate-600">Cadastros operacionais para escalas 24x72, guarnições e empenhos.</p></div>
        </div>
        {podeGerir && <Button onClick={() => iniciarNovo()}><Plus className="mr-2 h-4 w-4" />Novo registro</Button>}
      </header>

      <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-950">
        O comandante é uma atribuição do militar na escala, definida inicialmente pela antiguidade. Ele pode acumular com motorista e não ocupa uma vaga adicional.
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {TABS.map(([key, label, Icon]) => <button type="button" key={key} onClick={() => { setTab(key); setEditing(null); }} className={`rounded-xl border p-4 text-left transition ${tab === key ? 'border-indigo-500 bg-indigo-50 shadow-sm' : 'border-slate-200 bg-white hover:border-indigo-200'}`}>
          <div className="flex items-center justify-between"><Icon className="h-5 w-5 text-indigo-600" /><span className="text-xl font-bold text-slate-900">{carregando ? '—' : counts[key]}</span></div><p className="mt-2 text-sm font-semibold text-slate-800">{label}</p>
        </button>)}
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">Não foi possível carregar os registros.</div>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b p-5"><div><h2 className="font-semibold text-slate-900">{TABS.find(([key]) => key === tab)?.[1]}</h2><p className="text-xs text-slate-500">Registros cadastrados no módulo isolado.</p></div>{podeGerir && <Button variant="outline" size="sm" onClick={() => iniciarNovo()}><Plus className="mr-2 h-4 w-4" />Adicionar</Button>}</div>
          <div className="divide-y divide-slate-100">
            {carregando && <p className="p-6 text-sm text-slate-500">Carregando...</p>}
            {!carregando && (!lista || lista.length === 0) && <div className="p-10 text-center text-sm text-slate-500">Nenhum registro cadastrado nesta categoria.</div>}
            {lista?.map((item) => {
              const titulo = item.nome || item.nome_guerra || item.destino || 'Registro sem nome';
              const detalhe = tab === 'quartel' ? `${item.sigla || 'Sem sigla'} · ${item.tipo}` : tab === 'ala' ? `${item.sigla || 'Sem sigla'} · 24x72` : tab === 'modelo' ? `${item.quantitativo || 0} militares · ${data.vagas?.filter((v) => v.modelo_guarnicao_id === item.id).length || 0} funções` : `${item.tipo} · ${item.data_inicio || 'sem início'}`;
              return <div key={item.id} className="flex items-center justify-between gap-4 p-5">
                <div className="min-w-0"><div className="flex items-center gap-2"><p className="font-semibold text-slate-900">{titulo}</p>{tab !== 'empenho' && <Status ativo={item.ativo !== false} />}</div><p className="mt-1 truncate text-sm text-slate-500">{detalhe}</p>{item.descricao && <p className="mt-1 text-xs text-slate-500">{item.descricao}</p>}</div>
                {podeGerir && <div className="flex shrink-0 gap-2"><Button variant="outline" size="sm" onClick={() => iniciarEdicao(tab, item)}><Edit3 className="mr-2 h-4 w-4" />Editar</Button>{tab !== 'empenho' && <Button variant="ghost" size="icon" onClick={() => alternar.mutate({ tipo: tab, item })}><Power className="h-4 w-4 text-slate-500" /></Button>}</div>}
              </div>;
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between"><div><h2 className="font-semibold text-slate-900">{editing ? 'Editar registro' : 'Novo registro'}</h2><p className="text-xs text-slate-500">Campos da categoria selecionada.</p></div>{editing && <Button variant="ghost" size="icon" onClick={() => { setEditing(null); setForm({ ...EMPTY[tab] }); }}><X className="h-4 w-4" /></Button>}</div>
          <form onSubmit={salvarFormulario} className="space-y-4">
            {tab === 'quartel' && <><Campo label="Nome"><Input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></Campo><div className="grid grid-cols-2 gap-3"><Campo label="Sigla"><Input value={form.sigla} onChange={(e) => setForm({ ...form, sigla: e.target.value.toUpperCase() })} /></Campo><Campo label="Tipo"><select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}><option value="QUARTEL">Quartel</option><option value="POSTO">Posto</option></select></Campo></div><Campo label="ID da estrutura existente"><Input value={form.estrutura_id} onChange={(e) => setForm({ ...form, estrutura_id: e.target.value })} placeholder="Referência opcional" /></Campo><Campo label="Nome da estrutura"><Input value={form.estrutura_nome} onChange={(e) => setForm({ ...form, estrutura_nome: e.target.value })} /></Campo></>}
            {tab === 'ala' && <><Campo label="Nome"><Input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></Campo><div className="grid grid-cols-2 gap-3"><Campo label="Sigla"><Input value={form.sigla} onChange={(e) => setForm({ ...form, sigla: e.target.value.toUpperCase() })} /></Campo><Campo label="Quartel/posto"><select required className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" value={form.quartel_posto_id} onChange={(e) => { const q = data.quartel?.find((item) => item.id === e.target.value); setForm({ ...form, quartel_posto_id: e.target.value, quartel_posto_nome: q?.nome || '' }); }}><option value="">Selecione</option>{data.quartel?.filter((q) => q.ativo !== false).map((q) => <option key={q.id} value={q.id}>{q.nome}</option>)}</select></Campo></div><div className="grid grid-cols-2 gap-3"><Campo label="Início"><Input type="time" value={form.hora_inicio} onChange={(e) => setForm({ ...form, hora_inicio: e.target.value })} /></Campo><Campo label="Fim"><Input type="time" value={form.hora_fim} onChange={(e) => setForm({ ...form, hora_fim: e.target.value })} /></Campo></div><p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">Regime fixo desta primeira etapa: 24x72.</p></>}
            {tab === 'modelo' && <><Campo label="Nome"><Input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></Campo><Campo label="Descrição"><Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></Campo><div className="grid grid-cols-2 gap-3"><Campo label="Quantitativo"><Input required type="number" min="1" value={form.quantitativo} onChange={(e) => setForm({ ...form, quantitativo: e.target.value })} /></Campo><Campo label="Auxiliares"><Input required type="number" min="0" value={form.auxiliares} onChange={(e) => setForm({ ...form, auxiliares: e.target.value })} /></Campo></div><label className="flex items-center gap-2 rounded-lg bg-slate-50 p-3 text-sm"><input type="checkbox" checked={Boolean(form.possui_motorista)} onChange={(e) => setForm({ ...form, possui_motorista: e.target.checked })} /> Possui vaga operacional de motorista</label><p className="rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-xs text-indigo-900">O comandante será escolhido depois entre os militares escalados, pela antiguidade. Não é contado no quantitativo.</p></>}
            {tab === 'empenho' && <><Campo label="Nome da missão"><Input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></Campo><div className="grid grid-cols-2 gap-3"><Campo label="Tipo"><select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}><option value="TIF_PANTANAL">TIF / Pantanal</option><option value="MISSAO_DESLOCAMENTO">Missão / deslocamento</option><option value="OUTRA">Outra</option></select></Campo><Campo label="Ciclo"><Input value={form.ciclo} onChange={(e) => setForm({ ...form, ciclo: e.target.value })} placeholder="Ex.: ciclo 1" /></Campo></div><div className="grid grid-cols-2 gap-3"><Campo label="Data inicial"><Input required type="date" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} /></Campo><Campo label="Data final"><Input required type="date" value={form.data_fim} onChange={(e) => setForm({ ...form, data_fim: e.target.value })} /></Campo></div><Campo label="Destino"><Input value={form.destino} onChange={(e) => setForm({ ...form, destino: e.target.value })} /></Campo><Campo label="Descrição"><Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></Campo><Campo label="Status"><select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="PLANEJADO">Planejado</option><option value="ATIVO">Ativo</option><option value="ENCERRADO">Encerrado</option><option value="CANCELADO">Cancelado</option></select></Campo></>}

            {podeGerir && <div className="flex justify-end gap-2 pt-3"><Button type="button" variant="outline" onClick={() => { setEditing(null); setForm({ ...EMPTY[tab] }); }}>Limpar</Button><Button type="submit" disabled={salvar.isPending}><Save className="mr-2 h-4 w-4" />{salvar.isPending ? 'Salvando...' : 'Salvar'}</Button></div>}
          </form>
          {tab === 'modelo' && editing && <div className="mt-5 border-t pt-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Funções do modelo</p><p className="mt-2 text-sm text-slate-600">{vagasDoModelo.map((vaga) => vaga.funcao_operacional).join(' + ') || 'Nenhuma função cadastrada'}</p></div>}
          {tab === 'ala' && selectedQuartel && <p className="mt-4 text-xs text-slate-500">Vinculado a: {selectedQuartel.nome}</p>}
        </section>
      </div>
    </div>
  </div>;
}
