import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { fetchScopedLotacoes } from '@/services/getScopedLotacoesClient';
import { CalendarDays, ChevronLeft, Edit3, FolderArchive, Plus, RefreshCw, Users, X, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const mensagemErro = (erro, fallback) =>
  erro?.response?.data?.error || erro?.data?.error || erro?.message || fallback;

const novoPlano = () => ({
  titulo: '',
  ano_referencia: new Date().getFullYear() + 1,
  descricao: '',
  data_abertura: new Date().toISOString().slice(0, 10),
  data_encerramento: '',
});

export default function PlanosFerias() {
  const [planos, setPlanos] = useState([]);
  const [campanhas, setCampanhas] = useState([]);
  const [selecionado, setSelecionado] = useState(null);
  const [metricas, setMetricas] = useState(null);
  const [form, setForm] = useState(novoPlano());
  const [modoFormulario, setModoFormulario] = useState(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [feedback, setFeedback] = useState({ tipo: '', texto: '' });
  const [unidades, setUnidades] = useState([]);
  const [modalCampanha, setModalCampanha] = useState(false);
  const [salvandoCampanha, setSalvandoCampanha] = useState(false);
  const [campanhaForm, setCampanhaForm] = useState(null);
  const [modalRespostas, setModalRespostas] = useState(null);
  const [respostasCampanha, setRespostasCampanha] = useState(null);
  const [carregandoRespostas, setCarregandoRespostas] = useState(false);

  const carregar = async () => {
    setLoading(true);
    setFeedback({ tipo: '', texto: '' });
    try {
      const resposta = await base44.functions.invoke('planos_ferias_servicos', { acao: 'LISTAR' });
      const listaPlanos = resposta.data?.planos || [];
      setPlanos(listaPlanos);
      setCampanhas(resposta.data?.campanhas || []);
      setSelecionado((atual) => atual ? listaPlanos.find((p) => p.id === atual.id) || null : null);
      try {
        const lotacoes = await fetchScopedLotacoes({});
        setUnidades((lotacoes?.lotacoes || []).map((lotacao) => ({
          id: String(lotacao.id || lotacao.nome || '').trim(),
          nome: lotacao.nome || lotacao.sigla || lotacao.label || lotacao.id,
        })).filter((lotacao) => lotacao.id));
      } catch (_erroLotacoes) {
        setUnidades([]);
      }
    } catch (erro) {
      setFeedback({ tipo: 'erro', texto: mensagemErro(erro, 'Não foi possível carregar os Planos de Férias.') });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  useEffect(() => {
    if (!selecionado?.id) {
      setMetricas(null);
      return;
    }
    base44.functions.invoke('planos_ferias_servicos', { acao: 'DETALHES', plano_id: selecionado.id })
      .then((res) => setMetricas(res.data?.metricas || null))
      .catch(() => setMetricas(null));
  }, [selecionado?.id]);

  const campanhasDoPlano = useMemo(
    () => selecionado ? campanhas.filter((c) => c.plano_ferias_institucional_id === selecionado.id) : [],
    [campanhas, selecionado],
  );

  const abrirNovo = () => {
    setForm(novoPlano());
    setModoFormulario('novo');
    setFeedback({ tipo: '', texto: '' });
  };

  const abrirEdicao = (plano) => {
    setForm({
      titulo: plano.titulo || '',
      ano_referencia: Number(plano.ano_referencia) || new Date().getFullYear() + 1,
      descricao: plano.descricao || '',
      data_abertura: plano.data_abertura || '',
      data_encerramento: plano.data_encerramento || '',
    });
    setSelecionado(plano);
    setModoFormulario('editar');
    setFeedback({ tipo: '', texto: '' });
  };

  const salvar = async (evento) => {
    evento.preventDefault();
    setSalvando(true);
    try {
      const payload = {
        titulo: form.titulo.trim(),
        ano_referencia: Number(form.ano_referencia),
        descricao: form.descricao || '',
        data_abertura: form.data_abertura || '',
        data_encerramento: form.data_encerramento || '',
      };
      if (modoFormulario === 'editar') {
        await base44.functions.invoke('planos_ferias_servicos', { acao: 'ATUALIZAR', plano_id: selecionado.id, plano: payload });
      } else {
        await base44.functions.invoke('planos_ferias_servicos', { acao: 'CRIAR', plano: payload });
      }
      setModoFormulario(null);
      await carregar();
      setFeedback({ tipo: 'sucesso', texto: 'Plano de Férias salvo com sucesso.' });
    } catch (erro) {
      setFeedback({ tipo: 'erro', texto: mensagemErro(erro, 'Não foi possível salvar o plano.') });
    } finally {
      setSalvando(false);
    }
  };

  const arquivar = async (plano) => {
    if (!window.confirm(`Arquivar o plano "${plano.titulo}"? O histórico será preservado e novas campanhas não poderão ser incluídas.`)) return;
    setSalvando(true);
    try {
      await base44.functions.invoke('planos_ferias_servicos', { acao: 'ARQUIVAR', plano_id: plano.id });
      setSelecionado(null);
      await carregar();
      setFeedback({ tipo: 'sucesso', texto: 'Plano arquivado. O histórico foi preservado.' });
    } catch (erro) {
      setFeedback({ tipo: 'erro', texto: mensagemErro(erro, 'Não foi possível arquivar o plano.') });
    } finally {
      setSalvando(false);
    }
  };

  const gerarFeriasDoPlano = async () => {
    if (!selecionado) return;
    if (!window.confirm(`Gerar férias pendentes no plano "${selecionado.titulo}"? Somente novas respostas com escala salva serão incluídas; férias já geradas não serão alteradas.`)) return;
    setSalvando(true);
    try {
      const resultado = await base44.functions.invoke('portal_servicos', {
        acao: 'PLANO_INSTITUCIONAL_GERAR_FERIAS',
        plano_id: selecionado.id,
        ano_referencia: Number(selecionado.ano_referencia),
      });
      setFeedback({ tipo: 'sucesso', texto: resultado.data?.message || 'Geração complementar concluída.' });
      await carregar();
    } catch (erro) {
      setFeedback({ tipo: 'erro', texto: mensagemErro(erro, 'Não foi possível gerar as férias deste plano.') });
    } finally {
      setSalvando(false);
    }
  };

  const abrirNovaCampanha = () => {
    if (!selecionado || selecionado.status === 'ARQUIVADO') return;
    const ano = Number(selecionado.ano_referencia);
    setCampanhaForm({
      titulo: `Campanha de Férias — ${selecionado.titulo}`,
      ano_referencia: ano,
      tipo_escopo: 'TODOS',
      escopo_unidades_ids: [],
      data_inicio: new Date().toISOString().slice(0, 10),
      data_fim_militar: `${ano}-10-31`,
      data_fim_unidade: `${ano}-11-30`,
      instrucoes: `Registre suas opções de férias para o plano ${selecionado.titulo}.`,
    });
    setModalCampanha(true);
    setFeedback({ tipo: '', texto: '' });
  };

  const salvarCampanha = async (evento) => {
    evento.preventDefault();
    if (!selecionado || !campanhaForm?.titulo.trim()) return;
    if (campanhaForm.tipo_escopo === 'UNIDADES' && campanhaForm.escopo_unidades_ids.length === 0) {
      setFeedback({ tipo: 'erro', texto: 'Selecione ao menos uma unidade para o escopo da campanha.' });
      return;
    }
    setSalvandoCampanha(true);
    try {
      const nomesUnidades = campanhaForm.escopo_unidades_ids
        .map((id) => unidades.find((unidade) => unidade.id === id)?.nome || id)
        .join(', ');
      await base44.functions.invoke('portal_servicos', {
        acao: 'CAMPANHA_CRIAR',
        campanha_payload: {
          titulo: campanhaForm.titulo.trim(),
          tipo: 'PLANO_FERIAS',
          status: 'Aberta_Coleta',
          ano_referencia: Number(selecionado.ano_referencia),
          plano_ferias_institucional_id: selecionado.id,
          tipo_escopo: campanhaForm.tipo_escopo,
          escopo_unidades_ids: campanhaForm.escopo_unidades_ids,
          escopo_unidades_nomes: nomesUnidades,
          escopo_quadros: [],
          data_inicio: campanhaForm.data_inicio,
          data_fim_militar: campanhaForm.data_fim_militar,
          data_fim_unidade: campanhaForm.data_fim_unidade,
          instrucoes: campanhaForm.instrucoes,
          config_regras: {},
          config_formulario: { campos: [] },
        },
      });
      setModalCampanha(false);
      setCampanhaForm(null);
      setFeedback({ tipo: 'sucesso', texto: 'Campanha de férias criada dentro do plano.' });
      await carregar();
    } catch (erro) {
      setFeedback({ tipo: 'erro', texto: mensagemErro(erro, 'Não foi possível criar a campanha de férias.') });
    } finally {
      setSalvandoCampanha(false);
    }
  };

  const abrirRespostas = async (campanha) => {
    setModalRespostas(campanha);
    setRespostasCampanha(null);
    setCarregandoRespostas(true);
    try {
      const resposta = await base44.functions.invoke('portal_servicos', {
        acao: 'CAMPANHA_DETALHES_RETORNO',
        campanha_id: campanha.id,
      });
      setRespostasCampanha(resposta.data || {});
    } catch (erro) {
      setFeedback({ tipo: 'erro', texto: mensagemErro(erro, 'Não foi possível carregar as respostas desta campanha.') });
    } finally {
      setCarregandoRespostas(false);
    }
  };

  const excluir = async (plano) => {
    if (!window.confirm(`Excluir o plano vazio "${plano.titulo}"? Esta ação não pode ser desfeita.`)) return;
    setSalvando(true);
    try {
      await base44.functions.invoke('planos_ferias_servicos', { acao: 'EXCLUIR', plano_id: plano.id });
      setSelecionado(null);
      await carregar();
      setFeedback({ tipo: 'sucesso', texto: 'Plano excluído.' });
    } catch (erro) {
      setFeedback({ tipo: 'erro', texto: mensagemErro(erro, 'Não foi possível excluir o plano.') });
    } finally {
      setSalvando(false);
    }
  };

  const renderModaisDoPlano = () => (
    <>
      {modalCampanha && campanhaForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form onSubmit={salvarCampanha} className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3"><div><h2 className="text-lg font-black text-slate-900">Nova campanha de férias</h2><p className="text-xs text-slate-500">Plano: {selecionado?.titulo}</p></div><button type="button" onClick={() => setModalCampanha(false)} className="text-slate-400 hover:text-slate-700" aria-label="Fechar"><X className="w-5 h-5" /></button></div>
            <div><label className="text-xs font-bold text-slate-700">Nome da campanha *</label><Input required value={campanhaForm.titulo} onChange={(e) => setCampanhaForm({ ...campanhaForm, titulo: e.target.value })} /></div>
            <div className="grid sm:grid-cols-3 gap-3"><div><label className="text-xs font-bold text-slate-700">Início *</label><Input required type="date" value={campanhaForm.data_inicio} onChange={(e) => setCampanhaForm({ ...campanhaForm, data_inicio: e.target.value })} /></div><div><label className="text-xs font-bold text-slate-700">Prazo militar *</label><Input required type="date" value={campanhaForm.data_fim_militar} onChange={(e) => setCampanhaForm({ ...campanhaForm, data_fim_militar: e.target.value })} /></div><div><label className="text-xs font-bold text-slate-700">Prazo unidade</label><Input type="date" value={campanhaForm.data_fim_unidade} onChange={(e) => setCampanhaForm({ ...campanhaForm, data_fim_unidade: e.target.value })} /></div></div>
            <div><label className="text-xs font-bold text-slate-700">Escopo *</label><select value={campanhaForm.tipo_escopo} onChange={(e) => setCampanhaForm({ ...campanhaForm, tipo_escopo: e.target.value, escopo_unidades_ids: [] })} className="mt-1 h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"><option value="TODOS">Toda a corporação</option><option value="UNIDADES">Unidades selecionadas</option></select></div>
            {campanhaForm.tipo_escopo === 'UNIDADES' && <div className="grid sm:grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">{unidades.length === 0 ? <p className="text-xs text-slate-500">Nenhuma unidade disponível para seleção.</p> : unidades.map((unidade) => <label key={unidade.id} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={campanhaForm.escopo_unidades_ids.includes(unidade.id)} onChange={(e) => setCampanhaForm({ ...campanhaForm, escopo_unidades_ids: e.target.checked ? [...campanhaForm.escopo_unidades_ids, unidade.id] : campanhaForm.escopo_unidades_ids.filter((id) => id !== unidade.id) })} />{unidade.nome}</label>)}</div>}
            <div><label className="text-xs font-bold text-slate-700">Orientações aos militares</label><textarea value={campanhaForm.instrucoes} onChange={(e) => setCampanhaForm({ ...campanhaForm, instrucoes: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm" rows={4} /></div>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3"><Button type="button" variant="outline" onClick={() => setModalCampanha(false)}>Cancelar</Button><Button type="submit" disabled={salvandoCampanha} className="bg-emerald-700 hover:bg-emerald-800">{salvandoCampanha ? 'Criando...' : 'Criar campanha'}</Button></div>
          </form>
        </div>
      )}
      {modalRespostas && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"><div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"><div className="flex items-center justify-between border-b border-slate-100 pb-3"><div><h2 className="text-lg font-black text-slate-900">Respostas da campanha</h2><p className="text-xs text-slate-500">{modalRespostas.titulo}</p></div><button type="button" onClick={() => setModalRespostas(null)} className="text-slate-400 hover:text-slate-700" aria-label="Fechar"><X className="w-5 h-5" /></button></div>{carregandoRespostas ? <div className="p-10 text-center text-sm text-slate-500">Carregando respostas...</div> : <><div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">{[['Público', respostasCampanha?.total_alvo ?? 0], ['Respondidos', respostasCampanha?.total_respondidos ?? 0], ['Pendentes', respostasCampanha?.total_pendentes ?? 0], ['Adesão', `${respostasCampanha?.percentual ?? 0}%`]].map(([rotulo, valor]) => <div key={rotulo} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs text-slate-500">{rotulo}</p><p className="text-xl font-black text-slate-900">{valor}</p></div>)}</div><div className="divide-y divide-slate-100 rounded-xl border border-slate-200">{(respostasCampanha?.militares || []).length === 0 ? <div className="p-8 text-center text-sm text-slate-500">Nenhuma resposta encontrada.</div> : (respostasCampanha.militares || []).map((militar) => <div key={militar.militar_id || militar.id || militar.militar_matricula} className="flex items-center justify-between gap-3 p-3"><div><p className="font-bold text-sm text-slate-800">{militar.militar_nome || 'Militar sem nome'}</p><p className="text-xs text-slate-500">{militar.militar_matricula || '-'} · {militar.militar_lotacao || '-'}</p></div><span className={`rounded-lg px-2 py-1 text-xs font-bold ${militar.status_resposta === 'Respondido' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{militar.status_resposta || 'Pendente'}</span></div>)}</div></>}</div></div>
      )}
    </>
  );

  if (selecionado && !modoFormulario) {
    return (
      <div className="min-h-screen bg-slate-50/50 p-4 sm:p-6 lg:p-8">
        <div className="max-w-6xl mx-auto space-y-5">
          <Button type="button" variant="ghost" onClick={() => setSelecionado(null)} className="text-slate-600">
            <ChevronLeft className="w-4 h-4 mr-1" /> Voltar para Planos de Férias
          </Button>
          <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-emerald-700">Plano de Férias · {selecionado.ano_referencia}</div>
              <h1 className="text-2xl font-black text-slate-900 mt-1">{selecionado.titulo}</h1>
              {selecionado.descricao && <p className="text-sm text-slate-600 mt-2 max-w-2xl">{selecionado.descricao}</p>}
              <p className="text-xs text-slate-500 mt-3">Abertura: {selecionado.data_abertura || '-'} · Status: {selecionado.status === 'ARQUIVADO' ? 'Arquivado' : 'Aberto'}</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button type="button" variant="outline" onClick={() => abrirEdicao(selecionado)}><Edit3 className="w-4 h-4 mr-1.5" />Editar plano</Button>
              {selecionado.status !== 'ARQUIVADO' && <Button type="button" variant="outline" onClick={() => arquivar(selecionado)}><FolderArchive className="w-4 h-4 mr-1.5" />Arquivar</Button>}
            </div>
          </div>
          {feedback.texto && <div className={`rounded-xl border p-3 text-sm ${feedback.tipo === 'erro' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>{feedback.texto}</div>}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-slate-900">Campanhas deste plano</h2>
                <p className="text-xs text-slate-500 mt-1">Cada campanha possui prazo e escopo próprios; todas fazem parte deste mesmo plano.</p>
              </div>
              {selecionado.status !== 'ARQUIVADO' && <Button type="button" onClick={abrirNovaCampanha} className="bg-[#1e3a5f] hover:bg-[#2a4d7d]"><Plus className="w-4 h-4 mr-1.5" />Nova campanha de férias</Button>}
            </div>
            {campanhasDoPlano.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">Ainda não há campanhas neste plano.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {campanhasDoPlano.map((campanha) => (
                  <div key={campanha.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div><p className="font-bold text-slate-800">{campanha.titulo}</p><p className="text-xs text-slate-500 mt-1">Escopo: {campanha.escopo_unidades_nomes || 'Toda a Corporação'} · Prazo: {campanha.data_fim_militar || '-'}</p></div>
                    <Button type="button" variant="outline" onClick={() => abrirRespostas(campanha)}><Eye className="w-4 h-4 mr-1.5" />Ver respostas</Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <h2 className="font-bold text-slate-900">Resumo consolidado</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
              {[
                ['Efetivo único', metricas?.efetivo_unico ?? '-'],
                ['Respondidos', metricas?.respondidos_unicos ?? '-'],
                ['Pendentes', metricas?.pendentes_unicos ?? '-'],
                ['Férias geradas', metricas?.ferias_geradas_unicas ?? '-'],
              ].map(([rotulo, valor]) => <div key={rotulo} className="rounded-xl bg-slate-50 border border-slate-200 p-3"><p className="text-xs text-slate-500">{rotulo}</p><p className="text-xl font-black text-slate-900 mt-1">{valor}</p></div>)}
            </div>
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-slate-100 pt-4">
              <p className="text-xs text-slate-500">A geração inclui somente respostas novas, com escala salva, e preserva tudo o que já foi gerado.</p>
              <Button type="button" onClick={gerarFeriasDoPlano} disabled={salvando || selecionado.status === 'ARQUIVADO'} className="bg-emerald-700 hover:bg-emerald-800"><CalendarDays className="w-4 h-4 mr-1.5" />{salvando ? 'Gerando...' : 'Gerar férias do plano'}</Button>
            </div>
          </div>
          {renderModaisDoPlano()}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-5">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3"><div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center"><CalendarDays className="w-6 h-6" /></div><div><h1 className="text-xl sm:text-2xl font-black text-slate-900">Plano de Férias</h1><p className="text-xs text-slate-500">Crie, consulte e administre os planos que reúnem as campanhas de coleta.</p></div></div>
          <Button type="button" onClick={abrirNovo} className="bg-emerald-700 hover:bg-emerald-800"><Plus className="w-4 h-4 mr-1.5" />Novo Plano de Férias</Button>
        </div>
        {feedback.texto && <div className={`rounded-xl border p-3 text-sm ${feedback.tipo === 'erro' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>{feedback.texto}</div>}
        {modoFormulario && <form onSubmit={salvar} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <h2 className="font-bold text-slate-900">{modoFormulario === 'novo' ? 'Novo Plano de Férias' : 'Editar Plano de Férias'}</h2>
          <div className="grid sm:grid-cols-3 gap-3"><div className="sm:col-span-2"><label className="text-xs font-bold text-slate-700">Nome do plano *</label><Input required value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ex.: Plano de Férias Estado-Maior e Campo Grande" /></div><div><label className="text-xs font-bold text-slate-700">Ano de referência *</label><Input required type="number" min="2000" max="2200" value={form.ano_referencia} onChange={(e) => setForm({ ...form, ano_referencia: e.target.value })} /></div></div>
          <div><label className="text-xs font-bold text-slate-700">Descrição</label><textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} className="w-full min-h-20 mt-1 rounded-xl border border-slate-300 p-3 text-sm" placeholder="Identifique o conjunto de unidades ou a finalidade deste plano." /></div>
          <div className="flex gap-2"><Button type="submit" disabled={salvando} className="bg-emerald-700 hover:bg-emerald-800">{salvando ? 'Salvando...' : 'Salvar plano'}</Button><Button type="button" variant="outline" onClick={() => setModoFormulario(null)}>Cancelar</Button></div>
        </form>}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center"><span className="font-bold text-slate-800">Planos cadastrados</span><Button type="button" variant="ghost" size="sm" onClick={carregar} disabled={loading}><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></Button></div>
          {loading ? <div className="p-10 text-center text-sm text-slate-500">Carregando planos...</div> : planos.length === 0 ? <div className="p-10 text-center text-sm text-slate-500">Nenhum Plano de Férias cadastrado.</div> : <div className="divide-y divide-slate-100">{planos.map((plano) => { const quantidade = campanhas.filter((c) => c.plano_ferias_institucional_id === plano.id).length; return <button key={plano.id} type="button" onClick={() => setSelecionado(plano)} className="w-full text-left p-5 hover:bg-slate-50 transition-colors flex items-center justify-between gap-4"><div><p className="font-bold text-slate-900">{plano.titulo}</p><p className="text-xs text-slate-500 mt-1">Ano {plano.ano_referencia} · {quantidade} campanha(s) · {plano.status === 'ARQUIVADO' ? 'Arquivado' : 'Aberto'}</p></div><Users className="w-5 h-5 text-slate-400" /></button>; })}</div>}
        </div>
      </div>
    </div>
  );
}
