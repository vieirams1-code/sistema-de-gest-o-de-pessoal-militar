/**
 * AccessEvidenceMatrixSection.jsx — P1.2-C2 (VISUAL / READ-ONLY)
 * ============================================================================
 * Seção visual "Mapa de Saneamento" para o painel /DiagnosticoAcesso.
 *
 *  - Puramente visual / read-only.
 *  - Consome apenas getEvidenceByModule() do accessEvidenceMatrix (documental).
 *  - NÃO chama backend, base44.entities, storage, navigate.
 *  - NÃO aplica permissões, NÃO faz enforcement, NÃO decide acesso real.
 *  - NÃO exibe PII nem dados operacionais individuais.
 *  - Usa apenas useState/useMemo para filtros locais (sem persistência).
 * ============================================================================
 */

import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ClipboardList, Info, ListChecks } from 'lucide-react';
import {
  getEvidenceByModule,
  ACCESS_EVIDENCE_SEVERITIES,
  ACCESS_EVIDENCE_DECISIONS,
} from '@/config/accessEvidenceMatrix';

// ----------------------------------------------------------------------------
// Estilos documentais (linguagem neutra — sem cadeado/bloqueio)
// ----------------------------------------------------------------------------
const SEVERITY_STYLES = {
  info: 'bg-slate-100 text-slate-600 border-slate-200',
  baixa: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  media: 'bg-amber-50 text-amber-700 border-amber-200',
  alta: 'bg-rose-50 text-rose-700 border-rose-200',
};

const SEVERITY_LABELS = {
  info: 'Info',
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
};

const DECISION_LABELS = {
  manter_como_esta: 'Manter como está',
  documentar_apenas: 'Documentar apenas',
  corrigir_menu: 'Corrigir menu',
  corrigir_rota: 'Corrigir rota',
  avaliar_action_key: 'Avaliar actionKey',
  avaliar_admin_only: 'Avaliar adminOnly',
  tratar_como_contextual: 'Tratar como contextual',
  revisar_backend_escopo: 'Revisar backend/escopo',
  candidato_enforcement_futuro: 'Candidato futuro',
  manter_monitoramento: 'Manter monitoramento',
};

const SEVERITY_OPTIONS = ['todas', ...Object.values(ACCESS_EVIDENCE_SEVERITIES)];
const DECISION_OPTIONS = ['todas', ...Object.values(ACCESS_EVIDENCE_DECISIONS)];
const CANDIDATE_OPTIONS = [
  { value: 'todos', label: 'Todos' },
  { value: 'candidatos', label: 'Candidatos a ação futura' },
  { value: 'nao_candidatos', label: 'Não candidatos' },
];

const labelDecision = (value) => DECISION_LABELS[value] || value || '—';
const labelSeverity = (value) => SEVERITY_LABELS[value] || value || '—';

function SummaryCard({ icon: Icon, label, value }) {
  return (
    <div className="rounded-lg border bg-white p-3 flex items-center gap-3">
      <div className="rounded-md bg-slate-50 p-2 text-slate-500">
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-semibold text-slate-800 leading-none">{value}</p>
        <p className="text-[11px] text-slate-500 mt-1 leading-tight">{label}</p>
      </div>
    </div>
  );
}

export default function AccessEvidenceMatrixSection({ moduleKey }) {
  const items = useMemo(() => getEvidenceByModule(moduleKey), [moduleKey]);

  const [severityFilter, setSeverityFilter] = useState('todas');
  const [decisionFilter, setDecisionFilter] = useState('todas');
  const [candidateFilter, setCandidateFilter] = useState('todos');

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (severityFilter !== 'todas' && item.severity !== severityFilter) return false;
      if (decisionFilter !== 'todas' && item.recommendedDecision !== decisionFilter) return false;
      if (candidateFilter === 'candidatos' && !item.enforcementCandidate) return false;
      if (candidateFilter === 'nao_candidatos' && item.enforcementCandidate) return false;
      return true;
    });
  }, [items, severityFilter, decisionFilter, candidateFilter]);

  const summary = useMemo(() => {
    const total = items.length;
    const candidatos = items.filter((i) => i.enforcementCandidate).length;
    const documentais = items.filter(
      (i) => i.severity === ACCESS_EVIDENCE_SEVERITIES.INFO
        || i.severity === ACCESS_EVIDENCE_SEVERITIES.BAIXA
        || i.recommendedDecision === ACCESS_EVIDENCE_DECISIONS.MANTER_MONITORAMENTO,
    ).length;
    const emRevisao = items.filter((i) => i.requiresHumanValidation).length;
    return { total, candidatos, documentais, emRevisao };
  }, [items]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <ClipboardList className="w-4 h-4 text-slate-500" />
          Mapa de Saneamento (Matriz de Evidências)
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="border-blue-200 bg-blue-50">
          <Info className="w-4 h-4 text-blue-600" />
          <AlertDescription className="text-blue-800 text-sm">
            Painel de planejamento documental. As sugestões aqui listadas não possuem efeito
            operacional, não aplicam permissões e não bloqueiam acessos. Qualquer mudança futura
            depende de validação técnica e aprovação módulo a módulo.
          </AlertDescription>
        </Alert>

        {items.length === 0 ? (
          <p className="text-sm text-slate-500 italic py-4 text-center">
            Nenhuma evidência documental cadastrada para este módulo.
          </p>
        ) : (
          <>
            {/* Cards de resumo */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              <SummaryCard icon={ListChecks} label="Total de evidências" value={summary.total} />
              <SummaryCard icon={ClipboardList} label="Candidatos a ação futura" value={summary.candidatos} />
              <SummaryCard icon={Info} label="Documentais / monitoramento" value={summary.documentais} />
              <SummaryCard icon={ListChecks} label="Em revisão" value={summary.emRevisao} />
            </div>

            {/* Filtros locais */}
            <div className="flex flex-wrap gap-2 text-xs">
              <label className="flex items-center gap-1 text-slate-500">
                Severidade:
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-700"
                >
                  {SEVERITY_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt === 'todas' ? 'Todas' : labelSeverity(opt)}</option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-1 text-slate-500">
                Decisão:
                <select
                  value={decisionFilter}
                  onChange={(e) => setDecisionFilter(e.target.value)}
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-700"
                >
                  {DECISION_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt === 'todas' ? 'Todas' : labelDecision(opt)}</option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-1 text-slate-500">
                Candidato:
                <select
                  value={candidateFilter}
                  onChange={(e) => setCandidateFilter(e.target.value)}
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-700"
                >
                  {CANDIDATE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>
            </div>

            {/* Tabela compacta */}
            {filteredItems.length === 0 ? (
              <p className="text-sm text-slate-500 italic py-4 text-center">
                Nenhuma evidência corresponde aos filtros selecionados.
              </p>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[90px]">Superfície</TableHead>
                      <TableHead className="w-[140px]">PageKey</TableHead>
                      <TableHead>Achado</TableHead>
                      <TableHead className="w-[80px]">Severidade</TableHead>
                      <TableHead className="w-[150px]">Decisão</TableHead>
                      <TableHead className="w-[90px]">Próxima fase</TableHead>
                      <TableHead>Observações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map((item) => (
                      <TableRow key={item.id} className="align-top">
                        <TableCell className="text-[11px] text-slate-500 break-words">{item.surface}</TableCell>
                        <TableCell className="text-[11px] font-mono text-slate-700 break-words">{item.pageKey}</TableCell>
                        <TableCell className="text-[11px] text-slate-600 break-words whitespace-normal">{item.finding}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] ${SEVERITY_STYLES[item.severity] || ''}`}>
                            {labelSeverity(item.severity)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] border-slate-200 text-slate-600 break-words whitespace-normal">
                            {labelDecision(item.recommendedDecision)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-[11px] text-slate-500 break-words">{item.suggestedFuturePhase || '—'}</TableCell>
                        <TableCell className="text-[11px] text-slate-400 break-words whitespace-normal">{item.notes || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}