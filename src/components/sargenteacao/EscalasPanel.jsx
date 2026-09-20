import React, { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import {
  adicionarGuarnicao, cancelarEscala, criarEscala, escalarMilitar,
  publicarEscala, removerGuarnicao, removerMilitarEscalado,
} from '@/services/sargenteacaoService';
import { CalendarDays, CheckCircle2, Crown, Plus, Search, Trash2, UsersRound } from 'lucide-react';

const localDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};
const statusStyle = {
  RASCUNHO: 'bg-amber-50 text-amber-700',
  PUBLICADA: 'bg-emerald-50 text-emerald-700',
  CANCELADA: 'bg-rose-50 text-rose-700',
  ENCERRADA: 'bg-slate-100 text-slate-600',
  COMPLETA: 'bg-emerald-50 text-emerald-700',
  INCOMPLETA: 'bg-amber-50 text-amber-700',
};
const labelRole = (role) => role === 'MOTORISTA' ? 'Motorista' : 'Auxiliar';

function Campo({ label, children }) {
  return <label className="block"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>{children}</label>;
}
function Badge({ status }) {
  return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusStyle[status] || 'bg-slate-100 text-slate-600'}`}>{status}</span>;
}

export default function EscalasPanel({ data, podeGerir, carregando, refresh }) {
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState({ data_inicio: localDate(), data_fim: localDate(), quartel_posto_id: '', ala_grupo_id: '', observacoes: '' });
  const [modeloId, setModeloId] = useState('');
  const [nomeGuarnicao, setNomeGuarnicao] = useState('');
  const [searchByCrew, setSearchByCrew] = useState({});
  const [assignment, setAssignment] = useState({});

  const selected = data.escalas?.find((item) => item.id === selectedId) || data.escalas?.[0];
  const crews = data.guarnicoes?.filter((item) => item.escala_servico_id === selected?.id) || [];
  const quartel = data.quartel?.find((item) => item.id === selected?.quartel_posto_id);
  const ala = data.alas?.find((item) => item.id === selected?.ala_grupo_id);
  const alasDisponiveis = data.alas?.filter((item) => item.ativo !== false && item.quartel_posto_id === form.quartel_posto_id) || [];

  const mutate = useMutation({
    mutationFn: ({ fn, args }) => fn(...args),
    onSuccess: async (_, variables) => {
      await refresh();
      if (variables?.success) toast({ title: variables.success });
    },
    onError: (error) => toast({ title: 'Não foi possível concluir.', description: error?.message, variant: 'destructive' }),
  });
  const run = (fn, args, success) => mutate.mutate({ fn, args, success });

  const criar = (event) => {
    event.preventDefault();
    if (form.data_fim < form.data_inicio) {
      toast({ title: 'A data final deve ser igual ou posterior à inicial.', variant: 'destructive' });
      return;
    }
    mutate.mutate({
      fn: criarEscala,
      args: [form],
      success: 'Escala criada em rascunho.',
    }, {
      onSuccess: async (result) => {
        setSelectedId(result?.record?.id || '');
        setForm({ data_inicio: localDate(), data_fim: localDate(), quartel_posto_id: '', ala_grupo_id: '', observacoes: '' });
      },
    });
  };

  const militaryOptions = (crewId) => {
    const text = String(searchByCrew[crewId] || '').toLocaleLowerCase('pt-BR');
    const already = new Set((data.escalados || []).filter((item) => item.escala_servico_id === selected?.id && item.status === 'ESCALADO').map((item) => item.militar_id));
    return (data.militares || []).filter((item) => {
      if (already.has(item.id)) return false;
      if (!text) return true;
      return [item.nome_guerra, item.nome_completo, item.matricula, item.posto_graduacao]
        .some((field) => String(field || '').toLocaleLowerCase('pt-BR').includes(text));
    }).slice(0, 80);
  };

  const totalPreenchido = useMemo(() => crews.reduce((sum, crew) => sum + (data.escalados || []).filter((item) => item.escala_guarnicao_id === crew.id && item.status === 'ESCALADO').length, 0), [crews, data.escalados]);

  if (carregando) return <div className="rounded-2xl border bg-white p-10 text-center text-sm text-slate-500">Carregando escalas...</div>;

  return <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
    <aside className="space-y-4">
      {podeGerir && <form onSubmit={criar} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div><h2 className="font-semibold text-slate-900">Nova escala 24x72</h2><p className="text-xs text-slate-500">Crie o serviço e depois monte suas guarnições.</p></div>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Início"><Input required type="date" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value, data_fim: e.target.value > form.data_fim ? e.target.value : form.data_fim })} /></Campo>
          <Campo label="Fim"><Input required type="date" value={form.data_fim} min={form.data_inicio} onChange={(e) => setForm({ ...form, data_fim: e.target.value })} /></Campo>
        </div>
        <Campo label="Quartel/posto"><select required className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" value={form.quartel_posto_id} onChange={(e) => setForm({ ...form, quartel_posto_id: e.target.value, ala_grupo_id: '' })}><option value="">Selecione</option>{data.quartel?.filter((item) => item.ativo !== false).map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Campo>
        <Campo label="Ala/grupo"><select required disabled={!form.quartel_posto_id} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm disabled:bg-slate-100" value={form.ala_grupo_id} onChange={(e) => setForm({ ...form, ala_grupo_id: e.target.value })}><option value="">Selecione</option>{alasDisponiveis.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Campo>
        <Campo label="Observações"><Input value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></Campo>
        <Button className="w-full" type="submit" disabled={mutate.isPending}><Plus className="mr-2 h-4 w-4" />Criar escala</Button>
      </form>}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b p-4"><h2 className="font-semibold text-slate-900">Escalas cadastradas</h2><p className="text-xs text-slate-500">{data.escalas?.length || 0} registro(s)</p></div>
        <div className="max-h-[520px] divide-y overflow-auto">
          {!data.escalas?.length && <p className="p-8 text-center text-sm text-slate-500">Nenhuma escala criada.</p>}
          {data.escalas?.map((item) => {
            const q = data.quartel?.find((x) => x.id === item.quartel_posto_id);
            const a = data.alas?.find((x) => x.id === item.ala_grupo_id);
            const active = item.id === selected?.id;
            return <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className={`w-full p-4 text-left transition ${active ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}>
              <div className="flex items-center justify-between gap-2"><span className="font-semibold text-slate-900">{item.data_inicio}</span><Badge status={item.status} /></div>
              <p className="mt-1 text-sm text-slate-600">{q?.nome || 'Quartel não identificado'} · {a?.sigla || a?.nome || 'Sem ala'}</p>
              {item.data_fim !== item.data_inicio && <p className="mt-1 text-xs text-slate-500">até {item.data_fim}</p>}
            </button>;
          })}
        </div>
      </section>
    </aside>

    <main className="space-y-4">
      {!selected && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center"><CalendarDays className="mx-auto h-10 w-10 text-slate-300" /><h2 className="mt-3 font-semibold text-slate-700">Crie a primeira escala</h2><p className="mt-1 text-sm text-slate-500">Depois você poderá incluir guarnições e preencher as vagas.</p></div>}
      {selected && <>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><div className="flex items-center gap-2"><h2 className="text-xl font-bold text-slate-900">Escala de {selected.data_inicio}</h2><Badge status={selected.status} /></div><p className="mt-1 text-sm text-slate-600">{quartel?.nome || 'Quartel'} · {ala?.nome || 'Ala'} · 24x72</p><p className="mt-1 text-xs text-slate-500">{crews.length} guarnição(ões) · {totalPreenchido} militar(es) escalado(s)</p></div>
            {podeGerir && selected.status === 'RASCUNHO' && <div className="flex gap-2"><Button variant="outline" onClick={() => run(cancelarEscala, [selected.id], 'Escala cancelada.')}>Cancelar</Button><Button onClick={() => run(publicarEscala, [selected.id], 'Escala publicada.')}><CheckCircle2 className="mr-2 h-4 w-4" />Publicar</Button></div>}
          </div>
        </section>

        {podeGerir && selected.status === 'RASCUNHO' && <section className="flex flex-wrap items-end gap-3 rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
          <Campo label="Modelo de guarnição"><select className="h-10 min-w-64 rounded-md border border-slate-300 bg-white px-3 text-sm" value={modeloId} onChange={(e) => setModeloId(e.target.value)}><option value="">Selecione</option>{data.modelos?.filter((item) => item.ativo !== false).map((item) => <option key={item.id} value={item.id}>{item.nome} ({item.quantitativo})</option>)}</select></Campo>
          <Campo label="Nome nesta escala"><Input placeholder="Opcional" value={nomeGuarnicao} onChange={(e) => setNomeGuarnicao(e.target.value)} /></Campo>
          <Button disabled={!modeloId || mutate.isPending} onClick={() => { run(adicionarGuarnicao, [selected.id, modeloId, nomeGuarnicao], 'Guarnição adicionada.'); setNomeGuarnicao(''); }}><Plus className="mr-2 h-4 w-4" />Adicionar guarnição</Button>
        </section>}

        {!crews.length && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">Esta escala ainda não possui guarnições.</div>}
        {crews.map((crew) => {
          const model = data.modelos?.find((item) => item.id === crew.modelo_guarnicao_id);
          const slots = data.vagas?.filter((item) => item.modelo_guarnicao_id === crew.modelo_guarnicao_id) || [];
          const members = (data.escalados || []).filter((item) => item.escala_guarnicao_id === crew.id && item.status === 'ESCALADO').sort((a, b) => Number(a.ordem_antiguidade || 999) - Number(b.ordem_antiguidade || 999));
          const availableRoles = ['MOTORISTA', 'AUXILIAR'].filter((role) => members.filter((item) => item.funcao_operacional === role).length < slots.filter((item) => item.funcao_operacional === role).length);
          const current = assignment[crew.id] || { militarId: '', role: availableRoles[0] || '' };
          const options = militaryOptions(crew.id);
          return <section key={crew.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b p-5">
              <div><div className="flex items-center gap-2"><UsersRound className="h-5 w-5 text-indigo-600" /><h3 className="font-semibold text-slate-900">{crew.nome || model?.nome}</h3><Badge status={crew.status} /></div><p className="mt-1 text-xs text-slate-500">{members.length}/{crew.quantidade_prevista} vagas preenchidas · comandante calculado pela antiguidade</p></div>
              {podeGerir && selected.status === 'RASCUNHO' && <Button variant="ghost" size="icon" onClick={() => run(removerGuarnicao, [crew.id], 'Guarnição removida.')}><Trash2 className="h-4 w-4 text-rose-600" /></Button>}
            </div>
            <div className="divide-y divide-slate-100">
              {members.map((member) => <div key={member.id} className="flex items-center justify-between gap-3 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${member.eh_comandante ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{member.eh_comandante ? <Crown className="h-4 w-4" /> : member.ordem_antiguidade}</div>
                  <div className="min-w-0"><p className="truncate font-medium text-slate-900">{member.militar_posto} {member.militar_nome}</p><p className="text-xs text-slate-500">{labelRole(member.funcao_operacional)}{member.eh_comandante ? ' · Comandante' : ''}</p></div>
                </div>
                {podeGerir && selected.status === 'RASCUNHO' && <Button variant="ghost" size="icon" onClick={() => run(removerMilitarEscalado, [member.id], 'Militar retirado da guarnição.')}><Trash2 className="h-4 w-4 text-slate-500" /></Button>}
              </div>)}
              {!members.length && <p className="p-5 text-sm text-slate-500">Nenhum militar incluído.</p>}
            </div>

            {podeGerir && selected.status === 'RASCUNHO' && availableRoles.length > 0 && <div className="space-y-3 border-t bg-slate-50 p-4">
              <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><Input className="pl-9" placeholder="Filtrar por nome, matrícula ou posto" value={searchByCrew[crew.id] || ''} onChange={(e) => setSearchByCrew({ ...searchByCrew, [crew.id]: e.target.value })} /></div>
              <div className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
                <select className="h-10 min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm" value={current.militarId} onChange={(e) => setAssignment({ ...assignment, [crew.id]: { ...current, militarId: e.target.value } })}><option value="">Selecione o militar ({options.length} disponível/is)</option>{options.map((item) => <option key={item.id} value={item.id}>{item.posto_graduacao || ''} {item.nome_guerra || item.nome_completo} · {item.matricula}</option>)}</select>
                <select className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm" value={availableRoles.includes(current.role) ? current.role : availableRoles[0]} onChange={(e) => setAssignment({ ...assignment, [crew.id]: { ...current, role: e.target.value } })}>{availableRoles.map((role) => <option key={role} value={role}>{labelRole(role)}</option>)}</select>
                <Button disabled={!current.militarId || mutate.isPending} onClick={() => {
                  const role = availableRoles.includes(current.role) ? current.role : availableRoles[0];
                  run(escalarMilitar, [crew.id, current.militarId, role], 'Militar incluído e comando recalculado.');
                  setAssignment({ ...assignment, [crew.id]: { militarId: '', role } });
                }}>Incluir</Button>
              </div>
              <p className="text-xs text-slate-500">Férias, atestados, empenhos e indisponibilidades são verificados antes da inclusão.</p>
            </div>}
          </section>;
        })}
      </>}
    </main>
  </div>;
}
