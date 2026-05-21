import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';

const CONFIRM_TEXT = 'CORRIGIR TEXTO';
const CONFIRM_PUBLISHED_TEXT = 'PUBLICADO CIENTE';
const EVENTO_SANEAMENTO = 'saneamento_texto_ferias_qobm';

const normalize = (v) => String(v || '').trim();
const containsQobm = (txt) => /\bQOBM\b/i.test(normalize(txt));
const isFeriasTipo = (tipo = '') => /f[eé]rias|livro/i.test(String(tipo));

function classificarRegistro(registro, militar) {
  const quadro = normalize(militar?.quadro).toUpperCase();
  const status = normalize(registro?.status).toLowerCase();
  if (!militar?.id || !quadro || !containsQobm(registro?.texto_publicacao) || !isFeriasTipo(registro?.tipo_registro)) {
    return { classe: 'revisao_manual', label: 'Revisão manual', motivo: 'Vínculo incompleto/conflito de dados.' };
  }
  if (quadro === 'QOBM') return { classe: 'ignorar', label: 'Ignorar: militar é QOBM', motivo: 'Quadro real já é QOBM.' };
  if (status === 'publicado') return { classe: 'revisao_manual', label: 'Revisão manual', motivo: 'Registro já publicado exige confirmação adicional.' };
  return { classe: 'seguro', label: 'Seguro para revisão', motivo: 'Critérios mínimos atendidos.' };
}

function buildSuggestion(textoAtual, quadroReal) {
  return normalize(textoAtual).replace(/\bQOBM\b/g, quadroReal || '');
}

export default function SaneamentoFeriasQobm() {
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const [selecionado, setSelecionado] = useState(null);
  const [textoNovo, setTextoNovo] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [confirmacaoPublicado, setConfirmacaoPublicado] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['saneamento-ferias-qobm'],
    queryFn: async () => {
      const registros = await base44.entities.RegistroLivro.filter({ tipo_registro: 'férias' }, '-data_registro', 500);
      const candidatos = (registros || []).filter((item) => containsQobm(item?.texto_publicacao || '') || isFeriasTipo(item?.tipo_registro));
      const militarIds = [...new Set(candidatos.map((r) => String(r?.militar_id || '')).filter(Boolean))];
      const militaresPorId = new Map();
      await Promise.all(militarIds.map(async (id) => {
        const m = await base44.entities.Militar.filter({ id });
        militaresPorId.set(id, m?.[0] || null);
      }));
      return candidatos.map((registro) => {
        const militar = militaresPorId.get(String(registro?.militar_id || '')) || null;
        const classificacao = classificarRegistro(registro, militar);
        return { registro, militar, classificacao };
      });
    },
  });

  const itens = data || [];
  const resumo = useMemo(() => itens.reduce((acc, item) => {
    acc.suspeitos += 1;
    if (item.classificacao.classe === 'seguro') acc.seguros += 1;
    if (item.classificacao.classe === 'ignorar') acc.ignorados += 1;
    if (item.classificacao.classe === 'revisao_manual') acc.revisao += 1;
    return acc;
  }, { suspeitos: 0, seguros: 0, ignorados: 0, revisao: 0 }), [itens]);

  const saveMutation = useMutation({
    mutationFn: async ({ id, payload }) => base44.entities.RegistroLivro.update(id, payload),
    onSuccess: () => {
      toast({ title: 'Correção salva', description: 'Registro atualizado com auditoria.' });
      queryClient.invalidateQueries({ queryKey: ['saneamento-ferias-qobm'] });
      setSelecionado(null); setTextoNovo(''); setConfirmacao(''); setConfirmacaoPublicado('');
    },
    onError: (error) => toast({ title: 'Falha ao salvar', description: error?.message || 'Erro inesperado.' }),
  });

  const abrir = (item) => {
    setSelecionado(item);
    setTextoNovo(buildSuggestion(item.registro?.texto_publicacao, item.militar?.quadro));
    setConfirmacao('');
    setConfirmacaoPublicado('');
  };

  const bloqueio = useMemo(() => {
    if (!selecionado) return null;
    const { registro, militar } = selecionado;
    const quadro = normalize(militar?.quadro).toUpperCase();
    if (quadro === 'QOBM') return 'Bloqueado: quadro real do militar é QOBM.';
    if (!quadro) return 'Bloqueado: quadro do militar ausente.';
    if (!containsQobm(registro?.texto_publicacao)) return 'Bloqueado: texto não contém QOBM.';
    if (normalize(registro?.status).toLowerCase() === 'publicado' && confirmacaoPublicado !== CONFIRM_PUBLISHED_TEXT) return `Publicado: digite ${CONFIRM_PUBLISHED_TEXT}.`;
    return null;
  }, [selecionado, confirmacaoPublicado]);

  const salvar = async () => {
    if (!selecionado || confirmacao !== CONFIRM_TEXT || bloqueio) return;
    const anterior = selecionado.registro?.texto_publicacao || '';
    const historicoAtual = Array.isArray(selecionado.registro?.historico_publicacao) ? selecionado.registro.historico_publicacao : [];
    const auditoria = {
      evento: EVENTO_SANEAMENTO,
      before: anterior,
      after: textoNovo,
      motivo: 'Correção manual assistida de quadro gerado indevidamente como QOBM',
      user: user?.email || user?.id || 'desconhecido',
      timestamp: new Date().toISOString(),
    };
    await saveMutation.mutateAsync({ id: selecionado.registro.id, payload: { texto_publicacao: textoNovo, historico_publicacao: [...historicoAtual, auditoria] } });
  };

  return (
    <div className="p-6 space-y-4">
      {/* Ferramenta temporária de saneamento. Remover após conclusão. */}
      <h1 className="text-2xl font-bold text-[#1e3a5f]">Saneamento Férias QOBM</h1>
      <p className="text-sm text-slate-600">Revisão manual assistida de textos com QOBM indevido em publicação de férias/livro.</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(resumo).map(([k, v]) => <Card key={k}><CardHeader className="py-3"><CardTitle className="text-xs uppercase">{k}</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{v}</CardContent></Card>)}
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-slate-50 text-left"><th className="p-2">Militar</th><th>Matrícula</th><th>Quadro</th><th>Tipo</th><th>Status</th><th>Data</th><th>Trecho</th><th>Classificação</th><th></th></tr></thead>
            <tbody>
              {!isLoading && itens.map((item) => (
                <tr key={item.registro.id} className="border-b align-top">
                  <td className="p-2">{item.militar?.nome_completo || '—'}</td><td>{item.militar?.matricula || '—'}</td><td>{item.militar?.quadro || '—'}</td>
                  <td>{item.registro?.tipo_registro || '—'}</td><td>{item.registro?.status || '—'}</td><td>{item.registro?.data_registro || '—'}</td>
                  <td className="max-w-xs truncate">{normalize(item.registro?.texto_publicacao).slice(0, 120)}</td>
                  <td><Badge variant="outline">{item.classificacao.label}</Badge></td>
                  <td><Button size="sm" onClick={() => abrir(item)}>Revisar</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={!!selecionado} onOpenChange={() => setSelecionado(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader><DialogTitle>Revisão manual assistida</DialogTitle><DialogDescription>Antes/depois editável. Nenhuma alteração é automática.</DialogDescription></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label>Texto atual</Label><Textarea value={selecionado?.registro?.texto_publicacao || ''} readOnly className="min-h-64" /></div>
            <div><Label>Sugestão (editável)</Label><Textarea value={textoNovo} onChange={(e) => setTextoNovo(e.target.value)} className="min-h-64" /></div>
          </div>
          {normalize(selecionado?.registro?.status).toLowerCase() === 'publicado' && (
            <div><Label>Confirmação para publicado</Label><Input value={confirmacaoPublicado} onChange={(e) => setConfirmacaoPublicado(e.target.value)} placeholder={CONFIRM_PUBLISHED_TEXT} /></div>
          )}
          <div><Label>Confirmação obrigatória</Label><Input value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} placeholder={CONFIRM_TEXT} /></div>
          {bloqueio && <p className="text-sm text-red-700">{bloqueio}</p>}
          <DialogFooter><Button variant="outline" onClick={() => setSelecionado(null)}>Cancelar</Button><Button onClick={salvar} disabled={confirmacao !== CONFIRM_TEXT || !!bloqueio || saveMutation.isPending}>Salvar correção</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
