import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Trash2, ExternalLink, RefreshCw } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const vazio = { usuario_id: '', pode_visualizar: true, pode_editar_escala: false, pode_autorizar: false, pode_gerar_ferias: false };
const erroTexto = (erro, fallback) => erro?.response?.data?.error || erro?.data?.error || erro?.message || fallback;

export default function ConfigurarCampanhaFerias() {
  const navigate = useNavigate();
  const { isAdmin = false, canAccessAction = () => false } = useCurrentUser();
  const podeEditarCampanha = isAdmin || canAccessAction('editar_campanhas_ferias');
  const [params] = useSearchParams();
  const campanhaId = params.get('campanhaId') || '';
  const planoId = params.get('planoId') || '';
  const [campanha, setCampanha] = useState(null);
  const [plano, setPlano] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [permissoes, setPermissoes] = useState([]);
  const [form, setForm] = useState(vazio);
  const [dadosCampanhaForm, setDadosCampanhaForm] = useState({ titulo: '', data_inicio: '', data_fim_militar: '' });
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [feedback, setFeedback] = useState({ tipo: '', texto: '' });

  const carregar = async () => {
    if (!campanhaId) {
      setFeedback({ tipo: 'erro', texto: 'Campanha não informada.' });
      setLoading(false);
      return;
    }
    setLoading(true);
    setFeedback({ tipo: '', texto: '' });
    try {
      const encontrada = await base44.entities.CampanhaPortal.get(campanhaId);
      if (!encontrada) throw new Error('Campanha não encontrada ou sem acesso.');
      setCampanha(encontrada);
      setDadosCampanhaForm({
        titulo: encontrada.titulo || '',
        data_inicio: encontrada.data_inicio || '',
        data_fim_militar: encontrada.data_fim_militar || '',
      });
      const planoAtualId = planoId || encontrada.plano_ferias_institucional_id || '';
      if (planoAtualId) {
        try {
          setPlano(await base44.entities.PlanoFeriasInstitucional.get(planoAtualId));
        } catch (_erroPlano) {}
      }
      const carregarUsuariosAtivos = async () => {
        try {
          const diretos = await base44.entities.User.list();
          if (Array.isArray(diretos) && diretos.length) return diretos;
        } catch (_erroDireto) {}
        const resposta = await base44.functions.invoke('portal_servicos', { acao: 'PERMISSOES_LISTAR_USUARIOS' });
        return resposta.data?.usuarios || [];
      };
      const [usersResult, acessosResult] = await Promise.allSettled([
        carregarUsuariosAtivos(),
        base44.functions.invoke('portal_servicos', { acao: 'PLANO_PERMISSOES_LISTAR', plano_id: planoAtualId, campanha_id: campanhaId }),
      ]);
      const users = usersResult.status === 'fulfilled' ? (usersResult.value || []) : [];
      const acessosPayload = acessosResult.status === 'fulfilled' ? acessosResult.value?.data : null;
      const acessos = Array.isArray(acessosPayload?.permissoes) ? acessosPayload.permissoes : [];
      setUsuarios((users || []).filter((item) => item?.id).map((item) => ({
        id: item.id,
        nome: item.nome || item.full_name || item.name || item.email || 'Usuário sem nome',
        email: item.email || '',
      })).sort((a, b) => a.nome.localeCompare(b.nome)));
      setPermissoes(acessos);
      if (usersResult.status === 'rejected' && acessosResult.status === 'rejected') {
        throw usersResult.reason || acessosResult.reason;
      }
    } catch (erro) {
      setFeedback({ tipo: 'erro', texto: erroTexto(erro, 'Não foi possível carregar a configuração da campanha.') });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, [campanhaId, planoId]);

  const usuariosDisponiveis = useMemo(() => {
    const usados = new Set(permissoes.map((item) => String(item.usuario_id)));
    return usuarios.filter((item) => !usados.has(String(item.id)));
  }, [usuarios, permissoes]);

  const salvar = async (evento) => {
    evento.preventDefault();
    if (!form.usuario_id || !campanha?.id) return;
    setSalvando(true);
    try {
      const planoAtualId = planoId || campanha.plano_ferias_institucional_id;
      const registro = {
        plano_ferias_institucional_id: planoAtualId,
        campanha_id: campanha.id,
        usuario_id: form.usuario_id,
        pode_visualizar: Boolean(form.pode_visualizar),
        pode_editar_escala: Boolean(form.pode_editar_escala),
        pode_autorizar: Boolean(form.pode_autorizar),
        pode_gerar_ferias: Boolean(form.pode_gerar_ferias),
        ativo: true,
      };
      await base44.functions.invoke('portal_servicos', {
        acao: 'PLANO_PERMISSAO_SALVAR',
        plano_id: planoAtualId,
        permissao: registro,
      });
      setForm(vazio);
      setFeedback({ tipo: 'sucesso', texto: 'Responsável atribuído com sucesso.' });
      await carregar();
    } catch (erro) {
      setFeedback({ tipo: 'erro', texto: erroTexto(erro, 'Não foi possível atribuir este responsável.') });
    } finally {
      setSalvando(false);
    }
  };

  const salvarDadosCampanha = async (evento) => {
    evento.preventDefault();
    const titulo = dadosCampanhaForm.titulo.trim();
    if (!podeEditarCampanha || !campanha?.id || !titulo || !dadosCampanhaForm.data_inicio || !dadosCampanhaForm.data_fim_militar) return;
    if (dadosCampanhaForm.data_fim_militar < dadosCampanhaForm.data_inicio) {
      setFeedback({ tipo: 'erro', texto: 'A data final de disponibilidade não pode ser anterior à data inicial.' });
      return;
    }
    setSalvando(true);
    setFeedback({ tipo: '', texto: '' });
    try {
      const resposta = await base44.functions.invoke('portal_servicos', {
        acao: 'PLANO_CAMPANHA_SALVAR',
        campanha_id: campanha.id,
        plano_id: planoId || campanha.plano_ferias_institucional_id || '',
        campanha_payload: {
          titulo,
          data_inicio: dadosCampanhaForm.data_inicio,
          data_fim_militar: dadosCampanhaForm.data_fim_militar,
        },
      });
      setCampanha(resposta.data?.campanha || { ...campanha, ...dadosCampanhaForm, titulo });
      setDadosCampanhaForm((atual) => ({ ...atual, titulo }));
      setFeedback({ tipo: 'sucesso', texto: resposta.data?.message || 'Dados da campanha atualizados.' });
    } catch (erro) {
      setFeedback({ tipo: 'erro', texto: erroTexto(erro, 'Não foi possível atualizar os dados da campanha.') });
    } finally {
      setSalvando(false);
    }
  };

  const remover = async (permissao) => {
    if (!window.confirm('Remover este responsável da campanha?')) return;
    setSalvando(true);
    try {
      await base44.functions.invoke('portal_servicos', {
        acao: 'PLANO_PERMISSAO_EXCLUIR',
        permissao_id: permissao.id,
      });
      setPermissoes((atual) => atual.filter((item) => item.id !== permissao.id));
      setFeedback({ tipo: 'sucesso', texto: 'Acesso removido.' });
    } catch (erro) {
      setFeedback({ tipo: 'erro', texto: erroTexto(erro, 'Não foi possível remover o acesso.') });
    } finally {
      setSalvando(false);
    }
  };

  const nomeUsuario = (item) => item.usuario_nome || item.usuario_email || usuarios.find((u) => String(u.id) === String(item.usuario_id))?.nome || 'Usuário';

  if (loading) return <div className="min-h-screen bg-slate-50 p-8 text-center text-sm text-slate-500">Carregando campanha...</div>;

  return (
    <div className="min-h-screen bg-slate-50/70 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <Button type="button" variant="ghost" onClick={() => navigate('/PlanosFerias')}><ArrowLeft className="mr-1.5 h-4 w-4" />Voltar para Planos de Férias</Button>
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Campanha de Férias</p>
              <h1 className="mt-1 text-2xl font-black text-slate-900">{campanha?.titulo || 'Campanha'}</h1>
              <p className="mt-2 text-sm text-slate-500">Plano: {plano?.titulo || 'Plano de Férias'} · Status: {campanha?.status || '-'}</p>
              <p className="mt-1 text-xs text-slate-500">Escopo: {campanha?.tipo_escopo === 'SEM_ESCOPO' ? 'Somente grupos' : (campanha?.escopo_unidades_nomes || 'Toda a corporação')}{campanha?.escopo_grupos_nomes ? ` · Grupos: ${campanha.escopo_grupos_nomes}` : ''}</p>
            </div>
            <Button type="button" variant="outline" onClick={() => navigate('/PainelPlanoFerias?planoId=' + (planoId || campanha?.plano_ferias_institucional_id || '') + '&campanhaId=' + campanhaId)}><ExternalLink className="mr-1.5 h-4 w-4" />Abrir respostas e escalação</Button>
          </div>
        </div>
        {feedback.texto && <div className={`rounded-xl border p-3 text-sm ${feedback.tipo === 'erro' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{feedback.texto}</div>}
        {podeEditarCampanha && (
          <section className="rounded-2xl border border-blue-200 bg-white p-5">
            <div>
              <h2 className="font-bold text-slate-900">Dados e disponibilidade da campanha</h2>
              <p className="mt-1 text-xs text-slate-500">Altere o nome e o período em que a campanha ficará disponível aos militares.</p>
            </div>
            <form onSubmit={salvarDadosCampanha} className="mt-5 grid gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700">Nome da campanha *</label>
                <Input required value={dadosCampanhaForm.titulo} onChange={(e) => setDadosCampanhaForm({ ...dadosCampanhaForm, titulo: e.target.value })} className="mt-1" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-bold text-slate-700">Disponível a partir de *</label>
                  <Input required type="date" value={dadosCampanhaForm.data_inicio} onChange={(e) => setDadosCampanhaForm({ ...dadosCampanhaForm, data_inicio: e.target.value })} className="mt-1" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700">Disponível até *</label>
                  <Input required type="date" min={dadosCampanhaForm.data_inicio || undefined} value={dadosCampanhaForm.data_fim_militar} onChange={(e) => setDadosCampanhaForm({ ...dadosCampanhaForm, data_fim_militar: e.target.value })} className="mt-1" />
                </div>
              </div>
              <div>
                <Button type="submit" disabled={salvando || !dadosCampanhaForm.titulo.trim()} className="bg-blue-700 hover:bg-blue-800">
                  {salvando ? 'Salvando...' : 'Salvar dados da campanha'}
                </Button>
              </div>
            </form>
          </section>
        )}
        <section className="rounded-2xl border border-rose-200 bg-white p-5">
          <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-rose-700" /><div><h2 className="font-bold text-slate-900">Usuários autorizados nesta campanha</h2><p className="text-xs text-slate-500">Atribua vários responsáveis, cada um com permissões independentes.</p></div></div>
          <form onSubmit={salvar} className="mt-5 grid gap-4 rounded-xl bg-rose-50/40 p-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_repeat(4,auto)_auto] lg:items-end">
              <label className="text-xs font-bold text-slate-700">Usuário
                <select value={form.usuario_id} onChange={(e) => setForm({ ...form, usuario_id: e.target.value })} className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm">
                  <option value="">Selecione um usuário</option>
                  {usuariosDisponiveis.map((usuario) => <option key={usuario.id} value={usuario.id}>{usuario.nome}{usuario.email ? ` · ${usuario.email}` : ''}</option>)}
                </select>
              </label>
              {[
                ['pode_visualizar', 'Visualizar'],
                ['pode_editar_escala', 'Editar escala'],
                ['pode_autorizar', 'Autorizar'],
                ['pode_gerar_ferias', 'Gerar férias'],
              ].map(([campo, rotulo]) => <label key={campo} className="flex items-center gap-2 pb-2 text-xs whitespace-nowrap"><input type="checkbox" checked={form[campo]} onChange={(e) => setForm({ ...form, [campo]: e.target.checked })} />{rotulo}</label>)}
              <Button type="submit" disabled={salvando || !form.usuario_id} className="bg-rose-700 hover:bg-rose-800">{salvando ? 'Salvando...' : 'Atribuir'}</Button>
            </div>
          </form>
          <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
            {permissoes.length === 0 ? <div className="p-8 text-center text-sm text-slate-500">Nenhum responsável atribuído a esta campanha.</div> : <table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="p-3">Responsável</th><th className="p-3">Permissões</th><th className="p-3 text-right">Ação</th></tr></thead><tbody className="divide-y divide-slate-100">{permissoes.map((item) => <tr key={item.id}><td className="p-3"><p className="font-bold text-slate-800">{nomeUsuario(item)}</p><p className="text-xs text-slate-500">{item.usuario_email || ''}</p></td><td className="p-3 text-xs text-slate-600">{[['pode_visualizar','Visualizar'],['pode_editar_escala','Editar escala'],['pode_autorizar','Autorizar'],['pode_gerar_ferias','Gerar férias']].filter(([campo]) => item[campo]).map(([,rotulo]) => rotulo).join(' · ') || 'Sem permissões selecionadas'}</td><td className="p-3 text-right"><Button type="button" variant="outline" onClick={() => remover(item)} disabled={salvando} className="border-red-200 text-red-700 hover:bg-red-50"><Trash2 className="mr-1 h-4 w-4" />Remover</Button></td></tr>)}</tbody></table>}
          </div>
        </section>
        <div className="flex justify-end"><Button type="button" variant="outline" onClick={carregar}><RefreshCw className="mr-1.5 h-4 w-4" />Atualizar</Button></div>
      </div>
    </div>
  );
}
