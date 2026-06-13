import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Archive, CheckCircle2, FileText, Search, Trash2, Users, XCircle } from 'lucide-react';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import {
  calcularIndicadoresAcervo,
  filtrarResumoAcervo,
  montarResumoAcervoPorMilitar,
  TIPOS_DOCUMENTAIS_ACERVO,
} from '@/services/acervoHistoricoService';

const tipoOptions = [
  { value: 'TODOS', label: 'Todos' },
  { value: TIPOS_DOCUMENTAIS_ACERVO.ALTERACAO, label: 'Alterações' },
  { value: TIPOS_DOCUMENTAIS_ACERVO.CERTIDAO_COMPORTAMENTO, label: 'Certidões' },
  { value: TIPOS_DOCUMENTAIS_ACERVO.DIVERSOS, label: 'Diversos' },
];

const situacaoOptions = [
  { value: 'TODAS', label: 'Todas' },
  { value: 'COMPLETA', label: 'Documentação completa' },
  { value: 'PARCIAL', label: 'Documentação parcial' },
  { value: 'SEM_DOCUMENTACAO', label: 'Sem documentação' },
];

export default function DashboardAcervo() {
  const { canAccessAction } = useCurrentUser();
  const [filtros, setFiltros] = React.useState({
    nome: '',
    matricula: '',
    unidade: '',
    tipo_documental: 'TODOS',
    situacao: 'TODAS',
  });

  const podeVisualizarAcervo = canAccessAction('visualizar_acervo_historico');

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-acervo-simplificado'],
    queryFn: async () => {
      const [acervo, militares] = await Promise.all([
        base44.entities.AcervoFuncionalHistorico.list(),
        base44.entities.Militar.list(),
      ]);
      const linhas = montarResumoAcervoPorMilitar({ militares, acervo });
      return { linhas, indicadores: calcularIndicadoresAcervo(linhas) };
    },
    enabled: podeVisualizarAcervo,
  });

  const linhasFiltradas = React.useMemo(
    () => filtrarResumoAcervo(data?.linhas || [], filtros),
    [data?.linhas, filtros],
  );

  const atualizarFiltro = (campo, valor) => setFiltros((prev) => ({ ...prev, [campo]: valor }));

  if (!podeVisualizarAcervo) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <Card>
          <CardContent className="py-10 text-center text-slate-600">
            Sem permissão para visualizar o acervo histórico.
          </CardContent>
        </Card>
      </div>
    );
  }

  const indicadores = data?.indicadores || {};

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#1e3a5f] mb-2 flex items-center gap-2">
          <Archive className="w-6 h-6" /> Documentos Históricos
        </h1>
        <p className="text-slate-500">Gestão centralizada do complemento eletrônico dos assentamentos funcionais físicos.</p>
      </div>

      <div className="grid md:grid-cols-3 xl:grid-cols-6 gap-4">
        <MetricCard title="Militares com documentos" value={indicadores.militaresComDocumentos} icon={Users} color="emerald" />
        <MetricCard title="Militares sem documentos" value={indicadores.militaresSemDocumentos} icon={Users} color="amber" />
        <MetricCard title="Total de Alterações" value={indicadores.totalAlteracoes} icon={FileText} color="blue" />
        <MetricCard title="Total de Certidões" value={indicadores.totalCertidoes} icon={FileText} color="indigo" />
        <MetricCard title="Total de Diversos" value={indicadores.totalDiversos} icon={FileText} color="slate" />
        <MetricCard title="Documentos na lixeira" value={indicadores.documentosLixeira} icon={Trash2} color="red" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-[#1e3a5f]"><Search className="w-5 h-5" /> Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-5 gap-4">
          <FilterInput label="Nome" value={filtros.nome} onChange={(v) => atualizarFiltro('nome', v)} />
          <FilterInput label="Matrícula" value={filtros.matricula} onChange={(v) => atualizarFiltro('matricula', v)} />
          <FilterInput label="Unidade" value={filtros.unidade} onChange={(v) => atualizarFiltro('unidade', v)} />
          <SelectFilter label="Tipo documental" value={filtros.tipo_documental} options={tipoOptions} onChange={(v) => atualizarFiltro('tipo_documental', v)} />
          <SelectFilter label="Situação" value={filtros.situacao} options={situacaoOptions} onChange={(v) => atualizarFiltro('situacao', v)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-[#1e3a5f]">Efetivo e documentação histórica</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Militar</TableHead>
                <TableHead>Matrícula</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead className="text-right">Qtd Alterações</TableHead>
                <TableHead className="text-right">Qtd Certidões</TableHead>
                <TableHead className="text-right">Qtd Diversos</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-slate-500">Carregando documentos históricos...</TableCell></TableRow>
              ) : linhasFiltradas.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-slate-500">Nenhum militar encontrado para os filtros selecionados.</TableCell></TableRow>
              ) : linhasFiltradas.map((linha) => (
                <TableRow key={linha.militar_id}>
                  <TableCell className="font-medium">{linha.nome || linha.nome_completo || '-'}</TableCell>
                  <TableCell>{linha.matricula || '-'}</TableCell>
                  <TableCell>{linha.unidade || '-'}</TableCell>
                  <TableCell className="text-right">{linha.alteracoes}</TableCell>
                  <TableCell className="text-right">{linha.certidoes}</TableCell>
                  <TableCell className="text-right">{linha.diversos}</TableCell>
                  <TableCell className="text-right font-bold">{linha.total}</TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="outline" size="sm">
                      <Link to={`${createPageUrl('VerMilitar')}?id=${linha.militar_id}&tab=acervo-historico`}>Abrir acervo</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-[#1e3a5f]">Pendências de Digitalização</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-4 gap-4">
            <MetricCard title="Efetivo total" value={indicadores.efetivoTotal} icon={Users} color="slate" compact />
            <MetricCard title="Com documentação completa" value={indicadores.documentacaoCompleta} icon={CheckCircle2} color="emerald" compact />
            <MetricCard title="Com documentação parcial" value={indicadores.documentacaoParcial} icon={FileText} color="amber" compact />
            <MetricCard title="Sem documentação" value={indicadores.semDocumentacao} icon={XCircle} color="red" compact />
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Militar</TableHead>
                <TableHead>Matrícula</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>Alterações</TableHead>
                <TableHead>Certidões</TableHead>
                <TableHead>Diversos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhasFiltradas.map((linha) => (
                <TableRow key={`pendencia-${linha.militar_id}`}>
                  <TableCell className="font-medium">{linha.nome || linha.nome_completo || '-'}</TableCell>
                  <TableCell>{linha.matricula || '-'}</TableCell>
                  <TableCell>{linha.unidade || '-'}</TableCell>
                  <StatusCell ok={linha.alteracoes > 0} textoOk={`${linha.alteracoes} período(s)`} />
                  <StatusCell ok={linha.certidoes > 0} textoOk={`${linha.certidoes} documento(s)`} />
                  <StatusCell ok={linha.diversos > 0} textoOk={`${linha.diversos} documento(s)`} />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ title, value, icon: Icon, color = 'slate', compact = false }) {
  const colorMap = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    red: 'bg-red-50 text-red-700 border-red-100',
    slate: 'bg-slate-50 text-slate-700 border-slate-100',
  };

  return (
    <Card className={`border ${colorMap[color] || colorMap.slate}`}>
      <CardContent className={compact ? 'p-4' : 'p-5'}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium opacity-80">{title}</p>
            <p className="text-2xl font-bold mt-1">{value ?? 0}</p>
          </div>
          {Icon && <Icon className="w-7 h-7 opacity-70" />}
        </div>
      </CardContent>
    </Card>
  );
}

function FilterInput({ label, value, onChange }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function SelectFilter({ label, value, options, onChange }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function StatusCell({ ok, textoOk }) {
  return (
    <TableCell>
      <Badge className={ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>
        {ok ? `✓ ${textoOk}` : '❌ Não possui documento'}
      </Badge>
    </TableCell>
  );
}
