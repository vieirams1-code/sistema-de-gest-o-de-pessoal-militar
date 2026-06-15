import React, { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Building2, MapPin, Users, User, ChevronRight, Search, LayoutGrid, ListTree, AlignLeft, GitBranch, X } from 'lucide-react';
import { ordenarMilitaresAntiguidade, resolvePostoGraduacao } from '@/utils/efetivo/gestorClassificacao';
import { filtrarUnidadesCartoes } from '@/utils/efetivo/visualizacaoGestor';
import { getPostoGraduacaoMilitar } from '@/utils/militarPostoGraduacao';
import { isMilitarAtivo } from '@/utils/militarStatus';
import { calcularResumoEfetivo, calcularResumoTags, obterGrupoHierarquicoMilitar, obterSexoMilitar } from '@/utils/efetivo/montarArvoreLotacaoMilitares';

const montarNos = (estrutura = []) => estrutura.map((setor, sIdx) => ({
  id: `setor-${sIdx}-${setor.setorNome}`,
  tipo: 'Setor',
  nome: setor.setorNome,
  sigla: setor.setorSigla,
  discreto: setor.setorNome === 'Setor não informado',
  militares: [],
  resumoEfetivo: setor.resumoEfetivo,
  resumoTags: setor.resumoTags || [],
  filhos: (setor.subsetores || []).map((subsetor, ssIdx) => ({
    id: `subsetor-${sIdx}-${ssIdx}-${subsetor.subsetorNome}`,
    tipo: 'Subsetor',
    nome: subsetor.subsetorNome,
    sigla: subsetor.subsetorSigla,
    discreto: subsetor.subsetorNome === 'Subsetor não informado',
    militares: [],
    resumoEfetivo: subsetor.resumoEfetivo,
    resumoTags: subsetor.resumoTags || [],
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
      resumoTags: unidade.resumoTags || calcularResumoTags(unidade.militares),
      total: unidade.total ?? unidade.militares?.length ?? 0,
      oficiais: unidade.oficiais || [],
      pracas: unidade.pracas || [],
      filhos: [],
    })),
  })),
}));

const countTotal = (no) => (no.militares?.length || 0) + (no.filhos || []).reduce((acc, filho) => acc + countTotal(filho), 0);

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

const obterPostoExibicaoMilitar = (militar) => getPostoGraduacaoMilitar(militar);

const obterMatriculaExibicaoMilitar = (militar) => militar?.matricula || militar?.matricula_funcional || militar?.numero_matricula || '';


function normalizarBuscaModal(valor) {
  return String(valor || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function getTagIdModal(tag) {
  if (!tag) return '';
  if (typeof tag === 'string') return normalizarBuscaModal(tag);
  return normalizarBuscaModal(tag.id || tag.nome || tag.label || tag.tag || tag.name);
}

function getTagNomeModal(tag) {
  if (!tag) return '';
  if (typeof tag === 'string') return tag;
  return tag.nome || tag.label || tag.tag || tag.name || '';
}

function getTagsMilitarModal(militar) {
  return militar?.tags_resolvidas || militar?.tagsCompactas || militar?.tags || [];
}

function militarPassaFiltroModal(militar, busca, tagsSelecionadas) {
  const termo = normalizarBuscaModal(busca);
  const texto = normalizarBuscaModal([
    militar?.nome_guerra_resolvido,
    militar?.nome_guerra,
    militar?.nomeGuerra,
    militar?.nome,
    militar?.nome_completo,
    militar?.posto_graduacao_resolvido,
    militar?.posto_graduacao,
    militar?.postoGraduacao,
    militar?.matricula,
    militar?.matricula_funcional,
    militar?.cpf,
    militar?.quadro,
  ].filter(Boolean).join(' '));
  const passaBusca = !termo || texto.includes(termo);
  const tagsMilitar = getTagsMilitarModal(militar).map(getTagIdModal).filter(Boolean);
  const passaTags = !tagsSelecionadas.length || tagsSelecionadas.every((tagId) => tagsMilitar.includes(tagId));

  return passaBusca && passaTags;
}

function MetricaEfetivoCompacta({ tipo, label, valor }) {
  const config = {
    oficiais: { wrap: 'border-blue-100 bg-blue-50 text-blue-700', icon: '★' },
    pracas: { wrap: 'border-emerald-100 bg-emerald-50 text-emerald-700', icon: '◆' },
    homens: { wrap: 'border-slate-200 bg-slate-50 text-slate-700', icon: '👨' },
    mulheres: { wrap: 'border-pink-100 bg-pink-50 text-pink-700', icon: '👩' },
  }[tipo];

  return (
    <div className={['min-w-0 rounded-lg border px-2 py-1.5', 'flex flex-col items-center justify-center text-center', config.wrap].join(' ')} title={`${label}: ${valor || 0}`}>
      <div className="flex min-w-0 items-center justify-center gap-1 text-[10px] font-black uppercase leading-none">
        <span className="text-xs">{config.icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 text-base font-black leading-none">{valor || 0}</div>
    </div>
  );
}

function ResumoMetricasEfetivo({ resumo }) {
  return (
    <div className="mt-3 grid grid-cols-4 gap-2">
      <MetricaEfetivoCompacta tipo="oficiais" label="Oficiais" valor={resumo?.oficiais || 0} />
      <MetricaEfetivoCompacta tipo="pracas" label="Praças" valor={resumo?.pracas || 0} />
      <MetricaEfetivoCompacta tipo="homens" label="Homens" valor={resumo?.homens || 0} />
      <MetricaEfetivoCompacta tipo="mulheres" label="Mulheres" valor={resumo?.mulheres || 0} />
    </div>
  );
}

function TagsMilitarLinha({ tags = [] }) {
  if (!tags.length) return null;

  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {tags.slice(0, 5).map((tag) => {
        const id = getTagIdModal(tag);
        const nome = getTagNomeModal(tag);

        return (
          <span key={id} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600" title={nome}>
            {nome}
          </span>
        );
      })}
      {tags.length > 5 ? <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-400">+{tags.length - 5}</span> : null}
    </div>
  );
}

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
        <TagsMilitarLinha tags={getTagsMilitarModal(militar)} />
      </div>
      <div className="text-center text-lg" title={tituloSexo}>{sexo === 'F' ? '👩' : sexo === 'M' ? '👨' : '•'}</div>
    </div>
  );
};

const SecaoEfetivo = ({ titulo, militares, observacao, totalOriginal }) => {
  const totalAtual = militares?.length || 0;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div>
          <div className="text-sm font-black text-slate-900">{titulo}</div>
          {observacao ? <div className="mt-0.5 text-xs text-slate-500">{observacao}</div> : null}
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
          {totalAtual}
          {typeof totalOriginal === 'number' && totalOriginal !== totalAtual ? ` de ${totalOriginal}` : ''}
        </span>
      </div>
      {militares?.length ? (
        <div>{militares.map((militar, indice) => <LinhaMilitarEfetivo key={militar.id || militar.matricula || `${titulo}-${indice}`} militar={militar} indice={indice} />)}</div>
      ) : <div className="px-4 py-6 text-center text-sm text-slate-500">Nenhum militar encontrado com os filtros aplicados.</div>}
    </section>
  );
};

const ModalEfetivoUnidade = ({ unidade, onClose }) => {
  const [buscaMembros, setBuscaMembros] = useState('');
  const [tagsSelecionadasModal, setTagsSelecionadasModal] = useState([]);

  useEffect(() => {
    setBuscaMembros('');
    setTagsSelecionadasModal([]);
  }, [unidade?.id]);

  const tagsDisponiveisModal = useMemo(() => {
    const mapa = new Map();

    for (const militar of unidade?.militares || []) {
      for (const tag of getTagsMilitarModal(militar)) {
        const id = getTagIdModal(tag);
        const nome = getTagNomeModal(tag);
        if (!id || !nome) continue;
        if (!mapa.has(id)) mapa.set(id, { id, nome, total: 0 });
        mapa.get(id).total += 1;
      }
    }

    return Array.from(mapa.values()).sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      return a.nome.localeCompare(b.nome, 'pt-BR');
    });
  }, [unidade]);

  const oficiaisFiltrados = useMemo(() => (unidade?.oficiais || []).filter((militar) =>
    militarPassaFiltroModal(militar, buscaMembros, tagsSelecionadasModal)
  ), [unidade, buscaMembros, tagsSelecionadasModal]);

  const pracasFiltradas = useMemo(() => (unidade?.pracas || []).filter((militar) =>
    militarPassaFiltroModal(militar, buscaMembros, tagsSelecionadasModal)
  ), [unidade, buscaMembros, tagsSelecionadasModal]);

  if (!unidade) return null;
  const subtitulo = [unidade.sigla, unidade.descricao].filter(Boolean).join(' • ');
  const resumo = unidade.resumoEfetivo || {};
  const totalFiltrado = oficiaisFiltrados.length + pracasFiltradas.length;
  const totalOriginal = (unidade?.oficiais?.length || 0) + (unidade?.pracas?.length || 0);

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
          <ResumoMetricasEfetivo resumo={resumo} />
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <input value={buscaMembros} onChange={(event) => setBuscaMembros(event.target.value)} placeholder="Pesquisar por nome, matrícula, posto ou quadro..." className="h-10 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100" />
              <div className="text-xs font-semibold text-slate-500">{totalFiltrado} de {totalOriginal} militares</div>
              {(buscaMembros || tagsSelecionadasModal.length > 0) ? (
                <button type="button" onClick={() => { setBuscaMembros(''); setTagsSelecionadasModal([]); }} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100">Limpar filtros</button>
              ) : null}
            </div>
            {tagsDisponiveisModal.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {tagsDisponiveisModal.slice(0, 16).map((tag) => {
                  const ativo = tagsSelecionadasModal.includes(tag.id);
                  return (
                    <button key={tag.id} type="button" onClick={() => setTagsSelecionadasModal((atuais) => ativo ? atuais.filter((id) => id !== tag.id) : [...atuais, tag.id])} className={['rounded-full border px-3 py-1 text-xs font-semibold transition', ativo ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'].join(' ')}>
                      {tag.nome}<span className="ml-1 text-[10px] opacity-70">{tag.total}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </header>
        <main className="flex-1 space-y-4 overflow-y-auto bg-white p-5">
          <SecaoEfetivo titulo="Oficiais" militares={oficiaisFiltrados} totalOriginal={unidade?.oficiais?.length || 0} />
          <SecaoEfetivo titulo="Praças" observacao="Inclui Subtenentes." militares={pracasFiltradas} totalOriginal={unidade?.pracas?.length || 0} />
        </main>
      </div>
    </div>
  );
};

const ModalResumoUnidade = ({ unidade, onClose }) => {
  if (!unidade) return null;
  const resumo = unidade.resumoEfetivo || {};
  const tags = unidade.resumoTags || [];
  const subtitulo = [unidade.sigla, unidade.descricao].filter(Boolean).join(' • ');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-labelledby="modal-resumo-titulo">
      <div className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="border-b border-slate-200 bg-gradient-to-b from-white to-slate-50 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="modal-resumo-titulo" className="text-lg font-black text-slate-900">Resumo — {unidade.nome}</h2>
              {subtitulo ? <p className="mt-1 text-sm text-slate-500">{subtitulo}</p> : null}
              <p className="mt-1 text-xs text-slate-500">Totais calculados a partir dos militares carregados da unidade.</p>
            </div>
            <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50" aria-label="Fechar"><X className="h-4 w-4" /></button>
          </div>
          <ResumoMetricasEfetivo resumo={resumo} />
        </header>
        <main className="grid gap-4 overflow-y-auto p-5 md:grid-cols-[1fr_1fr]">
          <section className="rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3"><div className="text-sm font-black text-slate-900">Composição</div><div className="text-xs text-slate-500">Resumo do efetivo da unidade</div></div>
            <div className="divide-y divide-slate-100">
              {[[ 'Total', unidade.total ?? unidade.militares?.length ?? 0 ], [ 'Oficiais', resumo.oficiais || 0 ], [ 'Praças', resumo.pracas || 0 ], [ 'Homens', resumo.homens || 0 ], [ 'Mulheres', resumo.mulheres || 0 ]].map(([label, valor]) => <div key={label} className="flex justify-between px-4 py-3 text-sm"><span>{label}</span><strong>{valor}</strong></div>)}
              {resumo.sexoNaoInformado ? <div className="flex justify-between px-4 py-3 text-sm"><span>Sexo não informado</span><strong>{resumo.sexoNaoInformado}</strong></div> : null}
            </div>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3"><div className="text-sm font-black text-slate-900">Tags</div><div className="text-xs text-slate-500">Quantidade de militares por tag</div></div>
            {tags.length ? <div className="divide-y divide-slate-100">{tags.map((tag) => <div key={tag.id || tag.nome} className="flex items-center justify-between px-4 py-3"><span className="text-sm font-semibold text-slate-700">{tag.nome}</span><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{tag.total}</span></div>)}</div> : <div className="px-4 py-8 text-center text-sm text-slate-500">Nenhuma tag encontrada nos militares desta unidade.</div>}
          </section>
        </main>
      </div>
    </div>
  );
};

const UnidadeTreeCard = ({ no, onVerMembros, onVerResumo }) => (
  <div className="relative z-10 flex min-w-0 flex-col pt-6">
    <div className="pointer-events-none absolute left-1/2 top-0 z-0 h-6 w-px -translate-x-1/2 bg-slate-300" />
    <div className="relative z-10 flex w-[320px] flex-col rounded-xl border border-slate-200 border-l-4 border-l-emerald-400 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600"><MapPin className="h-4 w-4" /></div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-700">Unidade</p>
            <p className="mt-0.5 truncate text-sm font-semibold text-slate-900" title={`${no.nome}${no.sigla ? ` (${no.sigla})` : ''}`}>{no.nome} {no.sigla ? `(${no.sigla})` : ''}</p>
            {no.descricao ? <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{no.descricao}</p> : null}
          </div>
        </div>
        <TotalBadge total={no.militares.length} />
      </div>
      <ResumoMetricasEfetivo resumo={no.resumoEfetivo} />
      <div className="relative z-20 mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onVerMembros?.(no);
          }}
          className="relative z-20 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          Ver membros
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onVerResumo?.(no);
          }}
          className="relative z-20 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 shadow-sm hover:bg-blue-100"
        >
          Resumo
        </button>
      </div>
    </div>
  </div>
);

const SubsetorTree = ({ no, onVerMembros, onVerResumo }) => {
  const unidades = no.filhos || [];
  const unitGridStyle = { gridTemplateColumns: `repeat(${Math.max(unidades.length, 1)}, minmax(320px, 1fr))` };

  return (
    <div className="relative flex min-w-0 flex-col items-center pt-6">
      <div className="pointer-events-none absolute left-1/2 top-0 h-6 w-px -translate-x-1/2 bg-slate-300" />
      <div className="w-[360px] rounded-xl border border-slate-200 border-l-4 border-l-purple-400 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <div className="rounded-lg bg-purple-50 p-2 text-purple-600"><GitBranch className="h-4 w-4" /></div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wide text-purple-700">Subsetor</p>
              <p className={`mt-0.5 truncate text-sm font-semibold ${no.discreto ? 'text-slate-500' : 'text-slate-900'}`} title={`${no.nome}${no.sigla ? ` (${no.sigla})` : ''}`}>{no.nome} {no.sigla ? `(${no.sigla})` : ''}</p>
            </div>
          </div>
          <TotalBadge total={countTotal(no)} />
        </div>
        <ResumoMetricasEfetivo resumo={no.resumoEfetivo} />
      </div>
      {unidades.length > 0 ? (
        <div className="relative w-full pt-8">
          <div className="pointer-events-none absolute left-1/2 top-0 h-8 w-px -translate-x-1/2 bg-slate-300" />
          {unidades.length > 1 ? <div className="pointer-events-none absolute left-[calc(160px)] right-[calc(160px)] top-8 h-px bg-slate-300" /> : null}
          <div className="grid gap-5" style={unitGridStyle}>
            {unidades.map((unidade) => <UnidadeTreeCard key={unidade.id} no={unidade} onVerMembros={onVerMembros} onVerResumo={onVerResumo} />)}
          </div>
        </div>
      ) : null}
    </div>
  );
};

const SetorTree = ({ no, onVerMembros, onVerResumo }) => {
  const subsetores = no.filhos || [];
  const subsetorGridStyle = { gridTemplateColumns: `repeat(${Math.max(subsetores.length, 1)}, minmax(360px, 1fr))` };

  return (
    <section className="flex min-w-max flex-col items-center rounded-2xl border border-slate-200 bg-white/60 px-5 py-6 shadow-sm">
      <div className="w-[360px] rounded-xl border border-slate-200 border-l-4 border-l-blue-400 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600"><Building2 className="h-4 w-4" /></div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wide text-blue-700">Setor</p>
              <p className={`mt-0.5 truncate text-sm font-semibold ${no.discreto ? 'text-slate-500' : 'text-slate-900'}`} title={`${no.nome}${no.sigla ? ` (${no.sigla})` : ''}`}>{no.nome} {no.sigla ? `(${no.sigla})` : ''}</p>
            </div>
          </div>
          <TotalBadge total={countTotal(no)} />
        </div>
        <ResumoMetricasEfetivo resumo={no.resumoEfetivo} />
      </div>
      {subsetores.length > 0 ? (
        <div className="relative w-full pt-8">
          <div className="pointer-events-none absolute left-1/2 top-0 h-8 w-px -translate-x-1/2 bg-slate-300" />
          {subsetores.length > 1 ? <div className="pointer-events-none absolute left-[calc(180px)] right-[calc(180px)] top-8 h-px bg-slate-300" /> : null}
          <div className="grid gap-8" style={subsetorGridStyle}>
            {subsetores.map((subsetor) => <SubsetorTree key={subsetor.id} no={subsetor} onVerMembros={onVerMembros} onVerResumo={onVerResumo} />)}
          </div>
        </div>
      ) : null}
    </section>
  );
};

function separarMilitaresLista(militares = []) {
  const oficiais = [];
  const stSgt = [];
  const cbSd = [];

  for (const militar of militares || []) {
    const grupo = obterGrupoHierarquicoMilitar(militar);
    const posto = String(militar?.posto_graduacao_resolvido || militar?.posto_graduacao || militar?.postoGraduacao || militar?.posto || '').toUpperCase();

    if (grupo === 'oficial') oficiais.push(militar);
    else if (posto.includes('SUBTENENTE') || posto.includes('SARGENTO') || posto.includes('SGT') || posto === 'ST') stSgt.push(militar);
    else cbSd.push(militar);
  }

  return { oficiais, stSgt, cbSd };
}

function ListaPersonCard({ militar }) {
  const nome = obterNomeExibicaoMilitar(militar);
  const posto = obterPostoExibicaoMilitar(militar);

  return (
    <div className="group flex items-center rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-all hover:border-blue-300 hover:shadow-md">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors group-hover:bg-blue-50 group-hover:text-blue-600"><User className="h-4 w-4" /></div>
      <div className="ml-3 min-w-0 flex-1">
        <div className="truncate text-[11px] font-bold uppercase tracking-wider text-slate-500 group-hover:text-blue-600">{posto || 'S/Posto'}</div>
        <div className="truncate text-sm font-semibold text-slate-800">{nome}</div>
        <TagsMilitarLinha tags={getTagsMilitarModal(militar)} />
      </div>
    </div>
  );
}

function ListaCategoriaSection({ titulo, militares, colorClass }) {
  if (!militares?.length) return null;

  return (
    <div className="mb-8 last:mb-2">
      <div className="mb-4 flex items-center">
        <h4 className={`flex items-center text-sm font-bold uppercase tracking-wider ${colorClass}`}>{titulo}<span className="ml-2 inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{militares.length}</span></h4>
        <div className="ml-4 h-px flex-grow bg-slate-200" />
      </div>
      <div className="grid grid-cols-1 gap-3 pl-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        {militares.map((militar, indice) => <ListaPersonCard key={militar.id || militar.matricula || militar.nome_guerra || indice} militar={militar} />)}
      </div>
    </div>
  );
}

function ListaUnidadeAccordion({ unidade, aberta, onToggle }) {
  const resumo = unidade.resumoEfetivo || calcularResumoEfetivo(unidade.militares || []);
  const { oficiais, stSgt, cbSd } = separarMilitaresLista(unidade.militares || []);

  return (
    <div className="mb-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <button type="button" onClick={onToggle} className={['flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-slate-50', aberta ? 'border-b border-slate-200 bg-slate-50' : ''].join(' ')}>
        <div className="flex min-w-0 items-center font-semibold text-slate-800"><ChevronRight className={`mr-2 h-4 w-4 shrink-0 text-slate-400 transition-transform ${aberta ? 'rotate-90' : ''}`} /><span className="truncate">{unidade.nome || unidade.unidadeNome}{unidade.sigla || unidade.unidadeSigla ? ` (${unidade.sigla || unidade.unidadeSigla})` : ''}</span></div>
        <div className="hidden items-center space-x-3 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 shadow-sm md:flex">
          <span>Oficiais: <strong className="text-slate-800">{resumo.oficiais || 0}</strong></span><span className="h-3 w-px bg-slate-300" />
          <span>Praças: <strong className="text-slate-800">{resumo.pracas || 0}</strong></span><span className="h-3 w-px bg-slate-300" />
          <span>Homens: <strong className="text-slate-800">{resumo.homens || 0}</strong></span><span className="h-3 w-px bg-slate-300" />
          <span>Mulheres: <strong className="text-slate-800">{resumo.mulheres || 0}</strong></span><span className="h-3 w-px bg-slate-300" />
          <span className="rounded bg-slate-100 px-2 py-0.5 font-bold text-slate-900">{unidade.total ?? unidade.militares?.length ?? 0}</span>
        </div>
      </button>
      {aberta ? <div className="bg-[#FAFAFA] p-5"><ListaCategoriaSection titulo="Oficiais" militares={oficiais} colorClass="text-slate-800" /><ListaCategoriaSection titulo="Subtenentes e Sargentos (ST/SGT)" militares={stSgt} colorClass="text-slate-700" /><ListaCategoriaSection titulo="Cabos e Soldados (CB/SD)" militares={cbSd} colorClass="text-slate-600" /></div> : null}
    </div>
  );
}

function ListaSubsetorAccordion({ subsetor, aberto, onToggle, unidadesAbertas, toggleUnidade }) {
  return (
    <div className="mb-4 ml-6">
      <button type="button" onClick={onToggle} className="mb-3 flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white p-4 text-left text-slate-600 shadow-sm hover:bg-slate-50"><div className="flex items-center font-medium"><ChevronRight className={`mr-2 h-4 w-4 text-slate-400 transition-transform ${aberto ? 'rotate-90' : ''}`} /><span>{subsetor.nome}</span></div><TotalBadge total={countTotal(subsetor)} /></button>
      {aberto ? <div className="ml-6">{(subsetor.filhos || []).map((unidade) => <ListaUnidadeAccordion key={unidade.id} unidade={unidade} aberta={Boolean(unidadesAbertas[unidade.id])} onToggle={() => toggleUnidade(unidade.id)} />)}</div> : null}
    </div>
  );
}

function ListaSetorAccordion({ setor, subsetoresAbertos, toggleSubsetor, unidadesAbertas, toggleUnidade }) {
  return (
    <div className="space-y-2">
      <div className="mb-2 flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 text-slate-500 shadow-sm"><div className="flex items-center font-medium"><ChevronRight className="mr-2 h-4 w-4 rotate-90 text-slate-400" /><span>{setor.nome}</span></div><TotalBadge total={countTotal(setor)} /></div>
      {(setor.filhos || []).map((subsetor) => <ListaSubsetorAccordion key={subsetor.id} subsetor={subsetor} aberto={subsetoresAbertos[subsetor.id] ?? true} onToggle={() => toggleSubsetor(subsetor.id)} unidadesAbertas={unidadesAbertas} toggleUnidade={toggleUnidade} />)}
    </div>
  );
}

export default function VisualizacoesGestor({ estrutura, filtro, ordemAntiguidadeMap }) {
  const [activeView, setActiveView] = useState('arvore');
  const [unidadeSelecionada, setUnidadeSelecionada] = useState(null);
  const [unidadeResumoSelecionada, setUnidadeResumoSelecionada] = useState(null);
  const [subsetoresListaAbertos, setSubsetoresListaAbertos] = useState({});
  const [unidadesListaAbertas, setUnidadesListaAbertas] = useState({});
  const [buscaCartoes, setBuscaCartoes] = useState('');

  const q = String(filtro || '').trim().toLowerCase();
  const filtrada = useMemo(() => (estrutura || []).map((setor) => {
    const subsetores = (setor.subsetores || []).map((subsetor) => {
      const unidades = (subsetor.unidades || []).map((unidade) => {
        const militares = ordenarMilitaresAntiguidade(
          (unidade.militares || [])
            .filter(isMilitarAtivo)
            .filter((m) => !q || [m.nome_completo, m.nome_guerra, m.matricula].some((v) => String(v || '').toLowerCase().includes(q))),
          ordemAntiguidadeMap
        );
        return { ...unidade, total: militares.length, militares, resumoEfetivo: calcularResumoEfetivo(militares), resumoTags: calcularResumoTags(militares), oficiais: militares.filter((militar) => obterGrupoHierarquicoMilitar(militar) === 'oficial'), pracas: militares.filter((militar) => obterGrupoHierarquicoMilitar(militar) !== 'oficial') };
      }).filter((unidade) => !q || unidade.militares.length > 0);
      const militares = unidades.flatMap((unidade) => unidade.militares);
      return { ...subsetor, total: militares.length, resumoEfetivo: calcularResumoEfetivo(militares), resumoTags: calcularResumoTags(militares), unidades };
    }).filter((subsetor) => !q || subsetor.unidades.length > 0);
    const militares = subsetores.flatMap((subsetor) => subsetor.unidades.flatMap((unidade) => unidade.militares));
    return { ...setor, total: militares.length, resumoEfetivo: calcularResumoEfetivo(militares), resumoTags: calcularResumoTags(militares), subsetores };
  }).filter((setor) => !q || setor.subsetores.length > 0), [estrutura, q, ordemAntiguidadeMap]);

  const nos = useMemo(() => montarNos(filtrada), [filtrada]);
  const unidades = useMemo(() => filtrada.flatMap((setor) => (setor.subsetores || []).flatMap((subsetor) => (subsetor.unidades || []).map((u) => ({ ...u, setorNome: setor.setorNome, subsetorNome: subsetor.subsetorNome })))), [filtrada]);
  const unidadesFiltradasCartao = useMemo(() => filtrarUnidadesCartoes(unidades, buscaCartoes), [unidades, buscaCartoes]);

  useEffect(() => {
    if (activeView !== 'lista' || Object.keys(unidadesListaAbertas).length > 0) return;
    const primeiraUnidade = nos.flatMap((setor) => setor.filhos || []).flatMap((subsetor) => subsetor.filhos || [])[0];
    if (primeiraUnidade?.id) setUnidadesListaAbertas({ [primeiraUnidade.id]: true });
  }, [activeView, nos, unidadesListaAbertas]);

  const toggleSubsetorLista = (id) => setSubsetoresListaAbertos((atual) => ({ ...atual, [id]: !(atual[id] ?? true) }));
  const toggleUnidadeLista = (id) => setUnidadesListaAbertas((atual) => ({ ...atual, [id]: !atual[id] }));

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

      {activeView === 'arvore' ? <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-[#f8fafc] p-4 md:p-6"><div className="flex min-w-max items-start justify-center gap-10">{nos.map((no) => <SetorTree key={no.id} no={no} onVerMembros={setUnidadeSelecionada} onVerResumo={setUnidadeResumoSelecionada} />)}</div></div> : null}

      {activeView === 'lista' ? (
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
          {nos.length ? nos.map((setor) => <ListaSetorAccordion key={setor.id} setor={setor} subsetoresAbertos={subsetoresListaAbertos} toggleSubsetor={toggleSubsetorLista} unidadesAbertas={unidadesListaAbertas} toggleUnidade={toggleUnidadeLista} />) : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">Nenhum efetivo encontrado para os filtros aplicados.</div>}
        </div>
      ) : null}

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
              const resumo = u.resumoEfetivo || calcularResumoEfetivo(u.militares);
              return (
                <div key={`${u.setorNome}-${u.subsetorNome}-${u.unidadeNome}`} className="flex min-h-[400px] flex-col rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="space-y-1 pb-3">
                    <p className="text-sm font-semibold text-slate-900"><Building2 className="mr-1 inline h-4 w-4" />{u.unidadeNome} {u.unidadeSigla ? `(${u.unidadeSigla})` : ''}</p>
                    <p className="text-xs text-slate-600"><MapPin className="mr-1 inline h-3 w-3" />{u.setorNome} · {u.subsetorNome}</p>
                    <p className="text-xs font-medium text-slate-500"><Users className="mr-1 inline h-3 w-3" />Total: {u.total ?? u.militares?.length ?? 0}</p>
                    <ResumoMetricasEfetivo resumo={resumo} />
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
      <ModalResumoUnidade unidade={unidadeResumoSelecionada} onClose={() => setUnidadeResumoSelecionada(null)} />
    </div>
  );
}
