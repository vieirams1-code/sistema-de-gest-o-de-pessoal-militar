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
import { ArrowLeft, Save, BookOpenText, Search } from 'lucide-react';
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
import { getLivroOperacaoFeriasLabel, isTipoRegistroFerias, getLivroOperacaoFerias } from '@/components/livro/feriasOperacaoUtils';

const STATUS_OPTIONS = ['Aguardando Nota', 'Aguardando Publicação', 'Publicado'];

function formatarDataExtenso(dataStr) {
  if (!dataStr) return '';
  const d = new Date(dataStr + 'T00:00:00');
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default function CadastrarRegistroRP() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const registroId = searchParams.get('id');
  const isEditing = !!registroId;

  const { canAccessModule, isAccessResolved, isLoading: loadingUser } = useCurrentUser();
  const hasAccess = canAccessModule('livro') || canAccessModule('publicacoes');

  const [step, setStep] = useState(1);
  const [tipoSearch, setTipoSearch] = useState('');
  const [selectedTipo, setSelectedTipo] = useState(null);
  const [formData, setFormData] = useState({
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
    // Livro fields
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
    // ExOfficio fields
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
  });
  const [camposCustom, setCamposCustom] = useState({});
  const [selectedFerias, setSelectedFerias] = useState(null);
  const [operacaoFeriasSelecionada, setOperacaoFeriasSelecionada] = useState(null);
  const [originalActEntries, setOriginalActEntries] = useState([]);
  const [moduloOrigemEdicao, setModuloOrigemEdicao] = useState(null);

  // Fetch existing record when editing
  const { data: registroEdicao, isLoading: loadingRegistro } = useQuery({
    queryKey: ['registro-rp-edicao', registroId],
    queryFn: async () => {
      // Try RegistroLivro first, then PublicacaoExOfficio
      try {
        const livros = await base44.entities.RegistroLivro.filter({ id: registroId });
        if (livros.length > 0) return { ...livros[0], _modulo: 'Livro' };
      } catch (_) {}
      try {
        const exoffiicio = await base44.entities.PublicacaoExOfficio.filter({ id: registroId });
        if (exoffiicio.length > 0) return { ...exoffiicio[0], _modulo: 'ExOfficio' };
      } catch (_) {}
      return null;
    },
    enabled: isEditing,
  });

  // Fetch tiposCustom
  const { data: tiposCustom = [] } = useQuery({
    queryKey: ['tipos-publicacao-custom'],
    queryFn: () => base44.entities.TipoPublicacaoCustom.list(),
  });

  // Fetch templates ativos
  const { data: templatesAtivos = [] } = useQuery({
    queryKey: ['templates-ativos'],
    queryFn: () => base44.entities.TemplateTexto.filter({ ativo: true }),
  });

  // Fetch militar data when selected
  const { data: militarSelecionado } = useQuery({
    queryKey: ['militar-rp', formData.militar_id],
    queryFn: () => base44.entities.Militar.filter({ id: formData.militar_id }).then(r => r[0] || null),
    enabled: !!formData.militar_id,
  });

  // Fetch atestados do militar (for ExOfficio)
  const { data: atestadosMilitar = [] } = useQuery({
    queryKey: ['atestados-militar-rp', formData.militar_id],
    queryFn: () => base44.entities.Atestado.filter({ militar_id: formData.militar_id }),
    enabled: !!formData.militar_id,
  });

  // Fetch publicacoes do militar (for Apostila/Tornar sem Efeito)
  const { data: publicacoesMilitar = [] } = useQuery({
    queryKey: ['publicacoes-militar-rp', formData.militar_id],
    queryFn: async () => {
      const [livros, exoff] = await Promise.all([
        base44.entities.RegistroLivro.filter({ militar_id: formData.militar_id }),
        base44.entities.PublicacaoExOfficio.filter({ militar_id: formData.militar_id }),
      ]);
      return [
        ...livros.map(r => ({ ...r, origem_tipo: 'Livro', tipo_label: r.tipo_registro })),
        ...exoff.map(r => ({ ...r, origem_tipo: 'ExOfficio', tipo_label: r.tipo })),
      ].filter(p => p.numero_bg && p.data_bg);
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

  const tiposFiltradosBusca = useMemo(() => {
    return tiposFiltrados.filter(t => matchesTipoRPSearch(t, tipoSearch));
  }, [tiposFiltrados, tipoSearch]);

  const tiposAgrupados = useMemo(() => groupTiposRP(tiposFiltradosBusca), [tiposFiltradosBusca]);

  useEffect(() => {
    const tipoParam = searchParams.get('tipo');

    if (!tipoParam || isEditing || selectedTipo || formData.tipo_registro || step !== 1 || tiposFiltrados.length === 0) {
      return;
    }

    const normalizarTexto = (valor = '') =>
      valor
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');

    const tipoEncontrado = tiposFiltrados.find(tipo => {
      if (tipo.value === tipoParam) return true;
      return normalizarTexto(tipo.label) === normalizarTexto(tipoParam);
    });

    if (!tipoEncontrado) return;

    setSelectedTipo(tipoEncontrado);
    setFormData(prev => ({ ...prev, tipo_registro: tipoEncontrado.value }));
    setStep(2);
  }, [searchParams, isEditing, selectedTipo, formData.tipo_registro, step, tiposFiltrados]);

  const moduloAtual = useMemo(() => {
    if (!formData.tipo_registro) return null;
    return getModuloByTipo(formData.tipo_registro, tiposCustom);
  }, [formData.tipo_registro, tiposCustom]);

  // Populate form when editing
  useEffect(() => {
    if (!registroEdicao) return;
    setModuloOrigemEdicao(registroEdicao._modulo === 'Livro' ? 'Livro' : 'ExOfficio');
    const d = registroEdicao;
    const tipoVal = d.tipo_registro || d.tipo || '';
    setFormData(prev => ({
      ...prev,
      ...d,
      tipo_registro: tipoVal,
      status: d.status || d.status_publicacao || 'Aguardando Nota',
    }));
    const tipo = tiposFiltrados.find(t => t.value === tipoVal);
    if (tipo) setSelectedTipo(tipo);

    // Build original act entries for livro display
    const entries = [];
    if (d.data_inicio) entries.push(['Data Início', formatarDataExtenso(d.data_inicio)]);
    if (d.data_termino) entries.push(['Data Término', formatarDataExtenso(d.data_termino)]);
    if (d.data_retorno) entries.push(['Data Retorno', formatarDataExtenso(d.data_retorno)]);
    if (d.dias) entries.push(['Dias', String(d.dias)]);
    if (d.conjuge_nome) entries.push(['Cônjuge', d.conjuge_nome]);
    if (d.falecido_nome) entries.push(['Falecido(a)', d.falecido_nome]);
    if (d.origem) entries.push(['Origem', d.origem]);
    if (d.destino) entries.push(['Destino', d.destino]);
    if (d.curso_nome) entries.push(['Curso', d.curso_nome]);
    if (d.missao_descricao) entries.push(['Missão', d.missao_descricao]);
    setOriginalActEntries(entries);
  }, [registroEdicao]);

  const handleChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleMilitarSelect = (data) => {
    setFormData(prev => ({ ...prev, ...data }));
  };

  const handleFeriasSelect = (ferias) => {
    setSelectedFerias(ferias);
    if (ferias) {
      setFormData(prev => ({ ...prev, ferias_id: ferias.id }));
      setOperacaoFeriasSelecionada(livroOperacaoFerias);
    }
  };

  const handleTipoSelect = (tipo) => {
    setSelectedTipo(tipo);
    setFormData(prev => ({ ...prev, tipo_registro: tipo.value }));
    setTipoSearch('');
  };

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const modulo = getModuloByTipo(data.tipo_registro, tiposCustom);
      const isLivro = modulo === MODULO_LIVRO;

      const payloadLivro = {
        ...data,
        origem: data.origem || 'Manual',
      };

      const { tipo_registro, ...exOfficioBase } = data;
      const payloadExOfficio = {
        ...exOfficioBase,
        tipo: tipo_registro || data.tipo || '',
        data_publicacao: exOfficioBase.data_publicacao || data.data_registro || '',
        status: exOfficioBase.status || 'Aguardando Nota',
      };

      if (isEditing) {
        if (moduloOrigemEdicao === 'Livro') {
          return base44.entities.RegistroLivro.update(registroId, payloadLivro);
        }

        return base44.entities.PublicacaoExOfficio.update(registroId, payloadExOfficio);
      }

      if (isLivro) {
        return base44.entities.RegistroLivro.create(payloadLivro);
      }

      return base44.entities.PublicacaoExOfficio.create(payloadExOfficio);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registro-rp-lista'] });
      queryClient.invalidateQueries({ queryKey: ['registros-livro'] });
      queryClient.invalidateQueries({ queryKey: ['publicacoes-ex-officio'] });
      navigate(createPageUrl('RP'));
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (step !== 4) return;

    const payload = {
      ...formData,
      ...(Object.keys(camposCustom).length > 0 ? { campos_custom: camposCustom } : {}),
    };
    saveMutation.mutate(payload);
  };

  const canAdvanceFromStep1 = !!formData.tipo_registro;
  const canAdvanceFromStep2 = !!formData.militar_id;
  const canAdvanceFromStep3 = !!formData.data_registro;

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
      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl('RP'))}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <BookOpenText className="h-3.5 w-3.5" /> RP — Registro de Publicações
            </div>
            <h1 className="text-2xl font-bold text-[#1e3a5f]">
              {isEditing ? 'Editar Registro' : 'Novo Registro'}
            </h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {[
                { id: 1, label: 'Tipo' },
                { id: 2, label: 'Militar' },
                { id: 3, label: 'Registro' },
                { id: 4, label: 'Finalização' },
              ].map(item => {
                const isActive = step === item.id;
                const isDone = step > item.id;

                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-2 rounded-full px-3 py-1.5 ${
                      isActive
                        ? 'bg-[#1e3a5f] text-white'
                        : isDone
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/80 text-xs font-bold text-inherit">
                      {item.id}
                    </span>
                    <span className="font-medium">{item.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {step === 1 && (
            <>
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:p-7">
                <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-[#1e3a5f]">Tipo de Registro</h2>
                    <p className="text-sm text-slate-500">
                      Selecione o tipo para continuar o cadastro. Use a busca para localizar rapidamente o registro desejado.
                    </p>
                  </div>
                  {!selectedTipo && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                      {tiposFiltradosBusca.length} tipo{tiposFiltradosBusca.length !== 1 ? 's' : ''} disponível{tiposFiltradosBusca.length !== 1 ? 'eis' : ''}
                    </div>
                  )}
                </div>

                {selectedTipo ? (
                  <div className="flex flex-col gap-3 rounded-xl border border-[#1e3a5f]/20 bg-[#1e3a5f]/5 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-[#1e3a5f]">{selectedTipo.label}</p>
                      <p className="text-xs text-slate-500">{selectedTipo.grupo} · {selectedTipo.modulo === MODULO_LIVRO ? 'Livro' : 'Ex Offício'}</p>
                    </div>
                    {!isEditing && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="self-start sm:self-auto"
                        onClick={() => {
                          setSelectedTipo(null);
                          setFormData(prev => ({ ...prev, tipo_registro: '' }));
                        }}
                      >
                        Alterar
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70">
                    <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur sm:px-5">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                          value={tipoSearch}
                          onChange={e => setTipoSearch(e.target.value)}
                          placeholder="Buscar tipo de registro..."
                          className="h-11 border-slate-300 bg-white pl-9"
                        />
                      </div>
                    </div>

                    <div className="max-h-[32rem] overflow-y-auto px-4 py-4 sm:px-5">
                      <div className="space-y-5">
                        {Object.entries(tiposAgrupados).map(([grupo, tipos]) => (
                          <section key={grupo} className="space-y-3">
                            <div className="flex items-center gap-3">
                              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{grupo}</p>
                              <div className="h-px flex-1 bg-slate-200" />
                              <span className="rounded-full bg-white px-2 py-1 text-[11px] font-medium text-slate-500">
                                {tipos.length}
                              </span>
                            </div>
                            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                              {tipos.map(tipo => (
                                <button
                                  key={tipo.value}
                                  type="button"
                                  onClick={() => handleTipoSelect(tipo)}
                                  className="group rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-[#1e3a5f]/40 hover:bg-[#1e3a5f]/5 hover:shadow-sm"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <span className="text-sm font-semibold text-slate-800">{tipo.label}</span>
                                    <span className="whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 group-hover:bg-white">
                                      {tipo.modulo === MODULO_LIVRO ? 'Livro' : 'Ex Offício'}
                                    </span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </section>
                        ))}
                        {tiposFiltradosBusca.length === 0 && (
                          <p className="py-8 text-center text-sm text-slate-400">Nenhum tipo encontrado.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => navigate(createPageUrl('RP'))}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
                  disabled={!canAdvanceFromStep1}
                  onClick={() => setStep(2)}
                >
                  Avançar
                </Button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-base font-semibold text-[#1e3a5f]">Militar</h2>
                <MilitarSelector
                  value={formData.militar_id}
                  onChange={handleChange}
                  onMilitarSelect={handleMilitarSelect}
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setStep(1)}>
                  Voltar
                </Button>
                <Button
                  type="button"
                  className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
                  disabled={!canAdvanceFromStep2}
                  onClick={() => setStep(3)}
                >
                  Avançar
                </Button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              {selectedTipo && moduloAtual === MODULO_LIVRO && (
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

              {selectedTipo && moduloAtual === MODULO_EX_OFFICIO && (
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

              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-base font-semibold text-[#1e3a5f]">Dados do Registro</h2>
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
                    <Select value={formData.status} onValueChange={v => handleChange('status', v)}>
                      <SelectTrigger className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setStep(2)}>
                  Voltar
                </Button>
                <Button
                  type="button"
                  className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
                  disabled={!canAdvanceFromStep3}
                  onClick={() => setStep(4)}
                >
                  Avançar
                </Button>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-base font-semibold text-[#1e3a5f]">Finalização</h2>
                <div className="grid gap-4 sm:grid-cols-2">
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
                </div>
                <div className="mt-4">
                  <Label className="text-sm font-medium text-slate-700">Texto de Publicação</Label>
                  <Textarea
                    value={formData.texto_publicacao || ''}
                    onChange={e => handleChange('texto_publicacao', e.target.value)}
                    className="mt-1.5"
                    rows={4}
                    placeholder="Texto gerado para o BG..."
                  />
                </div>
                <div className="mt-4">
                  <Label className="text-sm font-medium text-slate-700">Observações</Label>
                  <Textarea
                    value={formData.observacoes || ''}
                    onChange={e => handleChange('observacoes', e.target.value)}
                    className="mt-1.5"
                    rows={2}
                    placeholder="Observações internas..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setStep(3)}>
                  Voltar
                </Button>
                <Button
                  type="submit"
                  className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
                  disabled={saveMutation.isPending}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {saveMutation.isPending ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Salvar'}
                </Button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}