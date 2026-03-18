import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, RefreshCw, AlertTriangle, Search, Sparkles } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { addDays } from 'date-fns';
import { aplicarTemplate, buildVarsLivro, abreviarPosto } from '@/components/utils/templateUtils';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import { reconciliarCadeiaFerias } from '@/components/ferias/reconciliacaoCadeiaFerias';
import { getTiposLivroFiltrados, groupTiposLivro, matchesTipoLivroSearch } from '@/components/livro/livroTipoRegistroConfig';

import MilitarSelector from '@/components/atestado/MilitarSelector';
import FeriasSelector from '@/components/livro/FeriasSelector';
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
  inicio_termino: 'Início',
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
  nota_para_bg: '',
  numero_bg: '',
  data_bg: '',
  status: 'Aguardando Nota',
  observacoes: ''
};

function getPeriodoSortKey(periodoRef, fallbackDate = '') {
  if (periodoRef) {
    const match = String(periodoRef).match(/(\d{4})\s*\/\s*(\d{4})/);
    if (match) {
      return Number(match[1]);
    }
  }

  if (fallbackDate) {
    const d = new Date(`${fallbackDate}T00:00:00`);
    if (!Number.isNaN(d.getTime())) return d.getTime();
  }

  return Number.MAX_SAFE_INTEGER;
}

function getOperacoesDisponiveisFerias(ferias) {
  if (!ferias) return ['Saída Férias'];
  if (ferias.status === 'Em Curso') return ['Retorno Férias', 'Interrupção de Férias'];
  if (ferias.status === 'Interrompida') return ['Nova Saída / Retomada'];
  return ['Saída Férias'];
}

function resolverOperacaoFerias(ferias) {
  return getOperacoesDisponiveisFerias(ferias)[0];
}


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

export default function CadastrarRegistroLivro() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');
  const id = editId;
  const queryClient = useQueryClient();
  const { canAccessModule, isLoading: loadingUser, isAccessResolved } = useCurrentUser();
  const hasLivroAccess = canAccessModule('livro');

  const [formData, setFormData] = useState(initialFormData);
  const [loading, setLoading] = useState(false);
  const [selectedFerias, setSelectedFerias] = useState(null);
  const [operacaoFeriasSelecionada, setOperacaoFeriasSelecionada] = useState('Saída Férias');
  const [textoPublicacao, setTextoPublicacao] = useState('');
  const [usingCustomTemplate, setUsingCustomTemplate] = useState(false);
  const [templateError, setTemplateError] = useState(null);
  const [tipoSearch, setTipoSearch] = useState('');

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
    queryKey: ['tipos-publicacao-custom-livro'],
    queryFn: () => base44.entities.TipoPublicacaoCustom.filter({ modulo: 'Livro', ativo: true }),
    staleTime: 30000,
  });

  // Dados extras para tipos customizados
  const [camposCustom, setCamposCustom] = useState({});

  const { data: registroEdicao } = useQuery({
    queryKey: ['registro-livro-edicao', id],
    queryFn: async () => {
      if (!id) return null;
      const list = await base44.entities.RegistroLivro.filter({ id });
      return list[0] || null;
    },
    enabled: !!id,
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

  useEffect(() => {
    if (!registroEdicao) return;

    setFormData((prev) => ({
      ...prev,
      ...registroEdicao,
    }));

    if (registroEdicao.tipo_registro && registroEdicao.tipo_registro !== 'Saída Férias') {
      setOperacaoFeriasSelecionada(registroEdicao.tipo_registro);
    }
  }, [registroEdicao]);

  useEffect(() => {
    if (!feriasEdicao) return;
    setSelectedFerias(feriasEdicao);
  }, [feriasEdicao]);

  const tipoRegistroEfetivo = formData.tipo_registro === 'Saída Férias'
    ? (selectedFerias ? operacaoFeriasSelecionada : 'Saída Férias')
    : formData.tipo_registro;

  const handleChange = (name, value) => {
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
    setOperacaoFeriasSelecionada('Saída Férias');
  };

  const handleFeriasSelect = (ferias) => {
    const operacao = resolverOperacaoFerias(ferias);
    const hoje = new Date().toISOString().split('T')[0];
    let dataRegistro = formData.data_registro || hoje;

    if (operacao === 'Saída Férias') {
      dataRegistro = ferias.data_inicio || formData.data_registro || hoje;
    } else if (operacao === 'Retorno Férias') {
      dataRegistro = ferias.data_retorno || formData.data_registro || hoje;
    }

    setSelectedFerias(ferias);
    setOperacaoFeriasSelecionada(operacao);
    setFormData(prev => ({
      ...prev,
      ferias_id: ferias.id,
      data_registro: dataRegistro,
    }));
  };

  const handleOperacaoFeriasChange = (operacao) => {
    if (!selectedFerias) return;

    const hoje = new Date().toISOString().split('T')[0];
    let dataRegistro = formData.data_registro || hoje;

    if (operacao === 'Saída Férias') {
      dataRegistro = selectedFerias.data_inicio || formData.data_registro || hoje;
    } else if (operacao === 'Retorno Férias') {
      dataRegistro = selectedFerias.data_retorno || formData.data_registro || hoje;
    } else {
      dataRegistro = formData.data_registro || hoje;
    }

    setOperacaoFeriasSelecionada(operacao);
    setFormData(prev => ({
      ...prev,
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
    const postoNome = abreviatura ? `${abreviatura} QOBM` : '';
    const nomeCompleto = formData.militar_nome || '';
    const matricula = formData.militar_matricula || '';
    const dataRegistro = formatarDataExtenso(formData.data_registro);
    const dataInicio = formatarDataExtenso(formData.data_inicio);
    const dataTermino = formatarDataExtenso(formData.data_termino);
    const dias = formData.dias || 0;
    const diasExtenso = numeroPorExtenso(dias);

    // Helper: tenta usar template cadastrado primeiro, caso contrário gera erro
    const aplicarOuErro = (tipoRegistro, varsExtras = {}) => {
      const tmpl = templates.find(
        t => t.modulo === 'Livro' && t.tipo_registro === tipoRegistro && t.ativo !== false
      );
      if (tmpl?.template) {
        const vars = {
          posto_nome: postoNome,
          posto: abreviatura,
          nome_completo: nomeCompleto,
          matricula,
          data_registro: dataRegistro,
          data_inicio: dataInicio,
          data_termino: dataTermino,
          dias: String(dias),
          dias_extenso: diasExtenso,
          ...varsExtras,
        };
        setUsingCustomTemplate(true);
        return aplicarTemplate(tmpl.template, vars);
      }
      setUsingCustomTemplate(false);
      setTemplateError(`Template obrigatório não encontrado para '${tipoRegistro}'. Entre em contato com o administrador para cadastrar o template antes de continuar.`);
      return '';
    };

    let texto = '';

    switch (tipoRegistroEfetivo) {
      case 'Saída Férias':
        if (selectedFerias) {
          const periodoFerias = periodosAquisitivos.find(p => p.id === selectedFerias.periodo_aquisitivo_id);
          const vars = buildVarsLivro({ ferias: selectedFerias, dataRegistro: formData.data_registro, periodo: periodoFerias });
          const tmpl = templates.find(t => t.modulo === 'Livro' && t.tipo_registro === 'Saída Férias' && t.ativo !== false);
          if (tmpl?.template) {
            texto = aplicarTemplate(tmpl.template, vars);
            setUsingCustomTemplate(true);
          } else {
            setUsingCustomTemplate(false);
            setTemplateError(`Template obrigatório não encontrado para 'Saída Férias'. Entre em contato com o administrador para cadastrar o template antes de continuar.`);
          }
        }
        break;

      case 'Interrupção de Férias':
        if (selectedFerias) {
          const periodoFerias = periodosAquisitivos.find(p => p.id === selectedFerias.periodo_aquisitivo_id);
          const diasNoMomento = Number(selectedFerias.dias || 0);
          const inicioBase = selectedFerias.data_inicio ? new Date(`${selectedFerias.data_inicio}T00:00:00`) : null;
          const interrupcaoDate = formData.data_registro ? new Date(`${formData.data_registro}T00:00:00`) : null;
          let diasGozados = Number(selectedFerias.dias_gozados_interrupcao || 0);
          if (inicioBase && interrupcaoDate && !Number.isNaN(inicioBase.getTime()) && !Number.isNaN(interrupcaoDate.getTime())) {
            const diffMs = interrupcaoDate.getTime() - inicioBase.getTime();
            diasGozados = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1);
          }
          diasGozados = Math.min(diasGozados, diasNoMomento);
          const saldoRemanescente = Math.max(0, diasNoMomento - diasGozados);
          const vars = buildVarsLivro({
            ferias: selectedFerias,
            dataRegistro: formData.data_registro,
            periodo: periodoFerias,
            interrupcaoInfo: {
              dataInterrupcao: formData.data_registro,
              diasNoMomento,
              diasGozados,
              saldoRemanescente,
            },
          });
          const tmpl = templates.find(t => t.modulo === 'Livro' && t.tipo_registro === 'Interrupção de Férias' && t.ativo !== false);
          if (tmpl?.template) {
            texto = aplicarTemplate(tmpl.template, vars);
            setUsingCustomTemplate(true);
          } else {
            setUsingCustomTemplate(false);
            setTemplateError(`Template obrigatório não encontrado para 'Interrupção de Férias'. Entre em contato com o administrador para cadastrar o template antes de continuar.`);
          }
        }
        break;

      case 'Nova Saída / Retomada':
        if (selectedFerias) {
          const periodoFerias = periodosAquisitivos.find(p => p.id === selectedFerias.periodo_aquisitivo_id);
          const saldoRetomada = Number(selectedFerias.saldo_remanescente ?? selectedFerias.dias ?? 0);
          const vars = buildVarsLivro({
            ferias: selectedFerias,
            dataRegistro: formData.data_registro,
            periodo: periodoFerias,
            interrupcaoInfo: { saldoRemanescente: saldoRetomada },
          });
          const tmpl = templates.find(t => t.modulo === 'Livro' && t.tipo_registro === 'Nova Saída / Retomada' && t.ativo !== false);
          if (tmpl?.template) {
            texto = aplicarTemplate(tmpl.template, vars);
            setUsingCustomTemplate(true);
          } else {
            setUsingCustomTemplate(false);
            setTemplateError(`Template obrigatório não encontrado para 'Nova Saída / Retomada'. Entre em contato com o administrador para cadastrar o template antes de continuar.`);
          }
        }
        break;

      case 'Retorno Férias':
        if (selectedFerias) {
          const periodoFerias = periodosAquisitivos.find(p => p.id === selectedFerias.periodo_aquisitivo_id);
          const vars = buildVarsLivro({ ferias: selectedFerias, dataRegistro: formData.data_registro, periodo: periodoFerias });
          const tmpl = templates.find(t => t.modulo === 'Livro' && t.tipo_registro === 'Retorno Férias' && t.ativo !== false);
          if (tmpl?.template) {
            texto = aplicarTemplate(tmpl.template, vars);
            setUsingCustomTemplate(true);
          } else {
            setUsingCustomTemplate(false);
            setTemplateError(`Template obrigatório não encontrado para 'Retorno Férias'. Entre em contato com o administrador para cadastrar o template antes de continuar.`);
          }
        }
        break;

      case 'Licença Maternidade':
      case 'Prorrogação de Licença Maternidade':
      case 'Licença Paternidade':
        texto = aplicarOuErro(tipoRegistroEfetivo);
        break;

      case 'Núpcias':
        texto = aplicarOuErro('Núpcias', { tipo_texto: formData.inicio_termino === 'Início' ? 'início' : 'término' });
        break;

      case 'Luto':
        texto = aplicarOuErro('Luto', {
          falecido_nome: formData.falecido_nome,
          falecido_certidao: formData.falecido_certidao,
          grau_parentesco: formData.grau_parentesco,
        });
        break;

      case 'Cedência':
        texto = aplicarOuErro('Cedência', {
          origem: formData.origem,
          destino: formData.destino,
          data_cedencia: formatarDataExtenso(formData.data_cedencia),
        });
        break;

      case 'Transferência para RR':
        texto = aplicarOuErro('Transferência para RR', {
          origem: formData.origem,
          destino: formData.destino,
          documento_referencia: formData.documento_referencia,
          publicacao_transferencia: formData.publicacao_transferencia,
          data_transferencia: formatarDataExtenso(formData.data_transferencia),
        });
        break;

      case 'Transferência':
        texto = aplicarOuErro('Transferência', {
          origem: formData.origem,
          destino: formData.destino,
          publicacao_transferencia: formData.publicacao_transferencia,
          data_transferencia: formatarDataExtenso(formData.data_transferencia),
          tipo_transferencia: formData.tipo_transferencia,
        });
        break;

      case 'Trânsito':
        texto = aplicarOuErro('Trânsito', { origem: formData.origem, destino: formData.destino });
        break;

      case 'Instalação':
        texto = aplicarOuErro('Instalação', { origem: formData.origem, destino: formData.destino });
        break;

      case 'Dispensa Recompensa':
        texto = aplicarOuErro('Dispensa Recompensa', { motivo_dispensa: formData.motivo_dispensa });
        break;

      case 'Deslocamento Missão':
        texto = aplicarOuErro('Deslocamento Missão', {
          data_retorno: formatarDataExtenso(formData.data_retorno),
          destino: formData.destino,
          missao_descricao: formData.missao_descricao,
          documento_referencia: formData.documento_referencia,
          inicio_termino: formData.inicio_termino,
        });
        break;

      case 'Curso/Estágio':
        texto = aplicarOuErro('Curso/Estágio', {
          curso_nome: formData.curso_nome,
          curso_local: formData.curso_local,
          edicao_ano: formData.edicao_ano,
          documento_referencia: formData.documento_referencia,
          inicio_termino: formData.inicio_termino,
        });
        break;

      case 'Designação de Função':
      case 'Dispensa de Função':
        texto = aplicarOuErro(tipoRegistroEfetivo, {
          funcao: formData.funcao || '',
          data_designacao: formatarDataExtenso(formData.data_designacao),
        });
        break;
    }

    setTextoPublicacao(texto);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const metricasInterrupcao =
      tipoRegistroEfetivo === 'Interrupção de Férias' && selectedFerias
        ? calcularMetricasInterrupcao(selectedFerias, formData.data_registro)
        : null;

    const toNumOrUndef = (v) => (v !== '' && v !== undefined && v !== null && !Number.isNaN(Number(v)) ? Number(v) : undefined);

    // Previne salvar "0" dias em registros de férias que não renderizam o campo "dias" na UI
    let diasFinais = toNumOrUndef(formData.dias);
    if (selectedFerias) {
      if (['Saída Férias', 'Interrupção de Férias', 'Retorno Férias'].includes(tipoRegistroEfetivo)) {
        diasFinais = Number(selectedFerias.dias || 0);
      } else if (tipoRegistroEfetivo === 'Nova Saída / Retomada') {
        diasFinais = Number(selectedFerias.saldo_remanescente || 0);
      }
    }

    const registroData = {
      ...formData,
      tipo_registro: tipoRegistroEfetivo,
      texto_publicacao: textoPublicacao,
      dias: diasFinais,
      dias_evento: toNumOrUndef(formData.dias_evento),
      dias_restantes: toNumOrUndef(formData.dias_restantes),
      ...(metricasInterrupcao
        ? {
            dias_no_momento: metricasInterrupcao.diasNoMomento,
            dias_gozados: metricasInterrupcao.diasGozados,
            saldo_remanescente: metricasInterrupcao.saldoRemanescente,
          }
        : {}),
    };

    if (id) {
      await base44.entities.RegistroLivro.update(id, registroData);
    } else {
      await base44.entities.RegistroLivro.create(registroData);
    }


    if (formData.ferias_id) {
      await reconciliarCadeiaFerias({
        feriasId: formData.ferias_id,
        ferias: selectedFerias || null,
      });
    }

    queryClient.invalidateQueries({ queryKey: ['registros-livro'] });
    queryClient.invalidateQueries({ queryKey: ['ferias'] });
    queryClient.invalidateQueries({ queryKey: ['periodos-aquisitivos'] });
    queryClient.invalidateQueries({ queryKey: ['periodos-aquisitivos-livro'] });
    queryClient.invalidateQueries({ queryKey: ['publicacoes-ex-officio'] });
    queryClient.invalidateQueries({ queryKey: ['publicacoes'] });
    
    setLoading(false);
    navigate(createPageUrl('Publicacoes'));
  };

  const renderSpecificFields = () => {
    if (formData.tipo_registro === 'Saída Férias') {
      return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">Férias</h3>

          <FeriasSelector
            militarId={formData.militar_id}
            value={formData.ferias_id}
            onChange={handleFeriasSelect}
            tipoRegistro={formData.tipo_registro}
          />

          {selectedFerias && (
            <div className="mt-4 space-y-3">
              <div className="p-3 rounded-lg border border-blue-200 bg-blue-50 text-sm text-blue-800">
                Ação operacional identificada para esta seleção: <strong>{operacaoFeriasSelecionada === 'Nova Saída / Retomada' ? 'Continuação de férias interrompida' : operacaoFeriasSelecionada === 'Interrupção de Férias' ? 'Interrupção de férias em curso' : operacaoFeriasSelecionada === 'Retorno Férias' ? 'Término de férias em curso' : 'Início de férias'}</strong>.
              </div>
              {selectedFerias.status === 'Em Curso' && (
                <div className="p-4 bg-white rounded-lg border border-slate-200">
                  <Label className="text-sm font-medium text-slate-700">Ação para férias em curso</Label>
                  <Select value={operacaoFeriasSelecionada} onValueChange={handleOperacaoFeriasChange}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Retorno Férias">Término</SelectItem>
                      <SelectItem value="Interrupção de Férias">Interrupção</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500">Período Aquisitivo</p>
                    <p className="font-medium">{selectedFerias.periodo_aquisitivo_ref}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Status</p>
                    <p className="font-medium">{selectedFerias.status}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Data Base</p>
                    <p className="font-medium">{formatarDataExtenso(selectedFerias.data_inicio)}</p>
                  </div>
                  {selectedFerias.saldo_remanescente != null && (
                    <div>
                      <p className="text-slate-500">Saldo Remanescente</p>
                      <p className="font-medium text-blue-700">{selectedFerias.saldo_remanescente} dias</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    switch (tipoRegistroEfetivo) {
      case 'Licença Maternidade':
      case 'Prorrogação de Licença Maternidade':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">{formData.tipo_registro}</h3>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Data de Início" name="data_inicio" value={formData.data_inicio} onChange={handleChange} type="date" required />
              <FormField label="Data de Término" name="data_termino" value={formData.data_termino} onChange={handleChange} type="date" required />
            </div>
          </div>
        );

      case 'Licença Paternidade':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">Licença Paternidade</h3>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Data de Início" name="data_inicio" value={formData.data_inicio} onChange={handleChange} type="date" required />
              <FormField label="Data de Término" name="data_termino" value={formData.data_termino} onChange={handleChange} type="date" required />
            </div>
          </div>
        );

      case 'Transferência':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">Transferência</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Origem" name="origem" value={formData.origem} onChange={handleChange} placeholder="1ºSGBM/3°GBM" required />
                <FormField label="Destino" name="destino" value={formData.destino} onChange={handleChange} placeholder="1° Grupamento de Bombeiros Militar" required />
              </div>
              <FormField label="Data da Transferência" name="data_transferencia" value={formData.data_transferencia} onChange={handleChange} type="date" required />
              <div>
                <Label className="text-sm font-medium text-slate-700">
                  Publicação da Transferência
                  <span className="ml-2 text-xs text-slate-400 font-normal">(Ex: DOEMS nº XX.XXX de XX de XXX de XXXX)</span>
                </Label>
                <Input
                  value={formData.publicacao_transferencia || ''}
                  onChange={(e) => handleChange('publicacao_transferencia', e.target.value)}
                  className="mt-1.5"
                  placeholder="DOEMS nº XX.XXX de XX de XXX de XXXX"
                />
              </div>
            </div>
          </div>
        );

      case 'Núpcias':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">Núpcias</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Cônjuge" name="conjuge_nome" value={formData.conjuge_nome} onChange={handleChange} placeholder="Nome do cônjuge" required />
                <FormField label="Data de Início" name="data_inicio" value={formData.data_inicio} onChange={handleChange} type="date" required />
              </div>
            </div>
          </div>
        );

      case 'Luto':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">Luto</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  label="Falecido(a)"
                  name="falecido_nome"
                  value={formData.falecido_nome}
                  onChange={handleChange}
                  placeholder="Nome do falecido"
                  required
                />
                <FormField
                  label="Certidão de Óbito"
                  name="falecido_certidao"
                  value={formData.falecido_certidao}
                  onChange={handleChange}
                  placeholder="Número da certidão"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  label="Grau de Parentesco (BM e Cônjuge)"
                  name="grau_parentesco"
                  value={formData.grau_parentesco}
                  onChange={handleChange}
                  type="select"
                  options={['Ascendentes', 'Descendentes', 'Cônjuge', 'Irmão(ã)']}
                  required
                />
                <FormField
                  label="Data de Início"
                  name="data_inicio"
                  value={formData.data_inicio}
                  onChange={handleChange}
                  type="date"
                  required
                />
              </div>
            </div>
          </div>
        );

      case 'Cedência':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">Cedência</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  label="Origem"
                  name="origem"
                  value={formData.origem}
                  onChange={handleChange}
                  placeholder="Unidade de origem"
                  required
                />
                <FormField
                  label="Destino"
                  name="destino"
                  value={formData.destino}
                  onChange={handleChange}
                  placeholder="Unidade de destino"
                  required
                />
              </div>
              <FormField
                label="Data da Cedência"
                name="data_cedencia"
                value={formData.data_cedencia}
                onChange={handleChange}
                type="date"
                required
              />
              <div>
                <Label>OBS</Label>
                <Textarea
                  value={formData.obs_cedencia}
                  onChange={(e) => handleChange('obs_cedencia', e.target.value)}
                  className="mt-1.5"
                  rows={3}
                />
              </div>
            </div>
          </div>
        );

      case 'Transferência para RR':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">Transferência para Reserva Remunerada</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Origem" name="origem" value={formData.origem} onChange={handleChange} placeholder="Unidade de origem" />
                <FormField label="Destino" name="destino" value={formData.destino} onChange={handleChange} placeholder="Unidade de destino" />
              </div>
              <FormField label="Data de Transferência" name="data_transferencia" value={formData.data_transferencia} onChange={handleChange} type="date" required />
              <div>
                <Label className="text-sm font-medium text-slate-700">
                  Publicação da Transferência
                  <span className="ml-2 text-xs text-slate-400 font-normal">(Ex: DOEMS nº XX.XXX de XX de XXX de XXXX)</span>
                </Label>
                <Input
                  value={formData.publicacao_transferencia || ''}
                  onChange={(e) => handleChange('publicacao_transferencia', e.target.value)}
                  className="mt-1.5"
                  placeholder="DOEMS nº XX.XXX de XX de XXX de XXXX"
                />
              </div>
            </div>
          </div>
        );

      case 'Trânsito':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">Trânsito</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Origem" name="origem" value={formData.origem} onChange={handleChange} placeholder="Unidade de origem" required />
                <FormField label="Destino" name="destino" value={formData.destino} onChange={handleChange} placeholder="Unidade de destino" required />
              </div>
              <FormField label="Data de Início" name="data_inicio" value={formData.data_inicio} onChange={handleChange} type="date" required />
            </div>
          </div>
        );

      case 'Instalação':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">Instalação</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Origem" name="origem" value={formData.origem} onChange={handleChange} placeholder="Unidade de origem" required />
                <FormField label="Destino" name="destino" value={formData.destino} onChange={handleChange} placeholder="Unidade de destino" required />
              </div>
              <FormField label="Data de Início" name="data_inicio" value={formData.data_inicio} onChange={handleChange} type="date" required />
            </div>
          </div>
        );

      case 'Dispensa Recompensa':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">Dispensa como Recompensa</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Dias" name="dias" value={formData.dias} onChange={handleChange} type="number" required />
                <FormField label="Data de Início" name="data_inicio" value={formData.data_inicio} onChange={handleChange} type="date" required />
              </div>
              <div>
                <Label>Motivo</Label>
                <Textarea value={formData.motivo_dispensa} onChange={(e) => handleChange('motivo_dispensa', e.target.value)} className="mt-1.5" rows={2} placeholder="Motivo da dispensa..." />
              </div>
            </div>
          </div>
        );


      case 'Deslocamento Missão':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">Deslocamento para Missões</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Data de Início" name="data_inicio" value={formData.data_inicio} onChange={handleChange} type="date" required />
                <FormField label="Data de Retorno" name="data_retorno" value={formData.data_retorno} onChange={handleChange} type="date" />
              </div>
              <FormField label="Documento de Referência" name="documento_referencia" value={formData.documento_referencia} onChange={handleChange} placeholder="Ex: OS nº 001/2025" />
              <div>
                <Label>Descrição da Missão</Label>
                <Textarea value={formData.missao_descricao} onChange={(e) => handleChange('missao_descricao', e.target.value)} className="mt-1.5" rows={2} placeholder="Ex: CMAUT/2025" />
              </div>
            </div>
          </div>
        );

      case 'Curso/Estágio':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">Cursos / Estágios / Capacitações</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Data de Início" name="data_inicio" value={formData.data_inicio} onChange={handleChange} type="date" required />
                <FormField label="Edição ou Ano" name="edicao_ano" value={formData.edicao_ano} onChange={handleChange} placeholder="Ex: 2025" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Cursos" name="curso_nome" value={formData.curso_nome} onChange={handleChange} placeholder="Ex: CMAUT/2025" required />
                <FormField label="Localidade de Realização" name="curso_local" value={formData.curso_local} onChange={handleChange} placeholder="Ex: Manaus" />
              </div>
            </div>
          </div>
        );

      

      default:
        // Verifica se é um tipo customizado
        if (tipoAtualCustom) {
          return (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">{tipoAtualCustom.nome}</h3>
              <div className="space-y-4">
                {(tipoAtualCustom.campos || []).map((campo) => (
                  <div key={campo.chave}>
                    <Label className="text-sm font-medium text-slate-700">
                      {campo.label}{campo.obrigatorio && <span className="text-red-500 ml-1">*</span>}
                    </Label>
                    {campo.tipo === 'textarea' ? (
                      <Textarea
                        className="mt-1.5"
                        value={camposCustom[campo.chave] || ''}
                        onChange={e => setCamposCustom(prev => ({ ...prev, [campo.chave]: e.target.value }))}
                        rows={3}
                      />
                    ) : (
                      <Input
                        className="mt-1.5"
                        type={campo.tipo === 'date' ? 'date' : campo.tipo === 'number' ? 'number' : 'text'}
                        value={camposCustom[campo.chave] || ''}
                        onChange={e => setCamposCustom(prev => ({ ...prev, [campo.chave]: e.target.value }))}
                        required={campo.obrigatorio}
                      />
                    )}
                  </div>
                ))}
                {(!tipoAtualCustom.campos || tipoAtualCustom.campos.length === 0) && (
                  <p className="text-sm text-slate-400">Nenhum campo adicional para este tipo.</p>
                )}
              </div>
            </div>
          );
        }
        return null;
    }
  };

  const tipoAtualCustom = tiposCustom.find(t => t.nome === formData.tipo_registro);

  const tiposFiltrados = useMemo(() => getTiposLivroFiltrados({ sexo: formData.militar_sexo, tiposCustom }), [formData.militar_sexo, tiposCustom]);
  const tiposDisponiveis = useMemo(() => tiposFiltrados.filter((tipo) => matchesTipoLivroSearch(tipo, tipoSearch)), [tiposFiltrados, tipoSearch]);
  const tiposAgrupados = useMemo(() => groupTiposLivro(tiposDisponiveis), [tiposDisponiveis]);
  const tipoSelecionado = useMemo(() => tiposFiltrados.find((tipo) => tipo.value === formData.tipo_registro), [tiposFiltrados, formData.tipo_registro]);
  const tiposDestaque = useMemo(() => tiposFiltrados.filter((tipo) => tipo.destaque).slice(0, 6), [tiposFiltrados]);

  const resumoOperacional = useMemo(() => {
    if (!tipoSelecionado) return [];

    const itens = [];

    if (tipoRegistroEfetivo === 'Saída Férias') {
      itens.push('Selecione a cadeia de férias correta para o militar antes de salvar.');
      itens.push('O texto e a data-base são ajustados conforme a cadeia selecionada.');
    }

    if (tipoRegistroEfetivo === 'Interrupção de Férias') {
      itens.push('A data do registro define quantos dias já foram gozados.');
      itens.push('O saldo remanescente fica pronto para continuação posterior.');
    }

    if (tipoRegistroEfetivo === 'Nova Saída / Retomada') {
      itens.push('Use este tipo apenas para férias já interrompidas.');
      itens.push('O saldo remanescente é reaproveitado automaticamente no texto.');
    }

    if (tipoRegistroEfetivo === 'Retorno Férias') {
      itens.push('Use para encerrar a cadeia de férias em curso.');
    }

    if (['Licença Maternidade', 'Prorrogação de Licença Maternidade', 'Licença Paternidade'].includes(tipoRegistroEfetivo)) {
      itens.push('Confira datas de início e término antes de salvar.');
    }

    if (['Transferência', 'Transferência para RR', 'Cedência', 'Trânsito', 'Instalação'].includes(tipoRegistroEfetivo)) {
      itens.push('Preencha origem, destino e referência do ato para evitar ambiguidade operacional.');
    }

    if (['Núpcias', 'Luto', 'Dispensa Recompensa'].includes(tipoRegistroEfetivo)) {
      itens.push('Os dias padrão são sugeridos automaticamente quando aplicável.');
    }

    if (['Deslocamento Missão', 'Curso/Estágio'].includes(tipoRegistroEfetivo)) {
      itens.push('Detalhe o documento de referência para facilitar consultas futuras.');
    }

    if (tipoAtualCustom) {
      itens.push('Este tipo usa campos personalizados e template configurado em Configurações.');
    }

    return itens.slice(0, 3);
  }, [tipoSelecionado, tipoRegistroEfetivo, tipoAtualCustom]);

  const isFeriasEfetivo = ['Saída Férias', 'Interrupção de Férias', 'Nova Saída / Retomada', 'Retorno Férias'].includes(tipoRegistroEfetivo);

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


  if (loadingUser || !isAccessResolved) return null;
  if (!hasLivroAccess) return <AccessDenied modulo="Livro de Registros" />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="hover:bg-slate-200"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-[#1e3a5f]">Cadastrar Livro</h1>
              <p className="text-slate-500 text-sm">Registro de livro</p>
            </div>
          </div>
          <Button
            onClick={handleSubmit}
            disabled={loading || !formData.militar_id || !!templateError || (isFeriasEfetivo && !formData.ferias_id)}
            className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white px-6"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
            ) : (
              <Save className="w-5 h-5 mr-2" />
            )}
            Salvar
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Identificação */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">Identificação</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <MilitarSelector
                  value={formData.militar_id}
                  onChange={(name, value) => handleChange(name, value)}
                  onMilitarSelect={handleMilitarSelect}
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

          {/* Tipo de Registro */}
          {formData.militar_id && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <Label className="text-sm font-medium text-slate-700">Tipo de Registro</Label>
                  <p className="mt-1 text-xs text-slate-500">Busque pelo tipo operacional e selecione o lançamento correto para evitar confusão entre fluxos parecidos.</p>
                </div>
                <div className="relative w-full md:max-w-xs">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    value={tipoSearch}
                    onChange={(e) => setTipoSearch(e.target.value)}
                    placeholder="Buscar tipo, grupo ou palavra-chave"
                    className="pl-9"
                  />
                </div>
              </div>

              {tiposDestaque.length > 0 && !tipoSearch && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                    <Sparkles className="w-3.5 h-3.5" /> Tipos frequentes
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {tiposDestaque.map((tipo) => {
                      const ativo = formData.tipo_registro === tipo.value;
                      return (
                        <button
                          key={tipo.value}
                          type="button"
                          onClick={() => {
                            handleChange('tipo_registro', tipo.value);
                            setSelectedFerias(null);
                            setOperacaoFeriasSelecionada('Saída Férias');
                            setFormData(prev => ({
                              ...prev,
                              ferias_id: '',
                              dias: 0,
                              data_inicio: '',
                              data_termino: '',
                              data_retorno: '',
                              periodo_aquisitivo: '',
                            }));
                          }}
                          className={`rounded-full border px-3 py-1.5 text-sm transition ${ativo ? 'border-[#1e3a5f] bg-[#1e3a5f] text-white' : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100'}`}
                        >
                          {tipo.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <Select value={formData.tipo_registro} onValueChange={(v) => {
                handleChange('tipo_registro', v);
                setSelectedFerias(null);
                setOperacaoFeriasSelecionada('Saída Férias');
                setFormData(prev => ({
                  ...prev,
                  ferias_id: '',
                  dias: 0,
                  data_inicio: '',
                  data_termino: '',
                  data_retorno: '',
                  periodo_aquisitivo: '',
                }));
              }}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(tiposAgrupados).length > 0 ? Object.entries(tiposAgrupados).map(([grupo, tipos]) => (
                    <SelectGroup key={grupo}>
                      <SelectLabel className="text-xs uppercase tracking-wide text-slate-500">{grupo}</SelectLabel>
                      {tipos.map((tipo) => (
                        <SelectItem key={tipo.value} value={tipo.value}>{tipo.label}</SelectItem>
                      ))}
                    </SelectGroup>
                  )) : (
                    <div className="px-2 py-3 text-sm text-slate-500">Nenhum tipo encontrado para a busca informada.</div>
                  )}
                </SelectContent>
              </Select>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{tipoSelecionado?.label || formData.tipo_registro}</p>
                    <p className="mt-1 text-sm text-slate-600">{tipoSelecionado?.descricao || 'Registro operacional do Livro.'}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {tipoSelecionado?.grupo && <span className="rounded-full bg-white px-2.5 py-1 text-slate-600 border border-slate-200">Grupo {tipoSelecionado.grupo}</span>}
                    {isFeriasEfetivo && <span className="rounded-full bg-blue-100 px-2.5 py-1 text-blue-700 border border-blue-200">Fluxo operacional de férias</span>}
                    {usingCustomTemplate && <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700 border border-emerald-200">Template aplicado</span>}
                  </div>
                </div>

                {resumoOperacional.length > 0 && (
                  <div className="mt-4 grid gap-2 md:grid-cols-3">
                    {resumoOperacional.map((item) => (
                      <div key={item} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                        {item}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Erro de Template Obrigatório */}
          {templateError && (
            <div className="bg-red-50 rounded-xl shadow-sm border border-red-200 p-6 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <Label className="text-sm font-bold text-red-800">Ação Bloqueada</Label>
                <p className="text-sm text-red-700 mt-1">{templateError}</p>
              </div>
            </div>
          )}

          {/* Campos Específicos */}
          {formData.militar_id && renderSpecificFields()}

          {/* Texto para Publicação */}
          {!templateError && formData.militar_id && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium text-slate-700">Texto para publicação</Label>
                <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" /> Gerado automaticamente por template
                </span>
              </div>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg min-h-[100px]">
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {textoPublicacao || 'Nenhum texto gerado.'}
                </p>
              </div>
            </div>
          )}

          {/* Publicação e Status */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">Publicação e Status</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                label="Nota para BG"
                name="nota_para_bg"
                value={formData.nota_para_bg}
                onChange={handleChange}
                placeholder="Ex: 001/2025"
              />
              <div>
                <Label className="text-sm font-medium text-slate-700">Status</Label>
                <div className="mt-1.5 px-3 py-2 border rounded-md bg-slate-50 text-slate-600 text-sm">
                  {formData.status || 'Aguardando Nota'}
                </div>
              </div>
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
            </div>
          </div>

          {/* Observações */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">Observações para Alterações</h3>
            <Textarea
              value={formData.observacoes}
              onChange={(e) => handleChange('observacoes', e.target.value)}
              className="border-slate-200"
              rows={4}
              placeholder="Observações gerais..."
            />
          </div>
        </form>
      </div>
    </div>
  );
}
