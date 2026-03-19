import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BookOpenText, Search } from 'lucide-react';

import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatarDataExtenso } from '@/components/livro/livroUtils';
import {
  getModuloByTipo,
  getTiposRPFiltrados,
  groupTiposRP,
  matchesTipoRPSearch,
  MODULO_LIVRO,
  getLivroOperacaoFerias,
} from '@/components/rp/rpTiposConfig';
import MilitarSelector from '@/components/livro/MilitarSelector';
import CamposLivroDinamicos from '@/components/livro/CamposLivroDinamicos';

const initialState = {
  militar_id: '',
  militar_nome: '',
  militar_posto_graduacao: '',
  militar_matricula: '',
  tipo_registro: '',
  status: 'Aguardando Nota',
  observacoes: '',
  nota_para_bg: '',
  numero_bg: '',
  data_bg: '',
  ferias_id: '',
};

export default function CadastrarRegistroRP() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const registroId = searchParams.get('id');
  const tipoInicial = searchParams.get('tipo');
  const isEditing = !!registroId;

  const { canAccessModule, isAccessResolved, isLoading: loadingUser } = useCurrentUser();
  const hasAccess = canAccessModule('livro') || canAccessModule('publicacoes');

  const [formData, setFormData] = useState(initialState);
  const [camposCustom, setCamposCustom] = useState({});
  const [selectedTipo, setSelectedTipo] = useState(null);
  const [tipoSearch, setTipoSearch] = useState('');
  const [selectedFerias, setSelectedFerias] = useState(null);
  const [operacaoFeriasSelecionada, setOperacaoFeriasSelecionada] = useState(null);
  const [registroEdicao, setRegistroEdicao] = useState(null);
  const [moduloOrigemEdicao, setModuloOrigemEdicao] = useState(null);
  const [originalActEntries, setOriginalActEntries] = useState([]);

  const { data: tiposCustom = [] } = useQuery({
    queryKey: ['tipos-publicacao-custom'],
    queryFn: async () => {
      try {
        return await base44.entities.TipoPublicacaoCustom.list();
      } catch {
        return [];
      }
    },
    enabled: isAccessResolved && hasAccess,
  });

  const { data: templatesAtivos = [] } = useQuery({
    queryKey: ['templates-texto-ativos'],
    queryFn: async () => {
      try {
        return await base44.entities.TemplateTexto.filter({ ativo: true });
      } catch {
        return [];
      }
    },
    enabled: isAccessResolved && hasAccess,
  });

  const { data: militarSelecionado } = useQuery({
    queryKey: ['militar-rp', formData.militar_id],
    queryFn: async () => {
      if (!formData.militar_id) return null;
      const result = await base44.entities.Militar.filter({ id: formData.militar_id });
      return result?.[0] || null;
    },
    enabled: !!formData.militar_id,
  });

  const { isLoading: loadingRegistro } = useQuery({
    queryKey: ['registro-rp-edicao', registroId],
    queryFn: async () => {
      if (!registroId) return null;

      const [livro, exofficio] = await Promise.all([
        base44.entities.RegistroLivro.filter({ id: registroId }),
        base44.entities.PublicacaoExOfficio.filter({ id: registroId }),
      ]);

      const registroLivro = livro?.[0];
      if (registroLivro) {
        setRegistroEdicao({ ...registroLivro, _modulo: 'Livro' });
        return registroLivro;
      }

      const registroExOfficio = exofficio?.[0];
      if (registroExOfficio) {
        setRegistroEdicao({
          ...registroExOfficio,
          tipo_registro: registroExOfficio.tipo,
          _modulo: 'ExOfficio',
        });
        return registroExOfficio;
      }

      return null;
    },
    enabled: isEditing,
  });

  useQuery({
    queryKey: ['publicacoes-militar-rp', formData.militar_id],
    queryFn: async () => {
      if (!formData.militar_id) return [];

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

  const tiposFiltradosBusca = useMemo(() => {
    return tiposFiltrados.filter((t) => matchesTipoRPSearch(t, tipoSearch));
  }, [tiposFiltrados, tipoSearch]);

  const tiposAgrupados = useMemo(() => groupTiposRP(tiposFiltradosBusca), [tiposFiltradosBusca]);

  const moduloAtual = useMemo(() => {
    if (!formData.tipo_registro) return null;
    return getModuloByTipo(formData.tipo_registro, tiposCustom);
  }, [formData.tipo_registro, tiposCustom]);

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

    const tipo = tiposFiltrados.find((t) => t.value === tipoVal);
    if (tipo) setSelectedTipo(tipo);

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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1e3a5f] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-8">
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
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-[#1e3a5f]">Militar</h2>
            <MilitarSelector
              value={formData.militar_id}
              onChange={handleChange}
              onMilitarSelect={handleMilitarSelect}
            />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-[#1e3a5f]">Tipo de Registro</h2>

            {selectedTipo ? (
              <div className="flex items-center justify-between rounded-lg border border-[#1e3a5f]/20 bg-[#1e3a5f]/5 px-4 py-3">
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
              <div className="space-y-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={tipoSearch}
                    onChange={(e) => setTipoSearch(e.target.value)}
                    placeholder="Buscar tipo de registro..."
                    className="pl-9"
                  />
                </div>

                <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
                  {Object.entries(tiposAgrupados).map(([grupo, tipos]) => (
                    <div key={grupo}>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        {grupo}
                      </p>
                      <div className="grid gap-1 sm:grid-cols-2">
                        {tipos.map((tipo) => (
                          <button
                            key={tipo.value}
                            type="button"
                            onClick={() => handleTipoSelect(tipo)}
                            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm font-medium text-slate-800 transition hover:border-[#1e3a5f]/40 hover:bg-[#1e3a5f]/5"
                          >
                            {tipo.label}
                            <span className="ml-2 text-xs font-normal text-slate-400">
                              {tipo.modulo === MODULO_LIVRO ? 'Livro' : 'Ex Offício'}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}

                  {tiposFiltradosBusca.length === 0 && (
                    <p className="py-4 text-center text-sm text-slate-400">Nenhum tipo encontrado.</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {isEditing && moduloOrigemEdicao && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Registro em edição vinculado ao módulo{' '}
              <strong>{moduloOrigemEdicao === 'Livro' ? 'Livro' : 'Ex Officio'}</strong>.
              O tipo pode ser ajustado apenas dentro da mesma origem para evitar gravação em entidade incorreta.
            </div>
          )}

          {selectedTipo && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-base font-semibold text-[#1e3a5f]">Dados do Registro</h2>

              <CamposLivroDinamicos
                tipoRegistro={formData.tipo_registro}
                formData={formData}
                onChange={handleChange}
                camposCustom={camposCustom}
                setCamposCustom={setCamposCustom}
                selectedFerias={selectedFerias}
                onFeriasSelect={handleFeriasSelect}
                operacaoFeriasSelecionada={operacaoFeriasSelecionada}
                setOperacaoFeriasSelecionada={setOperacaoFeriasSelecionada}
                originalActEntries={originalActEntries}
              />
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-[#1e3a5f]">Publicação</h2>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Nota para BG</label>
                <Input
                  value={formData.nota_para_bg || ''}
                  onChange={(e) => handleChange('nota_para_bg', e.target.value)}
                  placeholder="Ex.: Encaminhar para BG"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Número do BG</label>
                <Input
                  value={formData.numero_bg || ''}
                  onChange={(e) => handleChange('numero_bg', e.target.value)}
                  placeholder="Ex.: 045"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Data do BG</label>
                <Input
                  type="date"
                  value={formData.data_bg || ''}
                  onChange={(e) => handleChange('data_bg', e.target.value)}
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium text-slate-700">Observações</label>
              <Input
                value={formData.observacoes || ''}
                onChange={(e) => handleChange('observacoes', e.target.value)}
                placeholder="Observações gerais do registro"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => navigate(createPageUrl('RP'))}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-[#1e3a5f] hover:bg-[#2c517f]" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Salvar registro'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}