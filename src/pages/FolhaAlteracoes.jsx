import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileSpreadsheet, Printer } from 'lucide-react';

function formatarData(isoDate) {
  if (!isoDate) return '-';
  const [ano, mes, dia] = String(isoDate).split('-');
  if (!ano || !mes || !dia) return isoDate;
  return `${dia}/${mes}/${ano}`;
}

export default function FolhaAlteracoes() {
  const {
    isAdmin,
    subgrupamentoId,
    subgrupamentoTipo,
    modoAcesso,
    userEmail,
    linkedMilitarId,
    linkedMilitarEmail,
    hasSelfAccess,
    canAccessModule,
    getMilitarScopeFilters,
    isLoading: loadingUser,
    isAccessResolved,
  } = useCurrentUser();

  const [filtroMilitarId, setFiltroMilitarId] = useState('');
  const [dataInicial, setDataInicial] = useState('');
  const [dataFinal, setDataFinal] = useState('');
  const [previa, setPrevia] = useState(null);

  const { data: militares = [], isLoading: loadingMilitares } = useQuery({
    queryKey: ['folha-alteracoes-militares', isAdmin, subgrupamentoId, subgrupamentoTipo, modoAcesso, userEmail, linkedMilitarId, linkedMilitarEmail],
    queryFn: async () => {
      if (isAdmin) {
        const listaAdmin = await base44.entities.Militar.list('-nome_completo');
        return listaAdmin.filter((m) => m.status_cadastro !== 'Inativo');
      }

      if (modoAcesso === 'proprio') {
        const knownEmails = [userEmail, linkedMilitarEmail].filter(Boolean);
        if (!linkedMilitarId && knownEmails.length === 0) return [];

        const requests = [];
        if (linkedMilitarId) requests.push(base44.entities.Militar.filter({ id: linkedMilitarId }, '-nome_completo'));
        for (const email of knownEmails) {
          requests.push(base44.entities.Militar.filter({ email }, '-nome_completo'));
          requests.push(base44.entities.Militar.filter({ email_particular: email }, '-nome_completo'));
          requests.push(base44.entities.Militar.filter({ email_funcional: email }, '-nome_completo'));
          requests.push(base44.entities.Militar.filter({ created_by: email }, '-nome_completo'));
          requests.push(base44.entities.Militar.filter({ militar_email: email }, '-nome_completo'));
        }

        const batches = await Promise.all(requests);
        const ids = new Set();
        return batches
          .flat()
          .filter((m) => m.status_cadastro !== 'Inativo')
          .filter((m) => {
            if (!hasSelfAccess(m) || ids.has(m.id)) return false;
            ids.add(m.id);
            return true;
          });
      }

      const filters = getMilitarScopeFilters();
      if (!filters.length) return [];

      const requests = filters.map((filtro) => base44.entities.Militar.filter(filtro, '-nome_completo'));
      const batches = await Promise.all(requests);
      const ids = new Set();
      return batches
        .flat()
        .filter((m) => m.status_cadastro !== 'Inativo')
        .filter((m) => {
          if (ids.has(m.id)) return false;
          ids.add(m.id);
          return true;
        });
    },
    enabled: isAccessResolved,
  });

  const militaresOrdenados = useMemo(
    () => [...militares].sort((a, b) => (a.nome_completo || '').localeCompare(b.nome_completo || '')),
    [militares]
  );

  const militarSelecionado = useMemo(
    () => militaresOrdenados.find((militar) => militar.id === filtroMilitarId) || null,
    [militaresOrdenados, filtroMilitarId]
  );

  const periodoValido = Boolean(dataInicial && dataFinal && dataInicial <= dataFinal);

  const handleGerarPrevia = () => {
    if (!militarSelecionado || !periodoValido) return;

    setPrevia({
      militar: militarSelecionado,
      periodo: {
        dataInicial,
        dataFinal,
      },
      geradoEm: new Date().toISOString(),
    });
  };

  if (!loadingUser && isAccessResolved && !canAccessModule('militares')) {
    return <AccessDenied modulo="Efetivo" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[#1e3a5f]">Folha de Alterações</h1>
            <p className="text-slate-500 mt-1">
              Geração e impressão da folha de alterações do militar (versão inicial de prévia em tela).
            </p>
          </div>
          <div className="hidden md:flex h-12 w-12 items-center justify-center rounded-xl bg-[#1e3a5f]/10 text-[#1e3a5f]">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
        </div>

        <Card className="shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg text-[#1e3a5f]">Filtros</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2 md:col-span-3">
                <label className="text-sm font-medium text-slate-700">Militar</label>
                <Select value={filtroMilitarId} onValueChange={setFiltroMilitarId}>
                  <SelectTrigger>
                    <SelectValue placeholder={loadingMilitares ? 'Carregando militares...' : 'Selecione um militar'} />
                  </SelectTrigger>
                  <SelectContent>
                    {militaresOrdenados.map((militar) => (
                      <SelectItem key={militar.id} value={militar.id}>
                        {(militar.posto_graduacao ? `${militar.posto_graduacao} ` : '') + (militar.nome_guerra || militar.nome_completo)}
                        {militar.matricula ? ` • Mat ${militar.matricula}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Data inicial</label>
                <Input type="date" value={dataInicial} onChange={(event) => setDataInicial(event.target.value)} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Data final</label>
                <Input type="date" value={dataFinal} onChange={(event) => setDataFinal(event.target.value)} />
              </div>

              <div className="flex items-end">
                <Button
                  className="w-full bg-[#1e3a5f] hover:bg-[#2d4a6f]"
                  onClick={handleGerarPrevia}
                  disabled={!militarSelecionado || !periodoValido}
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Gerar prévia
                </Button>
              </div>
            </div>

            {!!dataInicial && !!dataFinal && dataInicial > dataFinal && (
              <p className="text-sm text-red-600">A data inicial não pode ser maior que a data final.</p>
            )}
          </CardContent>
        </Card>

        {previa && (
          <Card className="shadow-sm border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg text-[#1e3a5f]">Prévia da Folha de Alterações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Nome</p>
                  <p className="font-semibold text-slate-800">{previa.militar.nome_completo || '-'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Matrícula</p>
                  <p className="font-semibold text-slate-800">{previa.militar.matricula || '-'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Posto/Graduação</p>
                  <p className="font-semibold text-slate-800">{previa.militar.posto_graduacao || '-'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Quadro</p>
                  <p className="font-semibold text-slate-800">{previa.militar.quadro || '-'}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-slate-500">Unidade/Lotação</p>
                  <p className="font-semibold text-slate-800">
                    {previa.militar.unidade || previa.militar.unidade_lotacao || previa.militar.lotacao || '-'}
                  </p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-slate-500">Período selecionado</p>
                  <p className="font-semibold text-slate-800">
                    {formatarData(previa.periodo.dataInicial)} até {formatarData(previa.periodo.dataFinal)}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-700 mb-2">Histórico por ano/mês (área reservada)</p>
                <div className="space-y-2 text-sm text-slate-600">
                  <p>• AAAA/MM — Registro de alteração 1 (placeholder)</p>
                  <p>• AAAA/MM — Registro de alteração 2 (placeholder)</p>
                  <p>• AAAA/MM — Registro de alteração 3 (placeholder)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
