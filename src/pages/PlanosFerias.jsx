import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { CalendarDays, ChevronLeft, Edit3, FolderArchive, Plus, RefreshCw, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const novoPlano = () => ({
  titulo: '',
  ano_referencia: new Date().getFullYear() + 1,
  descricao: '',
  data_abertura: new Date().toISOString().slice(0, 10),
});

export default function PlanosFerias() {
  const navigate = useNavigate();
  const [planos, setPlanos] = useState([]);
  const [campanhas, setCampanhas] = useState([]);
  const [selecionado, setSelecionado] = useState(null);
  const [form, setForm] = useState(novoPlano());
  const [modoFormulario, setModoFormulario] = useState(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [feedback, setFeedback] = useState({ tipo: '', texto: '' });

  const carregar = async () => {
    setLoading(true);
    setFeedback({ tipo: '', texto: '' });
    try {
      const [planosRes, campanhasRes] = await Promise.all([
        base44.functions.invoke('portal_servicos', { acao: 'PLANO_INSTITUCIONAL_LISTAR' }),
        base44.functions.invoke('portal_servicos', { acao: 'CAMPANHA_LISTAR' }),
      ]);
      const listaPlanos = planosRes.data?.planos || [];
      setPlanos(listaPlanos);
      setCampanhas(campanhasRes.data?.campanhas || []);
      setSelecionado((atual) => atual ? listaPlanos.find((p) => p.id === atual.id) || null : null);
    } catch (erro) {
      setFeedback({ tipo: 'erro', texto: erro.message || 'Não foi possível carregar os Planos de Férias.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, []);

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
        await base44.functions.invoke('portal_servicos', { acao: 'PLANO_INSTITUCIONAL_ATUALIZAR', plano_id: selecionado.id, plano_payload: payload });
      } else {
        await base44.functions.invoke('portal_servicos', { acao: 'PLANO_INSTITUCIONAL_CRIAR', plano_payload: payload });
      }
      setModoFormulario(null);
      await carregar();
      setFeedback({ tipo: 'sucesso', texto: 'Plano de Férias salvo com sucesso.' });
    } catch (erro) {
      setFeedback({ tipo: 'erro', texto: erro.message || 'Não foi possível salvar o plano.' });
    } finally {
      setSalvando(false);
    }
  };

  const arquivar = async (plano) => {
    if (!window.confirm(`Arquivar o plano "${plano.titulo}"? O histórico será preservado e novas campanhas não poderão ser incluídas.`)) return;
    setSalvando(true);
    try {
      await base44.functions.invoke('portal_servicos', { acao: 'PLANO_INSTITUCIONAL_ARQUIVAR', plano_id: plano.id });
      setSelecionado(null);
      await carregar();
      setFeedback({ tipo: 'sucesso', texto: 'Plano arquivado. O histórico foi preservado.' });
    } catch (erro) {
      setFeedback({ tipo: 'erro', texto: erro.message || 'Não foi possível arquivar o plano.' });
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async (plano) => {
    if (!window.confirm(`Excluir o plano vazio "${plano.titulo}"? Esta ação não pode ser desfeita.`)) return;
    setSalvando(true);
    try {
      await base44.functions.invoke('portal_servicos', { acao: 'PLANO_INSTITUCIONAL_EXCLUIR', plano_id: plano.id });
      setSelecionado(null);
      await carregar();
      setFeedback({ tipo: 'sucesso', texto: 'Plano excluído.' });
    } catch (erro) {
      setFeedback({ tipo: 'erro', texto: erro.message || 'Não foi possível excluir o plano.' });
    } finally {
      setSalvando(false);
    }
  };

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
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-slate-900">Campanhas deste plano</h2>
                <p className="text-xs text-slate-500 mt-1">Cada campanha possui prazo e escopo próprios; todas fazem parte deste mesmo plano.</p>
              </div>
              {selecionado.status !== 'ARQUIVADO' && <Button type="button" onClick={() => navigate(createPageUrl('GerirCampanhasPortal') + `?planoId=${selecionado.id}`)} className="bg-[#1e3a5f] hover:bg-[#2a4d7d]"><Plus className="w-4 h-4 mr-1.5" />Nova campanha</Button>}
            </div>
            {campanhasDoPlano.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">Ainda não há campanhas neste plano.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {campanhasDoPlano.map((campanha) => (
                  <div key={campanha.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div><p className="font-bold text-slate-800">{campanha.titulo}</p><p className="text-xs text-slate-500 mt-1">Escopo: {campanha.escopo_unidades_nomes || 'Toda a Corporação'} · Prazo: {campanha.data_fim_militar || '-'}</p></div>
                    <Button type="button" variant="outline" onClick={() => navigate(createPageUrl('CentralRespostasCampanhas') + `?campanhaId=${campanha.id}`)}>Ver respostas</Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            A geração consolidada de férias será executada neste plano, nunca em uma campanha isolada. Ela permanece bloqueada nesta etapa até a consolidação e as salvaguardas de geração complementar estarem concluídas.
          </div>
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
