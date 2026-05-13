import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { keepPreviousData, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import { useUsuarioPodeAgirSobreMilitar } from '@/hooks/useUsuarioPodeAgirSobreMilitar';
import { criarEscopado, atualizarEscopado } from '@/services/cudEscopadoClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { getLivroOperacaoFerias } from '@/components/livro/feriasOperacaoUtils';
import {
  getConflitoTemplatePorTipo,
  getTemplateAtivoPorTipo,
  tipoExigeTemplate,
} from '@/components/rp/templateValidation';
import { aplicarTemplate, abreviarPosto, formatDateBR } from '@/components/utils/templateUtils';
import {
  anexarEventoAuditoriaPublicacao,
  calcularStatusPublicacaoRegistro,
  criarEventoAuditoriaPublicacao,
  EVENTO_AUDITORIA_PUBLICACAO,
  extrairSnapshotPublicacao,
  normalizarStatusPublicacao,
  validarPayloadPublicacao,
} from '@/components/publicacao/publicacaoStateMachine';


function mapearEntityPublicacaoPorModulo(modulo) {
  return modulo === MODULO_LIVRO ? base44.entities.RegistroLivro : base44.entities.PublicacaoExOfficio;
}

function nomeEntidadePorModulo(modulo) {
  return modulo === MODULO_LIVRO ? 'RegistroLivro' : 'PublicacaoExOfficio';
}

function montarResumoEdicaoCamposPublicacao(antes = {}, depois = {}) {
  const campos = ['nota_para_bg', 'numero_bg', 'data_bg'];
  const alterados = campos.filter((campo) => String(antes[campo] || '') !== String(depois[campo] || ''));
  if (!alterados.length) return 'Edição de publicação sem alteração de campos de BG.';
  return `Edição de publicação com alteração em: ${alterados.join(', ')}.`;
}

const TEMPLATE_CONFLITO_MENSAGEM =
  'Conflito de template detectado para este tipo. Verifique os templates cadastrados.';

function formatarDataExtenso(dataStr) {
  if (!dataStr) return '';
  const d = new Date(dataStr + 'T00:00:00');
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function montarVariaveisTemplateRP({ formData = {}, militar = {}, user = {} } = {}) {
  const postoBase = formData.militar_posto || militar?.posto_graduacao || militar?.posto || '';
  const postoAbreviado = abreviarPosto(postoBase);
  const dataRegistro = formData.data_registro || formData.data_publicacao || '';

  const variaveis = {
    ...formData,
    militar_nome: formData.militar_nome || militar?.nome_completo || '',
    nome_completo: formData.militar_nome || militar?.nome_completo || '',
    militar_matricula: formData.militar_matricula || militar?.matricula || '',
    matricula: formData.militar_matricula || militar?.matricula || '',
    militar_posto: postoBase,
    posto: postoAbreviado,
    posto_nome: postoAbreviado ? `${postoAbreviado} QOBM` : '',
    posto_graduacao: postoBase,
    data_registro: formatDateBR(dataRegistro),
    data_publicacao: formatDateBR(dataRegistro),
    data_bg: formatDateBR(formData.data_bg),
    data_inicio: formatDateBR(formData.data_inicio),
    data_termino: formatDateBR(formData.data_termino),
    data_retorno: formatDateBR(formData.data_retorno),
    data_portaria: formatDateBR(formData.data_portaria),
    data_punicao: formatDateBR(formData.data_punicao),
    data_designacao: formatDateBR(formData.data_designacao),
    data_ata: formatDateBR(formData.data_ata),
    data_melhoria: formatDateBR(formData.data_melhoria),
    data_documento: formatDateBR(formData.data_documento),
    data_fato: formatDateBR(formData.data_fato),
    data_cedencia: formatDateBR(formData.data_cedencia),
    data_transferencia: formatDateBR(formData.data_transferencia),
    grupamento_id: militar?.grupamento_id || formData.grupamento_id || user?.grupamento_id || '',
    subgrupamento_id: militar?.subgrupamento_id || formData.subgrupamento_id || user?.subgrupamento_id || '',
    subgrupamento_tipo: militar?.subgrupamento_tipo || formData.subgrupamento_tipo || user?.subgrupamento_tipo || '',
    unidade_id: militar?.unidade_id || formData.unidade_id || '',
    usuario_nome: user?.full_name || user?.name || '',
    usuario_email: user?.email || '',
  };

  return variaveis;
}

export default function CadastrarRegistroRP() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const registroId = searchParams.get('id');
  const isEditing = !!registroId;

  const {
    canAccessModule,
    canAccessAction,
    isAccessResolved,
    isLoading: loadingUser,
    user,
    isAdmin,
    modoAcesso,
    resolvedAccessContext,
  } = useCurrentUser();
  const { validar: validarEscopoMilitar } = useUsuarioPodeAgirSobreMilitar();
  const hasAccess = canAccessModule('rp');
  const canGerirPublicacoes = canAccessAction('editar_publicacoes') || canAccessAction('admin_mode');
  const canPublicarBg = canAccessAction('publicar_bg') || canAccessAction('admin_mode');

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
  const [textoEditadoManualmente, setTextoEditadoManualmente] = useState(false);
  const isSubmittingRef = useRef(false);

  const militarIdSelecionado = String(formData.militar_id || '').trim();
  const tipoRegistroSelecionado = String(formData.tipo_registro || '').trim();
  const escopoQueryKey = useMemo(() => ({
    isAdmin: isAdmin === true,
    modoAcesso: modoAcesso || 'indefinido',
    effectiveEmail: resolvedAccessContext?.effectiveEmail || user?.email || 'self',
  }), [isAdmin, modoAcesso, resolvedAccessContext?.effectiveEmail, user?.email]);
  const canRunScopedQueries = Boolean(isAccessResolved && hasAccess && canGerirPublicacoes);

  // Fetch existing record when editing
  const {
    data: registroEdicao,
    isLoading: loadingRegistro,
    isFetching: fetchingRegistro,
    isError: erroRegistroEdicao,
  } = useQuery({
    queryKey: ['registro-rp-edicao', registroId || null, escopoQueryKey],
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
    enabled: Boolean(isEditing && registroId && canRunScopedQueries),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });

  // Fetch tiposCustom
  const {
    data: tiposCustom = [],
    isLoading: loadingTiposCustom,
    isFetching: fetchingTiposCustom,
    isError: erroTiposCustom,
  } = useQuery({
    queryKey: ['tipos-publicacao-custom', escopoQueryKey],
    queryFn: () => base44.entities.TipoPublicacaoCustom.list(),
    enabled: canRunScopedQueries,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Fetch templates ativos
  const {
    data: templatesAtivos = [],
    isLoading: loadingTemplatesAtivos,
    isFetching: fetchingTemplatesAtivos,
    isError: erroTemplatesAtivos,
  } = useQuery({
    queryKey: ['templates-ativos', tipoRegistroSelecionado || null, escopoQueryKey],
    queryFn: () => base44.entities.TemplateTexto.filter({ ativo: true }),
    enabled: canRunScopedQueries,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const moduloAtual = useMemo(() => {
    if (!tipoRegistroSelecionado) return null;
    return getModuloByTipo(tipoRegistroSelecionado, tiposCustom);
  }, [tipoRegistroSelecionado, tiposCustom]);

  const livroOperacaoFerias = useMemo(
    () => getLivroOperacaoFerias(formData.tipo_registro),
    [formData.tipo_registro]
  );

  const deveCarregarMilitar = Boolean(
    canRunScopedQueries && militarIdSelecionado && (isEditing || step >= 2)
  );
  const deveCarregarAtestados = Boolean(
    deveCarregarMilitar
      && moduloAtual === MODULO_EX_OFFICIO
      && ['Ata JISO', 'Homologação de Atestado'].includes(tipoRegistroSelecionado)
      && step >= 3
  );
  const deveCarregarPublicacoes = Boolean(
    deveCarregarMilitar
      && moduloAtual === MODULO_EX_OFFICIO
      && ['Apostila', 'Tornar sem Efeito'].includes(tipoRegistroSelecionado)
      && step >= 3
  );

  // Fetch militar data when selected
  const {
    data: militarSelecionado,
    isLoading: loadingMilitarSelecionado,
    isFetching: fetchingMilitarSelecionado,
    isSuccess: militarSelecionadoCarregado,
    isError: erroMilitarSelecionado,
  } = useQuery({
    queryKey: ['militar-rp', militarIdSelecionado || null, tipoRegistroSelecionado || null, isEditing ? 'edicao' : 'criacao', escopoQueryKey],
    queryFn: () => base44.entities.Militar.filter({ id: militarIdSelecionado }).then(r => r[0] || null),
    enabled: deveCarregarMilitar,
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Fetch atestados do militar (for ExOfficio)
  const {
    data: atestadosMilitar = [],
    isLoading: loadingAtestadosMilitar,
    isFetching: fetchingAtestadosMilitar,
    isSuccess: atestadosMilitarCarregados,
    isError: erroAtestadosMilitar,
  } = useQuery({
    queryKey: ['atestados-militar-rp', militarIdSelecionado || null, tipoRegistroSelecionado || null, moduloAtual || null, isEditing ? 'edicao' : 'criacao', escopoQueryKey],
    queryFn: () => base44.entities.Atestado.filter({ militar_id: militarIdSelecionado }),
    enabled: deveCarregarAtestados,
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Fetch publicacoes do militar (for Apostila/Tornar sem Efeito)
  const {
    data: publicacoesMilitar = [],
    isLoading: loadingPublicacoesMilitar,
    isFetching: fetchingPublicacoesMilitar,
    isSuccess: publicacoesMilitarCarregadas,
    isError: erroPublicacoesMilitar,
  } = useQuery({
    queryKey: ['publicacoes-militar-rp', militarIdSelecionado || null, tipoRegistroSelecionado || null, moduloAtual || null, isEditing ? 'edicao' : 'criacao', escopoQueryKey],
    queryFn: async () => {
      const [livros, exoff] = await Promise.all([
        base44.entities.RegistroLivro.filter({ militar_id: militarIdSelecionado }),
        base44.entities.PublicacaoExOfficio.filter({ militar_id: militarIdSelecionado }),
      ]);
      return [
        ...livros.map(r => ({ ...r, origem_tipo: 'Livro', tipo_label: r.tipo_registro })),
        ...exoff.map(r => ({ ...r, origem_tipo: 'ExOfficio', tipo_label: r.tipo })),
      ].filter(p => p.numero_bg && p.data_bg);
    },
    enabled: deveCarregarPublicacoes,
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const carregandoMilitar = loadingMilitarSelecionado || fetchingMilitarSelecionado;
  const carregandoFerias = Boolean(
    selectedTipo && moduloAtual === MODULO_LIVRO && livroOperacaoFerias && militarIdSelecionado
  );
  const carregandoAtestados = loadingAtestadosMilitar || fetchingAtestadosMilitar;
  const carregandoPublicacoes = loadingPublicacoesMilitar || fetchingPublicacoesMilitar;
  const erroParcialCarregamento = Boolean(
    erroRegistroEdicao
      || erroTiposCustom
      || erroTemplatesAtivos
      || erroMilitarSelecionado
      || erroAtestadosMilitar
      || erroPublicacoesMilitar
  );
  const militarAusente = Boolean(deveCarregarMilitar && militarSelecionadoCarregado && !fetchingMilitarSelecionado && !militarSelecionado);
  const atestadosAusentes = Boolean(deveCarregarAtestados && atestadosMilitarCarregados && !fetchingAtestadosMilitar && atestadosMilitar.length === 0);
  const publicacoesAusentes = Boolean(deveCarregarPublicacoes && publicacoesMilitarCarregadas && !fetchingPublicacoesMilitar && publicacoesMilitar.length === 0);

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
  }, [searchParams, isEditing, selectedTipo, formData.tipo_registro, step, tiposFiltrados]);

  const contextoTemplate = useMemo(() => ({
    grupamento_id:
      militarSelecionado?.grupamento_id ||
      formData.grupamento_id ||
      user?.grupamento_id ||
      '',
    subgrupamento_id:
      militarSelecionado?.subgrupamento_id ||
      formData.subgrupamento_id ||
      user?.subgrupamento_id ||
      '',
    subgrupamento_tipo:
      militarSelecionado?.subgrupamento_tipo ||
      formData.subgrupamento_tipo ||
      user?.subgrupamento_tipo ||
      '',
    unidade_id:
      militarSelecionado?.unidade_id ||
      formData.unidade_id ||
      '',
    setor_id:
      militarSelecionado?.grupamento_id ||
      formData.grupamento_id ||
      user?.grupamento_id ||
      '',
    subsetor_id:
      militarSelecionado?.subgrupamento_id ||
      formData.subgrupamento_id ||
      user?.subgrupamento_id ||
      '',
    tipo_subgrupamento:
      militarSelecionado?.subgrupamento_tipo ||
      formData.subgrupamento_tipo ||
      user?.subgrupamento_tipo ||
      '',
    user_email: user?.email || '',
  }), [
    militarSelecionado?.grupamento_id,
    militarSelecionado?.subgrupamento_id,
    militarSelecionado?.subgrupamento_tipo,
    militarSelecionado?.unidade_id,
    formData.grupamento_id,
    formData.subgrupamento_id,
    formData.subgrupamento_tipo,
    formData.unidade_id,
    user?.grupamento_id,
    user?.subgrupamento_id,
    user?.subgrupamento_tipo,
    user?.email,
  ]);

  const templateAtivoSelecionado = useMemo(() => {
    if (!formData.tipo_registro || !moduloAtual) return null;
    return getTemplateAtivoPorTipo(formData.tipo_registro, moduloAtual, templatesAtivos, contextoTemplate);
  }, [formData.tipo_registro, moduloAtual, templatesAtivos, contextoTemplate]);

  const templateObrigatorioAusente = useMemo(() => {
    if (!formData.tipo_registro) return false;
    return tipoExigeTemplate(formData.tipo_registro) && !templateAtivoSelecionado;
  }, [formData.tipo_registro, templateAtivoSelecionado]);

  const conflitoTemplateSelecionado = useMemo(() => {
    if (!formData.tipo_registro) {
      return { temConflito: false, modulos: [] };
    }

    return getConflitoTemplatePorTipo(formData.tipo_registro, templatesAtivos);
  }, [formData.tipo_registro, templatesAtivos]);

  const hasTemplateConflict = conflitoTemplateSelecionado.temConflito;
  const statusCalculadoFormulario = useMemo(
    () => calcularStatusPublicacaoRegistro(formData),
    [formData.nota_para_bg, formData.numero_bg, formData.data_bg]
  );
  const isRegistroLegadoImportado = Boolean(
    registroEdicao?.importado_legado || String(registroEdicao?.origem_registro || '').toLowerCase() === 'legado'
  );
  const permitirAjusteTipoLegadoPublicado = isEditing && isRegistroLegadoImportado && moduloOrigemEdicao === 'ExOfficio';

  useEffect(() => {
    setFormData((prev) => {
      if (prev.status === statusCalculadoFormulario) return prev;
      return { ...prev, status: statusCalculadoFormulario };
    });
  }, [statusCalculadoFormulario]);

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
      status: calcularStatusPublicacaoRegistro(d),
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

  useEffect(() => {
    setTextoEditadoManualmente(false);
  }, [formData.tipo_registro, formData.militar_id, templateAtivoSelecionado?.id]);

  useEffect(() => {
    if (!selectedFerias || !militarIdSelecionado) return;
    if (String(selectedFerias.militar_id || '') !== militarIdSelecionado) {
      setSelectedFerias(null);
      setOperacaoFeriasSelecionada(null);
      setFormData(prev => (prev.ferias_id ? { ...prev, ferias_id: '' } : prev));
    }
  }, [militarIdSelecionado, selectedFerias]);

  useEffect(() => {
    if (!deveCarregarPublicacoes || !publicacoesMilitarCarregadas || fetchingPublicacoesMilitar) return;
    const publicacaoId = formData.publicacao_referencia_id;
    if (!publicacaoId) return;
    const publicacaoExiste = publicacoesMilitar.some(p => p.id === publicacaoId);
    if (publicacaoExiste) return;
    setFormData(prev => ({
      ...prev,
      publicacao_referencia_id: '',
      publicacao_referencia_origem_tipo: '',
      publicacao_referencia_tipo_label: '',
      publicacao_referencia_numero_bg: '',
      publicacao_referencia_data_bg: '',
      publicacao_referencia_nota: '',
    }));
  }, [
    deveCarregarPublicacoes,
    fetchingPublicacoesMilitar,
    formData.publicacao_referencia_id,
    publicacoesMilitar,
    publicacoesMilitarCarregadas,
  ]);

  useEffect(() => {
    if (!deveCarregarAtestados || !atestadosMilitarCarregados || fetchingAtestadosMilitar) return;
    const idsElegiveis = new Set(atestadosMilitar.map(a => a.id));

    setFormData(prev => {
      let next = prev;
      if (prev.atestado_homologado_id && !idsElegiveis.has(prev.atestado_homologado_id)) {
        next = { ...next, atestado_homologado_id: '' };
      }
      if (Array.isArray(prev.atestados_jiso_ids) && prev.atestados_jiso_ids.some(id => !idsElegiveis.has(id))) {
        next = { ...next, atestados_jiso_ids: prev.atestados_jiso_ids.filter(id => idsElegiveis.has(id)) };
      }
      return next;
    });
  }, [
    atestadosMilitar,
    atestadosMilitarCarregados,
    deveCarregarAtestados,
    fetchingAtestadosMilitar,
  ]);

  useEffect(() => {
    if (!templateAtivoSelecionado?.template) return;
    if (!formData.tipo_registro || !moduloAtual) return;

    if (textoEditadoManualmente && formData.texto_publicacao) return;

    const textoGerado = aplicarTemplate(
      templateAtivoSelecionado.template,
      montarVariaveisTemplateRP({
        formData,
        militar: militarSelecionado,
        user,
      }),
    );

    setFormData((prev) => {
      if (prev.texto_publicacao === textoGerado) return prev;
      return { ...prev, texto_publicacao: textoGerado };
    });
  }, [
    templateAtivoSelecionado?.id,
    templateAtivoSelecionado?.template,
    formData,
    formData.tipo_registro,
    moduloAtual,
    militarSelecionado,
    textoEditadoManualmente,
    user,
  ]);

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
        const moduloPersistencia = moduloOrigemEdicao === 'Livro' ? MODULO_LIVRO : MODULO_EX_OFFICIO;
        const entityName = nomeEntidadePorModulo(moduloPersistencia);
        const registroAtual = registroEdicao || {};
        const payloadAtualizacaoBase = moduloPersistencia === MODULO_LIVRO ? payloadLivro : payloadExOfficio;
        const registroDestino = { ...registroAtual, ...payloadAtualizacaoBase };
        const statusAntes = normalizarStatusPublicacao(registroAtual.status_calculado || registroAtual.status_publicacao || registroAtual.status) || calcularStatusPublicacaoRegistro(registroAtual);
        const statusDepois = normalizarStatusPublicacao(registroDestino.status_calculado || registroDestino.status_publicacao || registroDestino.status) || calcularStatusPublicacaoRegistro(registroDestino);
        const houveMudancaStatus = statusAntes !== statusDepois;

        const eventoEdicao = criarEventoAuditoriaPublicacao({
          registro: {
            ...registroAtual,
            id: registroId,
            origem_tipo: moduloPersistencia === MODULO_LIVRO ? 'livro' : 'ex-officio',
          },
          evento: houveMudancaStatus ? EVENTO_AUDITORIA_PUBLICACAO.MUDANCA_STATUS : EVENTO_AUDITORIA_PUBLICACAO.EDICAO,
          usuario: user,
          resumo: houveMudancaStatus
            ? `Mudança de status na edição: ${statusAntes} → ${statusDepois}.`
            : montarResumoEdicaoCamposPublicacao(registroAtual, registroDestino),
          estadoAnterior: statusAntes,
          estadoNovo: statusDepois,
          antes: extrairSnapshotPublicacao(registroAtual),
          depois: extrairSnapshotPublicacao(registroDestino),
        });

        return atualizarEscopado(entityName, registroId, {
          ...payloadAtualizacaoBase,
          historico_publicacao: anexarEventoAuditoriaPublicacao(registroAtual, eventoEdicao),
        });
      }

      if (isLivro) {
        const criado = await criarEscopado('RegistroLivro', payloadLivro);
        const eventoCriacao = criarEventoAuditoriaPublicacao({
          registro: { ...criado, origem_tipo: 'livro' },
          evento: EVENTO_AUDITORIA_PUBLICACAO.CRIACAO,
          usuario: user,
          resumo: 'Criação de publicação no módulo Livro.',
          estadoAnterior: null,
          estadoNovo: normalizarStatusPublicacao(criado.status_calculado || criado.status_publicacao || criado.status) || calcularStatusPublicacaoRegistro(criado),
          antes: null,
          depois: extrairSnapshotPublicacao(criado),
        });
        await atualizarEscopado('RegistroLivro', criado.id, {
          historico_publicacao: anexarEventoAuditoriaPublicacao(criado, eventoCriacao),
        });
        return criado;
      }

      const criado = await criarEscopado('PublicacaoExOfficio', payloadExOfficio);
      const eventoCriacao = criarEventoAuditoriaPublicacao({
        registro: { ...criado, origem_tipo: 'ex-officio' },
        evento: EVENTO_AUDITORIA_PUBLICACAO.CRIACAO,
        usuario: user,
        resumo: 'Criação de publicação no módulo Ex Officio.',
        estadoAnterior: null,
        estadoNovo: normalizarStatusPublicacao(criado.status_calculado || criado.status_publicacao || criado.status) || calcularStatusPublicacaoRegistro(criado),
        antes: null,
        depois: extrairSnapshotPublicacao(criado),
      });
      await atualizarEscopado('PublicacaoExOfficio', criado.id, {
        historico_publicacao: anexarEventoAuditoriaPublicacao(criado, eventoCriacao),
      });
      return criado;
    },
    onSuccess: async (resultado, payload) => {
      queryClient.invalidateQueries({ queryKey: ['registro-rp-lista'] });
      queryClient.invalidateQueries({ queryKey: ['registros-livro'] });
      queryClient.invalidateQueries({ queryKey: ['publicacoes-ex-officio'] });
      queryClient.invalidateQueries({ queryKey: ['militares'] });
      queryClient.invalidateQueries({ queryKey: ['punicoes-disciplinares'] });
      navigate(createPageUrl('RP'));
    },
    onSettled: () => {
      isSubmittingRef.current = false;
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (step !== 4) return;
    if (isSubmittingRef.current || saveMutation.isPending) return;

    const moduloValidacao = getModuloByTipo(formData.tipo_registro, tiposCustom);
    const templateAtivoNoSubmit = getTemplateAtivoPorTipo(
      formData.tipo_registro,
      moduloValidacao,
      templatesAtivos,
      contextoTemplate,
    );
    const templateObrigatorioAusenteNoSubmit =
      tipoExigeTemplate(formData.tipo_registro) && !templateAtivoNoSubmit;

    const conflitoTemplateNoSubmit = getConflitoTemplatePorTipo(formData.tipo_registro, templatesAtivos);

    if (templateObrigatorioAusenteNoSubmit) return;
    if (conflitoTemplateNoSubmit.temConflito) return;
    if (!canGerirPublicacoes) {
      alert('Ação negada: você não tem permissão para criar/editar publicações.');
      return;
    }

    // Lote Trava Emergencial — escopo de escrita
    const militarAlvoId = registroEdicao?.militar_id || formData.militar_id;
    const escopo = validarEscopoMilitar(militarAlvoId);
    if (!escopo.permitido) {
      alert(escopo.motivo);
      return;
    }

    const informouBg =
      String(formData.nota_para_bg || '').trim() ||
      String(formData.numero_bg || '').trim() ||
      String(formData.data_bg || '').trim();

    if (informouBg && !canPublicarBg) {
      alert('Ação negada: você não tem permissão para informar dados de BG.');
      return;
    }

    const registroAtual = registroEdicao
      ? {
        ...registroEdicao,
        status: registroEdicao.status || registroEdicao.status_publicacao || statusCalculadoFormulario,
      }
      : null;
    const registroDestino = { ...formData, status: statusCalculadoFormulario };
    const validacaoTransicao = validarPayloadPublicacao({ registroAtual: registroAtual ?? {}, registroDestino });
    if (!validacaoTransicao.valido) {
      if (registroEdicao?.id) {
        const moduloPersistencia = moduloOrigemEdicao === 'Livro' ? MODULO_LIVRO : MODULO_EX_OFFICIO;
        const entityNameBloqueio = nomeEntidadePorModulo(moduloPersistencia);
        const eventoBloqueio = criarEventoAuditoriaPublicacao({
          registro: {
            ...registroEdicao,
            id: registroEdicao.id,
            origem_tipo: moduloPersistencia === MODULO_LIVRO ? 'livro' : 'ex-officio',
          },
          evento: EVENTO_AUDITORIA_PUBLICACAO.BLOQUEIO,
          usuario: user,
          resumo: validacaoTransicao.motivo || 'Transição inválida de status para publicação.',
          estadoAnterior: normalizarStatusPublicacao(registroAtual?.status_calculado || registroAtual?.status_publicacao || registroAtual?.status) || calcularStatusPublicacaoRegistro(registroAtual || {}),
          estadoNovo: normalizarStatusPublicacao(registroDestino?.status_calculado || registroDestino?.status_publicacao || registroDestino?.status) || calcularStatusPublicacaoRegistro(registroDestino || {}),
          antes: extrairSnapshotPublicacao(registroAtual || {}),
          depois: extrairSnapshotPublicacao(registroDestino || {}),
          metadata: { bloqueio_tipo: 'transicao_invalida' },
        });
        atualizarEscopado(entityNameBloqueio, registroEdicao.id, {
          historico_publicacao: anexarEventoAuditoriaPublicacao(registroEdicao, eventoBloqueio),
        }).catch(() => {});
      }
      alert(validacaoTransicao.motivo || 'Transição inválida de status para publicação.');
      return;
    }

    const payload = {
      ...formData,
      status: statusCalculadoFormulario,
      ...(Object.keys(camposCustom).length > 0 ? { campos_custom: camposCustom } : {}),
    };
    isSubmittingRef.current = true;
    saveMutation.mutate(payload);
  };

  const canAdvanceFromStep1 = !!formData.tipo_registro && !templateObrigatorioAusente && !hasTemplateConflict;
  const canAdvanceFromStep2 = !!formData.militar_id;
  const canAdvanceFromStep3 = !!formData.data_registro;
  const estadosCarregamentoRP = [
    fetchingRegistro ? 'Atualizando registro em edição' : null,
    (fetchingTiposCustom || fetchingTemplatesAtivos) ? 'Atualizando catálogo de tipos/templates' : null,
    carregandoMilitar ? 'Carregando militar selecionado' : null,
    carregandoFerias ? 'Férias: carregamento delegado ao seletor com escopo resolvido' : null,
    carregandoAtestados ? 'Carregando atestados do militar' : null,
    carregandoPublicacoes ? 'Carregando publicações do militar' : null,
    erroParcialCarregamento ? 'Erro parcial em uma fonte de dados; os demais blocos permanecem isolados' : null,
    militarAusente ? 'Militar selecionado não foi encontrado no escopo atual' : null,
    atestadosAusentes ? 'Nenhum atestado elegível encontrado após o carregamento' : null,
    publicacoesAusentes ? 'Nenhuma publicação elegível encontrada após o carregamento' : null,
  ].filter(Boolean);

  if (!loadingUser && isAccessResolved && !hasAccess) {
    return <AccessDenied modulo="RP — Registro de Publicações" />;
  }

  if (!loadingUser && isAccessResolved && !canGerirPublicacoes) {
    return <AccessDenied modulo="Cadastro/Edição de Publicações" />;
  }

  const carregandoCatalogoInicial = canRunScopedQueries && (loadingTiposCustom || loadingTemplatesAtivos);

  if (loadingUser || carregandoCatalogoInicial || (isEditing && loadingRegistro)) {
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

          {estadosCarregamentoRP.length > 0 && (
            <div
              className={`rounded-xl border px-4 py-3 text-sm shadow-sm ${erroParcialCarregamento ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-blue-200 bg-blue-50 text-blue-900'}`}
              role={erroParcialCarregamento ? 'alert' : 'status'}
            >
              <p className="font-semibold">Estado do carregamento do RP</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {estadosCarregamentoRP.map(estado => (
                  <li key={estado}>{estado}</li>
                ))}
              </ul>
            </div>
          )}

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
                    {(!isEditing || permitirAjusteTipoLegadoPublicado) && (
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
                        {permitirAjusteTipoLegadoPublicado ? 'Ajustar tipo legado' : 'Alterar'}
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

              {templateObrigatorioAusente && (
                <div
                  className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 shadow-sm"
                  role="alert"
                >
                  Template obrigatório não encontrado para este tipo de registro. Cadastre um template antes de continuar.
                </div>
              )}

              {hasTemplateConflict && (
                <div
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-900 shadow-sm"
                  role="alert"
                >
                  {TEMPLATE_CONFLITO_MENSAGEM}
                </div>
              )}

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => navigate(createPageUrl('RP'))}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
                  disabled={!canAdvanceFromStep1}
                  onClick={() => {
                    if (!canAdvanceFromStep1) return;
                    setStep(2);
                  }}
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
                    <div className="mt-1.5 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
                      {statusCalculadoFormulario}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      O status é calculado automaticamente pela máquina de estados (Nota/BG).
                    </p>
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
                    onChange={e => {
                      setTextoEditadoManualmente(true);
                      handleChange('texto_publicacao', e.target.value);
                    }}
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

              {templateObrigatorioAusente && (
                <div
                  className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 shadow-sm"
                  role="alert"
                >
                  Template obrigatório não encontrado para este tipo de registro. Cadastre um template antes de continuar.
                </div>
              )}

              {hasTemplateConflict && (
                <div
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-900 shadow-sm"
                  role="alert"
                >
                  {TEMPLATE_CONFLITO_MENSAGEM}
                </div>
              )}

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setStep(3)}>
                  Voltar
                </Button>
                <Button
                  type="submit"
                  className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
                  disabled={saveMutation.isPending || templateObrigatorioAusente || hasTemplateConflict}
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