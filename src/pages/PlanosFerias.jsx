import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import { CalendarDays, ChevronLeft, Edit3, FolderArchive, Plus, RefreshCw, Users, X, Eye, ShieldCheck, Trash2 } from 'lucide-react';
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
  const navigate = useNavigate();
  const { isAdmin = false, canAccessAction = () => false } = useCurrentUser();
  const podeVisualizarPlanos = isAdmin || canAccessAction('visualizar_planos_ferias');
  const podeCriarPlanos = isAdmin || canAccessAction('criar_planos_ferias');
  const podeEditarPlanos = isAdmin || canAccessAction('editar_planos_ferias');
  const podeExcluirPlanos = isAdmin || canAccessAction('excluir_planos_ferias');
  const podeCriarCampanhas = isAdmin || canAccessAction('criar_campanhas_ferias');
  const podeEditarCampanhas = isAdmin || canAccessAction('editar_campanhas_ferias');
  const podeExcluirCampanhas = isAdmin || canAccessAction('excluir_campanhas_ferias');
  const podeVisualizarRespostas = isAdmin || canAccessAction('visualizar_respostas_ferias');
  const podeGerarFerias = isAdmin || canAccessAction('gerar_ferias_campanhas');
  const podeAdminFerias = isAdmin || canAccessAction('admin_campanhas_ferias');
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
  const [grupos, setGrupos] = useState([]);
  const [modalCampanha, setModalCampanha] = useState(false);
  const [salvandoCampanha, setSalvandoCampanha] = useState(false);
  const [modoAdmin, setModoAdmin] = useState(false);
  const [campanhaForm, setCampanhaForm] = useState(null);
  const [modalRespostas, setModalRespostas] = useState(null);
  const [respostasCampanha, setRespostasCampanha] = useState(null);
  const [carregandoRespostas, setCarregandoRespostas] = useState(false);
  const [auditoria, setAuditoria] = useState([]);

  const carregar = async () => {
    setLoading(true);
    setFeedback({ tipo: '', texto: '' });
    try {
      let listaPlanos = [];
      if (podeVisualizarPlanos) {
        const resposta = await base44.functions.invoke('planos_ferias_servicos', { acao: 'LISTAR' });
        listaPlanos = resposta.data?.planos || [];
        setPlanos(listaPlanos);
        setCampanhas(resposta.data?.campanhas || []);
        setSelecionado((atual) => atual ? listaPlanos.find((p) => p.id === atual.id) || null : null);
      } else {
        setPlanos([]);
        setCampanhas([]);
        setSelecionado(null);
      }
      if (podeCriarCampanhas || podeEditarCampanhas) {
        try {
          const scopeRes = await base44.functions.invoke('portal_servicos', { acao: 'PLANO_CAMPANHA_SCOPE_OPTIONS' });
          setUnidades(scopeRes.data?.unidades || []);
          setGrupos(scopeRes.data?.grupos || []);
        } catch (_erroEscopo) {
          setUnidades([]);
          setGrupos([]);
        }
      } else {
        setUnidades([]);
        setGrupos([]);
      }
    } catch (erro) {
      setFeedback({ tipo: 'erro', texto: mensagemErro(erro, 'Não foi possível carregar os Planos de Férias.') });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, [podeVisualizarPlanos, podeCriarCampanhas, podeEditarCampanhas]);

  useEffect(() => {
    if (!selecionado?.id) {
      setMetricas(null);
      setAuditoria([]);
      return;
    }
    base44.functions.invoke('planos_ferias_servicos', { acao: 'DETALHES', plano_id: selecionado.id })
      .then((res) => setMetricas(res.data?.metricas || null))
      .catch(() => setMetricas(null));
  }, [selecionado?.id]);

  useEffect(() => {
    if (!modoAdmin || !podeAdminFerias || !selecionado?.id) {
      setAuditoria([]);
      return;
    }
    base44.functions.invoke('portal_servicos', { acao: 'PLANO_AUDITORIA_LISTAR', plano_id: selecionado.id })
      .then((res) => setAuditoria(res.data?.auditoria || []))
      .catch(() => setAuditoria([]));
  }, [modoAdmin, podeAdminFerias, selecionado?.id]);


  const campanhasDoPlano = useMemo(
    () => selecionado ? campanhas.filter((c) => c.plano_ferias_institucional_id === selecionado.id) : [],
    [campanhas, selecionado],
  );

  const abrirNovo = () => {
    if (!podeCriarPlanos) return;
    setForm(novoPlano());
    setModoFormulario('novo');
    setFeedback({ tipo: '', texto: '' });
  };

  const abrirEdicao = (plano) => {
    if (!podeEditarPlanos) return;
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
    if (modoFormulario === 'editar' ? !podeEditarPlanos : !podeCriarPlanos) return;
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
    if (!modoAdmin || !podeAdminFerias || !podeEditarPlanos) {
      setFeedback({ tipo: 'erro', texto: 'O arquivamento exige o Modo Admin de férias ativo.' });
      return;
    }
    if (!window.confirm(`Arquivar o plano "${plano.titulo}"? O histórico será preservado e novas campanhas não poderão ser incluídas.`)) return;
    setSalvando(true);
    try {
      await base44.functions.invoke('planos_ferias_servicos', { acao: 'ARQUIVAR', plano_id: plano.id });
      await carregar();
      setFeedback({ tipo: 'sucesso', texto: 'Plano arquivado. O histórico foi preservado.' });
    } catch (erro) {
      setFeedback({ tipo: 'erro', texto: mensagemErro(erro, 'Não foi possível arquivar o plano.') });
    } finally {
      setSalvando(false);
    }
  };

  const desarquivar = async (plano) => {
    if (!modoAdmin || !podeAdminFerias || !podeEditarPlanos) {
      setFeedback({ tipo: 'erro', texto: 'O desarquivamento exige o Modo Admin de férias ativo.' });
      return;
    }
    if (!window.confirm(`Desarquivar o plano "${plano.titulo}" e permitir novamente sua gestão?`)) return;
    setSalvando(true);
    try {
      await base44.functions.invoke('planos_ferias_servicos', { acao: 'DESARQUIVAR', plano_id: plano.id });
      await carregar();
      setFeedback({ tipo: 'sucesso', texto: 'Plano desarquivado com sucesso.' });
    } catch (erro) {
      setFeedback({ tipo: 'erro', texto: mensagemErro(erro, 'Não foi possível desarquivar o plano.') });
    } finally {
      setSalvando(false);
    }
  };

  const gerarFeriasDoPlano = async () => {
    if (!selecionado || !modoAdmin || !podeGerarFerias) return;
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
    if (!podeCriarCampanhas || !selecionado || selecionado.status === 'ARQUIVADO') return;
    const ano = Number(selecionado.ano_referencia);
    setCampanhaForm({
      titulo: `Campanha de Férias — ${selecionado.titulo}`,
      ano_referencia: ano,
      tipo_escopo: 'TODOS',
      escopo_unidades_ids: [],
      escopo_grupos_ids: [],
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
    if (!podeCriarCampanhas || !selecionado || !campanhaForm?.titulo.trim()) return;
    if (campanhaForm.tipo_escopo === 'UNIDADES' && campanhaForm.escopo_unidades_ids.length === 0) {
      setFeedback({ tipo: 'erro', texto: 'Selecione ao menos uma unidade para o escopo da campanha.' });
      return;
    }
    if (campanhaForm.tipo_escopo === 'SEM_ESCOPO' && (campanhaForm.escopo_grupos_ids || []).length === 0) {
      setFeedback({ tipo: 'erro', texto: 'Selecione ao menos um grupo quando o escopo de lotação estiver vazio.' });
      return;
    }
    setSalvandoCampanha(true);
    try {
      const nomesUnidades = campanhaForm.escopo_unidades_ids
        .map((id) => unidades.find((unidade) => unidade.id === id)?.nome || id)
        .join(', ');
      await base44.functions.invoke('portal_servicos', {
        acao: 'PLANO_CAMPANHA_CRIAR',
        campanha_payload: {
          titulo: campanhaForm.titulo.trim(),
          tipo: 'PLANO_FERIAS',
          status: 'Aberta_Coleta',
          ano_referencia: Number(selecionado.ano_referencia),
          plano_ferias_institucional_id: selecionado.id,
          tipo_escopo: campanhaForm.tipo_escopo,
          escopo_unidades_ids: campanhaForm.escopo_unidades_ids,
          escopo_unidades_nomes: nomesUnidades,
          escopo_grupos_ids: campanhaForm.escopo_grupos_ids || [],
          escopo_grupos_nomes: (campanhaForm.escopo_grupos_ids || [])
            .map((id) => grupos.find((grupo) => grupo.id === id)?.nome || id)
            .join(', '),
          escopo_grupos_excluidos_ids: [],
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

  const excluirCampanha = async (campanha) => {
    if (!podeExcluirCampanhas || !modoAdmin || !podeAdminFerias) {
      setFeedback({ tipo: 'erro', texto: 'A exclusão exige a permissão de excluir campanhas de férias e o Modo Admin de férias ativo.' });
      return;
    }
    if (!window.confirm(`Excluir a campanha "${campanha.titulo}"? A exclusão só será permitida se não houver respostas. Campanhas com respostas serão preservadas e deverão ser arquivadas.`)) return;
    setSalvando(true);
    try {
      const resposta = await base44.functions.invoke('portal_servicos', {
        acao: 'PLANO_CAMPANHA_EXCLUIR',
        campanha_id: campanha.id,
      });
      setFeedback({ tipo: 'sucesso', texto: resposta.data?.message || 'Campanha e respostas excluídas com sucesso.' });
      await carregar();
      setSelecionado((atual) => atual ? { ...atual } : null);
    } catch (erro) {
      setFeedback({ tipo: 'erro', texto: mensagemErro(erro, 'Não foi possível excluir a campanha.') });
    } finally {
      setSalvando(false);
    }
  };



  const abrirRespostas = async (campanha) => {
    if (!podeVisualizarRespostas) return;
    setModalRespostas(campanha);
    setRespostasCampanha(null);
    setCarregandoRespostas(true);
    try {
      const resposta = await base44.functions.invoke('portal_servicos', {
        acao: 'PLANO_ESCALA_LISTAR',
        campanha_id: campanha.id,
      });
      const opcoes = resposta.data?.opcoes || [];
      setRespostasCampanha({
        militares: opcoes.map((op) => ({
          militar_id: op.militar_id,
          militar_nome: op.militar_nome,
          militar_matricula: op.militar_matricula,
          militar_lotacao: op.lotacao_nome,
          status_resposta: 'Respondido',
        })),
        total_alvo: campanha.total_publico_alvo || opcoes.length,
        total_respondidos: opcoes.length,
        total_pendentes: Math.max(0, Number(campanha.total_publico_alvo || 0) - opcoes.length),
        percentual: Number(campanha.total_publico_alvo || 0) > 0 ? Math.round((opcoes.length / Number(campanha.total_publico_alvo)) * 100) : 0,
      });
    } catch (erro) {
      setFeedback({ tipo: 'erro', texto: mensagemErro(erro, 'Não foi possível carregar as respostas desta campanha.') });
    } finally {
      setCarregandoRespostas(false);
    }
  };

  const excluir = async (plano) => {
    if (!podeExcluirPlanos || !modoAdmin || !podeAdminFerias) {
      setFeedback({ tipo: 'erro', texto: 'A exclusão exige permissão de excluir planos e o Modo Admin de férias ativo.' });
      return;
    }
    const geradas = Number(metricas?.ferias_geradas_unicas || 0);
    const impactoFerias = geradas > 0
      ? ` O plano possui ${geradas} registro(s) de férias já gerado(s), que serão mantidos no SGP, mas perderão o vínculo com o plano.`
      : '';
    if (!window.confirm(`Primeira confirmação: excluir o plano "${plano.titulo}" também excluirá suas campanhas e respostas.${impactoFerias}`)) return;
    if (!window.confirm(`Segunda confirmação: deseja excluir definitivamente o plano "${plano.titulo}"? Esta ação não pode ser desfeita.`)) return;
    setSalvando(true);
    try {
      const resposta = await base44.functions.invoke('portal_servicos', {
        acao: 'PLANO_INSTITUCIONAL_EXCLUIR',
        plano_id: plano.id,
        confirmar_perda_vinculo: geradas > 0,
        confirmacao_dupla: true,
      });
      setSelecionado(null);
      await carregar();
      setFeedback({ tipo: 'sucesso', texto: resposta.data?.message || 'Plano excluído.' });
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
            <div><label className="text-xs font-bold text-slate-700">Escopo de lotação</label><select value={campanhaForm.tipo_escopo} onChange={(e) => setCampanhaForm({ ...campanhaForm, tipo_escopo: e.target.value, escopo_unidades_ids: [] })} className="mt-1 h-10 w-full rounded-xl border border-slate-300 px-3 text-sm"><option value="TODOS">Toda a corporação</option><option value="UNIDADES">Unidades selecionadas</option><option value="SEM_ESCOPO">Somente grupos de militares (sem lotação)</option></select>{campanhaForm.tipo_escopo === 'SEM_ESCOPO' && <p className="mt-1 text-[11px] text-slate-500">A elegibilidade será definida exclusivamente pelos grupos selecionados abaixo.</p>}</div>
            {campanhaForm.tipo_escopo === 'UNIDADES' && <div className="grid sm:grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">{unidades.length === 0 ? <p className="text-xs text-slate-500">Nenhuma unidade disponível para seleção.</p> : unidades.map((unidade) => <label key={unidade.id} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={campanhaForm.escopo_unidades_ids.includes(unidade.id)} onChange={(e) => setCampanhaForm({ ...campanhaForm, escopo_unidades_ids: e.target.checked ? [...campanhaForm.escopo_unidades_ids, unidade.id] : campanhaForm.escopo_unidades_ids.filter((id) => id !== unidade.id) })} />{unidade.nome}</label>)}</div>}
            <div>
              <label className="text-xs font-bold text-slate-700">Grupos de militares</label>
              <p className="mt-1 text-[11px] text-slate-500">Opcional quando houver lotação; selecione um ou mais grupos para restringir o público. Com “Somente grupos”, eles definem o público sem lotação.</p>
              <div className="mt-2 grid sm:grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                {grupos.length === 0 ? <p className="text-xs text-slate-500">Nenhum grupo ativo disponível. Cadastre grupos em Grupos do Efetivo.</p> : grupos.map((grupo) => (
                  <label key={grupo.id} className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={(campanhaForm.escopo_grupos_ids || []).includes(grupo.id)} onChange={(e) => setCampanhaForm({ ...campanhaForm, escopo_grupos_ids: e.target.checked ? [...(campanhaForm.escopo_grupos_ids || []), grupo.id] : (campanhaForm.escopo_grupos_ids || []).filter((id) => id !== grupo.id) })} />
                    <span>{grupo.nome}{grupo.sigla ? ` (${grupo.sigla})` : ''}</span>
                  </label>
                ))}
              </div>
            </div>
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
              {podeAdminFerias && <Button type="button" variant={modoAdmin ? 'default' : 'outline'} onClick={() => setModoAdmin((atual) => !atual)} className={modoAdmin ? 'bg-rose-700 hover:bg-rose-800' : ''}><ShieldCheck className="w-4 h-4 mr-1.5" />{modoAdmin ? 'Admin ON' : 'Modo Admin'}</Button>}
              {modoAdmin && podeAdminFerias && podeExcluirPlanos && <Button type="button" variant="outline" onClick={() => excluir(selecionado)} disabled={salvando} className="border-red-200 text-red-700 hover:bg-red-50"><Trash2 className="w-4 h-4 mr-1.5" />Excluir plano</Button>}
              {(podeVisualizarRespostas || podeGerarFerias || podeAdminFerias) && <Button type="button" onClick={() => navigate('/PainelPlanoFerias?planoId=' + selecionado.id)} className="bg-blue-700 hover:bg-blue-800"><CalendarDays className="w-4 h-4 mr-1.5" />Abrir painel consolidado</Button>}
              {podeEditarPlanos && <Button type="button" variant="outline" onClick={() => abrirEdicao(selecionado)}><Edit3 className="w-4 h-4 mr-1.5" />Editar plano</Button>}
              {modoAdmin && podeAdminFerias && podeEditarPlanos && selecionado.status !== 'ARQUIVADO' && <Button type="button" variant="outline" onClick={() => arquivar(selecionado)} disabled={salvando}><FolderArchive className="w-4 h-4 mr-1.5" />Arquivar</Button>}
              {modoAdmin && podeAdminFerias && podeEditarPlanos && selecionado.status === 'ARQUIVADO' && <Button type="button" variant="outline" onClick={() => desarquivar(selecionado)} disabled={salvando}><RefreshCw className="w-4 h-4 mr-1.5" />Desarquivar</Button>}
            </div>
          </div>
          {feedback.texto && <div className={`rounded-xl border p-3 text-sm ${feedback.tipo === 'erro' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>{feedback.texto}</div>}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-slate-900">Campanhas deste plano</h2>
                <p className="text-xs text-slate-500 mt-1">Cada campanha possui prazo e escopo próprios; todas fazem parte deste mesmo plano.</p>
              </div>
              {podeCriarCampanhas && selecionado.status !== 'ARQUIVADO' && <Button type="button" onClick={abrirNovaCampanha} className="bg-[#1e3a5f] hover:bg-[#2a4d7d]"><Plus className="w-4 h-4 mr-1.5" />Nova campanha de férias</Button>}
            </div>
            {campanhasDoPlano.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">Ainda não há campanhas neste plano.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {campanhasDoPlano.map((campanha) => (
                  <div key={campanha.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div><p className="font-bold text-slate-800">{campanha.titulo}</p><p className="text-xs text-slate-500 mt-1">Escopo: {campanha.tipo_escopo === 'SEM_ESCOPO' ? 'Somente grupos' : (campanha.escopo_unidades_nomes || 'Toda a Corporação')}{campanha.escopo_grupos_nomes ? ` · Grupos: ${campanha.escopo_grupos_nomes}` : ''} · Prazo: {campanha.data_fim_militar || '-'}</p></div>
                    <div className="flex gap-2 flex-wrap">
                      {(podeEditarCampanhas || podeAdminFerias) && <Button type="button" onClick={() => navigate('/ConfigurarCampanhaFerias?planoId=' + selecionado.id + '&campanhaId=' + campanha.id)} className="bg-blue-700 hover:bg-blue-800">Abrir campanha</Button>}
                      {podeVisualizarRespostas && <Button type="button" variant="outline" onClick={() => abrirRespostas(campanha)}><Eye className="w-4 h-4 mr-1.5" />Ver respostas</Button>}
                      {modoAdmin && podeAdminFerias && podeExcluirCampanhas && <Button type="button" variant="outline" onClick={() => excluirCampanha(campanha)} disabled={salvando} className="border-red-200 text-red-700 hover:bg-red-50"><Trash2 className="w-4 h-4 mr-1.5" />Excluir</Button>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {modoAdmin && podeAdminFerias && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <h2 className="font-bold text-slate-900">Histórico de ações</h2>
              <p className="text-xs text-slate-500 mt-1">Registro de quem salvou, aprovou, rejeitou ou alterou cada decisão.</p>
              {auditoria.length === 0 ? <p className="mt-4 text-sm text-slate-500">Nenhuma ação registrada neste plano.</p> : <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
                {auditoria.slice().sort((a, b) => String(b.data_hora || '').localeCompare(String(a.data_hora || ''))).map((registro) => <div key={registro.id} className="p-3 text-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1"><p className="font-bold text-slate-800">{registro.acao?.replace(/_/g, ' ') || 'AÇÃO'}</p><span className="text-slate-500">{registro.data_hora ? new Date(registro.data_hora).toLocaleString('pt-BR') : '-'}</span></div>
                  <p className="text-slate-600 mt-1">Usuário: <span className="font-semibold">{registro.usuario_nome || registro.usuario_email || '-'}</span>{registro.militar_nome ? ` · Militar: ${registro.militar_nome}` : ''}</p>
                </div>)}
              </div>}
            </div>
          )}
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
            {modoAdmin && podeAdminFerias && <p className="mt-4 text-xs text-rose-700">Modo Admin ativo: a exclusão remove campanhas e respostas vinculadas; férias geradas só perdem o vínculo com o plano após confirmação.</p>}
            {modoAdmin && podeGerarFerias && <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-slate-100 pt-4">
              <p className="text-xs text-slate-500">A geração inclui somente respostas novas, com escala salva, e preserva tudo o que já foi gerado.</p>
              <Button type="button" onClick={gerarFeriasDoPlano} disabled={salvando || selecionado.status === 'ARQUIVADO'} className="bg-emerald-700 hover:bg-emerald-800"><CalendarDays className="w-4 h-4 mr-1.5" />{salvando ? 'Gerando...' : 'Gerar férias do plano'}</Button>
            </div>}
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
          <div className="flex items-center gap-2">
            {podeAdminFerias && <Button type="button" variant={modoAdmin ? 'default' : 'outline'} onClick={() => setModoAdmin((atual) => !atual)} className={modoAdmin ? 'bg-rose-700 hover:bg-rose-800' : ''}><ShieldCheck className="w-4 h-4 mr-1.5" />{modoAdmin ? 'Admin ON' : 'Modo Admin'}</Button>}
            {podeCriarPlanos && <Button type="button" onClick={abrirNovo} className="bg-emerald-700 hover:bg-emerald-800"><Plus className="w-4 h-4 mr-1.5" />Novo Plano de Férias</Button>}
          </div>
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
