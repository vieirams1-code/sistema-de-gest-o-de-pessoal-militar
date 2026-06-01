import React, { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Building2, MapPin, Users, User, ChevronRight, Search, LayoutGrid, ListTree, AlignLeft, GitBranch, X } from 'lucide-react';
import { classificarMilitar, ordenarMilitaresAntiguidade, resolvePostoGraduacao } from '@/utils/efetivo/gestorClassificacao';
import { filtrarUnidadesCartoes } from '@/utils/efetivo/visualizacaoGestor';
import { calcularResumoEfetivo, obterGrupoHierarquicoMilitar, obterSexoMilitar } from '@/utils/efetivo/montarArvoreLotacaoMilitares';

const summarizeMilitares = (militares = []) => {
  const oficiais = militares.filter((m) => classificarMilitar(m) === 'oficial').length;
  const temporarios = militares.filter((m) => classificarMilitar(m) === 'temporario').length;
  const total = militares.length;
  return { total, oficiais, pracas: total - oficiais - temporarios, temporarios };
};

const montarNos = (estrutura = []) => estrutura.map((setor, sIdx) => ({
  id: `setor-${sIdx}-${setor.setorNome}`,
  tipo: 'Setor',
  nome: setor.setorNome,
  sigla: setor.setorSigla,
  discreto: setor.setorNome === 'Setor não informado',
  militares: [],
  filhos: (setor.subsetores || []).map((subsetor, ssIdx) => ({
    id: `subsetor-${sIdx}-${ssIdx}-${subsetor.subsetorNome}`,
    tipo: 'Subsetor',
    nome: subsetor.subsetorNome,
    sigla: subsetor.subsetorSigla,
    discreto: subsetor.subsetorNome === 'Subsetor não informado',
    militares: [],
    filhos: (subsetor.unidades || []).map((unidade, uIdx) => ({
      id: `unidade-${sIdx}-${ssIdx}-${uIdx}-${unidade.unidadeNome}`,
      tipo: 'Unidade',
      nome: unidade.unidadeNome,
      sigla: unidade.unidadeSigla,
      descricao: unidade.unidadeDescricao,
      setorNome: setor.setorNome,
      subsetorNome: subsetor.subsetorNome,
      militares: unidade.militares || [],
      resumoEfetivo: unidade.resumoEfetivo || calcularResumoEfetivo(unidade.militares),
      oficiais: unidade.oficiais || [],
      pracas: unidade.pracas || [],
      filhos: [],
    })),
  })),
}));

const countTotal = (no) => (no.militares?.length || 0) + (no.filhos || []).reduce((acc, filho) => acc + countTotal(filho), 0);

const ResumoInstitucional = ({ resumo }) => (
  <div className="mt-2 flex flex-wrap gap-2 text-xs">
    <Badge variant="secondary" className="bg-slate-100">Oficiais: {resumo.oficiais}</Badge>
    <Badge variant="secondary" className="bg-slate-100">Praças: {resumo.pracas}</Badge>
    {resumo.temporarios > 0 ? <Badge variant="secondary" className="bg-slate-100">Temporários: {resumo.temporarios}</Badge> : null}
  </div>
);

const MembroChip = ({ militar }) => (
  <div className="rounded-lg border border-slate-100 bg-white px-3 py-2 text-xs shadow-sm">
    <p className="truncate font-semibold text-slate-800">{militar.nome_guerra || militar.nome_completo || 'Sem nome'}</p>
    <p className="mt-0.5 truncate text-[11px] text-slate-500">{resolvePostoGraduacao(militar) || 'S/Posto'}</p>
  </div>
);

const TotalBadge = ({ total }) => (
  <Badge variant="outline" className="shrink-0 border-slate-200 bg-white text-slate-600">{total}</Badge>
);

const obterNomeExibicaoMilitar = (militar) => (
  militar?.nome_guerra_resolvido
  || militar?.nome_guerra
  || militar?.nomeGuerra
  || militar?.nome
  || militar?.nome_completo
  || 'Militar'
);

const obterPostoExibicaoMilitar = (militar) => (
  militar?.posto_graduacao_resolvido
  || militar?.posto_graduacao
  || militar?.postoGraduacao
  || militar?.posto
  || militar?.graduacao
  || ''
);

const obterMatriculaExibicaoMilitar = (militar) => militar?.matricula || militar?.matricula_funcional || militar?.numero_matricula || '';

const MetricaUnidade = ({ tipo, label, valor }) => {
  const config = {
    oficiais: 'border-blue-100 bg-blue-50 text-blue-700',
    pracas: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    homens: 'border-slate-200 bg-slate-50 text-slate-700',
    mulheres: 'border-pink-100 bg-pink-50 text-pink-700',
  };
  const icones = { oficiais: '★', pracas: '◆', homens: '👨', mulheres: '👩' };

  return (
    <div className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 ${config[tipo]}`}>
      <span className="text-sm leading-none">{icones[tipo]}</span>
      <div className="min-w-0">
        <div className="text-[9px] font-bold uppercase tracking-wide opacity-80">{label}</div>
        <div className="text-sm font-black leading-none">{valor || 0}</div>
      </div>
    </div>
  );
};

const LinhaMilitarEfetivo = ({ militar, indice }) => {
  const nome = obterNomeExibicaoMilitar(militar);
  const posto = obterPostoExibicaoMilitar(militar);
  const matricula = obterMatriculaExibicaoMilitar(militar);
  const sexo = obterSexoMilitar(militar);
  const tituloSexo = sexo === 'F' ? 'Mulher' : sexo === 'M' ? 'Homem' : 'Sexo não informado';

  return (
    <div className="grid grid-cols-[42px_1fr_46px] items-center border-b border-slate-100 px-4 py-3 last:border-b-0">
      <div className="text-xs font-bold text-slate-400">{indice + 1}</div>
      <div className="min-w-0">
        <div className="truncate text-sm font-bold text-slate-900" title={nome}>{nome}</div>
        <div className="mt-0.5 truncate text-xs text-slate-500">{[posto, matricula ? `Matrícula ${matricula}` : ''].filter(Boolean).join(' • ')}</div>
      </div>
      <div className="text-center text-lg" title={tituloSexo}>{sexo === 'F' ? '👩' : sexo === 'M' ? '👨' : '•'}</div>
    </div>
  );
};

const SecaoEfetivo = ({ titulo, militares, observacao }) => (
  <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
    <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
      <div>
        <div className="text-sm font-black text-slate-900">{titulo}</div>
        {observacao ? <div className="mt-0.5 text-xs text-slate-500">{observacao}</div> : null}
      </div>
      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{militares?.length || 0}</span>
    </div>
    {militares?.length ? (
      <div>{militares.map((militar, indice) => <LinhaMilitarEfetivo key={militar.id || militar.matricula || `${titulo}-${indice}`} militar={militar} indice={indice} />)}</div>
    ) : <div className="px-4 py-6 text-center text-sm text-slate-500">Nenhum militar neste grupo.</div>}
  </section>
);

const ModalEfetivoUnidade = ({ unidade, onClose }) => {
  if (!unidade) return null;
  const subtitulo = [unidade.sigla, unidade.descricao].filter(Boolean).join(' • ');
  const resumo = unidade.resumoEfetivo || {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-labelledby="modal-efetivo-titulo">
      <div className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="border-b border-slate-200 bg-gradient-to-b from-white to-slate-50 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="modal-efetivo-titulo" className="text-lg font-black text-slate-900">Efetivo — {unidade.nome}</h2>
              {subtitulo ? <p className="mt-1 text-sm text-slate-500">{subtitulo}</p> : null}
              <p className="mt-1 text-xs text-slate-500">Ordenado por antiguidade dentro de cada grupo.</p>
            </div>
            <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50" aria-label="Fechar">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
            <MetricaUnidade tipo="oficiais" label="Oficiais" valor={resumo.oficiais} />
            <MetricaUnidade tipo="pracas" label="Praças" valor={resumo.pracas} />
            <MetricaUnidade tipo="homens" label="Homens" valor={resumo.homens} />
            <MetricaUnidade tipo="mulheres" label="Mulheres" valor={resumo.mulheres} />
          </div>
        </header>
        <main className="flex-1 space-y-4 overflow-y-auto bg-white p-5">
          <SecaoEfetivo titulo="Oficiais" militares={unidade.oficiais || []} />
          <SecaoEfetivo titulo="Praças" observacao="Inclui Subtenentes." militares={unidade.pracas || []} />
        </main>
      </div>
    </div>
  );
};

const UnidadeTreeCard = ({ no, onVerMembros }) => (
  <div className="relative flex min-w-0 flex-col pt-6">
    <div className="absolute left-1/2 top-0 h-6 w-px -translate-x-1/2 bg-slate-300" />
    <div className="flex w-[280px] flex-col rounded-xl border border-slate-200 border-l-4 border-l-emerald-400 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600"><MapPin className="h-4 w-4" /></div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-700">Unidade</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900">{no.nome} {no.sigla ? `(${no.sigla})` : ''}</p>
            {no.descricao ? <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{no.descricao}</p> : null}
          </div>
        </div>
        <TotalBadge total={no.militares.length} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <MetricaUnidade tipo="oficiais" label="Oficiais" valor={no.resumoEfetivo?.oficiais} />
        <MetricaUnidade tipo="pracas" label="Praças" valor={no.resumoEfetivo?.pracas} />
        <MetricaUnidade tipo="homens" label="Homens" valor={no.resumoEfetivo?.homens} />
        <MetricaUnidade tipo="mulheres" label="Mulheres" valor={no.resumoEfetivo?.mulheres} />
      </div>
      <button type="button" onClick={() => onVerMembros(no)} className="mt-3 flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
        <span>Ver membros ({no.militares.length})</span><span className="text-slate-400">↗</span>
      </button>
    </div>
  </div>
);

const SubsetorTree = ({ no, onVerMembros }) => {
  const unidades = no.filhos || [];
  const unitGridStyle = { gridTemplateColumns: `repeat(${Math.max(unidades.length, 1)}, minmax(280px, 1fr))` };

  return (
    <div className="relative flex min-w-0 flex-col items-center pt-6">
      <div className="absolute left-1/2 top-0 h-6 w-px -translate-x-1/2 bg-slate-300" />
      <div className="w-[280px] rounded-xl border border-slate-200 border-l-4 border-l-purple-400 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <div className="rounded-lg bg-purple-50 p-2 text-purple-600"><GitBranch className="h-4 w-4" /></div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wide text-purple-700">Subsetor</p>
              <p className={`mt-0.5 text-sm font-semibold ${no.discreto ? 'text-slate-500' : 'text-slate-900'}`}>{no.nome} {no.sigla ? `(${no.sigla})` : ''}</p>
            </div>
          </div>
          <TotalBadge total={countTotal(no)} />
        </div>
      </div>
      {unidades.length > 0 ? (
        <div className="relative w-full pt-8">
          <div className="absolute left-1/2 top-0 h-8 w-px -translate-x-1/2 bg-slate-300" />
          {unidades.length > 1 ? <div className="absolute left-[calc(140px)] right-[calc(140px)] top-8 h-px bg-slate-300" /> : null}
          <div className="grid gap-5" style={unitGridStyle}>
            {unidades.map((unidade) => <UnidadeTreeCard key={unidade.id} no={unidade} onVerMembros={onVerMembros} />)}
          </div>
        </div>
      ) : null}
    </div>
  );
};

const SetorTree = ({ no, onVerMembros }) => {
  const subsetores = no.filhos || [];
  const subsetorGridStyle = { gridTemplateColumns: `repeat(${Math.max(subsetores.length, 1)}, minmax(280px, 1fr))` };

  return (
    <section className="flex min-w-max flex-col items-center rounded-2xl border border-slate-200 bg-white/60 px-5 py-6 shadow-sm">
      <div className="w-[300px] rounded-xl border border-slate-200 border-l-4 border-l-blue-400 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600"><Building2 className="h-4 w-4" /></div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wide text-blue-700">Setor</p>
              <p className={`mt-0.5 text-sm font-semibold ${no.discreto ? 'text-slate-500' : 'text-slate-900'}`}>{no.nome} {no.sigla ? `(${no.sigla})` : ''}</p>
            </div>
          </div>
          <TotalBadge total={countTotal(no)} />
        </div>
      </div>
      {subsetores.length > 0 ? (
        <div className="relative w-full pt-8">
          <div className="absolute left-1/2 top-0 h-8 w-px -translate-x-1/2 bg-slate-300" />
          {subsetores.length > 1 ? <div className="absolute left-[calc(140px)] right-[calc(140px)] top-8 h-px bg-slate-300" /> : null}
          <div className="grid gap-8" style={subsetorGridStyle}>
            {subsetores.map((subsetor) => <SubsetorTree key={subsetor.id} no={subsetor} onVerMembros={onVerMembros} />)}
          </div>
        </div>
      ) : null}
    </section>
  );
};

const renderListaNode = (no, level, expanded, onToggle) => {
  const isUnidade = no.tipo === 'Unidade';
  const aberto = Boolean(expanded[no.id]);
  const resumo = isUnidade ? summarizeMilitares(no.militares) : null;
  const bg = isUnidade ? 'bg-emerald-50' : no.tipo === 'Subsetor' ? 'bg-purple-50' : 'bg-blue-50';

  return (
    <div key={no.id} className="space-y-2">
      <button type="button" onClick={() => onToggle(no.id)} className={`flex w-full items-center justify-between rounded-2xl border border-slate-200 px-3 py-3 text-left shadow-sm ${bg}`} style={{ paddingLeft: `${level * 24 + 16}px` }}>
        <div className="flex items-center gap-2">
          <ChevronRight className={`h-4 w-4 text-slate-600 transition-transform ${aberto ? 'rotate-90' : ''}`} />
          <span className="text-sm font-medium text-slate-800">{no.nome}</span>
        </div>
        <div className="flex items-center gap-2">
          {isUnidade ? <ResumoInstitucional resumo={resumo} /> : null}
          <Badge variant="outline">{countTotal(no)}</Badge>
        </div>
      </button>
      {aberto ? (
        <div className="space-y-2">
          {no.filhos.map((f) => renderListaNode(f, level + 1, expanded, onToggle))}
          {isUnidade ? <div className="grid grid-cols-1 gap-2 pl-8 sm:grid-cols-2 lg:grid-cols-3">{no.militares.map((m) => <div key={`${m.id || m.matricula}-${no.id}`} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"><User className="h-4 w-4 text-slate-500" /><span className="font-semibold">{resolvePostoGraduacao(m)}</span><span>{m.nome_guerra || m.nome_completo}</span></div>)}</div> : null}
        </div>
      ) : null}
    </div>
  );
};

export default function VisualizacoesGestor({ estrutura, filtro, ordemAntiguidadeMap }) {
  const [activeView, setActiveView] = useState('arvore');
  const [unidadeSelecionada, setUnidadeSelecionada] = useState(null);
  const [expandedListNodes, setExpandedListNodes] = useState({});
  const [buscaCartoes, setBuscaCartoes] = useState('');

  const q = String(filtro || '').trim().toLowerCase();
  const filtrada = useMemo(() => (estrutura || []).map((setor) => ({
    ...setor,
    subsetores: (setor.subsetores || []).map((subsetor) => ({
      ...subsetor,
      unidades: (subsetor.unidades || []).map((unidade) => ({
        ...unidade,
        ...(() => {
          const militares = ordenarMilitaresAntiguidade((unidade.militares || []).filter((m) => !q || [m.nome_completo, m.nome_guerra, m.matricula].some((v) => String(v || '').toLowerCase().includes(q))), ordemAntiguidadeMap);
          return {
            militares,
            resumoEfetivo: calcularResumoEfetivo(militares),
            oficiais: militares.filter((militar) => obterGrupoHierarquicoMilitar(militar) === 'oficial'),
            pracas: militares.filter((militar) => obterGrupoHierarquicoMilitar(militar) !== 'oficial'),
          };
        })(),
      })).filter((u) => !q || u.militares.length > 0),
    })).filter((ss) => !q || ss.unidades.length > 0),
  })).filter((s) => !q || s.subsetores.length > 0), [estrutura, q, ordemAntiguidadeMap]);

  const nos = useMemo(() => montarNos(filtrada), [filtrada]);
  const unidades = useMemo(() => filtrada.flatMap((setor) => (setor.subsetores || []).flatMap((subsetor) => (subsetor.unidades || []).map((u) => ({ ...u, setorNome: setor.setorNome, subsetorNome: subsetor.subsetorNome })))), [filtrada]);
  const unidadesFiltradasCartao = useMemo(() => filtrarUnidadesCartoes(unidades, buscaCartoes), [unidades, buscaCartoes]);

  useEffect(() => {
    if (!nos.length) return;
    setExpandedListNodes((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      return nos.reduce((acc, no) => ({ ...acc, [no.id]: true }), {});
    });
  }, [nos]);

  const toggleListNode = (id) => setExpandedListNodes((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-sm font-medium text-slate-700">Visualização da lotação</p>
        <div className="flex rounded-2xl border border-slate-200 bg-white p-1">
          {[{ id: 'arvore', label: 'Árvore', Icon: ListTree }, { id: 'lista', label: 'Lista', Icon: AlignLeft }, { id: 'cartoes', label: 'Cartões', Icon: LayoutGrid }].map(({ id, label, Icon }) => (
            <button key={id} type="button" onClick={() => setActiveView(id)} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${activeView === id ? 'bg-slate-900 text-white' : 'text-slate-700'}`}>
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
      </div>

      {activeView === 'arvore' ? <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-[#f8fafc] p-4 md:p-6"><div className="flex min-w-max items-start justify-center gap-10">{nos.map((no) => <SetorTree key={no.id} no={no} onVerMembros={setUnidadeSelecionada} />)}</div></div> : null}

      {activeView === 'lista' ? <div className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">{nos.map((no) => renderListaNode(no, 0, expandedListNodes, toggleListNode))}</div> : null}

      {activeView === 'cartoes' ? (
        <div className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-800">Unidades em cartões</h3>
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input value={buscaCartoes} onChange={(e) => setBuscaCartoes(e.target.value)} placeholder="Buscar unidade, sigla, setor ou subsetor" className="pl-9" />
            </div>
          </div>
          {unidadesFiltradasCartao.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">Nenhuma unidade encontrada para a busca informada.</div> : null}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {unidadesFiltradasCartao.map((u) => {
              const resumo = summarizeMilitares(u.militares || []);
              return (
                <div key={`${u.setorNome}-${u.subsetorNome}-${u.unidadeNome}`} className="flex min-h-[400px] flex-col rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="space-y-1 pb-3">
                    <p className="text-sm font-semibold text-slate-900"><Building2 className="mr-1 inline h-4 w-4" />{u.unidadeNome} {u.unidadeSigla ? `(${u.unidadeSigla})` : ''}</p>
                    <p className="text-xs text-slate-600"><MapPin className="mr-1 inline h-3 w-3" />{u.setorNome} · {u.subsetorNome}</p>
                    <p className="text-xs font-medium text-slate-500"><Users className="mr-1 inline h-3 w-3" />Total: {resumo.total}</p>
                    <ResumoInstitucional resumo={resumo} />
                  </div>
                  <div className="space-y-2 overflow-y-auto pr-1">
                    {(u.militares || []).map((m) => <MembroChip key={`${m.id || m.matricula}-${u.unidadeNome}`} militar={m} />)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <ModalEfetivoUnidade unidade={unidadeSelecionada} onClose={() => setUnidadeSelecionada(null)} />
    </div>
  );
}
