import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Award, Edit, History, Loader2, Plus, Search, Settings, ShieldAlert, Trash2, Users } from 'lucide-react';

import AccessDenied from '@/components/auth/AccessDenied';
import MilitarSelector from '@/components/atestado/MilitarSelector';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import { Switch } from '@/components/ui/switch';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import {
  COTA_STATUS,
  GRATIFICACAO_STATUS,
  GRATIFICACAO_STATUS_LABELS,
  GRATIFICACAO_TABS,
  GRATIFICACAO_TAB_LABELS,
  STATUS_PENDENTES,
  aplicarFiltrosGratificacoesFuncao,
  calcularResumoGratificacoesFuncao,
  fetchPainelGratificacoesFuncao,
  filtrarGratificacoesPorAba,
  gerirCadastrosGratificacaoFuncao,
  gerirRascunhoGratificacaoFuncao,
  getMatriculaGratificacao,
  getNomeMilitarGratificacao,
  listarOpcoesGratificacao,
  deletarGratificacao,
} from '@/services/gratificacoesFuncaoService';

const TODOS = 'todos';
const TIPO_FORM_DEFAULT = { nome: '', sigla: '', codigo: '', nivel: '', descricao: '', ativo: true, observacoes: '' };
const COTA_FORM_DEFAULT = {
  tipo_gratificacao_funcao_id: '', funcao_gratificada: '', codigo_funcao: '', nivel_gratificacao: '', tipo_gratificacao: '', unidade_id: '', unidade_nome_snapshot: '', setor_id: '', setor_nome_snapshot: '', quantidade_autorizada: 1, data_inicio_vigencia: '', data_fim_vigencia: '', ato_autorizativo: '', doems_autorizacao_numero: '', doems_autorizacao_edicao: '', doems_autorizacao_link: '', status: COTA_STATUS.ATIVA, observacoes: '',
};

const STATUS_BADGE = {
  [GRATIFICACAO_STATUS.RASCUNHO]: 'border-slate-200 bg-slate-50 text-slate-700',
  [GRATIFICACAO_STATUS.SOLICITADO_DP]: 'border-blue-200 bg-blue-50 text-blue-700',
  [GRATIFICACAO_STATUS.AGUARDANDO_PUBLICACAO_NOMEACAO]: 'border-amber-200 bg-amber-50 text-amber-700',
  [GRATIFICACAO_STATUS.NOMEADO_ATIVO]: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  [GRATIFICACAO_STATUS.DISPENSA_SOLICITADA]: 'border-orange-200 bg-orange-50 text-orange-700',
  [GRATIFICACAO_STATUS.AGUARDANDO_PUBLICACAO_DISPENSA]: 'border-purple-200 bg-purple-50 text-purple-700',
  [GRATIFICACAO_STATUS.DISPENSADO]: 'border-slate-200 bg-white text-slate-600',
  [GRATIFICACAO_STATUS.CANCELADO]: 'border-red-200 bg-red-50 text-red-700',
};

const COTA_STATUS_LABELS = { ativa: 'Ativa', suspensa: 'Suspensa', encerrada: 'Encerrada' };
const CARD_CONFIG = [
  { key: 'ativas', title: 'Gratificações Ativas', icon: Award, tone: 'bg-emerald-600' },
  { key: 'finalizadas', title: 'Finalizadas', icon: History, tone: 'bg-blue-500' },
  { key: 'canceladas', title: 'Canceladas', icon: ShieldAlert, tone: 'bg-red-500' },
  { key: 'total', title: 'Total', icon: Users, tone: 'bg-slate-500' },
];
const TAB_KEYS = [GRATIFICACAO_TABS.ATIVAS, GRATIFICACAO_TABS.HISTORICO, GRATIFICACAO_TABS.CONFIGURACOES];
const ADMIN_PERMISSION_SENTINELS = new Set(['ALL', 'all', '*']);

function hasAllPermissions(permissions) {
  if (ADMIN_PERMISSION_SENTINELS.has(permissions)) return true;
  if (!permissions || typeof permissions !== 'object') return false;
  return ADMIN_PERMISSION_SENTINELS.has(permissions.permissions) || permissions.ALL === true || permissions.all === true || permissions['*'] === true;
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR');
}

function CounterCard({ title, value, icon: Icon, tone }) {
  return <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className={`absolute inset-y-0 left-0 w-1.5 ${tone}`} /><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p><p className="mt-2 text-3xl font-bold leading-none text-slate-950">{value ?? 0}</p></div><div className="rounded-xl bg-slate-100 p-2 text-slate-600"><Icon className="h-5 w-5" /></div></div></div>;
}

function StatusBadge({ status }) {
  return <Badge variant="outline" className={`${STATUS_BADGE[status] || STATUS_BADGE[GRATIFICACAO_STATUS.RASCUNHO]} rounded-full px-2.5 py-1`}>{GRATIFICACAO_STATUS_LABELS[status] || status || '—'}</Badge>;
}

function EmptyState({ message = 'Nenhum registro encontrado para os filtros atuais.' }) {
  return <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center"><Award className="h-10 w-10 text-slate-300" /><h3 className="mt-3 text-base font-semibold text-slate-800">Sem dados para exibir</h3><p className="mt-1 max-w-md text-sm text-slate-500">{message}</p></div>;
}

function Field({ label, children, className = '' }) {
  return <div className={className}><Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</Label>{children}</div>;
}

function GratificacoesTable({ gratificacoes, tipos, canManageGratificacoes = false, modoAdmin = false, onEditRascunho, onEnviarDP, onAguardandoPublicacao, onRegistrarPublicacao, onFinalizar, onExcluir }) {
  const tiposById = useMemo(() => new Map((tipos || []).map((tipo) => [String(tipo?.id || ''), tipo?.nome || tipo?.sigla || tipo?.codigo || ''])), [tipos]);
  if (!gratificacoes.length) return <EmptyState />;
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-200 text-sm"><thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Militar</th><th className="px-4 py-3">Função</th><th className="px-4 py-3">Unidade</th><th className="px-4 py-3">Publicação / processo</th><th className="px-4 py-3">Efeitos</th><th className="px-4 py-3">Status</th>{canManageGratificacoes && <th className="px-4 py-3 text-right">Ações</th>}</tr></thead><tbody className="divide-y divide-slate-100">{gratificacoes.map((item) => <tr key={item.id} className="align-top hover:bg-slate-50/80"><td className="min-w-[14rem] px-4 py-4"><p className="font-semibold text-slate-900">{getNomeMilitarGratificacao(item)}</p><p className="text-xs text-slate-500">{item.posto_graduacao_snapshot || 'Posto/graduação não informado'} · Mat. {getMatriculaGratificacao(item)}</p></td><td className="min-w-[13rem] px-4 py-4"><p className="font-medium text-slate-900">{item.funcao_gratificada || '—'}</p><p className="text-xs text-slate-500">{item.codigo_funcao || 'Código não informado'}</p></td><td className="min-w-[12rem] px-4 py-4"><p className="font-medium text-slate-900">{item.unidade_nome_snapshot || '—'}</p></td><td className="min-w-[14rem] px-4 py-4"><p className="font-medium text-slate-900">{item.doems_nomeacao_numero || item.doems_dispensa_numero || item.ato_nomeacao_numero || item.ato_dispensa_numero || '—'}</p><p className="text-xs text-slate-500">{item.numero_processo || item.documento_solicitacao || 'Processo/documento não informado'}</p></td><td className="min-w-[10rem] px-4 py-4 text-xs text-slate-600"><p>Início: <span className="font-medium text-slate-800">{formatDate(item.data_inicio_efeitos || item.data_publicacao_nomeacao || item.data_solicitacao)}</span></p><p>Fim: <span className="font-medium text-slate-800">{formatDate(item.data_fim_efeitos || item.data_publicacao_dispensa)}</span></p></td><td className="px-4 py-4"><StatusBadge status={item.status} /></td>{canManageGratificacoes && <td className="px-4 py-4 text-right">
  <div className="flex justify-end gap-2">
  {modoAdmin && (
    <Button type="button" variant="outline" size="sm" className="text-red-600 border-red-200 bg-red-50 hover:bg-red-100" onClick={() => onExcluir(item)}>
      <Trash2 className="h-3.5 w-3.5" /> Excluir
    </Button>
  )}
  {item.status === GRATIFICACAO_STATUS.RASCUNHO ? (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => onEditRascunho(item)}><Edit className="h-3.5 w-3.5" /> Editar</Button>
      <Button type="button" variant="outline" size="sm" className="text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100 hover:text-blue-700" onClick={() => onEnviarDP(item)}>Enviar à DP</Button>
    </>
  ) : item.status === GRATIFICACAO_STATUS.SOLICITADO_DP ? (
    <Button type="button" variant="outline" size="sm" className="text-amber-600 border-amber-200 bg-amber-50 hover:bg-amber-100 hover:text-amber-700" onClick={() => onAguardandoPublicacao(item)}>Aguardando Publicação</Button>
  ) : item.status === GRATIFICACAO_STATUS.AGUARDANDO_PUBLICACAO_NOMEACAO ? (
    <Button type="button" variant="outline" size="sm" className="text-emerald-600 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-700" onClick={() => onRegistrarPublicacao(item)}>Registrar Publicação</Button>
  ) : item.status === GRATIFICACAO_STATUS.NOMEADO_ATIVO ? (
    <Button type="button" variant="outline" size="sm" className="text-red-600 border-red-200 bg-red-50 hover:bg-red-100 hover:text-red-700" onClick={() => onFinalizar(item)}>Finalizar</Button>
  ) : (
    !modoAdmin && <span className="text-xs text-slate-400">—</span>
  )}
  </div>
</td>}</tr>)}</tbody></table></div></div>
  );
}

function CotasTable({ cotas, canManage, onEdit }) {
  if (!cotas.length) return <EmptyState message="Nenhuma cota cadastrada para os filtros atuais." />;
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-200 text-sm"><thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Função</th><th className="px-4 py-3">Unidade</th><th className="px-4 py-3">Autorizadas</th><th className="px-4 py-3">Ato / DOEMS</th><th className="px-4 py-3">Vigência</th><th className="px-4 py-3">Status</th>{canManage && <th className="px-4 py-3 text-right">Ações</th>}</tr></thead><tbody className="divide-y divide-slate-100">{cotas.map((cota) => <tr key={cota.id} className="align-top hover:bg-slate-50/80"><td className="px-4 py-4"><p className="font-semibold text-slate-900">{cota.funcao_gratificada || '—'}</p><p className="text-xs text-slate-500">{cota.codigo_funcao || 'Código não informado'}</p></td><td className="px-4 py-4"><p className="font-medium text-slate-900">{cota.unidade_nome_snapshot || '—'}</p></td><td className="px-4 py-4 text-base font-bold text-slate-950">{cota.quantidade_autorizada || 0}</td><td className="px-4 py-4"><p className="font-medium text-slate-900">{cota.ato_autorizativo || '—'}</p><p className="text-xs text-slate-500">{cota.doems_autorizacao_numero || cota.doems_autorizacao_edicao || 'DOEMS não informado'}</p></td><td className="px-4 py-4 text-xs text-slate-600"><p>{formatDate(cota.data_inicio_vigencia)}</p><p>{formatDate(cota.data_fim_vigencia)}</p></td><td className="px-4 py-4"><Badge variant="outline" className="rounded-full bg-slate-50 px-2.5 py-1 text-slate-700">{COTA_STATUS_LABELS[cota.status] || cota.status || '—'}</Badge></td>{canManage && <td className="px-4 py-4 text-right"><Button type="button" variant="outline" size="sm" onClick={() => onEdit(cota)}><Edit className="h-3.5 w-3.5" /> Editar</Button></td>}</tr>)}</tbody></table></div></div>
  );
}

function TiposTable({ tipos, canManage, onEdit }) {
  if (!tipos.length) return <EmptyState message="Nenhum tipo de gratificação cadastrado." />;
  return <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{tipos.map((tipo) => <div key={tipo.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-base font-semibold text-slate-900">{tipo.nome || 'Tipo sem nome'}</p><p className="mt-1 text-xs text-slate-500">{tipo.sigla || tipo.codigo || 'Sem sigla/código'}</p></div><Badge variant="outline" className={tipo.ativo === false ? 'border-slate-200 bg-slate-50 text-slate-600' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}>{tipo.ativo === false ? 'Inativo' : 'Ativo'}</Badge></div><p className="mt-3 text-sm text-slate-600">{tipo.descricao || 'Sem descrição informada.'}</p><p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500">Nível: {tipo.nivel || 'não informado'}</p>{tipo.observacoes && <p className="mt-2 text-xs text-slate-500">{tipo.observacoes}</p>}{canManage && <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => onEdit(tipo)}><Edit className="h-3.5 w-3.5" /> Editar tipo</Button>}</div>)}</div>;
}

function TipoModal({ open, onOpenChange, initialData, onSubmit, saving }) {
  const isEditing = Boolean(initialData?.id);
  const [form, setForm] = useState({ ...TIPO_FORM_DEFAULT, ...(initialData || {}) });
  React.useEffect(() => { if (open) setForm({ ...TIPO_FORM_DEFAULT, ...(initialData || {}) }); }, [open, initialData]);
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>{isEditing ? 'Editar tipo de gratificação' : 'Novo tipo de gratificação'}</DialogTitle><DialogDescription>Cadastro administrativo do catálogo. Tipos inativos não são oferecidos como padrão para novas cotas.</DialogDescription></DialogHeader><div className="grid max-h-[70vh] grid-cols-1 gap-3 overflow-y-auto pr-1 md:grid-cols-2"><Field label="Nome *"><Input value={form.nome} onChange={(e) => update('nome', e.target.value)} /></Field><Field label="Sigla"><Input value={form.sigla} onChange={(e) => update('sigla', e.target.value)} /></Field><Field label="Código"><Input value={form.codigo} onChange={(e) => update('codigo', e.target.value)} /></Field><Field label="Nível"><Input value={form.nivel} onChange={(e) => update('nivel', e.target.value)} /></Field><Field label="Situação"><Select value={form.ativo === false ? 'false' : 'true'} onValueChange={(v) => update('ativo', v === 'true')}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="true">Ativo</SelectItem><SelectItem value="false">Inativo</SelectItem></SelectContent></Select></Field><Field label="Descrição" className="md:col-span-2"><Textarea value={form.descricao} onChange={(e) => update('descricao', e.target.value)} /></Field><Field label="Observações" className="md:col-span-2"><Textarea value={form.observacoes} onChange={(e) => update('observacoes', e.target.value)} /></Field></div><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="button" disabled={saving} onClick={() => onSubmit(form)}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar tipo</Button></DialogFooter></DialogContent></Dialog>;
}

function CotaModal({ open, onOpenChange, initialData, tipos, onSubmit, saving }) {
  const isEditing = Boolean(initialData?.id);
  const isEncerrada = initialData?.status === COTA_STATUS.ENCERRADA;
  const [form, setForm] = useState({ ...COTA_FORM_DEFAULT, ...(initialData || {}) });
  React.useEffect(() => { if (open) setForm({ ...COTA_FORM_DEFAULT, ...(initialData || {}) }); }, [open, initialData]);
  const tiposAtivos = useMemo(() => (tipos || []).filter((tipo) => tipo.ativo !== false), [tipos]);
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const selectTipo = (value) => { const normalizedValue = value === 'sem_tipo' ? '' : value; const selected = (tipos || []).find((tipo) => String(tipo.id) === normalizedValue); setForm((current) => ({ ...current, tipo_gratificacao_funcao_id: normalizedValue, tipo_gratificacao: selected?.nome || current.tipo_gratificacao, nivel_gratificacao: current.nivel_gratificacao || selected?.nivel || '' })); };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-4xl"><DialogHeader><DialogTitle>{isEditing ? 'Editar cota de gratificação' : 'Nova cota de gratificação'}</DialogTitle><DialogDescription>{isEncerrada ? 'Cota encerrada: edição livre bloqueada; ajuste apenas observações e metadados de autorização.' : 'Cadastro administrativo da cota. A ocupação permanece calculada pelas functions de leitura, sem campo manual.'}</DialogDescription></DialogHeader><div className="grid max-h-[70vh] grid-cols-1 gap-3 overflow-y-auto pr-1 md:grid-cols-3"><Field label="Tipo ativo"><Select value={form.tipo_gratificacao_funcao_id || 'sem_tipo'} onValueChange={selectTipo} disabled={isEncerrada}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent><SelectItem value="sem_tipo">Sem vínculo</SelectItem>{tiposAtivos.map((tipo) => <SelectItem key={tipo.id} value={String(tipo.id)}>{tipo.nome || tipo.sigla || tipo.codigo}</SelectItem>)}</SelectContent></Select></Field><Field label="Função gratificada *" className="md:col-span-2"><Input value={form.funcao_gratificada} disabled={isEncerrada} onChange={(e) => update('funcao_gratificada', e.target.value)} /></Field><Field label="Código função"><Input value={form.codigo_funcao} disabled={isEncerrada} onChange={(e) => update('codigo_funcao', e.target.value)} /></Field><Field label="Nível"><Input value={form.nivel_gratificacao} disabled={isEncerrada} onChange={(e) => update('nivel_gratificacao', e.target.value)} /></Field><Field label="Tipo textual"><Input value={form.tipo_gratificacao} disabled={isEncerrada} onChange={(e) => update('tipo_gratificacao', e.target.value)} /></Field><Field label="Unidade ID"><Input value={form.unidade_id} disabled={isEncerrada} onChange={(e) => update('unidade_id', e.target.value)} /></Field><Field label="Unidade snapshot"><Input value={form.unidade_nome_snapshot} disabled={isEncerrada} onChange={(e) => update('unidade_nome_snapshot', e.target.value)} /></Field><Field label="Setor ID"><Input value={form.setor_id} disabled={isEncerrada} onChange={(e) => update('setor_id', e.target.value)} /></Field><Field label="Setor snapshot"><Input value={form.setor_nome_snapshot} disabled={isEncerrada} onChange={(e) => update('setor_nome_snapshot', e.target.value)} /></Field><Field label="Quantidade autorizada *"><Input type="number" min="1" value={form.quantidade_autorizada} disabled={isEncerrada} onChange={(e) => update('quantidade_autorizada', e.target.value)} /></Field><Field label="Status *"><Select value={form.status} onValueChange={(v) => update('status', v)} disabled={isEncerrada}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(COTA_STATUS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></Field><Field label="Início vigência"><Input type="date" value={form.data_inicio_vigencia || ''} disabled={isEncerrada} onChange={(e) => update('data_inicio_vigencia', e.target.value)} /></Field><Field label="Fim vigência"><Input type="date" value={form.data_fim_vigencia || ''} disabled={isEncerrada} onChange={(e) => update('data_fim_vigencia', e.target.value)} /></Field><Field label="Ato autorizativo"><Input value={form.ato_autorizativo} onChange={(e) => update('ato_autorizativo', e.target.value)} /></Field><Field label="DOEMS número"><Input value={form.doems_autorizacao_numero} onChange={(e) => update('doems_autorizacao_numero', e.target.value)} /></Field><Field label="DOEMS edição"><Input value={form.doems_autorizacao_edicao} onChange={(e) => update('doems_autorizacao_edicao', e.target.value)} /></Field><Field label="DOEMS link" className="md:col-span-3"><Input value={form.doems_autorizacao_link} onChange={(e) => update('doems_autorizacao_link', e.target.value)} /></Field><Field label="Observações" className="md:col-span-3"><Textarea value={form.observacoes} onChange={(e) => update('observacoes', e.target.value)} /></Field></div><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="button" disabled={saving} onClick={() => onSubmit(form)}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar cota</Button></DialogFooter></DialogContent></Dialog>;
}

const GRATIFICACAO_FORM_DEFAULT = {
  militar_id: '', tipo_gratificacao_funcao_id: '', cota_gratificacao_funcao_id: '', funcao_gratificada: '', numero_processo: '', observacoes: '', status: GRATIFICACAO_STATUS.RASCUNHO,
  data_solicitacao: '', data_publicacao_nomeacao: '', doems_nomeacao_numero: '', doems_nomeacao_edicao: '', doems_nomeacao_link: '', ato_nomeacao_numero: '', data_inicio_efeitos: '',
};

function GratificacaoModal({ open, onOpenChange, initialData, tipos, saving, onSubmit }) {
  const isEditing = Boolean(initialData?.id);
  const [form, setForm] = useState({ ...GRATIFICACAO_FORM_DEFAULT, ...(initialData || {}) });
  React.useEffect(() => { if (open) setForm({ ...GRATIFICACAO_FORM_DEFAULT, ...(initialData || {}), status: isEditing ? (initialData?.status || GRATIFICACAO_STATUS.RASCUNHO) : GRATIFICACAO_STATUS.NOMEADO_ATIVO }); }, [open, initialData, isEditing]);
  const tiposAtivos = useMemo(() => (tipos || []).filter((tipo) => tipo.ativo !== false), [tipos]);
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const selectTipo = (value) => setForm((current) => ({ ...current, tipo_gratificacao_funcao_id: value }));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar rascunho de gratificação' : 'Nova Gratificação'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Atualize os dados básicos deste rascunho antes de prosseguir com o fluxo de publicação.' : 'Registre uma nova gratificação. Informe a data da solicitação e, quando houver publicação, registre os dados do DOEMS.'}
            {!isEditing && (
              <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                <span className="font-bold">Aviso:</span> Ao salvar, a gratificação será registrada como ativa.
              </div>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[70vh] grid-cols-1 gap-3 overflow-y-auto pr-1 md:grid-cols-2">
          <div className="md:col-span-2">
            <MilitarSelector value={form.militar_id} onChange={(_, value) => update('militar_id', value)} onMilitarSelect={(militar) => update('militar_id', militar?.id || '')} />
          </div>
          <Field label="Tipo (opcional)">
            <Select value={form.tipo_gratificacao_funcao_id || ''} onValueChange={selectTipo}>
              <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
              <SelectContent>{tiposAtivos.map((tipo) => <SelectItem key={tipo.id} value={String(tipo.id)}>{tipo.nome || tipo.sigla || tipo.codigo}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Função gratificada *" className="md:col-span-1">
            <Input value={form.funcao_gratificada} onChange={(e) => update('funcao_gratificada', e.target.value)} />
          </Field>
          {!isEditing && (
            <>
              <Field label="Data da Solicitação *">
                <Input type="date" value={form.data_solicitacao || ''} onChange={(e) => update('data_solicitacao', e.target.value)} />
              </Field>
              <Field label="Data da Publicação">
                <Input type="date" value={form.data_publicacao_nomeacao || ''} onChange={(e) => update('data_publicacao_nomeacao', e.target.value)} />
              </Field>
              <Field label="DOEMS número">
                <Input value={form.doems_nomeacao_numero || ''} onChange={(e) => update('doems_nomeacao_numero', e.target.value)} placeholder="Ex: 11000" />
              </Field>
              <Field label="DOEMS edição">
                <Input value={form.doems_nomeacao_edicao || ''} onChange={(e) => update('doems_nomeacao_edicao', e.target.value)} placeholder="Ex: Suplemento I" />
              </Field>
              <Field label="DOEMS link" className="md:col-span-2">
                <Input value={form.doems_nomeacao_link || ''} onChange={(e) => update('doems_nomeacao_link', e.target.value)} placeholder="https://..." />
              </Field>
            </>
          )}
          <Field label="Observações" className="md:col-span-2">
            <Textarea value={form.observacoes || ''} onChange={(e) => update('observacoes', e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" disabled={saving} onClick={() => onSubmit(form)}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} {isEditing ? 'Salvar alterações' : 'Salvar e ativar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function EnviarDPModal({ open, onOpenChange, item, saving, onSubmit }) {
  const [form, setForm] = React.useState({ data_solicitacao: '', documento_solicitacao: '', numero_processo: '' });

  React.useEffect(() => {
    if (open) {
      setForm({
        data_solicitacao: item?.data_solicitacao || new Date().toISOString().split('T')[0],
        documento_solicitacao: item?.documento_solicitacao || '',
        numero_processo: item?.numero_processo || '',
      });
    }
  }, [open, item]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ id: item.id, ...form });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Enviar à DP</DialogTitle>
            <DialogDescription>
              Confirme os dados da solicitação para avançar o status deste rascunho.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Data da Solicitação</Label>
              <Input type="date" value={form.data_solicitacao} onChange={(e) => setForm({ ...form, data_solicitacao: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Documento da Solicitação</Label>
              <Input value={form.documento_solicitacao} onChange={(e) => setForm({ ...form, documento_solicitacao: e.target.value })} placeholder="Ex: Ofício nº 123/2023" />
            </div>
            <div className="space-y-2">
              <Label>Número do Processo (opcional)</Label>
              <Input value={form.numero_processo} onChange={(e) => setForm({ ...form, numero_processo: e.target.value })} placeholder="Ex: E-09/123/1000/2023" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirmar Envio
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


function RegistrarPublicacaoModal({ open, onOpenChange, item, saving, onSubmit }) {
  const [form, setForm] = useState({
    data_publicacao_nomeacao: '',
    doems_nomeacao_numero: '',
    doems_nomeacao_edicao: '',
    data_inicio_efeitos: '',
    doems_nomeacao_link: '',
    ato_nomeacao_numero: '',
    observacoes: '',
  });

  React.useEffect(() => {
    if (open) {
      setForm({
        data_publicacao_nomeacao: item?.data_publicacao_nomeacao || '',
        doems_nomeacao_numero: item?.doems_nomeacao_numero || '',
        doems_nomeacao_edicao: item?.doems_nomeacao_edicao || '',
        data_inicio_efeitos: item?.data_inicio_efeitos || '',
        doems_nomeacao_link: item?.doems_nomeacao_link || '',
        ato_nomeacao_numero: item?.ato_nomeacao_numero || '',
        observacoes: item?.observacoes || '',
      });
    }
  }, [open, item]);

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Registrar Publicação (DOEMS)</DialogTitle>
          <DialogDescription>
            Informe os dados da publicação da nomeação em DOEMS.
            <div className="mt-2 rounded bg-amber-50 p-2 text-amber-800 border border-amber-200">
              <span className="font-semibold">Aviso:</span> Esta ação tornará a gratificação ativa.
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mt-4">
          <Field label="Data da publicação *">
            <Input type="date" value={form.data_publicacao_nomeacao} onChange={(e) => update('data_publicacao_nomeacao', e.target.value)} />
          </Field>
          <Field label="Início dos efeitos *">
            <Input type="date" value={form.data_inicio_efeitos} onChange={(e) => update('data_inicio_efeitos', e.target.value)} />
          </Field>
          <Field label="DOEMS número">
            <Input value={form.doems_nomeacao_numero} onChange={(e) => update('doems_nomeacao_numero', e.target.value)} placeholder="Ex: 11000" />
          </Field>
          <Field label="DOEMS edição">
            <Input value={form.doems_nomeacao_edicao} onChange={(e) => update('doems_nomeacao_edicao', e.target.value)} placeholder="Ex: Suplemento I" />
          </Field>
          <Field label="DOEMS link" className="md:col-span-2">
            <Input value={form.doems_nomeacao_link} onChange={(e) => update('doems_nomeacao_link', e.target.value)} placeholder="https://..." />
          </Field>
          <Field label="Ato de nomeação (Opcional)" className="md:col-span-2">
            <Input value={form.ato_nomeacao_numero} onChange={(e) => update('ato_nomeacao_numero', e.target.value)} placeholder="Número do ato, se houver" />
          </Field>
          <Field label="Observações (Opcional)" className="md:col-span-2">
            <Textarea value={form.observacoes} onChange={(e) => update('observacoes', e.target.value)} />
          </Field>
        </div>

        <DialogFooter className="mt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button type="button" onClick={() => onSubmit({ id: item.id, ...form })} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Ativar Nomeação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmarPublicacaoModal({ open, onOpenChange, item, saving, onSubmit }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Aguardando Publicação</DialogTitle>
          <DialogDescription>
            Tem certeza que deseja marcar esta gratificação como aguardando publicação da nomeação?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button type="button" onClick={() => onSubmit({ id: item.id })} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmacaoExclusaoModal({ open, onOpenChange, onConfirm, loading }) {
  const [confirmacao, setConfirmacao] = useState('');
  const TEXTO_OBRIGATORIO = 'EXCLUIR GRATIFICAÇÃO';

  React.useEffect(() => {
    if (open) setConfirmacao('');
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-red-600">Confirmar Exclusão</DialogTitle>
          <DialogDescription>
            Esta ação é irreversível. O registro será removido permanentemente do banco de dados.
            <div className="mt-4 rounded-lg border border-red-100 bg-red-50 p-3 text-xs text-red-800">
              <p className="font-bold uppercase">Atenção:</p>
              <p className="mt-1">Para confirmar, digite exatamente o texto abaixo:</p>
              <p className="mt-2 font-mono font-bold">{TEXTO_OBRIGATORIO}</p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <Input
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
            placeholder="Digite o texto de confirmação"
            className="border-red-200 focus-visible:ring-red-500"
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={loading || confirmacao !== TEXTO_OBRIGATORIO}
            onClick={onConfirm}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Excluir permanentemente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FinalizarGratificacaoModal({ open, onOpenChange, item, saving, onSubmit }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    data_fim_efeitos: '',
    motivo_dispensa: '',
    data_publicacao_dispensa: '',
    doems_dispensa_numero: '',
    doems_dispensa_edicao: '',
    doems_dispensa_link: '',
    ato_dispensa_numero: '',
    documento_solicitacao_dispensa: '',
    observacoes: '',
  });

  React.useEffect(() => {
    if (open) {
      setForm({
        data_fim_efeitos: item?.data_fim_efeitos || '',
        motivo_dispensa: item?.motivo_dispensa || '',
        data_publicacao_dispensa: item?.data_publicacao_dispensa || '',
        doems_dispensa_numero: item?.doems_dispensa_numero || '',
        doems_dispensa_edicao: item?.doems_dispensa_edicao || '',
        doems_dispensa_link: item?.doems_dispensa_link || '',
        ato_dispensa_numero: item?.ato_dispensa_numero || '',
        documento_solicitacao_dispensa: item?.documento_solicitacao_dispensa || '',
        observacoes: item?.observacoes || '',
      });
    }
  }, [open, item]);

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleFinalizar = () => {
    if (!form.data_fim_efeitos || !form.motivo_dispensa) {
      toast({ title: 'Campos obrigatórios', description: 'Por favor, informe a data de fim dos efeitos e o motivo da dispensa.', variant: 'destructive' });
      return;
    }
    onSubmit({ id: item.id, ...form });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Finalizar Gratificação (Dispensa)</DialogTitle>
          <DialogDescription>
            Esta ação encerrará a gratificação e moverá o registro para o histórico.
            <div className="mt-2 rounded bg-amber-50 p-2 text-amber-800 border border-amber-200 text-xs">
              <span className="font-semibold">Aviso:</span> Certifique-se de que a data de fim dos efeitos e o motivo da dispensa estejam corretos.
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mt-4 max-h-[60vh] overflow-y-auto pr-2">
          <Field label="Fim dos efeitos *">
            <Input type="date" value={form.data_fim_efeitos} onChange={(e) => update('data_fim_efeitos', e.target.value)} required />
          </Field>
          <Field label="Motivo da dispensa *">
            <Input value={form.motivo_dispensa} onChange={(e) => update('motivo_dispensa', e.target.value)} placeholder="Ex: A pedido do militar" required />
          </Field>
          <Field label="Data da publicação dispensa">
            <Input type="date" value={form.data_publicacao_dispensa} onChange={(e) => update('data_publicacao_dispensa', e.target.value)} />
          </Field>
          <Field label="DOEMS número">
            <Input value={form.doems_dispensa_numero} onChange={(e) => update('doems_dispensa_numero', e.target.value)} placeholder="Ex: 11000" />
          </Field>
          <Field label="DOEMS edição">
            <Input value={form.doems_dispensa_edicao} onChange={(e) => update('doems_dispensa_edicao', e.target.value)} placeholder="Ex: Suplemento I" />
          </Field>
          <Field label="Ato de dispensa">
            <Input value={form.ato_dispensa_numero} onChange={(e) => update('ato_dispensa_numero', e.target.value)} placeholder="Número do ato, se houver" />
          </Field>
          <Field label="DOEMS link" className="md:col-span-2">
            <Input value={form.doems_dispensa_link} onChange={(e) => update('doems_dispensa_link', e.target.value)} placeholder="https://..." />
          </Field>
          <Field label="Documento de solicitação" className="md:col-span-2">
            <Input value={form.documento_solicitacao_dispensa} onChange={(e) => update('documento_solicitacao_dispensa', e.target.value)} placeholder="Ex: Ofício nº 456/2023" />
          </Field>
          <Field label="Observações" className="md:col-span-2">
            <Textarea value={form.observacoes} onChange={(e) => update('observacoes', e.target.value)} />
          </Field>
        </div>

        <DialogFooter className="mt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button type="button" onClick={handleFinalizar} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Finalizar Gratificação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function GratificacoesFuncao() {
  const { isAdmin, canAccessAction, canAccessAll, permissions, modoAcesso, isLoading: loadingUser, isAccessResolved } = useCurrentUser();
  const hasAbsoluteAccess = Boolean(isAdmin || canAccessAll || hasAllPermissions(permissions));
  const [modoAdmin, setModoAdmin] = useState(false);
  const canView = hasAbsoluteAccess || canAccessAction('visualizar_gratificacoes_funcao');
  const canManageCadastros = hasAbsoluteAccess || canAccessAction('gerir_cotas_gratificacao_funcao');
  const canManageGratificacoes = hasAbsoluteAccess || canAccessAction('gerir_gratificacoes_funcao');
  const canShowAccessDebug = Boolean(import.meta.env.DEV && isAdmin);
  const canViewAdministrativeQuotas = hasAbsoluteAccess || isAdmin || modoAcesso !== 'proprio';
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [aba, setAba] = useState(GRATIFICACAO_TABS.ATIVAS);
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState(TODOS);
  const [tipo, setTipo] = useState(TODOS);
  const [funcao, setFuncao] = useState(TODOS);
  const [unidade, setUnidade] = useState(TODOS);
  const [tipoModal, setTipoModal] = useState({ open: false, data: null });
  const [cotaModal, setCotaModal] = useState({ open: false, data: null });
  const [gratificacaoModal, setGratificacaoModal] = useState({ open: false, data: null });
  const [enviarDPModal, setEnviarDPModal] = useState({ open: false, data: null });
  const [aguardandoPublicacaoModal, setAguardandoPublicacaoModal] = useState({ open: false, data: null });
  const [registrarPublicacaoModal, setRegistrarPublicacaoModal] = useState({ open: false, data: null });
  const [finalizarModal, setFinalizarModal] = useState({ open: false, data: null });
  const [exclusaoModal, setExclusaoModal] = useState({ open: false, data: null });

  const filtrosBackend = useMemo(() => ({ tab: aba === GRATIFICACAO_TABS.CONFIGURACOES ? 'cotas' : aba, busca, status: status === TODOS ? undefined : status, tipo_gratificacao_funcao_id: tipo === TODOS ? undefined : tipo, funcao_gratificada: funcao === TODOS ? undefined : funcao, unidade_id: unidade === TODOS ? undefined : unidade, limit: 200, offset: 0 }), [aba, busca, status, tipo, funcao, unidade]);
  const query = useQuery({ queryKey: ['gratificacoes-funcao-painel', filtrosBackend], queryFn: () => fetchPainelGratificacoesFuncao(filtrosBackend), enabled: canView, staleTime: 60 * 1000, refetchOnWindowFocus: false });

  const saveMutation = useMutation({
    mutationFn: gerirCadastrosGratificacaoFuncao,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['gratificacoes-funcao-painel'] });
      setTipoModal({ open: false, data: null });
      setCotaModal({ open: false, data: null });
      toast({ title: 'Cadastro salvo', description: 'Tipos/cotas atualizados no painel.' });
    },
    onError: (error) => toast({ title: 'Falha ao salvar', description: error?.message || 'Erro ao salvar cadastro.', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deletarGratificacao(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['gratificacoes-funcao-painel'] });
      setExclusaoModal({ open: false, data: null });
      toast({ title: 'Gratificação excluída', description: 'O registro foi removido permanentemente.' });
    },
    onError: (error) => toast({ title: 'Falha ao excluir', description: error?.message || 'Erro ao remover registro.', variant: 'destructive' }),
  });

  const rascunhoMutation = useMutation({
    mutationFn: gerirRascunhoGratificacaoFuncao,
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['gratificacoes-funcao-painel'] });
      setGratificacaoModal({ open: false, data: null });

      const operacao = variables?.operacao || '';
      if (operacao === 'enviar_dp') {
        toast({ title: 'Enviado à DP', description: 'Solicitação registrada com sucesso.' });
      } else if (operacao === 'marcar_aguardando_publicacao') {
        toast({ title: 'Status Atualizado', description: 'Gratificação marcada como aguardando publicação.' });
      } else if (operacao === 'criar_nomeacao_ativa') {
        setAba(GRATIFICACAO_TABS.ATIVAS);
        toast({ title: 'Gratificação Ativada', description: 'O registro foi criado diretamente como ativo.' });
      } else if (operacao === 'finalizar_gratificacao') {
        setFinalizarModal({ open: false, data: null });
        setAba(GRATIFICACAO_TABS.HISTORICO);
        toast({ title: 'Gratificação Finalizada', description: 'O registro foi finalizado com sucesso e movido para o histórico.' });
      } else {
        toast({ title: 'Rascunho salvo', description: 'Gratificação de Função salva como rascunho, sem ativação ou nomeação.' });
      }
    },
    onError: (error) => toast({ title: 'Falha na operação', description: error?.message || 'Erro ao processar a operação.', variant: 'destructive' }),
  });

  const salvarGratificacao = (form) => rascunhoMutation.mutate({ operacao: form.id ? 'atualizar_rascunho' : 'criar_nomeacao_ativa', id: form.id, data: { ...form, status: form.id ? form.status : GRATIFICACAO_STATUS.NOMEADO_ATIVO } });
  const enviarDP = (form) => { rascunhoMutation.mutate({ operacao: 'enviar_dp', id: form.id, data: form }); };
  const marcarAguardandoPublicacao = (form) => { rascunhoMutation.mutate({ operacao: 'marcar_aguardando_publicacao', id: form.id }); };
  const registrarPublicacao = (form) => { rascunhoMutation.mutate({ operacao: 'registrar_publicacao_nomeacao', id: form.id, data: form }); };
  const finalizarGratificacao = (form) => { rascunhoMutation.mutate({ operacao: 'finalizar_gratificacao', id: form.id, data: form }); };
  const handleExcluir = () => { if (exclusaoModal.data?.id) deleteMutation.mutate(exclusaoModal.data.id); };

  const gratificacoes = query.data?.gratificacoes || [];
  const cotasBackend = query.data?.cotas || [];
  const cotas = canViewAdministrativeQuotas ? cotasBackend : [];
  const tipos = query.data?.tipos || [];
  const resumo = useMemo(() => calcularResumoGratificacoesFuncao(query.data?.gratificacoes || []), [query.data?.gratificacoes]);
  const opcoes = useMemo(() => listarOpcoesGratificacao(gratificacoes, cotas, tipos), [gratificacoes, cotas, tipos]);
  const filtros = useMemo(() => ({ busca, status, tipo, funcao, unidade }), [busca, status, tipo, funcao, unidade]);
  const gratificacoesFiltradas = useMemo(() => aplicarFiltrosGratificacoesFuncao(filtrarGratificacoesPorAba(gratificacoes, aba), filtros, tipos), [gratificacoes, aba, filtros, tipos]);
  const pendenciasAntigasFiltradas = useMemo(() => aplicarFiltrosGratificacoesFuncao((gratificacoes || []).filter(item => STATUS_PENDENTES.includes(item.status)), filtros, tipos), [gratificacoes, filtros, tipos]);
  const cotasFiltradas = useMemo(() => {
    const buscaNormalizada = busca.trim().toLowerCase();
    return cotas.filter((cota) => {
      if (funcao !== TODOS && cota.funcao_gratificada !== funcao) return false;
      if (tipo !== TODOS && String(cota.tipo_gratificacao_funcao_id || cota.tipo_gratificacao || '') !== tipo && String(cota.tipo_gratificacao || '').toLowerCase() !== tipo.toLowerCase()) return false;
      if (unidade !== TODOS) {
        const unidadeId = String(cota.unidade_id || cota.setor_id || '');
        const unidadeNome = String(cota.unidade_nome_snapshot || cota.setor_nome_snapshot || '').toLowerCase();
        if (unidadeId !== unidade && unidadeNome !== unidade.toLowerCase()) return false;
      }
      if (!buscaNormalizada) return true;
      return [cota.funcao_gratificada, cota.codigo_funcao, cota.tipo_gratificacao, cota.unidade_nome_snapshot, cota.setor_nome_snapshot, cota.ato_autorizativo, cota.doems_autorizacao_numero, cota.doems_autorizacao_edicao].some((value) => String(value || '').toLowerCase().includes(buscaNormalizada));
    });
  }, [busca, cotas, funcao, tipo, unidade]);

  const salvarTipo = (form) => saveMutation.mutate({ operacao: form.id ? 'atualizar_tipo' : 'criar_tipo', id: form.id, data: form });
  const salvarCota = (form) => saveMutation.mutate({ operacao: form.id ? 'atualizar_cota' : 'criar_cota', id: form.id, data: form });

  if (loadingUser || !isAccessResolved) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-slate-500" /></div>;
  if (!canView) return <AccessDenied modulo="Gratificação de Função" />;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6"><div className="mx-auto flex max-w-7xl flex-col gap-5"><header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700"><Award className="h-3.5 w-3.5" /> Fluxo de Gratificações</div><h1 className="mt-3 text-2xl font-bold text-slate-950 md:text-3xl">Gratificação de Função</h1><p className="mt-1 max-w-3xl text-sm text-slate-600">Gestão simplificada do ciclo de gratificações: registrar, acompanhar nomeações ativas e finalizar registros (histórico).</p></div>{hasAbsoluteAccess && <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 p-2"><Label htmlFor="modo-admin" className="text-xs font-bold uppercase text-slate-500 cursor-pointer">Modo Admin</Label><Switch id="modo-admin" checked={modoAdmin} onCheckedChange={setModoAdmin} /></div>}</div></header>
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">{CARD_CONFIG.map((card) => <CounterCard key={card.key} {...card} value={resumo[card.key]} />)}</section>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(18rem,1.4fr)_repeat(4,minmax(10rem,1fr))]"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar por militar, matrícula, função, DOEMS ou processo" className="h-11 bg-slate-50 pl-9" /></div><Select value={status} onValueChange={setStatus} disabled={aba === GRATIFICACAO_TABS.CONFIGURACOES}><SelectTrigger className="h-11 bg-slate-50"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value={TODOS}>Todos os status</SelectItem>{Object.entries(GRATIFICACAO_STATUS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select><Select value={tipo} onValueChange={setTipo}><SelectTrigger className="h-11 bg-slate-50"><SelectValue placeholder="Tipo de gratificação" /></SelectTrigger><SelectContent><SelectItem value={TODOS}>Todos os tipos</SelectItem>{opcoes.tipos.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select><Select value={funcao} onValueChange={setFuncao}><SelectTrigger className="h-11 bg-slate-50"><SelectValue placeholder="Função" /></SelectTrigger><SelectContent><SelectItem value={TODOS}>Todas as funções</SelectItem>{opcoes.funcoes.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select><Select value={unidade} onValueChange={setUnidade}><SelectTrigger className="h-11 bg-slate-50"><SelectValue placeholder="Unidade/setor" /></SelectTrigger><SelectContent><SelectItem value={TODOS}>Todas as unidades/setores</SelectItem>{opcoes.unidades.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div></section>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><Tabs value={aba} onValueChange={setAba} className="w-full"><TabsList className="flex h-auto flex-wrap justify-start gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">{TAB_KEYS.filter((tab) => canViewAdministrativeQuotas || tab !== GRATIFICACAO_TABS.CONFIGURACOES).map((tab) => <TabsTrigger key={tab} value={tab} className="rounded-xl px-3 py-2 text-xs md:text-sm">{GRATIFICACAO_TAB_LABELS[tab]}</TabsTrigger>)}</TabsList></Tabs><div className="flex flex-wrap gap-2">{canManageGratificacoes && <Button type="button" onClick={() => setGratificacaoModal({ open: true, data: null })}><Plus className="h-4 w-4" /> Nova Gratificação</Button>}</div></div>
      {canShowAccessDebug && <section className="rounded-2xl border border-dashed border-blue-200 bg-blue-50 p-3 text-xs text-blue-900"><p className="font-semibold">Debug de acesso — Gratificação de Função</p><div className="mt-2 grid gap-1 md:grid-cols-2 xl:grid-cols-5"><span>canAccessAll: {String(canAccessAll)}</span><span>isAdmin: {String(isAdmin)}</span><span>canManageCadastros: {String(canManageCadastros)}</span><span>canManageGratificacoes: {String(canManageGratificacoes)}</span><span>permissions ALL: {String(hasAllPermissions(permissions))}</span></div><p className="mt-2 break-words">Permissões detectadas: {permissions === 'ALL' ? 'ALL' : Object.entries(permissions || {}).filter(([, value]) => value === true).map(([key]) => key).sort().join(', ') || 'nenhuma'}</p></section>}
      {query.isLoading && <div className="flex min-h-[18rem] items-center justify-center rounded-2xl border border-slate-200 bg-white"><Loader2 className="h-8 w-8 animate-spin text-slate-500" /></div>}
      {query.error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><div className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><p>{query.error.message || 'Erro controlado ao carregar o painel de Gratificação de Função.'}</p></div></div>}
      {!query.isLoading && !query.error && aba === GRATIFICACAO_TABS.ATIVAS && <GratificacoesTable gratificacoes={gratificacoesFiltradas} tipos={tipos} canManageGratificacoes={canManageGratificacoes} modoAdmin={modoAdmin} onEditRascunho={(item) => setGratificacaoModal({ open: true, data: item })} onEnviarDP={(item) => setEnviarDPModal({ open: true, data: item })} onAguardandoPublicacao={(item) => setAguardandoPublicacaoModal({ open: true, data: item })} onRegistrarPublicacao={(item) => setRegistrarPublicacaoModal({ open: true, data: item })} onFinalizar={(item) => setFinalizarModal({ open: true, data: item })} onExcluir={(item) => setExclusaoModal({ open: true, data: item })} />}
      {!query.isLoading && !query.error && aba === GRATIFICACAO_TABS.HISTORICO && (
        <div className="flex flex-col gap-6">
          <GratificacoesTable gratificacoes={gratificacoesFiltradas} tipos={tipos} canManageGratificacoes={canManageGratificacoes} modoAdmin={modoAdmin} onEditRascunho={(item) => setGratificacaoModal({ open: true, data: item })} onEnviarDP={(item) => setEnviarDPModal({ open: true, data: item })} onAguardandoPublicacao={(item) => setAguardandoPublicacaoModal({ open: true, data: item })} onRegistrarPublicacao={(item) => setRegistrarPublicacaoModal({ open: true, data: item })} onFinalizar={(item) => setFinalizarModal({ open: true, data: item })} onExcluir={(item) => setExclusaoModal({ open: true, data: item })} />
          {pendenciasAntigasFiltradas.length > 0 && (
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="pendencias" className="border-none">
                <AccordionTrigger className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:no-underline">
                  <div className="flex items-center gap-2"><History className="h-4 w-4" /> Pendências antigas ({pendenciasAntigasFiltradas.length})</div>
                </AccordionTrigger>
                <AccordionContent className="pt-4">
                  <GratificacoesTable gratificacoes={pendenciasAntigasFiltradas} tipos={tipos} canManageGratificacoes={canManageGratificacoes} modoAdmin={modoAdmin} onEditRascunho={(item) => setGratificacaoModal({ open: true, data: item })} onEnviarDP={(item) => setEnviarDPModal({ open: true, data: item })} onAguardandoPublicacao={(item) => setAguardandoPublicacaoModal({ open: true, data: item })} onRegistrarPublicacao={(item) => setRegistrarPublicacaoModal({ open: true, data: item })} onFinalizar={(item) => setFinalizarModal({ open: true, data: item })} onExcluir={(item) => setExclusaoModal({ open: true, data: item })} />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
        </div>
      )}
      {!query.isLoading && !query.error && aba === GRATIFICACAO_TABS.CONFIGURACOES && (
        <div className="flex flex-col gap-6">
          <section className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            {canManageCadastros && <Button type="button" variant="outline" onClick={() => setTipoModal({ open: true, data: null })}><Plus className="h-4 w-4" /> Novo Tipo</Button>}
          </section>
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-1 text-sm font-bold uppercase tracking-wider text-slate-500"><Settings className="h-4 w-4" /> Tipos de Gratificação</div>
            <TiposTable tipos={tipos} canManage={canManageCadastros} onEdit={(tipoItem) => setTipoModal({ open: true, data: tipoItem })} />
          </div>
        </div>
      )}
      <GratificacaoModal open={gratificacaoModal.open} initialData={gratificacaoModal.data} tipos={tipos} saving={rascunhoMutation.isPending} onOpenChange={(open) => setGratificacaoModal({ open, data: open ? gratificacaoModal.data : null })} onSubmit={salvarGratificacao} />
      <EnviarDPModal open={enviarDPModal.open} item={enviarDPModal.data} saving={rascunhoMutation.isPending} onOpenChange={(open) => setEnviarDPModal({ open, data: open ? enviarDPModal.data : null })} onSubmit={enviarDP} />
      <ConfirmarPublicacaoModal open={aguardandoPublicacaoModal.open} item={aguardandoPublicacaoModal.data} saving={rascunhoMutation.isPending} onOpenChange={(open) => setAguardandoPublicacaoModal({ open, data: open ? aguardandoPublicacaoModal.data : null })} onSubmit={marcarAguardandoPublicacao} />
      <RegistrarPublicacaoModal open={registrarPublicacaoModal.open} item={registrarPublicacaoModal.data} saving={rascunhoMutation.isPending} onOpenChange={(open) => setRegistrarPublicacaoModal({ open, data: open ? registrarPublicacaoModal.data : null })} onSubmit={registrarPublicacao} />
      <FinalizarGratificacaoModal open={finalizarModal.open} item={finalizarModal.data} saving={rascunhoMutation.isPending} onOpenChange={(open) => setFinalizarModal({ open, data: open ? finalizarModal.data : null })} onSubmit={finalizarGratificacao} />
      <ConfirmacaoExclusaoModal open={exclusaoModal.open} onOpenChange={(open) => setExclusaoModal({ open, data: open ? exclusaoModal.data : null })} onConfirm={handleExcluir} loading={deleteMutation.isPending} />
      <TipoModal open={tipoModal.open} initialData={tipoModal.data} saving={saveMutation.isPending} onOpenChange={(open) => setTipoModal({ open, data: open ? tipoModal.data : null })} onSubmit={salvarTipo} />
      <CotaModal open={cotaModal.open} initialData={cotaModal.data} tipos={tipos} saving={saveMutation.isPending} onOpenChange={(open) => setCotaModal({ open, data: open ? cotaModal.data : null })} onSubmit={salvarCota} />
    </div></div>
  );
}