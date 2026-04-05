import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const ESCOPO = {
  GLOBAL: 'GLOBAL',
  SETOR: 'SETOR',
  SUBSETOR: 'SUBSETOR',
  UNIDADE: 'UNIDADE',
};

const ESCOPO_OPTIONS = [
  { value: ESCOPO.GLOBAL, label: 'Global' },
  { value: ESCOPO.SETOR, label: 'Setor' },
  { value: ESCOPO.SUBSETOR, label: 'Subsetor' },
  { value: ESCOPO.UNIDADE, label: 'Unidade' },
];

function emptyForm() {
  return {
    id: '',
    nome: '',
    escopo: ESCOPO.GLOBAL,
    setor_id: '',
    subsetor_id: '',
    unidade_id: '',
    cabecalho_linha_1: '',
    cabecalho_linha_2: '',
    cabecalho_linha_3: '',
    titulo_documento: 'FOLHA DE ALTERAÇÕES',
    local_padrao: '',
    texto_data_final: '',
    cargo_autoridade: '',
    nome_autoridade: '',
    texto_complementar: '',
    ativo: true,
  };
}

function normalizeScope(form) {
  const escopo = String(form.escopo || ESCOPO.GLOBAL).toUpperCase();

  if (escopo === ESCOPO.GLOBAL) {
    return { ...form, escopo, setor_id: '', subsetor_id: '', unidade_id: '' };
  }

  if (escopo === ESCOPO.SETOR) {
    return { ...form, escopo, subsetor_id: '', unidade_id: '' };
  }

  if (escopo === ESCOPO.SUBSETOR) {
    return { ...form, escopo, unidade_id: '' };
  }

  return { ...form, escopo: ESCOPO.UNIDADE };
}

function validateScope(form) {
  if (form.escopo === ESCOPO.SETOR && !form.setor_id) {
    return 'Selecione o setor para salvar no escopo Setor.';
  }

  if (form.escopo === ESCOPO.SUBSETOR && (!form.setor_id || !form.subsetor_id)) {
    return 'Selecione setor e subsetor para salvar no escopo Subsetor.';
  }

  if (form.escopo === ESCOPO.UNIDADE && (!form.setor_id || !form.subsetor_id || !form.unidade_id)) {
    return 'Selecione setor, subsetor e unidade para salvar no escopo Unidade.';
  }

  return null;
}

function getConfigScopeKey(item = {}) {
  const escopo = String(item.escopo || ESCOPO.GLOBAL).toUpperCase();
  return [escopo, item.setor_id || '', item.subsetor_id || '', item.unidade_id || ''].join('::');
}

function getEscopoLabel(escopo) {
  return ESCOPO_OPTIONS.find((item) => item.value === escopo)?.label || 'Global';
}

export default function FolhaAlteracoesConfigManager({ canEdit = false }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm());

  const { data: configs = [], isLoading: loadingConfigs } = useQuery({
    queryKey: ['folha-alteracoes-config'],
    queryFn: () => base44.entities.FolhaAlteracoesConfig.list('-created_date'),
  });

  const { data: estrutura = [] } = useQuery({
    queryKey: ['estrutura-organizacional-folha-config'],
    queryFn: () => base44.entities.Subgrupamento.list('nome'),
  });

  const setores = useMemo(
    () => estrutura.filter((item) => item?.tipo === 'Grupamento' || item?.tipo === 'Setor' || item?.nivel_hierarquico === 1),
    [estrutura]
  );

  const subsetores = useMemo(() => {
    if (!form.setor_id) return [];
    return estrutura.filter((item) => (
      (item?.tipo === 'Subgrupamento' || item?.tipo === 'Subsetor' || item?.nivel_hierarquico === 2) &&
      item?.grupamento_id === form.setor_id
    ));
  }, [estrutura, form.setor_id]);

  const unidades = useMemo(() => {
    if (!form.subsetor_id) return [];
    return estrutura.filter((item) => item?.tipo === 'Unidade' && item?.grupamento_id === form.subsetor_id);
  }, [estrutura, form.subsetor_id]);

  const estruturaById = useMemo(
    () => new Map((estrutura || []).map((item) => [item.id, item])),
    [estrutura]
  );

  const duplicateError = useMemo(() => {
    const normalizado = normalizeScope(form);
    const mesmaChave = getConfigScopeKey(normalizado);

    return configs.find((item) => item.id !== form.id && getConfigScopeKey(item) === mesmaChave) || null;
  }, [form, configs]);

  const saveMutation = useMutation({
    mutationFn: async (rawData) => {
      if (!canEdit) throw new Error('Ação negada: sem permissão para gerir configurações.');

      const payload = normalizeScope(rawData);
      const erroEscopo = validateScope(payload);
      if (erroEscopo) throw new Error(erroEscopo);

      if (duplicateError) {
        throw new Error('Já existe configuração ativa para este escopo. Edite a configuração existente.');
      }

      const data = {
        ...payload,
        nome: payload.nome?.trim() || `Folha ${getEscopoLabel(payload.escopo)}`,
      };

      if (payload.id) {
        return base44.entities.FolhaAlteracoesConfig.update(payload.id, data);
      }

      return base44.entities.FolhaAlteracoesConfig.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folha-alteracoes-config'] });
      setForm(emptyForm());
    },
    onError: (error) => {
      window.alert(error?.message || 'Não foi possível salvar a configuração.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      if (!canEdit) throw new Error('Ação negada: sem permissão para gerir configurações.');
      return base44.entities.FolhaAlteracoesConfig.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folha-alteracoes-config'] });
      if (form.id) setForm(emptyForm());
    },
    onError: (error) => {
      window.alert(error?.message || 'Não foi possível excluir a configuração.');
    },
  });

  const onEscopoChange = (value) => {
    const escopo = String(value || ESCOPO.GLOBAL).toUpperCase();
    setForm((prev) => normalizeScope({ ...prev, escopo }));
  };

  const handleSave = () => {
    saveMutation.mutate(form);
  };

  const handleEdit = (config) => {
    setForm({
      ...emptyForm(),
      ...config,
      escopo: String(config?.escopo || ESCOPO.GLOBAL).toUpperCase(),
    });
  };

  const getScopeDescription = (item) => {
    const escopo = String(item?.escopo || ESCOPO.GLOBAL).toUpperCase();
    if (escopo === ESCOPO.SETOR) {
      return estruturaById.get(item.setor_id)?.nome || 'Setor não encontrado';
    }
    if (escopo === ESCOPO.SUBSETOR) {
      const setor = estruturaById.get(item.setor_id)?.nome || 'Setor não encontrado';
      const subsetor = estruturaById.get(item.subsetor_id)?.nome || 'Subsetor não encontrado';
      return `${setor} / ${subsetor}`;
    }
    if (escopo === ESCOPO.UNIDADE) {
      const setor = estruturaById.get(item.setor_id)?.nome || 'Setor não encontrado';
      const subsetor = estruturaById.get(item.subsetor_id)?.nome || 'Subsetor não encontrado';
      const unidade = estruturaById.get(item.unidade_id)?.nome || 'Unidade não encontrada';
      return `${setor} / ${subsetor} / ${unidade}`;
    }
    return 'Aplicável para toda a organização';
  };

  return (
    <Card className="shadow-sm border-slate-200">
      <CardHeader>
        <CardTitle className="text-xl text-[#1e3a5f]">Folha de Alterações (cabeçalho e assinatura)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Nome da configuração</Label>
            <Input
              value={form.nome}
              onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))}
              placeholder="Ex.: Folha Unidade Alfa"
              disabled={!canEdit}
            />
          </div>

          <div className="space-y-2">
            <Label>Escopo</Label>
            <Select value={form.escopo} onValueChange={onEscopoChange} disabled={!canEdit}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o escopo" />
              </SelectTrigger>
              <SelectContent>
                {ESCOPO_OPTIONS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {form.escopo !== ESCOPO.GLOBAL && (
            <div className="space-y-2">
              <Label>Setor</Label>
              <Select
                value={form.setor_id || '_none'}
                onValueChange={(value) => setForm((prev) => normalizeScope({ ...prev, setor_id: value === '_none' ? '' : value, subsetor_id: '', unidade_id: '' }))}
                disabled={!canEdit}
              >
                <SelectTrigger><SelectValue placeholder="Selecione o setor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Selecione</SelectItem>
                  {setores.map((item) => <SelectItem key={item.id} value={item.id}>{item.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {(form.escopo === ESCOPO.SUBSETOR || form.escopo === ESCOPO.UNIDADE) && (
            <div className="space-y-2">
              <Label>Subsetor</Label>
              <Select
                value={form.subsetor_id || '_none'}
                onValueChange={(value) => setForm((prev) => normalizeScope({ ...prev, subsetor_id: value === '_none' ? '' : value, unidade_id: '' }))}
                disabled={!canEdit || !form.setor_id}
              >
                <SelectTrigger><SelectValue placeholder="Selecione o subsetor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Selecione</SelectItem>
                  {subsetores.map((item) => <SelectItem key={item.id} value={item.id}>{item.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {form.escopo === ESCOPO.UNIDADE && (
            <div className="space-y-2">
              <Label>Unidade</Label>
              <Select
                value={form.unidade_id || '_none'}
                onValueChange={(value) => setForm((prev) => ({ ...prev, unidade_id: value === '_none' ? '' : value }))}
                disabled={!canEdit || !form.subsetor_id}
              >
                <SelectTrigger><SelectValue placeholder="Selecione a unidade" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Selecione</SelectItem>
                  {unidades.map((item) => <SelectItem key={item.id} value={item.id}>{item.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 p-4 space-y-3">
          <h3 className="font-semibold text-slate-700">Cabeçalho</h3>
          <Input value={form.cabecalho_linha_1 || ''} onChange={(e) => setForm((prev) => ({ ...prev, cabecalho_linha_1: e.target.value }))} placeholder="Linha 1" disabled={!canEdit} />
          <Input value={form.cabecalho_linha_2 || ''} onChange={(e) => setForm((prev) => ({ ...prev, cabecalho_linha_2: e.target.value }))} placeholder="Linha 2" disabled={!canEdit} />
          <Input value={form.cabecalho_linha_3 || ''} onChange={(e) => setForm((prev) => ({ ...prev, cabecalho_linha_3: e.target.value }))} placeholder="Linha 3" disabled={!canEdit} />
          <Input value={form.titulo_documento || ''} onChange={(e) => setForm((prev) => ({ ...prev, titulo_documento: e.target.value }))} placeholder="Título do documento" disabled={!canEdit} />
        </div>

        <div className="rounded-lg border border-slate-200 p-4 space-y-3">
          <h3 className="font-semibold text-slate-700">Bloco final / assinatura</h3>
          <Input value={form.local_padrao || ''} onChange={(e) => setForm((prev) => ({ ...prev, local_padrao: e.target.value }))} placeholder="Local padrão" disabled={!canEdit} />
          <Input value={form.texto_data_final || ''} onChange={(e) => setForm((prev) => ({ ...prev, texto_data_final: e.target.value }))} placeholder="Texto da data final" disabled={!canEdit} />
          <Input value={form.cargo_autoridade || ''} onChange={(e) => setForm((prev) => ({ ...prev, cargo_autoridade: e.target.value }))} placeholder="Cargo da autoridade" disabled={!canEdit} />
          <Input value={form.nome_autoridade || ''} onChange={(e) => setForm((prev) => ({ ...prev, nome_autoridade: e.target.value }))} placeholder="Nome da autoridade" disabled={!canEdit} />
          <Textarea value={form.texto_complementar || ''} onChange={(e) => setForm((prev) => ({ ...prev, texto_complementar: e.target.value }))} placeholder="Texto complementar" disabled={!canEdit} />
        </div>

        {duplicateError && (
          <p className="text-sm text-red-600">Já existe outra configuração para este escopo. Edite a existente na lista abaixo.</p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button className="bg-[#1e3a5f] hover:bg-[#2d4a6f]" onClick={handleSave} disabled={!canEdit || saveMutation.isPending}>
            {form.id ? 'Atualizar configuração' : 'Salvar configuração'}
          </Button>
          <Button variant="outline" onClick={() => setForm(emptyForm())} disabled={saveMutation.isPending}>Limpar</Button>
        </div>

        <div className="space-y-2 pt-2">
          <h3 className="font-semibold text-[#1e3a5f]">Configurações cadastradas</h3>
          {loadingConfigs && <p className="text-sm text-slate-500">Carregando configurações...</p>}
          {!loadingConfigs && configs.length === 0 && <p className="text-sm text-slate-500">Nenhuma configuração cadastrada.</p>}

          {configs.map((item) => (
            <div key={item.id} className="rounded-lg border border-slate-200 p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <p className="font-medium text-slate-800">{item.nome || `Folha ${getEscopoLabel(item.escopo)}`}</p>
                <p className="text-xs text-slate-500">Escopo: {getEscopoLabel(item.escopo)} • {getScopeDescription(item)}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => handleEdit(item)}>Editar</Button>
                <Button variant="outline" size="sm" className="text-red-600" onClick={() => deleteMutation.mutate(item.id)} disabled={!canEdit || deleteMutation.isPending}>Excluir</Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
