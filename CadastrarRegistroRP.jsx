import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowLeft,
  Save,
  BookOpenText,
  Search,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  UserRound,
  FileText,
  ClipboardCheck,
} from 'lucide-react';
import MilitarSelector from '@/components/atestado/MilitarSelector';
import RPSpecificFieldsLivro from '@/components/rp/RPSpecificFieldsLivro';
import RPSpecificFieldsExOfficio from '@/components/rp/RPSpecificFieldsExOfficio';
import FormField from '@/components/militar/FormField';
import {
  getTiposRPFiltrados,
  groupTiposRP,
  matchesTipoRPSearch,
  getModuloByTipo,
  MODULO_LIVRO,
  MODULO_EX_OFFICIO,
} from '@/components/rp/rpTiposConfig';
import { getLivroOperacaoFerias } from '@/components/livro/feriasOperacaoUtils';

const STATUS_OPTIONS = ['Aguardando Nota', 'Aguardando Publicação', 'Publicado'];

const STEP_TIPO = 1;
const STEP_MILITAR = 2;
const STEP_DADOS = 3;
const STEP_FINALIZACAO = 4;

const initialState = {
  militar_id: '',
  militar_nome: '',
  militar_posto: '',
  militar_matricula: '',
  tipo_registro: '',
  data_registro: new Date().toISOString().split('T')[0],
  status: 'Aguardando Nota',
  nota_para_bg: '',
  numero_bg: '',
  data_bg: '',
  texto_publicacao: '',
  observacoes: '',
  ferias_id: '',
  data_inicio: '',
  data_termino: '',
  data_retorno: '',
  dias: '',
  conjuge_nome: '',
  falecido_nome: '',
  falecido_certidao: '',
  grau_parentesco: '',
  origem: '',
  destino: '',
  data_cedencia: '',
  obs_cedencia: '',
  publicacao_transferencia: '',
  data_transferencia: '',
  motivo_dispensa: '',
  missao_descricao: '',
  documento_referencia: '',
  curso_nome: '',
  curso_local: '',
  edicao_ano: '',
  texto_complemento: '',
  texto_base: '',
  data_melhoria: '',
  comportamento_atual: '',
  comportamento_ingressou: '',
  portaria: '',
  tipo_punicao: '',
  data_portaria: '',
  dias_punicao: '',
  data_punicao: '',
  comportamento_inicial: '',
  itens_enquadramento: '',
  comportamento_ingresso: '',
  graduacao_punicao: '',
  subtipo_geral: '',
  data_fato: '',
  funcao: '',
  data_designacao: '',
  finalidade_jiso: '',
  secao_jiso: '',
  data_ata: '',
  nup: '',
  parecer_jiso: '',
  atestados_jiso_ids: [],
  atestado_homologado_id: '',
  documento: '',
  data_documento: '',
  assunto: '',
  publicacao_referencia_id: '',
  publicacao_referencia_numero_bg: '',
  publicacao_referencia_data_bg: '',
  publicacao_referencia_nota: '',
  texto_errado: '',
  texto_novo: '',
};

function formatarDataExtenso(dataStr) {
  if (!dataStr) return '';
  const d = new Date(`${dataStr}T00:00:00`);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function formatarDataCurta(dataStr) {
  if (!dataStr) return '-';
  const d = new Date(`${dataStr}T00:00:00`);
  return d.toLocaleDateString('pt-BR');
}

function getStepMeta(step) {
  switch (step) {
    case STEP_TIPO:
      return {
        title: 'Tipo de registro',
        description: 'Escolha o tipo do ato ou publicação.',
        icon: FileText,
      };
    case STEP_MILITAR:
      return {
        title: 'Militar',
        description: 'Selecione o militar relacionado ao registro.',
        icon: UserRound,
      };
    case STEP_DADOS:
      return {
        title: 'Dados do registro',
        description: 'Preencha apenas os campos necessários para este tipo.',
        icon: ClipboardCheck,
      };
    case STEP_FINALIZACAO:
      return {
        title: 'Finalização',
        description: 'Revise publicação, observações e confirme o salvamento.',
        icon: CheckCircle2,
      };
    default:
      return {
        title: '',
        description: '',
        icon: FileText,
      };
  }
}

function getTipoBadgeClasses(modulo) {
  return modulo === MODULO_LIVRO
    ? 'border-blue-200 bg-blue-50 text-blue-700'
    : 'border-violet-200 bg-violet-50 text-violet-700';
}

function getQuickTypes(tipos = []) {
  const preferidos = ['inicio_ferias', 'termino_ferias', 'dispensa', 'dispensa_funcao', 'licenca_luto', 'licenca_nupcias'];
  const encontrados = preferidos
    .map((value) => tipos.find((tipo) => tipo.value === value))
    .filter(Boolean);

  if (encontrados.length >= 4) return encontrados.slice(0, 4);
  return tipos.slice(0, 4);
}

function buildResumoCampos(formData, moduloAtual) {
  const itens = [];

  if (formData.data_registro) itens.push(['Data do registro', formatarDataCurta(formData.data_registro)]);
  if (formData.data_inicio) itens.push(['Data início', formatarDataCurta(formData.data_inicio)]);
  if (formData.data_termino) itens.push(['Data término', formatarDataCurta(formData.data_termino)]);
  if (formData.data_retorno) itens.push(['Data retorno', formatarDataCurta(formData.data_retorno)]);
  if (formData.dias) itens.push(['Dias', String(formData.dias)]);
  if (formData.origem) itens.push(['Origem', formData.origem]);
  if (formData.destino) itens.push(['Destino', formData.destino]);
  if (formData.curso_nome) itens.push(['Curso', formData.curso_nome]);
  if (formData.missao_descricao) itens.push(['Missão', formData.missao_descricao]);
  if (formData.funcao) itens.push(['Função', formData.funcao]);
  if (formData.documento) itens.push(['Documento', formData.documento]);
  if (formData.assunto) itens.push(['Assunto', formData.assunto]);
  if (formData.finalidade_jiso) itens.push(['Finalidade JISO', formData.finalidade_jiso]);

  if (moduloAtual === MODULO_EX_OFFICIO && formData.texto_complemento) {
    itens.push(['Complemento', formData.texto_complemento]);
  }

  return itens.slice(0, 10);
}

export default function CadastrarRegistroRP() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const registroId = searchParams.get('id');
  const tipoInicial = searchParams.get('tipo');
  const isEditing = !!registroId;

  const { canAccessModule, isAccessResolved, isLoading: loadingUser } = useCurrentUser();
  const hasAccess = canAccessModule('livro') || canAccessModule('publicacoes');

  const [currentStep, setCurrentStep] = useState(isEditing ? STEP_DADOS : STEP_TIPO);
  const [tipoSearch, setTipoSearch] = useState('');
  const [selectedTipo, setSelectedTipo] = useState(null);
  const [formData, setFormData] = useState(initialState);
  const [camposCustom, setCamposCustom] = useState({});
  const [selectedFerias, setSelectedFerias] = useState(null);
  const [operacaoFeriasSelecionada, setOperacaoFeriasSelecionada] = useState(null);
  const [originalActEntries, setOriginalActEntries] = useState([]);
  const [moduloOrigemEdicao, setModuloOrigemEdicao] = useState(null);
  const [errosStep, setErrosStep] = useState({});

  const { data: registroEdicao, isLoading: loadingRegistro } = useQuery({
    queryKey: ['registro-rp-edicao', registroId],
    queryFn: async () => {
      try {
        const livros = await base44.entities.RegistroLivro.filter({ id: registroId });
        if (livros.length > 0) return { ...livros[0], _modulo: 'Livro' };
      } catch (_) {}

      try {
        const exofficio = await base44.entities.PublicacaoExOfficio.filter({ id: registroId });
        if (exofficio.length > 0) return { ...exofficio[0], _modulo: 'ExOfficio' };
      } catch (_) {}

      return null;
    },
    enabled: isEditing,
  });

  const { data: tiposCustom = [] } = useQuery({
    queryKey: ['tipos-publicacao-custom'],
    queryFn: () => base44.entities.TipoPublicacaoCustom.list(),
    enabled: isAccessResolved && hasAccess,
  });

  const { data: templatesAtivos = [] } = useQuery({
    queryKey: ['templates-ativos'],
    queryFn: () => base44.entities.TemplateTexto.filter({ ativo: true }),
    enabled: isAccessResolved && hasAccess,
  });

  const { data: militarSelecionado } = useQuery({
    queryKey: ['militar-rp', formData.militar_id],
    queryFn: () => base44.entities.Militar.filter({ id: formData.militar_id }).then((r) => r[0] || null),
    enabled: !!formData.militar_id,
  });

  const { data: atestadosMilitar = [] } = useQuery({
    queryKey: ['atestados-militar-rp', formData.militar_id],
    queryFn: () => base44.entities.Atestado.filter({ militar_id: formData.militar_id }),
    enabled: !!formData.militar_id,
  });

  const { data: publicacoesMilitar = [] } = useQuery({
    queryKey: ['publicacoes-militar-rp', formData.militar_id],
    queryFn: async () => {
      const [livros, exoff] = await Promise.all([
        base44.entities.RegistroLivro.filter({ militar_id: formData.militar_id }),
        base44.entities.PublicacaoExOfficio.filter({ militar_id: formData.militar_id }),
      ]);

      return [
        ...livros.map((r) => ({ ...r, origem_tipo: 'Livro', tipo_label: r.tipo_registro })),
        ...exoff.map((r) => ({ ...r, origem_tipo: 'ExOfficio', tipo_label: r.tipo })),
      ].filter((p) => p.numero_bg && p.data_bg);
    },
    enabled: !!formData.militar_id,
  });

  const livroOperacaoFerias = useMemo(
    () => getLivroOperacaoFerias(formData.tipo_registro),
    [formData.tipo_registro]
  );

  const tiposFiltrados = useMemo(() => {
    const sexo = militarSelecionado?.sexo;
    return getTiposRPFiltrados({
      sexo,
      tiposCustom,
      templatesAtivos,
      tipoAtualEdicao: isEditing ? registroEdicao?.tipo_registro || registroEdicao?.tipo : null,
    });
  }, [militarSelecionado, tiposCustom, templatesAtivos, isEditing, registroEdicao]);

  const tiposFiltradosBusca = useMemo(
    () => tiposFiltrados.filter((t) => matchesTipoRPSearch(t, tipoSearch)),
    [tiposFiltrados, tipoSearch]
  );

  const tiposAgrupados = useMemo(
    () => groupTiposRP(tiposFiltradosBusca),
    [tiposFiltradosBusca]
  );

  const moduloAtual = useMemo(() => {
    if (!formData.tipo_registro) return null;
    return getModuloByTipo(formData.tipo_registro, tiposCustom);
  }, [formData.tipo_registro, tiposCustom]);

  const quickTypes = useMemo(() => getQuickTypes(tiposFiltrados), [tiposFiltrados]);

  const resumoCampos = useMemo(
    () => buildResumoCampos(formData, moduloAtual),
    [formData, moduloAtual]
  );

  const stepMeta = getStepMeta(currentStep);

  useEffect(() => {
    if (isEditing || !tipoInicial || selectedTipo || !tiposFiltrados.length) return;
    const tipoPreselecionado = tiposFiltrados.find((tipo) => tipo.value === tipoInicial);
    if (!tipoPreselecionado) return;
    setSelectedTipo(tipoPreselecionado);
    setFormData((prev) => ({ ...prev, tipo_registro: tipoPreselecionado.value }));
  }, [isEditing, tipoInicial, selectedTipo, tiposFiltrados]);

  useEffect(() => {
    if (!registroEdicao) return;

    const d = registroEdicao;
    const tipoVal = d.tipo_registro || d.tipo || '';

    setModuloOrigemEdicao(d._modulo || null);
    setFormData((prev) => ({
      ...prev,
      ...d,
      tipo_registro: tipoVal,
      status: d.status || d.status_publicacao || 'Aguardando Nota',
    }));

    const entries = [];
    if (d.data_inicio) entries.push(['Data Início', formatarDataExtenso(d.data_inicio)]);
    if (d.data_termino) entries.push(['Data Término', formatarDataExtenso(d.data_termino)]);
    if (d.data_retorno) entries.push(['Data Retorno', formatarDataExtenso(d.data_retorno)]);
    if (d.dias) entries.push(['Dias', String(d.dias)]);
    if (d.conjuge_nome) entries.push(['Cônjuge', d.conjuge_nome]);
    if (d.falecido_nome) entries.push(['Falecido(a)', d.falecido_nome)]);
    if (d.origem) entries.push(['Origem', d.origem]);
    if (d.destino) entries.push(['Destino', d.destino]);
    if (d.curso_nome) entries.push(['Curso', d.curso_nome]);
    if (d.missao_descricao) entries.push(['Missão', d.missao_descricao]);
    setOriginalActEntries(entries);

    if (tiposFiltrados.length) {
      const tipo = tiposFiltrados.find((t) => t.value === tipoVal);
      if (tipo) setSelectedTipo(tipo);
    }
  }, [registroEdicao, tiposFiltrados]);

  const handleChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleMilitarSelect = (data) => {
    setFormData((prev) => ({ ...prev, ...data }));
  };

  const handleFeriasSelect = (ferias) => {
    setSelectedFerias(ferias);
    if (ferias) {
      setFormData((prev) => ({ ...prev, ferias_id: ferias.id }));
      setOperacaoFeriasSelecionada(livroOperacaoFerias);
    }
  };

  const handleTipoSelect = (tipo) => {
    setSelectedTipo(tipo);
    setFormData((prev) => ({ ...prev, tipo_registro: tipo.value }));
    setTipoSearch('');
    setErrosStep((prev) => ({ ...prev, tipo: null }));
  };

  const validateCurrentStep = () => {
    if (currentStep === STEP_TIPO) {
      if (!formData.tipo_registro || !selectedTipo) {
        setErrosStep({ tipo: 'Selecione um tipo de registro para continuar.' });
        return false;
      }
      setErrosStep({});
      return true;
    }

    if (currentStep === STEP_MILITAR) {
      if (!formData.militar_id) {
        setErrosStep({ militar: 'Selecione o militar para continuar.' });
        return false;
      }
      setErrosStep({});
      return true;
    }

    if (currentStep === STEP_DADOS) {
      if (!formData.data_registro) {
        setErrosStep({ dados: 'Informe a data do registro.' });
        return false;
      }
      setErrosStep({});
      return true;
    }

    return true;
  };

  const goNext = () => {
    if (!validateCurrentStep()) return;
    setCurrentStep((prev) => Math.min(prev + 1, STEP_FINALIZACAO));
  };

  const goBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, STEP_TIPO));
  };

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const modulo = getModuloByTipo(data.tipo_registro, tiposCustom);
      const isLivro = modulo === MODULO_LIVRO;

      if (isEditing) {
        if (moduloOrigemEdicao === 'Livro') {
          return base44.entities.RegistroLivro.update(registroId, data);
        }

        return base44.entities.PublicacaoExOfficio.update(registroId, {
          ...data,
          tipo: data.tipo_registro,
        });
      }

      if (isLivro) {
        return base44.entities.RegistroLivro.create(data);
      }

      return base44.entities.PublicacaoExOfficio.create({
        ...data,
        tipo: data.tipo_registro,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['registro-rp-lista'] }),
        queryClient.invalidateQueries({ queryKey: ['registros-livro'] }),
        queryClient.invalidateQueries({ queryKey: ['publicacoes-ex-officio'] }),
        queryClient.invalidateQueries({ queryKey: ['publicacoes-militar-rp'] }),
      ]);
      navigate(createPageUrl('RP'));
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();

    if (currentStep !== STEP_FINALIZACAO) {
      goNext();
      return;
    }

    const payload = {
      ...formData,
      ...(Object.keys(camposCustom).length > 0 ? { campos_custom: camposCustom } : {}),
    };

    saveMutation.mutate(payload);
  };

  if (!loadingUser && isAccessResolved && !hasAccess) {
    return <AccessDenied modulo="RP — Registro de Publicações" />;
  }

  if (loadingUser || (isEditing && loadingRegistro)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl('RP'))}>
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <BookOpenText className="h-3.5 w-3.5" />
              RP — Registro de Publicações
            </div>
            <h1 className="text-2xl font-bold text-[#1e3a5f]">
              {isEditing ? 'Editar Registro' : 'Novo Registro'}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Fluxo guiado para reduzir cliques e erros de lançamento.
            </p>
          </div>
        </div>

        <StepHeader currentStep={currentStep} />

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#1e3a5f]/15 bg-[#1e3a5f]/5 px-3 py-1 text-xs font-medium text-[#1e3a5f]">
                  <stepMeta.icon className="h-3.5 w-3.5" />
                  Etapa {currentStep} de 4
                </div>
                <h2 className="text-lg font-semibold text-[#1e3a5f]">{stepMeta.title}</h2>
                <p className="mt-1 text-sm text-slate-500">{stepMeta.description}</p>
              </div>

              {selectedTipo ? (
                <div className={`rounded-xl border px-3 py-2 text-xs font-medium ${getTipoBadgeClasses(moduloAtual)}`}>
                  {selectedTipo.label}
                </div>
              ) : null}
            </div>

            {isEditing && moduloOrigemEdicao && (
              <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Registro em edição vinculado ao módulo{' '}
                <strong>{moduloOrigemEdicao === 'Livro' ? 'Livro' : 'Ex Officio'}</strong>.
                A origem de persistência foi travada para evitar gravação em entidade incorreta.
              </div>
            )}

            {currentStep === STEP_TIPO && (
              <div className="space-y-5">
                {!isEditing && quickTypes.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-medium text-slate-700">Atalhos operacionais</p>
                    <div className="flex flex-wrap gap-2">
                      {quickTypes.map((tipo) => (
                        <Button
                          key={tipo.value}
                          type="button"
                          variant={selectedTipo?.value === tipo.value ? 'default' : 'outline'}
                          className={selectedTipo?.value === tipo.value ? 'bg-[#1e3a5f] hover:bg-[#2d4a6f]' : ''}
                          onClick={() => handleTipoSelect(tipo)}
                        >
                          {tipo.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {selectedTipo ? (
                  <div className="flex items-center justify-between rounded-xl border border-[#1e3a5f]/20 bg-[#1e3a5f]/5 px-4 py-4">
                    <div>
                      <p className="font-semibold text-[#1e3a5f]">{selectedTipo.label}</p>
                      <p className="text-xs text-slate-500">
                        {selectedTipo.grupo} · {selectedTipo.modulo === MODULO_LIVRO ? 'Livro' : 'Ex Offício'}
                      </p>
                    </div>

                    {!isEditing && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedTipo(null);
                          setFormData((prev) => ({ ...prev, tipo_registro: '' }));
                        }}
                      >
                        Alterar
                      </Button>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <Input
                        value={tipoSearch}
                        onChange={(e) => setTipoSearch(e.target.value)}
                        placeholder="Buscar tipo de registro..."
                        className="pl-9"
                      />
                    </div>

                    <div className="max-h-[420px] overflow-y-auto space-y-4 pr-1">
                      {Object.entries(tiposAgrupados).map(([grupo, tipos]) => (
                        <div key={grupo}>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{grupo}</p>
                          <div className="grid gap-2 md:grid-cols-2">
                            {tipos.map((tipo) => (
                              <button
                                key={tipo.value}
                                type="button"
                                onClick={() => handleTipoSelect(tipo)}
                                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-medium text-slate-800 transition hover:border-[#1e3a5f]/40 hover:bg-[#1e3a5f]/5"
                              >
                                <div className="font-semibold">{tipo.label}</div>
                                <div className="mt-1 text-xs text-slate-500">
                                  {tipo.modulo === MODULO_LIVRO ? 'Livro' : 'Ex Offício'}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}

                      {tiposFiltradosBusca.length === 0 && (
                        <p className="py-6 text-center text-sm text-slate-400">Nenhum tipo encontrado.</p>
                      )}
                    </div>
                  </>
                )}

                {errosStep.tipo && (
                  <p className="text-sm font-medium text-red-600">{errosStep.tipo}</p>
                )}
              </div>
            )}

            {currentStep === STEP_MILITAR && (
              <div className="space-y-5">
                <MilitarSelector
                  value={formData.militar_id}
                  onChange={handleChange}
                  onMilitarSelect={handleMilitarSelect}
                />

                {formData.militar_id && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="mb-3 text-sm font-semibold text-slate-700">Militar selecionado</p>
                    <div className="grid gap-3 md:grid-cols-3">
                      <ResumoItem label="Nome" value={formData.militar_nome || militarSelecionado?.nome_completo || '-'} />
                      <ResumoItem label="Posto/Graduação" value={formData.militar_posto || militarSelecionado?.posto_graduacao || '-'} />
                      <ResumoItem label="Matrícula" value={formData.militar_matricula || militarSelecionado?.matricula || '-'} />
                    </div>
                  </div>
                )}

                {errosStep.militar && (
                  <p className="text-sm font-medium text-red-600">{errosStep.militar}</p>
                )}
              </div>
            )}

            {currentStep === STEP_DADOS && (
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    label="Data do Registro"
                    name="data_registro"
                    value={formData.data_registro}
                    onChange={handleChange}
                    type="date"
                    required
                  />

                  <div>
                    <Label className="text-sm font-medium text-slate-700">Status</Label>
                    <Select value={formData.status} onValueChange={(v) => handleChange('status', v)}>
                      <SelectTrigger className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {moduloAtual === MODULO_LIVRO && (
                  <RPSpecificFieldsLivro
                    tipoRegistro={formData.tipo_registro}
                    formData={formData}
                    handleChange={handleChange}
                    selectedFerias={selectedFerias}
                    handleFeriasSelect={handleFeriasSelect}
                    livroOperacaoFerias={livroOperacaoFerias}
                    operacaoFeriasSelecionada={operacaoFeriasSelecionada}
                    formatarDataExtenso={formatarDataExtenso}
                    isEditing={isEditing}
                    registroEdicao={registroEdicao}
                    originalActEntries={originalActEntries}
                  />
                )}

                {moduloAtual === MODULO_EX_OFFICIO && (
                  <RPSpecificFieldsExOfficio
                    tipoRegistro={formData.tipo_registro}
                    formData={formData}
                    handleChange={handleChange}
                    camposCustom={camposCustom}
                    setCamposCustom={setCamposCustom}
                    tiposCustom={tiposCustom}
                    atestadosMilitar={atestadosMilitar}
                    todasPublicacoesFormatadas={publicacoesMilitar}
                    publicacoesElegiveis={publicacoesMilitar}
                    formatarDataExtenso={formatarDataExtenso}
                  />
                )}

                {errosStep.dados && (
                  <p className="text-sm font-medium text-red-600">{errosStep.dados}</p>
                )}
              </div>
            )}

            {currentStep === STEP_FINALIZACAO && (
              <div className="space-y-6">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="mb-3 text-sm font-semibold text-slate-700">Resumo do lançamento</p>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <ResumoItem label="Tipo" value={selectedTipo?.label || '-'} />
                    <ResumoItem label="Módulo" value={moduloAtual === MODULO_LIVRO ? 'Livro' : 'Ex Officio'} />
                    <ResumoItem label="Militar" value={formData.militar_nome || '-'} />
                    <ResumoItem label="Matrícula" value={formData.militar_matricula || '-'} />
                  </div>

                  {resumoCampos.length > 0 && (
                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {resumoCampos.map(([label, value]) => (
                        <ResumoItem key={label} label={label} value={value} />
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 p-5">
                  <h3 className="mb-4 text-base font-semibold text-[#1e3a5f]">Publicação</h3>

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <FormField
                      label="Nota para BG"
                      name="nota_para_bg"
                      value={formData.nota_para_bg}
                      onChange={handleChange}
                      placeholder="Ex: 01"
                    />
                    <FormField
                      label="Número do BG"
                      name="numero_bg"
                      value={formData.numero_bg}
                      onChange={handleChange}
                      placeholder="Ex: 123"
                    />
                    <FormField
                      label="Data do BG"
                      name="data_bg"
                      value={formData.data_bg}
                      onChange={handleChange}
                      type="date"
                    />
                    <div>
                      <Label className="text-sm font-medium text-slate-700">Status</Label>
                      <Select value={formData.status} onValueChange={(v) => handleChange('status', v)}>
                        <SelectTrigger className="mt-1.5">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="mt-4">
                    <Label className="text-sm font-medium text-slate-700">Texto de Publicação</Label>
                    <Textarea
                      value={formData.texto_publicacao || ''}
                      onChange={(e) => handleChange('texto_publicacao', e.target.value)}
                      className="mt-1.5"
                      rows={5}
                      placeholder="Texto gerado para o BG..."
                    />
                  </div>

                  <div className="mt-4">
                    <Label className="text-sm font-medium text-slate-700">Observações</Label>
                    <Textarea
                      value={formData.observacoes || ''}
                      onChange={(e) => handleChange('observacoes', e.target.value)}
                      className="mt-1.5"
                      rows={3}
                      placeholder="Observações internas..."
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button type="button" variant="outline" onClick={() => navigate(createPageUrl('RP'))}>
              Cancelar
            </Button>

            <div className="flex gap-2">
              {currentStep > STEP_TIPO && (
                <Button type="button" variant="outline" onClick={goBack}>
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Voltar
                </Button>
              )}

              {currentStep < STEP_FINALIZACAO ? (
                <Button type="button" className="bg-[#1e3a5f] hover:bg-[#2d4a6f]" onClick={goNext}>
                  Avançar
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
                  disabled={!formData.militar_id || !formData.tipo_registro || saveMutation.isPending}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {saveMutation.isPending ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Cadastrar Registro'}
                </Button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function StepHeader({ currentStep }) {
  const steps = [
    { step: STEP_TIPO, label: 'Tipo' },
    { step: STEP_MILITAR, label: 'Militar' },
    { step: STEP_DADOS, label: 'Dados' },
    { step: STEP_FINALIZACAO, label: 'Finalização' },
  ];

  return (
    <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-4">
        {steps.map((item) => {
          const active = currentStep === item.step;
          const done = currentStep > item.step;

          return (
            <div
              key={item.step}
              className={`rounded-xl border px-4 py-3 ${
                active
                  ? 'border-[#1e3a5f] bg-[#1e3a5f]/5'
                  : done
                  ? 'border-emerald-200 bg-emerald-50'
                  : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                    active
                      ? 'bg-[#1e3a5f] text-white'
                      : done
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {done ? <CheckCircle2 className="h-4 w-4" /> : item.step}
                </div>
                <div>
                  <p className={`text-sm font-semibold ${active ? 'text-[#1e3a5f]' : 'text-slate-700'}`}>
                    {item.label}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ResumoItem({ label, value }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="truncate text-sm font-medium text-slate-700">{value || '-'}</p>
    </div>
  );
}