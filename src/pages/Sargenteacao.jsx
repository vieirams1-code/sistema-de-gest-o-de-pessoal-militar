import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CalendarClock,
  MapPin,
  ShieldCheck,
  UsersRound,
  ClipboardList,
  CircleDot,
  ArrowRight,
} from 'lucide-react';

const cards = [
  { key: 'quartel', title: 'Quartéis e postos', entity: 'QuartelPosto', icon: MapPin, description: 'Bases físicas da sargenteação' },
  { key: 'alas', title: 'Alas e grupos', entity: 'AlaGrupo', icon: UsersRound, description: 'Organização do regime 24x72' },
  { key: 'modelos', title: 'Modelos de guarnição', entity: 'ModeloGuarnicao', icon: ShieldCheck, description: 'Composição operacional reutilizável' },
  { key: 'escalas', title: 'Escalas de serviço', entity: 'EscalaServico', icon: CalendarClock, description: 'Escalas em rascunho ou publicadas' },
  { key: 'empenhos', title: 'Empenhos operacionais', entity: 'EmpenhoOperacional', icon: ClipboardList, description: 'TIF/Pantanal e missões externas' },
];

async function carregarResumo() {
  const [quartel, alas, modelos, escalas, empenhos, participacoes] = await Promise.all([
    base44.entities.QuartelPosto.list('-created_date', 100),
    base44.entities.AlaGrupo.list('-created_date', 100),
    base44.entities.ModeloGuarnicao.list('-created_date', 100),
    base44.entities.EscalaServico.list('-created_date', 100),
    base44.entities.EmpenhoOperacional.list('-created_date', 100),
    base44.entities.EscalaMilitar.list('-created_date', 500),
  ]);
  return { quartel, alas, modelos, escalas, empenhos, participacoes };
}

export default function Sargenteacao() {
  const { isAdmin, canAccessModule, canAccessAction, isLoading, isAccessResolved } = useCurrentUser();
  const podeVisualizar = isAdmin || (canAccessModule('sargenteacao') && canAccessAction('visualizar_sargenteacao'));
  const { data = {}, isLoading: carregando, error } = useQuery({
    queryKey: ['sargenteacao-resumo'],
    queryFn: carregarResumo,
    enabled: isAccessResolved && podeVisualizar,
  });

  if (isLoading || !isAccessResolved) return null;
  if (!podeVisualizar) return <AccessDenied modulo="Sargenteação" />;

  const totalEscalas = data.escalas?.length || 0;
  const escalasPublicadas = data.escalas?.filter((item) => item.status === 'PUBLICADA').length || 0;
  const empenhosAtivos = data.empenhos?.filter((item) => ['PLANEJADO', 'ATIVO'].includes(item.status)).length || 0;
  const comandantes = data.participacoes?.filter((item) => item.eh_comandante === true).length || 0;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-indigo-100 p-3 text-indigo-700">
              <CalendarClock className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900">Sargenteação</h1>
                <Badge variant="outline">Fundação</Badge>
              </div>
              <p className="mt-1 max-w-3xl text-sm text-slate-600">
                Módulo isolado para planejamento de escalas 24x72, guarnições, disponibilidade e empenhos operacionais.
              </p>
            </div>
          </div>
          <Button variant="outline" disabled>
            Nova escala <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </header>

        <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-950">
          O comandante não é uma vaga: ele será atribuído ao militar mais antigo da composição e poderá acumular com a função de motorista.
        </div>

        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">Não foi possível carregar o resumo do módulo.</div>}

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          {cards.map(({ key, title, entity, icon: Icon, description }) => (
            <Card key={key} className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Icon className="h-5 w-5 text-indigo-600" />
                  <span className="text-2xl font-bold text-slate-900">{carregando ? '—' : data[entity === 'QuartelPosto' ? 'quartel' : entity === 'AlaGrupo' ? 'alas' : entity === 'ModeloGuarnicao' ? 'modelos' : entity === 'EscalaServico' ? 'escalas' : 'empenhos']?.length || 0}</span>
                </div>
                <CardTitle className="text-base">{title}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-slate-500">{description}</CardContent>
            </Card>
          ))}
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card><CardContent className="flex items-center gap-3 p-5"><CircleDot className="h-5 w-5 text-emerald-600" /><div><p className="text-xs uppercase tracking-wide text-slate-500">Escalas publicadas</p><p className="text-xl font-bold">{carregando ? '—' : `${escalasPublicadas} de ${totalEscalas}`}</p></div></CardContent></Card>
          <Card><CardContent className="flex items-center gap-3 p-5"><ClipboardList className="h-5 w-5 text-amber-600" /><div><p className="text-xs uppercase tracking-wide text-slate-500">Empenhos em acompanhamento</p><p className="text-xl font-bold">{carregando ? '—' : empenhosAtivos}</p></div></CardContent></Card>
          <Card><CardContent className="flex items-center gap-3 p-5"><ShieldCheck className="h-5 w-5 text-indigo-600" /><div><p className="text-xs uppercase tracking-wide text-slate-500">Comandos atribuídos</p><p className="text-xl font-bold">{carregando ? '—' : comandantes}</p></div></CardContent></Card>
        </section>

        <Card className="border-dashed border-slate-300 bg-white">
          <CardHeader><CardTitle className="text-base">Próximas entregas do módulo</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm text-slate-600 md:grid-cols-3">
            <p>• Cadastro de quartéis, postos, alas e grupos em 24x72.</p>
            <p>• Montagem de guarnições com motorista e auxiliares.</p>
            <p>• Disponibilidade integrada por referência a férias, atestados, JISO e empenhos.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
