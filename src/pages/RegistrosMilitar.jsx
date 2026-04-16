import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollText } from 'lucide-react';
import { listarRegistrosMilitar, vinculaRegistroAoMilitar } from '@/services/registrosMilitarService';

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

export default function RegistrosMilitar() {
  const { isAccessResolved, isLoading: loadingUser, canAccessModule } = useCurrentUser();
  const [filtroMilitarId, setFiltroMilitarId] = useState('all');
  const [busca, setBusca] = useState('');

  const canAccessMilitares = canAccessModule('militares');

  const { data: militares = [], isLoading: loadingMilitares } = useQuery({
    queryKey: ['registros-militar-militares'],
    queryFn: () => base44.entities.Militar.list('-created_date', 10000),
    enabled: isAccessResolved && canAccessMilitares,
  });

  const { data: registros = [], isLoading: loadingRegistros } = useQuery({
    queryKey: ['registros-militar-registros'],
    queryFn: listarRegistrosMilitar,
    enabled: isAccessResolved && canAccessMilitares,
  });

  const militaresPorId = useMemo(
    () => militares.reduce((acc, militar) => {
      acc[militar.id] = militar;
      return acc;
    }, {}),
    [militares],
  );

  const militarSelecionado = useMemo(() => {
    if (filtroMilitarId === 'all') return null;
    return militaresPorId[filtroMilitarId] || null;
  }, [filtroMilitarId, militaresPorId]);

  const registrosOrdenados = useMemo(() => {
    const buscaLower = busca.trim().toLowerCase();

    return registros
      .filter((registro) => {
        if (militarSelecionado && !vinculaRegistroAoMilitar(registro, militarSelecionado)) return false;

        if (!buscaLower) return true;

        const militar = militaresPorId[registro?.militar_id] || {};
        const nomeMilitar = [
          militar?.posto_graduacao,
          militar?.nome_guerra || militar?.nome_completo,
          registro?.militar_nome,
          registro?.militar_matricula,
        ].filter(Boolean).join(' ').toLowerCase();

        const textoRegistro = [
          extrairDescricao(registro),
          registro?.numero_bg,
          registro?.tipo_registro,
          registro?.tipo,
          registro?.origem_tipo,
          registro?.origem_registro,
          getStatusPublicacaoLabel(registro),
        ].join(' ').toLowerCase();

        return nomeMilitar.includes(buscaLower) || textoRegistro.includes(buscaLower);
      })
      .map((registro) => {
        const militar = militaresPorId[registro?.militar_id] || {};
        const dataEvento = normalizarDataISO(
          registro?.data_evento || registro?.data_publicacao || registro?.data_bg || registro?.created_date,
        );

        const nomeRegistro = String(registro?.militar_nome || '').trim();
        const militarNome = nomeRegistro
          || `${militar?.posto_graduacao ? `${militar.posto_graduacao} ` : ''}${militar?.nome_guerra || militar?.nome_completo || 'Militar não identificado'}`;

        return {
          ...registro,
          dataEvento,
          descricao: extrairDescricao(registro),
          militarNome,
        };
      })
      .sort((a, b) => (b.dataEvento || '').localeCompare(a.dataEvento || ''));
  }, [busca, militarSelecionado, militaresPorId, registros]);

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

  if (!canAccessMilitares) {
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
          <p className="text-sm text-slate-600">Consulta cronológica dos registros vinculados ao militar.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Militar</Label>
            <Select value={filtroMilitarId} onValueChange={setFiltroMilitarId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os militares</SelectItem>
                {militares.map((militar) => (
                  <SelectItem key={militar.id} value={militar.id}>
                    {militar.posto_graduacao ? `${militar.posto_graduacao} ` : ''}
                    {militar.nome_guerra || militar.nome_completo || 'Militar sem nome'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Buscar</Label>
            <Input
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Pesquisar por tipo, descrição, origem ou BG"
            />
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
              {registrosOrdenados.map((registro) => (
                <li key={`${registro.origem_fonte || 'registro'}-${registro.id}`} className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{registro.militarNome}</p>
                    <p className="text-xs text-slate-500">{formatarData(registro.dataEvento)}</p>
                  </div>
                  <p className="mt-1 text-sm text-slate-700">{registro.descricao}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    Tipo: {registro.tipo_registro || registro.tipo || '-'} • BG: {registro.numero_bg || '-'}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${registro.origem_registro === 'legado' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>
                      {registro.origem_registro === 'legado' ? 'Legado' : 'Sistema'}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                      {getStatusPublicacaoLabel(registro)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
