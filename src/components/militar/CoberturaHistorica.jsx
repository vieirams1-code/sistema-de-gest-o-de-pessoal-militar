import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText } from 'lucide-react';
import { contarDocumentosAcervo } from '@/services/acervoHistoricoService';

export default function CoberturaHistorica({ acervo = [] }) {
  const contadores = React.useMemo(() => contarDocumentosAcervo(acervo), [acervo]);

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2 text-[#1e3a5f]">
          <FileText className="w-5 h-5" />
          Cobertura Documental
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-3 gap-3">
          <CoverageItem label="Alterações" value={`${contadores.alteracoes} período(s)`} />
          <CoverageItem label="Certidões" value={`${contadores.certidoes} documento(s)`} />
          <CoverageItem label="Diversos" value={`${contadores.diversos} documento(s)`} />
        </div>
      </CardContent>
    </Card>
  );
}

function CoverageItem({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-800">{value}</p>
    </div>
  );
}
