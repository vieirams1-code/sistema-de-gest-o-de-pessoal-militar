import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { ScrollText, Trash2, Pencil, ChevronsUpDown, Check, Eye, EyeOff } from 'lucide-react';
import { getTiposRPFiltrados } from '@/components/rp/rpTiposConfig';
import { getRegistroTipoVisual } from '@/components/militar/registroTipoVisual';
import {
  atualizarTipoRegistroMilitar,
  excluirRegistroMilitar,
  listarRegistrosMilitar,
  vinculaRegistroAoMilitar,
} from '@/services/registrosMilitarService';
import {
  enriquecerMilitarComMatriculas,
  isMilitarMesclado,
  militarCorrespondeBusca,
  montarIndiceMatriculas,
} from '@/services/matriculaMilitarViewService';

function normalizarDataISO(valor) {
  if (!valor) return '';
  if (typeof valor === 'string') {
    const iso = valor.match(/^(\d{4}-\d{2}-\d{2})/);
    if (iso) return iso[1];

    const br = valor.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  }

  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return '';
  const ano = data.getUTCFullYear();
  const mes = String(data.getUTCMonth() + 1).padStart(2, '0');
  const dia = String(data.getUTCDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function formatarData(valor) {
  const iso = normalizarDataISO(valor);
  if (!iso) return '-';
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

function extrairDescricao(registro) {
  const campos = [
    'titulo_evento',
    'tipo_registro',
    'descricao',
    'resumo',
    'historico',
    'texto_publicacao',
    'nota_para_bg',
  ];

  for (const campo of campos) {
    const valor = String(registro?.[campo] || '').trim();
    if (valor) return valor;
  }

  return 'Registro sem descrição detalhada.';
}

function getStatusPublicacaoLabel(registro) {
  return String(registro?.status_publicacao || registro?.status || '').trim() || 'Sem status';
}

function toSearch(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function getTipoRegistro(registro) {
  return String(registro?.tipo_registro || registro?.tipo || '').trim();
}

function getResumoTexto(texto = '', max = 180) {
  if (!texto) return '-';
  const limpo = texto.replace(/\s+/g, ' ').trim();
  if (limpo.length <= max) return limpo;
  return `${limpo.slice(0, max)}...`;
}

export default function RegistrosMilitar() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const {
    isAccessResolved,
    isLoading: loadingUser,
    canAccessModule,
    isAdmin,
    canAccessAction,
    user,
  } = useCurrentUser();

  const [filtroMilitarId, setFiltroMilitarId] = useState(() => searchParams.get('militar_id') || 'all');
  const [buscaMilitar, setBuscaMilitar] = useState('');
  const [openMilitarPopover, setOpenMilitarPopover] = useState(false);

  const [buscaGeral, setBuscaGeral] = useState('');
  const [buscaNomeMilitar, setBuscaNomeMilitar] = useState('');
  const [buscaMatricula, setBuscaMatricula] = useState('');
  const [dataInicial, setDataInicial] = useState('');
  const [dataFinal, setDataFinal] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('all');
  const [filtroStatus, setFiltroStatus] = useState('all');
  const [filtroNumeroBg, setFiltroNumeroBg] = useState('');
  const [filtroOrigem, setFiltroOrigem] = useState('all');
  const [filtroTipoBgLegado, setFiltroTipoBgLegado] = useState('all');
  const [filtroMateriaLegado, setFiltroMateriaLegado] = useState('all');
  const [filtroTrechoLivre, setFiltroTrechoLivre] = useState('');

  const [somentePublicados, setSomentePublicados] = useState(false);
  const [somenteComBg, setSomenteComBg] = useState(false);
  const [somenteClassificacaoPendente, setSomenteClassificacaoPendente] = useState(false);
  const [somenteLegadoNaoClassificado, setSomenteLegadoNaoClassificado] = useState(false);
  const [somenteEditavelExcluivel, setSomenteEditavelExcluivel] = useState(false);
  const [somenteSistemaAdmin, setSomenteSistemaAdmin] = useState(false);

  const [expandedRegistroId, setExpandedRegistroId] = useState(null);
  const [tipoEdicao, setTipoEdicao] = useState({});

  const canAccessRegistrosMilitar = canAccessModule('registros_militar');
  const canUseAdminMode = isAdmin && canAccessAction('admin_mode');
  const canEditarRegistros = canUseAdminMode && canAccessAction('editar_registros_militar');
  const canExcluirRegistros = canUseAdminMode && canAccessAction('excluir_registros_militar');
  const canManageAdminActions = canEditarRegistros || canExcluirRegistros;

  const { data: militares = [], isLoading: loadingMilitares } = useQuery({
    queryKey: ['registros-militar-militares'],
    queryFn: () => base44.entities.Militar.list('-created_date', 10000),
    enabled: isAccessResolved && canAccessRegistrosMilitar,
  });

  const { data: matriculas = [] } = useQuery({
    queryKey: ['registros-militar-matriculas'],
    queryFn: () => base44.entities.MatriculaMilitar.list('-created_date', 10000),
    enabled: isAccessResolved && canAccessRegistrosMilitar,
  });

  const { data: registros = [], isLoading: loadingRegistros } = useQuery({
    queryKey: ['registros-militar-registros'],
    queryFn: listarRegistrosMilitar,
    enabled: isAccessResolved && canAccessRegistrosMilitar,
  });

  const { data: tiposCustom = [] } = useQuery({
    queryKey: ['tipos-publicacao-custom'],
    queryFn: () => base44.entities.TipoPublicacaoCustom.list(),
    enabled: isAccessResolved && canAccessRegistrosMilitar,
  });

  const tiposValidos = useMemo(() => getTiposRPFiltrados({ tiposCustom }), [tiposCustom]);

  const militaresEnriquecidos = useMemo(() => {
    const indice = montarIndiceMatriculas(matriculas);
    return militares.map((militar) => enriquecerMilitarComMatriculas(militar, indice));
  }, [matriculas, militares]);

  const militaresOrdenados = useMemo(
    () => [...militaresEnriquecidos].sort((a, b) => String(a.nome_guerra || a.nome_completo || '').localeCompare(String(b.nome_guerra || b.nome_completo || ''), 'pt-BR')),
    [militaresEnriquecidos],
  );

  const militaresPorId = useMemo(
    () => militares.reduce((acc, militar) => {
      acc[militar.id] = militar;
      return acc;
    }, {}),
    [militares],
  );

  const militaresFiltradosBusca = useMemo(() => {
    const termo = toSearch(buscaMilitar).trim();
    if (!termo) return militaresOrdenados;

    return militaresOrdenados.filter((militar) => militarCorrespondeBusca(militar, termo));
  }, [buscaMilitar, militaresOrdenados]);

  const militarSelecionado = useMemo(() => {
    if (filtroMilitarId === 'all') return null;
    return militaresPorId[filtroMilitarId] || null;
  }, [filtroMilitarId, militaresPorId]);

  const statusDisponiveis = useMemo(() => {
    const set = new Set(registros.map((r) => getStatusPublicacaoLabel(r)).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [registros]);

  const tiposDisponiveisRegistros = useMemo(() => {
    const set = new Set(registros.map((r) => getTipoRegistro(r)).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [registros]);

  const tiposBgLegadoDisponiveis = useMemo(() => {
    const set = new Set(registros.map((r) => String(r?.tipo_bg_legado || '').trim()).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [registros]);

  const materiasLegadoDisponiveis = useMemo(() => {
    const set = new Set(registros.map((r) => String(r?.materia_legado || '').trim()).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [registros]);

  const registrosOrdenados = useMemo(() => {
    const buscaGeralNormalizada = toSearch(buscaGeral).trim();
    const buscaNomeMilitarNormalizada = toSearch(buscaNomeMilitar).trim();
    const buscaMatriculaNormalizada = toSearch(buscaMatricula).trim();
    const buscaNumeroBgNormalizada = toSearch(filtroNumeroBg).trim();
    const buscaTrechoNormalizada = toSearch(filtroTrechoLivre).trim();

    return registros
      .map((registro) => {
        const militar = militaresPorId[registro?.militar_id] || {};
        const dataEvento = normalizarDataISO(
          registro?.data_evento || registro?.data_publicacao || registro?.data_bg || registro?.created_date,
        );

        const nomeRegistro = String(registro?.militar_nome || '').trim();
        const militarNome = nomeRegistro
          || `${militar?.posto_graduacao ? `${militar.posto_graduacao} ` : ''}${militar?.nome_guerra || militar?.nome_completo || 'Militar não identificado'}`;

        const tipoRegistro = getTipoRegistro(registro);
        const origemRegistro = registro?.origem_registro === 'legado' ? 'legado' : 'sistema';
        const statusPublicacao = getStatusPublicacaoLabel(registro);
        const descricaoCompleta = extrairDescricao(registro);

        const textoBusca = toSearch([
          militarNome,
          militar?.nome_completo,
          militar?.nome_guerra,
          registro?.militar_nome,
          registro?.militar_nome_completo,
          registro?.nome_completo_legado,
          registro?.nome_guerra_legado,
          registro?.militar_matricula,
          registro?.matricula_legado,
          tipoRegistro,
          registro?.materia_legado,
          registro?.numero_bg,
          descricaoCompleta,
          registro?.texto_publicacao,
          statusPublicacao,
          origemRegistro,
        ].filter(Boolean).join(' '));

        const matriculaBusca = toSearch(registro?.militar_matricula || registro?.matricula_legado || militar?.matricula);
        const nomeMilitarBusca = toSearch([
          registro?.militar_nome,
          registro?.militar_nome_completo,
          registro?.nome_completo_legado,
          registro?.nome_guerra_legado,
          militarNome,
          militar?.nome_completo,
          militar?.nome_guerra,
        ].filter(Boolean).join(' '));
        const numeroBgBusca = toSearch(registro?.numero_bg);
        const tipoBgLegado = String(registro?.tipo_bg_legado || '').trim();
        const materiaLegado = String(registro?.materia_legado || '').trim();
        const classificacaoPendente = registro?.classificacao_pendente === true;
        const publicado = toSearch(statusPublicacao) === 'publicado';
        const comBg = Boolean(String(registro?.numero_bg || '').trim());
        const isEditavelExcluivel = canManageAdminActions;
        const isLegadoNaoClassificado = origemRegistro === 'legado' && (!tipoRegistro || classificacaoPendente);

        return {
          ...registro,
          dataEvento,
          descricao: descricaoCompleta,
          militarNome,
          tipoRegistro,
          origemRegistro,
          statusPublicacao,
          textoBusca,
          matriculaBusca,
          nomeMilitarBusca,
          numeroBgBusca,
          tipoBgLegado,
          materiaLegado,
          classificacaoPendente,
          publicado,
          comBg,
          isEditavelExcluivel,
          isLegadoNaoClassificado,
        };
      })
      .filter((registro) => {
        if (militarSelecionado && !vinculaRegistroAoMilitar(registro, militarSelecionado)) return false;

        if (dataInicial && (!registro.dataEvento || registro.dataEvento < dataInicial)) return false;
        if (dataFinal && (!registro.dataEvento || registro.dataEvento > dataFinal)) return false;

        if (filtroOrigem !== 'all' && registro.origemRegistro !== filtroOrigem) return false;
        if (filtroTipo !== 'all' && registro.tipoRegistro !== filtroTipo) return false;
        if (filtroStatus !== 'all' && registro.statusPublicacao !== filtroStatus) return false;

        if (filtroTipoBgLegado !== 'all' && registro.tipoBgLegado !== filtroTipoBgLegado) return false;
        if (filtroMateriaLegado !== 'all' && registro.materiaLegado !== filtroMateriaLegado) return false;

        if (buscaGeralNormalizada && !registro.textoBusca.includes(buscaGeralNormalizada)) return false;
        if (buscaNomeMilitarNormalizada && !registro.nomeMilitarBusca.includes(buscaNomeMilitarNormalizada)) return false;
        if (buscaMatriculaNormalizada && !registro.matriculaBusca.includes(buscaMatriculaNormalizada)) return false;
        if (buscaNumeroBgNormalizada && !registro.numeroBgBusca.includes(buscaNumeroBgNormalizada)) return false;
        if (buscaTrechoNormalizada && !toSearch(`${registro.descricao} ${registro.texto_publicacao || ''}`).includes(buscaTrechoNormalizada)) return false;

        if (somentePublicados && !registro.publicado) return false;
        if (somenteComBg && !registro.comBg) return false;
        if (somenteClassificacaoPendente && !registro.classificacaoPendente) return false;
        if (somenteLegadoNaoClassificado && !registro.isLegadoNaoClassificado) return false;
        if (canManageAdminActions && somenteEditavelExcluivel && !registro.isEditavelExcluivel) return false;
        if (canManageAdminActions && somenteSistemaAdmin && registro.origemRegistro !== 'sistema') return false;

        return true;
      })
      .sort((a, b) => (b.dataEvento || '').localeCompare(a.dataEvento || ''));
  }, [
    buscaGeral,
    buscaNomeMilitar,
    buscaMatricula,
    canManageAdminActions,
    dataFinal,
    dataInicial,
    filtroMateriaLegado,
    filtroMilitarId,
    filtroNumeroBg,
    filtroOrigem,
    filtroStatus,
    filtroTipo,
    filtroTipoBgLegado,
    filtroTrechoLivre,
    militaresPorId,
    militarSelecionado,
    registros,
    somenteClassificacaoPendente,
    somenteComBg,
    somenteEditavelExcluivel,
    somenteLegadoNaoClassificado,
    somentePublicados,
    somenteSistemaAdmin,
  ]);

  const editarTipoMutation = useMutation({
    mutationFn: ({ registro, novoTipo }) => atualizarTipoRegistroMilitar(registro, novoTipo, { userEmail: user?.email }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registros-militar-registros'] });
      toast({
        title: 'Tipo atualizado',
        description: 'O tipo do registro foi atualizado com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar tipo',
        description: error?.message || 'Não foi possível atualizar o tipo do registro.',
      });
    },
  });

  const excluirRegistroMutation = useMutation({
    mutationFn: (registro) => excluirRegistroMilitar(registro),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registros-militar-registros'] });
      toast({
        title: 'Registro excluído',
        description: 'O registro foi excluído com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir registro',
        description: error?.message || 'Não foi possível excluir o registro.',
      });
    },
  });

  function handleSalvarTipo(registro) {
    if (!canEditarRegistros) return;
    const novoTipo = String(tipoEdicao[registro.id] || '').trim();
    if (!novoTipo) {
      toast({
        variant: 'destructive',
        title: 'Tipo inválido',
        description: 'Selecione um tipo válido antes de salvar.',
      });
      return;
    }

    editarTipoMutation.mutate({ registro, novoTipo });
  }

  function handleExcluirRegistro(registro) {
    if (!canExcluirRegistros) return;
    const mensagem = `Confirma a exclusão do registro de ${registro.militarNome} (${formatarData(registro.dataEvento)})? Esta ação não poderá ser desfeita.`;
    if (!window.confirm(mensagem)) return;

    excluirRegistroMutation.mutate(registro);
  }

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (!militarSelecionado) return;

    const total = registrosOrdenados.length;
    const legado = registrosOrdenados.filter((item) => item.origem_registro === 'legado').length;
    const sistema = total - legado;

    console.info('[RegistrosMilitar] Consulta por militar', {
      militar_id: militarSelecionado.id,
      militar_matricula: militarSelecionado.matricula,
      militar_nome: militarSelecionado.nome_completo,
      total,
      legado,
      sistema,
    });
  }, [militarSelecionado, registrosOrdenados]);

  if (loadingUser || !isAccessResolved) {
    return <div className="p-6">Carregando...</div>;
  }

  if (!canAccessRegistrosMilitar) {
    return <AccessDenied modulo="Registros do Militar" />;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-blue-100 p-2 text-blue-700">
          <ScrollText className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#1e3a5f]">Registros do Militar</h1>
          <p className="text-sm text-slate-600">Consulta cronológica e gestão administrativa de registros do militar.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {militarSelecionado && isMilitarMesclado(militarSelecionado) && (
            <div className="xl:col-span-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Este militar está com status <strong>MESCLADO</strong>. A consulta é administrativa e pode incluir dados históricos.
            </div>
          )}
          <div className="space-y-2 xl:col-span-2">
            <Label>Militar (nome, nome de guerra ou matrícula)</Label>
            <Popover open={openMilitarPopover} onOpenChange={setOpenMilitarPopover}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between">
                  {militarSelecionado
                    ? `${militarSelecionado.posto_graduacao ? `${militarSelecionado.posto_graduacao} ` : ''}${militarSelecionado.nome_guerra || militarSelecionado.nome_completo} • ${militarSelecionado.matricula || 'Sem matrícula'}`
                    : 'Todos os militares'}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[420px] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Buscar militar por nome, nome de guerra ou matrícula..."
                    value={buscaMilitar}
                    onValueChange={setBuscaMilitar}
                  />
                  <CommandEmpty>Nenhum militar encontrado.</CommandEmpty>
                  <CommandGroup className="max-h-64 overflow-auto">
                    <CommandItem
                      value="all"
                      onSelect={() => {
                        setFiltroMilitarId('all');
                        setOpenMilitarPopover(false);
                      }}
                    >
                      <Check className={`mr-2 h-4 w-4 ${filtroMilitarId === 'all' ? 'opacity-100' : 'opacity-0'}`} />
                      Todos os militares
                    </CommandItem>
                    {militaresFiltradosBusca.map((militar) => (
                      <CommandItem
                        key={militar.id}
                        value={militar.id}
                        onSelect={() => {
                          setFiltroMilitarId(militar.id);
                          setOpenMilitarPopover(false);
                        }}
                      >
                        <Check className={`mr-2 h-4 w-4 ${filtroMilitarId === militar.id ? 'opacity-100' : 'opacity-0'}`} />
                        {militar.posto_graduacao ? `${militar.posto_graduacao} ` : ''}
                        {militar.nome_guerra || militar.nome_completo}
                        <span className="ml-1 text-xs text-slate-500">• {militar.matricula || 'Sem matrícula'}</span>
                        {isMilitarMesclado(militar) && <Badge variant="outline" className="ml-2 border-amber-300 text-amber-700">MESCLADO</Badge>}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Busca textual ampla</Label>
            <Input
              value={buscaGeral}
              onChange={(event) => setBuscaGeral(event.target.value)}
              placeholder="Nome, matrícula, tipo, matéria, BG, trecho..."
            />
          </div>

          <div className="space-y-2">
            <Label>Busca por nome do militar</Label>
            <Input
              value={buscaNomeMilitar}
              onChange={(event) => setBuscaNomeMilitar(event.target.value)}
              placeholder="Nome completo ou nome de guerra"
            />
          </div>

          <div className="space-y-2">
            <Label>Matrícula</Label>
            <Input
              value={buscaMatricula}
              onChange={(event) => setBuscaMatricula(event.target.value)}
              placeholder="Filtrar por matrícula"
            />
          </div>

          <div className="space-y-2">
            <Label>Período inicial</Label>
            <Input type="date" value={dataInicial} onChange={(event) => setDataInicial(event.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Período final</Label>
            <Input type="date" value={dataFinal} onChange={(event) => setDataFinal(event.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Tipo de publicação</Label>
            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {tiposDisponiveisRegistros.map((tipo) => (
                  <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Status da publicação</Label>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {statusDisponiveis.map((status) => (
                  <SelectItem key={status} value={status}>{status}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Número BG</Label>
            <Input
              value={filtroNumeroBg}
              onChange={(event) => setFiltroNumeroBg(event.target.value)}
              placeholder="Ex.: 123"
            />
          </div>

          <div className="space-y-2">
            <Label>Origem do registro</Label>
            <Select value={filtroOrigem} onValueChange={setFiltroOrigem}>
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="sistema">Somente Sistema</SelectItem>
                <SelectItem value="legado">Somente Legado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Tipo BG legado</Label>
            <Select value={filtroTipoBgLegado} onValueChange={setFiltroTipoBgLegado}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {tiposBgLegadoDisponiveis.map((tipo) => (
                  <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Matéria legado</Label>
            <Select value={filtroMateriaLegado} onValueChange={setFiltroMateriaLegado}>
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {materiasLegadoDisponiveis.map((materia) => (
                  <SelectItem key={materia} value={materia}>{materia}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Busca no conteúdo/trecho</Label>
            <Input
              value={filtroTrechoLivre}
              onChange={(event) => setFiltroTrechoLivre(event.target.value)}
              placeholder="Trecho livre do texto"
            />
          </div>

          <div className="space-y-3 rounded-md border p-3 md:col-span-2 xl:col-span-3">
            <p className="text-sm font-medium text-slate-700">Filtros rápidos</p>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <Checkbox checked={somentePublicados} onCheckedChange={(checked) => setSomentePublicados(Boolean(checked))} />
                Somente publicados
              </label>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <Checkbox checked={somenteComBg} onCheckedChange={(checked) => setSomenteComBg(Boolean(checked))} />
                Somente com BG preenchido
              </label>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <Checkbox checked={somenteClassificacaoPendente} onCheckedChange={(checked) => setSomenteClassificacaoPendente(Boolean(checked))} />
                Somente classificação pendente
              </label>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <Checkbox checked={somenteLegadoNaoClassificado} onCheckedChange={(checked) => setSomenteLegadoNaoClassificado(Boolean(checked))} />
                Somente legado não classificado
              </label>

              {canManageAdminActions && (
                <>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <Checkbox checked={somenteEditavelExcluivel} onCheckedChange={(checked) => setSomenteEditavelExcluivel(Boolean(checked))} />
                    Somente registros excluíveis/editáveis
                  </label>

                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <Checkbox checked={somenteSistemaAdmin} onCheckedChange={(checked) => setSomenteSistemaAdmin(Boolean(checked))} />
                    Somente registros do sistema
                  </label>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Linha do tempo ({registrosOrdenados.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingMilitares || loadingRegistros ? (
            <p className="text-sm text-slate-500">Carregando registros...</p>
          ) : registrosOrdenados.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum registro encontrado para os filtros informados.</p>
          ) : (
            <ul className="space-y-3">
              {registrosOrdenados.map((registro) => {
                const expanded = expandedRegistroId === registro.id;
                const tipoVisual = getRegistroTipoVisual(registro.tipoRegistro, { isLegadoNaoClassificado: registro.isLegadoNaoClassificado });
                const TipoIcon = tipoVisual.icon;
                const origemLabel = registro.origemRegistro === 'legado' ? 'Legado' : 'Sistema';
                const statusBadgeClass = registro.publicado
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-blue-200 bg-blue-50 text-blue-700';

                return (
                  <li key={`${registro.origem_fonte || 'registro'}-${registro.id}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-slate-300">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-slate-900">{registro.militarNome}</p>
                        <div className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold ${tipoVisual.className}`}>
                          <TipoIcon className="h-3.5 w-3.5" />
                          <span>{registro.tipoRegistro || tipoVisual.label}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-medium text-slate-600">Data do registro</p>
                        <p className="text-sm font-semibold text-slate-900">{formatarData(registro.dataEvento)}</p>
                      </div>
                    </div>

                    <p className="mt-3 text-sm text-slate-700">{getResumoTexto(registro.descricao)}</p>

                    <div className="mt-3 grid gap-2 text-xs text-slate-600 md:grid-cols-2 xl:grid-cols-4">
                      <p className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1"><strong>Status:</strong> {registro.statusPublicacao}</p>
                      <p className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1"><strong>Origem:</strong> {origemLabel}</p>
                      <p className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1"><strong>BG:</strong> {registro.numero_bg || '-'}</p>
                      <p className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1"><strong>Matrícula:</strong> {registro.militar_matricula || registro.matricula_legado || '-'}</p>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="outline" className={registro.origemRegistro === 'legado' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-slate-200 bg-slate-100 text-slate-700'}>
                        {origemLabel}
                      </Badge>
                      <Badge variant="outline" className={statusBadgeClass}>
                        {registro.statusPublicacao}
                      </Badge>
                      {registro.classificacaoPendente && (
                        <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700">
                          Classificação pendente
                        </Badge>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setExpandedRegistroId(expanded ? null : registro.id)}
                      >
                        {expanded ? <EyeOff className="mr-1 h-4 w-4" /> : <Eye className="mr-1 h-4 w-4" />}
                        {expanded ? 'Ocultar detalhes' : 'Ver detalhes'}
                      </Button>

                      {canManageAdminActions && (
                        <>
                          {canEditarRegistros && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setExpandedRegistroId(registro.id);
                                setTipoEdicao((prev) => ({ ...prev, [registro.id]: prev[registro.id] || registro.tipoRegistro }));
                              }}
                            >
                              <Pencil className="mr-1 h-4 w-4" />
                              Editar tipo
                            </Button>
                          )}
                          {canExcluirRegistros && (
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => handleExcluirRegistro(registro)}
                              disabled={excluirRegistroMutation.isPending}
                            >
                              <Trash2 className="mr-1 h-4 w-4" />
                              Excluir
                            </Button>
                          )}
                        </>
                      )}
                    </div>

                    {expanded && (
                      <div className="mt-4 rounded-md border bg-slate-50 p-3 space-y-3">
                        <p className="text-xs text-slate-600">
                          <strong>Texto completo:</strong> {registro.texto_publicacao || registro.descricao || '-'}
                        </p>

                        <div className="grid gap-2 text-xs text-slate-600 md:grid-cols-2">
                          <p><strong>Militar vinculado:</strong> {registro.militarNome}</p>
                          <p><strong>Matrícula:</strong> {registro.militar_matricula || registro.matricula_legado || '-'}</p>
                          <p><strong>Tipo BG legado:</strong> {registro.tipoBgLegado || '-'}</p>
                          <p><strong>Matéria legado:</strong> {registro.materiaLegado || '-'}</p>
                          <p><strong>Origem da fonte:</strong> {registro.origem_fonte}</p>
                          <p><strong>BG:</strong> {registro.numero_bg || '-'}</p>
                        </div>

                        {canEditarRegistros && (
                          <div className="space-y-2 rounded-md border border-red-100 bg-white p-3">
                            <p className="text-xs font-semibold text-slate-700">Ações administrativas</p>
                            <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                              <Select
                                value={String(tipoEdicao[registro.id] || registro.tipoRegistro || '')}
                                onValueChange={(value) => setTipoEdicao((prev) => ({ ...prev, [registro.id]: value }))}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione um tipo" />
                                </SelectTrigger>
                                <SelectContent>
                                  {tiposValidos.map((tipo) => (
                                    <SelectItem key={tipo.value} value={tipo.value}>{tipo.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button
                                type="button"
                                onClick={() => handleSalvarTipo(registro)}
                                disabled={editarTipoMutation.isPending}
                              >
                                Salvar tipo
                              </Button>
                            </div>
                            <p className="text-[11px] text-slate-500">
                              Alterações de tipo são restritas ao admin e, quando possível, registram usuário/data da alteração.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {!canManageAdminActions && (
        <p className="text-xs text-slate-500">
          Modo consulta: ações administrativas exigem perfil admin, modo administrativo e permissão específica da ação.
        </p>
      )}
    </div>
  );
}
