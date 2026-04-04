import React, { useMemo, useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, FileText, Save, Info, Eye, AlertCircle } from 'lucide-react';
import { aplicarTemplate, VARS_PREVIEW, extrairVariaveisDoTemplate } from '@/components/utils/templateUtils';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import { RP_TIPOS_BASE, MODULO_LIVRO, MODULO_EX_OFFICIO } from '@/components/rp/rpTiposConfig';
import {
  ESCOPO_TEMPLATE,
  getChaveUnicidadeTemplate,
  getConflitoTemplatePorTipo,
  normalizarEscopoTemplate,
  validarEscopoTemplate,
} from '@/components/rp/templateValidation';
import {
  FERIAS_TIPO_CANONICO,
  getLabelTipoFerias,
  resolverTipoFeriasCanonico,
} from '@/components/ferias/feriasTipoResolver';

const FERIAS_CANONICAL_TYPES = Object.values(FERIAS_TIPO_CANONICO);

const MODULO_LABELS = {
  [MODULO_LIVRO]: 'Livro',
  [MODULO_EX_OFFICIO]: 'Ex Offício',
};

const ESCOPO_OPTIONS = [
  { value: ESCOPO_TEMPLATE.GLOBAL, label: 'Global' },
  { value: ESCOPO_TEMPLATE.SETOR, label: 'Setor' },
  { value: ESCOPO_TEMPLATE.SUBSETOR, label: 'Subsetor' },
  { value: ESCOPO_TEMPLATE.UNIDADE, label: 'Unidade' },
];

function getEscopoLabel(escopo) {
  return ESCOPO_OPTIONS.find((item) => item.value === escopo)?.label || 'Global';
}

const TIPO_LABEL_OVERRIDES = {
  ELEVACAO_COMPORTAMENTO_DISCIPLINAR: 'Elevação de Comportamento Disciplinar',
};

const TIPO_REGISTRO_CATEGORIAS = [
  {
    key: 'ferias',
    label: 'Férias',
    tipos: ['Saída Férias', 'Interrupção de Férias', 'Nova Saída / Retomada', 'Retorno Férias'],
  },
  {
    key: 'atestados_saude',
    label: 'Atestados / Saúde',
    tipos: ['Homologação de Atestado', 'Ata JISO'],
  },
  {
    key: 'comportamento',
    label: 'Comportamento',
    tipos: ['Melhoria de Comportamento', 'ELEVACAO_COMPORTAMENTO_DISCIPLINAR', 'Punição'],
  },
  {
    key: 'livro_administrativo',
    label: 'Livro / Atos Administrativos',
    tipos: [
      'Apostila',
      'Cedência',
      'Curso/Estágio',
      'Designação de Função',
      'Deslocamento Missão',
      'Dispensa de Função',
      'Dispensa Recompensa',
      'Elogio Individual',
      'Licença Maternidade',
      'Prorrogação de Licença Maternidade',
      'Licença Paternidade',
      'Transcrição de Documentos',
      'Tornar sem Efeito',
      'Geral',
    ],
  },
];

function normalizeTemplateModulo(modulo) {
  return modulo === 'Publicação Ex Officio' ? MODULO_EX_OFFICIO : modulo || '';
}

function getModuloDisplay(modulo) {
  return MODULO_LABELS[normalizeTemplateModulo(modulo)] || modulo || 'Não definido';
}

function serializeTemplateModulo(modulo) {
  return normalizeTemplateModulo(modulo) === MODULO_EX_OFFICIO ? 'Publicação Ex Officio' : modulo;
}

function createEmptyTemplateForm() {
  return {
    modulo: '',
    tipo_registro: '',
    nome: '',
    template: '',
    escopo: ESCOPO_TEMPLATE.GLOBAL,
    setor_id: '',
    subsetor_id: '',
    unidade_id: '',
    ativo: true,
  };
}

function getFormTextValue(value) {
  return value ?? '';
}

function normalizeTemplateForForm(template) {
  if (!template) return createEmptyTemplateForm();

  return normalizarEscopoTemplate({
    ...createEmptyTemplateForm(),
    ...template,
    modulo: normalizeTemplateModulo(template.modulo),
    template: getFormTextValue(template.template),
    ativo: template.ativo ?? true,
  });
}

function buildTemplatePayload(data) {
  const normalizado = normalizarEscopoTemplate(data);
  return {
    ...normalizado,
    modulo: serializeTemplateModulo(normalizado.modulo),
    tipo_registro: normalizado.tipo_registro || '',
    nome: getFormTextValue(normalizado.nome),
    template: getFormTextValue(normalizado.template),
    ativo: normalizado.ativo ?? true,
  };
}

async function createTemplate(payload) {
  return base44.entities.TemplateTexto.create(payload);
}

async function updateTemplate(id, payload) {
  return base44.entities.TemplateTexto.update(id, payload);
}

function getTipoDisplay(tipo) {
  const tipoCanonicoFerias = resolverTipoFeriasCanonico(tipo);
  if (tipoCanonicoFerias) return getLabelTipoFerias(tipoCanonicoFerias);
  return TIPO_LABEL_OVERRIDES[tipo] || tipo;
}

function getTipoSelectLabel(modulo, tipo) {
  const tipoCanonicoFerias = resolverTipoFeriasCanonico(tipo);
  if (normalizeTemplateModulo(modulo) === MODULO_LIVRO && tipoCanonicoFerias) {
    return `${getLabelTipoFerias(tipoCanonicoFerias)} (${tipoCanonicoFerias})`;
  }
  return getTipoDisplay(tipo);
}

function isLivroFeriasTipo(tipo) {
  const tipoCanonicoFerias = resolverTipoFeriasCanonico(tipo);
  return Boolean(tipoCanonicoFerias && FERIAS_CANONICAL_TYPES.includes(tipoCanonicoFerias));
}

function isTipoOcultoNoFrontend(tipo) {
  const valor = String(tipo || '').trim();
  return valor.endsWith('_COMPORTAMENTO_DISCIPLINAR') && valor !== 'ELEVACAO_COMPORTAMENTO_DISCIPLINAR';
}

const VARS_POR_TIPO = {
  'Saída Férias': {
    grupo: 'Início',
    cor: 'green',
    variaveis: [
      { v: '{{posto_nome}}', desc: 'Posto/Graduação + QOBM' },
      { v: '{{nome_completo}}', desc: 'Nome completo do militar' },
      { v: '{{matricula}}', desc: 'Matrícula funcional' },
      { v: '{{data_registro}}', desc: 'Data do registro' },
      { v: '{{data_inicio}}', desc: 'Data de início das férias' },
      { v: '{{dias}}', desc: 'Quantidade de dias' },
      { v: '{{dias_extenso}}', desc: 'Dias por extenso' },
      { v: '{{periodo_aquisitivo}}', desc: 'Período aquisitivo completo' },
      { v: '{{periodo_aquisitivo_simplificado}}', desc: 'Período aquisitivo simplificado (ex: 2024/2025)' },
      { v: '{{fracionamento}}', desc: 'Fração das férias (ex: 1ª parcela)' },
    ]
  },
  'Interrupção de Férias': {
    grupo: 'Interrupção',
    cor: 'orange',
    variaveis: [
      { v: '{{posto_nome}}', desc: 'Posto/Graduação + QOBM' },
      { v: '{{nome_completo}}', desc: 'Nome completo' },
      { v: '{{matricula}}', desc: 'Matrícula' },
      { v: '{{data_registro}}', desc: 'Data do registro / interrupção' },
      { v: '{{data_interrupcao}}', desc: 'Data da interrupção' },
      { v: '{{dias}}', desc: 'Dias da cadeia no momento da interrupção' },
      { v: '{{dias_gozados}}', desc: 'Dias efetivamente gozados até a interrupção' },
      { v: '{{dias_gozados_interrupcao}}', desc: 'Dias efetivamente gozados até a interrupção' },
      { v: '{{saldo_remanescente}}', desc: 'Saldo remanescente após a interrupção' },
      { v: '{{periodo_aquisitivo}}', desc: 'Período aquisitivo' },
    ]
  },
  'Continuação de Férias': {
    grupo: 'Continuação',
    cor: 'teal',
    variaveis: [
      { v: '{{posto_nome}}', desc: 'Posto/Graduação + QOBM' },
      { v: '{{nome_completo}}', desc: 'Nome completo' },
      { v: '{{matricula}}', desc: 'Matrícula' },
      { v: '{{data_registro}}', desc: 'Data do registro / continuação' },
      { v: '{{data_inicio}}', desc: 'Nova data de início da continuação' },
      { v: '{{data_retorno}}', desc: 'Nova data de retorno' },
      { v: '{{dias}}', desc: 'Dias retomados / saldo retomado' },
      { v: '{{saldo_remanescente}}', desc: 'Saldo remanescente da interrupção anterior' },
      { v: '{{periodo_aquisitivo}}', desc: 'Período aquisitivo' },
    ]
  },
  'Nova Saída / Retomada': {
    grupo: 'Continuação',
    cor: 'teal',
    variaveis: [
      { v: '{{posto_nome}}', desc: 'Posto/Graduação + QOBM' },
      { v: '{{nome_completo}}', desc: 'Nome completo' },
      { v: '{{matricula}}', desc: 'Matrícula' },
      { v: '{{data_registro}}', desc: 'Data do registro / continuação' },
      { v: '{{data_inicio}}', desc: 'Nova data de início da continuação' },
      { v: '{{data_retorno}}', desc: 'Nova data de retorno' },
      { v: '{{dias}}', desc: 'Dias retomados / saldo retomado' },
      { v: '{{saldo_remanescente}}', desc: 'Saldo remanescente da interrupção anterior' },
      { v: '{{periodo_aquisitivo}}', desc: 'Período aquisitivo' },
    ]
  },
  'Retorno Férias': {
    grupo: 'Término',
    cor: 'green',
    variaveis: [
      { v: '{{posto_nome}}', desc: 'Posto/Graduação + QOBM' },
      { v: '{{nome_completo}}', desc: 'Nome completo' },
      { v: '{{matricula}}', desc: 'Matrícula' },
      { v: '{{data_registro}}', desc: 'Data do término / retorno' },
      { v: '{{data_retorno}}', desc: 'Data de retorno' },
      { v: '{{dias}}', desc: 'Dias' },
      { v: '{{dias_extenso}}', desc: 'Dias por extenso' },
      { v: '{{periodo_aquisitivo}}', desc: 'Período aquisitivo' },
      { v: '{{tipo_ferias_texto}}', desc: 'Texto do tipo de férias' },
    ]
  },
  'Licença Maternidade': {
    grupo: 'Licença Maternidade',
    cor: 'orange',
    variaveis: [
      { v: '{{posto_nome}}', desc: 'Posto/Graduação + QOBM' },
      { v: '{{nome_completo}}', desc: 'Nome completo' },
      { v: '{{matricula}}', desc: 'Matrícula' },
      { v: '{{data_inicio}}', desc: 'Data de início' },
      { v: '{{data_termino}}', desc: 'Data de término' },
      { v: '{{dias}}', desc: 'Dias de licença' },
      { v: '{{dias_extenso}}', desc: 'Dias por extenso' },
    ]
  },
  'Prorrogação de Licença Maternidade': {
    grupo: 'Prorrogação de Licença Maternidade',
    cor: 'orange',
    variaveis: [
      { v: '{{posto_nome}}', desc: 'Posto/Graduação + QOBM' },
      { v: '{{nome_completo}}', desc: 'Nome completo' },
      { v: '{{matricula}}', desc: 'Matrícula' },
      { v: '{{data_inicio}}', desc: 'Data de início' },
      { v: '{{data_termino}}', desc: 'Data de término' },
    ]
  },
  'Licença Paternidade': {
    grupo: 'Licença Paternidade',
    cor: 'orange',
    variaveis: [
      { v: '{{posto_nome}}', desc: 'Posto/Graduação + QOBM' },
      { v: '{{nome_completo}}', desc: 'Nome completo' },
      { v: '{{matricula}}', desc: 'Matrícula' },
      { v: '{{data_inicio}}', desc: 'Data de início' },
      { v: '{{data_termino}}', desc: 'Data de término' },
    ]
  },
  'Núpcias': {
    grupo: 'Núpcias',
    cor: 'purple',
    variaveis: [
      { v: '{{posto_nome}}', desc: 'Posto/Graduação + QOBM' },
      { v: '{{nome_completo}}', desc: 'Nome completo' },
      { v: '{{matricula}}', desc: 'Matrícula' },
      { v: '{{conjuge_nome}}', desc: 'Nome do cônjuge' },
      { v: '{{data_inicio}}', desc: 'Data de início' },
      { v: '{{inicio_termino}}', desc: 'Início ou término' },
      { v: '{{tipo_texto}}', desc: 'Tipo de texto (início ou término)' },
    ]
  },
  'Luto': {
    grupo: 'Luto',
    cor: 'slate',
    variaveis: [
      { v: '{{posto_nome}}', desc: 'Posto/Graduação + QOBM' },
      { v: '{{nome_completo}}', desc: 'Nome completo' },
      { v: '{{matricula}}', desc: 'Matrícula' },
      { v: '{{falecido_nome}}', desc: 'Nome do falecido' },
      { v: '{{falecido_certidao}}', desc: 'Número da certidão de óbito' },
      { v: '{{grau_parentesco}}', desc: 'Grau de parentesco' },
      { v: '{{data_inicio}}', desc: 'Data de início' },
      { v: '{{data_termino}}', desc: 'Data de término' },
    ]
  },
  'Cedência': {
    grupo: 'Cedência',
    cor: 'slate',
    variaveis: [
      { v: '{{posto_nome}}', desc: 'Posto/Graduação + QOBM' },
      { v: '{{nome_completo}}', desc: 'Nome completo' },
      { v: '{{matricula}}', desc: 'Matrícula' },
      { v: '{{origem}}', desc: 'Unidade de origem' },
      { v: '{{destino}}', desc: 'Unidade de destino' },
      { v: '{{data_cedencia}}', desc: 'Data da cedência' },
    ]
  },
  'Transferência': {
    grupo: 'Transferência',
    cor: 'slate',
    variaveis: [
      { v: '{{posto_nome}}', desc: 'Posto/Graduação + QOBM' },
      { v: '{{nome_completo}}', desc: 'Nome completo' },
      { v: '{{matricula}}', desc: 'Matrícula' },
      { v: '{{origem}}', desc: 'Unidade de origem' },
      { v: '{{destino}}', desc: 'Unidade de destino' },
      { v: '{{data_transferencia}}', desc: 'Data da transferência' },
      { v: '{{publicacao_transferencia}}', desc: 'Publicação da transferência (DOEMS nº XX.XXX...)' },
      { v: '{{tipo_transferencia}}', desc: 'Tipo de transferência' },
    ]
  },
  'Transferência para RR': {
    grupo: 'Transferência para Reserva Remunerada',
    cor: 'slate',
    variaveis: [
      { v: '{{posto_nome}}', desc: 'Posto/Graduação + QOBM' },
      { v: '{{nome_completo}}', desc: 'Nome completo' },
      { v: '{{matricula}}', desc: 'Matrícula' },
      { v: '{{documento_referencia_rr}}', desc: 'Documento de referência RR' },
      { v: '{{data_transferencia_rr}}', desc: 'Data da transferência para RR' },
      { v: '{{documento_referencia}}', desc: 'Documento de referência' },
      { v: '{{publicacao_transferencia}}', desc: 'Publicação da transferência' },
      { v: '{{data_transferencia}}', desc: 'Data da transferência' },
      { v: '{{origem}}', desc: 'Unidade de origem' },
      { v: '{{destino}}', desc: 'Unidade de destino' },
    ]
  },
  'Trânsito': {
    grupo: 'Trânsito',
    cor: 'slate',
    variaveis: [
      { v: '{{posto_nome}}', desc: 'Posto/Graduação + QOBM' },
      { v: '{{nome_completo}}', desc: 'Nome completo' },
      { v: '{{matricula}}', desc: 'Matrícula' },
      { v: '{{origem}}', desc: 'Unidade de origem' },
      { v: '{{destino}}', desc: 'Unidade de destino' },
      { v: '{{data_inicio}}', desc: 'Data de início' },
    ]
  },
  'Instalação': {
    grupo: 'Instalação',
    cor: 'slate',
    variaveis: [
      { v: '{{posto_nome}}', desc: 'Posto/Graduação + QOBM' },
      { v: '{{nome_completo}}', desc: 'Nome completo' },
      { v: '{{matricula}}', desc: 'Matrícula' },
      { v: '{{origem}}', desc: 'Unidade de origem' },
      { v: '{{destino}}', desc: 'Unidade de destino' },
      { v: '{{data_inicio}}', desc: 'Data de início' },
    ]
  },
  'Dispensa Recompensa': {
    grupo: 'Dispensa como Recompensa',
    cor: 'orange',
    variaveis: [
      { v: '{{posto_nome}}', desc: 'Posto/Graduação + QOBM' },
      { v: '{{nome_completo}}', desc: 'Nome completo' },
      { v: '{{matricula}}', desc: 'Matrícula' },
      { v: '{{dias}}', desc: 'Dias de dispensa' },
      { v: '{{dias_extenso}}', desc: 'Dias por extenso' },
      { v: '{{data_inicio}}', desc: 'Data de início' },
      { v: '{{motivo_dispensa}}', desc: 'Motivo da dispensa' },
    ]
  },
  'Deslocamento Missão': {
    grupo: 'Deslocamento para Missões',
    cor: 'teal',
    variaveis: [
      { v: '{{posto_nome}}', desc: 'Posto/Graduação + QOBM' },
      { v: '{{nome_completo}}', desc: 'Nome completo' },
      { v: '{{matricula}}', desc: 'Matrícula' },
      { v: '{{data_inicio}}', desc: 'Data de início' },
      { v: '{{data_retorno}}', desc: 'Data de retorno' },
      { v: '{{destino}}', desc: 'Local de destino' },
      { v: '{{missao_descricao}}', desc: 'Descrição da missão' },
      { v: '{{documento_referencia}}', desc: 'Documento de referência' },
      { v: '{{inicio_termino}}', desc: 'Início ou término' },
    ]
  },
  'Curso/Estágio': {
    grupo: 'Cursos / Estágios / Capacitações',
    cor: 'teal',
    variaveis: [
      { v: '{{posto_nome}}', desc: 'Posto/Graduação + QOBM' },
      { v: '{{nome_completo}}', desc: 'Nome completo' },
      { v: '{{matricula}}', desc: 'Matrícula' },
      { v: '{{data_inicio}}', desc: 'Data de início' },
      { v: '{{curso_nome}}', desc: 'Nome do curso ou estágio' },
      { v: '{{curso_local}}', desc: 'Local do curso' },
      { v: '{{edicao_ano}}', desc: 'Edição ou ano' },
      { v: '{{documento_referencia}}', desc: 'Documento de referência' },
      { v: '{{inicio_termino}}', desc: 'Início ou término' },
    ]
  },
  'Designação de Função': {
    grupo: 'Designação de Função',
    cor: 'blue',
    variaveis: [
      { v: '{{posto_nome}}', desc: 'Posto/Graduação + QOBM' },
      { v: '{{nome_completo}}', desc: 'Nome completo' },
      { v: '{{matricula}}', desc: 'Matrícula' },
      { v: '{{funcao}}', desc: 'Função designada' },
      { v: '{{data_designacao}}', desc: 'Data de designação' },
    ]
  },
  'Dispensa de Função': {
    grupo: 'Dispensa de Função',
    cor: 'blue',
    variaveis: [
      { v: '{{posto_nome}}', desc: 'Posto/Graduação + QOBM' },
      { v: '{{nome_completo}}', desc: 'Nome completo' },
      { v: '{{matricula}}', desc: 'Matrícula' },
      { v: '{{funcao}}', desc: 'Função dispensada' },
      { v: '{{data_designacao}}', desc: 'Data da dispensa' },
    ]
  },
  'Punição': {
    grupo: 'Punição',
    cor: 'red',
    variaveis: [
      { v: '{{posto_nome}}', desc: 'Posto/Graduação + QOBM' },
      { v: '{{nome_completo}}', desc: 'Nome completo' },
      { v: '{{matricula}}', desc: 'Matrícula' },
      { v: '{{portaria}}', desc: 'Número da Portaria' },
      { v: '{{data_portaria}}', desc: 'Data da Portaria' },
      { v: '{{tipo_punicao}}', desc: 'Tipo de Punição' },
      { v: '{{dias_punicao}}', desc: 'Dias de Punição' },
      { v: '{{data_punicao}}', desc: 'Data da Punição' },
      { v: '{{itens_enquadramento}}', desc: 'Itens de Enquadramento' },
      { v: '{{graduacao_punicao}}', desc: 'Graduação da Punição' },
      { v: '{{comportamento_ingresso}}', desc: 'Comportamento de Ingresso' },
    ]
  },
  'Elogio Individual': {
    grupo: 'Elogio Individual',
    cor: 'green',
    variaveis: [
      { v: '{{posto_nome}}', desc: 'Posto/Graduação + QOBM' },
      { v: '{{nome_completo}}', desc: 'Nome completo' },
      { v: '{{matricula}}', desc: 'Matrícula' },
      { v: '{{texto_complemento}}', desc: 'Texto do elogio' },
    ]
  },
  'Melhoria de Comportamento': {
    grupo: 'Melhoria de Comportamento',
    cor: 'green',
    variaveis: [
      { v: '{{posto_nome}}', desc: 'Posto/Graduação + QOBM' },
      { v: '{{nome_completo}}', desc: 'Nome completo' },
      { v: '{{matricula}}', desc: 'Matrícula' },
      { v: '{{data_melhoria}}', desc: 'Data da melhoria' },
      { v: '{{comportamento_atual}}', desc: 'Comportamento anterior' },
      { v: '{{comportamento_ingressou}}', desc: 'Comportamento novo' },
      { v: '{{data_inclusao}}', desc: 'Data de inclusão do militar' },
    ]
  },
  'ELEVACAO_COMPORTAMENTO_DISCIPLINAR': {
    grupo: 'Elevação de Comportamento Disciplinar',
    cor: 'red',
    variaveis: [
      { v: '{{militar_nome}}', desc: 'Nome completo do militar' },
      { v: '{{posto_graduacao}}', desc: 'Posto/graduação do militar' },
      { v: '{{matricula}}', desc: 'Matrícula funcional' },
      { v: '{{quadro}}', desc: 'Quadro do militar' },
      { v: '{{unidade}}', desc: 'Unidade/Lotação principal' },
      { v: '{{comportamento_anterior}}', desc: 'Comportamento anterior no marco' },
      { v: '{{comportamento_novo}}', desc: 'Comportamento novo no marco' },
      { v: '{{comportamento_atual}}', desc: 'Comportamento atual do militar' },
      { v: '{{data_alteracao}}', desc: 'Data da elevação' },
      { v: '{{motivo_mudanca}}', desc: 'Motivo da elevação' },
      { v: '{{fundamento_legal}}', desc: 'Fundamento legal da elevação' },
    ],
  },
  'Ata JISO': {
    grupo: 'Ata JISO',
    cor: 'purple',
    variaveis: [
      { v: '{{posto_nome}}', desc: 'Posto/Graduação + QOBM' },
      { v: '{{nome_completo}}', desc: 'Nome completo' },
      { v: '{{matricula}}', desc: 'Matrícula' },
      { v: '{{finalidade_jiso}}', desc: 'Finalidade da JISO' },
      { v: '{{secao_jiso}}', desc: 'Seção JISO' },
      { v: '{{data_ata}}', desc: 'Data da ata' },
      { v: '{{nup}}', desc: 'NUP' },
      { v: '{{parecer_jiso}}', desc: 'Parecer da JISO' },
    ]
  },
  'Transcrição de Documentos': {
    grupo: 'Transcrição de Documentos',
    cor: 'teal',
    variaveis: [
      { v: '{{posto_nome}}', desc: 'Posto/Graduação + QOBM' },
      { v: '{{nome_completo}}', desc: 'Nome completo' },
      { v: '{{matricula}}', desc: 'Matrícula' },
      { v: '{{documento}}', desc: 'Nome do documento (ex: Ofício 001)' },
      { v: '{{data_documento}}', desc: 'Data do documento' },
      { v: '{{assunto}}', desc: 'Assunto do documento' },
    ]
  },
  'Homologação de Atestado': {
    grupo: 'Homologação de Atestado',
    cor: 'blue',
    variaveis: [
      { v: '{{posto_nome}}', desc: 'Posto/Graduação + QOBM' },
      { v: '{{nome_completo}}', desc: 'Nome completo' },
      { v: '{{matricula}}', desc: 'Matrícula' },
      { v: '{{dias}}', desc: 'Quantidade de dias' },
      { v: '{{dias_extenso}}', desc: 'Dias por extenso' },
      { v: '{{tipo_afastamento}}', desc: 'Tipo de afastamento' },
      { v: '{{data_inicio}}', desc: 'Data de início' },
      { v: '{{data_termino}}', desc: 'Data de término' },
    ]
  },
  'Apostila': {
    grupo: 'Apostila',
    cor: 'purple',
    variaveis: [
      { v: '{{posto_nome}}', desc: 'Posto/Graduação + QOBM' },
      { v: '{{nome_completo}}', desc: 'Nome completo' },
      { v: '{{matricula}}', desc: 'Matrícula' },
      { v: '{{numero_bg_ref}}', desc: 'Número do BG da publicação corrigida' },
      { v: '{{data_bg_ref}}', desc: 'Data do BG da publicação corrigida' },
      { v: '{{nota_ref}}', desc: 'Nota da publicação corrigida' },
      { v: '{{texto_errado}}', desc: 'Texto errado a ser corrigido' },
      { v: '{{texto_novo}}', desc: 'Novo texto correto' },
    ]
  },
  'Tornar sem Efeito': {
    grupo: 'Tornar sem Efeito',
    cor: 'orange',
    variaveis: [
      { v: '{{posto_nome}}', desc: 'Posto/Graduação + QOBM' },
      { v: '{{nome_completo}}', desc: 'Nome completo' },
      { v: '{{matricula}}', desc: 'Matrícula' },
      { v: '{{numero_bg_ref}}', desc: 'Número do BG da publicação tornada sem efeito' },
      { v: '{{data_bg_ref}}', desc: 'Data do BG da publicação tornada sem efeito' },
      { v: '{{nota_ref}}', desc: 'Nota da publicação tornada sem efeito' },
      { v: '{{tipo_ref}}', desc: 'Tipo da publicação tornada sem efeito' },
    ]
  },
};

const GRUPOS_GENERICOS_LIVRO = [
  { grupo: 'Militar (Geral)', cor: 'blue', variaveis: [
    { v: '{{posto_nome}}', desc: 'Posto/Graduação + QOBM' },
    { v: '{{posto}}', desc: 'Posto/Graduação Abreviado' },
    { v: '{{nome_completo}}', desc: 'Nome completo' },
    { v: '{{matricula}}', desc: 'Matrícula' },
    { v: '{{data_registro}}', desc: 'Data do registro' },
    { v: '{{data_inicio}}', desc: 'Data de início' },
    { v: '{{data_termino}}', desc: 'Data de término' },
    { v: '{{dias}}', desc: 'Dias' },
    { v: '{{dias_extenso}}', desc: 'Dias por extenso' },
  ]},
];
const GRUPOS_GENERICOS_EXOFFICIO = [
  { grupo: 'Militar (Geral)', cor: 'blue', variaveis: [
    { v: '{{posto_nome}}', desc: 'Posto/Graduação + QOBM' },
    { v: '{{posto}}', desc: 'Posto/Graduação Abreviado' },
    { v: '{{nome_completo}}', desc: 'Nome completo' },
    { v: '{{matricula}}', desc: 'Matrícula' },
    { v: '{{data_publicacao}}', desc: 'Data da publicação' },
  ]},
];

const COR_GRUPO = {
  blue: { box: 'bg-blue-50 border-blue-200', titulo: 'text-blue-700', badge: 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-600 hover:text-white hover:border-blue-600' },
  green: { box: 'bg-green-50 border-green-200', titulo: 'text-green-700', badge: 'bg-green-100 text-green-700 border-green-200 hover:bg-green-600 hover:text-white hover:border-green-600' },
  red: { box: 'bg-red-50 border-red-200', titulo: 'text-red-700', badge: 'bg-red-100 text-red-700 border-red-200 hover:bg-red-600 hover:text-white hover:border-red-600' },
  purple: { box: 'bg-purple-50 border-purple-200', titulo: 'text-purple-700', badge: 'bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-600 hover:text-white hover:border-purple-600' },
  orange: { box: 'bg-orange-50 border-orange-200', titulo: 'text-orange-700', badge: 'bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-600 hover:text-white hover:border-orange-600' },
  slate: { box: 'bg-slate-50 border-slate-200', titulo: 'text-slate-700', badge: 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-600 hover:text-white hover:border-slate-600' },
  teal: { box: 'bg-teal-50 border-teal-200', titulo: 'text-teal-700', badge: 'bg-teal-100 text-teal-700 border-teal-200 hover:bg-teal-600 hover:text-white hover:border-teal-600' },
};

export default function TemplatesTexto() {
  const queryClient = useQueryClient();
  const { canAccessAction, isLoading: loadingUser, isAccessResolved } = useCurrentUser();
  const canGerirTemplates = canAccessAction('gerir_templates');

  const [moduloFiltro, setModuloFiltro] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const textareaRef = useRef(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['templates-texto'],
    queryFn: () => base44.entities.TemplateTexto.list('-created_date'),
    enabled: isAccessResolved && canGerirTemplates,
  });
  const { data: estrutura = [] } = useQuery({
    queryKey: ['estrutura-organizacional-template'],
    queryFn: () => base44.entities.Subgrupamento.list(),
    enabled: isAccessResolved && canGerirTemplates,
  });

  const saveMutation = useMutation({
    mutationFn: (data) => {
      if (!canGerirTemplates) throw new Error('Ação negada: sem permissão para gerir templates.');
      const dadosNormalizados = normalizarEscopoTemplate(data);
      const erroEscopo = validarEscopoTemplate(dadosNormalizados);
      if (erroEscopo) throw new Error(erroEscopo);

      const templatesParaValidacao = [
        ...templates.filter((template) => template.id !== dadosNormalizados.id),
        { ...dadosNormalizados, modulo: serializeTemplateModulo(dadosNormalizados.modulo) },
      ];
      const conflitoTemplate = getConflitoTemplatePorTipo(data.tipo_registro, templatesParaValidacao);

      if (conflitoTemplate.temConflito) {
        throw new Error('Já existe template ativo para este tipo em outro módulo. Resolva o conflito antes de salvar.');
      }

      const chaveAtual = getChaveUnicidadeTemplate(dadosNormalizados);
      const duplicadoEscopo = templates.find((template) => (
        template.id !== dadosNormalizados.id &&
        getChaveUnicidadeTemplate(template) === chaveAtual
      ));
      if (duplicadoEscopo) {
        throw new Error('Já existe template ativo para esta combinação de módulo, tipo e escopo organizacional.');
      }

      const payload = buildTemplatePayload(dadosNormalizados);
      if (data.id) {
        return updateTemplate(data.id, payload);
      }

      return createTemplate(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates-texto'] });
      setShowForm(false);
      setEditingTemplate(null);
    },
    onError: (error) => {
      alert(error?.message || 'Falha ao salvar o template. Tente novamente.');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => {
      if (!canGerirTemplates) throw new Error('Ação negada: sem permissão para gerir templates.');
      return base44.entities.TemplateTexto.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates-texto'] });
      setConfirmDeleteId(null);
    },
    onError: (error) => {
      alert(error?.message || 'Falha ao excluir o template. Tente novamente.');
      setConfirmDeleteId(null);
    }
  });

  const conflitosPorTipo = useMemo(() => {
    return templates.reduce((acc, template) => {
      const tipo = template?.tipo_registro;
      if (!tipo) return acc;
      acc[tipo] = getConflitoTemplatePorTipo(tipo, templates);
      return acc;
    }, {});
  }, [templates]);

  const filtered = templates.filter(t => {
    if (isTipoOcultoNoFrontend(t?.tipo_registro)) return false;
    const matchesModulo = moduloFiltro === 'all' || normalizeTemplateModulo(t.modulo) === moduloFiltro;
    const tipoBusca = getTipoDisplay(t.tipo_registro || '');
    const matchesSearch = !searchTerm || 
      t.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.tipo_registro?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tipoBusca?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesModulo && matchesSearch;
  });

  const handleEdit = (t) => {
    setEditingTemplate(normalizeTemplateForForm(t));
    setShowForm(true);
  };

  const handleNew = () => {
    setEditingTemplate(createEmptyTemplateForm());
    setShowForm(true);
  };

  const moduloColor = {
    [MODULO_LIVRO]: 'bg-blue-100 text-blue-700',
    [MODULO_EX_OFFICIO]: 'bg-purple-100 text-purple-700',
  };

  const tiposRegistroOptions = useMemo(() => (
    RP_TIPOS_BASE
      .map((tipo) => ({ ...tipo, modulo: normalizeTemplateModulo(tipo.modulo) }))
      .sort((a, b) => getTipoDisplay(a.value).localeCompare(getTipoDisplay(b.value), 'pt-BR'))
  ), []);

  const tiposRegistroAgrupados = useMemo(() => {
    const optionsByValue = new Map(tiposRegistroOptions.map((tipo) => [tipo.value, tipo]));
    const grouped = [];
    const usedValues = new Set();

    TIPO_REGISTRO_CATEGORIAS.forEach((categoria) => {
      const options = categoria.tipos
        .map((tipo) => optionsByValue.get(tipo))
        .filter(Boolean);

      if (!options.length) return;

      options.forEach((option) => usedValues.add(option.value));
      grouped.push({ key: categoria.key, label: categoria.label, options });
    });

    const restantes = tiposRegistroOptions.filter((tipo) => !usedValues.has(tipo.value));
    if (restantes.length) {
      grouped.push({ key: 'outros', label: 'Outros', options: restantes });
    }

    return grouped;
  }, [tiposRegistroOptions]);

  const getModuloByTipoOption = (tipo) => {
    const option = tiposRegistroOptions.find((item) => item.value === tipo);
    return option?.modulo || '';
  };

  const setoresOptions = useMemo(
    () => estrutura.filter((item) => item?.tipo === 'Grupamento' || item?.nivel_hierarquico === 1),
    [estrutura]
  );

  const subsetoresOptions = useMemo(() => {
    if (!editingTemplate?.setor_id) return [];
    return estrutura.filter((item) =>
      (item?.tipo === 'Subgrupamento' || item?.nivel_hierarquico === 2) &&
      item?.grupamento_id === editingTemplate.setor_id
    );
  }, [estrutura, editingTemplate?.setor_id]);

  const unidadesOptions = useMemo(() => {
    if (!editingTemplate?.subsetor_id) return [];
    return estrutura.filter((item) =>
      item?.tipo === 'Unidade' &&
      item?.grupamento_id === editingTemplate.subsetor_id
    );
  }, [estrutura, editingTemplate?.subsetor_id]);

  const selectedTipoVars = editingTemplate?.tipo_registro && VARS_POR_TIPO[editingTemplate.tipo_registro];
  const estruturaById = useMemo(
    () => new Map((estrutura || []).map((item) => [item.id, item])),
    [estrutura]
  );

  const templateConflictError = useMemo(() => {
    if (!editingTemplate || editingTemplate.ativo === false || !editingTemplate.modulo || !editingTemplate.tipo_registro) {
      return null;
    }

    const erroEscopo = validarEscopoTemplate(editingTemplate);
    if (erroEscopo) return erroEscopo;

    const sameModuleConflict = templates.find(t =>
      normalizeTemplateModulo(t.modulo) === normalizeTemplateModulo(editingTemplate.modulo) &&
      t.tipo_registro === editingTemplate.tipo_registro &&
      t.ativo !== false &&
      t.id !== editingTemplate.id
    );

    if (sameModuleConflict) {
      return `Já existe um template ativo para '${getTipoDisplay(editingTemplate.tipo_registro)}' no módulo '${getModuloDisplay(editingTemplate.modulo)}'. Desative ou edite o template existente antes de ativar este.`;
    }

    const templatesParaValidacao = [
      ...templates.filter(t => t.id !== editingTemplate.id),
      { ...editingTemplate, modulo: serializeTemplateModulo(editingTemplate.modulo) },
    ];
    const conflitoGlobal = getConflitoTemplatePorTipo(editingTemplate.tipo_registro, templatesParaValidacao);

    if (conflitoGlobal.temConflito) {
      return 'Já existe template ativo para este tipo em outro módulo. Resolva o conflito antes de salvar.';
    }

    const chaveAtual = getChaveUnicidadeTemplate(editingTemplate);
    const conflitoEscopo = templates.find((t) =>
      t.id !== editingTemplate.id &&
      getChaveUnicidadeTemplate(t) === chaveAtual
    );
    if (conflitoEscopo) {
      return 'Já existe template ativo para esta combinação de módulo, tipo e escopo.';
    }

    return null;
  }, [editingTemplate, templates]);

  const getVariaveisValidas = (modulo, tipo) => {
    if (!modulo || !tipo) return new Set();

    const validas = new Set();
    const moduloNormalizado = normalizeTemplateModulo(modulo);
    const genericos = moduloNormalizado === MODULO_LIVRO ? GRUPOS_GENERICOS_LIVRO : moduloNormalizado === MODULO_EX_OFFICIO ? GRUPOS_GENERICOS_EXOFFICIO : [];
    genericos.forEach(g => g.variaveis.forEach(v => validas.add(v.v.replace(/^\{\{/, '').replace(/\}\}$/, ''))));

    if (VARS_POR_TIPO[tipo]) {
      VARS_POR_TIPO[tipo].variaveis.forEach(v => validas.add(v.v.replace(/^\{\{/, '').replace(/\}\}$/, '')));
    }

    return validas;
  };

  const variaveisUsadas = useMemo(() => {
    return extrairVariaveisDoTemplate(editingTemplate?.template || '');
  }, [editingTemplate?.template]);

  const variaveisValidas = useMemo(() => {
    return getVariaveisValidas(editingTemplate?.modulo, editingTemplate?.tipo_registro);
  }, [editingTemplate?.modulo, editingTemplate?.tipo_registro]);

  const variaveisInvalidas = useMemo(() => {
    if (!editingTemplate?.tipo_registro) return [];
    return variaveisUsadas.filter(v => !variaveisValidas.has(v));
  }, [variaveisUsadas, variaveisValidas, editingTemplate?.tipo_registro]);

  const handleSaveTemplate = () => {
    if (!editingTemplate) return;
    if (templateConflictError || variaveisInvalidas.length > 0) return;
    saveMutation.mutate(editingTemplate);
  };

  const inserirVarNoTextarea = (ref, field, value) => {
    const textArea = ref.current;

    if (textArea) {
      const start = textArea.selectionStart ?? 0;
      const end = textArea.selectionEnd ?? 0;
      const textoAtual = editingTemplate?.[field] || '';
      const newText = textoAtual.substring(0, start) + value + textoAtual.substring(end);

      setEditingTemplate((prev) => ({ ...prev, [field]: newText }));

      setTimeout(() => {
        textArea.focus();
        textArea.selectionStart = start + value.length;
        textArea.selectionEnd = start + value.length;
      }, 0);
      return;
    }

    setEditingTemplate((prev) => ({ ...prev, [field]: `${prev?.[field] || ''}${value}` }));
  };

  const inserirVarTemplatePrincipal = (value) => inserirVarNoTextarea(textareaRef, 'template', value);

  if (loadingUser || !isAccessResolved) return null;
  if (!canGerirTemplates) return <AccessDenied modulo="Templates de Texto" />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[#1e3a5f]">Templates de Texto</h1>
            <p className="text-slate-500">Padrões de texto para publicações — editáveis por tipo/módulo</p>
          </div>
          <Button onClick={handleNew} className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white">
            <Plus className="w-4 h-4 mr-2" /> Novo Template
          </Button>
        </div>

        <Card className="mb-6 border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-1">Como funcionam os templates</p>
                <p>Use variáveis entre chaves duplas para dados dinâmicos. Exemplo: <code className="bg-blue-100 px-1 rounded">{'{{nome_completo}}'}</code>, <code className="bg-blue-100 px-1 rounded">{'{{dias}}'}</code>.</p>
                <p className="mt-1">Quando um template está cadastrado para um tipo de registro, ele é usado como base — os dados do registro preenchem as variáveis automaticamente.</p>
                <p className="mt-1">Nas férias, o usuário verá sempre <strong>Início</strong>, <strong>Interrupção</strong>, <strong>Continuação</strong> e <strong>Término</strong>, mas o sistema continuará salvando os tipos canônicos internamente.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 mb-6 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Input
              placeholder="Buscar por nome ou tipo..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-4 h-10 border-slate-200"
            />
          </div>
          <Select value={moduloFiltro} onValueChange={setModuloFiltro}>
            <SelectTrigger className="w-48 h-10 border-slate-200">
              <SelectValue placeholder="Módulo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Módulos</SelectItem>
              {Object.entries(MODULO_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-12 text-center">
            <FileText className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500">Nenhum template encontrado. Crie o primeiro!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(t => {
              const templateEmConflito = conflitosPorTipo[t.tipo_registro]?.temConflito;

              return (
              <div
                key={t.id}
                className={`rounded-xl p-4 shadow-sm border ${
                  templateEmConflito
                    ? 'border-red-300 bg-red-50/40'
                    : 'border-slate-100 bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-slate-800">{t.nome}</span>
                      <Badge className={moduloColor[normalizeTemplateModulo(t.modulo)] || 'bg-slate-100 text-slate-700'}>{getModuloDisplay(t.modulo)}</Badge>
                      <Badge variant="secondary" className="text-xs">{getEscopoLabel(t.escopo)}</Badge>
                      <Badge variant="outline" className="text-xs">{getTipoDisplay(t.tipo_registro)}</Badge>
                      {isLivroFeriasTipo(t.tipo_registro) && (
                        <Badge className="bg-slate-100 text-slate-600 text-[10px]">{t.tipo_registro}</Badge>
                      )}
                      {templateEmConflito && (
                        <Badge className="bg-red-600 text-white">Conflito</Badge>
                      )}
                      {!t.ativo && <Badge className="bg-red-100 text-red-600">Inativo</Badge>}
                    </div>
                    {t.escopo !== ESCOPO_TEMPLATE.GLOBAL && (
                      <p className="text-xs text-slate-500">
                        {t.escopo === ESCOPO_TEMPLATE.SETOR && `Setor: ${estruturaById.get(t.setor_id)?.nome || 'Não informado'}`}
                        {t.escopo === ESCOPO_TEMPLATE.SUBSETOR && `Setor: ${estruturaById.get(t.setor_id)?.nome || 'Não informado'} · Subsetor: ${estruturaById.get(t.subsetor_id)?.nome || 'Não informado'}`}
                        {t.escopo === ESCOPO_TEMPLATE.UNIDADE && `Setor: ${estruturaById.get(t.setor_id)?.nome || 'Não informado'} · Subsetor: ${estruturaById.get(t.subsetor_id)?.nome || 'Não informado'} · Unidade: ${estruturaById.get(t.unidade_id)?.nome || 'Não informado'}`}
                      </p>
                    )}
                    <p className="text-sm text-slate-500 line-clamp-2 mt-1">{t.template}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-[#1e3a5f]" onClick={() => handleEdit(t)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600" onClick={() => setConfirmDeleteId(t.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )})}
          </div>
        )}
      </div>

      <AlertDialog open={!!confirmDeleteId} onOpenChange={(v) => { if (!v) setConfirmDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Template</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este template? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate(confirmDeleteId)}
            >
              {deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showForm} onOpenChange={(v) => { if (!v) { setShowForm(false); setEditingTemplate(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#1e3a5f]">
              {editingTemplate?.id ? 'Editar Template' : 'Novo Template'}
            </DialogTitle>
          </DialogHeader>

          {editingTemplate && (
            <div className="space-y-4 py-2">
              {editingTemplate.template && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Eye className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-semibold text-emerald-700">Prévia com dados simulados</span>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {(() => {
                      const textoPreview = aplicarTemplate(editingTemplate.template, VARS_PREVIEW);
                      const regex = /\{\{([^}]+)\}\}/g;
                      const parts = [];
                      let lastIndex = 0;
                      let match;
                      let k = 0;

                      while ((match = regex.exec(textoPreview)) !== null) {
                        parts.push(textoPreview.substring(lastIndex, match.index));
                        const varName = match[1].trim();
                        if (variaveisInvalidas.includes(varName)) {
                          parts.push(<span key={k++} className="bg-red-200 text-red-800 px-1 rounded font-mono font-bold" title="Variável inválida">{match[0]}</span>);
                        } else {
                          parts.push(<span key={k++} className="bg-amber-200 text-amber-900 px-1 rounded font-mono" title="Sem valor de demonstração">{match[0]}</span>);
                        }
                        lastIndex = regex.lastIndex;
                      }
                      parts.push(textoPreview.substring(lastIndex));

                      return parts;
                    })()}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">Módulo</Label>
                  <Input
                    value={editingTemplate.modulo ? getModuloDisplay(editingTemplate.modulo) : 'Será definido automaticamente pelo tipo de registro'}
                    readOnly
                    className="mt-1.5 bg-slate-50 text-slate-600"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">Tipo de Registro <span className="text-red-500">*</span></Label>
                  <Select
                    value={editingTemplate.tipo_registro}
                    onValueChange={v => setEditingTemplate(p => ({ ...p, tipo_registro: v, modulo: getModuloByTipoOption(v) }))}
                  >
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {tiposRegistroAgrupados.map((grupo, groupIndex) => (
                        <React.Fragment key={grupo.key}>
                          {groupIndex > 0 && <SelectSeparator />}
                          <SelectGroup>
                            <SelectLabel>{grupo.label}</SelectLabel>
                            {grupo.options.map((tipo) => (
                              <SelectItem key={tipo.value} value={tipo.value}>
                                {getTipoSelectLabel(tipo.modulo, tipo.value)}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </React.Fragment>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">Escopo <span className="text-red-500">*</span></Label>
                  <Select
                    value={editingTemplate.escopo || ESCOPO_TEMPLATE.GLOBAL}
                    onValueChange={(v) => setEditingTemplate((p) => normalizarEscopoTemplate({ ...p, escopo: v }))}
                  >
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ESCOPO_OPTIONS.map((op) => (
                        <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {(editingTemplate.escopo === ESCOPO_TEMPLATE.SETOR || editingTemplate.escopo === ESCOPO_TEMPLATE.SUBSETOR || editingTemplate.escopo === ESCOPO_TEMPLATE.UNIDADE) && (
                <div>
                  <Label className="text-sm font-medium text-slate-700">Setor <span className="text-red-500">*</span></Label>
                  <Select
                    value={editingTemplate.setor_id || ''}
                    onValueChange={(v) => setEditingTemplate((p) => normalizarEscopoTemplate({ ...p, setor_id: v, subsetor_id: '', unidade_id: '' }))}
                  >
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione o setor..." /></SelectTrigger>
                    <SelectContent>
                      {setoresOptions.map((setor) => (
                        <SelectItem key={setor.id} value={setor.id}>{setor.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {(editingTemplate.escopo === ESCOPO_TEMPLATE.SUBSETOR || editingTemplate.escopo === ESCOPO_TEMPLATE.UNIDADE) && (
                <div>
                  <Label className="text-sm font-medium text-slate-700">Subsetor <span className="text-red-500">*</span></Label>
                  <Select
                    value={editingTemplate.subsetor_id || ''}
                    onValueChange={(v) => setEditingTemplate((p) => normalizarEscopoTemplate({ ...p, subsetor_id: v, unidade_id: '' }))}
                    disabled={!editingTemplate.setor_id}
                  >
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione o subsetor..." /></SelectTrigger>
                    <SelectContent>
                      {subsetoresOptions.map((subsetor) => (
                        <SelectItem key={subsetor.id} value={subsetor.id}>{subsetor.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {editingTemplate.escopo === ESCOPO_TEMPLATE.UNIDADE && (
                <div>
                  <Label className="text-sm font-medium text-slate-700">Unidade <span className="text-red-500">*</span></Label>
                  <Select
                    value={editingTemplate.unidade_id || ''}
                    onValueChange={(v) => setEditingTemplate((p) => ({ ...p, unidade_id: v }))}
                    disabled={!editingTemplate.subsetor_id}
                  >
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione a unidade..." /></SelectTrigger>
                    <SelectContent>
                      {unidadesOptions.map((unidade) => (
                        <SelectItem key={unidade.id} value={unidade.id}>{unidade.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {normalizeTemplateModulo(editingTemplate.modulo) === MODULO_LIVRO && isLivroFeriasTipo(editingTemplate.tipo_registro) && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                  Este template será exibido ao usuário como <strong>{getTipoDisplay(editingTemplate.tipo_registro)}</strong>, mas será salvo internamente como <strong>{editingTemplate.tipo_registro}</strong> para manter compatibilidade com o sistema.
                </div>
              )}

              <div>
                <Label className="text-sm font-medium text-slate-700">Nome do Template <span className="text-red-500">*</span></Label>
                <Input value={editingTemplate.nome} onChange={e => setEditingTemplate(p => ({ ...p, nome: e.target.value }))} className="mt-1.5" placeholder="Ex: Início de Férias Padrão" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="text-sm font-medium text-slate-700">Texto do Template <span className="text-red-500">*</span></Label>
                </div>
                <Textarea
                ref={textareaRef}
                  value={editingTemplate.template}
                  onChange={e => setEditingTemplate(p => ({ ...p, template: e.target.value }))}
                  rows={8}
                  className={`font-mono text-sm ${variaveisInvalidas.length > 0 ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                  placeholder="Digite o texto do template. Use {{variavel}} para dados dinâmicos."
                />
              </div>

              {variaveisInvalidas.length > 0 && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-semibold block mb-1">Variáveis não reconhecidas neste template:</span>
                    <ul className="list-disc pl-4 space-y-0.5">
                      {variaveisInvalidas.map((v, i) => (
                        <li key={i} className="font-mono">{`{{${v}}}`}</li>
                      ))}
                    </ul>
                    <span className="block mt-2 text-xs">As variáveis acima não são suportadas para este tipo de registro. Remova-as ou corrija a digitação para poder salvar.</span>
                  </div>
                </div>
              )}

              {(() => {
                const gruposParaMostrar = selectedTipoVars
                  ? [selectedTipoVars]
                  : (normalizeTemplateModulo(editingTemplate.modulo) === MODULO_LIVRO ? GRUPOS_GENERICOS_LIVRO : normalizeTemplateModulo(editingTemplate.modulo) === MODULO_EX_OFFICIO ? GRUPOS_GENERICOS_EXOFFICIO : []);

                if (gruposParaMostrar.length === 0) return null;

                return (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-600">
                      {selectedTipoVars ? `Variáveis para "${getTipoDisplay(editingTemplate.tipo_registro)}" (clique para inserir):` : 'Selecione um tipo para ver as variáveis específicas:'}
                    </p>
                    {gruposParaMostrar.map(g => {
                      const cores = COR_GRUPO[g.cor] || COR_GRUPO['blue'];
                      return (
                        <div key={g.grupo} className={`rounded-lg p-3 border ${cores.box}`}>
                          <p className={`text-xs font-bold mb-2 ${cores.titulo}`}>{g.grupo}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {g.variaveis.map(({ v, desc }) => (
                              <button
                                key={v}
                                type="button"
                                title={desc}
                                onClick={() => inserirVarTemplatePrincipal(v)}
                                className={`text-xs border rounded px-2 py-0.5 font-mono transition-colors ${cores.badge}`}
                              >
                                {v}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              <div className="flex items-center gap-2">
                <input type="checkbox" id="ativo" checked={editingTemplate.ativo !== false} onChange={e => setEditingTemplate(p => ({ ...p, ativo: e.target.checked }))} className="w-4 h-4" />
                <Label htmlFor="ativo" className="text-sm text-slate-700 cursor-pointer">Template ativo</Label>
              </div>

              {templateConflictError && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex gap-2 mt-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{templateConflictError}</span>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <Button variant="outline" onClick={() => { setShowForm(false); setEditingTemplate(null); }} disabled={saveMutation.isPending}>
              Cancelar
            </Button>
                <Button
                  onClick={handleSaveTemplate}
                  disabled={saveMutation.isPending || !editingTemplate.nome || !editingTemplate.tipo_registro || !editingTemplate.template || !!templateConflictError || variaveisInvalidas.length > 0}
                  className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white"
                >
                  {saveMutation.isPending ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  ) : <Save className="w-4 h-4 mr-2" />}
                  Salvar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
