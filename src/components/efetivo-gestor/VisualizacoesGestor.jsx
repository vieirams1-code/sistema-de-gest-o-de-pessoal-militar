import React, { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Building2, MapPin, Users, User, ChevronRight, Search, LayoutGrid, ListTree, AlignLeft } from 'lucide-react';
import { classificarMilitar, ordenarMilitaresAntiguidade, resolvePostoGraduacao } from '@/utils/efetivo/gestorClassificacao';
import { filtrarUnidadesCartoes } from '@/utils/efetivo/visualizacaoGestor';

const summarizeMilitares = (militares = []) => {
  const oficiais = militares.filter((m) => classificarMilitar(m) === 'oficial').length;
  const temporarios = militares.filter((m) => classificarMilitar(m) === 'temporario').length;
  const total = militares.length;
  return { total, oficiais, pracas: total - oficiais - temporarios, temporarios };
};

function normalizarBuscaLocal(valor) {
  return String(valor || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getTagIdLocal(tag) {
  return normalizarBuscaLocal(tag?.id || tag?.nome || tag?.label || tag);
}

function getTagNomeLocal(tag) {
  if (!tag) return "";
  if (typeof tag === "string") return tag;
  return tag.nome || tag.label || tag.tag || tag.name || "";
}

function getTagsDoMilitarModal(militar) {
  return militar?.tags_resolvidas || militar?.tagsCompactas || militar?.tags || [];
}

function militarPassaFiltroModal(militar, busca, tagsSelecionadas) {
  const termo = normalizarBuscaLocal(busca);

  const textoMilitar = normalizarBuscaLocal([
    militar?.nome_guerra_resolvido, militar?.nome_guerra, militar?.nomeGuerra,
    militar?.nome, militar?.nome_completo, militar?.posto_graduacao_resolvido,
    militar?.posto_graduacao, militar?.postoGraduacao, militar?.matricula,
    militar?.cpf, militar?.quadro
  ].filter(Boolean).join(" "));

  const passaBusca = !termo || textoMilitar.includes(termo);
  const tagsMilitar = getTagsDoMilitarModal(militar).map(getTagIdLocal).filter(Boolean);

  const passaTags = !tagsSelecionadas.length || tagsSelecionadas.every((tagId) => tagsMilitar.includes(tagId));

  return passaBusca && passaTags;
}

const montarNos = (estrutura = []) => estrutura.map((setor, sIdx) => ({
  id: `setor-${sIdx}-${setor.setorNome}`,
  tipo: 'Setor',
  nome: setor.setorNome,
  sigla: setor.setorSigla,
  militares: [],
  filhos: (setor.subsetores || []).map((subsetor, ssIdx) => ({
    id: `subsetor-${sIdx}-${ssIdx}-${subsetor.subsetorNome}`,
    tipo: 'Subsetor',
    nome: subsetor.subsetorNome,
    sigla: subsetor.subsetorSigla,
    militares: [],
    filhos: (subsetor.unidades || []).map((unidade, uIdx) => ({
      id: `unidade-${sIdx}-${ssIdx}-${uIdx}-${unidade.unidadeNome}`,
      tipo: 'Unidade',
      nome: unidade.unidadeNome,
      sigla: unidade.unidadeSigla,
      setorNome: setor.setorNome,
      subsetorNome: subsetor.subsetorNome,
      militares: unidade.militares || [],
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
  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
    <span className="font-semibold text-slate-800">{resolvePostoGraduacao(militar) || 'S/Posto'}</span>{' '}
    <span className="text-slate-700">{militar.nome_guerra || militar.nome_completo || 'Sem nome'}</span>
  </div>
);

function SecaoEfetivo({ titulo, militares, observacao, totalOriginal }) {
  const totalAtual = militares?.length || 0;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div>
          <div className="text-sm font-black text-slate-900">{titulo}</div>
          {observacao ? (
            <div className="mt-0.5 text-xs text-slate-500">{observacao}</div>
          ) : null}
        </div>

        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
          {totalAtual}
          {typeof totalOriginal === "number" && totalOriginal !== totalAtual
            ? ` de ${totalOriginal}`
            : ""}
        </span>
      </div>

      {militares?.length ? (
        <div className="space-y-2 p-3">
          {militares.map((militar, indice) => (
            <MembroChip key={militar.id || militar.matricula || `${titulo}-${indice}`} militar={militar} />
          ))}
        </div>
      ) : (
        <div className="px-4 py-8 text-center text-sm text-slate-500">
          Nenhum militar encontrado com os filtros aplicados.
        </div>
      )}
    </section>
  );
}

const TreeNode = ({ no, expandedUnits, onToggleUnit }) => {
  const [expandedNode, setExpandedNode] = useState(true);
  const [buscaMembros, setBuscaMembros] = useState('');
  const [tagsSelecionadasModal, setTagsSelecionadasModal] = useState([]);

  const isUnidade = no.tipo === 'Unidade';
  const corTipo = isUnidade ? 'border-l-4 border-l-emerald-400' : no.tipo === 'Subsetor' ? 'border-l-4 border-l-purple-400' : 'border-l-4 border-l-blue-400';
  const resumo = isUnidade ? summarizeMilitares(no.militares) : null;

  useEffect(() => {
    if (!expandedUnits[no.id]) {
      setBuscaMembros('');
      setTagsSelecionadasModal([]);
    }
  }, [expandedUnits, no.id]);

  const tagsDisponiveisModal = useMemo(() => {
    if (!isUnidade) return [];
    const mapa = new Map();
    for (const militar of no.militares || []) {
      for (const tag of getTagsDoMilitarModal(militar)) {
        const id = getTagIdLocal(tag);
        const nome = getTagNomeLocal(tag);
        if (!id || !nome) continue;
        if (!mapa.has(id)) mapa.set(id, { id, nome, total: 0 });
        mapa.get(id).total += 1;
      }
    }
    return Array.from(mapa.values()).sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      return a.nome.localeCompare(b.nome, "pt-BR");
    });
  }, [no.militares, isUnidade]);

  const oficiaisFiltrados = useMemo(() => {
    if (!isUnidade) return [];
    return (no.militares || []).filter((m) => classificarMilitar(m) === 'oficial' && militarPassaFiltroModal(m, buscaMembros, tagsSelecionadasModal));
  }, [no.militares, buscaMembros, tagsSelecionadasModal, isUnidade]);

  const pracasFiltradas = useMemo(() => {
    if (!isUnidade) return [];
    return (no.militares || []).filter((m) => classificarMilitar(m) !== 'oficial' && militarPassaFiltroModal(m, buscaMembros, tagsSelecionadasModal));
  }, [no.militares, buscaMembros, tagsSelecionadasModal, isUnidade]);

  const totalFiltrado = oficiaisFiltrados.length + pracasFiltradas.length;
  const totalOriginal = no.militares?.length || 0;

  return (
    <div className="flex flex-col items-center">
      <div className={`w-[300px] rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${corTipo}`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs text-slate-500">{no.tipo}</p>
            <p className="text-sm font-semibold text-slate-900">{no.nome} {no.sigla ? `(${no.sigla})` : ''}</p>
          </div>
          <Badge variant="outline">{countTotal(no)}</Badge>
        </div>
        {isUnidade ? (
          <>
            <ResumoInstitucional resumo={resumo} />
            <button type="button" onClick={() => onToggleUnit(no.id)} className="mt-3 text-xs font-medium text-emerald-700">
              {expandedUnits[no.id] ? 'Ocultar membros' : 'Ver membros'}
            </button>
            {expandedUnits[no.id] ? (
              <div className="mt-2 w-full text-left">
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center">
                    <div className="relative flex-1">
                      <input
                        value={buscaMembros}
                        onChange={(e) => setBuscaMembros(e.target.value)}
                        placeholder="Pesquisar por nome, matrícula, posto, quadro..."
                        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                    <div className="text-xs font-semibold text-slate-500">
                      {totalFiltrado} de {totalOriginal} militares
                    </div>
                    {(buscaMembros || tagsSelecionadasModal.length > 0) ? (
                      <button type="button" onClick={() => { setBuscaMembros(""); setTagsSelecionadasModal([]); }} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100">
                        Limpar filtros
                      </button>
                    ) : null}
                  </div>
                  {tagsDisponiveisModal.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {tagsDisponiveisModal.slice(0, 16).map((tag) => {
                        const ativo = tagsSelecionadasModal.includes(tag.id);
                        return (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => setTagsSelecionadasModal((atuais) => ativo ? atuais.filter((id) => id !== tag.id) : [...atuais, tag.id])}
                            className={["rounded-full border px-3 py-1 text-xs font-semibold transition", ativo ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"].join(" ")}
                          >
                            {tag.nome}
                            <span className="ml-1 text-[10px] opacity-70">{tag.total}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 space-y-4">
                  <SecaoEfetivo
                    titulo="Oficiais"
                    militares={oficiaisFiltrados}
                    totalOriginal={resumo.oficiais}
                  />
                  <SecaoEfetivo
                    titulo="Praças"
                    observacao="Inclui Subtenentes e Temporários."
                    militares={pracasFiltradas}
                    totalOriginal={resumo.pracas + resumo.temporarios}
                  />
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
      {no.filhos?.length ? <div className="h-8 w-px bg-slate-300" /> : null}
      {no.filhos?.length && expandedNode ? (
        <>
          <div className="h-px w-full bg-slate-300" />
          <div className="mt-4 flex flex-wrap justify-center gap-6">
            {no.filhos.map((filho) => <TreeNode key={filho.id} no={filho} expandedUnits={expandedUnits} onToggleUnit={onToggleUnit} />)}
          </div>
        </>
      ) : null}
      {no.filhos?.length ? <button type="button" className="mt-2 text-xs text-slate-600" onClick={() => setExpandedNode((p) => !p)}>{expandedNode ? 'Recolher nível' : 'Expandir nível'}</button> : null}
    </div>
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
  const [expandedUnitsTree, setExpandedUnitsTree] = useState({});
  const [expandedListNodes, setExpandedListNodes] = useState({});
  const [buscaCartoes, setBuscaCartoes] = useState('');

  const q = String(filtro || '').trim().toLowerCase();
  const filtrada = useMemo(() => (estrutura || []).map((setor) => ({
    ...setor,
    subsetores: (setor.subsetores || []).map((subsetor) => ({
      ...subsetor,
      unidades: (subsetor.unidades || []).map((unidade) => ({
        ...unidade,
        militares: ordenarMilitaresAntiguidade((unidade.militares || []).filter((m) => !q || [m.nome_completo, m.nome_guerra, m.matricula].some((v) => String(v || '').toLowerCase().includes(q))), ordemAntiguidadeMap),
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

  const toggleUnit = (id) => setExpandedUnitsTree((prev) => ({ ...prev, [id]: !prev[id] }));
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

      {activeView === 'arvore' ? <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-slate-50 p-6"><div className="flex min-w-max justify-center gap-8">{nos.map((no) => <TreeNode key={no.id} no={no} expandedUnits={expandedUnitsTree} onToggleUnit={toggleUnit} />)}</div></div> : null}

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
    </div>
  );
}
