import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AjusteSaldoFerias } from '@/api/entities';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Save, ArrowLeft, Calendar, User as UserIcon, AlertTriangle } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { addDays, format, addYears } from 'date-fns';

import FormSection from '@/components/militar/FormSection';
import MilitarSelector from '@/components/atestado/MilitarSelector';
import { useUsuarioPodeAgirSobreMilitar } from '@/hooks/useUsuarioPodeAgirSobreMilitar';
import {
  getAlertaPeriodoConcessivo,
  validarInicioNoPeriodoConcessivo,
  validarOrdemFracoesCadastro,
} from '@/components/ferias/feriasRules';
import { DIAS_BASE_PADRAO } from '@/services/saldoFeriasOperacionalService';
import { calcularSaldoOperacionalPeriodoComTodosAjustes } from '@/services/saldoFeriasOperacionalService';
import { sincronizarPeriodoAquisitivoDaFerias } from '@/components/ferias/feriasService';
import { criarEscopado, atualizarEscopado } from '@/services/cudEscopadoClient';
import { isPeriodoDisponivelOperacional } from '@/services/periodosAquisitivosOperacionais';
import { fetchScopedPeriodosAquisitivosBundle } from '@/services/getScopedPeriodosAquisitivosBundleClient';
import { getEffectiveEmail } from '@/services/getScopedMilitaresClient';
import { distribuirFracoesPorSaldo, somarFracoes } from '@/components/ferias/distribuicaoFracoesFerias';

// Opções por QUANTIDADE de frações. A distribuição dos dias é derivada do
// saldo operacional calculado pelo motor oficial (nunca fixa em 10+10+10).
const OPCOES_FRACOES = [
  { label: '1 fração integral', quantidade: 1 },
  { label: '2 frações', quantidade: 2 },
  { label: '3 frações', quantidade: 3 },
];

const calcularFim = (inicio, dias) => {
  if (!inicio || !dias) return '';
  const d = addDays(new Date(inicio + 'T00:00:00'), dias - 1);
  return format(d, 'yyyy-MM-dd');
};
const calcularRetorno = (inicio, dias) => {
  if (!inicio || !dias) return '';
  const d = addDays(new Date(inicio + 'T00:00:00'), dias);
  return format(d, 'yyyy-MM-dd');
};

const initialFormData = {
  militar_id: '', militar_nome: '', militar_posto: '', militar_matricula: '',
  periodo_aquisitivo_id: '', periodo_aquisitivo_ref: '',
  status: 'Prevista', observacoes: ''
};

export default function CadastrarFerias() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id') || searchParams.get('editId');
  const queryClient = useQueryClient();
  const {
    isAdmin,
    modoAcesso,
    userEmail,
    canAccessModule,
    canAccessAction,
    isLoading: loadingUser,
    isAccessResolved,
  } = useCurrentUser();
  const { validar: validarEscopoMilitar } = useUsuarioPodeAgirSobreMilitar();
  const hasFeriasAccess = canAccessModule('ferias');
  const isEditing = Boolean(editId);
  const requiredActionKey = isEditing ? 'editar_ferias' : 'criar_ferias';
  const hasRequiredFeriasAction = canAccessAction(requiredActionKey);
  const effectiveEmail = getEffectiveEmail();

  const [formData, setFormData] = useState(initialFormData);
  const [loading, setLoading] = useState(false);
  const [opcaoFracao, setOpcaoFracao] = useState(0);
  const [indiceDiferenca, setIndiceDiferenca] = useState(null);
  const [fracoes, setFracoes] = useState([{ dias: 30, data_inicio: '', data_fim: '', data_retorno: '' }]);

  // Bundle escopado de períodos aquisitivos e férias do militar para evitar cache vazio/race condition.
  const { data: paBundle, isLoading: loadingPaBundle } = useQuery({
    queryKey: [
      'cadastrar-ferias-pa-bundle',
      Boolean(isAdmin),
      modoAcesso || null,
      userEmail || null,
      effectiveEmail || null,
      formData.militar_id || null
    ],
    queryFn: () => fetchScopedPeriodosAquisitivosBundle(),
    enabled: isAccessResolved && hasFeriasAccess && hasRequiredFeriasAction && !!formData.militar_id,
    refetchOnMount: 'always',
    staleTime: 0,
    placeholderData: undefined
  });

  const periodosExistentes = (paBundle?.periodosAquisitivos || [])
    .filter(p => String(p.militar_id) === String(formData.militar_id));

  const feriasExistentes = (paBundle?.ferias || [])
    .filter(f => String(f.militar_id) === String(formData.militar_id));

  const { data: ajustesSaldoFerias = [] } = useQuery({
    queryKey: ['cadastrar-ferias-ajustes-saldo-ferias', Boolean(isAdmin), modoAcesso || null, userEmail || null, effectiveEmail || null, formData.militar_id || null],
    queryFn: () => AjusteSaldoFerias.list('-created_date'),
    enabled: isAccessResolved && hasFeriasAccess && hasRequiredFeriasAction && !!formData.militar_id,
    refetchOnMount: 'always',
    staleTime: 0,
  });

  // Só períodos disponíveis operacionalmente para novas férias.
  const periodosAtivos = periodosExistentes.filter(isPeriodoDisponivelOperacional);

  // Carregar férias para edição
  const { data: editingFerias, isLoading: loadingEdit } = useQuery({
    queryKey: ['ferias', editId],
    queryFn: async () => {
      if (!editId) return null;
      const list = await base44.entities.Ferias.filter({ id: editId });
      return list[0] || null;
    },
    enabled: !!editId && isAccessResolved && hasFeriasAccess && hasRequiredFeriasAction
  });

  useEffect(() => {
    if (editingFerias) {
      setFormData({ ...initialFormData, ...editingFerias });
      setFracoes([{
        dias: editingFerias.dias || 30,
        data_inicio: editingFerias.data_inicio || '',
        data_fim: editingFerias.data_fim || '',
        data_retorno: editingFerias.data_retorno || ''
      }]);
    }
  }, [editingFerias]);

  const handleChange = (name, value) => setFormData(prev => ({ ...prev, [name]: value }));

  const handleMilitarSelect = (militarData) => {
    setFormData(prev => ({ ...prev, ...militarData, periodo_aquisitivo_id: '', periodo_aquisitivo_ref: '' }));
  };

  const handleOpcaoFracao = (idx) => {
    setOpcaoFracao(idx);
    const quantidade = OPCOES_FRACOES[idx].quantidade;
    const saldoUtilizavel = saldoOperacionalSelecionado ? Math.max(0, saldoOperacionalSelecionado.saldo_restante) : DIAS_BASE_PADRAO;
    const idxDiff = quantidade > 1 ? quantidade - 1 : null;
    setIndiceDiferenca(idxDiff);
    const diasOpcao = distribuirFracoesPorSaldo(saldoUtilizavel, quantidade, idxDiff);
    const novasFracoes = diasOpcao.map(d => ({ dias: d, data_inicio: '', data_fim: '', data_retorno: '' }));
    setFracoes(novasFracoes);
  };

  const handleIndiceDiferenca = (idx) => {
    setIndiceDiferenca(idx);
    const quantidade = OPCOES_FRACOES[opcaoFracao].quantidade;
    const saldoUtilizavel = saldoOperacionalSelecionado ? Math.max(0, saldoOperacionalSelecionado.saldo_restante) : DIAS_BASE_PADRAO;
    const diasOpcao = distribuirFracoesPorSaldo(saldoUtilizavel, quantidade, idx);
    setFracoes(prev => prev.map((f, i) => ({ ...f, dias: diasOpcao[i] })));
  };

  const [avisoVencimento, setAvisoVencimento] = useState(null);
  const [erroRegras, setErroRegras] = useState(null);

  const periodoSelecionado = periodosAtivos.find((p) => p.id === formData.periodo_aquisitivo_id);
  const saldoOperacionalSelecionado = periodoSelecionado ? calcularSaldoOperacionalPeriodoComTodosAjustes({
    periodo: periodoSelecionado,
    ajustes: ajustesSaldoFerias,
    ferias: feriasExistentes.filter((item) => !editId || String(item?.id) !== String(editId)),
  }) : null;

  const totalOperacionalDisponivel = Math.max(0, saldoOperacionalSelecionado?.saldo_restante ?? DIAS_BASE_PADRAO);
  const somaFracoes = somarFracoes(fracoes);
  const somaDivergente = !editId && !!periodoSelecionado && somaFracoes !== totalOperacionalDisponivel;
  const temParcelaInvalida = !editId && fracoes.some((f) => Number(f?.dias) <= 0);

  const handleFracaoChange = (i, field, value) => {
    setFracoes(prev => {
      const updated = [...prev];
      updated[i] = { ...updated[i], [field]: value };
      if (field === 'data_inicio' || field === 'dias') {
        const inicio = field === 'data_inicio' ? value : updated[i].data_inicio;
        const dias = field === 'dias' ? value : updated[i].dias;
        updated[i].data_fim = calcularFim(inicio, dias);
        updated[i].data_retorno = calcularRetorno(inicio, dias);
      }
      return updated;
    });

    // Verificar se a data de início está além de 24 meses do período aquisitivo
    if (field === 'data_inicio' && value && formData.periodo_aquisitivo_id) {
      const periodo = periodosAtivos.find(p => p.id === formData.periodo_aquisitivo_id);
      if (periodo?.data_limite_gozo) {
        const erroConcessivo = validarInicioNoPeriodoConcessivo(value, periodo.data_limite_gozo);
        setAvisoVencimento(erroConcessivo ? `⚠ ${erroConcessivo}` : null);
      }
    }

    setErroRegras(null);
  };

  const handlePeriodoChange = (ref) => {
    const periodoExistente = periodosAtivos.find(p => p.ano_referencia === ref);
    const saldoUtilizavel = periodoExistente ? Math.max(0, calcularSaldoOperacionalPeriodoComTodosAjustes({ periodo: periodoExistente, ajustes: ajustesSaldoFerias, ferias: feriasExistentes }).saldo_restante) : DIAS_BASE_PADRAO;
    setFormData(prev => ({
      ...prev,
      periodo_aquisitivo_ref: ref,
      periodo_aquisitivo_id: periodoExistente?.id || ''
    }));

    if (!editId && opcaoFracao === 0) {
      setFracoes([{ dias: saldoUtilizavel, data_inicio: '', data_fim: '', data_retorno: '' }]);
    }
  };

  // Verificar duplicidade de período
  const periodosJaCadastrados = feriasExistentes
    .filter(f => !editId || f.id !== editId)
    .map(f => f.periodo_aquisitivo_ref);

  // Usar somente os períodos ativos como opções
  // Em modo de edição, inclui sempre o período atual da férias sendo editada
  const periodoAtualEdicao = editingFerias?.periodo_aquisitivo_ref;
  const opcaoAnos = periodosAtivos
    .filter(p => !periodosJaCadastrados.includes(p.ano_referencia) || p.ano_referencia === periodoAtualEdicao)
    .map(p => p.ano_referencia)
    .filter(Boolean)
    .sort((a, b) => b.localeCompare(a));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!hasRequiredFeriasAction) return;
    if (!formData.militar_id || !formData.periodo_aquisitivo_ref) return;

    // Lote Trava Emergencial — escopo de escrita
    const militarAlvoId = editingFerias?.militar_id || formData.militar_id;
    const escopo = validarEscopoMilitar(militarAlvoId);
    if (!escopo.permitido) {
      alert(escopo.motivo);
      return;
    }

    const erroOrdem = validarOrdemFracoesCadastro({
      militarId: formData.militar_id,
      periodoRef: formData.periodo_aquisitivo_ref,
      fracoes,
      feriasExistentes,
      editFerias: editingFerias,
      editId,
    });

    if (erroOrdem) {
      setErroRegras(erroOrdem);
      return;
    }

    if (periodoSelecionado && !editId) {
      const totalDiasSolicitados = somarFracoes(fracoes);
      if (fracoes.some((item) => Number(item?.dias) <= 0)) {
        setErroRegras('Nenhuma fração pode ter zero ou menos dias. Ajuste a distribuição.');
        return;
      }
      if (totalDiasSolicitados !== totalOperacionalDisponivel) {
        setErroRegras(`A soma das frações (${totalDiasSolicitados}d) deve ser exatamente igual aos ${totalOperacionalDisponivel} dias disponíveis do período.`);
        return;
      }
    }

    setLoading(true);

    const labelFracao = (i, total) => {
      if (total === 1) return 'Integral';
      if (i === 0) return '1ª Fração';
      if (i === 1) return '2ª Fração';
      return '3ª Fração';
    };

    let periodoAquisitivoId = formData.periodo_aquisitivo_id || editingFerias?.periodo_aquisitivo_id || null;

    try {
      // Se é edição, atualizar registro único
      if (editId) {
        const f = fracoes[0];
        await atualizarEscopado('Ferias', editId, {
          ...formData,
          dias: f.dias,
          // Gravar dias_base apenas se ainda não existir (não sobrescrever base imutável)
          ...(editingFerias?.dias_base ? {} : { dias_base: f.dias }),
          data_inicio: f.data_inicio,
          data_fim: f.data_fim,
          data_retorno: f.data_retorno,
          fracionamento: editingFerias?.fracionamento || labelFracao(0, fracoes.length)
        });
      } else {
        // Criar uma fração por registro
        for (let i = 0; i < fracoes.length; i++) {
          const f = fracoes[i];
          const fracionamento = labelFracao(i, fracoes.length);
          await criarEscopado('Ferias', {
            ...formData,
            dias: f.dias,
            dias_base: f.dias,       // base imutável — nunca alterada por adição/desconto
            data_inicio: f.data_inicio,
            data_fim: f.data_fim,
            data_retorno: f.data_retorno,
            fracionamento
          });
        }

        // Criar ou atualizar período aquisitivo se não existir
        if (!formData.periodo_aquisitivo_id) {
          const partes = formData.periodo_aquisitivo_ref.split('/');
          const anoInicio = parseInt(partes[0]);
          const anoFim = parseInt(partes[1]);
          const militar = await base44.entities.Militar.filter({ id: formData.militar_id });
          const m = militar[0];
          if (m) {
            const dataInclusao = new Date((m.data_inclusao || `${anoInicio}-01-01`) + 'T00:00:00');
            const diaAniversario = format(dataInclusao, 'MM-dd');
            const inicio = `${anoInicio}-${diaAniversario}`;
            const fim = format(addDays(new Date(`${anoFim}-${diaAniversario}T00:00:00`), -1), 'yyyy-MM-dd');
            const limite = format(addYears(new Date(fim + 'T00:00:00'), 2), 'yyyy-MM-dd');
            const periodoCriado = await criarEscopado('PeriodoAquisitivo', {
              militar_id: formData.militar_id,
              militar_nome: formData.militar_nome,
              militar_posto: formData.militar_posto,
              militar_matricula: formData.militar_matricula,
              inicio_aquisitivo: inicio,
              fim_aquisitivo: fim,
              data_limite_gozo: limite,
              dias_base: DIAS_BASE_PADRAO,
              dias_total: DIAS_BASE_PADRAO,
              dias_gozados: 0,
              dias_previstos: 0,
              dias_saldo: DIAS_BASE_PADRAO,
              status: 'Disponível',
              ano_referencia: formData.periodo_aquisitivo_ref
            });
            periodoAquisitivoId = periodoCriado?.id || periodoAquisitivoId;
          }
        }
      }
    } catch (err) {
      setLoading(false);
      alert(err?.message || 'Falha ao salvar férias.');
      return;
    }

    await sincronizarPeriodoAquisitivoDaFerias({
      periodoAquisitivoId,
      periodoAquisitivoRef: formData.periodo_aquisitivo_ref,
      militarId: formData.militar_id,
    });

    queryClient.invalidateQueries({ queryKey: ['ferias'] });
    queryClient.invalidateQueries({ queryKey: ['periodos-aquisitivos'] });
    queryClient.invalidateQueries({ queryKey: ['ajustes-saldo-ferias'] });
    setLoading(false);
    navigate(createPageUrl('Ferias'));
  };

  if (loadingUser || !isAccessResolved) return null;
  if (!hasFeriasAccess || !hasRequiredFeriasAction) return <AccessDenied modulo="Férias" />;

  if (loadingEdit) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl('Ferias'))} className="hover:bg-slate-200">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-[#1e3a5f]">{editId ? 'Editar Férias' : 'Cadastrar Férias'}</h1>
              <p className="text-slate-500 text-sm">Registrar concessão de férias</p>
            </div>
          </div>
          <Button
            onClick={handleSubmit}
            disabled={loading || !formData.militar_id || !formData.periodo_aquisitivo_ref || fracoes.some(f => !f.data_inicio) || somaDivergente || temParcelaInvalida}
            className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white px-6"
          >
            {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
            Salvar
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {editId && formData.status && !['Prevista', 'Autorizada'].includes(formData.status) && (
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800 leading-relaxed">
                <strong>Atenção:</strong> Estas férias estão com status <strong>{formData.status}</strong>. 
                Alterar dados aqui modifica o plano base, mas <strong>não altera automaticamente</strong> os registros do Livro e as publicações da cadeia operacional. Use o painel da Família na tela de Férias para gerir operações.
              </p>
            </div>
          )}

          <FormSection title="Militar" icon={UserIcon} defaultOpen={true}>
            <MilitarSelector value={formData.militar_id} onChange={handleChange} onMilitarSelect={handleMilitarSelect} />
          </FormSection>

          {formData.militar_id && (
            <FormSection title="Período Aquisitivo" icon={Calendar} defaultOpen={true}>
              <div className="space-y-3">
                <Label className="text-sm font-medium text-slate-700">Selecione o Período <span className="text-red-500">*</span></Label>
                {editId ? (
                  <div className="mt-1.5 px-3 py-2 border rounded-md bg-slate-50 text-slate-700 text-sm font-medium">
                    {formData.periodo_aquisitivo_ref || '—'}
                  </div>
                ) : (
                  <>
                    <Select value={formData.periodo_aquisitivo_ref} onValueChange={handlePeriodoChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Escolha o período aquisitivo..." />
                      </SelectTrigger>
                      <SelectContent>
                        {loadingPaBundle ? (
                          <SelectItem value="__loading-periodos" disabled>Carregando períodos aquisitivos...</SelectItem>
                        ) : opcaoAnos.length > 0 ? (
                          opcaoAnos.map(ano => (
                            <SelectItem key={ano} value={ano}>{ano}</SelectItem>
                          ))
                        ) : (
                          <SelectItem value="__empty-periodos" disabled>Nenhum período aquisitivo disponível para este militar no escopo atual.</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    {formData.periodo_aquisitivo_ref && periodosJaCadastrados.includes(formData.periodo_aquisitivo_ref) && (
                      <p className="text-xs text-red-500">⚠ Já existe férias cadastradas para este período.</p>
                    )}
                  </>
                )}
              </div>
            </FormSection>
          )}

          {formData.militar_id && formData.periodo_aquisitivo_ref && (
            <>
              {!editId && (
                <FormSection title="Fracionamento" icon={Calendar} defaultOpen={true}>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {OPCOES_FRACOES.map((op, i) => {
                      const label = i === 0 ? `1 fração integral (${totalOperacionalDisponivel} dias)` : op.label;
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleOpcaoFracao(i)}
                          className={`p-3 rounded-lg border text-sm text-left transition-all ${opcaoFracao === i ? 'border-[#1e3a5f] bg-[#1e3a5f]/5 text-[#1e3a5f] font-medium' : 'border-slate-200 hover:border-slate-300'}`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>

                  {fracoes.length > 1 && (
                    <div className="mt-4">
                      <Label className="text-sm font-medium text-slate-700">Fração que recebe a diferença</Label>
                      <div className="grid grid-cols-3 gap-2 mt-1.5">
                        {fracoes.map((_, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => handleIndiceDiferenca(i)}
                            className={`p-2 rounded-lg border text-sm transition-all ${indiceDiferenca === i ? 'border-[#1e3a5f] bg-[#1e3a5f]/5 text-[#1e3a5f] font-medium' : 'border-slate-200 hover:border-slate-300'}`}
                          >
                            {i + 1}ª fração
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className={`mt-4 rounded-lg border px-4 py-3 text-sm ${somaDivergente || temParcelaInvalida ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                    <div>Total disponível: <strong>{totalOperacionalDisponivel} dias</strong></div>
                    <div className="mt-1">Soma das frações: <strong>{somaFracoes} de {totalOperacionalDisponivel} dias</strong></div>
                    {somaDivergente && (
                      <div className="mt-1 font-medium">A soma das frações deve ser exatamente igual aos {totalOperacionalDisponivel} dias disponíveis.</div>
                    )}
                    {temParcelaInvalida && (
                      <div className="mt-1 font-medium">Nenhuma fração pode ter zero ou menos dias.</div>
                    )}
                  </div>
                </FormSection>
              )}

              {periodoSelecionado && (
                <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-800">
                  Saldo utilizável do período: <strong>{saldoOperacionalSelecionado?.direito_liquido ?? DIAS_BASE_PADRAO} dias</strong>
                  <span className="text-xs ml-2">(direito líquido derivado de AjusteSaldoFerias; saldo restante: {Math.max(0, saldoOperacionalSelecionado?.saldo_restante ?? DIAS_BASE_PADRAO)} dias)</span>
                </div>
              )}

              {fracoes.map((f, i) => (
                <div key={i} className="bg-white rounded-xl border border-slate-200 p-6">
                  <h3 className="text-base font-semibold text-[#1e3a5f] mb-4">
                    {fracoes.length > 1 ? `${i + 1}ª Fração — ${f.dias} dias` : `Férias — ${f.dias} dias`}
                  </h3>
                  {!editId && fracoes.length > 1 && (
                    <div className="mb-4">
                      <Label className="text-sm font-medium text-slate-700">Dias desta fração</Label>
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        value={f.dias}
                        onChange={e => handleFracaoChange(i, 'dias', Number(e.target.value))}
                        className="mt-1.5 max-w-32"
                      />
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-slate-700">Data de Início <span className="text-red-500">*</span></Label>
                      <Input
                        type="date"
                        value={f.data_inicio}
                        onChange={e => handleFracaoChange(i, 'data_inicio', e.target.value)}
                        className="mt-1.5"
                        required
                      />
                      {i === 0 && avisoVencimento && (
                        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mt-1.5 flex items-start gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                          {avisoVencimento}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-slate-700">Data de Fim</Label>
                      <Input type="date" value={f.data_fim} disabled className="mt-1.5 bg-slate-50" />
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-slate-700">Data de Retorno</Label>
                      <Input type="date" value={f.data_retorno} disabled className="mt-1.5 bg-slate-50" />
                    </div>
                  </div>
                </div>
              ))}

              <div className="bg-white rounded-xl border border-slate-200 p-6">
                {erroRegras && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2 mb-3">
                    {erroRegras}
                  </p>
                )}
                {periodoSelecionado?.data_limite_gozo && !fracoes.some((fracao) => validarInicioNoPeriodoConcessivo(fracao.data_inicio, periodoSelecionado.data_limite_gozo)) && (
                  (() => {
                    const hasPrevisaoValida = fracoes.some((fracao) => !!fracao.data_inicio);
                    const alerta = getAlertaPeriodoConcessivo({
                      dataLimiteGozo: periodoSelecionado.data_limite_gozo,
                      hasPrevisaoValida,
                    });

                    if (!alerta) return null;

                    return (
                      <p className={`text-xs rounded p-2 mb-3 border ${alerta.nivel === 'critico' ? 'text-red-700 bg-red-50 border-red-200' : 'text-amber-700 bg-amber-50 border-amber-200'}`}>
                        {alerta.nivel === 'critico' ? 'Crítico' : 'Atenção'}: faltam {alerta.diasRestantes} dias para o limite de gozo sem previsão válida.
                      </p>
                    );
                  })()
                )}
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-slate-700">Status</Label>
                  <Select value={formData.status} onValueChange={v => handleChange('status', v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Prevista">Prevista</SelectItem>
                      <SelectItem value="Em Curso">Em Curso</SelectItem>
                      <SelectItem value="Gozada">Gozada</SelectItem>
                      <SelectItem value="Interrompida">Interrompida</SelectItem>
                    </SelectContent>
                  </Select>
                  <Label className="text-sm font-medium text-slate-700 block mt-3">Observações</Label>
                  <Textarea
                    value={formData.observacoes}
                    onChange={e => handleChange('observacoes', e.target.value)}
                    placeholder="Observações sobre as férias..."
                    className="min-h-20 border-slate-200"
                  />
                </div>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}