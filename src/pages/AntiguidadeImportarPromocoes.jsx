import React from 'react';
import { AlertTriangle, CheckCircle2, Clock3, FileText, ListChecks, PencilLine, ShieldAlert, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const militarMock = {
  nomeGuerra: 'SILVA',
  nomeCompleto: 'João Carlos da Silva',
  matricula: 'BM-123456',
  postoGraduacaoAtual: 'Subtenente',
  quadroAtual: 'QBMG-1',
  lotacaoAtual: '1º GBM - Campo Grande',
};

const historicoMock = [
  {
    id: 'h1',
    status: 'ativo',
    postoAnterior: '1º Sargento',
    postoNovo: 'Subtenente',
    quadro: 'QBMG-1',
    dataPromocao: '2025-12-01',
    numeroAntiguidade: 14,
    ato: 'DOEMS nº 11.921 / Boletim 334',
    observacoes: 'Promoção por merecimento.',
    origem: 'Cadastro manual',
    registroAtual: true,
  },
  {
    id: 'h2',
    status: 'retificado',
    postoAnterior: '2º Sargento',
    postoNovo: '1º Sargento',
    quadro: 'QBMG-1',
    dataPromocao: '2022-06-15',
    numeroAntiguidade: 22,
    ato: 'DOEMS nº 10.877',
    observacoes: 'Retificado para ajuste da data de publicação.',
    origem: 'Migração legado',
    registroAtual: false,
  },
];

const statusRegistroClass = {
  ativo: 'bg-emerald-100 text-emerald-800',
  pendente: 'bg-amber-100 text-amber-800',
  retificado: 'bg-blue-100 text-blue-800',
  cancelado: 'bg-rose-100 text-rose-800',
};

export default function AntiguidadeImportarPromocoes() {
  const [openModal, setOpenModal] = React.useState(false);
  const [isRetificacao, setIsRetificacao] = React.useState(false);

  const registroAtual = historicoMock.find((item) => item.registroAtual && item.status === 'ativo');
  const statusListagem = registroAtual?.dataPromocao && registroAtual?.numeroAntiguidade ? 'Apto' : 'Pendente';

  const criterios = [
    { label: 'Posto/graduação válido', ok: true },
    { label: 'Quadro compatível', ok: true },
    { label: 'Data de promoção preenchida', ok: Boolean(registroAtual?.dataPromocao) },
    { label: 'Número de antiguidade definido', ok: Boolean(registroAtual?.numeroAntiguidade) },
  ];

  const pendencias = [
    !registroAtual?.dataPromocao && 'Sem data de promoção',
    !registroAtual?.numeroAntiguidade && 'Sem número de antiguidade',
    false && 'Empate não resolvido',
    false && 'Quadro incompatível',
  ].filter(Boolean);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1e3a5f]">Carreira e Antiguidade</h1>
        <p className="text-sm text-slate-600">Visualização e gestão apenas da promoção atual e histórico já registrado.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Situação Atual</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          <Info label="Nome de guerra" value={militarMock.nomeGuerra} />
          <Info label="Nome completo" value={militarMock.nomeCompleto} />
          <Info label="Matrícula" value={militarMock.matricula} />
          <Info label="Posto/graduação atual" value={militarMock.postoGraduacaoAtual} />
          <Info label="Quadro atual" value={militarMock.quadroAtual} />
          <Info label="Lotação atual" value={militarMock.lotacaoAtual} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row justify-between items-start gap-3">
          <CardTitle>Dados da Promoção Atual</CardTitle>
          <Button onClick={() => { setIsRetificacao(Boolean(registroAtual)); setOpenModal(true); }}>
            <PencilLine className="w-4 h-4 mr-2" />
            Registrar / Retificar Promoção Atual
          </Button>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {!registroAtual && (
            <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900">
              <AlertTriangle className="w-4 h-4 mt-0.5" />
              Promoção atual sem data registrada. Este militar ficará pendente na listagem de antiguidade.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Info label="Data da promoção atual" value={registroAtual?.dataPromocao || '—'} />
            <Info label="Nº/ordem de antiguidade" value={registroAtual?.numeroAntiguidade || '—'} />
            <Info label="DOEMS / Boletim / Ato" value={registroAtual?.ato || '—'} />
            <Info label="Data da publicação" value={registroAtual?.dataPromocao || '—'} />
            <Info label="Status do registro" value={<Badge className={statusRegistroClass[registroAtual?.status || 'pendente']}>{registroAtual ? 'Ativo' : 'Pendente'}</Badge>} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Impacto na Listagem</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex items-center gap-2">
            <Badge className={statusListagem === 'Apto' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}>{statusListagem}</Badge>
            <span className="text-slate-600">Status na composição de antiguidade.</span>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Critérios identificados:</h3>
            <ul className="space-y-1">
              {criterios.map((criterio) => (
                <li key={criterio.label} className="flex items-center gap-2">
                  {criterio.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Clock3 className="w-4 h-4 text-amber-600" />}
                  {criterio.label}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Pendências, se existirem:</h3>
            {pendencias.length === 0 ? <p className="text-emerald-700">Sem pendências.</p> : (
              <ul className="space-y-1 text-amber-800">
                {pendencias.map((p) => <li key={p} className="flex items-center gap-2"><ShieldAlert className="w-4 h-4" />{p}</li>)}
              </ul>
            )}
          </div>

          <div className="rounded-md bg-slate-100 px-3 py-2 text-slate-700">Prévia: “Aguardando snapshot rascunho”</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><History className="w-4 h-4" /> Histórico de Promoções</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {historicoMock.map((item) => (
            <div key={item.id} className="rounded-lg border p-4 bg-white space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={statusRegistroClass[item.status]}>{item.status[0].toUpperCase() + item.status.slice(1)}</Badge>
                {item.registroAtual && <Badge variant="outline">Registro atual</Badge>}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                <Info label="Posto/graduação anterior" value={item.postoAnterior} />
                <Info label="Posto/graduação novo" value={item.postoNovo} />
                <Info label="Quadro" value={item.quadro} />
                <Info label="Data da promoção" value={item.dataPromocao} />
                <Info label="Nº/ordem de antiguidade" value={item.numeroAntiguidade} />
                <Info label="DOEMS / boletim / ato" value={item.ato} />
                <Info label="Observações" value={item.observacoes} />
                <Info label="Origem do dado" value={item.origem} />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm"><FileText className="w-4 h-4 mr-2" />Ver detalhes</Button>
                <Button variant="outline" size="sm">Retificar</Button>
                <Button variant="destructive" size="sm">Cancelar</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Registrar / Retificar Promoção Atual</DialogTitle>
            <DialogDescription>
              Este registro não altera o posto, graduação ou quadro do militar. Ele apenas registra os dados da promoção atual para fins de antiguidade.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <ReadOnlyField label="Militar" value={militarMock.nomeCompleto} />
            <ReadOnlyField label="Matrícula" value={militarMock.matricula} />
            <ReadOnlyField label="Posto/graduação atual" value={militarMock.postoGraduacaoAtual} />
            <ReadOnlyField label="Quadro atual" value={militarMock.quadroAtual} />
            <ReadOnlyField label="Lotação" value={militarMock.lotacaoAtual} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label>Data da promoção atual</Label><Input type="date" /></div>
            <div><Label>Nº/ordem de antiguidade</Label><Input placeholder="Ex: 14" /></div>
            <div><Label>DOEMS / Boletim / Ato</Label><Input placeholder="Número da referência" /></div>
            <div><Label>Data da publicação</Label><Input type="date" /></div>
            <div className="md:col-span-2"><Label>Observações</Label><Textarea placeholder="Observações do registro" /></div>
            {isRetificacao && <div className="md:col-span-2"><Label>Motivo da retificação</Label><Textarea placeholder="Obrigatório na retificação" /></div>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenModal(false)}>Cancelar</Button>
            <Button><ListChecks className="w-4 h-4 mr-2" />Salvar registro</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Info({ label, value }) {
  return <div><p className="text-xs uppercase text-slate-500">{label}</p><div className="font-medium text-slate-800">{value}</div></div>;
}

function ReadOnlyField({ label, value }) {
  return <div className="rounded-md border bg-slate-50 px-3 py-2"><p className="text-xs uppercase text-slate-500">{label}</p><p className="font-medium">{value}</p></div>;
}
