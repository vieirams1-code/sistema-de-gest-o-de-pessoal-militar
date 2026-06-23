import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, FileText } from 'lucide-react';

function formatarData(data) {
  if (!data) return '—';
  return String(data).slice(0, 10).split('-').reverse().join('/');
}

function gerarTextoPadrao(dados) {
  const posto = dados.militar_posto || '';
  const nome = dados.militar_nome || '';
  const matricula = dados.militar_matricula || '';
  return `Dispensa com desconto em férias do(a) ${posto} ${nome} (Mat. ${matricula}), `
    + `no total de ${dados.dias} dia(s), no período de ${formatarData(dados.data_inicio)} a ${formatarData(dados.data_fim)}.`;
}

/**
 * Modal de publicação no padrão visual da Ata JISO:
 * dados administrativos à esquerda, texto editável à direita,
 * campos Nota para BG, Número BG e Data BG.
 */
export default function PublicacaoDescontoModal({ open, onClose, dadosDesconto, onConfirmar }) {
  const [textoPublicacao, setTextoPublicacao] = useState(() => gerarTextoPadrao(dadosDesconto));
  const [notaParaBg, setNotaParaBg] = useState('');
  const [numeroBg, setNumeroBg] = useState('');
  const [dataBg, setDataBg] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const statusPrevisto = useMemo(() => {
    if (numeroBg || dataBg) return 'Publicado';
    if (notaParaBg) return 'Aguardando Publicação';
    return 'Aguardando Nota';
  }, [numeroBg, dataBg, notaParaBg]);

  const handleConfirmar = async () => {
    if (salvando) return;
    setErro('');
    setSalvando(true);
    try {
      await onConfirmar({
        texto_publicacao: textoPublicacao,
        nota_para_bg: notaParaBg,
        numero_bg: numeroBg,
        data_bg: dataBg,
      });
    } catch (e) {
      setErro(e?.message || 'Falha ao gerar publicação.');
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !salvando) onClose(); }}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#1e3a5f]">
            <FileText className="w-5 h-5" /> Gerar Publicação — Dispensa com Desconto em Férias
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* ESQUERDA — dados administrativos */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-semibold text-[#1e3a5f]">Dados do Desconto</h3>
              <div className="text-sm text-slate-700 space-y-1.5">
                <p><span className="font-medium">Militar:</span> {dadosDesconto.militar_posto} {dadosDesconto.militar_nome}</p>
                <p><span className="font-medium">Matrícula:</span> {dadosDesconto.militar_matricula || '—'}</p>
                <p><span className="font-medium">Período:</span> {dadosDesconto.periodo_aquisitivo_ref || '—'}</p>
                <p><span className="font-medium">Dias:</span> {dadosDesconto.dias}</p>
                <p><span className="font-medium">Início:</span> {formatarData(dadosDesconto.data_inicio)}</p>
                <p><span className="font-medium">Fim:</span> {formatarData(dadosDesconto.data_fim)}</p>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
              <h3 className="text-sm font-semibold text-[#1e3a5f]">Publicação no BG</h3>
              <div>
                <Label className="text-sm text-slate-700">Nota para BG</Label>
                <Input className="mt-1.5" value={notaParaBg} onChange={(e) => setNotaParaBg(e.target.value)} placeholder="Ex: NOTA 001/2026" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm text-slate-700">Número BG</Label>
                  <Input className="mt-1.5" value={numeroBg} onChange={(e) => setNumeroBg(e.target.value)} placeholder="Ex: 110" />
                </div>
                <div>
                  <Label className="text-sm text-slate-700">Data BG</Label>
                  <Input className="mt-1.5" type="date" value={dataBg} onChange={(e) => setDataBg(e.target.value)} />
                </div>
              </div>
              <div className="text-xs text-slate-500">
                Status previsto: <span className="font-semibold text-slate-700">{statusPrevisto}</span>
              </div>
            </div>
          </div>

          {/* DIREITA — texto editável */}
          <div className="lg:col-span-7 flex flex-col">
            <Label className="text-sm font-semibold text-slate-900 mb-2">Texto da Publicação</Label>
            <Textarea
              value={textoPublicacao}
              onChange={(e) => setTextoPublicacao(e.target.value)}
              rows={16}
              className="flex-1 min-h-[300px] text-sm"
              placeholder="Digite o texto completo da publicação..."
            />
          </div>
        </div>

        {erro && <p className="text-sm text-red-600">{erro}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onClose} disabled={salvando}>Voltar</Button>
          <Button onClick={handleConfirmar} disabled={salvando} className="bg-[#1e3a5f] hover:bg-[#16304f]">
            {salvando ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</> : 'Salvar Publicação'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}