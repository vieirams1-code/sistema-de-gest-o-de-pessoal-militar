import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, RefreshCw, AlertTriangle, Check, Search, ChevronRight, ChevronLeft, BookOpen, Send } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { addDays } from 'date-fns';
import { aplicarTemplate, buildVarsLivro, abreviarPosto } from '@/components/utils/templateUtils';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import { reconciliarCadeiaFerias } from '@/components/ferias/reconciliacaoCadeiaFerias';
import { getTiposRPFiltrados, groupTiposRP, matchesTipoRPSearch, getRPTipoLabel, getModuloByTipo, MODULO_LIVRO, MODULO_EX_OFFICIO } from '@/components/rp/rpTiposConfig';
import RPSpecificFieldsLivro from '@/components/rp/RPSpecificFieldsLivro';
import RPSpecificFieldsExOfficio from '@/components/rp/RPSpecificFieldsExOfficio';
import { FERIAS_OPERACOES, getLivroOperacaoFerias, isTipoRegistroFerias } from '@/components/livro/feriasOperacaoUtils';

import MilitarSelector from '@/components/atestado/MilitarSelector';
import FormField from '@/components/militar/FormField';

const initialFormData = {
  militar_id: '',
  militar_nome: '',
  militar_posto: '',
  militar_matricula: '',
  militar_sexo: '',
  ferias_id: '',
  tipo_registro: 'Saída Férias',
  data_registro: new Date().toISOString().split('T')[0],
  dias: 0,
  data_inicio: '',
  data_termino: '',
  data_retorno: '',
  conjuge_nome: '',
  inicio_termino: 'Início', // Default para Núpcias, Deslocamento Missão, Curso/Estágio
  falecido_nome: '',
  falecido_certidao: '',
  grau_parentesco: '',
  origem: '',
  destino: '',
  data_cedencia: '',
  obs_cedencia: '',
  motivo_dispensa: '',
  periodo_aquisitivo: '',
  curso_nome: '',
  curso_local: '',
  edicao_ano: '',
  missao_descricao: '',
  documento_referencia: '',
  documento_texto: '',
  data_transferencia: '',
  texto_complemento: '',
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
  funcao: '',
  data_designacao: '',
  finalidade_jiso: '',
  secao_jiso: '',
  data_ata: '',
  nup: '',
  parecer_jiso: '',
  atestados_jiso_ids: [],
  atestado_homologado_id: '',
  nota_para_bg: '',
  numero_bg: '',
  data_bg: '',
  status: 'Aguardando Nota',
  observacoes: ''
};

function calcularMetricasInterrupcao(ferias, dataInterrupcaoIso) {
  const diasNoMomento = Number(ferias?.dias || 0);
  const inicioBase = ferias?.data_inicio ? new Date(`${ferias.data_inicio}T00:00:00`) : null;
  const interrupcaoDate = dataInterrupcaoIso ? new Date(`${dataInterrupcaoIso}T00:00:00`) : null;

  let diasGozados = 0;
  if (inicioBase && interrupcaoDate && !Number.isNaN(inicioBase.getTime()) && !Number.isNaN(interrupcaoDate.getTime())) {
    const diffMs = interrupcaoDate.getTime() - inicioBase.getTime();
    const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
    diasGozados = Math.max(0, diffDias);
  }

  diasGozados = Math.min(diasGozados, diasNoMomento);
  const saldoRemanescente = Math.max(0, diasNoMomento - diasGozados);

  return { diasNoMomento, diasGozados, saldoRemanescente };
}


const ADMIN_EDITABLE_FIELDS = new Set(['nota_para_bg', 'numero_bg', 'data_bg', 'observacoes', 'texto_publicacao']);
const SEMANTIC_FIELDS_TO_PRESERVE = [
  'militar_id', 'militar_nome', 'militar_posto', 'militar_matricula', 'militar_sexo',
  'tipo_registro', 'ferias_id', 'data_registro', 'data_inicio', 'data_termino', 'data_retorno',
  'dias', 'dias_evento', 'dias_restantes', 'dias_no_momento', 'dias_gozados', 'saldo_remanescente',
  'origem', 'destino', 'funcao', 'lotacao', 'data_cedencia', 'data_transferencia', 'tipo_transferencia',
  'curso_nome', 'curso_local', 'documento_referencia', 'periodo_aquisitivo', 'campos_customizados',
  'publicacao_transferencia', 'motivo_dispensa', 'missao_descricao', 'conjuge_nome', 'inicio_termino',
  'falecido_nome', 'falecido_certidao', 'grau_parentesco', 'edicao_ano', 'documento_texto', 'obs_cedencia',
  'data_designacao', 'dias_evento', 'dias_restantes'
];

function mergeCamposPreservados(registroOriginal = {}, draft = {}) {
  const preserved = { ...draft };
  for (const field of SEMANTIC_FIELDS_TO_PRESERVE) {
    if (Object.prototype.hasOwnProperty.call(registroOriginal, field)) {
      preserved[field] = registroOriginal[field];
    }
  }
  return preserved;
}

function getOriginalActEntries(registro = {}) {
  return [
    ['Tipo do ato', getRPTipoLabel(registro.tipo_registro)],
    ['Militar', [registro.militar_posto, registro.militar_nome].filter(Boolean).join(' ')],
    ['Matrícula', registro.militar_matricula],
    ['Data-base', registro.data_registro],
    ['Férias vinculadas', registro.ferias_id],
    ['Data de início', registro.data_inicio],
    ['Data de término', registro.data_termino],
    ['Data de retorno', registro.data_retorno],
    ['Dias', registro.dias],
    ['Dias do evento', registro.dias_evento],
    ['Dias restantes', registro.dias_restantes],
    ['Dias no momento', registro.dias_no_momento],
    ['Dias gozados', registro.dias_gozados],
    ['Saldo remanescente', registro.saldo_remanescente],
    ['Período aquisitivo', registro.periodo_aquisitivo],
    ['Origem', registro.origem],
    ['Destino', registro.destino],
    ['Função', registro.funcao],
    ['Lotação', registro.lotacao],
    ['Data de cedência', registro.data_cedencia],
    ['Data de transferência', registro.data_transferencia],
    ['Tipo de transferência', registro.tipo_transferencia],
    ['Curso', registro.curso_nome],
    ['Local do curso', registro.curso_local],
    ['Documento de referência', registro.documento_referencia],
  ].filter(([, value]) => value !== undefined && value !== null && value !== '');
}

export default function CadastrarRegistroRP() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');
  const isEditing = !!editId;
  const queryClient = useQueryClient();
  const { canAccessModule, isLoading: loadingUser, isAccessResolved } = useCurrentUser();
  const hasRPAccess = canAccessModule('livro') || canAccessModule('publicacoes');

  const [formData, setFormData] = useState(initialFormData);
  const [loading, setLoading] = useState(false);
  const [selectedFerias, setSelectedFerias] = useState(null);
  const [operacaoFeriasSelecionada, setOperacaoFeriasSelecionada] = useState(FERIAS_OPERACOES.INICIO);
  const [textoPublicacao, setTextoPublicacao] = useState('');
  const [templateError, setTemplateError] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [buscaTipo, setBuscaTipo] = useState('');
  const [moduloAtual, setModuloAtual] = useState(null);

  // Buscar templates cadastrados
  const { data: templates = [] } = useQuery({
    queryKey: ['templates-texto'],
    queryFn: () => base44.entities.TemplateTexto.list(),
    staleTime: 30000,
  });

  // Buscar períodos aquisitivos do militar
  const { data: periodosAquisitivos = [] } = useQuery({
    queryKey: ['periodos-aquisitivos-livro', formData.militar_id],
    queryFn: () => base44.entities.PeriodoAquisitivo.filter({ militar_id: formData.militar_id }),
    enabled: !!formData.militar_id,
    staleTime: 0,
  });


  const { data: tiposCustom = [] } = useQuery({
    queryKey: ['tipos-publicacao-custom-rp'],
    queryFn: () => base44.entities.TipoPublicacaoCustom.filter({ ativo: true }),
    staleTime: 30000,
  });

  // Dados extras para tipos customizados
  const [camposCustom, setCamposCustom] = useState({});

  const { data: registroEdicao } = useQuery({
    queryKey: ['registro-livro-edicao', editId],
    queryFn: async () => {
      if (!editId) return null;
      const list = await base44.entities.RegistroRP.filter({ id: editId });
      return list[0] || null;
    },
    enabled: isEditing,
  });

  const { data: feriasEdicao } = useQuery({
    queryKey: ['ferias-edicao-livro', registroEdicao?.ferias_id],
    queryFn: async () => {
      if (!registroEdicao?.ferias_id) return null;
      const list = await base44.entities.Ferias.filter({ id: registroEdicao.ferias_id });
      return list[0] || null;
    },
    enabled: !!registroEdicao?.ferias_id,
  });

  const { data: militarSelecionado } = useQuery({
    queryKey: ['militar-rp', formData.militar_id],
    queryFn: async () => {
      const result = await base44.entities.Militar.filter({ id: formData.militar_id });
      return result[0] || null;
    },
    enabled: !!formData.militar_id,
  });

  const { data: atestadosMilitar = [] } = useQuery({
    queryKey: ['atestados-militar-rp', formData.militar_id],
    queryFn: () => base44.entities.Atestado.filter({ militar_id: formData.militar_id }),
    enabled: !!formData.militar_id,
  });

  const { data: todasPublicacoesRaw = {} } = useQuery({
    queryKey: ['publicacoes-militar-raw-rp', formData.militar_id],
    queryFn: async () => {
      const [exOfficio, livro, atestados] = await Promise.all([
        base44.entities.PublicacaoExOfficio.filter({ militar_id: formData.militar_id }, '-data_publicacao'),
        base44.entities.RegistroRP.filter({ militar_id: formData.militar_id }, '-data_registro'),
        base44.entities.Atestado.filter({ militar_id: formData.militar_id }, '-data_inicio'),
      ]);
      return { exOfficio, livro, atestados };
    },
    enabled: !!formData.militar_id,
  });

  useEffect(() => {
    if (!registroEdicao) return;

    setFormData((prev) => ({
      ...prev,
      ...registroEdicao,
    }));

    if (registroEdicao.tipo_registro) {
      setOperacaoFeriasSelecionada(getLivroOperacaoFerias(registroEdicao.tipo_registro) || FERIAS_OPERACOES.INICIO);
    }
    if (registroEdicao.campos_customizados && typeof registroEdicao.campos_customizados === 'object') {
      setCamposCustom(registroEdicao.campos_customizados);
    }
    if (registroEdicao.texto_publicacao) {
      setTextoPublicacao(registroEdicao.texto_publicacao);
    }
  }, [registroEdicao]);

  useEffect(() => {
    if (!feriasEdicao) return;
    setSelectedFerias(feriasEdicao);
  }, [feriasEdicao]);

  useEffect(() => {
    const modulo = getModuloByTipo(formData.tipo_registro, tiposCustom);
    setModuloAtual(modulo);
  }, [formData.tipo_registro, tiposCustom]);

  useEffect(() => {
    if (!militarSelecionado) return;
    const comp = militarSelecionado.comportamento || '';
    setFormData((prev) => ({
      ...prev,
      comportamento_inicial: prev.comportamento_inicial || comp,
      comportamento_atual: prev.comportamento_atual || comp,
    }));
  }, [militarSelecionado]);

  const todasPublicacoesFormatadas = useMemo(() => {
    const { exOfficio = [], livro = [], atestados = [] } = todasPublicacoesRaw;
    const normalizar = (item) => {
      let origem_tipo = 'livro';
      if (item.tipo && !item.tipo_registro && !item.medico && !item.cid_10) origem_tipo = 'ex-officio';
      else if (item.medico || item.cid_10) origem_tipo = 'atestado';

      return {
        ...item,
        origem_tipo,
        tipo_label: item.tipo_registro || item.tipo || 'Publicação',
        status_calculado: item.numero_bg && item.data_bg ? 'Publicado' : item.nota_para_bg ? 'Aguardando Publicação' : 'Aguardando Nota',
      };
    };

    return [...exOfficio, ...livro, ...atestados]
      .map(normalizar)
      .sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));
  }, [todasPublicacoesRaw]);


  const livroOperacaoFerias = getLivroOperacaoFerias(formData.tipo_registro);
  const tipoRegistroEfetivo = formData.tipo_registro;

  const handleChange = (name, value) => {
    if (isEditing && !ADMIN_EDITABLE_FIELDS.has(name)) return;

    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      if (name === 'nota_para_bg' || name === 'numero_bg' || name === 'data_bg') {
        const nota = name === 'nota_para_bg' ? value : updated.nota_para_bg;
        const numBg = name === 'numero_bg' ? value : updated.numero_bg;
        const dataBg = name === 'data_bg' ? value : updated.data_bg;
        if (numBg && dataBg) updated.status = 'Publicado';
        else if (nota) updated.status = 'Aguardando Publicação';
        else updated.status = 'Aguardando Nota';
      }
      return updated;
    });
  };

  const handleMilitarSelect = (militar) => {
    const militarId = militar?.id || '';
    const militarNome = militar?.militar_nome || militar?.nome_completo || '';
    const militarPosto = militar?.militar_posto || militar?.posto_graduacao || '';
    const militarMatricula = militar?.militar_matricula || militar?.matricula || '';
    const militarSexo = militar?.sexo || '';

    setFormData(prev => ({
      ...prev,
      militar_id: militarId,
      militar_nome: militarNome,
      militar_posto: militarPosto,
      militar_matricula: militarMatricula,
      militar_sexo: militarSexo,
      ferias_id: '',
      dias: 0,
      data_inicio: '',
      data_termino: '',
      data_retorno: '',
      periodo_aquisitivo: '',
      dias_restantes: ''
    }));
    setSelectedFerias(null);
    setOperacaoFeriasSelecionada(livroOperacaoFerias || FERIAS_OPERACOES.INICIO);
  };

  const handleFeriasSelect = (ferias) => {
    if (!ferias) {
      setSelectedFerias(null);
      setFormData((prev) => ({
        ...prev,
        ferias_id: '',
        data_inicio: '',
        data_termino: '',
        data_retorno: '',
        periodo_aquisitivo: '',
      }));
      return;
    }

    const hoje = new Date().toISOString().split('T')[0];
    let dataRegistro = formData.data_registro || hoje;

    if (livroOperacaoFerias === FERIAS_OPERACOES.INICIO) {
      dataRegistro = ferias.data_inicio || formData.data_registro || hoje;
    } else if (livroOperacaoFerias === FERIAS_OPERACOES.TERMINO) {
      dataRegistro = ferias.data_retorno || formData.data_registro || hoje;
    }

    setSelectedFerias(ferias);
    setOperacaoFeriasSelecionada(livroOperacaoFerias || FERIAS_OPERACOES.INICIO);
    setFormData(prev => ({
      ...prev,
      ferias_id: ferias.id,
      data_registro: dataRegistro,
    }));
  };


  const formatarDataExtenso = (dataString) => {
    if (!dataString) return '';
    const data = new Date(dataString + 'T00:00:00');
    const dia = data.getDate();
    const mes = data.getMonth() + 1;
    const ano = data.getFullYear();
    return `${dia.toString().padStart(2, '0')}/${mes.toString().padStart(2, '0')}/${ano}`;
  };

  const numeroPorExtenso = (num) => {
    const numeros = {
      1: 'um', 2: 'dois', 3: 'três', 4: 'quatro', 5: 'cinco',
      6: 'seis', 7: 'sete', 8: 'oito', 9: 'nove', 10: 'dez',
      11: 'onze', 12: 'doze', 13: 'treze', 14: 'quatorze', 15: 'quinze',
      16: 'dezesseis', 17: 'dezessete', 18: 'dezoito', 19: 'dezenove', 20: 'vinte',
      21: 'vinte e um', 22: 'vinte e dois', 23: 'vinte e três', 24: 'vinte e quatro',
      25: 'vinte e cinco', 26: 'vinte e seis', 27: 'vinte e sete', 28: 'vinte e oito',
      29: 'vinte e nove', 30: 'trinta', 60: 'sessenta', 120: 'cento e vinte'
    };
    return numeros[num] || num.toString();
  };

  const calcularDataTermino = () => {
    if (formData.data_inicio && formData.dias > 0) {
      const inicio = new Date(formData.data_inicio + 'T00:00:00');
      const termino = addDays(inicio, formData.dias - 1);
      return termino.toISOString().split('T')[0];
    }
    return '';
  };

  useEffect(() => {
    const termino = calcularDataTermino();
    if (termino) {
      setFormData(prev => ({ ...prev, data_termino: termino }));
    }
  }, [formData.data_inicio, formData.dias]);

  useEffect(() => {
    if (formData.tipo_registro === 'Núpcias') {
      setFormData(prev => ({ ...prev, dias: 8 }));
    } else if (formData.tipo_registro === 'Luto') {
      setFormData(prev => ({ ...prev, dias: 8 }));
    } else if (formData.tipo_registro === 'Trânsito') {
      setFormData(prev => ({ ...prev, dias: 30 }));
    } else if (formData.tipo_registro === 'Instalação') {
      setFormData(prev => ({ ...prev, dias: 10 }));
    } else if (formData.tipo_registro === 'Licença Maternidade') {
      setFormData(prev => ({ ...prev, dias: 120 }));
    } else if (formData.tipo_registro === 'Licença Paternidade') {
      setFormData(prev => ({ ...prev, dias: 5 }));
    } else if (formData.tipo_registro === 'Dispensa Recompensa') {
      setFormData(prev => ({ ...prev, dias: 4 }));
    }
  }, [formData.tipo_registro]);

  useEffect(() => {
    gerarTextoPublicacao();
  }, [formData, selectedFerias, templates]);

  const gerarTextoPublicacao = () => {
    setTemplateError(null);

    const abreviatura = abreviarPosto(formData.militar_posto);
    const quadro = militarSelecionado?.quadro || 'QOBM';
    const postoNome = abreviatura ? `${abreviatura} ${quadro}` : '';
    const nomeCompleto = formData.militar_nome || '';
    const matricula = formData.militar_matricula || '';
    const dataRegistro = formatarDataExtenso(formData.data_registro);
    const dataInicio = formatarDataExtenso(formData.data_inicio);
    const dataTermino = formatarDataExtenso(formData.data_termino);
    const dias = formData.dias || 0;
    const diasExtenso = numeroPorExtenso(dias);

    const aplicarOuErro = (tipoRegistro, varsExtras = {}) => {
      const moduloTemplate = moduloAtual === MODULO_LIVRO ? 'Livro' : moduloAtual === MODULO_EX_OFFICIO ? 'ExOfficio' : 'ExOfficio';
      const tmpl = templates.find((t) => t.modulo === moduloTemplate && t.tipo_registro === tipoRegistro && t.ativo !== false);
      if (tmpl?.template) {
        return aplicarTemplate(tmpl.template, {
          posto_nome: postoNome,
          posto: abreviatura,
          nome_completo: nomeCompleto,
          matricula,
          data_registro: dataRegistro,
          data_publicacao: dataRegistro,
          data_inicio: dataInicio,
          data_termino: dataTermino,
          dias: String(dias),
          dias_extenso: diasExtenso,
          ...varsExtras,
        });
      }
      setTemplateError(`Template obrigatório não encontrado para '${tipoRegistro}'. Entre em contato com o administrador para cadastrar o template antes de continuar.`);
      return '';
    };

    let texto = '';

    if (moduloAtual === MODULO_LIVRO) {
      switch (tipoRegistroEfetivo) {
        case 'Saída Férias':
          if (selectedFerias) {
            const periodoFerias = periodosAquisitivos.find((p) => p.id === selectedFerias.periodo_aquisitivo_id);
            const vars = buildVarsLivro({ ferias: selectedFerias, dataRegistro: formData.data_registro, periodo: periodoFerias });
            const tmpl = templates.find((t) => t.modulo === 'Livro' && t.tipo_registro === 'Saída Férias' && t.ativo !== false);
            if (tmpl?.template) texto = aplicarTemplate(tmpl.template, vars);
            else setTemplateError("Template obrigatório não encontrado para 'Saída Férias'. Entre em contato com o administrador para cadastrar o template antes de continuar.");
          }
          break;
        case 'Interrupção de Férias':
          if (selectedFerias) {
            const periodoFerias = periodosAquisitivos.find((p) => p.id === selectedFerias.periodo_aquisitivo_id);
            const metricas = calcularMetricasInterrupcao(selectedFerias, formData.data_registro);
            const vars = buildVarsLivro({ ferias: selectedFerias, dataRegistro: formData.data_registro, periodo: periodoFerias, interrupcaoInfo: { dataInterrupcao: formData.data_registro, diasNoMomento: metricas.diasNoMomento, diasGozados: metricas.diasGozados, saldoRemanescente: metricas.saldoRemanescente } });
            const tmpl = templates.find((t) => t.modulo === 'Livro' && t.tipo_registro === 'Interrupção de Férias' && t.ativo !== false);
            if (tmpl?.template) texto = aplicarTemplate(tmpl.template, vars);
            else setTemplateError("Template obrigatório não encontrado para 'Interrupção de Férias'. Entre em contato com o administrador para cadastrar o template antes de continuar.");
          }
          break;
        case 'Nova Saída / Retomada':
          if (selectedFerias) {
            const periodoFerias = periodosAquisitivos.find((p) => p.id === selectedFerias.periodo_aquisitivo_id);
            const saldoRetomada = Number(selectedFerias.saldo_remanescente ?? selectedFerias.dias ?? 0);
            const vars = buildVarsLivro({ ferias: selectedFerias, dataRegistro: formData.data_registro, periodo: periodoFerias, interrupcaoInfo: { saldoRemanescente: saldoRetomada } });
            const tmpl = templates.find((t) => t.modulo === 'Livro' && t.tipo_registro === 'Nova Saída / Retomada' && t.ativo !== false);
            if (tmpl?.template) texto = aplicarTemplate(tmpl.template, vars);
            else setTemplateError("Template obrigatório não encontrado para 'Nova Saída / Retomada'. Entre em contato com o administrador para cadastrar o template antes de continuar.");
          }
          break;
        case 'Retorno Férias':
          if (selectedFerias) {
            const periodoFerias = periodosAquisitivos.find((p) => p.id === selectedFerias.periodo_aquisitivo_id);
            const vars = buildVarsLivro({ ferias: selectedFerias, dataRegistro: formData.data_registro, periodo: periodoFerias });
            const tmpl = templates.find((t) => t.modulo === 'Livro' && t.tipo_registro === 'Retorno Férias' && t.ativo !== false);
            if (tmpl?.template) texto = aplicarTemplate(tmpl.template, vars);
            else setTemplateError("Template obrigatório não encontrado para 'Retorno Férias'. Entre em contato com o administrador para cadastrar o template antes de continuar.");
          }
          break;
        case 'Licença Maternidade':
        case 'Prorrogação de Licença Maternidade':
        case 'Licença Paternidade':
          texto = aplicarOuErro(tipoRegistroEfetivo);
          break;
        case 'Núpcias':
          texto = aplicarOuErro('Núpcias', { conjuge_nome: formData.conjuge_nome, inicio_termino: formData.inicio_termino, tipo_texto: formData.inicio_termino === 'Início' ? 'início' : 'término' });
          break;
        case 'Luto':
          texto = aplicarOuErro('Luto', { falecido_nome: formData.falecido_nome, falecido_certidao: formData.falecido_certidao, grau_parentesco: formData.grau_parentesco });
          break;
        case 'Cedência':
          texto = aplicarOuErro('Cedência', { origem: formData.origem, destino: formData.destino, data_cedencia: formatarDataExtenso(formData.data_cedencia) });
          break;
        case 'Transferência para RR':
          texto = aplicarOuErro('Transferência para RR', { origem: formData.origem, destino: formData.destino, documento_referencia: formData.documento_referencia, publicacao_transferencia: formData.publicacao_transferencia, data_transferencia: formatarDataExtenso(formData.data_transferencia) });
          break;
        case 'Transferência':
          texto = aplicarOuErro('Transferência', { origem: formData.origem, destino: formData.destino, publicacao_transferencia: formData.publicacao_transferencia, data_transferencia: formatarDataExtenso(formData.data_transferencia), tipo_transferencia: formData.tipo_transferencia });
          break;
        case 'Trânsito':
        case 'Instalação':
          texto = aplicarOuErro(tipoRegistroEfetivo, { origem: formData.origem, destino: formData.destino });
          break;
        case 'Dispensa Recompensa':
          texto = aplicarOuErro('Dispensa Recompensa', { motivo_dispensa: formData.motivo_dispensa });
          break;
        case 'Deslocamento Missão':
          texto = aplicarOuErro('Deslocamento Missão', { data_retorno: formatarDataExtenso(formData.data_retorno), destino: formData.destino, missao_descricao: formData.missao_descricao, documento_referencia: formData.documento_referencia, inicio_termino: formData.inicio_termino });
          break;
        case 'Curso/Estágio':
          texto = aplicarOuErro('Curso/Estágio', { curso_nome: formData.curso_nome, curso_local: formData.curso_local, edicao_ano: formData.edicao_ano, documento_referencia: formData.documento_referencia, inicio_termino: formData.inicio_termino });
          break;
        default:
          break;
      }
    } else {
      switch (tipoRegistroEfetivo) {
        case 'Elogio Individual':
          texto = aplicarOuErro('Elogio Individual', { texto_complemento: formData.texto_complemento || '' });
          break;
        case 'Melhoria de Comportamento':
          texto = aplicarOuErro('Melhoria de Comportamento', { data_melhoria: formatarDataExtenso(formData.data_melhoria), comportamento_atual: formData.comportamento_atual || '', comportamento_ingressou: formData.comportamento_ingressou || '', data_inclusao: militarSelecionado?.data_inclusao ? formatarDataExtenso(militarSelecionado.data_inclusao) : '' });
          break;
        case 'Punição':
          texto = aplicarOuErro('Punição', { portaria: formData.portaria || '', data_portaria: formatarDataExtenso(formData.data_portaria), tipo_punicao: formData.tipo_punicao || '', dias_punicao: formData.dias_punicao || '', data_punicao: formatarDataExtenso(formData.data_punicao), itens_enquadramento: formData.itens_enquadramento || '', graduacao_punicao: formData.graduacao_punicao || '', comportamento_ingresso: formData.comportamento_ingresso || '' });
          break;
        case 'Designação de Função':
        case 'Dispensa de Função':
          texto = aplicarOuErro(tipoRegistroEfetivo, { funcao: formData.funcao || '', data_designacao: formatarDataExtenso(formData.data_designacao) });
          break;
        case 'Ata JISO':
          texto = aplicarOuErro('Ata JISO', { finalidade_jiso: formData.finalidade_jiso || '', secao_jiso: formData.secao_jiso || '', data_ata: formatarDataExtenso(formData.data_ata), nup: formData.nup || '', parecer_jiso: formData.parecer_jiso || '' });
          break;
        case 'Homologação de Atestado': {
          const at = atestadosMilitar.find((a) => a.id === formData.atestado_homologado_id);
          if (at) texto = aplicarOuErro('Homologação de Atestado', { dias: String(at.dias), dias_extenso: numeroPorExtenso(Number(at.dias || 0)), tipo_afastamento: at.tipo_afastamento?.toLowerCase() || '', data_inicio: formatarDataExtenso(at.data_inicio), data_termino: formatarDataExtenso(at.data_termino) });
          break;
        }
        default:
          break;
      }
    }

    setTextoPublicacao(texto);
  };

  const handleSubmit = async (redirectTarget) => {
    setLoading(true);

    try {
      const publicacaoIgnoradaId = editId || null;

      if (tipoRegistroEfetivo === 'Homologação de Atestado' && formData.atestado_homologado_id) {
        const jaExiste = todasPublicacoesFormatadas.some((item) => item.id !== publicacaoIgnoradaId && item.tipo_registro === 'Homologação de Atestado' && item.atestado_homologado_id === formData.atestado_homologado_id && !item.tornada_sem_efeito_por_id);
        if (jaExiste) {
          alert('Já existe uma homologação ativa para o atestado selecionado.');
          return;
        }
      }

      if (tipoRegistroEfetivo === 'Ata JISO' && formData.atestados_jiso_ids?.length) {
        const idsDuplicados = formData.atestados_jiso_ids.filter((atestadoId) => todasPublicacoesFormatadas.some((item) => item.id !== publicacaoIgnoradaId && item.tipo_registro === 'Ata JISO' && (item.atestados_jiso_ids || []).includes(atestadoId) && !item.tornada_sem_efeito_por_id));
        if (idsDuplicados.length > 0) {
          alert('Já existe uma nota/publicação ativa para esta Ata JISO.');
          return;
        }
      }

      const metricasInterrupcao = tipoRegistroEfetivo === 'Interrupção de Férias' && selectedFerias ? calcularMetricasInterrupcao(selectedFerias, formData.data_registro) : null;
      const toNumOrUndef = (v) => (v !== '' && v !== undefined && v !== null && !Number.isNaN(Number(v)) ? Number(v) : undefined);
      const tipoRegistroInterno = livroOperacaoFerias ? formData.tipo_registro : tipoRegistroEfetivo;
      let diasFinais = toNumOrUndef(formData.dias);
      if (!isEditing && selectedFerias) {
        if (['Saída Férias', 'Interrupção de Férias', 'Retorno Férias'].includes(tipoRegistroInterno)) diasFinais = Number(selectedFerias.dias || 0);
        else if (tipoRegistroInterno === 'Nova Saída / Retomada') diasFinais = Number(selectedFerias.saldo_remanescente || 0);
      }

      const basePayload = {
        ...formData,
        tipo_registro: tipoRegistroInterno,
        texto_publicacao: textoPublicacao,
        campos_customizados: Object.keys(camposCustom).length ? camposCustom : formData.campos_customizados,
        dias: diasFinais,
        dias_evento: toNumOrUndef(formData.dias_evento),
        dias_restantes: toNumOrUndef(formData.dias_restantes),
        dias_punicao: toNumOrUndef(formData.dias_punicao),
        ...(metricasInterrupcao ? { dias_no_momento: metricasInterrupcao.diasNoMomento, dias_gozados: metricasInterrupcao.diasGozados, saldo_remanescente: metricasInterrupcao.saldoRemanescente } : {}),
      };

      let savedRecord;
      if (isEditing) {
        const finalData = mergeCamposPreservados(registroEdicao, {
          ...basePayload,
          modulo: moduloAtual,
          texto_publicacao: registroEdicao?.texto_publicacao || basePayload.texto_publicacao,
        });
        await base44.entities.RegistroRP.update(editId, finalData);
        savedRecord = { id: editId, ...finalData };
        if (registroEdicao?.ferias_id) {
          await reconciliarCadeiaFerias({ feriasId: registroEdicao.ferias_id, ferias: selectedFerias || feriasEdicao || null });
        }
      } else {
        savedRecord = await base44.entities.RegistroRP.create({ ...basePayload, modulo: moduloAtual });
        if (formData.ferias_id) {
          await reconciliarCadeiaFerias({ feriasId: formData.ferias_id, ferias: selectedFerias || null });
        }
      }

      if (tipoRegistroEfetivo === 'Ata JISO' && formData.atestados_jiso_ids?.length) {
        const statusPublicacao = formData.numero_bg && formData.data_bg ? 'Publicado' : formData.nota_para_bg ? 'Aguardando Publicação' : 'Aguardando Nota';
        for (const aid of formData.atestados_jiso_ids) {
          await base44.entities.Atestado.update(aid, { status_jiso: 'Homologado pela JISO', status_publicacao: statusPublicacao });
        }
      }

      if (tipoRegistroEfetivo === 'Homologação de Atestado' && formData.atestado_homologado_id) {
        const statusPublicacao = formData.numero_bg && formData.data_bg ? 'Publicado' : formData.nota_para_bg ? 'Aguardando Publicação' : 'Aguardando Nota';
        await base44.entities.Atestado.update(formData.atestado_homologado_id, { homologado_comandante: true, status_jiso: 'Homologado pelo Comandante', status_publicacao: statusPublicacao });
      }

      if (formData.militar_id) {
        let novoComportamento = null;
        let motivoHistorico = null;
        if (tipoRegistroEfetivo === 'Melhoria de Comportamento' && formData.comportamento_ingressou) {
          novoComportamento = formData.comportamento_ingressou;
          motivoHistorico = 'Melhoria de Comportamento';
        } else if (tipoRegistroEfetivo === 'Punição' && formData.comportamento_ingresso) {
          novoComportamento = formData.comportamento_ingresso;
          motivoHistorico = 'Punição';
        }
        if (novoComportamento) {
          const militaresResult = await base44.entities.Militar.filter({ id: formData.militar_id });
          const militarAtual = militaresResult[0];
          if (militarAtual && militarAtual.comportamento !== novoComportamento) {
            await base44.entities.Militar.update(formData.militar_id, { comportamento: novoComportamento });
            await base44.entities.HistoricoComportamento.create({
              militar_id: formData.militar_id,
              militar_nome: formData.militar_nome,
              comportamento_anterior: militarAtual.comportamento || null,
              comportamento_novo: novoComportamento,
              motivo: motivoHistorico,
              publicacao_id: savedRecord?.id,
              data_alteracao: formData.data_registro || new Date().toISOString().split('T')[0],
              observacoes: `Registro RP - ${tipoRegistroEfetivo}`,
            });
          }
        }
      }

      [['registros-livro'], ['registros-rp'], ['publicacoes-ex-officio'], ['publicacoes'], ['ferias'], ['periodos-aquisitivos'], ['livro-consulta'], ['atestados'], ['cards'], ['militares']].forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
      queryClient.invalidateQueries({ queryKey: ['registro-livro-edicao'] });
      queryClient.invalidateQueries({ queryKey: ['periodos-aquisitivos-livro'] });

      if (redirectTarget === 'publicacoes') navigate(createPageUrl('Publicacoes'));
      else navigate(-1);
    } finally {
      setLoading(false);
    }
  };



  const renderSpecificFields = () => {
    if (moduloAtual === MODULO_LIVRO) {
      return (
        <RPSpecificFieldsLivro
          isEditing={isEditing}
          originalActEntries={originalActEntries}
          formData={formData}
          handleChange={handleChange}
          selectedFerias={selectedFerias}
          handleFeriasSelect={handleFeriasSelect}
          livroOperacaoFerias={livroOperacaoFerias}
          operacaoFeriasSelecionada={operacaoFeriasSelecionada}
          formatarDataExtenso={formatarDataExtenso}
          tipoAtualCustom={tipoAtualCustom}
          camposCustom={camposCustom}
          setCamposCustom={setCamposCustom}
        />
      );
    }
    return (
      <RPSpecificFieldsExOfficio
        formData={formData}
        handleChange={handleChange}
        formatarDataExtenso={formatarDataExtenso}
        atestadosMilitar={atestadosMilitar}
      />
    );
  };


  const tipoAtualCustom = tiposCustom.find(t => t.nome === formData.tipo_registro);
  
  const isFeriasEfetivo = isTipoRegistroFerias(formData.tipo_registro);

  // Gerar texto para tipo customizado
  useEffect(() => {
    if (!tipoAtualCustom) return;
    const vars = {
      posto_nome: formData.militar_posto ? `${formData.militar_posto} QOBM` : '',
      nome_completo: formData.militar_nome || '',
      matricula: formData.militar_matricula || '',
      data_registro: formatarDataExtenso(formData.data_registro),
      data_inicio: formatarDataExtenso(formData.data_inicio),
      data_termino: formatarDataExtenso(formData.data_termino),
      ...(camposCustom),
    };
    let texto = tipoAtualCustom.template || '';
    Object.entries(vars).forEach(([k, v]) => {
      texto = texto.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v || '');
    });
    setTextoPublicacao(texto);
  }, [tipoAtualCustom, formData, camposCustom]);

  const templatesRPAtivos = useMemo(
    () => templates.filter((template) => ['Livro', 'ExOfficio'].includes(template.modulo) && template.ativo !== false),
    [templates],
  );

  const tiposDisponiveis = useMemo(
    () => getTiposRPFiltrados({
      sexo: formData.militar_sexo,
      tiposCustom,
      templatesAtivos: templatesRPAtivos,
      tipoAtualEdicao: registroEdicao?.tipo_registro || null,
    }),
    [formData.militar_sexo, tiposCustom, templatesRPAtivos, registroEdicao?.tipo_registro],
  );

  const gruposDeTipos = useMemo(() => groupTiposRP(tiposDisponiveis), [tiposDisponiveis]);
  const originalActEntries = useMemo(() => getOriginalActEntries(registroEdicao || formData), [registroEdicao, formData]);

  useEffect(() => {
    if (isEditing) return;
    setOperacaoFeriasSelecionada(livroOperacaoFerias || FERIAS_OPERACOES.INICIO);
    setSelectedFerias(null);
    setFormData((prev) => ({
      ...prev,
      militar_id: '',
      militar_nome: '',
      militar_posto: '',
      militar_matricula: '',
      militar_sexo: '',
      ferias_id: '',
      dias: 0,
      data_inicio: '',
      data_termino: '',
      data_retorno: '',
      periodo_aquisitivo: '',
      dias_restantes: '',
    }));
  }, [formData.tipo_registro, isEditing]);

  const canGoNext = () => {
    if (isEditing && !registroEdicao) return false;
    if (currentStep === 1) return !!formData.tipo_registro;
    if (currentStep === 2) {
      if (isEditing) return true;
      return !!formData.militar_id && !!formData.data_registro && !(isFeriasEfetivo && !formData.ferias_id);
    }
    if (currentStep === 3) return !templateError;
    return false;
  };

  if (loadingUser || !isAccessResolved) return null;
  if (!hasRPAccess) return <AccessDenied modulo="Registro de Publicações" />;

  if (isEditing && !registroEdicao) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 h-10 w-10 rounded-full border-2 border-[#1e3a5f] border-t-transparent animate-spin" />
          <h1 className="text-lg font-semibold text-[#1e3a5f]">Carregando registro para edição</h1>
          <p className="mt-2 text-sm text-slate-500">Aguarde para evitar que o wizard exiba um tipo transitório incorreto.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
        {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
                className="hover:bg-slate-100 text-slate-500"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
              <div>
                <h1 className="text-xl font-bold text-[#1e3a5f] flex items-center gap-2">
                  <BookOpen className="w-5 h-5" /> 
                  {isEditing ? 'Editar Registro RP' : 'Novo Registro RP'}
                </h1>
                <p className="text-slate-500 text-xs mt-0.5">Livro · Ex Officio unificado</p>
              </div>
            </div>
          </div>
          
          {/* Resumo compacto / Chips */}
          <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-slate-100">
            {formData.tipo_registro && (
              <Badge className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100">
                Tipo: {getRPTipoLabel(formData.tipo_registro)}
              </Badge>
            )}
            {formData.militar_nome && (
              <Badge className="bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200">
                {formData.militar_posto} {formData.militar_nome}
              </Badge>
            )}
            {formData.militar_matricula && (
              <Badge variant="outline" className="text-slate-500 border-slate-200">
                Matrícula: {formData.militar_matricula}
              </Badge>
            )}
            {formData.data_registro && (
              <Badge variant="outline" className="text-slate-500 border-slate-200">
                Ref: {formatarDataExtenso(formData.data_registro)}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 w-full flex-1 pb-32">
        {/* Stepper */}
        <div className="flex items-center justify-between mb-8 max-w-3xl mx-auto relative">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-200 rounded-full z-0" />
          <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-blue-600 rounded-full z-0 transition-all duration-300" style={{ width: `${((currentStep - 1) / 3) * 100}%` }} />
          
          {['Tipo', 'Dados', 'Texto', 'Revisão'].map((label, index) => {
            const stepNum = index + 1;
            const isActive = stepNum === currentStep;
            const isCompleted = stepNum < currentStep;
            return (
              <div key={label} className="relative z-10 flex flex-col items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors border-2
                  ${isActive ? 'bg-blue-600 border-blue-600 text-white' : 
                    isCompleted ? 'bg-white border-blue-600 text-blue-600' : 'bg-white border-slate-300 text-slate-400'}`}>
                  {isCompleted ? <Check className="w-4 h-4" /> : stepNum}
                </div>
                <span className={`text-xs font-semibold ${isActive ? 'text-blue-700' : isCompleted ? 'text-slate-700' : 'text-slate-400'}`}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Etapa 1: Tipo */}
        {currentStep === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="relative mb-6">
                <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input 
                  placeholder="Buscar tipo de registro..." 
                  className="pl-10 h-12 text-lg"
                  value={buscaTipo}
                  onChange={e => setBuscaTipo(e.target.value)}
                />
              </div>
              
              {isEditing && (
                <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
                  <div>
                    <p className="text-sm font-semibold text-amber-900">Edição restrita: este modo permite apenas ajustes administrativos e de publicação.</p>
                    <p className="mt-1 text-sm text-amber-800">O tipo exibido abaixo reflete o ato original e permanece bloqueado durante a edição.</p>
                  </div>
                </div>
              )}

              {!buscaTipo && (
                <div className="mb-8">
                  <h3 className="text-sm font-semibold text-slate-500 mb-3 uppercase tracking-wider">Acesso Rápido</h3>
                  <div className="flex flex-wrap gap-2">
                    {tiposDisponiveis.filter(t => t.destaque).map(t => {
                      const isSelected = formData.tipo_registro === t.value;
                      return (
                        <button
                          key={t.value}
                          onClick={() => { if (!isEditing) { setFormData((prev) => ({ ...initialFormData, data_registro: prev.data_registro, tipo_registro: t.value })); setSelectedFerias(null); setCurrentStep(2); } }}
                          className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${isSelected ? 'bg-blue-50 border-blue-600 text-blue-700' : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'} ${isEditing ? 'cursor-not-allowed opacity-80' : ''}`}
                        >
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-8">
                {Object.entries(gruposDeTipos).map(([grupoNome, tiposDoGrupo]) => {
                  const tiposFiltradosBusca = tiposDoGrupo.filter(t => matchesTipoRPSearch(t, buscaTipo));
                  if (tiposFiltradosBusca.length === 0) return null;
                  
                  return (
                    <div key={grupoNome}>
                      <h3 className="text-sm font-semibold text-slate-500 mb-3 uppercase tracking-wider">{grupoNome}</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {tiposFiltradosBusca.map(t => {
                          const isSelected = formData.tipo_registro === t.value;
                          return (
                            <div 
                              key={t.value} 
                              onClick={() => { if (!isEditing) { setFormData((prev) => ({ ...initialFormData, data_registro: prev.data_registro, tipo_registro: t.value })); setSelectedFerias(null); setCurrentStep(2); } }}
                              className={`p-4 rounded-lg border transition-all ${isSelected ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600' : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm'} ${isEditing ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className={`font-medium ${isSelected ? 'text-blue-800' : 'text-slate-700'}`}>{t.label}</span>
                                {isSelected && <Check className="w-5 h-5 text-blue-600" />}
                              </div>
                              {t.descricao && <p className="text-xs text-slate-500 leading-snug">{t.descricao}</p>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Etapa 2: Dados Essenciais */}
        {currentStep === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {isEditing ? (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">Militar e data-base do ato</h3>
                <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
                  <div>
                    <p className="text-sm font-semibold text-amber-900">Edição restrita: este modo permite apenas ajustes administrativos e de publicação.</p>
                    <p className="mt-1 text-sm text-amber-800">Militar, vínculo de férias, tipo do lançamento e data-base permanecem preservados exatamente como no registro original.</p>
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Militar</p>
                    <p className="mt-1 text-sm font-medium text-slate-800">{[formData.militar_posto, formData.militar_nome].filter(Boolean).join(' ') || '—'}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Matrícula</p>
                    <p className="mt-1 text-sm font-medium text-slate-800">{formData.militar_matricula || '—'}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Data-base</p>
                    <p className="mt-1 text-sm font-medium text-slate-800">{formatarDataExtenso(formData.data_registro) || '—'}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">Militar e Data Base</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <MilitarSelector
                      value={formData.militar_id}
                      onChange={(name, value) => handleChange(name, value)}
                      onMilitarSelect={handleMilitarSelect}
                      livroOperacaoFerias={livroOperacaoFerias}
                      dataBase={formData.data_registro}
                      somenteElegiveis={Boolean(livroOperacaoFerias)}
                    />
                  </div>
                  <FormField
                    label="Data"
                    name="data_registro"
                    value={formData.data_registro}
                    onChange={handleChange}
                    type="date"
                    required
                  />
                </div>
              </div>
            )}
            {(isEditing || formData.militar_id) && renderSpecificFields()}
          </div>
        )}

        {/* Etapa 3: Texto e Publicação */}
        {currentStep === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {templateError && (
              <div className="bg-red-50 rounded-xl shadow-sm border border-red-200 p-6 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <Label className="text-sm font-bold text-red-800">Ação Bloqueada</Label>
                  <p className="text-sm text-red-700 mt-1">{templateError}</p>
                </div>
              </div>
            )}

            {!templateError && (isEditing || formData.militar_id) && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <Label className="text-base font-semibold text-[#1e3a5f]">Texto Final</Label>
                  <span className="text-xs text-emerald-600 font-medium flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">
                    <RefreshCw className="w-3 h-3" /> Baseado em template
                  </span>
                </div>
                <div className="p-5 bg-slate-50 border border-slate-200 rounded-lg min-h-[120px]">
                  <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                    {textoPublicacao || 'Nenhum texto gerado. Preencha os dados na etapa anterior.'}
                  </p>
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">Dados de Publicação e Observações (Opcional)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <FormField
                  label="Nota para BG"
                  name="nota_para_bg"
                  value={formData.nota_para_bg}
                  onChange={handleChange}
                  placeholder="Ex: 001/2025"
                />
                <FormField
                  label="Número do BG"
                  name="numero_bg"
                  value={formData.numero_bg}
                  onChange={handleChange}
                />
                <FormField
                  label="Data do BG"
                  name="data_bg"
                  value={formData.data_bg}
                  onChange={handleChange}
                  type="date"
                />
                <div>
                  <Label className="text-sm font-medium text-slate-700">Status Processado</Label>
                  <div className="mt-1.5 px-3 py-2.5 border rounded-md bg-slate-50 text-slate-600 text-sm">
                    {formData.status || 'Aguardando Nota'}
                  </div>
                </div>
              </div>
              
              <div>
                <Label className="text-sm font-medium text-slate-700">Observações Complementares</Label>
                <Textarea
                  value={formData.observacoes}
                  onChange={(e) => handleChange('observacoes', e.target.value)}
                  className="mt-1.5 border-slate-200"
                  rows={2}
                  placeholder="Observações de uso interno..."
                />
              </div>
            </div>
          </div>
        )}

        {/* Etapa 4: Revisão */}
        {currentStep === 4 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-[#1e3a5f] px-6 py-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Revisão do Lançamento</h3>
              </div>
              <div className="p-6">
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-6 text-sm">
                  <div>
                    <dt className="text-slate-500 font-medium">Tipo</dt>
                    <dd className="mt-1 font-semibold text-slate-800">{getRPTipoLabel(formData.tipo_registro)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 font-medium">Militar</dt>
                    <dd className="mt-1 font-semibold text-slate-800">{formData.militar_posto} {formData.militar_nome}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 font-medium">Data do Registro</dt>
                    <dd className="mt-1 text-slate-800">{formatarDataExtenso(formData.data_registro)}</dd>
                  </div>
                  {formData.dias > 0 && (
                    <div>
                      <dt className="text-slate-500 font-medium">Dias</dt>
                      <dd className="mt-1 text-slate-800">{formData.dias}</dd>
                    </div>
                  )}
                  {formData.nota_para_bg && (
                    <div>
                      <dt className="text-slate-500 font-medium">Nota BG</dt>
                      <dd className="mt-1 text-slate-800">{formData.nota_para_bg}</dd>
                    </div>
                  )}
                  <div className="sm:col-span-2 pt-4 border-t border-slate-100">
                    <dt className="text-slate-500 font-medium mb-2">Texto de Publicação</dt>
                    <dd className="text-slate-700 bg-slate-50 p-4 rounded-lg border border-slate-200 whitespace-pre-wrap">
                      {textoPublicacao}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sticky Footer Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 py-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-30">
        <div className="max-w-5xl mx-auto px-4 flex items-center justify-between">
          <Button 
            variant="outline" 
            onClick={() => setCurrentStep(prev => prev - 1)}
            disabled={currentStep === 1 || loading}
            className="text-slate-600 border-slate-300"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Voltar
          </Button>

          <div className="flex items-center gap-3">
            {currentStep < 4 ? (
              <Button 
                onClick={() => setCurrentStep(prev => prev + 1)}
                disabled={!canGoNext() || loading}
                className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white px-8"
              >
                Avançar
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <>
                <Button 
                  variant="outline"
                  onClick={() => handleSubmit('back')}
                  disabled={loading || !!templateError || (isFeriasEfetivo && !formData.ferias_id)}
                  className="border-[#1e3a5f] text-[#1e3a5f] hover:bg-slate-50"
                >
                  {loading ? <div className="w-4 h-4 border-2 border-[#1e3a5f] border-t-transparent rounded-full animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  Salvar e Concluir
                </Button>
                <Button 
                  onClick={() => handleSubmit('publicacoes')}
                  disabled={loading || !!templateError || (isFeriasEfetivo && !formData.ferias_id)}
                  className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white"
                >
                  {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                  Salvar e ir para Publicações
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
