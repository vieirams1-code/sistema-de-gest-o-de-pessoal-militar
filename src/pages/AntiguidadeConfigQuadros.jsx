import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, ExternalLink, Info, LockKeyhole } from 'lucide-react';
import { ORDEM_GRUPOS_QUADROS_ANTIGUIDADE } from '@/utils/antiguidade/ordemQuadrosAntiguidade';
import { createPageUrl } from '@/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const STATUS_PADRAO = 'Pendente de confirmação institucional';

const badgesInstitucionais = [
  'Read-only',
  'Prévia não oficial',
  'Pendente de confirmação institucional',
  'Fonte: regra técnica do código',
  'Sem persistência',
];

function texto(valor) {
  return String(valor ?? '').trim();
}

function normalizarMembro(valor) {
  return texto(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function obterStatus(grupo) {
  return texto(grupo?.status || grupo?.situacao || grupo?.confirmacaoInstitucional || grupo?.statusConfirmacao) || STATUS_PADRAO;
}

function calcularValidacoes(grupos) {
  const alertas = [];
  const indices = new Map();
  const membros = new Map();

  grupos.forEach((grupo, posicao) => {
    const identificador = texto(grupo?.grupo) || `Grupo sem nome #${posicao + 1}`;
    const indice = grupo?.indice;
    const indiceKey = indice === undefined || indice === null ? '' : String(indice);
    const membrosGrupo = Array.isArray(grupo?.membros) ? grupo.membros : [];

    if (!texto(grupo?.grupo)) {
      alertas.push(`Grupo na posição ${posicao + 1} está sem nome.`);
    }

    if (membrosGrupo.length === 0) {
      alertas.push(`${identificador} está sem membros equivalentes.`);
    }

    if (indiceKey) {
      const gruposMesmoIndice = indices.get(indiceKey) || [];
      gruposMesmoIndice.push(identificador);
      indices.set(indiceKey, gruposMesmoIndice);
    }

    membrosGrupo.forEach((membro) => {
      const membroNormalizado = normalizarMembro(membro);
      if (!membroNormalizado) return;
      const ocorrencias = membros.get(membroNormalizado) || [];
      ocorrencias.push({ membro: texto(membro), grupo: identificador });
      membros.set(membroNormalizado, ocorrencias);
    });
  });

  indices.forEach((gruposMesmoIndice, indice) => {
    if (gruposMesmoIndice.length > 1) {
      alertas.push(`Índice duplicado ${indice} nos grupos: ${gruposMesmoIndice.join(', ')}.`);
    }
  });

  membros.forEach((ocorrencias, membroNormalizado) => {
    const gruposUnicos = Array.from(new Set(ocorrencias.map((ocorrencia) => ocorrencia.grupo)));
    if (gruposUnicos.length > 1) {
      const membrosOriginais = Array.from(new Set(ocorrencias.map((ocorrencia) => ocorrencia.membro))).join(', ');
      alertas.push(`Membro repetido após normalização (${membroNormalizado}; originais: ${membrosOriginais}) nos grupos: ${gruposUnicos.join(', ')}.`);
    }
  });

  return alertas;
}

export default function AntiguidadeConfigQuadros() {
  const grupos = ORDEM_GRUPOS_QUADROS_ANTIGUIDADE;
  const validacoes = useMemo(() => calcularValidacoes(grupos), [grupos]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-slate-900 p-3 text-white shadow-sm">
              <LockKeyhole className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Antiguidade • conferência técnica</p>
              <h1 className="text-2xl font-bold text-[#1e3a5f]">Configuração de Quadros para Antiguidade</h1>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {badgesInstitucionais.map((badge) => (
              <Badge key={badge} variant="outline" className="border-slate-300 bg-white text-slate-700">
                {badge}
              </Badge>
            ))}
          </div>
        </div>

        <Button asChild variant="outline" className="w-full lg:w-auto">
          <Link to={createPageUrl('AntiguidadePrevia')}>
            Abrir Prévia Geral
            <ExternalLink className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      <Alert className="border-amber-200 bg-amber-50 text-amber-900">
        <AlertCircle className="h-4 w-4 text-amber-700" />
        <AlertTitle>Configuração técnica inicial. Necessita confirmação institucional antes de uso em listagem oficial.</AlertTitle>
        <AlertDescription>
          Esta tela apenas exibe a regra técnica atualmente usada na prévia. Não permite edição, não grava dados e não altera a listagem oficial.
        </AlertDescription>
      </Alert>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="space-y-2">
          <CardTitle className="flex items-center gap-2 text-lg text-slate-900">
            <Info className="h-5 w-5 text-slate-600" />
            Validações informativas
          </CardTitle>
          <p className="text-sm text-slate-600">
            As verificações abaixo são calculadas localmente a partir da regra técnica do código e não bloqueiam nenhum fluxo.
          </p>
        </CardHeader>
        <CardContent>
          {validacoes.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
              <CheckCircle2 className="h-4 w-4" />
              Nenhum conflito encontrado.
            </div>
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="mb-2 font-semibold">Inconsistências informativas encontradas:</p>
              <ul className="list-disc space-y-1 pl-5">
                {validacoes.map((validacao) => (
                  <li key={validacao}>{validacao}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg text-slate-900">Grupos de equivalência de quadros</CardTitle>
          <p className="text-sm text-slate-600">
            Fonte única desta tela: ORDEM_GRUPOS_QUADROS_ANTIGUIDADE em src/utils/antiguidade/ordemQuadrosAntiguidade.js.
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead className="w-24">Índice</TableHead>
                <TableHead className="w-36">Grupo</TableHead>
                <TableHead>Membros equivalentes</TableHead>
                <TableHead>Observação</TableHead>
                <TableHead className="w-64">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grupos.map((grupo, posicao) => {
                const membros = Array.isArray(grupo?.membros) ? grupo.membros : [];
                const nomeGrupo = texto(grupo?.grupo) || '—';

                return (
                  <TableRow key={`${nomeGrupo}-${grupo?.indice ?? posicao}`}>
                    <TableCell className="font-mono font-semibold text-slate-800">{grupo?.indice ?? '—'}</TableCell>
                    <TableCell className="font-semibold text-slate-900">{nomeGrupo}</TableCell>
                    <TableCell>
                      {membros.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {membros.map((membro) => (
                            <Badge key={`${nomeGrupo}-${membro}`} variant="secondary" className="bg-slate-100 text-slate-800 hover:bg-slate-100">
                              {membro}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-500">Sem membros informados</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xl text-slate-700">{texto(grupo?.observacao) || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">
                        {obterStatus(grupo)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
