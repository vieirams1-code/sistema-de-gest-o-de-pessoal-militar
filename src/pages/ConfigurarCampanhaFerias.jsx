import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, RefreshCw } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const erroTexto = (erro, fallback) => erro?.response?.data?.error || erro?.data?.error || erro?.message || fallback;

export default function ConfigurarCampanhaFerias() {
  const navigate = useNavigate();
  const { isAdmin = false, canAccessAction = () => false } = useCurrentUser();
  const [params] = useSearchParams();
  const campanhaId = params.get('campanhaId') || '';
  const planoId = params.get('planoId') || '';
  const [campanha, setCampanha] = useState(null);
  const [plano, setPlano] = useState(null);
  const [dadosCampanhaForm, setDadosCampanhaForm] = useState({ titulo: '', data_inicio: '', data_fim_militar: '' });
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [feedback, setFeedback] = useState({ tipo: '', texto: '' });
  const statusCampanha = String(campanha?.status || '').trim().toLowerCase();
  const campanhaEmEdicaoPermitida = !['arquivada', 'desativada', 'encerrada'].includes(statusCampanha);
  // Campanhas seguem o acesso ao módulo de Planos de Férias;
  // as antigas permissões individuais de campanha não são mais necessárias.
  const podeEditarCampanha = (isAdmin || canAccessAction('visualizar_planos_ferias'))
    && campanhaEmEdicaoPermitida
    && String(plano?.status || 'ATIVO').toUpperCase() !== 'ARQUIVADO';

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

    } catch (erro) {
      setFeedback({ tipo: 'erro', texto: erroTexto(erro, 'Não foi possível carregar a configuração da campanha.') });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, [campanhaId, planoId]);



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
        {podeEditarCampanha ? (
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
        ) : (
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="font-bold text-slate-900">Campanha em modo de consulta</h2>
            <p className="mt-1 text-sm text-slate-600">O nome e o prazo só podem ser alterados enquanto o plano estiver ativo e a campanha estiver em coleta.</p>
          </section>
        )}
        <div className="flex justify-end"><Button type="button" variant="outline" onClick={carregar}><RefreshCw className="mr-1.5 h-4 w-4" />Atualizar</Button></div>
      </div>
    </div>
  );
}
