import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, GitBranch, FileText, Stamp, Ban, CheckCircle, AlertTriangle, ExternalLink } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

const statusColors = {
  'Aguardando Nota': 'bg-amber-100 text-amber-700',
  'Aguardando Publicação': 'bg-blue-100 text-blue-700',
  'Publicado': 'bg-emerald-100 text-emerald-700',
};

function calcStatus(r) {
  if (r.numero_bg && r.data_bg) return 'Publicado';
  if (r.nota_para_bg) return 'Aguardando Publicação';
  return 'Aguardando Nota';
}

function detectarOrigemTipo(registro) {
  if (registro.tipo && !registro.tipo_registro && !registro.medico && !registro.cid_10) return 'ex-officio';
  if (registro.medico || registro.cid_10) return 'atestado';
  return 'livro';
}

function getTipoLabel(r) {
  return r.tipo_registro || r.tipo || (r.medico || r.cid_10 ? (r.necessita_jiso ? 'Atestado - JISO' : 'Atestado - Homologação') : '');
}

function formatDate(d) {
  if (!d) return '—';
  try { return format(new Date(d + 'T00:00:00'), 'dd/MM/yyyy'); } catch { return d; }
}

// Gerar código funcional legível ex: PUB-XXXX
function gerarCodigo(id) {
  if (!id) return '—';
  const hash = id.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(-4);
  return `PUB-${hash}`;
}

function gerarCodigoApostila(baseId, idx) {
  return `${gerarCodigo(baseId)}-AP${String(idx).padStart(2, '0')}`;
}

function gerarCodigoTSE(baseId, idx) {
  return `${gerarCodigo(baseId)}-TSE${String(idx).padStart(2, '0')}`;
}

function getEditUrl(registro) {
  if (!registro) return '#';
  if (registro.tipo && !registro.tipo_registro && !registro.medico && !registro.cid_10) {
    return `${createPageUrl('CadastrarPublicacao')}?id=${registro.id}`;
  }
  if (registro.medico || registro.cid_10) {
    return `${createPageUrl('CadastrarAtestado')}?id=${registro.id}`;
  }
  return `${createPageUrl('CadastrarRegistroLivro')}?id=${registro.id}`;
}

// Card de um item da família
function FamiliaItem({ label, codigo, tipoLabel, status, isSelected, onClick, onNavigate, indent = false, variant = 'original' }) {
  const variantConfig = {
    // Original: destaque maior — protagonista
    original: {
      bg: 'bg-white border-slate-300',
      selectedBg: 'bg-blue-50 border-blue-400',
      badge: 'bg-blue-100 text-blue-700 border-blue-200',
      dot: 'bg-blue-500',
      ring: 'ring-blue-400',
      labelSize: 'text-sm',
    },
    // Apostila: discreta, derivada
    apostila: {
      bg: 'bg-white border-slate-200',
      selectedBg: 'bg-purple-50 border-purple-300',
      badge: 'bg-purple-50 text-purple-600 border-purple-200',
      dot: 'bg-purple-400',
      ring: 'ring-purple-300',
      labelSize: 'text-xs',
    },
    // TSE: discreta, tom vermelho suave
    tse: {
      bg: 'bg-red-50/60 border-red-200',
      selectedBg: 'bg-red-50 border-red-300',
      badge: 'bg-red-50 text-red-600 border-red-200',
      dot: 'bg-red-400',
      ring: 'ring-red-300',
      labelSize: 'text-xs',
    },
  };
  const cfg = variantConfig[variant] || variantConfig.original;
  const bgClass = isSelected ? cfg.selectedBg : cfg.bg;
  const isOriginal = variant === 'original';

  return (
    <div
      className={`rounded-lg border p-3 transition-all ${bgClass} ${isSelected ? `ring-2 ring-offset-1 ${cfg.ring} shadow-sm` : 'hover:shadow-sm'} ${indent ? 'ml-4' : ''}`}
    >
      <button onClick={onClick} className="w-full text-left">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`w-2 h-2 rounded-full ${cfg.dot} shrink-0 mt-1`} />
            <div className="min-w-0">
              <p className="text-[10px] font-mono text-slate-400">{codigo}</p>
              <p className={`${isOriginal ? 'text-sm font-semibold' : 'text-xs font-medium'} text-slate-800 truncate`}>{tipoLabel}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <Badge className={`text-[10px] px-1.5 py-0 border ${cfg.badge}`}>{label}</Badge>
            <Badge className={`text-[10px] px-1.5 py-0 ${statusColors[status] || 'bg-slate-100 text-slate-600'}`}>{status}</Badge>
          </div>
        </div>
      </button>
      {onNavigate && (
        <div className="mt-2 flex justify-end">
          <button
            onClick={(e) => { e.stopPropagation(); onNavigate(); }}
            className="flex items-center gap-1 text-[10px] font-medium text-slate-500 hover:text-[#1e3a5f] transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            Abrir registro
          </button>
        </div>
      )}
    </div>
  );
}

export default function FamiliaPublicacaoPanel({ registro, todosRegistros, onClose }) {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = React.useState(registro?.id);

  if (!registro) return null;

  // Determinar raiz da família — seguir referência até a raiz
  let raizId = registro.publicacao_referencia_id || registro.id;
  // Um nível a mais: se a referência também tem referência, subir
  const refDaRef = todosRegistros.find(r => r.id === raizId);
  if (refDaRef?.publicacao_referencia_id) {
    raizId = refDaRef.publicacao_referencia_id;
  }

  // Encontrar raiz
  const raiz = todosRegistros.find(r => r.id === raizId) || registro;

  // Apostilas da raiz
  const apostilas = todosRegistros.filter(r =>
    r.publicacao_referencia_id === raiz.id && r.tipo === 'Apostila'
  );

  // TSE direto da raiz
  const tseRaiz = raiz.tornada_sem_efeito_por_id
    ? todosRegistros.find(r => r.id === raiz.tornada_sem_efeito_por_id)
    : todosRegistros.find(r => r.publicacao_referencia_id === raiz.id && r.tipo === 'Tornar sem Efeito');

  // TSEs das Apostilas (cadeia: Apostila → TSE da Apostila)
  // Para cada apostila, buscar seu TSE
  const tsesPorApostila = apostilas.map(ap => {
    const tse = ap.tornada_sem_efeito_por_id
      ? todosRegistros.find(r => r.id === ap.tornada_sem_efeito_por_id)
      : todosRegistros.find(r => r.publicacao_referencia_id === ap.id && r.tipo === 'Tornar sem Efeito');
    return { apostila: ap, tse: tse || null };
  });

  const foiInvalidada = !!raiz.tornada_sem_efeito_por_id || !!tseRaiz;

  // foiApostilada: só se houver apostila ativa (sem TSE)
  const apostilaAtiva = apostilas.find(ap => !ap.tornada_sem_efeito_por_id);
  const foiApostilada = !!apostilaAtiva || (!!raiz.apostilada_por_id && !tsesPorApostila.some(x => x.apostila.id === raiz.apostilada_por_id && x.tse));

  const raizStatus = calcStatus(raiz);
  const raizTipoLabel = getTipoLabel(raiz);
  const raizCodigo = gerarCodigo(raiz.id);

  // Item selecionado para detalhes
  const itemSelecionado = todosRegistros.find(r => r.id === selectedId) || raiz;
  const itemStatus = calcStatus(itemSelecionado);

  // Determinar papel do item selecionado
  const selectedIsOriginal = itemSelecionado.id === raiz.id;
  const selectedIsApostila = itemSelecionado.tipo === 'Apostila';
  const selectedIsTSE = itemSelecionado.tipo === 'Tornar sem Efeito';

  // Leitura operacional baseada no item SELECIONADO (não apenas no registro inicial)
  function gerarLeituraOperacional() {
    if (selectedIsOriginal) {
      const partes = ['Esta é a publicação original da família.'];
      if (foiApostilada) partes.push(`Possui ${apostilas.length} apostila(s) vinculada(s).`);
      if (foiInvalidada) partes.push('Foi tornada sem efeito.');
      if (tsesPorApostila.some(x => x.tse)) partes.push('Uma ou mais apostilas foram tornadas sem efeito.');
      return partes.join(' ');
    }
    if (selectedIsApostila) {
      return `Esta publicação é uma apostila que corrige a publicação original ${raizCodigo}.`;
    }
    if (selectedIsTSE) {
      return `Esta publicação torna sem efeito a publicação original ${raizCodigo}.`;
    }
    return 'Publicação vinculada à família.';
  }

  const temFamilia = apostilas.length > 0 || foiInvalidada || !!registro.publicacao_referencia_id || tsesPorApostila.some(x => x.tse);

  return (
    <div className="fixed inset-y-0 right-0 w-full md:w-[440px] bg-white shadow-2xl z-50 flex flex-col border-l border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="bg-[#1e3a5f] text-white px-5 py-4 flex items-start justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center">
            <GitBranch className="w-5 h-5 text-blue-200" />
          </div>
          <div>
            <h2 className="font-bold text-base leading-tight">Família da Publicação</h2>
            <p className="text-xs text-white/60">Rastreabilidade e vínculos</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-white/70 hover:text-white hover:bg-white/10 mt-0.5"
          onClick={onClose}
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
        {/* Identificação da raiz */}
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-[#1e3a5f]" />
            <span className="text-xs font-bold text-[#1e3a5f] uppercase tracking-wide">Publicação Base</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500">Código</span>
              <span className="font-mono font-bold text-slate-700 text-sm">{raizCodigo}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500">Militar</span>
              <span className="text-sm font-semibold text-slate-800">
                {raiz.militar_posto ? `${raiz.militar_posto} ` : ''}{raiz.militar_nome}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500">Tipo</span>
              <span className="text-sm text-slate-700">{raizTipoLabel}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500">Status</span>
              <Badge className={`${statusColors[raizStatus] || 'bg-slate-100 text-slate-600'} text-xs`}>{raizStatus}</Badge>
            </div>
            {/* Badges de estado da família — discretas */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {foiApostilada && (
                <span className="flex items-center gap-1 text-[10px] font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                  <Stamp className="w-3 h-3" /> Apostilada
                </span>
              )}
              {foiInvalidada && (
                <span className="flex items-center gap-1 text-[10px] font-medium text-red-500 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                  <Ban className="w-3 h-3" /> Sem Validade
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Árvore da Família */}
        <div>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-3">
            Estrutura da Família
          </span>
          <div className="space-y-2">
            {/* Original */}
            <FamiliaItem
              label="ORIGINAL"
              codigo={raizCodigo}
              tipoLabel={raizTipoLabel}
              status={raizStatus}
              isSelected={selectedId === raiz.id}
              onClick={() => setSelectedId(raiz.id)}
              onNavigate={() => { navigate(getEditUrl(raiz)); onClose(); }}
              variant="original"
            />

            {/* Apostilas + TSE de cada Apostila */}
            {tsesPorApostila.map(({ apostila: ap, tse: tseAp }, idx) => (
              <React.Fragment key={ap.id}>
                <FamiliaItem
                  label="APOSTILA"
                  codigo={gerarCodigoApostila(raiz.id, idx + 1)}
                  tipoLabel={getTipoLabel(ap) || 'Apostila'}
                  status={calcStatus(ap)}
                  isSelected={selectedId === ap.id}
                  onClick={() => setSelectedId(ap.id)}
                  onNavigate={() => { navigate(getEditUrl(ap)); onClose(); }}
                  indent
                  variant="apostila"
                />
                {tseAp && (
                  <FamiliaItem
                    label="TSE DA APOSTILA"
                    codigo={`${gerarCodigoApostila(raiz.id, idx + 1)}-TSE`}
                    tipoLabel={getTipoLabel(tseAp) || 'Tornar sem Efeito'}
                    status={calcStatus(tseAp)}
                    isSelected={selectedId === tseAp.id}
                    onClick={() => setSelectedId(tseAp.id)}
                    onNavigate={() => { navigate(getEditUrl(tseAp)); onClose(); }}
                    indent
                    variant="tse"
                  />
                )}
              </React.Fragment>
            ))}

            {/* TSE direto da raiz */}
            {tseRaiz && (
              <FamiliaItem
                label="TORNAR S/ EFEITO"
                codigo={gerarCodigoTSE(raiz.id, 1)}
                tipoLabel={getTipoLabel(tseRaiz) || 'Tornar sem Efeito'}
                status={calcStatus(tseRaiz)}
                isSelected={selectedId === tseRaiz.id}
                onClick={() => setSelectedId(tseRaiz.id)}
                onNavigate={() => { navigate(getEditUrl(tseRaiz)); onClose(); }}
                indent
                variant="tse"
              />
            )}

            {!temFamilia && apostilas.length === 0 && !tseVinculado && (
              <p className="text-sm text-slate-400 text-center py-3 italic">
                Esta publicação não possui vínculos de família registrados.
              </p>
            )}
          </div>
        </div>

        {/* Detalhes do item selecionado */}
        {itemSelecionado && (
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-3">
              Detalhes do Item Selecionado
            </span>
            <div className="space-y-1.5 text-sm">
              {itemSelecionado.militar_nome && (
                <div className="flex justify-between">
                  <span className="text-xs text-slate-400">Militar</span>
                  <span className="text-slate-700 font-medium text-xs text-right">{itemSelecionado.militar_posto} {itemSelecionado.militar_nome}</span>
                </div>
              )}
              {getTipoLabel(itemSelecionado) && (
                <div className="flex justify-between">
                  <span className="text-xs text-slate-400">Tipo</span>
                  <span className="text-slate-700 text-xs font-medium">{getTipoLabel(itemSelecionado)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-xs text-slate-400">Status</span>
                <Badge className={`${statusColors[itemStatus]} text-xs`}>{itemStatus}</Badge>
              </div>
              {itemSelecionado.nota_para_bg && (
                <div className="flex justify-between">
                  <span className="text-xs text-slate-400">Nota BG</span>
                  <span className="text-slate-700 text-xs font-medium">{itemSelecionado.nota_para_bg}</span>
                </div>
              )}
              {itemSelecionado.numero_bg && (
                <div className="flex justify-between">
                  <span className="text-xs text-slate-400">BG Nº</span>
                  <span className="text-emerald-700 text-xs font-bold">{itemSelecionado.numero_bg}</span>
                </div>
              )}
              {itemSelecionado.data_bg && (
                <div className="flex justify-between">
                  <span className="text-xs text-slate-400">Data BG</span>
                  <span className="text-slate-700 text-xs font-medium">{formatDate(itemSelecionado.data_bg)}</span>
                </div>
              )}
              {itemSelecionado.publicacao_referencia_id && (
                <div className="flex justify-between">
                  <span className="text-xs text-slate-400">Referência Base</span>
                  <span className="font-mono text-xs text-purple-700 font-bold">{gerarCodigo(itemSelecionado.publicacao_referencia_id)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Leitura operacional */}
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700 leading-relaxed">
              {gerarLeituraOperacional()}
            </p>
          </div>
        </div>
      </div>

      {/* Nota de rodapé — discreta */}
      {(foiInvalidada && tseRaiz) || tsesPorApostila.some(x => x.tse) ? (
        <div className="shrink-0 border-t border-slate-100 bg-slate-50 px-5 py-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-500">
              Esta publicação foi tornada sem efeito. Mantenha o registro para preservar o histórico.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}